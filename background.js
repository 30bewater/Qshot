const COMPARE_PAGE_BASE_URL = chrome.runtime.getURL("iframe/iframe.html");
const SETTINGS_PAGE_URL = chrome.runtime.getURL("settings/settings.html");
const SEARCH_GROUPS_STORAGE_KEY = "searchGroups";
const UI_PREFS_STORAGE_KEY = "uiPrefs";
const AI_SITE_IDS = ["deepseek", "doubao", "kimi", "yuanbao", "qwen", "gemini", "chatgpt", "claude", "perplexity", "grok"];
const WARMUP_COOLDOWN_MS = 5 * 60 * 1000;
let lastWarmupAt = 0;

chrome.runtime.onInstalled.addListener(async () => {
  console.log("AI 批量搜索 MVP 已安装");
  await ensureDefaultSearchGroups();
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
    chrome.tabs.create({ url: SETTINGS_PAGE_URL })
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

  // 并发创建所有 tab：浏览器一次性把所有站点 tab 全部打开
  const createdTabs = await Promise.all(
    targetSites.map((site) =>
      chrome.tabs.create({ url: buildSiteUrl(site, query), active: false }).catch(() => null)
    )
  );

  const tabSitePairs = createdTabs
    .map((tab, idx) => (tab ? { tab, site: targetSites[idx] } : null))
    .filter(Boolean);

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
  if (openedTabIds.length > 0) {
    try {
      await chrome.tabs.update(openedTabIds[0], { active: true });
    } catch (_err) {
      // 某些情况下首个 tab 可能已被关闭，忽略
    }
  }

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

async function loadEnabledSites() {
  const response = await fetch(chrome.runtime.getURL("config/siteHandlers.json"));
  if (!response.ok) {
    throw new Error("无法读取站点配置");
  }

  const payload = await response.json();
  return (payload.sites || []).filter((site) => site.enabled !== false);
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
