import { describe, expect, it } from "vitest";
import {
  buildGenericFallbackHandler,
  collectHandlerChain,
  errorIndicatesSubmitPhase,
  extractInputSelectors,
  HANDLER_CHAIN_IDS,
  HANDLER_ERROR_CODE,
  isFatalHandlerError,
  resolveHandlerErrorCode,
} from "../src/shared/handler-fallback.js";

describe("handler-fallback", () => {
  const sampleSite = {
    id: "demo",
    searchHandler: {
      steps: [
        { action: "focus", selectors: ["#input"] },
        { action: "setValue", selectors: ["#input"] },
        { action: "smartSubmit", selectors: ["#input"], submitSelectors: ["button.send"] },
      ],
    },
    searchHandlerFallback: {
      steps: [
        { action: "focus", selectors: ["textarea"] },
        { action: "setValue", selectors: ["textarea"] },
        { action: "sendKeys", selectors: ["textarea"], keys: ["Enter"] },
      ],
    },
  };

  it("collects primary → fallback → generic chain", () => {
    const chain = collectHandlerChain(sampleSite);
    expect(chain.map((item) => item.id)).toEqual([
      HANDLER_CHAIN_IDS.PRIMARY,
      HANDLER_CHAIN_IDS.FALLBACK,
      HANDLER_CHAIN_IDS.GENERIC,
    ]);
  });

  it("skips generic when enableGenericFallback is false", () => {
    const chain = collectHandlerChain({ ...sampleSite, enableGenericFallback: false });
    expect(chain.map((item) => item.id)).toEqual([
      HANDLER_CHAIN_IDS.PRIMARY,
      HANDLER_CHAIN_IDS.FALLBACK,
    ]);
  });

  it("builds generic handler from primary input selectors", () => {
    const generic = buildGenericFallbackHandler(sampleSite.searchHandler);
    expect(generic?.steps?.[0]?.selectors).toContain("#input");
    expect(generic?.steps?.[0]?.selectors).toContain("[role='textbox']");
    expect(generic?.steps.some((step) => step.action === "sendKeys")).toBe(true);
  });

  it("extractInputSelectors merges focus/setValue/smartSubmit selectors", () => {
    const selectors = extractInputSelectors(sampleSite.searchHandler);
    expect(selectors).toContain("#input");
  });

  it("classifies submit-phase failures as HANDLERS_EXHAUSTED", () => {
    const code = resolveHandlerErrorCode([
      { id: "primary", ok: false, error: "未找到元素: #input", reachedSubmit: false },
      { id: "fallback", ok: false, error: "内容仍停留在输入框，发送按钮可能未生效", reachedSubmit: true },
    ]);
    expect(code).toBe(HANDLER_ERROR_CODE.HANDLERS_EXHAUSTED);
  });

  it("classifies only find failures as NOT_READY", () => {
    const code = resolveHandlerErrorCode([
      { id: "primary", ok: false, error: "未找到元素: #input", reachedSubmit: false },
    ]);
    expect(code).toBe(HANDLER_ERROR_CODE.NOT_READY);
  });

  it("detects fatal configuration errors", () => {
    expect(isFatalHandlerError("无效的站点处理器配置")).toBe(true);
    expect(isFatalHandlerError("未找到元素: textarea")).toBe(false);
  });

  it("detects submit-phase error messages", () => {
    expect(errorIndicatesSubmitPhase("内容仍停留在输入框，发送按钮可能未生效")).toBe(true);
    expect(errorIndicatesSubmitPhase("未找到元素: textarea")).toBe(false);
  });
});
