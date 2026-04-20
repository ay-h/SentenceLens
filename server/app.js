/**
 * Express.js Backend Server
 * Pure Node.js implementation matching Python FastAPI backend.
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const crypto = require('crypto');
const iconv = require('iconv-lite');

// Services
const ocrService = require('./services/ocr');
const llmService = require('./services/llm');
const dictionaryService = require('./services/dictionary');
const { splitSentences, splitParagraphs, cleanSentence } = require('./services/sentenceSplit');
const db = require('./models/database');

// Initialize services
const TextEditService = require('./services/textEdit');
const textEditService = new TextEditService(db);
const TranslationService = require('./services/translation');
const translationService = new TranslationService(db, llmService);

const app = express();
const PORT = 8000;

// Data directories
const DATA_DIR = path.join(process.env.APP_DATA_DIR || path.join(__dirname, '../data'));
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files - serve uploads
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure uploads dir exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, JPEG, and PNG are supported.'));
    }
  },
});

// ==================== Helper Functions ====================

/**
 * Decode filename - handles URL-encoded filenames from frontend
 * Frontend uses encodeURIComponent to handle Chinese characters
 */
function decodeFilename(filename) {
  if (!filename) return filename;

  // Try URL decoding first (for frontend-encoded filenames)
  if (filename.includes('%')) {
    try {
      const decoded = decodeURIComponent(filename);
      if (decoded !== filename) {
        return decoded;
      }
    } catch (e) {
      // URL decoding failed, continue
    }
  }

  // If already valid UTF-8 without replacement chars, return as-is
  if (!filename.includes('')) {
    return filename;
  }

  // If contains replacement chars, try to fix by treating as Latin1
  try {
    const buffer = Buffer.from(filename, 'binary');
    const utf8String = iconv.decode(buffer, 'latin1');
    if (!utf8String.includes('') && utf8String !== filename) {
      return utf8String;
    }
  } catch (e) {
    // Decoding failed
  }

  return filename;
}

function buildDefaultRecordName(rawName, fallback) {
  const name = (rawName || '').trim();
  if (name) return name.substring(0, 80);
  return (fallback || '').substring(0, 80);
}

function buildTextRecordName(rawName, text) {
  const normalized = text.trim().replace(/\s+/g, ' ');
  const fallback = normalized.substring(0, 20) + (normalized.length > 20 ? '...' : '');
  return buildDefaultRecordName(rawName, fallback || '未命名文本');
}

// ==================== Routes ====================

/**
 * Health Check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// ==================== Session Routes ====================

app.post('/api/sessions', (req, res) => {
  try {
    const { title } = req.body;
    const session = db.createSession(title || 'New Session');
    res.json(session);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.get('/api/sessions', (req, res) => {
  try {
    const sessions = db.getAllSessions();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.get('/api/sessions/:id', (req, res) => {
  try {
    const session = db.getSession(parseInt(req.params.id));
    if (!session) {
      return res.status(404).json({ detail: 'Session not found' });
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.put('/api/sessions/:id/title', (req, res) => {
  try {
    const { title } = req.body;
    const session = db.updateSessionTitle(parseInt(req.params.id), title);
    if (!session) {
      return res.status(404).json({ detail: 'Session not found' });
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.delete('/api/sessions/:id', (req, res) => {
  try {
    const success = db.deleteSession(parseInt(req.params.id));
    if (success) {
      res.json({ success: true, message: 'Session deleted successfully' });
    } else {
      res.status(404).json({ detail: 'Session not found' });
    }
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

// ==================== Record Routes ====================

app.get('/api/sessions/:id/records', (req, res) => {
  try {
    const records = db.getRecordsBySession(parseInt(req.params.id));
    res.json(records);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.get('/api/records/:id', (req, res) => {
  try {
    const record = db.getRecordWithAnalyses(parseInt(req.params.id));
    if (!record) {
      return res.status(404).json({ detail: 'Record not found' });
    }
    res.json(record);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.get('/api/records/:id/sentences', (req, res) => {
  try {
    const record = db.getRecord(parseInt(req.params.id));
    if (!record) {
      return res.status(404).json({ detail: 'Record not found' });
    }
    // Use splitParagraphs to get paragraph-grouped sentences
    const paragraphs = splitParagraphs(record.ocr_text);
    // Flatten the paragraphs into a single array with paragraph_index
    const sentences = [];
    let globalIndex = 0;
    for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
      const paragraphSentences = paragraphs[pIndex].map(s => cleanSentence(s)).filter(s => s);
      for (const text of paragraphSentences) {
        sentences.push({
          text: text,
          index: globalIndex,
          paragraph_index: pIndex
        });
        globalIndex++;
      }
    }
    res.json({ sentences, paragraphs });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.put('/api/records/:id/name', (req, res) => {
  try {
    const { name } = req.body;
    const recordName = buildDefaultRecordName(name, '未命名记录');
    const record = db.updateRecordName(parseInt(req.params.id), recordName);
    if (!record) {
      return res.status(404).json({ detail: 'Record not found' });
    }
    res.json(record);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

/**
 * Edit record text - detect changes and clear related translations/analyses
 */
