/**
 * Image Processing Service
 *
 * 功能：
 * - 歪斜校正（投影法）
 * - 对比度调整（CLAHE）
 * - 锐化（Unsharp Mask）
 * - 降噪（双边滤波）
 * - OCR 质量评估（置信度分析）
 */

const cv = require("opencv.js");
const path = require("path");
const fs = require("fs");

/**
 * 预处理配置（默认值）
 */
const DEFAULT_CONFIG = {
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
};

class ImageProcessor {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 配置预处理器
   */
  configure(config) {
    this.config = { ...this.config, ...config };
  }

  /**
   * 读取图像文件
   */
  async loadImage(imagePath) {
    try {
      const absolutePath = path.resolve(imagePath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`图片文件文件不存在: ${imagePath}`);
      }

      const image = await cv.imreadAsync(absolutePath);
      return image;
    } catch (error) {
      throw new Error(`读取图片失败: ${error.message}`);
    }
  }

  /**
   * 保存图像文件
   */
  async saveImage(image, outputPath) {
    try {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await cv.imwriteAsync(outputPath, image);
      return outputPath;
    } catch (error) {
      throw new Error(`保存图片失败: ${error.message}`);
    }
  }

  /**
   * 歪斜校正（投影法）
   *
   * 算法说明：
   * 1. 将图像转换为灰度图
   * 2. 计算不同旋转角度下的水平投影（黑色像素数量）
   * 3. 选择具有最大投影峰值的旋转角度
   * 4. 旋转图像使其水平
   */
  async deskewImage(image) {
    if (!this.config.deskewEnabled) {
      console.log("歪斜校正已禁用");
      return { processed: image, angle: 0, applied: false };
    }

    try {
      console.log("开始歪斜校正...");
      const startTime = Date.now();

      // 转换为灰度图
      const gray = image.cvtColor(cv.COLOR_BGR2GRAY);

      // 尝试不同角度，找到最佳旋转角度
      const angles = [-2.0, -1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0];
      let bestAngle = 0;
      let bestProjection = 0;

      for (const angle of angles) {
        const rotated = gray.rotate(angle, gray.cols / 2, gray.rows / 2, cv.INTER_LINEAR, cv.BORDER_CONSTANT, 0);
        const projection = cv.sum(rotated, 0);

        // 寻找投影的峰值（黑色像素最多）
        const maxVal = Math.max(...projection);
        if (maxVal > bestProjection) {
          bestProjection = maxVal;
          bestAngle = angle;
        }
      }

      // 如果最佳角度超过阈值，进行旋转
      const processingTime = Date.now() - startTime;
      console.log(`歪斜校正完成，角度: ${bestAngle}°，用时: ${processingTime}ms`);

      if (Math.abs(bestAngle) > this.config.deskewAngleThreshold) {
        const rotated = image.rotate(bestAngle, image.cols / 2, image.rows / 2, cv.INTER_LINEAR, cv.BORDER_CONSTANT, 0);
        return { processed: rotated, angle: bestAngle, applied: true };
      }

      return { processed: image, angle: 0, applied: false };
    } catch (error) {
      console.error("歪斜校正失败:", error);
      return { processed: image, angle: 0, applied: false };
    }
  }

  /**
   * 对比度调整（CLAHE - 限制对比度自适应直方图均衡化）
   *
   * CLAHE 需要 LAB 或 YUV 色色空间
   */
  async enhanceContrast(image) {
    if (!this.config.contrastEnabled) {
      console.log("对比度调整已禁用");
      return { processed: image, applied: false };
    }

    try {
      console.log("开始对比度调整（CLAHE）...");
      const startTime = Date.now();

      // CLAHE 需要 LAB 或 YUV 色色空间
      const lab = image.cvtColor(cv.COLOR_BGR2Lab);

      // 分离 L 通道（亮度）
      const lChannel = new cv.Mat();
      cv.extractChannel(lab, lChannel, 0);

      // 创建 CLAHE 对象
      const clahe = new cv.CLAHE(
        this.config.claheTileGridSize,
        this.config.claheTileGridSize
      );

      // 应用 CLAHE 到 L 通道
      clahe.apply(lChannel, lChannel);

      // 合并通道回 LAB 空间
      cv.mergeChannels([lChannel, lab.at(1), lab.at(2)], lab);

      // 转换回 BGR 空间
      const processed = lab.cvtColor(cv.COLOR_Lab2BGR);

      // 应用裁剪限制防止过度增强
      processed.convertTo(processed, -1, 0, this.config.claheClipLimit, cv.CV_8U);

      const processingTime = Date.now() - startTime;
      console.log(`对比度调整完成，用时: ${processingTime}ms`);

      return { processed, applied: true };
    } catch (error) {
      console.error("对比度调整失败:", error);
      return { processed: image, applied: false };
    }
  }

  /**
   * 锐化（Unsharp Mask 算法）
   *
   * 算法：从原图减去模糊版本，增强边缘
   */
  async sharpenImage(image) {
    if (!this.config.sharpenEnabled) {
      console.log("锐化已禁用");
      return { processed: image, applied: false };
    }

    try {
      console.log("开始锐化...");
      const startTime = Date.now();

      // 创建高斯模糊版本
      const blurred = image.gaussianBlur(
        this.config.sharpenRadius,
        this.config.sharpenRadius,
        0,
        cv.BORDER_DEFAULT
      );

      // 计算 Unsharp Mask: 原图减去模糊版本
      const unsharpMask = image.sub(blurred);

      // 应用锐化强度
      unsharpMask.convertTo(unsharpMask, -1, 0, this.config.sharpenStrength, cv.CV_8U);

      // 将 Mask 加回模糊版本
      const sharpened = blurred.add.add(unsharpMask);

      const processingTime = Date.now() - startTime;
      console.log(`锐化完成，用时: ${processingTime}ms`);

      return { processed: sharpened, applied: true };
    } catch (error) {
      console.error("锐化失败:", error);
      return { processed: image, applied: false };
    }
  }

  /**
   * 降噪（双边滤波）
   *
   * 算法：保留边缘的同时平滑图像，适合 OCR 预处理
   */
  async denoiseImage(image) {
    if (!this.config.denoiseEnabled) {
      console.log("降噪已禁用");
      return { processed: image, applied: false };
    }

    try {
      console.log("开始降噪（双边滤波）...");
      const startTime = Date.now();

      // 应用双边滤波到彩色图像
      const denoised = image.bilateralFilter(
        this.config.bilateralDiameter,
        this.config.bilateralSigmaColor,
        this.config.bilateralSigmaSpace
      );

      const processingTime = Date.now() - startTime;
      console.log(`降噪完成，用时: ${processingTime}ms`);

      return { processed: denoised, applied: true };
    } catch (error) {
      console.error("降噪失败:", error);
      return { processed: image, applied: false };
    }
  }

  /**
   * 完整预处理流水线
   */
  async preprocess(imagePath, options = {}) {
    try {
      console.log(`\n开始预处理图像: ${path.basename(imagePath)}`);
      const startTime = Date.now();

      // 加载图像
      const original = await this.loadImage(imagePath);

      // 应用歪斜校正
      const { processed: deskewed, angle: deskewAngle } = await this.deskewImage(original);

      // 应用对比度调整
      const { processed: contrastEnhanced } = await this.enhanceContrast(deskewed);

      // 应用锐化
      const { processed: sharpened } = await this.sharpenImage(contrastEnhanced);

      // 应用降噪
      const { processed: denoised } = await this.denoiseImage(sharpened);

      const processingTime = Date.now() - startTime;
      console.log(`预处理完成，总用时: ${processingTime}ms\n`);

      return {
        original,
        processed: denoised,
        originalSize: {
          width: original.cols,
          height: original.rows
        },
        processedSize: {
          width: denoised.cols,
          height: denoised.rows
        },
        steps: {
          deskew: { applied: Math.abs(deskewAngle) > 0.5, angle: deskewAngle },
          contrast: { applied: true },
          sharpen: { applied: true },
          denoise: { applied: true }
        },
        processingTime
      };
    } catch (error) {
      console.error("预处理失败:", error);
      throw error;
    }
  }

  /**
   * 评估 OCR 识别质量
   *
   * 基于 tesseract.js 返回的置信度信息
   */
  assessQuality(ocrResult) {
    if (!ocrResult || !ocrResult.words || !ocrResult.confidence) {
      return {
        overallConfidence: 0,
        qualityLevel: 'unknown',
        needsReview: false,
        suspiciousWords: []
      };
    }

    try {
      console.log("评估 OCR 识别质量...");

      // 计算整体置信度
      const overallConfidence = ocrResult.confidence || 0;

      // 判断质量级别
      let qualityLevel;
      let needsReview = false;

      if (overallConfidence >= this.config.qualityThreshold + 20) {
        qualityLevel = 'high';
      } else if (overallConfidence >= this.config.qualityThreshold) {
        qualityLevel = 'medium';
        needsReview = true;
      } else {
        qualityLevel = 'low';
        needsReview = true;
      }

      // 识别低置信度单词
      const suspiciousWords = [];

      if (ocrResult.words) {
        ocrResult.words.forEach((word, index) => {
          if (word.confidence < this.config.lowConfidenceThreshold) {
            suspiciousWords.push({
              word: word.text,
              confidence: word.confidence,
              bbox: word.bbox,
              index: index
            });
          }
        });
      }

      console.log(`质量评估完成 - 整体: ${overallConfidence.toFixed(1)}, 级别: ${qualityLevel}`);
      console.log(`低置信度单词数量: ${suspiciousWords.length}`);

      return {
        overallConfidence,
        qualityLevel,
        needsReview,
        suspiciousWords,
        wordCount: ocrResult.words ? ocrResult.words.length : 0,
        lowConfidenceWordCount: suspiciousWords.length
      };
    } catch (error) {
      console.error("质量评估失败:", error);
      throw error;
    }
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return { ...this.config };
  }
}

module.exports = ImageProcessor;
