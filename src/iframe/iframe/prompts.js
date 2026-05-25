import { DEFAULT_PROMPT_GROUP_ID } from "../../shared/storage-keys.js";
import {
  isAllPromptGroup,
  getPromptGroupDisplayName,
  getDisplayPromptEntries,
} from "../../shared/prompt-groups.js";
import { state, elements, STORAGE_KEYS, promptPreview } from "./state.js";
import { updateSendBtnState } from "./status.js";
import { escapeHtml } from "./utils.js";

/** 将提示词插入底部输入框光标位置（各布局通用） */
export function applyPromptFill(prompt) {
  const ta = elements.queryInput;
  if (!ta) return;

  const content = String(prompt?.content || "");
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  const before = ta.value.slice(0, start);
  const after = ta.value.slice(end);
  ta.value = before + content + after;
  const newCursor = before.length + content.length;

  closePromptPicker();
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  updateSendBtnState();

  requestAnimationFrame(() => {
    ta.focus();
    try {
      ta.setSelectionRange(newCursor, newCursor);
    } catch (_) {}
    updateSendBtnState();
  });
}

export function bindPromptPickerEvents() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !state.isPromptPickerOpen) {
      return;
    }

    if (target.closest("#promptAssistBtn") || target.closest("#promptPicker")) {
      return;
    }

    closePromptPicker();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.isPromptPickerOpen) {
      closePromptPicker();
      elements.queryInput?.focus();
    }
  });
}

export function togglePromptPicker() {
  state.isPromptPickerOpen = !state.isPromptPickerOpen;
  renderPromptPicker();
}

export function closePromptPicker() {
  if (!state.isPromptPickerOpen) {
    return;
  }
  state.isPromptPickerOpen = false;
  if (promptPreview.mgr) promptPreview.mgr.hide();
  renderPromptPicker();
}

// ── 编辑弹窗 ──
export function openPromptEditModal(prompt, groupId) {
  closePromptPicker();

  // 找当前的 prompt 对象（引用）
  let targetGroup = state.promptGroups.find((g) => g.id === groupId) || state.promptGroups[0];
  let targetPrompt = targetGroup?.prompts.find((p) => p.id === prompt.id);
  if (!targetPrompt) return;

  const overlay = document.createElement("div");
  overlay.className = "prompt-edit-modal-overlay";

  const modal = document.createElement("div");
  modal.className = "prompt-edit-modal";
  modal.innerHTML = `
    <div class="prompt-edit-modal-title">编辑提示词</div>
    <div>
      <label class="prompt-edit-field-label">名称</label>
      <input class="prompt-edit-input" type="text" value="${escapeHtml(targetPrompt.title || "")}" />
    </div>
    <div>
      <label class="prompt-edit-field-label">分类</label>
      <select class="prompt-edit-select">
        ${state.promptGroups.map((g) => `<option value="${escapeHtml(g.id)}"${g.id === groupId ? " selected" : ""}>${escapeHtml(getPromptGroupDisplayName(g))}</option>`).join("")}
        <option value="__new__">＋ 新建分组…</option>
      </select>
      <input class="prompt-edit-input prompt-edit-new-group-input" type="text" placeholder="输入新分组名称" style="display:none;margin-top:8px;" />
    </div>
    <div>
      <label class="prompt-edit-field-label">提示词内容</label>
      <textarea class="prompt-edit-textarea">${escapeHtml(targetPrompt.content || "")}</textarea>
    </div>
    <div class="prompt-edit-actions">
      <button class="prompt-edit-delete-btn" type="button">删除</button>
      <div class="prompt-edit-main-btns">
        <button class="prompt-edit-cancel-btn" type="button">取消</button>
        <button class="prompt-edit-save-btn" type="button">保存</button>
      </div>
    </div>
  `;

  const titleInput = modal.querySelector(".prompt-edit-input");
  const groupSelect = modal.querySelector(".prompt-edit-select");
  const newGroupInput = modal.querySelector(".prompt-edit-new-group-input");
  const contentInput = modal.querySelector(".prompt-edit-textarea");
  const cancelBtn = modal.querySelector(".prompt-edit-cancel-btn");
  const saveBtn = modal.querySelector(".prompt-edit-save-btn");
  const deleteBtn = modal.querySelector(".prompt-edit-delete-btn");

  // 选择「新建分组」时显示输入框
  groupSelect?.addEventListener("change", () => {
    const isNew = groupSelect instanceof HTMLSelectElement && groupSelect.value === "__new__";
    if (newGroupInput instanceof HTMLInputElement) {
      newGroupInput.style.display = isNew ? "block" : "none";
      if (isNew) requestAnimationFrame(() => newGroupInput.focus());
    }
  });

  cancelBtn.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  saveBtn.addEventListener("click", async () => {
    const newTitle = (titleInput instanceof HTMLInputElement ? titleInput.value : "").trim() || "未命名提示词";
    const newContent = contentInput instanceof HTMLTextAreaElement ? contentInput.value : "";
    let newGroupId = groupSelect instanceof HTMLSelectElement ? groupSelect.value : groupId;

    // 处理新建分组
    if (newGroupId === "__new__") {
      const newName = (newGroupInput instanceof HTMLInputElement ? newGroupInput.value : "").trim() || "新建分组";
      const newGroup = { id: `prompt-group-${Date.now()}`, name: newName, prompts: [] };
      state.promptGroups.push(newGroup);
      newGroupId = newGroup.id;
    }

    // 从原分组删除
    state.promptGroups.forEach((g) => {
      g.prompts = g.prompts.filter((p) => p.id !== targetPrompt.id);
    });
    // 放入目标分组
    const destGroup = state.promptGroups.find((g) => g.id === newGroupId) || targetGroup;
    destGroup.prompts.push({ id: targetPrompt.id, title: newTitle, content: newContent });

    await chrome.storage.local.set({ [STORAGE_KEYS.promptGroups]: state.promptGroups });
    overlay.remove();
  });

  deleteBtn.addEventListener("click", async () => {
    if (!window.confirm("确定要删除这条提示词吗？")) return;
    state.promptGroups.forEach((g) => {
      g.prompts = g.prompts.filter((p) => p.id !== targetPrompt.id);
    });
    await chrome.storage.local.set({ [STORAGE_KEYS.promptGroups]: state.promptGroups });
    overlay.remove();
  });

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  if (titleInput instanceof HTMLInputElement) {
    requestAnimationFrame(() => titleInput.focus());
  }
}

