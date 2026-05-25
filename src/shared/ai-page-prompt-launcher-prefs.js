export function normalizeAiPagePromptLauncherSites(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  Object.keys(raw).forEach((siteId) => {
    if (typeof raw[siteId] === "boolean") {
      out[siteId] = raw[siteId];
    }
  });
  return out;
}

export function readAiPagePromptLauncherPrefs(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    showAiPagePromptLauncher: source.showAiPagePromptLauncher !== false,
    aiPagePromptLauncherSites: normalizeAiPagePromptLauncherSites(source.aiPagePromptLauncherSites),
  };
}

export function isAiPagePromptLauncherEnabledForSite(uiPrefs, siteId) {
  const prefs = readAiPagePromptLauncherPrefs(uiPrefs);
  if (!prefs.showAiPagePromptLauncher) return false;
  if (!siteId) return true;
  return prefs.aiPagePromptLauncherSites[siteId] !== false;
}
