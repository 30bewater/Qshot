/**
 * layout.js — compare page layout orchestration entry point.
 *
 * Sub-modules:
 *   layout-scroll.js    — scroll guard / lock / scroll strip
 *   layout-card-nav.js  — card nav strip, sidebar, drag-reorder
 */

import { state, elements } from "./state.js";
import { updateScrollEdgeBtns } from "./layout-scroll.js";

export {
  activateScrollGuard,
  stopScrollGuard,
  getScrollGuardDurationMs,
  updateScrollEdgeBtns,
  updateHScrollStrip,
  lockContainerScroll,
  restoreLockedScrollPosition,
  scheduleScrollUnlock,
} from "./layout-scroll.js";

export {
  onCardAdded,
  renderSiteNav,
  activateSidebarSite,
  renderCardNavStrip,
  scrollToCard,
  toggleMaximize,
} from "./layout-card-nav.js";

function _updateSliderFill(slider) {
  const pct = ((Number(slider.value) - 1) / 4) * 100;
  slider.style.setProperty("--slider-fill", `${pct}%`);
}

export function updateLayoutUi() {
  const appShell = document.querySelector(".app-shell");

  if (state.layoutMode === "sidebar") {
    appShell?.classList.add("is-sidebar-mode");
    elements.iframesContainer.dataset.layoutRows = "sidebar";
    if (elements.siteNavPanel) elements.siteNavPanel.hidden = false;
    if (elements.cardSizeGroup) elements.cardSizeGroup.hidden = true;
    elements.sidebarLayoutBtn?.classList.add("is-active");
    elements.layoutRowsButtons.forEach((btn) => btn.classList.remove("is-active"));
    updateScrollEdgeBtns();
    return;
  }

  appShell?.classList.remove("is-sidebar-mode");
  if (elements.siteNavPanel) elements.siteNavPanel.hidden = true;
  elements.sidebarLayoutBtn?.classList.remove("is-active");
  state.cardRefs.forEach((ref) => {
    if (ref.cardEl) ref.cardEl.hidden = false;
  });

  const singleRowWidthMap  = { 1: 320, 2: 380, 3: 640, 4: 800, 5: 960 };
  const socialMediaWidthMap = { 1: 440, 2: 560, 3: 760, 4: 880, 5: 960 };

  const level = Number(state.cardSizeLevel) || 3;
  let effectiveWidth    = singleRowWidthMap[level]  || singleRowWidthMap[3];
  const socialMediaWidth = socialMediaWidthMap[level] || socialMediaWidthMap[3];
  const rowHeight = "calc(100vh - 118px)";

  state.lockedScrollLeft = null;
  state.isScrollLocked = false;
  if (state.scrollUnlockTimerId) {
    window.clearTimeout(state.scrollUnlockTimerId);
    state.scrollUnlockTimerId = null;
  }

  elements.iframesContainer.style.setProperty("--effective-card-width", `${effectiveWidth}px`);
  elements.iframesContainer.style.setProperty("--social-media-card-width", `${socialMediaWidth}px`);
  elements.iframesContainer.style.setProperty("--row-height", rowHeight);
  document.documentElement.style.setProperty("--card-width", `${effectiveWidth}px`);
  elements.iframesContainer.dataset.layoutRows = String(state.layoutRows);

  elements.layoutRowsButtons.forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.layoutRows) === state.layoutRows);
  });

  if (elements.cardSizeSlider) {
    elements.cardSizeSlider.value = state.cardSizeLevel;
    _updateSliderFill(elements.cardSizeSlider);
  }

  if (elements.cardSizeGroup) {
    elements.cardSizeGroup.hidden = state.layoutRows !== 1;
  }
  updateScrollEdgeBtns();
}
