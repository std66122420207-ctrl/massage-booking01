# 🌿 ระบบจองคิวนวดแผนไทย — ศูนย์สุขภาพชุมชนท่าวังหิน

## � วิธีรันเร็วจาก root project

```bash
# backend API
npm run dev:server

# web admin (serve static files)
npm run dev:admin

# flutter web app
npm run dev:flutter

# ทดสอบ backend
npm run test:server

# ทดสอบการจองชนกัน (ต้องติดตั้ง Java สำหรับ Firestore Emulator)
npm run test:booking-concurrency
```

> คำสั่งเหล่านี้ช่วยให้รันจาก root ของโปรเจคได้โดยตรง ไม่ต้องเข้าไปใน subfolder เองทุกครั้ง
> การทดสอบการจองชนกันใช้ Firebase Emulator project แยก ไม่แก้ข้อมูลบน Firebase จริง
## 🚀 เตรียม Deploy ไป Firebase

โปรเจกต์นี้กำหนด Firebase project `massage-booking-ce032` พร้อม Hosting สองเว็บ:
หน้าแอดมิน `massage-booking-ce032` และแอปลูกค้า `massage-booking-customer`.
คำสั่งด้านล่าง deploy ทั้ง Cloud Functions, Firestore rules/indexes และ Hosting
แต่จะหยุดเองหากชุดทดสอบหรือ Flutter Web build ไม่ผ่าน

### ตั้งค่าก่อน Deploy (ทำครั้งเดียว)

1. เปิดใช้ Firebase Authentication (Email/Password และ Phone), Firestore, Storage,
   Cloud Messaging และเปิด Billing plan ที่รองรับ Cloud Scheduler/Cloud Functions
   สำหรับ worker ที่ทำงานทุก 1 นาที
   เพิ่ม `massage-booking-ce032.web.app` และ `massage-booking-customer.web.app` ใน
   Authentication → Settings → Authorized domains ด้วย
2. สร้างผู้ใช้แอดมินใน Firebase Authentication แล้วกำหนด custom claim `admin: true`
   ด้วย `node server/scripts/setAdmin.js <อีเมลแอดมิน>`.
3. สร้างไฟล์ `.env.massage-booking-ce032` ที่ root ของ repository และกำหนด origin
   ของเว็บที่อนุญาตให้เรียก API:

   ```dotenv
   FRONTEND_URL=https://massage-booking-ce032.web.app,https://massage-booking-customer.web.app
   ```

   ไฟล์ `.env.*` ถูกเพิ่มใน ignore rules แล้ว ห้าม commit secret หรือ service-account key
   เข้า repository.
4. เปิด Firebase Console → Project settings → Cloud Messaging → Web Push certificates
   แล้วเตรียม public VAPID key สำหรับ build ของแอปลูกค้า (เป็น public key ไม่ใช่ private key).

### ตรวจสอบและ Deploy

```powershell
firebase login
firebase use massage-booking-ce032
$env:FCM_VAPID_KEY = Read-Host "Paste the Web Push public VAPID key"
npm run predeploy:firebase
npm run test:booking-concurrency
npm audit --omit=dev
npm run analyze:flutter
npm run test:flutter
firebase deploy --only functions,firestore:rules,firestore:indexes,hosting
```

ก่อนปล่อยจริงให้ทดสอบล็อกอิน/จอง/ยกเลิก/แจ้งเตือน/อัปโหลดรูป และยืนยันว่า
Cloud Scheduler ทำงานได้หลัง deploy; การแจ้งเตือนผ่าน SMS ต้องตั้งค่า Twilio เพิ่ม
การ deploy เป็นขั้นตอนที่ผู้ดูแลต้องเรียกใช้เอง; การตรวจสอบในเครื่องไม่เปลี่ยน
ทรัพยากรบน Firebase.
## �📝 การแก้ไขล่าสุด (Changelog)

