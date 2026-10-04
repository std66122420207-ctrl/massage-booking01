const { db, COLLECTIONS, admin } = require('../config/firebase');
const { createNotification } = require('../routes/notifications');
const { sendPushToUser } = require('../routes/fcm');
const { sendSms } = require('./sms');
const { isQuotaExceededError, markQuotaExceeded, isQuotaPaused } = require('./firestoreGuard');

const AUTO_CALL_LEAD_MINUTES = 15;
const ACTIVE_STATUSES = ['pending', 'confirmed'];
const AUTO_CONFIRM_READY_STATUSES = ['pending', 'confirmed', 'auto_called'];

function getToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function appointmentDate(booking) {
  return new Date(`${booking.bookingDate}T${booking.timeSlot}:00+07:00`);
}

async function deliverAutoNotification(booking, message, title, type) {
  const deliveries = await Promise.allSettled([
    createNotification({ userId: booking.userId, bookingId: booking.id, message }),
    sendPushToUser(booking.userId, title, message, {
      bookingId: booking.id,
      queueNumber: String(booking.queueNumber || ''),
      type,
    }),
    sendSms(booking.customerPhone, message),
  ]);

  for (const [index, delivery] of deliveries.entries()) {
    if (delivery.status === 'rejected') {
      console.error(`ส่ง auto-${type} ช่องทางที่ ${index + 1} ไม่สำเร็จ:`, delivery.reason);
    }
  }
}

async function autoConfirmDueBookings(now = new Date(), snapshot = null) {
  const today = getToday(now);
  let snap;
  try {
    snap = snapshot || await db.collection(COLLECTIONS.BOOKINGS)
      .where('bookingDate', '==', today)
      .get();
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markQuotaExceeded(error);
      console.warn('Firestore quota exceeded while auto-confirming bookings; skipping cycle.');
      return { checked: 0, confirmed: 0, quotaExceeded: true };
    }
    throw error;
  }

  let confirmed = 0;

  for (const doc of snap.docs) {
    const booking = doc.data();
    if (!AUTO_CONFIRM_READY_STATUSES.includes(booking.status)) continue;
    if (booking.status === 'in_service' || booking.status === 'done' || booking.status === 'cancelled') continue;
    if (booking.autoConfirmedAt) continue;

    const appointment = appointmentDate(booking);
    if (now < appointment) continue;

    const updated = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(doc.ref);
      const latest = current.data();
      if (!current.exists || !AUTO_CONFIRM_READY_STATUSES.includes(latest.status)) {
        return false;
      }
      if (latest.autoConfirmedAt) {
        return false;
      }

      transaction.update(doc.ref, {
        status: 'confirmed',
        confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        autoConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (!updated) continue;
    confirmed += 1;

    const message = `ถึงเวลานัดของคุณแล้ว เลขคิว ${booking.queueNumber} ระบบยืนยันการเข้ารับบริการแล้ว กรุณาเข้ารับบริการตามเวลานัด`;
    await deliverAutoNotification({ ...booking, id: doc.id }, message, 'ถึงเวลานัดแล้ว', 'auto_confirm');
  }

  return { checked: snap.size, confirmed };
}

async function autoCallUpcomingBookings(now = new Date(), snapshot = null) {
  const today = getToday(now);
  let snap;
  try {
    snap = snapshot || await db.collection(COLLECTIONS.BOOKINGS)
      .where('bookingDate', '==', today)
      .get();
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markQuotaExceeded(error);
      console.warn('Firestore quota exceeded while auto-calling bookings; skipping cycle.');
      return { checked: 0, called: 0, quotaExceeded: true };
    }
    throw error;
  }
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
    await deliverAutoNotification({ ...booking, id: doc.id }, message, 'ใกล้ถึงเวลานัด', 'auto_call');
  }
  return { checked: snap.size, called };
}

async function runAutoCallCycle(now = new Date()) {
  const today = getToday(now);
  let snapshot;
  try {
    snapshot = await db.collection(COLLECTIONS.BOOKINGS)
      .where('bookingDate', '==', today)
      .get();
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markQuotaExceeded(error);
      console.warn('Firestore quota exceeded for auto-call cycle; pausing cycle until quota resets.');
      return { checked: 0, quotaExceeded: true, autoCall: { checked: 0, called: 0, quotaExceeded: true }, autoConfirm: { checked: 0, confirmed: 0, quotaExceeded: true } };
    }
    throw error;
  }

  const [autoCall, autoConfirm] = await Promise.all([
    autoCallUpcomingBookings(now, snapshot),
    autoConfirmDueBookings(now, snapshot),
  ]);
  return { checked: snapshot.size, autoCall, autoConfirm };
}

function startAutoCallWorker() {
  const run = () => {
    if (isQuotaPaused()) {
      console.warn('Free-tier safe mode active; skipping auto-call worker cycle.');
      return Promise.resolve({ skipped: true, quotaExceeded: true });
    }
    return runAutoCallCycle().catch((error) => {
      if (isQuotaExceededError(error)) {
        markQuotaExceeded(error);
      }
      console.error('Auto-call worker cycle error:', error);
    });
  };
  run();
  return setInterval(run, 5 * 60 * 1000);
}

module.exports = {
  autoCallUpcomingBookings,
  autoConfirmDueBookings,
  runAutoCallCycle,
  startAutoCallWorker,
  getToday,
  appointmentDate,
  isQuotaExceededError,
};
