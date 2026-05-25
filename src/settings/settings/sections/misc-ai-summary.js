import { msg } from "../state.js";

const PROMPT_BASE_H = 96;
const PROMPT_STAGES = [PROMPT_BASE_H, Math.round(PROMPT_BASE_H * 1.75), Math.round(PROMPT_BASE_H * 3.5)];

function applyPromptStageHeight(el) {
  const savedH = el.style.height;
  el.style.height = "auto";
  const contentH = el.scrollHeight;
  el.style.height = savedH;
  let stageH = PROMPT_STAGES[PROMPT_STAGES.length - 1];
  for (const h of PROMPT_STAGES) {
    if (contentH <= h) { stageH = h; break; }
  }
  const atMax = stageH === PROMPT_STAGES[PROMPT_STAGES.length - 1];
  const prevH = parseInt(savedH) || 0;
  el.style.height = (atMax ? Math.max(stageH, prevH) : stageH) + "px";
  el.style.overflowY = atMax ? "auto" : "hidden";
  el.style.resize = atMax ? "vertical" : "none";
}
import { escapeHtml } from "../utils.js";
import {
  getAiProvider,
  getAiProviderList,
  getDefaultModelForProvider,
} from "../../../shared/ai-providers.js";
import {
  loadAiSummarySettings,
  saveAiSummarySettings,
  DEFAULT_SUMMARY_SETTINGS,
  DEFAULT_SUMMARY_PROMPT,
  callAiSummary,
  makePromptGroup,
  getPromptGroups,
} from "../../../shared/ai-summary-api.js";

