# Tasks: 文本可编辑和OCR识别优化

**Input**: Design documents from `/specs/004-text-edit-ocr-improve/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 本功能包含单元测试和集成测试

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Electron 主进程**: `main.js`
- **后端**: `server/` 目录
- **前端**: `frontend/src/` 目录
- **测试**: `tests/unit/` 和 `tests/integration/` 目录

---

## Phase 1: Setup (共享基础设施)

**目的**: 项目初始化和基础结构

- [x] T001 安装 opencv.js 依赖到 package.json
- [x] T002 [P] 创建图像预处理服务基础结构 server/services/imageProcessor.js
- [x] T003 [P] 创建文本编辑服务基础结构 server/services/textEdit.js
- [x] T004 配置 electron-builder asarUnpack 包含 opencv.js WASM 文件

**检查点**: 基础设施就绪 - 用户故事实现现在可以开始

---

## Phase 2: Foundational (阻塞前置条件)

**目的**: 所有用户故事必须完成的核心基础设施

**⚠️ 关键**: 任何用户故事工作不能在此阶段完成之前开始

- [x] T005 执行数据库迁移：添加文本编辑相关字段
- [x] T006 执行数据库迁移：添加 OCR 质量评估字段
- [x] T007 执行数据库迁移：创建优化索引
- [x] T008 扩展句子分割服务支持变更检测
- [x] T009 实现 OCR 质量评估基础功能
- [x] T010 配置图像预处理参数和阈值

**检查点**: 基础设施就绪 - 用户故事实现现在可以开始

---

## Phase 3: User Story 1 - 文本内容可编辑 (Priority: P1) 🎯 MVP

**目标**: 用户可以自由编辑记录中的文本内容，系统自动检测句子变化并清除相关翻译和分析

**独立测试**: 用户上传图片后识别出文本，编辑其中错误的单词，保存后文本被更新且相关的翻译和分析被清除

### Tests for User Story 1 (REQUIRED) ⚠️

> **注意：先写这些测试，确保失败后再实现**

- [x] T011 [P] [US1] 单元测试：句子变更检测逻辑 tests/unit/textEdit.test.js
- [x] T012 [P] [US1] 单元测试：翻译清除逻辑 tests/unit/textEdit.test.js
- [x] T013 [P] [US1] 集成测试：文本编辑完整流程 tests/integration/textEdit.test.js

### Implementation for User Story 1

- [x] T014 [P] [US1] 实现句子变更检测算法 server/services/sentenceSplit.js (依赖 T008)
- [x] T015 [US1] 实现文本编辑保存 API 端点 server/app.js (路径: /api/records/:id/text/edit)
- [x] T016 [US1] 实现记录未保存更改状态管理 server/models/database.js
- [x] T017 [US1] 实现句子翻译和分析清除逻辑 server/services/textEdit.js
- [x] T018 [US1] 创建文本编辑组件 frontend/src/components/TextEditor.tsx
- [x] T019 [US1] 集成文本编辑到记录页面 frontend/src/pages/Home.tsx
- [x] T020 [US1] 扩展 API 客户端支持文本编辑 frontend/src/api/index.ts
- [ ] T021 [US1] 添加用户编辑确认对话框（删除所有句子时）frontend/src/components/
- [x] T022 [US1] 添加文本编辑错误处理和用户提示 frontend/src/components/TextEditor.tsx

**检查点**: 此时，User Story 1 应该完全功能并可独立测试

---

## Phase 4: User Story 2 - 智能重新翻译 (Priority: P1) 🎯 MVP

**目标**: 用户修改文本后，可以只重新翻译有变化的句子，而不是整篇重新翻译

**独立测试**: 用户修改了三句中的第二句，点击翻译按钮后只有第二句被重新翻译

### Tests for User Story 2 (REQUIRED) ⚠️

> **注意：先写这些测试，确保失败后再实现**

- [ ] T023 [P] [US2] 单元测试：句子选择逻辑 tests/unit/translation.test.js
- [ ] T024 [P] [US2] 单元测试：未保存更改检查 tests/unit/translation.test.js
- [ ] T025 [P] [US2] 集成测试：智能翻译完整流程 tests/integration/translation.test.js

### Implementation for User Story 2

- [x] T026 [P] [US2] 实现智能翻译选择逻辑 server/app.js (依赖 T014)
- [x] T027 [US2] 实现智能翻译 API 端点 server/app.js (路径: /api/records/:id/translate/smart)
- [x] T028 [US2] 修改翻译管理组件支持智能翻译 frontend/src/components/TextActions.tsx
- [x] T029 [US2] 添加翻译进度显示和用户反馈 frontend/src/components/TextActions.tsx
- [x] T030 [US2] 集成智能翻译按钮到记录页面 frontend/src/pages/Home.tsx
- [x] T031 [US2] 扩展 API 客户端支持智能翻译 frontend/src/api/index.ts
- [ ] T032 [US2] 添加网络错误处理和重试机制 frontend/src/components/TranslationManager.js

**检查点**: 此时，User Story 1 和 2 应该都可以独立工作

---

## Phase 5: User Story 3 - OCR图像预处理优化 (Priority: P2)

**目标**: 系统能够自动识别并处理图像质量问题质量问题，提高拍照文档的OCR识别准确率

**独立测试**: 用户上传一张拍摄不理想的试卷照片，系统能够识别文字并准确率明显提高

### Tests for User Story 3 (REQUIRED) ⚠️

> **注意：先写这些测试，确保失败后再实现**

- [ ] T033 [P] [US3] 单元测试：歪斜校正算法 tests/unit/imageProcessor.test.js (使用 @testimg)
- [ ] T034 [P] [US3] 单元测试：对比度调整算法 tests/unit/imageProcessor.test.js (使用 @testimg)
- [ ] T035 [P] [US3] 单元测试：锐化算法 tests/unit/imageProcessor.test.js (使用 @testimg)
- [ ] T036 [P] [US3] 单元测试：降噪算法 tests/unit/imageProcessor.test.js (使用 @testimg)
- [ ] T037 [P] [US3] 集成测试：图像预处理完整流程 tests/integration/imageProcessor.test.js (使用 @testimg)

### Implementation for User Story 3

- [x] T038 [P] [US3] 实现投影法歪斜校正 server/services/imageProcessor.js (使用 opencv.js，依赖 T002)
- [x] T039 [P] [US3] 实现 CLAHE 对比度调整 server/services/imageProcessor.js (使用 opencv.js，依赖 T002)
- [x] T040 [P] [US3] 实现 Unsharp Mask 锐化 server/services/imageProcessor.js (使用 opencv.js，依赖 T002)
- [x] T041 [P] [US3] 实现双边滤波降噪 server/services/imageProcessor.js (使用 opencv.js，依赖 T002)
- [x] T042 [US3] 集成图像预处理流水线 server/services/imageProcessor.js
- [ ] T043 [US3] 集成图像预处理到 OCR 服务 server/services/ocr.js
- [x] T044 [US3] 创建 OCR 预处理状态组件 frontend/src/components/OCRStatus.tsx
- [x] T045 [US3] 添加预处理进度显示 frontend/src/components/OCRStatus.tsx
- [x] T046 [US3] 集成预处理状态到输入栏 frontend/src/components/InputBar.tsx
- [ ] T047 [US3] 扩展上传 API 端点支持预处理信息 server/app.js
- [x] T048 [US3] 添加预处理超时处理和取消功能 frontend/src/components/OCRStatus.tsx

**检查点**: 此时，User Story 3 应该可以独立工作并与现有 OCR 流程集成

---

## Phase 6: User Story 4 - OCR结果质量评估 (Priority: P2)

**目标**: 系统能够评估OCR识别结果的质量，并在识别质量低时提示用户

**独立测试**: 用户上传一张低质量照片，系统识别后显示识别质量提示，用户及时进行修正

### Tests for User Story 4 (REQUIRED) ⚠️

> **注意：先写这些测试，确保失败后再实现**

- [ ] T049 [P] [US4] 单元测试：置信度分析 tests/unit/qualityAssessment.test.js
- [ ] T050 [P] [US4] 单元测试：质量阈值判断 tests/unit/qualityAssessment.test.js
- [ ] T051 [P] [US4] 集成测试：质量评估 API 端点 tests/integration/qualityAssessment.test.js

### Implementation for User Story 4

- [x] T052 [P] [US4] 实现置信度分析算法 server/services/imageProcessor.js (依赖 T009)
- [x] T053 [P] [US4] 实现低置信度单词标记逻辑 server/services/imageProcessor.js (依赖 T009)
- [x] T054 [US4] 实现质量评估 API 端点 server/app.js (路径: /api/records/:id/quality)
- [x] T055 [US4] 集成质量评估到记录显示组件 frontend/src/pages/Home.tsx
- [x] T056 [US4] 实现低置信度单词高亮显示 frontend/src/components/QualityIndicator.tsx
- [ ] T057 [US4] 添加质量提示对话框 frontend/src/components/
- [x] T058 [US4] 扩展 API 客户端支持质量评估 frontend/src/api/index.ts

**检查点**: 此时，所有用户故事应该都可以独立功能

---

## Phase 7: Polish & 跨切关注点

**目的**: 影响多个用户故事的改进

- [ ] T059 [P] 文档更新：更新 README.md 和 CLAUDE.md
- [ ] T060 [P] 代码清理和重构
- [ ] T061 [P] 性能优化：预处理结果缓存
- [ ] T062 [P] 性能优化：批量数据库更新
- [ ] T063 [P] 安全加固：输入验证和清理
- [ ] T064 运行 quickstart.md 验证
- [ ] T065 [P] 更新 electron-builder 配置确保正确打包
- [ ] T066 [P] 集成测试覆盖率报告

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖 - 可以立即开始
- **Foundational (Phase 2)**: 依赖 Setup 完成 - 阻塞所有用户故事
- **User Stories (Phase 3+)**: 所有依赖 Foundational 阶段完成
  - 用户故事可以随后并行进行（如果有人力）
  - 或按优先级顺序执行（P1 → P2 → P3）
- **Polish (Final Phase)**: 依赖所有期望的用户故事完成

### User Story Dependencies

- **User Story 1 (P1)**: 可以在 Foundational (Phase 2) 后开始 - 不依赖其他故事
- **User Story 2 (P1)**: 可以在 Foundational (Phase 2) 后开始 - 可能与 US1 集成，但应独立测试
- **User Story 3 (P2)**: 可以在 Foundational (Phase 2) 后开始 - 与 US1/US2 集成但应独立测试
- **User Story 4 (P2)**: 可以在 Foundational (Phase 2) 后开始 - 可以独立工作或与 US3 集成

### Within Each User Story

- 测试（如果包含）必须在实现前编写并失败
- 模型在服务前
- 服务在端点前
- 核心实现在集成前
- 故事完成后才能移动到下一优先级

### Parallel Opportunities

- 所有 Setup 任务标记 [P] 可以并行运行
- 所有 Foundational 任务标记 [P] 可以并行运行（在 Phase 2 内）
- 一旦 Foundational 阶段完成，所有用户故事可以开始并行（如果团队容量允许）
- 用户故事的所有测试标记 [P] 可以并行运行
- 用户故事内的模型标记 [P] 可以并行运行
- 不同用户故事可以由不同团队成员并行工作

---

## Parallel Example: User Story 1

```bash
# 一起启动 User Story 1 的所有测试：
Task: "单元测试：句子变更检测逻辑"
Task: "单元测试：翻译清除逻辑"
Task: "集成测试：文本编辑完整流程"

