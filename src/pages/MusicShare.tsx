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

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setError(isAr ? 'رابط غير صالح' : 'Invalid link');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/music-share-public?id=${encodeURIComponent(id)}`,
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
        <div className="w-full max-w-sm space-y-0">
          {/* Cover art hero */}
          <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-sky-900/60 to-purple-900/60 border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
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

          {/* Info card */}
          <div className="relative -mt-2 mx-3 rounded-b-2xl bg-background/95 backdrop-blur-xl border border-white/10 border-t-0 px-5 py-4 shadow-lg space-y-3">
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">{trackTitle}</h1>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {new Date(track.created_at).toLocaleDateString(isAr ? 'ar' : 'en', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            {displayTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {displayTags.slice(0, 4).map((tag, i) => (
                  <span key={i} className="text-[10px] px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-400/20">
                    {typeof tag === 'string' ? tag.slice(0, 25) : tag}
                  </span>
                ))}
              </div>
            )}

            <AudioPlayer src={playUrl} className="w-full" />

            <div className="pt-4 text-center">
              <a
                href="https://wakti.qa"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-[#060541]/5 via-[#e9ceb0]/20 to-[#060541]/5 dark:from-white/5 dark:via-white/10 dark:to-white/5 hover:from-[#060541]/10 hover:via-[#e9ceb0]/30 hover:to-[#060541]/10 dark:hover:from-white/10 dark:hover:via-white/15 dark:hover:to-white/10 transition-all duration-300 group"
              >
                <Logo3D size="sm" />
                <span className="text-xs font-medium bg-gradient-to-r from-[#060541] to-[#4a4a8a] dark:from-[#f2f2f2] dark:to-[#858384] bg-clip-text text-transparent">
                  {isAr ? 'تم الإنشاء بواسطة وقتي AI' : 'Created with Wakti AI'}
                </span>
                <svg 
                  className="w-3 h-3 text-[#060541]/40 dark:text-white/40 group-hover:text-[#060541]/60 dark:group-hover:text-white/60 transition-colors" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
