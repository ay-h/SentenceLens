# Quick Start Guide: 文本可编辑和OCR识别优化

**Feature**: 文本可编辑和OCR识别优化
**Date**: 2026-04-06
**Phase**: 1 - Quick Start Guide

## 功能概述

本功能为 SentenceLens 添加了以下增强：

1. **文本内容可编辑**: 用户可以自由编辑记录中的文本内容
2. **统一翻译按钮**: 自动检测变化并只翻译需要翻译的句子
3. **OCR 图像预处理**: 完整的预处理流水线
   - **透视矫正**: 处理拍照书页/试卷的透视变形
   - **歪斜校正**: 自动校正图像旋转
   - **自适应二值化**: 处理光照不均匀的文档
   - **文本区域裁剪**: 排除页边、阴影、手指干扰
   - **锐化和降噪**: 增强图像质量
4. **OCR 质量评估**: 评估识别结果并提示低质量识别

## 快速开始

### 1. 文本编辑功能

#### 基本使用

1. 打开包含文本记录的会话
2. 在记录详情页找到文本显示区域
3. 点击"编辑"按钮进入编辑模式
4. 修改需要更正的文本内容
5. 点击"保存"按钮提交更改

#### 预期行为

- 修改句子内容后，相关翻译和分析自动清除
- 系统提示"文本已保存，已清除相关翻译，请重新翻译"
- 只修改的句子会被标记，未修改的句子保留现有翻译

#### 高级使用

**统一翻译按钮**:

1. 编辑并保存文本后，点击"翻译"按钮
2. 系统自动检测哪些句子需要翻译
3. 只翻译新增或修改的句子
4. 如果无变化，显示"文本无变化，无需重新翻译"
5. 提示显示翻译进度和结果

**按钮行为**:

- 有变化句子：翻译变化句子，跳过未修改句子
- 无变化句子：显示友好提示，不执行翻译
- 有未保存更改：提示先保存文本更改

### 2. OCR 预处理优化

#### 自动预处理

图像预处理在OCR识别时自动执行，完整的预处理流水线如下：

1. **透视矫正**: 检测并校正拍照书页/试卷的透视变形（上窄下宽）
2. **歪斜校正**: 自动检测并校正图像旋转
3. **自适应二值化**: 处理光照不均匀（中间亮边缘暗）的文档
4. **文本区域裁剪**: 排除页边、阴影、手指等干扰区域
5. **对比度调整**: 使用CLAHE算法增强对比度
6. **锐化**: 增强模糊图像的边缘
7. **降噪**: 使用双边滤波减少噪声

#### 预处理进度

预处理过程中会显示详细进度提示：

```
正在透视矫正...
正在deskew校正...
正在自适应二值化...
正在文本区域裁剪...
正在调整对比度...
正在锐化图像...
正在降噪处理...
准备进行OCR识别...
```

**智能跳过**: 对于清晰照片，系统会自动跳过不必要的处理步骤

#### 质量评估

OCR识别完成后，系统自动评估质量：

- **高质量** (confidence ≥ 80): 无提示
- **中等质量** (60 ≤ confidence < 80): 可选提示
- **低质量** (confidence < 60): 显示提示"识别可能不准确，请检查并修正文本"

### 3. 质量提示处理

#### 低置信度单词标记

如果OCR识别包含低置信度单词，这些单词会在文本中高亮显示：

1. 查看带有下划线或背景色的单词
2. 点击这些单词查看置信度信息
3. 根据提示进行手动修正

#### 整体质量提示

当整体识别质量低于阈值时：

```
⚠️ 识别可能不准确，请检查并修正文本

识别置信度: 45.2
建议: 检查标记的单词并手动修正
```

## API 使用示例

### 保存编辑后的文本

```bash
curl -X POST http://127.0.0.1:8000/api/records/123/text/edit \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The quick brown fox jumps over the lazy dog.",
    "edit_mode": "replace"
  }'
```

