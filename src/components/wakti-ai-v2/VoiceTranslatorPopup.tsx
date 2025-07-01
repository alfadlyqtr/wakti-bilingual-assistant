
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Mic, Square, Copy, Loader2, AlertTriangle, Volume2 } from 'lucide-react';
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

const MAX_RECORDING_TIME = 15;

export function VoiceTranslatorPopup({ open, onOpenChange }: VoiceTranslatorPopupProps) {
  const { user } = useAuth();
  const { language } = useTheme();
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [cachedAudio, setCachedAudio] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Clear translation when language changes
  useEffect(() => {
    console.log('🎤 Language changed to:', selectedLanguage);
    setTranslatedText('');
    setProcessingError(null);
    setCachedAudio(null);
  }, [selectedLanguage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    console.log('🎤 SIMPLE: Starting recording...');
    setProcessingError(null);

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
      
      console.log('🎤 SIMPLE: Microphone access granted');
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingTime(0);
      setTranslatedText('');
      setCachedAudio(null);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🎤 SIMPLE: Recording stopped, processing...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('🎤 SIMPLE: Audio blob size:', audioBlob.size);
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
      console.error('🎤 SIMPLE: Recording error:', error);
      setProcessingError(language === 'ar' ? 'فشل في بدء التسجيل' : 'Failed to start recording');
    }
  }, [language, selectedLanguage]);

  const stopRecording = useCallback(() => {
    console.log('🎤 SIMPLE: Stopping recording...');
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  }, [isRecording]);

  // SIMPLE: Process voice translation
  const processVoiceTranslation = useCallback(async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);
      setProcessingError(null);
      console.log('🎤 SIMPLE: Starting voice translation flow');

      const formData = new FormData();
      formData.append('audioBlob', audioBlob, 'audio.webm');
      formData.append('targetLanguage', selectedLanguage);
      formData.append('autoPlayEnabled', autoPlayEnabled.toString());

      console.log('🎤 SIMPLE: Calling unified-ai-brain');

      const { data, error } = await supabase.functions.invoke('unified-ai-brain', {
        body: formData
      });

      console.log('🎤 SIMPLE: Response received:', { data, error });

      if (error) {
        console.error('🎤 SIMPLE: Error:', error);
        throw new Error(error.message || 'Translation service error');
      }

      if (!data?.translatedText) {
        throw new Error('No translation received');
      }

      console.log('🎤 SIMPLE: Translation successful:', data.translatedText);
      setTranslatedText(data.translatedText);

      // Cache the TTS audio if available
      if (data.ttsAudio?.audioContent) {
        console.log('🔊 SIMPLE: TTS audio received, size:', data.ttsAudio.size);
        setCachedAudio(data.ttsAudio.audioContent);

        // AUTO-PLAY: If enabled, play immediately
        if (autoPlayEnabled) {
          console.log('🔊 SIMPLE: Auto-playing TTS');
          await playAudioDirectly(data.ttsAudio.audioContent);
        }
      }

      toast({
        title: language === 'ar' ? '✅ تمت الترجمة' : '✅ Translation Complete',
        description: language === 'ar' 
          ? `تم إنجاز الترجمة بنجاح${autoPlayEnabled ? ' وتم تشغيلها تلقائياً' : ''}` 
          : `Translation completed successfully${autoPlayEnabled ? ' and played automatically' : ''}`,
      });

    } catch (error) {
      console.error('🎤 SIMPLE: Translation error:', error);
      
      let errorMessage = language === 'ar' 
        ? 'فشل في ترجمة الصوت - يرجى المحاولة مرة أخرى' 
        : 'Voice translation failed - please try again';

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
  }, [selectedLanguage, language, autoPlayEnabled]);

  // SIMPLE: Play audio directly
  const playAudioDirectly = useCallback(async (base64Audio: string) => {
    try {
      console.log('🔊 SIMPLE: Playing audio directly');
      setIsPlaying(true);

      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      // Create new audio element
      const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
      currentAudioRef.current = audio;
      
      audio.onended = () => {
        console.log('🔊 SIMPLE: Audio playback completed');
        setIsPlaying(false);
        currentAudioRef.current = null;
      };
      
      audio.onerror = (error) => {
        console.error('🔊 SIMPLE: Audio playback error:', error);
        setIsPlaying(false);
        currentAudioRef.current = null;
        throw new Error('Audio playback failed');
      };

      await audio.play();
      console.log('🔊 SIMPLE: Audio started playing');

    } catch (error) {
      console.error('🔊 SIMPLE: Play error:', error);
      setIsPlaying(false);
      currentAudioRef.current = null;
      
      toast({
        title: language === 'ar' ? 'خطأ في التشغيل' : 'Playback Error',
        description: language === 'ar' ? 'فشل في تشغيل الصوت' : 'Failed to play audio',
        variant: 'destructive'
      });
    }
  }, [language]);

  // SIMPLE: Play translated text
  const playTranslatedText = useCallback(async () => {
    console.log('🔊 SIMPLE: Play button clicked');
    
    if (isPlaying) {
      console.log('🔊 SIMPLE: Stopping current audio');
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setIsPlaying(false);
      return;
    }

    try {
      // Use cached audio if available
      if (cachedAudio) {
        console.log('🔊 SIMPLE: Using cached audio');
        await playAudioDirectly(cachedAudio);
        return;
      }

      // Generate new TTS
      console.log('🔊 SIMPLE: Generating new TTS');
      setIsPlaying(true);
      
      const { data, error } = await supabase.functions.invoke('unified-ai-brain', {
        body: JSON.stringify({
          text: translatedText,
          voice: 'alloy',
          language: selectedLanguage,
          requestType: 'tts'
        })
      });

      if (error || !data?.audioContent) {
        throw new Error(error?.message || 'TTS generation failed');
      }

      console.log('🔊 SIMPLE: TTS generated, playing...');
      setCachedAudio(data.audioContent);
      await playAudioDirectly(data.audioContent);

    } catch (error) {
      console.error('🔊 SIMPLE: TTS error:', error);
      setIsPlaying(false);
      
      toast({
        title: language === 'ar' ? 'خطأ في التشغيل' : 'Playback Error',
        description: language === 'ar' ? 'فشل في تشغيل الصوت' : 'Failed to play audio',
        variant: 'destructive'
      });
    }
  }, [translatedText, selectedLanguage, cachedAudio, isPlaying, language]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      setIsCopying(true);
      await navigator.clipboard.writeText(text);
      
      toast({
        title: language === 'ar' ? '✅ تم النسخ' : '✅ Copied',
        description: language === 'ar' ? 'تم نسخ النص المترجم' : 'Translated text copied',
      });
    } catch (error) {
      console.error('📋 Copy error:', error);
      toast({
        title: language === 'ar' ? '❌ فشل النسخ' : '❌ Copy Failed',
        description: language === 'ar' ? 'فشل في نسخ النص' : 'Failed to copy text',
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {language === 'ar' ? '🎤 مترجم الصوت البسيط' : '🎤 Simple Voice Translator'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error display */}
          {processingError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <p className="text-sm text-red-600 dark:text-red-400">
                {processingError}
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

          {/* Auto-Play Toggle */}
          <div className="flex items-center space-x-2">
            <Switch 
              id="autoplay" 
              checked={autoPlayEnabled} 
              onCheckedChange={setAutoPlayEnabled}
            />
            <Label htmlFor="autoplay" className="text-sm font-medium">
              {language === 'ar' ? 'تشغيل تلقائي' : 'Auto-play'}
            </Label>
            <span className="text-xs text-muted-foreground">
              {autoPlayEnabled 
                ? (language === 'ar' ? '(مفعل)' : '(ON)') 
                : (language === 'ar' ? '(معطل)' : '(OFF)')
              }
            </span>
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
                  {language === 'ar' ? 'معالجة بسيطة...' : 'Processing...'}
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
                : 'Press to record (up to 15 seconds)'
              }
            </p>
          </div>

          {/* Translation Results */}
          {translatedText && (
            <div className="space-y-3">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-center">
                <div className="text-sm font-medium mb-3">{translatedText}</div>
                <div className="flex justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(translatedText)}
                    disabled={isCopying}
                    className="flex items-center gap-2"
                  >
                    {isCopying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {language === 'ar' ? 'نسخ' : 'Copy'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={playTranslatedText}
                    disabled={isPlaying}
                    className="flex items-center gap-2"
                  >
                    {isPlaying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                    {language === 'ar' ? 'تشغيل' : 'Play'}
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
