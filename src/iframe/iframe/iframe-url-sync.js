import { clearIframeTimers, armIframeFallbackTimer, releaseLoadSlot } from "./load-queue.js";
import { setSiteStatus } from "./status.js";
import { buildSiteUrl } from "./utils.js";
import { MSG } from "../../shared/compare-protocol.js";
import {
  historyUrlsLooseMatch,
  normalizeHistorySiteUrl,
} from "./history-url-normalize.js";

const RESTORE_NAVIGATE_TIMEOUT_MS = 22000;
const RESTORE_NAVIGATE_RETRY_DELAYS_MS = [1500, 3000, 5000, 8000, 12000, 16000];
const DEEPSEEK_RESTORE_NAVIGATE_RETRY_DELAYS_MS = [2500, 4500, 7000, 10000, 14000, 18000];

export function urlsNeedIframeReload(previousSrc, nextUrl) {
  const prev = String(previousSrc || "").trim();
  const next = String(nextUrl || "").trim();
  if (!next || !/^https?:/i.test(next)) {
    return false;
  }
  if (!prev || prev === "about:blank") {
    return true;
  }
  try {
    const a = new URL(prev);
    const b = new URL(next);
    if (a.origin !== b.origin) {
      return true;
    }
    return a.pathname !== b.pathname || a.search !== b.search || a.hash !== b.hash;
  } catch (_error) {
    return prev !== next;
  }
}

/**
 * 历史复原：SPA 须先从站点首页冷启动，再在 load 后跳转到记录的对话 URL。
 * 若 restoreUrl 与首页相同则无需二段加载。
 */
export function resolveHistoryRestoreLoadTarget(ref) {
  const homeUrl = buildSiteUrl(ref.site, "") || ref.site?.url || "";
  const restoreUrl = normalizeHistorySiteUrl(ref.site?.id, ref.restoreUrl);

  if (restoreUrl && restoreUrl !== ref.restoreUrl) {
    ref.restoreUrl = restoreUrl;
  }

  if (!restoreUrl || !urlsNeedIframeReload(homeUrl, restoreUrl)) {
    ref._targetSrc = restoreUrl || homeUrl;
    ref.restoreUrl = "";
    return ref._targetSrc;
  }

  ref._targetSrc = homeUrl;
  return homeUrl;
}

function hideLoadingOverlay(ref) {
  if (ref?.loadingEl) {
    ref.loadingEl.hidden = true;
  }
}

function showIframeLoading(ref, message) {
  if (!ref?.loadingEl) {
    return;
  }
  ref.loadingEl.hidden = false;
  const textEl = ref.loadingEl.querySelector(".iframe-loading-text");
  if (textEl) {
    textEl.textContent = message;
  }
}

function clearHistoryRestoreNavigateState(ref) {
  if (ref?._historyRestoreNavigateTimer) {
    window.clearTimeout(ref._historyRestoreNavigateTimer);
    ref._historyRestoreNavigateTimer = null;
  }
  ref._historyRestoreNavigateTarget = "";
  ref._historyRestoreNavigateRetryTimers?.forEach((timerId) => window.clearTimeout(timerId));
  ref._historyRestoreNavigateRetryTimers = [];
}

export function completeHistoryRestoreNavigation(ref) {
  if (!ref) {
    return;
  }
  clearHistoryRestoreNavigateState(ref);
  if (ref._loadState) {
    ref._loadState.resolved = true;
  }
  ref.loaded = true;
  clearIframeTimers(ref);
  releaseLoadSlot(ref);
  hideLoadingOverlay(ref);
  setSiteStatus(ref.site.id, "已恢复历史对话页。");
}

export function handleHistoryRestoreUrlUpdate(ref, currentUrl) {
  const target = ref?._historyRestoreNavigateTarget;
  if (!target || !currentUrl) {
    return false;
  }
  if (!historyUrlsLooseMatch(ref.site?.id, currentUrl, target)) {
    return false;
  }
  ref.currentUrl = normalizeHistorySiteUrl(ref.site?.id, currentUrl) || currentUrl;
  ref._targetSrc = ref.currentUrl;
  completeHistoryRestoreNavigation(ref);
  return true;
}

function shouldRestoreNavigateInFrame(homeUrl, restoreUrl) {
  try {
    return new URL(homeUrl).origin === new URL(restoreUrl).origin;
  } catch (_error) {
    return false;
  }
}

