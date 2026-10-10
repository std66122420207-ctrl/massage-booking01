import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';

enum _AuthMode { login, register, resetPassword }

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _citizenIdCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmPasswordCtrl = TextEditingController();

  _AuthMode _mode = _AuthMode.login;
  bool _hidePassword = true;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _citizenIdCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmPasswordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthService>();
    try {
      switch (_mode) {
        case _AuthMode.login:
          await auth.loginWithEmail(
            email: _emailCtrl.text,
            password: _passwordCtrl.text,
          );
          if (mounted) Navigator.pushReplacementNamed(context, '/home');
          break;
        case _AuthMode.register:
          await auth.registerWithEmail(
            name: _nameCtrl.text,
            citizenId: _citizenIdCtrl.text,
            phone: _phoneCtrl.text,
            email: _emailCtrl.text,
            password: _passwordCtrl.text,
          );
          if (mounted) Navigator.pushReplacementNamed(context, '/home');
          break;
        case _AuthMode.resetPassword:
          await auth.sendPasswordResetEmail(_emailCtrl.text);
          if (!mounted) return;
          setState(() => _mode = _AuthMode.login);
          _showMessage('ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลแล้ว');
          break;
      }
    } catch (error) {
      if (mounted) _showMessage(error.toString().replaceFirst('Exception: ', ''));
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final isRegister = _mode == _AuthMode.register;
    final isReset = _mode == _AuthMode.resetPassword;

    return Scaffold(
      backgroundColor: const Color(0xFFFAF7F2),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 20),
                    Center(
                      child: Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.1),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        padding: const EdgeInsets.all(12),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.asset('assets/images/logo.jpeg',
                              fit: BoxFit.contain),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'นวดแผนไทย',
                      textAlign: TextAlign.center,
                      style: Theme.of(context)
                          .textTheme
                          .displayLarge
                          ?.copyWith(fontSize: 28),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'ศูนย์สุขภาพชุมชนท่าวังหิน',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, color: Color(0xFF777777)),
                    ),
                    const SizedBox(height: 32),
                    Text(
                      isRegister
                          ? 'สมัครสมาชิก'
                          : isReset
                              ? 'ลืมรหัสผ่าน'
                              : 'เข้าสู่ระบบ',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 20),
                    if (isRegister) ...[
                      _field(
                        _nameCtrl,
                        'ชื่อ-นามสกุล',
                        validator: _required('กรุณากรอกชื่อ-นามสกุล'),
                        keyboardType: TextInputType.name,
                      ),
                      const SizedBox(height: 12),
                      _field(
                        _citizenIdCtrl,
                        'เลขบัตรประชาชน 13 หลัก',
                        keyboardType: TextInputType.number,
                        validator: (value) {
                          final id = (value ?? '').trim();
                          if (!RegExp(r'^\d{13}$').hasMatch(id)) {
                            return 'กรุณากรอกเลขบัตรประชาชน 13 หลัก';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      _field(
                        _phoneCtrl,
                        'เบอร์โทรศัพท์',
                        keyboardType: TextInputType.phone,
                        validator: (value) {
                          final phone = (value ?? '').replaceAll(
                              RegExp(r'[\s-]'), '');
                          if (!RegExp(r'^0\d{8,9}$').hasMatch(phone)) {
                            return 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                    ],
                    _field(
                      _emailCtrl,
                      'Email',
                      keyboardType: TextInputType.emailAddress,
                      validator: (value) {
                        final email = (value ?? '').trim();
                        if (email.isEmpty ||
                            !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
                                .hasMatch(email)) {
                          return 'กรุณากรอกอีเมลให้ถูกต้อง';
                        }
                        return null;
                      },
                    ),
                    if (!isReset) ...[
                      const SizedBox(height: 12),
                      _field(
                        _passwordCtrl,
                        'Password',
                        obscureText: _hidePassword,
                        suffixIcon: IconButton(
                          onPressed: () =>
                              setState(() => _hidePassword = !_hidePassword),
                          icon: Icon(_hidePassword
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined),
                        ),
                        validator: (value) {
                          if ((value ?? '').length < 6) {
                            return 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
                          }
                          return null;
                        },
                      ),
                    ],
                    if (isRegister) ...[
                      const SizedBox(height: 12),
                      _field(
                        _confirmPasswordCtrl,
                        'ยืนยัน Password',
                        obscureText: true,
                        validator: (value) {
                          if (value != _passwordCtrl.text) {
                            return 'รหัสผ่านไม่ตรงกัน';
                          }
                          return null;
                        },
                      ),
                    ],
                    if (_mode == _AuthMode.login)
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: auth.loading
                              ? null
                              : () => setState(
                                  () => _mode = _AuthMode.resetPassword),
                          child: const Text('ลืมรหัสผ่าน?'),
                        ),
                      ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: auth.loading ? null : _submit,
                      child: auth.loading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : Text(
                              isRegister
                                  ? 'สมัครสมาชิก'
                                  : isReset
                                      ? 'ส่งอีเมลตั้งรหัสผ่านใหม่'
                                      : 'เข้าสู่ระบบ',
                            ),
                    ),
                    const SizedBox(height: 12),
                    if (!isReset)
                      TextButton(
                        onPressed: auth.loading
                            ? null
                            : () => setState(() {
                                  _mode = isRegister
                                      ? _AuthMode.login
                                      : _AuthMode.register;
                                }),
                        child: Text(
                          isRegister
                              ? 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ'
                              : 'ยังไม่มีบัญชี? สมัครสมาชิก',
                        ),
                      ),
                    if (isReset)
                      TextButton(
                        onPressed: auth.loading
                            ? null
                            : () => setState(() => _mode = _AuthMode.login),
                        child: const Text('กลับไปเข้าสู่ระบบ'),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  String? Function(String?) _required(String message) {
    return (value) =>
        (value ?? '').trim().isEmpty ? message : null;
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    TextInputType? keyboardType,
    bool obscureText = false,
    Widget? suffixIcon,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        suffixIcon: suffixIcon,
      ),
    );
  }
}
