/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SentenceList from '../../frontend/src/components/TextEditor/SentenceList';

// Mock CSS imports
jest.mock('../../frontend/src/components/TextEditor/SentenceList.css', () => ({}));

describe('SentenceList Component', () => {
  const mockProps = {
    sentences: ['First sentence.', 'Second sentence.', 'Third sentence.'],
    modifiedSentences: new Set([1]),
    onEdit: jest.fn(),
    onAnalyze: jest.fn(),
    showAnalyzeButtons: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders all sentences', () => {
    render(<SentenceList {...mockProps} />);
    
    expect(screen.getByText('First sentence.')).toBeInTheDocument();
    expect(screen.getByText('Second sentence.')).toBeInTheDocument();
    expect(screen.getByText('Third sentence.')).toBeInTheDocument();
  });

  test('shows empty state when no sentences', () => {
    render(<SentenceList {...mockProps} sentences={[]} />);
    
    expect(screen.getByText('没有句子')).toBeInTheDocument();
    expect(screen.getByText('当前文本中没有可编辑的句子内容')).toBeInTheDocument();
  });

  test('passes correct props to SentenceEditor components', () => {
    render(<SentenceList {...mockProps} />);
    
    // Check that edit buttons are present for each sentence
    const editButtons = screen.getAllByTitle('编辑句子');
    expect(editButtons).toHaveLength(3);
    
    // Check that analyze buttons are present
    const analyzeButtons = screen.getAllByTitle('分析句子');
    expect(analyzeButtons).toHaveLength(3);
  });

  test('handles sentence editing', () => {
    render(<SentenceList {...mockProps} />);
    
    const editButtons = screen.getAllByTitle('编辑句子');
    fireEvent.click(editButtons[0]); // Edit first sentence
    
    // Find the textarea for the first sentence (it should appear after clicking edit)
    const textareas = screen.getAllByDisplayValue('First sentence.');
    expect(textareas).toHaveLength(1);
    
    // Modify the text
    fireEvent.change(textareas[0], { target: { value: 'Modified first sentence.' } });
    
    // Find and click save button
    const saveButtons = screen.getAllByTitle('保存 (Ctrl+Enter)');
    fireEvent.click(saveButtons[0]);
    
    expect(mockProps.onEdit).toHaveBeenCalledWith(0, 'Modified first sentence.');
  });

  test('handles sentence analysis', () => {
    render(<SentenceList {...mockProps} />);
    
    const analyzeButtons = screen.getAllByTitle('分析句子');
    fireEvent.click(analyzeButtons[2]); // Analyze third sentence
    
    expect(mockProps.onAnalyze).toHaveBeenCalledWith(2);
  });

  test('hides analyze buttons when showAnalyzeButtons is false', () => {
    render(<SentenceList {...mockProps} showAnalyzeButtons={false} />);
    
    expect(screen.queryByTitle('分析句子')).not.toBeInTheDocument();
    expect(screen.getAllByTitle('编辑句子')).toHaveLength(3);
  });

  test('handles single sentence', () => {
    const singleSentenceProps = {
      ...mockProps,
      sentences: ['Only one sentence.'],
      modifiedSentences: new Set()
    };
    
    render(<SentenceList {...singleSentenceProps} />);
    
    expect(screen.getByText('Only one sentence.')).toBeInTheDocument();
    expect(screen.getByTitle('编辑句子')).toBeInTheDocument();
    expect(screen.getByTitle('分析句子')).toBeInTheDocument();
  });

  test('handles all sentences modified', () => {
    const allModifiedProps = {
      ...mockProps,
      modifiedSentences: new Set([0, 1, 2])
    };
    
    render(<SentenceList {...allModifiedProps} />);
    
    // All sentences should be displayed with modified styling
    const sentenceElements = screen.getAllByText(/sentence\./);
    expect(sentenceElements).toHaveLength(3);
  });

  test('handles empty sentences array', () => {
    render(<SentenceList {...mockProps} sentences={[]} />);
    
    expect(screen.getByText('没有句子')).toBeInTheDocument();
    expect(screen.queryByTitle('编辑句子')).not.toBeInTheDocument();
    expect(screen.queryByTitle('分析句子')).not.toBeInTheDocument();
  });
});
