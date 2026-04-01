/**
 * Dictionary Service
 * Provides word lookup with offline ECDICT dictionary + LLM fallback.
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let dictDb = null;
let dictLoaded = false;

/**
 * Get the path to the ECDICT database file.
 * Checks multiple locations: user data dir, extraResources, project data dir.
 */
function getDictPath() {
  const candidates = [];

  // 1. User data directory (copied on first run)
  const dataDir = process.env.APP_DATA_DIR || path.join(__dirname, '../../data');
  candidates.push(path.join(dataDir, 'dictionary', 'ecdict.db'));

  // 2. Electron extraResources (packaged app)
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'dictionary', 'ecdict.db'));
  }

  // 3. Project root data dir (dev mode)
  candidates.push(path.join(__dirname, '../../data/dictionary/ecdict.db'));

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Initialize the ECDICT dictionary database (lazy, read-only).
 */
async function initDictionary() {
  if (dictLoaded) return !!dictDb;

  dictLoaded = true;
  const dictPath = getDictPath();
  if (!dictPath) {
    console.log('ECDICT 词库文件未找到，将仅使用 LLM 查词');
    return false;
  }

  try {
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(dictPath);
    dictDb = new SQL.Database(fileBuffer);
    console.log(`ECDICT 词库已加载: ${dictPath}`);
    return true;
  } catch (error) {
    console.error('加载 ECDICT 词库失败:', error.message);
    dictDb = null;
    return false;
  }
}

/**
 * Normalize a word for lookup: lowercase, trim, strip surrounding punctuation.
 */
function normalizeWord(word) {
  return word
    .toLowerCase()
    .trim()
    .replace(/^[^\p{L}\d]+/u, '')
    .replace(/[^\p{L}\d]+$/u, '');
}

/**
 * Look up a word in the local ECDICT database.
 * Returns structured definition or null if not found.
 */
function lookupFromDictionary(word) {
  if (!dictDb) return null;

  const normalized = normalizeWord(word);
  if (!normalized) return null;

  try {
    const stmt = dictDb.prepare('SELECT * FROM stardict WHERE word = ? COLLATE NOCASE LIMIT 1');
    stmt.bind([normalized]);

    let row = null;
    if (stmt.step()) {
      row = stmt.getAsObject();
    }
    stmt.free();

    if (!row || !row.translation) return null;

    return formatEcdictResult(row);
  } catch (error) {
    console.error('词库查询出错:', error.message);
    return null;
  }
}

/**
 * Format an ECDICT row into the standard WordDefinition structure.
 */
function formatEcdictResult(row) {
  const word = row.word || '';
  const phonetic = row.phonetic || '';
  const translation = row.translation || '';
  const pos = row.pos || '';
  const exchange = row.exchange || '';

  // Parse translation lines: each line is typically "词性. 释义"
  const lines = translation.split('\n').filter(l => l.trim());
  const partsOfSpeech = [];

  for (const line of lines) {
    const match = line.match(/^([a-z]+\.)\s*(.+)/i);
    if (match) {
      partsOfSpeech.push({
        pos: match[1].replace('.', ''),
        meaning: match[2].trim(),
      });
    } else {
      partsOfSpeech.push({
        pos: '',
        meaning: line.trim(),
      });
    }
  }

  return {
    word,
    phonetic: phonetic ? `/${phonetic}/` : '',
    partsOfSpeech,
    source: 'dictionary',
  };
}

/**
 * Close the dictionary database.
 */
function closeDictionary() {
  if (dictDb) {
    dictDb.close();
    dictDb = null;
    dictLoaded = false;
    console.log('ECDICT 词库连接已关闭');
  }
}

module.exports = {
  initDictionary,
  normalizeWord,
  lookupFromDictionary,
  closeDictionary,
};
