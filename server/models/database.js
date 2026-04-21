/**
 * Database Service
 * SQLite implementation using sql.js (pure JavaScript WASM, no compilation needed)
 * Matches Python backend schema exactly.
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;

// Database path will be set from environment or default to local data dir
let DB_PATH = path.join(process.env.APP_DATA_DIR || path.join(__dirname, '../../data'), 'database.db');
let db = null;
let saveTimer = null;

/**
 * Get database instance
 */
function getDB() {
  return db;
}

/**
 * Save database to disk (debounced)
 */
function saveToDisk() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (error) {
    console.error('Failed to save database to disk:', error);
  }
}

/**
 * Schedule a debounced save to disk
 */
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToDisk, 500);
}

/**
 * Execute a query and return all rows as objects
 */
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Execute a query and return the first row as an object, or null
 */
function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

/**
 * Execute a statement (INSERT/UPDATE/DELETE) and return info
 */
function execute(sql, params = []) {
  db.run(sql, params);
  const lastId = db.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0] || 0;
  const changes = db.getRowsModified();
  scheduleSave();
  return { lastInsertRowid: lastId, changes };
}

/**
 * Run database migrations
 */
async function runMigrations() {
  console.log('Running database migrations...');

  // Get table info to check what columns exist
  function getColumns(tableName) {
    const result = queryOne(`PRAGMA table_info(${tableName})`);
    return result ? Object.keys(result).filter(k => k !== 'cid' && k !== 'name' && k !== 'type' && k !== 'notnull' && k !== 'dflt_value' && k !== 'pk') : [];
  }

  function getTables() {
    const result = queryAll("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    return result.map(t => t.name);
  }

  // Migration 001: Add OCR quality fields to records table
  const recordsColumns = getColumns('records');
  try {
    if (!recordsColumns.includes('ocr_quality')) {
      console.log('Migration 001: Adding ocr_quality column to records');
      db.run('ALTER TABLE records ADD COLUMN ocr_quality TEXT');
    }
  } catch (e) {
    console.log('Migration 001: ocr_quality column may already exist, skipping');
  }
  try {
    if (!recordsColumns.includes('confidence_avg')) {
      console.log('Migration 001: Adding confidence_avg column to records');
      db.run('ALTER TABLE records ADD COLUMN confidence_avg REAL');
    }
  } catch (e) {
    console.log('Migration 001: confidence_avg column may already exist, skipping');
  }

  // Migration 002: Add is_modified field to sentences table (if it exists)
  try {
    const sentencesColumns = getColumns('sentences');
    if (!sentencesColumns.includes('is_modified')) {
      console.log('Migration 002: Adding is_modified column to sentences');
      db.run('ALTER TABLE sentences ADD COLUMN is_modified INTEGER DEFAULT 0');
    }
  } catch (e) {
    // sentences table may not exist yet (we use sentence_analyses)
    console.log('Migration 002: sentences table not found, skipping');
  }

  // Migration 003: Add paragraph_index to sentence_analyses and sentence_translations
  try {
    const analysesColumns = getColumns('sentence_analyses');
    if (!analysesColumns.includes('paragraph_index')) {
      console.log('Migration 003: Adding paragraph_index column to sentence_analyses');
      db.run('ALTER TABLE sentence_analyses ADD COLUMN paragraph_index INTEGER DEFAULT 0');
    }
  } catch (e) {
    console.log('Migration 003: paragraph_index column may already exist in sentence_analyses, skipping');
  }

  try {
    const translationsColumns = getColumns('sentence_translations');
    if (!translationsColumns.includes('paragraph_index')) {
      console.log('Migration 003: Adding paragraph_index column to sentence_translations');
      db.run('ALTER TABLE sentence_translations ADD COLUMN paragraph_index INTEGER DEFAULT 0');
    }
  } catch (e) {
    console.log('Migration 003: paragraph_index column may already exist in sentence_translations, skipping');
  }

  // Migration 004: Add sentence_id field to sentence_translations for UUID-based matching
  try {
    const translationsColumns = getColumns('sentence_translations');
    if (!translationsColumns.includes('sentence_id')) {
      console.log('Migration 004: Adding sentence_id column to sentence_translations');
      db.run('ALTER TABLE sentence_translations ADD COLUMN sentence_id TEXT');
    }
  } catch (e) {
    console.log('Migration 004: sentence_id column may already exist in sentence_translations, skipping');
  }

  // Migration 005: Add sentence_id field to sentence_analyses for UUID-based matching
  try {
    const analysesColumnsForId = getColumns('sentence_analyses');
    if (!analysesColumnsForId.includes('sentence_id')) {
      console.log('Migration 005: Adding sentence_id column to sentence_analyses');
      db.run('ALTER TABLE sentence_analyses ADD COLUMN sentence_id TEXT');
    }
  } catch (e) {
    console.log('Migration 005: sentence_id column may already exist in sentence_analyses, skipping');
  }

  // Migration 007: Remove ocr_text column from records table (if it exists)
  try {
    const recordsColumns = getColumns('records');
    if (recordsColumns.includes('ocr_text')) {
      console.log('Migration 007: Removing ocr_text column from records');
      // SQLite doesn't support DROP COLUMN directly, need to recreate table
      db.run(`
        CREATE TABLE records_new AS SELECT id, session_id, name, image_path, created_at FROM records
      `);
      db.run('DROP TABLE records');
      db.run(`ALTER TABLE records_new RENAME TO records`);
      db.run('CREATE INDEX IF NOT EXISTS idx_records_session_id ON records(session_id)');
    }
  } catch (e) {
    console.log('Migration 007: ocr_text column may not exist, skipping');
  }

  // Migration 006: Create sentences table to store sentence UUIDs
  try {
    const tables = getTables();
    if (!tables.includes('sentences')) {
      console.log('Migration 006: Creating sentences table');
      db.run(`
        CREATE TABLE IF NOT EXISTS sentences (
          id TEXT PRIMARY KEY,
          record_id INTEGER NOT NULL,
          text TEXT NOT NULL,
          paragraph_index INTEGER DEFAULT 0,
          sentence_index INTEGER DEFAULT 0,
          is_modified INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
        )
      `);
      // Create index for faster queries
      db.run('CREATE INDEX IF NOT EXISTS idx_sentences_record_id ON sentences(record_id)');
    }
  } catch (e) {
    console.log('Migration 006: sentences table may already exist, skipping');
  }

  // Migration 008: Ensure is_modified column exists in sentences table
  try {
    const sentencesColumns = getColumns('sentences');
    if (!sentencesColumns.includes('is_modified')) {
      console.log('Migration 008: Adding is_modified column to sentences');
      db.run('ALTER TABLE sentences ADD COLUMN is_modified INTEGER DEFAULT 0');
    }
  } catch (e) {
    console.log('Migration 008: is_modified column may already exist, skipping');
  }

  console.log('Migrations completed');
}

/**
 * Initialize database and create tables
 */
async function initialize() {
  try {
    console.log('Initializing database...');
    console.log(`Database path: ${DB_PATH}`);

    // Ensure data directory exists
    const dbDir = path.dirname(DB_PATH);
    await fsPromises.mkdir(dbDir, { recursive: true });

    // Initialize sql.js
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
      console.log('Loaded existing database');
    } else {
      db = new SQL.Database();
      console.log('Created new database');
    }

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON;');

    console.log('Creating tables...');

    // Create sessions table (matches Python schema with updated_at)
    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT 'New Session',
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
      )
    `);

    // Create records table
    db.run(`
      CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        name TEXT NOT NULL DEFAULT '未命名记录',
        image_path TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    // Create sentence_analyses table
    db.run(`
      CREATE TABLE IF NOT EXISTS sentence_analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        sentence TEXT NOT NULL,
        analysis JSON NOT NULL,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
      )
    `);

    // Create sentence_translations table (matches Python schema with sentence_index)
    db.run(`
      CREATE TABLE IF NOT EXISTS sentence_translations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        original_sentence TEXT NOT NULL,
        translated_sentence TEXT NOT NULL,
        sentence_index INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
      )
    `);

    // Create llm_config table
    db.run(`
      CREATE TABLE IF NOT EXISTS llm_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        api_key TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
      )
    `);

    // Create word_definitions table for word lookup cache
    db.run(`
      CREATE TABLE IF NOT EXISTS word_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL UNIQUE,
        definition_json TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'dictionary',
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
      )
    `);

    // Create indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_records_session_id ON records(session_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sentence_analyses_record_id ON sentence_analyses(record_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sentence_translations_record_id ON sentence_translations(record_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sentence_translations_record_index ON sentence_translations(record_id, sentence_index)');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_word_definitions_word ON word_definitions(word)');

    // Run migrations
    await runMigrations();

    // Save initial state
    saveToDisk();

    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * ==================== Session Operations ====================
 */

function createSession(title) {
  const result = execute(
    'INSERT INTO sessions (title) VALUES (?)',
    [title || 'New Session']
  );
  return queryOne('SELECT * FROM sessions WHERE id = ?', [result.lastInsertRowid]);
}

function getAllSessions() {
  return queryAll('SELECT * FROM sessions ORDER BY updated_at DESC');
}

function getSession(id) {
  return queryOne('SELECT * FROM sessions WHERE id = ?', [id]);
}

function updateSessionTitle(id, title) {
  execute(
    "UPDATE sessions SET title = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
    [title, id]
  );
  return queryOne('SELECT * FROM sessions WHERE id = ?', [id]);
}

function updateSessionTimestamp(sessionId) {
  execute(
    "UPDATE sessions SET updated_at = datetime('now', 'localtime') WHERE id = ?",
    [sessionId]
  );
}

function deleteSession(id) {
  console.log(`Starting deletion of session ${id}`);

  // Get records to delete image files
  const records = getRecordsBySession(id);
  console.log(`Found ${records.length} records for session ${id}`);

  // Delete image files
  let deletedFiles = 0;
  for (const record of records) {
    const imagePath = record.image_path;
    if (imagePath && !imagePath.startsWith('/placeholder/')) {
      if (imagePath.startsWith('/uploads/')) {
        const filename = imagePath.replace('/uploads/', '');
        const uploadsDir = path.join(process.env.APP_DATA_DIR || path.join(__dirname, '../../data'), 'uploads');
        const filePath = path.join(uploadsDir, filename);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            deletedFiles++;
            console.log(`Deleted image file: ${filePath}`);
          } catch (e) {
            console.error(`Failed to delete image file ${filePath}: ${e}`);
          }
        }
      }
    }
  }
  console.log(`Deleted ${deletedFiles} image files`);

  // Delete related data in correct order
  execute(
    'DELETE FROM sentence_analyses WHERE record_id IN (SELECT id FROM records WHERE session_id = ?)',
    [id]
  );
  execute(
    'DELETE FROM sentence_translations WHERE record_id IN (SELECT id FROM records WHERE session_id = ?)',
    [id]
  );
  execute('DELETE FROM records WHERE session_id = ?', [id]);
  const result = execute('DELETE FROM sessions WHERE id = ?', [id]);

  return result.changes > 0;
}

