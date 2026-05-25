const RESTORE_CLASS = "qshot-history-restore";
let restorePauseUntil = 0;
let restoreClearTimer = null;

/** 历史复原期间暂停 DeepSeek 侧栏抑制，避免误藏主聊天区导致白屏。 */
export function beginDeepSeekHistoryRestorePause(durationMs = 12000) {
  restorePauseUntil = Date.now() + durationMs;
  document.documentElement.classList.add(RESTORE_CLASS);
  document.querySelectorAll("[data-qshot-deepseek-hidden='true']").forEach((el) => {
    el.removeAttribute("data-qshot-deepseek-hidden");
    el.style.removeProperty("display");
    el.style.removeProperty("visibility");
    el.style.removeProperty("opacity");
    el.style.removeProperty("pointer-events");
    el.style.removeProperty("width");
    el.style.removeProperty("min-width");
    el.style.removeProperty("max-width");
    el.style.removeProperty("transform");
  });
  window.clearTimeout(restoreClearTimer);
  restoreClearTimer = window.setTimeout(() => {
    restorePauseUntil = 0;
    document.documentElement.classList.remove(RESTORE_CLASS);
    restoreClearTimer = null;
  }, durationMs);
}

export function isDeepSeekHistoryRestorePaused() {
  return Date.now() < restorePauseUntil
    || document.documentElement.classList.contains(RESTORE_CLASS);
}
