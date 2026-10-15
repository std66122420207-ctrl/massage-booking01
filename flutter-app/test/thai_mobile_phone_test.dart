import 'package:flutter_test/flutter_test.dart';
import 'package:massage_booking/utils/thai_mobile_phone.dart';

void main() {
  test('accepts 10-digit Thai mobile numbers beginning with 06, 08, or 09', () {
    expect(isValidThaiMobilePhone('0612345678'), isTrue);
    expect(isValidThaiMobilePhone('0812345678'), isTrue);
    expect(isValidThaiMobilePhone('0912345678'), isTrue);
  });

  test('rejects unsupported prefixes and numbers not exactly 10 digits', () {
    expect(isValidThaiMobilePhone('0712345678'), isFalse);
    expect(isValidThaiMobilePhone('081234567'), isFalse);
    expect(isValidThaiMobilePhone('08123456789'), isFalse);
  });

  test('normalizes display separators before validating', () {
    expect(normalizeThaiMobilePhone('081-234 5678'), '0812345678');
    expect(isValidThaiMobilePhone('081-234 5678'), isTrue);
  });
}
