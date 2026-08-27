import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import '../config/api_config.dart';

/// Thrown when the backend returns a non-2xx response.
/// Carries the Thai error message from the API so the UI can show it directly.
class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);
  @override
  String toString() => message;
}

/// เรียก backend API พร้อมแนบ Firebase ID token อัตโนมัติ (ถ้า login อยู่)
class ApiClient {
  static Future<Map<String, String>> _headers() async {
    final user = FirebaseAuth.instance.currentUser;
    final token = user != null ? await user.getIdToken() : null;
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static dynamic _decode(http.Response res) {
    dynamic body;
    if (res.body.isNotEmpty) {
      try {
        body = jsonDecode(res.body);
      } on FormatException {
        body = null;
      }
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final msg = (body is Map && body['error'] != null)
          ? body['error'].toString()
          : 'เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (${res.statusCode})';
      throw ApiException(res.statusCode, msg);
    }
    return body;
  }

  static Future<dynamic> get(String path) async {
    final res = await http.get(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  static Future<dynamic> post(String path, [Map<String, dynamic>? body]) async {
    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: await _headers(),
      body: body != null ? jsonEncode(body) : null,
    );
    return _decode(res);
  }

  static Future<dynamic> patch(String path,
      [Map<String, dynamic>? body]) async {
    final res = await http.patch(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: await _headers(),
      body: body != null ? jsonEncode(body) : null,
    );
    return _decode(res);
  }

  static Future<dynamic> delete(String path,
      [Map<String, dynamic>? body]) async {
    final res = await http.delete(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: await _headers(),
      body: body != null ? jsonEncode(body) : null,
    );
    return _decode(res);
  }
}
