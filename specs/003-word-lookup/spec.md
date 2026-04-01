# Feature Specification: 单词查询弹窗

**Feature Branch**: `003-word-lookup`  
**Created**: 2026-04-01  
**Status**: Draft  
**Input**: User description: "增加单词查询弹窗功能，选中单词时显示中文释义，与现有句子选择功能整合"

## 背景与交互冲突分析

### 现状

当前 `TextDisplay` 组件中，每个句子整体渲染为一个 `<span>` 元素，**单击句子 → 选中整个句子 → 显示内联操作按钮（分析/删除分析/取消）**。句子内的单词没有被单独包裹，无法独立响应点击事件。

### 核心冲突

单词查询和句子选择都需要响应用户在文本上的点击操作，必须通过不同的交互手势加以区分。

### 整合方案

**已确认：方案 A — 双击查单词 / 单击选句子**
- 单击保持现有行为：选中整个句子
- 双击某个单词：弹出单词查询弹窗
- 两种操作互不干扰，无需修改现有句子选择逻辑

> 实现要点：句子内每个单词需独立包裹为可交互元素，监听 `dblclick` 事件触发查词，同时在 `dblclick` 中阻止单击选句的冒泡/延迟处理。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 单词查询弹窗 (Priority: P1)

用户在阅读英文文本时遇到不认识的单词，通过交互手势触发弹窗，弹窗显示单词、音标、中文释义等信息，帮助快速理解词义后继续阅读。

**Why this priority**: 核心功能，是本特性的最小可交付价值

**Independent Test**: 触发单词查询后，弹窗正确显示单词释义信息

**Acceptance Scenarios**:

1. **Given** 页面上显示英文文本, **When** 用户对某个单词触发查词操作, **Then** 在该单词附近弹出查词窗口，显示单词、中文释义
2. **Given** 查词弹窗已打开, **When** 用户点击弹窗外部区域或关闭按钮, **Then** 弹窗关闭
3. **Given** 查词弹窗已打开, **When** 用户对另一个单词触发查词操作, **Then** 弹窗内容切换为新单词的释义

---

### User Story 2 - 单词查询与句子选择共存 (Priority: P1)

用户既可以查询单词释义，也可以选中句子进行语法分析，两种操作互不干扰、流畅切换。

**Why this priority**: 必须与现有句子选择功能正确整合，否则会破坏核心体验

**Independent Test**: 交替执行查词和选句操作，两种功能均正常工作

**Acceptance Scenarios**:

1. **Given** 无任何选中状态, **When** 用户执行查词操作, **Then** 仅弹出查词弹窗，不触发句子选择
2. **Given** 已选中一个句子, **When** 用户执行查词操作, **Then** 查词弹窗正常弹出，句子选中状态保持不变
3. **Given** 查词弹窗打开, **When** 用户执行句子选择操作, **Then** 查词弹窗关闭，句子正常被选中

---

### User Story 3 - 查词结果内容展示 (Priority: P2)

弹窗内显示完整的单词信息，包括单词原形、音标（可选）、词性、中英文释义，参考截图中的布局风格。

**Why this priority**: 提升查词体验，但基础释义已在 US1 中交付

**Independent Test**: 查词弹窗内展示的信息格式完整、排版清晰

**Acceptance Scenarios**:

1. **Given** 用户查询一个常见单词, **When** 弹窗显示, **Then** 包含单词、词性标注、中文释义且不展示音频播放按钮
2. **Given** 用户查询的单词有多个词性, **When** 弹窗显示, **Then** 分条列出各词性及对应释义

---

### User Story 4 - 查词数据来源 (Priority: P2)

系统通过已有的 LLM 服务（OpenAI 兼容接口）获取单词释义，复用现有的 LLM 配置，无需引入额外词典 API。

**Why this priority**: 数据来源决定了释义质量和可用性

**Independent Test**: 后端 API 返回正确格式的单词释义数据

**Acceptance Scenarios**:

1. **Given** LLM 服务已配置, **When** 前端请求某单词的释义, **Then** 后端调用 LLM 并返回结构化的释义数据
2. **Given** LLM 服务未配置, **When** 前端请求查词, **Then** 系统提示用户先配置 LLM

**已确认：优先离线词典 + LLM 兜底**
- 查词时优先查询本地英汉词库（速度快、零费用）
- 当本地词库未收录该单词时，自动降级调用 LLM 获取释义
- 需要集成一个英汉词库数据文件（如 ECDICT 等开源词库）

---

### User Story 5 - 查词结果缓存 (Priority: P3)

已查询过的单词释义在本地缓存，再次查询同一单词时直接展示缓存结果，减少 LLM 调用次数和等待时间。

**Why this priority**: 优化体验，减少重复查询的等待

**Independent Test**: 第二次查询相同单词时响应时间明显缩短且不产生 LLM 调用

**Acceptance Scenarios**:

1. **Given** 用户首次查询单词 "democratic", **When** 查词完成, **Then** 释义数据被缓存
2. **Given** "democratic" 已有缓存, **When** 用户再次查询该单词, **Then** 立即显示缓存的释义，无需等待 LLM 响应

---

### Edge Cases