### รอบ 9: ตรวจสอบผ่านในเครื่อง (ยังไม่ได้ Deploy)
- **Server:**
  - เพิ่ม `require('dotenv').config()` ใน `server/config/firebase.js` ให้โหลด env ได้อย่างมั่นคงในทุกสถานการณ์
  - เพิ่มชุดทดสอบอัตโนมัติ `server/scripts/test_api.js` (รันผ่าน `npm test`) ทดสอบทุก Endpoint พร้อมรายงานผล
  - ยืนยันการเชื่อมต่อ Firestore และ Seed ข้อมูลบริการและหมอนวดครบถ้วน
- **Firestore Security Rules:**
  - เพิ่ม Rule สำหรับ `notifications` และ `settings` collection ครบถ้วนตามมาตรฐานความปลอดภัย
- **Flutter App:**
  - เคลียร์ Lint Warnings ทั้งหมด (`flutter analyze` ผ่าน 100% 0 issues)
  - ทดสอบ `flutter test` ผ่านทุก test case
  - คอมไพล์ Flutter Web ผ่าน (`flutter build web` สำเร็จสมบูรณ์)
- **Web Admin & Demo:**
  - รองรับการใช้งาน Dashboard, คิว, การจอง, หมอนวด, รายงาน, และการตั้งค่า พร้อมเชื่อมต่อ backend จริง

### รอบ 3: Production-ready + ปรับดีไซน์
**Server:**
- เพิ่ม `helmet` (security headers), `express-rate-limit` (กัน brute-force/spam โดยเฉพาะ auth), `compression`, `morgan` (logging)
- เพิ่ม `server/config/validateEnv.js` — เช็ค env variable ที่จำเป็นตอนสตาร์ท ไม่ปล่อยให้พังกลางทาง
- แก้ CORS ให้รับ origin เฉพาะจาก `FRONTEND_URL` แทน `*` ตอน production (รองรับหลาย origin คั่นด้วย comma)
- เพิ่ม graceful shutdown (SIGTERM/SIGINT) — ปิด server อย่างนุ่มนวลตอน deploy ใหม่
- เพิ่ม `server/scripts/setAdmin.js` — ให้สิทธิ์ admin กับผู้ใช้ (จำเป็นก่อนหน้านี้ **ไม่มีทางตั้งแอดมินได้เลย**)

**Web Admin — พบว่าไม่ได้เชื่อมกับ backend จริงเลย:**
- `index.html` เดิมมี inline mock script ทับอยู่ ไม่ได้โหลด `js/api.js` / `js/app.js` / `js/config.js` ที่เขียนไว้แล้ว (ไฟล์เหล่านี้เป็น dead code มาตลอด) และ **ไม่มีหน้า login เลย** ทำให้ endpoint ที่ต้อง auth ใช้งานไม่ได้
- เพิ่มหน้า login (อีเมล/รหัสผ่าน ผ่าน Firebase Auth) พร้อมเช็ค custom claim `admin` ก่อนปล่อยเข้าใช้งาน
- โหลด Firebase SDK + `config.js`/`api.js`/`app.js` จริง แทน mock script, เพิ่มข้อความแจ้งเตือนเมื่อเชื่อม backend ไม่ได้ (เดิมล้มเหลวเงียบๆ)

**ดีไซน์ (ทั้งสองแอป):**
- Flutter: ปรับ theme ให้เป็นโทนสีเดียวกับ web-admin (jade/forest green + Noto Serif Thai/Sarabun) ให้แบรนด์ตรงกัน ปรับ input/button/card/snackbar ให้ดูพรีเมียมขึ้น
- Web-admin: ดีไซน์เดิมดีอยู่แล้ว (จัดกลุ่ม sidebar/status badge เรียบร้อย) เพิ่มแค่หน้า login ให้เข้าธีมเดียวกัน

