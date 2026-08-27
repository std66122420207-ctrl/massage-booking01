import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

// ══ Phone Required Screen ══════════════════════════════════════
// แสดงหลัง login ผ่าน ThaiD ถ้ายังไม่มีเบอร์โทรในระบบ — เก็บไว้เป็นเบอร์สำรอง
// ให้แอดมินโทรติดต่อได้เองกรณีแอปแจ้งเตือนไม่ถึง (ตามสเปคที่กำหนด)
class PhoneRequiredScreen extends StatefulWidget {
  const PhoneRequiredScreen({super.key});
  @override
  State<PhoneRequiredScreen> createState() => _PhoneRequiredScreenState();
}

class _PhoneRequiredScreenState extends State<PhoneRequiredScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context
          .read<AuthService>()
          .updatePhone(_phoneController.text.trim());
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/home');
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const sage = Color(0xFF7A9E7E);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.phone_android, size: 56, color: sage),
                const SizedBox(height: 20),
                const Text(
                  'ขอเบอร์โทรศัพท์ของคุณ',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 10),
                const Text(
                  'เก็บไว้เป็นช่องทางสำรอง เผื่อกรณีแอปแจ้งเตือนไม่ถึงคุณ '
                  'เจ้าหน้าที่จะได้โทรติดต่อได้',
                  style: TextStyle(color: Colors.grey, height: 1.4),
                ),
                const SizedBox(height: 28),
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'เบอร์โทรศัพท์',
                    hintText: '0812345678',
                    prefixIcon: Icon(Icons.phone),
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) {
                    final digits = (v ?? '').replaceAll(RegExp(r'\D'), '');
                    if (!RegExp(r'^0\d{8,9}$').hasMatch(digits)) {
                      return 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง';
                    }
                    return null;
                  },
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!,
                      style: const TextStyle(color: Colors.red, fontSize: 13)),
                ],
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: sage,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: _loading ? null : _submit,
                    child: _loading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.save_outlined, size: 18),
                              SizedBox(width: 8),
                              Text('ยืนยัน'),
                            ],
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
