import { state, msg, applyDomI18n, SECTION_META } from "../state.js";
import { createOtherSettingToggle } from "./other.js";
import { createSearchConfigIoCard } from "./config-io.js";
import { persistAll } from "../store.js";
import { applyDarkModeToDoc } from "../../../shared/theme.js";

export function applyDarkMode(mode) {
  applyDarkModeToDoc(mode);
}

export function renderMiscSection() {
  const { miscSection } = state.dom;
  miscSection.innerHTML = "";

  const topRow = document.createElement("div");
  topRow.className = "misc-top-row";
  topRow.appendChild(createThemeModeCard());
  topRow.appendChild(createLocaleCard());
  miscSection.appendChild(topRow);

  miscSection.appendChild(createHomeDisplayCard());
  miscSection.appendChild(createSearchConfigIoCard());
}

function createThemeModeCard() {
  const current = state.uiPrefs?.darkMode === "dark" || state.uiPrefs?.darkMode === "light"
    ? state.uiPrefs.darkMode
    : "auto";

  const options = [
    { value: "auto", label: msg("settings_misc_themeAuto", "跟随浏览器") },
    { value: "dark", label: msg("settings_misc_themeDark", "深色") },
    { value: "light", label: msg("settings_misc_themeLight", "浅色") },
  ];
  const currentLabel = options.find((o) => o.value === current)?.label ?? options[0].label;

  const card = document.createElement("section");
  card.className = "other-settings-card misc-inline-card";
  card.innerHTML = `
    <div class="other-settings-intro">
      <strong>${msg("settings_misc_darkModeTitle", "\u4e3b\u9898\u989c\u8272")}</strong>
      <span>${msg("settings_misc_themeDesc", "可跟随浏览器配色，或固定为深色 / 浅色界面。")}</span>
    </div>
    <div class="about-locale-row">
      <div class="locale-dropdown" role="combobox" aria-haspopup="listbox" aria-expanded="false">
        <button type="button" class="locale-trigger">
          <span class="locale-trigger-label">${currentLabel}</span>
          <svg class="locale-trigger-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="locale-menu" role="listbox"></div>
      </div>
    </div>
  `;

  const dropdown = card.querySelector(".locale-dropdown");
  const trigger  = card.querySelector(".locale-trigger");
  const label    = card.querySelector(".locale-trigger-label");
  const menu     = card.querySelector(".locale-menu");

  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.role = "option";
    btn.className = "locale-option" + (opt.value === current ? " is-active" : "");
    btn.dataset.value = opt.value;
    btn.textContent = opt.label;
    menu?.appendChild(btn);
  });

  function openMenu() {
    menu.classList.add("is-open");
    dropdown.setAttribute("aria-expanded", "true");
    trigger.classList.add("is-open");
  }
  function closeMenu() {
    menu.classList.remove("is-open");
    dropdown.setAttribute("aria-expanded", "false");
    trigger.classList.remove("is-open");
  }

  trigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.contains("is-open") ? closeMenu() : openMenu();
  });

  menu?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".locale-option");
    if (!btn) return;
    closeMenu();
    const v = btn.dataset.value;
    if (v === current) return;
    label.textContent = btn.textContent;
    const next = v === "dark" || v === "light" ? v : "auto";
    state.uiPrefs.darkMode = next;
    await persistAll();
    applyDarkMode(next);
    renderMiscSection();
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target)) closeMenu();
  }, { capture: false });

  return card;
}

