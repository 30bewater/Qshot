import esbuild from "esbuild";
import { cp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDeclarativeNetRequestRules } from "./src/config/rules-source.mjs";
import { DEFAULT_FEATURE_KEYS, FEATURE_DEFS } from "./src/config/features-source.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const ARGV = process.argv.slice(2);
const WATCH = ARGV.includes("--watch");
const DEV = WATCH || process.env.NODE_ENV !== "production";

const FEATURE_FLAGS = parseFeatureFlags(ARGV, process.env);

const BASE_ENTRIES = [
  "background.js",
  "config/baseConfig.js",
  "iframe/inject.js",
  "iframe/overlay.js",
  "iframe/overlay_frame.js",
  "iframe/overlay_main.js",
  "iframe/iframe-anti-detect.js",
  "iframe/iframe.js",
  "popup/popup.js",
  "settings/settings.js",
  "shared/i18n.js",
  "shared/prompt-item.js",
];

const ENTRIES = collectEntries(FEATURE_FLAGS);

const SRC_ASSETS = [
  "manifest.json",
  "_locales",
  "icons",
  "config/initialState.json",
  "config/initialState.zh-CN.json",
  "config/initialState.en.json",
  "config/siteHandlers.json",
  "config/random-questions",
  "popup/popup.html",
  "popup/popup.css",
  "popup/styles",
  "popup/icon128.png",
  "popup/logo.svg",
  "settings/settings.html",
  "settings/settings.css",
  "settings/styles",
  "settings/about-logo.svg",
  "iframe/iframe.html",
  "iframe/iframe.css",
  "iframe/styles",
];

const ROOT_ASSETS = ["LICENSE", "PRIVACY.md"];

function parseFeatureFlags(argv, env) {
  if (argv.includes("--list-features")) {
    console.log("[features] available:");
    for (const [key, def] of Object.entries(FEATURE_DEFS)) {
      console.log(`  - ${key}: ${def.label}`);
    }
    process.exit(0);
  }

  const enableArg = argv.find((arg) => arg.startsWith("--features="));
  const disableArg = argv.find((arg) => arg.startsWith("--disable-features="));
  const enableEnv = String(env.QSHOT_FEATURES || "").trim();
  const disableEnv = String(env.QSHOT_DISABLE_FEATURES || "").trim();
  const enableRaw = enableArg?.slice("--features=".length).trim() || enableEnv;
  const disableRaw = disableArg?.slice("--disable-features=".length).trim() || disableEnv;

  const flags = Object.fromEntries(DEFAULT_FEATURE_KEYS.map((key) => [key, true]));

  if (enableRaw) {
    for (const key of DEFAULT_FEATURE_KEYS) {
      flags[key] = false;
    }
    if (enableRaw === "release" || enableRaw === "store") {
      return flags;
    }
    for (const key of splitFeatureList(enableRaw)) {
      if (key in flags) {
        flags[key] = true;
      } else {
        console.warn(`[features] unknown feature in --features: ${key}`);
      }
    }
    return flags;
  }

  for (const key of splitFeatureList(disableRaw)) {
    if (key in flags) {
      flags[key] = false;
    } else {
      console.warn(`[features] unknown feature in --disable-features: ${key}`);
    }
  }

  return flags;
}

