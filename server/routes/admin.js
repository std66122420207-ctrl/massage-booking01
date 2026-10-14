const express = require('express');
const router  = express.Router();
const { db, COLLECTIONS } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { isQuotaExceededError, markQuotaExceeded, isQuotaPaused, getCachedValue, setCachedValue } = require('../services/firestoreGuard');

function isBookingCounted(booking) {
  return !!booking && booking.status !== 'cancelled';
}

function summarizeBookingCounts(bookings = []) {
  const total = bookings.filter(isBookingCounted).length;
  const done = bookings.filter((booking) => isBookingCounted(booking) && booking.status === 'done').length;
  const revenue = bookings
    .filter((booking) => isBookingCounted(booking) && booking.status === 'done')
    .reduce((sum, booking) => sum + (Number(booking.servicePrice) || 0), 0);

  return { total, done, cancelled: 0, revenue };
}

// ทุก route ในไฟล์นี้ใช้ได้เฉพาะแอดมิน
router.use(verifyToken, requireAdmin);

// ── Reports and system settings ───────────────────────────
router.get('/report', async (req, res) => {
  const cacheKey = 'admin:report:7d';
  const cached = getCachedValue(cacheKey, 180_000);
  if (cached !== undefined) {
    return res.json(cached);
  }

  if (isQuotaPaused()) {
    const safeResponse = [];
    setCachedValue(cacheKey, safeResponse, 180_000);
    return res.json(safeResponse);
  }

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
      if (booking.status === 'cancelled') {
        row.cancelled += 1;
        return;
      }
      row.total += 1;
      if (booking.status === 'done') {
        row.done += 1;
        row.revenue += Number(booking.servicePrice) || 0;
      }
    });
    const response = Object.entries(byDate).map(([date, values]) => ({ date, ...values }));
    setCachedValue(cacheKey, response, 180_000);
    res.json(response);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markQuotaExceeded(err);
      const safeResponse = [];
      setCachedValue(cacheKey, safeResponse, 180_000);
      return res.json(safeResponse);
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.isBookingCounted = isBookingCounted;
module.exports.summarizeBookingCounts = summarizeBookingCounts;

router.get('/settings', async (req, res) => {
  const cacheKey = 'admin:settings:general';
  const cached = getCachedValue(cacheKey, 60_000);
  if (cached !== undefined) {
    return res.json(cached);
  }

  if (isQuotaPaused()) {
    const safeResponse = {};
    setCachedValue(cacheKey, safeResponse, 60_000);
    return res.json(safeResponse);
  }

  try {
    const doc = await db.collection('settings').doc('general').get();
    const response = doc.exists ? doc.data() : {};
    setCachedValue(cacheKey, response, 60_000);
    res.json(response);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markQuotaExceeded(err);
      const safeResponse = {};
      setCachedValue(cacheKey, safeResponse, 60_000);
      return res.json(safeResponse);
    }
    res.status(500).json({ error: err.message });
  }
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
