# Implementation Plan: 文本可编辑和OCR识别优化

**Branch**: `004-text-edit-ocr-improve` | **Date**: 2026-04-07 | **Spec**: [spec.md](./spec.md)
**Input**: 优化拍照文档OCR识别效果（透视矫正→deskew→自适应二值化→文本区域裁剪），实现文本可编辑和智能翻译

## Summary

本特性包含两大核心功能：

1. **文本可编辑功能**：支持句子级独立编辑，修改后自动检测变化并清除相关翻译/分析，智能重新翻译仅修改的句子
2. **OCR预处理优化**：基于OpenCV.js实现完整的预处理流水线（透视矫正→deskew→自适应二值化→文本区域裁剪），将拍照文档识别准确率从60%提升至95%+

**技术重点**：集成OpenCV.js实现透视矫正和自适应二值化，优化tesseract.js调用参数，实现图像质量评估与低置信度单词标记

## Technical Context

**Language/Version**: Node.js 18.x, Electron 41.x, React 18.x + TypeScript
**Primary Dependencies**:

- `@techstark/opencv-js` v4.12.0 - 图像预处理（已集成）
- `tesseract.js` v7.0.0 - OCR识别（已集成）
- `sql.js` v1.12.0 - SQLite WASM客户端存储
- `express` v4.21.0 - 后端API服务
  **Storage**: SQLite (sql.js WASM)，图片文件系统存储
  **Testing**: Jest v30.3.0 + jsdom environment, supertest v7.2.2
  **Target Platform**: Windows 10/11 桌面应用
  **Project Type**: Electron + React + Express 桌面应用
  **Performance Goals**:
- 图像预处理总时间 ≤ 10秒（1920x1080照片）
- 文本编辑保存响应 ≤ 1秒
- 智能翻译减少90%不必要API调用
  **Constraints**:
- 完全离线运行（所有依赖离线打包）
- WASM文件体积敏感（OpenCV.js需优化加载）
- 内存占用 < 500MB（单张大图处理）
  **Scale/Scope**: 单用户桌面应用，支持单次处理多页文档（<50页）

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| 原则                 | 状态     | 说明                                              |
| -------------------- | -------- | ------------------------------------------------- |
| **中文优先**         | ✅ PASS  | 所有文档、代码注释、UI文本使用中文                |
| **Windows专用**      | ✅ PASS  | Electron桌面应用，仅Windows 10/11                 |
| **PowerShell 7优先** | ✅ PASS  | 开发脚本使用PowerShell 7                          |
| **测试驱动**         | ✅ PASS  | 新增ImageProcessor预处理模块需单元测试覆盖        |
| **离线打包**         | ⚠️ CHECK | OpenCV.js已配置asarUnpack，需验证WASM文件完整打包 |
| **数据目录可配置**   | ✅ PASS  | 使用现有配置系统，数据存储位置用户可选            |
| **时区感知日志**     | ✅ PASS  | 继续使用现有日志系统                              |

### 关键合规点

1. **离线打包验证**：electron-builder配置已包含OpenCV.js WASM文件解包，需在构建时验证完整性
2. **测试覆盖率**：新增预处理算法（透视矫正、自适应二值化）必须达到80%+单元测试覆盖率
3. **中文文档**：research.md、data-model.md必须使用中文编写

## Project Structure

### Documentation (this feature)

```text
specs/004-text-edit-ocr-improve/
├── plan.md              # 本文件 (/speckit.plan 输出)
├── research.md          # Phase 0 技术调研 (/speckit.plan)
├── data-model.md        # Phase 1 数据模型 (/speckit.plan)
├── quickstart.md        # Phase 1 快速开始 (/speckit.plan)
├── contracts/           # API契约定义
│   ├── ocr-preprocess-api.md
│   └── text-edit-api.md
└── tasks.md             # Phase 2 任务分解 (/speckit.tasks 生成)
```

### Source Code (repository root)

```text
data/
└── uploads/             # 上传图片临时存储
    └── preprocessed/    # 预处理后的图片缓存

frontend/src/
├── components/
│   ├── TextEditor/      # 文本编辑组件
│   │   ├── SentenceEditItem.tsx
│   │   └── TextEditPanel.tsx
│   └── OCRProgress/     # OCR预处理进度显示
│       └── PreprocessProgress.tsx
├── pages/
│   └── RecordDetail/
│       └── TextEditableView.tsx
└── api/
    └── textEdit.ts      # 文本编辑API客户端

server/
├── services/
│   ├── imageProcessor.js    # 图像预处理服务（需增强）
│   │   ├── perspective.js   # 透视矫正模块（新增）
│   │   ├── adaptiveThreshold.js  # 自适应二值化（新增）
│   │   └── textRegion.js    # 文本区域检测（新增）
│   ├── ocr.js               # OCR服务（集成预处理调用）
│   ├── textEdit.js          # 文本编辑服务（已存在，需增强）
│   └── translation.js       # 翻译服务（智能重翻译逻辑）
└── routes/
    ├── ocr.js               # OCR API路由
    └── text-edit.js         # 文本编辑API路由

tests/
├── unit/
│   ├── imageProcessor/      # 图像预处理单元测试
│   │   ├── perspective.test.js
│   │   ├── adaptiveThreshold.test.js
│   │   └── textRegion.test.js
│   └── services/
│       └── textEdit.test.js
└── integration/
    └── ocr-preprocess.test.js
```

**Structure Decision**: 采用现有Electron+React+Express架构，新增模块独立文件组织，保持services目录职责清晰

## Complexity Tracking

> **透视矫正算法实现存在宪法合规风险，需记录**

| Violation                 | Why Needed                                           | Simpler Alternative Rejected Because           |
| ------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| OpenCV.js WASM体积 (~8MB) | 透视矫正和自适应二值化需要完整OpenCV功能             | 纯JS实现透视矫正精度不足，OpenCV是行业标准方案 |
| 多阶段图像处理流水线      | OCR准确率依赖完整预处理链（透视→deskew→二值化→裁剪） | 跳过任何一步都会导致识别率显著下降             |
| 运行时图像质量检测        | 需动态判断是否需要透视矫正/二值化                    | 用户手动选择会大幅降低体验，自动检测是必需的   |