- 用户选中的文本包含标点符号或数字（如 "don't"、"2nd"）时，应去除标点后查词或将整体作为查询词
- 句子中存在连字符词组（如 "well-known"）时，应能整体识别并查询
- LLM 返回超时或失败时，弹窗应显示加载失败提示而非无限等待
- 弹窗位置在屏幕边缘时应自动调整位置，避免溢出视口
- 快速连续对不同单词触发查词时，应取消前一个未完成的请求或仅显示最新结果
- 单词为空或全空格时不触发查词

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 用户 MUST 能够通过双击文本中的单个单词触发查词操作；单击仍保持选中句子的现有行为
- **FR-002**: 查词操作 MUST 弹出浮动弹窗，显示在被查询单词附近
- **FR-003**: 弹窗 MUST 显示单词原文和中文释义
- **FR-004**: 弹窗 MUST 可通过点击外部区域、关闭按钮或 Esc 键关闭
- **FR-005**: 查词操作与句子选择操作 MUST 互不干扰，两者可独立或同时使用
- **FR-006**: 查词过程中 MUST 在弹窗内显示加载状态
- **FR-007**: 查词失败时 MUST 在弹窗内显示错误提示
- **FR-008**: 句子文本渲染 MUST 将单词独立包裹以支持单词级交互，同时保持视觉效果与当前一致
- **FR-009**: 查词弹窗的位置 MUST 自动适应视口边缘，避免内容溢出
- **FR-010**: 后端 MUST 提供单词查询 API 端点，优先查询本地离线词库
- **FR-011**: 当本地词库未收录时，后端 MUST 降级调用 LLM 获取释义，复用现有 LLM 配置
- **FR-012**: 同一单词的 LLM 查询结果 SHOULD 在服务端缓存，避免重复调用
- **FR-013**: 后端 MUST 集成一个开源英汉词库数据文件，支持本地词义查询

### Key Entities

- **单词查询弹窗（WordPopover）**: 浮动弹窗组件，定位在目标单词附近，展示单词释义信息；包含单词原文、词性、中文释义、加载/错误状态
- **单词释义（WordDefinition）**: 查询结果的数据结构；包含单词原形、音标（可选）、词性列表、中英文释义、例句（可选）
- **单词查询 API**: 后端接口，接收单词文本，返回结构化释义数据；复用 LLM 配置，调用 OpenAI 兼容接口

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户可在 1 次交互内触发单词查词，弹窗在 2 秒内显示释义（LLM 首次查询）
- **SC-002**: 查词操作不影响句子选择功能，两种交互可在同一阅读会话中交替使用
- **SC-003**: 弹窗在任意屏幕位置均不溢出视口
- **SC-004**: 缓存命中时，查词弹窗在 200ms 内显示结果
- **SC-005**: 查词弹窗关闭后不残留任何 UI 元素
- **SC-006**: 查词弹窗的视觉风格与应用整体设计保持一致（圆角、阴影、配色）

## Assumptions

- 查词优先使用本地离线词库，LLM 作为兜底；需要集成一个开源英汉词库（如 ECDICT）
- 文本内容主要为英文，查词返回中文释义
- 用户已配置 LLM 服务（URL、API Key、Model），否则查词功能不可用
- 单词拆分基于空格和标点的简单分词规则，无需 NLP 分词
- 弹窗内暂不提供发音播放功能（可作为后续迭代）
- 本次不实现"添加到生词本"功能（可作为后续迭代）

---

## 实现摘要

### 成功指标状态

| 指标   | 状态       | 说明                                                       |
| ------ | ---------- | ---------------------------------------------------------- |
| SC-001 | ✅ 已实现  | 双击触发查词，LLM 超时设为 15s，离线词库 < 150ms           |
| SC-002 | ✅ 已实现  | 250ms 延迟区分单击/双击，双击取消单击事件                  |
| SC-003 | ✅ 已实现  | Popover 自动检测视口边缘并重新定位                         |
| SC-004 | ✅ 已实现  | 前端内存缓存 + 服务端 DB 缓存，命中时跳过网络/词库查询     |
| SC-005 | ✅ 已实现  | 使用 React Portal 渲染，关闭时完全卸载                     |
| SC-006 | ✅ 已实现  | 使用项目一致的圆角、阴影、配色方案                         |

### 实现文件清单

| 文件                                               | 变更类型 | 说明                                        |
| -------------------------------------------------- | -------- | ------------------------------------------- |
| `server/services/dictionary.js`                    | 新增     | ECDICT 离线词库服务                         |
| `server/services/llm.js`                           | 修改     | 新增 `lookupWord` 函数                      |
| `server/models/database.js`                        | 修改     | 新增 `word_definitions` 表及 CRUD           |
| `server/app.js`                                    | 修改     | 新增 `/api/word-lookup` 路由                |
| `frontend/src/types/index.ts`                      | 修改     | 新增 WordDefinition 等类型                  |
| `frontend/src/api/index.ts`                        | 修改     | 新增 `lookupWord` API 调用                  |
| `frontend/src/hooks/useWordLookup.ts`              | 新增     | 查词状态管理 + 内存缓存                     |
| `frontend/src/components/WordLookupPopover.tsx`     | 新增     | 查词弹窗组件                                |
| `frontend/src/components/TextDisplay.tsx`           | 修改     | 单词级 span 拆分 + 双击事件                 |
| `package.json`                                     | 修改     | extraResources 打包词库                     |

### 缓存策略

1. **前端内存缓存**：`Map<string, WordDefinition>`，当前会话有效
2. **服务端数据库缓存**：`word_definitions` 表，持久化跨会话
3. **离线词库**：ECDICT SQLite，只读查询
4. **LLM 兜底**：未命中时调用，结果写入服务端缓存

### 打包注意

- 词库文件 `data/dictionary/ecdict.db` 通过 `extraResources` 打包到 `resources/dictionary/`
- 应用启动时按优先级检测词库路径：用户数据目录 → extraResources → 项目 data 目录
- 词库缺失时功能降级为纯 LLM 模式（需配置 LLM）
