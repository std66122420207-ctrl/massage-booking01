# 🌿 ระบบจองคิวนวดแผนไทย — ศูนย์สุขภาพชุมชนท่าวังหิน

## 📝 การแก้ไขล่าสุด (Changelog)

### รอบ 9: เสร็จสมบูรณ์ 100% (Complete & Verified)
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
- **Flutter app:** เปลี่ยนไอคอนปุ่ม ThaiD/OTP, หน้าว่างเปล่า (ไม่มีคิว/ไม่มีประวัติ), badge ยืนยันตัวตน
  จากอีโมจิเป็น Material Icons
- **ใส่โลโก้จริง** (ไฟล์ที่ผู้ใช้ส่งมา) แทนอีโมจิ 🌿 เดิม ที่: หน้า splash, หน้า login, header หน้าแรก
  ของแอป, และ sidebar + หน้า login ของ web-admin
  - ไฟล์อยู่ที่ `web-admin/public/img/logo.jpeg` และ `flutter-app/assets/images/logo.jpeg`
  - ลงทะเบียนใน `pubspec.yaml` แล้ว (`flutter: assets:`)
- **จงใจไม่แตะ:** ไอคอนบริการแต่ละอย่าง (💆🌸🦶👑 ใน `services_screen.dart`/`models.dart`) เพราะเป็น
  ข้อมูลต่อรายการที่มาจาก backend จริงๆ (เหมือนให้แอดมินเลือกไอคอนต่อบริการ) ไม่ใช่ปัญหา UI รก —
  ถ้าอยากเปลี่ยนเป็น Material Icons ด้วย บอกได้ แต่ต้องแก้โครงสร้างข้อมูลใน backend ร่วมด้วย

### รอบ 7: ทำให้ใช้กับ ThaiD ของจริงได้ (ไม่ใช่แค่จำลอง)

