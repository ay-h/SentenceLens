# 快速开始：单词查询功能

## 1. 安装词库

下载 ECDICT SQLite 词库文件（`ecdict.db`），放置到项目根目录：

```
data/dictionary/ecdict.db
```

> 词库来源：https://github.com/skywind3000/ECDICT
> 需要下载 SQLite 格式的数据库文件（stardict.db），重命名为 `ecdict.db`。

如果不放置词库文件，功能仍可使用，但所有查词将走 LLM 兜底（需配置 LLM）。

## 2. 安装依赖

```bash
npm install
cd frontend && npm install
cd ../server && npm install
```

## 3. 验证词库加载

启动应用后，检查控制台日志：

- ✅ `ECDICT 词库已加载: ...` — 词库正常
- ⚠️ `ECDICT 词库文件未找到，将仅使用 LLM 查词` — 词库缺失，仅 LLM 可用

## 4. 使用方法

1. **双击单词** — 弹出查词弹窗，显示中文释义
2. **单击句子** — 选中整句进行分析（与之前一致）
3. **按 Esc 或点击弹窗外部** — 关闭查词弹窗

## 5. 打包分发

词库通过 `electron-builder` 的 `extraResources` 自动打包：

```json
"extraResources": [
  { "from": "data/dictionary/", "to": "dictionary", "filter": ["**/*"] }
]
```

打包后词库位于 `resources/dictionary/ecdict.db`，应用启动时自动检测。

## 6. 故障排除

| 问题                     | 解决方案                                     |
| ------------------------ | -------------------------------------------- |
| 查词弹窗不显示           | 确认双击而非单击；检查控制台有无报错         |
| 所有单词都走 LLM         | 检查 `ecdict.db` 是否在正确路径              |
| LLM 查词失败             | 确认已在设置页面配置 LLM（URL、API Key、Model）|
| 弹窗位置偏移             | 刷新页面后重试；检查是否有 CSS 冲突          |
