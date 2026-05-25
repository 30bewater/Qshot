import { createShortcutsPageHint, createShortcutRecorderRow } from "./other-shortcuts.js";
import { QUICK_ACCESS_SITES_KEY } from "../../../shared/storage-keys.js";
import {
  state,
  msg,
  SITE_CATEGORIES,
  getSiteCategoryLabel,
  AI_SITE_GROUPS,
  SOCIAL_SITE_GROUPS,
  PICKER_CLOSE_DELAY_MS
} from "../state.js";
import { escapeHtml } from "../utils.js";
import {
  persistAll,
  getCategorySites,
} from "../store.js";
import { attachChipDragGeneric } from "../drag.js";
import { renderSelectionContextGroupsSection } from "./selection-context-groups.js";
import { renderSelectionBubbleSection } from "./selection-bubble.js";
import { renderStretchSwitchMarkup } from "./stretch-switch.js";

async function persistQuickAccessSites() {
  await chrome.storage.local.set({ [QUICK_ACCESS_SITES_KEY]: state.quickAccessSiteIds });
}

const MISC_TAB_KEYS = ["global", "rightclick", "bubble"];
let prevOtherTabKey = null;

export function renderOtherSection() {
  const { otherSection } = state.dom;
  otherSection.innerHTML = "";

  if (!state.activeOtherTab) state.activeOtherTab = "global";

  const tabBar = document.createElement("div");
  tabBar.className = "custom-tab-bar misc-tab-bar";
  [
    { key: "global", label: msg("settings_other_tabGlobal", "全局搜索") },
    { key: "rightclick", label: msg("settings_other_tabRightClick", "右键提示词") },
    { key: "bubble", label: msg("settings_other_tabBubble", "划词气泡") },
  ].forEach(({ key, label }) => {
    const btn = document.createElement("button");
    btn.className = "custom-tab-btn" + (state.activeOtherTab === key ? " is-active" : "");
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      state.activeOtherTab = key;
      renderOtherSection();
    });
    tabBar.appendChild(btn);
  });

  const glider = document.createElement("div");
  glider.className = "tab-glider";
  tabBar.appendChild(glider);
  otherSection.appendChild(tabBar);

  // ── 滑块动效：从上次位置弹性滑到当前位置 ──
  const fromKey = prevOtherTabKey ?? state.activeOtherTab;
  prevOtherTabKey = state.activeOtherTab;
  const currentIdx = MISC_TAB_KEYS.indexOf(state.activeOtherTab);
  const fromIdx = MISC_TAB_KEYS.indexOf(fromKey);

  requestAnimationFrame(() => {
    const buttons = tabBar.querySelectorAll(".custom-tab-btn");
    const fromBtn = buttons[fromIdx < 0 ? currentIdx : fromIdx];
    const toBtn = buttons[currentIdx];
    if (!fromBtn || !toBtn) return;
    glider.style.transition = "none";
    glider.style.width = fromBtn.offsetWidth + "px";
    glider.style.transform = `translateX(${fromBtn.offsetLeft}px)`;
    requestAnimationFrame(() => {
      glider.style.transition =
        "transform 0.28s cubic-bezier(0.34, 1.08, 0.64, 1), width 0.22s ease";
      glider.style.width = toBtn.offsetWidth + "px";
      glider.style.transform = `translateX(${toBtn.offsetLeft}px)`;
    });
  });

  if (state.activeOtherTab === "rightclick") {
    otherSection.appendChild(renderSelectionContextGroupsSection());
  } else if (state.activeOtherTab === "bubble") {
    otherSection.appendChild(renderSelectionBubbleSection());
  } else {
    otherSection.appendChild(createShortcutCard());
  }
}


