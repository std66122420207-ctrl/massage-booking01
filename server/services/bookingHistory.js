function encodeBookingHistoryCursor(bookingDate, bookingId) {
  return Buffer.from(JSON.stringify([bookingDate, bookingId])).toString('base64url');
}

function decodeBookingHistoryCursor(cursor) {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
    const cursorDate = Array.isArray(decoded) ? decoded[0] : null;
    const cursorDateTimestamp = /^\d{4}-\d{2}-\d{2}$/.test(String(cursorDate || ''))
      ? Date.parse(`${cursorDate}T00:00:00.000Z`)
      : Number.NaN;
    if (
      !Array.isArray(decoded)
      || decoded.length !== 2
      || !Number.isFinite(cursorDateTimestamp)
      || new Date(cursorDateTimestamp).toISOString().slice(0, 10) !== cursorDate
      || typeof decoded[1] !== 'string'
      || !decoded[1]
    ) {
      throw new Error('invalid cursor');
    }
    return decoded;
  } catch {
    throw Object.assign(new Error('cursor ไม่ถูกต้อง'), { status: 400 });
  }
}

async function getBookingHistoryPage({
  db,
  today,
  cursor,
  limit = 50,
  documentIdField,
}) {
  const pageSize = Number(limit);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw Object.assign(new Error('limit ต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 100'), { status: 400 });
  }
  const cursorValues = decodeBookingHistoryCursor(cursor);

  let query = db.collection('bookings')
    .where('status', 'in', ['done', 'cancelled'])
    .where('bookingDate', '<', today)
    .orderBy('bookingDate', 'desc')
    .orderBy(documentIdField, 'desc');
  if (cursorValues) query = query.startAfter(...cursorValues);

  const snapshot = await query.limit(pageSize + 1).get();
  const documents = snapshot.docs.slice(0, pageSize);
  const lastDocument = documents[documents.length - 1];
  return {
    items: documents.map((document) => {
      const booking = { id: document.id, ...document.data() };
      delete booking.nationalId;
      return {
        ...booking,
        customerName: booking.customerName || '',
        customerPhone: booking.customerPhone || '',
        staffName: booking.staffName || '',
        healthcareRightLabel: booking.healthcareRightLabel || booking.healthcareRight || 'จ่ายตรง',
      };
    }),
    nextCursor: snapshot.size > pageSize && lastDocument
      ? encodeBookingHistoryCursor(lastDocument.data().bookingDate, lastDocument.id)
      : null,
  };
}

module.exports = {
  encodeBookingHistoryCursor,
  decodeBookingHistoryCursor,
  getBookingHistoryPage,
};
