import { state, SITE_CATEGORIES } from "./state.js";
import { collectVisibleResponses } from "./export-collect.js";
import {
  loadAiSummarySettings,
  buildSummaryInput,
  getActiveAiSummaryApiKey,
  getActiveAiSummaryProvider,
  streamAiSummary,
  getPromptGroups,
  getPromptText,
  getProvidersWithApiKeys,
} from "../../shared/ai-summary-api.js";
import {
  renderMarkdown,
  stripMarkdown,
  htmlWithStreamCursor,
  downloadText,
  getSummaryFilename,
  exportAsPdf,
} from "./ai-summary-render.js";
import { attachAiSummaryModalTilt } from "./ai-summary-tilt.js";

function t(key, fallback) {
  return window.__QSHOT_I18N__?.t?.(key) || fallback || "";
}

function formatSummaryCardNames(items) {
  const names = [
    ...new Set(
      (items || [])
        .map((item) => String(item?.siteName || item?.site?.name || "").trim())
        .filter(Boolean)
    ),
  ];
  if (names.length === 0) return t("iframe_aiSummaryCardsFallback", "当前 AI 卡片");
  if (names.length <= 4) return names.join("、");
  return `${names.slice(0, 4).join("、")} 等`;
}

function buildSummaryCallingNotice(provider, items) {
  const cards = formatSummaryCardNames(items);
  return t("iframe_aiSummaryCalling", "正在调用 {provider} 总结当前页面 {cards} 的答案…")
    .replace("{provider}", provider?.label || "")
    .replace("{cards}", cards);
}

