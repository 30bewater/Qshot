import { test, expect } from "@playwright/test";

test.describe("protocol bridge fixture", () => {
  test("compare parent dispatches SEARCH and receives RESULT from mock iframe", async ({ page }) => {
    await page.goto("/protocol-bridge.html");
    await page.getByRole("button", { name: "Send test query" }).click();
    await expect(page.getByTestId("status")).toHaveText("result:ok:primary", { timeout: 5000 });
  });

  test("mock iframe page exposes input for manual inspection", async ({ page }) => {
    await page.goto("/mock-inject-page.html");
    await page.locator("#input").fill("playwright hello");
    await expect(page.locator("#input")).toHaveValue("playwright hello");
  });
});