โค้ด ThaiD flow เดิมเดา endpoint เอง (`/api/v2/oauth2/auth`, `/token`, `/userinfo`) และไม่มี PKCE
หรือตรวจลายเซ็น ID Token เลย — แก้ใหม่ทั้งหมดให้ตรงตามมาตรฐาน OpenID Connect และอ้างอิงจาก
[ตัวอย่างทางการของ ETDA (ThaiD-Python-RP)](https://github.com/ETDA/ThaiD-Python-RP):

- **OIDC Discovery** — โหลด endpoint จริงจาก `/.well-known/openid-configuration` แทนการ hardcode path
  (cache ไว้ 1 ชั่วโมง กันยิงซ้ำทุก request)
- **PKCE (code_verifier/code_challenge)** — ป้องกันการดัก authorization code ระหว่างทาง
- **client_secret_basic** — ส่ง client_id/secret ผ่าน HTTP Basic Auth header ตอนแลก token
  (รูปแบบเดียวกับตัวอย่าง introspect ของ ETDA) ปรับเป็นแบบ post ได้ผ่าน `THAID_TOKEN_AUTH=post`
- **ตรวจลายเซ็น ID Token ด้วย JWKS** (ไลบรารี `jose`) — สำคัญมาก: ถ้าไม่ตรวจลายเซ็นก่อน
  ใครก็ปลอม id_token ปลอมข้อมูล pid/name ส่งเข้ามาได้ ตอนนี้ตรวจกับ `jwks_uri`, `issuer`,
  และ `audience` (= client_id ของเรา) ทุกครั้งก่อนเชื่อข้อมูลในนั้น
- ทดสอบแล้วด้วย mock OIDC provider จำลองในเครื่อง (ไม่ได้ทดสอบกับ ThaiD จริงเพราะยังไม่มี
  credentials จริง) — ยืนยันว่า PKCE, Basic auth, และการตรวจ JWKS ทำงานถูกต้องครบ flow

#### วิธีขอ credentials จริงจากกรมการปกครอง
ThaiD ไม่มี self-service sandbox ให้สมัครเองทางออนไลน์ ต้องติดต่อหน่วยงานโดยตรง:
1. หน่วยงาน/สถานศึกษาของคุณต้องเป็นผู้ยื่นขอ (ปกติไม่ใช่นักศึกษาคนเดียวสมัครได้เอง)
2. ติดต่อสำนักบริหารการทะเบียน กรมการปกครอง หรือ ETDA เพื่อขอลงทะเบียนเป็น Relying Party
3. แจ้ง Redirect URI ที่จะใช้จริง (ต้องตรงกับที่ตั้งใน `.env` เป๊ะๆ) และ scope ที่ต้องการ
4. เมื่อได้ `client_id`/`client_secret` มาแล้ว ใส่ใน `.env`, ลบ/ปิด `MOCK_THAID`, ปรับ
   `THAID_SCOPE` ให้ตรงกับที่อนุมัติจริง — ไม่ต้องแก้โค้ดอะไรเพิ่มเติม

### รอบ 6: จำลอง ThaiD login สำหรับพัฒนา/เดโม

**สรุปสั้นๆ:** ThaiD (DOPA Digital ID) ไม่มี public sandbox ให้สมัครใช้เองแบบนักพัฒนาทั่วไป —
ต้องเป็นหน่วยงาน/นิติบุคคลลงทะเบียนขอ client id/secret กับกรมการปกครองโดยตรง ไม่เหมาะกับ
โปรเจคจบ/เดโมที่ต้องการทดสอบเร็วๆ จึงเพิ่ม **โหมดจำลอง ThaiD** ในตัวโปรเจคเลย

**วิธีใช้:**
1. ใน `.env` ตั้ง `MOCK_THAID=true` (ต้อง `NODE_ENV` ไม่ใช่ `production` ด้วย — โหมดนี้ปิดอัตโนมัติ
   ใน production เสมอ ต่อให้ตั้ง `MOCK_THAID=true` ทิ้งไว้ก็ตาม กันพลาดเปิดโหมดจำลองในของจริง)
2. รัน server ปกติ (`npm run dev`)
3. กดปุ่ม "เข้าสู่ระบบด้วย ThaiD" ในแอป (หรือเปิด `http://localhost:3000/api/auth/thaid` ตรงๆ)
   จะเจอหน้าฟอร์มจำลอง ให้กรอกชื่อ + เลขบัตร 13 หลัก (ไม่ต้องเป็นเลขจริง) แล้วกด "ยินยอมและเข้าสู่ระบบ"
4. ระบบจะสร้าง Firebase custom token แล้ว login เข้าแอปเหมือน flow จริงทุกประการ
   (บันทึกลง Firestore, สร้าง session, ไปหน้าถัดไปตามปกติ) — เหมาะสำหรับตอน demo ให้อาจารย์ดู

**เมื่อได้ credentials จริงจาก ThaiD แล้ว:** ลบ/ปิด `MOCK_THAID` ใน `.env` แล้วใส่
`THAID_CLIENT_ID` / `THAID_CLIENT_SECRET` จริงแทน — โค้ด flow จริงใช้มาตรฐาน OAuth2/OpenID Connect
เดียวกัน ไม่ต้องแก้อะไรเพิ่ม (อ้างอิงจาก reference implementation ทางการของ ETDA:
https://github.com/ETDA/ThaiD-Python-RP)

### รอบ 5: Flutter — หน้ากรอกเบอร์โทร (ThaiD) + ระบบแจ้งเตือน/ยืนยัน
- ผู้ใช้ที่ login ผ่าน ThaiD (ไม่มีเบอร์โทรจาก login) จะเจอหน้า "ขอเบอร์โทรศัพท์" ก่อนเข้าแอป
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
- **User:** ทุกบัญชีต้องมีเบอร์โทร (ผู้ใช้ ThaiD login ที่ไม่มีเบอร์จะถูกถามเพิ่มหลัง login — ดู `PATCH /api/auth/me`) เพื่อให้แอดมินโทรติดต่อได้เองถ้าแอปแจ้งเตือนไม่ถึง
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
  - เข้าสู่ระบบด้วย ThaiD → redirect ทั้งหน้าไปที่ `GET /api/auth/thaid` แล้ว server
    redirect กลับมาพร้อม Firebase custom token ต่อท้าย URL (`?thaid_token=...`)
    แอปจะอ่านค่านี้ตอนเปิดแอปแล้ว sign in ให้อัตโนมัติ (ดู `services/thaid_web_redirect.dart`)
  - หลัง login สำเร็จจะเรียก `GET /api/auth/me` หรือ `POST /api/auth/register` เพื่อซิงค์โปรไฟล์กับ Firestore จริง
- `BookingService` เปลี่ยนจาก mock ในหน่วยความจำ เป็นเรียก backend จริงทั้งหมด
  (`GET /api/services`, `GET/POST/DELETE /api/bookings`, `GET /api/queue/my`)
- เพิ่ม `lib/services/api_client.dart` — ตัวกลางแนบ Firebase ID token ให้ทุก request อัตโนมัติ
- เพิ่ม `lib/config/api_config.dart` — ตั้งค่า URL ของ server (แก้ตอน deploy จริง หรือใช้
  `flutter run --dart-define=API_BASE_URL=http://192.168.x.x:3000/api` ตอน dev)
- เพิ่ม `lib/firebase_options.dart` (placeholder) — **ต้องรัน `flutterfire configure` ก่อนใช้งานจริง**
  ไม่งั้น `Firebase.initializeApp()` จะ error เพราะเป็นค่า YOUR_API_KEY ปลอม
- แก้ `.env.example`: `THAID_REDIRECT_URI` เดิมขาด `/api` prefix (route จริง mount ที่ `/api/auth/...`)
- เพิ่ม `APP_URL` ใน `.env.example` — ใช้ตอน redirect กลับหลัง ThaiD login สำเร็จ

**ข้อจำกัดที่ควรรู้:** ThaiD OAuth ต้องใช้ client id/secret จริงจากกรมการปกครอง ซึ่งปกติ
นักศึกษาจะยังไม่มี (ต้องขอผ่านหน่วยงาน) — โค้ดฝั่ง server/app เชื่อมต่อไว้ถูกต้องตามสเปคแล้ว
แต่จะทดสอบ end-to-end ได้จริงก็ต่อเมื่อมี ThaiD sandbox credentials เท่านั้น
ส่วนเบอร์โทร (Firebase Phone Auth) ทดสอบได้ทันทีถ้าตั้งค่า Firebase project จริงแล้ว

### รอบ 1: แก้บั๊ก server

- แก้ปัญหา unhandled promise ใน `POST /api/bookings` และเปลี่ยนไปใช้ Firestore transaction
  เพื่อป้องกันการจองซ้ำเวลาเดียวกันพร้อมกัน (race condition)
- แก้ catch-all route ใน `server/index.js` ไม่ให้ตอบ HTML กลับไปเมื่อยิง `/api/*` ที่ไม่มีจริง (ตอบ JSON 404 แทน) และเพิ่ม global error handler
- แก้ช่องโหว่ CSRF ใน ThaiD OAuth login โดยตรวจสอบค่า `state` ตอน callback
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
| ยืนยันตัวตน | **ThaiD API** |
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
│   │   ├── auth.js            → ThaiD login + phone register
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

1. สร้างโปรเจคที่ [Firebase Console](czzzz
2. เปิดใช้งาน **Authentication** → Phone + Custom Token
3. เปิดใช้งาน **Firestore Database**
4. ไปที่ Project Settings → Service Accounts → **Generate new private key**
   ดาวน์โหลดไฟล์ `serviceAccountKey.json`

### 2️⃣ ตั้งค่า Server (Node.js + Express)

```bash
cd server
npm install
cp .env.example .env
# แก้ไข .env ใส่ค่า Firebase + ThaiD ของจริง

# วางไฟล์ serviceAccountKey.json (ถ้าจะใช้วิธีไฟล์แทน .env)

npm run dev      # หรือ npm start
```

Server จะรันที่ `http://localhost:3000`
- API: `http://localhost:3000/api`
- Web Admin: `http://localhost:3000` (เสิร์ฟไฟล์ static อัตโนมัติ)

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

### 6️⃣ ตั้งค่า ThaiD API

1. สมัครใช้งานที่ [ThaiD Developer Portal](https://www.dopa.go.th) (กรมการปกครอง)
2. ขอ `client_id` / `client_secret`
3. ตั้งค่า redirect URI ให้ตรงกับ `.env` → `THAID_REDIRECT_URI`
4. ใส่ค่าใน `server/.env`

---

## ✨ ฟีเจอร์ตามขอบเขตระบบ

### Mobile App (Flutter)
- [x] สมัครสมาชิก / Login (รองรับ ThaiD + เบอร์โทร)
- [x] จองคิวล่วงหน้า (ไม่เกิน 3 วัน)
- [x] ดูลำดับคิว แบบ real-time
- [x] ประวัติการจอง
- [ ] รับแจ้งเตือนก่อนถึงเวลา (ต้องตั้งค่า Firebase Cloud Messaging เพิ่ม)

### Web Admin
- [x] Dashboard สรุปภาพรวม + กราฟแนวโน้ม
- [x] จัดการคิว (เรียก/ยกเลิก/ยืนยัน/เสร็จสิ้น)
- [x] เพิ่ม/แก้ไขการจอง
- [x] ข้อมูลหมอนวด
- [x] รายงานสถิติการใช้งาน

---

## 📌 หมายเหตุสำคัญ

- โค้ดชุดนี้คือ **โครงสร้างโปรเจคที่พร้อมพัฒนาต่อ (scaffold)** ใช้เทคโนโลยีตรงตามเอกสารที่กำหนด
- ต้องเชื่อมต่อ Firebase project จริงและขอ ThaiD API key ก่อนใช้งานจริง
- Web Admin มี fallback ข้อมูลตัวอย่างในตัว เพื่อให้ทดสอบ UI ได้ทันทีแม้ backend ยังไม่ตั้งค่าเสร็จ
- Flutter app ต้องรัน `flutter pub get` และตั้งค่า Firebase ผ่าน `flutterfire configure` ก่อนใช้งาน