function createLocaleCard() {
  const current = state.uiPrefs?.localeMode === "zh" || state.uiPrefs?.localeMode === "en"
    ? state.uiPrefs.localeMode
    : "auto";

  const options = [
    { value: "auto", label: msg("settings_about_localeAuto", "跟随浏览器") },
    { value: "zh",   label: "简体中文" },
    { value: "en",   label: "English" }
  ];
  const currentLabel = options.find((o) => o.value === current)?.label ?? options[0].label;

  const card = document.createElement("section");
  card.className = "other-settings-card misc-inline-card";
  card.innerHTML = `
    <div class="other-settings-intro">
      <strong>${msg("settings_about_localeTitle", "界面语言")}</strong>
      <span>${msg("settings_about_localeDesc", "可跟随浏览器语言，或固定为中文 / 英文界面。")}</span>
    </div>
    <div class="about-locale-row">
      <div class="locale-dropdown" role="combobox" aria-haspopup="listbox" aria-expanded="false">
        <button type="button" class="locale-trigger">
          <span class="locale-trigger-label">${currentLabel}</span>
          <svg class="locale-trigger-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="locale-menu" role="listbox"></div>
      </div>
    </div>
  `;

  const dropdown = card.querySelector(".locale-dropdown");
  const trigger  = card.querySelector(".locale-trigger");
  const label    = card.querySelector(".locale-trigger-label");
  const menu     = card.querySelector(".locale-menu");

  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.role = "option";
    btn.className = "locale-option" + (opt.value === current ? " is-active" : "");
    btn.dataset.value = opt.value;
    btn.textContent = opt.label;
    menu?.appendChild(btn);
  });

  function openMenu() {
    menu.classList.add("is-open");
    dropdown.setAttribute("aria-expanded", "true");
    trigger.classList.add("is-open");
  }
  function closeMenu() {
    menu.classList.remove("is-open");
    dropdown.setAttribute("aria-expanded", "false");
    trigger.classList.remove("is-open");
  }

  trigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.contains("is-open") ? closeMenu() : openMenu();
  });

  menu?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".locale-option");
    if (!btn) return;
    closeMenu();
    const v = btn.dataset.value;
    if (v === current) return;
    label.textContent = btn.textContent;
    state.uiPrefs.localeMode = v === "zh" || v === "en" ? v : "auto";
    await persistAll();
    window.__QSHOT_I18N__?.setLocaleMode?.(state.uiPrefs.localeMode);
    applyDomI18n?.(document);
    const meta = SECTION_META[state.activeSection];
    if (meta) {
      const title    = meta.titleKey    ? msg(meta.titleKey,    meta.title)    : (meta.title    || "");
      const subtitle = meta.subtitleKey ? msg(meta.subtitleKey, meta.subtitle) : (meta.subtitle || "");
      if (state.dom.sectionEyebrow)  state.dom.sectionEyebrow.hidden = true;
      if (state.dom.sectionTitle)    { state.dom.sectionTitle.textContent = title;    state.dom.sectionTitle.hidden = !title; }
      if (state.dom.sectionSubtitle) { state.dom.sectionSubtitle.textContent = subtitle; state.dom.sectionSubtitle.hidden = !subtitle; }
      if (state.dom.sectionContentHeader) {
        state.dom.sectionContentHeader.hidden =
          !title && !subtitle && state.activeSection !== "about" && state.activeSection !== "prompts";
      }
    }
    state.renderCurrentSection();
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target)) closeMenu();
  }, { capture: false });

  return card;
}

function createHomeDisplayCard() {
  const card = document.createElement("section");
  card.className = "other-settings-card";
  card.innerHTML = `
    <div class="other-settings-intro">
      <strong>${msg("settings_other_homeDisplayTitle", "\u641c\u7d22\u6846\u663e\u793a")}</strong>
      <span>${msg("settings_other_homeDisplayDesc", "Ctrl+Q \u5feb\u6377\u952e\u4e0e\u70b9\u51fb\u9876\u90e8\u63d2\u4ef6\u56fe\u6807\u5747\u53ef\u89e6\u53d1\u7684\u641c\u7d22\u6846\u3002")}</span>
    </div>
    <div class="other-settings-list two-col"></div>
  `;
  const list = card.querySelector(".other-settings-list");
  [
    {
      key: "showHistory",
      title: msg("settings_other_showHistoryTitle", "\u663e\u793a\u641c\u7d22\u5386\u53f2")
    },
    {
      key: "showPromptButton",
      title: msg("settings_other_showPromptTitle", "\u663e\u793a\u63d0\u793a\u8bcd\u6309\u9215")
    }
  ].forEach((item) => {
    list?.appendChild(createOtherSettingToggle(item.key, item.title));
  });
  return card;
}

