/**
 * send.js — compare page send orchestration entry point.
 *
 * Sub-modules:
 *   send-strategies.js — per-site strategy waterfall
 *   send-dispatch.js   — postMessage dispatch with retries
 */

import { state, elements, BASE_CONFIG } from "./state.js";
import {
  getSelectedSites,
  getQuery,
  clearAutoSendFlagFromUrl,
} from "./utils.js";
import { setGlobalStatus, toggleGlobalButtons, updateSendBtnState, setSiteStatus } from "./status.js";
import {
  activateScrollGuard,
  getScrollGuardDurationMs,
  lockContainerScroll,
  scheduleScrollUnlock,
} from "./layout-scroll.js";
import { clearIframeTimers, removeFromLoadQueue, pumpLoadQueue } from "./load-queue.js";
import { saveSearchHistory, refreshHistoryEntryUrls, scheduleHistoryUrlRefresh } from "./history.js";
import { diagnosticLog } from "../../shared/diagnostics.js";
import { sendSmartToSite, settlePendingQuery } from "./send-strategies.js";
import { finalizePendingDispatch } from "./send-dispatch.js";

// Re-export sub-module APIs so existing importers need no changes.
export {
  sendSmartToSite,
  navigateByUrlTemplate,
  settlePendingQuery,
  flushPendingQueryAfterLoad,
} from "./send-strategies.js";
export {
  dispatchSearchWithRetries,
  scheduleDispatchAttempt,
  scheduleDispatchAttemptFailure,
  resolvePendingDispatch,
  finalizePendingDispatch,
} from "./send-dispatch.js";

export async function handleSendSelected(options = {}) {
  if (state.isSending) {
    diagnosticLog("compare.send", "ignored-while-sending");
    return;
  }

  const { clearInputAfterSend = true } = options;
  const query = getQuery();

  if (!query) {
    diagnosticLog("compare.send", "empty-query");
    setGlobalStatus("请输入问题后再发送。", true);
    return;
  }

  const selectedSites = getSelectedSites();
  if (selectedSites.length === 0) {
    diagnosticLog("compare.send", "no-selected-sites");
    setGlobalStatus("没有可发送的站点。", true);
    return;
  }

  state.isSending = true;
  diagnosticLog("compare.send", "start", {
    selectedCount: selectedSites.length,
    siteIds: selectedSites.map((site) => site.id),
    query,
  });

  try {
    lockContainerScroll();
    toggleGlobalButtons(true);
    setGlobalStatus(`正在向 ${selectedSites.length} 个站点分发问题...`);

    state.lastSearchQuery = query;
    state.lastSearchTime = new Date().toLocaleString();

    activateScrollGuard(
      elements.iframesContainer.scrollLeft,
      elements.iframesContainer.scrollTop,
      getScrollGuardDurationMs(selectedSites.length)
    );

    if (clearInputAfterSend) {
      elements.queryInput.value = "";
      updateSendBtnState();
    }

    const historyEntryPromise = saveSearchHistory(query, selectedSites).catch(() => null);
    const results = await sendSitesWithConcurrency(selectedSites, query);
    const successCount = results.filter((item) => item && item.ok).length;
    const failedCount = results.length - successCount;
    diagnosticLog("compare.send", "complete", { successCount, failedCount, results });

    const historyEntryId = await historyEntryPromise;
    await refreshHistoryEntryUrls(historyEntryId, selectedSites);
    scheduleHistoryUrlRefresh(historyEntryId, selectedSites);
    setGlobalStatus(`发送完成：成功 ${successCount} 个，失败 ${failedCount} 个。`, failedCount > 0);
    scheduleScrollUnlock();
  } finally {
    state.isSending = false;
    diagnosticLog("compare.send", "unlock");
    toggleGlobalButtons(false);
  }
}

async function sendSitesWithConcurrency(sites, query) {
  const results = new Array(sites.length);
  const configuredConcurrency = Number.isFinite(BASE_CONFIG.sendConcurrency)
    ? BASE_CONFIG.sendConcurrency
    : 2;
  const concurrency = Math.max(1, Math.min(sites.length, configuredConcurrency));
  let nextIndex = 0;

  async function worker(workerId) {
    while (nextIndex < sites.length) {
      const index = nextIndex;
      nextIndex += 1;

      const site = sites[index];
      diagnosticLog("compare.send", "pooled-dispatch", {
        siteId: site.id,
        index: index + 1,
        total: sites.length,
        workerId,
        concurrency,
      });
      setSiteStatus(site.id, `正在发送（${index + 1}/${sites.length}）...`);

      try {
        results[index] = await sendSmartToSite(site, query, 0);
      } catch (error) {
        diagnosticLog("compare.send", "pooled-dispatch-error", {
          siteId: site.id,
          workerId,
          error: error.message,
        });
        results[index] = {
          ok: false,
          siteId: site.id,
          error: error.message || "发送失败"
        };
      }
    }
  }

  await Promise.all(
    Array.from({ length: concurrency }, (_item, index) => worker(index + 1))
  );

  return results;
}

export async function maybeAutoSendFromUrl() {
  if (!state.shouldAutoSend) {
    return;
  }

  const query = getQuery();
  if (!query) {
    state.shouldAutoSend = false;
    return;
  }

  state.shouldAutoSend = false;
  clearAutoSendFlagFromUrl();
  await handleSendSelected({ clearInputAfterSend: true });
}

export function abortPendingWorkForSite(siteId, options = {}) {
  const { reason = "卡片已关闭" } = options;
  diagnosticLog("compare.dispatch", "abort-site", { siteId, reason });
  const toCancel = [];
  state.pendingDispatches.forEach((pending, requestId) => {
    if (pending?.ref?.site?.id === siteId) {
      toCancel.push(requestId);
    }
  });
  toCancel.forEach((requestId) => {
    finalizePendingDispatch(requestId, {
      ok: false,
      siteId,
      error: reason
    });
  });

  const ref = state.cardRefs.get(siteId);
  settlePendingQuery(ref, { ok: false, siteId, error: reason });
  clearIframeTimers(ref);
  if (ref) {
    removeFromLoadQueue(ref);
    if (state.loadingRefs.has(ref)) {
      state.loadingRefs.delete(ref);
      pumpLoadQueue();
    }
  }
}
