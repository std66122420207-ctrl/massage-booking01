// ============================================================
//  API Wrapper — เรียก Node.js + Express backend
// ============================================================
const API = {

  async _request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, options);
    let body = null;
    try { body = await res.json(); } catch { body = {}; }
    if (!res.ok) {
      const error = new Error(body.error || `Request failed (${res.status})`);
      error.status = res.status;
      throw error;
    }
    return body;
  },

  async _token() {
    const user = firebase.auth().currentUser;
    return user ? await user.getIdToken() : null;
  },

  async _headers() {
    const token = await this._token();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  },

  async getServices() {
    return this._request('/services');
  },

  async getStaff() {
    return this._request('/staff');
  },

  async uploadStaffPhoto(file) {
    const token = await this._token();
    const headers = {
      'Content-Type': file.type,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
    return this._request('/staff/photo', {
      method: 'POST',
      headers,
      body: file,
    });
  },

  async updateStaff(id, data) {
    return this._request(`/staff/${id}`, {
      method: 'PATCH',
      headers: await this._headers(),
      body: JSON.stringify(data),
    });
  },

  async updateStaffStatus(id, status) {
    return this._request(`/staff/${id}/status`, {
      method: 'PATCH',
      headers: await this._headers(),
      body: JSON.stringify({ status }),
    });
  },

  async deleteStaff(id) {
    return this._request(`/staff/${id}`, {
      method: 'DELETE',
      headers: await this._headers(),
    });
  },

  async createStaff(data) {
    return this._request('/staff', {
      method: 'POST',
      headers: await this._headers(),
      body: JSON.stringify(data),
    });
  },

  async getTodayBookings() {
    return this._request('/bookings/admin/today', {
      headers: await this._headers(),
    });
  },
  async getUpcomingBookings() {
    return this._request('/bookings/admin/upcoming', {
      headers: await this._headers(),
    });
  },
  async getQueueStatus() {
    return this._request('/queue/status');
  },

  async createBooking(data) {
    return this._request('/bookings', {
      method: 'POST',
      headers: await this._headers(),
      body: JSON.stringify(data),
    });
  },

  async updateBooking(id, data) {
    return this._request(`/bookings/${id}`, {
      method: 'PATCH',
      headers: await this._headers(),
      body: JSON.stringify(data),
    });
  },

  async cancelBooking(id) {
    return this._request(`/bookings/${id}`, {
      method: 'DELETE',
      headers: await this._headers(),
    });
  },

  async callNextQueue() {
    return this._request('/queue/call-next', {
      method: 'POST',
      headers: await this._headers(),
    });
  },

  async callBooking(bookingId) {
    return this._request('/queue/call', {
      method: 'POST',
      headers: await this._headers(),
      body: JSON.stringify({ bookingId }),
    });
  },

  async completeQueue(bookingId) {
    return this._request('/queue/complete', {
      method: 'POST',
      headers: await this._headers(),
      body: JSON.stringify({ bookingId }),
    });
  },

  async getAdminNotifications() {
    return this._request('/notifications/admin/all', {
      headers: await this._headers(),
    });
  },

  async resendNotification(id) {
    return this._request(`/notifications/${id}/resend`, {
      method: 'POST',
      headers: await this._headers(),
    });
  },

  async confirmNotificationByAdmin(id) {
    return this._request(`/notifications/${id}/admin-confirm`, {
      method: 'POST',
      headers: await this._headers(),
    });
  },

  async cancelNotificationBooking(id) {
    return this._request(`/notifications/${id}/admin-cancel`, {
      method: 'POST',
      headers: await this._headers(),
    });
  },

  async getReport() {
    return this._request('/admin/report', { headers: await this._headers() });
  },

  async getSettings() {
    return this._request('/admin/settings', { headers: await this._headers() });
  },

  async saveSettings(data) {
    return this._request('/admin/settings', {
      method: 'PUT',
      headers: await this._headers(),
      body: JSON.stringify(data),
    });
  },
};