export function createAiSummaryProviderCard() {
  const card = document.createElement("section");
  card.className = "other-settings-card ai-summary-card";
  const providers = getAiProviderList();
  const providerAccents = {
    deepseek: "#2563eb",
    kimi: "#111827",
    zhipu: "#0f62fe",
    qwen: "#6d5dfc",
    minimax: "#f43f5e",
    siliconflow: "#16a34a",
    openrouter: "#7c3aed",
    custom: "#6366f1",
  };

  card.innerHTML = `
    <div class="other-settings-intro">
      <strong>${msg("settings_aiSummaryTitle", "AI 总结")}</strong>
      <span>${msg("settings_aiSummaryDesc", "选择一个 OpenAI 兼容 API 服务商，用它总结搜索结果页所有 AI 卡片的回答。")}</span>
    </div>
    <div class="ai-summary-settings-form">
      <div class="ai-summary-field">
        <label class="ai-summary-label">${msg("settings_aiSummaryProvider", "服务商")}</label>
        <div class="ai-provider-preset-grid" role="radiogroup" aria-label="${msg("settings_aiSummaryProvider", "服务商")}"></div>
      </div>
      <div class="ai-summary-field ai-summary-base-url-field">
        <label class="ai-summary-label">Base URL</label>
        <div class="ai-summary-url-row">
          <input type="text" class="ai-summary-input ai-summary-base-url-input" placeholder="https://your-api.example.com/v1" spellcheck="false" />
          <button type="button" class="ai-summary-test-btn ai-summary-api-key-link">${msg("settings_aiSummaryApiManage", "API 管理")}</button>
        </div>
        <span class="ai-summary-hint ai-summary-base-url-hint"></span>
      </div>
      <div class="ai-summary-field">
        <label class="ai-summary-label">${msg("settings_aiSummaryApiKey", "API Key")}</label>
        <div class="ai-summary-key-row">
          <input type="password" class="ai-summary-input ai-summary-key-input" placeholder="${msg("settings_aiSummaryApiKeyPlaceholder", "sk-...")}" autocomplete="off" spellcheck="false" />
          <button type="button" class="ai-summary-toggle-btn" aria-label="显示/隐藏 Key">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button type="button" class="ai-summary-test-btn">${msg("settings_aiSummaryTestConn", "测试连接")}</button>
        </div>
        <span class="ai-summary-hint">${msg("settings_aiSummaryApiKeyHint", "Key 仅保存在本地浏览器，不会上传到开发者服务器。")}</span>
      </div>
      <div class="ai-summary-field">
        <label class="ai-summary-label">${msg("settings_aiSummaryModel", "模型")}</label>
        <div class="ai-summary-model-input-row">
          <input type="text" class="ai-summary-input ai-summary-model-input" placeholder="${msg("settings_aiSummaryCustomModelPlaceholder", "输入模型名")}" autocomplete="off" spellcheck="false" />
          <button type="button" class="ai-summary-model-menu-btn" aria-label="${msg("settings_aiSummaryChooseModel", "选择推荐模型")}">
            <svg class="ai-summary-model-menu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="ai-summary-model-menu" role="listbox" hidden></div>
        </div>
        <span class="ai-summary-hint">${msg("settings_aiSummaryModelHint", "可直接输入模型名，也可以点击右侧按钮选择推荐模型。")}</span>
      </div>
      <div class="ai-summary-field ai-summary-prompt-panel">
        <div class="ai-summary-prompt-panel-header">
          <label class="ai-summary-label">${msg("settings_aiSummaryPrompt", "总结提示词")}</label>
          <div class="ai-summary-prompt-groups-bar">
            <button type="button" class="ai-summary-add-pg-btn" title="${msg("settings_aiSummaryAddGroup", "新建提示词组")}">+</button>
          </div>
        </div>
        <div class="ai-summary-group-name-row">
          <input type="text" class="ai-summary-input ai-summary-group-name-input" placeholder="${msg("settings_aiSummaryGroupName", "提示词组名称...")}" />
          <button type="button" class="ai-summary-delete-pg-btn" title="${msg("settings_aiSummaryDeleteGroup", "删除此组")}" aria-label="${msg("settings_aiSummaryDeleteGroup", "删除此组")}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="13" height="13" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <textarea class="ai-summary-input ai-summary-prompt-textarea" rows="1" placeholder="${msg("settings_aiSummaryPromptPlaceholder", "输入自定义总结指令...")}"></textarea>
      </div>
      <div class="ai-summary-feedback" hidden></div>
    </div>
  `;

  const providerGrid = card.querySelector(".ai-provider-preset-grid");
  const keyInput = card.querySelector(".ai-summary-key-input");
  const toggleBtn = card.querySelector(".ai-summary-toggle-btn");
  const modelInput = card.querySelector(".ai-summary-model-input");
  const modelMenuBtn = card.querySelector(".ai-summary-model-menu-btn");
  const modelMenu = card.querySelector(".ai-summary-model-menu");
  const baseUrlInput = card.querySelector(".ai-summary-base-url-input");
  const baseUrlHint = card.querySelector(".ai-summary-base-url-hint");
  const promptTextarea = card.querySelector(".ai-summary-prompt-textarea");
  const promptGroupsBar = card.querySelector(".ai-summary-prompt-groups-bar");
  const addPgBtn = card.querySelector(".ai-summary-add-pg-btn");
  const groupNameInput = card.querySelector(".ai-summary-group-name-input");
  const deletePgBtn = card.querySelector(".ai-summary-delete-pg-btn");
  const apiKeyLink = card.querySelector(".ai-summary-api-key-link");
  const testBtn = card.querySelector(".ai-summary-key-row .ai-summary-test-btn");
  const feedbackEl = card.querySelector(".ai-summary-feedback");

  let settings = { ...DEFAULT_SUMMARY_SETTINGS, apiKeys: {}, models: {}, customBaseUrls: {} };
  let activeProviderId = null;
  let activeGroupIndex = 0;
  let saveTimer = null;
  let saveInFlight = null;

  function showFeedback(text, isError = false) {
    feedbackEl.textContent = text;
    feedbackEl.hidden = false;
    feedbackEl.className = "ai-summary-feedback" + (isError ? " is-error" : " is-ok");
    clearTimeout(feedbackEl._timer);
    feedbackEl._timer = setTimeout(() => {
      feedbackEl.hidden = true;
    }, 2000);
  }

  async function persistSettings() {
    captureCurrentProviderFields();
    try {
      if (saveInFlight) await saveInFlight;
      saveInFlight = saveAiSummarySettings(settings);
      await saveInFlight;
    } catch (err) {
      showFeedback(err.message || msg("settings_aiSummarySaveFail", "保存失败。"), true);
    } finally {
      saveInFlight = null;
    }
  }

  function schedulePersist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { persistSettings(); }, 400);
  }

  function getProviderAccent(providerId) {
    return providerAccents[providerId] || "#111827";
  }

  function getProviderShortLabel(provider) {
    if (provider.id === "custom") return "Custom";
    return provider.label.replace(/\s*\/\s*.*/, "");
  }

  function setModelMenuOpen(isOpen) {
    modelMenuBtn.classList.toggle("is-open", isOpen);
    modelMenu.classList.toggle("is-open", isOpen);
    modelMenuBtn.setAttribute("aria-expanded", String(isOpen));
    modelMenu.hidden = !isOpen;
  }

  function closeModelMenu() {
    setModelMenuOpen(false);
  }

  function toggleModelMenu() {
    setModelMenuOpen(modelMenu.hidden);
  }

  function createModelOption(model, isActive) {
    const button = document.createElement("button");
    button.type = "button";
    button.role = "option";
    button.setAttribute("aria-selected", String(isActive));
    button.className = "ai-summary-model-option" + (isActive ? " is-active" : "");
    button.textContent = model.label || model.value;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      modelInput.value = model.value;
      renderModelMenu(getAiProvider(activeProviderId), model.value);
      closeModelMenu();
      persistSettings();
    });
    return button;
  }

  function renderProviderChips() {
    providerGrid.innerHTML = "";
    providers.forEach((provider) => {
      const isActive = provider.id === activeProviderId;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ai-provider-preset-btn" + (isActive ? " is-active" : "");
      button.dataset.providerId = provider.id;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(isActive));
      button.style.setProperty("--provider-accent", getProviderAccent(provider.id));
      button.innerHTML = `
        <span class="ai-provider-preset-name">${escapeHtml(getProviderShortLabel(provider))}</span>
      `;
      button.addEventListener("click", async () => {
        if (provider.id === activeProviderId) return;
        const previousProviderId = activeProviderId || settings.provider;
        captureCurrentProviderFields(previousProviderId);
        renderProviderFields(provider.id);
        captureCurrentProviderFields(provider.id);
        await persistSettings();
      });
      providerGrid.appendChild(button);
    });
  }

  function renderModelMenu(provider, currentValue) {
    modelMenu.innerHTML = "";
    const models = provider.models || [];
    if (!models.length) {
      const empty = document.createElement("div");
      empty.className = "ai-summary-model-empty";
      empty.textContent = msg("settings_aiSummaryNoPresetModels", "暂无推荐模型，可直接输入模型名。");
      modelMenu.appendChild(empty);
      return;
    }
    models.forEach((model) => {
      modelMenu.appendChild(createModelOption(model, model.value === currentValue));
    });
  }

  function getSelectedModel(providerId) {
    return modelInput.value.trim() || getDefaultModelForProvider(providerId);
  }

  function normalizeBaseUrlForCompare(value) {
    return String(value || "").trim().replace(/\/+$/, "").toLowerCase();
  }

  function captureCurrentGroup() {
    const group = settings.promptGroups?.[activeGroupIndex];
    if (!group) return;
    group.name = groupNameInput.value.trim() || "默认总结";
    group.prompt = promptTextarea.value.trim() || DEFAULT_SUMMARY_PROMPT;
  }

  function loadGroupFields(index) {
    const group = settings.promptGroups?.[index];
    if (!group) return;
    groupNameInput.value = group.name || "";
    promptTextarea.value = group.prompt || "";
    applyPromptStageHeight(promptTextarea);
  }

  function renderPromptGroupTabs() {
    promptGroupsBar.querySelectorAll(".ai-summary-pg-tab").forEach((el) => el.remove());
    (settings.promptGroups || []).forEach((group, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "ai-summary-pg-tab" + (index === activeGroupIndex ? " is-active" : "");
      tab.textContent = group.name || "未命名";
      tab.title = group.name || "未命名";
      tab.addEventListener("click", async () => {
        if (index === activeGroupIndex) return;
        captureCurrentGroup();
        activeGroupIndex = index;
        renderPromptGroupTabs();
        loadGroupFields(index);
        await persistSettings();
      });
      promptGroupsBar.insertBefore(tab, addPgBtn);
    });
    deletePgBtn.disabled = (settings.promptGroups || []).length <= 1;
  }

  function captureCurrentProviderFields(providerId = activeProviderId || settings.provider) {
    if (!providerId) return;
    settings.apiKeys = { ...(settings.apiKeys || {}), [providerId]: keyInput.value.trim() };
    settings.models = { ...(settings.models || {}), [providerId]: getSelectedModel(providerId) };
    const provider = getAiProvider(providerId);
    if (provider.allowCustomBaseUrl || provider.allowBaseUrlOverride) {
      settings.customBaseUrls = { ...(settings.customBaseUrls || {}), [providerId]: baseUrlInput.value.trim() };
    }
    captureCurrentGroup();
  }

  function renderProviderFields(providerId) {
    const provider = getAiProvider(providerId);
    activeProviderId = provider.id;
    settings.provider = provider.id;
    renderProviderChips();

    keyInput.value = settings.apiKeys?.[provider.id] || "";

    const providerModels = provider.models || [];
    const providerDefaultModel = getDefaultModelForProvider(provider.id);
    const rawSavedModel = settings.models?.[provider.id] || "";
    const modelLooksFromAnotherProvider = !!rawSavedModel && providers.some((other) =>
      other.id !== provider.id && (other.models || []).some((model) => model.value === rawSavedModel)
    );
    const savedModel = modelLooksFromAnotherProvider
      ? providerDefaultModel
      : (rawSavedModel || providerDefaultModel);
    if (modelLooksFromAnotherProvider) {
      settings.models = { ...(settings.models || {}), [provider.id]: providerDefaultModel };
    }
    modelInput.value = savedModel || providerDefaultModel || "";
    renderModelMenu(provider, modelInput.value.trim());

    const canEditBaseUrl = !!(provider.allowCustomBaseUrl || provider.allowBaseUrlOverride);
    const rawSavedBaseUrl = settings.customBaseUrls?.[provider.id] || "";
    const normalizedSavedBaseUrl = normalizeBaseUrlForCompare(rawSavedBaseUrl);
    const baseUrlLooksFromAnotherProvider = !!normalizedSavedBaseUrl && providers.some((other) =>
      other.id !== provider.id &&
      other.baseUrl &&
      normalizeBaseUrlForCompare(other.baseUrl) === normalizedSavedBaseUrl
    );
    const effectiveBaseUrl = baseUrlLooksFromAnotherProvider
      ? (provider.baseUrl || "")
      : (rawSavedBaseUrl || provider.baseUrl || "");
    if (baseUrlLooksFromAnotherProvider) {
      settings.customBaseUrls = { ...(settings.customBaseUrls || {}), [provider.id]: "" };
    }
    baseUrlInput.value = effectiveBaseUrl;
    baseUrlInput.readOnly = !canEditBaseUrl;
    baseUrlInput.setAttribute("aria-readonly", String(!canEditBaseUrl));
    baseUrlInput.classList.toggle("is-readonly", !canEditBaseUrl);
    baseUrlHint.textContent = canEditBaseUrl
      ? msg("settings_aiSummaryBaseUrlEditable", "该服务商允许覆盖 Base URL，适合官方域名变化或代理网关。")
      : `${msg("settings_aiSummaryBaseUrlReadonly", "预置服务商默认使用官方 OpenAI 兼容地址。")} ${provider.baseUrl || ""}`.trim();
    apiKeyLink.disabled = !provider.apiKeyUrl;
  }

  function openExternalUrl(url) {
    if (!url) return;
    try {
      chrome.tabs.create({ url }).catch(() => window.open(url, "_blank", "noopener,noreferrer"));
    } catch (_) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  loadAiSummarySettings().then((loaded) => {
    settings = loaded;
    settings.promptGroups = getPromptGroups(settings);
    activeGroupIndex = 0;
    renderPromptGroupTabs();
    loadGroupFields(0);
    renderProviderFields(settings.provider);
    setTimeout(() => applyPromptStageHeight(promptTextarea), 0);
  });

  modelMenuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleModelMenu();
  });

  modelInput.addEventListener("input", () => {
    renderModelMenu(getAiProvider(activeProviderId), modelInput.value.trim());
    schedulePersist();
  });
  modelInput.addEventListener("blur", () => { persistSettings(); });

  keyInput.addEventListener("input", schedulePersist);
  keyInput.addEventListener("blur", () => { persistSettings(); });
  baseUrlInput.addEventListener("input", schedulePersist);
  baseUrlInput.addEventListener("blur", () => { persistSettings(); });

  document.addEventListener("click", (event) => {
    if (!card.contains(event.target)) closeModelMenu();
  });

  toggleBtn.addEventListener("click", () => {
    const isHidden = keyInput.type === "password";
    keyInput.type = isHidden ? "text" : "password";
    toggleBtn.setAttribute("aria-pressed", String(isHidden));
  });

  apiKeyLink.addEventListener("click", () => {
    openExternalUrl(getAiProvider(activeProviderId || settings.provider).apiKeyUrl);
  });

  promptTextarea.addEventListener("input", () => {
    applyPromptStageHeight(promptTextarea);
    schedulePersist();
  });
  promptTextarea.addEventListener("blur", () => { persistSettings(); });

  groupNameInput.addEventListener("input", () => {
    const name = groupNameInput.value.trim() || "未命名";
    const tab = promptGroupsBar.querySelectorAll(".ai-summary-pg-tab")[activeGroupIndex];
    if (tab) { tab.textContent = name; tab.title = name; }
    schedulePersist();
  });
  groupNameInput.addEventListener("blur", () => { persistSettings(); });

  addPgBtn.addEventListener("click", async () => {
    captureCurrentGroup();
    const newGroup = makePromptGroup(
      `提示词组 ${(settings.promptGroups || []).length + 1}`,
      DEFAULT_SUMMARY_PROMPT
    );
    settings.promptGroups = [...(settings.promptGroups || []), newGroup];
    activeGroupIndex = settings.promptGroups.length - 1;
    renderPromptGroupTabs();
    loadGroupFields(activeGroupIndex);
    groupNameInput.focus();
    groupNameInput.select();
    await persistSettings();
  });

  deletePgBtn.addEventListener("click", async () => {
    if ((settings.promptGroups || []).length <= 1) return;
    settings.promptGroups.splice(activeGroupIndex, 1);
    activeGroupIndex = Math.max(0, activeGroupIndex - 1);
    renderPromptGroupTabs();
    loadGroupFields(activeGroupIndex);
    await persistSettings();
  });

  testBtn.addEventListener("click", async () => {
    captureCurrentProviderFields();
    const provider = getAiProvider(settings.provider);
    if (!settings.apiKeys?.[provider.id]) {
      showFeedback(msg("settings_aiSummaryNeedApiKey", "请先填写 API Key。"), true);
      return;
    }
    if (!settings.models?.[provider.id]) {
      showFeedback(msg("settings_aiSummaryNeedModel", "请先选择或填写模型名。"), true);
      return;
    }
    testBtn.disabled = true;
    testBtn.textContent = msg("settings_aiSummaryTesting", "测试中...");
    try {
      const { content } = await callAiSummary(
        { ...settings, prompt: "请只回复 OK。" },
        "连接测试，请只回复 OK。"
      );
      showFeedback(`${msg("settings_aiSummaryTestOk", "连接成功")}：${content.slice(0, 40)}`);
    } catch (err) {
      showFeedback(`${msg("settings_aiSummaryTestFail", "测试失败：")}${err.message}`, true);
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = msg("settings_aiSummaryTestConn", "测试连接");
    }
  });

  return card;
}

