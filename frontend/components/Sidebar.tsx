import { ConfirmDialog } from '@/components/Dialog';
import { useApp } from '@/store/AppContext';
import { ChevronsLeft, ChevronsRight, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function formatDate(dateString: string) {
  const date = new Date(dateString + 'Z');
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Sidebar() {
  const {
    sessions, currentSessionId, sidebarCollapsed,
    selectSession, createNewSession, removeSession, renameSession, toggleSidebar,
  } = useApp();

  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus edit input
  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  function startEdit(id: number, title: string) {
    setEditingId(id);
    setEditValue(title);
    setMenuOpenId(null);
  }

  async function finishEdit() {
    if (editingId && editValue.trim()) {
      await renameSession(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  }

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  function handleDelete(id: number) {
    setMenuOpenId(null);
    setDeleteConfirmId(id);
  }

  async function onDeleteConfirm() {
    if (deleteConfirmId !== null) {
      await removeSession(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  }

  return (
    <aside
      className={`flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-sidebar)] transition-all duration-300 ${
        sidebarCollapsed ? 'w-0 min-w-0 overflow-hidden border-r-0' : 'w-64 min-w-64'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
        <button
          onClick={createNewSession}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--color-primary)] text-white rounded-md hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          <Plus size={14} />
          <span>新建会话</span>
        </button>
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded hover:bg-black/5 text-[var(--color-text-muted)]"
          title="收缩侧栏"
        >
          <ChevronsLeft size={16} />
        </button>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">
            暂无会话
          </div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              onClick={() => { if (editingId !== session.id) selectSession(session.id); }}
              className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-[var(--color-border)] hover:bg-white/60 transition-colors ${
                currentSessionId === session.id ? 'bg-white shadow-sm' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                {editingId === session.id ? (
                  <input
                    ref={editRef}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={finishEdit}
                    onKeyDown={e => {
                      if (e.key === 'Enter') finishEdit();
                      if (e.key === 'Escape') { setEditingId(null); setEditValue(''); }
                    }}
                    onClick={e => e.stopPropagation()}
                    className="w-full px-2 py-0.5 text-sm border border-[var(--color-primary)] rounded outline-none"
                  />
                ) : (
                  <div
                    className="text-sm font-medium truncate"
                    onDoubleClick={e => { e.stopPropagation(); startEdit(session.id, session.title); }}
                    title="双击编辑名称"
                  >
                    {session.title}
                  </div>
                )}
                <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {formatDate(session.updated_at)}
                </div>
              </div>

              {/* Menu button */}
              <div className="relative" ref={menuOpenId === session.id ? menuRef : undefined}>
                <button
                  onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === session.id ? null : session.id); }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-opacity"
                >
                  <MoreHorizontal size={14} />
                </button>
                {menuOpenId === session.id && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-[var(--color-border)] z-50 min-w-[100px]">
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(session.id); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--color-danger)] hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={14} />
                      删除
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={onDeleteConfirm}
        title="删除会话"
        message="确定要删除这个会话吗？会话中的所有记录和分析结果将一并删除。"
        confirmText="删除"
        danger
      />
    </aside>
  );
}

// Small expand button shown when sidebar is collapsed
export function SidebarExpandButton() {
  const { sidebarCollapsed, toggleSidebar } = useApp();
  if (!sidebarCollapsed) return null;
  return (
    <button
      onClick={toggleSidebar}
      className="fixed top-14 left-2 z-30 p-1.5 bg-white rounded-md shadow border border-[var(--color-border)] hover:bg-gray-50 text-[var(--color-text-muted)]"
      title="展开侧栏"
    >
      <ChevronsRight size={16} />
    </button>
  );
}
