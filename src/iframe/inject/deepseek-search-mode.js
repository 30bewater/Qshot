import { AI_SITE_SEARCH_MODES_STORAGE_KEY } from "../../shared/storage-keys.js";

const MODE_DEEP_THINK = "deepThink";
const MODE_FAST = "fastSearch";

const SEARCH_MODE_TEXT_PATTERNS = ["深度思考", "DeepThink", "R1", "快速搜索", "V3", "联网搜索"];

let knownSearchMode = null;
let monitorTimer = 0;
let applyAttemptCount = 0;

function loadPreferredMode() {
  try {
    return new Promise((resolve) => {
      chrome.storage.local.get([AI_SITE_SEARCH_MODES_STORAGE_KEY], (stored) => {
        const modes = stored[AI_SITE_SEARCH_MODES_STORAGE_KEY] || {};
        resolve(modes.deepseek || null);
      });
    });
  } catch (_e) {
    return Promise.resolve(null);
  }
}

function savePreferredMode(mode) {
  if (!mode) return;
  try {
    chrome.storage.local.get([AI_SITE_SEARCH_MODES_STORAGE_KEY], (stored) => {
      const modes = stored[AI_SITE_SEARCH_MODES_STORAGE_KEY] || {};
      modes.deepseek = mode;
      chrome.storage.local.set({ [AI_SITE_SEARCH_MODES_STORAGE_KEY]: modes });
    });
  } catch (_e) { /* ignore */ }
}

function findInputArea() {
  const composerSelectors = [
    "textarea",
    "div[contenteditable='true']",
    "[placeholder*='发送']",
    "[placeholder*='问点']",
    "[class*='chat-input']",
    "[class*='composer']",
    "[class*='sender']",
    "[class*='input-area']",
  ];
  for (const sel of composerSelectors) {
    const el = document.querySelector(sel);
    if (el && isVisible(el)) return el;
  }
  return null;
}

function isVisible(el) {
  if (!(el instanceof Element)) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

function findSearchModeToggles() {
  const clickables = document.querySelectorAll("button, [role='button'], [role='switch'], [role='radio']");
  const candidates = [];

  for (const el of clickables) {
    if (!isVisible(el)) continue;
    const text = (el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || "").trim();
    if (!text) continue;

    const matched = SEARCH_MODE_TEXT_PATTERNS.find((p) => text.includes(p));
    if (!matched) continue;

    const rect = el.getBoundingClientRect();
    const isSmallToggle = rect.width < 180 && rect.height < 56;
    if (!isSmallToggle) continue;

    candidates.push({ element: el, text, matched, rect });
  }

  if (candidates.length === 0) return [];

  const inputArea = findInputArea();
  if (inputArea) {
    const inputRect = inputArea.getBoundingClientRect();
    candidates.sort((a, b) => {
      const aDist = Math.abs(a.rect.top - inputRect.top) + Math.abs(a.rect.left - inputRect.left);
      const bDist = Math.abs(b.rect.top - inputRect.top) + Math.abs(b.rect.left - inputRect.left);
      return aDist - bDist;
    });
  }

  return candidates;
}

function detectCurrentMode(toggles) {
  if (toggles.length === 0) return null;

  const deepThinkCandidates = [];
  const fastSearchCandidates = [];

  for (const t of toggles) {
    const text = t.text.toLowerCase();
    if (["深度思考", "deepthink", "r1"].some((p) => text.includes(p.toLowerCase()))) {
      deepThinkCandidates.push(t);
    }
    if (["快速搜索", "v3", "快速"].some((p) => text.includes(p.toLowerCase()))) {
      fastSearchCandidates.push(t);
    }
  }

  if (deepThinkCandidates.length === 1 && fastSearchCandidates.length === 1) {
    const dt = deepThinkCandidates[0].element;
    if (looksLikeActiveToggle(dt)) return MODE_DEEP_THINK;
    const fs = fastSearchCandidates[0].element;
    if (looksLikeActiveToggle(fs)) return MODE_FAST;
    return looksLikeActiveToggle(dt) ? MODE_DEEP_THINK : MODE_FAST;
  }

  for (const t of toggles) {
    const text = t.text.toLowerCase();
    if (["深度思考", "deepthink", "r1"].some((p) => text.includes(p.toLowerCase()))) {
      return looksLikeActiveToggle(t.element) ? MODE_DEEP_THINK : MODE_FAST;
    }
  }

  return null;
}

function looksLikeActiveToggle(el) {
  if (el.getAttribute("aria-pressed") === "true") return true;
  if (el.getAttribute("aria-checked") === "true") return true;

  const activeClassPattern = /(^|\s|[-_])(active|selected|checked|on|pressed|is-active|is-selected|--active|--selected)(\s|$|[-_])/i;
  let current = el;
  while (current instanceof HTMLElement) {
    const className = typeof current.className === "string" ? current.className : "";
    if (activeClassPattern.test(className)) return true;
    current = current.parentElement;
  }

  const style = getComputedStyle(el);
  const bg = style.backgroundColor || "";
  if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)" && bg !== "initial") {
    const color = style.color || "";
    const textColorBright = isBrightColor(color);
    const bgBright = isBrightColor(bg);
    if (textColorBright !== bgBright && bg !== "rgb(255, 255, 255)") return true;
  }

  return false;
}

