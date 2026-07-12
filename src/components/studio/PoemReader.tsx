import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Mic, Sparkles, AlertCircle } from 'lucide-react';
import { AudioPlayer } from '@/components/music/AudioPlayer';

// ═══════════════════════════════════════════════════════════════════════════
// Poem Reader — fully separate from Music Studio's generation logic.
// Voice always comes from a real speech engine (ElevenLabs, via poem-generate).
// Suno is only ever used server-side for an optional instrumental-only bed —
// this component never builds Suno prompts, styles, or hard-locks.
// ═══════════════════════════════════════════════════════════════════════════

type PoemLanguage = 'en' | 'ar';
type VocalGender = 'm' | 'f';
type BackgroundStyle = 'none' | 'acoustic' | 'oud';
type PoemStatus = 'idle' | 'processing' | 'mixing' | 'ready' | 'failed';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 80; // ~4 minutes

export default function PoemReader() {
  const { language: uiLanguage } = useTheme();
  const isAr = uiLanguage === 'ar';

  const [title, setTitle] = useState('');
  const [poemLanguage, setPoemLanguage] = useState<PoemLanguage>('en');
  const [vocalGender, setVocalGender] = useState<VocalGender>('m');
  const [backgroundStyle, setBackgroundStyle] = useState<BackgroundStyle>('none');
  const [lyrics, setLyrics] = useState('');

  const [status, setStatus] = useState<PoemStatus>('idle');
  const [finalAudioUrl, setFinalAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollTimerRef = useRef<number | null>(null);
  const pollAttemptsRef = useRef(0);
  const mixingStartedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    };
  }, []);

  const resetState = () => {
    setFinalAudioUrl(null);
    setErrorMessage(null);
    pollAttemptsRef.current = 0;
    mixingStartedRef.current = false;
    if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
  };

  const schedulePoll = (id: string) => {
    pollTimerRef.current = window.setTimeout(() => pollStatus(id), POLL_INTERVAL_MS);
  };

  const handleGenerate = async () => {
    if (!lyrics.trim()) {
      toast.error(isAr ? 'الرجاء كتابة نص القصيدة' : 'Please write your poem text');
      return;
    }
    resetState();
    setStatus('processing');

    try {
      const { data, error } = await supabase.functions.invoke('poem-generate', {
        body: { title, language: poemLanguage, vocalGender, backgroundStyle, lyrics },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const newTrackId = data?.trackId;
      if (!newTrackId) throw new Error('No track ID returned');
      schedulePoll(newTrackId);
    } catch (err: any) {
      console.error('[PoemReader] generate error:', err);
      setStatus('failed');
      setErrorMessage(err?.message || (isAr ? 'فشل إنشاء القصيدة' : 'Failed to generate poem'));
    }
  };

  const pollStatus = async (id: string) => {
    pollAttemptsRef.current += 1;
    if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
      setStatus('failed');
      setErrorMessage(isAr ? 'استغرق الإنشاء وقتاً طويلاً، حاول مرة أخرى' : 'Generation is taking too long, please try again');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('poem-status', {
        body: { trackId: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data.status === 'failed') {
        setStatus('failed');
        setErrorMessage(data.error || (isAr ? 'فشل الإنشاء' : 'Generation failed'));
        return;
      }

      if (data.status === 'ready' && data.finalAudioUrl) {
        setFinalAudioUrl(data.finalAudioUrl);
        setStatus('ready');
        return;
      }

      if (data.status === 'mixing') {
        if (!mixingStartedRef.current) {
          mixingStartedRef.current = true;
          await finalizeMix(id, data);
        }
        return;
      }

      schedulePoll(id);
    } catch (err: any) {
      console.error('[PoemReader] status poll error:', err);
      schedulePoll(id);
    }
  };

  const finalizeMix = async (id: string, data: any) => {
    setStatus('mixing');
    try {
      let finalUrl: string = data.speechAudioUrl;

      if (data.instrumentalAudioUrl) {
        const blob = await mixAudioTracks(data.speechAudioUrl, data.instrumentalAudioUrl);
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) throw new Error('Not authenticated');

        const path = `${userId}/poem/${id}/final.wav`;
        const { error: uploadError } = await supabase.storage
          .from('music')
          .upload(path, blob, { contentType: 'audio/wav', upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('music').getPublicUrl(path);
        finalUrl = urlData?.publicUrl || data.speechAudioUrl;

        await supabase
          .from('user_poem_tracks')
          .update({ final_audio_url: finalUrl, final_storage_path: path, status: 'ready' })
          .eq('id', id);
      } else {
        await supabase
          .from('user_poem_tracks')
          .update({ final_audio_url: finalUrl, status: 'ready' })
          .eq('id', id);
      }

      setFinalAudioUrl(finalUrl);
      setStatus('ready');
    } catch (err) {
      // Graceful degrade — still let the user hear the voice even if the
      // background-bed mix/upload step failed.
      console.error('[PoemReader] mixing error, falling back to voice-only:', err);
      setFinalAudioUrl(data.speechAudioUrl);
      setStatus('ready');
    }
  };

  const isBusy = status === 'processing' || status === 'mixing';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Mic className="h-5 w-5 text-violet-400" />
          {isAr ? 'قارئ القصيدة' : 'Poem Reader'}
        </h1>
        <p className="text-sm text-foreground/60 mt-1">
          {isAr
            ? 'صوت إلقاء هادئ وطبيعي مع سكتات حقيقية — بدون غناء'
            : 'A calm, natural reading voice with real pauses — never singing'}
        </p>
      </div>

      <Card className="p-4 md:p-5 space-y-4 bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isAr ? 'عنوان القصيدة (اختياري)' : 'Poem title (optional)'}
          maxLength={80}
          disabled={isBusy}
        />

        <div className="grid grid-cols-2 gap-3">
          <PillGroup
            label={isAr ? 'اللغة' : 'Language'}
            value={poemLanguage}
            onChange={(v) => setPoemLanguage(v as PoemLanguage)}
            options={[
              { value: 'en', label: isAr ? 'إنجليزي' : 'English' },
              { value: 'ar', label: isAr ? 'عربي' : 'Arabic' },
            ]}
            disabled={isBusy}
          />
          <PillGroup
            label={isAr ? 'الصوت' : 'Voice'}
            value={vocalGender}
            onChange={(v) => setVocalGender(v as VocalGender)}
            options={[
              { value: 'm', label: isAr ? 'رجل' : 'Male' },
              { value: 'f', label: isAr ? 'امرأة' : 'Female' },
            ]}
            disabled={isBusy}
          />
        </div>

        <PillGroup
          label={isAr ? 'الخلفية الموسيقية' : 'Background'}
          value={backgroundStyle}
          onChange={(v) => setBackgroundStyle(v as BackgroundStyle)}
          options={[
            { value: 'none', label: isAr ? 'بدون' : 'None' },
            { value: 'acoustic', label: isAr ? 'أكوستيك' : 'Acoustic' },
            { value: 'oud', label: isAr ? 'عود' : 'Oud' },
          ]}
          disabled={isBusy}
        />

        <div>
          <Textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder={
              isAr
                ? 'اكتب أو الصق نص القصيدة هنا...\n\nسطر جديد = سكتة قصيرة\nسطر فارغ بين الأبيات = سكتة أطول'
                : 'Write or paste your poem here...\n\nNew line = short pause\nBlank line between stanzas = longer pause'
            }
            className="min-h-[180px] resize-y"
            maxLength={4500}
            disabled={isBusy}
            dir={poemLanguage === 'ar' ? 'rtl' : 'ltr'}
          />
          <div className="text-xs text-foreground/40 mt-1 text-right">{lyrics.length}/4500</div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isBusy || !lyrics.trim()}
          className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:opacity-90 text-white font-semibold rounded-xl h-11"
        >
          {isBusy ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {status === 'mixing'
                ? (isAr ? 'دمج الصوت...' : 'Mixing audio...')
                : (isAr ? 'جاري الإنشاء...' : 'Generating...')}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              {isAr ? 'إنشاء القصيدة' : 'Generate Poem'}
            </>
          )}
        </Button>
      </Card>

      {status === 'failed' && errorMessage && (
        <Card className="p-4 border border-red-500/30 bg-red-500/[0.06] rounded-2xl flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-300">{errorMessage}</p>
        </Card>
      )}

      {status === 'ready' && finalAudioUrl && (
        <Card className="p-4 border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent rounded-2xl">
          <AudioPlayer src={finalAudioUrl} />
        </Card>
      )}
    </div>
  );
}

