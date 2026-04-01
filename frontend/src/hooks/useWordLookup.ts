import * as api from '@/api';
import type { WordDefinition } from '@/types';
import { useCallback, useRef, useState } from 'react';

export interface WordLookupState {
  visible: boolean;
  word: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  definition: WordDefinition | null;
  error: string | null;
  position: { x: number; y: number };
  cached: boolean;
}

const initialState: WordLookupState = {
  visible: false,
  word: '',
  status: 'idle',
  definition: null,
  error: null,
  position: { x: 0, y: 0 },
  cached: false,
};

// In-memory cache for current session
const memoryCache = new Map<string, WordDefinition>();

export function useWordLookup() {
  const [state, setState] = useState<WordLookupState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const lookup = useCallback(async (word: string, rect: DOMRect) => {
    const normalized = word.toLowerCase().trim().replace(/^[^a-zA-Z\d]+/, '').replace(/[^a-zA-Z\d]+$/, '');
    if (!normalized) return;

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    // Check memory cache first
    const cached = memoryCache.get(normalized);
    if (cached) {
      setState({
        visible: true,
        word: normalized,
        status: 'success',
        definition: cached,
        error: null,
        position: { x: rect.left + rect.width / 2, y: rect.bottom },
        cached: true,
      });
      return;
    }

    // Show loading state immediately
    setState({
      visible: true,
      word: normalized,
      status: 'loading',
      definition: null,
      error: null,
      position: { x: rect.left + rect.width / 2, y: rect.bottom },
      cached: false,
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await api.lookupWord(normalized, controller.signal);
      // Store in memory cache
      memoryCache.set(normalized, result.definition);

      setState(prev => ({
        ...prev,
        status: 'success',
        definition: result.definition,
        cached: result.cached,
      }));
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setState(prev => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : '查词失败',
      }));
    }
  }, []);

  const close = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState(initialState);
  }, []);

  return { wordLookup: state, lookupWord: lookup, closeWordLookup: close };
}
