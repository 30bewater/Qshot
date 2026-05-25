/**
 * layout-card-nav.js
 * Card navigation strip, sidebar site nav, drag-reorder, scroll-to-card.
 */

import { state, elements } from "./state.js";
import { getSelectedSites, escapeHtml } from "./utils.js";
import { setGlobalStatus } from "./status.js";
import { updateHScrollStrip } from "./layout-scroll.js";

function _getSortedCardEls(container) {
  const children = Array.from(container.querySelectorAll(".iframe-card"));
  return children.slice().sort((a, b) => {
    const oa = a.style.order !== "" ? parseInt(a.style.order, 10) : 0;
    const ob = b.style.order !== "" ? parseInt(b.style.order, 10) : 0;
    if (oa !== ob) return oa - ob;
    return children.indexOf(a) - children.indexOf(b);
  });
}

export function onCardAdded(cardEl) {
  const container = elements.iframesContainer;
  if (!container) return;
  const others = Array.from(container.querySelectorAll(".iframe-card")).filter((el) => el !== cardEl);
  let maxOrder = -Infinity;
  let hasExplicit = false;
  others.forEach((el) => {
    if (el.style.order !== "") {
      hasExplicit = true;
      const o = parseInt(el.style.order, 10);
      if (!isNaN(o) && o > maxOrder) maxOrder = o;
    }
  });
  if (hasExplicit) {
    cardEl.style.order = String(isFinite(maxOrder) ? maxOrder + 1 : 0);
  }
}

export function renderSiteNav() {
  if (!elements.siteNavList) return;
  elements.siteNavList.innerHTML = "";
  const cardEls = _getSortedCardEls(elements.iframesContainer);
  const selectedSites = cardEls
    .map((el) => state.cardRefs.get(el.dataset.siteId)?.site)
    .filter(Boolean);
  selectedSites.forEach((site) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "site-nav-item" + (site.id === state.activeSidebarSiteId ? " is-active" : "");
    btn.dataset.siteId = site.id;
    btn.innerHTML = `<span class="site-nav-item-indicator"></span><span>${escapeHtml(site.name)}</span>`;
    btn.addEventListener("click", () => activateSidebarSite(site.id));
    elements.siteNavList.appendChild(btn);
  });
}

export function activateSidebarSite(siteId) {
  state.activeSidebarSiteId = siteId;
  state.cardRefs.forEach((ref, id) => {
    if (ref.cardEl) ref.cardEl.hidden = id !== siteId;
  });
  if (elements.siteNavList) {
    elements.siteNavList.querySelectorAll(".site-nav-item").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.siteId === siteId);
    });
  }
  if (elements.cardNavStrip) {
    elements.cardNavStrip.querySelectorAll(".card-nav-chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.siteId === siteId);
    });
    if (state.layoutMode === "sidebar") {
      const activeChip = elements.cardNavStrip.querySelector(`.card-nav-chip[data-site-id="${siteId}"]`);
      if (activeChip) {
        const strip = elements.cardNavStrip;
        const chipCenter = activeChip.offsetLeft + activeChip.offsetWidth / 2;
        strip.scrollTo({ left: chipCenter - strip.clientWidth / 2, behavior: "smooth" });
      }
    }
  }
}

export function renderCardNavStrip() {
  const strip = elements.cardNavStrip;
  if (!strip) return;

  strip.innerHTML = "";

  const cardEls = _getSortedCardEls(elements.iframesContainer);
  const visibleSites = cardEls
    .map((el) => state.cardRefs.get(el.dataset.siteId)?.site)
    .filter(Boolean);

  const isSidebar = state.layoutMode === "sidebar";
  if (!isSidebar && visibleSites.length <= 1) {
    return;
  }

  visibleSites.forEach((site) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "card-nav-chip" + (isSidebar && site.id === state.activeSidebarSiteId ? " is-active" : "");
    chip.dataset.siteId = site.id;
    chip.textContent = site.name;
    chip.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!_drag.active) {
        scrollToCard(site.id);
      }
    });
    _attachChipDrag(chip, site.id);
    strip.appendChild(chip);
  });

  updateHScrollStrip();
}

const _drag = {
  active: false,
  siteId: null,
  chipEl: null,
  ghostEl: null,
  indicatorEl: null,
  targetIndex: -1,
  offsetX: 0,
  offsetY: 0,
};

function _attachChipDrag(chip, siteId) {
  let timer = null;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let moved = false;

  chip.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    moved = false;
    chip.classList.add("is-long-press-pending");
    timer = setTimeout(() => {
      timer = null;
      if (!moved) {
        chip.classList.remove("is-long-press-pending");
        try { chip.setPointerCapture(pointerId); } catch (_) {}
        _startDrag(chip, siteId, e.clientX, e.clientY);
      }
    }, 480);
  });

  chip.addEventListener("pointermove", (e) => {
    if (timer === null) return;
    if (Math.abs(e.clientX - startX) > 6 || Math.abs(e.clientY - startY) > 6) {
      moved = true;
      chip.classList.remove("is-long-press-pending");
      clearTimeout(timer);
      timer = null;
    }
  });

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    chip.classList.remove("is-long-press-pending");
  };
  chip.addEventListener("pointerup", cancel);
  chip.addEventListener("pointercancel", cancel);
}

