(function initPopup() {
  const queryInput = document.getElementById("popupQueryInput");
  const groupsContainer = document.getElementById("popupGroups");
  const openSettingsBtn = document.getElementById("openSettingsBtn");

  document.addEventListener("DOMContentLoaded", start);
  chrome.storage.onChanged.addListener(handleStorageChange);

  async function start() {
    await refreshGroups();
    queryInput.focus();
  }

  openSettingsBtn.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "OPEN_SETTINGS_PAGE" });
    window.close();
  });

  async function handleStorageChange(changes, areaName) {
    if (areaName !== "local" || !changes.searchGroups) {
      return;
    }
    await refreshGroups();
  }

  async function refreshGroups() {
    const groups = await loadGroups();
    renderGroups(groups);
  }

  function renderGroups(groups) {
    groupsContainer.innerHTML = "";
    groups.forEach((group) => {
      const button = document.createElement("button");
      button.className = "primary-btn popup-group-btn";
      button.type = "button";
      button.innerHTML = `
        <span class="popup-group-name">${escapeHtml(group.name)}</span>
        <span class="popup-group-meta">${Array.isArray(group.siteIds) ? group.siteIds.length : 0} 个站点</span>
      `;
      button.addEventListener("click", async () => {
        const query = queryInput.value.trim();
        await chrome.runtime.sendMessage({
          type: "RUN_SEARCH_GROUP",
          group,
          query
        });
        window.close();
      });
      groupsContainer.appendChild(button);
    });
  }

  async function loadGroups() {
    const stored = await chrome.storage.local.get(["searchGroups"]);
    return Array.isArray(stored.searchGroups) ? stored.searchGroups : [];
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
