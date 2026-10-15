const { spawnSync } = require('child_process');
const path = require('path');

const vapidKey = process.env.FCM_VAPID_KEY || '';
if (!/^[A-Za-z0-9_-]+={0,2}$/.test(vapidKey)) {
  console.error(
    'Set FCM_VAPID_KEY to the Web Push certificate public key from Firebase Console before deploying.',
  );
  process.exit(1);
}

const configuredApiBaseUrl = process.env.API_BASE_URL || '';
let apiBaseUrl;
try {
  const parsedApiBaseUrl = new URL(configuredApiBaseUrl);
  if (parsedApiBaseUrl.protocol !== 'https:' || parsedApiBaseUrl.search || parsedApiBaseUrl.hash) {
    throw new Error('API_BASE_URL must be an HTTPS URL without query or fragment.');
  }
  if (parsedApiBaseUrl.pathname === '/') {
    parsedApiBaseUrl.pathname = '/api';
  } else if (parsedApiBaseUrl.pathname.replace(/\/+$/, '') !== '/api') {
    throw new Error('API_BASE_URL must point to the API origin or end in /api.');
  }
  apiBaseUrl = parsedApiBaseUrl.toString().replace(/\/+$/, '');
} catch (error) {
  console.error(
    `Set API_BASE_URL to the HTTPS Render API URL before deploying. ${error.message}`,
  );
  process.exit(1);
}

const result = spawnSync(
  'flutter',
  [
    'build',
    'web',
    `--dart-define=FCM_VAPID_KEY=${vapidKey}`,
    `--dart-define=API_BASE_URL=${apiBaseUrl}`,
  ],
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
