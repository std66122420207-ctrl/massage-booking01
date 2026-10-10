const { db, COLLECTIONS, admin } = require('../config/firebase');
const { createNotification } = require('../routes/notifications');
const { sendPushToUser } = require('../routes/fcm');
const { sendSms } = require('./sms');
const {
  isQuotaExceededError,
  markQuotaExceeded,
  isQuotaPaused,
  deleteCachedValue,
} = require('./firestoreGuard');
const { getBangkokDate } = require('./bookingPolicy');

const AUTO_CALL_LEAD_MINUTES = 15;
const NO_SHOW_GRACE_MINUTES = 5;
const ACTIVE_STATUSES = ['pending', 'confirmed'];
const AUTO_START_READY_STATUSES = ['pending', 'confirmed', 'auto_called'];

function getToday(now = new Date()) {
  return getBangkokDate(now);
}

function appointmentDate(booking) {
  return new Date(`${booking.bookingDate}T${booking.timeSlot}:00+07:00`);
}

function timestampDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isReadyToAutoStart(booking, now = new Date()) {
  return AUTO_START_READY_STATUSES.includes(booking.status)
    && !booking.autoStartedAt
    && (booking.channel === 'walk-in' || Boolean(timestampDate(booking.customerConfirmedAt)))
    && Number.isFinite(appointmentDate(booking).getTime())
    && now >= appointmentDate(booking);
}

function isNoShowDue(booking, now = new Date()) {
  const appointment = appointmentDate(booking);
  return AUTO_START_READY_STATUSES.includes(booking.status)
    && booking.channel !== 'walk-in'
    && Boolean(timestampDate(booking.autoConfirmedAt))
    && !timestampDate(booking.customerConfirmedAt)
    && Number.isFinite(appointment.getTime())
    && now >= new Date(appointment.getTime() + NO_SHOW_GRACE_MINUTES * 60 * 1000);
}

function isServiceCompleteDue(booking, now = new Date()) {
  const startedAt = timestampDate(booking.serviceStartedAt || booking.calledAt);
  const duration = Number(booking.duration) || 60;
  return booking.status === 'in_service'
    && Boolean(startedAt)
    && now >= new Date(startedAt.getTime() + duration * 60 * 1000);
}

