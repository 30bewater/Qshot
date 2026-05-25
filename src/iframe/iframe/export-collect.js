import { state } from "./state.js";
import { createRequestId } from "./utils.js";
import { MSG } from "../../shared/compare-protocol.js";

const EXTRACT_TIMEOUT_MS = 2500;

export async function quickCaptureAllResponses() {
  const CAPTURE_TIMEOUT = 3000;
  const promises = [];
  for (const [, ref] of state.cardRefs.entries()) {
    const p = Promise.race([
      collectResponseForSite(ref),
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              siteName: ref.site.name,
              content: "暂未提取到内容",
              turns: null,
              url: ref.currentUrl || ref.site.url
            }),
          CAPTURE_TIMEOUT
        )
      )
    ]);
    promises.push(p);
  }
  return Promise.all(promises);
}

export async function collectVisibleResponses(selectedSiteIds = null) {
  const refs = Array.from(state.cardRefs.entries())
    .filter(([siteId]) => !selectedSiteIds || selectedSiteIds.has(siteId))
    .map(([, ref]) => ref);

  return Promise.all(refs.map((ref) => collectResponseForSite(ref)));
}

export async function collectResponseForSite(ref) {
  if (!ref.iframeEl) {
    return {
      siteName: ref.site.name,
      content: "暂未提取到内容",
      turns: null,
      url: ref.currentUrl || ref.site.url
    };
  }

  const response = await requestIframeContent(ref.iframeEl, ref.site);
  if (response.content && response.content !== "暂未提取到内容") {
    return response;
  }

  return {
    ...response,
    content: extractFallbackContent(ref)
  };
}

export function extractFallbackContent(ref) {
  if (!ref || !ref.bodyEl) {
    return "暂未提取到内容";
  }

  const fallbackPanel = ref.bodyEl.querySelector(".fallback-panel");
  if (fallbackPanel) {
    return String(fallbackPanel.textContent || "暂未提取到内容").trim() || "暂未提取到内容";
  }

  return ref.statusEl?.textContent?.trim() || "暂未提取到内容";
}

export function requestIframeContent(iframe, site) {
  return new Promise((resolve) => {
    const requestId = createRequestId();
    let completed = false;
    let timeoutId = null;
    // Review note (CWS/Edge Add-ons):
    // - We only request readable text from the card iframe when the user triggers Export/Summary actions.
    // - We bind replies to the specific iframe via event.source to prevent other iframes from spoofing responses and polluting exported content.
    // 在闭包里快照 contentWindow，后续 event 校验一律对照这个快照做来源判定。
    // 为什么不在 handler 里每次读 iframe.contentWindow：iframe 被 detach 后它会变 null，
    // 那样任何 event.source 都会 !== null 而通过校验，反而变成"零校验"。
    const expectedWindow = iframe.contentWindow;

    const finish = (result) => {
      if (completed) {
        return;
      }
      completed = true;
      window.removeEventListener("message", handler);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      resolve(result);
    };

    const handler = (event) => {
      // ── 安全校验：只接受来自本次提取目标 iframe 的回执 ──
      // requestId 是 UUID/随机串，单靠它虽然攻击者难猜，但同页面里其它卡片/广告 iframe
      // 仍然可能监听到消息模式后向本对比页发伪造的 QSHOT_EXTRACT_RESULT，
      // 从而把导出 / 剪贴板 / 摘要里的内容替换成攻击者写的字符串。
      // 加 event.source 白名单后，即便攻击者抢先回消息，也会因 source 不匹配被丢弃。
      if (event.source !== expectedWindow) return;
      if (!event.data || event.data.type !== MSG.EXTRACT_RESULT || event.data.requestId !== requestId) {
        return;
      }

      finish({
        siteName: site.name,
        content: cleanExtractedContent(event.data.content || ""),
        turns: Array.isArray(event.data.turns) ? event.data.turns : null,
        url: event.data.url || site.url
      });
    };

    window.addEventListener("message", handler);

    try {
      // 站点 iframe 经常会跨 origin 重定向（例如入口域名跳到登录/对话域名）。
      // 使用 "*" 避免 targetOrigin 过期导致消息被静默丢弃；回包仍用 event.source + requestId 校验。
      const targetOrigin = "*";
      iframe.contentWindow.postMessage({
        type: MSG.EXTRACT,
        requestId,
        site,
        // 传入最近一次搜索词，inject.js 可在 turns 完全为空时用作 user turn 回退标签
        query: state.lastSearchQuery || ""
      }, targetOrigin);
    } catch (_error) {
      finish({
        siteName: site.name,
        content: "暂未提取到内容",
        turns: null,
        url: site.url
      });
      return;
    }

    timeoutId = window.setTimeout(() => {
      finish({
        siteName: site.name,
        content: "暂未提取到内容",
        turns: null,
        url: site.url
      });
    }, EXTRACT_TIMEOUT_MS);
  });
}

export function buildExportFilename(extension) {
  const query = state.lastSearchQuery || state.searchHistory[0]?.query || "";
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  if (!query) {
    return `AI导出_${date}.${extension}`;
  }

  const keyword = query
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 16)
    .trim()
    .replace(/\s/g, "-");

  return `${keyword}_${date}.${extension}`;
}

export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function cleanExtractedContent(content) {
  const text = String(content || "").trim();
  if (!text) {
    return "暂未提取到内容";
  }

  const junkPattern = /window\.__|\brequestAnimationFrame\b|function\s*\(|'use strict'|"use strict"|theme-host|__webpack|__NEXT_DATA__|gtag\(|ga\(/i;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => !junkPattern.test(line))
    .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""));

  const result = lines.join("\n").trim();
  return result || text.slice(0, 6000) || "暂未提取到内容";
}
