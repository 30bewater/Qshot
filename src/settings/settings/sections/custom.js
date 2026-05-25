import { state, msg, createBlankCustomFormState } from "../state.js";
import { escapeHtml } from "../utils.js";
import {
  persistAll,
  createCustomSiteId,
  deriveMatchPatterns,
  convertUrlToTemplate,
} from "../store.js";

// ── Tab 顶部切换 ────────────────────────────────────────────

export function renderCustomSection() {
  const { customSection } = state.dom;
  customSection.innerHTML = "";
  renderSearchTab(customSection);
}

// ── 搜索 Tab（原有 URL 模板逻辑）──────────────────────────

function renderSearchTab(container) {
  // URL converter 工具卡
  const converter = document.createElement("section");
  converter.className = "custom-search-card";
  converter.innerHTML = `
    <div class="custom-search-card-head">
      <strong>${msg("settings_custom_convertTitle", "URL 规则转换")}</strong>
      <span>${msg("settings_custom_convertDesc", "粘贴一条带搜索词的 URL，我们尝试自动识别搜索参数并替换为 {query}。")}</span>
    </div>
    <div class="custom-converter-row">
      <input class="custom-converter-input" type="text" />
      <button class="custom-converter-btn" type="button">${msg("settings_custom_convertBtn", "转换")}</button>
    </div>
    <div class="custom-converter-msg" data-field="converter-msg"></div>
  `;

  const converterInput = converter.querySelector(".custom-converter-input");
  const converterBtn = converter.querySelector(".custom-converter-btn");
  const converterMsg = converter.querySelector("[data-field='converter-msg']");

  if (converterInput instanceof HTMLInputElement) {
    converterInput.value = state.customFormState.converterInput || "";
    converterInput.addEventListener("input", (e) => {
      state.customFormState.converterInput = e.target.value;
      state.customFormState.converterError = "";
      if (converterMsg) {
        converterMsg.textContent = "";
        converterMsg.classList.remove("is-error", "is-success");
      }
    });
    converterInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); handleConvertClick(); }
    });
  }
  converterBtn?.addEventListener("click", handleConvertClick);

  if (state.customFormState.converterError && converterMsg) {
    converterMsg.textContent = state.customFormState.converterError;
    converterMsg.classList.add("is-error");
  }

  function handleConvertClick() {
    const result = convertUrlToTemplate(state.customFormState.converterInput);
    if (!result.ok) {
      state.customFormState.converterError = result.error;
      if (converterMsg) {
        converterMsg.textContent = result.error;
        converterMsg.classList.add("is-error");
        converterMsg.classList.remove("is-success");
      }
      return;
    }
    state.customFormState.url = result.url;
    if (!state.customFormState.name && result.name) state.customFormState.name = result.name;
    state.customFormState.formError = "";
    state.customFormState.converterError = "";
    renderCustomSection();
  }

  const layout = document.createElement("div");
  layout.className = "custom-search-layout";

  const leftCol = document.createElement("div");
  leftCol.className = "custom-search-col-left";

  const rightCol = document.createElement("div");
  rightCol.className = "custom-search-col-right";

  leftCol.appendChild(converter);

  // 手动添加 / 编辑表单
  const form = document.createElement("section");
  form.className = "custom-search-card";
  const isEditing = state.customFormState.mode === "edit" && state.customFormState.customType !== "ai";
  form.innerHTML = `
    <div class="custom-search-card-head">
      <strong>${isEditing ? msg("settings_custom_editTitle", "编辑自定义站点") : msg("settings_custom_addTitle", "手动添加")}</strong>
      <span>${msg("settings_custom_addDesc", "填写站点名称与 URL，{query} 会在搜索时自动替换为你的关键词。")}</span>
    </div>
    <label class="custom-field">
      <span class="field-label inline-field-label">${msg("settings_custom_fieldName", "名称")}</span>
      <input class="custom-form-input" type="text" data-field="name" />
    </label>
    <label class="custom-field">
      <span class="field-label inline-field-label">${msg("settings_custom_fieldUrl", "URL 链接")}</span>
      <input class="custom-form-input" type="text" data-field="url" />
    </label>
    <div class="custom-form-msg" data-field="form-msg"></div>
    <div class="custom-form-actions">
      ${isEditing ? `<button class="custom-form-cancel-btn" type="button">${msg("settings_custom_cancelEdit", "取消编辑")}</button>` : ""}
      <button class="custom-form-submit-btn" type="button">${isEditing ? msg("settings_custom_saveEdit", "保存修改") : msg("settings_custom_confirmAdd", "确定添加")}</button>
    </div>
  `;

  const nameInput = form.querySelector("[data-field='name']");
  const urlInput = form.querySelector("[data-field='url']");
  const formMsg = form.querySelector("[data-field='form-msg']");
  const submitBtn = form.querySelector(".custom-form-submit-btn");
  const cancelBtn = form.querySelector(".custom-form-cancel-btn");

  if (nameInput instanceof HTMLInputElement) {
    nameInput.value = state.customFormState.name || "";
    nameInput.addEventListener("input", (e) => { state.customFormState.name = e.target.value; });
  }
  if (urlInput instanceof HTMLInputElement) {
    urlInput.value = state.customFormState.url || "";
    urlInput.addEventListener("input", (e) => { state.customFormState.url = e.target.value; });
  }
  if (state.customFormState.formError && formMsg) {
    formMsg.textContent = state.customFormState.formError;
    formMsg.classList.add("is-error");
  }
  submitBtn?.addEventListener("click", handleSearchFormSubmit);
  cancelBtn?.addEventListener("click", () => {
    state.customFormState = createBlankCustomFormState();
    renderCustomSection();
  });

  leftCol.appendChild(form);

  // 已添加的 URL 搜索站点列表
  const urlSites = state.customSites.filter((s) => s.customType !== "ai");
  const listCard = document.createElement("section");
  listCard.className = "custom-search-card custom-sites-list-card";
  const listHead = document.createElement("div");
  listHead.className = "custom-search-card-head";
  listHead.innerHTML = `
    <strong>${msg("settings_custom_listTitle", "已添加的自定义站点")}</strong>
    <span>${msg("settings_custom_listCountPrefix", "当前共 ")}${urlSites.length}${msg("settings_custom_listCountSuffix", " 个自定义站点。")}</span>
  `;
  listCard.appendChild(listHead);

  if (!urlSites.length) {
    const empty = document.createElement("div");
    empty.className = "site-selection-empty";
    empty.textContent = msg("settings_custom_listEmpty", "还没有自定义站点，上方添加后会在这里显示。");
    listCard.appendChild(empty);
  } else {
    const list = document.createElement("div");
    list.className = "custom-sites-list";
    urlSites.forEach((site) => list.appendChild(createUrlSiteRow(site)));
    listCard.appendChild(list);
  }
  rightCol.appendChild(listCard);

  layout.appendChild(leftCol);
  layout.appendChild(rightCol);
  container.appendChild(layout);
}

