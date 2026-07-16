
(function () {
  'use strict';

  const processed = new Set();

  function isAcceptedSubmission(payload, url = '') {
    if (payload?.data?.submissionDetails) {
      return payload.data.submissionDetails.statusCode === 10;
    }

    return (
      (payload?.state === 'SUCCESS' || payload?.status === 10) &&
      (payload?.status_msg === 'Accepted' || payload?.status === 10)
    );
  }

  function normalizeSubmissionPayload(payload, url = '') {
    if (payload?.data?.submissionDetails) {
      const detail = payload.data.submissionDetails;
      return {
        submissionId: String(detail.id),
        questionId: detail.question?.questionFrontendId,
        title: detail.question?.title,
        titleSlug: detail.question?.titleSlug,
        difficulty: detail.question?.difficulty,
        language: detail.lang?.verboseName || detail.lang?.name,
        code: detail.code,
        runtime: detail.runtimeDisplay,
        memory: detail.memoryDisplay,
      };
    }

    const idMatch = url.match(/detail\/(\d+)\/check/);
    return {
      submissionId: idMatch ? idMatch[1] : String(Date.now()),
      questionId: payload?.question_id,
      title: payload?.question__title,
      titleSlug: payload?.question__title_slug,
      difficulty: payload?.difficulty,
      language: payload?.lang,
      code: payload?.code,
      runtime: payload?.status_runtime,
      memory: payload?.status_memory,
    };
  }

  const _fetch = window.fetch.bind(window);
  window.fetch = async function (...args) {
    const response = await _fetch(...args);
    try {
      const url = (typeof args[0] === 'string' ? args[0] : args[0]?.url) || '';
      // Debug: log every leetcode URL so we know what to intercept
      if (url.includes('leetcode.com')) {
        console.log('[Leet2Git] fetch:', url);
      }
      if (isRelevantUrl(url)) {
        response.clone().json()
          .then(data => inspect(data, url))
          .catch(() => {});
      }
    } catch (_) {}
    return response;
  };

  const _XHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new _XHR();
    let capturedUrl = '';
    const _open = xhr.open.bind(xhr);
    xhr.open = function (method, url, ...rest) {
      capturedUrl = url;
      return _open(method, url, ...rest);
    };
    xhr.addEventListener('load', () => {
      if (capturedUrl.includes('leetcode.com')) {
        console.log('[Leet2Git] XHR:', capturedUrl);
      }
      if (!isRelevantUrl(capturedUrl)) return;
      try { inspect(JSON.parse(xhr.responseText), capturedUrl); } catch (_) {}
    });
    return xhr;
  }
  PatchedXHR.prototype = _XHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  function isRelevantUrl(url) {
    return (
      /leetcode\.com\/graphql/.test(url) ||
      /leetcode\.com\/submissions\/detail\/\d+\/check/.test(url) ||
      /leetcode\.com\/problems\/[^/]+\/submit\//.test(url)
    );
  }

  const _fetchDebug = window.fetch.bind(window);
  const _origFetch  = window.fetch;
  window._leet2gitLogUrls = true; 

  function inspect(data, url) {
    if (data?.data?.submissionDetails) {
      if (isAcceptedSubmission(data, url)) {
        processAccepted(normalizeSubmissionPayload(data, url));
      }
      return;
    }

    const submitResult = data?.data?.submitCode;
    if (submitResult) {
      return;
    }

    if (isAcceptedSubmission(data, url)) {
      processAccepted({
        ...normalizeSubmissionPayload(data, url),
        title: data.question__title || extractTitleFromPage(),
        titleSlug: data.question__title_slug || extractSlugFromUrl(),
        difficulty: data.difficulty || extractDifficultyFromPage(),
      });
    }
  }

  function processAccepted(payload) {
    if (!payload.submissionId || processed.has(payload.submissionId)) return;
    if (!payload.code) payload.code = extractCodeFromEditor();
    if (!payload.code) {
      console.warn('[Leet2Git] Could not extract code — skipping');
      return;
    }

    processed.add(payload.submissionId);
    console.log('[Leet2Git] Accepted:', payload.titleSlug, '| lang:', payload.language);

    chrome.runtime.sendMessage({ action: 'submissionAccepted', data: payload }, (res) => {
      if (chrome.runtime.lastError) {
        console.warn('[Leet2Git]', chrome.runtime.lastError.message);
        return;
      }
      if (res?.success) {
        showToast('Leet2Git: Synced to GitHub ✓');
      } else {
        showToast(`Leet2Git: ${res?.error || 'Sync failed'}`, true);
        console.warn('[Leet2Git] Sync failed:', res?.error);
      }
    });
  }

  let lastSlug = '';

  const observer = new MutationObserver(() => {
    const slug = extractSlugFromUrl();

    if (slug !== lastSlug) {
      lastSlug = slug;
      processed.clear();
    }

    const resultEl = document.querySelector([
      '[data-e2e-locator="submission-result"]',
      '.text-green-s',
      '[class*="text-green"]',
      '.accept_v2__2Vy4',      
    ].join(','));

    if (!resultEl) return;
    if (!resultEl.textContent.trim().toLowerCase().includes('accepted')) return;

    const key = `dom-${slug}-${resultEl.textContent.trim()}`;
    if (processed.has(key)) return;
    processed.add(key);

    setTimeout(() => {
      const code = extractCodeFromEditor();
      if (!code) return;
      processAccepted({
        submissionId: key,
        questionId:   extractQuestionIdFromPage(),
        title:        extractTitleFromPage(),
        titleSlug:    slug,
        difficulty:   extractDifficultyFromPage(),
        language:     extractLanguageFromPage(),
        code,
        runtime:      extractRuntimeFromPage(),
        memory:       extractMemoryFromPage(),
      });
    }, 1200);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  function extractSlugFromUrl() {
    const m = window.location.pathname.match(/\/problems\/([^/?#]+)/);
    return m ? m[1] : 'unknown';
  }

  function extractTitleFromPage() {
    const selectors = [
      '[data-cy="question-title"]',
      'a[href*="/problems/"] .mr-2',
      '.text-title-large',
      'title',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent) {
        return el.textContent.trim().replace(/^\d+\.\s*/, '').split('|')[0].trim();
      }
    }
    return slugToTitle(extractSlugFromUrl());
  }

  function extractQuestionIdFromPage() {
    const title = extractTitleFromPage();
    const el = document.querySelector('[data-cy="question-title"]') ||
               document.querySelector('.text-title-large');
    if (el) {
      const m = el.textContent.match(/^(\d+)\./);
      if (m) return m[1];
    }
    return '0';
  }

  function extractDifficultyFromPage() {
    const selectors = [
      '.text-difficulty-easy', '.text-difficulty-medium', '.text-difficulty-hard',
      '[class*="difficulty"]', '[diff]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const t = el.textContent.toLowerCase();
        if (t.includes('easy'))   return 'Easy';
        if (t.includes('medium')) return 'Medium';
        if (t.includes('hard'))   return 'Hard';
      }
    }
    return 'Unknown';
  }

  function extractLanguageFromPage() {
    const selectors = [
      'button[id*="headlessui-listbox-button"]',
      '.ant-select-selection-item',
      '[data-cy="lang-select"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent) return normalizeLang(el.textContent.trim());
    }
    return 'unknown';
  }

  function extractRuntimeFromPage() {
    const els = document.querySelectorAll('.font-semibold, [class*="runtime"]');
    for (const el of els) {
      if (/\d+\s*ms/.test(el.textContent)) return el.textContent.trim();
    }
    return 'N/A';
  }

  function extractMemoryFromPage() {
    const els = document.querySelectorAll('.font-semibold, [class*="memory"]');
    for (const el of els) {
      if (/\d+(\.\d+)?\s*MB/.test(el.textContent)) return el.textContent.trim();
    }
    return 'N/A';
  }

  function extractCodeFromEditor() {
    if (window.monaco?.editor) {
      const editors = window.monaco.editor.getEditors();
      if (editors.length > 0) return editors[0].getValue();
    }
    const cm = document.querySelector('.CodeMirror');
    if (cm?.CodeMirror) return cm.CodeMirror.getValue();
    return '';
  }

  function slugToTitle(slug) {
    return slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  }

  function normalizeLang(lang) {
    const map = {
      'python3':'python3','python':'python','c++':'cpp','c':'c',
      'java':'java','javascript':'javascript','typescript':'typescript',
      'c#':'csharp','ruby':'ruby','swift':'swift','kotlin':'kotlin',
      'go':'golang','golang':'golang','rust':'rust','scala':'scala',
      'php':'php','bash':'bash','mysql':'mysql',
    };
    return map[lang.toLowerCase()] || lang.toLowerCase();
  }

  function showToast(message, isError = false) {
    document.getElementById('leet2git-toast')?.remove();

    if (!document.getElementById('leet2git-styles')) {
      const s = document.createElement('style');
      s.id = 'leet2git-styles';
      s.textContent = `
        @keyframes lg-in  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lg-out { from{opacity:1} to{opacity:0} }
        #leet2git-toast {
          position:fixed; bottom:24px; right:24px; z-index:99999;
          background:#161b22; color:#e6edf3;
          border:1px solid ${isError ? '#f85149' : '#FFA116'};
          border-radius:8px; padding:10px 16px;
          font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          font-size:13px; font-weight:500;
          box-shadow:0 4px 20px rgba(0,0,0,.5);
          display:flex; align-items:center; gap:8px;
          animation:lg-in .25s ease;
        }
      `;
      document.head.appendChild(s);
    }

    const t = document.createElement('div');
    t.id = 'leet2git-toast';
    t.innerHTML = `<span style="color:${isError ? '#f85149' : '#FFA116'};font-size:16px">${isError ? '✗' : '✓'}</span><span>${message}</span>`;
    document.body.appendChild(t);

    setTimeout(() => {
      t.style.animation = 'lg-out .3s ease forwards';
      setTimeout(() => t.remove(), 300);
    }, 3500);
  }

  console.log('[Leet2Git] Content script loaded on', window.location.hostname);

})();
