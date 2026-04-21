const COMPARE_PAGE_BASE_URL = chrome.runtime.getURL("iframe/iframe.html");
const SETTINGS_PAGE_URL = chrome.runtime.getURL("settings/settings.html");
const SEARCH_GROUPS_STORAGE_KEY = "searchGroups";
const PROMPT_GROUPS_STORAGE_KEY = "promptGroups";
const UI_PREFS_STORAGE_KEY = "uiPrefs";
const CUSTOM_SITES_STORAGE_KEY = "customSites";
const AI_SITE_IDS = ["deepseek", "doubao", "kimi", "yuanbao", "qwen", "gemini", "chatgpt", "claude", "grok"];
const WARMUP_COOLDOWN_MS = 5 * 60 * 1000;
let lastWarmupAt = 0;

chrome.runtime.onInstalled.addListener(async () => {
  console.log("Qshot - 子弹搜索 已安装");
  await ensureDefaultStorageState();
  await syncCommandShortcut();
});

// 当用户在设置里修改快捷键时，同步更新 manifest command 的绑定，
// 这样内置页面的自动弹窗也会跟着用户的设置走。
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[UI_PREFS_STORAGE_KEY]) return;
  const newPrefs = changes[UI_PREFS_STORAGE_KEY].newValue;
  if (!newPrefs) return;
  syncCommandShortcut(newPrefs).catch(() => {});
});

