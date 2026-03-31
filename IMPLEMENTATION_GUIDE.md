# 实现指南 - SentenceLens Electron 应用

本文档描述当前实现状态和架构说明。

## ✅ 实现状态

### 阶段 1：数据库实现

**文件**：`server/models/database.js`

**实现状态**：✅ 已完全实现

使用 sql.js（纯 JS WASM）实现的所有数据库操作：
- 会话管理（创建、获取、更新、删除）
- 记录管理（创建、获取、更新、删除）
- 分析管理（创建、获取、删除）
- 翻译管理（创建、获取、缓存）
- LLM 配置管理
- 外键级联和文件清理

**数据库表结构**：
使用时区感知的时间戳，包含 updated_at 字段以跟踪修改时间。

---

### 阶段 2：OCR 服务实现

**文件**：`server/services/ocr.js`

**实现状态**：✅ 已完全实现

**已实现的功能**：
- `initialize()` - 初始化 tesseract.js v7 worker
- `recognize(imagePath)` - 识别图片文本
- `recognizeBuffer(buffer)` - 从缓冲区识别
- `terminate()` - 清理 worker

**技术特点**：
- 使用 Tesseract.js v7（静态 API）
- 捆绑本地 eng.traineddata（无需网络）
- 持久化工作进程失败时自动回退
- 完整的错误处理和日志记录

---

### 阶段 3：LLM 服务实现

**文件**：`server/services/llm.js`

**实现状态**：✅ 已完全实现

**已实现的功能**：
- `analyzeSentence(sentence, url, apiKey, model)` - 分析句子结构
- `translateSentencesBatch(sentences, recordId, ...)` - 批量翻译优化

**技术特点**：
- 使用 OpenAI SDK v4.x
- 支持自定义 API 端点（DeepSeek、本地 LLM）
- 结构化 JSON 输出（句子分析）
- 翻译缓存集成
- 批处理优化
- 完整的错误处理和重试机制

---

### 阶段 4：API 路由实现

**文件**：`server/app.js`

**实现状态**：✅ 已完全实现

**已实现的路由**：
- 会话路由：创建、获取、更新、删除
- 记录路由：创建、获取、更新、删除
- 分析路由：分析、删除、测试端点
- 翻译路由：翻译、获取翻译列表
- 上传路由：图片上传 + OCR
- 文本处理路由：直接文本输入
- LLM 配置路由：获取、保存配置

**技术特点**：
- Express.js REST API
- multer 文件上传处理
- CORS 配置
- 标准化错误响应
- 时区感知日志记录

---

## 架构概览

### 技术栈

| 组件 | 技术 |
|-------|------|
| **前端** | React + Vite + TailwindCSS |
| **后端** | Express.js (Node.js) |
| **数据库** | SQLite via sql.js (WASM) |
| **OCR** | tesseract.js v7 (WASM) |
| **LLM** | OpenAI SDK v4.x |
| **打包** | electron-builder |

### 项目结构

```
sentence-lens/
├── main.js                  # Electron 主进程
├── preload.js               # IPC 上下文桥接
├── package.json              # 应用配置
├── eng.traineddata          # Tesseract 语言数据（捆绑）
├── server/                  # Express.js 后端
│   ├── app.js               # 路由和中间件
│   ├── models/
│   │ │   └── database.js      # SQLite 操作
│   └── services/
│       ├── ocr.js           # OCR 服务
│       ├── llm.js           # LLM 服务
│       └── sentenceSplit.js   # 句子分割
├── frontend/                # React 前端
│   ├── src/                 # React 组件
│   ├── dist/                 # 构建输出
│   └── package.json
└── renderer/                # 已构建的前端（由 Electron 加载）
```

---

## 关键特性

### 离线优先架构
- OCR 使用本地 tesseract.js WASM
- 数据库使用 sql.js WASM
- 完全离线的内容管理（阅读、组织、删除）

### 跨平台一致性
- 使用 Electron 框架确保 Windows、macOS、Linux 行为一致
- WASM 服务保证跨平台一致结果

### 可配置性
- 数据目录可由用户通过 UI 配置
- LLM 端点可配置（OpenAI、DeepSeek、本地 LLM）

---

## 运行应用

### 开发模式
```bash
npm run dev
```

### 生产模式
```bash
npm start
```

### 构建分发包
```bash
npm run build-win      # Windows
npm run build-mac      # macOS
npm run build-linux    # Linux
```

---

## API 参考

应用在 `http://127.0.0.1:8000` 上提供 REST API：

- `GET /api/health` - 健康检查
- `POST /api/sessions` - 创建会话
- `GET /api/sessions` - 列出会话
- `GET /api/sessions/:id/records` - 获取会话记录
- `POST /api/upload` - 上传图片并执行 OCR
- `POST /api/text` - 处理文本输入
- `POST /api/analyze` - 分析句子 (LLM)
- `POST /api/translate` - 翻译文本 (LLM，带缓存）
- `GET /api/llm-config` - 获取 LLM 配置
- `POST /api/llm-config` - 保存 LLM 配置

---

## 相关文档

- [README.md](README.md) - 项目概述
- [CLAUDE.md](CLAUDE.md) - Claude Code 开发指导
