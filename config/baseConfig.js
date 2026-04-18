(function initBaseConfig() {
  const config = {
    appName: "AI 批量搜索 MVP",
    defaultColumns: 1,
    // 单个 iframe 认定加载失败的超时。重型 SPA（DeepSeek/Kimi/Gemini）冷启动偶尔会接近 20s，
    // 放宽到 25s 以避免误判为「加载失败」。
    embedTimeoutMs: 25000,
    // iframe 加载完成后立即发送查询，不再人为等待
    postLoadSendDelayMs: 0,
    tabSendRetryCount: 3,
    tabSendRetryDelayMs: 12000,
    // 错峰加载：多站点场景下每个 iframe 之间的 src 赋值间隔（ms）。
    // 避免 6~8 个重型 SPA 同时初始化导致白屏。
    iframeStaggerMs: 120,
    debug: true
  };

  globalThis.AI_COMPARE_BASE_CONFIG = config;
})();
