
import { useState, useRef, useCallback } from 'react';
import { useToastHelper } from './use-toast-helper';

export interface BrowserSpeechRecognitionState {
  isListening: boolean;
  transcript: string | null;
  error: string | null;
  isSupported: boolean;
}

export function useBrowserSpeechRecognition() {
  const [state, setState] = useState<BrowserSpeechRecognitionState>({
    isListening: false,
    transcript: null,
    error: null,
    isSupported: typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { showError } = useToastHelper();

  const startListening = useCallback(async () => {
    if (!state.isSupported) {
      const errorMsg = 'Speech recognition is not supported in this browser';
      setState(prev => ({ ...prev, error: errorMsg }));
      showError(errorMsg);
      return;
    }

    try {
      // @ts-ignore - Browser compatibility
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'ar-SA'; // Arabic by default, can be made configurable

      recognition.onstart = () => {
        setState(prev => ({ ...prev, isListening: true, error: null }));
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setState(prev => ({ 
          ...prev, 
          transcript,
          isListening: false
        }));
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setState(prev => ({ 
          ...prev, 
          error: event.error,
          isListening: false
        }));
        showError(`Speech recognition error: ${event.error}`);
      };

      recognition.onend = () => {
        setState(prev => ({ ...prev, isListening: false }));
      };

      recognitionRef.current = recognition;
      recognition.start();
      
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to start speech recognition',
        isListening: false
      }));
      showError('Failed to start speech recognition');
    }
  }, [state.isSupported, showError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && state.isListening) {
      recognitionRef.current.stop();
    }
  }, [state.isListening]);

  const clearTranscript = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      transcript: null,
      error: null
    }));
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    clearTranscript
  };
}