function createQuickSitesCard() {
  const MAX = 9;
  const card = document.createElement("div");
  card.className = "quick-sites-card";

  const intro = document.createElement("div");
  intro.className = "other-settings-intro";
  intro.style.cssText = "";
  intro.innerHTML = `
    <strong>${msg("settings_other_quickSitesTitle", "三击空格快捷站点")}</strong>
    <span>${msg("settings_other_quickSitesDesc", "在搜索浮层输入框中三击空格，快速跳转到以下站点（最多 9 个）。")}</span>
  `;
  card.appendChild(intro);

  const chipList = document.createElement("div");
  chipList.className = "site-chip-list";
  chipList.style.marginTop = "4px";

  function renderChips() {
    chipList.innerHTML = "";
    const selectedSites = state.quickAccessSiteIds
      .map((id) => state.sites.find((s) => s.id === id))
      .filter(Boolean);

    selectedSites.forEach((site) => {
      const chip = document.createElement("div");
      chip.className = "site-chip selected-chip";
      chip.dataset.siteId = site.id;
      chip.innerHTML = `<span class="site-chip-label">${escapeHtml(site.name)}</span><button class="chip-remove-btn" type="button" aria-label="${escapeHtml(site.name)} 删除">×</button>`;
      chip.querySelector(".chip-remove-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        state.quickAccessSiteIds = state.quickAccessSiteIds.filter((id) => id !== site.id);
        await persistQuickAccessSites();
        renderChips();
      });
      chipList.appendChild(chip);
    });

    if (selectedSites.length < MAX) {
      const addWrap = document.createElement("div");
      addWrap.className = "inline-add-wrap quick-sites-add-wrap";

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "inline-add-btn";
      addBtn.textContent = msg("common_add", "新增");
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        clearQuickPickerTimer();
        if (state.openQuickSitesPicker) {
          state.openQuickSitesPicker = false;
          state.quickPickerCategoryKey = null;
        } else {
          state.openQuickSitesPicker = true;
          if (!state.quickPickerCategoryKey || !SITE_CATEGORIES[state.quickPickerCategoryKey]) {
            state.quickPickerCategoryKey = Object.keys(SITE_CATEGORIES)[0] || null;
          }
        }
        renderChips();
      });
      addWrap.appendChild(addBtn);

      if (state.openQuickSitesPicker) {
        addWrap.appendChild(createQuickPicker(renderChips));
      }

      chipList.appendChild(addWrap);
    }
  }

  renderChips();
  attachChipDragGeneric(chipList, async (newIds) => {
    state.quickAccessSiteIds = newIds;
    await persistQuickAccessSites();
    renderChips();
  });
  card.appendChild(chipList);
  return card;
}

function clearQuickPickerTimer() {
  if (state.quickPickerCloseTimerId) {
    clearTimeout(state.quickPickerCloseTimerId);
    state.quickPickerCloseTimerId = null;
  }
}

function scheduleQuickPickerClose(renderFn) {
  clearQuickPickerTimer();
  state.quickPickerCloseTimerId = setTimeout(() => {
    state.openQuickSitesPicker = false;
    state.quickPickerCategoryKey = null;
    renderFn();
  }, PICKER_CLOSE_DELAY_MS);
}

function setQuickPickerCategory(key, renderFn) {
  if (state.quickPickerCategoryKey === key) return;
  state.quickPickerCategoryKey = key;
  renderFn();
}

function createQuickPicker(renderFn) {
  const MAX = 9;
  const panel = document.createElement("div");
  panel.className = "hover-picker-panel is-open";
  panel.addEventListener("click", (e) => e.stopPropagation());
  panel.addEventListener("mouseenter", clearQuickPickerTimer);
  panel.addEventListener("mouseleave", () => scheduleQuickPickerClose(renderFn));

  const activeKey = state.quickPickerCategoryKey || Object.keys(SITE_CATEGORIES)[0];

  const tabBar = document.createElement("div");
  tabBar.className = "hover-picker-tab-bar";
  Object.entries(SITE_CATEGORIES).forEach(([key]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hover-picker-tab" + (activeKey === key ? " is-active" : "");
    btn.textContent = getSiteCategoryLabel(key);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearQuickPickerTimer();
      setQuickPickerCategory(key, renderFn);
    });
    tabBar.appendChild(btn);
  });
  panel.appendChild(tabBar);

  const content = document.createElement("div");
  content.className = "hover-picker-tab-content";
  const categorySites = getCategorySites(activeKey);

  if (activeKey === "custom") {
    if (!categorySites.length) {
      const empty = document.createElement("div");
      empty.className = "hover-picker-empty";
      empty.innerHTML = msg("settings_groups_customEmpty", `还没有自定义站点<br/><span class="hover-picker-empty-hint">前往左侧「自定义搜索」添加</span>`);
      content.appendChild(empty);
    } else {
      const optionRow = document.createElement("div");
      optionRow.className = "hover-picker-option-row";
      categorySites.forEach((site) => optionRow.appendChild(createQuickPickerOption(site, renderFn, MAX)));
      content.appendChild(optionRow);
    }
  } else if (activeKey === "ai") {
    const columnsWrap = document.createElement("div");
    columnsWrap.className = "hover-picker-ai-columns";
    AI_SITE_GROUPS.forEach((grp) => {
      const groupSites = grp.siteIds.map((id) => categorySites.find((s) => s.id === id)).filter(Boolean);
      if (!groupSites.length) return;
      const col = document.createElement("div");
      col.className = "hover-picker-ai-col";
      const colTitle = document.createElement("div");
      colTitle.className = "hover-picker-site-group-title";
      colTitle.textContent = msg(grp.labelKey, grp.label);
      col.appendChild(colTitle);
      const optionRow = document.createElement("div");
      optionRow.className = "hover-picker-option-row";
      groupSites.forEach((site) => optionRow.appendChild(createQuickPickerOption(site, renderFn, MAX)));
      col.appendChild(optionRow);
      columnsWrap.appendChild(col);
    });
    content.appendChild(columnsWrap);
  } else {
    const columnsWrap = document.createElement("div");
    columnsWrap.className = "hover-picker-ai-columns";
    SOCIAL_SITE_GROUPS.forEach((grp) => {
      const groupSites = grp.siteIds.map((id) => categorySites.find((s) => s.id === id)).filter(Boolean);
      if (!groupSites.length) return;
      const col = document.createElement("div");
      col.className = "hover-picker-ai-col";
      const colTitle = document.createElement("div");
      colTitle.className = "hover-picker-site-group-title";
      colTitle.textContent = msg(grp.labelKey, grp.label);
      col.appendChild(colTitle);
      const optionRow = document.createElement("div");
      optionRow.className = "hover-picker-option-row";
      groupSites.forEach((site) => optionRow.appendChild(createQuickPickerOption(site, renderFn, MAX)));
      col.appendChild(optionRow);
      columnsWrap.appendChild(col);
    });
    content.appendChild(columnsWrap);
  }

  panel.appendChild(content);
  return panel;
}

