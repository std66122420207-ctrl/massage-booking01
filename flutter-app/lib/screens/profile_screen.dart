import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    const navy = Color(0xFF2D3B6B);
    const sage = Color(0xFF7A9E7E);

    return Scaffold(
      appBar: AppBar(title: const Text('โปรไฟล์')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04), blurRadius: 8)
              ],
            ),
            child: Column(children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  gradient:
                      const LinearGradient(colors: [sage, Color(0xFF5A8A5E)]),
                  borderRadius: BorderRadius.circular(36),
                ),
                child: const Icon(Icons.person, color: Colors.white, size: 36),
              ),
              const SizedBox(height: 14),
              Text(auth.user?.name ?? 'ผู้ใช้',
                  style: const TextStyle(
                      fontFamily: 'Sarabun',
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: navy)),
              const SizedBox(height: 4),
              auth.user?.loginMethod == 'thaid'
                  ? const Row(mainAxisSize: MainAxisSize.min, children: [
                      Text('ยืนยันตัวตนด้วย ThaiD',
                          style: TextStyle(
                              fontSize: 12, color: Color(0xFF777777))),
                      SizedBox(width: 4),
                      Icon(Icons.verified, size: 14, color: sage),
                    ])
                  : const Text('ล็อกอินด้วยเบอร์โทร',
                      style: TextStyle(fontSize: 12, color: Color(0xFF777777))),
            ]),
          ),
          const SizedBox(height: 16),
          _section('ข้อมูลส่วนตัว', [
            _row('เบอร์โทร', auth.user?.phone ?? '-'),
            _row('วิธีเข้าสู่ระบบ',
                auth.user?.loginMethod == 'thaid' ? 'ThaiD' : 'เบอร์โทรศัพท์'),
          ]),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () async {
                await context.read<AuthService>().logout();
                if (context.mounted) {
                  Navigator.pushNamedAndRemoveUntil(
                      context, '/login', (_) => false);
                }
              },
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 50),
                side: const BorderSide(color: Color(0xFFE0E0E0)),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.logout_outlined, size: 19),
                  SizedBox(width: 8),
                  Text('ออกจากระบบ',
                      style: TextStyle(color: Color(0xFF777777))),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _section(String title, List<Widget> rows) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.04), blurRadius: 8)
          ],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title.toUpperCase(),
              style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF999999),
                  letterSpacing: 0.5)),
          const SizedBox(height: 12),
          ...rows,
        ]),
      );

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(children: [
          Text(label,
              style: const TextStyle(fontSize: 14, color: Color(0xFF777777))),
          const Spacer(),
          Text(value,
              style:
                  const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
        ]),
      );
}
