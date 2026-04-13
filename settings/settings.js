(function initSettingsPage() {
  const STORAGE_KEY = "searchGroups";
  const groupsContainer = document.getElementById("settingsGroups");
  const addGroupBtn = document.getElementById("addGroupBtn");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const saveStatus = document.getElementById("saveStatus");

  const SITE_CATEGORIES = {
    ai: {
      label: "AI",
      siteIds: ["deepseek", "doubao", "kimi", "gemini", "chatgpt", "zhipu", "yuanbao", "qwen"]
    },
    other: {
      label: "社媒平台",
      siteIds: ["xiaohongshu", "bilibili", "zhihu", "douyin"]
    },
    custom: {
      label: "自定义",
      siteIds: []
    }
  };

  let groups = [];
  let sites = [];
  let openPickerGroupId = null;
  let activeCategory = "ai";
  let hasUnsavedChanges = false;

  document.addEventListener("DOMContentLoaded", start);

  async function start() {
    sites = await loadSites();
    groups = await loadGroups();
    normalizeGroups();
    render();
    updateSaveStatus();
  }

  addGroupBtn.addEventListener("click", async () => {
    groups.push({
      id: `group_${Date.now()}`,
      name: "新搜索组",
      mode: "compare",
      siteIds: sites.slice(0, 2).map((site) => site.id)
    });
    markDirty();
    await persist({ silent: true });
    render();
  });

  saveSettingsBtn.addEventListener("click", async () => {
    await persist();
    try {
      await chrome.runtime.sendMessage({ type: "SETTINGS_SAVED" });
    } catch (_error) {
      // ignore
    }
  });

  function normalizeGroups() {
    const validSiteIds = new Set(sites.map((site) => site.id));
    groups = groups.map((group) => ({
      ...group,
      name: String(group.name || "未命名搜索组"),
      mode: group.mode === "tabs" ? "tabs" : "compare",
      siteIds: Array.isArray(group.siteIds)
        ? group.siteIds.filter((siteId, index, arr) => validSiteIds.has(siteId) && arr.indexOf(siteId) === index)
        : []
    }));
  }

  function render() {
    groupsContainer.innerHTML = "";

    if (groups.length === 0) {
      const emptyState = document.createElement("section");
      emptyState.className = "settings-empty-state";
      emptyState.innerHTML = `
        <strong>还没有搜索组</strong>
        <p>点击右上角“新增搜索组”，然后在右侧批量勾选你想调用的网站或 AI 模型。</p>
      `;
      groupsContainer.appendChild(emptyState);
      return;
    }

    groups.forEach((group) => {
      groupsContainer.appendChild(createGroupCard(group));
    });
  }

  function createGroupCard(group) {
    const card = document.createElement("section");
    card.className = "settings-group-card";

    const leftPanel = document.createElement("div");
    leftPanel.className = "settings-group-meta";
    leftPanel.innerHTML = `
      <div class="field-block">
        <label class="field-label">搜索组</label>
        <input class="group-name-input" type="text" value="${escapeHtml(group.name)}" data-field="name" />
      </div>
      <div class="field-block">
        <label class="field-label">打开方式</label>
        <select class="group-mode-select" data-field="mode">
          <option value="compare" ${group.mode === "compare" ? "selected" : ""}>卡片组形式</option>
          <option value="tabs" ${group.mode === "tabs" ? "selected" : ""}>新开标签页</option>
        </select>
      </div>
      <div class="group-meta-footer">
        <span class="group-meta-count">已添加 ${group.siteIds.length} 个站点</span>
        <button class="secondary-btn danger-btn" type="button" data-action="delete">删除</button>
      </div>
    `;

    const rightPanel = document.createElement("div");
    rightPanel.className = "settings-group-sites";

    const selectedHeader = document.createElement("div");
    selectedHeader.className = "sites-panel-header";
    selectedHeader.innerHTML = `
      <div>
        <div class="sites-panel-title">调用内容</div>
        <div class="sites-panel-subtitle">右侧直接管理这个搜索组会调用哪些网站或 AI 模型</div>
      </div>
    `;

    const chipsWrap = document.createElement("div");
    chipsWrap.className = "site-chip-list";

    const selectedSites = group.siteIds
      .map((siteId) => sites.find((site) => site.id === siteId))
      .filter(Boolean);

    if (selectedSites.length === 0) {
      const empty = document.createElement("div");
      empty.className = "site-selection-empty";
      empty.textContent = "当前还没有添加任何内容，点下面新增后可批量勾选。";
      chipsWrap.appendChild(empty);
    } else {
      selectedSites.forEach((site) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "site-chip selected-chip";
        chip.innerHTML = `<span>${escapeHtml(site.name)}</span><span class="chip-remove" aria-hidden="true">×</span>`;
        chip.addEventListener("click", async () => {
          group.siteIds = group.siteIds.filter((id) => id !== site.id);
          markDirty();
          await persist({ silent: true });
          render();
        });
        chipsWrap.appendChild(chip);
      });
    }

    const addWrap = document.createElement("div");
    addWrap.className = "site-add-wrap";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "add-site-btn";
    addBtn.textContent = openPickerGroupId === group.id ? "收起" : "新增";
    addBtn.addEventListener("click", () => {
      if (openPickerGroupId === group.id) {
        openPickerGroupId = null;
      } else {
        openPickerGroupId = group.id;
      }
      render();
    });

    addWrap.appendChild(addBtn);

    if (openPickerGroupId === group.id) {
      addWrap.appendChild(createPickerPanel(group));
    }

    rightPanel.appendChild(selectedHeader);
    rightPanel.appendChild(chipsWrap);
    rightPanel.appendChild(addWrap);

    card.appendChild(leftPanel);
    card.appendChild(rightPanel);

    leftPanel.querySelector("[data-field='name']").addEventListener("input", async (event) => {
      group.name = event.target.value || "";
      markDirty();
      await persist({ silent: true });
    });

    leftPanel.querySelector("[data-field='mode']").addEventListener("change", async (event) => {
      group.mode = event.target.value;
      markDirty();
      await persist({ silent: true });
    });

    leftPanel.querySelector("[data-action='delete']").addEventListener("click", async () => {
      groups = groups.filter((item) => item.id !== group.id);
      if (openPickerGroupId === group.id) {
        openPickerGroupId = null;
      }
      markDirty();
      await persist({ silent: true });
      render();
    });

    return card;
  }

  function createPickerPanel(group) {
    const panel = document.createElement("div");
    panel.className = "site-picker-panel";

    const tabs = document.createElement("div");
    tabs.className = "site-picker-tabs";

    Object.entries(SITE_CATEGORIES).forEach(([key, category]) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = `site-picker-tab${activeCategory === key ? " is-active" : ""}`;
      tab.textContent = category.label;
      tab.addEventListener("click", () => {
        activeCategory = key;
        render();
      });
      tabs.appendChild(tab);
    });

    const body = document.createElement("div");
    body.className = "site-picker-body";

    if (activeCategory === "custom") {
      const placeholder = document.createElement("div");
      placeholder.className = "site-picker-empty";
      placeholder.innerHTML = `
        <strong>自定义</strong>
        <p>这里先预留为空，下一步我们再接着做自定义规则。</p>
      `;
      body.appendChild(placeholder);
    } else {
      const checkboxList = document.createElement("div");
      checkboxList.className = "site-checkbox-list";
      const categorySites = getCategorySites(activeCategory);

      categorySites.forEach((site) => {
        const label = document.createElement("label");
        label.className = "site-checkbox-item";
        label.innerHTML = `
          <input type="checkbox" value="${escapeHtml(site.id)}" ${group.siteIds.includes(site.id) ? "checked" : ""} />
          <span class="site-checkbox-text">
            <span class="site-checkbox-name">${escapeHtml(site.name)}</span>
            <span class="site-checkbox-desc">${escapeHtml(getCategoryLabel(activeCategory))}</span>
          </span>
        `;

        const checkbox = label.querySelector("input");
        checkbox.addEventListener("change", async () => {
          if (checkbox.checked) {
            if (!group.siteIds.includes(site.id)) {
              group.siteIds.push(site.id);
            }
          } else {
            group.siteIds = group.siteIds.filter((id) => id !== site.id);
          }
          markDirty();
          await persist({ silent: true });
          render();
        });

        checkboxList.appendChild(label);
      });

      if (categorySites.length === 0) {
        const empty = document.createElement("div");
        empty.className = "site-picker-empty";
        empty.innerHTML = `
          <strong>暂无内容</strong>
          <p>这个分类暂时还没有可选站点。</p>
        `;
        body.appendChild(empty);
      } else {
        body.appendChild(checkboxList);
      }
    }

    panel.appendChild(tabs);
    panel.appendChild(body);
    return panel;
  }

  function getCategorySites(categoryKey) {
    const category = SITE_CATEGORIES[categoryKey];
    if (!category) {
      return [];
    }

    return category.siteIds
      .map((siteId) => sites.find((site) => site.id === siteId))
      .filter(Boolean);
  }

  function getCategoryLabel(categoryKey) {
    return SITE_CATEGORIES[categoryKey]?.label || "未分类";
  }

  function markDirty() {
    hasUnsavedChanges = true;
    updateSaveStatus();
  }

  function updateSaveStatus() {
    if (!saveStatus) {
      return;
    }
    saveStatus.textContent = hasUnsavedChanges ? "有未保存更改" : "已保存";
    saveStatus.classList.toggle("is-dirty", hasUnsavedChanges);
  }

  async function loadGroups() {
    const stored = await chrome.storage.local.get([STORAGE_KEY]);
    const existing = stored[STORAGE_KEY];
    if (Array.isArray(existing) && existing.length > 0) {
      return existing;
    }

    const defaults = [
      {
        id: "default-compare",
        name: "AI搜索",
        mode: "compare",
        siteIds: ["deepseek", "doubao", "kimi", "chatgpt", "qwen"].filter((id) => sites.some((site) => site.id === id))
      },
      {
        id: "default-tabs",
        name: "新开标签",
        mode: "tabs",
        siteIds: ["chatgpt", "deepseek", "kimi"].filter((id) => sites.some((site) => site.id === id))
      }
    ];
    await chrome.storage.local.set({ [STORAGE_KEY]: defaults });
    return defaults;
  }

  async function loadSites() {
    const response = await fetch(chrome.runtime.getURL("config/siteHandlers.json"));
    const payload = await response.json();
    return (payload.sites || []).filter((site) => site.enabled !== false);
  }

  async function persist(options = {}) {
    const { silent = false } = options;
    normalizeGroups();
    await chrome.storage.local.set({ [STORAGE_KEY]: groups });
    if (!silent) {
      hasUnsavedChanges = false;
      updateSaveStatus();
    }
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
