
import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Download, Loader2, Volume2, Mic, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
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

  // Use the extended quota management hook to get voice quota data
  const { 
    userVoiceQuota, 
    isLoadingVoiceQuota, 
    loadUserVoiceQuota,
    totalAvailableCharacters,
    canUseVoice 
  } = useExtendedQuotaManagement(language);

  useEffect(() => {
    loadData();
  }, []);

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
          {language === 'ar' ? 'تحويل النص إلى كلام' : 'Text to Speech'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {language === 'ar' ? 'اكتب أي نص بأي لغة واختر الأسلوب المناسب' : 'Type any text in any language and choose the appropriate style'}
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

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <Button onClick={onBack} variant="outline" className="flex-1">
          {language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
      </div>
    </div>
  );
}
