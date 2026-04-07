/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SentenceEditor from '../../frontend/src/components/TextEditor/SentenceEditor';

// Mock CSS imports
jest.mock('../../frontend/src/components/TextEditor/SentenceEditor.css', () => ({}));

describe('SentenceEditor Component', () => {
  const mockProps = {
    sentence: 'This is a test sentence.',
    index: 0,
    isModified: false,
    onEdit: jest.fn(),
    onAnalyze: jest.fn(),
    showAnalyzeButton: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders sentence in display mode', () => {
    render(<SentenceEditor {...mockProps} />);
    
    expect(screen.getByText('This is a test sentence.')).toBeInTheDocument();
    expect(screen.getByTitle('编辑句子')).toBeInTheDocument();
    expect(screen.getByTitle('分析句子')).toBeInTheDocument();
  });

  test('highlights modified sentences', () => {
    render(<SentenceEditor {...mockProps} isModified={true} />);
    
    const container = screen.getByText('This is a test sentence.').closest('.sentence-editor');
    expect(container).toHaveClass('modified');
  });

  test('enters edit mode when edit button is clicked', async () => {
    render(<SentenceEditor {...mockProps} />);
    
    const editButton = screen.getByTitle('编辑句子');
    fireEvent.click(editButton);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('This is a test sentence.')).toBeInTheDocument();
    });
    
    expect(screen.getByTitle('保存 (Ctrl+Enter)')).toBeInTheDocument();
    expect(screen.getByTitle('取消 (Esc)')).toBeInTheDocument();
  });

  test('saves edited text when save button is clicked', async () => {
    render(<SentenceEditor {...mockProps} />);
    
    // Enter edit mode
    const editButton = screen.getByTitle('编辑句子');
    fireEvent.click(editButton);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('This is a test sentence.')).toBeInTheDocument();
    });
    
    // Modify text
    const textarea = screen.getByDisplayValue('This is a test sentence.');
    fireEvent.change(textarea, { target: { value: 'This is a modified test sentence.' } });
    
    // Save
    const saveButton = screen.getByTitle('保存 (Ctrl+Enter)');
    fireEvent.click(saveButton);
    
    expect(mockProps.onEdit).toHaveBeenCalledWith(0, 'This is a modified test sentence.');
  });

  test('cancels edit when cancel button is clicked', async () => {
    render(<SentenceEditor {...mockProps} />);
    
    // Enter edit mode
    const editButton = screen.getByTitle('编辑句子');
    fireEvent.click(editButton);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('This is a test sentence.')).toBeInTheDocument();
    });
    
    // Modify text
    const textarea = screen.getByDisplayValue('This is a test sentence.');
    fireEvent.change(textarea, { target: { value: 'This is a modified test sentence.' } });
    
    // Cancel
    const cancelButton = screen.getByTitle('取消 (Esc)');
    fireEvent.click(cancelButton);
    
    // Should return to display mode with original text
    expect(screen.getByText('This is a test sentence.')).toBeInTheDocument();
    expect(mockProps.onEdit).not.toHaveBeenCalled();
  });

  test('calls analyze when analyze button is clicked', () => {
    render(<SentenceEditor {...mockProps} />);
    
    const analyzeButton = screen.getByTitle('分析句子');
    fireEvent.click(analyzeButton);
    
    expect(mockProps.onAnalyze).toHaveBeenCalledWith(0);
  });

  test('supports keyboard shortcuts', async () => {
    render(<SentenceEditor {...mockProps} />);
    
    // Enter edit mode
    const editButton = screen.getByTitle('编辑句子');
    fireEvent.click(editButton);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('This is a test sentence.')).toBeInTheDocument();
    });
    
    const textarea = screen.getByDisplayValue('This is a test sentence.');
    
    // Test Escape key
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(screen.getByText('This is a test sentence.')).toBeInTheDocument();
    
    // Re-enter edit mode for Ctrl+Enter test
    fireEvent.click(editButton);
    await waitFor(() => {
      expect(screen.getByDisplayValue('This is a test sentence.')).toBeInTheDocument();
    });
    
    // Modify text and test Ctrl+Enter
    fireEvent.change(textarea, { target: { value: 'Modified sentence.' } });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    
    expect(mockProps.onEdit).toHaveBeenCalledWith(0, 'Modified sentence.');
  });

  test('does not show analyze button when showAnalyzeButton is false', () => {
    render(<SentenceEditor {...mockProps} showAnalyzeButton={false} />);
    
    expect(screen.queryByTitle('分析句子')).not.toBeInTheDocument();
    expect(screen.getByTitle('编辑句子')).toBeInTheDocument();
  });
});
