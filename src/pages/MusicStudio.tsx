import React, { useEffect, useMemo, useRef, useState } from 'react';
import InstagramPublishButton from '@/components/instagram/InstagramPublishButton';
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
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { AudioPlayer } from '@/components/music/AudioPlayer';
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
  ChevronUp,
  Film,
  Download,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import AIVideomaker from '@/components/video-maker/AIVideomaker';
import StudioImageGenerator from '@/components/studio/StudioImageGenerator';
import SavedImagesTab from '@/components/studio/SavedImagesTab';
import QRCodeCreator from '@/components/studio/QRCodeCreator';
import { useLocation } from 'react-router-dom';

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

// Helper function to download audio files on mobile
const handleDownload = async (url: string, filename: string) => {
  try {
    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const safeUrl = normalizeAudioUrl(url);
    if (!safeUrl) {
      throw new Error('Missing audio URL');
    }
    
    const response = await fetch(safeUrl);
    const blob = await response.blob();
    
    // On iOS, use Share API if available for better UX
    if (isIOS && navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: 'audio/mpeg' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Wakti Music',
          text: 'Download your music'
        });
        return;
      }
    }
    
    // Fallback: Standard download approach
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    // Cleanup after a short delay
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    }, 100);
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
        .select('id, title, thumbnail_url, storage_path, duration_seconds, is_public, created_at, video_url')
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
  const [mainTab, setMainTab] = useState<'studio' | 'music' | 'video' | 'image' | 'qrcode'>('studio');
  const [musicSubTab, setMusicSubTab] = useState<'compose' | 'editor'>('compose');
  const [videoMode, setVideoMode] = useState<'ai' | 'saved'>('ai');
  const [imageMode, setImageMode] = useState<'create' | 'saved'>('create');
  const [musicQuotaHeader, setMusicQuotaHeader] = useState({ remaining: 30, limit: 30, used: 0 });
  const location = useLocation();

  useEffect(() => {
    const state = (location.state || {}) as any;
    if (state?.openVideoTab) {
      setMainTab('video');
      setVideoMode('saved');
    }
  }, [location.state]);

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
      <div className="flex gap-2.5 p-2 rounded-2xl bg-black/20 dark:bg-black/30 backdrop-blur-xl border border-white/10 dark:border-white/[0.08] shadow-inner overflow-x-auto scrollbar-hide">
        {[
          { key: 'music' as const, icon: <Music className="h-3.5 w-3.5" />, labelEn: 'Music', labelAr: 'الموسيقى', activeGrad: 'from-sky-500 to-blue-600', activeShadow: 'shadow-[0_4px_14px_hsla(210,100%,65%,0.45)]' },
          { key: 'video' as const, icon: <Video className="h-3.5 w-3.5" />, labelEn: 'Video', labelAr: 'الفيديو', activeGrad: 'from-orange-500 to-rose-500', activeShadow: 'shadow-[0_4px_14px_hsla(25,95%,60%,0.45)]' },
          { key: 'image' as const, icon: <ImageIcon className="h-3.5 w-3.5" />, labelEn: 'Image', labelAr: 'الصورة', activeGrad: 'from-emerald-500 to-teal-500', activeShadow: 'shadow-[0_4px_14px_hsla(160,80%,55%,0.45)]' },
          { key: 'qrcode' as const, icon: <QrCode className="h-3.5 w-3.5" />, labelEn: 'QR Code', labelAr: 'كود QR', activeGrad: 'from-violet-500 to-purple-600', activeShadow: 'shadow-[0_4px_14px_hsla(280,70%,65%,0.45)]' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key)}
            className={`flex items-center justify-center gap-1.5 px-4 md:px-6 py-2.5 rounded-xl font-semibold text-xs md:text-sm transition-all duration-200 active:scale-[0.93] whitespace-nowrap flex-shrink-0 flex-1 ${
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
                {language === 'ar' ? `المستخدم: ${musicQuotaHeader.used} / ${musicQuotaHeader.limit}` : `Used: ${musicQuotaHeader.used} / ${musicQuotaHeader.limit}`}
              </div>
              <div className="text-[11px] text-muted-foreground/80 dark:text-muted-foreground/60">
                {language === 'ar' ? `المتبقي: ${musicQuotaHeader.remaining} هذا الشهر` : `Remaining ${musicQuotaHeader.remaining} this month`}
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
                  onClick={() => setMusicSubTab(t.key)}
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

          {musicSubTab === 'compose' ? (
            <ComposeTab
              onSaved={()=>setMusicSubTab('editor')}
              onQuotaChange={setMusicQuotaHeader}
            />
          ) : <EditorTab />}
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
            <StudioImageGenerator onSaveSuccess={() => setImageMode('saved')} />
          ) : (
            <SavedImagesTab onCreate={() => setImageMode('create')} />
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
          items: ['بوب خليجي','خليجي رومانسي','خليجي أنيق','خليجي حفلات','خليجي أعراس']
        },
        {
          title: 'خليجي — راديو وكروس أوفر',
          items: ['خليجي إذاعي','خليجي دانس','خليجي إلكتروني','خليجي سينث بوب','فيوجن خليجي','إنجليزي بطابع خليجي']
        },
        {
          title: 'خليجي — ريتش وإيفنت',
          items: ['خليجي آر أند بي','خليجي فاخر','خليجي سينمائي','خليجي جماهيري','مناسبات وطنية خليجية']
        },
        {
          title: 'خليجي — تراثي',
          items: ['خليجي تراثي','شيلات','سامري','جلسة','ليوان','شعبي خليجي']
        },
        {
          title: 'عربي آخر',
          items: ['مصري','شعبي مصري','مهرجانات','شامي','بوب عربي']
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
        title: 'GCC — Core',
        items: ['GCC Pop','GCC Romantic','GCC Elegant','GCC Party','GCC Wedding']
      },
      {
        title: 'GCC — Radio & Crossover',
        items: ['GCC Radio Pop','GCC Dance Pop','GCC Electro Pop','GCC Synth Pop','Modern Khaleeji Fusion','English GCC Pop']
      },
      {
        title: 'GCC — Rich & Event',
        items: ['GCC R&B Pop','Luxury GCC Pop','Cinematic GCC','GCC Anthem','National Event GCC']
      },
      {
        title: 'GCC — Heritage',
        items: ['GCC Traditional','Sheilat','Samri','Ardah','Jalsa','Liwa','GCC Shaabi','Zar','Khaleeji Trap']
      },
      {
        title: 'Other Arabic',
        items: ['Egyptian','Egyptian Shaabi','Levant Pop','Arabic Pop']
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
  const [titleOpen, setTitleOpen] = useState(false);
  const [musicStyleOpen, setMusicStyleOpen] = useState(false);
  const [stylesOpen, setStylesOpen] = useState(false);
  const [instrumentsOpen, setInstrumentsOpen] = useState(false);
  const [rhythmOpen, setRhythmOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [instrumentTags, setInstrumentTags] = useState<string[]>([]);
  const [rhythmTags, setRhythmTags] = useState<string[]>([]);
  const [moodTags, setMoodTags] = useState<string[]>([]);
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
  const [vocalType, setVocalType] = useState<'auto'|'none'|'female'|'male'>('auto');
  const [vocalsOpen, setVocalsOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [audios, setAudios] = useState<Array<{ url: string; mime: string; meta?: any; createdAt: number; saved?: boolean }>>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [songsUsed, setSongsUsed] = useState(0);
  const [songsLimit, setSongsLimit] = useState(5);
  const [songsRemaining, setSongsRemaining] = useState(5);
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

  // Rhythm / Beat groups
  const RHYTHM_GROUPS = useMemo<Array<{ title: string; items: string[] }>>(() => {
    if (language === 'ar') {
      return [
        { title: 'خليجي', items: ['إيقاع خليجي','خليجي متمايل','عدني','سامري','إيقاع أعراس','إيقاع تصفيق','إيقاع الليوان','مقسوم'] },
        { title: 'عالمي', items: ['٦/٨ فيوجن','أفرو خليجي','بوب ٤/٤','بالاد هادئ','إيقاع جماهيري','إيقاع نادي','والتز ٣/٤','تراب بيت','دريل بيت'] },
      ];
    }
    return [
      { title: 'Gulf Rhythms', items: ['Gulf Groove','Khaleeji Shuffle','Adani','Samri Rhythm','Wedding Beat','Clap-Driven Groove','Leiwah Rhythm','Maqsoum'] },
      { title: 'Universal', items: ['6/8 Fusion','Afro-Gulf Groove','Pop 4/4','Ballad Slow Groove','Marching Anthem','Club Beat','Waltz 3/4','Trap Beat','Drill Beat'] },
    ];
  }, [language]);

  const RHYTHM_PRESETS = useMemo<string[]>(() => {
    return RHYTHM_GROUPS.flatMap((g) => g.items);
  }, [RHYTHM_GROUPS]);

  // Style to recommended instruments mapping
  const STYLE_INSTRUMENT_MAPPING = useMemo<Record<string, string[]>>(() => {
    if (language === 'ar') {
      return {
        // GCC Core
        'بوب خليجي': ['طبلة', 'دربوكة', 'طار', 'جيتار كهربائي', 'سينث باد'],
        'خليجي عصري': ['طبلة', 'دربوكة', 'جيتار كهربائي', 'سينث باد', 'باص جيتار'],
        'خليجي رومانسي': ['قانون', 'ناي', 'كمان', 'بيانو', 'تشيلو'],
        'خليجي أنيق': ['قانون', 'ناي', 'كمان', 'بيانو'],
        'خليجي حفلات': ['طبلة', 'دربوكة', 'طار', 'تصفيق يدوي', 'سينث باد'],
        'خليجي أعراس': ['طبلة', 'دربوكة', 'دف', 'تصفيق يدوي', 'هتاف جماعي'],
        // GCC Radio & Crossover
        'خليجي إذاعي': ['جيتار كهربائي', 'باص جيتار', 'طقم درامز', 'سينث باد', 'بيانو'],
        'خليجي دانس': ['طقم درامز', 'باص جيتار', 'سينث ليد', 'طبلة', 'تصفيق يدوي'],
        'خليجي إلكتروني': ['سينث ليد', 'سينث باد', 'طقم درامز', 'باص جيتار', 'طبلة'],
        'خليجي سينث بوب': ['سينث ليد', 'سينث باد', 'طقم درامز', 'باص جيتار'],
        'فيوجن خليجي': ['جيتار كهربائي', 'باص جيتار', 'طقم درامز', 'سينث باد', 'طبلة'],
        'إنجليزي بطابع خليجي': ['سينث ليد', 'جيتار كهربائي', 'باص جيتار', 'طقم درامز', 'إيقاع خليجي'],
        // GCC Rich & Event
        'خليجي آر أند بي': ['بيانو كهربائي', 'باص جيتار', 'طقم درامز', 'سينث باد', 'طبلة'],
        'خليجي فاخر': ['بيانو', 'وتريات', 'باص جيتار', 'سينث باد', 'طبلة ناعمة'],
        'خليجي سينمائي': ['وتريات', 'بيانو', 'سينث باد', 'طقم درامز', 'كورس'],
        'خليجي جماهيري': ['طبلة', 'دربوكة', 'تصفيق يدوي', 'كورس', 'سينث باد'],
        'مناسبات وطنية خليجية': ['طقم درامز', 'كورس', 'وتريات', 'تصفيق يدوي', 'سينث باد'],
        // GCC Heritage
        'خليجي تراثي': ['قانون', 'ناي', 'رق', 'طبلة', 'رباب'],
        'شيلات': ['طبلة', 'دربوكة', 'طار', 'هتاف جماعي'],
        'سامري': ['طبلة', 'دربوكة', 'طار', 'رباب'],
        'جلسة': ['عود', 'قانون', 'طبلة', 'رق', 'ناي'],
        'ليوان': ['طبلة', 'دربوكة', 'طار'],
        'شعبي خليجي': ['طار', 'طبلة', 'دربوكة', 'رباب', 'هتاف جماعي'],
        // Other Arabic
        'مصري': ['عود', 'قانون', 'ناي', 'طبلة', 'دربوكة', 'رق'],
        'شعبي مصري': ['طقم درامز', 'سينث ليد', 'باص جيتار', 'جيتار كهربائي', 'دربوكة'],
        'مهرجانات': ['طقم درامز', 'سينث ليد', 'باص جيتار', 'إيقاع'],
        'أناشيد': ['دف'],
      };
    }
    return {
      // ── GCC Core ──
      // GCC Pop = modern Gulf pop + hip-hop energy: 808, trap hi-hats, synth, claps, Gulf flavor
      'GCC Pop': ['808 bass', 'trap hi-hats', 'drum machine', 'synth lead', 'bass guitar', 'hand claps', 'mirwas', 'synth pad'],
      'GCC Romantic': ['violin', 'ney', 'piano', 'cello', 'riq', 'soft percussion'],
      'GCC Elegant': ['violin', 'qanun', 'piano', 'ney', 'soft percussion', 'strings'],
      'GCC Party': ['mirwas', 'darbuka', 'frame drum', 'hand claps', 'bass guitar', 'synth lead'],
      'GCC Wedding': ['mirwas', 'darbuka', 'daff', 'tabl', 'hand claps', 'group chant'],
      // ── GCC Radio & Crossover ──
      // modern radio: Gulf percussion groove leads, western instruments support
      'GCC Radio Pop': ['mirwas', 'darbuka', 'bass guitar', 'drum kit', 'synth pad', 'electric guitar'],
      'GCC Dance Pop': ['mirwas', 'darbuka', 'hand claps', 'bass guitar', 'synth lead', 'drum kit'],
      'GCC Electro Pop': ['mirwas', 'darbuka', 'synth lead', 'synth bass', 'drum kit', 'synth pad'],
      'GCC Synth Pop': ['mirwas', 'darbuka', 'synth lead', 'synth pad', 'synth bass', 'drum kit'],
      'Modern Khaleeji Fusion': ['mirwas', 'darbuka', 'frame drum', 'bass guitar', 'synth pad', 'electric guitar'],
      'English GCC Pop': ['mirwas', 'darbuka', 'hand claps', 'bass guitar', 'synth lead', 'electric guitar'],
      // ── GCC Rich & Event ──
      'GCC R&B Pop': ['mirwas', 'darbuka', 'electric piano', 'bass guitar', 'synth pad', 'strings'],
      'Luxury GCC Pop': ['violin', 'strings', 'piano', 'riq', 'bass guitar', 'synth pad'],
      'Cinematic GCC': ['strings', 'tabl', 'choir', 'piano', 'synth pad', 'frame drum'],
      'GCC Anthem': ['tabl', 'darbuka', 'hand claps', 'choir', 'drum kit', 'synth pad'],
      'National Event GCC': ['tabl', 'darbuka', 'choir', 'strings', 'drum kit', 'hand claps'],
      // ── GCC Heritage — oud IS authentic here ──
      'GCC Traditional': ['oud', 'qanun', 'ney', 'tabla', 'riq', 'rebab'],
      'Sheilat': ['frame drum', 'mirwas', 'darbuka', 'tabl', 'group chant'],
      'Samri': ['frame drum', 'mirwas', 'darbuka', 'tabl', 'rebab'],
      'Jalsa': ['oud', 'qanun', 'riq', 'tabla', 'ney'],
      'Liwa': ['tanbura', 'frame drum', 'mirwas', 'darbuka', 'gulf percussion'],
      'GCC Shaabi': ['oud', 'qanun', 'riq', 'tabla', 'ney'],
      'Zar': ['tanbura', 'frame drum', 'brass cymbals', 'clay drum', 'mirwas'],
      'Ardah': ['tabl drum', 'tabl turki', 'darbuka', 'mirwas'],
      'Khaleeji Trap': ['808 bass', 'trap hi-hats', 'mirwas', 'darbuka', 'synth lead', 'synth pad'],
      // ── Other Arabic ──
      'Egyptian': ['oud', 'qanun', 'ney', 'tabla', 'darbuka', 'riq'],
      'Egyptian Shaabi': ['drum machine', 'synth lead', 'bass guitar', 'electric guitar', 'darbuka'],
      'Anasheed': ['daff'],
      'Arabic Pop': ['piano', 'violin', 'tabla', 'electric guitar', 'synth pad'],
      'Levant Pop': ['piano', 'violin', 'acoustic guitar', 'drum kit', 'synth pad'],
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
  }, [language]);

  // Get recommended instruments for current style selection
  const recommendedInstruments = useMemo(() => {
    const recommended: string[] = [];
    for (const style of includeTags) {
      const mapped = STYLE_INSTRUMENT_MAPPING[style];
      if (mapped) recommended.push(...mapped);
    }
    return [...new Set(recommended)];
  }, [includeTags, STYLE_INSTRUMENT_MAPPING]);

  // Style → recommended rhythms (top 2)
  const STYLE_RHYTHM_MAPPING: Record<string, string[]> = {
    'GCC Pop': ['Trap Beat', 'Gulf Groove'],
    'Khaleeji Pop': ['Trap Beat', 'Gulf Groove'],
    'GCC Romantic': ['Adani', 'Ballad Slow Groove'],
    'GCC Elegant': ['Adani', 'Khaleeji Shuffle'],
    'GCC Party': ['Gulf Groove', 'Clap-Driven Groove'],
    'GCC Wedding': ['Wedding Beat', 'Clap-Driven Groove'],
    'GCC Radio Pop': ['Gulf Groove', 'Khaleeji Shuffle'],
    'GCC Dance Pop': ['Gulf Groove', 'Clap-Driven Groove'],
    'GCC Electro Pop': ['Gulf Groove', 'Club Beat'],
    'GCC Synth Pop': ['Khaleeji Shuffle', 'Gulf Groove'],
    'Modern Khaleeji Fusion': ['Gulf Groove', 'Khaleeji Shuffle'],
    'English GCC Pop': ['Gulf Groove', 'Clap-Driven Groove'],
    'GCC R&B Pop': ['Gulf Groove', 'Adani'],
    'Luxury GCC Pop': ['Adani', 'Ballad Slow Groove'],
    'Cinematic GCC': ['Marching Anthem', '6/8 Fusion'],
    'GCC Anthem': ['Marching Anthem', 'Clap-Driven Groove'],
    'National Event GCC': ['Marching Anthem', 'Clap-Driven Groove'],
    'GCC Traditional': ['Adani', 'Gulf Groove'],
    'Sheilat': ['Samri Rhythm', 'Clap-Driven Groove'],
    'Samri': ['Samri Rhythm', 'Wedding Beat'],
    'Jalsa': ['Adani', 'Gulf Groove'],
    'Liwa': ['Leiwah Rhythm', '6/8 Fusion'],
    'GCC Shaabi': ['Adani', 'Gulf Groove'],
    'Zar': ['6/8 Fusion', 'Afro-Gulf Groove'],
    'Ardah': ['Marching Anthem', 'Clap-Driven Groove'],
    'Khaleeji Trap': ['Trap Beat', 'Gulf Groove'],
    'Egyptian': ['Maqsoum', 'Ballad Slow Groove'],
    'Egyptian Shaabi': ['Maqsoum', 'Club Beat'],
    'Arabic Pop': ['Maqsoum', 'Pop 4/4'],
    'Levant Pop': ['Maqsoum', 'Ballad Slow Groove'],
    'Anasheed': ['Clap-Driven Groove', 'Ballad Slow Groove'],
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
    'Afrobeats': ['Afro-Gulf Groove', 'Pop 4/4'],
    'Afrobeat': ['Afro-Gulf Groove', '6/8 Fusion'],
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
    'GCC Pop': ['energetic', 'confident', 'bold'],
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
    'Arabic Pop': ['romantic', 'emotional', 'happy'],
    'Levant Pop': ['romantic', 'emotional', 'tender'],
    'Anasheed': ['spiritual', 'calm', 'proud'],
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
    for (const style of includeTags) {
      const mapped = STYLE_RHYTHM_MAPPING[style];
      if (mapped) return mapped.slice(0, 2);
    }
    return [];
  }, [includeTags]);

  const recommendedMoods = useMemo(() => {
    for (const style of includeTags) {
      const mapped = STYLE_MOOD_MAPPING[style];
      if (mapped) return mapped.slice(0, 3);
    }
    return [];
  }, [includeTags]);
 
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
        { title: 'تراثي عربي وخليجي', items: ['عود','قانون','ناي','رق','دربوكة','طبلة','طار','دف','مجوز','رباب','إيقاع خليجي'] },
        { title: 'أوتار', items: ['كمان','فيولا','تشيلو','كونترباص','وتريات'] },
        { title: 'مفاتيح', items: ['بيانو','بيانو كهربائي','بيانو ناعم','أورغ','أكورديون'] },
        { title: 'جيتارات وباص', items: ['جيتار أكوستيك','جيتار كهربائي','باص جيتار','باص وترى','سينث باص'] },
        { title: 'إيقاع وطبول', items: ['طقم درامز','إيقاع','تصفيق يدوي','سنير','هاي-هات','صنجات','درام ماشين','808 باص'] },
        { title: 'نفخ ونحاس', items: ['فلوت','كلارينيت','ساكسفون','ترومبيت','ترومبون','هورن فرنسي','قسم النحاس','هارمونيكا','صفارة'] },
        { title: 'عالمي', items: ['سيتار','طبول ستيل','مزمار قربة','بانجو','ماندولين'] },
        { title: 'سينث وجو', items: ['سينث ليد','سينث باد','باد دافئ','باد تناظري','باد أوتار','بلاك','أربجياتور'] },
        { title: 'صوت وجماعي', items: ['كورس','هتاف جماعي','ساب باص','مؤثرات جوية'] },
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

  // Simple Amp - expand user lyrics into structured song
  async function handleAmp() {
    const userInput = lyricsText.trim() || styleText.trim() || title.trim();
    if (!userInput) {
      toast.error(isAr ? 'اكتب كلمات أولاً' : 'Write some lyrics first');
      return;
    }
    if (hasBannedInput()) {
      toast.error(isAr ? 'تحتوي المدخلات على ألفاظ غير مسموحة.' : 'Inputs contain disallowed words.');
      return;
    }
    
    setAmping(true);
    try {
      // Build the input for Amp - include style/mood/instruments context
      const contextParts: string[] = [];
      if (includeTags.length > 0) contextParts.push(`Styles: ${includeTags.join(', ')}`);
      if (rhythmTags.length > 0) contextParts.push(`Rhythm: ${rhythmTags.join(', ')}`);
      if (instrumentTags.length > 0) contextParts.push(`Instruments: ${instrumentTags.join(', ')}`);
      if (moodTags.length > 0) contextParts.push(`Mood: ${moodTags.join(', ')}`);
      if (title.trim()) contextParts.push(`Title: ${title.trim()}`);
      
      const context = contextParts.length > 0 ? contextParts.join('\n') + '\n\n' : '';
      const fullInput = context + `User lyrics:\n${userInput}`;
      
      const { data, error } = await supabase.functions.invoke('music-amp', {
        body: { 
          text: fullInput, 
          mode: 'lyrics',
          duration: duration 
        }
      });
      
      if (error) throw error;
      const expandedLyrics = (data?.text || '').toString();
      if (!expandedLyrics) throw new Error(isAr ? 'تعذّر التوسيع' : 'Expansion failed');
      
      setLyricsText(expandedLyrics);
      toast.success(isAr ? 'تم توسيع الكلمات' : 'Lyrics expanded');
    } catch (e: any) {
      toast.error((isAr ? 'فشل: ' : 'Failed: ') + (e?.message || String(e)));
    } finally {
      setAmping(false);
    }
  }

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
    setIncludeTags((prev) => {
      if (prev.includes(style)) {
        return prev.filter((tag) => tag !== style);
      }
      if (prev.length >= 1) {
        return [style]; // replace with new selection
      }
      const next = [style];
      setTimeout(() => {
        setStylesOpen(false);
        setRhythmOpen(true);
        setInstrumentsOpen(false);
        setMoodOpen(false);
      }, 0);
      return next;
    });
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
    setInstrumentTags((prev) => {
      const merged = [...new Set([...prev, ...recommendedInstruments])];
      const limited = merged.slice(0, 13);

      if (merged.length > 13) {
        toast.error(isAr ? 'يمكنك اختيار 13 آلة كحد أقصى' : 'You can select up to 13 instruments');
      }

      if (limited.length === 13) {
        setTimeout(() => {
          setInstrumentsOpen(false);
          setMoodOpen(true);
          setStylesOpen(false);
        }, 0);
      }

      return limited;
    });
  }

  function handleInstrumentToggle(inst: string) {
    setInstrumentTags((prev) => {
      if (prev.includes(inst)) {
        return prev.filter((tag) => tag !== inst);
      }

      if (prev.length >= 13) {
        toast.error(isAr ? 'يمكنك اختيار 13 آلة كحد أقصى' : 'You can select up to 13 instruments');
        return prev;
      }

      const next = [...prev, inst];

      if (next.length === 13) {
        setTimeout(() => {
          setInstrumentsOpen(false);
          setMoodOpen(true);
          setStylesOpen(false);
        }, 0);
      }

      return next;
    });
  }

  function handleInstrumentsNext() {
    setInstrumentsOpen(false);
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
  }

  function toggleMainSection(section: 'title' | 'style' | 'vocals' | 'lyrics') {
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

  // Ensure lyrics never exceed current cap when style changes
  useEffect(() => {
    const cap = lyricsCap;
    if (Array.from(lyricsText || '').length > cap) {
      setLyricsText(Array.from(lyricsText).slice(0, cap).join(''));
    }
  }, [styleText, lyricsCap]);

  // Ensure lyrics respect the current character cap when duration changes
  useEffect(() => {
    if (!lyricsText) return;
    const capped = Array.from(lyricsText).slice(0, lyricsCap).join('');
    if (capped !== lyricsText) setLyricsText(capped);
  }, [lyricsCap, lyricsText]);

  // Build style string from chips + styleText
  function buildKieStyleString(): string {
    const expandStyleTag = (part: string): string => {
      const value = part.trim();
      if (!value) return '';

      const mappings: Record<string, string> = {
        // ── GCC Core ──
        'GCC Pop': 'Khaleeji pop, modern commercial Gulf Arabic style, catchy melodic hook, polished production, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'Khaleeji Pop': 'Khaleeji pop, authentic Gulf Arabic sound, modern commercial production, catchy hook, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'GCC Romantic': 'Romantic Khaleeji ballad, warm heartfelt Gulf Arabic melody, emotional elegant vocal delivery, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'GCC Elegant': 'Elegant Khaleeji pop, refined and graceful Gulf Arabic style, classy polished production, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'GCC Party': 'Khaleeji party anthem, festive high-energy Gulf Arabic pop, big celebratory chorus, danceable crowd-friendly vibe, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'GCC Wedding': 'Khaleeji wedding song, joyful festive Gulf celebration atmosphere, traditional wedding energy, Gulf Arabic accent, Khaleeji dialect pronunciation',
        // ── GCC Radio & Crossover ──
        'GCC Radio Pop': 'Gulf Arabic radio pop, mainstream commercial khaleeji sound, radio-friendly catchy hook, polished pop production, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'GCC Dance Pop': 'Khaleeji dance pop, uptempo danceable Gulf Arabic groove, modern commercial finish, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'GCC Electro Pop': 'Gulf Arabic electro pop, electronic production with khaleeji rhythmic identity, catchy electronic hook, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'GCC Synth Pop': 'Gulf Arabic synth pop, glossy synthesizer-led production, khaleeji phrasing, radio-ready hook, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'Modern Khaleeji Fusion': 'Modern Khaleeji fusion, hybrid Gulf Arabic sound blending western pop production with Gulf rhythmic identity, youth-oriented, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'English GCC Pop': 'English language pop song with clear Gulf Arabic Khaleeji flavor, catchy English hook, Gulf accent character, Gulf Arabic musical identity',
        // ── GCC Rich & Event ──
        'GCC R&B Pop': 'Gulf Arabic R&B pop, smooth modern vocal-forward khaleeji R&B, polished urban production, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'Luxury GCC Pop': 'Luxury Gulf Arabic pop, premium elegant khaleeji production, rich orchestral touches, confident luxurious vibe, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'Cinematic GCC': 'Cinematic Gulf Arabic music, dramatic large-scale orchestral khaleeji sound, sweeping emotional atmosphere, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'GCC Anthem': 'Khaleeji anthem, crowd-unifying Gulf Arabic song, strong powerful chorus, proud bold energy, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'National Event GCC': 'Gulf national event music, ceremonial proud khaleeji sound, patriotic anthem vibe, majestic large-scale production, Gulf Arabic accent, Khaleeji dialect pronunciation',
        // ── GCC Heritage ──
        'GCC Traditional': 'Traditional Khaleeji music, purist acoustic Gulf Arabic folk identity, authentic heritage sound, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'Sheilat': 'Khaleeji sheilat, chant-driven Gulf Arabic folk tradition, strong masculine group vocal energy, call-and-response style, authentic Gulf identity, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'Samri': 'Samri, Gulf Arabic folk tradition from Najd, martial ceremonial sword-dance energy, traditional authentic Gulf Arabic sound, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'Jalsa': 'Khaleeji jalsa, intimate Gulf Arabic sitting session, warm conversational musical atmosphere, acoustic and delicate sound, authentic Gulf Arabic sound, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'Liwa': 'Liwa, Afro-Gulf coastal tradition, East African influenced Gulf music, polyrhythmic feel, authentic Gulf identity, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'GCC Shaabi': 'Khaleeji Shaabi, calm traditional Gulf folk music, relaxed intimate atmosphere, melodic solo vocal, no chanting, no loud percussion, authentic Gulf Arabic sound, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'Zar': 'Zar, Gulf African ritual trance tradition, repetitive hypnotic spiritual healing ceremony atmosphere, Bahraini Zar style, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'Ardah': 'Ardah, Saudi Gulf national martial ceremony, classical Arabic poetry recitation, stately dignified energy, sword dance tradition, Gulf Arabic accent, Khaleeji dialect pronunciation',
        'Khaleeji Trap': 'Khaleeji trap, Gulf Arabic trap fusion, modern Gulf youth sound, Khaleeji dialect vocals, Arabic lyrics, urban street energy, Gulf Arabic accent',
        // ── Other Arabic ──
        'Egyptian': 'Egyptian pop, authentic Egyptian Arabic style, modern Egyptian commercial production, warm melodic character, polished Egyptian sound, Egyptian dialect pronunciation, Egyptian Arabic accent',
        'Egyptian Shaabi': 'Egyptian shaabi street pop, Cairo street music energy, fast-paced high-energy compressed sound, Egyptian street dialect pronunciation, Egyptian Arabic accent',
        'Arabic Pop': 'Modern Arabic pop, pan-Arabic commercial sound, western-influenced Arabic production, catchy melody, polished radio-ready finish, Modern Standard Arabic pronunciation, clear Arabic accent',
        'Levant Pop': 'Levantine Arabic pop, Syrian-Lebanese commercial style, smooth emotional Arabic melody, modern production, Levantine Arabic dialect pronunciation, Lebanese-Syrian accent',
        'Anasheed': 'Islamic nasheed, strictly a cappella vocal tradition, zero melodic instruments, no strings, no keys, no electronic instruments, multi-layered human vocal harmonies only, deep spiritual choral arrangements, Islamic spiritual energy, Arabic pronunciation, elevated poetic Arabic language',
        // ── New Global Genres ──
        'funk': 'funk music, syncopated groovy feel, rhythmic danceable character, James Brown style groove energy',
        'disco': 'disco music, glamorous 70s dance music vibe, four-on-the-floor dance energy, upbeat polished feel',
        'Salsa': 'salsa music, Caribbean Latin dance tradition, energetic syncopated Latin groove, vibrant social dance feel',
        'Bossa Nova': 'bossa nova, Brazilian jazz fusion, relaxed sophisticated sound, warm intimate Latin jazz atmosphere',
        'punk rock': 'punk rock, fast raw rebellious energy, stripped-down aggressive character, DIY spirit, short sharp songs',
        'alternative rock': 'alternative rock, non-commercial expressive rock sound, emotional authentic character, experimental textures',
        'indie rock': 'indie rock, independent guitar-driven sound, authentic introspective feel, raw artistic identity',
        'thrash metal': 'thrash metal, fast aggressive extreme metal style, intense powerful energy, relentless driving character',
        'grunge': 'grunge, raw emotional distorted rock, melancholic heavy sound, Seattle grunge aesthetic',
        'bluegrass': 'bluegrass, acoustic American roots music, tight vocal harmonies, energetic traditional folk character',
        'folk': 'folk music, acoustic storytelling tradition, authentic roots sound, lyrical narrative focus',
        'blues': 'blues music, soulful expressive emotional character, blues scale melody, deep raw feeling',
        'delta blues': 'delta blues, raw Southern acoustic blues tradition, sparse arrangement, deep emotional roots',
        'smooth jazz': 'smooth jazz, mellow easy listening jazz, polished laid-back groove, soothing melodic character',
        'swing': 'swing music, big band jazz tradition, dance hall energy, swing feel, 1930s-40s era character',
        'classical': 'classical music, Western orchestral composition tradition, rich harmonic complexity, formal structured arrangement',
        'gospel': 'gospel music, spiritual Christian music tradition, powerful uplifting vocal energy, soul-stirring devotional character',
        'reggae': 'reggae music, Jamaican offbeat tradition, relaxed tempo, socially conscious lyrical spirit',
        'ska': 'ska music, upbeat offbeat Jamaican rhythm tradition, lively danceable character',
        'dub': 'dub music, reggae-rooted remix tradition, deep immersive bass-heavy soundscape, echo-drenched atmosphere',
        'ambient': 'ambient music, atmospheric minimalistic mood-based sound, relaxing immersive soundscape',
        'synthwave': 'synthwave, retro 80s inspired electronic music, cinematic nostalgic feel, vintage synthesizer character',
        'chillwave': 'chillwave, dreamy lo-fi nostalgic electronic sound, reverb-drenched relaxed atmosphere',
        // ── Rhythm chips ──
        'Gulf Groove': 'khaleeji groove, gulf rhythmic pattern, syncopated Gulf beat',
        'Khaleeji Shuffle': 'khaleeji shuffle rhythm, swing feel Gulf beat',
        'Adani': 'adani rhythm, swaying romantic Gulf groove, hypnotic 4-beat Gulf feel',
        'Samri Rhythm': 'samri rhythm, martial driving Gulf beat, frame drums',
        'Wedding Beat': 'wedding festive beat, celebratory Gulf rhythm, hand clap driven',
        'Clap-Driven Groove': 'hand clap driven groove, crowd rhythm, celebratory pulse',
        '6/8 Fusion': '6/8 time feel, dramatic crossover fusion rhythm',
        'Afro-Gulf Groove': 'afro-gulf groove, coastal syncopated rhythm, polyrhythmic feel',
        'Pop 4/4': 'standard pop 4/4 beat, accessible mainstream rhythm',
        'Ballad Slow Groove': 'slow ballad groove, spacious emotional rhythm',
        'Marching Anthem': 'marching anthem beat, ceremonial proud rhythm',
        'Club Beat': 'club dance beat, high energy electronic rhythm',
        'Leiwah Rhythm': 'leiwah rhythm, Afro-Gulf polyrhythmic feel, 6/8 coastal Gulf beat, frame drums, East African Gulf tradition',
        'Maqsoum': 'maqsoum rhythm, classic Arabic percussion pattern, 4/4 Egyptian-Arabic beat, tabla driven, widely used Arabic groove',
        'Waltz 3/4': 'waltz time signature, 3/4 flowing romantic rhythm, graceful sweeping groove',
        'Trap Beat': 'trap beat, modern hip hop trap rhythm, 808 bass, hi-hat rolls, punchy snare',
        'Drill Beat': 'drill beat, dark urban drill rhythm, sliding 808 bass, fast hi-hats, street energy',
        // ── Arabic rhythm chips ──
        'إيقاع خليجي': 'إيقاع خليجي أصيل، نبضة خليجية',
        'خليجي متمايل': 'إيقاع خليجي متمايل، نبضة هادئة متدفقة',
        'عدني': 'إيقاع عدني، تمايل رومانسي خليجي',
        'إيقاع أعراس': 'إيقاع أفراح خليجية، نبضة احتفالية',
        'إيقاع تصفيق': 'إيقاع تصفيق يدوي، حماس جماعي',
        '٦/٨ فيوجن': 'إيقاع ٦/٨ فيوجن، طابع درامي متقاطع',
        'أفرو خليجي': 'إيقاع أفرو خليجي، ساحلي متشعب',
        'بوب ٤/٤': 'بيت بوب ٤/٤ اعتيادي، إيقاع شائع',
        'بالاد هادئ': 'بالاد هادئ، إيقاع عاطفي فسيح',
        'إيقاع الليوان': 'إيقاع الليوان، أفرو خليجي ٦/٨، طبول ساحلية خليجية',
        'مقسوم': 'إيقاع مقسوم، نبضة عربية كلاسيكية ٤/٤، طبلة مصرية عربية',
        'والتز ٣/٤': 'إيقاع والتز ٣/٤، تدفق رومانسي راقٍ',
        'تراب بيت': 'تراب بيت، إيقاع هيب هوب حديث، 808 باص، هاي هات سريع',
        'دريل بيت': 'دريل بيت، إيقاع درامي حضري، 808 متحرك، طاقة شارع',
        'إيقاع جماهيري': 'إيقاع جماهيري، مسيرة أنشودة',
        'إيقاع نادي': 'بيت نادي راقص، إيقاع إلكتروني',
        // ── Arabic style chips ──
        'بوب خليجي': 'بوب خليجي عصري، أسلوب خليجي تجاري حديث، كورس جذاب، إنتاج احترافي مصقول، لهجة خليجية، نطق خليجي',
        'خليجي عصري': 'خليجي عصري، بوب خليجي حديث، إنتاج عصري راقٍ، لحن جذاب، لهجة خليجية',
        'خليجي رومانسي': 'خليجي رومانسي، بالاد خليجي دافئ، إحساس عاطفي راقٍ، أداء صوتي أنيق، طابع تجاري جميل، لهجة خليجية، نطق خليجي',
        'خليجي أنيق': 'خليجي أنيق، طابع عربي خليجي راقٍ، إنتاج نظيف واحترافي، أجواء أنيقة ومتزنة، لهجة خليجية، نطق خليجي',
        'خليجي حفلات': 'خليجي حفلات، جو احتفالي خليجي، كورس جماهيري مفعم بالطاقة، طابع راقص ومبهج، إنتاج عصري، لهجة خليجية، نطق خليجي',
        'خليجي أعراس': 'أغنية أعراس خليجية، فرح خليجي تقليدي، جو احتفالي عائلي مبهج، لهجة خليجية',
        'خليجي إذاعي': 'خليجي إذاعي، بوب خليجي تجاري، إنتاج مصقول، كورس جذاب صالح للإذاعة، لهجة خليجية',
        'خليجي دانس': 'خليجي دانس بوب، طابع خليجي راقص سريع الإيقاع، إنتاج عصري، لهجة خليجية',
        'خليجي إلكتروني': 'خليجي إلكتروني، طابع إلكتروني مع هوية خليجية، إنتاج خليجي عصري، لهجة خليجية',
        'خليجي سينث بوب': 'خليجي سينث بوب، إنتاج سينث مصقول، هوك راديوي، ترتيب بوب عصري، لهجة خليجية، نطق خليجي',
        'فيوجن خليجي': 'فيوجن خليجي عصري، صوت خليجي هجين يمزج الإنتاج الغربي بالهوية الخليجية، موجه للشباب، لهجة خليجية',
        'إنجليزي بطابع خليجي': 'أغنية بوب إنجليزية بنكهة خليجية واضحة، هوك إنجليزي جذاب، طابع خليجي موسيقي',
        'خليجي آر أند بي': 'خليجي آر أند بي، ناعم عصري صوتي، إنتاج حضري مصقول، لهجة خليجية',
        'خليجي فاخر': 'خليجي فاخر، إنتاج خليجي راقٍ مميز، أجواء واثقة ومضيئة، لهجة خليجية',
        'خليجي سينمائي': 'موسيقى خليجية سينمائية، صوت درامي أوركسترالي ضخم، أجواء عاطفية كاسحة، لهجة خليجية',
        'خليجي جماهيري': 'أنشودة خليجية جماهيرية، أغنية خليجية موحدة، كورس قوي، طاقة فخورة جريئة، لهجة خليجية',
        'مناسبات وطنية خليجية': 'موسيقى مناسبات وطنية خليجية، نشيد وطني فخور، إنتاج ضخم مهيب احتفالي، لهجة خليجية',
        'خليجي تراثي': 'خليجي تراثي، موسيقى خليجية عريقة أصيلة، هوية خليجية تراثية، لهجة خليجية',
        'شيلات': 'شيلات خليجية، أغنية شعبية خليجية، طاقة ذكورية جماعية قوية، أسلوب نداء واستجابة، هوية خليجية أصيلة، لهجة خليجية',
        'سامري': 'سامري، تراث شعبي خليجي من نجد، طاقة حربية احتفالية، رقصة السيف التقليدية، عربي خليجي أصيل، لهجة خليجية',
        'جلسة': 'جلسة خليجية حميمة، جو موسيقي حواري دافئ، صوت أكوستيكي ناعم ومتأمل، لهجة خليجية',
        'ليوان': 'الليوان، تراث خليجي أفريقي ساحلي، مؤثرات أفريقية شرقية خليجية، إيقاع متعدد، لهجة خليجية',
        'مصري': 'بوب مصري أصيل، إنتاج مصري تجاري عصري، لحن مصري دافئ جذاب، صوت مصري مصقول، لهجة مصرية واضحة',
        'أناشيد': 'أناشيد إسلامية، صوت بشري بحت فقط، لا آلات موسيقية إطلاقاً، انسجام صوتي متعدد الطبقات، طاقة روحانية إسلامية، دف اختياري فقط، لغة عربية فصيحة شعرية رفيعة',
        'مهرجانات': 'مهرجانات مصرية، بوب شعبي إلكتروني ضاج، طاقة عالية ضاغطة، روح شارع مصري، لهجة مصرية',
        'شامي': 'بوب شامي، أسلوب عربي لبناني سوري، لحن عربي ناعم عاطفي، إنتاج عصري، لهجة شامية',
        'بوب عربي': 'بوب عربي حديث، صوت عربي تجاري، لحن عربي جذاب، إنتاج راديوي مصقول، لهجة عربية',
      };

      return mappings[value] ?? value;
    };

    const parts = [...includeTags, ...rhythmTags, ...instrumentTags, ...moodTags]
      .map((part) => expandStyleTag(part))
      .filter(Boolean);
    if (styleText.trim()) parts.push(styleText.trim());
    return parts.join(' ').replace(/\s+/g, ' ').trim();
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

    try {
      const { data: { user } } = await supabase.auth.getUser();
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
      const kieStyle = buildKieStyleString();
      const durationTarget = Math.min(120, duration);

      const invokeBody: Record<string, unknown> = {
        title: title.trim() || (language === 'ar' ? 'موسيقى وقتي' : 'Wakti Music'),
        style: kieStyle || (language === 'ar' ? 'بوب عربي' : 'pop'),
        customMode: true,
        instrumental,
        model: 'V5_5',
        duration_seconds: durationTarget,
      };

      if (!instrumental) invokeBody.prompt = lyricsText.trim() || styleText.trim();
      if (vocalGender) invokeBody.vocalGender = vocalGender;

      const { data: genData, error: genError } = await supabase.functions.invoke('music-generate', {
        body: invokeBody,
      });

      if (genError?.message?.includes('TRIAL_LIMIT_REACHED') || genData?.error === 'TRIAL_LIMIT_REACHED') {
        window.dispatchEvent(new CustomEvent('wakti-trial-limit-reached', { detail: { feature: 'music' } }));
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

  // Poll music-status when a generation task is active
  useEffect(() => {
    if (!generatingTask) return;

    const { taskId, recordId } = generatingTask;
    let cancelled = false;
    let pollCount = 0;
    const maxPolls = 36; // 36 × 5s = 3 minutes max

    const poll = async () => {
      if (cancelled) return;
      pollCount++;
      try {
        const { data, error } = await supabase.functions.invoke('music-status', {
          body: { taskId, recordId },
        });

        if (cancelled) return;

        if (error) {
          console.warn('[MusicStudio] music-status poll error:', error);
          if (pollCount >= maxPolls) {
            setGeneratingTask(null);
            setSubmitting(false);
            setLastError(language === 'ar' ? 'انتهت مهلة الانتظار. حاول التحقق من المحفوظات.' : 'Generation timed out. Check your Saved tab.');
            toast.error(language === 'ar' ? 'انتهت مهلة الانتظار' : 'Generation timed out');
          }
          return;
        }

        if (data?.status === 'completed' && data?.tracks?.length) {
          setGeneratingTask(null);
          setSubmitting(false);
          setGeneratedTracks(data.tracks);
          setSavedTrackIds([]);
          setTitleOpen(false);
          setMusicStyleOpen(false);
          setVocalsOpen(false);
          setLyricsOpen(false);
          setSongsUsed((v) => v + 1);
          setSongsRemaining((v) => Math.max(0, v - 1));
          setLastError(null);
          toast.success(language === 'ar' ? 'تم إنشاء الموسيقى بنجاح!' : 'Music generated successfully!');
          return;
        }

        if (data?.status === 'failed') {
          setGeneratingTask(null);
          setSubmitting(false);
          const failMsg = data?.error || (language === 'ar' ? 'فشل الإنشاء' : 'Generation failed');
          setLastError(failMsg);
          toast.error(failMsg);
          return;
        }

        // Still generating — keep polling
        if (pollCount >= maxPolls) {
          setGeneratingTask(null);
          setSubmitting(false);
          setLastError(language === 'ar' ? 'انتهت مهلة الانتظار. حاول التحقق من المحفوظات.' : 'Generation timed out. Check your Saved tab.');
          toast.error(language === 'ar' ? 'انتهت مهلة الانتظار' : 'Generation timed out');
        }
      } catch (e) {
        console.warn('[MusicStudio] music-status poll exception:', e);
      }
    };

    // First poll after 5 seconds
    const interval = setInterval(poll, 5000);
    // Also do an immediate first poll after 3s (KIE sometimes finishes fast)
    const initialTimeout = setTimeout(poll, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(initialTimeout);
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

  return (
    <div className="space-y-4">
      {/* ── Title (First) ── */}
      <div className="rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-[0_10px_30px_rgba(6,5,65,0.08)] dark:shadow-none p-5 sm:p-4 space-y-4 sm:space-y-3">
        <button
          type="button"
          onClick={() => toggleMainSection('title')}
          className="flex items-center justify-between w-full py-1"
        >
          <div className="flex items-center gap-3 sm:gap-2">
            <span className="inline-flex h-7 w-7 sm:h-5 sm:min-w-5 items-center justify-center rounded-full border border-[#d9dde7] dark:border-white/10 bg-[#f7f8fc] dark:bg-white/[0.04] text-sm sm:text-[10px] font-bold text-[#606062] dark:text-muted-foreground">1</span>
            <span className="text-sm sm:text-xs font-semibold text-[#4b4d63] dark:text-muted-foreground uppercase tracking-wider">{isAr ? 'العنوان' : 'Title'}</span>
            <span className="rounded-full border border-rose-300/60 dark:border-rose-400/30 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1 sm:px-2 sm:py-0.5 text-xs sm:text-[9px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-300">{isAr ? 'مطلوب' : 'Must'}</span>
          </div>
          <span className="text-xl sm:text-lg text-sky-500 dark:text-sky-400/80">{titleOpen ? '−' : '+'}</span>
        </button>
        {!titleOpen && title.trim() && (
          <p className="text-sm text-sky-600 dark:text-sky-300 font-medium truncate mt-1">{title}</p>
        )}
        {titleOpen && (
          <div className="space-y-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              placeholder={isAr ? 'اسم الأغنية...' : 'Track title...'}
              className="bg-[#fcfefd] dark:bg-white/[0.04] border-[#d9dde7] dark:border-white/10 shadow-[0_4px_12px_rgba(6,5,65,0.04)] dark:shadow-none focus:border-sky-400/50 focus:ring-sky-400/20 rounded-xl h-11"
              maxLength={80}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/70 dark:text-muted-foreground/50">{title.length}/80</span>
              {title.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTitleOpen(false);
                    setMusicStyleOpen(true);
                    setStylesOpen(true);
                    setRhythmOpen(false);
                    setMoodOpen(false);
                    setInstrumentsOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white active:scale-95 transition-all shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
                >
                  {isAr ? 'التالي' : 'Next'} →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Music Style ── */}
      <div className="rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.03] shadow-[0_10px_30px_rgba(6,5,65,0.08)] dark:shadow-none p-5 sm:p-4 space-y-4 sm:space-y-3">
        {/* Header with collapse toggle */}
        <button 
          type="button"
          onClick={() => toggleMainSection('style')}
          className="flex items-center justify-between w-full py-1"
        >
          <div className="flex items-center gap-3 sm:gap-2">
            <span className="inline-flex h-7 w-7 sm:h-5 sm:min-w-5 items-center justify-center rounded-full border border-sky-400/20 bg-sky-500/10 text-sm sm:text-[10px] font-bold text-sky-300">2</span>
            <Music className="h-6 w-6 sm:h-4 sm:w-4 text-sky-400" />
            <span className="text-sm sm:text-xs font-semibold text-sky-300 uppercase">{isAr ? 'أسلوب الموسيقى' : 'Music Style'}</span>
            <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 sm:px-2 sm:py-0.5 text-xs sm:text-[9px] font-bold uppercase tracking-wider text-sky-300">{isAr ? 'اختياري' : 'Optional'}</span>
          </div>
          <span className="text-xl sm:text-lg text-sky-400/80">{musicStyleOpen ? '−' : '+'}</span>
        </button>

        {musicStyleOpen && (
          <>
            {/* Selected tags - compact row */}
            {(includeTags.length > 0 || instrumentTags.length > 0 || moodTags.length > 0) && (
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
            <div>
              <button 
                type="button"
                onClick={() => toggleMusicSubsection('styles')}
                className="flex items-center justify-between w-full text-[10px] font-medium text-muted-foreground/80 dark:text-muted-foreground/60 uppercase mb-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-xs font-medium text-muted-foreground/80 dark:text-muted-foreground/60 uppercase">{isAr ? 'الأنماط' : 'Styles'}</span>
                  {!stylesOpen && includeTags.length > 0 && (
                    <span className="text-xs font-medium text-sky-600 dark:text-sky-300 normal-case">{includeTags[0]}</span>
                  )}
                </div>
                <span className="text-xl sm:text-lg text-sky-500 dark:text-sky-400/80">{stylesOpen ? '−' : '+'}</span>
              </button>
              {stylesOpen && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] sm:text-xs text-muted-foreground/70 dark:text-muted-foreground/60">
                      {isAr
                        ? includeTags.length > 0 ? `تم اختيار: ${includeTags[0]}` : 'اختر نمطًا واحدًا'
                        : includeTags.length > 0 ? `Selected: ${includeTags[0]}` : 'Pick one style'}
                    </span>
                    {includeTags.length > 0 && (
                      <button
                        type="button"
                        onClick={handleStylesNext}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-sky-300 dark:border-sky-400/30 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-500/20 active:scale-95 transition-all"
                      >
                        {isAr ? 'التالي' : 'Next'}
                      </button>
                    )}
                  </div>
                  {STYLE_GROUPS.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-[#060541]/70 dark:text-sky-200/80 px-0.5">
                        {group.title}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {group.items.map((style) => (
                          <button
                            key={style}
                            type="button"
                            onClick={() => handleStyleToggle(style)}
                            className={`w-full min-h-[52px] px-2 py-2.5 rounded-2xl text-[11px] sm:text-xs font-semibold leading-tight text-center border transition-all active:scale-95 whitespace-normal break-words flex items-center justify-center ${
                              includeTags.includes(style)
                                ? 'bg-sky-50 dark:bg-sky-500/25 border-sky-300 dark:border-sky-400/50 text-sky-700 dark:text-sky-200 shadow-[0_4px_12px_rgba(59,130,246,0.15)] dark:shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                                : 'bg-white dark:bg-white/[0.09] border-[#d9dde7] dark:border-white/20 text-[#374151] dark:text-white/90 hover:border-sky-300 dark:hover:border-sky-400/50 hover:text-sky-700 dark:hover:text-sky-200 hover:bg-sky-50/50 dark:hover:bg-sky-500/15'
                            }`}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                            className={`flex-1 min-h-[44px] px-3 py-2 rounded-2xl text-xs sm:text-sm leading-tight text-center border transition-all active:scale-95 ${
                              rhythmTags.includes(rhythm)
                                ? 'bg-orange-50 dark:bg-orange-500/25 border-orange-300 dark:border-orange-400/40 text-orange-700 dark:text-orange-200'
                                : 'bg-orange-50/60 dark:bg-orange-500/10 border-orange-200 dark:border-orange-400/25 text-orange-600 dark:text-orange-300 ring-1 ring-orange-300/40'
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
                                  ? 'bg-orange-50/40 dark:bg-orange-500/15 border-orange-200 dark:border-orange-400/30 text-orange-600 dark:text-orange-300'
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
                            className={`flex-1 min-h-[44px] px-3 py-2 rounded-2xl text-xs sm:text-sm leading-tight text-center border transition-all active:scale-95 ${
                              moodTags.includes(mood)
                                ? 'bg-amber-50 dark:bg-amber-500/25 border-amber-300 dark:border-amber-400/40 text-amber-700 dark:text-amber-200'
                                : 'bg-amber-50/60 dark:bg-amber-500/10 border-amber-200 dark:border-amber-400/25 text-amber-600 dark:text-amber-300 ring-1 ring-amber-300/40'
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
                        ? `${instrumentTags.length}/13 آلات مختارة`
                        : `${instrumentTags.length}/13 instruments selected`}
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
                                    ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-400/35 text-emerald-700 dark:text-emerald-200 shadow-[0_4px_12px_rgba(16,185,129,0.10)] dark:shadow-none'
                                    : 'bg-white dark:bg-white/[0.09] border-[#d9dde7] dark:border-white/20 text-[#374151] dark:text-white/90 hover:border-purple-300 dark:hover:border-purple-400/40 hover:text-purple-600 dark:hover:text-purple-200 dark:hover:bg-purple-500/15'
                              }`}
                            >
                              {inst}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Extra details input - compact */}
            <div className="pt-1">
              <input
                type="text"
                value={styleText}
                onChange={(e) => setStyleText(e.target.value.slice(0, 150))}
                placeholder={isAr ? 'تفاصيل إضافية... (اختياري)' : 'Extra details... (optional)'}
                className="w-full px-3 py-2 rounded-lg bg-[#fcfefd] dark:bg-white/[0.03] border border-[#d9dde7] dark:border-white/10 shadow-[0_4px_12px_rgba(6,5,65,0.04)] dark:shadow-none text-xs placeholder:text-muted-foreground/50 focus:border-sky-400/50 focus:outline-none"
              />
            </div>
          </>
        )}
      </div>

      {/* ── Vocals ── */}
      <div className="rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-[0_10px_30px_rgba(6,5,65,0.08)] dark:shadow-none p-5 sm:p-4 space-y-4 sm:space-y-3">
        <button 
          type="button"
          onClick={() => toggleMainSection('vocals')}
          className="flex items-center justify-between w-full py-1"
        >
          <div className="flex items-center gap-3 sm:gap-2">
            <span className="inline-flex h-7 w-7 sm:h-5 sm:min-w-5 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 text-sm sm:text-[10px] font-bold text-emerald-300">3</span>
            <Mic className="h-6 w-6 sm:h-4 sm:w-4 text-emerald-400" />
            <span className="text-sm sm:text-xs font-semibold text-emerald-300 uppercase tracking-wider">{isAr ? 'الصوت' : 'Vocals'}</span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 sm:px-2 sm:py-0.5 text-xs sm:text-[9px] font-bold uppercase tracking-wider text-emerald-300">{isAr ? 'اختياري' : 'Optional'}</span>
          </div>
          <span className="text-xl sm:text-lg text-emerald-400/80">{vocalsOpen ? '−' : '+'}</span>
        </button>
        
        {vocalsOpen && (
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
        )}
      </div>

      {/* ── Compose Form ── */}
      <div className="rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-[0_10px_30px_rgba(6,5,65,0.08)] dark:shadow-none p-5 sm:p-4 space-y-4">
        <button
          type="button"
          onClick={() => toggleMainSection('lyrics')}
          className="flex items-center justify-between w-full py-1"
        >
          <div className="flex items-center gap-3 sm:gap-2">
            <span className="inline-flex h-7 w-7 sm:h-5 sm:min-w-5 items-center justify-center rounded-full border border-purple-400/20 bg-purple-500/10 text-sm sm:text-[10px] font-bold text-purple-300">4</span>
            <span className="text-sm sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">{isAr ? 'الكلمات' : 'Lyrics'}</span>
            <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 sm:px-2 sm:py-0.5 text-xs sm:text-[9px] font-bold uppercase tracking-wider text-rose-300">{isAr ? 'مطلوب' : 'Must'}</span>
          </div>
          <span className="text-xl sm:text-lg text-purple-400/80">{lyricsOpen ? '−' : '+'}</span>
        </button>

        {lyricsOpen && (
          <div className="space-y-3">
            <div className="flex items-center justify-end">
              <button
                type="button"
                disabled={amping || submitting}
                onClick={handleAmp}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border border-purple-200 dark:border-purple-400/30 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300 shadow-[0_4px_12px_rgba(168,85,247,0.10)] dark:shadow-none hover:bg-purple-100 dark:hover:bg-purple-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {amping
                  ? <><Loader2 className="h-3 w-3 animate-spin" />{isAr ? 'تحسين...' : 'Amping...'}</>
                  : <><Sparkles className="h-3 w-3" />{isAr ? 'تحسين Amp' : 'Amp'}</>
                }
              </button>
            </div>
            <Textarea
              value={lyricsText}
              onChange={(e) => {
                const raw = e.target.value || '';
                const capped = Array.from(raw).slice(0, lyricsCap).join('');
                setLyricsText(capped);
              }}
              placeholder={isAr ? 'اكتب فكرة أو كلمات أولاً، ثم اضغط Amp...' : 'Write an idea or some lyrics first, then click Amp →'}
              rows={5}
              className="bg-[#fcfefd] dark:bg-white/[0.04] border-[#d9dde7] dark:border-white/10 shadow-[0_4px_12px_rgba(6,5,65,0.04)] dark:shadow-none focus:border-purple-400/50 focus:ring-purple-400/20 rounded-xl resize-none"
            />
            <div className="flex justify-end text-[10px] text-muted-foreground/70 dark:text-muted-foreground/50">
              <span>{Array.from(lyricsText).length}/{lyricsCap}</span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <select
                value={duration}
                onChange={(e) => setDuration(Math.min(120, Math.max(10, parseInt(e.target.value || '30'))))}
                title={isAr ? 'المدة' : 'Duration'}
                className="flex-shrink-0 px-3 py-2 rounded-xl border border-[#d9dde7] dark:border-white/10 bg-[#fcfefd] dark:bg-white/[0.04] shadow-[0_4px_12px_rgba(6,5,65,0.04)] dark:shadow-none text-foreground text-sm focus:border-sky-400/50 focus:outline-none"
              >
                <option value={10}>0:10</option>
                <option value={30}>0:30</option>
                <option value={60}>1:00</option>
                <option value={90}>1:30</option>
                <option value={120}>2:00</option>
              </select>
              <button
                type="button"
                disabled={overLimit || submitting || !title.trim() || !lyricsText.trim()}
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
        )}

        {lastError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-400/20 text-red-300 text-xs">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {lastError}
          </div>
        )}
      </div>

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
  meta: Record<string, unknown> | null;
  play_url?: string | null;
};