/**
 * ==================== Record Operations ====================
 */

function createRecord(sessionId, name, imagePath) {
  const result = execute(
    'INSERT INTO records (session_id, name, image_path) VALUES (?, ?, ?)',
    [sessionId, name, imagePath]
  );
  // Update session timestamp
  updateSessionTimestamp(sessionId);
  return queryOne('SELECT * FROM records WHERE id = ?', [result.lastInsertRowid]);
}

function getRecord(id) {
  return queryOne('SELECT * FROM records WHERE id = ?', [id]);
}

function getRecordWithAnalyses(id) {
  const record = queryOne('SELECT * FROM records WHERE id = ?', [id]);
  if (!record) return null;

  const analyses = queryAll(
    'SELECT * FROM sentence_analyses WHERE record_id = ? ORDER BY created_at DESC',
    [id]
  );

  // Parse analysis JSON for each result
  for (const a of analyses) {
    try {
      a.analysis = JSON.parse(a.analysis);
    } catch (e) {
      // keep as string if parsing fails
    }
  }

  return { ...record, analyses };
}

function getRecordsBySession(sessionId) {
  return queryAll(
    'SELECT * FROM records WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId]
  );
}

function updateRecordName(id, name) {
  execute('UPDATE records SET name = ? WHERE id = ?', [name, id]);
  const record = queryOne('SELECT * FROM records WHERE id = ?', [id]);
  if (record) {
    updateSessionTimestamp(record.session_id);
  }
  return record;
}