// 当用户在任意页面触发 manifest command 时：
// - 普通网页 → 向内容脚本发消息切换浮层
// - 浏览器内置页面（chrome://、edge:// 等）→ 打开扩展弹窗
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
    try {
      await chrome.action.openPopup();
    } catch (_e) {
      /* 部分情况下无法打开弹窗，忽略 */
    }
  } else {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SEARCH_OVERLAY" }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
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

  if (message.type === "OPEN_SETTINGS_PAGE") {
    const section = message.section ? `?section=${message.section}` : "";
    chrome.tabs.create({ url: SETTINGS_PAGE_URL + section })
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

  if (message.type === "WARMUP_AI_SITES") {
    warmupAiSites()
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function warmupAiSites() {
  const now = Date.now();
  if (now - lastWarmupAt < WARMUP_COOLDOWN_MS) {
    return { skipped: true, reason: "cooldown" };
  }

  const stored = await chrome.storage.local.get([UI_PREFS_STORAGE_KEY]);
  const prefs = stored[UI_PREFS_STORAGE_KEY] || {};
  if (prefs.prewarmEnabled === false) {
    return { skipped: true, reason: "disabled" };
  }

  const sites = await loadEnabledSites();
  const targets = sites.filter((site) => AI_SITE_IDS.includes(site.id));
  if (targets.length === 0) {
    return { skipped: true, reason: "no-targets" };
  }

  lastWarmupAt = now;

  // 审核说明：
  // - 该“预热”仅用于提升用户打开 AI 站点的冷启动速度（减少首次加载白屏）。
  // - 请求直接发往用户选择的第三方站点；扩展不上传任何用户数据到开发者服务器。
  // - 使用 mode:"no-cors"：扩展不会读取响应内容；credentials:"include" 仅用于复用用户现有登录态。
  await Promise.all(
    targets.map((site) => {
      const warmupUrl = (site.url || "").replace("{query}", "");
      if (!warmupUrl || !/^https?:\/\//.test(warmupUrl)) {
        return null;
      }
      return fetch(warmupUrl, {
        credentials: "include",
        mode: "no-cors",
        cache: "default",
        redirect: "follow"
      }).catch(() => null);
    })
  );

  return { warmed: targets.length };
}

async function openComparePage(query = "", siteIds = []) {
  const targetUrl = buildComparePageUrl(query, siteIds);
  return chrome.tabs.create({ url: targetUrl });
}

function buildComparePageUrl(query, siteIds = []) {
  const url = new URL(COMPARE_PAGE_BASE_URL);
  if (query) {
    url.searchParams.set("q", query);
    url.searchParams.set("autosend", "1");
  }
  if (Array.isArray(siteIds) && siteIds.length > 0) {
    url.searchParams.set("sites", siteIds.join(","));
  }

  return url.toString();
}

async function runSearchGroup(group, query) {
  if (!group || !group.mode) {
    throw new Error("搜索组配置无效");
  }

  if (group.mode === "tabs") {
    return openSitesInTabs(group.siteIds || [], query);
  }

  const tab = await openComparePage(query, group.siteIds || []);
  return { tabId: tab.id };
}

async function openSitesInTabs(siteIds, query) {
  const sites = await loadEnabledSites();
  const targetSites = Array.isArray(siteIds) && siteIds.length > 0
    ? sites.filter((site) => siteIds.includes(site.id))
    : sites;

  if (targetSites.length === 0) {
    return { tabIds: [] };
  }

  const tabSitePairs = [];

  // 第一个站点：在当前激活的标签页中直接导航（而非新开标签）
  const firstSite = targetSites[0];
  const firstUrl = buildSiteUrl(firstSite, query);
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (activeTab) {
    await chrome.tabs.update(activeTab.id, { url: firstUrl }).catch(() => null);
    tabSitePairs.push({ tab: activeTab, site: firstSite });
  } else {
    const tab = await chrome.tabs.create({ url: firstUrl, active: true }).catch(() => null);
    if (tab) tabSitePairs.push({ tab, site: firstSite });
  }

  // 其余站点：在后台新标签页中并发打开
  const remainingSites = targetSites.slice(1);
  const newTabs = await Promise.all(
    remainingSites.map((site) =>
      chrome.tabs.create({ url: buildSiteUrl(site, query), active: false }).catch(() => null)
    )
  );
  newTabs.forEach((tab, idx) => {
    if (tab) tabSitePairs.push({ tab, site: remainingSites[idx] });
  });

  // 并发等待每个 tab 完成加载并独立发送查询，互不阻塞
  if (query) {
    await Promise.all(
      tabSitePairs.map(async ({ tab, site }) => {
        try {
          await waitForTabComplete(tab.id);
          await sendQueryToTab(tab.id, site, query);
        } catch (_err) {
          // 单个站点失败不影响其他
        }
      })
    );
  }

  const openedTabIds = tabSitePairs.map(({ tab }) => tab.id);
  return { tabIds: openedTabIds };
}

async function sendQueryToTab(tabId, site, query) {
  const maxAttempts = 6;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: "SEARCH_SITE_QUERY",
        site,
        query
      });
      return;
    } catch (_error) {
      await delay(300);
    }
  }
}

function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      reject(new Error("等待标签页加载超时"));
    }, timeoutMs);

    function handleUpdated(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") {
        return;
      }

      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      resolve();
    }

    chrome.tabs.onUpdated.addListener(handleUpdated);
  });
}

async function ensureDefaultSearchGroups() {
  const stored = await chrome.storage.local.get([SEARCH_GROUPS_STORAGE_KEY]);
  if (Array.isArray(stored[SEARCH_GROUPS_STORAGE_KEY]) && stored[SEARCH_GROUPS_STORAGE_KEY].length > 0) {
    return;
  }

  const groups = [
    {
      id: "default-compare",
      name: "AI搜索",
      mode: "compare",
      siteIds: []
    },
    {
      id: "default-tabs",
      name: "新开标签",
      mode: "tabs",
      siteIds: []
    }
  ];

  await chrome.storage.local.set({
    [SEARCH_GROUPS_STORAGE_KEY]: groups
  });
}

