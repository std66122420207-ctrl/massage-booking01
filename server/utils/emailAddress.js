function normalizeEmailAddress(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

module.exports = { normalizeEmailAddress };
