// ============================================================
//  ใส่ค่า Firebase config ของโปรเจคคุณที่นี่
//  หาได้จาก Firebase Console → Project Settings → General → Your apps
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDZR-e5Af_yn2M8FM9Xmj178nfRx3218Wo",
  authDomain: "massage-booking-ce032.firebaseapp.com",
  projectId: "massage-booking-ce032",
  storageBucket: "massage-booking-ce032.firebasestorage.app",
  messagingSenderId: "557416054160",
  appId: "1:557416054160:web:cd418bb8670f54d31e0715",
  measurementId: "G-HR6BKWNWWQ"
};

firebase.initializeApp(firebaseConfig);

// API base URL (เปลี่ยนตอน deploy จริง)
const API_BASE = window.location.origin + '/api';
