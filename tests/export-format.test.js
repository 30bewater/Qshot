import { describe, expect, it } from "vitest";
import {
  flattenExportBodyMarkdown,
  renderSingleModelBlock,
} from "../src/iframe/iframe/export-format.js";

describe("flattenExportBodyMarkdown", () => {
  it("returns placeholder for empty input", () => {
    expect(flattenExportBodyMarkdown("")).toBe("暂未提取到内容");
    expect(flattenExportBodyMarkdown("   ")).toBe("暂未提取到内容");
  });

  it("converts headings to bold lines outside code fences", () => {
    const input = "## Summary\n\nSome text.\n\n```js\n## not a heading\n```";
    const out = flattenExportBodyMarkdown(input);
    expect(out).toContain("**Summary**");
    expect(out).toContain("```js\n## not a heading\n```");
  });

  it("collapses excessive blank lines", () => {
    const out = flattenExportBodyMarkdown("line one\n\n\n\nline two");
    expect(out).toBe("line one\n\nline two");
  });
});

describe("renderSingleModelBlock", () => {
  const baseResp = {
    siteName: "Test AI",
    url: "https://example.com/chat",
    content: "",
    turns: [
      { role: "user", text: "What is 2+2?" },
      { role: "assistant", text: "Four." },
    ],
  };

  it("renders structured turns as markdown with User/AI labels", () => {
    const md = renderSingleModelBlock(baseResp, "markdown");
    expect(md).toContain("# Test AI");
    expect(md).toContain("**User:** What is 2+2?");
    expect(md).toContain("**AI:** Four.");
  });

  it("escapes HTML in html format", () => {
    const html = renderSingleModelBlock(
      {
        ...baseResp,
        turns: [{ role: "user", text: "<script>" }, { role: "assistant", text: "safe" }],
      },
      "html",
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
