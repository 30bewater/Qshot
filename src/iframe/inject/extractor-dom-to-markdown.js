/**
 * extractor-dom-to-markdown.js
 * Single pure function: convert a DOM element to a Markdown string.
 * No imports, no side effects — safe to use in any extractor sub-module.
 */

export function domToMarkdown(element) {
  function convertNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.tagName.toLowerCase();
    if (["script", "style", "noscript", "button", "svg", "aside"].includes(tag)) return "";

    const children = () => Array.from(node.childNodes).map(convertNode).join("");

    switch (tag) {
      case "h1": return `\n\n# ${children().trim()}\n\n`;
      case "h2": return `\n\n## ${children().trim()}\n\n`;
      case "h3": return `\n\n### ${children().trim()}\n\n`;
      case "h4": return `\n\n#### ${children().trim()}\n\n`;
      case "h5": return `\n\n##### ${children().trim()}\n\n`;
      case "h6": return `\n\n###### ${children().trim()}\n\n`;
      case "p": {
        const inner = children().trim();
        return inner ? `\n\n${inner}\n\n` : "";
      }
      case "br": return "  \n";
      case "hr": return "\n\n---\n\n";
      case "strong":
      case "b": {
        const inner = children().trim();
        return inner ? `**${inner}**` : "";
      }
      case "em":
      case "i": {
        const inner = children().trim();
        return inner ? `*${inner}*` : "";
      }
      case "del":
      case "s": {
        const inner = children().trim();
        return inner ? `~~${inner}~~` : "";
      }
      case "code": {
        if (node.parentElement && node.parentElement.tagName.toLowerCase() === "pre") {
          return node.textContent || "";
        }
        const inner = children().trim();
        return inner ? `\`${inner}\`` : "";
      }
      case "pre": {
        const codeEl = node.querySelector("code");
        let lang = "";
        if (codeEl) {
          const classMatch = codeEl.className.match(/language-(\w+)/);
          if (classMatch) lang = classMatch[1];
        }
        const content = (codeEl || node).textContent || "";
        return `\n\n\`\`\`${lang}\n${content.trim()}\n\`\`\`\n\n`;
      }
      case "blockquote": {
        const inner = children().trim().split("\n").map((line) => `> ${line}`).join("\n");
        return `\n\n${inner}\n\n`;
      }
      case "ul": {
        const liEls = Array.from(node.querySelectorAll("li")).filter(
          (el) => el.closest("ul") === node || el.closest("ol") === node
        );
        const items = liEls
          .map((li) => {
            const text = convertNode(li).trim();
            return `- ${text.replace(/\n/g, "\n  ")}`;
          })
          .join("\n");
        return items ? `\n\n${items}\n\n` : "";
      }
      case "ol": {
        const liEls = Array.from(node.querySelectorAll("li")).filter(
          (el) => el.closest("ul") === node || el.closest("ol") === node
        );
        const items = liEls
          .map((li, idx) => {
            const text = convertNode(li).trim();
            return `${idx + 1}. ${text.replace(/\n/g, "\n   ")}`;
          })
          .join("\n");
        return items ? `\n\n${items}\n\n` : "";
      }
      case "li": {
        const inner = children().trim();
        return inner.replace(/\n{3,}/g, "\n\n");
      }
      case "div":
      case "section":
      case "article":
      case "figure":
      case "figcaption":
      case "details":
      case "summary": {
        const inner = children().trim();
        return inner ? `\n\n${inner}\n\n` : "";
      }
      case "a": {
        const href = (node.getAttribute("href") || "").trim();
        const text = children().trim();
        if (!text) return "";
        if (!href || href.startsWith("#") || href === text) return text;
        return `[${text}](${href})`;
      }
      case "img": {
        const alt = node.getAttribute("alt") || "";
        return alt ? `[图片: ${alt}]` : "";
      }
      case "table": return convertTable(node);
      default: return children();
    }
  }

  function convertTable(tableEl) {
    const allRows = Array.from(tableEl.querySelectorAll("tr"));
    if (!allRows.length) return "";
    const data = allRows
      .map((row) =>
        Array.from(row.querySelectorAll("th, td")).map((cell) =>
          (cell.innerText || cell.textContent || "").trim().replace(/\|/g, "\\|").replace(/\n/g, " ")
        )
      )
      .filter((row) => row.length > 0);
    if (!data.length) return "";
    const colCount = Math.max(...data.map((r) => r.length));
    const normalized = data.map((row) => {
      while (row.length < colCount) row.push("");
      return row;
    });
    const sep = Array(colCount).fill("---");
    const lines = [
      `| ${normalized[0].join(" | ")} |`,
      `| ${sep.join(" | ")} |`,
      ...normalized.slice(1).map((row) => `| ${row.join(" | ")} |`),
    ];
    return `\n\n${lines.join("\n")}\n\n`;
  }

  return convertNode(element).replace(/\n{3,}/g, "\n\n").trim();
}
