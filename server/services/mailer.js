// ============================================================
//  ส่งอีเมลหาหมอนวดแต่ละคน — แยกเคสของแต่ละคน แล้วส่งแยกทีละฉบับ
//  ใช้ Gmail SMTP: ต้องตั้งค่า .env
//    GMAIL_USER=youraccount@gmail.com
//    GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (16 หลัก จาก Google App Passwords)
//  วิธีสร้าง App Password ดูใน README หัวข้อ "ตั้งค่าอีเมล"
// ============================================================
const nodemailer = require('nodemailer');

function isConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function renderBookingListHtml(bookings) {
  const rows = bookings
    .map(
      (b) => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;">${b.queueNumber || '-'}</td>
      <td style="padding:8px;border:1px solid #ddd;">${b.timeSlot || '-'}</td>
      <td style="padding:8px;border:1px solid #ddd;">${b.serviceName || '-'}</td>
      <td style="padding:8px;border:1px solid #ddd;">${b.customerName || '-'}</td>
      <td style="padding:8px;border:1px solid #ddd;">${b.customerPhone || '-'}</td>
    </tr>`
    )
    .join('');

  return `
  <div style="font-family:'Sarabun',sans-serif;color:#1c2b26;">
    <table style="border-collapse:collapse;width:100%;margin-top:12px;">
      <thead>
        <tr style="background:#eef4f1;">
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">เลขคิว</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">เวลา</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">บริการ</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">ลูกค้า</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">เบอร์ติดต่อ</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

/// ส่งอีเมล 1 ฉบับให้หมอนวด 1 คน โดยมีเฉพาะคิวของตัวเอง (ไม่ปนกับคนอื่น)
async function sendTherapistBookingsEmail({ staffName, staffEmail, bookingDate, bookings }) {
  if (!isConfigured()) {
    throw new Error('ยังไม่ได้ตั้งค่าอีเมล — ใส่ GMAIL_USER, GMAIL_APP_PASSWORD ใน .env ก่อน');
  }
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"ศูนย์สุขภาพชุมชนท่าวังหิน" <${process.env.GMAIL_USER}>`,
    to: staffEmail,
    subject: `คิวนวดของคุณวันที่ ${bookingDate} (${bookings.length} คิว)`,
    html: `
      <p>สวัสดีคุณ${staffName},</p>
      <p>นี่คือรายการคิวนวดของคุณวันที่ <b>${bookingDate}</b> ทั้งหมด ${bookings.length} คิว</p>
      ${renderBookingListHtml(bookings)}
      <p style="margin-top:16px;color:#666;font-size:13px;">
        อีเมลนี้ส่งอัตโนมัติจากระบบจองคิว กรุณาอย่าตอบกลับอีเมลนี้โดยตรง
      </p>
    `,
  });
}

/// ส่งให้หมอนวดหลายคนพร้อมกัน — แต่ละคนได้รับเฉพาะคิวของตัวเอง
/// คืนค่าสรุปผล (ส่งสำเร็จ/ไม่สำเร็จ กี่คน) เพื่อให้แอดมินเห็นผลลัพธ์ชัดเจน
async function sendAllTherapistEmails(groupedByStaff, bookingDate) {
  const results = [];
  for (const group of groupedByStaff) {
    if (!group.staffEmail) {
      results.push({ staffName: group.staffName, status: 'skipped', reason: 'ไม่มีอีเมล' });
      continue;
    }
    try {
      await sendTherapistBookingsEmail({
        staffName: group.staffName,
        staffEmail: group.staffEmail,
        bookingDate,
        bookings: group.bookings,
      });
      results.push({ staffName: group.staffName, status: 'sent', count: group.bookings.length });
    } catch (err) {
      results.push({ staffName: group.staffName, status: 'failed', reason: err.message });
    }
  }
  return results;
}

module.exports = { isConfigured, sendAllTherapistEmails };
