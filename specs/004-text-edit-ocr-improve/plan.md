# Implementation Plan: 文本可编辑和OCR识别优化

**Branch**: `004-text-edit-ocr-improve` | **Date**: 2026-04-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-text-edit-ocr-improve/spec.md`

## Summary

本功能包含两个主要部分：

1. **文本内容可编辑功能**：用户可以自由编辑记录中的文本内容，修改OCR识别错误。系统需要检测句子变化，在句子发生变化时清除相关翻译和句子分析信息，支持只重新翻译有变化的句子以提高效率。

2. **OCR识别优化**：通过图像预处理（歪斜校正、对比度调整、锐化、降噪）提高拍照文档的OCR识别准确率。同时实现OCR结果质量评估，在识别质量低时提示用户。

技术方法：使用纯客户端图像处理实现预处理，不依赖外部服务。句子级别的变更检测和选择性翻译确保用户修改后数据一致性。

## Technical Context

**Language/Version**: Node.js 18.x
**Primary Dependencies**: Electron, Express.js, React + Vite, sql.js, tesseract.js v7, OpenAI SDK v4.x
**Storage**: SQLite (sql.js 纯 JS WASM 实现)
**Testing**: Jest, Supertest
**Target Platform**: Windows 10/11
**Project Type**: desktop-app
**Performance Goals**: 预处理时间 ≤10秒，文本编辑和保存 ≤30秒，OCR准确率提升 ≥30%
**Constraints**: 离线可用，客户端计算，时区感知日志
**Scale/Scope**: 单用户桌面应用，本地数据存储

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### 核心原则检查

| 原则 | 检查项 | 状态 | 说明 |
|------|--------|------|------|
| I. 中文优先原则 | 文档和注释使用中文 | ✅ PASS | 计划和实现将使用中文 |
| II. Windows 平台专用原则 | 仅支持 Windows 平台 | ✅ PASS | 目标平台明确为 Windows |
| III. PowerShell 7 优先原则 | 使用 pwsh 执行命令 | ✅ PASS | 开发工具链将使用 pwsh |
| IV. 测试驱动原则 | 新功能必须进行单元测试 | ✅ PASS | 任务列表将包含测试任务 |
| V. 沟通确认原则 | 不确定的地方主动沟通 | ✅ PASS | 已在澄清阶段完成 |
| VI. 离线打包原则 | 所有依赖可离线打包 | ✅ PASS | 图像处理使用客户端库 |
| VII. 数据目录可配置原则 | 用户可选择数据存储位置 | ✅ PASS | 使用现有数据目录机制 |
| VIII. 时区感知日志原则 | 日志包含时区信息 | ✅ PASS | 遵循现有日志规范 |

### 技术架构约束检查

| 约束 | 检查项 | 状态 | 说明 |
|------|--------|------|------|
| 核心技术栈 | 使用项目指定技术栈 | ✅ PASS | Node.js, Express.js, React, sql.js, tesseract.js |
| 依赖管理 | 在 package.json 中声明 | ✅ PASS | 新增图像处理库将明确声明 |
| 文件结构约束 | 遵循现有目录结构 | ✅ PASS | server/, frontend/ 结构不变 |
| 打包配置约束 | 正确设置 asarUnpack | ✅ PASS | 新增 WASM 文件将正确配置 |

**宪法检查结果**: ✅ 所有检查通过

## Project Structure

### Documentation (this feature)

```text
specs/004-text-edit-ocr-improve/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── text-edit-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
SentenceLens/
├── main.js                  # Electron 主进程
├── preload.js               # IPC 上下文桥接
├── package.json              # 应用配置
├── server/                  # Express.js 后端
│   ├── app.js               # 路由定义
│   ├── models/
│   │   └── database.js      # 数据库操作（需扩展）
│   └── services/
│       ├── ocr.js           # OCR OCR 服务（需扩展）
│       ├── imageProcessor.js  # [NEW] 图像预处理服务
│       ├── llm.js           # LLM 服务（需扩展）
│       ├── sentenceSplit.js   # 句子分割服务
│       └── textEdit.js       # [NEW] 文本编辑服务
└── frontend/                # React 前端源码
    └── src/
        ├── components/
        │   ├── TextEditor.js      # [NEW] 文本编辑组件
        │   ├── RecordDisplay.js   # [MODIFIED] 记录显示组件
        │   ├── TranslationManager.js # [MODIFIED] 翻译管理组件
        │   └── OCRStatus.js      # [NEW] OCR 预处理状态组件
        ├── pages/
        │   └── RecordPage.js     # [MODIFIED] 记录页面
        └── services/
            └── api.js           # [MODIFIED] API 客户端（扩展端点）
    └── dist/                 # 构建输出
```

**Structure Decision**: 遵循现有 Electron + Express.js + React 架构。新增图像预处理服务模块和文本编辑服务模块，前端新增相关组件。所有新增功能保持现有目录结构和命名规范。

## Complexity Tracking

> 无需要 justify 的宪法违规

本功能遵循所有宪法原则，未引入违反核心原则的复杂度。图像预处理使用客户端计算，符合离线打包原则。句子级别的变更检测和选择性翻译就提高效率而不增加架构复杂度。

---

*后续阶段:*

- **Phase 0**: 研究图像预处理最佳实践和图像处理库选择
- **Phase 1**: 设计数据模型、API 契约和快速入门指南
- **Phase 2**: 生成详细任务列表（通过 `/speckit.tasks` 命令）
