import {
  SEARCH_GROUPS_STORAGE_KEY as GROUPS_STORAGE_KEY,
  PROMPT_GROUPS_STORAGE_KEY as PROMPTS_STORAGE_KEY,
  UI_PREFS_STORAGE_KEY,
  CUSTOM_SITES_STORAGE_KEY,
  DEFAULT_PROMPT_GROUP_ID,
  LEGACY_DEFAULT_GROUP_NAME,
  SELECTION_CONTEXT_GROUPS_STORAGE_KEY,
} from "../../shared/storage-keys.js";
import {
  getAllPromptGroupName,
  isAllPromptGroup,
} from "../../shared/prompt-groups.js";
import { normalizeShortcut } from "../../shared/shortcut.js";
import { normalizeAiPagePromptLauncherSites } from "../../shared/ai-page-prompt-launcher-prefs.js";
import { state, SITE_CATEGORIES, COMMON_SEARCH_PARAM_KEYS } from "./state.js";
import { msg } from "./state.js";

export {
  GROUPS_STORAGE_KEY,
  PROMPTS_STORAGE_KEY,
  UI_PREFS_STORAGE_KEY,
  CUSTOM_SITES_STORAGE_KEY,
};

export function createNormalizedGroups(input) {
  const validSiteIds = new Set(state.sites.map((site) => site.id));
  const normalizeLegacySiteId = (siteId) => (siteId === "m365_copilot" ? "copilot" : siteId);
  const source = Array.isArray(input) && input.length > 0
    ? input
    : [
        { id: "default-hunza", name: "混搭搜索", enabled: true, mode: "compare", siteIds: ["gemini", "chatgpt", "deepseek", "doubao", "kimi", "metaso"] },
        { id: "default-overseas", name: "海外模型", enabled: true, mode: "compare", siteIds: ["gemini", "chatgpt", "claude", "grok"] },
        { id: "default-domestic", name: "国内模型", enabled: true, mode: "compare", siteIds: ["deepseek", "doubao", "kimi", "metaso"] },
        { id: "default-single", name: "单个模型", enabled: true, mode: "tabs", siteIds: ["gemini"] }
      ];

  return source.map((group) => ({
    ...group,
    name: String(group.name || "未命名搜索组"),
    enabled: group.enabled !== false,
    mode: group.mode === "tabs" ? "tabs" : "compare",
    siteIds: Array.isArray(group.siteIds)
      ? group.siteIds
          .map(normalizeLegacySiteId)
          .filter((siteId, index, arr) => validSiteIds.has(siteId) && arr.indexOf(siteId) === index)
      : []
  }));
}

