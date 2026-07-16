
const SETTINGS_KEY = 'leet2git_settings';
const STATS_KEY    = 'leet2git_stats';

export async function getSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get([SETTINGS_KEY], result => {
      resolve(result[SETTINGS_KEY] || {});
    });
  });
}

export async function saveSettings(settings) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [SETTINGS_KEY]: settings }, resolve);
  });
}

export async function updateSettings(partial) {
  const current = await getSettings();
  return saveSettings({ ...current, ...partial });
}

export async function getStats() {
  return new Promise(resolve => {
    chrome.storage.local.get([STATS_KEY], result => {
      resolve(result[STATS_KEY] || {});
    });
  });
}

export async function saveStats(stats) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [STATS_KEY]: stats }, resolve);
  });
}

export async function incrementSyncCount() {
  const stats = await getStats();
  stats.totalSynced = (stats.totalSynced || 0) + 1;
  stats.lastSync = Date.now();
  await saveStats(stats);
}
