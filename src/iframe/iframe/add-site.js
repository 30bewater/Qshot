import { state, elements, SITE_CATEGORIES } from "./state.js";
import { AI_SITE_GROUPS, SOCIAL_SITE_GROUPS } from "../../shared/site-groups.js";
import { isWideMediaSite, escapeHtml } from "./utils.js";
import { setGlobalStatus } from "./status.js";
import {
  activateScrollGuard,
  getScrollGuardDurationMs,
  renderSiteNav,
  renderCardNavStrip,
  updateScrollEdgeBtns,
  onCardAdded,
} from "./layout.js";
import { createSiteCard } from "./cards-render.js";

function msg(key, fallback) {
  return window.__QSHOT_I18N__?.t?.(key) || fallback || "";
}

function getCategoryLabel(category) {
  return category.labelKey ? msg(category.labelKey, category.label) : category.label;
}

// ── 临时添加卡片（+）选择器 ──
export function toggleAddSitePicker() {
  if (state.isAddSitePickerOpen) {
    closeAddSitePicker();
    return;
  }
  state.isAddSitePickerOpen = true;
  elements.addSiteBtn?.setAttribute("aria-expanded", "true");
  if (elements.addSitePopover) {
    elements.addSitePopover.hidden = false;
  }
  renderAddSitePicker();
}

export function closeAddSitePicker() {
  if (!state.isAddSitePickerOpen) {
    return;
  }
  state.isAddSitePickerOpen = false;
  elements.addSiteBtn?.setAttribute("aria-expanded", "false");
  if (elements.addSitePopover) {
    elements.addSitePopover.hidden = true;
  }
}

export function getSitesForCategory(categoryId) {
  if (!Array.isArray(state.allSites) || state.allSites.length === 0) {
    return [];
  }
  if (categoryId === "custom") {
    return state.allSites.filter((s) => s && s.isCustom);
  }
  const category = SITE_CATEGORIES.find((c) => c.id === categoryId);
  const ids = new Set(category?.builtinIds || []);
  const byId = new Map(state.allSites.map((s) => [s.id, s]));
  return Array.from(ids).map((id) => byId.get(id)).filter(Boolean);
}

function getExternalOnlyTip() {
  return msg(
    "iframe_addSite_externalOnlyTip",
    "该模型不支持卡片呈现，要跳转到新开标签页进行搜索。"
  );
}

const EXTERNAL_LINK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

function appendSiteChip(container, site) {
  const chip = document.createElement("button");
  chip.type = "button";
  const externalOnly = site.supportIframe === false;
  const label = site.name || site.id;
  chip.className = "add-site-chip" + (externalOnly ? " is-external-only" : "");
  const isAlreadyActive = state.cardRefs.has(site.id);
  if (isAlreadyActive) {
    chip.classList.add("is-active");
    chip.textContent = label;
    chip.title = msg("iframe_addSite_alreadyActive", "该卡片已在页面中");
  } else if (externalOnly) {
    const tip = getExternalOnlyTip();
    chip.setAttribute("data-tip", tip);
    chip.setAttribute("aria-label", `${label}（${tip}）`);
    chip.innerHTML = `
      <span class="add-site-chip-label">${escapeHtml(label)}</span>
      <span class="add-site-chip-external" aria-hidden="true">${EXTERNAL_LINK_ICON}</span>
    `;
  } else {
    chip.textContent = label;
  }
  chip.addEventListener("click", (event) => {
    event.stopPropagation();
    if (externalOnly) {
      setGlobalStatus(getExternalOnlyTip());
      return;
    }
    if (state.cardRefs.has(site.id)) {
      return;
    }
    addSiteCardToPage(site);
    renderAddSitePicker();
  });
  container.appendChild(chip);
}

