importScripts(
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js',
);

firebase.initializeApp({
  apiKey: 'AIzaSyDZR-e5Af_yn2M8FM9Xmj178nfRx3218Wo',
  authDomain: 'massage-booking-ce032.firebaseapp.com',
  projectId: 'massage-booking-ce032',
  storageBucket: 'massage-booking-ce032.firebasestorage.app',
  messagingSenderId: '557416054160',
  appId: '1:557416054160:web:cd418bb8670f54d31e0715',
  measurementId: 'G-HR6BKWNWWQ',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const title = notification.title || 'แจ้งเตือนการจอง';
  const options = {
    body: notification.body || '',
    icon: '/icons/Icon-192.png',
    data: payload.data || {},
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url.startsWith(targetUrl));
      if (existingClient) return existingClient.focus();
      return self.clients.openWindow(targetUrl);
    }),
  );
});
