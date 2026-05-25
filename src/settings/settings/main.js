// Orchestration for the settings page: caches DOM refs, loads storage,
// binds events, and dispatches to section renderers.

import {
  SEARCH_GROUPS_STORAGE_KEY as GROUPS_STORAGE_KEY,
  PROMPT_GROUPS_STORAGE_KEY as PROMPTS_STORAGE_KEY,
  UI_PREFS_STORAGE_KEY,
  CUSTOM_SITES_STORAGE_KEY,
  RANDOM_QUESTIONS_STORAGE_KEY,
  QUICK_ACCESS_SITES_KEY,
  SELECTION_CONTEXT_GROUPS_STORAGE_KEY,
} from "../../shared/storage-keys.js";
import {
  state,
  msg,
  applyDomI18n,
  SECTION_META,
} from "./state.js";
import { loadBuiltinSites } from "./utils.js";
import {
  createNormalizedGroups,
  createNormalizedSelectionContextGroups,
  createNormalizedPromptGroups,
  createNormalizedUiPrefs,
  createNormalizedCustomSites,
  mergeSites,
  syncCustomCategoryIds,
} from "./store.js";
import { attachGroupDrag } from "./drag.js";
import { renderGroupsSection, closePicker } from "./sections/groups.js";
import { renderPromptsSection } from "./sections/prompts.js";
import { renderCustomSection } from "./sections/custom.js";
import {
  renderRandomSection,
  loadDefaultRandomQuestionsText,
} from "./sections/random.js";
import { renderOtherSection } from "./sections/other.js";
import { closeCtxPicker } from "./sections/selection-context-groups.js";
import { renderMiscSection } from "./sections/misc.js";
import { createAiSummaryProviderCard } from "./sections/misc-ai-summary.js";
import { applyDarkModeToDoc } from "../../shared/theme.js";
import { FEATURE_MEMORY } from "../../shared/features.js";
import { renderMemorySection as renderMemorySectionImpl } from "./sections/memory.js";
import { renderAboutSection } from "./sections/about.js";
import { handleExport, handleImportFileChange } from "./import-export.js";

const renderMemorySection = FEATURE_MEMORY ? renderMemorySectionImpl : () => {};

export function initSettingsPage() {
  document.addEventListener("DOMContentLoaded", start);
}

function cacheElements() {
  state.dom.groupsSection = document.getElementById("groupsSection");
  state.dom.promptsSection = document.getElementById("promptsSection");
  state.dom.customSection = document.getElementById("customSection");
  state.dom.randomSection = document.getElementById("randomSection");
  state.dom.otherSection = document.getElementById("otherSection");
  state.dom.miscSection = document.getElementById("miscSection");
  state.dom.aiSummarySection = document.getElementById("aiSummarySection");
  state.dom.memorySection = document.getElementById("memorySection");
  state.dom.aboutSection = document.getElementById("aboutSection");
  state.dom.sectionEyebrow = document.getElementById("sectionEyebrow");
  state.dom.sectionContentHeader = document.querySelector(".settings-content-header");
  state.dom.sectionLogoWrap = document.getElementById("sectionLogoWrap");
  state.dom.sectionTitleRow = document.getElementById("sectionTitleRow");
  state.dom.sectionTitle = document.getElementById("sectionTitle");
  state.dom.sectionSubtitle = document.getElementById("sectionSubtitle");
  state.dom.promptsHeaderActions = document.getElementById("promptsHeaderActions");
  state.dom.promptLearnLink = document.getElementById("promptLearnLink");
  state.dom.navItems = Array.from(document.querySelectorAll(".settings-nav-item"));
}

function registerRenderCallbacks() {
  state.renderCurrentSection = renderCurrentSection;
  state.renderGroupsSection = renderGroupsSection;
  state.renderPromptsSection = renderPromptsSection;
  state.renderCustomSection = renderCustomSection;
  state.renderRandomSection = renderRandomSection;
  state.renderOtherSection = renderOtherSection;
  state.renderMiscSection = renderMiscSection;
  state.renderAiSummarySection = renderAiSummarySection;
  state.renderAboutSection = renderAboutSection;
}

