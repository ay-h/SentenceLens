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

### Database Schema Extensions

- [ ] T005 创建数据库迁移脚本 `server/database/migrations/001_add_text_edit_fields.sql`，添加 `has_unsaved_changes` 到 records 表
- [ ] T006 在 `server/database/migrations/001_add_text_edit_fields.sql` 添加 `is_modified`, `is_translation_stale`, `ocr_confidence`, `low_confidence_words` 到 sentences 表
- [ ] T007 创建索引迁移 `server/database/migrations/002_create_indexes.sql`，创建 `idx_sentences_modified` 和 `idx_sentences_confidence` 索引

### Image Preprocessing Infrastructure

- [ ] T008 在 `server/config/preprocess.js` 创建 `ImagePreprocessorConfig` 配置对象，包含 perspective/deskew/adaptiveThreshold/textRegion/contrast/sharpen/denoise 配置
- [ ] T009 在 `server/services/imageProcessor/smartSkip.js` 实现图像质量检测和智能跳过逻辑
- [ ] T010 在 `server/services/imageProcessor/index.js` 创建图像预处理流水线管理器，支持步骤状态跟踪

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

## Phase 4: User Story 2 - 统一翻译按钮 (Priority: P1) 🎯 MVP

**目标**: 用户点击统一的翻译按钮时，系统自动检测文本变化并智能翻译需要翻译的句子

**独立测试**: 用户修改了三句中的第二句，点击翻译按钮后只有第二句被重新翻译，其他句子保持不变

### Tests for User Story 2 (REQUIRED) ⚠️

> **注意：先写这些测试，确保失败后再实现**

- [ ] T023 [P] [US2] 单元测试：统一翻译逻辑（自动检测变化） tests/unit/translation.test.js
- [ ] T024 [P] [US2] 单元测试：无变化检测和提示逻辑 tests/unit/translation.test.js
- [ ] T025 [P] [US2] 单元测试：未保存更改检查 tests/unit/translation.test.js
- [ ] T026 [P] [US2] 集成测试：统一翻译完整流程 tests/integration/translation.test.js

### Implementation for User Story 2

- [x] T027 [P] [US2] 实现统一翻译选择逻辑 server/app.js (依赖 T014)
- [ ] T028 [US2] 修改翻译 API 端点为统一端点 server/app.js (路径: /api/records/:id/translate)
- [ ] T029 [US2] 实现无变化检测和友好提示逻辑 server/services/translation.js
- [ ] T030 [US2] 修改翻译管理组件为统一按钮 frontend/src/components/TextActions.tsx
- [ ] T031 [US2] 添加翻译状态显示和用户反馈（包括无变化提示） frontend/src/components/TextActions.tsx
- [ ] T032 [US2] 集成统一翻译按钮到记录页面 frontend/src/pages/Home.tsx
- [x] T033 [US2] 扩展 API 客户端支持统一翻译 frontend/src/api/index.ts
- [ ] T034 [US2] 添加网络错误处理和重试机制 frontend/src/components/TranslationManager.js

**检查点**: 此时，User Story 1 和 2 应该都可以独立工作

---

## Phase 5: User Story 3 - OCR图像预处理优化 (Priority: P2)

**目标**: 基于最新 clarifications，实现完整的预处理流水线：透视矫正 → 去歪斜 → 自适应二值化 → 文本区域裁剪 → 锐化/降噪，将拍照文档OCR准确率从60%提升至95%+

**独立测试**: 用户上传一张有透视变形、光照不均的试卷照片，系统经过完整预处理后识别准确率提升至95%+

### Tests for User Story 3 (REQUIRED) ⚠️

> **注意：先写这些测试，确保失败后再实现**

- [ ] T035 [P] [US3] 单元测试：透视矫正算法 `tests/unit/imageProcessor/perspective.test.js` (使用 @testimg，目标成功率≥90%)
- [ ] T036 [P] [US3] 单元测试：自适应二值化算法 `tests/unit/imageProcessor/adaptiveThreshold.test.js` (使用 @testimg)
- [ ] T037 [P] [US3] 单元测试：文本区域检测算法 `tests/unit/imageProcessor/textRegion.test.js` (使用 @testimg)
- [ ] T038 [P] [US3] 单元测试：歪斜校正算法 `tests/unit/imageProcessor/deskew.test.js` (使用 @testimg)
- [ ] T039 [P] [US3] 单元测试：智能跳过逻辑 `tests/unit/imageProcessor/smartSkip.test.js`
- [ ] T040 [P] [US3] 集成测试：完整预处理流水线 `tests/integration/ocr-preprocess.test.js` (使用 @testimg，目标总耗时≤6秒)

