(function initQshotOverlay() {
  if (window.__QSHOT_OVERLAY_INSTALLED__) {
    return;
  }
  window.__QSHOT_OVERLAY_INSTALLED__ = true;

  const SEARCH_GROUPS_STORAGE_KEY = "searchGroups";
  const PROMPT_GROUPS_STORAGE_KEY = "promptGroups";
  const UI_PREFS_STORAGE_KEY = "uiPrefs";
  const CUSTOM_SITES_STORAGE_KEY = "customSites";

  const RANDOM_QUESTIONS = [
    "今天最值得关注的 AI 变化是什么？不要泛泛而谈，只说一个最具体的。",
    "普通人现在最该先学会哪 3 个 AI 用法？请按\"上手难度从低到高\"排列，并说明每个的实际应用场景。",
    "大多数人用 AI 最容易犯的低级错误是什么？请列出 3 个典型误区，并给出正确姿势。",
    "如果只保留 3 个 AI 使用习惯，最值得保留哪些？请说明理由。",
    "怎么判断自己是在\"用 AI\"，还是\"被 AI 带着跑\"？给出 3 个自检信号。",
    "AI 能帮我节省时间，但哪些\"自己思考\"的部分绝对不能外包？请从决策、创造力、价值判断三个维度分析。",
    "想快速提升 AI 提问能力，最有效的练习方法是什么？请给出一个可以立刻开始的 7 天训练计划。",
    "有哪些小众但实用的 AI 工具？请推荐 5 个，说明适用场景和同类工具的差异。",
    "用 AI 学习一个全新技能，最高效的路径是什么？请用一个具体例子演示完整流程。",
    "今天如果我想立刻用 AI 提高效率，最近出现或变成熟的 3 个用法是什么？请只讲能马上上手的。",
    "过去 7 天最值得普通人关注的 3 条 AI 动态是什么？按\"发生了什么 / 为什么重要 / 对普通人有什么影响\"回答。控制在 200 字内。",
    "最近 30 天里，主流 AI 工具里有哪些更新是真正能提升工作效率的？请选 3 个，说明适合谁用、解决什么问题。控制在 300 字内。",
    "随机选一个观点，请分别写成：理性版、犀利版、温和版，各 80 字。",
    "给我一个反直觉的观点，然后用 300 字把它写成一篇让人看完第一句就想继续读的短文。",
    "现代社会哪些看似正常的习惯，其实一直在偷走你的能量？请列出 5 个，并说明替代方案。",
    "为什么很多人懂很多道理，却很难真正改变自己？请结合行为心理学中的\"意图-行为鸿沟\"研究解释。",
    "什么样的\"努力\"其实只是自我感动？请列出 5 种常见表现，并说明为什么它们看起来努力、实际上低效。",
    "有哪些常见但极其低效的办公习惯，可以用 AI 或自动化工具彻底替代？请列出 5 个，附具体工具推荐。",
    "\"复盘\"和\"总结\"的关键区别是什么？一个真正有效的个人复盘流程应该包含哪些步骤？请给出可直接套用的模板。",
    "如何将一个复杂的大项目拆解成容易执行的小步骤？请用一个实际案例演示拆解过程。",
    "信息量很大的时候，怎么快速抓住重点？请给出一个可复用的信息筛选框架。",
    "怎么用 AI 把一个模糊的想法变成可执行的步骤？请用一个具体例子，演示从\"我想做 XX\"到\"第一步打开什么\"的完整过程。",
    "想提高产出质量，最该先优化输入、流程还是表达？请按优先级排序并说明理由。"
  ];

  // 根据 Shadow DOM 承载，样式不会污染宿主页面
  const OVERLAY_STYLES = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: "Microsoft YaHei UI", "PingFang SC", -apple-system, sans-serif; }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      background: rgba(0, 0, 0, 0.38);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      overflow-y: auto;
      animation: qshotFadeIn 140ms ease-out;
    }

    .panel {
      width: 440px;
      max-width: calc(100vw - 32px);
      background: #ffffff;
      border-radius: 14px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
      padding: 18px 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      animation: qshotPopIn 180ms cubic-bezier(.2,.9,.3,1.1);
      color: #111;
    }

    @keyframes qshotFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes qshotPopIn {
      from { opacity: 0; transform: translateY(-8px) scale(.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .header {
      display: flex;
      justify-content: center;
      margin-bottom: 2px;
    }
    .title-logo {
      height: 30px;
      width: auto;
      display: block;
    }

    .composer {
      position: relative;
      width: 100%;
      min-height: 56px;
      padding: 10px 14px;
      border: 1px solid rgba(0, 0, 0, 0.22);
      border-radius: 18px;
      background: #ffffff;
      box-shadow: 0 5px 12px rgba(0, 0, 0, 0.07);
      display: flex;
      align-items: center;
      gap: 10px;
      transition: min-height 180ms ease, padding 180ms ease;
    }
    .composer.is-expanded {
      min-height: 118px;
      padding: 12px 14px;
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .query-input {
      width: 100%;
      min-width: 0;
      min-height: 20px;
      height: 20px;
      max-height: 220px;
      resize: none;
      overflow-y: hidden;
      overflow-x: hidden;
      border: none;
      outline: none;
      background: transparent;
      padding: 0 6px 0 0;
      font-size: 14px;
      line-height: 1.4;
      color: #111;
      flex: 1;
    }
    .composer.is-expanded .query-input {
      min-height: 76px;
      height: auto;
      overflow-y: auto;
      padding: 2px 4px 0 0;
    }
    .query-input::placeholder { color: #9a9a9a; }
    .query-input::-webkit-scrollbar { width: 7px; height: 7px; }
    .query-input::-webkit-scrollbar-thumb { background: #9c9c9c; border-radius: 999px; }

    .actions-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
      flex: none;
    }
    .composer.is-expanded .actions-row { margin-top: 8px; }

    .icon-btn {
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      background: transparent;
      color: #111;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex: none;
      transition: transform 180ms ease, color 180ms ease;
    }
    .icon-btn:hover { transform: translateY(-1px); }
    .icon-btn.dice:hover { transform: translateY(-1px) rotate(-14deg) scale(1.08); }
    .icon-btn svg { width: 22px; height: 22px; fill: currentColor; }
    .icon-btn.sparkle svg { width: 20px; height: 20px; }

    .groups {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .groups:empty { display: none; }

    .group-btn {
      min-width: 84px;
      min-height: 32px;
      padding: 0 12px;
      border: 1px solid rgba(0, 0, 0, 0.62);
      border-radius: 999px;
      background: #fff;
      color: #111;
      font-size: 14px;
      line-height: 1.2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 150ms ease, color 150ms ease, border-color 150ms ease, transform 150ms ease;
    }
    .group-btn:hover {
      background: #111;
      color: #fff;
      border-color: #111;
      transform: translateY(-1px);
    }

    /* 提示词 picker */
    .prompt-picker {
      position: absolute;
      top: calc(100% + 8px);
      left: -1px;
      right: -1px;
      min-height: 228px;
      max-height: 320px;
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr);
      grid-template-rows: 1fr auto;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 6px;
      background: #fff;
      box-shadow: 0 18px 34px rgba(0, 0, 0, 0.12);
      overflow: hidden;
      z-index: 6;
    }
    .prompt-picker[hidden] { display: none; }

    .prompt-groups-col {
      padding: 10px;
      border-right: 1px solid rgba(0, 0, 0, 0.08);
      background: #fbfbfb;
      display: flex;
      flex-direction: column;
      gap: 6px;
      overflow-y: auto;
      min-height: 0;
    }
    .prompt-group-item {
      width: 100%;
      min-height: 32px;
      padding: 6px 10px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: #111;
      text-align: left;
      font-size: 12px;
      line-height: 1.4;
      cursor: pointer;
      flex-shrink: 0;
    }
    .prompt-group-item.is-active,
    .prompt-group-item:hover {
      background: #111;
      color: #fff;
    }

    .prompt-list-col {
      padding: 6px 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .prompt-item {
      min-height: 36px;
      padding: 4px 12px;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.4;
      color: #111;
      cursor: pointer;
      border-bottom: 1px solid rgba(0, 0, 0, 0.07);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .prompt-item:last-child { border-bottom: none; }
    .prompt-item:hover { background: #f6f6f6; }
    .prompt-item-label {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding: 4px 0;
    }
    .prompt-item-icons {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .prompt-item:hover .prompt-item-icons { opacity: 1; }
    .prompt-icon-btn {
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: #999;
      border-radius: 4px;
      cursor: pointer;
      padding: 0;
      flex-shrink: 0;
      transition: color 120ms ease, background 120ms ease;
    }
    .prompt-icon-btn:hover { background: #e8e8e8; color: #333; }
    .prompt-empty {
      padding: 14px 12px;
      font-size: 12px;
      color: #888;
    }
    .prompt-picker-footer {
      grid-column: 1 / -1;
      display: flex;
      justify-content: center;
      padding: 6px 0;
      border-top: 1px solid rgba(0, 0, 0, 0.07);
      background: #fbfbfb;
    }
    .prompt-picker-footer-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: none;
      background: transparent;
      font-size: 11px;
      color: #aaa;
      cursor: pointer;
      padding: 3px 8px;
      border-radius: 4px;
      transition: color 140ms ease, background 140ms ease;
    }
    .prompt-picker-footer-btn:hover { color: #555; background: #f0f0f0; }
    /* 预览卡片（由 shared/prompt-item.js 统一提供） */
    ${window.PromptItemUI?.PREVIEW_CSS ?? ""}

    .panel-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .hint-row {
      display: flex;
      justify-content: center;
      color: rgba(255, 255, 255, 0.78);
      font-size: 12px;
      user-select: none;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    }
    .kbd {
      display: inline-block;
      padding: 1px 6px;
      margin: 0 3px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.18);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
    }

    .panel {
      position: relative;
    }
    .settings-corner-btn {
      position: absolute;
      bottom: 10px;
      right: 10px;
      width: 26px;
      height: 26px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: #bbb;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: color 150ms ease, background 150ms ease, transform 150ms ease;
    }
    .settings-corner-btn:hover {
      color: #555;
      background: rgba(0, 0, 0, 0.06);
      transform: rotate(30deg);
    }
    .settings-corner-btn svg {
      width: 14px;
      height: 14px;
      display: block;
      flex-shrink: 0;
    }
  `;

  const LOGO_URL = chrome.runtime.getURL("popup/logo.svg");

  const DICE_SVG = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M817.493333 310.997333L533.333333 146.944a42.666667 42.666667 0 0 0-42.666666 0L206.506667 310.997333a42.666667 42.666667 0 0 0-21.333334 36.949334v328.106666a42.666667 42.666667 0 0 0 21.333334 36.992l284.16 164.053334a42.666667 42.666667 0 0 0 42.666666 0l284.16-164.053334a42.666667 42.666667 0 0 0 21.333334-36.992v-328.106666a42.666667 42.666667 0 0 0-21.333334-36.949334zM554.666667 109.994667l284.16 164.053333a85.333333 85.333333 0 0 1 42.666666 73.898667v328.106666a85.333333 85.333333 0 0 1-42.666666 73.898667L554.666667 914.090667a85.333333 85.333333 0 0 1-85.333334 0l-284.16-164.053334a85.333333 85.333333 0 0 1-42.666666-73.898666V347.904a85.333333 85.333333 0 0 1 42.666666-73.898667L469.333333 109.994667a85.333333 85.333333 0 0 1 85.333334 0z"/><path d="M490.666667 524.501333L160.213333 338.602667l20.906667-37.205334L512 487.552l330.88-186.154667 20.906667 37.205334-330.453334 185.898666V896h-42.666666v-371.498667z"/><path d="M469.333333 298.666667a42.666667 42.666667 0 1 0 85.333334 0 42.666667 42.666667 0 0 0-85.333334 0zM347.861333 633.941333a32.725333 32.725333 0 1 1-32.725333-56.661333 32.725333 32.725333 0 0 1 32.725333 56.661333zM286.72 535.296a32.682667 32.682667 0 1 1-32.682667-56.533333 32.682667 32.682667 0 0 1 32.682667 56.533333zM414.72 727.296a32.682667 32.682667 0 1 1-32.682667-56.533333 32.682667 32.682667 0 0 1 32.682667 56.533333zM712.32 558.890667a32.725333 32.725333 0 1 0 32.682667-56.661334 32.725333 32.725333 0 0 0-32.682667 56.661334zM625.621333 709.034667a32.682667 32.682667 0 1 0 32.682667-56.618667 32.682667 32.682667 0 0 0-32.682667 56.618667z"/></svg>`;

  const SPARKLE_SVG = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M855.071605 339.499431l-10.216418 26.934193c-7.430122 19.718401-31.077915 19.718401-38.508037 0l-10.144975-26.934193c-18.146645-48.010021-50.724873-86.303727-91.447658-107.165224l-31.435132-16.146227c-16.860662-8.716105-16.860662-37.150611 0-45.866717l29.649045-15.217461c41.722994-21.433045 75.015657-61.084178 92.805084-110.737399l10.430749-29.148941c7.287235-20.289949 31.506576-20.289949 38.793811 0l10.430749 29.148941c17.860871 49.653221 51.08209 89.304354 92.876528 110.737399l29.577602 15.217461c16.932105 8.716105 16.932105 37.150611 0 45.866717l-31.363689 16.074783c-40.722785 20.932941-73.372457 59.226647-91.447659 107.236668zM413.265106 95.234163h164.891559v95.305606H413.265106c-136.671383 0-247.480225 127.883835-247.480225 285.773932 0 171.89302 101.592633 284.130732 329.926005 403.87001v-118.096078h82.445779c136.671383 0 247.480225-127.955278 247.480225-285.773932h82.44578c0 210.401057-147.673679 381.008095-329.926005 381.008095v166.677646C371.970773 928.765279 83.339102 785.878313 83.339102 476.313701 83.339102 265.769757 231.012781 95.234163 413.265106 95.234163z"/></svg>`;

  let hostEl = null;
  let shadowRoot = null;
  let isOpen = false;
  let groups = [];
  let promptGroups = [];
  let uiPrefs = normalizeUiPrefs();
  let activePromptGroupId = null;
  let isPromptPickerOpen = false;
  let _overlayPreviewMgr = null;

  const isTopFrame = (function detectTop() {
    try {
      return window.top === window;
    } catch (_e) {
      // 跨域受限时访问 window.top 会抛错，认为不是顶层
      return false;
    }
  })();

  const FRAME_TOGGLE_MESSAGE = "__QSHOT_FRAME_TOGGLE__";
  const MAIN_HOTKEY_FIRE = "__QSHOT_HOTKEY_FIRE__";
  const MAIN_HOTKEY_ESC = "__QSHOT_HOTKEY_ESC__";
  const MAIN_HOTKEY_CONFIG = "__QSHOT_HOTKEY_CONFIG__";

  // 启动时先读一次配置，并同步给 MAIN world 的键盘监听器
  refreshUiPrefs().then(syncShortcutToMainWorld).catch(() => {});

  // 监听消息：
  // 1. 来自 MAIN world 的快捷键触发（主通道）
  // 2. 来自子 frame 的 window.top.postMessage 转发（浮层 UI 只在顶层渲染）
  window.addEventListener("message", (event) => {
    if (event.source !== window && !isTopFrame) return;
    const data = event.data;
    if (!data) return;

    if (data.type === MAIN_HOTKEY_FIRE) {
      if (isTopFrame) {
        toggleOverlay();
      } else {
        // 子 frame 收到 MAIN world 的触发 → 转发到顶层
        try {
          window.top.postMessage({ type: FRAME_TOGGLE_MESSAGE }, "*");
        } catch (_err) {
          /* 忽略跨域错误 */
        }
      }
      return;
    }

    if (data.type === MAIN_HOTKEY_ESC) {
      if (isTopFrame && isOpen) {
        closeOverlay();
      } else if (!isTopFrame) {
        try { window.top.postMessage({ type: MAIN_HOTKEY_ESC }, "*"); } catch (_e) {}
      }
      return;
    }

    if (data.type === FRAME_TOGGLE_MESSAGE && isTopFrame) {
      toggleOverlay();
    }
  });

  // 仍然在 isolated world 挂一份 keydown 监听，作为 MAIN world 失效时的兜底，
  // 以及处理浮层打开后的 Esc 关闭（MAIN world 不处理 Esc）
  window.addEventListener("keydown", handleGlobalKeydown, true);
  document.addEventListener("keydown", handleGlobalKeydown, true);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "TOGGLE_SEARCH_OVERLAY") {
      return false;
    }
    if (!isTopFrame) return false;
    toggleOverlay().finally(() => sendResponse && sendResponse({ ok: true }));
    return true;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[UI_PREFS_STORAGE_KEY]) {
      refreshUiPrefs().then(() => {
        syncShortcutToMainWorld();
        if (isOpen) {
          applyUiPrefs();
          renderPromptPickerIfOpen();
        }
      });
    }
    if (!isOpen) return;
    if (changes[SEARCH_GROUPS_STORAGE_KEY]) {
      refreshGroups().then(renderGroupsIfOpen);
    }
    if (changes[PROMPT_GROUPS_STORAGE_KEY]) {
      refreshPromptGroups().then(renderPromptPickerIfOpen);
    }
  });

  function handleGlobalKeydown(event) {
    // isolated world 的 keydown 只负责一件事：浮层打开时，Esc 关闭它。
    // 快捷键触发浮层的职责完全交给 MAIN world（overlay_main.js），
    // 避免两个 world 都匹配同一按键导致 toggle 两次相消。
    if (!isTopFrame || !isOpen) return;
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeOverlay();
  }

  function matchShortcut(event, sc) {
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

  async function toggleOverlay() {
    if (isOpen) {
      closeOverlay();
    } else {
      await openOverlay();
    }
  }

  async function openOverlay() {
    if (isOpen || !isTopFrame) return;
    await Promise.all([refreshGroups(), refreshPromptGroups(), refreshUiPrefs()]);
    if (!activePromptGroupId) {
      activePromptGroupId = promptGroups[0]?.id || null;
    }
    mountOverlay();
    isOpen = true;
    // 触发预热（复用 popup 中的行为）
    try {
      chrome.runtime.sendMessage({ type: "WARMUP_AI_SITES" }).catch(() => {});
    } catch (_err) {
      /* 忽略 */
    }
  }

  function closeOverlay() {
    if (!isOpen) return;
    isPromptPickerOpen = false;
    if (_overlayPreviewMgr) { _overlayPreviewMgr.destroy(); _overlayPreviewMgr = null; }
    if (hostEl && hostEl.parentNode) {
      hostEl.parentNode.removeChild(hostEl);
    }
    hostEl = null;
    shadowRoot = null;
    isOpen = false;
  }

  function mountOverlay() {
    hostEl = document.createElement("div");
    hostEl.id = "qshot-search-overlay-host";
    hostEl.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483646;";
    shadowRoot = hostEl.attachShadow({ mode: "closed" });

    const styleEl = document.createElement("style");
    styleEl.textContent = OVERLAY_STYLES;
    shadowRoot.appendChild(styleEl);

    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) {
        closeOverlay();
      }
    });

    const panel = document.createElement("div");
    panel.className = "panel";
    panel.addEventListener("mousedown", (event) => {
      // 点击面板内部时，若点击到非 prompt 区域则关闭 picker
      const target = event.target;
      if (target instanceof Element) {
        if (!target.closest(".prompt-picker") && !target.closest(".icon-btn.sparkle")) {
          if (isPromptPickerOpen) {
            isPromptPickerOpen = false;
            renderPromptPickerIfOpen();
          }
        }
      }
    });

    const header = document.createElement("header");
    header.className = "header";
    const logo = document.createElement("img");
    logo.className = "title-logo";
    logo.alt = "Qshot";
    logo.src = LOGO_URL;
    logo.addEventListener("error", () => { logo.style.display = "none"; });
    header.appendChild(logo);
    panel.appendChild(header);

    const composer = document.createElement("section");
    composer.className = "composer";

    const queryInput = document.createElement("textarea");
    queryInput.className = "query-input";
    queryInput.rows = 1;
    queryInput.placeholder = "输入你要搜索的";
    composer.appendChild(queryInput);

    const actionsRow = document.createElement("div");
    actionsRow.className = "actions-row";

    const diceBtn = document.createElement("button");
    diceBtn.type = "button";
    diceBtn.className = "icon-btn dice";
    diceBtn.setAttribute("aria-label", "随机问题");
    diceBtn.innerHTML = DICE_SVG;
    diceBtn.addEventListener("click", () => {
      isPromptPickerOpen = false;
      renderPromptPickerIfOpen();
      fillRandomQuestion();
    });

    const sparkleBtn = document.createElement("button");
    sparkleBtn.type = "button";
    sparkleBtn.className = "icon-btn sparkle";
    sparkleBtn.setAttribute("aria-label", "提示词");
    sparkleBtn.innerHTML = SPARKLE_SVG;
    sparkleBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      isPromptPickerOpen = !isPromptPickerOpen;
      renderPromptPickerIfOpen();
    });

    actionsRow.appendChild(diceBtn);
    actionsRow.appendChild(sparkleBtn);
    composer.appendChild(actionsRow);

    const promptPicker = document.createElement("div");
    promptPicker.className = "prompt-picker";
    promptPicker.hidden = true;
    composer.appendChild(promptPicker);

    panel.appendChild(composer);

    const settingsCornerBtn = document.createElement("button");
    settingsCornerBtn.type = "button";
    settingsCornerBtn.className = "settings-corner-btn";
    settingsCornerBtn.setAttribute("aria-label", "设置");
    settingsCornerBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>`;
    settingsCornerBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE" }).catch(() => {});
      closeOverlay();
    });
    panel.appendChild(settingsCornerBtn);

    const groupsContainer = document.createElement("div");
    groupsContainer.className = "groups";
    panel.appendChild(groupsContainer);

    const panelWrap = document.createElement("div");
    panelWrap.className = "panel-wrap";
    panelWrap.appendChild(panel);

    const hintRow = document.createElement("div");
    hintRow.className = "hint-row";
    hintRow.innerHTML = `<span><span class="kbd">Enter</span> 搜索 · <span class="kbd">Esc</span> 关闭</span>`;
    panelWrap.appendChild(hintRow);

    backdrop.appendChild(panelWrap);
    shadowRoot.appendChild(backdrop);

    document.documentElement.appendChild(hostEl);

    // 绑定行为
    queryInput.addEventListener("keydown", async (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (isPromptPickerOpen) {
          isPromptPickerOpen = false;
          renderPromptPickerIfOpen();
          return;
        }
        closeOverlay();
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        await runDefaultSearch();
      }
    });

    queryInput.addEventListener("input", syncComposerLayout);
    queryInput.addEventListener("mouseup", syncComposerLayout);
    queryInput.addEventListener("keyup", syncComposerLayout);

    // 全局 Esc 兜底（焦点不在输入框时也能关）
    backdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOverlay();
      }
    });

    applyUiPrefs();
    renderGroupsIfOpen();
    renderPromptPickerIfOpen();
    syncComposerLayout();

    // 聚焦输入框
    setTimeout(() => queryInput.focus(), 0);
  }

  function applyUiPrefs() {
    if (!shadowRoot) return;
    const diceBtn = shadowRoot.querySelector(".icon-btn.dice");
    const sparkleBtn = shadowRoot.querySelector(".icon-btn.sparkle");
    const actionsRow = shadowRoot.querySelector(".actions-row");
    if (diceBtn) {
      diceBtn.style.display = uiPrefs.showRandomButton === false ? "none" : "inline-flex";
    }
    if (sparkleBtn) {
      sparkleBtn.style.display = uiPrefs.showPromptButton === false ? "none" : "inline-flex";
    }
    if (actionsRow) {
      const hasVisible = uiPrefs.showRandomButton !== false || uiPrefs.showPromptButton !== false;
      actionsRow.style.display = hasVisible ? "flex" : "none";
    }
  }

  function syncComposerLayout() {
    if (!shadowRoot) return;
    const composer = shadowRoot.querySelector(".composer");
    const queryInput = shadowRoot.querySelector(".query-input");
    if (!composer || !queryInput) return;

    composer.classList.remove("is-expanded");
    queryInput.style.height = "0px";
    const scrollH = queryInput.scrollHeight;
    const lineHeight = parseFloat(getComputedStyle(queryInput).lineHeight || "20");
    queryInput.style.height = "";
    composer.classList.toggle("is-expanded", scrollH > lineHeight * 1.7);
  }

  function renderGroupsIfOpen() {
    if (!shadowRoot) return;
    const container = shadowRoot.querySelector(".groups");
    if (!container) return;
    container.innerHTML = "";

    groups.forEach((group) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "group-btn";
      btn.textContent = group.name || "未命名搜索组";
      btn.addEventListener("click", () => runGroup(group));
      container.appendChild(btn);
    });
  }

  function renderPromptPickerIfOpen() {
    if (!shadowRoot) return;
    const picker = shadowRoot.querySelector(".prompt-picker");
    if (!picker) return;

    picker.innerHTML = "";
    if (!isPromptPickerOpen || uiPrefs.showPromptButton === false) {
      picker.hidden = true;
      return;
    }
    picker.hidden = false;

    if (!promptGroups.length) {
      const empty = document.createElement("div");
      empty.className = "prompt-empty";
      empty.textContent = "还没有提示词分组，请先去设置里添加。";
      picker.appendChild(empty);
      return;
    }

    const activeGroup = promptGroups.find((g) => g.id === activePromptGroupId) || promptGroups[0];
    activePromptGroupId = activeGroup.id;

    const groupsCol = document.createElement("div");
    groupsCol.className = "prompt-groups-col";
    promptGroups.forEach((group) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `prompt-group-item${group.id === activeGroup.id ? " is-active" : ""}`;
      btn.textContent = group.name || "未命名分组";
      btn.addEventListener("mouseenter", () => {
        if (activePromptGroupId === group.id) return;
        activePromptGroupId = group.id;
        renderPromptPickerIfOpen();
      });
      btn.addEventListener("click", () => {
        activePromptGroupId = group.id;
        renderPromptPickerIfOpen();
      });
      groupsCol.appendChild(btn);
    });

    const listCol = document.createElement("div");
    listCol.className = "prompt-list-col";
    if (!activeGroup.prompts.length) {
      const empty = document.createElement("div");
      empty.className = "prompt-empty";
      empty.textContent = "这个分组里还没有提示词。";
      listCol.appendChild(empty);
    } else {
      activeGroup.prompts.forEach((prompt) => {
        const item = document.createElement("div");
        item.className = "prompt-item";

        const label = document.createElement("span");
        label.className = "prompt-item-label";
        label.textContent = prompt.title || "未命名提示词";
        label.addEventListener("click", () => {
          const queryInput = shadowRoot.querySelector(".query-input");
          if (queryInput instanceof HTMLTextAreaElement) {
            queryInput.value = prompt.content || "";
            syncComposerLayout();
            queryInput.focus();
          }
          isPromptPickerOpen = false;
          hideOvPreview();
          renderPromptPickerIfOpen();
        });

        const icons = document.createElement("div");
        icons.className = "prompt-item-icons";

        if (!_overlayPreviewMgr) {
          _overlayPreviewMgr = window.PromptItemUI.createPreviewManager(shadowRoot);
        }
        const overlayItem = window.PromptItemUI.createItem(prompt, {
          itemClass: "prompt-item",
          labelClass: "prompt-item-label",
          iconsClass: "prompt-item-icons",
          iconBtnClass: "prompt-icon-btn",
          onFill: (p) => {
            const queryInput = shadowRoot.querySelector(".query-input");
            if (queryInput instanceof HTMLTextAreaElement) {
              queryInput.value = p.content || "";
              syncComposerLayout();
              queryInput.focus();
            }
            isPromptPickerOpen = false;
            if (_overlayPreviewMgr) _overlayPreviewMgr.hide();
            renderPromptPickerIfOpen();
          },
          onEdit: () => {
            chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE", section: "prompts" }).catch(() => {});
            closeOverlay();
          },
          previewManager: _overlayPreviewMgr,
        });
        listCol.appendChild(overlayItem);
      });
    }

    const footer = document.createElement("div");
    footer.className = "prompt-picker-footer";
    const footerBtn = document.createElement("button");
    footerBtn.type = "button";
    footerBtn.className = "prompt-picker-footer-btn";
    footerBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>管理提示词`;
    footerBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE", section: "prompts" }).catch(() => {});
      closeOverlay();
    });
    footer.appendChild(footerBtn);

    picker.appendChild(groupsCol);
    picker.appendChild(listCol);
    picker.appendChild(footer);
  }

  function fillRandomQuestion() {
    if (!RANDOM_QUESTIONS.length || !shadowRoot) return;
    const queryInput = shadowRoot.querySelector(".query-input");
    if (!(queryInput instanceof HTMLTextAreaElement)) return;
    const idx = Math.floor(Math.random() * RANDOM_QUESTIONS.length);
    queryInput.value = RANDOM_QUESTIONS[idx];
    syncComposerLayout();
    queryInput.focus();
  }

  async function runDefaultSearch() {
    if (!groups.length) return;
    await runGroup(groups[0]);
  }

  async function runGroup(group) {
    if (!shadowRoot) return;
    const queryInput = shadowRoot.querySelector(".query-input");
    const query = queryInput instanceof HTMLTextAreaElement ? queryInput.value.trim() : "";
    try {
      await chrome.runtime.sendMessage({
        type: "RUN_SEARCH_GROUP",
        group,
        query
      });
    } catch (_err) {
      /* 忽略 */
    }
    closeOverlay();
  }

  async function refreshGroups() {
    try {
      const stored = await chrome.storage.local.get([SEARCH_GROUPS_STORAGE_KEY]);
      groups = Array.isArray(stored[SEARCH_GROUPS_STORAGE_KEY]) ? stored[SEARCH_GROUPS_STORAGE_KEY] : [];
    } catch (_err) {
      groups = [];
    }
  }

  async function refreshPromptGroups() {
    try {
      const stored = await chrome.storage.local.get([PROMPT_GROUPS_STORAGE_KEY]);
      const source = Array.isArray(stored[PROMPT_GROUPS_STORAGE_KEY]) ? stored[PROMPT_GROUPS_STORAGE_KEY] : [];
      promptGroups = source.map((group, gi) => ({
        id: String(group.id || `prompt-group-${gi}`),
        name: String(group.name || "未命名分组"),
        prompts: Array.isArray(group.prompts)
          ? group.prompts.map((p, pi) => ({
              id: String(p.id || `prompt-${gi}-${pi}`),
              title: String(p.title || "未命名提示词"),
              content: String(p.content || "")
            }))
          : []
      }));
      if (!promptGroups.some((g) => g.id === activePromptGroupId)) {
        activePromptGroupId = promptGroups[0]?.id || null;
      }
    } catch (_err) {
      promptGroups = [];
    }
  }

  async function refreshUiPrefs() {
    try {
      const stored = await chrome.storage.local.get([UI_PREFS_STORAGE_KEY]);
      uiPrefs = normalizeUiPrefs(stored[UI_PREFS_STORAGE_KEY]);
    } catch (_err) {
      uiPrefs = normalizeUiPrefs();
    }
  }

  function normalizeUiPrefs(input) {
    const src = input && typeof input === "object" ? input : {};
    return {
      showHistory: src.showHistory !== false,
      showRandomButton: src.showRandomButton !== false,
      showPromptButton: src.showPromptButton !== false,
      prewarmEnabled: src.prewarmEnabled !== false,
      overlayShortcutEnabled: src.overlayShortcutEnabled !== false,
      overlayShortcut: normalizeShortcut(src.overlayShortcut)
    };
  }

  function syncShortcutToMainWorld() {
    try {
      window.postMessage(
        {
          type: MAIN_HOTKEY_CONFIG,
          enabled: uiPrefs.overlayShortcutEnabled !== false,
          shortcut: uiPrefs.overlayShortcut
        },
        "*"
      );
    } catch (_err) {
      /* 忽略 */
    }
  }

  function normalizeShortcut(input) {
    const fallback = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, key: "Q" };
    if (!input || typeof input !== "object") return fallback;
    const key = typeof input.key === "string" && input.key.length > 0 ? input.key : fallback.key;
    return {
      ctrlKey: !!input.ctrlKey,
      shiftKey: !!input.shiftKey,
      altKey: !!input.altKey,
      metaKey: !!input.metaKey,
      key: key.length === 1 ? key.toUpperCase() : key
    };
  }

})();
