// ============================================================
//  Web Admin — Main App Logic
//  เชื่อมต่อกับ Node.js + Express API (เปิดผ่าน /js/api.js)
// ============================================================

let services = [];
let staffList = [];
let bookings = [];
let bookingSearch = '';

const STATUS_LABEL = {
  pending:    'รอยืนยัน',
  confirmed:  'ยืนยันแล้ว',
  in_service: 'กำลังให้บริการ',
  done:       'นวดเสร็จแล้ว',
  cancelled:  'ยกเลิก',
};
const STATUS_BADGE = {
  pending:    'badge-yellow',
  confirmed:  'badge-blue',
  in_service: 'badge-blue',
  done:       'badge-green',
  cancelled:  'badge-red',
};

// ── Auth: login / logout / gate ──────────────────────────────
const loginScreen = document.getElementById('login-screen');
const appShell     = document.getElementById('app-shell');
const loginForm    = document.getElementById('login-form');
const loginError   = document.getElementById('login-error');
const loginSubmit  = document.getElementById('login-submit');

let appInitialized = false;

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  loginSubmit.classList.add('login-submit-loading');
  loginSubmit.textContent = 'กำลังเข้าสู่ระบบ...';

  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
    // onAuthStateChanged ด้านล่างจะจัดการแสดง app-shell เอง
  } catch (err) {
    const messages = {
      'auth/invalid-credential': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      'auth/user-not-found':     'ไม่พบบัญชีผู้ใช้นี้',
      'auth/wrong-password':     'รหัสผ่านไม่ถูกต้อง',
      'auth/too-many-requests':  'ลองผิดบ่อยเกินไป กรุณาลองใหม่ภายหลัง',
    };
    loginError.textContent = messages[err.code] || 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่';
  } finally {
    loginSubmit.classList.remove('login-submit-loading');
    loginSubmit.textContent = 'เข้าสู่ระบบ';
  }
});

document.querySelector('.admin-badge')?.addEventListener('click', async () => {
  if (confirm('ออกจากระบบ?')) await firebase.auth().signOut();
});

firebase.auth().onAuthStateChanged(async (user) => {
  // ตรวจสอบสิทธิ์แอดมิน (custom claim ตั้งผ่าน server/scripts/setAdmin.js)
  const isAdmin = user ? (await user.getIdTokenResult()).claims.admin === true : false;

  if (user && isAdmin) {
    loginScreen.style.display = 'none';
    appShell.style.display = '';
    document.querySelector('.admin-badge span').textContent = user.email?.split('@')[0] || 'แอดมิน';
    if (!appInitialized) {
      appInitialized = true;
      init();
    }
  } else {
    if (user && !isAdmin) {
      loginError.textContent = 'บัญชีนี้ไม่มีสิทธิ์แอดมิน';
      await firebase.auth().signOut();
    }
    appShell.style.display = 'none';
    loginScreen.style.display = 'flex';
  }
});

// ── Navigation ──────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id)?.classList.add('active');
  document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
  document.querySelector(`.sidebar-item[data-page="${id}"]`)?.classList.add('active');

  const titles = {
    dashboard: 'แผงควบคุมหลัก', bookings: 'จัดการการจอง', queue: 'จัดการคิว',
    staff: 'แพทย์/หมอนวด', report: 'รายงาน', settings: 'ตั้งค่า',
  };
  document.getElementById('page-title').textContent = titles[id] || '';

  if (id === 'queue') renderQueuePage();
}

document.querySelectorAll('.sidebar-item').forEach(btn => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});
document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => showPage(btn.dataset.goto));
});

// ── Toast ───────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

let _offlineNoticeShown = false;
function noteOfflineFallback() {
  if (_offlineNoticeShown) return;
  _offlineNoticeShown = true;
  showToast('เชื่อมต่อ server ไม่ได้ ข้อมูลจะแสดงเมื่อเชื่อมต่อสำเร็จ');
}

