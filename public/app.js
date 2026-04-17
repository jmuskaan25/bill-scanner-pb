// ============================================
// Pronto Travel - Main Application Logic
// Django + JWT version
// ============================================

// ---- Auth helpers ----
var TOKEN_KEY = 'pronto_token';
var USER_KEY  = 'pronto_user';

function getToken()  { return localStorage.getItem(TOKEN_KEY); }
function getUser()   { var u = localStorage.getItem(USER_KEY); return u ? JSON.parse(u) : null; }
function isLoggedIn(){ return !!getToken(); }
function setAuth(data) {
  localStorage.setItem(TOKEN_KEY, data.access);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}
function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
function authHeaders() { return { 'Authorization': 'Bearer ' + getToken() }; }

// ---- State ----
var currentFile   = null;
var currentBase64 = null;

// ---- DOM Refs ----
var uploadZone         = document.getElementById('uploadZone');
var fileInput          = document.getElementById('fileInput');
var uploadIdleState    = document.getElementById('uploadIdleState');
var uploadScanningState= document.getElementById('uploadScanningState');
var scanFileName       = document.getElementById('scanFileName');
var uploadZoneSection  = document.getElementById('uploadZoneSection');
var confirmCard        = document.getElementById('confirmCard');
var confirmSubmitBtn   = document.getElementById('confirmSubmitBtn');
var editToggleBtn      = document.getElementById('editToggleBtn');
var cancelBtn          = document.getElementById('cancelBtn');
var editForm           = document.getElementById('editForm');
var confirmDetailsView = document.getElementById('confirmDetailsView');
var submitLoading      = document.getElementById('submitLoading');
var successSection     = document.getElementById('successSection');
var toastContainer     = document.getElementById('toastContainer');

// Auth DOM refs
var signedInView  = document.getElementById('signedInView');
var userAvatar    = document.getElementById('userAvatar');
var userName      = document.getElementById('userName');
var userEmail     = document.getElementById('userEmail');

// Sign-in wall refs
var signInWall    = document.getElementById('signInWall');
var phoneStep     = document.getElementById('phoneStep');
var otpStep       = document.getElementById('otpStep');
var phoneInput    = document.getElementById('phoneInput');
var sendOtpBtn    = document.getElementById('sendOtpBtn');
var otpInput      = document.getElementById('otpInput');
var verifyOtpBtn  = document.getElementById('verifyOtpBtn');
var backToPhoneBtn= document.getElementById('backToPhoneBtn');
var otpPhoneSpan  = document.getElementById('otpPhoneSpan');

// ---- Auth: show / hide ----
function showUser(user) {
  if (signInWall) signInWall.style.display = 'none';
  signedInView.style.display = 'flex';
  userAvatar.src = '';
  userName.textContent  = user.name || user.phone;
  if (userEmail) userEmail.textContent = user.phone;
  if (user.is_admin) {
    var ml = document.getElementById('manageLink');
    if (ml) ml.style.display = 'inline-flex';
  }
}

function showWall() {
  if (signInWall) signInWall.style.display = 'flex';
  signedInView.style.display = 'none';
}

// ---- Auth: load on startup ----
if (isLoggedIn()) {
  fetch('/api/auth/me', { headers: authHeaders() })
    .then(function(r) {
      if (r.ok) return r.json().then(showUser);
      clearAuth(); showWall();
    })
    .catch(function() { clearAuth(); showWall(); });
} else {
  showWall();
}

// ---- Send OTP ----
sendOtpBtn.addEventListener('click', async function() {
  var phone = (phoneInput.value || '').trim();
  if (!phone.startsWith('+')) {
    showToast('Use E.164 format: +91XXXXXXXXXX', 'error');
    return;
  }
  sendOtpBtn.disabled = true;
  sendOtpBtn.textContent = 'Sending…';
  try {
    var resp = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone })
    });
    if (!resp.ok) { var e = await resp.json(); throw new Error(e.error || 'Failed'); }
    if (otpPhoneSpan) otpPhoneSpan.textContent = phone;
    phoneStep.style.display = 'none';
    otpStep.style.display   = 'block';
    showToast('OTP sent!', 'success');
  } catch(err) {
    showToast(err.message, 'error');
    sendOtpBtn.disabled = false;
    sendOtpBtn.textContent = 'Send OTP';
  }
});

// ---- Verify OTP ----
verifyOtpBtn.addEventListener('click', async function() {
  var phone = (phoneInput.value || '').trim();
  var otp   = (otpInput.value || '').trim();
  if (!otp || otp.length !== 6) { showToast('Enter the 6-digit code', 'error'); return; }
  verifyOtpBtn.disabled = true;
  verifyOtpBtn.textContent = 'Verifying…';
  try {
    var resp = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone, otp: otp })
    });
    if (!resp.ok) { var e = await resp.json(); throw new Error(e.error || 'Invalid OTP'); }
    var data = await resp.json();
    setAuth(data);
    showUser(data.user);
  } catch(err) {
    showToast(err.message, 'error');
    verifyOtpBtn.disabled = false;
    verifyOtpBtn.textContent = 'Verify';
  }
});

