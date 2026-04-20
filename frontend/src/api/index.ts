import type {
    AnalysisData,
    LLMConfig,
    Record,
    RecordDetail,
    Session,
    TextProcessResponse,
    Translation,
    UploadResponse,
    WordLookupResponse,
} from '@/types';

// In Electron, frontend loads via file:// protocol, so we need absolute URL to Express server.
// In dev mode (Vite proxy), empty BASE works via proxy.
export const BASE = typeof window !== 'undefined' && window.location.protocol === 'file:'
  ? 'http://127.0.0.1:8000'
  : '';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ==================== Sessions ====================

export async function getSessions(): Promise<Session[]> {
  return request('/api/sessions');
}

export async function createSession(title: string): Promise<Session> {
  return request('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
}

export async function updateSessionTitle(id: number, title: string): Promise<Session> {
  return request(`/api/sessions/${id}/title`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
}

export async function deleteSession(id: number): Promise<{ success: boolean }> {
  return request(`/api/sessions/${id}`, { method: 'DELETE' });
}

// ==================== Records ====================

export async function getRecordsBySession(sessionId: number): Promise<Record[]> {
  return request(`/api/sessions/${sessionId}/records`);
}

export async function getRecord(id: number): Promise<RecordDetail> {
  return request(`/api/records/${id}`);
}

export async function getRecordSentences(id: number): Promise<{
  sentences: Array<{ text: string; index: number; paragraph_index: number }>;
  paragraphs: string[][];
}> {
  return request(`/api/records/${id}/sentences`);
}

export async function updateRecordName(id: number, name: string): Promise<Record> {
  return request(`/api/records/${id}/name`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function deleteRecord(id: number): Promise<{ success: boolean }> {
  return request(`/api/records/${id}`, { method: 'DELETE' });
}

// ==================== Text Edit ====================

export async function editText(
  recordId: number,
  text: string,
): Promise<{
  success: boolean;
  message: string;
  changes: Array<{
    sentenceIndex: number;
    oldText: string | null;
    newText: string | null;
    type: 'added' | 'modified' | 'deleted' | 'unchanged';
  }>;
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
}> {
  return request(`/api/records/${recordId}/text/edit`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export async function getUnsavedChanges(
  recordId: number,
): Promise<{ hasUnsavedChanges: boolean }> {
  return request(`/api/records/${recordId}/unsaved-changes`);
}

// ==================== Upload & Text ====================

export async function uploadImage(
  file: File,
  sessionId?: number,
  name?: string,
): Promise<UploadResponse> {
  const formData = new FormData();
  // Encode filename to handle Chinese characters properly
  // Use encodeURIComponent to ensure Chinese characters are transmitted correctly
  const encodedFilename = encodeURIComponent(file.name);
  // Create a new File with encoded name
  const renamedFile = new File([file], encodedFilename, { type: file.type });
  formData.append('file', renamedFile);
  if (sessionId) formData.append('session_id', String(sessionId));
  if (name) formData.append('name', name);
  return request('/api/upload', { method: 'POST', body: formData });
}

export async function processText(
  text: string,
  sessionId?: number,
  name?: string,
): Promise<TextProcessResponse> {
  return request('/api/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, session_id: sessionId, name }),
  });
}

// ==================== Analysis ====================

export async function analyzeSentence(
  sentence: string,
  recordId: number,
  sentenceId?: string,
): Promise<{ analysis: AnalysisData }> {
  return request('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sentence, record_id: recordId, sentence_id: sentenceId }),
  });
}

export async function deleteAnalysis(
  sentence: string,
  recordId: number,
): Promise<{ success: boolean; message: string }> {
  return request('/api/analysis/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sentence, record_id: recordId }),
  });
}

// ==================== Translation ====================

export async function unifiedTranslate(
  recordId: number,
  forceAll = false,
): Promise<{
  success: boolean;
  data?: {
    translated_count: number;
    skipped_count: number;
    no_changes_detected: boolean;
    translations: Array<{
      sentence_id: number;
      sentence_text: string;
      translation: string;
      translation_time_ms: number;
    }>;
  };
  message: string;
  error?: string;
}> {
  return request(`/api/records/${recordId}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force_all: forceAll }),
  });
}

export async function translateText(
  text: string,
  recordId: number,
): Promise<{ translation: string; original_text: string }> {
  return request('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, record_id: recordId }),
  });
}

export async function getRecordTranslations(
  recordId: number,
): Promise<{ translations: Translation[]; has_translations: boolean }> {
  return request(`/api/records/${recordId}/translations`);
}

// ==================== OCR Quality Assessment ====================

export async function getRecordQuality(
  recordId: number,
): Promise<{
  record_id: number;
  ocr_quality: string | null;
  confidence_avg: number | null;
  needs_review: boolean;
}> {
  return request(`/api/records/${recordId}/quality`);
}

// ==================== Word Lookup ====================

export async function lookupWord(
  word: string,
  signal?: AbortSignal,
): Promise<WordLookupResponse> {
  const res = await fetch(`${BASE}/api/word-lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ==================== LLM Config ====================

export async function getLLMConfig(): Promise<LLMConfig> {
  return request('/api/llm-config');
}

export async function saveLLMConfig(config: LLMConfig): Promise<{ success: boolean }> {
  return request('/api/llm-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}
