import { getAuthToken, authenticate, signOut, savePersonalAccessToken } from '../utils/auth.js';
import { fetchUserProfile, fetchRepositories } from '../utils/github.js';
import { getSettings, saveSettings, getStats, saveStats } from '../utils/storage.js';


const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.section');

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const target = item.dataset.section;
    navItems.forEach(n => n.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    item.classList.add('active');
    document.getElementById(`section-${target}`)?.classList.add('active');
  });
});

const patInput        = document.getElementById('pat-input');
const btnTogglePat    = document.getElementById('btn-toggle-pat');
const btnSavePat      = document.getElementById('btn-save-pat');

const clientIdInput   = document.getElementById('client-id');
const btnSaveCreds    = document.getElementById('btn-save-credentials');

const btnConnect      = document.getElementById('btn-connect');
const btnDisconnect   = document.getElementById('btn-disconnect');
const accountConn     = document.getElementById('account-connected');
const accountDisconn  = document.getElementById('account-disconnected');
const optAvatar       = document.getElementById('opt-avatar');
const optUsername     = document.getElementById('opt-username');
const optUserlogin    = document.getElementById('opt-userlogin');

const optRepo             = document.getElementById('opt-repo');
const btnRefreshRepos     = document.getElementById('btn-refresh-repos');
const optBranch           = document.getElementById('opt-branch');
const optAutoSync         = document.getElementById('opt-auto-sync');
const optUpdateReadme     = document.getElementById('opt-update-readme');
const optAddHeader        = document.getElementById('opt-add-header');
const optNotifications    = document.getElementById('opt-notifications');
const pathTemplateRadios  = document.querySelectorAll('input[name="path-template"]');
const btnSaveSync         = document.getElementById('btn-save-sync');

const hTotal      = document.getElementById('h-total');
const hStreak     = document.getElementById('h-streak');
const hLast       = document.getElementById('h-last');
const historyList = document.getElementById('history-list');
const btnExport   = document.getElementById('btn-export');

const btnClearHistory = document.getElementById('btn-clear-history');
const btnResetAll     = document.getElementById('btn-reset-all');


async function init() {
  chrome.storage.local.get(['gh_client_id'], result => {
    if (result.gh_client_id) clientIdInput.value = result.gh_client_id;
  });

  await loadAccountSection();
  await loadSyncSettings();
  await loadHistory();
}


btnTogglePat.addEventListener('click', () => {
  patInput.type = patInput.type === 'password' ? 'text' : 'password';
});

btnSavePat.addEventListener('click', async () => {
  const token = patInput.value.trim();
  if (!token) {
    showToast('Please enter a Personal Access Token', 'error');
    return;
  }
  try {
    btnSavePat.disabled = true;
    btnSavePat.textContent = 'Verifying…';
    await savePersonalAccessToken(token);
    await loadAccountSection();
    patInput.value = '';
    showToast('Connected successfully!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btnSavePat.disabled = false;
    btnSavePat.textContent = 'Save & Connect';
  }
});

btnSaveCreds.addEventListener('click', () => {
  const id = clientIdInput.value.trim();
  if (!id) {
    showToast('Please enter a Client ID', 'error');
    return;
  }
  chrome.storage.local.set({ gh_client_id: id }, () => {
    showToast('Client ID saved', 'success');
  });
});

async function loadAccountSection() {
  const token = await getAuthToken();
  if (!token) {
    accountConn.classList.add('hidden');
    accountDisconn.classList.remove('hidden');
    return;
  }
  try {
    const user = await fetchUserProfile(token);
    optAvatar.src            = user.avatar_url;
    optUsername.textContent  = user.name || user.login;
    optUserlogin.textContent = `@${user.login}`;
    accountDisconn.classList.add('hidden');
    accountConn.classList.remove('hidden');
    await loadRepositories(token);
  } catch (_) {
    accountConn.classList.add('hidden');
    accountDisconn.classList.remove('hidden');
  }
}

btnConnect.addEventListener('click', async () => {
  try {
    btnConnect.disabled = true;
    btnConnect.textContent = 'Connecting…';
    chrome.runtime.sendMessage({ action: 'authenticate' }, async (res) => {
      if (res?.success) {
        await loadAccountSection();
        showToast('GitHub account connected!', 'success');
      } else {
        showToast(res?.error || 'Authentication failed', 'error');
      }
      btnConnect.disabled = false;
      btnConnect.textContent = 'Connect via Device Flow instead';
    });
  } catch (err) {
    showToast(err.message, 'error');
    btnConnect.disabled = false;
    btnConnect.textContent = 'Connect via Device Flow instead';
  }
});

btnDisconnect.addEventListener('click', async () => {
  if (!confirm('Disconnect your GitHub account?')) return;
  await signOut();
  accountConn.classList.add('hidden');
  accountDisconn.classList.remove('hidden');
  showToast('Disconnected', 'success');
});

async function loadRepositories(token) {
  try {
    optRepo.innerHTML = '<option value="">Loading…</option>';
    const repos = await fetchRepositories(token);
    const settings = await getSettings();
    optRepo.innerHTML = '<option value="">Select repository</option>';
    repos.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.full_name;
      opt.textContent = r.full_name;
      if (r.full_name === settings.repository) opt.selected = true;
      optRepo.appendChild(opt);
    });
  } catch (_) {
    optRepo.innerHTML = '<option value="">Failed to load</option>';
  }
}

