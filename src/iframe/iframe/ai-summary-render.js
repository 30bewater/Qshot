import { AI_STREAM_LOGO_SVG } from "./ai-summary-stream-logo.js";

const STREAM_CURSOR_ANCHORS = [
  "</p>", "</li>", "</h5>", "</h4>", "</h3>", "</td>", "</th>",
  "</strong>", "</em>", "</code>",
];

export function aiSummaryStreamCursor(solo = false) {
  const cls = solo ? "ai-cursor ai-cursor--solo" : "ai-cursor";
  return `<span class="${cls}" aria-hidden="true">${AI_STREAM_LOGO_SVG}</span>`;
}

/** Keep cursor inline at end of last text node (not as a sibling after block tags). */
export function htmlWithStreamCursor(html) {
  if (!html?.trim()) return aiSummaryStreamCursor(true);
  const cursor = aiSummaryStreamCursor();
  let insertAt = -1;
  for (const tag of STREAM_CURSOR_ANCHORS) {
    const idx = html.lastIndexOf(tag);
    if (idx > insertAt) insertAt = idx;
  }
  if (insertAt === -1) return html + cursor;
  return html.slice(0, insertAt) + cursor + html.slice(insertAt);
}

// ─── Markdown → HTML renderer ─────────────────────────────────────────────────
export function renderMarkdown(md) {
  const text = md.replace(/<br\s*\/?>/gi, "\n");
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function inline(raw) {
    return esc(raw)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<strong>$1</strong>")
      .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
      .replace(/_([^_\n]+)_/g, "<em>$1</em>");
  }

  function parseTableRow(line) {
    return line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  }

  function flushTable(tableLines, out) {
    if (!tableLines.length) return;
    const hasSep = tableLines.length >= 2 && /^\|[\s|:=-]+\|$/.test(tableLines[1].trim());
    if (!hasSep) {
      tableLines.forEach((l) => out.push(`<p class="md-p">${inline(l)}</p>`));
      tableLines.length = 0;
      return;
    }
    const headers = parseTableRow(tableLines[0]);
    let html = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
    headers.forEach((h) => { html += `<th>${inline(h)}</th>`; });
    html += "</tr></thead><tbody>";
    tableLines.slice(2).map(parseTableRow).forEach((row) => {
      html += "<tr>";
      for (let i = 0; i < headers.length; i++) html += `<td>${inline(row[i] ?? "")}</td>`;
      html += "</tr>";
    });
    html += "</tbody></table></div>";
    out.push(html);
    tableLines.length = 0;
  }

  const lines = text.split("\n");
  const out = [];
  let inCode = false, codeLines = [], listType = null;
  const tableLines = [];

  function closeList() {
    if (listType) { out.push(`</${listType}>`); listType = null; }
  }

  for (const line of lines) {
    if (/^```/.test(line)) {
      flushTable(tableLines, out);
      if (inCode) { out.push(`<pre><code>${esc(codeLines.join("\n"))}</code></pre>`); codeLines = []; inCode = false; }
      else { closeList(); inCode = true; }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    if (line.trim().startsWith("|")) { closeList(); tableLines.push(line); continue; }
    flushTable(tableLines, out);
    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) { closeList(); out.push(`<h${Math.min(hm[1].length + 2, 5)} class="md-h">${inline(hm[2])}</h${Math.min(hm[1].length + 2, 5)}>`); continue; }
    if (/^[-*_]{3,}$/.test(line.trim())) { closeList(); out.push('<hr class="md-hr">'); continue; }
    const ul = line.match(/^[ \t]*[-*+]\s+(.+)$/);
    if (ul) { if (listType !== "ul") { closeList(); out.push('<ul class="md-ul">'); listType = "ul"; } out.push(`<li>${inline(ul[1])}</li>`); continue; }
    const ol = line.match(/^[ \t]*\d+[.)]\s+(.+)$/);
    if (ol) { if (listType !== "ol") { closeList(); out.push('<ol class="md-ol">'); listType = "ol"; } out.push(`<li>${inline(ol[1])}</li>`); continue; }
    if (line.trim() === "") { closeList(); continue; }
    closeList();
    out.push(`<p class="md-p">${inline(line)}</p>`);
  }
  flushTable(tableLines, out);
  closeList();
  if (inCode && codeLines.length) out.push(`<pre><code>${esc(codeLines.join("\n"))}</code></pre>`);
  return out.join("");
}

// ─── Strip Markdown → plain text ─────────────────────────────────────────────
export function stripMarkdown(md) {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/```[\w]*\n?([\s\S]*?)```/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\|[\s|:=-]+\|$/gm, "")
    .replace(/^\|(.+)\|$/gm, (_, inner) => inner.split("|").map((c) => c.trim()).join("\t"))
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^[-*_]{3,}$/gm, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── File download helper ─────────────────────────────────────────────────────
export function downloadText(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function getSummaryFilename(query, ext) {
  const q = (query || "").replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "_").slice(0, 20).replace(/_+$/, "");
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return q ? `AI总结_${q}_${date}.${ext}` : `AI总结_${date}.${ext}`;
}

export function exportAsPdf(renderedHtml) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AI 总结</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:820px;margin:0 auto;padding:28px 32px;line-height:1.75;color:#222}
h3,h4,h5{margin:1em 0 .3em;font-weight:700}p{margin:.4em 0}
ul,ol{margin:.4em 0 .4em 1.4em}li{margin:.2em 0}
code{font-family:"Consolas","Menlo",monospace;background:rgba(0,0,0,.07);padding:.1em .32em;border-radius:3px;font-size:.9em}
pre{background:#f5f5f5;border:1px solid #ddd;padding:12px;border-radius:6px;overflow-x:auto}
pre code{background:none;padding:0}
table{border-collapse:collapse;width:100%;margin:.6em 0}
th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}
th{background:#f5f5f5;font-weight:600}
hr{border:none;border-top:1px solid #ddd;margin:1em 0}
strong{font-weight:700}em{font-style:italic}
@media print{body{padding:0}}</style></head>
<body>${renderedHtml}<script>window.onload=function(){window.print();}<\/script></body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
