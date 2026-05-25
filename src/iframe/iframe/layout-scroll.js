/**
 * layout-scroll.js
 * Scroll guard, lock/unlock, and horizontal scroll strip for the compare page.
 */

import { state, elements, BASE_CONFIG } from "./state.js";

export function activateScrollGuard(left, top, durationMs) {
  const container = elements.iframesContainer;

  state.scrollGuardActive = true;
  state.scrollGuardLeft = left;
  state.scrollGuardTop = top;
  container?.classList.add("is-scroll-guarded");
  if (state.scrollGuardTimerId) {
    window.clearTimeout(state.scrollGuardTimerId);
  }

  startScrollGuardLoop();

  state.scrollGuardTimerId = window.setTimeout(() => {
    stopScrollGuard();
  }, Math.max(1000, durationMs | 0));
}

function startScrollGuardLoop() {
  if (state.scrollGuardRafId) {
    return;
  }

  const tick = () => {
    const container = elements.iframesContainer;
    if (!state.scrollGuardActive || !container) {
      state.scrollGuardRafId = null;
      return;
    }

    if (!state.userIsScrolling) {
      if (container.scrollLeft !== state.scrollGuardLeft) {
        container.scrollLeft = state.scrollGuardLeft;
      }
      if (container.scrollTop !== state.scrollGuardTop) {
        container.scrollTop = state.scrollGuardTop;
      }
    }

    state.scrollGuardRafId = window.requestAnimationFrame(tick);
  };

  state.scrollGuardRafId = window.requestAnimationFrame(tick);
}

export function stopScrollGuard() {
  state.scrollGuardActive = false;
  if (state.scrollGuardTimerId) {
    window.clearTimeout(state.scrollGuardTimerId);
    state.scrollGuardTimerId = null;
  }
  if (state.scrollGuardRafId) {
    window.cancelAnimationFrame(state.scrollGuardRafId);
    state.scrollGuardRafId = null;
  }
  elements.iframesContainer?.classList.remove("is-scroll-guarded");
}

export function getScrollGuardDurationMs(cardCount) {
  const staggerMs = (BASE_CONFIG.iframeStaggerMs != null) ? BASE_CONFIG.iframeStaggerMs : 120;
  const base = 3000;
  const extra = Math.max(0, (cardCount | 0) - 1) * staggerMs;
  return Math.min(base + extra + 1500, 8000);
}

export function updateScrollEdgeBtns() {
  const show = state.layoutRows === 1 && state.layoutMode !== "sidebar";
  const c = elements.iframesContainer;
  const canScrollH = c.scrollWidth > c.clientWidth + 2;
  if (elements.scrollToStartBtn) elements.scrollToStartBtn.hidden = !(show && canScrollH);
  if (elements.scrollToEndBtn) elements.scrollToEndBtn.hidden = !(show && canScrollH);

  const showVert = state.layoutRows > 1 && state.layoutMode !== "sidebar";
  const canScrollV = c.scrollHeight > c.clientHeight + 2;
  if (elements.scrollVertGroup) elements.scrollVertGroup.hidden = !(showVert && canScrollV);

  updateHScrollStrip();
}

export function updateHScrollStrip() {
  const strip = elements.hScrollStrip;
  const thumb = elements.hScrollThumb;
  if (!strip || !thumb) return;

  if (state.layoutMode === "sidebar") {
    const navStrip = elements.cardNavStrip;
    if (!navStrip) {
      strip.hidden = true;
      return;
    }
    const canScroll = navStrip.scrollWidth > navStrip.clientWidth + 2;
    strip.hidden = !canScroll;
    if (!strip.hidden) {
      const max = Math.max(1, navStrip.scrollWidth - navStrip.clientWidth);
      const ratio = Math.min(1, navStrip.scrollLeft / max);
      const thumbPct = Math.max(8, Math.min(100, (navStrip.clientWidth / navStrip.scrollWidth) * 100));
      thumb.style.width = thumbPct + "%";
      thumb.style.left = (ratio * (100 - thumbPct)) + "%";
    }
    return;
  }

  const c = elements.iframesContainer;
  if (!c) return;

  const show = state.layoutRows === 1;
  const canScroll = c.scrollWidth > c.clientWidth + 2;
  strip.hidden = !(show && canScroll);

  if (!strip.hidden) {
    const max = Math.max(1, c.scrollWidth - c.clientWidth);
    const ratio = Math.min(1, c.scrollLeft / max);
    const thumbPct = Math.max(8, Math.min(100, (c.clientWidth / c.scrollWidth) * 100));
    thumb.style.width = thumbPct + "%";
    thumb.style.left = (ratio * (100 - thumbPct)) + "%";

    const navStrip = elements.cardNavStrip;
    if (navStrip) {
      const navMax = navStrip.scrollWidth - navStrip.clientWidth;
      if (navMax > 0) {
        navStrip.scrollLeft = ratio * navMax;
      }
    }
  }
}

export function lockContainerScroll() {
  if (!elements.iframesContainer) {
    return;
  }

  if (state.layoutRows === 1) {
    state.lockedScrollLeft = null;
    state.isScrollLocked = false;
    return;
  }

  state.lockedScrollLeft = elements.iframesContainer.scrollLeft;
  state.isScrollLocked = true;
}

export function restoreLockedScrollPosition() {
  if (state.lockedScrollLeft === null || !elements.iframesContainer) {
    return;
  }

  elements.iframesContainer.scrollLeft = state.lockedScrollLeft;
}

export function scheduleScrollUnlock() {
  if (state.scrollUnlockTimerId) {
    window.clearTimeout(state.scrollUnlockTimerId);
  }

  if (state.layoutRows === 1) {
    state.lockedScrollLeft = null;
    state.isScrollLocked = false;
    state.scrollUnlockTimerId = null;
    return;
  }

  state.scrollUnlockTimerId = window.setTimeout(() => {
    state.lockedScrollLeft = null;
    state.isScrollLocked = false;
    state.scrollUnlockTimerId = null;
  }, 2200);
}
