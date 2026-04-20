import { getUnsavedChanges } from '@/api';
import { ConfirmDialog } from '@/components/Dialog';
import SentenceList from '@/components/TextEditor/SentenceList';
import { useApp } from '@/store/AppContext';
import { Check, Loader2, Save, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface TextEditorProps {
  onClose?: () => void;
}

export default function TextEditor({ onClose }: TextEditorProps) {
  const { currentRecord, handleEditText, fetchCurrentRecord } = useApp();

  const [editingText, setEditingText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isCheckingChanges, setIsCheckingChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [editResult, setEditResult] = useState<any>(null);
  const [modifiedSentences, setModifiedSentences] = useState<Set<number>>(new Set());

  const savedTextRef = useRef('');

  // Split text into paragraphs for paragraph-level editing
  const splitIntoParagraphs = (text: string): string[] => {
    return text.split(/\n+/).filter(p => p.trim());
  };

  // Join paragraphs back into text
  const joinParagraphs = (paragraphs: string[]): string => {
    return paragraphs.join('\n\n');
  };

  // Get current paragraphs
  const getCurrentParagraphs = (): string[] => {
    return splitIntoParagraphs(editingText);
  };

  // Get flat sentence list for backward compatibility (use backend splitting)
  const getCurrentSentences = (): string[] => {
    // For display purposes, just split by sentences simply
    // Backend will handle proper sentence splitting
    return editingText
      .split(/([.!?]+)\s*/)
      .filter((part, index, arr) => {
        return part.trim() !== '' || (index > 0 && index % 2 === 1);
      })
      .reduce((acc: string[], part, index) => {
        if (index > 0 && index % 2 === 1 && /[.!?]+/.test(part)) {
          const lastText = acc.pop() || '';
          acc.push(lastText + part);
        } else if (part.trim()) {
          acc.push(part);
        }
        return acc;
      }, [])
      .filter(sentence => sentence.trim().length > 0);
  };

  // Get paragraph boundaries for sentence list
  const getParagraphBoundaries = (): Array<{ index: number; isFirst: boolean; isLast: boolean }> => {
    const paragraphs = getCurrentParagraphs();
    const boundaries: Array<{ index: number; isFirst: boolean; isLast: boolean }> = [];
    let globalIndex = 0;

    for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
      const paraSentences = paragraphs[pIndex]
        .split(/([.!?]+)\s*/)
        .filter((part, index, arr) => {
          return part.trim() !== '' || (index > 0 && index % 2 === 1);
        })
        .reduce((acc: string[], part, index) => {
          if (index > 0 && index % 2 === 1 && /[.!?]+/.test(part)) {
            const lastText = acc.pop() || '';
            acc.push(lastText + part);
          } else if (part.trim()) {
            acc.push(part);
          }
          return acc;
        }, [])
        .filter(sentence => sentence.trim().length > 0);

      for (let sIndex = 0; sIndex < paraSentences.length; sIndex++) {
        boundaries.push({
          index: globalIndex + sIndex,
          isFirst: sIndex === 0,
          isLast: sIndex === paraSentences.length - 1
        });
      }

      globalIndex += paraSentences.length;
    }

    return boundaries;
  };

  // Initialize with current record text
  useEffect(() => {
    if (currentRecord?.ocr_text) {
      const text = currentRecord.ocr_text;
      setEditingText(text);
      setOriginalText(text);
      savedTextRef.current = text;
      setHasChanges(false);
      setModifiedSentences(new Set());
    }
  }, [currentRecord?.id, currentRecord?.ocr_text]);

  // Check for unsaved changes periodically
  useEffect(() => {
    if (!currentRecord?.id) return;

    const checkUnsaved = async () => {
      if (isCheckingChanges) return;
      setIsCheckingChanges(true);
      try {
        const result = await getUnsavedChanges(currentRecord.id);
        setHasChanges(result.hasUnsavedChanges);
      } catch (error) {
        console.error('Failed to check unsaved changes:', error);
      } finally {
        setIsCheckingChanges(false);
      }
    };

    checkUnsaved();
    const interval = setInterval(checkUnsaved, 5000);
    return () => clearInterval(interval);
  }, [currentRecord?.id]);

  // Warn before closing if there are unsaved changes
  const handleBeforeClose = (e: BeforeUnloadEvent) => {
    if (hasUnsavedUserChanges()) {
      e.preventDefault();
      e.returnValue = '';
    }
  };

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeClose);
    return () => window.removeEventListener('beforeunload', handleBeforeClose);
  }, [hasChanges]);

  function hasUnsavedUserChanges() {
    return editingText !== savedTextRef.current;
  }

  function handleTextChange(newText: string) {
    setEditingText(newText);
  }

  function handleSentenceEdit(index: number, newText: string) {
    // Get current paragraphs
    const paragraphs = getCurrentParagraphs();

    // Find which paragraph contains the sentence at the given index
    let currentGlobalIndex = 0;
    let targetParaIndex = -1;

    for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
      const paraSentences = paragraphs[pIndex]
        .split(/([.!?]+)\s*/)
        .filter((part, index, arr) => {
          return part.trim() !== '' || (index > 0 && index % 2 === 1);
        })
        .reduce((acc: string[], part, index) => {
          if (index > 0 && index % 2 === 1 && /[.!?]+/.test(part)) {
            const lastText = acc.pop() || '';
            acc.push(lastText + part);
          } else if (part.trim()) {
            acc.push(part);
          }
          return acc;
        }, [])
        .filter(sentence => sentence.trim().length > 0);

      if (currentGlobalIndex + paraSentences.length > index) {
        targetParaIndex = pIndex;
        break;
      }
      currentGlobalIndex += paraSentences.length;
    }

    if (targetParaIndex !== -1) {
      // Reconstruct the target paragraph with the edited sentence
      const paraSentences = paragraphs[targetParaIndex]
        .split(/([.!?]+)\s*/)
        .filter((part, index, arr) => {
          return part.trim() !== '' || (index > 0 && index % 2 === 1);
        })
        .reduce((acc: string[], part, index) => {
          if (index > 0 && index % 2 === 1 && /[.!?]+/.test(part)) {
            const lastText = acc.pop() || '';
            acc.push(lastText + part);
          } else if (part.trim()) {
            acc.push(part);
          }
          return acc;
        }, [])
        .filter(sentence => sentence.trim().length > 0);

      // Find the sentence index within the paragraph
      const sentenceIndexInPara = index - currentGlobalIndex;
      paraSentences[sentenceIndexInPara] = newText;

      // Reconstruct the paragraph
      const updatedPara = paraSentences.join(' ').replace(/\s{2,}/g, ' ').trim();

      // Update the paragraphs array
      const updatedParagraphs = [...paragraphs];
      updatedParagraphs[targetParaIndex] = updatedPara;

      // Join all paragraphs back
      const newFullText = joinParagraphs(updatedParagraphs);
      handleTextChange(newFullText);
    }

    // Track modified sentences
    const originalSentences = getCurrentSentences();
    const newSentences = getCurrentSentences();
    const newModifiedSentences = new Set<number>();

    newSentences.forEach((sentence, idx) => {
      if (sentence.trim() !== (originalSentences[idx] || '').trim()) {
        newModifiedSentences.add(idx);
      }
    });

    setModifiedSentences(newModifiedSentences);
  }

  async function handleSave() {
    if (!currentRecord?.id) return;

    if (!hasUnsavedUserChanges()) {
      toast.info('没有需要保存的更改');
      return;
    }

    // Check if user is deleting all content
    const trimmedText = editingText.trim();
    if (trimmedText === '') {
      setShowDeleteAllDialog(true);
      return;
    }

    setIsSaving(true);
    try {
      const result = await handleEditText(editingText);

      if (result) {
        savedTextRef.current = editingText;
        setEditResult(result);
        setOriginalText(editingText);
        setModifiedSentences(new Set());

        // Show success message with details
        if (result.summary.hasChanges) {
          toast.success(
            `保存成功！${result.summary.modifiedCount} 个句子已修改，` +
            `${result.clearResults?.analysesCleared || 0} 个分析已清除，` +
            `${result.clearResults?.translationsCleared || 0} 个翻译已清除`
          );
        } else {
          toast.success('保存成功！');
        }

        // Refresh record data
        await fetchCurrentRecord();
      }
    } catch (error) {
      console.error('Failed to save text:', error);
      toast.error(
        `保存失败：${error instanceof Error ? error.message : '未知错误'}`
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDeleteAll() {
    if (!currentRecord?.id) return;

    setIsSaving(true);
    setShowDeleteAllDialog(false);
    
    try {
      const result = await handleEditText('');

      if (result) {
        savedTextRef.current = '';
        setEditResult(result);
        setEditingText('');
        setOriginalText('');
        setModifiedSentences(new Set());

        toast.success('所有内容已删除');
        
        // Refresh record data
        await fetchCurrentRecord();
      }
    } catch (error) {
      console.error('Failed to delete all content:', error);
      toast.error(
        `删除失败：${error instanceof Error ? error.message : '未知错误'}`
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    setEditingText(originalText);
    setModifiedSentences(new Set());
    toast.info('已重置为原始文本');
  }

  function handleDeleteSentence(index: number) {
    const paragraphs = getCurrentParagraphs();
    
    // Find which paragraph contains the sentence
    let currentGlobalIndex = 0;
    let targetParaIndex = -1;
    
    for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
      const paraSentences = paragraphs[pIndex]
        .split(/([.!?]+)\s*/)
        .filter((part, index, arr) => {
          return part.trim() !== '' || (index > 0 && index % 2 === 1);
        })
        .reduce((acc: string[], part, index) => {
          if (index > 0 && index % 2 === 1 && /[.!?]+/.test(part)) {
            const lastText = acc.pop() || '';
            acc.push(lastText + part);
          } else if (part.trim()) {
            acc.push(part);
          }
          return acc;
        }, [])
        .filter(sentence => sentence.trim().length > 0);
      
      if (currentGlobalIndex + paraSentences.length > index) {
        targetParaIndex = pIndex;
        break;
      }
      currentGlobalIndex += paraSentences.length;
    }
    
    if (targetParaIndex !== -1) {
      const paraSentences = paragraphs[targetParaIndex]
        .split(/([.!?]+)\s*/)
        .filter((part, index, arr) => {
          return part.trim() !== '' || (index > 0 && index % 2 === 1);
        })
        .reduce((acc: string[], part, index) => {
          if (index > 0 && index % 2 === 1 && /[.!?]+/.test(part)) {
            const lastText = acc.pop() || '';
            acc.push(lastText + part);
          } else if (part.trim()) {
            acc.push(part);
          }
          return acc;
        }, [])
        .filter(sentence => sentence.trim().length > 0);
      
      const sentenceIndexInPara = index - currentGlobalIndex;
      paraSentences.splice(sentenceIndexInPara, 1);
      
      const updatedPara = paraSentences.join(' ').replace(/\s{2,}/g, ' ').trim();
      
      const updatedParagraphs = [...paragraphs];
      if (updatedPara) {
        updatedParagraphs[targetParaIndex] = updatedPara;
      } else {
        updatedParagraphs.splice(targetParaIndex, 1);
      }
      
      const newFullText = joinParagraphs(updatedParagraphs);
      handleTextChange(newFullText);
      toast.info('句子已删除（保存后生效）');
    }
  }

  function handleInsertBefore(index: number) {
    const paragraphs = getCurrentParagraphs();
    
    // Find which paragraph contains the sentence
    let currentGlobalIndex = 0;
    let targetParaIndex = -1;
    
    for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
      const paraSentences = paragraphs[pIndex]
        .split(/([.!?]+)\s*/)
        .filter((part, index, arr) => {
          return part.trim() !== '' || (index > 0 && index % 2 === 1);
        })
        .reduce((acc: string[], part, index) => {
          if (index > 0 && index % 2 === 1 && /[.!?]+/.test(part)) {
            const lastText = acc.pop() || '';
            acc.push(lastText + part);
          } else if (part.trim()) {
            acc.push(part);
          }
          return acc;
        }, [])
        .filter(sentence => sentence.trim().length > 0);
      
      if (currentGlobalIndex + paraSentences.length > index) {
        targetParaIndex = pIndex;
        break;
      }
      currentGlobalIndex += paraSentences.length;
    }
    
    if (targetParaIndex !== -1) {
      // Insert new paragraph before the target paragraph
      const updatedParagraphs = [...paragraphs];
      updatedParagraphs.splice(targetParaIndex, 0, 'New sentence.');
      
      const newFullText = joinParagraphs(updatedParagraphs);
      handleTextChange(newFullText);
      
      toast.info('新段落已插入');
    }
  }

  function handleInsertAfter(index: number) {
    const paragraphs = getCurrentParagraphs();
    
    // Find which paragraph contains the sentence
    let currentGlobalIndex = 0;
    let targetParaIndex = -1;
    
    for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
      const paraSentences = paragraphs[pIndex]
        .split(/([.!?]+)\s*/)
        .filter((part, index, arr) => {
          return part.trim() !== '' || (index > 0 && index % 2 === 1);
        })
        .reduce((acc: string[], part, index) => {
          if (index > 0 && index % 2 === 1 && /[.!?]+/.test(part)) {
            const lastText = acc.pop() || '';
            acc.push(lastText + part);
          } else if (part.trim()) {
            acc.push(part);
          }
          return acc;
        }, [])
        .filter(sentence => sentence.trim().length > 0);
      
      if (currentGlobalIndex + paraSentences.length > index) {
        targetParaIndex = pIndex;
        break;
      }
      currentGlobalIndex += paraSentences.length;
    }
    
    if (targetParaIndex !== -1) {
      // Insert new paragraph after the target paragraph
      const updatedParagraphs = [...paragraphs];
      updatedParagraphs.splice(targetParaIndex + 1, 0, 'New sentence.');
      
      const newFullText = joinParagraphs(updatedParagraphs);
      handleTextChange(newFullText);
      
      toast.info('新段落已插入');
    }
  }

  function handleSplitSentence(index: number) {
    const paragraphs = getCurrentParagraphs();
    const sentences = getCurrentSentences();
    const sentence = sentences[index];
    
    if (!sentence) return;
    
    const midPoint = Math.floor(sentence.length / 2);
    const firstPart = sentence.substring(0, midPoint).trim();
    const secondPart = sentence.substring(midPoint).trim();
    
    if (!firstPart || !secondPart) {
      toast.error('句子太短，无法拆分');
      return;
    }
    
    // Find which paragraph contains the sentence
    let currentGlobalIndex = 0;
    let targetParaIndex = -1;
    
    for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
      const paraSentences = paragraphs[pIndex]
        .split(/([.!?]+)\s*/)
        .filter((part, index, arr) => {
          return part.trim() !== '' || (index > 0 && index % 2 === 1);
        })
        .reduce((acc: string[], part, index) => {
          if (index > 0 && index % 2 === 1 && /[.!?]+/.test(part)) {
            const lastText = acc.pop() || '';
            acc.push(lastText + part);
          } else if (part.trim()) {
            acc.push(part);
          }
          return acc;
        }, [])
        .filter(sentence => sentence.trim().length > 0);
      
      if (currentGlobalIndex + paraSentences.length > index) {
        targetParaIndex = pIndex;
        break;
      }
      currentGlobalIndex += paraSentences.length;
    }
    
    if (targetParaIndex !== -1) {
      const paraSentences = paragraphs[targetParaIndex]
        .split(/([.!?]+)\s*/)
        .filter((part, index, arr) => {
          return part.trim() !== '' || (index > 0 && index % 2 === 1);
        })
        .reduce((acc: string[], part, index) => {
          if (index > 0 && index % 2 === 1 && /[.!?]+/.test(part)) {
            const lastText = acc.pop() || '';
            acc.push(lastText + part);
          } else if (part.trim()) {
            acc.push(part);
          }
          return acc;
        }, [])
        .filter(sentence => sentence.trim().length > 0);
      
      const sentenceIndexInPara = index - currentGlobalIndex;
      paraSentences.splice(sentenceIndexInPara, 1, firstPart, secondPart);
      
      const updatedPara = paraSentences.join(' ').replace(/\s{2,}/g, ' ').trim();
      
      const updatedParagraphs = [...paragraphs];
      updatedParagraphs[targetParaIndex] = updatedPara;
      
      const newFullText = joinParagraphs(updatedParagraphs);
      handleTextChange(newFullText);
      toast.info('句子已拆分（保存后生效）');
    }
  }

  function handleConfirmClose() {
    if (hasUnsavedUserChanges()) {
      setShowConfirmDialog(true);
    } else {
      onClose?.();
    }
  }

  function handleConfirmDiscard() {
    setShowConfirmDialog(false);
    onClose?.();
  }

  function handleCancelClose() {
    setShowConfirmDialog(false);
  }

  if (!currentRecord) return null;

  const sentences = getCurrentSentences();
  const paragraphBoundaries = getParagraphBoundaries();

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
            onClick={handleReset}
            disabled={isSaving || !hasUnsavedUserChanges()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)]"
            title="重置为原始文本"
          >
            重置
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedUserChanges()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-primary-foreground)] flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save size={16} />
                保存
              </>
            )}
          </button>

          <button
            onClick={handleConfirmClose}
            className="p-2 rounded-lg transition-colors hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            title="关闭"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Sentence List Editor */}
      <div className="flex-1 overflow-hidden p-4">
        <SentenceList
          sentences={sentences}
          modifiedSentences={modifiedSentences}
          onEdit={handleSentenceEdit}
          onDelete={handleDeleteSentence}
          onInsertBefore={handleInsertBefore}
          onInsertAfter={handleInsertAfter}
          onSplit={handleSplitSentence}
          paragraphBoundaries={paragraphBoundaries}
        />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="text-sm text-[var(--color-text-muted)]">
          {hasUnsavedUserChanges() && (
            <span className="flex items-center gap-1.5 text-[var(--color-warning)]">
              <span className="w-2 h-2 rounded-full bg-[var(--color-warning)]" />
              有未保存的更改 ({modifiedSentences.size} 个句子已修改)
            </span>
          )}
          {!hasUnsavedUserChanges() && (
            <span className="flex items-center gap-1.5 text-[var(--color-success)]">
              <Check size={14} />
              已保存
            </span>
          )}
        </div>

        <div className="text-sm text-[var(--color-text-muted)]">
          {editingText.length} 字符 • {sentences.length} 个句子
        </div>
      </div>

      {/* Last Edit Result Info */}
      {editResult && editResult.summary.hasChanges && (
        <div className="px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="text-sm text-[var(--color-text-muted)]">
            上次保存结果：
            {editResult.summary.modifiedCount > 0 && (
              <span className="ml-2">
                {editResult.summary.modifiedCount} 个句子修改，
              </span>
            )}
            {editResult.summary.deletedCount > 0 && (
              <span className="ml-2">
                {editResult.summary.deletedCount} 个句子删除，
              </span>
            )}
            {editResult.summary.addedCount > 0 && (
              <span className="ml-2">
                {editResult.summary.addedCount} 个句子新增，
              </span>
            )}
            {editResult.clearResults && (
              <span>
                {editResult.clearResults.analysesCleared} 个分析清除，
                {editResult.clearResults.translationsCleared} 个翻译清除
              </span>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showConfirmDialog}
        title="有未保存的更改"
        message="您有未保存的更改，确定要关闭吗？这些更改将会丢失。"
        confirmText="放弃更改"
        cancelText="继续编辑"
        onConfirm={handleConfirmDiscard}
        onClose={handleCancelClose}
      />

      {/* Delete All Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteAllDialog}
        title="删除所有内容"
        message="确定要删除所有文本内容吗？此操作将同时删除相关的图片、翻译和分析内容，且无法恢复。"
        confirmText="删除所有内容"
        cancelText="取消"
        onConfirm={handleConfirmDeleteAll}
        onClose={() => setShowDeleteAllDialog(false)}
        danger
      />
    </div>
  );
}