function createQuickPickerOption(site, renderFn, max) {
  const btn = document.createElement("button");
  btn.type = "button";
  const isSelected = state.quickAccessSiteIds.includes(site.id);
  const atMax = state.quickAccessSiteIds.length >= max;
  const disabled = !isSelected && atMax;
  const label = site.name || site.id;
  const hasCjk = /[\u3400-\u9fff]/.test(label);
  btn.className = `hover-picker-option${isSelected ? " is-selected" : ""}${hasCjk ? " is-cjk-label" : ""}`;
  btn.innerHTML = `<span class="hover-picker-option-label">${escapeHtml(label)}</span>`;
  if (disabled) {
    btn.disabled = true;
    btn.style.opacity = "0.4";
  }
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    clearQuickPickerTimer();
    if (isSelected) {
      state.quickAccessSiteIds = state.quickAccessSiteIds.filter((id) => id !== site.id);
    } else if (state.quickAccessSiteIds.length < max) {
      state.quickAccessSiteIds = [...state.quickAccessSiteIds, site.id];
    }
    await persistQuickAccessSites();
    renderFn();
  });
  return btn;
}

export { renderStretchSwitchMarkup } from "./stretch-switch.js";

export function createOtherSettingToggle(key, title, desc, tip, options = {}) {
  const row = document.createElement("article");
  row.className = "other-setting-row" + (tip ? " other-setting-row--with-tip" : "");
  if (!desc) row.classList.add("other-setting-row--compact");

  const isOn = getOtherSettingValue(key, options.defaultValue !== false);
  row.innerHTML = `
    <div class="other-setting-row-main">
      <div class="other-setting-copy">
        <div class="other-setting-title">${escapeHtml(title)}</div>
        ${desc ? `<div class="other-setting-desc">${escapeHtml(desc)}</div>` : ""}
      </div>
      ${renderStretchSwitchMarkup(isOn)}
    </div>
    ${tip ? `<div class="other-setting-desc shortcut-tip">${escapeHtml(tip)}</div>` : ""}
  `;

  row.querySelector(".other-setting-switch--stretch-input")?.addEventListener("change", async (event) => {
    state.uiPrefs[key] = event.target.checked;
    await persistAll();
  });

  return row;
}

function getOtherSettingValue(key, defaultValue = true) {
  if (Object.prototype.hasOwnProperty.call(state.uiPrefs || {}, key)) {
    return state.uiPrefs[key] !== false;
  }
  return defaultValue;
}

function createShortcutCard() {
  const card = document.createElement("section");
  card.className = "other-settings-card";
  card.style.cssText = "border: none; background: transparent; box-shadow: none;";
  card.innerHTML = `
    <div class="other-settings-intro">
      <strong>${msg("settings_other_globalShortcutTitle", "全局搜索快捷键")}</strong>
      <span>${msg("settings_other_globalShortcutDesc", "在任意网页上用快捷键在屏幕中间快速弹出搜索浮层。")}</span>
    </div>
    <div class="other-settings-list"></div>
  `;

  const list = card.querySelector(".other-settings-list");
  if (list) {
    list.appendChild(
      createOtherSettingToggle(
        "overlayShortcutEnabled",
        msg("settings_other_enableGlobalShortcutTitle", "启用全局搜索快捷键"),
        msg("settings_other_enableGlobalShortcutDesc", "开启后，按下下方自定义的快捷键即可在当前网页弹出搜索浮层；关闭后快捷键将失效。"),
        msg("settings_other_enableGlobalShortcutTip", "在浏览器内页、扩展商店或部分特殊网页中，可能无法通过快捷键唤起。")
      )
    );
    list.appendChild(createShortcutRecorderRow());
    list.appendChild(createShortcutsPageHint());
  }

  card.appendChild(createQuickSitesCard());

  return card;
}
