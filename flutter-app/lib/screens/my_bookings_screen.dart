import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
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
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final upcoming = all
        .where((b) =>
            b.bookingDate.compareTo(today) >= 0 &&
            (b.status == 'pending' ||
                b.status == 'confirmed' ||
                b.status == 'auto_called' ||
                b.status == 'in_service'))
        .toList()
      ..sort((a, b) {
        final dateOrder = a.bookingDate.compareTo(b.bookingDate);
        return dateOrder != 0 ? dateOrder : a.timeSlot.compareTo(b.timeSlot);
      });
    final activeStatuses = [
      'pending',
      'confirmed',
      'auto_called',
      'in_service',
    ];
    final history = all.where((b) {
      final isFinished = b.status == 'done' || b.status == 'cancelled';
      final isExpiredActive = b.bookingDate.compareTo(today) < 0 &&
          activeStatuses.contains(b.status);
      return isFinished || isExpiredActive;
    }).toList();
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
                        'จองล่วงหน้า',
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
    'auto_called': Color(0xFFFFE5C2),
    'in_service': Color(0xFFCFE2FF),
    'done': Color(0xFFE2E3E5),
    'cancelled': Color(0xFFF8D7DA),
  };
  static const _statusText = {
    'pending': Color(0xFF856404),
    'confirmed': Color(0xFF0F5132),
    'auto_called': Color(0xFF8A4B08),
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
    if (ok != true || !context.mounted) return;

    final bookingService = context.read<BookingService>();
    final cancelled = await bookingService.cancelBooking(booking.id);
    if (!context.mounted) return;
    if (cancelled) await bookingService.loadMyBookings();
    if (!context.mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(cancelled
            ? 'ยกเลิกคิว ${booking.queueNumber} สำเร็จแล้ว'
            : bookingService.error ?? 'ยกเลิกคิวไม่สำเร็จ กรุณาลองอีกครั้ง'),
        backgroundColor: cancelled ? Colors.green : Colors.red,
      ),
    );
  }

  void _showDetails(BuildContext context) {
    final date = DateTime.tryParse(booking.bookingDate);
    final formattedDate = date == null
        ? booking.bookingDate
        : DateFormat('dd/MM/yyyy').format(date);
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('รายละเอียดการจอง'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _detailRow('หมายเลขคิว', booking.queueNumber),
            _detailRow('บริการ', booking.serviceName),
            _detailRow('วันที่', formattedDate),
            _detailRow('เวลา', '${booking.timeSlot} น.'),
            _detailRow('หมอนวด', booking.staffName ?? '-'),
            _detailRow('สิทธิการรักษา', _rightLabel(booking.healthcareRight)),
            _detailRow('ค่าบริการ', '${booking.servicePrice} บาท'),
            _detailRow('สถานะ', booking.statusLabel),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('ปิด'),
          ),
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
            width: 112,
            child: Text(label, style: const TextStyle(color: Colors.black54)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
        ]),
      );

  String _rightLabel(String right) =>
      const {
        'universal': 'บัตรทอง',
        'social_security': 'ประกันสังคม',
        'direct': 'จ่ายตรง / ชำระเอง',
      }[right] ??
      right;

  @override
  Widget build(BuildContext context) {
    final canCancel =
        ['pending', 'confirmed', 'auto_called'].contains(booking.status);

    return GestureDetector(
      onTap: () => _showDetails(context),
      child: Container(
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
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
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
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(booking.serviceName,
                      style: const TextStyle(
                          fontFamily: 'Sarabun',
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF2D3B6B))),
                  const SizedBox(height: 3),
                  Text('${booking.bookingDate} · ${booking.timeSlot} น.',
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF777777))),
                ])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
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
            ]),
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right, color: Color(0xFF829086)),
          ]),
          const Divider(height: 22),
          Row(children: [
            Expanded(
              child: TextButton.icon(
                onPressed: () => _showDetails(context),
                icon: const Icon(Icons.receipt_long_outlined, size: 17),
                label: const Text('ดูรายละเอียด'),
                style: TextButton.styleFrom(alignment: Alignment.centerLeft),
              ),
            ),
            if (canCancel)
              TextButton.icon(
                onPressed: () => _confirmCancel(context),
                icon: const Icon(Icons.cancel_outlined,
                    size: 17, color: Colors.red),
                label: const Text('ยกเลิกคิว',
                    style: TextStyle(color: Colors.red)),
              ),
          ]),
        ]),
      ),
    );
  }
}
