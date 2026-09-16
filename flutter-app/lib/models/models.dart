// ── Helper: แปลง Firestore Timestamp ที่ผ่าน REST API มา ────
// เมื่อ Express ส่ง Firestore Timestamp กลับเป็น JSON จะได้รูปแบบ
// {_seconds, _nanoseconds} (ไม่ใช่ object ที่มี .toDate() เหมือนตอนเรียก
// Firestore SDK ตรงๆ) ต้องแปลงเอง ไม่งั้นจะ error ตอนรันจริง
DateTime? _parseFirestoreTimestamp(dynamic value) {
  if (value == null) return null;
  if (value is Map && value['_seconds'] != null) {
    return DateTime.fromMillisecondsSinceEpoch(
        (value['_seconds'] as int) * 1000);
  }
  if (value is String) return DateTime.tryParse(value);
  return null;
}

// ── models/service_model.dart ──────────────────────────────
class ServiceModel {
  final String id;
  final String name;
  final int duration; // นาที
  final int price; // บาท
  final String description;

  const ServiceModel({
    required this.id,
    required this.name,
    required this.duration,
    required this.price,
    required this.description,
  });

  factory ServiceModel.fromMap(String id, Map<String, dynamic> m) {
    return ServiceModel(
      id: id,
      name: m['name'] ?? '',
      duration: m['duration'] ?? 60,
      price: m['price'] ?? 0,
      description: m['description'] ?? '',
    );
  }
}

class StaffModel {
  final String id;
  final String name;
  final String status;
  final String? photo;
  final String experience;

  const StaffModel({
    required this.id,
    required this.name,
    required this.status,
    this.photo,
    this.experience = '',
  });

  factory StaffModel.fromMap(String id, Map<String, dynamic> m) {
    return StaffModel(
      id: id,
      name: m['name'] ?? '',
      status: m['status'] ?? 'available',
      photo: m['photo'],
      experience: m['experience'] ?? '',
    );
  }

  String get statusLabel {
    const labels = {
      'available': 'ว่าง',
      'busy': 'ไม่ว่าง',
      'break': 'หยุด',
      'off': 'ลา',
    };
    return labels[status] ?? status;
  }
}

// ── models/booking_model.dart ──────────────────────────────
class BookingModel {
  final String id;
  final String userId;
  final String serviceId;
  final String serviceName;
  final int servicePrice;
  final String? staffId;
  final String? staffName;
  final String bookingDate; // yyyy-MM-dd
  final String timeSlot; // HH:mm
  final String queueNumber; // A001
  final String status; // pending|confirmed|in_service|done|cancelled
  final DateTime? createdAt;

  const BookingModel({
    required this.id,
    required this.userId,
    required this.serviceId,
    required this.serviceName,
    required this.servicePrice,
    this.staffId,
    this.staffName,
    required this.bookingDate,
    required this.timeSlot,
    required this.queueNumber,
    required this.status,
    this.createdAt,
  });

  factory BookingModel.fromMap(String id, Map<String, dynamic> m) {
    return BookingModel(
      id: id,
      userId: m['userId'] ?? '',
      serviceId: m['serviceId'] ?? '',
      serviceName: m['serviceName'] ?? '',
      servicePrice: m['servicePrice'] ?? 0,
      staffId: m['staffId'],
      staffName: m['staffName'],
      bookingDate: m['bookingDate'] ?? '',
      timeSlot: m['timeSlot'] ?? '',
      queueNumber: m['queueNumber'] ?? '',
      status: m['status'] ?? 'pending',
      createdAt: _parseFirestoreTimestamp(m['createdAt']),
    );
  }

  String get statusLabel {
    const map = {
      'pending': 'รอยืนยัน',
      'confirmed': 'ยืนยันแล้ว',
      'in_service': 'กำลังให้บริการ',
      'done': 'เสร็จแล้ว',
      'cancelled': 'ยกเลิก',
    };
    return map[status] ?? status;
  }
}

// ── models/user_model.dart ─────────────────────────────────
class UserModel {
  final String uid;
  final String name;
  final String? phone;
  final String loginMethod; // thaid | phone
  final bool needsPhone; // true ถ้ายังไม่มีเบอร์โทร (เช่น login ผ่าน ThaiD)

  const UserModel({
    required this.uid,
    required this.name,
    this.phone,
    required this.loginMethod,
    this.needsPhone = false,
  });

  factory UserModel.fromMap(Map<String, dynamic> m) {
    return UserModel(
      uid: m['uid'] ?? '',
      name: m['name'] ?? '',
      phone: m['phone'],
      loginMethod: m['loginMethod'] ?? 'phone',
      needsPhone: m['needsPhone'] ?? (m['phone'] == null),
    );
  }
}

// ── models/notification_model.dart ─────────────────────────
// การแจ้งเตือน (เช่น "ถึงคิวของคุณแล้ว") ที่ต้องกดยืนยันว่าเห็นแล้ว
// เพื่อให้แอดมินรู้ว่าไม่ต้องโทรติดต่อสำรอง
class NotificationModel {
  final String id;
  final String message;
  final bool confirmed;
  final DateTime? createdAt;

  const NotificationModel({
    required this.id,
    required this.message,
    required this.confirmed,
    this.createdAt,
  });

  factory NotificationModel.fromMap(String id, Map<String, dynamic> m) {
    return NotificationModel(
      id: id,
      message: m['message'] ?? '',
      confirmed: m['confirmed'] ?? false,
      createdAt: _parseFirestoreTimestamp(m['createdAt']),
    );
  }
}
