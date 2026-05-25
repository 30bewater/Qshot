(function initBaseConfig() {
  const config = {
    appName: "Qshot - 子弹搜索",
    defaultColumns: 1,
    // 单个 iframe 认定加载失败的超时。重型 SPA（DeepSeek/Kimi/Gemini）冷启动偶尔会接近 20s，
    // 放宽到 25s 以避免误判为「加载失败」。
    embedTimeoutMs: 25000,
    // iframe load 事件后等待此时长再触发待发查询，给 AI 站点 JS 完成初始化（React hydration 等）。
    // 设为 0 则立即触发（原行为）；150ms 足够多数 SPA 完成首帧渲染，不影响感知速度。
    postLoadSendDelayMs: 150,
    // compare 页面等待 content script 回包的总时长 = tabSendRetryCount × tabSendRetryDelayMs。
    // 多轮对话时 AI 仍在生成，content script 最长重试约 60 秒，
    // compare 页面须等待相同时长，否则提前判定失败后 content script 晚成功会被丢弃。
    // 30 × 2000ms = 60 秒，与 executor.js 的总重试窗口对齐。
    tabSendRetryCount: 30,
    tabSendRetryDelayMs: 2000,
    // 错峰加载：多站点场景下每个 iframe 之间的 src 赋值间隔（ms）。
    // 避免 6~8 个重型 SPA 同时初始化导致白屏。
    iframeStaggerMs: 80,
    // 发送并发数：同一轮追问最多同时向几张 AI 卡片写入并提交。
    // 发送只是向已加载的 iframe 发 postMessage，极轻量，不需要池化限流；
    // 设为 20 实际等效于"有几张卡就同时发几张"，消除排队等待。
    sendConcurrency: 20,
    // 并发槽位上限：同一时刻最多允许多少张 iframe 处于"加载中"状态。
    // 其余卡片先把 DOM 创建出来并显示"等待加载中…"，在前面的卡片加载完成（load/error/超时）后
    // 依次补位，避免太多重型 SPA 同时冷启动打满 CPU / 网络。
    //   - 低配机 / 弱网：建议 3
    //   - 默认：6（覆盖常用 6~8 个模型的场景，减少等待轮次）
    //   - 高配 + 光纤：可调到 8~10
    //   - 设成 99 等效于关闭并发限制
    iframeMaxConcurrent: 6,
    debug: true
  };

  globalThis.QSHOT_BASE_CONFIG = config;
})();
