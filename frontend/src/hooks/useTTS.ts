import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Convert numbers to English words to avoid Chinese pronunciation
 * Example: "2026" -> "two thousand twenty-six"
 */
function numberToEnglishWords(text: string): string {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function convertHundreds(num: number): string {
    if (num === 0) return '';
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      const ten = Math.floor(num / 10);
      const one = num % 10;
      return tens[ten] + (one ? '-' + ones[one] : '');
    }
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    return ones[hundred] + ' hundred' + (remainder ? ' and ' + convertHundreds(remainder) : '');
  }

  function convertNumber(num: number): string {
    if (num === 0) return 'zero';

    const scales = ['', 'thousand', 'million', 'billion', 'trillion'];
    let result = '';
    let scaleIndex = 0;

    while (num > 0) {
      const chunk = num % 1000;
      if (chunk > 0) {
        const chunkWords = convertHundreds(chunk);
        const scale = scales[scaleIndex];
        result = chunkWords + (scale ? ' ' + scale : '') + (result ? ' ' + result : '');
      }
      num = Math.floor(num / 1000);
      scaleIndex++;
    }

    return result;
  }

  // Replace all numbers in the text with their English word equivalents
  // Handles both integers and decimals (e.g., 3.14 -> "three point one four")
  return text.replace(/\b\d+\.?\d*\b/g, (match) => {
    if (match.includes('.')) {
      const [integerPart, decimalPart] = match.split('.');
      const integerWords = integerPart ? convertNumber(parseInt(integerPart, 10)) : 'zero';
      const decimalWords = decimalPart ? decimalPart.split('').map(d => ones[parseInt(d, 10)]).join(' ') : '';
      return integerWords + (decimalPart ? ' point ' + decimalWords : '');
    } else {
      const num = parseInt(match, 10);
      return convertNumber(num);
    }
  });
}

interface TTSSettings {
  rate: number;
  pitch: number;
  volume: number;
}

interface TTSState {
  isSpeaking: boolean;
  isPaused: boolean;
  availableVoices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
}

const defaultSettings: TTSSettings = {
  rate: 0.9, // 稍慢的语速，更自然
  pitch: 1.1, // 稍高的音调，更有感情
  volume: 1.0,
};

export function useTTS(settings: Partial<TTSSettings> = {}) {
  const [state, setState] = useState<TTSState>({
    isSpeaking: false,
    isPaused: false,
    availableVoices: [],
    selectedVoice: null,
  });

  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const settingsRef = useRef({ ...defaultSettings, ...settings });

  // Update settings when they change
  useEffect(() => {
    settingsRef.current = { ...defaultSettings, ...settings };
  }, [settings]);

  // Load available voices and select female English voice
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const englishVoices = voices.filter(
        voice => voice.lang.startsWith('en')
      );

      // Try to find a female voice first (prioritize natural-sounding voices)
      const femaleVoiceKeywords = [
        'female', 'woman', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona',
        'google us english', 'microsoft zira', 'microsoft heera', 'microsoft aria'
      ];

      let selectedVoice = englishVoices.find(voice =>
        femaleVoiceKeywords.some(keyword =>
          voice.name.toLowerCase().includes(keyword)
        )
      );

      // Fallback to any US English voice (better for number pronunciation)
      if (!selectedVoice) {
        selectedVoice = englishVoices.find(voice => voice.lang === 'en-US');
      }

      // Final fallback to first English voice
      if (!selectedVoice && englishVoices.length > 0) {
        selectedVoice = englishVoices[0];
      }

      setState(prev => ({
        ...prev,
        availableVoices: voices,
        selectedVoice: selectedVoice || null,
      }));
    };

    // Voices load asynchronously
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Track speaking state
  useEffect(() => {
    const handleStart = () => setState(prev => ({ ...prev, isSpeaking: true, isPaused: false }));
    const handleEnd = () => setState(prev => ({ ...prev, isSpeaking: false, isPaused: false }));
    const handleError = () => setState(prev => ({ ...prev, isSpeaking: false, isPaused: false }));

    window.speechSynthesis.addEventListener('start', handleStart);
    window.speechSynthesis.addEventListener('end', handleEnd);
    window.speechSynthesis.addEventListener('error', handleError);

    return () => {
      window.speechSynthesis.removeEventListener('start', handleStart);
      window.speechSynthesis.removeEventListener('end', handleEnd);
      window.speechSynthesis.removeEventListener('error', handleError);
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (!text || !text.trim()) return;

    // Convert numbers to English words to avoid Chinese pronunciation
    const textWithNumbersConverted = numberToEnglishWords(text);

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textWithNumbersConverted);
    utterance.rate = settingsRef.current.rate;
    utterance.pitch = settingsRef.current.pitch;
    utterance.volume = settingsRef.current.volume;
    utterance.lang = 'en-US';

    // Use selected voice if available
    if (state.selectedVoice) {
      utterance.voice = state.selectedVoice;
    }

    // Manually set speaking state for immediate UI update
    setState(prev => ({ ...prev, isSpeaking: true, isPaused: false }));

    utterance.onend = () => {
      setState(prev => ({ ...prev, isSpeaking: false, isPaused: false }));
    };

    utterance.onerror = () => {
      setState(prev => ({ ...prev, isSpeaking: false, isPaused: false }));
    };

    currentUtterance.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [state.selectedVoice]);

  const pause = useCallback(() => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setState(prev => ({ ...prev, isPaused: true }));
    }
  }, []);

  const resume = useCallback(() => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setState(prev => ({ ...prev, isPaused: false }));
    }
  }, []);

  const cancel = useCallback(() => {
    window.speechSynthesis.cancel();
    setState(prev => ({ ...prev, isSpeaking: false, isPaused: false }));
  }, []);

  return {
    ...state,
    speak,
    pause,
    resume,
    cancel,
  };
}
