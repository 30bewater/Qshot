import {
  normalizeShortcut,
  formatShortcut,
  isShortcutValid,
} from "../../../shared/shortcut.js";
import { state, msg } from "../state.js";
import { persistAll } from "../store.js";

export function createShortcutsPageHint() {
  const row = document.createElement("div");
  row.className = "shortcut-page-hint";
  row.innerHTML = `${msg("settings_other_shortcutsHintPrefix", "也可前往浏览器的")}<button type="button" class="shortcut-page-link">${msg("settings_other_shortcutsHintLink", "扩展键盘快捷方式")}</button>${msg("settings_other_shortcutsHintSuffix", "，将「激活扩展」改为快捷激活顶部弹窗（任意页面均可唤起）。")}`;

  const btn = row.querySelector(".shortcut-page-link");
  btn?.addEventListener("click", () => {
    const isEdge = /Edg\//.test(navigator.userAgent);
    const url = isEdge ? "edge://extensions/shortcuts" : "chrome://extensions/shortcuts";
    chrome.tabs.create({ url }).catch(() => {});
  });

  return row;
}

export function createShortcutRecorderRow() {
  const row = document.createElement("article");
  row.className = "other-setting-row other-setting-row--with-tip shortcut-row";
  row.innerHTML = `
    <div class="other-setting-row-main">
      <div class="other-setting-copy">
        <div class="other-setting-title">${msg("settings_other_customShortcutTitle", "自定义快捷键")}</div>
        <div class="other-setting-desc">${msg("settings_other_customShortcutDesc", "点击右侧按钮后按下组合键即可录制。必须至少包含一个修饰键（Ctrl / Alt / Shift / Win）。")}</div>
      </div>
      <div class="shortcut-recorder">
        <button type="button" class="shortcut-display" aria-label="${msg("settings_other_recordShortcutAria", "录制快捷键")}"></button>
        <button type="button" class="shortcut-reset" title="${msg("settings_other_resetShortcutTitle", "恢复默认 Alt + Q")}">${msg("settings_other_resetShortcut", "恢复默认")}</button>
      </div>
    </div>
    <div class="other-setting-desc shortcut-tip">${msg("settings_other_shortcutRefreshTip", "提示：修改快捷键后，需要刷新当前网页才会生效。")}</div>
  `;

  const display = row.querySelector(".shortcut-display");
  const resetBtn = row.querySelector(".shortcut-reset");
  let isRecording = false;

  function renderDisplay() {
    if (!(display instanceof HTMLButtonElement)) return;
    if (isRecording) {
      display.textContent = msg("settings_other_recording", "按下组合键…");
      display.classList.add("is-recording");
    } else {
      display.textContent = formatShortcut(state.uiPrefs.overlayShortcut);
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
      display.textContent = msg("settings_other_recordInvalid", "必须包含修饰键，请重试");
      return;
    }

    state.uiPrefs.overlayShortcut = candidate;
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
    state.uiPrefs.overlayShortcut = normalizeShortcut(null);
    await persistAll();
    renderDisplay();
  });

  renderDisplay();
  return row;
}

