const TOKEN_KEY = 'leet2git_github_token';

export async function authenticate() {
  const existing = await getAuthToken();
  if (existing) return existing;
  throw new Error('Please open Options → GitHub Setup and paste your GitHub Personal Access Token.');
}

export async function savePersonalAccessToken(token) {
  const clean = token.trim();
  if (!clean) {
    throw new Error('Token cannot be empty.');
  }
  if (!clean.startsWith('ghp_') && !clean.startsWith('github_pat_') && !clean.startsWith('gho_')) {
    throw new Error('Invalid token. It should start with ghp_ or github_pat_');
  }

  const res = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${clean}`,
      'Accept': 'application/vnd.github+json',
    },
  });

  if (res.status === 401) throw new Error('Token is invalid or expired. Please check and try again.');
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

  await storeToken(clean);
  return clean;
}

export async function getAuthToken() {
  return new Promise(resolve => {
    chrome.storage.local.get([TOKEN_KEY], result => {
      resolve(result[TOKEN_KEY] || null);
    });
  });
}

export async function signOut() {
  return new Promise(resolve => {
    chrome.storage.local.remove([TOKEN_KEY], resolve);
  });
}

function storeToken(token) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [TOKEN_KEY]: token }, resolve);
  });
}
