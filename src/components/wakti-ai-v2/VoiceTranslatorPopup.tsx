
import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Mic, Square, Copy, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceTranslatorPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

const MAX_DAILY_TRANSLATIONS = 50;
const SOFT_WARNING_THRESHOLD = 25;
const MAX_RECORDING_TIME = 15; // 15 seconds
const COOLDOWN_TIME = 5000; // 5 seconds

export function VoiceTranslatorPopup({ open, onOpenChange }: VoiceTranslatorPopupProps) {
  const { user } = useAuth();
  const { language } = useTheme();
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [dailyCount, setDailyCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load daily translation count on mount
  useEffect(() => {
    if (open && user) {
      loadDailyCount();
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

  const loadDailyCount = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Check if we have a count stored in localStorage for today
      const storedData = localStorage.getItem('voice_translator_daily_count');
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if (parsed.date === today) {
          setDailyCount(parsed.count);
          return;
        }
      }
      
      // Reset count for new day
      setDailyCount(0);
      localStorage.setItem('voice_translator_daily_count', JSON.stringify({
        date: today,
        count: 0
      }));
    } catch (error) {
      console.error('Error loading daily count:', error);
      setDailyCount(0);
    }
  };

  const incrementDailyCount = () => {
    const newCount = dailyCount + 1;
    setDailyCount(newCount);
    
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('voice_translator_daily_count', JSON.stringify({
      date: today,
      count: newCount
    }));
  };

  const startRecording = async () => {
    if (dailyCount >= MAX_DAILY_TRANSLATIONS) {
      toast({
        title: language === 'ar' ? 'تم الوصول للحد اليومي' : 'Daily Limit Reached',
        description: language === 'ar' ? 'لقد وصلت للحد الأقصى من الترجمات اليومية (50)' : "You've reached your daily translation limit (50).",
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

      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session found');
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('audioBlob', audioBlob, 'audio.webm');
      formData.append('targetLanguage', selectedLanguage);

      console.log('🎤 Voice Translator: Processing translation...');

      // Call the voice translator edge function
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
        incrementDailyCount();
        
        // Start cooldown
        setIsOnCooldown(true);
        setTimeout(() => setIsOnCooldown(false), COOLDOWN_TIME);

        toast({
          title: language === 'ar' ? '✅ تمت الترجمة' : '✅ Translation Complete',
          description: language === 'ar' ? 'تم إنجاز الترجمة بنجاح' : 'Translation completed successfully',
        });
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

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(translatedText);
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

  const remainingTranslations = MAX_DAILY_TRANSLATIONS - dailyCount;
  const isAtSoftLimit = dailyCount >= SOFT_WARNING_THRESHOLD;
  const isAtHardLimit = dailyCount >= MAX_DAILY_TRANSLATIONS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              {language === 'ar' ? '🎤 مترجم الصوت' : '🎤 Voice Translator'}
            </span>
            <div className={cn(
              "text-sm font-medium",
              isAtHardLimit ? "text-red-600" : isAtSoftLimit ? "text-orange-600" : "text-muted-foreground"
            )}>
              {language === 'ar' ? 'ترجمات متبقية:' : 'Translations left:'} {remainingTranslations}/{MAX_DAILY_TRANSLATIONS}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hard limit warning */}
          {isAtHardLimit && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <p className="text-sm text-red-600 dark:text-red-400">
                {language === 'ar' 
                  ? 'لقد وصلت للحد الأقصى من الترجمات اليومية.' 
                  : "You've reached your daily translation limit."
                }
              </p>
            </div>
          )}

          {/* Soft limit warning */}
          {isAtSoftLimit && !isAtHardLimit && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <p className="text-sm text-orange-600 dark:text-orange-400">
                {language === 'ar' 
                  ? 'اقتربت من الحد الأقصى للترجمات اليومية.' 
                  : 'You\'re approaching your daily translation limit.'
                }
              </p>
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
              disabled={isProcessing || isAtHardLimit}
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
              <label className="text-sm font-medium">
                {language === 'ar' ? 'الترجمة:' : 'Translation:'}
              </label>
              <div className="relative">
                <div className="p-3 bg-muted rounded-lg text-sm">
                  {translatedText}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyToClipboard}
                  className="absolute top-2 right-2 h-6 w-6"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
