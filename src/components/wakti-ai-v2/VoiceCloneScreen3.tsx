import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Play, Download, Loader2, Volume2, Mic, Info, Languages, MicIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import { useBrowserSpeechRecognition } from '@/hooks/useBrowserSpeechRecognition';
import EnhancedAudioControls from '@/components/tasjeel/EnhancedAudioControls';

interface VoiceClone {
  id: string;
  voice_name: string;
  voice_id: string;
}

interface VoiceCloneScreen3Props {
  onBack: () => void;
}

// Enhanced voice style configurations with extreme differences and detailed descriptions
const VOICE_STYLES = {
  neutral: {
    name: { en: 'Neutral', ar: 'عادي' },
    description: { en: 'Balanced, natural conversational tone', ar: 'نبرة محادثة طبيعية ومتوازنة' },
    technicalDesc: { en: 'Moderate stability & similarity', ar: 'ثبات واعتدال متوسط' },
    icon: '💬',
    settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0 }
  },
  report: {
    name: { en: 'News Report', ar: 'تقرير إخباري' },
    description: { en: 'Professional, clear news reporting style', ar: 'أسلوب التقارير الإخبارية المهنية والواضحة' },
    technicalDesc: { en: 'Maximum stability & clarity', ar: 'أقصى ثبات ووضوح' },
    icon: '📰',
    settings: { stability: 1.0, similarity_boost: 1.0, style: 0.0 }
  },
  storytelling: {
    name: { en: 'Storytelling', ar: 'سرد القصص' },
    description: { en: 'Dramatic, engaging narrative voice with emotion', ar: 'صوت سردي درامي وجذاب مع العاطفة' },
    technicalDesc: { en: 'Low stability, high expressiveness', ar: 'ثبات منخفض وتعبيرية عالية' },
    icon: '📚',
    settings: { stability: 0.1, similarity_boost: 0.2, style: 1.0 }
  },
  poetry: {
    name: { en: 'Poetry', ar: 'شعر' },
    description: { en: 'Highly expressive, artistic poetic delivery', ar: 'إلقاء شعري فني معبر للغاية' },
    technicalDesc: { en: 'Minimum stability, maximum expression', ar: 'أدنى ثبات وأقصى تعبير' },
    icon: '🎭',
    settings: { stability: 0.0, similarity_boost: 0.1, style: 1.0 }
  },
  teacher: {
    name: { en: 'Teacher', ar: 'معلم' },
    description: { en: 'Clear, authoritative educational presentation', ar: 'عرض تعليمي واضح وموثوق' },
    technicalDesc: { en: 'High stability, clear articulation', ar: 'ثبات عالي ونطق واضح' },
    icon: '👨‍🏫',
    settings: { stability: 0.9, similarity_boost: 0.9, style: 0.1 }
  },
  sports: {
    name: { en: 'Sports Announcer', ar: 'معلق رياضي' },
    description: { en: 'Dynamic, energetic sports commentary', ar: 'تعليق رياضي ديناميكي ونشيط' },
    technicalDesc: { en: 'Low stability, high energy variation', ar: 'ثبات منخفض وتنوع طاقة عالي' },
    icon: '🏆',
    settings: { stability: 0.2, similarity_boost: 0.3, style: 0.9 }
  }
};

// ElevenLabs supported languages for translation
const TRANSLATION_LANGUAGES = [
  { code: 'en', name: { en: 'English', ar: 'الإنجليزية' } },
  { code: 'ar', name: { en: 'Arabic', ar: 'العربية' } },
  { code: 'es', name: { en: 'Spanish', ar: 'الإسبانية' } },
  { code: 'fr', name: { en: 'French', ar: 'الفرنسية' } },
  { code: 'de', name: { en: 'German', ar: 'الألمانية' } },
  { code: 'it', name: { en: 'Italian', ar: 'الإيطالية' } },
  { code: 'pt', name: { en: 'Portuguese', ar: 'البرتغالية' } },
  { code: 'ru', name: { en: 'Russian', ar: 'الروسية' } },
  { code: 'ja', name: { en: 'Japanese', ar: 'اليابانية' } },
  { code: 'ko', name: { en: 'Korean', ar: 'الكورية' } },
  { code: 'zh', name: { en: 'Chinese', ar: 'الصينية' } },
  { code: 'hi', name: { en: 'Hindi', ar: 'الهندية' } },
  { code: 'tr', name: { en: 'Turkish', ar: 'التركية' } },
  { code: 'nl', name: { en: 'Dutch', ar: 'الهولندية' } },
  { code: 'sv', name: { en: 'Swedish', ar: 'السويدية' } }
];

