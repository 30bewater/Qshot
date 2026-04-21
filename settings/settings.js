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
      subtitle: "管理搜索组名称、打开方式，以及每个组内调用的网站或 AI 模型。首次加载时部分页面可能未能自动发送，手动刷新后重新发送即可，后续使用会更流畅。"
    },
    prompts: {
      eyebrow: "提示词设置",
      title: "提示词管理",
      subtitle: "自由添加和管理您的常用提示词，让每次输入更高效。"
    },
    custom: {
      eyebrow: "自定义搜索",
      title: "自定义搜索站点",
      subtitle: "添加自己的搜索站点，保存后可在搜索组的“自定义”分类中直接勾选。"
    },
    other: {
      eyebrow: "快捷键设置",
      title: "",
      subtitle: ""
    },
    about: {
      eyebrow: "",
      title: "",
      subtitle: ""
    }
  };

  const groupsSection = document.getElementById("groupsSection");
  const promptsSection = document.getElementById("promptsSection");
  const customSection = document.getElementById("customSection");
  const otherSection = document.getElementById("otherSection");
  const aboutSection = document.getElementById("aboutSection");
  const sectionEyebrow = document.getElementById("sectionEyebrow");
  const sectionLogoWrap = document.getElementById("sectionLogoWrap");
  const sectionTitleRow = document.getElementById("sectionTitleRow");
  const sectionTitle = document.getElementById("sectionTitle");
  const sectionSubtitle = document.getElementById("sectionSubtitle");
  const promptsHeaderActions = document.getElementById("promptsHeaderActions");
  const promptLearnLink = document.getElementById("promptLearnLink");
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
  let renamingPromptGroupId = null;
  let importModalState = null;
  let _promptHoverTimer = null;

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

    document.getElementById("promptExportBtn").addEventListener("click", handleExport);
    document.getElementById("promptImportBtn").addEventListener("click", () => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".md,.json";
      fileInput.addEventListener("change", handleImportFileChange);
      fileInput.click();
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
    sectionEyebrow.hidden = !meta.eyebrow;
    sectionTitle.textContent = meta.title;
    sectionTitle.hidden = !meta.title;
    sectionSubtitle.textContent = meta.subtitle;
    sectionSubtitle.hidden = !meta.subtitle;
    sectionLogoWrap.hidden = sectionKey !== "about";
    sectionTitleRow.hidden = !meta.title && sectionKey !== "prompts";
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
    if (activeSection === "about") {
      renderAboutSection();
      return;
    }
    renderGroupsSection();
  }

  function updateSectionVisibility() {
    const showGroups = activeSection === "groups";
    const showPrompts = activeSection === "prompts";
    const showCustom = activeSection === "custom";
    const showOther = activeSection === "other";
    const showAbout = activeSection === "about";
    groupsSection.hidden = !showGroups;
    promptsSection.hidden = !showPrompts;
    customSection.hidden = !showCustom;
    otherSection.hidden = !showOther;
    aboutSection.hidden = !showAbout;
    groupsSection.style.display = showGroups ? "flex" : "none";
    promptsSection.style.display = showPrompts ? "flex" : "none";
    customSection.style.display = showCustom ? "flex" : "none";
    otherSection.style.display = showOther ? "flex" : "none";
    aboutSection.style.display = showAbout ? "flex" : "none";
    promptsHeaderActions.hidden = !showPrompts;
    promptsHeaderActions.style.display = showPrompts ? "flex" : "none";
    if (promptLearnLink) {
      promptLearnLink.hidden = !showPrompts;
    }
  }

  function createNormalizedGroups(input) {
    const validSiteIds = new Set(sites.map((site) => site.id));
    const source = Array.isArray(input) && input.length > 0
      ? input
      : [
          { id: "default-hunza", name: "混搭搜索", enabled: true, mode: "compare", siteIds: ["gemini", "chatgpt", "deepseek", "doubao", "kimi", "metaso"] },
          { id: "default-overseas", name: "海外模型", enabled: true, mode: "compare", siteIds: ["gemini", "chatgpt", "claude", "grok"] },
          { id: "default-domestic", name: "国内模型", enabled: true, mode: "compare", siteIds: ["deepseek", "doubao", "kimi", "metaso"] },
          { id: "default-single", name: "单个模型", enabled: true, mode: "tabs", siteIds: ["gemini"] }
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
      prewarmEnabled: source.prewarmEnabled !== false,
      overlayShortcutEnabled: source.overlayShortcutEnabled !== false,
      overlayShortcut: normalizeShortcut(source.overlayShortcut)
    };
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

  function formatShortcut(sc) {
    if (!sc || !sc.key) return "未设置";
    const parts = [];
    if (sc.ctrlKey) parts.push("Ctrl");
    if (sc.altKey) parts.push("Alt");
    if (sc.shiftKey) parts.push("Shift");
    if (sc.metaKey) parts.push(/Mac/i.test(navigator.platform) ? "Cmd" : "Win");
    parts.push(sc.key.length === 1 ? sc.key.toUpperCase() : sc.key);
    return parts.join(" + ");
  }

  function isShortcutValid(sc) {
    if (!sc || !sc.key) return false;
    if (sc.key === "Control" || sc.key === "Shift" || sc.key === "Alt" || sc.key === "Meta") return false;
    // 必须至少包含一个修饰键，避免和正常打字冲突
    return sc.ctrlKey || sc.altKey || sc.metaKey || (sc.shiftKey && sc.key.length > 1);
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
        siteIds: []
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
    otherSection.appendChild(createShortcutCard());
    otherSection.appendChild(createSearchConfigIoCard());
  }

  function createShortcutCard() {
    const card = document.createElement("section");
    card.className = "other-settings-card";
    card.innerHTML = `
      <div class="other-settings-intro">
        <strong>全局搜索快捷键</strong>
        <span>在任意网页上用快捷键在屏幕中间快速弹出搜索浮层。</span>
      </div>
      <div class="other-settings-list"></div>
    `;

    const list = card.querySelector(".other-settings-list");
    if (list) {
      list.appendChild(
        createOtherSettingToggle(
          "overlayShortcutEnabled",
          "启用全局搜索快捷键",
          "开启后，按下下方自定义的快捷键即可在当前网页弹出搜索浮层；关闭后快捷键将失效。",
          "在浏览器内页、扩展商店或部分特殊网页中，可能无法通过快捷键唤起。"
        )
      );
      list.appendChild(createShortcutRecorderRow());
      list.appendChild(createShortcutsPageHint());
    }

    return card;
  }

  // ── 搜索配置 导入 / 导出 ──────────────────────────────────────────────────────

  function createSearchConfigIoCard() {
    const card = document.createElement("section");
    card.className = "other-settings-card";
    card.innerHTML = `
      <div class="other-settings-intro">
        <strong>导入 / 导出搜索配置</strong>
        <span>导出当前的搜索组与自定义搜索站点，分享给他人后可一键导入还原。不含提示词设置。</span>
      </div>
      <div class="search-config-io-row">
        <button type="button" class="search-config-io-btn search-config-export-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          导出配置
        </button>
        <button type="button" class="search-config-io-btn search-config-import-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 5 17 10"/><line x1="12" y1="5" x2="12" y2="17"/></svg>
          导入配置
        </button>
        <span class="search-config-io-hint" aria-live="polite"></span>
      </div>
    `;

    card.querySelector(".search-config-export-btn").addEventListener("click", exportSearchConfig);
    card.querySelector(".search-config-import-btn").addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.addEventListener("change", handleSearchConfigImportFile);
      input.click();
    });

    return card;
  }

  function exportSearchConfig() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      searchGroups: groups,
      customSites: customSites
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Qshot搜索配置-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSearchConfigImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    let payload;
    try {
      const text = await file.text();
      payload = JSON.parse(text);
    } catch (_) {
      alert("无法解析文件，请确认是否为从本插件导出的 JSON 配置文件。");
      return;
    }

    if (!payload || typeof payload !== "object" || payload.version !== 1) {
      alert("文件格式不正确，请使用本插件导出的搜索配置文件。");
      return;
    }

    const importedGroups = Array.isArray(payload.searchGroups) ? payload.searchGroups : [];
    const importedCustomSites = Array.isArray(payload.customSites) ? payload.customSites : [];

    if (!importedGroups.length && !importedCustomSites.length) {
      alert("文件中没有可导入的搜索组或自定义站点。");
      return;
    }

    const groupCount = importedGroups.length;
    const siteCount = importedCustomSites.length;
    const desc = [
      groupCount ? `${groupCount} 个搜索组` : "",
      siteCount ? `${siteCount} 个自定义站点` : ""
    ].filter(Boolean).join("、");

    const confirmed = confirm(
      `即将导入 ${desc}。\n\n导入后将完全覆盖当前的搜索组配置${siteCount ? "和自定义站点" : ""}，此操作不可撤销。\n\n确认继续？`
    );
    if (!confirmed) return;

    if (importedGroups.length) {
      groups = createNormalizedGroups(importedGroups);
    }
    if (importedCustomSites.length) {
      customSites = createNormalizedCustomSites(importedCustomSites);
    }

    await persistAll();
    renderOtherSection();

    if (activeSection === "groups") {
      renderGroupsSection();
    }
    if (activeSection === "custom") {
      renderCustomSection();
    }
  }

  function createShortcutsPageHint() {
    const row = document.createElement("div");
    row.className = "shortcut-page-hint";
    row.innerHTML = `也可前往浏览器的<button type="button" class="shortcut-page-link">扩展键盘快捷方式</button>，将「激活扩展」改为快捷激活顶部弹窗（任意页面均可唤起）。`;

    const btn = row.querySelector(".shortcut-page-link");
    btn?.addEventListener("click", () => {
      const isEdge = /Edg\//.test(navigator.userAgent);
      const url = isEdge ? "edge://extensions/shortcuts" : "chrome://extensions/shortcuts";
      chrome.tabs.create({ url }).catch(() => {});
    });

    return row;
  }

  function createShortcutRecorderRow() {
    const row = document.createElement("article");
    row.className = "other-setting-row other-setting-row--with-tip shortcut-row";
    row.innerHTML = `
      <div class="other-setting-row-main">
        <div class="other-setting-copy">
          <div class="other-setting-title">自定义快捷键</div>
          <div class="other-setting-desc">点击右侧按钮后按下组合键即可录制。必须至少包含一个修饰键（Ctrl / Alt / Shift / Win）。</div>
        </div>
        <div class="shortcut-recorder">
          <button type="button" class="shortcut-display" aria-label="录制快捷键"></button>
          <button type="button" class="shortcut-reset" title="恢复默认 Alt + Q">恢复默认</button>
        </div>
      </div>
      <div class="other-setting-desc shortcut-tip">提示：修改快捷键后，需要刷新当前网页才会生效。</div>
    `;

    const display = row.querySelector(".shortcut-display");
    const resetBtn = row.querySelector(".shortcut-reset");
    let isRecording = false;

    function renderDisplay() {
      if (!(display instanceof HTMLButtonElement)) return;
      if (isRecording) {
        display.textContent = "按下组合键…";
        display.classList.add("is-recording");
      } else {
        display.textContent = formatShortcut(uiPrefs.overlayShortcut);
        display.classList.remove("is-recording");
      }
    }

    function stopRecording() {
      if (!isRecording) return;
      isRecording = false;
      document.removeEventListener("keydown", onKeyDown, true);
      renderDisplay();
    }

    async function onKeyDown(event) {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        stopRecording();
        return;
      }

      const rawKey = event.key;
      if (rawKey === "Control" || rawKey === "Shift" || rawKey === "Alt" || rawKey === "Meta") {
        return;
      }

      const candidate = {
        ctrlKey: !!event.ctrlKey,
        shiftKey: !!event.shiftKey,
        altKey: !!event.altKey,
        metaKey: !!event.metaKey,
        key: rawKey.length === 1 ? rawKey.toUpperCase() : rawKey
      };

      if (!isShortcutValid(candidate)) {
        display.textContent = "必须包含修饰键，请重试";
        return;
      }

      uiPrefs.overlayShortcut = candidate;
      await persistAll();
      stopRecording();
    }

    display?.addEventListener("click", () => {
      if (isRecording) {
        stopRecording();
        return;
      }
      isRecording = true;
      renderDisplay();
      document.addEventListener("keydown", onKeyDown, true);
    });

    resetBtn?.addEventListener("click", async () => {
      uiPrefs.overlayShortcut = normalizeShortcut(null);
      await persistAll();
      renderDisplay();
    });

    renderDisplay();
    return row;
  }

  function renderAboutSection() {
    aboutSection.innerHTML = "";

    const card = document.createElement("section");
    card.className = "other-settings-card about-plugin-card";
    card.innerHTML = `
      <div class="other-settings-intro about-plugin-intro">
        <strong>隐私与数据说明</strong>
      </div>
      <div class="about-plugin-privacy" role="note">
        <p><strong>本地运行：</strong>是一个纯客户端工具，所有搜索逻辑均在您的浏览器本地执行。我们不运行任何后端服务器。</p>
        <p><strong>零数据收集：</strong>我们不会收集、上传或存储您的搜索关键词、历史记录或任何个人身份信息。</p>
        <p><strong>交互透明性：</strong>插件通过 <code>iframe</code> 技术加载 AI 官方网页，您与 AI 的所有交互、登录状态均直接发生在您与原网站之间。本插件无法且不会拦截您的登录凭据或对话内容。</p>
      </div>
    `;
    aboutSection.appendChild(card);
  }

  function createOtherSettingToggle(key, title, desc, tip) {
    const row = document.createElement("article");
    row.className = "other-setting-row" + (tip ? " other-setting-row--with-tip" : "");

    const isOn = uiPrefs[key] !== false;
    row.innerHTML = `
      <div class="other-setting-row-main">
        <div class="other-setting-copy">
          <div class="other-setting-title">${escapeHtml(title)}</div>
          <div class="other-setting-desc">${escapeHtml(desc)}</div>
        </div>
        <button class="other-setting-switch ${isOn ? "is-on" : "is-off"}" type="button" aria-pressed="${isOn ? "true" : "false"}">
          <span class="other-setting-switch-thumb"></span>
        </button>
      </div>
      ${tip ? `<div class="other-setting-desc shortcut-tip">${escapeHtml(tip)}</div>` : ""}
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
      list.appendChild(createPromptGroupItem(group, activeGroup));
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
      renamingPromptGroupId = newGroup.id;
      pendingPromptGroupFocusId = newGroup.id;
      renderPromptsSection();
    });

    const addBtnWrap = document.createElement("div");
    addBtnWrap.className = "prompt-sidebar-add-wrap";
    addBtnWrap.appendChild(addBtn);

    aside.appendChild(list);
    aside.appendChild(addBtnWrap);

    attachPromptGroupDrag(list);
    return aside;
  }

  function createPromptGroupItem(group, activeGroup) {
    const isActive = group.id === activeGroup.id;
    const isRenaming = renamingPromptGroupId === group.id;
    const isLocked = promptGroups.findIndex((g) => g.id === group.id) === 0;

    const row = document.createElement("div");
    row.className = `prompt-group-nav-item${isActive ? " is-active" : ""}${!group.name.trim() && !isRenaming ? " is-empty" : ""}${isRenaming ? " is-renaming" : ""}`;
    row.dataset.groupId = group.id;

    if (isRenaming) {
      const input = document.createElement("input");
      input.className = "prompt-group-nav-input";
      input.type = "text";
      input.value = group.name;
      input.placeholder = "请输入分组名称";

      let committed = false;
      const commit = async () => {
        if (committed) return;
        committed = true;
        const nextName = input.value.trim();
        group.name = nextName || "新建分组";
        if (renamingPromptGroupId === group.id) {
          renamingPromptGroupId = null;
        }
        await persistAll();
        renderPromptsSection();
      };

      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          input.blur();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          committed = true;
          if (renamingPromptGroupId === group.id) {
            renamingPromptGroupId = null;
          }
          renderPromptsSection();
        }
      });
      input.addEventListener("blur", commit);

      row.appendChild(input);

      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
      if (pendingPromptGroupFocusId === group.id) {
        pendingPromptGroupFocusId = null;
      }
      return row;
    }

    const nameEl = document.createElement("span");
    nameEl.className = "prompt-group-nav-name";
    nameEl.textContent = group.name || "未命名分组";
    row.appendChild(nameEl);

    row.addEventListener("click", (ev) => {
      if (ev.target.closest(".prompt-group-nav-action")) return;
      activePromptGroupId = group.id;
      renderPromptsSection();
    });

    if (isActive) {
      const actions = document.createElement("div");
      actions.className = "prompt-group-nav-actions";

      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "prompt-group-nav-action prompt-group-nav-rename";
      renameBtn.setAttribute("aria-label", "重命名分组");
      renameBtn.title = "重命名";
      renameBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
      renameBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        renamingPromptGroupId = group.id;
        renderPromptsSection();
      });
      actions.appendChild(renameBtn);

      if (!isLocked) {
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "prompt-group-nav-action prompt-group-nav-delete";
        deleteBtn.setAttribute("aria-label", "删除分组");
        deleteBtn.title = "删除分组";
        deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>`;
        deleteBtn.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          const shouldDelete = window.confirm("是否要删除该提示词分组？");
          if (!shouldDelete) return;
          promptGroups = promptGroups.filter((g) => g.id !== group.id);
          if (!promptGroups.length) {
            promptGroups = createNormalizedPromptGroups([]);
          }
          activePromptGroupId = promptGroups[0]?.id || null;
          await persistAll();
          renderPromptsSection();
        });
        actions.appendChild(deleteBtn);
      }

      const dragHandle = document.createElement("button");
      dragHandle.type = "button";
      dragHandle.className = "prompt-group-nav-action prompt-group-nav-drag";
      dragHandle.setAttribute("aria-label", "拖动排序");
      dragHandle.title = "拖动排序";
      dragHandle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>`;
      actions.appendChild(dragHandle);

      row.appendChild(actions);
    }

    return row;
  }

  function attachPromptGroupDrag(container) {
    container.addEventListener("pointerdown", onPointerDown);

    function onPointerDown(e) {
      const handle = e.target.closest(".prompt-group-nav-drag");
      if (!handle) return;
      const item = handle.closest(".prompt-group-nav-item");
      if (!item) return;

      e.preventDefault();

      const rect = item.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const cardBorderRadius = window.getComputedStyle(item).borderRadius || "12px";

      const clone = item.cloneNode(true);
      clone.style.cssText = [
        "position:fixed",
        `left:${rect.left}px`,
        `top:${rect.top}px`,
        `width:${rect.width}px`,
        "pointer-events:none",
        "z-index:9999",
        "box-shadow:0 12px 32px rgba(0,0,0,0.18)",
        "opacity:0.96",
        "transition:none",
        `border-radius:${cardBorderRadius}`,
        "background:#ffffff"
      ].join(";");
      document.body.appendChild(clone);

      item.style.opacity = "0";
      item.style.pointerEvents = "none";

      let lastInsertBefore = null;

      function onMove(ev) {
        clone.style.top = `${ev.clientY - offsetY}px`;

        const cloneCenterY = ev.clientY - offsetY + rect.height / 2;
        const otherItems = Array.from(container.querySelectorAll(".prompt-group-nav-item")).filter((c) => c !== item);
        let newInsertBefore = null;

        for (const other of otherItems) {
          const r = other.getBoundingClientRect();
          if (cloneCenterY < r.top + r.height / 2) {
            newInsertBefore = other;
            break;
          }
        }

        if (newInsertBefore !== lastInsertBefore) {
          const allItems = Array.from(container.querySelectorAll(".prompt-group-nav-item"));
          const firstPositions = new Map();
          allItems.forEach((el) => firstPositions.set(el, el.getBoundingClientRect()));

          if (newInsertBefore) {
            container.insertBefore(item, newInsertBefore);
          } else {
            container.appendChild(item);
          }
          lastInsertBefore = newInsertBefore;

          allItems
            .filter((el) => el !== item)
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

        const finalRect = item.getBoundingClientRect();
        clone.style.transition = "top 160ms ease, box-shadow 160ms ease, opacity 160ms ease";
        clone.style.top = `${finalRect.top}px`;
        clone.style.boxShadow = "none";
        clone.style.opacity = "0";

        setTimeout(async () => {
          clone.remove();
          item.style.opacity = "";
          item.style.pointerEvents = "";

          Array.from(container.querySelectorAll(".prompt-group-nav-item")).forEach((el) => {
            el.style.transition = "";
            el.style.transform = "";
          });

          const newGroupIds = Array.from(container.querySelectorAll(".prompt-group-nav-item")).map((c) => c.dataset.groupId);
          const reordered = newGroupIds.map((id) => promptGroups.find((g) => g.id === id)).filter(Boolean);
          if (reordered.length === promptGroups.length) {
            promptGroups = reordered;
            await persistAll();
            renderPromptsSection();
          }
        }, 160);
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    }
  }

  function createPromptContentPanel(activeGroup) {
    const panel = document.createElement("section");
    panel.className = "prompt-content-panel";

    const header = document.createElement("div");
    header.className = "prompt-content-header";
    header.innerHTML = `
      <div>
        <div class="prompt-content-title">${escapeHtml(activeGroup.name || "未命名分组")}</div>
        <div class="prompt-content-subtitle">当前分类下共 ${activeGroup.prompts.length} 条提示词</div>
      </div>
    `;
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
      attachPromptItemDrag(list, activeGroup);
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
    item.dataset.promptId = prompt.id;
    item.dataset.groupId = group.id;

    const inline = document.createElement("div");
    inline.className = "prompt-card-inline";

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

    const previewBtn = document.createElement("button");
    previewBtn.type = "button";
    previewBtn.className = "prompt-icon-btn prompt-preview-icon-btn";
    previewBtn.setAttribute("aria-label", "预览");
    previewBtn.title = "预览内容";
    previewBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    previewBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const existing = document.querySelector(".prompt-hover-card");
      if (existing) { existing.remove(); return; }
      showPromptHoverCard(prompt, group);
    });

    // 拖拽手柄
    const dragHandle = document.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "prompt-icon-btn prompt-card-drag-handle";
    dragHandle.setAttribute("aria-label", "拖动排序");
    dragHandle.title = "拖动排序";
    dragHandle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.6"/><circle cx="15" cy="5" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="19" r="1.6"/><circle cx="15" cy="19" r="1.6"/></svg>`;

    const titleEl = document.createElement("div");
    titleEl.className = "prompt-card-title";
    titleEl.textContent = prompt.title || "未命名提示词";

    const rightGroup = document.createElement("div");
    rightGroup.className = "prompt-card-icon-group";
    rightGroup.appendChild(editBtn);
    rightGroup.appendChild(previewBtn);
    rightGroup.appendChild(dragHandle);

    inline.appendChild(titleEl);
    inline.appendChild(rightGroup);
    item.appendChild(inline);

    return item;
  }

  function showPromptHoverCard(prompt, group) {
    const existing = document.querySelector(".prompt-hover-overlay");
    if (existing) existing.remove();

    // 遮罩层：覆盖 .settings-content 区域，背景变暗
    const overlay = document.createElement("div");
    overlay.className = "prompt-hover-overlay";

    function closeCard() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }

    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) closeCard();
    });

    const onKey = (ev) => {
      if (ev.key === "Escape") closeCard();
    };

    const card = document.createElement("div");
    card.className = "prompt-hover-card";

    // 头部：左侧操作按钮 + 右侧关闭
    const header = document.createElement("div");
    header.className = "prompt-hover-card-header";

    const headerActions = document.createElement("div");
    headerActions.className = "prompt-hover-card-header-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "prompt-hover-card-copy-btn";
    copyBtn.textContent = "复制";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(prompt.content || "").then(() => {
        copyBtn.textContent = "✓ 已复制";
        copyBtn.classList.add("is-copied");
        setTimeout(() => {
          copyBtn.textContent = "复制";
          copyBtn.classList.remove("is-copied");
        }, 1800);
      }).catch(() => {
        const ta = document.createElement("textarea");
        ta.value = prompt.content || "";
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        copyBtn.textContent = "✓ 已复制";
        setTimeout(() => { copyBtn.textContent = "复制"; }, 1800);
      });
    });

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "prompt-hover-card-edit-btn";
    editBtn.textContent = "编辑";
    editBtn.addEventListener("click", () => {
      closeCard();
      promptEditorState = {
        mode: "edit",
        groupId: group.id,
        promptId: prompt.id,
        title: prompt.title || "",
        content: prompt.content || ""
      };
      renderPromptsSection();
    });

    headerActions.appendChild(copyBtn);
    headerActions.appendChild(editBtn);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "prompt-hover-card-close-btn";
    closeBtn.setAttribute("aria-label", "关闭");
    closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    closeBtn.addEventListener("click", closeCard);

    header.appendChild(headerActions);
    header.appendChild(closeBtn);

    // 提示词标题行
    const titleRow = document.createElement("div");
    titleRow.className = "prompt-hover-card-title";
    titleRow.textContent = prompt.title || "未命名提示词";

    // 提示词内容
    const body = document.createElement("div");
    body.className = "prompt-hover-card-body";
    body.textContent = prompt.content || "（暂无内容）";

    card.appendChild(header);
    card.appendChild(titleRow);
    card.appendChild(body);
    overlay.appendChild(card);

    document.body.appendChild(overlay);

    setTimeout(() => document.addEventListener("keydown", onKey), 0);
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
      <div class="prompt-editor-field">
        <label class="field-label">名称</label>
        <input class="prompt-editor-title-input" type="text" value="${escapeHtml(editorState.title || "")}" placeholder="请输入提示词名称" />
      </div>
      <div class="prompt-editor-field">
        <label class="field-label">分类</label>
        <select class="prompt-editor-group-select">
          ${promptGroups.map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === editorGroup.id ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}
          <option value="__new_group__">＋ 新建分组…</option>
        </select>
        <div class="prompt-new-group-row" hidden>
          <input class="prompt-new-group-input" type="text" placeholder="输入新分组名称，按 Enter 确认" />
          <button class="prompt-new-group-confirm-btn" type="button">创建</button>
        </div>
      </div>
      <div class="prompt-editor-field">
        <label class="field-label">提示词内容</label>
        <textarea class="prompt-editor-content-input">${escapeHtml(editorState.content || "")}</textarea>
      </div>
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
    const newGroupRow = modal.querySelector(".prompt-new-group-row");
    const newGroupInput = modal.querySelector(".prompt-new-group-input");
    const newGroupConfirmBtn = modal.querySelector(".prompt-new-group-confirm-btn");
    const contentInput = modal.querySelector(".prompt-editor-content-input");
    const cancelBtn = modal.querySelector(".prompt-editor-cancel-btn");
    const saveBtn = modal.querySelector(".prompt-editor-save-btn");

    function showNewGroupRow() {
      if (newGroupRow) newGroupRow.hidden = false;
      if (newGroupInput) newGroupInput.focus();
    }

    function hideNewGroupRow() {
      if (newGroupRow) newGroupRow.hidden = true;
      if (newGroupInput) newGroupInput.value = "";
    }

    function confirmNewGroup() {
      const name = (newGroupInput ? newGroupInput.value : "").trim();
      if (!name) return;
      const newGroup = {
        id: `prompt-group-${Date.now()}`,
        name,
        prompts: []
      };
      promptGroups.push(newGroup);
      const opt = document.createElement("option");
      opt.value = newGroup.id;
      opt.textContent = name;
      const newGroupOpt = groupSelect ? groupSelect.querySelector('option[value="__new_group__"]') : null;
      if (groupSelect) groupSelect.insertBefore(opt, newGroupOpt);
      if (groupSelect) groupSelect.value = newGroup.id;
      promptEditorState.groupId = newGroup.id;
      hideNewGroupRow();
    }

    if (titleInput) {
      titleInput.addEventListener("input", (event) => {
        const nextValue = event.target instanceof HTMLInputElement ? event.target.value : "";
        promptEditorState.title = nextValue;
      });
    }
    if (groupSelect) {
      groupSelect.addEventListener("change", (event) => {
        const nextValue = event.target instanceof HTMLSelectElement ? event.target.value : editorState.groupId;
        if (nextValue === "__new_group__") {
          showNewGroupRow();
        } else {
          hideNewGroupRow();
          promptEditorState.groupId = nextValue;
        }
      });
    }
    if (newGroupConfirmBtn) {
      newGroupConfirmBtn.addEventListener("click", confirmNewGroup);
    }
    if (newGroupInput) {
      newGroupInput.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") { ev.preventDefault(); confirmNewGroup(); }
        if (ev.key === "Escape") {
          hideNewGroupRow();
          if (groupSelect) groupSelect.value = promptEditorState.groupId || (promptGroups[0] ? promptGroups[0].id : "");
        }
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

  function attachPromptItemDrag(listEl, group) {
    listEl.addEventListener("pointerdown", onPromptPointerDown);

    function onPromptPointerDown(e) {
      const handle = e.target.closest(".prompt-card-drag-handle");
      if (!handle) return;
      const card = handle.closest(".prompt-card-item");
      if (!card) return;

      e.preventDefault();

      const rect = card.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;

      const clone = card.cloneNode(true);
      clone.style.cssText = [
        "position:fixed",
        `left:${rect.left}px`,
        `top:${rect.top}px`,
        `width:${rect.width}px`,
        "pointer-events:none",
        "z-index:9999",
        "box-shadow:0 8px 28px rgba(0,0,0,0.13)",
        "opacity:0.95",
        "transition:none",
        "border-radius:8px",
        "background:#fff"
      ].join(";");
      document.body.appendChild(clone);

      card.style.opacity = "0";
      card.style.pointerEvents = "none";

      let lastInsertBefore = null;

      function onMove(ev) {
        clone.style.top = `${ev.clientY - offsetY}px`;

        const cloneCenterY = ev.clientY - offsetY + rect.height / 2;
        const otherCards = Array.from(listEl.querySelectorAll(".prompt-card-item")).filter((c) => c !== card);
        let newInsertBefore = null;

        for (const other of otherCards) {
          const r = other.getBoundingClientRect();
          if (cloneCenterY < r.top + r.height / 2) {
            newInsertBefore = other;
            break;
          }
        }

        if (newInsertBefore !== lastInsertBefore) {
          const allCards = Array.from(listEl.querySelectorAll(".prompt-card-item"));
          const firstPositions = new Map();
          allCards.forEach((el) => firstPositions.set(el, el.getBoundingClientRect()));

          listEl.insertBefore(card, newInsertBefore);
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

          Array.from(listEl.querySelectorAll(".prompt-card-item")).forEach((el) => {
            el.style.transition = "";
            el.style.transform = "";
          });

          const newPromptIds = Array.from(listEl.querySelectorAll(".prompt-card-item")).map((c) => c.dataset.promptId);
          const reordered = newPromptIds.map((id) => group.prompts.find((p) => p.id === id)).filter(Boolean);
          if (reordered.length === group.prompts.length) {
            group.prompts = reordered;
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

  // ── Import / Export ────────────────────────────────────────────────────────

  function handleExport() {
    const lines = [];
    promptGroups.forEach((group, gi) => {
      if (gi > 0) lines.push("");
      lines.push(`# ${group.name}`);
      group.prompts.forEach((p) => {
        lines.push("");
        lines.push(`## ${p.title}`);
        lines.push("");
        lines.push(flattenPromptContentForExport(p.content));
      });
    });
    const markdown = lines.join("\n");
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Qshow提示词-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 将提示词内容里的 Markdown 标题（# ~ ######）转成加粗，
  // 避免与导出文件中 # 分组、## 提示词标题 的结构符号冲突。
  // 代码围栏内的内容原样保留，列表/段落/序号结构不受影响。
  function flattenPromptContentForExport(raw) {
    const text = String(raw || "").trim();
    if (!text) return text;
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
        out.push(`**${headingMatch[2].trim()}**`);
        out.push("");
      } else {
        out.push(trimmedEnd);
      }
    }
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function parseMarkdownPrompts(text) {
    const groups = [];
    // Split on lines that start with exactly one # (not ##)
    const groupChunks = text.split(/\n(?=# (?!#))/);
    for (const chunk of groupChunks) {
      const chunkLines = chunk.split("\n");
      const firstLine = chunkLines[0] || "";
      if (!firstLine.startsWith("# ") || firstLine.startsWith("## ")) continue;
      const groupName = firstLine.slice(2).trim();
      if (!groupName) continue;

      const prompts = [];
      const rest = chunkLines.slice(1).join("\n");
      // Split on lines that start with ##
      const promptChunks = rest.split(/\n(?=## )/);
      for (const pChunk of promptChunks) {
        const pLines = pChunk.split("\n");
        const pFirst = pLines[0] || "";
        if (!pFirst.startsWith("## ")) continue;
        const title = pFirst.slice(3).trim();
        if (!title) continue;
        const content = pLines.slice(1).join("\n").trim();
        prompts.push({ title, content });
      }

      groups.push({ name: groupName, prompts });
    }
    return groups;
  }

  async function handleImportFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let valid = [];

      if (file.name.endsWith(".json") || text.trimStart().startsWith("{")) {
        const data = JSON.parse(text);
        if (!data || !Array.isArray(data.promptGroups)) {
          alert("JSON 格式不正确，请导入从本插件导出的文件。");
          return;
        }
        valid = data.promptGroups.filter(
          (g) => g && typeof g.name === "string" && g.name.trim() && Array.isArray(g.prompts)
        );
      } else {
        valid = parseMarkdownPrompts(text);
      }

      if (!valid.length) {
        alert("文件中没有可导入的提示词分组。");
        return;
      }
      openImportModal(valid);
    } catch (_) {
      alert("无法解析文件，请检查文件格式是否正确。");
    }
  }

  function openImportModal(importedGroups) {
    const existingNames = new Set(promptGroups.map((g) => g.name));
    importModalState = {
      groups: importedGroups.map((group) => {
        const prompts = group.prompts.map((p) => ({
          title: String(p.title || "").trim() || "未命名提示词",
          content: String(p.content || "")
        }));
        const name = group.name.trim();
        return {
          name,
          prompts,
          expanded: false,
          conflictExists: existingNames.has(name),
          conflictStrategy: "merge",
          promptSelections: prompts.map(() => true)
        };
      })
    };
    renderImportModal();
  }

  function renderImportModal() {
    document.getElementById("promptImportModal")?.remove();
    if (!importModalState) return;

    const totalPrompts = importModalState.groups.reduce((s, g) => s + g.prompts.length, 0);
    const selectedCount = importModalState.groups.reduce(
      (s, g) => s + g.promptSelections.filter(Boolean).length, 0
    );

    const overlay = document.createElement("div");
    overlay.id = "promptImportModal";
    overlay.className = "import-modal-overlay";
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeImportModal(); });

    const dialog = document.createElement("div");
    dialog.className = "import-modal-dialog";

    // Header
    const header = document.createElement("div");
    header.className = "import-modal-header";
    const headerText = document.createElement("div");
    const titleEl = document.createElement("div");
    titleEl.className = "import-modal-title";
    titleEl.textContent = "导入提示词";
    const subtitleEl = document.createElement("div");
    subtitleEl.className = "import-modal-subtitle";
    subtitleEl.textContent = `共 ${importModalState.groups.length} 个分组，${totalPrompts} 条提示词 · 已选 ${selectedCount} 条`;
    headerText.appendChild(titleEl);
    headerText.appendChild(subtitleEl);
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "import-modal-close";
    closeBtn.setAttribute("aria-label", "关闭");
    closeBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    closeBtn.addEventListener("click", closeImportModal);
    header.appendChild(headerText);
    header.appendChild(closeBtn);

    // Body
    const body = document.createElement("div");
    body.className = "import-modal-body";

    importModalState.groups.forEach((group, gi) => {
      const selectedInGroup = group.promptSelections.filter(Boolean).length;
      const allSelected = selectedInGroup === group.prompts.length;
      const noneSelected = selectedInGroup === 0;

      const groupItem = document.createElement("div");
      groupItem.className = "import-group-item";

      const groupRow = document.createElement("div");
      groupRow.className = "import-group-row";

      const groupCheck = document.createElement("input");
      groupCheck.type = "checkbox";
      groupCheck.className = "import-checkbox";
      groupCheck.checked = allSelected;
      groupCheck.indeterminate = !allSelected && !noneSelected;
      groupCheck.addEventListener("change", () => {
        importModalState.groups[gi].promptSelections = importModalState.groups[gi].prompts.map(() => groupCheck.checked);
        renderImportModal();
      });

      const expandBtn = document.createElement("button");
      expandBtn.type = "button";
      expandBtn.className = "import-expand-btn";
      expandBtn.setAttribute("aria-label", group.expanded ? "收起" : "展开");
      expandBtn.innerHTML = group.expanded
        ? `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="12" height="12"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="12" height="12"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      expandBtn.addEventListener("click", () => {
        importModalState.groups[gi].expanded = !importModalState.groups[gi].expanded;
        renderImportModal();
      });

      const groupNameEl = document.createElement("span");
      groupNameEl.className = "import-group-name";
      groupNameEl.textContent = group.name;
      groupNameEl.addEventListener("click", () => {
        importModalState.groups[gi].expanded = !importModalState.groups[gi].expanded;
        renderImportModal();
      });

      const groupMetaEl = document.createElement("span");
      groupMetaEl.className = "import-group-meta";
      groupMetaEl.textContent = `${selectedInGroup}/${group.prompts.length}`;

      groupRow.appendChild(groupCheck);
      groupRow.appendChild(expandBtn);
      groupRow.appendChild(groupNameEl);
      groupRow.appendChild(groupMetaEl);

      if (group.conflictExists) {
        const badge = document.createElement("span");
        badge.className = "import-conflict-badge";
        badge.textContent = "已存在";
        groupRow.appendChild(badge);

        const strategyWrap = document.createElement("div");
        strategyWrap.className = "import-strategy-wrap";

        ["merge", "new"].forEach((strategy) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `import-strategy-btn${group.conflictStrategy === strategy ? " is-active" : ""}`;
          btn.textContent = strategy === "merge" ? "合并" : "新建";
          btn.title = strategy === "merge" ? "将选中内容追加到已有分组" : "保留原分组，另建新分组";
          btn.addEventListener("click", () => {
            importModalState.groups[gi].conflictStrategy = strategy;
            renderImportModal();
          });
          strategyWrap.appendChild(btn);
        });

        groupRow.appendChild(strategyWrap);
      }

      groupItem.appendChild(groupRow);

      if (group.expanded) {
        const promptList = document.createElement("div");
        promptList.className = "import-prompt-list";
        group.prompts.forEach((prompt, pi) => {
          const promptRow = document.createElement("label");
          promptRow.className = "import-prompt-row";
          const promptCheck = document.createElement("input");
          promptCheck.type = "checkbox";
          promptCheck.className = "import-checkbox";
          promptCheck.checked = group.promptSelections[pi];
          promptCheck.addEventListener("change", () => {
            importModalState.groups[gi].promptSelections[pi] = promptCheck.checked;
            renderImportModal();
          });
          const promptTitle = document.createElement("span");
          promptTitle.className = "import-prompt-title";
          promptTitle.textContent = prompt.title;
          promptRow.appendChild(promptCheck);
          promptRow.appendChild(promptTitle);
          promptList.appendChild(promptRow);
        });
        groupItem.appendChild(promptList);
      }

      body.appendChild(groupItem);
    });

    // Footer
    const footer = document.createElement("div");
    footer.className = "import-modal-footer";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "import-footer-cancel-btn";
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", closeImportModal);

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "import-footer-confirm-btn";
    confirmBtn.textContent = selectedCount > 0 ? `导入已选（${selectedCount} 条）` : "导入";
    confirmBtn.disabled = selectedCount === 0;
    confirmBtn.addEventListener("click", doImport);

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  function closeImportModal() {
    document.getElementById("promptImportModal")?.remove();
    importModalState = null;
  }

  async function doImport() {
    if (!importModalState) return;
    const existingGroupMap = new Map(promptGroups.map((g) => [g.name, g]));

    importModalState.groups.forEach((group) => {
      const selectedPrompts = group.prompts.filter((_, i) => group.promptSelections[i]);
      if (!selectedPrompts.length) return;

      const newPrompts = selectedPrompts.map((p) => ({
        id: `prompt-import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: p.title,
        content: p.content
      }));

      if (group.conflictExists && group.conflictStrategy === "merge") {
        const existing = existingGroupMap.get(group.name);
        if (existing) {
          existing.prompts.push(...newPrompts);
        }
      } else {
        let name = group.name;
        if (group.conflictExists && group.conflictStrategy === "new") {
          let suffix = 2;
          while (promptGroups.some((g) => g.name === name)) {
            name = `${group.name} (${suffix++})`;
          }
        }
        promptGroups.push({
          id: `prompt-group-import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          prompts: newPrompts
        });
      }
    });

    await persistAll();
    closeImportModal();
    activePromptGroupId = promptGroups[0]?.id || null;
    renderPromptsSection();
  }

  // ── End Import / Export ────────────────────────────────────────────────────

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();
