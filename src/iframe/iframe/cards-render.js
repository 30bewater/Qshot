import { state, elements, BASE_CONFIG } from "./state.js";
import { getSelectedSites, isWideMediaSite, isSocialMediaCardSite, buildSiteUrl, escapeHtml, ensureCardsNotEmpty } from "./utils.js";
import { setSiteStatus, setGlobalStatus } from "./status.js";
import {
  clearIframeTimers,
  removeFromLoadQueue,
  enqueueLoad,
  beginIframeLoad,
  releaseLoadSlot,
} from "./load-queue.js";
import {
  activateScrollGuard,
  getScrollGuardDurationMs,
  renderSiteNav,
  renderCardNavStrip,
  updateScrollEdgeBtns,
} from "./layout.js";
import { abortPendingWorkForSite, flushPendingQueryAfterLoad, settlePendingQuery } from "./send.js";
import { dispatchPendingFilesForCard } from "./file-upload.js";
import {
  applyHistoryRestoreNavigation,
  resolveHistoryRestoreLoadTarget,
  urlsNeedIframeReload,
} from "./iframe-url-sync.js";

function msg(key, fallback) {
  return window.__QSHOT_I18N__?.t?.(key) || fallback || "";
}

export function renderCards() {
  elements.iframesContainer.innerHTML = "";
  elements.iframesContainer.dataset.columns = "1";
  elements.iframesContainer.dataset.layoutRows = state.layoutMode === "sidebar" ? "sidebar" : String(state.layoutRows);
  state.cardRefs.clear();

  const selectedSites = getSelectedSites();
  // 外链模式站点（supportIframe===false）不渲染卡片，发送时直接后台新开标签页
  const cardSites = selectedSites.filter((s) => s.supportIframe !== false);

  if (selectedSites.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "请先选择至少一个站点。";
    elements.iframesContainer.appendChild(emptyState);
    return;
  }

  if (cardSites.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "本组所有站点均为新标签页模式，发送后将在新标签页打开。";
    elements.iframesContainer.appendChild(emptyState);
  }

  // 多卡片场景下使用并发槽位系统（见 pumpLoadQueue）：
  // 所有卡片先把 DOM 建出来插入容器并入队，由槽位系统按
  // BASE_CONFIG.iframeMaxConcurrent 限流，避免 6~8 个重型 SPA 同时冷启动打满 CPU。
  cardSites.forEach((site) => {
    const card = createSiteCard(site);
    if (isWideMediaSite(site.id)) {
      card.classList.add("iframe-card-wide-media");
    }
    if (isSocialMediaCardSite(site.id)) {
      card.classList.add("iframe-card-social-media");
    }
    elements.iframesContainer.appendChild(card);
  });

  if (state.layoutMode === "sidebar") {
    if (!state.activeSidebarSiteId || !state.cardRefs.has(state.activeSidebarSiteId)) {
      state.activeSidebarSiteId = cardSites[0]?.id || null;
    }
    state.cardRefs.forEach((ref, siteId) => {
      if (ref.cardEl) ref.cardEl.hidden = siteId !== state.activeSidebarSiteId;
    });
    renderSiteNav();
  }

  elements.iframesContainer.scrollLeft = 0;
  elements.iframesContainer.scrollTop = 0;
  activateScrollGuard(0, 0, getScrollGuardDurationMs(cardSites.length));
  renderCardNavStrip();
}

