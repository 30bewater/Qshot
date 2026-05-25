import "../../shared/prompt-item.js";
import { PROMPT_PICKER_STYLES } from "../../shared/prompt-picker-styles.js";
import {
  PROMPT_GROUPS_STORAGE_KEY,
  UI_PREFS_STORAGE_KEY,
  DEFAULT_PROMPT_GROUP_ID,
} from "../../shared/storage-keys.js";
import { setContenteditableValue } from "./editors.js";
import {
  detectInputType,
  dispatchEventList,
  isTextControl,
  safeFocus,
  setNativeValue,
} from "./dom-utils.js";
import {
  isAiPagePromptLauncherEnabledForSite,
  readAiPagePromptLauncherPrefs,
} from "../../shared/ai-page-prompt-launcher-prefs.js";
import { createLauncherFabDrag } from "./input-prompt-launcher-drag.js";
import { createLauncherSpinFx } from "./input-prompt-launcher-spin-fx.js";
import { attachLauncherPanelTilt } from "./input-prompt-launcher-tilt.js";
import { findLauncherInput } from "./input-prompt-launcher-find.js";
import {
  HOST_ID,
  ICON_SIZE,
  GAP_ABOVE,
  PANEL_HEIGHT_PX,
  Q_SVG,
  DEFAULT_ANCHOR_SELECTORS,
} from "./input-prompt-launcher-constants.js";
import { LAUNCHER_SHELL_CSS } from "./input-prompt-launcher-styles.js";
import {
  buildSiteConfig,
  isInsideQshotCompareEmbed,
  resolveLauncherSite,
} from "./input-prompt-launcher-site.js";
import {
  installPanelInteraction,
  normalizePromptGroups,
  renderLauncherPromptPanel,
} from "./input-prompt-launcher-panel.js";

/** @type {{ id: string, inputSelectors: string[], anchorSelectors: string[] } | null} */
let activeSite = null;
let hostEl = null;
let shadow = null;
let root = null;
let backdrop = null;
let fab = null;
let panelShell = null;
let panel = null;
let groupsCol = null;
let listCol = null;
let panelFooter = null;
let previewMgr = null;
/** @type {ReturnType<createLauncherFabDrag> | null} */
let fabDrag = null;
/** @type {ReturnType<createLauncherSpinFx> | null} */
let fabSpinFx = null;
/** @type {ReturnType<attachLauncherPanelTilt> | null} */
let panelTilt = null;

let cachedUiPrefs = {};
let cachedPromptGroups = [];
let cachePromise = null;
let storageListenerInstalled = false;
let activeGroupId = DEFAULT_PROMPT_GROUP_ID;
let panelOpen = false;
let boundInput = null;
let positionRaf = 0;
let observer = null;
let trackTimer = 0;
let applyDismissLock = false;

function isAiPageLauncherEnabled() {
  return isAiPagePromptLauncherEnabledForSite(cachedUiPrefs, activeSite?.id);
}

function syncLauncherPrefsFromStorage(raw) {
  const launcherPrefs = readAiPagePromptLauncherPrefs(raw);
  cachedUiPrefs = {
    ...(raw && typeof raw === "object" ? raw : {}),
    ...launcherPrefs,
  };
}

function installStorageListener() {
  if (storageListenerInstalled) return;
  storageListenerInstalled = true;
  try {
    chrome.storage.onChanged.addListener(onStorageChanged);
  } catch (_e) {
    /* unavailable */
  }
}

export function initInputPromptLauncher() {
  if (window.top !== window) return;
  if (isInsideQshotCompareEmbed()) return;

  installStorageListener();

  resolveLauncherSite()
    .then((site) => {
      if (!site) return null;
      activeSite = buildSiteConfig(site);
      return primeCache();
    })
    .then(async () => {
      if (!activeSite) return;
      await applyLauncherVisibility();
    })
    .catch(() => {});
}

async function applyLauncherVisibility() {
  if (!isAiPageLauncherEnabled()) {
    hideAll();
    stopTracking();
    return;
  }
  ensureUi();
  ensureFabDrag();
  await fabDrag.load();
  startTracking();
  refreshAnchor();
}