app.put('/api/records/:id/text/edit', async (req, res) => {
  try {
    const recordId = parseInt(req.params.id);
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ detail: 'Text is required' });
    }

    const result = await textEditService.handleTextEdit(recordId, text);
    res.json(result);
  } catch (error) {
    console.error('Text edit error:', error);
    res.status(500).json({ detail: error.message });
  }
});

/**
 * Check if record has unsaved changes
 */
app.get('/api/records/:id/unsaved-changes', async (req, res) => {
  try {
    const recordId = parseInt(req.params.id);
    const hasChanges = await textEditService.hasUnsavedChanges(recordId);
    res.json({ hasUnsavedChanges: hasChanges });
  } catch (error) {
    console.error('Check unsaved changes error:', error);
    res.status(500).json({ detail: error.message });
  };
});

/**
 * Unified translation - automatically detects changes and translates only needed sentences
 */
app.post('/api/records/:id/translate', async (req, res) => {
  try {
    const recordId = parseInt(req.params.id);
    const { force_all = false } = req.body;

    // Use translation service for unified translation logic
    const result = await translationService.performUnifiedTranslation(recordId, force_all);

    // Return appropriate status code based on result
    if (!result.success) {
      if (result.code === 'UNSAVED_CHANGES') {
        return res.status(400).json(result);
      } else if (result.error && result.error.includes('未配置LLM')) {
        return res.status(400).json(result);
      } else if (result.error && result.error.includes('不存在')) {
        return res.status(404).json(result);
      } else {
        return res.status(500).json(result);
      }
    }

    res.json(result);

  } catch (error) {
    console.error('统一翻译错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '翻译过程中发生错误'
    });
  }
});

    /**
 * Get record OCR quality assessment
 */
app.get('/api/records/:id/quality', (req, res) => {
  try {
    const recordId = parseInt(req.params.id);
    const record = db.queryOne('SELECT ocr_quality, confidence_avg FROM records WHERE id = ?', [recordId]);

    if (!record) {
      return res.status(404).json({ detail: '记录不存在' });
    }

    res.json({
      record_id: recordId,
      ocr_quality: record.ocr_quality,
      confidence_avg: record.confidence_avg,
      needs_review: record.confidence_avg !== null && record.confidence_avg < 60
    });
  } catch (error) {
    console.error('Get quality error:', error);
    res.status(500).json({ detail: error.message });
  }
});

app.delete('/api/records/:id', (req, res) => {
  try {
    const success = db.deleteRecord(parseInt(req.params.id));
    if (success) {
      res.json({ success: true, message: 'Record deleted successfully' });
    } else {
      res.status(404).json({ detail: 'Record not found' });
    }
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

// ==================== Upload Route ====================

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { session_id, name, preprocess } = req.body;

    // Create session if not provided
    let sessionId = session_id ? parseInt(session_id) : null;
    if (!sessionId) {
      const session = db.createSession('Image Session');
      sessionId = session.id;
    }

    if (!req.file) {
      return res.status(400).json({ detail: 'No file provided' });
    }

    const filename = req.file.filename;
    const imagePath = `/uploads/${filename}`;

    // OCR preprocessing is enabled by default for all image uploads
    // This provides better text recognition for photos, scanned documents, etc.
    const enablePreprocess = true;
    const userConfig = {};

    // Perform OCR (with automatic preprocessing)
    const ocrResult = await ocrService.getOCRService().recognize(req.file.path, {
      preprocess: enablePreprocess,
      preprocessConfig: userConfig,
    });

    const ocrText = ocrResult.text;

    // Split and clean sentences
    let sentences = splitSentences(ocrText);
    sentences = sentences.map(s => cleanSentence(s)).filter(s => s);

    // Create record with decoded filename (handles URL-encoded filenames from frontend)
    const decodedFilename = decodeFilename(req.file.originalname || '');
    const originalName = path.parse(decodedFilename).name || '未命名图片';
    const recordName = buildDefaultRecordName(name, originalName);
    const record = db.createRecord(sessionId, recordName, imagePath, ocrText);

    // Build response
    const response = {
      record_id: record.id,
      session_id: sessionId,
      name: recordName,
      ocr_text: ocrText,
      sentences,
      image_path: imagePath,
    };

    // Add preprocessing info if applied
    if (ocrResult.preprocessing && ocrResult.preprocessing.applied) {
      response.preprocessing = ocrResult.preprocessing;
    }

    res.json(response);
  } catch (error) {
    console.error('Upload failed:', error);

    // Clean up file if upload failed
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ detail: error.message });
  }
});

