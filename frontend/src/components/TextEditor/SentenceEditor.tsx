import React, { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X, Plus, Scissors, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import './SentenceEditor.css';

interface SentenceEditorProps {
  sentence: string;
  index: number;
  isModified: boolean;
  onEdit: (index: number, newText: string) => void;
  onDelete?: (index: number) => void;
  onInsertBefore?: (index: number) => void;
  onInsertAfter?: (index: number) => void;
  onSplit?: (index: number) => void;
  isFirstInParagraph?: boolean;
  isLastInParagraph?: boolean;
}

export default function SentenceEditor({ 
  sentence, 
  index, 
  isModified, 
  onEdit,
  onDelete,
  onInsertBefore,
  onInsertAfter,
  onSplit,
  isFirstInParagraph = false,
  isLastInParagraph = false
}: SentenceEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(sentence);
  const [originalText, setOriginalText] = useState(sentence);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditText(sentence);
    setOriginalText(sentence);
  }, [sentence]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditText(sentence);
  };

  const handleSave = () => {
    if (editText.trim() !== originalText.trim()) {
      onEdit(index, editText);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(originalText);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  return (
    <div className={`sentence-editor ${isModified ? 'modified' : ''} ${isEditing ? 'editing' : ''}`}>
      {isEditing ? (
        <div className="sentence-edit-container">
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="sentence-textarea"
            rows={1}
          />
          <div className="sentence-edit-actions">
            <button
              onClick={handleSave}
              className="sentence-action-button save"
              title="保存 (Ctrl+Enter)"
            >
              <Check size={14} />
            </button>
            <button
              onClick={handleCancel}
              className="sentence-action-button cancel"
              title="取消 (Esc)"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="sentence-display-container">
          <div className="sentence-text">
            {sentence}
          </div>
          <div className="sentence-actions">
            <button
              onClick={handleStartEdit}
              className="sentence-action-button edit"
              title="编辑句子"
            >
              <Edit2 size={14} />
            </button>
            {onInsertBefore && isFirstInParagraph && (
              <button
                onClick={() => onInsertBefore(index)}
                className="sentence-action-button insert"
                title="向前插入"
              >
                <ArrowUp size={14} />
              </button>
            )}
            {onInsertAfter && isLastInParagraph && (
              <button
                onClick={() => onInsertAfter(index)}
                className="sentence-action-button insert"
                title="向后插入"
              >
                <ArrowDown size={14} />
              </button>
            )}
            {onSplit && (
              <button
                onClick={() => onSplit(index)}
                className="sentence-action-button split"
                title="拆分句子"
              >
                <Scissors size={14} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(index)}
                className="sentence-action-button delete"
                title="删除句子"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
