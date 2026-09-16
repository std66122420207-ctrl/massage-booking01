// ============================================================
//  Firebase web config
//  ใช้ค่าจริงจาก Firebase Console → Project settings → General → Your apps
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

// API base URL
// ตอนรัน local: admin เปิดบน 4000 แต่ backend รันบน 3000 จึงต้องใช้ localhost:3000/api
// ตอน deploy จริง: เปลี่ยนเป็น URL ของ Render / Azure / server ปลายทาง
const API_BASE = (() => {
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalDev && (window.location.port === '4000' || window.location.port === '3000')) {
    return 'http://localhost:3000/api';
  }
  return window.location.origin + '/api';
})();
