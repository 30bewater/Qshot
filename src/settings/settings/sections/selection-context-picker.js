/**
 * selection-context-picker.js
 * Hover site picker panel + picker timer helpers for selection context groups.
 */

import {
  state,
  msg,
  SITE_CATEGORIES,
  getSiteCategoryLabel,
  AI_SITE_GROUPS,
  SOCIAL_SITE_GROUPS,
  PICKER_CLOSE_DELAY_MS,
} from "../state.js";
import { escapeHtml } from "../utils.js";
import { persistAll, getCategorySites } from "../store.js";

const MAX_CUSTOM_SITES = 5;

function getCtxGroupById(id) {
  return state.selectionContextGroups.find((g) => g.id === id);
}

export function createHoverPicker(group) {
  const panel = document.createElement("div");
  panel.className = "hover-picker-panel is-open";
  panel.addEventListener("click", (e) => e.stopPropagation());
  panel.addEventListener("mouseenter", clearCtxPickerTimer);
  panel.addEventListener("mouseleave", scheduleCtxPickerClose);

  const activeKey = state.activeCtxPickerCategoryKey || Object.keys(SITE_CATEGORIES)[0];
  const tabBar = document.createElement("div");
  tabBar.className = "hover-picker-tab-bar";
  Object.entries(SITE_CATEGORIES).forEach(([key]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hover-picker-tab" + (activeKey === key ? " is-active" : "");
    btn.textContent = getSiteCategoryLabel(key);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearCtxPickerTimer();
      if (state.activeCtxPickerCategoryKey !== key) {
        state.activeCtxPickerCategoryKey = key;
        state.renderOtherSection();
      }
    });
    tabBar.appendChild(btn);
  });
  panel.appendChild(tabBar);

  const content = document.createElement("div");
  content.className = "hover-picker-tab-content";
  const categorySites = getCategorySites(activeKey);

  const renderColumns = (groups) => {
    const wrap = document.createElement("div");
    wrap.className = "hover-picker-ai-columns";
    groups.forEach((grp) => {
      const groupSites = grp.siteIds.map((id) => categorySites.find((s) => s.id === id)).filter(Boolean);
      if (!groupSites.length) return;
      const col = document.createElement("div");
      col.className = "hover-picker-ai-col";
      const title = document.createElement("div");
      title.className = "hover-picker-site-group-title";
      title.textContent = msg(grp.labelKey, grp.label);
      col.appendChild(title);
      const row = document.createElement("div");
      row.className = "hover-picker-option-row";
      groupSites.forEach((site) => row.appendChild(createPickerOption(group, site, activeKey)));
      col.appendChild(row);
      wrap.appendChild(col);
    });
    return wrap;
  };

  if (activeKey === "ai") {
    content.appendChild(renderColumns(AI_SITE_GROUPS));
  } else if (activeKey === "other") {
    content.appendChild(renderColumns(SOCIAL_SITE_GROUPS));
  } else if (activeKey === "custom" && !categorySites.length) {
    const empty = document.createElement("div");
    empty.className = "hover-picker-empty";
    empty.innerHTML = msg("settings_groups_customEmpty", `还没有自定义站点<br/><span class="hover-picker-empty-hint">前往「自定义搜索」添加</span>`);
    content.appendChild(empty);
  } else {
    const row = document.createElement("div");
    row.className = "hover-picker-option-row";
    categorySites.forEach((site) => row.appendChild(createPickerOption(group, site, activeKey)));
    content.appendChild(row);
  }
  panel.appendChild(content);
  return panel;
}

function createPickerOption(group, site, categoryKey) {
  const btn = document.createElement("button");
  btn.type = "button";
  const selected = (group.siteIds || []).includes(site.id);
  const atMax = !selected && (group.siteIds || []).length >= MAX_CUSTOM_SITES;
  const label = site.name || site.id;
  const hasCjk = /[\u3400-\u9fff]/.test(label);
  btn.className = `hover-picker-option${selected ? " is-selected" : ""}${hasCjk ? " is-cjk-label" : ""}${atMax ? " is-disabled" : ""}`;
  btn.disabled = atMax;
  btn.innerHTML = `<span class="hover-picker-option-label">${escapeHtml(label)}</span>`;
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const g = getCtxGroupById(group.id);
    if (!g) return;
    g.siteIds = selected
      ? (g.siteIds || []).filter((id) => id !== site.id)
      : [...(g.siteIds || []), site.id];
    await persistAll();
    state.openCtxPickerGroupId = g.id;
    state.activeCtxPickerCategoryKey = categoryKey;
    clearCtxPickerTimer();
    state.renderOtherSection();
  });
  return btn;
}

export function attachModeDropdown(container, group) {
  const modeDropdown = container.querySelector("[data-field='mode-dropdown']");
  const modeTrigger = container.querySelector("[data-field='mode-trigger']");
  const modeMenu = container.querySelector("[data-field='mode-menu']");
  if (!modeDropdown || !modeTrigger || !modeMenu) return;

  modeTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = modeDropdown.classList.contains("is-open");
    document.querySelectorAll(".group-mode-dropdown").forEach((d) => {
      d.classList.remove("is-open");
      d.querySelector("[data-field='mode-trigger']")?.setAttribute("aria-expanded", "false");
      const m = d.querySelector("[data-field='mode-menu']");
      if (m) m.hidden = true;
    });
    if (!isOpen) {
      modeDropdown.classList.add("is-open");
      modeTrigger.setAttribute("aria-expanded", "true");
      modeMenu.hidden = false;
    }
  });

  modeMenu.querySelectorAll("[data-mode-value]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const g = getCtxGroupById(group.id);
      if (!g) return;
      g.mode = button.dataset.modeValue === "tabs" ? "tabs" : "compare";
      await persistAll();
      state.renderOtherSection();
    });
  });
}

export function clearCtxPickerTimer() {
  if (state.ctxPickerCloseTimerId) {
    clearTimeout(state.ctxPickerCloseTimerId);
    state.ctxPickerCloseTimerId = null;
  }
}

export function scheduleCtxPickerClose() {
  clearCtxPickerTimer();
  state.ctxPickerCloseTimerId = setTimeout(() => {
    closeCtxPicker();
    state.renderOtherSection();
  }, PICKER_CLOSE_DELAY_MS);
}

export function closeCtxPicker() {
  clearCtxPickerTimer();
  state.openCtxPickerGroupId = null;
  state.activeCtxPickerCategoryKey = null;
}