export function createSiteCard(site) {
  const card = document.createElement("article");
  card.className = "iframe-card";
  card.dataset.siteId = site.id;
  card.tabIndex = 0;
  card.addEventListener("mouseenter", () => {
    card.classList.add("is-actions-visible");
  });
  card.addEventListener("mouseleave", () => {
    card.classList.remove("is-actions-visible");
  });
  card.addEventListener("focusin", () => {
    card.classList.add("is-actions-visible");
  });
  card.addEventListener("focusout", () => {
    card.classList.remove("is-actions-visible");
  });

  const title = document.createElement("h3");
  title.className = "site-title";
  title.textContent = site.name;

  const body = document.createElement("div");
  body.className = "iframe-card-body";

  const status = document.createElement("div");
  status.className = "site-status visually-hidden";
  status.textContent = site.supportIframe
    ? "等待 iframe 加载"
    : "该站点默认使用新标签页模式";

  const iconJump =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
  const iconRefresh =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
  const iconClose =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  const jumpBtn = document.createElement("button");
  jumpBtn.type = "button";
  jumpBtn.className = "card-hover-btn card-hover-btn-icon";
  jumpBtn.innerHTML = iconJump;
  jumpBtn.setAttribute("data-tooltip", msg("iframe_cardJump", "跳往原网站"));
  jumpBtn.setAttribute("aria-label", msg("iframe_cardJump", "跳往原网站"));
  jumpBtn.addEventListener("click", () => {
    const ref = state.cardRefs.get(site.id);
    const targetUrl = ref?.currentUrl || site.url;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  });

  const refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.className = "card-hover-btn card-hover-btn-icon";
  refreshBtn.innerHTML = iconRefresh;
  refreshBtn.setAttribute("data-tooltip", msg("iframe_cardRefresh", "刷新当前卡片"));
  refreshBtn.setAttribute("aria-label", msg("iframe_cardRefresh", "刷新当前卡片"));
  refreshBtn.addEventListener("click", () => {
    const ref = state.cardRefs.get(site.id);
    if (ref) {
      refreshSiteCard(ref);
    }
  });

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "card-hover-btn card-hover-btn-icon";
  closeBtn.innerHTML = iconClose;
  closeBtn.setAttribute("data-tooltip", msg("iframe_cardClose", "关闭这张卡片"));
  closeBtn.setAttribute("aria-label", msg("iframe_cardClose", "关闭这张卡片"));
  closeBtn.addEventListener("click", () => {
    state.hiddenSiteIds.add(site.id);
    // 先把本卡片尚未完成的派发全部清理掉：
    // 1) state.pendingDispatches 里挂着的 setTimeout（默认最多 3 次 × 12s 重试 ≈ 36s）
    // 2) sendSmartToSite 在"iframe 未加载完"时挂起的 pendingQueryResolver
    // 如果不清，Promise.all 会一直 hang，handleSendSelected 的 isSending 解不开，UI 卡死。
    abortPendingWorkForSite(site.id);
    const ref = state.cardRefs.get(site.id);
    if (ref?.cardEl) {
      ref.cardEl.remove();
    }
    state.cardRefs.delete(site.id);
    if (state.maximizedSiteId === site.id) {
      state.maximizedSiteId = null;
    }
    if (state.layoutMode === "sidebar" && state.activeSidebarSiteId === site.id) {
      const nextSite = getSelectedSites().find((s) => s.id !== site.id && state.cardRefs.has(s.id));
      state.activeSidebarSiteId = nextSite?.id || null;
      if (state.activeSidebarSiteId) {
        state.cardRefs.forEach((r, id) => {
          if (r.cardEl) r.cardEl.hidden = id !== state.activeSidebarSiteId;
        });
      }
      renderSiteNav();
    }
    ensureCardsNotEmpty();
    renderCardNavStrip();
    setGlobalStatus(`已关闭 ${site.name} 卡片。`);
  });

  const hoverActions = document.createElement("div");
  hoverActions.className = "card-hover-actions";
  hoverActions.appendChild(jumpBtn);
  hoverActions.appendChild(refreshBtn);
  hoverActions.appendChild(closeBtn);

  const initialUrl = site.restoreUrl || site.url;
  const ref = {
    site,
    restoreUrl: site.restoreUrl || "",
    cardEl: card,
    statusEl: status,
    bodyEl: body,
    iframeEl: null,
    loadingEl: null,
    hoverActionEl: hoverActions,
    jumpBtnEl: jumpBtn,
    refreshBtnEl: refreshBtn,
    closeBtnEl: closeBtn,
    loaded: false,
    pendingQuery: "",
    pendingQueryDelayMs: 0,
    pendingQueryResolver: null,
    pendingFilesOnLoad: [],
    currentUrl: initialUrl,
    // 本张卡片当前 iframe 相关的两个定时器：
    //   loadDelayTimerId：错峰加载排队中，到点给 iframe 赋 src
    //   fallbackTimerId：超过 embedTimeoutMs 仍未加载成功时切换到 fallback 页
    // 刷新 / 关闭卡片时必须清理，否则旧 timer 会把新 iframe 踢掉或在已关闭卡片上跑。
    loadDelayTimerId: null,
    fallbackTimerId: null,
    // 超时后是否已做过一次静默自动重试（防止无限循环）。
    _autoRetried: false,
    // 自动重试时覆盖 embedTimeoutMs，用完即清（0 表示使用默认值）。
    _retryTimeoutMs: 0
  };

  state.cardRefs.set(site.id, ref);
  // 默认走并发队列（immediate=false）；调用方可通过 refreshSiteCard 传 immediate=true 走立即路径。
  createIframeBody(ref);

  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(hoverActions);
  return card;
}

