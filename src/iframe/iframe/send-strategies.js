/**
 * send-strategies.js
 * Per-site send strategy waterfall: url_template → dom_automation → new_tab.
 */

import { state } from "./state.js";
import { buildSiteUrl } from "./utils.js";
import { setSiteStatus } from "./status.js";
import { diagnosticLog } from "../../shared/diagnostics.js";
import { dispatchSearchWithRetries } from "./send-dispatch.js";

function getStrategiesForSite(site) {
  if (Array.isArray(site.embedStrategies) && site.embedStrategies.length > 0) {
    return site.embedStrategies;
  }

  if (site.supportIframe === false) {
    return [{ type: "new_tab" }];
  }

  const strategies = [];
  if (site.supportUrlQuery && String(site.url || "").includes("{query}")) {
    strategies.push({ type: "url_template", urlTemplate: site.url });
  }
  if (site.searchHandler && Array.isArray(site.searchHandler.steps)) {
    strategies.push({ type: "dom_automation" });
  }
  // 只有完全没有 iframe 策略时才兜底 new_tab。
  // 有 dom_automation / url_template 的 iframe 站点失败后应在卡片内报错，
  // 而非自动弹出新标签——那样对用户极度干扰且无法保证"每个都发出去"。
  if (strategies.length === 0) {
    strategies.push({ type: "new_tab" });
  }
  return strategies;
}

async function executeStrategy(strategy, ref, query, dispatchDelayMs) {
  switch (strategy.type) {
    case "url_template":
      return navigateByUrlTemplate(ref, query, strategy.urlTemplate || null);
    case "dom_automation":
      return dispatchSearchWithRetries(ref, query, dispatchDelayMs);
    case "new_tab":
      return openExternalSiteForQuery(ref.site, query);
    default:
      return { ok: false, siteId: ref.site.id, error: `未知策略类型: ${strategy.type}` };
  }
}

export async function sendSmartToSite(site, query, dispatchDelayMs = 0) {
  const strategies = getStrategiesForSite(site);

  if (strategies.length === 1 && strategies[0].type === "new_tab") {
    diagnosticLog("compare.site", "external-tab-route", { site });
    return openExternalSiteForQuery(site, query);
  }

  const ref = state.cardRefs.get(site.id);
  // 新搜索开始前清除历史复原 URL，防止 iframe load 事件误触发旧 restoreUrl 重定向。
  if (ref) {
    ref.restoreUrl = "";
  }

  if (!ref || !ref.iframeEl) {
    if (strategies.some((s) => s.type === "new_tab")) {
      diagnosticLog("compare.site", "missing-iframe-fallback-new-tab", { site });
      return openExternalSiteForQuery(site, query);
    }
    diagnosticLog("compare.site", "missing-iframe", { site });
    return { ok: false, siteId: site.id, error: "卡片 iframe 不可用" };
  }

  if (!ref.loaded) {
    diagnosticLog("compare.site", "wait-for-iframe-load", { site });
    settlePendingQuery(ref, {
      ok: false,
      siteId: site.id,
      error: "已取消上一条等待中的发送任务"
    });
    return new Promise((resolve) => {
      ref.pendingQuery = query;
      ref.pendingQueryDelayMs = dispatchDelayMs;
      ref.pendingQueryResolver = resolve;
      setSiteStatus(site.id, "卡片加载中，完成后将自动发送...");
    });
  }

  ref.pendingQuery = "";
  ref.pendingQueryDelayMs = 0;
  ref.pendingQueryResolver = null;

  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    const isLast = i === strategies.length - 1;

    diagnosticLog("compare.site", "strategy-attempt", {
      site: site.id,
      strategy: strategy.type,
      attempt: i + 1,
      total: strategies.length,
    });

    const result = await executeStrategy(strategy, ref, query, dispatchDelayMs);

    if (result.ok) {
      return result;
    }

    if (!isLast) {
      diagnosticLog("compare.site", "strategy-failed-try-next", {
        site: site.id,
        strategy: strategy.type,
        error: result.error,
      });
      setSiteStatus(site.id, `${strategy.type} 失败，尝试备选方案...`);
    }
  }

  return { ok: false, siteId: site.id, error: "所有发送策略均失败" };
}

