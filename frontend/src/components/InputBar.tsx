import {
  useState,
  useRef,
  useCallback,
  useLayoutEffect,
} from 'react';
import { Upload, Send } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { toast } from 'sonner';

export default function InputBar() {
  const { handleSendText, handleUploadImage, loading } = useApp();
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const TEXTAREA_MIN_HEIGHT = 38;
  const TEXTAREA_MAX_HEIGHT = 220;

  const canSend = text.trim().length > 0 && !loading;

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT);
    el.style.height = `${Math.max(nextHeight, TEXTAREA_MIN_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
  }, [TEXTAREA_MIN_HEIGHT, TEXTAREA_MAX_HEIGHT]);

  useLayoutEffect(() => {
    adjustTextareaHeight();
  }, [text, adjustTextareaHeight]);

  const onSend = useCallback(async () => {
    const t = text.trim();
    if (!t) return;
    try {
      await handleSendText(t);
      setText('');
      toast.success('文本处理成功');
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.style.height = `${TEXTAREA_MIN_HEIGHT}px`;
          el.style.overflowY = 'hidden';
        }
      });
    } catch (err: unknown) {
      toast.error(`处理失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  }, [text, handleSendText, TEXTAREA_MIN_HEIGHT]);

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.info('正在上传并识别图片...');
      await handleUploadImage(file);
      toast.success('图片处理成功');
    } catch (err: unknown) {
      toast.error(`上传失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
    // Reset input so same file can be re-uploaded
    if (fileRef.current) fileRef.current.value = '';
  }, [handleUploadImage]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  }, [canSend, onSend]);

  return (
    <div className="border-t border-[var(--color-border)] bg-white px-4 py-3 shrink-0">
      <div className="flex items-center gap-2 max-w-4xl mx-auto">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg"
          className="hidden"
          onChange={onFileChange}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-[var(--color-text-muted)] hover:bg-gray-100 hover:text-[var(--color-text-secondary)] transition-colors disabled:opacity-50"
          title="上传图片"
        >
          <Upload size={18} />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="粘贴文本或点击左侧上传图片..."
          rows={1}
          className="flex-1 resize-none rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] transition-colors"
          style={{ minHeight: TEXTAREA_MIN_HEIGHT, overflowY: 'hidden' }}
        />

        <button
          onClick={onSend}
          disabled={!canSend}
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="发送分析"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
