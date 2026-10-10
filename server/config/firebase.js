require('dotenv').config();
const admin = require('firebase-admin');

// ── Initialize Firebase Admin ──────────────────────────────
// วิธีที่ 1: ใช้ environment variables (แนะนำสำหรับ production)
// ถ้ายังไม่ได้ตั้งค่า credential จริง ให้ข้ามไปใช้ applicationDefault() หรือ demo mode
// เพื่อไม่ให้ server crash จาก placeholder key ที่ยังไม่ถูกแทนค่าจริง
if (!admin.apps.length) {
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').trim();
  let firebaseConfig = {};
  try {
    firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
  } catch {
    console.warn('FIREBASE_CONFIG is not valid JSON; using individual Firebase environment variables.');
  }
  const projectId = (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    firebaseConfig.projectId ||
    ''
  ).trim();
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    firebaseConfig.storageBucket ||
    (projectId ? `${projectId}.firebasestorage.app` : undefined);
  const firebaseOptions = {
    ...(projectId ? { projectId } : {}),
    ...(storageBucket ? { storageBucket } : {}),
  };
  const hasServiceAccount = Boolean(
    clientEmail &&
    privateKey &&
    !/your-|YOUR_|replace_with|PASTE_|xxxxx|example/i.test(clientEmail + privateKey)
  );

  if (hasServiceAccount) {
    admin.initializeApp({
      ...firebaseOptions,
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    admin.initializeApp({
      ...firebaseOptions,
      credential: admin.credential.applicationDefault(),
    });
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