// ── Load initial data ──────────────────────────────────────
async function loadServices() {
  try {
    services = await API.getServices();
  } catch (err) {
    services = [];
    noteOfflineFallback();
    showToast(`โหลดบริการไม่สำเร็จ: ${err.message}`);
  }

  const sel = document.getElementById('f-service');
  sel.innerHTML = services.map(s =>
    `<option value="${s.id}">${s.name} (${s.duration} นาที) – ${s.price} ฿</option>`
  ).join('');
}

async function loadStaff() {
  try {
    staffList = await API.getStaff();
  } catch (err) {
    staffList = [];
    noteOfflineFallback();
    showToast(`โหลดรายชื่อหมอนวดไม่สำเร็จ: ${err.message}`);
  }

  const sel = document.getElementById('f-staff');
  sel.innerHTML = staffList.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  renderStaffGrid();
}

function renderStaffGrid() {
  const grid = document.getElementById('staff-grid');
  const statusLabel = { available: 'ว่าง', busy: 'ไม่ว่าง', break: 'หยุด', off: 'ลา' };
  const statusBadge = { available: 'badge-green', busy: 'badge-blue', break: 'badge-yellow', off: 'badge-gray' };

  grid.innerHTML = staffList.map(s => `
    <div class="staff-card">
      ${s.photo
        ? `<img class="staff-photo-img" src="${s.photo}" alt="${s.name}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'staff-avatar',innerHTML:'<i class=\\'fa-solid fa-user\\'></i>'}))">`
        : `<div class="staff-avatar"><i class="fa-solid fa-user"></i></div>`}
      <div class="staff-name">${s.name}</div>
      <div class="staff-exp">ประสบการณ์ ${s.experience || '-'}</div>
      <span class="badge ${statusBadge[s.status] || 'badge-gray'}">${statusLabel[s.status] || s.status}</span>
      <div class="staff-count">วันนี้: <strong>${s.todayCount || 0} คิว</strong></div>
      <div style="font-size:12px;color:var(--slate);margin-top:6px">
        <i class="fa-solid fa-envelope"></i> ${s.email || '<span style="color:var(--status-cancel-text)">ยังไม่มีอีเมล</span>'}
      </div>
      <select class="staff-status-select" onchange="changeStaffStatus('${s.id}', this.value)">
        ${Object.entries(statusLabel).map(([value, label]) => `<option value="${value}" ${s.status === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
      <div class="staff-actions">
        <button class="action-btn btn-edit" onclick='openStaffModal(${JSON.stringify(s).replace(/'/g, "&apos;")})'><i class="fa-solid fa-pen"></i> แก้ไข</button>
        <button class="action-btn btn-cancel" onclick='removeStaff(${JSON.stringify(s.id)}, ${JSON.stringify(s.name)})'><i class="fa-solid fa-trash"></i> ลบ</button>
      </div>
    </div>
  `).join('');
}

// ── Staff Add/Edit Modal ─────────────────────────────────────
const staffModalOverlay = document.getElementById('staff-modal-overlay');
const staffModalForm    = document.getElementById('staff-modal-form');
const staffModalError   = document.getElementById('staff-modal-error');
const staffUploadBtn    = document.getElementById('staff-photo-upload-btn');
const staffImageInput   = document.getElementById('staff-modal-image');
const staffPhotoInput   = document.getElementById('staff-modal-photo');

async function uploadStaffImage(file) {
  if (!file) return null;

  const storage = firebase.storage();
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageRef = storage.ref(`staff-photos/${timestamp}_${safeName}`);

  try {
    const snapshot = await storageRef.put(file);
    const downloadUrl = await snapshot.ref.getDownloadURL();
    return downloadUrl;
  } catch (err) {
    throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${err.message || 'กรุณาลองใหม่'}`);
  }
}

async function handleStaffPhotoUpload() {
  const file = staffImageInput.files?.[0];
  if (!file) {
    showToast('กรุณาเลือกไฟล์รูปภาพก่อน');
    return;
  }

  try {
    staffUploadBtn.disabled = true;
    staffUploadBtn.textContent = 'กำลังอัปโหลด...';
    const url = await uploadStaffImage(file);
    staffPhotoInput.value = url;
    showToast('อัปโหลดรูปเรียบร้อยแล้ว ✓');
  } catch (err) {
    showToast(err.message);
  } finally {
    staffUploadBtn.disabled = false;
    staffUploadBtn.textContent = 'อัปโหลดรูป';
  }
}

