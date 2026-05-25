# Qshot — 协作指南

> 给 AI 和后续贡献者：这份文档解释项目结构、怎么跑起来、怎么调试、怎么发布。

## 项目简介

**Qshot（子弹搜索）** 是一个 Chrome MV3 浏览器扩展：

- **多 AI 批量搜索**：在一个查询页里同时调用多个 AI 站点（Kimi、Gemini、DeepSeek 等），结果并排展示
- **快速站点跳转**：popup 里一键进入收藏站点
- **悬浮层**：任意页面按 `Ctrl+Q` 唤起全局搜索浮层
- esbuild 构建打包。

## 仓库结构

### 顶层

```
D:\Qshot-1.1.1\
├── src/                    ← 唯一源码目录（详见下）
├── dist/                   ← 构建产物，.gitignore，加载扩展时指向这里
├── build.mjs               ← esbuild 打包脚本（含资源复制）
├── package.json / package-lock.json
├── README.md               ← 面向用户（GitHub 首页展示）
├── LICENSE                 ← 开源协议（构建时复制进 dist/）
├── PRIVACY.md              ← 隐私政策（构建时复制进 dist/）
├── PROJECT_CONSTRAINTS.md  ← 本文件
└── .gitignore              ← 忽略 dist/、node_modules/、_metadata/ 等
```

**规则**：根目录只放仓库元信息。所有会打包进扩展的内容都在 `src/`。

### `src/` 详细

```
src/
│
├── manifest.json           ← Chrome 扩展清单（entry point 声明）
│
├── icons/                  ← 扩展图标（16/32/48/128）
│
├── config/                 ← 运行时配置（JSON 资源 + 常量）
│   ├── baseConfig.js           content_script，注入基础常量到 window
│   ├── initialState.json       首次安装时写入 storage 的默认数据
│   ├── rules-source.mjs        declarativeNetRequest 规则的"源数据"
│   │                           （站点列表 + 模板，构建时展开成 dist/config/rules.json）
│   └── siteHandlers.json       AI 站点适配表（search handler / 匹配模式）
│                               通过 web_accessible_resources 暴露
│
├── background.js           ← service worker 入口
│                             管理 compare tab、消息路由、预热、命令
│
├── iframe/                 ← content scripts + compare 页 UI
│   │
│   ├── inject.js               入口（re-export ./inject/main.js）
│   ├── inject/                 注入到所有 <all_urls> 的业务逻辑
│   │   ├── main.js                 初始化 + 消息监听
│   │   ├── constants.js            扩展 origin、消息类型
│   │   ├── dom-utils.js            DOM 辅助
│   │   ├── executor.js             按站点 handler 执行搜索
│   │   ├── editors.js              站点富文本编辑器适配
│   │   ├── extractor.js            从页面抽取回答内容（截图 / 复制）
│   │   └── sidebar-fix.js          嵌入 iframe 时修正站点侧边栏
│   │
│   ├── overlay_main.js         MAIN world 的小钩子（读取页面全局变量）
│   │
│   ├── overlay.js              入口（re-export ./overlay/main.js）
│   ├── overlay/                全局悬浮搜索层（Ctrl+Q 唤起）
│   │   ├── main.js                 UI 装载 + 事件绑定
│   │   ├── constants.js            常量 / 随机问题文件路径
│   │   ├── state.js                运行时状态
│   │   ├── styles.js               悬浮层 CSS（字符串形式注入 shadow DOM）
│   │   ├── groups-panel.js         站点分组面板
│   │   ├── history-panel.js        历史记录面板
│   │   └── prompts-panel.js        提示词 / 随机问题面板
│   │
│   ├── iframe.html / iframe.css    compare 页的外壳
│   │
│   ├── iframe.js               入口（re-export ./iframe/main.js）
│   └── iframe/                 compare 页的多站点并排视图
│       ├── main.js                 页面装载 + 总协调
│       ├── state.js                卡片集合、布局偏好、正在加载的站点
│       ├── layout.js               网格 / 列数自适应
│       ├── sites-loader.js         从 storage + 内置表加载站点
│       ├── cards-render.js         渲染每张站点卡片
│       ├── load-queue.js           并发控制：限速依次打开 iframe
│       ├── send.js                 查询分发到每个子 iframe
│       ├── history.js              本次会话历史
│       ├── prompts.js              提示词面板
│       ├── add-site.js             "添加站点" 弹层
│       ├── export.js               截图 / 导出
│       ├── status.js               顶部状态栏
│       └── utils.js                共用小函数
│
├── popup/                  ← toolbar 按钮点开的弹窗
│   ├── popup.html / popup.css
│   ├── popup.js                入口（初始化 + storage 监听）
│   ├── state.js                state 单例 + 工具函数
│   ├── sections.js             历史、分组、提示词、随机问题 UI
│   ├── prompt-edit-modal.js    提示词编辑弹层
│   ├── icon128.png / logo.svg
│
├── settings/               ← 选项页（options_ui）
│   ├── settings.html / settings.css / about-logo.svg
│   ├── settings.js             入口（re-export ./settings/main.js）
│   └── settings/
│       ├── main.js                 页面协调 + tab 切换
│       ├── state.js                全局 state
│       ├── store.js                读写 chrome.storage
│       ├── utils.js                辅助
│       ├── drag.js                 拖拽排序通用模块
│       ├── import-export.js        JSON 导入 / 导出配置
│       └── sections/               每个 tab 一个文件
│           ├── groups.js               搜索分组管理
│           ├── custom.js               自定义站点
│           ├── prompts.js              提示词列表
│           ├── prompts-editor.js       提示词编辑
│           ├── random.js               随机问题语料
│           ├── other.js                其他偏好
│           └── about.js                关于 / 版本
│
└── shared/                 ← 跨入口共享模块
    ├── i18n.js                 语言切换 + 文案字典
    ├── storage-keys.js         所有 storage key 常量 + 随机问题文件路径表
    ├── prompt-groups.js        提示词分组的工具函数
    ├── prompt-item.js          提示词项组件（popup + overlay 共用）
    └── shortcut.js             快捷键解析 / 匹配
```

