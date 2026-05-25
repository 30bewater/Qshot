/** 设置页 / 对比页「添加站点」等选择器共用的 AI、社媒分组 */
export const AI_SITE_GROUPS = [
  {
    labelKey: "settings_groups_aiDomestic",
    label: "国内",
    siteIds: ["deepseek", "doubao", "kimi", "yuanbao", "qianwen", "qwen", "chatglm", "zai", "metaso", "zhida", "dots", "xiaomimimo"],
  },
  {
    labelKey: "settings_groups_aiOverseas",
    label: "国外",
    siteIds: ["gemini", "chatgpt", "claude", "grok", "copilot", "monica", "poe", "perplexity"],
  },
];

export const SOCIAL_SITE_GROUPS = [
  { labelKey: "settings_groups_socialDomestic", label: "国内", siteIds: ["xiaohongshu", "bilibili", "zhihu", "douyin"] },
  { labelKey: "settings_groups_socialOverseas", label: "海外", siteIds: ["twitter", "youtube", "reddit", "tiktok"] },
];
