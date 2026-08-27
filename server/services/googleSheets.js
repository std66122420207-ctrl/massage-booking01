// ============================================================
//  Google Sheets Sync
//  ต้องตั้งค่า .env: GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY,
//  GOOGLE_SHEETS_SPREADSHEET_ID (ดูวิธีตั้งค่าใน README หัวข้อ "Google Sheets")
// ============================================================
const { google } = require('googleapis');

const SHEET_NAME = 'Bookings'; // ชื่อ tab ในสเปรดชีต
const HEADER_ROW = [
  'เลขคิว', 'วันที่', 'เวลา', 'บริการ', 'ราคา',
  'หมอนวด', 'สถานะ', 'ชื่อลูกค้า', 'เบอร์โทรลูกค้า', 'สร้างเมื่อ',
];

function isConfigured() {
  return Boolean(
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL &&
    process.env.GOOGLE_SHEETS_PRIVATE_KEY &&
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  );
}

function getClient() {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return google.sheets({ version: 'v4', auth });
}

function bookingToRow(booking, staffNameById, userById) {
  const staffName = staffNameById?.[booking.staffId] || booking.staffId || '(ไม่ระบุ)';
  const user = userById?.[booking.userId];
  const createdAt = booking.createdAt?.toDate
    ? booking.createdAt.toDate().toLocaleString('th-TH')
    : '';
  return [
    booking.queueNumber || '',
    booking.bookingDate || '',
    booking.timeSlot || '',
    booking.serviceName || '',
    booking.servicePrice ?? '',
    staffName,
    booking.status || '',
    user?.name || '',
    user?.phone || '',
    createdAt,
  ];
}

/// เขียนข้อมูลการจองทั้งหมดทับลงชีต (ล้างของเดิมแล้วเขียนใหม่ทั้งหมด — ง่ายและชัวร์ที่สุด
/// สำหรับปุ่ม "Sync to Google Sheets" ที่แอดมินกดเป็นครั้งคราว ไม่เหมาะกับข้อมูลจำนวนมากมาก
/// เพราะจะช้าลงตามจำนวนแถว ถ้าข้อมูลเยอะมากควรเปลี่ยนไปใช้ batchUpdate แบบ append แทน)
async function syncBookingsToSheet(bookings, staffNameById, userById) {
  if (!isConfigured()) {
    throw new Error(
      'ยังไม่ได้ตั้งค่า Google Sheets — ใส่ GOOGLE_SHEETS_CLIENT_EMAIL, ' +
      'GOOGLE_SHEETS_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID ใน .env ก่อน'
    );
  }
  const sheets = getClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  const rows = [HEADER_ROW, ...bookings.map((b) => bookingToRow(b, staffNameById, userById))];

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${SHEET_NAME}!A:Z`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });

  return { syncedCount: bookings.length };
}

/// เพิ่มแถวเดียวต่อท้ายชีต — ใช้ตอนมีการจองใหม่เข้ามาแบบ real-time
/// (เรียกแบบ fire-and-forget จาก routes/bookings.js เพื่อไม่ให้ผู้ใช้ต้องรอ)
async function appendBookingRow(booking, staffName, user) {
  if (!isConfigured()) return; // เงียบไว้ถ้ายังไม่ได้ตั้งค่า ไม่ทำให้การจองล้มเหลว
  const sheets = getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [bookingToRow(booking, { [booking.staffId]: staffName }, { [booking.userId]: user })] },
  });
}

module.exports = { isConfigured, syncBookingsToSheet, appendBookingRow };
