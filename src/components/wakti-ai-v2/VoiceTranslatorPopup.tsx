import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Mic, Square, Copy, Loader2, AlertTriangle, PlayCircle, Volume2, ChevronDown, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceTranslatorPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TranslationItem {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: Date;
}

interface CachedAudio {
  [text: string]: {
    data: string;
    timestamp: number;
    size: number;
  };
}

// Simplified audio manager
class AudioManager {
  private currentAudio: HTMLAudioElement | null = null;
  private isPlaying: boolean = false;

  async playAudio(base64Audio: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.stopCurrentAudio();
        console.log('🔊 Creating new audio element');

        const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
        this.currentAudio = audio;
        
        audio.preload = 'auto';
        audio.volume = 1.0;
        
        audio.onended = () => {
          console.log('🔊 Audio playback completed');
          this.isPlaying = false;
          this.currentAudio = null;
          resolve();
        };
        
        audio.onerror = (error) => {
          console.error('🔊 Audio playback error:', error);
          this.isPlaying = false;
          this.currentAudio = null;
          reject(new Error('Audio playback failed'));
        };

        this.isPlaying = true;
        const playPromise = audio.play();
        
        if (playPromise) {
          playPromise
            .then(() => {
              console.log('🔊 Audio started playing successfully');
            })
            .catch((error) => {
              console.error('🔊 Play failed:', error);
              this.isPlaying = false;
              this.currentAudio = null;
              reject(error);
            });
        }
        
      } catch (error) {
        console.error('🔊 Audio setup error:', error);
        this.isPlaying = false;
        this.currentAudio = null;
        reject(error);
      }
    });
  }

  stopCurrentAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
      this.isPlaying = false;
    }
  }

  isAudioPlaying(): boolean {
    return this.isPlaying;
  }
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'العربية (Arabic)' },
  { code: 'es', name: 'Español (Spanish)' },
  { code: 'fr', name: 'Français (French)' },
  { code: 'de', name: 'Deutsch (German)' },
  { code: 'it', name: 'Italiano (Italian)' },
  { code: 'pt', name: 'Português (Portuguese)' },
  { code: 'ru', name: 'Русский (Russian)' },
  { code: 'ja', name: '日本語 (Japanese)' },
  { code: 'ko', name: '한국어 (Korean)' },
  { code: 'zh', name: '中文 (Chinese)' },
  { code: 'hi', name: 'हिन्दी (Hindi)' },
  { code: 'tr', name: 'Türkçe (Turkish)' },
  { code: 'nl', name: 'Nederlands (Dutch)' },
  { code: 'sv', name: 'Svenska (Swedish)' }
];

const MAX_RECORDING_TIME = 15;
const COOLDOWN_TIME = 3000;
const MAX_HISTORY_ITEMS = 5;
const AUDIO_CACHE_EXPIRY = 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 50;

