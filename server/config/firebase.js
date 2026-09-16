require('dotenv').config();
const admin = require('firebase-admin');

// ── Initialize Firebase Admin ──────────────────────────────
// วิธีที่ 1: ใช้ environment variables (แนะนำสำหรับ production)
// ถ้ายังไม่ได้ตั้งค่า credential จริง ให้ข้ามไปใช้ applicationDefault() หรือ demo mode
// เพื่อไม่ให้ server crash จาก placeholder key ที่ยังไม่ถูกแทนค่าจริง
if (!admin.apps.length) {
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').trim();
  const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
  const hasServiceAccount = Boolean(
    clientEmail &&
    privateKey &&
    !/your-|YOUR_|replace_with|PASTE_|xxxxx|example/i.test(clientEmail + privateKey)
  );

  if (hasServiceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
}

// วิธีที่ 2: ใช้ไฟล์ serviceAccountKey.json (สำหรับ dev)
// const serviceAccount = require('./serviceAccountKey.json');
// admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

// ── Firestore Collections ──────────────────────────────────
const COLLECTIONS = {
  USERS:         'users',
  BOOKINGS:      'bookings',
  QUEUE:         'queue',
  SERVICES:      'services',
  STAFF:         'staff',
  NOTIFICATIONS: 'notifications',
};

module.exports = { admin, db, COLLECTIONS };
