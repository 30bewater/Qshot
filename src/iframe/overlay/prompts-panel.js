import { state, t } from "./state.js";
import { getPromptGroupDisplayName, getDisplayPromptEntries } from "../../shared/prompt-groups.js";
import { RANDOM_QUESTIONS_FILES } from "./constants.js";
import { RANDOM_QUESTIONS_STORAGE_KEY } from "../../shared/storage-keys.js";

let randomQuestionsPromise = null;
let lastRandomQuestionIndex = -1;

// Reset cache when user edits the random-questions text in Settings.
try {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[RANDOM_QUESTIONS_STORAGE_KEY]) {
      randomQuestionsPromise = null;
      lastRandomQuestionIndex = -1;
    }
  });
} catch (_e) {
  /* chrome.storage may be unavailable in some sub-frames */
}

function parseRandomQuestionsText(text) {
  if (typeof text !== "string") return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

async function fetchDefaultRandomQuestionsText() {
  const lang = (() => {
    try {
      const chromeLang = (chrome?.i18n?.getUILanguage?.() || "").toLowerCase();
      if (chromeLang) return chromeLang;
      const navLang = (navigator?.language || "").toLowerCase();
      return navLang || "";
    } catch (_e) {
      return (navigator.language || "").toLowerCase();
    }
  })();
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
    const uiLang = (() => {
      try {
        return (chrome?.i18n?.getUILanguage?.() || navigator.language || "").toLowerCase();
      } catch (_e) {
        return (navigator.language || "").toLowerCase();
      }
    })();
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
      // Legacy default content starts with a # comment block; treat as "not
      // customized" and fall back to the built-in question file.
      const isOldDefault = typeof raw === "string" && raw.trimStart().startsWith("#");
      const hasCustomText = typeof raw === "string" && raw.trim().length > 0;
      const isOtherLangDefault = hasCustomText && raw.trim() === otherDefaultText.trim();
      if (hasCustomText && !isOldDefault && !isOtherLangDefault) {
        return parseRandomQuestionsText(raw);
      }
    } catch (_e) {
      /* fall back to default file */
    }
    return parseRandomQuestionsText(currentDefaultText);
  })();
  return randomQuestionsPromise;
}

export async function fillRandomQuestion() {
  if (!state.shadowRoot) return;
  const questions = await loadRandomQuestions();
  if (!questions.length) return;
  const queryInput = state.shadowRoot.querySelector(".query-input");
  if (!(queryInput instanceof HTMLTextAreaElement)) return;
  // With >=2 questions, avoid drawing the same one twice in a row.
  let idx = Math.floor(Math.random() * questions.length);
  if (questions.length > 1 && idx === lastRandomQuestionIndex) {
    idx = (idx + 1 + Math.floor(Math.random() * (questions.length - 1))) % questions.length;
  }
  lastRandomQuestionIndex = idx;
  queryInput.value = questions[idx];
  queryInput.dispatchEvent(new Event("input", { bubbles: true }));
  queryInput.focus();
}

export function renderPromptPickerIfOpen() {
  if (!state.shadowRoot) return;
  const picker = state.shadowRoot.querySelector(".prompt-picker");
  if (!picker) return;

  picker.innerHTML = "";
  if (!state.isPromptPickerOpen || state.uiPrefs.showPromptButton === false) {
    picker.hidden = true;
    return;
  }
  picker.hidden = false;

  if (!state.promptGroups.length) {
    const empty = document.createElement("div");
    empty.className = "prompt-empty";
    empty.textContent = t("overlay_emptyPromptGroups", null, "还没有提示词分组，请先去设置里添加。");
    picker.appendChild(empty);
    return;
  }

  const activeGroup =
    state.promptGroups.find((g) => g.id === state.activePromptGroupId) || state.promptGroups[0];
  state.activePromptGroupId = activeGroup.id;

  const groupsCol = document.createElement("div");
  groupsCol.className = "prompt-groups-col";
  state.promptGroups.forEach((group) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `prompt-group-item${group.id === activeGroup.id ? " is-active" : ""}`;
    btn.textContent = getPromptGroupDisplayName(group);
    btn.addEventListener("mouseenter", () => {
      if (state.activePromptGroupId === group.id) return;
      state.activePromptGroupId = group.id;
      renderPromptPickerIfOpen();
    });
    btn.addEventListener("click", () => {
      state.activePromptGroupId = group.id;
      renderPromptPickerIfOpen();
    });
    groupsCol.appendChild(btn);
  });

  const listCol = document.createElement("div");
  listCol.className = "prompt-list-col";
  const entries = getDisplayPromptEntries(activeGroup, state.promptGroups);
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "prompt-empty";
    empty.textContent = t("overlay_emptyPromptsInGroup", null, "这个分组里还没有提示词。");
    listCol.appendChild(empty);
  } else {
    entries.forEach(({ prompt }) => {
      if (!state.overlayPreviewMgr) {
        state.overlayPreviewMgr = window.PromptItemUI.createPreviewManager(state.shadowRoot);
      }
      const overlayItem = window.PromptItemUI.createItem(prompt, {
        itemClass: "prompt-item",
        labelClass: "prompt-item-label",
        iconsClass: "prompt-item-icons",
        iconBtnClass: "prompt-icon-btn",
        onFill: (p) => {
          const queryInput = state.shadowRoot.querySelector(".query-input");
          if (queryInput instanceof HTMLTextAreaElement) {
            const content = String(p.content || "");
            const start = queryInput.selectionStart ?? queryInput.value.length;
            const end = queryInput.selectionEnd ?? queryInput.value.length;
            const before = queryInput.value.slice(0, start);
            const after = queryInput.value.slice(end);
            queryInput.value = before + content + after;
            const newCursor = before.length + content.length;
            queryInput.dispatchEvent(new Event("input", { bubbles: true }));
            queryInput.focus();
            try { queryInput.setSelectionRange(newCursor, newCursor); } catch (_) {}
          }
          state.isPromptPickerOpen = false;
          if (state.overlayPreviewMgr) state.overlayPreviewMgr.hide();
          renderPromptPickerIfOpen();
        },
        onEdit: () => {
          chrome.runtime
            .sendMessage({ type: "OPEN_SETTINGS_PAGE", section: "prompts" })
            .catch(() => {});
          state.closeOverlay();
        },
        previewManager: state.overlayPreviewMgr,
      });
      listCol.appendChild(overlayItem);
    });
  }

  const footer = document.createElement("div");
  footer.className = "prompt-picker-footer";
  const footerBtn = document.createElement("button");
  footerBtn.type = "button";
  footerBtn.className = "prompt-picker-footer-btn";
  footerBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>${t("overlay_managePrompts", null, "管理提示词")}`;
  footerBtn.addEventListener("click", () => {
    chrome.runtime
      .sendMessage({ type: "OPEN_SETTINGS_PAGE", section: "prompts" })
      .catch(() => {});
    state.closeOverlay();
  });
  footer.appendChild(footerBtn);

  picker.appendChild(groupsCol);
  picker.appendChild(listCol);
  picker.appendChild(footer);
}
