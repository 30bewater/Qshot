import { state, STORAGE_KEYS } from "./state.js";
import { getSelectedSites } from "./utils.js";
import {
  setGlobalStatus,
  updateSendBtnState,
  bindComposerCollapseEvents,
  handleFrameMessage,
} from "./status.js";
import { loadSites } from "./sites-loader.js";
import { loadBuiltinSites } from "../../shared/site-registry.js";
import { renderCards } from "./cards-render.js";
import { maybeAutoSendFromUrl } from "./send.js";
import {
  applyHistoryRestoreFromUrl,
} from "./history.js";
import { bindPromptPickerEvents } from "./prompts.js";
import { bindFileUploadEvents } from "./file-upload.js";
import { UI_PREFS_STORAGE_KEY, CUSTOM_SITES_STORAGE_KEY } from "../../shared/storage-keys.js";
import { applyDarkModeToDoc } from "../../shared/theme.js";
import { ensureIframeSessionRules } from "./iframe-session-rules.js";
import {
  cacheElements,
  hydrateQuickActionIcons,
  hydrateQueryFromUrl,
  restorePreferences,
} from "./main-preferences.js";
import { bindComparePageEvents } from "./main-bind-events.js";

export function initComparePage() {
  const { applyDomI18n } = window.__QSHOT_I18N__ || {};
  state._applyDomI18n = applyDomI18n;

  document.addEventListener("DOMContentLoaded", start);
  window.addEventListener("message", handleFrameMessage);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[UI_PREFS_STORAGE_KEY]) return;
    const uiPrefs = changes[UI_PREFS_STORAGE_KEY].newValue || {};
    applyDarkModeToDoc(uiPrefs.darkMode);
    const lm = uiPrefs.localeMode;
    window.__QSHOT_I18N__?.setLocaleMode?.(lm === "zh" || lm === "en" ? lm : "auto");
    state._applyDomI18n?.(document);
  });
}

async function start() {
  try {
    const allStorageKeys = [
      UI_PREFS_STORAGE_KEY,
      STORAGE_KEYS.cardSizeLevel,
      STORAGE_KEYS.layoutRows,
      STORAGE_KEYS.layoutMode,
      STORAGE_KEYS.searchHistory,
      STORAGE_KEYS.promptGroups,
      CUSTOM_SITES_STORAGE_KEY,
    ];
    const [stored] = await Promise.all([
      chrome.storage.local.get(allStorageKeys),
      loadBuiltinSites({ fallbackEmpty: true }),
      ensureIframeSessionRules(),
    ]);

    const uiPrefs = stored[UI_PREFS_STORAGE_KEY] || {};
    const lm = uiPrefs.localeMode;
    window.__QSHOT_I18N__?.setLocaleMode?.(lm === "zh" || lm === "en" ? lm : "auto");
    applyDarkModeToDoc(uiPrefs.darkMode);
    state._applyDomI18n?.(document);
    cacheElements();
    hydrateQuickActionIcons();
    bindComparePageEvents();
    bindFileUploadEvents();
    hydrateQueryFromUrl();
    updateSendBtnState();
    await restorePreferences(stored);
    bindPromptPickerEvents();
    bindComposerCollapseEvents();
    await loadSites(stored[CUSTOM_SITES_STORAGE_KEY]);
    const restoredEntry = applyHistoryRestoreFromUrl();
    renderCards();
    setGlobalStatus(restoredEntry
      ? `已复原 "${restoredEntry.query || "历史记录"}" 的 ${getSelectedSites().length} 张卡片。`
      : `已加载 ${getSelectedSites().length} 个站点。`);
    await maybeAutoSendFromUrl();
  } catch (error) {
    setGlobalStatus(`初始化失败：${error.message}`, true);
  }
}
