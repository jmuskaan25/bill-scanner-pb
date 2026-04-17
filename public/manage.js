// ============================================
// Pronto Travel - Admin Management Page
// Django + JWT version
// ============================================

var TOKEN_KEY = 'pronto_token';
var USER_KEY  = 'pronto_user';
function getToken() { return localStorage.getItem(TOKEN_KEY); }
function getUser()  { var u = localStorage.getItem(USER_KEY); return u ? JSON.parse(u) : null; }
function clearAuth(){ localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
function authHeaders(){ return { 'Authorization': 'Bearer ' + getToken() }; }

var manageBody     = document.getElementById('manageBody');
var toastContainer = document.getElementById('toastContainer');
var signInWall     = document.getElementById('signInWall');
var phoneStep      = document.getElementById('phoneStep');
var otpStep        = document.getElementById('otpStep');
var phoneInput     = document.getElementById('phoneInput');
var sendOtpBtn     = document.getElementById('sendOtpBtn');
var otpInput       = document.getElementById('otpInput');
var verifyOtpBtn   = document.getElementById('verifyOtpBtn');
var backToPhoneBtn = document.getElementById('backToPhoneBtn');
var otpPhoneSpan   = document.getElementById('otpPhoneSpan');

function showToast(message, type) {
  type = type || 'info';
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Auth check on load ----
async function init() {
  if (getToken()) {
    var resp = await fetch('/api/auth/me', { headers: authHeaders() });
    if (!resp.ok) { clearAuth(); if (signInWall) signInWall.style.display = 'flex'; return; }
    var user = await resp.json();
    if (!user.is_admin) {
      showToast('Admin access required.', 'error');
      setTimeout(function() { window.location.href = 'index.html'; }, 1500);
      return;
    }
    if (signInWall) signInWall.style.display = 'none';
    loadAllSubmissions();
  } else {
    if (signInWall) signInWall.style.display = 'flex';
  }
}
init();

// ---- OTP flow ----
sendOtpBtn.addEventListener('click', async function() {
  var phone = (phoneInput.value || '').trim();
  if (!phone.startsWith('+')) { showToast('Use E.164 format: +91XXXXXXXXXX', 'error'); return; }
  sendOtpBtn.disabled = true; sendOtpBtn.textContent = 'Sending…';
  try {
    var resp = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone })
    });
    if (!resp.ok) { var e = await resp.json(); throw new Error(e.error || 'Failed'); }
    if (otpPhoneSpan) otpPhoneSpan.textContent = phone;
    phoneStep.style.display = 'none'; otpStep.style.display = 'block';
    showToast('OTP sent!', 'success');
  } catch(err) {
    showToast(err.message, 'error');
    sendOtpBtn.disabled = false; sendOtpBtn.textContent = 'Send OTP';
  }
});

verifyOtpBtn.addEventListener('click', async function() {
  var phone = (phoneInput.value || '').trim();
  var otp   = (otpInput.value || '').trim();
  if (!otp || otp.length !== 6) { showToast('Enter the 6-digit code', 'error'); return; }
  verifyOtpBtn.disabled = true; verifyOtpBtn.textContent = 'Verifying…';
  try {
    var resp = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone, otp: otp })
    });
    if (!resp.ok) { var e = await resp.json(); throw new Error(e.error || 'Invalid OTP'); }
    var data = await resp.json();
    localStorage.setItem(TOKEN_KEY, data.access);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    if (!data.user.is_admin) {
      showToast('Admin access required.', 'error');
      setTimeout(function() { window.location.href = 'index.html'; }, 1500);
      return;
    }
    if (signInWall) signInWall.style.display = 'none';
    loadAllSubmissions();
  } catch(err) {
    showToast(err.message, 'error');
    verifyOtpBtn.disabled = false; verifyOtpBtn.textContent = 'Verify';
  }
});

if (backToPhoneBtn) {
  backToPhoneBtn.addEventListener('click', function() {
    otpStep.style.display = 'none'; phoneStep.style.display = 'block';
    sendOtpBtn.disabled = false; sendOtpBtn.textContent = 'Send OTP'; otpInput.value = '';
  });
}

// ---- Load all submissions ----
async function loadAllSubmissions() {
  manageBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:#9ca3af;">Loading...</td></tr>';
  try {
    var resp = await fetch('/api/all-reimbursements', { headers: authHeaders() });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    var records = data.items;

    if (records.length === 0) {
      manageBody.innerHTML =
        '<tr><td colspan="7"><div class="empty-state"><span class="empty-icon">📭</span>' +
        '<p>No submissions yet.</p></div></td></tr>';
      return;
    }

    manageBody.innerHTML = '';
    records.forEach(function(d) {
      var tr = document.createElement('tr');
      var rideDate = '--';
      if (d.ride_date && /^\d{4}-\d{2}-\d{2}/.test(d.ride_date)) {
        rideDate = new Date(d.ride_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      }
      var currency = d.currency || 'INR';
      var symbol   = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }[currency] || currency;
      var amount   = d.total_amount != null ? symbol + Number(d.total_amount).toFixed(2) : '--';
      var status   = d.status || 'pending';

      tr.innerHTML =
        '<td style="white-space:nowrap;">' + escapeHtml(rideDate) + '</td>' +
        '<td>' + escapeHtml(d.submitted_by || '--') + '</td>' +
        '<td>' + escapeHtml(d.provider || '--') + '</td>' +
        '<td>' + escapeHtml(d.pickup || '--') + '</td>' +
        '<td>' + escapeHtml(d.drop_location || '--') + '</td>' +
        '<td><strong>' + escapeHtml(amount) + '</strong></td>' +
        '<td>' +
          '<select class="status-select status-' + escapeHtml(status) + '" ' +
                  'data-record-id="' + escapeHtml(String(d.id)) + '" ' +
                  'data-current="' + escapeHtml(status) + '">' +
            '<option value="pending"'  + (status === 'pending'  ? ' selected' : '') + '>Pending</option>' +
            '<option value="approved"' + (status === 'approved' ? ' selected' : '') + '>Approved</option>' +
            '<option value="rejected"' + (status === 'rejected' ? ' selected' : '') + '>Rejected</option>' +
          '</select>' +
        '</td>';
      manageBody.appendChild(tr);
    });

    manageBody.querySelectorAll('.status-select').forEach(function(select) {
      select.addEventListener('change', async function(e) {
        var recordId  = e.target.dataset.recordId;
        var newStatus = e.target.value;
        var oldStatus = e.target.dataset.current;
        if (newStatus === oldStatus) return;
        e.target.disabled = true;
        try {
          var r = await fetch('/api/reimbursements/' + recordId + '/status', {
            method: 'PATCH',
            headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
            body: JSON.stringify({ status: newStatus })
          });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          e.target.dataset.current = newStatus;
          e.target.className = 'status-select status-' + newStatus;
          showToast('Updated to ' + newStatus, 'success');
        } catch(err) {
          e.target.value = oldStatus;
          showToast('Failed: ' + err.message, 'error');
        } finally {
          e.target.disabled = false;
        }
      });
    });
  } catch(err) {
    console.error(err);
    manageBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:#ef4444;">Failed to load. Please refresh.</td></tr>';
  }
}