export function VoiceCloneScreen3({ onBack }: VoiceCloneScreen3Props) {
  const { language } = useTheme();
  const [text, setText] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('neutral');
  const [voices, setVoices] = useState<VoiceClone[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStyleDetails, setShowStyleDetails] = useState(false);

  // Translation states
  const [translationText, setTranslationText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('ar');
  const [translatedText, setTranslatedText] = useState('');
  const [translationAudioUrl, setTranslationAudioUrl] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  // Use the extended quota management hook to get voice quota data
  const { 
    userVoiceQuota, 
    isLoadingVoiceQuota, 
    loadUserVoiceQuota,
    totalAvailableCharacters,
    canUseVoice 
  } = useExtendedQuotaManagement(language);

  // Browser speech recognition for translation
  const {
    isListening,
    transcript,
    error: speechError,
    isSupported: speechSupported,
    startListening,
    stopListening,
    clearTranscript
  } = useBrowserSpeechRecognition({
    language: language === 'ar' ? 'ar-SA' : 'en-US',
    continuous: false,
    interimResults: false
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (transcript) {
      setTranslationText(transcript);
      clearTranscript();
    }
  }, [transcript, clearTranscript]);

  const loadData = async () => {
    try {
      // Load voices
      const { data: voicesData, error: voicesError } = await supabase
        .from('user_voice_clones')
        .select('*')
        .order('created_at', { ascending: false });

      if (voicesError) throw voicesError;
      setVoices(voicesData || []);
      
      if (voicesData && voicesData.length > 0) {
        setSelectedVoiceId(voicesData[0].voice_id);
      }

      // Load voice quota using the hook
      await loadUserVoiceQuota();

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const canGenerate = text.trim().length > 0 && selectedVoiceId && text.length <= totalAvailableCharacters && canUseVoice;
  const canTranslate = translationText.trim().length > 0 && selectedVoiceId && translationText.length <= totalAvailableCharacters && canUseVoice;

  const generateSpeech = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setAudioUrl(null);

    try {
      const selectedStyleConfig = VOICE_STYLES[selectedStyle as keyof typeof VOICE_STYLES];
      
      console.log('🎵 === Frontend TTS Request ===');
      console.log('🎵 Text length:', text.trim().length);
      console.log('🎵 Voice ID:', selectedVoiceId);
      console.log('🎵 Style:', selectedStyle);
      console.log('🎵 Style config:', selectedStyleConfig);
      console.log('🎵 Settings to be applied:', selectedStyleConfig.settings);

      // Show user what style is being applied
      toast.info(`${language === 'ar' ? 'تطبيق أسلوب' : 'Applying style'}: ${selectedStyleConfig.name[language]} (${selectedStyleConfig.technicalDesc[language]})`);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('User not authenticated');
      }

      // Make direct fetch call to the edge function with style parameter
      const response = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/voice-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          text: text.trim(),
          voice_id: selectedVoiceId,
          style: selectedStyle,
        })
      });

      console.log('🎵 Frontend response status:', response.status);
      console.log('🎵 Frontend response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🎵 Frontend response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // Check content type to determine how to handle the response
      const contentType = response.headers.get('content-type');
      console.log('🎵 Frontend Content-Type:', contentType);

      let audioBlob: Blob;

      if (contentType?.includes('application/json')) {
        // Response is JSON - might contain base64 encoded audio or error
        const jsonData = await response.json();
        console.log('🎵 Frontend JSON response received:', Object.keys(jsonData));
        
        if (jsonData.error) {
          throw new Error(jsonData.error);
        }
        
        if (jsonData.audioContent) {
          // Base64 encoded audio
          console.log('🎵 Frontend converting base64 to blob...');
          const binaryString = atob(jsonData.audioContent);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
        } else {
          throw new Error('No audio content in response');
        }
      } else if (contentType?.includes('audio/mpeg')) {
        // Response is audio data
        console.log('🎵 Frontend processing audio response...');
        const arrayBuffer = await response.arrayBuffer();
        console.log('🎵 Frontend audio buffer size:', arrayBuffer.byteLength);
        audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      } else {
        throw new Error(`Unexpected content type: ${contentType}`);
      }

      console.log('🎵 Frontend final blob size:', audioBlob.size);
      
      if (audioBlob.size === 0) {
        throw new Error('Received empty audio data');
      }

      const url = URL.createObjectURL(audioBlob);
      console.log('🎵 Frontend created object URL:', url);
      setAudioUrl(url);

      // Reload voice quota after successful generation
      await loadUserVoiceQuota();

      toast.success(`${language === 'ar' ? 'تم إنشاء الصوت بنجاح بأسلوب' : 'Speech generated successfully with'} ${selectedStyleConfig.name[language]} ${language === 'ar' ? '' : 'style'}`);

    } catch (error: any) {
      console.error('🎵 Frontend error generating speech:', error);
      toast.error(error.message || (language === 'ar' ? 'فشل في إنشاء الصوت' : 'Failed to generate speech'));
    } finally {
      setIsGenerating(false);
    }
  };

  const translateAndSpeak = async () => {
    if (!canTranslate) return;

    setIsTranslating(true);
    setTranslatedText('');
    setTranslationAudioUrl(null);

    try {
      console.log('🌐 === Translation Request ===');
      console.log('🌐 Text:', translationText);
      console.log('🌐 Target Language:', targetLanguage);
      console.log('🌐 Voice ID:', selectedVoiceId);
      console.log('🌐 Auto Speak:', autoSpeak);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/voice-clone-translator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          original_text: translationText.trim(),
          target_language: targetLanguage,
          voice_id: selectedVoiceId,
          auto_speak: autoSpeak
        })
      });

      console.log('🌐 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🌐 Response error:', errorText);
        throw new Error(`Translation failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('🌐 Translation result:', result);

      if (!result.success) {
        throw new Error(result.error || 'Translation failed');
      }

      setTranslatedText(result.translated_text);

      // Create audio blob from base64
      if (result.audio_content) {
        const binaryString = atob(result.audio_content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setTranslationAudioUrl(audioUrl);

        console.log('🌐 Audio generated, size:', result.audio_size);
      }

      // Reload voice quota after successful translation
      await loadUserVoiceQuota();

      toast.success(language === 'ar' ? 'تمت الترجمة بنجاح!' : 'Translation completed successfully!');

    } catch (error: any) {
      console.error('🌐 Translation error:', error);
      toast.error(error.message || (language === 'ar' ? 'فشل في الترجمة' : 'Translation failed'));
    } finally {
      setIsTranslating(false);
    }
  };

  const downloadAudio = () => {
    if (audioUrl) {
      console.log('🎵 Downloading audio from URL:', audioUrl);
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = 'voice-output.mp3';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (loading || isLoadingVoiceQuota) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (voices.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <Volume2 className="h-12 w-12 mx-auto text-muted-foreground" />
        <h3 className="text-lg font-semibold">
          {language === 'ar' ? 'لا توجد أصوات' : 'No Voices Available'}
        </h3>
        <p className="text-muted-foreground">
          {language === 'ar' 
            ? 'يجب إنشاء صوت أولاً لاستخدام هذه الميزة' 
            : 'You need to create a voice first to use this feature'
          }
        </p>
        <Button onClick={onBack}>
          {language === 'ar' ? 'رجوع' : 'Go Back'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">
          {language === 'ar' ? 'مختبر الصوت المستنسخ' : 'Voice Clone Lab'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {language === 'ar' ? 'أنشئ كلام أو ترجم النصوص بصوتك المستنسخ' : 'Generate speech or translate text with your cloned voice'}
        </p>
      </div>

      {/* Character Usage - Now showing total available including extras */}
      <div className="p-3 bg-muted rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">
            {language === 'ar' ? 'الأحرف المتبقية' : 'Characters Remaining'}
          </span>
          <span className="text-sm">
            {totalAvailableCharacters.toLocaleString()} / {(userVoiceQuota.characters_limit + userVoiceQuota.extra_characters).toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-background rounded-full h-2 mt-2">
          <div 
            className="bg-blue-500 h-2 rounded-full" 
            style={{ 
              width: `${Math.max(0, Math.min(100, ((userVoiceQuota.characters_used) / (userVoiceQuota.characters_limit + userVoiceQuota.extra_characters)) * 100))}%` 
            }}
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-muted-foreground">
            {language === 'ar' 
              ? `لديك ${totalAvailableCharacters.toLocaleString()} حرف متبقي من أصل ${(userVoiceQuota.characters_limit + userVoiceQuota.extra_characters).toLocaleString()}.`
              : `You have ${totalAvailableCharacters.toLocaleString()} characters left out of ${(userVoiceQuota.characters_limit + userVoiceQuota.extra_characters).toLocaleString()}.`
            }
          </p>
          {userVoiceQuota.extra_characters > 0 && (
            <span className="text-xs text-green-600 font-medium">
              +{userVoiceQuota.extra_characters.toLocaleString()} {language === 'ar' ? 'إضافي' : 'extra'}
            </span>
          )}
        </div>
      </div>

      {/* Voice Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {language === 'ar' ? 'اختر الصوت' : 'Select Voice'}
        </label>
        <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
          <SelectTrigger>
            <SelectValue placeholder={language === 'ar' ? 'اختر صوت' : 'Choose a voice'} />
          </SelectTrigger>
          <SelectContent>
            {voices.map((voice) => (
              <SelectItem key={voice.id} value={voice.voice_id}>
                {voice.voice_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs for TTS and Translation */}
      <Tabs defaultValue="tts" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tts" className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            {language === 'ar' ? 'نص إلى كلام' : 'Text to Speech'}
          </TabsTrigger>
          <TabsTrigger value="translate" className="flex items-center gap-2">
            <Languages className="h-4 w-4" />
            {language === 'ar' ? 'الترجمة الصوتية' : 'Voice Translator'}
          </TabsTrigger>
        </TabsList>

        {/* Text to Speech Tab */}
        <TabsContent value="tts" className="space-y-4">
          {/* Enhanced Voice Style Selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">
                {language === 'ar' ? 'أسلوب الصوت' : 'Voice Style'}
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowStyleDetails(!showStyleDetails)}
                className="h-auto p-1"
              >
                <Info className="h-3 w-3" />
              </Button>
            </div>
            
            <Select value={selectedStyle} onValueChange={setSelectedStyle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VOICE_STYLES).map(([key, style]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <span>{style.icon}</span>
                      <div className="flex flex-col">
                        <span className="font-medium">{style.name[language]}</span>
                        <span className="text-xs text-muted-foreground">{style.description[language]}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p>{VOICE_STYLES[selectedStyle as keyof typeof VOICE_STYLES].description[language]}</p>
              {showStyleDetails && (
                <div className="bg-muted/50 p-2 rounded text-xs">
                  <p className="font-medium mb-1">{language === 'ar' ? 'الإعدادات التقنية:' : 'Technical Settings:'}</p>
                  <p>{VOICE_STYLES[selectedStyle as keyof typeof VOICE_STYLES].technicalDesc[language]}</p>
                  <div className="mt-1 font-mono text-xs">
                    {JSON.stringify(VOICE_STYLES[selectedStyle as keyof typeof VOICE_STYLES].settings, null, 2)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Text Input with Arabic support */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {language === 'ar' ? 'النص' : 'Text'}
            </label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={language === 'ar' ? 'اكتب ما تريد سماعه بصوتك... يدعم العربية والإنجليزية. جرب نصوص مختلفة لتجربة الأساليب المتنوعة!' : 'Type what you want to hear in your voice... Supports Arabic and English. Try different texts to experience the various styles!'}
              className="min-h-32 resize-none"
              maxLength={totalAvailableCharacters}
              dir="auto"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{text.length} / {totalAvailableCharacters}</span>
              {text.length > totalAvailableCharacters && (
                <span className="text-red-500">
                  {language === 'ar' ? 'تجاوز الحد المسموح' : 'Exceeds limit'}
                </span>
              )}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={generateSpeech}
            disabled={!canGenerate || isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {language === 'ar' ? 'جاري الإنشاء...' : 'Generating...'}
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 mr-2" />
                {language === 'ar' ? `تحدث بأسلوب ${VOICE_STYLES[selectedStyle as keyof typeof VOICE_STYLES].name[language]}` : `Speak with ${VOICE_STYLES[selectedStyle as keyof typeof VOICE_STYLES].name[language]} Style`}
              </>
            )}
          </Button>

          {/* Enhanced Audio Player */}
          {audioUrl && (
            <div className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">
                  {language === 'ar' ? 'الصوت المُنشأ' : 'Generated Audio'}
                </h3>
                <div className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'أسلوب:' : 'Style:'} {VOICE_STYLES[selectedStyle as keyof typeof VOICE_STYLES].name[language]}
                </div>
              </div>
              
              <EnhancedAudioControls
                audioUrl={audioUrl}
                labels={{
                  play: language === 'ar' ? 'تشغيل' : 'Play',
                  pause: language === 'ar' ? 'إيقاف مؤقت' : 'Pause',
                  rewind: language === 'ar' ? 'إرجاع' : 'Rewind',
                  stop: language === 'ar' ? 'إيقاف' : 'Stop',
                  error: language === 'ar' ? 'خطأ في تشغيل الصوت' : 'Error playing audio'
                }}
              />
              
              <div className="flex gap-2 justify-center">
                <Button onClick={downloadAudio} variant="outline" size="sm">
                  <Download className="h-3 w-3 mr-1" />
                  {language === 'ar' ? 'تحميل' : 'Download'}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Translation Tab */}
        <TabsContent value="translate" className="space-y-4">
          {/* Target Language Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {language === 'ar' ? 'ترجم إلى' : 'Translate to'}
            </label>
            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSLATION_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name[language]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auto Speak Toggle */}
          <div className="flex items-center space-x-2">
            <Switch 
              id="auto-speak" 
              checked={autoSpeak} 
              onCheckedChange={setAutoSpeak}
            />
            <Label htmlFor="auto-speak" className="text-sm font-medium">
              {language === 'ar' ? 'تشغيل تلقائي للترجمة' : 'Auto-play translation'}
            </Label>
          </div>

          {/* Text Input with Speech Recognition */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {language === 'ar' ? 'النص للترجمة' : 'Text to Translate'}
              </label>
              {speechSupported && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={isListening ? stopListening : startListening}
                  disabled={isTranslating}
                  className="flex items-center gap-2"
                >
                  <MicIcon className={`h-4 w-4 ${isListening ? 'text-red-500 animate-pulse' : ''}`} />
                  {isListening 
                    ? (language === 'ar' ? 'إيقاف التسجيل' : 'Stop Recording')
                    : (language === 'ar' ? 'تسجيل صوتي' : 'Voice Input')
                  }
                </Button>
              )}
            </div>
            <Textarea
              value={translationText}
              onChange={(e) => setTranslationText(e.target.value)}
              placeholder={language === 'ar' 
                ? 'اكتب النص الذي تريد ترجمته... أو استخدم التسجيل الصوتي'
                : 'Type the text you want to translate... or use voice input'
              }
              className="min-h-24 resize-none"
              maxLength={totalAvailableCharacters}
              dir="auto"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{translationText.length} / {totalAvailableCharacters}</span>
              {speechError && (
                <span className="text-red-500">{speechError}</span>
              )}
            </div>
          </div>

          {/* Translate Button */}
          <Button
            onClick={translateAndSpeak}
            disabled={!canTranslate || isTranslating}
            className="w-full"
          >
            {isTranslating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {language === 'ar' ? 'جاري الترجمة...' : 'Translating...'}
              </>
            ) : (
              <>
                <Languages className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'ترجم واسمع' : 'Translate & Speak'}
              </>
            )}
          </Button>

          {/* Translation Results */}
          {translatedText && (
            <div className="space-y-4">
              {/* Original Text */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {language === 'ar' ? 'النص الأصلي:' : 'Original Text:'}
                </div>
                <div className="text-sm" dir="auto">{translationText}</div>
              </div>

              {/* Translated Text */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  {language === 'ar' ? 'النص المترجم:' : 'Translated Text:'}
                </div>
                <div className="text-sm font-medium mb-3" dir="auto">{translatedText}</div>
                
                {/* Audio Player for Translation */}
                {translationAudioUrl && (
                  <div className="space-y-3">
                    <EnhancedAudioControls
                      audioUrl={translationAudioUrl}
                      labels={{
                        play: language === 'ar' ? 'تشغيل' : 'Play',
                        pause: language === 'ar' ? 'إيقاف مؤقت' : 'Pause',
                        rewind: language === 'ar' ? 'إرجاع' : 'Rewind',
                        stop: language === 'ar' ? 'إيقاف' : 'Stop',
                        error: language === 'ar' ? 'خطأ في تشغيل الصوت' : 'Error playing audio'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <Button onClick={onBack} variant="outline" className="flex-1">
          {language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
      </div>
    </div>
  );
}
