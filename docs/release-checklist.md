# Qshot 发版前检查清单（约 5 分钟）

> 自动化能覆盖的尽量交给命令；下面「手动」项只在发版/大改 compare·inject·站点规则时做。

---

## 一、自动化（约 2 分钟，复制粘贴）

在项目根目录依次执行：

```bash
npm run build
npm run check:lines
npm test
npm run test:e2e
```

**快速扩展冒烟**（不测发送，约 1 分钟，会短暂弹出 Chrome）：

```bash
npm run test:smoke
# 等价于：QSHOT_SMOKE_SEND=0 npm run test:smoke
```

**完整扩展冒烟**（含发送编排，可能 5～8 分钟）：

```bash
npm run test:smoke
# 默认 QSHOT_SMOKE_SEND=1
```

**全部自动化一次跑完**（Vitest + 协议 E2E + 扩展冒烟，需已 build）：

```bash
npm run test:all
```

### 通过标准

| 命令 | 期望 |
|------|------|
| `npm run build` | 无报错，`dist/` 更新 |
| `npm run check:lines` | 全部 `OK`（src JS/CSS ≤500 行） |
| `npm test` | 37 passed |
| `npm run test:e2e` | 2 passed |
| `npm run test:smoke` | 4 passed（或 3 passed 若 `QSHOT_SMOKE_SEND=0`） |

---

## 二、手动冒烟（约 3 分钟，发版必做）

在 `chrome://extensions/` **刷新 Qshot**，然后：

### 1. Compare 页（核心）

- [ ] 打开 compare 页，选 **2～3 个常用站**（如 DeepSeek + ChatGPT + Kimi）
- [ ] 卡片能加载（或 fallback 可点「新标签打开」）
- [ ] 输入一条短 query，点发送
- [ ] 全局状态出现「发送完成：成功 X 个，失败 Y 个」（Y>0 若未登录可接受，但 X 至少应有已登录的站）

### 2. 入口抽查（各 10 秒）

- [ ] **Popup**：输入问题 → 能打开 compare 或新标签
- [ ] **Ctrl+Q 悬浮层**（普通网页）：能唤起、能搜索
- [ ] **设置页**：能打开，分组/站点列表正常

### 3. 若本次改动了这些文件，加测一项

| 改了什么 | 加测 |
|----------|------|
| `siteHandlers.json` / inject / executor | 被改站点各发 1 条 query |
| `overlay/*` | 悬浮层开闭 + 搜索/提示词面板 |
| `settings/*` 分组/拖拽 | 设置页拖拽排序 |
| `shared/theme.js` / 暗色 CSS | popup、settings、compare 切换暗色 |
| `shared/compare-protocol.js` | compare 发搜索 + 收结果 + 导出 |

---

## 三、商店包（`npm run pack:store`）

- [ ] 使用 **`npm run pack:store`**（= `build:store` + dist/zip 校验 + `release/qshot-{version}-store.zip`）
- [ ] **不要**手搓 `Compress-Archive`；Microsoft Edge 会校验 zip 内必须有 **`config/rules.json`**（正斜杠路径）
- [ ] 控制台输出 `[pack:store] OK`；zip 根目录直接是 `manifest.json`
- [ ] 设置页无 memory / desktop 实验 Tab
- [ ] `dist/manifest.json` 权限与 content_scripts 符合商店策略
- [ ] `PRIVACY.md` 生效日期与版本一致

---

## 四、提交前最后确认

- [ ] `git status` 无意外文件（密钥、`.env`、个人路径）
- [ ] 版本号 / `manifest.json` version 已按需 bump
- [ ] 更新日志或 release note（若对外发布）

---

## 五、常见问题

**Q: `npm run test:smoke` 报 dist 不存在？**  
A: 先 `npm run build`。

**Q: 冒烟发送「失败 1 个」算过还是不过？**  
A: 自动化只要求出现「发送完成：成功 N 个，失败 M 个」——流程跑通即过。发版前手动项里，你常登录的站应至少 1 个成功。

**Q: 扩展冒烟弹窗很烦？**  
A: 用 `QSHOT_SMOKE_SEND=0` 跳过发送步骤；或设 `QSHOT_SMOKE_HEADLESS=1`（部分环境可能加载不了 MV3 扩展）。

**Q: 改了 content script 但手动测试没变化？**  
A: 刷新扩展 + **关闭并重开**目标标签页（不是 F5）。

**Q: Microsoft Edge 上传 zip 报「不包含 config/rules.json」？**  
A: 该文件由 **`npm run build:store` 生成**到 `dist/config/rules.json`，不在 `src/` 里。请跑 **`npm run pack:store`** 重新打 zip；不要用手动压缩。若 build 失败（`dist` 被占用），先卸载/关闭 Chrome 里已加载的 Qshot 再试。可用 `tar -tf release/qshot-*-store.zip | findstr rules` 确认 zip 内有 `config/rules.json`。

---

## 六、Tier A 站点（大版本建议全测）

发 major 版本或批量改 handler 时，手动对以下站点各发 1 条：

ChatGPT · DeepSeek · Kimi · Gemini · Claude · 豆包 · 千问 · Grok

自动化配置校验：`npm run test:tier-a`
