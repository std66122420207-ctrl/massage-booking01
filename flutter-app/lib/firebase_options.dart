// File generated normally by FlutterFire CLI. Placeholder values below —
// this MUST be regenerated (or hand-filled) with your real Firebase project
// before running the app, otherwise Firebase.initializeApp() will fail.
//
// วิธีสร้างไฟล์นี้จริง (แนะนำ — ง่ายและชัวร์ที่สุด):
//   1. dart pub global activate flutterfire_cli
//   2. cd flutter-app
//   3. flutterfire configure --project=<your-firebase-project-id>
//   คำสั่งนี้จะ login Firebase, ให้เลือก platform (web/android/ios),
//   แล้ว "เขียนทับ" ไฟล์นี้ให้อัตโนมัติด้วยค่าจริงจากโปรเจคของคุณ
//
// ถ้าอยากแก้เอง: ไปเอาค่าที่ Firebase Console → Project Settings → General
// → Your apps → SDK setup and configuration แล้วแทนที่ค่า YOUR_* ด้านล่าง
// (ค่าเดียวกับที่ใส่ใน web-admin/public/js/config.js)

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions has not been configured for this platform. '
          'Run `flutterfire configure` to generate the missing options.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyDZR-e5Af_yn2M8FM9Xmj178nfRx3218Wo',
    appId: '1:557416054160:web:cd418bb8670f54d31e0715',
    messagingSenderId: '557416054160',
    projectId: 'massage-booking-ce032',
    authDomain: 'massage-booking-ce032.firebaseapp.com',
    storageBucket: 'massage-booking-ce032.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDZR-e5Af_yn2M8FM9Xmj178nfRx3218Wo',
    appId:
        'YOUR_ANDROID_APP_ID', // รัน flutterfire configure หรือใส่ Android App ID จาก Firebase Console
    messagingSenderId: '557416054160',
    projectId: 'massage-booking-ce032',
    storageBucket: 'massage-booking-ce032.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'YOUR_API_KEY',
    appId: 'YOUR_IOS_APP_ID',
    messagingSenderId: 'YOUR_SENDER_ID',
    projectId: 'your-project-id',
    storageBucket: 'your-project.appspot.com',
    iosBundleId: 'com.example.massageBooking',
  );
}