function _startDrag(chip, siteId, clientX, clientY) {
  _drag.active = true;
  _drag.siteId = siteId;
  _drag.chipEl = chip;
  _drag.targetIndex = -1;

  chip.classList.add("is-drag-source");

  const rect = chip.getBoundingClientRect();
  _drag.offsetX = clientX - rect.left;
  _drag.offsetY = clientY - rect.top;

  const ghost = document.createElement("button");
  ghost.type = "button";
  ghost.className = "card-nav-chip is-drag-ghost";
  ghost.textContent = chip.textContent;
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  document.body.appendChild(ghost);
  _drag.ghostEl = ghost;

  const indicator = document.createElement("div");
  indicator.style.cssText = [
    "position:fixed",
    `top:${rect.top - 2}px`,
    `height:${rect.height + 4}px`,
    "width:3px",
    "border-radius:2px",
    "background:#2563eb",
    "pointer-events:none",
    "z-index:9999",
    "display:none",
    "transform:translateX(-50%)",
  ].join(";");
  document.body.appendChild(indicator);
  _drag.indicatorEl = indicator;

  document.addEventListener("pointermove", _onDragMove);
  document.addEventListener("pointerup", _onDragEnd);
  document.addEventListener("pointercancel", _onDragEnd);
}

function _onDragMove(e) {
  if (!_drag.active) return;

  const ghost = _drag.ghostEl;
  if (ghost) {
    ghost.style.left = `${e.clientX - _drag.offsetX}px`;
    ghost.style.top = `${e.clientY - _drag.offsetY}px`;
  }

  const strip = elements.cardNavStrip;
  const indicator = _drag.indicatorEl;
  if (!strip || !indicator) return;

  const chips = Array.from(strip.querySelectorAll(".card-nav-chip:not(.is-drag-source)"));
  let targetIndex = chips.length;
  let indicatorX = null;

  if (chips.length === 0) {
    targetIndex = 0;
    const stripRect = strip.getBoundingClientRect();
    indicatorX = stripRect.left + 4;
  } else {
    for (let i = 0; i < chips.length; i++) {
      const r = chips[i].getBoundingClientRect();
      if (e.clientX < r.left + r.width / 2) {
        targetIndex = i;
        indicatorX = r.left;
        break;
      }
      if (i === chips.length - 1) {
        targetIndex = chips.length;
        indicatorX = r.right;
      }
    }
  }

  _drag.targetIndex = targetIndex;
  indicator.style.display = "block";
  indicator.style.left = `${indicatorX}px`;
}

function _onDragEnd() {
  document.removeEventListener("pointermove", _onDragMove);
  document.removeEventListener("pointerup", _onDragEnd);
  document.removeEventListener("pointercancel", _onDragEnd);

  if (_drag.ghostEl) { _drag.ghostEl.remove(); _drag.ghostEl = null; }
  if (_drag.indicatorEl) { _drag.indicatorEl.remove(); _drag.indicatorEl = null; }
  if (_drag.chipEl) { _drag.chipEl.classList.remove("is-drag-source"); }

  const { siteId, targetIndex } = _drag;
  _drag.active = false;
  _drag.siteId = null;
  _drag.chipEl = null;
  _drag.targetIndex = -1;

  if (siteId && targetIndex >= 0) {
    _executeReorder(siteId, targetIndex);
  }
}

function _executeReorder(siteId, targetIndex) {
  const container = elements.iframesContainer;
  if (!container) return;

  const sortedEls = _getSortedCardEls(container);
  const currentIds = sortedEls.map((el) => el.dataset.siteId);

  const withoutDragged = currentIds.filter((id) => id !== siteId);
  const clampedTarget = Math.min(Math.max(0, targetIndex), withoutDragged.length);
  withoutDragged.splice(clampedTarget, 0, siteId);
  const newOrder = withoutDragged;

  newOrder.forEach((id, index) => {
    const ref = state.cardRefs.get(id);
    if (ref?.cardEl) {
      ref.cardEl.style.order = String(index);
    }
  });

  const siteById = new Map(state.sites.map((s) => [s.id, s]));
  const newOrderSet = new Set(newOrder);
  const reorderedSites = newOrder.map((id) => siteById.get(id)).filter(Boolean);
  const otherSites = state.sites.filter((s) => !newOrderSet.has(s.id));
  state.sites = [...reorderedSites, ...otherSites];

  renderCardNavStrip();
  if (state.layoutMode === "sidebar") {
    renderSiteNav();
  }
}

export function scrollToCard(siteId) {
  const ref = state.cardRefs.get(siteId);
  if (!ref?.cardEl) return;

  if (state.layoutMode === "sidebar") {
    activateSidebarSite(siteId);
    return;
  }

  const card = ref.cardEl;
  const container = elements.iframesContainer;
  if (!container) return;

  const cardRect = card.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  if (state.layoutRows === 1) {
    const target = container.scrollLeft + (cardRect.left - containerRect.left) - 12;
    container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  } else {
    const target = container.scrollTop + (cardRect.top - containerRect.top) - 12;
    container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }
}

export function toggleMaximize(siteId) {
  state.maximizedSiteId = state.maximizedSiteId === siteId ? null : siteId;

  state.cardRefs.forEach((ref, id) => {
    const isMaximized = state.maximizedSiteId === id;
    const shouldHide = Boolean(state.maximizedSiteId) && !isMaximized;

    ref.cardEl.hidden = shouldHide;
    ref.cardEl.style.flexBasis = isMaximized ? "calc(100vw - 28px)" : "";
  });

  if (state.maximizedSiteId) {
    setGlobalStatus("当前卡片已最大化显示。");
  } else {
    setGlobalStatus(`已加载 ${getSelectedSites().length} 个站点。`);
  }
}
