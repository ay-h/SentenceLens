export interface Session {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Record {
  id: number;
  session_id: number;
  name: string;
  image_path: string;
  ocr_text: string;
  created_at: string;
}

export interface Sentence {
  id?: string;
  text: string;
  index: number;
  paragraph_index: number;
}

export interface SentenceAnalysis {
  id: number;
  record_id: number;
  sentence: string;
  analysis: AnalysisData;
  created_at: string;
  sentence_id?: string;
}

export interface RecordDetail extends Record {
  analyses: SentenceAnalysis[];
}

export interface AnalysisData {
  success?: boolean;
  error?: string;
  sentence_overview?: {
    translation: string;
    sentence_pattern?: string;
  };
  main_clause?: {
    text: string;
    subject?: { text: string; explanation: string };
    predicate?: { text: string; tense?: string; explanation: string };
    object?: { text: string; explanation: string };
    predicative?: { text: string; explanation: string };
    indirect_object?: { text: string; explanation: string };
    object_complement?: { text: string; explanation: string };
  };
  modifiers?: Array<{
    text: string;
    type: string;
    sub_type?: string;
    target: string;
    explanation: string;
  }>;
  subordinate_clauses?: Array<{
    text: string;
    type: string;
    function?: string;
    explanation: string;
  }>;
  structure_explanation?: {
    summary: string;
    key_points: string[];
  };
}

export interface UploadResponse {
  record_id: number;
  session_id: number;
  name: string;
  ocr_text: string;
  sentences: string[];
  image_path: string;
}

export interface TextProcessResponse {
  record_id: number;
  session_id: number;
  name: string;
  text: string;
  sentences: string[];
}

export interface Translation {
  sentence_index: number;
  original_sentence: string;
  translated_sentence: string;
  sentence_id?: string;
}

export interface LLMConfig {
  url: string;
  api_key: string;
  model: string;
}

export interface WordPartOfSpeech {
  pos: string;
  meaning: string;
}

export interface WordDefinition {
  word: string;
  phonetic: string;
  partsOfSpeech: WordPartOfSpeech[];
  source: 'dictionary' | 'llm';
}

export interface WordLookupResponse {
  definition: WordDefinition;
  source: 'dictionary' | 'llm';
  cached: boolean;
}

export interface TextEditChange {
  sentenceIndex: number;
  oldText: string | null;
  newText: string | null;
  type: 'added' | 'modified' | 'deleted' | 'unchanged';
}

export interface TextEditResult {
  success: boolean;
  message: string;
  changes: TextEditChange[];
  summary: {
    hasChanges: boolean;
    modifiedCount: number;
    deletedCount: number;
    addedCount: number;
    unchangedCount: number;
  };
  clearResults?: {
    analysesCleared: number;
    translationsCleared: number;
    errors: Array<{ sentenceId?: number; index?: number; error: string }>;
  };
}

export interface OCRQualityAssessment {
  record_id: number;
  ocr_quality: string | null;
  confidence_avg: number | null;
  needs_review: boolean;
}

export interface OCRPreprocessInfo {
  steps_applied?: {
    deskew?: { applied: boolean; angle?: number };
    contrast?: { applied: boolean };
    sharpen?: { applied: boolean };
    denoise?: { applied: boolean };
  };
  processing_time_ms?: number;
  quality_assessment?: {
    overallConfidence: number;
    qualityLevel: string;
    needsReview: boolean;
    suspiciousWords?: Array<{
      word: string;
      confidence: number;
      bbox?: [number, number, number, number];
      index: number;
    }>;
  };
}

export interface UploadResponseExtended extends UploadResponse {
  preprocess_info?: OCRPreprocessInfo;
}
