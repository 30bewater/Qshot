(function initComparePage() {
  const BASE_CONFIG = globalThis.AI_COMPARE_BASE_CONFIG || {};
  const STORAGE_KEYS = {
    cardSizeLevel: "cardSizeLevel",
    layoutRows: "layoutRows",
    layoutMode: "layoutMode",
    searchHistory: "searchHistory",
    promptGroups: "promptGroups"
  };

  const state = {
    sites: [],
    requestedSiteIds: null,
    hiddenSiteIds: new Set(),
    cardRefs: new Map(),
    columnCount: "1",
    maximizedSiteId: null,
    shouldAutoSend: false,
    pendingDispatches: new Map(),
    cardSizeLevel: "medium",
    layoutRows: 1,
    layoutMode: "grid",
    activeSidebarSiteId: null,
    searchHistory: [],
    currentHistoryEntryId: null,
    promptGroups: [],
    activePromptGroupId: null,
    isPromptPickerOpen: false,
    lockedScrollLeft: null,
    scrollUnlockTimerId: null,
    isScrollLocked: false,
    scrollGuardActive: false,
    scrollGuardLeft: 0,
    scrollGuardTop: 0,
    userIsScrolling: false,
    userScrollTimer: null,
    isSending: false,
    sessionSnapshots: [],
    lastSearchQuery: null,
    lastSearchTime: null
  };

  const elements = {};

  document.addEventListener("DOMContentLoaded", start);
  window.addEventListener("message", handleFrameMessage);

  async function start() {
    try {
      cacheElements();
      bindEvents();
      hydrateQueryFromUrl();
      updateSendBtnState();
      await restorePreferences();
      bindPromptPickerEvents();
      await loadSites();
      renderCards();
      setGlobalStatus(`已加载 ${getSelectedSites().length} 个站点。`);
      await maybeAutoSendFromUrl();
    } catch (error) {
      setGlobalStatus(`初始化失败：${error.message}`, true);
    }
  }

  function cacheElements() {
    elements.queryInput = document.getElementById("queryInput");
    elements.sendSelectedBtn = document.getElementById("sendSelectedBtn");
    elements.promptAssistBtn = document.getElementById("promptAssistBtn");
    elements.promptPicker = document.getElementById("promptPicker");
    elements.globalStatus = document.getElementById("globalStatus");
    elements.iframesContainer = document.getElementById("iframes-container");
    elements.layoutToggleBtn = document.getElementById("layoutToggleBtn");
    elements.layoutPopover = document.getElementById("layoutPopover");
    elements.layoutRowsButtons = Array.from(document.querySelectorAll("[data-layout-rows]"));
    elements.cardSizeButtons = Array.from(document.querySelectorAll("[data-card-size]"));
    elements.cardSizeGroup = document.getElementById("cardSizeGroup");
    elements.exportBtn = document.getElementById("exportBtn");
    elements.historyToggleBtn = document.getElementById("historyToggleBtn");
    elements.historyPanel = document.getElementById("historyPanel");
    elements.historyList = document.getElementById("historyList");
    elements.closeHistoryPanelBtn = document.getElementById("closeHistoryPanelBtn");
    elements.clearHistoryBtn = document.getElementById("clearHistoryBtn");
    elements.siteNavPanel = document.getElementById("siteNavPanel");
    elements.siteNavList = document.getElementById("siteNavList");
    elements.sidebarLayoutBtn = document.querySelector("[data-layout-mode='sidebar']");
    elements.scrollToStartBtn = document.getElementById("scrollToStartBtn");
    elements.scrollToEndBtn = document.getElementById("scrollToEndBtn");
    elements.newChatBtn = document.getElementById("newChatBtn");
  }

  function bindEvents() {
    elements.sendSelectedBtn.addEventListener("click", handleSendSelected);
    elements.promptAssistBtn?.addEventListener("click", (event) => {
      event.stopPropagation();
      togglePromptPicker();
    });
    elements.queryInput.addEventListener("input", () => {
      closePromptPicker();
      updateSendBtnState();
    });
    elements.queryInput.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }
      if (event.isComposing || event.keyCode === 229) {
        return;
      }

      event.preventDefault();
      await handleSendSelected();
    });
    elements.exportBtn.addEventListener("click", showExportModal);
    elements.historyToggleBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleHistoryPanel();
    });
    elements.closeHistoryPanelBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      closeHistoryPanel();
    });
    document.addEventListener("click", (event) => {
      if (
        elements.historyPanel.classList.contains("is-open") &&
        !elements.historyPanel.contains(event.target) &&
        !elements.historyToggleBtn.contains(event.target)
      ) {
        closeHistoryPanel();
      }
    });
    elements.clearHistoryBtn?.addEventListener("click", async () => {
      if (state.searchHistory.length === 0) {
        return;
      }
      await clearAllHistory();
    });
    elements.layoutToggleBtn.addEventListener("click", () => {
      const isHidden = elements.layoutPopover.hasAttribute("hidden");
      if (isHidden) {
        elements.layoutPopover.removeAttribute("hidden");
      } else {
        elements.layoutPopover.setAttribute("hidden", "");
      }
    });

    elements.layoutRowsButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        state.layoutRows = Number(button.dataset.layoutRows);
        state.layoutMode = "grid";
        updateLayoutUi();
        await savePreferences();
      });
    });

    elements.cardSizeButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        state.cardSizeLevel = button.dataset.cardSize;
        updateLayoutUi();
        await savePreferences();
      });
    });

    elements.sidebarLayoutBtn?.addEventListener("click", async () => {
      if (state.layoutMode === "sidebar") {
        state.layoutMode = "grid";
      } else {
        state.layoutMode = "sidebar";
        const firstSite = getSelectedSites()[0];
        if (!state.activeSidebarSiteId || !state.cardRefs.has(state.activeSidebarSiteId)) {
          state.activeSidebarSiteId = firstSite?.id || null;
        }
        state.cardRefs.forEach((ref, siteId) => {
          if (ref.cardEl) ref.cardEl.hidden = siteId !== state.activeSidebarSiteId;
        });
        renderSiteNav();
      }
      updateLayoutUi();
      await savePreferences();
    });

    document.addEventListener("click", (event) => {
      if (!elements.layoutPopover || elements.layoutPopover.hasAttribute("hidden")) {
        return;
      }

      const insidePopover = elements.layoutPopover.contains(event.target);
      const insideToggle = elements.layoutToggleBtn.contains(event.target);
      if (!insidePopover && !insideToggle) {
        elements.layoutPopover.setAttribute("hidden", "");
      }
    });

    elements.iframesContainer.addEventListener("wheel", () => {
      state.userIsScrolling = true;
      clearTimeout(state.userScrollTimer);
      state.userScrollTimer = setTimeout(() => {
        state.userIsScrolling = false;
        state.userScrollTimer = null;
        if (state.scrollGuardActive) {
          state.scrollGuardLeft = elements.iframesContainer.scrollLeft;
          state.scrollGuardTop = elements.iframesContainer.scrollTop;
        }
      }, 400);
    }, { passive: true });

    elements.iframesContainer.addEventListener("pointerdown", () => {
      state.userIsScrolling = true;
    }, { passive: true });

    window.addEventListener("pointerup", () => {
      if (state.userIsScrolling) {
        state.userIsScrolling = false;
        if (state.scrollGuardActive) {
          state.scrollGuardLeft = elements.iframesContainer.scrollLeft;
          state.scrollGuardTop = elements.iframesContainer.scrollTop;
        }
      }
    }, { passive: true });

    // scrollGuard：加载阶段 iframe 内部 focus/selection 可能会把外层容器自动滚到"对齐可视区"的位置，
    // 这里同时锁定 scrollLeft 和 scrollTop，横排/多排网格都能生效。
    elements.iframesContainer.addEventListener("scroll", () => {
      if (!state.scrollGuardActive || state.userIsScrolling) {
        return;
      }
      const container = elements.iframesContainer;
      if (container.scrollLeft !== state.scrollGuardLeft) {
        container.scrollLeft = state.scrollGuardLeft;
      }
      if (container.scrollTop !== state.scrollGuardTop) {
        container.scrollTop = state.scrollGuardTop;
      }
    }, { passive: true });

    elements.iframesContainer.addEventListener("wheel", (event) => {
      if (state.layoutRows !== 1 || state.layoutMode === "sidebar") {
        return;
      }
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }
      event.preventDefault();
      elements.iframesContainer.scrollLeft += event.deltaY * 1.2;
    }, { passive: false });

    elements.scrollToStartBtn?.addEventListener("click", () => {
      elements.iframesContainer.scrollTo({ left: 0, behavior: "smooth" });
    });

    elements.scrollToEndBtn?.addEventListener("click", () => {
      elements.iframesContainer.scrollTo({ left: elements.iframesContainer.scrollWidth, behavior: "smooth" });
    });

    elements.iframesContainer.addEventListener("scroll", updateScrollEdgeBtns, { passive: true });

    window.addEventListener("resize", () => {
      updateLayoutUi();
    });

    elements.newChatBtn?.addEventListener("click", () => {
      elements.queryInput.value = "";
      updateSendBtnState();

      activateScrollGuard(
        elements.iframesContainer.scrollLeft,
        elements.iframesContainer.scrollTop,
        getScrollGuardDurationMs(state.cardRefs.size)
      );

      state.cardRefs.forEach((ref) => {
        refreshSiteCard(ref);
      });
      setGlobalStatus("已新建对话，所有卡片已重置。");
    });
  }

  // 激活滚动守卫：在 iframe 加载 / 自动发送期间，锁定容器滚动位置，
  // 防止 iframe 内部输入框 focus() 导致的祖先容器"对齐可视区"抖动。
  function activateScrollGuard(left, top, durationMs) {
    state.scrollGuardActive = true;
    state.scrollGuardLeft = left;
    state.scrollGuardTop = top;
    if (state._scrollGuardTimerId) {
      window.clearTimeout(state._scrollGuardTimerId);
    }
    state._scrollGuardTimerId = window.setTimeout(() => {
      state.scrollGuardActive = false;
      state._scrollGuardTimerId = null;
    }, Math.max(1000, durationMs | 0));
  }

  // 根据卡片数量估算守卫时长：错峰加载 120ms/个 + 重型 SPA 冷启动需要的稳定时间。
  function getScrollGuardDurationMs(cardCount) {
    const staggerMs = (BASE_CONFIG.iframeStaggerMs != null) ? BASE_CONFIG.iframeStaggerMs : 120;
    const base = 3000;
    const extra = Math.max(0, (cardCount | 0) - 1) * staggerMs;
    return Math.min(base + extra + 1500, 8000);
  }

  function updateScrollEdgeBtns() {
    const show = state.layoutRows === 1 && state.layoutMode !== "sidebar";
    const c = elements.iframesContainer;
    const canScroll = c.scrollWidth > c.clientWidth + 2;
    if (elements.scrollToStartBtn) elements.scrollToStartBtn.hidden = !(show && canScroll);
    if (elements.scrollToEndBtn) elements.scrollToEndBtn.hidden = !(show && canScroll);
  }

  function updateSendBtnState() {
    const hasContent = elements.queryInput.value.trim().length > 0;
    elements.sendSelectedBtn.classList.toggle("is-empty", !hasContent);
  }

  function hydrateQueryFromUrl() {
    const url = new URL(window.location.href);
    const query = url.searchParams.get("q");
    const sitesParam = url.searchParams.get("sites");
    state.shouldAutoSend = url.searchParams.get("autosend") === "1";
    state.requestedSiteIds = parseRequestedSiteIds(sitesParam);
    if (query) {
      elements.queryInput.value = query;
    }
  }

  function parseRequestedSiteIds(rawValue) {
    if (!rawValue) {
      return null;
    }

    const siteIds = rawValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return siteIds.length > 0 ? new Set(siteIds) : null;
  }

  async function restorePreferences() {
    const stored = await chrome.storage.local.get([
      STORAGE_KEYS.cardSizeLevel,
      STORAGE_KEYS.layoutRows,
      STORAGE_KEYS.layoutMode,
      STORAGE_KEYS.searchHistory,
      STORAGE_KEYS.promptGroups
    ]);

    if (typeof stored[STORAGE_KEYS.cardSizeLevel] === "string") {
      state.cardSizeLevel = stored[STORAGE_KEYS.cardSizeLevel];
    }
    if (typeof stored[STORAGE_KEYS.layoutRows] === "number") {
      state.layoutRows = stored[STORAGE_KEYS.layoutRows];
    }
    if (stored[STORAGE_KEYS.layoutMode] === "sidebar" || stored[STORAGE_KEYS.layoutMode] === "grid") {
      state.layoutMode = stored[STORAGE_KEYS.layoutMode];
    }
    if (Array.isArray(stored[STORAGE_KEYS.searchHistory])) {
      state.searchHistory = stored[STORAGE_KEYS.searchHistory];
    }
    state.promptGroups = normalizePromptGroups(stored[STORAGE_KEYS.promptGroups]);
    if (!state.promptGroups.some((group) => group.id === state.activePromptGroupId)) {
      state.activePromptGroupId = state.promptGroups[0]?.id || null;
    }
    elements.iframesContainer.dataset.columns = "1";
    updateLayoutUi();
    renderHistoryList();
    renderPromptPicker();
  }

  async function savePreferences() {
    await chrome.storage.local.set({
      [STORAGE_KEYS.cardSizeLevel]: state.cardSizeLevel,
      [STORAGE_KEYS.layoutRows]: state.layoutRows,
      [STORAGE_KEYS.layoutMode]: state.layoutMode,
      [STORAGE_KEYS.searchHistory]: state.searchHistory
    });
  }

  async function loadSites() {
    const response = await fetch(chrome.runtime.getURL("config/siteHandlers.json"));
    if (!response.ok) {
      throw new Error("无法加载站点配置");
    }

    const payload = await response.json();
    const builtinSites = (payload.sites || []).filter((site) => site.enabled !== false);
    const customSites = await loadCustomSitesFromStorage();
    const mergedSites = mergeSiteLists(builtinSites, customSites);
    if (state.requestedSiteIds && state.requestedSiteIds.size > 0) {
      state.sites = mergedSites.filter((site) => state.requestedSiteIds.has(site.id));
    } else {
      state.sites = mergedSites;
    }
    state.hiddenSiteIds.clear();
  }

  async function loadCustomSitesFromStorage() {
    try {
      const stored = await chrome.storage.local.get(["customSites"]);
      const list = Array.isArray(stored.customSites) ? stored.customSites : [];
      return list
        .map((raw) => {
          if (!raw || typeof raw !== "object") return null;
          const name = String(raw.name || "").trim();
          const url = String(raw.url || "").trim();
          const id = String(raw.id || "").trim();
          if (!id || !name || !url) return null;
          return {
            id,
            name,
            url,
            enabled: raw.enabled !== false,
            supportIframe: raw.supportIframe !== false,
            supportUrlQuery: raw.supportUrlQuery !== false && url.includes("{query}"),
            matchPatterns: Array.isArray(raw.matchPatterns) ? raw.matchPatterns.map(String) : [],
            isCustom: true
          };
        })
        .filter((site) => site && site.enabled !== false);
    } catch (_error) {
      return [];
    }
  }

  function mergeSiteLists(builtin, custom) {
    const result = Array.isArray(builtin) ? [...builtin] : [];
    const seen = new Set(result.map((site) => site.id));
    (custom || []).forEach((site) => {
      if (!site || seen.has(site.id)) return;
      result.push(site);
      seen.add(site.id);
    });
    return result;
  }

  function renderCards() {
    elements.iframesContainer.innerHTML = "";
    elements.iframesContainer.dataset.columns = "1";
    elements.iframesContainer.dataset.layoutRows = state.layoutMode === "sidebar" ? "sidebar" : String(state.layoutRows);
    state.cardRefs.clear();

    const selectedSites = getSelectedSites();
    if (selectedSites.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "empty-state";
      emptyState.textContent = "请先选择至少一个站点。";
      elements.iframesContainer.appendChild(emptyState);
      return;
    }

    // 错峰加载：按顺序每隔 STAGGER_MS 才为下一个 iframe 赋 src，
    // 避免一次性 6~8 个重型 SPA（DeepSeek/Kimi/Gemini 等）同时初始化导致白屏。
    const STAGGER_MS = (BASE_CONFIG.iframeStaggerMs != null)
      ? BASE_CONFIG.iframeStaggerMs
      : 120;
    selectedSites.forEach((site, index) => {
      const card = createSiteCard(site, index * STAGGER_MS);
      if (isWideMediaSite(site.id)) {
        card.classList.add("iframe-card-wide-media");
      }
      elements.iframesContainer.appendChild(card);
    });

    if (state.layoutMode === "sidebar") {
      if (!state.activeSidebarSiteId || !state.cardRefs.has(state.activeSidebarSiteId)) {
        state.activeSidebarSiteId = selectedSites[0]?.id || null;
      }
      state.cardRefs.forEach((ref, siteId) => {
        if (ref.cardEl) ref.cardEl.hidden = siteId !== state.activeSidebarSiteId;
      });
      renderSiteNav();
    }

    elements.iframesContainer.scrollLeft = 0;
    elements.iframesContainer.scrollTop = 0;
    activateScrollGuard(0, 0, getScrollGuardDurationMs(selectedSites.length));
  }

  function createSiteCard(site, loadDelay = 0) {
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
    jumpBtn.setAttribute("data-tooltip", "跳往原网站");
    jumpBtn.setAttribute("aria-label", "跳往原网站");
    jumpBtn.addEventListener("click", () => {
      const ref = state.cardRefs.get(site.id);
      const targetUrl = ref?.currentUrl || site.url;
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    });

    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "card-hover-btn card-hover-btn-icon";
    refreshBtn.innerHTML = iconRefresh;
    refreshBtn.setAttribute("data-tooltip", "刷新当前卡片");
    refreshBtn.setAttribute("aria-label", "刷新当前卡片");
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
    closeBtn.setAttribute("data-tooltip", "关闭这张卡片");
    closeBtn.setAttribute("aria-label", "关闭这张卡片");
    closeBtn.addEventListener("click", () => {
      state.hiddenSiteIds.add(site.id);
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
      setGlobalStatus(`已关闭 ${site.name} 卡片。`);
    });

    const hoverActions = document.createElement("div");
    hoverActions.className = "card-hover-actions";
    hoverActions.appendChild(jumpBtn);
    hoverActions.appendChild(refreshBtn);
    hoverActions.appendChild(closeBtn);

    const ref = {
      site,
      cardEl: card,
      statusEl: status,
      bodyEl: body,
      iframeEl: null,
      hoverActionEl: hoverActions,
      jumpBtnEl: jumpBtn,
      refreshBtnEl: refreshBtn,
      closeBtnEl: closeBtn,
      loaded: false,
      pendingQuery: "",
      pendingQueryResolver: null,
      currentUrl: site.url
    };

    state.cardRefs.set(site.id, ref);
    createIframeBody(ref, loadDelay);

    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(hoverActions);
    return card;
  }

  function refreshSiteCard(ref) {
    ref.loaded = false;
    ref.pendingQuery = "";
    ref.pendingQueryResolver = null;
    ref.iframeEl = null;
    createIframeBody(ref);
    setSiteStatus(ref.site.id, "正在重新加载…");
  }

  function createIframeBody(ref, loadDelay = 0) {
    const iframe = document.createElement("iframe");
    iframe.className = "ai-iframe";
    iframe.dataset.siteId = ref.site.id;
    iframe.loading = "eager";
    iframe.allow = "clipboard-read; clipboard-write; microphone; camera; geolocation; autoplay; fullscreen; picture-in-picture; storage-access; web-share";

    let resolved = false;
    const targetSrc = buildSiteUrl(ref.site, "");

    iframe.addEventListener("load", () => {
      // 过滤掉 about:blank 的初始加载（iframe 无 src 插入 DOM 时浏览器会立即触发一次 load）
      const currentSrc = iframe.src || "";
      if (!currentSrc || currentSrc === "about:blank") {
        return;
      }
      resolved = true;
      ref.loaded = true;
      ref.currentUrl = currentSrc;
      setSiteStatus(ref.site.id, "iframe 已加载，可直接在卡片内操作。");

      if (ref.pendingQuery) {
        const queuedQuery = ref.pendingQuery;
        const queuedResolver = ref.pendingQueryResolver;
        ref.pendingQuery = "";
        ref.pendingQueryResolver = null;
        dispatchSearchWithRetries(ref, queuedQuery, 0)
          .then((result) => {
            if (typeof queuedResolver === "function") {
              queuedResolver(result);
            }
          });
      }
    });

    iframe.addEventListener("error", () => {
      if (!resolved) {
        resolved = true;
        renderFallback(ref, "加载失败，目标站点未响应或拒绝了连接。");
      }
    });

    if (loadDelay > 0) {
      // 有延迟：先插入 DOM（不设 src），延迟后再赋 src
      ref.bodyEl.innerHTML = "";
      ref.bodyEl.appendChild(iframe);
      ref.iframeEl = iframe;
      setSiteStatus(ref.site.id, "等待加载中…");
      setTimeout(() => {
        if (ref.iframeEl === iframe) {
          iframe.src = targetSrc;
        }
      }, loadDelay);
    } else {
      // 无延迟：先设 src 再插入 DOM，避免触发 about:blank 的 load 事件
      iframe.src = targetSrc;
      ref.bodyEl.innerHTML = "";
      ref.bodyEl.appendChild(iframe);
      ref.iframeEl = iframe;
    }

    const timeoutMs = (BASE_CONFIG.embedTimeoutMs || 18000) + loadDelay;
    setTimeout(() => {
      if (!resolved) {
        renderFallback(ref, "站点未能在限定时间内完成 iframe 加载。可能仍被目标站点限制嵌入。");
      }
    }, timeoutMs);
  }

  function renderFallback(ref, message) {
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
        createIframeBody(ref);
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

  async function handleSendSelected(options = {}) {
    if (state.isSending) {
      return;
    }

    const { clearInputAfterSend = true } = options;
    const query = getQuery();

    if (!query) {
      setGlobalStatus("请输入问题后再发送。", true);
      return;
    }

    const selectedSites = getSelectedSites();
    if (selectedSites.length === 0) {
      setGlobalStatus("没有可发送的站点。", true);
      return;
    }

    state.isSending = true;

    try {
      lockContainerScroll();
      toggleGlobalButtons(true);
      setGlobalStatus(`正在向 ${selectedSites.length} 个站点分发问题...`);

      if (state.lastSearchQuery) {
        try {
          const prevResponses = await quickCaptureAllResponses();
          state.sessionSnapshots.push({
            query: state.lastSearchQuery,
            time: state.lastSearchTime,
            responses: prevResponses
          });
        } catch (_snapErr) {
          // 快照失败不阻断发送流程
        }
      }

      state.lastSearchQuery = query;
      state.lastSearchTime = new Date().toLocaleString();

      activateScrollGuard(
        elements.iframesContainer.scrollLeft,
        elements.iframesContainer.scrollTop,
        getScrollGuardDurationMs(selectedSites.length)
      );

      if (clearInputAfterSend) {
        elements.queryInput.value = "";
        updateSendBtnState();
      }

      const results = await Promise.all(selectedSites.map((site) => sendSmartToSite(site, query)));
      const successCount = results.filter((item) => item && item.ok).length;
      const failedCount = results.length - successCount;

      await saveSearchHistory(query, selectedSites);
      setGlobalStatus(`发送完成：成功 ${successCount} 个，失败 ${failedCount} 个。`, failedCount > 0);
      scheduleScrollUnlock();
    } finally {
      state.isSending = false;
      toggleGlobalButtons(false);
    }
  }

  async function maybeAutoSendFromUrl() {
    if (!state.shouldAutoSend) {
      return;
    }

    const query = getQuery();
    if (!query) {
      state.shouldAutoSend = false;
      return;
    }

    state.shouldAutoSend = false;
    clearAutoSendFlagFromUrl();
    await handleSendSelected({ clearInputAfterSend: true });
  }

  async function sendSmartToSite(site, query) {
    const ref = state.cardRefs.get(site.id);
    if (!ref || !ref.iframeEl) {
      return {
        ok: false,
        siteId: site.id,
        error: "卡片 iframe 不可用"
      };
    }

    if (site.supportUrlQuery && String(site.url || "").includes("{query}")) {
      return navigateByUrlTemplate(ref, query);
    }

    if (!ref.loaded) {
      return new Promise((resolve) => {
        ref.pendingQuery = query;
        ref.pendingQueryResolver = resolve;
        setSiteStatus(site.id, "卡片加载中，完成后将自动发送...");
      });
    }

    ref.pendingQuery = "";
    ref.pendingQueryResolver = null;
    return dispatchSearchWithRetries(ref, query, 0);
  }

  function navigateByUrlTemplate(ref, query) {
    const targetUrl = buildSiteUrl(ref.site, query);
    if (!targetUrl) {
      return Promise.resolve({
        ok: false,
        siteId: ref.site.id,
        error: "站点 URL 配置无效"
      });
    }

    const iframe = ref.iframeEl;
    if (!iframe) {
      return Promise.resolve({
        ok: false,
        siteId: ref.site.id,
        error: "卡片 iframe 不可用"
      });
    }

    setSiteStatus(ref.site.id, "正在通过 URL 直达搜索结果页...");

    return new Promise((resolve) => {
      const timeoutMs = 12000;
      let done = false;

      const cleanup = () => {
        iframe.removeEventListener("load", handleLoad, true);
        iframe.removeEventListener("error", handleError, true);
      };

      const finish = (result) => {
        if (done) {
          return;
        }
        done = true;
        cleanup();
        resolve(result);
      };

      const handleLoad = () => {
        ref.loaded = true;
        ref.currentUrl = iframe.src || targetUrl;
        finish({
          ok: true,
          siteId: ref.site.id,
          message: "已通过 URL 跳转到搜索结果页"
        });
      };

      const handleError = () => {
        finish({
          ok: false,
          siteId: ref.site.id,
          error: "URL 跳转失败，页面未响应"
        });
      };

      iframe.addEventListener("load", handleLoad, true);
      iframe.addEventListener("error", handleError, true);

      window.setTimeout(() => {
        finish({
          ok: false,
          siteId: ref.site.id,
          error: "URL 跳转超时，未进入目标结果页"
        });
      }, timeoutMs);

      iframe.src = targetUrl;
    });
  }

  function handleFrameMessage(event) {
    const payload = event.data;
    if (!payload || !payload.type || !payload.siteId) {
      return;
    }

    if (payload.type === "AI_COMPARE_URL_UPDATE") {
      const ref = state.cardRefs.get(payload.siteId);
      if (ref) {
        ref.injectedPinged = true;
        if (payload.currentUrl) {
          ref.currentUrl = payload.currentUrl;
          updateLatestHistoryUrl(payload.siteId, payload.currentUrl);
        }
      }
      return;
    }

    if (payload.type !== "AI_COMPARE_RESULT") {
      return;
    }

    if (payload.requestId) {
      resolvePendingDispatch(payload.requestId, payload);
    }

    if (payload.ok) {
      setSiteStatus(payload.siteId, payload.message || "iframe 页面已处理查询。", "success");
    } else {
      setSiteStatus(payload.siteId, payload.error || "iframe 页面处理失败。", "error");
    }
  }

  function setSiteStatus(siteId, message, kind = "info") {
    const ref = state.cardRefs.get(siteId);
    if (!ref) {
      return;
    }

    ref.statusEl.textContent = message;
    ref.statusEl.classList.toggle("success-text", kind === "success");
  }

  function setGlobalStatus(message, isError = false) {
    elements.globalStatus.textContent = message;
    elements.globalStatus.classList.toggle("success-text", !isError);
  }

  function toggleGlobalButtons(isBusy) {
    elements.sendSelectedBtn.disabled = isBusy;
    if (elements.promptAssistBtn) {
      elements.promptAssistBtn.disabled = isBusy;
    }
  }

  function lockContainerScroll() {
    if (!elements.iframesContainer) {
      return;
    }

    if (state.layoutRows === 1) {
      state.lockedScrollLeft = null;
      state.isScrollLocked = false;
      return;
    }

    state.lockedScrollLeft = elements.iframesContainer.scrollLeft;
    state.isScrollLocked = true;
  }

  function restoreLockedScrollPosition() {
    if (state.lockedScrollLeft === null || !elements.iframesContainer) {
      return;
    }

    elements.iframesContainer.scrollLeft = state.lockedScrollLeft;
  }

  function scheduleScrollUnlock() {
    if (state.scrollUnlockTimerId) {
      window.clearTimeout(state.scrollUnlockTimerId);
    }

    if (state.layoutRows === 1) {
      state.lockedScrollLeft = null;
      state.isScrollLocked = false;
      state.scrollUnlockTimerId = null;
      return;
    }

    state.scrollUnlockTimerId = window.setTimeout(() => {
      state.lockedScrollLeft = null;
      state.isScrollLocked = false;
      state.scrollUnlockTimerId = null;
    }, 2200);
  }


  function getSelectedSites() {
    return state.sites.filter((site) => !state.hiddenSiteIds.has(site.id));
  }

  function isWideMediaSite(siteId) {
    return siteId === "xiaohongshu" || siteId === "bilibili";
  }

  function getQuery() {
    return elements.queryInput.value.trim();
  }

  function ensureCardsNotEmpty() {
    if (state.cardRefs.size > 0) {
      return;
    }

    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "请先选择至少一个站点。";
    elements.iframesContainer.innerHTML = "";
    elements.iframesContainer.appendChild(emptyState);
  }

  function updateLayoutUi() {
    const appShell = document.querySelector(".app-shell");

    if (state.layoutMode === "sidebar") {
      appShell?.classList.add("is-sidebar-mode");
      elements.iframesContainer.dataset.layoutRows = "sidebar";
      if (elements.siteNavPanel) elements.siteNavPanel.hidden = false;
      if (elements.cardSizeGroup) elements.cardSizeGroup.hidden = true;
      elements.sidebarLayoutBtn?.classList.add("is-active");
      elements.layoutRowsButtons.forEach((btn) => btn.classList.remove("is-active"));
      elements.cardSizeButtons.forEach((btn) => btn.classList.remove("is-active"));
      updateScrollEdgeBtns();
      return;
    }

    appShell?.classList.remove("is-sidebar-mode");
    if (elements.siteNavPanel) elements.siteNavPanel.hidden = true;
    elements.sidebarLayoutBtn?.classList.remove("is-active");
    state.cardRefs.forEach((ref) => {
      if (ref.cardEl) ref.cardEl.hidden = false;
    });

    const singleRowWidthMap = {
      small: 480,
      medium: 640,
      large: 960
    };

    let effectiveWidth = singleRowWidthMap[state.cardSizeLevel] || singleRowWidthMap.medium;
    let rowHeight = "calc(100vh - 163px)";
    if (state.layoutRows > 1) {
      rowHeight = state.layoutRows === 2
        ? "calc(100vh - 159px)"
        : "calc(100vh - 179px)";
    }

    state.lockedScrollLeft = null;
    state.isScrollLocked = false;
    if (state.scrollUnlockTimerId) {
      window.clearTimeout(state.scrollUnlockTimerId);
      state.scrollUnlockTimerId = null;
    }

    elements.iframesContainer.style.setProperty("--effective-card-width", `${effectiveWidth}px`);
    elements.iframesContainer.style.setProperty("--row-height", rowHeight);
    document.documentElement.style.setProperty("--card-width", `${effectiveWidth}px`);
    elements.iframesContainer.dataset.layoutRows = String(state.layoutRows);

    elements.layoutRowsButtons.forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.layoutRows) === state.layoutRows);
    });

    elements.cardSizeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.cardSize === state.cardSizeLevel);
    });

    if (elements.cardSizeGroup) {
      elements.cardSizeGroup.hidden = state.layoutRows !== 1;
    }
    updateScrollEdgeBtns();
  }

  function renderSiteNav() {
    if (!elements.siteNavList) return;
    elements.siteNavList.innerHTML = "";
    const selectedSites = getSelectedSites();
    selectedSites.forEach((site) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "site-nav-item" + (site.id === state.activeSidebarSiteId ? " is-active" : "");
      btn.dataset.siteId = site.id;
      btn.innerHTML = `<span class="site-nav-item-indicator"></span><span>${escapeHtml(site.name)}</span>`;
      btn.addEventListener("click", () => activateSidebarSite(site.id));
      elements.siteNavList.appendChild(btn);
    });
  }

  function activateSidebarSite(siteId) {
    state.activeSidebarSiteId = siteId;
    state.cardRefs.forEach((ref, id) => {
      if (ref.cardEl) ref.cardEl.hidden = id !== siteId;
    });
    if (elements.siteNavList) {
      elements.siteNavList.querySelectorAll(".site-nav-item").forEach((item) => {
        item.classList.toggle("is-active", item.dataset.siteId === siteId);
      });
    }
  }

  function openHistoryPanel() {
    elements.historyPanel.classList.add("is-open");
  }

  function closeHistoryPanel() {
    elements.historyPanel.classList.remove("is-open");
  }

  function toggleHistoryPanel() {
    if (elements.historyPanel.classList.contains("is-open")) {
      closeHistoryPanel();
    } else {
      openHistoryPanel();
    }
  }

  function bindPromptPickerEvents() {
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !state.isPromptPickerOpen) {
        return;
      }

      if (target.closest("#promptAssistBtn") || target.closest("#promptPicker")) {
        return;
      }

      closePromptPicker();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.isPromptPickerOpen) {
        closePromptPicker();
        elements.queryInput?.focus();
      }
    });
  }

  function togglePromptPicker() {
    state.isPromptPickerOpen = !state.isPromptPickerOpen;
    renderPromptPicker();
  }

  function closePromptPicker() {
    if (!state.isPromptPickerOpen) {
      return;
    }

    state.isPromptPickerOpen = false;
    hidePromptPreviewPopup();
    renderPromptPicker();
  }

  // ── 全局预览浮层（position:fixed，悬浮在 picker 左侧）──
  let _previewPopupEl = null;
  let _previewHideTimer = null;

  function getOrCreatePreviewPopup() {
    if (!_previewPopupEl) {
      _previewPopupEl = document.createElement("div");
      _previewPopupEl.className = "popup-prompt-preview-popup";
      _previewPopupEl.addEventListener("mouseenter", () => {
        if (_previewHideTimer) { clearTimeout(_previewHideTimer); _previewHideTimer = null; }
      });
      _previewPopupEl.addEventListener("mouseleave", () => {
        _previewHideTimer = setTimeout(() => hidePromptPreviewPopup(), 320);
      });
      document.body.appendChild(_previewPopupEl);
    }
    return _previewPopupEl;
  }

  function showPromptPreviewPopup(anchorBtn, prompt) {
    const popup = getOrCreatePreviewPopup();
    popup.innerHTML = `<div class="popup-prompt-preview-title">${escapeHtml(prompt.title || "未命名提示词")}</div><div class="popup-prompt-preview-body">${escapeHtml(prompt.content || "（暂无内容）")}</div>`;
    popup.style.display = "block";
    popup.classList.add("is-visible");

    // 定位：优先显示在 picker 右侧，不够则显示在左侧
    requestAnimationFrame(() => {
      const btnRect = anchorBtn.getBoundingClientRect();
      const popupW = popup.offsetWidth || 300;
      const popupH = popup.offsetHeight || 180;
      const picker = elements.promptPicker;
      const pickerRect = picker ? picker.getBoundingClientRect() : btnRect;

      // 水平：优先 picker 右侧
      let left = pickerRect.right + 8;
      if (left + popupW > window.innerWidth - 8) {
        left = pickerRect.left - popupW - 8; // 右侧放不下则改左侧
      }
      if (left < 8) left = 8;

      // 垂直：以按钮为基准，垂直居中
      let top = btnRect.top + btnRect.height / 2 - popupH / 2;
      if (top < 8) top = 8;
      if (top + popupH > window.innerHeight - 8) top = window.innerHeight - popupH - 8;

      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;
    });
  }

  function hidePromptPreviewPopup() {
    if (_previewPopupEl) {
      _previewPopupEl.style.display = "none";
      _previewPopupEl.classList.remove("is-visible");
    }
    if (_previewHideTimer) { clearTimeout(_previewHideTimer); _previewHideTimer = null; }
  }

  // ── 编辑弹窗 ──
  function openPromptEditModal(prompt, groupId) {
    closePromptPicker();

    // 找当前的 prompt 对象（引用）
    let targetGroup = state.promptGroups.find((g) => g.id === groupId) || state.promptGroups[0];
    let targetPrompt = targetGroup?.prompts.find((p) => p.id === prompt.id);
    if (!targetPrompt) return;

    const overlay = document.createElement("div");
    overlay.className = "prompt-edit-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "prompt-edit-modal";
    modal.innerHTML = `
      <div class="prompt-edit-modal-title">编辑提示词</div>
      <div>
        <label class="prompt-edit-field-label">名称</label>
        <input class="prompt-edit-input" type="text" value="${escapeHtml(targetPrompt.title || "")}" />
      </div>
      <div>
        <label class="prompt-edit-field-label">分类</label>
        <select class="prompt-edit-select">
          ${state.promptGroups.map((g) => `<option value="${escapeHtml(g.id)}"${g.id === groupId ? " selected" : ""}>${escapeHtml(g.name || "未命名分组")}</option>`).join("")}
          <option value="__new__">＋ 新建分组…</option>
        </select>
        <input class="prompt-edit-input prompt-edit-new-group-input" type="text" placeholder="输入新分组名称" style="display:none;margin-top:8px;" />
      </div>
      <div>
        <label class="prompt-edit-field-label">提示词内容</label>
        <textarea class="prompt-edit-textarea">${escapeHtml(targetPrompt.content || "")}</textarea>
      </div>
      <div class="prompt-edit-actions">
        <button class="prompt-edit-delete-btn" type="button">删除</button>
        <div class="prompt-edit-main-btns">
          <button class="prompt-edit-cancel-btn" type="button">取消</button>
          <button class="prompt-edit-save-btn" type="button">保存</button>
        </div>
      </div>
    `;

    const titleInput = modal.querySelector(".prompt-edit-input");
    const groupSelect = modal.querySelector(".prompt-edit-select");
    const newGroupInput = modal.querySelector(".prompt-edit-new-group-input");
    const contentInput = modal.querySelector(".prompt-edit-textarea");
    const cancelBtn = modal.querySelector(".prompt-edit-cancel-btn");
    const saveBtn = modal.querySelector(".prompt-edit-save-btn");
    const deleteBtn = modal.querySelector(".prompt-edit-delete-btn");

    // 选择「新建分组」时显示输入框
    groupSelect?.addEventListener("change", () => {
      const isNew = groupSelect instanceof HTMLSelectElement && groupSelect.value === "__new__";
      if (newGroupInput instanceof HTMLInputElement) {
        newGroupInput.style.display = isNew ? "block" : "none";
        if (isNew) requestAnimationFrame(() => newGroupInput.focus());
      }
    });

    cancelBtn.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    saveBtn.addEventListener("click", async () => {
      const newTitle = (titleInput instanceof HTMLInputElement ? titleInput.value : "").trim() || "未命名提示词";
      const newContent = contentInput instanceof HTMLTextAreaElement ? contentInput.value : "";
      let newGroupId = groupSelect instanceof HTMLSelectElement ? groupSelect.value : groupId;

      // 处理新建分组
      if (newGroupId === "__new__") {
        const newName = (newGroupInput instanceof HTMLInputElement ? newGroupInput.value : "").trim() || "新建分组";
        const newGroup = { id: `prompt-group-${Date.now()}`, name: newName, prompts: [] };
        state.promptGroups.push(newGroup);
        newGroupId = newGroup.id;
      }

      // 从原分组删除
      state.promptGroups.forEach((g) => {
        g.prompts = g.prompts.filter((p) => p.id !== targetPrompt.id);
      });
      // 放入目标分组
      const destGroup = state.promptGroups.find((g) => g.id === newGroupId) || targetGroup;
      destGroup.prompts.push({ id: targetPrompt.id, title: newTitle, content: newContent });

      await chrome.storage.local.set({ [STORAGE_KEYS.promptGroups]: state.promptGroups });
      overlay.remove();
    });

    deleteBtn.addEventListener("click", async () => {
      if (!window.confirm("确定要删除这条提示词吗？")) return;
      state.promptGroups.forEach((g) => {
        g.prompts = g.prompts.filter((p) => p.id !== targetPrompt.id);
      });
      await chrome.storage.local.set({ [STORAGE_KEYS.promptGroups]: state.promptGroups });
      overlay.remove();
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    if (titleInput instanceof HTMLInputElement) {
      requestAnimationFrame(() => titleInput.focus());
    }
  }

  function renderPromptPicker() {
    if (!elements.promptPicker || !elements.promptAssistBtn) {
      return;
    }

    elements.promptAssistBtn.style.display = state.promptGroups.length > 0 ? "inline-flex" : "none";

    elements.promptPicker.innerHTML = "";
    elements.promptAssistBtn.setAttribute("aria-expanded", String(state.isPromptPickerOpen));

    if (!state.isPromptPickerOpen) {
      elements.promptPicker.hidden = true;
      return;
    }

    elements.promptPicker.hidden = false;

    if (!state.promptGroups.length) {
      const empty = document.createElement("div");
      empty.className = "popup-prompt-picker-empty";
      empty.textContent = "还没有提示词分组，请先去设置里添加。";
      elements.promptPicker.appendChild(empty);
      return;
    }

    const activeGroup = state.promptGroups.find((group) => group.id === state.activePromptGroupId) || state.promptGroups[0];
    if (!activeGroup) {
      return;
    }

    const groupsColumn = document.createElement("div");
    groupsColumn.className = "popup-prompt-groups";

    state.promptGroups.forEach((group) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `popup-prompt-group-item${group.id === activeGroup.id ? " is-active" : ""}`;
      button.textContent = group.name || "未命名分组";
      button.addEventListener("mouseenter", () => {
        if (state.activePromptGroupId === group.id) {
          return;
        }
        state.activePromptGroupId = group.id;
        renderPromptPicker();
      });
      button.addEventListener("click", () => {
        state.activePromptGroupId = group.id;
        renderPromptPicker();
      });
      groupsColumn.appendChild(button);
    });

    const promptsColumn = document.createElement("div");
    promptsColumn.className = "popup-prompt-list";

    if (!activeGroup.prompts.length) {
      const empty = document.createElement("div");
      empty.className = "popup-prompt-picker-empty";
      empty.textContent = "这个分组里还没有提示词。";
      promptsColumn.appendChild(empty);
    } else {
      activeGroup.prompts.forEach((prompt) => {
        const item = document.createElement("div");
        item.className = "popup-prompt-item";

        // 左侧：标题（点击填入）
        const label = document.createElement("span");
        label.className = "popup-prompt-item-label";
        label.textContent = prompt.title || "未命名提示词";
        label.addEventListener("click", () => {
          elements.queryInput.value = prompt.content || "";
          closePromptPicker();
          elements.queryInput.focus();
        });

        // 右侧：铅笔 + 眼睛
        const rightIcons = document.createElement("div");
        rightIcons.className = "popup-prompt-edit-wrap";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "popup-prompt-icon-btn";
        editBtn.setAttribute("aria-label", "编辑此提示词");
        editBtn.title = "编辑";
        editBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" d="M4 22h16" opacity=".5"/><path d="m14.63 2.921l-.742.742l-6.817 6.817c-.462.462-.693.692-.891.947a5.2 5.2 0 0 0-.599.969c-.139.291-.242.601-.449 1.22l-.875 2.626l-.213.641a.848.848 0 0 0 1.073 1.073l.641-.213l2.625-.875c.62-.207.93-.31 1.221-.45q.518-.246.969-.598c.255-.199.485-.43.947-.891l6.817-6.817l.742-.742a3.146 3.146 0 0 0-4.45-4.449Z"/><path d="M13.888 3.664S13.98 5.24 15.37 6.63s2.966 1.483 2.966 1.483m-12.579 9.63l-1.5-1.5" opacity=".5"/></svg>`;
        editBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          openPromptEditModal(prompt, activeGroup.id);
        });

        const previewWrap = document.createElement("div");
        previewWrap.className = "popup-prompt-preview-wrap";
        const previewBtn = document.createElement("button");
        previewBtn.type = "button";
        previewBtn.className = "popup-prompt-icon-btn";
        previewBtn.setAttribute("aria-label", "预览内容");
        previewBtn.title = "预览";
        previewBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

        previewBtn.addEventListener("mouseenter", () => {
          if (_previewHideTimer) { clearTimeout(_previewHideTimer); _previewHideTimer = null; }
          showPromptPreviewPopup(previewBtn, prompt);
        });
        previewBtn.addEventListener("mouseleave", () => {
          _previewHideTimer = setTimeout(() => hidePromptPreviewPopup(), 320);
        });
        previewWrap.appendChild(previewBtn);

        rightIcons.appendChild(editBtn);
        rightIcons.appendChild(previewWrap);

        item.appendChild(label);
        item.appendChild(rightIcons);
        promptsColumn.appendChild(item);
      });
    }

    elements.promptPicker.appendChild(groupsColumn);
    elements.promptPicker.appendChild(promptsColumn);
  }

  function normalizePromptGroups(source) {
    const list = Array.isArray(source) ? source : [];
    return list.map((group, groupIndex) => ({
      id: String(group.id || `prompt-group-${groupIndex}`),
      name: String(group.name || "未命名分组"),
      prompts: Array.isArray(group.prompts)
        ? group.prompts.map((prompt, promptIndex) => ({
            id: String(prompt.id || `prompt-${groupIndex}-${promptIndex}`),
            title: String(prompt.title || "未命名提示词"),
            content: String(prompt.content || "")
          }))
        : []
    }));
  }

  async function saveSearchHistory(query, sites) {
    const entry = {
      id: createRequestId(),
      query,
      sites: sites.map((site) => {
        const ref = state.cardRefs.get(site.id);
        return {
          id: site.id,
          name: site.name,
          url: ref?.currentUrl || site.url
        };
      }),
      createdAt: new Date().toISOString()
    };

    state.currentHistoryEntryId = entry.id;
    state.searchHistory = [entry, ...state.searchHistory].slice(0, 50);
    await savePreferences();
    renderHistoryList();
  }

  function renderHistoryList() {
    if (!elements.historyList) {
      return;
    }

    elements.historyList.innerHTML = "";
    if (state.searchHistory.length === 0) {
      const empty = document.createElement("div");
      empty.className = "history-item-meta";
      empty.textContent = "暂无搜索记录";
      elements.historyList.appendChild(empty);
      return;
    }

    state.searchHistory.forEach((entry) => {
      const normalizedSites = Array.isArray(entry.sites)
        ? entry.sites.map((site, index) => {
            if (typeof site === "string") {
              return {
                id: `legacy-${index}`,
                name: site,
                url: ""
              };
            }

            return {
              id: String(site.id || `site-${index}`),
              name: String(site.name || "未命名站点"),
              url: String(site.url || "")
            };
          })
        : [];

      const item = document.createElement("div");
      item.className = "history-item";

      const title = document.createElement("div");
      title.className = "history-item-title";
      title.textContent = entry.query;

      const meta = document.createElement("div");
      meta.className = "history-item-meta";
      meta.textContent = formatHistoryTime(entry.createdAt);

      const links = document.createElement("div");
      links.className = "history-site-links";

      normalizedSites.forEach((site) => {
        const link = document.createElement(site.url ? "a" : "button");
        link.className = "history-site-link";
        link.textContent = site.name;

        if (site.url) {
          link.href = site.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        } else {
          link.type = "button";
          link.disabled = true;
        }

        link.addEventListener("click", (event) => {
          event.stopPropagation();
        });
        links.appendChild(link);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "history-item-delete-btn";
      deleteBtn.textContent = "×";
      deleteBtn.setAttribute("aria-label", "删除记录");
      deleteBtn.setAttribute("data-tooltip", "删除该记录");
      deleteBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        await deleteHistoryEntry(entry.id);
      });

      item.appendChild(title);
      item.appendChild(meta);
      item.appendChild(links);
      item.appendChild(deleteBtn);
      item.addEventListener("click", () => {
        elements.queryInput.value = entry.query;
        closeHistoryPanel();
      });
      elements.historyList.appendChild(item);
    });
  }

  async function deleteHistoryEntry(id) {
    state.searchHistory = state.searchHistory.filter((entry) => entry.id !== id);
    await savePreferences();
    renderHistoryList();
  }

  async function clearAllHistory() {
    state.searchHistory = [];
    state.currentHistoryEntryId = null;
    await savePreferences();
    renderHistoryList();
  }

  function formatHistoryTime(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString();
  }

  async function updateLatestHistoryUrl(siteId, url) {
    if (!siteId || !url || !state.currentHistoryEntryId) {
      return;
    }

    let changed = false;
    state.searchHistory = state.searchHistory.map((entry) => {
      if (entry.id !== state.currentHistoryEntryId || !Array.isArray(entry.sites)) {
        return entry;
      }

      const updatedSites = entry.sites.map((site) => {
        if (!site || site.id !== siteId || site.url === url) {
          return site;
        }

        changed = true;
        return {
          ...site,
          url
        };
      });

      return changed ? { ...entry, sites: updatedSites } : entry;
    });

    if (!changed) {
      return;
    }

    await savePreferences();
    renderHistoryList();
  }

  function showExportModal() {
    const existing = document.getElementById("exportModal");
    if (existing) {
      existing.remove();
      return;
    }

    const selectedSiteIds = new Set(Array.from(state.cardRefs.keys()));
    let selectedFormat = "markdown";

    const modal = document.createElement("div");
    modal.id = "exportModal";
    modal.className = "export-modal";
    modal.innerHTML = `
      <div class="export-modal-content">
        <div class="export-modal-header">
          <h3 class="export-modal-title">导出对话结果</h3>
          <button class="export-close-btn" type="button" aria-label="关闭"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="export-notice">将读取各卡片当前已加载的 AI 回答内容，结果取决于页面加载状态。<br>此功能还处于测试阶段，可能存在内容提取不完整或格式异常等问题。</div>
        <div class="export-modal-body">
          <div class="export-section">
            <div class="export-section-title">导出格式</div>
            <div class="export-option-row">
              <button class="export-option-btn is-active" data-export-format="markdown">Markdown</button>
              <button class="export-option-btn" data-export-format="txt">TXT</button>
            </div>
          </div>
          <div class="export-section">
            <div class="export-section-title">选择导出</div>
            <div class="export-site-list"></div>
          </div>
        </div>
        <div class="export-actions">
          <button class="export-cancel-btn" type="button">取消</button>
          <button class="export-confirm-btn" type="button">导出</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const siteList = modal.querySelector(".export-site-list");

    Array.from(state.cardRefs.values()).forEach((ref) => {
      const row = document.createElement("label");
      row.className = "export-site-item";
      row.innerHTML = `
        <input type="checkbox" checked data-site-id="${escapeHtml(ref.site.id)}" />
        <span>${escapeHtml(ref.site.name)}</span>
      `;

      const checkbox = row.querySelector("input");
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          selectedSiteIds.add(ref.site.id);
        } else {
          selectedSiteIds.delete(ref.site.id);
        }
      });

      siteList.appendChild(row);
    });

    modal.querySelectorAll("[data-export-format]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedFormat = button.dataset.exportFormat;
        modal.querySelectorAll("[data-export-format]").forEach((item) => {
          item.classList.toggle("is-active", item === button);
        });
      });
    });

    const closeModal = () => {
      modal.remove();
    };

    modal.querySelector(".export-close-btn").addEventListener("click", closeModal);
    modal.querySelector(".export-cancel-btn").addEventListener("click", closeModal);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    modal.querySelector(".export-confirm-btn").addEventListener("click", async () => {
      const responses = await collectVisibleResponses(selectedSiteIds);
      const content = generateExportContent(responses, selectedFormat, selectedSiteIds);
      const extension = selectedFormat === "markdown" ? "md" : selectedFormat;
      const mimeType = selectedFormat === "html" ? "text/html" : "text/plain";
      downloadFile(content, buildExportFilename(extension), mimeType);
      closeModal();
    });

  }

  async function quickCaptureAllResponses() {
    const CAPTURE_TIMEOUT = 3000;
    const promises = [];
    for (const [, ref] of state.cardRefs.entries()) {
      const p = Promise.race([
        collectResponseForSite(ref),
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                siteName: ref.site.name,
                content: "暂未提取到内容",
                turns: null,
                url: ref.currentUrl || ref.site.url
              }),
            CAPTURE_TIMEOUT
          )
        )
      ]);
      promises.push(p);
    }
    return Promise.all(promises);
  }

  async function collectVisibleResponses(selectedSiteIds = null) {
    const responses = [];
    for (const [siteId, ref] of state.cardRefs.entries()) {
      if (selectedSiteIds && !selectedSiteIds.has(siteId)) {
        continue;
      }

      const response = await collectResponseForSite(ref);
      responses.push(response);
    }
    return responses;
  }

  async function collectResponseForSite(ref) {
    if (!ref.iframeEl) {
      return {
        siteName: ref.site.name,
        content: "暂未提取到内容",
        turns: null,
        url: ref.currentUrl || ref.site.url
      };
    }

    const response = await requestIframeContent(ref.iframeEl, ref.site);
    if (response.content && response.content !== "暂未提取到内容") {
      return response;
    }

    return {
      ...response,
      content: extractFallbackContent(ref)
    };
  }

  function extractFallbackContent(ref) {
    if (!ref || !ref.bodyEl) {
      return "暂未提取到内容";
    }

    const fallbackPanel = ref.bodyEl.querySelector(".fallback-panel");
    if (fallbackPanel) {
      return String(fallbackPanel.textContent || "暂未提取到内容").trim() || "暂未提取到内容";
    }

    return ref.statusEl?.textContent?.trim() || "暂未提取到内容";
  }

  function requestIframeContent(iframe, site) {
    return new Promise((resolve) => {
      const requestId = createRequestId();

      const handler = (event) => {
        if (!event.data || event.data.type !== "AI_COMPARE_EXTRACT_RESULT" || event.data.requestId !== requestId) {
          return;
        }

        window.removeEventListener("message", handler);
        resolve({
          siteName: site.name,
          content: cleanExtractedContent(event.data.content || ""),
          turns: Array.isArray(event.data.turns) ? event.data.turns : null,
          url: event.data.url || site.url
        });
      };

      window.addEventListener("message", handler);

      try {
        iframe.contentWindow.postMessage({
          type: "AI_COMPARE_EXTRACT",
          requestId,
          site
        }, "*");
      } catch (_error) {
        window.removeEventListener("message", handler);
        resolve({
          siteName: site.name,
          content: "暂未提取到内容",
          turns: null,
          url: site.url
        });
        return;
      }

      window.setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve({
          siteName: site.name,
          content: "暂未提取到内容",
          turns: null,
          url: site.url
        });
      }, 5000);
    });
  }

  function cleanExtractedContent(content) {
    const text = String(content || "").trim();
    if (!text) {
      return "暂未提取到内容";
    }

    const junkPattern = /window\.__|\brequestAnimationFrame\b|function\s*\(|'use strict'|"use strict"|theme-host|__webpack|__NEXT_DATA__|gtag\(|ga\(/i;

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => !junkPattern.test(line))
      .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""));

    const result = lines.join("\n").trim();
    return result || text.slice(0, 6000) || "暂未提取到内容";
  }

  /**
   * 导出用：去掉正文里的 #～###### 标题语法，改为加粗行，避免与外层「问题 / 模型」标题层级冲突；
   * 保留列表、加粗等；合并过多空行为「段落之间空一行」。
   */
  function flattenExportBodyMarkdown(raw) {
    const text = String(raw || "").trim();
    if (!text || text === "暂未提取到内容") {
      return text || "暂未提取到内容";
    }

    const lines = text.split(/\r?\n/);
    const out = [];
    let inCodeFence = false;
    for (const line of lines) {
      const trimmedEnd = line.trimEnd();
      const trimmed = trimmedEnd.trim();
      if (trimmed.startsWith("```")) {
        inCodeFence = !inCodeFence;
        out.push(trimmedEnd);
        continue;
      }
      if (inCodeFence) {
        out.push(trimmedEnd);
        continue;
      }
      const headingMatch = trimmedEnd.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const title = headingMatch[2].trim();
        out.push(`**${title}**`);
        out.push("");
      } else {
        out.push(trimmedEnd);
      }
    }

    let result = out.join("\n");
    result = result.replace(/\n{3,}/g, "\n\n").trim();
    return result || "暂未提取到内容";
  }

  function normalizeQueryForMatch(text) {
    return String(text || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 300);
  }

  function buildExportSectionsFromConversations(cardData) {
    const cardsWithTurns = cardData.filter((c) => Array.isArray(c.turns) && c.turns.length > 0);
    if (cardsWithTurns.length === 0) return null;

    const cardPairs = cardsWithTurns.map((card) => {
      const pairs = [];
      const turns = card.turns;
      for (let i = 0; i < turns.length; i++) {
        if (turns[i].role === "user") {
          let j = i + 1;
          while (j < turns.length && turns[j].role !== "assistant") j++;
          const answer = j < turns.length ? turns[j].text : "";
          if (answer) {
            pairs.push({ question: turns[i].text, answer });
          }
        }
      }
      return { siteName: card.siteName, url: card.url, pairs };
    });

    const seenQ = new Map();
    for (const card of cardPairs) {
      for (const pair of card.pairs) {
        const norm = normalizeQueryForMatch(pair.question);
        if (!seenQ.has(norm)) {
          seenQ.set(norm, pair.question);
        }
      }
    }

    if (seenQ.size === 0) return null;

    const sections = [];
    for (const [normQ, question] of seenQ.entries()) {
      const models = [];
      for (const card of cardPairs) {
        const pair = card.pairs.find((p) => normalizeQueryForMatch(p.question) === normQ);
        if (pair) {
          models.push({ siteName: card.siteName, url: card.url, content: pair.answer });
        }
      }
      if (models.length > 0) {
        sections.push({ query: question, models });
      }
    }

    return sections.length > 0 ? sections : null;
  }

  function buildSiteNameFilter(selectedSiteIds) {
    if (!selectedSiteIds) {
      return null;
    }
    const names = new Set();
    for (const [id, ref] of state.cardRefs.entries()) {
      if (selectedSiteIds.has(id)) {
        names.add(ref.site.name);
      }
    }
    return names;
  }

  function renderSectionsToFormat(sections, format) {
    const valid = sections.filter((s) => (s.items || []).length > 0);
    if (valid.length === 0) return "";

    if (format === "markdown") {
      return valid
        .map((section) => {
          const queryLine = String(section.query || "").replace(/\r?\n/g, " ").trim();
          const timeLine = section.time ? `导出时间：${section.time}` : "";
          const modelBlocks = section.items
            .map((item) => {
              const body = flattenExportBodyMarkdown(item.content || "暂未提取到内容");
              return `## ${item.siteName}\n\n**URL：**${item.url}\n\n${body}`;
            })
            .join("\n\n");
          return [`# ${queryLine}`, timeLine, modelBlocks].filter(Boolean).join("\n\n");
        })
        .join("\n\n---\n\n");
    }

    if (format === "html") {
      const querySections = valid
        .map((section) => {
          const modelBlocks = section.items
            .map(
              (item) =>
                `<section class="model-section"><h2>${escapeHtml(item.siteName)}</h2><p><strong>URL：</strong> <a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.url)}</a></p><pre>${escapeHtml(flattenExportBodyMarkdown(item.content || "暂未提取到内容"))}</pre></section>`
            )
            .join("");
          const timeHtml = section.time ? `<p class="export-time">${escapeHtml(`导出时间：${section.time}`)}</p>` : "";
          return `<section class="query-section"><h1>${escapeHtml(section.query)}</h1>${timeHtml}${modelBlocks}</section>`;
        })
        .join("<hr>");
      return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>AI 对比结果</title><style>body{font-family:Arial,sans-serif;padding:24px;line-height:1.7}.query-section{margin-bottom:40px}.model-section{margin-bottom:28px}pre{white-space:pre-wrap;word-break:break-word;background:#f7f7f7;padding:16px;border-radius:12px}a{color:#2563eb}</style></head><body>${querySections}</body></html>`;
    }

    return valid
      .map((section) => {
        const timeStr = section.time ? `导出时间：${section.time}` : "";
        const modelBlocks = section.items
          .map((item) => {
            const body = flattenExportBodyMarkdown(item.content || "暂未提取到内容");
            return `${item.siteName}\nURL: ${item.url}\n\n${body}`;
          })
          .join("\n\n" + "-".repeat(32) + "\n\n");
        return [section.query, timeStr, modelBlocks].filter(Boolean).join("\n\n");
      })
      .join("\n\n" + "=".repeat(40) + "\n\n");
  }

  function generateExportContent(responses, format, selectedSiteIds = null) {
    const currentQuery = state.lastSearchQuery || state.searchHistory[0]?.query || "未填写问题";
    const currentTime = state.lastSearchTime || new Date().toLocaleString();

    const allowedNames = buildSiteNameFilter(selectedSiteIds);
    const filterItems = (items) =>
      allowedNames ? items.filter((r) => allowedNames.has(r.siteName)) : items;

    const allSections = [
      ...state.sessionSnapshots.map((s) => ({
        query: s.query,
        time: s.time,
        items: filterItems(s.responses)
      })),
      { query: currentQuery, time: currentTime, items: filterItems(responses) }
    ];
    return renderSectionsToFormat(allSections, format);
  }

  function generateExportPreview(responses, format, selectedSiteIds = null) {
    const full = generateExportContent(responses, format, selectedSiteIds);
    return full.length > 1600 ? `${full.slice(0, 1600)}\n\n...` : full;
  }

  function buildExportFilename(extension) {
    const query = state.lastSearchQuery || state.searchHistory[0]?.query || "";
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

    if (!query) {
      return `AI导出_${date}.${extension}`;
    }

    const keyword = query
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, " ")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 16)
      .trim()
      .replace(/\s/g, "-");

    return `${keyword}_${date}.${extension}`;
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function toggleMaximize(siteId) {
    state.maximizedSiteId = state.maximizedSiteId === siteId ? null : siteId;

    state.cardRefs.forEach((ref, id) => {
      const isMaximized = state.maximizedSiteId === id;
      const shouldHide = Boolean(state.maximizedSiteId) && !isMaximized;

      ref.cardEl.hidden = shouldHide;
      ref.cardEl.style.flexBasis = isMaximized ? "calc(100vw - 28px)" : "";
    });

    if (state.maximizedSiteId) {
      setGlobalStatus("当前卡片已最大化显示。");
    } else {
      setGlobalStatus(`已加载 ${getSelectedSites().length} 个站点。`);
    }
  }

  function buildSiteUrl(site, query) {
    const url = site.url || "";
    if (!url.includes("{query}")) {
      return url;
    }
    if (query && site.supportUrlQuery) {
      return url.replace("{query}", encodeURIComponent(query));
    }
    // 空 query 或站点不支持 URL 直达：剥离含 {query} 的参数段，回落到基础 URL
    let next = url.replace(/([?&])[^=&]+=\{query\}/g, (_, sep) => (sep === "?" ? "?" : ""));
    next = next.replace(/[?&]$/, "");
    // 兜底：万一还残留 {query}，粗暴清掉
    return next.replace(/\{query\}/g, "");
  }

  function dispatchSearchWithRetries(ref, query, initialDelayMs) {
    const requestId = createRequestId();

    return new Promise((resolve) => {
      const pendingDispatch = {
        requestId,
        ref,
        query,
        resolve,
        attempts: 0,
        maxAttempts: 3,
        retryDelayMs: BASE_CONFIG.tabSendRetryDelayMs || 1800,
        timerId: null,
        completed: false
      };

      state.pendingDispatches.set(requestId, pendingDispatch);
      scheduleDispatchAttempt(pendingDispatch, initialDelayMs);
    });
  }

  function scheduleDispatchAttempt(pendingDispatch, delayMs) {
    pendingDispatch.timerId = window.setTimeout(() => {
      if (pendingDispatch.completed) {
        return;
      }

      restoreLockedScrollPosition();

      pendingDispatch.attempts += 1;

      if (!pendingDispatch.ref.iframeEl?.contentWindow) {
        if (pendingDispatch.attempts < pendingDispatch.maxAttempts) {
          scheduleDispatchAttempt(pendingDispatch, pendingDispatch.retryDelayMs);
        } else {
          finalizePendingDispatch(pendingDispatch.requestId, {
            ok: false,
            siteId: pendingDispatch.ref.site.id,
            error: "卡片 iframe 不可用"
          });
        }
        return;
      }

      try {
        pendingDispatch.ref.iframeEl.contentWindow.postMessage(
          {
            type: "AI_COMPARE_SEARCH",
            query: pendingDispatch.query,
            site: pendingDispatch.ref.site,
            requestId: pendingDispatch.requestId
          },
          "*"
        );
        setSiteStatus(pendingDispatch.ref.site.id, "查询已发送到卡片 iframe，等待页面响应...");
        restoreLockedScrollPosition();
      } catch (error) {
        if (pendingDispatch.attempts < pendingDispatch.maxAttempts) {
          scheduleDispatchAttempt(pendingDispatch, pendingDispatch.retryDelayMs);
        } else {
          finalizePendingDispatch(pendingDispatch.requestId, {
            ok: false,
            siteId: pendingDispatch.ref.site.id,
            error: error.message
          });
        }
        return;
      }

      scheduleDispatchAttemptFailure(pendingDispatch);
    }, delayMs);
  }

  function scheduleDispatchAttemptFailure(pendingDispatch) {
    pendingDispatch.timerId = window.setTimeout(() => {
      if (pendingDispatch.completed) {
        return;
      }

      finalizePendingDispatch(pendingDispatch.requestId, {
        ok: false,
        siteId: pendingDispatch.ref.site.id,
        error: "自动发送超时，未收到卡片页面响应"
      });
    }, pendingDispatch.retryDelayMs);
  }

  function resolvePendingDispatch(requestId, payload) {
    const pendingDispatch = state.pendingDispatches.get(requestId);
    if (!pendingDispatch || pendingDispatch.completed) {
      return;
    }

    finalizePendingDispatch(requestId, payload);
  }

  function finalizePendingDispatch(requestId, result) {
    const pendingDispatch = state.pendingDispatches.get(requestId);
    if (!pendingDispatch || pendingDispatch.completed) {
      return;
    }

    pendingDispatch.completed = true;
    if (pendingDispatch.timerId) {
      window.clearTimeout(pendingDispatch.timerId);
    }
    state.pendingDispatches.delete(requestId);
    restoreLockedScrollPosition();
    pendingDispatch.resolve(result);
  }

  function createRequestId() {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }

    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function clearAutoSendFlagFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("autosend");
    history.replaceState({}, "", url.toString());
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();
