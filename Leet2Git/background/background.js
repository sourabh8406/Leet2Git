import { getAuthToken, signOut } from '../utils/auth.js';
import { pushSolutionToGitHub } from '../utils/github.js';
import { getSettings, saveStats, getStats } from '../utils/storage.js';


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(err => sendResponse({ success: false, error: err.message }));
  return true; 
});

async function handleMessage(message, sender) {
  switch (message.action) {
    case 'authenticate':
      return handleAuthenticate();

    case 'signOut':
      await signOut();
      return { success: true };

    case 'submissionAccepted':
      return handleSubmission(message.data);

    case 'getStatus':
      return handleGetStatus();

    default:
      return { success: false, error: `Unknown action: ${message.action}` };
  }
}


async function handleAuthenticate() {
  try {
    const token = await getAuthToken();
    if (token) return { success: true, token };
    return {
      success: false,
      error: 'No token found. Please open Options → GitHub Setup and paste your Personal Access Token.'
    };
  } catch (error) {
    console.error('[Leet2Git] Authentication failed:', error);
    return { success: false, error: error.message };
  }
}


async function handleSubmission(data) {
  try {
    const token = await getAuthToken();
    if (!token) {
      console.warn('[Leet2Git] No auth token — skipping sync');
      return { success: false, error: 'Not authenticated' };
    }

    const settings = await getSettings();
    if (!settings.repository) {
      console.warn('[Leet2Git] No repository configured — skipping sync');
      showNotification(
        'Leet2Git: Setup required',
        'Open the extension and choose a GitHub repository to sync to.'
      );
      return { success: false, error: 'No repository configured' };
    }

    if (!settings.branch) {
      settings.branch = 'main';
    }

    if (settings.autoSync === false) {
      return { success: false, error: 'Auto-sync is disabled' };
    }

    console.log('[Leet2Git] Syncing solution:', data.titleSlug);

    const filePath = buildFilePath(data);

    const fileContent = buildFileContent(data);

    const result = await pushSolutionToGitHub(token, {
      repo: settings.repository,
      branch: settings.branch || 'main',
      filePath,
      content: fileContent,
      commitMessage: buildCommitMessage(data),
    });

    if (!result?.sha) {
      throw new Error('GitHub did not return a commit SHA. Check repository access and branch permissions.');
    }

    await updateStats(data);

    showNotification(
      'Leet2Git: Solution synced ✓',
      `${data.title} pushed to ${settings.repository}`
    );

    return { success: true, filePath, sha: result.sha };
  } catch (error) {
    console.error('[Leet2Git] Sync failed:', error);
    showNotification('Leet2Git: Sync failed', error.message);
    return { success: false, error: error.message };
  }
}


async function handleGetStatus() {
  const token = await getAuthToken();
  const settings = await getSettings();
  const stats = await getStats();
  return {
    success: true,
    authenticated: !!token,
    configured: !!(settings.repository),
    autoSync: settings.autoSync !== false,
    stats,
  };
}

function buildFilePath(data) {
  const id = String(data.questionId).padStart(4, '0');
  const slug = data.titleSlug;
  const ext = languageExtension(data.language);
  const difficulty = (data.difficulty || 'unknown').toLowerCase();
  const dir = `${difficulty}/${id}-${slug}`;
  return `${dir}/${id}-${slug}.${ext}`;
}

function buildFileContent(data) {
  const commentStyle = getCommentStyle(data.language);
  const header = buildHeader(data, commentStyle);
  return `${header}\n\n${data.code}\n`;
}

function buildHeader(data, { single, blockOpen, blockClose }) {
  const lines = [
    `Problem   : ${data.questionId}. ${data.title}`,
    `Difficulty: ${data.difficulty}`,
    `URL       : https://leetcode.com/problems/${data.titleSlug}/`,
    `Language  : ${data.language}`,
    `Runtime   : ${data.runtime || 'N/A'}`,
    `Memory    : ${data.memory || 'N/A'}`,
    `Synced    : ${new Date().toISOString().split('T')[0]}`,
  ];

  if (blockOpen) {
    return [blockOpen, ...lines.map(l => ` * ${l}`), ` ${blockClose}`].join('\n');
  }
  return lines.map(l => `${single} ${l}`).join('\n');
}

function getCommentStyle(language) {
  const block = ['javascript', 'typescript', 'java', 'c', 'cpp', 'csharp', 'kotlin', 'swift', 'scala'];
  const hash  = ['python', 'python3', 'ruby', 'rust', 'bash', 'kotlin'];
  const sql   = ['mysql', 'mssql', 'oraclesql'];

  if (block.includes(language)) return { blockOpen: '/*', blockClose: '*/' };
  if (sql.includes(language))   return { single: '--' };
  return { single: '#' };
}

function buildCommitMessage(data) {
  const id = String(data.questionId).padStart(4, '0');
  return `Add ${id}. ${data.title} [${data.difficulty}] (${data.language})`;
}

function languageExtension(lang) {
  const map = {
    python: 'py', python3: 'py',
    javascript: 'js', typescript: 'ts',
    java: 'java', cpp: 'cpp', c: 'c',
    csharp: 'cs', ruby: 'rb', swift: 'swift',
    golang: 'go', scala: 'scala', kotlin: 'kt',
    rust: 'rs', php: 'php', bash: 'sh',
    mysql: 'sql', mssql: 'sql', oraclesql: 'sql',
  };
  return map[lang] || 'txt';
}

async function updateStats(data) {
  const stats = await getStats();
  const today = new Date().toDateString();

  const newStats = {
    totalSynced: (stats.totalSynced || 0) + 1,
    lastSync: Date.now(),
    lastSyncDate: today,
    streak: today === stats.lastSyncDate
      ? stats.streak || 1
      : isConsecutiveDay(stats.lastSyncDate)
        ? (stats.streak || 0) + 1
        : 1,
    history: [...(stats.history || []), {
      id: data.questionId,
      title: data.title,
      slug: data.titleSlug,
      difficulty: data.difficulty,
      language: data.language,
      timestamp: Date.now(),
    }].slice(-100), 
  };

  await saveStats(newStats);
}

function isConsecutiveDay(lastDateStr) {
  if (!lastDateStr) return false;
  const last = new Date(lastDateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return last.toDateString() === yesterday.toDateString();
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title,
    message,
  });
}


chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('../options/options.html') });
  }
});