export function renderPromptPicker() {
  if (!elements.promptPicker || !elements.promptAssistBtn) {
    return;
  }

  elements.promptAssistBtn.style.display = state.promptGroups.length > 0 ? "inline-flex" : "none";

  elements.promptPicker.innerHTML = "";
  elements.promptAssistBtn.setAttribute("aria-expanded", String(state.isPromptPickerOpen));

  if (!state.isPromptPickerOpen) {
    elements.promptPicker.hidden = true;
    return;
  }

  elements.promptPicker.hidden = false;

  if (!state.promptGroups.length) {
    const empty = document.createElement("div");
    empty.className = "popup-prompt-picker-empty";
    empty.textContent = "还没有提示词分组，请先去设置里添加。";
    elements.promptPicker.appendChild(empty);
    return;
  }

  const activeGroup = state.promptGroups.find((group) => group.id === state.activePromptGroupId) || state.promptGroups[0];
  if (!activeGroup) {
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
      if (state.activePromptGroupId === group.id) {
        return;
      }
      state.activePromptGroupId = group.id;
      switchPromptGroup();
    });
    button.addEventListener("click", () => {
      if (state.activePromptGroupId === group.id) {
        return;
      }
      state.activePromptGroupId = group.id;
      switchPromptGroup();
    });
    groupsColumn.appendChild(button);
  });

  elements.promptPicker.appendChild(groupsColumn);
  elements.promptPicker.appendChild(buildPromptsColumn(activeGroup));
}

function buildPromptsColumn(activeGroup) {
  const promptsColumn = document.createElement("div");
  promptsColumn.className = "popup-prompt-list";

  const entries = getDisplayPromptEntries(activeGroup, state.promptGroups);
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "popup-prompt-picker-empty";
    empty.textContent = isAllPromptGroup(activeGroup)
      ? "还没有提示词，请先去设置里添加。"
      : "这个分组里还没有提示词。";
    promptsColumn.appendChild(empty);
  } else {
    promptPreview.mgr = promptPreview.mgr || window.PromptItemUI.createPreviewManager(null);
    entries.forEach(({ prompt, sourceGroup }) => {
      const item = window.PromptItemUI.createItem(prompt, {
        onFill: (p) => applyPromptFill(p),
        onEdit: (p) => openPromptEditModal(p, sourceGroup.id),
        previewManager: promptPreview.mgr,
      });
      promptsColumn.appendChild(item);
    });
  }
  return promptsColumn;
}

function switchPromptGroup() {
  if (!elements.promptPicker || elements.promptPicker.hidden) return;

  // 只更新左侧分类按钮的激活状态，不重建左侧
  elements.promptPicker.querySelectorAll(".popup-prompt-group-item").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.groupId === state.activePromptGroupId);
  });

  // 仅替换右侧提示词列表
  const activeGroup =
    state.promptGroups.find((g) => g.id === state.activePromptGroupId) || state.promptGroups[0];
  if (!activeGroup) return;

  const oldList = elements.promptPicker.querySelector(".popup-prompt-list");
  const newList = buildPromptsColumn(activeGroup);
  if (oldList) {
    oldList.replaceWith(newList);
  } else {
    elements.promptPicker.appendChild(newList);
  }
}

// Keep DEFAULT_PROMPT_GROUP_ID imported so tree-shaking doesn't drop it;
// prompt-groups helpers rely on it transitively.
export { DEFAULT_PROMPT_GROUP_ID };
