(function initI18nHelpers() {
  if (window.__QSHOT_I18N__) {
    return;
  }

  const EN_MESSAGES = {
    common_add: "Add",
    common_cancel: "Cancel",
    common_close: "Close",
    common_create: "Create",
    common_delete: "Delete",
    common_edit: "Edit",
    common_copy: "Copy",
    common_copied: "Copied",
    common_save: "Save",
    popup_queryPlaceholder: "Enter what you want to search",
    popup_randomQuestion: "Random question",
    popup_promptEntry: "Prompts",
    popup_promptEntryAria: "Prompt entry",
    popup_settings: "Settings",
    popup_historySearch: "Search History",
    popup_emptyHistory: "No search history yet",
    popup_deleteHistoryEntry: "Delete this entry",
    popup_historyDelete: "Delete",
    popup_historyRestore: "Restore",
    popup_restoreHistoryEntry: "Open a new page to restore this search session",
    popup_managePrompts: "Manage Prompts",
    popup_emptyPromptGroups: "No prompt groups yet. Add one in Settings first.",
    popup_emptyPrompts: "No prompts yet. Add one in Settings first.",
    popup_emptyPromptsInGroup: "No prompts in this group yet.",
    overlay_emptyHistory: "No search history yet",
    overlay_deleteHistoryEntry: "Delete this entry",
    overlay_historyDelete: "Delete",
    overlay_historyRestore: "Restore",
    overlay_restoreHistoryEntry: "Open a new page to restore this search session",
    overlay_emptyPromptGroups: "No prompt groups yet. Add one in Settings first.",
    overlay_emptyPromptsInGroup: "No prompts in this group yet.",
    overlay_hintSearch: "Search",
    overlay_managePrompts: "Manage Prompts",
    overlay_unnamedPrompt: "Untitled prompt",
    overlay_unnamedPromptGroup: "Untitled group",
    overlay_unnamedSearchGroup: "Untitled search group",
    settings_navAria: "Settings menu",
    settings_groupsTitle: "Search Groups",
    settings_groupsDesc: "Manage groups and sites",
    settings_customTitle: "Custom Search",
    settings_customDesc: "Add your own search sites",
    settings_promptsTitle: "Prompt Setup",
    settings_promptsDesc: "Manage prompt groups and content",
    settings_randomTitle: "Random Q&A",
    settings_randomDesc: "Customize dice questions",
    settings_shortcutsTitle: "Advanced Search",
    settings_shortcutsDesc: "Set global search shortcut",
    settings_aboutTitle: "About Plugin",
    settings_aboutDesc: "Privacy and data notes",
    settings_sectionTitle_groups: "Groups and Search Targets",
    settings_sectionSubtitle_groups: "Manage search group names, enabled state, opening mode, and the sites or AI models used in each group.",
    settings_meta_promptsTitle: "Prompt Management",
    settings_meta_promptsSubtitle: "Add and manage your common prompts freely, making every input faster.",
    settings_meta_customTitle: "Custom Search Sites",
    settings_meta_customSubtitle: "Add your own search sites. Saved sites can be selected under the Custom category in search groups.",
    settings_meta_randomTitle: "Random Questions",
    settings_meta_randomSubtitle: "Manage questions drawn by the dice button. Use one question per line.",
    settings_groups_emptyTitle: "No search groups yet",
    settings_groups_emptyDesc: "Create a search group first, then configure the sites or AI models you want to use.",
    settings_groups_addGroup: "Add Search Group",
    settings_groups_deleteGroupAria: "Delete search group",
    settings_groups_deleteGroupConfirm: "Delete this search group?",
    settings_groups_fieldName: "Group Name",
    settings_groups_fieldMode: "Mode",
    settings_groups_modeCompare: "Cards",
    settings_groups_modeTabs: "New Tabs",
    settings_groups_dragAria: "Drag to reorder search groups",
    settings_groups_removeSitePrefix: "Remove ",
    settings_groups_categoryOther: "Social Platforms",
    settings_groups_categoryCustom: "Custom",
    settings_groups_aiDomestic: "Chinese Models",
    settings_groups_aiOverseas: "Global Models",
    settings_groups_socialDomestic: "Chinese Platforms",
    settings_groups_socialOverseas: "Global Platforms",
    settings_groups_newGroupName: "New Search Group",
    settings_groups_customEmpty: "No custom sites yet<br/><span class=\"hover-picker-empty-hint\">Add one from Custom Search on the left</span>",
    settings_groups_otherTip: "Social platforms are better used in New Tabs mode. Card previews and opening behavior may be unstable.",
    settings_groups_pickerExternalOnlyTip: "This model cannot be shown as a card; it opens in a new tab only.",
    settings_custom_convertTitle: "URL Rule Converter",
    settings_custom_convertDesc: "Paste a URL with a search term. We will try to detect the search parameter and replace it with {query}.",
    settings_custom_convertBtn: "Convert",
    settings_custom_addTitle: "Add Manually",
    settings_custom_editTitle: "Edit Custom Site",
    settings_custom_addDesc: "Fill in the site name and URL. {query} will be replaced by your keyword during search.",
    settings_custom_fieldName: "Name",
    settings_custom_fieldUrl: "URL",
    settings_custom_cancelEdit: "Cancel Editing",
    settings_custom_saveEdit: "Save Changes",
    settings_custom_confirmAdd: "Add",
    settings_custom_listTitle: "Added Custom Sites",
    settings_custom_listCountPrefix: "",
    settings_custom_listCountSuffix: " custom sites added.",
    settings_custom_listEmpty: "No custom sites yet. Add one above and it will appear here.",
    settings_custom_deleteConfirmPrefix: "Delete custom site \"",
    settings_custom_deleteConfirmMid: "\"?\n",
    settings_custom_deleteConfirmBody: "References to this site in all search groups will also be removed.",
    settings_custom_errorNameRequired: "Please enter a site name.",
    settings_custom_errorUrlRequired: "Please enter a URL.",
    settings_custom_errorUrlProtocol: "URL must start with http:// or https://.",
    settings_custom_errorMissingQuery: "URL must include {query} as the search term placeholder.",
    settings_custom_errorUrlInvalid: "Invalid URL. Please check and try again.",
    settings_custom_convertEmpty: "Paste a URL before converting.",
    settings_custom_convertInvalidUrl: "Invalid URL. Please check and try again.",
    settings_custom_convertNoParam: "Could not detect a search parameter. Provide a search results link with a query parameter, or replace the search term in the URL with {query} manually.",
    settings_prompts_allGroup: "All",
    settings_prompts_addGroup: "Add Group",
    settings_prompts_groupPlaceholder: "Enter group name",
    settings_prompts_newGroupName: "New Group",
    settings_prompts_addPromptCta: "Add Prompt",
    settings_prompts_editPromptTitle: "Edit Prompt",
    settings_prompts_addPromptTitle: "Add Prompt",
    settings_prompts_fieldName: "Name",
    settings_prompts_promptNamePlaceholder: "Enter prompt name",
    settings_prompts_fieldGroup: "Category",
    settings_prompts_newGroupOption: "+ New Group...",
    settings_prompts_newGroupPlaceholder: "Enter a new group name, then press Enter",
    settings_prompts_fieldContent: "Prompt Content",
    settings_prompts_deletePromptConfirm: "Delete this prompt?",
    settings_prompts_renameGroupAria: "Rename group",
    settings_prompts_renameGroupTitle: "Rename",
    settings_prompts_deleteGroupAria: "Delete group",
    settings_prompts_deleteGroupTitle: "Delete group",
    settings_prompts_deleteGroupConfirm: "Delete this prompt group?",
    settings_prompts_dragGroupAria: "Drag to reorder",
    settings_prompts_dragGroupTitle: "Drag to reorder",
    settings_prompts_countPrefix: "",
    settings_prompts_countSuffix: " prompts in this category",
    settings_prompts_emptyAll: "No prompts yet. Click the button below to add one.",
    settings_prompts_emptyGroup: "No prompts in this group yet. Click the button below to add one.",
    settings_prompts_previewAria: "Preview",
    settings_prompts_previewTitle: "Preview content",
    settings_prompts_aiLauncherTitle: "AI page prompt launcher",
    settings_prompts_aiLauncherSwitchTitle: "Show Q button near input",
    settings_prompts_aiLauncherSwitchDesc: "When disabled, Qshot's prompt button will not appear next to inputs on AI sites (ChatGPT, DeepSeek, Kimi, Tongyi/Qwen, etc.).",
    settings_prompts_aiLauncherSitesExpandAria: "Expand AI site list",
    settings_prompts_aiLauncherSitesIntro: "Choose which AI sites show the Q button next to the input. Uncheck a site to hide it there.",
    settings_random_showSwitchTitle: "Show Dice Button",
    settings_random_showSwitchDesc: "When enabled, a dice button appears below the input. Click it to draw a random question from the pool below.",
    settings_random_introP1: "Often the problem isn't not wanting to use AI — it's not knowing what to ask. One tap of the dice, a great question surfaces. Thinking begins.",
    settings_random_introP2: "Build your own pool — because the best questions are always the ones most relevant to you. Fill it with topics tied to your role, interests, or goals, and every roll becomes worthwhile.",
    settings_random_aiHelpHint: "You can also let AI help you build it. Send the prompt below to any AI to get started:",
    settings_random_copyPromptAria: "Copy prompt",
    settings_random_poolTitle: "Question Pool",
    settings_random_poolPlaceholder: "One question per line...",
    settings_random_countPrefix: "",
    settings_random_countSuffix: " questions total.",
    settings_random_saved: "Saved",
    settings_misc_darkModeTitle: "Theme color",
    settings_misc_themeDesc: "Follow the browser color scheme, or lock the interface to dark or light mode.",
    settings_misc_themeAuto: "Match browser",
    settings_misc_themeDark: "Dark",
    settings_misc_themeLight: "Light",
    settings_misc_textSelectionTitle: "Selected Text Search",
    settings_other_contextMenuToggleTitle: "Right-click search menu",
    settings_other_contextMenuToggleDesc: "Right-click selected text to run a search group.",
    settings_other_selectionSearchToggleTitle: "Selection search bubble",
    settings_other_selectionSearchToggleDesc: "Show a quick-search bubble automatically when text is selected.",
    settings_other_quickSitesTitle: "Triple-space quick sites",
    settings_other_quickSitesDesc: "Triple-press space in the search overlay input to jump to one of these sites (up to 9).",
    settings_other_homeDisplayTitle: "Search Box Display",
    settings_other_homeDisplayDesc: "The search box triggered by Ctrl+Q shortcut or clicking the extension icon.",
    settings_other_showHistoryTitle: "Show Search History",
    settings_other_showHistoryDesc: "When disabled, the history area below the home screen will be hidden.",
    settings_other_showPromptTitle: "Show Prompt Button",
    settings_other_showPromptDesc: "When disabled, the prompt entry below the input will be hidden.",
    settings_other_globalShortcutTitle: "Global Search Shortcut",
    settings_other_globalShortcutDesc: "Use a keyboard shortcut on any page to open the search overlay in the center of the screen.",
    settings_other_enableGlobalShortcutTitle: "Enable Global Search Shortcut",
    settings_other_enableGlobalShortcutDesc: "When enabled, pressing the custom shortcut below opens the search overlay on the current page. When disabled, the shortcut will not work.",
    settings_other_enableGlobalShortcutTip: "The shortcut may not work on browser internal pages, extension stores, or some special pages.",
    settings_other_searchConfigIoTitle: "Import / Export Config",
    settings_other_searchConfigIoDesc: "Export preset modules as JSON and import them later. Prompt presets in the Prompts tab are exported separately as Markdown.",
    settings_configIo_desc: "Export preset modules as JSON. Choose search groups, custom search, global quick sites, right-click prompts, and AI summary settings. Import replaces only the modules present in the file.",
    settings_configIo_exportTitle: "Export Config",
    settings_configIo_exportSubtitle: "Choose preset modules to export. File format: JSON.",
    settings_configIo_exportConfirm: "Export JSON",
    settings_configIo_exportConfirmCount: "Export JSON",
    settings_configIo_sectionSearchGroups: "Search Groups",
    settings_configIo_sectionCustomSites: "Custom Search",
    settings_configIo_sectionQuickAccess: "Global Quick Sites",
    settings_configIo_sectionCtxGroups: "Right-click Prompts",
    settings_configIo_sectionAiSummary: "AI Summary Settings",
    settings_configIo_importEmpty: "The file does not contain any importable config content.",
    settings_configIo_importConfirmReplace: "Importing will replace the current settings for the listed modules. This cannot be undone.",
    settings_other_exportConfig: "Export Config",
    settings_other_importConfig: "Import Config",
    settings_other_importParseError: "Could not parse the file. Please confirm it is a JSON config exported from this extension.",
    settings_other_importInvalidFormat: "Invalid file format. Please use a search config file exported from this extension.",
    settings_other_importEmpty: "The file does not contain any search groups or custom sites to import.",
    settings_other_importConfirmLine1Prefix: "About to import ",
    settings_other_importConfirmLine1Suffix: ".",
    settings_other_importConfirmLine2Prefix: "Importing will completely replace current search group configuration",
    settings_other_importConfirmLine2Sites: " and custom sites",
    settings_other_importConfirmLine2Suffix: ". This cannot be undone.",
    settings_other_importConfirmLine3: "Continue?",
    settings_other_shortcutsHintPrefix: "You can also go to the browser's ",
    settings_other_shortcutsHintLink: "extension keyboard shortcuts",
    settings_other_shortcutsHintSuffix: " page and change \"Activate the extension\" to a shortcut that opens the top popup from any page.",
    settings_other_customShortcutTitle: "Custom Shortcut",
    settings_other_customShortcutDesc: "Click the button on the right, then press a key combination to record it. It must include at least one modifier key (Ctrl / Alt / Shift / Win).",
    settings_other_recordShortcutAria: "Record shortcut",
    settings_other_resetShortcutTitle: "Reset to default Alt + Q",
    settings_other_resetShortcut: "Reset Default",
    settings_other_shortcutRefreshTip: "Tip: after changing the shortcut, refresh the current page for it to take effect.",
    settings_other_recording: "Press a shortcut...",
    settings_other_recordInvalid: "Must include a modifier key. Try again",
    settings_other_tabGlobal: "Global Search",
    settings_other_tabRightClick: "Right-click Prompts",
    settings_other_tabBubble: "Selection Bubble",
    settings_ctx_sectionTitle: "Right-click Prompt Search Groups",
    settings_ctx_sectionDesc: "Shown only in the right-click menu after selecting text. Format: prompt + selected content.",
    settings_ctx_emptyHint: "Click the button below to add one, e.g. a \"Translate\" group.",
    settings_ctx_addGroup: "Add Right-click Prompt Group",
    settings_ctx_newGroupName: "Translate",
    settings_ctx_defaultPrompt: "Please translate the following:",
    settings_ctx_deleteAria: "Delete",
    settings_ctx_deleteConfirm: "Delete this right-click prompt group?",
    settings_ctx_fieldName: "Group Name",
    settings_ctx_fieldPrompt: "Prompt (placed before selected content)",
    settings_ctx_fieldCallType: "Invocation",
    settings_ctx_groupPlaceholder: "Select search group…",
    settings_ctx_defaultName: "New selection group",
    settings_ctx_nameMaxHint: "Max 6 chars",
    settings_ctx_callTypeGroupShort: "Search Group",
    settings_ctx_callTypeCustomShort: "Custom",
    settings_ctx_callOptionExistingGroup: "Existing Search Group",
    settings_ctx_callOptionCustomSites: "Custom Sites",
    settings_ctx_noGroupsHint: "Create a search group first",
    settings_ctx_maxSitesNote: "Up to 5",
    settings_bubble_sourceTitle: "Bubble Contents",
    settings_bubble_sourceHint: "You can enable multiple sources. The bubble shows items from each enabled group in order, separated by dividers. We recommend enabling at most two to keep the bubble compact. Each group shows up to 5 items.",
    settings_bubble_sourceGroups: "Search Groups",
    settings_bubble_sourceCtx: "Right-click Prompt Groups",
    settings_bubble_sourceGlobalSites: "Global Search Sites",
    settings_aiSummaryNavTitle: "AI Summary",
    settings_aiSummaryNavDesc: "Configure AI summary provider and prompt",
    settings_aiSummaryEyebrow: "AI Summary Settings",
    settings_aiSummaryAddGroup: "New prompt group",
    settings_aiSummaryGroupName: "Prompt group name...",
    settings_aiSummaryDeleteGroup: "Delete this group",
    settings_memoryNavTitle: "Memory",
    settings_memoryNavDesc: "Conversation archive, filters and memory cards",
    settings_memoryEyebrow: "Local Experimental Module",
    settings_memoryTitle: "Memory",
    settings_memorySubtitle: "Archive ChatGPT, DeepSeek, Doubao, and Kimi conversations locally; filter by platform/model and date; maintain memory cards for manual injection.",
    settings_about_privacyTitle: "Privacy and Data Notes",
    settings_about_openSourceLabel: "Open source and free: ",
    settings_about_openSourceBody: "Qshot is an open-source and free extension. It does not run any backend server. Reviews and contributions are welcome.",
    settings_about_zeroDataLabel: "Zero data collection: ",
    settings_about_zeroDataBody: "Qshot does not upload your search keywords, browsing history, or page content to developer servers. Functional configuration data is stored locally only.",
    settings_about_transparencyLabel: "Transparent interaction: ",
    settings_about_transparencyBody: "The extension opens target sites through iframes or New Tabs mode. Your login and interactions happen directly between your browser and the target site.",
    settings_about_site: "Website",
    settings_about_source: "Source",
    settings_about_authorAria: "Author accounts",
    settings_about_authorLabel: "Author: ",
    settings_about_miscTitle: "Other preferences",
    settings_about_miscDesc: "Home screen modules, search config backup, and display language.",
    settings_about_localeTitle: "Interface language",
    settings_about_localeDesc: "Follow the browser, or lock the extension to Chinese or English.",
    settings_about_localeAuto: "Match browser",
    settings_about_localeZh: "简体中文",
    settings_about_localeEn: "English",
    settings_about_localeConfirm: "Apply",
    settings_miscTitle: "Appearance",
    settings_miscDesc: "AI summary and other settings",
    settings_miscSubtitle: "AI summary, home display, search config backup and interface language.",
    settings_misc_tabAi: "AI Summary",
    settings_misc_tabOther: "Other settings",
    settings_aiSummaryTitle: "AI Summary",
    settings_aiSummaryDesc: "Choose an OpenAI-compatible API provider to summarize all AI card responses on the results page.",
    settings_aiSummaryProvider: "Provider",
    settings_aiSummaryApiManage: "API Keys",
    settings_aiSummaryDocs: "Docs",
    settings_aiSummaryApiKey: "API Key",
    settings_aiSummaryApiKeyPlaceholder: "sk-...",
    settings_aiSummaryApiKeyHint: "Key is stored locally in your browser only, never uploaded.",
    settings_aiSummaryModel: "Model",
    settings_aiSummaryCustomModel: "Custom model",
    settings_aiSummaryCustomModelPlaceholder: "Model name",
    settings_aiSummaryChooseModel: "Choose a suggested model",
    settings_aiSummaryModelHint: "Type a model name directly, or choose a suggested model from the button.",
    settings_aiSummaryNoPresetModels: "No suggested models yet. Type a model name directly.",
    settings_aiSummaryAdvanced: "Advanced Settings",
    settings_aiSummaryOfficialBaseUrl: "Official endpoint",
    settings_aiSummaryCustomEndpoint: "Custom OpenAI-compatible endpoint",
    settings_aiSummaryBaseUrlEditable: "This provider allows overriding the Base URL for official changes or proxy gateways.",
    settings_aiSummaryBaseUrlReadonly: "Preset providers use the official OpenAI-compatible endpoint.",
    settings_aiSummaryPrompt: "Summary Prompt",
    settings_aiSummaryPromptPlaceholder: "Enter custom summary instructions...",
    settings_aiSummarySave: "Save",
    settings_aiSummarySaved: "Saved.",
    settings_aiSummaryResetPrompt: "Restore Default Prompt",
    settings_aiSummaryPromptReset: "Default prompt restored. Click Save to apply it.",
    settings_aiSummaryTestConn: "Test Connection",
    settings_aiSummaryTesting: "Testing...",
    settings_aiSummaryNeedApiKey: "Please enter an API Key first.",
    settings_aiSummaryNeedModel: "Please choose or enter a model name first.",
    settings_aiSummaryTestOk: "Connection OK",
    settings_aiSummaryTestFail: "Test failed: ",
    iframe_pageTitle: "Qshot - Bullet Search",
    iframe_siteNavTitle: "AI Models",
    iframe_historyTitle: "Search History",
    iframe_historyClear: "Clear",
    iframe_historyFilterAll: "All",
    iframe_historyFilterToday: "Today",
    iframe_historyFilterYesterday: "Yesterday",
    iframe_historyEmpty: "No search history yet",
    iframe_historyEmptyToday: "No searches today",
    iframe_historyEmptyYesterday: "No searches yesterday",
    iframe_close: "Close",
    iframe_loadingStatus: "Loading site configuration...",
    iframe_addSiteAria: "Add site",
    iframe_addSiteTooltip: "Add site",
    iframe_quickActionsAria: "Quick actions",
    iframe_exportDoc: "Export document",
    iframe_exportModalTitle: "Export Conversation",
    iframe_exportNotice: "Reads currently loaded AI responses from each card; results depend on page load state.<br>This feature is still in beta and may have incomplete extraction or formatting issues.<br>Only AI model conversations can be exported.",
    iframe_exportFormatTitle: "Export format",
    iframe_exportSelectTitle: "Select cards",
    iframe_exportConfirm: "Export",
    iframe_exportEmpty: "No exportable AI model cards on this page.",
    iframe_exportSelectAtLeastOne: "Select at least one AI model to export.",
    iframe_exportInProgress: "Exporting...",
    iframe_exportReadingCards: "Reading {count} card(s), please wait...",
    iframe_exportFailed: "Export failed: {error}",
    iframe_exportUnknownError: "Unknown error",
    iframe_history: "History",
    iframe_historySearchAria: "Search history",
    iframe_aiSummaryMenuLabel: "AI Summary",
    iframe_layoutAdjust: "Layout",
    iframe_layoutSettings: "Layout settings",
    iframe_queryPlaceholder: "Qshot it",
    iframe_toolsAria: "Tools",
    iframe_layoutDisplayTitle: "Display",
    iframe_layoutRows1: "1 row",
    iframe_layoutRows2: "2 rows",
    iframe_layoutRows3: "3 rows",
    iframe_layoutFullscreen: "Fullscreen",
    iframe_layoutWidthTitle: "Width",
    iframe_layoutNarrow: "Narrow",
    iframe_layoutWide: "Wide",
    iframe_newChat: "New chat",
    iframe_promptAssist: "Prompts",
    iframe_uploadFile: "Upload file",
    iframe_uploadFileTooltip: "Attach files",
    iframe_send: "Send",
    iframe_openSettings: "Open settings",
    iframe_cardJump: "Open original site",
    iframe_cardRefresh: "Refresh this card",
    iframe_cardClose: "Close this card",
    iframe_aiSummaryTooltip: "AI Summary",
    iframe_aiSummaryModalTitle: "AI One-click Summary",
    iframe_aiSummaryNoKey: "Please go to Settings -> Appearance -> AI Summary to fill in your API Key first.",
    iframe_aiSummaryOpenSettings: "Open Settings",
    iframe_aiSummaryStart: "Start Summary",
    iframe_aiSummaryCopy: "Copy Result",
    iframe_aiSummaryRetry: "Re-analyze",
    iframe_aiSummaryCollecting: "Reading card content...",
    iframe_aiSummaryCalling: "Summarizing answers from {cards} on this page with {provider}…",
    iframe_aiSummaryCardsFallback: "AI cards on this page",
    iframe_aiSummaryEmpty: "No AI card content available to summarize. Please wait for cards to finish loading.",
    iframe_aiSummaryTruncated: "Note: the result may be truncated due to token limit.",
    iframe_aiSummaryCopied: "Copied!",
    iframe_addSite_customEmpty: "No custom sites yet. Add one in Settings.",
    iframe_addSite_empty: "No sites available to add.",
    iframe_addSite_alreadyActive: "This card is already on the page.",
    iframe_addSite_externalOnlyTip: "This model cannot be shown as a card; search opens in a new tab instead."
  };

  /** null = follow browser (default); "zh" / "en" = manual UI language for in-bundle strings. */
  let localeModeOverride = null;

  function setLocaleMode(mode) {
    if (mode === "zh" || mode === "en") {
      localeModeOverride = mode;
    } else {
      localeModeOverride = null;
    }
  }

  function resolveBrowserUiLanguage() {
    try {
      const chromeLang = (chrome?.i18n?.getUILanguage?.() || "").toLowerCase();
      if (chromeLang) return chromeLang;
      const navLang = (navigator?.language || "").toLowerCase();
      return navLang || "en";
    } catch (_e) {
      return (navigator?.language || "en").toLowerCase();
    }
  }

  function getUiLanguage() {
    if (localeModeOverride === "zh") return "zh-cn";
    if (localeModeOverride === "en") return "en";
    return resolveBrowserUiLanguage();
  }

  function t(key, substitutions) {
    const useChromeI18n = localeModeOverride === null;
    if (useChromeI18n) {
      try {
        const chromeMsg = chrome?.i18n?.getMessage?.(key, substitutions);
        if (chromeMsg) return chromeMsg;
      } catch (_e) {
        // ignore
      }
    }
    if (!getUiLanguage().startsWith("zh")) {
      return EN_MESSAGES[key] || "";
    }
    return "";
  }

  function applyDomI18n(root = document) {
    const lang = getUiLanguage();
    if (document?.documentElement) {
      document.documentElement.lang = lang;
    }

    const nodes = root.querySelectorAll("[data-i18n], [data-i18n-attr]");
    nodes.forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) {
        // Snapshot the original (Chinese) text the very first time this element
        // is processed so we can restore it when switching back to Chinese.
        if (!el.hasAttribute("data-i18n-orig")) {
          el.setAttribute("data-i18n-orig", el.textContent);
        }
        const translated = t(key);
        el.textContent = translated || el.getAttribute("data-i18n-orig") || "";
      }

      const attrSpec = el.getAttribute("data-i18n-attr");
      if (attrSpec) {
        // format: attr:key;attr2:key2
        attrSpec
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((pair) => {
            const [attr, aKey] = pair.split(":").map((s) => s.trim());
            if (!attr || !aKey) return;
            const origAttrKey = "data-i18n-orig-" + attr;
            if (!el.hasAttribute(origAttrKey)) {
              el.setAttribute(origAttrKey, el.getAttribute(attr) || "");
            }
            const translated = t(aKey);
            el.setAttribute(attr, translated || el.getAttribute(origAttrKey) || "");
          });
      }
    });
  }

  function isZhUi() {
    return getUiLanguage().startsWith("zh");
  }

  window.__QSHOT_I18N__ = { t, applyDomI18n, getUiLanguage, setLocaleMode, isZhUi };
})();

