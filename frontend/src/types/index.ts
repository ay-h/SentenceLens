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

export interface SentenceAnalysis {
  id: number;
  record_id: number;
  sentence: string;
  analysis: AnalysisData;
  created_at: string;
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
}

export interface LLMConfig {
  url: string;
  api_key: string;
  model: string;
}
