const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isValidThaiMobilePhone,
  normalizeThaiMobilePhone,
} = require('../utils/thaiMobilePhone');

test('accepts 10-digit Thai mobile numbers beginning with 06, 08, or 09', () => {
  for (const phone of ['0612345678', '0812345678', '0912345678']) {
    assert.equal(isValidThaiMobilePhone(phone), true);
  }
});

test('rejects numbers with an unsupported prefix or a length other than 10 digits', () => {
  for (const phone of [
    '0712345678',
    '081234567',
    '08123456789',
    '1234567890',
    '',
  ]) {
    assert.equal(isValidThaiMobilePhone(phone), false);
  }
});

test('allows display separators but validates and stores the 10-digit number', () => {
  const phone = '081-234-5678';
  assert.equal(isValidThaiMobilePhone(phone), true);
  assert.equal(normalizeThaiMobilePhone(phone), '0812345678');
});

test('rejects non-string values', () => {
  assert.equal(isValidThaiMobilePhone(812345678), false);
});