### รอบ 8: เปลี่ยนอีโมจิเป็นไอคอนจริง + ใส่โลโก้แอพ
- **Web-admin:** เพิ่ม Font Awesome → เปลี่ยนไอคอนในเมนู sidebar, ปุ่ม, การ์ดสถิติ, ช่องค้นหา,
  รูปหมอนวด default ทั้งหมดจากอีโมจิเป็นไอคอนชุดเดียวกัน ดูเป็นระเบียบขึ้น
- **Flutter app:** ปรับไอคอนหน้าเข้าสู่ระบบ, หน้าว่างเปล่า (ไม่มีคิว/ไม่มีประวัติ), badge ยืนยันตัวตน
  จากอีโมจิเป็น Material Icons
- **ใส่โลโก้จริง** (ไฟล์ที่ผู้ใช้ส่งมา) แทนอีโมจิ 🌿 เดิม ที่: หน้า splash, หน้า login, header หน้าแรก
  ของแอป, และ sidebar + หน้า login ของ web-admin
  - ไฟล์อยู่ที่ `web-admin/public/img/logo.jpeg` และ `flutter-app/assets/images/logo.jpeg`
  - ลงทะเบียนใน `pubspec.yaml` แล้ว (`flutter: assets:`)
- **จงใจไม่แตะ:** ไอคอนบริการแต่ละอย่าง (💆🌸🦶👑 ใน `services_screen.dart`/`models.dart`) เพราะเป็น
  ข้อมูลต่อรายการที่มาจาก backend จริงๆ (เหมือนให้แอดมินเลือกไอคอนต่อบริการ) ไม่ใช่ปัญหา UI รก —
  ถ้าอยากเปลี่ยนเป็น Material Icons ด้วย บอกได้ แต่ต้องแก้โครงสร้างข้อมูลใน backend ร่วมด้วย

### รอบ 5: Flutter — หน้ากรอกเบอร์โทรและระบบแจ้งเตือน/ยืนยัน
- ผู้ใช้ที่ไม่มีเบอร์โทรในโปรไฟล์จะเจอหน้า "ขอเบอร์โทรศัพท์" ก่อนเข้าแอป
  (`screens/phone_required_screen.dart`) — บันทึกผ่าน `PATCH /api/auth/me`
- เพิ่มหน้าแจ้งเตือน (`screens/notifications_screen.dart`) เปิดจากไอคอนกระดิ่งที่หน้าแรก
  มี badge ตัวเลขแจ้งเตือนที่ยังไม่ยืนยัน และปุ่ม "รับทราบแล้ว" ต่อรายการ
- แก้บั๊ก: `BookingModel`/`NotificationModel` แปลงค่า `createdAt` ผิด — โค้ดเดิมสมมติว่าเป็น
  Firestore Timestamp object ที่มี `.toDate()` แต่พอเรียกผ่าน REST API จริงจะได้ JSON
  รูปแบบ `{_seconds, _nanoseconds}` แทน ถ้าไม่แก้จะ error ตอนรันจริงทุกครั้งที่มี booking

### รอบ 4: แอดมินแก้ไข/เพิ่มข้อมูลหมอนวด + ปรับ UI ให้ตรงตามภาพตัวอย่าง
- เพิ่มฟิลด์ `photo` (URL รูปภาพ) ให้หมอนวด — แสดงเป็นรูปวงกลมแทนไอคอนถ้ามี
- หน้า "แพทย์/หมอนวด" มีปุ่ม "+ เพิ่มหมอนวดใหม่" และปุ่ม "แก้ไขข้อมูล" ต่อการ์ด เปิดเป็นฟอร์ม modal
  (ชื่อ, อีเมล, ประสบการณ์, URL รูปภาพ) แทนที่จะพิมพ์ผ่าน prompt
- ย้ายปุ่ม "Sync to Google Sheets" และ "Email หมอนวด" ไปไว้ที่แถบด้านบน (topbar) ให้ตรงกับภาพตัวอย่าง
- เพิ่มการ์ดสถิติ "หมอนวดทั้งหมด" และ "รอการยืนยัน" ในหน้า Dashboard

