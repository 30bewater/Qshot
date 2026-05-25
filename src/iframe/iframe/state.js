// Shared mutable state + element refs + constants for the compare page.
// Modules import this singleton and mutate fields directly instead of
// threading N arguments through call chains. main.js is the sole module
// that calls cacheElements() to populate `elements`.

import {
  SEARCH_HISTORY_STORAGE_KEY,
  PROMPT_GROUPS_STORAGE_KEY,
  CARD_SIZE_LEVEL_KEY,
  LAYOUT_ROWS_KEY,
  LAYOUT_MODE_KEY,
} from "../../shared/storage-keys.js";

export const BASE_CONFIG = globalThis.QSHOT_BASE_CONFIG || {};

// Single source of truth for all chrome.storage keys used by the compare page.
// Values come from shared/storage-keys.js so they can never drift out of sync
// with settings / popup / overlay.
export const STORAGE_KEYS = {
  cardSizeLevel: CARD_SIZE_LEVEL_KEY,
  layoutRows: LAYOUT_ROWS_KEY,
  layoutMode: LAYOUT_MODE_KEY,
  searchHistory: SEARCH_HISTORY_STORAGE_KEY,
  promptGroups: PROMPT_GROUPS_STORAGE_KEY,
};

export const SITE_CATEGORIES = [
  { id: "ai", label: "AI", builtinIds: ["deepseek", "doubao", "kimi", "yuanbao", "qianwen", "qwen", "metaso", "chatglm", "xiaomimimo", "zhida", "zai", "gemini", "chatgpt", "claude", "grok", "dots", "perplexity", "monica", "poe", "copilot"] },
  { id: "other", labelKey: "settings_groups_categoryOther", label: "社媒平台", builtinIds: ["xiaohongshu", "bilibili", "zhihu", "douyin", "twitter", "youtube", "reddit", "tiktok"] },
  { id: "custom", labelKey: "settings_groups_categoryCustom", label: "自定义", builtinIds: [] }
];

export const state = {
  sites: [],
  allSites: [],
  requestedSiteIds: null,
  hiddenSiteIds: new Set(),
  cardRefs: new Map(),
  columnCount: "1",
  maximizedSiteId: null,
  shouldAutoSend: false,
  restoreHistoryEntryId: null,
  pendingDispatches: new Map(),
  pendingFileDispatches: new Map(),
  cardSizeLevel: "3",
  layoutRows: 1,
  layoutMode: "grid",
  activeSidebarSiteId: null,
  searchHistory: [],
  historyDateFilter: "all",
  currentHistoryEntryId: null,
  historyEntryIdBySiteId: new Map(),
  promptGroups: [],
  activePromptGroupId: null,
  isPromptPickerOpen: false,
  lockedScrollLeft: null,
  scrollUnlockTimerId: null,
  isScrollLocked: false,
  scrollGuardActive: false,
  scrollGuardLeft: 0,
  scrollGuardTop: 0,
  scrollGuardRafId: null,
  scrollGuardTimerId: null,
  userIsScrolling: false,
  userScrollTimer: null,
  isSending: false,
  lastSearchQuery: null,
  lastSearchTime: null,
  isAddSitePickerOpen: false,
  activeAddSiteCategory: "ai",
  // 并发槽位系统：
  //   loadingRefs：当前处于"加载中"（已赋 src、尚未 load/error/超时）的 ref 集合，
  //                size 不会超过 BASE_CONFIG.iframeMaxConcurrent。
  //   loadQueue ：已创建 iframe DOM 但尚未被允许赋 src 的 ref 队列，按入队顺序 FIFO。
  // 每当 loadingRefs 里有 ref 完成/失败/超时时调用 pumpLoadQueue 从队列取下一个补位。
  loadingRefs: new Set(),
  loadQueue: []
};

export const elements = {};

// 预览卡片管理器（由 shared/prompt-item.js 提供）
export const promptPreview = { mgr: null };