async function start() {
  cacheElements();
  registerRenderCallbacks();

  const [builtinSites, stored] = await Promise.all([
    loadBuiltinSites(),
    chrome.storage.local.get([
      GROUPS_STORAGE_KEY,
      PROMPTS_STORAGE_KEY,
      UI_PREFS_STORAGE_KEY,
      CUSTOM_SITES_STORAGE_KEY,
      RANDOM_QUESTIONS_STORAGE_KEY,
      QUICK_ACCESS_SITES_KEY,
      SELECTION_CONTEXT_GROUPS_STORAGE_KEY,
    ]),
  ]);
  state.customSites = createNormalizedCustomSites(stored[CUSTOM_SITES_STORAGE_KEY]);
  state.sites = mergeSites(builtinSites, state.customSites);
  state.quickAccessSiteIds = Array.isArray(stored[QUICK_ACCESS_SITES_KEY])
    ? stored[QUICK_ACCESS_SITES_KEY].filter((id) => typeof id === "string")
    : [];
  syncCustomCategoryIds();
  state.groups = createNormalizedGroups(stored[GROUPS_STORAGE_KEY]);
  state.selectionContextGroups = createNormalizedSelectionContextGroups(
    stored[SELECTION_CONTEXT_GROUPS_STORAGE_KEY]
  );
  state.promptGroups = createNormalizedPromptGroups(stored[PROMPTS_STORAGE_KEY]);
  state.uiPrefs = createNormalizedUiPrefs(stored[UI_PREFS_STORAGE_KEY]);
  applyDarkModeToDoc(state.uiPrefs.darkMode);
  window.__QSHOT_I18N__?.setLocaleMode?.(state.uiPrefs.localeMode);
  applyDomI18n?.(document);
  const uiLang = (window.__QSHOT_I18N__?.getUiLanguage?.() || navigator.language || "").toLowerCase();
  const otherLang = uiLang.startsWith("zh") ? "en" : "zh";
  const [defaultRandomQuestionsText, otherDefaultRandomQuestionsText] = await Promise.all([
    loadDefaultRandomQuestionsText(uiLang),
    loadDefaultRandomQuestionsText(otherLang),
  ]);
  state.defaultRandomQuestionsText = defaultRandomQuestionsText;
  const storedRaw = stored[RANDOM_QUESTIONS_STORAGE_KEY];
  // 如果存储的内容是旧版（以 # 注释开头的说明块），视为未自定义，替换为新的干净默认题库
  const isOldDefault = typeof storedRaw === "string" && storedRaw.trimStart().startsWith("#");
  const hasUserRandomQuestions = typeof storedRaw === "string" && storedRaw.trim().length > 0;
  const normalizedRaw = hasUserRandomQuestions ? storedRaw.trim() : "";
  const normalizedOtherDefault = otherDefaultRandomQuestionsText.trim();
  const isStoredOtherLangDefault = normalizedRaw && normalizedRaw === normalizedOtherDefault;
  state.randomQuestionsText = (hasUserRandomQuestions && !isOldDefault && !isStoredOtherLangDefault)
    ? storedRaw
    : state.defaultRandomQuestionsText;
  state.activePromptGroupId = state.promptGroups[0]?.id || null;

  if (!Array.isArray(stored[GROUPS_STORAGE_KEY]) || stored[GROUPS_STORAGE_KEY].length === 0) {
    await chrome.storage.local.set({ [GROUPS_STORAGE_KEY]: state.groups });
  }
  if (!Array.isArray(stored[PROMPTS_STORAGE_KEY]) || stored[PROMPTS_STORAGE_KEY].length === 0) {
    await chrome.storage.local.set({ [PROMPTS_STORAGE_KEY]: state.promptGroups });
  }
  if (!stored[UI_PREFS_STORAGE_KEY] || typeof stored[UI_PREFS_STORAGE_KEY] !== "object") {
    await chrome.storage.local.set({ [UI_PREFS_STORAGE_KEY]: state.uiPrefs });
  }
  if (!Array.isArray(stored[CUSTOM_SITES_STORAGE_KEY])) {
    await chrome.storage.local.set({ [CUSTOM_SITES_STORAGE_KEY]: state.customSites });
  }

  bindEvents();
  const urlParams = new URLSearchParams(location.search);
  const miscTab = urlParams.get("miscTab");
  let hashSection = urlParams.get("section") || location.hash.replace("#", "");
  // 旧链接兼容：section=misc&miscTab=ai → 直接跳转到 aiSummary
  if (hashSection === "misc" && miscTab === "ai") {
    hashSection = "aiSummary";
  }
  if (hashSection && SECTION_META[hashSection]) {
    setActiveSection(hashSection);
  } else {
    setActiveSection(state.activeSection);
  }
}

function bindEvents() {
  document.addEventListener("click", handleDocumentClick);
  attachGroupDrag(state.dom.groupsSection);

  state.dom.navItems.forEach((item) => {
    item.addEventListener("click", () => {
      setActiveSection(item.dataset.section || "groups");
    });
  });

  const exportBtn = document.getElementById("promptExportBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", handleExport);
  }
  const importBtn = document.getElementById("promptImportBtn");
  if (importBtn) {
    importBtn.addEventListener("click", () => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".md,.json";
      fileInput.addEventListener("change", handleImportFileChange);
      fileInput.click();
    });
  }
}

function handleDocumentClick(event) {
  if (state.openQuickSitesPicker && !event.target.closest(".quick-sites-add-wrap")) {
    state.openQuickSitesPicker = false;
    state.quickPickerCategoryKey = null;
    if (state.quickPickerCloseTimerId) {
      clearTimeout(state.quickPickerCloseTimerId);
      state.quickPickerCloseTimerId = null;
    }
    renderOtherSection();
    return;
  }
  if (state.openPickerGroupId && !event.target.closest(".inline-add-wrap")) {
    closePicker();
    renderGroupsSection();
    return;
  }
  if (state.openCtxPickerGroupId && !event.target.closest(".inline-add-wrap")) {
    closeCtxPicker();
    renderOtherSection();
    return;
  }

  if (!event.target.closest(".group-mode-dropdown")) {
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
  }
}