async function loadSyncSettings() {
  const settings = await getSettings();
  if (settings.branch)                       optBranch.value          = settings.branch;
  if (settings.autoSync     !== undefined)   optAutoSync.checked      = settings.autoSync;
  if (settings.updateReadme !== undefined)   optUpdateReadme.checked  = settings.updateReadme;
  if (settings.addHeader    !== undefined)   optAddHeader.checked     = settings.addHeader;
  if (settings.notifications !== undefined)  optNotifications.checked = settings.notifications;
  if (settings.pathTemplate) {
    pathTemplateRadios.forEach(r => { r.checked = r.value === settings.pathTemplate; });
  }
}

btnRefreshRepos.addEventListener('click', async () => {
  const token = await getAuthToken();
  if (!token) { showToast('Not connected to GitHub', 'error'); return; }
  await loadRepositories(token);
});

btnSaveSync.addEventListener('click', async () => {
  const repository = optRepo.value;
  if (!repository) { showToast('Please select a repository', 'error'); return; }

  const pathTemplate = [...pathTemplateRadios].find(r => r.checked)?.value || 'difficulty';

  await saveSettings({
    repository,
    branch:        optBranch.value.trim() || 'main',
    autoSync:      optAutoSync.checked,
    updateReadme:  optUpdateReadme.checked,
    addHeader:     optAddHeader.checked,
    notifications: optNotifications.checked,
    pathTemplate,
  });
  showToast('Settings saved!', 'success');
});


async function loadHistory() {
  const stats = await getStats();
  hTotal.textContent  = stats.totalSynced || 0;
  hStreak.textContent = stats.streak || 0;
  hLast.textContent   = stats.lastSync ? formatDate(stats.lastSync) : '—';

  const history = (stats.history || []).slice().reverse();
  if (history.length === 0) {
    historyList.innerHTML = '<div class="empty-state">No solutions synced yet.</div>';
    return;
  }

  historyList.innerHTML = history.map(item => {
    const diff = (item.difficulty || '').toLowerCase();
    const date = item.timestamp ? formatDate(item.timestamp) : '';
    const id   = String(item.id || '').padStart(4, '0');
    return `
      <div class="history-item">
        <span class="history-id">${id}</span>
        <span class="history-title">
          <a href="https://leetcode.com/problems/${item.slug}/" target="_blank">${escapeHtml(item.title || item.slug)}</a>
        </span>
        <span class="diff-badge diff-${diff}">${item.difficulty || '?'}</span>
        <span class="history-lang">${item.language || ''}</span>
        <span class="history-date">${date}</span>
      </div>
    `;
  }).join('');
}

btnExport.addEventListener('click', async () => {
  const stats = await getStats();
  const json  = JSON.stringify(stats.history || [], null, 2);
  const blob  = new Blob([json], { type: 'application/json' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = 'leet2git-history.json';
  a.click();
  URL.revokeObjectURL(url);
});

btnClearHistory.addEventListener('click', async () => {
  if (!confirm('Clear all sync history and reset stats? This cannot be undone.')) return;
  await saveStats({});
  await loadHistory();
  showToast('History cleared', 'success');
});

btnResetAll.addEventListener('click', async () => {
  if (!confirm('Reset ALL Leet2Git data? This cannot be undone.')) return;
  await new Promise(resolve => chrome.storage.local.clear(resolve));
  showToast('All data cleared. Please reconfigure the extension.', 'success');
  setTimeout(() => location.reload(), 1500);
});

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let toastTimer;
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2800);
}

// ── Run ───────────────────────────────────────────────────────────────────────
init();