if (backToPhoneBtn) {
  backToPhoneBtn.addEventListener('click', function() {
    otpStep.style.display   = 'none';
    phoneStep.style.display = 'block';
    sendOtpBtn.disabled  = false;
    sendOtpBtn.textContent = 'Send OTP';
    otpInput.value = '';
  });
}

// ---- Sign out ----
var signOutLink = document.getElementById('signOutLink');
if (signOutLink) {
  signOutLink.addEventListener('click', function() {
    clearAuth();
    showWall();
    phoneStep.style.display = 'block';
    otpStep.style.display   = 'none';
    showToast('Signed out.', 'info');
  });
}

// ---- Profile Dropdown ----
var profileDropdown = document.getElementById('profileDropdown');
if (userAvatar) {
  userAvatar.addEventListener('click', function(e) {
    e.stopPropagation();
    if (!profileDropdown) return;
    profileDropdown.style.display = profileDropdown.style.display === 'block' ? 'none' : 'block';
  });
}
if (profileDropdown) {
  document.addEventListener('click', function() { profileDropdown.style.display = 'none'; });
  profileDropdown.addEventListener('click', function(e) { e.stopPropagation(); });
}

// ---- Toast ----
function showToast(message, type) {
  type = type || 'info';
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}

// ---- File Upload ----
uploadZone.addEventListener('click', function() { fileInput.click(); });
uploadZone.addEventListener('dragover', function(e) { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', function() { uploadZone.classList.remove('drag-over'); });
uploadZone.addEventListener('drop', function(e) {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', function(e) {
  if (e.target.files[0]) handleFileUpload(e.target.files[0]);
});

function handleFileUpload(file) {
  var valid = ['image/jpeg','image/png','image/webp','application/pdf'];
  if (valid.indexOf(file.type) === -1) { showToast('Upload JPG, PNG, WEBP, or PDF.', 'error'); return; }
  if (file.size > 20 * 1024 * 1024)   { showToast('File too large (max 20 MB).', 'error'); return; }
  currentFile = file;
  uploadIdleState.style.display    = 'none';
  uploadScanningState.style.display= 'block';
  scanFileName.textContent         = file.name;
  var reader = new FileReader();
  reader.onload = function(e) {
    currentBase64 = e.target.result.split(',')[1];
    scanBill();
  };
  reader.readAsDataURL(file);
}

// ---- Scan ----
async function scanBill() {
  if (!currentFile || !currentBase64) return;
  try {
    var resp = await fetch('/api/scan', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({ image: currentBase64, media_type: currentFile.type })
    });
    if (!resp.ok) { var e = await resp.text(); throw new Error('Scan error ' + resp.status + ': ' + e); }
    var data = await resp.json();
    populateConfirmCard(data);
  } catch(err) {
    console.error('Scan error:', err);
    showToast('Scan failed: ' + err.message, 'error');
    resetUploadState();
  }
}

// ---- Populate Confirm Card ----
function populateConfirmCard(data) {
  document.getElementById('confirmProvider').textContent = data.provider || 'Unknown';
  var currency = data.currency || 'INR';
  var symbol = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }[currency] || currency;
  document.getElementById('confirmAmount').textContent = symbol + Number(data.totalAmount || 0).toFixed(2);
  document.getElementById('confirmDate').textContent   = data.date || '';
  document.getElementById('confirmPickup').textContent = data.pickup || '-';
  document.getElementById('confirmDrop').textContent   = data.drop || '-';
  document.getElementById('dRideId').textContent    = data.rideId || '-';
  document.getElementById('dRiderName').textContent = data.riderName || '-';
  document.getElementById('dDriverName').textContent= data.driverName || '-';
  document.getElementById('dVehicle').textContent   = data.vehicleNumber || '-';
  document.getElementById('dPayment').textContent   = data.paymentMethod || '-';
  document.getElementById('dCurrency').textContent  = currency;
  document.getElementById('formProvider').value      = data.provider || 'Other';
  document.getElementById('formRideId').value        = data.rideId || '';
  document.getElementById('formRiderName').value     = data.riderName || '';
  document.getElementById('formDriverName').value    = data.driverName || '';
  document.getElementById('formVehicleNumber').value = data.vehicleNumber || '';
  document.getElementById('formPickup').value        = data.pickup || '';
  document.getElementById('formDrop').value          = data.drop || '';
  document.getElementById('formDate').value          = data.date || '';
  document.getElementById('formAmount').value        = data.totalAmount || '';
  document.getElementById('formCurrency').value      = currency;
  document.getElementById('formPaymentMethod').value = data.paymentMethod || 'cash';
  document.getElementById('confirmPurposeInput').value = '';
  editForm.style.display          = 'none';
  confirmDetailsView.style.display= 'grid';
  editToggleBtn.textContent       = 'Edit details';
  uploadZoneSection.style.display = 'none';
  confirmCard.style.display       = 'block';
  requestAnimationFrame(function() { confirmCard.classList.add('visible'); });
}

