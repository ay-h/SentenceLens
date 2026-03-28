import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between px-4 h-12 border-b border-[var(--color-border)] bg-white shrink-0">
      <span className="text-base font-semibold text-[var(--color-text-primary)]">
        English Reading Helper
      </span>
      <button
        onClick={() => navigate('/settings')}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-text-secondary)] rounded-md hover:bg-gray-100 transition-colors"
      >
        <Settings size={15} />
        设置
      </button>
    </header>
  );
}
