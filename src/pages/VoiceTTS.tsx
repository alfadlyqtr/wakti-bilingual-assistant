import React, { useEffect, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Copy, Download, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import EnhancedAudioControls from '@/components/tasjeel/EnhancedAudioControls';

interface VoiceClone {
  id: string;
  voice_name: string;
  voice_id: string;
  is_default?: boolean;
}

// Language-aware default voices (English vs Arabic)
const getDefaultVoices = (lang: string): VoiceClone[] => {
  if (lang === 'ar') {
    // Arabic UI labels for default voices
    return [
      { id: 'default-female-ar', voice_name: 'واكتي أنثى', voice_id: 'u0TsaWvt0v8migutHM3M', is_default: true },
      { id: 'default-male-ar', voice_name: 'واكتي ذكر', voice_id: 'G1QUjBCuRBbLbAmYlTgl', is_default: true },
    ];
  }
  // English (updated to requested ElevenLabs voices)
  return [
    { id: 'default-female-en', voice_name: 'Wakti Female', voice_id: 'vr5WKaGvRWsoaX5LCVax', is_default: true },
    { id: 'default-male-en', voice_name: 'Wakti Male', voice_id: 'uju3wxzG5OhpWcoi3SMy', is_default: true },
  ];
};

const VOICE_STYLES = {
  neutral: {
    name: { en: 'Neutral', ar: 'عادي' },
    description: { en: 'Balanced, natural conversational tone', ar: 'نبرة محادثة طبيعية ومتوازنة' },
    technicalDesc: { en: 'Moderate stability & similarity', ar: 'ثبات واعتدال متوسط' },
    icon: '💬',
    settings: { stability: 0.7, similarity_boost: 0.85, style: 0.0, use_speaker_boost: true },
  },
  report: {
    name: { en: 'News Report', ar: 'تقرير إخباري' },
    description: { en: 'Professional, clear news reporting style', ar: 'أسلوب التقارير الإخبارية المهنية والواضحة' },
    technicalDesc: { en: 'Authoritative & clear delivery', ar: 'إلقاء موثوق وواضح' },
    icon: '📰',
    settings: { stability: 0.8, similarity_boost: 0.9, style: 0.3, use_speaker_boost: true },
  },
  storytelling: {
    name: { en: 'Storytelling', ar: 'سرد القصص' },
    description: { en: 'Dramatic, engaging narrative voice with emotion', ar: 'صوت سردي درامي وجذاب مع العاطفة' },
    technicalDesc: { en: 'Expressive & engaging delivery', ar: 'إلقاء معبر وجذاب' },
    icon: '📚',
    settings: { stability: 0.5, similarity_boost: 0.7, style: 0.6, use_speaker_boost: true },
  },
  poetry: {
    name: { en: 'Poetry', ar: 'شعر' },
    description: { en: 'Highly expressive, artistic poetic delivery', ar: 'إلقاء شعري فني معبر للغاية' },
    technicalDesc: { en: 'Very expressive & artistic', ar: 'معبر وفني للغاية' },
    icon: '🎭',
    settings: { stability: 0.4, similarity_boost: 0.6, style: 0.7, use_speaker_boost: true },
  },
  teacher: {
    name: { en: 'Teacher', ar: 'معلم' },
    description: { en: 'Clear, authoritative educational presentation', ar: 'عرض تعليمي واضح وموثوق' },
    technicalDesc: { en: 'Firm & instructive delivery', ar: 'إلقاء حازم وتعليمي' },
    icon: '👨‍🏫',
    settings: { stability: 0.8, similarity_boost: 0.85, style: 0.4, use_speaker_boost: true },
  },
  sports: {
    name: { en: 'Sports Announcer', ar: 'معلق رياضي' },
    description: { en: 'Dynamic, energetic sports commentary', ar: 'تعليق رياضي ديناميكي ونشيط' },
    technicalDesc: { en: 'Intense & energetic delivery', ar: 'إلقاء مكثف ونشيط' },
    icon: '🏆',
    settings: { stability: 0.3, similarity_boost: 0.5, style: 0.8, use_speaker_boost: true },
  },
} as const;

export default function VoiceTTS() {
  const { language } = useTheme();
  const defaultVoices = getDefaultVoices(language);
  const [text, setText] = useState('');
  const [voices, setVoices] = useState<VoiceClone[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<keyof typeof VOICE_STYLES>('neutral');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [isCorrected, setIsCorrected] = useState(false);
  // Removed external style details; info kept inside dropdown items
  const [defaultVoiceId, setDefaultVoiceId] = useState<string>('');
  const [defaultStyle, setDefaultStyle] = useState<string>('neutral');

  const { userVoiceQuota, isLoadingVoiceQuota, loadUserVoiceQuota, totalAvailableCharacters, canUseVoice } =
    useExtendedQuotaManagement(language);

  useEffect(() => {
    (async () => {
      try {
        const { data: voicesData } = await supabase.from('user_voice_clones').select('*').order('created_at', { ascending: false });
        const allVoices = [...defaultVoices, ...(voicesData || [])];
        setVoices(allVoices);

        const savedDefaultVoice = localStorage.getItem('wakti-default-voice');
        const savedDefaultStyle = localStorage.getItem('wakti-default-style');
        if (savedDefaultVoice) {
          setDefaultVoiceId(savedDefaultVoice);
          setSelectedVoiceId(savedDefaultVoice);
        } else {
          setSelectedVoiceId(defaultVoices[0]?.voice_id || '');
        }
        if (savedDefaultStyle) {
          setDefaultStyle(savedDefaultStyle);
          setSelectedStyle(savedDefaultStyle as keyof typeof VOICE_STYLES);
        }
        await loadUserVoiceQuota();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const canGenerate = text.trim().length > 0 && selectedVoiceId && text.length <= totalAvailableCharacters && canUseVoice;

  const setAsDefaultVoice = (voiceId: string) => {
    localStorage.setItem('wakti-default-voice', voiceId);
    setDefaultVoiceId(voiceId);
    toast.success(language === 'ar' ? 'تم تعيين الصوت كافتراضي' : 'Voice set as default');
  };
  const setAsDefaultVoiceStyle = (style: string) => {
    localStorage.setItem('wakti-default-style', style);
    setDefaultStyle(style);
    toast.success(language === 'ar' ? 'تم تعيين الأسلوب كافتراضي' : 'Style set as default');
  };

  const generateSpeech = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setAudioUrl(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('User not authenticated');

      // Use ElevenLabs-specific edge function (separate from Talk Back / Mini Speaker)
      const ttsEndpoint = `https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/elevenlabs-tts`;
      console.log('🎵 VoiceTTS: calling', ttsEndpoint);
      const response = await fetch(ttsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({ text: text.trim(), voice_id: selectedVoiceId, style: selectedStyle }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);

      const contentType = response.headers.get('content-type') || '';
      let audioBlob: Blob;
      if (contentType.includes('application/json')) {
        const json = await response.json();
        if (json.error) throw new Error(json.error);
        if (!json.audioContent) throw new Error('No audio content in response');
        const bin = atob(json.audioContent);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      } else if (contentType.includes('audio/mpeg')) {
        const buf = await response.arrayBuffer();
        audioBlob = new Blob([buf], { type: 'audio/mpeg' });
      } else {
        throw new Error(`Unexpected content type: ${contentType}`);
      }

      if (audioBlob.size === 0) throw new Error('Received empty audio data');
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      await loadUserVoiceQuota();
      toast.success(language === 'ar' ? 'تم إنشاء الصوت بنجاح' : 'Speech generated successfully');
    } catch (e: any) {
      toast.error(e.message || (language === 'ar' ? 'فشل في إنشاء الصوت' : 'Failed to generate speech'));
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = 'voice-output.mp3';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCorrect = async () => {
    if (!text.trim()) return;
    try {
      setIsCorrecting(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('User not authenticated');
      const resp = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/checker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({ text, lang: language || 'en' })
      });
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(`Checker failed: ${resp.status} ${msg}`);
      }
      const json = await resp.json();
      if (json?.success && typeof json.corrected === 'string') {
        setText(json.corrected);
        toast.success(language === 'ar' ? 'تم التصحيح' : 'Corrected');
        setIsCorrected(true);
      } else {
        throw new Error('Invalid checker response');
      }
    } catch (e: any) {
      toast.error(language === 'ar' ? 'فشل التصحيح' : 'Correction failed');
      console.error('checker error', e);
    } finally {
      setIsCorrecting(false);
    }
  };

  if (loading || isLoadingVoiceQuota) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 p-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">{language === 'ar' ? 'تحويل النص إلى كلام' : 'Text To Speech'}</h2>
        {/* Intro paragraph removed per request */}
      </div>

      {/* Character quota (wired to live input and backend quota) */}
      <div className="p-3 bg-muted rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">{language === 'ar' ? 'الأحرف المتبقية' : 'Characters Remaining'}</span>
          <span className="text-sm">{Math.max(0, totalAvailableCharacters - text.length).toLocaleString()} / {(userVoiceQuota.characters_limit + userVoiceQuota.extra_characters).toLocaleString()}</span>
        </div>
        <div className="w-full bg-background rounded-full h-2 mt-2">
          <div
            className="bg-blue-500 h-2 rounded-full"
            style={{ width: `${Math.max(0, Math.min(100, ((userVoiceQuota.characters_used + text.length) / (userVoiceQuota.characters_limit + userVoiceQuota.extra_characters)) * 100))}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-muted-foreground">
            {language === 'ar'
              ? `لديك ${Math.max(0, totalAvailableCharacters - text.length).toLocaleString()} حرف متبقي من أصل ${(userVoiceQuota.characters_limit + userVoiceQuota.extra_characters).toLocaleString()}.`
              : `You have ${Math.max(0, totalAvailableCharacters - text.length).toLocaleString()} characters left out of ${(userVoiceQuota.characters_limit + userVoiceQuota.extra_characters).toLocaleString()}.`}
          </p>
          {userVoiceQuota.extra_characters > 0 && (
            <span className="text-xs text-green-600 font-medium">+{userVoiceQuota.extra_characters.toLocaleString()} {language === 'ar' ? 'إضافي' : 'extra'}</span>
          )}
        </div>
      </div>

      {/* Voice selector + Voice style side-by-side on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Voice selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{language === 'ar' ? 'اختر الصوت' : 'Select Voice'}</label>
            {selectedVoiceId && (
              <Button onClick={() => setAsDefaultVoice(selectedVoiceId)} variant="outline" size="sm" className={`text-xs ${defaultVoiceId === selectedVoiceId ? 'text-green-600' : ''}`}>
                {defaultVoiceId === selectedVoiceId ? '✓' : (language === 'ar' ? 'جعل افتراضي' : 'Set Default')}
              </Button>
            )}
          </div>
          <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
            <SelectTrigger className="h-12">
              {(() => {
                const v = voices.find(vo => vo.voice_id === selectedVoiceId);
                const isDefault = v?.is_default;
                const icon = isDefault ? '🤖' : '🎤';
                return (
                  <div className="flex items-center gap-2 w-full">
                    <span className={isDefault ? 'text-blue-600' : 'text-green-600'}>{icon}</span>
                    <span>{v?.voice_name || (language === 'ar' ? 'اختر صوت' : 'Choose a voice')}</span>
                    {defaultVoiceId === selectedVoiceId && <span className="text-green-600 ml-auto">✓</span>}
                  </div>
                );
              })()}
            </SelectTrigger>
            <SelectContent>
              {voices.filter(v => v.is_default).map(v => (
                <SelectItem key={v.id} value={v.voice_id}>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">🤖</span>
                    <span>{v.voice_name}</span>
                    {defaultVoiceId === v.voice_id && <span className="text-green-600">✓</span>}
                  </div>
                </SelectItem>
              ))}
              {voices.filter(v => !v.is_default).map(v => (
                <SelectItem key={v.id} value={v.voice_id}>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">🎤</span>
                    <span>{v.voice_name}</span>
                    {defaultVoiceId === v.voice_id && <span className="text-green-600">✓</span>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Voice style */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">{language === 'ar' ? 'أسلوب الصوت' : 'Voice Style'}</label>
            </div>
            <Button onClick={() => setAsDefaultVoiceStyle(selectedStyle)} variant="outline" size="sm" className="text-xs">
              {defaultStyle === selectedStyle ? '✓' : (language === 'ar' ? 'جعل افتراضي' : 'Set Default')}
            </Button>
          </div>
          <Select value={selectedStyle} onValueChange={v => setSelectedStyle(v as keyof typeof VOICE_STYLES)}>
            <SelectTrigger className="h-12">
              <div className="flex items-center gap-2">
                <span>{(VOICE_STYLES as any)[selectedStyle].icon}</span>
                <span className="font-medium">{(VOICE_STYLES as any)[selectedStyle].name[language]}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(VOICE_STYLES).map(([key, style]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2 w-full">
                    <span>{(style as any).icon}</span>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-medium">{(style as any).name[language]}</span>
                      <span className="text-xs text-muted-foreground truncate">{(style as any).description[language]}</span>
                    </div>
                    {defaultStyle === key && <span className="text-green-600 ml-auto">✓</span>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* External description/details removed; info is shown inside the dropdown items */}
        </div>
      </div>

      {/* Text input */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">{language === 'ar' ? 'النص' : 'Text'}</label>
          {text && (
            <Button onClick={() => navigator.clipboard.writeText(text)} variant="ghost" size="sm" className="h-auto p-1">
              <Copy className="h-3 w-3" />
            </Button>
          )}
          <Button
            onClick={handleCorrect}
            size="sm"
            className={
              `h-auto px-3 py-1 text-xs rounded-md transition-all duration-200 shadow-sm ` +
              (isCorrected
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-400/40 focus-visible:ring-green-500'
                : 'bg-accent hover:bg-accent/90 text-accent-foreground')
            }
            disabled={isCorrecting}
            aria-busy={isCorrecting}
            aria-label={isCorrected ? (language === 'ar' ? 'تم التصحيح' : 'Corrected') : (language === 'ar' ? 'تصحيح' : 'Correct')}
          >
            {isCorrecting ? (
              <span className="flex items-center gap-1 text-xs">
                {language === 'ar' ? 'جاري التصحيح' : 'Correcting'}
                <span className="flex items-center gap-1 ml-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </span>
            ) : isCorrected ? (
              <span className="flex items-center gap-1 text-xs"><Check className="h-3 w-3" />{language === 'ar' ? 'تم التصحيح' : 'Corrected'}</span>
            ) : (
              <span className="text-xs">{language === 'ar' ? 'تصحيح' : 'Correct'}</span>
            )}
          </Button>
        </div>
        <Textarea
          className="min-h-32 resize-none"
          maxLength={2000}
          value={text}
          onChange={(e) => { setText(e.target.value); if (isCorrected) setIsCorrected(false); }}
          placeholder={language === 'ar' ? 'اكتب ما تريد سماعه بأي لغة...' : 'Type what you want to hear in any language...'}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{text.length} / 2000</span>
        </div>
      </div>

      {/* Generate */}
      <Button onClick={generateSpeech} disabled={!canGenerate || isGenerating} className="w-full">
        {isGenerating ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />{language === 'ar' ? 'جاري الإنشاء...' : 'Generating...'}</>) : (language === 'ar' ? 'إنشاء الصوت' : 'Generate Speech')}
      </Button>

      {/* Playback */}
      {audioUrl && (
        <div className="space-y-2">
          <EnhancedAudioControls
            audioUrl={audioUrl}
            labels={{
              play: language === 'ar' ? 'تشغيل' : 'Play',
              pause: language === 'ar' ? 'إيقاف مؤقت' : 'Pause',
              rewind: language === 'ar' ? 'ترجيع' : 'Rewind',
              stop: language === 'ar' ? 'إيقاف' : 'Stop',
              error: language === 'ar' ? 'حدث خطأ في تشغيل الصوت' : 'Audio playback error',
            }}
          />
          <div className="flex gap-2">
            <Button onClick={downloadAudio} variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />{language === 'ar' ? 'تنزيل' : 'Download'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