// ─── Dropdown helper (appends to body, position:fixed above trigger) ──────────
function showDropdown(triggerBtn, items) {
  document.querySelectorAll(".ai-dd-menu").forEach((m) => m.remove());
  const menu = document.createElement("div");
  menu.className = "ai-dd-menu";
  items.forEach(({ label, action }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ai-dd-item";
    btn.textContent = label;
    btn.addEventListener("click", () => { menu.remove(); action(); });
    menu.appendChild(btn);
  });
  document.body.appendChild(menu);
  const rect = triggerBtn.getBoundingClientRect();
  menu.style.cssText = `position:fixed;z-index:9999;bottom:${window.innerHeight - rect.top + 6}px;right:${window.innerWidth - rect.right}px`;
  const closeHandler = (e) => {
    if (!menu.contains(e.target) && e.target !== triggerBtn) {
      menu.remove();
      document.removeEventListener("click", closeHandler, true);
    }
  };
  setTimeout(() => document.addEventListener("click", closeHandler, true), 0);
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function showAiSummaryModal() {
  const existing = document.getElementById("aiSummaryModal");
  if (existing) { existing.remove(); return; }

  const aiSiteIds = new Set((SITE_CATEGORIES.find((c) => c.id === "ai")?.builtinIds) || []);
  const summaryRefs = Array.from(state.cardRefs.values()).filter((ref) => aiSiteIds.has(ref?.site?.id));

  const modal = document.createElement("div");
  modal.id = "aiSummaryModal";
  modal.className = "export-modal ai-summary-modal";
  modal.innerHTML = `
    <div class="export-modal-content ai-summary-modal-content">
      <div class="export-modal-header">
        <h3 class="export-modal-title">${t("iframe_aiSummaryModalTitle", "AI 一键总结")}</h3>
        <button class="export-close-btn" type="button" aria-label="关闭">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="export-notice ai-summary-notice" hidden>
        <span class="ai-summary-notice-text"></span>
        <button class="export-cancel-btn ai-summary-settings-btn" type="button" hidden>${t("iframe_aiSummaryOpenSettings", "打开设置")}</button>
      </div>
      <div class="export-modal-body ai-summary-body">
        <div class="ai-summary-tabs-strip" hidden></div>
        <div class="ai-summary-main">
          <div class="ai-summary-prompt-selector" hidden></div>
          <details class="ai-summary-thinking" hidden>
            <summary class="ai-summary-thinking-summary"><span class="ai-thinking-chevron"></span>${t("iframe_aiSummaryThinking", "思考过程")}</summary>
            <div class="ai-summary-thinking-body"></div>
          </details>
          <div class="ai-summary-result" hidden></div>
        </div>
      </div>
      <div class="export-actions ai-summary-actions">
        <button class="export-cancel-btn ai-summary-cancel-btn" type="button">取消</button>
        <button class="export-cancel-btn ai-summary-retry-btn" type="button" hidden>${t("iframe_aiSummaryRetry", "重新分析")}</button>
        <button class="export-cancel-btn ai-summary-switch-model-btn" type="button" hidden>${t("iframe_aiSummarySwitchModel", "切换模型")}</button>
        <button class="export-cancel-btn ai-summary-export-btn" type="button" hidden>导出</button>
        <button class="export-confirm-btn ai-summary-copy-btn" type="button" hidden>复制</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const contentEl = modal.querySelector(".ai-summary-modal-content");
  const modalTilt = attachAiSummaryModalTilt(modal, contentEl);

  const noticeEl      = modal.querySelector(".ai-summary-notice");
  const noticeTextEl  = modal.querySelector(".ai-summary-notice-text");
  const bodyEl        = modal.querySelector(".ai-summary-body");
  const tabsStripEl    = modal.querySelector(".ai-summary-tabs-strip");
  const mainEl         = modal.querySelector(".ai-summary-main");
  const actionsEl      = modal.querySelector(".ai-summary-actions");
  const thinkingEl     = modal.querySelector(".ai-summary-thinking");
  const thinkingBodyEl = modal.querySelector(".ai-summary-thinking-body");
  const resultEl       = modal.querySelector(".ai-summary-result");
  const cancelBtn       = modal.querySelector(".ai-summary-cancel-btn");
  const settingsBtn     = modal.querySelector(".ai-summary-settings-btn");
  const retryBtn        = modal.querySelector(".ai-summary-retry-btn");
  const switchModelBtn  = modal.querySelector(".ai-summary-switch-model-btn");
  const exportBtn       = modal.querySelector(".ai-summary-export-btn");
  const copyBtn         = modal.querySelector(".ai-summary-copy-btn");

  // ─── Multi-session state ────────────────────────────────────────────────────
  const sessions = [];
  let activeIdx = -1;

  function addSession(groupId, groupName) {
    const s = { id: sessions.length, groupId, groupName: groupName || t("iframe_aiSummaryDefaultPrompt", "默认"),
      fullContent: "", lastRenderedHtml: "", thinkingContent: "", thinkingHtml: "",
      abortCtrl: null, status: "streaming" };
    sessions.push(s);
    return s;
  }

  function renderTabStrip() {
    if (sessions.length < 2) { tabsStripEl.hidden = true; bodyEl.classList.remove("ai-summary-body--tabs"); return; }
    tabsStripEl.hidden = false;
    bodyEl.classList.add("ai-summary-body--tabs");
    tabsStripEl.innerHTML = "";
    sessions.forEach((s, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ai-session-tab" + (i === activeIdx ? " is-active" : "");
      btn.title = s.groupName;
      btn.innerHTML = `<span class="ai-session-dot ai-session-dot--${s.status}"></span><span class="ai-session-label">${s.groupName}</span>`;
      btn.addEventListener("click", () => switchSession(i));
      tabsStripEl.appendChild(btn);
    });
  }

  function switchSession(idx) {
    activeIdx = idx;
    const s = sessions[idx];
    // Restore thinking area
    if (s.thinkingContent) {
      thinkingEl.hidden = false;
      thinkingBodyEl.innerHTML = s.thinkingHtml || "";
      thinkingEl.open = !s.fullContent; // 正文已出现后默认收起
    } else {
      thinkingEl.hidden = true;
      thinkingBodyEl.innerHTML = "";
    }
    // Restore result area
    if (s.fullContent) {
      resultEl.hidden = false;
      resultEl.setAttribute("data-md", "");
      if (s.status === "streaming") {
        resultEl.innerHTML = htmlWithStreamCursor(s.lastRenderedHtml);
      } else {
        resultEl.innerHTML = s.lastRenderedHtml;
      }
    } else {
      resultEl.hidden = true;
      resultEl.innerHTML = "";
    }
    // Restore button state
    if (s.status === "done") {
      setNotice("");
      cancelBtn.hidden = true;
      retryBtn.hidden = false;
      switchModelBtn.hidden = false;
      exportBtn.hidden = false;
      copyBtn.hidden = false;
      settingsBtn.hidden = true;
    } else if (s.status === "error") {
      cancelBtn.hidden = true;
      retryBtn.hidden = false;
      switchModelBtn.hidden = true;
      exportBtn.hidden = true;
      copyBtn.hidden = true;
    } else {
      // streaming — show cancel
      cancelBtn.textContent = "取消";
      cancelBtn.disabled = false;
      cancelBtn.hidden = false;
      retryBtn.hidden = true;
      switchModelBtn.hidden = true;
      exportBtn.hidden = true;
      copyBtn.hidden = true;
    }
    renderTabStrip();
    resultEl.scrollTop = 0;
  }

  // ─── Notice / modal helpers ─────────────────────────────────────────────────
  function setNotice(text, isError = false) {
    const show = Boolean(text);
    noticeEl.hidden = !show;
    if (noticeTextEl) noticeTextEl.textContent = text;
    else noticeEl.textContent = text;
    noticeEl.classList.toggle("ai-summary-notice--error", isError);
    if (!isError) settingsBtn.hidden = true;
  }

  function showNoKeyCompact(message) {
    modal.classList.add("ai-summary-modal--no-key");
    noticeEl.hidden = false;
    noticeTextEl.textContent = message;
    noticeEl.classList.remove("ai-summary-notice--error");
    settingsBtn.hidden = false;
    bodyEl.hidden = true;
    actionsEl.hidden = true;
    cancelBtn.hidden = true;
  }

  function closeModal() {
    sessions.forEach((s) => s.abortCtrl?.abort());
    document.querySelectorAll(".ai-dd-menu").forEach((m) => m.remove());
    modalTilt.disable();
    modal.remove();
  }

  function showDoneButtons() {
    noticeEl.hidden = true;
    cancelBtn.hidden = true;
    retryBtn.hidden = false;
    switchModelBtn.hidden = false;
    exportBtn.hidden = false;
    copyBtn.hidden = false;
    settingsBtn.hidden = true;
  }

  // ─── Event listeners ────────────────────────────────────────────────────────
  modal.querySelector(".export-close-btn").addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", () => {
    const s = sessions[activeIdx];
    if (s?.abortCtrl) { s.abortCtrl.abort(); s.abortCtrl = null; }
    closeModal();
  });
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  settingsBtn.addEventListener("click", () => {
    try {
      chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE", section: "aiSummary" });
    } catch (_) {
      window.open(chrome.runtime.getURL("settings/settings.html?section=aiSummary"), "_blank", "noopener,noreferrer");
    }
  });

  retryBtn.addEventListener("click", async () => {
    const settings = await loadAiSummarySettings();
    const groups = getPromptGroups(settings);

    function runWithGroup(groupId, groupName) {
      const s = addSession(groupId, groupName);
      activeIdx = sessions.length - 1;
      resultEl.innerHTML = "";
      resultEl.hidden = true;
      retryBtn.hidden = true;
      switchModelBtn.hidden = true;
      exportBtn.hidden = true;
      copyBtn.hidden = true;
      renderTabStrip();
      startSummary(s, settings);
    }

    if (groups.length <= 1) { runWithGroup(groups[0]?.id || null, groups[0]?.name); return; }
    showDropdown(retryBtn, groups.map((g) => ({ label: g.name, action: () => runWithGroup(g.id, g.name) })));
  });

  copyBtn.addEventListener("click", () => {
    const s = sessions[activeIdx];
    if (!s) return;
    showDropdown(copyBtn, [
      { label: "复制为 Markdown", action: async () => {
        try { await navigator.clipboard.writeText(s.fullContent); copyBtn.textContent = "已复制 ✓"; setTimeout(() => { copyBtn.textContent = "复制"; }, 1800); }
        catch (_) { copyBtn.textContent = "复制失败"; }
      }},
      { label: "复制为纯文本", action: async () => {
        try { await navigator.clipboard.writeText(stripMarkdown(s.fullContent)); copyBtn.textContent = "已复制 ✓"; setTimeout(() => { copyBtn.textContent = "复制"; }, 1800); }
        catch (_) { copyBtn.textContent = "复制失败"; }
      }},
    ]);
  });

  switchModelBtn.addEventListener("click", async () => {
    const settings = await loadAiSummarySettings();
    const providers = getProvidersWithApiKeys(settings);
    if (providers.length === 0) {
      setNotice(t("iframe_aiSummarySwitchModelNoKey", "请先在设置中为至少一个模型填写 API Key。"), true);
      return;
    }
    const currentGroupId = sessions[activeIdx]?.groupId ?? null;
    showDropdown(switchModelBtn, providers.map((p) => {
      const modelValue = String(settings.models?.[p.id] || "");
      const modelDef = p.models?.find((m) => m.value === modelValue);
      const modelLabel = modelDef?.label || modelValue;
      const label = modelLabel ? `${p.label} · ${modelLabel}` : p.label;
      return {
        label,
        action: () => {
          const overriddenSettings = { ...settings, provider: p.id };
          const s = addSession(currentGroupId, p.label);
          activeIdx = sessions.length - 1;
          resultEl.innerHTML = "";
          resultEl.hidden = true;
          retryBtn.hidden = true;
          switchModelBtn.hidden = true;
          exportBtn.hidden = true;
          copyBtn.hidden = true;
          renderTabStrip();
          startSummary(s, overriddenSettings);
        },
      };
    }));
  });

  exportBtn.addEventListener("click", () => {
    const s = sessions[activeIdx];
    if (!s) return;
    const query = state.lastSearchQuery || "";
    showDropdown(exportBtn, [
      { label: "导出为 Markdown", action: () => downloadText(s.fullContent, getSummaryFilename(query, "md"), "text/markdown") },
      { label: "导出为纯文本",    action: () => downloadText(stripMarkdown(s.fullContent), getSummaryFilename(query, "txt"), "text/plain") },
      { label: "导出为 PDF（打印另存）", action: () => exportAsPdf(s.lastRenderedHtml) },
    ]);
  });

  // ─── Prompt selector (unused inline, kept for compatibility) ────────────────
  function initPromptSelector(settings) {
    const groups = getPromptGroups(settings);
    modal.querySelector(".ai-summary-prompt-selector").hidden = true;
    const s = sessions[activeIdx];
    if (s && (!s.groupId || !groups.find((g) => g.id === s.groupId))) {
      s.groupId = groups[0]?.id || null;
    }
  }

  // ─── Core streaming function ────────────────────────────────────────────────
  async function startSummary(session, cachedSettings) {
    const settings = cachedSettings || await loadAiSummarySettings();
    initPromptSelector(settings);
    const provider = getActiveAiSummaryProvider(settings);
    if (!getActiveAiSummaryApiKey(settings)) {
      showNoKeyCompact(t("iframe_aiSummaryNoKey", "请先到设置「外观与显示」→「AI 总结」填写 API Key。"));
      return;
    }
    if (summaryRefs.length === 0) {
      setNotice("当前页面没有 AI 模型卡片，无法生成总结。", true);
      return;
    }

    cancelBtn.textContent = "取消";
    cancelBtn.disabled = false;
    cancelBtn.hidden = false;
    retryBtn.hidden = true;
    switchModelBtn.hidden = true;
    exportBtn.hidden = true;
    copyBtn.hidden = true;
    settingsBtn.hidden = true;
    setNotice(`正在读取 ${summaryRefs.length} 个卡片内容...`);

    let responses;
    try {
      responses = await collectVisibleResponses(new Set(summaryRefs.map((r) => r.site.id)));
    } catch (err) {
      if (activeIdx === session.id) { setNotice(`读取卡片失败：${err.message}`, true); cancelBtn.textContent = "关闭"; retryBtn.hidden = false; }
      session.status = "error";
      renderTabStrip();
      return;
    }

    const inputText = buildSummaryInput(responses, state.lastSearchQuery || "");
    if (!inputText) {
      if (activeIdx === session.id) { setNotice(t("iframe_aiSummaryEmpty", "当前卡片还没有可总结的内容，请等待各卡片加载完毕后重试。"), true); cancelBtn.textContent = "关闭"; retryBtn.hidden = false; }
      session.status = "error";
      renderTabStrip();
      return;
    }

    if (activeIdx === session.id) setNotice(buildSummaryCallingNotice(provider, responses));
    resultEl.hidden = true;
    resultEl.setAttribute("data-md", "");
    resultEl.innerHTML = "";

    session.abortCtrl = new AbortController();
    const activePrompt = getPromptText(settings, session.groupId);
    const callSettings = activePrompt !== settings.prompt ? { ...settings, prompt: activePrompt } : settings;

    function paintStreaming() {
      if (activeIdx !== session.id) return;
      const atBottom = resultEl.scrollHeight - resultEl.scrollTop - resultEl.clientHeight < 60;
      session.lastRenderedHtml = renderMarkdown(session.fullContent);
      resultEl.innerHTML = htmlWithStreamCursor(session.lastRenderedHtml);
      if (atBottom) resultEl.scrollTop = resultEl.scrollHeight;
    }

    try {
      for await (const chunk of streamAiSummary(callSettings, inputText, session.abortCtrl.signal)) {
        if (chunk?.thinking) {
          session.thinkingContent += chunk.thinking;
          if (activeIdx === session.id) {
            session.thinkingHtml = renderMarkdown(session.thinkingContent);
            if (thinkingEl.hidden) { thinkingEl.hidden = false; thinkingEl.open = true; }
            thinkingBodyEl.innerHTML = session.thinkingHtml;
          }
        } else if (typeof chunk === "string") {
          session.fullContent += chunk;
          if (activeIdx === session.id) {
            // 正文开始输出 → 自动收起思考过程
            if (session.thinkingContent && thinkingEl.open) thinkingEl.open = false;
            if (resultEl.hidden) { resultEl.hidden = false; setNotice(""); }
            paintStreaming();
          }
        } else if (chunk?.truncated) {
          session.fullContent += `\n\n⚠️ ${t("iframe_aiSummaryTruncated", "注意：结果可能因 token 限制被截断。")}`;
        }
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      if (activeIdx === session.id) { setNotice(`总结失败：${err.message}`, true); cancelBtn.textContent = "关闭"; retryBtn.hidden = false; }
      session.status = "error";
      session.abortCtrl = null;
      renderTabStrip();
      return;
    }

    // Final render
    session.lastRenderedHtml = renderMarkdown(session.fullContent);
    if (session.thinkingContent) session.thinkingHtml = renderMarkdown(session.thinkingContent);
    session.status = "done";
    session.abortCtrl = null;
    renderTabStrip();

    if (activeIdx === session.id) {
      resultEl.innerHTML = session.lastRenderedHtml;
      resultEl.scrollTop = 0;
      showDoneButtons();
    }
  }

  // ─── Initial session ────────────────────────────────────────────────────────
  const firstSession = addSession(null, t("iframe_aiSummaryDefaultPrompt", "默认"));
  activeIdx = 0;
  startSummary(firstSession);
}
