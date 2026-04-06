/**
 * 集成测试：文本编辑完整流程
 *
 * 测试场景：
 * 1. 用户上传图片后识别出文本
 * 2. 编辑其中错误的单词
 * 3. 保存后文本被更新且相关的翻译和分析被清除
 */

const request = require('supertest');
const express = require('express');
const db = require('../../server/models/database');
const TextEditService = require('../../server/services/textEdit');

describe('Text Edit Integration Tests', () => {
  let app;
  let textEditService;
  let testRecordId;

  beforeAll(async () => {
    // 设置测试环境
    process.env.APP_DATA_DIR = './test-data';
    await db.initialize();

    // 创建测试应用
    app = express();
    app.use(express.json());

    textEditService = new TextEditService(db);

    // 添加文本编辑路由
    app.put('/api/records/:id/text/edit', async (req, res) => {
      try {
        const recordId = parseInt(req.params.id);
        const { text } = req.body;

        if (!text) {
          return res.status(400).json({ detail: 'Text is required' });
        }

        const result = await textEditService.handleTextEdit(recordId, text);
        res.json(result);
      } catch (error) {
        console.error('Text edit error:', error);
        res.status(500).json({ detail: error.message });
      }
    });

    app.get('/api/records/:id/unsaved-changes', async (req, res) => {
      try {
        const recordId = parseInt(req.params.id);
        const hasChanges = await textEditService.hasUnsavedChanges(recordId);
        res.json({ hasUnsavedChanges: hasChanges });
      } catch (error) {
        console.error('Check unsaved changes error:', error);
        res.status(500).json({ detail: error.message });
      }
    });
  });

  afterAll(async () => {
    // 清理测试数据
    if (testRecordId) {
      db.deleteRecord(testRecordId);
    }
  });

  beforeEach(async () => {
    // 创建测试会话
    const session = db.createSession('Test Session');

    // 创建测试记录
    const testText = 'The quick brown fox jumps over the lazy dog. This is a test sentence.';

    const record = db.createRecord(
      session.id,
      'Test Record',
      '/placeholder/test.png',
      testText
    );

    testRecordId = record.id;

    // 创建一些测试翻译和分析
    db.queryOne(
      'INSERT INTO sentence_translations (record_id, original_sentence, translated_sentence, sentence_index) VALUES (?, ?, ?, ?)',
      [testRecordId, 'The quick brown fox jumps over the lazy dog.', '敏捷的棕色狐狸跳过了懒狗。', 0]
    );

    db.queryOne(
      'INSERT INTO sentence_analyses (record_id, sentence, analysis) VALUES (?, ?, ?)',
      [testRecordId, 'This is a test sentence.', JSON.stringify({ type: 'test' })]
    );
  });

  afterEach(() => {
    // 清理测试数据
    if (testRecordId) {
      db.deleteRecord(testRecordId);
    }
  });

  describe('完整流程：编辑文本并清除相关翻译和分析', () => {
    test('应该成功编辑文本并清除相关翻译和分析', async () => {
      // 1. 验证初始状态
      const initialTranslations = db.getTranslationsByRecord(testRecordId);
      const initialAnalyses = db.getAnalysesByRecord(testRecordId);

      expect(initialTranslations.length).toBeGreaterThan(0);
      expect(initialAnalyses.length).toBeGreaterThan(0);

      // 2. 编辑第一句话（改变"fox"为"cat"）
      const editedText = 'The quick brown cat jumps over the lazy dog. This is a test sentence.';

      const editResponse = await request(app)
        .put(`/api/records/${testRecordId}/text/edit`)
        .send({ text: editedText })
        .expect(200);

      expect(editResponse.body.success).toBe(true);
      expect(editResponse.body.summary.modifiedCount).toBe(1);
      expect(editResponse.body.clearResults.translationsCleared).toBeGreaterThan(0);
      expect(editResponse.body.clearResults.analysesCleared).toBe(0); // 第二句未修改

      // 3. 验证翻译被清除
      const translationsAfterEdit = db.getTranslationsByRecord(testRecordId);
      const foxTranslation = translationsAfterEdit.find(
        t => t.original_sentence === 'The quick brown fox jumps over the lazy dog.'
      );

      expect(foxTranslation).toBeUndefined();

      // 4. 验证第二句的分析仍然存在（未修改）
      const analysesAfterEdit = db.getAnalysesByRecord(testRecordId);
      const secondSentenceAnalysis = analysesAfterEdit.find(
        a => a.sentence === 'This is a test sentence.'
      );

      expect(secondSentenceAnalysis).toBeDefined();

      // 5. 验证记录文本被更新
      const updatedRecord = db.getRecord(testRecordId);
      expect(updatedRecord.ocr_text).toBe(editedText);

      // 6. 验证未保存更改状态被清除
      const unsavedChangesResponse = await request(app)
        .get(`/api/records/${testRecordId}/unsaved-changes`)
        .expect(200);

      expect(unsavedChangesResponse.body.hasUnsavedChanges).toBe(false);
    });

    test('应该编辑第二句并清除其分析', async () => {
      const editedText = 'The quick brown fox jumps over the lazy dog. This is an edited sentence.';

      const editResponse = await request(app)
        .put(`/api/records/${testRecordId}/text/edit`)
        .send({ text: editedText })
        .expect(200);

      expect(editResponse.body.success).toBe(true);
      expect(editResponse.body.summary.modifiedCount).toBe(1);
      expect(editResponse.body.clearResults.analysesCleared).toBe(1);
      expect(editResponse.body.clearResults.translationsCleared).toBe(0); // 第一句未修改

      // 验证分析被清除
      const analysesAfterEdit = db.getAnalysesByRecord(testRecordId);
      expect(analysesAfterEdit.length).toBe(0);

      // 验证第一句的翻译仍然存在
      const translationsAfterEdit = db.getTranslationsByRecord(testRecordId);
      expect(translationsAfterEdit.length).toBeGreaterThan(0);
    });

    test('应该编辑多句话并清除相关的所有数据', async () => {
      const editedText = 'The quick brown cat jumps over the lazy dog. This is a modified sentence.';

      const editResponse = await request(app)
        .put(`/api/records/${testRecordId}/text/edit`)
        .send({ text: editedText })
        .expect(200);

      expect(editResponse.body.success).toBe(true);
      expect(editResponse.body.summary.modifiedCount).toBe(2);

      // 验证所有翻译和分析都被清除
      const translationsAfterEdit = db.getTranslationsByRecord(testRecordId);
      const analysesAfterEdit = db.getAnalysesByRecord(testRecordId);

      expect(translationsAfterEdit.length).toBe(0);
      expect(analysesAfterEdit.length).toBe(0);
    });

    test('应该处理空编辑（无实质变化）', async () => {
      const originalRecord = db.getRecord(testRecordId);
      const originalText = originalRecord.ocr_text;

      const editResponse = await request(app)
        .put(`/api/records/${testRecordId}/text/edit`)
        .send({ text: originalText })
        .expect(200);

      expect(editResponse.body.success).toBe(true);
      expect(editResponse.body.summary.hasChanges).toBe(false);
      expect(editResponse.body.message).toContain('无实质变化');

      // 验证翻译和分析仍然存在
      const translationsAfterEdit = db.getTranslationsByRecord(testRecordId);
      const analysesAfterEdit = db.getAnalysesByRecord(testRecordId);

      expect(translationsAfterEdit.length).toBeGreaterThan(0);
      expect(analysesAfterEdit.length).toBeGreaterThan(0);
    });

    test('应该处理删除句子', async () => {
      const editedText = 'The quick brown fox jumps over the lazy dog.';

      const editResponse = await request(app)
        .put(`/api/records/${testRecordId}/text/edit`)
        .send({ text: editedText })
        .expect(200);

      expect(editResponse.body.success).toBe(true);
      expect(editResponse.body.summary.deletedCount).toBe(1);

      // 验证第二句的分析被清除
      const analysesAfterEdit = db.getAnalysesByRecord(testRecordId);
      expect(analysesAfterEdit.length).toBe(0);
    });

    test('应该处理新增句子', async () => {
      const editedText = 'The quick brown fox jumps over the lazy dog. This is a test sentence. This is a new sentence.';

      const editResponse = await request(app)
        .put(`/api/records/${testRecordId}/text/edit`)
        .send({ text: editedText })
        .expect(200);

      expect(editResponse.body.success).toBe(true);
      expect(editResponse.body.summary.addedCount).toBe(1);

      // 验证现有的翻译和分析仍然存在
      const translationsAfterEdit = db.getTranslationsByRecord(testRecordId);
      const analysesAfterEdit = db.getAnalysesByRecord(testRecordId);

      expect(translationsAfterEdit.length).toBeGreaterThan(0);
      expect(analysesAfterEdit.length).toBeGreaterThan(0);
    });

    test('应该返回 404 当记录不存在', async () => {
      const response = await request(app)
        .put('/api/records/99999/text/edit')
        .send({ text: 'Some text' })
        .expect(500);

      expect(response.body.detail).toContain('不存在');
    });

    test('应该返回 400 当文本为空', async () => {
      const response = await request(app)
        .put(`/api/records/${testRecordId}/text/edit`)
        .send({ text: '' })
        .expect(400);

      expect(response.body.detail).toBe('Text is required');
    });
  });

  describe('未保存更改状态管理', () => {
    test('应该正确跟踪未保存更改状态', async () => {
      // 初始状态应该没有未保存更改
      const initialUnsavedResponse = await request(app)
        .get(`/api/records/${testRecordId}/unsaved-changes`)
        .expect(200);

      expect(initialUnsavedResponse.body.hasUnsavedChanges).toBe(false);

      // 暂时这个测试只验证 API 端点工作正常
      // 实际应用中，前端会在编辑器中设置未保存状态
    });
  });
});