export function refreshSiteCard(ref, options = {}) {
  // immediate=true（默认）：单卡片主动刷新，立即加载、不受并发槽位限制。
  // immediate=false：  批量刷新（例如"新建对话"），统一走并发队列，避免所有卡片同时冷启动。
  const { immediate = true } = options;
  abortPendingWorkForSite(ref.site.id, { reason: "卡片已刷新，已取消上一条发送任务" });
  ref.loaded = false;
  ref.pendingFilesOnLoad = [];
  ref.iframeEl = null;
  ref._autoRetried = false;
  createIframeBody(ref, { immediate });
  setSiteStatus(ref.site.id, "正在重新加载…");
}

export function createIframeBody(ref, options = {}) {
  // immediate=true：绕过并发槽位直接加载（用户主动刷新等场景）。
  // immediate=false（默认）：走队列，受 iframeMaxConcurrent 限制。
  const { immediate = false } = options;

  // 重建 iframe 之前，先把本 ref 的所有历史"挂件"都清理干净：
  //   1) load-delay / fallback 定时器
  //   2) 如果还在排队 / 加载中，把槽位释放掉
  clearIframeTimers(ref);
  removeFromLoadQueue(ref);
  if (state.loadingRefs.has(ref)) {
    state.loadingRefs.delete(ref);
    // 这一次不立即 pump：下面会把新 iframe 加回队列（或直接加载），
    // 避免在同一 tick 里先释放再占用造成短暂的"空转补位"。
  }

  if (ref.site.supportIframe === false) {
    renderExternalFallback(ref);
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.className = "ai-iframe";
  iframe.dataset.siteId = ref.site.id;
  iframe.loading = "eager";
  iframe.allow = ref.site.id === "grok"
    ? "clipboard-read; clipboard-write; autoplay; fullscreen; picture-in-picture"
    : "clipboard-read; clipboard-write; microphone; camera; geolocation; autoplay; fullscreen; picture-in-picture; storage-access; web-share";
  if (ref.site.iframeSandbox) {
    iframe.setAttribute("sandbox", ref.site.iframeSandbox);
  }

  const loadState = { resolved: false };
  ref._loadState = loadState;
  ref._targetSrc = ref.restoreUrl
    ? resolveHistoryRestoreLoadTarget(ref)
    : buildSiteUrl(ref.site, "");

  const loading = createLoadingOverlay(ref.site.name, immediate ? "正在加载…" : "等待加载中…");

  iframe.addEventListener("load", () => {
    // 守卫 1：iframe 可能已被替换（刷新 / 关闭），当前 ref 不再持有这张 iframe 就忽略。
    if (ref.iframeEl !== iframe) return;
    // 守卫 2：过滤掉 about:blank 的初始 load 事件。
    const currentSrc = iframe.src || "";
    if (!currentSrc || currentSrc === "about:blank") {
      return;
    }
    loadState.resolved = true;
    ref.loaded = true;
    const loadedUrl = currentSrc;
    const pendingRestoreUrl = ref.restoreUrl;
    ref.restoreUrl = "";
    if (pendingRestoreUrl && urlsNeedIframeReload(loadedUrl, pendingRestoreUrl)) {
      applyHistoryRestoreNavigation(ref, pendingRestoreUrl, loadedUrl);
      return;
    }
    ref.currentUrl = loadedUrl;
    clearIframeTimers(ref);
    releaseLoadSlot(ref);
    hideLoadingOverlay(ref);
    setSiteStatus(ref.site.id, "iframe 已加载，可直接在卡片内操作。");
    // 给 AI 站点 JS 一小段初始化时间（React/Vue hydration 等），再触发待发查询。
    // postLoadSendDelayMs = 0 时行为与原先完全一致（立即触发）。
    const postLoadDelay = BASE_CONFIG.postLoadSendDelayMs || 0;
    if (postLoadDelay > 0) {
      window.setTimeout(() => flushPendingQueryAfterLoad(ref), postLoadDelay);
    } else {
      flushPendingQueryAfterLoad(ref);
    }

    // 卡片在加载完成前用户可能已经选好了文件，dispatchPendingFilesForCard
    // 会把挂在 ref.pendingFilesOnLoad 上的那一批文件 postMessage 进去。
    dispatchPendingFilesForCard(ref);
  });

  iframe.addEventListener("error", () => {
    if (ref.iframeEl !== iframe) return;
    if (!loadState.resolved) {
      loadState.resolved = true;
      clearIframeTimers(ref);
      releaseLoadSlot(ref);
      settlePendingQuery(ref, {
        ok: false,
        siteId: ref.site.id,
        error: "卡片加载失败，自动发送已取消"
      });
      renderFallback(ref, "加载失败，目标站点未响应或拒绝了连接。");
    }
  });

  // 先把 iframe 节点插入 DOM（不赋 src），再决定走立即加载还是入队。
  ref.bodyEl.innerHTML = "";
  ref.bodyEl.appendChild(loading);
  ref.bodyEl.appendChild(iframe);
  ref.iframeEl = iframe;
  ref.loadingEl = loading;

  if (immediate) {
    // 立即加载路径不占用普通槽位，用户主动操作瞬时突破上限是可接受的。
    state.loadingRefs.add(ref);
    beginIframeLoad(ref);
  } else {
    enqueueLoad(ref);
  }
}

export function renderFallback(ref, message, options = {}) {
  // 超时触发时：先静默重试一次，重试仍超时才显示 fallback UI。
  // 用户手动点"重新加载"会先调 refreshSiteCard（已重置 _autoRetried），走 immediate 路径，不经此处。
  if (options.fromTimeout && !ref._autoRetried) {
    ref._autoRetried = true;
    ref.loaded = false;
    ref.iframeEl = null;
    // 重试只给 8 秒，避免把原本 25s 超时变成 50s 等待。
    // AI 站点正常加载通常在 4~8s 内完成，8s 能覆盖绝大多数正常加载场景。
    ref._retryTimeoutMs = 8000;
    createIframeBody(ref, { immediate: true });
    setSiteStatus(ref.site.id, "加载超时，正在自动重试…");
    updateLoadingOverlay(ref, "加载超时，正在自动重试…");
    return;
  }

  // 进入 fallback 意味着当前 iframe 已作废，同时收掉本张卡片残留的加载/超时定时器。
  clearIframeTimers(ref);
  settlePendingQuery(ref, {
    ok: false,
    siteId: ref.site.id,
    error: "卡片未完成加载，自动发送已取消"
  });
  ref.loadingEl = null;
  ref.bodyEl.innerHTML = `
    <div class="fallback-panel">
      <div class="warning-box">
        <strong>当前卡片未能完成嵌入</strong>
      </div>
      <p>${escapeHtml(message || ref.site.notes || "该站点可能限制 iframe 嵌入。")}</p>
      <div class="inline-action-row">
        <button class="site-action-btn" type="button" data-retry-load>重新加载</button>
        <button class="site-action-btn" type="button" data-open-site="${escapeHtml(ref.site.url)}">在新标签页打开</button>
      </div>
    </div>
  `;
  ref.iframeEl = null;
  ref.loaded = false;
  const retryButton = ref.bodyEl.querySelector("[data-retry-load]");
  if (retryButton) {
    retryButton.addEventListener("click", () => {
      // 用户主动点击"重新加载"：走立即路径，不受并发上限限制。
      // 同时重置自动重试标记，让下次超时还能再自动重试一次。
      ref._autoRetried = false;
      createIframeBody(ref, { immediate: true });
      setSiteStatus(ref.site.id, "正在重新加载…");
    });
  }
  const openButton = ref.bodyEl.querySelector("[data-open-site]");
  if (openButton) {
    openButton.addEventListener("click", () => {
      window.open(ref.site.url, "_blank", "noopener,noreferrer");
    });
  }
  if (ref.hoverActionEl && !ref.cardEl.contains(ref.hoverActionEl)) {
    ref.cardEl.appendChild(ref.hoverActionEl);
  }
  setSiteStatus(ref.site.id, "该站点暂时无法在卡片内嵌入。");
}

function renderExternalFallback(ref) {
  ref.loadingEl = null;
  ref.iframeEl = null;
  ref.loaded = false;
  ref.currentUrl = ref.restoreUrl || buildSiteUrl(ref.site, "");
  const siteName = escapeHtml(ref.site.name);
  const panelDesc = escapeHtml(
    ref.site.notes || `${ref.site.name} 不支持卡片嵌入。请先在新标签页登录，批量搜索时会自动在新标签向该站点发送问题。`
  );
  ref.bodyEl.innerHTML = `
    <div class="fallback-panel">
      <div class="warning-box">
        <strong>${siteName} — 新标签页模式</strong>
      </div>
      <p>${panelDesc}</p>
      <div class="inline-action-row">
        <button class="site-action-btn" type="button" data-open-site="${escapeHtml(ref.currentUrl)}">在新标签页打开并登录</button>
      </div>
    </div>
  `;

  const openButton = ref.bodyEl.querySelector("[data-open-site]");
  if (openButton) {
    openButton.addEventListener("click", () => {
      window.open(ref.currentUrl || ref.site.url, "_blank", "noopener,noreferrer");
    });
  }
  if (ref.hoverActionEl && !ref.cardEl.contains(ref.hoverActionEl)) {
    ref.cardEl.appendChild(ref.hoverActionEl);
  }
  setSiteStatus(ref.site.id, "该站点已改为新标签页模式。");
}

function createLoadingOverlay(siteName, message) {
  const loading = document.createElement("div");
  loading.className = "iframe-loading-panel";
  loading.setAttribute("aria-live", "polite");
  loading.innerHTML = `
    <div class="iframe-loading-spinner" aria-hidden="true"></div>
    <div class="iframe-loading-title">${escapeHtml(siteName)}</div>
    <div class="iframe-loading-text">${escapeHtml(message)}</div>
  `;
  return loading;
}

export function updateLoadingOverlay(ref, message) {
  const textEl = ref?.loadingEl?.querySelector(".iframe-loading-text");
  if (textEl) {
    textEl.textContent = message;
  }
}

function hideLoadingOverlay(ref) {
  if (!ref?.loadingEl) return;
  ref.loadingEl.hidden = true;
}
