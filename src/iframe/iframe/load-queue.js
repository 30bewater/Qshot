import { state, BASE_CONFIG } from "./state.js";
import { setSiteStatus } from "./status.js";
import { renderFallback, updateLoadingOverlay } from "./cards-render.js";

// 统一清理 ref 上的 load-delay 和 fallback 定时器。
// 在重建 iframe（刷新 / 换 src）或关闭卡片之前必须调用一次，
// 否则旧 iframe 的 fallback timer 会在 ~25s 后触发，把新 iframe 直接踢成 fallback 面板。
export function clearIframeTimers(ref) {
  if (!ref) return;
  if (ref.loadDelayTimerId) {
    window.clearTimeout(ref.loadDelayTimerId);
    ref.loadDelayTimerId = null;
  }
  if (ref.fallbackTimerId) {
    window.clearTimeout(ref.fallbackTimerId);
    ref.fallbackTimerId = null;
  }
}

// ── 并发槽位系统 ──
// 目标：同一时刻最多允许 BASE_CONFIG.iframeMaxConcurrent 张 iframe 真正在加载。
// - enqueueLoad(ref)：入队，尝试立即补位
// - pumpLoadQueue()  ：当槽位空闲时，从队首取 ref 调用 beginIframeLoad
// - beginIframeLoad(ref)：真正给 iframe 赋 src 并启动 fallback 定时器
// - releaseLoadSlot(ref)：ref 加载完成/失败/超时时释放槽位，触发下一个
// - removeFromLoadQueue(ref)：从队列中移除（关闭卡片 / 重建前使用）

export function enqueueLoad(ref) {
  if (!ref) return;
  if (state.loadingRefs.has(ref)) return;
  if (state.loadQueue.indexOf(ref) >= 0) return;
  state.loadQueue.push(ref);
  setSiteStatus(ref.site.id, "等待加载中…");
  updateLoadingOverlay(ref, "等待加载中…");
  pumpLoadQueue();
}

export function pumpLoadQueue() {
  const max = Math.max(1, BASE_CONFIG.iframeMaxConcurrent | 0 || 3);
  const staggerMs = (BASE_CONFIG.iframeStaggerMs != null) ? BASE_CONFIG.iframeStaggerMs : 120;
  // 本次"补位批"内部仍然保留微小错峰，避免同一 tick 多个一起赋 src。
  let batchDelay = 0;
  while (state.loadingRefs.size < max && state.loadQueue.length > 0) {
    const next = state.loadQueue.shift();
    // ref 可能在排队期间被关闭、被重建：跳过无效项。
    if (!next || !next.iframeEl || !state.cardRefs.has(next.site.id)) {
      continue;
    }
    state.loadingRefs.add(next);
    if (batchDelay === 0) {
      beginIframeLoad(next);
    } else {
      const target = next;
      window.setTimeout(() => {
        // 延迟到点时再校验一遍，期间可能已被关闭/刷新。
        if (state.loadingRefs.has(target) && target.iframeEl) {
          beginIframeLoad(target);
        }
      }, batchDelay);
    }
    batchDelay += staggerMs;
  }
}

export function releaseLoadSlot(ref) {
  if (!ref) return;
  if (state.loadingRefs.has(ref)) {
    state.loadingRefs.delete(ref);
  }
  pumpLoadQueue();
}

export function removeFromLoadQueue(ref) {
  const idx = state.loadQueue.indexOf(ref);
  if (idx >= 0) {
    state.loadQueue.splice(idx, 1);
  }
}

// 真正给 iframe 赋 src 并启动 fallback 定时器。
// 仅由 enqueueLoad → pumpLoadQueue 驱动，或由 immediate 路径直接调用。
export function beginIframeLoad(ref) {
  const iframe = ref?.iframeEl;
  const targetSrc = ref?._targetSrc;
  if (!iframe || !targetSrc) return;
  // 极端情况下 ref 可能在排队期间被替换成新 iframe，这里以当前 iframeEl 为准。
  iframe.src = targetSrc;
  setSiteStatus(ref.site.id, "正在加载…");
  updateLoadingOverlay(ref, "正在加载…");

  armIframeFallbackTimer(ref, iframe);
}

/** 从 iframe 真正开始 navigates 时起算 fallback 超时（含历史复原二段跳转）。 */
export function armIframeFallbackTimer(ref, iframe) {
  if (!ref || !iframe) return;
  if (ref.fallbackTimerId) {
    window.clearTimeout(ref.fallbackTimerId);
    ref.fallbackTimerId = null;
  }
  const timeoutMs = ref._retryTimeoutMs || BASE_CONFIG.embedTimeoutMs || 25000;
  ref._retryTimeoutMs = 0;
  ref.fallbackTimerId = window.setTimeout(() => {
    ref.fallbackTimerId = null;
    if (!ref._loadState?.resolved && ref.iframeEl === iframe) {
      releaseLoadSlot(ref);
      renderFallback(ref, "站点未能在限定时间内完成 iframe 加载。可能仍被目标站点限制嵌入。", { fromTimeout: true });
    }
  }, timeoutMs);
}