function deleteRecord(id) {
  console.log(`Starting deletion of record ${id}`);

  const record = getRecord(id);
  if (!record) {
    console.log(`Record ${id} not found`);
    return false;
  }

  const sessionId = record.session_id;
  const imagePath = record.image_path;

  // Delete image file if it exists
  if (imagePath && !imagePath.startsWith('/placeholder/')) {
    if (imagePath.startsWith('/uploads/')) {
      const filename = imagePath.replace('/uploads/', '');
      const uploadsDir = path.join(process.env.APP_DATA_DIR || path.join(__dirname, '../../data'), 'uploads');
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`Deleted image file: ${filePath}`);
        } catch (e) {
          console.error(`Failed to delete image file ${filePath}: ${e}`);
        }
      }
    }
  }

  // Delete related data
  execute('DELETE FROM sentence_analyses WHERE record_id = ?', [id]);
  execute('DELETE FROM sentence_translations WHERE record_id = ?', [id]);
  execute('DELETE FROM sentences WHERE record_id = ?', [id]);
  const result = execute('DELETE FROM records WHERE id = ?', [id]);

  // Update session timestamp
  updateSessionTimestamp(sessionId);

  return result.changes > 0;
}

/**
 * ==================== Analysis Operations ====================
 */

function createAnalysis(recordId, sentence, analysisResult, paragraphIndex = 0, sentenceId) {
  // Normalize sentence to ensure consistent storage
  const normalizedSentence = sentence.replace(/\s+/g, ' ').trim();

  const result = execute(
    'INSERT INTO sentence_analyses (record_id, sentence, analysis, paragraph_index, sentence_id) VALUES (?, ?, ?, ?, ?)',
    [recordId, normalizedSentence, JSON.stringify(analysisResult), paragraphIndex, sentenceId || null]
  );
  const analysis = queryOne('SELECT * FROM sentence_analyses WHERE id = ?', [result.lastInsertRowid]);
  if (analysis) {
    try {
      analysis.analysis = JSON.parse(analysis.analysis);
    } catch (e) { /* keep as string */ }
  }
  return analysis;
}

