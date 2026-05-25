/**
 * 商店包标准打包：build:store → 校验 dist → 打 zip → 再校验 zip。
 * 禁止手搓 Compress-Archive；Microsoft Edge 会严格检查 config/rules.json 是否在 zip 内。
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, "dist");
const RELEASE = path.join(ROOT, "release");

/** Edge / Chrome 上传 zip 必须包含的路径（正斜杠，相对 zip 根目录） */
const REQUIRED_ZIP_ENTRIES = [
  "manifest.json",
  "background.js",
  "PRIVACY.md",
  "config/rules.json",
  "config/siteHandlers.json",
  "config/initialState.json",
  "config/initialState.en.json",
  "config/initialState.zh-CN.json",
];

function readManifest(distDir) {
  return JSON.parse(fs.readFileSync(path.join(distDir, "manifest.json"), "utf8"));
}

function validateDist(distDir) {
  const errors = [];

  for (const rel of REQUIRED_ZIP_ENTRIES) {
    const abs = path.join(distDir, ...rel.split("/"));
    if (!fs.existsSync(abs)) {
      errors.push(`dist 缺少 ${rel}`);
      continue;
    }
    if (fs.statSync(abs).size === 0) {
      errors.push(`dist/${rel} 为空文件`);
    }
  }

  let manifest;
  try {
    manifest = readManifest(distDir);
  } catch (err) {
    errors.push(`无法读取 dist/manifest.json：${err.message}`);
    return errors;
  }

  const ruleResources = manifest.declarative_net_request?.rule_resources;
  if (!Array.isArray(ruleResources) || ruleResources.length === 0) {
    errors.push("manifest.json 缺少 declarative_net_request.rule_resources");
  } else {
    for (const item of ruleResources) {
      const rel = String(item?.path || "").replace(/\\/g, "/");
      if (!rel) {
        errors.push("rule_resources 存在空 path");
        continue;
      }
      const abs = path.join(distDir, ...rel.split("/"));
      if (!fs.existsSync(abs)) {
        errors.push(`manifest 引用 ${rel}，但 dist 中不存在（build 可能未完成 generateRules）`);
      }
    }
  }

  const scripts = JSON.stringify(manifest.content_scripts || []);
  if (scripts.includes("memory/")) {
    errors.push("商店包 manifest 仍含 memory content_scripts，请用 npm run build:store");
  }

  return errors;
}

const ZIP_HELPER = path.join(ROOT, "scripts", "zip-dist.py");

function listZipEntries(zipPath) {
  const raw = execSync(`python "${ZIP_HELPER}" list "${zipPath}"`, { encoding: "utf8" });
  return JSON.parse(raw.trim());
}

function createZipWithPython(distDir, zipPath) {
  execSync(`python "${ZIP_HELPER}" create "${distDir}" "${zipPath}"`, { stdio: "inherit" });
}

function validateZip(zipPath) {
  const errors = [];
  let entries;

  try {
    entries = listZipEntries(zipPath);
  } catch (err) {
    errors.push(`无法读取 zip：${err.message}`);
    return errors;
  }

  const set = new Set(entries.map((e) => e.replace(/\\/g, "/")));

  for (const rel of REQUIRED_ZIP_ENTRIES) {
    if (!set.has(rel)) {
      errors.push(`zip 缺少 ${rel}${rel === "config/rules.json" ? "（Microsoft Edge 必验项）" : ""}`);
    }
  }

  if (entries.some((e) => e.includes("\\"))) {
    errors.push("zip 内路径含反斜杠 \\，Chrome/Edge 可能拒收，请用 npm run pack:store");
  }

  if (entries.some((e) => e.startsWith("dist/"))) {
    errors.push("zip 根目录不应是 dist/ 文件夹，应是 manifest.json 直接在 zip 根");
  }

  return errors;
}

function createZip(distDir, zipPath) {
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  createZipWithPython(distDir, zipPath);
}

function runBuild() {
  console.log("[pack:store] NODE_ENV=production npm run build:store");
  execSync("npm run build:store", {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });
}

function main() {
  const skipBuild = process.argv.includes("--skip-build");

  if (!skipBuild) {
    runBuild();
  } else {
    console.log("[pack:store] --skip-build：跳过构建，仅校验并打包现有 dist/");
  }

  const distErrors = validateDist(DIST);
  if (distErrors.length > 0) {
    console.error("[pack:store] dist 校验失败：");
    for (const err of distErrors) {
      console.error(`  - ${err}`);
    }
    console.error("\n提示：config/rules.json 由 build.mjs 的 generateRules() 生成，不是 src 静态文件。");
    console.error("若 dist 被 Chrome 占用导致 build 失败，请先关闭已加载的扩展再重试。");
    process.exit(1);
  }

  const version = readManifest(DIST).version || "unknown";
  const zipPath = path.join(RELEASE, `qshot-${version}-store.zip`);

  console.log(`[pack:store] 打包 → ${path.relative(ROOT, zipPath)}`);
  createZip(DIST, zipPath);

  const zipErrors = validateZip(zipPath);
  if (zipErrors.length > 0) {
    console.error("[pack:store] zip 校验失败：");
    for (const err of zipErrors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  const sizeKb = Math.round(fs.statSync(zipPath).size / 1024);
  console.log(`[pack:store] OK  v${version}  ${sizeKb} KB`);
  console.log(`[pack:store] 上传文件：${zipPath}`);
}

main();
