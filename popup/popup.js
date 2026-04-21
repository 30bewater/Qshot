(function initPopup() {
  const SEARCH_GROUPS_STORAGE_KEY = "searchGroups";
  const SEARCH_HISTORY_STORAGE_KEY = "searchHistory";
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
    "目前硅谷和开发者圈子里，讨论热度最高的 AI 开源项目是哪些？请列出 Top 5，附项目地址和一句话说明。",
    "写一段严谨但通俗的话，说明\"AI 幻觉\"产生的核心原因、典型表现，以及普通用户如何识别。",
    "今天如果我想立刻用 AI 提高效率，最近出现或变成熟的 3 个用法是什么？请只讲能马上上手的。",
    "OpenAI 最新发布的模型是什么？具体发布时间、核心能力升级，以及和上一代模型的关键区别。",
    "2024 年至今，AI 领域有哪些里程碑事件？请按时间线列出，标注具体日期、事件内容和行业影响。",
    "目前国内主流 AI 视频生成工具，在画质、生成速度和可控性上各有什么优劣？帮我做个精简对比表。",
    "过去 7 天最值得普通人关注的 3 条 AI 动态是什么？按\"发生了什么 / 为什么重要 / 对普通人有什么影响\"回答。控制在 200 字内。",
    "最近 30 天里，主流 AI 工具里有哪些更新是真正能提升工作效率的？请选 3 个，说明适合谁用、解决什么问题。控制在 300 字内。",
    "最近大家都在讨论的 AI 话题里，哪些是真的有长期价值，哪些更像短期炒作？请各举 2 个例子。",
    "针对\"AI 时代如何保持核心竞争力\"这个话题，写一篇 300 字的短评，观点要一针见血。",
    "请用 400 字以内分析：为什么现代人在线连接更多了，主观孤独感却没有明显下降？",
    "随机选一个观点，请分别写成：理性版、犀利版、温和版，各 80 字。",
    "给我一个反直觉的观点，然后用 300 字把它写成一篇让人看完第一句就想继续读的短文。",
    "为什么有些事明知道没必要，还是会在意？请从进化心理学和认知偏差两个角度解释。",
    "现代社会哪些看似正常的习惯，其实一直在偷走你的能量？请列出 5 个，并说明替代方案。",
    "为什么现代人的孤独感在持续增加？请从社会结构、工作方式、社交媒体、心理习惯四个层面分析，并引用近年的研究或数据。",
    "为什么很多人看起来越来越自由，内心却越来越空？请从选择过载、比较心理、意义感缺失、关系稀薄四个角度拆解。",
    "为什么很多人懂很多道理，却很难真正改变自己？请结合行为心理学中的\"意图-行为鸿沟\"研究解释。",
    "什么样的\"努力\"其实只是自我感动？请列出 5 种常见表现，并说明为什么它们看起来努力、实际上低效。",
    "把\"焦虑感\"比作一个正在运行的操作系统——请列出 5 个可能存在的底层 Bug，并提供一套心理学上的调试协议。",
    "为什么有些关系让人上头，但不让人安心？请分析\"强刺激型依恋\"和\"稳定连接型依恋\"的本质区别，以及各自的长期代价。",
    "为什么我们总是对\"最亲近的人\"最容易发火？请从情绪调节资源、安全感依赖、投射机制三个角度解释，并给出一个可操作的应对策略。",
    "互联网上最常见的情绪操控套路有哪些？请列出 5 种典型手法，附真实案例，并给出识别和防御方法。",
    "有哪些被大众广泛认可的\"励志语录\"，其实逻辑上经不起推敲？请挑 5 句，逐一拆解其逻辑漏洞。",
    "社交媒体算法是如何精准制造\"焦虑感\"和\"信息茧房\"的？请从推荐机制、用户行为数据、内容分发策略三个层面说明。",
    "怎么快速判断一条内容是在提供信息，还是在煽动立场？请给出一个 30 秒内可用的判断框架。",
    "有哪些常见但极其低效的办公习惯，可以用 AI 或自动化工具彻底替代？请列出 5 个，附具体工具推荐。",
    "\"低质量忙碌\"最常见的几种形式是什么？高效的人不是做得更多，而是更少做错事——请从任务选择、时间分配、注意力管理三个角度分析。",
    "\"复盘\"和\"总结\"的关键区别是什么？一个真正有效的个人复盘流程应该包含哪些步骤？请给出可直接套用的模板。",
    "一个人同时推进多个项目时，最容易在哪个环节崩掉？请从认知负荷、优先级混乱、情绪消耗三个角度分析，并给出一套\"多线程工作\"的管理框架。",
    "如何将一个复杂的大项目拆解成容易执行的小步骤？请用一个实际案例演示拆解过程。",
    "有哪些经过科学验证的提升注意力的方法？请推荐 3 个，附研究来源和具体操作步骤。",
    "信息量很大的时候，怎么快速抓住重点？请给出一个可复用的信息筛选框架。",
    "怎么用 AI 把一个模糊的想法变成可执行的步骤？请用一个具体例子，演示从\"我想做 XX\"到\"第一步打开什么\"的完整过程。",
    "想提高产出质量，最该先优化输入、流程还是表达？请按优先级排序并说明理由。",
    "连续抛硬币 10 次都是正面，第 11 次出现反面的概率是多少？请解释大多数人的直觉为什么是错的。",
    "把\"孤独\"翻译成 5 种不同的生活场景，全程不许出现\"孤独\"二字。",
    "如果\"工作\"不再是生存的必需品，人类社会最可能爆发的五种精神危机是什么？请从马斯洛需求层次的高层进行反向推论。",
    "帮我起草一份\"年轻人极简主义背后的经济动因\"研究大纲，要求对比近两年的消费信心指数变化，并预测未来三年的消费趋势。",
    "如果让 AI 扮演苏格拉底，它会对一个处于职业转型焦虑中的年轻人提出哪些直击本质的问题？"
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
    // 审核说明：
    // - “预热”仅用于提升用户打开 AI 站点的冷启动速度。
    // - 请求直接发往用户选择的第三方站点；扩展不上传用户数据到开发者服务器，且不读取响应内容（见 background.js 的 mode:"no-cors"）。
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

    if (changes[CUSTOM_SITES_STORAGE_KEY]) {
      await refreshAllSites();
      await refreshGroups();
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

      const groupSites = getGroupSites(group);

      if (groupSites.length) {
        button.addEventListener("mouseenter", () => showGroupTooltip(button, groupSites));
        button.addEventListener("mouseleave", () => scheduleHideGroupTooltip());
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
  let _groupTooltipHideTimer = null;

  function getOrCreateGroupTooltip() {
    if (!_groupTooltipEl) {
      _groupTooltipEl = document.createElement("div");
      _groupTooltipEl.className = "group-tooltip";
      _groupTooltipEl.addEventListener("mouseenter", () => {
        if (_groupTooltipHideTimer) {
          clearTimeout(_groupTooltipHideTimer);
          _groupTooltipHideTimer = null;
        }
      });
      _groupTooltipEl.addEventListener("mouseleave", () => {
        scheduleHideGroupTooltip();
      });
      document.body.appendChild(_groupTooltipEl);
    }
    return _groupTooltipEl;
  }

  function getGroupSites(group) {
    return (group.siteIds || [])
      .map((id) => allSites.find((site) => site.id === id))
      .filter((site) => site && normalizeSiteHomeUrl(site.url))
      .map((site) => ({
        id: site.id,
        name: site.name || site.id,
        url: normalizeSiteHomeUrl(site.url)
      }));
  }

  function showGroupTooltip(button, sites) {
    if (_groupTooltipTimer) { clearTimeout(_groupTooltipTimer); _groupTooltipTimer = null; }
    if (_groupTooltipHideTimer) { clearTimeout(_groupTooltipHideTimer); _groupTooltipHideTimer = null; }
    _groupTooltipTimer = setTimeout(() => {
      const tooltip = getOrCreateGroupTooltip();
      renderGroupTooltipSites(tooltip, sites);
      tooltip.style.display = "block";
      requestAnimationFrame(() => {
        const btnRect = button.getBoundingClientRect();
        const tooltipW = tooltip.offsetWidth;
        const tooltipH = tooltip.offsetHeight;
        let left = btnRect.left + btnRect.width / 2 - tooltipW / 2;
        if (left < 4) left = 4;
        if (left + tooltipW > window.innerWidth - 4) left = window.innerWidth - tooltipW - 4;
        let top = btnRect.top - tooltipH - 8;
        if (top < 4) {
          top = btnRect.bottom + 8;
        }
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      });
    }, 450);
  }

  function hideGroupTooltip() {
    if (_groupTooltipTimer) { clearTimeout(_groupTooltipTimer); _groupTooltipTimer = null; }
    if (_groupTooltipHideTimer) { clearTimeout(_groupTooltipHideTimer); _groupTooltipHideTimer = null; }
    if (_groupTooltipEl) {
      _groupTooltipEl.style.display = "none";
    }
  }

  function scheduleHideGroupTooltip() {
    if (_groupTooltipTimer) { clearTimeout(_groupTooltipTimer); _groupTooltipTimer = null; }
    if (_groupTooltipHideTimer) { clearTimeout(_groupTooltipHideTimer); }
    _groupTooltipHideTimer = setTimeout(() => {
      if (_groupTooltipEl) {
        _groupTooltipEl.style.display = "none";
      }
    }, 180);
  }

  function renderGroupTooltipSites(tooltip, sites) {
    tooltip.innerHTML = "";

    const list = document.createElement("div");
    list.className = "group-tooltip-list";
    list.style.gridTemplateColumns = `repeat(${Math.min(5, Math.max(1, sites.length))}, max-content)`;
    sites.forEach((site) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "group-tooltip-item";
      item.textContent = site.name;
      item.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        hideGroupTooltip();
        await openSiteHome(site.url);
      });
      list.appendChild(item);
    });
    tooltip.appendChild(list);
  }

  async function openSiteHome(url) {
    const safeUrl = normalizeSiteHomeUrl(url);
    if (!safeUrl) {
      return;
    }

    try {
      await chrome.runtime.sendMessage({ type: "OPEN_EXTERNAL_URL", url: safeUrl });
    } catch (_err) {
      /* 忽略 */
    }

    window.close();
  }

  function normalizeSiteHomeUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) {
      return "";
    }

    let next = raw.replace(/([?&])[^=&]+=\{query\}/g, (_, sep) => (sep === "?" ? "?" : ""));
    next = next.replace(/\?&/, "?");
    next = next.replace(/[?&]$/, "");
    next = next.replace(/\{query\}/g, "");
    if (!/^https?:\/\//i.test(next)) {
      return "";
    }
    return next;
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
      _popupPreviewMgr = _popupPreviewMgr || window.PromptItemUI.createPreviewManager(null);
      activeGroup.prompts.forEach((prompt) => {
        const item = window.PromptItemUI.createItem(prompt, {
          onFill: (p) => { queryInput.value = p.content || ""; closePromptPicker(); queryInput.focus(); },
          onEdit: (p) => openPopupPromptEditModal(p, activeGroup.id),
          previewManager: _popupPreviewMgr,
        });
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

  // 预览卡片管理器（由 shared/prompt-item.js 提供）
  let _popupPreviewMgr = null;


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
    if (_popupPreviewMgr) _popupPreviewMgr.hide();
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

  function runGroup(group) {
    const query = queryInput.value.trim();
    chrome.runtime.sendMessage({
      type: "RUN_SEARCH_GROUP",
      group,
      query
    }).catch(() => {});
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
