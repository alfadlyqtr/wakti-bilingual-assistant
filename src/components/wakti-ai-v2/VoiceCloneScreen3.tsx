import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, Play, Pause, Download, Languages, Sparkles, Volume2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVoiceQuotaManagement } from '@/hooks/useVoiceQuotaManagement';

interface VoiceClone {
  id: string;
  voice_name: string;
  voice_id: string;
}

interface VoiceCloneScreen3Props {
  onBack: () => void;
}

export function VoiceCloneScreen3({ onBack }: VoiceCloneScreen3Props) {
  const { language } = useTheme();
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('ar');
  const [voiceStyle, setVoiceStyle] = useState('neutral');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [existingVoices, setExistingVoices] = useState<VoiceClone[]>([]);
  const [loading, setLoading] = useState(true);

  const { 
    quota, 
    isLoading: quotaLoading, 
    updateQuota 
  } = useVoiceQuotaManagement();

  useEffect(() => {
    loadExistingVoices();
  }, []);

  const loadExistingVoices = async () => {
    try {
      const { data, error } = await supabase
        .from('user_voice_clones')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExistingVoices(data || []);
      
      if (data && data.length > 0) {
        setSelectedVoice(data[0].voice_id);
      }
    } catch (error) {
      console.error('Error loading voices:', error);
    } finally {
      setLoading(false);
    }
  };

  const languages = [
    { code: 'ar', name: language === 'ar' ? 'العربية' : 'Arabic' },
    { code: 'en', name: language === 'ar' ? 'الإنجليزية' : 'English' },
    { code: 'es', name: language === 'ar' ? 'الإسبانية' : 'Spanish' },
    { code: 'fr', name: language === 'ar' ? 'الفرنسية' : 'French' },
    { code: 'de', name: language === 'ar' ? 'الألمانية' : 'German' },
    { code: 'it', name: language === 'ar' ? 'الإيطالية' : 'Italian' },
    { code: 'pt', name: language === 'ar' ? 'البرتغالية' : 'Portuguese' },
    { code: 'ru', name: language === 'ar' ? 'الروسية' : 'Russian' },
    { code: 'ja', name: language === 'ar' ? 'اليابانية' : 'Japanese' },
    { code: 'ko', name: language === 'ar' ? 'الكورية' : 'Korean' },
    { code: 'zh', name: language === 'ar' ? 'الصينية' : 'Chinese' },
    { code: 'hi', name: language === 'ar' ? 'الهندية' : 'Hindi' },
    { code: 'tr', name: language === 'ar' ? 'التركية' : 'Turkish' },
    { code: 'nl', name: language === 'ar' ? 'الهولندية' : 'Dutch' },
    { code: 'sv', name: language === 'ar' ? 'السويدية' : 'Swedish' },
    { code: 'da', name: language === 'ar' ? 'الدنماركية' : 'Danish' },
    { code: 'no', name: language === 'ar' ? 'النرويجية' : 'Norwegian' },
    { code: 'fi', name: language === 'ar' ? 'الفنلندية' : 'Finnish' },
    { code: 'pl', name: language === 'ar' ? 'البولندية' : 'Polish' },
    { code: 'cs', name: language === 'ar' ? 'التشيكية' : 'Czech' },
    { code: 'hu', name: language === 'ar' ? 'المجرية' : 'Hungarian' },
    { code: 'ro', name: language === 'ar' ? 'الرومانية' : 'Romanian' },
    { code: 'bg', name: language === 'ar' ? 'البلغارية' : 'Bulgarian' },
    { code: 'hr', name: language === 'ar' ? 'الكرواتية' : 'Croatian' },
    { code: 'sk', name: language === 'ar' ? 'السلوفاكية' : 'Slovak' },
    { code: 'sl', name: language === 'ar' ? 'السلوفينية' : 'Slovenian' },
    { code: 'et', name: language === 'ar' ? 'الإستونية' : 'Estonian' },
    { code: 'lv', name: language === 'ar' ? 'اللاتفية' : 'Latvian' },
    { code: 'lt', name: language === 'ar' ? 'الليتوانية' : 'Lithuanian' }
  ];

  const voiceStyles = [
    { id: 'neutral', name: language === 'ar' ? 'عادي' : 'Neutral', description: language === 'ar' ? 'متوازن، نبرة محادثة طبيعية' : 'Balanced, natural conversational tone' },
    { id: 'news', name: language === 'ar' ? 'إخباري' : 'News', description: language === 'ar' ? 'واضح ومهني، مناسب للأخبار' : 'Clear and professional, suitable for news' },
    { id: 'storytelling', name: language === 'ar' ? 'سردي' : 'Storytelling', description: language === 'ar' ? 'مشوق ومعبر، مناسب للقصص' : 'Engaging and expressive, suitable for stories' },
    { id: 'poetry', name: language === 'ar' ? 'شعري' : 'Poetry', description: language === 'ar' ? 'فني وإيقاعي، مناسب للشعر' : 'Artistic and rhythmic, suitable for poetry' },
    { id: 'teaching', name: language === 'ar' ? 'تعليمي' : 'Teaching', description: language === 'ar' ? 'واضح وصبور، مناسب للتعليم' : 'Clear and patient, suitable for teaching' },
    { id: 'sports', name: language === 'ar' ? 'رياضي' : 'Sports', description: language === 'ar' ? 'متحمس وحيوي، مناسب للرياضة' : 'Energetic and dynamic, suitable for sports' }
  ];

  const totalAvailableCharacters = quota ? (quota.characters_limit - quota.characters_used + quota.extra_characters) : 0;
  const charactersUsed = text.length;
  const canGenerate = selectedVoice && text.trim() && charactersUsed <= totalAvailableCharacters;

  const generateSpeech = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('voice-clone-translator', {
        body: {
          text: text.trim(),
          voice_id: selectedVoice,
          target_language: targetLanguage,
          voice_style: voiceStyle
        }
      });

      if (error) throw error;

      if (data.audio_url) {
        setAudioUrl(data.audio_url);
        await updateQuota();
        toast.success(language === 'ar' ? 'تم إنشاء الصوت بنجاح' : 'Audio generated successfully');
      }
    } catch (error: any) {
      console.error('Error generating speech:', error);
      toast.error(error.message || (language === 'ar' ? 'فشل في إنشاء الصوت' : 'Failed to generate audio'));
    } finally {
      setIsGenerating(false);
    }
  };

  const playAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
      setIsPlaying(true);
      
      audio.onended = () => {
        setIsPlaying(false);
      };
    }
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = 'generated-speech.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (loading || quotaLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (existingVoices.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          {language === 'ar' ? 'لا توجد أصوات محفوظة' : 'No saved voices found'}
        </p>
        <Button onClick={onBack} variant="outline">
          {language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">
          {language === 'ar' ? 'استوديو الصوت' : 'Voice Studio'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {language === 'ar' ? 'إنشاء الكلام أو ترجمة النص بصوتك المستنسخ' : 'Generate speech or translate text with your cloned voice'}
        </p>
      </div>

      {/* Character Quota Display */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-sm">
                {language === 'ar' ? 'الأحرف المتبقية' : 'Characters Remaining'}
              </span>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg">
                {charactersUsed.toLocaleString()} / {totalAvailableCharacters.toLocaleString()}
              </div>
              {quota?.extra_characters > 0 && (
                <div className="text-xs text-green-600">
                  +{quota.extra_characters} {language === 'ar' ? 'إضافي' : 'extra'}
                </div>
              )}
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {language === 'ar' 
              ? `لديك ${(totalAvailableCharacters - charactersUsed).toLocaleString()} حرف متبقي من ${totalAvailableCharacters.toLocaleString()}`
              : `You have ${(totalAvailableCharacters - charactersUsed).toLocaleString()} characters left out of ${totalAvailableCharacters.toLocaleString()}`
            }
          </div>
        </CardContent>
      </Card>

      {/* Voice Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {language === 'ar' ? 'اختر الصوت' : 'Select Voice'}
        </label>
        <Select value={selectedVoice} onValueChange={setSelectedVoice}>
          <SelectTrigger>
            <SelectValue placeholder={language === 'ar' ? 'اختر صوتاً' : 'Select a voice'} />
          </SelectTrigger>
          <SelectContent>
            {existingVoices.map((voice) => (
              <SelectItem key={voice.voice_id} value={voice.voice_id}>
                <div className="flex items-center gap-2">
                  <span>{voice.voice_name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Quick Translator Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Languages className="h-4 w-4 text-blue-500" />
            {language === 'ar' ? 'المترجم السريع' : 'Quick Translator'}
          </CardTitle>
          <CardDescription className="text-sm">
            {language === 'ar' ? 'اكتب أو الصق النص هنا للترجمة والنطق' : 'Type or paste text here to translate and speak'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Target Language Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {language === 'ar' ? 'ترجم إلى' : 'Translate to'}
            </label>
            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Text Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {language === 'ar' ? 'النص للترجمة' : 'Text to Translate'}
            </label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={language === 'ar' ? 'اكتب أي شيء تريد ترجمته بأي لغة...' : 'Type whatever you want to translate in any language...'}
              className="min-h-[120px] resize-none"
              maxLength={totalAvailableCharacters}
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>
                {charactersUsed > totalAvailableCharacters ? (
                  <span className="text-red-500">
                    {language === 'ar' ? 'تجاوز الحد المسموح' : 'Character limit exceeded'}
                  </span>
                ) : (
                  `${charactersUsed} / ${totalAvailableCharacters} ${language === 'ar' ? 'حرف' : 'characters'}`
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voice Style Selection */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">
            {language === 'ar' ? 'نمط الصوت' : 'Voice Style'}
          </label>
          <Info className="h-3 w-3 text-muted-foreground" />
        </div>
        <Select value={voiceStyle} onValueChange={setVoiceStyle}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {voiceStyles.map((style) => (
              <SelectItem key={style.id} value={style.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{style.name}</span>
                  <span className="text-xs text-muted-foreground">{style.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Generate Button */}
      <Button 
        onClick={generateSpeech}
        disabled={!canGenerate || isGenerating}
        className="w-full"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {language === 'ar' ? 'جاري الإنشاء...' : 'Generating...'}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'ترجم واتكلم' : 'Translate & Speak'}
          </>
        )}
      </Button>

      {/* Audio Controls */}
      {audioUrl && (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                {language === 'ar' ? 'تم إنشاء الصوت بنجاح' : 'Audio generated successfully'}
              </span>
              <div className="flex gap-2">
                <Button onClick={playAudio} variant="outline" size="sm">
                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {isPlaying 
                    ? (language === 'ar' ? 'إيقاف مؤقت' : 'Pause')
                    : (language === 'ar' ? 'تشغيل' : 'Play')
                  }
                </Button>
                <Button onClick={downloadAudio} variant="outline" size="sm">
                  <Download className="h-3 w-3" />
                  {language === 'ar' ? 'تحميل' : 'Download'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Back Button */}
      <Button onClick={onBack} variant="outline" className="w-full">
        {language === 'ar' ? 'رجوع' : 'Back'}
      </Button>
    </div>
  );
}