function getAnalysisBySentence(recordId, sentence) {
  // Normalize sentence to match stored format
  const normalizedSentence = sentence.replace(/\s+/g, ' ').trim();

  const analysis = queryOne(
    'SELECT * FROM sentence_analyses WHERE record_id = ? AND sentence = ?',
    [recordId, normalizedSentence]
  );

  if (analysis) {
    try {
      analysis.analysis = JSON.parse(analysis.analysis);
    } catch (e) { /* keep as string */ }

    // Validate that this is a proper LLM analysis (matching Python validation)
    const a = analysis.analysis;
    if (typeof a === 'object' && a !== null && (
      a.sentence_overview ||
      a.main_clause ||
      a.subordinate_clauses ||
      a.structure_explanation ||
      a.success === true
    )) {
      return analysis;
    }

    console.log('Analysis validation failed - not a proper LLM analysis');
    return null;
  }

  return null;
}

function getAnalysesByRecord(recordId) {
  const analyses = queryAll(
    'SELECT * FROM sentence_analyses WHERE record_id = ? ORDER BY created_at DESC',
    [recordId]
  );

  for (const a of analyses) {
    try {
      a.analysis = JSON.parse(a.analysis);
    } catch (e) { /* keep as string */ }
  }

  return analyses;
}

function getAnalysesByRecordGrouped(recordId) {
  const analyses = queryAll(
    'SELECT * FROM sentence_analyses WHERE record_id = ? ORDER BY paragraph_index ASC, created_at ASC',
    [recordId]
  );

  for (const a of analyses) {
    try {
      a.analysis = JSON.parse(a.analysis);
    } catch (e) { /* keep as string */ }
  }

  // Group by paragraph_index
  const grouped = {};
  for (const a of analyses) {
    const pIndex = a.paragraph_index || 0;
    if (!grouped[pIndex]) {
      grouped[pIndex] = [];
    }
    grouped[pIndex].push(a);
  }

  // Convert to array and sort by paragraph index
  return Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b)
    .map(pIndex => grouped[pIndex]);
}

