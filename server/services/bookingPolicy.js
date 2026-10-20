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
    && isActiveBookingStatus(booking.status)
  ));
}

function isActiveBookingStatus(status) {
  return ['pending', 'confirmed', 'auto_called', 'in_service'].includes(status);
}

function hasActiveBookingForUser(bookings, userId) {
  return bookings.some((booking) => (
    booking.userId === userId && isActiveBookingStatus(booking.status)
  ));
}

function isBookingCancellable(status) {
  return ['pending', 'confirmed', 'auto_called'].includes(status);
}

function canReassignBookingStaff(booking) {
  return !booking?.queueNumber;
}

const SERVICE_QUEUE_CODES = new Map([
  ['ประคบหินร้อน', 'A'],
  ['นวดเท้า', 'B'],
  ['นวดตัว', 'C'],
  ['กัวชา', 'D'],
  ['กัวซา', 'D'],
]);

function getServiceQueueCode(serviceName) {
  return SERVICE_QUEUE_CODES.get(String(serviceName || '').trim()) || null;
}

function getStaffQueueOrder(value) {
  const order = Number(value);
  return Number.isInteger(order) && order >= 1 && order <= 9 ? order : null;
}

function dateStringToUtc(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    return null;
  }
  return timestamp;
}

function parseTimeToMinutes(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function isWithinOperatingHours(timeSlot, duration, openTime, closeTime) {
  const start = parseTimeToMinutes(timeSlot);
  const opening = parseTimeToMinutes(openTime);
  const closing = parseTimeToMinutes(closeTime);
  const durationMinutes = Number(duration);
  return start !== null
    && opening !== null
    && closing !== null
    && opening < closing
    && Number.isFinite(durationMinutes)
    && durationMinutes > 0
    && start >= opening
    && start + durationMinutes <= closing;
}

module.exports = {
  normalizeNationalId,
  getBangkokDate,
  isHealthcareRightAlreadyUsed,
  isActiveBookingStatus,
  hasActiveBookingForUser,
  isBookingCancellable,
  canReassignBookingStaff,
  getServiceQueueCode,
  getStaffQueueOrder,
  dateStringToUtc,
  parseTimeToMinutes,
  isWithinOperatingHours,
};
