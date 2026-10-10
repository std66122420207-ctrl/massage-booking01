const assert = require('assert');
const {
	sendAppointmentReminders,
	autoStartDueBookings,
	runAutoCallCycle,
	getToday,
	appointmentDate,
	dueAppointmentReminder,
	isReadyToAutoStart,
	isNoShowDue,
	isServiceCompleteDue,
	isQuotaExceededError,
} = require('../services/autoCall');
const {
	isHealthcareRightAlreadyUsed,
	hasActiveBookingForUser,
	isBookingCancellable,
	dateStringToUtc,
	getBangkokDate,
} = require('../services/bookingPolicy');

assert.strictEqual(typeof sendAppointmentReminders, 'function');
assert.strictEqual(typeof autoStartDueBookings, 'function');
assert.strictEqual(typeof runAutoCallCycle, 'function');
assert.strictEqual(typeof isQuotaExceededError, 'function');
assert.strictEqual(isQuotaExceededError({ code: 8 }), true);
assert.strictEqual(isQuotaExceededError({ message: 'Quota exceeded.' }), true);
assert.strictEqual(isQuotaExceededError({ code: 5 }), false);
assert.strictEqual(getToday(new Date('2026-10-03T18:00:00.000Z')), '2026-10-04');
assert.strictEqual(getBangkokDate(new Date('2026-10-03T18:00:00.000Z')), '2026-10-04');
assert.strictEqual(
	appointmentDate({ bookingDate: '2026-10-04', timeSlot: '10:00' }).toISOString(),
	'2026-10-04T03:00:00.000Z',
);
assert.strictEqual(Number.isNaN(appointmentDate({
	bookingDate: '2026-02-30',
	timeSlot: '10:00',
}).getTime()), true);
const reminderBooking = {
	bookingDate: '2026-10-04',
	timeSlot: '10:00',
	status: 'pending',
	channel: 'app',
};
assert.strictEqual(
	dueAppointmentReminder(reminderBooking, new Date('2026-10-04T02:00:00.000Z')).minutes,
	60,
);
assert.strictEqual(
	dueAppointmentReminder(reminderBooking, new Date('2026-10-04T02:30:00.000Z')).minutes,
	30,
);
assert.strictEqual(
	dueAppointmentReminder(reminderBooking, new Date('2026-10-04T02:45:00.000Z')).minutes,
	15,
);
assert.strictEqual(dueAppointmentReminder(reminderBooking, new Date('2026-10-04T03:00:00.000Z')), null);
assert.strictEqual(dueAppointmentReminder({
	...reminderBooking,
	appointmentReminder60SentAt: new Date('2026-10-04T02:00:00.000Z'),
}, new Date('2026-10-04T02:01:00.000Z')), null);
assert.strictEqual(dueAppointmentReminder({
	...reminderBooking,
	channel: 'walk-in',
}, new Date('2026-10-04T02:00:00.000Z')), null);
const appointment = { bookingDate: '2026-10-04', timeSlot: '10:00', status: 'auto_called' };
assert.strictEqual(isReadyToAutoStart(appointment, new Date('2026-10-04T02:59:00.000Z')), false);
assert.strictEqual(isReadyToAutoStart({
	...appointment,
	customerConfirmedAt: new Date('2026-10-04T02:59:00.000Z'),
}, new Date('2026-10-04T03:00:00.000Z')), true);
assert.strictEqual(isReadyToAutoStart({ ...appointment, status: 'cancelled' }, new Date('2026-10-04T04:00:00.000Z')), false);
assert.strictEqual(isReadyToAutoStart({ ...appointment, autoStartedAt: new Date() }, new Date('2026-10-04T04:00:00.000Z')), false);
assert.strictEqual(isNoShowDue(appointment, new Date('2026-10-04T03:04:59.000Z')), false);
assert.strictEqual(isNoShowDue(appointment, new Date('2026-10-04T03:05:00.000Z')), true);
assert.strictEqual(isNoShowDue({
	...appointment,
	status: 'confirmed',
}, new Date('2026-10-04T03:05:00.000Z')), true);
const autoConfirmedAppointment = {
	...appointment,
	autoConfirmedAt: new Date('2026-10-04T03:00:00.000Z'),
};
assert.strictEqual(isNoShowDue(autoConfirmedAppointment, new Date('2026-10-04T03:05:00.000Z')), true);
assert.strictEqual(isNoShowDue({
	...autoConfirmedAppointment,
	customerConfirmedAt: new Date('2026-10-04T03:04:59.000Z'),
}, new Date('2026-10-04T03:05:00.000Z')), false);
assert.strictEqual(isNoShowDue({
	...autoConfirmedAppointment,
	channel: 'walk-in',
}, new Date('2026-10-04T03:05:00.000Z')), false);
assert.strictEqual(isServiceCompleteDue({
	status: 'in_service',
	serviceStartedAt: new Date('2026-10-04T03:00:00.000Z'),
	duration: 60,
}, new Date('2026-10-04T03:59:59.000Z')), false);
assert.strictEqual(isServiceCompleteDue({
	status: 'in_service',
	serviceStartedAt: new Date('2026-10-04T03:00:00.000Z'),
	duration: 60,
}, new Date('2026-10-04T04:00:00.000Z')), true);
assert.strictEqual(isServiceCompleteDue({
	status: 'in_service',
	serviceStartedAt: new Date('2026-10-04T03:00:00.000Z'),
	duration: 45,
}, new Date('2026-10-04T03:44:59.000Z')), false);
assert.strictEqual(isServiceCompleteDue({
	status: 'in_service',
	serviceStartedAt: new Date('2026-10-04T03:00:00.000Z'),
	duration: 45,
}, new Date('2026-10-04T03:45:00.000Z')), true);

