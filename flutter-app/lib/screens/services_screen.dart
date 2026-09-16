import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:intl/intl.dart';
import '../services/booking_service.dart';
import '../services/auth_service.dart';
import '../models/models.dart';
import 'notifications_screen.dart';

// ══ Services Screen ══════════════════════════════════════════
class ServicesScreen extends StatelessWidget {
  const ServicesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final booking = context.watch<BookingService>();
    final services = booking.services;
    const sage = Color(0xFF7A9E7E);
    const navy = Color(0xFF2D3B6B);

    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE0E8E0)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child:
                    Image.asset('assets/images/logo.jpeg', fit: BoxFit.contain),
              ),
            ),
          ),
          const SizedBox(width: 10),
          const Text('ท่าวังหิน'),
        ]),
        actions: [
          Stack(
            alignment: Alignment.topRight,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined),
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => const NotificationsScreen()),
                ),
              ),
              if (context.watch<BookingService>().unconfirmedCount > 0)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                        color: Colors.red, shape: BoxShape.circle),
                    constraints:
                        const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      '${context.watch<BookingService>().unconfirmedCount}',
                      style: const TextStyle(color: Colors.white, fontSize: 10),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Greeting banner
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [sage, Color(0xFF5A8A5E)]),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(children: [
              Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('สวัสดี, ${auth.user?.name ?? 'คุณ'}',
                          style: const TextStyle(
                              color: Colors.white, fontSize: 14)),
                      const SizedBox(height: 4),
                      const Text('เลือกบริการนวดวันนี้',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                              fontFamily: 'Sarabun')),
                    ]),
              ),
              const Icon(Icons.spa_outlined, size: 48, color: Colors.white24),
            ]),
          ),
          const SizedBox(height: 24),
          const Text('บริการของเรา',
              style: TextStyle(
                  fontFamily: 'Sarabun',
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: navy)),
          const SizedBox(height: 12),

          if (services.isEmpty)
            _ServiceLoadState(error: booking.error)
          else
            ...services.map((s) => _ServiceCard(service: s)),
        ],
      ),
    );
  }
}

// Fallback เมื่อยังโหลดไม่เสร็จหรือ offline
class _ServiceLoadState extends StatelessWidget {
  final String? error;
  const _ServiceLoadState({this.error});

  @override
  Widget build(BuildContext context) => Center(
        child: Column(children: [
          const SizedBox(height: 32),
          Icon(Icons.cloud_off_outlined, size: 42, color: Colors.grey.shade400),
          const SizedBox(height: 10),
          Text(error ?? 'ยังไม่มีบริการเปิดให้จอง',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600)),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => context.read<BookingService>().loadServices(),
            icon: const Icon(Icons.refresh),
            label: const Text('ลองโหลดใหม่'),
          ),
        ]),
      );
}

// ── Service Card ─────────────────────────────────────────────
class _ServiceCard extends StatelessWidget {
  final ServiceModel service;
  const _ServiceCard({required this.service});

  @override
  Widget build(BuildContext context) {
    const sage = Color(0xFF7A9E7E);
    const navy = Color(0xFF2D3B6B);

    return GestureDetector(
      onTap: () => showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        builder: (_) => BookingSheet(service: service),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border:
              const Border.fromBorderSide(BorderSide(color: Color(0xFFE0E8E0))),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2))
          ],
        ),
        child: Row(children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: const Color(0xFFEEF4EE),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Center(
              child: Icon(_serviceIcon(service.name), size: 28, color: sage),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(service.name,
                    style: const TextStyle(
                        fontFamily: 'Sarabun',
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: navy)),
                const SizedBox(height: 3),
                Text(service.description,
                    style: const TextStyle(
                        fontSize: 12, color: Color(0xFF777777))),
              ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('${service.price} ฿',
                style: const TextStyle(
                    fontFamily: 'Sarabun',
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: sage)),
            Text('${service.duration} นาที',
                style: const TextStyle(fontSize: 11, color: Color(0xFF999999))),
          ]),
        ]),
      ),
    );
  }

  IconData _serviceIcon(String name) {
    if (name.contains('หินร้อน')) return Icons.local_fire_department_outlined;
    if (name.contains('เท้า')) return Icons.directions_walk_outlined;
    if (name.contains('กัวชา')) return Icons.health_and_safety_outlined;
    return Icons.accessibility_new_outlined;
  }
}

// ══ Booking Bottom Sheet ═════════════════════════════════════
class BookingSheet extends StatefulWidget {
  final ServiceModel service;
  const BookingSheet({super.key, required this.service});
  @override
  State<BookingSheet> createState() => _BookingSheetState();
}

class _BookingSheetState extends State<BookingSheet> {
  DateTime _selected = DateTime.now();
  String? _timeSlot;
  String? _staffId;
  bool _submitting = false;

