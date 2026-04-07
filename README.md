# SentenceLens - 纯 Node.js 桌面应用程序

独立 Electron 桌面应用，完全使用 Node.js 实现。

`★ 技术栈 ─────────────────────────────`

| 模块         | 技术选型                       |
| ------------ | ------------------------------ |
| **前端**     | React + Vite + TailwindCSS     |
| **后端**     | Express.js (Node.js)           |
| **数据库**   | SQLite via sql.js (纯 JS WASM) |
| **OCR**      | tesseract.js v7.0.0 (WASM)     |
| **LLM**      | OpenAI SDK v4.x (Node.js)      |
| **依赖**     | 仅 Node.js                     |
| **安装大小** | ~100-150MB                     |

`─────────────────────────────────────────────────`

## 快速开始

### 系统要求

- **Node.js**: 18.x 或更高版本
- **无需 Python**：完全 Node.js 实现

### 安装

```bash
cd SentenceLens
install.bat
```

### 运行

```bash
npm start
```

## 项目结构

```
SentenceLens/
├── main.js                  # Electron 主进程
├── preload.js               # IPC 上下文桥接
├── package.json              # 应用配置
├── install.bat              # 安装脚本
├── README.md                # 本文件
├── IMPLEMENTATION_GUIDE.md  # 实现指南 ⭐
├── server/                  # Express.js 后端
│   ├── app.js               # 路由定义
│   ├── models/
│   │   └── database.js      # 数据库操作（TODO）
│   └── services/
│       ├── ocr.js           # tesseract.js OCR（TODO）
│       ├── llm.js           # LLM 服务（TODO）
│       └── sentenceSplit.js   # 句子分割
├── frontend/                # React 前端
│   ├── src/                 # React 组件
│   ├── dist/                 # 构建输出
│   └── package.json          # 前端依赖
└── data/                    # 运行时数据（安装后创建）
    ├── database.db             # SQLite 数据库
    └── uploads/               # 上传的图片
```

## 实现状态

### ✅ 核心功能已完全实现

- Electron 主进程和窗口管理
- Express.js 后端服务器（所有 API 路由）
- SQLite 数据库（使用 sql.js，所有操作已实现）
- tesseract.js OCR 服务（v7，本地 eng.traineddata 捆绑）
- LLM 服务（OpenAI SDK，支持分析与翻译）
- 句子分割服务
- 前端 React 应用（构建到 renderer/）
- 跨平台打包配置（electron-builder）

### 🔧 架构特点

- **离线优先**：OCR 和数据库可完全离线工作
- **LLM 可配置**：支持 OpenAI、DeepSeek 或任何兼容的本地 LLM
- **数据目录可配置**：用户可选择数据存储位置
- **时区感知日志**：服务器日志记录带有时区信息的时间戳

## 开发流程

### 运行应用

```bash
npm start
# 启动 Electron 应用（自动启动后端服务器）
```

### 开发模式

```bash
npm run dev
# 以开发模式运行（支持热重载）
```

### 配置 LLM

1. 启动应用后，进入设置页面
2. 配置 API 端点（OpenAI、DeepSeek 或本地 LLM）
3. 输入 API Key 和模型名称
4. 保存配置后即可使用句子分析和翻译功能

## 构建分发包

```bash
npm run build-win
```

生成的安装程序位于 `dist/` 目录，大小约 100-150MB。

## 技术优势

### 架构优势

✅ **纯 Node.js**：单一运行时，无 Python 依赖
✅ **离线优先**：OCR 和数据库可完全离线工作
✅ **WASM 技术**：tesseract.js 和 sql.js 使用 WebAssembly，无需编译
✅ **可配置数据目录**：用户可选择数据存储位置

### tesseract.js v7 特性

✅ **本地语言数据**：eng.traineddata 捆绑，无需网络获取
✅ **静态 API**：使用 Tesseract.recognize() 确保可靠性
✅ **回退机制**：持久化工作进程失败时自动回退到临时工作进程

## API 路由

应用在 `http://127.0.0.1:8000` 上提供以下 API：

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

## 项目文档

- [CLAUDE.md](CLAUDE.md) - Claude Code 开发指导
- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - 实现指南（架构参考）

## 许可证

MIT License
