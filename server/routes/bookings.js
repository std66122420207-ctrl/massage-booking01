const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db, COLLECTIONS, admin } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// ── GET /api/bookings — รายการจองของผู้ใช้ ─────────────────
router.get('/', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection(COLLECTIONS.BOOKINGS)
      .where('userId', '==', req.user.uid)
      .orderBy('bookingDate', 'desc')
      .limit(20)
      .get();

    const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/bookings — สร้างการจองใหม่ ───────────────────
router.post('/', verifyToken, async (req, res) => {
  const { serviceId, staffId, bookingDate, timeSlot, customerName, customerPhone } = req.body;

  if (!serviceId || !bookingDate || !timeSlot) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  }

  // ใช้ค่าจองล่วงหน้าจากการตั้งค่าของแอดมิน (ค่าเริ่มต้น 3 วัน)
  const today    = new Date(); today.setHours(0,0,0,0);
  const bookDate = new Date(bookingDate);
  const diffDays = Math.floor((bookDate - today) / 86400000);
  try {
    const settingsDoc = await db.collection('settings').doc('general').get();
    const maxAdvanceDays = Number(settingsDoc.data()?.advance) || 3;
    if (diffDays < 0 || diffDays > maxAdvanceDays) {
      return res.status(400).json({ error: `จองล่วงหน้าได้ไม่เกิน ${maxAdvanceDays} วัน` });
    }

    // ดึงข้อมูลบริการ
    const serviceDoc = await db.collection(COLLECTIONS.SERVICES).doc(serviceId).get();
    if (!serviceDoc.exists) {
      return res.status(404).json({ error: 'ไม่พบบริการที่เลือก' });
    }
    const service = serviceDoc.data();

    const bookingId = uuidv4();

    // ใช้ transaction ครอบทั้งการเช็คซ้ำ + ออกเลขคิว + บันทึกการจอง
    // เพื่อป้องกัน race condition กรณีมีคนจองเวลาเดียวกันพร้อมกัน
    // (เดิม: เช็คซ้ำอยู่นอก try/catch ทำให้ error จาก Firestore
    //  ไม่ถูกจับ และอาจทำให้ server ค้าง/ล่มได้)
    const booking = await db.runTransaction(async (t) => {
      const dupSnap = await t.get(
        db.collection(COLLECTIONS.BOOKINGS)
          .where('bookingDate', '==', bookingDate)
          .where('timeSlot', '==', timeSlot)
          .where('staffId', '==', staffId || '')
          .where('status', 'in', ['pending', 'confirmed'])
      );
      if (!dupSnap.empty) {
        throw Object.assign(new Error('เวลานี้ถูกจองแล้ว กรุณาเลือกเวลาอื่น'), { code: 409 });
      }

      const counterRef = db.collection('counters').doc(bookingDate);
      const counterDoc = await t.get(counterRef);
      const n = (counterDoc.exists ? counterDoc.data().count : 0) + 1;
      const queueNumber = `A${String(n).padStart(3, '0')}`;
      t.set(counterRef, { count: n });

      const newBooking = {
        id:           bookingId,
        userId:       req.user.uid,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        serviceId,
        serviceName:  service.name || '',
        servicePrice: service.price || 0,
        staffId:      staffId || null,
        bookingDate,
        timeSlot,
        queueNumber,
        status:       'pending',   // pending | confirmed | in_service | done | cancelled
        createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      };
      t.set(db.collection(COLLECTIONS.BOOKINGS).doc(bookingId), newBooking);
      return newBooking;
    });

    res.status(201).json({ success: true, booking });
  } catch (err) {
    res.status(err.code === 409 ? 409 : 500).json({ error: err.message });
  }
});

// ── DELETE /api/bookings/:id — ยกเลิกการจอง ────────────────
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const ref = db.collection(COLLECTIONS.BOOKINGS).doc(req.params.id);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ error: 'ไม่พบการจอง' });
    if (doc.data().userId !== req.user.uid && !req.user.admin) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ยกเลิกการจองนี้' });
    }

    await ref.update({ status: 'cancelled', cancelledAt: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ success: true, message: 'ยกเลิกการจองสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/bookings/:id — Admin: อัปเดตสถานะ ───────────
router.patch('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { status, staffId, room } = req.body;
  const allowed = ['pending', 'confirmed', 'in_service', 'done', 'cancelled'];

  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
  }

  try {
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (status)  updates.status  = status;
    if (staffId) updates.staffId = staffId;
    if (room)    updates.room    = room;

    await db.collection(COLLECTIONS.BOOKINGS).doc(req.params.id).update(updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/bookings/admin/today — Admin: รายการวันนี้ ─────
router.get('/admin/today', verifyToken, requireAdmin, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const snap = await db.collection(COLLECTIONS.BOOKINGS)
      .where('bookingDate', '==', today)
      .get();

    const bookings = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(a.timeSlot || '').localeCompare(String(b.timeSlot || '')));
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
