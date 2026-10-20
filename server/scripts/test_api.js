// ============================================================
//  Automated API Test Suite
//  รัน: node scripts/test_api.js
// ============================================================
require('dotenv').config();
process.env.NODE_ENV = 'test';
const http = require('http');
const app  = require('../index');
const { isBookingCounted, summarizeBookingCounts, getReportDates } = require('../routes/admin');
const { parseTimeToMinutes, isWithinOperatingHours } = require('../services/bookingPolicy');

async function runTests() {
  const PORT = 4321;
  const server = app.listen(PORT);
  console.log(`\n🚀 Starting API test suite on port ${PORT}...\n`);

  let passed = 0;
  let failed = 0;

  async function request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: PORT,
        path: path,
        method: options.method || 'GET',
        headers: options.headers || {},
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, body: json, text: data });
        });
      });
      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    });
  }

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    await test('GET /api/health returns 200 and status ok', async () => {
      const res = await request('/api/health');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body?.status !== 'ok') throw new Error(`Expected status 'ok', got ${res.body?.status}`);
    });

    // 2. Services list
    await test('GET /api/services returns list of services', async () => {
      const res = await request('/api/services');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body)) throw new Error('Expected array of services');
      if (res.body.length === 0) throw new Error('Expected at least 1 service');
    });

    await test('GET /api/services returns exactly the approved four service names', async () => {
      const res = await request('/api/services');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const names = res.body.map((service) => service.name);
      const expected = ['ประคบหินร้อน', 'นวดเท้า', 'นวดตัว', 'กัวชา'];
      if (names.length !== expected.length) {
        throw new Error(`Expected ${expected.length} services, got ${names.length}: ${names.join(', ')}`);
      }
      const mismatch = expected.find((name, index) => names[index] !== name);
      if (mismatch) {
        throw new Error(`Expected service list to start with ${expected.join(', ')}, got ${names.join(', ')}`);
      }
      if (names.some((name) => name === 'กัวซา')) {
        throw new Error('Legacy alias กัวซา should not appear in the public service list');
      }
    });

    await test('Admin booking lists require admin authentication', async () => {
      for (const path of [
        '/api/bookings/admin/upcoming',
        '/api/bookings/admin/history',
      ]) {
        const res = await request(path);
        if (res.status !== 401 && res.status !== 403) {
          throw new Error(`Expected protected route response 401/403 for ${path}, got ${res.status}`);
        }
      }
    });

    await test('Booking detail and national ID endpoints require admin authentication', async () => {
      for (const path of [
        '/api/bookings/admin/test-booking/details',
        '/api/bookings/admin/test-booking/national-id',
      ]) {
        const res = await request(path);
        if (res.status !== 401 && res.status !== 403) {
          throw new Error(`Expected protected route response 401/403 for ${path}, got ${res.status}`);
        }
      }
    });

    await test('POST /api/staff/photo is not available without Firebase Storage', async () => {
      const res = await request('/api/staff/photo', { method: 'POST' });
      if (res.status !== 404) {
        throw new Error(`Expected removed upload route response 404, got ${res.status}`);
      }
    });

    await test('GET /api/staff/admin requires admin authentication', async () => {
      const res = await request('/api/staff/admin');
      if (res.status !== 401 && res.status !== 403) {
        throw new Error(`Expected protected route response 401/403, got ${res.status}`);
      }
    });

    // 3. Staff list
    await test('GET /api/staff returns list of therapists', async () => {
      const res = await request('/api/staff');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body)) throw new Error('Expected array of staff');
      if (res.body.length === 0) throw new Error('Expected at least 1 staff member');
      if (res.body.some((staff) => Object.hasOwn(staff, 'email') || Object.hasOwn(staff, 'phone'))) {
        throw new Error('Public staff responses must not expose private contact details');
      }
    });

    // 4. Queue status
    await test('GET /api/queue/status returns valid queue state', async () => {
      const res = await request('/api/queue/status');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (typeof res.body !== 'object') throw new Error('Expected object response');
    });

    // 5. Removed identity-provider endpoints stay unavailable.
    await test('GET /api/auth/thaid endpoints return 404', async () => {
      for (const path of [
        '/api/auth/thaid',
        '/api/auth/thaid/callback',
        '/api/auth/thaid/mock',
      ]) {
        const res = await request(path);
        if (res.status !== 404) throw new Error(`Expected 404 for ${path}, got ${res.status}`);
      }
    });

    // 6. Cancelled bookings should not count as active bookings
    await test('Cancelled bookings are excluded from active booking totals', async () => {
      if (typeof isBookingCounted !== 'function') throw new Error('Expected isBookingCounted helper export');
      if (typeof summarizeBookingCounts !== 'function') throw new Error('Expected summarizeBookingCounts helper export');

      const items = [
        { status: 'pending' },
        { status: 'cancelled' },
        { status: 'done' },
        { status: 'confirmed' },
      ];

      const activeOnly = items.filter(isBookingCounted);
      if (activeOnly.length !== 3) throw new Error(`Expected 3 active bookings, got ${activeOnly.length}`);

      const summary = summarizeBookingCounts(items);
      if (summary.total !== 3) throw new Error(`Expected total 3, got ${summary.total}`);
      if (summary.cancelled !== 0) throw new Error(`Expected cancelled count 0, got ${summary.cancelled}`);
      if (summary.revenue !== null) throw new Error('Revenue must remain unknown until payment data is recorded');
    });

    await test('Admin report dates use Bangkok calendar days', async () => {
      if (typeof getReportDates !== 'function') throw new Error('Expected getReportDates helper export');
      const dates = getReportDates(new Date('2026-10-13T17:30:00.000Z'));
      const expected = [
        '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11',
        '2026-10-12', '2026-10-13', '2026-10-14',
      ];
      if (JSON.stringify(dates) !== JSON.stringify(expected)) {
        throw new Error(`Expected Bangkok report dates ${expected.join(', ')}, got ${dates.join(', ')}`);
      }
    });

    await test('Operating hours accept bookings ending exactly at closing time', async () => {
      if (!isWithinOperatingHours('18:05', 45, '08:30', '18:50')) {
        throw new Error('Expected a booking ending at closing time to be allowed');
      }
    });

    await test('Operating hours reject bookings before opening or ending after closing', async () => {
      if (isWithinOperatingHours('08:00', 45, '08:30', '18:50')) {
        throw new Error('Expected a booking before opening time to be rejected');
      }
      if (isWithinOperatingHours('18:10', 45, '08:30', '18:50')) {
        throw new Error('Expected a booking ending after closing time to be rejected');
      }
    });

    await test('Booking time and operating-hours settings require valid 24-hour times', async () => {
      if (parseTimeToMinutes('18:50') !== 1130) throw new Error('Expected 18:50 to parse to 1130 minutes');
      for (const value of ['24:00', '12:60', '8:30', '']) {
        if (parseTimeToMinutes(value) !== null) throw new Error(`Expected ${value} to be rejected`);
      }
      if (isWithinOperatingHours('09:00', 60, '18:00', '08:00')) {
        throw new Error('Expected inverted operating hours to be rejected');
      }
    });

    await test('Operating hours reject invalid or non-positive service durations', async () => {
      for (const duration of [0, -45, Number.NaN, Number.POSITIVE_INFINITY]) {
        if (isWithinOperatingHours('09:00', duration, '08:30', '17:00')) {
          throw new Error(`Expected duration ${duration} to be rejected`);
        }
      }
    });

    // 7. 404 handler
    await test('GET /api/unknown-route returns 404 JSON', async () => {
      const res = await request('/api/unknown-route');
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      if (!res.body?.error) throw new Error('Expected JSON error message');
    });

    console.log(`\n========================================`);
    console.log(`📊 Test Summary: ${passed} passed, ${failed} failed`);
    console.log(`========================================\n`);

  } finally {
    server.close();
  }

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