// ==================== Text Processing Route ====================

app.post('/api/text', (req, res) => {
  try {
    const { text, session_id, name } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ detail: 'Text cannot be empty' });
    }

    // Create session if not provided
    let sessionId = session_id ? parseInt(session_id) : null;
    if (!sessionId) {
      const session = db.createSession('Text Session');
      sessionId = session.id;
    }

    // Split and clean sentences
    let sentences = splitSentences(text);
    sentences = sentences.map(s => cleanSentence(s)).filter(s => s);

    // Create record
    const imagePath = '/placeholder/text';
    const recordName = buildTextRecordName(name, text);
    const record = db.createRecord(sessionId, recordName, imagePath, text);

    res.json({
      record_id: record.id,
      session_id: sessionId,
      name: recordName,
      text,
      sentences,
    });
  } catch (error) {
    console.error('Text processing failed:', error);
    res.status(500).json({ detail: error.message });
  }
});

// ==================== Simple OCR Routes ====================

/**
 * POST /api/ocr/recognize
 * Recognize text with optional preprocessing (auto-rotation using Sharp)
 */
app.post('/api/ocr/recognize', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ detail: 'No image file provided' });
    }

    const enablePreprocess = req.body.preprocess === 'true' || req.body.preprocess === true;

    const ocr = ocrService.getOCRService();
    await ocr.initialize();

    const result = await ocr.recognize(req.file.path, {
      preprocess: enablePreprocess,
    });

    res.json({
      text: result.text,
      confidence: result.confidence,
      words: result.words,
      preprocessing: result.preprocessing || { applied: false },
    });

  } catch (error) {
    console.error('OCR recognize API error:', error);
    res.status(500).json({ detail: error.message });
  }
});

// ==================== Analysis Routes ====================

app.post('/api/analyze', async (req, res) => {
  try {
    const { sentence, record_id } = req.body;

    console.log(`Analyzing sentence for record_id: ${record_id}`);

    // Check if analysis already exists
    const existing = db.getAnalysisBySentence(record_id, sentence);
    if (existing) {
      console.log('Existing analysis found, returning cached result.');
      return res.json({ analysis: existing.analysis });
    }

    console.log('No existing analysis found, calling LLM...');

    // Get LLM config
    const config = db.getLatestLLMConfig();
    if (!config) {
      console.log('No LLM config found');
      return res.status(400).json({ detail: 'No LLM configuration found. Please configure LLM settings.' });
    }

    // Analyze sentence using LLM
    const analysis = await llmService.analyzeSentence(sentence, config.url, config.api_key, config.model);

    if (analysis.success) {
      // Save to database
      db.createAnalysis(record_id, sentence, analysis);
      console.log('Analysis saved to database');
    } else {
      console.log(`Analysis failed: ${analysis.error}`);
    }

    res.json({ analysis });
  } catch (error) {
    console.error('Analysis failed:', error);
    res.status(500).json({ detail: error.message });
  }
});

