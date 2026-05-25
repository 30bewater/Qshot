import { beforeEach, describe, expect, it, vi } from "vitest";
import { HANDLER_CHAIN_IDS, HANDLER_ERROR_CODE } from "../src/shared/handler-fallback.js";
import {
  minimalFallbackHandler,
  minimalPrimaryHandler,
} from "./helpers/compare-test-env.js";

const executeSiteHandler = vi.fn();

vi.mock("../src/iframe/inject/executor.js", () => ({
  executeSiteHandler: (...args) => executeSiteHandler(...args),
}));

vi.mock("../src/shared/diagnostics.js", () => ({
  diagnosticLog: vi.fn(),
}));

const { runSearchHandlerChain } = await import("../src/iframe/inject/search-handler-run.js");

describe("search handler chain integration", () => {
  beforeEach(() => {
    executeSiteHandler.mockReset();
  });

  it("returns success on primary without trying fallback", async () => {
    executeSiteHandler.mockResolvedValueOnce(undefined);
    const site = {
      id: "chatgpt",
      searchHandler: minimalPrimaryHandler,
      searchHandlerFallback: minimalFallbackHandler,
    };

    const result = await runSearchHandlerChain("hello", site);
    expect(result.ok).toBe(true);
    expect(result.handlerId).toBe(HANDLER_CHAIN_IDS.PRIMARY);
    expect(executeSiteHandler).toHaveBeenCalledTimes(1);
  });

  it("falls back to searchHandlerFallback when primary throws", async () => {
    executeSiteHandler
      .mockRejectedValueOnce(new Error("未找到元素: #input"))
      .mockResolvedValueOnce(undefined);

    const site = {
      id: "deepseek",
      searchHandler: minimalPrimaryHandler,
      searchHandlerFallback: minimalFallbackHandler,
    };

    const result = await runSearchHandlerChain("hello", site);
    expect(result.ok).toBe(true);
    expect(result.handlerId).toBe(HANDLER_CHAIN_IDS.FALLBACK);
    expect(executeSiteHandler).toHaveBeenCalledTimes(2);
  });

  it("tries generic handler when primary and fallback both fail", async () => {
    executeSiteHandler
      .mockRejectedValueOnce(new Error("未找到元素: #input"))
      .mockRejectedValueOnce(new Error("未找到元素: textarea"))
      .mockResolvedValueOnce(undefined);

    const site = {
      id: "kimi",
      searchHandler: minimalPrimaryHandler,
      searchHandlerFallback: minimalFallbackHandler,
    };

    const result = await runSearchHandlerChain("hello", site);
    expect(result.ok).toBe(true);
    expect(result.handlerId).toBe(HANDLER_CHAIN_IDS.GENERIC);
    expect(executeSiteHandler).toHaveBeenCalledTimes(3);
  });

  it("returns NOT_READY when all handlers fail before submit phase", async () => {
    executeSiteHandler.mockRejectedValue(new Error("未找到元素: textarea"));

    const site = {
      id: "gemini",
      searchHandler: minimalPrimaryHandler,
      searchHandlerFallback: minimalFallbackHandler,
    };

    const result = await runSearchHandlerChain("hello", site);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(HANDLER_ERROR_CODE.NOT_READY);
    expect(result.handlerAttempts).toContain(HANDLER_CHAIN_IDS.PRIMARY);
  });

  it("returns HANDLERS_EXHAUSTED when submit phase fails across chain", async () => {
    executeSiteHandler.mockRejectedValue(
      new Error("内容仍停留在输入框，发送按钮可能未生效")
    );

    const site = {
      id: "claude",
      searchHandler: minimalPrimaryHandler,
      searchHandlerFallback: minimalFallbackHandler,
      enableGenericFallback: false,
    };

    const result = await runSearchHandlerChain("hello", site);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(HANDLER_ERROR_CODE.HANDLERS_EXHAUSTED);
  });

  it("skips generic when enableGenericFallback is false", async () => {
    executeSiteHandler
      .mockRejectedValueOnce(new Error("未找到元素: #input"))
      .mockRejectedValueOnce(new Error("未找到元素: textarea"));

    const site = {
      id: "doubao",
      searchHandler: minimalPrimaryHandler,
      searchHandlerFallback: minimalFallbackHandler,
      enableGenericFallback: false,
    };

    const result = await runSearchHandlerChain("hello", site);
    expect(result.ok).toBe(false);
    expect(executeSiteHandler).toHaveBeenCalledTimes(2);
  });
});
