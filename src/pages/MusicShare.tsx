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
  prompt: string | null;
  include_styles: string[] | null;
  requested_duration_seconds: number | null;
  signed_url: string | null;
  storage_path: string | null;
  mime: string | null;
  meta?: any;
}

export default function MusicShare() {
  const { id } = useParams<{ id: string }>();
  const { language } = useTheme();
  const [track, setTrack] = useState<TrackRecord | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setError(language === 'ar' ? 'رابط غير صالح' : 'Invalid link');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await (supabase as any)
          .from('user_music_tracks')
          .select('id, created_at, prompt, include_styles, requested_duration_seconds, signed_url, storage_path, mime, meta')
          .eq('id', id)
          .maybeSingle();

        if (error || !data) {
          setError(language === 'ar' ? 'هذا المقطع غير موجود' : 'Track not found');
          setLoading(false);
          return;
        }

        // Skip incomplete/failed tracks
        const status = data.meta?.status;
        if (status === 'generating' || status === 'failed' || (data.storage_path && data.storage_path.includes('_pending.mp3'))) {
          setError(language === 'ar' ? 'هذا المقطع غير جاهز للمشاركة' : 'This track is not ready to share');
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
          setError(language === 'ar' ? 'لم يتم العثور على رابط الصوت' : 'No audio URL found');
          setLoading(false);
          return;
        }

        setTrack(data as TrackRecord);
        setPlayUrl(url);
        setLoading(false);
      } catch (e: any) {
        console.error('[MusicShare] Load error:', e);
        setError((language === 'ar' ? 'فشل التحميل: ' : 'Failed to load: ') + (e?.message || String(e)));
        setLoading(false);
      }
    };

    load();
  }, [id, language]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground">
          {language === 'ar' ? 'جارٍ تحميل المقطع...' : 'Loading track...'}
        </span>
      </div>
    );
  }

  if (error || !track || !playUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-4 md:p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold">
            {language === 'ar' ? 'رابط غير صالح' : 'Invalid or expired link'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {error || (language === 'ar' ? 'تعذر العثور على هذا المقطع.' : 'We could not find this music track.')}
          </p>
        </Card>
      </div>
    );
  }

  const createdAt = new Date(track.created_at).toLocaleString();

  return (
    <div className="min-h-screen bg-background">
      <InAppWaktiEscape language={language === 'ar' ? 'ar' : 'en'} containerClassName="max-w-xl" />
      <div className="flex items-center justify-center p-4">
        <Card className="w-full max-w-xl p-4 md:p-6 space-y-4">
          <div className="space-y-1">
            <h1 className="text-lg md:text-xl font-semibold">
              {language === 'ar' ? 'مقطع موسيقي من Wakti' : 'Wakti Music Track'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {createdAt}
            </p>
          </div>

          {track.prompt && (
            <p className="text-sm text-muted-foreground line-clamp-3" title={track.prompt || undefined}>
              {track.prompt}
            </p>
          )}

          {track.include_styles && track.include_styles.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {track.include_styles.map((s) => (
                <span key={s} className="px-2 py-0.5 rounded-full bg-muted">
                  {s}
                </span>
              ))}
            </div>
          )}

          <AudioPlayer src={playUrl} className="w-full" />
        </Card>
      </div>
    </div>
  );
}
