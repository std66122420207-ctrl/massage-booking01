// ============================================================
//  Automated API Test Suite
//  รัน: node scripts/test_api.js
// ============================================================
require('dotenv').config();
const http = require('http');
const app  = require('../index');

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

    // 3. Staff list
    await test('GET /api/staff returns list of therapists', async () => {
      const res = await request('/api/staff');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body)) throw new Error('Expected array of staff');
      if (res.body.length === 0) throw new Error('Expected at least 1 staff member');
    });

    // 4. Queue status
    await test('GET /api/queue/status returns valid queue state', async () => {
      const res = await request('/api/queue/status');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (typeof res.body !== 'object') throw new Error('Expected object response');
    });

    // 5. ThaiD mock page
    await test('GET /api/auth/thaid/mock returns mock HTML form', async () => {
      const res = await request('/api/auth/thaid/mock');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.text.includes('จำลองการยืนยันตัวตนด้วย ThaiD')) {
        throw new Error('Expected HTML containing mock ThaiD form');
      }
    });

    // 6. 404 handler
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
