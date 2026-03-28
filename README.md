# English Reading Helper - Pure Node.js Desktop Application

独立 Electron 桌面应用，完全使用 Node.js 实现，不依赖 Python。

`★ 架构对比 ─────────────────────────────`

| 模块 | 原方案（Python） | 当前方案（纯 Node.js） |
|------|------------------|---------------------|
| **后端** | FastAPI (Python) | Express.js (Node.js) |
| **数据库** | SQLite (Python) | better-sqlite3 (Node.js) |
| **OCR** | pytesseract (Tesseract) | tesseract.js (WASM) |
| **LLM** | OpenAI SDK (Python) | OpenAI SDK (Node.js) |
| **依赖** | Python + Node.js | 仅 Node.js |
| **安装大小** | ~200MB | ~100MB |

`─────────────────────────────────────────────────`

## 快速开始

### 系统要求
- **Node.js**: 18.x 或更高版本
- **无需 Python**：完全 Node.js 实现

### 安装
```bash
cd electron-desktop-app
install.bat
```

### 运行
```bash
npm start
```

## 项目结构

```
electron-desktop-app/
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

### ✅ 已完成
- Electron 主进程和窗口管理
- Express.js 服务器骨架
- 目录结构和文件组织
- 前端 React 应用复制

### 🚧 需要实现

查看 [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) 了解需要实现的具体内容。

**关键 TODO 区域**：
1. `server/models/database.js` - 数据库操作
2. `server/services/ocr.js` - tesseract.js OCR
3. `server/services/llm.js` - LLM 分析和翻译
4. `server/app.js` - 路由实现

## 开发流程

### 1. 实现数据库
```bash
# 编辑 server/models/database.js
# 实现所有标记为 TODO 的函数
```

### 2. 实现 OCR 服务
```bash
# 编辑 server/services/ocr.js
# 配置 tesseract.js
```

### 3. 实现 LLM 服务
```bash
# 编辑 server/services/llm.js
# 集成 OpenAI SDK
```

### 4. 完成路由实现
```bash
# 编辑 server/app.js
# 实现上传、分析、翻译等路由
```

### 5. 测试
```bash
npm start
# 访问 http://127.0.0.1:8000
```

## 构建分发包

```bash
npm run build-win
```

生成的安装程序位于 `dist/` 目录，大小约 100-150MB。

## 技术优势

### 相比 Python 方案
✅ **更小的安装包**：无需打包 Python 运行时
✅ **更快的启动**：Node.js 启动更快
✅ **统一的依赖**：仅需 Node.js
✅ **离线 OCR**：tesseract.js WASM 完全本地运行

### tesseract.js 优势
✅ **无需 Tesseract 安装**：WASM 文件随应用分发
✅ **跨平台一致**：所有平台行为相同
✅ **浏览器优化**：利用 Worker 多线程

## 下一步

1. 阅读 [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)
2. 按照指南实现各个模块
3. 测试应用功能
4. 构建分发包

## 许可证

与原项目保持一致。
