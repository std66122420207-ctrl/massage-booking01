const assert = require('assert');
const {
	autoCallUpcomingBookings,
	autoConfirmDueBookings,
	runAutoCallCycle,
	getToday,
	appointmentDate,
} = require('../services/autoCall');

assert.strictEqual(typeof autoCallUpcomingBookings, 'function');
assert.strictEqual(typeof autoConfirmDueBookings, 'function');
assert.strictEqual(typeof runAutoCallCycle, 'function');
assert.strictEqual(getToday(new Date('2026-10-03T18:00:00.000Z')), '2026-10-04');
assert.strictEqual(
	appointmentDate({ bookingDate: '2026-10-04', timeSlot: '10:00' }).toISOString(),
	'2026-10-04T03:00:00.000Z',
);

console.log('autoCall Bangkok timezone checks passed');
