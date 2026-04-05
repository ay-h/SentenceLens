# API Contract: 文本编辑和OCR识别优化

**Feature**: 文本可编辑和OCR识别优化
**Date**: 2026-04-06
**Phase**: 1 - API Contract Design

## 概述

本文档定义了文本可编辑和OCR识别优化功能的API契约。所有端点遵循现有REST API风格，返回JSON响应。

## 新增端点

### POST /api/records/:id/text/edit

**描述**: 保存编辑后的文本并检测句子变化

**请求**:
```json
{
  "text": "The quick brown fox jumps over the lazy dog.",
  "edit_mode": "replace"
}
```

**字段说明**:
- `text` (string, required): 编辑后的完整文本
- `edit_mode` (string, optional): 编辑模式，"replace" = 替换所有文本, "merge" = 合并到现有文本（默认: "replace"）

**响应**:
```json
{
  "success": true,
  "data": {
    "record_id": 123,
    "has_unsaved_changes": false,
    "sentence_changes": [
      {
        "sentence_index": 0,
        "old_text": "The quick brown fox jumps...",
        "new_text": "The quick brown fox jumps over the lazy dog.",
        "is_modified": true,
        "translation_cleared": true,
        "analysis_cleared": true
      },
      {
        "sentence_index": 1,
        "old_text": "Another sentence here.",
        "new_text": "Another sentence here.",
        "is_modified": false,
        "translation_cleared": false,
        "analysis_cleared": false
      }
    ],
    "modified_count": 1,
    "unchanged_count": 1
  },
  "message": "文本已保存，1个句子已修改"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "记录不存在或无权限访问"
}
```

### POST /api/records/:id/translate/smart

**描述**: 只重新翻译被修改的句子

**请求**:
```json
{
  "force_all": false
}
```

**字段说明**:
- `force_all` (boolean, optional): 是否强制翻译所有句子（默认: false）

**响应**:
```json
{
  "success": true,
  "data": {
    "translated_count": 1,
    "skipped_count": 1,
    "translations": [
      {
        "sentence_id": 456,
        "sentence_text": "The quick brown fox jumps over the lazy dog.",
        "translation": "敏捷的棕色狐狸跳过了懒惰的狗。",
        "translation_time_ms": 1250
      }
    ]
  },
  "message": "已翻译1个句子，跳过1个未修改的句子"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "有未保存的更改，请先保存",
  "code": "UNSAVED_CHANGES"
}
```

### GET /api/records/:id/quality

**描述**: 获取OCR识别质量评估

**响应**:
```json
{
  "success": true,
  "data": {
    "record_id": 123,
    "overall_confidence": 78.5,
    "quality_level": "medium",
    "sentence_count": 3,
    "low_confidence_sentences": [
      {
        "sentence_id": 456,
        "confidence": 45.2,
        "suspicious_words": [
          {
            "word": "jumps",
            "confidence": 42.5,
            "start_index": 28,
            "end_index": 33
          }
        ]
      }
    ],
    "needs_review": true
  }
}
```

**quality_level 值**:
- `"high"`: confidence >= 80
- `"medium"`: 60 <= confidence < 80
- `"low"`: confidence < 60

## 扩展端点

### POST /api/records/:id/text

**描述**: 处理文本输入（现有端点，需扩展）

**请求扩展**:
```json
{
  "text": "Input text here",
  "enable_preprocessing": true,
  "preprocessing_config": {
    "deskew": true,
    "contrast": true,
    "sharpen": true,
    "denoise": true
  }
}
```

**新字段说明**:
- `enable_preprocessing` (boolean, optional): 是否启用图像预处理（默认: true）
- `preprocessing_config` (object, optional): 预处理配置（可覆盖全局配置）

**响应扩展**:
```json
{
  "success": true,
  "data": {
    "record_id": 123,
    "sentences": [...],
    "preprocessing_applied": {
      "deskew": true,
      "deskew_angle": -2.5,
      "contrast_enhanced": true,
      "sharpened": true,
      "denoised": true,
      "processing_time_ms": 3250
    },
    "quality_assessment": {
      "overall_confidence": 78.5,
      "quality_level": "medium",
      "needs_review": true
    }
  }
}
```

### POST /api/upload

**描述**: 上传图片并执行OCR（现有端点，需扩展）

**响应扩展**:
```json
{
  "success": true,
  "data": {
    "record_id": 123,
    "sentences": [...],
    "preprocessing_info": {
      "original_size": {
        "width": 1920,
        "height": 1080
      },
      "preprocessed_size": {
        "width": 1920,
        "height": 1080
      },
      "steps_applied": [
        "deskew_correction",
        "clahe_enhancement",
        "unsharp_masking",
        "bilateral_filter"
      ],
      "processing_time_ms": 3250
    },
    "quality_assessment": {
      "overall_confidence": 78.5,
      "quality_level": "medium",
      "needs_review": true,
      "low_confidence_words_count": 2
    }
  }
}
```

## 错误代码

### 通用错误

| 代码 | 描述 |
|------|------|
| `INVALID_REQUEST` | 请求格式无效 |
| `RECORD_NOT_FOUND` | 记录不存在 |
| `PERMISSION_DENIED` | 无权限访问记录 |

### 文本编辑错误

| 代码 | 描述 |
|------|------|
| `UNSAVED_CHANGES` | 有未保存的更改 |
| `NO_CHANGES_DETECTED` | 未检测到任何变化 |
| `TEXT_EMPTY` | 文本为空 |

### OCR 预处理错误

| 代码 | 描述 |
|------|------|
| `UNSUPPORTED_IMAGE_FORMAT` | 不支持的图片格式 |
| `IMAGE_TOO_LARGE` | 图片太大 |
| `PREPROCESSING_FAILED` | 预处理失败 |
| `PREPROCESSING_TIMEOUT` | 预处理超时 |

### OCR 质量错误

| 代码 | 描述 |
|------|------|
| `OCR_EMPTY_RESULT` | OCR 返回空结果 |
| `OCR_FAILED` | OCR 识别失败 |

## 性能要求

### 响应时间

| 端点 | 最大响应时间 |
|------|------------|
| POST /api/records/:id/text/edit | 500ms |
| POST /api/records/:id/translate/smart | 取决于LLM API |
| GET /api/records/:id/quality | 200ms |
| POST /api/upload | 15s（含预处理）|

### 并发处理

- 文本编辑端点支持并发表求
- 翻译端点限制每记录一个活动请求
- 质量评估端点支持缓存

## 安全考虑

### 输入验证

- 所有用户输入必须验证和清理
- 文本长度限制：最大 10,000 字符
- 防止通过文本字段进行注入攻击

### 权限检查

- 用户只能编辑自己的记录
- 记录 ID 验证防止越权访问
