import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:flutter/foundation.dart';

import '../models/models.dart';
import 'api_client.dart';
import '../utils/thai_mobile_phone.dart';

class AuthService extends ChangeNotifier {
  UserModel? _user;
  bool _loading = false;
  String? _error;

  UserModel? get user => _user;
  bool get loading => _loading;
  bool get isLoggedIn => _user != null;
  String? get error => _error;

  Future<void> checkAuthState() async {
    var current = fb.FirebaseAuth.instance.currentUser;
    if (current == null) {
      _user = null;
      return;
    }

    _setLoading(true);
    try {
      await current.reload();
      current = fb.FirebaseAuth.instance.currentUser;
      if (current == null) {
        _user = null;
        return;
      }
      if (_requiresEmailVerification(current) && !current.emailVerified) {
        await fb.FirebaseAuth.instance.signOut();
        _user = null;
        return;
      }
      _user = await _loadOrCreateProfile(current);
    } finally {
      _setLoading(false);
    }
  }

  Future<void> registerWithEmail({
    required String name,
    required String citizenId,
    required String phone,
    required String email,
    required String password,
  }) async {
    if (!isValidThaiMobilePhone(phone)) {
      throw Exception(
          'กรุณากรอกเบอร์มือถือ 10 หลัก โดยขึ้นต้นด้วย 06, 08 หรือ 09');
    }
    _setLoading(true);
    try {
      final credential =
          await fb.FirebaseAuth.instance.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      final user = credential.user;
      if (user == null) throw Exception('สร้างบัญชีไม่สำเร็จ');

      try {
        await ApiClient.post('/auth/register', {
          'name': name.trim(),
          'citizenId': citizenId.trim(),
          'phone': normalizeThaiMobilePhone(phone),
        });
      } catch (error) {
        try {
          await user.delete();
        } catch (deleteError) {
          await fb.FirebaseAuth.instance.signOut();
          throw Exception(
            'สมัครไม่สำเร็จ และยกเลิกบัญชีที่สร้างไว้ไม่ได้ '
            'กรุณาติดต่อผู้ดูแลระบบ ($deleteError)',
          );
        }
        rethrow;
      }

      try {
        await user.sendEmailVerification();
      } on fb.FirebaseAuthException catch (e) {
        await fb.FirebaseAuth.instance.signOut();
        _user = null;
        throw Exception(
          'สร้างบัญชีแล้ว แต่ส่งลิงก์ยืนยันอีเมลไม่สำเร็จ '
          'กรุณาลองเข้าสู่ระบบอีกครั้งเพื่อส่งลิงก์ใหม่ '
          '(${_mapAuthError(e)})',
        );
      }

      await fb.FirebaseAuth.instance.signOut();
      _user = null;
    } on fb.FirebaseAuthException catch (e) {
      throw Exception(_mapAuthError(e));
    } finally {
      _setLoading(false);
    }
  }

  Future<void> loginWithEmail({
    required String email,
    required String password,
  }) async {
    _setLoading(true);
    try {
      final credential =
          await fb.FirebaseAuth.instance.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      var user = credential.user;
      if (user == null) throw Exception('เข้าสู่ระบบไม่สำเร็จ');

      await user.reload();
      user = fb.FirebaseAuth.instance.currentUser;
      if (user == null) throw Exception('เข้าสู่ระบบไม่สำเร็จ');
      if (_requiresEmailVerification(user) && !user.emailVerified) {
        var resendMessage = 'ส่งลิงก์ยืนยันใหม่ไปยังอีเมลแล้ว';
        try {
          await user.sendEmailVerification();
        } on fb.FirebaseAuthException catch (e) {
          resendMessage = 'ส่งลิงก์ใหม่ไม่สำเร็จ (${_mapAuthError(e)})';
        }
        await fb.FirebaseAuth.instance.signOut();
        _user = null;
        throw Exception('กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ $resendMessage');
      }
      _user = await _loadOrCreateProfile(user);
    } on fb.FirebaseAuthException catch (e) {
      throw Exception(_mapAuthError(e));
    } finally {
      _setLoading(false);
    }
  }

  Future<void> sendPasswordResetEmail(String email) async {
    _setLoading(true);
    try {
      await fb.FirebaseAuth.instance
          .sendPasswordResetEmail(email: email.trim());
    } on fb.FirebaseAuthException catch (e) {
      throw Exception(_mapAuthError(e));
    } finally {
      _setLoading(false);
    }
  }

  Future<void> logout() async {
    await fb.FirebaseAuth.instance.signOut();
    _user = null;
    notifyListeners();
  }

  Future<void> updatePhone(String phone) async {
    if (!isValidThaiMobilePhone(phone)) {
      throw Exception(
          'กรุณากรอกเบอร์มือถือ 10 หลัก โดยขึ้นต้นด้วย 06, 08 หรือ 09');
    }
    final normalizedPhone = normalizeThaiMobilePhone(phone);
    await ApiClient.patch('/auth/me', {'phone': normalizedPhone});
    if (_user != null) {
      _user = _user!.copyWith(phone: normalizedPhone, needsPhone: false);
      notifyListeners();
    }
  }

  Future<UserModel> _loadOrCreateProfile(fb.User user) async {
    final docRef = FirebaseFirestore.instance.collection('users').doc(user.uid);
    final snapshot = await docRef.get();

    if (!snapshot.exists) {
      final profile = <String, dynamic>{
        'uid': user.uid,
        'name': user.displayName ?? 'ผู้ใช้',
        'email': user.email ?? '',
        'phone': user.phoneNumber,
        'role': 'user',
        'loginMethod': user.email == null ? 'phone' : 'email',
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      };
      await docRef.set(profile);
      profile.remove('createdAt');
      profile.remove('updatedAt');
      return UserModel.fromMap(profile);
    }

    final data = snapshot.data()!;
    return UserModel.fromMap({
      ...data,
      'uid': user.uid,
      'email': data['email'] ?? user.email ?? '',
      'phone': data['phone'] ?? user.phoneNumber,
    });
  }

  void _setLoading(bool value) {
    _loading = value;
    if (value) _error = null;
    notifyListeners();
  }

  String _mapAuthError(fb.FirebaseAuthException e) {
    switch (e.code) {
      case 'email-already-in-use':
        return 'อีเมลนี้มีบัญชีอยู่แล้ว';
      case 'invalid-email':
        return 'รูปแบบอีเมลไม่ถูกต้อง';
      case 'weak-password':
        return 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
      case 'user-not-found':
      case 'wrong-password':
      case 'invalid-credential':
        return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      case 'user-disabled':
        return 'บัญชีนี้ถูกระงับการใช้งาน';
      case 'too-many-requests':
        return 'ทำรายการบ่อยเกินไป กรุณาลองใหม่ภายหลัง';
      case 'network-request-failed':
        return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาลองใหม่';
      default:
        return e.message ?? 'เกิดข้อผิดพลาดในการยืนยันตัวตน';
    }
  }

  bool _requiresEmailVerification(fb.User user) {
    return user.providerData
        .any((provider) => provider.providerId == 'password');
  }
}
