import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Play, Download, Share2, ArrowLeft, Eye, Calendar, Clock } from 'lucide-react';
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

        // Get video URL from storage
        if (data.storage_path) {
          const { data: urlData } = await supabase.storage
            .from('videos')
            .createSignedUrl(data.storage_path, 3600); // 1 hour expiry
          
          if (urlData?.signedUrl) {
            setVideoUrl(urlData.signedUrl);
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

  const handleDownload = async () => {
    if (!videoUrl) return;

    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${video?.title || 'wakti-video'}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(language === 'ar' ? 'فشل التنزيل' : 'Download failed');
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: video?.title || 'Wakti Video',
          text: video?.description || (language === 'ar' ? 'شاهد هذا الفيديو' : 'Check out this video'),
          url: shareUrl
        });
      } catch (e) {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(language === 'ar' ? 'تم نسخ الرابط' : 'Link copied');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Wakti</span>
          </Link>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'مشاركة' : 'Share'}
          </Button>
        </div>
      </header>

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

        {/* Video info */}
        <div className="space-y-4">
          {video.title && (
            <h1 className="text-2xl font-bold">{video.title}</h1>
          )}

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              <span>
                {video.view_count} {language === 'ar' ? 'مشاهدة' : 'views'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(video.created_at)}</span>
            </div>
            {video.duration_seconds && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{formatDuration(video.duration_seconds)}</span>
              </div>
            )}
          </div>

          {video.description && (
            <p className="text-muted-foreground">{video.description}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={handleDownload} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'تنزيل' : 'Download'}
            </Button>
            <Button variant="outline" onClick={handleShare} className="flex-1">
              <Share2 className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'مشاركة' : 'Share'}
            </Button>
          </div>
        </div>

        {/* Wakti branding */}
        <Card className="p-4 bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {language === 'ar' ? 'أُنشئ بواسطة Wakti' : 'Created with Wakti'}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'أنشئ فيديوهاتك الخاصة' : 'Create your own videos'}
              </p>
            </div>
            <Link to="/signup">
              <Button size="sm">
                {language === 'ar' ? 'ابدأ الآن' : 'Get Started'}
              </Button>
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
