// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';
import 'package:massage_booking/models/models.dart';

void main() {
  test('cancelling a booking preserves its details', () {
    final booking = BookingModel(
      id: 'booking-1',
      userId: 'user-1',
      serviceId: 'service-1',
      serviceName: 'นวดเท้า',
      servicePrice: 200,
      staffId: 'staff-1',
      staffName: 'พี่สมใจ',
      bookingDate: '2026-10-10',
      timeSlot: '10:00',
      queueNumber: 'A001',
      status: 'confirmed',
      healthcareRight: 'universal',
      nationalId: '1234567890123',
      channel: 'app',
      createdAt: DateTime.utc(2026, 10, 9),
    );

    final cancelled = booking.copyWith(status: 'cancelled');

    expect(cancelled.status, 'cancelled');
    expect(cancelled.id, booking.id);
    expect(cancelled.serviceName, booking.serviceName);
    expect(cancelled.staffName, booking.staffName);
    expect(cancelled.healthcareRight, booking.healthcareRight);
    expect(cancelled.nationalId, booking.nationalId);
    expect(cancelled.createdAt, booking.createdAt);
  });
}
