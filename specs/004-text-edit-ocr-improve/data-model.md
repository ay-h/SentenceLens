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

-- 标记翻译是否因文本编辑而过期
ALTER TABLE sentences ADD COLUMN is_translation_stale INTEGER DEFAULT 0;
-- 0 = 翻译有效, 1 = 翻译过期需要重新翻译
```

**字段说明**:

- `is_modified`: 标记句子是否被手动修改，用于智能重新翻译
- `ocr_confidence`: 存储整体识别置信度，用于质量评估
- `low_confidence_words`: 存储低置信度单词的详细位置信息，用于前端标记
- `is_translation_stale`: 标记翻译是否因文本编辑而过期，用于智能翻译判断

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

#### 配置实体（内存中存储，可持久化到用户配置）

```typescript
ImagePreprocessorConfig {
  // 透视矫正
  perspective: {
    enabled: boolean;           // 默认: true
    cannyThreshold1: number;    // Canny低阈值 (默认: 50)
    cannyThreshold2: number;    // Canny高阈值 (默认: 150)
    minContourAreaRatio: number; // 最小轮廓面积比例 (默认: 0.1)
    approxPolyEpsilon: number;   // 多边形近似精度 (默认: 0.02)
    confidenceThreshold: number; // 透视矫正置信度阈值 (默认: 0.8)
  };

  // 歪斜校正
  deskew: {
    enabled: boolean;           // 默认: true
    angleRange: number[];       // 检测角度范围
    angleThreshold: number;     // 应用校正的最小角度 (默认: 0.5)
  };

  // 自适应二值化
  adaptiveThreshold: {
    enabled: boolean;           // 默认: true
    blockSize: number;          // 邻域块大小，奇数 (默认: 31)
    constantC: number;          // 从均值减去的常数 (默认: 15)
    method: 'GAUSSIAN' | 'MEAN'; // 自适应方法 (默认: 'GAUSSIAN')
  };

  // 文本区域检测
  textRegion: {
    enabled: boolean;           // 默认: true
    edgeDensityThreshold: number;  // 边缘密度阈值 (默认: 0.1)
    minRegionAreaRatio: number;    // 最小区域面积比例 (默认: 0.05)
    marginPixels: number;          // 裁剪边距像素 (默认: 20)
    minAspectRatio: number;        // 最小宽高比 (默认: 2.0)
    maxAspectRatio: number;        // 最大宽高比 (默认: 20.0)
  };

  // 对比度调整 (CLAHE)
  contrast: {
    enabled: boolean;           // 默认: true
    clipLimit: number;          // 对比度限制 (默认: 2.0)
    tileGridSize: number;       // 网格大小 (默认: 8)
  };

  // 锐化
  sharpen: {
    enabled: boolean;           // 默认: true
    strength: number;           // 锐化强度 (默认: 1.5)
    radius: number;             // 半径 (默认: 1)
  };

  // 降噪 (双边滤波)
  denoise: {
    enabled: boolean;           // 默认: true
    diameter: number;           // 滤波直径 (默认: 9)
    sigmaColor: number;         // 颜色空间sigma (默认: 75)
    sigmaSpace: number;         // 坐标空间sigma (默认: 75)
  };

  // 质量评估
  quality: {
    overallThreshold: number;        // 整体质量阈值 (默认: 60)
    lowConfidenceThreshold: number; // 低置信度阈值 (默认: 50)
  };
}
```

#### 默认配置对象

```javascript
const DEFAULT_PREPROCESS_CONFIG = {
  perspective: {
    enabled: true,
    cannyThreshold1: 50,
    cannyThreshold2: 150,
    minContourAreaRatio: 0.1,
    approxPolyEpsilon: 0.02,
    confidenceThreshold: 0.8,
  },
  deskew: {
    enabled: true,
    angleRange: [-2.0, -1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0],
    angleThreshold: 0.5,
  },
  adaptiveThreshold: {
    enabled: true,
    blockSize: 31,
    constantC: 15,
    method: "GAUSSIAN",
  },
  textRegion: {
    enabled: true,
    edgeDensityThreshold: 0.1,
    minRegionAreaRatio: 0.05,
    marginPixels: 20,
    minAspectRatio: 2.0,
    maxAspectRatio: 20.0,
  },
  contrast: {
    enabled: true,
    clipLimit: 2.0,
    tileGridSize: 8,
  },
  sharpen: {
    enabled: true,
    strength: 1.5,
    radius: 1,
  },
  denoise: {
    enabled: true,
    diameter: 9,
    sigmaColor: 75,
    sigmaSpace: 75,
  },
  quality: {
    overallThreshold: 60.0,
    lowConfidenceThreshold: 50.0,
  },
};
```

#### OCR 质量评估实体

```typescript
OCRQualityAssessment {
  recordId: string;                 // 所属记录ID
  imagePath: string;               // 处理的图片路径

  // 整体质量指标
  overallConfidence: number;       // 平均置信度 (0-100)
  wordCount: number;               // 识别的单词数量
  lowConfidenceWordCount: number;  // 低置信度单词数量
  qualityLevel: 'high' | 'medium' | 'low' | 'unknown';
  needsReview: boolean;            // 是否需要人工检查
  assessedAt: Date;                // 评估时间

  // 可疑单词详情
  suspiciousWords: Array<{
    index: number;                // 单词索引
    text: string;                 // 单词文本
    confidence: number;           // 置信度
    bbox: { x: number; y: number; width: number; height: number };
  }>;

  // 预处理步骤记录
  preprocessingSteps: Array<{
    name: 'perspective' | 'deskew' | 'adaptiveThreshold' | 'textRegion' | 'contrast' | 'sharpen' | 'denoise';
    applied: boolean;             // 是否应用
    skipped: boolean;             // 是否被跳过
    params?: Record<string, any>; // 使用的参数
    processingTimeMs: number;     // 处理耗时
    confidence?: number;          // 步骤置信度（如透视矫正）
  }>;

  // 原始OCR结果摘要
  rawOCRResult: {
    text: string;                 // 识别文本
    confidence: number;          // 整体置信度
    words: Array<any>;            // 单词级结果
  };
}

// 低置信度单词
LowConfidenceWord {
  word: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  sentenceIndex: number;
}
```

#### 预处理流水线状态实体

```typescript
PreprocessPipelineState {
  sessionId: string;              // 处理会话ID
  imagePath: string;              // 原始图像路径
  startedAt: Date;                // 开始时间

  // 当前状态
  currentStep: string;            // 当前执行步骤
  progress: number;               // 总进度 (0-100)
  status: 'running' | 'completed' | 'failed' | 'cancelled';

  // 各步骤状态
  steps: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
    progress: number;              // 步骤进度 (0-100)
    result?: {
      applied: boolean;           // 是否应用处理
      params?: any;               // 使用的参数
      metrics?: any;              // 处理指标
    };
    error?: string;              // 错误信息
    processingTimeMs?: number; // 耗时
  }>;

  // 输出结果
  outputImagePath?: string;        // 处理后图像路径
  totalProcessingTimeMs?: number; // 总耗时

  // 取消控制
  isCancelled: boolean;          // 是否被取消
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
