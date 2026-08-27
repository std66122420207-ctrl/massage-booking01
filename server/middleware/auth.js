const { admin } = require('../config/firebase');

// ── Verify Firebase ID Token (จาก Flutter app) ─────────────
async function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'ไม่พบ token กรุณาล็อกอินก่อน' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;   // { uid, email, name, ... }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ' });
  }
}

// ── Admin-only middleware ───────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.user?.admin) {
    return res.status(403).json({ error: 'สิทธิ์ไม่เพียงพอ' });
  }
  next();
}

module.exports = { verifyToken, requireAdmin };
