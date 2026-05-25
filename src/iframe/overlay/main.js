import { UI_PREFS_STORAGE_KEY, CUSTOM_SITES_STORAGE_KEY, SEARCH_GROUPS_STORAGE_KEY, SEARCH_HISTORY_STORAGE_KEY, PROMPT_GROUPS_STORAGE_KEY, QUICK_ACCESS_SITES_KEY } from "../../shared/storage-keys.js";
import {
  state,
  refreshGroups,
  refreshAllSites,
  refreshHistory,
  refreshPromptGroups,
  refreshUiPrefs,
  refreshQuickAccessSites,
} from "./state.js";
import {
  FRAME_TOGGLE_MESSAGE,
  MAIN_HOTKEY_FIRE,
  MAIN_HOTKEY_ESC,
  MAIN_HOTKEY_CONFIG,
} from "./constants.js";
import { renderGroupsIfOpen, hideGroupTooltip, exitGroupPickMode, exitSitePickMode } from "./groups-panel.js";
import { renderHistoryIfOpen } from "./history-panel.js";
import { renderPromptPickerIfOpen } from "./prompts-panel.js";
import { closeOverlay, mountOverlay, applyUiPrefs } from "./overlay-mount.js";

export function initQshotOverlay() {
  if (window.__QSHOT_OVERLAY_INSTALLED__) return;
  window.__QSHOT_OVERLAY_INSTALLED__ = true;

  state.closeOverlay = closeOverlay;

  const isTopFrame = (function detectTop() {
    try {
      return window.top === window;
    } catch (_e) {
      return false;
    }
  })();

  refreshUiPrefs().then(syncShortcutToMainWorld).catch(() => {});

  window.addEventListener("message", (event) => {
    if (event.source !== window && !isTopFrame) return;
    const data = event.data;
    if (!data) return;

    if (data.type === MAIN_HOTKEY_FIRE) {
      if (isTopFrame) {
        toggleOverlay();
      } else {
        try {
          window.top.postMessage({ type: FRAME_TOGGLE_MESSAGE }, "*");
        } catch (_err) {
          /* ignored */
        }
      }
      return;
    }

    if (data.type === MAIN_HOTKEY_ESC) {
      if (isTopFrame && state.isOpen) {
        closeOverlay();
      } else if (!isTopFrame) {
        try {
          window.top.postMessage({ type: MAIN_HOTKEY_ESC }, "*");
        } catch (_e) {}
      }
      return;
    }

    if (data.type === FRAME_TOGGLE_MESSAGE && isTopFrame) {
      toggleOverlay();
    }
  });

  window.addEventListener("keydown", handleGlobalKeydown, true);
  document.addEventListener("keydown", handleGlobalKeydown, true);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "TOGGLE_SEARCH_OVERLAY") return false;
    if (!isTopFrame) return false;
    toggleOverlay().finally(() => sendResponse && sendResponse({ ok: true }));
    return true;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[UI_PREFS_STORAGE_KEY]) {
      refreshUiPrefs().then(() => {
        syncShortcutToMainWorld();
        if (state.isOpen) {
          applyUiPrefs();
          renderHistoryIfOpen();
          renderPromptPickerIfOpen();
        }
      });
    }
    if (!state.isOpen) return;
    if (changes[CUSTOM_SITES_STORAGE_KEY]) {
      refreshAllSites().then(renderGroupsIfOpen);
    }
    if (changes[SEARCH_GROUPS_STORAGE_KEY]) {
      refreshGroups().then(renderGroupsIfOpen);
    }
    if (changes[SEARCH_HISTORY_STORAGE_KEY]) {
      refreshHistory().then(renderHistoryIfOpen);
    }
    if (changes[PROMPT_GROUPS_STORAGE_KEY]) {
      refreshPromptGroups().then(renderPromptPickerIfOpen);
    }
    if (changes[QUICK_ACCESS_SITES_KEY]) {
      refreshQuickAccessSites();
    }
  });

  function handleGlobalKeydown(event) {
    if (!isTopFrame || !state.isOpen) return;
    if (event.key === "Escape" && state.isGroupPickMode) {
      event.preventDefault();
      event.stopPropagation();
      exitGroupPickMode();
      return;
    }
    if (event.key === "Escape" && state.isSitePickMode) {
      event.preventDefault();
      event.stopPropagation();
      exitSitePickMode();
      return;
    }
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeOverlay();
  }

  async function toggleOverlay() {
    if (state.isOpen) {
      closeOverlay();
    } else {
      await openOverlay();
    }
  }

  async function openOverlay() {
    if (state.isOpen || !isTopFrame) return;
    await Promise.all([
      refreshGroups(),
      refreshAllSites(),
      refreshHistory(),
      refreshPromptGroups(),
      refreshUiPrefs(),
      refreshQuickAccessSites(),
    ]);
    if (!state.activePromptGroupId) {
      state.activePromptGroupId = state.promptGroups[0]?.id || null;
    }
    mountOverlay();
    state.isOpen = true;
    try {
      chrome.runtime.sendMessage({ type: "WARMUP_AI_SITES" }).catch(() => {});
    } catch (_err) {
      /* ignored */
    }
  }

  function syncShortcutToMainWorld() {
    try {
      window.postMessage(
        {
          type: MAIN_HOTKEY_CONFIG,
          enabled: state.uiPrefs.overlayShortcutEnabled !== false,
          shortcut: state.uiPrefs.overlayShortcut,
        },
        window.location.origin
      );
    } catch (_err) {
      /* ignored */
    }
  }
}
