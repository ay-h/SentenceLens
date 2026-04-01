# Implementation Plan: 单词查询弹窗

**Branch**: `003-word-lookup` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-word-lookup/spec.md`

## Summary

在现有句子阅读体验上新增“双击单词弹出中文释义”功能，同时保持单击选句子的分析流程。实现包含三个层面：前端将句子拆分为可双击的单词节点并展示浮动弹窗；后端新增单词查询 API，优先命中本地英汉词库（ECDICT），未命中时调用既有 LLM 配置并缓存结果；前后端一体化处理缓存、错误展示与离线 fallback，确保离线优先原则。

## Technical Context

**Language/Version**: TypeScript 5.9 + React 19（前端），Node.js 20 + Express 4（后端）  
**Primary Dependencies**: React DOM、TailwindCSS、lucide-react（UI）；Express、sql.js；新增开源英汉词库数据（ECDICT JSON/SQLite）  
**Storage**: 词典数据存放于本地 `data/dictionary/ecdict.db`（或 JSON）并通过 sql.js 读取；LLM 缓存沿用 sqlite 的 `sentence_analyses` 或新增 `word_definitions` 表  
**Testing**: Vitest + React Testing Library（前端组件）；Jest/Supertest（如有）或既有后端测试框架；手动回归  
**Target Platform**: Electron 桌面应用（Windows/macOS/Linux）  
**Project Type**: 桌面应用（Electron 前端 + Express 后端）  
**Performance Goals**: 首次 LLM 查询 <= 2s；离线词库查询 < 150ms；缓存命中返回 < 200ms  
**Constraints**: 必须离线可用；UI 文案与文档中文；不破坏既有句子分析交互；双击/单击事件需兼容触摸板/鼠标  
**Scale/Scope**: 影响 `frontend/src/components/TextDisplay.tsx`、弹窗新组件、`frontend/src/hooks`（可能）；后端 `server/app.js`、`server/models/database.js`、`server/services/` 新增词典服务

## Constitution Check

| 原则 | 评估 | 说明 |
|------|------|------|
| 跨平台一致性 | ✅ | 仅使用浏览器原生事件 + Express/SQLite，三平台一致可行 |
| 离线优先架构 | ✅ | 离线词库满足无网查词；LLM 仅兜底并需错误提示 |
| 集成质量 | ✅ | 新增 API 遵循 `/api/*` REST 约定，提供缓存与错误处理 |
| 可观测性 | ✅ | 后端查询将记录日志；前端失败 toast 说明原因 |
| 简单性 | ✅ | 优先使用本地词库 + 现有 LLM，避免引入额外第三方服务 |
| 中文文档编写 | ✅ | 规划与文档全为中文 |

## Project Structure

### Documentation (this feature)

```text
specs/003-word-lookup/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/        # 若需定义新 API 契约则填入
└── tasks.md          # 由 /speckit.tasks 在后续生成
```

### Source Code (repository root)

```text
server/
├── app.js                 # 新增 /api/word-lookup 路由
├── services/
│   └── dictionary.js      # 词库查询 + LLM 兜底逻辑（新增）
└── models/
    └── database.js        # 新增 word_definitions 表及 CRUD

frontend/
└── src/
    ├── components/
    │   ├── TextDisplay.tsx        # 将句子拆分为单词节点，绑定双击
    │   ├── WordLookupPopover.tsx  # 新建弹窗组件
    │   └── OverlayPortal.tsx?     # 复用/新增浮层定位
    ├── hooks/
    │   └── useWordLookup.ts       # 管理状态与缓存（待定）
    └── store/
        └── useAppStore.ts         # 若需集中管理缓存，可扩展
```

**Structure Decision**: 前后端均基于现有目录扩展；后端新增 `services/dictionary.js`、数据库 schema；前端新增专用组件与 Hook，位于既有结构下，无需额外子项目。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| （无） | – | – |

## Phase 0 — Research

### 0.1 研究目标
- 确认适用于 Electron/React 的单词级事件捕获与双击判定方案，避免与单击选句冲突。
- 评估 ECDICT 等开源词库的体积、查询方式（JSON vs SQLite）与授权情况。
- 设计 LLM 兜底与缓存策略（与现有 sqlite 结构结合，避免重复实现）。

### 0.2 研究任务
1. 调研 React 中将文本拆分为单词节点并监听 `dblclick` 的最佳实践（包含跨浏览器兼容性、触摸板/触摸屏支持）。
2. 对比 ECDICT（JSON/SQLite）、Coca 词典等开源资源，确定体积最小且授权友好的词库格式。
3. 评估现有数据库结构：决定是扩展 `sentence_analyses` 还是新增 `word_definitions` 表；调研 sql.js 对大词库的加载性能。
4. 研究在前端/后端之间共享查词缓存的策略（仅前端内存 vs 后端 sqlite）。

### 0.3 输出
- `research.md`：记录词库格式选择、双击事件处理方案、缓存/兜底策略及备选方案。

## Phase 1 — 设计与契约

### 1.1 数据模型
- 在 `data-model.md` 中定义 **WordLookupRequest**（word, normalizedWord, timestamp）与 **WordDefinition**（word, phonetics, partsOfSpeech[], meanings[], source, cachedAt）。
- 若新增 `word_definitions` 表：字段包括 `word`（主键）、`definition_json`、`source`（dictionary/llm）、`updated_at`。
- 描述前端 UI 状态：`selectedSentence`, `hoveredWord`, `wordLookupState`（idle/loading/success/error）、`popoverPosition`。

### 1.2 接口契约
- `contracts/word-lookup.md`（新建）：
  - 请求：`POST /api/word-lookup` with `{ word: string }`
  - 响应（成功）：`{ source: "dictionary" | "llm", definition: { phonetics: string[], partsOfSpeech: PartDefinition[] } }`
  - 错误格式：`{ detail: string }`
- 定义缓存命中响应：响应中 `cached: boolean` 字段标示是否来自缓存。

### 1.3 Quickstart 与 Agent Context
- `quickstart.md`：
  1. 安装词库数据：提供下载/放置 `data/dictionary/ecdict.db` 的步骤。
  2. 启动流程：`npm install` → `npm run dev`，说明查词验证路径（双击句子中的单词）。
  3. 后端 API 验证：使用 `curl` 调用 `/api/word-lookup`。
- 运行 `.specify/scripts/powershell/update-agent-context.ps1 -AgentType windsurf`，记录新引入的 `dictionary.js` 服务与词库。

### 1.4 设计交付物
- `data-model.md`、`contracts/word-lookup.md`、`quickstart.md` 完成并链接到 spec。
- `research.md` 中结论同步至 plan 的技术上下文。

## Phase 2 — 实施规划（待 `/speckit.tasks` 完成）

1. **前端文本拆分与事件处理**
   - 在 `TextDisplay.tsx` 将句子拆成单词 `<span>`；实现单击选句、双击查词的事件区分，防止冒泡冲突。
   - 新增 `WordLookupPopover` 组件，包含加载/错误/结果 UI，自动定位。
2. **前端状态管理与缓存**
   - 若需要跨组件共享查词结果，添加 `useWordLookup` hook 或在 `useAppStore` 扩展状态。
   - 实现前端内存缓存（Map）减少重复请求；缓存命中直接展示结果。
3. **后端词库查询**
   - 新增 `services/dictionary.js` 读取 ECDICT；提供 `lookupFromDictionary(word)`。
   - 在 `app.js` 添加 `/api/word-lookup` 路由：先查本地词库 → 未命中调用 `llmService.lookupWord`（需新增函数）→ 缓存到 sqlite。
4. **数据库与存储**
   - `database.js` 新增 `createWordDefinition`, `getWordDefinition`, `updateWordDefinition`。
   - 迁移脚本：在初始化时创建 `word_definitions` 表（若不存在）。
5. **LLM 兜底实现**
   - 在 `services/llm.js` 添加 `lookupWord`，调用 LLM 返回结构化释义；需定义 prompt 模板。
6. **UI 集成与可观测性**
   - 前端 toast 提示网络错误、无释义、LLM 超时。
   - 后端日志记录词库命中/LLM 调用/缓存更新。
7. **缓存与超时策略**
   - 设定缓存过期时间（例如 7 天）；在 plan 中记录如何处理更新。
8. **回归测试**
   - 更新手动测试步骤：双击不同单词、离线模式、LLM fallback。
   - 编写最少量自动化测试：
     - 后端：dictionary 服务命中/未命中流程。
     - 前端：双击触发查词，弹窗内容渲染。

## 风险与缓解

| 风险 | 影响 | 缓解策略 |
|------|------|-----------|
| 词库体积过大导致加载慢 | 中 | 选择 SQLite 压缩格式，并在 Electron 启动时懒加载；文档说明首次加载需等待 |
| 双击事件与单击选句冲突 | 高 | 使用 `setTimeout` 延迟触发选句或在 `dblclick` 中调用 `event.preventDefault()` 并清除单击触发器 |
| LLM 兜底成本高或响应慢 | 中 | 缓存结果，UI 显示加载 + 重试；允许用户取消；记录日志分析频次 |
| 离线模式下词库缺词 | 低 | 明确提示“未找到释义”；建议用户连接网络并使用 LLM 或后续导入词库补充 |

## 测试计划

1. **手动测试**
   - 双击常见单词 → 立即弹出词库释义。
   - 双击冷僻词（词库无）→ 触发 LLM → 显示释义并记录缓存。
   - 断网状态 → 离线词库命中仍可显示；无释义时给出提示。
   - 在同一会话中多次查询同一单词 → 第二次展示缓存且响应 < 200ms。
   - 切换句子选中 → 查词弹窗关闭，句子分析按钮保持。
2. **自动化测试**（优先级）
   - 后端 `dictionary.js`：对词库存在/不存在单词的单元测试。
   - 后端 `/api/word-lookup`：使用 Supertest 模拟请求，验证缓存逻辑。
   - 前端组件测试：
     - 模拟 `dblclick` 触发弹窗。
     - 检查加载状态 → 成功内容 → 错误提示。
   - 若时间允许，端到端测试（Playwright/Electron）验证双击交互。

## 验收标准对齐

| 成功指标 | 验证方式 |
|-----------|----------|
| SC-001（首次查词 2 秒内完成） | 手动测试 + 记录首次响应时长 |
| SC-002（查词不影响选句） | 手动依次执行双击查词/单击选句观察状态 |
| SC-003（弹窗不溢出） | 缩放窗口 & 不同单词位置验证弹窗定位 |
| SC-004（缓存命中 <200ms） | 通过日志或 DevTools 观察重复查询的网络时长 |
| SC-005（弹窗关闭无残留） | 手动关闭/切换句子检查 DOM |
| SC-006（样式一致） | 设计走查，确保使用现有主题变量 |
