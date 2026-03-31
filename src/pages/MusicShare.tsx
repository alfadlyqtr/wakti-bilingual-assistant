import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { AudioPlayer } from '@/components/music/AudioPlayer';
import { useTheme } from '@/providers/ThemeProvider';
import InAppWaktiEscape from '@/components/public/InAppWaktiEscape';

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
        const { data, error: fetchError } = await (supabase as any)
          .from('user_music_tracks')
          .select('id, created_at, title, prompt, include_styles, requested_duration_seconds, duration, cover_url, signed_url, storage_path, mime, meta')
          .eq('id', id)
          .maybeSingle();

        if (fetchError || !data) {
          setError(isAr ? 'هذا المقطع غير موجود' : 'Track not found');
          setLoading(false);
          return;
        }

        const status = data.meta?.status;
        if (status === 'generating' || status === 'failed' || data.storage_path?.includes('_pending.mp3')) {
          setError(isAr ? 'هذا المقطع غير جاهز للمشاركة' : 'This track is not ready to share');
          setLoading(false);
          return;
        }

        let url: string | null = data.signed_url;
        if (!url && data.storage_path) {
          const base = SUPABASE_URL.replace(/\/$/, '');
          const path = data.storage_path.startsWith('/') ? data.storage_path.slice(1) : data.storage_path;
          url = `${base}/storage/v1/object/public/music/${path}`;
        }

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

            <div className="pt-1 text-center">
              <a
                href="https://wakti.qa"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
              >
                {isAr ? 'تم الإنشاء بواسطة وقتي AI' : 'Created with Wakti AI'}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