function deleteAnalysis(id) {
  const result = execute('DELETE FROM sentence_analyses WHERE id = ?', [id]);
  return result.changes > 0;
}

/**
 * ==================== Sentence Operations ====================
 */

function createSentence(recordId, text, paragraphIndex, sentenceIndex, sentenceId) {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const result = execute(
    'INSERT INTO sentences (id, record_id, text, paragraph_index, sentence_index) VALUES (?, ?, ?, ?, ?)',
    [sentenceId, recordId, normalizedText, paragraphIndex, sentenceIndex]
  );
  return queryOne('SELECT * FROM sentences WHERE id = ?', [sentenceId]);
}

function getSentencesByRecord(recordId) {
  return queryAll(
    'SELECT * FROM sentences WHERE record_id = ? ORDER BY paragraph_index ASC, sentence_index ASC',
    [recordId]
  );
}

function getSentenceById(sentenceId) {
  return queryOne('SELECT * FROM sentences WHERE id = ?', [sentenceId]);
}

function deleteSentence(sentenceId) {
  const result = execute('DELETE FROM sentences WHERE id = ?', [sentenceId]);
  return result.changes > 0;
}

function deleteSentencesByRecord(recordId) {
  execute('DELETE FROM sentences WHERE record_id = ?', [recordId]);
}

function updateSentenceText(sentenceId, newText) {
  const normalizedText = newText.replace(/\s+/g, ' ').trim();
  execute('UPDATE sentences SET text = ? WHERE id = ?', [normalizedText, sentenceId]);
  return getSentenceById(sentenceId);
}

/**
 * ==================== LLM Config Operations ====================
 */

function updateLLMConfig(url, apiKey, model) {
  const existing = queryOne('SELECT * FROM llm_config ORDER BY created_at DESC LIMIT 1');

  if (existing) {
    execute(
      "UPDATE llm_config SET url = ?, api_key = ?, model = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
      [url, apiKey, model, existing.id]
    );
  } else {
    execute(
      'INSERT INTO llm_config (url, api_key, model) VALUES (?, ?, ?)',
      [url, apiKey, model]
    );
  }

  return queryOne('SELECT * FROM llm_config ORDER BY id DESC LIMIT 1');
}

function getLatestLLMConfig() {
  return queryOne('SELECT * FROM llm_config ORDER BY created_at DESC LIMIT 1');
}

/**
 * ==================== Translation Operations ====================
 */

function createTranslation(recordId, originalSentence, translatedSentence, sentenceIndex, paragraphIndex, sentenceId) {
  const normalizedOriginal = originalSentence.split(' ').join(' ');

  const result = execute(
    'INSERT INTO sentence_translations (record_id, original_sentence, translated_sentence, sentence_index, paragraph_index, sentence_id) VALUES (?, ?, ?, ?, ?, ?)',
    [recordId, normalizedOriginal, translatedSentence, sentenceIndex || 0, paragraphIndex, sentenceId || null]
  );
  return queryOne('SELECT * FROM sentence_translations WHERE id = ?', [result.lastInsertRowid]);
}

