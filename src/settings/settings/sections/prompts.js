import { DEFAULT_PROMPT_GROUP_ID } from "../../../shared/storage-keys.js";
import {
  getAllPromptGroupName,
  isAllPromptGroup,
} from "../../../shared/prompt-groups.js";
import { state, msg } from "../state.js";
import { escapeHtml } from "../utils.js";
import {
  persistAll,
  createNormalizedPromptGroups,
  getDisplayPromptEntries,
} from "../store.js";
import {
  attachPromptGroupDrag,
  attachPromptItemDrag,
  attachPromptItemDragAll,
} from "../drag.js";
import {
  showPromptHoverCard,
  createPromptEditorModal,
} from "./prompts-editor.js";
import { createAiPageLauncherSetting } from "./prompts-ai-launcher-setting.js";

function createPromptDisplayToggleCard() {
  const card = document.createElement("section");
  card.className = "other-settings-card prompt-settings-toggle-card";
  card.appendChild(createAiPageLauncherSetting());
  return card;
}

export function renderPromptsSection() {
  const { promptsSection } = state.dom;
  promptsSection.innerHTML = "";
  promptsSection.appendChild(createPromptDisplayToggleCard());

  if (!state.promptGroups.length) {
    state.promptGroups = createNormalizedPromptGroups([]);
  }
  if (!state.activePromptGroupId || !state.promptGroups.some((group) => group.id === state.activePromptGroupId)) {
    state.activePromptGroupId = state.promptGroups[0]?.id || null;
  }

  const activeGroup = state.promptGroups.find((group) => group.id === state.activePromptGroupId) || state.promptGroups[0];
  if (!activeGroup) {
    return;
  }

  const shell = document.createElement("section");
  shell.className = "prompt-settings-shell";
  shell.appendChild(createPromptGroupSidebar(activeGroup));
  shell.appendChild(createPromptContentPanel(activeGroup));
  promptsSection.appendChild(shell);

  if (state.promptEditorState) {
    promptsSection.appendChild(createPromptEditorModal());
  }
}

function createPromptGroupSidebar(activeGroup) {
  const aside = document.createElement("aside");
  aside.className = "prompt-groups-sidebar";

  const list = document.createElement("div");
  list.className = "prompt-groups-list";
  state.promptGroups.forEach((group) => {
    list.appendChild(createPromptGroupItem(group, activeGroup));
  });

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "prompt-sidebar-add-btn";
  addBtn.textContent = "+ " + msg("settings_prompts_addGroup", "添加分组");
  addBtn.addEventListener("click", () => {
    const newGroup = {
      id: `prompt-group-${Date.now()}`,
      name: "",
      prompts: []
    };
    state.promptGroups.push(newGroup);
    state.activePromptGroupId = newGroup.id;
    state.renamingPromptGroupId = newGroup.id;
    state.pendingPromptGroupFocusId = newGroup.id;
    renderPromptsSection();
  });

  const addBtnWrap = document.createElement("div");
  addBtnWrap.className = "prompt-sidebar-add-wrap";
  addBtnWrap.appendChild(addBtn);

  aside.appendChild(list);
  aside.appendChild(addBtnWrap);

  attachPromptGroupDrag(list);
  return aside;
}

