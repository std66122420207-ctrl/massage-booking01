const { spawnSync } = require('child_process');
const path = require('path');

const vapidKey = process.env.FCM_VAPID_KEY || '';
if (!/^[A-Za-z0-9_-]+={0,2}$/.test(vapidKey)) {
  console.error(
    'Set FCM_VAPID_KEY to the Web Push certificate public key from Firebase Console before deploying.',
  );
  process.exit(1);
}

const result = spawnSync(
  'flutter',
  ['build', 'web', `--dart-define=FCM_VAPID_KEY=${vapidKey}`],
  {
    cwd: path.resolve(__dirname, '..', 'flutter-app'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

if (result.error) {
  console.error('Flutter Web deployment build failed:', result.error.message);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
