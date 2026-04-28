import React, { useEffect, useMemo, useRef, useState } from 'react';
import { emitEvent, onEvent } from '@/utils/eventBus';
import { bgAudio } from '@/utils/bgAudio';
import InstagramPublishButton from '@/components/instagram/InstagramPublishButton';
import YouTubePublishBar from '@/components/youtube/YouTubePublishBar';
import TrialGateOverlay from '@/components/TrialGateOverlay';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useYouTubeConnection } from '@/hooks/useYouTubeConnection';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { AudioPlayer } from '@/components/music/AudioPlayer';
import { MusicSharePickerDialog } from '@/components/music/MusicSharePickerDialog';
import ShareButton from '@/components/ui/ShareButton';
import {
  Info,
  Wand2,
  Trash2,
  Music,
  Video,
  Image as ImageIcon,
  QrCode,
  RefreshCw,
  Plus,
  Loader2,
  Play,
  Eye,
  EyeOff,
  Share2,
  Save,
  AlertCircle,
  Pencil,
  Sparkles,
  Zap,
  ArrowRight,
  Palette,
  Mic,
  X,
  ListMusic,
  Check,
  Shuffle,
  Repeat,
  SkipForward,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Film,
  Download,
  CheckCircle2,
  Copy,
  Star,
  Search,
  Radio,
  SlidersHorizontal,
  RotateCcw,
  RotateCw,
  Youtube,
  ImagePlus,
} from 'lucide-react';
import AIVideomaker from '@/components/video-maker/AIVideomaker';
import StudioImageGenerator from '@/components/studio/StudioImageGenerator';
import SavedImagesTab from '@/components/studio/SavedImagesTab';
import QRCodeCreator from '@/components/studio/QRCodeCreator';
import { useLocation, useSearchParams } from 'react-router-dom';

const normalizeAudioUrl = (url: string) => {
  if (!url) return '';
  let cleanUrl = url.trim();
  try {
    cleanUrl = decodeURIComponent(cleanUrl).trim();
  } catch {
    // keep trimmed
  }
  if (cleanUrl.startsWith(' ')) {
    cleanUrl = cleanUrl.trimStart();
  }
  if (cleanUrl.startsWith('%20')) {
    cleanUrl = cleanUrl.slice(3).trimStart();
  }
  if (!/^https?:\/\//i.test(cleanUrl)) {
    const base = SUPABASE_URL.replace(/\/$/, '');
    if (cleanUrl.startsWith('/')) {
      cleanUrl = `${base}${cleanUrl}`;
    } else if (cleanUrl.startsWith('storage/v1/object/public/')) {
      cleanUrl = `${base}/${cleanUrl}`;
    }
  }
  return cleanUrl;
};

const saveAudioBlob = async (blob: Blob, filename: string) => {
  const file = new File([blob], filename, { type: blob.type || 'audio/mpeg' });
  if (navigator.share && navigator.canShare) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Wakti Music',
          text: 'Save your audio file',
        });
        return;
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return;
      }
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  }, 100);
};

// Helper function to download audio files on mobile
const handleDownload = async (url: string, filename: string) => {
  try {
    const safeUrl = normalizeAudioUrl(url);
    if (!safeUrl) {
      throw new Error('Missing audio URL');
    }
    
    const response = await fetch(safeUrl);
    const blob = await response.blob();

    await saveAudioBlob(blob, filename);
  } catch (error) {
    console.error('Download failed:', error);
    // Last resort: open in new tab
    const safeUrl = normalizeAudioUrl(url);
    if (safeUrl) {
      window.open(safeUrl, '_blank');
    }
  }
 };

 interface SavedVideo {
  id: string;
  title: string | null;
  thumbnail_url?: string | null;
  video_url?: string | null;
  storage_path: string | null;
  duration_seconds: number | null;
  is_public: boolean;
  created_at: string;
  signedUrl?: string | null;
  thumbnailSignedUrl?: string | null;
  source?: 'user' | 'ai';
  youtube_video_id?: string | null;
  youtube_video_url?: string | null;
  youtube_published_at?: string | null;
 }

 function VideoPlayer({ url, storagePath, language }: { url: string; storagePath?: string | null; language: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchVideo = async () => {
      setLoading(true);
      setError(false);
      try {
        if (storagePath) {
          const { data, error: dlError } = await supabase.storage
            .from('videos')
            .download(storagePath);
          if (dlError) throw dlError;
          if (cancelled) return;
          const objectUrl = URL.createObjectURL(data);
          setBlobUrl(objectUrl);
        } else {
          const res = await fetch(url);
          if (!res.ok) throw new Error('Fetch failed');
          const blob = await res.blob();
          if (cancelled) return;
          const objectUrl = URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
        }
      } catch (e) {
        console.error('[VideoPlayer] Fetch error:', e);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchVideo();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url, storagePath]);

  const handleDownload = async () => {
    try {
      if (storagePath) {
        const { data, error: dlError } = await supabase.storage
          .from('videos')
          .download(storagePath);
        if (dlError) throw dlError;
        const downloadUrl = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = storagePath.split('/').pop() || 'video.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      } else {
        window.open(url, '_blank');
      }
    } catch (e) {
      console.error('[VideoPlayer] Download error:', e);
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="px-3 pb-3 flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="px-3 pb-3 space-y-2">
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
          <p>{language === 'ar' ? 'تعذر تحميل الفيديو' : 'Could not load video'}</p>
        </div>
        <div className="flex justify-center">
          <Button size="sm" variant="default" onClick={handleDownload}>
            {language === 'ar' ? 'تحميل الفيديو' : 'Download Video'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3 space-y-2">
      <video
        src={blobUrl}
        controls
        autoPlay
        playsInline
        preload="auto"
        className="w-full max-h-[60vh] rounded-lg bg-black object-contain"
      />
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={handleDownload}>
          {language === 'ar' ? 'تحميل الفيديو' : 'Download Video'}
        </Button>
      </div>
    </div>
  );
}

function VideoThumbnail({ fallbackDuration }: {
  videoUrl: string | null;
  storagePath: string | null;
  fallbackThumbnail: string | null;
  fallbackDuration: number | null;
}) {
  const [realDuration] = useState<number | null>(fallbackDuration);

  const formatDur = (sec: number | null | undefined) => {
    if (!sec || sec <= 0) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
  };

  return (
    <>
      <div className="w-full h-full flex items-center justify-center">
        <Video className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Play className="h-8 w-8 text-white" />
      </div>
      {!!realDuration && (
        <div className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-white font-medium">
          {formatDur(realDuration)}
        </div>
      )}
    </>
  );
}

 function SavedVideosTab({ onCreate }: { onCreate: () => void }) {
  const { language } = useTheme();
  const { user } = useAuth();

  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [savingLegacy, setSavingLegacy] = useState<Record<string, boolean>>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteVideo, setPendingDeleteVideo] = useState<SavedVideo | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const loadSavedVideos = async () => {
    if (!user) return;
    setLoadingVideos(true);
    try {
      const { data, error } = await (supabase as any)
        .from('user_videos')
        .select('id, title, thumbnail_url, storage_path, duration_seconds, is_public, created_at, video_url, youtube_video_id, youtube_video_url, youtube_published_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows: SavedVideo[] = (data || []) as SavedVideo[];
      const withUrls: SavedVideo[] = await Promise.all(
        rows.map(async (v) => {
          let signedUrl: string | null = null;
          let thumbnailSignedUrl: string | null = null;

          if (v.storage_path) {
            const { data: pubData } = supabase.storage.from('videos').getPublicUrl(v.storage_path);
            signedUrl = pubData?.publicUrl || null;
          } else if (v.video_url) {
            signedUrl = v.video_url;
          }

          if ((v as any).thumbnail_url) {
            const thumbPath = (v as any).thumbnail_url as string;
            const { data: tUrl } = supabase.storage.from('videos').getPublicUrl(thumbPath);
            thumbnailSignedUrl = tUrl?.publicUrl || null;
          }

          return { ...v, signedUrl, thumbnailSignedUrl, source: 'user' };
        })
      );

      const { data: aiData, error: aiError } = await (supabase as any)
        .from('user_ai_videos')
        .select('id, title, video_url, source_image_url, duration_seconds, is_public, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (aiError) throw aiError;

      const aiVideos: SavedVideo[] = (aiData || []).map((v: any) => ({
        id: v.id,
        title: v.title || null,
        video_url: v.video_url || null,
        storage_path: null,
        duration_seconds: v.duration_seconds || 5,
        is_public: !!v.is_public,
        created_at: v.created_at,
        signedUrl: v.video_url || null,
        thumbnailSignedUrl: v.source_image_url || null,
        source: 'ai',
        youtube_video_id: null,
        youtube_video_url: null,
        youtube_published_at: null,
      }));

      const merged = [...withUrls, ...aiVideos].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setSavedVideos(merged);
    } catch (e) {
      console.error('Failed to load saved videos:', e);
      toast.error(language === 'ar' ? 'فشل تحميل الفيديوهات' : 'Failed to load videos');
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleSaveLegacyVideo = async (v: SavedVideo) => {
    if (!user) return;
    const sourceUrl = v.signedUrl || v.video_url;
    if (!sourceUrl) {
      toast.error(language === 'ar' ? 'الرابط غير متاح' : 'Video URL unavailable');
      return;
    }

    setSavingLegacy((prev) => ({ ...prev, [v.id]: true }));
    try {
      const { data: importData, error: importError } = await supabase.functions.invoke('import-external-video', {
        body: {
          sourceUrl,
          filenameHint: v.title || 'legacy-video',
        },
      });
      if (importError) throw importError;
      const storagePath = importData?.storagePath as string | undefined;
      if (!storagePath) {
        throw new Error(importData?.error || 'Failed to save video');
      }

      if (v.source === 'ai') {
        const { error: insertError } = await (supabase as any).from('user_videos').insert({
          user_id: user.id,
          title: v.title || 'AI Video',
          storage_path: storagePath,
          video_url: null,
          duration_seconds: v.duration_seconds || null,
          aspect_ratio: '9:16',
          style_template: 'ai',
          is_public: v.is_public,
        });
        if (insertError) throw insertError;

        const { error: deleteError } = await (supabase as any)
          .from('user_ai_videos')
          .delete()
          .eq('id', v.id)
          .eq('user_id', user.id);
        if (deleteError) {
          console.warn('Failed to delete legacy AI row:', deleteError);
        }
      } else {
        const { error: updateError } = await (supabase as any)
          .from('user_videos')
          .update({ storage_path: storagePath, video_url: null })
          .eq('id', v.id)
          .eq('user_id', user.id);
        if (updateError) throw updateError;
      }

      toast.success(language === 'ar' ? 'تم حفظ الفيديو للتشغيل' : 'Video saved for playback');
      await loadSavedVideos();
    } catch (e) {
      console.error('Legacy save failed:', e);
      toast.error(language === 'ar' ? 'فشل حفظ الفيديو' : 'Failed to save video');
    } finally {
      setSavingLegacy((prev) => {
        const next = { ...prev };
        delete next[v.id];
        return next;
      });
    }
  };

  useEffect(() => {
    loadSavedVideos();
  }, [user?.id]);

  const formatDuration = (sec: number | null | undefined) => {
    if (!sec || sec <= 0) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
  };

  const confirmDeleteSavedVideo = async () => {
    if (!user || !pendingDeleteVideo) return;
    const v = pendingDeleteVideo;
    try {
      if (v.source !== 'ai' && v.storage_path) {
        await supabase.storage.from('videos').remove([v.storage_path]);
      }
      if (v.source !== 'ai' && (v as any).thumbnail_url) {
        await supabase.storage.from('videos').remove([(v as any).thumbnail_url]);
      }
      const deleteTable = v.source === 'ai' ? 'user_ai_videos' : 'user_videos';
      await (supabase as any).from(deleteTable).delete().eq('id', v.id).eq('user_id', user.id);

      setSavedVideos((prev) => prev.filter((x) => x.id !== v.id));
      if (activePreviewId === v.id) setActivePreviewId(null);
      toast.success(language === 'ar' ? 'تم الحذف' : 'Deleted');
    } catch (e) {
      console.error('Delete failed:', e);
      toast.error(language === 'ar' ? 'فشل الحذف' : 'Delete failed');
    } finally {
      setDeleteDialogOpen(false);
      setPendingDeleteVideo(null);
    }
  };

  const handleDeleteSavedVideo = (v: SavedVideo) => {
    setPendingDeleteVideo(v);
    setDeleteDialogOpen(true);
  };

  const handleRenameVideo = async (v: SavedVideo) => {
    const newTitle = editingTitle.trim();
    if (!user || !newTitle || newTitle === (v.title || '')) {
      setEditingId(null);
      return;
    }
    try {
      const updateTable = v.source === 'ai' ? 'user_ai_videos' : 'user_videos';
      const { error } = await (supabase as any)
        .from(updateTable)
        .update({ title: newTitle })
        .eq('id', v.id)
        .eq('user_id', user.id);
      if (error) throw error;
      setSavedVideos((prev) => prev.map((x) => (x.id === v.id ? { ...x, title: newTitle } : x)));
      toast.success(language === 'ar' ? 'تم تحديث العنوان' : 'Title updated');
    } catch (e) {
      console.error('Rename failed:', e);
      toast.error(language === 'ar' ? 'فشل تحديث العنوان' : 'Rename failed');
    } finally {
      setEditingId(null);
    }
  };

  const handleShareSavedVideo = async (v: SavedVideo) => {
    if (!v.storage_path || v.source === 'ai') {
      toast.error(language === 'ar' ? 'احفظ الفيديو للتشغيل أولاً' : 'Save for playback first');
      return;
    }
    if (!v.is_public) {
      toast.error(language === 'ar' ? 'اجعل الفيديو عاماً أولاً' : 'Make the video public first');
      return;
    }

    const shareUrl = `${window.location.origin}/video/${v.id}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: v.title || 'Wakti Video', url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(language === 'ar' ? 'تم نسخ الرابط' : 'Link copied');
      }
    } catch (_) {}
  };

  const handleTogglePublic = async (v: SavedVideo) => {
    if (!user) return;
    try {
      const next = !v.is_public;
      const updateTable = v.source === 'ai' ? 'user_ai_videos' : 'user_videos';
      const { error } = await (supabase as any).from(updateTable).update({ is_public: next }).eq('id', v.id).eq('user_id', user.id);
      if (error) throw error;
      setSavedVideos((prev) => prev.map((x) => (x.id === v.id ? { ...x, is_public: next } : x)));
      toast.success(
        next ? (language === 'ar' ? 'تم جعله عاماً' : 'Now public') : (language === 'ar' ? 'تم جعله خاصاً' : 'Now private')
      );
    } catch (e) {
      console.error('Toggle public failed:', e);
      toast.error(language === 'ar' ? 'فشل التحديث' : 'Update failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {language === 'ar' ? 'فيديوهاتي' : 'My Videos'}
          {savedVideos.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">({savedVideos.length})</span>
          )}
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadSavedVideos} disabled={loadingVideos}>
            {loadingVideos ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button size="sm" onClick={onCreate}>
            <Plus className="h-4 w-4 mr-1" />
            {language === 'ar' ? 'جديد' : 'New'}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {language === 'ar'
            ? 'يتم حذف الفيديوهات المحفوظة تلقائياً بعد 20 يوماً'
            : 'Saved videos are automatically deleted after 20 days'}
        </p>
      </div>

      {loadingVideos ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : savedVideos.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-muted">
              <Video className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{language === 'ar' ? 'لا توجد فيديوهات بعد' : 'No videos yet'}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {language === 'ar' ? 'أنشئ أول فيديو لك!' : 'Create your first video!'}
              </p>
            </div>
            <Button onClick={onCreate} className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'إنشاء فيديو' : 'Create Video'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {savedVideos.map((v) => (
            <Card key={v.id} className="overflow-hidden">
              <div className="flex gap-3 p-3">
                <button
                  className="w-20 h-28 md:w-24 md:h-32 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 shrink-0 relative group"
                  onClick={() => setActivePreviewId((prev) => (prev === v.id ? null : v.id))}
                  aria-label={v.title || (language === 'ar' ? 'تشغيل الفيديو' : 'Play video')}
                >
                  <VideoThumbnail
                    videoUrl={v.signedUrl || v.video_url || null}
                    storagePath={v.storage_path}
                    fallbackThumbnail={v.thumbnailSignedUrl || null}
                    fallbackDuration={v.duration_seconds}
                  />
                </button>

                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                  <div>
                    {editingId === v.id ? (
                      <input
                        autoFocus
                        className="font-medium text-sm w-full bg-transparent border-b-2 border-primary outline-none py-0.5"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => handleRenameVideo(v)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameVideo(v);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        maxLength={100}
                        aria-label={language === 'ar' ? 'عنوان الفيديو' : 'Video title'}
                        placeholder={language === 'ar' ? 'أدخل عنوان...' : 'Enter title...'}
                      />
                    ) : (
                      <div className="flex items-center gap-1.5 group/title">
                        <h3 className="font-medium truncate">{v.title || (language === 'ar' ? 'بدون عنوان' : 'Untitled')}</h3>
                        <button
                          className="p-0.5 rounded hover:bg-muted"
                          onClick={() => {
                            setEditingId(v.id);
                            setEditingTitle(v.title || '');
                          }}
                          title={language === 'ar' ? 'تعديل العنوان' : 'Edit title'}
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(v.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {' · '}
                      {new Date(v.created_at).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          v.is_public
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {v.is_public ? (language === 'ar' ? 'عام' : 'Public') : (language === 'ar' ? 'خاص' : 'Private')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <InstagramPublishButton
                      mediaUrl={v.signedUrl || v.video_url || ''}
                      mediaType="reel"
                      publishTarget="reel"
                      language={language as 'en' | 'ar'}
                    />
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {(v.source === 'ai' || (!v.storage_path && v.video_url)) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => handleSaveLegacyVideo(v)}
                        disabled={!!savingLegacy[v.id]}
                        title={language === 'ar' ? 'حفظ للتشغيل' : 'Save for playback'}
                      >
                        {savingLegacy[v.id] ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => handleTogglePublic(v)}>
                      {v.is_public ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <button
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
                      onClick={() => handleShareSavedVideo(v)}
                      aria-label="Share"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => handleDeleteSavedVideo(v)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {v.signedUrl && v.storage_path && (
                      <YouTubePublishBar
                        fileUrl={v.signedUrl}
                        title={v.title || (language === 'ar' ? 'فيديو من وقتي' : 'Video from Wakti')}
                        description=""
                        isShort={false}
                        language={language}
                        initialYoutubeUrl={v.youtube_video_url || null}
                        onPublished={async (result) => {
                          if (!user || v.source !== 'user') return;
                          const payload = {
                            youtube_video_id: result.videoId,
                            youtube_video_url: result.videoUrl,
                            youtube_published_at: new Date().toISOString(),
                          };
                          const { error } = await (supabase as any)
                            .from('user_videos')
                            .update(payload)
                            .eq('id', v.id)
                            .eq('user_id', user.id);
                          if (error) throw error;
                          setSavedVideos((prev) => prev.map((x) => (x.id === v.id ? { ...x, ...payload } : x)));
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              {activePreviewId === v.id && v.signedUrl && <VideoPlayer url={v.signedUrl} storagePath={v.storage_path} language={language} />}
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setPendingDeleteVideo(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === 'ar' ? 'حذف الفيديو؟' : 'Delete video?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' ? 'لا يمكن التراجع عن هذا الإجراء.' : "This action can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDeleteSavedVideo}>
              {language === 'ar' ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
 }

// ── Generating Widget ──────────────────────────────────────────────────────
const MUSIC_NOTE_CHARS = ['♩', '♪', '♫', '♬', '𝅗𝅥', '𝅘𝅥𝅮', '♭', '♮'];

function GeneratingWidget({ isAr }: { isAr: boolean }) {
  const [noteIdx, setNoteIdx] = React.useState(0);
  const [progress, setProgress] = React.useState(3);

  // Cycle through note characters every 500ms
  React.useEffect(() => {
    const id = setInterval(() => {
      setNoteIdx((p) => (p + 1) % MUSIC_NOTE_CHARS.length);
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Slowly grow progress bar over ~90s, never reaching 100% until done
  React.useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p; // stall near 92% — never fake 100%
        const step = p < 30 ? 1.2 : p < 60 ? 0.7 : p < 80 ? 0.35 : 0.1;
        return Math.min(92, p + step);
      });
    }, 800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-2xl border border-sky-400/20 bg-sky-500/5 p-6 flex flex-col items-center gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-sky-400/20" />
        <div className="absolute inset-0 rounded-full border-2 border-t-sky-400 animate-spin" />
        <div className="absolute inset-3 rounded-full bg-sky-500/10 flex items-center justify-center">
          <span
            key={noteIdx}
            className="text-xl text-sky-400 transition-all duration-300 animate-pulse select-none"
            style={{ display: 'inline-block' }}
          >
            {MUSIC_NOTE_CHARS[noteIdx]}
          </span>
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="font-semibold text-sm text-sky-300">{isAr ? 'جارٍ إنشاء موسيقاك...' : 'Creating your music...'}</p>
        <p className="text-xs text-muted-foreground">{isAr ? 'قد يستغرق ذلك دقيقة أو دقيقتين' : 'This usually takes 1–2 minutes'}</p>
      </div>
      <div className="w-full max-w-48 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-sky-400 via-purple-400 to-pink-400 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground/50">{Math.round(progress)}%</p>
    </div>
  );
}
// ───────────────────────────────────────────────────────────────────────────

export default function MusicStudio() {
  const { language } = useTheme();
  const [mainTab, setMainTab] = useState<'studio' | 'music' | 'video' | 'image' | 'qrcode'>(() => {
    try { return sessionStorage.getItem(PL_BG_KEY) === '1' ? 'music' : 'studio'; } catch { return 'studio'; }
  });
  const [musicSubTab, setMusicSubTab] = useState<'compose' | 'editor'>(() => {
    try { return sessionStorage.getItem(PL_BG_KEY) === '1' ? 'editor' : 'compose'; } catch { return 'compose'; }
  });
  const [videoMode, setVideoMode] = useState<'ai' | 'saved'>('ai');
  const [imageMode, setImageMode] = useState<'create' | 'saved'>('create');
  const [savedImagesRefreshKey, setSavedImagesRefreshKey] = useState(0);
  const [musicQuotaHeader, setMusicQuotaHeader] = useState<{ remaining: number; limit: number; used: number } | null>(null);
  const [editorEverVisited, setEditorEverVisited] = useState(() => {
    try { return sessionStorage.getItem(PL_BG_KEY) === '1'; } catch { return false; }
  });
  const topTabsRef = useRef<HTMLDivElement | null>(null);
  const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);
  const { user: authUser } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const node = topTabsRef.current;
    if (!node) return;

    const updateScrollState = () => {
      const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
      setCanScrollTabsLeft(node.scrollLeft > 8);
      setCanScrollTabsRight(node.scrollLeft < maxScrollLeft - 8);
    };

    updateScrollState();
    node.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);

    return () => {
      node.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, []);

  const scrollTopTabsBy = (direction: 'left' | 'right') => {
    const node = topTabsRef.current;
    if (!node) return;
    const amount = Math.max(120, Math.floor(node.clientWidth * 0.55));
    node.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    const state = (location.state || {}) as any;
    if (state?.openVideoTab) {
      setMainTab('video');
      setVideoMode('saved');
    }
  }, [location.state]);

  useEffect(() => {
    if (searchParams.get('subtab') === 'editor') {
      setMainTab('music');
      setMusicSubTab('editor');
    }
  }, [searchParams]);

  // Always load quota when music tab is open, regardless of compose/saved sub-tab
  useEffect(() => {
    if (mainTab !== 'music' || !authUser) return;
    let cancelled = false;
    const fetchQuota = async () => {
      try {
        const { data, error } = await (supabase as any).rpc('can_generate_music');
        if (!error && data && !cancelled) {
          const used = data.generated ?? 0;
          const limit = data.limit ?? 30;
          setMusicQuotaHeader({ used, limit, remaining: Math.max(0, limit - used) });
        }
      } catch {}
    };
    fetchQuota();
    const onVisible = () => { if (document.visibilityState === 'visible') fetchQuota(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); };
  }, [mainTab, authUser?.id]);

  const isArabic = language === 'ar';

  const studioCards: {
    key: 'music' | 'video' | 'image' | 'qrcode';
    icon: React.ReactNode;
    icon3dBg: string;
    icon3dGlow: string;
    icon3dInner: string;
    titleEn: string;
    titleAr: string;
    descEn: string;
    descAr: string;
    cardBg: string;
    cardBorder: string;
    shadow: string;
    prominent?: boolean;
    bentoSpan?: string;
    accentGlowStyle: string;
    badge?: { en: string; ar: string };
  }[] = [
    {
      key: 'music',
      icon: <Music className="h-7 w-7" />,
      icon3dBg: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 60%, #1e40af 100%)',
      icon3dGlow: '0 0 22px hsla(210,100%,65%,0.7), 0 0 8px hsla(210,100%,75%,0.5), inset 0 1px 0 rgba(255,255,255,0.35)',
      icon3dInner: 'linear-gradient(145deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 100%)',
      titleEn: 'Music',
      titleAr: 'الموسيقى',
      descEn: 'Compose AI-powered tracks, choose genres, moods & instruments.',
      descAr: 'أنشئ مقطوعات موسيقية بالذكاء الاصطناعي، اختر الأنماط والمزاج والآلات.',
      cardBg: 'bg-gradient-to-br from-sky-900/30 via-blue-950/40 to-cyan-900/20 dark:from-sky-950/50 dark:via-blue-950/50 dark:to-cyan-950/30',
      cardBorder: 'border border-sky-400/20 dark:border-sky-400/15',
      shadow: 'shadow-[0_8px_32px_-4px_hsla(210,100%,65%,0.18)]',
      accentGlowStyle: 'radial-gradient(ellipse 80% 50% at 50% 120%, hsla(210,100%,65%,0.18), transparent)',
    },
    {
      key: 'video',
      icon: <Video className="h-8 w-8" />,
      icon3dBg: 'linear-gradient(135deg, #fb923c 0%, #f43f5e 55%, #dc2626 100%)',
      icon3dGlow: '0 0 26px hsla(25,95%,60%,0.8), 0 0 10px hsla(350,90%,65%,0.5), inset 0 1px 0 rgba(255,255,255,0.35)',
      icon3dInner: 'linear-gradient(145deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.04) 100%)',
      titleEn: 'Video',
      titleAr: 'الفيديو',
      descEn: 'Generate cinematic videos from text or images in seconds.',
      descAr: 'أنشئ فيديوهات سينمائية من النصوص أو الصور في ثوانٍ.',
      cardBg: 'bg-gradient-to-br from-orange-900/35 via-rose-950/40 to-pink-900/25 dark:from-orange-950/55 dark:via-rose-950/50 dark:to-pink-950/35',
      cardBorder: 'border border-orange-400/25 dark:border-orange-400/20',
      shadow: 'shadow-[0_8px_40px_-4px_hsla(25,95%,60%,0.28)]',
      prominent: true,
      bentoSpan: 'md:col-span-1 md:row-span-2',
      accentGlowStyle: 'radial-gradient(ellipse 80% 50% at 50% 120%, hsla(25,95%,60%,0.22), transparent)',
      badge: { en: '🎬 Featured', ar: '🎬 مميز' },
    },
    {
      key: 'image',
      icon: <Palette className="h-8 w-8" />,
      icon3dBg: 'linear-gradient(135deg, #34d399 0%, #0d9488 55%, #065f46 100%)',
      icon3dGlow: '0 0 26px hsla(160,80%,55%,0.8), 0 0 10px hsla(175,80%,50%,0.5), inset 0 1px 0 rgba(255,255,255,0.35)',
      icon3dInner: 'linear-gradient(145deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.04) 100%)',
      titleEn: 'Image',
      titleAr: 'الصورة',
      descEn: 'Create stunning visuals, style transfers, background removal & more.',
      descAr: 'أنشئ صورًا مذهلة، نقل الأنماط، إزالة الخلفية والمزيد.',
      cardBg: 'bg-gradient-to-br from-emerald-900/35 via-teal-950/40 to-cyan-900/25 dark:from-emerald-950/55 dark:via-teal-950/50 dark:to-cyan-950/35',
      cardBorder: 'border border-emerald-400/25 dark:border-emerald-400/20',
      shadow: 'shadow-[0_8px_40px_-4px_hsla(160,80%,55%,0.28)]',
      prominent: true,
      bentoSpan: 'md:col-span-1 md:row-span-2',
      accentGlowStyle: 'radial-gradient(ellipse 80% 50% at 50% 120%, hsla(160,80%,55%,0.22), transparent)',
      badge: { en: '✨ Popular', ar: '✨ الأكثر استخداماً' },
    },
    {
      key: 'qrcode',
      icon: <QrCode className="h-7 w-7" />,
      icon3dBg: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 55%, #4c1d95 100%)',
      icon3dGlow: '0 0 22px hsla(280,70%,65%,0.7), 0 0 8px hsla(280,80%,75%,0.5), inset 0 1px 0 rgba(255,255,255,0.35)',
      icon3dInner: 'linear-gradient(145deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 100%)',
      titleEn: 'QR Code',
      titleAr: 'كود QR رموز',
      descEn: 'Create custom QR codes for links, contacts, Wi-Fi & more.',
      descAr: 'أنشئ رموز QR مخصصة للروابط وجهات الاتصال والواي فاي والمزيد.',
      cardBg: 'bg-gradient-to-br from-violet-900/30 via-purple-950/40 to-indigo-900/20 dark:from-violet-950/50 dark:via-purple-950/50 dark:to-indigo-950/30',
      cardBorder: 'border border-violet-400/20 dark:border-violet-400/15',
      shadow: 'shadow-[0_8px_32px_-4px_hsla(280,70%,65%,0.18)]',
      accentGlowStyle: 'radial-gradient(ellipse 80% 50% at 50% 120%, hsla(280,70%,65%,0.18), transparent)',
    },
  ];

  // Music tab trial gate (music:1). Other tabs have their own sub-component gates or are OPEN (qrcode).
  const musicTrialKey = mainTab === 'music' ? 'music' : '';
  const musicTrialLimit = mainTab === 'music' ? 1 : 0;

  return (
    <div className="w-full max-w-6xl mx-auto p-3 md:p-6 pb-20 md:pb-6 space-y-4">
      <TrialGateOverlay featureKey={musicTrialKey} limit={musicTrialLimit} featureLabel={{ en: 'Music', ar: 'الموسيقى' }} />
      {/* ─── Pressable Pill Tabs ─── */}
      <div className="relative">
        {canScrollTabsLeft && (
          <button
            type="button"
            onClick={() => scrollTopTabsBy('left')}
            className="absolute left-1 top-1/2 z-10 -translate-y-1/2 h-8 w-8 rounded-full bg-[#0c0f14]/85 text-white border border-white/10 shadow-[0_4px_18px_hsla(0,0%,0%,0.45)] backdrop-blur-md flex items-center justify-center active:scale-95 transition-all"
            aria-label={isArabic ? 'تمرير لليسار' : 'Scroll left'}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {canScrollTabsRight && (
          <button
            type="button"
            onClick={() => scrollTopTabsBy('right')}
            className="absolute right-1 top-1/2 z-10 -translate-y-1/2 h-8 w-8 rounded-full bg-[#0c0f14]/85 text-white border border-white/10 shadow-[0_4px_18px_hsla(0,0%,0%,0.45)] backdrop-blur-md flex items-center justify-center active:scale-95 transition-all"
            aria-label={isArabic ? 'تمرير لليمين' : 'Scroll right'}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 rounded-l-2xl bg-gradient-to-r from-[#0c0f14]/70 via-[#0c0f14]/35 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 rounded-r-2xl bg-gradient-to-l from-[#0c0f14]/70 via-[#0c0f14]/35 to-transparent" />

        <div
          ref={topTabsRef}
          className="flex gap-2.5 p-2 rounded-2xl bg-black/20 dark:bg-black/30 backdrop-blur-xl border border-white/10 dark:border-white/[0.08] shadow-inner overflow-x-auto scrollbar-hide scroll-smooth"
        >
          {[
            { key: 'music' as const, icon: <Music className="h-3.5 w-3.5" />, labelEn: 'Music', labelAr: 'الموسيقى', activeGrad: 'from-sky-500 to-blue-600', activeShadow: 'shadow-[0_4px_14px_hsla(210,100%,65%,0.45)]' },
            { key: 'video' as const, icon: <Video className="h-3.5 w-3.5" />, labelEn: 'Video', labelAr: 'الفيديو', activeGrad: 'from-orange-500 to-rose-500', activeShadow: 'shadow-[0_4px_14px_hsla(25,95%,60%,0.45)]' },
            { key: 'image' as const, icon: <ImageIcon className="h-3.5 w-3.5" />, labelEn: 'Image', labelAr: 'الصورة', activeGrad: 'from-emerald-500 to-teal-500', activeShadow: 'shadow-[0_4px_14px_hsla(160,80%,55%,0.45)]' },
            { key: 'qrcode' as const, icon: <QrCode className="h-3.5 w-3.5" />, labelEn: 'QR Code', labelAr: 'كود QR', activeGrad: 'from-violet-500 to-purple-600', activeShadow: 'shadow-[0_4px_14px_hsla(280,70%,65%,0.45)]' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMainTab(tab.key)}
              className={`flex items-center justify-center gap-1.5 px-4 md:px-6 py-2.5 rounded-xl font-semibold text-xs md:text-sm transition-all duration-200 active:scale-[0.93] whitespace-nowrap flex-shrink-0 min-w-max ${
                mainTab === tab.key
                  ? `bg-gradient-to-r ${tab.activeGrad} text-white ${tab.activeShadow} scale-[1.03]`
                  : 'bg-white/[0.07] dark:bg-white/[0.05] text-foreground/70 hover:bg-white/[0.13] dark:hover:bg-white/[0.1] hover:text-foreground border border-white/10 dark:border-white/[0.07]'
              }`}
            >
              {tab.icon}
              {isArabic ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Studio Landing Hub ─── */}
      {mainTab === 'studio' && (
        <div className="relative space-y-8 py-4 md:py-8">

          {/* Ambient radial glow background */}
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl">
            <div className="absolute top-[-10%] left-[10%] w-[55%] h-[45%] rounded-full opacity-30 dark:opacity-20 blur-[80px]" style={{ background: 'radial-gradient(ellipse, hsla(210,100%,65%,1) 0%, transparent 70%)' }} />
            <div className="absolute top-[20%] right-[5%] w-[45%] h-[40%] rounded-full opacity-25 dark:opacity-18 blur-[90px]" style={{ background: 'radial-gradient(ellipse, hsla(280,70%,65%,1) 0%, transparent 70%)' }} />
            <div className="absolute bottom-[5%] left-[20%] w-[50%] h-[40%] rounded-full opacity-20 dark:opacity-15 blur-[100px]" style={{ background: 'radial-gradient(ellipse, hsla(160,80%,55%,1) 0%, transparent 70%)' }} />
            <div className="absolute bottom-[15%] right-[15%] w-[35%] h-[30%] rounded-full opacity-20 dark:opacity-15 blur-[70px]" style={{ background: 'radial-gradient(ellipse, hsla(25,95%,60%,1) 0%, transparent 70%)' }} />
          </div>

          {/* Hero */}
          <div className="text-center">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-[#060541] via-blue-600 to-sky-500 dark:from-white dark:via-sky-200 dark:to-blue-300 bg-clip-text text-transparent leading-tight">
              {isArabic ? 'استوديو وقتي الإبداعي' : 'Wakti Creative Studio'}
            </h1>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 grid-rows-auto md:grid-rows-2 gap-3 md:gap-4">
            {/* Music — small top-left */}
            {studioCards.filter(c => c.key === 'music').map((card) => (
              <button
                key={card.key}
                onClick={() => setMainTab(card.key)}
                className={`relative text-left p-5 rounded-3xl ${card.cardBg} ${card.shadow} ${card.cardBorder} backdrop-blur-2xl overflow-hidden transition-all duration-200 active:scale-[0.96] col-span-1 row-span-1 group`}
              >
                {/* Soft radial pulse behind card */}
                <div className="pointer-events-none absolute inset-0 -z-10 scale-110 opacity-30 blur-2xl" style={{ background: 'radial-gradient(circle, hsla(210,100%,65%,0.4) 0%, transparent 70%)' }} />
                {/* Shimmering glass border effect */}
                <div className="absolute inset-0 rounded-3xl border border-white/40 dark:border-white/30" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.3) 100%)', mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', maskComposite: 'xor', WebkitMaskComposite: 'xor', padding: '1px', opacity: 0.8 }} />
                <div className="pointer-events-none absolute inset-0" style={{ background: card.accentGlowStyle }} />
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4 relative"
                  style={{ background: card.icon3dBg, boxShadow: card.icon3dGlow }}
                >
                  <div className="absolute inset-0 rounded-2xl" style={{ background: card.icon3dInner }} />
                  <span className="relative text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]">{card.icon}</span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-extrabold text-foreground tracking-tight">{isArabic ? card.titleAr : card.titleEn}</h3>
                  <ArrowRight className={`h-4 w-4 text-muted-foreground/40 shrink-0 ${isArabic ? 'rotate-180' : ''}`} />
                </div>
                <p className="text-[12px] text-muted-foreground/80 leading-relaxed line-clamp-2">{isArabic ? card.descAr : card.descEn}</p>
              </button>
            ))}

            {/* Video — prominent, spans 2 rows on md */}
            {studioCards.filter(c => c.key === 'video').map((card) => (
              <button
                key={card.key}
                onClick={() => setMainTab(card.key)}
                className={`relative text-left p-6 rounded-3xl ${card.cardBg} ${card.shadow} ${card.cardBorder} backdrop-blur-2xl overflow-hidden transition-all duration-200 active:scale-[0.96] col-span-1 row-span-1 md:row-span-2 group`}
              >
                {/* Soft radial pulse behind card — orange */}
                <div className="pointer-events-none absolute inset-0 -z-10 scale-110 opacity-40 blur-3xl" style={{ background: 'radial-gradient(circle, hsla(25,95%,60%,0.35) 0%, transparent 70%)' }} />
                <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 120%, hsla(25,95%,60%,0.22), transparent)' }} />
                {card.badge && (
                  <span className="absolute top-4 right-4 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-400/30 backdrop-blur-sm">
                    {isArabic ? card.badge.ar : card.badge.en}
                  </span>
                )}
                {/* Shimmering glass border effect */}
                <div className="absolute inset-0 rounded-3xl border border-white/40 dark:border-white/30" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.35) 100%)', mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', maskComposite: 'xor', WebkitMaskComposite: 'xor', padding: '1px', opacity: 0.8 }} />
                <div
                  className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 relative"
                  style={{ background: card.icon3dBg, boxShadow: card.icon3dGlow }}
                >
                  <div className="absolute inset-0 rounded-2xl" style={{ background: card.icon3dInner }} />
                  <span className="relative text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">{card.icon}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-extrabold text-foreground tracking-tight">{isArabic ? card.titleAr : card.titleEn}</h3>
                  <ArrowRight className={`h-5 w-5 text-muted-foreground/40 shrink-0 ${isArabic ? 'rotate-180' : ''}`} />
                </div>
                <p className="text-[13px] text-muted-foreground/80 leading-relaxed">{isArabic ? card.descAr : card.descEn}</p>
              </button>
            ))}

            {/* Image — prominent, spans 2 rows on md */}
            {studioCards.filter(c => c.key === 'image').map((card) => (
              <button
                key={card.key}
                onClick={() => setMainTab(card.key)}
                className={`relative text-left p-6 rounded-3xl ${card.cardBg} ${card.shadow} ${card.cardBorder} backdrop-blur-2xl overflow-hidden transition-all duration-200 active:scale-[0.96] col-span-1 row-span-1 md:row-span-2 group`}
              >
                {/* Soft radial pulse behind card — emerald */}
                <div className="pointer-events-none absolute inset-0 -z-10 scale-110 opacity-40 blur-3xl" style={{ background: 'radial-gradient(circle, hsla(160,80%,55%,0.35) 0%, transparent 70%)' }} />
                <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 120%, hsla(160,80%,55%,0.22), transparent)' }} />
                {card.badge && (
                  <span className="absolute top-4 right-4 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 backdrop-blur-sm">
                    {isArabic ? card.badge.ar : card.badge.en}
                  </span>
                )}
                {/* Shimmering glass border effect */}
                <div className="absolute inset-0 rounded-3xl border border-white/40 dark:border-white/30" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.35) 100%)', mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', maskComposite: 'xor', WebkitMaskComposite: 'xor', padding: '1px', opacity: 0.8 }} />
                <div
                  className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 relative"
                  style={{ background: card.icon3dBg, boxShadow: card.icon3dGlow }}
                >
                  <div className="absolute inset-0 rounded-2xl" style={{ background: card.icon3dInner }} />
                  <span className="relative text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">{card.icon}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-extrabold text-foreground tracking-tight">{isArabic ? card.titleAr : card.titleEn}</h3>
                  <ArrowRight className={`h-5 w-5 text-muted-foreground/40 shrink-0 ${isArabic ? 'rotate-180' : ''}`} />
                </div>
                <p className="text-[13px] text-muted-foreground/80 leading-relaxed">{isArabic ? card.descAr : card.descEn}</p>
              </button>
            ))}

            {/* QR Code — small bottom-right */}
            {studioCards.filter(c => c.key === 'qrcode').map((card) => (
              <button
                key={card.key}
                onClick={() => setMainTab(card.key)}
                className={`relative text-left p-5 rounded-3xl ${card.cardBg} ${card.shadow} ${card.cardBorder} backdrop-blur-2xl overflow-hidden transition-all duration-200 active:scale-[0.96] col-span-1 row-span-1 group`}
              >
                {/* Soft radial pulse behind card — violet */}
                <div className="pointer-events-none absolute inset-0 -z-10 scale-110 opacity-30 blur-2xl" style={{ background: 'radial-gradient(circle, hsla(280,70%,65%,0.4) 0%, transparent 70%)' }} />
                <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 120%, hsla(280,70%,65%,0.18), transparent)' }} />
                {/* Shimmering glass border effect */}
                <div className="absolute inset-0 rounded-3xl border border-white/40 dark:border-white/30" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.3) 100%)', mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', maskComposite: 'xor', WebkitMaskComposite: 'xor', padding: '1px', opacity: 0.8 }} />
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4 relative"
                  style={{ background: card.icon3dBg, boxShadow: card.icon3dGlow }}
                >
                  <div className="absolute inset-0 rounded-2xl" style={{ background: card.icon3dInner }} />
                  <span className="relative text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]">{card.icon}</span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-extrabold text-foreground tracking-tight">{isArabic ? card.titleAr : card.titleEn}</h3>
                  <ArrowRight className={`h-4 w-4 text-muted-foreground/40 shrink-0 ${isArabic ? 'rotate-180' : ''}`} />
                </div>
                <p className="text-[12px] text-muted-foreground/80 leading-relaxed line-clamp-2">{isArabic ? card.descAr : card.descEn}</p>
              </button>
            ))}
          </div>

          {/* Bottom tagline */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <p className="text-[11px] text-muted-foreground/70 font-medium tracking-wide uppercase">
              {isArabic ? 'مدعوم بوقتي AI' : 'Powered by Wakti AI'}
            </p>
          </div>
        </div>
      )}

      {/* Music Tab Content */}
      {mainTab === 'music' && (
        <>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl md:text-2xl font-bold">{language === 'ar' ? 'استوديو الموسيقى' : 'Music Studio'}</h1>
            <div className="text-right space-y-0.5 pt-0.5">
              <div className="text-[11px] font-semibold text-emerald-500 dark:text-emerald-400">
                {musicQuotaHeader
                  ? (language === 'ar' ? `المستخدم: ${musicQuotaHeader.used} / ${musicQuotaHeader.limit}` : `Used: ${musicQuotaHeader.used} / ${musicQuotaHeader.limit}`)
                  : (language === 'ar' ? 'جارٍ التحميل...' : 'Loading...')}
              </div>
              <div className="text-[11px] text-muted-foreground/80 dark:text-muted-foreground/60">
                {musicQuotaHeader
                  ? (language === 'ar' ? `المتبقي: ${musicQuotaHeader.remaining} هذا الشهر` : `Remaining ${musicQuotaHeader.remaining} this month`)
                  : ''}
              </div>
            </div>
          </div>

          <nav className="flex gap-2 p-1.5 rounded-2xl bg-gradient-to-r from-[#fcfefd] via-[#f4efe8] to-[#fcfefd] dark:from-[#0a0d12] dark:via-[#1a1d24] dark:to-[#0a0d12] border border-[#d7d8de] dark:border-[#606062]/30 backdrop-blur-sm shadow-[0_10px_30px_rgba(6,5,65,0.08)] dark:shadow-inner">
            {[
              { key: 'compose' as const, labelEn: 'Compose', labelAr: 'إنشاء' },
              { key: 'editor' as const, labelEn: 'Saved', labelAr: 'المحفوظات' },
            ].map((t) => {
              const isActive = musicSubTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => { if (t.key === 'editor') setEditorEverVisited(true); setMusicSubTab(t.key); }}
                  className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 min-h-[44px] touch-manipulation ${
                    isActive
                      ? 'bg-gradient-to-br from-[#060541] via-[#1a1a4a] to-[#060541] dark:from-[#f2f2f2] dark:via-[#e0e0e0] dark:to-[#f2f2f2] text-white dark:text-[#060541] shadow-lg shadow-[#060541]/25 dark:shadow-white/25 scale-[1.02]'
                      : 'bg-white/80 dark:bg-transparent text-[#606062] dark:text-[#858384] border border-[#d7d8de] dark:border-transparent shadow-[0_4px_14px_rgba(6,5,65,0.06)] dark:shadow-none hover:bg-white dark:hover:bg-white/10 active:scale-95'
                  }`}
                >
                  <span className="whitespace-nowrap">{isArabic ? t.labelAr : t.labelEn}</span>
                </button>
              );
            })}
          </nav>

          <div className={musicSubTab === 'compose' ? undefined : 'hidden'}>
            <ComposeTab
              onSaved={()=>{ setEditorEverVisited(true); setMusicSubTab('editor'); }}
              onQuotaChange={setMusicQuotaHeader}
            />
          </div>
          {editorEverVisited && (
            <div className={musicSubTab === 'editor' ? undefined : 'hidden'}>
              <EditorTab />
            </div>
          )}
        </>
      )}

      {mainTab === 'video' && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl md:text-2xl font-bold">{language === 'ar' ? 'الفيديو' : 'Video'}</h1>
            <div />
          </div>
          <nav className="flex gap-2 p-1.5 rounded-2xl bg-gradient-to-r from-[#0c0f14]/5 via-[#606062]/10 to-[#0c0f14]/5 dark:from-[#0a0d12] dark:via-[#1a1d24] dark:to-[#0a0d12] border border-[#606062]/20 dark:border-[#606062]/30 backdrop-blur-sm shadow-inner">
            {[
              { key: 'ai' as const, labelEn: 'AI Videomaker', labelAr: 'صانع الفيديو بالذكاء' },
              { key: 'saved' as const, labelEn: 'Saved', labelAr: 'المحفوظات' },
            ].map((t) => {
              const isActive = videoMode === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setVideoMode(t.key)}
                  className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 min-h-[44px] touch-manipulation ${
                    isActive
                      ? 'bg-gradient-to-br from-[#060541] via-[#1a1a4a] to-[#060541] dark:from-[#f2f2f2] dark:via-[#e0e0e0] dark:to-[#f2f2f2] text-white dark:text-[#060541] shadow-lg shadow-[#060541]/25 dark:shadow-white/25 scale-[1.02]'
                      : 'bg-transparent text-[#606062] dark:text-[#858384] hover:bg-white/40 dark:hover:bg-white/10 active:scale-95'
                  }`}
                >
                  <span className="whitespace-nowrap">{isArabic ? t.labelAr : t.labelEn}</span>
                </button>
              );
            })}
          </nav>

          {videoMode === 'ai' ? (
            <AIVideomaker onSaveSuccess={() => setVideoMode('saved')} />
          ) : (
            <SavedVideosTab onCreate={() => setVideoMode('ai')} />
          )}
        </>
      )}

      {mainTab === 'qrcode' && <QRCodeCreator />}

      {mainTab === 'image' && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl md:text-2xl font-bold">{language === 'ar' ? 'الصورة' : 'Image'}</h1>
            <div />
          </div>
          <nav className="flex gap-2 p-1.5 rounded-2xl bg-gradient-to-r from-[#0c0f14]/5 via-[#606062]/10 to-[#0c0f14]/5 dark:from-[#0a0d12] dark:via-[#1a1d24] dark:to-[#0a0d12] border border-[#606062]/20 dark:border-[#606062]/30 backdrop-blur-sm shadow-inner">
            {[
              { key: 'create' as const, labelEn: 'Create', labelAr: 'إنشاء' },
              { key: 'saved' as const, labelEn: 'Saved', labelAr: 'المحفوظات' },
            ].map((t) => {
              const isActive = imageMode === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setImageMode(t.key)}
                  className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 min-h-[44px] touch-manipulation ${
                    isActive
                      ? 'bg-gradient-to-br from-[#060541] via-[#1a1a4a] to-[#060541] dark:from-[#f2f2f2] dark:via-[#e0e0e0] dark:to-[#f2f2f2] text-white dark:text-[#060541] shadow-lg shadow-[#060541]/25 dark:shadow-white/25 scale-[1.02]'
                      : 'bg-transparent text-[#606062] dark:text-[#858384] hover:bg-white/40 dark:hover:bg-white/10 active:scale-95'
                  }`}
                >
                  <span className="whitespace-nowrap">{isArabic ? t.labelAr : t.labelEn}</span>
                </button>
              );
            })}
          </nav>

          {imageMode === 'create' ? (
            <StudioImageGenerator onSaveSuccess={() => { setImageMode('saved'); setSavedImagesRefreshKey(k => k + 1); }} />
          ) : (
            <SavedImagesTab onCreate={() => setImageMode('create')} refreshKey={savedImagesRefreshKey} />
          )}
        </>
      )}
    </div>
  );
 }

function ComposeTab({ onSaved, onQuotaChange }: { onSaved?: ()=>void; onQuotaChange?: (quota: { remaining: number; limit: number; used: number }) => void }) {
  const { language } = useTheme();
  const { user } = useAuth();
  const isAr = language === 'ar';

  // Inputs (split prompt)
  const [title, setTitle] = useState('');
  const [styleText, setStyleText] = useState('');
  const [lyricsText, setLyricsText] = useState('');
  const [variations, setVariations] = useState(1);
  const [duration, setDuration] = useState(30); // seconds
  
  // Preset styles list (genres only)
  const STYLE_GROUPS = useMemo<Array<{ title: string; items: string[] }>>(() => {
    if (language === 'ar') {
      return [
        {
          title: 'خليجي — أساسي',
          items: ['بوب خليجي','خليجي رومانسي','خليجي أنيق','خليجي حفلات','خليجي أعراس','خليجي راب']
        },
        {
          title: 'خليجي — راديو وكروس أوفر',
          items: ['خليجي إذاعي','خليجي دانس','خليجي إلكتروني','خليجي سينث بوب','فيوجن خليجي','إنجليزي بطابع خليجي']
        },
        {
          title: 'خليجي — ريتش',
          items: ['خليجي آر أند بي','خليجي فاخر','خليجي سينمائي','خليجي جماهيري']
        },
        {
          title: 'خليجي — تراثي',
          items: ['خليجي تراثي','شيلات','سامري','جلسة','ليوان','شعبي خليجي']
        },
        {
          title: 'عربي آخر',
          items: ['مصري','شعبي مصري','عراقي','لبناني','مغربي','مهرجانات','شامي']
        },
        {
          title: 'إسلامي',
          items: ['أناشيد']
        },
        {
          title: 'بوب وحديث',
          items: ['بوب','دانس بوب','تين بوب','باور بوب','بوب روك','إندي بوب','آر آند بي','نيو سول','ديسكو معاصر','سينث بوب','إلكترو بوب','بوب الثمانينات','بوب التسعينات','كي-بوب','جي-بوب','لاتن بوب']
        },
        {
          title: 'سول وفنك وديسكو',
          items: ['سول','نيو سول','فنك','ديسكو','موتاون','نيو جاك سوينج','كوايت ستورم','آر آند بي معاصر']
        },
        {
          title: 'هيب هوب وراب',
          items: ['هيب هوب','راب','تراب','درِل','بوم باب','راب واعٍ','غانجستا راب','كلاود راب','ساوذرن هيب هوب']
        },
        {
          title: 'إيقاعي وعالمي',
          items: ['أفروبيتس','أفروبيت','ريغيتون','لاتين','سالسا','باتشاتا','ميرينغي','تانغو','سامبا','كومبيا','بوسا نوفا','بوليوود','بهانغرا']
        },
        {
          title: 'روك',
          items: ['روك','روك كلاسيك','روك آند رول','سوفت روك','روك بديل','إندي روك','روك تقدمي','روك نفسي','هارد روك','غاراج روك','غلام روك','غرانج','بريت بوب','شوغيز','بوست روك','ماث روك','سيرف روك']
        },
        {
          title: 'ميتال',
          items: ['ميتال ثقيل','ثراش ميتال','ديث ميتال','بلاك ميتال','باور ميتال','دووم ميتال','غوثيك ميتال','سيمفوني ميتال','برو ميتال']
        },
        {
          title: 'بانك وإيمو',
          items: ['بانك روك','بوب بانك','هارد كور بانك','سكا بانك','إيمو','سكريمو']
        },
        {
          title: 'جذور وتراث',
          items: ['كانتري','كانتري بوب','بلوغراس','فولك','فولك روك','فولك إندي','فولك بوب','أمريكانا','كانتري أوت لاو','كانتري روك']
        },
        {
          title: 'جاز',
          items: ['جاز','بيباب','سوينج','جاز ناعم','جاز بارد','فيوجن جاز','جاز لاتيني','جاز فنك','هارد باب','جاز حر']
        },
        {
          title: 'بلوز',
          items: ['بلوز','بلوز دلتا','بلوز شيكاغو','بلوز كهربائي','بلوز روك','تكساس بلوز','جامب بلوز','بوغي ووغي']
        },
        {
          title: 'ريغي',
          items: ['ريغي','روتس ريغي','دانس هول','سكا','داب','ريغي فيوجن','راغا موفن']
        },
        {
          title: 'كلاسيكي وأوركسترالي',
          items: ['كلاسيكي','باروك','رومانسي','معاصر كلاسيكي','سيمفوني','أوبرا','موسيقى غرفة','كورال']
        },
        {
          title: 'إلكتروني ودانس',
          items: ['لوفاي','هاوس','ديب هاوس','تيك هاوس','ترانس','تيكنو','دبسْتِب','درَم آند بَيس','إي دي إم','إلكترو','هارد كور إلكتروني','آيدي إم','أمبيينت','سينث ويف','تشيل ويف','فيبور ويف','غلتش','غريم','يو كي غاراج','إلكترو سوينج','شيبتيون']
        },
        {
          title: 'موسيقى عالمية',
          items: ['فلامنكو','فادو','سيلتيك','أفروبيت','جوجو نيجيري','بهانغرا','موسيقى عالم']
        },
        {
          title: 'أخرى',
          items: ['غوسبل','جاز سوينج','بيغ باند','راغتايم','ديسكو','زيديكو','صوت جديد','إيندستريال']
        }
      ];
    }
    return [
      {
        title: 'Khaleeji — Core',
        items: ['Khaleeji Pop','Khaleeji Romantic','Khaleeji Elegant','Khaleeji Party','Khaleeji Wedding','Khaleeji Rap']
      },
      {
        title: 'Khaleeji — Radio & Crossover',
        items: ['Khaleeji Radio Pop','Khaleeji Dance Pop','Khaleeji Electro Pop','Khaleeji Synth Pop','Modern Khaleeji Fusion','English Khaleeji Pop']
      },
      {
        title: 'Khaleeji — Rich',
        items: ['Khaleeji R&B Pop','Luxury Khaleeji Pop','Khaleeji Cinematic','Khaleeji Anthem']
      },
      {
        title: 'Khaleeji — Heritage',
        items: ['Khaleeji Traditional','Sheilat','Samri','Ardah','Jalsa','Liwa','Khaleeji Shaabi','Zar','Khaleeji Trap']
      },
      {
        title: 'Other Arabic',
        items: ['Egyptian','Egyptian Shaabi','Iraqi Style','Lebanese Style','Moroccan Style']
      },
      {
        title: 'Islamic',
        items: ['Anasheed']
      },
      {
        title: 'Pop',
        items: ['pop','Dance Pop','Teen Pop','Power Pop','Pop Rock','Indie Pop','Bubblegum Pop','K-Pop','J-Pop','Latin Pop','80s pop','90s pop','Synthpop','Electropop']
      },
      {
        title: 'R&B / Soul / Funk',
        items: ['R&B','soul','Neo-Soul','Contemporary R&B','Motown','funk','disco','New Jack Swing','Quiet Storm','Blue-eyed Soul']
      },
      {
        title: 'Hip-Hop / Rap',
        items: ['hip hop','rap','Trap','Drill','Boom Bap','Conscious Hip Hop','Gangsta Rap','East Coast Hip Hop','West Coast Hip Hop','Southern Hip Hop','Alternative Hip Hop','Cloud Rap','Crunk']
      },
      {
        title: 'Urban / World',
        items: ['Afrobeats','Afrobeat','Reggaeton','Latin','Salsa','Bachata','Merengue','Tango','Samba','Cumbia','Bossa Nova','Bollywood','Bhangra','Latin Rock']
      },
      {
        title: 'Rock',
        items: ['rock','Classic Rock','rock and roll','soft rock','Hard Rock','alternative rock','indie rock','Progressive Rock','Psychedelic Rock','Garage Rock','Glam Rock','grunge','Britpop','Shoegaze','Post-Rock','Math Rock','Surf Rock','Dream Pop']
      },
      {
        title: 'Metal',
        items: ['heavy metal','thrash metal','Death Metal','Black Metal','Power Metal','Doom Metal','Gothic Metal','Symphonic Metal','Progressive Metal','Speed Metal']
      },
      {
        title: 'Punk',
        items: ['punk rock','Pop Punk','Hardcore Punk','Ska Punk','Emo','Screamo','New Wave']
      },
      {
        title: 'Roots / Americana',
        items: ['country','Country Pop','Outlaw Country','Country Rock','Alternative Country','Honky Tonk','Western Swing','Americana','Contemporary Country','bluegrass','folk','Indie Folk','Folk Rock','Folk Pop','Folk Punk','Protest Folk']
      },
      {
        title: 'Jazz',
        items: ['jazz','Bebop','swing','smooth jazz','Cool Jazz','Jazz Fusion','Latin Jazz','Jazz Funk','Hard Bop','Acid Jazz','Free Jazz','Big Band']
      },
      {
        title: 'Blues',
        items: ['blues','delta blues','Chicago Blues','Electric Blues','Blues Rock','Texas Blues','Memphis Blues','Jump Blues','Boogie-Woogie','Country Blues']
      },
      {
        title: 'Reggae',
        items: ['reggae','Roots Reggae','Dancehall','ska','dub','Reggae Fusion','Lovers Rock','Ragga']
      },
      {
        title: 'Classical / Orchestral',
        items: ['classical','Baroque','Romantic','Contemporary Classical','Symphony','Opera','Chamber Music','Choral','Gregorian Chant']
      },
      {
        title: 'Electronic / Dance',
        items: ['Lo-Fi','House','Deep House','Tech House','Trance','Techno','Dubstep','Drum & Bass','EDM','Electro','Hardcore','IDM','ambient','synthwave','chillwave','Vaporwave','Glitch','Witch House','Grime','UK Garage','2-Step','Electro Swing','Chiptune']
      },
      {
        title: 'World',
        items: ['Flamenco','Fado','Celtic','gospel','Ragtime','Zydeco','Cajun','Industrial','Bhangra','Afrobeat']
      }
    ];
  }, [language]);

  const STYLE_PRESETS = useMemo<string[]>(() => {
    return STYLE_GROUPS.flatMap((group) => group.items);
  }, [STYLE_GROUPS]);

  // Collapse states for Music Style section
  const [titleOpen, setTitleOpen] = useState(true);
  const [musicStyleOpen, setMusicStyleOpen] = useState(false);
  const [stylesOpen, setStylesOpen] = useState(false);
  const [instrumentsOpen, setInstrumentsOpen] = useState(false);
  const [rhythmOpen, setRhythmOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [composeDetailsVisible, setComposeDetailsVisible] = useState(false);
  const [openStyleGroupIdx, setOpenStyleGroupIdx] = useState(0);
  const [stylesCollapsed, setStylesCollapsed] = useState(false);
  const [step2ReadyToProceed, setStep2ReadyToProceed] = useState(false);
  const styleGroupRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [composeStep, setComposeStep] = useState<1|2|3|4>(1);
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [instrumentTags, setInstrumentTags] = useState<string[]>([]);
  const [rhythmTags, setRhythmTags] = useState<string[]>([]);
  const [moodTags, setMoodTags] = useState<string[]>([]);
  const KHALIJI_STYLE_ALIASES = useMemo<Record<string, string>>(() => ({
    'Khaliji Pop': 'GCC Pop',
    'Khaliji Rap': 'GCC Rap',
    'Khaliji Romantic': 'GCC Romantic',
    'Khaliji Elegant': 'GCC Elegant',
    'Khaliji Party': 'GCC Party',
    'Khaliji Wedding': 'GCC Wedding',
    'Khaliji Radio Pop': 'GCC Radio Pop',
    'Khaliji Dance Pop': 'GCC Dance Pop',
    'Khaliji Electro Pop': 'GCC Electro Pop',
    'Khaliji Synth Pop': 'GCC Synth Pop',
    'Modern Khaliji Fusion': 'Modern Khaleeji Fusion',
    'English Khaliji Pop': 'English GCC Pop',
    'Khaliji R&B Pop': 'GCC R&B Pop',
    'Luxury Khaliji Pop': 'Luxury GCC Pop',
    'Khaliji Cinematic': 'Cinematic GCC',
    'Khaliji Anthem': 'GCC Anthem',
    'Khaliji National Event': 'National Event GCC',
    'Khaliji Traditional': 'GCC Traditional',
    'Khaliji Shaabi': 'GCC Shaabi',
    'Khaliji Trap': 'Khaleeji Trap',
    'Khaleeji Pop': 'GCC Pop',
    'Khaleeji Rap': 'GCC Rap',
    'Khaleeji Romantic': 'GCC Romantic',
    'Khaleeji Elegant': 'GCC Elegant',
    'Khaleeji Party': 'GCC Party',
    'Khaleeji Wedding': 'GCC Wedding',
    'Khaleeji Radio Pop': 'GCC Radio Pop',
    'Khaleeji Dance Pop': 'GCC Dance Pop',
    'Khaleeji Electro Pop': 'GCC Electro Pop',
    'Khaleeji Synth Pop': 'GCC Synth Pop',
    'English Khaleeji Pop': 'English GCC Pop',
    'Khaleeji R&B Pop': 'GCC R&B Pop',
    'Luxury Khaleeji Pop': 'Luxury GCC Pop',
    'Khaleeji Cinematic': 'Cinematic GCC',
    'Khaleeji Anthem': 'GCC Anthem',
    'Khaleeji National Event': 'National Event GCC',
    'Khaleeji Traditional': 'GCC Traditional',
    'Khaleeji Shaabi': 'GCC Shaabi',
    'Khaleeji Trap': 'Khaleeji Trap',
  }), []);
  const effectiveIncludeTags = useMemo(
    () => [...new Set(includeTags.map((tag) => KHALIJI_STYLE_ALIASES[tag] ?? tag))],
    [includeTags, KHALIJI_STYLE_ALIASES],
  );
  const [showIncludePicker, setShowIncludePicker] = useState(false);
  const [showInstrumentPicker, setShowInstrumentPicker] = useState(false);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const includeAnchorRef = useRef<HTMLDivElement | null>(null);
  const instrumentAnchorRef = useRef<HTMLDivElement | null>(null);
  const moodAnchorRef = useRef<HTMLDivElement | null>(null);
  const [includeRect, setIncludeRect] = useState<{top:number,left:number,width:number} | null>(null);
  const [instrumentRect, setInstrumentRect] = useState<{top:number,left:number,width:number} | null>(null);
  const [moodRect, setMoodRect] = useState<{top:number,left:number,width:number} | null>(null);
  // Minimal mode only: styles include/exclude + prompt + duration
  const [submitting, setSubmitting] = useState(false);
  const [amping, setAmping] = useState(false);
  const [ampMode, setAmpMode] = useState<'idea' | 'expand' | 'gcc_enhance'>('expand');
  const isGccEnhanceRef = useRef(false);
  const [lyricsKey, setLyricsKey] = useState(0);
  const [lyricsDisplayMode, setLyricsDisplayMode] = useState(false);
  const [gccOriginalLyrics, setGccOriginalLyrics] = useState('');
  const [vocalType, setVocalType] = useState<'auto'|'none'|'female'|'male'>('auto');
  const [vocalsOpen, setVocalsOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [audios, setAudios] = useState<Array<{ url: string; mime: string; meta?: any; createdAt: number; saved?: boolean }>>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastNotice, setLastNotice] = useState<string | null>(null);

  // ── Canonical GCC style catalog (single source of truth for GCC detection) ──
  // Used by isGccStyleSelected, formatLyricsWithStructure (per-stanza Khaleeji language tags),
  // GCC-safe instrument/rhythm recommendation filters, and the negative-tag merger in
  // handleGenerate. Keep in sync with the GCC entries in STYLE_GROUPS (EN + AR).
  const GCC_STYLE_SET = useMemo(() => new Set<string>([
    // ── EN canonical IDs ──
    'GCC Pop', 'Khaleeji Pop', 'GCC Rap', 'GCC Romantic', 'GCC Elegant', 'GCC Party', 'GCC Wedding',
    'GCC Radio Pop', 'GCC Dance Pop', 'GCC Electro Pop', 'GCC Synth Pop',
    'Modern Khaleeji Fusion', 'English GCC Pop',
    'GCC R&B Pop', 'Luxury GCC Pop', 'Cinematic GCC', 'GCC Anthem', 'National Event GCC',
    'GCC Traditional', 'Sheilat', 'Samri', 'Ardah', 'Jalsa', 'Liwa', 'GCC Shaabi', 'Zar', 'Khaleeji Trap',
    // ── AR display labels (mirror IDs used in pickers + mappings) ──
    'بوب خليجي', 'خليجي راب', 'خليجي عصري',
    'خليجي رومانسي', 'خليجي أنيق', 'خليجي حفلات', 'خليجي أعراس',
    'خليجي إذاعي', 'خليجي دانس', 'خليجي إلكتروني', 'خليجي سينث بوب',
    'فيوجن خليجي', 'إنجليزي بطابع خليجي',
    'خليجي آر أند بي', 'خليجي فاخر', 'خليجي سينمائي', 'خليجي جماهيري', 'مناسبات وطنية خليجية',
    'خليجي تراثي', 'شيلات', 'سامري', 'جلسة', 'ليوان', 'شعبي خليجي',
  ]), []);

  const isGccStyleSelected = useMemo(
    () => effectiveIncludeTags.some((tag) => GCC_STYLE_SET.has(tag)),
    [effectiveIncludeTags, GCC_STYLE_SET]
  );

  const [songsUsed, setSongsUsed] = useState(0);
  const [songsLimit, setSongsLimit] = useState(30);
  const [songsRemaining, setSongsRemaining] = useState(30);
  const [generatingTask, setGeneratingTask] = useState<{ taskId: string; recordId: string } | null>(null);
  const [generatedTracks, setGeneratedTracks] = useState<Array<{ id: string; audioUrl: string; coverUrl: string | null; duration: number | null; title: string | null; variantIndex: number }>>([]);
  const [savedTrackIds, setSavedTrackIds] = useState<string[]>([]);
  const [savingTrackIds, setSavingTrackIds] = useState<string[]>([]);
  const [customMode, setCustomMode] = useState<boolean>(true);
  const [negativeTags, setNegativeTags] = useState<string>('');
  const [styleWeight, setStyleWeight] = useState<number>(0.65);
  const [weirdnessConstraint, setWeirdnessConstraint] = useState<number>(0.5);
  const [audioWeight, setAudioWeight] = useState<number>(0.65);
  const [showAdvancedSliders, setShowAdvancedSliders] = useState<boolean>(false);
  const [showPayloadPreview, setShowPayloadPreview] = useState<boolean>(false);
  const [payloadPreview, setPayloadPreview] = useState<string>('');
  const [tempoOverride, setTempoOverride] = useState<string>('');
  const [keyOverride, setKeyOverride] = useState<string>('');

  const tempoOverrideOptions = [
    { value: '', en: 'Auto tempo', ar: 'سرعة تلقائية' },
    { value: '82 BPM refined Khaleeji ballad', en: '82 BPM · Refined ballad', ar: '٨٢ BPM · بالاد راقي' },
    { value: '84 BPM warm Khaleeji sway', en: '84 BPM · Warm sway', ar: '٨٤ BPM · تموّج دافئ' },
    { value: '100 BPM focused Khaleeji groove', en: '100 BPM · Focused groove', ar: '١٠٠ BPM · جروف مركز' },
    { value: '104 BPM modern Khaleeji groove', en: '104 BPM · Modern groove', ar: '١٠٤ BPM · جروف عصري' },
    { value: '116 BPM celebratory Khaleeji swing', en: '116 BPM · Celebratory swing', ar: '١١٦ BPM · سواينغ احتفالي' },
    { value: '120 BPM driving Khaleeji march pulse', en: '120 BPM · March pulse', ar: '١٢٠ BPM · نبض مسير' },
    { value: '138 BPM tight Khaleeji trap pocket', en: '138 BPM · Trap pocket', ar: '١٣٨ BPM · جيب تراب' },
  ];
  const keyOverrideOptions = [
    { value: '', en: 'Auto key', ar: 'مفتاح تلقائي' },
    { value: 'C minor tonal center', en: 'C minor', ar: 'سي مينور' },
    { value: 'D minor tonal center', en: 'D minor', ar: 'ري مينور' },
    { value: 'E minor tonal center', en: 'E minor', ar: 'مي مينور' },
    { value: 'F major tonal center', en: 'F major', ar: 'فا ماجور' },
    { value: 'A minor tonal center', en: 'A minor', ar: 'لا مينور' },
  ];

  // Rhythm / Beat groups
  const RHYTHM_GROUPS = useMemo<Array<{ title: string; items: string[] }>>(() => {
    if (language === 'ar') {
      return [
        { title: 'خليجي', items: ['إيقاع خليجي','خليجي متمايل','عدني','سامري','إيقاع أعراس','إيقاع تصفيق','إيقاع الليوان','مقسوم'] },
        { title: 'عالمي', items: ['٦/٨ فيوجن','أفرو خليجي','بوب ٤/٤','بالاد هادئ','إيقاع جماهيري','إيقاع نادي','والتز ٣/٤','تراب بيت','دريل بيت'] },
      ];
    }
    return [
      { title: 'Khaleeji Rhythms', items: ['Khaleeji Groove','Khaleeji Shuffle','Adani','Samri Rhythm','Wedding Beat','Clap-Driven Groove','Leiwah Rhythm','Maqsoum'] },
      { title: 'Universal', items: ['6/8 Fusion','Afro-Khaleeji Groove','Pop 4/4','Ballad Slow Groove','Marching Anthem','Club Beat','Waltz 3/4','Trap Beat','Drill Beat'] },
    ];
  }, [language]);

  const RHYTHM_PRESETS = useMemo<string[]>(() => {
    return RHYTHM_GROUPS.flatMap((g) => g.items);
  }, [RHYTHM_GROUPS]);

  // Style to recommended instruments mapping
  // ALL values use canonical English instrument IDs (same as INSTRUMENT_GROUPS English items)
  // Arabic style names map to the SAME English canonical IDs — display translation is separate
  const STYLE_INSTRUMENT_MAPPING = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {
      // ── GCC Core ──
      'GCC Pop':              ['mirwas', 'darbuka', 'tar', 'synth lead', 'synth pad'],
      'بوب خليجي':            ['mirwas', 'darbuka', 'tar', 'synth lead', 'synth pad'],
      'GCC Rap':              ['808 bass', 'hi-hat', 'darbuka', 'mirwas', 'synth bass'],
      'خليجي راب':            ['808 bass', 'hi-hat', 'darbuka', 'mirwas', 'synth bass'],
      'Modern Khaleeji Fusion':['darbuka', 'mirwas', 'electric guitar', 'synth pad', 'bass guitar'],
      'خليجي عصري':           ['darbuka', 'mirwas', 'electric guitar', 'synth pad', 'bass guitar'],
      'GCC Romantic':         ['qanun', 'ney', 'violin', 'soft piano', 'cello'],
      'خليجي رومانسي':        ['qanun', 'ney', 'violin', 'soft piano', 'cello'],
      'GCC Elegant':          ['qanun', 'ney', 'violin', 'piano', 'strings'],
      'خليجي أنيق':           ['qanun', 'ney', 'violin', 'piano', 'strings'],
      'GCC Party':            ['mirwas', 'darbuka', 'tar', 'hand claps', 'synth lead'],
      'خليجي حفلات':          ['mirwas', 'darbuka', 'tar', 'hand claps', 'synth lead'],
      'GCC Wedding':          ['mirwas', 'darbuka', 'daff', 'hand claps', 'group chant'],
      'خليجي أعراس':          ['mirwas', 'darbuka', 'daff', 'hand claps', 'group chant'],
      // ── GCC Radio & Crossover ──
      'GCC Radio Pop':        ['mirwas', 'darbuka', 'bass guitar', 'drum kit', 'synth pad'],
      'خليجي إذاعي':          ['mirwas', 'darbuka', 'bass guitar', 'drum kit', 'synth pad'],
      'GCC Dance Pop':        ['mirwas', 'darbuka', 'hand claps', 'bass guitar', 'synth lead'],
      'خليجي دانس':           ['mirwas', 'darbuka', 'hand claps', 'bass guitar', 'synth lead'],
      'GCC Electro Pop':      ['mirwas', 'darbuka', 'synth lead', 'synth bass', 'drum kit'],
      'خليجي إلكتروني':       ['mirwas', 'darbuka', 'synth lead', 'synth bass', 'drum kit'],
      'GCC Synth Pop':        ['mirwas', 'darbuka', 'synth lead', 'synth pad', 'drum kit'],
      'خليجي سينث بوب':       ['mirwas', 'darbuka', 'synth lead', 'synth pad', 'drum kit'],
      'English GCC Pop':      ['mirwas', 'darbuka', 'hand claps', 'bass guitar', 'synth lead'],
      'إنجليزي بطابع خليجي': ['mirwas', 'darbuka', 'hand claps', 'bass guitar', 'synth lead'],
      'فيوجن خليجي':          ['electric guitar', 'bass guitar', 'drum kit', 'synth pad', 'darbuka'],
      // ── GCC Rich & Event ──
      'GCC R&B Pop':          ['electric piano', 'bass guitar', 'drum kit', 'synth pad', 'darbuka'],
      'خليجي آر أند بي':      ['electric piano', 'bass guitar', 'drum kit', 'synth pad', 'darbuka'],
      'Luxury GCC Pop':       ['violin', 'strings', 'piano', 'riq', 'synth pad'],
      'خليجي فاخر':           ['violin', 'strings', 'piano', 'riq', 'synth pad'],
      'Cinematic GCC':        ['strings', 'tabl', 'choir', 'piano', 'synth pad'],
      'خليجي سينمائي':        ['strings', 'tabl', 'choir', 'piano', 'synth pad'],
      'GCC Anthem':           ['tabl', 'darbuka', 'hand claps', 'choir', 'drum kit'],
      'خليجي جماهيري':        ['tabl', 'darbuka', 'hand claps', 'choir', 'drum kit'],
      'National Event GCC':   ['tabl', 'darbuka', 'choir', 'strings', 'drum kit'],
      'مناسبات وطنية خليجية': ['tabl', 'darbuka', 'choir', 'strings', 'drum kit'],
      // ── GCC Heritage ──
      'GCC Traditional':      ['qanun', 'ney', 'riq', 'tabla', 'rebab'],
      'خليجي تراثي':          ['qanun', 'ney', 'riq', 'tabla', 'rebab'],
      'Sheilat':              ['frame drum', 'mirwas', 'darbuka', 'tabl'],
      'شيلات':                ['frame drum', 'mirwas', 'darbuka', 'tabl'],
      'Samri':                ['frame drum', 'mirwas', 'darbuka', 'rebab'],
      'سامري':                ['frame drum', 'mirwas', 'darbuka', 'rebab'],
      'Jalsa':                ['oud', 'qanun', 'tabla', 'riq', 'ney'],
      'جلسة':                 ['oud', 'qanun', 'tabla', 'riq', 'ney'],
      'Liwa':                 ['tanbura', 'frame drum', 'mirwas', 'darbuka'],
      'ليوان':                ['tanbura', 'frame drum', 'mirwas', 'darbuka'],
      'GCC Shaabi':           ['oud', 'qanun', 'riq', 'tabla', 'ney'],
      'شعبي خليجي':           ['tar', 'tabla', 'darbuka', 'rebab', 'group chant'],
      'Khaleeji Trap':        ['808 bass', 'trap hi-hats', 'mirwas', 'darbuka', 'synth lead'],
      'Ardah':                ['tabl', 'mirwas', 'frame drum', 'darbuka', 'group chant'],
      'Zar':                  ['tanbura', 'frame drum', 'mirwas', 'darbuka', 'group chant'],
      // ── Other Arabic ──
      'Egyptian':             ['oud', 'qanun', 'ney', 'tabla', 'darbuka'],
      'مصري':                 ['oud', 'qanun', 'ney', 'tabla', 'darbuka'],
      'Egyptian Shaabi':      ['drum machine', 'synth lead', 'bass guitar', 'darbuka'],
      'شعبي مصري':            ['drum kit', 'synth lead', 'bass guitar', 'electric guitar', 'darbuka'],
      'مهرجانات':             ['drum kit', 'synth lead', 'bass guitar', 'percussion'],
      'Anasheed':             ['Vocal Harmony'],
      'أناشيد':               ['Vocal Harmony'],
      'Arabic Pop':           ['piano', 'violin', 'tabla', 'electric guitar'],
      'بوب عربي':             ['piano', 'violin', 'tabla', 'electric guitar'],
      'Levant Pop':           ['piano', 'violin', 'acoustic guitar', 'drum kit'],
      'شامي':                 ['piano', 'violin', 'acoustic guitar', 'drum kit'],
      'Khaleeji Pop':         ['mirwas', 'darbuka', 'tar', 'synth lead', 'synth pad'],
    };
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Canonical→Arabic display label map (for chip rendering when language=ar) ──
  const INSTRUMENT_DISPLAY_AR: Record<string, string> = {
    'oud': 'عود', 'qanun': 'قانون', 'ney': 'ناي', 'riq': 'رق', 'darbuka': 'دربوكة',
    'tabla': 'طبلة', 'mirwas': 'مرواس', 'tabl': 'طبل', 'tabl turki': 'طبل تركي',
    'frame drum': 'طار', 'daff': 'دف', 'tar': 'طار', 'tanbura': 'طنبورة',
    'mijwiz': 'مجوز', 'rebab': 'رباب', 'gulf percussion': 'إيقاع خليجي',
    'violin': 'كمان', 'viola': 'فيولا', 'cello': 'تشيلو', 'contrabass': 'كونترباص', 'strings': 'وتريات',
    'piano': 'بيانو', 'electric piano': 'بيانو كهربائي', 'soft piano': 'بيانو ناعم', 'organ': 'أورغ', 'accordion': 'أكورديون',
    'acoustic guitar': 'جيتار أكوستيك', 'electric guitar': 'جيتار كهربائي', 'bass guitar': 'باص جيتار',
    'upright bass': 'باص وترى', 'synth bass': 'سينث باص',
    'drum kit': 'طقم درامز', 'percussion': 'إيقاع', 'hand claps': 'تصفيق يدوي',
    'snare': 'سنير', 'hi-hat': 'هاي-هات', 'cymbals': 'صنجات',
    'drum machine': 'درام ماشين', '808 bass': '808 باص',
    'flute': 'فلوت', 'clarinet': 'كلارينيت', 'saxophone': 'ساكسفون',
    'trumpet': 'ترومبيت', 'trombone': 'ترومبون', 'french horn': 'هورن فرنسي',
    'brass section': 'قسم النحاس', 'harmonica': 'هارمونيكا', 'whistle': 'صفارة',
    'synth lead': 'سينث ليد', 'synth pad': 'سينث باد', 'warm pad': 'باد دافئ',
    'analog pad': 'باد تناظري', 'string pad': 'باد أوتار', 'pluck': 'بلاك', 'arpeggiator': 'أربجياتور',
    'choir': 'كورس', 'group chant': 'هتاف جماعي', 'Vocal Harmony': 'هارموني صوتي', 'sub bass': 'ساب باص', 'atmospheric fx': 'مؤثرات جوية',
    'trap hi-hats': 'هاي-هات تراب',
  };

  // ── Non-GCC/Arabic styles recommended instruments (English canonical) ──
  const ENGLISH_INSTRUMENT_MAP: Record<string, string[]> = {
      // ── Pop ──
      'pop': ['piano', 'electric guitar', 'bass guitar', 'drum kit', 'synth pad', 'claps'],
      'Dance Pop': ['synth bass', 'drum kit', 'synth lead', 'bass guitar', 'claps', 'synth pad'],
      'Teen Pop': ['piano', 'electric guitar', 'bass guitar', 'drum kit', 'synth pad', 'claps'],
      'Power Pop': ['electric guitar', 'bass guitar', 'drum kit', 'piano', 'synth pad'],
      'Pop Rock': ['electric guitar', 'acoustic guitar', 'bass guitar', 'drum kit', 'piano', 'strings'],
      'Indie Pop': ['acoustic guitar', 'electric guitar', 'bass guitar', 'drum kit', 'synth pad', 'glockenspiel'],
      'Bubblegum Pop': ['piano', 'synth pad', 'drum kit', 'bass guitar', 'claps', 'bells'],
      'K-Pop': ['synth pad', 'electric guitar', 'bass guitar', 'drum kit', 'piano', '808 bass', 'claps'],
      'J-Pop': ['piano', 'synth pad', 'electric guitar', 'bass guitar', 'drum kit', 'strings'],
      'Latin Pop': ['acoustic guitar', 'piano', 'bass guitar', 'percussion', 'trumpet', 'drum kit'],
      '80s pop': ['synth lead', 'synth pad', 'electric guitar', 'bass guitar', 'drum kit', 'gated snare'],
      '90s pop': ['electric guitar', 'bass guitar', 'drum kit', 'piano', 'synth pad', 'strings'],
      'Synthpop': ['synth lead', 'synth pad', 'synth bass', 'drum machine', 'arpeggiator'],
      'Electropop': ['synth lead', 'synth pad', 'synth bass', 'drum machine', 'vocoder', 'arpeggiator'],
      // ── R&B / Soul / Funk ──
      'R&B': ['electric piano', 'bass guitar', 'drum kit', 'synth pad', 'saxophone', 'strings'],
      'Neo-Soul': ['electric piano', 'bass guitar', 'drum kit', 'guitar', 'organ', 'strings'],
      'Contemporary R&B': ['synth bass', 'drum kit', 'electric piano', 'synth pad', 'bass guitar', '808 bass'],
      'Motown': ['electric guitar', 'bass guitar', 'drum kit', 'piano', 'strings', 'horn section', 'tambourine'],
      'soul': ['electric piano', 'bass guitar', 'drum kit', 'organ', 'saxophone', 'strings', 'tambourine'],
      'funk': ['bass guitar', 'electric guitar', 'drum kit', 'organ', 'horn section', 'clavinet', 'congas', 'wah guitar'],
      'disco': ['bass guitar', 'drum kit', 'strings', 'piano', 'horn section', 'rhythm guitar', 'tambourine', 'congas'],
      'New Jack Swing': ['drum machine', 'synth bass', 'electric piano', 'bass guitar', 'synth pad', 'horn section'],
      'Quiet Storm': ['electric piano', 'bass guitar', 'drum kit', 'saxophone', 'strings', 'synth pad'],
      'Blue-eyed Soul': ['electric piano', 'bass guitar', 'drum kit', 'organ', 'saxophone', 'strings'],
      // ── Hip-Hop / Rap ──
      'hip hop': ['808 bass', 'drum machine', 'sampler', 'synth pad', 'piano', 'bass guitar'],
      'rap': ['808 bass', 'drum machine', 'synth pad', 'bass guitar', 'piano', 'orchestra hits'],
      'Trap': ['808 bass', 'trap hi-hats', 'snare', 'synth lead', 'synth pad', 'piano', 'strings'],
      'Drill': ['808 bass', 'trap hi-hats', 'sliding 808', 'dark synth pad', 'snare', 'piano'],
      'Boom Bap': ['sampler', 'drum machine', 'upright bass', 'piano', 'vinyl keys', 'bass guitar'],
      'Conscious Hip Hop': ['drum machine', 'bass guitar', 'piano', 'sampler', 'strings', 'organ'],
      'Gangsta Rap': ['808 bass', 'drum machine', 'synth lead', 'bass guitar', 'piano', 'strings'],
      'East Coast Hip Hop': ['sampler', 'drum machine', 'upright bass', 'piano', 'bass guitar', 'strings'],
      'West Coast Hip Hop': ['drum machine', 'synth bass', 'bass guitar', 'electric piano', 'funk guitar', 'synth pad'],
      'Southern Hip Hop': ['808 bass', 'drum machine', 'synth lead', 'bass guitar', 'synth pad', 'organ'],
      'Alternative Hip Hop': ['drum machine', 'bass guitar', 'piano', 'electric guitar', 'strings', 'synth pad'],
      'Cloud Rap': ['synth pad', 'drum machine', 'piano', '808 bass', 'atmospheric synth', 'trap hi-hats'],
      'Crunk': ['808 bass', 'drum machine', 'synth lead', 'claps', 'horn section', 'bass guitar'],
      // ── Urban / World ──
      'Afrobeats': ['drum kit', 'percussion', 'bass guitar', 'synth pad', 'electric guitar', 'shakers', 'congas'],
      'Afrobeat': ['drum kit', 'congas', 'bass guitar', 'electric guitar', 'horn section', 'piano', 'percussion'],
      'Reggaeton': ['drum machine', 'bass guitar', 'synth lead', 'congas', 'bongos', 'synth pad'],
      'Latin': ['percussion', 'acoustic guitar', 'bass guitar', 'piano', 'trumpet', 'congas', 'timbales'],
      'Salsa': ['trumpet', 'trombone', 'piano', 'bass guitar', 'congas', 'timbales', 'bongos', 'clave', 'shakers'],
      'Bachata': ['acoustic guitar', 'bass guitar', 'bongos', 'güira', 'piano', 'maracas'],
      'Merengue': ['accordion', 'bass guitar', 'drum kit', 'tambora', 'güira', 'brass section'],
      'Tango': ['bandoneón', 'acoustic guitar', 'upright bass', 'piano', 'violin', 'cello'],
      'Samba': ['surdo', 'tamborim', 'pandeiro', 'cuíca', 'agogô', 'acoustic guitar', 'cavaquinho'],
      'Cumbia': ['accordion', 'bass guitar', 'drum kit', 'congas', 'maracas', 'flute'],
      'Bossa Nova': ['nylon guitar', 'upright bass', 'brushed drums', 'piano', 'flute'],
      'Bollywood': ['tabla', 'violin', 'piano', 'flute', 'synth pad', 'sitar', 'dholak'],
      'Bhangra': ['dhol', 'tumbi', 'bass guitar', 'synth pad', 'percussion', 'electric guitar'],
      'Latin Rock': ['electric guitar', 'bass guitar', 'drum kit', 'congas', 'piano', 'trumpet'],
      // ── Rock ──
      'rock': ['electric guitar', 'rhythm guitar', 'bass guitar', 'drum kit', 'piano'],
      'Classic Rock': ['electric guitar', 'rhythm guitar', 'bass guitar', 'drum kit', 'piano', 'organ'],
      'rock and roll': ['electric guitar', 'bass guitar', 'drum kit', 'piano', 'saxophone'],
      'soft rock': ['acoustic guitar', 'electric guitar', 'bass guitar', 'drum kit', 'piano', 'strings'],
      'Hard Rock': ['distorted guitar', 'rhythm guitar', 'bass guitar', 'drum kit', 'organ'],
      'alternative rock': ['electric guitar', 'bass guitar', 'drum kit', 'synth pad', 'piano'],
      'indie rock': ['acoustic guitar', 'electric guitar', 'bass guitar', 'drum kit', 'piano', 'synth pad'],
      'Progressive Rock': ['electric guitar', 'bass guitar', 'drum kit', 'organ', 'synth pad', 'mellotron', 'piano'],
      'Psychedelic Rock': ['electric guitar', 'bass guitar', 'drum kit', 'organ', 'sitar', 'synth pad', 'theremin'],
      'Garage Rock': ['electric guitar', 'bass guitar', 'drum kit'],
      'Glam Rock': ['electric guitar', 'bass guitar', 'drum kit', 'piano', 'saxophone', 'synth pad'],
      'grunge': ['distorted guitar', 'bass guitar', 'drum kit', 'acoustic guitar'],
      'Britpop': ['electric guitar', 'bass guitar', 'drum kit', 'piano', 'strings', 'organ'],
      'Shoegaze': ['electric guitar', 'bass guitar', 'drum kit', 'synth pad', 'reverb guitar', 'strings'],
      'Post-Rock': ['electric guitar', 'bass guitar', 'drum kit', 'piano', 'strings', 'synth pad'],
      'Math Rock': ['electric guitar', 'bass guitar', 'drum kit'],
      'Surf Rock': ['reverb guitar', 'bass guitar', 'drum kit', 'organ'],
      'Dream Pop': ['electric guitar', 'bass guitar', 'drum kit', 'synth pad', 'piano', 'strings', 'reverb guitar'],
      // ── Metal ──
      'heavy metal': ['distorted guitar', 'rhythm guitar', 'bass guitar', 'drum kit', 'double kick drums'],
      'thrash metal': ['distorted guitar', 'rhythm guitar', 'bass guitar', 'drum kit', 'double kick drums'],
      'Death Metal': ['distorted guitar', 'bass guitar', 'double kick drums', 'blast beat drums'],
      'Black Metal': ['distorted guitar', 'bass guitar', 'blast beat drums', 'synth pad', 'piano'],
      'Power Metal': ['electric guitar', 'bass guitar', 'drum kit', 'double kick drums', 'choir', 'synth pad', 'piano'],
      'Doom Metal': ['distorted guitar', 'bass guitar', 'drum kit', 'organ', 'synth pad'],
      'Gothic Metal': ['electric guitar', 'bass guitar', 'drum kit', 'piano', 'strings', 'choir', 'synth pad'],
      'Symphonic Metal': ['electric guitar', 'bass guitar', 'drum kit', 'orchestra strings', 'choir', 'piano', 'french horn'],
      'Progressive Metal': ['electric guitar', 'bass guitar', 'drum kit', 'piano', 'synth pad', 'organ'],
      'Speed Metal': ['electric guitar', 'bass guitar', 'drum kit', 'double kick drums'],
      // ── Punk ──
      'punk rock': ['electric guitar', 'bass guitar', 'drum kit'],
      'Pop Punk': ['electric guitar', 'bass guitar', 'drum kit', 'piano'],
      'Hardcore Punk': ['electric guitar', 'bass guitar', 'drum kit'],
      'Ska Punk': ['electric guitar', 'bass guitar', 'drum kit', 'trumpet', 'trombone', 'saxophone'],
      'Emo': ['electric guitar', 'acoustic guitar', 'bass guitar', 'drum kit', 'piano'],
      'Screamo': ['electric guitar', 'bass guitar', 'drum kit'],
      'New Wave': ['synth lead', 'synth pad', 'drum machine', 'bass guitar', 'electric guitar'],
      // ── Roots / Country / Folk ──
      'country': ['acoustic guitar', 'pedal steel guitar', 'bass guitar', 'drum kit', 'fiddle', 'harmonica', 'banjo', 'piano'],
      'Country Pop': ['acoustic guitar', 'electric guitar', 'bass guitar', 'drum kit', 'piano', 'pedal steel guitar', 'strings'],
      'Outlaw Country': ['acoustic guitar', 'electric guitar', 'bass guitar', 'drum kit', 'fiddle', 'harmonica'],
      'Country Rock': ['electric guitar', 'acoustic guitar', 'bass guitar', 'drum kit', 'pedal steel guitar', 'piano'],
      'Alternative Country': ['acoustic guitar', 'electric guitar', 'bass guitar', 'drum kit', 'fiddle', 'mandolin'],
      'Honky Tonk': ['acoustic guitar', 'pedal steel guitar', 'piano', 'bass guitar', 'drum kit', 'fiddle'],
      'Western Swing': ['fiddle', 'acoustic guitar', 'pedal steel guitar', 'upright bass', 'piano', 'trumpet', 'trombone'],
      'Americana': ['acoustic guitar', 'fiddle', 'banjo', 'mandolin', 'upright bass', 'piano', 'harmonica'],
      'Contemporary Country': ['acoustic guitar', 'electric guitar', 'bass guitar', 'drum kit', 'piano', 'pedal steel guitar'],
      'bluegrass': ['banjo', 'fiddle', 'acoustic guitar', 'mandolin', 'upright bass', 'dobro'],
      'folk': ['acoustic guitar', 'fiddle', 'harmonica', 'upright bass', 'banjo', 'mandolin', 'dulcimer'],
      'Indie Folk': ['acoustic guitar', 'piano', 'cello', 'upright bass', 'drum kit', 'glockenspiel', 'mandolin'],
      'Folk Rock': ['acoustic guitar', 'electric guitar', 'bass guitar', 'drum kit', 'fiddle', 'harmonica'],
      'Folk Pop': ['acoustic guitar', 'piano', 'bass guitar', 'drum kit', 'strings', 'glockenspiel'],
      'Folk Punk': ['acoustic guitar', 'bass guitar', 'drum kit', 'fiddle', 'accordion'],
      'Protest Folk': ['acoustic guitar', 'harmonica', 'upright bass', 'fiddle', 'banjo'],
      // ── Jazz ──
      'jazz': ['piano', 'upright bass', 'brushed drums', 'saxophone', 'trumpet', 'trombone'],
      'Bebop': ['piano', 'upright bass', 'drum kit', 'saxophone', 'trumpet', 'trombone', 'vibraphone'],
      'swing': ['saxophone', 'trumpet', 'trombone', 'clarinet', 'piano', 'upright bass', 'drum kit'],
      'smooth jazz': ['saxophone', 'electric piano', 'bass guitar', 'drum kit', 'guitar', 'synth pad'],
      'Cool Jazz': ['saxophone', 'piano', 'upright bass', 'brushed drums', 'trumpet', 'flute'],
      'Jazz Fusion': ['electric guitar', 'electric piano', 'bass guitar', 'drum kit', 'saxophone', 'synth pad'],
      'Latin Jazz': ['piano', 'upright bass', 'drum kit', 'trumpet', 'congas', 'timbales', 'bongos', 'saxophone'],
      'Jazz Funk': ['electric piano', 'bass guitar', 'drum kit', 'saxophone', 'clavinet', 'trumpet', 'organ'],
      'Hard Bop': ['piano', 'upright bass', 'drum kit', 'saxophone', 'trumpet', 'organ'],
      'Acid Jazz': ['electric piano', 'bass guitar', 'drum kit', 'saxophone', 'guitar', 'turntable'],
      'Free Jazz': ['saxophone', 'piano', 'upright bass', 'drum kit', 'trumpet'],
      'Big Band': ['trumpet section', 'trombone section', 'saxophone section', 'piano', 'upright bass', 'drum kit', 'clarinet'],
      // ── Blues ──
      'blues': ['electric guitar', 'harmonica', 'piano', 'bass guitar', 'drum kit', 'organ'],
      'delta blues': ['acoustic guitar', 'slide guitar', 'harmonica', 'resonator guitar'],
      'Chicago Blues': ['electric guitar', 'harmonica', 'piano', 'bass guitar', 'drum kit', 'horn section'],
      'Electric Blues': ['electric guitar', 'harmonica', 'bass guitar', 'drum kit', 'organ', 'piano'],
      'Blues Rock': ['electric guitar', 'bass guitar', 'drum kit', 'harmonica', 'organ', 'piano'],
      'Texas Blues': ['electric guitar', 'bass guitar', 'drum kit', 'piano', 'organ'],
      'Memphis Blues': ['electric guitar', 'bass guitar', 'drum kit', 'piano', 'horn section', 'harmonica'],
      'Jump Blues': ['saxophone', 'trumpet', 'trombone', 'piano', 'bass guitar', 'drum kit', 'electric guitar'],
      'Boogie-Woogie': ['piano', 'bass guitar', 'drum kit', 'harmonica'],
      'Country Blues': ['acoustic guitar', 'slide guitar', 'harmonica', 'upright bass'],
      // ── Reggae ──
      'reggae': ['electric guitar', 'bass guitar', 'drum kit', 'organ', 'horn section', 'percussion'],
      'Roots Reggae': ['electric guitar', 'bass guitar', 'drum kit', 'organ', 'horn section', 'nyahbinghi drums'],
      'Dancehall': ['drum machine', 'bass guitar', 'synth lead', 'keyboard', 'percussion'],
      'ska': ['trumpet', 'trombone', 'saxophone', 'electric guitar', 'bass guitar', 'drum kit'],
      'dub': ['bass guitar', 'drum kit', 'electric guitar', 'organ', 'horn section'],
      'Reggae Fusion': ['electric guitar', 'bass guitar', 'drum kit', 'synth pad', 'percussion', 'organ'],
      'Lovers Rock': ['electric guitar', 'bass guitar', 'drum kit', 'organ', 'strings', 'percussion'],
      'Ragga': ['drum machine', 'bass guitar', 'synth lead', 'keyboard', 'percussion'],
      // ── Classical / Orchestral ──
      'classical': ['violin', 'viola', 'cello', 'piano', 'flute', 'oboe', 'french horn'],
      'Baroque': ['harpsichord', 'violin', 'cello', 'flute', 'oboe', 'organ'],
      'Romantic': ['piano', 'violin', 'cello', 'strings', 'french horn', 'clarinet', 'flute', 'harp'],
      'Contemporary Classical': ['piano', 'strings', 'flute', 'clarinet', 'percussion', 'synth pad'],
      'Symphony': ['violin', 'viola', 'cello', 'double bass', 'flute', 'oboe', 'clarinet', 'bassoon', 'french horn', 'trumpet', 'trombone', 'timpani', 'piano'],
      'Opera': ['orchestra strings', 'piano', 'flute', 'oboe', 'french horn', 'choir', 'harp'],
      'Chamber Music': ['violin', 'viola', 'cello', 'piano', 'flute', 'clarinet'],
      'Choral': ['choir', 'organ', 'piano', 'strings'],
      'Gregorian Chant': ['choir', 'organ'],
      // ── Electronic / Dance ──
      'Lo-Fi': ['electric piano', 'synth pad', 'bass guitar', 'drum machine', 'vinyl crackle', 'acoustic guitar'],
      'House': ['synth bass', 'synth pad', 'drum machine', 'piano', 'organ', 'claps'],
      'Deep House': ['synth bass', 'synth pad', 'electric piano', 'drum machine', 'guitar', 'strings'],
      'Tech House': ['synth bass', 'drum machine', 'synth pad', 'synth lead', 'claps'],
      'Trance': ['synth lead', 'synth pad', 'synth bass', 'drum machine', 'arpeggiator', 'piano'],
      'Techno': ['synth bass', 'drum machine', '909 drums', 'synth pad', 'synth lead'],
      'Dubstep': ['sub bass', 'drum machine', 'synth lead', 'wobble bass', 'synth pad'],
      'Drum & Bass': ['drum machine', 'sub bass', 'synth bass', 'synth pad', 'amen break'],
      'EDM': ['synth lead', 'synth bass', 'drum machine', 'synth pad', 'piano', 'fx riser', 'claps'],
      'Electro': ['synth bass', 'drum machine', 'synth lead', '808 bass', 'vocoder'],
      'Hardcore': ['drum machine', 'synth bass', 'synth lead', 'distorted synth', 'rave stab'],
      'IDM': ['drum machine', 'synth pad', 'synth bass', 'glitch', 'piano', 'arpeggiator'],
      'ambient': ['synth pad', 'piano', 'synth lead', 'atmospheric textures', 'strings'],
      'synthwave': ['synth lead', 'synth pad', 'synth bass', 'drum machine', 'arpeggiator', 'gated snare'],
      'chillwave': ['synth pad', 'electric guitar', 'drum machine', 'piano', 'bass guitar', 'reverb guitar'],
      'Vaporwave': ['electric piano', 'synth pad', 'synth bass', 'saxophone', 'drum machine'],
      'Glitch': ['drum machine', 'glitch', 'synth pad', 'synth bass', 'piano', 'arpeggiator'],
      'Witch House': ['drum machine', 'synth pad', 'synth bass', 'atmospheric synth', 'distorted synth'],
      'Grime': ['synth bass', 'drum machine', '808 bass', 'synth lead', 'piano', 'rave stab'],
      'UK Garage': ['synth bass', 'drum machine', 'synth pad', 'piano', 'guitar'],
      '2-Step': ['synth bass', 'drum machine', 'synth pad', 'piano', 'percussion'],
      'Electro Swing': ['swing drums', 'brass section', 'piano', 'synth bass', 'synth lead', 'double bass'],
      'Chiptune': ['8-bit lead', '8-bit bass', 'chip drums', 'square wave synth', 'arpeggiator'],
      // ── World ──
      'Flamenco': ['nylon guitar', 'cajon', 'hand claps', 'castanets', 'acoustic guitar'],
      'Fado': ['portuguese guitar', 'acoustic guitar', 'upright bass', 'viola baixo'],
      'Celtic': ['fiddle', 'tin whistle', 'uilleann pipes', 'acoustic guitar', 'bodhran', 'harp', 'mandolin'],
      'gospel': ['piano', 'organ', 'choir', 'bass guitar', 'drum kit', 'hand claps', 'tambourine'],
      'Ragtime': ['piano', 'bass guitar', 'drum kit', 'banjo'],
      'Zydeco': ['accordion', 'washboard', 'bass guitar', 'drum kit', 'fiddle'],
      'Cajun': ['accordion', 'fiddle', 'acoustic guitar', 'triangle', 'upright bass'],
      'Industrial': ['drum machine', 'synth bass', 'distorted synth', 'noise generator', 'electric guitar'],
  };

  // Mood → extra instrument boosters
  const MOOD_INSTRUMENT_BOOST: Record<string, string[]> = {
    'romantic': ['violin', 'soft piano', 'cello', 'ney'],
    'رومانسي': ['violin', 'soft piano', 'cello', 'ney'],
    'melancholic': ['violin', 'ney', 'cello', 'piano'],
    'حزين': ['violin', 'ney', 'cello', 'piano'],
    'energetic': ['drum kit', 'synth lead', 'bass guitar'],
    'نشيط': ['drum kit', 'synth lead', 'bass guitar'],
    'epic': ['strings', 'choir', 'tabl', 'drum kit'],
    'ملحمي': ['strings', 'choir', 'tabl', 'drum kit'],
    'party': ['mirwas', 'darbuka', 'hand claps', 'synth lead'],
    'حفلة': ['mirwas', 'darbuka', 'hand claps', 'synth lead'],
    'calm': ['soft piano', 'ney', 'strings', 'acoustic guitar'],
    'هادئ': ['soft piano', 'ney', 'strings', 'acoustic guitar'],
    'cinematic': ['strings', 'choir', 'piano', 'synth pad'],
    'سينمائي': ['strings', 'choir', 'piano', 'synth pad'],
    'dark': ['synth pad', 'cello', 'strings', 'analog pad'],
    'داكن': ['synth pad', 'cello', 'strings', 'analog pad'],
  };

  // Rhythm → extra instrument hints
  const RHYTHM_INSTRUMENT_HINT: Record<string, string[]> = {
    'Adani': ['riq', 'tabla', 'ney'],
    'عدني': ['riq', 'tabla', 'ney'],
    'Samri Rhythm': ['frame drum', 'mirwas', 'rebab'],
    'سامري': ['frame drum', 'mirwas', 'rebab'],
    'None': ['Vocal Harmony'],
    'بدون إيقاع': ['Vocal Harmony'],
    'Wedding Beat': ['mirwas', 'daff', 'hand claps'],
    'إيقاع أعراس': ['mirwas', 'daff', 'hand claps'],
    'Trap Beat': ['808 bass', 'hi-hat', 'snare'],
    'تراب بيت': ['808 bass', 'hi-hat', 'snare'],
    'Ballad Slow Groove': ['soft piano', 'strings', 'cello'],
    'بالاد هادئ': ['soft piano', 'strings', 'cello'],
    'Khaleeji Groove': ['mirwas', 'darbuka', 'riq'],
    'إيقاع خليجي': ['mirwas', 'darbuka', 'riq'],
    'Khaleeji Shuffle': ['mirwas', 'tabla', 'riq'],
    'خليجي متمايل': ['mirwas', 'tabla', 'riq'],
    'Club Beat': ['drum kit', 'synth bass', 'synth lead'],
    'إيقاع نادي': ['drum kit', 'synth bass', 'synth lead'],
  };

  const GCC_UNSAFE_RECOMMENDED_INSTRUMENTS = useMemo(() => new Set([
    '808 bass',
    'trap hi-hats',
    'hi-hat',
    'synth lead',
    'synth bass',
  ]), []);

  const GCC_SAFE_RECOMMENDED_INSTRUMENTS = useMemo(() => [
    'oud',
    'qanun',
    'ney',
    'riq',
    'darbuka',
    'tabla',
    'tar',
    'mirwas',
    'rebab',
    'soft piano',
    'cello',
    'strings',
    'warm pad',
    'hand claps',
    'group chant',
  ], []);

  const GCC_UNSAFE_RECOMMENDED_RHYTHMS = useMemo(() => new Set([
    'Trap Beat',
    'تراب بيت',
    'Drill Beat',
    'دريل بيت',
    'Club Beat',
    'إيقاع نادي',
  ]), []);

  const GCC_SAFE_RECOMMENDED_RHYTHMS = useMemo(() => (
    language === 'ar'
      ? ['إيقاع خليجي', 'خليجي متمايل', 'عدني', 'سامري', 'إيقاع أعراس', 'إيقاع تصفيق']
      : ['Khaleeji Groove', 'Khaleeji Shuffle', 'Adani', 'Samri Rhythm', 'Wedding Beat', 'Clap-Driven Groove']
  ), [language]);

  // Get recommended instruments for current style + rhythm + mood
  const recommendedInstruments = useMemo(() => {
    const isAnasheedSelected = effectiveIncludeTags.some((tag) => tag === 'Anasheed' || tag === 'أناشيد');
    if (isAnasheedSelected) return ['Vocal Harmony'];

    const recommended: string[] = [];
    for (const style of effectiveIncludeTags) {
      const mapped = STYLE_INSTRUMENT_MAPPING[style];
      if (mapped) recommended.push(...mapped);
    }
    for (const rhythm of rhythmTags) {
      const hint = RHYTHM_INSTRUMENT_HINT[rhythm];
      if (hint) recommended.push(...hint);
    }
    for (const mood of moodTags) {
      const boost = MOOD_INSTRUMENT_BOOST[mood];
      if (boost) recommended.push(...boost);
    }
    const uniqueRecommended = [...new Set(recommended)];
    if (!isGccStyleSelected) return uniqueRecommended;

    const filtered = uniqueRecommended.filter((inst) => !GCC_UNSAFE_RECOMMENDED_INSTRUMENTS.has(inst));
    const merged = [...filtered];
    for (const fallback of GCC_SAFE_RECOMMENDED_INSTRUMENTS) {
      if (!merged.includes(fallback)) merged.push(fallback);
    }
    return merged;
  }, [effectiveIncludeTags, rhythmTags, moodTags, STYLE_INSTRUMENT_MAPPING, isGccStyleSelected, GCC_UNSAFE_RECOMMENDED_INSTRUMENTS, GCC_SAFE_RECOMMENDED_INSTRUMENTS]);

  // Style → recommended rhythms (top 2)
  const STYLE_RHYTHM_MAPPING: Record<string, string[]> = {
    // ── Arabic style names → Arabic rhythm names ──
    'بوب خليجي': ['تراب بيت', 'إيقاع خليجي'],
    'خليجي راب': ['تراب بيت', 'إيقاع خليجي'],
    'خليجي رومانسي': ['عدني', 'بالاد هادئ'],
    'خليجي أنيق': ['عدني', 'خليجي متمايل'],
    'خليجي حفلات': ['إيقاع خليجي', 'إيقاع تصفيق'],
    'خليجي أعراس': ['إيقاع أعراس', 'إيقاع تصفيق'],
    'خليجي إذاعي': ['إيقاع خليجي', 'خليجي متمايل'],
    'خليجي دانس': ['إيقاع خليجي', 'إيقاع تصفيق'],
    'خليجي إلكتروني': ['إيقاع خليجي', 'إيقاع نادي'],
    'خليجي سينث بوب': ['خليجي متمايل', 'إيقاع خليجي'],
    'فيوجن خليجي': ['إيقاع خليجي', 'خليجي متمايل'],
    'إنجليزي بطابع خليجي': ['إيقاع خليجي', 'إيقاع تصفيق'],
    'خليجي آر أند بي': ['إيقاع خليجي', 'عدني'],
    'خليجي فاخر': ['عدني', 'بالاد هادئ'],
    'خليجي سينمائي': ['إيقاع جماهيري', '٦/٨ فيوجن'],
    'خليجي جماهيري': ['إيقاع جماهيري', 'إيقاع تصفيق'],
    'مناسبات وطنية خليجية': ['إيقاع جماهيري', 'إيقاع تصفيق'],
    'خليجي تراثي': ['عدني', 'إيقاع خليجي'],
    'شيلات': ['سامري', 'إيقاع تصفيق'],
    'سامري': ['سامري', 'إيقاع أعراس'],
    'جلسة': ['عدني', 'إيقاع خليجي'],
    'ليوان': ['إيقاع الليوان', '٦/٨ فيوجن'],
    'شعبي خليجي': ['عدني', 'إيقاع خليجي'],
    'مصري': ['مقسوم', 'بالاد هادئ'],
    'شعبي مصري': ['مقسوم', 'إيقاع نادي'],
    'مهرجانات': ['إيقاع نادي', 'تراب بيت'],
    'شامي': ['مقسوم', 'بالاد هادئ'],
    'بوب عربي': ['مقسوم', 'بوب ٤/٤'],
    'أناشيد': ['بدون إيقاع'],
    'بوب': ['بوب ٤/٤', 'بالاد هادئ'],
    'دانس بوب': ['إيقاع نادي', 'بوب ٤/٤'],
    'هيب هوب': ['تراب بيت', 'بوب ٤/٤'],
    'راب': ['تراب بيت', 'دريل بيت'],
    'تراب': ['تراب بيت', 'إيقاع نادي'],
    'درِل': ['دريل بيت', 'تراب بيت'],
    'جاز': ['بالاد هادئ', 'والتز ٣/٤'],
    'روك': ['بوب ٤/٤', 'إيقاع جماهيري'],
    'كلاسيكي': ['والتز ٣/٤', 'بالاد هادئ'],
    'لوفاي': ['بالاد هادئ', 'بوب ٤/٤'],
    'هاوس': ['إيقاع نادي', 'بوب ٤/٤'],
    'إي دي إم': ['إيقاع نادي', 'بوب ٤/٤'],
    'ريغي': ['بالاد هادئ', 'بوب ٤/٤'],
    'أفروبيتس': ['أفرو خليجي', 'بوب ٤/٤'],
    // ── English style names → English rhythm names ──
    'GCC Pop': ['Trap Beat', 'Khaleeji Groove'],
    'GCC Rap': ['Trap Beat', 'Drill Beat'],
    'Khaleeji Pop': ['Trap Beat', 'Khaleeji Groove'],
    'GCC Romantic': ['Adani', 'Ballad Slow Groove'],
    'GCC Elegant': ['Adani', 'Khaleeji Shuffle'],
    'GCC Party': ['Khaleeji Groove', 'Clap-Driven Groove'],
    'GCC Wedding': ['Wedding Beat', 'Clap-Driven Groove'],
    'GCC Radio Pop': ['Khaleeji Groove', 'Khaleeji Shuffle'],
    'GCC Dance Pop': ['Khaleeji Groove', 'Clap-Driven Groove'],
    'GCC Electro Pop': ['Khaleeji Groove', 'Club Beat'],
    'GCC Synth Pop': ['Khaleeji Shuffle', 'Khaleeji Groove'],
    'Modern Khaleeji Fusion': ['Khaleeji Groove', 'Khaleeji Shuffle'],
    'English GCC Pop': ['Khaleeji Groove', 'Clap-Driven Groove'],
    'GCC R&B Pop': ['Khaleeji Groove', 'Adani'],
    'Luxury GCC Pop': ['Adani', 'Ballad Slow Groove'],
    'Cinematic GCC': ['Marching Anthem', '6/8 Fusion'],
    'GCC Anthem': ['Marching Anthem', 'Clap-Driven Groove'],
    'National Event GCC': ['Marching Anthem', 'Clap-Driven Groove'],
    'GCC Traditional': ['Adani', 'Khaleeji Groove'],
    'Sheilat': ['Samri Rhythm', 'Clap-Driven Groove'],
    'Samri': ['Samri Rhythm', 'Wedding Beat'],
    'Jalsa': ['Adani', 'Khaleeji Groove'],
    'Liwa': ['Leiwah Rhythm', '6/8 Fusion'],
    'GCC Shaabi': ['Adani', 'Khaleeji Groove'],
    'Zar': ['6/8 Fusion', 'Afro-Khaleeji Groove'],
    'Ardah': ['Marching Anthem', 'Clap-Driven Groove'],
    'Khaleeji Trap': ['Trap Beat', 'Khaleeji Groove'],
    'Egyptian': ['Maqsoum', 'Ballad Slow Groove'],
    'Egyptian Shaabi': ['Maqsoum', 'Club Beat'],
    'Iraqi Style': ['Maqsoum', 'Ballad Slow Groove'],
    'Lebanese Style': ['Maqsoum', 'Ballad Slow Groove'],
    'Moroccan Style': ['Maqsoum', '6/8 Fusion'],
    'Arabic Pop': ['Maqsoum', 'Pop 4/4'],
    'Levant Pop': ['Maqsoum', 'Ballad Slow Groove'],
    'Anasheed': ['None'],
    // ── Arabic equivalents for new regional styles ──
    'عراقي': ['مقسوم', 'بالاد هادئ'],
    'لبناني': ['مقسوم', 'بالاد هادئ'],
    'مغربي': ['مقسوم', '٦/٨ فيوجن'],
    // ── Pop ──
    'pop': ['Pop 4/4', 'Ballad Slow Groove'],
    'Dance Pop': ['Club Beat', 'Pop 4/4'],
    'Teen Pop': ['Pop 4/4', 'Club Beat'],
    'Power Pop': ['Pop 4/4', 'Marching Anthem'],
    'Pop Rock': ['Pop 4/4', 'Ballad Slow Groove'],
    'Indie Pop': ['Pop 4/4', 'Ballad Slow Groove'],
    'Bubblegum Pop': ['Pop 4/4', 'Club Beat'],
    'K-Pop': ['Pop 4/4', 'Club Beat'],
    'J-Pop': ['Pop 4/4', 'Ballad Slow Groove'],
    'Latin Pop': ['6/8 Fusion', 'Pop 4/4'],
    '80s pop': ['Pop 4/4', 'Club Beat'],
    '90s pop': ['Pop 4/4', 'Ballad Slow Groove'],
    'Synthpop': ['Club Beat', 'Pop 4/4'],
    'Electropop': ['Club Beat', 'Pop 4/4'],
    // ── R&B / Soul / Funk ──
    'R&B': ['Ballad Slow Groove', 'Pop 4/4'],
    'Neo-Soul': ['Ballad Slow Groove', 'Pop 4/4'],
    'Contemporary R&B': ['Trap Beat', 'Ballad Slow Groove'],
    'Motown': ['Pop 4/4', 'Ballad Slow Groove'],
    'soul': ['Ballad Slow Groove', 'Pop 4/4'],
    'funk': ['Pop 4/4', 'Club Beat'],
    'disco': ['Club Beat', 'Pop 4/4'],
    'New Jack Swing': ['Trap Beat', 'Pop 4/4'],
    'Quiet Storm': ['Ballad Slow Groove', 'Waltz 3/4'],
    'Blue-eyed Soul': ['Ballad Slow Groove', 'Pop 4/4'],
    // ── Hip-Hop / Rap ──
    'hip hop': ['Trap Beat', 'Pop 4/4'],
    'rap': ['Trap Beat', 'Drill Beat'],
    'Trap': ['Trap Beat', 'Club Beat'],
    'Drill': ['Drill Beat', 'Trap Beat'],
    'Boom Bap': ['Pop 4/4', 'Ballad Slow Groove'],
    'Conscious Hip Hop': ['Pop 4/4', 'Ballad Slow Groove'],
    'Gangsta Rap': ['Trap Beat', 'Pop 4/4'],
    'East Coast Hip Hop': ['Pop 4/4', 'Trap Beat'],
    'West Coast Hip Hop': ['Pop 4/4', 'Club Beat'],
    'Southern Hip Hop': ['Trap Beat', 'Club Beat'],
    'Alternative Hip Hop': ['Pop 4/4', 'Ballad Slow Groove'],
    'Cloud Rap': ['Trap Beat', 'Ballad Slow Groove'],
    'Crunk': ['Club Beat', 'Trap Beat'],
    // ── Urban / World ──
    'Afrobeats': ['Afro-Khaleeji Groove', 'Pop 4/4'],
    'Afrobeat': ['Afro-Khaleeji Groove', '6/8 Fusion'],
    'Reggaeton': ['Club Beat', 'Pop 4/4'],
    'Latin': ['6/8 Fusion', 'Pop 4/4'],
    'Salsa': ['6/8 Fusion', 'Pop 4/4'],
    'Bachata': ['Ballad Slow Groove', '6/8 Fusion'],
    'Merengue': ['Pop 4/4', 'Club Beat'],
    'Tango': ['Waltz 3/4', 'Ballad Slow Groove'],
    'Samba': ['6/8 Fusion', 'Pop 4/4'],
    'Cumbia': ['6/8 Fusion', 'Pop 4/4'],
    'Bossa Nova': ['Ballad Slow Groove', 'Waltz 3/4'],
    'Bollywood': ['Maqsoum', '6/8 Fusion'],
    'Bhangra': ['Pop 4/4', 'Club Beat'],
    'Latin Rock': ['Pop 4/4', 'Marching Anthem'],
    // ── Rock ──
    'rock': ['Pop 4/4', 'Marching Anthem'],
    'Classic Rock': ['Pop 4/4', 'Marching Anthem'],
    'rock and roll': ['Pop 4/4', 'Marching Anthem'],
    'soft rock': ['Ballad Slow Groove', 'Pop 4/4'],
    'Hard Rock': ['Pop 4/4', 'Marching Anthem'],
    'alternative rock': ['Pop 4/4', 'Ballad Slow Groove'],
    'indie rock': ['Pop 4/4', 'Ballad Slow Groove'],
    'Progressive Rock': ['Waltz 3/4', 'Pop 4/4'],
    'Psychedelic Rock': ['Waltz 3/4', '6/8 Fusion'],
    'Garage Rock': ['Pop 4/4', 'Marching Anthem'],
    'Glam Rock': ['Pop 4/4', 'Club Beat'],
    'grunge': ['Pop 4/4', 'Ballad Slow Groove'],
    'Britpop': ['Pop 4/4', 'Ballad Slow Groove'],
    'Shoegaze': ['Ballad Slow Groove', 'Pop 4/4'],
    'Post-Rock': ['Ballad Slow Groove', 'Waltz 3/4'],
    'Math Rock': ['Pop 4/4', 'Waltz 3/4'],
    'Surf Rock': ['Pop 4/4', 'Club Beat'],
    'Dream Pop': ['Ballad Slow Groove', 'Waltz 3/4'],
    // ── Metal ──
    'heavy metal': ['Pop 4/4', 'Marching Anthem'],
    'thrash metal': ['Pop 4/4', 'Marching Anthem'],
    'Death Metal': ['Pop 4/4', 'Marching Anthem'],
    'Black Metal': ['Pop 4/4', 'Marching Anthem'],
    'Power Metal': ['Marching Anthem', 'Pop 4/4'],
    'Doom Metal': ['Ballad Slow Groove', 'Waltz 3/4'],
    'Gothic Metal': ['Ballad Slow Groove', 'Pop 4/4'],
    'Symphonic Metal': ['Marching Anthem', 'Waltz 3/4'],
    'Progressive Metal': ['Pop 4/4', 'Waltz 3/4'],
    'Speed Metal': ['Pop 4/4', 'Marching Anthem'],
    // ── Punk ──
    'punk rock': ['Pop 4/4', 'Marching Anthem'],
    'Pop Punk': ['Pop 4/4', 'Marching Anthem'],
    'Hardcore Punk': ['Pop 4/4', 'Marching Anthem'],
    'Ska Punk': ['Pop 4/4', 'Club Beat'],
    'Emo': ['Ballad Slow Groove', 'Pop 4/4'],
    'Screamo': ['Pop 4/4', 'Marching Anthem'],
    'New Wave': ['Club Beat', 'Pop 4/4'],
    // ── Roots / Country / Folk ──
    'country': ['Ballad Slow Groove', 'Waltz 3/4'],
    'Country Pop': ['Pop 4/4', 'Ballad Slow Groove'],
    'Outlaw Country': ['Ballad Slow Groove', 'Waltz 3/4'],
    'Country Rock': ['Pop 4/4', 'Ballad Slow Groove'],
    'Alternative Country': ['Ballad Slow Groove', 'Pop 4/4'],
    'Honky Tonk': ['Waltz 3/4', 'Pop 4/4'],
    'Western Swing': ['Waltz 3/4', 'Pop 4/4'],
    'Americana': ['Ballad Slow Groove', 'Waltz 3/4'],
    'Contemporary Country': ['Pop 4/4', 'Ballad Slow Groove'],
    'bluegrass': ['Waltz 3/4', 'Ballad Slow Groove'],
    'folk': ['Ballad Slow Groove', 'Waltz 3/4'],
    'Indie Folk': ['Ballad Slow Groove', 'Waltz 3/4'],
    'Folk Rock': ['Pop 4/4', 'Ballad Slow Groove'],
    'Folk Pop': ['Pop 4/4', 'Ballad Slow Groove'],
    'Folk Punk': ['Pop 4/4', 'Marching Anthem'],
    'Protest Folk': ['Ballad Slow Groove', 'Waltz 3/4'],
    // ── Jazz ──
    'jazz': ['Ballad Slow Groove', 'Waltz 3/4'],
    'Bebop': ['Waltz 3/4', 'Pop 4/4'],
    'swing': ['Waltz 3/4', 'Pop 4/4'],
    'smooth jazz': ['Ballad Slow Groove', 'Waltz 3/4'],
    'Cool Jazz': ['Ballad Slow Groove', 'Waltz 3/4'],
    'Jazz Fusion': ['Pop 4/4', 'Club Beat'],
    'Latin Jazz': ['6/8 Fusion', 'Waltz 3/4'],
    'Jazz Funk': ['Pop 4/4', 'Club Beat'],
    'Hard Bop': ['Pop 4/4', 'Waltz 3/4'],
    'Acid Jazz': ['Club Beat', 'Pop 4/4'],
    'Free Jazz': ['Waltz 3/4', 'Ballad Slow Groove'],
    'Big Band': ['Waltz 3/4', 'Pop 4/4'],
    // ── Blues ──
    'blues': ['Ballad Slow Groove', 'Pop 4/4'],
    'delta blues': ['Ballad Slow Groove', 'Waltz 3/4'],
    'Chicago Blues': ['Ballad Slow Groove', 'Pop 4/4'],
    'Electric Blues': ['Ballad Slow Groove', 'Pop 4/4'],
    'Blues Rock': ['Pop 4/4', 'Ballad Slow Groove'],
    'Texas Blues': ['Ballad Slow Groove', 'Pop 4/4'],
    'Memphis Blues': ['Ballad Slow Groove', 'Pop 4/4'],
    'Jump Blues': ['Pop 4/4', 'Waltz 3/4'],
    'Boogie-Woogie': ['Pop 4/4', 'Waltz 3/4'],
    'Country Blues': ['Ballad Slow Groove', 'Waltz 3/4'],
    // ── Reggae ──
    'reggae': ['Ballad Slow Groove', 'Pop 4/4'],
    'Roots Reggae': ['Ballad Slow Groove', '6/8 Fusion'],
    'Dancehall': ['Club Beat', 'Pop 4/4'],
    'ska': ['Pop 4/4', 'Club Beat'],
    'dub': ['Ballad Slow Groove', '6/8 Fusion'],
    'Reggae Fusion': ['Ballad Slow Groove', 'Club Beat'],
    'Lovers Rock': ['Ballad Slow Groove', 'Pop 4/4'],
    'Ragga': ['Club Beat', 'Pop 4/4'],
    // ── Classical / Orchestral ──
    'classical': ['Waltz 3/4', 'Ballad Slow Groove'],
    'Baroque': ['Waltz 3/4', 'Ballad Slow Groove'],
    'Romantic': ['Waltz 3/4', 'Ballad Slow Groove'],
    'Contemporary Classical': ['Waltz 3/4', 'Ballad Slow Groove'],
    'Symphony': ['Waltz 3/4', 'Marching Anthem'],
    'Opera': ['Waltz 3/4', 'Ballad Slow Groove'],
    'Chamber Music': ['Waltz 3/4', 'Ballad Slow Groove'],
    'Choral': ['Ballad Slow Groove', 'Waltz 3/4'],
    'Gregorian Chant': ['Ballad Slow Groove', 'Waltz 3/4'],
    // ── Electronic / Dance ──
    'Lo-Fi': ['Ballad Slow Groove', 'Pop 4/4'],
    'House': ['Club Beat', 'Pop 4/4'],
    'Deep House': ['Club Beat', 'Ballad Slow Groove'],
    'Tech House': ['Club Beat', 'Pop 4/4'],
    'Trance': ['Club Beat', 'Pop 4/4'],
    'Techno': ['Club Beat', 'Pop 4/4'],
    'Dubstep': ['Club Beat', 'Trap Beat'],
    'Drum & Bass': ['Club Beat', 'Pop 4/4'],
    'EDM': ['Club Beat', 'Pop 4/4'],
    'Electro': ['Club Beat', 'Pop 4/4'],
    'Hardcore': ['Club Beat', 'Marching Anthem'],
    'IDM': ['Pop 4/4', 'Waltz 3/4'],
    'ambient': ['Ballad Slow Groove', 'Waltz 3/4'],
    'synthwave': ['Pop 4/4', 'Club Beat'],
    'chillwave': ['Ballad Slow Groove', 'Pop 4/4'],
    'Vaporwave': ['Ballad Slow Groove', 'Pop 4/4'],
    'Glitch': ['Club Beat', 'Pop 4/4'],
    'Witch House': ['Trap Beat', 'Ballad Slow Groove'],
    'Grime': ['Trap Beat', 'Club Beat'],
    'UK Garage': ['Club Beat', 'Pop 4/4'],
    '2-Step': ['Club Beat', 'Pop 4/4'],
    'Electro Swing': ['Waltz 3/4', 'Pop 4/4'],
    'Chiptune': ['Pop 4/4', 'Club Beat'],
    // ── World ──
    'Flamenco': ['6/8 Fusion', 'Waltz 3/4'],
    'Fado': ['Ballad Slow Groove', 'Waltz 3/4'],
    'Celtic': ['Waltz 3/4', '6/8 Fusion'],
    'gospel': ['Pop 4/4', 'Ballad Slow Groove'],
    'Ragtime': ['Pop 4/4', 'Waltz 3/4'],
    'Zydeco': ['Pop 4/4', '6/8 Fusion'],
    'Cajun': ['Waltz 3/4', 'Pop 4/4'],
    'Industrial': ['Club Beat', 'Marching Anthem'],
  };

  // Style → recommended moods (top 3)
  const STYLE_MOOD_MAPPING: Record<string, string[]> = {
    // ── Arabic style names → Arabic mood names ──
    'بوب خليجي': ['مفعم بالطاقة', 'واثق', 'جريء'],
    'خليجي راب': ['واثق', 'جريء', 'مكثف'],
    'خليجي رومانسي': ['رومانسي', 'عاطفي', 'حنون'],
    'خليجي أنيق': ['فاخر', 'واثق', 'مشع'],
    'خليجي حفلات': ['مفعم بالطاقة', 'حفلة', 'سعيد'],
    'خليجي أعراس': ['احتفالي', 'أعراس', 'سعيد'],
    'خليجي إذاعي': ['مفعم بالطاقة', 'سعيد', 'محفز'],
    'خليجي دانس': ['مفعم بالطاقة', 'حفلة', 'متمايل'],
    'خليجي إلكتروني': ['مفعم بالطاقة', 'مثير', 'نادي'],
    'خليجي سينث بوب': ['مفعم بالطاقة', 'مثير', 'ساطع'],
    'فيوجن خليجي': ['مفعم بالطاقة', 'واثق', 'محفز'],
    'إنجليزي بطابع خليجي': ['سعيد', 'مفعم بالطاقة', 'محفز'],
    'خليجي آر أند بي': ['رومانسي', 'عاطفي', 'روحاني'],
    'خليجي فاخر': ['فاخر', 'واثق', 'مشع'],
    'خليجي سينمائي': ['ملحمي', 'درامي', 'ضخم'],
    'خليجي جماهيري': ['فخور', 'جماهيري', 'قوي'],
    'مناسبات وطنية خليجية': ['وطني', 'فخور', 'ضخم'],
    'خليجي تراثي': ['نوستالجي', 'روحاني', 'فخور'],
    'شيلات': ['فخور', 'جريء', 'قوي'],
    'سامري': ['فخور', 'مفعم بالطاقة', 'جريء'],
    'جلسة': ['رومانسي', 'نوستالجي', 'حميمي'],
    'ليوان': ['مفعم بالطاقة', 'احتفالي', 'جريء'],
    'شعبي خليجي': ['هادئ', 'نوستالجي', 'حميمي'],
    'مصري': ['رومانسي', 'عاطفي', 'نوستالجي'],
    'شعبي مصري': ['مفعم بالطاقة', 'حفلة', 'مثير'],
    'مهرجانات': ['مفعم بالطاقة', 'حفلة', 'مثير'],
    'شامي': ['رومانسي', 'عاطفي', 'حنون'],
    'بوب عربي': ['رومانسي', 'عاطفي', 'سعيد'],
    'أناشيد': ['روحاني', 'هادئ', 'فخور'],
    'بوب': ['سعيد', 'مفعم بالطاقة', 'محفز'],
    'دانس بوب': ['مفعم بالطاقة', 'حفلة', 'سعيد'],
    'تين بوب': ['سعيد', 'مرح', 'محفز'],
    'هيب هوب': ['واثق', 'جريء', 'مفعم بالطاقة'],
    'راب': ['واثق', 'جريء', 'مكثف'],
    'تراب': ['واثق', 'جريء', 'غامض'],
    'درِل': ['مكثف', 'مظلم', 'جريء'],
    'سول': ['عاطفي', 'روحاني', 'رومانسي'],
    'فنك': ['متمايل', 'مفعم بالطاقة', 'سعيد'],
    'ديسكو': ['حفلة', 'سعيد', 'مفعم بالطاقة'],
    'جاز': ['روحاني', 'نوستالجي', 'هادئ'],
    'روك': ['مفعم بالطاقة', 'قوي', 'جريء'],
    'كلاسيكي': ['ملحمي', 'عاطفي', 'هادئ'],
    'لوفاي': ['هادئ', 'نوستالجي', 'حالم'],
    'هاوس': ['مفعم بالطاقة', 'نادي', 'متمايل'],
    'إي دي إم': ['مفعم بالطاقة', 'حفلة', 'محفز'],
    'ريغي': ['هادئ', 'سعيد', 'محفز'],
    'بلوز': ['حزين', 'عاطفي', 'روحاني'],
    'أفروبيتس': ['مفعم بالطاقة', 'حفلة', 'متمايل'],
    'أفروبيت': ['مفعم بالطاقة', 'سعيد', 'متمايل'],
    // ── English style names → English mood names ──
    'GCC Pop': ['energetic', 'confident', 'bold'],
    'GCC Rap': ['confident', 'bold', 'intense'],
    'Khaleeji Pop': ['energetic', 'confident', 'bold'],
    'GCC Romantic': ['romantic', 'emotional', 'tender'],
    'GCC Elegant': ['luxurious', 'confident', 'radiant'],
    'GCC Party': ['energetic', 'party', 'happy'],
    'GCC Wedding': ['celebratory', 'wedding', 'happy'],
    'GCC Radio Pop': ['energetic', 'happy', 'uplifting'],
    'GCC Dance Pop': ['energetic', 'party', 'groovy'],
    'GCC Electro Pop': ['energetic', 'exciting', 'club'],
    'GCC Synth Pop': ['energetic', 'exciting', 'bright'],
    'Modern Khaleeji Fusion': ['energetic', 'confident', 'uplifting'],
    'English GCC Pop': ['happy', 'energetic', 'uplifting'],
    'GCC R&B Pop': ['romantic', 'soulful', 'emotional'],
    'Luxury GCC Pop': ['luxurious', 'confident', 'radiant'],
    'Cinematic GCC': ['epic', 'dramatic', 'grand'],
    'GCC Anthem': ['proud', 'anthemic', 'powerful'],
    'National Event GCC': ['national', 'proud', 'grand'],
    'GCC Traditional': ['nostalgic', 'spiritual', 'proud'],
    'Sheilat': ['proud', 'bold', 'powerful'],
    'Samri': ['proud', 'energetic', 'bold'],
    'Jalsa': ['romantic', 'nostalgic', 'intimate'],
    'Liwa': ['energetic', 'celebratory', 'bold'],
    'GCC Shaabi': ['calm', 'nostalgic', 'intimate'],
    'Zar': ['trance', 'mystical', 'spiritual'],
    'Ardah': ['proud', 'national', 'solemn'],
    'Khaleeji Trap': ['confident', 'energetic', 'bold'],
    'Egyptian': ['romantic', 'emotional', 'nostalgic'],
    'Egyptian Shaabi': ['energetic', 'party', 'exciting'],
    'Iraqi Style': ['emotional', 'nostalgic', 'soulful'],
    'Lebanese Style': ['romantic', 'tender', 'celebratory'],
    'Moroccan Style': ['energetic', 'spiritual', 'festive'],
    'Arabic Pop': ['romantic', 'emotional', 'happy'],
    'Levant Pop': ['romantic', 'emotional', 'tender'],
    'Anasheed': ['spiritual', 'calm', 'proud'],
    // ── Arabic equivalents for new regional styles ──
    'عراقي': ['عاطفي', 'نوستالجي', 'روحاني'],
    'لبناني': ['رومانسي', 'حنون', 'احتفالي'],
    'مغربي': ['مفعم بالطاقة', 'روحاني', 'احتفالي'],
    // ── Pop ──
    'pop': ['happy', 'energetic', 'uplifting'],
    'Dance Pop': ['energetic', 'party', 'happy'],
    'Teen Pop': ['happy', 'playful', 'uplifting'],
    'Power Pop': ['energetic', 'uplifting', 'happy'],
    'Pop Rock': ['energetic', 'uplifting', 'happy'],
    'Indie Pop': ['happy', 'dreamy', 'nostalgic'],
    'Bubblegum Pop': ['happy', 'playful', 'bright'],
    'K-Pop': ['happy', 'energetic', 'playful'],
    'J-Pop': ['happy', 'energetic', 'dreamy'],
    'Latin Pop': ['happy', 'energetic', 'romantic'],
    '80s pop': ['energetic', 'nostalgic', 'bright'],
    '90s pop': ['nostalgic', 'happy', 'energetic'],
    'Synthpop': ['energetic', 'exciting', 'bright'],
    'Electropop': ['energetic', 'exciting', 'club'],
    // ── R&B / Soul / Funk ──
    'R&B': ['romantic', 'soulful', 'emotional'],
    'Neo-Soul': ['soulful', 'emotional', 'calm'],
    'Contemporary R&B': ['romantic', 'confident', 'soulful'],
    'Motown': ['happy', 'soulful', 'nostalgic'],
    'soul': ['soulful', 'emotional', 'romantic'],
    'funk': ['groovy', 'energetic', 'happy'],
    'disco': ['party', 'happy', 'energetic'],
    'New Jack Swing': ['energetic', 'party', 'groovy'],
    'Quiet Storm': ['romantic', 'calm', 'soulful'],
    'Blue-eyed Soul': ['emotional', 'soulful', 'romantic'],
    // ── Hip-Hop / Rap ──
    'hip hop': ['confident', 'bold', 'energetic'],
    'rap': ['confident', 'angry', 'bold'],
    'Trap': ['confident', 'dark', 'intense'],
    'Drill': ['intense', 'dark', 'angry'],
    'Boom Bap': ['confident', 'nostalgic', 'bold'],
    'Conscious Hip Hop': ['powerful', 'emotional', 'bold'],
    'Gangsta Rap': ['angry', 'intense', 'bold'],
    'East Coast Hip Hop': ['confident', 'bold', 'nostalgic'],
    'West Coast Hip Hop': ['calm', 'groovy', 'confident'],
    'Southern Hip Hop': ['energetic', 'party', 'bold'],
    'Alternative Hip Hop': ['emotional', 'calm', 'nostalgic'],
    'Cloud Rap': ['dreamy', 'calm', 'nostalgic'],
    'Crunk': ['energetic', 'party', 'angry'],
    // ── Urban / World ──
    'Afrobeats': ['happy', 'energetic', 'groovy'],
    'Afrobeat': ['powerful', 'groovy', 'bold'],
    'Reggaeton': ['energetic', 'party', 'groovy'],
    'Latin': ['happy', 'energetic', 'romantic'],
    'Salsa': ['happy', 'energetic', 'romantic'],
    'Bachata': ['romantic', 'emotional', 'tender'],
    'Merengue': ['happy', 'energetic', 'party'],
    'Tango': ['passionate', 'dramatic', 'romantic'],
    'Samba': ['happy', 'energetic', 'celebratory'],
    'Cumbia': ['happy', 'energetic', 'groovy'],
    'Bossa Nova': ['calm', 'romantic', 'nostalgic'],
    'Bollywood': ['happy', 'romantic', 'energetic'],
    'Bhangra': ['energetic', 'celebratory', 'happy'],
    'Latin Rock': ['energetic', 'powerful', 'bold'],
    // ── Rock ──
    'rock': ['energetic', 'powerful', 'bold'],
    'Classic Rock': ['energetic', 'nostalgic', 'bold'],
    'rock and roll': ['energetic', 'happy', 'bold'],
    'soft rock': ['emotional', 'tender', 'calm'],
    'Hard Rock': ['energetic', 'powerful', 'intense'],
    'alternative rock': ['emotional', 'energetic', 'bold'],
    'indie rock': ['nostalgic', 'emotional', 'calm'],
    'Progressive Rock': ['epic', 'cinematic', 'emotional'],
    'Psychedelic Rock': ['dreamy', 'mystical', 'trance'],
    'Garage Rock': ['energetic', 'angry', 'bold'],
    'Glam Rock': ['energetic', 'playful', 'bold'],
    'grunge': ['sad', 'emotional', 'powerful'],
    'Britpop': ['energetic', 'nostalgic', 'uplifting'],
    'Shoegaze': ['dreamy', 'emotional', 'calm'],
    'Post-Rock': ['epic', 'cinematic', 'emotional'],
    'Math Rock': ['intense', 'energetic', 'exciting'],
    'Surf Rock': ['happy', 'energetic', 'bright'],
    'Dream Pop': ['dreamy', 'romantic', 'calm'],
    // ── Metal ──
    'heavy metal': ['intense', 'angry', 'powerful'],
    'thrash metal': ['intense', 'angry', 'powerful'],
    'Death Metal': ['intense', 'dark', 'angry'],
    'Black Metal': ['dark', 'intense', 'dramatic'],
    'Power Metal': ['epic', 'powerful', 'uplifting'],
    'Doom Metal': ['dark', 'sad', 'intense'],
    'Gothic Metal': ['dark', 'dramatic', 'emotional'],
    'Symphonic Metal': ['epic', 'powerful', 'dramatic'],
    'Progressive Metal': ['intense', 'epic', 'emotional'],
    'Speed Metal': ['intense', 'energetic', 'powerful'],
    // ── Punk ──
    'punk rock': ['angry', 'energetic', 'bold'],
    'Pop Punk': ['energetic', 'emotional', 'bold'],
    'Hardcore Punk': ['angry', 'intense', 'powerful'],
    'Ska Punk': ['energetic', 'happy', 'bold'],
    'Emo': ['emotional', 'sad', 'tender'],
    'Screamo': ['intense', 'angry', 'emotional'],
    'New Wave': ['energetic', 'exciting', 'nostalgic'],
    // ── Roots / Country / Folk ──
    'country': ['nostalgic', 'tender', 'sad'],
    'Country Pop': ['happy', 'uplifting', 'nostalgic'],
    'Outlaw Country': ['bold', 'nostalgic', 'confident'],
    'Country Rock': ['energetic', 'bold', 'nostalgic'],
    'Alternative Country': ['emotional', 'nostalgic', 'sad'],
    'Honky Tonk': ['happy', 'nostalgic', 'energetic'],
    'Western Swing': ['happy', 'nostalgic', 'energetic'],
    'Americana': ['nostalgic', 'emotional', 'calm'],
    'Contemporary Country': ['happy', 'uplifting', 'confident'],
    'bluegrass': ['happy', 'energetic', 'nostalgic'],
    'folk': ['nostalgic', 'calm', 'emotional'],
    'Indie Folk': ['nostalgic', 'calm', 'dreamy'],
    'Folk Rock': ['emotional', 'nostalgic', 'uplifting'],
    'Folk Pop': ['happy', 'nostalgic', 'calm'],
    'Folk Punk': ['energetic', 'angry', 'bold'],
    'Protest Folk': ['powerful', 'emotional', 'bold'],
    // ── Jazz ──
    'jazz': ['soulful', 'nostalgic', 'calm'],
    'Bebop': ['energetic', 'exciting', 'bold'],
    'swing': ['happy', 'energetic', 'nostalgic'],
    'smooth jazz': ['calm', 'soulful', 'romantic'],
    'Cool Jazz': ['calm', 'nostalgic', 'soulful'],
    'Jazz Fusion': ['energetic', 'exciting', 'groovy'],
    'Latin Jazz': ['happy', 'energetic', 'romantic'],
    'Jazz Funk': ['groovy', 'energetic', 'soulful'],
    'Hard Bop': ['energetic', 'soulful', 'bold'],
    'Acid Jazz': ['groovy', 'energetic', 'soulful'],
    'Free Jazz': ['intense', 'experimental', 'emotional'],
    'Big Band': ['happy', 'energetic', 'nostalgic'],
    // ── Blues ──
    'blues': ['sad', 'soulful', 'emotional'],
    'delta blues': ['sad', 'soulful', 'nostalgic'],
    'Chicago Blues': ['sad', 'powerful', 'emotional'],
    'Electric Blues': ['powerful', 'emotional', 'soulful'],
    'Blues Rock': ['energetic', 'powerful', 'emotional'],
    'Texas Blues': ['energetic', 'soulful', 'powerful'],
    'Memphis Blues': ['sad', 'soulful', 'emotional'],
    'Jump Blues': ['happy', 'energetic', 'groovy'],
    'Boogie-Woogie': ['happy', 'energetic', 'playful'],
    'Country Blues': ['sad', 'nostalgic', 'emotional'],
    // ── Reggae ──
    'reggae': ['calm', 'happy', 'uplifting'],
    'Roots Reggae': ['spiritual', 'calm', 'powerful'],
    'Dancehall': ['energetic', 'party', 'groovy'],
    'ska': ['happy', 'energetic', 'groovy'],
    'dub': ['trance', 'calm', 'mystical'],
    'Reggae Fusion': ['happy', 'calm', 'uplifting'],
    'Lovers Rock': ['romantic', 'tender', 'calm'],
    'Ragga': ['energetic', 'party', 'bold'],
    // ── Classical / Orchestral ──
    'classical': ['epic', 'emotional', 'calm'],
    'Baroque': ['calm', 'elegant', 'spiritual'],
    'Romantic': ['emotional', 'dramatic', 'tender'],
    'Contemporary Classical': ['calm', 'experimental', 'emotional'],
    'Symphony': ['epic', 'grand', 'emotional'],
    'Opera': ['dramatic', 'emotional', 'epic'],
    'Chamber Music': ['calm', 'elegant', 'emotional'],
    'Choral': ['spiritual', 'uplifting', 'grand'],
    'Gregorian Chant': ['spiritual', 'calm', 'mystical'],
    // ── Electronic / Dance ──
    'Lo-Fi': ['calm', 'nostalgic', 'dreamy'],
    'House': ['energetic', 'club', 'groovy'],
    'Deep House': ['calm', 'groovy', 'soulful'],
    'Tech House': ['energetic', 'club', 'intense'],
    'Trance': ['energetic', 'epic', 'cinematic'],
    'Techno': ['intense', 'dark', 'energetic'],
    'Dubstep': ['intense', 'dark', 'energetic'],
    'Drum & Bass': ['energetic', 'intense', 'exciting'],
    'EDM': ['energetic', 'party', 'uplifting'],
    'Electro': ['energetic', 'exciting', 'dark'],
    'Hardcore': ['intense', 'angry', 'energetic'],
    'IDM': ['calm', 'experimental', 'cinematic'],
    'ambient': ['calm', 'peaceful', 'cinematic'],
    'synthwave': ['nostalgic', 'energetic', 'cinematic'],
    'chillwave': ['calm', 'nostalgic', 'dreamy'],
    'Vaporwave': ['dreamy', 'nostalgic', 'calm'],
    'Glitch': ['experimental', 'intense', 'dark'],
    'Witch House': ['dark', 'mystical', 'trance'],
    'Grime': ['angry', 'intense', 'bold'],
    'UK Garage': ['groovy', 'energetic', 'soulful'],
    '2-Step': ['groovy', 'energetic', 'happy'],
    'Electro Swing': ['happy', 'energetic', 'nostalgic'],
    'Chiptune': ['happy', 'playful', 'energetic'],
    // ── World ──
    'Flamenco': ['passionate', 'dramatic', 'emotional'],
    'Fado': ['sad', 'nostalgic', 'emotional'],
    'Celtic': ['nostalgic', 'spiritual', 'uplifting'],
    'gospel': ['spiritual', 'uplifting', 'powerful'],
    'Ragtime': ['happy', 'playful', 'nostalgic'],
    'Zydeco': ['happy', 'energetic', 'celebratory'],
    'Cajun': ['happy', 'energetic', 'nostalgic'],
    'Industrial': ['dark', 'intense', 'angry'],
  };

  const recommendedRhythms = useMemo(() => {
    for (const style of effectiveIncludeTags) {
      const mapped = STYLE_RHYTHM_MAPPING[style];
      if (mapped) {
        if (!isGccStyleSelected) return mapped.slice(0, 2);

        const filtered = mapped.filter((rhythm) => !GCC_UNSAFE_RECOMMENDED_RHYTHMS.has(rhythm));
        const merged = [...filtered];
        for (const fallback of GCC_SAFE_RECOMMENDED_RHYTHMS) {
          if (!merged.includes(fallback)) merged.push(fallback);
        }
        return merged.slice(0, 2);
      }
    }
    return [];
  }, [effectiveIncludeTags, isGccStyleSelected, GCC_UNSAFE_RECOMMENDED_RHYTHMS, GCC_SAFE_RECOMMENDED_RHYTHMS]);

  // Rhythm → mood nudge: when a rhythm is selected, these moods get priority-boosted
  const RHYTHM_MOOD_BOOST: Record<string, string[]> = {
    'Khaleeji Groove':         ['groovy', 'energetic', 'confident'],
    'Khaleeji Shuffle':   ['groovy', 'playful', 'energetic'],
    'Adani':              ['nostalgic', 'emotional', 'intimate'],
    'Samri Rhythm':       ['proud', 'bold', 'energetic'],
    'Wedding Beat':       ['celebratory', 'happy', 'wedding'],
    'Clap-Driven Groove': ['energetic', 'proud', 'bold'],
    '6/8 Fusion':         ['energetic', 'festive', 'celebratory'],
    'Afro-Khaleeji Groove':   ['energetic', 'groovy', 'bold'],
    'Pop 4/4':            ['happy', 'energetic', 'uplifting'],
    'Ballad Slow Groove': ['romantic', 'emotional', 'nostalgic'],
    'Marching Anthem':    ['proud', 'epic', 'powerful'],
    'Club Beat':          ['energetic', 'party', 'exciting'],
    'Leiwah Rhythm':      ['energetic', 'celebratory', 'bold'],
    'Maqsoum':            ['emotional', 'romantic', 'nostalgic'],
    'Waltz 3/4':          ['romantic', 'dreamy', 'elegant'],
    'Trap Beat':          ['confident', 'intense', 'bold'],
    'Drill Beat':         ['intense', 'dark', 'bold'],
    // Arabic rhythm keys
    'إيقاع خليجي':        ['متمايل', 'مفعم بالطاقة', 'واثق'],
    'خليجي متمايل':       ['متمايل', 'مرح', 'مفعم بالطاقة'],
    'عدني':               ['نوستالجي', 'عاطفي', 'حميمي'],
    'إيقاع سامري':        ['فخور', 'جريء', 'مفعم بالطاقة'],
    'إيقاع أفراح':        ['احتفالي', 'سعيد', 'أعراس'],
    'إيقاع تصفيق':        ['مفعم بالطاقة', 'فخور', 'جريء'],
    '٦/٨ فيوجن':          ['مفعم بالطاقة', 'احتفالي', 'مهرجاني'],
    'أفرو خليجي':         ['مفعم بالطاقة', 'متمايل', 'جريء'],
    'بوب ٤/٤':            ['سعيد', 'مفعم بالطاقة', 'محفز'],
    'بالاد هادئ':         ['رومانسي', 'عاطفي', 'نوستالجي'],
    'إيقاع جماهيري':      ['فخور', 'ملحمي', 'قوي'],
    'إيقاع نادي':         ['مفعم بالطاقة', 'حفلة', 'مثير'],
    'إيقاع الليوان':      ['مفعم بالطاقة', 'احتفالي', 'جريء'],
    'مقسوم':              ['عاطفي', 'رومانسي', 'نوستالجي'],
    'والتز ٣/٤':          ['رومانسي', 'حالم', 'أنيق'],
    'تراب بيت':           ['واثق', 'مكثف', 'جريء'],
    'دريل بيت':           ['مكثف', 'مظلم', 'جريء'],
  };

  const recommendedMoods = useMemo(() => {
    // Get base moods from style
    let baseMoods: string[] = [];
    for (const style of effectiveIncludeTags) {
      const mapped = STYLE_MOOD_MAPPING[style];
      if (mapped) { baseMoods = mapped; break; }
    }
    if (baseMoods.length === 0) return [];
    // If rhythm is selected, merge rhythm-boosted moods first then fill from base
    if (rhythmTags.length > 0) {
      const boosted: string[] = [];
      for (const rhythm of rhythmTags) {
        const boost = RHYTHM_MOOD_BOOST[rhythm];
        if (boost) boosted.push(...boost);
      }
      const merged = [...new Set([...boosted, ...baseMoods])];
      return merged.slice(0, 3);
    }
    return baseMoods.slice(0, 3);
  }, [effectiveIncludeTags, rhythmTags, RHYTHM_MOOD_BOOST]);
 
  // Mode/Mood presets
  const MODE_GROUPS = useMemo<Array<{ title: string; items: string[] }>>(() => {
    if (language === 'ar') {
      return [
        { title: 'المشاعر', items: ['سعيد', 'حزين', 'كئيب', 'رومانسي', 'حنون', 'واثق', 'عاطفي', 'نوستالجي', 'حالم', 'جريء', 'فخور', 'روحاني', 'درامي', 'مشع', 'فاخر', 'عميق', 'مرح', 'غاضب', 'محفز', 'متمايل'] },
        { title: 'الطاقة', items: ['هادئ', 'مفعم بالطاقة', 'مثير', 'ملحمي', 'حماسي', 'قوي', 'مظلم', 'ساطع', 'غامض', 'سينمائي', 'مكثف'] },
        { title: 'المناسبة', items: ['حفلة', 'احتفالي', 'أعراس', 'وطني', 'مهرجاني', 'نادي', 'صيفي', 'سفر', 'ضخم', 'جماهيري', 'حميمي', 'استرخاء', 'تركيز'] },
      ];
    }
    return [
      { title: 'Emotion', items: ['happy', 'sad', 'melancholic', 'romantic', 'tender', 'confident', 'emotional', 'nostalgic', 'dreamy', 'bold', 'proud', 'spiritual', 'dramatic', 'radiant', 'luxurious', 'soulful', 'playful', 'angry', 'uplifting', 'groovy'] },
      { title: 'Energy', items: ['calm', 'energetic', 'exciting', 'epic', 'anthemic', 'powerful', 'dark', 'bright', 'mysterious', 'cinematic', 'intense'] },
      { title: 'Scene', items: ['party', 'celebratory', 'wedding', 'national', 'festival', 'club', 'summer', 'road trip', 'grand', 'anthemic crowd', 'intimate', 'relaxing', 'focus'] },
    ];
  }, [language]);

  const MODE_PRESETS = useMemo<string[]>(() => {
    return MODE_GROUPS.flatMap((group) => group.items);
  }, [MODE_GROUPS]);

  const INSTRUMENT_GROUPS = useMemo<Array<{ title: string; items: string[] }>>(() => {
    if (language === 'ar') {
      return [
        { title: 'تراثي عربي وخليجي', items: ['oud','qanun','ney','riq','darbuka','tabla','tar','daff','mirwas','rebab','gulf percussion'] },
        { title: 'أوتار', items: ['violin','viola','cello','contrabass','strings'] },
        { title: 'مفاتيح', items: ['piano','electric piano','soft piano','organ','accordion'] },
        { title: 'جيتارات وباص', items: ['acoustic guitar','electric guitar','bass guitar','upright bass','synth bass'] },
        { title: 'إيقاع وطبول', items: ['drum kit','percussion','hand claps','snare','hi-hat','cymbals','drum machine','808 bass'] },
        { title: 'نفخ ونحاس', items: ['flute','clarinet','saxophone','trumpet','trombone','french horn','brass section','harmonica','whistle'] },
        { title: 'عالمي', items: ['sitar','steel drums','bagpipe','banjo','mandolin'] },
        { title: 'سينث وجو', items: ['synth lead','synth pad','warm pad','analog pad','string pad','pluck','arpeggiator'] },
        { title: 'صوت وجماعي', items: ['choir','group chant','sub bass','atmospheric fx'] },
      ];
    }
    return [
      { title: 'Arabic & Gulf Traditional', items: ['oud','qanun','ney','riq','darbuka','tabla','mirwas','tabl','tabl turki','frame drum','daff','tar','tanbura','mijwiz','rebab','gulf percussion'] },
      { title: 'Strings', items: ['violin','viola','cello','contrabass','strings'] },
      { title: 'Keys', items: ['piano','electric piano','soft piano','organ','accordion'] },
      { title: 'Guitars & Bass', items: ['acoustic guitar','electric guitar','bass guitar','upright bass','synth bass'] },
      { title: 'Drums & Percussion', items: ['drum kit','percussion','hand claps','snare','hi-hat','cymbals','drum machine','808 bass'] },
      { title: 'Winds & Brass', items: ['flute','clarinet','saxophone','trumpet','trombone','french horn','brass section','harmonica','whistle'] },
      { title: 'World', items: ['sitar','steel drums','bagpipe','banjo','mandolin'] },
      { title: 'Synth & Texture', items: ['synth lead','synth pad','warm pad','analog pad','string pad','pluck','arpeggiator'] },
      { title: 'Vocal & Group', items: ['choir','group chant','sub bass','atmospheric fx'] },
    ];
  }, [language]);

  const INSTRUMENT_PRESETS = useMemo<string[]>(() => {
    return INSTRUMENT_GROUPS.flatMap((group) => group.items);
  }, [INSTRUMENT_GROUPS]);

  // Guard to ensure monthly usage loads only once (avoids StrictMode double-run logs)
  const usageLoadedRef = useRef(false);

  // Helper to refresh music quota state from backend
  const refreshMusicQuota = async () => {
    try {
      const { data, error } = await (supabase as any).rpc('can_generate_music');
      if (!error && data) {
        const used = data.generated ?? 0;
        const limit = data.limit ?? 30;
        setSongsUsed(used);
        setSongsLimit(limit);
        setSongsRemaining(Math.max(0, limit - used));
      }
    } catch {}
  };

  // Load current month's music usage and dynamic limit (base 30 + gifted extras)
  useEffect(() => {
    if (usageLoadedRef.current) return;
    usageLoadedRef.current = true;
    refreshMusicQuota();
    // Also refresh when tab gains focus (e.g., after admin gifts)
    const onVisibility = () => { if (document.visibilityState === 'visible') refreshMusicQuota(); };
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility as any);
    return () => {
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility as any);
    };
  }, []);

  useEffect(() => {
    onQuotaChange?.({ remaining: songsRemaining, limit: songsLimit, used: songsUsed });
  }, [onQuotaChange, songsRemaining, songsLimit, songsUsed]);

  function normalizeAmpLyricsResult(text: string, mode: 'idea' | 'expand' | 'gcc_enhance'): string {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized || mode === 'gcc_enhance') return normalized;

    const cleaned = normalized
      .split('\n')
      .map((line) => line.trim())
      .reduce<string[]>((acc, line) => {
        if (!line) {
          if (acc.length > 0 && acc[acc.length - 1] !== '') acc.push('');
          return acc;
        }

        if (/^\[[^\]]+\]$/.test(line) || /^\((?:[^)]*(?:solo|instrumental(?:\s+build)?|drop|intro|outro|pre-chorus|verse|chorus|bridge|spoken|whispered|call and response)[^)]*)\)$/i.test(line)) {
          if (acc.length > 0 && acc[acc.length - 1] !== '') acc.push('');
          return acc;
        }

        acc.push(line);
        return acc;
      }, []);

    return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // Simple Amp - expand user lyrics into structured song
  async function handleAmp() {
    const userInput = ampMode === 'idea'
      ? (lyricsText.trim() || styleText.trim() || title.trim())
      : lyricsText.trim();
    if (!userInput) {
      toast.error(isAr ? (ampMode === 'idea' ? 'اكتب فكرة أو كلمات أولاً' : 'اكتب كلمات أولاً') : (ampMode === 'idea' ? 'Write an idea or some lyrics first' : 'Write some lyrics first'));
      return;
    }
    if (ampMode === 'expand' && !lyricsText.trim()) {
      toast.error(isAr ? 'اكتب كلمات أولاً للتوسيع' : 'Write lyrics first for Expand');
      return;
    }
    if (ampMode === 'gcc_enhance' && !lyricsText.trim()) {
      toast.error(isAr ? 'اكتب كلمات أولاً للتحسين الخليجي' : 'Write lyrics first for Khaleeji Enhance');
      return;
    }
    if (hasBannedInput()) {
      toast.error(isAr ? 'تحتوي المدخلات على ألفاظ غير مسموحة.' : 'Inputs contain disallowed words.');
      return;
    }
    
    setAmping(true);
    try {
      const khalijiControlBlock = buildKhalijiControlBlock();
      const kieStyle = khalijiControlBlock.styleString;
      const { data, error } = await supabase.functions.invoke('music-amp', {
        body: {
          text: userInput,
          mode: ampMode === 'gcc_enhance' ? 'gcc-enhance' : 'lyrics',
          ampMode: ampMode,
          duration: duration,
          style: kieStyle || includeTags.join(', '),
          styleTags: effectiveIncludeTags,
          rhythm: rhythmTags[0] || '',
          rhythmTags: rhythmTags,
          instruments: instrumentTags.join(', '),
          instrumentTags: instrumentTags,
          mood: moodTags[0] || '',
          moodTags: moodTags,
          vocalType: vocalType,
          title: title.trim(),
          controlBlock: khalijiControlBlock.controlBlock,
          structurePlan: khalijiControlBlock.structurePlan,
          tempoHint: khalijiControlBlock.tempoTag,
          musicalKeyHint: khalijiControlBlock.keyTag,
        }
      });
      if (error) throw error;
      const expandedLyrics = normalizeAmpLyricsResult((data?.text || '').toString(), ampMode);
      if (!expandedLyrics) throw new Error(isAr ? 'تعذّر التوسيع' : 'Expansion failed');
      if (ampMode === 'gcc_enhance') {
        isGccEnhanceRef.current = true;
        setGccOriginalLyrics(lyricsText);
        setLyricsText(expandedLyrics);
        setLyricsKey((prev) => prev + 1);
        setLyricsDisplayMode(true);
        setTimeout(() => { isGccEnhanceRef.current = false; }, 500);
      } else {
        setLyricsText(expandedLyrics);
        setLyricsDisplayMode(false);
      }
      toast.success(isAr ? (ampMode === 'idea' ? 'تم إنشاء الكلمات' : ampMode === 'gcc_enhance' ? 'تم التحسين الخليجي' : 'تم توسيع الكلمات') : (ampMode === 'idea' ? 'Lyrics generated' : ampMode === 'gcc_enhance' ? 'Khaleeji enhanced' : 'Lyrics expanded'));
    } catch (e: any) {
      toast.error((isAr ? 'فشل: ' : 'Failed: ') + (e?.message || String(e)));
    } finally {
      setAmping(false);
    }
  }

  useEffect(() => {
    if (!isGccStyleSelected && ampMode === 'gcc_enhance') {
      setAmpMode('expand');
    }
  }, [isGccStyleSelected, ampMode]);

  // Caps: style max 350, lyrics gets remaining up to overall 800 (title excluded from cap)
  const limit = 2350;
  const styleCap = 350;
  const lyricsFixedCap = 2000;
  const totalChars = useMemo(() => {
    const count = (s: string) => Array.from(s || '').length;
    return count(styleText || '') + count(lyricsText || '');
  }, [styleText, lyricsText]);
  const remainingOverall = Math.max(0, limit - totalChars);
  const styleLen = useMemo(() => Array.from(styleText || '').length, [styleText]);
  const lyricsCap = useMemo(() => {
    const leftoverFromStyle = Math.max(0, styleCap - styleLen);
    const base = lyricsFixedCap + leftoverFromStyle; // reallocate unused style chars
    const maxAllowedByTotal = Math.max(0, limit - styleLen);
    return Math.min(base, maxAllowedByTotal);
  }, [styleLen]);
  const overLimit = totalChars > limit;

  // Helpers
  function stripStylesSuffix(text: string) { return (text || '').trim(); }

  function buildStylesSuffix() {
    const parts: string[] = [];
    if (includeTags.length > 0) parts.push(`${language==='ar' ? 'الأنماط' : 'Include styles'}: ${includeTags.join(', ')}`);
    if (instrumentTags.length > 0) parts.push(`${language==='ar' ? 'الآلات' : 'Instruments'}: ${instrumentTags.join(', ')}`);
    if (moodTags.length > 0) parts.push(`${language==='ar' ? 'المزاج' : 'Mode'}: ${moodTags.join(', ')}`);
    // Only enforce vocals in style line when explicitly Female/Male (not auto/none)
    if (vocalType === 'female') parts.push(`${language==='ar' ? 'الصوت' : 'Vocals'}: ${language==='ar' ? 'صوت أنثوي' : 'Female voice'}`);
    if (vocalType === 'male') parts.push(`${language==='ar' ? 'الصوت' : 'Vocals'}: ${language==='ar' ? 'صوت ذكوري' : 'Male voice'}`);
    return parts.join('. ');
  }

  // Arrangement mapping per duration (producer-style roadmap)
  function getArrangementBrief(sec: number, wantsAr: boolean) {
    const s = Math.min(120, Math.max(10, sec || 30));
    if (s <= 30) {
      return wantsAr
        ? 'خريطة التوزيع: 0–4 ثانية مقدمة مُفلترة → 4–12 ثانية مقطع أول (آلات أقل) → 12–18 ثانية ما قبل اللازمة (تصاعد/رايزر) → 18–28 ثانية اللازمة (كامل الطقم وصوت أعرض) → 28–30 ثانية نهاية قصيرة واضحة.'
        : 'Arrangement: 0–4s filtered intro → 4–12s verse (minimal instruments) → 12–18s pre-chorus (build/riser) → 18–28s chorus (full kit, wider stereo) → 28–30s button ending.';
    }
    if (s <= 60) {
      return wantsAr
        ? 'خريطة التوزيع: مقدمة قصيرة → مقطع أول → ما قبل اللازمة → اللازمة 1 → مقطع/انتقال → اللازمة 2 → خاتمة.'
        : 'Arrangement: short intro → verse → pre-chorus → chorus 1 → interlude/transition → chorus 2 → outro.';
    }
    if (s <= 90) {
      return wantsAr
        ? 'خريطة التوزيع: مقدمة → مقطع → ما قبل اللازمة → اللازمة → جسر قصير → اللازمة (أعرض) → خاتمة.'
        : 'Arrangement: intro → verse → pre-chorus → chorus → short bridge → bigger chorus → outro.';
    }
    return wantsAr
      ? 'خريطة التوزيع: مقدمة → مقطع → ما قبل اللازمة → اللازمة → جسر → اللازمة النهائية (أعرض وأعلى طاقة) → خاتمة.'
      : 'Arrangement: intro → verse → pre-chorus → chorus → bridge → final chorus (wider/louder) → outro.';
  }

  // Post-process helpers to reduce repetition in lyrics
  function normalizeLine(s: string) {
    return (s || '')
      .toLowerCase()
      .replace(/[^a-zA-Z\u0600-\u06FF0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function firstNWords(s: string, n: number) {
    if (!s) return '';
    const parts = s.split(' ').filter(Boolean);
    return parts.slice(0, Math.max(1, n)).join(' ');
  }
  function dedupeLines(lines: string[]) {
    const out: string[] = [];
    const seen = new Set<string>();
    const seenStarts = new Set<string>();
    let repeatUsed = false; // allow one intentional repeat (chorus) later via filter
    let lastKept: string | null = null;
    for (const line of lines) {
      const norm = normalizeLine(line);
      if (!norm) continue;
      const start = firstNWords(norm, 3);
      const isExactRepeat = seen.has(norm);
      const startsRepeat = start && seenStarts.has(start);
      // Allow ONE non-adjacent repeat (probable chorus)
      const allowChorus = true;
      if ((isExactRepeat || startsRepeat)) {
        if (!repeatUsed && allowChorus && lastKept && normalizeLine(lastKept) !== norm) {
          repeatUsed = true;
          out.push(line);
          lastKept = line;
          continue;
        }
        continue;
      }
      seen.add(norm);
      if (start) seenStarts.add(start);
      out.push(line);
      lastKept = line;
    }
    return out;
  }

  // Banned-terms guard (blocks AMP/Generate if present in style/title/lyrics)
  const BANNED_PATTERNS: RegExp[] = [
    // Strong profanity
    /\bfuck(?:ing|ed)?\b/i, /mother\s*fuck(?:er|in[g]?)\b/i, /\bmofo\b/i, /f\W*off/i,
    /\bshit\b/i, /bull\s*shit/i, /dip\s*shit/i,
    /ass\s*hole/i, /arse\s*hole/i, /dumb\s*ass/i, /jack\s*ass/i,
    /\bbitch(?:y)?\b/i, /son\s*of\s*a\s*bitch/i,
    /\bbastard\b/i, /dick\s*head/i, /\bdick\b/i, /\bprick\b/i,
    /\bpussy\b/i, /cock\s*sucker/i, /c\W*sucker/i,
    /\btits?\b/i, /titties/i, /\bwanker\b/i, /\btosser\b/i,
    // Sexual/explicit
    /blow\s*job/i, /hand\s*job/i, /rim\s*job/i,
    /\bcum\b/i, /cumm?ing/i, /\bjizz\b/i,
    /\bdildo\b/i, /vibrator/i,
    /\bporn(?:o|star)?\b/i,
    /gang\s*bang/i, /hard\s*core/i,
    /\banal\b/i, /deep\s*throat/i,
    /\bnaked\b/i, /\bnude\b/i, /boob(?:ies)?/i,
    // Violent/graphic
    /kill\s*yourself|\bkys\b/i, /\bgo\s*die\b/i, /die\s*in\s*a\s*fire|\bdiaf\b/i,
    /\bgore\b/i, /blood\s*bath/i, /\brape\b/i, /mutilat(?:e|ion)/i, /decapitat(?:e|ion)/i,
    // Abbreviations/variants
    /f\W*\**\W*c\W*k/i, /sh[!1\*]t/i, /b[!i]tch/i, /a[$@]{1,2}|\bazz\b|\b@?ss\b/i, /d[!1]ck/i,
    /p\W*\**\W*ssy|pu55y/i, /mf(?:er|’er|er)|mthrfkr/i, /\bstfu\b/i, /\bgtfo\b/i
  ];
  function hasBannedInput() {
    const text = [title, styleText, lyricsText].join(' \n ');
    return BANNED_PATTERNS.some((re) => re.test(text));
  }

  // Anti-cliché blacklist for lyrics post-filter
  const CLICHE_PATTERNS: RegExp[] = [
    /sunbeams?\s+dance/i,
    /favorite\s+chair/i,
    /by\s+the\s+door/i,
    /gentle\s+breeze/i,
    /holding\s+hands?\s+by\s+the\s+shore/i,
    /stars?\s+align/i,
    /heart\s+of\s+gold/i,
    /dreams?\s+come\s+true/i,
    /follow\s+your\s+heart/i,
    /walk\s+into\s+the\s+light/i,
    /dance\s+the\s+night\s+away/i,
    /under\s+the\s+moonlight/i,
    /endless\s+sky/i,
    /broken\s+heart/i,
    /tears?\s+fall/i,
    /forever\s+and\s+ever/i,
    /dreams?\s+tonight/i,
    /make\s+me\s+feel\s+alive/i,
    /light\s+up\s+my\s+world/i,
    /waiting\s+for\s+you/i
  ];
  function isClicheLine(s: string) {
    return CLICHE_PATTERNS.some((re) => re.test(s));
  }

  function toggleMusicSubsection(section: 'styles' | 'instruments' | 'rhythm' | 'mood') {
    if (section === 'styles') {
      setStylesOpen((prev) => {
        const next = !prev;
        setInstrumentsOpen(false);
        setRhythmOpen(false);
        setMoodOpen(false);
        return next;
      });
      return;
    }

    if (section === 'instruments') {
      setInstrumentsOpen((prev) => {
        const next = !prev;
        setStylesOpen(false);
        setRhythmOpen(false);
        setMoodOpen(false);
        return next;
      });
      return;
    }

    if (section === 'rhythm') {
      setRhythmOpen((prev) => {
        const next = !prev;
        setStylesOpen(false);
        setInstrumentsOpen(false);
        setMoodOpen(false);
        return next;
      });
      return;
    }

    setMoodOpen((prev) => {
      const next = !prev;
      setStylesOpen(false);
      setInstrumentsOpen(false);
      setRhythmOpen(false);
      return next;
    });
  }

  function handleStyleToggle(style: string) {
    const isDeselect = includeTags.includes(style);
    if (isDeselect) {
      setIncludeTags((prev) => prev.filter((t) => t !== style));
      setStylesCollapsed(false);
      setRhythmOpen(false);
    } else {
      setIncludeTags([style]);
      setStylesCollapsed(true);
      setRhythmOpen(true);
      setMoodOpen(false);
      setInstrumentsOpen(false);
    }
  }

  function handleStylesNext() {
    setStylesOpen(false);
    setRhythmOpen(true);
    setInstrumentsOpen(false);
    setMoodOpen(false);
  }

  function handleRhythmToggle(rhythm: string) {
    setRhythmTags((prev) => {
      if (prev.includes(rhythm)) return prev.filter((t) => t !== rhythm);
      if (prev.length >= 2) {
        toast.error(isAr ? 'يمكنك اختيار إيقاعين كحد أقصى' : 'You can select up to 2 rhythms');
        return prev;
      }
      const next = [...prev, rhythm];
      if (next.length === 2) {
        setTimeout(() => { setRhythmOpen(false); setMoodOpen(true); }, 0);
      }
      return next;
    });
  }

  function handleRhythmNext() {
    setRhythmOpen(false);
    setMoodOpen(true);
  }

  function handleSelectRecommendedRhythms() {
    if (recommendedRhythms.length === 0) return;
    setRhythmTags(recommendedRhythms.slice(0, 2));
    setTimeout(() => {
      setRhythmOpen(false);
      setMoodOpen(true);
    }, 150);
  }

  function handleSelectRecommendedMoods() {
    if (recommendedMoods.length === 0) return;
    setMoodTags(recommendedMoods.slice(0, 3));
    setTimeout(() => {
      setMoodOpen(false);
      setInstrumentsOpen(true);
    }, 150);
  }

  function handleSelectRecommendedInstruments() {
    if (recommendedInstruments.length === 0) return;
    const limited = [...recommendedInstruments].slice(0, 6);
    setInstrumentTags(limited);
    if (limited.length >= 6) {
      setTimeout(() => {
        setInstrumentsOpen(false);
        setVocalsOpen(true);
        setStylesOpen(false);
      }, 150);
    }
  }

  function handleInstrumentToggle(inst: string) {
    setInstrumentTags((prev) => {
      if (prev.includes(inst)) {
        return prev.filter((tag) => tag !== inst);
      }

      if (prev.length >= 6) {
        toast.error(isAr ? 'يمكنك اختيار 6 آلات كحد أقصى' : 'You can select up to 6 instruments');
        return prev;
      }

      const next = [...prev, inst];

      if (next.length === 6) {
        setTimeout(() => {
          setInstrumentsOpen(false);
          setStylesOpen(false);
          setStep2ReadyToProceed(true);
        }, 0);
      }

      return next;
    });
  }

  function handleInstrumentsNext() {
    setInstrumentsOpen(false);
    setStep2ReadyToProceed(true);
  }

  function handleMoodToggle(mood: string) {
    setMoodTags((prev) => {
      if (prev.includes(mood)) {
        return prev.filter((tag) => tag !== mood);
      }

      if (prev.length >= 3) {
        toast.error(isAr ? 'يمكنك اختيار 3 حالات كحد أقصى' : 'You can select up to 3 moods');
        return prev;
      }

      const next = [...prev, mood];

      if (next.length === 3) {
        setTimeout(() => {
          setMoodOpen(false);
          setInstrumentsOpen(true);
        }, 0);
      }

      return next;
    });
  }

  function handleMoodNext() {
    setMoodOpen(false);
    setInstrumentsOpen(true);
  }

  function handleVocalSelect(v: 'auto'|'none'|'female'|'male') {
    setVocalType(v);
    setVocalsOpen(false);
    setLyricsOpen(true);
    setTimeout(() => goToStep(4), 700);
  }

  function toggleMainSection(section: 'title' | 'style' | 'vocals' | 'lyrics') {
    if (!composeDetailsVisible && section !== 'title') return;
    setTitleOpen(section === 'title' ? !titleOpen : false);
    setMusicStyleOpen(section === 'style' ? !musicStyleOpen : false);
    setVocalsOpen(section === 'vocals' ? !vocalsOpen : false);
    setLyricsOpen(section === 'lyrics' ? !lyricsOpen : false);
  }

  const handleSaveGeneratedTrack = async (trackId: string) => {
    if (!user || savingTrackIds.includes(trackId)) return;
    setSavingTrackIds((prev) => [...prev, trackId]);
    try {
      const track = generatedTracks.find((item) => item.id === trackId);
      const existing = track ? trackId : null;
      if (!existing) throw new Error(isAr ? 'لم يتم العثور على المقطع' : 'Track not found');

      const { data: existingRow, error: existingRowError } = await (supabase as any)
        .from('user_music_tracks')
        .select('meta')
        .eq('id', existing)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingRowError) throw existingRowError;

      const nextMeta = {
        ...((existingRow?.meta as Record<string, unknown> | null) ?? {}),
        status: 'completed',
        saved: true,
      };

      const { error } = await (supabase as any)
        .from('user_music_tracks')
        .update({ meta: nextMeta })
        .eq('id', existing)
        .eq('user_id', user.id);

      if (error) throw error;

      setSavedTrackIds((prev) => prev.includes(trackId) ? prev : [...prev, trackId]);
      toast.success(isAr ? 'تم الحفظ في المحفوظات' : 'Saved to your Saved tab');
    } catch (e: any) {
      toast.error((isAr ? 'فشل الحفظ: ' : 'Save failed: ') + (e?.message || String(e)));
    } finally {
      setSavingTrackIds((prev) => prev.filter((id) => id !== trackId));
    }
  };

  // No more mirroring chips into a single prompt; we compose at send-time


  // Build style string from chips + styleText
  // Narrow pronunciation-only negatives — blocks Arabic dialect drift, English stays allowed
  // Pronunciation-defect shield. Dialect names (egyptian/levantine/etc.) tell Suno WHAT to
  // avoid by label; phonetic tokens (hard final qaf, rolled r, khutbah cadence, etc.) tell
  // Suno HOW the mouth should NOT sound. Both layers reinforce each other.
  const GCC_DIALECT_BLOCK = 'egyptian, levantine, maghrebi, fusha, msa, north african, sudanese, non-gulf, non-khaleeji, mispronounced, autotune, low quality, distorted, vocal hiss, quranic recitation, news anchor delivery, classical enunciation, hard final qaf, rolled trilled r, formal khutbah cadence, hijazi accent, andalusi accent';
  const GCC_DIALECT_BLOCK_AR = 'مصري، شامي، مغربي، فصحى، شمال أفريقي، سوداني، غير خليجي، جودة منخفضة';

  const GCC_PRONUNCIATION_NEGATIVES: Record<string, string> = {
    'English GCC Pop': '', 'إنجليزي بطابع خليجي': '',
    'GCC Pop': GCC_DIALECT_BLOCK,
    'GCC Rap': `${GCC_DIALECT_BLOCK}, ballad, orchestral pop, wedding chant, traditional folk lead, soft romantic pop`,
    'Khaleeji Pop': GCC_DIALECT_BLOCK,
    'GCC Romantic': GCC_DIALECT_BLOCK,
    'GCC Elegant': GCC_DIALECT_BLOCK,
    'GCC Party': GCC_DIALECT_BLOCK,
    'GCC Wedding': GCC_DIALECT_BLOCK,
    'GCC Radio Pop': GCC_DIALECT_BLOCK,
    'GCC Dance Pop': GCC_DIALECT_BLOCK,
    'GCC Electro Pop': GCC_DIALECT_BLOCK,
    'GCC Synth Pop': GCC_DIALECT_BLOCK,
    'Modern Khaleeji Fusion': GCC_DIALECT_BLOCK,
    'GCC R&B Pop': GCC_DIALECT_BLOCK,
    'Luxury GCC Pop': GCC_DIALECT_BLOCK,
    'Cinematic GCC': GCC_DIALECT_BLOCK,
    'GCC Anthem': GCC_DIALECT_BLOCK,
    'National Event GCC': GCC_DIALECT_BLOCK,
    'GCC Traditional': GCC_DIALECT_BLOCK,
    'Sheilat': GCC_DIALECT_BLOCK,
    'Samri': GCC_DIALECT_BLOCK,
    'Jalsa': GCC_DIALECT_BLOCK,
    'Liwa': GCC_DIALECT_BLOCK,
    'GCC Shaabi': GCC_DIALECT_BLOCK,
    'Zar': GCC_DIALECT_BLOCK,
    'Ardah': GCC_DIALECT_BLOCK,
    'Khaleeji Trap': GCC_DIALECT_BLOCK,
    'بوب خليجي': GCC_DIALECT_BLOCK_AR, 'خليجي راب': GCC_DIALECT_BLOCK_AR, 'خليجي عصري': GCC_DIALECT_BLOCK_AR,
    'خليجي رومانسي': GCC_DIALECT_BLOCK_AR, 'خليجي أنيق': GCC_DIALECT_BLOCK_AR,
    'خليجي حفلات': GCC_DIALECT_BLOCK_AR, 'خليجي أعراس': GCC_DIALECT_BLOCK_AR,
    'خليجي إذاعي': GCC_DIALECT_BLOCK_AR, 'خليجي دانس': GCC_DIALECT_BLOCK_AR,
    'خليجي إلكتروني': GCC_DIALECT_BLOCK_AR, 'خليجي سينث بوب': GCC_DIALECT_BLOCK_AR,
    'فيوجن خليجي': GCC_DIALECT_BLOCK_AR, 'خليجي آر أند بي': GCC_DIALECT_BLOCK_AR,
    'خليجي فاخر': GCC_DIALECT_BLOCK_AR, 'خليجي سينمائي': GCC_DIALECT_BLOCK_AR,
    'خليجي جماهيري': GCC_DIALECT_BLOCK_AR, 'مناسبات وطنية خليجية': GCC_DIALECT_BLOCK_AR,
    'خليجي تراثي': GCC_DIALECT_BLOCK_AR, 'شيلات': GCC_DIALECT_BLOCK_AR,
    'سامري': GCC_DIALECT_BLOCK_AR, 'جلسة': GCC_DIALECT_BLOCK_AR,
    'ليوان': GCC_DIALECT_BLOCK_AR,
  };

  // Default rhythm + instrument anchors per GCC style — auto-filled when user skips those sections
  const GCC_STYLE_ANCHORS: Record<string, { rhythm: string; instrument: string; production?: string }> = {
    'GCC Pop': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'synth lead' },
    'GCC Rap': { rhythm: 'drill beat', instrument: '808 bass groove', production: 'trap hi-hats' },
    'Khaleeji Pop': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'synth lead' },
    'GCC Romantic': { rhythm: 'adani rhythm', instrument: 'oud lead', production: 'soft strings' },
    'GCC Elegant': { rhythm: 'adani rhythm', instrument: 'violin lead', production: 'strings texture' },
    'GCC Party': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'synth bass' },
    'GCC Wedding': { rhythm: 'wedding festive beat', instrument: 'mirwas percussion', production: 'tabl percussion' },
    'GCC Radio Pop': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'synth lead' },
    'GCC Dance Pop': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'synth bass' },
    'GCC Electro Pop': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'synth lead' },
    'GCC Synth Pop': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'synth pad' },
    'Modern Khaleeji Fusion': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: '808 bass groove' },
    'English GCC Pop': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'synth lead' },
    'GCC R&B Pop': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'electric piano lead' },
    'Luxury GCC Pop': { rhythm: 'adani rhythm', instrument: 'violin lead', production: 'strings texture' },
    'Cinematic GCC': { rhythm: 'marching anthem beat', instrument: 'strings lead', production: 'choir texture' },
    'GCC Anthem': { rhythm: 'marching anthem beat', instrument: 'tabl percussion', production: 'choir texture' },
    'National Event GCC': { rhythm: 'marching anthem beat', instrument: 'tabl percussion', production: 'choir lead' },
    'GCC Traditional': { rhythm: 'khaleeji groove', instrument: 'oud lead', production: 'qanun texture' },
    'Sheilat': { rhythm: 'samri rhythm', instrument: 'frame drum groove', production: 'mirwas percussion' },
    'Samri': { rhythm: 'samri rhythm', instrument: 'frame drum groove', production: 'tabl percussion' },
    'Jalsa': { rhythm: 'adani rhythm', instrument: 'oud lead', production: 'qanun texture' },
    'Liwa': { rhythm: 'leiwah rhythm', instrument: 'tanbura lead', production: 'mirwas percussion' },
    'GCC Shaabi': { rhythm: 'khaleeji groove', instrument: 'oud lead', production: 'riq groove' },
    'Zar': { rhythm: 'leiwah rhythm', instrument: 'tanbura lead', production: 'frame drum groove' },
    'Ardah': { rhythm: 'samri rhythm', instrument: 'tabl drum lead', production: 'mirwas texture' },
    'Khaleeji Trap': { rhythm: 'trap beat', instrument: '808 bass groove', production: 'mirwas texture' },
    'بوب خليجي': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'synth lead' },
    'خليجي راب': { rhythm: 'trap beat', instrument: '808 bass groove', production: 'mirwas percussion' },
    'خليجي عصري': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'synth lead' },
    'خليجي رومانسي': { rhythm: 'adani rhythm', instrument: 'oud lead', production: 'soft strings' },
    'خليجي أنيق': { rhythm: 'adani rhythm', instrument: 'violin lead', production: 'strings texture' },
    'خليجي حفلات': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'synth bass' },
    'خليجي أعراس': { rhythm: 'wedding festive beat', instrument: 'mirwas percussion', production: 'tabl percussion' },
    'خليجي إذاعي': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'synth lead' },
    'خليجي دانس': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'synth bass' },
    'خليجي إلكتروني': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'synth lead' },
    'خليجي سينث بوب': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'synth pad' },
    'فيوجن خليجي': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: '808 bass groove' },
    'إنجليزي بطابع خليجي': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'synth lead' },
    'خليجي آر أند بي': { rhythm: 'khaleeji groove', instrument: 'mirwas percussion', production: 'electric piano lead' },
    'خليجي فاخر': { rhythm: 'adani rhythm', instrument: 'violin lead', production: 'strings texture' },
    'خليجي سينمائي': { rhythm: 'marching anthem beat', instrument: 'strings lead', production: 'choir texture' },
    'خليجي جماهيري': { rhythm: 'marching anthem beat', instrument: 'tabl percussion', production: 'choir texture' },
    'مناسبات وطنية خليجية': { rhythm: 'marching anthem beat', instrument: 'tabl percussion', production: 'choir lead' },
    'خليجي تراثي': { rhythm: 'khaleeji groove', instrument: 'oud lead', production: 'qanun texture' },
    'شيلات': { rhythm: 'samri rhythm', instrument: 'frame drum groove', production: 'mirwas percussion' },
    'سامري': { rhythm: 'samri rhythm', instrument: 'frame drum groove', production: 'tabl percussion' },
    'جلسة': { rhythm: 'adani rhythm', instrument: 'oud lead', production: 'qanun texture' },
    'ليوان': { rhythm: 'leiwah rhythm', instrument: 'tanbura lead', production: 'mirwas percussion' },
  };

  function buildKieNegativeTags(): string {
    const negSet = new Set<string>();
    for (const tag of effectiveIncludeTags) {
      const neg = GCC_PRONUNCIATION_NEGATIVES[tag];
      if (neg) neg.split(',').map((n) => n.trim()).forEach((n) => negSet.add(n));
    }
    return [...negSet].join(', ').slice(0, 200);
  }

  function normalizeKhalijiPromptToken(value: string): string {
    // Brand rule: Khaleeji ONLY. Rewrite Khaliji and Gulf to Khaleeji everywhere the user sees.
    return (value || '')
      .replace(/\bKhaliji\b/g, 'Khaleeji')
      .replace(/\bkhaliji\b/g, 'Khaleeji')
      .replace(/\bGulf\b/g, 'Khaleeji')
      .replace(/\bgulf\b/g, 'Khaleeji');
  }

  function getKhalijiStructurePlan(targetSeconds: number) {
    const normalizedSeconds =
      targetSeconds <= 30 ? 30 :
      targetSeconds <= 60 ? 60 :
      targetSeconds <= 90 ? 90 :
      targetSeconds <= 120 ? 120 :
      targetSeconds <= 150 ? 150 : 200;

    if (normalizedSeconds === 30) {
      return {
        normalizedSeconds,
        labels: ['Mini Verse', 'Mini Chorus'],
        stanzaLimit: 2,
        allowAutoSolo: false,
        shortRoadmap: 'mini intro, mini verse lift, compact chorus payoff, button outro',
        longRoadmap: 'Intro → Mini Verse → Mini Chorus → Outro',
      };
    }

    if (normalizedSeconds === 60) {
      return {
        normalizedSeconds,
        labels: ['Verse 1', 'Pre-Chorus', 'Chorus'],
        stanzaLimit: 3,
        allowAutoSolo: false,
        shortRoadmap: 'intro, verse lift, pre-chorus rise, chorus payoff, outro',
        longRoadmap: 'Intro → Verse 1 → Pre-Chorus → Chorus → Outro',
      };
    }

    if (normalizedSeconds === 90) {
      return {
        normalizedSeconds,
        labels: ['Verse 1', 'Pre-Chorus', 'Chorus', 'Verse 2'],
        stanzaLimit: 4,
        allowAutoSolo: false,
        shortRoadmap: 'intro, verse 1, pre-chorus, chorus, verse 2, outro',
        longRoadmap: 'Intro → Verse 1 → Pre-Chorus → Chorus → Verse 2 → Outro',
      };
    }

    if (normalizedSeconds === 120) {
      return {
        normalizedSeconds,
        labels: ['Verse 1', 'Pre-Chorus', 'Chorus', 'Verse 2', 'Final Chorus'],
        stanzaLimit: 5,
        allowAutoSolo: false,
        shortRoadmap: 'intro, verse 1, pre-chorus, chorus, verse 2, final chorus, outro',
        longRoadmap: 'Intro → Verse 1 → Pre-Chorus → Chorus → Verse 2 → Final Chorus → Outro',
      };
    }

    return {
      normalizedSeconds,
      labels: ['Verse 1', 'Pre-Chorus', 'Chorus', 'Verse 2', 'Bridge', 'Final Chorus'],
      stanzaLimit: 6,
      allowAutoSolo: true,
      shortRoadmap: 'intro, verse 1, pre-chorus, chorus, verse 2, bridge, final chorus, outro',
      longRoadmap: 'Intro → Verse 1 → Pre-Chorus → Chorus → Verse 2 → Bridge → Final Chorus → Outro',
    };
  }

  function buildAutoTempoTag(style: string | null, rhythm: string | null, moods: string[], targetSeconds: number): string {
    const signal = [style ?? '', rhythm ?? '', moods.join(', '), String(targetSeconds)].join(' ').toLowerCase();
    if (signal.includes('trap') || signal.includes('drill') || signal.includes('تراب') || signal.includes('دريل')) {
      return '138 BPM tight Khaleeji trap pocket';
    }
    if (signal.includes('samri') || signal.includes('ardah') || signal.includes('march') || signal.includes('جماهيري')) {
      return '120 BPM driving Khaleeji march pulse';
    }
    if (signal.includes('wedding') || signal.includes('party') || signal.includes('حفلة') || signal.includes('أعراس') || signal.includes('clap')) {
      return '116 BPM celebratory Khaleeji swing';
    }
    if (signal.includes('luxury') || signal.includes('orchestral') || signal.includes('r&b') || signal.includes('elegant') || signal.includes('فاخر') || signal.includes('أنيق')) {
      return '82 BPM refined Khaleeji ballad';
    }
    if (signal.includes('adani') || signal.includes('ballad') || signal.includes('romantic') || signal.includes('رومانسي') || signal.includes('هادئ') || signal.includes('جلسة')) {
      return '84 BPM warm Khaleeji sway';
    }
    return targetSeconds <= 60 ? '100 BPM focused Khaleeji groove' : '104 BPM modern Khaleeji groove';
  }

  function buildAutoKeyTag(style: string | null, rhythm: string | null, moods: string[]): string {
    const signal = [style ?? '', rhythm ?? '', moods.join(', ')].join(' ').toLowerCase();
    if (signal.includes('trap') || signal.includes('rap') || signal.includes('dark') || signal.includes('مظلم')) {
      return 'C minor tonal center';
    }
    if (signal.includes('cinematic') || signal.includes('anthem') || signal.includes('epic') || signal.includes('فخور') || signal.includes('ملحمي')) {
      return 'E minor tonal center';
    }
    if (signal.includes('party') || signal.includes('celebratory') || signal.includes('happy') || signal.includes('سعيد') || signal.includes('احتفالي')) {
      return 'F major tonal center';
    }
    return 'D minor tonal center';
  }

  // ============================================================================
  // ── WAKTI RECIPE V1 — Sentence Engine ───────────────────────────────────────
  // Replaces the legacy CSV-style "styleString" with a 4-sentence natural-language
  // production brief, in Suno's preferred voice. Family-aware vocabulary, all
  // content driven by the user's chips. Keeps our negative tags + dialect lock.
  // ============================================================================
  const WAKTI_RECIPE_V1 = true;

  type KhalijiFamily = 'pop' | 'heritage' | 'urban' | 'party';

  const POP_CHIPS = new Set<string>([
    'GCC Pop','GCC Romantic','GCC Elegant','GCC R&B Pop','Luxury GCC Pop',
    'GCC Radio Pop','GCC Dance Pop','GCC Electro Pop','GCC Synth Pop',
    'English GCC Pop','Modern Khaleeji Fusion','Cinematic GCC',
    'GCC Anthem','National Event GCC',
    'Khaleeji Pop','Khaleeji Romantic','Khaleeji Elegant','Khaleeji R&B Pop',
    'Luxury Khaleeji Pop','Khaleeji Radio Pop','Khaleeji Dance Pop',
    'Khaleeji Electro Pop','Khaleeji Synth Pop','English Khaleeji Pop',
    'Khaleeji Cinematic','Khaleeji Anthem','Khaleeji National Event',
    'بوب خليجي','خليجي عصري','خليجي رومانسي','خليجي أنيق','خليجي إذاعي',
    'خليجي دانس','خليجي إلكتروني','خليجي سينث بوب','فيوجن خليجي',
    'إنجليزي بطابع خليجي','خليجي آر أند بي','خليجي فاخر','خليجي سينمائي',
    'خليجي جماهيري','مناسبات وطنية خليجية',
  ]);
  const HERITAGE_CHIPS = new Set<string>([
    'GCC Traditional','Sheilat','Samri','Jalsa','Liwa','GCC Shaabi','Zar','Ardah','GCC Wedding',
    'Khaleeji Traditional','Khaleeji Shaabi','Khaleeji Wedding',
    'خليجي تراثي','شيلات','سامري','جلسة','ليوان','شعبي خليجي','خليجي أعراس',
  ]);
  const URBAN_CHIPS = new Set<string>([
    'GCC Rap','Khaleeji Rap','Khaleeji Trap','خليجي راب',
  ]);
  const PARTY_CHIPS = new Set<string>([
    'GCC Party','Khaleeji Party','خليجي حفلات',
  ]);

  function getKhalijiFamily(chip: string | null): KhalijiFamily {
    if (!chip) return 'pop';
    if (URBAN_CHIPS.has(chip)) return 'urban';
    if (PARTY_CHIPS.has(chip)) return 'party';
    if (HERITAGE_CHIPS.has(chip)) return 'heritage';
    return 'pop';
  }

  function normalizeChipForDisplay(chip: string): string {
    return chip
      .replace(/\bGCC\b/g, 'Khaleeji')
      .replace(/\bgulf\b/gi, 'Khaleeji')
      .replace(/\bkhaliji\b/gi, 'Khaleeji');
  }

  // Family vocabulary table — drives the wording of the 4-sentence brief
  // and the section enrichers. Same chip → same words (deterministic).
  const FAMILY_VOCAB: Record<KhalijiFamily, {
    s1Prefix: string;
    arrangementAdj: string;
    vocalDelivery: string;
    vocalOrnament: string;
    productionChar: string;
    excludeTraditional: boolean;
    chorusLift: string;
    verseAdj: string;
    introScene: (insts: string[]) => string;
    outroFade: (insts: string[]) => string;
  }> = {
    pop: {
      s1Prefix: 'Modern',
      arrangementAdj: 'polished, radio-ready',
      vocalDelivery: 'vocal-forward in the mix with clean hook delivery',
      vocalOrnament: 'controlled quarter-tone ornaments on sustained notes',
      productionChar: 'Clean, premium mix with modern compression and subtle reverb',
      excludeTraditional: true,
      chorusLift: 'confident',
      verseAdj: 'sparse, melodic',
      introScene: (insts) => insts.slice(0, 2).join(' and ') || 'soft pads',
      outroFade: (insts) => insts[0] || 'pads',
    },
    heritage: {
      s1Prefix: 'Authentic',
      arrangementAdj: 'traditional Khaleeji heritage',
      vocalDelivery: 'emotive jalsa delivery, close-mic intimacy',
      vocalOrnament: 'expressive mawwal ornaments and quarter-tone microtones',
      productionChar: 'Intimate, natural acoustic mix with minimal processing',
      excludeTraditional: false,
      chorusLift: 'soulful',
      verseAdj: 'intimate, expressive',
      introScene: (insts) => insts.slice(0, 2).join(' and ') || 'oud entrance',
      outroFade: (insts) => insts[0] || 'oud',
    },
    urban: {
      s1Prefix: 'Modern Khaleeji',
      arrangementAdj: 'raw, modern urban',
      vocalDelivery: 'rhythmic flow with melodic flourishes',
      vocalOrnament: 'occasional quarter-tone vocal lifts',
      productionChar: 'Tight low-end, punchy drums, subtle auto-tune',
      excludeTraditional: true,
      chorusLift: 'hard-hitting',
      verseAdj: 'rhythmic, punchy',
      introScene: (insts) => insts.slice(0, 2).join(' and ') || '808 bass and trap drums',
      outroFade: (insts) => insts[0] || '808 bass',
    },
    party: {
      s1Prefix: 'Celebratory',
      arrangementAdj: 'full-energy, danceable Khaleeji',
      vocalDelivery: 'energetic, chant-ready hook delivery',
      vocalOrnament: 'bold quarter-tone vocal lifts',
      productionChar: 'Wide dynamic mix with prominent percussion',
      excludeTraditional: false,
      chorusLift: 'celebratory',
      verseAdj: 'rhythmic, energetic',
      introScene: (insts) => insts.slice(0, 2).join(' and ') || 'percussion entrance',
      outroFade: (insts) => insts[0] || 'percussion',
    },
  };

  // Build the 4-sentence production brief from user picks.
  // Replaces the comma-separated tag dump with natural language Suno V5.5 prefers.
  function buildKhalijiProductionBrief(opts: {
    styleChipLabel: string;
    family: KhalijiFamily;
    instruments: string[];
    primaryRhythm: string | null;
    supportingRhythms: string[];
    moods: string[];
    tempo: string;
    key: string;
  }): string {
    const v = FAMILY_VOCAB[opts.family];
    const label = normalizeChipForDisplay(opts.styleChipLabel);
    // Dedupe prefix if chip label already starts with it (e.g. "Modern Khaleeji
    // Fusion" under pop family would otherwise yield "Modern Modern Khaleeji Fusion").
    const prefixWord = v.s1Prefix.trim();
    const labelStartsWithPrefix = prefixWord.length > 0 &&
      label.toLowerCase().startsWith(prefixWord.toLowerCase());
    const s1 = labelStartsWithPrefix
      ? `${label} production.`
      : `${v.s1Prefix} ${label} production.`;

    const instList = opts.instruments.length > 0
      ? opts.instruments.join(', ')
      : 'core Khaleeji instrumentation';
    const rhythmClause = opts.primaryRhythm
      ? ` with a ${opts.primaryRhythm} driving the groove`
      : '';
    const supRhythmClause = opts.supportingRhythms.length > 0
      ? ` underneath a light ${opts.supportingRhythms.join(' and ')}`
      : '';
    const s2 = `A ${v.arrangementAdj} arrangement built around ${instList}${rhythmClause}${supRhythmClause}.`;

    // S3 — vocal sentence packed with dialect-rich keywords Suno responds to.
    // "pure Saudi-Kuwaiti-Qatari Khaleeji dialect" + "authentic desert-coastal
    // Khaleeji timbre" + "native Gulf pronunciation" + "colloquial Khaleeji
    // phrasing" recover the identity-anchor keyword density that was lost when
    // we moved from the legacy CSV style to the natural-language brief.
    const s3 = `Vocals are delivered in pure Saudi-Kuwaiti-Qatari Khaleeji dialect with authentic desert-coastal Khaleeji timbre, native Gulf pronunciation, and colloquial Khaleeji phrasing, ${v.vocalDelivery}, featuring ${v.vocalOrnament}.`;

    const moodPart = opts.moods.length > 0 ? `The mood is ${opts.moods.join(', ')}.` : '';
    // Split "{N} BPM {feel}" into two natural clauses; drop redundant "tonal center".
    const bpmMatch = opts.tempo.match(/^(\d+\s*BPM)\s*(.*)$/i);
    const cleanKey = opts.key.replace(/\s*tonal center\s*$/i, '').trim();
    const tempoPart = bpmMatch && bpmMatch[2]
      ? `Tempo sits around ${bpmMatch[1].trim()} with a ${bpmMatch[2].trim()} feel, in ${cleanKey}.`
      : `Tempo sits around ${opts.tempo} in ${cleanKey}.`;
    const productionPart = `${v.productionChar}.`;
    // Belt-and-suspenders with negative tags: explicitly exclude traditional
    // instrumentation when the user picked a modern family with no traditional
    // instruments selected.
    const hasTraditional = opts.instruments.some((i) => /oud|qanun|darbuka|riq|mirwas|hand\s*clap/i.test(i));
    const exclusion = v.excludeTraditional && !hasTraditional
      ? ' No traditional Khaleeji instrumentation — this is a modern production.'
      : '';
    const s4 = [moodPart, tempoPart, productionPart].filter(Boolean).join(' ') + exclusion;

    return [s1, s2, s3, s4].filter(Boolean).join(' ');
  }

  // Vocal character cue — ONE line at the very top of the prompt.
  // Family + gender aware. Replaces the old "[Khaleeji male vocal, …]".
  function buildVocalCharacterCue(family: KhalijiFamily, vocalType: 'male' | 'female' | 'none'): string | null {
    if (vocalType === 'none') return null;
    const cap = vocalType === 'male' ? 'male' : 'female';
    switch (family) {
      case 'pop':
        return `[Smooth polished ${cap} vocal, warm Khaleeji timbre, clean ${vocalType === 'male' ? 'hook' : 'melodic'} delivery]`;
      case 'heritage':
        return `[Warm ${cap} Khaleeji voice, traditional jalsa delivery with mawwal ornaments]`;
      case 'urban':
        return `[Confident ${cap} vocal, rhythmic Khaleeji flow with melodic flourishes]`;
      case 'party':
        return `[Energetic ${cap} Khaleeji vocal, celebratory hook delivery]`;
    }
  }

  // Section tag enricher — upgrades [Chorus] → [Chorus — full arrangement, confident lift]
  // for known structural tags. Custom user tags ([Hook Drop], [Final Whisper]) are left alone.
  function enrichSectionTag(rawTag: string, family: KhalijiFamily, instruments: string[]): string {
    const inner = rawTag.replace(/^\[|\]$/g, '').trim();
    // Already enriched (contains em-dash or colon)
    if (/[—:]/.test(inner)) return rawTag;
    const lower = inner.toLowerCase();
    const v = FAMILY_VOCAB[family];

    if (/^intro$/i.test(lower)) return `[Intro — ${v.introScene(instruments)}, soft pulse]`;
    if (/^outro$/i.test(lower)) return `[Outro — fade on ${v.outroFade(instruments)}]`;
    if (/^pre[-\s]?chorus$/i.test(lower)) return `[Pre-Chorus — build, layer pads]`;
    if (/^final\s*chorus$/i.test(lower)) return `[Final Chorus — full arrangement, ${v.chorusLift} climax]`;
    if (/^chorus$/i.test(lower)) return `[Chorus — full arrangement, ${v.chorusLift} lift]`;
    if (/^bridge$/i.test(lower)) return `[Bridge — breakdown, intimate]`;
    if (/^mini\s*verse$/i.test(lower)) return `[Mini Verse — vocal-forward, ${v.verseAdj}]`;
    if (/^mini\s*chorus$/i.test(lower)) return `[Mini Chorus — compact ${v.chorusLift} payoff]`;
    if (/^verse\s*\d*$/i.test(lower)) return `[${inner} — vocal-forward, ${v.verseAdj}]`;
    if (/^instrumental\s*solo$/i.test(lower)) return `[Instrumental Solo — ${v.outroFade(instruments)} lead]`;

    // Custom/unknown tag — respect user creativity, leave alone
    return rawTag;
  }

  function buildKhalijiControlBlock() {
    const primaryStyle = effectiveIncludeTags[0] ?? null;
    const rawStyleAnchor = primaryStyle ? (STYLE_ANCHORS[primaryStyle] ?? primaryStyle) : null;
    const styleAnchor = rawStyleAnchor ? normalizeKhalijiPromptToken(rawStyleAnchor) : null;
    const isGccStyle = primaryStyle ? GCC_KEYS.has(primaryStyle) : false;
    const gccAnchor = primaryStyle ? GCC_STYLE_ANCHORS[primaryStyle] : null;
    const selectedInstruments = instrumentTags.map((tag) => normalizeKhalijiPromptToken(tag));
    const instrumentLayer = selectedInstruments.length > 0
      ? selectedInstruments
      : isGccStyle && gccAnchor
        ? [gccAnchor.instrument, ...(gccAnchor.production ? [gccAnchor.production] : [])]
            .slice(0, 3)
            .map((tag) => normalizeKhalijiPromptToken(tag))
        : [];
    const selectedRhythms = rhythmTags.map((tag) => normalizeKhalijiPromptToken(RHYTHM_LABELS[tag] ?? tag));
    const primaryRhythm = selectedRhythms[0] ?? (gccAnchor ? normalizeKhalijiPromptToken(RHYTHM_LABELS[gccAnchor.rhythm] ?? gccAnchor.rhythm) : null);
    const supportingRhythms = primaryRhythm && selectedRhythms[0] === primaryRhythm ? selectedRhythms.slice(1) : selectedRhythms;
    const selectedMoods = moodTags.map((tag) => normalizeKhalijiPromptToken(tag));
    const structurePlan = getKhalijiStructurePlan(duration);
    const freeText = styleText.trim() ? normalizeKhalijiPromptToken(styleText.trim()) : null;
    const tempoTag = tempoOverride.trim() ? normalizeKhalijiPromptToken(tempoOverride.trim()) : buildAutoTempoTag(primaryStyle, primaryRhythm, selectedMoods, structurePlan.normalizedSeconds);
    const keyTag = keyOverride.trim() || buildAutoKeyTag(primaryStyle, primaryRhythm, selectedMoods);
    // Dedup: LOCK strings already carry "pure Khaleeji dialect" and negative tags already carry
    // "no MSA / no Egyptian / no Levantine". Keep only the country anchor here.
    const dialectLock = isGccStyle || isGccStyleSelected
      ? 'strict Saudi-Kuwaiti-Qatari dialect'
      : null;
    const styleParts = [
      styleAnchor,
      primaryRhythm,
      supportingRhythms.length > 0 ? `supporting rhythms: ${supportingRhythms.join(', ')}` : null,
      instrumentLayer.length > 0 ? `locked instruments: ${instrumentLayer.join(', ')}` : null,
      selectedMoods.length > 0 ? `mood arc: ${selectedMoods.join(', ')}` : null,
      `structure arc: ${structurePlan.shortRoadmap}`,
      `tempo: ${tempoTag}`,
      `key: ${keyTag}`,
      freeText,
      dialectLock,
    ]
      .filter((part): part is string => Boolean(part))
      .map((part) => part.trim())
      .filter((part, index, parts) => parts.indexOf(part) === index);
    const legacyStyleString = styleParts.join(', ').replace(/,\s*,/g, ',').replace(/^,|,$/g, '').trim();

    // ── WAKTI RECIPE V1 — when enabled and a Khaleeji chip is selected, swap
    // the comma-separated tag dump for a natural-language production brief.
    const family: KhalijiFamily = getKhalijiFamily(primaryStyle);
    const useRecipe = WAKTI_RECIPE_V1 && (isGccStyle || isGccStyleSelected) && Boolean(primaryStyle);
    const briefString = useRecipe
      ? buildKhalijiProductionBrief({
          styleChipLabel: primaryStyle as string,
          family,
          instruments: instrumentLayer,
          primaryRhythm,
          supportingRhythms,
          moods: selectedMoods,
          tempo: tempoTag,
          key: keyTag,
        })
      : null;
    // Append free-text + dialect lock as proper capitalized sentences so the brief
    // doesn't end in a lowercase fragment. Dialect lock becomes "Strict ... lock."
    const dialectSentence = dialectLock
      ? `${dialectLock.charAt(0).toUpperCase()}${dialectLock.slice(1)} lock.`
      : null;
    const freeTextSentence = freeText
      ? (/[.!?]$/.test(freeText.trim()) ? freeText.trim() : `${freeText.trim()}.`)
      : null;
    const briefStyleString = briefString
      ? [briefString, freeTextSentence, dialectSentence].filter(Boolean).join(' ')
      : null;
    const styleString = briefStyleString ?? legacyStyleString;
    const controlBlock = [
      'KHALIJI CONTROL BLOCK',
      primaryStyle ? `Primary style chip: ${normalizeKhalijiPromptToken(primaryStyle)}` : null,
      styleAnchor ? `Identity anchor: ${styleAnchor}` : null,
      primaryRhythm ? `Primary rhythm: ${primaryRhythm}` : null,
      supportingRhythms.length > 0 ? `Supporting rhythms: ${supportingRhythms.join(', ')}` : null,
      instrumentLayer.length > 0 ? `Locked instruments: ${instrumentLayer.join(', ')}` : null,
      selectedMoods.length > 0 ? `Mood arc: ${selectedMoods.join(', ')}` : null,
      `Structure: ${structurePlan.longRoadmap}`,
      `Tempo: ${tempoTag}`,
      `Key: ${keyTag}`,
      freeText ? `Creative brief: ${freeText}` : null,
      dialectLock ? `Dialect lock: ${dialectLock}` : null,
    ].filter(Boolean).join('\n');

    return {
      styleString,
      controlBlock,
      structurePlan: structurePlan.longRoadmap,
      tempoTag,
      keyTag,
      normalizedSeconds: structurePlan.normalizedSeconds,
      family,
      usingRecipeV1: useRecipe,
    };
  }

  function buildKieStyleString(): string {
    // ── Identity Lock Anchor — repetitive geographic reinforcement + human performance tags ──
    // Blueprint: "kuwaiti qatari, pure kuwaiti qatari dialect, authentic desert-coastal resonance,
    //             seasoned gulf vocalist timbre, [STYLE], colloquial gulf phrasing, vocal-forward,
    //             close-mic intimacy, crystal-clear vocal articulation, expressive melismatic mawwal,
    //             audible breath support, authentic gulf vocal, strict khaleeji dialect,
    //             authentic khaleeji quarter-tone scale"
    // GCC style lock — restored to the previously-working long anchor.
    // The short 5-tag variant was a regression that weakened Gulf vocal identity;
    // reverting to the original tag stack that consistently produced authentic
    // Khaleeji pronunciation before the change.
    const controlBlock = buildKhalijiControlBlock();
    return controlBlock.styleString;
  }

  // ── Heritage / Jalsa / Mawwal lock — keeps the original melismatic ornament anchor.
  //    Use for jalsa, sheilat, samri, ardah, liwa, traditional, shaabi, zar, romantic, cinematic, anthemic.
  //    Dedup: one Khaleeji timbre anchor, one dialect anchor, one quarter-tone anchor. "mawwal" is the
  //    signal the edge function uses to route to heritage persona family.
  const LOCK_HERITAGE = (style: string) =>
    `kuwaiti qatari, pure Khaleeji dialect, authentic desert-coastal resonance, seasoned Khaleeji vocalist timbre, ${style}, colloquial phrasing, vocal-forward, close-mic intimacy, crystal-clear vocal articulation, expressive melismatic mawwal, audible breath support, authentic Khaleeji quarter-tone scale`;

  // ── Pop / Dance / Electro / Trap lock — clean hooks, no mawwal, tight pop articulation.
  //    Use for radio pop, dance pop, electro pop, synth pop, fusion, english crossover, r&b pop, party, elegant, rap, trap, luxury pop.
  //    Dedup: same anchor structure as heritage, minus mawwal.
  const LOCK_POP = (style: string) =>
    `kuwaiti qatari, pure Khaleeji dialect, authentic desert-coastal resonance, modern Khaleeji vocal timbre, ${style}, colloquial phrasing, vocal-forward, clean hook delivery, tight pop articulation, controlled melisma, polished radio-ready mix, authentic Khaleeji quarter-tone scale`;

  // ── Backward-compat alias — defaults to heritage for any caller still using LOCK directly.
  const LOCK = LOCK_HERITAGE;

  const STYLE_ANCHORS: Record<string, string> = {
    'GCC Pop':               LOCK_POP('khaleeji pop'),
    'Khaleeji Pop':          LOCK_POP('khaleeji pop'),
    'GCC Rap':               LOCK_POP('khaleeji rap'),
    'GCC Party':             LOCK_POP('khaleeji pop, festive party energy'),
    'GCC Wedding':           LOCK_HERITAGE('khaleeji wedding chant, celebratory folk-pop'),
    'GCC Romantic':          LOCK_HERITAGE('khaleeji romantic ballad'),
    'GCC Elegant':           LOCK_POP('elegant khaleeji pop, refined classy delivery'),
    'GCC Radio Pop':         LOCK_POP('radio-ready khaleeji pop'),
    'GCC Dance Pop':         LOCK_POP('dance khaleeji pop'),
    'GCC Electro Pop':       LOCK_POP('electro khaleeji pop'),
    'GCC Synth Pop':         LOCK_POP('synth-driven khaleeji pop'),
    'Modern Khaleeji Fusion': LOCK_POP('modern khaleeji fusion'),
    'English GCC Pop':       LOCK_POP('english lyrics, khaleeji pop crossover'),
    'GCC R&B Pop':           LOCK_POP('khaleeji r&b pop'),
    'Luxury GCC Pop':        LOCK_POP('luxury khaleeji pop, premium orchestral, polished pop delivery'),
    'Cinematic GCC':         LOCK_HERITAGE('cinematic khaleeji, dramatic atmosphere'),
    'GCC Anthem':            LOCK_HERITAGE('khaleeji anthem, proud crowd energy'),
    'National Event GCC':    LOCK_HERITAGE('khaleeji national event anthem, ceremonial crowd energy'),
    'GCC Traditional':       LOCK_HERITAGE('khaleeji traditional, authentic folk'),
    'Sheilat':               LOCK_HERITAGE('khaleeji sheilat, strong male group vocal'),
    'Samri':                 LOCK_HERITAGE('samri folk, heritage'),
    'Jalsa':                 LOCK_HERITAGE('khaleeji jalsa, soft acoustic session'),
    'Liwa':                  LOCK_HERITAGE('liwa coastal, afro-gulf polyrhythmic'),
    'GCC Shaabi':            LOCK_HERITAGE('khaleeji shaabi, colloquial festive delivery'),
    'Zar':                   LOCK_HERITAGE('zar ritual folk, trancey khaleeji-adjacent chant'),
    'Ardah':                 LOCK_HERITAGE('ardah chant, ceremonial warrior chorus'),
    'Khaleeji Trap':         LOCK_POP('khaleeji trap, modern urban gulf delivery'),
    'بوب خليجي':             LOCK_POP('khaleeji pop'),
    'خليجي راب':             LOCK_POP('khaleeji rap'),
    'خليجي عصري':            LOCK_POP('modern khaleeji pop'),
    'خليجي حفلات':           LOCK_POP('khaleeji pop, festive party energy'),
    'خليجي أعراس':           LOCK_HERITAGE('khaleeji wedding chant, celebratory folk-pop'),
    'خليجي رومانسي':         LOCK_HERITAGE('khaleeji romantic ballad'),
    'خليجي أنيق':            LOCK_POP('elegant khaleeji pop, refined classy delivery'),
    'خليجي إذاعي':           LOCK_POP('radio-ready khaleeji pop'),
    'خليجي دانس':            LOCK_POP('dance khaleeji pop'),
    'خليجي إلكتروني':        LOCK_POP('electro khaleeji pop'),
    'خليجي سينث بوب':        LOCK_POP('synth-driven khaleeji pop'),
    'فيوجن خليجي':           LOCK_POP('modern khaleeji fusion'),
    'إنجليزي بطابع خليجي':   LOCK_POP('english lyrics, khaleeji pop crossover'),
    'خليجي آر أند بي':       LOCK_POP('khaleeji r&b pop'),
    'خليجي فاخر':            LOCK_POP('luxury khaleeji pop, premium orchestral, polished pop delivery'),
    'خليجي سينمائي':         LOCK_HERITAGE('cinematic khaleeji, dramatic atmosphere'),
    'خليجي جماهيري':         LOCK_HERITAGE('khaleeji anthem, proud crowd energy'),
    'مناسبات وطنية خليجية':  LOCK_HERITAGE('khaleeji national event anthem, ceremonial crowd energy'),
    'خليجي تراثي':           LOCK_HERITAGE('khaleeji traditional, authentic folk'),
    'شيلات':                 LOCK_HERITAGE('khaleeji sheilat, strong male group vocal'),
    'سامري':                 LOCK_HERITAGE('samri folk, heritage'),
    'جلسة':                  LOCK_HERITAGE('khaleeji jalsa, soft acoustic session'),
    'ليوان':                 LOCK_HERITAGE('liwa coastal, afro-gulf polyrhythmic'),
    'Egyptian':              'egyptian pop, cairo studio sound, authentic egyptian dialect, melodic cairo vocal delivery, modern al-jeel production',
    'Egyptian Shaabi':       'egyptian mahraganat street music, electro-shaabi rhythm, fast electronic beats 140 BPM, autotuned cairo male vocals, street vibes, baladi beats',
    'Iraqi Style':           'iraqi pop, baghdadi maqam soul, authentic baghdadi dialect, iraqi choubi rhythm, emotional iraqi phrasing, soulful iraqi resonance',
    'Lebanese Style':        'lebanese pop, beirut studio sound, authentic lebanese dialect, lebanese dabke energy, refined levantine phrasing, beirut street vibe',
    'Moroccan Style':        'maghrebi chaabi, authentic darija dialect, north african vocal resonance, gnawa fusion, maghrebi percussion, bendir, raï vocals',
    'Arabic Pop':            'modern pan-arabic pop, mainstream arab vocal, contemporary arabic fusion, polished production, studio mastered',
    'Levant Pop':            'levantine pop, shami folk fusion, shami dialect phrasing, syrian lebanese jordanian vocal identity, modern dabke pop',
    'Anasheed':              'pure a cappella human vocals, multi-layered vocal harmony, islamic nasheed, spiritual reverberant atmosphere, zero instruments, vocal-only production, [Audio Engine: Ultra-HD 96kHz], [Frequency Response: 20Hz-22kHz]',
    'مصري':                  'بوب مصري، صوت قاهري أصيل، إنتاج الجيل الحديث، أداء وجداني قاهري',
    'شعبي مصري':             'مهرجانات مصرية، موسيقى إلكترو شعبي، بيت سريع، صوت ذكوري قاهري بالتون، أجواء شارعية',
    'عراقي':                 'بوب عراقي، روح مقام بغدادي، لهجة بغدادية أصيلة، إيقاع الجوبي، تعبيرية عراقية',
    'لبناني':                'بوب لبناني، صوت بيروت، لهجة لبنانية أصيلة، روح الدبكة اللبنانية، صياغة شامية راقية',
    'مغربي':                 'شعبي مغربي، لهجة دارجة أصيلة، رنين صوتي شمال أفريقي، دمج الكناوة، إيقاع بنديري',
    'بوب عربي':              'بوب عربي حديث، صوت عربي سائد، دمج عربي معاصر، إنتاج راقٍ',
    'شامي':                  'بوب شامي، فيوجن شعبي شامي، نطق لهجة شامية، هوية صوتية سورية لبنانية أردنية، دبكة حديثة',
    'أناشيد':                'pure a cappella human vocals, multi-layered vocal harmony, islamic nasheed, spiritual reverberant atmosphere, zero instruments, vocal-only production, [Audio Engine: Ultra-HD 96kHz], [Frequency Response: 20Hz-22kHz]',
    'pop':         'modern commercial pop, chart-topping production, high-fidelity studio master, vocal-forward, radio-ready, wide stereo image, [Audio Engine: Ultra-HD 96kHz]',
    'Dance Pop':   'high-energy dance pop, club-ready production, heavy sidechain compression, driving rhythmic pulse, vocal-forward, [Audio Engine: Ultra-HD 96kHz]',
    'Teen Pop':    'youthful teen pop, catchy infectious hooks, bright glossy production, polished commercial vocal, high-energy arrangement',
    'Power Pop':   'driving power pop, melodic hooks, crunchy rhythmic guitars, high-energy drums, soaring vocal production, stadium sound',
    'Pop Rock':    'modern pop-rock fusion, stadium energy, electric guitars and acoustic textures, radio-ready vocal, polished studio master',
    'Indie Pop':   'shimmering indie pop, clean aesthetic, boutique production, soulful expressive vocal, layered guitars, wide soundstage',
    'Bubblegum Pop': 'ultra-bright bubblegum pop, sugary hooks, high-pitched energy, glossy digital production, infectious commercial vibe',
    'K-Pop':       'high-octane k-pop, intricate multi-layered vocals, experimental glossy production, futuristic sound, high-fidelity master',
    'J-Pop':       'vibrant j-pop, anime-inspired energy, complex melodic chord progressions, high-speed rhythmic drive, bright vocal mix',
    'Latin Pop':   'vibrant latin pop, rhythmic infectious energy, modern production, soulful crossover vocal, polished percussive layers',
    '80s pop':     'retro 80s pop, analog synthesizers, gated reverb drums, neon atmosphere, period-authentic commercial production',
    '90s pop':     'classic 90s pop, retro drum machines, smooth soulful textures, nostalgic commercial vocal, polished 90s studio master',
    'Synthpop':    'neon synthpop, lush analog pads, cinematic electronic production, retro-future vocal textures, atmospheric depth',
    'Electropop':  'glossy electropop, digital precision, pulsing synths, modern vocal processing, high energy, crisp electronic production',
    'R&B':               'contemporary silky r&b, soulful vocal runs, velvet production, deep groove, lush harmonies, [Audio Engine: Ultra-HD 96kHz]',
    'soul':              'vintage soul resonance, soulful gospel-influenced vocals, warm analog production, rhythmic pocket, high fidelity',
    'Neo-Soul':          'smooth neo-soul, jazz-influenced harmonies, laid-back rhythmic pocket, expressive vocal texture, organic production',
    'Contemporary R&B':  'modern melodic r&b, polished commercial production, wide stereo image, vocal-forward, intricate vocal layers',
    'Motown':            'classic motown sound, vintage 60s soul, rhythmic brass section, authentic analog warmth, retro vocal production',
    'New Jack Swing':    'swinging urban dance-pop, 90s r&b rhythm, orchestral hits, high-energy groove, polished commercial production',
    'Quiet Storm':       'sensual smooth r&b, late-night atmospheric production, soft soulful vocals, intimate mix, high fidelity',
    'Blue-eyed Soul':    'melodic blue-eyed soul, pop-soul crossover, expressive vocal clarity, polished studio master, soulful resonance',
    'Funk':              'syncopated slap bass, infectious rhythmic groove, tight brass sections, high energy funk, driving percussion',
    'disco':             '70s dancefloor disco, four-on-the-floor kick, shimmering string sections, groovy rhythmic bass, high energy',
    'hip hop':             'modern gritty hip-hop, crisp urban drums, rhythmic precision, street-level production, crystal clear vocal, [Audio Engine: Ultra-HD 96kHz]',
    'rap':                 'aggressive rap delivery, rhythmic flow, hard-hitting drum machine, punchy low-end, urban street energy',
    'Trap':                'hard-hitting trap, sliding 808s, intricate hi-hat rolls, dark cinematic atmosphere, polished urban vocals',
    'Drill':               'heavy sliding drill bass, aggressive syncopated drums, dark atmospheric pads, street-level energy, sharp vocal delivery',
    'Boom Bap':            'classic boom bap, dusty drum breaks, vinyl crackle texture, jazzy melodic samples, rhythmic head-nodding groove',
    'Conscious Hip Hop':   'thoughtful conscious hip-hop, soulful boom bap production, clear articulate vocals, jazz-infused melodic layers',
    'Gangsta Rap':         'raw gangsta rap, menacing street atmosphere, heavy low-end, aggressive delivery, cinematic urban soundscape',
    'East Coast Hip Hop':  'classic east coast boom bap, gritty sample-based production, lyrical focus, hard drums, new york street vibe',
    'West Coast Hip Hop':  'laid-back west coast g-funk, melodic synthesizer whines, deep funky bassline, smooth delivery, california sunshine vibe',
    'Southern Hip Hop':    'southern bounce, rapid hi-hats, heavy bass, soulful horn stabs, energetic club atmosphere',
    'Alternative Hip Hop': 'experimental alternative hip-hop, eclectic production, genre-bending sounds, unique vocal texture, creative rhythmic layering',
    'Cloud Rap':           'ethereal cloud rap, hazy atmospheric pads, dreamy reverb-soaked vocals, slow tempo, spaced-out production',
    'Crunk':               'high-energy crunk, distorted club beats, aggressive shouted vocals, heavy rhythmic energy, intense party vibe',
    'Afrobeats':  'lagos afro-pop, infectious rhythmic bounce, syncopated afro-percussion, vibrant melodic vocal, global fusion, [Audio Engine: Ultra-HD 96kHz]',
    'Afrobeat':   'lagos afro-pop, infectious rhythmic bounce, syncopated afro-percussion, vibrant melodic vocal, global fusion, [Audio Engine: Ultra-HD 96kHz]',
    'Reggaeton':  'san juan reggaeton, iconic dembow rhythm, heavy low-end, street-party energy, melodic urban vocal, polished studio master',
    'Latin':      'vibrant latin rhythms, explosive brass sections, high-energy percussion, passionate vocal delivery, authentic rhythmic groove',
    'Latin Rock':  'vibrant latin rhythms, explosive brass sections, high-energy percussion, passionate vocal delivery, authentic rhythmic groove',
    'Salsa':      'classic salsa dura, driving montuno piano, tight brass section, infectious polyrhythmic percussion, energetic tropical vocal',
    'Bachata':    'romantic dominican bachata, signature guitar plucking, syncopated bongo rhythm, soulful melodic vocal, intimate production',
    'Merengue':   'uptempo merengue, fast-paced accordion and tambora, driving rhythmic energy, festive tropical vocal, high-energy groove',
    'Tango':      'dramatic argentinian tango, melancholic bandoneon, sharp rhythmic staccato, passionate soulful vocal, cinematic atmosphere',
    'Samba':      'vibrant rio samba, driving batucada percussion, high-energy carnival atmosphere, melodic brazilian vocal, rhythmic celebration',
    'Cumbia':     'authentic rhythmic cumbia, traditional guiro and percussion, swaying melodic groove, folk-influenced vocal, tropical atmosphere',
    'Bossa Nova': 'sophisticated bossa nova, breezy acoustic guitar, soft intimate vocal delivery, jazz-influenced harmonies, relaxed elegant production',
    'Bollywood':  'mumbai cinematic, intricate orchestral layers, soaring playback vocals, grand bollywood production, high fidelity studio master',
    'Bhangra':    'punjabi bhangra energy, driving dhol drums, vibrant tumbi melodies, high-speed rhythmic dance, infectious punjabi vocal',
    'rock':              'modern rock anthem, electric guitar driven, driving organic drums, powerful vocal energy, studio mastered, [Audio Engine: Ultra-HD 96kHz]',
    'Classic Rock':      '70s classic rock, vintage tube-amp guitars, raw energetic drums, soulful rock vocal, analog warmth, rhythmic pocket',
    'rock and roll':     'classic 50s rock and roll, upbeat boogie-woogie rhythm, clean electric guitar, vintage production, high energy, slapback echo',
    'soft rock':         'mellow soft rock, melodic acoustic and electric guitars, smooth vocal production, clear rhythmic pocket, high fidelity',
    'Hard Rock':         'powerful hard rock, high-gain overdriven guitars, heavy hitting drums, aggressive vocal delivery, stadium sound',
    'alternative rock':  'modern alternative rock, moody guitar textures, expressive vocals, dynamic arrangement, independent spirit, wide soundstage',
    'indie rock':        'authentic indie rock, clean jangle guitars, raw vocal intimacy, boutique production, live room feel, wide stereo image',
    'Progressive Rock':  'intricate progressive rock, complex rhythmic signatures, symphonic layers, virtuosic musicianship, epic cinematic soundscape',
    'Psychedelic Rock':  'trippy psychedelic rock, fuzzy distorted guitars, swirling organ, reverb-soaked vocals, experimental atmosphere, liquid lighting vibe',
    'Garage Rock':       'raw garage rock, lo-fi grit, overdriven guitars, punchy live drums, unpolished authentic spirit, high energy',
    'Glam Rock':         'theatrical glam rock, catchy hooks, stomping rhythm, flashy guitar solos, anthemic vocal energy, shimmering production',
    'grunge':            '90s grunge, distorted muddy guitars, dynamic loud-quiet shifts, raw emotional vocals, angst-driven energy, seattle sound',
    'Britpop':           'melodic britpop, catchy guitar hooks, bright vocal production, classic UK rock energy, stadium-ready master',
    'Shoegaze':          'ethereal shoegaze, massive wall of sound, distorted shimmering guitars, buried melodic vocals, hazy atmospheric wash',
    'Post-Rock':         'cinematic post-rock, crescendo-driven, atmospheric guitar textures, grand scale, minimal vocals, epic build-up',
    'Math Rock':         'technical math rock, complex tapping guitars, irregular time signatures, clean intricate production, rhythmic precision',
    'Surf Rock':         'classic surf rock, reverb-drenched tremolo guitars, upbeat driving rhythm, vintage coastal energy, beach party vibe',
    'Dream Pop':         'lush dream pop, ethereal vocal textures, shimmering synthesizers, hazy nostalgic production, wide soundstage, airy mix',
    'heavy metal':       'classic heavy metal, high-gain tube saturation, galloping rhythmic drive, powerful melodic vocals, soaring guitar solos',
    'thrash metal':      'fast aggressive thrash metal, chugging palm-muted guitars, rapid double-kick drumming, shredded solos, high intensity',
    'Death Metal':       'brutal death metal, low-tuned guttural vocals, blast beat percussion, technical guitar proficiency, dark crushing atmosphere',
    'Black Metal':       'atmospheric black metal, raw lo-fi production, tremolo picking, shrieked vocals, cold cinematic soundscape, blast beats',
    'Power Metal':       'epic power metal, symphonic orchestrations, high-pitched operatic vocals, heroic anthemic melodies, fast-paced double-kick',
    'Doom Metal':        'heavy slow-tempo doom, massive downtuned fuzzy guitars, melancholic atmosphere, thick dragging rhythm, crushing weight',
    'Gothic Metal':      'dark gothic metal, melancholic female and male vocal contrast, symphonic keyboards, dramatic minor-key melodies',
    'Symphonic Metal':   'operatic symphonic metal, full orchestral layers, cinematic choir, soaring vocals, epic production, wide stereo image',
    'Progressive Metal': 'technical progressive metal, complex time signatures, virtuosic musicianship, shifting dynamics, intricate melodic layers',
    'Speed Metal':       'high-speed metal, rapid rhythmic precision, soaring vocals, shredding lead guitars, intense driving energy',
    'punk rock':      'raw energetic punk rock, fast three-chord progression, gritty vocal delivery, unpolished garage aesthetics, high-speed drums',
    'Pop Punk':       'upbeat melodic pop-punk, catchy vocal hooks, bright distorted guitars, energetic fast-paced drums, polished youthful production',
    'Hardcore Punk':  'aggressive hardcore punk, fast chaotic energy, shouted vocals, brief intense songs, heavy breakdowns, raw power',
    'Ska Punk':       'energetic ska-punk, upbeat horn sections, off-beat guitar skanking, driving walking bassline, high-energy dance vibe',
    'Emo':            'emotional melodic punk, expressive heartfelt vocals, dynamic quiet-loud transitions, melancholic guitar melodies',
    'Screamo':        'intense screamo, aggressive screamed vocals, technical chaotic instrumentation, emotional catharsis, rapid tempo shifts',
    'New Wave':       '80s new wave, retro synthesizers, punchy electronic drums, melodic basslines, quirky vocal production, polished neon vibe',
    'country':              'nashville country sound, twangy electric guitar, steady rhythmic pocket, heartfelt storytelling vocal, polished production',
    'Country Pop':          'modern nashville pop, glossy commercial production, catchy melodic hooks, radio-ready country vocal, high fidelity',
    'Outlaw Country':       'raw gritty country, rebellious spirit, acoustic guitar driven, weathered vocal timbre, honky tonk vibe, authentic',
    'Country Rock':         'southern rock influence, driving electric guitars, organic drums, anthemic country vocal, wide soundstage',
    'Alternative Country':  'independent roots rock, moody atmospheric textures, expressive songwriting, authentic production, raw energy',
    'Honky Tonk':           'classic honky tonk, barroom piano, crying steel guitar, shuffling rhythm, traditional country vocal, vintage vibe',
    'Western Swing':        'upbeat country swing, jazz-influenced arrangements, lively fiddle and steel guitar, danceable rhythm, festive',
    'Americana':            'authentic american roots, multi-instrumental acoustic layers, soulful storytelling, warm analog production, high fidelity',
    'Contemporary Country': 'modern commercial country, polished billboard production, strong vocal presence, crossover appeal, radio master',
    'bluegrass':            'fast-paced bluegrass, virtuosic banjo and mandolin, high lonesome vocal harmony, acoustic rhythmic drive, technical',
    'folk':                 'intimate acoustic folk, fingerstyle guitar, raw storytelling vocal, pure organic production, close-mic intimacy',
    'Indie Folk':           'atmospheric indie folk, layered acoustic textures, ethereal vocal harmonies, boutique studio production, wide soundstage',
    'Folk Rock':            'acoustic-electric fusion, driving rhythmic pulse, melodic storytelling, 60s and 70s inspired production, organic feel',
    'Folk Pop':             'catchy melodic folk, bright acoustic guitars, youthful vocal production, radio-friendly roots energy, polished',
    'Folk Punk':            'aggressive acoustic punk, high energy rhythmic drive, shouted melodic vocals, raw unpolished production, fast tempo',
    'Protest Folk':         'classic acoustic protest song, lyrical focus, simple guitar arrangement, authentic vocal conviction, raw and honest',
    'jazz':        'classic jazz, swinging upright bass, brushed kit, expressive piano voicings, intimate club atmosphere, warm analog master',
    'Bebop':       'fast bebop, rapid-fire harmonic improvisation, virtuoso horn solos, complex chord changes, swinging rhythmic drive',
    'swing':       'classic big band swing, punchy brass ensemble, walking bass, driving snare backbeat, energetic dancehall groove',
    'smooth jazz': 'lush smooth jazz, silky saxophone melody, warm electric piano, gentle groove, polished contemporary studio master',
    'Cool Jazz':   'relaxed cool jazz, modal spacious voicings, muted trumpet, brushed kit, west coast intimate atmosphere',
    'Jazz Fusion': 'electric jazz fusion, funky rhythmic interplay, complex harmonics, rhodes electric piano, studio-grade master',
    'Latin Jazz':  'vibrant latin jazz, clave-driven percussion, piano montuno, expressive horn solos, afro-cuban rhythmic energy',
    'Jazz Funk':   'groovy jazz funk, slap bass, funky rhythm guitar, punchy brass punches, expressive keys, danceable pocket groove',
    'Hard Bop':    'bluesy hard bop, gospel-influenced phrasing, driving rhythm section, expressive horn work, east coast jazz energy',
    'Acid Jazz':   'eclectic acid jazz, funky hip-hop influenced drums, rhodes piano, jazz harmonics, loose swinging groove',
    'Free Jazz':   'experimental free jazz, atonal improvisation, expressive dissonance, free rhythmic exploration, avant-garde energy',
    'Big Band':    'cinematic big band, full brass and reed section, swinging rhythm, powerful orchestral jazz energy, wide soundstage',
    'blues':          'classic blues, expressive guitar bends, soulful vocal phrasing, walking bass, authentic twelve-bar groove',
    'delta blues':    'raw delta blues, resonator slide guitar, lonely vocal delivery, sparse rhythmic stomp, authentic mississippi roots',
    'Chicago Blues':  'electric chicago blues, biting electric guitar, harmonica wail, tight rhythm section, urban blues energy',
    'Electric Blues': 'modern electric blues, overdriven guitar tone, expressive soulful vocal, driving rhythm section, polished studio master',
    'Blues Rock':     'powerful blues rock, heavy distorted guitar, screaming vocal, thunderous drum kit, electrifying energy',
    'Texas Blues':    'texas blues, stinging guitar tone, confident expressive vibrato, driving shuffle rhythm, soulful vocal delivery',
    'Memphis Blues':  'memphis blues, soulful horn section, expressive guitar, warm analog production, deep groove pocket rhythm',
    'Jump Blues':     'energetic jump blues, punchy brass riffs, walking bass, swinging backbeat, joyful expressive vocal delivery',
    'Boogie-Woogie':  'rollicking boogie-woogie, rolling piano bass patterns, upbeat syncopated rhythm, joyful high-energy delivery',
    'Country Blues':  'acoustic country blues, fingerpicked guitar, storytelling vocal, raw minimal production, authentic southern roots',
    'reggae':        'classic jamaican reggae, offbeat skank guitar, deep sub-bass groove, roots rhythmic production, soulful vocal delivery',
    'Roots Reggae':  'spiritual roots reggae, conscious bass-heavy groove, righteous vocal message, warm analog production, jamaican authenticity',
    'Dancehall':     'modern dancehall, digital riddim drum pattern, energetic deejay vocal, bass-forward club production, high energy',
    'ska':           'classic jamaican ska, choppy offbeat guitar, punchy brass section, upbeat walking bass, vintage 60s island energy',
    'dub':           'cavernous dub, deep echo and reverb processing, stripped bass and drum emphasis, psychedelic space production',
    'Reggae Fusion': 'modern reggae fusion, blended electric guitar, contemporary crossover production, melodic vocal hooks, polished master',
    'Lovers Rock':   'smooth lovers rock, romantic melodic vocal, gentle syncopated reggae groove, warm intimate studio production',
    'Ragga':         'digital ragga, computerized dancehall riddim, rapid-fire deejay vocal, electronic bass production, high energy',
    'classical':              'refined classical, precise orchestral arrangement, full dynamic range, authentic period instrumentation, concert hall acoustic',
    'Baroque':                'ornate baroque, harpsichord continuo, intricate counterpoint, period string ensemble, precise articulation, academic fidelity',
    'Romantic':               'lush romantic orchestral, sweeping string melodies, grand dynamic range, deep emotional depth, full symphonic production',
    'Contemporary Classical': 'modern contemporary classical, extended techniques, complex harmonic language, studio-mastered orchestral production',
    'Symphony':               'grand symphony, full orchestral forces, dramatic dynamic contrasts, concert hall ambience, epic cinematic production',
    'Opera':                  'powerful opera, soaring operatic vocals, full orchestral accompaniment, dramatic theatrical production, wide dynamic range',
    'Chamber Music':          'intimate chamber music, refined small ensemble, precise interplay, transparent acoustic resonance, high fidelity',
    'Choral':                 'majestic choral, layered vocal harmony, resonant reverb, emotional dynamic range, concert hall atmosphere',
    'Gregorian Chant':        'sacred gregorian chant, unison plainchant vocal, natural reverberant acoustic, meditative spiritual atmosphere',
    'Flamenco':  'passionate flamenco, expressive nylon guitar rasgueado, percussive footwork, soulful cante vocal, raw andalusian spirit',
    'Fado':      'melancholic portuguese fado, intimate portuguese guitar, saudade vocal expression, intimate club atmosphere, warm analog production',
    'Celtic':    'vibrant celtic, driving fiddle and tin whistle, rhythmic bodhran, melodic folk vocal, authentic irish and scottish spirit',
    'gospel':    'powerful gospel, call-and-response choir, hammond organ, soulful preacher vocal, uplifting spiritual energy, high fidelity',
    'Ragtime':   'classic ragtime, syncopated upright piano, bouncy rhythmic patterns, vintage 1900s production, joyful high energy',
    'Zydeco':    'lively louisiana zydeco, accordion-driven melody, rubboard percussion, driving rhythm, infectious creole dance energy',
    'Cajun':     'authentic cajun, acoustic fiddle, two-step rhythm, heartfelt french-louisiana vocal, warm bayou atmosphere',
    'Industrial': 'harsh industrial, distorted mechanized rhythms, aggressive noise textures, dark dystopian atmosphere, abrasive production',
    'Lo-Fi':         'nostalgic lo-fi hip-hop, vinyl crackle, mellow boom bap beat, warm tape saturation, chill atmospheric production',
    'House':         'classic house, four-on-the-floor kick, warm soulful vocal chops, deep bass groove, club-ready production, [Audio Engine: Ultra-HD 96kHz]',
    'Deep House':    'deep house, warm sub-bass, soulful vocal pads, minimal groove, late-night atmospheric production',
    'Tech House':    'driving tech house, punchy kick, hypnotic percussion loops, minimal bassline, peak-time club energy',
    'Trance':        'euphoric trance, soaring synth melodies, powerful build-ups and drops, driving 138 BPM, stadium energy',
    'Techno':        'raw techno, industrial kick drum, hypnotic repetitive groove, dark atmospheric pads, berlin club energy',
    'Dubstep':       'heavy dubstep, massive wobble bass, half-time rhythm, energetic build and drop, powerful sound design',
    'Drum & Bass':   'fast drum and bass, rapid amen break, deep rolling bassline, energetic 170 BPM, electronic production',
      'EDM':           'anthemic EDM, massive build-up, euphoric synth drop, stadium-ready production, [Audio Engine: Ultra-HD 96kHz]',
      'Electro':       'classic electro, robotic drum machine, futuristic synth bass, vocoder vocal, tight mechanical groove',
      'Hardcore':      'intense hardcore, distorted kick, aggressive synth stabs, frenetic 180+ BPM, maximum energy production',
      'IDM':           'experimental IDM, complex glitch rhythms, intricate sound design, abstract production, cerebral listening experience',
      'ambient':       'immersive ambient, layered atmospheric pads, evolving textures, wide stereo field, deeply cinematic production',
      'synthwave':     'retro synthwave, neon analog pads, gated reverb drums, cinematic 80s production, nostalgic futurism',
      'chillwave':     'dreamy chillwave, hazy lo-fi production, nostalgic synth textures, warm tape compression, hypnotic groove',
      'Vaporwave':     'surreal vaporwave, slowed vintage samples, heavy reverb processing, nostalgic 80s-90s aesthetic, dreamy production',
      'Glitch':        'abstract glitch, fragmented stuttering sound design, complex digital rhythms, experimental production, textural complexity',
      'Witch House':   'dark witch house, distorted 808 bass, occult lo-fi production, eerie atmospheric pads, hypnotic slow groove',
      'Grime':         'aggressive grime, dark synth stabs, rapid 140 BPM, gritty MC vocal delivery, london urban energy',
      'UK Garage':     'classic uk garage, syncopated shuffled beat, pitched vocal chops, warm bass, late 90s london club energy',
      '2-Step':        '2-step garage, skippy syncopated rhythm, lush vocal samples, deep sub-bass, uk dance energy',
      'Electro Swing': 'playful electro swing, vintage jazz samples blended with modern beats, bouncy rhythm, fun energetic production',
      'Chiptune':      '8-bit chiptune, retro video game sound design, precise melodic square waves, bright energetic production',
    };
    const GCC_KEYS = new Set(Object.keys(STYLE_ANCHORS).filter(
      (k) => ![
        'Egyptian','Egyptian Shaabi','Arabic Pop','Levant Pop','Anasheed',
        'Iraqi Style','Lebanese Style','Moroccan Style',
        'مصري','شعبي مصري','عراقي','لبناني','مغربي','بوب عربي','شامي','أناشيد',
        // ── Global Pop (excluded from GCC pipeline) ──
        'pop','Dance Pop','Teen Pop','Power Pop','Pop Rock','Indie Pop',
        'Bubblegum Pop','K-Pop','J-Pop','Latin Pop','80s pop','90s pop','Synthpop','Electropop',
        // ── R&B / Soul / Funk (excluded from GCC pipeline) ──
        'R&B','soul','Neo-Soul','Contemporary R&B','Motown','New Jack Swing','Quiet Storm','Blue-eyed Soul','Funk','disco',
        // ── Hip-Hop / Rap (excluded from GCC pipeline) ──
        'hip hop','rap','Trap','Drill','Boom Bap',
        'Conscious Hip Hop','Gangsta Rap','East Coast Hip Hop','West Coast Hip Hop',
        'Southern Hip Hop','Alternative Hip Hop','Cloud Rap','Crunk',
        // ── Urban / World (excluded from GCC pipeline) ──
        'Afrobeats','Afrobeat','Reggaeton','Latin','Latin Rock','Salsa','Bachata',
        'Merengue','Tango','Samba','Cumbia','Bossa Nova','Bollywood','Bhangra',
        // ── Rock (excluded from GCC pipeline) ──
        'rock','Classic Rock','rock and roll','soft rock','Hard Rock','alternative rock',
        'indie rock','Progressive Rock','Psychedelic Rock','Garage Rock','Glam Rock',
        'grunge','Britpop','Shoegaze','Post-Rock','Math Rock','Surf Rock','Dream Pop',
        // ── Metal (excluded from GCC pipeline) ──
        'heavy metal','thrash metal','Death Metal','Black Metal','Power Metal','Doom Metal',
        'Gothic Metal','Symphonic Metal','Progressive Metal','Speed Metal',
        // ── Punk (excluded from GCC pipeline) ──
        'punk rock','Pop Punk','Hardcore Punk','Ska Punk','Emo','Screamo','New Wave',
        // ── Roots / Americana (excluded from GCC pipeline) ──
        'country','Country Pop','Outlaw Country','Country Rock','Alternative Country','Honky Tonk',
        'Western Swing','Americana','Contemporary Country','bluegrass','folk',
        'Indie Folk','Folk Rock','Folk Pop','Folk Punk','Protest Folk',
        // ── Jazz (excluded from GCC pipeline) ──
        'jazz','Bebop','swing','smooth jazz','Cool Jazz','Jazz Fusion','Latin Jazz',
        'Jazz Funk','Hard Bop','Acid Jazz','Free Jazz','Big Band',
        // ── Blues (excluded from GCC pipeline) ──
        'blues','delta blues','Chicago Blues','Electric Blues','Blues Rock','Texas Blues',
        'Memphis Blues','Jump Blues','Boogie-Woogie','Country Blues',
        // ── Reggae (excluded from GCC pipeline) ──
        'reggae','Roots Reggae','Dancehall','ska','dub','Reggae Fusion','Lovers Rock','Ragga',
        // ── Classical / Orchestral (excluded from GCC pipeline) ──
        'classical','Baroque','Romantic','Contemporary Classical','Symphony','Opera','Chamber Music','Choral','Gregorian Chant',
        // ── World misc (excluded from GCC pipeline) ──
        'Flamenco','Fado','Celtic','gospel','Ragtime','Zydeco','Cajun','Industrial',
        // ── Electronic / Dance (excluded from GCC pipeline) ──
        'Lo-Fi','House','Deep House','Tech House','Trance','Techno','Dubstep','Drum & Bass',
        'EDM','Electro','Hardcore','IDM','ambient','synthwave','chillwave','Vaporwave',
        'Glitch','Witch House','Grime','UK Garage','2-Step','Electro Swing','Chiptune',
      ].includes(k)
    ));
    // ── Rhythm chip → compact label ──
    const RHYTHM_LABELS: Record<string, string> = {
      'Khaleeji Groove': 'khaleeji groove',
      'Khaleeji Shuffle': 'khaleeji shuffle',
      'Adani': 'adani rhythm',
      'Samri Rhythm': 'samri rhythm',
      'Wedding Beat': 'wedding beat',
      'Clap-Driven Groove': 'clap groove',
      '6/8 Fusion': '6/8 fusion',
      'Afro-Khaleeji Groove': 'afro-khaleeji groove',
      'Pop 4/4': 'pop 4/4',
      'Ballad Slow Groove': 'slow ballad',
      'Marching Anthem': 'marching anthem',
      'Club Beat': 'club beat',
      'Leiwah Rhythm': 'leiwah rhythm',
      'Maqsoum': 'maqsoum',
      'Waltz 3/4': 'waltz 3/4',
      'Trap Beat': 'trap beat',
      'Drill Beat': 'drill beat',
      'إيقاع خليجي': 'إيقاع خليجي',
      'خليجي متمايل': 'خليجي متمايل',
      'عدني': 'إيقاع عدني',
      'إيقاع أعراس': 'إيقاع أفراح',
      'إيقاع تصفيق': 'إيقاع تصفيق',
      '٦/٨ فيوجن': '٦/٨ فيوجن',
      'أفرو خليجي': 'أفرو خليجي',
      'بوب ٤/٤': 'بوب ٤/٤',
      'بالاد هادئ': 'بالاد هادئ',
      'بدون إيقاع': 'بدون إيقاع',
      'إيقاع الليوان': 'إيقاع الليوان',
      'مقسوم': 'مقسوم',
      'والتز ٣/٤': 'والتز ٣/٤',
      'تراب بيت': 'تراب بيت',
      'دريل بيت': 'دريل بيت',
      'إيقاع جماهيري': 'إيقاع جماهيري',
      'إيقاع نادي': 'إيقاع نادي',
      'سامري': 'إيقاع سامري',
      'None': 'no beat, free-tempo vocal flow',
    };

  // ── Metatag Injector: wraps raw lyrics in Suno V5 structural brackets ──
  //    Suno format: ONE short vocal cue above [Intro] (not per stanza). Matches working
  //    community examples like [Deep raspy voice] / [male vocals] — emitted once only.
  function formatLyricsWithStructure(
    rawLyrics: string,
    isInstrumental: boolean,
    selectedInstruments: string[],
    isGccStyle: boolean = false,
    targetSeconds: number = 30,
    vocalType: 'male' | 'female' | 'none' = 'none',
    primaryStyleAnchor: string = '',
    family: KhalijiFamily = 'pop',
  ): string {
    if (isInstrumental) {
      return '[Intro]\n[Instrumental Build]\n[Drop]\n[Outro]';
    }

    const text = rawLyrics.trim();
    if (!text) return text;

    const useRecipe = WAKTI_RECIPE_V1 && isGccStyle;

    // ── Vocal character cue (top of prompt) ──
    // Recipe v1: family + gender aware ("[Smooth polished female vocal, …]").
    // Legacy:   short Khaleeji cue based on heritage/pop heuristic.
    const recipeCue: string | null = useRecipe ? buildVocalCharacterCue(family, vocalType) : null;
    const isHeritage = /mawwal/i.test(primaryStyleAnchor);
    const flavor = isHeritage ? 'warm jalsa delivery' : 'clean hook delivery';
    const genderWord = vocalType === 'female' ? 'female' : vocalType === 'male' ? 'male' : '';
    const legacyCue: string | null = isGccStyle && !useRecipe
      ? (genderWord ? `[Khaleeji ${genderWord} vocal, ${flavor}]` : `[Khaleeji vocal, ${flavor}]`)
      : null;
    const vocalCue = recipeCue ?? legacyCue;

    // ── Path A: User already wrote structural brackets ──
    // Don't bail. Enrich known structural tags in place (Recipe v1 only),
    // and inject the vocal cue at the top if not already present.
    if (/[\[(]\s*\w/.test(text)) {
      let enriched = text;
      if (useRecipe) {
        enriched = enriched.replace(/\[([^\]\n]+)\]/g, (full) => enrichSectionTag(full, family, selectedInstruments));
      }
      if (vocalCue) {
        const firstLine = enriched.split('\n').find((l) => l.trim().length > 0) ?? '';
        const alreadyHasCue = /\[[^\]]*vocal[^\]]*\]/i.test(firstLine) || /\[[^\]]*voice[^\]]*\]/i.test(firstLine);
        if (!alreadyHasCue) {
          enriched = `${vocalCue}\n\n${enriched}`;
        }
      }
      return enriched;
    }

    // ── Path B: Unstructured lyrics — auto-build structure from duration plan ──
    const stanzas = text
      .split(/\n{2,}/)
      .map((stanza) => stanza
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !/^[\-‐‑‒–—―⸺⸻_~•·]+$/.test(line))
        .join('\n')
        .trim())
      .filter(Boolean);
    const structurePlan = getKhalijiStructurePlan(targetSeconds);
    const arrangedStanzas = stanzas.slice(0, structurePlan.stanzaLimit);

    const soloTag: string | null = structurePlan.allowAutoSolo && arrangedStanzas.length >= structurePlan.stanzaLimit && selectedInstruments.length > 0 && !selectedInstruments.every((inst) => inst === 'Vocal Harmony' || inst === 'group chant')
      ? (useRecipe ? enrichSectionTag('[Instrumental Solo]', family, selectedInstruments) : '[Instrumental Solo]')
      : null;

    const labels = structurePlan.labels;
    const structured: string[] = [];
    if (vocalCue) structured.push(vocalCue);

    const introTag = useRecipe ? enrichSectionTag('[Intro]', family, selectedInstruments) : '[Intro]';
    structured.push(introTag);

    arrangedStanzas.forEach((stanza, i) => {
      const baseLabelText = labels[i] ?? `Verse ${i + 1}`;
      const baseLabel = useRecipe
        ? enrichSectionTag(`[${baseLabelText}]`, family, selectedInstruments)
        : `[${baseLabelText}]`;
      structured.push(`${baseLabel}\n${stanza}`);
    });

    if (soloTag) structured.push(soloTag);
    const hasOutro = structured.some((s) => /^\[Outro\b/.test(s));
    if (!hasOutro) {
      const outroTag = useRecipe ? enrichSectionTag('[Outro]', family, selectedInstruments) : '[Outro]';
      structured.push(outroTag);
    }

    return structured.join('\n\n');
  }

  const handleGenerate = async () => {
    if (overLimit) return;
    if (!title.trim()) {
      toast.error(isAr ? 'العنوان مطلوب' : 'Title is required');
      setTitleOpen(true);
      setMusicStyleOpen(false);
      setVocalsOpen(false);
      setLyricsOpen(false);
      return;
    }
    if (vocalType !== 'none' && !lyricsText.trim()) {
      toast.error(isAr ? 'الكلمات مطلوبة أو اختر موسيقى بدون كلمات' : 'Lyrics are required, or choose Instrumental');
      setTitleOpen(false);
      setMusicStyleOpen(false);
      setVocalsOpen(false);
      setLyricsOpen(true);
      return;
    }
    setSubmitting(true);
    setGeneratedTracks([]);
    setLastError(null);
    setLastNotice(null);

    try {
      if (!user) throw new Error('Not authenticated');

      const { data: quotaCheck, error: quotaError } = await (supabase as any).rpc('can_generate_music');
      if (quotaError) throw quotaError;

      if (!quotaCheck?.can_generate) {
        const used = quotaCheck?.generated || 0;
        const limit = quotaCheck?.limit || 5;
        toast.error(
          language === 'ar'
            ? `لقد وصلت إلى الحد الأقصى: ${used} من ${limit} أغاني هذا الشهر`
            : `Monthly limit reached: ${used} of ${limit} songs this month`
        );
        setSubmitting(false);
        return;
      }

      const instrumental = vocalType === 'none';
      const vocalGender: 'm' | 'f' | undefined =
        vocalType === 'male' ? 'm' : vocalType === 'female' ? 'f' : undefined;
      const khalijiControlBlock = buildKhalijiControlBlock();
      const kieStyle = khalijiControlBlock.styleString;
      const durationTarget = Math.min(200, duration);

      const rawLyrics = lyricsText.trim() || styleText.trim();
      const primaryStyleForCue = effectiveIncludeTags[0] ? (STYLE_ANCHORS[effectiveIncludeTags[0]] ?? '') : '';
      const cueVocal: 'male' | 'female' | 'none' = vocalType === 'male' || vocalType === 'female' ? vocalType : 'none';
      const structuredPrompt = formatLyricsWithStructure(
        rawLyrics,
        instrumental,
        instrumentTags,
        isGccStyleSelected,
        durationTarget,
        cueVocal,
        primaryStyleForCue,
        khalijiControlBlock.family,
      );

      // ── Negative shield: regional conditional first, GCC Morocco-Killer default (untouched) ──
      const REGIONAL_NEGATIVE: Record<string, string> = {
        // ── Egyptian (Shaabi & Pop) ──
        'Egyptian':        'khaleeji, gulf, moroccan, maghrebi, darija, levantine, shami, iraqi, fusha, msa, noise, hiss, low quality, distorted',
        'Egyptian Shaabi': 'khaleeji, gulf, moroccan, maghrebi, darija, levantine, shami, iraqi, fusha, msa, noise, hiss, low quality, distorted',
        'مصري':            'خليجي, خليج, مغربي, دارجة, شامي, عراقي, فصحى, noise, hiss, low quality, distorted',
        'شعبي مصري':       'خليجي, خليج, مغربي, دارجة, شامي, عراقي, فصحى, noise, hiss, low quality, distorted',
        'Anasheed':        'instruments, music, drums, synth, bass, guitar, piano, electronic, percussion, strings, beat, [Exclude: 300Hz-500Hz mud, boxiness, frequency masking], noise, hiss, low quality, distorted',
        'أناشيد':          'instruments, music, drums, synth, bass, guitar, piano, electronic, percussion, strings, beat, [Exclude: 300Hz-500Hz mud, boxiness, frequency masking], noise, hiss, low quality, distorted',
        // ── Iraqi ──
        'Iraqi Style':     'egyptian, levantine, shami, moroccan, maghrebi, darija, khaleeji, gulf, fusha, msa, noise, hiss, low quality, distorted',
        'عراقي':           'مصري, شامي, مغربي, دارجة, خليجي, فصحى, noise, hiss, low quality, distorted',
        // ── Lebanese / Levant ──
        'Lebanese Style':  'khaleeji, gulf, egyptian, moroccan, maghrebi, darija, iraqi, fusha, msa, noise, hiss, low quality, distorted',
        'Levant Pop':      'khaleeji, gulf, egyptian, moroccan, maghrebi, darija, iraqi, fusha, msa, noise, hiss, low quality, distorted',
        'لبناني':          'خليجي, خليج, مصري, مغربي, دارجة, عراقي, فصحى, noise, hiss, low quality, distorted',
        'شامي':            'خليجي, خليج, مصري, مغربي, دارجة, عراقي, فصحى, noise, hiss, low quality, distorted',
        // ── Moroccan ──
        'Moroccan Style':  'khaleeji, gulf, egyptian, levantine, shami, iraqi, fusha, msa, noise, hiss, low quality, distorted',
        'مغربي':           'خليجي, خليج, مصري, شامي, عراقي, فصحى, noise, hiss, low quality, distorted',
        // ── R&B / Soul / Funk shield ──
        'R&B':              'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'soul':             'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Neo-Soul':         'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Contemporary R&B': 'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Motown':           'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'New Jack Swing':   'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Quiet Storm':      'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Blue-eyed Soul':   'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Funk':             'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'disco':            'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        // ── Hip-Hop / Rap shield ──
        'hip hop':             'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'rap':                 'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Trap':                'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Drill':               'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Boom Bap':            'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Conscious Hip Hop':   'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Gangsta Rap':         'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'East Coast Hip Hop':  'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'West Coast Hip Hop':  'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Southern Hip Hop':    'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Alternative Hip Hop': 'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Cloud Rap':           'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Crunk':               'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        // ── Urban / World shield ──
        'Afrobeats':  'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Afrobeat':   'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Reggaeton':  'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Latin':      'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Latin Rock':  'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Salsa':      'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Bachata':    'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Merengue':   'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Tango':      'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Samba':      'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Cumbia':     'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Bossa Nova': 'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Bollywood':  'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Bhangra':    'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        // ── Electronic / Dance shield ──
        'Lo-Fi':         'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'House':         'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Deep House':    'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Tech House':    'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Trance':        'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Techno':        'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Dubstep':       'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Drum & Bass':   'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'EDM':           'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Electro':       'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Hardcore':      'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'IDM':           'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'ambient':       'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'synthwave':     'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'chillwave':     'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Vaporwave':     'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Glitch':        'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Witch House':   'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Grime':         'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'UK Garage':     'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        '2-Step':        'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Electro Swing': 'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Chiptune':      'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        // ── Classical shield ──
        'classical':              'electronic, drums, synth, bass, modern pop, distorted, hiss, noise, low quality, muddy, static',
        'Baroque':                'electronic, drums, synth, bass, modern pop, distorted, hiss, noise, low quality, muddy, static',
        'Romantic':               'electronic, drums, synth, bass, modern pop, distorted, hiss, noise, low quality, muddy, static',
        'Contemporary Classical': 'electronic, drums, synth, bass, modern pop, distorted, hiss, noise, low quality, muddy, static',
        'Symphony':               'electronic, drums, synth, bass, modern pop, distorted, hiss, noise, low quality, muddy, static',
        'Opera':                  'electronic, drums, synth, bass, modern pop, distorted, hiss, noise, low quality, muddy, static',
        'Chamber Music':          'electronic, drums, synth, bass, modern pop, distorted, hiss, noise, low quality, muddy, static',
        'Choral':                 'electronic, drums, synth, bass, modern pop, distorted, hiss, noise, low quality, muddy, static',
        'Gregorian Chant':        'electronic, drums, synth, bass, modern pop, distorted, hiss, noise, low quality, muddy, static',
        // ── World misc shield ──
        'Flamenco':  'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Fado':      'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Celtic':    'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'gospel':    'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Ragtime':   'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Zydeco':    'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Cajun':     'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Industrial': 'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        // ── Jazz shield ──
        'jazz':        'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Bebop':       'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'swing':       'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'smooth jazz': 'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Cool Jazz':   'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Jazz Fusion': 'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Latin Jazz':  'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Jazz Funk':   'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Hard Bop':    'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Acid Jazz':   'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Free Jazz':   'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Big Band':    'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        // ── Blues shield ──
        'blues':          'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'delta blues':    'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Chicago Blues':  'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Electric Blues': 'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Blues Rock':     'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Texas Blues':    'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Memphis Blues':  'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Jump Blues':     'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Boogie-Woogie':  'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Country Blues':  'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        // ── Reggae shield ──
        'reggae':        'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Roots Reggae':  'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Dancehall':     'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'ska':           'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'dub':           'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Reggae Fusion': 'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Lovers Rock':   'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        'Ragga':         'hiss, noise, distorted, low quality, muddy, amateur recording, static, background hum',
        // ── Roots / Americana shield ──
        'country':              'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum, autotune',
        'Country Pop':          'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum, autotune',
        'Outlaw Country':       'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum, autotune',
        'Country Rock':         'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum, autotune',
        'Alternative Country':  'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum, autotune',
        'Honky Tonk':           'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum, autotune',
        'Western Swing':        'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum, autotune',
        'Americana':            'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum, autotune',
        'Contemporary Country': 'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum, autotune',
        'bluegrass':            'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum, autotune',
        'folk':                 'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum, autotune',
        'Indie Folk':           'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum, autotune',
        'Folk Rock':            'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum, autotune',
        'Folk Pop':             'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum, autotune',
        'Folk Punk':            'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum, autotune',
        'Protest Folk':         'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum, autotune',
        // ── Metal shield ──
        'heavy metal':       'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'thrash metal':      'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Death Metal':       'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Black Metal':       'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Power Metal':       'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Doom Metal':        'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Gothic Metal':      'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Symphonic Metal':   'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Progressive Metal': 'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Speed Metal':       'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        // ── Punk shield ──
        'punk rock':      'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Pop Punk':       'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Hardcore Punk':  'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Ska Punk':       'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Emo':            'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'Screamo':        'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        'New Wave':       'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static, background hum',
        // ── Rock shield ──
        'rock':             'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'Classic Rock':     'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'rock and roll':    'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'soft rock':        'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'Hard Rock':        'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'alternative rock': 'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'indie rock':       'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'Progressive Rock': 'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'Psychedelic Rock': 'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'Garage Rock':      'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'Glam Rock':        'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'grunge':           'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'Britpop':          'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'Shoegaze':         'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'Post-Rock':        'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'Math Rock':        'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'Surf Rock':        'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        'Dream Pop':        'hiss, noise, digital distortion, clipping, muddy low-end, amateur recording, static',
        // ── Global Pop shield ──
        'pop':           'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Dance Pop':     'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Teen Pop':      'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Power Pop':     'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Pop Rock':      'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Indie Pop':     'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Bubblegum Pop': 'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'K-Pop':         'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'J-Pop':         'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Latin Pop':     'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        '80s pop':       'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        '90s pop':       'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Synthpop':      'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
        'Electropop':    'hiss, noise, distorted, low quality, muddy, amateur recording, muffled, static, background hum',
      };
      const isAnasheedStyle = effectiveIncludeTags.some((tag) => tag === 'Anasheed' || tag === 'أناشيد');
      const POP_KEYS = new Set(['pop','Dance Pop','Teen Pop','Power Pop','Pop Rock','Indie Pop','Bubblegum Pop','K-Pop','J-Pop','Latin Pop','80s pop','90s pop','Synthpop','Electropop']);
      const isPopStyle = effectiveIncludeTags.some((tag) => POP_KEYS.has(tag));
      const URBAN_KEYS = new Set(['R&B','soul','Neo-Soul','Contemporary R&B','Motown','New Jack Swing','Quiet Storm','Blue-eyed Soul','Funk','disco','hip hop','rap','Trap','Drill','Boom Bap','Conscious Hip Hop','Gangsta Rap','East Coast Hip Hop','West Coast Hip Hop','Southern Hip Hop','Alternative Hip Hop','Cloud Rap','Crunk','Afrobeats','Afrobeat','Reggaeton','Latin','Latin Rock','Salsa','Bachata','Merengue','Tango','Samba','Cumbia','Bossa Nova','Bollywood','Bhangra']);
      const isUrbanStyle = effectiveIncludeTags.some((tag) => URBAN_KEYS.has(tag));
      const ROCK_KEYS = new Set(['rock','Classic Rock','rock and roll','soft rock','Hard Rock','alternative rock','indie rock','Progressive Rock','Psychedelic Rock','Garage Rock','Glam Rock','grunge','Britpop','Shoegaze','Post-Rock','Math Rock','Surf Rock','Dream Pop']);
      const isRockStyle = effectiveIncludeTags.some((tag) => ROCK_KEYS.has(tag));
      const METAL_KEYS = new Set(['heavy metal','thrash metal','Death Metal','Black Metal','Power Metal','Doom Metal','Gothic Metal','Symphonic Metal','Progressive Metal','Speed Metal']);
      const isMetalStyle = effectiveIncludeTags.some((tag) => METAL_KEYS.has(tag));
      const PUNK_KEYS = new Set(['punk rock','Pop Punk','Hardcore Punk','Ska Punk','Emo','Screamo','New Wave']);
      const isPunkStyle = effectiveIncludeTags.some((tag) => PUNK_KEYS.has(tag));
      const ROOTS_KEYS = new Set(['country','Country Pop','Outlaw Country','Country Rock','Alternative Country','Honky Tonk','Western Swing','Americana','Contemporary Country','bluegrass','folk','Indie Folk','Folk Rock','Folk Pop','Folk Punk','Protest Folk']);
      const isRootsStyle = effectiveIncludeTags.some((tag) => ROOTS_KEYS.has(tag));
      const JAZZ_BLUES_KEYS = new Set(['jazz','Bebop','swing','smooth jazz','Cool Jazz','Jazz Fusion','Latin Jazz','Jazz Funk','Hard Bop','Acid Jazz','Free Jazz','Big Band','blues','delta blues','Chicago Blues','Electric Blues','Blues Rock','Texas Blues','Memphis Blues','Jump Blues','Boogie-Woogie','Country Blues']);
      const isJazzBluesStyle = effectiveIncludeTags.some((tag) => JAZZ_BLUES_KEYS.has(tag));
      const REGGAE_KEYS = new Set(['reggae','Roots Reggae','Dancehall','ska','dub','Reggae Fusion','Lovers Rock','Ragga']);
      const isReggaeStyle = effectiveIncludeTags.some((tag) => REGGAE_KEYS.has(tag));
      const CLASSICAL_KEYS = new Set(['classical','Baroque','Romantic','Contemporary Classical','Symphony','Opera','Chamber Music','Choral','Gregorian Chant']);
      const isClassicalStyle = effectiveIncludeTags.some((tag) => CLASSICAL_KEYS.has(tag));
      const WORLD_MISC_KEYS = new Set(['Flamenco','Fado','Celtic','gospel','Ragtime','Zydeco','Cajun','Industrial']);
      const isWorldMiscStyle = effectiveIncludeTags.some((tag) => WORLD_MISC_KEYS.has(tag));
      const ELECTRONIC_KEYS = new Set(['Lo-Fi','House','Deep House','Tech House','Trance','Techno','Dubstep','Drum & Bass','EDM','Electro','Hardcore','IDM','ambient','synthwave','chillwave','Vaporwave','Glitch','Witch House','Grime','UK Garage','2-Step','Electro Swing','Chiptune']);
      const isElectronicStyle = effectiveIncludeTags.some((tag) => ELECTRONIC_KEYS.has(tag));
      // ── Multi-tag negative shield merger ──
      // Combines GCC pronunciation negatives (highest priority — dialect lock) with
      // per-style regional shields for EVERY selected tag (not just the first). Falls back
      // to the proven Morocco-Killer default if a GCC tag is selected but no per-style
      // regional shield matched. Tokens are deduped and ordered so the most discriminating
      // dialect tokens land first.
      //
      // Length cap: Kie enforces a HARD 200-character limit on negativeTags across all
      // models (verified empirically by 422 response: "The length of music negativeStyle
      // cannot exceed 200 characters"). This is undocumented in their public API docs but
      // is a real server-side validation. Our prioritized merger ensures the most
      // discriminating GCC dialect tokens land in the first 200 chars; remaining tokens
      // are dropped at clean comma boundaries (never mid-token).
      const NEG_TAGS_MAX_CHARS = 200;
      const GCC_DEFAULT_NEGATIVES = 'moroccan, darija, gnawa, chaabi, maghrebi rhythm, egyptian, levantine, fusha, msa, sudanese, non-gulf, non-khaleeji, mispronounced, autotune, noise, hiss, distorted, low quality, quranic recitation, news anchor delivery, classical enunciation, hard final qaf, rolled trilled r, formal khutbah cadence, hijazi accent, andalusi accent';
      const tokenizeNeg = (s: string): string[] => s
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const orderedDedupeNeg = (tokens: string[]): string[] => {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const t of tokens) {
          const key = t.toLowerCase();
          if (!seen.has(key)) { seen.add(key); out.push(t); }
        }
        return out;
      };
      const fitNegativeTags = (tokens: string[]): string => {
        let acc = '';
        for (const t of tokens) {
          const next = acc ? `${acc}, ${t}` : t;
          if (next.length > NEG_TAGS_MAX_CHARS) break;
          acc = next;
        }
        return acc;
      };

      const gccPronunciationTokens: string[] = [];
      const regionalTokens: string[] = [];
      let hasGccTag = false;
      for (const tag of effectiveIncludeTags) {
        if (GCC_STYLE_SET.has(tag)) hasGccTag = true;
        const pron = GCC_PRONUNCIATION_NEGATIVES[tag];
        if (pron) gccPronunciationTokens.push(...tokenizeNeg(pron));
        const reg = REGIONAL_NEGATIVE[tag];
        if (reg) regionalTokens.push(...tokenizeNeg(reg));
      }
      if (hasGccTag && regionalTokens.length === 0) {
        regionalTokens.push(...tokenizeNeg(GCC_DEFAULT_NEGATIVES));
      }
      // ── Auto anti-instrument shield for modern Khaleeji families ──
      // When the user picks a pop/urban Khaleeji chip and did NOT select any
      // traditional instruments, auto-inject hard negative tags to block
      // oud/qanun/darbuka/riq/mirwas/hand-claps bleed. Placed FIRST in the
      // merge order so these tokens survive the 200-char cap.
      const modernFamily = getKhalijiFamily(effectiveIncludeTags[0] ?? null);
      const userPickedTraditionalInstrument = instrumentTags.some((t) => /oud|qanun|darbuka|riq|mirwas|hand\s*clap/i.test(t));
      const traditionalAntiTokens: string[] = [];
      if (hasGccTag && (modernFamily === 'pop' || modernFamily === 'urban') && !userPickedTraditionalInstrument) {
        traditionalAntiTokens.push('oud', 'qanun', 'darbuka', 'riq', 'mirwas', 'hand claps');
      }
      const finalNegativeTags = fitNegativeTags(
        orderedDedupeNeg([...traditionalAntiTokens, ...gccPronunciationTokens, ...regionalTokens])
      );

      // ── Final style string (resolved with GCC fallback) ──
      const GCC_FALLBACK_STYLE = 'kuwaiti qatari, pure kuwaiti qatari dialect, authentic desert-coastal resonance, seasoned gulf vocalist timbre, khaleeji pop, colloquial gulf phrasing, vocal-forward, close-mic intimacy, crystal-clear vocal articulation, expressive melismatic mawwal, audible breath support, authentic gulf vocal, strict khaleeji dialect, authentic khaleeji quarter-tone scale';
      const resolvedStyle = (kieStyle || GCC_FALLBACK_STYLE).slice(0, 1000);
      // ── Bulletproof GCC detection ──
      // 1) Chip-based: the canonical set (most precise).
      // 2) Content-based: the resolved style string contains a GCC marker. This catches
      //    chip/label mismatches AND the fallback case (fallback IS GCC by definition).
      // Either path forces GCC model + styleWeight so Khaleeji identity is never lost
      // due to a label drift between STYLE_GROUPS / GCC_STYLE_SET / STYLE_ANCHORS.
      const GCC_STYLE_MARKERS = /\b(khaleeji|kuwaiti|qatari|saudi|emirati|bahraini|omani|gulf|sheilat|samri|ardah|liwa|jalsa|mawwal)\b/i;
      const isGccEffective = isGccStyleSelected || GCC_STYLE_MARKERS.test(resolvedStyle);

      const invokeBody: Record<string, unknown> = {
        title: title.trim() || (language === 'ar' ? 'موسيقى وقتي' : 'Wakti Music'),
        style: resolvedStyle,
        styleTags: effectiveIncludeTags,
        customMode: true,
        instrumental,
        // Model: always V5_5 (best musicality + best vocal quality). Tested V4_5PLUS
        // for GCC dialect obedience and it produced non-Gulf (Egyptian/Levantine) output,
        // so reverted. GCC identity is now enforced through styleWeight 0.95, tail dialect
        // anchor in the style string, and a prioritized negativeTags shield instead.
        model: 'V5_5',
        duration_seconds: durationTarget,
        // GCC lifted to 0.95 (identity-locked tier, matching Anasheed). Treats Khaleeji
        // dialect as non-negotiable identity so user freetext / instruments / rhythm cannot
        // dilute the vocal signal.
        styleWeight: isAnasheedStyle ? 0.95 : isClassicalStyle ? 0.90 : isReggaeStyle ? 0.80 : isPopStyle ? 0.75 : isMetalStyle ? 0.75 : isRootsStyle ? 0.75 : isWorldMiscStyle ? 0.75 : isElectronicStyle ? 0.75 : isUrbanStyle ? 0.70 : isRockStyle ? 0.70 : isPunkStyle ? 0.70 : isJazzBluesStyle ? 0.70 : isGccEffective ? 0.95 : 0.85,
        weirdnessConstraint: isAnasheedStyle ? 0.15 : isClassicalStyle ? 0.20 : isReggaeStyle ? 0.35 : isPopStyle ? 0.45 : isMetalStyle ? 0.40 : isRootsStyle ? 0.40 : isWorldMiscStyle ? 0.40 : isElectronicStyle ? 0.40 : isUrbanStyle ? 0.45 : isRockStyle ? 0.45 : isPunkStyle ? 0.50 : isJazzBluesStyle ? 0.50 : 0.30,
        audioWeight: 0.8,
        negativeTags: finalNegativeTags,
        controlBlock: khalijiControlBlock.controlBlock,
        structurePlan: khalijiControlBlock.structurePlan,
        tempoHint: khalijiControlBlock.tempoTag,
        musicalKeyHint: khalijiControlBlock.keyTag,
      };

      if (!instrumental) invokeBody.prompt = structuredPrompt;
      if (vocalGender) invokeBody.vocalGender = vocalGender;

      const { data: genData, error: genError } = await supabase.functions.invoke('music-generate', {
        body: invokeBody,
      });

      if (genError?.message?.includes('TRIAL_LIMIT_REACHED') || genData?.error === 'TRIAL_LIMIT_REACHED') {
        emitEvent('wakti-trial-limit-reached', { feature: 'music' });
        setSubmitting(false);
        return;
      }
      if (genError) throw genError;
      if (!genData?.taskId) throw new Error(language === 'ar' ? 'لم يتم الحصول على معرف المهمة' : 'No task ID returned');

      const { taskId, recordId, status, tracks, error } = genData as {
        taskId: string;
        recordId: string;
        status?: string;
        tracks?: Array<{ id: string; audioUrl: string; coverUrl: string | null; duration: number | null; title: string | null; variantIndex: number }>;
        error?: string;
      };

      if (status === 'completed' && tracks?.length) {
        if (songsRemaining <= 1) {
          emitEvent('wakti-trial-quota-finished', { feature: 'music', consumed: 1, limit: 1, remaining: 0 });
        }
        setSubmitting(false);
        setGeneratingTask(null);
        setGeneratedTracks(tracks);
        setSavedTrackIds([]);
        setTitleOpen(false);
        setMusicStyleOpen(false);
        setVocalsOpen(false);
        setLyricsOpen(false);
        setSongsUsed((v) => v + 1);
        setSongsRemaining((v) => Math.max(0, v - 1));
        setLastError(null);
        toast.success(language === 'ar' ? 'تم إنشاء الموسيقى بنجاح' : 'Music generated successfully');
        return;
      }

      if (status === 'failed') {
        throw new Error(error || (language === 'ar' ? 'فشل الإنشاء' : 'Generation failed'));
      }

      setGeneratingTask({ taskId, recordId });
      toast.info(language === 'ar' ? '🎵 ما زال إنشاء الموسيقى جارياً...' : '🎵 Music is still generating...');

    } catch (e: any) {
      const msg = e?.message || String(e);
      setLastError(msg);
      setSubmitting(false);
      toast.error((language === 'ar' ? 'فشل العملية: ' : 'Operation failed: ') + msg);
    }
  };

  // Realtime listener — replaces polling. Fires when music-callback writes completed rows.
  useEffect(() => {
    if (!generatingTask) return;

    const { taskId, recordId } = generatingTask;
    let settled = false;

    const handleCompleted = (tracks: Array<{ id: string; audioUrl: string; coverUrl: string | null; duration: number | null; title: string | null; variantIndex: number }>) => {
      if (settled) return;
      settled = true;
      if (songsRemaining <= 1) {
        emitEvent('wakti-trial-quota-finished', { feature: 'music', consumed: 1, limit: 1, remaining: 0 });
      }
      setGeneratingTask(null);
      setSubmitting(false);
      setGeneratedTracks(tracks);
      setSavedTrackIds([]);
      setTitleOpen(false);
      setMusicStyleOpen(false);
      setVocalsOpen(false);
      setLyricsOpen(false);
      setSongsUsed((v) => v + 1);
      setSongsRemaining((v) => Math.max(0, v - 1));
      setLastError(null);
      setLastNotice(null);
      toast.success(language === 'ar' ? 'تم إنشاء الموسيقى بنجاح!' : 'Music generated successfully!');
    };

    const handleFailed = (msg: string) => {
      if (settled) return;
      settled = true;
      setGeneratingTask(null);
      setSubmitting(false);
      setLastError(msg);
      setLastNotice(null);
      toast.error(msg);
    };

    // Build track list from completed DB rows
    const buildTracks = (rows: Array<{ id: string; signed_url: string | null; cover_url: string | null; duration: number | null; title: string | null; variant_index: number | null }>) =>
      rows
        .filter((r) => r.signed_url)
        .map((r) => ({
          id: r.id,
          audioUrl: r.signed_url as string,
          coverUrl: r.cover_url,
          duration: r.duration,
          title: r.title,
          variantIndex: r.variant_index ?? 0,
        }));

    // Fetch completed rows directly from DB (used by both realtime and fallback)
    const fetchCompletedRows = async () => {
      const { data } = await (supabase as any)
        .from('user_music_tracks')
        .select('id, signed_url, cover_url, duration, title, variant_index, meta')
        .eq('task_id', taskId)
        .order('variant_index', { ascending: true });
      return (data ?? []).filter((r: any) => {
        try { return r?.meta?.status === 'completed' && r.signed_url; } catch { return false; }
      });
    };

    // Subscribe to Realtime changes on this task's rows
    const channel = supabase
      .channel(`music-task-${taskId}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'user_music_tracks',
          filter: `task_id=eq.${taskId}`,
        },
        async (payload: any) => {
          if (settled) return;
          const row = payload?.new ?? payload?.record;
          if (!row) return;

          // Check for failure
          try {
            if (row?.meta?.status === 'failed') {
              handleFailed(row.meta?.error || (language === 'ar' ? 'فشل الإنشاء' : 'Generation failed'));
              return;
            }
          } catch { /* ignore */ }

          // On any change, query all completed rows for this task
          // (we need all variants, not just the one that just changed)
          const completedRows = await fetchCompletedRows();
          if (completedRows.length >= 2) {
            handleCompleted(buildTracks(completedRows));
          } else if (completedRows.length === 1) {
            // One variant done — keep waiting briefly for second, then show what we have
            setTimeout(async () => {
              if (settled) return;
              const rows = await fetchCompletedRows();
              if (rows.length >= 1) handleCompleted(buildTracks(rows));
            }, 8000);
          }
        }
      )
      .subscribe();

    // Fallback safety net: after 90s, do a single music-status poll in case
    // Realtime missed the event (e.g., connectivity gap)
    const fallbackTimeout = setTimeout(async () => {
      if (settled) return;
      try {
        const { data, error } = await supabase.functions.invoke('music-status', {
          body: { taskId, recordId },
        });
        if (error) {
          console.warn('[MusicStudio] fallback music-status error:', error);
          return;
        }
        if (data?.status === 'completed' && data?.tracks?.length) {
          handleCompleted(data.tracks);
        } else if (data?.status === 'failed') {
          handleFailed(data?.error || (language === 'ar' ? 'فشل الإنشاء' : 'Generation failed'));
        }
      } catch (e) {
        console.warn('[MusicStudio] fallback poll exception:', e);
      }
    }, 90_000);

    return () => {
      settled = true;
      clearTimeout(fallbackTimeout);
      supabase.removeChannel(channel);
    };
  }, [generatingTask, language]);

  // Position and outside-click handling for pickers
  useEffect(() => {
    function calcRects() {
      if (showIncludePicker && includeAnchorRef.current) {
        const r = includeAnchorRef.current.getBoundingClientRect();
        setIncludeRect({ top: r.bottom + 4, left: r.left, width: r.width });
      }
      if (showInstrumentPicker && instrumentAnchorRef.current) {
        const r = instrumentAnchorRef.current.getBoundingClientRect();
        setInstrumentRect({ top: r.bottom + 4, left: r.left, width: r.width });
      }
      if (showMoodPicker && moodAnchorRef.current) {
        const r = moodAnchorRef.current.getBoundingClientRect();
        setMoodRect({ top: r.bottom + 4, left: r.left, width: r.width });
      }
    }
    calcRects();
    const onScroll = () => calcRects();
    const onResize = () => calcRects();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [showIncludePicker, showInstrumentPicker, showMoodPicker]);

  useEffect(() => {
    function handleDocClick(ev: MouseEvent) {
      const t = ev.target as HTMLElement;
      // Close if click outside the anchor areas and outside the menus
      const menu = document.getElementById('include-picker-menu');
      const menu2 = document.getElementById('instrument-picker-menu');
      const menu3 = document.getElementById('mood-picker-menu');
      if (
        showIncludePicker &&
        !includeAnchorRef.current?.contains(t) &&
        menu && !menu.contains(t)
      ) setShowIncludePicker(false);
      if (
        showInstrumentPicker &&
        !instrumentAnchorRef.current?.contains(t) &&
        menu2 && !menu2.contains(t)
      ) setShowInstrumentPicker(false);
      if (
        showMoodPicker &&
        !moodAnchorRef.current?.contains(t) &&
        menu3 && !menu3.contains(t)
      ) setShowMoodPicker(false);
    }
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [showIncludePicker, showInstrumentPicker, showMoodPicker]);

  // Auto-advance Step 2 → Step 3 when all subsections done
  useEffect(() => {
    if (!step2ReadyToProceed) return;
    const timer = setTimeout(() => {
      setStep2ReadyToProceed(false);
      goToStep(3);
    }, 1200);
    return () => clearTimeout(timer);
  }, [step2ReadyToProceed]);

  // Clear all tag selections when language switches (English tags must not show in Arabic mode)
  useEffect(() => {
    setIncludeTags([]);
    setRhythmTags([]);
    setMoodTags([]);
    setInstrumentTags([]);
    setStylesCollapsed(false);
    setRhythmOpen(false);
    setMoodOpen(false);
    setInstrumentsOpen(false);
  }, [language]);

  const goToStep = (step) => {
    setComposeStep(step);
    if (step === 1) { setTitleOpen(true); }
    if (step === 2) { setComposeDetailsVisible(true); setMusicStyleOpen(true); setStylesOpen(true); }
    if (step === 3) { setComposeDetailsVisible(true); setVocalsOpen(true); }
    if (step === 4) { setComposeDetailsVisible(true); setLyricsOpen(true); }
  };

  const StepBar = ({ current }: { current: number }) => (
    <div className="flex items-center gap-1.5 mb-5">
      {[1,2,3,4].map((s) => (
        <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= current ? 'bg-[#060541] dark:bg-white/70' : 'bg-[#e4e6ed] dark:bg-white/10'}`} />
      ))}
    </div>
  );

  const TrackChip = () => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f7f8fc] dark:bg-white/[0.04] border border-[#e4e6ed] dark:border-white/5 mb-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#858384] dark:text-white/40">{isAr ? 'الأغنية' : 'Track'}</span>
      <span className="text-sm font-semibold text-[#060541] dark:text-white truncate">{title}</span>
    </div>
  );

  const BackBtn = ({ toStep }: { toStep: 1|2|3|4 }) => (
    <button
      type="button"
      onClick={() => goToStep(toStep)}
      className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-2xl text-[11px] font-bold border border-violet-200/90 dark:border-violet-400/25 bg-gradient-to-r from-[#ffffff] via-[#f3e8ff] to-[#ede9fe] dark:from-[#181d2b] dark:via-[#251c46] dark:to-[#141824] text-[#5b21b6] dark:text-violet-100 shadow-[0_8px_20px_rgba(139,92,246,0.18)] dark:shadow-[0_0_24px_hsla(280,70%,65%,0.18)] hover:from-[#ffffff] hover:via-[#ede9fe] hover:to-[#ddd6fe] dark:hover:from-[#21193a] dark:hover:via-[#31235a] dark:hover:to-[#1a2130] hover:border-violet-300 dark:hover:border-violet-300/40 hover:text-[#4c1d95] dark:hover:text-white active:scale-95 transition-all"
    >
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 dark:from-violet-400/25 dark:to-fuchsia-400/15 shadow-inner shadow-violet-500/20">
        <ArrowRight className="h-3 w-3 rotate-180 text-violet-600 dark:text-violet-100" />
      </span>
      <span>{isAr ? 'رجوع' : 'Back'}</span>
    </button>
  );

  const StepNextBtn = ({
    onClick,
    disabled,
    label,
    shortLabel,
    ready,
    title,
  }: {
    onClick: () => void;
    disabled?: boolean;
    label: string;
    shortLabel?: string;
    ready?: boolean;
    title?: string;
  }) => (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-2xl text-[11px] font-bold text-white active:scale-95 transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${
        ready
          ? 'bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500 shadow-[0_10px_24px_rgba(16,185,129,0.26)] dark:shadow-[0_0_24px_hsla(160,80%,55%,0.30)]'
          : 'bg-gradient-to-r from-[#060541] via-[#4338ca] to-[#7c3aed] shadow-[0_10px_24px_rgba(76,29,149,0.24)] dark:shadow-[0_0_24px_hsla(280,70%,65%,0.24)] hover:brightness-110'
      }`}
    >
      {shortLabel ? (
        <>
          <span className="inline sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{label}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/18 border border-white/20">
        <ArrowRight className="h-3 w-3" />
      </span>
    </button>
  );

  const StepHeader = ({
    icon,
    title,
    badge,
    backToStep,
    next,
  }: {
    icon?: React.ReactNode;
    title: string;
    badge?: React.ReactNode;
    backToStep?: 1 | 2 | 3 | 4;
    next?: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between gap-2 pb-1">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="text-sm font-extrabold text-[#060541] dark:text-white uppercase tracking-normal sm:tracking-wider truncate">{title}</span>
        {badge ? <span className="shrink-0">{badge}</span> : null}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {backToStep ? <BackBtn toStep={backToStep} /> : null}
        {next}
      </div>
    </div>
  );

  const cardCls = "rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-[0_10px_30px_rgba(6,5,65,0.08)] dark:shadow-none p-5 sm:p-4";

  return (
    <div className="space-y-4">

      {/* ── STEP 1: TITLE ── */}
      {composeStep === 1 && (
        <div className={cardCls}>
          <StepBar current={1} />
          <div className="mb-4 rounded-2xl border border-[#d7d8de] dark:border-[#606062]/30 bg-gradient-to-br from-[#fcfefd] via-[#f7f8fb] to-[#fcfefd] dark:from-[#0c0f14] dark:via-[#141820] dark:to-[#0c0f14] px-4 py-3 shadow-[0_8px_24px_rgba(6,5,65,0.06)] dark:shadow-[0_2px_20px_hsla(0,0%,0%,0.5),0_1px_8px_hsla(240,20%,40%,0.4)]">
            <p className="text-sm leading-6 text-[#060541]/80 dark:text-[#f2f2f2]/85">
              {isAr
                ? 'ابدأ باسم المقطع، ثم اختر النمط المناسب. يمكن للذكاء الاصطناعي مساعدتك باقتراح الإيقاعات والمزاج والآلات، أو يمكنك تخصيصها بنفسك.'
                : 'Start with your track name, then choose the right style. AI can help suggest rhythms, moods, and instruments, or you can fine-tune everything yourself.'}
            </p>
            <p className="mt-1 text-sm leading-6 text-[#606062] dark:text-[#858384]">
              {isAr
                ? 'بعدها اختر نوع الصوت: تلقائي، آلي، نسائي أو رجالي، ثم أضف الكلمات باستخدام فكرة أو توسيع. غالباً يستغرق الإنشاء من دقيقة إلى دقيقتين.'
                : 'Then choose vocals: Auto, Instrumental, Female, or Male, and finish your lyrics with Idea or Expand. Most tracks take around 1–2 minutes to generate.'}
            </p>
          </div>
          <div className="text-center pb-5">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#f7f8fc] dark:bg-white/[0.04] border border-[#e4e6ed] dark:border-white/10 mb-4">
              <Music className="h-7 w-7 text-[#060541] dark:text-white/60" />
            </div>
            <h2 className="text-lg font-bold text-[#060541] dark:text-white mb-1">
              {isAr ? 'مرحباً بك في استوديو الموسيقى' : 'Welcome to Music Studio'}
            </h2>
            <p className="text-xs text-[#606062] dark:text-white/50 leading-relaxed">
              {isAr ? 'لنبدأ! ما هو عنوان أغنيتك؟' : "Let's start — what's your track title?"}
            </p>
          </div>
          <div className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              placeholder={isAr ? 'اسم الأغنية...' : 'Track title...'}
              className="bg-white dark:bg-white/[0.04] border-[#d9dde7] dark:border-white/10 focus:border-sky-400/60 focus:ring-sky-400/20 rounded-2xl h-12 text-[#060541] dark:text-white"
              maxLength={80}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#858384] dark:text-white/30">{title.length}/80</span>
              {title.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#060541] dark:bg-white/10 hover:opacity-90 text-white active:scale-95 transition-all"
                >
                  {isAr ? 'التالي' : 'Next'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: MUSIC STYLE ── */}
      {composeStep === 2 && composeDetailsVisible && (
        <div className={`${cardCls} space-y-3`}>
          <StepBar current={2} />
          <StepHeader
            icon={<Music className="h-5 w-5 text-sky-400" />}
            title={isAr ? 'أسلوب الموسيقى' : 'Music Style'}
            backToStep={1}
            next={
              <StepNextBtn
                onClick={() => goToStep(3)}
                disabled={includeTags.length === 0}
                title={includeTags.length === 0 ? (isAr ? 'اختر نمطًا أولاً' : 'Pick a style first') : undefined}
                ready={step2ReadyToProceed}
                label={isAr ? 'التالي: الصوت' : 'Next: Vocals'}
                shortLabel={isAr ? 'التالي' : 'Next'}
              />
            }
          />
          <TrackChip />
          <>
            <div className="rounded-xl border border-sky-200 dark:border-sky-400/20 bg-sky-50/80 dark:bg-sky-500/10 px-3 py-2 text-[11px] sm:text-[10px] text-sky-700 dark:text-sky-200">
              {isAr ? 'اختر النمط والإيقاع والمزاج والآلات. هذه الاختيارات تبني الهوية الموسيقية.' : 'Choose the style, rhythm, mood, and instruments. These selections build the musical identity.'}
            </div>
            {/* Selected tags - compact row */}
            {(includeTags.length > 0 || instrumentTags.length > 0 || rhythmTags.length > 0 || moodTags.length > 0) && (
              <div className="flex flex-wrap gap-1.5 pb-2 border-b border-[#eceef5] dark:border-white/5">
                {includeTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-50 dark:bg-sky-500/20 border border-sky-200 dark:border-sky-400/30 text-sky-600 dark:text-sky-300 text-sm shadow-[0_2px_8px_rgba(59,130,246,0.10)] dark:shadow-none">
                    {tag}
                    <button type="button" aria-label={isAr ? 'إزالة' : 'Remove'} onClick={() => setIncludeTags(p => p.filter(t => t !== tag))} className="hover:text-white p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {instrumentTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-400/30 text-purple-600 dark:text-purple-300 text-sm shadow-[0_2px_8px_rgba(147,51,234,0.10)] dark:shadow-none">
                    {tag}
                    <button type="button" aria-label={isAr ? 'إزالة' : 'Remove'} onClick={() => setInstrumentTags(p => p.filter(t => t !== tag))} className="hover:text-white p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {rhythmTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-500/20 border border-orange-200 dark:border-orange-400/30 text-orange-600 dark:text-orange-300 text-sm shadow-[0_2px_8px_rgba(249,115,22,0.10)] dark:shadow-none">
                    {tag}
                    <button type="button" aria-label={isAr ? 'إزالة' : 'Remove'} onClick={() => setRhythmTags(p => p.filter(t => t !== tag))} className="hover:text-white p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {moodTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-400/30 text-amber-600 dark:text-amber-300 text-sm shadow-[0_2px_8px_rgba(245,158,11,0.10)] dark:shadow-none">
                    {tag}
                    <button type="button" aria-label={isAr ? 'إزالة' : 'Remove'} onClick={() => setMoodTags(p => p.filter(t => t !== tag))} className="hover:text-white p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Category: Styles */}
            <div className="rounded-2xl border border-[#d9dde7] dark:border-white/[0.08] overflow-hidden">
              {/* STYLES header */}
              <div
                className={`flex items-center justify-between px-4 py-3 border-b border-[#e4e6ed] dark:border-white/[0.06] ${
                  stylesCollapsed
                    ? 'bg-[#f0f9ff] dark:bg-sky-500/[0.08] cursor-pointer hover:bg-[#e8f4fd] dark:hover:bg-sky-500/[0.12]'
                    : 'bg-[#f7f8fc] dark:bg-white/[0.03]'
                }`}
                onClick={() => stylesCollapsed && setStylesCollapsed(false)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#060541]/60 dark:text-white/40">{isAr ? 'الأنماط' : 'Styles'}</span>
                  {includeTags.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-300 text-[10px] font-semibold border border-sky-200 dark:border-sky-400/30">
                      ✓ {includeTags[0]}{includeTags.length > 1 ? ` +${includeTags.length - 1}` : ''}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[#858384] dark:text-white/30">
                  {stylesCollapsed ? (isAr ? 'اضغط للتغيير' : 'tap to change') : (isAr ? 'اختر نمطًا واحدًا' : 'Pick one style')}
                </span>
              </div>
              {/* Category accordion rows — hidden when collapsed after pick */}
              {!stylesCollapsed && <div className="divide-y divide-[#e4e6ed] dark:divide-white/[0.05]">
                {STYLE_GROUPS.map((group, gIdx) => {
                  const isOpen = openStyleGroupIdx === gIdx;
                  const groupSelected = group.items.filter(s => includeTags.includes(s));
                  return (
                    <div
                      key={group.title}
                      ref={(el) => { styleGroupRefs.current[gIdx] = el; }}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenStyleGroupIdx(isOpen ? -1 : gIdx)}
                        className={`flex items-center justify-between w-full px-4 py-3 transition-colors ${
                          isOpen
                            ? 'bg-[#eef4ff] dark:bg-sky-500/[0.08]'
                            : 'bg-white dark:bg-transparent hover:bg-[#f5f7fb] dark:hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-xs font-bold uppercase tracking-wider ${
                            isOpen ? 'text-sky-600 dark:text-sky-300' : 'text-[#374151] dark:text-white/70'
                          }`}>{group.title}</span>
                          {!isOpen && groupSelected.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-300 text-[10px] font-semibold border border-sky-200 dark:border-sky-400/30">
                              ✓ {groupSelected[0]}{groupSelected.length > 1 ? ` +${groupSelected.length - 1}` : ''}
                            </span>
                          )}
                        </div>
                        <span className={`text-base font-light flex-shrink-0 ${
                          isOpen ? 'text-sky-500 dark:text-sky-300' : 'text-[#858384] dark:text-white/30'
                        }`}>{isOpen ? '−' : '+'}</span>
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3 pt-2 grid grid-cols-4 gap-2 bg-[#fafbff] dark:bg-white/[0.01]">
                          {group.items.map((style) => (
                            <button
                              key={style}
                              type="button"
                              onClick={() => handleStyleToggle(style)}
                              className={`w-full min-h-[48px] px-2 py-2 rounded-xl text-[11px] font-semibold leading-tight text-center border transition-all active:scale-95 whitespace-normal break-words flex items-center justify-center ${
                                includeTags.includes(style)
                                  ? 'bg-sky-50 dark:bg-sky-500/25 border-sky-300 dark:border-sky-400/50 text-sky-700 dark:text-sky-200 shadow-[0_4px_12px_rgba(59,130,246,0.15)]'
                                  : 'bg-white dark:bg-white/[0.06] border-[#d9dde7] dark:border-white/15 text-[#374151] dark:text-white/80 hover:border-sky-300 dark:hover:border-sky-400/40 hover:text-sky-700 dark:hover:text-sky-200 hover:bg-sky-50/50 dark:hover:bg-sky-500/10'
                              }`}
                            >
                              {style}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>}
            </div>

            {/* Category: Rhythm / Beat */}
            <div>
              <button
                type="button"
                onClick={() => toggleMusicSubsection('rhythm')}
                className="flex items-center justify-between w-full text-[10px] font-medium text-muted-foreground/80 dark:text-muted-foreground/60 uppercase mb-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-xs font-medium text-muted-foreground/80 dark:text-muted-foreground/60 uppercase">{isAr ? 'الإيقاع / البيت' : 'Rhythm / Beat'}</span>
                  {!rhythmOpen && rhythmTags.length > 0 && (
                    <span className="text-xs font-medium text-orange-600 dark:text-orange-300 normal-case">{rhythmTags.join(', ')}</span>
                  )}
                </div>
                <span className="text-xl sm:text-lg text-orange-500 dark:text-orange-400/80">{rhythmOpen ? '−' : '+'}</span>
              </button>
              {rhythmOpen && (
                <div className="space-y-3">
                  {/* Recommended rhythms row */}
                  {recommendedRhythms.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-orange-500/80 dark:text-orange-400/70 flex items-center gap-1">
                        <Sparkles className="h-2.5 w-2.5" />
                        {isAr ? 'مقترح لهذا النمط' : 'Recommended for this style'}
                      </div>
                      <div className="flex gap-2">
                        {recommendedRhythms.map((rhythm) => (
                          <button
                            key={rhythm}
                            type="button"
                            onClick={() => handleRhythmToggle(rhythm)}
                            className={`flex-1 min-h-[44px] px-3 py-2 rounded-2xl text-xs sm:text-sm leading-tight text-center border-2 transition-all active:scale-95 font-semibold ${
                              rhythmTags.includes(rhythm)
                                ? 'bg-orange-500 dark:bg-orange-500 border-orange-500 dark:border-orange-400 text-white shadow-[0_0_16px_rgba(249,115,22,0.5)]'
                                : 'bg-transparent border-orange-400 dark:border-orange-400/60 text-orange-500 dark:text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.25)] dark:shadow-[0_0_12px_rgba(249,115,22,0.2)] hover:bg-orange-50 dark:hover:bg-orange-500/10'
                            }`}
                          >
                            {rhythm}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] sm:text-xs text-muted-foreground/70 dark:text-muted-foreground/60">
                      {isAr ? `${rhythmTags.length}/2 إيقاعات مختارة` : `${rhythmTags.length}/2 rhythms selected`}
                    </span>
                    <div className="flex items-center gap-2">
                      {recommendedRhythms.length > 0 && rhythmTags.length === 0 && (
                        <button
                          type="button"
                          onClick={handleSelectRecommendedRhythms}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-orange-300 dark:border-orange-400/30 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/20 active:scale-95 transition-all"
                        >
                          <Sparkles className="h-3 w-3" />
                          {isAr ? 'اختيار المقترح' : 'Select recommended'}
                        </button>
                      )}
                      {rhythmTags.length > 0 && (
                        <button
                          type="button"
                          onClick={handleRhythmNext}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-orange-300 dark:border-orange-400/30 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/20 active:scale-95 transition-all"
                        >
                          {isAr ? 'التالي' : 'Next'} →
                        </button>
                      )}
                    </div>
                  </div>
                  {RHYTHM_GROUPS.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-[#060541]/70 dark:text-orange-200/80 px-0.5">
                        {group.title}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {group.items.map((rhythm) => (
                          <button
                            key={rhythm}
                            type="button"
                            onClick={() => handleRhythmToggle(rhythm)}
                            className={`w-full min-h-[52px] px-3 py-2.5 rounded-2xl text-[11px] font-semibold leading-tight text-center border transition-all active:scale-95 whitespace-normal break-words flex items-center justify-center ${
                              rhythmTags.includes(rhythm)
                                ? 'bg-orange-50 dark:bg-orange-500/25 border-orange-300 dark:border-orange-400/40 text-orange-700 dark:text-orange-200 shadow-[0_4px_12px_rgba(249,115,22,0.12)] dark:shadow-[0_0_12px_rgba(249,115,22,0.15)]'
                                : recommendedRhythms.includes(rhythm)
                                  ? 'bg-transparent border-orange-400 dark:border-orange-400/50 text-orange-500 dark:text-orange-300 shadow-[0_0_10px_rgba(249,115,22,0.2)] dark:shadow-[0_0_10px_rgba(249,115,22,0.15)]'
                                  : 'bg-white dark:bg-white/[0.09] border-[#d9dde7] dark:border-white/20 text-[#374151] dark:text-white/90 hover:border-orange-300 dark:hover:border-orange-400/40 hover:text-orange-600 dark:hover:text-orange-200 dark:hover:bg-orange-500/15'
                            }`}
                          >
                            {rhythm}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category: Mood */}
            <div>
              <button 
                type="button"
                onClick={() => toggleMusicSubsection('mood')}
                className="flex items-center justify-between w-full text-[10px] font-medium text-muted-foreground/80 dark:text-muted-foreground/60 uppercase mb-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-xs font-medium text-muted-foreground/80 dark:text-muted-foreground/60 uppercase">{isAr ? 'المزاج' : 'Mood'}</span>
                  {!moodOpen && moodTags.length > 0 && (
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-300 normal-case">{moodTags.join(', ')}</span>
                  )}
                </div>
                <span className="text-xl sm:text-lg text-amber-500 dark:text-amber-400/80">{moodOpen ? '−' : '+'}</span>
              </button>
              {moodOpen && (
                <div className="space-y-3">
                  {/* Recommended moods row */}
                  {recommendedMoods.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-amber-500/80 dark:text-amber-400/70 flex items-center gap-1">
                        <Sparkles className="h-2.5 w-2.5" />
                        {isAr ? 'مقترح لهذا النمط' : 'Recommended for this style'}
                      </div>
                      <div className="flex gap-2">
                        {recommendedMoods.map((mood) => (
                          <button
                            key={mood}
                            type="button"
                            onClick={() => handleMoodToggle(mood)}
                            className={`flex-1 min-h-[44px] px-3 py-2 rounded-2xl text-xs sm:text-sm leading-tight text-center border-2 transition-all active:scale-95 font-semibold ${
                              moodTags.includes(mood)
                                ? 'bg-amber-500 dark:bg-amber-500 border-amber-500 dark:border-amber-400 text-white shadow-[0_0_16px_rgba(245,158,11,0.5)]'
                                : 'bg-transparent border-amber-400 dark:border-amber-400/60 text-amber-500 dark:text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] dark:shadow-[0_0_12px_rgba(245,158,11,0.2)] hover:bg-amber-50 dark:hover:bg-amber-500/10'
                            }`}
                          >
                            {mood}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] sm:text-xs text-muted-foreground/70 dark:text-muted-foreground/60">
                      {isAr
                        ? `${moodTags.length}/3 حالات مختارة`
                        : `${moodTags.length}/3 moods selected`}
                    </span>
                    <div className="flex items-center gap-2">
                      {recommendedMoods.length > 0 && moodTags.length === 0 && (
                        <button
                          type="button"
                          onClick={handleSelectRecommendedMoods}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-300 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 active:scale-95 transition-all"
                        >
                          <Sparkles className="h-3 w-3" />
                          {isAr ? 'اختيار المقترح' : 'Select recommended'}
                        </button>
                      )}
                      {moodTags.length > 0 && (
                        <button
                          type="button"
                          onClick={handleMoodNext}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-300 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 active:scale-95 transition-all"
                        >
                          {isAr ? 'التالي' : 'Next'} →
                        </button>
                      )}
                    </div>
                  </div>
                  {MODE_GROUPS.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-[#060541]/70 dark:text-amber-200/80 px-0.5">
                        {group.title}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {group.items.map((mood) => (
                          <button
                            key={mood}
                            type="button"
                            onClick={() => handleMoodToggle(mood)}
                            className={`w-full min-h-[52px] px-3 py-2.5 rounded-2xl text-[11px] font-semibold leading-tight text-center border transition-all active:scale-95 whitespace-normal break-words flex items-center justify-center ${
                              moodTags.includes(mood)
                                ? 'bg-amber-50 dark:bg-amber-500/25 border-amber-300 dark:border-amber-400/40 text-amber-700 dark:text-amber-200 shadow-[0_4px_12px_rgba(245,158,11,0.12)] dark:shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                                : 'bg-white dark:bg-white/[0.09] border-[#d9dde7] dark:border-white/20 text-[#374151] dark:text-white/90 hover:border-amber-300 dark:hover:border-amber-400/40 hover:text-amber-600 dark:hover:text-amber-200 dark:hover:bg-amber-500/15'
                            }`}
                          >
                            {mood}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category: Instruments */}
            <div>
              <button
                type="button"
                onClick={() => toggleMusicSubsection('instruments')}
                className="flex items-center justify-between w-full text-[10px] font-medium text-muted-foreground/80 dark:text-muted-foreground/60 uppercase mb-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-xs font-medium text-muted-foreground/80 dark:text-muted-foreground/60 uppercase">{isAr ? 'الآلات' : 'Instruments'}</span>
                  {!instrumentsOpen && instrumentTags.length > 0 ? (
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-300 normal-case">{instrumentTags.slice(0, 3).join(', ')}{instrumentTags.length > 3 ? ` +${instrumentTags.length - 3}` : ''}</span>
                  ) : recommendedInstruments.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium border border-emerald-400/30">
                      <Sparkles className="h-2.5 w-2.5" />
                      {isAr ? 'مقترحة' : 'Recommended'}
                    </span>
                  )}
                </div>
                <span className="text-xl sm:text-lg text-purple-500 dark:text-purple-400/80">{instrumentsOpen ? '−' : '+'}</span>
              </button>
              {instrumentsOpen && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] sm:text-xs text-muted-foreground/70 dark:text-muted-foreground/60">
                      {isAr
                        ? `${instrumentTags.length}/6 آلات مختارة`
                        : `${instrumentTags.length}/6 instruments selected`}
                    </span>
                    <div className="flex items-center gap-2">
                    {recommendedInstruments.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSelectRecommendedInstruments}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-300 dark:border-emerald-400/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 active:scale-95 transition-all"
                      >
                        <Sparkles className="h-3 w-3" />
                        {isAr ? 'اختيار المقترح' : 'Select recommended'}
                      </button>
                    )}
                    {instrumentTags.length > 0 && (
                      <button
                        type="button"
                        onClick={handleInstrumentsNext}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-purple-300 dark:border-purple-400/30 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 active:scale-95 transition-all"
                      >
                        {isAr ? 'التالي' : 'Next'} →
                      </button>
                    )}
                  </div>
                  </div>
                  {INSTRUMENT_GROUPS.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-[#060541]/70 dark:text-purple-200/80 px-0.5">
                        {group.title}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {group.items.map((inst) => {
                          const isRecommended = recommendedInstruments.includes(inst);
                          const isSelected = instrumentTags.includes(inst);
                          return (
                            <button
                              key={inst}
                              type="button"
                              onClick={() => handleInstrumentToggle(inst)}
                              className={`w-full min-h-[52px] px-3 py-2.5 rounded-2xl text-[11px] font-semibold leading-tight text-center border transition-all active:scale-95 whitespace-normal break-words flex items-center justify-center ${
                                isSelected
                                  ? 'bg-purple-50 dark:bg-purple-500/25 border-purple-300 dark:border-purple-400/40 text-purple-700 dark:text-purple-200 shadow-[0_4px_12px_rgba(147,51,234,0.12)] dark:shadow-[0_0_12px_rgba(147,51,234,0.2)]'
                                  : isRecommended
                                    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-400 dark:border-amber-400/50 border-dashed text-amber-700 dark:text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.25)] dark:shadow-[0_0_14px_rgba(251,191,36,0.20)] animate-pulse'
                                    : 'bg-white dark:bg-white/[0.09] border-[#d9dde7] dark:border-white/20 text-[#374151] dark:text-white/90 hover:border-purple-300 dark:hover:border-purple-400/40 hover:text-purple-600 dark:hover:text-purple-200 dark:hover:bg-purple-500/15'
                              }`}
                            >
                              {language === 'ar' ? (INSTRUMENT_DISPLAY_AR[inst] ?? inst) : inst}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        </div>
      )}

      {/* ── STEP 3: VOCALS ── */}
      {composeStep === 3 && composeDetailsVisible && (
        <div className={`${cardCls} space-y-3`}>
          <StepBar current={3} />
          <StepHeader
            icon={<Mic className="h-5 w-5 text-emerald-400" />}
            title={isAr ? 'الصوت' : 'Vocals'}
            badge={<span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">{isAr ? 'اختياري' : 'Optional'}</span>}
            backToStep={2}
            next={<StepNextBtn onClick={() => goToStep(4)} label={isAr ? 'التالي: الكلمات' : 'Next: Lyrics'} shortLabel={isAr ? 'التالي' : 'Next'} />}
          />
          <TrackChip />
          <div className="flex flex-wrap gap-2">
            {(['auto', 'none', 'female', 'male'] as const).map((v) => {
              const labels: Record<string, { en: string; ar: string }> = {
                auto: { en: 'Auto', ar: 'تلقائي' }, none: { en: 'Instrumental', ar: 'موسيقى فقط' },
                female: { en: 'Female', ar: 'أنثوي' }, male: { en: 'Male', ar: 'ذكوري' },
              };
              const isActive = vocalType === v;
              return (
                <button key={v} type="button" onClick={() => handleVocalSelect(v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-500/30 dark:to-teal-500/20 border-emerald-300 dark:border-emerald-400/50 text-emerald-700 dark:text-emerald-300 shadow-[0_8px_18px_rgba(16,185,129,0.15)] dark:shadow-[0_0_12px_hsla(142,76%,55%,0.3)]'
                      : 'bg-white dark:bg-transparent border-[#d9dde7] dark:border-white/10 text-muted-foreground/90 dark:text-muted-foreground hover:border-emerald-300 dark:hover:border-white/20 hover:text-emerald-600 dark:hover:text-foreground'
                  }`}
                >
                  {isAr ? labels[v].ar : labels[v].en}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 4: LYRICS ── */}
      {composeStep === 4 && composeDetailsVisible && (
        <div className={`${cardCls} space-y-3`}>
          <StepBar current={4} />
          <StepHeader
            title={isAr ? 'الكلمات' : 'Lyrics'}
            badge={<span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-300">{isAr ? 'مطلوب' : 'Must'}</span>}
            backToStep={3}
          />
          <TrackChip />
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setAmpMode('idea')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    ampMode === 'idea'
                      ? 'bg-purple-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {isAr ? 'فكرة' : 'Idea'}
                </button>
                <button
                  type="button"
                  onClick={() => setAmpMode('expand')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    ampMode === 'expand'
                      ? 'bg-purple-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {isAr ? 'توسيع' : 'Expand'}
                </button>
                {isGccStyleSelected && (
                  <button
                    type="button"
                    onClick={() => setAmpMode('gcc_enhance')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                      ampMode === 'gcc_enhance'
                        ? 'bg-purple-500 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isAr ? 'تحسين خليجي' : 'Khaleeji Enhance'}
                  </button>
                )}
              </div>
              <button
                type="button"
                disabled={amping || submitting}
                onClick={handleAmp}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border border-purple-200 dark:border-purple-400/30 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300 shadow-[0_4px_12px_rgba(168,85,247,0.10)] dark:shadow-none hover:bg-purple-100 dark:hover:bg-purple-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {amping
                  ? <><Loader2 className="h-3 w-3 animate-spin" />{isAr ? 'جاري...' : 'Working...'}</>
                  : <><Sparkles className="h-3 w-3" />{isAr ? 'Amp' : 'Amp'}</>
                }
              </button>
            </div>
            {lyricsDisplayMode ? (
              <div className="space-y-2">
                {gccOriginalLyrics && (
                  <div className="rounded-xl border border-amber-300/50 dark:border-amber-400/20 bg-amber-50/60 dark:bg-amber-500/5 px-3 py-2 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <span>✦</span>
                      <span>{isAr ? 'قبل التحسين' : 'Before'}</span>
                    </div>
                    <div
                      dir="rtl"
                      className="whitespace-pre-wrap text-[12px] leading-7 text-amber-900/70 dark:text-amber-200/50 line-through decoration-amber-400/40 [font-family:'Noto_Sans_Arabic','Segoe_UI','Tahoma','Arial',sans-serif]"
                    >
                      {gccOriginalLyrics}
                    </div>
                  </div>
                )}
                <div className="rounded-xl border border-emerald-300/50 dark:border-emerald-400/20 bg-emerald-50/60 dark:bg-emerald-500/5 px-3 py-2 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span>✦</span>
                    <span>{isAr ? 'بعد التحسين الخليجي' : 'Khaliji Enhanced'}</span>
                  </div>
                  <div
                    dir={/[\u0600-\u06FF]/.test(lyricsText) ? 'rtl' : 'ltr'}
                    className="whitespace-pre-wrap text-base leading-8 text-[#060541] dark:text-white [font-family:'Noto_Sans_Arabic','Segoe_UI','Tahoma','Arial',sans-serif]"
                  >
                    {lyricsText || (isAr ? 'اكتب فكرة أو كلمات أولاً، ثم اضغط Amp...' : 'Write an idea or some lyrics first, then click Amp →')}
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setLyricsDisplayMode(false); setGccOriginalLyrics(''); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border border-[#d9dde7] dark:border-white/10 bg-[#fcfefd] dark:bg-white/[0.04] text-[#060541] dark:text-white/80 hover:bg-[#f7f8fc] dark:hover:bg-white/[0.08] active:scale-95 transition-all"
                  >
                    <Pencil className="h-3 w-3" />
                    {isAr ? 'تعديل' : 'Edit'}
                  </button>
                </div>
              </div>
            ) : (
              <Textarea
                key={lyricsKey}
                value={lyricsText}
                dir={/[\u0600-\u06FF]/.test(lyricsText) ? 'rtl' : 'ltr'}
                onChange={(e) => {
                  if (isGccEnhanceRef.current) return;
                  const raw = e.target.value || '';
                  const capped = Array.from(raw).slice(0, lyricsCap).join('');
                  setLyricsText(capped);
                }}
                placeholder={isAr ? 'اكتب فكرة أو كلمات أولاً، ثم اضغط Amp...' : 'Write an idea or some lyrics first, then click Amp →'}
                rows={5}
                className="bg-[#fcfefd] dark:bg-white/[0.04] border-[#d9dde7] dark:border-white/10 shadow-[0_4px_12px_rgba(6,5,65,0.04)] dark:shadow-none focus:border-purple-400/50 focus:ring-purple-400/20 rounded-xl resize-none text-base leading-8 text-right [font-family:'Noto_Sans_Arabic','Segoe_UI','Tahoma','Arial',sans-serif]"
              />
            )}
            <div className="flex justify-end text-[10px] text-muted-foreground/70 dark:text-muted-foreground/50">
              <span>{Array.from(lyricsText).length}/{lyricsCap}</span>
            </div>

            <p className="text-[11px] font-semibold text-[#606062] dark:text-white/60 text-center">
              {isAr ? 'اقرأ الكلمات جيدًا قبل الإنشاء، الذكاء الاصطناعي ليس إنسانًا 😉' : 'Please read the lyrics carefully before generating, AI is not human 😉'}
            </p>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowAdvancedSliders((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                  showAdvancedSliders
                    ? 'bg-sky-50 dark:bg-sky-500/15 border-sky-300 dark:border-sky-400/40 text-sky-700 dark:text-sky-200'
                    : 'bg-[#fcfefd] dark:bg-white/[0.04] border-[#d9dde7] dark:border-white/10 text-[#060541] dark:text-white/80 hover:bg-[#f7f8fc] dark:hover:bg-white/[0.08]'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {isAr ? 'خيارات متقدمة' : 'Advanced'}
              </button>
              <div className="flex items-center gap-2">
                {(tempoOverride || keyOverride) && (
                  <button
                    type="button"
                    onClick={() => { setTempoOverride(''); setKeyOverride(''); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#d9dde7] dark:border-white/10 bg-[#fcfefd] dark:bg-white/[0.04] text-[#606062] dark:text-white/60 hover:bg-[#f7f8fc] dark:hover:bg-white/[0.08] active:scale-95 transition-all"
                  >
                    {isAr ? 'إعادة تلقائي' : 'Reset to auto'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const cb = buildKhalijiControlBlock();
                      const instrumental = vocalType === 'none';
                      const vocalGender: 'm' | 'f' | undefined =
                        vocalType === 'male' ? 'm' : vocalType === 'female' ? 'f' : undefined;
                      const durationTarget = Math.min(200, duration);
                      const rawLyrics = lyricsText.trim() || styleText.trim();
                      const primaryStyleForCue = effectiveIncludeTags[0] ? (STYLE_ANCHORS[effectiveIncludeTags[0]] ?? '') : '';
                      const cueVocal: 'male' | 'female' | 'none' = vocalType === 'male' || vocalType === 'female' ? vocalType : 'none';
                      const structuredPrompt = formatLyricsWithStructure(
                        rawLyrics,
                        instrumental,
                        instrumentTags,
                        isGccStyleSelected,
                        durationTarget,
                        cueVocal,
                        primaryStyleForCue,
                        cb.family,
                      );
                      const preview = {
                        title: title.trim(),
                        customMode: true,
                        instrumental,
                        vocalGender: vocalGender ?? null,
                        duration_seconds: durationTarget,
                        style: cb.styleString,
                        prompt: instrumental ? null : structuredPrompt,
                        tempoHint: cb.tempoTag,
                        musicalKeyHint: cb.keyTag,
                        controlBlock: cb.controlBlock,
                        structurePlan: cb.structurePlan,
                        recipeVersion: cb.usingRecipeV1 ? 'wakti-recipe-v1' : 'legacy',
                        family: cb.family,
                      };
                      setPayloadPreview(JSON.stringify(preview, null, 2));
                      setShowPayloadPreview(true);
                    } catch (e) {
                      toast.error((e as Error).message || 'Preview failed');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#d9dde7] dark:border-white/10 bg-[#fcfefd] dark:bg-white/[0.04] text-[#060541] dark:text-white/80 hover:bg-[#f7f8fc] dark:hover:bg-white/[0.08] active:scale-95 transition-all"
                  title={isAr ? 'معاينة الحمولة المرسلة' : 'Preview the exact payload sent to KIE'}
                >
                  <Info className="h-3.5 w-3.5" />
                  {isAr ? 'معاينة الحمولة' : 'Preview payload'}
                </button>
              </div>
            </div>

            {showAdvancedSliders && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={tempoOverride}
                  onChange={(e) => setTempoOverride(e.target.value || '')}
                  title={isAr ? 'السرعة' : 'Tempo'}
                  className="px-3 py-2 rounded-xl border border-[#d9dde7] dark:border-white/10 bg-[#fcfefd] dark:bg-white/[0.04] shadow-[0_4px_12px_rgba(6,5,65,0.04)] dark:shadow-none text-foreground text-sm focus:border-sky-400/50 focus:outline-none"
                >
                  {tempoOverrideOptions.map((option) => (
                    <option key={option.value || 'auto'} value={option.value}>
                      {isAr ? option.ar : option.en}
                    </option>
                  ))}
                </select>
                <select
                  value={keyOverride}
                  onChange={(e) => setKeyOverride(e.target.value || '')}
                  title={isAr ? 'المفتاح' : 'Key'}
                  className="px-3 py-2 rounded-xl border border-[#d9dde7] dark:border-white/10 bg-[#fcfefd] dark:bg-white/[0.04] shadow-[0_4px_12px_rgba(6,5,65,0.04)] dark:shadow-none text-foreground text-sm focus:border-sky-400/50 focus:outline-none"
                >
                  {keyOverrideOptions.map((option) => (
                    <option key={option.value || 'auto'} value={option.value}>
                      {isAr ? option.ar : option.en}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <select
                value={duration}
                onChange={(e) => {
                  const nextDuration = parseInt(e.target.value || '30', 10);
                  setDuration([30, 60, 90, 120, 150, 200].includes(nextDuration) ? nextDuration : 30);
                }}
                title={isAr ? 'المدة' : 'Duration'}
                className="flex-shrink-0 px-3 py-2 rounded-xl border border-[#d9dde7] dark:border-white/10 bg-[#fcfefd] dark:bg-white/[0.04] shadow-[0_4px_12px_rgba(6,5,65,0.04)] dark:shadow-none text-foreground text-sm focus:border-sky-400/50 focus:outline-none"
              >
                <option value={30}>0:30</option>
                <option value={60}>1:00</option>
                <option value={90}>1:30</option>
                <option value={120}>2:00</option>
                <option value={150}>2:30</option>
                <option value={200}>3:20</option>
              </select>
              <button
                type="button"
                disabled={overLimit || submitting || !title.trim() || (vocalType !== 'none' && !lyricsText.trim())}
                onClick={handleGenerate}
                className="flex-1 relative overflow-hidden h-12 rounded-2xl font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-sky-500 via-blue-600 to-purple-600 text-white shadow-[0_4px_24px_hsla(210,100%,65%,0.4)]"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isAr ? 'جارٍ الإنشاء...' : 'Creating...'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Music className="h-4 w-4" />
                    {isAr ? 'إنشاء موسيقى' : 'Generate Music'}
                  </span>
                )}
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </button>
            </div>
          </div>

        {showPayloadPreview && createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowPayloadPreview(false)}
          >
            <div
              className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-[#fcfefd] dark:bg-[#0c0f14] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#d9dde7] dark:border-white/10">
                <div className="text-sm font-bold text-[#060541] dark:text-white">
                  {isAr ? 'معاينة الحمولة المرسلة' : 'Payload preview'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(payloadPreview);
                      toast.success(isAr ? 'تم النسخ' : 'Copied');
                    }}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-[#d9dde7] dark:border-white/10 bg-[#fcfefd] dark:bg-white/[0.04] text-[#060541] dark:text-white/80 hover:bg-[#f7f8fc] dark:hover:bg-white/[0.08]"
                  >
                    {isAr ? 'نسخ' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPayloadPreview(false)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-[#d9dde7] dark:border-white/10 bg-[#fcfefd] dark:bg-white/[0.04] text-[#606062] dark:text-white/60 hover:bg-[#f7f8fc] dark:hover:bg-white/[0.08]"
                  >
                    {isAr ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              </div>
              <pre className="flex-1 overflow-auto p-4 text-[11px] leading-relaxed text-[#060541] dark:text-white/80 whitespace-pre-wrap break-words font-mono">
{payloadPreview}
              </pre>
            </div>
          </div>,
          document.body,
        )}

        {lastError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-400/20 text-red-300 text-xs">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {lastError}
          </div>
        )}

        {lastNotice && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-200 text-xs">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {lastNotice}
          </div>
        )}
        </div>
      )}

      {/* ── Generating State ── */}
      {submitting && generatingTask && (
        <GeneratingWidget isAr={isAr} />
      )}

      {/* ── Results: Two Variations ── */}
      {generatedTracks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" />
            <span className="text-xs font-semibold text-sky-300 uppercase tracking-widest">{isAr ? 'نتائجك' : 'Your Results'}</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {generatedTracks.map((track, idx) => (
              <div key={track.id + '-' + idx}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] backdrop-blur-sm shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
              >
                {/* Ambient glow */}
                <div className="absolute inset-0 pointer-events-none opacity-30"
                  style={{ background: `radial-gradient(ellipse 80% 60% at 20% 50%, hsla(210,100%,65%,0.15), transparent)` }} />

                <div className="relative p-4 flex gap-4 items-start">
                  {/* Cover art */}
                  <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-sky-900/50 to-purple-900/50 border border-white/10 shadow-lg">
                    {track.coverUrl ? (
                      <img src={track.coverUrl} alt={track.title || 'cover'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="h-7 w-7 text-sky-400/60" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-sm text-foreground truncate">{track.title || (isAr ? 'موسيقى وقتي' : 'Wakti Music')}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">
                          V{idx + 1}
                        </span>
                        {track.duration && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/20">
                            {Math.floor(track.duration / 60)}:{String(Math.round(track.duration % 60)).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    </div>
                    {track.audioUrl && (
                      <AudioPlayer src={track.audioUrl} className="w-full" />
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="relative px-4 pb-4 flex items-center gap-2 justify-end flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSaveGeneratedTrack(track.id)}
                    disabled={savedTrackIds.includes(track.id) || savingTrackIds.includes(track.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-emerald-400/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 active:scale-95 transition-all disabled:opacity-60"
                  >
                    {savingTrackIds.includes(track.id)
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Save className="h-3 w-3" />}
                    {savedTrackIds.includes(track.id)
                      ? (isAr ? 'تم الحفظ' : 'Saved')
                      : (isAr ? 'حفظ' : 'Save')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground/60">
            {isAr ? 'اختر المقاطع التي تريد حفظها في تبويب المحفوظات.' : 'Choose which tracks you want to save to the Saved tab.'}
          </p>
        </div>
      )}

      {/* Empty state before first generation */}
      {generatedTracks.length === 0 && !submitting && (
        <div className="text-center py-6">
          <p className="text-xs text-muted-foreground/50">
            {isAr ? 'يمكنك حفظ المقاطع التي تعجبك في تبويب المحفوظات.' : 'You can save the tracks you like to the Saved tab.'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type SavedTrack = {
  id: string;
  created_at: string;
  task_id: string | null;
  title: string | null;
  prompt: string | null;
  include_styles: string[] | null;
  requested_duration_seconds: number | null;
  duration: number | null;
  cover_url: string | null;
  signed_url: string | null;
  storage_path: string | null;
  mime: string | null;
  share_code?: string | null;
  meta: Record<string, unknown> | null;
  play_url?: string | null;
};

type Playlist = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  isSystem?: boolean;
};

// ─── Playlist storage helpers (Supabase-backed) ───────────────────────────────
const PL_KEY = 'wakti_music_playlists'; // kept only for one-time migration of old local data
function getLocalPlaylists(): Playlist[] {
  try { return JSON.parse(localStorage.getItem(PL_KEY) || '[]'); } catch { return []; }
}
function clearLocalPlaylists() {
  try { localStorage.removeItem(PL_KEY); } catch { /* ignore */ }
}
const PL_BG_KEY = 'wakti-pl-bg-active';
const PL_IDX_KEY = 'wakti-pl-bg-idx';
const PL_ID_KEY = 'wakti-pl-bg-id';

function PlaylistPlayer({ playlist, tracks, isAr, onClose }: {
  playlist: Playlist;
  tracks: SavedTrack[];
  isAr: boolean;
  onClose: () => void;
}) {
  const plTracks = playlist.trackIds
    .map(id => tracks.find(t => t.id === id))
    .filter(Boolean) as SavedTrack[];

  const [shuffle, setShuffle] = useState(false);
  const [loopMode, setLoopMode] = useState<'none' | 'one' | 'all'>(() => {
    try { return (bgAudio.loopMode as 'none' | 'one' | 'all') || 'none'; } catch { return 'none'; }
  });

  // Restore idx from sessionStorage if bg was active for this playlist
  const [currentIdx, setCurrentIdx] = useState(() => {
    try {
      if (sessionStorage.getItem(PL_BG_KEY) === '1' && sessionStorage.getItem(PL_ID_KEY) === playlist.id) {
        return parseInt(sessionStorage.getItem(PL_IDX_KEY) || '0', 10) || 0;
      }
    } catch {}
    return 0;
  });

  const [bgActive, setBgActive] = useState(() => {
    try { return sessionStorage.getItem(PL_BG_KEY) === '1' && sessionStorage.getItem(PL_ID_KEY) === playlist.id; }
    catch { return false; }
  });
  const bgActiveRef = useRef(bgActive);
  useEffect(() => { bgActiveRef.current = bgActive; }, [bgActive]);

  // Keep loopModeRef in sync and update bgAudio
  useEffect(() => {
    loopModeRef.current = loopMode;
    bgAudio.setLoopMode(loopMode);
  }, [loopMode]);

  // Wire bgAudio track-change callback so module-level advancement updates React idx
  useEffect(() => {
    bgAudio.setOnTrackChange((idx) => setCurrentIdx(idx));
    return () => { bgAudio.setOnTrackChange(null); };
  }, []);

  const [order, setOrder] = useState<number[]>(() => plTracks.map((_, i) => i));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const orderRef = useRef<number[]>(order);
  const currentIdxRef = useRef(currentIdx);
  const loopModeRef = useRef(loopMode);
  const desiredPlayingRef = useRef(false);
  const handleEndedRef = useRef<() => void>(() => {});
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const isScrubbingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const actualIdx = order[currentIdx] ?? 0;
  const current = plTracks[actualIdx];

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    currentIdxRef.current = currentIdx;
  }, [currentIdx]);

  useEffect(() => {
    if (shuffle) {
      const shuffled = [...plTracks.map((_, i) => i)].sort(() => Math.random() - 0.5);
      setOrder(shuffled);
    } else {
      setOrder(plTracks.map((_, i) => i));
    }
    setCurrentIdx(0);
  }, [shuffle, plTracks.length]);

  useEffect(() => {
    const url = current?.play_url;
    if (!url) return;

    // Persist current idx for remount restoration
    try {
      sessionStorage.setItem(PL_IDX_KEY, String(currentIdxRef.current));
    } catch {}

    // Teardown previous private audio if not bg mode
    if (!bgActiveRef.current && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    // In bg mode, attach to the already-playing singleton — don't reset display
    let audio: HTMLAudioElement;
    if (bgActiveRef.current) {
      audio = bgAudio.getOrCreate(url, false);
      audioRef.current = audio;
      // Immediately sync UI from live audio state
      const ct = audio.currentTime || 0;
      const dur = audio.duration || 0;
      setCurrentTime(ct);
      setDuration(dur);
      setProgress(dur > 0 ? (ct / dur) * 100 : 0);
      setIsPlaying(!audio.paused);
      desiredPlayingRef.current = !audio.paused;
    } else {
      audio = new Audio(url);
      audio.preload = 'auto';
      audioRef.current = audio;
      setCurrentTime(0);
      setProgress(0);
      setDuration(0);
    }

    const startPlayback = () => {
      if (!desiredPlayingRef.current) return;
      emitEvent('wakti-audio-play', { playerId: 'playlist-player' });
      audio.play().catch(() => {});
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0);
    };

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleCanPlay = () => startPlayback();

    const handleEnded = () => {
      const next = currentIdxRef.current + 1;
      if (next < orderRef.current.length) {
        desiredPlayingRef.current = true;
        setCurrentIdx(next);
        try { sessionStorage.setItem(PL_IDX_KEY, String(next)); } catch {}
      } else if (loopModeRef.current === 'all') {
        desiredPlayingRef.current = true;
        setCurrentIdx(0);
        try { sessionStorage.setItem(PL_IDX_KEY, '0'); } catch {}
      } else {
        desiredPlayingRef.current = false;
        setIsPlaying(false);
      }
    };
    handleEndedRef.current = handleEnded;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    if (bgActiveRef.current) {
      // bgAudio manages ended internally — just attach UI listeners and sync state
      desiredPlayingRef.current = true;
      if (audio.paused) audio.play().catch(() => {});
      if (audio.readyState >= 2) {
        setDuration(audio.duration || 0);
        setCurrentTime(audio.currentTime);
        setIsPlaying(!audio.paused);
      }
    } else if (desiredPlayingRef.current) {
      startPlayback();
      audio.load();
    } else {
      audio.load();
    }

    return () => {
      if (!bgActiveRef.current) {
        audio.pause();
        audio.src = '';
      } else {
        // Just detach UI listeners — bgAudio keeps the persistent onEnded
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        return;
      }
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [current?.id]);

  useEffect(() => {
    return onEvent('wakti-audio-play', (detail) => {
      if (bgActiveRef.current) return; // shared bg audio — never pause
      if (detail.playerId !== 'playlist-player' && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    });
  }, []);

  const toggleBgActive = () => {
    const next = !bgActive;
    setBgActive(next);
    bgActiveRef.current = next;
    if (next) {
      try {
        sessionStorage.setItem(PL_BG_KEY, '1');
        sessionStorage.setItem(PL_ID_KEY, playlist.id);
        sessionStorage.setItem(PL_IDX_KEY, String(currentIdxRef.current));
      } catch {}
      // Build full ordered URL list
      const urls = orderRef.current
        .map(ti => plTracks[ti]?.play_url)
        .filter(Boolean) as string[];
      // Adopt the already-playing private audio so playback continues uninterrupted
      const currentUrl = urls[currentIdxRef.current];
      if (audioRef.current && currentUrl) {
        bgAudio.adoptAudio(audioRef.current, currentUrl);
      }
      bgAudio.startPlaylist(urls, currentIdxRef.current, loopModeRef.current, (idx) => setCurrentIdx(idx));
    } else {
      try {
        sessionStorage.removeItem(PL_BG_KEY);
        sessionStorage.removeItem(PL_ID_KEY);
        sessionStorage.removeItem(PL_IDX_KEY);
      } catch {}
      bgAudio.stop();
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      desiredPlayingRef.current = false;
      audio.pause();
    } else {
      desiredPlayingRef.current = true;
      emitEvent('wakti-audio-play', { playerId: 'playlist-player' });
      audio.play().catch(() => {});
    }
  };

  const goNext = () => {
    desiredPlayingRef.current = isPlaying || desiredPlayingRef.current;
    if (bgActiveRef.current) { bgAudio.next(); return; }
    const next = currentIdx + 1;
    if (next < order.length) setCurrentIdx(next);
    else if (loopMode === 'all') setCurrentIdx(0);
  };

  const goPrev = () => {
    desiredPlayingRef.current = isPlaying || desiredPlayingRef.current;
    if (bgActiveRef.current) { bgAudio.prev(); return; }
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const b = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - b.left) / b.width) * duration;
  };

  const seekToClientX = (clientX: number) => {
    const audio = audioRef.current;
    const bar = progressBarRef.current;
    if (!audio || !bar || !duration) return;
    const bounds = bar.getBoundingClientRect();
    const raw = (clientX - bounds.left) / bounds.width;
    const clamped = Math.max(0, Math.min(1, raw));
    audio.currentTime = clamped * duration;
    setCurrentTime(audio.currentTime);
    setProgress(clamped * 100);
  };

  const handleProgressPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isScrubbingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    seekToClientX(e.clientX);
  };

  const handleProgressPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    seekToClientX(e.clientX);
  };

  const handleProgressPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    seekToClientX(e.clientX);
    isScrubbingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const handleProgressPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    isScrubbingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  if (!current) return null;

  const coverUrl = current.cover_url;
  const trackTitle = current.title || (isAr ? 'مقطع موسيقي' : 'Music Track');

  return (
    <div className="rounded-2xl border border-purple-400/20 bg-gradient-to-br from-purple-900/20 via-sky-900/10 to-purple-900/20 dark:from-purple-950/40 dark:to-sky-950/30 shadow-[0_8px_32px_rgba(128,0,255,0.15)] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListMusic className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-bold text-foreground truncate max-w-[130px]">{playlist.name}</span>
          <span className="text-[10px] text-muted-foreground/60">{currentIdx + 1} / {order.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Bg activator — same style as song card */}
          <button
            type="button"
            onClick={toggleBgActive}
            title={isAr ? 'تشغيل في الخلفية' : 'Play in background'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95 border ${
              bgActive
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-400 dark:text-emerald-300 shadow-[0_0_12px_hsla(142,76%,55%,0.25)]'
                : 'bg-red-500/10 border-red-400/40 text-red-400 dark:text-red-300 hover:bg-red-500/15 hover:border-red-400/60'
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            <span>{isAr ? 'تشغيل في الخلفية' : 'Play in background'}</span>
            {bgActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          </button>
          <button title={isAr ? 'إغلاق مشغل القائمة' : 'Close playlist player'} onClick={onClose} className="p-1 rounded-lg text-muted-foreground/40 hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Current track */}
      <div className="flex gap-3 items-center">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-purple-900/50 to-sky-900/50 border border-white/10">
          {coverUrl
            ? <img src={coverUrl} alt={trackTitle} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Music className="h-5 w-5 text-purple-400/60" /></div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{trackTitle}</p>
          <p className="text-[10px] text-muted-foreground/50">{fmt(currentTime)} / {fmt(duration)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div
        ref={progressBarRef}
        className="h-1.5 bg-white/10 rounded-full cursor-pointer overflow-hidden touch-none"
        onClick={seek}
        onPointerDown={handleProgressPointerDown}
        onPointerMove={handleProgressPointerMove}
        onPointerUp={handleProgressPointerUp}
        onPointerCancel={handleProgressPointerCancel}
      >
        <div className="h-full bg-gradient-to-r from-purple-400 to-sky-400 transition-all duration-100 rounded-full" style={{ width: `${progress}%` }} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <button title={isAr ? 'المقطع السابق' : 'Previous track'} onClick={goPrev} disabled={currentIdx === 0 && loopMode !== 'all'}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/10 active:scale-95 transition-all disabled:opacity-30">
          <SkipForward className="h-4 w-4 rotate-180" />
        </button>
        <button title={isAr ? 'تغريد -10 ثواني' : 'Rewind 10s'} onClick={() => { const a = audioRef.current; if (a) a.currentTime = Math.max(0, a.currentTime - 10); }}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/10 active:scale-95 transition-all">
          <RotateCcw className="h-4 w-4" />
        </button>
        <button title={isAr ? 'تشغيل أو إيقاف القائمة' : 'Play or pause playlist'} onClick={togglePlay}
          className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-sky-500 text-white shadow-[0_4px_16px_rgba(128,0,255,0.4)] hover:shadow-[0_4px_24px_rgba(128,0,255,0.6)] active:scale-95 transition-all">
          {isPlaying
            ? <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            : <Play className="h-5 w-5" />
          }
        </button>
        <button title={isAr ? 'تقدم +10 ثواني' : 'Forward 10s'} onClick={() => { const a = audioRef.current; if (a) a.currentTime = Math.min(a.duration || 0, a.currentTime + 10); }}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/10 active:scale-95 transition-all">
          <RotateCw className="h-4 w-4" />
        </button>
        <button title={isAr ? 'المقطع التالي' : 'Next track'} onClick={goNext} disabled={currentIdx >= order.length - 1 && loopMode !== 'all'}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/10 active:scale-95 transition-all disabled:opacity-30">
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      {/* Shuffle / Loop */}
      <div className="flex items-center justify-center gap-3">
        <button title={isAr ? 'تشغيل أو إيقاف العشوائي' : 'Toggle shuffle'} onClick={() => setShuffle(v => !v)}
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold border transition-all active:scale-95 ${shuffle ? 'border-purple-400/50 bg-purple-500/15 text-purple-300' : 'border-white/10 text-muted-foreground hover:border-white/20'}`}>
          <Shuffle className="h-3 w-3" />{isAr ? 'عشوائي' : 'Shuffle'}
        </button>
        <button
          title={isAr ? 'وضع التكرار' : 'Loop mode'}
          onClick={() => setLoopMode(m => m === 'none' ? 'one' : m === 'one' ? 'all' : 'none')}
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold border transition-all active:scale-95 ${
            loopMode === 'none' ? 'border-white/10 text-muted-foreground hover:border-white/20'
            : loopMode === 'one' ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
            : 'border-sky-400/50 bg-sky-500/15 text-sky-300'
          }`}>
          <Repeat className="h-3 w-3" />
          {loopMode === 'none' ? (isAr ? 'تكرار' : 'Loop') : loopMode === 'one' ? (isAr ? 'تكرار واحد' : 'Loop One') : (isAr ? 'تكرار الكل' : 'Loop All')}
        </button>
      </div>

      {/* Track list */}
      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
        {order.map((trackIdx, i) => {
          const t = plTracks[trackIdx];
          if (!t) return null;
          const tTitle = t.title || (isAr ? 'مقطع موسيقي' : 'Music Track');
          return (
            <button key={t.id} onClick={() => setCurrentIdx(i)}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all active:scale-[0.98] ${i === currentIdx ? 'bg-purple-500/20 text-foreground' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'}`}>
              {i === currentIdx && <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0 animate-pulse" />}
              {i !== currentIdx && <div className="w-1.5 h-1.5 rounded-full bg-white/10 flex-shrink-0" />}
              <span className="text-xs truncate">{tTitle}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── MusicTrackYouTubeDialog ────────────────────────────────────────────────────
function MusicTrackYouTubeDialog({
  track,
  language,
  onClose,
  onPublished,
  onVideoRendered,
}: {
  track: { id: string; title: string | null; prompt: string | null; cover_url: string | null; play_url?: string | null; storage_path: string | null; meta?: Record<string, unknown> | null };
  language: string;
  onClose: () => void;
  onPublished?: (videoUrl: string) => void;
  onVideoRendered?: (videoUrl: string) => void;
}) {
  const isAr = language === 'ar';
  const { user } = useAuth();
  const SUPABASE_URL_LOCAL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://hxauxozopvpzpdygoqwf.supabase.co';

  type CoverMode = 'default' | 'upload' | 'saved';
  type Stage = 'pick' | 'rendering' | 'publish';

  // If a video was already rendered for this track, skip straight to the publish stage.
  const existingVideoUrl = (track.meta as any)?.video_url as string | undefined;

  const [stage, setStage] = useState<Stage>(existingVideoUrl ? 'publish' : 'pick');
  const [coverMode, setCoverMode] = useState<CoverMode>('default');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [savedImages, setSavedImages] = useState<Array<{ id: string; image_url: string }>>([]);
  const [savedImagesLoading, setSavedImagesLoading] = useState(false);
  const [savedImagesOpen, setSavedImagesOpen] = useState(false);
  const [selectedSavedImageUrl, setSelectedSavedImageUrl] = useState<string | null>(null);
  const [visualizerOn, setVisualizerOn] = useState(false);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(existingVideoUrl || null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveCover =
    coverMode === 'upload' ? uploadedImageUrl :
    coverMode === 'saved' ? selectedSavedImageUrl :
    track.cover_url;

  const previewCoverSrc =
    coverMode === 'upload' ? (uploadedImagePreview || uploadedImageUrl) :
    coverMode === 'saved' ? selectedSavedImageUrl :
    track.cover_url;

  const getAudioUrl = () => {
    if (track.play_url) return track.play_url;
    if (track.storage_path) {
      const base = SUPABASE_URL_LOCAL.replace(/\/$/, '');
      const path = track.storage_path.startsWith('/') ? track.storage_path.slice(1) : track.storage_path;
      return `${base}/storage/v1/object/public/music/${path}`;
    }
    return null;
  };

  const loadSavedImages = async () => {
    if (!user) return;
    setSavedImagesLoading(true);
    try {
      const { data } = await (supabase as any)
        .from('user_generated_images')
        .select('id, image_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      setSavedImages(data || []);
    } catch { /* ignore */ } finally {
      setSavedImagesLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(isAr ? 'الصورة أكبر من 10MB' : 'Image must be under 10MB');
      return;
    }
    setUploadedImagePreview(URL.createObjectURL(file));
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `yt-covers/${user.id}/${track.id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('images').upload(path, file, { contentType: file.type, upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
      setUploadedImageUrl(pub?.publicUrl || null);
      setCoverMode('upload');
    } catch {
      toast.error(isAr ? 'فشل رفع الصورة' : 'Image upload failed');
      setUploadedImagePreview(null);
    }
  };

  const handleRender = async () => {
    const audioUrl = getAudioUrl();
    if (!audioUrl) { toast.error(isAr ? 'ملف الصوت غير متاح' : 'Audio file not available'); return; }
    if (!effectiveCover) { toast.error(isAr ? 'يرجى اختيار صورة أولاً' : 'Please choose a cover image first'); return; }
    if (!user) { toast.error(isAr ? 'يجب تسجيل الدخول أولاً' : 'Please log in first'); return; }

    setStage('rendering');
    setRenderError(null);
    setRenderProgress(0);

    try {
      // Load the cover image
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = effectiveCover!;
      });

      // Load the audio
      const audioCtx = new AudioContext();
      const audioResp = await fetch(audioUrl);
      const audioArrayBuffer = await audioResp.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(audioArrayBuffer);
      const durationSec = audioBuffer.duration;

      setRenderProgress(10);

      // Set up canvas 1280×720
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d')!;

      // Pre-compute cover image layout
      const scale = Math.min(1280 / img.width, 720 / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (1280 - w) / 2;
      const y = (720 - h) / 2;

      // Canvas video stream
      const videoStream = (canvas as any).captureStream(25) as MediaStream;

      // Audio stream via Web Audio → MediaStreamDestination
      const dest = audioCtx.createMediaStreamDestination();
      const src = audioCtx.createBufferSource();
      src.buffer = audioBuffer;

      // Analyser for visualizer (only wired when visualizerOn)
      let analyser: AnalyserNode | null = null;
      let timeData: Uint8Array | null = null;
      if (visualizerOn) {
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.85;
        timeData = new Uint8Array(analyser.fftSize);
        src.connect(analyser);
        analyser.connect(dest);
      } else {
        src.connect(dest);
      }

      // Animation loop — redraws every frame so MediaRecorder captures motion
      let rafId = 0;
      const drawFrame = () => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 1280, 720);
        ctx.drawImage(img, x, y, w, h);

        if (visualizerOn && analyser && timeData) {
          analyser.getByteTimeDomainData(timeData);

          const baseY = 620;
          const waveHeight = 78;
          const pointCount = 180;
          const slice = Math.max(1, Math.floor(timeData.length / pointCount));

          ctx.save();

          const glowGradient = ctx.createLinearGradient(0, baseY - waveHeight, 0, baseY + waveHeight);
          glowGradient.addColorStop(0, 'hsla(190, 85%, 70%, 0.18)');
          glowGradient.addColorStop(1, 'hsla(280, 80%, 65%, 0.06)');

          ctx.beginPath();
          ctx.moveTo(0, baseY);
          for (let i = 0; i < pointCount; i++) {
            const sample = timeData[Math.min(timeData.length - 1, i * slice)];
            const normalized = (sample - 128) / 128;
            const px = (i / (pointCount - 1)) * 1280;
            const py = baseY + normalized * waveHeight;
            ctx.lineTo(px, py);
          }
          ctx.lineTo(1280, 720);
          ctx.lineTo(0, 720);
          ctx.closePath();
          ctx.fillStyle = glowGradient;
          ctx.fill();

          ctx.beginPath();
          for (let i = 0; i < pointCount; i++) {
            const sample = timeData[Math.min(timeData.length - 1, i * slice)];
            const normalized = (sample - 128) / 128;
            const px = (i / (pointCount - 1)) * 1280;
            const py = baseY + normalized * waveHeight;
            if (i === 0) {
              ctx.moveTo(px, py);
            } else {
              ctx.lineTo(px, py);
            }
          }

          const strokeGradient = ctx.createLinearGradient(0, baseY - waveHeight, 1280, baseY + waveHeight);
          strokeGradient.addColorStop(0, 'hsla(185, 100%, 78%, 0.95)');
          strokeGradient.addColorStop(0.5, 'hsla(210, 100%, 72%, 1)');
          strokeGradient.addColorStop(1, 'hsla(280, 85%, 72%, 0.95)');
          ctx.strokeStyle = strokeGradient;
          ctx.lineWidth = 5;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.shadowColor = 'hsla(210, 100%, 70%, 0.7)';
          ctx.shadowBlur = 18;
          ctx.stroke();

          ctx.beginPath();
          for (let i = 0; i < pointCount; i++) {
            const sample = timeData[Math.min(timeData.length - 1, i * slice)];
            const normalized = (sample - 128) / 128;
            const px = (i / (pointCount - 1)) * 1280;
            const py = baseY + normalized * waveHeight;
            if (i === 0) {
              ctx.moveTo(px, py);
            } else {
              ctx.lineTo(px, py);
            }
          }
          ctx.strokeStyle = 'hsla(0, 0%, 100%, 0.9)';
          ctx.lineWidth = 1.6;
          ctx.shadowBlur = 0;
          ctx.stroke();

          ctx.restore();
        }

        rafId = requestAnimationFrame(drawFrame);
      };
      drawFrame();

      // Combine streams
      const combined = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      // Pick best supported video format
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';

      const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 2_500_000 });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      setRenderProgress(15);

      // Start recording
      recorder.start(500);
      src.start(0);

      // Progress ticker
      const startTime = Date.now();
      const ticker = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const pct = Math.min(95, 15 + (elapsed / durationSec) * 80);
        setRenderProgress(Math.round(pct));
      }, 500);

      // Wait for audio to finish
      await new Promise<void>((res) => { src.onended = () => res(); });

      clearInterval(ticker);
      cancelAnimationFrame(rafId);
      recorder.stop();
      await audioCtx.close();

      setRenderProgress(97);

      // Collect blob
      const videoBlob = await new Promise<Blob>((res) => {
        recorder.onstop = () => res(new Blob(chunks, { type: mimeType }));
      });

      setRenderProgress(98);

      // Upload to Supabase videos bucket
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const fileName = `music-videos/${user.id}/${track.id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('videos').upload(fileName, videoBlob, {
        contentType: mimeType.split(';')[0],
        upsert: true,
      });
      if (uploadErr) throw uploadErr;

      const { data: pubData } = supabase.storage.from('videos').getPublicUrl(fileName);
      const videoUrl = pubData?.publicUrl || null;
      if (!videoUrl) throw new Error(isAr ? 'لم يتم إنشاء الفيديو' : 'Video was not created');

      setRenderProgress(100);
      setRenderedVideoUrl(videoUrl);
      onVideoRendered?.(videoUrl);
      setStage('publish');
    } catch (err: unknown) {
      setRenderError(err instanceof Error ? err.message : (isAr ? 'فشل تحويل الصوت لفيديو' : 'Failed to convert audio to video'));
      setStage('pick');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-[#0c0f14] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-red-500/15 border border-red-400/30 flex items-center justify-center">
              <Youtube className="h-3.5 w-3.5 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {stage === 'publish' ? (isAr ? 'نشر على يوتيوب' : 'Publish to YouTube') : (isAr ? 'نشر الأغنية على يوتيوب' : 'Publish Song to YouTube')}
              </p>
              {stage === 'pick' && <p className="text-[11px] text-white/50 mt-0.5">{isAr ? 'اختر غلافاً ثم اضغط تحويل' : 'Choose a cover then tap Render'}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={isAr ? 'إغلاق' : 'Close'} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[82vh] overflow-y-auto">
          {stage === 'pick' && (
            <>
              {/* Cover preview */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
                <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-white/10 border border-white/10">
                  {previewCoverSrc
                    ? <img src={previewCoverSrc} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Music className="h-5 w-5 text-white/30" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{track.title || (isAr ? 'مقطع موسيقي' : 'Music Track')}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{isAr ? 'فيديو 16:9 على يوتيوب' : '16:9 YouTube video'}</p>
                </div>
              </div>

              <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">{isAr ? 'صورة الغلاف' : 'Cover Image'}</p>

              {/* Option 1: Default cover */}
              <button type="button" onClick={() => { setCoverMode('default'); setSavedImagesOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.98] ${coverMode === 'default' ? 'border-sky-400/50 bg-sky-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
                <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-white/10 border border-white/10">
                  {track.cover_url ? <img src={track.cover_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Music className="h-4 w-4 text-white/30" /></div>}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-white">{isAr ? 'غلاف الأغنية الافتراضي' : 'Default song cover'}</p>
                  <p className="text-[11px] text-white/45 mt-0.5">{isAr ? 'الغلاف المحفوظ مع المقطع' : 'Cover saved with this track'}</p>
                </div>
                {coverMode === 'default' && <CheckCircle2 className="h-4 w-4 text-sky-400 flex-shrink-0" />}
              </button>

              {/* Option 2: Upload */}
              <button type="button" onClick={() => { fileInputRef.current?.click(); setSavedImagesOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.98] ${coverMode === 'upload' ? 'border-sky-400/50 bg-sky-500/10' : 'border-dashed border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
                {uploadedImagePreview || uploadedImageUrl
                  ? <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border border-white/10"><img src={uploadedImagePreview || uploadedImageUrl || ''} alt="" className="w-full h-full object-cover" /></div>
                  : <div className="w-11 h-11 rounded-xl flex-shrink-0 bg-white/[0.04] border border-white/10 flex items-center justify-center"><ImagePlus className="h-4 w-4 text-white/30" /></div>}
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-white">{isAr ? 'رفع صورة من جهازك' : 'Upload from device'}</p>
                  <p className="text-[11px] text-white/45 mt-0.5">JPG, PNG — {isAr ? 'حتى 10MB' : 'up to 10MB'}</p>
                </div>
                {coverMode === 'upload' && uploadedImageUrl && <CheckCircle2 className="h-4 w-4 text-sky-400 flex-shrink-0" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                aria-label={isAr ? 'رفع صورة مخصصة' : 'Upload custom cover image'} onChange={handleImageUpload} />

              {/* Option 3: Saved images */}
              <div>
                <button type="button"
                  onClick={() => { setSavedImagesOpen(v => !v); if (!savedImagesOpen && savedImages.length === 0) loadSavedImages(); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.98] ${coverMode === 'saved' ? 'border-sky-400/50 bg-sky-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
                  {coverMode === 'saved' && selectedSavedImageUrl
                    ? <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border border-white/10"><img src={selectedSavedImageUrl} alt="" className="w-full h-full object-cover" /></div>
                    : <div className="w-11 h-11 rounded-xl flex-shrink-0 bg-white/[0.04] border border-white/10 flex items-center justify-center"><ImageIcon className="h-4 w-4 text-white/30" /></div>}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-white">{isAr ? 'من الصور المحفوظة' : 'Pick from saved images'}</p>
                    <p className="text-[11px] text-white/45 mt-0.5">{isAr ? 'صورك المحفوظة في وقتي' : 'Your images saved in Wakti'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {coverMode === 'saved' && selectedSavedImageUrl && <CheckCircle2 className="h-4 w-4 text-sky-400" />}
                    <ChevronDown className={`h-3.5 w-3.5 text-white/40 transition-transform ${savedImagesOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {savedImagesOpen && (
                  <div className="mt-1.5 p-2 rounded-2xl border border-white/10 bg-white/[0.02]">
                    {savedImagesLoading && (
                      <div className="py-5 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
                    )}
                    {!savedImagesLoading && savedImages.length === 0 && (
                      <p className="py-4 text-center text-xs text-white/40">{isAr ? 'لا توجد صور محفوظة' : 'No saved images'}</p>
                    )}
                    {!savedImagesLoading && savedImages.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                        {savedImages.map((img) => (
                          <div key={img.id} className="aspect-square">
                            <button type="button"
                              aria-label={isAr ? 'اختر هذه الصورة' : 'Select this image'}
                              onClick={() => { setSelectedSavedImageUrl(img.image_url); setCoverMode('saved'); setSavedImagesOpen(false); }}
                              className={`w-full h-full rounded-xl overflow-hidden border-2 transition-all active:scale-95 ${selectedSavedImageUrl === img.image_url && coverMode === 'saved' ? 'border-sky-400' : 'border-transparent hover:border-white/30'}`}>
                              <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Visualizer toggle */}
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-white/10 bg-white/[0.03]">
                <div>
                  <p className="text-sm font-semibold text-white">{isAr ? 'تأثير مرئي' : 'Visualizer effect'}</p>
                  <p className="text-[11px] text-white/45 mt-0.5">
                    {visualizerOn ? (isAr ? 'تكبير بطيء خفيف' : 'Subtle slow zoom') : (isAr ? 'صورة ثابتة — أسرع' : 'Static — faster render')}
                  </p>
                </div>
                <button type="button" role="switch" aria-checked={visualizerOn}
                  aria-label={isAr ? 'تفعيل التأثير المرئي' : 'Toggle visualizer effect'}
                  onClick={() => setVisualizerOn(v => !v)}
                  className={`relative w-11 h-6 rounded-full border transition-all flex-shrink-0 ${visualizerOn ? 'bg-sky-500 border-sky-400' : 'bg-white/10 border-white/20'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${visualizerOn ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>

              {renderError && <p className="text-xs text-red-400 text-center px-2">{renderError}</p>}

              <button type="button" onClick={handleRender} disabled={!effectiveCover}
                className="w-full py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-[0_4px_20px_rgba(239,68,68,0.35)] hover:shadow-[0_4px_28px_rgba(239,68,68,0.5)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none">
                {isAr ? 'تحويل وإعداد الفيديو' : 'Render Video'}
              </button>
            </>
          )}

          {stage === 'rendering' && (
            <div className="py-10 flex flex-col items-center gap-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center"><Youtube className="h-6 w-6 text-red-400" /></div>
              </div>
              <p className="text-sm font-semibold text-white">{isAr ? 'جاري تحويل الأغنية إلى فيديو...' : 'Converting your song into a video...'}</p>
              <div className="w-full px-2 space-y-1.5">
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-rose-400 rounded-full transition-all duration-500"
                    style={{ width: `${renderProgress}%` }}
                  />
                </div>
                <p className="text-xs text-white/40 text-center">{renderProgress}%</p>
              </div>
            </div>
          )}

          {stage === 'publish' && renderedVideoUrl && (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <p className="text-xs text-emerald-300">{isAr ? 'تم تحويل الأغنية إلى فيديو بنجاح' : 'Song successfully converted to video'}</p>
              </div>
              <YouTubePublishBar
                fileUrl={renderedVideoUrl}
                title={track.title || (isAr ? 'مقطع موسيقي من وقتي' : 'Music track from Wakti')}
                description={track.prompt || ''}
                isShort={false}
                language={language}
                onPublished={(result) => { onPublished?.(result.videoUrl); onClose(); }}
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── EditorTab ─────────────────────────────────────────────────────────────────
function EditorTab() {
  const { language } = useTheme();
  const { user } = useAuth();
  const isAr = language === 'ar';
  const WaktiShareIcon = () => <img src="/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png" alt="" className="w-full h-full object-cover rounded-full" />;

  // ── Saved sub-tab: tracks vs playlists vs posters
  const [savedSubTab, setSavedSubTab] = useState<'tracks' | 'playlists' | 'posters'>(() => {
    try { return sessionStorage.getItem(PL_BG_KEY) === '1' ? 'playlists' : 'tracks'; } catch { return 'tracks'; }
  });

  // ── Tracks
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<SavedTrack[]>([]);
  const [trackSearch, setTrackSearch] = useState('');
  const [activePlayingTrackId, setActivePlayingTrackId] = useState<string | null>(null);
  const [bgMusicTrackId, setBgMusicTrackId] = useState<string | null>(() => {
    try { return sessionStorage.getItem('wakti-bg-music-track-id') || null; } catch { return null; }
  });
  const bgMusicTrackIdRef = useRef<string | null>(bgMusicTrackId);

  const [expandedLyricsTrackId, setExpandedLyricsTrackId] = useState<string | null>(null);
  const [activeLyricsLineByTrackId, setActiveLyricsLineByTrackId] = useState<Record<string, number>>({});
  const lyricsLineRefs = useRef<Record<string, Record<number, HTMLDivElement | null>>>({});
  const lyricsWheelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const stepLyricsLineRef = useRef<(trackId: string, lineCount: number, dir: 1 | -1) => void>(() => {});
  const [shareTrackTarget, setShareTrackTarget] = useState<{ id: string; title: string; coverUrl: string | null } | null>(null);
  const [deleteTrackTarget, setDeleteTrackTarget] = useState<{ id: string; storagePath: string | null } | null>(null);
  const [trackYouTubeTarget, setTrackYouTubeTarget] = useState<SavedTrack | null>(null);

  // ── Rename track
  const [renamingTrackId, setRenamingTrackId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  const handleRenameTrack = async (trackId: string) => {
    const newTitle = renameValue.trim();
    if (!newTitle || !user) { setRenamingTrackId(null); return; }
    setRenameSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('user_music_tracks')
        .update({ title: newTitle })
        .eq('id', trackId)
        .eq('user_id', user.id);
      if (error) throw error;
      setTracks(prev => prev.map(t => t.id === trackId ? { ...t, title: newTitle } : t));
      toast.success(isAr ? 'تم تغيير الاسم' : 'Name updated');
    } catch (e: any) {
      toast.error(isAr ? 'فشل الحفظ' : 'Failed to save');
    } finally {
      setRenameSaving(false);
      setRenamingTrackId(null);
    }
  };

  // ── Bulk delete tracks
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // ── Poster & Captions
  type MusicPoster = {
    id: string;
    track_id: string;
    author: string;
    status: 'generating' | 'completed' | 'failed';
    video_url: string | null;
    created_at: string;
    kie_poster_task_id: string | null;
    youtube_video_id?: string | null;
    youtube_video_url?: string | null;
    youtube_published_at?: string | null;
  };
  const [posters, setPosters] = useState<MusicPoster[]>([]);
  const [postersLoading, setPostersLoading] = useState(false);
  const [generatingPosterTrackIds, setGeneratingPosterTrackIds] = useState<string[]>([]);
  const [expandedPosterId, setExpandedPosterId] = useState<string | null>(null);
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const loadPosters = async () => {
    if (!user) return;
    setPostersLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/music-poster?list=1`, {
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_ANON_KEY },
      });
      const json = await resp.json();
      if (json.posters) setPosters(json.posters);
    } catch (e) {
      console.error('[Posters] Load error:', e);
    } finally {
      setPostersLoading(false);
    }
  };

  const POSTER_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  const pollPoster = (posterId: string, kiePosterTaskId: string | null, startedAt: number = Date.now()) => {
    if (pollingRef.current[posterId]) return;
    pollingRef.current[posterId] = setInterval(async () => {
      // Frontend stale guard — stop polling and mark failed after 10 min
      if (Date.now() - startedAt > POSTER_TIMEOUT_MS) {
        clearInterval(pollingRef.current[posterId]);
        delete pollingRef.current[posterId];
        setPosters(prev => prev.map(p => p.id === posterId ? { ...p, status: 'failed' } : p));
        setGeneratingPosterTrackIds(prev => {
          const poster = posters.find(p => p.id === posterId);
          return poster ? prev.filter(id => id !== poster.track_id) : prev;
        });
        toast.error(isAr ? 'انتهت مهلة إنشاء البوستر' : 'Poster generation timed out');
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const params = new URLSearchParams({ posterId });
        if (kiePosterTaskId) params.set('taskId', kiePosterTaskId);
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/music-poster?${params}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_ANON_KEY },
        });
        // 500 means poster no longer exists in DB — remove ghost from state
        if (resp.status === 500 || resp.status === 404) {
          clearInterval(pollingRef.current[posterId]);
          delete pollingRef.current[posterId];
          setPosters(prev => prev.filter(p => p.id !== posterId));
          setGeneratingPosterTrackIds(prev => {
            const poster = posters.find(p => p.id === posterId);
            return poster ? prev.filter(id => id !== poster.track_id) : prev;
          });
          return;
        }
        const json = await resp.json();
        if (json.status === 'completed') {
          clearInterval(pollingRef.current[posterId]);
          delete pollingRef.current[posterId];
          setPosters(prev => prev.map(p => p.id === posterId ? { ...p, status: 'completed', video_url: json.videoUrl } : p));
          setGeneratingPosterTrackIds(prev => {
            const poster = posters.find(p => p.id === posterId);
            return poster ? prev.filter(id => id !== poster.track_id) : prev;
          });
          toast.success(isAr ? 'تم إنشاء البوستر والتسميات!' : 'Poster & Captions ready!');
        } else if (json.status === 'failed' || json.error === 'not_found') {
          clearInterval(pollingRef.current[posterId]);
          delete pollingRef.current[posterId];
          // Remove ghost poster from state entirely — don't show failed card
          setPosters(prev => prev.filter(p => p.id !== posterId));
          setGeneratingPosterTrackIds(prev => {
            const poster = posters.find(p => p.id === posterId);
            return poster ? prev.filter(id => id !== poster.track_id) : prev;
          });
          if (json.error !== 'not_found') toast.error(isAr ? 'فشل إنشاء البوستر' : 'Poster generation failed');
        }
      } catch (e) {
        console.error('[Posters] Poll error:', e);
      }
    }, 8000);
  };

  const handleCreatePoster = async (track: SavedTrack) => {
    if (!user) return;
    const taskId = track.task_id;
    const audioId = (track.meta as any)?.kie_track_id as string | undefined;
    if (!taskId) {
      toast.error(isAr ? 'هذا المقطع القديم لا يدعم البوستر' : 'This track is too old for Poster & Captions');
      return;
    }
    setGeneratingPosterTrackIds(prev => [...prev, track.id]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('display_name, username, email')
        .eq('id', user.id)
        .maybeSingle();
      const author = profile?.display_name || profile?.username || user.email?.split('@')[0] || 'Wakti User';
      console.log('[Poster] Sending to edge fn:', { trackId: track.id, taskId, audioId, author });
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/music-poster`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id, taskId, audioId, author }),
      });
      const json = await resp.json();
      if (json.error) throw new Error(json.error);
      const newPoster: MusicPoster = {
        id: json.posterId,
        track_id: track.id,
        author,
        status: json.status,
        video_url: json.videoUrl ?? null,
        created_at: new Date().toISOString(),
        kie_poster_task_id: json.taskId ?? null,
      };
      setPosters(prev => [newPoster, ...prev]);
      if (json.status === 'generating') {
        toast.info(isAr ? 'جاري إنشاء البوستر... سيستغرق بضع دقائق' : 'Generating Poster & Captions... takes a few minutes');
        pollPoster(json.posterId, json.taskId ?? null);
      } else if (json.status === 'completed') {
        setGeneratingPosterTrackIds(prev => prev.filter(id => id !== track.id));
        toast.success(isAr ? 'تم إنشاء البوستر!' : 'Poster & Captions ready!');
      }
    } catch (e: any) {
      setGeneratingPosterTrackIds(prev => prev.filter(id => id !== track.id));
      console.error('[Poster] Creation error:', e?.message || e);
      toast.error(isAr ? 'فشل إنشاء البوستر. حاول مرة أخرى.' : 'Poster creation failed. Please try again.');
    }
  };

  useEffect(() => {
    if (savedSubTab === 'posters') loadPosters();
  }, [savedSubTab, user?.id]);

  useEffect(() => {
    return () => {
      Object.values(pollingRef.current).forEach(clearInterval);
    };
  }, []);

  // ── Playlists
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [displayLimit, setDisplayLimit] = useState(60);
  const [hasMoreTracks, setHasMoreTracks] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [pickerPlaylistId, setPickerPlaylistId] = useState<string | null>(null);
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [bgPlaylistId, setBgPlaylistId] = useState<string | null>(() => {
    try { return sessionStorage.getItem(PL_BG_KEY) === '1' ? sessionStorage.getItem(PL_ID_KEY) : null; } catch { return null; }
  });
  const [deletePlaylistTarget, setDeletePlaylistTarget] = useState<Playlist | null>(null);

  const loadPlaylists = async () => {
    if (!user) return;
    setPlaylistsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('user_music_playlists')
        .select('id, name, track_ids, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const pls: Playlist[] = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        trackIds: row.track_ids || [],
        createdAt: new Date(row.created_at).getTime(),
      }));
      setPlaylists(pls);
      // Restore activePlaylist if bg music was active for a playlist
      try {
        if (sessionStorage.getItem(PL_BG_KEY) === '1') {
          const bgId = sessionStorage.getItem(PL_ID_KEY);
          if (bgId) {
            const match = pls.find(p => p.id === bgId);
            if (match) {
              setActivePlaylist(match);
              setSavedSubTab('playlists');
            }
          }
        }
      } catch {}
      // One-time migration: push any old localStorage playlists to Supabase
      if (pls.length === 0) {
        const local = getLocalPlaylists();
        if (local.length > 0) {
          const rows = local.map(pl => ({
            id: pl.id,
            user_id: user.id,
            name: pl.name,
            track_ids: pl.trackIds,
            created_at: new Date(pl.createdAt).toISOString(),
          }));
          const { error: migrateErr } = await (supabase as any)
            .from('user_music_playlists')
            .upsert(rows, { onConflict: 'id' });
          if (!migrateErr) {
            setPlaylists(local);
            clearLocalPlaylists();
          }
        }
      } else {
        clearLocalPlaylists();
      }
    } catch (e) {
      console.error('[Playlists] Load error:', e);
    } finally {
      setPlaylistsLoading(false);
    }
  };

  const load = async () => {
    if (!user) { setTracks([]); return; }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('user_music_tracks')
        .select('id, created_at, task_id, title, prompt, include_styles, requested_duration_seconds, duration, cover_url, signed_url, storage_path, mime, meta, source_audio_url, share_code')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const withUrls = (data || [])
        .filter((t: any) => {
          const status = t.meta?.status;
          const saved = t.meta?.saved;
          if (status === 'generating' || status === 'failed') return false;
          if (saved === false) return false;
          if (t.storage_path?.includes('_pending.mp3')) return false;
          if (!t.signed_url && !t.storage_path) return false;
          return true;
        })
        .map((t: any) => {
          let playUrl: string | null = null;
          if (t.storage_path) {
            const base = SUPABASE_URL.replace(/\/$/, '');
            const path = t.storage_path.startsWith('/') ? t.storage_path.slice(1) : t.storage_path;
            playUrl = `${base}/storage/v1/object/public/music/${path}`;
          }
          if (!playUrl && t.signed_url) {
            playUrl = t.signed_url;
          }
          if (!playUrl && t.source_audio_url) {
            playUrl = t.source_audio_url;
          }
          return { ...t, play_url: playUrl };
        });
      setTracks(withUrls);
      // Restore AppHeader indicator if a bg track was previously activated
      const savedBgId = bgMusicTrackIdRef.current;
      if (savedBgId) {
        const match = withUrls.find((t: any) => t.id === savedBgId);
        if (match?.play_url) {
          emitEvent('wakti-bg-music-indicator-on');
        } else {
          // Track no longer exists — clear the saved state
          bgMusicTrackIdRef.current = null;
          setBgMusicTrackId(null);
          try { sessionStorage.removeItem('wakti-bg-music-track-id'); } catch {}
        }
      }
    } catch (e) {
      console.error('[EditorTab] Load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const sortedTracks = useMemo(() => {
    return [...tracks].sort((a, b) => {
      const aFavorite = !!(a.meta as any)?.favorite;
      const bFavorite = !!(b.meta as any)?.favorite;
      if (aFavorite !== bFavorite) return aFavorite ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tracks]);

  const filteredTracks = useMemo(() => {
    const q = trackSearch.trim().toLowerCase();
    if (!q) return sortedTracks;
    return sortedTracks.filter((t) => {
      const title = (t.title || '').toLowerCase();
      const prompt = (t.prompt || '').toLowerCase();
      const styles = (t.include_styles || []).join(' ').toLowerCase();
      const metaTags = String((t.meta as any)?.tags || '').toLowerCase();
      return title.includes(q) || prompt.includes(q) || styles.includes(q) || metaTags.includes(q);
    });
  }, [sortedTracks, trackSearch]);

  const displayedTracks = useMemo(() => {
    const result = filteredTracks.slice(0, displayLimit);
    setHasMoreTracks(filteredTracks.length > displayLimit);
    return result;
  }, [filteredTracks, displayLimit]);

  const handleLoadMore = () => {
    setDisplayLimit(prev => prev + 60);
  };

  useEffect(() => { load(); loadPlaylists(); loadPosters(); }, [user?.id]);

  useEffect(() => {
    const handleReload = () => load();
    window.addEventListener('wakti-music-tracks-reload', handleReload);
    return () => window.removeEventListener('wakti-music-tracks-reload', handleReload);
  }, [user?.id]);

  useEffect(() => {
    if (activePlayingTrackId && !tracks.some((track) => track.id === activePlayingTrackId)) {
      setActivePlayingTrackId(null);
    }
  }, [tracks, activePlayingTrackId]);

  const stepLyricsLine = (trackId: string, lineCount: number, direction: 1 | -1) => {
    setActiveLyricsLineByTrackId((prev) => {
      const current = prev[trackId] ?? 0;
      const next = Math.min(lineCount - 1, Math.max(0, current + direction));
      if (next === current) return prev;
      requestAnimationFrame(() => {
        lyricsLineRefs.current[trackId]?.[next]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
      return { ...prev, [trackId]: next };
    });
  };
  stepLyricsLineRef.current = stepLyricsLine;

  useEffect(() => {
    const entries = Object.entries(lyricsWheelRefs.current);
    const cleanups: (() => void)[] = [];
    entries.forEach(([trackId, el]) => {
      if (!el) return;
      const wheelHandler = (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const lineCount = Object.keys(lyricsLineRefs.current[trackId] ?? {}).length;
        stepLyricsLineRef.current(trackId, lineCount, e.deltaY > 0 ? 1 : -1);
      };
      const touchMoveHandler = (e: TouchEvent) => {
        e.preventDefault();
      };
      el.addEventListener('wheel', wheelHandler, { passive: false });
      el.addEventListener('touchmove', touchMoveHandler, { passive: false });
      cleanups.push(() => {
        el.removeEventListener('wheel', wheelHandler);
        el.removeEventListener('touchmove', touchMoveHandler);
      });
    });
    return () => cleanups.forEach(fn => fn());
  }, [expandedLyricsTrackId]);

  const handleDeleteConfirm = async () => {
    if (!deleteTrackTarget) return;
    const { id: trackId, storagePath } = deleteTrackTarget;
    setDeleteTrackTarget(null);
    try {
      const { error: dbError } = await (supabase as any).from('user_music_tracks').delete().eq('id', trackId);
      if (dbError) throw dbError;
      if (storagePath) await supabase.storage.from('music').remove([storagePath]).catch(() => {});
      setTracks(prev => prev.filter(t => t.id !== trackId));
      toast.success(isAr ? 'تم الحذف بنجاح' : 'Deleted successfully');
    } catch (e: any) {
      toast.error((isAr ? 'فشل الحذف: ' : 'Delete failed: ') + (e?.message || String(e)));
    }
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedTrackIds.size === 0) return;
    const idsToDelete = Array.from(selectedTrackIds);
    setBulkDeleteDialogOpen(false);

    // Get storage paths for cleanup
    const tracksToDelete = tracks.filter(t => selectedTrackIds.has(t.id));
    const storagePaths = tracksToDelete.map(t => t.storage_path).filter(Boolean) as string[];

    try {
      // Delete from DB
      const { error: dbError } = await (supabase as any)
        .from('user_music_tracks')
        .delete()
        .in('id', idsToDelete);
      if (dbError) throw dbError;

      // Delete from storage
      if (storagePaths.length > 0) {
        await supabase.storage.from('music').remove(storagePaths).catch(() => {});
      }

      // Update local state
      setTracks(prev => prev.filter(t => !selectedTrackIds.has(t.id)));
      setSelectedTrackIds(new Set());
      toast.success(isAr ? `تم حذف ${idsToDelete.length} مقاطع` : `Deleted ${idsToDelete.length} tracks`);
    } catch (e: any) {
      toast.error((isAr ? 'فشل الحذف: ' : 'Delete failed: ') + (e?.message || String(e)));
    }
  };

  const handleToggleFavorite = async (track: SavedTrack) => {
    const currentMeta = ((track.meta as Record<string, unknown> | null) ?? {});
    const nextFavorite = !Boolean((currentMeta as any).favorite);
    const nextMeta = { ...currentMeta, favorite: nextFavorite };

    setTracks((prev) => prev.map((item) => item.id === track.id ? { ...item, meta: nextMeta } : item));

    try {
      const { error } = await (supabase as any)
        .from('user_music_tracks')
        .update({ meta: nextMeta })
        .eq('id', track.id)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success(nextFavorite
        ? (isAr ? 'تمت إضافة المقطع إلى المفضلة' : 'Track added to favorites')
        : (isAr ? 'تمت إزالة المقطع من المفضلة' : 'Track removed from favorites'));
    } catch (e: any) {
      setTracks((prev) => prev.map((item) => item.id === track.id ? track : item));
      toast.error((isAr ? 'فشل تحديث المفضلة' : 'Failed to update favorite') + (e?.message ? `: ${e.message}` : ''));
    }
  };

  const favoriteTrackIds = useMemo(() => {
    return tracks
      .filter((track) => Boolean((track.meta as any)?.favorite))
      .map((track) => track.id);
  }, [tracks]);

  const favoritesPlaylist = useMemo<Playlist | null>(() => {
    if (favoriteTrackIds.length === 0) return null;
    return {
      id: '__favorites__',
      name: isAr ? 'المفضلة' : 'Favorites',
      trackIds: favoriteTrackIds,
      createdAt: Number.MAX_SAFE_INTEGER,
      isSystem: true,
    };
  }, [favoriteTrackIds, isAr]);

  const visiblePlaylists = useMemo(() => {
    return favoritesPlaylist ? [favoritesPlaylist, ...playlists] : playlists;
  }, [favoritesPlaylist, playlists]);

  useEffect(() => {
    if (activePlaylist?.isSystem && favoriteTrackIds.length === 0) setActivePlaylist(null);
    if (editingPlaylist?.isSystem && favoriteTrackIds.length === 0) setEditingPlaylist(null);
    if (deletePlaylistTarget?.isSystem && favoriteTrackIds.length === 0) setDeletePlaylistTarget(null);
  }, [activePlaylist?.isSystem, editingPlaylist?.isSystem, deletePlaylistTarget?.isSystem, favoriteTrackIds.length]);

  const handleCreatePlaylist = async () => {
    const name = newPlaylistName.trim();
    if (!name || !user) return;
    try {
      const { data: row, error } = await (supabase as any)
        .from('user_music_playlists')
        .insert({ user_id: user.id, name, track_ids: [] })
        .select('id, name, track_ids, created_at')
        .single();
      if (error) throw error;
      const pl: Playlist = { id: row.id, name: row.name, trackIds: row.track_ids || [], createdAt: new Date(row.created_at).getTime() };
      setPlaylists(prev => [...prev, pl]);
      setNewPlaylistName('');
      setShowCreatePlaylist(false);
      setEditingPlaylist(pl);
      setSavedSubTab('playlists');
      toast.success(isAr ? `تم إنشاء قائمة "${name}"` : `Playlist "${name}" created`);
    } catch (e: any) {
      console.error('[Playlists] Create error:', e);
      toast.error(isAr ? 'فشل إنشاء القائمة' : 'Failed to create playlist');
    }
  };

  const toggleTrackInPlaylist = async (pl: Playlist, trackId: string) => {
    if (pl.isSystem) return;
    const has = pl.trackIds.includes(trackId);
    const newTrackIds = has ? pl.trackIds.filter(id => id !== trackId) : [...pl.trackIds, trackId];
    const updated: Playlist = { ...pl, trackIds: newTrackIds };
    setPlaylists(prev => prev.map(p => p.id === pl.id ? updated : p));
    setEditingPlaylist(updated);
    try {
      const { error } = await (supabase as any)
        .from('user_music_playlists')
        .update({ track_ids: newTrackIds })
        .eq('id', pl.id);
      if (error) throw error;
    } catch (e: any) {
      console.error('[Playlists] Update error:', e);
      setPlaylists(prev => prev.map(p => p.id === pl.id ? pl : p));
      setEditingPlaylist(pl);
      toast.error(isAr ? 'فشل التحديث' : 'Failed to update playlist');
    }
  };

  const handleDeletePlaylist = async (pl: Playlist) => {
    if (pl.isSystem) return;
    setPlaylists(prev => prev.filter(p => p.id !== pl.id));
    if (activePlaylist?.id === pl.id) setActivePlaylist(null);
    if (editingPlaylist?.id === pl.id) setEditingPlaylist(null);
    if (pickerPlaylistId === pl.id) setPickerPlaylistId(null);
    setDeletePlaylistTarget(null);
    try {
      const { error } = await (supabase as any)
        .from('user_music_playlists')
        .delete()
        .eq('id', pl.id);
      if (error) throw error;
      toast.success(isAr ? 'تم حذف القائمة' : 'Playlist deleted');
    } catch (e: any) {
      console.error('[Playlists] Delete error:', e);
      setPlaylists(prev => [...prev, pl]);
      toast.error(isAr ? 'فشل الحذف' : 'Failed to delete playlist');
    }
  };

  return (
    <div className="space-y-4">

      {/* ── Sub-tab nav: My Tracks / My Playlists / Poster & Captions ── */}
      <div className="flex items-center gap-2">
        <nav className="flex gap-1 p-1 rounded-xl bg-[#ffffff] dark:bg-white/[0.04] border border-[#d9dde7] dark:border-white/10 shadow-[0_6px_18px_rgba(6,5,65,0.08)] dark:shadow-none flex-1">
          {([
            { key: 'tracks' as const, labelEn: 'My Tracks', labelAr: 'مقاطعي', icon: Music },
            { key: 'playlists' as const, labelEn: 'My Playlists', labelAr: 'قوائمي', icon: ListMusic },
            { key: 'posters' as const, labelEn: 'Poster & Captions', labelAr: 'بوستر', icon: Film },
          ]).map(({ key, labelEn, labelAr, icon: Icon }) => (
            <button key={key} type="button" onClick={() => setSavedSubTab(key)}
              className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all active:scale-95 ${savedSubTab === key ? 'bg-gradient-to-r from-[#f1e7ff] to-[#dff0ff] dark:from-purple-500/20 dark:to-sky-500/20 border border-[#cbb9f3] dark:border-purple-400/20 text-[#060541] dark:text-foreground shadow-[0_4px_12px_rgba(6,5,65,0.08)] dark:shadow-sm' : 'text-[#6b7280] dark:text-muted-foreground hover:text-[#060541] dark:hover:text-foreground hover:bg-[#f8f9fc] dark:hover:bg-transparent'}`}>
              <Icon className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{isAr ? labelAr : labelEn}</span>
            </button>
          ))}
        </nav>

        {/* Actions — icon-only refresh, smaller */}
        {savedSubTab === 'tracks' && (
          <button type="button" onClick={load} disabled={loading} title={isAr ? 'تحديث' : 'Refresh'}
            className="p-1.5 rounded-lg border border-[#d9dde7] dark:border-white/10 bg-[#ffffff] dark:bg-white/[0.04] shadow-[0_2px_8px_rgba(6,5,65,0.05)] dark:shadow-none text-[#6b7280] dark:text-muted-foreground hover:text-[#060541] dark:hover:text-foreground hover:border-[#c7cddd] dark:hover:border-white/20 active:scale-95 transition-all disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
        {savedSubTab === 'posters' && (
          <button type="button" onClick={loadPosters} disabled={postersLoading} title={isAr ? 'تحديث' : 'Refresh'}
            className="p-1.5 rounded-lg border border-[#d9dde7] dark:border-white/10 bg-[#ffffff] dark:bg-white/[0.04] shadow-[0_2px_8px_rgba(6,5,65,0.05)] dark:shadow-none text-[#6b7280] dark:text-muted-foreground hover:text-[#060541] dark:hover:text-foreground hover:border-[#c7cddd] dark:hover:border-white/20 active:scale-95 transition-all disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${postersLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
        {savedSubTab === 'playlists' && (
          <button
            type="button"
            onClick={() => setShowCreatePlaylist(true)}
            title={isAr ? 'قائمة جديدة' : 'New Playlist'}
            aria-label={isAr ? 'قائمة جديدة' : 'New Playlist'}
            className="relative inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[2.5px] border-[#b78a33] bg-[#3b3b3b] text-black shadow-[0_6px_16px_rgba(0,0,0,0.28)] hover:brightness-105 active:scale-95 transition-all"
          >
            <Plus className="h-[18px] w-[18px] stroke-[3.25] text-[#111111] drop-shadow-[0_1px_0_rgba(255,255,255,0.18)]" />
          </button>
        )}
      </div>

      {/* ── Create Playlist Modal (inline) ── */}
      {showCreatePlaylist && (
        <div className="rounded-2xl border border-[#d9dde7] dark:border-purple-400/20 bg-gradient-to-br from-[#ffffff] via-[#faf7ff] to-[#f4f8ff] dark:from-purple-900/20 dark:to-sky-900/10 p-4 space-y-3 shadow-[0_12px_32px_rgba(6,5,65,0.10)] dark:shadow-[0_8px_32px_rgba(128,0,255,0.15)]">
          <p className="text-sm font-bold text-foreground">{isAr ? 'قائمة تشغيل جديدة' : 'New Playlist'}</p>
          <input
            autoFocus
            type="text"
            value={newPlaylistName}
            onChange={e => setNewPlaylistName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreatePlaylist()}
            placeholder={isAr ? 'اسم القائمة...' : 'Playlist name...'}
            className="w-full px-3 py-2 rounded-xl bg-[#ffffff] dark:bg-white/[0.06] border border-[#d9dde7] dark:border-white/10 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[#bba4f0] dark:focus:border-purple-400/40 shadow-[inset_0_1px_2px_rgba(6,5,65,0.04)] dark:shadow-none"
          />
          <div className="flex gap-2">
            <button onClick={handleCreatePlaylist} disabled={!newPlaylistName.trim()}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-500 to-sky-500 text-white shadow-[0_4px_16px_rgba(128,0,255,0.4)] hover:shadow-[0_4px_24px_rgba(128,0,255,0.6)] active:scale-95 transition-all disabled:opacity-40">
              {isAr ? 'إنشاء' : 'Create'}
            </button>
            <button onClick={() => { setShowCreatePlaylist(false); setNewPlaylistName(''); }}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#d9dde7] dark:border-white/10 bg-[#ffffff] dark:bg-transparent text-[#6b7280] dark:text-muted-foreground hover:text-[#060541] dark:hover:text-foreground hover:border-[#c7cddd] dark:hover:border-white/20 active:scale-95 transition-all">
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* ── Active Playlist Player ── */}
      {savedSubTab === 'playlists' && activePlaylist && (
        <PlaylistPlayer
          playlist={activePlaylist}
          tracks={tracks}
          isAr={isAr}
          onClose={() => setActivePlaylist(null)}
        />
      )}

      {/* ══ MY TRACKS TAB ══════════════════════════════════════════════════════ */}
      {savedSubTab === 'tracks' && (
        <>
          {tracks.length === 0 && !loading ? (
            <div className="rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-[0_10px_30px_rgba(6,5,65,0.08)] dark:shadow-none p-10 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-[#f7f8fc] dark:bg-white/[0.05] border border-[#e4e7ef] dark:border-transparent flex items-center justify-center">
                <Music className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground/80 dark:text-muted-foreground/60">{isAr ? 'لا توجد مقاطع محفوظة بعد.' : 'No saved tracks yet.'}</p>
              <p className="text-xs text-muted-foreground/60 dark:text-muted-foreground/40">{isAr ? 'أنشئ موسيقى ثم احفظ المقاطع التي تريدها هنا.' : 'Generate music, then save the tracks you want here.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    value={trackSearch}
                    onChange={(e) => setTrackSearch(e.target.value)}
                    placeholder={isAr ? 'ابحث في المقاطع...' : 'Search songs...'}
                    className="h-10 pl-9 rounded-xl border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.04] shadow-[0_6px_18px_rgba(6,5,65,0.06)] dark:shadow-none"
                  />
                </div>
                {selectedTrackIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setBulkDeleteDialogOpen(true)}
                    className="flex-shrink-0 h-10 px-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 active:scale-95 transition-all text-xs font-semibold border border-red-500/20"
                  >
                    {isAr ? `حذف ${selectedTrackIds.size}` : `Delete ${selectedTrackIds.size}`}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50/60 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-400/20">
                <Download className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {isAr ? 'تذكير: قم بتنزيل أغانيك لحفظها محلياً' : 'Reminder: Please download your songs to save them locally'}
                </p>
              </div>

              {filteredTracks.length === 0 ? (
                <div className="rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-[0_10px_30px_rgba(6,5,65,0.08)] dark:shadow-none p-8 flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#f7f8fc] dark:bg-white/[0.05] border border-[#e4e7ef] dark:border-transparent flex items-center justify-center">
                    <Search className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground/80 dark:text-muted-foreground/60">{isAr ? 'لا توجد نتائج مطابقة.' : 'No songs match your search.'}</p>
                  <p className="text-xs text-muted-foreground/60 dark:text-muted-foreground/40">{isAr ? 'جرّب عنواناً أو كلمات من الوصف أو نوع الموسيقى.' : 'Try a title, prompt words, or style tags.'}</p>
                </div>
              ) : displayedTracks.map((t) => {
                const durationSec = t.duration ?? t.requested_duration_seconds ?? null;
                const durationLabel = durationSec
                  ? `${Math.floor(durationSec / 60)}:${String(Math.round(durationSec % 60)).padStart(2, '0')}`
                  : null;
                const trackTitle = t.title || (t.prompt ? t.prompt.slice(0, 40) : (isAr ? 'مقطع موسيقي' : 'Music Track'));
                const trackLyrics = (t.prompt || '').trim();
                const hasLyrics = trackLyrics.length > 0;
                const isLyricsExpanded = expandedLyricsTrackId === t.id;
                const lyricLines = trackLyrics.split('\n').map((line) => line.trim()).filter(Boolean);
                const lyricsPreview = trackLyrics.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 2).join(' ');
                const activeLyricsLine = activeLyricsLineByTrackId[t.id] ?? 0;
                const styleTags: string[] = t.include_styles ?? [];
                const metaTags = (t.meta as any)?.tags as string | null;
                const isFavorite = Boolean((t.meta as any)?.favorite);
                const isActivePlaying = activePlayingTrackId === t.id;
                const isBgMusic = bgMusicTrackId === t.id;

                return (
                  <div
                    key={t.id}
                    className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br transition-all duration-300 ${selectedTrackIds.has(t.id) ? 'border-red-400/40 dark:border-red-400/50 ring-1 ring-red-400/30' : ''} ${isActivePlaying
                      ? 'border-fuchsia-300 dark:border-fuchsia-400/40 from-[#fff5fd] via-[#f6eeff] to-[#eef6ff] dark:from-fuchsia-500/10 dark:via-purple-500/10 dark:to-sky-500/10 shadow-[0_16px_40px_rgba(168,85,247,0.18)] dark:shadow-[0_0_32px_rgba(217,70,239,0.22)]'
                      : 'border-[#d9dde7] dark:border-white/10 from-[#ffffff] via-[#f8f9fc] to-[#f3f5fb] dark:from-white/[0.04] dark:to-white/[0.02] shadow-[0_12px_32px_rgba(6,5,65,0.10)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                    }`}
                  >
                    {isActivePlaying && (
                      <div className="music-playing-top-line pointer-events-none absolute inset-x-0 top-0 h-1.5" />
                    )}
                    <div className="p-4 flex gap-3 items-start">
                      <label className="flex-shrink-0 flex items-center pt-1 cursor-pointer" aria-label={isAr ? 'اختر للحذف' : 'Select for delete'}>
                        <input
                          type="checkbox"
                          aria-label={isAr ? 'اختر للحذف' : 'Select for delete'}
                          checked={selectedTrackIds.has(t.id)}
                          onChange={(e) => {
                            const next = new Set(selectedTrackIds);
                            if (e.target.checked) next.add(t.id);
                            else next.delete(t.id);
                            setSelectedTrackIds(next);
                          }}
                          className="w-4 h-4 rounded border-[#d9dde7] dark:border-white/20 text-red-500 focus:ring-red-500/20"
                        />
                      </label>
                      <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-sky-100 to-purple-100 dark:from-sky-900/40 dark:to-purple-900/40 border border-[#d9dde7] dark:border-white/10 shadow-md">
                        {t.cover_url
                          ? <img src={t.cover_url} alt={trackTitle} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Music className="h-6 w-6 text-sky-400/50" /></div>
                        }
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="font-bold text-sm text-foreground truncate leading-tight">{trackTitle}</p>
                              <button
                                type="button"
                                aria-label={isAr ? 'تعديل الاسم' : 'Rename'}
                                onClick={() => { setRenamingTrackId(t.id); setRenameValue(t.title || ''); }}
                                className="flex-shrink-0 p-0.5 rounded text-muted-foreground/40 hover:text-sky-400 hover:bg-sky-400/10 transition-colors"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground truncate">
                              {new Date(t.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                            {(styleTags.length > 0 || metaTags) && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(metaTags ? [metaTags] : styleTags).slice(0, 2).map((tag, i) => (
                                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[#f7f8fc] dark:bg-white/[0.06] text-muted-foreground/80 dark:text-muted-foreground/70 border border-[#e4e7ef] dark:border-white/[0.06] whitespace-nowrap">
                                    {typeof tag === 'string' ? tag.slice(0, 20) : tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              aria-label={isFavorite ? (isAr ? 'إزالة من المفضلة' : 'Remove from favorites') : (isAr ? 'إضافة إلى المفضلة' : 'Add to favorites')}
                              onClick={() => handleToggleFavorite(t)}
                              className={`p-1.5 rounded-lg transition-all active:scale-95 ${isFavorite
                                ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/15'
                                : 'text-muted-foreground/50 hover:text-amber-500 hover:bg-amber-500/10'
                              }`}
                            >
                              <Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-current' : ''}`} />
                            </button>
                            {durationLabel && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/20">{durationLabel}</span>
                            )}
                            <button type="button" aria-label={isAr ? 'حذف' : 'Delete'}
                              onClick={() => setDeleteTrackTarget({ id: t.id, storagePath: t.storage_path })}
                              className="p-1 rounded-lg text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Rename bar — full width, appears below the card header ── */}
                    {renamingTrackId === t.id && (
                      <div className="px-4 pb-3 space-y-2">
                        <input
                          autoFocus
                          aria-label={isAr ? 'تعديل اسم الأغنية' : 'Song name'}
                          placeholder={isAr ? 'اسم الأغنية…' : 'Song name…'}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameTrack(t.id);
                            if (e.key === 'Escape') setRenamingTrackId(null);
                          }}
                          dir="auto"
                          maxLength={80}
                          className="w-full text-base font-semibold bg-white dark:bg-white/[0.07] border border-sky-400/50 rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={renameSaving}
                            onClick={() => handleRenameTrack(t.id)}
                            className="flex-1 py-2 text-sm font-semibold rounded-xl bg-sky-500/20 text-sky-300 border border-sky-400/30 hover:bg-sky-500/30 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {renameSaving ? '...' : (isAr ? 'حفظ' : 'Save')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingTrackId(null)}
                            className="flex-1 py-2 text-sm font-semibold rounded-xl bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10 active:scale-95 transition-all"
                          >
                            {isAr ? 'إلغاء' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    )}

                    {t.play_url && (
                      <div className="px-4 pb-4 space-y-3">
                        <AudioPlayer
                          src={t.play_url}
                          className="w-full"
                          showLoopToggle
                          externalAudio={isBgMusic ? bgAudio.getOrCreate(t.play_url!) : null}
                          onPlaybackChange={(isPlaying) => {
                            setActivePlayingTrackId((prev) => {
                              if (isPlaying) return t.id;
                              return prev === t.id ? null : prev;
                            });
                            if (isPlaying && bgMusicTrackIdRef.current === t.id) {
                              bgAudio.play(t.play_url!);
                            }
                          }}
                        />
                        {/* Background play activator + YouTube inline */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              if (isBgMusic) {
                                bgMusicTrackIdRef.current = null;
                                setBgMusicTrackId(null);
                                try { sessionStorage.removeItem('wakti-bg-music-track-id'); } catch {}
                                bgAudio.stop();
                              } else {
                                bgMusicTrackIdRef.current = t.id;
                                setBgMusicTrackId(t.id);
                                try { sessionStorage.setItem('wakti-bg-music-track-id', t.id); } catch {}
                                emitEvent('wakti-bg-music-indicator-on');
                                // If the song is already playing, move it to the shared singleton immediately
                                if (activePlayingTrackId === t.id && t.play_url) {
                                  bgAudio.play(t.play_url);
                                }
                              }
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95 border ${
                              isBgMusic
                                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-400 dark:text-emerald-300 shadow-[0_0_12px_hsla(142,76%,55%,0.25)]'
                                : 'bg-red-500/10 border-red-400/40 text-red-400 dark:text-red-300 hover:bg-red-500/15 hover:border-red-400/60'
                            }`}
                            title={isAr ? 'تشغيل في الخلفية' : 'Play in background'}
                          >
                            <Radio className="h-3.5 w-3.5" />
                            <span>{isAr ? 'تشغيل في الخلفية' : 'Play in background'}</span>
                            {isBgMusic && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            )}
                          </button>
                          {t.play_url && (() => {
                            const ytUrl = (t.meta as any)?.youtube_url as string | undefined;
                            return ytUrl ? (
                              <a href={ytUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95 border border-emerald-400/30 dark:border-emerald-400/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>{isAr ? 'تم النشر ✓' : 'Published ✓'}</span>
                              </a>
                            ) : (
                              <button type="button"
                                onClick={() => setTrackYouTubeTarget(t)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95 border border-red-400/25 dark:border-red-400/20 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20">
                                <Youtube className="h-3.5 w-3.5" />
                                <span>{isAr ? 'نشر على يوتيوب' : 'Publish to YouTube'}</span>
                              </button>
                            );
                          })()}
                        </div>
                        {hasLyrics && (
                          <div className="w-full overflow-hidden rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-gradient-to-b from-[#f8fafc] via-[#f3f7ff] to-[#eef4ff] dark:from-white/[0.05] dark:via-white/[0.035] dark:to-white/[0.03] shadow-[0_10px_24px_rgba(6,5,65,0.08)] dark:shadow-none">
                            <button
                              type="button"
                              onClick={() => setExpandedLyricsTrackId((prev) => prev === t.id ? null : t.id)}
                              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left border-b border-[#d9dde7] dark:border-white/10 bg-white/70 dark:bg-white/[0.03] hover:bg-white/90 dark:hover:bg-white/[0.05] transition-all"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700/85 dark:text-sky-300/85">
                                  {isAr ? 'الكلمات' : 'Lyrics'}
                                </p>
                                {!isLyricsExpanded && lyricsPreview && (
                                  <p className="mt-1 text-[11px] italic text-[#606062] dark:text-white/45 truncate">
                                    {lyricsPreview}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-[10px] text-[#606062] dark:text-white/45 whitespace-nowrap">
                                  {isLyricsExpanded
                                    ? (isAr ? 'مرر لأعلى/أسفل' : 'Swipe up/down')
                                    : (isAr ? 'اضغط للعرض' : 'Tap to view')}
                                </span>
                                {isLyricsExpanded ? <ChevronUp className="h-3.5 w-3.5 text-sky-700 dark:text-sky-300" /> : <ChevronDown className="h-3.5 w-3.5 text-sky-700 dark:text-sky-300" />}
                              </div>
                            </button>
                            {isLyricsExpanded && (
                              <div
                                ref={(node) => { lyricsWheelRefs.current[t.id] = node; }}
                                className="relative px-4 py-3 select-none"
                                onTouchStart={(e) => { (e.currentTarget as any)._lyricsTouchY = e.touches[0].clientY; }}
                                onTouchEnd={(e) => {
                                  const startY = (e.currentTarget as any)._lyricsTouchY ?? 0;
                                  const diff = startY - e.changedTouches[0].clientY;
                                  if (Math.abs(diff) > 20) stepLyricsLine(t.id, lyricLines.length, diff > 0 ? 1 : -1);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowDown') { e.preventDefault(); stepLyricsLine(t.id, lyricLines.length, 1); }
                                  if (e.key === 'ArrowUp')   { e.preventDefault(); stepLyricsLine(t.id, lyricLines.length, -1); }
                                }}
                                tabIndex={0}
                              >
                                <div className="pointer-events-none absolute inset-x-4 top-3 h-5 bg-gradient-to-b from-[#eef4ff] via-[#eef4ff]/75 to-transparent dark:from-[#171b22] dark:via-[#171b22]/70 dark:to-transparent z-10 rounded-t-xl" />
                                <div className="pointer-events-none absolute inset-x-4 bottom-3 h-5 bg-gradient-to-t from-[#eef4ff] via-[#eef4ff]/75 to-transparent dark:from-[#171b22] dark:via-[#171b22]/70 dark:to-transparent z-10 rounded-b-xl" />
                                <div className="relative z-0 max-h-[6.6rem] overflow-hidden px-2 py-1">
                                  <div className="space-y-3 py-3">
                                    {lyricLines.map((line, lineIdx) => {
                                      const isActiveLine = lineIdx === activeLyricsLine;
                                      return (
                                        <div
                                          key={`${t.id}-lyric-${lineIdx}`}
                                          ref={(node) => {
                                            if (!lyricsLineRefs.current[t.id]) lyricsLineRefs.current[t.id] = {};
                                            lyricsLineRefs.current[t.id][lineIdx] = node;
                                          }}
                                          className={`text-center whitespace-pre-wrap break-words font-inherit italic tracking-[0.01em] transition-all duration-500 ${isActiveLine
                                            ? 'text-[18px] leading-[1.9] text-[#060541] dark:text-white font-semibold opacity-100 scale-[1.02]'
                                            : 'text-[15px] leading-[1.8] text-[#606062]/70 dark:text-white/38 opacity-60 blur-[0.6px] scale-[0.985]'
                                          }`}
                                        >
                                          {line}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 justify-end">
                          {(() => {
                            const completedPoster = posters.find(p => p.track_id === t.id && p.status === 'completed');
                            const isGenerating = generatingPosterTrackIds.includes(t.id) || posters.some(p => p.track_id === t.id && p.status === 'generating');
                            const kieTrackId = (t.meta as any)?.kie_track_id as string | undefined;
                            const isValidAudioId = !!kieTrackId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(kieTrackId);
                            const canCreatePoster = !!t.task_id && isValidAudioId;

                            const posterButton = completedPoster ? (
                              <button type="button"
                                onClick={() => setSavedSubTab('posters')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-emerald-400/30 dark:border-emerald-400/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-[0_4px_12px_rgba(16,185,129,0.10)] dark:shadow-none hover:bg-emerald-100 dark:hover:bg-emerald-500/20 active:scale-95 transition-all whitespace-nowrap">
                                <CheckCircle2 className="h-3 w-3" />
                                {isAr ? 'بوستر وتسميات ✓' : 'Poster & Captions ✓'}
                              </button>
                            ) : isGenerating ? (
                              <button type="button" disabled
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#f0c8f0] dark:border-pink-400/20 bg-[#fdf0ff] dark:bg-pink-500/10 text-[#9333ea] dark:text-pink-300 opacity-70 whitespace-nowrap">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {isAr ? 'جاري الإنشاء...' : 'Generating...'}
                              </button>
                            ) : canCreatePoster ? (
                              <button type="button"
                                onClick={() => handleCreatePoster({ ...t, meta: { ...(t.meta as any), kie_track_id: kieTrackId } } as any)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#f0c8f0] dark:border-pink-400/20 bg-[#fdf0ff] dark:bg-pink-500/10 text-[#9333ea] dark:text-pink-300 shadow-[0_4px_12px_rgba(147,51,234,0.10)] dark:shadow-none hover:bg-[#f8e4ff] dark:hover:bg-pink-500/20 active:scale-95 transition-all whitespace-nowrap">
                                <Film className="h-3 w-3" />
                                {isAr ? 'بوستر وتسميات' : 'Poster & Captions'}
                              </button>
                            ) : null;

                            return posterButton;
                          })()}
                          <button type="button"
                            onClick={async () => {
                              try {
                                if (t.storage_path) {
                                  const { data, error: downloadError } = await supabase.storage
                                    .from('music')
                                    .download(t.storage_path);
                                  if (downloadError) throw downloadError;

                                  await saveAudioBlob(data, t.storage_path.split('/').pop() || `wakti-music-${t.id}.mp3`);
                                  return;
                                }

                                await handleDownload(t.play_url || '', `wakti-music-${t.id}.mp3`);
                              } catch (error) {
                                console.error('Track download failed:', error);
                                await handleDownload(t.play_url || '', `wakti-music-${t.id}.mp3`);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.04] shadow-[0_4px_12px_rgba(6,5,65,0.05)] dark:shadow-none text-muted-foreground hover:text-foreground hover:border-[#c7cddd] dark:hover:border-white/20 active:scale-95 transition-all">
                            <RefreshCw className="h-3 w-3" />{isAr ? 'تنزيل' : 'Download'}
                          </button>
                          <ShareButton size="sm"
                            shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/music/share/${(t.title ? t.title.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) + '-' : '') + (t.share_code || t.id)}` : ''}
                            shareTitle={isAr ? 'استمع إلى موسيقى من وقتي 🎵' : 'Listen to my Wakti music 🎵'}
                            extraActions={[
                              {
                                name: 'wakti',
                                icon: WaktiShareIcon,
                                bgColor: 'bg-transparent !p-0 overflow-hidden',
                                angle: 309,
                                action: () => setShareTrackTarget({
                                  id: t.id,
                                  title: trackTitle,
                                  coverUrl: t.cover_url,
                                }),
                              },
                            ]}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Load More Button */}
              {hasMoreTracks && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={handleLoadMore}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.04] shadow-[0_4px_12px_rgba(6,5,65,0.05)] dark:shadow-none text-muted-foreground hover:text-foreground hover:border-[#c7cddd] dark:hover:border-white/20 active:scale-95 transition-all"
                  >
                    <ChevronDown className="h-4 w-4" />
                    {isAr ? 'تحميل المزيد' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <MusicSharePickerDialog
        isOpen={!!shareTrackTarget}
        track={shareTrackTarget}
        onClose={() => setShareTrackTarget(null)}
        onSent={() => setShareTrackTarget(null)}
      />

      {trackYouTubeTarget && (
        <MusicTrackYouTubeDialog
          track={trackYouTubeTarget}
          language={language}
          onClose={() => setTrackYouTubeTarget(null)}
          onVideoRendered={async (videoUrl) => {
            const id = trackYouTubeTarget.id;
            const currentMeta = ((trackYouTubeTarget.meta as Record<string, unknown> | null) ?? {});
            const nextMeta = { ...currentMeta, video_url: videoUrl };
            setTracks(prev => prev.map(t => t.id === id ? { ...t, meta: nextMeta } : t));
            try {
              await (supabase as any).from('user_music_tracks').update({ meta: nextMeta }).eq('id', id);
            } catch { /* non-critical */ }
          }}
          onPublished={async (videoUrl) => {
            const id = trackYouTubeTarget.id;
            const currentMeta = ((trackYouTubeTarget.meta as Record<string, unknown> | null) ?? {});
            const nextMeta = { ...currentMeta, youtube_url: videoUrl };
            setTracks(prev => prev.map(t => t.id === id ? { ...t, meta: nextMeta } : t));
            try {
              await (supabase as any).from('user_music_tracks').update({ meta: nextMeta }).eq('id', id);
            } catch { /* non-critical */ }
            setTrackYouTubeTarget(null);
          }}
        />
      )}

      {/* ══ POSTER & CAPTIONS TAB ══════════════════════════════════════════════ */}
      {savedSubTab === 'posters' && (
        <div className="space-y-3">
          {/* Intro hint */}
          <div className="rounded-2xl border border-[#f0c8f0] dark:border-pink-400/20 bg-gradient-to-r from-[#fdf0ff] to-[#f5eeff] dark:from-pink-900/10 dark:to-purple-900/10 px-4 py-3 flex items-start gap-3 shadow-[0_4px_16px_rgba(147,51,234,0.08)] dark:shadow-none">
            <Film className="h-4 w-4 text-[#9333ea] dark:text-pink-300 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#7c3aed] dark:text-pink-200/80 leading-relaxed">
              {isAr
                ? 'أنشئ بوستراً مرئياً لأي مقطع محفوظ. اضغط زر «بوستر» على أي مقطع في قائمة مقاطعي.'
                : 'Create a branded visual poster for any saved track. Tap the Poster & Captions button on any track in My Tracks.'}
            </p>
          </div>

          {postersLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
            </div>
          ) : posters.length === 0 ? (
            <div className="rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-[0_10px_30px_rgba(6,5,65,0.08)] dark:shadow-none p-10 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-[#fdf0ff] dark:bg-white/[0.05] border border-[#f0c8f0] dark:border-transparent flex items-center justify-center">
                <Film className="h-6 w-6 text-[#9333ea]/40" />
              </div>
              <p className="text-sm text-muted-foreground/80 dark:text-muted-foreground/60">{isAr ? 'لا توجد بوسترات بعد.' : 'No posters yet.'}</p>
              <p className="text-xs text-muted-foreground/60 dark:text-muted-foreground/40">{isAr ? 'اضغط «بوستر» على أي مقطع في قائمة مقاطعي.' : 'Tap "Poster & Captions" on any track in My Tracks.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posters.map((poster) => {
                const linkedTrack = tracks.find(t => t.id === poster.track_id);
                const trackTitle = linkedTrack?.title || (isAr ? 'مقطع موسيقي' : 'Music Track');
                const isExpanded = expandedPosterId === poster.id;
                const canExpand = poster.status === 'completed' && !!poster.video_url;
                return (
                  <div key={poster.id} className="rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-gradient-to-br from-[#ffffff] via-[#fdf0ff] to-[#f5eeff] dark:from-white/[0.04] dark:to-purple-900/10 shadow-[0_12px_32px_rgba(6,5,65,0.10)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] overflow-hidden">
                    {/* ── Header (always visible, clickable to expand if completed) ── */}
                    <button
                      type="button"
                      onClick={() => canExpand && setExpandedPosterId(isExpanded ? null : poster.id)}
                      className={`w-full p-4 flex items-center gap-3 text-left ${canExpand ? 'cursor-pointer hover:bg-purple-500/5 active:scale-[0.99] transition-all' : 'cursor-default'}`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#fdf0ff] to-[#f0e4ff] dark:from-pink-900/40 dark:to-purple-900/40 border border-[#f0c8f0] dark:border-pink-400/20 flex items-center justify-center flex-shrink-0">
                        <Film className="h-4 w-4 text-[#9333ea] dark:text-pink-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{trackTitle}</p>
                        <p className="text-[10px] text-muted-foreground/50">
                          {new Date(poster.created_at).toLocaleDateString(isAr ? 'ar' : 'en', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {poster.author ? ` · @${poster.author}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          poster.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-400/20'
                          : poster.status === 'failed' ? 'bg-red-500/15 text-red-400 border border-red-400/20'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-400/20'
                        }`}>
                          {poster.status === 'completed' ? (isAr ? 'مكتمل' : 'Ready')
                            : poster.status === 'failed' ? (isAr ? 'فشل' : 'Failed')
                            : (isAr ? 'جاري...' : 'Generating...')}
                        </span>
                        {canExpand && (
                          <ChevronDown className={`h-4 w-4 text-muted-foreground/50 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                      </div>
                    </button>

                    {/* ── Generating indicator ── */}
                    {poster.status === 'generating' && (
                      <div className="px-4 pb-4 flex items-center gap-2 text-xs text-muted-foreground/60">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {isAr ? 'يتم إنشاء البوستر، قد يستغرق بضع دقائق...' : 'Creating your poster, may take a few minutes...'}
                      </div>
                    )}

                    {/* ── Expanded video (only when completed + expanded) ── */}
                    {poster.status === 'completed' && poster.video_url && isExpanded && (
                      <div className="px-4 pb-4 space-y-3">
                        <video
                          src={poster.video_url}
                          controls
                          playsInline
                          className="w-full rounded-xl border border-[#f0c8f0] dark:border-pink-400/20 shadow-[0_4px_16px_rgba(147,51,234,0.15)] dark:shadow-none bg-black"
                        />
                        {/* ── Actions ── */}
                        <div className="flex items-center gap-2 justify-end flex-wrap">
                          {/* Download — fetch blob and trigger save */}
                          <button type="button"
                            onClick={async () => {
                              try {
                                const { data: { session } } = await supabase.auth.getSession();
                                const proxyUrl = `${SUPABASE_URL}/functions/v1/music-poster?proxy=1&posterId=${poster.id}`;
                                const r = await fetch(proxyUrl, {
                                  headers: { 'Authorization': `Bearer ${session?.access_token}`, 'apikey': SUPABASE_ANON_KEY },
                                });
                                const blob = await r.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `wakti-poster-${poster.id}.mp4`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              } catch {
                                window.open(poster.video_url!, '_blank');
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#f0c8f0] dark:border-pink-400/20 bg-[#fdf0ff] dark:bg-pink-500/10 text-[#9333ea] dark:text-pink-300 shadow-[0_4px_12px_rgba(147,51,234,0.10)] dark:shadow-none hover:bg-[#f8e4ff] dark:hover:bg-pink-500/20 active:scale-95 transition-all">
                            <Download className="h-3 w-3" />{isAr ? 'تنزيل' : 'Download'}
                          </button>
                          {/* Share — clean wakti.qa/poster/{id} URL */}
                          <button type="button"
                            aria-label={isAr ? 'مشاركة' : 'Share'}
                            onClick={async () => {
                              const shareUrl = `${window.location.origin}/poster/${poster.id}`;
                              const title = isAr ? 'بوستر موسيقي من وقتي 🎬' : 'My Wakti music poster 🎬';
                              try {
                                if (navigator.share) {
                                  await navigator.share({ title, url: shareUrl });
                                } else {
                                  await navigator.clipboard.writeText(shareUrl);
                                  toast.success(isAr ? 'تم نسخ الرابط!' : 'Link copied!');
                                }
                              } catch (e: any) {
                                if (e?.name !== 'AbortError') toast.error(isAr ? 'فشل المشاركة' : 'Share failed');
                              }
                            }}
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg hover:scale-105 active:scale-95 transition-all">
                            <Share2 className="h-4 w-4" />
                          </button>
                        </div>
                        {/* YouTube publish bar */}
                        <div className="flex justify-start">
                          <YouTubePublishBar
                            fileUrl={poster.video_url!}
                            title={linkedTrack?.title || (isAr ? 'مقطع موسيقي من وقتي' : 'Music track from Wakti')}
                            description={linkedTrack?.prompt || ''}
                            isShort={false}
                            language={language}
                            initialYoutubeUrl={poster.youtube_video_url || null}
                            onPublished={async (result) => {
                              if (!user) return;
                              const payload = {
                                youtube_video_id: result.videoId,
                                youtube_video_url: result.videoUrl,
                                youtube_published_at: new Date().toISOString(),
                              };
                              const { error } = await (supabase as any)
                                .from('user_music_posters')
                                .update(payload)
                                .eq('id', poster.id)
                                .eq('user_id', user.id);
                              if (error) throw error;
                              setPosters((prev) => prev.map((x) => (x.id === poster.id ? { ...x, ...payload } : x)));
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* ── Failed ── */}
                    {poster.status === 'failed' && (
                      <div className="px-4 pb-4">
                        <p className="text-xs text-red-400">{isAr ? 'فشل إنشاء البوستر. حاول مرة أخرى من قائمة مقاطعي.' : 'Poster generation failed. Try again from My Tracks.'}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ MY PLAYLISTS TAB ═══════════════════════════════════════════════════ */}
      {savedSubTab === 'playlists' && (
        <div className="space-y-3">
          {visiblePlaylists.length === 0 ? (
            <div className="rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-[#ffffff] dark:bg-white/[0.02] shadow-[0_12px_32px_rgba(6,5,65,0.08)] dark:shadow-none p-10 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-[#f7f8fc] dark:bg-white/[0.05] border border-[#e4e7ef] dark:border-transparent flex items-center justify-center">
                <ListMusic className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground/60">{isAr ? 'لا توجد قوائم تشغيل بعد.' : 'No playlists yet.'}</p>
              <button onClick={() => setShowCreatePlaylist(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#f1e7ff] to-[#dff0ff] dark:from-purple-500/20 dark:to-sky-500/20 border border-[#d9c5f3] dark:border-purple-400/20 text-[#7c3aed] dark:text-purple-300 hover:from-[#eadcff] hover:to-[#d6ebff] dark:hover:from-purple-500/30 dark:hover:to-sky-500/30 active:scale-95 transition-all shadow-[0_4px_12px_rgba(124,58,237,0.10)] dark:shadow-none">
                <Plus className="h-3 w-3" />{isAr ? 'أنشئ قائمتك الأولى' : 'Create your first playlist'}
              </button>
            </div>
          ) : (
            visiblePlaylists.map(pl => {
              if (activePlaylist?.id === pl.id) return null;

              const isOpen = editingPlaylist?.id === pl.id;
              const pickerOpen = pickerPlaylistId === pl.id;
              const plTracks = pl.trackIds.map(id => tracks.find(t => t.id === id)).filter(Boolean) as SavedTrack[];
              const isPlBgActive = bgPlaylistId === pl.id;

              return (
                <div key={pl.id} className="rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-gradient-to-br from-[#ffffff] via-[#f8f9fc] to-[#f3f5fb] dark:from-white/[0.04] dark:to-white/[0.03] shadow-[0_12px_32px_rgba(6,5,65,0.10)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] overflow-hidden">
                  <div className="flex items-center gap-3 p-3 border-b border-[#eef1f6] dark:border-transparent">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(124,58,237,0.10)] dark:shadow-none ${pl.isSystem ? 'bg-gradient-to-br from-[#fff6d8] to-[#ffe9a8] dark:from-amber-500/20 dark:to-yellow-500/20 border-[#f2c96d] dark:border-amber-400/20' : 'bg-gradient-to-br from-[#efe7ff] to-[#dff0ff] dark:from-purple-900/50 dark:to-sky-900/50 border-[#d9c5f3] dark:border-purple-400/20'}`}>
                      {pl.isSystem ? <Star className="h-4 w-4 text-amber-500 fill-current" /> : <ListMusic className="h-4 w-4 text-purple-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{pl.name}</p>
                      <p className="text-[10px] text-muted-foreground/50">{pl.trackIds.length} {isAr ? 'مقاطع' : 'tracks'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {pl.trackIds.length > 0 && (
                        <button onClick={() => setActivePlaylist(activePlaylist?.id === pl.id ? null : pl)}
                          title={isAr ? 'تشغيل القائمة' : 'Play playlist'}
                          className={`p-2 rounded-xl transition-all active:scale-95 ${activePlaylist?.id === pl.id ? 'bg-[#efe7ff] dark:bg-purple-500/20 text-[#7c3aed] dark:text-purple-300 border border-[#d9c5f3] dark:border-transparent shadow-[0_4px_12px_rgba(124,58,237,0.10)] dark:shadow-none' : 'text-[#6b7280] dark:text-muted-foreground hover:text-[#060541] dark:hover:text-foreground bg-[#ffffff] dark:bg-transparent border border-[#e5e7eb] dark:border-transparent hover:bg-[#f8f9fc] dark:hover:bg-white/[0.06]'}`}>
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setPickerPlaylistId(pickerOpen ? null : pl.id)}
                        title={isAr ? 'إضافة أو إزالة المقاطع' : 'Add or remove tracks'}
                        disabled={pl.isSystem}
                        className={`p-2 rounded-xl transition-all active:scale-95 ${pickerOpen ? 'bg-[#dff0ff] dark:bg-sky-500/20 text-[#0284c7] dark:text-sky-300 border border-[#bfdbfe] dark:border-transparent shadow-[0_4px_12px_rgba(2,132,199,0.10)] dark:shadow-none' : 'text-[#6b7280] dark:text-muted-foreground hover:text-[#060541] dark:hover:text-foreground bg-[#ffffff] dark:bg-transparent border border-[#e5e7eb] dark:border-transparent hover:bg-[#f8f9fc] dark:hover:bg-white/[0.06]'}`}>
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditingPlaylist(isOpen ? null : pl)}
                        title={isAr ? 'إظهار تفاصيل القائمة' : 'Show playlist details'}
                        className="p-2 rounded-xl text-[#6b7280] dark:text-muted-foreground hover:text-[#060541] dark:hover:text-foreground bg-[#ffffff] dark:bg-transparent border border-[#e5e7eb] dark:border-transparent hover:bg-[#f8f9fc] dark:hover:bg-white/[0.06] transition-all active:scale-95">
                        {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      {!pl.isSystem && (
                        <button onClick={() => setDeletePlaylistTarget(pl)}
                          title={isAr ? 'حذف القائمة' : 'Delete playlist'}
                          className="p-2 rounded-xl text-muted-foreground/40 bg-[#ffffff] dark:bg-transparent border border-[#e5e7eb] dark:border-transparent hover:text-red-400 hover:bg-red-500/10 transition-colors active:scale-95">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-[#eef1f6] dark:border-white/10 p-3 space-y-2 bg-[#fcfefd] dark:bg-transparent">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setActivePlaylist(activePlaylist?.id === pl.id ? null : pl)}
                          disabled={pl.trackIds.length === 0}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 disabled:opacity-40 ${activePlaylist?.id === pl.id ? 'border-[#d9c5f3] dark:border-purple-400/30 bg-[#efe7ff] dark:bg-purple-500/15 text-[#7c3aed] dark:text-purple-300 shadow-[0_4px_12px_rgba(124,58,237,0.10)] dark:shadow-none' : 'border-[#d9dde7] dark:border-white/10 bg-[#ffffff] dark:bg-transparent text-[#6b7280] dark:text-muted-foreground hover:text-[#060541] dark:hover:text-foreground hover:border-[#c7cddd] dark:hover:border-white/20'}`}>
                          <Play className="h-3 w-3" />
                          {activePlaylist?.id === pl.id ? (isAr ? 'يتم التشغيل' : 'Playing') : (isAr ? 'تشغيل' : 'Play')}
                        </button>
                        {pl.trackIds.length > 0 && (
                          <button
                            type="button"
                            title={isAr ? 'تشغيل في الخلفية' : 'Play in background'}
                            onClick={() => {
                              const isBg = isPlBgActive;
                              if (isBg) {
                                try { sessionStorage.removeItem(PL_BG_KEY); sessionStorage.removeItem(PL_ID_KEY); sessionStorage.removeItem(PL_IDX_KEY); } catch {}
                                setBgPlaylistId(null);
                                bgAudio.stop();
                              } else {
                                try { sessionStorage.setItem(PL_BG_KEY, '1'); sessionStorage.setItem(PL_ID_KEY, pl.id); sessionStorage.setItem(PL_IDX_KEY, '0'); } catch {}
                                setBgPlaylistId(pl.id);
                                const firstTrack = pl.trackIds.map(id => tracks.find(t => t.id === id)).find(t => t?.play_url);
                                if (firstTrack?.play_url) {
                                  bgAudio.playPlaylist(firstTrack.play_url, () => { /* onEnded wired inside PlaylistPlayer once mounted */ });
                                } else {
                                  emitEvent('wakti-bg-music-indicator-on');
                                }
                                setActivePlaylist(pl);
                              }
                            }}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95 border ${
                              isPlBgActive
                                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-400 dark:text-emerald-300 shadow-[0_0_12px_hsla(142,76%,55%,0.25)]'
                                : 'bg-red-500/10 border-red-400/40 text-red-400 dark:text-red-300 hover:bg-red-500/15 hover:border-red-400/60'
                            }`}
                          >
                            <Radio className="h-3.5 w-3.5" />
                            <span>{isAr ? 'تشغيل في الخلفية' : 'Play in background'}</span>
                            {isPlBgActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                          </button>
                        )}
                      </div>

                      <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">
                        {isAr ? 'مقاطع هذه القائمة' : 'Tracks in this playlist'}
                      </p>
                      {plTracks.length === 0 ? (
                        <p className="text-xs text-muted-foreground/40">{isAr ? 'لا توجد مقاطع في هذه القائمة بعد.' : 'No tracks in this playlist yet.'}</p>
                      ) : (
                        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                          {plTracks.map(t => {
                            const tTitle = t.title || (isAr ? 'مقطع موسيقي' : 'Music Track');
                            return (
                              <div key={t.id}
                                className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left bg-[#ffffff] dark:bg-purple-500/15 border border-[#d9dde7] dark:border-purple-400/20 shadow-[0_4px_12px_rgba(6,5,65,0.05)] dark:shadow-none">
                                <div className="w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors bg-[#8b5cf6] dark:bg-purple-500 border-[#7c3aed] dark:border-purple-400">
                                  <Check className="h-2.5 w-2.5 text-white" />
                                </div>
                                {t.cover_url
                                  ? <img src={t.cover_url} alt={tTitle} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                                  : <div className="w-7 h-7 rounded-lg bg-[#f7f8fc] dark:bg-white/[0.06] border border-[#e4e7ef] dark:border-transparent flex items-center justify-center flex-shrink-0"><Music className="h-3 w-3 text-muted-foreground/40" /></div>
                                }
                                <span className="text-xs text-foreground truncate flex-1">{tTitle}</span>
                                {!pl.isSystem && (
                                  <button
                                    onClick={() => toggleTrackInPlaylist(pl, t.id)}
                                    title={isAr ? 'إزالة من القائمة' : 'Remove from playlist'}
                                    className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {pickerOpen && !pl.isSystem && (
                        <div className="pt-2 border-t border-[#eef1f6] dark:border-white/10 space-y-2">
                          <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">
                            {isAr ? 'إضافة مقاطع إلى القائمة' : 'Add tracks to playlist'}
                          </p>
                          {tracks.filter(t => !pl.trackIds.includes(t.id)).length === 0 ? (
                            <p className="text-xs text-muted-foreground/40">{isAr ? 'كل المقاطع موجودة بالفعل في هذه القائمة.' : 'All tracks are already in this playlist.'}</p>
                          ) : (
                            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                              {tracks.filter(t => !pl.trackIds.includes(t.id)).map(t => {
                                const tTitle = t.title || (isAr ? 'مقطع موسيقي' : 'Music Track');
                                return (
                                  <button key={t.id} onClick={() => toggleTrackInPlaylist(pl, t.id)}
                                    className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left transition-all active:scale-[0.98] bg-[#ffffff] dark:bg-transparent border border-[#e5e7eb] dark:border-transparent hover:bg-[#f8f9fc] dark:hover:bg-white/[0.04] shadow-[0_2px_8px_rgba(6,5,65,0.04)] dark:shadow-none">
                                    <div className="w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors border-[#d1d5db] dark:border-white/20" />
                                    {t.cover_url
                                      ? <img src={t.cover_url} alt={tTitle} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                                      : <div className="w-7 h-7 rounded-lg bg-[#f7f8fc] dark:bg-white/[0.06] border border-[#e4e7ef] dark:border-transparent flex items-center justify-center flex-shrink-0"><Music className="h-3 w-3 text-muted-foreground/40" /></div>
                                    }
                                    <span className="text-xs text-foreground truncate flex-1">{tTitle}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
      {/* ── Delete track dialog ── */}
      <AlertDialog open={!!deleteTrackTarget} onOpenChange={(open) => !open && setDeleteTrackTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? 'حذف المقطع' : 'Delete Track'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr ? 'هل أنت متأكد من حذف هذا المقطع؟ لا يمكن التراجع.' : 'Are you sure? This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isAr ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isAr ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete playlist dialog ── */}
      <AlertDialog open={!!deletePlaylistTarget} onOpenChange={(open) => !open && setDeletePlaylistTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? 'حذف القائمة' : 'Delete Playlist'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr ? `هل تريد حذف قائمة "${deletePlaylistTarget?.name}"؟ لا يمكن التراجع.` : `Delete playlist "${deletePlaylistTarget?.name}"? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isAr ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletePlaylistTarget && handleDeletePlaylist(deletePlaylistTarget)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isAr ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk delete tracks dialog ── */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={(open) => !open && setBulkDeleteDialogOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? 'حذف مقاطع متعددة' : 'Delete Multiple Tracks'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr
                ? `هل أنت متأكد من حذف ${selectedTrackIds.size} مقاطع؟ لا يمكن التراجع.`
                : `Are you sure you want to delete ${selectedTrackIds.size} tracks? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkDeleteDialogOpen(false)}>{isAr ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isAr ? 'حذف الكل' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
