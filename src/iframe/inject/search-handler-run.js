/**
 * search-handler-run.js
 * Run searchHandler chain: primary → fallback → generic auto-backup.
 */

import { executeSiteHandler } from "./executor.js";
import { diagnosticLog } from "../../shared/diagnostics.js";
import {
  collectHandlerChain,
  errorIndicatesSubmitPhase,
  HANDLER_ERROR_CODE,
  isFatalHandlerError,
  resolveHandlerErrorCode,
} from "../../shared/handler-fallback.js";

/**
 * @param {string} query
 * @param {object} site
 * @returns {Promise<{ ok: boolean, siteId?: string, message?: string, error?: string, errorCode?: string, handlerId?: string, currentUrl?: string }>}
 */
export async function runSearchHandlerChain(query, site) {
  const chain = collectHandlerChain(site);
  if (chain.length === 0) {
    return {
      ok: false,
      siteId: site?.id,
      error: "无效的站点处理器配置",
      errorCode: HANDLER_ERROR_CODE.FATAL,
    };
  }

  const attempts = [];
  let lastError = "所有发送规则均失败";

  for (const entry of chain) {
    try {
      diagnosticLog("inject.search", "handler-chain-attempt", {
        siteId: site?.id,
        handlerId: entry.id,
      });
      await executeSiteHandler(query, entry.config);
      const message = entry.id === "primary"
        ? "已在当前卡片中尝试写入查询并触发发送"
        : `已通过备选规则（${entry.id}）写入并触发发送`;
      return {
        ok: true,
        siteId: site.id,
        message,
        handlerId: entry.id,
        currentUrl: window.location.href,
      };
    } catch (error) {
      const errorMessage = error?.message || "发送失败";
      attempts.push({
        id: entry.id,
        ok: false,
        error: errorMessage,
        reachedSubmit: errorIndicatesSubmitPhase(errorMessage),
      });
      lastError = errorMessage;
      diagnosticLog("inject.search", "handler-chain-failed", {
        siteId: site?.id,
        handlerId: entry.id,
        error: errorMessage,
      });
      if (isFatalHandlerError(errorMessage)) {
        break;
      }
    }
  }

  const errorCode = resolveHandlerErrorCode(attempts);
  return {
    ok: false,
    siteId: site?.id,
    error: lastError,
    errorCode,
    handlerAttempts: attempts.map((item) => item.id),
  };
}
