import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { AudioPlayer } from '@/components/music/AudioPlayer';
import { useTheme } from '@/providers/ThemeProvider';
import InAppWaktiEscape from '@/components/public/InAppWaktiEscape';
import { Logo3D } from '@/components/Logo3D';

interface TrackRecord {
  id: string;
  created_at: string;
  title: string | null;
  prompt: string | null;
  include_styles: string[] | null;
  requested_duration_seconds: number | null;
  duration: number | null;
  cover_url: string | null;
  signed_url: string | null;
  storage_path: string | null;
  mime: string | null;
  meta?: Record<string, unknown>;
}

export default function MusicShare() {
  const { id } = useParams<{ id: string }>();
  const { language } = useTheme();
  const isAr = language === 'ar';
  const [track, setTrack] = useState<TrackRecord | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setError(isAr ? 'رابط غير صالح' : 'Invalid link');
        setLoading(false);
        return;
      }

      // Support both full UUID (legacy) and pretty slug (name-XXXXXXXX)
      const isFullUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const lookupParam = isFullUuid ? `id=${encodeURIComponent(id)}` : `id_prefix=${encodeURIComponent(id.slice(-8))}`;

      try {
        const response = await fetch(
          `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/music-share-public?${lookupParam}`,
          {
            method: 'GET',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        );

        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.track) {
          setError(payload?.error || (isAr ? 'هذا المقطع غير موجود' : 'Track not found'));
          setLoading(false);
          return;
        }

        const data = payload.track as TrackRecord;
        const url = payload.playUrl as string | null;

        if (!url) {
          setError(isAr ? 'لم يتم العثور على رابط الصوت' : 'No audio URL found');
          setLoading(false);
          return;
        }

        setTrack(data as TrackRecord);
        setPlayUrl(url);
        setLoading(false);
      } catch (e: any) {
        setError((isAr ? 'فشل التحميل: ' : 'Failed to load: ') + (e?.message || String(e)));
        setLoading(false);
      }
    };

    load();
  }, [id, language]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-t-sky-400 border-sky-400/20 animate-spin" />
          <span className="text-sm text-muted-foreground">{isAr ? 'جارٍ تحميل المقطع...' : 'Loading track...'}</span>
        </div>
      </div>
    );
  }

  if (error || !track || !playUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold">{isAr ? 'رابط غير صالح' : 'Invalid or expired link'}</h1>
          <p className="text-sm text-muted-foreground">
            {error || (isAr ? 'تعذر العثور على هذا المقطع.' : 'We could not find this music track.')}
          </p>
        </Card>
      </div>
    );
  }

  const durationSec = track.duration ?? track.requested_duration_seconds ?? null;
  const durationLabel = durationSec
    ? `${Math.floor(durationSec / 60)}:${String(Math.round(durationSec % 60)).padStart(2, '0')}`
    : null;
  const trackTitle = track.title || (isAr ? 'مقطع موسيقي من وقتي' : 'Wakti Music Track');
  const styleTags = track.include_styles ?? [];
  const metaTags = (track.meta as any)?.tags as string | null;
  const displayTags = metaTags ? [metaTags] : styleTags;

  return (
    <div className="min-h-screen bg-background">
      <InAppWaktiEscape language={isAr ? 'ar' : 'en'} containerClassName="max-w-xl" />
      <div className="flex items-center justify-center p-4 pt-6">
        <div className="w-full max-w-sm">
          {/* Cover art hero */}
          <div className={`relative w-full aspect-square rounded-3xl p-1 bg-gradient-to-br from-sky-900/60 to-purple-900/60 shadow-[0_8px_40px_rgba(0,0,0,0.5)] transition-all duration-500 ${isPlaying ? 'music-playing-border' : 'border border-white/10'}`}>
            <div className="relative w-full h-full rounded-2xl overflow-hidden">
              {track.cover_url ? (
                <img src={track.cover_url} alt={trackTitle} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="w-20 h-20 rounded-full bg-sky-500/20 border border-sky-400/30 flex items-center justify-center mx-auto">
                      <span className="text-4xl">🎵</span>
                    </div>
                  </div>
                </div>
              )}
              {/* Gradient overlay at bottom */}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
              {durationLabel && (
                <div className="absolute bottom-3 right-3 text-xs font-mono px-2 py-1 rounded-full bg-black/50 text-white/80 backdrop-blur-sm border border-white/10">
                  {durationLabel}
                </div>
              )}
            </div>
          </div>

          {/* Apple iCloud-style card */}
          <div className="relative mx-4 mt-8">

            {/* Card */}
            <div className="relative w-full rounded-[28px] bg-[#0f1c3f] shadow-[0_24px_60px_rgba(0,0,0,0.7),0_8px_20px_rgba(0,0,40,0.5)] overflow-hidden">

              {/* Logo locked into top-left corner of the card */}
              <div className="absolute top-0 left-0 z-10 flex h-[60px] w-[60px] items-center justify-center rounded-br-[24px] rounded-tl-[28px] bg-[#1a2d5a] shadow-[2px_2px_16px_rgba(0,0,0,0.4)] border-b border-r border-white/[0.08]">
                <Logo3D size="sm" />
              </div>

              {/* Card content */}
              <div className="pb-6 space-y-4">

                {/* Top bar: logo space left, chip right — all on same 60px row */}
                <div className="flex items-center justify-end h-[60px] pr-4">
                  {displayTags.length > 0 && (
                    <span className="rounded-full bg-[#1e3a6e] px-3 py-1 text-[11px] font-medium text-[#7eb8ff] border border-[#2a4d8a] tracking-wide">
                      {String(displayTags[0]).split(',')[0].trim().slice(0, 20)}
                    </span>
                  )}
                </div>

                {/* Song name — centered, gradient with colored glow */}
                <div className="text-center px-5 py-1">
                  <h1 className="text-2xl font-bold leading-tight bg-gradient-to-r from-[#7eb8ff] via-white to-[#a78bfa] bg-clip-text text-transparent drop-shadow-[0_2px_16px_rgba(123,184,255,0.5)]">
                    {trackTitle}
                  </h1>
                </div>

                {/* Audio controls — narrower width */}
                <div className="mx-8 rounded-2xl bg-white/[0.06] px-4 py-3 border border-white/[0.07]">
                  <AudioPlayer src={playUrl} className="w-full" showLoopToggle onPlaybackChange={setIsPlaying} />
                </div>

                {/* Wakti brand footer — colored and styled */}
                <div className="flex justify-center pt-1">
                  <a
                    href="https://wakti.qa"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,rgba(94,144,255,0.15),rgba(167,139,250,0.15))] border border-white/10 px-4 py-1.5 text-xs font-semibold text-[#a0c4ff] hover:text-white hover:border-white/20 transition-all"
                  >
                    <span className="text-[#7eb8ff]">✦</span>
                    {isAr ? 'تم الإنشاء بواسطة وقتي AI' : 'Created with Wakti AI'}
                    <svg className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