### 入口 → 拆分模块的约定

每个"入口文件"（`popup.js`、`settings.js`、`iframe.js`、`inject.js`、`overlay.js`）只是一层薄壳，import `./<name>/main.js` 启动实际逻辑，然后 `./<name>/` 子目录存放拆开的各个模块。

- 这样做的原因：`build.mjs` 的 `ENTRIES` 是 manifest 认的入口文件名，改成目录不方便；薄壳 + 子目录能让每个文件都 ≤ 500 行，又不动 manifest。
- 改代码时：**先看入口文件**（知道它指到哪），再看对应 `main.js` + 周边模块。

### `dist/` 的来源

`build.mjs` 做三件事：

1. **esbuild**：把 `ENTRIES` 列出的 JS 入口（上面提到的那些 `*.js`）分别打包成 IIFE，输出到 `dist/` 相同位置
2. **资源复制**：把 `SRC_ASSETS`（html / css / 图片 / json / manifest / icons）从 `src/` 原样复制到 `dist/`，外加从仓库根拷 `LICENSE` 和 `PRIVACY.md`
3. **生成 `dist/config/rules.json`**：把 `src/config/rules-source.mjs` 里的站点列表 + 模板展开成 Chrome MV3 规则数组写入 dist。`src/config/` 下没有 `rules.json` 实体文件，要改 DNR 规则去 `rules-source.mjs` 改完跑构建即可。

`dist/` 的目录结构和 `src/` **几乎一样**，差别只在：JS 是打包后的单文件（没有子目录里的模块源码），`config/rules.json` 是构建生成的，额外多了 `LICENSE` 和 `PRIVACY.md`。

## 开发启动

```bash
# 一次性
npm install

# 开发模式（推荐）— watch 模式，改动自动重建
npm run watch

# 或单次构建
npm run build
```

然后在 Chrome 里加载扩展：

1. 访问 `chrome://extensions/`
2. 右上角打开 **开发者模式**
3. 点 **加载已解压的扩展程序**

## 刷新 / 调试（重要）

改完代码后怎么让 Chrome 看到新版本 —— 根据改动的位置分三种情况：

| 改了哪里                                                           | 步骤                                                                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `background.js` / popup / settings / compare 页                    | watch 自动重建 → `chrome://extensions/` 点 Qshot 卡片的 🔄 刷新图标 → 下次打开 popup/settings 就是新的                              |
| **content script**（`inject.js`、`overlay.js`、`overlay_main.js`） | watch 重建 → 点 🔄 **还不够**。MV3 **不会**把新 content script 注入到已打开的标签页。**必须关闭并重开**目标标签页（点 × 而不是 F5） |
| 静态资源（html/css/png/svg）                                       | watch 会复制。刷新扩展 + 重开相关页面                                                                                               |

**调试建议**：

- background service worker：`chrome://extensions/` → Qshot 卡片 → "检查视图：Service Worker"
- popup：右键 popup 按钮 → 检查弹出内容
- compare 页（iframe.html）：在 compare 页直接 F12
- content script：在目标网站 F12，"顶部" 上下文切换到扩展的 content script world

