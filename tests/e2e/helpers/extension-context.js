import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

export function resolveExtensionPath() {
  const raw = process.env.QSHOT_EXTENSION_PATH || "dist";
  return path.isAbsolute(raw) ? raw : path.join(REPO_ROOT, raw);
}

export function getExtensionSmokeSkipReason() {
  const extensionPath = resolveExtensionPath();
  const manifestPath = path.join(extensionPath, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return `未找到 ${manifestPath}，请先运行 npm run build`;
  }
  if (process.env.CI === "true" && process.env.QSHOT_SMOKE_EXTENSION !== "1") {
    return "CI 默认跳过扩展冒烟；设置 QSHOT_SMOKE_EXTENSION=1 可强制运行";
  }
  return null;
}

export function buildComparePageUrl(extensionId, params = {}) {
  const url = new URL(`chrome-extension://${extensionId}/iframe/iframe.html`);
  if (params.sites) url.searchParams.set("sites", params.sites);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.autosend) url.searchParams.set("autosend", "1");
  return url.toString();
}

export async function waitForExtensionServiceWorker(context, timeoutMs = 60_000) {
  const existing = context.serviceWorkers();
  if (existing.length > 0) {
    return existing[0];
  }

  const triggerPage = await context.newPage();
  try {
    await triggerPage.goto("https://example.com/", { waitUntil: "domcontentloaded", timeout: 20_000 });
  } catch (_error) {
    await triggerPage.goto("about:blank").catch(() => {});
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const workers = context.serviceWorkers();
    if (workers.length > 0) {
      await triggerPage.close().catch(() => {});
      return workers[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  await triggerPage.close().catch(() => {});
  return context.waitForEvent("serviceworker", { timeout: 5_000 });
}

export function getExtensionIdFromWorker(serviceWorker) {
  const workerUrl = serviceWorker.url();
  const extensionId = workerUrl.split("/")[2];
  if (!extensionId) {
    throw new Error(`无法从 service worker URL 解析扩展 ID: ${workerUrl}`);
  }
  return extensionId;
}

export async function launchExtensionContext(options = {}) {
  const extensionPath = resolveExtensionPath();
  const manifestPath = path.join(extensionPath, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`扩展目录无效: ${extensionPath}`);
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "qshot-smoke-"));
  // MV3 扩展在 headless=new 下 service worker 常无法就绪；默认 headed，需无头时设 QSHOT_SMOKE_HEADLESS=1
  const headless = process.env.QSHOT_SMOKE_HEADLESS === "1";

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    args: [
      ...(headless ? ["--headless=new"] : []),
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const serviceWorker = await waitForExtensionServiceWorker(context);
  const extensionId = getExtensionIdFromWorker(serviceWorker);

  return {
    context,
    extensionId,
    extensionPath,
    userDataDir,
    async close() {
      await context.close();
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch (_error) {
        /* ignore cleanup failure on Windows file locks */
      }
    },
  };
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} timeoutMs
 */
export async function waitForComparePageReady(page, timeoutMs = 60_000) {
  await page.locator("#queryInput").waitFor({ state: "visible", timeout: timeoutMs });
  await page.locator("#sendSelectedBtn").waitFor({ state: "visible", timeout: timeoutMs });

  const globalStatus = page.locator("#globalStatus");
  await globalStatus.waitFor({ state: "attached", timeout: timeoutMs });

  await page.waitForFunction(() => {
    const text = document.getElementById("globalStatus")?.textContent || "";
    if (/初始化失败/.test(text)) return true;
    if (/已加载|已复原|发送完成|请输入|没有可发送/.test(text)) return true;
    return false;
  }, { timeout: timeoutMs });

  const statusText = await globalStatus.textContent();
  if (/初始化失败/.test(statusText || "")) {
    throw new Error(`compare 页初始化失败: ${statusText}`);
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} timeoutMs
 */
export async function waitForFirstCardSurfaceReady(page, timeoutMs = 120_000) {
  await page.waitForFunction(() => {
    const card = document.querySelector("#iframes-container .iframe-card");
    if (!card) return false;
    if (card.querySelector(".fallback-panel")) return true;
    const loading = card.querySelector(".iframe-loading-panel");
    if (loading && !loading.hidden) return false;
    const iframe = card.querySelector("iframe.ai-iframe");
    if (!iframe) return false;
    const src = iframe.getAttribute("src") || iframe.src || "";
    return src.length > 0 && src !== "about:blank";
  }, { timeout: timeoutMs });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} timeoutMs
 */
export async function waitForSendFlowComplete(page, timeoutMs = 240_000) {
  await page.waitForFunction(() => {
    const text = document.getElementById("globalStatus")?.textContent || "";
    return /发送完成/.test(text);
  }, { timeout: timeoutMs });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} timeoutMs
 */
export async function waitForSendDispatchStarted(page, timeoutMs = 30_000) {
  await page.waitForFunction(() => {
    const text = document.getElementById("globalStatus")?.textContent || "";
    return /正在向|发送完成/.test(text);
  }, { timeout: timeoutMs });
}
