// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use
// ใช้เฉพาะตอน build เป็น Flutter Web (import แบบมีเงื่อนไขใน auth_service.dart)
import 'dart:html' as html;

/// Redirect ทั้งหน้าไปที่ backend เพื่อเริ่ม ThaiD OAuth flow
void redirectToThaidLogin(String thaidLoginUrl) {
  html.window.location.href = thaidLoginUrl;
}

/// เมื่อ ThaiD login สำเร็จ, server จะ redirect กลับมาที่แอปพร้อม query
/// param ?thaid_token=... (ดู server/routes/auth.js -> /thaid/callback)
/// ฟังก์ชันนี้อ่านค่านั้นออกมาแล้วลบออกจาก URL (ไม่ให้ token ค้างอยู่ใน
/// address bar / browser history)
String? consumeThaidTokenFromUrl() {
  final uri = Uri.parse(html.window.location.href);
  final token = uri.queryParameters['thaid_token'];
  if (token == null) return null;

  final cleanUri = uri.replace(queryParameters: {
    for (final entry in uri.queryParameters.entries)
      if (entry.key != 'thaid_token') entry.key: entry.value,
  });
  html.window.history.replaceState(null, '', cleanUri.toString());
  return token;
}
