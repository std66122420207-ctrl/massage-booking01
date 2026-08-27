import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../services/api_client.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // จัดการข้อความเมื่อแอปทำงานอยู่เบื้องหลัง
  debugPrint("Handling a background message: ${message.messageId}");
}

class NotificationService {
  static Future<void> init({VoidCallback? onMessageReceived}) async {
    // ขอสิทธิ์แจ้งเตือนจากผู้ใช้
    FirebaseMessaging messaging = FirebaseMessaging.instance;
    NotificationSettings settings = await messaging.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );

    debugPrint('User granted permission: ${settings.authorizationStatus}');

    // ดึง FCM token
    String? token;
    try {
      if (kIsWeb) {
        token = await messaging.getToken(
            vapidKey: 'YOUR_VAPID_KEY_HERE'); // ใส่ vapidKey ในภายหลัง
      } else {
        token = await messaging.getToken();
      }
      debugPrint('FCM Token: $token');

      if (token != null) {
        await _saveTokenToBackend(token);
      }
    } catch (e) {
      debugPrint('Error getting FCM token: $e');
    }

    // อัพเดท token ใหม่เมื่อมีการเปลี่ยน
    FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
      _saveTokenToBackend(newToken);
    });

    // ฟังข้อความเมื่อแอปทำงานอยู่เบื้องหน้า
    FirebaseMessaging.onMessage.listen((message) {
      _onForegroundMessage(message);
      onMessageReceived?.call();
    });
  }

  static Future<void> _saveTokenToBackend(String token) async {
    try {
      await ApiClient.post('/fcm/token', {'token': token});
    } catch (e) {
      debugPrint('Error saving FCM token: $e');
    }
  }

  static void _onForegroundMessage(RemoteMessage message) {
    debugPrint('Got a message whilst in the foreground!');
    debugPrint('Message data: ${message.data}');

    if (message.notification != null) {
      debugPrint(
          'Message also contained a notification: ${message.notification}');
    }
  }

  static Future<void> removeToken() async {
    try {
      String? token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await ApiClient.delete('/fcm/token', {'token': token});
      }
    } catch (e) {
      debugPrint('Error removing FCM token: $e');
    }
  }

  static void dispose() {
    // ปิดการทำงาน/ล้างข้อมูล ถ้าจำเป็น
  }
}
