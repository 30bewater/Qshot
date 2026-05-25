import { vi } from "vitest";
import { state } from "../../src/iframe/iframe/state.js";
import { MSG } from "../../src/shared/compare-protocol.js";

export function resetCompareTestState() {
  state.pendingDispatches.clear();
  state.pendingFileDispatches.clear();
  state.cardRefs.clear();
  globalThis.QSHOT_BASE_CONFIG = {
    tabSendRetryCount: 4,
    tabSendRetryDelayMs: 120,
  };
}

export function createMockCardRef(siteId = "chatgpt", options = {}) {
  const posts = [];
  const contentWindow = {
    postMessage: vi.fn((data, origin) => {
      posts.push({ data, origin });
    }),
  };
  const statusEl = {
    textContent: "",
    classList: {
      toggle: vi.fn(),
    },
  };
  const ref = {
    site: { id: siteId, name: siteId, ...(options.site || {}) },
    iframeEl: { contentWindow },
    statusEl,
    currentUrl: "https://example.test/",
    _targetSrc: "https://example.test/",
    ...(options.ref || {}),
  };
  state.cardRefs.set(siteId, ref);
  return { ref, posts, contentWindow };
}

export function buildResultEvent(ref, payload) {
  return {
    source: ref.iframeEl.contentWindow,
    data: payload,
  };
}

export function buildSearchMessage(ref, query, requestId = "req-test") {
  return {
    type: MSG.SEARCH,
    query,
    site: ref.site,
    requestId,
  };
}

export const minimalPrimaryHandler = {
  steps: [
    { action: "focus", selectors: ["#input"] },
    { action: "setValue", selectors: ["#input"] },
    { action: "smartSubmit", selectors: ["#input"], submitSelectors: ["button.send"] },
  ],
};

export const minimalFallbackHandler = {
  steps: [
    { action: "focus", selectors: ["textarea"] },
    { action: "setValue", selectors: ["textarea"] },
    { action: "sendKeys", selectors: ["textarea"], keys: ["Enter"] },
  ],
};
