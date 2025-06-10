
import { useState, useRef, useCallback } from 'react';
import { useToastHelper } from './use-toast-helper';

export interface BrowserSpeechRecognitionState {
  isListening: boolean;
  transcript: string | null;
  error: string | null;
  isSupported: boolean;
}

interface UseBrowserSpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export function useBrowserSpeechRecognition(options: UseBrowserSpeechRecognitionOptions = {}) {
  const { language = 'en-US', continuous = false, interimResults = false } = options;
  
  const [state, setState] = useState<BrowserSpeechRecognitionState>({
    isListening: false,
    transcript: null,
    error: null,
    isSupported: typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { showError, showSuccess } = useToastHelper();

  const startListening = useCallback(async () => {
    if (!state.isSupported) {
      const errorMsg = language.startsWith('ar') 
        ? 'التعرف على الصوت غير مدعوم في هذا المتصفح'
        : 'Speech recognition is not supported in this browser';
      setState(prev => ({ ...prev, error: errorMsg }));
      showError(errorMsg);
      return;
    }

    try {
      // Request microphone permission first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream, we just needed permission

      // @ts-ignore - Browser compatibility
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = language;

      recognition.onstart = () => {
        setState(prev => ({ ...prev, isListening: true, error: null }));
        const successMsg = language.startsWith('ar') 
          ? 'تم بدء الاستماع...'
          : 'Listening started...';
        showSuccess(successMsg);
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
        let errorMessage;
        
        switch (event.error) {
          case 'no-speech':
            errorMessage = language.startsWith('ar') 
              ? 'لم يتم رصد أي كلام. يرجى المحاولة مرة أخرى.'
              : 'No speech detected. Please try again.';
            break;
          case 'audio-capture':
            errorMessage = language.startsWith('ar') 
              ? 'لا يمكن الوصول إلى الميكروفون. يرجى التحقق من الإذونات.'
              : 'Microphone access denied. Please check permissions.';
            break;
          case 'not-allowed':
            errorMessage = language.startsWith('ar') 
              ? 'تم رفض إذن الميكروفون. يرجى السماح بالوصول للميكروفون.'
              : 'Microphone permission denied. Please allow microphone access.';
            break;
          case 'network':
            errorMessage = language.startsWith('ar') 
              ? 'خطأ في الشبكة. يرجى التحقق من الاتصال بالإنترنت.'
              : 'Network error. Please check your internet connection.';
            break;
          default:
            errorMessage = language.startsWith('ar') 
              ? `خطأ في التعرف على الصوت: ${event.error}`
              : `Speech recognition error: ${event.error}`;
        }
        
        setState(prev => ({ 
          ...prev, 
          error: errorMessage,
          isListening: false
        }));
        showError(errorMessage);
      };

      recognition.onend = () => {
        setState(prev => ({ ...prev, isListening: false }));
      };

      recognitionRef.current = recognition;
      recognition.start();
      
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      const errorMsg = language.startsWith('ar')
        ? 'فشل في بدء التعرف على الصوت. يرجى التحقق من إعدادات الميكروفون.'
        : 'Failed to start speech recognition. Please check microphone settings.';
      
      setState(prev => ({ 
        ...prev, 
        error: errorMsg,
        isListening: false
      }));
      showError(errorMsg);
    }
  }, [state.isSupported, language, continuous, interimResults, showError, showSuccess]);

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
