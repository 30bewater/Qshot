(function initInjectScript() {
  const registryCache = {
    sites: null
  };
  const requestResults = new Map();
  const requestsInProgress = new Set();
  let lastReportedUrl = "";

  setupUrlReporting();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "SEARCH_SITE_QUERY") {
      return false;
    }

    handleSearchRequest(message)
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({
          ok: false,
          siteId: message.site?.id,
          error: error.message
        });
      });

    return true;
  });

  window.addEventListener("message", (event) => {
    if (!event.data) return;

    if (event.data.type === "AI_COMPARE_EXTRACT") {
      handleExtractRequest(event.data);
      return;
    }

    if (event.data.type !== "AI_COMPARE_SEARCH") {
      return;
    }

    const requestId = event.data.requestId;
    if (requestId && requestResults.has(requestId)) {
      notifyParentFrame(requestResults.get(requestId));
      return;
    }

    if (requestId && requestsInProgress.has(requestId)) {
      return;
    }

    if (requestId) {
      requestsInProgress.add(requestId);
    }

    handleSearchRequest(event.data)
      .then((result) => {
        const finalResult = {
          ...result,
          requestId
        };
        if (requestId) {
          requestResults.set(requestId, finalResult);
          requestsInProgress.delete(requestId);
        }
        notifyParentFrame(finalResult);
      })
      .catch((error) => {
        const finalResult = {
          ok: false,
          siteId: event.data.site?.id,
          requestId,
          error: error.message
        };
        if (requestId) {
          requestResults.set(requestId, finalResult);
          requestsInProgress.delete(requestId);
        }
        notifyParentFrame(finalResult);
      });
  });

  async function handleSearchRequest(message) {
    const query = String(message.query || "").trim();
    if (!query) {
      return {
        ok: false,
        siteId: message.site?.id,
        error: "查询为空"
      };
    }

    const site = await resolveSite(message.site);
    if (!site || !site.searchHandler) {
      return {
        ok: false,
        siteId: message.site?.id,
        error: `当前页面未匹配到站点配置: ${window.location.hostname}`
      };
    }

    try {
      await executeSiteHandler(query, site.searchHandler);
      reportCurrentUrl(site);
      return {
        ok: true,
        siteId: site.id,
        message: "已在当前卡片中尝试写入查询并触发发送"
      };
    } catch (error) {
      return {
        ok: false,
        siteId: site.id,
        error: error.message
      };
    }
  }

  async function resolveSite(explicitSite) {
    if (explicitSite && explicitSite.searchHandler) {
      return explicitSite;
    }

    const registry = await loadRegistry();
    return registry.find((site) => siteMatchesHost(site, window.location.hostname));
  }

  async function loadRegistry() {
    if (registryCache.sites) {
      return registryCache.sites;
    }

    const response = await fetch(chrome.runtime.getURL("config/siteHandlers.json"));
    if (!response.ok) {
      throw new Error("无法读取站点配置");
    }

    const payload = await response.json();
    registryCache.sites = payload.sites || [];
    return registryCache.sites;
  }

  function siteMatchesHost(site, hostname) {
    const normalizedHost = normalizeHost(hostname);
    const patterns = Array.isArray(site.matchPatterns) ? site.matchPatterns : [];

    return patterns.some((pattern) => normalizedHost === normalizeHost(pattern) || normalizedHost.endsWith(`.${normalizeHost(pattern)}`));
  }

  function normalizeHost(hostname) {
    return String(hostname || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  }

  async function executeSiteHandler(query, handlerConfig) {
    if (!handlerConfig || !Array.isArray(handlerConfig.steps) || handlerConfig.steps.length === 0) {
      throw new Error("无效的站点处理器配置");
    }

    for (const step of handlerConfig.steps) {
      try {
        await executeStep(step, query);
      } catch (error) {
        if (step.optional) {
          continue;
        }

        const label = step.description || step.action || "未知步骤";
        throw new Error(`${label}失败: ${error.message}`);
      }

      if (step.waitAfter) {
        await delay(step.waitAfter);
      }
    }
  }

  async function executeStep(step, query) {
    switch (step.action) {
      case "focus":
        await executeFocus(step);
        return;
      case "setValue":
        await executeSetValue(step, query);
        return;
      case "triggerEvents":
        await executeTriggerEvents(step);
        return;
      case "click":
        await executeClick(step);
        return;
      case "wait":
        await delay(step.duration || 0);
        return;
      case "sendKeys":
        await executeSendKeys(step);
        return;
      case "smartSubmit":
        await executeSmartSubmit(step);
        return;
      default:
        throw new Error(`不支持的 action: ${step.action}`);
    }
  }

  async function executeFocus(step) {
    const element = await findElement(step);
    safeFocus(element);
    if (typeof element.click === "function") {
      element.click();
    }
  }

  async function executeSetValue(step, query) {
    const element = await findElement(step);
    safeFocus(element);

    const inputType = step.inputType === "auto"
      ? detectInputType(element)
      : (step.inputType || detectInputType(element));

    if (inputType === "contenteditable") {
      setContenteditableValue(element, query);
      return;
    }

    if (isTextControl(element)) {
      setNativeValue(element, query);
      dispatchEventList(element, ["input", "change"]);
      return;
    }

    throw new Error("目标元素不是可写输入控件");
  }

  async function executeTriggerEvents(step) {
    const element = await findElement(step);
    dispatchEventList(element, Array.isArray(step.events) ? step.events : []);
  }

  async function executeClick(step) {
    const element = await findElement(step);
    element.click();
  }

  async function executeSendKeys(step) {
    const element = step.selector || step.selectors
      ? await findElement(step)
      : document.activeElement;

    if (!element) {
      throw new Error("没有可发送按键的目标元素");
    }

    const keys = Array.isArray(step.keys) ? step.keys : [];
    for (const key of keys) {
      dispatchKeyboardEvent(element, "keydown", key);
      dispatchKeyboardEvent(element, "keypress", key);
      dispatchKeyboardEvent(element, "keyup", key);
    }
  }

  async function executeSmartSubmit(step) {
    const anchor = step.selector || step.selectors
      ? await findElement(step)
      : document.activeElement;

    if (!anchor) {
      throw new Error("没有可用于提交的输入元素");
    }

    safeFocus(anchor);

    const form = typeof anchor.closest === "function" ? anchor.closest("form") : null;
    if (form) {
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
        return;
      }

      if (typeof form.submit === "function") {
        form.submit();
        return;
      }
    }

    const submitSelectors = Array.isArray(step.submitSelectors) && step.submitSelectors.length > 0
      ? step.submitSelectors
      : [
          "button[type='submit']",
          "button[aria-label*='发送']",
          "button[aria-label*='Send']",
          "button[title*='发送']",
          "button[title*='Send']",
          "[role='button'][aria-label*='发送']",
          "[role='button'][aria-label*='Send']"
        ];

    const candidate = findBestSubmitButton(anchor, submitSelectors);
    if (candidate) {
      candidate.click();
      return;
    }

    dispatchKeyboardEvent(anchor, "keydown", "Enter");
    dispatchKeyboardEvent(anchor, "keypress", "Enter");
    dispatchKeyboardEvent(anchor, "keyup", "Enter");
  }

  async function findElement(step) {
    const selectors = getSelectors(step);
    if (selectors.length === 0) {
      throw new Error("缺少选择器");
    }

    const timeoutMs = step.timeout || 6000;
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          return element;
        }
      }

      await delay(50);
    }

    throw new Error(`未找到元素: ${selectors.join(", ")}`);
  }

  function getSelectors(step) {
    if (Array.isArray(step.selectors)) {
      return step.selectors.filter(Boolean);
    }

    if (Array.isArray(step.selector)) {
      return step.selector.filter(Boolean);
    }

    return step.selector ? [step.selector] : [];
  }

  function findBestSubmitButton(anchor, selectors) {
    const searchRoots = [];
    const nearbyRoot = typeof anchor.closest === "function"
      ? anchor.closest("form, footer, [role='form'], [class*='input'], [class*='composer'], [class*='footer']")
      : null;

    if (nearbyRoot) {
      searchRoots.push(nearbyRoot);
    }

    if (anchor.parentElement) {
      searchRoots.push(anchor.parentElement);
    }

    searchRoots.push(document);

    const seen = new Set();
    const candidates = [];

    searchRoots.forEach((root) => {
      selectors.forEach((selector) => {
        root.querySelectorAll(selector).forEach((element) => {
          if (seen.has(element) || !isUsableSubmitButton(element)) {
            return;
          }

          seen.add(element);
          candidates.push(element);
        });
      });
    });

    if (candidates.length === 0) {
      return null;
    }

    const anchorRect = anchor.getBoundingClientRect();
    candidates.sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      const leftScore = Math.abs(leftRect.right - anchorRect.right) + Math.abs(leftRect.bottom - anchorRect.bottom);
      const rightScore = Math.abs(rightRect.right - anchorRect.right) + Math.abs(rightRect.bottom - anchorRect.bottom);
      return leftScore - rightScore;
    });

    return candidates[0];
  }

  function isUsableSubmitButton(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function detectInputType(element) {
    if (element.isContentEditable) {
      return "contenteditable";
    }

    return "text";
  }

  function setContenteditableValue(element, query) {
    const text = String(query || "");
    const isLexicalEditor = element.hasAttribute("data-lexical-editor")
      || element.getAttribute("data-lexical-editor") === "true"
      || element.matches("div.chat-input-editor[contenteditable='true']");

    if (isLexicalEditor) {
      updateLexicalEditorContent(element, text);
      return;
    }

    updateGenericContenteditable(element, text);
  }

  function updateLexicalEditorContent(element, query) {
    safeFocus(element);

    let updatedViaApi = false;
    try {
      const editorKey = Object.keys(element).find((key) =>
        key.includes("__lexical") || key.includes("lexical") || key.includes("editor")
      );

      if (editorKey && element[editorKey] && typeof element[editorKey].update === "function") {
        const editor = element[editorKey];
        editor.update(() => {
          const root = editor.getRootElement ? editor.getRootElement() : element;
          if (!root) {
            return;
          }

          root.innerHTML = "";
          const paragraph = document.createElement("p");
          if (query.trim()) {
            const span = document.createElement("span");
            span.setAttribute("data-lexical-text", "true");
            span.textContent = query;
            paragraph.appendChild(span);
          }
          root.appendChild(paragraph);
        });
        updatedViaApi = true;
      }
    } catch (_error) {
      updatedViaApi = false;
    }

    if (!updatedViaApi) {
      const paragraphs = element.querySelectorAll("p");
      if (paragraphs.length > 0) {
        if (paragraphs.length > 1) {
          for (let index = 1; index < paragraphs.length; index += 1) {
            paragraphs[index].remove();
          }
        }

        const firstParagraph = paragraphs[0];
        firstParagraph.innerHTML = "";
        if (query.trim()) {
          const span = document.createElement("span");
          span.setAttribute("data-lexical-text", "true");
          span.textContent = query;
          firstParagraph.appendChild(span);
        }
      } else {
        element.innerHTML = "";
        const paragraph = document.createElement("p");
        if (query.trim()) {
          const span = document.createElement("span");
          span.setAttribute("data-lexical-text", "true");
          span.textContent = query;
          paragraph.appendChild(span);
        }
        element.appendChild(paragraph);
      }
    }

    dispatchContenteditableEvents(element, query);
    tryExecInsertText(element, query);
  }

  function updateGenericContenteditable(element, query) {
    safeFocus(element);

    const paragraphs = element.querySelectorAll("p");
    if (paragraphs.length > 0) {
      if (paragraphs.length > 1) {
        for (let index = 1; index < paragraphs.length; index += 1) {
          paragraphs[index].remove();
        }
      }

      const firstParagraph = paragraphs[0];
      firstParagraph.classList.remove("is-empty", "is-editor-empty");
      firstParagraph.textContent = query;
    } else {
      element.innerHTML = "";
      const paragraph = document.createElement("p");
      paragraph.textContent = query;
      element.appendChild(paragraph);
    }

    dispatchContenteditableEvents(element, query);
    tryExecInsertText(element, query);
  }

  function dispatchContenteditableEvents(element, query) {
    const beforeInputEvent = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: query
    });
    element.dispatchEvent(beforeInputEvent);

    const inputEvent = new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: query
    });
    element.dispatchEvent(inputEvent);

    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    element.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: query }));
    element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: query }));
    element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  }

  function tryExecInsertText(element, query) {
    try {
      safeFocus(element);
      document.execCommand("selectAll", false);
      document.execCommand("insertText", false, query);
    } catch (_error) {
      // Ignore browsers/editors that reject execCommand.
    }
  }

  // 聚焦时禁用浏览器默认的「滚动聚焦元素到可视区」行为，
  // 避免触发外层 .iframes-container 的 scrollLeft/scrollTop 抖动。
  function safeFocus(element) {
    if (!element || typeof element.focus !== "function") {
      return;
    }
    try {
      element.focus({ preventScroll: true });
    } catch (_error) {
      element.focus();
    }
  }

  function isTextControl(element) {
    return element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement;
  }

  function setNativeValue(element, value) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor && typeof descriptor.set === "function") {
      descriptor.set.call(element, value);
      return;
    }

    element.value = value;
  }

  function dispatchEventList(element, events) {
    events.forEach((eventName) => {
      let event;

      if (eventName === "input") {
        event = new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          data: "",
          inputType: "insertText"
        });
      } else {
        event = new Event(eventName, {
          bubbles: true,
          cancelable: true
        });
      }

      element.dispatchEvent(event);
    });
  }

  function dispatchKeyboardEvent(element, phase, key) {
    const event = new KeyboardEvent(phase, {
      key,
      code: key === "Enter" ? "Enter" : key,
      keyCode: key === "Enter" ? 13 : 0,
      which: key === "Enter" ? 13 : 0,
      bubbles: true,
      cancelable: true
    });

    element.dispatchEvent(event);
  }

  function notifyParentFrame(result) {
    if (window.parent === window) {
      return;
    }

    try {
      window.parent.postMessage(
        {
          type: "AI_COMPARE_RESULT",
          siteId: result.siteId,
          requestId: result.requestId,
          ok: result.ok,
          message: result.message,
          error: result.error
        },
        "*"
      );
    } catch (_error) {
      // 顶层标签页模式下没有父页面可通知，忽略即可。
    }
  }

  function handleExtractRequest(message) {
    const content = extractReadablePageText();
    const turns = extractConversationTurns();
    window.parent.postMessage(
      {
        type: "AI_COMPARE_EXTRACT_RESULT",
        requestId: message.requestId,
        siteId: message.site?.id,
        content,
        turns,
        url: window.location.href
      },
      "*"
    );
  }

  function extractReadablePageText() {
    const host = window.location.hostname.replace(/^www\./, "");
    const siteText = extractBySiteSelectors(host);
    if (siteText && siteText.length > 40) {
      return siteText;
    }
    return extractWithGenericSelectors();
  }

  function getSiteContentConfig(host) {
    const configs = {
      "chatgpt.com": {
        containers: ["[data-message-author-role='assistant']"],
        content: [".markdown.prose", ".prose", "[class*='markdown']", "article"]
      },
      "chat.openai.com": {
        containers: ["[data-message-author-role='assistant']"],
        content: [".markdown.prose", ".prose"]
      },
      "chat.deepseek.com": {
        containers: ["[class*='ds-message-bubble'][class*='assistant']", "[class*='message'][class*='assistant']"],
        content: ["[class*='ds-markdown']", "[class*='markdown']", "[class*='chat-message-content']"]
      },
      "kimi.moonshot.cn": {
        containers: ["[class*='segment-item']", "[class*='message'][class*='ai']", "[class*='bubble'][class*='assistant']"],
        content: ["[class*='markdown-content']", "[class*='content']", "[class*='text']"]
      },
      "tongyi.aliyun.com": {
        containers: ["[class*='answer-message']", "[class*='agent-chat__answer']", "[class*='chat-bubble']"],
        content: ["[class*='markdown']", "[class*='answer-text']", "[class*='content']"]
      },
      "doubao.com": {
        containers: ["[data-author-type='2']", "[class*='chat-response']", "[class*='assistant-message']"],
        content: ["[class*='markdown']", "[class*='message-text']", "[class*='content']"]
      },
      "gemini.google.com": {
        containers: ["model-response", "message-content[class*='model']", "[class*='response-container']"],
        content: [".markdown", "[class*='response-content']", "[class*='model-response-text']"]
      },
      "chatglm.cn": {
        containers: ["[class*='chat-msg--ai']", "[class*='assistant-message']"],
        content: ["[class*='content']", "[class*='markdown']", "[class*='text']"]
      },
      "yuanbao.tencent.com": {
        containers: ["[class*='agent-chat__message--ai']", "[class*='ai-message']"],
        content: ["[class*='hyper-text']", "[class*='markdown']", "[class*='content']"]
      }
    };

    for (const [domain, config] of Object.entries(configs)) {
      if (host === domain || host.endsWith("." + domain)) {
        return config;
      }
    }
    return null;
  }

  function domToMarkdown(element) {
    function convertNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || "";
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return "";

      const tag = node.tagName.toLowerCase();
      if (["script", "style", "noscript", "button", "svg", "aside"].includes(tag)) return "";

      const children = () => Array.from(node.childNodes).map(convertNode).join("");

      switch (tag) {
        case "h1": return `\n\n# ${children().trim()}\n\n`;
        case "h2": return `\n\n## ${children().trim()}\n\n`;
        case "h3": return `\n\n### ${children().trim()}\n\n`;
        case "h4": return `\n\n#### ${children().trim()}\n\n`;
        case "h5": return `\n\n##### ${children().trim()}\n\n`;
        case "h6": return `\n\n###### ${children().trim()}\n\n`;
        case "p": {
          const inner = children().trim();
          return inner ? `\n\n${inner}\n\n` : "";
        }
        case "br": return "  \n";
        case "hr": return "\n\n---\n\n";
        case "strong":
        case "b": {
          const inner = children().trim();
          return inner ? `**${inner}**` : "";
        }
        case "em":
        case "i": {
          const inner = children().trim();
          return inner ? `*${inner}*` : "";
        }
        case "del":
        case "s": {
          const inner = children().trim();
          return inner ? `~~${inner}~~` : "";
        }
        case "code": {
          if (node.parentElement && node.parentElement.tagName.toLowerCase() === "pre") {
            return node.textContent || "";
          }
          const inner = children().trim();
          return inner ? `\`${inner}\`` : "";
        }
        case "pre": {
          const codeEl = node.querySelector("code");
          let lang = "";
          if (codeEl) {
            const classMatch = codeEl.className.match(/language-(\w+)/);
            if (classMatch) lang = classMatch[1];
          }
          const content = (codeEl || node).textContent || "";
          return `\n\n\`\`\`${lang}\n${content.trim()}\n\`\`\`\n\n`;
        }
        case "blockquote": {
          const inner = children().trim().split("\n").map((line) => `> ${line}`).join("\n");
          return `\n\n${inner}\n\n`;
        }
        case "ul": {
          const liEls = Array.from(node.querySelectorAll("li")).filter(
            (el) => el.closest("ul") === node || el.closest("ol") === node
          );
          const items = liEls
            .map((li) => {
              const text = convertNode(li).trim();
              return `- ${text.replace(/\n/g, "\n  ")}`;
            })
            .join("\n");
          return items ? `\n\n${items}\n\n` : "";
        }
        case "ol": {
          const liEls = Array.from(node.querySelectorAll("li")).filter(
            (el) => el.closest("ul") === node || el.closest("ol") === node
          );
          const items = liEls
            .map((li, idx) => {
              const text = convertNode(li).trim();
              return `${idx + 1}. ${text.replace(/\n/g, "\n   ")}`;
            })
            .join("\n");
          return items ? `\n\n${items}\n\n` : "";
        }
        case "li": {
          const inner = children().trim();
          return inner.replace(/\n{3,}/g, "\n\n");
        }
        case "div":
        case "section":
        case "article":
        case "figure":
        case "figcaption":
        case "details":
        case "summary": {
          const inner = children().trim();
          return inner ? `\n\n${inner}\n\n` : "";
        }
        case "a": {
          const href = (node.getAttribute("href") || "").trim();
          const text = children().trim();
          if (!text) return "";
          if (!href || href.startsWith("#") || href === text) return text;
          return `[${text}](${href})`;
        }
        case "img": {
          const alt = node.getAttribute("alt") || "";
          return alt ? `[图片: ${alt}]` : "";
        }
        case "table": return convertTable(node);
        default: return children();
      }
    }

    function convertTable(tableEl) {
      const allRows = Array.from(tableEl.querySelectorAll("tr"));
      if (!allRows.length) return "";
      const data = allRows
        .map((row) =>
          Array.from(row.querySelectorAll("th, td")).map((cell) =>
            (cell.innerText || cell.textContent || "").trim().replace(/\|/g, "\\|").replace(/\n/g, " ")
          )
        )
        .filter((row) => row.length > 0);
      if (!data.length) return "";
      const colCount = Math.max(...data.map((r) => r.length));
      const normalized = data.map((row) => {
        while (row.length < colCount) row.push("");
        return row;
      });
      const sep = Array(colCount).fill("---");
      const lines = [
        `| ${normalized[0].join(" | ")} |`,
        `| ${sep.join(" | ")} |`,
        ...normalized.slice(1).map((row) => `| ${row.join(" | ")} |`)
      ];
      return `\n\n${lines.join("\n")}\n\n`;
    }

    return convertNode(element).replace(/\n{3,}/g, "\n\n").trim();
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
        if (!text) {
          text = domToMarkdown(container);
        }
        if (text) parts.push(text);
      }

      if (parts.length > 0) break;
    }

    if (parts.length > 0) {
      return parts.join("\n\n---\n\n").slice(0, 10000);
    }

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
      "main"
    ];

    for (const selector of selectors) {
      const nodes = Array.from(document.querySelectorAll(selector))
        .map((node) => domToMarkdown(node))
        .filter(Boolean);
      if (nodes.length > 0) {
        return nodes.join("\n\n---\n\n").slice(0, 10000);
      }
    }

    return (document.body?.innerText || "").trim().slice(0, 8000);
  }

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
        getAiText: makeAiExtractor([".markdown.prose", ".prose", "[class*='markdown']"])
      },
      "chat.openai.com": {
        allMessages: "[data-message-author-role='user'], [data-message-author-role='assistant']",
        getRole: (el) => el.getAttribute("data-message-author-role"),
        getUserText: (el) => {
          const inner = el.querySelector(".whitespace-pre-wrap") || el.querySelector("p");
          return ((inner || el).innerText || "").trim();
        },
        getAiText: makeAiExtractor([".markdown.prose", ".prose"])
      },
      "doubao.com": {
        allMessages: "[data-author-type='1'], [data-author-type='2']",
        getRole: (el) => el.getAttribute("data-author-type") === "1" ? "user" : "assistant",
        getUserText: (el) => (el.innerText || el.textContent || "").trim(),
        getAiText: makeAiExtractor(["[class*='markdown']", "[class*='message-text']", "[class*='content']"])
      },
      "chat.deepseek.com": {
        userSelector: ["[class*='human-message']", "[class*='ds-message-bubble--user']", "[class*='user-message']"],
        assistantSelector: ["[class*='ds-message-bubble--assistant']", "[class*='ds-message-bubble'][class*='assistant']"],
        getAiText: makeAiExtractor(["[class*='ds-markdown']", "[class*='markdown']"])
      },
      "kimi.moonshot.cn": {
        userSelector: ["[class*='chat-message--user']", "[class*='segment'][class*='user']", "[class*='human']"],
        assistantSelector: ["[class*='chat-message--ai']", "[class*='segment'][class*='ai']", "[class*='bubble'][class*='assistant']"],
        getAiText: makeAiExtractor(["[class*='markdown-content']", "[class*='content']"])
      },
      "gemini.google.com": {
        userSelector: ["user-query", ".user-query-bubble-with-background"],
        assistantSelector: ["model-response", "message-content"],
        getAiText: makeAiExtractor([".markdown", "[class*='response-content']", "[class*='model-response-text']"])
      },
      "tongyi.aliyun.com": {
        userSelector: ["[class*='chat-bubble-user']", "[class*='question-container']", "[class*='user-message']"],
        assistantSelector: ["[class*='answer-message']", "[class*='agent-chat__answer']"],
        getAiText: makeAiExtractor(["[class*='markdown']", "[class*='answer-text']"])
      },
      "chatglm.cn": {
        userSelector: ["[class*='chat-msg--human']"],
        assistantSelector: ["[class*='chat-msg--ai']"],
        getAiText: makeAiExtractor(["[class*='content']", "[class*='markdown']"])
      },
      "yuanbao.tencent.com": {
        userSelector: ["[class*='agent-chat__message--human']", "[class*='question']"],
        assistantSelector: ["[class*='agent-chat__message--ai']"],
        getAiText: makeAiExtractor(["[class*='hyper-text']", "[class*='markdown']", "[class*='content']"])
      }
    };

    for (const [domain, config] of Object.entries(configs)) {
      if (host === domain || host.endsWith("." + domain)) {
        return config;
      }
    }
    return null;
  }

  function extractConversationTurns() {
    const host = window.location.hostname.replace(/^www\./, "");
    const config = getSiteConversationConfig(host);
    if (!config) return null;

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
          if (text && text !== "暂未提取到内容") {
            turns.push({ role, text });
          }
        }
      } else {
        const userSelStr = (config.userSelector || []).join(", ");
        const aiSelStr = (config.assistantSelector || []).join(", ");
        if (!userSelStr && !aiSelStr) return null;

        const combined = [userSelStr, aiSelStr].filter(Boolean).join(", ");
        const allEls = Array.from(document.querySelectorAll(combined));
        const userEls = new Set(userSelStr ? Array.from(document.querySelectorAll(userSelStr)) : []);

        for (const el of allEls) {
          const role = userEls.has(el) ? "user" : "assistant";
          const text = role === "user"
            ? (el.innerText || el.textContent || "").trim()
            : (config.getAiText ? config.getAiText(el) : domToMarkdown(el));
          if (text && text !== "暂未提取到内容") {
            turns.push({ role, text });
          }
        }
      }
    } catch (_err) {
      return null;
    }

    return turns.length > 0 ? turns : null;
  }

  async function setupUrlReporting() {
    const site = await resolveSite();
    if (!site) {
      return;
    }

    reportCurrentUrl(site);

    const originalPushState = history.pushState.bind(history);
    history.pushState = function patchedPushState(...args) {
      const value = originalPushState(...args);
      reportCurrentUrl(site);
      return value;
    };

    const originalReplaceState = history.replaceState.bind(history);
    history.replaceState = function patchedReplaceState(...args) {
      const value = originalReplaceState(...args);
      reportCurrentUrl(site);
      return value;
    };

    window.addEventListener("popstate", () => reportCurrentUrl(site));
    window.addEventListener("hashchange", () => reportCurrentUrl(site));
    window.setInterval(() => reportCurrentUrl(site), 1500);
  }

  function reportCurrentUrl(site) {
    const currentUrl = window.location.href;
    if (!site || !currentUrl || currentUrl === lastReportedUrl || window.parent === window) {
      return;
    }

    lastReportedUrl = currentUrl;
    window.parent.postMessage(
      {
        type: "AI_COMPARE_URL_UPDATE",
        siteId: site.id,
        currentUrl
      },
      "*"
    );
  }

  function delay(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  (async function initEmbedSidebarFix() {
    if (window.parent === window) {
      return;
    }

    let site;
    try {
      site = await resolveSite(null);
    } catch (_error) {
      return;
    }

    if (!site) {
      return;
    }

    const STYLE_ID = "ai-compare-embed-sidebar-fix";

    const SITE_STYLE_MAP = {
      chatgpt: [
        "/* AI批量搜索：隐藏 ChatGPT 侧边栏，消除左侧留白 */",
        /* 隐藏 nav 本体 */
        "nav { display: none !important; }",
        /* 隐藏直接包含 nav 的 div（单层父级） */
        "div:has(> nav) { display: none !important; width: 0 !important; min-width: 0 !important; max-width: 0 !important; overflow: hidden !important; flex: none !important; flex-basis: 0 !important; padding: 0 !important; margin: 0 !important; }",
        /* 隐藏所有包含 nav 但不包含 main 的祖先 div（捕获多层嵌套的侧边栏 wrapper） */
        "div:has(nav):not(:has(main)):not(:has([role='main'])) { display: none !important; width: 0 !important; min-width: 0 !important; max-width: 0 !important; overflow: hidden !important; flex: none !important; flex-basis: 0 !important; padding: 0 !important; margin: 0 !important; }",
        /* 兼容旧版类名 */
        "[class*='z-sidebar'] { display: none !important; width: 0 !important; min-width: 0 !important; }",
        "[class*='sidebar-header'] { display: none !important; }",
        "[data-testid*='sidebar'], [data-testid*='nav-'] { display: none !important; width: 0 !important; min-width: 0 !important; }",
        /* main 区域撑满 */
        "main { flex: 1 !important; width: 100% !important; padding-left: 0 !important; margin-left: 0 !important; min-width: 0 !important; }",
        "main [class*='max-w']:not([class*='max-w-none']) { max-width: 100% !important; }"
      ],
      deepseek: [
        "/* AI批量搜索：隐藏 DeepSeek 侧边栏，消除左侧留白 */",
        "[class*='sidebar']:not([class*='sidebar-content']):not([class*='sidebar-body']) { display: none !important; width: 0 !important; min-width: 0 !important; max-width: 0 !important; overflow: hidden !important; flex: none !important; flex-basis: 0 !important; }",
        "[class*='left-panel'], [class*='left_panel'], [class*='nav-panel'], [class*='chat-list'] { display: none !important; width: 0 !important; min-width: 0 !important; max-width: 0 !important; overflow: hidden !important; flex: none !important; flex-basis: 0 !important; }",
        "div:has(nav):not(:has(main)):not(:has([role='main'])) { display: none !important; width: 0 !important; min-width: 0 !important; max-width: 0 !important; overflow: hidden !important; flex: none !important; flex-basis: 0 !important; }",
        "[class*='chat-main'], [class*='main-content'], [class*='conversation'] { flex: 1 !important; width: 100% !important; min-width: 0 !important; padding-left: 0 !important; margin-left: 0 !important; }"
      ]
    };

    const cssLines = SITE_STYLE_MAP[site.id];
    if (!cssLines) {
      return;
    }

    function injectStyle() {
      let el = document.getElementById(STYLE_ID);
      if (!el) {
        el = document.createElement("style");
        el.id = STYLE_ID;
        (document.head || document.documentElement).appendChild(el);
      }
      el.textContent = cssLines.join("\n");
    }

    function schedule() {
      injectStyle();
    }

    let observer = null;

    function startObserver() {
      if (observer) return;
      observer = new MutationObserver(() => {
        if (!document.getElementById(STYLE_ID)) {
          injectStyle();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        schedule();
        startObserver();
      });
    } else {
      schedule();
      startObserver();
    }
    setTimeout(schedule, 400);
    setTimeout(schedule, 1500);
    setTimeout(schedule, 4000);
  })();
})();
