process.env.FUNCTIONS_RUNTIME = 'firebase';
process.env.NODE_ENV = 'production';

const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const app = require('../server');
const { runAutoCallCycle } = require('../server/services/autoCall');

exports.api = onRequest({
  region: 'asia-southeast1',
  maxInstances: 10,
  timeoutSeconds: 60,
}, app);

exports.autoCallWorker = onSchedule({
  schedule: 'every 1 minutes',
  timeZone: 'Asia/Bangkok',
  region: 'asia-southeast1',
  maxInstances: 1,
}, async () => runAutoCallCycle());