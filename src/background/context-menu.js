import {
  SEARCH_GROUPS_STORAGE_KEY,
  QUICK_ACCESS_SITES_KEY,
  UI_PREFS_STORAGE_KEY,
  SELECTION_CONTEXT_GROUPS_STORAGE_KEY,
} from "../shared/storage-keys.js";
import { runSearchGroup, runSelectionContextGroup, openSiteTabAndSend } from "./tabs.js";
import { loadEnabledSites } from "./sites.js";

const ROOT_ID = "qshot-root";
const GROUP_PREFIX = "qshot-group-";
const CTX_GROUP_PREFIX = "qshot-ctx-";
const SITE_PREFIX = "qshot-site-";
let rebuildQueue = Promise.resolve();
let rebuildGeneration = 0;

chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

export async function rebuildContextMenus() {
  const generation = ++rebuildGeneration;
  rebuildQueue = rebuildQueue
    .catch(() => {})
    .then(() => rebuildContextMenusNow(generation));
  return rebuildQueue;
}

async function rebuildContextMenusNow(generation) {
  await chrome.contextMenus.removeAll();

  const prefsResult = await chrome.storage.local.get(UI_PREFS_STORAGE_KEY);
  const uiPrefs = prefsResult[UI_PREFS_STORAGE_KEY] || {};
  if (uiPrefs.contextMenuEnabled === false) return;

  const [groups, ctxGroups, quickSiteIds, allSites] = await Promise.all([
    loadSearchGroups(),
    loadSelectionContextGroups(),
    loadQuickAccessSiteIds(),
    loadEnabledSites().catch(() => []),
  ]);

  const enabledGroups = groups.filter((g) => g.enabled !== false);
  const enabledCtxGroups = ctxGroups.filter(isRunnableContextGroup);
  const quickSites = quickSiteIds
    .map((id) => allSites.find((s) => s.id === id))
    .filter(Boolean);

  if (generation !== rebuildGeneration) return;

  await createContextMenu({
    id: ROOT_ID,
    title: "Qshot \u641c\u7d22",
    contexts: ["selection"],
  });

  for (const group of enabledGroups) {
    if (generation !== rebuildGeneration) return;
    await createContextMenu({
      id: GROUP_PREFIX + group.id,
      parentId: ROOT_ID,
      title: group.name,
      contexts: ["selection"],
    });
  }

  if (quickSites.length > 0) {
    if (generation !== rebuildGeneration) return;
    await createContextMenu({
      id: "qshot-sites-sep",
      parentId: ROOT_ID,
      type: "separator",
      contexts: ["selection"],
    });

    for (const site of quickSites) {
      if (generation !== rebuildGeneration) return;
      await createContextMenu({
        id: SITE_PREFIX + site.id,
        parentId: ROOT_ID,
        title: site.name,
        contexts: ["selection"],
      });
    }
  }

  if (enabledCtxGroups.length > 0) {
    if (generation !== rebuildGeneration) return;
    await createContextMenu({
      id: "qshot-ctx-sep",
      parentId: ROOT_ID,
      type: "separator",
      contexts: ["selection"],
    });

    for (const ctxGroup of enabledCtxGroups) {
      if (generation !== rebuildGeneration) return;
      await createContextMenu({
        id: CTX_GROUP_PREFIX + ctxGroup.id,
        parentId: ROOT_ID,
        title: ctxGroup.name,
        contexts: ["selection"],
      });
    }
  }

  if (generation !== rebuildGeneration) return;
}

function isRunnableContextGroup(ctxGroup) {
  if (!ctxGroup || ctxGroup.enabled === false) return false;
  if (ctxGroup.targetType === "group") return !!ctxGroup.refGroupId;
  return Array.isArray(ctxGroup.siteIds) && ctxGroup.siteIds.length > 0;
}

async function handleContextMenuClick(info) {
  const menuId = String(info.menuItemId);

  const selection = (info.selectionText || "").trim();
  if (!selection) return;

  if (menuId.startsWith(CTX_GROUP_PREFIX)) {
    const ctxId = menuId.slice(CTX_GROUP_PREFIX.length);
    const [ctxGroups, searchGroups] = await Promise.all([
      loadSelectionContextGroups(),
      loadSearchGroups(),
    ]);
    const ctxGroup = ctxGroups.find((g) => g.id === ctxId);
    if (ctxGroup) {
      await runSelectionContextGroup(ctxGroup, selection, searchGroups).catch(() => {});
    }
    return;
  }

  if (menuId.startsWith(GROUP_PREFIX)) {
    const groupId = menuId.slice(GROUP_PREFIX.length);
    const groups = await loadSearchGroups();
    const group = groups.find((g) => g.id === groupId);
    if (group) await runSearchGroup(group, selection).catch(() => {});
    return;
  }

  if (menuId.startsWith(SITE_PREFIX)) {
    const siteId = menuId.slice(SITE_PREFIX.length);
    const allSites = await loadEnabledSites().catch(() => []);
    const site = allSites.find((s) => s.id === siteId);
    if (site) await openSiteTabAndSend(site, selection).catch(() => {});
  }
}

async function loadSearchGroups() {
  const result = await chrome.storage.local.get(SEARCH_GROUPS_STORAGE_KEY);
  return Array.isArray(result[SEARCH_GROUPS_STORAGE_KEY])
    ? result[SEARCH_GROUPS_STORAGE_KEY]
    : [];
}

async function loadSelectionContextGroups() {
  const result = await chrome.storage.local.get(SELECTION_CONTEXT_GROUPS_STORAGE_KEY);
  return Array.isArray(result[SELECTION_CONTEXT_GROUPS_STORAGE_KEY])
    ? result[SELECTION_CONTEXT_GROUPS_STORAGE_KEY]
    : [];
}

async function loadQuickAccessSiteIds() {
  const result = await chrome.storage.local.get(QUICK_ACCESS_SITES_KEY);
  return Array.isArray(result[QUICK_ACCESS_SITES_KEY])
    ? result[QUICK_ACCESS_SITES_KEY]
    : [];
}

function createContextMenu(options) {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.create(options, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}
