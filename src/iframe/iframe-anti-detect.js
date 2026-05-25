// 在页面自身 JS 执行前运行，让被嵌入的 AI 站点认为自己不在 iframe 里，
// 并通过通用 MutationObserver 监控根元素被隐藏的行为，用 inline style 强制修复。
(function () {
  if (window.parent === window) return;

  try {
    Object.defineProperty(window, "parent", {
      get: function () { return window; },
      configurable: true,
    });
  } catch (_e) {}

  try {
    Object.defineProperty(Window.prototype, "top", {
      get: function () { return this; },
      configurable: true,
    });
  } catch (_e) {}

  try {
    Object.defineProperty(document, "frameElement", {
      get: function () { return null; },
      configurable: true,
    });
  } catch (_e) {}

  const ROOT_SELECTORS = ["#app", ".app", "#root", "#__next", "#ice-container"];

  function forceReveal(el) {
    const cs = getComputedStyle(el);

    if (cs.display === "none") {
      el.style.setProperty("display", "block", "important");
      el.style.setProperty("visibility", "visible", "important");
    }

    if (parseFloat(cs.maxWidth) === 0 || parseFloat(cs.width) === 0) {
      el.style.setProperty("max-width", "100%", "important");
      el.style.setProperty("width", "100%", "important");
      el.style.setProperty("flex-basis", "auto", "important");
      el.style.setProperty("overflow", "auto", "important");
    }
  }

  function attachWatch(el) {
    forceReveal(el);
    const obs = new MutationObserver(() => forceReveal(el));
    obs.observe(el, { attributes: true, attributeFilter: ["class", "style"] });
  }

  const attached = new Set();

  function tryAttachAll() {
    for (const sel of ROOT_SELECTORS) {
      if (attached.has(sel)) continue;
      const el = document.querySelector(sel);
      if (el) {
        attached.add(sel);
        attachWatch(el);
      }
    }
  }

  function startWatching() {
    tryAttachAll();

    const bodyObs = new MutationObserver(() => {
      tryAttachAll();
      if (attached.size >= ROOT_SELECTORS.length) bodyObs.disconnect();
    });
    bodyObs.observe(document.documentElement, { childList: true, subtree: true });

    [300, 800, 1500, 3000].forEach((t) => setTimeout(tryAttachAll, t));
  }

  if (document.body) {
    startWatching();
  } else {
    document.addEventListener("DOMContentLoaded", startWatching, { once: true });
  }

  // 千问嵌入时：去掉加载骨架；勿把 ty-background 模糊层拉满宽（会整屏毛玻璃）。
  if (/qianwen\.com/.test(location.hostname)) {
    function dismissQianwenEmbedBlockers() {
      var ice = document.getElementById("ice-container");
      var sk = document.getElementById("skeleton");
      if (sk && ice && ice.children.length > 0) {
        sk.remove();
      }
      document.querySelectorAll("[class*='ty-background']").forEach(function (el) {
        var cs = getComputedStyle(el);
        var filterText = (cs.filter || "") + (cs.backdropFilter || "") + (cs.webkitBackdropFilter || "");
        if (filterText.indexOf("blur") !== -1) {
          el.style.setProperty("display", "none", "important");
        }
      });
    }
    dismissQianwenEmbedBlockers();
    var qianwenObs = new MutationObserver(dismissQianwenEmbedBlockers);
    qianwenObs.observe(document.documentElement, { childList: true, subtree: true });
    [300, 800, 1500, 3000, 6000].forEach(function (t) {
      setTimeout(dismissQianwenEmbedBlockers, t);
    });
  }

  // 千问 / Qwen 在 iframe 内会反复 window.open 跳出；拦截弹窗但不影响页面渲染（不用 sandbox）。
  if (/qianwen\.com|qwen\.ai/i.test(location.hostname)) {
    try {
      var nativeOpen = window.open;
      window.open = function () {
        return null;
      };
      if (window.Window && Window.prototype.open) {
        Window.prototype.open = window.open;
      }
    } catch (_e) {}
  }
})();
