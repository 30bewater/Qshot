import {
  UI_PREFS_STORAGE_KEY,
  SEARCH_GROUPS_STORAGE_KEY,
  QUICK_ACCESS_SITES_KEY,
  SELECTION_CONTEXT_GROUPS_STORAGE_KEY,
} from "../shared/storage-keys.js";
import { ensureInitialStateDefaults } from "./initial-state.js";
import { syncCommandShortcut } from "./shortcut-sync.js";
import { openComparePage, runSearchGroup, runSelectionContextGroup, openSiteTabAndSend } from "./tabs.js";
import { loadEnabledSites } from "./sites.js";
import { warmupAiSites } from "./warmup.js";
import { rebuildContextMenus } from "./context-menu.js";
import { setupKeepaliveAlarm } from "./keepalive.js";

const SETTINGS_PAGE_URL = chrome.runtime.getURL("settings/settings.html");
const POPUP_PAGE_URL = chrome.runtime.getURL("popup/popup.html");

/**
 * 受限页无法注入浮层时，唤起与工具栏一致的「搜索弹窗」UI。
 * chrome.action.openPopup 在 Chromium 127+ 才对普通安装可用；更早版本或部分环境会失败，
 * 需用独立 popup 窗口 / 新标签兜底（否则快捷键看起来「没反应」）。
 */
async function openExtensionComposerUi(windowId) {
  if (typeof chrome.action?.openPopup === "function") {
    try {
      const opts = typeof windowId === "number" ? { windowId } : undefined;
      await chrome.action.openPopup(opts);
      return;
    } catch (_e) {
      /* 继续兜底 */
    }
  }
  try {
    await chrome.windows.create({
      url: POPUP_PAGE_URL,
      type: "popup",
      width: 440,
      height: 680,
      focused: true,
    });
  } catch (_e) {
    try {
      await chrome.tabs.create({ url: POPUP_PAGE_URL, active: true });
    } catch (_e2) {
      /* 无法拉起任何 UI */
    }
  }
}

setupKeepaliveAlarm();

chrome.runtime.onInstalled.addListener(async () => {
  console.log("Qshot - 子弹搜索 已安装");
  await ensureInitialStateDefaults();
  await syncCommandShortcut();
  await rebuildContextMenus();
});

// 当用户在设置里修改快捷键时，同步更新 manifest command 的绑定，
// 这样内置页面的自动弹窗也会跟着用户的设置走。
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes[UI_PREFS_STORAGE_KEY]) {
    const newPrefs = changes[UI_PREFS_STORAGE_KEY].newValue;
    if (newPrefs) {
      syncCommandShortcut(newPrefs).catch(() => {});
      rebuildContextMenus().catch(() => {});
    }
  }

  if (
    changes[SEARCH_GROUPS_STORAGE_KEY] ||
    changes[QUICK_ACCESS_SITES_KEY] ||
    changes[SELECTION_CONTEXT_GROUPS_STORAGE_KEY]
  ) {
    rebuildContextMenus().catch(() => {});
  }
});

// 当用户在任意页面触发 manifest command 时：
// - 普通网页 → 向内容脚本发消息切换浮层
// - 受限页（chrome://、扩展自有页等）→ 打开工具栏弹窗；失败则用独立窗口/标签打开同款 popup
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-overlay") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (!tab) return;

  const url = tab.url || "";
  const isRestricted =
    !url ||
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("chrome-extension://") ||
    /^https?:\/\/(chrome\.google\.com\/webstore|microsoftedge\.microsoft\.com\/addons)/.test(url);

  if (isRestricted) {
    await openExtensionComposerUi(tab.windowId).catch(() => {});
  } else {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SEARCH_OVERLAY" }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === "ENSURE_INITIAL_STATE_DEFAULTS") {
    ensureInitialStateDefaults()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "SETTINGS_SAVED") {
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "OPEN_COMPARE_PAGE") {
    openComparePage(message.query)
      .then((tab) => sendResponse({ ok: true, tabId: tab.id }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "RUN_SEARCH_GROUP") {
    runSearchGroup(message.group, message.query)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "RUN_CTX_GROUP") {
    chrome.storage.local.get(SEARCH_GROUPS_STORAGE_KEY)
      .then((stored) => {
        const searchGroups = Array.isArray(stored[SEARCH_GROUPS_STORAGE_KEY])
          ? stored[SEARCH_GROUPS_STORAGE_KEY] : [];
        return runSelectionContextGroup(message.ctxGroup, message.query, searchGroups);
      })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "OPEN_SETTINGS_PAGE") {
    const params = new URLSearchParams();
    if (message.section) params.set("section", message.section);
    if (message.miscTab) params.set("miscTab", message.miscTab);
    const query = params.toString();
    const url = SETTINGS_PAGE_URL + (query ? `?${query}` : "");
    chrome.tabs.create({ url })
      .then((tab) => sendResponse({ ok: true, tabId: tab.id }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "OPEN_EXTERNAL_URL") {
    chrome.tabs.create({ url: message.url, active: true })
      .then((tab) => sendResponse({ ok: true, tabId: tab.id }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "OPEN_SITE_TAB_AND_SEND") {
    openSiteTabAndSend(message.site, message.query)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_QUICK_ACCESS_SITES") {
    Promise.all([
      chrome.storage.local.get(QUICK_ACCESS_SITES_KEY),
      loadEnabledSites().catch(() => []),
    ]).then(([stored, allSites]) => {
      const ids = Array.isArray(stored[QUICK_ACCESS_SITES_KEY]) ? stored[QUICK_ACCESS_SITES_KEY] : [];
      const sites = ids.map((id) => allSites.find((s) => s.id === id)).filter(Boolean);
      sendResponse({ sites });
    }).catch(() => sendResponse({ sites: [] }));
    return true;
  }

  if (message.type === "WARMUP_AI_SITES") {
    warmupAiSites()
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});
