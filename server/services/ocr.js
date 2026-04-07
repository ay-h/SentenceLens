/**
 * OCR Service using tesseract.js v7
 * Uses the static Tesseract.recognize() API for simplicity and reliability.
 * Integrated with image preprocessing pipeline for better accuracy.
 */

const Tesseract = require("tesseract.js");
const path = require("path");
const fs = require("fs");
const { preprocessImage } = require("./imageProcessor");

// Local path to eng.traineddata (project root, 2 levels up from server/services/)
const LANG_DATA_DIR = path.join(__dirname, "../..");

class OCRService {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
  }

  /**
   * Get tesseract.js worker options for local language data.
   * Uses the bundled eng.traineddata so no network fetch is needed.
   * Enables OSD for automatic rotation detection.
   */
  _getWorkerOptions() {
    return {
      cachePath: LANG_DATA_DIR,
      cacheMethod: "readOnly",
      gzip: false,
    };
  }

  /**
   * Initialize a persistent worker for repeated use.
   * Falls back to static recognize() if worker creation fails.
   */
  async initialize() {
    if (this.isInitialized) return;

    console.log("Initializing tesseract.js worker...");
    console.log(`Language data directory: ${LANG_DATA_DIR}`);
    try {
      this.worker = await Tesseract.createWorker("eng", undefined, this._getWorkerOptions());
      this.isInitialized = true;
      console.log("tesseract.js worker initialized successfully");
    } catch (error) {
      console.warn("Worker init failed, will use static recognize():", error.message);
      this.worker = null;
      this.isInitialized = false;
    }
  }

  /**
   * Recognize text from an image file path.
   * Optionally applies preprocessing for better OCR accuracy.
   * 
   * @param {string} imagePath - Path to image file
   * @param {Object} options - Recognition options
   * @param {boolean} options.preprocess - Whether to apply image preprocessing
   * @param {Object} options.preprocessConfig - Configuration for preprocessing pipeline
   * @param {Function} options.onProgress - Progress callback for preprocessing
   * @returns {Promise<Object>} OCR result with text and metadata
   */
  async recognize(imagePath, options = {}) {
    const { preprocess = false, preprocessConfig = {}, onProgress = null } = options;
    
    console.log(`Performing OCR: ${imagePath}${preprocess ? ' (with preprocessing)' : ''}`);

    const absolutePath = path.isAbsolute(imagePath)
      ? imagePath
      : path.join(__dirname, "../../data/uploads", imagePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Image file not found: ${absolutePath}`);
    }

    let processedPath = absolutePath;
    let preprocessResult = null;

    // Apply preprocessing if requested
    if (preprocess) {
      try {
        preprocessResult = await preprocessImage(absolutePath, {
          brightness: 1.1,
          contrast: 1.2,
          grayscale: true,
        });
        processedPath = preprocessResult.processedPath;
        console.log(`Preprocessing completed: ${processedPath} (rotated ${preprocessResult.steps[0]?.angle || 0}°)`);
      } catch (error) {
        console.warn("Preprocessing failed, using original image:", error.message);
        processedPath = absolutePath;
      }
    }

    let result;

    // Try persistent worker first
    if (this.isInitialized && this.worker) {
      try {
        result = await this.worker.recognize(processedPath);
      } catch (err) {
        console.warn("Worker recognize failed, falling back to static API:", err.message);
        this.worker = null;
        this.isInitialized = false;
      }
    }

    // Fallback: static Tesseract.recognize() — creates a temporary worker
    if (!result) {
      result = await Tesseract.recognize(processedPath, "eng", this._getWorkerOptions());
    }

    if (!result || !result.data || !result.data.text) {
      throw new Error("OCR failed: No text recognized");
    }

    const text = result.data.text.trim();
    console.log(`OCR completed, text length: ${text.length}`);

    // Build response with preprocessing metadata
    const response = {
      text,
      confidence: result.data.confidence || 0,
      words: result.data.words || [],
    };

    // Add preprocessing info if applied
    if (preprocessResult) {
      response.preprocessing = {
        applied: true,
        steps: preprocessResult.steps.map(s => ({
          name: s.name,
          applied: s.applied,
          skipped: s.skipped,
          metrics: s.metrics,
        })),
        totalProcessingTimeMs: preprocessResult.totalProcessingTimeMs,
      };
    }

    return response;
  }

  /**
   * Recognize text from an image buffer.
   * Note: Preprocessing is not supported for buffers in this version.
   */
  async recognizeBuffer(buffer) {
    console.log("Performing OCR on image buffer...");

    let result;

    if (this.isInitialized && this.worker) {
      try {
        result = await this.worker.recognize(buffer);
      } catch (err) {
        console.warn("Worker recognize failed, falling back:", err.message);
        this.worker = null;
        this.isInitialized = false;
      }
    }

    if (!result) {
      result = await Tesseract.recognize(buffer, "eng", this._getWorkerOptions());
    }

    if (!result || !result.data || !result.data.text) {
      throw new Error("OCR failed: No text recognized");
    }

    const text = result.data.text.trim();
    console.log(`OCR completed, text length: ${text.length}`);

    return {
      text,
      confidence: result.data.confidence || 0,
      words: result.data.words || [],
      preprocessing: { applied: false },
    };
  }

  /**
   * Recognize with preprocessing pipeline (convenience method)
   * @param {string} imagePath - Path to image
   * @param {Object} preprocessConfig - Preprocessing configuration
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} OCR result with preprocessing metadata
   */
  async recognizeWithPreprocess(imagePath, preprocessConfig = {}, onProgress = null) {
    return this.recognize(imagePath, {
      preprocess: true,
      preprocessConfig,
      onProgress,
    });
  }

  /**
   * Terminate worker
   */
  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      console.log("tesseract.js worker terminated");
    }
  }

  isReady() {
    return this.isInitialized;
  }
}

// Singleton
let ocrService = null;

function getOCRService() {
  if (!ocrService) {
    ocrService = new OCRService();
  }
  return ocrService;
}

module.exports = {
  OCRService,
  getOCRService,
};
