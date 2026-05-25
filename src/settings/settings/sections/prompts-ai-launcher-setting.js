import { isAiPagePromptLauncherEnabledForSite } from "../../../shared/ai-page-prompt-launcher-prefs.js";
import { AI_SITE_GROUPS } from "../../../shared/site-groups.js";
import { msg, state } from "../state.js";
import { escapeHtml } from "../utils.js";
import { persistAll } from "../store.js";
import { renderStretchSwitchMarkup } from "./stretch-switch.js";

let sitesPanelExpanded = false;

function getSiteMap() {
  return new Map((state.sites || []).map((site) => [site.id, site]));
}

function getGroupedLauncherSiteOptions() {
  const siteMap = getSiteMap();
  const groupedIds = new Set();

  const grouped = AI_SITE_GROUPS.map((marketGroup) => ({
    labelKey: marketGroup.labelKey,
    label: marketGroup.label,
    sites: marketGroup.siteIds
      .map((id) => siteMap.get(id))
      .filter((site) => site && site.enabled !== false)
      .map((site) => {
        groupedIds.add(site.id);
        return { id: site.id, name: site.name };
      }),
  })).filter((group) => group.sites.length > 0);

  const customSites = (state.sites || [])
    .filter((site) => site?.isCustom && site.customType === "ai" && !groupedIds.has(site.id))
    .map((site) => ({ id: site.id, name: site.name }));

  return { grouped, customSites };
}

function isLauncherSiteEnabled(siteId) {
  return isAiPagePromptLauncherEnabledForSite(state.uiPrefs, siteId);
}

function isGlobalLauncherEnabled() {
  return state.uiPrefs?.showAiPagePromptLauncher !== false;
}

function createSiteChip({ id, name }) {
  const label = document.createElement("label");
  label.className = "prompt-launcher-site-chip";
  if (!isLauncherSiteEnabled(id)) label.classList.add("is-off");
  const checked = isLauncherSiteEnabled(id);
  label.innerHTML = `
    <input type="checkbox" data-site-id="${escapeHtml(id)}" ${checked ? "checked" : ""} />
    <span>${escapeHtml(name)}</span>
  `;
  return label;
}

function createSiteGroupSection(title, sites) {
  const section = document.createElement("section");
  section.className = "prompt-launcher-site-group";

  const groupTitle = document.createElement("div");
  groupTitle.className = "prompt-launcher-site-group-title";
  groupTitle.textContent = title;
  section.appendChild(groupTitle);

  const siteGrid = document.createElement("div");
  siteGrid.className = "prompt-launcher-site-grid";
  sites.forEach((site) => siteGrid.appendChild(createSiteChip(site)));
  section.appendChild(siteGrid);

  return section;
}

function bindSiteChipInputs(root) {
  root.querySelectorAll("input[data-site-id]").forEach((input) => {
    input.addEventListener("change", async () => {
      const siteId = input.dataset.siteId;
      if (!siteId) return;
      if (!state.uiPrefs || typeof state.uiPrefs !== "object") {
        state.uiPrefs = {};
      }
      state.uiPrefs.aiPagePromptLauncherSites = {
        ...(state.uiPrefs.aiPagePromptLauncherSites || {}),
        [siteId]: input.checked,
      };
      input.closest(".prompt-launcher-site-chip")?.classList.toggle("is-off", !input.checked);
      await persistAll();
    });
  });
}

export function createAiPageLauncherSetting() {
  const block = document.createElement("article");
  block.className = "prompt-launcher-setting";

  const head = document.createElement("div");
  head.className = "prompt-launcher-setting-head";

  const expandBtn = document.createElement("button");
  expandBtn.type = "button";
  expandBtn.className = `prompt-launcher-expand-btn${sitesPanelExpanded ? " is-expanded" : ""}`;
  expandBtn.setAttribute("aria-expanded", sitesPanelExpanded ? "true" : "false");
  expandBtn.setAttribute("aria-label", msg("settings_prompts_aiLauncherSitesExpandAria", "展开 AI 站点列表"));
  expandBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
    <path d="M3 5 6.5 8.5 10 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const copy = document.createElement("div");
  copy.className = "other-setting-copy";
  copy.innerHTML = `
    <div class="other-setting-title">${escapeHtml(msg("settings_prompts_aiLauncherSwitchTitle", "显示输入框旁 Q 按钮"))}</div>
    <div class="other-setting-desc prompt-launcher-desc">${escapeHtml(msg("settings_prompts_aiLauncherSwitchDesc", "关闭后，ChatGPT、DeepSeek、Kimi、通义/Qwen 等 AI 页面输入框旁将不再显示 Qshot 提示词按钮。"))}</div>
  `;

  const globalOn = isGlobalLauncherEnabled();
  const toggleWrap = document.createElement("div");
  toggleWrap.innerHTML = renderStretchSwitchMarkup(globalOn);

  head.appendChild(expandBtn);
  head.appendChild(copy);
  head.appendChild(toggleWrap.firstElementChild);

  const panelOuter = document.createElement("div");
  panelOuter.className = `prompt-launcher-panel-outer${sitesPanelExpanded ? " is-open" : ""}`;

  const panelInner = document.createElement("div");
  panelInner.className = "prompt-launcher-panel-inner";

  const panelIntro = document.createElement("p");
  panelIntro.className = "prompt-launcher-panel-intro";
  panelIntro.textContent = msg(
    "settings_prompts_aiLauncherSitesIntro",
    "勾选要在输入框旁显示 Q 按钮的 AI 站点；取消勾选即可在对应页面隐藏。"
  );

  const siteGroupsWrap = document.createElement("div");
  siteGroupsWrap.className = "prompt-launcher-site-groups";

  const { grouped, customSites } = getGroupedLauncherSiteOptions();
  grouped.forEach((group) => {
    siteGroupsWrap.appendChild(
      createSiteGroupSection(msg(group.labelKey, group.label), group.sites)
    );
  });
  if (customSites.length) {
    siteGroupsWrap.appendChild(
      createSiteGroupSection(msg("settings_groups_categoryCustom", "自定义"), customSites)
    );
  }

  panelInner.appendChild(panelIntro);
  panelInner.appendChild(siteGroupsWrap);
  panelOuter.appendChild(panelInner);

  expandBtn.addEventListener("click", () => {
    sitesPanelExpanded = !sitesPanelExpanded;
    panelOuter.classList.toggle("is-open", sitesPanelExpanded);
    expandBtn.classList.toggle("is-expanded", sitesPanelExpanded);
    expandBtn.setAttribute("aria-expanded", sitesPanelExpanded ? "true" : "false");
  });

  head.querySelector(".other-setting-switch--stretch-input")?.addEventListener("change", async (event) => {
    state.uiPrefs.showAiPagePromptLauncher = event.target.checked;
    await persistAll();
  });

  bindSiteChipInputs(siteGroupsWrap);

  block.appendChild(head);
  block.appendChild(panelOuter);
  return block;
}
