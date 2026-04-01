import type { WordLookupState } from '@/hooks/useWordLookup';
import { Loader2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  state: WordLookupState;
  onClose: () => void;
}

export default function WordLookupPopover({ state, onClose }: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!state.visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [state.visible, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!state.visible) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use setTimeout to avoid immediate close from the dblclick that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [state.visible, onClose]);

  // Auto-position within viewport
  useEffect(() => {
    if (!state.visible || !popoverRef.current) return;
    const el = popoverRef.current;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: keep within viewport
    if (rect.right > vw - 8) {
      el.style.left = `${vw - rect.width - 8}px`;
    }
    if (rect.left < 8) {
      el.style.left = '8px';
    }

    // Vertical: if overflows bottom, show above the word
    if (rect.bottom > vh - 8) {
      const newTop = state.position.y - rect.height - 30;
      el.style.top = `${Math.max(8, newTop)}px`;
    }
  }, [state.visible, state.position, state.status]);

  if (!state.visible) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: `${state.position.x}px`,
    top: `${state.position.y + 6}px`,
    transform: 'translateX(-50%)',
    zIndex: 9999,
  };

  return createPortal(
    <div
      ref={popoverRef}
      style={style}
      className="bg-white rounded-lg shadow-xl border border-gray-200 min-w-[240px] max-w-[360px] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="font-semibold text-[15px] text-gray-900">{state.word}</span>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-2 max-h-[280px] overflow-y-auto">
        {state.status === 'loading' && (
          <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin" />
            <span>正在查询...</span>
          </div>
        )}

        {state.status === 'error' && (
          <div className="py-2 text-sm text-red-500">
            {state.error || '查词失败'}
          </div>
        )}

        {state.status === 'success' && state.definition && (
          <div className="space-y-1.5">
            {state.definition.phonetic && (
              <div className="text-[13px] text-gray-500">
                {state.definition.phonetic}
              </div>
            )}

            {state.definition.partsOfSpeech.length > 0 ? (
              <div className="space-y-1">
                {state.definition.partsOfSpeech.map((item, i) => (
                  <div key={i} className="text-sm leading-5">
                    {item.pos && (
                      <span className="inline-block mr-1.5 px-1 py-0.5 text-[11px] font-medium rounded bg-blue-50 text-blue-600">
                        {item.pos}
                      </span>
                    )}
                    <span className="text-gray-800">{item.meaning}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">暂无释义</div>
            )}
          </div>
        )}
      </div>

      {/* Footer: source indicator */}
      {state.status === 'success' && state.definition && (
        <div className="px-3 py-1.5 border-t border-gray-100 text-[11px] text-gray-400 flex items-center justify-between">
          <span>
            {state.definition.source === 'dictionary' ? '离线词库' : 'LLM'}
            {state.cached ? ' · 缓存' : ''}
          </span>
        </div>
      )}
    </div>,
    document.body,
  );
}