### New Preprocessing Modules (透视矫正、自适应二值化、文本区域裁剪)

- [ ] T041 [P] [US3] 在 `server/services/imageProcessor/perspective.js` 实现透视矫正模块：Canny边缘检测 → 轮廓查找 → 四边形拟合 → 透视变换
- [ ] T042 [P] [US3] 在 `server/services/imageProcessor/adaptiveThreshold.js` 实现自适应二值化模块：使用 OpenCV.js `adaptiveThreshold(ADAPTIVE_THRESH_GAUSSIAN_C)`
- [ ] T043 [P] [US3] 在 `server/services/imageProcessor/textRegion.js` 实现文本区域检测与裁剪模块：边缘密度分析 + 形态学操作

### Pipeline Integration & API

- [ ] T044 [US3] 在 `server/services/imageProcessor/index.js` 集成所有预处理步骤到流水线（perspective → deskew → adaptiveThreshold → textRegion → contrast → sharpen → denoise）
- [ ] T045 [US3] 在 `server/services/imageProcessor/index.js` 实现预处理进度跟踪和步骤状态管理
- [ ] T046 [US3] 在 `server/services/ocr.js` 集成图像预处理调用，实现 `enablePreprocessing` 参数支持
- [ ] T047 [US3] 在 `server/routes/ocr.js` 实现 `POST /api/ocr/preprocess` 端点
- [ ] T048 [US3] 在 `server/routes/ocr.js` 实现 `POST /api/ocr/recognize` 端点（含预处理选项）
- [ ] T049 [US3] 在 `server/routes/ocr.js` 实现 `GET /api/ocr/preprocess/progress/:sessionId` 进度查询端点
- [ ] T050 [US3] 在 `server/routes/ocr.js` 实现 `POST /api/ocr/preprocess/cancel/:sessionId` 取消预处理端点

### Frontend Components

- [ ] T051 [US3] 在 `frontend/src/components/OCRProgress/PreprocessProgress.tsx` 创建预处理进度显示组件
- [ ] T052 [US3] 在 `frontend/src/api/ocr.ts` 创建OCR预处理API客户端
- [ ] T053 [US3] 在 `frontend/src/components/OCRProgress/hooks/usePreprocessProgress.ts` 创建预处理进度Hook

### Integration

- [ ] T054 [US3] 在 `server/services/ocr.js` 实现清晰图片的智能跳过逻辑（跳过不必要的预处理步骤）
- [ ] T055 [US3] 在 `server/services/imageProcessor/index.js` 实现预处理失败回退逻辑（跳过失败步骤继续OCR）
- [ ] T056 [US3] 扩展 `server/routes/upload.js` 上传端点返回预处理信息

**检查点**: OCR预处理应该将拍照文档识别准确率从60%提升至95%+

### Success Criteria Verification

- [ ] T057 [US3] 验证：透视矫正成功率≥90%（典型书页/试卷照片）
- [ ] T058 [US3] 验证：自适应二值化正确应用率100%（光照不均照片）
- [ ] T059 [US3] 验证：清晰图片预处理跳过率100%
- [ ] T060 [US3] 验证：完整预处理流水线总耗时≤6秒（1920x1080照片）

---

## Phase 6: User Story 4 - OCR结果质量评估 (Priority: P2)

**目标**: 系统能够评估OCR识别结果的质量，并在识别质量低时提示用户

**独立测试**: 用户上传一张低质量照片，系统识别后显示识别质量提示，用户及时进行修正

### Tests for User Story 4 (REQUIRED) ⚠️

> **注意：先写这些测试，确保失败后再实现**

- [ ] T051 [P] [US4] 单元测试：置信度分析 tests/unit/qualityAssessment.test.js
- [ ] T052 [P] [US4] 单元测试：质量阈值判断 tests/unit/qualityAssessment.test.js
- [ ] T053 [P] [US4] 集成测试：质量评估 API 端点 tests/integration/qualityAssessment.test.js

### Implementation for User Story 4