function isBrightColor(colorStr) {
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return false;
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

function findToggleToClick(toggles, targetMode) {
  if (toggles.length === 0) return null;

  const currentMode = detectCurrentMode(toggles);
  if (!currentMode || currentMode === targetMode) return null;

  if (toggles.length === 1) {
    return toggles[0].element;
  }

  if (targetMode === MODE_DEEP_THINK) {
    for (const t of toggles) {
      const text = t.text.toLowerCase();
      if (["深度思考", "deepthink", "r1"].some((p) => text.includes(p.toLowerCase()))) {
        return t.element;
      }
    }
  }

  if (targetMode === MODE_FAST) {
    for (const t of toggles) {
      const text = t.text.toLowerCase();
      if (["快速搜索", "v3", "快速"].some((p) => text.includes(p.toLowerCase()))) {
        return t.element;
      }
    }
  }

  return toggles[0].element;
}

function clickToggle(element) {
  if (!element) return;
  try {
    element.focus();
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    if (typeof element.click === "function") {
      element.click();
    }
  } catch (_e) { /* ignore */ }
}

async function applyStoredModeOnce() {
  applyAttemptCount += 1;

  const toggles = findSearchModeToggles();
  if (toggles.length === 0) return false;

  const preferredMode = await loadPreferredMode();
  if (!preferredMode) {
    knownSearchMode = detectCurrentMode(toggles);
    if (knownSearchMode) savePreferredMode(knownSearchMode);
    return true;
  }

  const toggleToClick = findToggleToClick(toggles, preferredMode);
  if (toggleToClick) {
    clickToggle(toggleToClick);
    await delay(600);
  }

  const freshToggles = findSearchModeToggles();
  const newMode = detectCurrentMode(freshToggles.length > 0 ? freshToggles : toggles);
  knownSearchMode = newMode;
  if (newMode && newMode !== preferredMode) {
    savePreferredMode(newMode);
  }

  return true;
}

function startApplyLoop() {
  if (monitorTimer) return;

  const scheduleNext = () => {
    monitorTimer = window.setTimeout(async () => {
      if (knownSearchMode) {
        monitorTimer = 0;
        return;
      }

      const applied = await applyStoredModeOnce();
      if (applied && knownSearchMode) {
        monitorTimer = 0;
        startModeChangeMonitor();
        return;
      }

      if (applyAttemptCount < 12) {
        scheduleNext();
      } else {
        monitorTimer = 0;
        startModeChangeMonitor();
      }
    }, 500 + applyAttemptCount * 300);
  };

  scheduleNext();
}

function startModeChangeMonitor() {
  const toggles = findSearchModeToggles();
  if (toggles.length === 0) return;

  for (const t of toggles) {
    t.element.addEventListener("click", () => {
      window.setTimeout(async () => {
        const freshToggles = findSearchModeToggles();
        const newMode = detectCurrentMode(freshToggles);
        if (newMode && newMode !== knownSearchMode) {
          knownSearchMode = newMode;
          savePreferredMode(newMode);
        }
      }, 400);
    });
  }
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function initDeepSeekSearchMode() {
  const hostname = window.location.hostname || "";
  if (!hostname.includes("deepseek")) return;

  startApplyLoop();
}
