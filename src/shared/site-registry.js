import { CUSTOM_SITES_STORAGE_KEY } from "./storage-keys.js";

const SITE_HANDLERS_PATH = "config/siteHandlers.json";

/** 与设置页「AI」分类一致的内置大模型站点 id */
export const AI_SITE_IDS = [
  "deepseek",
  "doubao",
  "kimi",
  "yuanbao",
  "qianwen",
  "qwen",
  "metaso",
  "chatglm",
  "xiaomimimo",
  "zhida",
  "gemini",
  "chatgpt",
  "claude",
  "grok",
  "dots",
  "perplexity",
  "zai",
  "monica",
  "poe",
  "copilot",
];
const AI_SITE_ID_SET = new Set(AI_SITE_IDS);

export function isAiSiteId(siteId) {
  return AI_SITE_ID_SET.has(String(siteId || ""));
}

/** 官网输入框旁提示词入口：内置 AI 站 + 用户自定义站 */
export function isPromptLauncherSite(site) {
  if (!site || site.enabled === false) return false;
  if (site.isCustom) return true;
  return isAiSiteId(site.id);
}

export function siteMatchesHostname(site, hostname) {
  const normalizedHost = normalizeHost(hostname);
  if (!normalizedHost) return false;
  return siteMatchesHost(site, normalizedHost);
}

let builtinSites = null;
let builtinSitesPromise = null;
let domainIndex = null;

export async function loadBuiltinSites(options = {}) {
  const { fallbackEmpty = false } = options;

  if (builtinSites) return builtinSites;
  if (builtinSitesPromise) return builtinSitesPromise;

  builtinSitesPromise = fetch(chrome.runtime.getURL(SITE_HANDLERS_PATH))
    .then((response) => {
      if (!response.ok) throw new Error("无法读取站点配置");
      return response.json();
    })
    .then((payload) => {
      builtinSites = Array.isArray(payload.sites) ? payload.sites : [];
      domainIndex = buildDomainIndex(builtinSites);
      return builtinSites;
    })
    .catch((error) => {
      if (!fallbackEmpty) throw error;
      return [];
    })
    .finally(() => {
      builtinSitesPromise = null;
    });

  return builtinSitesPromise;
}

export function normalizeCustomSite(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const name = String(raw.name || "").trim();
  const url = String(raw.url || "").trim();
  const id = String(raw.id || "").trim();
  if (!id || !name || !url) {
    return null;
  }

  const customType = raw.customType === "ai" ? "ai" : "url";
  const base = {
    id,
    name,
    url,
    enabled: raw.enabled !== false,
    supportIframe: raw.supportIframe !== false,
    supportUrlQuery: customType === "url" && url.includes("{query}"),
    matchPatterns: Array.isArray(raw.matchPatterns)
      ? raw.matchPatterns.map((pattern) => String(pattern))
      : [],
    isCustom: true,
    customType
  };
  if (customType === "ai" && raw.searchHandler && typeof raw.searchHandler === "object") {
    base.searchHandler = raw.searchHandler;
  }
  if (raw.searchHandlerFallback && typeof raw.searchHandlerFallback === "object") {
    base.searchHandlerFallback = raw.searchHandlerFallback;
  }
  if (raw.enableGenericFallback === false) {
    base.enableGenericFallback = false;
  }
  return base;
}

export async function loadCustomSitesFromStorage() {
  try {
    const stored = await chrome.storage.local.get([CUSTOM_SITES_STORAGE_KEY]);
    const list = Array.isArray(stored[CUSTOM_SITES_STORAGE_KEY]) ? stored[CUSTOM_SITES_STORAGE_KEY] : [];
    return list
      .map((item) => normalizeCustomSite(item))
      .filter((site) => site && site.enabled !== false);
  } catch (_error) {
    return [];
  }
}

export function mergeSiteLists(builtin, custom) {
  const result = Array.isArray(builtin) ? [...builtin] : [];
  const seen = new Set(result.map((site) => site.id));
  (custom || []).forEach((site) => {
    if (!site || seen.has(site.id)) {
      return;
    }
    result.push(site);
    seen.add(site.id);
  });
  return result;
}

export async function loadEnabledSites(options = {}) {
  const builtin = (await loadBuiltinSites(options)).filter((site) => site.enabled !== false);
  const custom = Array.isArray(options.customSites)
    ? options.customSites.map((item) => normalizeCustomSite(item)).filter((site) => site && site.enabled !== false)
    : await loadCustomSitesFromStorage();
  return mergeSiteLists(builtin, custom);
}

export async function findBuiltinSiteForHost(hostname, options = {}) {
  const sites = await loadBuiltinSites(options);
  const normalizedHost = normalizeHost(hostname);
  if (!normalizedHost) return null;

  const index = domainIndex || buildDomainIndex(sites);
  for (const candidate of getHostCandidates(normalizedHost)) {
    const matches = index.get(candidate);
    if (matches?.length) return matches[0];
  }

  // Fallback for unusual match patterns that are not plain domains.
  return sites.find((site) => siteMatchesHost(site, normalizedHost)) || null;
}

export function normalizeHost(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\*:\/\//, "")
    .replace(/^https?:\/\//, "")
    .replace(/^\*\./, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

function buildDomainIndex(sites) {
  const index = new Map();
  (sites || []).forEach((site) => {
    const patterns = Array.isArray(site.matchPatterns) ? site.matchPatterns : [];
    patterns.forEach((pattern) => {
      const host = normalizeHost(pattern);
      if (!host) return;
      const list = index.get(host) || [];
      list.push(site);
      index.set(host, list);
    });
  });
  return index;
}

function getHostCandidates(hostname) {
  const parts = hostname.split(".").filter(Boolean);
  const candidates = [];
  for (let index = 0; index < parts.length; index += 1) {
    candidates.push(parts.slice(index).join("."));
  }
  return candidates;
}

function siteMatchesHost(site, normalizedHost) {
  const patterns = Array.isArray(site.matchPatterns) ? site.matchPatterns : [];
  return patterns.some((pattern) => {
    const host = normalizeHost(pattern);
    return normalizedHost === host || normalizedHost.endsWith(`.${host}`);
  });
}
