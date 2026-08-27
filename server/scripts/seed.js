// ============================================================
//  Seed Script — เพิ่มข้อมูลตัวอย่างลง Firestore
//  วิธีใช้: node scripts/seed.js
//  (ต้องตั้งค่า .env และมี serviceAccountKey.json ก่อน)
// ============================================================
require('dotenv').config();
const { db } = require('../config/firebase');

const services = [
  { name: 'ประคบหินร้อน', duration: 90, price: 500, emoji: '🔥', description: 'ผ่อนคลายกล้ามเนื้อด้วยหินร้อน', order: 1, active: true },
  { name: 'นวดเท้า', duration: 45, price: 200, emoji: '🦶', description: 'นวดกดจุดและผ่อนคลายฝ่าเท้า', order: 2, active: true },
  { name: 'นวดตัว', duration: 60, price: 300, emoji: '💆', description: 'ผ่อนคลายกล้ามเนื้อทั่วร่างกาย', order: 3, active: true },
  { name: 'กัวชา', duration: 60, price: 400, emoji: '🌿', description: 'ดูแลผิวและกล้ามเนื้อด้วยศาสตร์กัวชา', order: 4, active: true },
];

const staff = [
  { name: 'พี่นภา',    email: 'napa.staff@example.com',    experience: '5 ปี', status: 'available', todayCount: 0, active: true },
  { name: 'พี่สมชาย',  email: 'somchai.staff@example.com', experience: '8 ปี', status: 'available', todayCount: 0, active: true },
  { name: 'พี่มาเรียว', email: 'mario.staff@example.com',   experience: '3 ปี', status: 'available', todayCount: 0, active: true },
];

async function seed() {
  console.log('🌱 กำลังเพิ่มข้อมูลตัวอย่าง...');

  for (const s of services) {
    await db.collection('services').add(s);
    console.log(`  ✓ บริการ: ${s.name}`);
  }

  for (const s of staff) {
    await db.collection('staff').add(s);
    console.log(`  ✓ หมอนวด: ${s.name}`);
  }

  console.log('✅ เพิ่มข้อมูลตัวอย่างเสร็จสิ้น');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
