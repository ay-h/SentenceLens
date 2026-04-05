<!--
Sync Impact Report:
Version: initial → 1.0.0
Modified principles: N/A (initial creation)
Added sections: All sections
Removed sections: N/A (initial creation)
Templates requiring updates: All templates (already aligned)
Follow-up TODOs: None
-->

# SentenceLens Constitution

## Core Principles

### I. 中文优先原则 (NON-NEGOTIABLE)

所有文档、代码注释、用户界面文本必须使用中文编写。开发过程中的交流和沟通也使用中文。

**理由**：项目面向中文用户，中文文档更易于理解和维护。

### II. Windows 平台专用原则

项目专门针对 Windows 平台开发，暂不考虑支持 macOS、Linux 或其他平台。

**理由**：简化开发流程，聚焦于单一平台的优化和维护。如需跨平台支持，必须在设计阶段明确讨论并获得批准。

### III. PowerShell 7 优先原则

执行命令时优先使用 PowerShell 7 (pwsh)，仅在必须使用旧版本 PowerShell 5.1 的特定场景下才使用旧版本。

**理由**：PowerShell 7 提供更好的性能、跨平台支持和现代特性，优先使用可确保开发体验的一致性。

### IV. 测试驱动原则 (NON-NEGOTIABLE)

所有新功能必须进行单元测试。Task 实现部分必须包含执行单元测试的任务项。

**理由**：单元测试是保证代码质量的基础，能够及早发现 bug 并提高代码可维护性。

### V. 沟通确认原则

在任何不确定的地方，必须主动与用户或团队成员沟通确认，不得自行假设或臆断。

**理由**：避免因误解需求导致返工，确保开发方向正确。

### VI. 离线打包原则

所有依赖（包括 npm 包、WASM 文件、语言数据等）必须能够离线打包到安装包中。不允许用户安装后在使用时再联网下载任何依赖。

**理由**：确保应用完全离线可用，提升用户体验，避免网络问题导致的功能缺失。

### VII. 数据目录可配置原则

用户必须能够自由选择数据存储位置，不应强制使用固定目录。

**理由**：尊重用户对数据存储位置的控制权，适应不同的存储环境和备份策略。

### VIII. 时区感知日志原则

所有日志记录必须包含时区信息，确保日志在不同系统上可正确解析。

**理由**：Electron 应用可能运行在不同时区的系统上，时区感知的日志确保时间戳的准确性。

## 技术架构约束

### 核心技术栈

- **Electron**: 跨平台桌面应用框架
- **Node.js**: 18.x 或更高版本
- **Express.js**: 后端 API 服务
- **React + Vite**: 前端框架
- **SQLite (sql.js)**: 纯 JS WASM 实现，无原生依赖
- **tesseract.js v7**: OCR 服务，使用本地 eng.traineddata
- **OpenAI SDK v4.x**: LLM 服务，支持自定义端点

### 依赖管理

- 所有依赖必须在 `package.json` 中明确声明
- 生产依赖和开发依赖必须清晰区分
- 依赖版本应使用精确版本号或兼容版本号范围，避免不稳定更新
- 必须定期审查依赖安全性

### 文件结构约束

- 主进程代码位于 `main.js`
- 后端服务位于 `server/` 目录
- 前端代码位于 `renderer/` 目录（构建输出）
- 源代码位于 `frontend/` 目录
- 构建产物不提交到版本控制

### 打包配置约束

- electron-builder 配置必须正确设置 asarUnpack
- server 目录必须解包（包含 node_modules）
- WASM 文件必须解包
- eng.traineddata 必须解包
- 安装程序必须包含所有运行时依赖

## 开发工作流程

### 代码提交规范

- 提交信息必须使用中文
- 提交信息格式：`类型: 简短描述`
- 类型包括：feat, fix, docs, style, refactor, test, chore
- 提交前必须运行 lint 和测试

### 代码审查要求

- 所有代码变更必须经过审查
- 审查重点：安全性、性能、可维护性、符合宪法原则
- 必须确保离线打包原则不被破坏

### 质量门禁

- 代码必须通过 lint 检查
- 单元测试覆盖率不得低于 80%
- 构建必须成功
- 打包必须生成可运行的安装程序

## Governance

本宪法是 SentenceLens 项目的最高指导文档，所有开发活动必须遵守。

### 修改流程

1. 宪法修改必须经过团队讨论
2. 修改提案必须明确说明变更理由和影响
3. 获得批准后更新版本号
4. 更新所有相关文档和模板
5. 通知所有开发人员变更内容

### 版本策略

遵循语义化版本 (Semantic Versioning)：
- **MAJOR**: 破坏性变更或原则删除/重新定义
- **MINOR**: 新增原则或重大扩展
- **PATCH**: 澄清、措辞优化、非语义性改进

### 合规检查

- 所有 PR 和代码审查必须验证宪法合规性
- 复杂度增加必须有正当理由
- 使用 CLAUDE.md 进行运行时开发指导

### 违规处理

- 发现违规必须立即记录并通知相关开发人员
- 严重违规必须回滚变更
- 轻微违规应尽快修复

**Version**: 1.0.0 | **Ratified**: 2026-04-05 | **Last Amended**: 2026-04-05
