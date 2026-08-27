// ============================================================
//  ตั้งสิทธิ์ Admin ให้ผู้ใช้ — จำเป็นสำหรับ login เข้า web-admin
//  วิธีใช้:
//    1. ไปที่ Firebase Console → Authentication → เพิ่มผู้ใช้ด้วย
//       อีเมล/รหัสผ่าน (Email/Password) ก่อน (ถ้ายังไม่มี ต้องเปิด
//       Sign-in method นี้ใน Firebase Console ด้วย)
//    2. รัน:  node scripts/setAdmin.js admin@example.com
//    3. ผู้ใช้ต้อง logout แล้ว login ใหม่ (หรือรอ token หมดอายุ ~1 ชม.)
//       เพื่อให้ custom claim มีผล
// ============================================================
require('dotenv').config();
const { admin } = require('../config/firebase');

async function setAdmin(email) {
  if (!email) {
    console.error('❌ กรุณาระบุอีเมล: node scripts/setAdmin.js admin@example.com');
    process.exit(1);
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log(`✅ ตั้งสิทธิ์ admin ให้ ${email} เรียบร้อยแล้ว (uid: ${user.uid})`);
    console.log('   ผู้ใช้ต้อง logout แล้ว login ใหม่เพื่อให้มีผล');
    process.exit(0);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.error(`❌ ไม่พบผู้ใช้อีเมล ${email} — ต้องสร้างบัญชีนี้ใน Firebase Console`);
      console.error('   Authentication → Users → Add user ก่อน');
    } else {
      console.error('❌ เกิดข้อผิดพลาด:', err.message);
    }
    process.exit(1);
  }
}

setAdmin(process.argv[2]);
