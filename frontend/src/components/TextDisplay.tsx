import { ConfirmDialog } from '@/components/Dialog';
import WordLookupPopover from '@/components/WordLookupPopover';
import { useWordLookup } from '@/hooks/useWordLookup';
import { useApp } from '@/store/AppContext';
import type { SentenceAnalysis } from '@/types';
import { Loader2, Pause, Play, Search, Square, Trash2, Volume2, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

// TTS Control Buttons Component
function TTSControlButtons({
  sentence,
  ttsCurrentSentence,
  ttsSpeaking,
  ttsPaused,
  onSpeak,
  onPause,
  onResume,
  onCancel,
}: {
  sentence: string;
  ttsCurrentSentence: string | null;
  ttsSpeaking: boolean;
  ttsPaused: boolean;
  onSpeak: (text: string) => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  const isCurrentSentence = sentence.trim() === ttsCurrentSentence;

  if (!isCurrentSentence) {
    return (
      <button
        onClick={() => onSpeak(sentence)}
        className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--color-success)] text-white hover:bg-[var(--color-success-hover)] transition-colors"
      >
        <Volume2 size={12} />
        朗读
      </button>
    );
  }

  return (
    <>
      {ttsPaused ? (
        <>
          <button
            onClick={onResume}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors font-medium shadow-sm"
            style={{ zIndex: 100 }}
          >
            <Play size={12} />
            继续
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors font-medium shadow-sm"
            style={{ zIndex: 100 }}
          >
            <Square size={12} />
            停止
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onPause}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-yellow-500 text-white hover:bg-yellow-600 transition-colors font-medium shadow-sm"
            style={{ zIndex: 100 }}
          >
            <Pause size={12} />
            暂停
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors font-medium shadow-sm"
            style={{ zIndex: 100 }}
          >
            <Square size={12} />
            停止
          </button>
        </>
      )}
    </>
  );
}

