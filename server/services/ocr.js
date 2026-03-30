/**
 * OCR Service using tesseract.js v7
 * Uses the static Tesseract.recognize() API for simplicity and reliability.
 */

const Tesseract = require("tesseract.js");
const path = require("path");
const fs = require("fs");

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
   */
  async recognize(imagePath) {
    console.log(`Performing OCR: ${imagePath}`);

    const absolutePath = path.isAbsolute(imagePath)
      ? imagePath
      : path.join(__dirname, "../../data/uploads", imagePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Image file not found: ${absolutePath}`);
    }

    let result;

    // Try persistent worker first
    if (this.isInitialized && this.worker) {
      try {
        result = await this.worker.recognize(absolutePath);
      } catch (err) {
        console.warn("Worker recognize failed, falling back to static API:", err.message);
        this.worker = null;
        this.isInitialized = false;
      }
    }

    // Fallback: static Tesseract.recognize() — creates a temporary worker
    if (!result) {
      result = await Tesseract.recognize(absolutePath, "eng", this._getWorkerOptions());
    }

    if (!result || !result.data || !result.data.text) {
      throw new Error("OCR failed: No text recognized");
    }

    const text = result.data.text.trim();
    console.log(`OCR completed, text length: ${text.length}`);
    return text;
  }

  /**
   * Recognize text from an image buffer.
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
    return text;
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