function isPointerOverPreviewCard(clientX, clientY) {
  if (!shadow) return false;
  const shell = shadow.querySelector(".qshot-preview-shell:not([hidden])");
  if (!shell) return false;
  const rect = shell.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

function ensureUi() {
  if (hostEl) return;
  hostEl = document.createElement("qshot-host");
  hostEl.id = HOST_ID;
  hostEl.setAttribute("data-qshot", "input-prompt-launcher");
  shadow = hostEl.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent =
    LAUNCHER_SHELL_CSS + PROMPT_PICKER_STYLES + (window.PromptItemUI?.PREVIEW_CSS ?? "");
  shadow.appendChild(style);

  root = document.createElement("section");
  root.className = "root hidden";

  backdrop = document.createElement("div");
  backdrop.className = "launcher-backdrop";
  backdrop.addEventListener("pointerdown", (e) => {
    if (e.target !== backdrop) return;
    e.stopPropagation();
    closePanel();
  });

  fab = document.createElement("button");
  fab.type = "button";
  fab.className = "fab";
  fab.title = "Qshot \u63d0\u793a\u8bcd\uff08\u957f\u6309\u62d6\u52a8\uff09";
  fab.setAttribute("aria-label", "Qshot \u63d0\u793a\u8bcd");
  fab.innerHTML = Q_SVG;
  fab.addEventListener("click", (e) => {
    e.stopPropagation();
    if (fabDrag?.consumeSuppressClick()) return;
    togglePanel();
  });

  panelShell = document.createElement("div");
  panelShell.className = "launcher-picker-shell";
  panelShell.hidden = true;

  panel = document.createElement("section");
  panel.className = "prompt-picker launcher-picker";
  panel.hidden = true;
  groupsCol = document.createElement("section");
  groupsCol.className = "prompt-groups-col";
  listCol = document.createElement("section");
  listCol.className = "prompt-list-col";
  panelFooter = document.createElement("section");
  panelFooter.className = "prompt-picker-footer";
  panel.appendChild(groupsCol);
  panel.appendChild(listCol);
  panel.appendChild(panelFooter);
  panel.addEventListener("pointerdown", (e) => e.stopPropagation());
  panelShell.appendChild(panel);

  root.appendChild(backdrop);
  root.appendChild(fab);
  root.appendChild(panelShell);
  shadow.appendChild(root);
  document.documentElement.appendChild(hostEl);

  previewMgr = window.PromptItemUI?.createPreviewManager(shadow) || null;
  ensureFabDrag();
  if (panel && !panelTilt) {
    panelTilt = attachLauncherPanelTilt(panel, () => panelOpen, {
      yieldsTo: isPointerOverPreviewCard,
    });
  }
  installPanelInteraction(panel, {
    isOpen: () => panelOpen,
    onApplyPrompt: applyPromptAndDismiss,
  });
  window.addEventListener("resize", scheduleReposition, { passive: true });
  window.addEventListener("scroll", scheduleReposition, { passive: true, capture: true });
}

function onStorageChanged(changes, area) {
  if (area !== "local") return;
  if (changes[UI_PREFS_STORAGE_KEY]) {
    syncLauncherPrefsFromStorage(changes[UI_PREFS_STORAGE_KEY].newValue);
    if (!activeSite) return;
    applyLauncherVisibility().catch(() => {});
  }
  if (changes[PROMPT_GROUPS_STORAGE_KEY]) {
    cachedPromptGroups = normalizePromptGroups(changes[PROMPT_GROUPS_STORAGE_KEY].newValue);
    if (panelOpen) renderPanel();
  }
}

function startTracking() {
  if (trackTimer) return;
  trackTimer = window.setInterval(refreshAnchor, 400);
  if (observer) return;
  observer = new MutationObserver(() => refreshAnchor());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function stopTracking() {
  if (trackTimer) {
    clearInterval(trackTimer);
    trackTimer = 0;
  }
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function refreshAnchor() {
  if (!isAiPageLauncherEnabled()) {
    hideAll();
    return;
  }
  if (!hostEl) return;

  const input = findInput();
  if (!input) {
    hideAll();
    return;
  }

  boundInput = input;
  root.classList.remove("hidden");
  scheduleReposition();
}

function findInput() {
  return findLauncherInput(activeSite?.inputSelectors);
}

function findAnchorRect(input) {
  const anchors = activeSite?.anchorSelectors || DEFAULT_ANCHOR_SELECTORS;
  for (const sel of anchors) {
    const container = input.closest(sel) || document.querySelector(sel);
    if (container && isVisible(container)) {
      const rect = container.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 20) return rect;
    }
  }
  return input.getBoundingClientRect();
}

function isVisible(el) {
  if (!(el instanceof Element)) return false;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
}

function scheduleReposition() {
  if (positionRaf) return;
  positionRaf = requestAnimationFrame(() => {
    positionRaf = 0;
    reposition();
  });
}

function ensureFabDrag() {
  if (fabDrag || !fab || !root) return;
  if (!fabSpinFx) {
    fabSpinFx = createLauncherSpinFx({ host: root, fab, iconSize: ICON_SIZE });
  }
  fabDrag = createLauncherFabDrag({
    fab,
    iconSize: ICON_SIZE,
    getSiteId: () => activeSite?.id || "",
    spinFx: fabSpinFx,
    onMove: (left, top, edge) => {
      applyFabPosition(left, top, edge);
      positionPanelNearFab(left, top, edge);
    },
  });
  fabDrag.install({ onClosePanel: () => closePanel() });
}

function applyFabPosition(left, top, edge) {
  if (!fab) return;
  fab.style.left = `${left}px`;
  fab.style.top = `${top}px`;
  fab.classList.toggle("edge-left", edge === "left");
  fab.classList.toggle("edge-right", edge === "right");
}

function positionPanelNearFab(left, top, edge) {
  if (!panelOpen || !panelShell) return;
  const panelH = PANEL_HEIGHT_PX;
  const panelW = panel?.offsetWidth || 256;

  let panelTop = top - panelH - 8;
  if (panelTop < 8) {
    panelTop = top + ICON_SIZE + 8;
  }
  panelTop = Math.max(8, Math.min(panelTop, window.innerHeight - panelH - 8));

  let panelLeft;
  if (edge === "left") {
    panelLeft = ICON_SIZE - Math.round(ICON_SIZE / 2) + 8;
  } else if (edge === "right") {
    panelLeft = window.innerWidth - Math.round(ICON_SIZE / 2) - panelW - 8;
  } else {
    panelLeft = Math.min(
      Math.max(8, left - panelW + ICON_SIZE),
      window.innerWidth - panelW - 8
    );
  }
  panelShell.style.left = `${panelLeft}px`;
  panelShell.style.top = `${panelTop}px`;
}

function reposition() {
  if (!fab || !boundInput || root.classList.contains("hidden")) return;
  if (fabDrag?.isDragging()) return;

  const pinned = fabDrag?.getPinned();
  let left;
  let top;
  let edge = null;
  if (pinned) {
    left = pinned.left;
    top = pinned.top;
    edge = pinned.edge || null;
  } else {
    const rect = findAnchorRect(boundInput);
    left = Math.min(rect.right - ICON_SIZE - 4, window.innerWidth - ICON_SIZE - 8);
    top = Math.max(8, rect.top - ICON_SIZE - GAP_ABOVE);
    left = Math.max(8, left);
  }
  applyFabPosition(left, top, edge);
  positionPanelNearFab(left, top, edge);
}

function togglePanel() {
  if (panelOpen) closePanel();
  else openPanel();
}

function openPanel() {
  panelOpen = true;
  syncPanelVisible(true);
  renderPanel();
  scheduleReposition();
}

function closePanel() {
  if (!panelOpen) return;
  panelOpen = false;
  syncPanelVisible(false);
  if (previewMgr) previewMgr.hide();
  scheduleReposition();
}

function syncPanelVisible(open) {
  if (fab) fab.classList.toggle("open", open);
  if (backdrop) backdrop.classList.toggle("visible", open);
  if (panelShell) {
    panelShell.hidden = !open;
    panelShell.classList.toggle("open", open);
  }
  if (panel) {
    panel.hidden = !open;
    panel.classList.toggle("open", open);
  }
  if (panelTilt) {
    if (open) panelTilt.enable();
    else panelTilt.disable();
  }
}

function hideAll() {
  closePanel();
  if (root) root.classList.add("hidden");
  boundInput = null;
}

async function saveEditedPrompt(prompt, newTitle, newContent) {
  try {
    const data = await chrome.storage.local.get(PROMPT_GROUPS_STORAGE_KEY);
    const groups = data[PROMPT_GROUPS_STORAGE_KEY];
    if (!Array.isArray(groups)) return;
    for (const group of groups) {
      if (!Array.isArray(group.prompts)) continue;
      const p = group.prompts.find((item) => item.id === prompt.id);
      if (p) {
        if (newTitle) p.title = newTitle;
        p.content = newContent;
        chrome.storage.local.set({ [PROMPT_GROUPS_STORAGE_KEY]: groups }).catch(() => {});
        break;
      }
    }
  } catch (_) {}
}

function renderPanel() {
  renderLauncherPromptPanel({
    groupsCol,
    listCol,
    panelFooter,
    shadow,
    promptGroups: cachedPromptGroups,
    activeGroupId,
    setActiveGroupId: (id) => { activeGroupId = id; },
    previewMgr,
    setPreviewMgr: (mgr) => { previewMgr = mgr; },
    onApplyPrompt: applyPromptAndDismiss,
    onClosePanel: closePanel,
    onSaveEdit: saveEditedPrompt,
    rerender: renderPanel,
  });
}

function applyPromptAndDismiss(text) {
  if (applyDismissLock) return;
  applyDismissLock = true;
  fillPrompt(text);
  closePanel();
  requestAnimationFrame(() => {
    applyDismissLock = false;
  });
}

function fillPrompt(text) {
  const input = boundInput || findInput();
  if (!input) return;
  safeFocus(input);
  const value = String(text || "");
  const inputType = detectInputType(input);
  if (inputType === "contenteditable" || (!isTextControl(input) && input.isContentEditable)) {
    setContenteditableValue(input, value, true);
    return;
  }
  if (isTextControl(input)) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const before = input.value.slice(0, start);
    const after = input.value.slice(end);
    setNativeValue(input, before + value + after);
    dispatchEventList(input, ["input", "change"]);
    try { input.setSelectionRange(before.length + value.length, before.length + value.length); } catch (_) {}
  }
}

async function primeCache() {
  if (cachePromise) return cachePromise;
  cachePromise = chrome.storage.local
    .get([UI_PREFS_STORAGE_KEY, PROMPT_GROUPS_STORAGE_KEY])
    .then((stored) => {
      syncLauncherPrefsFromStorage(stored[UI_PREFS_STORAGE_KEY]);
      cachedPromptGroups = normalizePromptGroups(stored[PROMPT_GROUPS_STORAGE_KEY]);
    })
    .catch(() => {
      cachedUiPrefs = readAiPagePromptLauncherPrefs(null);
      cachedPromptGroups = [];
    });
  return cachePromise;
}
