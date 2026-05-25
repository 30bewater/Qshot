export const SEARCH_GROUPS_STORAGE_KEY = "searchGroups";
export const PROMPT_GROUPS_STORAGE_KEY = "promptGroups";
export const UI_PREFS_STORAGE_KEY = "uiPrefs";
export const LAUNCHER_FAB_POSITIONS_STORAGE_KEY = "launcherFabPositions";
export const CUSTOM_SITES_STORAGE_KEY = "customSites";
export const RANDOM_QUESTIONS_STORAGE_KEY = "randomQuestionsText";
export const SEARCH_HISTORY_STORAGE_KEY = "searchHistory";
export const QUICK_ACCESS_SITES_KEY = "quickAccessSites";
/** 右键选文专用：附带提示词的搜索组（仅出现在右键菜单） */
export const SELECTION_CONTEXT_GROUPS_STORAGE_KEY = "selectionContextGroups";
/** AI 一键总结：服务商、API Key、模型、自定义 Base URL、提示词 */
export const AI_SUMMARY_SETTINGS_STORAGE_KEY = "aiSummarySettings";

// The fixed "All" prompt group: always first, cannot be deleted or renamed.
export const DEFAULT_PROMPT_GROUP_ID = "prompt-group-default";
export const LEGACY_DEFAULT_GROUP_NAME = "默认分组";

export const RANDOM_QUESTIONS_FILES = {
  zh: "config/random-questions/zh-CN.txt",
  en: "config/random-questions/en.txt",
};

// ── Compare page layout keys (only used by iframe/iframe/*) ──────────────────
// Defined here so shared/storage-keys.js is the single source of truth for
// ALL chrome.storage key strings across the extension.
export const CARD_SIZE_LEVEL_KEY = "cardSizeLevel";
export const LAYOUT_ROWS_KEY = "layoutRows";
export const LAYOUT_MODE_KEY = "layoutMode";