staffUploadBtn.addEventListener('click', handleStaffPhotoUpload);

function openStaffModal(staff) {
  staffModalError.textContent = '';
  document.getElementById('staff-modal-title').textContent = staff ? 'แก้ไขข้อมูลหมอนวด' : 'เพิ่มหมอนวดใหม่';
  document.getElementById('staff-modal-id').value         = staff?.id || '';
  document.getElementById('staff-modal-name').value       = staff?.name || '';
  document.getElementById('staff-modal-email').value      = staff?.email || '';
  document.getElementById('staff-modal-experience').value = staff?.experience || '';
  document.getElementById('staff-modal-photo').value      = staff?.photo || '';
  staffImageInput.value = '';
  staffModalOverlay.style.display = 'flex';
}

function closeStaffModal() {
  staffModalOverlay.style.display = 'none';
  staffImageInput.value = '';
  staffPhotoInput.value = '';
}

async function changeStaffStatus(id, status) {
  try {
    await API.updateStaffStatus(id, status);
    await loadStaff();
    showToast('อัปเดตสถานะหมอนวดแล้ว ✓');
  } catch (err) {
    showToast(`เปลี่ยนสถานะไม่สำเร็จ: ${err.message}`);
    await loadStaff();
  }
}

async function removeStaff(id, name) {
  if (!confirm(`ต้องการลบหมอนวด ${name} ออกจากรายชื่อใช้งานหรือไม่?`)) return;
  try {
    await API.deleteStaff(id);
    await loadStaff();
    showToast('ลบหมอนวดออกจากรายชื่อแล้ว');
  } catch (err) { showToast(`ลบหมอนวดไม่สำเร็จ: ${err.message}`); }
}

staffModalForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id         = document.getElementById('staff-modal-id').value;
  const submitBtn  = document.getElementById('staff-modal-submit');
  const file = staffImageInput.files?.[0];
  const photoFromInput = staffPhotoInput.value.trim();

  submitBtn.disabled = true; submitBtn.textContent = 'กำลังบันทึก...';
  try {
    let photoUrl = photoFromInput;
    if (file && !photoUrl) {
      photoUrl = await uploadStaffImage(file);
      staffPhotoInput.value = photoUrl;
    }

    const data = {
      name:       document.getElementById('staff-modal-name').value.trim(),
      email:      document.getElementById('staff-modal-email').value.trim(),
      experience: document.getElementById('staff-modal-experience').value.trim(),
      photo:      photoUrl,
    };

    const res = id ? await API.updateStaff(id, data) : await API.createStaff(data);
    if (res.error) throw new Error(res.error);
    showToast(id ? 'บันทึกข้อมูลหมอนวดแล้ว ✓' : 'เพิ่มหมอนวดใหม่แล้ว ✓');
    closeStaffModal();
    await loadStaff();
  } catch (err) {
    staffModalError.textContent = err.message;
  } finally {
    submitBtn.disabled = false; submitBtn.textContent = 'บันทึก';
  }
});

async function loadBookings() {
  try {
    bookings = await API.getTodayBookings();
  } catch (err) {
    bookings = [];
    noteOfflineFallback();
    showToast(`โหลดการจองไม่สำเร็จ: ${err.message}`);
  }

  renderBookingsTable();
  renderDashboardStats();
  renderQueuePage();
}

