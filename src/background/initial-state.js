import {
  SEARCH_GROUPS_STORAGE_KEY,
  SELECTION_CONTEXT_GROUPS_STORAGE_KEY,
  UI_PREFS_STORAGE_KEY,
  QUICK_ACCESS_SITES_KEY,
  AI_SUMMARY_SETTINGS_STORAGE_KEY,
} from "../shared/storage-keys.js";
import { saveAiSummarySettings } from "../shared/ai-summary-api.js";

const DEFAULT_SOCIAL_OVERSEAS_GROUP_MIGRATED_KEY = "defaultSocialOverseasGroupMigrated";
const DEFAULT_SOCIAL_OVERSEAS_MODE_MIGRATED_KEY = "defaultSocialOverseasModeMigrated";
const DEFAULT_SOCIAL_OVERSEAS_TIKTOK_MIGRATED_KEY = "defaultSocialOverseasTiktokMigrated";
const COPILOT_SITE_ID_MIGRATED_KEY = "copilotSiteIdMigrated";

export async function ensureInitialStateDefaults() {
  // Only initialize when keys are missing/empty.
  const stored = await chrome.storage.local.get([
    SEARCH_GROUPS_STORAGE_KEY,
    "promptGroups",
    SELECTION_CONTEXT_GROUPS_STORAGE_KEY,
    "customSites",
    UI_PREFS_STORAGE_KEY,
    DEFAULT_SOCIAL_OVERSEAS_GROUP_MIGRATED_KEY,
    DEFAULT_SOCIAL_OVERSEAS_MODE_MIGRATED_KEY,
    DEFAULT_SOCIAL_OVERSEAS_TIKTOK_MIGRATED_KEY,
    COPILOT_SITE_ID_MIGRATED_KEY,
  ]);

  const hasGroups = Array.isArray(stored[SEARCH_GROUPS_STORAGE_KEY]) && stored[SEARCH_GROUPS_STORAGE_KEY].length > 0;
  const hasPromptGroups = Array.isArray(stored.promptGroups) && stored.promptGroups.length > 0;
  const hasSelectionContextGroups = Array.isArray(stored[SELECTION_CONTEXT_GROUPS_STORAGE_KEY])
    && stored[SELECTION_CONTEXT_GROUPS_STORAGE_KEY].length > 0;
  const hasCustomSites = Array.isArray(stored.customSites);
  const hasQuickAccessSites = Array.isArray(stored[QUICK_ACCESS_SITES_KEY]);
  const hasAiSummarySettings = stored[AI_SUMMARY_SETTINGS_STORAGE_KEY]
    && typeof stored[AI_SUMMARY_SETTINGS_STORAGE_KEY] === "object";
  const hasUiPrefs = stored[UI_PREFS_STORAGE_KEY] && typeof stored[UI_PREFS_STORAGE_KEY] === "object";
  const shouldReplaceLegacyPromptGroups = isLegacyDefaultPromptGroups(stored.promptGroups);
  const shouldAddDefaultSocialOverseasGroup = shouldAddDefaultGroup(
    stored[SEARCH_GROUPS_STORAGE_KEY],
    "default-social-overseas",
    stored[DEFAULT_SOCIAL_OVERSEAS_GROUP_MIGRATED_KEY]
  );
  const shouldMigrateDefaultSocialOverseasMode = shouldMigrateDefaultGroupMode(
    stored[SEARCH_GROUPS_STORAGE_KEY],
    "default-social-overseas",
    stored[DEFAULT_SOCIAL_OVERSEAS_MODE_MIGRATED_KEY]
  );
  const shouldAddTiktokToOverseas = shouldAddSiteIdToGroup(
    stored[SEARCH_GROUPS_STORAGE_KEY],
    "default-social-overseas",
    "tiktok",
    stored[DEFAULT_SOCIAL_OVERSEAS_TIKTOK_MIGRATED_KEY]
  );
  const shouldMigrateCopilotSiteId = stored[COPILOT_SITE_ID_MIGRATED_KEY] !== true
    && Array.isArray(stored[SEARCH_GROUPS_STORAGE_KEY])
    && stored[SEARCH_GROUPS_STORAGE_KEY].some((group) =>
      Array.isArray(group?.siteIds) && group.siteIds.includes("m365_copilot")
    );

  if (
    hasGroups &&
    !shouldAddDefaultSocialOverseasGroup &&
    !shouldMigrateDefaultSocialOverseasMode &&
    !shouldAddTiktokToOverseas &&
    !shouldMigrateCopilotSiteId &&
    hasPromptGroups &&
    !shouldReplaceLegacyPromptGroups &&
    hasSelectionContextGroups &&
    hasCustomSites &&
    hasQuickAccessSites &&
    hasAiSummarySettings &&
    hasUiPrefs
  ) {
    return;
  }

  const defaults = await loadInitialStateFromConfig().catch(() => null);
  if (!defaults && !shouldMigrateCopilotSiteId) {
    return;
  }

  const patch = {};
  if (!hasGroups && defaults && Array.isArray(defaults.searchGroups) && defaults.searchGroups.length > 0) {
    patch[SEARCH_GROUPS_STORAGE_KEY] = defaults.searchGroups;
    patch[DEFAULT_SOCIAL_OVERSEAS_GROUP_MIGRATED_KEY] = true;
  } else if (shouldAddDefaultSocialOverseasGroup && defaults && Array.isArray(defaults.searchGroups)) {
    const defaultGroup = defaults.searchGroups.find((group) => group.id === "default-social-overseas");
    if (defaultGroup) {
      patch[SEARCH_GROUPS_STORAGE_KEY] = [...stored[SEARCH_GROUPS_STORAGE_KEY], defaultGroup];
      patch[DEFAULT_SOCIAL_OVERSEAS_GROUP_MIGRATED_KEY] = true;
      patch[DEFAULT_SOCIAL_OVERSEAS_MODE_MIGRATED_KEY] = true;
    }
  } else if (shouldMigrateDefaultSocialOverseasMode || shouldAddTiktokToOverseas) {
    patch[SEARCH_GROUPS_STORAGE_KEY] = stored[SEARCH_GROUPS_STORAGE_KEY].map((group) => {
      if (group?.id !== "default-social-overseas") return group;
      const next = { ...group };
      if (shouldMigrateDefaultSocialOverseasMode) {
        next.mode = "tabs";
      }
      if (shouldAddTiktokToOverseas) {
        const siteIds = Array.isArray(next.siteIds) ? [...next.siteIds] : [];
        if (!siteIds.includes("tiktok")) siteIds.push("tiktok");
        next.siteIds = siteIds;
      }
      return next;
    });
    if (shouldMigrateDefaultSocialOverseasMode) {
      patch[DEFAULT_SOCIAL_OVERSEAS_MODE_MIGRATED_KEY] = true;
    }
    if (shouldAddTiktokToOverseas) {
      patch[DEFAULT_SOCIAL_OVERSEAS_TIKTOK_MIGRATED_KEY] = true;
    }
  }
  if (shouldMigrateCopilotSiteId) {
    patch[SEARCH_GROUPS_STORAGE_KEY] = migrateSiteIdInGroups(
      patch[SEARCH_GROUPS_STORAGE_KEY] || stored[SEARCH_GROUPS_STORAGE_KEY],
      "m365_copilot",
      "copilot"
    );
    patch[COPILOT_SITE_ID_MIGRATED_KEY] = true;
  }
  if (defaults && (!hasPromptGroups || shouldReplaceLegacyPromptGroups) && Array.isArray(defaults.promptGroups) && defaults.promptGroups.length > 0) {
    patch.promptGroups = defaults.promptGroups;
  }
  if (
    defaults
    && !hasSelectionContextGroups
    && Array.isArray(defaults.selectionContextGroups)
    && defaults.selectionContextGroups.length > 0
  ) {
    patch[SELECTION_CONTEXT_GROUPS_STORAGE_KEY] = defaults.selectionContextGroups;
  }
  if (defaults && !hasCustomSites && Array.isArray(defaults.customSites)) {
    patch.customSites = defaults.customSites;
  }
  if (defaults && !hasQuickAccessSites && Array.isArray(defaults.quickAccessSites)) {
    patch[QUICK_ACCESS_SITES_KEY] = defaults.quickAccessSites;
  }
  if (defaults && !hasUiPrefs && defaults.uiPrefs && typeof defaults.uiPrefs === "object") {
    patch[UI_PREFS_STORAGE_KEY] = defaults.uiPrefs;
  }

  if (Object.keys(patch).length > 0) {
    await chrome.storage.local.set(patch);
  }
  if (defaults && !hasAiSummarySettings && defaults.aiSummarySettings && typeof defaults.aiSummarySettings === "object") {
    await saveAiSummarySettings(defaults.aiSummarySettings);
  }
}

