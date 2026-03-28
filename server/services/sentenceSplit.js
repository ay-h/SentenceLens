/**
 * Sentence Splitting Utility
 * Uses abbreviation whitelist to handle edge cases.
 * Port of Python src/services/sentence_split.py
 */

// Common abbreviations that shouldn't end a sentence
const ABBREVIATION_WHITELIST = new Set([
  // Titles
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Rev', 'Gen', 'Sen', 'Rep', 'Gov',
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
 * Check if the dot at pos sits between single-letter initials.
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
 * Return true if the word ending just before punctPos should not cause a sentence break.
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
  segments.reverse();

  // All-single-letter chains are initials: J.K., U.S.A.
  if (segments.length > 1 && segments.every(s => s.length === 1)) return true;

  // Dotted abbreviation: e.g., i.e.
  if (segments.length > 1) {
    const dotted = segments.join('.') + '.';
    if (ABBREVIATION_WHITELIST.has(dotted)) return true;
    const joined = segments.join('');
    if (ABBREVIATION_WHITELIST.has(joined)) return true;
  }

  // Plain word: Dr, etc, Mr ...
  const lastWord = segments[segments.length - 1].replace(/['-]+$/, '');
  return ABBREVIATION_WHITELIST.has(lastWord);
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
 * Split text into sentences using abbreviation whitelist.
 */
function splitSentences(text) {
  if (!text || !text.trim()) return [];

  const sentences = [];
  let currentSentence = '';
  let i = 0;
  const n = text.length;

  while (i < n) {
    const char = text[i];

    if (char !== '.' && char !== '!' && char !== '?') {
      currentSentence += char;
      i++;
      continue;
    }

    // --- Potential sentence-ending punctuation ---

    // Decimal / numeric dot: 1.5, 3.14, $9.99
    if (
      char === '.' &&
      i > 0 && isDigit(text[i - 1]) &&
      i + 1 < n && isDigit(text[i + 1])
    ) {
      currentSentence += char;
      i++;
      continue;
    }

    // Mid-chain initial dot: J.(K), U.(S)
    if (char === '.' && _isInitialDot(text, i)) {
      currentSentence += char;
      i++;
      continue;
    }

    // Remember where the punctuation started
    const punctStart = i;

    // Consume this mark and any consecutive punctuation (... / ?! / !!)
    currentSentence += char;
    i++;
    while (i < n && (text[i] === '.' || text[i] === '!' || text[i] === '?')) {
      currentSentence += text[i];
      i++;
    }

    // Consume closing quotes / brackets
    while (i < n && CLOSING_PUNCTUATION.has(text[i])) {
      currentSentence += text[i];
      i++;
    }

    // --- Decide whether this is a real sentence boundary ---
    let lookahead = i;
    while (lookahead < n && /\s/.test(text[lookahead])) {
      lookahead++;
    }

    let isSentenceEnd = true;

    // Next meaningful character is lowercase → not a new sentence
    if (lookahead < n && isLowerCase(text[lookahead])) {
      isSentenceEnd = false;
    }

    // Abbreviation / initials check
    if (isSentenceEnd && _isAbbreviation(text, punctStart)) {
      isSentenceEnd = false;
    }

    if (isSentenceEnd) {
      const sentence = currentSentence.trim();
      if (sentence) sentences.push(sentence);
      currentSentence = '';
      i = lookahead; // skip past trailing whitespace
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

module.exports = {
  splitSentences,
  cleanSentence,
};
