/**
 * overlay-mount.js
 * Shadow DOM mount/teardown and composer layout for the Ctrl+Q overlay.
 */

import { state, t } from "./state.js";
import {
  OVERLAY_STYLES,
  LOGO_URL,
  DICE_SVG,
  SPARKLE_SVG,
} from "./constants.js";
import {
  renderGroupsIfOpen,
  runDefaultSearch,
  enterGroupPickMode,
  exitGroupPickMode,
  runGroup,
  enterSitePickMode,
  exitSitePickMode,
  getPickableSites,
  openSiteWithQuery,
  hideGroupTooltip,
} from "./groups-panel.js";
import { renderHistoryIfOpen } from "./history-panel.js";
import { renderPromptPickerIfOpen, fillRandomQuestion } from "./prompts-panel.js";

let _darkModeMediaListener = null;

function resolveIsDark(mode) {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyOverlayDarkMode(mode) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  if (_darkModeMediaListener) {
    mq.removeEventListener("change", _darkModeMediaListener);
    _darkModeMediaListener = null;
  }
  if (!state.shadowRoot) return;
  const panel = state.shadowRoot.querySelector(".panel");
  const logo  = state.shadowRoot.querySelector(".title-logo");
  const isDark = resolveIsDark(mode);
  panel?.classList.toggle("dark", isDark);
  logo?.classList.toggle("dark", isDark);
  if (mode === "auto") {
    _darkModeMediaListener = (e) => {
      const p = state.shadowRoot?.querySelector(".panel");
      const l = state.shadowRoot?.querySelector(".title-logo");
      p?.classList.toggle("dark", e.matches);
      l?.classList.toggle("dark", e.matches);
    };
    mq.addEventListener("change", _darkModeMediaListener);
  }
}

export function closeOverlay() {
  if (!state.isOpen) return;
  state.isPromptPickerOpen = false;
  state.isGroupPickMode = false;
  state.isSitePickMode = false;
  hideGroupTooltip();
  if (state.overlayPreviewMgr) {
    state.overlayPreviewMgr.destroy();
    state.overlayPreviewMgr = null;
  }
  if (state.hostEl && state.hostEl.parentNode) {
    state.hostEl.parentNode.removeChild(state.hostEl);
  }
  state.hostEl = null;
  state.shadowRoot = null;
  state.isOpen = false;
}

