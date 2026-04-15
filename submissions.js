// ============================================
// Cab Bill Scanner - Submissions Page Logic
// PocketBase Version
// ============================================

var pb = new PocketBase(window.location.origin);

// ---- DOM Refs ----
var submissionsBody = document.getElementById('submissionsBody');
var toastContainer = document.getElementById('toastContainer');
var signInWall = document.getElementById('signInWall');
var wallSignInBtn = document.getElementById('wallSignInBtn');

// ---- Auth Check & Load ----
async function init() {
  if (pb.authStore.isValid) {
    try {
      await pb.collection('users').authRefresh();
    } catch (e) {
      pb.authStore.clear();
      if (signInWall) signInWall.style.display = 'flex';
      return;
    }
    if (signInWall) signInWall.style.display = 'none';
    loadRecentSubmissions();
  } else {
    if (signInWall) signInWall.style.display = 'flex';
  }
}
init();

// Wall sign-in button
wallSignInBtn.addEventListener('click', async function() {
  wallSignInBtn.disabled = true;
  wallSignInBtn.textContent = 'Signing in...';

  try {
    await pb.collection('users').authWithOAuth2({ provider: 'google' });
    sessionStorage.setItem('via_authed', '1');
    if (signInWall) signInWall.style.display = 'none';
    loadRecentSubmissions();
  } catch (err) {
    wallSignInBtn.disabled = false;
    wallSignInBtn.innerHTML = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" alt="Google"> Continue with Google';
    showToast('Sign-in failed: ' + err.message, 'error');
  }
});

// ---- Toast Notifications ----
function showToast(message, type) {
  type = type || 'info';
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}

// ---- Load Recent Submissions ----
async function loadRecentSubmissions() {
  if (!pb.authStore.isValid) return;

  submissionsBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:#9ca3af;">Loading...</td></tr>';

  try {
    var resp = await fetch('/api/my-reimbursements', {
      headers: { 'Authorization': pb.authStore.token }
    });
    if (!resp.ok) {
      var errText = await resp.text();
      throw new Error('HTTP ' + resp.status);
    }
    var records = await resp.json();
    var docs = records.items;

    if (docs.length === 0) {
      submissionsBody.innerHTML =
        '<tr><td colspan="7">' +
          '<div class="empty-state">' +
            '<span class="empty-icon">📭</span>' +
            '<p>No submissions yet. Upload a cab receipt to get started!</p>' +
          '</div>' +
        '</td></tr>';
      return;
    }

    submissionsBody.innerHTML = '';
    docs.forEach(function(d) {
      var tr = document.createElement('tr');

      var rideDate = '--';
      if (d.ride_date && /^\d{4}-\d{2}-\d{2}/.test(d.ride_date)) {
        rideDate = new Date(d.ride_date).toLocaleDateString('en-IN', {
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

      tr.innerHTML =
        '<td style="white-space:nowrap;">' + escapeHtml(rideDate) + '</td>' +
        '<td>' + submittedByHtml + '</td>' +
        '<td>' + escapeHtml(d.provider || '--') + '</td>' +
        '<td style="white-space:nowrap;">' + escapeHtml(rideDate) + '</td>' +
        '<td>' + escapeHtml(d.pickup || '--') + '</td>' +
        '<td>' + escapeHtml(d.drop_location || '--') + '</td>' +
        '<td><strong>' + escapeHtml(amount) + '</strong></td>';
      submissionsBody.appendChild(tr);
    });

  } catch (err) {
    console.error('Error loading submissions:', err);
    submissionsBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:#ef4444;">Failed to load. Please refresh.</td></tr>';
  }
}

// ---- Utility ----
function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
