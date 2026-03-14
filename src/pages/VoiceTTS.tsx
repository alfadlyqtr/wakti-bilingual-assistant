import React, { useEffect, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Copy, Download, Check, Save, Trash2, Play, Pause, RotateCcw, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import { useAuth } from '@/contexts/AuthContext';
import EnhancedAudioControls from '@/components/tasjeel/EnhancedAudioControls';
import { Card } from '@/components/ui/card';
import { formatDate } from '@/utils/datetime';

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

  // Trial user check — used to enforce 250 char TTS limit
  const [isTrialUser, setIsTrialUser] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (!u?.id) return;
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('is_subscribed, payment_method, next_billing_date')
          .eq('id', u.id)
          .single();
        if (!profile) return;
        const isPaid = profile.is_subscribed === true;
        const hasPaymentMethod = profile.payment_method != null && profile.payment_method.trim().length > 0;
        const isGift = hasPaymentMethod && (!profile.next_billing_date || new Date(profile.next_billing_date) > new Date());
        if (!isPaid && !isGift) setIsTrialUser(true);
      } catch {}
    })();
  }, []);
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
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'saved'>('create');
  const [savedTTSList, setSavedTTSList] = useState<Array<{
    id: string;
    text: string;
    voice_name: string;
    audio_url: string | null;
    storage_path?: string | null;
    created_at: string;
    expires_at: string;
  }>>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [savingAudio, setSavingAudio] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioPlayerRef = React.useRef<HTMLAudioElement | null>(null);

  const { user } = useAuth();

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

  const rewindSavedAudio = async (id: string) => {
    try {
      if (playingId !== id) return;
      const audio = audioPlayerRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      await audio.play();
    } catch {
      toast.error(language === 'ar' ? 'فشل التشغيل' : 'Playback failed');
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

  // Load saved TTS list
  const loadSavedTTS = async () => {
    if (!user?.id) return;
    setLoadingSaved(true);
    try {
      const { data, error } = await (supabase as any)
        .from('saved_tts')
        .select('id, text, voice_name, audio_url, storage_path, created_at, expires_at')
        .eq('user_id', user.id)
        .eq('source', 'tts')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setSavedTTSList((data || []) as any);
    } catch (e) {
      console.error('Failed to load saved TTS:', e);
    } finally {
      setLoadingSaved(false);
    }
  };

  const getSavedTtsPlayableUrl = async (item: { audio_url?: string | null; storage_path?: string | null }) => {
    console.log('🔊 getSavedTtsPlayableUrl called with:', { storage_path: item.storage_path, audio_url: item.audio_url });
    if (item.storage_path) {
      // Download the file as blob to avoid CORS issues with signed URLs
      const { data, error } = await supabase.storage.from('saved-tts').download(item.storage_path);
      console.log('🔊 download result:', { data, error });
      if (error) {
        console.error('🔊 Download error:', error);
        throw error;
      }
      if (!data) throw new Error('No audio data');
      // Create a blob URL for playback
      const blobUrl = URL.createObjectURL(data);
      return blobUrl;
    }
    if (item.audio_url) return item.audio_url;
    throw new Error('Missing audio URL');
  };

  // Save current audio
  const saveCurrentAudio = async () => {
    if (!user?.id || !audioUrl || !text.trim()) return;
    setSavingAudio(true);
    try {
      const selectedVoice = voices.find(v => v.voice_id === selectedVoiceId);
      const audioResp = await fetch(audioUrl);
      if (!audioResp.ok) throw new Error('Failed to read generated audio');
      const audioBlob = await audioResp.blob();
      if (!audioBlob || audioBlob.size === 0) throw new Error('Empty audio');

      const safeVoice = (selectedVoice?.voice_name || 'voice').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 40);
      const storagePath = `${user.id}/tts/${Date.now()}-${safeVoice}.mp3`;

      const { error: uploadError } = await supabase.storage
        .from('saved-tts')
        .upload(storagePath, audioBlob, { contentType: 'audio/mpeg', upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await (supabase as any).from('saved_tts').insert({
        user_id: user.id,
        text: text.trim().substring(0, 500),
        voice_name: selectedVoice?.voice_name || 'Unknown',
        voice_id: selectedVoiceId,
        audio_url: null,
        storage_path: storagePath,
        source: 'tts',
      });
      if (insertError) throw insertError;

      toast.success(language === 'ar' ? 'تم الحفظ!' : 'Saved!');
      await loadSavedTTS();
    } catch (e: any) {
      toast.error(language === 'ar' ? 'فشل الحفظ' : 'Failed to save');
      console.error(e);
    } finally {
      setSavingAudio(false);
    }
  };

  // Delete saved TTS
  const deleteSavedTTS = async (id: string) => {
    if (!user?.id) return;
    setDeletingId(id);
    try {
      const item = savedTTSList.find(i => i.id === id);
      if (item?.storage_path) {
        const { error: storageError } = await supabase.storage.from('saved-tts').remove([item.storage_path]);
        if (storageError) throw storageError;
      }

      const { error } = await (supabase as any).from('saved_tts').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      setSavedTTSList(prev => prev.filter(item => item.id !== id));
      toast.success(language === 'ar' ? 'تم الحذف' : 'Deleted');
    } catch (e) {
      toast.error(language === 'ar' ? 'فشل الحذف' : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  // Play saved audio
  const playSavedAudio = async (id: string, item: any) => {
    try {
      console.log('🔊 playSavedAudio called for item:', item);
      if (playingId === id) {
        audioPlayerRef.current?.pause();
        setPlayingId(null);
        return;
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const url = await getSavedTtsPlayableUrl(item);
      console.log('🔊 Got playable URL:', url);
      const audio = new Audio(url);
      audioPlayerRef.current = audio;
      audio.onended = () => setPlayingId(null);
      audio.onerror = (e) => {
        console.error('🔊 Audio playback error:', e);
        toast.error(language === 'ar' ? 'فشل التشغيل' : 'Playback failed');
        setPlayingId(null);
      };
      await audio.play();
      setPlayingId(id);
    } catch (e: any) {
      console.error('🔊 playSavedAudio error:', e);
      toast.error(language === 'ar' ? 'فشل التشغيل' : 'Playback failed');
      setPlayingId(null);
    }
  };

  // Load saved TTS when switching to saved tab
  useEffect(() => {
    if (activeSubTab === 'saved' && user?.id) {
      loadSavedTTS();
    }
  }, [activeSubTab, user?.id]);

  // Calculate days remaining
  const getDaysRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
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
      <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-gradient-to-br from-white via-white to-slate-50/60 dark:from-[#0c0f14] dark:via-[#0c0f14] dark:to-[#111827] shadow-[0_10px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_50px_rgba(0,0,0,0.55)] p-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-1 text-[#060541] dark:text-[#f2f2f2]">{language === 'ar' ? 'تحويل النص إلى كلام' : 'Text To Speech'}</h2>
          <p className="text-xs text-muted-foreground">{language === 'ar' ? 'أنشئ صوتاً واحفظه للرجوع إليه لاحقاً' : 'Generate audio and save it for later'}</p>
        </div>

      {/* Mini-tabs: Create | Saved */}
      <div className="mt-4 flex gap-2 justify-center">
        <button
          onClick={() => setActiveSubTab('create')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
            activeSubTab === 'create'
              ? 'bg-[#060541] text-white shadow-[0_8px_26px_rgba(6,5,65,0.35)]'
              : 'bg-white/70 text-[#060541] border border-black/5 hover:bg-white dark:bg-white/5 dark:text-[#f2f2f2] dark:border-white/10 dark:hover:bg-white/10'
          }`}
        >
          {language === 'ar' ? 'إنشاء' : 'Create'}
        </button>
        <button
          onClick={() => setActiveSubTab('saved')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 active:scale-95 ${
            activeSubTab === 'saved'
              ? 'bg-[#060541] text-white shadow-[0_8px_26px_rgba(6,5,65,0.35)]'
              : 'bg-white/70 text-[#060541] border border-black/5 hover:bg-white dark:bg-white/5 dark:text-[#f2f2f2] dark:border-white/10 dark:hover:bg-white/10'
          }`}
        >
          <Save className="h-3.5 w-3.5" />
          {language === 'ar' ? 'المحفوظات' : 'Saved'}
          {savedTTSList.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-white/20">
              {savedTTSList.length}
            </span>
          )}
        </button>
      </div>

      </div>

      {/* SAVED TAB CONTENT */}
      {activeSubTab === 'saved' && (
        <div className="space-y-4 mt-5">
          {/* Auto-delete notice */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {language === 'ar' 
                ? 'يتم حذف الملفات المحفوظة تلقائياً بعد 20 يوماً'
                : 'Saved items are automatically deleted after 20 days'}
            </p>
          </div>

          {loadingSaved ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : savedTTSList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Save className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{language === 'ar' ? 'لا توجد ملفات محفوظة بعد' : 'No saved audio yet'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedTTSList.map((item) => (
                <Card
                  key={item.id}
                  className="p-4 rounded-2xl border border-black/5 dark:border-white/10 bg-gradient-to-br from-white via-white to-slate-50/60 dark:from-[#0c0f14] dark:via-[#0c0f14] dark:to-[#111827] shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_14px_55px_rgba(0,0,0,0.55)]"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1 line-clamp-2">{item.text}</p>
                      <p className="text-xs text-muted-foreground mb-2">{item.voice_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {language === 'ar'
                            ? `يتبقى ${getDaysRemaining(item.expires_at)} يوم`
                            : `${getDaysRemaining(item.expires_at)} days remaining`}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {language === 'ar'
                          ? `ينتهي في: ${formatDate(new Date(item.expires_at), language)}`
                          : `Expires on: ${formatDate(new Date(item.expires_at), language)}`}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-9 w-9 rounded-xl border border-black/5 dark:border-white/10 bg-white/60 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 shadow-[0_6px_18px_rgba(0,0,0,0.10)] dark:shadow-[0_10px_26px_rgba(0,0,0,0.55)] transition-all active:scale-95 ${
                          playingId === item.id ? 'text-blue-600 border-blue-500/30 bg-blue-500/10 dark:bg-blue-500/10' : 'text-[#060541] dark:text-[#f2f2f2]'
                        }`}
                        onClick={() => playSavedAudio(item.id, item)}
                      >
                        {playingId === item.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>

                      {playingId === item.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300 dark:border-purple-400/20 dark:bg-purple-500/10 shadow-[0_6px_18px_rgba(147,51,234,0.18)] transition-all active:scale-95"
                          onClick={() => rewindSavedAudio(item.id)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl border border-black/5 dark:border-white/10 bg-white/60 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 text-[#060541] dark:text-[#f2f2f2] shadow-[0_6px_18px_rgba(0,0,0,0.10)] dark:shadow-[0_10px_26px_rgba(0,0,0,0.55)] transition-all active:scale-95"
                        onClick={async () => {
                          try {
                            const url = await getSavedTtsPlayableUrl(item);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = 'saved-audio.mp3';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          } catch (e) {
                            toast.error(language === 'ar' ? 'فشل التنزيل' : 'Download failed');
                          }
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 hover:text-red-700 dark:text-red-300 dark:border-red-400/20 dark:bg-red-500/10 shadow-[0_6px_18px_rgba(239,68,68,0.18)] transition-all active:scale-95"
                        onClick={() => deleteSavedTTS(item.id)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE TAB CONTENT */}
      {activeSubTab === 'create' && (
        <>
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
          maxLength={isTrialUser ? 250 : 2000}
          value={text}
          onChange={(e) => {
            const val = e.target.value;
            if (isTrialUser && val.length > 250) return;
            setText(val);
            if (isCorrected) setIsCorrected(false);
          }}
          placeholder={language === 'ar' ? 'اكتب ما تريد سماعه بأي لغة...' : 'Type what you want to hear in any language...'}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{text.length} / {isTrialUser ? 250 : 2000}{isTrialUser ? (language === 'ar' ? ' (حد التجربة)' : ' (trial limit)') : ''}</span>
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
            <Button onClick={saveCurrentAudio} variant="outline" size="sm" disabled={savingAudio}>
              {savingAudio ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {language === 'ar' ? 'حفظ' : 'Save'}
            </Button>
          </div>
        </div>
      )}

        </>
      )}
    </div>
  );
}
