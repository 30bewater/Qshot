/**
 * extractor-conversation.js
 * Conversation-turn extraction: site-specific configs + generic fallback +
 * ChatGPT API fetch + Next.js window-state extraction.
 * Exports: extractTurnsWithFallback (called by extractor.js entry point)
 */

import { domToMarkdown } from "./extractor-dom-to-markdown.js";

// ─── ChatGPT API fetch ───────────────────────────────────────────────────────

async function fetchChatGPTConversation() {
  const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
  if (!match) return null;
  try {
    const res = await Promise.race([
      fetch(`/backend-api/conversation/${match[1]}`),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.mapping) return null;

    const nodes = data.mapping;
    const orderedIds = [];
    let nodeId = data.current_node;
    while (nodeId && nodes[nodeId]) {
      orderedIds.unshift(nodeId);
      nodeId = nodes[nodeId]?.parent;
    }

    const turns = [];
    for (const id of orderedIds) {
      const msg = nodes[id]?.message;
      if (!msg) continue;
      const role = msg.author?.role;
      if (role !== "user" && role !== "assistant") continue;
      const parts = msg.content?.parts;
      if (!Array.isArray(parts)) continue;
      const text = parts.filter((p) => typeof p === "string").join("\n").trim();
      if (!text) continue;
      turns.push({ role: role === "user" ? "user" : "assistant", text });
    }
    return turns.length > 0 ? turns : null;
  } catch {
    return null;
  }
}

// ─── Next.js / React window-state extraction ────────────────────────────────

function extractFromWindowState() {
  try {
    const pageProps = window.__NEXT_DATA__?.props?.pageProps;
    if (pageProps) {
      const candidates = [
        pageProps?.conversation?.messages,
        pageProps?.chatConversation?.messages,
        pageProps?.messages,
      ];
      for (const msgs of candidates) {
        if (!Array.isArray(msgs) || msgs.length === 0) continue;
        const turns = msgs
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => {
            const text =
              typeof m.content === "string"
                ? m.content
                : Array.isArray(m.content)
                  ? m.content.filter((c) => typeof c === "string").join("\n")
                  : "";
            return { role: m.role, text: text.trim() };
          })
          .filter((m) => m.text);
        if (turns.length > 0) return turns;
      }
    }
  } catch { /* ignore */ }
  return null;
}

// ─── Site-specific conversation configs ─────────────────────────────────────

