(function initSettingsPage() {
  const GROUPS_STORAGE_KEY = "searchGroups";
  const PROMPTS_STORAGE_KEY = "promptGroups";
  const UI_PREFS_STORAGE_KEY = "uiPrefs";
  const PICKER_CLOSE_DELAY_MS = 320;
  const SITE_CATEGORIES = {
    ai: { label: "AI", siteIds: ["deepseek", "doubao", "kimi", "yuanbao", "qwen", "metaso", "gemini", "chatgpt", "claude", "perplexity", "grok"] },
    other: { label: "社媒平台", siteIds: ["xiaohongshu", "bilibili", "zhihu", "douyin"] },
    custom: { label: "自定义", siteIds: [] }
  };
  const AI_SITE_GROUPS = [
    { label: "国内", siteIds: ["deepseek", "doubao", "kimi", "yuanbao", "qwen", "metaso"] },
    { label: "国外", siteIds: ["gemini", "chatgpt", "claude", "perplexity", "grok"] }
  ];
  const SECTION_META = {
    groups: {
      eyebrow: "搜索组设置",
      title: "分组与调用内容",
      subtitle: "管理搜索组名称、启用状态、打开方式，以及每个组内调用的网站或 AI 模型。"
    },
    prompts: {
      eyebrow: "提示词设置",
      title: "提示词与分组",
      subtitle: "先做一个简洁版本：创建提示词分组，并在分组内维护标题与内容。"
    },
    other: {
      eyebrow: "其他设置",
      title: "首页显示控制",
      subtitle: "控制首页中历史记录、随机骰子和提示词入口是否显示。"
    }
  };

  const groupsSection = document.getElementById("groupsSection");
  const promptsSection = document.getElementById("promptsSection");
  const otherSection = document.getElementById("otherSection");
  const sectionEyebrow = document.getElementById("sectionEyebrow");
  const sectionTitle = document.getElementById("sectionTitle");
  const sectionSubtitle = document.getElementById("sectionSubtitle");
  const navItems = Array.from(document.querySelectorAll(".settings-nav-item"));
  const GROUP_MODE_OPTIONS = [
    { value: "compare", label: "卡片呈现" },
    { value: "tabs", label: "新开标签" }
  ];

  let groups = [];
  let promptGroups = [];
  let uiPrefs = createNormalizedUiPrefs();
  let sites = [];
  let activeSection = "groups";
  let openPickerGroupId = null;
  let activePickerCategoryKey = null;
  let pickerCloseTimerId = null;
  let draggingSiteId = null;
  let draggingGroupId = null;
  let activePromptGroupId = null;
  let promptEditorState = null;
  let pendingPromptGroupFocusId = null;

  document.addEventListener("DOMContentLoaded", start);

  async function start() {
    sites = await loadSites();
    const stored = await chrome.storage.local.get([GROUPS_STORAGE_KEY, PROMPTS_STORAGE_KEY, UI_PREFS_STORAGE_KEY]);
    groups = createNormalizedGroups(stored[GROUPS_STORAGE_KEY]);
    promptGroups = createNormalizedPromptGroups(stored[PROMPTS_STORAGE_KEY]);
    uiPrefs = createNormalizedUiPrefs(stored[UI_PREFS_STORAGE_KEY]);
    activePromptGroupId = promptGroups[0]?.id || null;
    if (!Array.isArray(stored[GROUPS_STORAGE_KEY]) || stored[GROUPS_STORAGE_KEY].length === 0) {
      await chrome.storage.local.set({ [GROUPS_STORAGE_KEY]: groups });
    }
    if (!Array.isArray(stored[PROMPTS_STORAGE_KEY]) || stored[PROMPTS_STORAGE_KEY].length === 0) {
      await chrome.storage.local.set({ [PROMPTS_STORAGE_KEY]: promptGroups });
    }
    if (!stored[UI_PREFS_STORAGE_KEY] || typeof stored[UI_PREFS_STORAGE_KEY] !== "object") {
      await chrome.storage.local.set({ [UI_PREFS_STORAGE_KEY]: uiPrefs });
    }
    bindEvents();
    renderCurrentSection();
  }

  function bindEvents() {
    document.addEventListener("click", handleDocumentClick);

    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        setActiveSection(item.dataset.section || "groups");
      });
    });
  }

  function handleDocumentClick(event) {
    if (openPickerGroupId && !event.target.closest(".inline-add-wrap")) {
      closePicker();
      renderGroupsSection();
      return;
    }

    if (!event.target.closest(".group-mode-dropdown")) {
      document.querySelectorAll(".group-mode-dropdown").forEach((dropdown) => {
        dropdown.classList.remove("is-open");
        const trigger = dropdown.querySelector("[data-field='mode-trigger']");
        const menu = dropdown.querySelector("[data-field='mode-menu']");
        if (trigger) {
          trigger.setAttribute("aria-expanded", "false");
        }
        if (menu) {
          menu.hidden = true;
        }
      });
    }
  }

  function setActiveSection(sectionKey) {
    if (!SECTION_META[sectionKey]) {
      return;
    }
    activeSection = sectionKey;
    navItems.forEach((item) => item.classList.toggle("is-active", item.dataset.section === sectionKey));
    const meta = SECTION_META[sectionKey];
    sectionEyebrow.textContent = meta.eyebrow;
    sectionTitle.textContent = meta.title;
    sectionSubtitle.textContent = meta.subtitle;
    updateSectionVisibility();
    renderCurrentSection();
  }

  function renderCurrentSection() {
    updateSectionVisibility();
    if (activeSection === "prompts") {
      renderPromptsSection();
      return;
    }
    if (activeSection === "other") {
      renderOtherSection();
      return;
    }
    renderGroupsSection();
  }

  function updateSectionVisibility() {
    const showGroups = activeSection === "groups";
    const showPrompts = activeSection === "prompts";
    const showOther = activeSection === "other";
    groupsSection.hidden = !showGroups;
    promptsSection.hidden = !showPrompts;
    otherSection.hidden = !showOther;
    groupsSection.style.display = showGroups ? "flex" : "none";
    promptsSection.style.display = showPrompts ? "flex" : "none";
    otherSection.style.display = showOther ? "flex" : "none";
  }

  function createNormalizedGroups(input) {
    const validSiteIds = new Set(sites.map((site) => site.id));
    const source = Array.isArray(input) && input.length > 0
      ? input
      : [
          { id: "default-compare", name: "AI搜索", enabled: true, mode: "compare", siteIds: ["deepseek", "doubao", "kimi", "chatgpt", "qwen"] },
          { id: "default-tabs", name: "未命名搜索组", enabled: true, mode: "compare", siteIds: ["xiaohongshu", "bilibili"] }
        ];

    return source.map((group) => ({
      ...group,
      name: String(group.name || "未命名搜索组"),
      enabled: group.enabled !== false,
      mode: group.mode === "tabs" ? "tabs" : "compare",
      siteIds: Array.isArray(group.siteIds)
        ? group.siteIds.filter((siteId, index, arr) => validSiteIds.has(siteId) && arr.indexOf(siteId) === index)
        : []
    }));
  }

  function createNormalizedPromptGroups(input) {
    const source = Array.isArray(input) && input.length > 0
      ? input
      : [
          {
            id: "prompt-group-default",
            name: "默认分组",
            prompts: [
              { id: "prompt-default-1", title: "总结重点", content: "请帮我总结这段内容的重点，并列出三条可执行建议。" }
            ]
          }
        ];

    return source.map((group) => ({
      id: String(group.id || `prompt-group-${Date.now()}`),
      name: String(group.name || "未命名提示词分组"),
      prompts: Array.isArray(group.prompts)
        ? group.prompts.map((prompt, index) => ({
            id: String(prompt.id || `${group.id || 'prompt'}-${index}`),
            title: String(prompt.title || "未命名提示词"),
            content: String(prompt.content || "")
          }))
        : []
    }));
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

  function getGroupById(groupId) {
    return groups.find((item) => item.id === groupId) || null;
  }

  function renderGroupsSection() {
    groupsSection.innerHTML = "";

    if (!groups.length) {
      const emptyState = document.createElement("section");
      emptyState.className = "settings-empty-state";
      emptyState.innerHTML = `<strong>还没有搜索组</strong><p>先创建一个搜索组，再配置你要调用的网站或 AI 模型。</p>`;
      groupsSection.appendChild(emptyState);
    } else {
      groups.forEach((group, index) => groupsSection.appendChild(createGroupCard(group, index)));
    }

    const addCard = document.createElement("section");
    addCard.className = "settings-add-card";
    addCard.innerHTML = `
      <div class="settings-add-copy">
        <strong>新建搜索组</strong>
        <span>创建一个新的搜索组，并继续在右侧添加站点。</span>
      </div>
      <button class="add-section-btn" type="button">新增搜索组</button>
    `;
    addCard.querySelector("button").addEventListener("click", async () => {
      groups.push({
        id: `group_${Date.now()}`,
        name: "新搜索组",
        enabled: true,
        mode: "compare",
        siteIds: sites.slice(0, 2).map((site) => site.id)
      });
      markDirty();
      await persistAll();
      renderGroupsSection();
    });
    groupsSection.appendChild(addCard);
  }

  function createGroupCard(group, index) {
    const isLocked = index === 0;
    const card = document.createElement("section");
    card.className = `settings-group-card${group.enabled ? "" : " is-disabled"}`;
    card.dataset.groupId = group.id;
    card.addEventListener("dragover", (event) => {
      if (!draggingGroupId || draggingGroupId === group.id) {
        return;
      }
      event.preventDefault();
      card.classList.add("is-group-drag-over");
    });
    card.addEventListener("dragleave", () => {
      card.classList.remove("is-group-drag-over");
    });
    card.addEventListener("drop", async (event) => {
      if (!draggingGroupId || draggingGroupId === group.id) {
        return;
      }
      event.preventDefault();
      card.classList.remove("is-group-drag-over");
      await reorderGroups(draggingGroupId, group.id);
    });

    if (!isLocked) {
      const deleteCornerBtn = document.createElement("button");
      deleteCornerBtn.type = "button";
      deleteCornerBtn.className = "group-delete-corner-btn";
      deleteCornerBtn.setAttribute("aria-label", "删除搜索组");
      deleteCornerBtn.textContent = "×";
      deleteCornerBtn.addEventListener("click", async () => {
        const currentGroup = getGroupById(group.id);
        if (!currentGroup) {
          return;
        }
        const shouldDelete = window.confirm("是否要删除该搜索组？");
        if (!shouldDelete) {
          return;
        }
        groups = groups.filter((item) => item.id !== currentGroup.id);
        if (openPickerGroupId === currentGroup.id) {
          closePicker();
        }
        await persistAll();
        renderGroupsSection();
      });
      card.appendChild(deleteCornerBtn);
    }

    const leftPanel = document.createElement("div");
    leftPanel.className = "settings-group-meta";
    leftPanel.innerHTML = `
      <div class="group-inline-controls group-inline-controls-split">
        <label class="inline-control group-name-inline-wrap">
          <span class="field-label inline-field-label">搜索组名称</span>
          <input class="group-name-input" type="text" value="${escapeHtml(group.name)}" data-field="name" />
        </label>
        <label class="inline-control inline-mode-control inline-mode-select-wrap">
          <span class="field-label inline-field-label">呈现方式</span>
          <div class="group-mode-dropdown" data-field="mode-dropdown">
            <button class="group-mode-trigger" type="button" data-field="mode-trigger" aria-expanded="false">
              <span class="group-mode-trigger-label">${escapeHtml(group.mode === "tabs" ? "新开标签" : "卡片呈现")}</span>
              <span class="group-mode-trigger-arrow" aria-hidden="true"></span>
            </button>
            <div class="group-mode-menu" data-field="mode-menu" hidden>
              ${GROUP_MODE_OPTIONS.map((option) => `<button class="group-mode-option${group.mode === option.value ? " is-active" : ""}" type="button" data-mode-value="${option.value}">${escapeHtml(option.label)}</button>`).join("")}
            </div>
          </div>
        </label>
      </div>
    `;

    const rightPanel = document.createElement("div");
    rightPanel.className = "settings-group-sites";

    const chipsWrap = document.createElement("div");
    chipsWrap.className = "site-chip-list";
    chipsWrap.addEventListener("dragover", (event) => {
      if (!draggingSiteId) return;
      event.preventDefault();
      chipsWrap.classList.add("is-drag-over");
    });
    chipsWrap.addEventListener("dragleave", () => chipsWrap.classList.remove("is-drag-over"));
    chipsWrap.addEventListener("drop", async (event) => {
      event.preventDefault();
      chipsWrap.classList.remove("is-drag-over");
      const targetSiteId = event.target.closest("[data-site-id]")?.dataset.siteId || null;
      await reorderGroupSites(group, draggingSiteId, targetSiteId);
    });

    const selectedSites = group.siteIds.map((siteId) => sites.find((site) => site.id === siteId)).filter(Boolean);
    if (!selectedSites.length) {
      const empty = document.createElement("div");
      empty.className = "site-selection-empty";
      empty.textContent = "当前还没有添加任何内容，可直接点后面的新增。";
      chipsWrap.appendChild(empty);
    } else {
      selectedSites.forEach((site) => chipsWrap.appendChild(createSelectedChip(group, site)));
    }

    chipsWrap.appendChild(createInlineAdd(group));
    rightPanel.appendChild(chipsWrap);
    card.appendChild(leftPanel);
    card.appendChild(rightPanel);

    if (!isLocked) {
      const dragHandle = document.createElement("button");
      dragHandle.type = "button";
      dragHandle.className = "group-drag-handle";
      dragHandle.draggable = true;
      dragHandle.setAttribute("aria-label", "拖动调整搜索组顺序");
      dragHandle.innerHTML = `<svg viewBox="0 0 1024 1024" aria-hidden="true" class="group-drag-handle-svg"><path d="M716.8 212.48c-10.24 0-17.92 2.56-25.6 5.12v-5.12c0-43.52-33.28-76.8-76.8-76.8-10.24 0-17.92 2.56-28.16 5.12C581.12 104.96 550.4 76.8 512 76.8c-43.52 0-76.8 33.28-76.8 76.8v5.12c-7.68-2.56-15.36-5.12-25.6-5.12-43.52 0-76.8 33.28-76.8 76.8v104.96c-7.68-2.56-15.36-5.12-25.6-5.12-43.52 0-76.8 33.28-76.8 76.8v256c0 156.16 125.44 281.6 281.6 281.6s281.6-125.44 281.6-281.6V289.28c0-43.52-33.28-76.8-76.8-76.8zM742.4 665.6c0 128-102.4 230.4-230.4 230.4s-230.4-102.4-230.4-230.4V409.6c0-15.36 10.24-25.6 25.6-25.6s25.6 10.24 25.6 25.6v209.92h43.52c56.32 5.12 110.08 33.28 143.36 79.36l40.96-30.72c-40.96-56.32-107.52-94.72-176.64-99.84V230.4c0-15.36 10.24-25.6 25.6-25.6s25.6 10.24 25.6 25.6v256h51.2V153.6c0-15.36 10.24-25.6 25.6-25.6s25.6 10.24 25.6 25.6v335.36h51.2V212.48c0-15.36 10.24-25.6 25.6-25.6s25.6 10.24 25.6 25.6v276.48h51.2v-199.68c0-15.36 10.24-25.6 25.6-25.6s25.6 10.24 25.6 25.6V665.6z" fill="#525C6A"></path></svg>`;
      dragHandle.addEventListener("dragstart", (event) => {
        draggingGroupId = group.id;
        card.classList.add("is-group-dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", group.id);
        }
      });
      dragHandle.addEventListener("dragend", () => {
        draggingGroupId = null;
        card.classList.remove("is-group-dragging");
        document.querySelectorAll(".settings-group-card").forEach((element) => element.classList.remove("is-group-drag-over"));
      });
      card.appendChild(dragHandle);
    }

    const nameInput = leftPanel.querySelector("[data-field='name']");
    const modeDropdown = leftPanel.querySelector("[data-field='mode-dropdown']");
    const modeTrigger = leftPanel.querySelector("[data-field='mode-trigger']");
    const modeMenu = leftPanel.querySelector("[data-field='mode-menu']");

    if (nameInput) {
      nameInput.addEventListener("input", async (event) => {
        const currentGroup = getGroupById(group.id);
        if (!currentGroup) {
          return;
        }
        const nextValue = event.target instanceof HTMLInputElement ? event.target.value : "";
        currentGroup.name = nextValue;
        await persistAll();
      });
    }

    if (modeDropdown && modeTrigger && modeMenu) {
      modeTrigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = modeDropdown.classList.contains("is-open");
        document.querySelectorAll(".group-mode-dropdown").forEach((dropdown) => {
          dropdown.classList.remove("is-open");
          const trigger = dropdown.querySelector("[data-field='mode-trigger']");
          const menu = dropdown.querySelector("[data-field='mode-menu']");
          if (trigger) {
            trigger.setAttribute("aria-expanded", "false");
          }
          if (menu) {
            menu.hidden = true;
          }
        });
        if (!isOpen) {
          modeDropdown.classList.add("is-open");
          modeTrigger.setAttribute("aria-expanded", "true");
          modeMenu.hidden = false;
        }
      });

      modeMenu.querySelectorAll("[data-mode-value]").forEach((button) => {
        button.addEventListener("click", async (event) => {
          event.stopPropagation();
          const currentGroup = getGroupById(group.id);
          if (!currentGroup) {
            return;
          }
          currentGroup.mode = button.dataset.modeValue === "tabs" ? "tabs" : "compare";
          await persistAll();
          renderGroupsSection();
        });
      });
    }

    return card;
  }

  function createSelectedChip(group, site) {
    const chip = document.createElement("div");
    chip.className = "site-chip selected-chip";
    chip.draggable = true;
    chip.dataset.siteId = site.id;
    chip.innerHTML = `<span class="site-chip-label">${escapeHtml(site.name)}</span><button class="chip-remove-btn" type="button" aria-label="删除 ${escapeHtml(site.name)}">×</button>`;

    chip.addEventListener("dragstart", (event) => {
      draggingSiteId = site.id;
      chip.classList.add("is-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", site.id);
      }
    });

    chip.addEventListener("dragend", () => {
      draggingSiteId = null;
      chip.classList.remove("is-dragging");
      document.querySelectorAll(".site-chip-list").forEach((element) => element.classList.remove("is-drag-over"));
    });

    chip.querySelector(".chip-remove-btn").addEventListener("click", async (event) => {
      event.stopPropagation();
      const currentGroup = getGroupById(group.id);
      if (!currentGroup) {
        return;
      }
      currentGroup.siteIds = currentGroup.siteIds.filter((id) => id !== site.id);
      await persistAll();
      renderGroupsSection();
    });

    return chip;
  }

  function createInlineAdd(group) {
    const wrap = document.createElement("div");
    wrap.className = "inline-add-wrap";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "inline-add-btn";
    button.textContent = "新增";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      clearPickerCloseTimer();
      if (openPickerGroupId === group.id) {
        closePicker();
      } else {
        openPickerGroupId = group.id;
        if (!activePickerCategoryKey || !SITE_CATEGORIES[activePickerCategoryKey]) {
          activePickerCategoryKey = Object.keys(SITE_CATEGORIES)[0] || null;
        }
      }
      renderGroupsSection();
    });
    wrap.appendChild(button);

    if (openPickerGroupId === group.id) {
      wrap.appendChild(createHoverPicker(group));
    }

    return wrap;
  }

  function createHoverPicker(group) {
    const panel = document.createElement("div");
    panel.className = "hover-picker-panel is-open";
    panel.addEventListener("click", (event) => event.stopPropagation());
    panel.addEventListener("mouseenter", clearPickerCloseTimer);
    panel.addEventListener("mouseleave", schedulePickerClose);

    Object.entries(SITE_CATEGORIES).forEach(([key, category]) => {
      const row = document.createElement("div");
      row.className = "hover-picker-row";
      const isActive = activePickerCategoryKey === key;
      if (isActive) {
        row.classList.add("is-active");
      }

      const entry = document.createElement("button");
      entry.className = "hover-picker-entry";
      entry.type = "button";
      entry.innerHTML = `<span>${escapeHtml(category.label)}</span><span class="hover-picker-arrow">›</span>`;
      entry.addEventListener("mouseenter", () => {
        clearPickerCloseTimer();
        setActivePickerCategory(key);
      });
      entry.addEventListener("click", (event) => {
        event.stopPropagation();
        clearPickerCloseTimer();
        setActivePickerCategory(key);
      });
      row.appendChild(entry);

      const submenu = document.createElement("div");
      submenu.className = `hover-picker-submenu${isActive ? " is-open" : ""}`;
      submenu.addEventListener("mouseenter", clearPickerCloseTimer);
      submenu.addEventListener("mouseleave", schedulePickerClose);
      const categorySites = getCategorySites(key);

      if (key === "custom") {
        const empty = document.createElement("div");
        empty.className = "hover-picker-empty";
        empty.textContent = "自定义暂未开放";
        submenu.appendChild(empty);
      } else if (key === "ai") {
        AI_SITE_GROUPS.forEach((marketGroup) => {
          const groupSites = marketGroup.siteIds
            .map((siteId) => categorySites.find((site) => site.id === siteId))
            .filter(Boolean);
          if (!groupSites.length) {
            return;
          }

          const section = document.createElement("div");
          section.className = "hover-picker-site-group";

          const sectionTitle = document.createElement("div");
          sectionTitle.className = "hover-picker-site-group-title";
          sectionTitle.textContent = marketGroup.label;
          section.appendChild(sectionTitle);

          groupSites.forEach((site) => {
            section.appendChild(createPickerSiteOption(group, site, key));
          });
          submenu.appendChild(section);
        });
      } else if (key === "other") {
        const tip = document.createElement("div");
        tip.className = "hover-picker-tip";
        tip.textContent = "社媒平台更推荐使用“新开标签”模式；卡片呈现的预览与打开体验可能不稳定。";
        submenu.appendChild(tip);

        categorySites.forEach((site) => {
          submenu.appendChild(createPickerSiteOption(group, site, key));
        });
      } else {
        categorySites.forEach((site) => {
          submenu.appendChild(createPickerSiteOption(group, site, key));
        });
      }

      row.appendChild(submenu);
      panel.appendChild(row);
    });

    return panel;
  }

  function renderPromptsSection() {
    promptsSection.innerHTML = "";
    if (!promptGroups.length) {
      promptGroups = createNormalizedPromptGroups([]);
    }
    if (!activePromptGroupId || !promptGroups.some((group) => group.id === activePromptGroupId)) {
      activePromptGroupId = promptGroups[0]?.id || null;
    }

    const activeGroup = promptGroups.find((group) => group.id === activePromptGroupId) || promptGroups[0];
    if (!activeGroup) {
      return;
    }

    const shell = document.createElement("section");
    shell.className = "prompt-settings-shell";
    shell.appendChild(createPromptGroupSidebar(activeGroup));
    shell.appendChild(createPromptContentPanel(activeGroup));
    promptsSection.appendChild(shell);

    if (pendingPromptGroupFocusId && pendingPromptGroupFocusId === activeGroup.id) {
      const renameInput = promptsSection.querySelector(".prompt-group-rename-input");
      if (renameInput instanceof HTMLInputElement) {
        requestAnimationFrame(() => {
          renameInput.focus();
          renameInput.select();
        });
      }
      pendingPromptGroupFocusId = null;
    }

    if (promptEditorState) {
      promptsSection.appendChild(createPromptEditorModal());
    }
  }

  function renderOtherSection() {
    otherSection.innerHTML = "";

    const card = document.createElement("section");
    card.className = "other-settings-card";
    card.innerHTML = `
      <div class="other-settings-intro">
        <strong>首页显示项</strong>
        <span>控制首页里哪些模块显示，哪些模块隐藏。</span>
      </div>
      <div class="other-settings-list"></div>
    `;

    const list = card.querySelector(".other-settings-list");
    [
      {
        key: "showHistory",
        title: "显示历史搜索记录",
        desc: "关闭后，首页下方的历史搜索区域将不再显示。"
      },
      {
        key: "showRandomButton",
        title: "显示随机骰子按钮",
        desc: "关闭后，输入框下方的随机问题按钮将隐藏。"
      },
      {
        key: "showPromptButton",
        title: "显示提示词按钮",
        desc: "关闭后，输入框下方的提示词入口将隐藏。"
      },
      {
        key: "prewarmEnabled",
        title: "打开扩展时预热 AI 站点",
        desc: "开启后，每次点开扩展会悄悄在后台预拉取 AI 站点首页，让随后搜索更快。会消耗少量流量，同一会话内 5 分钟只触发一次。"
      }
    ].forEach((item) => {
      list?.appendChild(createOtherSettingToggle(item.key, item.title, item.desc));
    });

    otherSection.appendChild(card);
  }

  function createOtherSettingToggle(key, title, desc) {
    const row = document.createElement("article");
    row.className = "other-setting-row";

    const isOn = uiPrefs[key] !== false;
    row.innerHTML = `
      <div class="other-setting-copy">
        <div class="other-setting-title">${escapeHtml(title)}</div>
        <div class="other-setting-desc">${escapeHtml(desc)}</div>
      </div>
      <button class="other-setting-switch ${isOn ? "is-on" : "is-off"}" type="button" aria-pressed="${isOn ? "true" : "false"}">
        <span class="other-setting-switch-thumb"></span>
      </button>
    `;

    const toggle = row.querySelector(".other-setting-switch");
    toggle?.addEventListener("click", async () => {
      uiPrefs[key] = !(uiPrefs[key] !== false);
      await persistAll();
      renderOtherSection();
    });

    return row;
  }

  function createPromptGroupSidebar(activeGroup) {
    const aside = document.createElement("aside");
    aside.className = "prompt-groups-sidebar";

    const list = document.createElement("div");
    list.className = "prompt-groups-list";
    promptGroups.forEach((group) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `prompt-group-nav-item${group.id === activeGroup.id ? " is-active" : ""}${!group.name.trim() ? " is-empty" : ""}`;
      button.innerHTML = `<span class="prompt-group-nav-name">${escapeHtml(group.name || "")}</span>`;
      button.addEventListener("click", () => {
        activePromptGroupId = group.id;
        renderPromptsSection();
      });
      list.appendChild(button);
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "prompt-sidebar-add-btn";
    addBtn.textContent = "+ 添加分组";
    addBtn.addEventListener("click", () => {
      const newGroup = {
        id: `prompt-group-${Date.now()}`,
        name: "",
        prompts: []
      };
      promptGroups.push(newGroup);
      activePromptGroupId = newGroup.id;
      pendingPromptGroupFocusId = newGroup.id;
      renderPromptsSection();
    });

    aside.appendChild(list);
    aside.appendChild(addBtn);
    return aside;
  }

  function createPromptContentPanel(activeGroup) {
    const panel = document.createElement("section");
    panel.className = "prompt-content-panel";

    const header = document.createElement("div");
    header.className = "prompt-content-header";
    header.innerHTML = `
      <div>
        <div class="prompt-content-title">${escapeHtml(activeGroup.name)}</div>
        <div class="prompt-content-subtitle">当前分类下共 ${activeGroup.prompts.length} 条提示词</div>
      </div>
    `;

    const groupActions = document.createElement("div");
    groupActions.className = "prompt-content-actions";
    const renameInput = document.createElement("input");
    renameInput.className = "prompt-group-rename-input";
    renameInput.type = "text";
    renameInput.value = activeGroup.name;
    renameInput.placeholder = "请输入分组名称";
    renameInput.addEventListener("input", (event) => {
      const nextValue = event.target instanceof HTMLInputElement ? event.target.value : "";
      activeGroup.name = nextValue;
    });
    renameInput.addEventListener("blur", async () => {
      activeGroup.name = activeGroup.name.trim() || "新建分组";
      await persistAll();
      renderPromptsSection();
    });

    const addPromptBtn = document.createElement("button");
    addPromptBtn.type = "button";
    addPromptBtn.className = "prompt-panel-add-btn";
    addPromptBtn.textContent = "添加提示词";
    addPromptBtn.addEventListener("click", () => {
      promptEditorState = {
        mode: "create",
        groupId: activeGroup.id,
        promptId: null,
        title: "",
        content: ""
      };
      renderPromptsSection();
    });

    const deleteGroupBtn = document.createElement("button");
    deleteGroupBtn.type = "button";
    deleteGroupBtn.className = "prompt-panel-delete-btn";
    deleteGroupBtn.textContent = "删除分组";
    deleteGroupBtn.addEventListener("click", async () => {
      const shouldDelete = window.confirm("是否要删除该提示词分组？");
      if (!shouldDelete) {
        return;
      }
      promptGroups = promptGroups.filter((group) => group.id !== activeGroup.id);
      if (!promptGroups.length) {
        promptGroups = createNormalizedPromptGroups([]);
      }
      activePromptGroupId = promptGroups[0]?.id || null;
      await persistAll();
      renderPromptsSection();
    });

    groupActions.appendChild(renameInput);
    groupActions.appendChild(addPromptBtn);
    if (promptGroups.findIndex((group) => group.id === activeGroup.id) > 0) {
      groupActions.appendChild(deleteGroupBtn);
    }
    header.appendChild(groupActions);
    panel.appendChild(header);

    const list = document.createElement("div");
    list.className = "prompt-cards-list";
    if (!activeGroup.prompts.length) {
      const empty = document.createElement("div");
      empty.className = "site-selection-empty";
      empty.textContent = "当前分组还没有提示词，点击下方按钮添加。";
      list.appendChild(empty);
    } else {
      activeGroup.prompts.forEach((prompt) => {
        list.appendChild(createPromptCard(activeGroup, prompt));
      });
    }
    panel.appendChild(list);

    const bottomAddWrap = document.createElement("div");
    bottomAddWrap.className = "prompt-panel-bottom-add";
    const bottomAddBtn = document.createElement("button");
    bottomAddBtn.type = "button";
    bottomAddBtn.className = "prompt-panel-add-btn";
    bottomAddBtn.textContent = "添加提示词";
    bottomAddBtn.addEventListener("click", () => {
      promptEditorState = {
        mode: "create",
        groupId: activeGroup.id,
        promptId: null,
        title: "",
        content: ""
      };
      renderPromptsSection();
    });
    bottomAddWrap.appendChild(bottomAddBtn);
    panel.appendChild(bottomAddWrap);

    return panel;
  }

  function createPromptCard(group, prompt) {
    const item = document.createElement("article");
    item.className = "prompt-card-item";

    const inline = document.createElement("div");
    inline.className = "prompt-card-inline";

    const iconGroup = document.createElement("div");
    iconGroup.className = "prompt-card-icon-group";

    // 铅笔编辑按钮
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "prompt-icon-btn prompt-edit-icon-btn";
    editBtn.setAttribute("aria-label", "编辑");
    editBtn.title = "编辑";
    editBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    editBtn.addEventListener("click", () => {
      promptEditorState = {
        mode: "edit",
        groupId: group.id,
        promptId: prompt.id,
        title: prompt.title || "",
        content: prompt.content || ""
      };
      renderPromptsSection();
    });

    // 眼睛预览按钮及悬浮浮层
    const previewWrap = document.createElement("div");
    previewWrap.className = "prompt-preview-wrap";

    const previewBtn = document.createElement("button");
    previewBtn.type = "button";
    previewBtn.className = "prompt-icon-btn prompt-preview-icon-btn";
    previewBtn.setAttribute("aria-label", "预览");
    previewBtn.title = "预览内容";
    previewBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

    const popup = document.createElement("div");
    popup.className = "prompt-preview-popup";
    popup.setAttribute("aria-hidden", "true");
    popup.innerHTML = `
      <div class="prompt-preview-popup-title">${escapeHtml(prompt.title || "未命名提示词")}</div>
      <div class="prompt-preview-popup-body">${escapeHtml(prompt.content || "（暂无内容）")}</div>
    `;
    popup.style.display = "none";

    let popupHideTimer = null;

    function showPopup() {
      if (popupHideTimer) {
        clearTimeout(popupHideTimer);
        popupHideTimer = null;
      }
      popup.style.display = "block";
      popup.classList.add("is-visible");

      // 防止超出右侧边界，动态调整弹出方向
      requestAnimationFrame(() => {
        const rect = popup.getBoundingClientRect();
        if (rect.right > window.innerWidth - 8) {
          popup.style.left = "auto";
          popup.style.right = "0";
        } else {
          popup.style.left = "0";
          popup.style.right = "auto";
        }
      });
    }

    function hidePopup() {
      popupHideTimer = setTimeout(() => {
        popup.style.display = "none";
        popup.classList.remove("is-visible");
      }, 120);
    }

    previewBtn.addEventListener("mouseenter", showPopup);
    previewBtn.addEventListener("mouseleave", hidePopup);
    popup.addEventListener("mouseenter", () => {
      if (popupHideTimer) {
        clearTimeout(popupHideTimer);
        popupHideTimer = null;
      }
    });
    popup.addEventListener("mouseleave", hidePopup);

    previewWrap.appendChild(previewBtn);
    previewWrap.appendChild(popup);

    iconGroup.appendChild(editBtn);
    iconGroup.appendChild(previewWrap);

    const titleEl = document.createElement("div");
    titleEl.className = "prompt-card-title";
    titleEl.textContent = prompt.title || "未命名提示词";

    inline.appendChild(iconGroup);
    inline.appendChild(titleEl);
    item.appendChild(inline);

    return item;
  }

  function createPromptEditorModal() {
    if (!promptEditorState) {
      return document.createElement("div");
    }

    const editorState = promptEditorState;
    const editorGroup = promptGroups.find((group) => group.id === editorState.groupId) || promptGroups[0];
    const overlay = document.createElement("div");
    overlay.className = "prompt-editor-overlay";

    const modal = document.createElement("div");
    modal.className = "prompt-editor-modal";
    modal.innerHTML = `
      <div class="prompt-editor-title">${editorState.mode === "edit" ? "编辑提示词" : "添加提示词"}</div>
      <label class="field-label">名称</label>
      <input class="prompt-editor-title-input" type="text" value="${escapeHtml(editorState.title || "")}" />
      <label class="field-label">分类</label>
      <select class="prompt-editor-group-select">
        ${promptGroups.map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === editorGroup.id ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}
      </select>
      <label class="field-label">提示词内容</label>
      <textarea class="prompt-editor-content-input">${escapeHtml(editorState.content || "")}</textarea>
      <div class="prompt-editor-actions">
        ${editorState.mode === "edit" ? '<button class="prompt-editor-delete-btn" type="button">删除</button>' : '<span></span>'}
        <div class="prompt-editor-main-actions">
          <button class="prompt-editor-cancel-btn" type="button">取消</button>
          <button class="prompt-editor-save-btn" type="button">保存</button>
        </div>
      </div>
    `;

    const titleInput = modal.querySelector(".prompt-editor-title-input");
    const groupSelect = modal.querySelector(".prompt-editor-group-select");
    const contentInput = modal.querySelector(".prompt-editor-content-input");
    const cancelBtn = modal.querySelector(".prompt-editor-cancel-btn");
    const saveBtn = modal.querySelector(".prompt-editor-save-btn");

    if (titleInput) {
      titleInput.addEventListener("input", (event) => {
        const nextValue = event.target instanceof HTMLInputElement ? event.target.value : "";
        promptEditorState.title = nextValue;
      });
    }
    if (groupSelect) {
      groupSelect.addEventListener("change", (event) => {
        const nextValue = event.target instanceof HTMLSelectElement ? event.target.value : editorState.groupId;
        promptEditorState.groupId = nextValue;
      });
    }
    if (contentInput) {
      contentInput.addEventListener("input", (event) => {
        const nextValue = event.target instanceof HTMLTextAreaElement ? event.target.value : "";
        promptEditorState.content = nextValue;
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        promptEditorState = null;
        renderPromptsSection();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const targetGroup = promptGroups.find((group) => group.id === promptEditorState.groupId);
        if (!targetGroup) {
          return;
        }

        if (promptEditorState.mode === "edit") {
          promptGroups.forEach((group) => {
            group.prompts = group.prompts.filter((prompt) => prompt.id !== promptEditorState.promptId);
          });
        }

        targetGroup.prompts.push({
          id: promptEditorState.promptId || `prompt-${Date.now()}`,
          title: promptEditorState.title || "未命名提示词",
          content: promptEditorState.content || ""
        });
        activePromptGroupId = targetGroup.id;
        promptEditorState = null;
        await persistAll();
        renderPromptsSection();
      });
    }

    const deleteBtn = modal.querySelector(".prompt-editor-delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        const shouldDelete = window.confirm("是否要删除该提示词？");
        if (!shouldDelete) {
          return;
        }
        promptGroups.forEach((group) => {
          group.prompts = group.prompts.filter((prompt) => prompt.id !== promptEditorState.promptId);
        });
        promptEditorState = null;
        await persistAll();
        renderPromptsSection();
      });
    }

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        promptEditorState = null;
        renderPromptsSection();
      }
    });

    overlay.appendChild(modal);
    return overlay;
  }

  function setActivePickerCategory(categoryKey) {
    if (activePickerCategoryKey === categoryKey) {
      return;
    }
    activePickerCategoryKey = categoryKey;
    renderGroupsSection();
  }

  function clearPickerCloseTimer() {
    if (pickerCloseTimerId) {
      window.clearTimeout(pickerCloseTimerId);
      pickerCloseTimerId = null;
    }
  }

  function schedulePickerClose() {
    clearPickerCloseTimer();
    pickerCloseTimerId = window.setTimeout(() => {
      closePicker();
      renderGroupsSection();
    }, PICKER_CLOSE_DELAY_MS);
  }

  function closePicker() {
    clearPickerCloseTimer();
    openPickerGroupId = null;
    activePickerCategoryKey = null;
  }

  function reorderGroupSites(group, sourceSiteId, targetSiteId) {
    if (!sourceSiteId) return Promise.resolve();
    const currentGroup = getGroupById(group.id);
    if (!currentGroup) return Promise.resolve();
    const nextSiteIds = [...currentGroup.siteIds];
    const sourceIndex = nextSiteIds.indexOf(sourceSiteId);
    if (sourceIndex === -1) return Promise.resolve();
    nextSiteIds.splice(sourceIndex, 1);
    if (!targetSiteId || !nextSiteIds.includes(targetSiteId)) {
      nextSiteIds.push(sourceSiteId);
    } else {
      nextSiteIds.splice(nextSiteIds.indexOf(targetSiteId), 0, sourceSiteId);
    }
    currentGroup.siteIds = nextSiteIds;
    markDirty();
    return persistAll().then(() => {
      renderGroupsSection();
    });
  }

  function reorderGroups(sourceGroupId, targetGroupId) {
    if (!sourceGroupId || !targetGroupId || sourceGroupId === targetGroupId) {
      return Promise.resolve();
    }

    const nextGroups = [...groups];
    const sourceIndex = nextGroups.findIndex((group) => group.id === sourceGroupId);
    const targetIndex = nextGroups.findIndex((group) => group.id === targetGroupId);
    if (sourceIndex === -1 || targetIndex === -1) {
      return Promise.resolve();
    }

    const [movedGroup] = nextGroups.splice(sourceIndex, 1);
    nextGroups.splice(targetIndex, 0, movedGroup);
    groups = nextGroups;
    markDirty();
    return persistAll().then(() => {
      renderGroupsSection();
    });
  }

  function getCategorySites(categoryKey) {
    const category = SITE_CATEGORIES[categoryKey];
    if (!category) return [];
    return category.siteIds.map((siteId) => sites.find((site) => site.id === siteId)).filter(Boolean);
  }

  function markDirty() {}

  function createPickerSiteOption(group, site, categoryKey) {
    const label = document.createElement("label");
    label.className = "hover-picker-option";
    const checked = group.siteIds.includes(site.id);
    label.innerHTML = `
      <span class="hover-picker-option-text">${escapeHtml(site.name)}</span>
      <input type="checkbox" ${checked ? "checked" : ""} />
    `;
    const checkbox = label.querySelector("input");
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", async () => {
      const currentGroup = getGroupById(group.id);
      if (!currentGroup) {
        return;
      }
      if (checkbox.checked) {
        currentGroup.siteIds = [...currentGroup.siteIds, site.id];
      } else {
        currentGroup.siteIds = currentGroup.siteIds.filter((id) => id !== site.id);
      }
      await persistAll();
      openPickerGroupId = currentGroup.id;
      activePickerCategoryKey = categoryKey;
      clearPickerCloseTimer();
      renderGroupsSection();
    });
    return label;
  }

  async function persistAll() {
    groups = createNormalizedGroups(groups);
    promptGroups = createNormalizedPromptGroups(promptGroups);
    uiPrefs = createNormalizedUiPrefs(uiPrefs);
    await chrome.storage.local.set({
      [GROUPS_STORAGE_KEY]: groups,
      [PROMPTS_STORAGE_KEY]: promptGroups,
      [UI_PREFS_STORAGE_KEY]: uiPrefs
    });
  }

  async function loadSites() {
    const response = await fetch(chrome.runtime.getURL("config/siteHandlers.json"));
    const payload = await response.json();
    return (payload.sites || []).filter((site) => site.enabled !== false);
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
