/**
 * executor-dom.js
 * Pure DOM helpers for element finding, submit-button discovery, and
 * pointer/keyboard event dispatch.
 * Imported by executor-actions.js and executor.js — no circular deps.
 */

import { delay } from "./constants.js";
import { safeFocus, dispatchKeyboardEvent, isTextControl } from "./dom-utils.js";

function collectElementsDeep(selector, root = document) {
  const results = [];
  if (!(root instanceof Document || root instanceof ShadowRoot || root instanceof Element)) {
    return results;
  }
  try {
    root.querySelectorAll(selector).forEach((el) => results.push(el));
  } catch (_error) {
    return results;
  }
  root.querySelectorAll("*").forEach((el) => {
    if (el.shadowRoot) {
      collectElementsDeep(selector, el.shadowRoot).forEach((node) => results.push(node));
    }
  });
  return results;
}

function pickVisibleElement(elements) {
  for (const element of elements) {
    if (!(element instanceof HTMLElement)) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const style = window.getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") continue;
    return element;
  }
  return elements[0] || null;
}

function querySelectorDeep(selector) {
  const direct = document.querySelector(selector);
  if (direct) return direct;
  const deepMatches = collectElementsDeep(selector);
  return pickVisibleElement(deepMatches);
}

export async function findElement(step) {
  const selectors = getSelectors(step);
  if (selectors.length === 0) throw new Error("缺少选择器");

  const timeoutMs = step.timeout || 6000;
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    for (const selector of selectors) {
      const element = querySelectorDeep(selector);
      if (element) return element;
    }
    await delay(25);
  }

  throw new Error(`未找到元素: ${selectors.join(", ")}`);
}

export function getSelectors(step) {
  if (Array.isArray(step.selectors)) return step.selectors.filter(Boolean);
  if (Array.isArray(step.selector)) return step.selector.filter(Boolean);
  return step.selector ? [step.selector] : [];
}

export function readElementValue(element) {
  if (!element) return "";
  if (isTextControl(element)) return String(element.value || "");
  return String(element.textContent || "");
}

export function activateSubmitButton(element) {
  safeFocus(element);
  dispatchPointerLikeEvent(element, "pointerdown");
  dispatchPointerLikeEvent(element, "mousedown");
  dispatchPointerLikeEvent(element, "pointerup");
  dispatchPointerLikeEvent(element, "mouseup");
  if (typeof element.click === "function") {
    element.click();
  }
}

export function dispatchPointerLikeEvent(element, type) {
  const rect = element.getBoundingClientRect();
  const eventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    button: 0,
    buttons: type.endsWith("down") ? 1 : 0,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
  const EventCtor = type.startsWith("pointer") && typeof PointerEvent === "function"
    ? PointerEvent
    : MouseEvent;
  element.dispatchEvent(new EventCtor(type, eventInit));
}

export function dispatchSubmitKeys(anchor) {
  const targets = [anchor, document.activeElement, document.body, document].filter(Boolean);
  const seen = new Set();
  targets.forEach((target) => {
    if (seen.has(target)) return;
    seen.add(target);
    dispatchKeyboardEvent(target, "keydown", "Enter");
    dispatchKeyboardEvent(target, "keypress", "Enter");
    dispatchKeyboardEvent(target, "keyup", "Enter");
  });
}

export function isSafeToSubmitForm(form) {
  if (!(form instanceof HTMLFormElement)) return false;

  const action = (form.getAttribute("action") || "").trim();
  const currentUrl = (window.location.href || "").split("#")[0];
  const absoluteAction = (() => {
    if (!action) return "";
    try {
      return new URL(action, window.location.href).href.split("#")[0];
    } catch (_error) {
      return "";
    }
  })();

  if (action && absoluteAction && absoluteAction !== currentUrl) return true;

  const submitButton = form.querySelector("button[type='submit'], input[type='submit']");
  if (submitButton && isUsableSubmitButton(submitButton)) return true;

  return false;
}

export function isUsableSubmitButton(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hasAttribute("disabled")
    || element.getAttribute("aria-disabled") === "true"
    || element.getAttribute("data-disabled") === "true") {
    return false;
  }

  if (hasDisabledState(element)) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const style = window.getComputedStyle(element);
  return style.visibility !== "hidden"
    && style.display !== "none"
    && style.pointerEvents !== "none";
}