function postRestoreNavigateMessage(ref, url) {
  const win = ref?.iframeEl?.contentWindow;
  if (!win) {
    return false;
  }
  try {
    win.postMessage({
      type: MSG.NAVIGATE,
      url,
      siteId: ref.site?.id,
      site: ref.site,
    }, "*");
    return true;
  } catch (_error) {
    return false;
  }
}

function failHistoryRestoreNavigation(ref) {
  clearHistoryRestoreNavigateState(ref);
  if (ref._loadState) {
    ref._loadState.resolved = true;
  }
  ref.loaded = true;
  clearIframeTimers(ref);
  releaseLoadSlot(ref);
  hideLoadingOverlay(ref);
  setSiteStatus(
    ref.site.id,
    "自动恢复对话页未完成，可点击卡片刷新或「跳往原网站」。",
    "error"
  );
}

function scheduleInFrameRestoreNavigation(ref, restoreUrl) {
  clearHistoryRestoreNavigateState(ref);
  ref._historyRestoreNavigateTarget = restoreUrl;
  ref._historyRestoreNavigateRetryTimers = [];
  showIframeLoading(ref, "正在恢复对话页…");
  setSiteStatus(ref.site.id, "正在恢复历史对话…");

  const retryDelays = ref.site?.id === "deepseek"
    ? DEEPSEEK_RESTORE_NAVIGATE_RETRY_DELAYS_MS
    : RESTORE_NAVIGATE_RETRY_DELAYS_MS;

  retryDelays.forEach((delayMs) => {
    const timerId = window.setTimeout(() => {
      if (!ref._historyRestoreNavigateTarget) {
        return;
      }
      postRestoreNavigateMessage(ref, restoreUrl);
    }, delayMs);
    ref._historyRestoreNavigateRetryTimers.push(timerId);
  });

  // 不再 fallback 到 iframe.src 硬刷新——对 DeepSeek / ChatGPT 等 SPA 极易白屏。
  ref._historyRestoreNavigateTimer = window.setTimeout(() => {
    if (!ref._historyRestoreNavigateTarget) {
      return;
    }
    failHistoryRestoreNavigation(ref);
  }, RESTORE_NAVIGATE_TIMEOUT_MS);
}

/**
 * 历史复原二段跳转：同域 SPA 在 iframe 内 location.assign，避免父页改 src 硬刷新白屏。
 */
export function applyHistoryRestoreNavigation(ref, restoreUrl, loadedUrl = "") {
  const siteId = ref?.site?.id || "";
  const normalized = normalizeHistorySiteUrl(siteId, restoreUrl);
  if (!normalized) {
    completeHistoryRestoreNavigation(ref);
    return false;
  }

  const homeUrl = buildSiteUrl(ref.site, "") || ref.site?.url || "";
  if (!urlsNeedIframeReload(loadedUrl || homeUrl, normalized)) {
    ref.currentUrl = normalized;
    ref._targetSrc = normalized;
    completeHistoryRestoreNavigation(ref);
    return false;
  }

  ref.currentUrl = normalized;

  if (shouldRestoreNavigateInFrame(homeUrl, normalized)) {
    scheduleInFrameRestoreNavigation(ref, normalized);
    return true;
  }

  syncIframeToReportedUrl(ref, normalized);
  return true;
}

/**
 * SPA 站点提交后会在 iframe 内 pushState 换址；若父页不同步 iframe.src，
 * 卡片可能仍显示首页，历史记录也会落回默认 URL。
 */
export function syncIframeToReportedUrl(ref, nextUrl) {
  if (!ref?.iframeEl || !nextUrl) {
    return false;
  }

  const iframe = ref.iframeEl;
  const currentSrc = iframe.src || "";
  if (!urlsNeedIframeReload(currentSrc, nextUrl)) {
    ref.currentUrl = nextUrl;
    ref._targetSrc = nextUrl;
    return false;
  }

  ref._targetSrc = nextUrl;
  ref.currentUrl = nextUrl;
  if (ref._loadState) {
    ref._loadState.resolved = false;
  }
  ref.loaded = false;
  clearIframeTimers(ref);
  showIframeLoading(ref, "正在加载对话页…");
  iframe.src = nextUrl;
  armIframeFallbackTimer(ref, iframe);
  setSiteStatus(ref.site.id, "正在同步对话页…");
  return true;
}