**响应示例**:

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
      }
    ],
    "modified_count": 1,
    "unchanged_count": 0
  },
  "message": "文本已保存，1个句子已修改"
}
```

### 统一翻译

```bash
curl -X POST http://127.0.0.1:8000/api/records/123/translate \
  -H "Content-Type: application/json" \
  -d '{
    "force_all": false
  }'
```

**响应示例（有变化时）**:

```json
{
  "success": true,
  "data": {
    "translated_count": 1,
    "skipped_count": 2,
    "no_changes_detected": false,
    "translations": [
      {
        "sentence_id": 456,
        "sentence_text": "The quick brown fox jumps over the lazy dog.",
        "translation": "敏捷的棕色狐狸跳过了懒惰的狗。",
        "translation_time_ms": 1250
      }
    ]
  },
  "message": "已翻译1个句子，跳过2个未修改的句子"
}
```

**响应示例（无变化时）**:

```json
{
  "success": true,
  "data": {
    "translated_count": 0,
    "skipped_count": 3,
    "no_changes_detected": true,
    "translations": []
  },
  "message": "文本无变化，无需重新翻译"
}
```

### 获取OCR质量评估

```bash
curl http://127.0.0.1:8000/api/records/123/quality
```

**响应示例**:

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

## 配置选项

### 图像预处理配置

图像预处理参数可在应用设置中配置（默认值）：

```javascript
{
  // 透视矫正
  perspective: {
    enabled: true,
    cannyThreshold1: 50,
    cannyThreshold2: 150,
    minContourAreaRatio: 0.1,
    confidenceThreshold: 0.8
  },

  // 歪斜校正
  deskew: {
    enabled: true,
    angleThreshold: 0.5
  },

  // 自适应二值化
  adaptiveThreshold: {
    enabled: true,
    blockSize: 31,
    constantC: 15,
    method: 'GAUSSIAN'
  },

  // 文本区域检测
  textRegion: {
    enabled: true,
    edgeDensityThreshold: 0.1,
    marginPixels: 20,
    minAspectRatio: 2.0,
    maxAspectRatio: 20.0
  },

  // 对比度调整
  contrast: {
    enabled: true,
    clipLimit: 2.0,
    tileGridSize: 8
  },

  // 锐化
  sharpen: {
    enabled: true,
    strength: 1.5,
    radius: 1
  },

  // 降噪
  denoise: {
    enabled: true,
    diameter: 9,
    sigmaColor: 75,
    sigmaSpace: 75
  },

  // 质量评估
  quality: {
    overallThreshold: 60.0,
    lowConfidenceThreshold: 50.0
  }
}
```

### OCR 质量阈值

可在设置中调整质量评估阈值：

- **高置信度阈值**: 默认 80，高于此值认为高质量
- **中置信度阈值**: 默认 60，60-80为中等质量
- **低置信度阈值**: 默认 50，低于此值单词被标记

## 故障排查

### 文本编辑问题

**问题**: 保存后翻译未清除

- 检查句子内容是否真的发生变化（仅标点/空格变化不会清除翻译）
- 查看浏览器控制台是否有错误

**问题**: 无法保存文本

- 检查是否有未保存更改提示
- 检查网络连接
- 查看服务器日志

### OCR 预处理问题

**问题**: 预处理时间过长

- 检查图片大小（建议 <5MB）
- 检查是否启用所有预处理步骤
- 考虑禁用某些预处理步骤

**问题**: 预处理后识别准确率未提升

- 检查预处理配置参数
- 尝试调整预处理强度
- 查看原始图片质量

### 质量评估问题

**问题**: 质量提示不准确

- 调整置信度阈值
- 检查tesseract.js版本（确保使用v7）
- 查看OCR识别的详细置信度信息

## 性能优化建议

1. **批量编辑**: 一次编辑多个句子后统一保存，减少数据库往返
2. **预处理缓存**: 相同图片的预处理结果可缓存（可选）
3. **质量评估缓存**: 避免重复计算质量指标
4. **延迟加载**: 大文本记录的分页加载

## 下一步

- 查看完整[API契约](contracts/text-edit-api.md)
- 了解[数据模型](data-model.md)
- 阅读[技术决策](research.md)