function splitFeatureList(raw) {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function collectEntries(flags) {
  const entries = [...BASE_ENTRIES];
  for (const [key, enabled] of Object.entries(flags)) {
    if (!enabled) continue;
    for (const rel of FEATURE_DEFS[key]?.entries || []) {
      if (!entries.includes(rel)) {
        entries.push(rel);
      }
    }
  }
  return entries;
}

function collectDisabledPermissions(flags) {
  const disabled = new Set();
  for (const [key, enabled] of Object.entries(flags)) {
    if (enabled) continue;
    for (const permission of FEATURE_DEFS[key]?.permissions || []) {
      disabled.add(permission);
    }
  }
  return disabled;
}

function collectEnabledPermissions(flags) {
  const enabled = new Set();
  for (const [key, isOn] of Object.entries(flags)) {
    if (!isOn) continue;
    for (const permission of FEATURE_DEFS[key]?.permissions || []) {
      enabled.add(permission);
    }
  }
  return enabled;
}

function makeFeatureDefines(flags) {
  return {
    __QSHOT_FEATURE_MEMORY__: String(Boolean(flags.memory)),
    __QSHOT_FEATURE_DESKTOP__: String(Boolean(flags.desktop)),
  };
}

async function copyOne(from, to) {
  if (!existsSync(from)) {
    console.warn(`[assets] skip missing: ${path.relative(ROOT, from)}`);
    return;
  }
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
}

async function patchManifest(manifestPath) {
  const raw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw);
  const disabledPermissions = collectDisabledPermissions(FEATURE_FLAGS);
  const enabledPermissions = collectEnabledPermissions(FEATURE_FLAGS);

  if (Array.isArray(manifest.permissions)) {
    manifest.permissions = manifest.permissions.filter((permission) => !disabledPermissions.has(permission));
    for (const permission of enabledPermissions) {
      if (!manifest.permissions.includes(permission)) {
        manifest.permissions.push(permission);
      }
    }
  }

  if (Array.isArray(manifest.content_scripts) && !FEATURE_FLAGS.memory) {
    manifest.content_scripts = manifest.content_scripts.filter((block) => {
      const scripts = Array.isArray(block?.js) ? block.js : [];
      return !scripts.some((script) => script.includes("memory/"));
    });
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

async function patchSettingsHtml(from, to) {
  let html = await readFile(from, "utf8");
  if (!FEATURE_FLAGS.memory) {
    html = stripHtmlBlockByMarker(html, 'data-section="memory"');
    html = stripHtmlBlockById(html, "memorySection");
  }
  await mkdir(path.dirname(to), { recursive: true });
  await writeFile(to, html, "utf8");
}

function stripHtmlBlockByMarker(html, marker) {
  const start = html.indexOf(marker);
  if (start < 0) return html;
  const open = html.lastIndexOf("<button", start);
  const close = html.indexOf("</button>", start);
  if (open < 0 || close < 0) return html;
  return html.slice(0, open) + html.slice(close + "</button>".length);
}

function stripHtmlBlockById(html, id) {
  const marker = `id="${id}"`;
  const start = html.indexOf(marker);
  if (start < 0) return html;
  const open = html.lastIndexOf("<section", start);
  const close = html.indexOf("</section>", start);
  if (open < 0 || close < 0) return html;
  return html.slice(0, open) + html.slice(close + "</section>".length);
}

async function patchSettingsCss(from, to) {
  let css = await readFile(from, "utf8");
  if (!FEATURE_FLAGS.memory) {
    css = css
      .split("\n")
      .filter((line) => !line.includes("12-memory.css"))
      .join("\n");
  }
  await mkdir(path.dirname(to), { recursive: true });
  await writeFile(to, css, "utf8");
}

async function copyAssets() {
  for (const rel of SRC_ASSETS) {
    const from = path.join(SRC, rel);
    const to = path.join(DIST, rel);
    if (rel === "manifest.json") {
      await copyOne(from, to);
      await patchManifest(to);
      continue;
    }
    if (rel === "settings/settings.html") {
      await patchSettingsHtml(from, to);
      continue;
    }
    if (rel === "settings/settings.css") {
      await patchSettingsCss(from, to);
      continue;
    }
    await copyOne(from, to);
  }
  for (const rel of ROOT_ASSETS) {
    await copyOne(path.join(ROOT, rel), path.join(DIST, rel));
  }
  await generateRules();
}

async function generateRules() {
  const target = path.join(DIST, "config", "rules.json");
  await mkdir(path.dirname(target), { recursive: true });
  const rules = buildDeclarativeNetRequestRules();
  await writeFile(target, JSON.stringify(rules, null, 2) + "\n", "utf8");
}

function makeFeatureAliasPlugin(flags) {
  const memoryBackgroundStub = path.join(SRC, "build-stubs/memory-background.js");
  const memorySectionStub = path.join(SRC, "build-stubs/memory-section.js");
  const desktopBackgroundStub = path.join(SRC, "build-stubs/desktop-background.js");

  return {
    name: "qshot-feature-alias",
    setup(build) {
      if (!flags.memory) {
        build.onResolve({ filter: /[/\\]memory[/\\]background\.js$/ }, () => ({
          path: memoryBackgroundStub,
        }));

        build.onResolve({ filter: /[/\\]sections[/\\]memory\.js$/ }, () => ({
          path: memorySectionStub,
        }));
      }

      if (!flags.desktop) {
        build.onResolve({ filter: /[/\\]desktop[/\\]background\.js$/ }, () => ({
          path: desktopBackgroundStub,
        }));
      }
    },
  };
}

function makeBuildOptions() {
  return {
    entryPoints: ENTRIES.map((rel) => ({
      in: path.join(SRC, rel),
      out: rel.replace(/\.js$/, ""),
    })),
    outdir: DIST,
    bundle: true,
    format: "iife",
    target: "chrome111",
    sourcemap: DEV ? "inline" : false,
    minify: !DEV,
    logLevel: "info",
    legalComments: "none",
    charset: "utf8",
    define: makeFeatureDefines(FEATURE_FLAGS),
    plugins: [makeFeatureAliasPlugin(FEATURE_FLAGS)],
  };
}

function logFeatureSummary() {
  const enabled = DEFAULT_FEATURE_KEYS.filter((key) => FEATURE_FLAGS[key]);
  const disabled = DEFAULT_FEATURE_KEYS.filter((key) => !FEATURE_FLAGS[key]);
  console.log(`[features] enabled: ${enabled.join(", ") || "(none)"}`);
  if (disabled.length) {
    console.log(`[features] disabled: ${disabled.join(", ")}`);
  }
}

async function run() {
  logFeatureSummary();
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const options = makeBuildOptions();

  if (WATCH) {
    const ctx = await esbuild.context({
      ...options,
      plugins: [
        {
          name: "copy-assets-on-rebuild",
          setup(build) {
            build.onEnd(async (result) => {
              if (result.errors.length === 0) {
                await copyAssets();
                console.log(`[build] ok (${new Date().toLocaleTimeString()})`);
              }
            });
          },
        },
      ],
    });
    await ctx.watch();
    await copyAssets();
    console.log("[build] watching src/ ...");
  } else {
    await esbuild.build(options);
    await copyAssets();
    console.log("[build] done → dist/");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