### รอบ 3: Google Sheets sync + ส่งอีเมลหมอนวด + เบอร์โทรสำรอง + ยืนยันการแจ้งเตือน
- **Admin:** ปุ่ม "Sync to Google Sheets" — ซิงค์รายการจองทั้งหมดไปที่ Google Sheets (`POST /api/admin/sync-sheets`)
- **Admin:** ปุ่ม "Email หมอนวด" — ส่งอีเมลแจ้งคิวให้หมอนวดแต่ละคน โดยแยกเฉพาะคิวของตัวเอง ไม่ปนกับคนอื่น (`POST /api/admin/notify-therapists`)
- **User:** ทุกบัญชีต้องมีเบอร์โทรในโปรไฟล์เพื่อให้แอดมินติดต่อได้กรณีแอปแจ้งเตือนไม่ถึง
- **User:** เพิ่มระบบแจ้งเตือน + ปุ่มกดยืนยันว่าเห็นแล้ว (`GET/POST /api/notifications`) — ถ้าผู้ใช้ไม่กดยืนยัน แอดมินจะเห็นสถานะ "ยังไม่ยืนยัน" พร้อมเบอร์โทรใน `GET /api/notifications/admin/all`
- เพิ่มฟิลด์ `email` ให้หมอนวด (`staff` collection) พร้อม endpoint จัดการ (`POST/PATCH /api/staff`)

#### ตั้งค่า Google Sheets
1. ไปที่ https://console.cloud.google.com/ → สร้างโปรเจคใหม่ (หรือใช้โปรเจค Firebase เดิมก็ได้ เพราะ Firebase project เป็น Google Cloud project อยู่แล้ว)
2. เปิดใช้งาน **Google Sheets API**: เมนู "APIs & Services" → "Enable APIs and Services" → ค้นหา "Google Sheets API" → Enable
3. สร้าง Service Account: "APIs & Services" → "Credentials" → "Create Credentials" → "Service Account" → ตั้งชื่ออะไรก็ได้ → Create and Continue → Done
4. เปิด Service Account ที่สร้าง → แท็บ "Keys" → "Add Key" → "Create new key" → เลือก JSON → ดาวน์โหลดไฟล์
5. เปิดไฟล์ JSON ที่ดาวน์โหลด จะเจอ `client_email` และ `private_key` → เอาไปใส่ใน `.env`:
   - `GOOGLE_SHEETS_CLIENT_EMAIL` = ค่า `client_email`
   - `GOOGLE_SHEETS_PRIVATE_KEY` = ค่า `private_key` (ใส่ทั้งหมดรวม `\n` ในเครื่องหมายคำพูด)
6. สร้าง Google Sheet ใหม่ → ตั้งชื่อ tab (sheet) แรกว่า `Bookings` → ก็อป spreadsheet ID จาก URL
   (เช่น `docs.google.com/spreadsheets/d/`**`นี่คือ-spreadsheet-id`**`/edit`) → ใส่ใน `GOOGLE_SHEETS_SPREADSHEET_ID`
7. **สำคัญ:** เปิด Google Sheet นั้น → กด "Share" → เอาอีเมลจาก `client_email` (ขั้นตอน 5) ไปแชร์แบบ "Editor" — ไม่งั้น service account จะเข้าไม่ถึงชีต

#### ตั้งค่าอีเมล (Gmail App Password)
1. เข้า https://myaccount.google.com/security
2. เปิด **2-Step Verification** ให้เรียบร้อยก่อน (ถ้ายังไม่เปิด จะสร้าง App Password ไม่ได้)
3. ไปที่ https://myaccount.google.com/apppasswords
4. ตั้งชื่อ (เช่น "massage-booking-server") → Create → จะได้รหัส 16 หลัก
5. ใส่ใน `.env`:
   - `GMAIL_USER` = อีเมล Gmail ของคุณ
   - `GMAIL_APP_PASSWORD` = รหัส 16 หลักที่ได้ (ใส่ตามที่แสดง มีเว้นวรรคได้)

