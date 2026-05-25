import {
  state,
  msg,
  SITE_CATEGORIES,
  getSiteCategoryLabel,
  AI_SITE_GROUPS,
  SOCIAL_SITE_GROUPS,
  GROUP_MODE_OPTIONS,
  getGroupModeLabel,
  PICKER_CLOSE_DELAY_MS,
} from "../state.js";
import { escapeHtml, getGroupById } from "../utils.js";
import { persistAll, getCategorySites } from "../store.js";
import { attachChipDrag } from "../drag.js";

export function renderGroupsSection() {
  const { groupsSection } = state.dom;
  groupsSection.innerHTML = "";

  if (!state.groups.length) {
    const emptyState = document.createElement("section");
    emptyState.className = "settings-empty-state";
    emptyState.innerHTML = `<strong>${msg("settings_groups_emptyTitle", "还没有搜索组")}</strong><p>${msg("settings_groups_emptyDesc", "先创建一个搜索组，再配置你要调用的网站或 AI 模型。")}</p>`;
    groupsSection.appendChild(emptyState);
  } else {
    state.groups.forEach((group, index) => groupsSection.appendChild(createGroupCard(group, index)));
  }

  const addCard = document.createElement("section");
  addCard.className = "settings-add-card";
  addCard.innerHTML = `<button class="add-section-btn" type="button">${msg("settings_groups_addGroup", "新增搜索组")}</button>`;
  addCard.querySelector("button").addEventListener("click", async () => {
    state.groups.push({
      id: `group_${Date.now()}`,
      name: msg("settings_groups_newGroupName", "新搜索组"),
      enabled: true,
      mode: "compare",
      siteIds: []
    });
    await persistAll();
    renderGroupsSection();
  });
  groupsSection.appendChild(addCard);
}

