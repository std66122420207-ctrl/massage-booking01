const express = require('express');
const router = express.Router();
const { db, COLLECTIONS } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');
const { isValidThaiMobilePhone, normalizeThaiMobilePhone } = require('../utils/thaiMobilePhone');
const { RegistrationConflictError, saveUserWithUniquePhone } = require('../services/phoneRegistry');

// Flutter uses Firebase Phone Auth; this endpoint stores the verified profile.
router.post('/register', verifyToken, async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !isValidThaiMobilePhone(phone)) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อและเบอร์มือถือ 10 หลัก โดยขึ้นต้นด้วย 06, 08 หรือ 09' });
  }

  try {
    const normalizedPhone = normalizeThaiMobilePhone(phone);
    await saveUserWithUniquePhone(req.user.uid, normalizedPhone, {
      ...(typeof name === 'string' ? { name: name.trim() } : {}),
      ...(typeof req.body.citizenId === 'string'
        ? { citizenId: req.body.citizenId.trim() }
        : {}),
      ...(typeof req.user.email === 'string' ? { email: req.user.email } : {}),
      loginMethod: req.user.firebase?.sign_in_provider === 'password' ? 'email' : 'phone',
      role: 'user',
    });

    res.json({ success: true, message: 'ลงทะเบียนสำเร็จ' });
  } catch (err) {
    if (err instanceof RegistrationConflictError) {
      return res.status(409).json({ error: err.message });
    }
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
  if (!isValidThaiMobilePhone(phone)) {
    return res.status(400).json({ error: 'กรุณากรอกเบอร์มือถือ 10 หลัก โดยขึ้นต้นด้วย 06, 08 หรือ 09' });
  }
  try {
    await saveUserWithUniquePhone(req.user.uid, normalizeThaiMobilePhone(phone), {});
    res.json({ success: true });
  } catch (err) {
    if (err instanceof RegistrationConflictError) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
