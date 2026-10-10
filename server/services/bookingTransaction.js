const {
  isHealthcareRightAlreadyUsed,
  hasActiveBookingForUser,
} = require('./bookingPolicy');

async function createBookingTransaction({
  db,
  bookingId,
  bookingDate,
  staffId,
  startMinutes,
  endMinutes,
  healthcareRight,
  normalizedNationalId,
  userId,
  bookingData,
}) {
  return db.runTransaction(async (transaction) => {
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

    if (healthcareRight !== 'direct' && normalizedNationalId) {
      const sameDayBookings = await transaction.get(
        db.collection('bookings').where('bookingDate', '==', bookingDate)
      );
      const sameDayData = sameDayBookings.docs.map((doc) => doc.data());
      if (hasActiveBookingForUser(sameDayData, userId)) {
        throw Object.assign(
          new Error('คุณมีคิวที่ยังไม่ยกเลิกในวันที่เลือก กรุณายกเลิกคิวเดิมก่อนจองใหม่'),
          { code: 409 }
        );
      }
      if (isHealthcareRightAlreadyUsed(sameDayData, normalizedNationalId, healthcareRight)) {
        throw Object.assign(
          new Error('เลขบัตรนี้ใช้สิทธิเดียวกันจองไปแล้วในวันที่เลือก จองได้ 1 ครั้งต่อวัน'),
          { code: 409 }
        );
      }
    } else {
      const sameDayBookings = await transaction.get(
        db.collection('bookings')
          .where('bookingDate', '==', bookingDate)
          .where('userId', '==', userId)
      );
      if (hasActiveBookingForUser(
        sameDayBookings.docs.map((doc) => doc.data()),
        userId
      )) {
        throw Object.assign(
          new Error('คุณมีคิวที่ยังไม่ยกเลิกในวันที่เลือก กรุณายกเลิกคิวเดิมก่อนจองใหม่'),
          { code: 409 }
        );
      }
    }

    const counterRef = db.collection('counters').doc(bookingDate);
    const counterDoc = await transaction.get(counterRef);
    const nextNumber = (counterDoc.exists ? counterDoc.data().count : 0) + 1;
    const booking = {
      ...bookingData,
      queueNumber: `A${String(nextNumber).padStart(3, '0')}`,
    };

    transaction.set(counterRef, { count: nextNumber });
    transaction.set(db.collection('bookings').doc(bookingId), booking);
    return booking;
  });
}

module.exports = { createBookingTransaction };
