import { state, msg } from "../state.js";
import { persistAll } from "../store.js";
import { renderStretchSwitchMarkup } from "./stretch-switch.js";

function getBubblePref(key, defaultValue = true) {
  const prefs = state.uiPrefs || {};
  if (Object.prototype.hasOwnProperty.call(prefs, key)) {
    return prefs[key] !== false;
  }
  return defaultValue;
}

function createBubbleSourceToggle(key, title, defaultValue = true) {
  const isOn = getBubblePref(key, defaultValue);
  const item = document.createElement("div");
  item.className = "bubble-source-item";
  item.innerHTML = `
    <div class="bubble-source-main">
      <div class="bubble-source-label">${title}</div>
      ${renderStretchSwitchMarkup(isOn)}
    </div>
  `;
  item.querySelector(".other-setting-switch--stretch-input")?.addEventListener("change", async (event) => {
    state.uiPrefs = state.uiPrefs || {};
    state.uiPrefs[key] = event.target.checked;
    await persistAll();
  });
  return item;
}

export function renderSelectionBubbleSection() {
  const wrap = document.createElement("div");
  wrap.className = "selection-ctx-groups-wrap";

  // ── 主开关卡片 ──
  const toggleCard = document.createElement("section");
  toggleCard.className = "other-settings-card";
  const isOn = state.uiPrefs?.selectionSearchEnabled === true;
  toggleCard.innerHTML = `
    <div class="selection-ctx-intro-body">
      <div class="other-settings-intro">
        <strong>${msg("settings_other_selectionSearchToggleTitle", "划词搜索气泡")}</strong>
        <span>${msg("settings_other_selectionSearchToggleDesc", "选中文字后自动弹出搜索快捷气泡。")}</span>
      </div>
      ${renderStretchSwitchMarkup(isOn)}
    </div>
  `;
  toggleCard.querySelector(".other-setting-switch--stretch-input")?.addEventListener("change", async (event) => {
    state.uiPrefs = state.uiPrefs || {};
    state.uiPrefs.selectionSearchEnabled = event.target.checked;
    await persistAll();
  });
  wrap.appendChild(toggleCard);

  // ── 气泡显示内容（三选项横排）──
  const sourceCard = document.createElement("section");
  sourceCard.className = "other-settings-card";

  const sourceTitle = document.createElement("div");
  sourceTitle.className = "other-settings-intro";
  sourceTitle.style.marginBottom = "14px";
  sourceTitle.innerHTML = `
    <strong>${msg("settings_bubble_sourceTitle", "气泡显示内容")}</strong>
    <span style="font-size:var(--fs-sm);color:#888;">
      ${msg("settings_bubble_sourceHint", "可同时开启多项，气泡依次展示各组条目，组间以分割线分隔。建议同时开启不超过两个，否则气泡会显得臃肿。每组最多显示 5 个条目。")}
    </span>
  `;
  sourceCard.appendChild(sourceTitle);

  const sourceRow = document.createElement("div");
  sourceRow.className = "bubble-source-row";

  sourceRow.appendChild(
    createBubbleSourceToggle("bubbleShowGroups", msg("settings_bubble_sourceGroups", "搜索组"), true)
  );
  sourceRow.appendChild(
    createBubbleSourceToggle("bubbleShowCtx", msg("settings_bubble_sourceCtx", "右键提示词组"), false)
  );
  sourceRow.appendChild(
    createBubbleSourceToggle("bubbleShowGlobalSites", msg("settings_bubble_sourceGlobalSites", "全局搜索站点"), false)
  );

  sourceCard.appendChild(sourceRow);
  wrap.appendChild(sourceCard);

  return wrap;
}
