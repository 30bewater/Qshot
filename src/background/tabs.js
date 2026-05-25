import { loadEnabledSites, buildSiteUrl, canSearchByUrl, delay } from "./sites.js";

const COMPARE_PAGE_BASE_URL = chrome.runtime.getURL("iframe/iframe.html");
const TAB_SEND_RETRY_COUNT = 8;
const TAB_SEND_RETRY_DELAY_MS = 2000;
const DEFAULT_POST_LOAD_SEND_DELAY_MS = 1200;

export async function openComparePage(query = "", siteIds = []) {
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

export async function runSearchGroup(group, query) {
  if (!group || !group.mode) {
    throw new Error("搜索组配置无效");
  }

  if (group.mode === "tabs") {
    return openSitesInTabs(group.siteIds || [], query);
  }

  const tab = await openComparePage(query, group.siteIds || []);
  return { tabId: tab.id };
}

export function buildContextSearchQuery(prompt, selection) {
  const prefix = String(prompt || "").trim();
  const body = String(selection || "").trim();
  if (!prefix) return body;
  if (!body) return prefix;
  return `${prefix}\n\n${body}`;
}

export async function runSelectionContextGroup(ctxGroup, selectionText, searchGroups = []) {
  if (!ctxGroup) return null;

  const query = buildContextSearchQuery(ctxGroup.prompt, selectionText);
  if (!query) return null;

  let targetGroup;
  if (ctxGroup.targetType === "group" && ctxGroup.refGroupId) {
    const refGroup = searchGroups.find((g) => g.id === ctxGroup.refGroupId);
    if (refGroup) {
      const overrideMode = ctxGroup.mode === "compare" || ctxGroup.mode === "tabs" ? ctxGroup.mode : null;
      targetGroup = overrideMode ? { ...refGroup, mode: overrideMode } : refGroup;
    }
  } else {
    targetGroup = {
      mode: ctxGroup.mode === "compare" ? "compare" : "tabs",
      siteIds: ctxGroup.siteIds || [],
    };
  }

  if (!targetGroup || !(targetGroup.siteIds || []).length) return null;
  return runSearchGroup(targetGroup, query);
}

export async function openSitesInTabs(siteIds, query) {
  const sites = await loadEnabledSites();
  const targetSites = Array.isArray(siteIds) && siteIds.length > 0
    ? sites.filter((site) => siteIds.includes(site.id))
    : sites;

  if (targetSites.length === 0) {
    return { tabIds: [] };
  }

  const tabSitePairs = [];

  // 第一个站点：真正新开标签并切过去，保留用户当前页面不被覆盖。
  const firstSite = targetSites[0];
  const firstTab = await chrome.tabs.create({
    url: buildSiteUrl(firstSite, query),
    active: true,
  }).catch(() => null);
  if (firstTab) tabSitePairs.push({ tab: firstTab, site: firstSite });

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
  const openedTabIds = tabSitePairs.map(({ tab }) => tab.id);
  let results = tabSitePairs.map(({ site, tab }) => ({
    ok: true,
    siteId: site.id,
    tabId: tab.id,
    message: "已打开标签页"
  }));

  if (query) {
    results = await Promise.all(
      tabSitePairs.map(async ({ tab, site }) => {
        try {
          if (!canSearchByUrl(site)) {
            await waitForSiteTabReady(tab.id, site);
            await sendQueryToTab(tab.id, site, query);
          }
          return {
            ok: true,
            siteId: site.id,
            tabId: tab.id,
            message: canSearchByUrl(site) ? "已通过 URL 打开搜索结果" : "已打开标签页并完成自动发送"
          };
        } catch (error) {
          return {
            ok: false,
            siteId: site.id,
            tabId: tab.id,
            error: error.message || "标签页自动发送失败"
          };
        }
      })
    );
  }

  return { tabIds: openedTabIds, results };
}

export async function openSiteTabAndSend(site, query) {
  if (!site || !site.url) {
    throw new Error("站点配置无效");
  }

  const tab = await chrome.tabs.create({
    url: buildSiteUrl(site, query),
    active: false,
  });

  if (query && !canSearchByUrl(site)) {
    await waitForSiteTabReady(tab.id, site);
    await sendQueryToTab(tab.id, site, query);
  }

  return { tabId: tab.id };
}

async function sendQueryToTab(tabId, site, query) {
  let lastError = null;
  for (let attempt = 0; attempt < TAB_SEND_RETRY_COUNT; attempt += 1) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, {
        type: "SEARCH_SITE_QUERY",
        site,
        query,
      });
      if (result?.ok) {
        return;
      }
      lastError = new Error(result?.error || "自动发送未成功");
    } catch (error) {
      lastError = error;
    }
    if (attempt < TAB_SEND_RETRY_COUNT - 1) {
      await delay(TAB_SEND_RETRY_DELAY_MS);
    }
  }
  throw lastError || new Error("内容脚本未就绪，自动发送失败");
}

function hostnameMatchesSite(hostname, site) {
  const host = String(hostname || "").toLowerCase();
  const patterns = Array.isArray(site?.matchPatterns) ? site.matchPatterns : [];
  return patterns.some((pattern) => host.includes(String(pattern || "").toLowerCase()));
}

async function waitForSiteTabReady(tabId, site, timeoutMs = 30000) {
  await waitForTabComplete(tabId, timeoutMs);

  const patterns = Array.isArray(site?.matchPatterns) ? site.matchPatterns : [];
  const postLoadDelayMs = Number.isFinite(site?.postLoadSendDelayMs)
    ? site.postLoadSendDelayMs
    : DEFAULT_POST_LOAD_SEND_DELAY_MS;

  if (patterns.length > 0) {
    const urlWaitDeadline = Date.now() + Math.min(timeoutMs, 15000);
    while (Date.now() < urlWaitDeadline) {
      let tab;
      try {
        tab = await chrome.tabs.get(tabId);
      } catch (error) {
        throw error;
      }
      let hostname = "";
      try {
        hostname = new URL(tab.url || "about:blank").hostname;
      } catch (_error) {
        hostname = "";
      }
      if (hostnameMatchesSite(hostname, site)) {
        break;
      }
      await delay(400);
    }
  }

  if (postLoadDelayMs > 0) {
    await delay(postLoadDelayMs);
  }
}

function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      chrome.tabs.onRemoved.removeListener(handleRemoved);
      clearTimeout(timeoutId);
    };
    const finish = (callback) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };

    const timeoutId = setTimeout(() => {
      finish(() => reject(new Error("等待标签页加载超时")));
    }, timeoutMs);

    function handleUpdated(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") {
        return;
      }
      finish(resolve);
    }

    function handleRemoved(removedTabId) {
      if (removedTabId !== tabId) {
        return;
      }
      finish(() => reject(new Error("标签页已关闭，自动发送取消")));
    }

    chrome.tabs.onUpdated.addListener(handleUpdated);
    chrome.tabs.onRemoved.addListener(handleRemoved);
    chrome.tabs.get(tabId)
      .then((tab) => {
        if (tab?.status === "complete") {
          finish(resolve);
        }
      })
      .catch((error) => {
        finish(() => reject(error));
      });
  });
}
