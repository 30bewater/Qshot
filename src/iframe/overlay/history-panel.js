import { state, t, formatHistoryDate } from "./state.js";
import { SEARCH_HISTORY_STORAGE_KEY } from "../../shared/storage-keys.js";

export function renderHistoryIfOpen() {
  if (!state.shadowRoot) return;
  const historyList = state.shadowRoot.querySelector(".history-list");
  if (!(historyList instanceof HTMLElement)) return;

  historyList.innerHTML = "";

  if (!state.historyEntries.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = t("overlay_emptyHistory", null, "暂无搜索记录");
    historyList.appendChild(empty);
    return;
  }

  state.historyEntries.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const line = document.createElement("div");
    line.className = "history-line";

    const query = document.createElement("div");
    query.className = "history-query";
    query.textContent = String(entry?.query || "").replace(/\s+/g, " ").trim();
    query.addEventListener("click", () => {
      const queryInput = state.shadowRoot?.querySelector(".query-input");
      if (queryInput instanceof HTMLTextAreaElement) {
        queryInput.value = entry?.query || "";
        queryInput.dispatchEvent(new Event("input", { bubbles: true }));
        queryInput.focus();
      }
    });

    const metaSlot = document.createElement("div");
    metaSlot.className = "history-meta-slot";

    const meta = document.createElement("div");
    meta.className = "history-meta";
    meta.textContent = formatHistoryDate(entry?.createdAt);

    const actionButtons = document.createElement("div");
    actionButtons.className = "history-action-buttons";

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "history-restore-btn";
    restoreBtn.textContent = t("overlay_historyRestore", null, "复原");
    restoreBtn.setAttribute("aria-label", t("overlay_restoreHistoryEntry", null, "新开页面复原这次搜索会话"));
    restoreBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openOverlayHistoryRestorePage(entry?.id);
    });
    actionButtons.appendChild(restoreBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "history-delete-btn";
    deleteBtn.textContent = t("overlay_historyDelete", null, "删除");
    deleteBtn.setAttribute("aria-label", t("overlay_deleteHistoryEntry", null, "删除这条记录"));
    deleteBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await removeHistoryEntry(entry);
    });
    actionButtons.appendChild(deleteBtn);

    metaSlot.appendChild(meta);
    metaSlot.appendChild(actionButtons);
    line.appendChild(query);
    line.appendChild(metaSlot);
    item.appendChild(line);
    historyList.appendChild(item);
  });
}

function openOverlayHistoryRestorePage(entryId) {
  if (!entryId) return;
  const url = new URL(chrome.runtime.getURL("iframe/iframe.html"));
  url.searchParams.set("restoreHistoryId", entryId);
  chrome.tabs.create({ url: url.toString() }).catch(() => {});
  state.closeOverlay?.();
}

async function removeHistoryEntry(entry) {
  try {
    const stored = await chrome.storage.local.get([SEARCH_HISTORY_STORAGE_KEY]);
    const fullHistory = Array.isArray(stored[SEARCH_HISTORY_STORAGE_KEY])
      ? stored[SEARCH_HISTORY_STORAGE_KEY]
      : [];
    if (!fullHistory.length) return;

    let removed = false;
    const nextHistory = fullHistory.filter((item) => {
      if (removed) return true;
      if (entry?.id && item?.id === entry.id) {
        removed = true;
        return false;
      }
      if (!entry?.id && item?.query === entry?.query && item?.createdAt === entry?.createdAt) {
        removed = true;
        return false;
      }
      return true;
    });

    if (!removed) return;
    await chrome.storage.local.set({ [SEARCH_HISTORY_STORAGE_KEY]: nextHistory });
  } catch (_err) {
    /* ignored */
  }
}
