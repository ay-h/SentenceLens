import React from 'react';
import { Edit2 } from 'lucide-react';
import './EditButton.css';

interface EditButtonProps {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  size?: 'small' | 'medium' | 'large';
}

export default function EditButton({ 
  onClick, 
  disabled = false, 
  title = '编辑',
  size = 'small' 
}: EditButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`edit-button edit-button--${size} ${disabled ? 'edit-button--disabled' : ''}`}
    >
      <Edit2 size={size === 'small' ? 14 : size === 'medium' ? 16 : 18} />
    </button>
  );
}