function renderGroupedSiteList(container, sites, marketGroups) {
  const sitesById = new Map(sites.map((site) => [site.id, site]));
  const groupsWrap = document.createElement("div");
  groupsWrap.className = "add-site-groups";

  marketGroups.forEach((marketGroup) => {
    const groupSites = marketGroup.siteIds
      .map((siteId) => sitesById.get(siteId))
      .filter(Boolean);
    if (!groupSites.length) {
      return;
    }

    const groupEl = document.createElement("div");
    groupEl.className = "add-site-group";

    const titleEl = document.createElement("div");
    titleEl.className = "add-site-group-title";
    titleEl.textContent = msg(marketGroup.labelKey, marketGroup.label);
    groupEl.appendChild(titleEl);

    const chipsEl = document.createElement("div");
    chipsEl.className = "add-site-group-chips";
    groupSites.forEach((site) => appendSiteChip(chipsEl, site));
    groupEl.appendChild(chipsEl);
    groupsWrap.appendChild(groupEl);
  });

  container.appendChild(groupsWrap);
}

export function renderAddSitePicker() {
  if (!elements.addSiteTabs || !elements.addSiteList) {
    return;
  }

  elements.addSiteTabs.innerHTML = "";
  SITE_CATEGORIES.forEach((category) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `add-site-tab${state.activeAddSiteCategory === category.id ? " is-active" : ""}`;
    tab.textContent = getCategoryLabel(category);
    tab.addEventListener("click", (event) => {
      event.stopPropagation();
      state.activeAddSiteCategory = category.id;
      renderAddSitePicker();
    });
    elements.addSiteTabs.appendChild(tab);
  });

  elements.addSiteList.innerHTML = "";
  const sites = getSitesForCategory(state.activeAddSiteCategory);
  if (sites.length === 0) {
    const empty = document.createElement("div");
    empty.className = "add-site-empty";
    empty.textContent = state.activeAddSiteCategory === "custom"
      ? msg("iframe_addSite_customEmpty", "还没有自定义站点，前往设置页添加。")
      : msg("iframe_addSite_empty", "暂无可添加的站点。");
    elements.addSiteList.appendChild(empty);
    return;
  }

  if (state.activeAddSiteCategory === "ai") {
    renderGroupedSiteList(elements.addSiteList, sites, AI_SITE_GROUPS);
    return;
  }
  if (state.activeAddSiteCategory === "other") {
    renderGroupedSiteList(elements.addSiteList, sites, SOCIAL_SITE_GROUPS);
    return;
  }

  sites.forEach((site) => appendSiteChip(elements.addSiteList, site));
}

export function addSiteCardToPage(site) {
  if (!site || !site.id) {
    return;
  }

  if (site.supportIframe === false) {
    setGlobalStatus(getExternalOnlyTip());
    return;
  }

  state.hiddenSiteIds.delete(site.id);

  if (state.cardRefs.has(site.id)) {
    setGlobalStatus(`${site.name} 卡片已在页面中。`);
    return;
  }

  if (!state.sites.some((s) => s.id === site.id)) {
    state.sites = [...state.sites, site];
  }

  const emptyState = elements.iframesContainer.querySelector(".empty-state");
  if (emptyState) {
    emptyState.remove();
  }

  const card = createSiteCard(site);
  if (isWideMediaSite(site.id)) {
    card.classList.add("iframe-card-wide-media");
  }
  elements.iframesContainer.appendChild(card);
  onCardAdded(card);

  if (state.layoutMode === "sidebar") {
    state.activeSidebarSiteId = site.id;
    state.cardRefs.forEach((ref, siteId) => {
      if (ref.cardEl) ref.cardEl.hidden = siteId !== state.activeSidebarSiteId;
    });
  }

  activateScrollGuard(
    elements.iframesContainer.scrollLeft,
    elements.iframesContainer.scrollTop,
    getScrollGuardDurationMs(1)
  );
  updateScrollEdgeBtns();
  renderCardNavStrip();
  setGlobalStatus(`已在当前页面临时添加 ${site.name} 卡片。`);
}
