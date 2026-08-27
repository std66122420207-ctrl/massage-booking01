import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:async';
import '../services/booking_service.dart';
import '../services/notification_service.dart';
import 'services_screen.dart';
import 'my_bookings_screen.dart';
import 'queue_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  Timer? _notificationTimer;

  final _screens = const [
    ServicesScreen(),
    MyBookingsScreen(),
    QueueScreen(),
    ProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final bookingService = context.read<BookingService>();
      bookingService.loadServices();
      bookingService.loadMyBookings();
      bookingService.loadNotifications();
      
      // เริ่มระบบ push notification (ขอ permission + ส่ง FCM token ไป backend)
      NotificationService.init(onMessageReceived: () {
        if (mounted) {
          bookingService.loadNotifications();
          bookingService.loadMyBookings();
        }
      });

      _notificationTimer = Timer.periodic(const Duration(seconds: 15), (_) {
        if (mounted) bookingService.loadNotifications();
      });
    });
  }

  @override
  void dispose() {
    NotificationService.dispose();
    _notificationTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _tab, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        backgroundColor: Colors.white,
        elevation: 4,
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home),
              label: 'หน้าแรก'),
          NavigationDestination(
              icon: Icon(Icons.calendar_today_outlined),
              selectedIcon: Icon(Icons.calendar_today),
              label: 'การจอง'),
          NavigationDestination(
              icon: Icon(Icons.queue_outlined),
              selectedIcon: Icon(Icons.queue),
              label: 'คิว'),
          NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'โปรไฟล์'),
        ],
      ),
    );
  }
}