function createPromptGroupItem(group, activeGroup) {
  const isActive = group.id === activeGroup.id;
  const isAll = isAllPromptGroup(group);
  const isRenaming = !isAll && state.renamingPromptGroupId === group.id;
  const isLocked = isAll;
  const displayName = isAll ? getAllPromptGroupName() : group.name;

  const row = document.createElement("div");
  row.className = `prompt-group-nav-item${isActive ? " is-active" : ""}${!displayName.trim() && !isRenaming ? " is-empty" : ""}${isRenaming ? " is-renaming" : ""}${isAll ? " is-locked" : ""}`;
  row.dataset.groupId = group.id;

  if (isRenaming) {
    const input = document.createElement("input");
    input.className = "prompt-group-nav-input";
    input.type = "text";
    input.value = group.name;
    input.placeholder = msg("settings_prompts_groupPlaceholder", "请输入分组名称");

    let committed = false;
    const commit = async () => {
      if (committed) return;
      committed = true;
      const nextName = input.value.trim();
      group.name = nextName || msg("settings_prompts_newGroupName", "新建分组");
      if (state.renamingPromptGroupId === group.id) {
        state.renamingPromptGroupId = null;
      }
      await persistAll();
      renderPromptsSection();
    };

    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        input.blur();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        committed = true;
        if (state.renamingPromptGroupId === group.id) {
          state.renamingPromptGroupId = null;
        }
        renderPromptsSection();
      }
    });
    input.addEventListener("blur", commit);

    row.appendChild(input);

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
    if (state.pendingPromptGroupFocusId === group.id) {
      state.pendingPromptGroupFocusId = null;
    }
    return row;
  }

  const nameEl = document.createElement("span");
  nameEl.className = "prompt-group-nav-name";
  nameEl.textContent = displayName || msg("overlay_unnamedPromptGroup", "未命名分组");
  row.appendChild(nameEl);

  row.addEventListener("click", (ev) => {
    if (ev.target.closest(".prompt-group-nav-action")) return;
    state.activePromptGroupId = group.id;
    renderPromptsSection();
  });

  if (isActive && !isAll) {
    const actions = document.createElement("div");
    actions.className = "prompt-group-nav-actions";

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "prompt-group-nav-action prompt-group-nav-rename";
    renameBtn.setAttribute("aria-label", msg("settings_prompts_renameGroupAria", "重命名分组"));
    renameBtn.title = msg("settings_prompts_renameGroupTitle", "重命名");
    renameBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    renameBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      state.renamingPromptGroupId = group.id;
      renderPromptsSection();
    });
    actions.appendChild(renameBtn);

    if (!isLocked) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "prompt-group-nav-action prompt-group-nav-delete";
      deleteBtn.setAttribute("aria-label", msg("settings_prompts_deleteGroupAria", "删除分组"));
      deleteBtn.title = msg("settings_prompts_deleteGroupTitle", "删除分组");
      deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>`;
      deleteBtn.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const shouldDelete = window.confirm(msg("settings_prompts_deleteGroupConfirm", "是否要删除该提示词分组？"));
        if (!shouldDelete) return;
        state.promptGroups = state.promptGroups.filter((g) => g.id !== group.id);
        if (!state.promptGroups.length) {
          state.promptGroups = createNormalizedPromptGroups([]);
        }
        state.activePromptGroupId = state.promptGroups[0]?.id || null;
        await persistAll();
        renderPromptsSection();
      });
      actions.appendChild(deleteBtn);
    }

    const dragHandle = document.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "prompt-group-nav-action prompt-group-nav-drag";
    dragHandle.setAttribute("aria-label", msg("settings_prompts_dragGroupAria", "拖动排序"));
    dragHandle.title = msg("settings_prompts_dragGroupTitle", "拖动排序");
    dragHandle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>`;
    actions.appendChild(dragHandle);

    row.appendChild(actions);
  }

  return row;
}

