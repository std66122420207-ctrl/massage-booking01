// ============================================================
//  ตั้งค่า URL ของ backend server (Node.js + Express)
//  แก้ตอน deploy จริง หรือรันทดสอบ local
// ============================================================
class ApiConfig {
  // เปลี่ยนเป็น URL ของ server ที่รันอยู่จริง เช่น
  // - ทดสอบบนเครื่อง (Flutter Web + server รันที่เครื่องเดียวกัน): http://localhost:3000/api
  // - ทดสอบบนมือถือ/เครื่องอื่นในวง LAN เดียวกัน: http://<IP เครื่องที่รัน server>:3000/api
  // - production ที่ deploy แล้ว: https://your-domain.com/api
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000/api',
  );
}
