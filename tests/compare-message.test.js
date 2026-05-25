import { beforeEach, describe, expect, it, vi } from "vitest";
import { MSG } from "../src/shared/compare-protocol.js";
import { HANDLER_ERROR_CODE } from "../src/shared/handler-fallback.js";
import {
  findCardRefByMessageSource,
  handleFrameMessage,
} from "../src/iframe/iframe/status.js";
import { createMockCardRef, resetCompareTestState } from "./helpers/compare-test-env.js";

const resolvePendingDispatch = vi.fn();

vi.mock("../src/iframe/iframe/send.js", () => ({
  resolvePendingDispatch: (...args) => resolvePendingDispatch(...args),
}));

vi.mock("../src/iframe/iframe/history.js", () => ({
  updateLatestHistoryUrl: vi.fn(),
}));

vi.mock("../src/shared/diagnostics.js", () => ({
  diagnosticLog: vi.fn(),
}));

describe("compare ↔ inject message integration", () => {
  beforeEach(() => {
    resetCompareTestState();
    resolvePendingDispatch.mockReset();
  });

  it("findCardRefByMessageSource matches registered iframe contentWindow", () => {
    const { ref } = createMockCardRef("chatgpt");
    const otherWindow = { postMessage: vi.fn() };
    expect(findCardRefByMessageSource(ref.iframeEl.contentWindow)).toBe(ref);
    expect(findCardRefByMessageSource(otherWindow)).toBeNull();
  });

  it("ignores RESULT from unknown iframe source", () => {
    createMockCardRef("chatgpt");
    handleFrameMessage({
      source: { postMessage: vi.fn() },
      data: {
        type: MSG.RESULT,
        siteId: "chatgpt",
        ok: true,
        requestId: "req-unknown",
      },
    });
    expect(resolvePendingDispatch).not.toHaveBeenCalled();
  });

  it("ignores RESULT when siteId does not match card ref", () => {
    const { ref } = createMockCardRef("deepseek");
    handleFrameMessage({
      source: ref.iframeEl.contentWindow,
      data: {
        type: MSG.RESULT,
        siteId: "kimi",
        ok: true,
        requestId: "req-mismatch",
      },
    });
    expect(resolvePendingDispatch).not.toHaveBeenCalled();
  });

  it("forwards valid RESULT to resolvePendingDispatch", () => {
    const { ref } = createMockCardRef("kimi");
    handleFrameMessage({
      source: ref.iframeEl.contentWindow,
      data: {
        type: MSG.RESULT,
        siteId: "kimi",
        ok: true,
        requestId: "req-ok",
        handlerId: "fallback",
        message: "已通过备选规则（fallback）写入并触发发送",
      },
    });

    expect(resolvePendingDispatch).toHaveBeenCalledWith("req-ok", expect.objectContaining({
      ok: true,
      siteId: "kimi",
      handlerId: "fallback",
    }));
    expect(ref.statusEl.textContent).toMatch(/备选规则/);
  });

  it("sets error status on failed RESULT with HANDLERS_EXHAUSTED", () => {
    const { ref } = createMockCardRef("gemini");
    handleFrameMessage({
      source: ref.iframeEl.contentWindow,
      data: {
        type: MSG.RESULT,
        siteId: "gemini",
        ok: false,
        requestId: "req-fail",
        error: "所有发送规则均失败",
        errorCode: HANDLER_ERROR_CODE.HANDLERS_EXHAUSTED,
      },
    });

    expect(resolvePendingDispatch).toHaveBeenCalled();
    expect(ref.statusEl.textContent).toMatch(/失败/);
  });

  it("accepts URL_UPDATE from matched iframe and updates ref url", () => {
    const { ref } = createMockCardRef("claude");
    handleFrameMessage({
      source: ref.iframeEl.contentWindow,
      data: {
        type: MSG.URL_UPDATE,
        siteId: "claude",
        currentUrl: "https://claude.ai/chat/abc",
      },
    });

    expect(ref.currentUrl).toBe("https://claude.ai/chat/abc");
    expect(ref._targetSrc).toBe("https://claude.ai/chat/abc");
    expect(ref.injectedPinged).toBe(true);
  });
});
