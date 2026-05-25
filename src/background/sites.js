import { loadEnabledSites as loadSitesFromRegistry } from "../shared/site-registry.js";

export const AI_SITE_IDS = [
  "deepseek", "doubao", "kimi", "yuanbao", "qianwen", "qwen", "metaso",
  "chatglm", "xiaomimimo", "zhida",
  "gemini", "chatgpt", "claude", "grok", "dots", "perplexity",
  "zai", "monica", "poe", "copilot",
];

export async function loadEnabledSites() {
  return loadSitesFromRegistry({ fallbackEmpty: false });
}

export function buildSiteUrl(site, query) {
  const url = String(site?.url || "");
  if (!url.includes("{query}")) {
    return url;
  }

  if (query && site?.supportUrlQuery) {
    return url.replace(/\{query\}/g, encodeURIComponent(query));
  }

  // 空 query 或站点不支持 URL 直达：剥离含 {query} 的参数段，回落到基础 URL
  let next = url.replace(/([?&])[^=&]+=\{query\}/g, (_, sep) => (sep === "?" ? "?" : ""));
  next = next.replace(/\?&/, "?");
  next = next.replace(/[?&]$/, "");
  // 兜底：万一还残留 {query}，粗暴清掉
  return next.replace(/\{query\}/g, "");
}

export function canSearchByUrl(site) {
  return Boolean(site?.supportUrlQuery && String(site.url || "").includes("{query}"));
}

export function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
