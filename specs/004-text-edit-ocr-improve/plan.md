# Implementation Plan: 文本可编辑和OCR识别优化

**Branch**: `004-text-edit-ocr-improve` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-text-edit-ocr-improve/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

本功能为SentenceLens添加文本编辑能力和OCR识别优化。主要包含：1) 文本内容可编辑功能，支持修改OCR识别错误并智能清除相关翻译；2) 统一翻译按钮，自动检测变化只翻译需要翻译的句子；3) OCR图像预处理优化，提高拍照文档的识别准确率；4) OCR结果质量评估和提示。技术方案基于Electron + React架构，使用tesseract.js进行OCR处理，SQLite存储数据。

## Technical Context

**Language/Version**: JavaScript/TypeScript (Node.js 18.x+)
**Primary Dependencies**: Electron, React + Vite, Express.js, tesseract.js v7, sql.js, OpenAI SDK v4.x
**Storage**: SQLite (sql.js WASM实现)
**Testing**: Jest + React Testing Library
**Target Platform**: Windows 10+ (Electron桌面应用)
**Project Type**: desktop-app
**Performance Goals**: OCR预处理<10秒，翻译响应<3秒，UI操作<500ms
**Constraints**: 完全离线运行，所有依赖打包到安装程序，用户可配置数据目录
**Scale/Scope**: 单用户桌面应用，支持单篇文档处理

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### 门禁检查

✅ **中文优先原则**: 所有文档和界面文本使用中文 - 通过
✅ **Windows 平台专用原则**: 专门针对 Windows 平台 - 通过
✅ **PowerShell 7 优先原则**: 使用 pwsh 命令 - 通过
✅ **测试驱动原则**: 需要在 Phase 2 中包含单元测试 - 通过
✅ **离线打包原则**: 所有依赖打包到安装程序 - 通过
✅ **数据目录可配置原则**: SQLite 存储支持用户配置 - 通过

### 技术栈合规性

✅ **Electron**: 符合宪法要求
✅ **Node.js 18.x+**: 符合版本要求
✅ **React + Vite**: 符合前端框架要求
✅ **SQLite (sql.js)**: 符合存储要求，WASM 实现支持离线
✅ **tesseract.js v7**: 符合 OCR 要求
✅ **OpenAI SDK v4.x**: 符合 LLM 服务要求

**结论**: 所有门禁检查通过，可以进入 Phase 0 研究。

## Project Structure

### Documentation (this feature)

```text
specs/004-text-edit-ocr-improve/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Electron 应用结构
main.js                 # Electron 主进程
server/                 # 后端服务
├── src/
│   ├── models/         # 数据模型
│   ├── services/       # 业务逻辑服务
│   ├── ocr/           # OCR 相关服务
│   ├── translation/   # 翻译相关服务
│   └── api/           # API 路由
├── tests/
└── package.json

frontend/               # 前端源码
├── src/
│   ├── components/    # React 组件
│   │   ├── TextEditor/ # 文本编辑组件
│   │   ├── TranslationButton/ # 统一翻译按钮
│   │   └── OCRProcessor/ # OCR 处理组件
│   ├── pages/          # 页面组件
│   ├── services/       # 前端服务
│   └── utils/          # 工具函数
├── tests/
├── package.json
└── vite.config.js

renderer/               # 构建输出（不提交到版本控制）
└── [构建产物]

shared/                 # 共享代码
├── types/              # TypeScript 类型定义
├── constants/          # 常量定义
└── utils/              # 共享工具函数

tests/                  # 集成测试
├── unit/               # 单元测试
├── integration/        # 集成测试
└── e2e/                # 端到端测试
```

**Structure Decision**: 采用 Electron 桌面应用结构，主进程 + 后端服务 + 前端渲染进程的架构。server 目录包含后端 API 和业务逻辑，frontend 目录包含 React 前端代码，shared 目录包含跨进程共享的代码。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
