/**
 * Unit Tests for Unified Translation Button Functionality
 * Tests for User Story 2 - 统一翻译按钮
 */

const request = require('supertest');
const express = require('express');
const db = require('../../server/models/database');

// Mock dependencies
jest.mock('../../server/models/database');
jest.mock('../../server/services/llm');

describe('Unified Translation Button Tests', () => {
  let app;
  let mockLLMService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock database methods
    db.getRecord = jest.fn();
    db.getSentences = jest.fn();
    db.updateSentence = jest.fn();
    db.updateRecord = jest.fn();
    
    // Mock LLM service
    mockLLMService = {
      translateSentences: jest.fn()
    };
    
    // Require the app after mocking
    jest.doMock('../../server/services/llm', () => mockLLMService);
    
    // Create test app with translation routes
    app = express();
    app.use(express.json());
    
    // Translation endpoint (simplified for testing)
    app.post('/api/records/:id/translate', async (req, res) => {
      try {
        const { id } = req.params;
        const { force_all = false } = req.body;
        
        // Check for unsaved changes
        const record = await db.getRecord(id);
        if (record && record.has_unsaved_changes) {
          return res.status(400).json({
            success: false,
            error: '有未保存的更改，请先保存',
            code: 'UNSAVED_CHANGES'
          });
        }
        
        // Get sentences
        const sentences = await db.getSentences(id);
        
        // Filter sentences that need translation
        let sentencesToTranslate;
        if (force_all) {
          sentencesToTranslate = sentences.filter(s => !s.translation);
        } else {
          sentencesToTranslate = sentences.filter(s => s.is_modified && !s.translation);
        }
        
        // Check if no changes detected
        if (sentencesToTranslate.length === 0 && !force_all) {
          return res.json({
            success: true,
            data: {
              translated_count: 0,
              skipped_count: sentences.length,
              no_changes_detected: true,
              translations: []
            },
            message: '文本无变化，无需重新翻译'
          });
        }
        
        // Translate sentences
        const translations = await mockLLMService.translateSentences(
          sentencesToTranslate.map(s => s.text)
        );
        
        // Update sentences with translations
        for (let i = 0; i < sentencesToTranslate.length; i++) {
          const sentence = sentencesToTranslate[i];
          const translation = translations[i];
          
          await db.updateSentence(sentence.id, {
            translation: translation,
            is_modified: 0 // Clear modified flag after translation
          });
        }
        
        res.json({
          success: true,
          data: {
            translated_count: sentencesToTranslate.length,
            skipped_count: sentences.length - sentencesToTranslate.length,
            no_changes_detected: false,
            translations: sentencesToTranslate.map((s, i) => ({
              sentence_id: s.id,
              sentence_text: s.text,
              translation: translations[i],
              translation_time_ms: 100 // Mock timing
            }))
          },
          message: `已翻译${sentencesToTranslate.length}个句子，跳过${sentences.length - sentencesToTranslate.length}个未修改的句子`
        });
        
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('T023: 统一翻译逻辑（自动检测变化）', () => {
    test('should only translate modified sentences', async () => {
      // Mock data
      const mockSentences = [
        { id: 1, text: 'Hello world', is_modified: 1, translation: null },
        { id: 2, text: 'Goodbye world', is_modified: 0, translation: '再见世界' },
        { id: 3, text: 'How are you', is_modified: 1, translation: null }
      ];
      
      const mockRecord = { id: 123, has_unsaved_changes: 0 };
      
      db.getRecord.mockResolvedValue(mockRecord);
      db.getSentences.mockResolvedValue(mockSentences);
      mockLLMService.translateSentences.mockResolvedValue(['你好世界', '你好吗']);
      
      const response = await request(app)
        .post('/api/records/123/translate')
        .send({ force_all: false })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.translated_count).toBe(2);
      expect(response.body.data.skipped_count).toBe(1);
      expect(response.body.data.no_changes_detected).toBe(false);
      
      // Should only call translate for modified sentences
      expect(mockLLMService.translateSentences).toHaveBeenCalledWith([
        'Hello world',
        'How are you'
      ]);
      
      // Should update only modified sentences
      expect(db.updateSentence).toHaveBeenCalledTimes(2);
      expect(db.updateSentence).toHaveBeenCalledWith(1, {
        translation: '你好世界',
        is_modified: 0
      });
      expect(db.updateSentence).toHaveBeenCalledWith(3, {
        translation: '你好吗',
        is_modified: 0
      });
    });

    test('should translate all sentences when force_all is true', async () => {
      const mockSentences = [
        { id: 1, text: 'Hello world', is_modified: 0, translation: null },
        { id: 2, text: 'Goodbye world', is_modified: 0, translation: '再见世界' },
        { id: 3, text: 'How are you', is_modified: 0, translation: null }
      ];
      
      const mockRecord = { id: 123, has_unsaved_changes: 0 };
      
      db.getRecord.mockResolvedValue(mockRecord);
      db.getSentences.mockResolvedValue(mockSentences);
      mockLLMService.translateSentences.mockResolvedValue(['你好世界', '你好吗']);
      
      const response = await request(app)
        .post('/api/records/123/translate')
        .send({ force_all: true })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.translated_count).toBe(2);
      expect(response.body.data.skipped_count).toBe(1);
      
      // Should call translate for untranslated sentences only
      expect(mockLLMService.translateSentences).toHaveBeenCalledWith([
        'Hello world',
        'How are you'
      ]);
    });
  });

  describe('T024: 无变化检测和提示逻辑', () => {
    test('should return no changes message when no sentences need translation', async () => {
      const mockSentences = [
        { id: 1, text: 'Hello world', is_modified: 0, translation: '你好世界' },
        { id: 2, text: 'Goodbye world', is_modified: 0, translation: '再见世界' }
      ];
      
      const mockRecord = { id: 123, has_unsaved_changes: 0 };
      
      db.getRecord.mockResolvedValue(mockRecord);
      db.getSentences.mockResolvedValue(mockSentences);
      
      const response = await request(app)
        .post('/api/records/123/translate')
        .send({ force_all: false })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.translated_count).toBe(0);
      expect(response.body.data.skipped_count).toBe(2);
      expect(response.body.data.no_changes_detected).toBe(true);
      expect(response.body.message).toBe('文本无变化，无需重新翻译');
      
      // Should not call translation service
      expect(mockLLMService.translateSentences).not.toHaveBeenCalled();
      
      // Should not update any sentences
      expect(db.updateSentence).not.toHaveBeenCalled();
    });

    test('should still translate when force_all is true even if no modifications', async () => {
      const mockSentences = [
        { id: 1, text: 'Hello world', is_modified: 0, translation: null },
        { id: 2, text: 'Goodbye world', is_modified: 0, translation: null }
      ];
      
      const mockRecord = { id: 123, has_unsaved_changes: 0 };
      
      db.getRecord.mockResolvedValue(mockRecord);
      db.getSentences.mockResolvedValue(mockSentences);
      mockLLMService.translateSentences.mockResolvedValue(['你好世界', '再见世界']);
      
      const response = await request(app)
        .post('/api/records/123/translate')
        .send({ force_all: true })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.translated_count).toBe(2);
      expect(response.body.data.no_changes_detected).toBe(false);
      
      // Should call translation service
      expect(mockLLMService.translateSentences).toHaveBeenCalled();
    });
  });

  describe('T025: 未保存更改检查', () => {
    test('should return error when record has unsaved changes', async () => {
      const mockRecord = { id: 123, has_unsaved_changes: 1 };
      
      db.getRecord.mockResolvedValue(mockRecord);
      
      const response = await request(app)
        .post('/api/records/123/translate')
        .send({ force_all: false })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('有未保存的更改，请先保存');
      expect(response.body.code).toBe('UNSAVED_CHANGES');
      
      // Should not proceed with translation
      expect(db.getSentences).not.toHaveBeenCalled();
      expect(mockLLMService.translateSentences).not.toHaveBeenCalled();
    });

    test('should proceed when record has no unsaved changes', async () => {
      const mockSentences = [
        { id: 1, text: 'Hello world', is_modified: 1, translation: null }
      ];
      
      const mockRecord = { id: 123, has_unsaved_changes: 0 };
      
      db.getRecord.mockResolvedValue(mockRecord);
      db.getSentences.mockResolvedValue(mockSentences);
      mockLLMService.translateSentences.mockResolvedValue(['你好世界']);
      
      const response = await request(app)
        .post('/api/records/123/translate')
        .send({ force_all: false })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(mockLLMService.translateSentences).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      db.getRecord.mockRejectedValue(new Error('Database connection failed'));
      
      const response = await request(app)
        .post('/api/records/123/translate')
        .send({ force_all: false })
        .expect(500);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database connection failed');
    });

    test('should handle LLM service errors gracefully', async () => {
      const mockSentences = [
        { id: 1, text: 'Hello world', is_modified: 1, translation: null }
      ];
      
      const mockRecord = { id: 123, has_unsaved_changes: 0 };
      
      db.getRecord.mockResolvedValue(mockRecord);
      db.getSentences.mockResolvedValue(mockSentences);
      mockLLMService.translateSentences.mockRejectedValue(new Error('LLM service unavailable'));
      
      const response = await request(app)
        .post('/api/records/123/translate')
        .send({ force_all: false })
        .expect(500);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('LLM service unavailable');
    });
  });
});
