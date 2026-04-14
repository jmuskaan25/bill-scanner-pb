// ============================================
// Cab Bill Scanner - Main Application Logic
// PocketBase Version
// ============================================

const pb = new PocketBase(CONFIG.PB_URL);

// ---- State ----
var currentFile = null;
var currentBase64 = null;

// ---- DOM Refs ----
var uploadZone = document.getElementById('uploadZone');
var fileInput = document.getElementById('fileInput');
var uploadIdleState = document.getElementById('uploadIdleState');
var uploadScanningState = document.getElementById('uploadScanningState');
var scanFileName = document.getElementById('scanFileName');
var uploadZoneSection = document.getElementById('uploadZoneSection');
var confirmCard = document.getElementById('confirmCard');
var confirmSubmitBtn = document.getElementById('confirmSubmitBtn');
var editToggleBtn = document.getElementById('editToggleBtn');
var cancelBtn = document.getElementById('cancelBtn');
var editForm = document.getElementById('editForm');
var confirmDetailsView = document.getElementById('confirmDetailsView');
var submitLoading = document.getElementById('submitLoading');
var successSection = document.getElementById('successSection');
var toastContainer = document.getElementById('toastContainer');

// Auth DOM refs
var signedOutView = document.getElementById('signedOutView');
var signedInView = document.getElementById('signedInView');
var userAvatar = document.getElementById('userAvatar');
var userName = document.getElementById('userName');
var userEmail = document.getElementById('userEmail');
var signOutLink = document.getElementById('signOutLink');

// Sign-in wall refs
var signInWall = document.getElementById('signInWall');
var wallSignInBtn = document.getElementById('wallSignInBtn');

// Admin refs
var adminToggleBtn = document.getElementById('adminToggleBtn');
var adminPasswordField = document.getElementById('adminPasswordField');
var adminPasswordInput = document.getElementById('adminPasswordInput');

if (adminToggleBtn && adminPasswordField) {
  adminToggleBtn.addEventListener('click', function() {
    var isVisible = adminPasswordField.style.display !== 'none';
    adminPasswordField.style.display = isVisible ? 'none' : 'block';
    adminToggleBtn.textContent = isVisible ? 'Sign in as Admin' : 'Cancel admin login';
  });
}

// ---- Auth ----
// Show manage link immediately if admin flag is already set
if (sessionStorage.getItem('via_admin') === '1') {
  var ml = document.getElementById('manageLink');
  if (ml) ml.style.display = 'inline-flex';
}

function showUser(record) {
  if (signInWall) signInWall.style.display = 'none';
  if (signedOutView) signedOutView.style.display = 'none';
  signedInView.style.display = 'flex';

  // Avatar: PocketBase OAuth2 users may have an avatar file or we use a placeholder
  var avatarUrl = '';
  if (record.avatar) {
    avatarUrl = pb.files.getURL(record, record.avatar);
  }
  userAvatar.src = avatarUrl || '';
  var userAvatarLarge = document.getElementById('userAvatarLarge');
  if (userAvatarLarge) userAvatarLarge.src = avatarUrl || '';

  userName.textContent = record.name || 'User';
  if (userEmail) userEmail.textContent = record.email || '';

  if (sessionStorage.getItem('via_admin') === '1') {
    var manageLink = document.getElementById('manageLink');
    if (manageLink) manageLink.style.display = 'inline-flex';
  }
}

function showWall() {
  if (signInWall) signInWall.style.display = 'flex';
  if (signedOutView) signedOutView.style.display = 'block';
  signedInView.style.display = 'none';
}

// Check if already logged in on page load
if (pb.authStore.isValid) {
  showUser(pb.authStore.record);
} else {
  // Only show wall if not authed
  showWall();
}