// ── Small reusable pill-button group ──
function PillGroup({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-foreground/50 mb-1.5">{label}</div>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 ${
              value === opt.value
                ? 'bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-[0_2px_10px_hsla(280,70%,65%,0.4)]'
                : 'bg-white/[0.06] text-foreground/70 hover:bg-white/[0.1] border border-white/10'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Client-side mixing (Web Audio API) — voice stays at full presence, the
// instrumental bed loops under it at low volume with a short fade in/out.
// ═══════════════════════════════════════════════════════════════════════════

async function mixAudioTracks(voiceUrl: string, instrumentalUrl: string): Promise<Blob> {
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  const decodeCtx = new AudioContextCtor();

  const [voiceBuffer, instrumentalBuffer] = await Promise.all([
    fetchAndDecode(decodeCtx, voiceUrl),
    fetchAndDecode(decodeCtx, instrumentalUrl),
  ]);

  const sampleRate = voiceBuffer.sampleRate;
  const totalDuration = voiceBuffer.duration + 1.5;
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);

  const voiceSource = offlineCtx.createBufferSource();
  voiceSource.buffer = voiceBuffer;
  voiceSource.connect(offlineCtx.destination);
  voiceSource.start(0);

  const instGain = offlineCtx.createGain();
  instGain.gain.setValueAtTime(0, 0);
  instGain.gain.linearRampToValueAtTime(0.22, 1.2);
  const fadeOutStart = Math.max(1.2, totalDuration - 1.5);
  instGain.gain.setValueAtTime(0.22, fadeOutStart);
  instGain.gain.linearRampToValueAtTime(0, totalDuration);
  instGain.connect(offlineCtx.destination);

  let offset = 0;
  while (offset < totalDuration) {
    const loopSource = offlineCtx.createBufferSource();
    loopSource.buffer = instrumentalBuffer;
    loopSource.connect(instGain);
    loopSource.start(offset);
    offset += instrumentalBuffer.duration;
  }

  const rendered = await offlineCtx.startRendering();
  await decodeCtx.close();
  return encodeWavBlob(rendered);
}

async function fetchAndDecode(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch audio: ${resp.status}`);
  const arrayBuffer = await resp.arrayBuffer();
  return await ctx.decodeAudioData(arrayBuffer);
}

function encodeWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c += 1) channelData.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < numFrames; i += 1) {
    for (let c = 0; c < numChannels; c += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