**หมายเหตุ:** ทั้งสองอย่างนี้ไม่ตั้งก็รันระบบได้ปกติ (ปุ่มจะแจ้ง error สุภาพๆ ว่ายังไม่ได้ตั้งค่า แทนที่จะพังทั้งระบบ)

### รอบ 2: เชื่อม Flutter app เข้ากับ backend จริง
- `AuthService` เปลี่ยนจาก mock (`Future.delayed` + ข้อมูลปลอม) เป็นของจริง:
  - เข้าสู่ระบบด้วยเบอร์โทร → ใช้ Firebase Phone Auth จริง (`verifyPhoneNumber` / OTP 6 หลัก)
  - เข้าสู่ระบบและสมัครสมาชิกด้วยอีเมล/รหัสผ่านผ่าน Firebase Authentication
  - หลัง login สำเร็จจะเรียก `GET /api/auth/me` หรือ `POST /api/auth/register` เพื่อซิงค์โปรไฟล์กับ Firestore จริง
- `BookingService` เปลี่ยนจาก mock ในหน่วยความจำ เป็นเรียก backend จริงทั้งหมด
  (`GET /api/services`, `GET/POST/DELETE /api/bookings`, `GET /api/queue/my`)
- เพิ่ม `lib/services/api_client.dart` — ตัวกลางแนบ Firebase ID token ให้ทุก request อัตโนมัติ
- เพิ่ม `lib/config/api_config.dart` — ตั้งค่า URL ของ server (แก้ตอน deploy จริง หรือใช้
  `flutter run --dart-define=API_BASE_URL=http://192.168.x.x:3000/api` ตอน dev)
- เพิ่ม `lib/firebase_options.dart` (placeholder) — **ต้องรัน `flutterfire configure` ก่อนใช้งานจริง**
  ไม่งั้น `Firebase.initializeApp()` จะ error เพราะเป็นค่า YOUR_API_KEY ปลอม
**ข้อควรรู้:** การเข้าสู่ระบบใช้ Firebase Authentication (อีเมล/รหัสผ่านหรือเบอร์โทร/OTP)
ต้องเปิด provider ที่ใช้ใน Firebase Console และตั้งค่าโดเมนที่อนุญาตก่อนทดสอบจริง

### รอบ 1: แก้บั๊ก server

- แก้ปัญหา unhandled promise ใน `POST /api/bookings` และเปลี่ยนไปใช้ Firestore transaction
  เพื่อป้องกันการจองซ้ำเวลาเดียวกันพร้อมกัน (race condition)
- แก้ catch-all route ใน `server/index.js` ไม่ให้ตอบ HTML กลับไปเมื่อยิง `/api/*` ที่ไม่มีจริง (ตอบ JSON 404 แทน) และเพิ่ม global error handler
- เพิ่ม `firestore.indexes.json` และ `firebase.json` สำหรับ composite index ที่ query ต้องใช้ (ไม่มีมาก่อนจะทำให้ query ล้มเหลวตอน production)
- ล้างไฟล์ที่ไม่ควรอยู่ใน repo ออก (`.dart_tool/`, `build/`, `.idea/`, Chrome profile cache ที่ติดมากับ zip ~20MB+)
- **ที่ยังไม่ได้แก้ (รู้ไว้ก่อน):** `AuthService` และ `BookingService` ฝั่ง Flutter ยังเป็น mock data (`Future.delayed` + ข้อมูลปลอม) ไม่ได้เรียก backend จริง — ฝั่ง web-admin เชื่อมกับ API จริงแล้ว