function createPromptContentPanel(activeGroup) {
  const panel = document.createElement("section");
  panel.className = "prompt-content-panel";

  const isAll = isAllPromptGroup(activeGroup);
  const entries = getDisplayPromptEntries(activeGroup);
  const displayName = isAll ? getAllPromptGroupName() : (activeGroup.name || msg("overlay_unnamedPromptGroup", "未命名分组"));

  const header = document.createElement("div");
  header.className = "prompt-content-header";
  header.innerHTML = `
    <div>
      <div class="prompt-content-title">${escapeHtml(displayName)}</div>
      <div class="prompt-content-subtitle">${msg("settings_prompts_countPrefix", "当前分类下共 ")}${entries.length}${msg("settings_prompts_countSuffix", " 条提示词")}</div>
    </div>
  `;
  panel.appendChild(header);

  const list = document.createElement("div");
  list.className = "prompt-cards-list";
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "site-selection-empty";
    empty.textContent = isAll
      ? msg("settings_prompts_emptyAll", "还没有任何提示词，点击下方按钮添加。")
      : msg("settings_prompts_emptyGroup", "当前分组还没有提示词，点击下方按钮添加。");
    list.appendChild(empty);
  } else {
    entries.forEach(({ prompt, sourceGroup }) => {
      list.appendChild(createPromptCard(sourceGroup, prompt, { disableDrag: false }));
    });
    if (isAll) {
      attachPromptItemDragAll(list);
    } else {
      attachPromptItemDrag(list, activeGroup);
    }
  }
  panel.appendChild(list);

  const bottomAddWrap = document.createElement("div");
  bottomAddWrap.className = "prompt-panel-bottom-add";
  const bottomAddBtn = document.createElement("button");
  bottomAddBtn.type = "button";
  bottomAddBtn.className = "prompt-panel-add-btn";
  bottomAddBtn.textContent = msg("settings_prompts_addPromptCta", "添加提示词");
  bottomAddBtn.addEventListener("click", () => {
    state.promptEditorState = {
      mode: "create",
      // 在"全部"视图下新建时，默认写入第一个真实分组（非全部）；用户仍可在弹窗里改为其它分组。
      groupId: isAll
        ? (state.promptGroups.find((g) => !isAllPromptGroup(g))?.id || state.promptGroups[0]?.id)
        : activeGroup.id,
      promptId: null,
      title: "",
      content: ""
    };
    renderPromptsSection();
  });
  bottomAddWrap.appendChild(bottomAddBtn);
  panel.appendChild(bottomAddWrap);

  return panel;
}

function createPromptCard(group, prompt, options = {}) {
  const disableDrag = !!options.disableDrag;
  const item = document.createElement("article");
  item.className = "prompt-card-item";
  item.dataset.promptId = prompt.id;
  item.dataset.groupId = group.id;

  const inline = document.createElement("div");
  inline.className = "prompt-card-inline";

  // 铅笔编辑按钮
  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "prompt-icon-btn prompt-edit-icon-btn";
  editBtn.setAttribute("aria-label", msg("common_edit", "编辑"));
  editBtn.title = msg("common_edit", "编辑");
  editBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  editBtn.addEventListener("click", () => {
    state.promptEditorState = {
      mode: "edit",
      groupId: group.id,
      promptId: prompt.id,
      title: prompt.title || "",
      content: prompt.content || ""
    };
    renderPromptsSection();
  });

  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className = "prompt-icon-btn prompt-preview-icon-btn";
  previewBtn.setAttribute("aria-label", msg("settings_prompts_previewAria", "预览"));
  previewBtn.title = msg("settings_prompts_previewTitle", "预览内容");
  previewBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  let hoverTimer = null;
  previewBtn.addEventListener("mouseenter", () => {
    hoverTimer = setTimeout(() => {
      showPromptHoverCard(prompt, group, previewBtn);
    }, 200);
  });
  previewBtn.addEventListener("mouseleave", () => {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
  });

  // 拖拽手柄
  const dragHandle = document.createElement("button");
  dragHandle.type = "button";
  dragHandle.className = "prompt-icon-btn prompt-card-drag-handle";
  dragHandle.setAttribute("aria-label", msg("settings_prompts_dragGroupAria", "拖动排序"));
  dragHandle.title = msg("settings_prompts_dragGroupTitle", "拖动排序");
  dragHandle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.6"/><circle cx="15" cy="5" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="19" r="1.6"/><circle cx="15" cy="19" r="1.6"/></svg>`;

  const titleEl = document.createElement("div");
  titleEl.className = "prompt-card-title";
  titleEl.textContent = prompt.title || msg("overlay_unnamedPrompt", "未命名提示词");

  const rightGroup = document.createElement("div");
  rightGroup.className = "prompt-card-icon-group";
  rightGroup.appendChild(editBtn);
  rightGroup.appendChild(previewBtn);
  if (!disableDrag) {
    rightGroup.appendChild(dragHandle);
  }

  inline.appendChild(titleEl);
  inline.appendChild(rightGroup);
  item.appendChild(inline);

  return item;
}
