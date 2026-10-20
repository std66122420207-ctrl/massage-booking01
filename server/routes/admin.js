const express = require('express');
const router  = express.Router();
const { db, COLLECTIONS } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { getBangkokDate, parseTimeToMinutes } = require('../services/bookingPolicy');
const { isQuotaExceededError, markQuotaExceeded, isQuotaPaused, getCachedValue, setCachedValue } = require('../services/firestoreGuard');

function getReportDates(now = new Date()) {
  const today = getBangkokDate(now);
  const todayUtc = Date.parse(`${today}T00:00:00.000Z`);
  return Array.from({ length: 7 }, (_, index) => (
    new Date(todayUtc - (6 - index) * 86400000).toISOString().slice(0, 10)
  ));
}

function isBookingCounted(booking) {
  return !!booking && booking.status !== 'cancelled';
}

function summarizeBookingCounts(bookings = []) {
  const total = bookings.filter(isBookingCounted).length;
  const done = bookings.filter((booking) => isBookingCounted(booking) && booking.status === 'done').length;

  return { total, done, cancelled: 0, revenue: null };
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
    const dates = getReportDates();
    const from = dates[0];
    const to = dates[dates.length - 1];
    const snap = await db.collection(COLLECTIONS.BOOKINGS)
      .where('bookingDate', '>=', from).where('bookingDate', '<=', to).get();
    const byDate = Object.fromEntries(dates.map((date) => [
      date, { total: 0, done: 0, cancelled: 0, revenue: null },
    ]));
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
module.exports.getReportDates = getReportDates;

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
    const currentDoc = await db.collection('settings').doc('general').get();
    const current = currentDoc.exists ? currentDoc.data() : {};
    const openTime = settings.open ?? current.open ?? '08:30';
    const closeTime = settings.close ?? current.close ?? '17:00';
    const openingMinutes = parseTimeToMinutes(openTime);
    const closingMinutes = parseTimeToMinutes(closeTime);
    if (openingMinutes === null || closingMinutes === null || openingMinutes >= closingMinutes) {
      return res.status(400).json({ error: 'เวลาเปิดและปิดทำการไม่ถูกต้อง' });
    }
    await db.collection('settings').doc('general').set(settings, { merge: true });
    res.json({ success: true, settings });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