function isLegacyDefaultPromptGroups(promptGroups) {
  if (!Array.isArray(promptGroups) || promptGroups.length !== 1) return false;
  const [group] = promptGroups;
  const prompts = Array.isArray(group?.prompts) ? group.prompts : [];
  if (prompts.length !== 1) return false;
  const [prompt] = prompts;
  return (
    group.id === "prompt-group-default" &&
    prompt.id === "prompt-default-1" &&
    prompt.title === "总结重点"
  );
}

function shouldAddDefaultGroup(groups, groupId, hasMigrated) {
  if (!Array.isArray(groups) || groups.length === 0) return false;
  if (hasMigrated === true) return false;
  return !groups.some((group) => group?.id === groupId);
}

function shouldMigrateDefaultGroupMode(groups, groupId, hasMigrated) {
  if (!Array.isArray(groups) || groups.length === 0) return false;
  if (hasMigrated === true) return false;
  const group = groups.find((item) => item?.id === groupId);
  if (!group || group.mode === "tabs") return false;
  return Array.isArray(group.siteIds) && ["twitter", "youtube", "reddit"].every((siteId) => group.siteIds.includes(siteId));
}

function shouldAddSiteIdToGroup(groups, groupId, siteId, hasMigrated) {
  if (!Array.isArray(groups) || groups.length === 0) return false;
  if (hasMigrated === true) return false;
  const group = groups.find((item) => item?.id === groupId);
  if (!group || !Array.isArray(group.siteIds)) return false;
  return !group.siteIds.includes(siteId);
}

