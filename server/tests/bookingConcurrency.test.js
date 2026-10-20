const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const { randomUUID } = require('node:crypto');
const {
  createBookingTransaction,
  getQueueCounterId,
} = require('../services/bookingTransaction');

function getTestDate(offset) {
  const date = new Date(Date.UTC(2099, 0, 1 + offset));
  return date.toISOString().slice(0, 10);
}

async function run() {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  assert.ok(emulatorHost, 'Run this test with the Firestore emulator.');

  const app = admin.initializeApp(
    { projectId: 'demo-massage-booking-concurrency' },
    `booking-concurrency-${randomUUID()}`
  );
  const db = app.firestore();
  db.settings({ host: emulatorHost, ssl: false });
  const bookingsRef = db.collection('bookings');
  const cleanupRefs = [];
  const counterRefs = [];

  async function makeBooking({
    date,
    staffId,
    serviceId,
    userId = randomUUID(),
    time = '10:00',
    status = 'pending',
    queueNumber,
    serviceCode = 'A',
    staffOrder = 1,
    nationalId = '',
    healthcareRight = 'direct',
  }) {
    const bookingId = randomUUID();
    cleanupRefs.push(bookingsRef.doc(bookingId));
    const startMinutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    const result = await createBookingTransaction({
      db,
      bookingId,
      bookingDate: date,
      staffId,
      serviceId,
      serviceCode,
      staffOrder,
      startMinutes,
      endMinutes: startMinutes + 30,
      healthcareRight,
      normalizedNationalId: nationalId,
      userId,
      bookingData: {
        id: bookingId,
        userId,
        serviceId,
        staffId,
        bookingDate: date,
        timeSlot: time,
        duration: 30,
        status,
        ...(queueNumber ? { queueNumber } : {}),
        ...(nationalId ? { nationalId } : {}),
        healthcareRight,
      },
    });
    counterRefs.push(
      db.collection('counters').doc(date),
      db.collection('counters').doc(getQueueCounterId(date, serviceId, staffId))
    );
    return { bookingId, booking: result };
  }

  try {
    const historyDate = getTestDate(0);
    const historyStaff = `staff-${randomUUID()}`;
    const historyService = `service-${randomUUID()}`;
    const sameCustomer = `customer-${randomUUID()}`;
    const completedRef = bookingsRef.doc(randomUUID());
    cleanupRefs.push(completedRef);
    await completedRef.set({
      userId: sameCustomer,
      serviceId: historyService,
      staffId: historyStaff,
      bookingDate: historyDate,
      timeSlot: '09:00',
      duration: 30,
      status: 'done',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      queueNumber: 'A101',
      healthcareRight: 'universal',
      nationalId: '1234567890123',
    });

    const repeat = await makeBooking({
      date: historyDate,
      staffId: historyStaff,
      serviceId: historyService,
      userId: sameCustomer,
      time: '10:00',
      healthcareRight: 'universal',
      nationalId: '1234567890123',
    });
    assert.equal(repeat.booking.queueNumber, 'A102');
    const oldBooking = await completedRef.get();
    assert.equal(oldBooking.data().status, 'done', 'The completed history record must remain unchanged.');
    assert.notEqual(repeat.bookingId, completedRef.id, 'A rebooking must create a new document.');

    const cancelledRef = bookingsRef.doc(randomUUID());
    cleanupRefs.push(cancelledRef);
    await cancelledRef.set({
      serviceId: historyService,
      staffId: historyStaff,
      bookingDate: historyDate,
      timeSlot: '10:30',
      duration: 30,
      status: 'cancelled',
      queueNumber: 'A103',
    });
    const afterCancelled = await makeBooking({
      date: historyDate,
      staffId: historyStaff,
      serviceId: historyService,
      time: '11:00',
    });
    assert.equal(afterCancelled.booking.queueNumber, 'A104', 'Cancelled queue numbers are not reused.');

    const fullDate = getTestDate(1);
    const fullStaff = `staff-${randomUUID()}`;
    const fullService = `service-${randomUUID()}`;
    const generatedNumbers = [];
    for (let index = 0; index < 10; index += 1) {
      const minutes = 8 * 60 + 30 + index * 30;
      const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      const created = await makeBooking({
        date: fullDate,
        staffId: fullStaff,
        serviceId: fullService,
        time,
        serviceCode: 'B',
        staffOrder: 2,
      });
      generatedNumbers.push(created.booking.queueNumber);
    }
    assert.deepEqual(
      generatedNumbers,
      Array.from({ length: 10 }, (_, index) => `B2${String(index + 1).padStart(2, '0')}`)
    );
    await assert.rejects(
      makeBooking({
        date: fullDate,
        staffId: fullStaff,
        serviceId: fullService,
        time: '15:00',
        serviceCode: 'B',
        staffOrder: 2,
      }),
      (error) => error.code === 409 && /เต็ม/.test(error.message)
    );

    const raceDate = getTestDate(2);
    const raceStaff = `staff-${randomUUID()}`;
    const raceService = `service-${randomUUID()}`;
    const concurrent = await Promise.allSettled([
      makeBooking({ date: raceDate, staffId: raceStaff, serviceId: raceService, userId: randomUUID() }),
      makeBooking({ date: raceDate, staffId: raceStaff, serviceId: raceService, userId: randomUUID() }),
    ]);
    assert.equal(concurrent.filter((result) => result.status === 'fulfilled').length, 1);
    const rejected = concurrent.find((result) => result.status === 'rejected');
    assert.equal(rejected.reason.code, 409);
    const raceSnapshot = await bookingsRef
      .where('bookingDate', '==', raceDate)
      .where('staffId', '==', raceStaff)
      .get();
    assert.equal(raceSnapshot.size, 1);
    assert.equal(raceSnapshot.docs[0].data().queueNumber, 'A101');

    const crossServiceDate = getTestDate(3);
    const crossStaff = `staff-${randomUUID()}`;
    const otherService = `service-${randomUUID()}`;
    await makeBooking({
      date: crossServiceDate,
      staffId: crossStaff,
      serviceId: `service-${randomUUID()}`,
      time: '12:00',
    });
    await assert.rejects(
      makeBooking({
        date: crossServiceDate,
        staffId: crossStaff,
        serviceId: otherService,
        time: '12:00',
        serviceCode: 'B',
      }),
      (error) => error.code === 409 && /ถูกจอง/.test(error.message)
    );

    console.log('Booking history, scoped queue numbering, capacity, and concurrency checks passed');
  } finally {
    const batch = db.batch();
    cleanupRefs.forEach((ref) => batch.delete(ref));
    [...new Map(counterRefs.map((ref) => [ref.path, ref])).values()]
      .forEach((ref) => batch.delete(ref));
    await batch.commit();
    await app.delete();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