async function ensureDefaultStorageState() {
  const stored = await chrome.storage.local.get([
    SEARCH_GROUPS_STORAGE_KEY,
    PROMPT_GROUPS_STORAGE_KEY,
    UI_PREFS_STORAGE_KEY,
    CUSTOM_SITES_STORAGE_KEY
  ]);

  const hasGroups = Array.isArray(stored[SEARCH_GROUPS_STORAGE_KEY]) && stored[SEARCH_GROUPS_STORAGE_KEY].length > 0;
  const hasPrompts = Array.isArray(stored[PROMPT_GROUPS_STORAGE_KEY]) && stored[PROMPT_GROUPS_STORAGE_KEY].length > 0;
  const hasCustomSites = Array.isArray(stored[CUSTOM_SITES_STORAGE_KEY]);
  const hasUiPrefs = stored[UI_PREFS_STORAGE_KEY] && typeof stored[UI_PREFS_STORAGE_KEY] === "object";

  if (hasGroups && hasPrompts && hasCustomSites && hasUiPrefs) {
    return;
  }

  const defaults = await loadInitialStateDefaults();
  const patch = {};

  if (!hasGroups) patch[SEARCH_GROUPS_STORAGE_KEY] = defaults.searchGroups;
  if (!hasPrompts) patch[PROMPT_GROUPS_STORAGE_KEY] = defaults.promptGroups;
  if (!hasCustomSites) patch[CUSTOM_SITES_STORAGE_KEY] = defaults.customSites;
  if (!hasUiPrefs) patch[UI_PREFS_STORAGE_KEY] = defaults.uiPrefs;

  await chrome.storage.local.set(patch);
}

async function loadInitialStateDefaults() {
  // 优先读取打包内置的模板：config/initialState.json
  try {
    const resp = await fetch(chrome.runtime.getURL("config/initialState.json"));
    if (resp.ok) {
      const payload = await resp.json();
      const normalized = normalizeInitialStatePayload(payload);
      if (normalized) return normalized;
    }
  } catch (_err) {
    // 忽略，回退到硬编码默认值
  }

  return {
    searchGroups: [
      { id: "default-hunza", name: "混搭搜索", enabled: true, mode: "compare", siteIds: ["gemini", "chatgpt", "deepseek", "doubao", "kimi", "metaso"] },
      { id: "default-overseas", name: "海外模型", enabled: true, mode: "compare", siteIds: ["gemini", "chatgpt", "claude", "grok"] },
      { id: "default-domestic", name: "国内模型", enabled: true, mode: "compare", siteIds: ["deepseek", "doubao", "kimi", "metaso"] },
      { id: "default-single", name: "单个模型", enabled: true, mode: "tabs", siteIds: ["gemini"] }
    ],
    promptGroups: [
      {
        id: "prompt-group-default",
        name: "默认分组",
        prompts: [
          { id: "prompt-default-1", title: "总结重点", content: "请帮我总结这段内容的重点，并列出三条可执行建议。" }
        ]
      }
    ],
    customSites: [],
    uiPrefs: {
      showHistory: false,
      showRandomButton: true,
      showPromptButton: true,
      prewarmEnabled: true,
      overlayShortcutEnabled: true,
      overlayShortcut: { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, key: "Q" }
    }
  };
}

function normalizeInitialStatePayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const { searchGroups, promptGroups, customSites, uiPrefs } = payload;

  if (!Array.isArray(searchGroups) || searchGroups.length === 0) return null;
  if (!Array.isArray(promptGroups) || promptGroups.length === 0) return null;
  if (!Array.isArray(customSites)) return null;
  if (!uiPrefs || typeof uiPrefs !== "object") return null;

  // 只做最低限度兜底，避免坏文件导致初始化失败
  return {
    searchGroups: searchGroups.map((g, idx) => ({
      id: String(g?.id || `group-${idx}`),
      name: String(g?.name || "未命名搜索组"),
      enabled: g?.enabled !== false,
      mode: g?.mode === "tabs" ? "tabs" : "compare",
      siteIds: Array.isArray(g?.siteIds) ? g.siteIds.map(String) : []
    })),
    promptGroups: promptGroups.map((pg, gi) => ({
      id: String(pg?.id || `prompt-group-${gi}`),
      name: String(pg?.name || "未命名提示词分组"),
      prompts: Array.isArray(pg?.prompts)
        ? pg.prompts.map((p, pi) => ({
            id: String(p?.id || `prompt-${gi}-${pi}`),
            title: String(p?.title || "未命名提示词"),
            content: String(p?.content || "")
          }))
        : []
    })),
    customSites: customSites.filter(Boolean),
    uiPrefs: uiPrefs
  };
}

