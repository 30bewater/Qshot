// 父页（聚合视图）侧的"文件直接派发到各 AI 卡片"逻辑。
//
// 设计取舍：用户一旦选好文件就立刻把 Blob postMessage 到所有已加载的 iframe，
// content script 在每个站点的输入框里合成 paste 事件触发站点自己的"粘贴上传"。
// 这种"上传与提交解耦"的形态对比"合并发送"有几点好处：
//   1) 文件上传过程对用户可见（每张卡片输入框上方出现附件 chip），可视化反馈强；
//   2) 上传完全异步，等用户输完文本点发送时，文件多半已经传完，发送按钮亮就能直接
//      点，不再需要"先 paste 再 setValue 再 wait→submit"那条容易误触 Enter 兜底的
//      合并路径；
//   3) 没传完的卡片也不影响其他卡片——发送按钮天然 disable，等上传完才会亮。
//
// 还没加载完的卡片（loadingRefs 里的）会把这一批文件挂在 ref.pendingFilesOnLoad 上，
// iframe 加载事件里再补发一次。

import { state, elements } from "./state.js";
import { setGlobalStatus, setSiteStatus } from "./status.js";
import { createRequestId } from "./utils.js";
import { diagnosticLog } from "../../shared/diagnostics.js";
import { MSG } from "../../shared/compare-protocol.js";

// 单文件体积上限：postMessage 结构化克隆 + N 张卡片各持一份，需要给内存留余量。
const MAX_FILE_SIZE = 25 * 1024 * 1024;
// 每次选取最多接受的文件数量。
const MAX_FILES_PER_PICK = 8;
const FILE_ACK_TIMEOUT_MS = 10000;

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// File → 可结构化克隆的 entry 对象。同时带上 name/type/size，inject 侧重建 File
// 时不依赖 File 自身在跨上下文克隆后是否仍保留这些字段。
async function fileToEntry(file) {
  // 用 ArrayBuffer 做一次显式拷贝再 wrap 回 Blob：原始 File 在某些浏览器版本里
  // 跨 origin 结构化克隆后会丢 name；我们已经把 name 单独挂在外层 entry 上，
  // 内层 blob 只保留二进制本体即可。
  const arrayBuffer = await file.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: file.type || "application/octet-stream" });
  return {
    blob,
    name: file.name || `file-${Date.now()}`,
    type: file.type || "application/octet-stream",
    size: file.size,
    lastModified: file.lastModified || Date.now()
  };
}

// 给单个卡片派发一批文件。已加载就直接 postMessage；未加载就挂起，等卡片 load
// 事件触发时再调用 dispatchPendingFilesForCard。
function dispatchFilesToCard(ref, entries) {
  if (!ref || !ref.iframeEl) {
    return { accepted: false, queued: false, ackPromise: null };
  }
  if (entries.length === 0) {
    return { accepted: false, queued: false, ackPromise: null };
  }

  if (!ref.loaded || !ref.iframeEl.contentWindow) {
    if (!Array.isArray(ref.pendingFilesOnLoad)) {
      ref.pendingFilesOnLoad = [];
    }
    ref.pendingFilesOnLoad.push(...entries);
    diagnosticLog("compare.files", "queued-for-load", {
      site: ref.site,
      fileCount: entries.length,
    });
    setSiteStatus(ref.site.id, "卡片尚未加载完成，文件已排队，稍后自动发送...");
    return { accepted: true, queued: true, ackPromise: null };
  }

  const requestId = createRequestId();
  const ackPromise = new Promise((resolve) => {
    const timerId = window.setTimeout(() => {
      state.pendingFileDispatches.delete(requestId);
      setSiteStatus(ref.site.id, "文件发送超时，未收到卡片确认。", "error");
      resolve({
        ok: false,
        siteId: ref.site.id,
        requestId,
        error: "文件发送超时，未收到卡片确认。"
      });
    }, FILE_ACK_TIMEOUT_MS);

    state.pendingFileDispatches.set(requestId, {
      siteId: ref.site.id,
      timerId,
      resolve
    });
  });

  try {
    ref.iframeEl.contentWindow.postMessage(
      {
        type: MSG.PASTE_FILES,
        files: entries,
        site: ref.site,
        requestId,
      },
      "*"
    );
    diagnosticLog("compare.files", "post-message", {
      site: ref.site,
      requestId,
      fileCount: entries.length,
    });
    setSiteStatus(ref.site.id, "文件已发送，等待站点确认接收...");
    return { accepted: true, queued: false, ackPromise };
  } catch (error) {
    const pending = state.pendingFileDispatches.get(requestId);
    if (pending?.timerId) {
      window.clearTimeout(pending.timerId);
    }
    state.pendingFileDispatches.delete(requestId);
    diagnosticLog("compare.files", "post-message-error", {
      site: ref.site,
      error: error.message,
    });
    setSiteStatus(ref.site.id, error.message || "文件发送失败。", "error");
    return {
      accepted: false,
      queued: false,
      ackPromise: Promise.resolve({
        ok: false,
        siteId: ref.site.id,
        requestId,
        error: error.message || "文件发送失败。"
      })
    };
  }
}

