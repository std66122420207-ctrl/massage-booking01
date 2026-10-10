const express = require('express');
const router = express.Router();
const { db, COLLECTIONS, admin } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');

// Flutter uses Firebase Phone Auth; this endpoint stores the verified profile.
router.post('/register', verifyToken, async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone || !/^0\d{8,9}$/.test(String(phone).replace(/[\s-]/g, ''))) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อและเบอร์โทรศัพท์ให้ถูกต้อง' });
  }

  try {
    const normalizedPhone = String(phone).replace(/[\s-]/g, '');
    await db.collection(COLLECTIONS.USERS).doc(req.user.uid).set({
      uid: req.user.uid,
      name,
      phone: normalizedPhone,
      loginMethod: 'phone',
      role: 'user',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true, message: 'ลงทะเบียนสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection(COLLECTIONS.USERS).doc(req.user.uid).get();
    if (!doc.exists) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    const data = doc.data();
    res.json({ ...data, needsPhone: !data.phone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/me', verifyToken, async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^0\d{8,9}$/.test(String(phone).replace(/[\s-]/g, ''))) {
    return res.status(400).json({ error: 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (เช่น 0812345678)' });
  }
  try {
    await db.collection(COLLECTIONS.USERS).doc(req.user.uid).set({
      phone: String(phone).replace(/[\s-]/g, ''),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
