import * as api from '@/api';
import type { Record, RecordDetail, SentenceAnalysis, Session, Translation } from '@/types';
import { useCallback, useRef, useState } from 'react';

function loadFromStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function saveToStorage(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* noop */ }
}

export function useAppStore() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(() => {
    const v = loadFromStorage('currentSessionId');
    return v ? parseInt(v) : null;
  });
  const [records, setRecords] = useState<Record[]>([]);
  const [currentRecordId, setCurrentRecordId] = useState<number | null>(() => {
    const v = loadFromStorage('currentRecordId');
    return v ? parseInt(v) : null;
  });
  const [currentRecord, setCurrentRecord] = useState<RecordDetail | null>(null);
  const [sentences, setSentences] = useState<string[]>([]);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SentenceAnalysis | null>(null);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return loadFromStorage('sidebarCollapsed') === 'true';
  });
  const [showTranslation, setShowTranslation] = useState(() => {
    return loadFromStorage('showTranslation') === 'true';
  });
  const [loading, setLoading] = useState(false);

  // Persist session state
  const persistSession = useCallback((sessionId: number | null, recordId: number | null) => {
    saveToStorage('currentSessionId', sessionId?.toString() ?? '');
    saveToStorage('currentRecordId', recordId?.toString() ?? '');
  }, []);

  // Load all sessions
  const loadSessions = useCallback(async () => {
    const data = await api.getSessions();
    setSessions(data);
    return data;
  }, []);

  // Select a record & load its detail (defined first so selectSession can reference it)
  const selectRecord = useCallback(async (recordId: number) => {
    setCurrentRecordId(recordId);
    setSelectedSentence(null);
    setSelectedAnalysis(null);
    setAnalysisVisible(false);

    const [detail, sentData, transData] = await Promise.all([
      api.getRecord(recordId),
      api.getRecordSentences(recordId),
      api.getRecordTranslations(recordId).catch(() => ({ translations: [], has_translations: false })),
    ]);

    setCurrentRecord(detail);
    setSentences(sentData.sentences);
    setTranslations(transData.translations);
    persistSession(detail.session_id, recordId);
  }, [persistSession]);

  // Keep a ref so callbacks that depend on selectRecord always get the latest version
  const selectRecordRef = useRef(selectRecord);
  selectRecordRef.current = selectRecord;

  // Select a session & load its records
  const selectSession = useCallback(async (sessionId: number) => {
    setCurrentSessionId(sessionId);
    const recs = await api.getRecordsBySession(sessionId);
    setRecords(recs);
    // Auto-select last record
    if (recs.length > 0) {
      const lastRec = recs[recs.length - 1];
      await selectRecordRef.current(lastRec.id);
    } else {
      setCurrentRecordId(null);
      setCurrentRecord(null);
      setSentences([]);
      setTranslations([]);
      setSelectedSentence(null);
      setSelectedAnalysis(null);
      setAnalysisVisible(false);
    }
    persistSession(sessionId, recs.length > 0 ? recs[recs.length - 1].id : null);
  }, [persistSession]);

  // Create new session
  const createNewSession = useCallback(async () => {
    const session = await api.createSession('New Session');
    await loadSessions();
    setCurrentSessionId(session.id);
    setRecords([]);
    setCurrentRecordId(null);
    setCurrentRecord(null);
    setSentences([]);
    setTranslations([]);
    setSelectedSentence(null);
    setSelectedAnalysis(null);
    setAnalysisVisible(false);
    persistSession(session.id, null);
    return session;
  }, [loadSessions, persistSession]);

  // Delete session
  const removeSession = useCallback(async (sessionId: number) => {
    await api.deleteSession(sessionId);
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setRecords([]);
      setCurrentRecordId(null);
      setCurrentRecord(null);
      setSentences([]);
      setTranslations([]);
      setSelectedSentence(null);
      setSelectedAnalysis(null);
      setAnalysisVisible(false);
      persistSession(null, null);
    }
    await loadSessions();
  }, [currentSessionId, loadSessions, persistSession]);

  // Rename session
  const renameSession = useCallback(async (sessionId: number, title: string) => {
    await api.updateSessionTitle(sessionId, title);
    await loadSessions();
  }, [loadSessions]);

  // Upload image
  const handleUploadImage = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const result = await api.uploadImage(file, currentSessionId ?? undefined);
      if (!currentSessionId) {
        setCurrentSessionId(result.session_id);
      }
      await loadSessions();
      const recs = await api.getRecordsBySession(result.session_id);
      setRecords(recs);
      await selectRecordRef.current(result.record_id);
      return result;
    } finally {
      setLoading(false);
    }
  }, [currentSessionId, loadSessions]);

  // Process text
  const handleSendText = useCallback(async (text: string) => {
    setLoading(true);
    try {
      const result = await api.processText(text, currentSessionId ?? undefined);
      if (!currentSessionId) {
        setCurrentSessionId(result.session_id);
      }
      await loadSessions();
      const recs = await api.getRecordsBySession(result.session_id);
      setRecords(recs);
      await selectRecordRef.current(result.record_id);
      return result;
    } finally {
      setLoading(false);
    }
  }, [currentSessionId, loadSessions]);

  // Analyze sentence
  const handleAnalyze = useCallback(async () => {
    if (!selectedSentence || !currentRecordId) return;
    setLoading(true);
    try {
      const result = await api.analyzeSentence(selectedSentence, currentRecordId);
      if (result.analysis?.success) {
        // Refresh record detail to update analyses list
        await selectRecordRef.current(currentRecordId);
        // Re-select the sentence to show analysis
        setSelectedSentence(selectedSentence);
        setSelectedAnalysis({
          id: 0,
          record_id: currentRecordId,
          sentence: selectedSentence,
          analysis: result.analysis,
          created_at: new Date().toISOString(),
        });
        setAnalysisVisible(true);
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, [selectedSentence, currentRecordId]);

  // Delete analysis
  const handleDeleteAnalysis = useCallback(async () => {
    if (!selectedSentence || !currentRecordId) return;
    setLoading(true);
    try {
      const result = await api.deleteAnalysis(selectedSentence, currentRecordId);
      if (result.success) {
        setSelectedAnalysis(null);
        setAnalysisVisible(false);
        await selectRecordRef.current(currentRecordId);
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, [selectedSentence, currentRecordId]);

  // Delete record
  const handleDeleteRecord = useCallback(async () => {
    if (!currentRecordId || !currentSessionId) return;
    await api.deleteRecord(currentRecordId);
    const recs = await api.getRecordsBySession(currentSessionId);
    setRecords(recs);
    if (recs.length > 0) {
      await selectRecordRef.current(recs[recs.length - 1].id);
    } else {
      setCurrentRecordId(null);
      setCurrentRecord(null);
      setSentences([]);
      setTranslations([]);
      setSelectedSentence(null);
      setSelectedAnalysis(null);
      setAnalysisVisible(false);
    }
  }, [currentRecordId, currentSessionId]);

  // Rename record
  const handleRenameRecord = useCallback(async (name: string) => {
    if (!currentRecordId || !currentSessionId) return;
    await api.updateRecordName(currentRecordId, name);
    const recs = await api.getRecordsBySession(currentSessionId);
    setRecords(recs);
    if (currentRecord) {
      setCurrentRecord({ ...currentRecord, name });
    }
  }, [currentRecordId, currentSessionId, currentRecord]);

  // Translate
  const handleTranslate = useCallback(async () => {
    if (!currentRecord || !currentRecordId) return;
    setLoading(true);
    try {
      await api.translateText(currentRecord.ocr_text, currentRecordId);
      const transData = await api.getRecordTranslations(currentRecordId);
      setTranslations(transData.translations);
      setShowTranslation(true);
      saveToStorage('showTranslation', 'true');
    } finally {
      setLoading(false);
    }
  }, [currentRecord, currentRecordId]);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      saveToStorage('sidebarCollapsed', String(next));
      return next;
    });
  }, []);

  // Toggle translation
  const toggleTranslation = useCallback((value: boolean) => {
    setShowTranslation(value);
    saveToStorage('showTranslation', String(value));
  }, []);

  // Select sentence
  const handleSelectSentence = useCallback((sentence: string, analysis: SentenceAnalysis | null) => {
    setSelectedSentence(sentence);
    setSelectedAnalysis(analysis);
    if (analysis) {
      setAnalysisVisible(true);
    } else {
      setAnalysisVisible(false);
    }
  }, []);

  // Cancel selection
  const cancelSelection = useCallback(() => {
    setSelectedSentence(null);
    setSelectedAnalysis(null);
    setAnalysisVisible(false);
  }, []);

  // Close analysis panel
  const closeAnalysis = useCallback(() => {
    setAnalysisVisible(false);
  }, []);

  // Restore session from localStorage on init
  const restoreState = useCallback(async () => {
    const allSessions = await loadSessions();
    const savedSessionId = currentSessionId;
    const savedRecordId = currentRecordId;

    if (savedSessionId && allSessions.some(s => s.id === savedSessionId)) {
      const recs = await api.getRecordsBySession(savedSessionId);
      setRecords(recs);
      if (savedRecordId && recs.some(r => r.id === savedRecordId)) {
        await selectRecordRef.current(savedRecordId);
      } else if (recs.length > 0) {
        await selectRecordRef.current(recs[recs.length - 1].id);
      }
    }
  }, [currentSessionId, currentRecordId, loadSessions]);

  return {
    // State
    sessions,
    currentSessionId,
    records,
    currentRecordId,
    currentRecord,
    sentences,
    translations,
    selectedSentence,
    selectedAnalysis,
    analysisVisible,
    sidebarCollapsed,
    showTranslation,
    loading,

    // Actions
    loadSessions,
    selectSession,
    selectRecord,
    createNewSession,
    removeSession,
    renameSession,
    handleUploadImage,
    handleSendText,
    handleAnalyze,
    handleDeleteAnalysis,
    handleDeleteRecord,
    handleRenameRecord,
    handleTranslate,
    toggleSidebar,
    toggleTranslation,
    handleSelectSentence,
    cancelSelection,
    closeAnalysis,
    restoreState,
    setLoading,
  };
}

export type AppStore = ReturnType<typeof useAppStore>;
