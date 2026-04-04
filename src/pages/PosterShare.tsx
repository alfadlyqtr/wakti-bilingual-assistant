import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { useTheme } from '@/providers/ThemeProvider';
import InAppWaktiEscape from '@/components/public/InAppWaktiEscape';
import { Logo3D } from '@/components/Logo3D';
import { Loader2 } from 'lucide-react';

interface PosterRecord {
  id: string;
  track_id: string;
  author: string | null;
  status: string;
  video_url: string | null;
  created_at: string;
}

interface TrackRecord {
  id: string;
  title: string | null;
  cover_url: string | null;
  include_styles: string[] | null;
}

export default function PosterShare() {
  const { id } = useParams<{ id: string }>();
  const { language } = useTheme();
  const isAr = language === 'ar';
  const [poster, setPoster] = useState<PosterRecord | null>(null);
  const [track, setTrack] = useState<TrackRecord | null>(null);
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
        const { data: posterData, error: posterErr } = await (supabase as any)
          .from('user_music_posters')
          .select('id, track_id, author, status, video_url, created_at')
          .eq('id', id)
          .eq('status', 'completed')
          .maybeSingle();

        if (posterErr || !posterData?.video_url) {
          setError(isAr ? 'هذا البوستر غير موجود أو لم يكتمل بعد' : 'Poster not found or not ready yet');
          setLoading(false);
          return;
        }

        setPoster(posterData);

        const { data: trackData } = await (supabase as any)
          .from('user_music_tracks')
          .select('id, title, cover_url, include_styles')
          .eq('id', posterData.track_id)
          .maybeSingle();

        if (trackData) setTrack(trackData);
      } catch (e: any) {
        setError((isAr ? 'فشل التحميل: ' : 'Failed to load: ') + (e?.message || String(e)));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, language]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
          <span className="text-sm text-muted-foreground">{isAr ? 'جارٍ تحميل البوستر...' : 'Loading poster...'}</span>
        </div>
      </div>
    );
  }

  if (error || !poster) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold">{isAr ? 'رابط غير صالح' : 'Invalid or expired link'}</h1>
          <p className="text-sm text-muted-foreground">
            {error || (isAr ? 'تعذر العثور على هذا البوستر.' : 'We could not find this poster.')}
          </p>
        </Card>
      </div>
    );
  }

  const trackTitle = track?.title || (isAr ? 'مقطع موسيقي من وقتي' : 'Wakti Music Track');
  const authorLabel = poster.author ? `@${poster.author}` : null;

  return (
    <div className="min-h-screen bg-background">
      <InAppWaktiEscape language={isAr ? 'ar' : 'en'} containerClassName="max-w-xl" />
      <div className="flex items-center justify-center p-4 pt-6">
        <div className="w-full max-w-sm space-y-0">
          {/* Video */}
          <div className="relative w-full rounded-3xl overflow-hidden bg-black border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
            <video
              src={poster.video_url!}
              controls
              playsInline
              autoPlay
              loop
              muted
              className="w-full"
            />
          </div>

          {/* Info card */}
          <div className="relative -mt-2 mx-3 rounded-b-2xl bg-background/95 backdrop-blur-xl border border-white/10 border-t-0 px-5 py-4 shadow-lg space-y-2">
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">{trackTitle}</h1>
              {authorLabel && (
                <p className="text-xs text-muted-foreground/60">{authorLabel}</p>
              )}
              <p className="text-xs text-muted-foreground/40 mt-0.5">
                {new Date(poster.created_at).toLocaleDateString(isAr ? 'ar' : 'en', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            <div className="pt-3 text-center">
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
                <svg className="w-3 h-3 text-[#060541]/40 dark:text-white/40 group-hover:text-[#060541]/60 dark:group-hover:text-white/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