// Wall sign-in button
wallSignInBtn.addEventListener('click', async function() {
  var isAdminAttempt = adminPasswordField && adminPasswordField.style.display !== 'none';
  if (isAdminAttempt) {
    if (!adminPasswordInput || adminPasswordInput.value !== 'admin') {
      showToast('Incorrect admin password.', 'error');
      return;
    }
  }

  wallSignInBtn.disabled = true;
  wallSignInBtn.textContent = 'Signing in...';

  try {
    var authData = await pb.collection('users').authWithOAuth2({ provider: 'google' });
    if (isAdminAttempt) {
      sessionStorage.setItem('via_admin', '1');
      var manageLink = document.getElementById('manageLink');
      if (manageLink) manageLink.style.display = 'inline-flex';
    }
    sessionStorage.setItem('via_authed', '1');
    showUser(pb.authStore.record);
  } catch (err) {
    wallSignInBtn.disabled = false;
    wallSignInBtn.innerHTML = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" alt="Google"> Continue with Google';
    showToast('Sign-in failed: ' + err.message, 'error');
  }
});

// Sign out
signOutLink.addEventListener('click', function() {
  pb.authStore.clear();
  sessionStorage.removeItem('via_authed');
  sessionStorage.removeItem('via_admin');
  showWall();
  showToast('Signed out.', 'info');
});

// ---- Profile Dropdown ----
var profileDropdown = document.getElementById('profileDropdown');
if (userAvatar) {
  userAvatar.addEventListener('click', function(e) {
    e.stopPropagation();
    if (!profileDropdown) return;
    var isOpen = profileDropdown.style.display === 'block';
    profileDropdown.style.display = isOpen ? 'none' : 'block';
  });
}
if (profileDropdown) {
  document.addEventListener('click', function() { profileDropdown.style.display = 'none'; });
  profileDropdown.addEventListener('click', function(e) { e.stopPropagation(); });
}

// ---- Toast Notifications ----
function showToast(message, type) {
  type = type || 'info';
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}

// ---- File Upload Handling ----
uploadZone.addEventListener('click', function() { fileInput.click(); });

uploadZone.addEventListener('dragover', function(e) {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', function() {
  uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', function(e) {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  var file = e.dataTransfer.files[0];
  if (file) handleFileUpload(file);
});

fileInput.addEventListener('change', function(e) {
  var file = e.target.files[0];
  if (file) handleFileUpload(file);
});

function handleFileUpload(file) {
  var validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (validTypes.indexOf(file.type) === -1) {
    showToast('Please upload a JPG, PNG, WEBP, or PDF file.', 'error');
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    showToast('File too large. Maximum size is 20MB.', 'error');
    return;
  }

  currentFile = file;

  // Show scanning state immediately
  uploadIdleState.style.display = 'none';
  uploadScanningState.style.display = 'block';
  scanFileName.textContent = file.name;

  // Read file as base64 then auto-scan
  var reader = new FileReader();
  reader.onload = function(e) {
    var dataUrl = e.target.result;
    currentBase64 = dataUrl.split(',')[1];
    scanBill();
  };
  reader.readAsDataURL(file);
}

// ---- Scan Bill with Claude API (direct browser call) ----
async function scanBill() {
  if (!currentFile || !currentBase64) return;

  var mediaType = currentFile.type;
  var contentBlocks = [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: currentBase64
      }
    },
    {
      type: 'text',
      text: 'Extract the following fields from this cab/ride receipt image and return ONLY a JSON object (no markdown, no code fences):\n{\n  "provider": "Uber/Ola/Rapido/Auto/Other",\n  "rideId": "booking or trip ID",\n  "riderName": "passenger name",\n  "driverName": "driver name",\n  "vehicleNumber": "vehicle registration number",\n  "pickup": "pickup address",\n  "drop": "drop/destination address",\n  "date": "YYYY-MM-DD",\n  "totalAmount": 123.45,\n  "currency": "INR/USD/EUR/GBP",\n  "paymentMethod": "cash/upi/card"\n}\nIf a field is not found, use null. For totalAmount, use a number (not string). For date, use YYYY-MM-DD format.'
    }
  ];

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CONFIG.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: contentBlocks }]
      })
    });

    if (!response.ok) {
      var errBody = await response.text();
      throw new Error('API error ' + response.status + ': ' + errBody);
    }

    var result = await response.json();
    var text = result.content[0].text;

    // Try to parse JSON from the response (handle potential markdown fencing)
    var jsonStr = text;
    var fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1];
    jsonStr = jsonStr.trim();

    var data = JSON.parse(jsonStr);
    populateConfirmCard(data);
  } catch (err) {
    console.error('Scan error:', err);
    showToast('Scan failed: ' + err.message, 'error');
    resetUploadState();
  }
}

