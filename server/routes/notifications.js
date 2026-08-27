const express = require('express');
const router  = express.Router();
const { db, COLLECTIONS, admin } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

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
    const userById = {};
    await Promise.all(userIds.map(async (uid) => {
      const doc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
      if (doc.exists) userById[uid] = doc.data();
    }));

    res.json(notifications.map((n) => ({
      ...n,
      customerName:  userById[n.userId]?.name || '',
      customerPhone: userById[n.userId]?.phone || '',
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