export function createNormalizedSelectionContextGroups(input) {
  const validSiteIds = new Set(state.sites.map((site) => site.id));
  const validGroupIds = new Set(state.groups.map((group) => group.id));
  const source = Array.isArray(input) ? input : [];

  return source
    .map((item) => {
      const targetType = item?.targetType === "group" ? "group" : "sites";
      const refGroupId =
        targetType === "group" && validGroupIds.has(item?.refGroupId) ? item.refGroupId : null;
      return {
        id: String(item?.id || `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
        name: String(item?.name || msg("settings_ctx_defaultName", "新选文组")),
        enabled: item?.enabled !== false,
        prompt: String(item?.prompt || ""),
        targetType: refGroupId ? "group" : "sites",
        refGroupId,
        mode: item?.mode === "compare" ? "compare" : "tabs",
        siteIds:
          targetType === "sites" && Array.isArray(item?.siteIds)
            ? item.siteIds.filter(
                (siteId, index, arr) => validSiteIds.has(siteId) && arr.indexOf(siteId) === index
              )
            : [],
      };
    })
    .filter((item) => !!item.id);
}

export function createNormalizedPromptGroups(input) {
  const defaultName = getAllPromptGroupName();
  let source = Array.isArray(input) && input.length > 0 ? [...input] : [];

  if (source.length === 0) {
    source = [
      {
        id: DEFAULT_PROMPT_GROUP_ID,
        name: defaultName,
        prompts: [
          { id: "prompt-default-1", title: "总结重点", content: "请帮我总结这段内容的重点，并列出三条可执行建议。" }
        ]
      }
    ];
  } else {
    let defaultIndex = source.findIndex((g) => g && g.id === DEFAULT_PROMPT_GROUP_ID);
    if (defaultIndex < 0) {
      // 兼容历史数据：名字叫"默认分组"但 id 不同的也视为固定分组
      defaultIndex = source.findIndex((g) => g && g.name === LEGACY_DEFAULT_GROUP_NAME);
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
  }

  return source.map((group) => ({
    id: String(group.id || `prompt-group-${Date.now()}`),
    name: String(group.name || "未命名提示词分组"),
    prompts: Array.isArray(group.prompts)
      ? group.prompts.map((prompt, index) => ({
          id: String(prompt.id || `${group.id || 'prompt'}-${index}`),
          title: String(prompt.title || "未命名提示词"),
          content: String(prompt.content || "")
        }))
      : []
  }));
}

// "全部"分组展示时，列出所有分组的提示词并集；其它分组展示自身的提示词。
// 返回 [{ prompt, sourceGroup }] 结构，方便卡片层拿到提示词真正所属的分组。
export function getDisplayPromptEntries(group) {
  if (!group) return [];
  if (isAllPromptGroup(group)) {
    const out = [];
    state.promptGroups.forEach((g) => {
      (g.prompts || []).forEach((prompt) => {
        out.push({ prompt, sourceGroup: g });
      });
    });
    return out;
  }
  return (group.prompts || []).map((prompt) => ({ prompt, sourceGroup: group }));
}

export function createNormalizedUiPrefs(input) {
  const source = input && typeof input === "object" ? input : {};
  const rawLocale = source.localeMode;
  const localeMode = rawLocale === "zh" || rawLocale === "en" || rawLocale === "auto" ? rawLocale : "auto";
  return {
    showHistory: source.showHistory === true,
    showRandomButton: source.showRandomButton !== false,
    showPromptButton: source.showPromptButton !== false,
    showAiPagePromptLauncher: source.showAiPagePromptLauncher !== false,
    aiPagePromptLauncherSites: normalizeAiPagePromptLauncherSites(source.aiPagePromptLauncherSites),
    prewarmEnabled: source.prewarmEnabled !== false,
    overlayShortcutEnabled: source.overlayShortcutEnabled !== false,
    contextMenuEnabled: source.contextMenuEnabled !== false,
    selectionSearchEnabled: source.selectionSearchEnabled === true,
    bubbleShowGroups: source.bubbleShowGroups !== false,
    bubbleShowCtx: source.bubbleShowCtx === true,
    bubbleShowGlobalSites: source.bubbleShowGlobalSites === true,
    diagnosticLogsEnabled: source.diagnosticLogsEnabled === true,
    darkMode: source.darkMode === "dark" || source.darkMode === "light" ? source.darkMode
             : source.darkMode === true ? "dark" : "auto",
    overlayShortcut: normalizeShortcut(source.overlayShortcut),
    localeMode
  };
}

// ── Custom-site helpers ────────────────────────────────────────────────────

export function createNormalizedCustomSites(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  const seenIds = new Set();
  return input
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const name = String(raw.name || "").trim();
      const url = String(raw.url || "").trim();
      if (!name || !url) return null;
      let id = String(raw.id || "").trim();
      if (!id || seenIds.has(id)) {
        id = createCustomSiteId();
      }
      seenIds.add(id);
      const customType = raw.customType === "ai" ? "ai" : "url";
      const base = {
        id,
        name,
        url,
        enabled: raw.enabled !== false,
        supportIframe: raw.supportIframe !== false,
        supportUrlQuery: customType === "url" && url.includes("{query}"),
        matchPatterns: Array.isArray(raw.matchPatterns) && raw.matchPatterns.length > 0
          ? raw.matchPatterns.map((pattern) => String(pattern))
          : deriveMatchPatterns(url),
        isCustom: true,
        customType
      };
      if (customType === "ai") {
        base.searchHandler = (raw.searchHandler && typeof raw.searchHandler === "object")
          ? raw.searchHandler
          : buildCustomAiSearchHandler();
      }
      return base;
    })
    .filter(Boolean);
}

// 通用 AI 输入框选择器优先级列表，覆盖绝大多数主流 AI 对话页面
const COMMON_AI_INPUT_SELECTORS = [
  "textarea",
  "div[contenteditable='true']",
  "[role='textbox']",
  "input[type='text']",
];

export function buildCustomAiSearchHandler() {
  return {
    steps: [
      { action: "setValue", selectors: COMMON_AI_INPUT_SELECTORS, inputType: "auto", maxAttempts: 12, waitAfter: 200 },
      { action: "smartSubmit", selectors: COMMON_AI_INPUT_SELECTORS, submitSelectors: [], submitWaitMs: 3000 }
    ]
  };
}

export function createCustomSiteId() {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function deriveMatchPatterns(url) {
  try {
    const normalized = normalizeUrlForParse(url);
    const host = new URL(normalized).hostname.replace(/^www\./, "");
    return host ? [host] : [];
  } catch (_error) {
    return [];
  }
}

export function normalizeUrlForParse(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function mergeSites(builtin, custom) {
  const result = Array.isArray(builtin) ? [...builtin] : [];
  const knownIds = new Set(result.map((site) => site.id));
  (custom || []).forEach((site) => {
    if (!site || knownIds.has(site.id)) return;
    result.push(site);
    knownIds.add(site.id);
  });
  return result;
}

export function syncCustomCategoryIds() {
  SITE_CATEGORIES.custom.siteIds = state.customSites.map((site) => site.id);
}

export function convertUrlToTemplate(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) {
    return { ok: false, error: msg("settings_custom_convertEmpty", "请先粘贴一个 URL 再转换。") };
  }
  if (trimmed.includes("{query}")) {
    return { ok: true, url: trimmed, name: guessSiteNameFromUrl(trimmed) };
  }

  let parsed;
  try {
    parsed = new URL(normalizeUrlForParse(trimmed));
  } catch (_error) {
    return { ok: false, error: msg("settings_custom_convertInvalidUrl", "URL 格式不正确，请检查后重试。") };
  }

  const params = parsed.searchParams;
  const paramKeys = Array.from(params.keys());
  if (paramKeys.length > 0) {
    const priorityKey = COMMON_SEARCH_PARAM_KEYS.find((key) =>
      paramKeys.some((item) => item.toLowerCase() === key)
    );
    let targetKey = null;
    if (priorityKey) {
      targetKey = paramKeys.find((item) => item.toLowerCase() === priorityKey) || null;
    } else {
      targetKey = paramKeys.find((key) => String(params.get(key) || "").trim().length > 0) || paramKeys[0];
    }
    if (targetKey) {
      params.set(targetKey, "__AI_CUSTOM_QUERY_PLACEHOLDER__");
      const rebuilt = parsed.toString().replace("__AI_CUSTOM_QUERY_PLACEHOLDER__", "{query}");
      return { ok: true, url: rebuilt, name: guessSiteNameFromUrl(rebuilt) };
    }
  }

  // Fallback: Check pathname for common search segments
  const pathParts = parsed.pathname.split('/');
  let keywordIndex = -1;
  for (let i = 0; i < pathParts.length; i++) {
    if (['search', 's', 'tag', 'tags', 'keyword', 'q', 'query'].includes(pathParts[i].toLowerCase())) {
      keywordIndex = i;
      break;
    }
  }

  if (keywordIndex !== -1) {
    // Find the last non-empty segment after keywordIndex
    let targetIndex = -1;
    for (let i = pathParts.length - 1; i > keywordIndex; i--) {
      if (pathParts[i] !== "") {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex !== -1) {
      pathParts[targetIndex] = "{query}";
    } else {
      // No non-empty segment after keyword, e.g. /search or /search/
      if (pathParts[pathParts.length - 1] === "") {
        pathParts[pathParts.length - 1] = "{query}";
      } else {
        pathParts.push("{query}");
      }
    }
    
    parsed.pathname = pathParts.join('/');
    const rebuilt = parsed.toString().replace(/%7Bquery%7D/ig, "{query}");
    return { ok: true, url: rebuilt, name: guessSiteNameFromUrl(rebuilt) };
  }

  return {
    ok: false,
    error: msg("settings_custom_convertNoParam", "未能识别到搜索参数。请提供带有搜索词参数的搜索结果链接，或手动在 URL 中把搜索词替换成 {query}。")
  };
}

export function guessSiteNameFromUrl(url) {
  try {
    const parsed = new URL(normalizeUrlForParse(url));
    const host = parsed.hostname.replace(/^www\./, "");
    if (!host) return "";
    const first = host.split(".")[0] || host;
    return first.charAt(0).toUpperCase() + first.slice(1);
  } catch (_error) {
    return "";
  }
}

export function getCategorySites(categoryKey) {
  const category = SITE_CATEGORIES[categoryKey];
  if (!category) return [];
  return category.siteIds.map((siteId) => state.sites.find((site) => site.id === siteId)).filter(Boolean);
}

export async function persistAll() {
  state.customSites = createNormalizedCustomSites(state.customSites);
  const builtinSites = state.sites.filter((site) => !site.isCustom);
  state.sites = mergeSites(builtinSites, state.customSites);
  syncCustomCategoryIds();
  state.groups = createNormalizedGroups(state.groups);
  state.selectionContextGroups = createNormalizedSelectionContextGroups(state.selectionContextGroups);
  state.promptGroups = createNormalizedPromptGroups(state.promptGroups);
  state.uiPrefs = createNormalizedUiPrefs(state.uiPrefs);
  await chrome.storage.local.set({
    [GROUPS_STORAGE_KEY]: state.groups,
    [SELECTION_CONTEXT_GROUPS_STORAGE_KEY]: state.selectionContextGroups,
    [PROMPTS_STORAGE_KEY]: state.promptGroups,
    [UI_PREFS_STORAGE_KEY]: state.uiPrefs,
    [CUSTOM_SITES_STORAGE_KEY]: state.customSites
  });
}
