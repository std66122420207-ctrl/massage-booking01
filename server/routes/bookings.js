const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db, COLLECTIONS, admin } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

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

  // ใช้ค่าจองล่วงหน้าจากการตั้งค่าของแอดมิน (ค่าเริ่มต้น 3 วัน)
  const today    = new Date(); today.setHours(0,0,0,0);
  const bookDate = new Date(bookingDate);
  const diffDays = Math.floor((bookDate - today) / 86400000);
  try {
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
    const endMinutes = startMinutes + duration;

    const bookingId = uuidv4();

    // ใช้ transaction ครอบทั้งการเช็คซ้ำ + ออกเลขคิว + บันทึกการจอง
    // เพื่อป้องกัน race condition กรณีมีคนจองเวลาเดียวกันพร้อมกัน
    // (เดิม: เช็คซ้ำอยู่นอก try/catch ทำให้ error จาก Firestore
    //  ไม่ถูกจับ และอาจทำให้ server ค้าง/ล่มได้)
    const booking = await db.runTransaction(async (t) => {
      const staffBookings = await t.get(
        db.collection(COLLECTIONS.BOOKINGS)
          .where('bookingDate', '==', bookingDate)
          .where('staffId', '==', staffId)
      );
      const overlaps = staffBookings.docs.some((doc) => {
        const existing = doc.data();
        if (!['pending', 'confirmed', 'in_service'].includes(existing.status)) return false;
        const [existingHours, existingMinutes] = String(existing.timeSlot || '').split(':').map(Number);
        const existingStart = existingHours * 60 + existingMinutes;
        const existingEnd = existingStart + (Number(existing.duration) || 60);
        return startMinutes < existingEnd && endMinutes > existingStart;
      });
      if (overlaps) {
        throw Object.assign(new Error('เวลานี้ถูกจองแล้ว กรุณาเลือกเวลาอื่น'), { code: 409 });
      }

      if (healthcareRight !== 'direct') {
        const sameDayBookings = await t.get(
          db.collection(COLLECTIONS.BOOKINGS).where('bookingDate', '==', bookingDate)
        );
        const rightAlreadyUsed = sameDayBookings.docs.some((doc) => {
          const existing = doc.data();
          return existing.nationalId === normalizedNationalId
            && existing.healthcareRight === healthcareRight
            && !['cancelled', 'done'].includes(existing.status);
        });
        if (rightAlreadyUsed) {
          throw Object.assign(new Error('สิทธินี้ถูกใช้งานแล้วในวันนี้'), { code: 409 });
        }
      }

      const counterRef = db.collection('counters').doc(bookingDate);
      const counterDoc = await t.get(counterRef);
      const n = (counterDoc.exists ? counterDoc.data().count : 0) + 1;
      const queueNumber = `A${String(n).padStart(3, '0')}`;
      t.set(counterRef, { count: n });

      const newBooking = {
        id:           bookingId,
        userId:       req.user.uid,
        customerName: resolvedCustomerName || null,
        customerPhone: resolvedCustomerPhone || null,
        healthcareRight,
        healthcareRightLabel: rightLabels[healthcareRight],
        nationalId: normalizedNationalId || null,
        channel,
        serviceId,
        serviceName:  service.name || '',
        servicePrice: service.price || 0,
        duration,
        staffId:      staffId || null,
        staffName:    staffDoc.data().name || '',
        bookingDate,
        timeSlot,
        queueNumber,
        status:       'pending',   // pending | confirmed | in_service | done | cancelled
        createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      };
      t.set(db.collection(COLLECTIONS.BOOKINGS).doc(bookingId), newBooking);
      return newBooking;
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
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ error: 'ไม่พบการจอง' });
    if (doc.data().userId !== req.user.uid && !req.user.admin) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ยกเลิกการจองนี้' });
    }

    await ref.update({ status: 'cancelled', cancelledAt: admin.firestore.FieldValue.serverTimestamp() });
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
  const today = new Date().toISOString().split('T')[0];
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

module.exports = router;
