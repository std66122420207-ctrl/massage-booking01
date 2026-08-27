import 'package:flutter/material.dart';
import '../models/models.dart';
import 'api_client.dart';

class BookingService extends ChangeNotifier {
  List<ServiceModel> _services = [];
  List<BookingModel> _bookings = [];
  List<NotificationModel> _notifications = [];
  bool _loading = false;
  bool _notificationsLoading = false;
  String? _error;

  List<ServiceModel> get services => _services;
  List<BookingModel> get bookings => _bookings;
  List<NotificationModel> get notifications => _notifications;
  int get unconfirmedCount => _notifications.where((n) => !n.confirmed).length;
  bool get loading => _loading;
  bool get notificationsLoading => _notificationsLoading;
  String? get error => _error;

  /// โหลดรายการบริการจาก backend (GET /api/services)
  /// ถ้าโหลดไม่สำเร็จ (เช่น server ยังไม่ได้รัน) จะปล่อยให้ UI แสดง
  /// fallback ของตัวเอง (ดู services_screen.dart -> _ServiceListFallback)
  Future<void> loadServices() async {
    _error = null;
    try {
      final data = await ApiClient.get('/services');
      _services = (data as List)
          .map((e) =>
              ServiceModel.fromMap(e['id'], Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      _error = 'โหลดรายการบริการไม่สำเร็จ: $e';
      _services = [];
    }
    notifyListeners();
  }

  /// โหลดประวัติการจองของผู้ใช้ที่ login อยู่ (GET /api/bookings)
  Future<void> loadMyBookings() async {
    _error = null;
    _loading = true;
    notifyListeners();
    try {
      final data = await ApiClient.get('/bookings');
      _bookings = (data as List)
          .map((e) =>
              BookingModel.fromMap(e['id'], Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      _error = 'โหลดการจองไม่สำเร็จ: $e';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// สร้างการจองใหม่ (POST /api/bookings)
  /// คืนค่า null ถ้าล้มเหลว — ข้อความ error ดูได้ที่ [error]
  Future<BookingModel?> createBooking({
    required String serviceId,
    required String bookingDate,
    required String timeSlot,
    String? staffId,
  }) async {
    _error = null;
    try {
      final data = await ApiClient.post('/bookings', {
        'serviceId': serviceId,
        'bookingDate': bookingDate,
        'timeSlot': timeSlot,
        if (staffId != null) 'staffId': staffId,
      });
      final booking = BookingModel.fromMap(
        data['booking']['id'],
        Map<String, dynamic>.from(data['booking']),
      );
      _bookings.insert(0, booking);
      notifyListeners();
      return booking;
    } on ApiException catch (e) {
      _error = e.message; // เช่น "เวลานี้ถูกจองแล้ว กรุณาเลือกเวลาอื่น"
      notifyListeners();
      return null;
    } catch (e) {
      _error = 'จองไม่สำเร็จ: $e';
      notifyListeners();
      return null;
    }
  }

  /// ยกเลิกการจอง (DELETE /api/bookings/:id)
  Future<bool> cancelBooking(String bookingId) async {
    try {
      await ApiClient.delete('/bookings/$bookingId');
      final i = _bookings.indexWhere((b) => b.id == bookingId);
      if (i != -1) {
        final old = _bookings[i];
        _bookings[i] = BookingModel(
          id: old.id,
          userId: old.userId,
          serviceId: old.serviceId,
          serviceName: old.serviceName,
          servicePrice: old.servicePrice,
          staffId: old.staffId,
          bookingDate: old.bookingDate,
          timeSlot: old.timeSlot,
          queueNumber: old.queueNumber,
          status: 'cancelled',
          createdAt: old.createdAt,
        );
        notifyListeners();
      }
      return true;
    } catch (e) {
      _error = 'ยกเลิกไม่สำเร็จ: $e';
      notifyListeners();
      return false;
    }
  }

  /// สถานะคิวของผู้ใช้วันนี้ (GET /api/queue/my)
  Future<Map<String, dynamic>> getQueueStatus() async {
    try {
      final data = await ApiClient.get('/queue/my');
      return Map<String, dynamic>.from(data);
    } catch (e) {
      _error = 'โหลดสถานะคิวไม่สำเร็จ: $e';
      return {'hasQueue': false};
    }
  }

  /// โหลดการแจ้งเตือนของผู้ใช้ (GET /api/notifications)
  Future<void> loadNotifications() async {
    if (_notificationsLoading) return;
    _error = null;
    _notificationsLoading = true;
    notifyListeners();
    try {
      final data = await ApiClient.get('/notifications');
      _notifications = (data as List)
          .map((e) =>
              NotificationModel.fromMap(e['id'], Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      _error = 'โหลดการแจ้งเตือนไม่สำเร็จ: $e';
    } finally {
      _notificationsLoading = false;
      notifyListeners();
    }
  }

  /// กดยืนยันว่าเห็นการแจ้งเตือนแล้ว (POST /api/notifications/:id/confirm)
  /// ทำให้แอดมินรู้ว่าไม่ต้องโทรติดต่อสำรอง
  Future<bool> confirmNotification(String notificationId) async {
    try {
      await ApiClient.post('/notifications/$notificationId/confirm');
      final i = _notifications.indexWhere((n) => n.id == notificationId);
      if (i != -1) {
        final old = _notifications[i];
        _notifications[i] = NotificationModel(
          id: old.id,
          message: old.message,
          confirmed: true,
          createdAt: old.createdAt,
        );
        notifyListeners();
      }
      return true;
    } catch (e) {
      _error = 'ยืนยันไม่สำเร็จ: $e';
      notifyListeners();
      return false;
    }
  }
}
