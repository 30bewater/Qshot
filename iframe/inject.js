(function initInjectScript() {
  const registryCache = {
    sites: null
  };
  const requestResults = new Map();
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
    if (!event.data || event.data.type !== "AI_COMPARE_SEARCH") {
      if (event.data?.type === "AI_COMPARE_EXTRACT") {
        handleExtractRequest(event.data);
      }
      return;
    }

    const requestId = event.data.requestId;
    if (requestId && requestResults.has(requestId)) {
      notifyParentFrame(requestResults.get(requestId));
      return;
    }

    handleSearchRequest(event.data)
      .then((result) => {
        const finalResult = {
          ...result,
          requestId
        };
        if (requestId) {
          requestResults.set(requestId, finalResult);
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
    element.focus();
    if (typeof element.click === "function") {
      element.click();
    }
  }

  async function executeSetValue(step, query) {
    const element = await findElement(step);
    element.focus();

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

    anchor.focus();

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

      await delay(200);
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
    element.focus();

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
    element.focus();

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
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("insertText", false, query);
    } catch (_error) {
      // Ignore browsers/editors that reject execCommand.
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
    window.parent.postMessage(
      {
        type: "AI_COMPARE_EXTRACT_RESULT",
        requestId: message.requestId,
        siteId: message.site?.id,
        content,
        url: window.location.href
      },
      "*"
    );
  }

  function extractReadablePageText() {
    const selectors = [
      "[data-message-author-role='assistant']",
      ".markdown",
      ".prose",
      "[class*='message']",
      "[class*='response']",
      "main"
    ];

    for (const selector of selectors) {
      const nodes = Array.from(document.querySelectorAll(selector))
        .map((node) => (node.textContent || "").trim())
        .filter(Boolean);
      if (nodes.length > 0) {
        return nodes.join("\n\n").slice(0, 8000);
      }
    }

    return (document.body?.innerText || "").trim().slice(0, 8000);
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

  (async function initChatgptEmbedWiden() {
    if (window.parent === window) {
      return;
    }

    let site;
    try {
      site = await resolveSite(null);
    } catch (_error) {
      return;
    }

    if (!site || site.id !== "chatgpt") {
      return;
    }

    const STYLE_ID = "ai-compare-chatgpt-embed-widen";

    function injectStyle() {
      if (document.getElementById(STYLE_ID)) {
        return;
      }
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = [
        "/* AI批量搜索：在嵌入 iframe 中放宽 ChatGPT 主列 max-width，减轻右侧留白 */",
        "main [class*=\"max-w\"]:not([class*=\"max-w-none\"]) { max-width: 100% !important; }"
      ].join("\n");
      (document.head || document.documentElement).appendChild(style);
    }

    function schedule() {
      injectStyle();
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", schedule);
    } else {
      schedule();
    }
    setTimeout(schedule, 600);
    setTimeout(schedule, 2200);
    setTimeout(schedule, 5000);
  })();
})();
