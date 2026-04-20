/**
 * Sentence Splitting Utility
 * 功能：
 * - 句子分割（原始功能）
 * - 检测句子级别的文本变化（新增功能）
 *
 * Uses abbreviation whitelist to handle edge cases.
 * Port of Python src/services/sentence_split.py
 */

const database = require("../models/database");

// Common abbreviations that shouldn't end a sentence
const ABBREVIATION_WHITELIST = new Set([
  // Titles
  'Mr', 'Mrs', 'Dr', 'Prof', 'Rev', 'Gen', 'Sen', 'Rep', 'Gov',
  'Capt', 'Lt', 'Col', 'Sgt', 'Adm', 'Cmdr', 'Jr', 'Sr',
  // Academic
  'PhD', 'MD', 'DO', 'JD', 'EdD', 'MA', 'MS', 'BS', 'BA',
  // Organizations
  'Corp', 'Inc', 'Ltd', 'Co', 'LLC', 'PLC', 'Est',
  // Time/Date
  'AM', 'PM', 'a.m.', 'p.m.', 'BC', 'AD', 'BCE', 'CE',
  // Misc
  'vs', 'etc', 'ie', 'eg', 'i.e.', 'e.g.', 'et', 'al',
  'St', 'Ave', 'Rd', 'Blvd', 'Mt', 'Ft', 'No', 'App',
  // US States
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]);

const CLOSING_PUNCTUATION = new Set(['"', "'", ')', ']', '\u201d', '\u2019']);

/**
 * Check if dot at pos sits between single-letter initials.
 */
function _isInitialDot(text, pos) {
  const n = text.length;
  if (pos < 1 || !isUpperCase(text[pos - 1])) return false;
  if (pos >= 2 && isAlpha(text[pos - 2])) return false;
  if (pos + 1 < n && isUpperCase(text[pos + 1])) {
    if (pos + 2 >= n || !isAlpha(text[pos + 2])) return true;
  }
  return false;
}

/**
 * Return true if word ending just before punctPos should not cause a sentence break.
 */
