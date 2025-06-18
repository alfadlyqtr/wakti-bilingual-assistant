
import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Download, Loader2, Volume2, Mic } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';

interface VoiceClone {
  id: string;
  voice_name: string;
  voice_id: string;
}

interface VoiceCloneScreen3Props {
  onBack: () => void;
}

// Voice style configurations with Arabic translations
const VOICE_STYLES = {
  neutral: {
    name: { en: 'Neutral', ar: 'عادي' },
    description: { en: 'Natural conversational tone', ar: 'نبرة محادثة طبيعية' },
    icon: '💬',
    stability: 0.5,
    similarity_boost: 0.5,
    style: 0.0
  },
  report: {
    name: { en: 'Report', ar: 'تقرير إخباري' },
    description: { en: 'Professional news reporting style', ar: 'أسلوب التقارير الإخبارية المهنية' },
    icon: '📰',
    stability: 0.75,
    similarity_boost: 0.8,
    style: 0.3
  },
  storytelling: {
    name: { en: 'Storytelling', ar: 'سرد القصص' },
    description: { en: 'Engaging narrative voice', ar: 'صوت سردي جذاب' },
    icon: '📚',
    stability: 0.3,
    similarity_boost: 0.6,
    style: 0.8
  },
  poetry: {
    name: { en: 'Poetry', ar: 'شعر' },
    description: { en: 'Expressive poetic delivery', ar: 'إلقاء شعري معبر' },
    icon: '🎭',
    stability: 0.2,
    similarity_boost: 0.4,
    style: 0.9
  },
  teacher: {
    name: { en: 'Teacher', ar: 'معلم' },
    description: { en: 'Clear educational presentation', ar: 'عرض تعليمي واضح' },
    icon: '👨‍🏫',
    stability: 0.8,
    similarity_boost: 0.7,
    style: 0.2
  },
  sports: {
    name: { en: 'Sports Announcer', ar: 'معلق رياضي' },
    description: { en: 'Dynamic sports commentary', ar: 'تعليق رياضي ديناميكي' },
    icon: '🏆',
    stability: 0.4,
    similarity_boost: 0.6,
    style: 0.7
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
      console.log('🎵 Starting TTS generation...');
      console.log('🎵 Text length:', text.trim().length);
      console.log('🎵 Voice ID:', selectedVoiceId);
      console.log('🎵 Style:', selectedStyle);

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

      console.log('🎵 Response status:', response.status);
      console.log('🎵 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🎵 Response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // Check content type to determine how to handle the response
      const contentType = response.headers.get('content-type');
      console.log('🎵 Content-Type:', contentType);

      let audioBlob: Blob;

      if (contentType?.includes('application/json')) {
        // Response is JSON - might contain base64 encoded audio or error
        const jsonData = await response.json();
        console.log('🎵 JSON response received:', Object.keys(jsonData));
        
        if (jsonData.error) {
          throw new Error(jsonData.error);
        }
        
        if (jsonData.audioContent) {
          // Base64 encoded audio
          console.log('🎵 Converting base64 to blob...');
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
        console.log('🎵 Processing audio response...');
        const arrayBuffer = await response.arrayBuffer();
        console.log('🎵 Audio buffer size:', arrayBuffer.byteLength);
        audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      } else {
        throw new Error(`Unexpected content type: ${contentType}`);
      }

      console.log('🎵 Final blob size:', audioBlob.size);
      
      if (audioBlob.size === 0) {
        throw new Error('Received empty audio data');
      }

      const url = URL.createObjectURL(audioBlob);
      console.log('🎵 Created object URL:', url);
      setAudioUrl(url);

      // Reload voice quota after successful generation
      await loadUserVoiceQuota();

      toast.success(language === 'ar' ? 'تم إنشاء الصوت بنجاح' : 'Speech generated successfully');

    } catch (error: any) {
      console.error('🎵 Error generating speech:', error);
      toast.error(error.message || (language === 'ar' ? 'فشل في إنشاء الصوت' : 'Failed to generate speech'));
    } finally {
      setIsGenerating(false);
    }
  };

  const playAudio = () => {
    if (audioUrl) {
      console.log('🎵 Playing audio from URL:', audioUrl);
      const audio = new Audio(audioUrl);
      audio.play().catch(error => {
        console.error('🎵 Error playing audio:', error);
        toast.error(language === 'ar' ? 'فشل في تشغيل الصوت' : 'Failed to play audio');
      });
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
          {language === 'ar' ? 'اكتب أي نص بأي لغة واختر الأسلوب' : 'Type any text in any language and choose a style'}
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

      {/* Voice Style Selector with Arabic support */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {language === 'ar' ? 'أسلوب الصوت' : 'Voice Style'}
        </label>
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
        <p className="text-xs text-muted-foreground">
          {VOICE_STYLES[selectedStyle as keyof typeof VOICE_STYLES].description[language]}
        </p>
      </div>

      {/* Text Input with Arabic support */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {language === 'ar' ? 'النص' : 'Text'}
        </label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={language === 'ar' ? 'اكتب ما تريد سماعه بصوتك... يدعم العربية والإنجليزية' : 'Type what you want to hear in your voice... Supports Arabic and English'}
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
            {language === 'ar' ? 'تحدث بهذا' : 'Speak This'}
          </>
        )}
      </Button>

      {/* Audio Player */}
      {audioUrl && (
        <div className="p-4 border rounded-lg space-y-4">
          <h3 className="font-medium">
            {language === 'ar' ? 'الصوت المُنشأ' : 'Generated Audio'}
          </h3>
          <audio controls src={audioUrl} className="w-full" />
          <div className="flex gap-2">
            <Button onClick={playAudio} variant="outline" size="sm">
              <Play className="h-3 w-3 mr-1" />
              {language === 'ar' ? 'تشغيل' : 'Play'}
            </Button>
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
