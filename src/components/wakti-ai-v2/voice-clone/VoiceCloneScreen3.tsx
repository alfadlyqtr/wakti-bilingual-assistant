
import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, Download, Mic, Volume2, Rewind, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VoiceClone {
  id: string;
  voice_id: string;
  voice_name: string;
  voice_description: string;
  created_at: string;
}

interface VoiceUsage {
  characters_used: number;
  extra_characters: number;
  last_used_at: string;
}

interface VoiceCloneScreen3Props {
  voices: VoiceClone[];
}

const ELEVENLABS_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'zh', name: 'Chinese (Mandarin)', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių' },
  { code: 'mt', name: 'Maltese', nativeName: 'Malti' },
  { code: 'ga', name: 'Irish', nativeName: 'Gaeilge' },
  { code: 'cy', name: 'Welsh', nativeName: 'Cymraeg' },
  { code: 'eu', name: 'Basque', nativeName: 'Euskera' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català' },
  { code: 'gl', name: 'Galician', nativeName: 'Galego' },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  { code: 'tl', name: 'Filipino', nativeName: 'Filipino' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans' },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan' },
  { code: 'be', name: 'Belarusian', nativeName: 'Беларуская' },
  { code: 'bs', name: 'Bosnian', nativeName: 'Bosanski' },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақша' },
  { code: 'ky', name: 'Kyrgyz', nativeName: 'Кыргызча' },
  { code: 'mk', name: 'Macedonian', nativeName: 'Македонски' },
  { code: 'mn', name: 'Mongolian', nativeName: 'Монгол' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски' },
  { code: 'tg', name: 'Tajik', nativeName: 'Тоҷикӣ' },
  { code: 'tt', name: 'Tatar', nativeName: 'Татарча' },
  { code: 'tk', name: 'Turkmen', nativeName: 'Türkmençe' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbekcha' },
  { code: 'hy', name: 'Armenian', nativeName: 'Հայերեն' }
];

const VOICE_STYLES = [
  { value: 'natural', label: 'Natural' },
  { value: 'poem', label: 'Poem' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'calm', label: 'Calm' },
  { value: 'excited', label: 'Excited' },
  { value: 'serious', label: 'Serious' }
];

export function VoiceCloneScreen3({ voices }: VoiceCloneScreen3Props) {
  const { language } = useTheme();
  const [voiceUsage, setVoiceUsage] = useState<VoiceUsage | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('natural');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Load voice usage data
  useEffect(() => {
    loadVoiceUsage();
  }, []);

  // Set default voice if available
  useEffect(() => {
    if (voices.length > 0 && !selectedVoice) {
      setSelectedVoice(voices[0].voice_id);
    }
  }, [voices, selectedVoice]);

  const loadVoiceUsage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_voice_usage')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setVoiceUsage({
          characters_used: data.characters_used || 0,
          extra_characters: data.extra_characters || 0,
          last_used_at: data.last_used_at
        });
      }
    } catch (error) {
      console.error('Failed to load voice usage:', error);
    }
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        
        // Convert to base64 and transcribe
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          
          try {
            const { data, error } = await supabase.functions.invoke('wakti-voice-transcription', {
              body: { audio: base64Audio }
            });

            if (error) throw error;
            
            if (data.text) {
              setInputText(data.text);
              toast.success(language === 'ar' ? 'تم تحويل الصوت إلى نص' : 'Voice transcribed successfully');
            }
          } catch (error) {
            console.error('Transcription error:', error);
            toast.error(language === 'ar' ? 'فشل في تحويل الصوت' : 'Voice transcription failed');
          }
        };
        reader.readAsDataURL(audioBlob);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Recording error:', error);
      toast.error(language === 'ar' ? 'فشل في بدء التسجيل' : 'Failed to start recording');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const translateText = async () => {
    if (!inputText.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال النص' : 'Please enter text to translate');
      return;
    }

    setIsTranslating(true);

    try {
      const { data, error } = await supabase.functions.invoke('voice-clone-translator', {
        body: {
          text: inputText,
          target_language: selectedLanguage,
          action: 'translate'
        }
      });

      if (error) throw error;

      if (data.translated_text) {
        setTranslatedText(data.translated_text);
        toast.success(language === 'ar' ? 'تم الترجمة بنجاح' : 'Translation completed successfully');
      }
    } catch (error) {
      console.error('Translation error:', error);
      toast.error(language === 'ar' ? 'فشل في الترجمة' : 'Translation failed');
    } finally {
      setIsTranslating(false);
    }
  };

  const speakText = async () => {
    if (!translatedText.trim()) {
      toast.error(language === 'ar' ? 'لا يوجد نص مترجم للتحدث' : 'No translated text to speak');
      return;
    }

    if (!selectedVoice) {
      toast.error(language === 'ar' ? 'يرجى اختيار صوت' : 'Please select a voice');
      return;
    }

    setIsSpeaking(true);

    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
        body: {
          text: translatedText,
          voice_id: selectedVoice,
          voice_style: selectedStyle
        }
      });

      if (error) throw error;

      if (data.audio_url) {
        setAudioUrl(data.audio_url);
        toast.success(language === 'ar' ? 'تم إنشاء الصوت' : 'Audio generated successfully');
        
        // Update usage display
        loadVoiceUsage();
      }
    } catch (error) {
      console.error('TTS error:', error);
      toast.error(language === 'ar' ? 'فشل في إنشاء الصوت' : 'Audio generation failed');
    } finally {
      setIsSpeaking(false);
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

  const rewindAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
    }
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = `voice-clone-${Date.now()}.mp3`;
      link.click();
    }
  };

  const getUsagePercentage = () => {
    if (!voiceUsage) return 0;
    const total = voiceUsage.characters_used + voiceUsage.extra_characters;
    return Math.min((voiceUsage.characters_used / 6000) * 100, 100);
  };

  const getUsageColor = () => {
    const percentage = getUsagePercentage();
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Usage Display */}
        <Card className="bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'استخدام الحروف' : 'Character Usage'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {voiceUsage && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    {language === 'ar' ? 'المستخدم' : 'Used'}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {voiceUsage.characters_used} / 6,000
                  </span>
                </div>
                <Progress value={getUsagePercentage()} className="h-2" />
                {voiceUsage.extra_characters > 0 && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'ar' ? 'حروف إضافية:' : 'Extra characters:'} {voiceUsage.extra_characters}
                  </div>
                )}
                {getUsagePercentage() >= 90 && (
                  <div className="flex items-center text-xs text-yellow-600 dark:text-yellow-400">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {language === 'ar' ? 'اقتربت من الحد المسموح' : 'Approaching character limit'}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Voice Clones List */}
        {voices.length > 0 && (
          <Card className="bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg text-slate-700 dark:text-slate-300">
                {language === 'ar' ? 'أصواتك المستنسخة' : 'Your Cloned Voices'}
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                {language === 'ar' ? `${voices.length} من الأصوات المتاحة` : `${voices.length} voices available`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {voices.slice(0, 3).map((voice) => (
                  <div key={voice.id} className="p-3 bg-white/10 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300">
                          {voice.voice_name}
                        </h4>
                        {voice.voice_description && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {voice.voice_description}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                          ID: {voice.voice_id}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Translator Section */}
        <Card className="bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'مترجم الصوت' : 'Voice Translator'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Language Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {language === 'ar' ? 'اللغة المطلوبة' : 'Target Language'}
              </label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="bg-white/10 border-white/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {ELEVENLABS_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.nativeName} ({lang.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Input Text */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {language === 'ar' ? 'النص المراد ترجمته' : 'Text to Translate'}
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onMouseDown={startVoiceRecording}
                  onMouseUp={stopVoiceRecording}
                  onMouseLeave={stopVoiceRecording}
                  className={`border-white/30 dark:border-white/20 ${isRecording ? 'bg-red-500 text-white' : ''}`}
                >
                  <Mic className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={language === 'ar' ? 'اكتب النص أو استخدم الميكروفون' : 'Type text or use microphone'}
                className="bg-white/10 border-white/20 text-slate-700 dark:text-slate-300 min-h-[100px]"
                rows={4}
              />
            </div>

            {/* Translate Button */}
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
                language === 'ar' ? 'ترجمة' : 'Translate'
              )}
            </Button>

            {/* Translated Text */}
            {translatedText && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {language === 'ar' ? 'النص المترجم' : 'Translated Text'}
                </label>
                <Textarea
                  value={translatedText}
                  onChange={(e) => setTranslatedText(e.target.value)}
                  className="bg-white/10 border-white/20 text-slate-700 dark:text-slate-300 min-h-[100px]"
                  rows={4}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Speech Synthesis */}
        {voices.length > 0 && translatedText && (
          <Card className="bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg text-slate-700 dark:text-slate-300">
                {language === 'ar' ? 'تحويل النص إلى كلام' : 'Text to Speech'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Voice Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {language === 'ar' ? 'اختر الصوت' : 'Select Voice'}
                </label>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger className="bg-white/10 border-white/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.slice(0, 3).map((voice) => (
                      <SelectItem key={voice.voice_id} value={voice.voice_id}>
                        {voice.voice_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Voice Style Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {language === 'ar' ? 'نمط الصوت' : 'Voice Style'}
                </label>
                <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                  <SelectTrigger className="bg-white/10 border-white/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_STYLES.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Speak Button */}
              <Button
                onClick={speakText}
                disabled={isSpeaking || !selectedVoice}
                className="w-full bg-accent-blue hover:bg-accent-blue/80 text-white"
              >
                {isSpeaking ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{language === 'ar' ? 'جاري الإنشاء...' : 'Generating...'}</span>
                  </div>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'تحدث الآن' : 'Speak Now'}
                  </>
                )}
              </Button>

              {/* Audio Controls */}
              {audioUrl && (
                <div className="flex space-x-2 justify-center">
                  <Button
                    onClick={rewindAudio}
                    variant="outline"
                    size="sm"
                    className="border-white/30 dark:border-white/20"
                  >
                    <Rewind className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={togglePlayback}
                    variant="outline"
                    size="sm"
                    className="border-white/30 dark:border-white/20"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    onClick={downloadAudio}
                    variant="outline"
                    size="sm"
                    className="border-white/30 dark:border-white/20"
                  >
                    <Download className="h-4 w-4" />
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
