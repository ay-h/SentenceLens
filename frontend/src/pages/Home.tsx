import AnalysisPanel from '@/components/AnalysisPanel';
import ImageThumbnails from '@/components/ImageThumbnails';
import InputBar from '@/components/InputBar';
import Sidebar, { SidebarExpandButton } from '@/components/Sidebar';
import TextActions from '@/components/TextActions';
import TextDisplay from '@/components/TextDisplay';
import TextEditor from '@/components/TextEditor';
import QualityIndicator from '@/components/QualityIndicator';
import { useApp } from '@/store/AppContext';
import { FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getRecordQuality } from '@/api';

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)]">
      <FileText size={48} className="mb-3 opacity-40" />
      <p className="text-sm">上传图片或粘贴文本开始分析</p>
    </div>
  );
}

export default function Home() {
  const { currentRecord, sentences, restoreState, isEditingText, toggleTextEditing } = useApp();
  const initialized = useRef(false);
  const [quality, setQuality] = useState<any>(null);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    restoreState();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load quality assessment when record changes
  useEffect(() => {
    if (currentRecord?.id) {
      getRecordQuality(currentRecord.id).then(setQuality).catch(console.error);
    } else {
      setQuality(null);
    }
  }, [currentRecord?.id]);

  const hasContent = currentRecord && sentences.length > 0;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <SidebarExpandButton />

      {/* Center content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {hasContent ? (
          <>
            {isEditingText ? (
              <TextEditor onClose={() => toggleTextEditing(false)} />
            ) : (
              <>
                <ImageThumbnails />
                <TextActions />
                <TextDisplay />
              </>
            )}
          </>
        ) : (
          <>
            <ImageThumbnails />
            <EmptyState />
          </>
        )}
        <InputBar />
      </div>

      {/* Right analysis panel */}
      {currentRecord && (
        <AnalysisPanel />
      )}
    </div>
  );
}
