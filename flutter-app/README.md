# แอปจองคิวนวดแผนไทย

แอป Flutter สำหรับจองคิวและรับบริการจากศูนย์สุขภาพชุมชนท่าวังหิน

## การตั้งค่า Firebase Authentication และ Firestore

การเข้าสู่ระบบของแอปใช้ Firebase Authentication แบบ Email/Password โดยสมัครสมาชิกแล้วจะบันทึกโปรไฟล์ไปที่ `users/{uid}` ใน Cloud Firestore ได้แก่ `name`, `citizenId`, `phone`, `email`, `role`, `createdAt` และ `updatedAt` ผู้ใช้ทั่วไปมี `role: user` และ Firestore Rules จำกัดการอ่าน/แก้ไขโปรไฟล์ไว้ที่เจ้าของบัญชี

ก่อนทดสอบ:

1. ใน Firebase Console เปิด Authentication provider **Email/Password** และสร้าง Cloud Firestore database
2. จากโฟลเดอร์ repository หลัก deploy กฎ Firestore ด้วย `firebase deploy --only firestore:rules`
3. สร้าง/อัปเดตค่า config ของ Flutter ทุก platform ที่ต้องการใช้:

   ```powershell
   cd flutter-app
   dart pub global activate flutterfire_cli
   flutterfire configure --project=massage-booking-ce032
   ```

   `lib/firebase_options.dart` มีค่า Android/iOS placeholder อยู่ ต้องรัน `flutterfire configure` ก่อนใช้งานบน platform เหล่านั้น ส่วน Web ใช้ค่า Firebase project ที่ตั้งไว้ในไฟล์แล้ว

หน้าล็อกอินมีสมัครสมาชิก เข้าสู่ระบบ และส่งอีเมลตั้งรหัสผ่านใหม่ บัญชีใหม่ต้องกรอกชื่อ เลขบัตรประชาชน 13 หลัก เบอร์โทร อีเมล และรหัสผ่านอย่างน้อย 6 ตัวอักษร

ส่วนบริการและการจองยังเรียก backend API ตามระบบเดิม งานนี้ยังไม่ได้ย้าย collection `services`, `bookings`, `notifications` หรือ `queue` ให้แอปอ่าน/เขียน Firestore โดยตรง กฎ Firestore จึงปิดการเขียน `bookings` จาก client เพื่อไม่ให้ข้ามการตรวจสิทธิและการจองซ้ำของ backend

## URL ของ API และ Push Notification

- Flutter Web บน Firebase Hosting ใช้ `/api` บนโดเมนเดียวกับเว็บโดยอัตโนมัติ; รัน Flutter Web ในเครื่องจะเชื่อม `localhost:3000`
- Android Emulator ใช้ `10.0.2.2:3000` ใน debug; Android/iOS release ต้องกำหนด URL backend ที่ deploy แล้วก่อน build
- เปลี่ยน backend สำหรับ build/run ได้ด้วย `--dart-define=API_BASE_URL=https://your-api.example/api` โดยไม่ต้องแก้ source
- Web Push ต้องตั้งค่า VAPID public key จาก Firebase Console แล้ว build ด้วย `--dart-define=FCM_VAPID_KEY=...`; หากไม่กำหนด ระบบยังใช้หน้าแอปและ in-app notification ได้ แต่จะไม่ลงทะเบียน Web Push token
- `web/firebase-messaging-sw.js` ใช้ Firebase Web app ของโปรเจกต์นี้เพื่อแสดง push notification ขณะเว็บอยู่เบื้องหลัง

## รายละเอียดการจองและการยกเลิกคิว

หน้า **การจองของฉัน** แสดงรายการจองล่วงหน้าและประวัติ ผู้ใช้เปิดการ์ดหรือกด **ดูรายละเอียด** เพื่อตรวจหมายเลขคิว บริการ วันที่ เวลา หมอนวด สิทธิ และราคาได้ การจองที่ยังไม่เริ่มให้บริการยกเลิกได้จากการ์ด เมื่อยกเลิกแล้วจึงจองใหม่ภายใต้ข้อจำกัดสิทธิเดิมได้; คิวที่กำลังให้บริการหรือเสร็จแล้วไม่สามารถยกเลิกผ่านแอปได้

## ฝั่งผู้ดูแล

แผงควบคุมแสดงรายชื่อการจองของวันนี้ ส่วนหน้า **จัดการคิว** มีตารางการจองล่วงหน้าทุกวัน พร้อมตัวกรองวันที่ และอัปเดตรายการเป็นระยะ การเรียกคิวทำได้จากรายการคิววันนี้เท่านั้น