function createUrlSiteRow(site) {
  const row = document.createElement("article");
  row.className = "custom-site-row";
  row.innerHTML = `
    <div class="custom-site-info">
      <div class="custom-site-name">${escapeHtml(site.name)}</div>
      <div class="custom-site-url">${escapeHtml(site.url)}</div>
    </div>
    <div class="custom-site-actions">
      <button class="custom-site-edit-btn" type="button">${msg("common_edit", "编辑")}</button>
      <button class="custom-site-delete-btn" type="button" aria-label="${msg("common_delete", "删除")}">×</button>
    </div>
  `;

  row.querySelector(".custom-site-edit-btn")?.addEventListener("click", () => {
    state.customFormState = {
      mode: "edit",
      editingId: site.id,
      customType: "url",
      name: site.name,
      url: site.url,
      inputSelector: "",
      submitSelector: "",
      converterInput: "",
      converterError: "",
      formError: ""
    };
    renderCustomSection();
    state.dom.customSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  row.querySelector(".custom-site-delete-btn")?.addEventListener("click", async () => {
    const confirmed = window.confirm(
      msg("settings_custom_deleteConfirmPrefix", "是否要删除自定义站点「") +
        site.name +
        msg("settings_custom_deleteConfirmMid", "」？\n") +
        msg("settings_custom_deleteConfirmBody", "删除后，所有搜索组中引用该站点的记录也会同步移除。")
    );
    if (!confirmed) return;
    state.customSites = state.customSites.filter((item) => item.id !== site.id);
    state.groups = state.groups.map((group) => ({
      ...group,
      siteIds: (group.siteIds || []).filter((id) => id !== site.id)
    }));
    if (state.customFormState.mode === "edit" && state.customFormState.editingId === site.id) {
      state.customFormState = createBlankCustomFormState();
    }
    await persistAll();
    renderCustomSection();
  });

  return row;
}

async function handleSearchFormSubmit() {
  const name = String(state.customFormState.name || "").trim();
  const url = String(state.customFormState.url || "").trim();

  const setError = (msg_) => {
    state.customFormState.formError = msg_;
    renderCustomSection();
  };

  if (!name) return setError(msg("settings_custom_errorNameRequired", "请输入站点名称。"));
  if (!url) return setError(msg("settings_custom_errorUrlRequired", "请输入 URL 链接。"));
  if (!/^https?:\/\//i.test(url)) return setError(msg("settings_custom_errorUrlProtocol", "URL 必须以 http:// 或 https:// 开头。"));
  if (!url.includes("{query}")) return setError(msg("settings_custom_errorMissingQuery", "URL 中必须包含 {query} 作为搜索词占位符。"));
  try { new URL(url.replace("{query}", "ai")); } catch (_) {
    return setError(msg("settings_custom_errorUrlInvalid", "URL 格式不合法，请检查后重试。"));
  }

  if (state.customFormState.mode === "edit" && state.customFormState.editingId) {
    state.customSites = state.customSites.map((site) =>
      site.id === state.customFormState.editingId
        ? { ...site, name, url, supportUrlQuery: true, matchPatterns: deriveMatchPatterns(url) }
        : site
    );
  } else {
    state.customSites = [...state.customSites, {
      id: createCustomSiteId(),
      name, url,
      enabled: true,
      supportIframe: true,
      supportUrlQuery: true,
      matchPatterns: deriveMatchPatterns(url),
      isCustom: true,
      customType: "url"
    }];
  }

  state.customFormState = createBlankCustomFormState();
  await persistAll();
  renderCustomSection();
}


