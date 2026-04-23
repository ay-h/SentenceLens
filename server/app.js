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
    const recordId = parseInt(req.params.id);
    const record = db.getRecordWithAnalyses(recordId);
    if (!record) {
      return res.status(404).json({ detail: 'Record not found' });
    }

    // Rebuild text from sentences
    const ocrText = db.rebuildTextFromSentences(recordId);

    res.json({
      ...record,
      ocr_text: ocrText
    });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

app.get('/api/records/:id/sentences', (req, res) => {
  try {
    const recordId = parseInt(req.params.id);
    
    // Get sentences from database
    const dbSentences = db.getSentencesByRecord(recordId);
    if (!dbSentences || dbSentences.length === 0) {
      return res.json({ sentences: [], paragraphs: [] });
    }

    // Group by paragraph_index
    const grouped = {};
    for (const s of dbSentences) {
      const pIndex = s.paragraph_index || 0;
      if (!grouped[pIndex]) {
        grouped[pIndex] = [];
      }
      grouped[pIndex].push(s);
    }

    // Sort by paragraph_index and sentence_index
    const paragraphs = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .map(pIndex => grouped[pIndex].sort((a, b) => a.sentence_index - b.sentence_index));

    res.json({ sentences: dbSentences, paragraphs });
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

// ==================== UUID-based Sentence Operations ====================

/**
 * Edit sentence by UUID
 * PUT /api/sentences/:id
 * Body: { text: "new sentence content" }
 */
app.put('/api/sentences/:id', (req, res) => {
  try {
    const sentenceId = req.params.id;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ detail: 'Text is required' });
    }

    // Get the sentence
    const sentence = db.getSentenceById(sentenceId);
    if (!sentence) {
      return res.status(404).json({ detail: 'Sentence not found' });
    }

    // Update sentence text
    db.updateSentenceText(sentenceId, text, sentence.paragraph_index, sentence.sentence_index);

    // Set is_modified flag
    db.execute(
      'UPDATE sentences SET is_modified = 1 WHERE id = ?',
      [sentenceId]
    );

    // Clear translations and analyses for this sentence
    db.execute('DELETE FROM sentence_translations WHERE sentence_id = ?', [sentenceId]);
    db.execute('DELETE FROM sentence_analyses WHERE sentence_id = ?', [sentenceId]);

    console.log(`Sentence updated: ${sentenceId}`);

    res.json({
      success: true,
      message: 'Sentence updated',
      sentence: db.getSentenceById(sentenceId)
    });
  } catch (error) {
    console.error('Sentence edit error:', error);
    res.status(500).json({ detail: error.message });
  }
});

/**
 * Delete sentence by UUID
 * DELETE /api/sentences/:id
 */
app.delete('/api/sentences/:id', (req, res) => {
  try {
    const sentenceId = req.params.id;

    // Get the sentence
    const sentence = db.getSentenceById(sentenceId);
    if (!sentence) {
      return res.status(404).json({ detail: 'Sentence not found' });
    }

    const recordId = sentence.record_id;
    const paragraphIndex = sentence.paragraph_index;
    const sentenceIndex = sentence.sentence_index;

    // Delete the sentence
    db.deleteSentence(sentenceId);

    // Recalculate paragraph_index and sentence_index for all paragraphs to ensure they start from 0
    const allSentences = db.getSentencesByRecord(recordId);
    const grouped = {};
    for (const s of allSentences) {
      const pIndex = s.paragraph_index || 0;
      if (!grouped[pIndex]) {
        grouped[pIndex] = [];
      }
      grouped[pIndex].push(s);
    }

    // Sort paragraphs by paragraph_index
    const sortedParagraphs = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b);

    // Reindex paragraphs starting from 0 and sentences within each paragraph starting from 0
    for (let p = 0; p < sortedParagraphs.length; p++) {
      const oldPIndex = sortedParagraphs[p];
      const paragraphSentences = grouped[oldPIndex].sort((a, b) => a.sentence_index - b.sentence_index);
      
      for (let i = 0; i < paragraphSentences.length; i++) {
        const s = paragraphSentences[i];
        const updates = [];
        if (s.paragraph_index !== p) {
          updates.push(`paragraph_index = ${p}`);
        }
        if (s.sentence_index !== i) {
          updates.push(`sentence_index = ${i}`);
        }
        if (updates.length > 0) {
          db.execute(`UPDATE sentences SET ${updates.join(', ')} WHERE id = ?`, [s.id]);
        }
      }
    }

    console.log(`Sentence deleted: ${sentenceId}`);

    res.json({
      success: true,
      message: 'Sentence deleted',
      sentences: db.getSentencesByRecord(recordId)
    });
  } catch (error) {
    console.error('Sentence delete error:', error);
    res.status(500).json({ detail: error.message });
  }
});

