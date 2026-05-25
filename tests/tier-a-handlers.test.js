import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HANDLERS_PATH = path.join(__dirname, "../src/config/siteHandlers.json");

/** Tier A：发版前重点回归的核心 AI 站点 */
const TIER_A_SITE_IDS = [
  "chatgpt",
  "deepseek",
  "kimi",
  "gemini",
  "claude",
  "doubao",
  "qianwen",
  "grok",
];

const ALLOWED_ACTIONS = new Set([
  "focus",
  "setValue",
  "smartSubmit",
  "sendKeys",
  "triggerEvents",
  "wait",
]);

function loadSiteHandlers() {
  return JSON.parse(readFileSync(HANDLERS_PATH, "utf8"));
}

function validateHandlerSteps(steps, label) {
  expect(Array.isArray(steps), `${label}: steps must be array`).toBe(true);
  expect(steps.length, `${label}: must have steps`).toBeGreaterThan(0);
  steps.forEach((step, index) => {
    const stepLabel = `${label} step ${index + 1}`;
    expect(ALLOWED_ACTIONS.has(step.action), `${stepLabel}: unknown action "${step.action}"`).toBe(true);
    if (step.action === "wait") {
      expect(typeof step.duration, `${stepLabel}: wait needs duration`).toBe("number");
      return;
    }
    expect(Array.isArray(step.selectors), `${stepLabel}: selectors required`).toBe(true);
    expect(step.selectors.length, `${stepLabel}: selectors not empty`).toBeGreaterThan(0);
  });
}

describe("Tier A site handlers", () => {
  const sites = loadSiteHandlers().sites;
  const tierA = TIER_A_SITE_IDS.map((id) => {
    const site = sites.find((item) => item.id === id);
    expect(site, `missing Tier A site "${id}"`).toBeTruthy();
    return site;
  });

  it("each Tier A site has searchHandler + searchHandlerFallback", () => {
    for (const site of tierA) {
      validateHandlerSteps(site.searchHandler?.steps, `${site.id} primary`);
      validateHandlerSteps(site.searchHandlerFallback?.steps, `${site.id} fallback`);
    }
  });

  it("fallback handlers use broader selectors than primary-only ids", () => {
    for (const site of tierA) {
      const primarySelectors = JSON.stringify(site.searchHandler?.steps || []);
      const fallbackSelectors = JSON.stringify(site.searchHandlerFallback?.steps || []);
      const hasBroaderRole = fallbackSelectors.includes("[role='textbox']")
        || fallbackSelectors.includes("textarea:not([disabled])");
      expect(
        hasBroaderRole || fallbackSelectors.length >= primarySelectors.length,
        `${site.id}: fallback should include broader selectors`
      ).toBe(true);
    }
  });

  it("iframe-capable Tier A sites keep supportIframe true", () => {
    const iframeSites = tierA.filter((site) => site.id !== "grok");
    for (const site of iframeSites) {
      expect(site.supportIframe, `${site.id} should support iframe in compare`).not.toBe(false);
    }
  });
});
