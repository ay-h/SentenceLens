# Data Model: 文本可编辑和OCR识别优化

**Feature**: 文本可编辑和OCR识别优化
**Date**: 2026-04-06
**Phase**: 1 - Data Model Design

## 数据库模式扩展

### records 表扩展

```sql
-- 跟踪记录是否有未保存的编辑更改
ALTER TABLE records ADD COLUMN has_unsaved_changes INTEGER DEFAULT 0;
-- 0 = 无未保存更改, 1 = 有未保存更改
```

**字段说明**:
- `has_unsaved_changes`: 跟踪记录级别的编辑状态，防止用户在未保存时进行翻译操作

### sentences 表扩展

```sql
-- 跟踪句子是否被手动修改
ALTER TABLE sentences ADD COLUMN is_modified INTEGER DEFAULT 0;
-- 0 = OCR 原始, 1 = 手动修改

-- 存储 OCR 识别的置信度
ALTER TABLE sentences ADD COLUMN ocr_confidence REAL;
-- 0.0-100.0, 通常 <60 表示需要检查

-- 存储低置信度单词的位置信息（JSON 格式）
ALTER TABLE sentences ADD COLUMN low_confidence_words TEXT;
-- 格式: [{"word": "text", "start": index, "end": index, "confidence": value}, ...]
```

**字段说明**:
- `is_modified`: 标记句子是否被手动修改，用于智能重新翻译
- `ocr_confidence`: 存储整体识别置信度，用于质量评估
- `low_confidence_words`: 存储低置信度单词的详细位置信息，用于前端标记

## 实体关系

### 文本编辑流程

```
record (records)
  └── sentence[] (sentences)
       ├── text (原始或编辑后的文本）
       ├── is_modified (是否被手动修改）
       ├── translation (翻译）
       ├── analysis (句子分析）
       ├── ocr_confidence (OCR 置信度）
       └── low_confidence_words (低置信度单词）
```

### 数据状态转换

#### 正常 OCR 流程

```
1. 用户上传图片
2. OCR 识别文本
3. 创建记录（has_unsaved_changes = 0）
4. 创建句子（is_modified = 0, ocr_confidence = 计算值）
5. 文本可编辑
```

#### 文本编辑流程

```
1. 用户进入编辑模式
2. 记录 has_unsaved_changes = 1
3. 用户修改句子文本
4. 保存时检测变化：
   - 如果句子内容变化：
     * is_modified = 1
     * 清除 translation 和 analysis
   - 如果句子未变化（仅标点/空格）：
     * 保留 translation 和 analysis
5. 记录 has_unsaved_changes = 0
```

#### 统一翻译按钮流程

```mermaid
graph TD
    A[用户点击翻译按钮] --> B{检查 has_unsaved_changes}
    B -->|有未保存更改| C[提示先保存文本更改]
    B -->|无未保存更改| D{检测文本变化}
    D -->|有变化句子| E[翻译变化句子]
    D -->|无变化| F[显示"文本无变化，无需重新翻译"]
    E --> G[更新句子翻译]
    G --> H[清除 is_modified 标记]
    C --> I[等待用户保存]
    I --> B
```

**详细流程**:
1. 用户点击统一翻译按钮
2. 检查记录的 has_unsaved_changes 状态
3. 如果有未保存更改，提示用户先保存
4. 如果无未保存更改，检测句子变化：
   - 筛选 is_modified == 1 的句子
   - 如果无变化句子，显示友好提示
   - 如果有变化句子，只翻译这些句子
5. 更新翻译后清除 is_modified 标记

### 图像预处理配置

#### 配置实体（内存中存储，不持久化）

```
ImagePreprocessorConfig {
  // 歪斜校正
  deskewEnabled: true,
  deskewMinLineLength: 50,
  deskewAngleThreshold: 0.5,

  // 对比度调整
  contrastEnabled: true,
  claheClipLimit: 2.0,
  claheTileGridSize: 8,

  // 锐化
  sharpenEnabled: true,
  sharpenStrength: 1.5,
  sharpenRadius: 1,

  // 降噪
  denoiseEnabled: true,
  bilateralDiameter: 9,
  bilateralSigmaColor: 75,
  bilateralSigmaSpace: 75,

  // 质量评估
  qualityThreshold: 60.0,
  lowConfidenceThreshold: 50.0
}
```

#### OCR 质量评估实体

```
OCRQualityAssessment {
  recordId: number,
  overallConfidence: number,      // 平均置信度
  wordCount: number,                // 识别的单词数量
  lowConfidenceWordCount: number,   // 低置信度单词数量
  qualityLevel: 'high' | 'medium' | 'low',
  assessmentTime: timestamp,
  suspiciousWords: LowConfidenceWord[]
}

LowConfidenceWord {
  word: string,
  startIndex: number,
  endIndex: number,
  confidence: number,
  sentenceIndex: number
}
```

## 数据完整性约束

### records 表约束

- `has_unsaved_changes` 必须 IN (0, 1)
- 删除记录时必须级联删除相关的句子（现有外键约束）

### sentences 表约束

- `is_modified` 必须 IN (0, 1)
- `ocr_confidence` 必须 >= 0.0 AND <= 100.0
- `low_confidence_words` 必须是有效的 JSON 数组（可为空）

## 索引优化

### 新增索引

```sql
-- 加速查找需要重新翻译的句子
CREATE INDEX IF NOT EXISTS idx_sentences_modified 
  ON sentences(record_id, is_modified) 
  WHERE is_modified = 1;

-- 加速查找低质量识别
CREATE INDEX IF NOT EXISTS idx_sentences_confidence 
  ON sentences(record_id, ocr_confidence) 
  WHERE ocr_confidence < 60.0;
```

## 数据迁移策略

### 版本控制

在数据库中添加 schema_version 表用于跟踪迁移：

```sql
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT
);

INSERT INTO schema_version (version, applied_at) VALUES (1, datetime('now'));
```

### 迁移脚本

```
迁移 1: 添加文本编辑相关字段
迁移 2: 添加 OCR 质量评估字段
迁移 3: 创建优化索引
```

每个迁移在应用启动时检查并自动应用。

## 性能考虑

### 预处理配置

- 配置在内存中加载，不频繁访问数据库
- 预处理使用流式处理，避免大图像完全加载到内存
- 预处理结果可缓存（可选，基于图像哈希）

### 句子变更检测

- 使用简单的字符串比较，避免复杂的哈希计算
- 变更检测在内存中完成，保存时才写入数据库
- 批量更新句子状态以减少数据库往返

## 安全考虑

### 数据验证

- 所有新增字段必须验证类型和范围
- JSON 字段（low_confidence_words）必须解析验证
- 用户输入的文本必须清理和验证（防止注入）

### 隐私保护

- 低置信度单词信息不包含敏感数据
- 图像预处理不保存或上传原始图像到外部服务
