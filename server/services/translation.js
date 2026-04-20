/**
 * Translation Service
 * Handles unified translation logic with automatic change detection
 */

class TranslationService {
  constructor(db, llmService) {
    this.db = db;
    this.llmService = llmService;
  }

  /**
   * Get sentences from record
   * @param {Object} record - Record object
   * @returns {Array} - Array of sentence objects with paragraph info and UUID
   */
  getSentencesFromRecord(record) {
    if (!record) {
      return [];
    }

    // Get sentences from database
    const sentences = this.db.getSentencesByRecord(record.id);
    if (!sentences || sentences.length === 0) {
      return [];
    }

    // Group by paragraph_index and sort
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
        grouped[pIndex].sort((a, b) => a.sentence_index - b.sentence_index)
      );

    // Flatten and add display index
    const result = [];
    let globalIndex = 0;
    for (const paragraph of sortedParagraphs) {
      for (const s of paragraph) {
        result.push({
          id: s.id,
          text: s.text,
          translation: null,
          is_modified: s.is_modified || 0,
          paragraph_index: s.paragraph_index || 0,
          index: globalIndex++
        });
      }
    }

    return result;
  }

  /**
   * Get existing translations for a record
   * @param {number} recordId - Record ID
   * @returns {Array} - Array of translation objects
   */
  getExistingTranslations(recordId) {
    try {
      const translations = this.db.queryAll(
        'SELECT * FROM sentence_translations WHERE record_id = ? ORDER BY sentence_index',
        [recordId]
      );
      return translations;
    } catch (error) {
      console.error('Failed to get existing translations:', error);
      return [];
    }
  }

  /**
   * Detect which sentences need translation
   * @param {Array} sentences - All sentences for the record
   * @param {Array} existingTranslations - Existing translations
   * @param {boolean} forceAll - Whether to translate all untranslated sentences
   * @returns {Object} - { sentencesToTranslate, skippedCount, hasChanges }
   */
  detectSentencesToTranslate(sentences, existingTranslations, forceAll = false) {
    if (!sentences || sentences.length === 0) {
      return {
        sentencesToTranslate: [],
        skippedCount: 0,
        hasChanges: false
      };
    }

    let sentencesToTranslate = [];
    let skippedCount = 0;

    // Create a map of existing translations by sentence_id (UUID)
    const translationById = new Map();
    existingTranslations.forEach(t => {
      if (t.sentence_id) {
        translationById.set(t.sentence_id, t);
      }
    });

    if (forceAll) {
      // Translate all untranslated sentences
      sentencesToTranslate = sentences.filter(s => !translationById.has(s.id));
      skippedCount = sentences.length - sentencesToTranslate.length;
    } else {
      // Check if sentence has translation by sentence_id
      sentencesToTranslate = sentences.filter(s => !translationById.has(s.id));
      skippedCount = sentences.length - sentencesToTranslate.length;
    }

    const hasChanges = sentencesToTranslate.length > 0;

    return {
      sentencesToTranslate,
      skippedCount,
      hasChanges
    };
  }

  /**
   * Generate response for no changes scenario
   * @param {Array} sentences - All sentences
   * @returns {Object} - Response object for no changes
   */
  generateNoChangesResponse(sentences) {
    return {
      success: true,
      data: {
        translated_count: 0,
        skipped_count: sentences.length,
        no_changes_detected: true,
        translations: []
      }
    };
  }

  /**
   * Translate sentences and update database
   * @param {Array} sentencesToTranslate - Sentences to translate
   * @param {number} recordId - Record ID
   * @param {Object} config - LLM configuration
   * @param {number} skippedCount - Number of skipped sentences
   * @returns {Object} - Translation result
   */
  async translateAndUpdateSentences(sentencesToTranslate, recordId, config, skippedCount) {
    try {
      // Pass sentence objects (with UUIDs) instead of just text
      const translationResults = await this.llmService.translateSentencesBatch(
        sentencesToTranslate, recordId, config.url, config.api_key, config.model, this.db
      );

      // Update database with new translations
      let successfulTranslations = [];
      for (let i = 0; i < sentencesToTranslate.length; i++) {
        const sentence = sentencesToTranslate[i];
        const result = translationResults[i];

        if (result && !result.error) {
          // Create translation record with sentence_id (UUID) if available
          const translation = this.db.createTranslation(
            recordId,
            sentence.text,
            result.translated_sentence,
            sentence.index || 0, // Use display index
            sentence.paragraph_index || 0, // Add paragraph index
            sentence.id || null // Use UUID if available, otherwise null
          );

          successfulTranslations.push({
            sentence_id: sentence.id,
            sentence_text: sentence.text,
            translation: result.translated_sentence,
            paragraph_index: sentence.paragraph_index || 0,
            translation_time_ms: result.translation_time_ms || 100
          });
        } else {
          console.log(`句子翻译失败: ${sentence.text}`);
        }
      }

      const failedCount = sentencesToTranslate.length - successfulTranslations.length;
      if (failedCount > 0) {
        console.log(`⚠️  ${failedCount} 个句子翻译失败`);
      }

      return {
        success: true,
        data: {
          translated_count: successfulTranslations.length,
          skipped_count: skippedCount,
          no_changes_detected: false,
          translations: successfulTranslations
        },
        message: `已翻译${successfulTranslations.length}个句子，跳过${skippedCount}个未修改的句子`
      };

    } catch (error) {
      console.error('翻译过程中发生错误:', error);
      return {
        success: false,
        error: error.message || '翻译过程中发生错误'
      };
    }
  }

  /**
   * Perform unified translation with automatic change detection
   * @param {number} recordId - Record ID
   * @param {boolean} forceAll - Whether to force translate all untranslated sentences
   * @returns {Object} - Translation result
   */
  async performUnifiedTranslation(recordId, forceAll = false) {
    try {
      // Get record
      const record = this.db.getRecord(recordId);
      if (!record) {
        return {
          success: false,
          error: '记录不存在'
        };
      }

      // Get sentences from record text
      const sentences = this.getSentencesFromRecord(record);
      if (!sentences || sentences.length === 0) {
        return {
          success: false,
          error: '没有找到可翻译的句子'
        };
      }

      // Get existing translations
      const existingTranslations = this.getExistingTranslations(recordId);

      // Detect which sentences need translation
      const { sentencesToTranslate, skippedCount, hasChanges } = 
        this.detectSentencesToTranslate(sentences, existingTranslations, forceAll);

      // Check if no changes detected
      if (!hasChanges && !forceAll) {
        return this.generateNoChangesResponse(sentences);
      }

      // Get LLM config
      const config = this.db.getLatestLLMConfig();
      if (!config) {
        return {
          success: false,
          error: '未配置LLM，请先在设置页面配置LLM'
        };
      }

      // Translate and update sentences
      return await this.translateAndUpdateSentences(
        sentencesToTranslate, recordId, config, skippedCount
      );

    } catch (error) {
      console.error('统一翻译错误:', error);
      return {
        success: false,
        error: error.message || '翻译过程中发生错误'
      };
    }
  }
}

module.exports = TranslationService;
