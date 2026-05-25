import { state, elements } from "./state.js";
import { updateLatestHistoryUrl } from "./history.js";
import { handleHistoryRestoreUrlUpdate } from "./iframe-url-sync.js";
import { resolvePendingDispatch } from "./send.js";
import { diagnosticLog } from "../../shared/diagnostics.js";
import { MSG } from "../../shared/compare-protocol.js";

export function handleFrameMessage(event) {
  const payload = event.data;
  if (!payload || !payload.type || !payload.siteId) {
    return;
  }

  // 安全校验：消息必须来自我们已登记的某张卡片的 iframe，且 payload.siteId 要与该卡片匹配。
  // 这样可以阻止第三方内嵌广告 / 跨站 iframe 伪造 URL_UPDATE / RESULT 污染 UI 或历史记录。
  const ref = findCardRefByMessageSource(event.source);
  if (!ref || ref.site.id !== payload.siteId) {
    diagnosticLog("compare.message", "source-mismatch", {
      payloadType: payload.type,
      siteId: payload.siteId,
      matchedSiteId: ref?.site?.id,
    });
    return;
  }

  if (payload.type === MSG.URL_UPDATE) {
    diagnosticLog("compare.message", "url-update", { siteId: payload.siteId, currentUrl: payload.currentUrl });
    ref.injectedPinged = true;
    if (payload.currentUrl) {
      if (handleHistoryRestoreUrlUpdate(ref, payload.currentUrl)) {
        updateLatestHistoryUrl(payload.siteId, ref.currentUrl);
        return;
      }
      ref.currentUrl = payload.currentUrl;
      ref._targetSrc = payload.currentUrl;
      updateLatestHistoryUrl(payload.siteId, payload.currentUrl);
      // 不强制重载 iframe.src：SPA 站点已通过内部路由（pushState）跳转，
      // 强制赋 src 会触发硬刷新，导致已生成的对话内容丢失。
    }
    return;
  }

  if (payload.type === MSG.NAVIGATE_RESULT) {
    diagnosticLog("compare.message", "navigate-result", {
      siteId: payload.siteId,
      currentUrl: payload.currentUrl,
      ok: payload.ok,
    });
    if (payload.ok && payload.currentUrl && ref._historyRestoreNavigateTarget) {
      const renderWaitMs = payload.siteId === "deepseek" ? 4000 : 1800;
      window.setTimeout(() => {
        handleHistoryRestoreUrlUpdate(ref, payload.currentUrl);
      }, renderWaitMs);
    }
    return;
  }

  if (payload.type === MSG.PASTE_RESULT) {
    diagnosticLog("compare.message", "paste-result", {
      siteId: payload.siteId,
      requestId: payload.requestId,
      ok: payload.ok,
      error: payload.error,
    });
    resolvePendingFileDispatch(payload);
    return;
  }

  if (payload.type !== MSG.RESULT) {
    diagnosticLog("compare.message", "unknown-type", { payloadType: payload.type, siteId: payload.siteId });
    return;
  }

  diagnosticLog("compare.message", "result", {
    siteId: payload.siteId,
    requestId: payload.requestId,
    ok: payload.ok,
    error: payload.error,
  });

  if (payload.currentUrl) {
    ref.currentUrl = payload.currentUrl;
    ref._targetSrc = payload.currentUrl;
    updateLatestHistoryUrl(payload.siteId, payload.currentUrl);
    // 不强制重载 iframe.src：inject 上报的是 SPA 内部路由后的当前 URL，
    // iframe 已经显示正确内容，强制赋 src 会触发硬刷新导致对话内容丢失。
  }

  if (payload.requestId) {
    resolvePendingDispatch(payload.requestId, payload);
  }

  if (payload.ok) {
    const successText = payload.handlerId && payload.handlerId !== "primary"
      ? payload.message || `已通过备选规则（${payload.handlerId}）发送。`
      : (payload.message || "iframe 页面已处理查询。");
    setSiteStatus(payload.siteId, successText, "success");
  } else {
    setSiteStatus(payload.siteId, payload.error || "iframe 页面处理失败。", "error");
  }
}

function resolvePendingFileDispatch(payload) {
  const requestId = payload?.requestId;
  if (!requestId) {
    return;
  }

  const pending = state.pendingFileDispatches.get(requestId);
  if (!pending) {
    return;
  }

  state.pendingFileDispatches.delete(requestId);
  if (pending.timerId) {
    window.clearTimeout(pending.timerId);
  }

  if (payload.ok) {
    setSiteStatus(payload.siteId, payload.message || "文件已发送到卡片输入框。", "success");
  } else {
    setSiteStatus(payload.siteId, payload.error || "文件发送失败。", "error");
  }

  try {
    pending.resolve(payload);
  } catch (_error) {
    /* ignore resolver failure */
  }
}

