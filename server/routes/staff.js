const express = require('express');
const router  = express.Router();
const { db, COLLECTIONS, admin } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/staff — รายชื่อหมอนวดทั้งหมด
router.get('/', async (req, res) => {
  try {
    const snap  = await db.collection(COLLECTIONS.STAFF).where('active', '==', true).get();
    const staff = snap.docs.map((d) => {
      const data = { ...d.data() };
      delete data.email;
      delete data.phone;
      return { id: d.id, ...data };
    });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/staff/admin — Admin: รายชื่อหมอนวดพร้อมเบอร์ติดต่อ
router.get('/admin', verifyToken, requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection(COLLECTIONS.STAFF).where('active', '==', true).get();
    const staff = snap.docs.map((d) => {
      const data = { ...d.data() };
      delete data.email;
      return { id: d.id, ...data };
    });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function isValidPhone(phone) {
  if (typeof phone !== 'string') return false;
  const normalized = phone.trim().replace(/[\s()-]/g, '');
  return /^\+?\d{8,15}$/.test(normalized);
}

// PATCH /api/staff/:id/status — Admin: อัปเดตสถานะหมอนวด
router.patch('/:id/status', verifyToken, requireAdmin, async (req, res) => {
  const { status } = req.body; // available | busy | break | off
  if (!['available', 'busy', 'break', 'off'].includes(status)) {
    return res.status(400).json({ error: 'สถานะหมอนวดไม่ถูกต้อง' });
  }
  try {
    await db.collection(COLLECTIONS.STAFF).doc(req.params.id).update({
      status,
      statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/staff/:id — Admin: ปิดการใช้งานหมอนวด (เก็บประวัติเดิมไว้)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    await db.collection(COLLECTIONS.STAFF).doc(req.params.id).update({
      active: false,
      status: 'off',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/staff — Admin: เพิ่มหมอนวดใหม่
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { name, phone, experience, photo } = req.body;
  if (!name) return res.status(400).json({ error: 'กรุณาระบุชื่อ' });
  if (Object.hasOwn(req.body, 'email')) {
    return res.status(400).json({ error: 'เลิกใช้ช่องอีเมลหมอนวดแล้ว กรุณาระบุเบอร์ติดต่อแทน' });
  }
  if (phone !== undefined && phone !== null && phone !== '' && !isValidPhone(phone)) {
    return res.status(400).json({ error: 'รูปแบบเบอร์ติดต่อไม่ถูกต้อง' });
  }
  try {
    const staffRef = db.collection(COLLECTIONS.STAFF).doc();
    const orderCounterRef = db.collection('counters').doc('staff-queue-order');
    const queueOrder = await db.runTransaction(async (transaction) => {
      const [staffSnap, counterDoc] = await Promise.all([
        transaction.get(db.collection(COLLECTIONS.STAFF)),
        transaction.get(orderCounterRef),
      ]);
      const currentMax = staffSnap.docs.reduce(
        (max, doc) => Math.max(max, Number(doc.data().queueOrder) || 0),
        0
      );
      const counter = counterDoc.exists ? Number(counterDoc.data().count) || 0 : 0;
      const nextOrder = Math.max(currentMax, counter) + 1;
      if (nextOrder > 9) {
        throw Object.assign(
          new Error('รองรับรหัสหมอนวดได้สูงสุด 9 คน ต้องปรับรูปแบบเลขคิวก่อนเพิ่มหมอนวด'),
          { code: 409 }
        );
      }
      transaction.set(orderCounterRef, { count: nextOrder });
      transaction.set(staffRef, {
        name,
        phone: phone?.trim() || null,
        experience: experience || '',
        photo: photo || null,
        queueOrder: nextOrder,
        status: 'available',
        active: true,
        todayCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return nextOrder;
    });
    res.status(201).json({ success: true, id: staffRef.id, queueOrder });
  } catch (err) {
    res.status(err.code === 409 ? 409 : 500).json({ error: err.message });
  }
});

/*
 * Legacy staff documents must be assigned queueOrder explicitly with
 * scripts/migrateStaffQueueOrder.js before they can receive coded queues.
 */
router.patch('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { name, phone, experience, active, photo } = req.body;
  const hasQueueOrder = Object.hasOwn(req.body, 'queueOrder');
  const requestedQueueOrder = Number(req.body.queueOrder);
  if (Object.hasOwn(req.body, 'email')) {
    return res.status(400).json({ error: 'เลิกใช้ช่องอีเมลหมอนวดแล้ว กรุณาระบุเบอร์ติดต่อแทน' });
  }
  if (
    hasQueueOrder
    && (req.body.queueOrder === '' || !Number.isInteger(requestedQueueOrder)
      || requestedQueueOrder < 1 || requestedQueueOrder > 9)
  ) {
    return res.status(400).json({ error: 'เลขหมอต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 9' });
  }
  if (phone !== undefined && phone !== null && phone !== '' && !isValidPhone(phone)) {
    return res.status(400).json({ error: 'รูปแบบเบอร์ติดต่อไม่ถูกต้อง' });
  }
  try {
    const updates = {};
    if (name !== undefined)       updates.name = name;
    if (phone !== undefined)      updates.phone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;
    if (experience !== undefined) updates.experience = experience;
    if (active !== undefined)     updates.active = active;
    if (photo !== undefined)      updates.photo = photo;
    updates.email = admin.firestore.FieldValue.delete();
    const staffRef = db.collection(COLLECTIONS.STAFF).doc(req.params.id);
    if (hasQueueOrder) {
      const orderCounterRef = db.collection('counters').doc('staff-queue-order');
      await db.runTransaction(async (transaction) => {
        const [staffDoc, staffSnapshot, counterDoc] = await Promise.all([
          transaction.get(staffRef),
          transaction.get(db.collection(COLLECTIONS.STAFF)),
          transaction.get(orderCounterRef),
        ]);
        if (!staffDoc.exists) {
          throw Object.assign(new Error('ไม่พบหมอนวดที่ต้องการแก้ไข'), { code: 404 });
        }
        const currentOrder = staffDoc.data().queueOrder;
        if (currentOrder != null && Number(currentOrder) !== requestedQueueOrder) {
          throw Object.assign(new Error('เลขหมอที่กำหนดแล้วไม่สามารถเปลี่ยนได้'), { code: 409 });
        }
        const duplicate = staffSnapshot.docs.some(
          (doc) => doc.id !== staffRef.id && Number(doc.data().queueOrder) === requestedQueueOrder
        );
        if (duplicate) {
          throw Object.assign(new Error('เลขหมอนี้ถูกใช้งานแล้ว กรุณาเลือกเลขอื่น'), { code: 409 });
        }
        const maxOrder = staffSnapshot.docs.reduce(
          (max, doc) => Math.max(max, Number(doc.data().queueOrder) || 0),
          requestedQueueOrder
        );
        const counter = counterDoc.exists ? Number(counterDoc.data().count) || 0 : 0;
        transaction.update(staffRef, { ...updates, queueOrder: requestedQueueOrder });
        transaction.set(orderCounterRef, { count: Math.max(counter, maxOrder) });
      });
    } else {
      await staffRef.update(updates);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(err.code === 404 || err.code === 409 ? err.code : 500).json({ error: err.message });
  }
});

module.exports = router;
