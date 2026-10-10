const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const { randomUUID } = require('node:crypto');
const { createBookingTransaction } = require('../services/bookingTransaction');

async function run() {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  assert.ok(emulatorHost, 'Run this test with the Firestore emulator.');

  const app = admin.initializeApp(
    { projectId: 'demo-massage-booking-concurrency' },
    `booking-concurrency-${randomUUID()}`
  );
  const db = app.firestore();
  db.settings({ host: emulatorHost, ssl: false });

  const bookingDate = '2099-01-01';
  const staffId = `concurrency-test-${randomUUID()}`;
  const counterRef = db.collection('counters').doc(bookingDate);
  const bookingRef = db.collection('bookings');

  try {
    const attempts = ['customer-a', 'customer-b'].map((userId) => {
      const bookingId = randomUUID();
      return createBookingTransaction({
        db,
        bookingId,
        bookingDate,
        staffId,
        startMinutes: 600,
        endMinutes: 660,
        healthcareRight: 'direct',
        normalizedNationalId: '',
        userId,
        bookingData: {
          id: bookingId,
          userId,
          bookingDate,
          staffId,
          timeSlot: '10:00',
          duration: 60,
          status: 'pending',
        },
      });
    });

    const results = await Promise.allSettled(attempts);
    const successful = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    assert.equal(successful.length, 1, 'Exactly one concurrent booking should succeed.');
    assert.equal(rejected.length, 1, 'The other booking should be rejected.');
    assert.equal(rejected[0].reason.code, 409, 'The conflict should be reported as HTTP 409.');

    const bookings = await bookingRef
      .where('bookingDate', '==', bookingDate)
      .where('staffId', '==', staffId)
      .get();
    assert.equal(bookings.size, 1, 'Only one booking should be persisted for the slot.');

    const counter = await counterRef.get();
    assert.equal(counter.data().count, 1, 'A rejected booking must not consume a queue number.');
    assert.equal(successful[0].value.queueNumber, 'A001');
  } finally {
    const testBookings = await bookingRef
      .where('bookingDate', '==', bookingDate)
      .where('staffId', '==', staffId)
      .get();
    const batch = db.batch();
    testBookings.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(counterRef);
    await batch.commit();
    await app.delete();
  }

  console.log('Concurrent same-slot booking check passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