// 遍历当前活跃的卡片，找到 contentWindow === source 的那一张。
// 注意：AI 站点内部的 sub-iframe 发来的消息，source 会是那个内部 window，
// 匹配不上我们的 ref.iframeEl.contentWindow，会被直接丢弃——这正是我们要的。
export function findCardRefByMessageSource(source) {
  if (!source) return null;
  for (const ref of state.cardRefs.values()) {
    const win = ref.iframeEl && ref.iframeEl.contentWindow;
    if (win && win === source) {
      return ref;
    }
  }
  return null;
}

export function setSiteStatus(siteId, message, kind = "info") {
  const ref = state.cardRefs.get(siteId);
  if (!ref) {
    return;
  }

  ref.statusEl.textContent = message;
  ref.statusEl.classList.toggle("success-text", kind === "success");
}

export function setGlobalStatus(message, isError = false) {
  elements.globalStatus.textContent = message;
  elements.globalStatus.classList.toggle("success-text", !isError);
}

export function toggleGlobalButtons(isBusy) {
  elements.sendSelectedBtn.disabled = isBusy;
  if (elements.promptAssistBtn) {
    elements.promptAssistBtn.disabled = isBusy;
  }
}

export function updateSendBtnState() {
  const hasContent = elements.queryInput.value.trim().length > 0;
  elements.sendSelectedBtn.classList.toggle("is-empty", !hasContent);
  _syncComposerSize();
}

function _isComposerExpanded() {
  const row = elements.queryInput?.closest(".bottom-composer-row");
  return Boolean(row?.matches(":focus-within"));
}

function _resetComposerCollapsedStyles() {
  const ta = elements.queryInput;
  const bar = ta?.closest(".bottom-composer-bar");
  if (!ta || !bar) return;

  bar.style.transition = "none";
  bar.classList.remove("is-wide", "is-tall");
  ta.style.height = "";
  ta.style.maxHeight = "";
  ta.scrollTop = 0;
  requestAnimationFrame(() => {
    bar.style.transition = "";
  });
}

/** 失焦收起输入条：清除展高内联样式，避免多行文字悬浮在 chips 上方 */
export function collapseComposerInput() {
  if (_isComposerExpanded()) return;
  _resetComposerCollapsedStyles();
}

export function bindComposerCollapseEvents() {
  const row = elements.queryInput?.closest(".bottom-composer-row");
  if (!row) return;

  row.addEventListener("focusin", () => {
    requestAnimationFrame(updateSendBtnState);
  });
  row.addEventListener("focusout", () => {
    requestAnimationFrame(collapseComposerInput);
  });
}

const COMPOSER_TA_MIN_PX = 34;
const COMPOSER_TA_MAX_PX = 162;
// 超过约 2 行（~56px）才铺全宽，否则保持居中小盒子
const COMPOSER_WIDE_THRESHOLD_PX = 56;

function _syncComposerSize() {
  const ta = elements.queryInput;
  if (!ta) return;
  const bar = ta.closest(".bottom-composer-bar");
  if (!bar) return;

  if (!_isComposerExpanded()) {
    _resetComposerCollapsedStyles();
    return;
  }

  bar.style.transition = "none";
  bar.classList.remove("is-wide", "is-tall");
  ta.style.height = "0px";
  ta.style.maxHeight = "";
  ta.style.overflowY = "hidden";
  void ta.offsetWidth;

  const naturalH = ta.scrollHeight;

  if (naturalH <= COMPOSER_WIDE_THRESHOLD_PX) {
    // 内容少：保持默认宽度（居中小盒子），自然高度
    const targetH = Math.max(COMPOSER_TA_MIN_PX, naturalH);
    ta.style.height = `${targetH}px`;
    requestAnimationFrame(() => { bar.style.transition = ""; });
    return;
  }

  // 内容多（超过约 2 行）：铺全宽
  bar.classList.add("is-wide");
  void ta.offsetWidth;

  // 重新测量（宽度变了，自然高度可能更小）
  ta.style.height = "0px";
  const expandedH = ta.scrollHeight;
  const clampedH = Math.min(expandedH, COMPOSER_TA_MAX_PX);
  ta.style.height = `${clampedH}px`;
  ta.style.maxHeight = `${COMPOSER_TA_MAX_PX}px`;
  ta.style.overflowY = expandedH > COMPOSER_TA_MAX_PX ? "auto" : "hidden";
  bar.classList.toggle("is-tall", expandedH > COMPOSER_TA_MAX_PX);

  requestAnimationFrame(() => { bar.style.transition = ""; });
}
