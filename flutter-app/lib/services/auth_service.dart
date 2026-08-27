import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb;

import '../models/models.dart';
import '../config/api_config.dart';
import 'api_client.dart';

// dart:html เข้าถึงได้เฉพาะบน Flutter Web — โปรเจคนี้ตอนนี้ตั้งค่าไว้สำหรับ
// web เท่านั้น (ดู flutter-app/web/) ถ้าจะเพิ่ม Android/iOS ในอนาคต ต้องแยก
// ธุรกิจ ThaiD login ส่วนนี้ไปใช้ deep link (เช่น app_links package) แทน
// การ redirect ทั้งหน้าเว็บแบบนี้
import 'thaid_web_redirect.dart' if (dart.library.io) 'thaid_stub.dart'
    as thaid;

class AuthService extends ChangeNotifier {
  UserModel? _user;
  bool _loading = false;
  String? _error;

  // เก็บ verificationId ระหว่างขั้นตอนส่ง OTP -> ยืนยัน OTP
  String? _verificationId;
  String? _pendingName;

  UserModel? get user => _user;
  bool get loading => _loading;
  bool get isLoggedIn => _user != null;
  String? get error => _error;

  /// เรียกตอนเปิดแอป: เช็คว่า login ค้างอยู่ไหม (Firebase session)
  /// และเช็ค URL ว่ากลับมาจาก ThaiD callback พร้อม custom token หรือไม่
  Future<void> checkAuthState() async {
    // 1) ถ้ากลับมาจาก ThaiD redirect จะมี token ติดมาใน URL query string
    final thaidToken = thaid.consumeThaidTokenFromUrl();
    if (thaidToken != null) {
      await _signInWithCustomToken(thaidToken, loginMethod: 'thaid');
      return;
    }

    // 2) ถ้ามี Firebase session ค้างอยู่แล้ว (เช่นรีเฟรชหน้าเว็บ)
    final current = fb.FirebaseAuth.instance.currentUser;
    if (current != null) {
      await _loadProfileFromBackend(current, fallbackLoginMethod: 'phone');
    }
  }

  /// Step 1: พาไปหน้า login ของ ThaiD ผ่าน backend (redirect ทั้งหน้า)
  /// Backend จะ redirect กลับมาที่แอปพร้อม custom token ต่อท้าย URL
  /// เมื่อ login สำเร็จ (ดู server/routes/auth.js: /thaid/callback)
  Future<void> loginWithThaiD() async {
    thaid.redirectToThaidLogin('${ApiConfig.baseUrl}/auth/thaid');
    // หน้าเว็บจะถูก redirect ออกไปจากตรงนี้ทันที ฟังก์ชันนี้จะไม่ return ค่าอะไรต่อ
  }

  /// Step 1: ส่ง OTP ไปที่เบอร์โทร (Firebase Phone Auth ของจริง)
  Future<void> sendOTP(String phone) async {
    _error = null;
    _loading = true;
    _verificationId = null;
    notifyListeners();

    final e164Phone = _toE164(phone);
    final completer = Completer<void>();

    try {
      await fb.FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: e164Phone,
        timeout: const Duration(seconds: 60),
        verificationCompleted: (fb.PhoneAuthCredential credential) async {
          try {
            final cred =
                await fb.FirebaseAuth.instance.signInWithCredential(credential);
            if (cred.user != null) {
              await _loadProfileFromBackend(cred.user!,
                  fallbackLoginMethod: 'phone');
            }
          } catch (e) {
            _error = 'ยืนยันอัตโนมัติล้มเหลว: $e';
          }
          _loading = false;
          notifyListeners();
          if (!completer.isCompleted) completer.complete();
        },
        verificationFailed: (fb.FirebaseAuthException e) {
          _error = _mapAuthError(e);
          _loading = false;
          notifyListeners();
          if (!completer.isCompleted) {
            completer.completeError(Exception(_error));
          }
        },
        codeSent: (String verificationId, int? resendToken) {
          _verificationId = verificationId;
          _loading = false;
          notifyListeners();
          if (!completer.isCompleted) completer.complete();
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          _verificationId = verificationId;
        },
      );
    } catch (e) {
      _loading = false;
      _error = e is fb.FirebaseAuthException
          ? _mapAuthError(e)
          : 'เริ่มส่ง OTP ไม่สำเร็จ: $e';
      notifyListeners();
      if (!completer.isCompleted) completer.completeError(Exception(_error));
    }

