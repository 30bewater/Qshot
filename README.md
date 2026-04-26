<p align="center">
  <img src="icons/icon128.png" width="80" height="80" alt="Qshot Logo">
</p>

<h1 align="center">Qshot — 子弹搜索</h1>

<p align="center">
  一次提问，同时获得 ChatGPT / DeepSeek / Gemini / Claude / Kimi 等多个 AI 的回答。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?logo=googlechrome" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Version-1.1.0-green" alt="Version">
  <img src="https://img.shields.io/badge/License-GPLv3-blue" alt="License">
  <img src="https://img.shields.io/badge/Zero_Dependencies-vanilla_JS-orange" alt="No Dependencies">
</p>

---

<!-- 在这里放一张截图或 GIF 演示效果最佳 -->
<!-- <p align="center"><img src="docs/demo.gif" width="800"></p> -->

## 这是什么？

**Qshot** 是一个 Chrome 浏览器扩展，让你在一个页面里同时向多个 AI 聊天机器人和搜索引擎发送同一个问题，并排对比它们的回答。

不用再一个个打开标签页复制粘贴了 —— 输入一次，所有 AI 同时开始回答。

## 为什么需要它？

- 不同 AI 擅长的领域不同，对比回答能帮你找到更准确的答案
- 省去在多个 AI 网站之间反复切换、复制粘贴的时间
- 一键导出所有回答，方便整理和分享

## 核心功能

| 功能 | 说明 |
|------|------|
| 多站并行搜索 | 一次输入，同时发送到所有选中的 AI 站点 |
| 对比页面 | 多个 AI 的回答以卡片形式并排展示，一目了然 |
| 全局快捷搜索 | 任意网页按 `Ctrl+Q` 唤起浮层，无需离开当前页面 |
| 搜索分组 | 自定义站点分组，不同场景一键切换 |
| Prompt 库 | 内置提示词模板，支持分组管理、导入导出 |
| 多种布局 | 单行横滑 / 2列 / 3列网格 / 侧边栏模式，自由切换 |
| 回答导出 | 将所有 AI 回答导出为 Markdown 文档 |
| 搜索历史 | 自动记录搜索历史，随时回溯 |
| 自定义站点 | 支持添加任意网站，URL 中用 `{query}` 作为查询占位符 |
| 标签页模式 | 不喜欢 iframe？也可以选择在独立标签页中打开 |

## 隐私与数据

- **隐私政策**：见 [`PRIVACY.md`](PRIVACY.md)
- **数据存储**：扩展的分组/站点/提示词/历史等配置仅保存在本地（`chrome.storage.local`），不上传开发者服务器。

## 权限说明（审核/自查用）

Qshot 申请的权限与用途（简要）：

- **`<all_urls>`**：用于在任意网页唤起快捷搜索浮层，以及在你打开的目标站点页面中执行自动化操作（写入输入框、触发发送、提取对比所需信息）。本扩展不读取并上传你的浏览记录。
- **`tabs` / `activeTab`**：用于打开/切换标签页、在标签页模式下批量打开站点，并向已打开页面发送扩展消息以触发自动化。
- **`storage`**：用于保存分组、站点、提示词、历史记录与界面偏好（本地存储）。
- **`declarativeNetRequest`**：用于提升白名单站点在对比页 iframe 场景下的可嵌入性（见下方技术栈说明）。
- **`web_accessible_resources`**：仅开放扩展浮层所需的静态资源（如 Logo）供网页环境加载，不开放配置文件或其它资源给网页读取。
- **扩展页 CSP**：扩展页面仅允许加载自身脚本；对比页的 `iframe` 仅允许 `https/http` 站点（不开放任意 scheme）。

## 支持的站点

### AI 聊天机器人

| 站点 | 域名 |
|------|------|
| ChatGPT | `chatgpt.com` |
| DeepSeek | `chat.deepseek.com` |
| Kimi | `kimi.moonshot.cn` |
| 通义千问 | `tongyi.aliyun.com` / `qwen.ai` |
| 豆包 | `doubao.com` |
| Gemini | `gemini.google.com` |
| Claude | `claude.ai` |
| 腾讯元宝 | `yuanbao.tencent.com` |
| 秘塔搜索 | `metaso.cn` |
| Grok | `grok.com` |

### 搜索 / 社区平台

小红书 · B站 · 知乎 · 抖音

> 还可以在设置中添加任意自定义站点。

## 快速开始

### 安装

1. 下载或克隆本仓库
2. 打开 Chrome，访问 `chrome://extensions`
3. 开启右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择项目文件夹
5. 完成！点击工具栏的 Qshot 图标即可开始使用

### 使用

- **弹窗搜索**：点击扩展图标 → 输入问题 → 回车或点击分组按钮
- **全局搜索**：在任意网页按 `Ctrl+Q` → 浮层弹出 → 输入并发送
- **对比页面**：搜索后自动打开，所有 AI 并排回答
- **设置**：弹窗中点击「设置」→ 管理分组、站点、提示词、快捷键

## 项目结构

```
qshot/
├── manifest.json            # 扩展清单 (Manifest V3)
├── background.js            # Service Worker：消息路由、标签管理、预热
├── config/
│   ├── baseConfig.js        # 全局配置（超时、并发数、调试开关）
│   ├── rules.json           # 声明式网络请求规则（解除 iframe 限制）
│   └── siteHandlers.json    # 站点定义与自动化操作步骤
├── iframe/
│   ├── iframe.html/css/js   # 对比页面：卡片渲染、搜索分发、导出、布局
│   ├── inject.js            # 内容脚本：DOM 自动化引擎（输入→提交流水线）
│   ├── overlay.js           # 全局搜索浮层（Shadow DOM 隔离）
│   └── overlay_main.js      # MAIN world 脚本：快捷键捕获
├── popup/                   # 扩展弹窗界面
├── settings/                # 设置页面（分组、站点、提示词、快捷键）
├── shared/
│   └── prompt-item.js       # 可复用的提示词 UI 组件
└── icons/                   # 扩展图标
```

## 技术栈

- **Chrome Extension Manifest V3** — Service Worker + Content Scripts
- **纯原生 JavaScript** — 零框架、零依赖、零构建步骤
- **Declarative Net Request** — 仅对内置白名单站点的 iframe 子帧请求移除 `X-Frame-Options` / `CSP` 响应头，以提升可嵌入性（不对全网生效；自定义站点可能仍需走「新标签页模式」）
- **Shadow DOM** — 全局浮层样式隔离，不影响宿主页面
- **DOM 自动化** — 兼容 React / ProseMirror / Lexical 等编辑器的输入模拟

## 参与贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建你的功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送到分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

## 许可证

本项目基于 [GNU General Public License v3.0](LICENSE)（GPL-3.0）开源。

## 致谢

感谢所有 AI 平台提供的优秀服务，让这个工具成为可能。

---

<p align="center">
  如果觉得有用，请给个 ⭐ Star 支持一下！
</p>