# 一起启动 User Story 1 的所有模型：
Task: "实现句子变更检测算法"
Task: "实现句子翻译和分析清除逻辑"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational (关键 - 阻塞所有故事)
3. 完成 Phase 3: User Story 1
4. **停止并验证**: 独立测试 User Story 1
5. 如果准备就绪，部署/演示

### Incremental Delivery

1. 完成 Setup + Foundational → 基础设施就绪
2. 添加 User Story 1 → 独立测试 → 部署/演示 (MVP!)
3. 添加 User Story 2 → 独立测试 → 部署/演示
4. 添加 User Story 3 → 独立测试 → 部署/演示
5. 添加 User Story 4 → 独立测试 → 部署/演示
6. 每个故事添加值而不破坏之前的故事

### Parallel Team Strategy

有多个开发人员：

1. 团队一起完成 Setup + Foundational
2. 一旦 Foundational 完成：
   - 开发人员 A: User Story 1
   - 开发人员 B: User Story 2
   - 开发人员 C: User Story 3 + 4 (可能）
3. 故事独立完成并集成

---

## Notes

- [P] 任务 = 不同文件，无依赖
- [Story] 标签将任务映射到特定用户故事以进行追溯
- 每个用户故事应该可以独立完成和测试
- 验证测试在实现前失败
- 每个任务或逻辑组后提交
- 在任何检查点停止以独立验证故事
- 避免：模糊任务，相同文件冲突，打破故事独立性的跨故事依赖
