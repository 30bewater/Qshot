(function initQshotMainHotkey() {
  if (window.__QSHOT_MAIN_HOTKEY_INSTALLED__) {
    return;
  }
  window.__QSHOT_MAIN_HOTKEY_INSTALLED__ = true;

  // 审核说明：
  // - 本脚本仅用于在页面主世界（MAIN world）捕获用户显式设置的快捷键（默认 Ctrl+Q）与 Esc。
  // - 不会记录或上传用户的键盘输入；只在匹配到该快捷键时发出一个“触发/关闭”信号给扩展的 isolated world。
  // - 采用 postMessage 仅用于同页不同 world 间通信，不与开发者服务器通信。

  // 与 isolated world 通信使用的 message 常量
  const MSG_CONFIG = "__QSHOT_HOTKEY_CONFIG__";
  const MSG_FIRE = "__QSHOT_HOTKEY_FIRE__";
  const MSG_ESC = "__QSHOT_HOTKEY_ESC__";

  // 本地配置缓存；isolated world 会在启动和配置变更时通过 postMessage 同步过来
  let shortcut = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, key: "Q" };
  let enabled = true;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.type !== MSG_CONFIG) return;
    if (data.shortcut && typeof data.shortcut === "object") {
      shortcut = normalizeShortcut(data.shortcut);
    }
    if (typeof data.enabled === "boolean") {
      enabled = data.enabled;
    }
  });

  // 在 capture 阶段抢先监听，拦截网站自己的 keydown 处理
  window.addEventListener("keydown", handleKeydown, true);
  document.addEventListener("keydown", handleKeydown, true);

  function handleKeydown(event) {
    // Esc：通知 isolated world 关闭浮层（如果已打开）
    if (event.key === "Escape") {
      try { window.postMessage({ type: MSG_ESC }, window.location.origin); } catch (_e) {}
      return;
    }

    if (!enabled) return;
    if (!matchShortcut(event, shortcut)) return;

    // 阻止传播，让网站自己的 listener 收不到
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }

    // 通知 isolated world 去切换 overlay
    try {
      window.postMessage({ type: MSG_FIRE }, window.location.origin);
    } catch (_err) {
      /* 忽略 */
    }
  }

  function matchShortcut(event, sc) {
    if (!sc || !sc.key) return false;
    if ((!!sc.ctrlKey) !== event.ctrlKey) return false;
    if ((!!sc.shiftKey) !== event.shiftKey) return false;
    if ((!!sc.altKey) !== event.altKey) return false;
    if ((!!sc.metaKey) !== event.metaKey) return false;
    return normalizeKey(event.key) === normalizeKey(sc.key);
  }

  function normalizeKey(key) {
    if (!key) return "";
    if (key.length === 1) return key.toUpperCase();
    return key;
  }

  function normalizeShortcut(input) {
    const key = typeof input.key === "string" && input.key.length > 0 ? input.key : "Q";
    return {
      ctrlKey: !!input.ctrlKey,
      shiftKey: !!input.shiftKey,
      altKey: !!input.altKey,
      metaKey: !!input.metaKey,
      key: key.length === 1 ? key.toUpperCase() : key
    };
  }
})();
