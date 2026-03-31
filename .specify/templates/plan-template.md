# 实现计划: [FEATURE]

**分支**: `[###-feature-name]` | **日期**: [DATE] | **规格**: [链接]
**输入**: 来自 `/specs/[###-feature-name]/spec.md` 的功能规格

**说明**: 此模板由 `/speckit.plan` 命令填写。执行工作流程参见 `.specify/templates/plan-template.md`。

## 概要

[从功能规格提取：主要需求 + 研究得出的技术方法]

## 技术背景

<!--
  操作说明：将此部分内容替换为项目的技术细节。
  此处的结构以建议方式呈现，以指导迭代过程。
-->

**语言/版本**: [例如：Python 3.11、Swift 5.9、Rust 1.75 或需要澄清]
**主要依赖**: [例如：FastAPI、UIKit、LLVM 或需要澄清]
**存储**: [如适用，例如：PostgreSQL、CoreData、文件或不适用]
**测试**: [例如：pytest、XCTest、cargo test 或需要澄清]
**目标平台**: [例如：Linux 服务器、iOS 15+、WASM 或需要澄清]
**项目类型**: [例如：库/CLI/Web 服务/移动应用/编译器/桌面应用或需要澄清]
**性能目标**: [特定领域，例如：1000 请求/秒、1 万行/秒、60 FPS 或需要澄清]
**约束条件**: [特定领域，例如：<200ms p95、<100MB 内存、离线能力或需要澄清]
**规模/范围**: [特定领域，例如：1 万用户、100 万行代码、50 个屏幕或需要澄清]

## 章程检查

*关卡：阶段 0 研究前必须通过。阶段 1 设计后重新检查。*

[基于章程文件确定的关卡]

## 项目结构

### 文档（本功能）

```text
specs/[###-feature]/
├── plan.md              # 本文件（/speckit.plan 命令输出）
├── research.md          # 阶段 0 输出（/speckit.plan 命令）
├── data-model.md        # 阶段 1 输出（/speckit.plan 命令）
├── quickstart.md        # 阶段 1 输出（/speckit.plan 命令）
├── contracts/           # 阶段 1 输出（/speckit.plan 命令）
└── tasks.md             # 阶段 2 输出（/speckit.tasks 命令 - 非 /speckit.plan 创建）
```

### 源代码（代码库根目录）
<!--
  操作说明：将下方的占位符树替换为功能的具体布局。
  删除未使用的选项，并用真实路径（例如：apps/admin、packages/something）
  展开所选结构。交付的计划不得包含选项标签。
-->

```text
# [如未使用则删除] 选项 1：单项目（默认）
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [如未使用则删除] 选项 2：Web 应用（检测到"frontend" + "backend"时）
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [如未使用则删除] 选项 3：移动端 + API（检测到 "iOS/Android"时）
api/
└── [同上方 backend 结构]

ios/ 或 android/
└── [平台特定结构：功能模块、UI 流程、平台测试]
```

**结构决策**: [记录所选结构并引用上方捕获的真实目录]

## 复杂度跟踪

> **仅当章程检查存在必须论证的违规时填写**

| 违规项 | 为何需要 | 拒绝更简单替代方案的原因 |
|-----------|------------|-------------------------------------|
| [例如：第 4 个项目] | [当前需求] | [为何 3 个项目不足] |
| [例如：仓库模式] | [具体问题] | [为何直接数据库访问不足] |