function getTranslationBySentence(recordId, original) {
  // Normalize sentence
  const normalizedOriginal = original.replace(/\s+/g, ' ').trim();

  return queryOne(
    'SELECT * FROM sentence_translations WHERE record_id = ? AND original_sentence = ?',
    [recordId, normalizedOriginal]
  );
}

function getTranslationsByRecord(recordId) {
  return queryAll(
    'SELECT * FROM sentence_translations WHERE record_id = ? ORDER BY sentence_index ASC',
    [recordId]
  );
}

function getTranslationsByRecordGrouped(recordId) {
  const translations = queryAll(
    'SELECT * FROM sentence_translations WHERE record_id = ? ORDER BY paragraph_index ASC, sentence_index ASC',
    [recordId]
  );

  // Group by paragraph_index
  const grouped = {};
  for (const t of translations) {
    const pIndex = t.paragraph_index || 0;
    if (!grouped[pIndex]) {
      grouped[pIndex] = [];
    }
    grouped[pIndex].push(t);
  }

  // Convert to array and sort by paragraph index
  return Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b)
    .map(pIndex => grouped[pIndex]);
}

/**
 * ==================== Word Definition Operations ====================
 */

function getWordDefinition(word) {
  const normalized = word.toLowerCase().trim();
  return queryOne('SELECT * FROM word_definitions WHERE word = ?', [normalized]);
}

function createWordDefinition(word, definitionJson, source) {
  const normalized = word.toLowerCase().trim();
  const existing = getWordDefinition(normalized);
  if (existing) {
    execute(
      'UPDATE word_definitions SET definition_json = ?, source = ?, updated_at = datetime("now", "localtime") WHERE word = ?',
      [JSON.stringify(definitionJson), source, normalized]
    );
    return getWordDefinition(normalized);
  }
  execute(
    'INSERT INTO word_definitions (word, definition_json, source) VALUES (?, ?, ?)',
    [normalized, JSON.stringify(definitionJson), source]
  );
  return getWordDefinition(normalized);
}

/**
 * ==================== Utility Functions ====================
 */

/**
 * Rebuild full text from sentences
 * @param {string} recordId - Record ID
 * @returns {string} Reconstructed text
 */
function rebuildTextFromSentences(recordId) {
  const sentences = getSentencesByRecord(recordId);
  
  // Group by paragraph_index
  const grouped = {};
  for (const s of sentences) {
    const pIndex = s.paragraph_index || 0;
    if (!grouped[pIndex]) {
      grouped[pIndex] = [];
    }
    grouped[pIndex].push(s);
  }

  // Sort by paragraph_index and sentence_index
  const sortedParagraphs = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b)
    .map(pIndex => 
      grouped[pIndex]
        .sort((a, b) => a.sentence_index - b.sentence_index)
        .map(s => s.text)
        .join(' ')
    );

  return sortedParagraphs.join('\n');
}

function close() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (db) {
    saveToDisk();
    db.close();
    db = null;
    console.log('Database connection closed');
  }
}

module.exports = {
  initialize,
  createSession,
  getAllSessions,
  getSession,
  updateSessionTitle,
  updateSessionTimestamp,
  deleteSession,
  createRecord,
  getRecord,
  getRecordWithAnalyses,
  getRecordsBySession,
  updateRecordName,
  deleteRecord,
  createAnalysis,
  getAnalysisBySentence,
  getAnalysesByRecord,
  getAnalysesByRecordGrouped,
  deleteAnalysis,
  updateLLMConfig,
  getLatestLLMConfig,
  createTranslation,
  getTranslationBySentence,
  getTranslationsByRecord,
  getTranslationsByRecordGrouped,
  getWordDefinition,
  createWordDefinition,
  createSentence,
  getSentencesByRecord,
  getSentenceById,
  deleteSentence,
  deleteSentencesByRecord,
  updateSentenceText,
  rebuildTextFromSentences,
  close,
  getDB,
  queryAll,
  queryOne,
  execute,
};