function hasDisabledState(element) {
  const disabledClassPattern = /(^|\s|[-_])(disabled|is-disabled|btn-disabled|button-disabled|mat-mdc-button-disabled|send-button-container--disabled)(\s|$|[-_])/i;
  let current = element;

  while (current instanceof HTMLElement) {
    const className = typeof current.className === "string" ? current.className : "";
    if (disabledClassPattern.test(className)
      || current.getAttribute("aria-disabled") === "true"
      || current.getAttribute("data-disabled") === "true") {
      return true;
    }

    if (current.tagName === "FORM" || current.getAttribute("role") === "form") {
      return false;
    }
    current = current.parentElement;
  }

  return false;
}

export function looksLikeSubmitControl(element) {
  const label = getControlSignature(element);
  return /发送|提交|send|submit|arrow[-_ ]?up|paper[-_ ]?plane|send-button|btn-send|icon-send/i.test(label);
}

export function looksLikeNonSubmitControl(element) {
  const label = getControlSignature(element);
  return /附件|上传|添加|更多|语音|麦克风|停止|取消|模型|工具|attach|upload|add|plus|more|voice|mic|microphone|stop|cancel|model|tool|file|image|photo|camera/i.test(label);
}

export function getControlSignature(element) {
  const attrs = [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.getAttribute("data-testid"),
    element.getAttribute("data-test-id"),
    element.getAttribute("class"),
    element.textContent,
  ];
  element.querySelectorAll("svg, path, use, mat-icon, i").forEach((child) => {
    attrs.push(
      child.getAttribute("aria-label"),
      child.getAttribute("data-icon"),
      child.getAttribute("class"),
      child.getAttribute("d"),
      child.textContent
    );
  });
  return attrs.filter(Boolean).join(" ");
}

export function findBestSubmitButton(anchor, selectors) {
  const searchRoots = [];
  const nearbyRoot = typeof anchor.closest === "function"
    ? anchor.closest("form, footer, [role='form'], [class*='input'], [class*='composer'], [class*='footer']")
    : null;

  if (nearbyRoot) searchRoots.push(nearbyRoot);
  if (anchor.parentElement) searchRoots.push(anchor.parentElement);
  searchRoots.push(document);

  const seen = new Set();
  const candidates = [];

  searchRoots.forEach((root) => {
    selectors.forEach((selector) => {
      root.querySelectorAll(selector).forEach((element) => {
        if (seen.has(element) || !isUsableSubmitButton(element)) return;
        if (looksLikeNonSubmitControl(element)) return;
        seen.add(element);
        candidates.push(element);
      });
    });
  });

  if (candidates.length === 0) {
    return findHeuristicSubmitButton(anchor);
  }

  const anchorRect = anchor.getBoundingClientRect();
  const sendLike = candidates.filter(looksLikeSubmitControl);
  const pool = sendLike.length > 0 ? sendLike : candidates;
  pool.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    const leftScore = Math.abs(leftRect.right - anchorRect.right) + Math.abs(leftRect.bottom - anchorRect.bottom);
    const rightScore = Math.abs(rightRect.right - anchorRect.right) + Math.abs(rightRect.bottom - anchorRect.bottom);
    return leftScore - rightScore;
  });

  return pool[0];
}

export function findHeuristicSubmitButton(anchor) {
  const root = typeof anchor.closest === "function"
    ? anchor.closest("form, footer, [role='form'], [class*='input'], [class*='composer'], [class*='footer'], [class*='sender'], [class*='chat']")
    : null;
  const searchRoot = root || document;
  const anchorRect = anchor.getBoundingClientRect();
  const candidates = [];

  searchRoot
    .querySelectorAll("button, [role='button'], [tabindex='0']")
    .forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      if (element === anchor || element.contains(anchor) || !isUsableSubmitButton(element)) return;
      if (element.querySelector("textarea, input, [contenteditable='true']")) return;
      if (looksLikeNonSubmitControl(element)) return;

      const rect = element.getBoundingClientRect();
      const isNearComposer =
        rect.top >= anchorRect.top - 80 &&
        rect.bottom <= anchorRect.bottom + 100 &&
        rect.left >= anchorRect.left - 40;
      if (!isNearComposer) return;

      candidates.push(element);
    });

  if (candidates.length === 0) return null;

  const sendLike = candidates.filter(looksLikeSubmitControl);
  const pool = sendLike.length > 0 ? sendLike : candidates;
  pool.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    const leftScore = Math.abs(leftRect.right - anchorRect.right) + Math.abs(leftRect.bottom - anchorRect.bottom);
    const rightScore = Math.abs(rightRect.right - anchorRect.right) + Math.abs(rightRect.bottom - anchorRect.bottom);
    return leftScore - rightScore;
  });

  return pool[0];
}
