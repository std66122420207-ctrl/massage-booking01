// Stub สำหรับ platform ที่ไม่ใช่ Flutter Web (Android/iOS/desktop)
// โปรเจคนี้ตอนนี้ตั้งค่าไว้สำหรับ web เท่านั้น (ดู flutter-app/web/)
// ถ้าจะรันบนมือถือจริง ต้องเปลี่ยนมาใช้ deep link แทน
// (เช่น package `app_links` + custom URL scheme + แก้ AndroidManifest.xml /
// Info.plist ให้รับ scheme นั้น แล้วให้ server redirect กลับมาที่ scheme
// นั้นแทนการ redirect กลับ URL เว็บ)

void redirectToThaidLogin(String thaidLoginUrl) {
  throw UnsupportedError(
    'ThaiD login ผ่าน web redirect รองรับเฉพาะ Flutter Web ในตอนนี้ '
    'สำหรับ Android/iOS ต้องเพิ่ม deep link handling ก่อน',
  );
}

String? consumeThaidTokenFromUrl() => null;
