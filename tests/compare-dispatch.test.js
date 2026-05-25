import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HANDLER_ERROR_CODE } from "../src/shared/handler-fallback.js";
import { MSG } from "../src/shared/compare-protocol.js";
import { state } from "../src/iframe/iframe/state.js";
import {
  dispatchSearchWithRetries,
  finalizePendingDispatch,
  resolvePendingDispatch,
} from "../src/iframe/iframe/send-dispatch.js";
import { createMockCardRef, resetCompareTestState } from "./helpers/compare-test-env.js";

vi.mock("../src/iframe/iframe/layout-scroll.js", () => ({
  restoreLockedScrollPosition: vi.fn(),
}));

vi.mock("../src/iframe/iframe/status.js", () => ({
  setSiteStatus: vi.fn(),
}));

vi.mock("../src/shared/diagnostics.js", () => ({
  diagnosticLog: vi.fn(),
}));

describe("compare dispatch integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetCompareTestState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("posts QSHOT_SEARCH to iframe contentWindow on first attempt", async () => {
    const { ref, posts } = createMockCardRef("deepseek");
    dispatchSearchWithRetries(ref, "hello qshot", 0);
    await vi.runOnlyPendingTimersAsync();

    expect(posts).toHaveLength(1);
    expect(posts[0].data.type).toBe(MSG.SEARCH);
    expect(posts[0].data.query).toBe("hello qshot");
    expect(posts[0].data.site.id).toBe("deepseek");
    expect(posts[0].origin).toBe("*");
    expect(state.pendingDispatches.size).toBe(1);
  });

  it("resolves immediately when inject returns success RESULT", async () => {
    const { ref } = createMockCardRef("kimi");
    const resultPromise = dispatchSearchWithRetries(ref, "ping", 0);
    await vi.runOnlyPendingTimersAsync();

    const requestId = [...state.pendingDispatches.keys()][0];
    resolvePendingDispatch(requestId, {
      ok: true,
      siteId: "kimi",
      message: "ok",
      handlerId: "primary",
    });

    const result = await resultPromise;
    expect(result.ok).toBe(true);
    expect(state.pendingDispatches.size).toBe(0);
  });

  it("resolves immediately on HANDLERS_EXHAUSTED without waiting retry timeout", async () => {
    const { ref } = createMockCardRef("chatgpt");
    const resultPromise = dispatchSearchWithRetries(ref, "fail chain", 0);
    await vi.runOnlyPendingTimersAsync();

    const requestId = [...state.pendingDispatches.keys()][0];
    resolvePendingDispatch(requestId, {
      ok: false,
      siteId: "chatgpt",
      error: "内容仍停留在输入框，发送按钮可能未生效",
      errorCode: HANDLER_ERROR_CODE.HANDLERS_EXHAUSTED,
    });

    const result = await resultPromise;
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(HANDLER_ERROR_CODE.HANDLERS_EXHAUSTED);
    expect(state.pendingDispatches.size).toBe(0);

    await vi.advanceTimersByTimeAsync(5000);
    expect(state.pendingDispatches.size).toBe(0);
  });

  it("times out when inject never responds", async () => {
    const { ref } = createMockCardRef("gemini");
    const resultPromise = dispatchSearchWithRetries(ref, "silent", 0);
    await vi.runAllTimersAsync();
    const result = await resultPromise;
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/超时/);
  });

  it("finalizePendingDispatch is idempotent", async () => {
    const { ref } = createMockCardRef("claude");
    const resultPromise = dispatchSearchWithRetries(ref, "once", 0);
    await vi.runOnlyPendingTimersAsync();
    const requestId = [...state.pendingDispatches.keys()][0];

    finalizePendingDispatch(requestId, { ok: true, siteId: "claude" });
    finalizePendingDispatch(requestId, { ok: false, siteId: "claude", error: "duplicate" });

    const result = await resultPromise;
    expect(result.ok).toBe(true);
  });
});
