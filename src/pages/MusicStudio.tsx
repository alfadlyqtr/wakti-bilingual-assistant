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
  const STYLE_PRESETS = useMemo<string[]>(() => {
    if (language === 'ar') {
      return [
        'آر آند بي','بوب','بوب الثمانينات','بوب التسعينات','روك','روك آند رول','سوفت روك','ميتال ثقيل','كانتري','جاز','سول','هيب هوب','راب',
        // GCC/Khaleeji focus
        'خليجي بوب','خليجي تراث','شيلات','سامري','ليوان','بحريني','كويتي','سعودي','إماراتي','قطري','عماني',
        'مهرجانات','لاتين','ريغيتون','أفروبيتس','سينث بوب','إندي بوب','لوفاي','هاوس','ديب هاوس','ترانس','تيكنو','دبسْتِب','درَم آند بَيس','كي-بوب','بوليوود'
      ];
    }
    return [
      'R&B','pop','80s pop','90s pop','rock','rock and roll','soft rock','heavy metal','country','jazz','soul','hip hop','rap',
      // GCC/Khaleeji focus
      'Khaleeji Pop','Khaleeji Traditional','Sheilat','Samri','Liwa','Bahraini','Kuwaiti','Saudi','Emirati','Qatari','Omani',
      'Shaabi','Latin','Reggaeton','Afrobeats','Synthpop','Indie Pop','Lo-Fi','House','Deep House','Trance','Techno','Dubstep','Drum & Bass','K-Pop','Bollywood'
    ];
  }, [language]);

  // Mode/Mood presets (unique values only)
  const MODE_PRESETS = useMemo<string[]>(() => {
    if (language === 'ar') {
      return [
        'سعيد', 'حزين', 'هادئ', 'مفعم بالطاقة', 'رومانسي', 'مظلم', 'ساطع', 'نوستالجي', 'تأملي', 'استرخاء', 'تركيز', 'ملحمي', 'مثير', 'غامض', 'مبهج'
      ];
    }
    return [
      'happy', 'sad', 'calm', 'energetic', 'romantic', 'dark', 'bright', 'nostalgic', 'meditative', 'relaxing', 'focus', 'epic', 'exciting', 'mysterious', 'uplifting'
    ];
  }, [language]);

  const INSTRUMENT_PRESETS = useMemo<string[]>(() => {
    if (language === 'ar') {
      return [
        'عود','قانون','ناي','رق','دربوكة','طبلة','طار','مزمار','رباب',
        'كمان','فيولا','تشيلو','كونترباص','فرقة أوتار',
        'بيانو','بيانو كهربائي','أورغ','أكورديون',
        'جيتار أكوستيك','جيتار كهربائي','جيتار 12 وتر','جيتار كلاسيكي','جيتار نايلون',
        'باص جيتار','باص وترى','سينث باص',
        'طقم درامز','إيقاع','تومز','سنير','هاي-هات','صنجات','تصفيق يدوي',
        'فلوت','كلارينيت','أوبوا','باسون','ساكسفون','ترومبيت','ترومبون','هورن فرنسي',
        'هارب','سيليستا','فيبرفون','ماريمبا','زيلوفون',
        'سينث ليد','سينث باد','باد دافئ','باد تناظري','باد أوتار','بلاك','أربجياتور'
      ];
    }
    return [
      'oud','qanun','ney','riq','darbuka','tabla','frame drum','mizmar','rebab',
      'violin','viola','cello','contrabass','string ensemble',
      'piano','electric piano','organ','accordion',
      'acoustic guitar','electric guitar','12‑string guitar','classical guitar','nylon guitar',
      'bass guitar','upright bass','synth bass',
      'drum kit','percussion','toms','snare','hi-hat','cymbals','hand claps',
      'flute','clarinet','oboe','bassoon','saxophone','trumpet','trombone','french horn',
      'harp','celesta','vibraphone','marimba','xylophone',
      'synth lead','synth pad','warm pad','analog pad','string pad','pluck','arpeggiator'
    ];
  }, [language]);

      // Collapse states for Music Style section
  const [titleOpen, setTitleOpen] = useState(false);
  const [musicStyleOpen, setMusicStyleOpen] = useState(false);
  const [stylesOpen, setStylesOpen] = useState(false);
  const [instrumentsOpen, setInstrumentsOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [instrumentTags, setInstrumentTags] = useState<string[]>([]);
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
  const [selectedModel, setSelectedModel] = useState<string>('V5_5');
  const [customMode, setCustomMode] = useState<boolean>(true);
  const [negativeTags, setNegativeTags] = useState<string>('');
  const [styleWeight, setStyleWeight] = useState<number>(0.65);
  const [weirdnessConstraint, setWeirdnessConstraint] = useState<number>(0.5);
  const [audioWeight, setAudioWeight] = useState<number>(0.65);
  const [showAdvancedSliders, setShowAdvancedSliders] = useState<boolean>(false);

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

  function toggleMusicSubsection(section: 'styles' | 'instruments' | 'mood') {
    if (section === 'styles') {
      setStylesOpen((prev) => {
        const next = !prev;
        setInstrumentsOpen(false);
        setMoodOpen(false);
        return next;
      });
      return;
    }

    if (section === 'instruments') {
      setInstrumentsOpen((prev) => {
        const next = !prev;
        setStylesOpen(false);
        setMoodOpen(false);
        return next;
      });
      return;
    }

    setMoodOpen((prev) => {
      const next = !prev;
      setStylesOpen(false);
      setInstrumentsOpen(false);
      return next;
    });
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

      const { error } = await (supabase as any)
        .from('user_music_tracks')
        .update({ meta: { status: 'completed', saved: true } })
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
    const parts = [...includeTags, ...instrumentTags, ...moodTags]
      .map((part) => part.trim())
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
    if (!lyricsText.trim()) {
      toast.error(isAr ? 'الكلمات مطلوبة' : 'Lyrics are required');
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

      // Build KIE.ai parameters (simplified - always uses V4.5)
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
        personaModel: 'style_persona',
        audioWeight: 1,
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

  // Load monthly usage on mount is now handled by refreshMusicQuota() in the earlier useEffect
  // This duplicate useEffect was counting ALL rows (including failed ones) and causing false quota blocks
  // Removed to rely solely on the backend can_generate_music() RPC which correctly filters by status

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
      <div className="rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-[0_10px_30px_rgba(6,5,65,0.08)] dark:shadow-none p-4 space-y-3">
        <button
          type="button"
          onClick={() => toggleMainSection('title')}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[#d9dde7] dark:border-white/10 bg-[#f7f8fc] dark:bg-white/[0.04] px-1 text-[10px] font-bold text-[#606062] dark:text-muted-foreground">1</span>
            <span className="text-xs font-semibold text-[#4b4d63] dark:text-muted-foreground uppercase tracking-wider">{isAr ? 'العنوان' : 'Title'}</span>
            <span className="rounded-full border border-rose-300/60 dark:border-rose-400/30 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-300">{isAr ? 'مطلوب' : 'Must'}</span>
          </div>
          <span className="text-xs text-sky-500 dark:text-sky-400/80">{titleOpen ? '−' : '+'}</span>
        </button>
        {titleOpen && (
          <div className="space-y-1.5">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              placeholder={isAr ? 'اسم الأغنية...' : 'Track title...'}
              className="bg-[#fcfefd] dark:bg-white/[0.04] border-[#d9dde7] dark:border-white/10 shadow-[0_4px_12px_rgba(6,5,65,0.04)] dark:shadow-none focus:border-sky-400/50 focus:ring-sky-400/20 rounded-xl h-11"
              maxLength={80}
            />
            <div className="text-right text-[10px] text-muted-foreground/70 dark:text-muted-foreground/50">{title.length}/80</div>
          </div>
        )}
      </div>

      {/* ── Music Style ── */}
      <div className="rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.03] shadow-[0_10px_30px_rgba(6,5,65,0.08)] dark:shadow-none p-4 space-y-3">
        {/* Header with collapse toggle */}
        <button 
          type="button"
          onClick={() => toggleMainSection('style')}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-sky-400/20 bg-sky-500/10 px-1 text-[10px] font-bold text-sky-300">2</span>
            <Palette className="h-4 w-4 text-sky-400" />
            <span className="text-xs font-semibold text-sky-300 uppercase">{isAr ? 'أسلوب الموسيقى' : 'Music Style'}</span>
            <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-300">{isAr ? 'اختياري' : 'Optional'}</span>
          </div>
          <span className="text-xs text-sky-400/80">{musicStyleOpen ? '−' : '+'}</span>
        </button>

        {musicStyleOpen && (
          <>
            {/* Selected tags - compact row */}
            {(includeTags.length > 0 || instrumentTags.length > 0 || moodTags.length > 0) && (
              <div className="flex flex-wrap gap-1.5 pb-2 border-b border-[#eceef5] dark:border-white/5">
                {includeTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-500/20 border border-sky-200 dark:border-sky-400/30 text-sky-600 dark:text-sky-300 text-xs shadow-[0_2px_8px_rgba(59,130,246,0.10)] dark:shadow-none">
                    {tag}
                    <button type="button" aria-label={isAr ? 'إزالة' : 'Remove'} onClick={() => setIncludeTags(p => p.filter(t => t !== tag))} className="hover:text-white p-0.5">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                {instrumentTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-400/30 text-purple-600 dark:text-purple-300 text-xs shadow-[0_2px_8px_rgba(147,51,234,0.10)] dark:shadow-none">
                    {tag}
                    <button type="button" aria-label={isAr ? 'إزالة' : 'Remove'} onClick={() => setInstrumentTags(p => p.filter(t => t !== tag))} className="hover:text-white p-0.5">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                {moodTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-400/30 text-amber-600 dark:text-amber-300 text-xs shadow-[0_2px_8px_rgba(245,158,11,0.10)] dark:shadow-none">
                    {tag}
                    <button type="button" aria-label={isAr ? 'إزالة' : 'Remove'} onClick={() => setMoodTags(p => p.filter(t => t !== tag))} className="hover:text-white p-0.5">
                      <X className="h-2.5 w-2.5" />
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
                <span>{isAr ? 'الأنماط' : 'Styles'}</span>
                <span className="text-sky-500 dark:text-sky-400/80">{stylesOpen ? '−' : '+'}</span>
              </button>
              {stylesOpen && (
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_PRESETS.map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setIncludeTags(p => p.includes(style) ? p.filter(t => t !== style) : [...p, style])}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-all active:scale-95 ${
                        includeTags.includes(style)
                          ? 'bg-sky-50 dark:bg-sky-500/25 border-sky-300 dark:border-sky-400/40 text-sky-700 dark:text-sky-200 shadow-[0_4px_12px_rgba(59,130,246,0.12)] dark:shadow-none'
                          : 'bg-white dark:bg-transparent border-[#d9dde7] dark:border-white/[0.08] text-muted-foreground/90 dark:text-muted-foreground/80 hover:border-sky-300 dark:hover:border-sky-400/30 hover:text-sky-600 dark:hover:text-sky-300'
                      }`}
                    >
                      {style}
                    </button>
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
                <span>{isAr ? 'الآلات' : 'Instruments'}</span>
                <span className="text-purple-500 dark:text-purple-400/80">{instrumentsOpen ? '−' : '+'}</span>
              </button>
              {instrumentsOpen && (
                <div className="flex flex-wrap gap-1.5">
                  {INSTRUMENT_PRESETS.map((inst) => (
                    <button
                      key={inst}
                      type="button"
                      onClick={() => setInstrumentTags(p => p.includes(inst) ? p.filter(t => t !== inst) : [...p, inst])}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-all active:scale-95 ${
                        instrumentTags.includes(inst)
                          ? 'bg-purple-50 dark:bg-purple-500/25 border-purple-300 dark:border-purple-400/40 text-purple-700 dark:text-purple-200 shadow-[0_4px_12px_rgba(147,51,234,0.12)] dark:shadow-none'
                          : 'bg-white dark:bg-transparent border-[#d9dde7] dark:border-white/[0.08] text-muted-foreground/90 dark:text-muted-foreground/80 hover:border-purple-300 dark:hover:border-purple-400/30 hover:text-purple-600 dark:hover:text-purple-300'
                      }`}
                    >
                      {inst}
                    </button>
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
                <span>{isAr ? 'المزاج' : 'Mood'}</span>
                <span className="text-amber-500 dark:text-amber-400/80">{moodOpen ? '−' : '+'}</span>
              </button>
              {moodOpen && (
                <div className="flex flex-wrap gap-1.5">
                  {MODE_PRESETS.map((mood) => (
                    <button
                      key={mood}
                      type="button"
                      onClick={() => setMoodTags(p => p.includes(mood) ? p.filter(t => t !== mood) : [...p, mood])}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-all active:scale-95 ${
                        moodTags.includes(mood)
                          ? 'bg-amber-50 dark:bg-amber-500/25 border-amber-300 dark:border-amber-400/40 text-amber-700 dark:text-amber-200 shadow-[0_4px_12px_rgba(245,158,11,0.12)] dark:shadow-none'
                          : 'bg-white dark:bg-transparent border-[#d9dde7] dark:border-white/[0.08] text-muted-foreground/90 dark:text-muted-foreground/80 hover:border-amber-300 dark:hover:border-amber-400/30 hover:text-amber-600 dark:hover:text-amber-300'
                      }`}
                    >
                      {mood}
                    </button>
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
      <div className="rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-[0_10px_30px_rgba(6,5,65,0.08)] dark:shadow-none p-4 space-y-3">
        <button 
          type="button"
          onClick={() => toggleMainSection('vocals')}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-1 text-[10px] font-bold text-emerald-300">3</span>
            <Mic className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">{isAr ? 'الصوت' : 'Vocals'}</span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">{isAr ? 'اختياري' : 'Optional'}</span>
          </div>
          <span className="text-xs text-emerald-400/80">{vocalsOpen ? '−' : '+'}</span>
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
                <button key={v} type="button" onClick={() => setVocalType(v)}
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
      <div className="rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-[0_10px_30px_rgba(6,5,65,0.08)] dark:shadow-none p-4 space-y-4">
        <button
          type="button"
          onClick={() => toggleMainSection('lyrics')}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-purple-400/20 bg-purple-500/10 px-1 text-[10px] font-bold text-purple-300">4</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{isAr ? 'الكلمات' : 'Lyrics'}</span>
            <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-300">{isAr ? 'مطلوب' : 'Must'}</span>
          </div>
          <span className="text-xs text-purple-400/80">{lyricsOpen ? '−' : '+'}</span>
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
              placeholder={isAr ? 'أكتب الكلمات هنا أو استخدم Amp لإنشائها...' : 'Write lyrics here or use Amp to generate...'}
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
        <div className="rounded-2xl border border-sky-400/20 bg-sky-500/5 p-6 flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-sky-400/20" />
            <div className="absolute inset-0 rounded-full border-2 border-t-sky-400 animate-spin" />
            <div className="absolute inset-3 rounded-full bg-sky-500/10 flex items-center justify-center">
              <Music className="h-5 w-5 text-sky-400" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="font-semibold text-sm text-sky-300">{isAr ? 'جارٍ إنشاء موسيقاك...' : 'Creating your music...'}</p>
            <p className="text-xs text-muted-foreground">{isAr ? 'قد يستغرق ذلك دقيقة أو دقيقتين' : 'This usually takes 1-2 minutes'}</p>
          </div>
          <div className="w-full max-w-48 h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-sky-400 to-purple-400 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
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

function EditorTab() {
  const { language } = useTheme();
  const { user } = useAuth();
  const isAr = language === 'ar';
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<Array<{
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
    meta: Record<string, unknown> | null;
    play_url?: string | null;
  }>>([]);
  const [deleteTrackTarget, setDeleteTrackTarget] = useState<{ id: string; storagePath: string | null } | null>(null);

  const load = async () => {
    if (!user) { setTracks([]); return; }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('user_music_tracks')
        .select('id, created_at, title, prompt, include_styles, requested_duration_seconds, duration, cover_url, signed_url, storage_path, mime, meta')
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

  useEffect(() => { load(); }, [user?.id]);

  const handleDeleteConfirm = async () => {
    if (!deleteTrackTarget) return;
    const { id: trackId, storagePath } = deleteTrackTarget;
    setDeleteTrackTarget(null);
    try {
      const { error: dbError } = await (supabase as any).from('user_music_tracks').delete().eq('id', trackId);
      if (dbError) throw dbError;
      if (storagePath) {
        await supabase.storage.from('music').remove([storagePath]).catch(() => {});
      }
      setTracks(prev => prev.filter(t => t.id !== trackId));
      toast.success(isAr ? 'تم الحذف بنجاح' : 'Deleted successfully');
    } catch (e: any) {
      toast.error((isAr ? 'فشل الحذف: ' : 'Delete failed: ') + (e?.message || String(e)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">{isAr ? 'مشاريعي' : 'My Tracks'}</h2>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground hover:border-white/20 active:scale-95 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? (isAr ? 'تحديث...' : 'Loading...') : (isAr ? 'تحديث' : 'Refresh')}
        </button>
      </div>

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
                  {/* Cover art */}
                  <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-sky-100 to-purple-100 dark:from-sky-900/40 dark:to-purple-900/40 border border-[#d9dde7] dark:border-white/10 shadow-md">
                    {t.cover_url ? (
                      <img src={t.cover_url} alt={trackTitle} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="h-6 w-6 text-sky-400/50" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-sm text-foreground truncate leading-tight">{trackTitle}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {durationLabel && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/20">
                            {durationLabel}
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={isAr ? 'حذف' : 'Delete'}
                          onClick={() => setDeleteTrackTarget({ id: t.id, storagePath: t.storage_path })}
                          className="p-1 rounded-lg text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Tags */}
                    {(styleTags.length > 0 || metaTags) && (
                      <div className="flex flex-wrap gap-1">
                        {(metaTags ? [metaTags] : styleTags).slice(0, 3).map((tag, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[#f7f8fc] dark:bg-white/[0.06] text-muted-foreground/80 dark:text-muted-foreground/70 border border-[#e4e7ef] dark:border-white/[0.06]">
                            {typeof tag === 'string' ? tag.slice(0, 20) : tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="text-[10px] text-muted-foreground/40">
                      {new Date(t.created_at).toLocaleDateString(isAr ? 'ar' : 'en', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* Player + actions */}
                {t.play_url && (
                  <div className="px-4 pb-4 space-y-3">
                    <AudioPlayer src={t.play_url} className="w-full" />
                    <div className="flex items-center gap-2 justify-end flex-wrap">
                      <button
                        type="button"
                        onPointerUp={() => handleDownload(t.play_url || '', `wakti-music-${t.id}.mp3`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.04] shadow-[0_4px_12px_rgba(6,5,65,0.05)] dark:shadow-none text-muted-foreground hover:text-foreground hover:border-[#c7cddd] dark:hover:border-white/20 active:scale-95 transition-all"
                      >
                        <RefreshCw className="h-3 w-3" />{isAr ? 'تنزيل' : 'Download'}
                      </button>
                      <ShareButton
                        size="sm"
                        shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/music/share/${t.id}` : ''}
                        shareTitle={isAr ? 'استمع إلى موسيقى من وقتي' : 'Listen to my Wakti music'}
                        shareDescription={t.prompt || undefined}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
    </div>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
