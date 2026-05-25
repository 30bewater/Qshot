/**
 * executor-actions.js
 * Individual step action executors: focus / setValue / triggerEvents /
 * click / sendKeys / smartSubmit.
 */

import { delay } from "./constants.js";
import {
  safeFocus,
  isTextControl,
  setNativeValue,
  dispatchEventList,
  dispatchKeyboardEvent,
  detectInputType,
} from "./dom-utils.js";
import { setContenteditableValue } from "./editors.js";
import {
  findElement,
  getSelectors,
  readElementValue,
  activateSubmitButton,
  dispatchSubmitKeys,
  isSafeToSubmitForm,
  isUsableSubmitButton,
  findBestSubmitButton,
} from "./executor-dom.js";

export async function executeFocus(step) {
  const element = await findElement(step);
  safeFocus(element);
  if (!step.skipClick && typeof element.click === "function") {
    element.click();
  }
}

export async function executeSetValue(step, query) {
  const text = String(query || "");
  const maxAttempts = step.maxAttempts || 12;
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const element = await findElement(step);
    safeFocus(element);

    let inputType = step.inputType === "auto"
      ? detectInputType(element)
      : (step.inputType || detectInputType(element));

    if (inputType === "text" && !isTextControl(element)) {
      inputType = "contenteditable";
      try {
        if (element.getAttribute("contenteditable") !== "true") {
          element.setAttribute("contenteditable", "true");
        }
      } catch (_error) {
        // some containers actively reset contenteditable; fallback handles it
      }
    }

    try {
      if (inputType === "contenteditable") {
        setContenteditableValue(element, text);
      } else if (isTextControl(element)) {
        setNativeValue(element, text);
        dispatchEventList(element, ["input", "change"]);
      } else {
        throw new Error("目标元素不是可写输入控件");
      }
    } catch (error) {
      lastError = error;
    }

    if (!text) return;

    await delay(60 + attempt * 40);

    const current = await readCurrentValue(step);
    if (current.includes(text) && await valueRemainsStable(step, text)) return;
  }

  if (lastError) throw lastError;
  throw new Error("写入输入框后内容未生效");
}

async function valueRemainsStable(step, text) {
  const stableWaitMs = Number.isFinite(step.stableWaitMs) ? step.stableWaitMs : 0;
  if (stableWaitMs <= 0) {
    return true;
  }

  const deadline = Date.now() + stableWaitMs;
  while (Date.now() < deadline) {
    await delay(Math.min(120, deadline - Date.now()));
    const current = await readCurrentValue(step);
    if (!current.includes(text)) {
      return false;
    }
  }

  return true;
}

export async function readCurrentValue(step) {
  try {
    const element = await findElement(step);
    if (!element) return "";
    if (isTextControl(element)) return String(element.value || "");
    return String(element.textContent || "");
  } catch (_error) {
    return "";
  }
}

export async function executeTriggerEvents(step) {
  const element = await findElement(step);
  const events = Array.isArray(step.events) ? step.events : [];
  const filtered = element && element.isContentEditable
    ? events.filter((name) => name !== "input" && name !== "beforeinput")
    : events;
  dispatchEventList(element, filtered);
}

export async function executeClick(step) {
  const selectors = getSelectors(step);
  if (selectors.length === 0) throw new Error("缺少选择器");

  const timeoutMs = Number.isFinite(step.timeout) ? step.timeout : 1500;
  const deadline = Date.now() + timeoutMs;
  let lastSeen = null;

  while (Date.now() <= deadline) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element) continue;
      lastSeen = element;
      if (isUsableSubmitButton(element)) {
        activateSubmitButton(element);
        return true;
      }
    }
    await delay(25);
  }

  if (!lastSeen) throw new Error(`未找到元素: ${selectors.join(", ")}`);
  throw new Error("目标按钮处于禁用态");
}

export async function executeSendKeys(step) {
  const element = step.selector || step.selectors
    ? await findElement(step)
    : document.activeElement;
  if (!element) throw new Error("没有可发送按键的目标元素");

  const keys = Array.isArray(step.keys) ? step.keys : [];
  for (const key of keys) {
    dispatchKeyboardEvent(element, "keydown", key);
    dispatchKeyboardEvent(element, "keypress", key);
    dispatchKeyboardEvent(element, "keyup", key);
  }
}

export async function executeSmartSubmit(step, query) {
  const anchor = step.selector || step.selectors
    ? await findElement(step)
    : document.activeElement;
  if (!anchor) throw new Error("没有可用于提交的输入元素");

  safeFocus(anchor);

  const submitSelectors = Array.isArray(step.submitSelectors) && step.submitSelectors.length > 0
    ? step.submitSelectors
    : [
        "button[type='submit']",
        "button[aria-label*='发送']",
        "button[aria-label*='Send']",
        "button[title*='发送']",
        "button[title*='Send']",
        "[role='button'][aria-label*='发送']",
        "[role='button'][aria-label*='Send']",
      ];

  // 默认 3000ms：React SPA 冷启动时提交按钮启用可能需要 1~2s，原 1200ms 经常超时
  const waitMs = Number.isFinite(step.submitWaitMs) ? step.submitWaitMs : 3000;
  const deadline = Date.now() + waitMs;
  while (Date.now() <= deadline) {
    const candidate = findBestSubmitButton(anchor, submitSelectors);
    if (candidate) {
      activateSubmitButton(candidate);
      if (step.enterFallbackAfterClick !== false && await shouldTryKeyboardFallbackAfterClick(step, query, anchor)) {
        const retryCandidate = findBestSubmitButton(anchor, submitSelectors);
        if (retryCandidate && retryCandidate !== candidate) {
          activateSubmitButton(retryCandidate);
          await delay(120);
        }
        dispatchSubmitKeys(anchor);
      }
      return true;
    }
    await delay(25);
  }

  const form = typeof anchor.closest === "function" ? anchor.closest("form") : null;
  if (form && isSafeToSubmitForm(form)) {
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return true;
    }
    if (typeof form.submit === "function") {
      form.submit();
      return true;
    }
  }

  dispatchSubmitKeys(anchor);
  return false;
}

async function shouldTryKeyboardFallbackAfterClick(step, query, anchor) {
  const text = String(query || "").trim();
  if (!text) return false;

  const waitMs = Number.isFinite(step.postClickVerifyMs) ? step.postClickVerifyMs : 900;
  await delay(waitMs);

  const current = readCurrentValueNow(step, anchor);
  return current.includes(text);
}

function readCurrentValueNow(step, anchor) {
  const anchorText = readElementValue(anchor);
  if (anchorText) return anchorText;

  for (const selector of getSelectors(step)) {
    const element = document.querySelector(selector);
    const value = readElementValue(element);
    if (value) return value;
  }

  return "";
}
