# Implementation Plan: TextActions 工具栏与输入栏交互优化

**Branch**: `002-textactions-layout` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-textactions-layout/spec.md`

## Summary

对主内容区上方的 TextActions 工具栏进行布局优化（删除按钮与其余按钮并排、保持危险操作视觉区分），同时移除底部 BottomBar，将句子级操作改为内联按钮。底部 InputBar 的 textarea 需支持随内容增高（上限 220px），到达上限时出现滚动条并在发送/清空后恢复默认高度。

## Technical Context

**Language/Version**: TypeScript 5.9 + React 19（Vite 工程）  
**Primary Dependencies**: lucide-react、sonner、应用现有样式变量（Tailwind/Vite 环境）  
**Storage**: 不涉及数据结构调整（沿用现有前端状态管理）  
**Testing**: 计划使用 Vitest + React Testing Library（若资源不足可先手动回归）  
**Target Platform**: Electron 桌面应用（Windows/macOS/Linux）  
**Project Type**: 桌面应用（Electron + React 前端）  
**Performance Goals**: UI 操作无明显卡顿，输入框自适应动画流畅  
**Constraints**: 必须保持离线可用、UI 变化兼容三平台、所有文档中文  
**Scale/Scope**: 单页交互优化（影响 TextActions、TextDisplay、InputBar、Home 布局）

## Constitution Check

| 原则 | 评估 | 说明 |
|------|------|------|
| 跨平台一致性 | ✅ | 仅前端布局和交互调整，不引入平台特定 API |
| 离线优先架构 | ✅ | 无网络依赖变化，仍离线运行 |
| 集成质量 | ✅ | 不改动后端接口，前端状态管理保持稳定 |
| 可观测性 | ✅ | 维持现有 toast 提示，不移除任何日志/提示 |
| 简单性 | ✅ | 使用简单的布局与状态更新方案（移除 BottomBar、内联按钮） |
| 中文文档编写 | ✅ | 计划与产出文档全为中文 |

## Project Structure

### Documentation (this feature)

```text
specs/002-textactions-layout/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/        # 预计不需要产出文件
```

### Source Code (repository root)

```text
frontend/
└── src/
    ├── components/
    │   ├── TextActions.tsx      # 调整工具栏布局
    │   ├── TextDisplay.tsx      # 新增句子内联操作区
    │   ├── BottomBar.tsx        # 将被移除
    │   └── InputBar.tsx         # 文本框自适应高度
    ├── pages/
    │   └── Home.tsx             # 移除 BottomBar 引用
    └── store/
        └── AppContext.tsx       # 复用现有上下文
```

**Structure Decision**: 仅涉及现有 `frontend/src/components` 与 `frontend/src/pages` 下的 React 组件，符合当前项目组织方式，无需新增目录。

## Complexity Tracking

（无章程豁免，留空）

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|

## Phase 0 — Research

### 0.1 研究目标
- 验证内联按钮与翻译文本共存时的可访问性（颜色对比、点击区域).
- 评估 textarea 自适应高度实现方式（纯 CSS vs. JavaScript 控制）。

### 0.2 研究任务
1. 调研 React 中常见的 textarea 自动增高实现方案（包含 scrollHeight 重置技巧）。
2. 查阅富文本编辑器/评论组件中内联操作按钮的 UX 设计案例，确认最佳间距与 hover 样式。
3. 确认现有 `useApp` store 对句子分析状态的同步逻辑，确保移除 BottomBar 不影响函数调用。

### 0.3 输出
- `research.md`（已完成）记录结论、理由及备选方案。

## Phase 1 — 设计与契约

### 1.1 数据模型
- 无新增后端数据结构，仅在前端界面层引入「句子内联操作区」这一 UI 实体。
- 在 `data-model.md` 中描述：句子对象包含 `hasAnalysis`、`isSelected`、`translation` 等现有字段如何驱动 UI 状态。

### 1.2 接口契约
- 无新增 API：沿用 `handleAnalyze`、`handleDeleteAnalysis`、`handleSendText`。
- 在 `contracts/` 中无需新增文件（保留空目录或省略）。

### 1.3 Quickstart 与 Agent Context
- 在 `quickstart.md` 中写明：本功能需运行 `npm run dev`，重点关注前端组件文件。
- 已执行 `update-agent-context.ps1`，Windsurf agent 已更新到最新上下文。

### 1.4 设计交付物
- `data-model.md`（说明 UI 状态流转）
- `quickstart.md`（开发/验证指引）
- `contracts/` 目录（可留空）

## Phase 2 — 实施规划（待 `/speckit.tasks` 完成）

此阶段将在 `/speckit.tasks` 中细化任务，这里先给出实施大纲：

1. **TextActions 工具栏调整**
   - 移除 `flex-1` 占位符，按钮组合成 `flex` 容器。
   - 保留删除按钮红色风格，前置分隔线或额外 `ml`。
2. **句子内联操作区**
   - 在 `TextDisplay.tsx` 中渲染操作按钮组，绑定 `handleAnalyze`、`handleDeleteAnalysis`、`cancelSelection`。
   - 支持 loading/disabled、翻译开关场景。
3. **移除 BottomBar**
   - 删除组件文件与 `Home.tsx` 引用；确认无死代码。
4. **InputBar textarea 自适应**
   - 使用 `useRef` + `useLayoutEffect` 动态调整高度。
   - 设置 `maxHeight: 220px` 与 `overflowY: auto`。
   - 发送成功后将高度重置为 `minHeight`。
5. **回归测试**
   - 验证文本发送、句子分析、翻译显示、删除记录等主流程。
   - 检查多平台自适应（至少缩放窗口尺寸）。

## 风险与缓解

| 风险 | 影响 | 缓解策略 |
|------|------|-----------|
| textarea 自动增高导致布局抖动 | 中 | 使用 `requestAnimationFrame` 或在更新前先重置高度，确保动画平滑 |
| 句子内联按钮覆盖翻译文本 | 中 | 在 CSS 中定义明确的 `mt` 间距，并在 Edge Case 中测试 |
| 移除 BottomBar 后遗留未引用代码 | 低 | 全局搜索 `BottomBar`，确保组件与样式均删除 |

## 测试计划

1. **手动测试**：
   - 上传图片/粘贴文本 → 生成句子 → 逐条分析与删除，确认 UI 按钮状态正确。
   - 输入超过 8 行文本，确认滚动条出现且发送后重置高度。
   - 切换“显示翻译”开关，确保翻译文本与操作按钮布局正确。
2. **自动化测试**（可选但推荐）：
   - 使用 Vitest + React Testing Library 编写组件测试，模拟句子选中与按钮点击。
   - 对 InputBar 做快照或行为测试（检查高度属性）。

## 验收标准对齐

| 成功指标 | 验证方式 |
|-----------|----------|
| SC-001/002（工具栏按钮紧凑且危险操作区分） | 视觉审查 + DOM class 检查 |
| SC-005/006/007（句子内联操作） | 手动选中句子、切换翻译、取消选中 |
| SC-008/009（InputBar 高度与滚动） | 连续输入 >8 行文本，观察高度与滚动条，并在发送后检查高度重置 |

