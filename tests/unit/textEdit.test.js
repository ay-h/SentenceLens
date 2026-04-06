/**
 * 单元测试：句子变更检测逻辑
 */

const { splitSentences } = require('../../server/services/sentenceSplit');
const TextEditService = require('../../server/services/textEdit');

describe('TextEditService - 句子变更检测', () => {
  let mockDb;
  let textEditService;

  beforeEach(() => {
    // Mock database
    mockDb = {
      getRecord: jest.fn(),
      getAnalysesByRecord: jest.fn(),
      getTranslations: jest.fn(),
      getTranslationsByRecord: jest.fn(),
      queryOne: jest.fn(),
      queryAll: jest.fn()
    };

    textEditService = new TextEditService(mockDb);
  });

  describe('splitSentences - 句子分割', () => {
    test('应该正确分割简单句子', () => {
      const text = 'Hello world. How are you?';
      const sentences = splitSentences(text);
      expect(sentences).toEqual(['Hello world.', 'How are you?']);
    });

    test('应该处理包含缩写的句子', () => {
      const text = 'Dr. Smith lives on Washington Ave.';
      const sentences = splitSentences(text);
      expect(sentences).toEqual(['Dr. Smith lives on Washington Ave.']);
    });

    test('应该处理标点符号后的引号', () => {
      const text = 'She said, "Hello world!"';
      const sentences = splitSentences(text);
      expect(sentences).toEqual(['She said, "Hello world!"']);
    });

    test('应该处理空输入', () => {
      const sentences = splitSentences('');
      expect(sentences).toEqual([]);
    });
  });

  describe('detectTextChanges - 变化检测', () => {
    test('应该检测句子修改', async () => {
      const oldText = 'Hello world. How are you?';
      const newText = 'Hello everyone. How are you?';

      const result = await textEditService.detectTextChanges(1, oldText, newText);

      expect(result.summary.hasChanges).toBe(true);
      expect(result.summary.modifiedCount).toBe(1);
      expect(result.summary.unchangedCount).toBe(1);

      const modifiedChange = result.changes.find(c => c.type === 'modified');
      expect(modifiedChange).toBeDefined();
      expect(modifiedChange.oldText).toBe('Hello world.');
      expect(modifiedChange.newText).toBe('Hello everyone.');
    });

    test('应该检测句子删除', async () => {
      const oldText = 'Hello world. How are you? Goodbye.';
      const newText = 'Hello world.';

      const result = await textEditService.detectTextChanges(1, oldText, newText);

      expect(result.summary.hasChanges).toBe(true);
      expect(result.summary.deletedCount).toBe(1);
      expect(result.summary.unchangedCount).toBe(1);
    });

    test('应该检测句子新增', async () => {
      const oldText = 'Hello world.';
      const newText = 'Hello world. How are you?';

      const result = await textEditService.detectTextChanges(1, oldText, newText);

      expect(result.summary.hasChanges).toBe(true);
      expect(result.summary.addedCount).toBe(1);
      expect(result.summary.unchangedCount).toBe(1);
    });

    test('应该检测无变化', async () => {
      const oldText = 'Hello world.';
      const newText = 'Hello world.';

      const result = await textEditService.detectTextChanges(1, oldText, newText);

      expect(result.summary.hasChanges).toBe(false);
      expect(result.summary.modifiedCount).toBe(0);
      expect(result.summary.unchangedCount).toBe(1);
    });

    test('应该只检测标点变化', async () => {
      const oldText = 'Hello world';
      const newText = 'Hello world.';

      const result = await textEditService.detectTextChanges(1, oldText, newText);

      expect(result.summary.hasChanges).toBe(true);
      expect(result.summary.modifiedCount).toBe(1);
    });
  });

  describe('compareSentences - 句子比较', () => {
    test('应该检测修改', () => {
      const result = textEditService.compareSentences('Hello world', 'Hello everyone', 0);
      expect(result.type).toBe('modified');
      expect(result.oldText).toBe('Hello world');
      expect(result.newText).toBe('Hello everyone');
    });

    test('应该检测删除', () => {
      const result = textEditService.compareSentences('Hello world', '', 0);
      expect(result.type).toBe('deleted');
      expect(result.oldText).toBe('Hello world');
      expect(result.newText).toBeNull();
    });

    test('应该检测无变化', () => {
      const result = textEditService.compareSentences('Hello world', 'Hello world', 0);
      expect(result.type).toBe('unchanged');
      expect(result.oldText).toBe('Hello world');
      expect(result.newText).toBe('Hello world');
    });

    test('应该处理空字符串', () => {
      const result = textEditService.compareSentences('', '', 0);
      expect(result.type).toBe('unchanged');
      expect(result.oldText).toBe('');
      expect(result.newText).toBe('');
    });
  });
});

/**
 * 单元测试：翻译清除逻辑
 */

