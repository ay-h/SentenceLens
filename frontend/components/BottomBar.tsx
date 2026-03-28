import { ConfirmDialog } from '@/components/Dialog';
import { useApp } from '@/store/AppContext';
import { Loader2, Search, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function BottomBar() {
  const {
    selectedSentence, selectedAnalysis,
    cancelSelection, handleAnalyze, handleDeleteAnalysis, loading,
  } = useApp();
  const [analyzing, setAnalyzing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!selectedSentence) return null;

  const hasAnalysis = !!selectedAnalysis;

  async function onAnalyze() {
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

  async function onDeleteConfirm() {
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
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--color-border)] bg-white shrink-0">
      <div className="flex-1 min-w-0 text-sm text-[var(--color-text-secondary)] truncate mr-4">
        已选中：{selectedSentence}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={cancelSelection}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-gray-50 transition-colors"
        >
          <X size={14} />
          取消
        </button>

        <button
          onClick={onAnalyze}
          disabled={analyzing || loading}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
        >
          {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {analyzing ? '分析中...' : '分析句子'}
        </button>

        {hasAnalysis && (
          <button
            onClick={() => setDeleteOpen(true)}
            disabled={deleting || loading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger-hover)] transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {deleting ? '删除中...' : '删除分析'}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDeleteConfirm}
        title="删除分析"
        message="确定要删除这句的分析结果吗？"
        confirmText="删除"
        danger
      />
    </div>
  );
}
