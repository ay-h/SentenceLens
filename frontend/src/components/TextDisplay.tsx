import { ConfirmDialog } from '@/components/Dialog';
import WordLookupPopover from '@/components/WordLookupPopover';
import { useWordLookup } from '@/hooks/useWordLookup';
import { useApp } from '@/store/AppContext';
import type { SentenceAnalysis } from '@/types';
import { Loader2, Search, Trash2, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function TextDisplay() {
  const {
    sentences, paragraphs, currentRecord, translations, showTranslation,
    selectedSentence, selectedAnalysis,
    handleSelectSentence, handleAnalyze, handleDeleteAnalysis, cancelSelection, loading,
  } = useApp();

  const [analyzing, setAnalyzing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Word lookup
  const { wordLookup, lookupWord, closeWordLookup } = useWordLookup();
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingClickRef = useRef<(() => void) | null>(null);

  const handleWordDblClick = useCallback((e: React.MouseEvent<HTMLSpanElement>, word: string) => {
    e.stopPropagation();
    // Cancel any pending single-click
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      pendingClickRef.current = null;
    }
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    lookupWord(word, rect);
  }, [lookupWord]);

  if (!currentRecord || sentences.length === 0) return null;

  // Build translation map
  const translationMap: Record<number, string> = {};
  translations.forEach(t => {
    translationMap[t.sentence_index] = t.translated_sentence;
  });

  // Build analysis map for quick lookup
  const analyses = currentRecord.analyses || [];

  function findAnalysis(sentence: string): SentenceAnalysis | null {
    const normalized = sentence.split(' ').join(' ');
    const found = analyses.find(a => {
      if (!a.sentence) return false;
      return a.sentence.split(' ').join(' ') === normalized;
    });
    return found || null;
  }

  // Group sentences by paragraph_index
  const groupedSentences: Record<number, Array<{text: string; index: number; paragraph_index: number}>> = {};
  sentences.forEach(s => {
    const pIndex = s.paragraph_index || 0;
    if (!groupedSentences[pIndex]) {
      groupedSentences[pIndex] = [];
    }
    groupedSentences[pIndex].push(s);
  });

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {Object.keys(groupedSentences).map(pIndex => {
          const paragraphSentences = groupedSentences[Number(pIndex)];
          // Collect translations for this paragraph
          const paragraphTranslations = paragraphSentences
            .map(s => translationMap[s.index])
            .filter(t => t)
            .join(' ');

          return (
            <div key={pIndex} className="mb-6">
              {paragraphSentences.map((sentenceObj) => {
                const sentence = sentenceObj.text;
                const index = sentenceObj.index;
                const analysis = findAnalysis(sentence);
                const isSelected = selectedSentence === sentence.trim();
                const isAnalyzed = !!analysis;

                async function onAnalyze() {
                  if (analyzing || loading) return;
                  setAnalyzing(true);
                  try {
                    toast.info('正在分析句子...');
                    const result = await handleAnalyze();
                    if (result?.analysis?.success) {
                      toast.success('分析完成');
                    } else {
                      toast.error(result?.analysis?.error || '分析失败');
                    }
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
                    return;
                  }
                  setAnalyzing(false);
                  setDeleting(false);
                  setDeleteOpen(false);
                  handleSelectSentence(sentence.trim(), analysis);
                };

                return (
                  <React.Fragment key={index}>
                    <div className="relative inline">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          // Immediate selection without delay
                          handleSentenceClick();
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
                        <div className="absolute left-0 bottom-full mb-2 z-10 flex items-center gap-2 text-xs text-[var(--color-text-secondary)] bg-white shadow-md rounded-md px-3 py-2 border border-gray-200 whitespace-nowrap">
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
                    const translation = translationMap[sentenceObj.index];
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
