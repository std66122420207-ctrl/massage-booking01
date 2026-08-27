process.env.FUNCTIONS_RUNTIME = 'firebase';
process.env.NODE_ENV = 'production';

const { onRequest } = require('firebase-functions/v2/https');
const app = require('../server');

exports.api = onRequest({
  region: 'asia-southeast1',
  maxInstances: 10,
  timeoutSeconds: 60,
}, app);