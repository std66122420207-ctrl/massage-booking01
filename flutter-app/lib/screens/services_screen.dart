import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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
    const forest = Color(0xFF1B3A2D);
    const jade = Color(0xFF2E7D52);
    const mist = Color(0xFFF0F5F2);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: mist,
        surfaceTintColor: Colors.transparent,
        title: Row(children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: const Color(0xFFE6F1EB),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child:
                    Image.asset('assets/images/logo.jpeg', fit: BoxFit.cover),
              ),
            ),
          ),
          const SizedBox(width: 10),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('ท่าวังหิน', style: TextStyle(fontWeight: FontWeight.w700)),
              Text('ศูนย์สุขภาพชุมชน',
                  style: TextStyle(fontSize: 10, color: Color(0xFF748279))),
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
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [forest, Color(0xFF285A42)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: forest.withValues(alpha: 0.18),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Stack(
              children: [
                const Positioned(
                  right: -4,
                  bottom: -12,
                  child: Icon(Icons.spa_rounded,
                      size: 92, color: Color(0x263FE08C)),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(30),
                      ),
                      child: const Text('WELLNESS  ·  THA WANG HIN',
                          style: TextStyle(
                              color: Color(0xFFD3E8D9),
                              fontSize: 9,
                              letterSpacing: 1,
                              fontWeight: FontWeight.w700)),
                    ),
                    const SizedBox(height: 14),
                    Text('สวัสดี, ${auth.user?.name ?? 'คุณ'}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: Colors.white70, fontSize: 14)),
                    const SizedBox(height: 4),
                    const Text('ดูแลสุขภาพ\nให้ผ่อนคลายขึ้น',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 21,
                            height: 1.25,
                            fontWeight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    const Row(
                      children: [
                        Icon(Icons.verified_user_outlined,
                            color: Color(0xFFB7D9C4), size: 15),
                        SizedBox(width: 6),
                        Text('เลือกบริการและจองเวลาที่สะดวก',
                            style: TextStyle(
                                color: Color(0xFFD3E8D9), fontSize: 11)),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('บริการของเรา',
                        style: TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w700,
                            color: forest)),
                    SizedBox(height: 3),
                    Text('เลือกการดูแลที่เหมาะกับคุณ',
                        style:
                            TextStyle(fontSize: 12, color: Color(0xFF78857D))),
                  ],
                ),
              ),
              if (services.isNotEmpty)
                Text('${services.length} บริการ',
                    style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: jade)),
            ],
          ),
          const SizedBox(height: 14),
          if (services.isEmpty && booking.servicesLoading)
            const Padding(
              padding: EdgeInsets.only(top: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (services.isEmpty)
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
    const forest = Color(0xFF1B3A2D);
    const jade = Color(0xFF2E7D52);

    return GestureDetector(
      onTap: () async {
        final booking = await Navigator.of(context).push<BookingModel>(
          MaterialPageRoute(
            builder: (_) => BookingSheet(service: service),
          ),
        );
        if (booking != null && context.mounted) {
          showDialog<void>(
            context: context,
            builder: (_) => _SuccessDialog(booking: booking),
          );
        }
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE3EBE5)),
          boxShadow: [
            BoxShadow(
                color: const Color(0xFF193E2C).withValues(alpha: 0.045),
                blurRadius: 14,
                offset: const Offset(0, 5))
          ],
        ),
        child: Row(children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFEAF4EC), Color(0xFFDDEEE2)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(17),
            ),
            child: Center(
              child: Icon(_serviceIcon(service.name), size: 27, color: jade),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(service.name,
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: forest)),
                const SizedBox(height: 4),
                Text(service.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 11, height: 1.35, color: Color(0xFF78857D))),
              ])),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('${service.price} ฿',
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w800, color: jade)),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.schedule_rounded,
                      size: 12, color: Color(0xFF8A968E)),
                  const SizedBox(width: 3),
                  Text('${service.duration} นาที',
                      style: const TextStyle(
                          fontSize: 10, color: Color(0xFF8A968E))),
                ],
              ),
              const SizedBox(height: 5),
              const Icon(Icons.arrow_forward_rounded,
                  size: 15, color: Color(0xFF91A69A)),
            ],
          ),
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
  late String _serviceId;
  String _healthcareRight = 'direct';
  bool _submitting = false;
  final _nationalIdController = TextEditingController();

  ServiceModel get _selectedService {
    final services = context.read<BookingService>().services;
    return services.firstWhere(
      (service) => service.id == _serviceId,
      orElse: () => widget.service,
    );
  }

  @override
  void initState() {
    super.initState();
    _serviceId = widget.service.id;
    _nationalIdController.text =
        context.read<AuthService>().user?.citizenId ?? '';
  }

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
    final bookingDate = DateFormat('yyyy-MM-dd').format(_selected);
    final existingBookings = context
        .read<BookingService>()
        .bookings
        .where((item) =>
            item.bookingDate == bookingDate && item.status != 'cancelled')
        .toList();
    if (existingBookings.isNotEmpty) {
      final existingBooking = existingBookings.first;
      final canCancel =
          ['pending', 'confirmed', 'auto_called'].contains(existingBooking.status);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(canCancel
              ? 'คุณมีคิว ${existingBooking.queueNumber} ในวันที่ $bookingDate กรุณายกเลิกคิวเดิมจากหน้าการจองของฉันก่อนจองใหม่'
              : 'คุณมีรายการจองในวันที่ $bookingDate ที่เริ่มดำเนินการแล้ว ไม่สามารถจองซ้ำได้'),
        ),
      );
      return;
    }
    setState(() => _submitting = true);
    final booking = await context.read<BookingService>().createBooking(
          serviceId: _selectedService.id,
          bookingDate: bookingDate,
          timeSlot: _timeSlot!,
          staffId: _staffId,
          healthcareRight: _healthcareRight,
          nationalId: nationalId,
        );
    if (!mounted) return;
    setState(() => _submitting = false);

    if (booking != null) {
      Navigator.pop(context, booking);
    } else {
      final message = context.read<BookingService>().error ?? 'จองไม่สำเร็จ';
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    const sage = Color(0xFF2E7D52);
    const navy = Color(0xFF1B3A2D);
    final now = DateTime.now();
    final firstDay = DateTime(now.year, now.month, now.day);
    final booking = context.watch<BookingService>();
    final services = booking.services;

    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth > 480 ? 480.0 : constraints.maxWidth;
        return Center(
          child: SizedBox(
            width: width,
            height: constraints.maxHeight,
            child: Scaffold(
              backgroundColor: const Color(0xFFF7FAF7),
              appBar: AppBar(
                leading: IconButton(
                  tooltip: 'ย้อนกลับ',
                  icon: const Icon(Icons.arrow_back_ios_new, size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
                title: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('ท่าวังหิน', style: TextStyle(fontSize: 12)),
                    Text('จองคิวนวด', style: TextStyle(fontSize: 18)),
                  ],
                ),
              ),
              body: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1B3A2D),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(Icons.spa_rounded,
                              color: Color(0xFFB9D9C5)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('นัดหมายเพื่อสุขภาพ',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 15)),
                              const SizedBox(height: 3),
                              Text(
                                  '${_selectedService.name}  ·  ${_selectedService.duration} นาที',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      color: Color(0xFFD3E8D9), fontSize: 11)),
                            ],
                          ),
                        ),
                        Text('${_selectedService.price} ฿',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      _stepIndicator('1', 'บริการ', true),
                      _stepConnector(),
                      _stepIndicator('2', 'วัน-เวลา', false),
                      _stepConnector(),
                      _stepIndicator('3', 'ยืนยัน', false),
                    ],
                  ),
                  const SizedBox(height: 18),
                  _sectionTitle('บริการที่ต้องการรับ'),
                  DropdownButtonFormField<String>(
                    initialValue: _serviceId,
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.spa_outlined),
                      filled: true,
                      fillColor: Colors.white,
                    ),
                    items: services
                        .map((service) => DropdownMenuItem(
                              value: service.id,
                              child: Text(service.name),
                            ))
                        .toList(),
                    onChanged: (value) {
                      if (value != null) setState(() => _serviceId = value);
                    },
                  ),
                  const SizedBox(height: 10),
                  _sectionTitle('สิทธิการรักษา'),
                  DropdownButtonFormField<String>(
                    initialValue: _healthcareRight,
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.verified_user_outlined),
                      filled: true,
                      fillColor: Colors.white,
                    ),
                    items: const [
                      DropdownMenuItem(
                          value: 'universal', child: Text('บัตรทอง')),
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
                          ? 'เลขบัตรประชาชน / Member ID (13 หลัก)'
                          : 'เลขบัตรประชาชน 13 หลัก',
                      prefixIcon: const Icon(Icons.badge_outlined),
                      helperText: _healthcareRight == 'direct'
                          ? 'จ่ายตรงไม่จำกัดสิทธิรายวัน'
                          : 'ใช้สิทธิได้ 1 คิวต่อวัน',
                      filled: true,
                      fillColor: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _sectionTitle('เลือกวันที่'),
                  Row(
                    children: List.generate(4, (index) {
                      final day = firstDay.add(Duration(days: index));
                      final selected = DateUtils.isSameDay(day, _selected);
                      final today = DateUtils.isSameDay(day, firstDay);
                      return Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(right: index == 3 ? 0 : 8),
                          child: InkWell(
                            onTap: () => setState(() {
                              _selected = day;
                              _timeSlot = null;
                            }),
                            borderRadius: BorderRadius.circular(16),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 160),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                color: selected
                                    ? const Color(0xFF1B3A2D)
                                    : Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: selected
                                      ? const Color(0xFF1B3A2D)
                                      : const Color(0xFFE2EAE4),
                                ),
                              ),
                              child: Column(
                                children: [
                                  Text(
                                    today
                                        ? 'วันนี้'
                                        : DateFormat('EEE', 'th').format(day),
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: selected
                                          ? const Color(0xFFD3E8D9)
                                          : const Color(0xFF78857D),
                                    ),
                                  ),
                                  const SizedBox(height: 5),
                                  Text(DateFormat('d').format(day),
                                      style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w800,
                                        color: selected
                                            ? Colors.white
                                            : const Color(0xFF1B3A2D),
                                      )),
                                  Text(DateFormat('MMM', 'th').format(day),
                                      style: TextStyle(
                                        fontSize: 9,
                                        color: selected
                                            ? const Color(0xFFD3E8D9)
                                            : const Color(0xFF78857D),
                                      )),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(child: _sectionTitle('เลือกหมอนวด')),
                      Text('เลือกได้ 1 คน',
                          style: TextStyle(
                              fontSize: 11, color: Colors.grey.shade600)),
                    ],
                  ),
                  if (booking.staff.isEmpty)
                    _bookingCard(
                      child: const Text('ยังไม่มีหมอนวดที่ลงทะเบียน',
                          style: TextStyle(color: Colors.redAccent)),
                    )
                  else
                    SizedBox(
                      height: 142,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: booking.staff.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 10),
                        itemBuilder: (_, index) {
                          final person = booking.staff[index];
                          final available = person.status == 'available';
                          final selected = person.id == _staffId;
                          return InkWell(
                            onTap: available
                                ? () => setState(() => _staffId = person.id)
                                : null,
                            borderRadius: BorderRadius.circular(14),
                            child: Container(
                              width: 164,
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(
                                  color:
                                      selected ? sage : const Color(0xFFE2EAE4),
                                  width: selected ? 2 : 1,
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      CircleAvatar(
                                        radius: 20,
                                        backgroundColor:
                                            const Color(0xFFE8F1EA),
                                        backgroundImage:
                                            person.photo?.isNotEmpty == true
                                                ? NetworkImage(person.photo!)
                                                : null,
                                        child: person.photo?.isNotEmpty == true
                                            ? null
                                            : const Icon(Icons.person,
                                                color: sage, size: 22),
                                      ),
                                      const Spacer(),
                                      Icon(
                                        selected
                                            ? Icons.check_circle
                                            : Icons.radio_button_unchecked,
                                        color: selected
                                            ? const Color(0xFF2E7D52)
                                            : Colors.grey.shade400,
                                        size: 19,
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    person.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    available
                                        ? 'พร้อมให้บริการ'
                                        : person.statusLabel,
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: available ? sage : Colors.grey,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  const SizedBox(height: 16),
                  _sectionTitle('เลือกเวลา'),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      const spacing = 8.0;
                      final width = (constraints.maxWidth - spacing * 3) / 4;
                      return Wrap(
                        spacing: spacing,
                        runSpacing: spacing,
                        children: _times.map((time) {
                          final selected = _timeSlot == time;
                          final parts = time.split(':');
                          final slotDate = DateTime(
                            _selected.year,
                            _selected.month,
                            _selected.day,
                            int.parse(parts[0]),
                            int.parse(parts[1]),
                          );
                          final past = slotDate.isBefore(DateTime.now());
                          return SizedBox(
                            width: width,
                            height: 40,
                            child: OutlinedButton(
                              onPressed: past
                                  ? null
                                  : () => setState(() => _timeSlot = time),
                              style: OutlinedButton.styleFrom(
                                padding: EdgeInsets.zero,
                                backgroundColor: selected ? sage : Colors.white,
                                foregroundColor: selected ? Colors.white : navy,
                                disabledForegroundColor: Colors.grey.shade400,
                                side: BorderSide(
                                  color:
                                      selected ? sage : const Color(0xFFE2EAE4),
                                ),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10)),
                              ),
                              child: Text(time,
                                  style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600)),
                            ),
                          );
                        }).toList(),
                      );
                    },
                  ),
                  const SizedBox(height: 12),
                  Text('เวลานัดหมายทั้งหมดแสดงตามเวลาทำการของศูนย์บริการ',
                      style:
                          TextStyle(fontSize: 10, color: Colors.grey.shade600)),
                ],
              ),
              bottomNavigationBar: SafeArea(
                top: false,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    border: Border(top: BorderSide(color: Color(0xFFE5ECE6))),
                  ),
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
                              Text('ยืนยันการจอง'),
                              SizedBox(width: 8),
                              Icon(Icons.arrow_forward, size: 18),
                            ],
                          ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _sectionTitle(String title) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(
          title,
          style: const TextStyle(
              color: Color(0xFF2D3B6B),
              fontSize: 13,
              fontWeight: FontWeight.w700),
        ),
      );

  Widget _stepIndicator(String number, String title, bool active) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 24,
            height: 24,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: active ? const Color(0xFF2E7D52) : Colors.white,
              shape: BoxShape.circle,
              border: Border.all(
                color:
                    active ? const Color(0xFF2E7D52) : const Color(0xFFD7E2DA),
              ),
            ),
            child: Text(number,
                style: TextStyle(
                    color: active ? Colors.white : const Color(0xFF78857D),
                    fontSize: 11,
                    fontWeight: FontWeight.w700)),
          ),
          const SizedBox(width: 5),
          Text(title,
              style: TextStyle(
                  color: active
                      ? const Color(0xFF1B3A2D)
                      : const Color(0xFF78857D),
                  fontSize: 10,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500)),
        ],
      );

  Widget _stepConnector() => Expanded(
        child: Container(
          height: 1,
          margin: const EdgeInsets.symmetric(horizontal: 7),
          color: const Color(0xFFD7E2DA),
        ),
      );

  Widget _bookingCard({required Widget child}) => Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2EAE4)),
        ),
        child: child,
      );
}