โปรเจคพัฒนาแอปพลิเคชันจองคิวนวดแผนไทย  
**ผู้พัฒนา:** ณัฐพงษ์ กิ้งมาลา (66122420207)  
**อาจารย์ที่ปรึกษา:** ผศ.ดร.ธิติพร ชาญศิริวัฒน์  
**สาขา:** วิทยาการคอมพิวเตอร์ มหาวิทยาลัยราชภัฏอุบลราชธานี

---

## 🛠 เทคโนโลยีที่ใช้ (ตามที่ระบุในเอกสาร)

| ส่วนงาน | เทคโนโลยี |
|---------|-----------|
| Mobile App | **Flutter** |
| Database | **Firebase** (Firestore + Authentication) |
| ยืนยันตัวตน | **Firebase Authentication (อีเมล/รหัสผ่าน หรือเบอร์โทร/OTP)** |
| Web Admin | **HTML, CSS, JavaScript** |
| Server | **Node.js + Express** |
| Editor | Visual Studio Code |

---

## 📁 โครงสร้างโปรเจค

```
massage-booking/
├── server/                    → Node.js + Express API
│   ├── config/firebase.js     → Firebase Admin SDK config
│   ├── middleware/auth.js     → JWT/Firebase token verification
│   ├── routes/
│   │   ├── auth.js            → phone profile registration
│   │   ├── bookings.js        → CRUD การจอง
│   │   ├── queue.js           → จัดการคิว real-time
│   │   ├── services.js        → รายการบริการ
│   │   └── staff.js           → ข้อมูลหมอนวด
│   ├── scripts/seed.js        → สคริปต์เพิ่มข้อมูลตัวอย่าง
│   ├── index.js                → Entry point
│   ├── package.json
│   └── .env.example            → ตัวอย่างไฟล์ตั้งค่า
│
├── web-admin/public/           → Web Admin (HTML/CSS/JS)
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── config.js           → Firebase config (ฝั่ง client)
│       ├── api.js              → เรียก API ไป server
│       └── app.js               → Logic หลักของหน้า Admin
│
├── flutter-app/                → Flutter Mobile App
│   ├── lib/
│   │   ├── main.dart
│   │   ├── models/models.dart
│   │   ├── services/
│   │   │   ├── auth_service.dart
│   │   │   └── booking_service.dart
│   │   └── screens/
│   │       ├── splash_screen.dart
│   │       ├── login_screen.dart
│   │       ├── home_screen.dart
│   │       ├── services_screen.dart      (+ booking sheet)
│   │       ├── my_bookings_screen.dart
│   │       ├── queue_screen.dart
│   │       └── profile_screen.dart
│   └── pubspec.yaml
│
├── firestore.rules             → Firestore Security Rules
└── .gitignore

---

## 🚀 วิธีติดตั้งและรันโปรเจค

### 1️⃣ ตั้งค่า Firebase

1. สร้างโปรเจคที่ [Firebase Console](https://console.firebase.google.com/)
2. เปิดใช้งาน **Authentication** → Email/Password และ Phone
3. เปิดใช้งาน **Firestore Database**
4. เปิดใช้งาน **Storage** และตรวจสอบ bucket name ในหน้า Storage
5. สำหรับการรันในเครื่อง ตั้งค่า Firebase Admin credentials ใน `server/.env`.
   บน Firebase Cloud Functions ให้ใช้ service identity/Application Default Credentials
   และอย่านำไฟล์ private key เข้า source control หรือใส่ใน deployment bundle

### 2️⃣ ตั้งค่า Server (Node.js + Express)

```bash
cd server
npm install
cp .env.example .env
# แก้ไข .env ใส่ค่า Firebase Admin SDK ของจริง
# ตั้ง FIREBASE_STORAGE_BUCKET ให้ตรงกับชื่อ bucket ใน Firebase Storage

# วางไฟล์ serviceAccountKey.json (ถ้าจะใช้วิธีไฟล์แทน .env)

