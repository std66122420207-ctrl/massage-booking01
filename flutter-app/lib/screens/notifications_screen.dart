import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../services/booking_service.dart';
import '../models/models.dart';

// ══ Notifications Screen ═══════════════════════════════════════
// รายการแจ้งเตือน (เช่น "ถึงคิวของคุณแล้ว") พร้อมปุ่มกดยืนยันว่าเห็นแล้ว
// การกดยืนยันจะส่งผลกลับไปให้แอดมินเห็นสถานะ ไม่ต้องโทรติดต่อสำรอง
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _initialLoading = true;
  bool _refreshing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  Future<void> _load() async {
    if (_refreshing) return;
    setState(() => _refreshing = true);
    await context.read<BookingService>().loadNotifications();
    if (mounted) {
      setState(() {
        _initialLoading = false;
        _refreshing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    const sage = Color(0xFF7A9E7E);
    final notifications = context.watch<BookingService>().notifications;

    return Scaffold(
      appBar: AppBar(
        title: const Text('การแจ้งเตือน'),
        actions: [
          IconButton(
            tooltip: 'รีเฟรชการแจ้งเตือน',
            onPressed: _refreshing ? null : _load,
            icon: const Icon(Icons.refresh_outlined),
          ),
        ],
      ),
      body: _initialLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: notifications.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        Icon(Icons.notifications_none_outlined,
                            size: 52, color: Colors.grey),
                        SizedBox(height: 12),
                        Center(
                            child: Text('ยังไม่มีการแจ้งเตือน',
                                style: TextStyle(color: Colors.grey))),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: notifications.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, i) => _NotificationCard(
                        notification: notifications[i],
                        sage: sage,
                      ),
                    ),
            ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  final NotificationModel notification;
  final Color sage;
  const _NotificationCard({required this.notification, required this.sage});

  @override
  Widget build(BuildContext context) {
    final time = notification.createdAt != null
        ? DateFormat('d MMM HH:mm', 'th').format(notification.createdAt!)
        : '';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: notification.confirmed
            ? Colors.white
            : sage.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: notification.confirmed
              ? Colors.grey.shade200
              : sage.withValues(alpha: 0.4),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            notification.confirmed
                ? Icons.check_circle
                : Icons.notifications_active,
            color: notification.confirmed ? Colors.grey : sage,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(notification.message,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(time,
                    style:
                        TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                if (!notification.confirmed) ...[
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 36,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: sage,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () async {
                        final ok = await context
                            .read<BookingService>()
                            .confirmNotification(notification.id);
                        if (context.mounted && !ok) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content:
                                    Text('ยืนยันไม่สำเร็จ ลองใหม่อีกครั้ง')),
                          );
                        }
                      },
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.done, size: 17),
                          SizedBox(width: 6),
                          Text('รับทราบแล้ว'),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
