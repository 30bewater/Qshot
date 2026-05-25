import { state, normalizeSiteHomeUrl, escapeHtml, formatHistoryDate } from "./state.js";
import { SEARCH_HISTORY_STORAGE_KEY, RANDOM_QUESTIONS_STORAGE_KEY } from "../shared/storage-keys.js";
import { isAllPromptGroup, getPromptGroupDisplayName, getDisplayPromptEntries } from "../shared/prompt-groups.js";
import { openPopupPromptEditModal } from "./prompt-edit-modal.js";

const RANDOM_QUESTIONS_FILES = {
  zh: "config/random-questions/zh-CN.txt",
  en: "config/random-questions/en.txt",
};

let randomQuestionsPromise = null;
let lastRandomQuestionIndex = -1;

function msg(key, fallback = "") {
  return window.__QSHOT_I18N__?.t?.(key) || fallback;
}

export function invalidateRandomQuestionsCache() {
  randomQuestionsPromise = null;
  lastRandomQuestionIndex = -1;
}

function parseRandomQuestionsText(text) {
  if (typeof text !== "string") return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

async function fetchDefaultRandomQuestionsText() {
  const getUiLanguage = window.__QSHOT_I18N__?.getUiLanguage;
  const lang = (getUiLanguage?.() || "").toLowerCase();
  const path = lang.startsWith("zh") ? RANDOM_QUESTIONS_FILES.zh : RANDOM_QUESTIONS_FILES.en;
  try {
    const res = await fetch(chrome.runtime.getURL(path));
    return res.ok ? await res.text() : "";
  } catch (_e) {
    return "";
  }
}

function loadRandomQuestions() {
  if (randomQuestionsPromise) return randomQuestionsPromise;
  randomQuestionsPromise = (async () => {
    const getUiLanguage = window.__QSHOT_I18N__?.getUiLanguage;
    const uiLang = (getUiLanguage?.() || "").toLowerCase();
    const currentDefaultText = await fetchDefaultRandomQuestionsText();
    const otherPath = uiLang.startsWith("zh") ? RANDOM_QUESTIONS_FILES.en : RANDOM_QUESTIONS_FILES.zh;
    let otherDefaultText = "";
    try {
      const res = await fetch(chrome.runtime.getURL(otherPath));
      otherDefaultText = res.ok ? await res.text() : "";
    } catch (_e) {
      otherDefaultText = "";
    }
    try {
      const stored = await chrome.storage.local.get([RANDOM_QUESTIONS_STORAGE_KEY]);
      const raw = stored[RANDOM_QUESTIONS_STORAGE_KEY];
      const isOldDefault = typeof raw === "string" && raw.trimStart().startsWith("#");
      const hasCustomText = typeof raw === "string" && raw.trim().length > 0;
      const isOtherLangDefault = hasCustomText && raw.trim() === otherDefaultText.trim();
      if (hasCustomText && !isOldDefault && !isOtherLangDefault) {
        return parseRandomQuestionsText(raw);
      }
    } catch (_e) {
      /* fallback */
    }
    return parseRandomQuestionsText(currentDefaultText);
  })();
  return randomQuestionsPromise;
}

export async function fillRandomQuestion() {
  const questions = await loadRandomQuestions();
  if (!questions.length) return;
  const { queryInput } = state.dom;
  if (!queryInput) return;
  let idx = Math.floor(Math.random() * questions.length);
  if (questions.length > 1 && idx === lastRandomQuestionIndex) {
    idx = (idx + 1 + Math.floor(Math.random() * (questions.length - 1))) % questions.length;
  }
  lastRandomQuestionIndex = idx;
  queryInput.value = questions[idx];
  state.syncComposerLayout();
  queryInput.focus();
}

// ── Search groups + tooltip ──────────────────────────────────────────────
let _groupTooltipEl = null;
let _groupTooltipTimer = null;
let _groupTooltipHideTimer = null;

export function renderGroups() {
  const { groupsContainer } = state.dom;
  if (!groupsContainer) return;
  groupsContainer.innerHTML = "";
  groupsContainer.hidden = state.groups.length === 0;

  state.groups.forEach((group) => {
    const button = document.createElement("button");
    button.className = "popup-group-btn";
    button.type = "button";
    button.innerHTML = `<span class="popup-group-name">${escapeHtml(group.name)}</span>`;

    const groupSites = getGroupSites(group);
    if (groupSites.length) {
      button.addEventListener("mouseenter", () => showGroupTooltip(button, groupSites));
      button.addEventListener("mouseleave", () => scheduleHideGroupTooltip());
    }
    button.addEventListener("click", async () => {
      hideGroupTooltip();
      await runGroup(group);
    });
    groupsContainer.appendChild(button);
  });
}

function getOrCreateGroupTooltip() {
  if (!_groupTooltipEl) {
    _groupTooltipEl = document.createElement("div");
    _groupTooltipEl.className = "group-tooltip";
    _groupTooltipEl.addEventListener("mouseenter", () => {
      if (_groupTooltipHideTimer) {
        clearTimeout(_groupTooltipHideTimer);
        _groupTooltipHideTimer = null;
      }
    });
    _groupTooltipEl.addEventListener("mouseleave", () => scheduleHideGroupTooltip());
    document.body.appendChild(_groupTooltipEl);
  }
  return _groupTooltipEl;
}

function getGroupSites(group) {
  return (group.siteIds || [])
    .map((id) => state.allSites.find((site) => site.id === id))
    .filter((site) => site && normalizeSiteHomeUrl(site.url))
    .map((site) => ({
      id: site.id,
      name: site.name || site.id,
      url: normalizeSiteHomeUrl(site.url),
    }));
}

function showGroupTooltip(button, sites) {
  if (_groupTooltipTimer) { clearTimeout(_groupTooltipTimer); _groupTooltipTimer = null; }
  if (_groupTooltipHideTimer) { clearTimeout(_groupTooltipHideTimer); _groupTooltipHideTimer = null; }
  _groupTooltipTimer = setTimeout(() => {
    const tooltip = getOrCreateGroupTooltip();
    renderGroupTooltipSites(tooltip, sites);
    tooltip.style.display = "block";
    requestAnimationFrame(() => {
      const btnRect = button.getBoundingClientRect();
      const tooltipW = tooltip.offsetWidth;
      const tooltipH = tooltip.offsetHeight;
      let left = btnRect.left + btnRect.width / 2 - tooltipW / 2;
      if (left < 4) left = 4;
      if (left + tooltipW > window.innerWidth - 4) left = window.innerWidth - tooltipW - 4;
      let top = btnRect.top - tooltipH - 8;
      if (top < 4) top = btnRect.bottom + 8;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    });
  }, 450);
}

function hideGroupTooltip() {
  if (_groupTooltipTimer) { clearTimeout(_groupTooltipTimer); _groupTooltipTimer = null; }
  if (_groupTooltipHideTimer) { clearTimeout(_groupTooltipHideTimer); _groupTooltipHideTimer = null; }
  if (_groupTooltipEl) _groupTooltipEl.style.display = "none";
}

function scheduleHideGroupTooltip() {
  if (_groupTooltipTimer) { clearTimeout(_groupTooltipTimer); _groupTooltipTimer = null; }
  if (_groupTooltipHideTimer) clearTimeout(_groupTooltipHideTimer);
  _groupTooltipHideTimer = setTimeout(() => {
    if (_groupTooltipEl) _groupTooltipEl.style.display = "none";
  }, 180);
}

function renderGroupTooltipSites(tooltip, sites) {
  tooltip.innerHTML = "";
  const list = document.createElement("div");
  const columns = Math.min(5, Math.max(1, sites.length));
  list.className = "group-tooltip-list";
  list.style.gridTemplateColumns = `repeat(${columns}, max-content)`;
  const maxItemWidth = getTooltipItemMaxWidth(tooltip, sites, columns);
  if (maxItemWidth) {
    list.style.setProperty("--group-tooltip-item-max-width", `${maxItemWidth}px`);
  }
  sites.forEach((site) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "group-tooltip-item";
    item.textContent = site.name;
    item.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideGroupTooltip();
      await openSiteHome(site.url);
    });
    list.appendChild(item);
  });
  tooltip.appendChild(list);
}

