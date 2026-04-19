(function initPopup() {
  const SEARCH_GROUPS_STORAGE_KEY = "searchGroups";
  const SEARCH_HISTORY_STORAGE_KEY = "searchHistory";
  const PROMPT_GROUPS_STORAGE_KEY = "promptGroups";
  const UI_PREFS_STORAGE_KEY = "uiPrefs";
  const CUSTOM_SITES_STORAGE_KEY = "customSites";
  const RANDOM_QUESTIONS = [
    "第一性原理是什么？给我举 3 个生活中的例子",
    "如何用 AI 快速学习一个陌生领域？",
    "什么样的问题 AI 回答得最好？什么最差？",
    "为什么痛苦比快乐更容易被记住？",
    "用一个比喻解释“复利思维”",
    "推荐 3 个科学验证过的提升注意力的方法",
    "解释一下“奥卡姆剃刀原则”，并告诉我什么时候不适用",
    "为什么有些道理听懂了，却做不到？",
    "把“内耗”拆成情绪、认知、行为三个层面来讲",
    "如果我要在 30 天内入门一个陌生领域，你会怎么帮我设计学习路径？",
    "如果我总是学了就忘，AI 可以怎么帮我建立复习系统？",
    "现代人最常见的 3 种“伪成长”是什么",
    "什么样的问题最能激发 AI 给出高质量回答？",
    "怎么让 AI 在学习、写作、思考中扮演不同角色？",
    "一个好 prompt 的核心结构通常是什么？",
    "如果让苏格拉底来分析“刷短视频停不下来”，他会怎么提问？",
    "告诉我：关于这件事，未来我最可能后悔没早点知道什么？",
    "给我 10 个稀奇但有用的问题，专门用来打破思维惯性。",
    "帮我挖掘出我的优点和缺点",
    "你觉得我现在最该认真解决的一个问题，可能是什么？",
    "给我一个今天值得想一想的问题。",
    "帮我找出我现在最可能忽略的一件事。",
    "如果你只能提醒我一件会影响未来半年的事，你会提醒什么？",
    "我现在最值得做的那个 80/20 动作是什么？",
    "站在一年后的我看，现在最不该拖延的是什么？",
    "给我一个能快速提升生活质量的小改变。",
    "把我最近可能很混乱的事情，整理成 3 种可能方向。",
    "告诉我一个我以为很重要、其实没那么重要的东西。",
    "给我一个反直觉但值得试试的建议。",
    "用最直白的话告诉我：我现在最需要看清什么？",
    "这件事背后真正的问题通常是什么？先给我 3 种常见答案。",
    "我该停止什么，才能让自己轻松一点？",
    "现在最值得我补上的一个能力是什么？为什么？",
    "当时时代互联网常见的情绪煽动点有哪些",
    "教我怎样向 AI 提问，才能把这个主题学得更快更扎实。",
    "如何把新时代的 AI 知识点和我已经会的东西建立连接，让我更容易记住。",
    "告诉我这个主题最常见的 3 个混淆点，并教我怎么区分。",
    "什么问题其实不应该直接问 AI，而应该先自己想一遍？",
    "如何把 AI 用成一个真正会启发思考的学习伙伴？",
    "让 AI 帮我学习时，怎样提要求才能避免它讲得空泛？",
    "请用二八定律帮我分析：在工作、学习和副业这三个方面，最值得优先投入的 20% 动作，可能分别是什么？",
    "请用投射效应分析：为什么人会把自己的情绪和想法，不自觉地套到别人身上？",
    "请用边界感这个概念解释：为什么有些人总活得很累，是因为太容易被别人影响？",
    "请用峰终定律分析：为什么一段经历最后给人的印象，常常不是平均感受，而是高峰和结尾？",
    "请用稀缺心态解释：为什么当人觉得时间不够、钱不够、机会不够时，反而更容易做错决定？",
    "请用比较心理分析：为什么人一旦总盯着别人看，幸福感会明显下降？",
    "请用社会认同解释：为什么很多人明明没有那么喜欢一个东西，却还是会跟着大家一起追？"
  ];

  const queryInput = document.getElementById("popupQueryInput");
  const composer = document.querySelector(".search-composer");
  const groupsContainer = document.getElementById("popupGroups");
  const historyList = document.getElementById("popupHistoryList");
  const historySection = document.querySelector(".popup-history-section");
  const openSettingsBtn = document.getElementById("openSettingsBtn");
  const randomPromptBtn = document.getElementById("randomPromptBtn");
  const promptEntryBtn = document.getElementById("promptEntryBtn");
  const composerActionsRow = document.querySelector(".composer-actions-row");
  const promptPicker = document.getElementById("promptPicker");

  let groups = [];
  let promptGroups = [];
  let allSites = [];
  let uiPrefs = createNormalizedUiPrefs();
  let activePromptGroupId = null;
  let isPromptPickerOpen = false;
  let composerResizeObserver = null;

  document.addEventListener("DOMContentLoaded", start);
  chrome.storage.onChanged.addListener(handleStorageChange);

  async function start() {
    await refreshAllSites();
    await Promise.all([refreshGroups(), refreshPromptGroups(), refreshUiPrefs(), refreshHistory()]);
    bindPromptPickerEvents();
    bindComposerLayoutEvents();
    syncComposerLayout();
    queryInput.focus();
    triggerPrewarm();
  }

  function triggerPrewarm() {
    if (uiPrefs.prewarmEnabled === false) {
      return;
    }
    try {
      chrome.runtime.sendMessage({ type: "WARMUP_AI_SITES" })
        .catch(() => {});
    } catch (_err) {
      // popup 立即关闭等情况下忽略
    }
  }

  openSettingsBtn.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE" });
    window.close();
  });

  randomPromptBtn?.addEventListener("click", () => {
    closePromptPicker();
    fillRandomQuestion();
  });

  promptEntryBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePromptPicker();
  });




  queryInput.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    await runDefaultSearch();
  });

  async function handleStorageChange(changes, areaName) {
    if (areaName !== "local") {
      return;
    }

    if (changes[SEARCH_GROUPS_STORAGE_KEY]) {
      await refreshGroups();
    }

    if (changes[PROMPT_GROUPS_STORAGE_KEY]) {
      await refreshPromptGroups();
    }

    if (changes[UI_PREFS_STORAGE_KEY]) {
      await refreshUiPrefs();
    }

    if (changes[SEARCH_HISTORY_STORAGE_KEY]) {
      await refreshHistory();
    }
  }

  async function refreshGroups() {
    groups = await loadGroups();
    renderGroups(groups);
  }

  async function refreshPromptGroups() {
    promptGroups = await loadPromptGroups();
    if (!promptGroups.some((group) => group.id === activePromptGroupId)) {
      activePromptGroupId = promptGroups[0]?.id || null;
    }
    renderPromptPicker();
  }

  async function refreshUiPrefs() {
    uiPrefs = await loadUiPrefs();
    applyUiPrefs();
  }

  async function refreshHistory() {
    const history = await loadHistory();
    renderHistory(history);
  }

  function renderGroups(groupList) {
    groupsContainer.innerHTML = "";
    groupsContainer.hidden = groupList.length === 0;

    groupList.forEach((group) => {
      const button = document.createElement("button");
      button.className = "popup-group-btn";
      button.type = "button";
      button.innerHTML = `<span class="popup-group-name">${escapeHtml(group.name)}</span>`;

      const siteNames = (group.siteIds || [])
        .map((id) => allSites.find((s) => s.id === id)?.name)
        .filter(Boolean)
        .join("、");

      if (siteNames) {
        button.addEventListener("mouseenter", () => showGroupTooltip(button, siteNames));
        button.addEventListener("mouseleave", () => hideGroupTooltip());
      }

      button.addEventListener("click", async () => {
        hideGroupTooltip();
        await runGroup(group);
      });
      groupsContainer.appendChild(button);
    });
  }

  // ── 搜索组 tooltip ──
  let _groupTooltipEl = null;
  let _groupTooltipTimer = null;

  function getOrCreateGroupTooltip() {
    if (!_groupTooltipEl) {
      _groupTooltipEl = document.createElement("div");
      _groupTooltipEl.className = "group-tooltip";
      document.body.appendChild(_groupTooltipEl);
    }
    return _groupTooltipEl;
  }

  function showGroupTooltip(button, siteNames) {
    if (_groupTooltipTimer) { clearTimeout(_groupTooltipTimer); _groupTooltipTimer = null; }
    _groupTooltipTimer = setTimeout(() => {
      const tooltip = getOrCreateGroupTooltip();
      tooltip.textContent = siteNames;
      tooltip.style.display = "block";
      requestAnimationFrame(() => {
        const btnRect = button.getBoundingClientRect();
        const tooltipW = tooltip.offsetWidth;
        const tooltipH = tooltip.offsetHeight;
        let left = btnRect.left + btnRect.width / 2 - tooltipW / 2;
        if (left < 4) left = 4;
        if (left + tooltipW > window.innerWidth - 4) left = window.innerWidth - tooltipW - 4;
        const top = btnRect.top - tooltipH - 6;
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      });
    }, 1000);
  }

  function hideGroupTooltip() {
    if (_groupTooltipTimer) { clearTimeout(_groupTooltipTimer); _groupTooltipTimer = null; }
    if (_groupTooltipEl) {
      _groupTooltipEl.style.display = "none";
    }
  }

  async function refreshAllSites() {
    try {
      const [builtinResp, stored] = await Promise.all([
        fetch(chrome.runtime.getURL("config/siteHandlers.json")),
        chrome.storage.local.get([CUSTOM_SITES_STORAGE_KEY])
      ]);
      const payload = await builtinResp.json();
      const builtin = (payload.sites || []).filter((s) => s.enabled !== false);
      const custom = Array.isArray(stored[CUSTOM_SITES_STORAGE_KEY]) ? stored[CUSTOM_SITES_STORAGE_KEY] : [];
      const knownIds = new Set(builtin.map((s) => s.id));
      const merged = [...builtin];
      custom.forEach((s) => { if (s && !knownIds.has(s.id)) { merged.push(s); knownIds.add(s.id); } });
      allSites = merged;
    } catch (_e) {
      allSites = [];
    }
  }

  function renderPromptPicker() {
    updatePromptPickerLayoutState();

    if (!promptPicker || !promptEntryBtn || uiPrefs.showPromptButton === false) {
      if (promptPicker) {
        promptPicker.hidden = true;
      }
      updatePromptPickerLayoutState();
      return;
    }

    promptPicker.innerHTML = "";
    promptEntryBtn.setAttribute("aria-expanded", String(isPromptPickerOpen));

    if (!isPromptPickerOpen) {
      promptPicker.hidden = true;
      updatePromptPickerLayoutState();
      return;
    }

    promptPicker.hidden = false;

    if (!promptGroups.length) {
      const empty = document.createElement("div");
      empty.className = "popup-prompt-picker-empty";
      empty.textContent = "还没有提示词分组，请先去设置里添加。";
      promptPicker.appendChild(empty);
      updatePromptPickerLayoutState();
      return;
    }

    const activeGroup = promptGroups.find((group) => group.id === activePromptGroupId) || promptGroups[0];
    if (!activeGroup) {
      updatePromptPickerLayoutState();
      return;
    }

    const groupsColumn = document.createElement("div");
    groupsColumn.className = "popup-prompt-groups";

    promptGroups.forEach((group) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `popup-prompt-group-item${group.id === activeGroup.id ? " is-active" : ""}`;
      button.textContent = group.name || "未命名分组";
      button.addEventListener("mouseenter", () => {
        if (activePromptGroupId === group.id) {
          return;
        }
        activePromptGroupId = group.id;
        renderPromptPicker();
      });
      button.addEventListener("click", () => {
        activePromptGroupId = group.id;
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

        // 标题（点击填入）
        const label = document.createElement("span");
        label.className = "popup-prompt-item-label";
        label.textContent = prompt.title || "未命名提示词";
        label.addEventListener("click", () => {
          queryInput.value = prompt.content || "";
          closePromptPicker();
          queryInput.focus();
        });

        // 右侧：铅笔 + 眼睛
        const rightIcons = document.createElement("div");
        rightIcons.className = "popup-prompt-edit-wrap";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "popup-prompt-icon-btn";
        editBtn.setAttribute("aria-label", "编辑");
        editBtn.title = "编辑";
        editBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" d="M4 22h16" opacity=".5"/><path d="m14.63 2.921l-.742.742l-6.817 6.817c-.462.462-.693.692-.891.947a5.2 5.2 0 0 0-.599.969c-.139.291-.242.601-.449 1.22l-.875 2.626l-.213.641a.848.848 0 0 0 1.073 1.073l.641-.213l2.625-.875c.62-.207.93-.31 1.221-.45q.518-.246.969-.598c.255-.199.485-.43.947-.891l6.817-6.817l.742-.742a3.146 3.146 0 0 0-4.45-4.449Z"/><path d="M13.888 3.664S13.98 5.24 15.37 6.63s2.966 1.483 2.966 1.483m-12.579 9.63l-1.5-1.5" opacity=".5"/></svg>`;
        editBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          openPopupPromptEditModal(prompt, activeGroup.id);
        });

        const previewBtn = document.createElement("button");
        previewBtn.type = "button";
        previewBtn.className = "popup-prompt-icon-btn";
        previewBtn.setAttribute("aria-label", "预览");
        previewBtn.title = "预览";
        previewBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
        previewBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          openPopupPromptPreviewModal(prompt);
        });

        rightIcons.appendChild(previewBtn);
        rightIcons.appendChild(editBtn);

        item.appendChild(label);
        item.appendChild(rightIcons);
        promptsColumn.appendChild(item);
      });
    }

    promptPicker.appendChild(groupsColumn);
    promptPicker.appendChild(promptsColumn);

    const footer = document.createElement("div");
    footer.className = "popup-prompt-picker-footer";
    const settingsLink = document.createElement("button");
    settingsLink.type = "button";
    settingsLink.className = "popup-prompt-picker-settings-btn";
    settingsLink.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>管理提示词`;
    settingsLink.addEventListener("click", async (e) => {
      e.stopPropagation();
      await chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE", section: "prompts" });
      window.close();
    });
    footer.appendChild(settingsLink);
    promptPicker.appendChild(footer);

    updatePromptPickerLayoutState();
  }

  // ── popup 预览浮层 ──
  let _popupPreviewEl = null;
  let _popupPreviewHideTimer = null;

  function getOrCreatePopupPreviewEl() {
    if (!_popupPreviewEl) {
      _popupPreviewEl = document.createElement("div");
      _popupPreviewEl.className = "popup-prompt-preview-popup";
      _popupPreviewEl.addEventListener("mouseenter", () => {
        if (_popupPreviewHideTimer) { clearTimeout(_popupPreviewHideTimer); _popupPreviewHideTimer = null; }
      });
      _popupPreviewEl.addEventListener("mouseleave", () => {
        _popupPreviewHideTimer = setTimeout(() => hidePopupPromptPreview(), 320);
      });
      document.body.appendChild(_popupPreviewEl);
    }
    return _popupPreviewEl;
  }

  function showPopupPromptPreview(anchorBtn, prompt) {
    const popup = getOrCreatePopupPreviewEl();
    popup.innerHTML = `<div class="popup-prompt-preview-title">${escapeHtml(prompt.title || "未命名提示词")}</div><div class="popup-prompt-preview-body">${escapeHtml(prompt.content || "（暂无内容）")}</div>`;
    popup.style.display = "block";
    popup.classList.add("is-visible");
    requestAnimationFrame(() => {
      const btnRect = anchorBtn.getBoundingClientRect();
      const pickerEl = document.getElementById("promptPicker");
      const pickerRect = pickerEl ? pickerEl.getBoundingClientRect() : btnRect;
      const popupW = popup.offsetWidth || 260;
      const popupH = popup.offsetHeight || 160;
      // 优先右侧，没空间则左侧
      let left = pickerRect.right + 8;
      if (left + popupW > window.innerWidth - 4) left = pickerRect.left - popupW - 8;
      if (left < 4) left = 4;
      let top = btnRect.top + btnRect.height / 2 - popupH / 2;
      if (top < 4) top = 4;
      if (top + popupH > window.innerHeight - 4) top = window.innerHeight - popupH - 4;
      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;
    });
  }

  function hidePopupPromptPreview() {
    if (_popupPreviewEl) {
      _popupPreviewEl.style.display = "none";
      _popupPreviewEl.classList.remove("is-visible");
    }
    if (_popupPreviewHideTimer) { clearTimeout(_popupPreviewHideTimer); _popupPreviewHideTimer = null; }
  }

  // ── popup 预览弹窗 ──
  function openPopupPromptPreviewModal(prompt) {

    const overlay = document.createElement("div");
    overlay.className = "prompt-edit-modal-overlay";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.28);display:flex;align-items:flex-start;justify-content:center;padding:16px;z-index:10000;overflow-y:auto;";

    const modal = document.createElement("div");
    modal.style.cssText = "width:100%;margin:auto;background:#fff;border-radius:6px;padding:18px;display:flex;flex-direction:column;gap:10px;box-shadow:0 16px 40px rgba(0,0,0,.16);position:relative;";
    modal.innerHTML = `
      <button class="ppv-close" style="position:absolute;top:12px;right:12px;width:24px;height:24px;padding:0;border:none;background:transparent;color:#999;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:4px;" aria-label="关闭">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
      <div style="font-size:15px;font-weight:600;color:#111;line-height:1.4;padding-right:28px;">${escapeHtml(prompt.title || "未命名提示词")}</div>
      <div style="height:1px;background:rgba(0,0,0,.08);"></div>
      <div style="font-size:13px;line-height:1.7;color:#444;white-space:pre-wrap;word-break:break-word;">${escapeHtml(prompt.content || "（暂无内容）")}</div>
    `;

    const prevBodyBg = document.body.style.background;
    const popupShell = document.querySelector(".popup-shell");
    const prevShellBg = popupShell ? popupShell.style.background : "";
    const prevMinHeight = document.body.style.minHeight;
    const popupActions = document.querySelector(".popup-actions");
    const prevActionsDisplay = popupActions ? popupActions.style.display : "";

    function closeModal() {
      overlay.remove();
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.minHeight = prevMinHeight;
      document.body.style.background = prevBodyBg;
      if (popupShell) popupShell.style.background = prevShellBg;
      if (popupActions) popupActions.style.display = prevActionsDisplay;
    }

    modal.querySelector(".ppv-close").addEventListener("click", (e) => { e.stopPropagation(); closeModal(); });
    overlay.addEventListener("click", (e) => { e.stopPropagation(); if (e.target === overlay) closeModal(); });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = "visible";
    document.body.style.overflow = "visible";
    document.body.style.minHeight = "440px";
    document.body.style.background = "#ffffff";
    if (popupShell) popupShell.style.background = "#ffffff";
    if (popupActions) popupActions.style.display = "none";
  }

  // ── popup 编辑弹窗 ──
  function openPopupPromptEditModal(prompt, groupId) {
    closePromptPicker();
    const targetGroup = promptGroups.find((g) => g.id === groupId) || promptGroups[0];
    const targetPrompt = targetGroup?.prompts.find((p) => p.id === prompt.id);
    if (!targetPrompt) return;

    const overlay = document.createElement("div");
    overlay.className = "prompt-edit-modal-overlay";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.28);display:flex;align-items:flex-start;justify-content:center;padding:16px;z-index:10000;overflow-y:auto;";

    const modal = document.createElement("div");
    modal.style.cssText = "width:100%;margin:auto;background:#fff;border-radius:6px;padding:18px;display:flex;flex-direction:column;gap:10px;box-shadow:0 16px 40px rgba(0,0,0,.16);";
    modal.innerHTML = `
      <div style="font-size:14px;font-weight:600;color:#111;margin-bottom:2px;">编辑提示词</div>
      <div>
        <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">名称</label>
        <input class="pep-title" type="text" value="${escapeHtml(targetPrompt.title || "")}" style="width:100%;height:34px;padding:0 10px;border:1px solid #ddd;border-radius:4px;font:inherit;font-size:13px;color:#111;outline:none;" />
      </div>
      <div>
        <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">分类</label>
        <select class="pep-group" style="width:100%;height:34px;padding:0 8px;border:1px solid #ddd;border-radius:4px;font:inherit;font-size:13px;color:#111;outline:none;">
          ${promptGroups.map((g) => `<option value="${escapeHtml(g.id)}"${g.id === groupId ? " selected" : ""}>${escapeHtml(g.name || "未命名分组")}</option>`).join("")}
          <option value="__new__">＋ 新建分组…</option>
        </select>
        <input class="pep-newgroup" type="text" placeholder="输入新分组名称" style="display:none;width:100%;height:34px;padding:0 10px;border:1px solid #ddd;border-radius:4px;font:inherit;font-size:13px;color:#111;outline:none;margin-top:6px;" />
      </div>
      <div>
        <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">提示词内容</label>
        <textarea class="pep-content" style="width:100%;min-height:120px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font:inherit;font-size:13px;color:#111;outline:none;resize:vertical;line-height:1.6;">${escapeHtml(targetPrompt.content || "")}</textarea>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px;">
        <button class="pep-delete" style="height:32px;padding:0 12px;border:none;border-radius:4px;background:#fee2e2;color:#dc2626;font:inherit;font-size:13px;font-weight:500;cursor:pointer;">删除</button>
        <div style="display:flex;gap:6px;">
          <button class="pep-cancel" style="height:32px;padding:0 12px;border:1px solid #ddd;border-radius:4px;background:#fff;color:#444;font:inherit;font-size:13px;font-weight:500;cursor:pointer;">取消</button>
          <button class="pep-save" style="height:32px;padding:0 14px;border:none;border-radius:4px;background:#111;color:#fff;font:inherit;font-size:13px;font-weight:500;cursor:pointer;">保存</button>
        </div>
      </div>
    `;

    const titleInput = modal.querySelector(".pep-title");
    const groupSelect = modal.querySelector(".pep-group");
    const newGroupInput = modal.querySelector(".pep-newgroup");
    const contentInput = modal.querySelector(".pep-content");

    groupSelect?.addEventListener("change", () => {
      const isNew = groupSelect instanceof HTMLSelectElement && groupSelect.value === "__new__";
      if (newGroupInput instanceof HTMLInputElement) {
        newGroupInput.style.display = isNew ? "block" : "none";
        if (isNew) requestAnimationFrame(() => newGroupInput.focus());
      }
    });

    const prevMinHeight = document.body.style.minHeight;

    const prevBodyBg = document.body.style.background;
    const popupShell = document.querySelector(".popup-shell");
    const prevShellBg = popupShell ? popupShell.style.background : "";
    const popupActions = document.querySelector(".popup-actions");
    const prevActionsDisplay = popupActions ? popupActions.style.display : "";

    function closeModal() {
      overlay.remove();
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.minHeight = prevMinHeight;
      document.body.style.background = prevBodyBg;
      if (popupShell) popupShell.style.background = prevShellBg;
      if (popupActions) popupActions.style.display = prevActionsDisplay;
    }

    modal.querySelector(".pep-cancel").addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

    modal.querySelector(".pep-save").addEventListener("click", async () => {
      const newTitle = (titleInput instanceof HTMLInputElement ? titleInput.value : "").trim() || "未命名提示词";
      const newContent = contentInput instanceof HTMLTextAreaElement ? contentInput.value : "";
      let newGroupId = groupSelect instanceof HTMLSelectElement ? groupSelect.value : groupId;
      if (newGroupId === "__new__") {
        const newName = (newGroupInput instanceof HTMLInputElement ? newGroupInput.value : "").trim() || "新建分组";
        const newGroup = { id: `prompt-group-${Date.now()}`, name: newName, prompts: [] };
        promptGroups.push(newGroup);
        newGroupId = newGroup.id;
      }
      promptGroups.forEach((g) => { g.prompts = g.prompts.filter((p) => p.id !== targetPrompt.id); });
      const destGroup = promptGroups.find((g) => g.id === newGroupId) || targetGroup;
      destGroup.prompts.push({ id: targetPrompt.id, title: newTitle, content: newContent });
      await chrome.storage.local.set({ [PROMPT_GROUPS_STORAGE_KEY]: promptGroups });
      closeModal();
    });

    modal.querySelector(".pep-delete").addEventListener("click", async () => {
      if (!window.confirm("确定要删除这条提示词吗？")) return;
      promptGroups.forEach((g) => { g.prompts = g.prompts.filter((p) => p.id !== targetPrompt.id); });
      await chrome.storage.local.set({ [PROMPT_GROUPS_STORAGE_KEY]: promptGroups });
      closeModal();
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = "visible";
    document.body.style.overflow = "visible";
    document.body.style.minHeight = "440px";
    document.body.style.background = "#ffffff";
    if (popupShell) popupShell.style.background = "#ffffff";
    if (popupActions) popupActions.style.display = "none";
    if (titleInput instanceof HTMLInputElement) requestAnimationFrame(() => titleInput.focus());
  }

  function bindPromptPickerEvents() {
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !isPromptPickerOpen) {
        return;
      }
      if (target.closest("#promptEntryBtn") || target.closest("#promptPicker")) {
        return;
      }
      closePromptPicker();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isPromptPickerOpen) {
        closePromptPicker();
        queryInput.focus();
      }
    });
  }

  function bindComposerLayoutEvents() {
    queryInput.addEventListener("mouseup", syncComposerLayout);
    queryInput.addEventListener("keyup", syncComposerLayout);

    if (typeof ResizeObserver !== "undefined") {
      composerResizeObserver = new ResizeObserver(() => {
        syncComposerLayout();
      });
      composerResizeObserver.observe(queryInput);
    }
  }

  function syncComposerLayout() {
    if (!composer || !queryInput) {
      return;
    }

    // 先把 expanded 状态和内联高度清掉，让 scrollHeight 反映真实内容高度
    composer.classList.remove("is-expanded");
    queryInput.style.height = "0px";
    queryInput.style.minHeight = "0px";

    const scrollH = queryInput.scrollHeight;
    const lineHeight = parseFloat(window.getComputedStyle(queryInput).lineHeight || "21.75");

    // 还原内联样式，再按测量结果决定是否展开
    queryInput.style.height = "";
    queryInput.style.minHeight = "";
    composer.classList.toggle("is-expanded", scrollH > lineHeight * 1.7);
  }

  function togglePromptPicker() {
    isPromptPickerOpen = !isPromptPickerOpen;
    renderPromptPicker();
  }

  function applyUiPrefs() {
    if (historySection) {
      historySection.hidden = uiPrefs.showHistory === false;
      historySection.classList.toggle("is-hidden", uiPrefs.showHistory === false);
      historySection.style.display = uiPrefs.showHistory === false ? "none" : "block";
    }

    if (randomPromptBtn) {
      randomPromptBtn.hidden = uiPrefs.showRandomButton === false;
      randomPromptBtn.style.display = uiPrefs.showRandomButton === false ? "none" : "inline-flex";
    }

    if (promptEntryBtn) {
      promptEntryBtn.hidden = uiPrefs.showPromptButton === false;
      promptEntryBtn.style.display = uiPrefs.showPromptButton === false ? "none" : "inline-flex";
      if (uiPrefs.showPromptButton === false) {
        closePromptPicker();
      }
    }

    if (composerActionsRow) {
      const hasVisibleActions = uiPrefs.showRandomButton !== false || uiPrefs.showPromptButton !== false;
      composerActionsRow.hidden = !hasVisibleActions;
      composerActionsRow.style.display = hasVisibleActions ? "flex" : "none";
    }

    updatePromptPickerLayoutState();
  }

  function closePromptPicker() {
    if (!isPromptPickerOpen) {
      return;
    }
    isPromptPickerOpen = false;
    hidePopupPromptPreview();
    renderPromptPicker();
    updatePromptPickerLayoutState();
  }

  function updatePromptPickerLayoutState() {
    if (!composer) {
      return;
    }

    const shouldExpandDownward = isPromptPickerOpen && uiPrefs.showHistory === false;
    composer.classList.toggle("is-picker-inline-open", shouldExpandDownward);
  }

  function fillRandomQuestion() {
    if (!RANDOM_QUESTIONS.length) {
      return;
    }

    const randomIndex = Math.floor(Math.random() * RANDOM_QUESTIONS.length);
    queryInput.value = RANDOM_QUESTIONS[randomIndex];
    syncComposerLayout();
    queryInput.focus();
  }

  function renderHistory(history) {
    historyList.innerHTML = "";

    if (history.length === 0) {
      const empty = document.createElement("div");
      empty.className = "popup-history-empty";
      empty.textContent = "暂无搜索记录";
      historyList.appendChild(empty);
      return;
    }

    history.forEach((entry) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "popup-history-item";

      const query = String(entry.query || "").replace(/\s+/g, " ").trim();
      const dateText = formatHistoryDate(entry.createdAt);
      item.innerHTML = `
        <div class="popup-history-line">
          <div class="popup-history-query">${escapeHtml(query)}</div>
          <div class="popup-history-meta">${escapeHtml(dateText)}</div>
        </div>
        <button class="popup-history-delete-btn" type="button" aria-label="删除这条记录">×</button>
      `;
      const deleteBtn = item.querySelector(".popup-history-delete-btn");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          await removeHistoryEntry(entry);
        });
      }
      item.addEventListener("click", () => {
        queryInput.value = entry.query || "";
        queryInput.focus();
      });
      historyList.appendChild(item);
    });
  }

  async function runDefaultSearch() {
    if (!groups.length) {
      return;
    }

    await runGroup(groups[0]);
  }

  async function runGroup(group) {
    const query = queryInput.value.trim();
    await chrome.runtime.sendMessage({
      type: "RUN_SEARCH_GROUP",
      group,
      query
    });
    window.close();
  }

  async function loadGroups() {
    const stored = await chrome.storage.local.get([SEARCH_GROUPS_STORAGE_KEY]);
    return Array.isArray(stored[SEARCH_GROUPS_STORAGE_KEY]) ? stored[SEARCH_GROUPS_STORAGE_KEY] : [];
  }

  async function loadPromptGroups() {
    const stored = await chrome.storage.local.get([PROMPT_GROUPS_STORAGE_KEY]);
    const source = Array.isArray(stored[PROMPT_GROUPS_STORAGE_KEY]) ? stored[PROMPT_GROUPS_STORAGE_KEY] : [];
    return source.map((group, groupIndex) => ({
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

  async function loadHistory() {
    const stored = await chrome.storage.local.get([SEARCH_HISTORY_STORAGE_KEY]);
    return Array.isArray(stored[SEARCH_HISTORY_STORAGE_KEY]) ? stored[SEARCH_HISTORY_STORAGE_KEY].slice(0, 4) : [];
  }

  async function removeHistoryEntry(entry) {
    const stored = await chrome.storage.local.get([SEARCH_HISTORY_STORAGE_KEY]);
    const fullHistory = Array.isArray(stored[SEARCH_HISTORY_STORAGE_KEY]) ? stored[SEARCH_HISTORY_STORAGE_KEY] : [];
    if (!fullHistory.length) {
      return;
    }

    let removed = false;
    const nextHistory = fullHistory.filter((item) => {
      if (removed) {
        return true;
      }

      if (entry?.id && item?.id === entry.id) {
        removed = true;
        return false;
      }

      if (!entry?.id && item?.query === entry?.query && item?.createdAt === entry?.createdAt) {
        removed = true;
        return false;
      }

      return true;
    });

    if (!removed) {
      return;
    }

    await chrome.storage.local.set({ [SEARCH_HISTORY_STORAGE_KEY]: nextHistory });
  }

  async function loadUiPrefs() {
    const stored = await chrome.storage.local.get([UI_PREFS_STORAGE_KEY]);
    return createNormalizedUiPrefs(stored[UI_PREFS_STORAGE_KEY]);
  }

  function createNormalizedUiPrefs(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      showHistory: source.showHistory !== false,
      showRandomButton: source.showRandomButton !== false,
      showPromptButton: source.showPromptButton !== false,
      prewarmEnabled: source.prewarmEnabled !== false
    };
  }

  function formatHistoryDate(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
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
