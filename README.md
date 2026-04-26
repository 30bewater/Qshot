<p align="center">
    <img src="https://github.com/30bewater/Qshot/blob/main/icons/icon128.png?raw=true" width="80" height="80" alt="Qshot Logo">
</p>

<h1 align="center">Qshot - 子弹搜索</h1>

<p align="center">
  一次提问，同时打开多个 AI 站点对比回答。<br>
  支持 popup 搜索、Ctrl+Q 全局浮层、分组管理、提示词库、自定义站点和结果导出。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?logo=googlechrome" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Version-1.1.1-green" alt="Version">
  <img src="https://img.shields.io/badge/License-GPLv3-blue" alt="License">
  <img src="https://img.shields.io/badge/Build-esbuild-orange" alt="Build Tool">
</p>

---

## 项目定位

Qshot 是一个 Chrome Manifest V3 扩展，核心目标是：

- 减少在多个 AI 站点之间来回切换的成本
- 让同一个问题可以并排对比多个回答
- 提供一套可配置、可扩展、可本地持久化的多站搜索工作流

## 核心功能

| 功能 | 说明 |
|------|------|
| 多站并行搜索 | 一次输入，同时发送到多个 AI 站点 |
| 对比页展示 | 多站回答并排展示，支持布局切换 |
| 全局快捷搜索 | 任意网页按 `Ctrl+Q` 唤起悬浮层 |
| 分组与站点管理 | 内置站点 + 自定义站点，按分组快速切换 |
| Prompt 与历史 | 提示词、随机问题、历史记录统一管理 |
| 回答导出 | 将对比结果导出，便于复盘和整理 |

## 安装与使用

### 普通用户（推荐）

如果你只是使用扩展，不需要看源码：

1. 进入 Qshot 官网：[qshot.top](https://qshot.top)
2. 通过官网跳转到 Chrome Web Store 或 Edge Add-ons
3. 在商店点击安装，安装后即可直接使用

### 开发者 / 维护者（源码方式）

如果你要改代码、调试、二次开发：

1. 安装依赖

```bash
npm install
```

2. 构建产物

```bash
npm run build
```

或开发时持续构建：

```bash
npm run watch
```

3. 在 Chrome 加载扩展
   - 打开 `chrome://extensions/`
   - 打开右上角「开发者模式」
   - 选择「加载已解压的扩展程序」
   - 选择项目里的 `dist/` 目录

## `src` 和 `dist` 的区别（重点）

- `src/`：源码目录，平时改代码都在这里
- `dist/`：构建产物目录，Chrome 实际加载这个目录
- GitHub 默认同步源码，`dist/` 通常不会提交（本仓库的 `.gitignore` 已忽略 `dist/`）

工作流是：**改 `src` -> 构建 -> 重新加载 `dist`**。

## 系统架构（How it works）

Qshot 采用 Chrome 扩展常见的多入口架构，核心由 4 层组成：

1. **UI 入口层**：`popup`、`settings`、`overlay`、`iframe(compare页)`
2. **页面注入层**：`inject` 负责在目标站点执行输入、发送、抽取
3. **后台协调层**：`background` 负责标签页/消息路由/生命周期管理
4. **配置与共享层**：`config` + `shared` 统一站点规则、默认状态和通用工具

可以把它理解为：

- `popup/overlay` 负责“发起搜索”
- `background` 负责“调度”
- `inject` 负责“在站点里执行动作”
- `iframe` 负责“把多站结果并排展示出来”

## 关键模块职责

### 1) `background`（服务中枢）

- 维护扩展运行时消息通道
- 协调 compare 页与各站点页面之间的通信
- 处理标签页打开、聚焦、状态同步等动作

### 2) `iframe`（结果对比页）

- 承载多站点卡片容器和布局逻辑
- 控制并发加载与发送队列
- 汇总每个站点状态并做可视化反馈

### 3) `inject`（站点自动化执行器）

- 在目标站点内定位输入框/发送按钮
- 写入查询并触发发送
- 尝试从页面抽取回答内容供对比页使用

### 4) `overlay`（全局唤起层）

- 在任意网页通过 `Ctrl+Q` 打开浮层
- 提供快速输入、历史和提示词入口
- 与 background/compare 页联动触发搜索

### 5) `popup` 与 `settings`（运营配置层）

- `popup`：日常搜索入口、分组切换、快速操作
- `settings`：分组/站点/提示词/随机问题等完整配置管理

### 6) `config` 与 `shared`（基础能力层）

- `config`：站点规则、初始状态、DNR 规则等静态资源
- `shared`：跨入口复用的 i18n、组件、常量和工具函数

## 一次搜索的运行流程

下面是一条典型链路：

1. 用户在 `popup` 或 `overlay` 输入问题并点击搜索
2. 请求发到 `background`，创建或激活 compare 页
3. compare 页按分组加载站点卡片并建立发送队列
4. 每个目标站点通过 `inject` 执行“输入 -> 发送 -> 状态回传”
5. compare 页持续接收进度，更新卡片状态与展示内容
6. 用户在 compare 页进行对比、二次编辑、导出结果

## 设计取舍（为什么这么做）

- **多入口拆分**：降低单文件复杂度，便于长期维护
- **入口薄壳 + `main.js`**：保持 manifest 入口稳定，同时让内部模块可持续拆分
- **`src` / `dist` 分离**：源码与产物职责清晰，便于发布和排错
- **MV3 + content script 架构**：符合 Chrome 扩展安全模型与生命周期限制
- **队列化并发控制**：避免同时触发过多站点导致页面抖动或失败率上升

## 开发与调试

### 推荐流程

1. 运行 `npm run watch`
2. 修改 `src/` 下代码
3. 到 `chrome://extensions/` 点 Qshot 的刷新按钮
4. 如果改的是 content script（如 `inject.js` / `overlay.js` / `overlay_main.js`），需要关闭并重开目标网页标签页

### 常见入口

- `src/background.js`：Service Worker，消息与标签页调度
- `src/iframe/inject.js`：页面注入入口（re-export）
- `src/iframe/overlay.js`：全局浮层入口（re-export）
- `src/iframe/iframe.js`：对比页入口（re-export）
- `src/popup/popup.js`：弹窗入口
- `src/settings/settings.js`：设置页入口

## 仓库结构（当前版本）

```text
Qshot-1.1.1/
├── src/                      # 唯一源码目录
├── dist/                     # 构建输出（给 Chrome 加载）
├── build.mjs                 # esbuild 构建脚本
├── PROJECT_CONSTRAINTS.md    # 协作与约束文档
├── PRIVACY.md                # 隐私政策
├── LICENSE
└── README.md
```

## 权限与隐私

- 权限用途见 `src/manifest.json`
- 隐私策略见 [`PRIVACY.md`](PRIVACY.md)
- 分组、站点、提示词、历史等配置存储在本地 `chrome.storage.local`

## 构建与发布

生产构建：

```bash
NODE_ENV=production npm run build
```

然后打包 `dist/` 目录内的内容（zip 根目录应直接包含 `manifest.json`）。

## 技术栈

- Chrome Extension Manifest V3
- Vanilla JavaScript（无运行时框架）
- esbuild（用于多入口构建）
- Declarative Net Request（站点嵌入兼容增强）
- Shadow DOM（浮层样式隔离）

## 开源协议

本项目采用 [GPL-3.0](LICENSE)。
