(function initComparePage() {
  const BASE_CONFIG = globalThis.AI_COMPARE_BASE_CONFIG || {};
  const STORAGE_KEYS = {
    cardSizeLevel: "cardSizeLevel",
    layoutRows: "layoutRows",
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
    searchHistory: [],
    currentHistoryEntryId: null,
    promptGroups: [],
    activePromptGroupId: null,
    isPromptPickerOpen: false,
    lockedScrollLeft: null,
    scrollUnlockTimerId: null,
    isScrollLocked: false,
    scrollLockFrameId: null
  };

  const elements = {};

  document.addEventListener("DOMContentLoaded", start);
  window.addEventListener("message", handleFrameMessage);

  async function start() {
    try {
      cacheElements();
      bindEvents();
      hydrateQueryFromUrl();
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
  }

  function bindEvents() {
    elements.sendSelectedBtn.addEventListener("click", handleSendSelected);
    elements.promptAssistBtn?.addEventListener("click", (event) => {
      event.stopPropagation();
      togglePromptPicker();
    });
    elements.queryInput.addEventListener("input", () => {
      closePromptPicker();
    });
    elements.queryInput.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }

      event.preventDefault();
      await handleSendSelected();
    });
    elements.exportBtn.addEventListener("click", showExportModal);
    elements.historyToggleBtn.addEventListener("click", toggleHistoryPanel);
    elements.closeHistoryPanelBtn.addEventListener("click", () => {
      elements.historyPanel.hidden = true;
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

    elements.iframesContainer.addEventListener("scroll", () => {
      if (state.isScrollLocked) {
        restoreLockedScrollPosition();
      }
    }, { passive: true });

    elements.iframesContainer.addEventListener("wheel", (event) => {
      if (state.isScrollLocked) {
        event.preventDefault();
        restoreLockedScrollPosition();
      }
    }, { passive: false });

    window.addEventListener("resize", () => {
      updateLayoutUi();
    });
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
      STORAGE_KEYS.searchHistory,
      STORAGE_KEYS.promptGroups
    ]);

    if (typeof stored[STORAGE_KEYS.cardSizeLevel] === "string") {
      state.cardSizeLevel = stored[STORAGE_KEYS.cardSizeLevel];
    }
    if (typeof stored[STORAGE_KEYS.layoutRows] === "number") {
      state.layoutRows = stored[STORAGE_KEYS.layoutRows];
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
      [STORAGE_KEYS.searchHistory]: state.searchHistory
    });
  }

  async function loadSites() {
    const response = await fetch(chrome.runtime.getURL("config/siteHandlers.json"));
    if (!response.ok) {
      throw new Error("无法加载站点配置");
    }

    const payload = await response.json();
    const allSites = (payload.sites || []).filter((site) => site.enabled !== false);
    if (state.requestedSiteIds && state.requestedSiteIds.size > 0) {
      state.sites = allSites.filter((site) => state.requestedSiteIds.has(site.id));
    } else {
      state.sites = allSites;
    }
    state.hiddenSiteIds.clear();
  }

  function renderCards() {
    elements.iframesContainer.innerHTML = "";
    elements.iframesContainer.dataset.columns = "1";
    elements.iframesContainer.dataset.layoutRows = String(state.layoutRows);
    state.cardRefs.clear();

    const selectedSites = getSelectedSites();
    if (selectedSites.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "empty-state";
      emptyState.textContent = "请先选择至少一个站点。";
      elements.iframesContainer.appendChild(emptyState);
      return;
    }

    selectedSites.forEach((site) => {
      const card = createSiteCard(site);
      if (isWideMediaSite(site.id)) {
        card.classList.add("iframe-card-wide-media");
      }
      elements.iframesContainer.appendChild(card);
    });
  }

  function createSiteCard(site) {
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
    createIframeBody(ref);

    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(hoverActions);
    return card;
  }

  function refreshSiteCard(ref) {
    if (ref.iframeEl && ref.bodyEl.contains(ref.iframeEl)) {
      const src = ref.iframeEl.src;
      ref.loaded = false;
      ref.iframeEl.src = src;
      setSiteStatus(ref.site.id, "正在重新加载…");
      return;
    }
    createIframeBody(ref);
    setSiteStatus(ref.site.id, "正在重新加载…");
  }

  function createIframeBody(ref) {
    const iframe = document.createElement("iframe");
    iframe.className = "ai-iframe";
    iframe.dataset.siteId = ref.site.id;
    iframe.src = buildSiteUrl(ref.site, "");
    iframe.loading = "eager";
    iframe.allow = "clipboard-read; clipboard-write; microphone; camera; geolocation; autoplay; fullscreen; picture-in-picture; storage-access; web-share";
    iframe.addEventListener("focus", restoreLockedScrollPosition, true);
    iframe.addEventListener("mouseenter", restoreLockedScrollPosition);

    let resolved = false;
    iframe.addEventListener("load", () => {
      resolved = true;
      ref.loaded = true;
      ref.currentUrl = iframe.src || ref.site.url;
      setSiteStatus(ref.site.id, "iframe 已加载，可直接在卡片内操作。");

      if (ref.pendingQuery) {
        const queuedQuery = ref.pendingQuery;
        const queuedResolver = ref.pendingQueryResolver;
        ref.pendingQuery = "";
        ref.pendingQueryResolver = null;
        dispatchSearchWithRetries(ref, queuedQuery, BASE_CONFIG.postLoadSendDelayMs || 250)
          .then((result) => {
            if (typeof queuedResolver === "function") {
              queuedResolver(result);
            }
          });
      }
    });

    ref.bodyEl.innerHTML = "";
    ref.bodyEl.appendChild(iframe);
    ref.iframeEl = iframe;

    setTimeout(() => {
      if (!resolved) {
        renderFallback(ref, "站点未能在限定时间内完成 iframe 加载。可能仍被目标站点限制嵌入。");
      }
    }, BASE_CONFIG.embedTimeoutMs || 8000);
  }

  function renderFallback(ref, message) {
    ref.bodyEl.innerHTML = `
      <div class="fallback-panel">
        <div class="warning-box">
          <strong>当前卡片未能完成嵌入</strong>
        </div>
        <p>${escapeHtml(message || ref.site.notes || "该站点可能限制 iframe 嵌入。")}</p>
        <div class="inline-action-row">
          <button class="site-action-btn" type="button" data-open-site="${escapeHtml(ref.site.url)}">在新标签页打开</button>
        </div>
      </div>
    `;
    ref.iframeEl = null;
    ref.loaded = false;
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
    const { clearInputAfterSend = false } = options;
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

    lockContainerScroll();
    toggleGlobalButtons(true);
    setGlobalStatus(`正在向 ${selectedSites.length} 个站点分发问题...`);

    const results = await Promise.all(selectedSites.map((site) => sendSmartToSite(site, query)));
    const successCount = results.filter((item) => item && item.ok).length;
    const failedCount = results.length - successCount;

    await saveSearchHistory(query, selectedSites);
    setGlobalStatus(`发送完成：成功 ${successCount} 个，失败 ${failedCount} 个。`, failedCount > 0);
    if (clearInputAfterSend) {
      elements.queryInput.value = "";
    }
    toggleGlobalButtons(false);
    scheduleScrollUnlock();
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

    if (!ref.loaded) {
      return new Promise((resolve) => {
        ref.pendingQuery = query;
        ref.pendingQueryResolver = resolve;
        setSiteStatus(site.id, "卡片加载中，完成后将自动发送...");
      });
    }

    return dispatchSearchWithRetries(ref, query, 120);
  }

  function handleFrameMessage(event) {
    const payload = event.data;
    if (!payload || !payload.type || !payload.siteId) {
      return;
    }

    if (payload.type === "AI_COMPARE_URL_UPDATE") {
      const ref = state.cardRefs.get(payload.siteId);
      if (ref && payload.currentUrl) {
        ref.currentUrl = payload.currentUrl;
        updateLatestHistoryUrl(payload.siteId, payload.currentUrl);
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
      stopScrollLockLoop();
      return;
    }

    state.lockedScrollLeft = elements.iframesContainer.scrollLeft;
    state.isScrollLocked = true;
    restoreLockedScrollPosition();
    startScrollLockLoop();
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
      stopScrollLockLoop();
      state.scrollUnlockTimerId = null;
      return;
    }

    state.scrollUnlockTimerId = window.setTimeout(() => {
      state.lockedScrollLeft = null;
      state.isScrollLocked = false;
      stopScrollLockLoop();
      state.scrollUnlockTimerId = null;
    }, 2200);
  }

  function startScrollLockLoop() {
    if (state.scrollLockFrameId !== null) {
      return;
    }

    const tick = () => {
      if (!state.isScrollLocked) {
        state.scrollLockFrameId = null;
        return;
      }

      restoreLockedScrollPosition();
      state.scrollLockFrameId = window.requestAnimationFrame(tick);
    };

    state.scrollLockFrameId = window.requestAnimationFrame(tick);
  }

  function stopScrollLockLoop() {
    if (state.scrollLockFrameId !== null) {
      window.cancelAnimationFrame(state.scrollLockFrameId);
      state.scrollLockFrameId = null;
    }
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
    const singleRowWidthMap = {
      small: 480,
      medium: 640,
      large: 960
    };

    let effectiveWidth = singleRowWidthMap[state.cardSizeLevel] || singleRowWidthMap.medium;
    let rowHeight = "calc(100vh - 132px)";
    if (state.layoutRows > 1) {
      rowHeight = state.layoutRows === 2
        ? "calc(100vh - 170px)"
        : "calc(100vh - 190px)";
    }

    state.lockedScrollLeft = null;
    state.isScrollLocked = false;
    stopScrollLockLoop();
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
  }

  function toggleHistoryPanel() {
    elements.historyPanel.hidden = !elements.historyPanel.hidden;
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
    renderPromptPicker();
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
        const button = document.createElement("button");
        button.type = "button";
        button.className = "popup-prompt-item";
        button.textContent = prompt.title || "未命名提示词";
        button.addEventListener("click", () => {
          elements.queryInput.value = prompt.content || "";
          closePromptPicker();
          elements.queryInput.focus();
        });
        promptsColumn.appendChild(button);
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

      item.appendChild(title);
      item.appendChild(meta);
      item.appendChild(links);
      item.addEventListener("click", () => {
        elements.queryInput.value = entry.query;
        elements.historyPanel.hidden = true;
      });
      elements.historyList.appendChild(item);
    });
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
          <h3 class="export-modal-title">导出AI比一比结果</h3>
          <button class="export-close-btn" type="button">×</button>
        </div>
        <div class="export-warning-box">⚠ 功能在开发中，可能会有错误或不足</div>
        <div class="export-section">
          <div class="export-section-title">导出格式</div>
          <div class="export-option-row">
            <button class="export-option-btn is-active" data-export-format="markdown">Markdown</button>
            <button class="export-option-btn" data-export-format="txt">纯文本</button>
            <button class="export-option-btn" data-export-format="html">HTML</button>
          </div>
        </div>
        <div class="export-section">
          <div class="export-section-title">选择站点</div>
          <div class="export-site-list"></div>
        </div>
        <div class="export-section">
          <div class="export-section-title">预览</div>
          <pre class="export-preview">正在生成预览...</pre>
        </div>
        <div class="export-actions">
          <button class="export-cancel-btn" type="button">取消</button>
          <button class="export-confirm-btn" type="button">导出</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const siteList = modal.querySelector(".export-site-list");
    const preview = modal.querySelector(".export-preview");

    Array.from(state.cardRefs.values()).forEach((ref) => {
      const row = document.createElement("label");
      row.className = "export-site-item";
      row.innerHTML = `
        <input type="checkbox" checked data-site-id="${escapeHtml(ref.site.id)}" />
        <span>${escapeHtml(ref.site.name)}</span>
      `;

      const checkbox = row.querySelector("input");
      checkbox.addEventListener("change", async () => {
        if (checkbox.checked) {
          selectedSiteIds.add(ref.site.id);
        } else {
          selectedSiteIds.delete(ref.site.id);
        }
        await updateExportPreview(preview, selectedFormat, selectedSiteIds);
      });

      siteList.appendChild(row);
    });

    modal.querySelectorAll("[data-export-format]").forEach((button) => {
      button.addEventListener("click", async () => {
        selectedFormat = button.dataset.exportFormat;
        modal.querySelectorAll("[data-export-format]").forEach((item) => {
          item.classList.toggle("is-active", item === button);
        });
        await updateExportPreview(preview, selectedFormat, selectedSiteIds);
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
      const content = generateExportContent(responses, selectedFormat);
      const extension = selectedFormat === "markdown" ? "md" : selectedFormat;
      const mimeType = selectedFormat === "html" ? "text/html" : "text/plain";
      downloadFile(content, `ai-compare-export.${extension}`, mimeType);
      closeModal();
    });

    updateExportPreview(preview, selectedFormat, selectedSiteIds);
  }

  async function updateExportPreview(previewElement, format, selectedSiteIds) {
    previewElement.textContent = "正在生成预览...";
    const responses = await collectVisibleResponses(selectedSiteIds);
    previewElement.textContent = generateExportPreview(responses, format);
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
          url: site.url
        });
        return;
      }

      window.setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve({
          siteName: site.name,
          content: "暂未提取到内容",
          url: site.url
        });
      }, 3000);
    });
  }

  function cleanExtractedContent(content) {
    const text = String(content || "").trim();
    if (!text) {
      return "暂未提取到内容";
    }

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/window\.__|requestAnimationFrame|function\s*\(|use strict|theme-host/i.test(line));

    const result = lines.join("\n\n").trim();
    return result || text.slice(0, 4000) || "暂未提取到内容";
  }

  function generateExportContent(responses, format) {
    const query = getQuery() || "未填写问题";
    const time = new Date().toLocaleString();

    if (format === "markdown") {
      return `# AI 对比结果\n\n> 问题：${query}\n> 导出时间：${time}\n\n${responses.map((item) => `## ${item.siteName}\n\n**URL:** ${item.url}\n\n${item.content || "暂未提取到内容"}`).join("\n\n---\n\n")}`;
    }

    if (format === "html") {
      return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>AI 对比结果</title><style>body{font-family:Arial,sans-serif;padding:24px;line-height:1.7}section{margin-bottom:28px}pre{white-space:pre-wrap;word-break:break-word;background:#f7f7f7;padding:16px;border-radius:12px}</style></head><body><h1>AI 对比结果</h1><p><strong>问题：</strong>${escapeHtml(query)}</p><p><strong>导出时间：</strong>${escapeHtml(time)}</p>${responses.map((item) => `<section><h2>${escapeHtml(item.siteName)}</h2><p><strong>URL:</strong> ${escapeHtml(item.url)}</p><pre>${escapeHtml(item.content || "暂未提取到内容")}</pre></section>`).join("")}</body></html>`;
    }

    return `AI 对比结果\n\n问题：${query}\n导出时间：${time}\n\n${responses.map((item) => `${item.siteName}\nURL: ${item.url}\n\n${item.content || "暂未提取到内容"}`).join("\n\n====================\n\n")}`;
  }

  function generateExportPreview(responses, format) {
    const full = generateExportContent(responses, format);
    return full.length > 1600 ? `${full.slice(0, 1600)}\n\n...` : full;
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
    if (query && site.supportUrlQuery && site.url.includes("{query}")) {
      return site.url.replace("{query}", encodeURIComponent(query));
    }

    return site.url;
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
        maxAttempts: 6,
        retryDelayMs: BASE_CONFIG.tabSendRetryDelayMs || 350,
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

      try {
        if (!pendingDispatch.ref.iframeEl?.contentWindow) {
          finalizePendingDispatch(pendingDispatch.requestId, {
            ok: false,
            siteId: pendingDispatch.ref.site.id,
            error: "卡片 iframe 不可用"
          });
          return;
        }

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
        finalizePendingDispatch(pendingDispatch.requestId, {
          ok: false,
          siteId: pendingDispatch.ref.site.id,
          error: error.message
        });
        return;
      }

      if (pendingDispatch.attempts >= pendingDispatch.maxAttempts) {
        scheduleDispatchAttemptFailure(pendingDispatch);
      } else {
        scheduleDispatchAttempt(pendingDispatch, pendingDispatch.retryDelayMs);
      }
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
