(function initSettingsPage() {
  const GROUPS_STORAGE_KEY = "searchGroups";
  const PROMPTS_STORAGE_KEY = "promptGroups";
  const UI_PREFS_STORAGE_KEY = "uiPrefs";
  const CUSTOM_SITES_STORAGE_KEY = "customSites";
  const PICKER_CLOSE_DELAY_MS = 320;
  const COMMON_SEARCH_PARAM_KEYS = ["q", "query", "wd", "word", "kw", "keyword", "s", "search", "key", "k", "text", "term", "w"];
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
      subtitle: "管理搜索组名称、打开方式，以及每个组内调用的网站或 AI 模型。"
    },
    prompts: {
      eyebrow: "提示词设置",
      title: "提示词与分组",
      subtitle: "先做一个简洁版本：创建提示词分组，并在分组内维护标题与内容。"
    },
    custom: {
      eyebrow: "自定义搜索",
      title: "自定义搜索站点",
      subtitle: "添加自己的搜索站点，保存后可在搜索组的“自定义”分类中直接勾选。"
    },
    other: {
      eyebrow: "其他设置",
      title: "首页显示控制",
      subtitle: "控制首页中历史记录、随机骰子和提示词入口是否显示。"
    }
  };

  const groupsSection = document.getElementById("groupsSection");
  const promptsSection = document.getElementById("promptsSection");
  const customSection = document.getElementById("customSection");
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
  let customSites = [];
  let customFormState = createBlankCustomFormState();
  let activeSection = "groups";
  let openPickerGroupId = null;
  let activePickerCategoryKey = null;
  let pickerCloseTimerId = null;
  let activePromptGroupId = null;
  let promptEditorState = null;
  let pendingPromptGroupFocusId = null;

  document.addEventListener("DOMContentLoaded", start);

  async function start() {
    const builtinSites = await loadBuiltinSites();
    const stored = await chrome.storage.local.get([
      GROUPS_STORAGE_KEY,
      PROMPTS_STORAGE_KEY,
      UI_PREFS_STORAGE_KEY,
      CUSTOM_SITES_STORAGE_KEY
    ]);
    customSites = createNormalizedCustomSites(stored[CUSTOM_SITES_STORAGE_KEY]);
    sites = mergeSites(builtinSites, customSites);
    syncCustomCategoryIds();
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
    if (!Array.isArray(stored[CUSTOM_SITES_STORAGE_KEY])) {
      await chrome.storage.local.set({ [CUSTOM_SITES_STORAGE_KEY]: customSites });
    }
    bindEvents();
    const hashSection = new URLSearchParams(location.search).get("section") || location.hash.replace("#", "");
    if (hashSection && SECTION_META[hashSection]) {
      setActiveSection(hashSection);
    } else {
      renderCurrentSection();
    }
  }

  function bindEvents() {
    document.addEventListener("click", handleDocumentClick);
    attachGroupDrag(groupsSection);

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
    if (activeSection === "custom") {
      renderCustomSection();
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
    const showCustom = activeSection === "custom";
    const showOther = activeSection === "other";
    groupsSection.hidden = !showGroups;
    promptsSection.hidden = !showPrompts;
    customSection.hidden = !showCustom;
    otherSection.hidden = !showOther;
    groupsSection.style.display = showGroups ? "flex" : "none";
    promptsSection.style.display = showPrompts ? "flex" : "none";
    customSection.style.display = showCustom ? "flex" : "none";
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
    addCard.innerHTML = `<button class="add-section-btn" type="button">新增搜索组</button>`;
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

    const selectedSites = group.siteIds.map((siteId) => sites.find((site) => site.id === siteId)).filter(Boolean);
    selectedSites.forEach((site) => chipsWrap.appendChild(createSelectedChip(group, site)));

    chipsWrap.appendChild(createInlineAdd(group));
    attachChipDrag(chipsWrap, group);
    rightPanel.appendChild(chipsWrap);
    card.appendChild(leftPanel);
    card.appendChild(rightPanel);

    if (!isLocked) {
      const dragHandle = document.createElement("button");
      dragHandle.type = "button";
      dragHandle.className = "group-drag-handle";
      dragHandle.setAttribute("aria-label", "拖动调整搜索组顺序");
      dragHandle.innerHTML = `<svg viewBox="0 0 1024 1024" aria-hidden="true" class="group-drag-handle-svg"><path d="M716.8 212.48c-10.24 0-17.92 2.56-25.6 5.12v-5.12c0-43.52-33.28-76.8-76.8-76.8-10.24 0-17.92 2.56-28.16 5.12C581.12 104.96 550.4 76.8 512 76.8c-43.52 0-76.8 33.28-76.8 76.8v5.12c-7.68-2.56-15.36-5.12-25.6-5.12-43.52 0-76.8 33.28-76.8 76.8v104.96c-7.68-2.56-15.36-5.12-25.6-5.12-43.52 0-76.8 33.28-76.8 76.8v256c0 156.16 125.44 281.6 281.6 281.6s281.6-125.44 281.6-281.6V289.28c0-43.52-33.28-76.8-76.8-76.8zM742.4 665.6c0 128-102.4 230.4-230.4 230.4s-230.4-102.4-230.4-230.4V409.6c0-15.36 10.24-25.6 25.6-25.6s25.6 10.24 25.6 25.6v209.92h43.52c56.32 5.12 110.08 33.28 143.36 79.36l40.96-30.72c-40.96-56.32-107.52-94.72-176.64-99.84V230.4c0-15.36 10.24-25.6 25.6-25.6s25.6 10.24 25.6 25.6v256h51.2V153.6c0-15.36 10.24-25.6 25.6-25.6s25.6 10.24 25.6 25.6v335.36h51.2V212.48c0-15.36 10.24-25.6 25.6-25.6s25.6 10.24 25.6 25.6v276.48h51.2v-199.68c0-15.36 10.24-25.6 25.6-25.6s25.6 10.24 25.6 25.6V665.6z" fill="#525C6A"></path></svg>`;
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
    chip.dataset.siteId = site.id;
    chip.innerHTML = `<span class="site-chip-label">${escapeHtml(site.name)}</span><button class="chip-remove-btn" type="button" aria-label="删除 ${escapeHtml(site.name)}">×</button>`;

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
        if (!categorySites.length) {
          const empty = document.createElement("div");
          empty.className = "hover-picker-empty";
          empty.innerHTML = `还没有自定义站点<br/><span class="hover-picker-empty-hint">前往左侧「自定义搜索」添加</span>`;
          submenu.appendChild(empty);
        } else {
          categorySites.forEach((site) => {
            submenu.appendChild(createPickerSiteOption(group, site, key));
          });
        }
      } else if (key === "ai") {
        submenu.classList.add("hover-picker-submenu--ai");

        const columnsWrap = document.createElement("div");
        columnsWrap.className = "hover-picker-ai-columns";

        AI_SITE_GROUPS.forEach((marketGroup) => {
          const groupSites = marketGroup.siteIds
            .map((siteId) => categorySites.find((site) => site.id === siteId))
            .filter(Boolean);
          if (!groupSites.length) return;

          const col = document.createElement("div");
          col.className = "hover-picker-ai-col";

          const colTitle = document.createElement("div");
          colTitle.className = "hover-picker-site-group-title";
          colTitle.textContent = marketGroup.label;
          col.appendChild(colTitle);

          groupSites.forEach((site) => {
            col.appendChild(createPickerSiteOption(group, site, key));
          });
          columnsWrap.appendChild(col);
        });
        submenu.appendChild(columnsWrap);

        const presetDivider = document.createElement("div");
        presetDivider.className = "hover-picker-preset-divider";
        submenu.appendChild(presetDivider);

        const presetHeader = document.createElement("div");
        presetHeader.className = "hover-picker-site-group-title";
        presetHeader.textContent = "推荐组合";
        submenu.appendChild(presetHeader);

        const AI_PRESETS = [
          { label: "混合使用", siteIds: ["chatgpt", "gemini", "deepseek", "doubao", "kimi"] },
          { label: "国内精选", siteIds: ["deepseek", "doubao", "kimi", "metaso"] },
          { label: "海外组", siteIds: ["gemini", "chatgpt"] }
        ];

        const presetsWrap = document.createElement("div");
        presetsWrap.className = "hover-picker-presets";

        AI_PRESETS.forEach((preset) => {
          const siteNames = preset.siteIds
            .map((id) => sites.find((s) => s.id === id)?.name)
            .filter(Boolean)
            .join(" · ");

          const item = document.createElement("div");
          item.className = "hover-picker-preset-item";

          const info = document.createElement("div");
          info.className = "hover-picker-preset-info";
          info.innerHTML = `<span class="hover-picker-preset-label">${escapeHtml(preset.label)}</span><span class="hover-picker-preset-sites">${escapeHtml(siteNames)}</span>`;

          const applyBtn = document.createElement("button");
          applyBtn.type = "button";
          applyBtn.className = "hover-picker-preset-apply";
          applyBtn.textContent = "使用该组合";
          applyBtn.addEventListener("click", async (event) => {
            event.stopPropagation();
            const currentGroup = getGroupById(group.id);
            if (!currentGroup) return;
            currentGroup.siteIds = preset.siteIds.filter((id) => sites.find((s) => s.id === id));
            await persistAll();
            openPickerGroupId = currentGroup.id;
            activePickerCategoryKey = key;
            clearPickerCloseTimer();
            renderGroupsSection();
          });

          item.appendChild(info);
          item.appendChild(applyBtn);
          presetsWrap.appendChild(item);
        });
        submenu.appendChild(presetsWrap);
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

  function createBlankCustomFormState() {
    return {
      mode: "create",
      editingId: null,
      name: "",
      url: "",
      converterInput: "",
      converterError: "",
      formError: ""
    };
  }

  function createNormalizedCustomSites(input) {
    if (!Array.isArray(input)) {
      return [];
    }
    const seenIds = new Set();
    return input
      .map((raw) => {
        if (!raw || typeof raw !== "object") return null;
        const name = String(raw.name || "").trim();
        const url = String(raw.url || "").trim();
        if (!name || !url) return null;
        let id = String(raw.id || "").trim();
        if (!id || seenIds.has(id)) {
          id = createCustomSiteId();
        }
        seenIds.add(id);
        return {
          id,
          name,
          url,
          enabled: raw.enabled !== false,
          supportIframe: raw.supportIframe !== false,
          supportUrlQuery: raw.supportUrlQuery !== false && url.includes("{query}"),
          matchPatterns: Array.isArray(raw.matchPatterns) && raw.matchPatterns.length > 0
            ? raw.matchPatterns.map((pattern) => String(pattern))
            : deriveMatchPatterns(url),
          isCustom: true
        };
      })
      .filter(Boolean);
  }

  function createCustomSiteId() {
    return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function deriveMatchPatterns(url) {
    try {
      const normalized = normalizeUrlForParse(url);
      const host = new URL(normalized).hostname.replace(/^www\./, "");
      return host ? [host] : [];
    } catch (_error) {
      return [];
    }
  }

  function normalizeUrlForParse(url) {
    const trimmed = String(url || "").trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return `https://${trimmed}`;
  }

  function mergeSites(builtin, custom) {
    const result = Array.isArray(builtin) ? [...builtin] : [];
    const knownIds = new Set(result.map((site) => site.id));
    (custom || []).forEach((site) => {
      if (!site || knownIds.has(site.id)) return;
      result.push(site);
      knownIds.add(site.id);
    });
    return result;
  }

  function syncCustomCategoryIds() {
    SITE_CATEGORIES.custom.siteIds = customSites.map((site) => site.id);
  }

  function convertUrlToTemplate(rawUrl) {
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed) {
      return { ok: false, error: "请先粘贴一个 URL 再转换。" };
    }
    if (trimmed.includes("{query}")) {
      return { ok: true, url: trimmed, name: guessSiteNameFromUrl(trimmed) };
    }

    let parsed;
    try {
      parsed = new URL(normalizeUrlForParse(trimmed));
    } catch (_error) {
      return { ok: false, error: "URL 格式不正确，请检查后重试。" };
    }

    const params = parsed.searchParams;
    const paramKeys = Array.from(params.keys());
    if (paramKeys.length > 0) {
      const priorityKey = COMMON_SEARCH_PARAM_KEYS.find((key) =>
        paramKeys.some((item) => item.toLowerCase() === key)
      );
      let targetKey = null;
      if (priorityKey) {
        targetKey = paramKeys.find((item) => item.toLowerCase() === priorityKey) || null;
      } else {
        targetKey = paramKeys.find((key) => String(params.get(key) || "").trim().length > 0) || paramKeys[0];
      }
      if (targetKey) {
        params.set(targetKey, "__AI_CUSTOM_QUERY_PLACEHOLDER__");
        const rebuilt = parsed.toString().replace("__AI_CUSTOM_QUERY_PLACEHOLDER__", "{query}");
        return { ok: true, url: rebuilt, name: guessSiteNameFromUrl(rebuilt) };
      }
    }

    return {
      ok: false,
      error: "未能自动识别搜索参数，请手动在 URL 中把搜索词替换成 {query}。"
    };
  }

  function guessSiteNameFromUrl(url) {
    try {
      const parsed = new URL(normalizeUrlForParse(url));
      const host = parsed.hostname.replace(/^www\./, "");
      if (!host) return "";
      const first = host.split(".")[0] || host;
      return first.charAt(0).toUpperCase() + first.slice(1);
    } catch (_error) {
      return "";
    }
  }

  function renderCustomSection() {
    customSection.innerHTML = "";

    const converter = document.createElement("section");
    converter.className = "custom-search-card";
    converter.innerHTML = `
      <div class="custom-search-card-head">
        <strong>URL 规则转换</strong>
        <span>粘贴一条带搜索词的 URL，我们尝试自动识别搜索参数并替换为 <code>{query}</code>。</span>
      </div>
      <div class="custom-converter-row">
        <input class="custom-converter-input" type="text" placeholder="例如：https://www.30aitool.com/?s=test&type=post" />
        <button class="custom-converter-btn" type="button">转换</button>
      </div>
      <div class="custom-converter-msg" data-field="converter-msg"></div>
    `;

    const converterInput = converter.querySelector(".custom-converter-input");
    const converterBtn = converter.querySelector(".custom-converter-btn");
    const converterMsg = converter.querySelector("[data-field='converter-msg']");

    if (converterInput instanceof HTMLInputElement) {
      converterInput.value = customFormState.converterInput || "";
      converterInput.addEventListener("input", (event) => {
        customFormState.converterInput = event.target.value;
        customFormState.converterError = "";
        if (converterMsg) {
          converterMsg.textContent = "";
          converterMsg.classList.remove("is-error");
          converterMsg.classList.remove("is-success");
        }
      });
      converterInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          handleConvertClick();
        }
      });
    }

    if (converterBtn) {
      converterBtn.addEventListener("click", handleConvertClick);
    }

    if (customFormState.converterError && converterMsg) {
      converterMsg.textContent = customFormState.converterError;
      converterMsg.classList.add("is-error");
    }

    function handleConvertClick() {
      const result = convertUrlToTemplate(customFormState.converterInput);
      if (!result.ok) {
        customFormState.converterError = result.error;
        if (converterMsg) {
          converterMsg.textContent = result.error;
          converterMsg.classList.add("is-error");
          converterMsg.classList.remove("is-success");
        }
        return;
      }
      customFormState.url = result.url;
      if (!customFormState.name && result.name) {
        customFormState.name = result.name;
      }
      customFormState.formError = "";
      customFormState.converterError = "";
      renderCustomSection();
    }

    customSection.appendChild(converter);

    const form = document.createElement("section");
    form.className = "custom-search-card";
    const isEditing = customFormState.mode === "edit";
    form.innerHTML = `
      <div class="custom-search-card-head">
        <strong>${isEditing ? "编辑自定义站点" : "手动添加"}</strong>
        <span>填写站点名称与 URL，<code>{query}</code> 会在搜索时自动替换为你的关键词。</span>
      </div>
      <label class="custom-field">
        <span class="field-label inline-field-label">名称</span>
        <input class="custom-form-input" type="text" data-field="name" placeholder="例如：30AI 工具导航" />
      </label>
      <label class="custom-field">
        <span class="field-label inline-field-label">URL 链接</span>
        <input class="custom-form-input" type="text" data-field="url" placeholder="例如：https://www.example.com/?s={query}" />
      </label>
      <div class="custom-form-msg" data-field="form-msg"></div>
      <div class="custom-form-actions">
        ${isEditing ? '<button class="custom-form-cancel-btn" type="button">取消编辑</button>' : ""}
        <button class="custom-form-submit-btn" type="button">${isEditing ? "保存修改" : "确定添加"}</button>
      </div>
    `;

    const nameInput = form.querySelector("[data-field='name']");
    const urlInput = form.querySelector("[data-field='url']");
    const formMsg = form.querySelector("[data-field='form-msg']");
    const submitBtn = form.querySelector(".custom-form-submit-btn");
    const cancelBtn = form.querySelector(".custom-form-cancel-btn");

    if (nameInput instanceof HTMLInputElement) {
      nameInput.value = customFormState.name || "";
      nameInput.addEventListener("input", (event) => {
        customFormState.name = event.target.value;
      });
    }
    if (urlInput instanceof HTMLInputElement) {
      urlInput.value = customFormState.url || "";
      urlInput.addEventListener("input", (event) => {
        customFormState.url = event.target.value;
      });
    }
    if (customFormState.formError && formMsg) {
      formMsg.textContent = customFormState.formError;
      formMsg.classList.add("is-error");
    }
    if (submitBtn) {
      submitBtn.addEventListener("click", handleCustomFormSubmit);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        customFormState = createBlankCustomFormState();
        renderCustomSection();
      });
    }

    customSection.appendChild(form);

    const listCard = document.createElement("section");
    listCard.className = "custom-search-card custom-sites-list-card";
    const header = document.createElement("div");
    header.className = "custom-search-card-head";
    header.innerHTML = `
      <strong>已添加的自定义站点</strong>
      <span>当前共 ${customSites.length} 个自定义站点。</span>
    `;
    listCard.appendChild(header);

    if (!customSites.length) {
      const empty = document.createElement("div");
      empty.className = "site-selection-empty";
      empty.textContent = "还没有自定义站点，上方添加后会在这里显示。";
      listCard.appendChild(empty);
    } else {
      const list = document.createElement("div");
      list.className = "custom-sites-list";
      customSites.forEach((site) => {
        list.appendChild(createCustomSiteRow(site));
      });
      listCard.appendChild(list);
    }

    customSection.appendChild(listCard);
  }

  function createCustomSiteRow(site) {
    const row = document.createElement("article");
    row.className = "custom-site-row";
    row.innerHTML = `
      <div class="custom-site-info">
        <div class="custom-site-name">${escapeHtml(site.name)}</div>
        <div class="custom-site-url">${escapeHtml(site.url)}</div>
      </div>
      <div class="custom-site-actions">
        <button class="custom-site-edit-btn" type="button">编辑</button>
        <button class="custom-site-delete-btn" type="button" aria-label="删除">×</button>
      </div>
    `;

    const editBtn = row.querySelector(".custom-site-edit-btn");
    const deleteBtn = row.querySelector(".custom-site-delete-btn");

    editBtn?.addEventListener("click", () => {
      customFormState = {
        mode: "edit",
        editingId: site.id,
        name: site.name,
        url: site.url,
        converterInput: "",
        converterError: "",
        formError: ""
      };
      renderCustomSection();
      customSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    deleteBtn?.addEventListener("click", async () => {
      const confirmed = window.confirm(`是否要删除自定义站点「${site.name}」？\n删除后，所有搜索组中引用该站点的记录也会同步移除。`);
      if (!confirmed) return;
      customSites = customSites.filter((item) => item.id !== site.id);
      groups = groups.map((group) => ({
        ...group,
        siteIds: (group.siteIds || []).filter((id) => id !== site.id)
      }));
      if (customFormState.mode === "edit" && customFormState.editingId === site.id) {
        customFormState = createBlankCustomFormState();
      }
      await persistAll();
      renderCustomSection();
    });

    return row;
  }

  async function handleCustomFormSubmit() {
    const name = String(customFormState.name || "").trim();
    const url = String(customFormState.url || "").trim();

    if (!name) {
      customFormState.formError = "请输入站点名称。";
      renderCustomSection();
      return;
    }
    if (!url) {
      customFormState.formError = "请输入 URL 链接。";
      renderCustomSection();
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      customFormState.formError = "URL 必须以 http:// 或 https:// 开头。";
      renderCustomSection();
      return;
    }
    if (!url.includes("{query}")) {
      customFormState.formError = "URL 中必须包含 {query} 作为搜索词占位符。";
      renderCustomSection();
      return;
    }
    try {
      new URL(url.replace("{query}", "ai"));
    } catch (_error) {
      customFormState.formError = "URL 格式不合法，请检查后重试。";
      renderCustomSection();
      return;
    }

    if (customFormState.mode === "edit" && customFormState.editingId) {
      customSites = customSites.map((site) =>
        site.id === customFormState.editingId
          ? {
              ...site,
              name,
              url,
              supportUrlQuery: true,
              matchPatterns: deriveMatchPatterns(url)
            }
          : site
      );
    } else {
      const newSite = {
        id: createCustomSiteId(),
        name,
        url,
        enabled: true,
        supportIframe: true,
        supportUrlQuery: true,
        matchPatterns: deriveMatchPatterns(url),
        isCustom: true
      };
      customSites = [...customSites, newSite];
    }

    customFormState = createBlankCustomFormState();
    await persistAll();
    renderCustomSection();
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

  function attachGroupDrag(container) {
    container.addEventListener("pointerdown", onGroupPointerDown);

    function onGroupPointerDown(e) {
      const handle = e.target.closest(".group-drag-handle");
      if (!handle) return;
      const card = handle.closest(".settings-group-card");
      if (!card) return;

      e.preventDefault();

      const rect = card.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const cardBorderRadius = window.getComputedStyle(card).borderRadius || "18px";

      const clone = card.cloneNode(true);
      clone.style.cssText = [
        "position:fixed",
        `left:${rect.left}px`,
        `top:${rect.top}px`,
        `width:${rect.width}px`,
        "pointer-events:none",
        "z-index:9999",
        "box-shadow:0 12px 40px rgba(0,0,0,0.16)",
        "opacity:0.96",
        "transition:none",
        `border-radius:${cardBorderRadius}`
      ].join(";");
      document.body.appendChild(clone);

      card.style.opacity = "0";
      card.style.pointerEvents = "none";

      const lockedGroupId = groups[0]?.id;
      let lastInsertBefore = null;

      function onMove(ev) {
        clone.style.top = `${ev.clientY - offsetY}px`;

        const cloneCenterY = ev.clientY - offsetY + rect.height / 2;
        const otherCards = Array.from(container.querySelectorAll(".settings-group-card")).filter((c) => c !== card);
        const addCard = container.querySelector(".settings-add-card");
        let newInsertBefore = addCard;

        for (const other of otherCards) {
          const r = other.getBoundingClientRect();
          if (cloneCenterY < r.top + r.height / 2) {
            newInsertBefore = other;
            break;
          }
        }

        if (newInsertBefore && newInsertBefore.dataset && newInsertBefore.dataset.groupId === lockedGroupId) {
          newInsertBefore = newInsertBefore.nextElementSibling || addCard;
        }

        if (newInsertBefore !== lastInsertBefore) {
          const allCards = Array.from(container.querySelectorAll(".settings-group-card"));
          const firstPositions = new Map();
          allCards.forEach((el) => firstPositions.set(el, el.getBoundingClientRect()));

          container.insertBefore(card, newInsertBefore);
          lastInsertBefore = newInsertBefore;

          allCards
            .filter((el) => el !== card)
            .forEach((el) => {
              const first = firstPositions.get(el);
              if (!first) return;
              const last = el.getBoundingClientRect();
              const dy = first.top - last.top;
              if (Math.abs(dy) < 1) return;
              el.style.transition = "none";
              el.style.transform = `translateY(${dy}px)`;
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  el.style.transition = "transform 200ms cubic-bezier(0.2,0,0,1)";
                  el.style.transform = "";
                });
              });
            });
        }
      }

      function onUp() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);

        const finalRect = card.getBoundingClientRect();
        clone.style.transition = "top 160ms ease, box-shadow 160ms ease, opacity 160ms ease";
        clone.style.top = `${finalRect.top}px`;
        clone.style.boxShadow = "none";
        clone.style.opacity = "0";

        setTimeout(() => {
          clone.remove();
          card.style.opacity = "";
          card.style.pointerEvents = "";

          Array.from(container.querySelectorAll(".settings-group-card")).forEach((el) => {
            el.style.transition = "";
            el.style.transform = "";
          });

          const newGroupIds = Array.from(container.querySelectorAll(".settings-group-card")).map((c) => c.dataset.groupId);
          const reordered = newGroupIds.map((id) => groups.find((g) => g.id === id)).filter(Boolean);
          if (reordered.length === groups.length) {
            groups = reordered;
            persistAll();
          }
        }, 160);
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    }
  }

  function attachChipDrag(chipsWrap, group) {
    chipsWrap.addEventListener("pointerdown", onPointerDown);

    function onPointerDown(e) {
      const chip = e.target.closest(".selected-chip");
      if (!chip || e.target.closest(".chip-remove-btn")) return;

      e.preventDefault();

      const rect = chip.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      const clone = chip.cloneNode(true);
      clone.style.cssText = [
        `position:fixed`,
        `left:${rect.left}px`,
        `top:${rect.top}px`,
        `width:${rect.width}px`,
        `height:${rect.height}px`,
        `margin:0`,
        `pointer-events:none`,
        `z-index:9999`,
        `box-shadow:0 6px 20px rgba(0,0,0,0.18)`,
        `opacity:1`,
        `cursor:grabbing`,
        `transition:none`
      ].join(";");
      document.body.appendChild(clone);

      chip.classList.add("is-chip-placeholder");
      chipsWrap.classList.add("is-chip-dragging-active");

      let lastInsertBefore = null;

      function onMove(ev) {
        clone.style.left = `${ev.clientX - offsetX}px`;
        clone.style.top = `${ev.clientY - offsetY}px`;

        const cloneCenterX = ev.clientX - offsetX + rect.width / 2;
        const cloneCenterY = ev.clientY - offsetY + rect.height / 2;

        const otherChips = Array.from(chipsWrap.querySelectorAll(".selected-chip")).filter((c) => c !== chip);
        const addWrap = chipsWrap.querySelector(".inline-add-wrap");
        let newInsertBefore = addWrap;

        for (const other of otherChips) {
          const r = other.getBoundingClientRect();
          const midX = r.left + r.width / 2;
          const midY = r.top + r.height / 2;
          if (
            cloneCenterY < midY - r.height * 0.4 ||
            (Math.abs(cloneCenterY - midY) <= r.height * 0.6 && cloneCenterX < midX)
          ) {
            newInsertBefore = other;
            break;
          }
        }

        if (newInsertBefore !== lastInsertBefore) {
          const allChips = Array.from(chipsWrap.querySelectorAll(".selected-chip"));
          const firstPositions = new Map();
          allChips.forEach((el) => firstPositions.set(el, el.getBoundingClientRect()));

          chipsWrap.insertBefore(chip, newInsertBefore);
          lastInsertBefore = newInsertBefore;

          allChips
            .filter((el) => el !== chip)
            .forEach((el) => {
              const first = firstPositions.get(el);
              if (!first) return;
              const last = el.getBoundingClientRect();
              const dx = first.left - last.left;
              const dy = first.top - last.top;
              if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
              el.style.transition = "none";
              el.style.transform = `translate(${dx}px,${dy}px)`;
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  el.style.transition = "transform 180ms cubic-bezier(0.2,0,0,1)";
                  el.style.transform = "";
                });
              });
            });
        }
      }

      function onUp() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);

        const finalRect = chip.getBoundingClientRect();
        clone.style.transition = "left 150ms ease, top 150ms ease, box-shadow 150ms ease, opacity 150ms ease";
        clone.style.left = `${finalRect.left}px`;
        clone.style.top = `${finalRect.top}px`;
        clone.style.boxShadow = "none";
        clone.style.opacity = "0";

        setTimeout(() => {
          clone.remove();
          chip.classList.remove("is-chip-placeholder");
          chipsWrap.classList.remove("is-chip-dragging-active");

          Array.from(chipsWrap.querySelectorAll(".selected-chip")).forEach((el) => {
            el.style.transition = "";
            el.style.transform = "";
          });

          const newSiteIds = Array.from(chipsWrap.querySelectorAll(".selected-chip")).map((c) => c.dataset.siteId);
          const currentGroup = getGroupById(group.id);
          if (currentGroup) {
            currentGroup.siteIds = newSiteIds;
            persistAll();
          }
        }, 150);
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    }
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
    customSites = createNormalizedCustomSites(customSites);
    const builtinSites = sites.filter((site) => !site.isCustom);
    sites = mergeSites(builtinSites, customSites);
    syncCustomCategoryIds();
    groups = createNormalizedGroups(groups);
    promptGroups = createNormalizedPromptGroups(promptGroups);
    uiPrefs = createNormalizedUiPrefs(uiPrefs);
    await chrome.storage.local.set({
      [GROUPS_STORAGE_KEY]: groups,
      [PROMPTS_STORAGE_KEY]: promptGroups,
      [UI_PREFS_STORAGE_KEY]: uiPrefs,
      [CUSTOM_SITES_STORAGE_KEY]: customSites
    });
  }

  async function loadBuiltinSites() {
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