// ── Success Dialog ───────────────────────────────────────────
class _SuccessDialog extends StatelessWidget {
  final BookingModel booking;
  const _SuccessDialog({required this.booking});

  @override
  Widget build(BuildContext context) {
    const jade = Color(0xFF2E7D52);
    const forest = Color(0xFF1B3A2D);
    final parsedDate = DateTime.tryParse(booking.bookingDate);
    final displayDate = parsedDate == null
        ? booking.bookingDate
        : DateFormat('d MMMM yyyy', 'th').format(parsedDate);
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 68,
              height: 68,
              decoration: const BoxDecoration(
                color: Color(0xFFE6F3EA),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_rounded, color: jade, size: 36),
            ),
            const SizedBox(height: 16),
            const Text('จองคิวสำเร็จ!',
                style: TextStyle(
                    fontFamily: 'Sarabun',
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: forest)),
            const SizedBox(height: 6),
            Text('บันทึกการนัดหมายของคุณเรียบร้อยแล้ว',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            const SizedBox(height: 18),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF5F8F5),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  _row('บริการ', booking.serviceName),
                  _row('วันที่', displayDate),
                  _row('เวลา', '${booking.timeSlot} น.'),
                  if (booking.staffName != null &&
                      booking.staffName!.isNotEmpty)
                    _row('หมอนวด', booking.staffName!),
                  const Divider(height: 22),
                  Row(
                    children: [
                      const Text('หมายเลขคิว',
                          style: TextStyle(
                              color: Color(0xFF777777), fontSize: 13)),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE4F1E7),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          booking.queueNumber,
                          style: const TextStyle(
                            color: jade,
                            fontWeight: FontWeight.w800,
                            fontSize: 17,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('ตกลง'),
              ),
            ),
          ]),
        ),
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
