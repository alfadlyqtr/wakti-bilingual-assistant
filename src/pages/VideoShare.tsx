import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Play, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface VideoData {
  id: string;
  title: string | null;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  storage_path: string | null;
  duration_seconds: number | null;
  aspect_ratio: string | null;
  style_template: string | null;
  view_count: number;
  is_public: boolean;
  created_at: string;
}

export default function VideoShare() {
  const { id } = useParams<{ id: string }>();
  const { language, theme } = useTheme();
  const [video, setVideo] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (videoUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  useEffect(() => {
    const fetchVideo = async () => {
      if (!id) {
        setError(language === 'ar' ? 'معرف الفيديو غير صالح' : 'Invalid video ID');
        setLoading(false);
        return;
      }

      try {
        // Fetch video metadata
        const { data, error: fetchError } = await supabase
          .from('user_videos')
          .select('*')
          .eq('id', id)
          .eq('is_public', true)
          .single();

        if (fetchError || !data) {
          setError(language === 'ar' ? 'الفيديو غير موجود أو خاص' : 'Video not found or is private');
          setLoading(false);
          return;
        }

        setVideo(data as VideoData);

        // Get video URL from storage (bucket is public, use public URL for best compatibility)
        if (data.storage_path) {
          const { data: urlData } = supabase.storage
            .from('videos')
            .getPublicUrl(data.storage_path);

          if (urlData?.publicUrl) {
            setVideoUrl(urlData.publicUrl);
          }
        } else if (data.video_url) {
          setVideoUrl(data.video_url);
        }

        // Increment view count
        await supabase
          .from('user_videos')
          .update({ view_count: (data.view_count || 0) + 1 })
          .eq('id', id);

      } catch (e) {
        console.error('Error fetching video:', e);
        setError(language === 'ar' ? 'حدث خطأ أثناء تحميل الفيديو' : 'Error loading video');
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, [id, language]);

  // (Public share page intentionally has no back/share/download/stats controls)

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">
            {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !video) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <Play className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold">
            {language === 'ar' ? 'الفيديو غير متاح' : 'Video Unavailable'}
          </h1>
          <p className="text-muted-foreground">
            {error || (language === 'ar' ? 'لم يتم العثور على الفيديو' : 'Video not found')}
          </p>
          <Link to="/home">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Video player */}
        <div className="relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-[70vh] mx-auto">
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              autoPlay={false}
              playsInline
              className="w-full h-full object-contain"
              poster={video.thumbnail_url || undefined}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-white/60">
                {language === 'ar' ? 'الفيديو غير متاح' : 'Video unavailable'}
              </p>
            </div>
          )}
        </div>

        {/* Wakti branding */}
        <Card className="p-4 enhanced-card">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/assets/wakti-eye-soft.svg"
                alt="Wakti"
                className="h-10 w-10 shrink-0"
              />
              <div className="space-y-1">
              <p className="font-semibold">
                {language === 'ar' ? 'أُنشئ بواسطة Wakti' : 'Created with Wakti'}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === 'ar'
                  ? 'جرب Wakti AI لصناعة فيديوهاتك ومحتواك في دقائق'
                  : 'Try Wakti AI to create your own videos and content in minutes'}
              </p>
              </div>
            </div>
            <Link to="/home" className="shrink-0">
              <Button className="btn-enhanced w-full md:w-auto">
                {language === 'ar' ? 'ابدأ الآن' : 'Get Started'}
              </Button>
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