describe('TextEditService - 翻译清除逻辑', () => {
  let mockDb;
  let textEditService;

  beforeEach(() => {
    mockDb = {
      getRecord: jest.fn(),
      getAnalysesByRecord: jest.fn(),
      getTranslationsByRecord: jest.fn(),
      queryOne: jest.fn(),
      queryAll: jest.fn()
    };

    textEditService = new TextEditService(mockDb);
  });

  describe('clearModifiedTranslations - 清除被修改句子的翻译和分析', () => {
    test('应该清除被修改了第一句子的分析', async () => {
      const recordId = 1;
      const oldSentences = ['Hello world.', 'How are you?'];
      const changes = [
        { sentenceIndex: 0, oldText: 'Hello world.', newText: 'Hi there!', type: 'modified' },
        { sentenceIndex: 1, oldText: 'How are you?', newText: 'How are you?', type: 'unchanged' }
      ];

      mockDb.getAnalysesByRecord.mockReturnValue([
        { id: 1, record_id: 1, sentence: 'Hello world.', analysis: '{}' }
      ]);

      mockDb.queryOne.mockReturnValue({ changes: 1 });

      const result = await textEditService.clearModifiedTranslations(recordId, oldSentences, changes);

      expect(result.analysesCleared).toBe(1);
      expect(mockDb.queryOne).toHaveBeenCalledWith(
        "DELETE FROM sentence_analyses WHERE id = ?",
        [1]
      );
    });

    test('应该清除被修改了第二句子的翻译', async () => {
      const recordId = 1;
      const oldSentences = ['Hello world.', 'How are you?'];
      const changes = [
        { sentenceIndex: 0, oldText: 'Hello world.', newText: 'Hello world.', type: 'unchanged' },
        { sentenceIndex: 1, oldText: 'How are you?', newText: 'Fine, thanks!', type: 'modified' }
      ];

      mockDb.getAnalysesByRecord.mockReturnValue([]);
      mockDb.getTranslationsByRecord.mockReturnValue([
        { id: 1, record_id: 1, sentence_index: 1, original_sentence: 'How are you?', translated_sentence: 'I am fine.' }
      ]);

      mockDb.queryOne.mockReturnValue({ changes: 1 });

      const result = await textEditService.clearModifiedTranslations(recordId, oldSentences, changes);

      expect(result.translationsCleared).toBe(1);
      expect(mockDb.queryOne).toHaveBeenCalledWith(
        "DELETE FROM sentence_translations WHERE id = ?",
        [1]
      );
    });

    test('应该不清除未变化句子的数据', async () => {
      const recordId = 1;
      const oldSentences = ['Hello world.', 'How are you?'];
      const changes = [
        { sentenceIndex: 0, oldText: 'Hello world.', newText: 'Hello world.', type: 'unchanged' },
        { sentenceIndex: 1, oldText: 'How are you?', newText: 'How are you?', type: 'unchanged' }
      ];

      mockDb.getAnalysesByRecord.mockReturnValue([
        { id: 1, record_id: 1, sentence: 'Hello world.', analysis: '{}' }
      ]);

      mockDb.getTranslationsByRecord.mockReturnValue([]);
      mockDb.queryOne.mockReturnValue({ changes: 1 });

      const result = await textEditService.clearModifiedTranslations(recordId, oldSentences, changes);

      expect(result.analysesCleared).toBe(0);
      expect(result.translationsCleared).toBe(0);
      expect(mockDb.queryOne).not.toHaveBeenCalled();
    });
  });

  describe('hasUnsavedChanges - 检查未保存更改', () => {
    test('应该返回 true 当有未保存更改', async () => {
      mockDb.queryOne.mockReturnValue({ has_unsaved_changes: 1 });

      const result = await textEditService.hasUnsavedChanges(1);

      expect(result).toBe(true);
    });

    test('应该返回 false 当没有未保存更改', async () => {
      mockDb.queryOne.mockReturnValue({ has_unsaved_changes: 0 });

      const result = await textEditService.hasUnsavedChanges(1);

      expect(result).toBe(false);
    });
  });

  describe('setUnsavedChanges - 设置未保存更改状态', () => {
    test('应该设置未保存更改状态为 true', async () => {
      mockDb.queryOne.mockReturnValue({ changes: 1 });

      const result = await textEditService.setUnsavedChanges(1, true);

      expect(result.success).toBe(true);
      expect(result.hasChanges).toBe(true);
      expect(mockDb.queryOne).toHaveBeenCalledWith(
        "UPDATE records SET has_unsaved_changes = ? WHERE id = ?",
        [1, 1]
      );
    });

    test('应该设置未保存更改状态为 false', async () => {
      mockDb.queryOne.mockReturnValue({ changes: 1 });

      const result = await textEditService.setUnsavedChanges(1, false);

      expect(result.success).toBe(true);
      expect(result.hasChanges).toBe(false);
      expect(mockDb.queryOne).toHaveBeenCalledWith(
        "UPDATE records SET has_unsaved_changes = ? WHERE id = ?",
        [0, 1]
      );
    });
  });
});
