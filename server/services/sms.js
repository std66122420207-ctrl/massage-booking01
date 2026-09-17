function normalizeThaiPhone(phone) {
  const value = String(phone || '').replace(/[\s-]/g, '');
  if (/^0\d{9}$/.test(value)) return `+66${value.slice(1)}`;
  if (/^\+66\d{9}$/.test(value)) return value;
  return null;
}

async function sendSms(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const phone = normalizeThaiPhone(to);
  if (!sid || !token || !from || !phone) return { sent: false, configured: false };

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: phone, From: from, Body: body }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Twilio SMS failed (${response.status}): ${details}`);
  }
  return { sent: true, configured: true };
}

module.exports = { sendSms };
