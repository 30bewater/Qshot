import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HANDLERS_PATH = path.join(__dirname, "../src/config/siteHandlers.json");

const ALLOWED_ACTIONS = new Set([
  "focus",
  "setValue",
  "smartSubmit",
  "sendKeys",
  "triggerEvents",
  "wait",
]);

const REQUIRED_SITE_FIELDS = [
  "id",
  "name",
  "url",
  "enabled",
  "supportIframe",
  "matchPatterns",
  "searchHandler",
];

function loadSiteHandlers() {
  return JSON.parse(readFileSync(HANDLERS_PATH, "utf8"));
}

function validateStep(step, siteId, index) {
  const label = `${siteId} step ${index + 1}`;
  expect(step, `${label}: missing action`).toHaveProperty("action");
  expect(ALLOWED_ACTIONS.has(step.action), `${label}: unknown action "${step.action}"`).toBe(true);

  if (step.action === "wait") {
    expect(typeof step.duration, `${label}: wait needs numeric duration`).toBe("number");
    expect(step.duration, `${label}: wait duration must be positive`).toBeGreaterThan(0);
    return;
  }

  expect(Array.isArray(step.selectors), `${label}: selectors must be an array`).toBe(true);
  expect(step.selectors.length, `${label}: selectors must not be empty`).toBeGreaterThan(0);

  if (step.action === "sendKeys") {
    expect(Array.isArray(step.keys), `${label}: sendKeys needs keys array`).toBe(true);
    expect(step.keys.length, `${label}: sendKeys keys must not be empty`).toBeGreaterThan(0);
  }
}

describe("siteHandlers.json", () => {
  const data = loadSiteHandlers();

  it("has a non-empty sites array", () => {
    expect(Array.isArray(data.sites)).toBe(true);
    expect(data.sites.length).toBeGreaterThan(0);
  });

  it("each site has required fields and valid searchHandler steps", () => {
    const ids = new Set();

    for (const site of data.sites) {
      for (const field of REQUIRED_SITE_FIELDS) {
        expect(site, `site missing "${field}"`).toHaveProperty(field);
      }

      expect(typeof site.id, `${site.id}: id must be string`).toBe("string");
      expect(site.id.length, `${site.id}: id must not be empty`).toBeGreaterThan(0);
      expect(ids.has(site.id), `duplicate site id "${site.id}"`).toBe(false);
      ids.add(site.id);

      expect(Array.isArray(site.matchPatterns)).toBe(true);
      expect(site.matchPatterns.length).toBeGreaterThan(0);

      const steps = site.searchHandler?.steps;
      expect(Array.isArray(steps), `${site.id}: searchHandler.steps must be array`).toBe(true);
      expect(steps.length, `${site.id}: must have at least one step`).toBeGreaterThan(0);

      steps.forEach((step, index) => validateStep(step, site.id, index));

      if (site.searchHandlerFallback) {
        const fallbackSteps = site.searchHandlerFallback.steps;
        expect(Array.isArray(fallbackSteps), `${site.id}: searchHandlerFallback.steps must be array`).toBe(true);
        expect(fallbackSteps.length, `${site.id}: fallback must have steps`).toBeGreaterThan(0);
        fallbackSteps.forEach((step, index) => validateStep(step, `${site.id}:fallback`, index));
      }
    }
  });
});