  final _times = [
    '09:00',
    '09:30',
    '10:00',
    '10:30',
    '11:00',
    '11:30',
    '13:00',
    '13:30',
    '14:00',
    '14:30',
    '15:00',
    '15:30'
  ];
  Future<void> _confirm() async {
    if (_staffId == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('กรุณาเลือกหมอนวด')));
      return;
    }
    if (_timeSlot == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('กรุณาเลือกเวลา')));
      return;
    }
    setState(() => _submitting = true);
    final booking = await context.read<BookingService>().createBooking(
          serviceId: widget.service.id,
          bookingDate: DateFormat('yyyy-MM-dd').format(_selected),
          timeSlot: _timeSlot!,
          staffId: _staffId,
        );
    if (!mounted) return;
    setState(() => _submitting = false);

    if (booking != null) {
      Navigator.pop(context);
      showDialog(
        context: context,
        builder: (_) => _SuccessDialog(booking: booking),
      );
    } else {
      final message = context.read<BookingService>().error ?? 'จองไม่สำเร็จ';
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    const sage = Color(0xFF7A9E7E);
    const navy = Color(0xFF2D3B6B);
    final now = DateTime.now();
    final max = now.add(const Duration(days: 3));

    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(
            child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2))),
          ),
          const SizedBox(height: 18),
          Text('จองคิว – ${widget.service.name}',
              style: const TextStyle(
                  fontFamily: 'Sarabun',
                  fontSize: 19,
                  fontWeight: FontWeight.w700,
                  color: navy)),
          const SizedBox(height: 18),

          // Calendar
          const Text('เลือกวันที่',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF777777))),
          const SizedBox(height: 8),
          TableCalendar(
            firstDay: now,
            lastDay: max,
            focusedDay: _selected,
            selectedDayPredicate: (d) => isSameDay(d, _selected),
            calendarFormat: CalendarFormat.week,
            onDaySelected: (sel, _) => setState(() {
              _selected = sel;
              _timeSlot = null;
            }),
            calendarStyle: const CalendarStyle(
              selectedDecoration:
                  BoxDecoration(color: sage, shape: BoxShape.circle),
              todayDecoration: BoxDecoration(
                  color: Color(0xFFC8DBC9), shape: BoxShape.circle),
            ),
            headerStyle: const HeaderStyle(
                formatButtonVisible: false, titleCentered: true),
          ),
          const SizedBox(height: 16),

          const Text('เลือกหมอนวด',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF777777))),
          const SizedBox(height: 8),
          Consumer<BookingService>(
            builder: (_, booking, __) {
              if (booking.staff.isEmpty) {
                return const Text('ยังไม่มีหมอนวดที่ลงทะเบียน',
                    style: TextStyle(color: Colors.redAccent));
              }
              return DropdownButtonFormField<String>(
                initialValue: _staffId,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.person_outline),
                ),
                hint: const Text('เลือกหมอนวดที่ว่าง'),
                items: booking.staff.map((person) {
                  final selectable = person.status == 'available';
                  return DropdownMenuItem<String>(
                    value: person.id,
                    enabled: selectable,
                    child: Row(children: [
                      Icon(
                        selectable ? Icons.circle : Icons.remove_circle,
                        size: 11,
                        color: selectable ? Colors.green : Colors.grey,
                      ),
                      const SizedBox(width: 8),
                      Text('${person.name} (${person.statusLabel})'),
                    ]),
                  );
                }).toList(),
                onChanged: (value) => setState(() => _staffId = value),
              );
            },
          ),
          const SizedBox(height: 16),

          // Time slots
          const Text('เลือกเวลา',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF777777))),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _times.map((t) {
              final sel = _timeSlot == t;
              return GestureDetector(
                onTap: () => setState(() => _timeSlot = t),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: sel ? sage : const Color(0xFFEEF4EE),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(t,
                      style: TextStyle(
                        fontFamily: 'Sarabun',
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: sel ? Colors.white : navy,
                      )),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _submitting ? null : _confirm,
              child: _submitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.event_available_outlined),
                        SizedBox(width: 8),
                        Text('ยืนยันการจอง'),
                      ],
                    ),
            ),
          ),
        ]),
      ),
    );
  }
}

// ── Success Dialog ───────────────────────────────────────────
class _SuccessDialog extends StatelessWidget {
  final BookingModel booking;
  const _SuccessDialog({required this.booking});

  @override
  Widget build(BuildContext context) {
    const sage = Color(0xFF7A9E7E);
    const navy = Color(0xFF2D3B6B);
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [sage, Color(0xFF5A8A5E)]),
              borderRadius: BorderRadius.circular(36),
            ),
            child: const Icon(Icons.check, color: Colors.white, size: 36),
          ),
          const SizedBox(height: 16),
          const Text('จองคิวสำเร็จ!',
              style: TextStyle(
                  fontFamily: 'Sarabun',
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: navy)),
          const SizedBox(height: 12),
          _row('บริการ', booking.serviceName),
          _row('วันที่', booking.bookingDate),
          _row('เวลา', booking.timeSlot),
          if (booking.staffName != null && booking.staffName!.isNotEmpty)
            _row('หมอนวด', booking.staffName!),
          _row('หมายเลขคิว', booking.queueNumber),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle_outline),
                  SizedBox(width: 8),
                  Text('ตกลง'),
                ],
              ),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _row(String label, String val) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(children: [
          Text(label,
              style: const TextStyle(color: Color(0xFF777777), fontSize: 13)),
          const Spacer(),
          Text(val,
              style:
                  const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        ]),
      );
}
