import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getExtensionSmokeSkipReason, resolveExtensionPath } from "../tests/e2e/helpers/extension-context.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const skipReason = getExtensionSmokeSkipReason();
if (skipReason?.includes("npm run build")) {
  console.error(`[test:smoke] ${skipReason}`);
  process.exit(1);
}

if (skipReason) {
  console.warn(`[test:smoke] ${skipReason}`);
  process.exit(0);
}

const extensionPath = resolveExtensionPath();
const manifest = path.join(extensionPath, "manifest.json");
const manifestJson = JSON.parse(fs.readFileSync(manifest, "utf8"));
console.log(`[test:smoke] 使用扩展: ${extensionPath} (v${manifestJson.version || "?"})`);
