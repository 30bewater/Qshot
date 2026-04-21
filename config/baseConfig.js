(function initBaseConfig() {
  const config = {
    appName: "Qshot - 子弹搜索",
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
    // 并发槽位上限：同一时刻最多允许多少张 iframe 处于"加载中"状态。
    // 其余卡片先把 DOM 创建出来并显示"等待加载中…"，在前面的卡片加载完成（load/error/超时）后
    // 依次补位，避免 6~8 个重型 SPA 同时冷启动打满 CPU / 网络。
    //   - 低配机 / 弱网：建议 2
    //   - 默认：3（对大多数机器在稳定性和首屏速度之间取平衡）
    //   - 高配 + 光纤 + 并发卡片数不多时可以调到 4~5
    //   - 设成 99 等效于关闭并发限制
    iframeMaxConcurrent: 3,
    debug: true
  };

  globalThis.QSHOT_BASE_CONFIG = config;
})();
