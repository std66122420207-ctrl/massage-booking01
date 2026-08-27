import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/booking_service.dart';

class QueueScreen extends StatefulWidget {
  const QueueScreen({super.key});
  @override
  State<QueueScreen> createState() => _QueueScreenState();
}

class _QueueScreenState extends State<QueueScreen> {
  Map<String, dynamic>? _status;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    final data = await context.read<BookingService>().getQueueStatus();
    if (!mounted) return;
    setState(() {
      _status = data;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    const sage = Color(0xFF7A9E7E);

    return Scaffold(
      appBar: AppBar(title: const Text('สถานะคิว')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 80),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_status?['hasQueue'] != true)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 60),
                child: Center(
                  child: Column(children: [
                    Icon(Icons.event_busy_outlined,
                        size: 48, color: Colors.grey.shade400),
                    const SizedBox(height: 12),
                    Text('คุณยังไม่มีคิววันนี้',
                        style: TextStyle(
                            color: Colors.grey.shade500, fontSize: 14)),
                  ]),
                ),
              )
            else ...[
              Container(
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 8)
                  ],
                ),
                child: Column(children: [
                  const Text('คิวของคุณ',
                      style: TextStyle(fontSize: 13, color: Color(0xFF777777))),
                  const SizedBox(height: 8),
                  Text(_status!['booking']['queueNumber'] ?? '-',
                      style: const TextStyle(
                          fontFamily: 'Sarabun',
                          fontSize: 48,
                          fontWeight: FontWeight.w700,
                          color: sage)),
                  const SizedBox(height: 8),
                  Text(
                      '${_status!['booking']['serviceName'] ?? ''} · ${_status!['booking']['timeSlot'] ?? ''} น.',
                      style: const TextStyle(
                          fontSize: 13, color: Color(0xFF777777))),
                ]),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 8)
                  ],
                ),
                child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _statBox(
                          '${_status!['queuesBefore'] ?? 0}', 'คิวก่อนหน้า'),
                      Container(
                          width: 1, height: 40, color: const Color(0xFFE0E8E0)),
                      _statBox(
                          '~${((_status!['estimatedWait'] ?? 0) / 60).round()}',
                          'นาที (โดยประมาณ)'),
                    ]),
              ),
            ],
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Text('* ระบบจะส่งการแจ้งเตือนก่อนถึงคิวของคุณ',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statBox(String value, String label) => Column(children: [
        Text(value,
            style: const TextStyle(
                fontFamily: 'Sarabun',
                fontSize: 28,
                fontWeight: FontWeight.w700,
                color: Color(0xFF7A9E7E))),
        const SizedBox(height: 4),
        Text(label,
            style: const TextStyle(fontSize: 11, color: Color(0xFF777777))),
      ]);
}
