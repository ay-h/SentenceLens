# Tasks: TextActions 工具栏与输入栏交互优化

**Input**: Design documents from `/specs/002-textactions-layout/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 确认开发环境、文档与基线状态

- [x] T001 在仓库根目录安装依赖（`package.json`、`frontend/package.json`）
- [x] T002 研读规格与实施计划，标记关键验收点（`specs/002-textactions-layout/spec.md`、`plan.md`）
- [x] T003 启动前端开发服务器验证现状（`frontend/`）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 了解共享样式与状态管理，为后续实现打基础

- [x] T004 梳理按钮与文本颜色变量，记录复用策略（`frontend/src/index.css`）
- [x] T005 审阅句子/记录相关 store 方法，明确调用约束（`frontend/src/store/useAppStore.ts`）

**Checkpoint**: 样式变量与 store 行为清晰，可开展用户故事开发

---

## Phase 3: User Story 1 - 统一按钮排列 (Priority: P1) 🎯 MVP

**Goal**: 重命名/翻译/删除按钮并排显示，无多余空白
**Independent Test**: 打开任意记录，确认按钮水平紧凑排列

### Implementation for User Story 1

- [x] T006 [US1] 调整工具栏主容器，移除 `flex-1` 占位并整理 `gap`（`frontend/src/components/TextActions.tsx`）
- [x] T007 [US1] 更新翻译切换位置，使其紧邻按钮组（`frontend/src/components/TextActions.tsx`）
- [x] T008 [US1] 手动验证工具栏渲染效果，截取前后对比（`frontend/src/components/TextActions.tsx`）

**Checkpoint**: TextActions 按钮组合紧凑，删除按钮不再漂移

---

## Phase 4: User Story 4 - 内联句子操作按钮 (Priority: P1)

**Goal**: 移除 BottomBar，选中句子下方出现操作按钮
**Independent Test**: 选中句子时操作按钮在句子与翻译下方出现

### Implementation for User Story 4

- [x] T009 [US4] 移除 `Home.tsx` 对 BottomBar 的引用并清理布局（`frontend/src/pages/Home.tsx`）
- [x] T010 [US4] 删除或清空 `BottomBar.tsx`，保留导出占位避免引用（`frontend/src/components/BottomBar.tsx`）
- [x] T011 [US4] 在 `TextDisplay.tsx` 渲染句子下方操作按钮组（分析/删除分析/✕）（`frontend/src/components/TextDisplay.tsx`）
- [x] T012 [US4] 为内联按钮添加基础样式与布局顺序（`frontend/src/components/TextDisplay.tsx`）
- [x] T013 [US4] 手动验证句子选择流程，确认底部不再出现 BottomBar（`frontend/src/components/TextDisplay.tsx`）

**Checkpoint**: BottomBar 完整移除，句子操作可在正文内完成

---

## Phase 5: User Story 6 - InputBar 自适应高度 (Priority: P1)

**Goal**: 文本输入框随内容增高，上限 220px，发送后复位
**Independent Test**: 输入 8 行文本出现滚动条，发送后高度复原

### Implementation for User Story 6

- [x] T014 [US6] 使用 `useRef` / `useLayoutEffect` 实现 textarea 自动增高（`frontend/src/components/InputBar.tsx`）
- [x] T015 [US6] 限制最大高度为 220px 并启用垂直滚动（`frontend/src/components/InputBar.tsx`）
- [x] T016 [US6] 在发送/清空后重置高度与滚动状态（`frontend/src/components/InputBar.tsx`）
- [x] T017 [US6] 手动验证不同输入长度下的高度与滚动行为（`frontend/src/components/InputBar.tsx`）

**Checkpoint**: InputBar 自动调节高度并正确复原

---

## Phase 6: User Story 2 - 删除按钮视觉区分 (Priority: P2)

**Goal**: 删除按钮与普通按钮在视觉上明显区分
**Independent Test**: 观察工具栏，删除按钮以危险样式呈现且有额外间距

### Implementation for User Story 2

- [x] T018 [US2] 为删除按钮添加额外 `ml`/分隔元素（`frontend/src/components/TextActions.tsx`）
- [x] T019 [US2] 强化危险配色与 hover 状态，防止与普通按钮混淆（`frontend/src/components/TextActions.tsx`）
- [x] T020 [US2] 手动审核不同记录场景的颜色与间距（`frontend/src/components/TextActions.tsx`）

**Checkpoint**: 删除按钮危险提示清晰

---

## Phase 7: User Story 3 - 工具栏整体视觉优化 (Priority: P2)

**Goal**: 工具栏在有/无翻译时都保持紧凑、层次清晰
**Independent Test**: 切换“显示翻译”两种状态均无多余空白

### Implementation for User Story 3

- [x] T021 [US3] 优化工具栏容器 padding 与背景，确保视觉一致（`frontend/src/components/TextActions.tsx`）
- [x] T022 [US3] 调整响应式行为，避免窄屏溢出并保持按钮对齐（`frontend/src/components/TextActions.tsx`）
- [x] T023 [US3] 在有/无翻译状态下回归视觉检查（`frontend/src/components/TextActions.tsx`）

**Checkpoint**: 工具栏视觉层次与响应式表现达标

---

## Phase 8: User Story 5 - 取消选择句子 (Priority: P2)

**Goal**: ✕ 按钮与再次点击句子均可取消选中
**Independent Test**: 通过两种方式取消选中并验证状态

### Implementation for User Story 5

- [x] T024 [US5] 实现 ✕ 按钮调用 `cancelSelection` 并反馈 UI（`frontend/src/components/TextDisplay.tsx`）
- [x] T025 [US5] 更新 `handleSelectSentence` 逻辑，支持点击同一句子触发取消（`frontend/src/components/TextDisplay.tsx`）
- [x] T026 [US5] 手动验证切换句子与取消流程（`frontend/src/components/TextDisplay.tsx`）

**Checkpoint**: 句子选中/取消交互流畅

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: 文档、质量检查与回归

- [x] T027 更新快速指引，记录新交互验证步骤（`specs/002-textactions-layout/quickstart.md`）
- [x] T028 运行前端 Lint/构建确保无错误（`frontend/`）
- [x] T029 汇总验收结果，确认 SC-001~SC-009 全部达成（`specs/002-textactions-layout/spec.md`）

---

## Dependencies & Execution Order

### Phase Dependencies
- Setup → Foundational → 各用户故事 → Polish
- Phase 3、4、5 (P1) 可在 Foundational 完成后并行推进
- Phase 6、7、8 (P2) 建议在 P1 故事完成或稳定后进行

### User Story Dependencies
- US1、US4、US6（P1）彼此独立但可能修改同一文件，需协调合并顺序
- US2、US3 依赖 US1 产出的基础布局
- US5 依赖 US4 完成内联操作区

### Within Each User Story
- 代码修改完成后再执行手动验证任务
- 同一文件的任务按顺序执行以避免冲突

### Parallel Opportunities
- Phase 1 tasks 可由不同成员并行处理
- US4（`TextDisplay.tsx`）与 US6（`InputBar.tsx`）涉及不同文件，可并行
- US2 与 US3 修改同文件，需串行进行
- Polish 阶段任务 T027 与 T028 可并行，T029 需在所有实现完成后执行

---

## Parallel Example

- 并行方案 1：一人负责 US4（`TextDisplay.tsx`），另一人负责 US6（`InputBar.tsx`）。
- 并行方案 2：在 US4 完成后，一人处理 US5 交互逻辑，另一人继续打磨 US2/US3 工具栏视觉。

---

## Implementation Strategy

### MVP（聚焦 P1 故事）
1. 完成 Setup 与 Foundational。
2. 实施 US1 → 审核按钮排列。
3. 实施 US4 → 确认内联操作替代 BottomBar。
4. 实施 US6 → 验证 InputBar 自适应高度。
5. 运行手动验证，形成首个可交付版本。

### 增量迭代
- 第二迭代：US2 + US3 完成危险按钮与整体视觉优化。
- 第三迭代：US5 完善取消交互，并执行 Polish 任务确保质量。
