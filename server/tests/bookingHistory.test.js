const test = require('node:test');
const assert = require('node:assert/strict');
const {
  decodeBookingHistoryCursor,
  encodeBookingHistoryCursor,
  getBookingHistoryPage,
} = require('../services/bookingHistory');

test('history cursors preserve the booking date and document ID', () => {
  const token = encodeBookingHistoryCursor('2026-10-12', 'booking-123');
  assert.deepEqual(decodeBookingHistoryCursor(token), ['2026-10-12', 'booking-123']);
});

test('invalid history cursors are rejected as bad requests', () => {
  assert.throws(
    () => decodeBookingHistoryCursor('not-a-cursor'),
    (error) => error.status === 400 && error.message === 'cursor ไม่ถูกต้อง'
  );
  assert.throws(
    () => decodeBookingHistoryCursor(encodeBookingHistoryCursor('2026-99-99', 'booking-123')),
    (error) => error.status === 400
  );
});

test('history page size is validated before querying Firestore', async () => {
  await assert.rejects(
    getBookingHistoryPage({ db: null, today: '2026-10-19', limit: 101 }),
    (error) => error.status === 400
  );
});
