import { state, elements } from "./state.js";
import { getSelectedSites } from "./utils.js";
import {
  setGlobalStatus,
  updateSendBtnState,
} from "./status.js";
import {
  activateScrollGuard,
  getScrollGuardDurationMs,
  updateScrollEdgeBtns,
  updateHScrollStrip,
  updateLayoutUi,
  renderSiteNav,
} from "./layout.js";
import { refreshSiteCard } from "./cards-render.js";
import { handleSendSelected } from "./send.js";
import {
  clearAllHistory,
  toggleHistoryPanel,
  closeHistoryPanel,
  bindHistoryFilterEvents,
} from "./history.js";
import {
  togglePromptPicker,
  closePromptPicker,
} from "./prompts.js";
import {
  toggleAddSitePicker,
  closeAddSitePicker,
} from "./add-site.js";
import { showExportModal } from "./export.js";
import { showAiSummaryModal } from "./ai-summary.js";
import { savePreferences } from "./main-preferences.js";

function closeLeftToolsPanel() {
  elements.leftToolsPanel?.setAttribute("hidden", "");
  elements.leftToolsToggleBtn?.setAttribute("aria-expanded", "false");
  closeQuickLayoutPopover();
}

function restoreLayoutPopoverHome() {
  if (!elements.layoutPopover || !elements.layoutPopoverHome) return;
  if (elements.layoutPopover.parentElement !== elements.layoutPopoverHome) {
    elements.layoutPopoverHome.appendChild(elements.layoutPopover);
  }
  elements.layoutPopover.classList.remove("layout-popover--quick");
  elements.layoutPopover.style.left = "";
  elements.layoutPopover.style.top = "";
}

function closeQuickLayoutPopover() {
  if (!elements.layoutPopover) return;
  restoreLayoutPopoverHome();
  elements.layoutPopover.setAttribute("hidden", "");
}

function openQuickLayoutPopover() {
  if (!elements.layoutPopover || !elements.quickLayoutBtn) return;

  const isQuickOpen =
    elements.layoutPopover.classList.contains("layout-popover--quick") &&
    !elements.layoutPopover.hasAttribute("hidden");
  if (isQuickOpen) {
    closeQuickLayoutPopover();
    return;
  }

  elements.leftToolsPanel?.setAttribute("hidden", "");
  elements.leftToolsToggleBtn?.setAttribute("aria-expanded", "false");
  document.body.appendChild(elements.layoutPopover);
  elements.layoutPopover.classList.add("layout-popover--quick");
  elements.layoutPopover.removeAttribute("hidden");

  const buttonRect = elements.quickLayoutBtn.getBoundingClientRect();
  const popoverRect = elements.layoutPopover.getBoundingClientRect();
  const left = Math.min(
    Math.max(8, buttonRect.left),
    window.innerWidth - popoverRect.width - 8
  );
  const top = Math.max(8, buttonRect.top - popoverRect.height - 10);
  elements.layoutPopover.style.left = `${left}px`;
  elements.layoutPopover.style.top = `${top}px`;
}

function bindQuickAction(button, action) {
  button?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  });
  button?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  button?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    action();
  });
}

function openSettingsPage() {
  try {
    chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE" });
  } catch (_error) {
    window.open(chrome.runtime.getURL("settings/settings.html"), "_blank", "noopener,noreferrer");
  }
}

