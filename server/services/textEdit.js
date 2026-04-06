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

const { splitSentences } = require("./sentenceSplit");
const { queryOne, execute, getAnalysesByRecord, getTranslationsByRecord } = require("../models/database");

class TextEditService {
  constructor(database) {
    this.db = database;
  }

  /**
   * 检测文本变化并返回详细信息
   * @param {string} recordId - 记录ID
   *.param {string} oldText - 原始文本
   * @param {string} newText - 编辑后的文本
   * @returns {Promise<Object>} 变更检测结果
   */
  async detectTextChanges(recordId, oldText, newText) {
    try {
      console.log(`检测文本变化: 记录 ${recordId}`);

      // 使用句子分割服务比较
      const oldSentences = splitSentences(oldText);
      const newSentences = splitSentences(newText);

      // 分析每个句子的变化
      const changes = [];

      // 处理删除的句子
      for (let i = 0; i < oldSentences.length; i++) {
        const { oldText: oldSentence, newText: newSentence, type } = this.compareSentences(
          oldSentences[i],
          newSentences[i]
        );
        changes.push({ sentenceIndex: i, oldText: oldSentence, newText: newSentence, type });
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
   * 清除被修改句子的分析和翻译
   * @param {string} recordId - 记录ID
   * @param {string[]} oldSentences - 旧句子列表（用于匹配）
   * @param {Object[]} changes - 变化列表
   * @returns {Promise<Object>} 清除结果
   */
  async clearModifiedTranslations(recordId, oldSentences, changes) {
    try {
      console.log(`清除修改句子的翻译: 记录 ${recordId}`);

      const results = {
        analysesCleared: 0,
        translationsCleared: 0,
        errors: []
      };

      // 获取所有句子分析
      const analyses = getAnalysesByRecord(recordId);

      // 清除被修改句子的分析
      for (const analysis of analyses) {
        try {
          // 检查这个句子是否在修改的变化中
          const sentenceIndex = oldSentences.indexOf(analysis.sentence);
          const change = changes.find(c => c.sentenceIndex === sentenceIndex);

          if (change && (change.type === 'modified' || change.type === 'deleted')) {
            // 删除分析
            execute(
              "DELETE FROM sentence_analyses WHERE id = ?",
              [analysis.id]
            );
            results.analysesCleared++;
            console.log(`已清除句子分析: ${analysis.sentence.substring(0, 30)}...`);
          }
        } catch (error) {
          console.error(`清除分析失败:`, error);
          results.errors.push({
            analysisId: analysis.id,
            error: error.message
          });
        }
      }

      // 获取所有翻译
      const translations = getTranslationsByRecord(recordId);

      // 清除被修改句子的翻译
      for (const translation of translations) {
        try {
          const change = changes.find(c => c.sentenceIndex === translation.sentence_index);

          if (change && (change.type === 'modified' || change.type === 'deleted')) {
            // 删除翻译
            execute(
              "DELETE FROM sentence_translations WHERE id = ?",
              [translation.id]
            );
            results.translationsCleared++;
            console.log(`已清除句子翻译，索引: ${translation.sentence_index}`);
          }
        } catch (error) {
          console.error(`清除翻译失败:`, error);
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
   * 设置记录的未保存更改状态
   * @param {string} recordId - 记录ID
   * @param {boolean} hasChanges - 是否有未保存更改
   * @returns {Promise<Object>} 设置结果
   */
  async setUnsavedChanges(recordId, hasChanges) {
    try {
      execute(
        "UPDATE records SET has_unsaved_changes = ? WHERE id = ?",
        [hasChanges ? 1 : 0, recordId]
      );

      console.log(`记录 ${recordId} 的未保存更改状态设置为: ${hasChanges}`);
      return { success: true, recordId, hasChanges };
    } catch (error) {
      console.error("设置未保存更改状态失败:", error);
      throw error;
    }
  }

  /**
   * 检查记录是否有未保存更改
   * @param {string} recordId - 记录ID
   * @returns {Promise<boolean>} 是否有未保存更改
   */
  async hasUnsavedChanges(recordId) {
    try {
      const result = queryOne(
        "SELECT has_unsaved_changes FROM records WHERE id = ?",
        [recordId]
      );

      return result && result.has_unsaved_changes === 1;
    } catch (error) {
      console.error("检查未保存更改失败:", error);
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

        // 清除未保存更改状态
        await this.setUnsavedChanges(recordId, false);

        return {
          success: true,
          message: "文本已保存（无实质变化）",
          changes,
          summary
        };
      }

      // 获取旧句子列表用于匹配
      const oldSentences = splitSentences(oldText);

      // 清除被修改句子的翻译和分析
      const clearResults = await this.clearModifiedTranslations(recordId, oldSentences, changes);

      // 更新记录文本
      execute(
        "UPDATE records SET ocr_text = ? WHERE id = ?",
        [newText, recordId]
      );

      // 清除未保存更改状态
      await this.setUnsavedChanges(recordId, false);

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
