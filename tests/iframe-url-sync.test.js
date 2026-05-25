import { describe, expect, it } from "vitest";
import {
  resolveHistoryRestoreLoadTarget,
  urlsNeedIframeReload,
} from "../src/iframe/iframe/iframe-url-sync.js";

describe("urlsNeedIframeReload", () => {
  it("detects deepseek homepage vs chat path", () => {
    expect(
      urlsNeedIframeReload(
        "https://chat.deepseek.com/",
        "https://chat.deepseek.com/a/chat/s/abc"
      )
    ).toBe(true);
  });
});

describe("resolveHistoryRestoreLoadTarget", () => {
  it("loads homepage first when restoreUrl is a conversation page", () => {
    const ref = {
      site: {
        id: "deepseek",
        url: "https://chat.deepseek.com/",
      },
      restoreUrl: "https://chat.deepseek.com/a/chat/s/abc",
      _targetSrc: "",
    };

    const target = resolveHistoryRestoreLoadTarget(ref);
    expect(target).toBe("https://chat.deepseek.com/");
    expect(ref._targetSrc).toBe("https://chat.deepseek.com/");
    expect(ref.restoreUrl).toBe("https://chat.deepseek.com/a/chat/s/abc");
  });

  it("loads homepage first for chatgpt conversation path", () => {
    const ref = {
      site: {
        id: "chatgpt",
        url: "https://chatgpt.com/",
      },
      restoreUrl: "https://chatgpt.com/c/abc-123",
      _targetSrc: "",
    };

    const target = resolveHistoryRestoreLoadTarget(ref);
    expect(target).toBe("https://chatgpt.com/");
    expect(ref.restoreUrl).toBe("https://chatgpt.com/c/abc-123");
  });

  it("clears restoreUrl when it matches homepage", () => {
    const ref = {
      site: {
        id: "deepseek",
        url: "https://chat.deepseek.com/",
      },
      restoreUrl: "https://chat.deepseek.com/",
      _targetSrc: "",
    };

    resolveHistoryRestoreLoadTarget(ref);
    expect(ref._targetSrc).toBe("https://chat.deepseek.com/");
    expect(ref.restoreUrl).toBe("");
  });
});
