import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  bool _otpSent = false;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _nameCtrl.dispose();
    _otpCtrl.dispose();
    super.dispose();
  }

  Future<void> _sendOTP() async {
    final phone = _phoneCtrl.text.trim();
    final name = _nameCtrl.text.trim();
    if (phone.isEmpty || name.isEmpty) {
      _showSnack('กรุณากรอกชื่อและเบอร์โทร');
      return;
    }
    try {
      await context.read<AuthService>().sendOTP(phone);
      setState(() => _otpSent = true);
    } catch (e) {
      _showSnack('ส่ง OTP ไม่สำเร็จ: $e');
    }
  }

  Future<void> _verifyOTP() async {
    try {
      await context
          .read<AuthService>()
          .verifyOTP(_otpCtrl.text.trim(), _nameCtrl.text.trim());
      if (mounted) Navigator.pushReplacementNamed(context, '/home');
    } catch (e) {
      _showSnack(
          'ยืนยัน OTP ไม่สำเร็จ: ${e.toString().replaceFirst('Exception: ', '')}');
    }
  }

  void _showSnack(String msg) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    const sage = Color(0xFF7A9E7E);
    const navy = Color(0xFF2D3B6B);

    return Scaffold(
      backgroundColor: const Color(0xFFFAF7F2),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: Column(children: [
            const SizedBox(height: 40),

            // Logo
            Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 10,
                      offset: const Offset(0, 3)),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.asset('assets/images/logo.jpeg',
                      fit: BoxFit.contain),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text('นวดแผนไทย',
                style: Theme.of(context)
                    .textTheme
                    .displayLarge
                    ?.copyWith(fontSize: 28)),
            const SizedBox(height: 6),
            const Text('ศูนย์สุขภาพชุมชนท่าวังหิน',
                style: TextStyle(fontSize: 14, color: Color(0xFF777777))),
            const SizedBox(height: 48),

            // ThaiD Button
            _buildButton(
              onTap: () => context.read<AuthService>().loginWithThaiD(),
              color: navy,
              icon: Icons.badge_outlined,
              label: 'เข้าสู่ระบบด้วย ThaiD',
            ),
            const SizedBox(height: 16),

            // Divider
            Row(children: [
              const Expanded(child: Divider()),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text('หรือ',
                    style:
                        TextStyle(color: Colors.grey.shade500, fontSize: 13)),
              ),
              const Expanded(child: Divider()),
            ]),
            const SizedBox(height: 16),

            // Phone form
            if (!_otpSent) ...[
              _field(_nameCtrl, 'ชื่อ-นามสกุล', TextInputType.name),
              const SizedBox(height: 12),
              _field(_phoneCtrl, 'เบอร์โทรศัพท์', TextInputType.phone),
              const SizedBox(height: 20),
              _buildButton(
                onTap: auth.loading ? null : _sendOTP,
                color: sage,
                icon: Icons.sms_outlined,
                label: auth.loading ? 'กำลังส่ง OTP...' : 'รับ OTP',
              ),
            ] else ...[
              Text('กรอกรหัส OTP ที่ได้รับ',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
              const SizedBox(height: 12),
              _field(_otpCtrl, 'รหัส OTP 6 หลัก', TextInputType.number),
              const SizedBox(height: 20),
              _buildButton(
                onTap: auth.loading ? null : _verifyOTP,
                color: sage,
                icon: Icons.check_circle_outline,
                label: auth.loading ? 'กำลังตรวจสอบ...' : 'ยืนยัน OTP',
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => setState(() => _otpSent = false),
                child: const Text('เปลี่ยนเบอร์โทร'),
              ),
            ],
          ]),
        ),
      ),
    );
  }

  Widget _field(TextEditingController ctrl, String hint, TextInputType type) =>
      TextField(
        controller: ctrl,
        keyboardType: type,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(color: Color(0xFFAAAAAA)),
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFE0E8E0)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFE0E8E0)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF7A9E7E), width: 2),
          ),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
      );

  Widget _buildButton(
          {required VoidCallback? onTap,
          required Color color,
          required IconData icon,
          required String label}) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            color: onTap == null ? Colors.grey.shade300 : color,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Text(label,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'Sarabun')),
          ]),
        ),
      );
}
