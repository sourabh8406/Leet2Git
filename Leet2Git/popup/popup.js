import { getAuthToken, signOut } from '../utils/auth.js';
import { fetchUserProfile, fetchRepositories, createRepository } from '../utils/github.js';
import { getSettings, saveSettings, getStats } from '../utils/storage.js';

const viewAuth = document.getElementById('view-auth');
const viewMain = document.getElementById('view-main');
const btnAuth = document.getElementById('btn-auth');
const btnLogout = document.getElementById('btn-logout');
const btnSave = document.getElementById('btn-save');
const btnCreateRepo = document.getElementById('btn-create-repo');
const optionsLink = document.getElementById('options-link');

const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const userLogin = document.getElementById('user-login');
const repoSelect = document.getElementById('repo-select');
const branchInput = document.getElementById('branch-input');
const toggleAuto = document.getElementById('toggle-auto');

const statSynced = document.getElementById('stat-synced');
const statLast = document.getElementById('stat-last');
const statStreak = document.getElementById('stat-streak');
const statusBar = document.getElementById('status-bar');
const statusIcon = document.getElementById('status-icon');
const statusText = document.getElementById('status-text');

let currentToken = null;
let userProfile = null;
let repositories = [];

async function init() {
  currentToken = await getAuthToken();
  
  if (currentToken) {
    await loadAuthenticatedView();
  } else {
    showAuthView();
  }
}

function showAuthView() {
  viewAuth.classList.remove('hidden');
  viewMain.classList.add('hidden');
}

function showMainView() {
  viewAuth.classList.add('hidden');
  viewMain.classList.remove('hidden');
}

async function loadAuthenticatedView() {
  try {
    showStatus('Loading profile...', 'info');
    
    userProfile = await fetchUserProfile(currentToken);
    
    userAvatar.src = userProfile.avatar_url;
    userName.textContent = userProfile.name || userProfile.login;
    userLogin.textContent = `@${userProfile.login}`;
    
    await loadRepositories();
    
    const settings = await getSettings();
    if (settings.repository) {
      repoSelect.value = settings.repository;
    }
    if (settings.branch) {
      branchInput.value = settings.branch;
    }
    toggleAuto.checked = settings.autoSync !== false;
    
    const stats = await getStats();
    statSynced.textContent = stats.totalSynced || 0;
    statLast.textContent = stats.lastSync ? formatTimeAgo(stats.lastSync) : '—';
    statStreak.textContent = stats.streak || 0;
    
    showMainView();
    hideStatus();
  } catch (error) {
    console.error('Failed to load authenticated view:', error);
    showStatus('Failed to load profile. Try reconnecting.', 'error');
    signOut();
    showAuthView();
  }
}

async function loadRepositories() {
  try {
    repoSelect.innerHTML = '<option value="">Loading...</option>';
    repositories = await fetchRepositories(currentToken);
    
    repoSelect.innerHTML = '<option value="">Select a repository</option>';
    repositories.forEach(repo => {
      const option = document.createElement('option');
      option.value = repo.full_name;
      option.textContent = repo.full_name;
      repoSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load repositories:', error);
    repoSelect.innerHTML = '<option value="">Failed to load</option>';
    throw error;
  }
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function showStatus(message, type = 'info') {
  statusBar.className = `status-bar ${type}`;
  const icons = {
    success: '✓',
    error: '✗',
    info: 'ℹ'
  };
  statusIcon.textContent = icons[type] || icons.info;
  statusText.textContent = message;
  statusBar.classList.remove('hidden');
}

function hideStatus() {
  statusBar.classList.add('hidden');
}

btnAuth.addEventListener('click', async () => {
  try {
    btnAuth.disabled = true;
    btnAuth.textContent = 'Signing in...';
    
    chrome.runtime.sendMessage({ action: 'authenticate' }, async (response) => {
      if (response.success) {
        currentToken = response.token;
        await loadAuthenticatedView();
      } else {
        showStatus(response.error || 'Authentication failed', 'error');
        btnAuth.disabled = false;
        btnAuth.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>Sign in with GitHub';
      }
    });
  } catch (error) {
    console.error('Auth error:', error);
    showStatus('Authentication failed. Please try again.', 'error');
    btnAuth.disabled = false;
  }
});

btnLogout.addEventListener('click', async () => {
  await signOut();
  showAuthView();
  showStatus('Signed out successfully', 'success');
  setTimeout(hideStatus, 2000);
});

btnSave.addEventListener('click', async () => {
  try {
    const repository = repoSelect.value;
    const branch = branchInput.value.trim() || 'main';
    const autoSync = toggleAuto.checked;
    
    if (!repository) {
      showStatus('Please select a repository', 'error');
      return;
    }
    
    await saveSettings({ repository, branch, autoSync });
    showStatus('Settings saved successfully!', 'success');
    setTimeout(hideStatus, 2000);
  } catch (error) {
    console.error('Failed to save settings:', error);
    showStatus('Failed to save settings', 'error');
  }
});

btnCreateRepo.addEventListener('click', async () => {
  try {
    const repoName = prompt('Enter new repository name:', 'leetcode-solutions');
    if (!repoName) return;
    
    showStatus('Creating repository...', 'info');
    btnCreateRepo.disabled = true;
    
    const newRepo = await createRepository(currentToken, repoName, 'My LeetCode solutions', false);
    
    repositories.push(newRepo);
    const option = document.createElement('option');
    option.value = newRepo.full_name;
    option.textContent = newRepo.full_name;
    repoSelect.appendChild(option);
    repoSelect.value = newRepo.full_name;
    
    showStatus('Repository created successfully!', 'success');
    setTimeout(hideStatus, 2000);
  } catch (error) {
    console.error('Failed to create repository:', error);
    showStatus(error.message || 'Failed to create repository', 'error');
  } finally {
    btnCreateRepo.disabled = false;
  }
});

optionsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

init();
