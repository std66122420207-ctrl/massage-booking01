String normalizeThaiMobilePhone(String phone) {
  return phone.replaceAll(RegExp(r'[\s-]'), '');
}

bool isValidThaiMobilePhone(String phone) {
  return RegExp(r'^0[689]\d{8}$').hasMatch(normalizeThaiMobilePhone(phone));
}
