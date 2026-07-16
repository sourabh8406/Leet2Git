
const GITHUB_API = 'https://api.github.com';

async function ghFetch(token, path, options = {}) {
  const url = path.startsWith('http') ? path : `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `GitHub API error: ${res.status}`;
    try {
      const body = await res.json();
      message = body.message || message;
    } catch (_) {}
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function fetchUserProfile(token) {
  return ghFetch(token, '/user');
}

export async function fetchRepositories(token) {
  const repos = [];
  let page = 1;

  while (page <= 10) {
    const batch = await ghFetch(
      token,
      `/user/repos?affiliation=owner,collaborator&sort=pushed&per_page=100&page=${page}`
    );
    if (!batch || batch.length === 0) break;
    repos.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  return repos.filter(r => r.permissions?.push !== false);
}

export async function createRepository(token, name, description = '', isPrivate = false) {
  return ghFetch(token, '/user/repos', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      private: isPrivate,
      auto_init: true,
    }),
  });
}

export async function pushSolutionToGitHub(token, { repo, branch, filePath, content, commitMessage }) {
  // Check if file already exists (to get its SHA for update)
  let existingSha = null;
  try {
    const existing = await ghFetch(token, `/repos/${repo}/contents/${filePath}?ref=${branch}`);
    existingSha = existing?.sha || null;
  } catch (err) {
    if (!err.message.includes('404') && !err.message.includes('Not Found')) {
      throw err;
    }
  }

  await ensureBranch(token, repo, branch);

  const encoded = btoa(unescape(encodeURIComponent(content)));

  const body = {
    message: commitMessage,
    content: encoded,
    branch,
  };

  if (existingSha) {
    body.sha = existingSha; 
  }

  const result = await ghFetch(token, `/repos/${repo}/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

  return {
    sha: result?.content?.sha,
    commit: result?.commit?.html_url,
    isUpdate: !!existingSha,
  };
}

async function ensureBranch(token, repo, branch) {
  try {
    await ghFetch(token, `/repos/${repo}/branches/${branch}`);
  } catch (_) {
    const repoInfo = await ghFetch(token, `/repos/${repo}`);
    const defaultBranch = repoInfo.default_branch || 'main';

    const ref = await ghFetch(token, `/repos/${repo}/git/ref/heads/${defaultBranch}`);
    const sha = ref?.object?.sha;
    if (!sha) throw new Error(`Could not resolve SHA for branch: ${defaultBranch}`);

    await ghFetch(token, `/repos/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
    });
  }
}

export async function fetchReadme(token, repo, branch = 'main') {
  try {
    const data = await ghFetch(token, `/repos/${repo}/contents/README.md?ref=${branch}`);
    return {
      content: decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))),
      sha: data.sha,
    };
  } catch (_) {
    return null;
  }
}

export async function updateReadmeIndex(token, { repo, branch, solutions }) {
  const rows = solutions
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map(s => {
      const id   = String(s.id).padStart(4, '0');
      const diff = diffBadge(s.difficulty);
      return `| ${id} | [${s.title}](https://leetcode.com/problems/${s.slug}/) | ${diff} | \`${s.language}\` |`;
    })
    .join('\n');

  const content = [
    '# LeetCode Solutions',
    '',
    'Auto-synced by [Leet2Git](https://github.com/your-username/leet2git) Chrome Extension.',
    '',
    `> Last updated: ${new Date().toISOString().split('T')[0]} — **${solutions.length}** solutions`,
    '',
    '| # | Problem | Difficulty | Language |',
    '|---|---------|------------|----------|',
    rows,
    '',
  ].join('\n');

  const existing = await fetchReadme(token, repo, branch);
  const encoded  = btoa(unescape(encodeURIComponent(content)));

  const body = {
    message: `Update README index (${solutions.length} solutions)`,
    content: encoded,
    branch,
  };
  if (existing?.sha) body.sha = existing.sha;

  return ghFetch(token, `/repos/${repo}/contents/README.md`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

function diffBadge(difficulty) {
  const map = {
    Easy:   '![Easy](https://img.shields.io/badge/-Easy-00b8a3?style=flat)',
    Medium: '![Medium](https://img.shields.io/badge/-Medium-ffc01e?style=flat)',
    Hard:   '![Hard](https://img.shields.io/badge/-Hard-ff375f?style=flat)',
  };
  return map[difficulty] || difficulty;
}
