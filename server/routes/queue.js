const express = require('express');
const router  = express.Router();
const { db, COLLECTIONS, admin } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const { sendPushToUser } = require('./fcm');
const { getBangkokDate } = require('../services/bookingPolicy');
const { isQuotaExceededError, markQuotaExceeded, isQuotaPaused, getCachedValue, setCachedValue } = require('../services/firestoreGuard');

// ── GET /api/queue/status — สถานะคิวปัจจุบัน (Public) ───────
router.get('/status', async (req, res) => {
  const today = getBangkokDate();
  const cacheKey = `queue-status:${today}`;
  const cached = getCachedValue(cacheKey, 30_000);
  if (cached !== undefined) {
    return res.json(cached);
  }

  if (isQuotaPaused()) {
    const safeResponse = { currentQueue: null, waitingCount: 0, doneCount: 0, freeTierSafeMode: true };
    setCachedValue(cacheKey, safeResponse, 30_000);
    return res.json(safeResponse);
  }

  try {
    const ref = db.collection('queue_status').doc(today);
    const doc = await ref.get();

    if (!doc.exists) {
      const response = { currentQueue: null, waitingCount: 0, doneCount: 0 };
      setCachedValue(cacheKey, response, 30_000);
      return res.json(response);
    }

    const response = doc.data();
    setCachedValue(cacheKey, response, 30_000);
    res.json(response);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markQuotaExceeded(err);
      const response = { currentQueue: null, waitingCount: 0, doneCount: 0, freeTierSafeMode: true };
      setCachedValue(cacheKey, response, 30_000);
      return res.json(response);
    }
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/queue/my — ตำแหน่งคิวของผู้ใช้ ───────────────
router.get('/my', verifyToken, async (req, res) => {
  const today = getBangkokDate();
  const cacheKey = `queue-my:${req.user.uid}:${today}`;
  const cached = getCachedValue(cacheKey, 60_000);
  if (cached !== undefined) {
    return res.json(cached);
  }

  if (isQuotaPaused()) {
    const safeResponse = { hasQueue: false, freeTierSafeMode: true, queuesBefore: 0, estimatedWait: 0 };
    setCachedValue(cacheKey, safeResponse, 60_000);
    return res.json(safeResponse);
  }

  try {
    const mySnap = await db.collection(COLLECTIONS.BOOKINGS)
      .where('userId', '==', req.user.uid)
      .where('bookingDate', '==', today)
      .where('status', 'in', ['pending', 'confirmed', 'auto_called', 'in_service'])
      .limit(20)
      .get();

    if (mySnap.empty) {
      const response = { hasQueue: false };
      setCachedValue(cacheKey, response, 60_000);
      return res.json(response);
    }

    const myBooking = { id: mySnap.docs[0].id, ...mySnap.docs[0].data() };
    const response = {
      hasQueue: true,
      booking: myBooking,
      queuesBefore: 0,
      estimatedWait: 0,
      freeTierSafeMode: true,
    };
    setCachedValue(cacheKey, response, 60_000);
    res.json(response);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markQuotaExceeded(err);
      const response = { hasQueue: false, freeTierSafeMode: true, queuesBefore: 0, estimatedWait: 0 };
      setCachedValue(cacheKey, response, 60_000);
      return res.json(response);
    }
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/queue/call-next — Admin: เรียกคิวถัดไป ────────
router.post('/call-next', verifyToken, requireAdmin, async (req, res) => {
  try {
    const today = getBangkokDate();

    // หาคิวถัดไป (pending/confirmed เรียงตามเวลา)
    const snap = await db.collection(COLLECTIONS.BOOKINGS)
      .where('bookingDate', '==', today)
      .get();

      const next = snap.docs
        .filter(doc => ['pending', 'confirmed', 'auto_called'].includes(doc.data().status))
      .sort((a, b) => String(a.data().timeSlot || '').localeCompare(String(b.data().timeSlot || '')))
      .at(0);

    if (!next) {
      return res.json({ message: 'ไม่มีคิวที่รออยู่แล้ว' });
    }

    /*
     * เลือกคิวจากผลลัพธ์ที่กรองแล้ว เพื่อให้ endpoint ใช้งานได้แม้ยังไม่ได้ deploy
     * composite index ของ Firestore
     */
    const data   = next.data();
    const batch  = db.batch();

    // อัปเดตสถานะเป็น in_service
    batch.update(next.ref, {
      status:        'in_service',
      calledAt:      admin.firestore.FieldValue.serverTimestamp(),
      serviceStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // อัปเดต queue_status document
    batch.set(db.collection('queue_status').doc(today), {
      currentQueue:  data.queueNumber,
      currentBookId: next.id,
      currentStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await batch.commit();

    // สร้างการแจ้งเตือนให้ผู้ใช้ (ให้กดยืนยันว่าเห็นแล้วในแอป — ถ้าไม่กด
    // แอดมินจะเห็นสถานะ "ยังไม่ยืนยัน" พร้อมเบอร์โทร ไว้โทรติดต่อเองได้)
    // ทำแบบ non-blocking: ถ้าสร้าง notification ไม่สำเร็จ ไม่ควรทำให้การเรียกคิวล้มเหลว
    createNotification({
      userId:    data.userId,
      bookingId: next.id,
      message:   `ถึงคิวของคุณแล้ว! เลขคิว ${data.queueNumber} กรุณามาที่เคาน์เตอร์`,
    }).catch((err) => console.error('สร้าง notification ไม่สำเร็จ:', err));

    // ส่ง push notification ผ่าน FCM (non-blocking)
    sendPushToUser(
      data.userId,
      'ถึงคิวของคุณแล้ว!',
      `เลขคิว ${data.queueNumber} กรุณามาที่เคาน์เตอร์`,
      { bookingId: next.id, queueNumber: String(data.queueNumber) }
    ).catch((err) => console.error('ส่ง push notification ไม่สำเร็จ:', err));

    res.json({
      success:  true,
      called:   data.queueNumber,
      booking:  { id: next.id, ...data },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/queue/call — Admin: เรียกคิวที่เลือก ─────────
router.post('/call', verifyToken, requireAdmin, async (req, res) => {
  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'กรุณาระบุ bookingId' });

  try {
    const today = getBangkokDate();
    const ref = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'ไม่พบการจอง' });
    const data = doc.data();
    if (data.bookingDate !== today) return res.status(400).json({ error: 'เรียกได้เฉพาะคิวของวันนี้' });
    if (!['pending', 'confirmed', 'auto_called'].includes(data.status)) {
      return res.status(409).json({ error: 'คิวนี้ไม่อยู่ในสถานะรอเรียก' });
    }

    await ref.update({
      status: 'in_service',
      calledAt: admin.firestore.FieldValue.serverTimestamp(),
      serviceStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection('queue_status').doc(today).set({
      currentQueue: data.queueNumber,
      currentBookId: bookingId,
      currentStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    createNotification({
      userId: data.userId,
      bookingId,
      message: `ถึงคิวของคุณแล้ว! เลขคิว ${data.queueNumber} กรุณามาที่เคาน์เตอร์`,
    }).catch((err) => console.error('สร้าง notification ไม่สำเร็จ:', err));

    // ส่ง push notification ผ่าน FCM (non-blocking)
    sendPushToUser(
      data.userId,
      'ถึงคิวของคุณแล้ว!',
      `เลขคิว ${data.queueNumber} กรุณามาที่เคาน์เตอร์`,
      { bookingId, queueNumber: String(data.queueNumber) }
    ).catch((err) => console.error('ส่ง push notification ไม่สำเร็จ:', err));

    res.json({ success: true, called: data.queueNumber, booking: { id: bookingId, ...data, status: 'in_service' } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/queue/complete — Admin: นวดเสร็จสิ้น ──────────
router.post('/complete', verifyToken, requireAdmin, async (req, res) => {
  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'กรุณาระบุ bookingId' });

  try {
    const today = getBangkokDate();
    const ref = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);
    const result = await db.runTransaction(async (transaction) => {
      const bookingDoc = await transaction.get(ref);
      if (!bookingDoc.exists) return { status: 404, error: 'ไม่พบการจอง' };
      if (bookingDoc.data().status !== 'in_service') {
        return { status: 409, error: 'คิวนี้ไม่ได้อยู่ระหว่างให้บริการ' };
      }

      const queueRef = db.collection('queue_status').doc(today);
      const queueDoc = await transaction.get(queueRef);
      transaction.update(ref, {
        status: 'done',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const queueUpdate = {
        doneCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (queueDoc.exists && queueDoc.data().currentBookId === bookingId) {
        queueUpdate.currentQueue = null;
        queueUpdate.currentBookId = null;
        queueUpdate.currentStartedAt = null;
      }
      transaction.set(queueRef, queueUpdate, { merge: true });
      return { status: 200 };
    });
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });
    res.json({ success: true, message: 'บันทึกเสร็จสิ้นแล้ว' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
