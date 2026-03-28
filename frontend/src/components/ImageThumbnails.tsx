import { BASE } from '@/api';
import { useApp } from '@/store/AppContext';
import { FileText } from 'lucide-react';

export default function ImageThumbnails() {
  const { records, currentRecordId, selectRecord } = useApp();

  if (records.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-x-auto shrink-0">
      {records.map(record => {
        const isActive = record.id === currentRecordId;
        const isText = record.image_path === '/placeholder/text';

        return (
          <button
            key={record.id}
            onClick={() => selectRecord(record.id)}
            title={record.name || '未命名记录'}
            className={`shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
              isActive
                ? 'border-[var(--color-primary)] shadow-md'
                : 'border-transparent hover:border-[var(--color-border-hover)]'
            }`}
          >
            {isText ? (
              <div className="w-14 h-14 flex items-center justify-center bg-white text-[var(--color-text-muted)]">
                <FileText size={20} />
              </div>
            ) : (
              <img
                src={`${BASE}${record.image_path}`}
                alt={record.name}
                className="w-14 h-14 object-cover"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
