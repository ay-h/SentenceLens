import { useApp } from '@/store/AppContext';
import type { SentenceAnalysis } from '@/types';

export default function TextDisplay() {
  const {
    sentences, currentRecord, translations, showTranslation,
    selectedSentence, handleSelectSentence,
  } = useApp();

  if (!currentRecord || sentences.length === 0) return null;

  // Build translation map
  const translationMap: Record<number, string> = {};
  translations.forEach(t => {
    translationMap[t.sentence_index] = t.translated_sentence;
  });

  // Build analysis map for quick lookup
  const analyses = currentRecord.analyses || [];

  function findAnalysis(sentence: string): SentenceAnalysis | null {
    const normalized = sentence.split(' ').join(' ');
    const found = analyses.find(a => {
      if (!a.sentence) return false;
      return a.sentence.split(' ').join(' ') === normalized;
    });
    return found || null;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {sentences.map((sentence, index) => {
          const analysis = findAnalysis(sentence);
          const isSelected = selectedSentence === sentence.trim();
          const isAnalyzed = !!analysis;
          const translation = translationMap[index];

          return (
            <div key={index} className="group">
              <span
                onClick={() => handleSelectSentence(sentence.trim(), analysis)}
                className={`inline cursor-pointer rounded px-1 py-0.5 text-[19px] leading-9 text-gray-900 transition-all ${
                  isSelected
                    ? 'bg-blue-100 text-[var(--color-primary)]'
                    : isAnalyzed
                      ? 'bg-green-50 hover:bg-green-100'
                      : 'hover:bg-gray-100'
                }`}
                style={isAnalyzed ? { borderBottom: '2px solid var(--color-success)' } : undefined}
              >
                {sentence}
              </span>
              {showTranslation && translation && (
                <div className="text-[14px] text-blue-700/70 mt-1 pl-1 leading-6">
                  {translation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