// 卡片 iframe 加载完成时被 cards-render.js 调用，把入队期间堆积的文件补发出去。
export function dispatchPendingFilesForCard(ref) {
  if (!ref || !Array.isArray(ref.pendingFilesOnLoad) || ref.pendingFilesOnLoad.length === 0) {
    return;
  }
  const entries = ref.pendingFilesOnLoad;
  ref.pendingFilesOnLoad = [];
  dispatchFilesToCard(ref, entries);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ingestFileList(fileList) {
  if (!fileList) return;
  const incoming = Array.from(fileList).slice(0, MAX_FILES_PER_PICK);
  if (incoming.length === 0) return;

  const entries = [];
  for (const file of incoming) {
    if (!(file instanceof File)) continue;
    if (file.size > MAX_FILE_SIZE) {
      window.alert(`文件 "${file.name}" 超过 ${MAX_FILE_SIZE / (1024 * 1024)}MB 上限，已跳过。`);
      continue;
    }
    try {
      entries.push(await fileToEntry(file));
    } catch (error) {
      diagnosticLog("compare.files", "read-failed", { name: file.name, error: error.message });
    }
  }

  if (entries.length === 0) return;

  // ★ 顺序串行派发，绝不并行 ★
  //
  // 浏览器同一时刻只允许一个 frame 持有 document focus。如果我们对所有 iframe
  // 同时 postMessage，N 个 inject 会同时调 element.focus()，互相抢焦点，导致除
  // 了某一个"运气好"的（实测是 Kimi / 腾讯元宝）以外，其他卡片的 focus 不
  // 生效，paste 事件派发到 body 上而不是真正的输入框节点。
  //
  // 串行化让每张卡片在自己的窗口期里完成 focus → wait → paste 的整套流程，避免
  // 焦点抢夺；docs《多 AI 站点统一文件上传：技术路线分析》5.4 节也明确提到这
  // 一约束。1200ms 间隔留给 inject 侧的 focus + 200ms wait + paste + 上传请求
  // 发出，再切下一张卡，整体 N 张卡片大约 1.2N 秒完成分发。
  const totalSize = entries.reduce((sum, e) => sum + (e.size || 0), 0);
  const targets = [];
  state.cardRefs.forEach((ref) => {
    if (state.hiddenSiteIds.has(ref.site.id)) return;
    targets.push(ref);
  });

  setGlobalStatus(
    `准备把 ${entries.length} 个文件（${formatSize(totalSize)}）依次发送到 ${targets.length} 个 AI 卡片...`
  );

  let dispatchedCount = 0;
  let queuedCount = 0;
  for (let i = 0; i < targets.length; i += 1) {
    const ref = targets[i];
    setGlobalStatus(
      `正在向第 ${i + 1}/${targets.length} 个卡片（${ref.site.name || ref.site.id}）发送文件...`
    );
    const result = dispatchFilesToCard(ref, entries);
    if (result.accepted) {
      dispatchedCount += 1;
    }
    if (result.queued) {
      queuedCount += 1;
    }
    // 给 inject 侧 focus + 200ms wait + paste + 上传初始化的时间，再切下一张卡。
    if (i < targets.length - 1) {
      await delay(1200);
    }
  }

  setGlobalStatus(
    `已开始向 ${dispatchedCount} 个 AI 卡片发送 ${entries.length} 个文件（${formatSize(totalSize)}），` +
      (queuedCount > 0
        ? `${queuedCount} 个卡片待加载后自动补发，请等待各卡片确认上传。`
        : "请等待各卡片确认上传后再提交问题。")
  );
}

export function bindFileUploadEvents() {
  const btn = elements.fileUploadBtn;
  const input = elements.fileUploadInput;
  const textarea = elements.queryInput;
  if (!btn || !input) return;

  btn.addEventListener("click", () => {
    input.click();
  });

  input.addEventListener("change", async () => {
    await ingestFileList(input.files);
    input.value = "";
  });

  // 直接把文件拖 / 粘贴到输入框：相同的"立即派发"语义。
  if (textarea) {
    textarea.addEventListener("paste", (event) => {
      const files = event.clipboardData?.files;
      if (files && files.length > 0) {
        event.preventDefault();
        ingestFileList(files);
      }
    });

    textarea.addEventListener("dragover", (event) => {
      if (event.dataTransfer && Array.from(event.dataTransfer.types || []).includes("Files")) {
        event.preventDefault();
      }
    });

    textarea.addEventListener("drop", (event) => {
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        event.preventDefault();
        ingestFileList(files);
      }
    });
  }
}

// 兼容旧入口：以前 main.js / send.js 会调 renderFilePreviewBar，现在没有 chip
// 预览条了，导出成 noop 让上游不用改 import。
export function renderFilePreviewBar() {
  // intentionally empty
}
