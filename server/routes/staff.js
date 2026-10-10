const express = require('express');
const crypto = require('crypto');
const router  = express.Router();
const { db, COLLECTIONS, admin } = require('../config/firebase');
const { getStorage } = require('firebase-admin/storage');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const parseImageBody = express.raw({
  type: Object.keys(IMAGE_TYPES),
  limit: '5mb',
});

function readImageBody(req, res, next) {
  parseImageBody(req, res, (err) => {
    if (!err) return next();
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'รูปภาพต้องมีขนาดไม่เกิน 5 MB' });
    }
    return res.status(400).json({ error: 'อ่านไฟล์รูปภาพไม่สำเร็จ' });
  });
}

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

// POST /api/staff/photo — Admin: upload therapist photo through Firebase Admin SDK
router.post('/photo', verifyToken, requireAdmin, readImageBody, async (req, res) => {
  const contentType = req.headers['content-type'];
  const extension = IMAGE_TYPES[contentType];
  if (!extension) {
    return res.status(415).json({ error: 'รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP' });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'ไม่พบข้อมูลรูปภาพ' });
  }

  try {
    const bucket = getStorage().bucket();
    const objectPath = `staff-photos/${crypto.randomUUID()}.${extension}`;
    const downloadToken = crypto.randomUUID();
    const file = bucket.file(objectPath);

    await file.save(req.body, {
      resumable: false,
      metadata: {
        contentType,
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`;
    res.status(201).json({ url });
  } catch (err) {
    console.error('Staff photo upload failed:', err);
    res.status(503).json({
      error: 'อัปโหลดรูปไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า Firebase Storage และสิทธิ์ของ Server',
    });
  }
});

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
