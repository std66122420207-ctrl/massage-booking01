const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const { db, COLLECTIONS, admin } = require('../config/firebase');
const { createRemoteJWKSet, jwtVerify } = require('jose');

// mock mode เปิดได้เฉพาะตอน NODE_ENV ไม่ใช่ production เท่านั้น (กันพลาดเปิดใน production
// จริงโดยไม่ตั้งใจ ต่อให้ตั้ง MOCK_THAID=true ทิ้งไว้ใน .env ก็ตาม)
const MOCK_THAID = process.env.NODE_ENV !== 'production' && process.env.MOCK_THAID === 'true';

// ── ThaiD OAuth Login ──────────────────────────────────────
// เก็บ state ชั่วคราวในหน่วยความจำเพื่อป้องกัน CSRF พร้อม PKCE code_verifier
// (ถ้ามีหลาย instance ของ server ควรย้ายไปเก็บใน Redis/Firestore แทน)
const pendingStates = new Map(); // state -> { expiresAt, codeVerifier }
const STATE_TTL_MS = 5 * 60 * 1000; // 5 นาที

function cleanupExpiredStates() {
  const now = Date.now();
  for (const [state, entry] of pendingStates) {
    if (entry.expiresAt < now) pendingStates.delete(state);
  }
}

// ── OIDC Discovery (well-known configuration) ───────────────
// ใช้วิธีเดียวกับตัวอย่างทางการของ ETDA (ThaiD-Python-RP: server_metadata_url)
// แทนการเดา path ของ authorize/token/userinfo endpoint เอง — โหลดครั้งเดียวแล้ว cache ไว้
// อ้างอิง: https://github.com/ETDA/ThaiD-Python-RP
let discoveryCache = null;
let discoveryCachedAt = 0;
const DISCOVERY_TTL_MS = 60 * 60 * 1000; // cache 1 ชั่วโมง

async function getThaidDiscovery() {
  if (discoveryCache && Date.now() - discoveryCachedAt < DISCOVERY_TTL_MS) return discoveryCache;
  const wellKnownUrl = process.env.THAID_WELL_KNOWN_URL ||
    `${process.env.THAID_API_BASE}/.well-known/openid-configuration`;
  const res = await fetch(wellKnownUrl);
  if (!res.ok) throw new Error('โหลดค่าตั้งต้น (discovery) จาก ThaiD ไม่สำเร็จ');
  discoveryCache = await res.json();
  discoveryCachedAt = Date.now();
  return discoveryCache;
}

// PKCE: สร้าง code_verifier + code_challenge (S256) — แนวปฏิบัติมาตรฐานปัจจุบันของ OAuth2
// สำหรับ Authorization Code flow ที่ ThaiD รองรับ (ไม่บังคับสำหรับทุก provider แต่ควรใช้เสมอ)
function generatePkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

