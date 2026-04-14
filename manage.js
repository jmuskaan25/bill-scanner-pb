// ============================================
// Cab Bill Scanner - Admin Management Page
// PocketBase Version
// ============================================

var pb = new PocketBase(CONFIG.PB_URL);

// ---- DOM Refs ----
var manageBody = document.getElementById('manageBody');
var toastContainer = document.getElementById('toastContainer');
var signInWall = document.getElementById('signInWall');
var wallSignInBtn = document.getElementById('wallSignInBtn');
var adminToggleBtn = document.getElementById('adminToggleBtn');
var adminPasswordField = document.getElementById('adminPasswordField');
var adminPasswordInput = document.getElementById('adminPasswordInput');

// ---- Admin Toggle ----
if (adminToggleBtn && adminPasswordField) {
  adminToggleBtn.addEventListener('click', function() {
    var isVisible = adminPasswordField.style.display !== 'none';
    adminPasswordField.style.display = isVisible ? 'none' : 'block';
    adminToggleBtn.textContent = isVisible ? 'Sign in as Admin' : 'Cancel admin login';
  });
}

// Hide wall if already authed as admin
if (pb.authStore.isValid && sessionStorage.getItem('via_admin') === '1' && signInWall) {
  signInWall.style.display = 'none';
  loadAllSubmissions();
} else if (pb.authStore.isValid && sessionStorage.getItem('via_admin') !== '1') {
  // Logged in but not admin — redirect
  showToast('Admin access required.', 'error');
  setTimeout(function() { window.location.href = 'index.html'; }, 1500);
} else {
  // Not logged in
  if (signInWall) signInWall.style.display = 'flex';
}

// ---- Wall Sign-In Button ----
wallSignInBtn.addEventListener('click', async function() {
  wallSignInBtn.disabled = true;
  wallSignInBtn.textContent = 'Signing in...';

  var isAdminAttempt = adminPasswordField && adminPasswordField.style.display !== 'none';
  if (!isAdminAttempt) {
    showToast('Please use the admin login toggle below.', 'error');
    wallSignInBtn.disabled = false;
    wallSignInBtn.innerHTML = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" alt="Google"> Continue with Google';
    return;
  }

  if (!adminPasswordInput || adminPasswordInput.value !== 'admin') {
    showToast('Incorrect admin password.', 'error');
    wallSignInBtn.disabled = false;
    wallSignInBtn.innerHTML = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" alt="Google"> Continue with Google';
    return;
  }

  try {
    await pb.collection('users').authWithOAuth2({ provider: 'google' });
    sessionStorage.setItem('via_authed', '1');
    sessionStorage.setItem('via_admin', '1');
    if (signInWall) signInWall.style.display = 'none';
    loadAllSubmissions();
  } catch (err) {
    wallSignInBtn.disabled = false;
    wallSignInBtn.innerHTML = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" alt="Google"> Continue with Google';
    showToast('Sign-in failed: ' + err.message, 'error');
  }
});

// ---- Toast ----
function showToast(message, type) {
  type = type || 'info';
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}

// ---- Load All Submissions ----
async function loadAllSubmissions() {
  manageBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:#9ca3af;">Loading...</td></tr>';

  try {
    var records = await pb.collection('reimbursements').getFullList({ sort: '-created' });

    if (records.length === 0) {
      manageBody.innerHTML =
        '<tr><td colspan="7">' +
          '<div class="empty-state">' +
            '<span class="empty-icon">📭</span>' +
            '<p>No submissions yet.</p>' +
          '</div>' +
        '</td></tr>';
      return;
    }

    manageBody.innerHTML = '';
    records.forEach(function(d) {
      var tr = document.createElement('tr');

      var submittedAt = '--';
      if (d.created) {
        submittedAt = new Date(d.created).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric'
        });
      }

      var submittedByHtml = escapeHtml(d.submitted_by || '--');
      if (d.photo_url) {
        submittedByHtml = '<span style="display:inline-flex;align-items:center;gap:6px;"><img src="' + escapeHtml(d.photo_url) + '" style="width:22px;height:22px;border-radius:50%;vertical-align:middle;">' + escapeHtml(d.submitted_by || '--') + '</span>';
      }

      var currency = d.currency || 'INR';
      var symbol = currency === 'INR' ? '\u20B9' : currency + ' ';
      var amount = d.total_amount != null ? symbol + Number(d.total_amount).toFixed(2) : '--';

      var status = d.status || 'pending';

      tr.innerHTML =
        '<td style="white-space:nowrap;">' + escapeHtml(submittedAt) + '</td>' +
        '<td>' + submittedByHtml + '</td>' +
        '<td>' + escapeHtml(d.provider || '--') + '</td>' +
        '<td>' + escapeHtml(d.pickup || '--') + '</td>' +
        '<td>' + escapeHtml(d.drop_location || '--') + '</td>' +
        '<td><strong>' + escapeHtml(amount) + '</strong></td>' +
        '<td>' +
          '<select class="status-select status-' + escapeHtml(status) + '" data-record-id="' + escapeHtml(d.id) + '" data-current="' + escapeHtml(status) + '">' +
            '<option value="pending"' + (status === 'pending' ? ' selected' : '') + '>Pending</option>' +
            '<option value="approved"' + (status === 'approved' ? ' selected' : '') + '>Approved</option>' +
            '<option value="rejected"' + (status === 'rejected' ? ' selected' : '') + '>Rejected</option>' +
          '</select>' +
        '</td>';
      manageBody.appendChild(tr);
    });

    // Attach change listeners to status dropdowns
    manageBody.querySelectorAll('.status-select').forEach(function(select) {
      select.addEventListener('change', async function(e) {
        var recordId = e.target.dataset.recordId;
        var newStatus = e.target.value;
        var oldStatus = e.target.dataset.current;
        if (newStatus === oldStatus) return;

        e.target.disabled = true;
        try {
          await pb.collection('reimbursements').update(recordId, { status: newStatus });
          e.target.dataset.current = newStatus;
          e.target.className = 'status-select status-' + newStatus;
          showToast('Updated to ' + newStatus, 'success');
        } catch (err) {
          console.error(err);
          e.target.value = oldStatus;
          showToast('Failed: ' + err.message, 'error');
        } finally {
          e.target.disabled = false;
        }
      });
    });

  } catch (err) {
    console.error('Error loading submissions:', err);
    manageBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:#ef4444;">Failed to load. Please refresh.</td></tr>';
  }
}

// ---- Utility ----
function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
