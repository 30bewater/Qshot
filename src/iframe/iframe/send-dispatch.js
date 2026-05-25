/**
 * send-dispatch.js
 * postMessage dispatch to inject content scripts with retry / timeout logic.
 */

import { state, BASE_CONFIG } from "./state.js";
import { createRequestId } from "./utils.js";
import { setSiteStatus } from "./status.js";
import { restoreLockedScrollPosition } from "./layout-scroll.js";
import { diagnosticLog } from "../../shared/diagnostics.js";
import { MSG } from "../../shared/compare-protocol.js";
import { HANDLER_ERROR_CODE } from "../../shared/handler-fallback.js";

export function dispatchSearchWithRetries(ref, query, initialDelayMs) {
  const requestId = createRequestId();
  diagnosticLog("compare.dispatch", "created", { site: ref.site, requestId, query });

  return new Promise((resolve) => {
    const pendingDispatch = {
      requestId,
      ref,
      query,
      resolve,
      attempts: 0,
      maxAttempts: BASE_CONFIG.tabSendRetryCount || 8,
      retryDelayMs: BASE_CONFIG.tabSendRetryDelayMs || 1800,
      timerId: null,
      completed: false
    };

    state.pendingDispatches.set(requestId, pendingDispatch);
    scheduleDispatchAttempt(pendingDispatch, initialDelayMs);
  });
}

export function scheduleDispatchAttempt(pendingDispatch, delayMs) {
  pendingDispatch.timerId = window.setTimeout(() => {
    if (pendingDispatch.completed) {
      return;
    }

    restoreLockedScrollPosition();

    pendingDispatch.attempts += 1;

    if (!pendingDispatch.ref.iframeEl?.contentWindow) {
      diagnosticLog("compare.dispatch", "missing-content-window", {
        site: pendingDispatch.ref.site,
        requestId: pendingDispatch.requestId,
        attempt: pendingDispatch.attempts,
      });
      if (pendingDispatch.attempts < pendingDispatch.maxAttempts) {
        scheduleDispatchAttempt(pendingDispatch, pendingDispatch.retryDelayMs);
      } else {
        finalizePendingDispatch(pendingDispatch.requestId, {
          ok: false,
          siteId: pendingDispatch.ref.site.id,
          error: "卡片 iframe 不可用"
        });
      }
      return;
    }

    try {
      const targetOrigin = "*";
      diagnosticLog("compare.dispatch", "post-message", {
        site: pendingDispatch.ref.site,
        requestId: pendingDispatch.requestId,
        attempt: pendingDispatch.attempts,
      });
      pendingDispatch.ref.iframeEl.contentWindow.postMessage(
        {
          type: MSG.SEARCH,
          query: pendingDispatch.query,
          site: pendingDispatch.ref.site,
          requestId: pendingDispatch.requestId
        },
        targetOrigin
      );
      setSiteStatus(pendingDispatch.ref.site.id, "查询已发送到卡片 iframe，等待页面响应...");
      restoreLockedScrollPosition();
    } catch (error) {
      diagnosticLog("compare.dispatch", "post-message-error", {
        site: pendingDispatch.ref.site,
        requestId: pendingDispatch.requestId,
        attempt: pendingDispatch.attempts,
        error: error.message,
      });
      if (pendingDispatch.attempts < pendingDispatch.maxAttempts) {
        scheduleDispatchAttempt(pendingDispatch, pendingDispatch.retryDelayMs);
      } else {
        finalizePendingDispatch(pendingDispatch.requestId, {
          ok: false,
          siteId: pendingDispatch.ref.site.id,
          error: error.message
        });
      }
      return;
    }

    scheduleDispatchAttemptFailure(pendingDispatch);
  }, delayMs);
}

export function scheduleDispatchAttemptFailure(pendingDispatch) {
  pendingDispatch.timerId = window.setTimeout(() => {
    if (pendingDispatch.completed) {
      return;
    }

    if (pendingDispatch.attempts < pendingDispatch.maxAttempts) {
      diagnosticLog("compare.dispatch", "retry", {
        site: pendingDispatch.ref.site,
        requestId: pendingDispatch.requestId,
        nextAttempt: pendingDispatch.attempts + 1,
      });
      setSiteStatus(
        pendingDispatch.ref.site.id,
        `自动发送暂未响应，正在重试 ${pendingDispatch.attempts + 1}/${pendingDispatch.maxAttempts}...`
      );
      scheduleDispatchAttempt(pendingDispatch, 0);
      return;
    }

    diagnosticLog("compare.dispatch", "timeout", {
      site: pendingDispatch.ref.site,
      requestId: pendingDispatch.requestId,
      attempts: pendingDispatch.attempts,
    });
    finalizePendingDispatch(pendingDispatch.requestId, {
      ok: false,
      siteId: pendingDispatch.ref.site.id,
      error: "自动发送超时，未收到卡片页面响应"
    });
  }, pendingDispatch.retryDelayMs);
}

export function resolvePendingDispatch(requestId, payload) {
  const pendingDispatch = state.pendingDispatches.get(requestId);
  if (!pendingDispatch || pendingDispatch.completed) {
    diagnosticLog("compare.dispatch", "resolve-miss", { requestId, payload });
    return;
  }

  diagnosticLog("compare.dispatch", "resolve", {
    site: pendingDispatch.ref.site,
    requestId,
    payload,
  });
  if (
    payload?.ok === false
    && (
      payload.errorCode === HANDLER_ERROR_CODE.HANDLERS_EXHAUSTED
      || payload.errorCode === HANDLER_ERROR_CODE.FATAL
    )
  ) {
    diagnosticLog("compare.dispatch", "resolve-skip-retries", {
      site: pendingDispatch.ref.site,
      requestId,
      errorCode: payload.errorCode,
    });
  }
  finalizePendingDispatch(requestId, payload);
}

export function finalizePendingDispatch(requestId, result) {
  const pendingDispatch = state.pendingDispatches.get(requestId);
  if (!pendingDispatch || pendingDispatch.completed) {
    return;
  }

  pendingDispatch.completed = true;
  if (pendingDispatch.timerId) {
    window.clearTimeout(pendingDispatch.timerId);
  }
  state.pendingDispatches.delete(requestId);
  restoreLockedScrollPosition();
  diagnosticLog("compare.dispatch", "finalize", {
    site: pendingDispatch.ref.site,
    requestId,
    result,
  });
  pendingDispatch.resolve(result);
}
