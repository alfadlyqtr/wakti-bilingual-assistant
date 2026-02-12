import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Video,
  Loader2,
  Download,
  Share2,
  Trash2,
  Plus,
  Play,
  RefreshCw,
  Calendar,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';

interface AIVideo {
  id: string;
  title: string;
  video_url: string;
  source_image_url: string | null;
  prompt: string | null;
  duration_seconds: number;
  is_public: boolean;
  created_at: string;
}

interface MyAIVideosTabProps {
  onCreate: () => void;
}

export default function MyAIVideosTab({ onCreate }: MyAIVideosTabProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  const [videos, setVideos] = useState<AIVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<AIVideo | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const loadVideos = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('user_ai_videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (e) {
      console.error('Failed to load AI videos:', e);
      toast.error(language === 'ar' ? 'فشل تحميل الفيديوهات' : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, [user, language]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    setDeletingId(id);
    try {
      const { error } = await (supabase as any)
        .from('user_ai_videos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setVideos((prev) => prev.filter((v) => v.id !== id));
      if (selectedVideo?.id === id) setSelectedVideo(null);
      toast.success(language === 'ar' ? 'تم الحذف' : 'Deleted');
    } catch (e) {
      console.error('Delete failed:', e);
      toast.error(language === 'ar' ? 'فشل الحذف' : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (video: AIVideo) => {
    try {
      const response = await fetch(video.video_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${video.title || 'ai-video'}-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
      window.open(video.video_url, '_blank');
    }
  };

  const handleShare = async (video: AIVideo) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: video.title || 'Wakti AI Video',
          url: video.video_url,
        });
      } else {
        await navigator.clipboard.writeText(video.video_url);
        toast.success(language === 'ar' ? 'تم نسخ الرابط' : 'Link copied');
      }
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  const togglePublic = async (video: AIVideo) => {
    try {
      const { error } = await (supabase as any)
        .from('user_ai_videos')
        .update({ is_public: !video.is_public })
        .eq('id', video.id);

      if (error) throw error;
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, is_public: !v.is_public } : v))
      );
      toast.success(
        video.is_public
          ? (language === 'ar' ? 'تم إخفاء الفيديو' : 'Video hidden')
          : (language === 'ar' ? 'تم نشر الفيديو' : 'Video published')
      );
    } catch (e) {
      console.error('Toggle public failed:', e);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">
            {language === 'ar' ? 'فيديوهاتي AI' : 'My AI Videos'}{' '}
            <span className="text-muted-foreground font-normal">({videos.length})</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={loadVideos}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={onCreate}>
            <Plus className="h-4 w-4 mr-1" />
            {language === 'ar' ? 'جديد' : 'New'}
          </Button>
        </div>
      </div>

      {videos.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-primary/10">
              <Video className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-medium">
                {language === 'ar' ? 'لا توجد فيديوهات AI محفوظة' : 'No saved AI videos'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {language === 'ar'
                  ? 'أنشئ فيديو AI واحفظه هنا'
                  : 'Create an AI video and save it here'}
              </p>
            </div>
            <Button onClick={onCreate} className="mt-2">
              <Plus className="h-4 w-4 mr-1" />
              {language === 'ar' ? 'إنشاء فيديو AI' : 'Create AI Video'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <Card
              key={video.id}
              className={`overflow-hidden group cursor-pointer transition-all hover:shadow-lg ${
                selectedVideo?.id === video.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedVideo(video)}
            >
              {/* Video thumbnail / preview */}
              <div className="relative aspect-video bg-black">
                <video
                  src={video.video_url}
                  className="w-full h-full object-contain"
                  muted
                  loop
                  playsInline
                  onMouseEnter={(e) => e.currentTarget.play()}
                  onMouseLeave={(e) => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                    <Play className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="absolute top-2 right-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      video.is_public
                        ? 'bg-green-500/80 text-white'
                        : 'bg-black/60 text-white/80'
                    }`}
                  >
                    {video.is_public
                      ? (language === 'ar' ? 'عام' : 'Public')
                      : (language === 'ar' ? 'خاص' : 'Private')}
                  </span>
                </div>
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px]">
                  {video.duration_seconds}s
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="font-medium text-sm truncate">{video.title || 'Untitled'}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(video.created_at)}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 mt-2 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePublic(video);
                    }}
                  >
                    {video.is_public ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(video);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare(video);
                    }}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10 ml-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTargetId(video.id);
                    }}
                    disabled={deletingId === video.id}
                  >
                    {deletingId === video.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Selected video modal/expanded view */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="bg-background rounded-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{selectedVideo.title || 'Untitled'}</h3>
                <p className="text-xs text-muted-foreground">{formatDate(selectedVideo.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleDownload(selectedVideo)}>
                  <Download className="h-4 w-4 mr-1" />
                  {language === 'ar' ? 'تحميل' : 'Download'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleShare(selectedVideo)}>
                  <Share2 className="h-4 w-4 mr-1" />
                  {language === 'ar' ? 'مشاركة' : 'Share'}
                </Button>
              </div>
            </div>
            <div className="flex-1 bg-black p-2 overflow-auto">
              <video
                src={selectedVideo.video_url}
                controls
                autoPlay
                loop
                playsInline
                className="w-full max-h-[60vh] object-contain rounded-lg"
              />
            </div>
            {selectedVideo.prompt && (
              <div className="p-4 border-t">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === 'ar' ? 'الوصف:' : 'Prompt:'}
                </p>
                <p className="text-sm">{selectedVideo.prompt}</p>
              </div>
            )}
          </div>
        </div>
      )}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'حذف الفيديو' : 'Delete Video'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' ? 'هل تريد حذف هذا الفيديو؟' : 'Are you sure you want to delete this video?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {language === 'ar' ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