function getSiteConversationConfig(host) {
  const makeAiExtractor = (selectors) => (el) => {
    for (const sel of selectors) {
      const found = el.querySelector(sel);
      if (found) return domToMarkdown(found);
    }
    return domToMarkdown(el);
  };

  const configs = {
    "chatgpt.com": {
      allMessages: "[data-message-author-role='user'], [data-message-author-role='assistant']",
      getRole: (el) => el.getAttribute("data-message-author-role"),
      getUserText: (el) => {
        const inner = el.querySelector(".whitespace-pre-wrap") || el.querySelector("p");
        return ((inner || el).innerText || "").trim();
      },
      getAiText: makeAiExtractor([".markdown.prose", ".prose", "[class*='markdown']"]),
    },
    "chat.openai.com": {
      allMessages: "[data-message-author-role='user'], [data-message-author-role='assistant']",
      getRole: (el) => el.getAttribute("data-message-author-role"),
      getUserText: (el) => {
        const inner = el.querySelector(".whitespace-pre-wrap") || el.querySelector("p");
        return ((inner || el).innerText || "").trim();
      },
      getAiText: makeAiExtractor([".markdown.prose", ".prose"]),
    },
    "doubao.com": {
      userSelector: [
        "[data-author-type='1']",
        "[class*='message--human']",
        "[class*='chat-message--human']",
        "[class*='human-message']",
        "[class*='sender-content']",
      ],
      assistantSelector: [
        "[data-author-type='2']",
        "[class*='message--bot']",
        "[class*='chat-message--bot']",
        "[class*='bot-message']",
        "[class*='assistant-message']",
        "[class*='receiver-content']",
      ],
      getAiText: makeAiExtractor(["[class*='markdown']", "[class*='message-text']", "[class*='content']"]),
    },
    "chat.deepseek.com": {
      userSelector: ["[class*='human-message']", "[class*='ds-message-bubble--user']", "[class*='user-message']"],
      assistantSelector: ["[class*='ds-message-bubble--assistant']", "[class*='ds-message-bubble'][class*='assistant']"],
      getAiText: makeAiExtractor(["[class*='ds-markdown']", "[class*='markdown']"]),
    },
    "kimi.moonshot.cn": {
      userSelector: ["[class*='chat-message--user']", "[class*='segment'][class*='user']", "[class*='human']"],
      assistantSelector: ["[class*='chat-message--ai']", "[class*='segment'][class*='ai']", "[class*='bubble'][class*='assistant']"],
      getAiText: makeAiExtractor(["[class*='markdown-content']", "[class*='content']"]),
    },
    "kimi.com": {
      userSelector: ["[class*='chat-message--user']", "[class*='segment'][class*='user']", "[class*='human']", "[class*='user-message']"],
      assistantSelector: ["[class*='chat-message--ai']", "[class*='segment'][class*='ai']", "[class*='bubble'][class*='assistant']", "[class*='chat-content-item']"],
      getAiText: makeAiExtractor(["[class*='markdown-content']", "[class*='content']", "[class*='markdown']"]),
    },
    "gemini.google.com": {
      userSelector: ["user-query"],
      assistantSelector: ["model-response"],
      getAiText: makeAiExtractor([".markdown", "[class*='response-content']", "[class*='model-response-text']"]),
    },
    "tongyi.aliyun.com": {
      userSelector: ["[class*='chat-bubble-user']", "[class*='question-container']", "[class*='user-message']"],
      assistantSelector: ["[class*='answer-message']", "[class*='agent-chat__answer']"],
      getAiText: makeAiExtractor(["[class*='markdown']", "[class*='answer-text']"]),
    },
    "chatglm.cn": {
      userSelector: ["[class*='chat-msg--human']"],
      assistantSelector: ["[class*='chat-msg--ai']"],
      getAiText: makeAiExtractor(["[class*='content']", "[class*='markdown']"]),
    },
    "yuanbao.tencent.com": {
      userSelector: ["[class*='agent-chat__message--human']", "[class*='question']"],
      assistantSelector: [
        "[class*='agent-chat__message--ai']:not([class*='reasoning'])",
        "[class*='agent-chat__message--ai']:not([class*='thinking'])",
        "[class*='agent-chat__message--ai']",
      ],
      getAiText: makeAiExtractor(["[class*='hyper-text']", "[class*='markdown']", "[class*='content']"]),
    },
    "qianwen.com": {
      userSelector: [
        "[class*='human-message']",
        "[class*='user-message']",
        "[class*='chat-bubble-user']",
        "[class*='question-container']",
      ],
      assistantSelector: [
        "[class*='answer-message']",
        "[class*='agent-chat__answer']",
        "[class*='ai-message']",
        "[class*='assistant-message']",
      ],
      getAiText: makeAiExtractor(["[class*='markdown']", "[class*='answer-text']", "[class*='content']"]),
    },
    "claude.ai": {
      userSelector: [
        "[data-testid='human-turn']",
        "[class*='human-turn']",
        "[class*='user-message']",
        "[class*='HumanMessage']",
      ],
      assistantSelector: [
        "[data-testid='assistant-turn']",
        "[class*='assistant-turn']",
        "[class*='ai-message']",
        "[class*='AssistantMessage']",
      ],
      getAiText: makeAiExtractor(["[class*='prose']", "[class*='markdown']", "[class*='content']"]),
    },
    "grok.com": {
      userSelector: [
        "[class*='human-message']",
        "[class*='user-message']",
        "[class*='message--user']",
        "[class*='query']",
      ],
      assistantSelector: [
        "[class*='assistant-message']",
        "[class*='ai-message']",
        "[class*='message--assistant']",
        "[class*='response']",
      ],
      getAiText: makeAiExtractor(["[class*='markdown']", "[class*='prose']", "[class*='content']"]),
    },
  };

  for (const [domain, config] of Object.entries(configs)) {
    if (host === domain || host.endsWith("." + domain)) return config;
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Keep only the outermost elements, dropping any that are descendants of another. */
function filterDescendants(elements) {
  return elements.filter(
    (el) => !elements.some((other) => other !== el && other.contains(el))
  );
}

function extractConversationTurnsGeneric() {
  const candidates = [
    ["[data-message-author-role='user']",    "[data-message-author-role='assistant']"],
    ["[data-author-type='1']",               "[data-author-type='2']"],
    ["[class*='human-turn']",                "[class*='assistant-turn']"],
    ["[class*='user-turn']",                 "[class*='assistant-turn']"],
    ["[class*='human-message']",             "[class*='assistant-message']"],
    ["[class*='user-message']",              "[class*='ai-message']"],
    ["[class*='human-bubble']",              "[class*='assistant-bubble']"],
    ["[class*='message--human']",            "[class*='message--bot']"],
    ["[class*='message--user']",             "[class*='message--bot']"],
    ["[class*='chat-message--human']",       "[class*='chat-message--bot']"],
    ["[class*='sender-content']",            "[class*='receiver-content']"],
    ["[class*='chat-msg--human']",           "[class*='chat-msg--ai']"],
    ["[class*='request-item']",              "[class*='response-item']"],
  ];

  for (const [userSel, aiSel] of candidates) {
    try {
      const userEls = Array.from(document.querySelectorAll(userSel));
      const aiEls   = Array.from(document.querySelectorAll(aiSel));
      if (userEls.length === 0 || aiEls.length === 0) continue;

      if (Math.abs(userEls.length - aiEls.length) > Math.max(userEls.length, aiEls.length)) continue;

      const combined = `${userSel}, ${aiSel}`;
      const allEls   = filterDescendants(Array.from(document.querySelectorAll(combined)));
      const userSet  = new Set(userEls);

      const turns = [];
      for (const el of allEls) {
        const isUser = userSet.has(el);
        const text   = isUser
          ? (el.innerText || el.textContent || "").trim()
          : domToMarkdown(el);
        if (text && text.length > 2) {
          turns.push({ role: isUser ? "user" : "assistant", text });
        }
      }

      const hasUser      = turns.some((t) => t.role === "user");
      const hasAssistant = turns.some((t) => t.role === "assistant");
      if (hasUser && hasAssistant) return turns;
    } catch (_) { /* skip */ }
  }

  // Exclusion fallback: locate chat container via known AI elements; treat siblings as user messages.
  const exclusionAiSelectors = [
    "[data-author-type='2']",
    "[data-message-author-role='assistant']",
    "[class*='bot-message']",
    "[class*='assistant-message']",
  ];
  for (const aiSel of exclusionAiSelectors) {
    try {
      const aiEls = Array.from(document.querySelectorAll(aiSel));
      if (aiEls.length < 1) continue;

      const parent = aiEls[0].parentElement;
      if (!parent || !aiEls.every((el) => el.parentElement === parent)) continue;

      const aiSet = new Set(aiEls);
      const siblings = Array.from(parent.children);
      const turns = [];

      for (const sib of siblings) {
        if (aiSet.has(sib)) {
          const text = domToMarkdown(sib);
          if (text && text.length > 5) turns.push({ role: "assistant", text });
        } else {
          const text = (sib.innerText || sib.textContent || "").trim();
          if (text && text.length >= 2 && text.length <= 3000) {
            turns.push({ role: "user", text });
          }
        }
      }

      const hasUser = turns.some((t) => t.role === "user");
      const hasAI   = turns.some((t) => t.role === "assistant");
      if (hasUser && hasAI) return turns;
    } catch (_) { /* skip */ }
  }

  return null;
}

function extractConversationTurns() {
  const host = window.location.hostname.replace(/^www\./, "");
  const config = getSiteConversationConfig(host);

  if (config) {
    const turns = [];
    try {
      if (config.allMessages) {
        const els = Array.from(document.querySelectorAll(config.allMessages));
        for (const el of els) {
          const role = config.getRole(el);
          if (role !== "user" && role !== "assistant") continue;
          const text = role === "user"
            ? (config.getUserText ? config.getUserText(el) : (el.innerText || "").trim())
            : (config.getAiText ? config.getAiText(el) : domToMarkdown(el));
          if (text && text !== "暂未提取到内容") turns.push({ role, text });
        }
        if (turns.length > 0 && !turns.some((t) => t.role === "user")) {
          return extractConversationTurnsGeneric();
        }
      } else {
        const userSelStr = (config.userSelector || []).join(", ");
        const aiSelStr   = (config.assistantSelector || []).join(", ");
        if (!userSelStr && !aiSelStr) return extractConversationTurnsGeneric();

        const combined = [userSelStr, aiSelStr].filter(Boolean).join(", ");
        const allEls   = filterDescendants(Array.from(document.querySelectorAll(combined)));
        const userEls  = new Set(userSelStr ? Array.from(document.querySelectorAll(userSelStr)) : []);

        for (const el of allEls) {
          const role = userEls.has(el) ? "user" : "assistant";
          const text = role === "user"
            ? (el.innerText || el.textContent || "").trim()
            : (config.getAiText ? config.getAiText(el) : domToMarkdown(el));
          if (text && text !== "暂未提取到内容") turns.push({ role, text });
        }
        if (turns.length > 0 && !turns.some((t) => t.role === "user")) {
          return extractConversationTurnsGeneric();
        }
      }
    } catch (_err) {
      return extractConversationTurnsGeneric();
    }

    if (turns.length > 0) return turns;
    return extractConversationTurnsGeneric();
  }

  return extractConversationTurnsGeneric();
}

// ─── Unified entry (priority: API → window-state → DOM) ─────────────────────

export async function extractTurnsWithFallback(host) {
  if (host === "chatgpt.com" || host === "chat.openai.com") {
    const turns = await fetchChatGPTConversation();
    if (turns) return turns;
  }

  const stateTurns = extractFromWindowState();
  if (stateTurns) return stateTurns;

  return extractConversationTurns();
}
