const {
  isHealthcareRightAlreadyUsed,
  hasActiveBookingForUser,
} = require('./bookingPolicy');

function getQueueCounterId(bookingDate, serviceId, staffId) {
  const encode = (value) => Buffer.from(String(value)).toString('base64url');
  return `${bookingDate}__${encode(serviceId)}__${encode(staffId)}`;
}

async function createBookingTransaction({
  db,
  bookingId,
  bookingDate,
  staffId,
  serviceId,
  serviceCode,
  staffOrder,
  startMinutes,
  endMinutes,
  healthcareRight,
  normalizedNationalId,
  userId,
  bookingData,
}) {
  return db.runTransaction(async (transaction) => {
    const dayCounterRef = db.collection('counters').doc(bookingDate);
    const queueCounterRef = db.collection('counters')
      .doc(getQueueCounterId(bookingDate, serviceId, staffId));
    const dayCounterDoc = await transaction.get(dayCounterRef);
    const queueCounterDoc = await transaction.get(queueCounterRef);

    const staffBookings = await transaction.get(
      db.collection('bookings')
        .where('bookingDate', '==', bookingDate)
        .where('staffId', '==', staffId)
    );
    const overlaps = staffBookings.docs.some((doc) => {
      const existing = doc.data();
      if (!['pending', 'confirmed', 'auto_called', 'in_service'].includes(existing.status)) {
        return false;
      }
      const [hours, minutes] = String(existing.timeSlot || '').split(':').map(Number);
      const existingStart = hours * 60 + minutes;
      const existingEnd = existingStart + (Number(existing.duration) || 60);
      return startMinutes < existingEnd && endMinutes > existingStart;
    });
    if (overlaps) {
      throw Object.assign(new Error('เวลานี้ถูกจองแล้ว กรุณาเลือกเวลาอื่น'), { code: 409 });
    }

    const groupBookings = await transaction.get(
      db.collection('bookings')
        .where('bookingDate', '==', bookingDate)
        .where('serviceId', '==', serviceId)
        .where('staffId', '==', staffId)
    );
    const groupBookingData = groupBookings.docs.map((doc) => doc.data());

    const userBookings = await transaction.get(
      db.collection('bookings')
        .where('bookingDate', '==', bookingDate)
        .where('userId', '==', userId)
    );
    if (hasActiveBookingForUser(
      userBookings.docs.map((doc) => doc.data()),
      userId
    )) {
      throw Object.assign(
        new Error('คุณมีคิวที่ยังไม่ยกเลิกในวันที่เลือก กรุณายกเลิกคิวเดิมก่อนจองใหม่'),
        { code: 409 }
      );
    }

    if (healthcareRight !== 'direct' && normalizedNationalId) {
      const sameDayBookings = await transaction.get(
        db.collection('bookings').where('bookingDate', '==', bookingDate)
      );
      const sameDayData = sameDayBookings.docs.map((doc) => doc.data());
      if (isHealthcareRightAlreadyUsed(sameDayData, normalizedNationalId, healthcareRight)) {
        throw Object.assign(
          new Error('เลขบัตรนี้ใช้สิทธิเดียวกันจองไปแล้วในวันที่เลือก จองได้ 1 ครั้งต่อวัน'),
          { code: 409 }
        );
      }
    }

    const currentQueueNumber = Number(queueCounterDoc.exists ? queueCounterDoc.data().count : 0);
    const usedNumbers = groupBookingData
      .map((booking) => {
        const match = new RegExp(`^${serviceCode}${staffOrder}(\\d{2})$`).exec(
          String(booking.queueNumber || '')
        );
        return match ? Number(match[1]) : 0;
      })
      .filter((number) => number >= 1 && number <= 10);
    let nextNumber = Math.max(currentQueueNumber, ...usedNumbers) + 1;
    const usedQueueNumbers = new Set(groupBookingData.map((booking) => booking.queueNumber));

    while (nextNumber <= 10) {
      const candidate = `${serviceCode}${staffOrder}${String(nextNumber).padStart(2, '0')}`;
      if (!usedQueueNumbers.has(candidate)) {
        const legacyCollision = await transaction.get(
          db.collection('bookings')
            .where('bookingDate', '==', bookingDate)
            .where('queueNumber', '==', candidate)
        );
        if (legacyCollision.empty) break;
      }
      nextNumber += 1;
    }

    if (nextNumber > 10) {
      throw Object.assign(
        new Error('คิวของบริการและหมอนวดที่เลือกเต็มแล้ว กรุณาเลือกเวลา หมอนวด หรือวันอื่น'),
        { code: 409 }
      );
    }

    const booking = {
      ...bookingData,
      queueNumber: `${serviceCode}${staffOrder}${String(nextNumber).padStart(2, '0')}`,
    };
    const dayCounter = Number(dayCounterDoc.exists ? dayCounterDoc.data().count : 0);

    // Keep the legacy date counter as a transaction lock; queue numbers use the scoped counter above.
    transaction.set(dayCounterRef, { count: dayCounter + 1 });
    transaction.set(queueCounterRef, { count: nextNumber });
    transaction.set(db.collection('bookings').doc(bookingId), booking);
    return booking;
  });
}

module.exports = { createBookingTransaction, getQueueCounterId };
