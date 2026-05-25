import { diagnosticLog } from "../../shared/diagnostics.js";
import { MSG } from "../../shared/compare-protocol.js";
import { EXTENSION_ORIGIN } from "./constants.js";
import { beginDeepSeekHistoryRestorePause } from "./deepseek-restore-pause.js";

function notifyNavigateResult(siteId, currentUrl, ok, error = "") {
  if (window.parent === window) {
    return;
  }
  const targetOrigin = EXTENSION_ORIGIN || "*";
  try {
    window.parent.postMessage(
      {
        type: MSG.NAVIGATE_RESULT,
        siteId,
        currentUrl,
        ok,
        error,
      },
      targetOrigin
    );
  } catch (_error) {
    /* parent not extension page */
  }
}

function tryDeepSeekSpaNavigate(next) {
  const targetHref = next.toString();
  const pathWithQuery = `${next.pathname}${next.search}${next.hash}`;
  window.history.pushState(window.history.state, "", pathWithQuery);
  window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  return window.location.href === targetHref
    || window.location.pathname + window.location.search + window.location.hash === pathWithQuery;
}

export function handleHistoryRestoreNavigate(message, onNavigated) {
  const target = String(message?.url || "").trim();
  const siteId = String(message?.siteId || message?.site?.id || "").trim();
  if (!target) {
    notifyNavigateResult(siteId, window.location.href, false, "empty-url");
    return { ok: false, error: "empty-url" };
  }

  try {
    const current = new URL(window.location.href);
    const next = new URL(target);
    if (current.origin !== next.origin) {
      notifyNavigateResult(siteId, current.href, false, "origin-mismatch");
      return { ok: false, error: "origin-mismatch" };
    }

    if (current.href === next.href) {
      if (siteId === "deepseek") {
        beginDeepSeekHistoryRestorePause();
      }
      onNavigated?.();
      notifyNavigateResult(siteId, current.href, true);
      return { ok: true, skipped: true };
    }

    diagnosticLog("inject.history", "navigate", { from: current.href, to: next.href, siteId });

    if (siteId === "deepseek") {
      beginDeepSeekHistoryRestorePause();
      if (tryDeepSeekSpaNavigate(next)) {
        onNavigated?.();
        notifyNavigateResult(siteId, window.location.href, true);
        return { ok: true, method: "pushState" };
      }
    }

    window.location.assign(next.toString());
    onNavigated?.();
    notifyNavigateResult(siteId, next.toString(), true);
    return { ok: true, method: "assign" };
  } catch (error) {
    notifyNavigateResult(siteId, window.location.href, false, error.message || "navigate-failed");
    return { ok: false, error: error.message || "navigate-failed" };
  }
}
