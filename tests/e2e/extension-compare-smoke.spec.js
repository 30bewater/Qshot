import { test, expect } from "@playwright/test";
import {
  buildComparePageUrl,
  getExtensionSmokeSkipReason,
  launchExtensionContext,
  waitForComparePageReady,
  waitForFirstCardSurfaceReady,
  waitForSendDispatchStarted,
  waitForSendFlowComplete,
} from "./helpers/extension-context.js";

const skipReason = getExtensionSmokeSkipReason();
const smokeSites = process.env.QSHOT_SMOKE_SITES || "deepseek";
const smokeQuery = process.env.QSHOT_SMOKE_QUERY || "Qshot smoke test ping";
const runSendSmoke = process.env.QSHOT_SMOKE_SEND !== "0";

test.describe.configure({ mode: "serial" });

test.describe("extension compare smoke", () => {
  /** @type {Awaited<ReturnType<typeof launchExtensionContext>> | null} */
  let session = null;

  test.beforeAll(async () => {
    test.skip(Boolean(skipReason), skipReason || undefined);
    session = await launchExtensionContext();
  });

  test.afterAll(async () => {
    await session?.close();
    session = null;
  });

  test("loads unpacked extension and opens compare page", async () => {
    const page = await session.context.newPage();
    await page.goto(buildComparePageUrl(session.extensionId, { sites: smokeSites }));
    await waitForComparePageReady(page);

    await expect(page.locator("#iframes-container")).toBeVisible();
    const cardOrEmpty = page.locator(
      "#iframes-container .iframe-card, #iframes-container .empty-state"
    );
    await expect(cardOrEmpty.first()).toBeVisible({ timeout: 90_000 });

    const globalStatus = await page.locator("#globalStatus").textContent();
    expect(globalStatus || "").toMatch(/已加载|已复原/);
    await page.close();
  });

  test("renders iframe cards for selected sites", async () => {
    const page = await session.context.newPage();
    await page.goto(buildComparePageUrl(session.extensionId, { sites: smokeSites }));
    await waitForComparePageReady(page);

    const cards = page.locator("#iframes-container .iframe-card");
    const emptyState = page.locator("#iframes-container .empty-state");
    const cardCount = await cards.count();
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(cardCount > 0 || hasEmpty).toBe(true);
    if (cardCount > 0) {
      await expect(cards.first().locator(".site-title")).toBeVisible();
      await expect(cards.first().locator(".iframe-card-body")).toBeVisible();
      await expect(
        cards.first().locator("iframe.ai-iframe, .iframe-loading, .fallback-panel").first()
      ).toBeAttached({ timeout: 90_000 });
    }
    await page.close();
  });

  test("composer accepts input without breaking UI", async () => {
    const page = await session.context.newPage();
    await page.goto(buildComparePageUrl(session.extensionId, { sites: smokeSites }));
    await waitForComparePageReady(page);

    const input = page.locator("#queryInput");
    await input.fill("manual smoke input");
    await expect(input).toHaveValue("manual smoke input");
    await expect(page.locator("#sendSelectedBtn")).toBeEnabled();
    await page.close();
  });

  test("send flow completes global dispatch", async () => {
    test.skip(!runSendSmoke, "set QSHOT_SMOKE_SEND=0 to skip send step");
    test.setTimeout(360_000);

    const page = await session.context.newPage();
    await page.goto(buildComparePageUrl(session.extensionId, { sites: smokeSites }));
    await waitForComparePageReady(page);
    await waitForFirstCardSurfaceReady(page, 150_000);

    await page.locator("#queryInput").fill(smokeQuery);
    await page.locator("#sendSelectedBtn").click();
    await waitForSendDispatchStarted(page, 45_000);
    await waitForSendFlowComplete(page, 300_000);

    const statusText = await page.locator("#globalStatus").textContent();
    expect(statusText || "").toMatch(/发送完成：成功 \d+ 个，失败 \d+ 个/);

    await page.close();
  });
});
