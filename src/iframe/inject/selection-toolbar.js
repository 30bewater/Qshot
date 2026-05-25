import {
  SEARCH_GROUPS_STORAGE_KEY,
  UI_PREFS_STORAGE_KEY,
  SELECTION_CONTEXT_GROUPS_STORAGE_KEY,
} from "../../shared/storage-keys.js";

let host = null;
let shadow = null;
let toolbar = null;
let isVisible = false;
let cachedUiPrefs = {};
let cachedGroups = [];
let cachedCtxGroups = [];
let cacheInitPromise = null;
let storageWatcherInstalled = false;

// Q 图标 SVG 路径（取自 about-logo.svg 的 Q 字形部分）
const Q_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 113 133" fill="currentColor" width="14" height="14" aria-hidden="true">
  <path d="M56.0371 6.96199C74.4324 6.96199 88.0516 12.8731 96.8946 24.6953C103.799 33.9166 107.251 45.7151 107.251 60.0909C107.251 75.6489 103.302 88.5823 95.405 98.8913C86.1364 110.997 72.9192 117.05 55.7534 117.05C39.7225 117.05 27.1201 111.754 17.9461 101.161C9.76512 90.9468 5.67465 78.0369 5.67465 62.4317C5.67465 48.3396 9.17401 36.281 16.1727 26.2558C25.1576 13.3933 38.4457 6.96199 56.0371 6.96199ZM57.4558 104.424C69.8927 104.424 78.8776 99.9789 84.4104 91.0886C89.9904 82.151 92.7805 71.8894 92.7805 60.3037C92.7805 48.0559 89.5648 38.1962 83.1336 30.7246C76.7496 23.253 68.0012 19.5171 56.8883 19.5171C46.1065 19.5171 37.3108 23.2293 30.5012 30.6536C23.6916 38.0307 20.2869 48.9307 20.2869 63.3538C20.2869 74.8922 23.1951 84.6337 29.0116 92.5782C34.8754 100.475 44.3568 104.424 57.4558 104.424Z"/>
  <path d="M85.6722 120.993L99.8913 108.913L103.658 113.929C103.793 114.103 103.894 114.304 103.954 114.52C104.015 114.737 104.034 114.965 104.01 115.19C103.962 115.621 103.751 116.034 103.387 116.343L91.7391 126.299C91.574 126.446 91.383 126.556 91.1774 126.623C90.9719 126.691 90.7562 126.713 90.5435 126.689C90.3307 126.665 90.1253 126.596 89.9397 126.485C89.7542 126.374 89.5923 126.224 89.464 126.044L85.6722 120.993Z"/>
  <path d="M70.1657 86.8584C70.2721 85.91 71.0905 85.216 71.9842 85.3163C79.1344 86.1186 85.5494 89.8069 90.0587 95.8135L97.9945 106.387L83.7734 118.466L75.7928 107.833C71.2738 101.913 69.3143 94.4462 70.1657 86.8584Z"/>
