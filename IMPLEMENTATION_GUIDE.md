# 实现指南 - English Reading Helper Electron 应用

本文档详细说明了需要实现的功能模块。

## 📋 实现清单

### 阶段 1：数据库实现

**文件**：`server/models/database.js`

**需要实现的函数**：

| 函数 | 描述 | 优先级 |
|------|------|----------|
| `initialize()` | 创建数据库连接和表结构 | 🔴 高 |
| `createSession()` | 创建新会话 | 🔴 高 |
| `getAllSessions()` | 获取所有会话 | 🔴 高 |
| `getSession()` | 获取单个会话 | 🔴 高 |
| `updateSessionTitle()` | 更新会话标题 | 🟡 中 |
| `deleteSession()` | 删除会话（级联） | 🟡 中 |
| `createRecord()` | 创建记录 | 🔴 高 |
| `getRecord()` | 获取记录 | 🔴 高 |
| `getRecordWithAnalyses()` | 获取记录及分析 | 🔴 高 |
| `getRecordsBySession()` | 获取会话的记录 | 🔴 高 |
| `updateRecordName()` | 更新记录名称 | 🟢 低 |
| `deleteRecord()` | 删除记录（级联） | 🟡 中 |
| `createAnalysis()` | 创建句子分析 | 🔴 高 |
| `getAnalysisBySentence()` | 获取句子分析 | 🔴 高 |
| `getAnalysesByRecord()` | 获取记录的分析 | 🔴 高 |
| `deleteAnalysis()` | 删除分析 | 🟢 低 |
| `updateLLMConfig()` | 更新 LLM 配置 | 🔴 高 |
| `getLatestLLMConfig()` | 获取最新配置 | 🔴 高 |
| `createTranslation()` | 创建翻译缓存 | 🟡 中 |
| `getTranslationBySentence()` | 获取句子翻译 | 🔴 高 |
| `getTranslationsByRecord()` | 获取记录翻译 | 🔴 高 |

**数据库表结构**：
```sql
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    image_path TEXT NOT NULL,
    ocr_text TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE sentence_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    sentence TEXT NOT NULL,
    analysis TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
);

CREATE TABLE sentence_translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    original_sentence TEXT NOT NULL,
    translated_sentence TEXT NOT NULL,
    source_lang TEXT DEFAULT 'en',
    target_lang TEXT DEFAULT 'zh',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
);

CREATE TABLE llm_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 阶段 2：OCR 服务实现

**文件**：`server/services/ocr.js`

**需要实现的功能**：

| 函数 | 描述 | 优先级 |
|------|------|----------|
| `initialize()` | 初始化 tesseract.js worker | 🔴 高 |
| `recognize(imagePath)` | 识别图片文本 | 🔴 高 |
| `terminate()` | 清理 worker | 🟡 中 |

**实现要点**：
- 使用 Tesseract.js v5.x
- 支持英文识别
- 错误处理和重试
- 进度回调（可选）

### 阶段 3：LLM 服务实现

**文件**：`server/services/llm.js`

**需要实现的功能**：

| 函数 | 描述 | 优先级 |
|------|------|----------|
| `initialize(url, apiKey, model)` | 初始化 OpenAI 客户端 | 🔴 高 |
| `analyzeSentence(sentence)` | 分析句子结构 | 🔴 高 |
| `translate(text, options)` | 翻译文本 | 🔴 高 |

**实现要点**：
- 使用 OpenAI SDK v4.x
- 支持自定义 API 端点（DeepSeek、本地 LLM）
- 句子分析提示词（可参考原项目）
- 批量翻译优化
- 错误处理和重试

### 阶段 4：路由实现

**文件**：`server/app.js`

**需要实现的路由**：

| 路由 | 功能 | 优先级 |
|------|------|----------|
| `POST /api/upload` | 图片上传 + OCR | 🔴 高 |
| `POST /api/text` | 文本处理 | 🔴 高 |
| `POST /api/analyze` | 句子分析 | 🔴 高 |
| `POST /api/translate` | 翻译 | 🔴 高 |

**实现要点**：
- 文件上传处理（multer）
- 错误响应标准化
- 输入验证
- CORS 配置

## 💡 实现建议

### 1. 按阶段实现
建议按阶段 1 → 2 → 3 → 4 的顺序实现，每个阶段完成后测试。

### 2. 测试驱动开发
实现每个函数后，编写简单的测试用例验证功能。

### 3. 参考原项目
原 Python 代码提供了完整的功能参考，可以：
- 对比 API 响应格式
- 参考提示词设计
- 学习错误处理方式

### 4. 使用 TypeScript（可选）
虽然当前是 JavaScript，但可以逐步迁移到 TypeScript 以获得更好的类型安全。

## 🔍 测试指南

### 测试数据库
```javascript
const db = require('./server/models/database');
await db.initialize();
const session = await db.createSession('Test Session');
console.log(session);
```

### 测试 OCR
```javascript
const ocr = require('./server/services/ocr');
await ocr.initialize();
const text = await ocr.recognize('path/to/image.png');
console.log(text);
```

### 测试 LLM
```javascript
const llm = require('./server/services/llm');
llm.initialize('https://api.openai.com/v1', 'your-api-key', 'gpt-3.5-turbo');
const analysis = await llm.analyzeSentence('Hello, world!');
console.log(analysis);
```

### 测试 API
```bash
# 健数据库和服务器
node server/app.js

# 测试健康检查
curl http://localhost:8000/api/health

# 测试会话创建
curl -X POST http://localhost:8000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Session"}'
```

## 🚀docs 发布前检查清单

- [ ] 所有数据库函数已实现并测试
- [ ] OCR 服务正常工作
- [ ] LLM 服务正常工作（需要 API key）
- [ ] 所有 API 路由已实现
- [ ] 错误处理完善
- [ ] 日志记录完善
- [ ] 前端构建成功
- [ ] Electron 应用正常启动
- [ ] 功能测试通过（图片上传、OCR、分析、翻译）
- [ ] 分发包构建成功

## 📞 获取帮助

如遇到问题：
1. 查看原项目 Python 代码作为参考
2. 检查 tesseract.js 和 OpenAI SDK 文档
3. 检查 Express.js 和 better-sqlite3 文档

## 相关文档
- [README.md](README.md) - 项目概述
- [README.md](../README.md) - 原项目文档
