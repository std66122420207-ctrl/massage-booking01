function normalizeThaiMobilePhone(phone) {
  return String(phone).replace(/[\s-]/g, '');
}

function isValidThaiMobilePhone(phone) {
  return typeof phone === 'string'
    && /^0[689]\d{8}$/.test(normalizeThaiMobilePhone(phone));
}

module.exports = { normalizeThaiMobilePhone, isValidThaiMobilePhone };