function createGroupCard(group, index) {
  const isLocked = index === 0;
  const card = document.createElement("section");
  card.className = `settings-group-card${group.enabled ? "" : " is-disabled"}`;
  card.dataset.groupId = group.id;

  if (!isLocked) {
    const deleteCornerBtn = document.createElement("button");
    deleteCornerBtn.type = "button";
    deleteCornerBtn.className = "group-delete-corner-btn";
      deleteCornerBtn.setAttribute("aria-label", msg("settings_groups_deleteGroupAria", "删除搜索组"));
    deleteCornerBtn.textContent = "×";
    deleteCornerBtn.addEventListener("click", async () => {
      const currentGroup = getGroupById(group.id);
      if (!currentGroup) {
        return;
      }
      const shouldDelete = window.confirm(msg("settings_groups_deleteGroupConfirm", "是否要删除该搜索组？"));
      if (!shouldDelete) {
        return;
      }
      state.groups = state.groups.filter((item) => item.id !== currentGroup.id);
      if (state.openPickerGroupId === currentGroup.id) {
        closePicker();
      }
      await persistAll();
      renderGroupsSection();
    });
    card.appendChild(deleteCornerBtn);
  }

  const leftPanel = document.createElement("div");
  leftPanel.className = "settings-group-meta";
  leftPanel.innerHTML = `
    <div class="group-inline-controls group-inline-controls-split">
      <label class="inline-control group-name-inline-wrap">
        <span class="field-label inline-field-label">${msg("settings_groups_fieldName", "搜索组名称")}</span>
        <input class="group-name-input" type="text" value="${escapeHtml(group.name)}" data-field="name" />
      </label>
      <label class="inline-control inline-mode-control inline-mode-select-wrap">
        <span class="field-label inline-field-label">${msg("settings_groups_fieldMode", "呈现方式")}</span>
        <div class="group-mode-dropdown" data-field="mode-dropdown">
          <button class="group-mode-trigger" type="button" data-field="mode-trigger" aria-expanded="false">
            <span class="group-mode-trigger-label">${escapeHtml(group.mode === "tabs" ? msg("settings_groups_modeTabs", "新开标签") : msg("settings_groups_modeCompare", "卡片呈现"))}</span>
            <span class="group-mode-trigger-arrow" aria-hidden="true"></span>
          </button>
          <div class="group-mode-menu" data-field="mode-menu" hidden>
            ${GROUP_MODE_OPTIONS.map((option) => `<button class="group-mode-option${group.mode === option.value ? " is-active" : ""}" type="button" data-mode-value="${option.value}">${escapeHtml(getGroupModeLabel(option))}</button>`).join("")}
          </div>
        </div>
      </label>
    </div>
  `;

  const rightPanel = document.createElement("div");
  rightPanel.className = "settings-group-sites";

  const chipsWrap = document.createElement("div");
  chipsWrap.className = "site-chip-list";

  const selectedSites = group.siteIds.map((siteId) => state.sites.find((site) => site.id === siteId)).filter(Boolean);
  selectedSites.forEach((site) => chipsWrap.appendChild(createSelectedChip(group, site)));

  attachChipDrag(chipsWrap, group);
  rightPanel.appendChild(chipsWrap);
  rightPanel.appendChild(createInlineAdd(group));
  card.appendChild(leftPanel);
  card.appendChild(rightPanel);

  if (!isLocked) {
    const dragHandle = document.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "group-drag-handle";
    dragHandle.setAttribute("aria-label", msg("settings_groups_dragAria", "拖动调整搜索组顺序"));
    dragHandle.innerHTML = `<svg viewBox="0 0 1024 1024" aria-hidden="true" class="group-drag-handle-svg"><path d="M716.8 212.48c-10.24 0-17.92 2.56-25.6 5.12v-5.12c0-43.52-33.28-76.8-76.8-76.8-10.24 0-17.92 2.56-28.16 5.12C581.12 104.96 550.4 76.8 512 76.8c-43.52 0-76.8 33.28-76.8 76.8v5.12c-7.68-2.56-15.36-5.12-25.6-5.12-43.52 0-76.8 33.28-76.8 76.8v104.96c-7.68-2.56-15.36-5.12-25.6-5.12-43.52 0-76.8 33.28-76.8 76.8v256c0 156.16 125.44 281.6 281.6 281.6s281.6-125.44 281.6-281.6V289.28c0-43.52-33.28-76.8-76.8-76.8zM742.4 665.6c0 128-102.4 230.4-230.4 230.4s-230.4-102.4-230.4-230.4V409.6c0-15.36 10.24-25.6 25.6-25.6s25.6 10.24 25.6 25.6v209.92h43.52c56.32 5.12 110.08 33.28 143.36 79.36l40.96-30.72c-40.96-56.32-107.52-94.72-176.64-99.84V230.4c0-15.36 10.24-25.6 25.6-25.6s25.6 10.24 25.6 25.6v256h51.2V153.6c0-15.36 10.24-25.6 25.6-25.6s25.6 10.24 25.6 25.6v335.36h51.2V212.48c0-15.36 10.24-25.6 25.6-25.6s25.6 10.24 25.6 25.6v276.48h51.2v-199.68c0-15.36 10.24-25.6 25.6-25.6s25.6 10.24 25.6 25.6V665.6z" fill="#525C6A"></path></svg>`;
    card.appendChild(dragHandle);
  }

  const nameInput = leftPanel.querySelector("[data-field='name']");
  const modeDropdown = leftPanel.querySelector("[data-field='mode-dropdown']");
  const modeTrigger = leftPanel.querySelector("[data-field='mode-trigger']");
  const modeMenu = leftPanel.querySelector("[data-field='mode-menu']");

  if (nameInput) {
    nameInput.addEventListener("input", async (event) => {
      const currentGroup = getGroupById(group.id);
      if (!currentGroup) {
        return;
      }
      const nextValue = event.target instanceof HTMLInputElement ? event.target.value : "";
      currentGroup.name = nextValue;
      await persistAll();
    });
  }

  if (modeDropdown && modeTrigger && modeMenu) {
    modeTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = modeDropdown.classList.contains("is-open");
      document.querySelectorAll(".group-mode-dropdown").forEach((dropdown) => {
        dropdown.classList.remove("is-open");
        const trigger = dropdown.querySelector("[data-field='mode-trigger']");
        const menu = dropdown.querySelector("[data-field='mode-menu']");
        if (trigger) {
          trigger.setAttribute("aria-expanded", "false");
        }
        if (menu) {
          menu.hidden = true;
        }
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
        const currentGroup = getGroupById(group.id);
        if (!currentGroup) {
          return;
        }
        currentGroup.mode = button.dataset.modeValue === "tabs" ? "tabs" : "compare";
        await persistAll();
        renderGroupsSection();
      });
    });
  }

  return card;
}

