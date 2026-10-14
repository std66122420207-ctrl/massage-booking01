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
    const doc = await db.collection(COLLECTIONS.STAFF).add({
      name,
      phone: phone?.trim() || null,
      experience: experience || '',
      photo: photo || null,
      status: 'available',
      active: true,
      todayCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ success: true, id: doc.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/staff/:id — Admin: แก้ไขข้อมูลหมอนวด
router.patch('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { name, phone, experience, active, photo } = req.body;
  if (Object.hasOwn(req.body, 'email')) {
    return res.status(400).json({ error: 'เลิกใช้ช่องอีเมลหมอนวดแล้ว กรุณาระบุเบอร์ติดต่อแทน' });
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
    await db.collection(COLLECTIONS.STAFF).doc(req.params.id).update(updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
