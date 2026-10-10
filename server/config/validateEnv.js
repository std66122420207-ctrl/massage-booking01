// ตรวจสอบว่า environment variables ที่จำเป็นถูกตั้งค่าไว้ครบก่อน server จะเริ่มทำงาน
// ป้องกันปัญหา "รันได้แต่ error กลางทาง" เพราะลืมตั้งค่าบางตัวตอน deploy จริง

const REQUIRED_VARS = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
];

function validateEnv() {
  if (process.env.FUNCTIONS_RUNTIME === 'firebase') return;
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('\n❌ ขาด environment variable ที่จำเป็น:');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error('\nดูตัวอย่างค่าที่ต้องตั้งใน server/.env.example แล้วสร้างไฟล์ .env จริง\n');
    process.exit(1);
  }

  if (
    process.env.NODE_ENV === 'production' &&
    process.env.FRONTEND_URL === '*'
  ) {
    console.error('\n❌ FRONTEND_URL ห้ามเป็น * ใน production; ระบุ origin ที่อนุญาตอย่างเจาะจง\n');
    process.exit(1);
  }
}

module.exports = { validateEnv };