**万用诊断**：如果某个 `inject.js:行号` 报错在新 dist 里不存在，那就是旧 content script 还在旧标签里跑 —— 关标签页重开即可。

## 打包发布

上传 Chrome Web Store / Microsoft Edge Add-ons：

```bash
# 推荐：一键构建 + 校验 + 打 zip（禁止手搓 Compress-Archive）
npm run pack:store
# 输出：release/qshot-{version}-store.zip
```

等价于 `NODE_ENV=production npm run build:store` + 校验 dist/zip 必含 **`config/rules.json`**（Edge 必验；由 `build.mjs` 的 `generateRules()` 生成，不在 src/）。

zip 根目录必须直接看到 `manifest.json`（不是 `dist/manifest.json`）。

仅重新打包已有 dist（跳过构建）：`node scripts/pack-store.mjs --skip-build`

## 代码约束

1. **单文件 ≤ 500 行**。超过就继续拆模块。现有的 `src/*/*/` 子目录（比如 `src/iframe/inject/`、`src/settings/settings/sections/`）就是拆分结果。约束适用于源代码（JS/CSS/HTML/MD/JSON 配置）；像 `src/config/siteHandlers.json` 这种"每条记录都是站点适配数据"的纯数据资源，结构本身就是数据库式表结构，不强制拆分；如果是"重复模板膨胀"导致超行（参考 DNR 规则原 `rules.json` 1800+ 行），改用模板生成（见 `src/config/rules-source.mjs` + `build.mjs` 的 `generateRules`）。
2. **新增 JS 入口**（例如加一个新 popup 或新 content script）：
   - 在 `src/` 下放源码
   - 在 `build.mjs` 的 `ENTRIES` 数组加一行
   - 在 `src/manifest.json` 里声明
3. **新增静态资源**（html/css/图片 等）：
   - 放到 `src/` 对应目录下
   - 在 `build.mjs` 的 `SRC_ASSETS` 数组加一行
4. **manifest 里的路径**：都相对于扩展根（= `dist/`）。例如 manifest 写 `"popup/popup.html"`，指的是 `dist/popup/popup.html`，源文件在 `src/popup/popup.html`。

## 分支约定

- `main` — 跟踪 `origin/main`（`30bewater/Qshot` 上游）。只做 merge from upstream 或 PR 合并。
- `dev` — 本地开发分支，基于 `main` 线性演进。所有功能开发、bug 修复都在 dev 上。

## 已知踩坑 & 设计决策

1. **`all_frames: true` 的陷阱**：content script 会注入到第三方站点**自己的**内嵌 iframe。此时 `window.parent.origin` 不是扩展，而是站点自身（例如 `https://gemini.google.com`）。如果用严格 `targetOrigin` 做 `postMessage`，会**同步抛错** `Failed to execute 'postMessage' on 'DOMWindow'`。
   - 解决：所有 `window.parent.postMessage(data, EXTENSION_ORIGIN)` 都要 `try/catch` 包住（见 `src/iframe/inject/main.js` 的 `reportCurrentUrl` 和 `notifyParentFrame`）。

2. **`web_accessible_resources` 易漏**：content script 用 `chrome.runtime.getURL('config/siteHandlers.json')` 去 fetch 时，如果没在 manifest 的 `web_accessible_resources` 里声明，或被用户的广告/隐私拦截器拦截，会报 `ERR_BLOCKED_BY_CLIENT`。
   - 解决：所有要 fetch 的扩展内资源都列进 `web_accessible_resources`；所有 fetch 调用都要兜底（见 `loadRegistry` 的 try/catch）。

3. **Content script 不热更新**：再次强调 —— MV3 的 content script 是 `document_start` 一次性注入，扩展刷新后**不会**自动重注入到已经打开的标签页。刷新扩展后必须关闭并重开目标标签页，或者运行一段时间再打开新页面。

4. **同步 popup 布局**：popup.js 用 `ResizeObserver` 监听 composer 高度变化，`syncComposerLayout` 会根据文本行数切换 `.is-expanded`。如果将来改布局，注意这个回调被 `state.syncComposerLayout` 注册给 sections 和 prompt-edit-modal 使用，避免循环 import。

## 给 AI 助手的提示

- 改代码前先看对应入口文件（例如改 inject 行为就看 `src/iframe/inject/main.js`），它会 re-export 实际的逻辑模块。
- 给 content script 加日志时注意：修改后必须**关闭并重开**测试标签页才能看到，刷新扩展页面不够。