- [x] T054 [P] [US4] 实现置信度分析算法 server/services/imageProcessor.js (依赖 T009)
- [x] T055 [P] [US4] 实现低置信度单词标记逻辑 server/services/imageProcessor.js (依赖 T009)
- [x] T056 [US4] 实现质量评估 API 端点 server/app.js (路径: /api/records/:id/quality)
- [x] T057 [US4] 集成质量评估到记录显示组件 frontend/src/pages/Home.tsx
- [x] T058 [US4] 实现低置信度单词高亮显示 frontend/src/components/QualityIndicator.tsx
- [ ] T059 [US4] 添加质量提示对话框 frontend/src/components/
- [x] T060 [US4] 扩展 API 客户端支持质量评估 frontend/src/api/index.ts

**检查点**: 此时，所有用户故事应该都可以独立功能

---

## Phase 7: User Story 5 - 文本编辑界面布局优化 (Priority: P1)

**目标**: 优化文本编辑界面的排版显示，采用句子级独立编辑模式解决阅读和定位问题

**独立测试**: 用户进入编辑模式，每个句子独立显示，修改的句子高亮显示，编辑按钮与分析按钮并列显示

### Tests for User Story 5 (REQUIRED) ⚠️

> **注意：先写这些测试，确保失败后再实现**

- [ ] T069 [P] [US5] 单元测试：句子级独立编辑组件渲染 tests/unit/sentenceEditor.test.js
- [ ] T070 [P] [US5] 单元测试：修改句子高亮显示逻辑 tests/unit/sentenceEditor.test.js
- [ ] T071 [P] [US5] 单元测试：编辑按钮与分析按钮集成 tests/unit/sentenceEditor.test.js
- [ ] T072 [P] [US5] 集成测试：文本编辑布局优化完整流程 tests/integration/sentenceEditor.test.js

### Implementation for User Story 5

- [ ] T073 [P] [US5] 创建句子级独立编辑组件 `frontend/src/components/TextEditor/SentenceEditItem.tsx`
- [ ] T074 [P] [US5] 创建文本编辑面板组件 `frontend/src/components/TextEditor/TextEditPanel.tsx`
- [ ] T075 [US5] 实现修改句子高亮显示逻辑 `frontend/src/components/TextEditor/SentenceEditItem.tsx`
- [ ] T076 [US5] 实现8-12px间距布局 `frontend/src/components/TextEditor/TextEditPanel.tsx`
- [ ] T077 [US5] 集成编辑按钮与分析按钮并列显示 `frontend/src/pages/RecordDetail/TextEditableView.tsx`
- [ ] T078 [US5] 创建文本编辑状态管理Hook `frontend/src/components/TextEditor/hooks/useTextEdit.ts`

**检查点**: 此时，User Story 5 应该完全功能并可独立测试

---

## Phase 8: Polish & 跨切关注点

**目的**: 影响多个用户故事的改进

- [ ] T079 [P] 文档更新：更新 README.md 和 API 文档
- [ ] T080 [P] 代码清理和重构
- [ ] T081 [P] 性能优化：预处理结果缓存
- [ ] T082 [P] 性能优化：批量数据库更新
- [ ] T083 [P] 安全加固：输入验证和清理
- [ ] T084 运行 quickstart.md 验证
- [ ] T085 [P] 确保 electron-builder 正确打包 OpenCV.js WASM

---

## Parallel Example: User Story 3 (OCR预处理)

```bash
# 一起启动 User Story 3 的所有测试：
Task: "单元测试：透视矫正算法"
Task: "单元测试：自适应二值化算法"
Task: "单元测试：文本区域检测算法"
Task: "集成测试：完整预处理流水线"

# 一起启动 User Story 3 的所有模块：
Task: "实现透视矫正模块"
Task: "实现自适应二值化模块"
Task: "实现文本区域检测模块"
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
4. 添加 User Story 5 → 独立测试 → 部署/演示 (布局优化)
5. 添加 User Story 3 → 独立测试 → 部署/演示
6. 添加 User Story 4 → 独立测试 → 部署/演示
7. 每个故事添加值而不打破之前的故事

### Parallel Team Strategy

有多个开发人员：

1. 团队一起完成 Setup + Foundational
2. 一旦 Foundational 完成：
   - 开发人员 A: User Story 1
   - 开发人员 B: User Story 2
   - 开发人员 C: User Story 5 (布局优化)
   - 开发人员 D: User Story 3 + 4 (可能）
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
