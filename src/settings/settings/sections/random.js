import { RANDOM_QUESTIONS_STORAGE_KEY, RANDOM_QUESTIONS_FILES } from "../../../shared/storage-keys.js";
import { state, msg } from "../state.js";
import { escapeHtml } from "../utils.js";
import { createOtherSettingToggle } from "./other.js";

export async function loadDefaultRandomQuestionsText(preferredLang = "") {
  const lang = String(preferredLang || (() => {
    try {
      const chromeLang = (chrome?.i18n?.getUILanguage?.() || "").toLowerCase();
      if (chromeLang) return chromeLang;
      const navLang = (navigator?.language || "").toLowerCase();
      return navLang || "";
    } catch (_e) {
      return (navigator.language || "").toLowerCase();
    }
  })()).toLowerCase();
  const path = lang.startsWith("zh") ? RANDOM_QUESTIONS_FILES.zh : RANDOM_QUESTIONS_FILES.en;
  try {
    const res = await fetch(chrome.runtime.getURL(path));
    return res.ok ? await res.text() : "";
  } catch (_e) {
    return "";
  }
}

function countRandomQuestions(text) {
  if (typeof text !== "string") return 0;
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .length;
}

async function persistRandomQuestionsText() {
  await chrome.storage.local.set({ [RANDOM_QUESTIONS_STORAGE_KEY]: state.randomQuestionsText });
}

// 把原始文本（无序号）转换为带序号的显示文本（"1. Q\n2. Q\n…"）
function rawToNumbered(raw) {
  if (!raw) return "";
  let idx = 0;
  return raw.split(/\r?\n/).map((line) => {
    if (!line.trim()) return "";
    idx++;
    return idx + ". " + line;
  }).join("\n");
}

// 把显示文本（可能带序号前缀）还原为原始文本
function numberedToRaw(numbered) {
  return numbered.split(/\r?\n/).map((line) => {
    return line.replace(/^\d+\.\s+/, "");
  }).join("\n");
}

