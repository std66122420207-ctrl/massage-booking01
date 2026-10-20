const { getBangkokDate } = require('./bookingPolicy');

const BOOKING_RETENTION_DAYS = 7;
const MAX_DELETE_BATCH_SIZE = 400;
const BOOKING_RETENTION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function getBookingRetentionCutoff(now = new Date()) {
  const today = getBangkokDate(now);
  const cutoff = new Date(`${today}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - BOOKING_RETENTION_DAYS);
  return cutoff.toISOString().slice(0, 10);
}

async function deleteExpiredBookings({
  db,
  beforeDate,
  batchSize = MAX_DELETE_BATCH_SIZE,
  maxBatches = Number.POSITIVE_INFINITY,
}) {
  const cutoffTimestamp = /^\d{4}-\d{2}-\d{2}$/.test(String(beforeDate || ''))
    ? Date.parse(`${beforeDate}T00:00:00.000Z`)
    : Number.NaN;
  if (
    !Number.isFinite(cutoffTimestamp)
    || new Date(cutoffTimestamp).toISOString().slice(0, 10) !== beforeDate
  ) {
    throw new Error('beforeDate must use yyyy-MM-dd format');
  }
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_DELETE_BATCH_SIZE) {
    throw new Error(`batchSize must be an integer between 1 and ${MAX_DELETE_BATCH_SIZE}`);
  }
  if (
    maxBatches !== Number.POSITIVE_INFINITY
    && (!Number.isInteger(maxBatches) || maxBatches < 1)
  ) {
    throw new Error('maxBatches must be a positive integer');
  }

  let deletedCount = 0;
  let batchesDeleted = 0;
  while (true) {
    const expired = await db.collection('bookings')
      .where('status', 'in', ['done', 'cancelled'])
      .where('bookingDate', '<', beforeDate)
      .orderBy('bookingDate', 'asc')
      .limit(batchSize)
      .get();
    if (expired.empty) break;

    const batch = db.batch();
    expired.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deletedCount += expired.size;
    batchesDeleted += 1;
    if (batchesDeleted >= maxBatches) break;
  }

  return deletedCount;
}

function createBookingRetentionRunner({
  deleteBatch = deleteExpiredBookings,
  batchSize = MAX_DELETE_BATCH_SIZE,
  intervalMs = BOOKING_RETENTION_INTERVAL_MS,
} = {}) {
  let lastCompletedAt = null;
  let hasMore = false;
  let inFlight = null;

  return async ({ db, now = new Date() }) => {
    if (inFlight) return inFlight;

    const nowMs = now.getTime();
    if (!hasMore && lastCompletedAt !== null && nowMs - lastCompletedAt < intervalMs) {
      return { deletedCount: 0, skipped: true };
    }

    inFlight = (async () => {
      const beforeDate = getBookingRetentionCutoff(now);
      const deletedCount = await deleteBatch({
        db,
        beforeDate,
        batchSize,
        maxBatches: 1,
      });
      hasMore = deletedCount >= batchSize;
      if (!hasMore) lastCompletedAt = nowMs;
      return { deletedCount, skipped: false, hasMore };
    })();

    try {
      return await inFlight;
    } finally {
      inFlight = null;
    }
  };
}

const runBookingRetentionIfDue = createBookingRetentionRunner();

module.exports = {
  BOOKING_RETENTION_DAYS,
  BOOKING_RETENTION_INTERVAL_MS,
  createBookingRetentionRunner,
  getBookingRetentionCutoff,
  deleteExpiredBookings,
  runBookingRetentionIfDue,
};