async function deliverAutoNotification(booking, message, title, type) {
  const deliveries = await Promise.allSettled([
    createNotification({ userId: booking.userId, bookingId: booking.id, message, type }),
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

async function resolveBookingNotifications(bookingId, action) {
  const snap = await db.collection(COLLECTIONS.NOTIFICATIONS)
    .where('bookingId', '==', bookingId)
    .get();
  if (snap.empty) return;

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      resolvedAction: action,
      resolvedBySystem: true,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  const userIds = [...new Set(snap.docs.map((doc) => doc.data().userId).filter(Boolean))];
  for (const userId of userIds) deleteCachedValue(`notifications:${userId}`);
  deleteCachedValue('notifications:admin');
}

async function autoStartDueBookings(now = new Date(), snapshot = null) {
  const today = getToday(now);
  let snap;
  try {
    snap = snapshot || await db.collection(COLLECTIONS.BOOKINGS)
      .where('bookingDate', '==', today)
      .get();
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markQuotaExceeded(error);
      console.warn('Firestore quota exceeded while auto-starting bookings; skipping cycle.');
      return { checked: 0, started: 0, quotaExceeded: true };
    }
    throw error;
  }

  let started = 0;
  let autoConfirmed = 0;
  let cancelled = 0;

  for (const doc of snap.docs) {
    const booking = doc.data();
    if (!AUTO_START_READY_STATUSES.includes(booking.status)) continue;
    const appointment = appointmentDate(booking);
    if (!Number.isFinite(appointment.getTime()) || now < appointment) continue;

    if (isNoShowDue(booking, now)) {
      const updated = await db.runTransaction(async (transaction) => {
        const current = await transaction.get(doc.ref);
        const latest = current.data();
        if (!current.exists || !isNoShowDue(latest, now)) return false;
        transaction.update(doc.ref, {
          status: 'cancelled',
          cancellationReason: 'no_show',
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
      });
      if (!updated) continue;
      cancelled += 1;
      await resolveBookingNotifications(doc.id, 'cancelled');
      await deliverAutoNotification(
        { ...booking, id: doc.id },
        `ยกเลิกคิว ${booking.queueNumber} อัตโนมัติ เนื่องจากไม่ได้ยืนยันภายใน 5 นาทีหลังเวลานัด`,
        'ยกเลิกคิวอัตโนมัติ',
        'no_show_cancelled',
      );
      continue;
    }

    if (booking.channel !== 'walk-in' && !timestampDate(booking.customerConfirmedAt)) {
      if (!booking.autoConfirmedAt) {
        const confirmed = await db.runTransaction(async (transaction) => {
          const current = await transaction.get(doc.ref);
          const latest = current.data();
          if (!current.exists || latest.autoConfirmedAt || !AUTO_START_READY_STATUSES.includes(latest.status)) {
            return false;
          }
          transaction.update(doc.ref, {
            status: 'confirmed',
            autoConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          return true;
        });
        if (confirmed) {
          autoConfirmed += 1;
          await deliverAutoNotification(
            { ...booking, id: doc.id },
            `ถึงเวลานัดของคุณแล้ว เลขคิว ${booking.queueNumber} กรุณายืนยันว่ามาถึงศูนย์บริการภายใน 5 นาที`,
            'ถึงเวลานัดแล้ว',
            'appointment_due',
          );
        }
      }
      continue;
    }

    const updated = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(doc.ref);
      const latest = current.data();
      if (!current.exists || !isReadyToAutoStart(latest, now)) {
        return false;
      }

      transaction.update(doc.ref, {
        status: 'in_service',
        confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        autoStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        serviceStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(db.collection('queue_status').doc(today), {
        currentQueue: latest.queueNumber,
        currentBookId: doc.id,
        currentStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return true;
    });

    if (!updated) continue;
    started += 1;

    const message = `เริ่มให้บริการคิว ${booking.queueNumber} อัตโนมัติแล้ว`;
    await deliverAutoNotification({ ...booking, id: doc.id }, message, 'เริ่มให้บริการแล้ว', 'auto_start');
  }

  return { checked: snap.size, autoConfirmed, started, cancelled };
}

async function autoCompleteDueBookings(now = new Date(), snapshot = null) {
  const today = getToday(now);
  let snap;
  try {
    snap = snapshot || await db.collection(COLLECTIONS.BOOKINGS)
      .where('bookingDate', '==', today)
      .get();
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markQuotaExceeded(error);
      console.warn('Firestore quota exceeded while auto-completing bookings; skipping cycle.');
      return { checked: 0, completed: 0, quotaExceeded: true };
    }
    throw error;
  }

  let completed = 0;
  for (const doc of snap.docs) {
    const booking = doc.data();
    if (!isServiceCompleteDue(booking, now)) continue;

    const updated = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(doc.ref);
      const latest = current.data();
      if (!current.exists || !isServiceCompleteDue(latest, now)) return false;

      const queueRef = db.collection('queue_status').doc(today);
      const queueDoc = await transaction.get(queueRef);
      transaction.update(doc.ref, {
        status: 'done',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        autoCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const queueUpdate = {
        doneCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (queueDoc.exists && queueDoc.data().currentBookId === doc.id) {
        queueUpdate.currentQueue = null;
        queueUpdate.currentBookId = null;
        queueUpdate.currentStartedAt = null;
      }
      transaction.set(queueRef, queueUpdate, { merge: true });
      return true;
    });
    if (!updated) continue;

    completed += 1;
    await deliverAutoNotification(
      { ...booking, id: doc.id },
      `บริการนวดคิว ${booking.queueNumber} เสร็จสิ้นแล้ว ขอบคุณที่มาใช้บริการ`,
      'บริการเสร็จสิ้น',
      'service_completed',
    );
  }
  return { checked: snap.size, completed };
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
    const message = `ใกล้ถึงเวลานัดของคุณแล้ว 15 นาที เลขคิว ${booking.queueNumber} กรุณาเปิดแอปและกดยืนยันเมื่อมาถึงศูนย์บริการ`;
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
      return { checked: 0, quotaExceeded: true, autoCall: { checked: 0, called: 0, quotaExceeded: true }, autoStart: { checked: 0, started: 0, quotaExceeded: true } };
    }
    throw error;
  }

  const autoCall = await autoCallUpcomingBookings(now, snapshot);
  const autoStart = await autoStartDueBookings(now, snapshot);
  const autoComplete = await autoCompleteDueBookings(now, snapshot);
  return { checked: snapshot.size, autoCall, autoStart, autoComplete };
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
  return setInterval(run, 60 * 1000);
}

module.exports = {
  autoCallUpcomingBookings,
  autoStartDueBookings,
  autoCompleteDueBookings,
  runAutoCallCycle,
  startAutoCallWorker,
  getToday,
  appointmentDate,
  isReadyToAutoStart,
  isNoShowDue,
  isServiceCompleteDue,
  timestampDate,
  isQuotaExceededError,
};
