const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const { randomUUID } = require('node:crypto');
const { getBookingHistoryPage } = require('../services/bookingHistory');
const {
  deleteExpiredBookings,
  getBookingRetentionCutoff,
} = require('../services/bookingRetention');
const { getBangkokDate } = require('../services/bookingPolicy');

function shiftDate(date, days) {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

async function run() {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  assert.ok(emulatorHost, 'Run this test with the Firestore emulator.');

  const app = admin.initializeApp(
    { projectId: 'demo-booking-history-retention' },
    `booking-history-retention-${randomUUID()}`
  );
  const db = app.firestore();
  db.settings({ host: emulatorHost, ssl: false });
  const bookings = db.collection('bookings');
  const createdRefs = [];
  const today = getBangkokDate();
  const yesterday = shiftDate(today, -1);
  const retentionCutoff = getBookingRetentionCutoff();
  const expiredDate = shiftDate(retentionCutoff, -1);

  async function addBooking(id, bookingDate, status) {
    const ref = bookings.doc(id);
    createdRefs.push(ref);
    await ref.set({
      bookingDate,
      status,
      queueNumber: `A101-${id}`,
      nationalId: '1234567890123',
    });
    return ref;
  }

  try {
    const historicalIds = ['history-a', 'history-b', 'history-c', 'history-d'];
    for (const [index, id] of historicalIds.entries()) {
      await addBooking(id, yesterday, index % 2 === 0 ? 'done' : 'cancelled');
    }
    await addBooking('history-active', yesterday, 'confirmed');

    const historyPages = [];
    let cursor;
    do {
      const page = await getBookingHistoryPage({
        db,
        today,
        cursor,
        limit: 2,
        documentIdField: admin.firestore.FieldPath.documentId(),
      });
      historyPages.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);

    assert.equal(historyPages.length, historicalIds.length);
    assert.equal(new Set(historyPages.map((item) => item.id)).size, historicalIds.length);
    assert.deepEqual(
      historyPages.map((item) => item.id),
      historicalIds.sort().reverse()
    );
    assert.ok(historyPages.every((item) => ['done', 'cancelled'].includes(item.status)));
    assert.ok(historyPages.every((item) => !Object.hasOwn(item, 'nationalId')));

    await addBooking('expired-done', expiredDate, 'done');
    await addBooking('expired-cancelled', expiredDate, 'cancelled');
    await addBooking('expired-pending', expiredDate, 'pending');
    await addBooking('retained-boundary', retentionCutoff, 'done');

    const deletedCount = await deleteExpiredBookings({
      db,
      beforeDate: retentionCutoff,
      batchSize: 1,
    });
    assert.equal(deletedCount, 2);

    const [doneDoc, cancelledDoc, pendingDoc, boundaryDoc] = await Promise.all([
      bookings.doc('expired-done').get(),
      bookings.doc('expired-cancelled').get(),
      bookings.doc('expired-pending').get(),
      bookings.doc('retained-boundary').get(),
    ]);
    assert.equal(doneDoc.exists, false);
    assert.equal(cancelledDoc.exists, false);
    assert.equal(pendingDoc.exists, true);
    assert.equal(boundaryDoc.exists, true);

    console.log('Booking history pagination and 7-day retention checks passed');
  } finally {
    const remaining = [];
    for (let index = 0; index < createdRefs.length; index += 400) {
      const batch = db.batch();
      createdRefs.slice(index, index + 400).forEach((ref) => batch.delete(ref));
      remaining.push(batch.commit());
    }
    await Promise.all(remaining);
    await app.delete();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