function getTooltipItemMaxWidth(tooltip, sites, columns) {
  const availableWidth = Math.max(160, window.innerWidth - 28);
  const gapWidth = 6;
  const buttonWidths = sites.map((site) => estimateTooltipButtonWidth(tooltip, site.name));

  for (let i = 0; i < buttonWidths.length; i += columns) {
    const rowWidths = buttonWidths.slice(i, i + columns);
    const rowWidth = rowWidths.reduce((sum, width) => sum + width, 0) + gapWidth * Math.max(0, rowWidths.length - 1);
    if (rowWidth > availableWidth) {
      return Math.floor((availableWidth - gapWidth * (columns - 1)) / columns);
    }
  }

  return 0;
}

function estimateTooltipButtonWidth(tooltip, label) {
  const canvas = estimateTooltipButtonWidth.canvas || document.createElement("canvas");
  estimateTooltipButtonWidth.canvas = canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 80;
  ctx.font = window.getComputedStyle(tooltip).font || "12px Microsoft YaHei UI";
  return Math.ceil(ctx.measureText(String(label || "")).width) + 20;
}

async function openSiteHome(url) {
  const safeUrl = normalizeSiteHomeUrl(url);
  if (!safeUrl) return;
  try {
    await chrome.runtime.sendMessage({ type: "OPEN_EXTERNAL_URL", url: safeUrl });
  } catch (_err) {
    /* ignored */
  }
  window.close();
}

