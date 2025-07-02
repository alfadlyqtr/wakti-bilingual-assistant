import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MicOff, Play, Pause, Download, Volume2, Globe, MessageSquare, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VoiceClone {
  id: string;
  voice_id: string;
  voice_name: string;
  voice_description: string;
  created_at: string;
}

interface VoiceCloneScreen3Props {
  voices: VoiceClone[];
}

export function VoiceCloneScreen3({ voices }: VoiceCloneScreen3Props) {
  const { language } = useTheme();
  const { toast } = useToast();
  
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('ar');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('natural');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [characterUsage, setCharacterUsage] = useState(0);
  const [totalUsage, setTotalUsage] = useState(0);
  const [isListening, setIsListening] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = language === 'ar' ? 'ar-SA' : 'en-US';
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => prev + ' ' + transcript);
        setIsListening(false);
      };
      
      recognitionRef.current.onerror = () => {
        setIsListening(false);
        toast({
          title: language === 'ar' ? 'خطأ في التعرف على الصوت' : 'Speech Recognition Error',
          description: language === 'ar' ? 'فشل في التعرف على الصوت' : 'Failed to recognize speech',
          variant: 'destructive',
        });
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [language, toast]);

  const supportedLanguages = [
    { code: 'en', name: language === 'ar' ? 'الإنجليزية' : 'English' },
    { code: 'ar', name: language === 'ar' ? 'العربية' : 'Arabic' },
    { code: 'ja', name: language === 'ar' ? 'اليابانية' : 'Japanese' },
    { code: 'zh', name: language === 'ar' ? 'الصينية' : 'Chinese' },
    { code: 'de', name: language === 'ar' ? 'الألمانية' : 'German' },
    { code: 'hi', name: language === 'ar' ? 'الهندية' : 'Hindi' },
    { code: 'fr', name: language === 'ar' ? 'الفرنسية' : 'French' },
    { code: 'ko', name: language === 'ar' ? 'الكورية' : 'Korean' },
    { code: 'pt', name: language === 'ar' ? 'البرتغالية' : 'Portuguese' },
    { code: 'it', name: language === 'ar' ? 'الإيطالية' : 'Italian' },
    { code: 'es', name: language === 'ar' ? 'الإسبانية' : 'Spanish' },
    { code: 'ru', name: language === 'ar' ? 'الروسية' : 'Russian' },
    { code: 'tr', name: language === 'ar' ? 'التركية' : 'Turkish' },
    { code: 'pl', name: language === 'ar' ? 'البولندية' : 'Polish' },
    { code: 'sv', name: language === 'ar' ? 'السويدية' : 'Swedish' },
    { code: 'da', name: language === 'ar' ? 'الدنماركية' : 'Danish' },
    { code: 'no', name: language === 'ar' ? 'النرويجية' : 'Norwegian' },
    { code: 'fi', name: language === 'ar' ? 'الفنلندية' : 'Finnish' },
    { code: 'nl', name: language === 'ar' ? 'الهولندية' : 'Dutch' },
    { code: 'he', name: language === 'ar' ? 'العبرية' : 'Hebrew' },
  ];

  const voiceStyles = [
    { value: 'natural', label: language === 'ar' ? 'طبيعي' : 'Natural' },
    { value: 'poem', label: language === 'ar' ? 'شعري' : 'Poem' },
    { value: 'dramatic', label: language === 'ar' ? 'درامي' : 'Dramatic' },
    { value: 'calm', label: language === 'ar' ? 'هادئ' : 'Calm' },
    { value: 'excited', label: language === 'ar' ? 'متحمس' : 'Excited' },
    { value: 'serious', label: language === 'ar' ? 'جدي' : 'Serious' },
  ];

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const translateText = async () => {
    if (!inputText.trim()) {
      toast({
        title: language === 'ar' ? 'لا يوجد نص' : 'No Text',
        description: language === 'ar' ? 'يرجى إدخال نص للترجمة' : 'Please enter text to translate',
        variant: 'destructive',
      });
      return;
    }

    setIsTranslating(true);

    try {
      const { data, error } = await supabase.functions.invoke('voice-clone-translator', {
        body: {
          original_text: inputText,
          target_language: selectedLanguage
        },
      });

      if (error) throw error;

      if (data.success) {
        setTranslatedText(data.translated_text);
        setCharacterUsage(data.translated_text.length);
      } else {
        throw new Error(data.error || 'Translation failed');
      }
    } catch (error: any) {
      console.error('Translation error:', error);
      toast({
        title: language === 'ar' ? 'خطأ في الترجمة' : 'Translation Error',
        description: error.message || (language === 'ar' ? 'فشل في ترجمة النص' : 'Failed to translate text'),
        variant: 'destructive',
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const generateSpeech = async () => {
    if (!translatedText.trim()) {
      toast({
        title: language === 'ar' ? 'لا يوجد نص مترجم' : 'No Translated Text',
        description: language === 'ar' ? 'يرجى ترجمة النص أولاً' : 'Please translate text first',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedVoice) {
      toast({
        title: language === 'ar' ? 'لم يتم اختيار صوت' : 'No Voice Selected',
        description: language === 'ar' ? 'يرجى اختيار صوت من قائمة الأصوات' : 'Please select a voice from the list',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
        body: {
          text: translatedText,
          voice_id: selectedVoice,
          voice_style: selectedStyle
        },
      });

      if (error) throw error;

      if (data.success) {
        setAudioUrl(data.audio_url);
        setTotalUsage(data.total_usage);
        
        if (data.quota_warning) {
          toast({
            title: language === 'ar' ? 'تحذير الحصة' : 'Quota Warning',
            description: data.quota_warning,
            variant: 'destructive',
          });
        } else {
          toast({
            title: language === 'ar' ? 'تم إنشاء الصوت' : 'Audio Generated',
            description: language === 'ar' ? 'تم إنشاء الصوت بنجاح!' : 'Audio generated successfully!',
          });
        }
      } else {
        throw new Error(data.error || 'Speech generation failed');
      }
    } catch (error: any) {
      console.error('TTS error:', error);
      toast({
        title: language === 'ar' ? 'خطأ في إنشاء الصوت' : 'Speech Generation Error',
        description: error.message || (language === 'ar' ? 'فشل في إنشاء الصوت' : 'Failed to generate speech'),
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlayback = () => {
    if (!audioUrl) return;
    
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `voice_clone_${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Usage Quota */}
        <Card className="bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg text-slate-700 dark:text-slate-300 flex items-center">
              <Zap className="h-5 w-5 mr-2 text-accent-blue" />
              {language === 'ar' ? 'حصة الاستخدام' : 'Usage Quota'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                  {totalUsage.toLocaleString()}/6,000
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {language === 'ar' ? 'حرف مستخدم' : 'characters used'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {language === 'ar' ? 'الأصوات المحفوظة' : 'Saved Voices'}
                </div>
                <div className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                  {voices.length}/3
                </div>
              </div>
            </div>
            <div className="mt-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div 
                className="bg-accent-blue rounded-full h-2 transition-all duration-300"
                style={{ width: `${Math.min((totalUsage / 6000) * 100, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Translation Section */}
        <Card className="bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg text-slate-700 dark:text-slate-300 flex items-center">
              <Globe className="h-5 w-5 mr-2 text-accent-green" />
              {language === 'ar' ? 'الترجمة' : 'Translation'}
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              {language === 'ar' ? 'أدخل النص أو استخدم الميكروفون للترجمة' : 'Enter text or use microphone for translation'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Input Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {language === 'ar' ? 'النص الأصلي' : 'Original Text'}
                </label>
                {recognitionRef.current && (
                  <Button
                    onClick={isListening ? stopListening : startListening}
                    variant="ghost"
                    size="sm"
                    className={`text-sm ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                )}
              </div>
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={language === 'ar' ? 'اكتب النص هنا أو استخدم الميكروفون' : 'Type text here or use microphone'}
                className="bg-white/10 border-white/20 text-slate-700 dark:text-slate-300 min-h-[100px]"
              />
            </div>

            {/* Language Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {language === 'ar' ? 'ترجمة إلى' : 'Translate to'}
              </label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="bg-white/10 border-white/20 text-slate-700 dark:text-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-800 border-white/20 max-h-60 overflow-y-auto z-50">
                  {supportedLanguages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={translateText}
              disabled={isTranslating || !inputText.trim()}
              className="w-full bg-accent-green hover:bg-accent-green/80 text-white"
            >
              {isTranslating ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{language === 'ar' ? 'جاري الترجمة...' : 'Translating...'}</span>
                </div>
              ) : (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'ترجمة' : 'Translate'}
                </>
              )}
            </Button>

            {/* Translated Text */}
            {translatedText && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {language === 'ar' ? 'النص المترجم' : 'Translated Text'}
                </label>
                <Textarea
                  value={translatedText}
                  onChange={(e) => setTranslatedText(e.target.value)}
                  className="bg-white/10 border-white/20 text-slate-700 dark:text-slate-300 min-h-[100px]"
                />
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {translatedText.length} {language === 'ar' ? 'حرف' : 'characters'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Speech Synthesis Section */}
        {translatedText && (
          <Card className="bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg text-slate-700 dark:text-slate-300 flex items-center">
                <Volume2 className="h-5 w-5 mr-2 text-accent-purple" />
                {language === 'ar' ? 'تحويل النص إلى صوت' : 'Text to Speech'}
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'اختر الصوت والنمط لإنشاء الصوت' : 'Select voice and style to generate audio'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Voice Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {language === 'ar' ? 'اختر الصوت' : 'Select Voice'}
                  </label>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-slate-700 dark:text-slate-300">
                      <SelectValue placeholder={language === 'ar' ? 'اختر صوت...' : 'Select voice...'} />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800 border-white/20 z-50">
                      {voices.slice(0, 3).map((voice) => (
                        <SelectItem key={voice.voice_id} value={voice.voice_id}>
                          {voice.voice_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {language === 'ar' ? 'نمط الصوت' : 'Voice Style'}
                  </label>
                  <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-slate-700 dark:text-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800 border-white/20 z-50">
                      {voiceStyles.map((style) => (
                        <SelectItem key={style.value} value={style.value}>
                          {style.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={generateSpeech}
                disabled={isGenerating || !translatedText.trim() || !selectedVoice}
                className="w-full bg-accent-purple hover:bg-accent-purple/80 text-white"
              >
                {isGenerating ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{language === 'ar' ? 'جاري الإنشاء...' : 'Generating...'}</span>
                  </div>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'إنشاء الصوت' : 'Generate Speech'}
                  </>
                )}
              </Button>

              {/* Audio Controls */}
              {audioUrl && (
                <div className="flex space-x-2 rtl:space-x-reverse pt-4 border-t border-white/10">
                  <Button
                    onClick={togglePlayback}
                    variant="outline"
                    className="flex-1 border-white/30 dark:border-white/20 text-slate-700 dark:text-slate-300"
                  >
                    {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {isPlaying ? (language === 'ar' ? 'إيقاف' : 'Pause') : (language === 'ar' ? 'تشغيل' : 'Play')}
                  </Button>
                  
                  <Button
                    onClick={downloadAudio}
                    variant="outline"
                    className="flex-1 border-white/30 dark:border-white/20 text-slate-700 dark:text-slate-300"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'تحميل' : 'Download'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}