function migrateSiteIdInGroups(groups, fromId, toId) {
  if (!Array.isArray(groups)) return groups;
  return groups.map((group) => {
    if (!Array.isArray(group?.siteIds) || !group.siteIds.includes(fromId)) {
      return group;
    }
    const siteIds = group.siteIds.map((id) => (id === fromId ? toId : id));
    return { ...group, siteIds: [...new Set(siteIds)] };
  });
}

async function loadInitialStateFromConfig() {
  const configPath = getInitialStateConfigPath();
  let resp = await fetch(chrome.runtime.getURL(configPath));
  if (!resp.ok && configPath !== "config/initialState.json") {
    resp = await fetch(chrome.runtime.getURL("config/initialState.json"));
  }
  if (!resp.ok) {
    throw new Error("无法读取初始配置");
  }
  const payload = await resp.json();
  if (!payload || typeof payload !== "object") {
    throw new Error("初始配置无效");
  }

  const {
    searchGroups,
    promptGroups,
    selectionContextGroups,
    customSites,
    quickAccessSites,
    aiSummarySettings,
    uiPrefs,
  } = payload;
  if (!Array.isArray(searchGroups) || searchGroups.length === 0) return null;
  if (!Array.isArray(promptGroups) || promptGroups.length === 0) return null;
  if (!Array.isArray(customSites)) return null;
  if (!uiPrefs || typeof uiPrefs !== "object") return null;

  return {
    searchGroups,
    promptGroups,
    selectionContextGroups: Array.isArray(selectionContextGroups) ? selectionContextGroups : [],
    customSites,
    quickAccessSites: Array.isArray(quickAccessSites) ? quickAccessSites : [],
    aiSummarySettings: aiSummarySettings && typeof aiSummarySettings === "object" ? aiSummarySettings : null,
    uiPrefs,
  };
}

function getInitialStateConfigPath() {
  const lang = getBrowserLanguage();
  if (lang.startsWith("zh")) {
    return "config/initialState.zh-CN.json";
  }
  return "config/initialState.en.json";
}

function getBrowserLanguage() {
  try {
    const chromeLang = chrome?.i18n?.getUILanguage?.();
    if (chromeLang) return String(chromeLang).toLowerCase();
  } catch (_e) {
    // ignore
  }
  try {
    return String(navigator?.language || "en").toLowerCase();
  } catch (_e) {
    return "en";
  }
}