function _isAbbreviation(text, punctPos) {
  let j = punctPos - 1;
  const segments = [];

  while (j >= 0) {
    if (isAlpha(text[j])) {
      const segEnd = j;
      while (j >= 0 && isAlpha(text[j])) j--;
      segments.push(text.substring(j + 1, segEnd + 1));
    } else if (text[j] === '.' && segments.length > 0) {
      j--;
    } else {
      break;
    }
  }

  if (segments.length === 0) return false;

  // All-single-letter chains are initials: J.K., U.S.A.
  if (segments.length > 1 && segments.every(s => s.length === 1)) return true;

  // Dotted abbreviation: e.g., i.e.
  if (segments.length > 1) {
    const dotted = segments.join('.') + '.';
    if (ABBREVIATION_WHITELIST.has(dotted)) return true;
  }

  // Plain word: Dr, etc, Mr ...
  if (segments.length > 1) {
    const lastWord = segments[segments.length - 1].replace(/['-]+$/, '');
    return ABBREVIATION_WHITELIST.has(lastWord);
  }

  return false;
}

function isAlpha(ch) {
  return /[a-zA-Z]/.test(ch);
}

function isUpperCase(ch) {
  return /[A-Z]/.test(ch);
}

function isLowerCase(ch) {
  return /[a-z]/.test(ch);
}

function isDigit(ch) {
  return /[0-9]/.test(ch);
}

/**
 * Split text into paragraphs and sentences.
 * Returns an array of paragraphs, where each paragraph is an array of sentence objects with UUID.
 * If recordId and db are provided, uses persisted UUIDs from database.
 */
function splitParagraphs(text, recordId = null, db = null) {
  if (!text || !text.trim()) return [];

  // Split by line breaks to get paragraphs
  const rawParagraphs = text.split(/\n+/);
  const paragraphs = [];

  // Get existing sentences from database if provided
  let existingSentencesMap = new Map();
  if (recordId && db) {
    try {
      const existingSentences = db.getSentencesByRecord(recordId);
      existingSentences.forEach(s => {
        const normalizedText = s.text.replace(/\s+/g, ' ').trim();
        existingSentencesMap.set(normalizedText, s.id);
      });
    } catch (error) {
      console.error('Error fetching existing sentences:', error);
    }
  }

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (trimmed) {
      // Split each paragraph into sentences
      const sentences = splitSentences(trimmed);
      if (sentences.length > 0) {
        // Add UUID to each sentence - reuse existing if available
        const sentencesWithIds = sentences.map(sentence => {
          const normalizedText = sentence.replace(/\s+/g, ' ').trim();
          const existingId = existingSentencesMap.get(normalizedText);
          return {
            id: existingId || generateUUID(),
            text: sentence
          };
        });
        paragraphs.push(sentencesWithIds);
      }
    }
  }

  return paragraphs;
}

/**
 * Generate a simple UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Split text into sentences using abbreviation whitelist.
 */
function splitSentences(text) {
  if (!text || !text.trim()) return [];

  // Preprocess: insert space after period if followed by uppercase letter and not already a space
  // This handles OCR text like "days ago.No matter" -> "days ago. No matter"
  let processedText = text;
  processedText = processedText.replace(/\.([A-Z])/g, '. $1');

  const sentences = [];
  let currentSentence = '';
  let i = 0;
  const n = processedText.length;

  while (i < n) {
    const char = processedText[i];

    if (char !== '.' && char !== '!' && char !== '?') {
      currentSentence += char;
      i++;
      continue;
    }

    // --- Potential sentence-ending punctuation ---

    // Decimal / numeric dot: 1.5, 3.14, $9.99
    if (
      char === '.' &&
      i > 0 && isDigit(processedText[i - 1]) &&
      i + 1 < n && isDigit(processedText[i + 1])
    ) {
      currentSentence += char;
      i++;
      continue;
    }

    // Numbered list item: 3. Draft First (digit + dot + space)
    if (
      char === '.' &&
      i > 0 && isDigit(processedText[i - 1]) &&
      (i + 1 >= n || processedText[i + 1] === ' ')
    ) {
      currentSentence += char;
      i++;
      continue;
    }

    // Mid-chain initial dot: J.(K), U.(S)
    if (char === '.' && _isInitialDot(processedText, i)) {
      currentSentence += char;
      i++;
      continue;
    }

    // Remember where punctuation started
    const punctStart = i;

    // Consume this mark and any consecutive punctuation (... / ?! / !!)
    currentSentence += char;
    i++;
    while (i < n && (processedText[i] === '.' || processedText[i] === '!' || processedText[i] === '?')) {
      currentSentence += processedText[i];
      i++;
    }

    // Consume closing quotes / brackets
    while (i < n && CLOSING_PUNCTUATION.has(processedText[i])) {
      currentSentence += processedText[i];
      i++;
    }

    // --- Decide whether this is a real sentence boundary ---

    let isSentenceEnd = true;

    // Next meaningful character is lowercase → not a new sentence
    if (i + 1 < n && isLowerCase(processedText[i + 1])) {
      isSentenceEnd = false;
    }

    // Dot followed by uppercase letter without space → likely sentence boundary (e.g., "ago.No", "later.You")
    if (isSentenceEnd && i + 1 < n && isUpperCase(processedText[i + 1])) {
      // Check if there's no space after the dot
      if (i + 1 < n && processedText[i + 1] !== ' ') {
        // But still check for abbreviations first
        if (_isAbbreviation(processedText, punctStart)) {
          isSentenceEnd = false;
        }
      }
    }

    // Abbreviation / initials check
    if (isSentenceEnd && _isAbbreviation(processedText, punctStart)) {
      isSentenceEnd = false;
    }

    if (isSentenceEnd) {
      const sentence = currentSentence.trim();
      if (sentence) sentences.push(sentence);
      currentSentence = '';
      i = i; // skip past trailing whitespace
    }
  }

  // Flush the last sentence
  if (currentSentence.trim()) {
    sentences.push(currentSentence.trim());
  }

  return sentences;
}

/**
 * Clean a sentence by removing extra whitespace and artifacts.
 */
function cleanSentence(sentence) {
  // Remove extra whitespace
  sentence = sentence.replace(/\s+/g, ' ');
  // Remove leading/trailing whitespace
  sentence = sentence.trim();
  // Remove common OCR artifacts
  sentence = sentence.replace(/[|]/g, 'I'); // Pipe often mistaken for I
  sentence = sentence.replace(/[\[\]]/g, ''); // Remove brackets
  return sentence;
}

/**
 * NEW: 检测句子级别的文本变化并返回详细信息
 * @param {string} recordId - 记录ID
 * @param {string} oldText - 原始文本
 * @param {string} newText - 编辑后的文本
 * @returns {Promise<Object>} 变更检测结果
 */
async function detectChanges(recordId, oldText, newText) {
  try {
    console.log(`检测文本变化: 记录 ${recordId}`);

    // 使用句子分割服务比较
    const oldSentences = splitSentences(oldText);
    const newSentences = splitSentences(newText);

    // 分析每个句子的变化
    const changes = [];

    // 处理删除的句子
    for (let i = 0; i < oldSentences.length; i++) {
      const oldSentence = oldSentences[i].trim();
      const newSentence = newSentences[i] ? newSentences[i].trim() : null;

      if (newSentence === null && oldSentence.length > 0) {
        // 句子被删除
        changes.push({
          sentenceIndex: i,
          oldText: oldSentence,
          newText: null,
          type: 'deleted'
        });
      } else if (newSentence !== null && newSentence !== oldSentence) {
        // 句子被修改
        changes.push({
          sentenceIndex: i,
          oldText: oldSentence,
          newText: newSentence,
          type: 'modified'
        });
      } else if (newSentence !== null && newSentence === oldSentence) {
        // 句子未变化
        changes.push({
          sentenceIndex: i,
          oldText: oldSentence,
          newText: newSentence,
          type: 'unchanged'
        });
      }
    }

    // 处理新增的句子
    for (let i = oldSentences.length; i < newSentences.length; i++) {
      const newSentence = newSentences[i].trim();
      if (newSentence.length > 0) {
        changes.push({
          sentenceIndex: i,
          oldText: null,
          newText: newSentence,
          type: 'added'
        });
      }
    }

    // 统计变化
    const summary = {
      hasChanges: changes.some(c => c.type !== 'unchanged'),
      modifiedCount: changes.filter(c => c.type === 'modified').length,
      deletedCount: changes.filter(c => c.type === 'deleted').length,
      addedCount: changes.filter(c => c.type === 'added').length,
      unchangedCount: changes.filter(c => c.type === 'unchanged').length
    };

    console.log(`文本变化检测完成: ${JSON.stringify(summary)}`);
    return { changes, summary };
  } catch (error) {
    console.error("检测文本变化失败:", error);
    throw error;
  }
}

module.exports = {
  splitSentences,
  splitParagraphs,
  cleanSentence,
  detectChanges  // NEW: 导出新的变化检测功能
};
