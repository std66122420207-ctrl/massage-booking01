const express = require('express');
const router  = express.Router();
const { db, COLLECTIONS, admin } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/staff — รายชื่อหมอนวดทั้งหมด
router.get('/', async (req, res) => {
  try {
    const snap  = await db.collection(COLLECTIONS.STAFF).where('active', '==', true).get();
    const staff = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/staff/:id/status — Admin: อัปเดตสถานะหมอนวด
router.patch('/:id/status', verifyToken, requireAdmin, async (req, res) => {
  const { status } = req.body; // available | busy | break | off
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

// POST /api/staff — Admin: เพิ่มหมอนวดใหม่
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { name, email, experience, photo } = req.body;
  if (!name) return res.status(400).json({ error: 'กรุณาระบุชื่อ' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' });
  }
  try {
    const doc = await db.collection(COLLECTIONS.STAFF).add({
      name,
      email: email || null,
      experience: experience || '',
      photo: photo || null, // URL รูปภาพ (เช่น อัปโหลดไป Firebase Storage แล้วใส่ URL ที่นี่)
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

// PATCH /api/staff/:id — Admin: แก้ไขข้อมูลหมอนวด (ชื่อ, อีเมล, รูป, ประสบการณ์, สถานะใช้งาน)
router.patch('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { name, email, experience, active, photo } = req.body;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' });
  }
  try {
    const updates = {};
    if (name !== undefined)       updates.name = name;
    if (email !== undefined)      updates.email = email;
    if (experience !== undefined) updates.experience = experience;
    if (active !== undefined)     updates.active = active;
    if (photo !== undefined)      updates.photo = photo;
    await db.collection(COLLECTIONS.STAFF).doc(req.params.id).update(updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
