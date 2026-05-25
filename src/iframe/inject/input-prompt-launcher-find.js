function collectElements(selector, root = document) {
  const results = [];
  if (!(root instanceof Document || root instanceof ShadowRoot || root instanceof Element)) {
    return results;
  }
  try {
    root.querySelectorAll(selector).forEach((el) => results.push(el));
  } catch (_e) {
    return results;
  }
  root.querySelectorAll("*").forEach((el) => {
    if (el.shadowRoot) {
      collectElements(selector, el.shadowRoot).forEach((node) => results.push(node));
    }
  });
  return results;
}

function isComposerInput(el) {
  if (!(el instanceof Element)) return false;
  if (el.closest("[data-qshot='input-prompt-launcher']")) return false;

  const tag = el.tagName;
  const editable =
    tag === "TEXTAREA" ||
    (tag === "INPUT" && /^(text|search|email|url)$/i.test(el.type || "text")) ||
    el.isContentEditable ||
    el.getAttribute("contenteditable") === "plaintext-only" ||
    el.getAttribute("role") === "textbox";

  if (!editable) return false;

  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;

  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") {
    return false;
  }

  return rect.width >= 96 && rect.height >= 20;
}

function scoreComposerInput(el) {
  const rect = el.getBoundingClientRect();
  const viewportH = window.innerHeight || 1;
  const bottomBias = rect.bottom / viewportH;
  const widthBias = Math.min(rect.width, 960) / 960;
  const areaBias = Math.min(rect.width * rect.height, 180000) / 180000;
  return bottomBias * 3 + widthBias * 1.4 + areaBias * 0.6;
}

export function findLauncherInput(selectors) {
  if (!Array.isArray(selectors) || !selectors.length) return null;

  let best = null;
  let bestScore = -1;

  selectors.forEach((selector) => {
    const key = String(selector || "").trim();
    if (!key) return;
    collectElements(key).forEach((el) => {
      if (!isComposerInput(el)) return;
      const score = scoreComposerInput(el);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });
  });

  return best;
}