// ---- Edit Toggle ----
editToggleBtn.addEventListener('click', function() {
  var isEditing = editForm.style.display !== 'none';
  if (isEditing) {
    var currency = document.getElementById('formCurrency').value;
    var symbol = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }[currency] || currency;
    document.getElementById('confirmProvider').textContent = document.getElementById('formProvider').value || 'Unknown';
    document.getElementById('confirmAmount').textContent   = symbol + Number(document.getElementById('formAmount').value || 0).toFixed(2);
    document.getElementById('confirmDate').textContent     = document.getElementById('formDate').value || '';
    document.getElementById('confirmPickup').textContent   = document.getElementById('formPickup').value || '-';
    document.getElementById('confirmDrop').textContent     = document.getElementById('formDrop').value || '-';
    document.getElementById('dRideId').textContent    = document.getElementById('formRideId').value || '-';
    document.getElementById('dRiderName').textContent = document.getElementById('formRiderName').value || '-';
    document.getElementById('dDriverName').textContent= document.getElementById('formDriverName').value || '-';
    document.getElementById('dVehicle').textContent   = document.getElementById('formVehicleNumber').value || '-';
    document.getElementById('dPayment').textContent   = document.getElementById('formPaymentMethod').value || '-';
    document.getElementById('dCurrency').textContent  = currency;
    editForm.style.display          = 'none';
    confirmDetailsView.style.display= 'grid';
    editToggleBtn.textContent       = 'Edit details';
  } else {
    editForm.style.display          = 'block';
    confirmDetailsView.style.display= 'none';
    editToggleBtn.textContent       = 'Done editing';
  }
});

// ---- Cancel ----
cancelBtn.addEventListener('click', function() {
  confirmCard.style.display = 'none';
  confirmCard.classList.remove('visible');
  uploadZoneSection.style.display = 'block';
  resetUploadState();
});

// ---- Submit ----
confirmSubmitBtn.addEventListener('click', async function() {
  if (!isLoggedIn()) { showToast('Please sign in first.', 'error'); return; }
  if (!currentFile)  { showToast('Please upload a receipt first.', 'error'); return; }

  var formAmount = parseFloat(document.getElementById('formAmount').value);
  if (!formAmount) { showToast('Please fill in the total amount.', 'error'); return; }

  confirmSubmitBtn.disabled       = true;
  submitLoading.style.display     = 'flex';

  try {
    var user = getUser();
    var fd   = new FormData();
    fd.append('submitted_by',    user.name || user.phone);
    fd.append('provider',        document.getElementById('formProvider').value);
    fd.append('ride_id',         document.getElementById('formRideId').value.trim());
    fd.append('rider_name',      document.getElementById('formRiderName').value.trim());
    fd.append('driver_name',     document.getElementById('formDriverName').value.trim());
    fd.append('vehicle_number',  document.getElementById('formVehicleNumber').value.trim());
    fd.append('pickup',          document.getElementById('formPickup').value.trim());
    fd.append('drop_location',   document.getElementById('formDrop').value.trim());
    fd.append('ride_date',       document.getElementById('formDate').value);
    fd.append('total_amount',    formAmount);
    fd.append('currency',        document.getElementById('formCurrency').value);
    fd.append('payment_method',  document.getElementById('formPaymentMethod').value);
    fd.append('purpose',         document.getElementById('confirmPurposeInput').value.trim());
    fd.append('receipt_image',   currentFile);

    var resp = await fetch('/api/reimbursements', {
      method: 'POST',
      headers: authHeaders(),
      body: fd
    });
    if (!resp.ok) { var e = await resp.json(); throw new Error(JSON.stringify(e)); }

    var currency = document.getElementById('formCurrency').value;
    var symbol = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }[currency] || currency;
    var providerName = document.getElementById('formProvider').value;
    document.getElementById('successMsg').textContent =
      symbol + formAmount.toFixed(2) + ' from ' + providerName + ' has been submitted.';

    confirmCard.style.display = 'none';
    confirmCard.classList.remove('visible');
    successSection.style.display = 'block';
    showToast('Submitted!', 'success');
  } catch(err) {
    console.error('Submit error:', err);
    showToast('Submission failed: ' + err.message, 'error');
  } finally {
    confirmSubmitBtn.disabled   = false;
    submitLoading.style.display = 'none';
  }
});

// ---- Submit Another ----
document.getElementById('submitAnotherBtn').addEventListener('click', function() {
  successSection.style.display    = 'none';
  uploadZoneSection.style.display = 'block';
  resetUploadState();
});

// ---- Reset Upload State ----
function resetUploadState() {
  currentFile = null; currentBase64 = null;
  fileInput.value = '';
  uploadIdleState.style.display    = 'block';
  uploadScanningState.style.display= 'none';
  scanFileName.textContent         = '';
}
