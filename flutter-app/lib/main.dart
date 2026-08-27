import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'firebase_options.dart';
import 'services/auth_service.dart';
import 'services/booking_service.dart';
import 'services/notification_service.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/phone_required_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('th');
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // ลงทะเบียน background message handler สำหรับ push notification
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  runApp(const MassageBookingApp());
}

class MassageBookingApp extends StatelessWidget {
  const MassageBookingApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()),
        ChangeNotifierProvider(create: (_) => BookingService()),
      ],
      child: MaterialApp(
        title: 'นวดแผนไทย ท่าวังหิน',
        debugShowCheckedModeBanner: false,
        theme: _buildTheme(),
        home: const SplashScreen(),
        routes: {
          '/login': (_) => const LoginScreen(),
          '/home': (_) => const HomeScreen(),
          '/phone-required': (_) => const PhoneRequiredScreen(),
        },
      ),
    );
  }

  ThemeData _buildTheme() {
    // สีชุดเดียวกับ web-admin (jade/forest) เพื่อให้แบรนด์เป็นอันหนึ่งอันเดียวกัน
    const forest = Color(0xFF1B3A2D);
    const jade = Color(0xFF2E7D52);
    const jadeLight = Color(0xFF4CAF78);
    const mist = Color(0xFFF0F5F2);
    const slate = Color(0xFF64748B);

    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: jade,
        primary: jade,
        secondary: jadeLight,
        surface: Colors.white,
        error: const Color(0xFFA93226),
      ),
      textTheme: GoogleFonts.sarabunTextTheme().copyWith(
        displayLarge: GoogleFonts.notoSerifThai(
            fontSize: 32, fontWeight: FontWeight.w600, color: forest),
        titleLarge: GoogleFonts.notoSerifThai(
            fontSize: 20, fontWeight: FontWeight.w600, color: forest),
        bodyMedium:
            GoogleFonts.sarabun(fontSize: 15, color: const Color(0xFF333333)),
        bodySmall: GoogleFonts.sarabun(fontSize: 13, color: slate),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: GoogleFonts.notoSerifThai(
            fontSize: 18, fontWeight: FontWeight.w600, color: forest),
        iconTheme: const IconThemeData(color: forest),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: jade,
          foregroundColor: Colors.white,
          disabledBackgroundColor: jade.withValues(alpha: 0.4),
          minimumSize: const Size(double.infinity, 52),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: GoogleFonts.notoSerifThai(
              fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: forest,
          side: const BorderSide(color: Color(0xFFE2EAE6)),
          minimumSize: const Size(double.infinity, 52),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: mist,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE2EAE6)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: jade, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFA93226)),
        ),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFFE2EAE6)),
        ),
        margin: EdgeInsets.zero,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: mist,
        labelStyle: GoogleFonts.sarabun(
            fontSize: 12.5, fontWeight: FontWeight.w600, color: forest),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
        side: BorderSide.none,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: forest,
        contentTextStyle:
            GoogleFonts.sarabun(color: Colors.white, fontSize: 14),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      dividerTheme:
          const DividerThemeData(color: Color(0xFFE2EAE6), thickness: 1),
      scaffoldBackgroundColor: mist,
    );
  }
}

/// ── ชุดสีสถานะการจอง ใช้ร่วมกันทั้งแอป ──────────────────────
/// (ให้ตรงกับสถานะฝั่ง server: pending / confirmed / in_service / done / cancelled)
class BookingStatusColors {
  static const Map<String, Color> background = {
    'pending': Color(0xFFFEF9E7),
    'confirmed': Color(0xFFEBF5FB),
    'in_service': Color(0xFFEBF5FB),
    'done': Color(0xFFE8F8F0),
    'cancelled': Color(0xFFFDEDEC),
  };
  static const Map<String, Color> text = {
    'pending': Color(0xFFB7770D),
    'confirmed': Color(0xFF1A6E9E),
    'in_service': Color(0xFF1A6E9E),
    'done': Color(0xFF1E7B4B),
    'cancelled': Color(0xFFA93226),
  };
  static const Map<String, String> label = {
    'pending': 'รอยืนยัน',
    'confirmed': 'ยืนยันแล้ว',
    'in_service': 'กำลังให้บริการ',
    'done': 'นวดเสร็จแล้ว',
    'cancelled': 'ยกเลิก',
  };
}
