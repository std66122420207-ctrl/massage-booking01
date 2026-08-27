import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/booking_service.dart';
import '../models/models.dart';

class MyBookingsScreen extends StatefulWidget {
  const MyBookingsScreen({super.key});
  @override
  State<MyBookingsScreen> createState() => _MyBookingsScreenState();
}

class _MyBookingsScreenState extends State<MyBookingsScreen> {
  bool _showUpcoming = true;
  static const navy = Color(0xFF2D3B6B);

  @override
  Widget build(BuildContext context) {
    final all = context.watch<BookingService>().bookings;
    final upcoming = all
        .where((b) => b.status == 'pending' || b.status == 'confirmed')
        .toList();
    final history = all
        .where((b) => b.status == 'done' || b.status == 'cancelled')
        .toList();
    final list = _showUpcoming ? upcoming : history;

    return Scaffold(
      appBar: AppBar(title: const Text('การจองของฉัน')),
      body: RefreshIndicator(
        onRefresh: () => context.read<BookingService>().loadMyBookings(),
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: const Color(0xFFEEF4EE),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(children: [
                Expanded(
                    child: _tabBtn(
                        Icons.schedule_outlined,
                        'ที่รออยู่',
                        _showUpcoming,
                        () => setState(() => _showUpcoming = true))),
                Expanded(
                    child: _tabBtn(
                        Icons.history_outlined,
                        'ประวัติ',
                        !_showUpcoming,
                        () => setState(() => _showUpcoming = false))),
              ]),
            ),
            const SizedBox(height: 16),
            if (list.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 60),
                child: Center(
                  child: Column(children: [
                    Icon(
                        _showUpcoming
                            ? Icons.event_busy_outlined
                            : Icons.history_outlined,
                        size: 48,
                        color: Colors.grey.shade400),
                    const SizedBox(height: 12),
                    Text(_showUpcoming ? 'ยังไม่มีการจอง' : 'ยังไม่มีประวัติ',
                        style: TextStyle(
                            color: Colors.grey.shade500, fontSize: 14)),
                  ]),
                ),
              )
            else
              ...list.map((b) => _BookingCard(booking: b)),
          ],
        ),
      ),
    );
  }

  Widget _tabBtn(
          IconData icon, String label, bool active, VoidCallback onTap) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: active ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            boxShadow: active
                ? [
                    BoxShadow(
                        color: Colors.black.withValues(alpha: 0.06),
                        blurRadius: 6)
                  ]
                : [],
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 17, color: active ? navy : Colors.grey.shade500),
            const SizedBox(width: 6),
            Text(label,
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontFamily: 'Sarabun',
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: active ? navy : Colors.grey.shade500)),
          ]),
        ),
      );
}

class _BookingCard extends StatelessWidget {
  final BookingModel booking;
  const _BookingCard({required this.booking});

  static const _statusColor = {
    'pending': Color(0xFFFFF3CD),
    'confirmed': Color(0xFFD1E7DD),
    'in_service': Color(0xFFCFE2FF),
    'done': Color(0xFFE2E3E5),
    'cancelled': Color(0xFFF8D7DA),
  };
  static const _statusText = {
    'pending': Color(0xFF856404),
    'confirmed': Color(0xFF0F5132),
    'in_service': Color(0xFF084298),
    'done': Color(0xFF41464B),
    'cancelled': Color(0xFF842029),
  };

  Future<void> _confirmCancel(BuildContext context) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('ยกเลิกการจอง'),
        content: Text('ต้องการยกเลิกคิว ${booking.queueNumber} ใช่หรือไม่?'),
        actions: [
          TextButton.icon(
            onPressed: () => Navigator.pop(context, false),
            icon: const Icon(Icons.close),
            label: const Text('ไม่'),
          ),
          TextButton.icon(
            onPressed: () => Navigator.pop(context, true),
            icon: const Icon(Icons.delete_outline, color: Colors.red),
            label: const Text('ยกเลิก', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (ok == true && context.mounted) {
      await context.read<BookingService>().cancelBooking(booking.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canCancel =
        booking.status == 'pending' || booking.status == 'confirmed';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2))
        ],
      ),
      child: Row(children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
                colors: [Color(0xFF7A9E7E), Color(0xFF5A8A5E)]),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
              child: Text(booking.queueNumber,
                  style: const TextStyle(
                      fontFamily: 'Sarabun',
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      fontSize: 14))),
        ),
        const SizedBox(width: 14),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(booking.serviceName,
              style: const TextStyle(
                  fontFamily: 'Sarabun',
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF2D3B6B))),
          const SizedBox(height: 3),
          Text('${booking.bookingDate} · ${booking.timeSlot} น.',
              style: const TextStyle(fontSize: 12, color: Color(0xFF777777))),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: _statusColor[booking.status] ?? Colors.grey.shade200,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(booking.statusLabel,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: _statusText[booking.status] ?? Colors.black)),
          ),
          if (canCancel) ...[
            const SizedBox(height: 6),
            TextButton.icon(
              onPressed: () => _confirmCancel(context),
              icon: const Icon(Icons.cancel_outlined,
                  size: 15, color: Colors.red),
              label: const Text('ยกเลิก',
                  style: TextStyle(fontSize: 11, color: Colors.red)),
              style: TextButton.styleFrom(
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
          ],
        ]),
      ]),
    );
  }
}
