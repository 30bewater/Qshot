import { AI_SUMMARY_SETTINGS_STORAGE_KEY } from "./storage-keys.js";
import {
  DEFAULT_AI_PROVIDER_ID,
  getAiProvider,
  getAiProviderList,
  getDefaultModelForProvider,
  getAiSummaryRequestExtras,
} from "./ai-providers.js";

export const DEFAULT_SUMMARY_PROMPT =
  "你是一个专业的信息整理助手。请基于下面多个 AI 模型的回答，输出结构化总结：" +
  "1. 核心结论 2. 共同观点 3. 分歧与互补 4. 可执行建议 5. 值得继续追问的问题。";

export const DEFAULT_SUMMARY_SETTINGS = {
  provider: DEFAULT_AI_PROVIDER_ID,
  apiKeys: {},
  models: {},
  customBaseUrls: {},
  promptGroups: [],
};

export function makePromptGroup(name = "默认总结", prompt = DEFAULT_SUMMARY_PROMPT) {
  return {
    id: `pg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    prompt,
  };
}

export function getPromptGroups(settings) {
  const groups = settings?.promptGroups;
  return Array.isArray(groups) && groups.length > 0 ? groups : [makePromptGroup()];
}

export function getPromptText(settings, groupId) {
  const groups = getPromptGroups(settings);
  const group = groupId ? groups.find((g) => g.id === groupId) : null;
  return (group || groups[0])?.prompt || DEFAULT_SUMMARY_PROMPT;
}

function normalizeAiSummarySettings(input) {
  const source = input && typeof input === "object" ? input : {};
  const provider = getAiProvider(source.provider)?.id || DEFAULT_AI_PROVIDER_ID;
  const apiKeys = { ...(source.apiKeys || {}) };
  const models = { ...(source.models || {}) };
  const customBaseUrls = { ...(source.customBaseUrls || {}) };

  // Backward compatibility with the first DeepSeek-only implementation.
  if (typeof source.apiKey === "string" && source.apiKey.trim() && !apiKeys.deepseek) {
    apiKeys.deepseek = source.apiKey.trim();
  }
  if (typeof source.model === "string" && source.model.trim() && !models.deepseek) {
    models.deepseek = source.model.trim();
  }
  if (typeof source.baseUrl === "string" && source.baseUrl.trim() && !customBaseUrls.custom) {
    customBaseUrls.custom = source.baseUrl.trim();
  }

  const providerIds = new Set([provider, DEFAULT_AI_PROVIDER_ID, ...Object.keys(apiKeys), ...Object.keys(models)]);
  for (const providerId of providerIds) {
    if (!models[providerId]) {
      models[providerId] = getDefaultModelForProvider(providerId);
    }
  }

  // Normalize promptGroups; migrate from legacy single-prompt field.
  let promptGroups;
  if (Array.isArray(source.promptGroups) && source.promptGroups.length > 0) {
    promptGroups = source.promptGroups.map((g, i) => ({
      id: String(g.id || `pg_${i}`),
      name: String(g.name || "").trim() || "默认总结",
      prompt: String(g.prompt || "").trim() || DEFAULT_SUMMARY_PROMPT,
    }));
  } else {
    const legacyPrompt = typeof source.prompt === "string" && source.prompt.trim()
      ? source.prompt.trim()
      : DEFAULT_SUMMARY_PROMPT;
    promptGroups = [{ id: "pg_default", name: "默认总结", prompt: legacyPrompt }];
  }

  return {
    ...DEFAULT_SUMMARY_SETTINGS,
    provider,
    apiKeys,
    models,
    customBaseUrls,
    promptGroups,
    prompt: promptGroups[0].prompt, // backward compat for _fetchOpenAICompatible
  };
}

export async function loadAiSummarySettings() {
  const stored = await chrome.storage.local.get(AI_SUMMARY_SETTINGS_STORAGE_KEY);
  return normalizeAiSummarySettings(stored[AI_SUMMARY_SETTINGS_STORAGE_KEY]);
}

export async function saveAiSummarySettings(settings) {
  await chrome.storage.local.set({
    [AI_SUMMARY_SETTINGS_STORAGE_KEY]: normalizeAiSummarySettings(settings),
  });
}

export function getProvidersWithApiKeys(settings) {
  return getAiProviderList().filter((p) =>
    String(settings?.apiKeys?.[p.id] || "").trim().length > 0
  );
}

export function getActiveAiSummaryProvider(settings) {
  return getAiProvider(settings?.provider);
}

export function getActiveAiSummaryApiKey(settings) {
  const providerId = getActiveAiSummaryProvider(settings).id;
  return String(settings?.apiKeys?.[providerId] || "").trim();
}

export function getActiveAiSummaryModel(settings) {
  const providerId = getActiveAiSummaryProvider(settings).id;
  return String(settings?.models?.[providerId] || getDefaultModelForProvider(providerId) || "").trim();
}

export function getActiveAiSummaryBaseUrl(settings) {
  const provider = getActiveAiSummaryProvider(settings);
  const override = String(settings?.customBaseUrls?.[provider.id] || "").trim();
  return override || provider.baseUrl || "";
}

/**
 * Build the prompt payload from extracted card responses.
 * Returns null when there is no useful content.
 */
export function buildSummaryInput(responses, query) {
  const valid = (responses || []).filter((r) => {
    const content = String(r?.content || "").trim();
    return content && content !== "暂未提取到内容";
  });
  if (valid.length === 0) return null;

  const parts = [];
  if (query) parts.push(`用户问题：${query}\n`);
  valid.forEach((r, i) => {
    const turns = Array.isArray(r.turns) && r.turns.length > 0
      ? r.turns.map((turn) => `${turn.role === "user" ? "User" : "AI"}: ${turn.text}`).join("\n\n")
      : r.content;
    parts.push(`=== 模型 ${i + 1}：${r.siteName} ===\nURL: ${r.url || ""}\n\n${turns}`);
  });
  return parts.join("\n\n");
}

export async function callAiSummary(settings, contentText) {
  const response = await _fetchOpenAICompatible(settings, contentText, false);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`${getActiveAiSummaryProvider(settings).label} 未返回有效内容。`);
  }
  return { content, truncated: data?.choices?.[0]?.finish_reason === "length" };
}

export async function* streamAiSummary(settings, contentText, signal) {
  const response = await _fetchOpenAICompatible(settings, contentText, true, signal);
  const reader = response.body?.getReader?.();
  if (!reader) {
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";
    if (content) yield content;
    if (data?.choices?.[0]?.finish_reason === "length") yield { truncated: true };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let truncated = false;
  let doneByMarker = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const raw = trimmed.slice(5).trim();
        if (raw === "[DONE]") {
          doneByMarker = true;
          break;
        }
        try {
          const parsed = JSON.parse(raw);
          const thinkingChunk = parsed.choices?.[0]?.delta?.reasoning_content;
          if (thinkingChunk) yield { thinking: thinkingChunk };
          const chunk = parsed.choices?.[0]?.delta?.content;
          if (chunk) yield chunk;
          if (parsed.choices?.[0]?.finish_reason === "length") truncated = true;
        } catch (_) {
          // Ignore malformed SSE chunks from provider gateways.
        }
      }
      if (doneByMarker) break;
    }
  } finally {
    reader.releaseLock();
  }

  if (truncated) yield { truncated: true };
}

// Backward-compatible aliases for any caller not yet migrated.
export const callDeepSeekSummary = callAiSummary;
export const streamDeepSeekSummary = streamAiSummary;

function joinChatCompletionsUrl(baseUrl) {
  return `${String(baseUrl || "").replace(/\/+$/, "")}/chat/completions`;
}

async function _fetchOpenAICompatible(settings, contentText, stream, signal) {
  const provider = getActiveAiSummaryProvider(settings);
  const apiKey = getActiveAiSummaryApiKey(settings);
  const model = getActiveAiSummaryModel(settings);
  const baseUrl = getActiveAiSummaryBaseUrl(settings);

  if (!apiKey) throw new Error(`请先填写 ${provider.label} API Key。`);
  if (!model) throw new Error(`请先选择或填写 ${provider.label} 模型名。`);
  if (!baseUrl) throw new Error(`请先填写 ${provider.label} Base URL。`);

  let response;
  try {
    const requestBody = {
      model,
      stream,
      max_tokens: 4000,
      messages: [
        { role: "system", content: settings?.prompt || DEFAULT_SUMMARY_PROMPT },
        { role: "user", content: contentText },
      ],
      ...getAiSummaryRequestExtras(provider.id, model),
    };
    response = await fetch(joinChatCompletionsUrl(baseUrl), {
      method: "POST",
      signal: signal || null,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error(`连接 ${provider.label} 失败：${err.message}`);
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      throw new Error(`${provider.label} API Key 无效或无权限（${status}），请检查 Key 是否正确。`);
    }
    if (status === 429) {
      throw new Error(`${provider.label} 请求过于频繁、余额不足或触发限流（429），请稍后重试。`);
    }
    let errMsg = `${provider.label} 返回错误 ${status}`;
    try {
      const errData = await response.json();
      if (errData?.error?.message) errMsg += `：${errData.error.message}`;
      else if (errData?.message) errMsg += `：${errData.message}`;
    } catch (_) {
      // Some gateways return non-JSON errors.
    }
    throw new Error(errMsg);
  }
  return response;
}