function createSelectedChip(group, site) {
  const chip = document.createElement("div");
  chip.className = "site-chip selected-chip";
  chip.dataset.siteId = site.id;
  chip.innerHTML = `<span class="site-chip-label">${escapeHtml(site.name)}</span><button class="chip-remove-btn" type="button" aria-label="${msg("settings_groups_removeSitePrefix", "删除 ")}${escapeHtml(site.name)}">×</button>`;

  chip.querySelector(".chip-remove-btn").addEventListener("click", async (event) => {
    event.stopPropagation();
    const currentGroup = getGroupById(group.id);
    if (!currentGroup) {
      return;
    }
    currentGroup.siteIds = currentGroup.siteIds.filter((id) => id !== site.id);
    await persistAll();
    renderGroupsSection();
  });

  return chip;
}

function createInlineAdd(group) {
  const wrap = document.createElement("div");
  wrap.className = "inline-add-wrap";

  const button = document.createElement("button");
  button.type = "button";
  button.className = `inline-add-btn${state.openPickerGroupId === group.id ? " is-active" : ""}`;
  button.textContent = msg("common_add", "新增");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    clearPickerCloseTimer();
    if (state.openPickerGroupId === group.id) {
      closePicker();
    } else {
      state.openPickerGroupId = group.id;
      if (!state.activePickerCategoryKey || !SITE_CATEGORIES[state.activePickerCategoryKey]) {
        state.activePickerCategoryKey = Object.keys(SITE_CATEGORIES)[0] || null;
      }
    }
    renderGroupsSection();
  });
  wrap.appendChild(button);

  if (state.openPickerGroupId === group.id) {
    wrap.appendChild(createHoverPicker(group));
  }

  return wrap;
}

function createHoverPicker(group) {
  const panel = document.createElement("div");
  panel.className = `hover-picker-panel is-open${state.suppressPickerAnimation ? " is-stable" : ""}`;
  state.suppressPickerAnimation = false;
  panel.addEventListener("click", (event) => event.stopPropagation());
  panel.addEventListener("mouseenter", clearPickerCloseTimer);
  panel.addEventListener("mouseleave", schedulePickerClose);

  const activeKey = state.activePickerCategoryKey || Object.keys(SITE_CATEGORIES)[0];

  // Tab bar
  const tabBar = document.createElement("div");
  tabBar.className = "hover-picker-tab-bar";
  Object.entries(SITE_CATEGORIES).forEach(([key, category]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hover-picker-tab" + (activeKey === key ? " is-active" : "");
    btn.textContent = getSiteCategoryLabel(key);
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      clearPickerCloseTimer();
      setActivePickerCategory(key);
    });
    tabBar.appendChild(btn);
  });
  panel.appendChild(tabBar);

  // Content
  const content = document.createElement("div");
  content.className = "hover-picker-tab-content";
  const categorySites = getCategorySites(activeKey);

  if (activeKey === "custom") {
    if (!categorySites.length) {
      const empty = document.createElement("div");
      empty.className = "hover-picker-empty";
      empty.innerHTML = msg(
        "settings_groups_customEmpty",
        `还没有自定义站点<br/><span class="hover-picker-empty-hint">前往左侧「自定义搜索」添加</span>`
      );
      content.appendChild(empty);
    } else {
      const optionRow = document.createElement("div");
      optionRow.className = "hover-picker-option-row";
      categorySites.forEach((site) => optionRow.appendChild(createPickerSiteOption(group, site, activeKey)));
      content.appendChild(optionRow);
    }
  } else if (activeKey === "ai") {
    const columnsWrap = document.createElement("div");
    columnsWrap.className = "hover-picker-ai-columns";
    AI_SITE_GROUPS.forEach((marketGroup) => {
      const groupSites = marketGroup.siteIds
        .map((siteId) => categorySites.find((site) => site.id === siteId))
        .filter(Boolean);
      if (!groupSites.length) return;
      const col = document.createElement("div");
      col.className = "hover-picker-ai-col";
      const colTitle = document.createElement("div");
      colTitle.className = "hover-picker-site-group-title";
      colTitle.textContent = msg(marketGroup.labelKey, marketGroup.label);
      col.appendChild(colTitle);
      const optionRow = document.createElement("div");
      optionRow.className = "hover-picker-option-row";
      groupSites.forEach((site) => optionRow.appendChild(createPickerSiteOption(group, site, activeKey)));
      col.appendChild(optionRow);
      columnsWrap.appendChild(col);
    });
    content.appendChild(columnsWrap);
  } else if (activeKey === "other") {
    const tip = document.createElement("div");
    tip.className = "hover-picker-tip";
    tip.textContent = msg("settings_groups_otherTip", "社媒平台更推荐使用“新开标签”模式；卡片呼现的预览与打开体验可能不稳定。");
    content.appendChild(tip);
    const columnsWrap = document.createElement("div");
    columnsWrap.className = "hover-picker-ai-columns";
    SOCIAL_SITE_GROUPS.forEach((marketGroup) => {
      const groupSites = marketGroup.siteIds
        .map((siteId) => categorySites.find((site) => site.id === siteId))
        .filter(Boolean);
      if (!groupSites.length) return;
      const col = document.createElement("div");
      col.className = "hover-picker-ai-col";
      const colTitle = document.createElement("div");
      colTitle.className = "hover-picker-site-group-title";
      colTitle.textContent = msg(marketGroup.labelKey, marketGroup.label);
      col.appendChild(colTitle);
      const optionRow = document.createElement("div");
      optionRow.className = "hover-picker-option-row";
      groupSites.forEach((site) => optionRow.appendChild(createPickerSiteOption(group, site, activeKey)));
      col.appendChild(optionRow);
      columnsWrap.appendChild(col);
    });
    content.appendChild(columnsWrap);
  } else {
    categorySites.forEach((site) => content.appendChild(createPickerSiteOption(group, site, activeKey)));
  }

  panel.appendChild(content);
  return panel;
}