app.delete('/api/analyses/:id', (req, res) => {
  try {
    const success = db.deleteAnalysis(parseInt(req.params.id));
    if (success) {
      res.json({ success: true, message: 'Analysis deleted successfully' });
    } else {
      res.status(404).json({ detail: 'Analysis not found' });
    }
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

// POST /api/analysis/delete - Delete analysis by sentence (matches Python)
app.post('/api/analysis/delete', (req, res) => {
  try {
    const { sentence, record_id } = req.body;

    if (!sentence || !record_id) {
      return res.status(400).json({ detail: 'Missing sentence or record_id' });
    }

    const existing = db.getAnalysisBySentence(record_id, sentence);
    if (existing) {
      const success = db.deleteAnalysis(existing.id);
      if (success) {
        return res.json({ success: true, message: '分析结果已删除' });
      }
      return res.json({ success: false, message: '删除失败 - 记录不存在' });
    }

    res.json({ success: false, message: '未找到分析结果' });
  } catch (error) {
    res.status(500).json({ detail: `删除失败: ${error.message}` });
  }
});

// GET /api/analysis/test/:record_id - Test endpoint (matches Python)
app.get('/api/analysis/test/:record_id', (req, res) => {
  try {
    const analyses = db.getAnalysesByRecord(parseInt(req.params.record_id));
    res.json({ record_id: parseInt(req.params.record_id), analyses });
  } catch (error) {
    console.error(`Error listing analyses: ${error.message}`);
    res.json({ error: error.message });
  }
});

// ==================== LLM Config Routes ====================

app.get('/api/llm-config', (req, res) => {
  try {
    const config = db.getLatestLLMConfig();
    if (!config) {
      return res.status(404).json({ detail: 'No LLM configuration found' });
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.post('/api/llm-config', (req, res) => {
  try {
    const { url, api_key, model } = req.body;
    db.updateLLMConfig(url, api_key, model);
    res.json({ success: true, message: 'LLM configuration saved successfully' });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

// ==================== Translation Routes ====================

app.post('/api/translate', async (req, res) => {
  try {
    const { text, record_id } = req.body;

    // Get LLM config
    const config = db.getLatestLLMConfig();
    if (!config) {
      return res.status(400).json({ detail: '未配置LLM，请先在设置页面配置LLM' });
    }

    // Split and clean sentences
    let sentences = splitSentences(text);
    sentences = sentences.map(s => cleanSentence(s)).filter(s => s);

    if (sentences.length === 0) {
      return res.status(400).json({ detail: '没有找到可翻译的句子' });
    }

    // Use enhanced batch translation with caching
    const translationResults = await llmService.translateSentencesBatch(
      sentences, record_id, config.url, config.api_key, config.model, db
    );

    // Combine all translated sentences
    const translatedText = translationResults
      .filter(r => !r.error)
      .map(r => r.translated_sentence)
      .join(' ');

    // Check failures
    const failedCount = translationResults.filter(r => r.error).length;
    if (failedCount > 0) {
      console.log(`⚠️  ${failedCount} sentences failed to translate`);
    }

    res.json({
      translation: translatedText,
      original_text: text,
    });
  } catch (error) {
    console.error('Translation failed:', error);
    res.status(500).json({ detail: `翻译失败: ${error.message}` });
  }
});

app.get('/api/records/:id/translations', (req, res) => {
  try {
    const recordId = parseInt(req.params.id);
    const translations = db.getTranslationsByRecord(recordId);
    res.json({
      record_id: recordId,
      translations,
      has_translations: translations.length > 0,
    });
  } catch (error) {
    res.status(500).json({ detail: `获取翻译失败: ${error.message}` });
  }
});

// ==================== Word Lookup Routes ====================

app.post('/api/word-lookup', async (req, res) => {
  try {
    const { word } = req.body;
    if (!word || !word.trim()) {
      return res.status(400).json({ detail: '请提供要查询的单词' });
    }

    const normalized = dictionaryService.normalizeWord(word);
    if (!normalized) {
      return res.status(400).json({ detail: '无效的单词' });
    }

    // 1. Check server-side cache (word_definitions table)
    const cached = db.getWordDefinition(normalized);
    if (cached) {
      const definition = JSON.parse(cached.definition_json);
      console.log(`查词缓存命中: ${normalized} (来源: ${cached.source})`);
      return res.json({ definition, source: cached.source, cached: true });
    }

    // 2. Try local ECDICT dictionary
    const dictResult = dictionaryService.lookupFromDictionary(normalized);
    if (dictResult) {
      // Cache the dictionary result
      //db.createWordDefinition(normalized, dictResult, 'dictionary');
      console.log(`词库命中: ${normalized}`);
      return res.json({ definition: dictResult, source: 'dictionary', cached: false });
    }

    // 3. Fallback to LLM
    const config = db.getLatestLLMConfig();
    if (!config) {
      return res.status(400).json({ detail: '本地词库未收录该单词，且未配置 LLM。请先在设置中配置 LLM。' });
    }

    console.log(`词库未命中，调用 LLM 查词: ${normalized}`);
    const llmResult = await llmService.lookupWord(normalized, config.url, config.api_key, config.model);

    // Cache LLM result
    db.createWordDefinition(normalized, llmResult, 'llm');
    console.log(`LLM 查词成功并已缓存: ${normalized}`);

    return res.json({ definition: llmResult, source: 'llm', cached: false });
  } catch (error) {
    console.error('查词失败:', error.message);
    res.status(500).json({ detail: `查词失败: ${error.message}` });
  }
});

// ==================== Server Start ====================

async function startServer() {
  try {
    // Ensure uploads directory exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    // Initialize database
    await db.initialize();

    // Initialize dictionary (non-blocking, graceful if missing)
    await dictionaryService.initDictionary();

    app.listen(PORT, '127.0.0.1', () => {
      console.log(`Server running on http://127.0.0.1:${PORT}`);
      console.log(`Data directory: ${DATA_DIR}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app };