type Playlist = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
};

// ─── Playlist storage helpers (Supabase-backed) ───────────────────────────────
const PL_KEY = 'wakti_music_playlists'; // kept only for one-time migration of old local data
function getLocalPlaylists(): Playlist[] {
  try { return JSON.parse(localStorage.getItem(PL_KEY) || '[]'); } catch { return []; }
}
function clearLocalPlaylists() {
  try { localStorage.removeItem(PL_KEY); } catch { /* ignore */ }
}
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
  const [loop, setLoop] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [order, setOrder] = useState<number[]>(() => plTracks.map((_, i) => i));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const orderRef = useRef<number[]>(order);
  const currentIdxRef = useRef(currentIdx);
  const loopRef = useRef(loop);
  const desiredPlayingRef = useRef(false);
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
    loopRef.current = loop;
  }, [loop]);

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

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    setCurrentTime(0);
    setProgress(0);
    setDuration(0);

    const audio = new Audio(url);
    audio.preload = 'auto';
    audioRef.current = audio;

    const startPlayback = () => {
      if (!desiredPlayingRef.current) return;
      window.dispatchEvent(new CustomEvent('wakti-audio-play', { detail: { playerId: 'playlist-player' } }));
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
      } else if (loopRef.current) {
        desiredPlayingRef.current = true;
        setCurrentIdx(0);
      } else {
        desiredPlayingRef.current = false;
        setIsPlaying(false);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    if (desiredPlayingRef.current) {
      startPlayback();
    }

    audio.load();

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.src = '';
    };
  }, [current?.id]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ playerId: string }>).detail;
      if (detail.playerId !== 'playlist-player' && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    };
    window.addEventListener('wakti-audio-play', handler);
    return () => window.removeEventListener('wakti-audio-play', handler);
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      desiredPlayingRef.current = false;
      audio.pause();
    } else {
      desiredPlayingRef.current = true;
      window.dispatchEvent(new CustomEvent('wakti-audio-play', { detail: { playerId: 'playlist-player' } }));
      audio.play().catch(() => {});
    }
  };

  const goNext = () => {
    const next = currentIdx + 1;
    desiredPlayingRef.current = isPlaying || desiredPlayingRef.current;
    if (next < order.length) setCurrentIdx(next);
    else if (loop) setCurrentIdx(0);
  };

  const goPrev = () => {
    desiredPlayingRef.current = isPlaying || desiredPlayingRef.current;
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
          <span className="text-sm font-bold text-foreground truncate max-w-[160px]">{playlist.name}</span>
          <span className="text-[10px] text-muted-foreground/60">{currentIdx + 1} / {order.length}</span>
        </div>
        <button title={isAr ? 'إغلاق مشغل القائمة' : 'Close playlist player'} onClick={onClose} className="p-1 rounded-lg text-muted-foreground/40 hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
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
      <div className="flex items-center justify-center gap-3">
        <button title={isAr ? 'المقطع السابق' : 'Previous track'} onClick={goPrev} disabled={currentIdx === 0 && !loop}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/10 active:scale-95 transition-all disabled:opacity-30">
          <SkipForward className="h-4 w-4 rotate-180" />
        </button>
        <button title={isAr ? 'تشغيل أو إيقاف القائمة' : 'Play or pause playlist'} onClick={togglePlay}
          className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-sky-500 text-white shadow-[0_4px_16px_rgba(128,0,255,0.4)] hover:shadow-[0_4px_24px_rgba(128,0,255,0.6)] active:scale-95 transition-all">
          {isPlaying
            ? <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            : <Play className="h-5 w-5" />
          }
        </button>
        <button title={isAr ? 'المقطع التالي' : 'Next track'} onClick={goNext} disabled={currentIdx >= order.length - 1 && !loop}
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
        <button title={isAr ? 'تشغيل أو إيقاف التكرار' : 'Toggle loop'} onClick={() => setLoop(v => !v)}
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold border transition-all active:scale-95 ${loop ? 'border-sky-400/50 bg-sky-500/15 text-sky-300' : 'border-white/10 text-muted-foreground hover:border-white/20'}`}>
          <Repeat className="h-3 w-3" />{isAr ? 'تكرار' : 'Loop'}
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

// ─── EditorTab ─────────────────────────────────────────────────────────────────
function EditorTab() {
  const { language } = useTheme();
  const { user } = useAuth();
  const isAr = language === 'ar';

  // ── Saved sub-tab: tracks vs playlists vs posters
  const [savedSubTab, setSavedSubTab] = useState<'tracks' | 'playlists' | 'posters'>('tracks');

  // ── Tracks
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<SavedTrack[]>([]);
  const [deleteTrackTarget, setDeleteTrackTarget] = useState<{ id: string; storagePath: string | null } | null>(null);

  // ── Poster & Captions
  type MusicPoster = {
    id: string;
    track_id: string;
    author: string;
    status: 'generating' | 'completed' | 'failed';
    video_url: string | null;
    created_at: string;
    kie_poster_task_id: string | null;
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
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [pickerPlaylistId, setPickerPlaylistId] = useState<string | null>(null);
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
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
        .select('id, created_at, task_id, title, prompt, include_styles, requested_duration_seconds, duration, cover_url, signed_url, storage_path, mime, meta')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60);
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
          let playUrl: string | null = t.signed_url;
          if (!playUrl && t.storage_path) {
            const base = SUPABASE_URL.replace(/\/$/, '');
            const path = t.storage_path.startsWith('/') ? t.storage_path.slice(1) : t.storage_path;
            playUrl = `${base}/storage/v1/object/public/music/${path}`;
          }
          return { ...t, play_url: playUrl };
        });
      setTracks(withUrls);
    } catch (e) {
      console.error('[EditorTab] Load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); loadPlaylists(); loadPosters(); }, [user?.id]);

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
          <button type="button" onClick={() => setShowCreatePlaylist(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#d9c5f3] dark:border-purple-400/20 bg-[#f3e8ff] dark:bg-purple-500/10 text-[#7c3aed] dark:text-purple-300 shadow-[0_4px_12px_rgba(124,58,237,0.10)] dark:shadow-none hover:bg-[#eadcff] dark:hover:bg-purple-500/20 active:scale-95 transition-all">
            <Plus className="h-3 w-3" />
            {isAr ? 'قائمة جديدة' : 'New Playlist'}
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
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-500 to-sky-500 text-white active:scale-95 transition-all disabled:opacity-40">
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
      {activePlaylist && (
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
              {tracks.map((t) => {
                const durationSec = t.duration ?? t.requested_duration_seconds ?? null;
                const durationLabel = durationSec
                  ? `${Math.floor(durationSec / 60)}:${String(Math.round(durationSec % 60)).padStart(2, '0')}`
                  : null;
                const trackTitle = t.title || (t.prompt ? t.prompt.slice(0, 40) : (isAr ? 'مقطع موسيقي' : 'Music Track'));
                const styleTags: string[] = t.include_styles ?? [];
                const metaTags = (t.meta as any)?.tags as string | null;

                return (
                  <div key={t.id}
                    className="relative overflow-hidden rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-gradient-to-br from-[#ffffff] via-[#f8f9fc] to-[#f3f5fb] dark:from-white/[0.04] dark:to-white/[0.02] shadow-[0_12px_32px_rgba(6,5,65,0.10)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
                  >
                    <div className="p-4 flex gap-4 items-start">
                      <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-sky-100 to-purple-100 dark:from-sky-900/40 dark:to-purple-900/40 border border-[#d9dde7] dark:border-white/10 shadow-md">
                        {t.cover_url
                          ? <img src={t.cover_url} alt={trackTitle} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Music className="h-6 w-6 text-sky-400/50" /></div>
                        }
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-sm text-foreground truncate leading-tight">{trackTitle}</p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
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
                        {(styleTags.length > 0 || metaTags) && (
                          <div className="flex flex-wrap gap-1">
                            {(metaTags ? [metaTags] : styleTags).slice(0, 3).map((tag, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[#f7f8fc] dark:bg-white/[0.06] text-muted-foreground/80 dark:text-muted-foreground/70 border border-[#e4e7ef] dark:border-white/[0.06]">
                                {typeof tag === 'string' ? tag.slice(0, 20) : tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {t.play_url && (
                          <div className="px-4 pb-4 space-y-3">
                            <AudioPlayer src={t.play_url} className="w-full" />
                            <div className="flex items-center gap-2 justify-end">
                              {(() => {
                                const completedPoster = posters.find(p => p.track_id === t.id && p.status === 'completed');
                                const isGenerating = generatingPosterTrackIds.includes(t.id) || posters.some(p => p.track_id === t.id && p.status === 'generating');
                                const kieTrackId = (t.meta as any)?.kie_track_id as string | undefined;
                                const isValidAudioId = !!kieTrackId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(kieTrackId);
                                const canCreatePoster = !!t.task_id && isValidAudioId;
                                
                                // Always show completed poster button if exists
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
                                onPointerUp={() => handleDownload(t.play_url || '', `wakti-music-${t.id}.mp3`)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.04] shadow-[0_4px_12px_rgba(6,5,65,0.05)] dark:shadow-none text-muted-foreground hover:text-foreground hover:border-[#c7cddd] dark:hover:border-white/20 active:scale-95 transition-all">
                                <RefreshCw className="h-3 w-3" />{isAr ? 'تنزيل' : 'Download'}
                              </button>
                              <ShareButton size="sm"
                                shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/music/share/${t.id}` : ''}
                                shareTitle={isAr ? 'استمع إلى موسيقى من وقتي 🎵' : 'Listen to my Wakti music 🎵'}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
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
          {playlists.length === 0 ? (
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
            playlists.map(pl => {
              const isOpen = editingPlaylist?.id === pl.id;
              const pickerOpen = pickerPlaylistId === pl.id;
              const plTracks = pl.trackIds.map(id => tracks.find(t => t.id === id)).filter(Boolean) as SavedTrack[];
              return (
                <div key={pl.id} className="rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-gradient-to-br from-[#ffffff] via-[#f8f9fc] to-[#f3f5fb] dark:from-white/[0.04] dark:to-white/[0.03] shadow-[0_12px_32px_rgba(6,5,65,0.10)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] overflow-hidden">
                  {/* Playlist header */}
                  <div className="flex items-center gap-3 p-3 border-b border-[#eef1f6] dark:border-transparent">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#efe7ff] to-[#dff0ff] dark:from-purple-900/50 dark:to-sky-900/50 border border-[#d9c5f3] dark:border-purple-400/20 flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(124,58,237,0.10)] dark:shadow-none">
                      <ListMusic className="h-4 w-4 text-purple-400" />
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
                        className={`p-2 rounded-xl transition-all active:scale-95 ${pickerOpen ? 'bg-[#dff0ff] dark:bg-sky-500/20 text-[#0284c7] dark:text-sky-300 border border-[#bfdbfe] dark:border-transparent shadow-[0_4px_12px_rgba(2,132,199,0.10)] dark:shadow-none' : 'text-[#6b7280] dark:text-muted-foreground hover:text-[#060541] dark:hover:text-foreground bg-[#ffffff] dark:bg-transparent border border-[#e5e7eb] dark:border-transparent hover:bg-[#f8f9fc] dark:hover:bg-white/[0.06]'}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditingPlaylist(isOpen ? null : pl)}
                        title={isAr ? 'إظهار تفاصيل القائمة' : 'Show playlist details'}
                        className="p-2 rounded-xl text-[#6b7280] dark:text-muted-foreground hover:text-[#060541] dark:hover:text-foreground bg-[#ffffff] dark:bg-transparent border border-[#e5e7eb] dark:border-transparent hover:bg-[#f8f9fc] dark:hover:bg-white/[0.06] transition-all active:scale-95">
                        {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => setDeletePlaylistTarget(pl)}
                        title={isAr ? 'حذف القائمة' : 'Delete playlist'}
                        className="p-2 rounded-xl text-muted-foreground/40 bg-[#ffffff] dark:bg-transparent border border-[#e5e7eb] dark:border-transparent hover:text-red-400 hover:bg-red-500/10 transition-colors active:scale-95">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expand: playlist details + controls */}
                  {isOpen && (
                    <div className="border-t border-[#eef1f6] dark:border-white/10 p-3 space-y-2 bg-[#fcfefd] dark:bg-transparent">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setActivePlaylist(activePlaylist?.id === pl.id ? null : pl)}
                          disabled={pl.trackIds.length === 0}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 disabled:opacity-40 ${activePlaylist?.id === pl.id ? 'border-[#d9c5f3] dark:border-purple-400/30 bg-[#efe7ff] dark:bg-purple-500/15 text-[#7c3aed] dark:text-purple-300 shadow-[0_4px_12px_rgba(124,58,237,0.10)] dark:shadow-none' : 'border-[#d9dde7] dark:border-white/10 bg-[#ffffff] dark:bg-transparent text-[#6b7280] dark:text-muted-foreground hover:text-[#060541] dark:hover:text-foreground hover:border-[#c7cddd] dark:hover:border-white/20'}`}
                        >
                          <Play className="h-3 w-3" />
                          {activePlaylist?.id === pl.id ? (isAr ? 'يتم التشغيل' : 'Playing') : (isAr ? 'تشغيل' : 'Play')}
                        </button>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#d9dde7] dark:border-white/10 bg-[#ffffff] dark:bg-transparent text-[#6b7280] dark:text-muted-foreground shadow-[0_2px_8px_rgba(6,5,65,0.04)] dark:shadow-none">
                          <Shuffle className="h-3 w-3" />
                          {isAr ? 'عشوائي' : 'Shuffle'}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#d9dde7] dark:border-white/10 bg-[#ffffff] dark:bg-transparent text-[#6b7280] dark:text-muted-foreground shadow-[0_2px_8px_rgba(6,5,65,0.04)] dark:shadow-none">
                          <Repeat className="h-3 w-3" />
                          {isAr ? 'بالترتيب / تكرار' : 'Ordered / Loop'}
                        </span>
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
                                <button
                                  onClick={() => toggleTrackInPlaylist(pl, t.id)}
                                  title={isAr ? 'إزالة من القائمة' : 'Remove from playlist'}
                                  className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Separate library picker only when explicitly requested */}
                  {pickerOpen && (
                    <div className="border-t border-[#eef1f6] dark:border-white/10 p-3 space-y-2 bg-[#f8fafc] dark:bg-white/[0.02]">
                      <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">
                        {isAr ? 'أضف من مقاطعك المحفوظة' : 'Add from your saved tracks'}
                      </p>
                      {tracks.length === 0 ? (
                        <p className="text-xs text-muted-foreground/40">{isAr ? 'لا توجد مقاطع محفوظة.' : 'No saved tracks.'}</p>
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
    </div>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
