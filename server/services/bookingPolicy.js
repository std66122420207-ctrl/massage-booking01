function normalizeNationalId(value) {
  return String(value || '').replace(/[\s-]/g, '');
}

function getBangkokDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isHealthcareRightAlreadyUsed(bookings, nationalId, healthcareRight) {
  const normalizedNationalId = normalizeNationalId(nationalId);
  if (!normalizedNationalId || healthcareRight === 'direct') return false;

  return bookings.some((booking) => (
    normalizeNationalId(booking.nationalId) === normalizedNationalId
    && booking.healthcareRight === healthcareRight
    && booking.status !== 'cancelled'
  ));
}

function hasActiveBookingForUser(bookings, userId) {
  return bookings.some((booking) => (
    booking.userId === userId && booking.status !== 'cancelled'
  ));
}

function isBookingCancellable(status) {
  return ['pending', 'confirmed', 'auto_called'].includes(status);
}

function dateStringToUtc(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    return null;
  }
  return timestamp;
}

module.exports = {
  normalizeNationalId,
  getBangkokDate,
  isHealthcareRightAlreadyUsed,
  hasActiveBookingForUser,
  isBookingCancellable,
  dateStringToUtc,
};
