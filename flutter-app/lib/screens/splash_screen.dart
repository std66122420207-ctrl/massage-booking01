import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  Future<void> _init() async {
    final auth = context.read<AuthService>();
    // ตรวจสอบ ThaiD callback token ใน URL และ session ที่ค้างอยู่
    await auth.checkAuthState();
    // ดีเลย์เล็กน้อยเพื่อให้เห็น splash screen (ไม่จำเป็นต้องมีถ้าไม่ชอบ)
    await Future.delayed(const Duration(milliseconds: 800));
    if (!mounted) return;
    if (!auth.isLoggedIn) {
      Navigator.pushReplacementNamed(context, '/login');
    } else if (auth.user!.needsPhone) {
      Navigator.pushReplacementNamed(context, '/phone-required');
    } else {
      Navigator.pushReplacementNamed(context, '/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF7A9E7E),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withValues(alpha: 0.12),
                      blurRadius: 12,
                      offset: const Offset(0, 4)),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.asset('assets/images/logo.jpeg',
                      fit: BoxFit.contain),
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Text('นวดแผนไทย',
                style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    fontFamily: 'Sarabun')),
            const SizedBox(height: 8),
            Text('ศูนย์สุขภาพชุมชนท่าวังหิน',
                style: TextStyle(
                    fontSize: 15, color: Colors.white.withValues(alpha: 0.8))),
            const SizedBox(height: 48),
            const CircularProgressIndicator(
                color: Colors.white, strokeWidth: 2),
          ],
        ),
      ),
    );
  }
}
