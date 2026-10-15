const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmailAddress } = require('../utils/emailAddress');

test('normalizes email addresses for case-insensitive uniqueness checks', () => {
  assert.equal(normalizeEmailAddress('  Example.User@Example.com '), 'example.user@example.com');
  assert.equal(normalizeEmailAddress(null), '');
});
