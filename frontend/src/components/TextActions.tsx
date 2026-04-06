import { ConfirmDialog, PromptDialog } from '@/components/Dialog';
import { useApp } from '@/store/AppContext';
import { Edit3, Languages, Loader2, Trash2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function TextActions() {
  const {
    currentRecord, translations, isEditingText,
    showTranslation, toggleTranslation,
    handleRenameRecord, handleDeleteRecord,
    handleTranslate, handleSmartTranslate,
    toggleTextEditing, loading,
  } = useApp();

  const [translating, setTranslating] = useState(false);
  const [smartTranslating, setSmartTranslating] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!currentRecord) return null;

  async function onRenameConfirm(name: string) {
    try {
      await handleRenameRecord(name);
      toast.success('重命名成功');
    } catch {
      toast.error('重命名失败');
    }
  }

  async function onDeleteConfirm() {
    try {
      await handleDeleteRecord();
      toast.success('记录已删除');
    } catch {
      toast.error('删除失败');
    }
  }

  async function onTranslate() {
    setTranslating(true);
    try {
      toast.info('正在翻译...');
      await handleTranslate();
      toast.success('翻译完成');
    } catch (err: unknown) {
      toast.error(`翻译失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setTranslating(false);
    }
  }

  async function onSmartTranslate() {
    setSmartTranslating(true);
    try {
      toast.info('正在智能翻译已修改的句子...');
      const result = await handleSmartTranslate();
      if (result) {
        if (result.translated_count > 0) {
          toast.success(`智能翻译完成！翻译了 ${result.translated_count} 个句子`);
        } else {
          toast.info('没有需要翻译的句子');
        }
        if (result.failed_count > 0) {
          toast.warning(`${result.failed_count} 个句子翻译失败`);
        }
      }
    } catch (err: unknown) {
      toast.error(`智能翻译失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setSmartTranslating(false);
    }
  }

  function toggleEditMode() {
    toggleTextEditing(!isEditingText);
    toast.info(isEditingText ? '退出编辑模式' : '进入编辑模式');
  }

  const hasTranslations = translations.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-white shrink-0">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setRenameOpen(true)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-gray-50 transition-colors"
        >
          <Edit3 size={12} />
          重命名
        </button>

        <button
          onClick={toggleEditMode}
          disabled={translating || smartTranslating || loading}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border transition-colors disabled:opacity-50 ${
            isEditingText
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
              : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-gray-50'
          }`}
        >
          <Edit3 size={12} />
          {isEditingText ? '退出编辑' : '编辑文本'}
        </button>

        <button
          onClick={onTranslate}
          disabled={translating || smartTranslating || loading}
          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {translating ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
          翻译全部
        </button>

        <button
          onClick={onSmartTranslate}
          disabled={translating || smartTranslating || loading}
          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-primary-foreground)] transition-colors disabled:opacity-50"
        >
          {smartTranslating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          智能翻译
        </button>

        <span className="w-px h-4 bg-[var(--color-border)] mx-1" />

        <button
          onClick={() => setDeleteOpen(true)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-red-50 hover:text-red-700 transition-colors"
        >
          <Trash2 size={12} />
          删除
        </button>
      </div>

      {hasTranslations && (
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={showTranslation}
            onChange={e => toggleTranslation(e.target.checked)}
            className="rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
          />
          显示翻译
        </label>
      )}

      <PromptDialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        onConfirm={onRenameConfirm}
        title="重命名记录"
        message="请输入新的记录名称"
        defaultValue={currentRecord.name}
        placeholder="记录名称"
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDeleteConfirm}
        title="删除记录"
        message="确定要删除这条记录吗？删除后无法恢复。"
        confirmText="删除"
        danger
      />
    </div>
  );
}
