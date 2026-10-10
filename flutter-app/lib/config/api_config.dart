import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, kReleaseMode, TargetPlatform;

// ============================================================
//  ตั้งค่า URL ของ backend server (Node.js + Express)
//  แก้ตอน deploy จริง หรือรันทดสอบ local
// ============================================================
class ApiConfig {
  static const String _configuredBaseUrl =
      String.fromEnvironment('API_BASE_URL');

  static String get baseUrl {
    if (_configuredBaseUrl.isNotEmpty) {
      return _configuredBaseUrl.replaceFirst(RegExp(r'/+$'), '');
    }

    if (kIsWeb) {
      final origin = Uri.base;
      final isLocalFlutterDevServer =
          (origin.host == 'localhost' || origin.host == '127.0.0.1') &&
              origin.port != 3000;
      if (isLocalFlutterDevServer) return 'http://localhost:3000/api';
      return '${origin.origin}/api';
    }

    if (kReleaseMode) {
      throw StateError(
        'Set API_BASE_URL to the deployed backend URL when building mobile release.',
      );
    }
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3000/api';
    }
    return 'http://localhost:3000/api';
  }
}
