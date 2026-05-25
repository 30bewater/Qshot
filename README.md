<p align="center">
  <img src="https://github.com/30bewater/Qshot/blob/main/src/icons/icon128.png?raw=true" width="80" height="80" alt="Qshot Logo">
</p>

<h1 align="center">Qshot · 子弹搜索</h1>

<p align="center">
  <strong>Language / 语言</strong>：
  <a href="#readme-zh">简体中文</a> ·
  <a href="#readme-en">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?logo=googlechrome" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Version-1.1.5-green" alt="Version">
  <img src="https://img.shields.io/badge/License-GPL--3.0-blue" alt="License">
  <img src="https://img.shields.io/badge/Build-esbuild-orange" alt="Build Tool">
</p>

<p align="center">
  <a href="https://qshot.top/">官网</a> ·
  <a href="PRIVACY.md">隐私政策</a> ·
  <a href="LICENSE">开源协议</a>
</p>

---

## 前言说明

本项目有参考了开源项目 [AICompare](https://github.com/taoAIGC/AICompare) 的部分设计思路，感谢原作者及社区贡献者的开源工作！

这个项目是完全利用AI写的，主包完全不懂代码的，也就是所谓的文科生，所以这个插件搓出来的过程也是十分困难

欢迎大家反馈问题、提出建议，也欢迎提交 Issue 或 Pull Request，一起让这个项目变得更好。

期待大家的使用，希望能够能帮助到更多人提高利用AI的效率٩(｡・ω・｡)﻿و

---

<a id="readme-zh"></a>

## 简体中文

<p align="center">
  一次提问，并排打开多个 AI / 搜索站点，对比回答、导出整理。<br>
  支持 Ctrl+Q 全局浮层、分组管理、提示词库、自定义站点、AI 一键总结等。
</p>

### 项目定位

Qshot 是一个 **Chrome / Edge Manifest V3** 扩展，面向「多 AI 对比搜索」场景：

- 减少在 ChatGPT、DeepSeek、Kimi、Gemini 等站点之间来回切换的成本
- 同一问题并排查看多个模型的回答
- 分组、提示词、历史、布局等均可配置，**数据保存在浏览器本地**

> 本公开仓库为 **v1.1.5 商店核心版** 源码（`npm run build:store`），不含实验模块。

### 核心功能

| 功能 | 说明 |
|------|------|
| 多站并行搜索 | 一次输入，同时向多个 AI / 搜索站点发送 |
| Compare 对比页 | 多栏 / 全局布局并排展示，支持卡片导航与布局持久化 |
| Ctrl+Q 悬浮层 | 任意网页快速唤起搜索、历史与提示词 |
| 分组与站点 | 内置主流 AI 站 + 自定义 URL 模板，分组一键切换 |
| 提示词库 | 多组提示词，popup / 浮层 / 官网输入框旁 Q 按钮均可调用 |
| 搜索历史 | 可选保存，便于复盘与再次打开 |
| 右键 / 划词 | 选中文本后右键菜单或气泡搜索（可配置） |
| AI 一键总结 | 对比页汇总多模型回答，需自备 API Key（可选） |
| 导出 | 将对比结果导出为 Markdown 等格式 |
| 配置导入导出 | 搜索组、自定义站、快捷站点、右键提示词等可备份为 JSON |
| 暗色模式 | popup / 设置页 / 对比页统一支持 |

### 安装与使用

#### 普通用户（推荐）

1. 打开官网 **[qshot.top](https://qshot.top/)**
2. 跳转 **Chrome Web Store** 或 **Microsoft Edge Add-ons** 安装
3. 安装后即可使用；首次安装会写入默认搜索组与提示词预设

#### 从源码加载（开发者）

```bash
git clone https://github.com/30bewater/Qshot.git
cd Qshot
npm install --include=dev
npm run build:store
```

在 `chrome://extensions/` 开启「开发者模式」→「加载已解压的扩展程序」→ 选择 **`dist/`** 目录。

> `dist/` 为构建产物，不在 Git 仓库中；改代码请编辑 `src/` 后重新构建。

### 典型使用流程

1. 点击扩展图标或在网页按 **Ctrl+Q** 输入问题
2. 选择搜索组，进入 **Compare 对比页**
3. 各站点卡片加载完成后点击发送，查看并排结果
4. 可选：导出、AI 总结、切换布局或追加站点

### 开发与调试

| 命令 | 说明 |
|------|------|
| `npm run watch:store` | 监听 `src/` 变更并持续构建商店版 |
| `npm run build:store` | 单次构建商店版（无实验模块） |
| `NODE_ENV=production npm run build:store` | 生产构建（压缩） |

**刷新注意**：改 background / popup / settings / compare 页 → 在 `chrome://extensions/` 刷新扩展；改 **content script**（inject / overlay）→ 还需 **关闭并重开** 目标标签页。

### 仓库结构

```text
Qshot/
├── src/                 # 扩展源码（改这里）
│   ├── background/      # Service Worker
│   ├── iframe/          # 对比页 + inject + overlay
│   ├── popup/           # 工具栏弹窗
│   ├── settings/        # 设置页
│   ├── config/          # 站点规则、初始预设、DNR 规则源
│   ├── shared/          # i18n、协议常量、共用工具
│   └── build-stubs/     # 功能关闭时的构建占位（非实验代码）
├── build.mjs            # esbuild 打包
├── PRIVACY.md           # 隐私政策
├── LICENSE
└── README.md
```

### 权限与隐私

- 配置、提示词、历史等保存在 **`chrome.storage.local`**，不上传开发者服务器
- 发送搜索、可选 AI 总结时，数据由浏览器 **直连** 你选择的第三方站点或 AI API
- 详见 [`PRIVACY.md`](PRIVACY.md)

### 技术栈

- Manifest V3 · Vanilla JavaScript · esbuild
- Declarative Net Request（iframe 嵌入兼容）
- Shadow DOM（悬浮层样式隔离）

### 开源协议

本项目采用 [GPL-3.0](LICENSE)。

---

<a id="readme-en"></a>

## English

<p align="center">
  Ask once, compare answers from multiple AI / search sites side by side.<br>
  Ctrl+Q overlay, groups, prompts, custom sites, export, and optional AI summary.
</p>

### Overview

**Qshot** is a **Chrome / Edge Manifest V3** extension for multi-AI comparison workflows:

- Cut down tab-switching between ChatGPT, DeepSeek, Kimi, Gemini, and more
- View answers to the same prompt in one compare page
- Groups, prompts, history, and layout are configurable — **data stays on your device**

> This public repo is the **v1.1.5 store core** source (`npm run build:store`). Experimental modules are not included.

### Features

| Feature | Description |
|---------|-------------|
| Multi-site search | Send one query to many AI / search sites at once |
| Compare page | Side-by-side cards, global layout, card navigation |
| Ctrl+Q overlay | Quick search, history, and prompts on any page |
| Groups & sites | Built-in AI sites + custom URL templates |
| Prompt library | Prompt groups usable from popup, overlay, and on-site launcher |
| Search history | Optional local history for review |
| Context / selection | Right-click or optional selection bubble search |
| AI summary | Optional compare-page summary with your own API key |
| Export | Export comparison results (e.g. Markdown) |
| Config backup | Import/export JSON for groups, sites, prompts, etc. |
| Dark mode | Popup, settings, and compare page |

### Install

#### End users (recommended)

1. Visit **[qshot.top](https://qshot.top/)**
2. Install from **Chrome Web Store** or **Microsoft Edge Add-ons**
3. Default search groups and prompts are applied on first install

#### Load from source (developers)

```bash
git clone https://github.com/30bewater/Qshot.git
cd Qshot
npm install --include=dev
npm run build:store
```

Open `chrome://extensions/` → enable **Developer mode** → **Load unpacked** → select the **`dist/`** folder.

> `dist/` is generated locally and not committed. Edit `src/`, then rebuild.

### Typical flow

1. Open the popup or press **Ctrl+Q** and type a question
2. Pick a search group → **Compare page** opens
3. Send to loaded site cards and read answers side by side
4. Optionally export, run AI summary, or change layout

### Development

| Command | Description |
|---------|-------------|
| `npm run watch:store` | Watch `src/` and rebuild store package |
| `npm run build:store` | One-shot store build |
| `NODE_ENV=production npm run build:store` | Production build (minified) |

After changing **content scripts** (inject / overlay), reload the extension **and** close/reopen target tabs.

### Repository layout

```text
Qshot/
├── src/                 # Extension source
├── build.mjs            # esbuild entry
├── PRIVACY.md
├── LICENSE
└── README.md
```

### Privacy

- Settings, prompts, and history are stored in **`chrome.storage.local`** only
- Queries and optional AI summary requests go **directly** from your browser to sites/APIs you choose — not to the developer's servers
- See [`PRIVACY.md`](PRIVACY.md)

### Tech stack

Manifest V3 · Vanilla JS · esbuild · DNR · Shadow DOM

### License

[GPL-3.0](LICENSE)
