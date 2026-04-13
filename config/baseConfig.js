(function initBaseConfig() {
  const config = {
    appName: "AI 批量搜索 MVP",
    defaultColumns: 1,
    embedTimeoutMs: 8000,
    postLoadSendDelayMs: 250,
    tabSendRetryCount: 6,
    tabSendRetryDelayMs: 350,
    debug: true
  };

  globalThis.AI_COMPARE_BASE_CONFIG = config;
})();
