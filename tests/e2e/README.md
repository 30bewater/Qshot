# E2E 测试（Playwright）

## 1. 协议 fixture（CI 默认跑）

不加载扩展、不访问真实 AI 站，只验证 `QSHOT_SEARCH` ↔ `QSHOT_RESULT` 消息往返。

```bash
npm run test:e2e
# 或
npm run build && npm test && npm run test:e2e
```

## 2. 扩展 + 真 compare 页冒烟（本地）

加载 `dist/` 解压扩展，打开真实 compare 页，检查初始化、卡片渲染、发送编排。

**不影响产品 UI/逻辑**——测试代码仅在 `tests/e2e/`，不打包进扩展。

### 前置

```bash
npm run build
npx playwright install chromium   # 首次
```

### 运行

```bash
npm run test:smoke
```

### 环境变量（可选）

| 变量 | 默认 | 说明 |
|------|------|------|
| `QSHOT_EXTENSION_PATH` | `dist` | 扩展目录 |
| `QSHOT_SMOKE_SITES` | `deepseek` | URL `sites=` 参数，逗号分隔 |
| `QSHOT_SMOKE_QUERY` | `Qshot smoke test ping` | 发送测试用的 query |
| `QSHOT_SMOKE_SEND` | `1` | 设为 `0` 跳过「点击发送」步骤 |
| `QSHOT_SMOKE_HEADLESS` | — | 设为 `1` 无头运行（部分环境可能无法加载 MV3 扩展） |
| `QSHOT_SMOKE_HEADED` | 默认有界面 | 已废弃，请用 `QSHOT_SMOKE_HEADLESS` |
| `QSHOT_SMOKE_EXTENSION` | — | CI 中设为 `1` 才跑扩展冒烟 |

### 覆盖项

1. compare 页能打开、不报「初始化失败」
2. 卡片 DOM 渲染（iframe 卡片或 empty-state）
3. 输入框可输入、发送按钮可用
4. 点击发送后全局状态出现「发送完成：成功 N 个，失败 M 个」

> 第 4 步只验证**发送流程跑完**，不要求 AI 站必须登录成功；未登录时失败计数 > 0 也属正常。

### CI

GitHub Actions **默认只跑** `protocol` 项目；扩展冒烟需本地执行，或 CI 设置 `QSHOT_SMOKE_EXTENSION=1`（无登录态时发送可能全失败，但仍可验证页面加载）。

## 全部测试

```bash
npm run test:all
```

Vitest（37 项）+ 协议 E2E + 扩展冒烟（需先 build）。
