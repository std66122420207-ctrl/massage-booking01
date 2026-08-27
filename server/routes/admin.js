const express = require('express');
const router  = express.Router();
const { db, COLLECTIONS } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const googleSheets = require('../services/googleSheets');
const mailer       = require('../services/mailer');

// ทุก route ในไฟล์นี้ใช้ได้เฉพาะแอดมิน
router.use(verifyToken, requireAdmin);

/// Helper: ดึง booking ทั้งหมด (หรือเฉพาะวันที่ระบุ) พร้อมข้อมูล staff + user ประกอบ
async function loadBookingsWithContext(bookingDate) {
  let query = db.collection(COLLECTIONS.BOOKINGS);
  if (bookingDate) query = query.where('bookingDate', '==', bookingDate);
  const snap = await query.get();
  const bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const staffSnap = await db.collection(COLLECTIONS.STAFF).get();
  const staffById = {};
  staffSnap.docs.forEach((d) => { staffById[d.id] = { id: d.id, ...d.data() }; });

  const userIds = [...new Set(bookings.map((b) => b.userId).filter(Boolean))];
  const userById = {};
  await Promise.all(
    userIds.map(async (uid) => {
      const doc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
      if (doc.exists) userById[uid] = doc.data();
    })
  );

  return { bookings, staffById, userById };
}

// ── POST /api/admin/sync-sheets — ซิงค์การจองทั้งหมดไปที่ Google Sheets ──
router.post('/sync-sheets', async (req, res) => {
  try {
    const { bookings, staffById, userById } = await loadBookingsWithContext();
    const staffNameById = Object.fromEntries(
      Object.entries(staffById).map(([id, s]) => [id, s.name])
    );
    const result = await googleSheets.syncBookingsToSheet(bookings, staffNameById, userById);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/notify-therapists — ส่งอีเมลคิวให้หมอนวดแต่ละคน ──
// body: { bookingDate: "2026-08-02" } (default = วันนี้)
router.post('/notify-therapists', async (req, res) => {
  try {
    const bookingDate = req.body.bookingDate || new Date().toISOString().slice(0, 10);
    const { bookings, staffById, userById } = await loadBookingsWithContext(bookingDate);

    const activeBookings = bookings.filter((b) => b.status === 'pending' || b.status === 'confirmed');

    // แยกเคสของหมอนวดแต่ละคนออกจากกัน — คนไหนไม่มีคิวจะไม่ถูกส่งอีเมล
    const groupsByStaff = {};
    for (const b of activeBookings) {
      const staff = staffById[b.staffId];
      const staffName = staff?.name || 'ไม่ระบุหมอนวด';
      const key = b.staffId || 'unassigned';
      if (!groupsByStaff[key]) {
        groupsByStaff[key] = { staffName, staffEmail: staff?.email || null, bookings: [] };
      }
      const user = userById[b.userId];
      groupsByStaff[key].bookings.push({
        ...b,
        customerName:  b.customerName || user?.name || '',
        customerPhone: b.customerPhone || user?.phone || '',
      });
    }

    const groups = Object.values(groupsByStaff);
    if (groups.length === 0) {
      return res.json({ success: true, results: [], message: 'ไม่มีคิวสำหรับวันที่เลือก' });
    }

    const results = await mailer.sendAllTherapistEmails(groups, bookingDate);
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/integrations-status — เช็คว่าตั้งค่า Sheets/Email ไว้หรือยัง ──
// ใช้ให้หน้า web-admin ปิด/เปิดปุ่มให้เหมาะสม แทนที่จะกดแล้วเจอ error เฉยๆ
router.get('/integrations-status', (req, res) => {
  res.json({
    googleSheets: googleSheets.isConfigured(),
    email:        mailer.isConfigured(),
  });
});

// ── Reports and system settings ───────────────────────────
router.get('/report', async (req, res) => {
  try {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);
    const snap = await db.collection(COLLECTIONS.BOOKINGS)
      .where('bookingDate', '>=', from).where('bookingDate', '<=', to).get();
    const byDate = {};
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      byDate[date.toISOString().slice(0, 10)] = { total: 0, done: 0, cancelled: 0, revenue: 0 };
    }
    snap.docs.forEach((doc) => {
      const booking = doc.data();
      const row = byDate[booking.bookingDate];
      if (!row) return;
      row.total += 1;
      if (booking.status === 'done') {
        row.done += 1;
        row.revenue += Number(booking.servicePrice) || 0;
      }
      if (booking.status === 'cancelled') row.cancelled += 1;
    });
    res.json(Object.entries(byDate).map(([date, values]) => ({ date, ...values })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/settings', async (req, res) => {
  try {
    const doc = await db.collection('settings').doc('general').get();
    res.json(doc.exists ? doc.data() : {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/settings', async (req, res) => {
  const allowed = ['name', 'open', 'close', 'advance', 'maxqueue'];
  const settings = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  try {
    await db.collection('settings').doc('general').set(settings, { merge: true });
    res.json({ success: true, settings });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