export default function TextDisplay() {
  const {
    sentences, paragraphs, currentRecord, translations, showTranslation,
    selectedSentence, selectedAnalysis,
    handleSelectSentence, handleAnalyze, handleDeleteAnalysis, cancelSelection, loading,
    ttsSpeaking, ttsPaused, ttsCurrentSentence, ttsSpeak, ttsPause, ttsResume, ttsCancel,
  } = useApp();

  const [analyzing, setAnalyzing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [buttonPosition, setButtonPosition] = useState<'top' | 'bottom'>('bottom');

  // Word lookup
  const { wordLookup, lookupWord, closeWordLookup } = useWordLookup();
  const sentenceRef = useRef<HTMLSpanElement>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingClickRef = useRef<(() => void) | null>(null);
  const isDoubleClickRef = useRef(false);

  const handleWordDblClick = useCallback((e: React.MouseEvent<HTMLSpanElement>, word: string) => {
    e.stopPropagation();
    // Mark as double-click to cancel pending single-click
    isDoubleClickRef.current = true;
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      pendingClickRef.current = null;
    }
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    lookupWord(word, rect);
    // Reset double-click flag after a short delay
    setTimeout(() => {
      isDoubleClickRef.current = false;
    }, 100);
  }, [lookupWord]);

  const handleSentenceClickDelayed = useCallback((action: () => void) => {
    // Cancel any pending click
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }
    // Store the action to execute after delay
    pendingClickRef.current = action;
    // Set a delay to wait for potential double-click
    clickTimerRef.current = setTimeout(() => {
      if (pendingClickRef.current && !isDoubleClickRef.current) {
        pendingClickRef.current();
        pendingClickRef.current = null;
        clickTimerRef.current = null;
      }
    }, 200); // 200ms delay to distinguish single vs double click
  }, []);

  if (!currentRecord || sentences.length === 0) return null;

  // Build translation map based on sentence_id (UUID) for accurate matching
  const translationMap: Record<string, string> = {};
  translations.forEach(t => {
    if (t.sentence_id) {
      translationMap[t.sentence_id] = t.translated_sentence;
    }
  });

  // Build analysis map for quick lookup
  const analyses = currentRecord.analyses || [];

  function findAnalysis(sentence: string, sentenceId?: string): SentenceAnalysis | null {
    // Try to match by sentence_id first (UUID-based matching)
    if (sentenceId) {
      const found = analyses.find(a => a.sentence_id === sentenceId);
      if (found) return found;
    }
    // Fallback to content matching for backward compatibility
    const normalized = sentence.split(' ').join(' ');
    const found = analyses.find(a => {
      if (!a.sentence) return false;
      return a.sentence.split(' ').join(' ') === normalized;
    });
    return found || null;
  }

  // Group sentences by paragraph_index
  const groupedSentences: Record<number, Array<{id?: string; text: string; index: number; paragraph_index: number}>> = {};
  sentences.forEach(s => {
    const pIndex = s.paragraph_index || 0;
    if (!groupedSentences[pIndex]) {
      groupedSentences[pIndex] = [];
    }
    groupedSentences[pIndex].push({
      id: (s as any).id, // Cast to any since id is optional and may not exist in old data
      text: s.text,
      index: s.sentence_index,
      paragraph_index: s.paragraph_index
    });
  });

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {Object.keys(groupedSentences).map(pIndex => {
          const paragraphSentences = groupedSentences[Number(pIndex)];
          // Collect translations for this paragraph
          const paragraphTranslations = paragraphSentences
            .map(s => s.id ? translationMap[s.id] : null)
            .filter(t => t)
            .join(' ');

          return (
            <div key={pIndex} className="mb-6">
              {paragraphSentences.map((sentenceObj) => {
                const sentence = sentenceObj.text;
                const index = sentenceObj.index;
                const analysis = findAnalysis(sentence, sentenceObj.id);
                const isSelected = selectedSentence === sentence.trim();
                const isAnalyzed = !!analysis;

                async function onAnalyze() {
                  if (analyzing || loading) return;
                  setAnalyzing(true);
                  try {
                    toast.info('正在分析句子...');
                    await handleAnalyze();
                    toast.success('分析完成');
                    // After analysis completes, the analysis should be automatically shown
                    // The handleAnalyze in useAppStore already updates selectedAnalysis
                  } catch (err: unknown) {
                    toast.error(`分析失败: ${err instanceof Error ? err.message : '未知错误'}`);
                  } finally {
                    setAnalyzing(false);
                  }
                }

                async function onDeleteAnalysis() {
                  if (deleting || loading) return;
                  setDeleting(true);
                  try {
                    const result = await handleDeleteAnalysis();
                    if (result?.success) {
                      toast.success('分析结果已删除');
                    } else {
                      toast.error(result?.message || '删除失败');
                    }
                  } catch (err: unknown) {
                    toast.error(`删除失败: ${err instanceof Error ? err.message : '未知错误'}`);
                  } finally {
                    setDeleting(false);
                    setDeleteOpen(false);
                  }
                }

                const showActions = isSelected;

                // Split sentence into word tokens for dblclick word lookup
                const wordTokens = sentence.match(/[\p{L}\d''-]+|[^\p{L}\d''-]+/gu) || [sentence];

                const handleSentenceClick = () => {
                  if (isSelected) {
                    cancelSelection();
                    closeWordLookup();
                    setAnalyzing(false);
                    setDeleting(false);
                    setDeleteOpen(false);
                    setButtonPosition('bottom');
                    return;
                  }
                  setAnalyzing(false);
                  setDeleting(false);
                  setDeleteOpen(false);
                  handleSelectSentence(sentence.trim(), analysis);

                  // Detect if sentence is near top of viewport
                  setTimeout(() => {
                    if (sentenceRef.current) {
                      const rect = sentenceRef.current.getBoundingClientRect();
                      const viewportHeight = window.innerHeight;
                      // If sentence is in top 30% of viewport, show buttons below
                      if (rect.top < viewportHeight * 0.3) {
                        setButtonPosition('bottom');
                      } else {
                        setButtonPosition('top');
                      }
                    }
                  }, 0);
                };

                return (
                  <React.Fragment key={index}>
                    <div className="relative inline">
                      <span
                        ref={isSelected ? sentenceRef : null}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSentenceClickDelayed(() => handleSentenceClick());
                        }}
                        className={`inline cursor-pointer rounded px-1 py-0.5 text-[19px] leading-9 text-gray-900 transition-all ${
                        isSelected
                          ? 'bg-blue-100 text-[var(--color-primary)]'
                          : isAnalyzed
                            ? 'bg-green-50 hover:bg-green-100'
                            : 'hover:bg-gray-100'
                      }`}
                        style={isAnalyzed ? { borderBottom: '2px solid var(--color-success)' } : undefined}
                      >
                        {wordTokens.map((token: string, ti: number) => {
                          const isWord = /[\p{L}\d]/u.test(token);
                          if (!isWord) return <span key={ti}>{token}</span>;
                          return (
                            <span
                              key={ti}
                              onDoubleClick={(e) => handleWordDblClick(e, token)}
                              className=""
                            >
                              {token}
                            </span>
                          );
                        })}
                      </span>

                      {showActions && (
                        <div className={`absolute left-0 z-10 flex items-center gap-2 text-xs text-[var(--color-text-secondary)] bg-white shadow-md rounded-md px-3 py-2 border border-gray-200 whitespace-nowrap ${
                          buttonPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
                        }`}>
                        {/* TTS Control Buttons - always first */}
                        <TTSControlButtons
                          sentence={sentence}
                          ttsCurrentSentence={ttsCurrentSentence}
                          ttsSpeaking={ttsSpeaking}
                          ttsPaused={ttsPaused}
                          onSpeak={ttsSpeak}
                          onPause={ttsPause}
                          onResume={ttsResume}
                          onCancel={ttsCancel}
                        />

                        <button
                          onClick={onAnalyze}
                          disabled={analyzing || loading}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
                        >
                          {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                          {analyzing ? '分析中...' : '分析句子'}
                        </button>

                        {selectedAnalysis && (
                          <button
                            onClick={() => setDeleteOpen(true)}
                            disabled={deleting || loading}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger-hover)] transition-colors disabled:opacity-50"
                          >
                            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            {deleting ? '删除中...' : '删除分析'}
                          </button>
                        )}

                        <button
                          onClick={() => {
                            cancelSelection();
                            setAnalyzing(false);
                            setDeleting(false);
                            setDeleteOpen(false);
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-gray-50 transition-colors"
                        >
                          <X size={12} />
                          取消
                        </button>
                      </div>
                    )}

                    <ConfirmDialog
                      open={deleteOpen}
                      onClose={() => {
                        if (!deleting) setDeleteOpen(false);
                      }}
                      onConfirm={onDeleteAnalysis}
                      title="删除分析"
                      message="确定要删除这句的分析结果吗？"
                      confirmText="删除"
                      danger
                    />
                    </div>
                  </React.Fragment>
                );
              })}

              {showTranslation && paragraphTranslations && (
                <div className="mt-3 text-[14px] text-blue-700/80 leading-relaxed pl-2 border-l-2 border-blue-200">
                  {paragraphSentences.map((sentenceObj) => {
                    const translation = sentenceObj.id ? translationMap[sentenceObj.id] : null;
                    if (!translation) return null;
                    const isSelected = selectedSentence === sentenceObj.text.trim();
                    return (
                      <span
                        key={sentenceObj.index}
                        className={isSelected ? 'bg-blue-100 px-1 rounded' : ''}
                      >
                        {translation}{' '}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <WordLookupPopover state={wordLookup} onClose={closeWordLookup} />
    </div>
  );
}
