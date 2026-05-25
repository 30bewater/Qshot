/**
 * Experimental / optional modules toggled at build time via build.mjs.
 *
 * Usage:
 *   npm run build                          # all features on (dev / internal)
 *   npm run build:store                    # store release (no experiments)
 *   npm run build -- --disable-features=memory
 *   QSHOT_DISABLE_FEATURES=memory npm run build
 */

export const FEATURE_DEFS = {
  memory: {
    label: "Memory experiment (AI conversation archive)",
    entries: ["memory/content.js"],
    permissions: ["downloads"],
    settingsCssImport: './styles/12-memory.css',
    settingsHtml: {
      navMarker: 'data-section="memory"',
      sectionId: "memorySection",
    },
  },
  desktop: {
    label: "Desktop companion bridge (Native Messaging)",
    entries: [],
    permissions: ["nativeMessaging"],
  },
};

export const DEFAULT_FEATURE_KEYS = Object.keys(FEATURE_DEFS);
