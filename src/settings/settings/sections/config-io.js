import {
  QUICK_ACCESS_SITES_KEY,
  SELECTION_CONTEXT_GROUPS_STORAGE_KEY,
} from "../../../shared/storage-keys.js";
import {
  loadAiSummarySettings,
  saveAiSummarySettings,
} from "../../../shared/ai-summary-api.js";
import { state, msg } from "../state.js";
import {
  persistAll,
  createNormalizedGroups,
  createNormalizedCustomSites,
  createNormalizedSelectionContextGroups,
  mergeSites,
} from "../store.js";

const CONFIG_VERSION = 2;

const EXPORT_SECTION_DEFS = [
  {
    key: "searchGroups",
    label: msg("settings_configIo_sectionSearchGroups", "搜索组"),
  },
  {
    key: "customSites",
    label: msg("settings_configIo_sectionCustomSites", "自定义搜索"),
  },
  {
    key: "quickAccessSites",
    label: msg("settings_configIo_sectionQuickAccess", "全局搜索站点"),
  },
  {
    key: "selectionContextGroups",
    label: msg("settings_configIo_sectionCtxGroups", "右键提示词"),
  },
  {
    key: "aiSummarySettings",
    label: msg("settings_configIo_sectionAiSummary", "AI 总结设置"),
  },
];

const SECTION_LABELS = Object.fromEntries(
  EXPORT_SECTION_DEFS.map((item) => [item.key, item.label])
);

export function createSearchConfigIoCard() {
  const card = document.createElement("section");
  card.className = "other-settings-card";
  card.innerHTML = `
    <div class="other-settings-intro">
      <strong>${msg("settings_other_searchConfigIoTitle", "导入 / 导出配置")}</strong>
      <span>${msg("settings_configIo_desc", "导出预设配置为 JSON 文件，可按需勾选搜索组、自定义搜索、全局搜索站点、右键提示词和 AI 总结设置。导入时会覆盖对应模块的当前内容。")}</span>
    </div>
    <div class="search-config-io-row">
      <button type="button" class="search-config-io-btn search-config-export-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        ${msg("settings_other_exportConfig", "导出配置")}
      </button>
      <button type="button" class="search-config-io-btn search-config-import-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 5 17 10"/><line x1="12" y1="5" x2="12" y2="17"/></svg>
        ${msg("settings_other_importConfig", "导入配置")}
      </button>
      <span class="search-config-io-hint" aria-live="polite"></span>
    </div>
  `;

  card.querySelector(".search-config-export-btn").addEventListener("click", openExportModal);
  card.querySelector(".search-config-import-btn").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", handleConfigImportFile);
    input.click();
  });

  return card;
}

function openExportModal() {
  document.getElementById("configExportModal")?.remove();

  const selections = Object.fromEntries(EXPORT_SECTION_DEFS.map((item) => [item.key, true]));

  const overlay = document.createElement("div");
  overlay.id = "configExportModal";
  overlay.className = "import-modal-overlay";
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeExportModal();
  });

  const dialog = document.createElement("div");
  dialog.className = "import-modal-dialog config-export-dialog";

  const header = document.createElement("div");
  header.className = "import-modal-header";
  header.innerHTML = `
    <div>
      <div class="import-modal-title">${msg("settings_configIo_exportTitle", "导出配置")}</div>
      <div class="import-modal-subtitle">${msg("settings_configIo_exportSubtitle", "勾选要导出的预设模块，文件格式为 JSON。")}</div>
    </div>
  `;
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "import-modal-close";
  closeBtn.setAttribute("aria-label", msg("common_close", "关闭"));
  closeBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  closeBtn.addEventListener("click", closeExportModal);
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "import-modal-body config-export-body";

  EXPORT_SECTION_DEFS.forEach((item) => {
    const row = document.createElement("label");
    row.className = "config-export-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "import-checkbox";
    checkbox.checked = true;
    checkbox.dataset.sectionKey = item.key;
    checkbox.addEventListener("change", updateExportConfirmState);
    const label = document.createElement("span");
    label.className = "config-export-option-label";
    label.textContent = item.label;
    row.appendChild(checkbox);
    row.appendChild(label);
    body.appendChild(row);
  });

  const footer = document.createElement("div");
  footer.className = "import-modal-footer";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "import-footer-cancel-btn";
  cancelBtn.textContent = msg("common_cancel", "取消");
  cancelBtn.addEventListener("click", closeExportModal);

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "import-footer-confirm-btn";
  confirmBtn.id = "configExportConfirmBtn";
  confirmBtn.textContent = msg("settings_configIo_exportConfirm", "导出 JSON");
  confirmBtn.addEventListener("click", async () => {
    const selectedKeys = EXPORT_SECTION_DEFS
      .map((item) => item.key)
      .filter((key) => overlay.querySelector(`input[data-section-key="${key}"]`)?.checked);
    if (!selectedKeys.length) return;
    await doExport(selectedKeys);
    closeExportModal();
  });

  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);
  dialog.appendChild(header);
  dialog.appendChild(body);
  dialog.appendChild(footer);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  function updateExportConfirmState() {
    const count = body.querySelectorAll("input[type='checkbox']:checked").length;
    confirmBtn.disabled = count === 0;
    confirmBtn.textContent = count > 0
      ? msg("settings_configIo_exportConfirmCount", "导出 JSON") + ` (${count})`
      : msg("settings_configIo_exportConfirm", "导出 JSON");
  }

  updateExportConfirmState();
}

