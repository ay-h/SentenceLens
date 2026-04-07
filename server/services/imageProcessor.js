/**
 * 图像预处理服务 - 基于 Sharp (纯 Node.js，无需编译)
 * 
 * 功能：
 * - 自动旋转检测（0°, 90°, 180°, 270°）
 * - 图像增强（对比度、亮度）
 * - 转换为灰度图
 * - 调整大小
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { createWorker } = require('tesseract.js');

/**
 * 自动旋转检测 - 尝试4个方向，返回OCR置信度最高的
 * @param {string} inputPath - 输入图像路径
 * @returns {Promise<{outputPath: string, angle: number, confidence: number}>}
 */
async function autoRotate(inputPath, outputDir = './data/preprocessed') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const angles = [0, 90, 180, 270];
  let bestResult = { angle: 0, confidence: 0, buffer: null };

  // 读取原始图像
  const originalBuffer = fs.readFileSync(inputPath);

  // 在每个角度尝试 OCR，找出置信度最高的
  for (const angle of angles) {
    try {
      // 旋转图像
      const rotatedBuffer = await sharp(originalBuffer)
        .rotate(angle, { background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 90 })
        .toBuffer();

      // 临时保存用于 OCR
      const tempPath = path.join(outputDir, `temp_${angle}.jpg`);
      fs.writeFileSync(tempPath, rotatedBuffer);

      // OCR 测试（使用快速模式）
      const worker = await createWorker('eng', undefined, {
        cachePath: path.join(__dirname, '../..'),
        cacheMethod: 'readOnly',
        gzip: false,
      });

      const result = await worker.recognize(tempPath);
      await worker.terminate();

      // 清理临时文件
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }

      const confidence = result.data.confidence || 0;
      const text = result.data.text?.trim() || '';

      console.log(`[AutoRotate] Angle ${angle}°: confidence=${confidence.toFixed(1)}, textLength=${text.length}`);

      // 选择置信度最高且识别出文本的方向
      if (confidence > bestResult.confidence && text.length > 0) {
        bestResult = { angle, confidence, buffer: rotatedBuffer };
      }

    } catch (error) {
      console.warn(`[AutoRotate] Failed at angle ${angle}°:`, error.message);
    }
  }

  // 保存最佳结果
  const outputFileName = `preprocessed_${Date.now()}.jpg`;
  const outputPath = path.join(outputDir, outputFileName);

  if (bestResult.buffer) {
    fs.writeFileSync(outputPath, bestResult.buffer);
    console.log(`[AutoRotate] Best angle: ${bestResult.angle}° (confidence: ${bestResult.confidence.toFixed(1)})`);
  } else {
    // 如果没有找到好的方向，使用原图
    fs.copyFileSync(inputPath, outputPath);
    console.log(`[AutoRotate] No good rotation found, using original`);
  }

  return {
    outputPath,
    angle: bestResult.angle,
    confidence: bestResult.confidence,
  };
}

/**
 * 图像增强 - 调整对比度和亮度
 * @param {string} inputPath - 输入图像路径
 * @param {string} outputPath - 输出图像路径
 * @param {Object} options - 增强选项
 */
async function enhanceImage(inputPath, outputPath, options = {}) {
  const { brightness = 1, contrast = 1, grayscale = true } = options;

  let pipeline = sharp(inputPath);

  if (grayscale) {
    pipeline = pipeline.grayscale();
  }

  if (brightness !== 1 || contrast !== 1) {
    pipeline = pipeline.modulate({ brightness }).linear(contrast, -(contrast - 1) * 128);
  }

  await pipeline.jpeg({ quality: 90 }).toFile(outputPath);
}

/**
 * 简单图像预处理（不依赖 OpenCV）
 * @param {string} inputPath - 输入图像路径
 * @param {Object} config - 配置选项
 * @returns {Promise<Object>} 处理结果
 */
async function preprocessImage(inputPath, config = {}) {
  const outputDir = config.outputDir || './data/preprocessed';
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const startTime = Date.now();

  try {
    // 1. 自动旋转检测（最重要的功能）
    const rotationResult = await autoRotate(inputPath, outputDir);

    // 2. 图像增强
    const enhancedPath = rotationResult.outputPath.replace('.jpg', '_enhanced.jpg');
    await enhanceImage(rotationResult.outputPath, enhancedPath, {
      brightness: config.brightness || 1.1,
      contrast: config.contrast || 1.2,
      grayscale: config.grayscale !== false,
    });

    const totalTime = Date.now() - startTime;

    return {
      processedPath: enhancedPath,
      steps: [
        {
          name: 'autoRotate',
          applied: true,
          angle: rotationResult.angle,
          confidence: rotationResult.confidence,
        },
        {
          name: 'enhance',
          applied: true,
          brightness: config.brightness || 1.1,
          contrast: config.contrast || 1.2,
        },
      ],
      totalProcessingTimeMs: totalTime,
    };

  } catch (error) {
    console.error('[Preprocess] Failed:', error.message);
    // 失败时返回原图
    const outputFileName = `preprocessed_${Date.now()}_fallback.jpg`;
    const outputPath = path.join(outputDir, outputFileName);
    fs.copyFileSync(inputPath, outputPath);
    
    return {
      processedPath: outputPath,
      steps: [{ name: 'preprocess', applied: false, error: error.message }],
      totalProcessingTimeMs: Date.now() - startTime,
    };
  }
}

module.exports = {
  preprocessImage,
  autoRotate,
  enhanceImage,
};
