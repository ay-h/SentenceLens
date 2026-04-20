/**
 * Text Editing Service
 *
 * 功能：
 * - 检测句子级别的文本变化
 * - 管理文本相关的翻译和分析清除逻辑
 * - 处理记录未保存更改状态
 *
 * 当前架构：
 * - records 表包含 ocr_text 字段
 * - sentence_analyses 表存储句子分析
 * - sentence_translations 表存储翻译
 */

const { splitParagraphs } = require("./sentenceSplit");
const { queryOne, execute, getAnalysesByRecord, getTranslationsByRecord, createSentence, getSentencesByRecord, deleteSentence, deleteSentencesByRecord, updateSentenceText } = require("../models/database");

class TextEditService {
  constructor(database) {
    this.db = database;
  }

  /**
   * 检测文本变化并返回详细信息
   * @param {string} recordId - 记录ID
   * @param {string} oldText - 原始文本
   * @param {string} newText - 编辑后的文本
   * @returns {Promise<Object>} 变更检测结果
   */
  async detectTextChanges(recordId, oldText, newText) {
    try {
      console.log(`检测文本变化: 记录 ${recordId}`);

      // 使用段落分割服务比较（现在返回带有UUID的句子对象，从数据库读取）
      const oldParagraphs = splitParagraphs(oldText, recordId, this.db);
      const newParagraphs = splitParagraphs(newText, recordId, this.db);

      // 分析每个段落的变化
      const changes = [];
      let globalSentenceIndex = 0;

      // 将旧句子扁平化并记录位置信息和UUID
      const oldSentencesWithMeta = [];
      oldParagraphs.forEach((paragraph, pIndex) => {
        paragraph.forEach((sentence, sIndex) => {
          oldSentencesWithMeta.push({
            id: sentence.id,
            text: sentence.text,
            paragraphIndex: pIndex,
            localIndex: sIndex,
            globalIndex: globalSentenceIndex++
          });
        });
      });

      // 将新句子扁平化
      const newSentencesWithMeta = [];
      globalSentenceIndex = 0;
      newParagraphs.forEach((paragraph, pIndex) => {
        paragraph.forEach((sentence, sIndex) => {
          newSentencesWithMeta.push({
            id: sentence.id,
            text: sentence.text,
            paragraphIndex: pIndex,
            localIndex: sIndex,
            globalIndex: globalSentenceIndex++
          });
        });
      });

      // 使用 LCS 算法进行句子匹配，基于文本内容
      const lcsResult = this.computeLCS(oldSentencesWithMeta, newSentencesWithMeta);
      const matchedNewIndices = new Set(lcsResult.matchedNewIndices);

      // 处理 LCS 匹配的句子（基于文本内容匹配）
      for (const match of lcsResult.matches) {
        changes.push({
          oldId: match.old.id,
          oldText: match.old.text,
          newId: match.new.id,
          newText: match.new.text,
          type: 'unchanged',
          oldParagraphIndex: match.old.paragraphIndex,
          newParagraphIndex: match.new.paragraphIndex
        });
      }

      // 处理未匹配的旧句子（删除）
      for (const oldSentence of oldSentencesWithMeta) {
        if (!lcsResult.matchedOldIndices.has(oldSentence.globalIndex)) {
          changes.push({
            oldId: oldSentence.id,
            oldText: oldSentence.text,
            newText: null,
            type: 'deleted',
            oldParagraphIndex: oldSentence.paragraphIndex
          });
        }
      }

      // 处理未匹配的新句子（新增）
      for (let i = 0; i < newSentencesWithMeta.length; i++) {
        if (!matchedNewIndices.has(i)) {
          changes.push({
            oldId: null,
            oldText: null,
            newId: newSentencesWithMeta[i].id,
            newText: newSentencesWithMeta[i].text,
            type: 'added',
            newParagraphIndex: newSentencesWithMeta[i].paragraphIndex
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
      console.log(`段落结构变化: 旧段落数 ${oldParagraphs.length}, 新段落数 ${newParagraphs.length}`);
      return { changes, summary };
    } catch (error) {
      console.error("检测文本变化失败:", error);
      throw error;
    }
  }

  /**
   * Create a simple hash for a sentence based on content and position
   */
  sentenceHash(text, paragraphIndex, sentenceIndex) {
    return `${text}|${paragraphIndex}|${sentenceIndex}`;
  }

  /**
   * Compute Longest Common Subsequence (LCS) for sentence matching
   * This helps distinguish between actual modifications vs position shifts
   */
  computeLCS(oldSentences, newSentences) {
    const m = oldSentences.length;
    const n = newSentences.length;

    // Create DP table
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Fill DP table
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldSentences[i - 1].text === newSentences[j - 1].text) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to find matches
    const matches = [];
    const matchedOldIndices = new Set();
    const matchedNewIndices = new Set();

    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (oldSentences[i - 1].text === newSentences[j - 1].text) {
        matches.unshift({
          old: oldSentences[i - 1],
          new: newSentences[j - 1]
        });
        matchedOldIndices.add(oldSentences[i - 1].globalIndex);
        matchedNewIndices.add(newSentences[j - 1].globalIndex);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return { matches, matchedOldIndices, matchedNewIndices };
  }

  /**
   * 比较两个句子
   */
  compareSentences(oldSentence, newSentence) {
    const oldText = oldSentence.trim();
    const newText = newSentence ? newSentence.trim() : '';

    if (!oldText && !newText) {
      return { oldText: '', newText: '', type: 'unchanged' };
    }

    if (!newText && oldText.length > 0) {
      return { oldText, newText: null, type: 'deleted' };
    }

    if (newText !== oldText) {
      return { oldText, newText, type: 'modified' };
    }

    return { oldText, newText, type: 'unchanged' };
  }

  /**
   * 清除所有句子的分析和翻译
   * @param {string} recordId - 记录ID
   * @returns {Promise<Object>} 清除结果
   */
  async clearAllTranslationsAndAnalyses(recordId) {
    try {
      console.log(`清除所有翻译和分析: 记录 ${recordId}`);

      const results = {
        analysesCleared: 0,
        translationsCleared: 0,
        errors: []
      };

      // 清除所有句子分析
      execute(
        "DELETE FROM sentence_analyses WHERE record_id = ?",
        [recordId]
      );
      results.analysesCleared = 1; // We don't get exact count, just indicate success

      // 清除所有翻译
      execute(
        "DELETE FROM sentence_translations WHERE record_id = ?",
        [recordId]
      );
      results.translationsCleared = 1; // We don't get exact count, just indicate success

      console.log(`已清除所有翻译和分析`);
      return results;
    } catch (error) {
      console.error("清除所有翻译和分析失败:", error);
      throw error;
    }
  }

  /**
   * 清除被修改句子的分析和翻译
   * @param {string} recordId - 记录ID
   * @param {Object[]} changes - 变化列表
   * @returns {Promise<Object>} 清除结果
   */
  async clearModifiedTranslations(recordId, changes) {
    try {
      console.log(`清除修改句子的翻译: 记录 ${recordId}`);

      const results = {
        analysesCleared: 0,
        translationsCleared: 0,
        paragraphIndexUpdated: 0,
        errors: []
      };

      // 获取需要删除的句子ID集合（删除的句子）
      const sentenceIdsToDelete = new Set();
      for (const change of changes) {
        if (change.type === 'deleted' && change.oldId) {
          sentenceIdsToDelete.add(change.oldId);
        }
      }

      // 获取需要更新段落索引的句子（未改变但移动了段落的句子）
      const paragraphIndexUpdates = new Map();
      for (const change of changes) {
        if (change.type === 'unchanged' && change.oldParagraphIndex !== change.newParagraphIndex) {
          paragraphIndexUpdates.set(change.oldId, change.newParagraphIndex);
        }
      }

      // 获取所有句子分析
      const analyses = getAnalysesByRecord(recordId);

      // 清除被删除句子的分析（基于sentence_id）
      for (const sentenceId of sentenceIdsToDelete) {
        try {
          execute(
            "DELETE FROM sentence_analyses WHERE record_id = ? AND sentence_id = ?",
            [recordId, sentenceId]
          );
          results.analysesCleared++;
          console.log(`已清除句子分析: sentence_id=${sentenceId}`);
        } catch (error) {
          console.error(`清除分析失败:`, error);
          results.errors.push({
            sentenceId: sentenceId,
            error: error.message
          });
        }
      }

      // 清除被删除句子的翻译（基于sentence_id）
      for (const sentenceId of sentenceIdsToDelete) {
        try {
          execute(
            "DELETE FROM sentence_translations WHERE record_id = ? AND sentence_id = ?",
            [recordId, sentenceId]
          );
          results.translationsCleared++;
          console.log(`已清除句子翻译: sentence_id=${sentenceId}`);
        } catch (error) {
          console.error(`清除翻译失败:`, error);
          results.errors.push({
            sentenceId: sentenceId,
            error: error.message
          });
        }
      }

      // 获取所有翻译
      const translations = getTranslationsByRecord(recordId);

      // 更新段落索引
      for (const translation of translations) {
        try {
          if (paragraphIndexUpdates.has(translation.sentence_id)) {
            const newParagraphIndex = paragraphIndexUpdates.get(translation.sentence_id);
            execute(
              "UPDATE sentence_translations SET paragraph_index = ? WHERE id = ?",
              [newParagraphIndex, translation.id]
            );
            results.paragraphIndexUpdated++;
            console.log(`已更新翻译段落索引: ${translation.original_sentence.substring(0, 30)}... -> ${newParagraphIndex}`);
          }
        } catch (error) {
          console.error(`更新翻译段落索引失败:`, error);
          results.errors.push({
            translationId: translation.id,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error("清除翻译失败:", error);
      throw error;
    }
  }

  /**
   * Sync sentences to database
   * @param {string} recordId - Record ID
   * @param {Array} paragraphs - Paragraphs with sentence objects containing UUIDs
   * @returns {Promise<Object>} Sync result
   */
  async syncSentencesToDatabase(recordId, paragraphs) {
    try {
      console.log(`Syncing sentences to database: 记录 ${recordId}`);

      // Delete all existing sentences for this record
      deleteSentencesByRecord(recordId);

      // Insert new sentences with their UUIDs
      let sentenceIndex = 0;
      for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
        const paragraph = paragraphs[pIndex];
        for (const sentence of paragraph) {
          createSentence(
            recordId,
            sentence.text,
            pIndex,
            sentenceIndex++,
            sentence.id
          );
        }
      }

      console.log(`Synced ${sentenceIndex} sentences to database`);
      return { success: true, count: sentenceIndex };
    } catch (error) {
      console.error("Syncing sentences to database failed:", error);
      throw error;
    }
  }

  /**
   * 处理文本编辑保存
   * @param {string} recordId - 记录ID
   * @param {string} newText - 编辑后的文本
   * @returns {Promise<Object>} 保存结果
   */
  async handleTextEdit(recordId, newText) {
    try {
      console.log(`处理文本编辑: 记录 ${recordId}`);

      // 获取原始文本
      const record = this.db.getRecord(recordId);

      if (!record) {
        throw new Error(`记录 ${recordId} 不存在`);
      }

      const oldText = record.ocr_text;

      // 检测文本变化
      const { changes, summary } = await this.detectTextChanges(recordId, oldText, newText);

      if (!summary.hasChanges) {
        console.log("文本无实质变化");
        // 更新记录文本（可能只是标点/空格变化）
        execute(
          "UPDATE records SET ocr_text = ? WHERE id = ?",
          [newText, recordId]
        );

        return {
          success: true,
          message: "文本已保存（无实质变化）",
          changes,
          summary
        };
      }

      // 选择性清除：只清除被删除、新增、修改的句子的翻译和分析
      // 删除后重新插入的句子会被识别为新增，没有翻译，需要重新翻译
      const clearResults = await this.clearModifiedTranslations(recordId, changes);

      // 更新记录文本
      execute(
        "UPDATE records SET ocr_text = ? WHERE id = ?",
        [newText, recordId]
      );

      // 同步句子到数据库（使用持久化的UUID）
      const newParagraphs = splitParagraphs(newText, recordId, this.db);
      await this.syncSentencesToDatabase(recordId, newParagraphs);

      return {
        success: true,
        message: `文本已保存，${summary.modifiedCount}个句子已修改`,
        changes,
        summary,
        clearResults
      };
    } catch (error) {
      console.error("处理文本编辑失败:", error);
      throw error;
    }
  }
}

module.exports = TextEditService;