/**
 * Insert sentence by UUID
 * POST /api/sentences/insert
 * Body: { record_id, text, target_sentence_id, position: "before" | "after", new_paragraph: boolean }
 */
app.post('/api/sentences/insert', (req, res) => {
  try {
    const { record_id, text, target_sentence_id, position = 'after', new_paragraph = false } = req.body;

    if (!record_id || !text || !target_sentence_id) {
      return res.status(400).json({ detail: 'record_id, text, and target_sentence_id are required' });
    }

    if (position !== 'before' && position !== 'after') {
      return res.status(400).json({ detail: 'position must be "before" or "after"' });
    }

    // Get target sentence
    const targetSentence = db.getSentenceById(target_sentence_id);
    if (!targetSentence) {
      return res.status(404).json({ detail: 'Target sentence not found' });
    }

    const paragraph_index = targetSentence.paragraph_index;
    const sentence_index = targetSentence.sentence_index;

    // Generate new UUID
    const { generateUUID } = require('./services/sentenceSplit');
    const newSentenceId = generateUUID();

    // Calculate new paragraph index and sentence index
    let newParagraphIndex = paragraph_index;
    let newSentenceIndex = sentence_index;

    // Handle paragraph reindexing if opening new paragraph
    if (new_paragraph) {
      if (position === 'before') {
        // Insert before current paragraph - shift all paragraphs down
        newParagraphIndex = paragraph_index;
        const sentences = db.getSentencesByRecord(record_id);
        const affectedParagraphs = sentences
          .filter(s => s.paragraph_index >= paragraph_index)
          .map(s => s.id);

        for (const sentenceId of affectedParagraphs) {
          db.execute('UPDATE sentences SET paragraph_index = paragraph_index + 1 WHERE id = ?', [sentenceId]);
        }
      } else {
        // Insert after current paragraph - shift paragraphs after current one down
        newParagraphIndex = paragraph_index + 1;
        const sentences = db.getSentencesByRecord(record_id);
        const affectedParagraphs = sentences
          .filter(s => s.paragraph_index > paragraph_index)
          .map(s => s.id);

        for (const sId of affectedParagraphs) {
          db.execute('UPDATE sentences SET paragraph_index = paragraph_index + 1 WHERE id = ?', [sId]);
        }
      }
      newSentenceIndex = 0;
    } else {
      // Calculate new sentence index
      if (position === 'before') {
        newSentenceIndex = sentence_index;
        console.log(`Inserting before: newParagraphIndex=${newParagraphIndex}, newSentenceIndex=${newSentenceIndex}`);
        // Update existing sentences in the same paragraph
        const sentences = db.getSentencesByRecord(record_id);
        const affectedSentences = sentences
          .filter(s => s.paragraph_index === newParagraphIndex && s.sentence_index >= sentence_index)
          .sort((a, b) => b.sentence_index - a.sentence_index); // Sort descending to update from end

        console.log(`Affected sentences (before):`, affectedSentences.map(s => ({id: s.id, paragraph_index: s.paragraph_index, sentence_index: s.sentence_index})));

        for (const s of affectedSentences) {
          const result = db.execute('UPDATE sentences SET sentence_index = sentence_index + 1 WHERE id = ?', [s.id]);
          console.log(`Updated sentence ${s.id}: sentence_index ${s.sentence_index} -> ${s.sentence_index + 1}, changes: ${result.changes}`);
        }
      } else {
        newSentenceIndex = sentence_index + 1;
        console.log(`Inserting after: newParagraphIndex=${newParagraphIndex}, newSentenceIndex=${newSentenceIndex}`);
        // Update existing sentences in the same paragraph
        const sentences = db.getSentencesByRecord(record_id);
        const affectedSentences = sentences
          .filter(s => s.paragraph_index === newParagraphIndex && s.sentence_index > sentence_index)
          .sort((a, b) => b.sentence_index - a.sentence_index);

        console.log(`Affected sentences (after):`, affectedSentences.map(s => ({id: s.id, paragraph_index: s.paragraph_index, sentence_index: s.sentence_index})));

        for (const s of affectedSentences) {
          const result = db.execute('UPDATE sentences SET sentence_index = sentence_index + 1 WHERE id = ?', [s.id]);
          console.log(`Updated sentence ${s.id}: sentence_index ${s.sentence_index} -> ${s.sentence_index + 1}, changes: ${result.changes}`);
        }
      }
    }

    // Create the new sentence
    db.createSentence(record_id, text, newParagraphIndex, newSentenceIndex, newSentenceId);

    // Set is_modified flag
    db.execute(
      'UPDATE sentences SET is_modified = 1 WHERE id = ?',
      [newSentenceId]
    );

    console.log(`Sentence inserted: ${newSentenceId}, paragraph_index: ${newParagraphIndex}, sentence_index: ${newSentenceIndex}`);

    // Recalculate sentence indices for all paragraphs to ensure they start from 0
    const allSentences = db.getSentencesByRecord(record_id);
    const grouped = {};
    for (const s of allSentences) {
      const pIndex = s.paragraph_index || 0;
      if (!grouped[pIndex]) {
        grouped[pIndex] = [];
      }
      grouped[pIndex].push(s);
    }

    // Sort paragraphs by paragraph_index
    const sortedParagraphs = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b);

    // Reindex paragraphs starting from 0 and sentences within each paragraph starting from 0
    for (let p = 0; p < sortedParagraphs.length; p++) {
      const oldPIndex = sortedParagraphs[p];
      const paragraphSentences = grouped[oldPIndex].sort((a, b) => a.sentence_index - b.sentence_index);
      
      for (let i = 0; i < paragraphSentences.length; i++) {
        const s = paragraphSentences[i];
        const updates = [];
        if (s.paragraph_index !== p) {
          updates.push(`paragraph_index = ${p}`);
        }
        if (s.sentence_index !== i) {
          updates.push(`sentence_index = ${i}`);
        }
        if (updates.length > 0) {
          db.execute(`UPDATE sentences SET ${updates.join(', ')} WHERE id = ?`, [s.id]);
        }
      }
    }

    const updatedSentences = db.getSentencesByRecord(record_id);
    console.log(`Updated sentences count: ${updatedSentences.length}`);
    console.log(`All sentences after reindex:`, updatedSentences.map(s => ({id: s.id, paragraph_index: s.paragraph_index, sentence_index: s.sentence_index, text: s.text.substring(0, 30)})));

    res.json({
      success: true,
      message: 'Sentence inserted',
      sentences: updatedSentences
    });
  } catch (error) {
    console.error('Sentence insert error:', error);
    res.status(500).json({ detail: error.message });
  }
});

