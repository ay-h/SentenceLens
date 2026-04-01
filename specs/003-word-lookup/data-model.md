# 数据模型：单词查询

## 实体

### WordDefinition（前端类型）

| 字段            | 类型                  | 说明               |
| --------------- | --------------------- | ------------------ |
| `word`          | `string`              | 标准化后的单词     |
| `phonetic`      | `string`              | 音标（如 /wɜːrd/） |
| `partsOfSpeech` | `WordPartOfSpeech[]`  | 词性与释义列表     |
| `source`        | `'dictionary' \| 'llm'` | 数据来源         |

### WordPartOfSpeech

| 字段      | 类型     | 说明                        |
| --------- | -------- | --------------------------- |
| `pos`     | `string` | 词性缩写（n, v, adj 等）   |
| `meaning` | `string` | 中文释义                    |

### WordLookupResponse（API 响应）

| 字段         | 类型             | 说明                   |
| ------------ | ---------------- | ---------------------- |
| `definition` | `WordDefinition` | 查词结果               |
| `source`     | `string`         | 数据来源               |
| `cached`     | `boolean`        | 是否命中服务端缓存     |

## 数据库表：`word_definitions`

| 列名              | 类型     | 约束                  | 说明                     |
| ----------------- | -------- | --------------------- | ------------------------ |
| `id`              | INTEGER  | PRIMARY KEY AUTO      | 自增主键                 |
| `word`            | TEXT     | NOT NULL, UNIQUE      | 标准化单词（小写去空格） |
| `definition_json` | TEXT     | NOT NULL              | JSON 格式完整释义        |
| `source`          | TEXT     | NOT NULL, DEFAULT 'dictionary' | 来源标识       |
| `created_at`      | DATETIME | DEFAULT now           | 创建时间                 |
| `updated_at`      | DATETIME | DEFAULT now           | 更新时间                 |

**索引**: `idx_word_definitions_word` (UNIQUE, word)

## 状态机

```
idle → (双击单词) → loading → success / error
success → (关闭弹窗) → idle
error → (关闭弹窗) → idle
loading → (取消/切换) → idle
```

## 缓存层次

1. **前端内存缓存**（`Map<string, WordDefinition>`）：当前会话有效，命中后跳过网络请求
2. **服务端数据库缓存**（`word_definitions` 表）：持久化，跨会话有效
3. **离线词库**（ECDICT SQLite）：只读，不写入
4. **LLM 查询**：最终兜底，结果写入服务端缓存
