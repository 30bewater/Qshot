/**
 * extractor-site-selectors.js
 * Page-text extraction: site-specific CSS selectors + generic fallback.
 * Exports: extractReadablePageText (called by extractor.js entry point)
 */

import { domToMarkdown } from "./extractor-dom-to-markdown.js";

function getSiteContentConfig(host) {
  const configs = {
    "chatgpt.com": {
      containers: ["[data-message-author-role='assistant']"],
      content: [".markdown.prose", ".prose", "[class*='markdown']", "article"],
    },
    "chat.openai.com": {
      containers: ["[data-message-author-role='assistant']"],
      content: [".markdown.prose", ".prose"],
    },
    "chat.deepseek.com": {
      containers: ["[class*='ds-message-bubble'][class*='assistant']", "[class*='message'][class*='assistant']"],
      content: ["[class*='ds-markdown']", "[class*='markdown']", "[class*='chat-message-content']"],
    },
    "kimi.moonshot.cn": {
      containers: ["[class*='segment-item']", "[class*='message'][class*='ai']", "[class*='bubble'][class*='assistant']"],
      content: ["[class*='markdown-content']", "[class*='content']", "[class*='text']"],
    },
    "kimi.com": {
      containers: ["[class*='segment-item']", "[class*='message'][class*='ai']", "[class*='bubble'][class*='assistant']", "[class*='chat-content-item']"],
      content: ["[class*='markdown-content']", "[class*='content']", "[class*='text']", "[class*='markdown']"],
    },
    "tongyi.aliyun.com": {
      containers: ["[class*='answer-message']", "[class*='agent-chat__answer']", "[class*='chat-bubble']"],
      content: ["[class*='markdown']", "[class*='answer-text']", "[class*='content']"],
    },
    "doubao.com": {
      containers: ["[data-author-type='2']", "[class*='chat-response']", "[class*='assistant-message']"],
      content: ["[class*='markdown']", "[class*='message-text']", "[class*='content']"],
    },
    "gemini.google.com": {
      containers: ["model-response", "message-content[class*='model']", "[class*='response-container']"],
      content: [".markdown", "[class*='response-content']", "[class*='model-response-text']"],
    },
    "chatglm.cn": {
      containers: ["[class*='chat-msg--ai']", "[class*='assistant-message']"],
      content: ["[class*='content']", "[class*='markdown']", "[class*='text']"],
    },
    "yuanbao.tencent.com": {
      containers: ["[class*='agent-chat__message--ai']", "[class*='ai-message']"],
      content: ["[class*='hyper-text']", "[class*='markdown']", "[class*='content']"],
    },
    "qianwen.com": {
      containers: ["[class*='answer-message']", "[class*='ai-message']", "[class*='assistant-message']"],
      content: ["[class*='markdown']", "[class*='answer-text']", "[class*='content']"],
    },
  };

  for (const [domain, config] of Object.entries(configs)) {
    if (host === domain || host.endsWith("." + domain)) return config;
  }
  return null;
}

function extractBySiteSelectors(host) {
  const config = getSiteContentConfig(host);
  if (!config) return "";

  const parts = [];

  for (const containerSel of (config.containers || [])) {
    const containers = Array.from(document.querySelectorAll(containerSel));
    if (containers.length === 0) continue;

    for (const container of containers) {
      let text = "";
      for (const contentSel of (config.content || [])) {
        const el = container.querySelector(contentSel);
        if (el) {
          text = domToMarkdown(el);
          break;
        }
      }
      if (!text) text = domToMarkdown(container);
      if (text) parts.push(text);
    }

    if (parts.length > 0) break;
  }

  if (parts.length > 0) return parts.join("\n\n---\n\n").slice(0, 10000);

  for (const contentSel of (config.content || [])) {
    const nodes = Array.from(document.querySelectorAll(contentSel));
    if (nodes.length > 0) {
      const texts = nodes.map((n) => domToMarkdown(n)).filter(Boolean);
      if (texts.length > 0) return texts.join("\n\n---\n\n").slice(0, 10000);
    }
  }

  return "";
}

function extractWithGenericSelectors() {
  const selectors = [
    "[data-message-author-role='assistant']",
    ".markdown",
    ".prose",
    "[class*='assistant-message']",
    "[class*='ai-message']",
    "[class*='bot-message']",
    "[class*='response-content']",
    "main article",
    "main",
  ];

  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll(selector))
      .map((node) => domToMarkdown(node))
      .filter(Boolean);
    if (nodes.length > 0) return nodes.join("\n\n---\n\n").slice(0, 10000);
  }

  return (document.body?.innerText || "").trim().slice(0, 8000);
}

export function extractReadablePageText() {
  const host = window.location.hostname.replace(/^www\./, "");
  const siteText = extractBySiteSelectors(host);
  if (siteText && siteText.length > 40) {
    return siteText;
  }
  return extractWithGenericSelectors();
}
