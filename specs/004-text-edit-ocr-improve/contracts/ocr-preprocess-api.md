# API 契约：OCR 预处理服务

**Feature**: 004-text-edit-ocr-improve  
**API 类型**: REST API  
**Base Path**: `/api/ocr`

---

## 接口清单

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/ocr/preprocess` | 执行图像预处理 |
| GET | `/api/ocr/preprocess/progress/:sessionId` | 获取预处理进度 |
| POST | `/api/ocr/preprocess/cancel/:sessionId` | 取消预处理 |
| POST | `/api/ocr/recognize` | OCR识别（含可选预处理） |
| GET | `/api/ocr/config` | 获取预处理配置 |
| PUT | `/api/ocr/config` | 更新预处理配置 |

---

## 1. 执行图像预处理

### Request

```http
POST /api/ocr/preprocess
Content-Type: application/json
```

**Request Body**:

```typescript
{
  imagePath: string;              // 图片路径（相对于data/uploads或绝对路径）
  configOverride?: {              // 可选：覆盖默认配置
    perspective?: {
      enabled?: boolean;
      cannyThreshold1?: number;
      cannyThreshold2?: number;
    };
    adaptiveThreshold?: {
      enabled?: boolean;
      blockSize?: number;
      constantC?: number;
    };
    // ... 其他配置项
  };
  skipCache?: boolean;            // 是否跳过缓存（默认false）
  generatePreview?: boolean;      // 是否生成预览图（默认true）
}
```

### Response

**Success (200)**:

```typescript
{
  success: true;
  data: {
    sessionId: string;            // 处理会话ID
    originalPath: string;         // 原始图像路径
    processedPath: string;        // 预处理后图像路径
    previewPath?: string;         // 预览图路径（如生成）
    
    // 各步骤执行结果
    steps: Array<{
      name: 'perspective' | 'deskew' | 'adaptiveThreshold' | 'textRegion' | 'contrast' | 'sharpen' | 'denoise';
      status: 'completed' | 'skipped' | 'failed';
      applied: boolean;           // 是否应用了处理
      params?: Record<string, any>; // 使用的参数
      metrics?: {
        confidence?: number;      // 步骤置信度（如透视矫正）
        angle?: number;           // 矫正角度（如deskew）
        region?: { x: number; y: number; width: number; height: number }; // 裁剪区域
      };
      processingTimeMs: number; // 该步骤耗时
      error?: string;            // 错误信息（如失败）
    }>;
    
    totalProcessingTimeMs: number; // 总耗时
    
    // 图像信息
    imageInfo: {
      original: { width: number; height: number; format: string };
      processed: { width: number; height: number; format: string };
    };
  };
}
```

**Error (400/500)**:

```typescript
{
  success: false;
  error: {
    code: string;                 // 错误代码
    message: string;            // 错误信息
    details?: any;             // 详细错误信息
  };
}
```

### 错误代码

| 代码 | 描述 | HTTP状态 |
|------|------|----------|
| `IMAGE_NOT_FOUND` | 图片文件不存在 | 400 |
| `IMAGE_LOAD_ERROR` | 图片加载失败 | 400 |
| `PREPROCESS_FAILED` | 预处理失败 | 500 |
| `INVALID_CONFIG` | 配置参数无效 | 400 |
| `TIMEOUT` | 处理超时 | 504 |

---

## 2. 获取预处理进度

### Request

```http
GET /api/ocr/preprocess/progress/:sessionId
```

### Response

```typescript
{
  success: true;
  data: {
    sessionId: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    currentStep: string;          // 当前执行的步骤名称
    progress: number;           // 总进度 (0-100)
    
    // 各步骤状态
    steps: Array<{
      name: string;
      status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
      progress: number;          // 步骤进度 (0-100)
    }>;
    
    // 预计剩余时间（毫秒）
    estimatedRemainingMs?: number;
  };
}
```

---

## 3. 取消预处理

### Request

```http
POST /api/ocr/preprocess/cancel/:sessionId
```

### Response

```typescript
{
  success: true;
  data: {
    sessionId: string;
    cancelled: boolean;
    message: string;
  };
}
```

---

## 4. OCR 识别（含可选预处理）

### Request

```http
POST /api/ocr/recognize
Content-Type: application/json
```

**Request Body**:

```typescript
{
  imagePath: string;              // 图片路径
  enablePreprocessing?: boolean; // 是否启用预处理（默认true）
  configOverride?: {             // 预处理配置覆盖
    perspective?: { enabled?: boolean };
    adaptiveThreshold?: { enabled?: boolean };
    // ...
  };
  returnQuality?: boolean;       // 是否返回质量评估（默认true）
  returnSteps?: boolean;         // 是否返回预处理步骤详情（默认true）
}
```

### Response

```typescript
{
  success: true;
  data: {
    text: string;                 // 识别文本
    confidence: number;          // 整体置信度
    words: Array<{
      text: string;
      confidence: number;
      bbox: { x: number; y: number; width: number; height: number };
    }>;
    
    // 预处理结果（如启用）
    preprocessing?: {
      applied: boolean;
      steps: Array<{
        name: string;
        applied: boolean;
        processingTimeMs: number;
      }>;
      totalProcessingTimeMs: number;
    };
    
    // 质量评估（如请求）
    quality?: {
      level: 'high' | 'medium' | 'low' | 'unknown';
      overallConfidence: number;
      needsReview: boolean;
      suspiciousWords: Array<{
        text: string;
        confidence: number;
        bbox: any;
      }>;
    };
    
    sentences: Array<{
      text: string;
      index: number;
      ocrConfidence: number;
      lowConfidenceWords: Array<any>;
    }>;
  };
}
```

---

## 5. 获取预处理配置

### Request

```http
GET /api/ocr/config
```

### Response

```typescript
{
  success: true;
  data: {
    config: ImagePreprocessorConfig; // 完整配置对象
    version: string;                // 配置版本
    lastModified: Date;             // 最后修改时间
  };
}
```

---

## 6. 更新预处理配置

### Request

```http
PUT /api/ocr/config
Content-Type: application/json
```

**Request Body**:

```typescript
{
  config: Partial<ImagePreprocessorConfig>; // 部分配置更新
  resetToDefault?: boolean;                 // 是否重置为默认值
}
```

### Response

```typescript
{
  success: true;
  data: {
    config: ImagePreprocessorConfig; // 更新后的完整配置
    message: string;
  };
}
```

---

## 事件流（WebSocket/SSE）

预处理进度可通过 WebSocket 实时推送：

```javascript
// WebSocket 消息格式
{
  type: 'preprocess_progress';
  sessionId: string;
  data: {
    currentStep: string;
    progress: number;
    stepStatus: 'started' | 'completed' | 'failed' | 'skipped';
  };
}
```

---

## 数据验证规则

### 配置参数验证

| 参数 | 类型 | 范围 | 默认值 | 验证规则 |
|------|------|------|--------|----------|
| `perspective.enabled` | boolean | - | true | - |
| `perspective.cannyThreshold1` | number | 0-255 | 50 | < threshold2 |
| `perspective.cannyThreshold2` | number | 0-255 | 150 | > threshold1 |
| `adaptiveThreshold.blockSize` | number | 3-99 | 31 | 必须为奇数 |
| `adaptiveThreshold.constantC` | number | 0-50 | 15 | - |

### 图片验证

- 支持的格式: `jpg`, `jpeg`, `png`, `bmp`, `webp`
- 最大文件大小: 20MB
- 最小分辨率: 640x480
- 最大分辨率: 8192x8192

---

## 性能指标

| 场景 | 目标耗时 | 备注 |
|------|----------|------|
| 透视矫正 | ≤ 2秒 | 1920x1080 |
| Deskew | ≤ 1秒 | - |
| 自适应二值化 | ≤ 0.5秒 | - |
| 文本区域裁剪 | ≤ 0.3秒 | - |
| 完整流水线 | ≤ 6秒 | 所有步骤 |

---

## 变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-04-07 | 初始版本，整合透视矫正、自适应二值化、文本区域裁剪 |
