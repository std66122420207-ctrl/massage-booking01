require('dotenv').config();
const admin = require('firebase-admin');

// ── Initialize Firebase Admin ──────────────────────────────
// วิธีที่ 1: ใช้ environment variables (แนะนำสำหรับ production)
if (!admin.apps.length) {
  const hasServiceAccount = process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY;
  admin.initializeApp(hasServiceAccount ? {
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  } : { credential: admin.credential.applicationDefault() });
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