// ---- Populate Confirm Card ----
function populateConfirmCard(data) {
  // Header
  document.getElementById('confirmProvider').textContent = data.provider || 'Unknown';
  var currency = data.currency || 'INR';
  var symbol = currency === 'INR' ? '\u20B9' : currency === 'USD' ? '$' : currency === 'EUR' ? '\u20AC' : currency === 'GBP' ? '\u00A3' : currency;
  document.getElementById('confirmAmount').textContent = symbol + Number(data.totalAmount || 0).toFixed(2);
  document.getElementById('confirmDate').textContent = data.date || '';

  // Route
  document.getElementById('confirmPickup').textContent = data.pickup || '-';
  document.getElementById('confirmDrop').textContent = data.drop || '-';

  // Details
  document.getElementById('dRideId').textContent = data.rideId || '-';
  document.getElementById('dRiderName').textContent = data.riderName || '-';
  document.getElementById('dDriverName').textContent = data.driverName || '-';
  document.getElementById('dVehicle').textContent = data.vehicleNumber || '-';
  document.getElementById('dPayment').textContent = data.paymentMethod || '-';
  document.getElementById('dCurrency').textContent = currency;

  // Edit form (pre-populate)
  document.getElementById('formProvider').value = data.provider || 'Other';
  document.getElementById('formRideId').value = data.rideId || '';
  document.getElementById('formRiderName').value = data.riderName || '';
  document.getElementById('formDriverName').value = data.driverName || '';
  document.getElementById('formVehicleNumber').value = data.vehicleNumber || '';
  document.getElementById('formPickup').value = data.pickup || '';
  document.getElementById('formDrop').value = data.drop || '';
  document.getElementById('formDate').value = data.date || '';
  document.getElementById('formAmount').value = data.totalAmount || '';
  document.getElementById('formCurrency').value = currency;
  document.getElementById('formPaymentMethod').value = data.paymentMethod || 'cash';

  // Clear purpose
  document.getElementById('confirmPurposeInput').value = '';

  // Reset edit state
  editForm.style.display = 'none';
  confirmDetailsView.style.display = 'grid';
  editToggleBtn.textContent = 'Edit details';

  // Show confirm card with animation
  uploadZoneSection.style.display = 'none';
  confirmCard.style.display = 'block';
  requestAnimationFrame(function() { confirmCard.classList.add('visible'); });
}

// ---- Edit Toggle ----
editToggleBtn.addEventListener('click', function() {
  var isEditing = editForm.style.display !== 'none';
  if (isEditing) {
    // Save edits back to display view
    var currency = document.getElementById('formCurrency').value;
    var symbol = currency === 'INR' ? '\u20B9' : currency === 'USD' ? '$' : currency === 'EUR' ? '\u20AC' : currency === 'GBP' ? '\u00A3' : currency;

    document.getElementById('confirmProvider').textContent = document.getElementById('formProvider').value || 'Unknown';
    document.getElementById('confirmAmount').textContent = symbol + Number(document.getElementById('formAmount').value || 0).toFixed(2);
    document.getElementById('confirmDate').textContent = document.getElementById('formDate').value || '';
    document.getElementById('confirmPickup').textContent = document.getElementById('formPickup').value || '-';
    document.getElementById('confirmDrop').textContent = document.getElementById('formDrop').value || '-';
    document.getElementById('dRideId').textContent = document.getElementById('formRideId').value || '-';
    document.getElementById('dRiderName').textContent = document.getElementById('formRiderName').value || '-';
    document.getElementById('dDriverName').textContent = document.getElementById('formDriverName').value || '-';
    document.getElementById('dVehicle').textContent = document.getElementById('formVehicleNumber').value || '-';
    document.getElementById('dPayment').textContent = document.getElementById('formPaymentMethod').value || '-';
    document.getElementById('dCurrency').textContent = currency;

    editForm.style.display = 'none';
    confirmDetailsView.style.display = 'grid';
    editToggleBtn.textContent = 'Edit details';
  } else {
    editForm.style.display = 'block';
    confirmDetailsView.style.display = 'none';
    editToggleBtn.textContent = 'Done editing';
  }
});