    return completer.future;
  }

  /// Step 2: ยืนยัน OTP 6 หลัก แล้วบันทึกโปรไฟล์ไปที่ backend
  Future<void> verifyOTP(String otp, String name) async {
    if (_verificationId == null) {
      throw Exception('กรุณาขอ OTP ใหม่อีกครั้ง');
    }
    _loading = true;
    _pendingName = name;
    notifyListeners();

    try {
      final credential = fb.PhoneAuthProvider.credential(
        verificationId: _verificationId!,
        smsCode: otp,
      );
      final userCred =
          await fb.FirebaseAuth.instance.signInWithCredential(credential);
      if (userCred.user == null) {
        throw Exception('เข้าสู่ระบบไม่สำเร็จ');
      }
      await _registerOrLoadProfile(userCred.user!,
          name: name, phone: userCred.user!.phoneNumber ?? '');
    } on fb.FirebaseAuthException catch (e) {
      throw Exception(_mapAuthError(e));
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await fb.FirebaseAuth.instance.signOut();
    _user = null;
    _verificationId = null;
    notifyListeners();
  }

  /// อัปเดตเบอร์โทร — ใช้กับผู้ใช้ที่ login ผ่าน ThaiD ซึ่งไม่ได้กรอกเบอร์ตอน login
  /// (เก็บไว้เป็นเบอร์สำรองให้แอดมินติดต่อกรณีแอปแจ้งเตือนไม่ถึง)
  Future<void> updatePhone(String phone) async {
    await ApiClient.patch('/auth/me', {'phone': phone});
    if (_user != null) {
      _user = UserModel(
        uid: _user!.uid,
        name: _user!.name,
        phone: phone,
        loginMethod: _user!.loginMethod,
        needsPhone: false,
      );
      notifyListeners();
    }
  }

  // ── Helpers ─────────────────────────────────────────────

  Future<void> _signInWithCustomToken(String token,
      {required String loginMethod}) async {
    _loading = true;
    notifyListeners();
    try {
      final cred = await fb.FirebaseAuth.instance.signInWithCustomToken(token);
      if (cred.user != null) {
        await _loadProfileFromBackend(cred.user!,
            fallbackLoginMethod: loginMethod);
      }
    } catch (e) {
      _error = 'เข้าสู่ระบบด้วย ThaiD ไม่สำเร็จ: $e';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// พยายามโหลดโปรไฟล์จาก backend (GET /api/auth/me); ถ้ายังไม่มี ให้สร้างค่าเริ่มต้น
  Future<void> _loadProfileFromBackend(fb.User fbUser,
      {required String fallbackLoginMethod}) async {
    try {
      final data = await ApiClient.get('/auth/me');
      _user = UserModel.fromMap(Map<String, dynamic>.from(data));
    } on ApiException catch (e) {
      if (e.statusCode == 404) {
        // ยังไม่เคยลงทะเบียนโปรไฟล์ — ใช้ข้อมูลเท่าที่มีจาก Firebase ไปก่อน
        _user = UserModel(
          uid: fbUser.uid,
          name: fbUser.displayName ?? _pendingName ?? 'ผู้ใช้',
          phone: fbUser.phoneNumber,
          loginMethod: fallbackLoginMethod,
        );
      } else {
        _error = e.message;
      }
    } catch (e) {
      _error = 'โหลดโปรไฟล์ไม่สำเร็จ: $e';
    }
    notifyListeners();
  }

  /// ลงทะเบียนผู้ใช้ใหม่ (หรืออัปเดตชื่อ) ที่ backend หลัง phone OTP สำเร็จ
  Future<void> _registerOrLoadProfile(fb.User fbUser,
      {required String name, required String phone}) async {
    try {
      await ApiClient.post('/auth/register', {
        'uid': fbUser.uid,
        'name': name,
        'phone': phone,
      });
      _user = UserModel(
          uid: fbUser.uid, name: name, phone: phone, loginMethod: 'phone');
    } catch (e) {
      _error = 'บันทึกโปรไฟล์ไม่สำเร็จ: $e';
      // ยังให้ user ใช้แอปต่อได้ด้วยข้อมูลจาก Firebase แม้ backend จะพลาด
      _user = UserModel(
          uid: fbUser.uid, name: name, phone: phone, loginMethod: 'phone');
    }
    notifyListeners();
  }

  String _toE164(String phone) {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('0')) return '+66${digits.substring(1)}'; // เบอร์ไทย
    if (phone.startsWith('+')) return phone;
    return '+66$digits';
  }

  String _mapAuthError(fb.FirebaseAuthException e) {
    switch (e.code) {
      case 'app-not-authorized':
        return 'โดเมนนี้ยังไม่ได้อนุญาตใน Firebase Authentication';
      case 'captcha-check-failed':
        return 'ยืนยัน reCAPTCHA ไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองใหม่';
      case 'quota-exceeded':
        return 'โควตาส่ง SMS หมดชั่วคราว กรุณาลองใหม่ภายหลัง';
      case 'invalid-phone-number':
        return 'เบอร์โทรศัพท์ไม่ถูกต้อง';
      case 'invalid-verification-code':
        return 'รหัส OTP ไม่ถูกต้อง';
      case 'session-expired':
        return 'รหัส OTP หมดอายุ กรุณาขอใหม่';
      case 'too-many-requests':
        return 'ขอ OTP บ่อยเกินไป กรุณาลองใหม่ภายหลัง';
      default:
        return e.message ?? 'เกิดข้อผิดพลาดในการยืนยันตัวตน';
    }
  }
}
