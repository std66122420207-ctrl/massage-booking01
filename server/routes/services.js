// routes/services.js
const express = require('express');
const router  = express.Router();
const { db, COLLECTIONS, admin } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const AVAILABLE_SERVICE_NAMES = [
  'ประคบหินร้อน',
  'นวดเท้า',
  'นวดตัว',
  'กัวชา',
];

const NORMALIZED_SERVICE_NAME = {
  กัวซา: 'กัวชา',
};

function normalizeServiceName(name) {
  if (typeof name !== 'string') return '';
  const trimmed = name.trim();
  return NORMALIZED_SERVICE_NAME[trimmed] || trimmed;
}

// GET /api/services — รายการบริการทั้งหมด
router.get('/', async (req, res) => {
  try {
    const snap = await db.collection(COLLECTIONS.SERVICES).orderBy('order').get();
    const filtered = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .map((service) => ({
        ...service,
        name: normalizeServiceName(service.name),
        order: Number(service.order) || 99,
      }))
      .filter((service) => service.active !== false)
      .filter((service) => AVAILABLE_SERVICE_NAMES.includes(service.name))
      .sort((a, b) => {
        const orderDiff = (a.order || 99) - (b.order || 99);
        if (orderDiff !== 0) return orderDiff;
        return AVAILABLE_SERVICE_NAMES.indexOf(a.name) - AVAILABLE_SERVICE_NAMES.indexOf(b.name);
      });

    const seenNames = new Set();
    const services = filtered.filter((service) => {
      if (seenNames.has(service.name)) return false;
      seenNames.add(service.name);
      return true;
    });

    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/services — Admin: เพิ่มบริการ
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { name, duration, price, description, order } = req.body;
  try {
    const ref = await db.collection(COLLECTIONS.SERVICES).add({
      name, duration, price, description,
      order: order || 99,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ id: ref.id, name, duration, price });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/services/:id — Admin: แก้ไขบริการ
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    await db.collection(COLLECTIONS.SERVICES).doc(req.params.id).update({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