const priorBookings = [
	{ nationalId: '1-2345-67890-12-3', healthcareRight: 'universal', status: 'done' },
	{ nationalId: '1234567890123', healthcareRight: 'social_security', status: 'pending' },
	{ nationalId: '1234567890123', healthcareRight: 'direct', status: 'cancelled' },
];
assert.strictEqual(isHealthcareRightAlreadyUsed(priorBookings, '1234567890123', 'universal'), true);
assert.strictEqual(isHealthcareRightAlreadyUsed(priorBookings, '1234567890123', 'social_security'), true);
assert.strictEqual(isHealthcareRightAlreadyUsed(priorBookings, '1234567890123', 'direct'), false);
assert.strictEqual(isHealthcareRightAlreadyUsed([
	{ nationalId: '1234567890123', healthcareRight: 'universal', status: 'cancelled' },
], '1234567890123', 'universal'), false);
assert.strictEqual(isHealthcareRightAlreadyUsed([
	{ nationalId: '1234567890123', healthcareRight: 'direct', status: 'pending' },
], '1234567890123', 'direct'), false);
assert.strictEqual(hasActiveBookingForUser([
	{ userId: 'user-1', status: 'confirmed' },
], 'user-1'), true);
assert.strictEqual(hasActiveBookingForUser([
	{ userId: 'user-1', status: 'cancelled' },
], 'user-1'), false);
assert.strictEqual(hasActiveBookingForUser([
	{ userId: 'user-2', status: 'confirmed' },
], 'user-1'), false);
assert.strictEqual(isBookingCancellable('pending'), true);
assert.strictEqual(isBookingCancellable('auto_called'), true);
assert.strictEqual(isBookingCancellable('in_service'), false);
assert.strictEqual(isBookingCancellable('done'), false);
assert.strictEqual(dateStringToUtc('2026-10-09'), Date.parse('2026-10-09T00:00:00.000Z'));
assert.strictEqual(dateStringToUtc('2026-02-30'), null);

console.log('Booking policy and auto-call checks passed');
