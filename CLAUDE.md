# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码库工作时提供指导。

## 项目概述

SentenceLens 是一个纯 Node.js Electron 桌面应用程序。已从 Python FastAPI 后端迁移到 Node.js Express.js 后端，消除了 Python 依赖。

**架构**：Electron 主进程 → Express.js 后端（端口 8000）→ React 前端

## 常用命令

### 开发
```bash
npm start              # 运行 Electron 应用
npm run dev           # 以开发模式运行
```

### 构建
```bash
npm run build-frontend    # 构建 React 前端到 renderer/
npm run build             # 构建完整应用（前端 + 安装程序）
npm run build-win         # 构建 Windows 安装程序
npm run build-mac         # 构建 macOS DMG
npm run build-linux       # 构建 Linux AppImage
```

## 架构

### 主进程 (main.js)
- 管理 Electron 窗口生命周期
- 作为子进程启动 Express.js 服务器
- 处理数据目录管理和迁移
- 服务器运行在端口 8000，健康检查位于 `/api/health`
- 服务器日志记录到 `{data_dir}/logs/server.log`

### 后端 (server/)
- **server/app.js**：Express.js REST API，与 Python FastAPI 路由完全匹配
- **server/models/database.js**：使用 sql.js 的 SQLite（纯 JS WASM，无需编译）
- **server/services/ocr.js**：tesseract.js v7，使用本地 eng.traineddata
- **server/services/llm.js**：OpenAI SDK 用于分析和翻译
- **server/services/sentenceSplit.js**：句子分割逻辑

### 前端
- React + Vite + TailwindCSS
- 构建到 `renderer/` 目录（由 Electron 加载）
- 通过 `http://127.0.0.1:8000/api/*` 与后端通信
- 使用 React Context 进行状态管理

### 数据存储
- **数据目录**：可通过 UI 配置，默认为 `{userData}/english-reading-helper/`
- **数据库**：SQLite (`{data_dir}/database.db`)，使用 sql.js
- **上传文件**：`{data_dir}/uploads/`
- **日志**：`{data_dir}/logs/server.log`

## 关键技术细节

### 服务器进程管理
Express.js 服务器作为 main.js 生成子进程运行。修改服务器代码时：
1. 服务器需要重启（开发模式下应用自动处理）
2. 生产环境中，更改需要重新构建应用
3. 服务器日志输出到控制台和 `server.log`，带时区感知的时间戳

### 数据库 (sql.js)
- SQLite 的纯 JavaScript WASM 实现
- 数据库文件手动保存/加载（非连接模式）
- 写入后自动延迟 500ms 保存
- 架构模式与 Python 版本完全一致，具有正确的外键级联

### OCR (tesseract.js v7)
- 使用静态 `Tesseract.recognize()` API 以确保可靠性
- 捆绑本地 `eng.traineddata` 以防止网络获取
- 如果持久化工作进程失败，则回退到临时工作进程
- 语言数据目录：项目根目录（server/services/ 的上两级）

### LLM 集成
- OpenAI SDK v4.x，可配置端点
- 支持 DeepSeek、本地 LLM 或任何 OpenAI 兼容的 API
- 句子分析使用 JSON 模式进行结构化输出
- 翻译使用批处理和缓存

## 构建配置

### electron-builder
- **asar**：启用（但解包 server、node_modules、eng.traineddata）
- **asarUnpack**：server/**/*, node_modules/**/*, eng.traineddata
- **Windows**：支持自定义目录选择的 NSIS 安装程序
- **macOS**：教育类别的 DMG
- **Linux**：教育类别的 AppImage

### 前端构建
- Vite 构建到 `renderer/` 目录
- 通过 main.js 中的 `loadFile()` 加载
- 生产环境构建 electron-builder 前必须先构建前端

## API 路由参考

- `GET /api/health` - 健康检查
- `POST /api/sessions` - 创建会话
- `GET /api/sessions` - 列出会话
- `GET /api/sessions/:id` - 获取会话
- `PUT /api/sessions/:id/title` - 更新会话标题
- `DELETE /api/sessions/:id` - 删除会话（级联到记录）
- `GET /api/sessions/:id/records` - 获取会话记录
- `GET /api/records/:id` - 获取记录及其分析
- `GET /api/records/:id/sentences` - 获取记录句子
- `PUT /api/records/:id/name` - 更新记录名称
- `DELETE /api/records/:id` - 删除记录
- `POST /api/upload` - 上传图片 + OCR（多部分表单）
- `POST /api/text` - 处理文本输入
- `POST /api/analyze` - 分析句子 (LLM)
- `POST /api/analysis/delete` - 按句子删除分析
- `GET /api/analysis/test/:record_id` - 测试端点
- `POST /api/translate` - 翻译文本 (LLM，批处理带缓存)
- `GET /api/records/:id/translations` - 获取记录翻译
- `GET /api/llm-config` - 获取 LLM 配置
- `POST /api/llm-config` - 保存 LLM 配置

## 重要文件

- `main.js` - Electron 主进程，服务器生成，IPC 处理程序
- `preload.js` - IPC 上下文桥接（如果存在）
- `package.json` - 应用配置，electron-builder 设置
- `server/app.js` - Express 路由和中间件
- `server/models/database.js` - SQLite 操作
- `server/services/ocr.js` - OCR 工作进程和识别
- `server/services/llm.js` - LLM API 调用
- `server/services/prompt_template.txt` - 句子分析提示词
- `eng.traineddata` - Tesseract 英语语言数据（必须捆绑）
