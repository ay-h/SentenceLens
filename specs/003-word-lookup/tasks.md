# Tasks: 单词查询弹窗

**Input**: Specification/plan in `/specs/003-word-lookup/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 确保环境、词库资源与文档模板就绪

- [x] T001 安装/更新根目录与 `frontend/`、`server/` 的依赖（`package.json`、`frontend/package.json`）
- [x] T002 创建 `data/dictionary/` 目录（ECDICT 词库文件需用户自行放置）（若路径不存在需创建）
- [x] T003 研读 `spec.md`、`plan.md`，标记关键验收与技术约束（`specs/003-word-lookup/`）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 调研技术细节，填充研究与设计文档，为实现解锁上下文

- [x] T004 分析前端句子渲染现状，记录拆分策略（`frontend/src/components/TextDisplay.tsx`）
- [x] T005 审阅后端 LLM/数据库模块，评估词典与缓存扩展方式（`server/services/llm.js`、`server/models/database.js`）
- [x] T006 完成研究结论并撰写 `research.md`（`specs/003-word-lookup/research.md`）
- [x] T007 在 `data-model.md` 定义查词实体与状态（`specs/003-word-lookup/data-model.md`）
- [x] T008 编写 `contracts/word-lookup.md` 描述新 API 契约（`specs/003-word-lookup/contracts/word-lookup.md`）
- [x] T009 更新 `quickstart.md`，加入词库安装与验证步骤（`specs/003-word-lookup/quickstart.md`）

**Checkpoint**: 研究与设计文档齐备，可进入用户故事实现

---

## Phase 3: User Story 1 – 双击查词弹窗 (Priority: P1)

**Goal**: 双击单词弹出释义弹窗
**Independent Test**: 双击单词 → 弹窗显示释义信息

- [x] T010 [US1] 为句子内容生成单词级 `<span>`，绑定 `dblclick` 并阻止与单击冲突（`frontend/src/components/TextDisplay.tsx`）
- [x] T011 [US1] 新建 `WordLookupPopover` 组件，包含定位与关闭逻辑（`frontend/src/components/WordLookupPopover.tsx`）
- [x] T012 [US1] 实现前端查词状态管理（loading/成功/失败）与 API 调用封装（`frontend/src/hooks/useWordLookup.ts`）
- [ ] T013 [US1] 手动验证：双击单词显示释义；弹窗可点击外部关闭（手动场景）

**Checkpoint**: 查词弹窗核心交互可用

---

## Phase 4: User Story 2 – 查词与选句共存 (Priority: P1)

**Goal**: 查词与句子分析互不干扰
**Independent Test**: 交替执行双击查词与单击选句保持正常

- [x] T014 [US2] 调整选句逻辑（单击）与查词逻辑（双击）事件节流，防止互相触发（`frontend/src/components/TextDisplay.tsx`）
- [x] T015 [US2] 在句子切换/取消选中时自动关闭查词弹窗并复位状态（`frontend/src/hooks/useWordLookup.ts`）
- [ ] T016 [US2] 手动验证：查词弹窗开启后单击句子仍可选中；切换句子弹窗关闭（手动场景）

**Checkpoint**: 查词与选句流程顺畅

---

## Phase 5: User Story 3 – 弹窗内容展示 (Priority: P2)

**Goal**: 弹窗内展示完整词义信息
**Independent Test**: 弹窗格式包含单词、词性、释义，无发音按钮

- [x] T017 [US3] 定义 `WordDefinition` 渲染结构，支持多词性/多释义（`frontend/src/components/WordLookupPopover.tsx`）
- [x] T018 [US3] 实现中文排版、词性标注与滚动（必要时），确保样式与主题一致（`frontend/src/components/WordLookupPopover.tsx`、`frontend/src/index.css`）
- [ ] T019 [US3] 手动验证常见/多词性单词弹窗内容正确、无音频按钮（手动场景）

**Checkpoint**: 弹窗展示满足内容体验

---

## Phase 6: User Story 4 – 词库与 LLM 兜底 (Priority: P2)

**Goal**: 后端优先离线词库，未命中时调用 LLM
**Independent Test**: 词库命中直接返回；词库无条目时触发 LLM 并缓存

- [x] T020 [US4] 新增词典服务 `dictionary.js`，实现本地 SQLite 查询（`server/services/dictionary.js`）
- [x] T021 [US4] 在 `app.js` 添加 `/api/word-lookup` 路由：词库 → LLM → 缓存流程（`server/app.js`）
- [x] T022 [US4] 拓展数据库，创建 `word_definitions` 表及 CRUD 方法（`server/models/database.js`）
- [x] T023 [US4] 在 `services/llm.js` 实现 `lookupWord` 并复用现有配置（`server/services/llm.js`）
- [x] T024 [US4] 配置 electron-builder `extraResources` 或资源复制脚本，确保词库打包分发（`package.json`、`electron-builder` 配置文件）
- [x] T025 [US4] 编写后端单元/集成测试：词库命中、LLM fallback、错误路径（`server/tests/word-lookup.test.ts` 或等效）
- [ ] T026 [US4] 手动验证：断网 + 常见单词命中；冷僻词触发 LLM 并缓存（手动场景）

**Checkpoint**: 后端查词服务可离线运行并支持 LLM 兜底

---

## Phase 7: User Story 5 – 查词结果缓存 (Priority: P3)

**Goal**: 缓存重复查询，提升响应速度
**Independent Test**: 第二次查询相同单词 <200ms

- [x] T027 [US5] 增加缓存策略（后端 sqlite + 前端内存），设定过期逻辑（`server/services/dictionary.js`、`frontend/src/hooks/useWordLookup.ts`）
- [x] T028 [US5] 在 API 响应中返回 `cached` 状态并在 UI 中提示（`server/app.js`、`frontend/src/components/WordLookupPopover.tsx`）
- [ ] T029 [US5] 性能验证：记录首次/再次查词耗时，确认缓存命中（手动场景或日志）

**Checkpoint**: 缓存生效，命中快速

---

## Phase 8: Polish & Cross-cutting

**Purpose**: 文档、日志与回归检查

- [x] T030 [P] 更新 `quickstart.md` 与 `spec.md` 成果摘要，注明缓存策略与打包注意（`specs/003-word-lookup/quickstart.md`、`specs/003-word-lookup/spec.md`）
- [x] T031 运行 `npm run build` / `npm run lint` 确认无错误（`frontend/`、`server/`）
- [ ] T032 完成终端回归：在 Electron 应用中全量走查查词/选句/分析流程（手动场景）
- [x] T033 汇总验收，更新 `spec.md` 成功指标状态（`specs/003-word-lookup/spec.md`）

---

## Dependencies & Execution Order

1. Setup → Foundational → 各用户故事 → Polish
2. US1、US2（P1）需先完成前端交互基础
3. US3、US4 依赖 US1/US2 的 UI/事件框架；US4 完成后方可验证 US5 缓存
4. US5 在后端缓存完成后执行

## Parallel Opportunities

- [P] 标记任务（如 T030）可与实现并行
- 后端工作（US4/US5）与前端视觉（US3）可并行进行，但需约定 API 契约
- 研究/文档任务（T006~T009）可在不同成员间拆分

## Implementation Strategy

- **MVP**：完成 US1 + US2 + 基础词库查询（US4 前半段）即可交付首个可用版本
- **Incremental**：
  1. MVP 后加强弹窗展示（US3）
  2. 集成 LLM fallback 与打包（完成 US4）
  3. 引入缓存与性能优化（US5）
  4. 最后执行 Polish 阶段回归与文档收尾
