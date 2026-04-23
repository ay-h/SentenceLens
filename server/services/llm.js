/**
 * LLM Service
 * Handles OpenAI-compatible API calls for sentence analysis and translation.
 * Port of Python src/services/parser.py and src/services/enhanced_translator.py
 */

const fs = require('fs');
const path = require('path');

/**
 * Load analysis prompt template from external file
 */
function loadAnalysisPrompt() {
  try {
    const promptFile = path.join(__dirname, 'prompt_template.txt');
    return fs.readFileSync(promptFile, 'utf-8').trim();
  } catch (error) {
    console.error('Error loading prompt template:', error);
    // Fallback to basic prompt
    return `分析这个英语句子的语法结构，用中文解释。

句子: {sentence}

请严格按照以下JSON格式返回分析结果：
{
    "sentence_overview": {"translation": "中文翻译", "sentence_pattern": "句型"},
    "main_clause": {
        "text": "主句核心主干",
        "subject": {"text": "主语核心词", "explanation": "中文解释"},
        "predicate": {"text": "谓语动词", "tense": "时态", "explanation": "中文解释"},
        "object": {"text": "宾语核心词", "explanation": "中文解释"},
        "predicative": {"text": "表语", "explanation": "中文解释"},
        "indirect_object": {"text": "间接宾语", "explanation": "中文解释"},
        "object_complement": {"text": "宾语补足语", "explanation": "中文解释"}
    },
    "subordinate_clauses": [],
    "modifiers": [],
    "structure_explanation": {"summary": "结构总结", "key_points": []}
}`;
  }
}

/**
 * Make a direct HTTP request to LLM API (matching Python's requests.post approach)
 */
