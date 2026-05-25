import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const LIMIT = 500;

const SKIP_DIRS = new Set(["node_modules", "dist", "codex-backups"]);
const SCAN_EXT = new Set([".js", ".css", ".mjs"]);

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), out);
      continue;
    }
    const ext = path.extname(entry.name);
    if (!SCAN_EXT.has(ext)) continue;
    out.push(path.join(dir, entry.name));
  }
  return out;
}

function countLines(text) {
  if (!text.length) return 0;
  return text.split(/\r?\n/).length;
}

const files = await walk(SRC);
const violations = [];

for (const file of files) {
  const text = await readFile(file, "utf8");
  const lines = countLines(text);
  if (lines > LIMIT) {
    violations.push({ file: path.relative(ROOT, file), lines });
  }
}

violations.sort((a, b) => b.lines - a.lines);

if (violations.length === 0) {
  console.log(`[check-lines] OK — all src JS/CSS files are <= ${LIMIT} lines.`);
  process.exit(0);
}

console.error(`[check-lines] ${violations.length} file(s) exceed ${LIMIT} lines:\n`);
for (const { file, lines } of violations) {
  console.error(`  ${lines}\t${file}`);
}
console.error(`\nSplit oversized modules or raise the limit only for pure-data JSON.`);
process.exit(1);
