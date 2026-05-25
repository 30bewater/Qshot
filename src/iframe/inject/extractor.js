/**
 * extractor.js — public entry point for content extraction.
 *
 * Sub-modules:
 *   extractor-dom-to-markdown.js   — DOM → Markdown converter
 *   extractor-site-selectors.js    — page-text extraction (site + generic)
 *   extractor-conversation.js      — conversation turns (API / window-state / DOM)
 */

import { EXTENSION_ORIGIN } from "./constants.js";
import { MSG } from "../../shared/compare-protocol.js";
import { extractReadablePageText } from "./extractor-site-selectors.js";
import { extractTurnsWithFallback } from "./extractor-conversation.js";

// Review note (CWS/Edge Add-ons): extraction is only used for user-visible
// export/summary features triggered from the extension page. Extracted text
// is postMessage'd back to the extension compare page only; no upload.
export async function handleExtractRequest(message) {
  const host = window.location.hostname.replace(/^www\./, "");
  const targetOrigin = EXTENSION_ORIGIN || "*";
  try {
    const [content, rawTurns] = await Promise.all([
      Promise.resolve(extractReadablePageText()),
      extractTurnsWithFallback(host),
    ]);

    // If turns have assistant content but no user turn, and the caller passed a
    // query, prepend a synthetic user turn so export labels are still useful.
    let turns = rawTurns;
    const query = String(message.query || "").trim();
    if (query && turns && turns.length > 0 && !turns.some((t) => t.role === "user")) {
      turns = [{ role: "user", text: query }, ...turns];
    }

    window.parent.postMessage(
      {
        type: MSG.EXTRACT_RESULT,
        requestId: message.requestId,
        siteId: message.site?.id,
        content,
        turns,
        url: window.location.href,
      },
      targetOrigin
    );
  } catch (_err) {
    // Any async error takes the sync fallback so postMessage is guaranteed.
    window.parent.postMessage(
      {
        type: MSG.EXTRACT_RESULT,
        requestId: message.requestId,
        siteId: message.site?.id,
        content: extractReadablePageText(),
        turns: null,
        url: window.location.href,
      },
      targetOrigin
    );
  }
}