// ── Dashboard ───────────────────────────────────────────────
function renderDashboardStats() {
  const total   = bookings.length;
  const waiting = bookings.filter(b => ['pending', 'confirmed'].includes(b.status)).length;
  const done    = bookings.filter(b => b.status === 'done').length;
  const revenue = bookings.filter(b => b.status === 'done')
                          .reduce((sum, b) => sum + (b.servicePrice || 0), 0);
  const current = bookings.find(b => b.status === 'in_service');

  document.getElementById('stat-total').textContent   = total;
  document.getElementById('stat-waiting').textContent = waiting;
  document.getElementById('stat-done').textContent    = done;
  document.getElementById('stat-revenue').textContent = revenue.toLocaleString();
  document.getElementById('stat-current').textContent = current ? `กำลังให้บริการ: ${current.queueNumber}` : 'ไม่มีคิวกำลังให้บริการ';
  document.getElementById('stat-staff-count').textContent = staffList.length;

  buildTrendChart();
}

function buildTrendChart() {
  const vals = [0, 0, 0, 0, 0, 0, bookings.length];
  const days = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  const max  = Math.max(...vals, 1);
  const wrap = document.getElementById('trend-chart');
  wrap.innerHTML = vals.map((v, i) => `
    <div class="bar-wrap">
      <div class="bar" style="height:${(v / max * 100)}%"></div>
      <div class="bar-label">${days[i]}</div>
    </div>
  `).join('');
}

// ── Bookings Table ──────────────────────────────────────────
function renderBookingsTable() {
  const tbody = document.getElementById('bookings-tbody');
  const list = bookings.filter(matchesBookingSearch);

  document.getElementById('bookings-count').textContent = `${list.length} รายการ`;

  tbody.innerHTML = list.map(b => `
    <tr>
      <td class="queue-id">${b.queueNumber}</td>
      <td>${b.timeSlot}</td>
      <td>${b.customerName || b.userName || '-'}</td>
      <td>${b.serviceName}</td>
      <td>${b.staffName || '-'}</td>
      <td><span class="badge ${STATUS_BADGE[b.status] || 'badge-gray'}">${STATUS_LABEL[b.status] || b.status}</span></td>
      <td>
        ${b.status !== 'cancelled' && b.status !== 'done' ? `
          <button class="action-btn btn-done" onclick="markDone('${b.id}')">เสร็จ</button>
          <button class="action-btn btn-cancel" onclick="cancelBooking('${b.id}')">ยกเลิก</button>
        ` : ''}
      </td>
    </tr>
  `).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--slate);padding:24px">วันนี้ยังไม่มีรายการจอง</td></tr>';
}

async function markDone(id) {
  try {
    await API.completeQueue(id);
    await loadBookings();
    showToast('บันทึกเสร็จสิ้นแล้ว ✓');
  } catch (err) { showToast(`บันทึกไม่สำเร็จ: ${err.message}`); }
}

async function cancelBooking(id) {
  try {
    await API.cancelBooking(id);
    await loadBookings();
    showToast('ยกเลิกการจองแล้ว');
  } catch (err) { showToast(`ยกเลิกไม่สำเร็จ: ${err.message}`); }
}

// ── Booking Form ────────────────────────────────────────────
document.getElementById('booking-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('f-name').value.trim();
  if (!name) { showToast('กรุณากรอกชื่อผู้รับบริการ'); return; }

  const serviceId = document.getElementById('f-service').value;
  const service   = services.find(s => s.id === serviceId) || services[0];
  const staffId   = document.getElementById('f-staff').value;
  const staff     = staffList.find(s => s.id === staffId);
  const date      = document.getElementById('f-date').value;
  const time      = document.getElementById('f-time').value;

  let result;
  try {
    result = await API.createBooking({
      serviceId, staffId, bookingDate: date, timeSlot: time,
      customerName: name,
      customerPhone: document.getElementById('f-phone').value.trim(),
    });
    await loadBookings();
    e.target.reset();
    document.getElementById('f-date').valueAsDate = new Date();
    showToast(`เพิ่มการจอง ${result.booking.queueNumber} สำเร็จ ✓`);
  } catch (err) { showToast(`เพิ่มการจองไม่สำเร็จ: ${err.message}`); }
});

