// ตรวจสอบว่า environment variables ที่จำเป็นถูกตั้งค่าไว้ครบก่อน server จะเริ่มทำงาน
// ป้องกันปัญหา "รันได้แต่ error กลางทาง" เพราะลืมตั้งค่าบางตัวตอน deploy จริง

const REQUIRED_VARS = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
];

const RECOMMENDED_VARS = [
  'FRONTEND_URL',
  'APP_URL',
  'THAID_CLIENT_ID',
  'THAID_CLIENT_SECRET',
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

  const mockThaid = process.env.DEMO_MODE === 'true' && process.env.MOCK_THAID === 'true';
  if (!mockThaid) {
    const missingThaid = ['THAID_CLIENT_ID', 'THAID_CLIENT_SECRET', 'THAID_REDIRECT_URI']
      .filter((key) => !process.env[key] || /your-|YOUR_|replace_with/i.test(process.env[key]));
    if (missingThaid.length > 0) {
      console.error('\nขาด ThaiD credentials สำหรับโหมดจริง:');
      missingThaid.forEach((key) => console.error(`   - ${key}`));
      console.error('ตั้งค่าใน server/.env หรือเปิด MOCK_THAID=true สำหรับเดโมเท่านั้น\n');
      process.exit(1);
    }
  }

  const missingRecommended = RECOMMENDED_VARS.filter((key) => !process.env[key]);
  if (missingRecommended.length > 0 && process.env.NODE_ENV === 'production') {
    console.warn('\n⚠️  ยังไม่ได้ตั้งค่า (ระบบจะรันได้ แต่บางฟีเจอร์อาจไม่ทำงานสมบูรณ์):');
    missingRecommended.forEach((key) => console.warn(`   - ${key}`));
    console.warn('');
  }

  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.FRONTEND_URL || process.env.FRONTEND_URL === '*')
  ) {
    console.warn(
      '\n⚠️  FRONTEND_URL ยังไม่ได้ตั้งค่าเฉพาะเจาะจงตอนอยู่ใน production — ' +
        'CORS จะเปิดกว้างเกินไป ควรระบุ origin ที่แน่นอน เช่น https://yourapp.com\n'
    );
  }
}

module.exports = { validateEnv };