export async function runDefaultSearch() {
  if (!state.groups.length) return;
  await runGroup(state.groups[0]);
}

export function runGroup(group) {
  const { queryInput } = state.dom;
  const query = queryInput ? queryInput.value.trim() : "";
  chrome.runtime
    .sendMessage({ type: "RUN_SEARCH_GROUP", group, query })
    .catch(() => {});
  window.close();
}

function openPopupHistoryRestorePage(entryId) {
  if (!entryId) return;
  const url = new URL(chrome.runtime.getURL("iframe/iframe.html"));
  url.searchParams.set("restoreHistoryId", entryId);
  chrome.tabs.create({ url: url.toString() }).catch(() => {});
  window.close();
}

function buildPopupHistoryActionButtons(entry, { onDelete }) {
  const actionButtons = document.createElement("div");
  actionButtons.className = "popup-history-action-buttons";

  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.className = "popup-history-restore-btn";
  restoreBtn.textContent = msg("popup_historyRestore", "复原");
  restoreBtn.setAttribute("aria-label", msg("popup_restoreHistoryEntry", "新开页面复原这次搜索会话"));
  restoreBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openPopupHistoryRestorePage(entry?.id);
  });
  actionButtons.appendChild(restoreBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "popup-history-delete-btn";
  deleteBtn.textContent = msg("popup_historyDelete", "删除");
  deleteBtn.setAttribute("aria-label", msg("popup_deleteHistoryEntry", "删除这条记录"));
  deleteBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await onDelete();
  });
  actionButtons.appendChild(deleteBtn);

  return actionButtons;
}

// ── History ─────────────────────────────────────────────────────────────
export function renderHistory(history) {
  const { historyList, queryInput } = state.dom;
  if (!historyList) return;
  historyList.innerHTML = "";

  if (history.length === 0) {
    const empty = document.createElement("div");
    empty.className = "popup-history-empty";
    empty.textContent = msg("popup_emptyHistory", "暂无搜索记录");
    historyList.appendChild(empty);
    return;
  }

  history.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "popup-history-item";
    const query = String(entry.query || "").replace(/\s+/g, " ").trim();
    const dateText = formatHistoryDate(entry.createdAt);

    const line = document.createElement("div");
    line.className = "popup-history-line";

    const queryEl = document.createElement("div");
    queryEl.className = "popup-history-query";
    queryEl.textContent = query;
    queryEl.addEventListener("click", () => {
      if (queryInput) {
        queryInput.value = entry.query || "";
        queryInput.focus();
      }
    });

    const metaSlot = document.createElement("div");
    metaSlot.className = "popup-history-meta-slot";

    const meta = document.createElement("div");
    meta.className = "popup-history-meta";
    meta.textContent = dateText;

    metaSlot.appendChild(meta);
    metaSlot.appendChild(buildPopupHistoryActionButtons(entry, {
      onDelete: () => removeHistoryEntry(entry),
    }));

    line.appendChild(queryEl);
    line.appendChild(metaSlot);
    item.appendChild(line);
    historyList.appendChild(item);
  });
}

async function removeHistoryEntry(entry) {
  const stored = await chrome.storage.local.get([SEARCH_HISTORY_STORAGE_KEY]);
  const fullHistory = Array.isArray(stored[SEARCH_HISTORY_STORAGE_KEY])
    ? stored[SEARCH_HISTORY_STORAGE_KEY]
    : [];
  if (!fullHistory.length) return;

  let removed = false;
  const nextHistory = fullHistory.filter((item) => {
    if (removed) return true;
    if (entry?.id && item?.id === entry.id) {
      removed = true;
      return false;
    }
    if (!entry?.id && item?.query === entry?.query && item?.createdAt === entry?.createdAt) {
      removed = true;
      return false;
    }
    return true;
  });

  if (!removed) return;
  await chrome.storage.local.set({ [SEARCH_HISTORY_STORAGE_KEY]: nextHistory });
}

// ── Prompt picker ───────────────────────────────────────────────────────
export function closePromptPicker() {
  if (!state.isPromptPickerOpen) return;
  state.isPromptPickerOpen = false;
  if (state.popupPreviewMgr) state.popupPreviewMgr.hide();
  renderPromptPicker();
  state.updatePromptPickerLayoutState();
}

export function togglePromptPicker() {
  state.isPromptPickerOpen = !state.isPromptPickerOpen;
  renderPromptPicker();
}