npm run dev      # หรือ npm start
```

Server จะรันที่ `http://localhost:3000`
- API: `http://localhost:3000/api`
- Web Admin: `http://localhost:3000` (เสิร์ฟไฟล์ static อัตโนมัติ)

การอัปโหลดรูปหมอนวดใช้ Firebase Admin SDK ผ่าน API และรองรับ JPG, PNG, WebP ขนาดไม่เกิน 5 MB บัญชี Service Account ของ Server ต้องมีสิทธิ์เขียน Firebase Storage objects

### 3️⃣ เพิ่มข้อมูลตัวอย่าง (บริการ + หมอนวด)

```bash
cd server
node scripts/seed.js
```

### 4️⃣ ตั้งค่า Web Admin

แก้ไข `web-admin/public/js/config.js` ใส่ Firebase config ฝั่ง Web:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  // ...
};
```

เปิด browser ไปที่ `http://localhost:3000`

### 5️⃣ ตั้งค่า Flutter App

```bash
cd flutter-app
flutter pub get

# ติดตั้ง Firebase สำหรับ Flutter
flutter pub global activate flutterfire_cli
flutterfire configure   # เลือกโปรเจค Firebase ที่สร้างไว้

flutter run
```

> ต้องวาง `google-services.json` (Android) และ `GoogleService-Info.plist` (iOS) ตามที่ flutterfire configure สร้างให้

---

## ✨ ฟีเจอร์ตามขอบเขตระบบ

### Mobile App (Flutter)
- [x] สมัครสมาชิก / Login ด้วยอีเมล/รหัสผ่าน หรือเบอร์โทร/OTP
- [x] จองคิวล่วงหน้า (ไม่เกิน 3 วัน)
- [x] สิทธิบัตรทอง/ประกันสังคม: เลขบัตรและสิทธิเดียวกันจองได้วันละ 1 ครั้ง (ยกเลิกแล้วจองใหม่ได้; จ่ายตรงไม่จำกัด)
- [x] ดูลำดับคิว แบบ real-time
- [x] ประวัติการจอง
- [x] แจ้งเตือนก่อนนัด 1 ชั่วโมง, 30 นาที และ 15 นาที; เมื่อถึงเวลานัดให้ลูกค้ายืนยันการมาถึงภายใน 5 นาที มิฉะนั้นระบบยกเลิกคิวอัตโนมัติ
- [x] เมื่อเริ่มให้บริการ ระบบเปลี่ยนเป็น “เสร็จสิ้น” เมื่อครบระยะเวลาบริการที่บันทึกไว้จากบริการที่เลือก (worker ตรวจทุก 1 นาที; เวลาอิง Asia/Bangkok; Push/SMS ขึ้นกับการตั้งค่าผู้ให้บริการ)

### Web Admin
- [x] Dashboard สรุปภาพรวม + กราฟแนวโน้ม
- [x] จัดการคิว (เรียก/ยกเลิก/ยืนยัน/เสร็จสิ้น)
- [x] เพิ่ม/แก้ไขการจอง
- [x] ข้อมูลหมอนวด
- [x] รายงานสถิติการใช้งาน

---

## 📌 หมายเหตุสำคัญ

- โค้ดชุดนี้คือ **โครงสร้างโปรเจคที่พร้อมพัฒนาต่อ (scaffold)** ใช้เทคโนโลยีตรงตามเอกสารที่กำหนด
- ต้องเชื่อมต่อ Firebase project จริงและเปิด Authentication providers ที่เลือกใช้ก่อนใช้งานจริง
- Web Admin มี fallback ข้อมูลตัวอย่างในตัว เพื่อให้ทดสอบ UI ได้ทันทีแม้ backend ยังไม่ตั้งค่าเสร็จ
- Flutter app ต้องรัน `flutter pub get` และตั้งค่า Firebase ผ่าน `flutterfire configure` ก่อนใช้งาน