export function mountOverlay() {
  state.hostEl = document.createElement("div");
  state.hostEl.id = "qshot-search-overlay-host";
  state.hostEl.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483646;";
  state.shadowRoot = state.hostEl.attachShadow({ mode: "closed" });

  const styleEl = document.createElement("style");
  styleEl.textContent = OVERLAY_STYLES;
  state.shadowRoot.appendChild(styleEl);

  const backdrop = document.createElement("div");
  backdrop.className = "backdrop";
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) closeOverlay();
  });

  const panel = document.createElement("div");
  panel.className = "panel" + (resolveIsDark(state.uiPrefs.darkMode) ? " dark" : "");
  panel.addEventListener("mousedown", (event) => {
    const target = event.target;
    if (target instanceof Element) {
      if (!target.closest(".prompt-picker") && !target.closest(".icon-btn.sparkle")) {
        if (state.isPromptPickerOpen) {
          state.isPromptPickerOpen = false;
          renderPromptPickerIfOpen();
        }
      }
    }
  });

  const header = document.createElement("header");
  header.className = "header";
  const logo = document.createElement("img");
  logo.className = "title-logo" + (resolveIsDark(state.uiPrefs.darkMode) ? " dark" : "");
  logo.alt = "Qshot";
  logo.src = LOGO_URL;
  logo.addEventListener("error", () => {
    logo.style.display = "none";
  });
  header.appendChild(logo);
  panel.appendChild(header);

  const composer = document.createElement("section");
  composer.className = "composer";

  const queryInput = document.createElement("textarea");
  queryInput.className = "query-input";
  queryInput.rows = 1;
  queryInput.placeholder = t("popup_queryPlaceholder", null, "输入你要搜索的");
  composer.appendChild(queryInput);

  const actionsRow = document.createElement("div");
  actionsRow.className = "actions-row";

  const diceBtn = document.createElement("button");
  diceBtn.type = "button";
  diceBtn.className = "icon-btn dice";
  diceBtn.setAttribute("aria-label", t("popup_randomQuestion", null, "随机问题"));
  diceBtn.innerHTML = DICE_SVG;
  diceBtn.addEventListener("click", () => {
    state.isPromptPickerOpen = false;
    renderPromptPickerIfOpen();
    fillRandomQuestion();
  });

  const sparkleBtn = document.createElement("button");
  sparkleBtn.type = "button";
  sparkleBtn.className = "icon-btn sparkle";
  sparkleBtn.setAttribute("aria-label", t("popup_promptEntry", null, "提示词"));
  sparkleBtn.innerHTML = SPARKLE_SVG;
  sparkleBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    state.isPromptPickerOpen = !state.isPromptPickerOpen;
    renderPromptPickerIfOpen();
  });

  actionsRow.appendChild(diceBtn);
  actionsRow.appendChild(sparkleBtn);
  composer.appendChild(actionsRow);

  const promptPicker = document.createElement("div");
  promptPicker.className = "prompt-picker";
  promptPicker.hidden = true;
  composer.appendChild(promptPicker);

  panel.appendChild(composer);

  const settingsCornerBtn = document.createElement("button");
  settingsCornerBtn.type = "button";
  settingsCornerBtn.className = "settings-corner-btn";
  settingsCornerBtn.setAttribute("aria-label", t("popup_settings", null, "设置"));
  settingsCornerBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>`;
  settingsCornerBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE" }).catch(() => {});
    closeOverlay();
  });
  panel.appendChild(settingsCornerBtn);

  const groupsContainer = document.createElement("div");
  groupsContainer.className = "groups";
  panel.appendChild(groupsContainer);

  const groupTooltip = document.createElement("div");
  groupTooltip.className = "group-tooltip";
  groupTooltip.addEventListener("mouseenter", () => {
    if (state.groupTooltipHideTimer) {
      clearTimeout(state.groupTooltipHideTimer);
      state.groupTooltipHideTimer = null;
    }
  });
  groupTooltip.addEventListener("mouseleave", () => {
    if (state.groupTooltipHideTimer) clearTimeout(state.groupTooltipHideTimer);
    state.groupTooltipHideTimer = setTimeout(() => {
      const tooltip = state.shadowRoot?.querySelector(".group-tooltip");
      if (tooltip instanceof HTMLElement) tooltip.style.display = "none";
    }, 180);
  });
  panel.appendChild(groupTooltip);

  const historySection = document.createElement("section");
  historySection.className = "history-section";
  historySection.setAttribute("aria-labelledby", "qshotOverlayHistoryTitle");

  const historyDivider = document.createElement("div");
  historyDivider.className = "section-divider";
  const historyTitle = document.createElement("span");
  historyTitle.id = "qshotOverlayHistoryTitle";
  historyTitle.className = "section-divider-label";
  historyTitle.textContent = t("popup_historySearch", null, "历史搜索");
  historyDivider.appendChild(historyTitle);

  const historyList = document.createElement("div");
  historyList.className = "history-list";

  historySection.appendChild(historyDivider);
  historySection.appendChild(historyList);
  panel.appendChild(historySection);

  const panelWrap = document.createElement("div");
  panelWrap.className = "panel-wrap";
  panelWrap.appendChild(panel);

  const hintRow = document.createElement("div");
  hintRow.className = "hint-row";
  hintRow.innerHTML = `<span><span class="kbd">Enter</span> ${t("overlay_hintSearch", null, "搜索")} · <span class="kbd">Esc</span> ${t("common_close", null, "关闭")}</span>`;
  panelWrap.appendChild(hintRow);

  backdrop.appendChild(panelWrap);
  state.shadowRoot.appendChild(backdrop);

  document.documentElement.appendChild(state.hostEl);

  applyOverlayDarkMode(state.uiPrefs.darkMode);

  let spaceCount = 0;
  let lastSpaceTime = 0;

  queryInput.addEventListener("keydown", async (event) => {
    if (state.isSitePickMode) {
      if (event.key >= "1" && event.key <= "9" && !event.isComposing) {
        event.preventDefault();
        const sites = getPickableSites();
        const site = sites[parseInt(event.key, 10) - 1];
        state.isSitePickMode = false;
        if (site) await openSiteWithQuery(site);
        return;
      }
      if (event.key === "Escape") {
        exitSitePickMode();
        return;
      }
      if (event.key !== " ") {
        exitSitePickMode();
        spaceCount = 0;
        lastSpaceTime = 0;
      }
    }

    if (state.isGroupPickMode) {
      if (event.key >= "1" && event.key <= "9" && !event.isComposing) {
        event.preventDefault();
        const idx = parseInt(event.key, 10);
        const group = state.groups[idx - 1];
        exitGroupPickMode();
        if (group) await runGroup(group);
        return;
      }
      if (event.key === "Escape") {
        exitGroupPickMode();
        return;
      }
      if (event.key !== " ") {
        exitGroupPickMode();
        spaceCount = 0;
        lastSpaceTime = 0;
      }
    }

    if (
      event.key === " " &&
      !event.isComposing &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      const now = Date.now();
      if (now - lastSpaceTime <= 400) {
        spaceCount++;
      } else {
        spaceCount = 1;
      }
      lastSpaceTime = now;

      if (spaceCount === 2 && state.groups.length > 0 && !state.isSitePickMode) {
        event.preventDefault();
        const pos = queryInput.selectionStart ?? 0;
        if (pos > 0 && queryInput.value[pos - 1] === " ") {
          queryInput.value = queryInput.value.slice(0, pos - 1) + queryInput.value.slice(pos);
          queryInput.setSelectionRange(pos - 1, pos - 1);
          queryInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (!state.isGroupPickMode) enterGroupPickMode();
        return;
      }

      if (spaceCount === 3) {
        event.preventDefault();
        if (state.isGroupPickMode) exitGroupPickMode();
        spaceCount = 0;
        lastSpaceTime = 0;
        enterSitePickMode();
        return;
      }
    } else if (
      event.key !== "Shift" &&
      event.key !== "Control" &&
      event.key !== "Alt" &&
      event.key !== "Meta"
    ) {
      spaceCount = 0;
      lastSpaceTime = 0;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (state.isPromptPickerOpen) {
        state.isPromptPickerOpen = false;
        renderPromptPickerIfOpen();
        return;
      }
      closeOverlay();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await runDefaultSearch();
    }
  });

  queryInput.addEventListener("input", syncComposerLayout);
  queryInput.addEventListener("mouseup", syncComposerLayout);
  queryInput.addEventListener("keyup", syncComposerLayout);

  backdrop.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeOverlay();
    }
  });

  applyUiPrefs();
  renderGroupsIfOpen();
  renderHistoryIfOpen();
  renderPromptPickerIfOpen();
  syncComposerLayout();

  setTimeout(() => queryInput.focus(), 0);
}

export function applyUiPrefs() {
  if (!state.shadowRoot) return;
  applyOverlayDarkMode(state.uiPrefs.darkMode);
  const diceBtn = state.shadowRoot.querySelector(".icon-btn.dice");
  const sparkleBtn = state.shadowRoot.querySelector(".icon-btn.sparkle");
  const actionsRow = state.shadowRoot.querySelector(".actions-row");
  const historySection = state.shadowRoot.querySelector(".history-section");
  if (diceBtn) {
    diceBtn.style.display = state.uiPrefs.showRandomButton === false ? "none" : "inline-flex";
  }
  if (sparkleBtn) {
    sparkleBtn.style.display = state.uiPrefs.showPromptButton === false ? "none" : "inline-flex";
  }
  if (actionsRow) {
    const hasVisible =
      state.uiPrefs.showRandomButton !== false || state.uiPrefs.showPromptButton !== false;
    actionsRow.style.display = hasVisible ? "flex" : "none";
  }
  if (historySection instanceof HTMLElement) {
    historySection.hidden = state.uiPrefs.showHistory === false;
    historySection.style.display = state.uiPrefs.showHistory === false ? "none" : "block";
  }
}

export function syncComposerLayout() {
  if (!state.shadowRoot) return;
  const composer = state.shadowRoot.querySelector(".composer");
  const queryInput = state.shadowRoot.querySelector(".query-input");
  if (!composer || !queryInput) return;

  composer.classList.remove("is-mid-expanded", "is-expanded");
  queryInput.style.height = "0px";
  const scrollH = queryInput.scrollHeight;
  const lineHeight = parseFloat(getComputedStyle(queryInput).lineHeight || "20");
  queryInput.style.height = "";
  const shouldExpand = scrollH > lineHeight * 2.7;
  const shouldMidExpand = !shouldExpand && scrollH > lineHeight * 1.7;
  composer.classList.toggle("is-mid-expanded", shouldMidExpand);
  composer.classList.toggle("is-expanded", shouldExpand);
}
