import React from 'react';
import SentenceEditor from './SentenceEditor';
import './SentenceList.css';

interface SentenceListProps {
  sentences: string[];
  modifiedSentences: Set<number>;
  onEdit: (index: number, newText: string) => void;
}

export default function SentenceList({ 
  sentences, 
  modifiedSentences, 
  onEdit
}: SentenceListProps) {
  return (
    <div className="sentence-list">
      {sentences.map((sentence, index) => (
        <SentenceEditor
          key={index}
          sentence={sentence}
          index={index}
          isModified={modifiedSentences.has(index)}
          onEdit={onEdit}
        />
      ))}
      
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