export function renderPromptPicker() {
  state.updatePromptPickerLayoutState();
  const { promptPicker, promptEntryBtn, queryInput } = state.dom;

  if (!promptPicker || !promptEntryBtn || state.uiPrefs.showPromptButton === false) {
    if (promptPicker) promptPicker.hidden = true;
    state.updatePromptPickerLayoutState();
    return;
  }

  promptPicker.innerHTML = "";
  promptEntryBtn.setAttribute("aria-expanded", String(state.isPromptPickerOpen));

  if (!state.isPromptPickerOpen) {
    promptPicker.hidden = true;
    state.updatePromptPickerLayoutState();
    return;
  }

  promptPicker.hidden = false;

  if (!state.promptGroups.length) {
    const empty = document.createElement("div");
    empty.className = "popup-prompt-picker-empty";
    empty.textContent = msg("popup_emptyPromptGroups", "还没有提示词分组，请先去设置里添加。");
    promptPicker.appendChild(empty);
    state.updatePromptPickerLayoutState();
    return;
  }

  const activeGroup =
    state.promptGroups.find((group) => group.id === state.activePromptGroupId) ||
    state.promptGroups[0];
  if (!activeGroup) {
    state.updatePromptPickerLayoutState();
    return;
  }

  const groupsColumn = document.createElement("div");
  groupsColumn.className = "popup-prompt-groups";

  state.promptGroups.forEach((group) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.groupId = group.id;
    button.className = `popup-prompt-group-item${group.id === activeGroup.id ? " is-active" : ""}`;
    button.textContent = getPromptGroupDisplayName(group);
    button.addEventListener("mouseenter", () => {
      if (state.activePromptGroupId === group.id) return;
      state.activePromptGroupId = group.id;
      switchPopupPromptGroup(state, promptPicker, queryInput);
    });
    button.addEventListener("click", () => {
      if (state.activePromptGroupId === group.id) return;
      state.activePromptGroupId = group.id;
      switchPopupPromptGroup(state, promptPicker, queryInput);
    });
    groupsColumn.appendChild(button);
  });

  promptPicker.appendChild(groupsColumn);
  promptPicker.appendChild(buildPopupPromptsColumn(state, activeGroup, queryInput));

  const footer = document.createElement("div");
  footer.className = "popup-prompt-picker-footer";
  const settingsLink = document.createElement("button");
  settingsLink.type = "button";
  settingsLink.className = "popup-prompt-picker-settings-btn";
  settingsLink.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>${msg("popup_managePrompts", "管理提示词")}`;
  settingsLink.addEventListener("click", async (e) => {
    e.stopPropagation();
    await chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE", section: "prompts" });
    window.close();
  });
  footer.appendChild(settingsLink);
  promptPicker.appendChild(footer);

  state.updatePromptPickerLayoutState();
}

function buildPopupPromptsColumn(state, activeGroup, queryInput) {
  const promptsColumn = document.createElement("div");
  promptsColumn.className = "popup-prompt-list";

  const entries = getDisplayPromptEntries(activeGroup, state.promptGroups);
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "popup-prompt-picker-empty";
    empty.textContent = isAllPromptGroup(activeGroup)
      ? msg("popup_emptyPrompts", "还没有提示词，请先去设置里添加。")
      : msg("popup_emptyPromptsInGroup", "这个分组里还没有提示词。");
    promptsColumn.appendChild(empty);
  } else {
    state.popupPreviewMgr =
      state.popupPreviewMgr || window.PromptItemUI.createPreviewManager(null);
    entries.forEach(({ prompt, sourceGroup }) => {
      const item = window.PromptItemUI.createItem(prompt, {
        onFill: (p) => {
          if (queryInput) {
            queryInput.value = p.content || "";
            closePromptPicker();
            state.syncComposerLayout({ scrollToTop: true });
            requestAnimationFrame(() => {
              queryInput.focus();
              queryInput.setSelectionRange(0, 0);
              queryInput.scrollTop = 0;
              state.syncComposerLayout({ scrollToTop: true });
            });
          }
        },
        onEdit: (p) => openPopupPromptEditModal(p, sourceGroup.id),
        previewManager: state.popupPreviewMgr,
      });
      promptsColumn.appendChild(item);
    });
  }
  return promptsColumn;
}

function switchPopupPromptGroup(state, promptPicker, queryInput) {
  if (!promptPicker || promptPicker.hidden) return;

  // 只更新左侧分类按钮激活状态，不重建左侧
  promptPicker.querySelectorAll(".popup-prompt-group-item").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.groupId === state.activePromptGroupId);
  });

  // 仅替换右侧提示词列表
  const activeGroup =
    state.promptGroups.find((g) => g.id === state.activePromptGroupId) || state.promptGroups[0];
  if (!activeGroup) return;

  const oldList = promptPicker.querySelector(".popup-prompt-list");
  const newList = buildPopupPromptsColumn(state, activeGroup, queryInput);
  if (oldList) {
    oldList.replaceWith(newList);
  } else {
    const footer = promptPicker.querySelector(".popup-prompt-picker-footer");
    promptPicker.insertBefore(newList, footer || null);
  }
}
