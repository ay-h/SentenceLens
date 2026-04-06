import { getUnsavedChanges } from '@/api';
import { ConfirmDialog } from '@/components/Dialog';
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
  const [editResult, setEditResult] = useState<any>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedTextRef = useRef('');

  // Initialize with current record text
  useEffect(() => {
    if (currentRecord?.ocr_text) {
      const text = currentRecord.ocr_text;
      setEditingText(text);
      setOriginalText(text);
      savedTextRef.current = text;
      setHasChanges(false);
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

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setEditingText(e.target.value);
  }

  async function handleSave() {
    if (!currentRecord?.id) return;

    if (!hasUnsavedUserChanges()) {
      toast.info('没有需要保存的更改');
      return;
    }

    setIsSaving(true);
    try {
      const result = await handleEditText(editingText);

      if (result) {
        savedTextRef.current = editingText;
        setEditResult(result);

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

  function handleReset() {
    setEditingText(originalText);
    toast.info('已重置为原始文本');
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            编辑文本
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {currentRecord.name}
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

      {/* Edit Area */}
      <div className="flex-1 overflow-hidden p-4">
        <textarea
          ref={textareaRef}
          value={editingText}
          onChange={handleTextChange}
          disabled={isSaving}
          className="w-full h-full p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-mono text-base leading-relaxed"
          placeholder="编辑识别出的文本..."
          spellCheck={false}
        />
      </div>

      {/* Status Bar Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="text-sm text-[var(--color-text-muted)]">
          {hasUnsavedUserChanges() && (
            <span className="flex items-center gap-1.5 text-[var(--color-warning)]">
              <span className="w-2 h-2 rounded-full bg-[var(--color-warning)]" />
              有未保存的更改
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
          {editingText.length} 字符
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
    </div>
  );
}