/// บันทึก/อัปเดตผู้ใช้ใน Firestore แล้วสร้าง Firebase custom token + redirect
/// กลับไปที่แอป — ใช้ร่วมกันทั้ง flow จริง (ThaiD จริง) และ flow จำลอง (mock)
async function finishThaidLogin(res, { pid, name }) {
  const uid = `thaid_${pid}`;
  await db.collection(COLLECTIONS.USERS).doc(uid).set({
    uid,
    pid,
    name,
    loginMethod: 'thaid',
    updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const customToken = await admin.auth().createCustomToken(uid, { admin: false });

  // Redirect กลับไปที่หน้าเว็บของแอป พร้อมแนบ token ไปกับ URL
  // แอปฝั่ง Flutter Web จะอ่านค่านี้ตอนโหลดหน้า แล้วเรียก
  // signInWithCustomToken ต่อ (ดู auth_service.dart -> checkAuthState)
  const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || '/';
  const redirectTo = new URL(appUrl);
  redirectTo.searchParams.set('thaid_token', customToken);
  res.redirect(redirectTo.toString());
}

// Step 1: Redirect ผู้ใช้ไปหน้า ThaiD (หรือหน้าจำลองถ้าเปิด MOCK_THAID)
router.get('/thaid', async (req, res) => {
  if (MOCK_THAID) return res.redirect('/api/auth/thaid/mock');

  try {
    const discovery = await getThaidDiscovery();
    cleanupExpiredStates();
    const state = crypto.randomBytes(16).toString('hex');
    const { codeVerifier, codeChallenge } = generatePkcePair();
    pendingStates.set(state, { expiresAt: Date.now() + STATE_TTL_MS, codeVerifier });

    // scope ต้องตรงกับที่กรมการปกครองอนุมัติให้ client_id ของคุณตอนลงทะเบียน
    // ปรับได้ผ่าน THAID_SCOPE ใน .env — ค่าเริ่มต้นอ้างอิงจาก ETDA reference implementation
    const scope = process.env.THAID_SCOPE || 'openid pid name given_name family_name birthdate';

    const params = new URLSearchParams({
      response_type: 'code',
      client_id:     process.env.THAID_CLIENT_ID,
      redirect_uri:  process.env.THAID_REDIRECT_URI,
      scope,
      state,
      code_challenge:        codeChallenge,
      code_challenge_method: 'S256',
    });
    res.redirect(`${discovery.authorization_endpoint}?${params}`);
  } catch (err) {
    console.error('ThaiD discovery error:', err);
    res.status(500).json({ error: 'เชื่อมต่อ ThaiD ไม่สำเร็จ กรุณาลองใหม่ภายหลัง' });
  }
});

// Step 2: ThaiD Callback — แลก code เป็น token แล้วตรวจสอบลายเซ็น ID Token
router.get('/thaid/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).json({ error: 'ไม่พบ code จาก ThaiD' });

  // ตรวจสอบ state เพื่อป้องกัน CSRF — ต้องตรงกับที่สร้างไว้ตอนเริ่ม login
  // และใช้ได้ครั้งเดียวเท่านั้น (ลบทิ้งทันทีหลังใช้)
  const stateEntry = state && pendingStates.get(state);
  if (!stateEntry) {
    return res.status(400).json({ error: 'state ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
  pendingStates.delete(state);

  try {
    const discovery = await getThaidDiscovery();

    // แลก authorization_code เป็น token — ใช้ HTTP Basic auth (client_secret_basic)
    // ตามรูปแบบที่ ETDA ใช้ในตัวอย่าง introspect endpoint ของทางการ
    // ถ้า provider ของคุณต้องการ client_secret_post แทน ให้ตั้ง THAID_TOKEN_AUTH=post ใน .env
    const useBasicAuth = (process.env.THAID_TOKEN_AUTH || 'basic') === 'basic';
    const tokenBody = {
      grant_type:   'authorization_code',
      code,
      redirect_uri: process.env.THAID_REDIRECT_URI,
      code_verifier: stateEntry.codeVerifier, // PKCE
    };
    const tokenHeaders = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (useBasicAuth) {
      const basic = Buffer.from(
        `${process.env.THAID_CLIENT_ID}:${process.env.THAID_CLIENT_SECRET}`
      ).toString('base64');
      tokenHeaders.Authorization = `Basic ${basic}`;
    } else {
      tokenBody.client_id     = process.env.THAID_CLIENT_ID;
      tokenBody.client_secret = process.env.THAID_CLIENT_SECRET;
    }

    const tokenRes = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: tokenHeaders,
      body: new URLSearchParams(tokenBody),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error('ThaiD token exchange failed:', tokenData);
      return res.status(502).json({ error: 'แลก token กับ ThaiD ไม่สำเร็จ' });
    }

    let claims;
    if (tokenData.id_token && discovery.jwks_uri) {
      // ตรวจสอบลายเซ็น ID Token กับ JWKS ของ ThaiD จริง — สำคัญมาก ไม่ควรเชื่อ
      // ข้อมูลจาก id_token โดยไม่ตรวจสอบลายเซ็นก่อน (ป้องกันการปลอมแปลง token)
      const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));
      const { payload } = await jwtVerify(tokenData.id_token, jwks, {
        issuer:   discovery.issuer,
        audience: process.env.THAID_CLIENT_ID,
      });
      claims = payload;
    } else if (discovery.userinfo_endpoint) {
      // สำรอง: บาง provider ไม่ส่ง id_token กลับมา ให้ดึงจาก userinfo endpoint แทน
      const userRes = await fetch(discovery.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      claims = await userRes.json();
    } else {
      throw new Error('ไม่พบ id_token หรือ userinfo_endpoint จาก ThaiD');
    }

    const name = claims.name ||
      [claims.given_name, claims.family_name].filter(Boolean).join(' ') ||
      'ผู้ใช้ ThaiD';

    await finishThaidLogin(res, { pid: claims.pid, name });
  } catch (err) {
    console.error('ThaiD error:', err);
    res.status(500).json({ error: 'ThaiD authentication ล้มเหลว' });
  }
});

// ══════════════════════════════════════════════════════════════
//  MOCK ThaiD — ใช้ตอนพัฒนา/เดโมเท่านั้น เมื่อยังไม่มี credentials
//  จริงจากกรมการปกครอง เปิดด้วย MOCK_THAID=true ใน .env
//  ปิดไม่ให้ทำงานเด็ดขาดเมื่อ NODE_ENV=production (ดูด้านบน)
// ══════════════════════════════════════════════════════════════
router.get('/thaid/mock', (req, res) => {
  if (!MOCK_THAID) return res.status(404).json({ error: 'ไม่พบหน้านี้' });

  res.send(`<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8">
<title>จำลองการยืนยันตัวตนด้วย ThaiD</title>
<style>
  body { font-family: 'Sarabun', sans-serif; background: #EEF4F1; display: flex;
         align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { background: #fff; border-radius: 16px; padding: 32px; width: 100%; max-width: 380px;
          box-shadow: 0 8px 24px rgba(27,58,45,0.12); }
  .banner { background: #FFF3CD; color: #856404; padding: 10px 14px; border-radius: 8px;
            font-size: 13px; margin-bottom: 20px; }
  h2 { color: #1B3A2D; margin: 0 0 4px; font-size: 19px; }
  p.sub { color: #6b7c73; font-size: 13px; margin: 0 0 20px; }
  label { display: block; font-size: 13px; font-weight: 600; color: #1B3A2D; margin: 14px 0 6px; }
  input { width: 100%; padding: 10px 12px; border: 1px solid #d8e3de; border-radius: 8px;
          font-size: 14px; box-sizing: border-box; font-family: inherit; }
  button { width: 100%; margin-top: 22px; padding: 12px; border: none; border-radius: 8px;
           background: #2E7D52; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; }
  button:hover { background: #256341; }
</style></head>
<body>
  <div class="card">
    <div class="banner">⚠️ นี่คือหน้าจำลอง ThaiD สำหรับพัฒนา/เดโมเท่านั้น ไม่ใช่ระบบจริงของกรมการปกครอง</div>
    <h2>ยืนยันตัวตนด้วย ThaiD (จำลอง)</h2>
    <p class="sub">กรอกข้อมูลสมมติเพื่อทดสอบระบบ — ไม่มีการเชื่อมต่อกับหน่วยงานราชการจริง</p>
    <form method="POST" action="/api/auth/thaid/mock-callback">
      <label>ชื่อ-นามสกุล</label>
      <input name="name" required placeholder="เช่น สมชาย ใจดี" value="สมชาย ใจดี">
      <label>เลขบัตรประชาชน (13 หลัก, สมมติ)</label>
      <input name="pid" required pattern="\\d{13}" maxlength="13" placeholder="1234567890123" value="1234567890123">
      <button type="submit">ยินยอมและเข้าสู่ระบบ (จำลอง)</button>
    </form>
  </div>
</body></html>`);
});

router.post('/thaid/mock-callback', express.urlencoded({ extended: true }), async (req, res) => {
  if (!MOCK_THAID) return res.status(404).json({ error: 'ไม่พบหน้านี้' });

  const { name, pid } = req.body;
  if (!name || !pid || !/^\d{13}$/.test(pid)) {
    return res.status(400).send('กรุณากรอกชื่อและเลขบัตรประชาชน 13 หลักให้ถูกต้อง');
  }
  try {
    await finishThaidLogin(res, { pid, name });
  } catch (err) {
    console.error('Mock ThaiD error:', err);
    res.status(500).json({ error: 'จำลองการเข้าสู่ระบบล้มเหลว' });
  }
});

// ── Phone Register / Login ─────────────────────────────────
// Flutter ใช้ Firebase Auth Phone sign-in โดยตรง
// endpoint นี้ใช้สำหรับบันทึกข้อมูลเพิ่มเติมหลัง verify OTP
router.post('/register', async (req, res) => {
  const { uid, name, phone } = req.body;
  if (!uid || !name || !phone) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  }

  try {
    await db.collection(COLLECTIONS.USERS).doc(uid).set({
      uid, name, phone,
      loginMethod: 'phone',
      role:        'user',
      createdAt:   admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true, message: 'ลงทะเบียนสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get current user profile ───────────────────────────────
router.get('/me', require('../middleware/auth').verifyToken, async (req, res) => {
  try {
    const doc = await db.collection(COLLECTIONS.USERS).doc(req.user.uid).get();
    if (!doc.exists) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    const data = doc.data();
    // ผู้ใช้ทุกคนต้องมีเบอร์โทรไว้ให้แอดมินติดต่อกรณีแอปแจ้งเตือนไม่ถึง
    // (ผู้ใช้ที่ login ผ่าน ThaiD ไม่ได้กรอกเบอร์ตอน login จึงต้องเช็คแยก)
    res.json({ ...data, needsPhone: !data.phone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/auth/me — อัปเดตเบอร์โทร (ใช้กับผู้ใช้ที่ login ผ่าน ThaiD
// ซึ่งไม่ได้กรอกเบอร์ตอน login เป็นการเก็บเบอร์สำรองไว้ให้แอดมินติดต่อ) ──
router.patch('/me', require('../middleware/auth').verifyToken, async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^0\d{8,9}$/.test(phone.replace(/[\s-]/g, ''))) {
    return res.status(400).json({ error: 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (เช่น 0812345678)' });
  }
  try {
    await db.collection(COLLECTIONS.USERS).doc(req.user.uid).set({
      phone: phone.replace(/[\s-]/g, ''),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