async function openExternalSiteForQuery(site, query) {
  const targetUrl = buildSiteUrl(site, query);
  if (!targetUrl) {
    return {
      ok: false,
      siteId: site.id,
      error: "站点 URL 配置无效"
    };
  }

  const response = await chrome.runtime.sendMessage({
    type: "OPEN_SITE_TAB_AND_SEND",
    site,
    query
  });

  if (!response?.ok) {
    return {
      ok: false,
      siteId: site.id,
      error: response?.error || "新标签页打开失败"
    };
  }

  return {
    ok: true,
    siteId: site.id,
    message: "已在新标签页打开"
  };
}

export function navigateByUrlTemplate(ref, query, urlTemplate = null) {
  const targetUrl = urlTemplate
    ? (urlTemplate.includes("{query}") ? urlTemplate.replace("{query}", encodeURIComponent(query)) : null)
    : buildSiteUrl(ref.site, query);
  if (!targetUrl) {
    return Promise.resolve({
      ok: false,
      siteId: ref.site.id,
      error: "站点 URL 配置无效"
    });
  }

  const iframe = ref.iframeEl;
  if (!iframe) {
    return Promise.resolve({
      ok: false,
      siteId: ref.site.id,
      error: "卡片 iframe 不可用"
    });
  }

  ref._targetSrc = targetUrl;

  setSiteStatus(ref.site.id, "正在通过 URL 直达搜索结果页...");
  diagnosticLog("compare.url", "navigate-start", { site: ref.site, targetUrl });

  return new Promise((resolve) => {
    const timeoutMs = 12000;
    let done = false;

    const cleanup = () => {
      iframe.removeEventListener("load", handleLoad, true);
      iframe.removeEventListener("error", handleError, true);
    };

    const finish = (result) => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      diagnosticLog("compare.url", "navigate-finish", { site: ref.site, result });
      resolve(result);
    };

    const handleLoad = () => {
      ref.loaded = true;
      ref.currentUrl = iframe.src || targetUrl;
      finish({
        ok: true,
        siteId: ref.site.id,
        message: "已通过 URL 跳转到搜索结果页"
      });
    };

    const handleError = () => {
      finish({
        ok: false,
        siteId: ref.site.id,
        error: "URL 跳转失败，页面未响应"
      });
    };

    iframe.addEventListener("load", handleLoad, true);
    iframe.addEventListener("error", handleError, true);

    window.setTimeout(() => {
      finish({
        ok: false,
        siteId: ref.site.id,
        error: "URL 跳转超时，未进入目标结果页"
      });
    }, timeoutMs);

    iframe.src = targetUrl;
  });
}

export function settlePendingQuery(ref, result) {
  if (!ref) {
    return false;
  }

  const resolver = typeof ref.pendingQueryResolver === "function"
    ? ref.pendingQueryResolver
    : null;
  ref.pendingQueryResolver = null;
  ref.pendingQuery = "";
  ref.pendingQueryDelayMs = 0;

  if (!resolver) {
    return false;
  }

  try {
    resolver(result);
  } catch (_error) {
    /* ignore resolver failure */
  }
  return true;
}

export function flushPendingQueryAfterLoad(ref) {
  if (!ref?.pendingQuery) {
    return;
  }

  const queuedQuery = ref.pendingQuery;
  const queuedDelayMs = Number.isFinite(ref.pendingQueryDelayMs) ? ref.pendingQueryDelayMs : 0;
  const resolver = typeof ref.pendingQueryResolver === "function"
    ? ref.pendingQueryResolver
    : null;
  ref.pendingQuery = "";
  ref.pendingQueryDelayMs = 0;
  ref.pendingQueryResolver = null;

  if (!resolver) {
    return;
  }

  sendSmartToSite(ref.site, queuedQuery, queuedDelayMs)
    .then((result) => {
      resolver(result);
    })
    .catch((error) => {
      resolver({
        ok: false,
        siteId: ref.site?.id,
        error: error?.message || "自动发送失败"
      });
    });
}
