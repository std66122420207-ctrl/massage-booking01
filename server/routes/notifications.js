const express = require('express');
const router  = express.Router();
const { db, COLLECTIONS, admin } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { sendPushToUser } = require('./fcm');
const { sendSms } = require('../services/sms');

// ── GET /api/notifications — แจ้งเตือนของผู้ใช้ที่ login อยู่ ──────
router.get('/', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection(COLLECTIONS.NOTIFICATIONS)
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/notifications/:id/confirm — ผู้ใช้กดยืนยันว่าเห็นการแจ้งเตือนแล้ว
// ส่งผลกลับไปให้แอดมินเห็นสถานะนี้ผ่าน GET /api/notifications/admin/all
router.post('/:id/confirm', verifyToken, async (req, res) => {
  try {
    const ref = db.collection(COLLECTIONS.NOTIFICATIONS).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'ไม่พบการแจ้งเตือนนี้' });
    if (doc.data().userId !== req.user.uid) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงการแจ้งเตือนนี้' });
    }
    await ref.update({
      confirmed:   true,
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
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
    await createNotification({ userId: notification.userId, bookingId: notification.bookingId, message });
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
    const notificationDoc = await notificationRef.get();
    if (!notificationDoc.exists) return res.status(404).json({ error: 'ไม่พบการแจ้งเตือนนี้' });
    const notification = notificationDoc.data();
    await notificationRef.update({
      confirmed: true,
      confirmedByAdmin: true,
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (notification.bookingId) {
      await db.collection(COLLECTIONS.BOOKINGS).doc(notification.bookingId).update({
        status: 'confirmed',
        confirmedByAdmin: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    res.json({ success: true, message: 'ยืนยันคิวแล้ว' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/notifications/:id/admin-cancel — Admin: ยกเลิกคิวแทนลูกค้า
router.post('/:id/admin-cancel', verifyToken, requireAdmin, async (req, res) => {
  try {
    const notificationRef = db.collection(COLLECTIONS.NOTIFICATIONS).doc(req.params.id);
    const notificationDoc = await notificationRef.get();
    if (!notificationDoc.exists) return res.status(404).json({ error: 'ไม่พบการแจ้งเตือนนี้' });
    const notification = notificationDoc.data();
    await notificationRef.update({
      confirmed: true,
      resolvedByAdmin: true,
      resolvedAction: 'cancelled',
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (notification.bookingId) {
      await db.collection(COLLECTIONS.BOOKINGS).doc(notification.bookingId).update({
        status: 'cancelled',
        cancelledByAdmin: true,
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    res.json({ success: true, message: 'ยกเลิกคิวแล้ว' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/notifications/admin/all — แอดมิน: ดูว่าใครยังไม่กดยืนยัน ──
// ใช้เบอร์โทรลูกค้าโทรติดต่อเองกรณีแอปแจ้งเตือนไม่ถึง (ตามที่ระบุในสเปค)
router.get('/admin/all', verifyToken, requireAdmin, async (req, res) => {
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

    res.json(notifications.map((n) => ({
      ...n,
      customerName:  bookingById[n.bookingId]?.customerName || userById[n.userId]?.name || '',
      customerPhone: bookingById[n.bookingId]?.customerPhone || userById[n.userId]?.phone || '',
      queueNumber:   bookingById[n.bookingId]?.queueNumber || '',
      bookingStatus: bookingById[n.bookingId]?.status || '',
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helper (ใช้จากไฟล์อื่น เช่น queue.js ตอนเรียกคิว) ────────────
// สร้าง notification ให้ผู้ใช้คนหนึ่ง ไม่ผ่าน HTTP — เรียกตรงจาก route อื่น
async function createNotification({ userId, bookingId, message }) {
  await db.collection(COLLECTIONS.NOTIFICATIONS).add({
    userId,
    bookingId,
    message,
    confirmed: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

module.exports = router;
module.exports.createNotification = createNotification;