export function bindComparePageEvents() {
  elements.sendSelectedBtn.addEventListener("click", handleSendSelected);
  elements.promptAssistBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePromptPicker();
  });
  elements.queryInput.addEventListener("input", () => {
    closePromptPicker();
    updateSendBtnState();
  });
  elements.queryInput.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    if (event.isComposing || event.keyCode === 229) {
      return;
    }

    event.preventDefault();
    await handleSendSelected();
  });
  elements.aiSummaryBtn?.addEventListener("click", () => {
    closeLeftToolsPanel();
    showAiSummaryModal();
  });
  elements.exportBtn.addEventListener("click", () => {
    closeLeftToolsPanel();
    showExportModal();
  });
  elements.historyToggleBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    closeLeftToolsPanel();
    toggleHistoryPanel();
  });
  elements.closeHistoryPanelBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    closeHistoryPanel();
  });
  document.addEventListener("click", (event) => {
    if (
      elements.historyPanel.classList.contains("is-open") &&
      !elements.historyPanel.contains(event.target) &&
      !elements.historyToggleBtn.contains(event.target)
    ) {
      closeHistoryPanel();
    }
  });
  elements.clearHistoryBtn?.addEventListener("click", async () => {
    if (state.searchHistory.length === 0) {
      return;
    }
    await clearAllHistory();
  });
  bindHistoryFilterEvents();
  bindQuickAction(elements.quickExportBtn, () => {
    elements.exportBtn?.click();
  });
  bindQuickAction(elements.quickHistoryBtn, () => {
    elements.historyToggleBtn?.click();
  });
  bindQuickAction(elements.quickAiSummaryBtn, () => {
    elements.aiSummaryBtn?.click();
  });
  bindQuickAction(elements.quickLayoutBtn, () => {
    openQuickLayoutPopover();
  });
  bindQuickAction(elements.settingsBtn, openSettingsPage);
  elements.leftToolsToggleBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = !elements.leftToolsPanel?.hasAttribute("hidden");
    if (isOpen) {
      closeLeftToolsPanel();
    } else {
      elements.leftToolsPanel?.removeAttribute("hidden");
      elements.leftToolsToggleBtn?.setAttribute("aria-expanded", "true");
    }
  });

  document.addEventListener("click", (event) => {
    if (!elements.leftToolsPanel || elements.leftToolsPanel.hasAttribute("hidden")) return;
    if (elements.leftToolsToggleBtn?.contains(event.target)) return;
    if (elements.leftToolsPanel.contains(event.target)) return;
    closeLeftToolsPanel();
  });

  elements.layoutToggleBtn.addEventListener("click", () => {
    restoreLayoutPopoverHome();
    const isHidden = elements.layoutPopover.hasAttribute("hidden");
    if (isHidden) {
      elements.layoutPopover.removeAttribute("hidden");
    } else {
      elements.layoutPopover.setAttribute("hidden", "");
    }
  });

  elements.layoutRowsButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      state.layoutRows = Number(button.dataset.layoutRows);
      state.layoutMode = "grid";
      updateLayoutUi();
      await savePreferences();
    });
  });

  elements.cardSizeSlider?.addEventListener("input", async () => {
    state.cardSizeLevel = elements.cardSizeSlider.value;
    updateLayoutUi();
    await savePreferences();
  });

  elements.sidebarLayoutBtn?.addEventListener("click", async () => {
    if (state.layoutMode === "sidebar") {
      state.layoutMode = "grid";
    } else {
      state.layoutMode = "sidebar";
      const firstSite = getSelectedSites()[0];
      if (!state.activeSidebarSiteId || !state.cardRefs.has(state.activeSidebarSiteId)) {
        state.activeSidebarSiteId = firstSite?.id || null;
      }
      state.cardRefs.forEach((ref, siteId) => {
        if (ref.cardEl) ref.cardEl.hidden = siteId !== state.activeSidebarSiteId;
      });
      renderSiteNav();
    }
    updateLayoutUi();
    await savePreferences();
    closeQuickLayoutPopover();
  });

  document.addEventListener("click", (event) => {
    if (!elements.layoutPopover || elements.layoutPopover.hasAttribute("hidden")) {
      return;
    }

    const insidePopover = elements.layoutPopover.contains(event.target);
    const insideToggle = elements.layoutToggleBtn.contains(event.target);
    const insideQuickToggle = elements.quickLayoutBtn?.contains(event.target);
    if (!insidePopover && !insideToggle && !insideQuickToggle) {
      closeQuickLayoutPopover();
    }
  });

  elements.iframesContainer.addEventListener("wheel", () => {
    state.userIsScrolling = true;
    clearTimeout(state.userScrollTimer);
    state.userScrollTimer = setTimeout(() => {
      state.userIsScrolling = false;
      state.userScrollTimer = null;
      if (state.scrollGuardActive) {
        state.scrollGuardLeft = elements.iframesContainer.scrollLeft;
        state.scrollGuardTop = elements.iframesContainer.scrollTop;
      }
    }, 400);
  }, { passive: true });

  elements.iframesContainer.addEventListener("pointerdown", () => {
    state.userIsScrolling = true;
  }, { passive: true });

  window.addEventListener("pointerup", () => {
    if (state.userIsScrolling) {
      state.userIsScrolling = false;
      if (state.scrollGuardActive) {
        state.scrollGuardLeft = elements.iframesContainer.scrollLeft;
        state.scrollGuardTop = elements.iframesContainer.scrollTop;
      }
    }
  }, { passive: true });

  elements.iframesContainer.addEventListener("scroll", () => {
    if (!state.scrollGuardActive || state.userIsScrolling) {
      return;
    }
    const container = elements.iframesContainer;
    if (container.scrollLeft !== state.scrollGuardLeft) {
      container.scrollLeft = state.scrollGuardLeft;
    }
    if (container.scrollTop !== state.scrollGuardTop) {
      container.scrollTop = state.scrollGuardTop;
    }
  }, { passive: true });

  elements.iframesContainer.addEventListener("wheel", (event) => {
    if (state.layoutRows !== 1 || state.layoutMode === "sidebar") {
      return;
    }
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }
    event.preventDefault();
    elements.iframesContainer.scrollLeft += event.deltaY * 1.2;
  }, { passive: false });

  elements.scrollToStartBtn?.addEventListener("click", () => {
    elements.iframesContainer.scrollTo({ left: 0, behavior: "smooth" });
  });

  elements.scrollToEndBtn?.addEventListener("click", () => {
    elements.iframesContainer.scrollTo({ left: elements.iframesContainer.scrollWidth, behavior: "smooth" });
  });

  elements.scrollToTopBtn?.addEventListener("click", () => {
    elements.iframesContainer.scrollTo({ top: 0, behavior: "smooth" });
  });

  elements.scrollToBottomBtn?.addEventListener("click", () => {
    elements.iframesContainer.scrollTo({ top: elements.iframesContainer.scrollHeight, behavior: "smooth" });
  });

  elements.iframesContainer.addEventListener("scroll", updateScrollEdgeBtns, { passive: true });
  elements.cardNavStrip?.addEventListener("scroll", updateHScrollStrip, { passive: true });

  elements.hScrollStrip?.addEventListener("click", (e) => {
    if (e.target === elements.hScrollThumb) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    if (state.layoutMode === "sidebar") {
      const navStrip = elements.cardNavStrip;
      if (!navStrip) return;
      const max = navStrip.scrollWidth - navStrip.clientWidth;
      navStrip.scrollLeft = ratio * max;
      return;
    }

    const c = elements.iframesContainer;
    if (!c) return;
    c.scrollLeft = ratio * (c.scrollWidth - c.clientWidth);
  });

  let _thumbDragging = false;
  let _thumbDragStartX = 0;
  let _thumbDragStartScrollLeft = 0;

  elements.hScrollThumb?.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    _thumbDragging = true;
    _thumbDragStartX = e.clientX;
    _thumbDragStartScrollLeft = state.layoutMode === "sidebar"
      ? (elements.cardNavStrip?.scrollLeft ?? 0)
      : (elements.iframesContainer?.scrollLeft ?? 0);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  });

  elements.hScrollThumb?.addEventListener("pointermove", (e) => {
    if (!_thumbDragging) return;
    const strip = elements.hScrollStrip;
    if (!strip) return;
    const dx = e.clientX - _thumbDragStartX;

    if (state.layoutMode === "sidebar") {
      const navStrip = elements.cardNavStrip;
      if (!navStrip) return;
      const max = navStrip.scrollWidth - navStrip.clientWidth;
      if (max <= 0) return;
      navStrip.scrollTo({
        left: Math.max(0, Math.min(max,
          _thumbDragStartScrollLeft + dx * navStrip.scrollWidth / strip.clientWidth
        )),
        behavior: "instant",
      });
      return;
    }

    const c = elements.iframesContainer;
    if (!c) return;
    const max = c.scrollWidth - c.clientWidth;
    if (max <= 0) return;
    c.scrollTo({
      left: Math.max(0, Math.min(max,
        _thumbDragStartScrollLeft + dx * c.scrollWidth / strip.clientWidth
      )),
      behavior: "instant",
    });
  });

  const _endThumbDrag = () => { _thumbDragging = false; };
  elements.hScrollThumb?.addEventListener("pointerup", _endThumbDrag);
  elements.hScrollThumb?.addEventListener("pointercancel", _endThumbDrag);

  window.addEventListener("resize", () => {
    updateLayoutUi();
  });

  elements.newChatBtn?.addEventListener("click", () => {
    elements.queryInput.value = "";
    updateSendBtnState();

    activateScrollGuard(
      elements.iframesContainer.scrollLeft,
      elements.iframesContainer.scrollTop,
      getScrollGuardDurationMs(state.cardRefs.size)
    );

    state.cardRefs.forEach((ref) => {
      ref.restoreUrl = "";
      refreshSiteCard(ref, { immediate: false });
    });

    state.lastSearchQuery = null;
    state.lastSearchTime = null;
    state.currentHistoryEntryId = null;
    state.historyEntryIdBySiteId.clear();

    setGlobalStatus("已新建对话，所有卡片已重置。");
  });

  elements.addSiteBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleAddSitePicker();
  });

  elements.addSitePopover?.addEventListener("mousedown", (event) => {
    state._addSitePickerMouseInside = elements.addSitePopover.contains(event.target);
  }, true);

  elements.closeAddSitePopoverBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeAddSitePicker();
  });

  document.addEventListener("pointerdown", (event) => {
    if (!state.isAddSitePickerOpen || !elements.addSitePopover) {
      return;
    }
    const insidePopover = elements.addSitePopover.contains(event.target);
    const insideBtn = elements.addSiteBtn?.contains(event.target);
    if (!insidePopover && !insideBtn) {
      closeAddSitePicker();
    }
  }, true);

  document.addEventListener("click", (event) => {
    if (!state.isAddSitePickerOpen || !elements.addSitePopover) {
      return;
    }
    if (state._addSitePickerMouseInside) {
      state._addSitePickerMouseInside = false;
      return;
    }
    const insidePopover = elements.addSitePopover.contains(event.target);
    const insideBtn = elements.addSiteBtn?.contains(event.target);
    if (!insidePopover && !insideBtn) {
      closeAddSitePicker();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.isAddSitePickerOpen) {
      closeAddSitePicker();
    }
  });

  window.addEventListener("blur", () => {
    if (!state.isAddSitePickerOpen) {
      return;
    }
    window.setTimeout(() => {
      if (document.activeElement instanceof HTMLIFrameElement) {
        closeAddSitePicker();
      }
    }, 0);
  });
}