// ── Queue Page ──────────────────────────────────────────────
function renderQueuePage() {
  const list = bookings.filter(matchesBookingSearch);
  const current  = list.find(b => b.status === 'in_service');
  const waiting  = list.filter(b => ['pending', 'confirmed'].includes(b.status))
    .sort((a, b) => String(a.timeSlot || '').localeCompare(String(b.timeSlot || '')));
  const done     = list.filter(b => b.status === 'done');

  document.getElementById('queue-current').textContent      = current?.queueNumber || '-';
  document.getElementById('queue-waiting-count').textContent = `${waiting.length} คิว`;
  document.getElementById('queue-done-count').textContent    = `${done.length} คิว`;
  document.getElementById('queue-list-count').textContent    = `${waiting.length} คิว`;

  document.getElementById('queue-tbody').innerHTML = waiting.map(b => `
    <tr>
      <td class="queue-id">${b.queueNumber}</td>
      <td>${b.timeSlot}</td>
      <td>${b.customerName || b.userName || '-'}</td>
      <td>${b.serviceName}</td>
      <td>${b.staffName || '-'}</td>
      <td><span class="badge ${STATUS_BADGE[b.status]}">${STATUS_LABEL[b.status]}</span></td>
      <td>
        <button class="action-btn btn-call" onclick="callSpecific('${b.id}')">เรียก</button>
        <button class="action-btn btn-cancel" onclick="cancelBooking('${b.id}')">ยกเลิก</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--slate);padding:24px">ไม่มีคิวที่รออยู่</td></tr>';
}

function matchesBookingSearch(booking) {
  if (!bookingSearch) return true;
  const value = [booking.queueNumber, booking.customerName, booking.userName,
    booking.customerPhone, booking.serviceName, booking.staffName]
    .filter(Boolean).join(' ').toLowerCase();
  return value.includes(bookingSearch);
}

document.querySelector('.search-box')?.addEventListener('input', (event) => {
  bookingSearch = event.target.value.trim().toLowerCase();
  renderBookingsTable();
  renderQueuePage();
});

async function callSpecific(id) {
  try {
    const b = bookings.find(x => x.id === id);
    await API.callBooking(id);
    await loadBookings();
    showToast(`เรียกคิว ${b?.queueNumber || id} แล้ว`);
  } catch (err) { showToast(`เรียกคิวไม่สำเร็จ: ${err.message}`); }
}

async function callNext() {
  try {
    const res = await API.callNextQueue();
    if (res.called) {
      showToast(`📢 เรียกคิว ${res.called} – กรุณาเดินทางมาที่ห้องนวด`);
      await loadBookings();
      return;
    }
  } catch (err) { showToast(`เรียกคิวไม่สำเร็จ: ${err.message}`); }
}

document.getElementById('btn-call-next').addEventListener('click', callNext);
document.getElementById('btn-call-next-2').addEventListener('click', callNext);

// ── Notification confirmations (สำหรับกรณีแอปแจ้งเตือนไม่ถึงลูกค้า) ──
async function loadNotifications() {
  try {
    const list = await API.getAdminNotifications();
    if (!Array.isArray(list)) return;
    renderNotifications(list);
  } catch {
    // เงียบไว้ — ไม่ใช่ข้อมูลสำคัญขนาดต้องแจ้ง error ทุกครั้งที่ auto-refresh
  }
}

function renderNotifications(list) {
  const pending = list.filter(n => !n.confirmed);
  document.getElementById('notif-pending-count').textContent = `${pending.length} คนยังไม่ยืนยัน`;
  const statEl = document.getElementById('stat-notif-pending');
  if (statEl) statEl.textContent = pending.length;

  document.getElementById('notif-tbody').innerHTML = list.slice(0, 20).map(n => `
    <tr>
      <td>${n.message || '-'}</td>
      <td>${n.customerName || '-'}</td>
      <td>${n.customerPhone || '-'}</td>
      <td>${n.createdAt?._seconds ? new Date(n.createdAt._seconds * 1000).toLocaleString('th-TH') : '-'}</td>
      <td><span class="badge ${n.confirmed ? 'badge-green' : 'badge-yellow'}">${n.confirmed ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน'}</span></td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--slate)">ยังไม่มีการแจ้งเตือน</td></tr>';
}

// ── Google Sheets sync ──────────────────────────────────────
document.getElementById('btn-sync-sheets').addEventListener('click', async () => {
  const btn = document.getElementById('btn-sync-sheets');
  btn.disabled = true; btn.textContent = '⏳ กำลังซิงค์...';
  try {
    const res = await API.syncSheets();
    if (res.error) throw new Error(res.error);
    showToast(`ซิงค์ข้อมูลไป Google Sheets แล้ว (${res.syncedCount ?? 0} แถว) ✓`);
  } catch (err) {
    showToast(`❌ ซิงค์ไม่สำเร็จ: ${err.message}`);
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-table-cells"></i> Sync to Google Sheets';
  }
});

// ── ส่งอีเมลคิวให้หมอนวดแต่ละคน (แยกเคสของแต่ละคน) ───────────
document.getElementById('btn-notify-therapists').addEventListener('click', async () => {
  const btn = document.getElementById('btn-notify-therapists');
  btn.disabled = true; btn.textContent = '⏳ กำลังส่ง...';
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await API.notifyTherapists(today);
    if (res.error) throw new Error(res.error);
    const sent = (res.results || []).filter(r => r.status === 'sent').length;
    const failed = (res.results || []).filter(r => r.status === 'failed');
    if (failed.length) {
      showToast(`ส่งสำเร็จ ${sent} คน, ล้มเหลว ${failed.length} คน (${failed[0].reason})`);
    } else {
      showToast(`ส่งอีเมลคิวให้หมอนวด ${sent} คนแล้ว ✓`);
    }
  } catch (err) {
    showToast(`❌ ส่งอีเมลไม่สำเร็จ: ${err.message}`);
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-envelope"></i> Email หมอนวด';
  }
});

// ── Report Page ─────────────────────────────────────────────
async function renderReport() {
  try {
    const rows = await API.getReport();
    document.getElementById('report-tbody').innerHTML = rows.map(row => `
      <tr><td>${new Date(`${row.date}T00:00:00`).toLocaleDateString('th-TH', { weekday: 'long' })}</td>
      <td>${row.total}</td><td>${row.done}</td><td>${row.cancelled}</td>
      <td>${row.revenue.toLocaleString()} ฿</td></tr>
    `).join('');
  } catch (err) {
    document.getElementById('report-tbody').innerHTML = `<tr><td colspan="5">โหลดรายงานไม่สำเร็จ: ${err.message}</td></tr>`;
  }
}

// ── Settings Page ───────────────────────────────────────────
document.getElementById('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await API.saveSettings({
      name: document.getElementById('s-name').value.trim(),
      open: document.getElementById('s-open').value,
      close: document.getElementById('s-close').value,
      advance: Number(document.getElementById('s-advance').value),
      maxqueue: Number(document.getElementById('s-maxqueue').value),
    });
    showToast('บันทึกการตั้งค่าสำเร็จ ✓');
  } catch (err) { showToast(`บันทึกไม่สำเร็จ: ${err.message}`); }
});

async function loadSettings() {
  try {
    const settings = await API.getSettings();
    if (settings.name) document.getElementById('s-name').value = settings.name;
    if (settings.open) document.getElementById('s-open').value = settings.open;
    if (settings.close) document.getElementById('s-close').value = settings.close;
    if (settings.advance) document.getElementById('s-advance').value = settings.advance;
    if (settings.maxqueue) document.getElementById('s-maxqueue').value = settings.maxqueue;
  } catch (err) { showToast(`โหลดการตั้งค่าไม่สำเร็จ: ${err.message}`); }
}

// ── Init ────────────────────────────────────────────────────
async function init() {
  document.getElementById('f-date').valueAsDate = new Date();

  await loadServices();
  await loadStaff();
  await loadBookings();
  await loadNotifications();
  await renderReport();
  await loadSettings();

  // Auto-refresh ทุก 15 วินาที
  setInterval(loadBookings, 15000);
  setInterval(loadNotifications, 15000);
}
