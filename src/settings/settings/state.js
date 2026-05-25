// Shared mutable state, constants and DOM refs for the settings page.
// Each module imports this singleton and mutates fields directly instead of
// juggling closure bindings and callback chains.

import { AI_SITE_IDS } from "../../shared/site-registry.js";
import { FEATURE_MEMORY } from "../../shared/features.js";
export { AI_SITE_GROUPS, SOCIAL_SITE_GROUPS } from "../../shared/site-groups.js";

const qshotI18n = (typeof window !== "undefined" && window.__QSHOT_I18N__) || {};
export const t = qshotI18n.t;
export const applyDomI18n = qshotI18n.applyDomI18n;

export const msg = (key, fallback) => (t ? (t(key) || fallback || "") : fallback || "");

export const PICKER_CLOSE_DELAY_MS = 320;

export const COMMON_SEARCH_PARAM_KEYS = [
  "q", "query", "wd", "word", "kw", "keyword", "s", "search", "key", "k", "text", "term", "w"
];

export const SITE_CATEGORIES = {
  ai: { label: "AI", siteIds: [...AI_SITE_IDS] },
  other: { labelKey: "settings_groups_categoryOther", label: "社媒平台", siteIds: ["xiaohongshu", "bilibili", "zhihu", "douyin", "twitter", "youtube", "reddit", "tiktok"] },
  custom: { labelKey: "settings_groups_categoryCustom", label: "自定义", siteIds: [] }
};

export function getSiteCategoryLabel(categoryKey) {
  const category = SITE_CATEGORIES[categoryKey];
  if (!category) return "";
  return category.labelKey ? msg(category.labelKey, category.label) : category.label;
}

export const SECTION_META = {
  groups: {
    eyebrowKey: "settings_groupsTitle",
    eyebrow: "搜索组设置",
    titleKey: "settings_sectionTitle_groups",
    title: "分组与调用内容",
    subtitleKey: "settings_sectionSubtitle_groups",
    subtitle: "管理搜索组名称、启用状态、打开方式，以及每个组内调用的网站或 AI 模型。"
  },
  prompts: {
    eyebrowKey: "settings_promptsTitle",
    eyebrow: "提示词设置",
    titleKey: "settings_meta_promptsTitle",
    title: "提示词管理",
    subtitleKey: "settings_meta_promptsSubtitle",
    subtitle: "自由添加和管理您的常用提示词，让每次输入更高效。"
  },
  custom: {
    eyebrowKey: "settings_customTitle",
    eyebrow: "自定义搜索",
    titleKey: "settings_meta_customTitle",
    title: "自定义搜索站点",
    subtitleKey: "settings_meta_customSubtitle",
    subtitle: "添加自己的搜索站点，保存后可在搜索组的“自定义”分类中直接勾选。"
  },
  random: {
    eyebrowKey: "settings_randomTitle",
    eyebrow: "随机问题库",
    titleKey: "settings_meta_randomTitle",
    title: "随机问题库",
    subtitleKey: "settings_meta_randomSubtitle",
    subtitle: "管理骰子按钮随机抽取的问题，一行一个问题。"
  },
  other: {
    eyebrowKey: "settings_shortcutsTitle",
    eyebrow: "进阶搜索项",
    title: "",
    subtitle: ""
  },
  misc: {
    eyebrow: "",
    title: "",
    subtitle: ""
  },
  aiSummary: {
    eyebrowKey: "settings_aiSummaryEyebrow",
    eyebrow: "AI 总结设置",
    title: "",
    subtitle: ""
  },
  ...(FEATURE_MEMORY
    ? {
        memory: {
          eyebrowKey: "settings_memoryEyebrow",
          eyebrow: "本地实验模块",
          titleKey: "settings_memoryTitle",
          title: "记忆功能",
          subtitleKey: "settings_memorySubtitle",
          subtitle:
            "把 ChatGPT、DeepSeek、豆包、Kimi 的对话本地归档，按平台/模型和日期筛选，并维护可手动注入的记忆卡片。",
        },
      }
    : {}),
  about: {
    eyebrow: "",
    title: "",
    subtitle: ""
  }
};

export const GROUP_MODE_OPTIONS = [
  { value: "compare", labelKey: "settings_groups_modeCompare", label: "卡片呈现" },
  { value: "tabs", labelKey: "settings_groups_modeTabs", label: "新开标签" }
];

export function getGroupModeLabel(option) {
  return msg(option.labelKey, option.label);
}

// Shared mutable state. Populated by main.js#start after DOM is ready.
export const state = {
  groups: [],
  promptGroups: [],
  uiPrefs: null,
  randomQuestionsText: null,
  defaultRandomQuestionsText: "",
  sites: [],
  customSites: [],
  customFormState: createBlankCustomFormState(),
  activeCustomTab: "search",
  activeMiscTab: "other",
  activeOtherTab: "global",
  activeSection: "groups",
  quickAccessSiteIds: [],
  selectionContextGroups: [],
  openCtxPickerGroupId: null,
  activeCtxPickerCategoryKey: null,
  ctxPickerCloseTimerId: null,
  openQuickSitesPicker: false,
  quickPickerCategoryKey: null,
  quickPickerCloseTimerId: null,
  openPickerGroupId: null,
  activePickerCategoryKey: null,
  pickerCloseTimerId: null,
  suppressPickerAnimation: false,
  activePromptGroupId: null,
  promptEditorState: null,
  pendingPromptGroupFocusId: null,
  renamingPromptGroupId: null,
  importModalState: null,
  _promptHoverTimer: null,
  _hoverCardKeyHandler: null,
  // DOM refs — populated in main.js#cacheElements.
  dom: {
    groupsSection: null,
    promptsSection: null,
    customSection: null,
    randomSection: null,
    otherSection: null,
    miscSection: null,
    aiSummarySection: null,
    memorySection: null,
    aboutSection: null,
    sectionEyebrow: null,
    sectionContentHeader: null,
    sectionLogoWrap: null,
    sectionTitleRow: null,
    sectionTitle: null,
    sectionSubtitle: null,
    promptsHeaderActions: null,
    promptLearnLink: null,
    navItems: [],
  },
  // Callbacks registered by main.js so section modules can trigger re-render
  // without creating import cycles.
  renderCurrentSection: () => {},
  renderGroupsSection: () => {},
  renderPromptsSection: () => {},
  renderCustomSection: () => {},
  renderRandomSection: () => {},
  renderOtherSection: () => {},
  renderMiscSection: () => {},
  renderAiSummarySection: () => {},
  renderMemorySection: () => {},
  renderAboutSection: () => {},
};

export function createBlankCustomFormState() {
  return {
    mode: "create",
    editingId: null,
    customType: "url",
    name: "",
    url: "",
    converterInput: "",
    converterError: "",
    formError: ""
  };
}
