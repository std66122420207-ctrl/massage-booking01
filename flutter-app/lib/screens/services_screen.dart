import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:intl/intl.dart';
import '../services/booking_service.dart';
import '../services/auth_service.dart';
import '../models/models.dart';
import 'notifications_screen.dart';
import 'my_bookings_screen.dart';

// ══ Services Screen ══════════════════════════════════════════
class ServicesScreen extends StatelessWidget {
  const ServicesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final booking = context.watch<BookingService>();
    final services = booking.services;
    const forest = Color(0xFF1E4D3B);
    const ink = Color(0xFF17372D);

    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFFE9F2EC),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.local_hospital_outlined, color: forest),
          ),
          const SizedBox(width: 10),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('ท่าวังหิน', style: TextStyle(fontSize: 16, height: 1.1)),
              SizedBox(height: 3),
              Text('นวดแพทย์แผนไทยเพื่อสุขภาพ',
                  style: TextStyle(fontSize: 10, color: Color(0xFF718078))),
            ],
          ),
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
              if (booking.unconfirmedCount > 0)
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
                      '${booking.unconfirmedCount}',
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
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1E4D3B), Color(0xFF163A2D)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Stack(children: [
              const Positioned(
                  right: 20,
                  top: 16,
                  child: Icon(Icons.auto_awesome_outlined,
                      size: 22, color: Color(0x668BC9A7))),
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
                child: Row(children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('สวัสดี, ${auth.user?.name ?? 'คุณ'}',
                            style: const TextStyle(
                                color: Colors.white70, fontSize: 14)),
                        const SizedBox(height: 5),
                        const Text('เลือกบริการนวดวันนี้',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                                fontFamily: 'Sarabun')),
                      ],
                    ),
                  ),
                  const Icon(Icons.spa_outlined,
                      size: 44, color: Color(0x668BC9A7)),
                ]),
              ),
            ]),
          ),
          const SizedBox(height: 24),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('บริการของเรา',
                style: TextStyle(
                    fontFamily: 'Sarabun',
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: ink)),
            Text('ทั้งหมด (${services.length})',
                style: const TextStyle(fontSize: 12, color: Color(0xFF718078))),
          ]),
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
    const sage = Color(0xFF2D8B60);
    const ink = Color(0xFF17372D);

    return GestureDetector(
      onTap: () {
        final activeBookings = context
            .read<BookingService>()
            .bookings
            .where((booking) => [
                  'pending',
                  'confirmed',
                  'auto_called',
                  'in_service'
                ].contains(booking.status))
            .toList();
        if (activeBookings.isNotEmpty) {
          final active = activeBookings.first;
          showDialog<void>(
            context: context,
            builder: (dialogContext) => AlertDialog(
              title: const Text('มีคิวที่ยังใช้งานอยู่'),
              content: Text(
                'กรุณายกเลิกคิว ${active.queueNumber} ก่อนจึงจะจองคิวใหม่ได้',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('ปิด'),
                ),
                FilledButton(
                  onPressed: () {
                    Navigator.pop(dialogContext);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const MyBookingsScreen(),
                      ),
                    );
                  },
                  child: const Text('ไปที่การจองของฉัน'),
                ),
              ],
            ),
          );
          return;
        }
        showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          useSafeArea: true,
          shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
          builder: (_) => BookingSheet(service: service),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border:
              const Border.fromBorderSide(BorderSide(color: Color(0xFFE5EBE7))),
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
              color: const Color(0xFFF0F5F1),
              borderRadius: BorderRadius.circular(12),
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
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: ink)),
                const SizedBox(height: 3),
                Text(service.description,
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xFF718078))),
              ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('${service.price} ฿',
                style: const TextStyle(
                    fontFamily: 'Sarabun',
                    fontSize: 15,
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
    if (name.contains('กัวชา') || name.contains('กัวซา')) {
      return Icons.health_and_safety_outlined;
    }
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
  bool _autoStaff = false;
  String _healthcareRight = 'direct';
  bool _submitting = false;
  final _nationalIdController = TextEditingController();

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

  @override
  void dispose() {
    _nationalIdController.dispose();
    super.dispose();
  }

  Widget _staffPortrait(StaffModel person, {double size = 52}) {
    final photo = person.photo;
    if (photo == null || photo.isEmpty) {
      return CircleAvatar(
        radius: size / 2,
        backgroundColor: const Color(0xFFE7F1EA),
        child: Icon(Icons.person_outline,
            color: const Color(0xFF2D8B60), size: size * 0.55),
      );
    }
    return ClipOval(
      child: Image.network(
        photo,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => CircleAvatar(
          radius: size / 2,
          backgroundColor: const Color(0xFFE7F1EA),
          child: Icon(Icons.person_outline,
              color: const Color(0xFF2D8B60), size: size * 0.55),
        ),
      ),
    );
  }

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
    final now = DateTime.now();
    final selectedStart = DateTime(
      _selected.year,
      _selected.month,
      _selected.day,
      int.parse(_timeSlot!.split(':')[0]),
      int.parse(_timeSlot!.split(':')[1]),
    );
    if (selectedStart.isBefore(now) || selectedStart.isAtSameMomentAs(now)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('เวลานัดนี้ผ่านไปแล้ว กรุณาเลือกเวลาใหม่')),
      );
      return;
    }
    final nationalId =
        _nationalIdController.text.replaceAll(RegExp(r'[\s-]'), '');
    if (_healthcareRight != 'direct' &&
        !RegExp(r'^\d{13}$').hasMatch(nationalId)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('กรุณากรอกเลขบัตรประชาชน 13 หลักสำหรับสิทธินี้')),
      );
      return;
    }
    setState(() => _submitting = true);
    final booking = await context.read<BookingService>().createBooking(
          serviceId: widget.service.id,
          bookingDate: DateFormat('yyyy-MM-dd').format(_selected),
          timeSlot: _timeSlot!,
          staffId: _staffId,
          healthcareRight: _healthcareRight,
          nationalId: nationalId,
        );
    if (!mounted) return;
    setState(() => _submitting = false);

    if (booking != null) {
      final navigator = Navigator.of(context);
      navigator.pop();
      showDialog(
        context: navigator.context,
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

          Row(children: [
            IconButton(
              tooltip: 'ย้อนกลับ',
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.arrow_back_ios_new, size: 18),
            ),
            const Expanded(
              child: Text('จองคิวนวด',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            ),
            IconButton(
              tooltip: 'ประวัติการจอง',
              onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const MyBookingsScreen())),
              icon: const Icon(Icons.history_outlined),
            ),
          ]),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF0F5F1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(children: [
              const Icon(Icons.spa_outlined, color: Color(0xFF2D8B60)),
              const SizedBox(width: 10),
              Expanded(
                  child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.service.name,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 15)),
                  Text(
                      '${widget.service.duration} นาที  •  ${widget.service.price} ฿',
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF65756C))),
                ],
              )),
              const Icon(Icons.edit_calendar_outlined,
                  size: 19, color: Color(0xFF2D8B60)),
            ]),
          ),
          const SizedBox(height: 18),

          const Text('สิทธิการรักษา',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF777777))),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: _healthcareRight,
            decoration: const InputDecoration(
                prefixIcon: Icon(Icons.verified_user_outlined)),
            items: const [
              DropdownMenuItem(value: 'universal', child: Text('บัตรทอง')),
              DropdownMenuItem(
                  value: 'social_security', child: Text('ประกันสังคม')),
              DropdownMenuItem(
                  value: 'direct', child: Text('จ่ายตรง / ชำระเอง')),
            ],
            onChanged: (value) =>
                setState(() => _healthcareRight = value ?? 'direct'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _nationalIdController,
            keyboardType: TextInputType.number,
            maxLength: 13,
            decoration: InputDecoration(
              labelText: _healthcareRight == 'direct'
                  ? 'เลขบัตรประชาชน / Member ID (ถ้ามี)'
                  : 'เลขบัตรประชาชน 13 หลัก',
              prefixIcon: const Icon(Icons.badge_outlined),
              helperText: _healthcareRight == 'direct'
                  ? 'จ่ายตรงไม่จำกัดสิทธิรายวัน'
                  : 'ใช้สิทธิได้ 1 คิวต่อวัน',
            ),
          ),
          const SizedBox(height: 4),
          // Calendar
          const Text('เลือกวันที่นัดหมาย',
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
              final selectedStaff = booking.staff
                  .where((person) => person.id == _staffId)
                  .firstOrNull;
              return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE3EAE5)),
                      ),
                      child: Row(children: [
                        if (selectedStaff != null)
                          _staffPortrait(selectedStaff)
                        else
                          const CircleAvatar(
                            radius: 26,
                            backgroundColor: Color(0xFFE7F1EA),
                            child: Icon(Icons.people_outline,
                                color: Color(0xFF2D8B60)),
                          ),
                        const SizedBox(width: 12),
                        Expanded(
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                              Text(selectedStaff?.name ?? 'เลือกหมอนวด',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14)),
                              const SizedBox(height: 3),
                              Text(
                                  selectedStaff?.experience.isNotEmpty == true
                                      ? 'ประสบการณ์ ${selectedStaff!.experience} • พร้อมให้บริการ'
                                      : 'เลือกหมอนวดที่พร้อมให้บริการ',
                                  style: const TextStyle(
                                      fontSize: 11, color: Color(0xFF718078))),
                            ])),
                        if (selectedStaff != null)
                          const Icon(Icons.check_circle,
                              color: Color(0xFF2D8B60), size: 20),
                      ]),
                    ),
                    const SizedBox(height: 10),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      ChoiceChip(
                        avatar:
                            const Icon(Icons.auto_awesome_outlined, size: 16),
                        label: const Text('เลือกอัตโนมัติ'),
                        selected: _autoStaff,
                        onSelected: booking.availableStaff.isEmpty
                            ? null
                            : (value) {
                                if (!value) return;
                                setState(() {
                                  _staffId = booking.availableStaff.first.id;
                                  _autoStaff = true;
                                });
                              },
                      ),
                      ...booking.staff.map((person) {
                        final available = person.status == 'available';
                        return ChoiceChip(
                          avatar: person.photo != null &&
                                  person.photo!.isNotEmpty
                              ? CircleAvatar(
                                  backgroundImage: NetworkImage(person.photo!))
                              : const Icon(Icons.person_outline, size: 16),
                          label: Text(person.name),
                          selected: !_autoStaff && _staffId == person.id,
                          onSelected: available
                              ? (value) => setState(() {
                                    _staffId = value ? person.id : null;
                                    _autoStaff = false;
                                  })
                              : null,
                        );
                      }),
                    ]),
                    if (booking.availableStaff.isEmpty)
                      const Padding(
                        padding: EdgeInsets.only(top: 6),
                        child: Text('ขณะนี้ไม่มีหมอนวดว่าง',
                            style: TextStyle(
                                fontSize: 12, color: Colors.redAccent)),
                      ),
                  ]);
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
          const Row(children: [
            Icon(Icons.circle, size: 8, color: Color(0xFFB5C9BC)),
            SizedBox(width: 5),
            Text('เลือกช่วงเวลา',
                style: TextStyle(fontSize: 11, color: Color(0xFF718078))),
            SizedBox(width: 14),
            Icon(Icons.circle, size: 8, color: Color(0xFF2D8B60)),
            SizedBox(width: 5),
            Text('เวลาที่เลือก',
                style: TextStyle(fontSize: 11, color: Color(0xFF718078))),
          ]),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _times.map((t) {
              final sel = _timeSlot == t;
              final slotParts = t.split(':');
              final slotDate = DateTime(
                _selected.year,
                _selected.month,
                _selected.day,
                int.parse(slotParts[0]),
                int.parse(slotParts[1]),
              );
              final past = slotDate.isBefore(DateTime.now());
              return GestureDetector(
                onTap: past ? null : () => setState(() => _timeSlot = t),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: past
                        ? Colors.grey.shade200
                        : sel
                            ? sage
                            : const Color(0xFFEEF4EE),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(t,
                      style: TextStyle(
                        fontFamily: 'Sarabun',
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: past
                            ? Colors.grey
                            : sel
                                ? Colors.white
                                : navy,
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
                        Text('ยืนยันการจองคิว'),
                        SizedBox(width: 8),
                        Icon(Icons.arrow_forward, size: 18),
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
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 58,
              height: 58,
              decoration: const BoxDecoration(
                color: Color(0xFF2DAD72),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_rounded,
                  color: Colors.white, size: 34),
            ),
            const SizedBox(height: 14),
            const Text('จองคิวสำเร็จ!',
                style: TextStyle(
                    fontFamily: 'Sarabun',
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF17372D))),
            const SizedBox(height: 4),
            const Text('บันทึกข้อมูลการนัดหมายเรียบร้อยแล้ว',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Color(0xFF718078))),
            const SizedBox(height: 18),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFF5F8F6),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(children: [
                _detailRow('บริการ', booking.serviceName),
                _detailRow('วันที่', booking.bookingDate),
                _detailRow('เวลา', '${booking.timeSlot} น.'),
                if (booking.staffName != null && booking.staffName!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(children: [
                      const Expanded(
                          child: Text('หมอนวด',
                              style: TextStyle(
                                  fontSize: 12, color: Color(0xFF718078)))),
                      if (booking.staffPhoto != null &&
                          booking.staffPhoto!.isNotEmpty)
                        CircleAvatar(
                            radius: 13,
                            backgroundImage: NetworkImage(booking.staffPhoto!))
                      else
                        const CircleAvatar(
                            radius: 13,
                            backgroundColor: Color(0xFFE0ECE4),
                            child: Icon(Icons.person_outline,
                                size: 16, color: Color(0xFF2D8B60))),
                      const SizedBox(width: 7),
                      Text(booking.staffName!,
                          style: const TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w700)),
                    ]),
                  ),
              ]),
            ),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFE5F4EA),
                borderRadius: BorderRadius.circular(12),
              ),
              child:
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.confirmation_number_outlined,
                    color: Color(0xFF24764D), size: 20),
                const SizedBox(width: 8),
                const Text('หมายเลขคิว',
                    style: TextStyle(fontSize: 12, color: Color(0xFF426451))),
                const SizedBox(width: 10),
                Text(booking.queueNumber,
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF17633D))),
              ]),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.check_circle_outline),
                label: const Text('ตกลง'),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(children: [
          Expanded(
              child: Text(label,
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF718078)))),
          Text(value,
              style:
                  const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
        ]),
      );
}
