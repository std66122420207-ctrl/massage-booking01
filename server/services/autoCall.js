const { db, COLLECTIONS, admin } = require('../config/firebase');
const { createNotification } = require('../routes/notifications');
const { sendPushToUser } = require('../routes/fcm');
const { sendSms } = require('./sms');

const AUTO_CALL_LEAD_MINUTES = 15;
const ACTIVE_STATUSES = ['pending', 'confirmed'];

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function appointmentDate(booking) {
  return new Date(`${booking.bookingDate}T${booking.timeSlot}:00`);
}

async function autoCallUpcomingBookings(now = new Date()) {
  const today = getToday();
  const snap = await db.collection(COLLECTIONS.BOOKINGS)
    .where('bookingDate', '==', today)
    .get();
  const due = snap.docs.filter((doc) => {
    const booking = doc.data();
    if (!ACTIVE_STATUSES.includes(booking.status)) return false;
    if (booking.channel === 'walk-in' || booking.autoCalledAt) return false;
    const appointment = appointmentDate(booking);
    const notifyAt = new Date(appointment.getTime() - AUTO_CALL_LEAD_MINUTES * 60 * 1000);
    return now >= notifyAt && now < appointment;
  });

  let called = 0;
  for (const doc of due) {
    const booking = doc.data();
    const updated = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(doc.ref);
      const latest = current.data();
      if (!current.exists || !ACTIVE_STATUSES.includes(latest.status) || latest.autoCalledAt) {
        return false;
      }
      transaction.update(doc.ref, {
        status: 'auto_called',
        autoCalledAt: admin.firestore.FieldValue.serverTimestamp(),
        calledAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(db.collection('queue_status').doc(today), {
        lastAutoCalledQueue: latest.queueNumber,
        lastAutoCalledBookingId: doc.id,
        lastAutoCalledAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return true;
    });

    if (!updated) continue;
    called += 1;
    const message = `ใกล้ถึงเวลานัดของคุณแล้ว 15 นาที เลขคิว ${booking.queueNumber} กรุณาเตรียมตัวมาที่ศูนย์บริการ`;
    createNotification({ userId: booking.userId, bookingId: doc.id, message })
      .catch((error) => console.error('สร้าง auto-call notification ไม่สำเร็จ:', error));
    sendPushToUser(booking.userId, 'ใกล้ถึงเวลานัด', message, {
      bookingId: doc.id,
      queueNumber: String(booking.queueNumber || ''),
      type: 'auto_call',
    }).catch((error) => console.error('ส่ง auto-call push ไม่สำเร็จ:', error));
    sendSms(booking.customerPhone, message)
      .catch((error) => console.error('ส่ง auto-call SMS ไม่สำเร็จ:', error));
  }
  return { checked: snap.size, called };
}

function startAutoCallWorker() {
  const run = () => autoCallUpcomingBookings().catch((error) => {
    console.error('Auto-call worker error:', error);
  });
  run();
  return setInterval(run, 60 * 1000);
}

module.exports = { autoCallUpcomingBookings, startAutoCallWorker };
