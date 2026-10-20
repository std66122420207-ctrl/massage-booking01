const assert = require('node:assert/strict');
const test = require('node:test');
const {
  BOOKING_RETENTION_INTERVAL_MS,
  createBookingRetentionRunner,
} = require('../services/bookingRetention');

test('retention runs in bounded batches and resumes until complete', async () => {
  const calls = [];
  const results = [400, 8, 0];
  const runRetention = createBookingRetentionRunner({
    deleteBatch: async (options) => {
      calls.push(options);
      return results.shift();
    },
    batchSize: 400,
  });
  const start = new Date('2026-10-19T00:00:00.000Z');

  assert.deepEqual(await runRetention({ db: {}, now: start }), {
    deletedCount: 400,
    skipped: false,
    hasMore: true,
  });
  assert.deepEqual(await runRetention({ db: {}, now: start }), {
    deletedCount: 8,
    skipped: false,
    hasMore: false,
  });
  assert.deepEqual(await runRetention({ db: {}, now: start }), {
    deletedCount: 0,
    skipped: true,
  });
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.maxBatches === 1));

  const nextWeek = new Date(start.getTime() + BOOKING_RETENTION_INTERVAL_MS);
  assert.deepEqual(await runRetention({ db: {}, now: nextWeek }), {
    deletedCount: 0,
    skipped: false,
    hasMore: false,
  });
  assert.equal(calls.length, 3);
});
