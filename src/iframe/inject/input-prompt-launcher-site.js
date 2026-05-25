import { extractInputSelectorsFromHandler } from "./file-paste.js";
import {
  findBuiltinSiteForHost,
  isPromptLauncherSite,
  loadEnabledSites,
  siteMatchesHostname,
} from "../../shared/site-registry.js";
import {
  DEFAULT_ANCHOR_SELECTORS,
  DEFAULT_INPUT_FALLBACK,
  SITE_ANCHOR_EXTRAS,
  SITE_INPUT_EXTRAS,
} from "./input-prompt-launcher-constants.js";

export function isInsideQshotCompareEmbed() {
  try {
    return /^chrome-extension:/i.test(window.top.location.href);
  } catch (_e) {
    return false;
  }
}

export function dedupeSelectors(list) {
  const seen = new Set();
  const out = [];
  (list || []).forEach((sel) => {
    const key = String(sel || "").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  });
  return out;
}

export function buildSiteConfig(site) {
  const handlerSelectors = extractInputSelectorsFromHandler(site.searchHandler);
  return {
    id: site.id,
    inputSelectors: dedupeSelectors([
      ...handlerSelectors,
      ...(SITE_INPUT_EXTRAS[site.id] || []),
      ...DEFAULT_INPUT_FALLBACK,
    ]),
    anchorSelectors: dedupeSelectors([
      ...(SITE_ANCHOR_EXTRAS[site.id] || []),
      ...DEFAULT_ANCHOR_SELECTORS,
    ]),
  };
}

export async function resolveLauncherSite() {
  const hostname = location.hostname;
  const builtin = await findBuiltinSiteForHost(hostname, { fallbackEmpty: true });
  if (builtin && isPromptLauncherSite(builtin) && siteMatchesHostname(builtin, hostname)) {
    return builtin;
  }
  const sites = await loadEnabledSites({ fallbackEmpty: true });
  return (
    sites.find(
      (site) => isPromptLauncherSite(site) && siteMatchesHostname(site, hostname)
    ) || null
  );
}
