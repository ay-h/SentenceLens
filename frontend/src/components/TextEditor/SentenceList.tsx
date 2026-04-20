import React from 'react';
import SentenceEditor from './SentenceEditor';
import './SentenceList.css';

interface SentenceListProps {
  sentences: string[];
  modifiedSentences: Set<number>;
  onEdit: (index: number, newText: string) => void;
  onDelete?: (index: number) => void;
  onInsertBefore?: (index: number) => void;
  onInsertAfter?: (index: number) => void;
  onSplit?: (index: number) => void;
  paragraphBoundaries?: Array<{ index: number; isFirst: boolean; isLast: boolean }>;
}

export default function SentenceList({ 
  sentences, 
  modifiedSentences, 
  onEdit,
  onDelete,
  onInsertBefore,
  onInsertAfter,
  onSplit,
  paragraphBoundaries
}: SentenceListProps) {
  const getBoundaryInfo = (index: number) => {
    if (!paragraphBoundaries) {
      return { isFirst: false, isLast: false };
    }
    const boundary = paragraphBoundaries.find(b => b.index === index);
    return boundary ? { isFirst: boundary.isFirst, isLast: boundary.isLast } : { isFirst: false, isLast: false };
  };

  return (
    <div className="sentence-list">
      {sentences.map((sentence, index) => {
        const { isFirst, isLast } = getBoundaryInfo(index);
        return (
          <SentenceEditor
            key={index}
            sentence={sentence}
            index={index}
            isModified={modifiedSentences.has(index)}
            onEdit={onEdit}
            onDelete={onDelete}
            onInsertBefore={onInsertBefore}
            onInsertAfter={onInsertAfter}
            onSplit={onSplit}
            isFirstInParagraph={isFirst}
            isLastInParagraph={isLast}
          />
        );
      })}
      
      {sentences.length === 0 && (
        <div className="sentence-list-empty">
          <div className="empty-state">
            <p className="empty-title">没有句子</p>
            <p className="empty-description">
              当前文本中没有可编辑的句子内容
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