export function VoiceTranslatorPopup({ open, onOpenChange }: VoiceTranslatorPopupProps) {
  const { user } = useAuth();
  const { language } = useTheme();
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [translationHistory, setTranslationHistory] = useState<TranslationItem[]>([]);
  const [audioCache, setAudioCache] = useState<CachedAudio>({});
  const [audioUnlockAttempted, setAudioUnlockAttempted] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const audioManager = useMemo(() => new AudioManager(), []);

  // Clear translation when language changes
  useEffect(() => {
    console.log('🎤 Language selection changed to:', selectedLanguage);
    setTranslatedText('');
    setProcessingError(null);
  }, [selectedLanguage]);

  // Load data on mount
  useEffect(() => {
    if (open && user) {
      loadTranslationHistory();
      loadAudioCache();
    }
  }, [open, user?.id]);

  // Cleanup recording timer
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      audioManager.stopCurrentAudio();
    };
  }, [audioManager]);

  const loadTranslationHistory = useCallback(() => {
    try {
      const stored = localStorage.getItem('voice_translator_history');
      if (stored) {
        const parsed = JSON.parse(stored).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
        setTranslationHistory(parsed);
      }
    } catch (error) {
      console.error('Error loading translation history:', error);
      setTranslationHistory([]);
    }
  }, []);

  const loadAudioCache = useCallback(() => {
    try {
      const stored = localStorage.getItem('voice_translator_audio_cache');
      if (stored) {
        const cache = JSON.parse(stored);
        const now = Date.now();
        const cleanedCache: CachedAudio = {};
        
        Object.entries(cache).forEach(([key, value]: [string, any]) => {
          if (value.timestamp && (now - value.timestamp) < AUDIO_CACHE_EXPIRY) {
            cleanedCache[key] = value;
          }
        });
        
        setAudioCache(cleanedCache);
      }
    } catch (error) {
      console.error('Error loading audio cache:', error);
      setAudioCache({});
    }
  }, []);

  const saveTranslationHistory = useCallback((history: TranslationItem[]) => {
    try {
      localStorage.setItem('voice_translator_history', JSON.stringify(history));
    } catch (error) {
      console.error('Error saving translation history:', error);
    }
  }, []);

  const saveAudioCache = useCallback((cache: CachedAudio) => {
    try {
      const entries = Object.entries(cache);
      if (entries.length > MAX_CACHE_SIZE) {
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        const limitedCache: CachedAudio = {};
        entries.slice(0, MAX_CACHE_SIZE).forEach(([key, value]) => {
          limitedCache[key] = value;
        });
        localStorage.setItem('voice_translator_audio_cache', JSON.stringify(limitedCache));
      } else {
        localStorage.setItem('voice_translator_audio_cache', JSON.stringify(cache));
      }
    } catch (error) {
      console.error('Error saving audio cache:', error);
    }
  }, []);

  const addToHistory = useCallback((translation: TranslationItem) => {
    setTranslationHistory(prev => {
      const newHistory = [translation, ...prev.slice(0, MAX_HISTORY_ITEMS - 1)];
      saveTranslationHistory(newHistory);
      return newHistory;
    });
  }, [saveTranslationHistory]);

  const selectFromHistory = useCallback((item: TranslationItem) => {
    setTranslatedText(item.translatedText);
    setProcessingError(null);
  }, []);

  const getFirstWords = useCallback((text: string, wordCount: number = 3) => {
    return text.split(' ').slice(0, wordCount).join(' ');
  }, []);

  const unlockAudioContext = useCallback(async () => {
    try {
      console.log('🔊 Attempting to unlock audio context...');
      setAudioUnlockAttempted(true);
      
      const silentAudio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA');
      await silentAudio.play();
      silentAudio.pause();
      
      toast({
        title: language === 'ar' ? '🔊 تم تفعيل الصوت' : '🔊 Audio Unlocked',
        description: language === 'ar' ? 'يمكنك الآن تشغيل الترجمات صوتياً' : 'You can now play translations with audio',
        duration: 2000
      });
    } catch (error) {
      console.log('🔊 Audio unlock not needed or failed, but will try direct playback:', error);
      setAudioUnlockAttempted(true);
    }
  }, [language]);

  const startRecording = useCallback(async () => {
    console.log('🎤 Starting recording process...');
    setProcessingError(null);
    
    if (isOnCooldown) {
      const errorMsg = language === 'ar' ? 'يرجى الانتظار' : 'Please Wait';
      setProcessingError(errorMsg);
      toast({
        title: errorMsg,
        description: language === 'ar' ? 'يرجى الانتظار قليلاً قبل الترجمة التالية' : 'Please wait a moment before the next translation.',
        variant: 'default'
      });
      return;
    }

    try {
      console.log('🎤 Requesting microphone permission...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('🎤 Microphone access granted, setting up recorder...');
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingTime(0);
      setTranslatedText('');

      mediaRecorder.ondataavailable = (event) => {
        console.log('🎤 Audio data received, size:', event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🎤 Recording stopped, processing audio...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('🎤 Audio blob created, size:', audioBlob.size, 'bytes');
        await processVoiceTranslation(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      console.log('🎤 Recording started successfully');

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_RECORDING_TIME - 1) {
            console.log('🎤 Max recording time reached, stopping...');
            stopRecording();
            return MAX_RECORDING_TIME;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (error) {
      console.error('❌ Error starting recording:', error);
      const errorMsg = language === 'ar' ? 'فشل في بدء التسجيل' : 'Failed to start recording';
      setProcessingError(errorMsg);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: errorMsg,
        variant: 'destructive'
      });
    }
  }, [isOnCooldown, language, selectedLanguage]);

  const stopRecording = useCallback(() => {
    console.log('🎤 Stopping recording...');
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      console.log('🎤 Recording stopped successfully');
    }
  }, [isRecording]);

  // UPDATED: Process voice translation using unified-ai-brain
  const processVoiceTranslation = useCallback(async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);
      setProcessingError(null);
      console.log('🎤 Processing translation with target language:', selectedLanguage);
      console.log('🎤 Audio blob size:', audioBlob.size, 'bytes');

      const formData = new FormData();
      formData.append('audioBlob', audioBlob, 'audio.webm');
      formData.append('targetLanguage', selectedLanguage);

      console.log('🎤 Voice Translator: Sending FormData to unified-ai-brain');

      // UPDATED: Use unified-ai-brain instead of voice-translator
      const { data, error } = await supabase.functions.invoke('unified-ai-brain', {
        body: formData
      });

      console.log('🎤 Voice Translator: Response from unified-ai-brain:', { data, error });

      if (error) {
        console.error('🎤 Voice Translator error:', error);
        throw new Error(error.message || 'Translation service error');
      }

      if (!data?.translatedText) {
        throw new Error('No translation received from service');
      }

      console.log('🎤 Voice Translator result:', data);
      return handleSuccessfulTranslation(data);

    } catch (error) {
      console.error('🎤 Voice Translator: Error processing translation:', error);
      
      let errorMessage: string;
      
      if (error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
        errorMessage = language === 'ar'
          ? 'خطأ في الاتصال - تحقق من الاتصال بالإنترنت'
          : 'Connection error - check your internet connection';
      } else {
        errorMessage = language === 'ar' 
          ? 'فشل في ترجمة الصوت - يرجى المحاولة مرة أخرى' 
          : 'Failed to translate voice - please try again';
      }

      setProcessingError(errorMessage);
      toast({
        title: language === 'ar' ? 'خطأ في الترجمة' : 'Translation Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      setRecordingTime(0);
    }
  }, [selectedLanguage, language]);

  // SIMPLIFIED: Success handling without complex quota logic
  const handleSuccessfulTranslation = useCallback(async (data: any) => {
    setTranslatedText(data.translatedText);
    
    const newTranslation: TranslationItem = {
      id: Date.now().toString(),
      originalText: data.originalText,
      translatedText: data.translatedText,
      sourceLanguage: data.sourceLanguage,
      targetLanguage: data.targetLanguage,
      timestamp: new Date()
    };
    addToHistory(newTranslation);
    
    setIsOnCooldown(true);
    setTimeout(() => setIsOnCooldown(false), COOLDOWN_TIME);

    const targetLangName = SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage;
    toast({
      title: language === 'ar' ? '✅ تمت الترجمة' : '✅ Translation Complete',
      description: language === 'ar' 
        ? `تم إنجاز الترجمة إلى ${targetLangName} بنجاح` 
        : `Translation to ${targetLangName} completed successfully`,
    });
  }, [selectedLanguage, language, addToHistory]);

  // UPDATED: TTS using unified-ai-brain instead of voice-translator-tts
  const playTranslatedText = useCallback(async (text: string) => {
    console.log('🔊 Play button clicked, text:', text);
    
    if (audioManager.isAudioPlaying()) {
      console.log('🔊 Stopping current audio playback');
      audioManager.stopCurrentAudio();
      setIsPlaying(false);
      return;
    }

    try {
      console.log('🔊 Starting audio playback');
      setIsPlaying(true);
      
      const cacheKey = `${text}_${selectedLanguage}`;
      if (audioCache[cacheKey] && audioCache[cacheKey].data) {
        console.log('🔊 Playing from cache:', cacheKey);
        await audioManager.playAudio(audioCache[cacheKey].data);
        setIsPlaying(false);
        return;
      }
      
      console.log(`🔊 Generating TTS for language: ${selectedLanguage}`);
      
      // UPDATED: Use unified-ai-brain for TTS instead of voice-translator-tts
      const { data, error } = await supabase.functions.invoke('unified-ai-brain', {
        body: JSON.stringify({
          text: text,
          voice: 'alloy',
          requestType: 'tts'
        })
      });

      if (error) {
        console.error('🔊 TTS error:', error);
        throw new Error(error.message || 'TTS service error');
      }

      if (data?.audioContent) {
        console.log(`🔊 TTS generated successfully`);
        
        const newCache = { 
          ...audioCache, 
          [cacheKey]: {
            data: data.audioContent,
            timestamp: Date.now(),
            size: data.size || 0
          }
        };
        setAudioCache(newCache);
        saveAudioCache(newCache);
        
        await audioManager.playAudio(data.audioContent);
        console.log('🔊 TTS playback successful');
      } else {
        throw new Error('No audio content received');
      }
    } catch (error) {
      console.error('🔊 Error playing TTS:', error);
      
      const errorMessage = language === 'ar' ? 'فشل في تشغيل الصوت' : 'Audio generation failed. Please try again.';
      
      toast({
        title: language === 'ar' ? 'خطأ في التشغيل' : 'Playback Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsPlaying(false);
    }
  }, [audioManager, selectedLanguage, audioCache, saveAudioCache, language]);

  const copyToClipboard = useCallback(async (text: string) => {
    console.log('📋 Copy button clicked, text:', text);
    
    try {
      setIsCopying(true);
      
      if (!navigator.clipboard) {
        console.log('📋 Clipboard API not available, using fallback');
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      } else {
        await navigator.clipboard.writeText(text);
      }
      
      console.log('📋 Text copied successfully');
      toast({
        title: language === 'ar' ? '✅ تم النسخ' : '✅ Copied',
        description: language === 'ar' ? 'تم نسخ النص المترجم' : 'Translated text copied to clipboard',
      });
    } catch (error) {
      console.error('📋 Failed to copy text:', error);
      toast({
        title: language === 'ar' ? '❌ فشل النسخ' : '❌ Copy Failed',
        description: language === 'ar' ? 'فشل في نسخ النص' : 'Failed to copy text to clipboard',
        variant: 'destructive'
      });
    } finally {
      setIsCopying(false);
    }
  }, [language]);

  const formatRecordingTime = useCallback((seconds: number) => {
    const remainingTime = MAX_RECORDING_TIME - seconds;
    return `${remainingTime}s`;
  }, []);

  const needsAudioUnlock = !audioUnlockAttempted && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              {language === 'ar' ? '🎤 مترجم الصوت' : '🎤 Voice Translator'}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Audio unlock button for mobile */}
          {needsAudioUnlock && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <VolumeX className="h-4 w-4 text-blue-600" />
              <div className="flex-1">
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  {language === 'ar' 
                    ? 'اضغط لتفعيل تشغيل الصوت على هذا الجهاز' 
                    : 'Tap to enable audio playback on this device'
                  }
                </p>
              </div>
              <Button size="sm" onClick={unlockAudioContext} variant="outline">
                <Volume2 className="h-3 w-3 mr-1" />
                {language === 'ar' ? 'تفعيل' : 'Unlock'}
              </Button>
            </div>
          )}

          {/* Processing error display */}
          {processingError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <p className="text-sm text-red-600 dark:text-red-400">
                {processingError}
              </p>
            </div>
          )}

          {/* Enhanced Language Selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              {language === 'ar' ? 'ترجم إلى:' : 'Translate to:'}
            </label>
            <Select value={selectedLanguage} onValueChange={(value) => {
              console.log('🎤 User selected language:', value);
              setSelectedLanguage(value);
              
              const selectedLangName = SUPPORTED_LANGUAGES.find(lang => lang.code === value)?.name;
              toast({
                title: language === 'ar' ? '🔄 تم تغيير اللغة' : '🔄 Language Changed',
                description: language === 'ar' 
                  ? `تم اختيار ${selectedLangName} للترجمة التالية` 
                  : `Selected ${selectedLangName} for next translation`,
                duration: 2000
              });
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground mt-1 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
              {language === 'ar' 
                ? `✅ سيتم الترجمة إلى: ${SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage)?.name}`
                : `✅ Will translate to: ${SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage)?.name}`
              }
            </div>
          </div>

          {/* Playback Toggle and Previous Translations Dropdown */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Switch 
                id="playback" 
                checked={playbackEnabled} 
                onCheckedChange={setPlaybackEnabled}
              />
              <PlayCircle className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="playback" className="text-sm">
                {language === 'ar' ? 'تشغيل الترجمة صوتياً' : 'Play translated text'}
              </Label>
            </div>

            {translationHistory.length > 0 && (
              <Select onValueChange={(value) => {
                const item = translationHistory.find(h => h.id === value);
                if (item) selectFromHistory(item);
              }}>
                <SelectTrigger className="w-auto min-w-[140px]">
                  <div className="flex items-center gap-1">
                    <span className="text-sm">
                      {language === 'ar' ? 'الترجمات السابقة' : 'Previous translations'}
                    </span>
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {translationHistory.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {getFirstWords(item.translatedText)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Recording Section */}
          <div className="text-center space-y-4">
            {isRecording && (
              <div className="flex items-center justify-center gap-2 text-red-600">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">
                  {language === 'ar' ? 'تسجيل' : 'Recording'} {formatRecordingTime(recordingTime)}
                </span>
              </div>
            )}

            {isProcessing && (
              <div className="flex items-center justify-center gap-2 text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">
                  {language === 'ar' ? 'معالجة الترجمة...' : 'Processing translation...'}
                </span>
              </div>
            )}

            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              size="lg"
              className={cn(
                "h-16 w-16 rounded-full transition-all duration-200",
                isRecording 
                  ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400 scale-105" 
                  : "hover:scale-105"
              )}
            >
              {isProcessing ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : isRecording ? (
                <Square className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              {language === 'ar' 
                ? 'اضغط للتسجيل (حتى 15 ثانية)'
                : 'Tap to record (up to 15 seconds)'
              }
            </p>
          </div>

          {/* Translation Results */}
          {translatedText && (
            <div className="space-y-3">
              <div className="p-4 bg-muted rounded-lg text-center relative">
                <div className="text-sm font-medium mb-3">{translatedText}</div>
                <div className="flex justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('📋 Copy button clicked directly');
                      copyToClipboard(translatedText);
                    }}
                    disabled={isCopying}
                    className="h-10 w-20 flex items-center justify-center gap-2"
                  >
                    {isCopying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span className="text-xs">
                          {language === 'ar' ? 'نسخ' : 'Copy'}
                        </span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🔊 Play button clicked directly, text:', translatedText);
                      playTranslatedText(translatedText);
                    }}
                    disabled={isPlaying}
                    className="h-10 w-20 flex items-center justify-center gap-2"
                  >
                    {isPlaying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs">
                          {language === 'ar' ? 'جاري...' : 'Playing...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-4 w-4" />
                        <span className="text-xs">
                          {language === 'ar' ? 'تشغيل' : 'Play'}
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