async function loadEnabledSites() {
  const response = await fetch(chrome.runtime.getURL("config/siteHandlers.json"));
  if (!response.ok) {
    throw new Error("无法读取站点配置");
  }

  const payload = await response.json();
  const builtin = (payload.sites || []).filter((site) => site.enabled !== false);
  const custom = await loadCustomSitesFromStorage();

  const seen = new Set(builtin.map((site) => site.id));
  const merged = [...builtin];
  custom.forEach((site) => {
    if (!seen.has(site.id)) {
      merged.push(site);
      seen.add(site.id);
    }
  });
  return merged;
}

async function loadCustomSitesFromStorage() {
  try {
    const stored = await chrome.storage.local.get(["customSites"]);
    const list = Array.isArray(stored.customSites) ? stored.customSites : [];
    return list
      .map((raw) => {
        if (!raw || typeof raw !== "object") return null;
        const name = String(raw.name || "").trim();
        const url = String(raw.url || "").trim();
        const id = String(raw.id || "").trim();
        if (!id || !name || !url) return null;
        return {
          id,
          name,
          url,
          enabled: raw.enabled !== false,
          supportIframe: raw.supportIframe !== false,
          supportUrlQuery: raw.supportUrlQuery !== false && url.includes("{query}"),
          matchPatterns: Array.isArray(raw.matchPatterns) ? raw.matchPatterns.map(String) : [],
          isCustom: true
        };
      })
      .filter((site) => site && site.enabled !== false);
  } catch (_error) {
    return [];
  }
}

function buildSiteUrl(site, query) {
  const url = String(site?.url || "");
  if (!url.includes("{query}")) {
    return url;
  }

  if (query && site?.supportUrlQuery) {
    return url.replace(/\{query\}/g, encodeURIComponent(query));
  }

  // 空 query 或站点不支持 URL 直达：剥离含 {query} 的参数段，回落到基础 URL
  let next = url.replace(/([?&])[^=&]+=\{query\}/g, (_, sep) => (sep === "?" ? "?" : ""));
  next = next.replace(/\?&/, "?");
  next = next.replace(/[?&]$/, "");
  // 兜底：万一还残留 {query}，粗暴清掉
  return next.replace(/\{query\}/g, "");
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// 将 {ctrlKey, altKey, shiftKey, metaKey, key} 对象转成 "Ctrl+Alt+Q" 格式的字符串，
// 用于 chrome.commands.update()。
function formatShortcutForCommand(sc) {
  if (!sc || !sc.key) return "";
  const parts = [];
  if (sc.ctrlKey) parts.push("Ctrl");
  if (sc.altKey) parts.push("Alt");
  if (sc.shiftKey) parts.push("Shift");
  if (sc.metaKey) parts.push("MacCtrl");
  if (parts.length === 0) return "";
  const key = sc.key.length === 1 ? sc.key.toUpperCase() : sc.key;
  parts.push(key);
  return parts.join("+");
}

// 从 storage 读取用户设置的快捷键，更新 manifest command 绑定。
async function syncCommandShortcut(prefs) {
  try {
    let sc = prefs?.overlayShortcut;
    if (!sc) {
      const stored = await chrome.storage.local.get([UI_PREFS_STORAGE_KEY]);
      sc = stored[UI_PREFS_STORAGE_KEY]?.overlayShortcut;
    }
    if (!sc) return;
    const shortcutStr = formatShortcutForCommand(sc);
    if (!shortcutStr) return;
    await chrome.commands.update({ name: "toggle-overlay", shortcut: shortcutStr });
  } catch (_e) {
    /* 快捷键组合不合法或不被支持时忽略，保持 manifest 默认值 */
  }
}
