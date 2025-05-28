import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuotaManagement } from '@/hooks/useQuotaManagement';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Mic, Square, Copy, Loader2, AlertTriangle, Plus, Clock, PlayCircle, Volume2, ChevronDown, VolumeX } from 'lucide-react';
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

// Audio management class for better mobile/desktop compatibility
class AudioManager {
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private isPlaying: boolean = false;

  constructor() {
    this.initializeAudioContext();
  }

  private async initializeAudioContext() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
      }
    } catch (error) {
      console.warn('AudioContext initialization failed:', error);
    }
  }

  async unlockAudio(): Promise<boolean> {
    try {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('🔊 AudioContext unlocked successfully');
        return true;
      }
      return this.audioContext?.state === 'running' || false;
    } catch (error) {
      console.error('Failed to unlock AudioContext:', error);
      return false;
    }
  }

  async playAudio(base64Audio: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.stopCurrentAudio();

        const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
        this.currentAudio = audio;
        
        audio.preload = 'auto';
        audio.volume = 1.0;
        
        audio.onloadeddata = () => {
          console.log('🔊 Audio loaded successfully');
        };
        
        audio.oncanplaythrough = () => {
          console.log('🔊 Audio ready to play');
          this.isPlaying = true;
          audio.play().catch(reject);
        };
        
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

        const playPromise = audio.play();
        if (playPromise) {
          playPromise.catch((error) => {
            console.error('🔊 Immediate play failed, will retry on canplaythrough:', error);
          });
        }
        
        audio.load();
      } catch (error) {
        console.error('🔊 Audio setup error:', error);
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

  needsUnlock(): boolean {
    return this.audioContext?.state === 'suspended' || false;
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
const COOLDOWN_TIME = 5000;
const EXTRA_TRANSLATIONS_PRICE = 10;
const EXTRA_TRANSLATIONS_COUNT = 100;
const MAX_HISTORY_ITEMS = 5;
const AUDIO_CACHE_EXPIRY = 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 50;

export function VoiceTranslatorPopup({ open, onOpenChange }: VoiceTranslatorPopupProps) {
  const { user } = useAuth();
  const { language } = useTheme();
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  
  // Use the quota management hook
  const {
    userQuota,
    isLoadingQuota,
    quotaError,
    incrementTranslationCount,
    purchaseExtraTranslations,
    remainingFreeTranslations,
    isAtSoftLimit,
    isAtHardLimit,
    canTranslate,
    MAX_DAILY_TRANSLATIONS,
    loadUserQuota
  } = useQuotaManagement(language);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [translationHistory, setTranslationHistory] = useState<TranslationItem[]>([]);
  const [audioCache, setAudioCache] = useState<CachedAudio>({});
  const [audioManager] = useState(() => new AudioManager());
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio and check for mobile restrictions
  useEffect(() => {
    if (open) {
      const checkAudioState = () => {
        setNeedsAudioUnlock(audioManager.needsUnlock());
      };
      
      checkAudioState();
      setTimeout(checkAudioState, 100);
    }
  }, [open, audioManager]);

  // Load data on mount
  useEffect(() => {
    if (open && user) {
      loadTranslationHistory();
      loadAudioCache();
      // Refresh quota when popup opens
      loadUserQuota();
    }
  }, [open, user, loadUserQuota]);

  // Cleanup recording timer
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      audioManager.stopCurrentAudio();
    };
  }, [audioManager]);

  const loadTranslationHistory = () => {
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
  };

  const loadAudioCache = () => {
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
  };

  const saveTranslationHistory = (history: TranslationItem[]) => {
    try {
      localStorage.setItem('voice_translator_history', JSON.stringify(history));
    } catch (error) {
      console.error('Error saving translation history:', error);
    }
  };

  const saveAudioCache = (cache: CachedAudio) => {
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
  };

  const addToHistory = (translation: TranslationItem) => {
    const newHistory = [translation, ...translationHistory.slice(0, MAX_HISTORY_ITEMS - 1)];
    setTranslationHistory(newHistory);
    saveTranslationHistory(newHistory);
  };

  const selectFromHistory = (item: TranslationItem) => {
    setTranslatedText(item.translatedText);
  };

  const getFirstWords = (text: string, wordCount: number = 3) => {
    return text.split(' ').slice(0, wordCount).join(' ');
  };

  const unlockAudioContext = async () => {
    try {
      const success = await audioManager.unlockAudio();
      setNeedsAudioUnlock(!success);
      
      if (success) {
        toast({
          title: language === 'ar' ? '🔊 تم تفعيل الصوت' : '🔊 Audio Unlocked',
          description: language === 'ar' ? 'يمكنك الآن تشغيل الترجمات صوتياً' : 'You can now play translations with audio',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('Failed to unlock audio context:', error);
    }
  };

  const startRecording = async () => {
    if (!quotaError && !canTranslate) {
      toast({
        title: language === 'ar' ? 'تم الوصول للحد اليومي' : 'Daily Limit Reached',
        description: language === 'ar' 
          ? 'لقد وصلت للحد الأقصى من الترجمات اليومية' 
          : "You've reached your daily translation limit",
        variant: 'destructive'
      });
      return;
    }

    if (isOnCooldown) {
      toast({
        title: language === 'ar' ? 'يرجى الانتظار' : 'Please Wait',
        description: language === 'ar' ? 'يرجى الانتظار قليلاً قبل الترجمة التالية' : 'Please wait a moment before the next translation.',
        variant: 'default'
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingTime(0);
      setTranslatedText('');

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processVoiceTranslation(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_RECORDING_TIME - 1) {
            stopRecording();
            return MAX_RECORDING_TIME;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في بدء التسجيل' : 'Failed to start recording',
        variant: 'destructive'
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const processVoiceTranslation = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session found');
      }

      const formData = new FormData();
      formData.append('audioBlob', audioBlob, 'audio.webm');
      formData.append('targetLanguage', selectedLanguage);

      console.log('🎤 Voice Translator: Processing translation...');

      const response = await fetch('https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/voice-translator', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🎤 Voice Translator error:', errorText);
        throw new Error(`Translation failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('🎤 Voice Translator result:', result);

      if (result.translatedText) {
        // CRITICAL: Increment usage count FIRST
        console.log('📊 About to increment translation usage...');
        const usageSuccess = await incrementTranslationCount();
        console.log('📊 Usage tracking result:', usageSuccess ? 'success' : 'failed');
        
        if (!usageSuccess && !quotaError) {
          console.warn('⚠️ Translation blocked due to quota limit');
          toast({
            title: language === 'ar' ? 'تم الوصول للحد الأقصى' : 'Limit Reached',
            description: language === 'ar' 
              ? 'لقد وصلت للحد الأقصى من الترجمات اليومية' 
              : 'You have reached your daily translation limit',
            variant: 'destructive'
          });
          return;
        }

        setTranslatedText(result.translatedText);
        
        const newTranslation: TranslationItem = {
          id: Date.now().toString(),
          originalText: result.originalText,
          translatedText: result.translatedText,
          sourceLanguage: result.sourceLanguage,
          targetLanguage: result.targetLanguage,
          timestamp: new Date()
        };
        addToHistory(newTranslation);
        
        setIsOnCooldown(true);
        setTimeout(() => setIsOnCooldown(false), COOLDOWN_TIME);

        toast({
          title: language === 'ar' ? '✅ تمت الترجمة' : '✅ Translation Complete',
          description: language === 'ar' ? 'تم إنجاز الترجمة بنجاح' : 'Translation completed successfully',
        });

        if (playbackEnabled && !needsAudioUnlock) {
          playTranslatedText(result.translatedText);
        }
      } else {
        throw new Error('No translation received');
      }
    } catch (error) {
      console.error('🎤 Voice Translator: Error processing translation:', error);
      toast({
        title: language === 'ar' ? 'خطأ في الترجمة' : 'Translation Error',
        description: language === 'ar' ? 'فشل في ترجمة الصوت - يرجى المحاولة مرة أخرى' : 'Failed to translate voice - please try again',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      setRecordingTime(0);
    }
  };

  const playTranslatedText = async (text: string, retryAttempt: number = 0) => {
    if (needsAudioUnlock) {
      toast({
        title: language === 'ar' ? '🔊 مطلوب تفعيل الصوت' : '🔊 Audio Unlock Required',
        description: language === 'ar' ? 'اضغط زر تفعيل الصوت أولاً' : 'Please tap the audio unlock button first',
        variant: 'default'
      });
      return;
    }

    if (audioManager.isAudioPlaying()) {
      audioManager.stopCurrentAudio();
      setIsPlaying(false);
      return;
    }

    try {
      setIsPlaying(true);
      
      const cacheKey = `${text}_${selectedLanguage}`;
      if (audioCache[cacheKey] && audioCache[cacheKey].data) {
        console.log('🔊 Playing from cache:', cacheKey);
        await audioManager.playAudio(audioCache[cacheKey].data);
        setIsPlaying(false);
        return;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No session available for TTS');
        setIsPlaying(false);
        return;
      }
      
      console.log(`🔊 Generating TTS for language: ${selectedLanguage}, voice: alloy`);
      
      const response = await fetch('https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/voice-translator-tts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: 'alloy'
        })
      });

      if (response.ok) {
        const result = await response.json();
        const audioContent = result.audioContent;
        
        if (audioContent) {
          console.log(`🔊 TTS generated successfully, size: ${result.size || 'unknown'} bytes`);
          
          const newCache = { 
            ...audioCache, 
            [cacheKey]: {
              data: audioContent,
              timestamp: Date.now(),
              size: result.size || 0
            }
          };
          setAudioCache(newCache);
          saveAudioCache(newCache);
          
          await audioManager.playAudio(audioContent);
          console.log('🔊 TTS playback successful');
        } else {
          throw new Error('No audio content received');
        }
      } else {
        const errorText = await response.text();
        console.error('🔊 TTS error:', response.status, errorText);
        
        if (response.status >= 500 && retryAttempt < 2) {
          console.log(`🔊 Retrying TTS request (attempt ${retryAttempt + 1})`);
          setTimeout(() => {
            playTranslatedText(text, retryAttempt + 1);
          }, 1000 * (retryAttempt + 1));
          return;
        }
        
        throw new Error(`TTS failed: ${errorText}`);
      }
    } catch (error) {
      console.error('🔊 Error playing TTS:', error);
      
      let errorMessage = language === 'ar' ? 'فشل في تشغيل الصوت' : 'Failed to play audio';
      if (error.message.includes('Rate limit')) {
        errorMessage = language === 'ar' ? 'تم تجاوز الحد المسموح، حاول مرة أخرى' : 'Rate limit exceeded, please try again';
      } else if (error.message.includes('timeout')) {
        errorMessage = language === 'ar' ? 'انتهت مهلة الاتصال، حاول مرة أخرى' : 'Request timeout, please try again';
      }
      
      toast({
        title: language === 'ar' ? 'خطأ في التشغيل' : 'Playback Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsPlaying(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: language === 'ar' ? 'تم النسخ' : 'Copied',
        description: language === 'ar' ? 'تم نسخ النص المترجم' : 'Translated text copied to clipboard',
      });
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const remainingTime = MAX_RECORDING_TIME - seconds;
    return `${remainingTime}s`;
  };

  const handlePurchaseExtra = async () => {
    const success = await purchaseExtraTranslations(EXTRA_TRANSLATIONS_COUNT);
    return success;
  };

  if (isLoadingQuota) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              {language === 'ar' ? '🎤 مترجم الصوت' : '🎤 Voice Translator'}
            </span>
            <div className="flex items-center gap-2 text-sm">
              {quotaError ? (
                <div className="text-orange-600 text-xs">
                  {language === 'ar' ? 'خطأ في البيانات' : 'Data error'}
                </div>
              ) : (
                <div className={cn(
                  "font-medium",
                  isAtHardLimit ? "text-red-600" : isAtSoftLimit ? "text-orange-600" : "text-muted-foreground"
                )}>
                  {remainingFreeTranslations}/{MAX_DAILY_TRANSLATIONS}
                  {userQuota.extra_translations > 0 && (
                    <span className="text-green-600"> + {userQuota.extra_translations} extra</span>
                  )}
                </div>
              )}
            </div>
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

          {/* Quota error warning */}
          {quotaError && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <p className="text-sm text-orange-600 dark:text-orange-400">
                {language === 'ar' 
                  ? 'تعذر تحميل بيانات الحصة، ولكن يمكنك المتابعة' 
                  : 'Could not load quota data, but you can continue'
                }
              </p>
            </div>
          )}

          {/* Limit warnings */}
          {!quotaError && isAtHardLimit && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <p className="text-sm text-red-600 dark:text-red-400">
                {language === 'ar' 
                  ? 'لقد وصلت للحد الأقصى من الترجمات اليومية.' 
                  : "You've reached your daily translation limit."
                }
              </p>
              <Button size="sm" onClick={handlePurchaseExtra} className="ml-auto">
                <Plus className="h-3 w-3 mr-1" />
                {EXTRA_TRANSLATIONS_PRICE} QAR
              </Button>
            </div>
          )}

          {!quotaError && isAtSoftLimit && !isAtHardLimit && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <p className="text-sm text-orange-600 dark:text-orange-400">
                {language === 'ar' 
                  ? 'اقتربت من الحد الأقصى للترجمات اليومية.' 
                  : 'You\'re nearing your daily limit.'
                }
              </p>
            </div>
          )}

          {/* Daily reset info */}
          {!quotaError && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {language === 'ar' ? 'الحصة المجانية تتجدد يومياً في منتصف الليل' : 'Free quota resets daily at midnight'}
            </div>
          )}

          {/* Language Selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              {language === 'ar' ? 'ترجم إلى:' : 'Translate to:'}
            </label>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
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

            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing || (!quotaError && !canTranslate)}
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
                <div className="text-sm font-medium mb-2">{translatedText}</div>
                <div className="flex justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(translatedText)}
                    className="h-8 w-8 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => playTranslatedText(translatedText)}
                    disabled={isPlaying}
                    className="h-8 w-8 p-0"
                  >
                    {isPlaying ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Volume2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Extra translations purchase */}
          {!quotaError && !isAtHardLimit && userQuota.extra_translations === 0 && (
            <div className="pt-2 border-t">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePurchaseExtra}
                className="w-full"
              >
                <Plus className="h-3 w-3 mr-2" />
                {language === 'ar' 
                  ? `شراء ${EXTRA_TRANSLATIONS_COUNT} ترجمة إضافية (${EXTRA_TRANSLATIONS_PRICE} ريال)` 
                  : `Buy ${EXTRA_TRANSLATIONS_COUNT} extra translations (${EXTRA_TRANSLATIONS_PRICE} QAR)`
                }
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
