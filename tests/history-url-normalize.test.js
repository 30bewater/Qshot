import { describe, expect, it } from "vitest";
import {
  isSameOriginHomepage,
  historyUrlsLooseMatch,
  normalizeHistorySiteUrl,
  shouldKeepStoredHistoryUrl,
} from "../src/iframe/iframe/history-url-normalize.js";

describe("normalizeHistorySiteUrl", () => {
  it("rewrites chat.openai.com to chatgpt.com", () => {
    expect(
      normalizeHistorySiteUrl("chatgpt", "https://chat.openai.com/c/abc-123")
    ).toBe("https://chatgpt.com/c/abc-123");
  });
});

describe("isSameOriginHomepage", () => {
  it("treats copilot chat with query as non-homepage", () => {
    const home = "https://m365.cloud.microsoft/chat/";
    expect(
      isSameOriginHomepage("https://m365.cloud.microsoft/chat/?conversationId=abc", home)
    ).toBe(false);
    expect(isSameOriginHomepage("https://m365.cloud.microsoft/chat/", home)).toBe(true);
  });
});

describe("historyUrlsLooseMatch", () => {
  it("matches chatgpt paths ignoring trailing slash", () => {
    expect(
      historyUrlsLooseMatch("chatgpt", "https://chatgpt.com/c/abc", "https://chatgpt.com/c/abc/")
    ).toBe(true);
  });
});

describe("shouldKeepStoredHistoryUrl", () => {
  it("keeps copilot conversation url when candidate is bare home", () => {
    const home = "https://m365.cloud.microsoft/chat/";
    const stored = "https://m365.cloud.microsoft/chat/?conversationId=abc";
    expect(shouldKeepStoredHistoryUrl(stored, home, home, "copilot")).toBe(true);
  });
});