export function setActivePickerCategory(categoryKey) {
  if (state.activePickerCategoryKey === categoryKey) {
    return;
  }
  state.activePickerCategoryKey = categoryKey;
  renderGroupsSection();
}

export function clearPickerCloseTimer() {
  if (state.pickerCloseTimerId) {
    window.clearTimeout(state.pickerCloseTimerId);
    state.pickerCloseTimerId = null;
  }
}

export function schedulePickerClose() {
  clearPickerCloseTimer();
  state.pickerCloseTimerId = window.setTimeout(() => {
    closePicker();
    renderGroupsSection();
  }, PICKER_CLOSE_DELAY_MS);
}

export function closePicker() {
  clearPickerCloseTimer();
  state.openPickerGroupId = null;
  state.activePickerCategoryKey = null;
}

function createPickerSiteOption(group, site, categoryKey) {
  const btn = document.createElement("button");
  btn.type = "button";
  const selected = group.siteIds.includes(site.id);
  const externalOnly = site.supportIframe === false;
  const label = site.name || site.id;
  const hasCjk = /[\u3400-\u9fff]/.test(label);
  btn.className = `hover-picker-option${selected ? " is-selected" : ""}${externalOnly ? " is-external-only" : ""}${hasCjk ? " is-cjk-label" : ""}`;

  if (externalOnly) {
    const tip = msg(
      "settings_groups_pickerExternalOnlyTip",
      "该模型不支持卡片形式呈现，仅支持新开标签打开。"
    );
    btn.setAttribute("aria-label", `${label}（${tip}）`);
    btn.setAttribute("data-tip", tip);
    btn.innerHTML = `
      <span class="hover-picker-option-label">${escapeHtml(label)}</span>
      <span class="hover-picker-option-external" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </span>
    `;
  } else {
    btn.innerHTML = `<span class="hover-picker-option-label">${escapeHtml(label)}</span>`;
  }

  btn.addEventListener("click", async (event) => {
    event.stopPropagation();
    const currentGroup = getGroupById(group.id);
    if (!currentGroup) return;
    if (selected) {
      currentGroup.siteIds = currentGroup.siteIds.filter((id) => id !== site.id);
    } else {
      currentGroup.siteIds = [...currentGroup.siteIds, site.id];
    }
    await persistAll();
    state.openPickerGroupId = currentGroup.id;
    state.activePickerCategoryKey = categoryKey;
    state.suppressPickerAnimation = true;
    clearPickerCloseTimer();
    renderGroupsSection();
  });
  return btn;
}
