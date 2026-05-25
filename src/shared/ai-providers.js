export const AI_PROVIDER_KIND_OPENAI_COMPATIBLE = "openai-compatible";

export const AI_PROVIDERS = {
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    kind: AI_PROVIDER_KIND_OPENAI_COMPATIBLE,
    baseUrl: "https://api.deepseek.com",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    docsUrl: "https://api-docs.deepseek.com/",
    defaultModel: "deepseek-v4-flash",
    models: [
      { value: "deepseek-v4-flash", label: "deepseek-v4-flash" },
      { value: "deepseek-v4-pro", label: "deepseek-v4-pro" },
      { value: "deepseek-chat", label: "deepseek-chat (legacy)" },
      { value: "deepseek-reasoner", label: "deepseek-reasoner (legacy)" },
    ],
  },
  kimi: {
    id: "kimi",
    label: "Kimi / Moonshot",
    kind: AI_PROVIDER_KIND_OPENAI_COMPATIBLE,
    baseUrl: "https://api.moonshot.cn/v1",
    apiKeyUrl: "https://platform.kimi.com/console/api-keys",
    docsUrl: "https://platform.moonshot.ai/docs/models",
    defaultModel: "kimi-k2.6",
    models: [
      { value: "kimi-k2.6", label: "kimi-k2.6" },
      { value: "kimi-k2.5", label: "kimi-k2.5" },
      { value: "moonshot-v1-8k", label: "moonshot-v1-8k" },
      { value: "moonshot-v1-32k", label: "moonshot-v1-32k" },
      { value: "moonshot-v1-128k", label: "moonshot-v1-128k" },
      { value: "moonshot-v1-8k-vision-preview", label: "moonshot-v1-8k-vision-preview" },
      { value: "moonshot-v1-32k-vision-preview", label: "moonshot-v1-32k-vision-preview" },
      { value: "moonshot-v1-128k-vision-preview", label: "moonshot-v1-128k-vision-preview" },
    ],
  },
  zhipu: {
    id: "zhipu",
    label: "Zhipu GLM",
    kind: AI_PROVIDER_KIND_OPENAI_COMPATIBLE,
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    apiKeyUrl: "https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
    docsUrl: "https://docs.bigmodel.cn/cn/guide/models/text/glm-4.7",
    defaultModel: "glm-4.7",
    models: [
      { value: "glm-4.7", label: "glm-4.7" },
      { value: "glm-4.7-flash", label: "glm-4.7-flash" },
      { value: "glm-4.6", label: "glm-4.6" },
      { value: "glm-4.5", label: "glm-4.5" },
      { value: "glm-4.5-air", label: "glm-4.5-air" },
      { value: "glm-4.5-flash", label: "glm-4.5-flash" },
      { value: "glm-5", label: "glm-5" },
      { value: "glm-5.1", label: "glm-5.1" },
      { value: "glm-4-flash", label: "glm-4-flash (legacy)" },
    ],
  },
  qwen: {
    id: "qwen",
    label: "Qwen / DashScope",
    kind: AI_PROVIDER_KIND_OPENAI_COMPATIBLE,
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKeyUrl: "https://bailian.console.aliyun.com/?tab=model#/api-key",
    docsUrl: "https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope",
    defaultModel: "qwen3.5-plus",
    models: [
      { value: "qwen3.5-plus", label: "qwen3.5-plus" },
      { value: "qwen3.5-flash", label: "qwen3.5-flash" },
      { value: "qwen3-max", label: "qwen3-max" },
      { value: "qwen-plus", label: "qwen-plus" },
      { value: "qwen-flash", label: "qwen-flash" },
      { value: "qwen3-coder-plus", label: "qwen3-coder-plus" },
      { value: "qwen3-coder-flash", label: "qwen3-coder-flash" },
      { value: "qwen-max", label: "qwen-max (legacy)" },
      { value: "qwen-turbo", label: "qwen-turbo (legacy)" },
    ],
  },
  minimax: {
    id: "minimax",
    label: "MiniMax",
    kind: AI_PROVIDER_KIND_OPENAI_COMPATIBLE,
    baseUrl: "https://api.minimaxi.com/v1",
    apiKeyUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    docsUrl: "https://platform.minimaxi.com/docs/api-reference/text-openai-api",
    defaultModel: "MiniMax-M2.5",
    models: [
      { value: "MiniMax-M2.7", label: "MiniMax-M2.7" },
      { value: "MiniMax-M2.7-highspeed", label: "MiniMax-M2.7-highspeed" },
      { value: "MiniMax-M2.5", label: "MiniMax-M2.5" },
      { value: "MiniMax-M2.5-highspeed", label: "MiniMax-M2.5-highspeed" },
      { value: "MiniMax-M2.1", label: "MiniMax-M2.1" },
      { value: "MiniMax-M2.1-highspeed", label: "MiniMax-M2.1-highspeed" },
      { value: "MiniMax-M2", label: "MiniMax-M2" },
    ],
    allowBaseUrlOverride: true,
  },
  siliconflow: {
    id: "siliconflow",
    label: "SiliconFlow",
    kind: AI_PROVIDER_KIND_OPENAI_COMPATIBLE,
    baseUrl: "https://api.siliconflow.cn/v1",
    apiKeyUrl: "https://cloud.siliconflow.cn/account/ak",
    docsUrl: "https://docs.siliconflow.cn/",
    defaultModel: "deepseek-ai/DeepSeek-V4-Flash",
    models: [
      { value: "deepseek-ai/DeepSeek-V4-Flash", label: "DeepSeek-V4-Flash" },
      { value: "Pro/deepseek-ai/DeepSeek-V4-Flash", label: "Pro/DeepSeek-V4-Flash" },
      { value: "deepseek-ai/DeepSeek-V4-Pro", label: "DeepSeek-V4-Pro" },
      { value: "Pro/deepseek-ai/DeepSeek-V4-Pro", label: "Pro/DeepSeek-V4-Pro" },
      { value: "Pro/zai-org/GLM-5", label: "GLM-5" },
      { value: "Pro/zai-org/GLM-4.7", label: "GLM-4.7" },
      { value: "zai-org/GLM-4.6", label: "GLM-4.6" },
      { value: "deepseek-ai/DeepSeek-V3.2", label: "DeepSeek-V3.2" },
      { value: "Pro/deepseek-ai/DeepSeek-V3.2", label: "Pro/DeepSeek-V3.2" },
      { value: "deepseek-ai/DeepSeek-R1", label: "DeepSeek-R1" },
      { value: "Pro/deepseek-ai/DeepSeek-R1", label: "Pro/DeepSeek-R1" },
      { value: "Qwen/Qwen3.5-397B-A17B", label: "Qwen3.5-397B-A17B" },
      { value: "Qwen/Qwen3.5-122B-A10B", label: "Qwen3.5-122B-A10B" },
      { value: "Qwen/Qwen3.5-35B-A3B", label: "Qwen3.5-35B-A3B" },
      { value: "Qwen/Qwen3.5-27B", label: "Qwen3.5-27B" },
      { value: "Qwen/Qwen3-32B", label: "Qwen3-32B" },
      { value: "Qwen/Qwen3-14B", label: "Qwen3-14B" },
      { value: "Qwen/Qwen3-8B", label: "Qwen3-8B" },
    ],
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    kind: AI_PROVIDER_KIND_OPENAI_COMPATIBLE,
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyUrl: "https://openrouter.ai/settings/keys",
    docsUrl: "https://openrouter.ai/models",
    defaultModel: "deepseek/deepseek-v4-flash",
    models: [
      { value: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash" },
      { value: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro" },
      { value: "moonshotai/kimi-k2.6", label: "Kimi K2.6" },
      { value: "z-ai/glm-4.7", label: "GLM-4.7" },
      { value: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
      { value: "anthropic/claude-opus-4.7", label: "Claude Opus 4.7" },
      { value: "openai/gpt-5-mini", label: "GPT-5 mini" },
      { value: "openai/gpt-5", label: "GPT-5" },
      { value: "google/gemini-2.5-flash-preview", label: "Gemini 2.5 Flash" },
    ],
  },
  custom: {
    id: "custom",
    label: "Custom OpenAI-compatible",
    kind: AI_PROVIDER_KIND_OPENAI_COMPATIBLE,
    baseUrl: "",
    apiKeyUrl: "",
    docsUrl: "",
    defaultModel: "",
    models: [],
    allowCustomBaseUrl: true,
    allowCustomModel: true,
  },
};

export const DEFAULT_AI_PROVIDER_ID = "deepseek";

export function getAiProvider(providerId) {
  return AI_PROVIDERS[providerId] || AI_PROVIDERS[DEFAULT_AI_PROVIDER_ID];
}

export function getAiProviderList() {
  return Object.values(AI_PROVIDERS);
}

export function getDefaultModelForProvider(providerId) {
  const provider = getAiProvider(providerId);
  return provider.defaultModel || provider.models?.[0]?.value || "";
}

function isZhipuThinkingModel(modelId) {
  return /^glm-(4\.(5|6|7)|5)/.test(modelId);
}

function isMinimaxM2Model(modelId) {
  return /^minimax-m2/.test(modelId);
}

/**
 * Provider/model-specific chat/completions extras for AI summary requests.
 * Some models reject custom temperature or require thinking to be disabled.
 */
export function getAiSummaryRequestExtras(providerId, model) {
  const modelId = String(model || "").trim().toLowerCase();

  if (providerId === "kimi" && modelId.startsWith("kimi-k2")) {
    return { thinking: { type: "disabled" } };
  }

  if (providerId === "zhipu" && isZhipuThinkingModel(modelId)) {
    return { thinking: { type: "disabled" } };
  }

  if (providerId === "minimax" && isMinimaxM2Model(modelId)) {
    return { temperature: 1.0 };
  }

  return { temperature: 0.2 };
}