</svg>`;

const CSS = `
  .toolbar {
    position: fixed;
    z-index: 2147483647;
    display: none;
    flex-direction: row;
    align-items: stretch;
    padding: 3px 4px;
    background: #fff;
    border: 1px solid #e2e2e2;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.12);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 12px;
    line-height: 1;
    user-select: none;
    pointer-events: auto;
    max-width: 520px;
    color: #111;
  }
  .toolbar.visible { display: flex; }
  .q-col {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 2px 6px 2px 2px;
    color: #bbb;
  }
  .rows-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .toolbar-row {
    display: flex;
    align-items: center;
    gap: 2px;
    white-space: nowrap;
  }
  .h-divider {
    height: 1px;
    background: #e2e2e2;
    margin: 1px 0;
  }
  .btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 12px;
    color: #333;
    white-space: nowrap;
    transition: background 0.12s, color 0.12s;
  }
  .btn:hover { background: #f0f0f0; color: #111; }
  @media (prefers-color-scheme: dark) {
    .toolbar {
      background: #1e1e1e;
      border-color: #3a3a3a;
      color: #eee;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    }
    .q-col { color: #555; }
    .h-divider { background: #3a3a3a; }
    .btn { color: #ccc; }
    .btn:hover { background: #2e2e2e; color: #fff; }
  }
`;

export function initSelectionToolbar() {
  // 跳过扩展自身页面（chrome-extension:// 不会被 <all_urls> 匹配，防御性检查）
  if (location.protocol === "chrome-extension:") return;

  // 跳过 compare 页的卡片 iframe：顶层是扩展页（chrome-extension://），
  // 访问跨域 window.top.location 会抛错，以此判断当前处于嵌入卡片内
  if (window !== window.top) {
    try {
      // 同源时可正常访问；跨域（含扩展页）时抛 DOMException
      void window.top.location.href;
    } catch (_) {
      return;
    }
  }

  primeToolbarCache().catch(() => {});
  installStorageWatcher();

  // 修复1：capture:true —— 在 stopPropagation 生效之前拦截事件
  // 这样 AI 页面、富文本编辑器等拦截了 mouseup 的场景也能触发气泡
  document.addEventListener("mouseup", onMouseUp, true);
  document.addEventListener("mousedown", onMouseDown);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("keydown", onKeyDown);

  // 修复2：selectionchange —— 选区消失时自动隐藏气泡
  // 比 mousedown 更可靠，覆盖点击跳转、键盘清除选区等场景
  document.addEventListener("selectionchange", onSelectionChange);
}

async function onMouseUp(e) {
  // 点在工具栏宿主上（Shadow DOM 内点击冒泡到 host），不触发
  if (host && e.composedPath().includes(host)) return;

  // 让浏览器完成选区更新（capture 阶段选区可能还没稳定）
  await new Promise((r) => setTimeout(r, 20));

  const selection = window.getSelection();
  const text = (selection?.toString() || "").trim();
  if (!text || !selection.rangeCount) return;

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  await primeToolbarCache();
  if (cachedUiPrefs.selectionSearchEnabled !== true) return;

  const showGroups = cachedUiPrefs.bubbleShowGroups !== false;
  const showCtx = cachedUiPrefs.bubbleShowCtx === true;
  const showSites = cachedUiPrefs.bubbleShowGlobalSites === true;

  const itemGroups = [];
  if (showGroups && cachedGroups.length) {
    itemGroups.push({ items: cachedGroups.slice(0, 5), type: "group" });
  }
  if (showCtx && cachedCtxGroups.length) {
    itemGroups.push({ items: cachedCtxGroups.slice(0, 5), type: "ctx" });
  }
  if (showSites) {
    try {
      const { sites } = await chrome.runtime.sendMessage({ type: "GET_QUICK_ACCESS_SITES" });
      if (Array.isArray(sites) && sites.length) {
        itemGroups.push({ items: sites.slice(0, 5), type: "site" });
      }
    } catch (_) {}
  }
  if (!itemGroups.length) return;

  renderToolbar(text, itemGroups, rect);
}

function onMouseDown(e) {
  if (!isVisible) return;
  if (host && e.composedPath().includes(host)) return;
  hideToolbar();
}

function onScroll() {
  if (isVisible) hideToolbar();
}

function onKeyDown(e) {
  if (isVisible && e.key !== "Shift" && e.key !== "Control" && e.key !== "Alt") {
    hideToolbar();
  }
}

function onSelectionChange() {
  if (!isVisible) return;
  const sel = window.getSelection();
  if (!sel || !sel.toString().trim()) hideToolbar();
}

function ensureHost() {
  if (host) return;
  const body = document.body || document.documentElement;
  if (!body) return;
  host = document.createElement("div");
  shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS;
  shadow.appendChild(style);
  toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  shadow.appendChild(toolbar);
  body.appendChild(host);
}

function renderToolbar(query, itemGroups, selectionRect) {
  ensureHost();
  toolbar.innerHTML = "";

  // Q 图标固定在左侧，垂直居中
  const qCol = document.createElement("div");
  qCol.className = "q-col";
  qCol.innerHTML = Q_SVG;
  toolbar.appendChild(qCol);

  // 右侧：所有按钮行纵向堆叠，行间用横线隔开
  const rowsCol = document.createElement("div");
  rowsCol.className = "rows-col";

  itemGroups.forEach((group, gIdx) => {
    if (gIdx > 0) {
      const hd = document.createElement("div");
      hd.className = "h-divider";
      rowsCol.appendChild(hd);
    }

    const row = document.createElement("div");
    row.className = "toolbar-row";

    group.items.forEach((item) => {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = item.name;
      btn.addEventListener("mousedown", (e) => e.stopPropagation());
      btn.addEventListener("click", () => {
        hideToolbar();
        if (group.type === "ctx") {
          chrome.runtime.sendMessage({ type: "RUN_CTX_GROUP", ctxGroup: item, query }).catch(() => {});
        } else if (group.type === "site") {
          chrome.runtime.sendMessage({ type: "OPEN_SITE_TAB_AND_SEND", site: item, query }).catch(() => {});
        } else {
          chrome.runtime.sendMessage({ type: "RUN_SEARCH_GROUP", group: item, query }).catch(() => {});
        }
      });
      row.appendChild(btn);
    });

    rowsCol.appendChild(row);
  });

  toolbar.appendChild(rowsCol);

  toolbar.classList.add("visible");
  isVisible = true;

  // 定位：选区下方居中，防止溢出视口
  requestAnimationFrame(() => {
    const tw = toolbar.offsetWidth;
    const th = toolbar.offsetHeight;
    let left = selectionRect.left + selectionRect.width / 2 - tw / 2;
    let top = selectionRect.bottom + 8;

    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    if (top + th > window.innerHeight - 8) {
      top = selectionRect.top - th - 8;
    }

    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
  });
}

function hideToolbar() {
  if (!toolbar) return;
  toolbar.classList.remove("visible");
  isVisible = false;
}


function installStorageWatcher() {
  if (storageWatcherInstalled) {
    return;
  }
  storageWatcherInstalled = true;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[UI_PREFS_STORAGE_KEY]) {
      cachedUiPrefs = changes[UI_PREFS_STORAGE_KEY].newValue || {};
    }
    if (changes[SEARCH_GROUPS_STORAGE_KEY]) {
      cachedGroups = normalizeGroups(changes[SEARCH_GROUPS_STORAGE_KEY].newValue);
    }
    if (changes[SELECTION_CONTEXT_GROUPS_STORAGE_KEY]) {
      cachedCtxGroups = normalizeCtxGroups(changes[SELECTION_CONTEXT_GROUPS_STORAGE_KEY].newValue);
    }
  });
}

async function primeToolbarCache() {
  if (cacheInitPromise) {
    return cacheInitPromise;
  }

  cacheInitPromise = chrome.storage.local
    .get([UI_PREFS_STORAGE_KEY, SEARCH_GROUPS_STORAGE_KEY, SELECTION_CONTEXT_GROUPS_STORAGE_KEY])
    .then((stored) => {
      cachedUiPrefs = stored[UI_PREFS_STORAGE_KEY] || {};
      cachedGroups = normalizeGroups(stored[SEARCH_GROUPS_STORAGE_KEY]);
      cachedCtxGroups = normalizeCtxGroups(stored[SELECTION_CONTEXT_GROUPS_STORAGE_KEY]);
    })
    .catch(() => {
      cachedUiPrefs = {};
      cachedGroups = [];
      cachedCtxGroups = [];
    });

  return cacheInitPromise;
}

function normalizeGroups(input) {
  return Array.isArray(input)
    ? input.filter((group) => group && group.enabled !== false)
    : [];
}

function normalizeCtxGroups(input) {
  if (!Array.isArray(input)) return [];
  return input.filter((g) => {
    if (!g || g.enabled === false) return false;
    if (g.targetType === "group") return !!g.refGroupId;
    return Array.isArray(g.siteIds) && g.siteIds.length > 0;
  });
}
