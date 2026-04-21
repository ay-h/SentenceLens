import { deleteSentence, editSentence, insertSentence, splitSentence } from '@/api';
import { getRecordSentences } from '@/api';
import { ConfirmDialog, Dialog } from '@/components/Dialog';
import { useApp } from '@/store/AppContext';
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Check, ChevronDown, ChevronRight, Edit, Loader2, Plus, Save, Scissors, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Sentence {
  id: string;
  text: string;
  paragraph_index: number;
  sentence_index: number;
  is_modified?: number;
}

interface TextEditorProps {
  onClose?: () => void;
}

export default function TextEditor({ onClose }: TextEditorProps) {
  const { currentRecord, fetchCurrentRecord } = useApp();

  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [editingSentenceId, setEditingSentenceId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showInsertDialog, setShowInsertDialog] = useState(false);
  const [insertTargetId, setInsertTargetId] = useState<string | null>(null);
  const [insertPosition, setInsertPosition] = useState<'before' | 'after'>('after');
  const [insertNewParagraph, setInsertNewParagraph] = useState(false);
  const [insertText, setInsertText] = useState('');
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitTargetId, setSplitTargetId] = useState<string | null>(null);
  const [splitPosition, setSplitPosition] = useState(0);
  const [splitNewParagraph, setSplitNewParagraph] = useState(false);
  const [collapsedParagraphs, setCollapsedParagraphs] = useState<Set<number>>(new Set());

  function toggleParagraphCollapse(paragraphIndex: number) {
    setCollapsedParagraphs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paragraphIndex)) {
        newSet.delete(paragraphIndex);
      } else {
        newSet.add(paragraphIndex);
      }
      return newSet;
    });
  }

  // Load sentences when record changes
  useEffect(() => {
    if (currentRecord?.id) {
      loadSentences();
    }
  }, [currentRecord?.id]);

  async function loadSentences() {
    if (!currentRecord?.id) return;
    setIsLoading(true);
    try {
      const data = await getRecordSentences(currentRecord.id);
      // The API returns sentences with id, text, paragraph_index, sentence_index
      setSentences((data.sentences || []) as Sentence[]);
    } catch (error) {
      console.error('Failed to load sentences:', error);
      toast.error('加载句子失败');
    } finally {
      setIsLoading(false);
    }
  }

  // Group sentences by paragraph
  const groupedSentences = sentences.reduce((acc, sentence) => {
    const pIndex = sentence.paragraph_index || 0;
    if (!acc[pIndex]) {
      acc[pIndex] = [];
    }
    acc[pIndex].push(sentence);
    return acc;
  }, {} as Record<number, Sentence[]>);

  // Sort paragraphs and sentences
  const sortedParagraphs = Object.keys(groupedSentences)
    .map(Number)
    .sort((a, b) => a - b)
    .map(pIndex => ({
      index: pIndex,
      sentences: groupedSentences[pIndex].sort((a, b) => a.sentence_index - b.sentence_index)
    }));

  async function handleEditSentence(sentenceId: string, newText: string) {
    if (!newText.trim()) {
      toast.error('句子不能为空');
      return;
    }

    setIsSaving(true);
    try {
      await editSentence(sentenceId, newText);
      await loadSentences();
      toast.success('句子已更新');
      setEditingSentenceId(null);
      setEditingText('');
    } catch (error) {
      console.error('Failed to edit sentence:', error);
      toast.error('更新句子失败');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteSentence(sentenceId: string) {
    setIsSaving(true);
    try {
      await deleteSentence(sentenceId);
      await loadSentences();
      toast.success('句子已删除');
    } catch (error) {
      console.error('Failed to delete sentence:', error);
      toast.error('删除句子失败');
    } finally {
      setIsSaving(false);
    }
  }

  function openInsertDialog(targetId: string, position: 'before' | 'after') {
    setInsertTargetId(targetId);
    setInsertPosition(position);
    setInsertText('');
    setInsertNewParagraph(false);
    setShowInsertDialog(true);
  }

  async function handleInsertSentence() {
    if (!currentRecord?.id || !insertTargetId || !insertText.trim()) {
      toast.error('请输入句子内容');
      return;
    }

    console.log('Inserting sentence:', {
      recordId: currentRecord.id,
      text: insertText,
      targetId: insertTargetId,
      position: insertPosition,
      newParagraph: insertNewParagraph
    });

    setIsSaving(true);
    try {
      const result = await insertSentence(
        currentRecord.id,
        insertText,
        insertTargetId,
        insertPosition,
        insertNewParagraph
      );
      console.log('Insert result:', result);
      if (result.success) {
        await loadSentences();
        toast.success('句子已插入');
        setShowInsertDialog(false);
        setInsertText('');
      } else {
        toast.error(result.message || '插入句子失败');
      }
    } catch (error) {
      console.error('Failed to insert sentence:', error);
      toast.error(`插入句子失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSaving(false);
    }
  }

  function openSplitDialog(sentenceId: string, text: string) {
    setSplitTargetId(sentenceId);
    setSplitPosition(Math.floor(text.length / 2));
    setSplitNewParagraph(false);
    setShowSplitDialog(true);
  }

  async function handleSplitSentence() {
    if (!splitTargetId) return;

    const targetSentence = sentences.find(s => s.id === splitTargetId);
    if (!targetSentence) return;

    if (splitPosition <= 0 || splitPosition >= targetSentence.text.length) {
      toast.error('分割位置无效');
      return;
    }

    setIsSaving(true);
    try {
      await splitSentence(splitTargetId, splitPosition, splitNewParagraph);
      await loadSentences();
      toast.success('句子已分割');
      setShowSplitDialog(false);
    } catch (error) {
      console.error('Failed to split sentence:', error);
      toast.error('分割句子失败');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteAll() {
    if (!currentRecord?.id) return;

    setIsSaving(true);
    setShowDeleteAllDialog(false);
    try {
      // Delete all sentences
      for (const sentence of sentences) {
        await deleteSentence(sentence.id);
      }
      await loadSentences();
      toast.success('所有内容已删除');
    } catch (error) {
      console.error('Failed to delete all:', error);
      toast.error('删除失败');
    } finally {
      setIsSaving(false);
    }
  }

  function handleConfirmClose() {
    if (editingSentenceId) {
      setShowConfirmDialog(true);
    } else {
      // Refresh data before closing
      fetchCurrentRecord();
      onClose?.();
    }
  }

  function handleConfirmDiscard() {
    setShowConfirmDialog(false);
    setEditingSentenceId(null);
    setEditingText('');
    // Refresh data before closing
    fetchCurrentRecord();
    onClose?.();
  }

  function handleCancelClose() {
    setShowConfirmDialog(false);
  }

  if (!currentRecord) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            编辑文本
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {currentRecord.name} • {sentences.length} 个句子
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleConfirmClose}
            className="p-2 rounded-lg transition-colors hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            title="关闭"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Sentences List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={32} className="animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : sortedParagraphs.length === 0 ? (
          <div className="text-center text-[var(--color-text-muted)] py-8">
            暂无句子内容
          </div>
        ) : (
          <div className="space-y-6">
            {sortedParagraphs.map((paragraph) => (
              <div key={paragraph.index} className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => toggleParagraphCollapse(paragraph.index)}
                    className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]"
                    title={collapsedParagraphs.has(paragraph.index) ? '展开段落' : '折叠段落'}
                  >
                    {collapsedParagraphs.has(paragraph.index) ? (
                      <ChevronRight size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </button>
                  <span className="text-xs text-[var(--color-text-muted)] font-medium">
                    段落 {paragraph.index + 1}
                  </span>
                  {paragraph.index === 0 && (
                    <button
                      onClick={() => {
                        const firstSentence = paragraph.sentences[0];
                        if (firstSentence) {
                          openInsertDialog(firstSentence.id, 'before');
                          setInsertNewParagraph(true);
                        }
                      }}
                      className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]"
                      title="在段落前插入新段落"
                    >
                      <ArrowUpToLine size={14} />
                    </button>
                  )}
                </div>
                {!collapsedParagraphs.has(paragraph.index) && (
                  <div className="space-y-0.5 pl-4 border-l-2 border-[var(--color-border)]">
                    {paragraph.sentences.map((sentence) => (
                      <div
                        key={sentence.id}
                        className="group relative bg-[var(--color-surface)] rounded-lg p-2 hover:bg-[var(--color-surface-hover)] transition-colors"
                      >
                        {editingSentenceId === sentence.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="w-full p-2 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] resize-none"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => {
                                  setEditingSentenceId(null);
                                  setEditingText('');
                                }}
                                className="px-3 py-1.5 rounded text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                              >
                                取消
                              </button>
                              <button
                                onClick={() => handleEditSentence(sentence.id, editingText)}
                                disabled={isSaving}
                                className="px-3 py-1.5 rounded text-sm bg-[var(--color-primary)] text-[var(--color-primary-foreground)] disabled:opacity-50 flex items-center gap-1"
                              >
                                {isSaving ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Save size={14} />
                                )}
                                保存
                              </button>
                            </div>
                          </div>
                        ) : (
                        <>
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-[var(--color-text-muted)] mt-1">
                              {sentence.sentence_index + 1}.
                            </span>
                            <p className="flex-1 text-[var(--color-text)]">
                              {sentence.text}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingSentenceId(sentence.id);
                                setEditingText(sentence.text);
                              }}
                              className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                              title="编辑"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => openInsertDialog(sentence.id, 'before')}
                              className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                              title="在前面插入"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              onClick={() => openInsertDialog(sentence.id, 'after')}
                              className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                              title="在后面插入"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              onClick={() => openSplitDialog(sentence.id, sentence.text)}
                              className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                              title="分割句子"
                            >
                              <Scissors size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteSentence(sentence.id)}
                              className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-error)] hover:text-[var(--color-error)]"
                              title="删除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                )}
                <button
                  onClick={() => {
                    const lastSentence = paragraph.sentences[paragraph.sentences.length - 1];
                    if (lastSentence) {
                      openInsertDialog(lastSentence.id, 'after');
                      setInsertNewParagraph(true);
                    }
                  }}
                  className="mt-2 ml-4 px-3 py-1.5 rounded text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] flex items-center gap-1"
                >
                  <ArrowDownToLine size={14} />
                  在段落后插入新段落
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="text-sm text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1.5 text-[var(--color-success)]">
            <Check size={14} />
            已保存
          </span>
        </div>

        <div className="text-sm text-[var(--color-text-muted)]">
          {sentences.length} 个句子 • {sortedParagraphs.length} 个段落
        </div>
      </div>

      {/* Insert Dialog */}
      <Dialog open={showInsertDialog} onClose={() => setShowInsertDialog(false)} title="插入句子">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
              句子内容
            </label>
            <textarea
              value={insertText}
              onChange={(e) => setInsertText(e.target.value)}
              className="w-full p-2 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] resize-none"
              rows={3}
              placeholder="输入句子内容..."
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={insertNewParagraph}
                onChange={(e) => setInsertNewParagraph(e.target.checked)}
                className="rounded"
              />
              新建段落
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowInsertDialog(false)}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleInsertSentence}
              disabled={isSaving || !insertText.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-40"
            >
              {isSaving ? '插入中...' : '插入'}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Split Dialog */}
      <Dialog open={showSplitDialog} onClose={() => setShowSplitDialog(false)} title="分割句子">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
              分割位置 (字符索引: {splitPosition})
            </label>
            <input
              type="range"
              min={1}
              max={(sentences.find(s => s.id === splitTargetId)?.text.length || 1) - 1}
              value={splitPosition}
              onChange={(e) => setSplitPosition(Number(e.target.value))}
              className="w-full"
            />
            <div className="mt-2 p-2 rounded bg-[var(--color-surface)] text-sm text-[var(--color-text-muted)]">
              {(() => {
                const sentence = sentences.find(s => s.id === splitTargetId);
                if (!sentence) return '';
                const first = sentence.text.substring(0, splitPosition);
                const second = sentence.text.substring(splitPosition);
                return (
                  <div>
                    <div>{first}<span className="bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">|</span>{second}</div>
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={splitNewParagraph}
                onChange={(e) => setSplitNewParagraph(e.target.checked)}
                className="rounded"
              />
              第二部分新建段落
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowSplitDialog(false)}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSplitSentence}
              disabled={isSaving}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-40"
            >
              {isSaving ? '分割中...' : '分割'}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showConfirmDialog}
        title="有未保存的更改"
        message="您有正在编辑的句子，确定要关闭吗？这些更改将会丢失。"
        confirmText="放弃更改"
        cancelText="继续编辑"
        onConfirm={handleConfirmDiscard}
        onClose={handleCancelClose}
      />

      {/* Delete All Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteAllDialog}
        title="删除所有内容"
        message="确定要删除所有句子吗？此操作无法恢复。"
        confirmText="删除所有内容"
        cancelText="取消"
        onConfirm={handleDeleteAll}
        onClose={() => setShowDeleteAllDialog(false)}
        danger
      />
    </div>
  );
}