// ---- Cancel (upload different receipt) ----
cancelBtn.addEventListener('click', function() {
  confirmCard.style.display = 'none';
  confirmCard.classList.remove('visible');
  uploadZoneSection.style.display = 'block';
  resetUploadState();
});

// ---- Submit ----
confirmSubmitBtn.addEventListener('click', async function() {
  await submitReimbursement();
});

async function submitReimbursement() {
  if (!pb.authStore.isValid) {
    showToast('Please sign in with Google first.', 'error');
    return;
  }

  if (!currentFile) {
    showToast('Please upload a receipt first.', 'error');
    return;
  }

  var formProvider = document.getElementById('formProvider').value;
  var formRideId = document.getElementById('formRideId').value.trim();
  var formRiderName = document.getElementById('formRiderName').value.trim();
  var formDriverName = document.getElementById('formDriverName').value.trim();
  var formVehicleNumber = document.getElementById('formVehicleNumber').value.trim();
  var formPickup = document.getElementById('formPickup').value.trim();
  var formDrop = document.getElementById('formDrop').value.trim();
  var formDate = document.getElementById('formDate').value;
  var formAmount = parseFloat(document.getElementById('formAmount').value);
  var formCurrency = document.getElementById('formCurrency').value;
  var formPaymentMethod = document.getElementById('formPaymentMethod').value;
  var formPurpose = document.getElementById('confirmPurposeInput').value.trim();

  if (!formAmount) {
    showToast('Please fill in the total amount.', 'error');
    return;
  }

  confirmSubmitBtn.disabled = true;
  submitLoading.style.display = 'flex';

  try {
    var record = pb.authStore.record;

    var formData = new FormData();
    formData.append('user', record.id);
    formData.append('submitted_by', record.name || 'User');
    formData.append('email', record.email);
    formData.append('photo_url', record.avatar ? pb.files.getURL(record, record.avatar) : '');
    formData.append('provider', formProvider);
    formData.append('ride_id', formRideId);
    formData.append('rider_name', formRiderName);
    formData.append('driver_name', formDriverName);
    formData.append('vehicle_number', formVehicleNumber);
    formData.append('pickup', formPickup);
    formData.append('drop_location', formDrop);
    formData.append('ride_date', formDate);
    formData.append('total_amount', formAmount);
    formData.append('currency', formCurrency);
    formData.append('payment_method', formPaymentMethod);
    formData.append('purpose', formPurpose);
    formData.append('receipt_image', currentFile);
    formData.append('status', 'pending');

    await pb.collection('reimbursements').create(formData);

    // Build success message
    var symbol = formCurrency === 'INR' ? '\u20B9' : formCurrency === 'USD' ? '$' : formCurrency === 'EUR' ? '\u20AC' : formCurrency === 'GBP' ? '\u00A3' : formCurrency;
    document.getElementById('successMsg').textContent = symbol + formAmount.toFixed(2) + ' from ' + formProvider + ' has been submitted.';

    // Show success state
    confirmCard.style.display = 'none';
    confirmCard.classList.remove('visible');
    successSection.style.display = 'block';

    showToast('Reimbursement submitted successfully!', 'success');
  } catch (err) {
    console.error('Submit error:', err);
    showToast('Submission failed: ' + err.message, 'error');
  } finally {
    confirmSubmitBtn.disabled = false;
    submitLoading.style.display = 'none';
  }
}

// ---- Submit Another ----
document.getElementById('submitAnotherBtn').addEventListener('click', function() {
  successSection.style.display = 'none';
  uploadZoneSection.style.display = 'block';
  resetUploadState();
});

// ---- Reset Upload State ----
function resetUploadState() {
  currentFile = null;
  currentBase64 = null;
  fileInput.value = '';
  uploadIdleState.style.display = 'block';
  uploadScanningState.style.display = 'none';
  scanFileName.textContent = '';
}

// ---- Utility ----
function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
