const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getServiceQueueCode,
  getStaffQueueOrder,
  canReassignBookingStaff,
  hasActiveBookingForUser,
  isActiveBookingStatus,
  isHealthcareRightAlreadyUsed,
} = require('../services/bookingPolicy');

test('completed and cancelled bookings do not block a new appointment', () => {
  const previousBookings = [
    { userId: 'customer-1', status: 'done', nationalId: '1-2345-67890-12-3', healthcareRight: 'universal' },
    { userId: 'customer-1', status: 'cancelled', nationalId: '1234567890123', healthcareRight: 'universal' },
  ];

  assert.equal(hasActiveBookingForUser(previousBookings, 'customer-1'), false);
  assert.equal(
    isHealthcareRightAlreadyUsed(previousBookings, '1234567890123', 'universal'),
    false
  );
});

test('all waiting and in-service statuses still count as active', () => {
  for (const status of ['pending', 'confirmed', 'auto_called', 'in_service']) {
    assert.equal(isActiveBookingStatus(status), true);
    assert.equal(hasActiveBookingForUser([{ userId: 'customer-1', status }], 'customer-1'), true);
  }

  assert.equal(
    isHealthcareRightAlreadyUsed(
      [{ nationalId: '1-2345-67890-12-3', healthcareRight: 'universal', status: 'in_service' }],
      '1234567890123',
      'universal'
    ),
    true
  );
});

test('service queue codes follow the four configured service categories', () => {
  assert.equal(getServiceQueueCode('ประคบหินร้อน'), 'A');
  assert.equal(getServiceQueueCode('นวดเท้า'), 'B');
  assert.equal(getServiceQueueCode('นวดตัว'), 'C');
  assert.equal(getServiceQueueCode('กัวชา'), 'D');
  assert.equal(getServiceQueueCode('กัวซา'), 'D');
  assert.equal(getServiceQueueCode('บริการที่ไม่รู้จัก'), null);
});

test('staff queue order is limited to one digit', () => {
  assert.equal(getStaffQueueOrder(1), 1);
  assert.equal(getStaffQueueOrder('9'), 9);
  for (const value of [0, 10, 1.5, 'unknown', null]) {
    assert.equal(getStaffQueueOrder(value), null);
  }
});

test('staff reassignment is blocked once a booking queue number exists', () => {
  assert.equal(canReassignBookingStaff({ status: 'pending' }), true);
  assert.equal(canReassignBookingStaff({ queueNumber: 'A101' }), false);
  assert.equal(canReassignBookingStaff({ queueNumber: 'A001' }), false);
});
