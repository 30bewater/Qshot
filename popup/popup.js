(function initPopup() {
  const SEARCH_GROUPS_STORAGE_KEY = "searchGroups";
  const SEARCH_HISTORY_STORAGE_KEY = "searchHistory";
  const PROMPT_GROUPS_STORAGE_KEY = "promptGroups";
  const UI_PREFS_STORAGE_KEY = "uiPrefs";
  const RANDOM_QUESTIONS = [
    "第一性原理是什么？给我举 3 个生活中的例子",
    "如何用 AI 快速学习一个陌生领域？",
    "什么样的问题 AI 回答得最好？什么最差？",
    "为什么痛苦比快乐更容易被记住？",
    "用一个比喻解释“复利思维”",
    "推荐 3 个科学验证过的提升注意力的方法",
    "解释一下“奥卡姆剃刀原则”，并告诉我什么时候不适用",
    "为什么有些道理听懂了，却做不到？",
    "把“内耗”拆成情绪、认知、行为三个层面来讲",
    "如果我要在 30 天内入门一个陌生领域，你会怎么帮我设计学习路径？",
    "如果我总是学了就忘，AI 可以怎么帮我建立复习系统？",
    "现代人最常见的 3 种“伪成长”是什么",
    "什么样的问题最能激发 AI 给出高质量回答？",
    "怎么让 AI 在学习、写作、思考中扮演不同角色？",
    "一个好 prompt 的核心结构通常是什么？",
    "如果让苏格拉底来分析“刷短视频停不下来”，他会怎么提问？",
    "告诉我：关于这件事，未来我最可能后悔没早点知道什么？",
    "给我 10 个稀奇但有用的问题，专门用来打破思维惯性。",
    "帮我挖掘出我的优点和缺点",
    "你觉得我现在最该认真解决的一个问题，可能是什么？",
    "给我一个今天值得想一想的问题。",
    "帮我找出我现在最可能忽略的一件事。",
    "如果你只能提醒我一件会影响未来半年的事，你会提醒什么？",
    "我现在最值得做的那个 80/20 动作是什么？",
    "站在一年后的我看，现在最不该拖延的是什么？",
    "给我一个能快速提升生活质量的小改变。",
    "把我最近可能很混乱的事情，整理成 3 种可能方向。",
    "告诉我一个我以为很重要、其实没那么重要的东西。",
    "给我一个反直觉但值得试试的建议。",
    "用最直白的话告诉我：我现在最需要看清什么？",
    "这件事背后真正的问题通常是什么？先给我 3 种常见答案。",
    "我该停止什么，才能让自己轻松一点？",
    "现在最值得我补上的一个能力是什么？为什么？",
    "当时时代互联网常见的情绪煽动点有哪些",
    "教我怎样向 AI 提问，才能把这个主题学得更快更扎实。",
    "如何把新时代的 AI 知识点和我已经会的东西建立连接，让我更容易记住。",
    "告诉我这个主题最常见的 3 个混淆点，并教我怎么区分。",
    "什么问题其实不应该直接问 AI，而应该先自己想一遍？",
    "如何把 AI 用成一个真正会启发思考的学习伙伴？",
    "让 AI 帮我学习时，怎样提要求才能避免它讲得空泛？",
    "请用二八定律帮我分析：在工作、学习和副业这三个方面，最值得优先投入的 20% 动作，可能分别是什么？",
    "请用投射效应分析：为什么人会把自己的情绪和想法，不自觉地套到别人身上？",
    "请用边界感这个概念解释：为什么有些人总活得很累，是因为太容易被别人影响？",
    "请用峰终定律分析：为什么一段经历最后给人的印象，常常不是平均感受，而是高峰和结尾？",
    "请用稀缺心态解释：为什么当人觉得时间不够、钱不够、机会不够时，反而更容易做错决定？",
    "请用比较心理分析：为什么人一旦总盯着别人看，幸福感会明显下降？",
    "请用社会认同解释：为什么很多人明明没有那么喜欢一个东西，却还是会跟着大家一起追？"
  ];

  const queryInput = document.getElementById("popupQueryInput");
  const composer = document.querySelector(".search-composer");
  const groupsContainer = document.getElementById("popupGroups");
  const historyList = document.getElementById("popupHistoryList");
  const historySection = document.querySelector(".popup-history-section");
  const openSettingsBtn = document.getElementById("openSettingsBtn");
  const randomPromptBtn = document.getElementById("randomPromptBtn");
  const promptEntryBtn = document.getElementById("promptEntryBtn");
  const composerActionsRow = document.querySelector(".composer-actions-row");
  const promptPicker = document.getElementById("promptPicker");

  let groups = [];
  let promptGroups = [];
  let uiPrefs = createNormalizedUiPrefs();
  let activePromptGroupId = null;
  let isPromptPickerOpen = false;
  let composerResizeObserver = null;

  document.addEventListener("DOMContentLoaded", start);
  chrome.storage.onChanged.addListener(handleStorageChange);

  async function start() {
    await Promise.all([refreshGroups(), refreshPromptGroups(), refreshUiPrefs(), refreshHistory()]);
    bindPromptPickerEvents();
    bindComposerLayoutEvents();
    syncComposerLayout();
    queryInput.focus();
  }

  openSettingsBtn.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE" });
    window.close();
  });

  randomPromptBtn?.addEventListener("click", () => {
    closePromptPicker();
    fillRandomQuestion();
  });

  promptEntryBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePromptPicker();
  });

  queryInput.addEventListener("input", () => {
    closePromptPicker();
    syncComposerLayout();
  });

  queryInput.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    await runDefaultSearch();
  });

  async function handleStorageChange(changes, areaName) {
    if (areaName !== "local") {
      return;
    }

    if (changes[SEARCH_GROUPS_STORAGE_KEY]) {
      await refreshGroups();
    }

    if (changes[PROMPT_GROUPS_STORAGE_KEY]) {
      await refreshPromptGroups();
    }

    if (changes[UI_PREFS_STORAGE_KEY]) {
      await refreshUiPrefs();
    }

    if (changes[SEARCH_HISTORY_STORAGE_KEY]) {
      await refreshHistory();
    }
  }

  async function refreshGroups() {
    groups = await loadGroups();
    renderGroups(groups);
  }

  async function refreshPromptGroups() {
    promptGroups = await loadPromptGroups();
    if (!promptGroups.some((group) => group.id === activePromptGroupId)) {
      activePromptGroupId = promptGroups[0]?.id || null;
    }
    renderPromptPicker();
  }

  async function refreshUiPrefs() {
    uiPrefs = await loadUiPrefs();
    applyUiPrefs();
  }

  async function refreshHistory() {
    const history = await loadHistory();
    renderHistory(history);
  }

  function renderGroups(groupList) {
    groupsContainer.innerHTML = "";
    groupsContainer.hidden = groupList.length === 0;

    groupList.forEach((group) => {
      const button = document.createElement("button");
      button.className = "popup-group-btn";
      button.type = "button";
      button.innerHTML = `<span class="popup-group-name">${escapeHtml(group.name)}</span>`;
      button.addEventListener("click", async () => {
        await runGroup(group);
      });
      groupsContainer.appendChild(button);
    });
  }

  function renderPromptPicker() {
    if (!promptPicker || !promptEntryBtn || uiPrefs.showPromptButton === false) {
      if (promptPicker) {
        promptPicker.hidden = true;
      }
      return;
    }

    promptPicker.innerHTML = "";
    promptEntryBtn.setAttribute("aria-expanded", String(isPromptPickerOpen));

    if (!isPromptPickerOpen) {
      promptPicker.hidden = true;
      return;
    }

    promptPicker.hidden = false;

    if (!promptGroups.length) {
      const empty = document.createElement("div");
      empty.className = "popup-prompt-picker-empty";
      empty.textContent = "还没有提示词分组，请先去设置里添加。";
      promptPicker.appendChild(empty);
      return;
    }

    const activeGroup = promptGroups.find((group) => group.id === activePromptGroupId) || promptGroups[0];
    if (!activeGroup) {
      return;
    }

    const groupsColumn = document.createElement("div");
    groupsColumn.className = "popup-prompt-groups";

    promptGroups.forEach((group) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `popup-prompt-group-item${group.id === activeGroup.id ? " is-active" : ""}`;
      button.textContent = group.name || "未命名分组";
      button.addEventListener("mouseenter", () => {
        if (activePromptGroupId === group.id) {
          return;
        }
        activePromptGroupId = group.id;
        renderPromptPicker();
      });
      button.addEventListener("click", () => {
        activePromptGroupId = group.id;
        renderPromptPicker();
      });
      groupsColumn.appendChild(button);
    });

    const promptsColumn = document.createElement("div");
    promptsColumn.className = "popup-prompt-list";

    if (!activeGroup.prompts.length) {
      const empty = document.createElement("div");
      empty.className = "popup-prompt-picker-empty";
      empty.textContent = "这个分组里还没有提示词。";
      promptsColumn.appendChild(empty);
    } else {
      activeGroup.prompts.forEach((prompt) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "popup-prompt-item";
        button.textContent = prompt.title || "未命名提示词";
        button.addEventListener("click", () => {
          queryInput.value = prompt.content || "";
          closePromptPicker();
          queryInput.focus();
        });
        promptsColumn.appendChild(button);
      });
    }

    promptPicker.appendChild(groupsColumn);
    promptPicker.appendChild(promptsColumn);
  }

  function bindPromptPickerEvents() {
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !isPromptPickerOpen) {
        return;
      }
      if (target.closest("#promptEntryBtn") || target.closest("#promptPicker")) {
        return;
      }
      closePromptPicker();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isPromptPickerOpen) {
        closePromptPicker();
        queryInput.focus();
      }
    });
  }

  function bindComposerLayoutEvents() {
    queryInput.addEventListener("mouseup", syncComposerLayout);
    queryInput.addEventListener("keyup", syncComposerLayout);

    if (typeof ResizeObserver !== "undefined") {
      composerResizeObserver = new ResizeObserver(() => {
        syncComposerLayout();
      });
      composerResizeObserver.observe(queryInput);
    }
  }

  function syncComposerLayout() {
    if (!composer || !queryInput) {
      return;
    }

    const lineHeight = parseFloat(window.getComputedStyle(queryInput).lineHeight || "21.75");
    const hasValue = queryInput.value.trim().length > 0;
    const shouldExpand = queryInput.scrollHeight > lineHeight * 1.7 || queryInput.clientHeight > 44 || hasValue;
    composer.classList.toggle("is-expanded", shouldExpand);
  }

  function togglePromptPicker() {
    isPromptPickerOpen = !isPromptPickerOpen;
    renderPromptPicker();
  }

  function applyUiPrefs() {
    if (historySection) {
      historySection.hidden = uiPrefs.showHistory === false;
      historySection.classList.toggle("is-hidden", uiPrefs.showHistory === false);
      historySection.style.display = uiPrefs.showHistory === false ? "none" : "block";
    }

    if (randomPromptBtn) {
      randomPromptBtn.hidden = uiPrefs.showRandomButton === false;
      randomPromptBtn.style.display = uiPrefs.showRandomButton === false ? "none" : "inline-flex";
    }

    if (promptEntryBtn) {
      promptEntryBtn.hidden = uiPrefs.showPromptButton === false;
      promptEntryBtn.style.display = uiPrefs.showPromptButton === false ? "none" : "inline-flex";
      if (uiPrefs.showPromptButton === false) {
        closePromptPicker();
      }
    }

    if (composerActionsRow) {
      const hasVisibleActions = uiPrefs.showRandomButton !== false || uiPrefs.showPromptButton !== false;
      composerActionsRow.hidden = !hasVisibleActions;
      composerActionsRow.style.display = hasVisibleActions ? "flex" : "none";
    }
  }

  function closePromptPicker() {
    if (!isPromptPickerOpen) {
      return;
    }
    isPromptPickerOpen = false;
    renderPromptPicker();
  }

  function fillRandomQuestion() {
    if (!RANDOM_QUESTIONS.length) {
      return;
    }

    const randomIndex = Math.floor(Math.random() * RANDOM_QUESTIONS.length);
    queryInput.value = RANDOM_QUESTIONS[randomIndex];
    syncComposerLayout();
    queryInput.focus();
  }

  function renderHistory(history) {
    historyList.innerHTML = "";

    if (history.length === 0) {
      const empty = document.createElement("div");
      empty.className = "popup-history-empty";
      empty.textContent = "暂无搜索记录";
      historyList.appendChild(empty);
      return;
    }

    history.forEach((entry) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "popup-history-item";

      const query = String(entry.query || "").replace(/\s+/g, " ").trim();
      const dateText = formatHistoryDate(entry.createdAt);
      item.innerHTML = `
        <div class="popup-history-line">
          <div class="popup-history-query">${escapeHtml(query)}</div>
          <div class="popup-history-meta">${escapeHtml(dateText)}</div>
        </div>
      `;
      item.addEventListener("click", () => {
        queryInput.value = entry.query || "";
        queryInput.focus();
      });
      historyList.appendChild(item);
    });
  }

  async function runDefaultSearch() {
    if (!groups.length) {
      return;
    }

    await runGroup(groups[0]);
  }

  async function runGroup(group) {
    const query = queryInput.value.trim();
    await chrome.runtime.sendMessage({
      type: "RUN_SEARCH_GROUP",
      group,
      query
    });
    window.close();
  }

  async function loadGroups() {
    const stored = await chrome.storage.local.get([SEARCH_GROUPS_STORAGE_KEY]);
    return Array.isArray(stored[SEARCH_GROUPS_STORAGE_KEY]) ? stored[SEARCH_GROUPS_STORAGE_KEY] : [];
  }

  async function loadPromptGroups() {
    const stored = await chrome.storage.local.get([PROMPT_GROUPS_STORAGE_KEY]);
    const source = Array.isArray(stored[PROMPT_GROUPS_STORAGE_KEY]) ? stored[PROMPT_GROUPS_STORAGE_KEY] : [];
    return source.map((group, groupIndex) => ({
      id: String(group.id || `prompt-group-${groupIndex}`),
      name: String(group.name || "未命名分组"),
      prompts: Array.isArray(group.prompts)
        ? group.prompts.map((prompt, promptIndex) => ({
            id: String(prompt.id || `prompt-${groupIndex}-${promptIndex}`),
            title: String(prompt.title || "未命名提示词"),
            content: String(prompt.content || "")
          }))
        : []
    }));
  }

  async function loadHistory() {
    const stored = await chrome.storage.local.get([SEARCH_HISTORY_STORAGE_KEY]);
    return Array.isArray(stored[SEARCH_HISTORY_STORAGE_KEY]) ? stored[SEARCH_HISTORY_STORAGE_KEY].slice(0, 4) : [];
  }

  async function loadUiPrefs() {
    const stored = await chrome.storage.local.get([UI_PREFS_STORAGE_KEY]);
    return createNormalizedUiPrefs(stored[UI_PREFS_STORAGE_KEY]);
  }

  function createNormalizedUiPrefs(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      showHistory: source.showHistory !== false,
      showRandomButton: source.showRandomButton !== false,
      showPromptButton: source.showPromptButton !== false
    };
  }

  function formatHistoryDate(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
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
