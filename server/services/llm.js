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
      timeout: 60000,
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
 * Batch translate sentences using LLM with structured JSON output.
 * Matches Python src/services/enhanced_translator.py _batch_translate_with_llm
 */
async function batchTranslate(sentences, baseUrl, apiKey, model) {
  try {
    const sentencesText = sentences
      .map((s, i) => `${i + 1}. ${s}`)
      .join('\n');

    const prompt = `请将以下英文句子批量翻译成中文，保持原文的语调和风格。

英文句子:
${sentencesText}

请严格按照以下JSON格式返回翻译结果：
{
    "translations": [
        {
            "index": 1,
            "original": "原始英文句子1",
            "translated": "中文翻译1",
            "success": true
        },
        {
            "index": 2,
            "original": "原始英文句子2",
            "translated": "中文翻译2",
            "success": true
        }
    ]
}

注意：
1. 保持原文的语调和风格
2. 确保翻译准确、流畅、自然
3. 按照句子索引顺序翻译
4. 只返回JSON格式，不要添加其他说明`;

    const systemPrompt = 'You are an expert English-Chinese translator. Translate English text to Chinese and return results in JSON format.';

    console.log(`Batch translation prompt length: ${prompt.length} characters`);

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
      return sentences.map(() => ({ error: 'LLM返回空内容', success: false }));
    }

    const translationResult = JSON.parse(cleanedContent);

    if (!translationResult.translations) {
      return sentences.map(() => ({ error: '翻译结果格式错误', success: false }));
    }

    // Index results by their index number
    const translationsByIndex = {};
    for (const t of translationResult.translations) {
      translationsByIndex[t.index] = t;
    }

    // Map back to original sentence order
    const results = [];
    for (let i = 0; i < sentences.length; i++) {
      const translation = translationsByIndex[i + 1] || {};
      if (translation.success && translation.translated) {
        results.push({
          translated_sentence: translation.translated,
          success: true,
        });
      } else {
        results.push({
          error: translation.error || '翻译失败',
          success: false,
        });
      }
    }

    return results;

  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`Batch translation JSON parsing failed: ${error.message}`);
    } else {
      console.error(`Batch translation failed: ${error.message}`);
    }
    return sentences.map(() => ({
      error: `翻译失败: ${error.message}`,
      success: false,
    }));
  }
}

/**
 * Translate sentences with caching support.
 * Matches Python src/services/enhanced_translator.py translate_sentences_batch
 */
async function translateSentencesBatch(sentences, recordId, baseUrl, apiKey, model, db) {
  console.log(`Translating ${sentences.length} sentences for record_id: ${recordId}`);

  const results = [];
  const sentencesToTranslate = [];
  const indicesToTranslate = [];

  // First, check for existing translations
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const existing = db.getTranslationBySentence(recordId, sentence);

    if (existing) {
      console.log(`Using cached translation for sentence ${i + 1}: ${sentence.substring(0, 30)}...`);
      results.push({
        original_sentence: sentence,
        translated_sentence: existing.translated_sentence,
        sentence_index: i,
        from_cache: true,
      });
    } else {
      console.log(`Need to translate sentence ${i + 1}: ${sentence.substring(0, 30)}...`);
      sentencesToTranslate.push(sentence);
      indicesToTranslate.push(i);
    }
  }

  // Batch translate new sentences
  if (sentencesToTranslate.length > 0) {
    console.log(`Translating ${sentencesToTranslate.length} new sentences...`);
    const batchResults = await batchTranslate(sentencesToTranslate, baseUrl, apiKey, model);

    for (let i = 0; i < sentencesToTranslate.length; i++) {
      const sentence = sentencesToTranslate[i];
      const translation = batchResults[i];
      const originalIndex = indicesToTranslate[i];

      if (translation.success) {
        // Save to database
        db.createTranslation(recordId, sentence, translation.translated_sentence, originalIndex);

        results.push({
          original_sentence: sentence,
          translated_sentence: translation.translated_sentence,
          sentence_index: originalIndex,
          from_cache: false,
        });
      } else {
        console.log(`Translation failed for sentence: ${sentence.substring(0, 30)}...`);
        results.push({
          original_sentence: sentence,
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
  console.log(`Translation complete. ${cachedCount} from cache, ${newCount} newly translated.`);

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
  translateSentencesBatch,
  loadAnalysisPrompt,
  lookupWord,
};