export function renderRandomSection() {
  const { randomSection } = state.dom;
  randomSection.innerHTML = "";

  const isZh = window.__QSHOT_I18N__?.isZhUi?.() ?? true;

  // —— 顶部：介绍文字（左）+ 显示骰子按钮开关（右）一体式卡片 ——
  const initialRawForSwitch = typeof state.randomQuestionsText === "string" ? state.randomQuestionsText : state.defaultRandomQuestionsText;

  const headerCard = document.createElement("section");
  headerCard.className = "other-settings-card random-header-card";

  const introDiv = document.createElement("div");
  introDiv.className = "random-intro-text";

  const p1 = document.createElement("p");
  p1.className = "random-hint-para";
  p1.textContent = msg(
    "settings_random_introP1",
    "大部分人不是不想用 AI，而是不知道问什么，而只需随手一点骰子，一个好问题出来了。"
  );

  const p2 = document.createElement("p");
  p2.className = "random-hint-para";
  p2.textContent = msg(
    "settings_random_introP2",
    "题库可以自己设置的，毕竟最好的题库是关于你自己的，可以根据你的职业、兴趣或想探索的方向来构建自己的随机问题库，让每一次随机都有价值。"
  );

  introDiv.appendChild(p1);
  introDiv.appendChild(p2);

  const switchWrap = document.createElement("div");
  switchWrap.className = "random-switch-wrap";
  switchWrap.appendChild(
    createOtherSettingToggle(
      "showRandomButton",
      msg("settings_random_showSwitchTitle", "显示随机骰子按钮")
    )
  );

  headerCard.appendChild(introDiv);
  headerCard.appendChild(switchWrap);
  randomSection.appendChild(headerCard);

  // —— 下方：问题库编辑区 ——
  const poolCard = document.createElement("section");
  poolCard.className = "other-settings-card random-pool-card";
  poolCard.innerHTML = `
    <div class="other-settings-intro">
      <strong>${escapeHtml(msg("settings_random_poolTitle", "问题库"))}</strong>
    </div>
    <textarea class="random-pool-textarea" spellcheck="false" placeholder="${escapeHtml(msg("settings_random_poolPlaceholder", "每行一个问题…"))}"></textarea>
    <div class="random-pool-footer">
      <span class="random-pool-count"></span>
      <span class="random-pool-status" aria-live="polite"></span>
    </div>
  `;

  const textarea = poolCard.querySelector(".random-pool-textarea");
  const countEl = poolCard.querySelector(".random-pool-count");
  const statusEl = poolCard.querySelector(".random-pool-status");

  const updateCount = (raw) => {
    const n = countRandomQuestions(raw);
    countEl.textContent = msg("settings_random_countPrefix", "当前共 ") + n + msg("settings_random_countSuffix", " 个问题。");
  };

  const reformat = () => {
    const raw = numberedToRaw(textarea.value);
    textarea.value = rawToNumbered(raw);
    updateCount(raw);
    return raw;
  };

  // 初始显示：把存储的原始文本转成带序号的格式
  textarea.value = rawToNumbered(initialRawForSwitch);
  updateCount(initialRawForSwitch);

  let saveTimer = null;
  let statusTimer = null;

  const showSaved = () => {
    statusEl.textContent = msg("settings_random_saved", "已保存");
    statusEl.classList.add("is-visible");
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => statusEl.classList.remove("is-visible"), 1200);
  };

  const scheduleSave = (raw) => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      state.randomQuestionsText = raw;
      await persistRandomQuestionsText();
      showSaved();
    }, 400);
  };

  // Enter 键：拦截默认换行，直接插入 "N. " 开头的新行，序号即时可见
  textarea.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const startPos = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    // 找光标前最后一个带序号行，下一行序号 = 该序号 + 1
    const linesBeforeCursor = value.substring(0, startPos).split("\n");
    let lastNum = 0;
    for (const line of linesBeforeCursor) {
      const m = line.match(/^(\d+)\.\s/);
      if (m) lastNum = parseInt(m[1], 10);
    }
    // 光标所在行本身如果是带序号行，也算进去
    const curLine = linesBeforeCursor[linesBeforeCursor.length - 1] || "";
    const curMatch = curLine.match(/^(\d+)\.\s/);
    if (curMatch) lastNum = Math.max(lastNum, parseInt(curMatch[1], 10));

    const nextNum = lastNum + 1;
    const insertion = "\n" + nextNum + ". ";
    const newValue = value.substring(0, startPos) + insertion + value.substring(end);
    textarea.value = newValue;

    const newPos = startPos + insertion.length;
    textarea.setSelectionRange(newPos, newPos);

    const raw = numberedToRaw(newValue);
    updateCount(raw);
    scheduleSave(raw);
  });

  // 普通输入时只更新计数和排程保存（不重新编号，避免光标跳动）
  textarea.addEventListener("input", () => {
    const raw = numberedToRaw(textarea.value);
    updateCount(raw);
    scheduleSave(raw);
  });

  // 失焦时重新编号，并立即保存（防止快速离开页面时丢失）
  textarea.addEventListener("blur", async () => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    const raw = reformat();
    state.randomQuestionsText = raw;
    await persistRandomQuestionsText();
  });

  // 粘贴后立即重新编号
  textarea.addEventListener("paste", () => {
    requestAnimationFrame(() => {
      const raw = reformat();
      scheduleSave(raw);
    });
  });

  randomSection.appendChild(poolCard);

  // —— 底部：使用说明 + AI 协同制定题库提示词 ——
  const COPYPROMPT = isZh
    ? `我想定制一套专属 AI 提问题库，用于每天随机抽取问题，并直接发送给 AI 进行分析、搜索、拆解或生成建议。

我的身份 / 职业：[填写你的职业、行业或角色]
我关注的方向：[填写你最近关心的领域或兴趣]
我当前想解决的问题：[填写你的目标、困惑或正在做的事]

请根据以上信息，生成 30 个高质量问题。

要求：
每个问题都要适合直接发送给 AI 使用
问题要采用清晰、客观、可分析的表达方式
问题要能引导 AI 输出分析、方法、案例、步骤、对比或建议
问题要贴近我的身份、关注方向和当前问题
问题不要太宽泛，要有具体场景或明确切入点，覆盖行业洞察、实操方法、机会发现、风险判断、复盘优化等方向
不要输出分类、编号、解释、标题或多余内容
每个问题单独占一行`
    : `I want to build a custom AI question bank — a personal collection of prompts for daily use, sent directly to AI for analysis, research, breakdown, or generating recommendations.

My role / profession: [your job title, industry, or role]
My focus area: [what you're currently interested in or exploring]
My current challenge: [your goal, question, or ongoing project]

Based on the above, generate 30 high-quality questions.

Requirements:
Every question should be suitable for sending directly to an AI
Questions should be clear, specific, and analytically framed
Questions should prompt the AI to produce analysis, methods, examples, steps, comparisons, or recommendations
Questions should be relevant to my role, focus area, and current challenge
Avoid vague questions — each should have a concrete angle or scenario, covering areas such as industry insights, practical approaches, opportunity discovery, risk assessment, and retrospective improvement
Do not include categories, numbers, explanations, headings, or any extra content
One question per line`;

  const hintCard = document.createElement("section");
  hintCard.className = "other-settings-card random-hint-card";
  const hint3Text = msg(
    "settings_random_aiHelpHint",
    "你也可以让 AI 帮你一起完成，协同制定一套属于自己的专属题库。参考下方提示词直接发给任意 AI："
  );
  const copyLabel = msg("common_copy", "复制");
  const copyAriaLabel = msg("settings_random_copyPromptAria", "复制提示词");

  hintCard.innerHTML = `
    <p class="random-hint-para">${hint3Text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
    <div class="random-prompt-block">
      <button class="random-prompt-copy-btn" type="button" aria-label="${copyAriaLabel}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        <span class="random-prompt-copy-label">${copyLabel}</span>
      </button>
      <pre class="random-prompt-text"></pre>
    </div>
  `;

  const promptPre = hintCard.querySelector(".random-prompt-text");
  promptPre.textContent = COPYPROMPT;

  const copyBtn = hintCard.querySelector(".random-prompt-copy-btn");
  const copyLabelEl = hintCard.querySelector(".random-prompt-copy-label");
  let copyResetTimer = null;
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(COPYPROMPT);
    } catch (_e) {
      const ta = document.createElement("textarea");
      ta.value = COPYPROMPT;
      ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    copyLabelEl.textContent = msg("common_copied", "已复制");
    copyBtn.classList.add("is-copied");
    if (copyResetTimer) clearTimeout(copyResetTimer);
    copyResetTimer = setTimeout(() => {
      copyLabelEl.textContent = copyLabel;
      copyBtn.classList.remove("is-copied");
    }, 1800);
  });

  randomSection.appendChild(hintCard);
}
