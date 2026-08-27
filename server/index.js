require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const path        = require('path');
const helmet      = require('helmet');
const compression = require('compression');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');

const { validateEnv } = require('./config/validateEnv');
validateEnv();

const authRoutes         = require('./routes/auth');
const bookingRoutes      = require('./routes/bookings');
const queueRoutes        = require('./routes/queue');
const serviceRoutes      = require('./routes/services');
const staffRoutes        = require('./routes/staff');
const adminRoutes        = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const fcmRoutes          = require('./routes/fcm');

const app  = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// อยู่หลัง reverse proxy (nginx / Render / Railway ฯลฯ) ต้องเปิดตัวนี้
// เพื่อให้ req.ip และ rate limiter อ่าน IP ผู้ใช้จริงจาก X-Forwarded-For
app.set('trust proxy', 1);

// ── Security & performance middleware ───────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "https://www.gstatic.com"],
      "script-src-attr": ["'unsafe-inline'"],
      "form-action": isProd ? ["'self'"] : ["*"],
      "connect-src": [
        "'self'",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://www.googleapis.com",
        "https://www.gstatic.com",
      ],
    },
  },
}));
app.use(compression());
app.use(morgan(isProd ? 'combined' : 'dev'));

// รองรับหลาย origin คั่นด้วย comma ใน FRONTEND_URL เช่น
// "https://admin.example.com,https://app.example.com"
const allowedOrigins = (process.env.FRONTEND_URL || '*')
  .split(',')
  .map((s) => s.trim());
app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Rate limiting ────────────────────────────────────────────
// จำกัดทุก endpoint กันการยิงถล่ม, และจำกัดเข้มกว่าสำหรับ auth (กัน brute force OTP)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'มีการเรียกใช้งานถี่เกินไป กรุณาลองใหม่ภายหลัง' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'พยายามเข้าสู่ระบบถี่เกินไป กรุณาลองใหม่ภายหลัง' },
});
app.use('/api/auth', authLimiter);
app.use('/api', generalLimiter);

// ── Serve Web Admin static files ────────────────────────────
app.use(express.static(path.join(__dirname, '../web-admin/public'), {
  maxAge: isProd ? '1d' : 0,
}));

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/bookings',      bookingRoutes);
app.use('/api/queue',         queueRoutes);
app.use('/api/services',      serviceRoutes);
app.use('/api/staff',         staffRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/fcm',           fcmRoutes);

// ── Health Check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Unmatched API routes → JSON 404 (ไม่ใช่หน้า HTML) ───────
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'ไม่พบ endpoint นี้' });
});

// ── Web Admin SPA fallback (เฉพาะ path ที่ไม่ใช่ /api) ───────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../web-admin/public/index.html'));
});

// ── Global error handler ─────────────────────────────────────
// ดักข้อผิดพลาดที่หลุดจาก route handler (เช่น throw ที่ไม่ได้ catch)
// ป้องกัน server ค้างหรือ process ล่มโดยไม่ทราบสาเหตุ
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดที่ไม่คาดคิดในระบบ' });
});

// ── Start ────────────────────────────────────────────────────
let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`\n🌿 Massage Booking Server [${process.env.NODE_ENV || 'development'}]`);
    console.log(`   API  → http://localhost:${PORT}/api`);
    console.log(`   Admin→ http://localhost:${PORT}\n`);
  });
}

// ── Graceful shutdown ────────────────────────────────────────
// ปิด server อย่างนุ่มนวลเมื่อ hosting platform สั่งหยุด (deploy ใหม่/restart)
// ให้ request ที่ค้างอยู่ทำงานจบก่อน แทนที่จะตัดกลางคัน
function shutdown(signal) {
  if (!server) return;
  console.log(`\n${signal} received — shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = app;
