import { state, elements } from "./state.js";

function t(key, fallback) {
  return window.__QSHOT_I18N__?.t?.(key) || fallback || "";
}

function getLocalDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

function getYesterdayDateKey() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;
}

function matchesHistoryDateFilter(entry, filter = state.historyDateFilter) {
  if (filter === "all") {
    return true;
  }

  const entryDateKey = getLocalDateKey(entry?.createdAt);
  if (!entryDateKey) {
    return false;
  }

  if (filter === "today") {
    return entryDateKey === getTodayDateKey();
  }
  if (filter === "yesterday") {
    return entryDateKey === getYesterdayDateKey();
  }
  return true;
}

export function getFilteredHistory() {
  return state.searchHistory.filter((entry) => matchesHistoryDateFilter(entry));
}

export function getHistoryEmptyMessage() {
  if (state.searchHistory.length === 0) {
    return t("iframe_historyEmpty", "暂无搜索记录");
  }
  if (state.historyDateFilter === "today") {
    return t("iframe_historyEmptyToday", "今天暂无搜索记录");
  }
  if (state.historyDateFilter === "yesterday") {
    return t("iframe_historyEmptyYesterday", "昨天暂无搜索记录");
  }
  return t("iframe_historyEmpty", "暂无搜索记录");
}

let refreshHistoryList = null;

export function attachHistoryFilterRefresh(refresh) {
  refreshHistoryList = refresh;
}

export function setHistoryDateFilter(filter) {
  if (!["all", "today", "yesterday"].includes(filter) || filter === state.historyDateFilter) {
    return;
  }
  state.historyDateFilter = filter;
  refreshHistoryList?.();
}

export function updateHistoryFilterUi() {
  elements.historyFilterBtns?.forEach((btn) => {
    const active = btn.dataset.historyFilter === state.historyDateFilter;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
}

export function bindHistoryFilterEvents() {
  elements.historyFilterBtns?.forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      setHistoryDateFilter(btn.dataset.historyFilter || "all");
    });
  });
}