function setActiveSection(sectionKey) {
  if (!SECTION_META[sectionKey]) {
    return;
  }
  state.activeSection = sectionKey;
  state.dom.navItems.forEach((item) =>
    item.classList.toggle("is-active", item.dataset.section === sectionKey)
  );
  const meta = SECTION_META[sectionKey];
  const eyebrow = meta.eyebrowKey ? msg(meta.eyebrowKey, meta.eyebrow) : (meta.eyebrow || "");
  const title = meta.titleKey ? msg(meta.titleKey, meta.title) : (meta.title || "");
  const subtitle = meta.subtitleKey ? msg(meta.subtitleKey, meta.subtitle) : (meta.subtitle || "");
  state.dom.sectionEyebrow.textContent = eyebrow;
  state.dom.sectionEyebrow.hidden = true;
  state.dom.sectionTitle.textContent = title;
  state.dom.sectionTitle.hidden = !title;
  state.dom.sectionSubtitle.textContent = subtitle;
  state.dom.sectionSubtitle.hidden = !subtitle;
  state.dom.sectionLogoWrap.hidden = sectionKey !== "about";
  state.dom.sectionTitleRow.hidden = !title && sectionKey !== "prompts";
  if (state.dom.sectionContentHeader) {
    state.dom.sectionContentHeader.hidden =
      !title && !subtitle && sectionKey !== "about" && sectionKey !== "prompts";
  }
  updateSectionVisibility();
  renderCurrentSection();
}

function renderAiSummarySection() {
  const { aiSummarySection } = state.dom;
  if (!aiSummarySection) return;
  aiSummarySection.innerHTML = "";
  aiSummarySection.appendChild(createAiSummaryProviderCard());
}

function renderCurrentSection() {
  updateSectionVisibility();
  if (state.activeSection === "prompts") {
    renderPromptsSection();
    return;
  }
  if (state.activeSection === "custom") {
    renderCustomSection();
    return;
  }
  if (state.activeSection === "random") {
    renderRandomSection();
    return;
  }
  if (state.activeSection === "other") {
    renderOtherSection();
    return;
  }
  if (state.activeSection === "misc") {
    renderMiscSection();
    return;
  }
  if (state.activeSection === "aiSummary") {
    renderAiSummarySection();
    return;
  }
  if (state.activeSection === "memory") {
    renderMemorySection();
    return;
  }
  if (state.activeSection === "about") {
    renderAboutSection();
    return;
  }
  renderGroupsSection();
}

function updateSectionVisibility() {
  const { dom } = state;
  const showGroups = state.activeSection === "groups";
  const showPrompts = state.activeSection === "prompts";
  const showCustom = state.activeSection === "custom";
  const showRandom = state.activeSection === "random";
  const showOther = state.activeSection === "other";
  const showMisc = state.activeSection === "misc";
  const showAiSummary = state.activeSection === "aiSummary";
  const showMemory = FEATURE_MEMORY && state.activeSection === "memory";
  const showAbout = state.activeSection === "about";
  if (dom.groupsSection) {
    dom.groupsSection.hidden = !showGroups;
    dom.groupsSection.style.display = showGroups ? "" : "none";
  }
  if (dom.promptsSection) {
    dom.promptsSection.hidden = !showPrompts;
    dom.promptsSection.style.display = showPrompts ? "flex" : "none";
  }
  if (dom.customSection) {
    dom.customSection.hidden = !showCustom;
    dom.customSection.style.display = showCustom ? "flex" : "none";
  }
  if (dom.randomSection) {
    dom.randomSection.hidden = !showRandom;
    dom.randomSection.style.display = showRandom ? "flex" : "none";
  }
  if (dom.otherSection) {
    dom.otherSection.hidden = !showOther;
    dom.otherSection.style.display = showOther ? "flex" : "none";
  }
  if (dom.miscSection) {
    dom.miscSection.hidden = !showMisc;
    dom.miscSection.style.display = showMisc ? "flex" : "none";
  }
  if (dom.aiSummarySection) {
    dom.aiSummarySection.hidden = !showAiSummary;
    dom.aiSummarySection.style.display = showAiSummary ? "flex" : "none";
  }
  if (dom.memorySection) {
    dom.memorySection.hidden = !showMemory;
    dom.memorySection.style.display = showMemory ? "flex" : "none";
  }
  if (dom.aboutSection) {
    dom.aboutSection.hidden = !showAbout;
    dom.aboutSection.style.display = showAbout ? "flex" : "none";
  }
  if (dom.promptsHeaderActions) {
    dom.promptsHeaderActions.hidden = !showPrompts;
    dom.promptsHeaderActions.style.display = showPrompts ? "flex" : "none";
  }
  if (dom.promptLearnLink) {
    dom.promptLearnLink.hidden = !showPrompts;
  }
}