function closeExportModal() {
  document.getElementById("configExportModal")?.remove();
}

async function collectSectionData(key) {
  if (key === "searchGroups") return state.groups;
  if (key === "customSites") return state.customSites;
  if (key === "quickAccessSites") return state.quickAccessSiteIds;
  if (key === "selectionContextGroups") return state.selectionContextGroups;
  if (key === "aiSummarySettings") return loadAiSummarySettings();
  return null;
}

async function doExport(selectedKeys) {
  const payload = {
    version: CONFIG_VERSION,
    exportedAt: new Date().toISOString(),
    exportSections: selectedKeys,
  };

  for (const key of selectedKeys) {
    payload[key] = await collectSectionData(key);
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Qshot配置-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function getImportableSections(payload) {
  if (!payload || typeof payload !== "object") return [];
  return EXPORT_SECTION_DEFS
    .map((item) => item.key)
    .filter((key) => {
      const value = payload[key];
      if (key === "quickAccessSites") return Array.isArray(value);
      if (key === "aiSummarySettings") return value && typeof value === "object";
      return Array.isArray(value) && value.length > 0;
    });
}

function describeImportSections(sectionKeys) {
  return sectionKeys.map((key) => SECTION_LABELS[key] || key).join("、");
}

async function handleConfigImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch (_) {
    alert(msg("settings_other_importParseError", "无法解析文件，请确认是否为从本插件导出的 JSON 配置文件。"));
    return;
  }

  if (!payload || typeof payload !== "object") {
    alert(msg("settings_other_importInvalidFormat", "文件格式不正确，请使用本插件导出的配置文件。"));
    return;
  }

  const version = payload.version;
  if (version !== 1 && version !== CONFIG_VERSION) {
    alert(msg("settings_other_importInvalidFormat", "文件格式不正确，请使用本插件导出的配置文件。"));
    return;
  }

  const sectionKeys = getImportableSections(payload);
  if (!sectionKeys.length) {
    alert(msg("settings_configIo_importEmpty", "文件中没有可导入的配置内容。"));
    return;
  }

  const desc = describeImportSections(sectionKeys);
  const confirmed = confirm([
    msg("settings_other_importConfirmLine1Prefix", "即将导入 ") + desc + msg("settings_other_importConfirmLine1Suffix", "。"),
    "",
    msg("settings_configIo_importConfirmReplace", "导入后将覆盖对应模块的当前配置，此操作不可撤销。"),
    "",
    msg("settings_other_importConfirmLine3", "确认继续？"),
  ].join("\n"));
  if (!confirmed) return;

  if (sectionKeys.includes("customSites")) {
    state.customSites = createNormalizedCustomSites(payload.customSites);
    const builtinSites = state.sites.filter((site) => !site.isCustom);
    state.sites = mergeSites(builtinSites, state.customSites);
  }

  if (sectionKeys.includes("searchGroups")) {
    state.groups = createNormalizedGroups(payload.searchGroups);
  }

  if (sectionKeys.includes("quickAccessSites")) {
    state.quickAccessSiteIds = payload.quickAccessSites.filter((id) => typeof id === "string");
    await chrome.storage.local.set({ [QUICK_ACCESS_SITES_KEY]: state.quickAccessSiteIds });
  }

  if (sectionKeys.includes("selectionContextGroups")) {
    state.selectionContextGroups = createNormalizedSelectionContextGroups(payload.selectionContextGroups);
  }

  if (sectionKeys.includes("aiSummarySettings")) {
    await saveAiSummarySettings(payload.aiSummarySettings);
  }

  await persistAll();
  refreshAfterConfigImport(sectionKeys);
}

function refreshAfterConfigImport(sectionKeys) {
  if (state.activeSection === "misc") {
    state.renderMiscSection?.();
  }
  if (state.activeSection === "groups" || sectionKeys.includes("searchGroups")) {
    state.renderGroupsSection?.();
  }
  if (state.activeSection === "custom" || sectionKeys.includes("customSites")) {
    state.renderCustomSection?.();
  }
  if (state.activeSection === "other" || sectionKeys.includes("quickAccessSites") || sectionKeys.includes("selectionContextGroups")) {
    state.renderOtherSection?.();
  }
  if (state.activeSection === "aiSummary" || sectionKeys.includes("aiSummarySettings")) {
    state.renderAiSummarySection?.();
  }
}