/**
 * Split sentence by UUID
 * POST /api/sentences/:id/split
 * Body: { split_position, new_paragraph }
 */
app.post('/api/sentences/:id/split', (req, res) => {
  try {
    const sentenceId = req.params.id;
    const { split_position, new_paragraph = false } = req.body;

    if (split_position === undefined || split_position === null) {
      return res.status(400).json({ detail: 'split_position is required' });
    }

    // Get the sentence
    const sentence = db.getSentenceById(sentenceId);
    if (!sentence) {
      return res.status(404).json({ detail: 'Sentence not found' });
    }

    const text = sentence.text;
    if (split_position <= 0 || split_position >= text.length) {
      return res.status(400).json({ detail: 'split_position must be between 0 and text length' });
    }

    const record_id = sentence.record_id;
    const paragraph_index = sentence.paragraph_index;
    const sentence_index = sentence.sentence_index;

    // Split the text
    const firstPart = text.substring(0, split_position).trim();
    const secondPart = text.substring(split_position).trim();

    if (!firstPart || !secondPart) {
      return res.status(400).json({ detail: 'Both parts must have content after split' });
    }

    // Generate new UUIDs
    const { generateUUID } = require('./services/sentenceSplit');
    const firstPartId = generateUUID();
    const secondPartId = generateUUID();

    // Handle paragraph assignment for second part
    let secondParagraphIndex = paragraph_index;
    if (new_paragraph) {
      secondParagraphIndex = paragraph_index + 1;
      // Shift all paragraphs after current one down
      const sentences = db.getSentencesByRecord(record_id);
      const affectedParagraphs = sentences
        .filter(s => s.paragraph_index > paragraph_index)
        .map(s => s.id);

      for (const sId of affectedParagraphs) {
        db.execute('UPDATE sentences SET paragraph_index = paragraph_index + 1 WHERE id = ?', [sId]);
      }
    }

    // Update sentence_index for sentences after the original
    const sentences = db.getSentencesByRecord(record_id);
    const affectedSentences = sentences
      .filter(s => s.paragraph_index === paragraph_index && s.sentence_index > sentence_index)
      .sort((a, b) => b.sentence_index - a.sentence_index);

    for (const s of affectedSentences) {
      db.execute('UPDATE sentences SET sentence_index = sentence_index + 1 WHERE id = ?', [s.id]);
    }

    // Delete the original sentence
    db.deleteSentence(sentenceId);

    // Create the two new sentences
    db.createSentence(record_id, firstPart, paragraph_index, sentence_index, firstPartId);
    db.createSentence(record_id, secondPart, secondParagraphIndex, sentence_index + 1, secondPartId);

    // Set is_modified flag for both new sentences
    db.execute('UPDATE sentences SET is_modified = 1 WHERE id = ?', [firstPartId]);
    db.execute('UPDATE sentences SET is_modified = 1 WHERE id = ?', [secondPartId]);

    // Clear translations and analyses for the original sentence
    db.execute('DELETE FROM sentence_translations WHERE sentence_id = ?', [sentenceId]);
    db.execute('DELETE FROM sentence_analyses WHERE sentence_id = ?', [sentenceId]);

    // Recalculate paragraph_index and sentence_index for all paragraphs to ensure they start from 0
    const allSentences = db.getSentencesByRecord(record_id);
    const grouped = {};
    for (const s of allSentences) {
      const pIndex = s.paragraph_index || 0;
      if (!grouped[pIndex]) {
        grouped[pIndex] = [];
      }
      grouped[pIndex].push(s);
    }

    // Sort paragraphs by paragraph_index
    const sortedParagraphs = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b);

    // Reindex paragraphs starting from 0 and sentences within each paragraph starting from 0
    for (let p = 0; p < sortedParagraphs.length; p++) {
      const oldPIndex = sortedParagraphs[p];
      const paragraphSentences = grouped[oldPIndex].sort((a, b) => a.sentence_index - b.sentence_index);
      
      for (let i = 0; i < paragraphSentences.length; i++) {
        const s = paragraphSentences[i];
        const updates = [];
        if (s.paragraph_index !== p) {
          updates.push(`paragraph_index = ${p}`);
        }
        if (s.sentence_index !== i) {
          updates.push(`sentence_index = ${i}`);
        }
        if (updates.length > 0) {
          db.execute(`UPDATE sentences SET ${updates.join(', ')} WHERE id = ?`, [s.id]);
        }
      }
    }

    console.log(`Sentence split: ${sentenceId} -> ${firstPartId}, ${secondPartId}`);

    res.json({
      success: true,
      message: 'Sentence split',
      sentences: db.getSentencesByRecord(record_id)
    });
  } catch (error) {
    console.error('Sentence split error:', error);
    res.status(500).json({ detail: error.message });
  }
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
 * Unified translation with SSE streaming - real-time translation results
 */
app.get('/api/records/:id/translate/stream', async (req, res) => {
  try {
    const recordId = parseInt(req.params.id);
    const { force_all = false } = req.query;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial event
    res.write(`event: start\n`);
    res.write(`data: ${JSON.stringify({ type: 'start', recordId })}\n\n`);

    // Callback to send translation results as they complete
    const streamCallback = (batchResult) => {
      try {
        res.write(`event: progress\n`);
        res.write(`data: ${JSON.stringify({ type: 'progress', ...batchResult })}\n\n`);
      } catch (error) {
        console.error('SSE write error:', error);
      }
    };

    // Perform translation with streaming callback
    const result = await translationService.performUnifiedTranslationStream(recordId, force_all, streamCallback);

    // Send final event
    res.write(`event: complete\n`);
    res.write(`data: ${JSON.stringify({ type: 'complete', ...result })}\n\n`);

    res.end();

  } catch (error) {
    console.error('SSE翻译错误:', error);
    try {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    } catch (e) {
      console.error('SSE error write failed:', e);
    }
  }
});

// ==================== Analysis Routes ====================
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
    const record = db.createRecord(sessionId, recordName, imagePath);

    // Sync sentences to database for UUID persistence
    const paragraphs = splitParagraphs(ocrText);
    let sentenceIndex = 0;
    for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
      const paragraph = paragraphs[pIndex];
      for (const sentence of paragraph) {
        db.createSentence(
          record.id,
          sentence.text,
          pIndex,
          sentenceIndex++,
          sentence.id
        );
      }
    }

    // Build response
    const response = {
      record_id: record.id,
      session_id: sessionId,
      name: recordName,
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
    const record = db.createRecord(sessionId, recordName, imagePath);

    // Sync sentences to database for UUID persistence
    const paragraphs = splitParagraphs(text);
    let sentenceIndex = 0;
    for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
      const paragraph = paragraphs[pIndex];
      for (const sentence of paragraph) {
        db.createSentence(
          record.id,
          sentence.text,
          pIndex,
          sentenceIndex++,
          sentence.id
        );
      }
    }

    res.json({
      record_id: record.id,
      session_id: sessionId,
      name: recordName,
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
    const { sentence, record_id, sentence_id } = req.body;

    console.log(`Analyzing sentence for record_id: ${record_id}`);

    // Check if analysis already exists (by sentence_id if provided)
    let existing;
    if (sentence_id) {
      existing = db.queryOne('SELECT * FROM sentence_analyses WHERE record_id = ? AND sentence_id = ?', [record_id, sentence_id]);
    } else {
      existing = db.getAnalysisBySentence(record_id, sentence);
    }
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
      // Save to database with sentence_id
      db.createAnalysis(record_id, sentence, analysis, 0, sentence_id);
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
