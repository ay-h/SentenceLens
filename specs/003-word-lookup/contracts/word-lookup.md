# API 契约：单词查询

## POST `/api/word-lookup`

### 请求

```json
{
  "word": "string (必填，要查询的英文单词)"
}
```

### 成功响应 (200)

```json
{
  "definition": {
    "word": "example",
    "phonetic": "/ɪɡˈzæmpəl/",
    "partsOfSpeech": [
      { "pos": "n", "meaning": "例子；范例；榜样" },
      { "pos": "v", "meaning": "举例；作为…的例子" }
    ],
    "source": "dictionary"
  },
  "source": "dictionary",
  "cached": false
}
```

| 字段                   | 类型      | 说明                                    |
| ---------------------- | --------- | --------------------------------------- |
| `definition.word`      | string    | 标准化后的单词                          |
| `definition.phonetic`  | string    | 音标，可能为空                          |
| `definition.partsOfSpeech` | array | 词性释义列表                            |
| `definition.source`    | string    | `"dictionary"` 或 `"llm"`              |
| `source`               | string    | 同 definition.source                    |
| `cached`               | boolean   | 是否命中服务端缓存                      |

### 错误响应

| 状态码 | 场景                         | 响应体                                        |
| ------ | ---------------------------- | --------------------------------------------- |
| 400    | 未提供单词 / 无效单词        | `{ "detail": "请提供要查询的单词" }`          |
| 400    | 词库未命中且未配置 LLM       | `{ "detail": "本地词库未收录...请先配置 LLM" }` |
| 500    | 服务器内部错误               | `{ "detail": "查词失败: ..." }`               |

### 查询流程

```
请求 → 服务端缓存(word_definitions) → ECDICT离线词库 → LLM查询 → 缓存结果 → 返回
         ↓命中                          ↓命中              ↓成功
       直接返回                        缓存+返回          缓存+返回
```

### 性能目标

| 场景           | 目标延迟 |
| -------------- | -------- |
| 缓存命中       | < 200ms  |
| 离线词库查询   | < 150ms  |
| LLM 首次查询   | ≤ 2s     |
