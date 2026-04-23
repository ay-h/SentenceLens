import * as api from '@/api';
import type { Record, RecordDetail, SentenceAnalysis, Session, Translation } from '@/types';
import { useCallback, useEffect, useRef, useState } from 'react';

function loadFromStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function saveToStorage(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* noop */ }
}

/**
 * Convert numbers to English words to avoid Chinese pronunciation
 */
function numberToEnglishWords(text: string): string {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function convertHundreds(num: number): string {
    if (num === 0) return '';
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      const ten = Math.floor(num / 10);
      const one = num % 10;
      return tens[ten] + (one ? '-' + ones[one] : '');
    }
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    return ones[hundred] + ' hundred' + (remainder ? ' and ' + convertHundreds(remainder) : '');
  }

  function convertNumber(num: number): string {
    if (num === 0) return 'zero';

    const scales = ['', 'thousand', 'million', 'billion', 'trillion'];
    let result = '';
    let scaleIndex = 0;

    while (num > 0) {
      const chunk = num % 1000;
      if (chunk > 0) {
        const chunkWords = convertHundreds(chunk);
        const scale = scales[scaleIndex];
        result = chunkWords + (scale ? ' ' + scale : '') + (result ? ' ' + result : '');
      }
      num = Math.floor(num / 1000);
      scaleIndex++;
    }

    return result;
  }

  // Replace all numbers in the text with their English word equivalents
  // Handles both integers and decimals (e.g., 3.14 -> "three point one four")
  return text.replace(/\b\d+\.?\d*\b/g, (match) => {
    if (match.includes('.')) {
      const [integerPart, decimalPart] = match.split('.');
      const integerWords = integerPart ? convertNumber(parseInt(integerPart, 10)) : 'zero';
      const decimalWords = decimalPart ? decimalPart.split('').map(d => ones[parseInt(d, 10)]).join(' ') : '';
      return integerWords + (decimalPart ? ' point ' + decimalWords : '');
    } else {
      const num = parseInt(match, 10);
      return convertNumber(num);
    }
  });
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
  const [sentences, setSentences] = useState<Array<{ id?: string; text: string; sentence_index: number; paragraph_index: number; is_modified?: number }>>([]);
  const [paragraphs, setParagraphs] = useState<string[][]>([]);
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
  const [isEditingText, setIsEditingText] = useState(false);
  const [loading, setLoading] = useState(false);

  // TTS state (global)
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const [ttsPaused, setTtsPaused] = useState(false);
  const [ttsVoice, setTtsVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [ttsCurrentSentence, setTtsCurrentSentence] = useState<string | null>(null);
  const ttsUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load TTS voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));

      const femaleVoiceKeywords = [
        'female', 'woman', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona',
        'google us english', 'microsoft zira', 'microsoft heera', 'microsoft aria'
      ];

      let selectedVoice = englishVoices.find(voice =>
        femaleVoiceKeywords.some(keyword => voice.name.toLowerCase().includes(keyword))
      );

      if (!selectedVoice) {
        selectedVoice = englishVoices.find(voice => voice.lang === 'en-US');
      }

      if (!selectedVoice && englishVoices.length > 0) {
        selectedVoice = englishVoices[0];
      }

      setTtsVoice(selectedVoice || null);
    };

    // Try to load voices immediately
    loadVoices();

    // Also try after a short delay (voices may load asynchronously)
    setTimeout(() => {
      loadVoices();
    }, 100);

    // Listen for voice changes
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // TTS methods
  const ttsSpeak = useCallback((text: string) => {
    if (!text || !text.trim()) return;

    const textWithNumbersConverted = numberToEnglishWords(text);
    const normalizedText = text.trim();

    // Update state first, then cancel to avoid intermediate null state
    setTtsSpeaking(true);
    setTtsPaused(false);
    setTtsCurrentSentence(normalizedText);

    // Cancel after state update
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textWithNumbersConverted);
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';

    // Try to use selected voice, but don't fail if not available
    if (ttsVoice) {
      utterance.voice = ttsVoice;
    }

    utterance.onend = () => {
      setTtsSpeaking(false);
      setTtsPaused(false);
      setTtsCurrentSentence(null);
    };

    utterance.onerror = (e) => {
      // Ignore interrupted errors (normal when canceling speech)
      if (e.error === 'interrupted' || e.error === 'canceled') {
        // Don't reset state on interrupted error since we're starting new speech
        // State will be reset by onend of the new speech
      } else {
        setTtsSpeaking(false);
        setTtsPaused(false);
        setTtsCurrentSentence(null);
      }
    };

    ttsUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [ttsVoice]);

  const ttsPause = useCallback(() => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setTtsPaused(true);
    }
  }, []);

  const ttsResume = useCallback(() => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setTtsPaused(false);
    }
  }, []);

  const ttsCancel = useCallback(() => {
    window.speechSynthesis.cancel();
    setTtsSpeaking(false);
    setTtsPaused(false);
    setTtsCurrentSentence(null);
  }, []);

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
    setParagraphs(sentData.paragraphs || []);
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
      setParagraphs([]);
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
    setParagraphs([]);
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
      setParagraphs([]);
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

  // Upload image - OCR preprocessing is automatically applied on server
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
      // Find the sentence_id from the sentences array
      const sentenceObj = sentences.find(s => s.text.trim() === selectedSentence.trim());
      const sentence_id = sentenceObj?.id;
      const result = await api.analyzeSentence(selectedSentence, currentRecordId, sentence_id);
      if (result.analysis?.success) {
        // Refresh record detail to update analyses list
        await selectRecordRef.current(currentRecordId);
        // Re-select the sentence to show analysis
        setSelectedSentence(selectedSentence);
        // The analysis is now in the record's analyses list after refresh
        // Find it by sentence_id and set it
        const updatedRecord = await api.getRecord(currentRecordId);
        const analysis = updatedRecord.analyses?.find(a => a.sentence_id === sentence_id);
        setSelectedAnalysis(analysis || null);
        // Set analysisVisible to true to automatically show the analysis result
        if (analysis) {
          setAnalysisVisible(true);
        }
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedSentence, currentRecordId, sentences]);

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
      setParagraphs([]);
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

  // Unified translation - automatically detects changes and translates only needed sentences
  const handleUnifiedTranslate = useCallback(async (forceAll = false, useStream = true) => {
    if (!currentRecordId) return;
    setLoading(true);

    if (useStream) {
      // Use SSE streaming for real-time updates
      let eventSource: EventSource | null = null;
      try {
        eventSource = api.unifiedTranslateStream(
          currentRecordId,
          forceAll,
          (event) => {
            console.log('SSE progress event received:', event);
            // Progress callback - update translations as they arrive
            if (event.translations && event.translations.length > 0) {
              console.log('Updating translations with', event.translations.length, 'items');
              setTranslations(prev => {
                const newTranslations = [...prev];
                event.translations!.forEach(t => {
                  // Convert SSE format to Translation format
                  const translation: Translation = {
                    sentence_index: t.sentence_id as number,
                    original_sentence: t.sentence_text,
                    translated_sentence: t.translation,
                    sentence_id: t.sentence_id?.toString()
                  };

                  const existingIndex = newTranslations.findIndex(
                    nt => nt.sentence_id === translation.sentence_id
                  );
                  if (existingIndex >= 0) {
                    newTranslations[existingIndex] = translation;
                  } else {
                    newTranslations.push(translation);
                  }
                });
                console.log('Updated translations count:', newTranslations.length);
                return newTranslations;
              });
              setShowTranslation(true);
              saveToStorage('showTranslation', 'true');
            }
          },
          (event) => {
            // Complete callback
            console.log('SSE complete event received:', event);
            console.log('Translation completed:', event.data);
          },
          (event) => {
            // Error callback
            console.error('SSE error event received:', event);
            throw new Error(event.error || 'Translation failed');
          }
        );
      } catch (error) {
        console.error('Translation failed:', error);
        throw error;
      } finally {
        setLoading(false);
      }

      // Return eventSource so caller can close if needed
      return eventSource;
    } else {
      // Use regular API call (non-streaming)
      try {
        const result = await api.unifiedTranslate(currentRecordId, forceAll);

        if (result.success) {
          // Refresh translations from server
          const transData = await api.getRecordTranslations(currentRecordId);
          setTranslations(transData.translations);
          setShowTranslation(true);
          saveToStorage('showTranslation', 'true');

          return result.data;
        } else {
          throw new Error(result.error);
        }
      } finally {
        setLoading(false);
      }
    }
  }, [currentRecordId]);

  // Toggle text editing
  const toggleTextEditing = useCallback((value: boolean) => {
    setIsEditingText(value);
  }, []);

  // Fetch current record data (for refreshing)
  const fetchCurrentRecord = useCallback(async () => {
    if (!currentRecordId) return;
    await selectRecordRef.current(currentRecordId);
  }, [currentRecordId]);

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
    paragraphs,
    translations,
    selectedSentence,
    selectedAnalysis,
    analysisVisible,
    sidebarCollapsed,
    showTranslation,
    isEditingText,
    loading,
    ttsSpeaking,
    ttsPaused,
    ttsCurrentSentence,

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
    handleUnifiedTranslate,
    toggleSidebar,
    toggleTranslation,
    toggleTextEditing,
    handleSelectSentence,
    cancelSelection,
    closeAnalysis,
    restoreState,
    fetchCurrentRecord,
    setLoading,
    ttsSpeak,
    ttsPause,
    ttsResume,
    ttsCancel,
  };
}

export type AppStore = ReturnType<typeof useAppStore>;