async function callLLMAPI(baseUrl, apiKey, model, messages, options = {}) {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const payload = {
    model,
    messages,
    temperature: options.temperature || 0.3,
    max_tokens: options.maxTokens || 2500,
    stream: false,
  };

  if (options.jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  console.log(`Making LLM API request to: ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(options.timeout || 30000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  if (!result.choices || result.choices.length === 0) {
    throw new Error('No choices returned from LLM API');
  }

  return result.choices[0].message.content;
}

/**
 * Analyze sentence structure using LLM.
 * Matches Python src/services/parser.py analyzeSentence behavior.
 */
async function analyzeSentence(sentence, baseUrl, apiKey, model) {
  try {
    // Load prompt from external file
    const promptTemplate = loadAnalysisPrompt();
    const prompt = promptTemplate.replace('{sentence}', sentence);
    console.log(`Prompt length: ${prompt.length} characters`);

    const systemPrompt = 'You are an expert English grammar assistant. Analyze sentence structure and return results in JSON format.';

    console.log('Starting LLM API call...');
    const startTime = Date.now();

    const content = await callLLMAPI(baseUrl, apiKey, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ], {
      temperature: 0.1,
      maxTokens: 5000,
      jsonMode: true,
      timeout: 90000,
    });

    const apiTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`LLM API call completed in ${apiTime} seconds`);

    // Parse JSON response
    const cleanedContent = (content || '').trim();
    if (!cleanedContent) {
      return { error: 'LLM返回空内容', success: false };
    }

    console.log('Attempting to parse JSON...');
    const analysis = JSON.parse(cleanedContent);
    console.log('JSON parsing successful');

    // Add success flag
    analysis.success = true;
    return analysis;

  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`JSON parsing failed: ${error.message}`);
      return { error: `JSON解析失败: ${error.message}`, success: false };
    }
    console.error(`Analysis failed: ${error.message}`);
    return { error: `分析失败: ${error.message}`, success: false };
  }
}

/**
 * Translate a single batch of sentences using LLM with optimized JSON format.
 * @param {Array} sentenceObjects - Array of {uuid, text} objects
 * @param {string} baseUrl - LLM API base URL
 * @param {string} apiKey - LLM API key
 * @param {string} model - LLM model name
 * @returns {Object} - {translations: [{uuid, translated}]}
 */
async function translateBatch(sentenceObjects, baseUrl, apiKey, model) {
  const startTime = Date.now();
  try {
    const inputJson = JSON.stringify(sentenceObjects.map(s => ({
      uuid: s.uuid,
      text: s.text
    })));

    const prompt = `Translate to Chinese. Return JSON only.

Input:
${inputJson}

Output format:
{
  "translations": [
    {"uuid": "uuid", "translated": "中文翻译"}
  ]
}`;

    const systemPrompt = 'You are a professional translator. Translate English to Chinese accurately and naturally.';

    console.log(`Batch translation prompt length: ${prompt.length} characters, sentences: ${sentenceObjects.length}`);

    const content = await callLLMAPI(baseUrl, apiKey, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ], {
      temperature: 0.3,
      maxTokens: 3000,
      jsonMode: true,
      timeout: 60000,
    });

    const cleanedContent = (content || '').trim();
    if (!cleanedContent) {
      throw new Error('LLM返回空内容');
    }

    const translationResult = JSON.parse(cleanedContent);

    if (!translationResult.translations) {
      throw new Error('翻译结果格式错误');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✓ Batch completed in ${elapsed}s (${sentenceObjects.length} sentences, ${(elapsed/sentenceObjects.length).toFixed(2)}s/sentence)`);

    return translationResult;

  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`✗ Batch failed after ${elapsed}s: ${error.message}`);
    if (error instanceof SyntaxError) {
      console.error(`Batch translation JSON parsing failed: ${error.message}`);
    } else {
      console.error(`Batch translation failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Batch translate sentences using LLM with parallel batch processing.
 * Matches Python src/services/enhanced_translator.py _batch_translate_with_llm
 * @param {Array} sentenceObjects - Array of {uuid, text} objects
 * @param {string} baseUrl - LLM API base URL
 * @param {string} apiKey - LLM API key
 * @param {string} model - LLM model name
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Array} - Array of {uuid, translated_sentence, error}
 */
async function batchTranslate(sentenceObjects, baseUrl, apiKey, model, progressCallback = null) {
  const totalStartTime = Date.now();
  const BATCH_SIZE = 12;
  const CONCURRENCY = 4;

  if (sentenceObjects.length === 0) {
    return [];
  }

  // Split into batches
  const batches = [];
  for (let i = 0; i < sentenceObjects.length; i += BATCH_SIZE) {
    batches.push(sentenceObjects.slice(i, i + BATCH_SIZE));
  }

  console.log(`Split ${sentenceObjects.length} sentences into ${batches.length} batches (size: ${BATCH_SIZE}, concurrency: ${CONCURRENCY})`);

  const results = [];
  let completedBatches = 0;

  // Process batches in parallel with concurrency limit
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const concurrentBatches = batches.slice(i, i + CONCURRENCY);
    const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
      try {
        const batchResult = await translateBatch(batch, baseUrl, apiKey, model);
        completedBatches++;

        if (progressCallback) {
          progressCallback(completedBatches, batches.length);
        }

        return batchResult.translations || [];
      } catch (error) {
        completedBatches++;
        console.error(`Batch ${i + batchIndex} failed:`, error.message);

        if (progressCallback) {
          progressCallback(completedBatches, batches.length);
        }

        // Return error results for this batch
        return batch.map(s => ({
          uuid: s.uuid,
          translated: null,
          error: error.message
        }));
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.flat());
  }

  // Create a map for quick lookup by uuid
  const resultMap = new Map();
  for (const result of results) {
    if (result.uuid) {
      resultMap.set(result.uuid, result);
    }
  }

  // Map back to original order
  const finalResults = sentenceObjects.map(s => {
    const result = resultMap.get(s.uuid);
    if (result && result.translated && result.translated.trim() !== '') {
      return {
        translated_sentence: result.translated,
      };
    } else {
      return {
        error: result?.error || '翻译失败',
      };
    }
  });

  const totalElapsed = ((Date.now() - totalStartTime) / 1000).toFixed(2);
  console.log(`✓ All batches completed in ${totalElapsed}s (${sentenceObjects.length} sentences, ${(totalElapsed/sentenceObjects.length).toFixed(2)}s/sentence average)`);

  return finalResults;
}

/**
 * Batch translate with streaming callback for real-time results.
 * @param {Array} sentenceObjects - Array of {uuid, text} objects
 * @param {string} baseUrl - LLM API base URL
 * @param {string} apiKey - LLM API key
 * @param {string} model - LLM model name
 * @param {Function} streamCallback - Callback(batchIndex, totalBatches, batchTranslations)
 * @returns {Array} - Array of translation results
 */
async function batchTranslateStream(sentenceObjects, baseUrl, apiKey, model, streamCallback) {
  const totalStartTime = Date.now();
  const BATCH_SIZE = 12;
  const CONCURRENCY = 4;

  if (sentenceObjects.length === 0) {
    return [];
  }

  // Split into batches
  const batches = [];
  for (let i = 0; i < sentenceObjects.length; i += BATCH_SIZE) {
    batches.push(sentenceObjects.slice(i, i + BATCH_SIZE));
  }

  console.log(`Split ${sentenceObjects.length} sentences into ${batches.length} batches (size: ${BATCH_SIZE}, concurrency: ${CONCURRENCY})`);

  const results = [];
  let completedBatches = 0;

  // Process batches in parallel with concurrency limit
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const concurrentBatches = batches.slice(i, i + CONCURRENCY);
    const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
      try {
        const batchResult = await translateBatch(batch, baseUrl, apiKey, model);
        completedBatches++;

        // Stream batch results via callback
        if (streamCallback) {
          const batchTranslations = batchResult.translations || [];
          streamCallback(i + batchIndex, batches.length, batchTranslations);
        }

        return batchResult.translations || [];
      } catch (error) {
        completedBatches++;
        console.error(`Batch ${i + batchIndex} failed:`, error.message);

        // Stream error batch via callback
        if (streamCallback) {
          streamCallback(i + batchIndex, batches.length, []);
        }

        // Return error results for this batch
        return batch.map(s => ({
          uuid: s.uuid,
          translated: null,
          error: error.message
        }));
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.flat());
  }

  // Create a map for quick lookup by uuid
  const resultMap = new Map();
  for (const result of results) {
    if (result.uuid) {
      resultMap.set(result.uuid, result);
    }
  }

  // Map back to original order
  const finalResults = sentenceObjects.map(s => {
    const result = resultMap.get(s.uuid);
    if (result && result.translated && result.translated.trim() !== '') {
      return {
        translated_sentence: result.translated,
      };
    } else {
      return {
        error: result?.error || '翻译失败',
      };
    }
  });

  const totalElapsed = ((Date.now() - totalStartTime) / 1000).toFixed(2);
  console.log(`✓ All batches completed in ${totalElapsed}s (${sentenceObjects.length} sentences, ${(totalElapsed/sentenceObjects.length).toFixed(2)}s/sentence average)`);

  return finalResults;
}

/**
 * Translate sentences with caching support.
 * Matches Python src/services/enhanced_translator.py translate_sentences_batch
 */
async function translateSentencesBatch(sentences, recordId, baseUrl, apiKey, model, db, progressCallback = null) {
  const totalStartTime = Date.now();
  console.log(`Translating ${sentences.length} sentences for record_id: ${recordId}`);

  const results = [];
  const sentencesToTranslate = [];
  const indicesToTranslate = [];
  const sentenceObjects = []; // Store full sentence objects with UUIDs

  // First, check for existing translations
  for (let i = 0; i < sentences.length; i++) {
    const sentenceObj = sentences[i];
    const sentenceText = sentenceObj.text || sentenceObj; // Support both object and string
    const sentenceId = sentenceObj.id;

    const existing = db.getTranslationBySentence(recordId, sentenceText);

    if (existing) {
      results.push({
        original_sentence: sentenceText,
        translated_sentence: existing.translated_sentence,
        sentence_index: i,
        from_cache: true,
      });
    } else {
      sentencesToTranslate.push(sentenceText);
      indicesToTranslate.push(i);
      sentenceObjects.push(sentenceObj);
    }
  }

  // Batch translate new sentences
  if (sentencesToTranslate.length > 0) {
    console.log(`Translating ${sentencesToTranslate.length} new sentences...`);

    // Convert to new format: {uuid, text}
    const sentenceObjectsForBatch = sentenceObjects.map((obj, idx) => ({
      uuid: obj.id || `temp-${idx}`,
      text: sentencesToTranslate[idx]
    }));

    const batchResults = await batchTranslate(sentenceObjectsForBatch, baseUrl, apiKey, model, progressCallback);

    for (let i = 0; i < sentencesToTranslate.length; i++) {
      const sentenceText = sentencesToTranslate[i];
      const translation = batchResults[i];
      const originalIndex = indicesToTranslate[i];
      const sentenceObj = sentenceObjects[i];
      const sentenceId = sentenceObj.id || null;
      const paragraphIndex = sentenceObj.paragraph_index || 0;

      if (translation.translated_sentence && translation.translated_sentence.trim() !== '') {
        // Return translation result, caller will handle storage
        results.push({
          original_sentence: sentenceText,
          translated_sentence: translation.translated_sentence,
          sentence_index: originalIndex,
          from_cache: false,
        });
      } else {
        results.push({
          original_sentence: sentenceText,
          translated_sentence: `[翻译失败: ${translation.error || '未知错误'}]`,
          sentence_index: originalIndex,
          from_cache: false,
          error: translation.error || '未知错误',
        });
      }
    }
  }

  // Sort results by sentence_index
  results.sort((a, b) => a.sentence_index - b.sentence_index);

  const cachedCount = results.filter(r => r.from_cache).length;
  const newCount = results.filter(r => !r.from_cache).length;
  const totalElapsed = ((Date.now() - totalStartTime) / 1000).toFixed(2);
  console.log(`Translation complete. ${cachedCount} from cache, ${newCount} newly translated. Total time: ${totalElapsed}s`);

  return results;
}

/**
 * Translate sentences with caching support and SSE streaming.
 * Streams batch results as they complete via callback.
 * @param {Array} sentences - Array of sentence objects
 * @param {number} recordId - Record ID
 * @param {string} baseUrl - LLM API base URL
 * @param {string} apiKey - LLM API key
 * @param {string} model - LLM model name
 * @param {Object} db - Database instance
 * @param {Function} progressCallback - Callback with (completed, total, batchTranslations)
 * @returns {Array} - Array of translation results
 */
async function translateSentencesBatchStream(sentences, recordId, baseUrl, apiKey, model, db, progressCallback = null) {
  const totalStartTime = Date.now();
  console.log(`Translating ${sentences.length} sentences for record_id: ${recordId}`);

  const results = [];
  const sentencesToTranslate = [];
  const indicesToTranslate = [];
  const sentenceObjects = []; // Store full sentence objects with UUIDs

  // First, check for existing translations
  for (let i = 0; i < sentences.length; i++) {
    const sentenceObj = sentences[i];
    const sentenceText = sentenceObj.text || sentenceObj; // Support both object and string
    const sentenceId = sentenceObj.id;

    const existing = db.getTranslationBySentence(recordId, sentenceText);

    if (existing) {
      results.push({
        original_sentence: sentenceText,
        translated_sentence: existing.translated_sentence,
        sentence_index: i,
        from_cache: true,
      });
    } else {
      sentencesToTranslate.push(sentenceText);
      indicesToTranslate.push(i);
      sentenceObjects.push(sentenceObj);
    }
  }

  // Batch translate new sentences with streaming
  if (sentencesToTranslate.length > 0) {
    console.log(`Translating ${sentencesToTranslate.length} new sentences...`);

    // Convert to new format: {uuid, text}
    const sentenceObjectsForBatch = sentenceObjects.map((obj, idx) => ({
      uuid: obj.id || `temp-${idx}`,
      text: sentencesToTranslate[idx]
    }));

    // Use streaming batch translate
    const batchResults = await batchTranslateStream(
      sentenceObjectsForBatch,
      baseUrl,
      apiKey,
      model,
      (batchIndex, totalBatches, batchTranslations) => {
        // Convert batch translations to full result format
        const batchResultsFormatted = batchTranslations.map((translation, idx) => {
          const arrayIndex = batchIndex * 12 + idx; // Assuming BATCH_SIZE=12
          const originalIndex = indicesToTranslate[arrayIndex];
          const sentenceObj = sentenceObjects[arrayIndex];
          const sentenceId = sentenceObj?.id || null;

          // translation format from batchTranslate: {uuid, translated}
          // Check if translation has valid translated field
          if (translation.translated && translation.translated.trim() !== '') {
            return {
              sentence_id: sentenceId,
              sentence_text: sentencesToTranslate[arrayIndex],
              translation: translation.translated,
              translation_time_ms: 100
            };
          } else {
            return {
              sentence_id: sentenceId,
              sentence_text: sentencesToTranslate[arrayIndex],
              translation: `[翻译失败: ${translation.error || '未知错误'}]`,
              translation_time_ms: 0,
              error: translation.error || '未知错误'
            };
          }
        });

        // Call progress callback with batch results
        if (progressCallback) {
          progressCallback(batchIndex + 1, totalBatches, batchResultsFormatted);
        }
      }
    );

    for (let i = 0; i < sentencesToTranslate.length; i++) {
      const sentenceText = sentencesToTranslate[i];
      const translation = batchResults[i];
      const originalIndex = indicesToTranslate[i];
      const sentenceObj = sentenceObjects[i];
      const sentenceId = sentenceObj.id || null;
      const paragraphIndex = sentenceObj.paragraph_index || 0;

      if (translation.translated_sentence && translation.translated_sentence.trim() !== '') {
        // Return translation result, caller will handle storage
        results.push({
          original_sentence: sentenceText,
          translated_sentence: translation.translated_sentence,
          sentence_index: originalIndex,
          from_cache: false,
        });
      } else {
        results.push({
          original_sentence: sentenceText,
          translated_sentence: `[翻译失败: ${translation.error || '未知错误'}]`,
          sentence_index: originalIndex,
          from_cache: false,
          error: translation.error || '未知错误',
        });
      }
    }
  }

  // Sort results by sentence_index
  results.sort((a, b) => a.sentence_index - b.sentence_index);

  const cachedCount = results.filter(r => r.from_cache).length;
  const newCount = results.filter(r => !r.from_cache).length;
  const totalElapsed = ((Date.now() - totalStartTime) / 1000).toFixed(2);
  console.log(`Translation complete. ${cachedCount} from cache, ${newCount} newly translated. Total time: ${totalElapsed}s`);

  return results;
}

/**
 * Look up a word definition using LLM.
 * Returns structured word definition or throws on failure.
 */
async function lookupWord(word, baseUrl, apiKey, model) {
  try {
    const systemPrompt = '你是一个专业的英汉词典助手。请为给定的英语单词提供准确的中文释义，按词性分类。返回 JSON 格式。';

    const userPrompt = `请为英语单词 "${word}" 提供中文释义。

请严格按照以下 JSON 格式返回：
{
  "word": "${word}",
  "phonetic": "音标（如 /wɜːrd/）",
  "partsOfSpeech": [
    {
      "pos": "词性缩写（如 n, v, adj, adv, prep, conj）",
      "meaning": "中文释义"
    }
  ]
}

要求：
1. 音标使用国际音标
2. 列出该单词所有常见词性及对应中文释义
3. 释义简洁准确
4. 只返回 JSON，不要多余文字`;

    console.log(`LLM 查词: ${word}`);
    const content = await callLLMAPI(baseUrl, apiKey, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { jsonMode: true, timeout: 15000, maxTokens: 500 });

    const result = JSON.parse(content);
    return {
      word: result.word || word,
      phonetic: result.phonetic || '',
      partsOfSpeech: result.partsOfSpeech || [],
      source: 'llm',
    };
  } catch (error) {
    console.error(`LLM 查词失败 (${word}):`, error.message);
    throw error;
  }
}

module.exports = {
  analyzeSentence,
  batchTranslate,
  batchTranslateStream,
  translateSentencesBatch,
  translateSentencesBatchStream,
  loadAnalysisPrompt,
  lookupWord,
};
