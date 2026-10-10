const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db, COLLECTIONS, admin } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { createBookingTransaction } = require('../services/bookingTransaction');
const {
  isBookingCancellable,
  getBangkokDate,
  dateStringToUtc,
} = require('../services/bookingPolicy');

function getBangkokNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

// ── GET /api/bookings — รายการจองของผู้ใช้ ─────────────────
router.get('/', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection(COLLECTIONS.BOOKINGS)
      .where('userId', '==', req.user.uid)
      .orderBy('bookingDate', 'desc')
      .limit(20)
      .get();

    const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/bookings — สร้างการจองใหม่ ───────────────────
router.post('/', verifyToken, async (req, res) => {
  const {
    serviceId, staffId, bookingDate, timeSlot, customerName, customerPhone,
    healthcareRight = 'direct', nationalId, channel = 'app',
  } = req.body;
  const allowedRights = ['universal', 'social_security', 'direct'];
  const rightLabels = {
    universal: 'บัตรทอง',
    social_security: 'ประกันสังคม',
    direct: 'จ่ายตรง',
  };

  if (!serviceId || !staffId || !bookingDate || !timeSlot) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  }
  if (!allowedRights.includes(healthcareRight)) {
    return res.status(400).json({ error: 'สิทธิการรักษาไม่ถูกต้อง' });
  }
  const normalizedNationalId = String(nationalId || '').replace(/[\s-]/g, '');
  if (healthcareRight !== 'direct' && !/^[0-9]{13}$/.test(normalizedNationalId)) {
    return res.status(400).json({ error: 'กรุณาระบุเลขบัตรประชาชน 13 หลักสำหรับสิทธินี้' });
  }
  if (!['app', 'web', 'walk-in'].includes(channel)) {
    return res.status(400).json({ error: 'ช่องทางการจองไม่ถูกต้อง' });
  }

  try {
    // ใช้วันตามเวลาไทยให้ตรงกับวันที่นัดและรอบรีเซ็ตสิทธิ
    const today = getBangkokNow().date;
    const todayUtc = dateStringToUtc(today);
    const bookingDateUtc = dateStringToUtc(bookingDate);
    if (todayUtc === null || bookingDateUtc === null) {
      return res.status(400).json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' });
    }
    const diffDays = (bookingDateUtc - todayUtc) / 86400000;

    const userDoc = await db.collection(COLLECTIONS.USERS).doc(req.user.uid).get();
    const userProfile = userDoc.exists ? userDoc.data() : {};
    const resolvedCustomerName = customerName || userProfile.name || req.user.name || '';
    const resolvedCustomerPhone = customerPhone || userProfile.phone || req.user.phone_number || '';

    const settingsDoc = await db.collection('settings').doc('general').get();
    const maxAdvanceDays = Number(settingsDoc.data()?.advance) || 3;
    if (diffDays < 0 || diffDays > maxAdvanceDays) {
      return res.status(400).json({ error: `จองล่วงหน้าได้ไม่เกิน ${maxAdvanceDays} วัน` });
    }

    // ดึงข้อมูลบริการ
    const serviceDoc = await db.collection(COLLECTIONS.SERVICES).doc(serviceId).get();
    if (!serviceDoc.exists) {
      return res.status(404).json({ error: 'ไม่พบบริการที่เลือก' });
    }
    const service = serviceDoc.data();
    const staffDoc = await db.collection(COLLECTIONS.STAFF).doc(staffId).get();
    if (!staffDoc.exists || staffDoc.data().active !== true) {
      return res.status(404).json({ error: 'ไม่พบหมอนวดที่เลือก' });
    }
    if ((staffDoc.data().status || 'available') !== 'available') {
      return res.status(409).json({ error: 'หมอนวดคนนี้ไม่ว่าง กรุณาเลือกคนอื่น' });
    }

    const [hours, minutes] = String(timeSlot).split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const duration = Number(service.duration) || 60;
    if (!Number.isFinite(startMinutes) || startMinutes < 0 || startMinutes >= 1440) {
      return res.status(400).json({ error: 'รูปแบบเวลาไม่ถูกต้อง' });
    }
    const bangkokNow = getBangkokNow();
    if (bookingDate === bangkokNow.date && startMinutes <= bangkokNow.minutes) {
      return res.status(400).json({ error: 'เวลานัดนี้ผ่านไปแล้ว กรุณาเลือกเวลาใหม่' });
    }
    const endMinutes = startMinutes + duration;

    const bookingId = uuidv4();

    // The shared daily queue counter serializes booking transactions for this date.
    const booking = await createBookingTransaction({
      db,
      bookingId,
      bookingDate,
      staffId,
      startMinutes,
      endMinutes,
      healthcareRight,
      normalizedNationalId,
      userId: req.user.uid,
      bookingData: {
        id: bookingId,
        userId: req.user.uid,
        customerName: resolvedCustomerName || null,
        customerPhone: resolvedCustomerPhone || null,
        healthcareRight,
        healthcareRightLabel: rightLabels[healthcareRight],
        nationalId: normalizedNationalId || null,
        channel,
        serviceId,
        serviceName: service.name || '',
        servicePrice: service.price || 0,
        duration,
        staffId: staffId || null,
        staffName: staffDoc.data().name || '',
        bookingDate,
        timeSlot,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    });

    res.status(201).json({ success: true, booking });
  } catch (err) {
    res.status(err.code === 409 ? 409 : 500).json({ error: err.message });
  }
});

// ── DELETE /api/bookings/:id — ยกเลิกการจอง ────────────────
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const ref = db.collection(COLLECTIONS.BOOKINGS).doc(req.params.id);
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      if (!doc.exists) return { status: 404, error: 'ไม่พบการจอง' };
      const booking = doc.data();
      if (booking.userId !== req.user.uid && !req.user.admin) {
        return { status: 403, error: 'ไม่มีสิทธิ์ยกเลิกการจองนี้' };
      }
      if (!isBookingCancellable(booking.status)) {
        return { status: 409, error: 'ยกเลิกไม่ได้ เนื่องจากคิวเริ่มให้บริการหรือเสร็จสิ้นแล้ว' };
      }
      transaction.update(ref, {
        status: 'cancelled',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { status: 200 };
    });

    if (result.status !== 200) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json({ success: true, message: 'ยกเลิกการจองสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/bookings/:id — Admin: อัปเดตสถานะ ───────────
router.patch('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { status, staffId, room } = req.body;
  const allowed = ['pending', 'confirmed', 'auto_called', 'in_service', 'done', 'cancelled'];

  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
  }

  try {
    const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(req.params.id);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) return res.status(404).json({ error: 'ไม่พบการจอง' });
    const currentBooking = bookingDoc.data();

    if (staffId && staffId !== currentBooking.staffId) {
      const staffDoc = await db.collection(COLLECTIONS.STAFF).doc(staffId).get();
      if (!staffDoc.exists || staffDoc.data().active !== true) {
        return res.status(404).json({ error: 'ไม่พบหมอนวดที่เลือก' });
      }
      if ((staffDoc.data().status || 'available') !== 'available') {
        return res.status(409).json({ error: 'หมอนวดคนนี้ไม่ว่าง กรุณาเลือกคนอื่น' });
      }
      const staffBookings = await db.collection(COLLECTIONS.BOOKINGS)
        .where('bookingDate', '==', currentBooking.bookingDate)
        .where('staffId', '==', staffId)
        .get();
      const [hours, minutes] = String(currentBooking.timeSlot || '').split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = startMinutes + (Number(currentBooking.duration) || 60);
      const overlaps = staffBookings.docs.some((doc) => {
        if (doc.id === req.params.id) return false;
        const existing = doc.data();
        if (!['pending', 'confirmed', 'in_service'].includes(existing.status)) return false;
        const [existingHours, existingMinutes] = String(existing.timeSlot || '').split(':').map(Number);
        const existingStart = existingHours * 60 + existingMinutes;
        const existingEnd = existingStart + (Number(existing.duration) || 60);
        return startMinutes < existingEnd && endMinutes > existingStart;
      });
      if (overlaps) {
        return res.status(409).json({ error: 'หมอนวดคนนี้มีคิวชนกันในช่วงเวลานี้' });
      }
    }

    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (status)  updates.status  = status;
    if (staffId) {
      updates.staffId = staffId;
      const staffDoc = await db.collection(COLLECTIONS.STAFF).doc(staffId).get();
      updates.staffName = staffDoc.data().name || '';
    }
    if (room)    updates.room    = room;

    await db.collection(COLLECTIONS.BOOKINGS).doc(req.params.id).update(updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/bookings/admin/today — Admin: รายการวันนี้ ─────
router.get('/admin/today', verifyToken, requireAdmin, async (req, res) => {
  const today = getBangkokDate();
  try {
    const snap = await db.collection(COLLECTIONS.BOOKINGS)
      .where('bookingDate', '==', today)
      .get();

    const staffSnap = await db.collection(COLLECTIONS.STAFF).get();
    const staffById = Object.fromEntries(staffSnap.docs.map((d) => [d.id, d.data()]));
    const userIds = [...new Set(snap.docs.map((d) => d.data().userId).filter(Boolean))];
    const userEntries = await Promise.all(userIds.map(async (uid) => {
      const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
      return [uid, userDoc.exists ? userDoc.data() : {}];
    }));
    const userById = Object.fromEntries(userEntries);
    const bookings = snap.docs
      .map(d => {
        const booking = { id: d.id, ...d.data() };
        const user = userById[booking.userId] || {};
        const staff = staffById[booking.staffId] || {};
        return {
          ...booking,
          customerName: booking.customerName || user.name || '',
          customerPhone: booking.customerPhone || user.phone || '',
          staffName: staff.name || '',
          healthcareRightLabel: booking.healthcareRightLabel || booking.healthcareRight || 'จ่ายตรง',
          channel: booking.channel || 'app',
        };
      })
      .sort((a, b) => String(a.timeSlot || '').localeCompare(String(b.timeSlot || '')));
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/bookings/admin/upcoming — Admin: รายการจองวันถัดไปทั้งหมด ──
router.get('/admin/upcoming', verifyToken, requireAdmin, async (req, res) => {
  const today = getBangkokDate();
  try {
    const snap = await db.collection(COLLECTIONS.BOOKINGS)
      .where('bookingDate', '>', today)
      .get();

    const staffSnap = await db.collection(COLLECTIONS.STAFF).get();
    const staffById = Object.fromEntries(staffSnap.docs.map((d) => [d.id, d.data()]));
    const userIds = [...new Set(snap.docs.map((d) => d.data().userId).filter(Boolean))];
    const userEntries = await Promise.all(userIds.map(async (uid) => {
      const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
      return [uid, userDoc.exists ? userDoc.data() : {}];
    }));
    const userById = Object.fromEntries(userEntries);
    const bookings = snap.docs
      .map((d) => {
        const booking = { id: d.id, ...d.data() };
        const user = userById[booking.userId] || {};
        const staff = staffById[booking.staffId] || {};
        return {
          ...booking,
          customerName: booking.customerName || user.name || '',
          customerPhone: booking.customerPhone || user.phone || '',
          staffName: staff.name || booking.staffName || '',
          healthcareRightLabel: booking.healthcareRightLabel || booking.healthcareRight || 'จ่ายตรง',
          channel: booking.channel || 'app',
        };
      })
      .sort((a, b) => (
        String(a.bookingDate || '').localeCompare(String(b.bookingDate || ''))
        || String(a.timeSlot || '').localeCompare(String(b.timeSlot || ''))
      ));
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
