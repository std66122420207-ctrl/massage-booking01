const express = require('express');
const router  = express.Router();
const { db, COLLECTIONS, admin } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { sendPushToUser } = require('./fcm');
const { sendSms } = require('../services/sms');
const { isQuotaExceededError, markQuotaExceeded, isQuotaPaused, getCachedValue, setCachedValue, deleteCachedValue } = require('../services/firestoreGuard');
const { isBookingCancellable } = require('../services/bookingPolicy');

// ── GET /api/notifications — แจ้งเตือนของผู้ใช้ที่ login อยู่ ──────
router.get('/', verifyToken, async (req, res) => {
  const cacheKey = `notifications:${req.user.uid}`;
  const cached = getCachedValue(cacheKey, 60_000);
  if (cached !== undefined) {
    return res.json(cached);
  }

  if (isQuotaPaused()) {
    return res.json([]);
  }

  try {
    const snap = await db.collection(COLLECTIONS.NOTIFICATIONS)
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const notifications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setCachedValue(cacheKey, notifications, 60_000);
    res.json(notifications);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markQuotaExceeded(err);
      console.warn('Firestore quota exceeded while fetching notifications for user; returning empty list.');
      return res.json([]);
    }
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/notifications/:id/confirm — ผู้ใช้รับทราบหรือยืนยันว่ามาถึงตามเวลานัด
// ส่งผลกลับไปให้แอดมินเห็นสถานะนี้ผ่าน GET /api/notifications/admin/all
router.post('/:id/confirm', verifyToken, async (req, res) => {
  try {
    const ref = db.collection(COLLECTIONS.NOTIFICATIONS).doc(req.params.id);
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      if (!doc.exists) return { status: 404, error: 'ไม่พบการแจ้งเตือนนี้' };
      const notification = doc.data();
      if (notification.userId !== req.user.uid) {
        return { status: 403, error: 'ไม่มีสิทธิ์เข้าถึงการแจ้งเตือนนี้' };
      }
      const bookingRef = notification.bookingId
        ? db.collection(COLLECTIONS.BOOKINGS).doc(notification.bookingId)
        : null;
      const bookingDoc = bookingRef ? await transaction.get(bookingRef) : null;
      if (notification.type === 'appointment_due' && bookingDoc?.exists) {
        const booking = bookingDoc.data();
        const appointment = new Date(`${booking.bookingDate}T${booking.timeSlot}:00+07:00`);
        const graceEndsAt = appointment.getTime() + 5 * 60 * 1000;
        if (
          booking.status === 'cancelled' ||
          !Number.isFinite(appointment.getTime()) ||
          Date.now() >= graceEndsAt
        ) {
          return { status: 409, error: 'หมดเวลายืนยันการมาถึงแล้ว' };
        }
      }
      transaction.update(ref, {
        confirmed: true,
        confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (bookingRef && bookingDoc?.exists && notification.type === 'appointment_due') {
        transaction.update(bookingRef, {
          customerConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      return { status: 200 };
    });
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });
    deleteCachedValue(`notifications:${req.user.uid}`);
    deleteCachedValue('notifications:admin');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/notifications/:id/resend — Admin: ส่งแจ้งเตือนซ้ำ ──
router.post('/:id/resend', verifyToken, requireAdmin, async (req, res) => {
  try {
    const notificationRef = db.collection(COLLECTIONS.NOTIFICATIONS).doc(req.params.id);
    const notificationDoc = await notificationRef.get();
    if (!notificationDoc.exists) return res.status(404).json({ error: 'ไม่พบการแจ้งเตือนนี้' });
    const notification = notificationDoc.data();
    const message = notification.message || 'กรุณามาที่ศูนย์บริการตามเวลานัด';
    const bookingDoc = notification.bookingId
      ? await db.collection(COLLECTIONS.BOOKINGS).doc(notification.bookingId).get()
      : null;
    const booking = bookingDoc?.exists ? bookingDoc.data() : {};
    await notificationRef.update({
      lastResentAt: admin.firestore.FieldValue.serverTimestamp(),
      resendCount: admin.firestore.FieldValue.increment(1),
    });
    deleteCachedValue('notifications:admin');
    sendPushToUser(notification.userId, 'แจ้งเตือนจากศูนย์บริการ', message, {
      bookingId: notification.bookingId || '',
      type: 'notification_resend',
    }).catch((error) => console.error('ส่ง push ซ้ำไม่สำเร็จ:', error));
    const sms = await sendSms(booking.customerPhone, message);
    res.json({ success: true, message: sms.sent ? 'ส่ง SMS และแจ้งเตือนซ้ำแล้ว' : 'ส่งแจ้งเตือนซ้ำแล้ว (ยังไม่ได้ตั้งค่า SMS)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/notifications/:id/admin-confirm — Admin: ยืนยันคิวแทนลูกค้า
router.post('/:id/admin-confirm', verifyToken, requireAdmin, async (req, res) => {
  try {
    const notificationRef = db.collection(COLLECTIONS.NOTIFICATIONS).doc(req.params.id);
    const result = await db.runTransaction(async (transaction) => {
      const notificationDoc = await transaction.get(notificationRef);
      if (!notificationDoc.exists) return { status: 404, error: 'ไม่พบการแจ้งเตือนนี้' };
      const notification = notificationDoc.data();
      const bookingRef = notification.bookingId
        ? db.collection(COLLECTIONS.BOOKINGS).doc(notification.bookingId)
        : null;
      const bookingDoc = bookingRef ? await transaction.get(bookingRef) : null;
      if (
        bookingDoc?.exists &&
        ['cancelled', 'done'].includes(bookingDoc.data().status)
      ) {
        return { status: 409, error: 'คิวนี้ปิดรายการแล้ว' };
      }
      transaction.update(notificationRef, {
        confirmed: true,
        confirmedByAdmin: true,
        confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (bookingRef && bookingDoc?.exists) {
        const bookingUpdate = {
          customerConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
          confirmedByAdmin: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (bookingDoc.data().status !== 'in_service') bookingUpdate.status = 'confirmed';
        transaction.update(bookingRef, bookingUpdate);
      }
      return { status: 200 };
    });
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });
    deleteCachedValue('notifications:admin');
    res.json({ success: true, message: 'ยืนยันคิวแล้ว' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/notifications/:id/admin-cancel — Admin: ยกเลิกคิวแทนลูกค้า
router.post('/:id/admin-cancel', verifyToken, requireAdmin, async (req, res) => {
  try {
    const notificationRef = db.collection(COLLECTIONS.NOTIFICATIONS).doc(req.params.id);
    const result = await db.runTransaction(async (transaction) => {
      const notificationDoc = await transaction.get(notificationRef);
      if (!notificationDoc.exists) return { status: 404, error: 'ไม่พบการแจ้งเตือนนี้' };
      const notification = notificationDoc.data();
      if (!notification.bookingId) {
        return { status: 400, error: 'การแจ้งเตือนนี้ไม่มีรายการจองที่เชื่อมโยง' };
      }

      const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(notification.bookingId);
      const bookingDoc = await transaction.get(bookingRef);
      if (!bookingDoc.exists) return { status: 404, error: 'ไม่พบรายการจองที่เชื่อมโยง' };
      const booking = bookingDoc.data();
      if (!booking.userId || booking.userId !== notification.userId) {
        return { status: 409, error: 'ข้อมูลผู้รับการแจ้งเตือนไม่ตรงกับรายการจอง' };
      }
      if (!isBookingCancellable(booking.status)) {
        return { status: 409, error: 'ยกเลิกไม่ได้ เนื่องจากคิวเริ่มให้บริการหรือเสร็จสิ้นแล้ว' };
      }

      transaction.update(notificationRef, {
        confirmed: true,
        resolvedByAdmin: true,
        resolvedAction: 'cancelled',
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.update(bookingRef, {
        status: 'cancelled',
        cancelledByAdmin: true,
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { status: 200, bookingId: notification.bookingId, booking };
    });
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });

    const delivery = await notifyBookingCancelled(result.bookingId, result.booking);
    deleteCachedValue(`notifications:${result.booking.userId}`);
    deleteCachedValue('notifications:admin');
    if (!delivery.inAppSent) {
      return res.json({
        success: true,
        message: 'ยกเลิกคิวแล้ว แต่สร้างการแจ้งเตือนในแอปไม่สำเร็จ',
        notificationSent: false,
      });
    }
    res.json({ success: true, message: 'ยกเลิกคิวแล้ว' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/notifications/admin/all — แอดมิน: ดูสถานะการแจ้งเตือน ──
router.get('/admin/all', verifyToken, requireAdmin, async (req, res) => {
  const cacheKey = 'notifications:admin';
  const cached = getCachedValue(cacheKey, 120_000);
  if (cached !== undefined) {
    return res.json(cached);
  }

  if (isQuotaPaused()) {
    return res.json([]);
  }

  try {
    const snap = await db.collection(COLLECTIONS.NOTIFICATIONS)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    const notifications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const userIds = [...new Set(notifications.map((n) => n.userId).filter(Boolean))];
    const bookingIds = [...new Set(notifications.map((n) => n.bookingId).filter(Boolean))];
    const userById = {};
    const bookingById = {};
    await Promise.all(userIds.map(async (uid) => {
      const doc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
      if (doc.exists) {
        userById[uid] = doc.data();
        return;
      }
      try {
        const authUser = await admin.auth().getUser(uid);
        userById[uid] = {
          name: authUser.displayName || '',
          phone: authUser.phoneNumber || '',
        };
      } catch {
        userById[uid] = {};
      }
    }));
    await Promise.all(bookingIds.map(async (bookingId) => {
      const doc = await db.collection(COLLECTIONS.BOOKINGS).doc(bookingId).get();
      if (doc.exists) bookingById[bookingId] = doc.data();
    }));

    const result = notifications.map((n) => ({
      ...n,
      customerName:  bookingById[n.bookingId]?.customerName || userById[n.userId]?.name || '',
      customerPhone: bookingById[n.bookingId]?.customerPhone || userById[n.userId]?.phone || '',
      queueNumber:   bookingById[n.bookingId]?.queueNumber || '',
      bookingStatus: bookingById[n.bookingId]?.status || '',
      customerConfirmedAt: bookingById[n.bookingId]?.customerConfirmedAt || null,
    }));
    setCachedValue(cacheKey, result, 120_000);
    res.json(result);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markQuotaExceeded(err);
      console.warn('Firestore quota exceeded while fetching admin notifications; returning empty list.');
      return res.json([]);
    }
    res.status(500).json({ error: err.message });
  }
});

// ── Helper (ใช้จากไฟล์อื่น เช่น queue.js ตอนเรียกคิว) ────────────
// สร้าง notification ให้ผู้ใช้คนหนึ่ง ไม่ผ่าน HTTP — เรียกตรงจาก route อื่น
async function createNotification({ userId, bookingId, message, type = 'general' }) {
  await db.collection(COLLECTIONS.NOTIFICATIONS).add({
    userId,
    bookingId,
    message,
    type,
    confirmed: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  deleteCachedValue(`notifications:${userId}`);
  deleteCachedValue('notifications:admin');
}

async function notifyBookingCancelled(bookingId, booking) {
  const message = `ผู้ดูแลยกเลิกคิว ${booking.queueNumber || ''} วันที่ ${booking.bookingDate || ''} เวลา ${booking.timeSlot || ''} น.`;
  const deliveries = await Promise.allSettled([
    createNotification({
      userId: booking.userId,
      bookingId,
      message,
      type: 'booking_cancelled',
    }),
    sendPushToUser(booking.userId, 'คิวของคุณถูกยกเลิก', message, {
      bookingId,
      queueNumber: String(booking.queueNumber || ''),
      type: 'booking_cancelled',
    }),
  ]);

  if (deliveries[0].status === 'rejected') {
    console.error('สร้างการแจ้งเตือนยกเลิกคิวไม่สำเร็จ:', deliveries[0].reason);
  }
  if (deliveries[1].status === 'rejected') {
    console.error('ส่ง push แจ้งยกเลิกคิวไม่สำเร็จ:', deliveries[1].reason);
  }
  return { inAppSent: deliveries[0].status === 'fulfilled' };
}

module.exports = router;
module.exports.createNotification = createNotification;
module.exports.notifyBookingCancelled = notifyBookingCancelled;
