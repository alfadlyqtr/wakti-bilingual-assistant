import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Mic, Square, Copy, Loader2, AlertTriangle, Play, Plus, Clock, Speaker } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceTranslatorPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TranslationHistory {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: Date;
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

const MAX_DAILY_TRANSLATIONS = 25;
const SOFT_WARNING_THRESHOLD = 20;
const MAX_RECORDING_TIME = 15; // 15 seconds
const COOLDOWN_TIME = 5000; // 5 seconds
const EXTRA_TRANSLATIONS_PRICE = 10; // 10 QAR
const EXTRA_TRANSLATIONS_COUNT = 100;

export function VoiceTranslatorPopup({ open, onOpenChange }: VoiceTranslatorPopupProps) {
  const { user } = useAuth();
  const { language } = useTheme();
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [dailyCount, setDailyCount] = useState(0);
  const [extraTranslations, setExtraTranslations] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [translationHistory, setTranslationHistory] = useState<TranslationHistory[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load daily translation count and extras on mount
  useEffect(() => {
    if (open && user) {
      loadDailyData();
    }
  }, [open, user]);

  // Cleanup recording timer
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const loadDailyData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Load daily count
      const storedData = localStorage.getItem('voice_translator_daily_count');
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if (parsed.date === today) {
          setDailyCount(parsed.count);
        } else {
          setDailyCount(0);
          localStorage.setItem('voice_translator_daily_count', JSON.stringify({
            date: today,
            count: 0
          }));
        }
      } else {
        setDailyCount(0);
        localStorage.setItem('voice_translator_daily_count', JSON.stringify({
          date: today,
          count: 0
        }));
      }

      // Load extra translations (simulate from localStorage for now)
      const extraData = localStorage.getItem('voice_translator_extras');
      if (extraData) {
        const parsed = JSON.parse(extraData);
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        
        if (new Date(parsed.purchaseDate) > oneMonthAgo) {
          setExtraTranslations(parsed.count);
        } else {
          setExtraTranslations(0);
          localStorage.removeItem('voice_translator_extras');
        }
      } else {
        setExtraTranslations(0);
      }
    } catch (error) {
      console.error('Error loading daily data:', error);
      setDailyCount(0);
      setExtraTranslations(0);
    }
  };

  const incrementTranslationCount = () => {
    const today = new Date().toISOString().split('T')[0];
    
    if (dailyCount < MAX_DAILY_TRANSLATIONS) {
      const newCount = dailyCount + 1;
      setDailyCount(newCount);
      localStorage.setItem('voice_translator_daily_count', JSON.stringify({
        date: today,
        count: newCount
      }));
    } else if (extraTranslations > 0) {
      const newExtras = extraTranslations - 1;
      setExtraTranslations(newExtras);
      localStorage.setItem('voice_translator_extras', JSON.stringify({
        count: newExtras,
        purchaseDate: new Date().toISOString()
      }));
    }
  };

  const purchaseExtraTranslations = () => {
    // Simulate purchase - in real implementation, integrate with payment system
    const newExtras = extraTranslations + EXTRA_TRANSLATIONS_COUNT;
    setExtraTranslations(newExtras);
    localStorage.setItem('voice_translator_extras', JSON.stringify({
      count: newExtras,
      purchaseDate: new Date().toISOString()
    }));
    
    toast({
      title: language === 'ar' ? 'تم الشراء بنجاح' : 'Purchase Successful',
      description: language === 'ar' 
        ? `تم إضافة ${EXTRA_TRANSLATIONS_COUNT} ترجمة إضافية` 
        : `Added ${EXTRA_TRANSLATIONS_COUNT} extra translations`,
    });
  };

  const startRecording = async () => {
    const canTranslate = dailyCount < MAX_DAILY_TRANSLATIONS || extraTranslations > 0;
    
    if (!canTranslate) {
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

      // Start timer
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
        setTranslatedText(result.translatedText);
        incrementTranslationCount();
        
        // Add to session history
        const newTranslation: TranslationHistory = {
          id: Date.now().toString(),
          originalText: result.originalText,
          translatedText: result.translatedText,
          sourceLanguage: result.sourceLanguage,
          targetLanguage: result.targetLanguage,
          timestamp: new Date()
        };
        setTranslationHistory(prev => [newTranslation, ...prev.slice(0, 9)]); // Keep last 10
        
        // Start cooldown
        setIsOnCooldown(true);
        setTimeout(() => setIsOnCooldown(false), COOLDOWN_TIME);

        toast({
          title: language === 'ar' ? '✅ تمت الترجمة' : '✅ Translation Complete',
          description: language === 'ar' ? 'تم إنجاز الترجمة بنجاح' : 'Translation completed successfully',
        });

        // Auto-play if enabled
        if (playbackEnabled) {
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

  const playTranslatedText = async (text: string) => {
    try {
      setIsPlaying(true);
      
      // Call TTS edge function (would need to be implemented)
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/generate-speech', {
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
        const audio = new Audio(`data:audio/mp3;base64,${result.audioContent}`);
        audio.onended = () => setIsPlaying(false);
        await audio.play();
      }
    } catch (error) {
      console.error('Error playing audio:', error);
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

  const remainingFreeTranslations = MAX_DAILY_TRANSLATIONS - dailyCount;
  const isAtSoftLimit = dailyCount >= SOFT_WARNING_THRESHOLD;
  const isAtHardLimit = dailyCount >= MAX_DAILY_TRANSLATIONS && extraTranslations === 0;
  const canTranslate = remainingFreeTranslations > 0 || extraTranslations > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              {language === 'ar' ? '🎤 مترجم الصوت' : '🎤 Voice Translator'}
            </span>
            <div className="flex items-center gap-2 text-sm">
              <div className={cn(
                "font-medium",
                isAtHardLimit ? "text-red-600" : isAtSoftLimit ? "text-orange-600" : "text-muted-foreground"
              )}>
                {remainingFreeTranslations}/{MAX_DAILY_TRANSLATIONS}
                {extraTranslations > 0 && (
                  <span className="text-green-600"> + {extraTranslations} extra</span>
                )}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Limit warnings */}
          {isAtHardLimit && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <p className="text-sm text-red-600 dark:text-red-400">
                {language === 'ar' 
                  ? 'لقد وصلت للحد الأقصى من الترجمات اليومية.' 
                  : "You've reached your daily translation limit."
                }
              </p>
              <Button size="sm" onClick={purchaseExtraTranslations} className="ml-auto">
                <Plus className="h-3 w-3 mr-1" />
                {EXTRA_TRANSLATIONS_PRICE} QAR
              </Button>
            </div>
          )}

          {isAtSoftLimit && !isAtHardLimit && (
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
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {language === 'ar' ? 'الحصة المجانية تتجدد يومياً' : 'Free quota resets daily'}
          </div>

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

          {/* Playback Toggle with Speaker Icon */}
          <div className="flex items-center space-x-2">
            <Switch 
              id="playback" 
              checked={playbackEnabled} 
              onCheckedChange={setPlaybackEnabled}
            />
            <Speaker className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="playback" className="text-sm">
              {language === 'ar' ? 'تشغيل الترجمة صوتياً' : 'Play translated text'}
            </Label>
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
              disabled={isProcessing || !canTranslate}
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  {language === 'ar' ? 'الترجمة:' : 'Translation:'}
                </label>
                <div className="flex gap-2">
                  {playbackEnabled && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => playTranslatedText(translatedText)}
                      disabled={isPlaying}
                      className="h-6 w-6"
                    >
                      {isPlaying ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(translatedText)}
                    className="h-6 w-6"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-sm">
                {translatedText}
              </div>
            </div>
          )}

          {/* Translation History */}
          {translationHistory.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {language === 'ar' ? 'السجل:' : 'Session History:'}
              </label>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {translationHistory.map((translation) => (
                  <div key={translation.id} className="p-2 bg-muted/50 rounded text-xs">
                    <div className="font-medium truncate">{translation.translatedText}</div>
                    <div className="text-muted-foreground truncate">{translation.originalText}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extra translations purchase */}
          {!isAtHardLimit && extraTranslations === 0 && (
            <div className="pt-2 border-t">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={purchaseExtraTranslations}
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
