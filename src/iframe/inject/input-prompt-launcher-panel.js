import {
  DEFAULT_PROMPT_GROUP_ID,
  LEGACY_DEFAULT_GROUP_NAME,
  PROMPT_GROUPS_STORAGE_KEY,
} from "../../shared/storage-keys.js";
import {
  getPromptGroupDisplayName,
  getDisplayPromptEntries,
  getAllPromptGroupName,
} from "../../shared/prompt-groups.js";

const MANAGE_FOOTER_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>`;

export function normalizePromptGroups(input) {
  if (!Array.isArray(input) || !input.length) return [];

  const source = input.filter(Boolean).map((group, gi) => ({
    id: String(group.id || `prompt-group-${gi}`),
    name: String(group.name || ""),
    prompts: Array.isArray(group.prompts)
      ? group.prompts.map((p, pi) => ({
          id: String(p.id || `prompt-${gi}-${pi}`),
          title: String(p.title || "\u672a\u547d\u540d\u63d0\u793a\u8bcd"),
          content: String(p.content || ""),
        }))
      : [],
  }));

  const defaultName = getAllPromptGroupName();
  let defaultIndex = source.findIndex((g) => g.id === DEFAULT_PROMPT_GROUP_ID);
  if (defaultIndex < 0) {
    defaultIndex = source.findIndex((g) => g.name === LEGACY_DEFAULT_GROUP_NAME);
    if (defaultIndex >= 0) {
      source[defaultIndex] = { ...source[defaultIndex], id: DEFAULT_PROMPT_GROUP_ID };
    }
  }
  if (defaultIndex < 0) {
    source.unshift({ id: DEFAULT_PROMPT_GROUP_ID, name: defaultName, prompts: [] });
  } else {
    const def = source.splice(defaultIndex, 1)[0];
    def.name = defaultName;
    source.unshift(def);
  }
  return source;
}

export function installPanelInteraction(panel, { isOpen, onApplyPrompt }) {
  if (!panel || panel.dataset.qshotBound) return;
  panel.dataset.qshotBound = "1";
  panel.addEventListener("pointerup", (e) => {
    if (!isOpen()) return;
    if (e.target.closest(".prompt-icon-btn")) return;
    if (!e.target.closest(".prompt-item-label")) return;
    const item = e.target.closest(".prompt-item");
    const prompt = item?._qshotPrompt;
    if (prompt) onApplyPrompt(prompt.content || "");
  });
}

function appendManageFooter(panelFooter, onClosePanel) {
  const footerBtn = document.createElement("button");
  footerBtn.type = "button";
  footerBtn.className = "prompt-picker-footer-btn";
  footerBtn.innerHTML = `${MANAGE_FOOTER_SVG}\u7ba1\u7406\u63d0\u793a\u8bcd`;
  footerBtn.addEventListener("click", () => {
    chrome.runtime
      .sendMessage({ type: "OPEN_SETTINGS_PAGE", section: "prompts" })
      .catch(() => {});
    onClosePanel();
  });
  panelFooter.appendChild(footerBtn);
}

export function renderLauncherPromptPanel({
  groupsCol,
  listCol,
  panelFooter,
  shadow,
  promptGroups,
  activeGroupId,
  setActiveGroupId,
  previewMgr,
  setPreviewMgr,
  onApplyPrompt,
  onClosePanel,
  onSaveEdit,
  rerender,
}) {
  if (!groupsCol || !listCol || !panelFooter) return;

  groupsCol.innerHTML = "";
  listCol.innerHTML = "";
  panelFooter.innerHTML = "";

  if (!window.PromptItemUI) {
    const empty = document.createElement("section");
    empty.className = "prompt-empty";
    empty.textContent = "Prompt UI failed to load.";
    listCol.appendChild(empty);
    return;
  }

  if (!promptGroups.length) {
    const empty = document.createElement("section");
    empty.className = "prompt-empty";
    empty.textContent = "\u8fd8\u6ca1\u6709\u63d0\u793a\u8bcd\u5206\u7ec4\uff0c\u8bf7\u5148\u53bb\u8bbe\u7f6e\u91cc\u6dfb\u52a0\u3002";
    listCol.appendChild(empty);
    appendManageFooter(panelFooter, onClosePanel);
    return;
  }

  const activeGroup = promptGroups.find((g) => g.id === activeGroupId) || promptGroups[0];
  setActiveGroupId(activeGroup.id);

  promptGroups.forEach((group) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `prompt-group-item${group.id === activeGroup.id ? " is-active" : ""}`;
    btn.textContent = getPromptGroupDisplayName(group);
    btn.addEventListener("mouseenter", () => {
      if (activeGroupId === group.id) return;
      setActiveGroupId(group.id);
      rerender();
    });
    btn.addEventListener("click", () => {
      setActiveGroupId(group.id);
      rerender();
    });
    groupsCol.appendChild(btn);
  });

  const entries = getDisplayPromptEntries(activeGroup, promptGroups);
  if (!entries.length) {
    const empty = document.createElement("section");
    empty.className = "prompt-empty";
    empty.textContent = "\u8fd9\u4e2a\u5206\u7ec4\u91cc\u8fd8\u6ca1\u6709\u63d0\u793a\u8bcd\u3002";
    listCol.appendChild(empty);
  } else {
    let mgr = previewMgr;
    if (!mgr) {
      mgr = window.PromptItemUI.createPreviewManager(shadow);
      setPreviewMgr(mgr);
    }
    entries.forEach(({ prompt }) => {
      const item = window.PromptItemUI.createItem(prompt, {
        itemClass: "prompt-item",
        labelClass: "prompt-item-label",
        iconsClass: "prompt-item-icons",
        iconBtnClass: "prompt-icon-btn",
        onFill: (p) => onApplyPrompt(p?.content || ""),
        onSaveEdit,
        previewManager: mgr,
      });
      item._qshotPrompt = prompt;
      listCol.appendChild(item);
    });
  }

  appendManageFooter(panelFooter, onClosePanel);
}
