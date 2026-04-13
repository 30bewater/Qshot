const COMPARE_PAGE_BASE_URL = chrome.runtime.getURL("iframe/iframe.html");
const SETTINGS_PAGE_URL = chrome.runtime.getURL("settings/settings.html");
const SEARCH_GROUPS_STORAGE_KEY = "searchGroups";

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

  return false;
});

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

  const openedTabIds = [];
  for (const [index, site] of targetSites.entries()) {
    const tab = await chrome.tabs.create({
      url: site.url,
      active: false
    });
    openedTabIds.push(tab.id);

    if (query) {
      await waitForTabComplete(tab.id);
      await sendQueryToTab(tab.id, site, query);
    }
  }

  if (openedTabIds.length > 0) {
    await chrome.tabs.update(openedTabIds[0], { active: true });
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

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
