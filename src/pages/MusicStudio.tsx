import React, { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import AIVideomaker from '@/components/video-maker/AIVideomaker';
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
          duration_seconds: v.duration_seconds || 5,
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
                >
                  {v.thumbnailSignedUrl ? (
                    <img
                      src={v.thumbnailSignedUrl}
                      alt={v.title || 'Video'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="h-8 w-8 text-white" />
                  </div>
                  {!!v.duration_seconds && (
                    <div className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-white font-medium">
                      {formatDuration(v.duration_seconds)}
                    </div>
                  )}
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
                          className="opacity-0 group-hover/title:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
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
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
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
  const [mainTab, setMainTab] = useState<'music' | 'video'>('music');
  const [musicSubTab, setMusicSubTab] = useState<'compose' | 'editor'>('compose');
  const [videoMode, setVideoMode] = useState<'ai' | 'saved'>('ai');
  const location = useLocation();

  useEffect(() => {
    const state = (location.state || {}) as any;
    if (state?.openVideoTab) {
      setMainTab('video');
      setVideoMode('saved');
    }
  }, [location.state]);

  return (
    <div className="w-full max-w-6xl mx-auto p-3 md:p-6 pb-20 md:pb-6 space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setMainTab('music')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            mainTab === 'music'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
          }`}
        >
          <Music className="h-4 w-4" />
          {language === 'ar' ? 'الموسيقى' : 'Music'}
        </button>
        <button
          onClick={() => setMainTab('video')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            mainTab === 'video'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
          }`}
        >
          <Video className="h-4 w-4" />
          {language === 'ar' ? 'الفيديو' : 'Video'}
        </button>
      </div>

      {/* Music Tab Content */}
      {mainTab === 'music' && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl md:text-2xl font-bold">{language === 'ar' ? 'استوديو الموسيقى' : 'Music Studio'}</h1>
            <div />
          </div>

          <nav className="flex gap-2 border-b border-border pb-2">
            <Button variant={musicSubTab === 'compose' ? 'default' : 'outline'} size="sm" onClick={() => setMusicSubTab('compose')}>
              {language === 'ar' ? 'إنشاء' : 'Compose'}
            </Button>
            <Button variant={musicSubTab === 'editor' ? 'default' : 'outline'} size="sm" onClick={() => setMusicSubTab('editor')}>
              {language === 'ar' ? 'المحفوظات' : 'Saved'}
            </Button>
          </nav>

          {musicSubTab === 'compose' ? <ComposeTab onSaved={()=>setMusicSubTab('editor')} /> : <EditorTab />}
        </>
      )}

      {mainTab === 'video' && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl md:text-2xl font-bold">{language === 'ar' ? 'الفيديو' : 'Video'}</h1>
            <div />
          </div>
          <nav className="flex gap-2 border-b border-border pb-2 flex-wrap">
            <Button variant={videoMode === 'ai' ? 'default' : 'outline'} size="sm" onClick={() => setVideoMode('ai')}>
              {language === 'ar' ? 'صانع الفيديو بالذكاء' : 'AI Videomaker'}
            </Button>
            <Button variant={videoMode === 'saved' ? 'default' : 'outline'} size="sm" onClick={() => setVideoMode('saved')}>
              {language === 'ar' ? 'المحفوظات' : 'Saved'}
            </Button>
          </nav>

          {videoMode === 'ai' ? (
            <AIVideomaker onSaveSuccess={() => setVideoMode('saved')} />
          ) : (
            <SavedVideosTab onCreate={() => setVideoMode('ai')} />
          )}
        </>
      )}
    </div>
  );
 }

function ComposeTab({ onSaved }: { onSaved?: ()=>void }) {
  const { language } = useTheme();

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
        'آر آند بي','بوب','بوب الثمانينات','بوب التسعينات','روك','روك آند رول','سوفت روك','ميتال ثقيل','كانتري','جاز','سول','هيب هوب','راب','خليجي بوب','لاتين','ريغيتون','أفروبيتس','سينث بوب','إندي بوب','لوفاي','هاوس','ديب هاوس','ترانس','تيكنو','دبسْتِب','درَم آند بَيس','كي-بوب','بوليوود'
      ];
    }
    return [
      'R&B','pop','80s pop','90s pop','rock','rock and roll','soft rock','heavy metal','country','jazz','soul','hip hop','rap','khaleeji pop','latin','reggaeton','afrobeats','synthpop','indie pop','lofi','house','deep house','trance','techno','dubstep','drum & bass','k-pop','bollywood'
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

  // Include/Exclude as chip lists
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
  // Amp options modal state
  const [showAmpModal, setShowAmpModal] = useState(false);
  const [lyricsMode, setLyricsMode] = useState<'preserve'|'continue'|'generate'>('preserve');
  const [includeTempo, setIncludeTempo] = useState(true);
  const [includeKey, setIncludeKey] = useState(false);
  const [includeTimeSig, setIncludeTimeSig] = useState(false);
  const [includeStructure, setIncludeStructure] = useState(true);
  const [includeInstrumentsOpt, setIncludeInstrumentsOpt] = useState(true);
  const [includeVocalsOpt, setIncludeVocalsOpt] = useState(true);
  const [langChoice, setLangChoice] = useState<'auto'|'en'|'ar'>('auto');
  const [noGenreDrift, setNoGenreDrift] = useState(true);
  const [noNewInstruments, setNoNewInstruments] = useState(true);
  const [vocalType, setVocalType] = useState<'auto'|'none'|'female'|'male'>('auto');
  // Tuning controls
  const [creativity, setCreativity] = useState<number>(50); // 0-100
  const [rhymeMode, setRhymeMode] = useState<'off'|'rhyme'|'syllables'|'both'>('off');
  const [hookEmphasis, setHookEmphasis] = useState<boolean>(true);
  const [producerIntensity, setProducerIntensity] = useState<number>(3); // 1-5
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);
  const [audios, setAudios] = useState<Array<{ url: string; mime: string; meta?: any; createdAt: number; saved?: boolean }>>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [songsUsed, setSongsUsed] = useState(0);
  const [songsLimit, setSongsLimit] = useState(5);
  const [songsRemaining, setSongsRemaining] = useState(5);

  // Guard to ensure monthly usage loads only once (avoids StrictMode double-run logs)
  const usageLoadedRef = useRef(false);

  // Helper to refresh music quota state from backend
  const refreshMusicQuota = async () => {
    try {
      const { data, error } = await (supabase as any).rpc('can_generate_music');
      if (!error && data) {
        const used = data.generated ?? 0;
        const limit = data.limit ?? 5;
        setSongsUsed(used);
        setSongsLimit(limit);
        setSongsRemaining(Math.max(0, limit - used));
      }
    } catch {}
  };

  // Load current month's music usage and dynamic limit (base 5 + gifted extras)
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

  // Open the Amp options modal
  function handleAmp() {
    if (!styleText.trim() && !lyricsText.trim() && !title.trim()) return;
    if (hasBannedInput()) {
      toast.error(language==='ar' ? 'تحتوي المدخلات على ألفاظ غير مسموحة.' : 'Inputs contain disallowed words.');
      return;
    }
    setShowAmpModal(true);
  }

  // Amp options modal (lives inside ComposeTab)
  const ampModal = (
    showAmpModal && createPortal(
      <div className="fixed inset-0 z-[2147483647] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={()=>setShowAmpModal(false)} />
        <div className="relative w-[92vw] max-w-md rounded-lg border bg-background p-4 shadow-xl">
          <h3 className="font-semibold mb-3">{language==='ar'?'إعدادات التحسين (AMP)':'Amp options'}</h3>
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-medium mb-1">{language==='ar'?'وضع الكلمات':'Lyrics mode'}</div>
              <div className="grid grid-cols-3 gap-2">
                <label className="inline-flex items-center gap-2"><input type="radio" name="lyricsMode" checked={lyricsMode==='preserve'} onChange={()=>setLyricsMode('preserve')} />{language==='ar'?'حفظ':'Preserve'}</label>
                <label className="inline-flex items-center gap-2"><input type="radio" name="lyricsMode" checked={lyricsMode==='continue'} onChange={()=>setLyricsMode('continue')} />{language==='ar'?'متابعة':'Continue'}</label>
                <label className="inline-flex items-center gap-2"><input type="radio" name="lyricsMode" checked={lyricsMode==='generate'} onChange={()=>setLyricsMode('generate')} />{language==='ar'?'توليد كامل':'Generate full'}</label>
              </div>
            </div>
            {/* Basic: Language, Safety master, Producer intensity, Creativity */}
            <div>
              <div className="font-medium mb-1">{language==='ar'?'اللغة':'Language'}</div>
              <div className="grid grid-cols-3 gap-2">
                <label className="inline-flex items-center gap-2"><input type="radio" name="langChoice" checked={langChoice==='auto'} onChange={()=>setLangChoice('auto')} />Auto</label>
                <label className="inline-flex items-center gap-2"><input type="radio" name="langChoice" checked={langChoice==='en'} onChange={()=>setLangChoice('en')} />English</label>
                <label className="inline-flex items-center gap-2"><input type="radio" name="langChoice" checked={langChoice==='ar'} onChange={()=>setLangChoice('ar')} />العربية</label>
              </div>
            </div>

            <div>
              <div className="font-medium mb-1">{language==='ar'?'السلامة (مبسّطة)':'Safety (simple)'}</div>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={noGenreDrift && noNewInstruments} onChange={(e)=>{setNoGenreDrift(e.target.checked); setNoNewInstruments(e.target.checked);}} />{language==='ar'?'ثبّت النوع والآلات المختارة':'Lock style and instruments'}</label>
            </div>

            <div className="space-y-2">
              <div className="font-medium">{language==='ar'?'شدة الإنتاج':'Producer preset'}</div>
              <div className="flex items-center gap-3">
                <label className="min-w-28 text-muted-foreground text-xs">{language==='ar'?'القيمة':'Value'}</label>
                <input type="range" min={1} max={5} step={1} value={producerIntensity} onChange={(e)=>setProducerIntensity(parseInt(e.target.value||'3'))} />
                <span className="text-xs">{producerIntensity}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium">{language==='ar'?'إبداع الكلمات':'Lyrics creativity'}</div>
              <div className="flex items-center gap-3">
                <label className="min-w-28 text-muted-foreground text-xs">{language==='ar'?'الإبداع':'Creativity'}</label>
                <input type="range" min={0} max={100} step={5} value={creativity} onChange={(e)=>setCreativity(parseInt(e.target.value||'50'))} />
                <span className="text-xs">{creativity}</span>
              </div>
            </div>

            {/* Advanced drawer toggle */}
            <button type="button" className="text-sm underline" onClick={()=>setAdvancedOpen(v=>!v)}>
              {advancedOpen ? (language==='ar'?'إخفاء الإعدادات المتقدمة':'Hide advanced') : (language==='ar'?'إظهار الإعدادات المتقدمة':'Show advanced')}
            </button>

            {advancedOpen && (
              <div className="mt-2 space-y-3">
                <div>
                  <div className="font-medium mb-1">{language==='ar'?'تضمين في السطر':'Include in line'}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={includeTempo} onChange={(e)=>setIncludeTempo(e.target.checked)} />{language==='ar'?'السرعة/BPM':'Tempo/BPM'}</label>
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={includeKey} onChange={(e)=>setIncludeKey(e.target.checked)} />{language==='ar'?'المقام/السلم':'Key/Scale/Mode'}</label>
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={includeTimeSig} onChange={(e)=>setIncludeTimeSig(e.target.checked)} />{language==='ar'?'الميزان':'Time signature'}</label>
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={includeStructure} onChange={(e)=>setIncludeStructure(e.target.checked)} />{language==='ar'?'البنية':'Structure'}</label>
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={includeInstrumentsOpt} onChange={(e)=>setIncludeInstrumentsOpt(e.target.checked)} />{language==='ar'?'الآلات':'Instrumentation'}</label>
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={includeVocalsOpt} onChange={(e)=>setIncludeVocalsOpt(e.target.checked)} />{language==='ar'?'الغناء/الصوت':'Vocals'}</label>
                  </div>
                </div>

                <div>
                  <div className="font-medium mb-1">{language==='ar'?'السلامة (تفصيلي)':'Safety (advanced)'}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={noGenreDrift} onChange={(e)=>setNoGenreDrift(e.target.checked)} />{language==='ar'?'ممنوع انحراف النوع/الأسلوب':'No genre drift'}</label>
                    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={noNewInstruments} onChange={(e)=>setNoNewInstruments(e.target.checked)} />{language==='ar'?'لا آلات جديدة غير مذكورة':'No new instruments'}</label>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-medium">{language==='ar'?'الكورس':'Hook/chorus'}</div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={hookEmphasis} onChange={(e)=>setHookEmphasis(e.target.checked)} />
                    {language==='ar'?'تركيز على اللازمة/الكورس':'Hook emphasis'}
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="font-medium">{language==='ar'?'قافية ومقاطع':'Rhyme & Syllables'}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="inline-flex items-center gap-2"><input type="radio" name="rhymeMode" checked={rhymeMode==='off'} onChange={()=>setRhymeMode('off')} />{language==='ar'?'بدون':'Off'}</label>
                    <label className="inline-flex items-center gap-2"><input type="radio" name="rhymeMode" checked={rhymeMode==='rhyme'} onChange={()=>setRhymeMode('rhyme')} />{language==='ar'?'قافية':'Rhyme'}</label>
                    <label className="inline-flex items-center gap-2"><input type="radio" name="rhymeMode" checked={rhymeMode==='syllables'} onChange={()=>setRhymeMode('syllables')} />{language==='ar'?'مقاطع محكمة':'Tight syllables'}</label>
                    <label className="inline-flex items-center gap-2"><input type="radio" name="rhymeMode" checked={rhymeMode==='both'} onChange={()=>setRhymeMode('both')} />{language==='ar'?'قافية + مقاطع':'Rhyme + Syllables'}</label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={()=>setShowAmpModal(false)} disabled={amping}>
              {language==='ar'?'إلغاء':'Cancel'}
            </Button>
            <Button size="sm" onClick={handleAmpSubmit} disabled={amping} aria-busy={amping}>
              {amping ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin">✨</span>
                  <span>{language==='ar'?'...يجري التحسين':'Amping...'}</span>
                </span>
              ) : (
                <span>{language==='ar'?'تحسين':'Amp'}</span>
              )}
            </Button>
          </div>
        </div>
      </div>,
      document.body
    )
  );

  // Caps: style max 350, lyrics gets remaining up to overall 800 (title excluded from cap)
  const limit = 800;
  const styleCap = 350;
  const lyricsFixedCap = 450;
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

  // Duration-aware max lyric lines
  function getMaxLyricLines(sec: number) {
    if (sec <= 30) return 6;      // short hook/verse
    if (sec <= 60) return 10;     // verse + hook
    if (sec <= 90) return 14;     // verse + hook + bridge (short)
    return 18;                    // up to 2:00
  }
  const maxLyricLines = useMemo(() => getMaxLyricLines(Math.min(120, Math.max(10, duration || 30))), [duration]);
  const lyricLineCount = useMemo(() => (lyricsText ? lyricsText.split(/\r?\n/).filter(l => l.trim()).length : 0), [lyricsText]);

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
      // Allow ONE non-adjacent repeat (probable chorus), only if line budget big enough (>=6)
      const allowChorus = maxLyricLines >= 6;
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

  // Compact, read-only summary for UI display
  const includedSummary = useMemo(() => {
    const bits: string[] = [];
    if (includeTags.length) bits.push(`${language==='ar' ? 'الأنماط' : 'Styles'}: ${includeTags.join(', ')}`);
    if (instrumentTags.length) bits.push(`${language==='ar' ? 'الآلات' : 'Instruments'}: ${instrumentTags.join(', ')}`);
    if (moodTags.length) bits.push(`${language==='ar' ? 'المزاج' : 'Mode'}: ${moodTags.join(', ')}`);
    if (vocalType === 'female') bits.push(`${language==='ar' ? 'الصوت' : 'Vocals'}: ${language==='ar' ? 'أنثوي' : 'Female voice'}`);
    if (vocalType === 'male') bits.push(`${language==='ar' ? 'الصوت' : 'Vocals'}: ${language==='ar' ? 'ذكوري' : 'Male voice'}`);
    if (vocalType === 'none') bits.push(`${language==='ar' ? 'الصوت' : 'Vocals'}: ${language==='ar' ? 'بدون' : 'None'}`);
    return bits.join(' · ');
  }, [includeTags, instrumentTags, moodTags, vocalType, language]);

  // Insert chips into style text on demand (optional)
  function insertChipsIntoStyle() {
    const toInsert = buildStylesSuffix();
    if (!toInsert) return;
    const exists = (styleText || '').includes(toInsert);
    const base = exists ? styleText : (styleText ? `${styleText}\n${toInsert}` : toInsert);
    const capped = Array.from(base).slice(0, styleCap).join('');
    setStyleText(capped);
  }

  // No more mirroring chips into a single prompt; we compose at send-time

  // Ensure lyrics never exceed current cap when style changes
  useEffect(() => {
    const cap = lyricsCap;
    if (Array.from(lyricsText || '').length > cap) {
      setLyricsText(Array.from(lyricsText).slice(0, cap).join(''));
    }
  }, [styleText, lyricsCap]);

  // Ensure lyrics respect current duration line budget when duration changes
  useEffect(() => {
    if (!lyricsText) return;
    const lines = lyricsText.split(/\r?\n/);
    const limited = lines.slice(0, maxLyricLines).join('\n');
    const capped = Array.from(limited).slice(0, lyricsCap).join('');
    if (capped !== lyricsText) setLyricsText(capped);
  }, [maxLyricLines, lyricsCap]);

  // New: AMP submit with options
  async function handleAmpSubmit() {
    if (!styleText.trim() && !lyricsText.trim() && !title.trim()) return;
    setAmping(true);
    try {
      const baseSummary = stripStylesSuffix(styleText);
      const baseLyrics = stripStylesSuffix(lyricsText);
      // Build an intent-preserving directive for music with selected options
      const wantsArabic = langChoice === 'ar' || (langChoice === 'auto' && language === 'ar');
      const includeBits: string[] = [];
      if (includeTempo) includeBits.push(wantsArabic ? 'السرعة/BPM' : 'tempo/BPM');
      if (includeKey) includeBits.push(wantsArabic ? 'المقام/السلم' : 'key/scale/mode');
      if (includeTimeSig) includeBits.push(wantsArabic ? 'الميزان' : 'time signature');
      if (includeStructure) includeBits.push(wantsArabic ? 'البنية' : 'structure');
      if (includeInstrumentsOpt) includeBits.push(wantsArabic ? 'الآلات' : 'instrumentation');
      if (includeVocalsOpt) includeBits.push(wantsArabic ? 'الغناء/الصوت' : 'vocals');
      const includeLine = includeBits.length ? (wantsArabic ? `ضمّن في السطر: ${includeBits.join(', ')}` : `Include in line: ${includeBits.join(', ')}`) : '';

      const safetyBits: string[] = [];
      if (noGenreDrift) safetyBits.push(wantsArabic ? 'ممنوع الانحراف عن النوع/الأسلوب' : 'no genre/style drift');
      if (noNewInstruments) safetyBits.push(wantsArabic ? 'لا تضف آلات غير مذكورة' : 'no adding new instruments unless missing');
      const safetyLine = safetyBits.length ? (wantsArabic ? `سلامة: ${safetyBits.join(', ')}` : `Safety: ${safetyBits.join(', ')}`) : '';

      const lyricsLine = (
        lyricsMode === 'preserve'
          ? (wantsArabic ? 'الكلمات: إن وجدت فاحفظها حرفيًا.' : 'Lyrics: if provided, preserve verbatim.')
          : lyricsMode === 'continue'
            ? (wantsArabic ? 'الكلمات: إن كانت موجودة فأكملها بنفس اللغة والمزاج والوزن.' : 'Lyrics: if provided, continue in same language, mood, and meter.')
            : (wantsArabic ? 'الكلمات: أنشئ كلمات كاملة موجزة قابلة للغناء تتماشى مع الأسلوب والمزاج والآلات.' : 'Lyrics: generate concise, singable full lyrics aligned to style, mood, and instruments.')
      );

      // Vocals constraint: auto = no constraint; none = forbid; female/male = require
      const vocalsLine = (
        vocalType === 'none'
          ? (wantsArabic ? 'لا تستخدم غناء/صوت بشري.' : 'Do not use vocals/lead voice.')
          : vocalType === 'female'
            ? (wantsArabic ? 'استخدم صوتًا أنثويًا للغناء الرئيسي.' : 'Use a female lead vocal.')
            : vocalType === 'male'
              ? (wantsArabic ? 'استخدم صوتًا ذكوريًا للغناء الرئيسي.' : 'Use a male lead vocal.')
              : ''
      );

      const languageHint = langChoice === 'auto' ? '' : (wantsArabic ? 'استخدم العربية.' : 'Use English.');

      const directiveCore = wantsArabic
        ? 'مهمة: حسّن هذا التوجيه لتوليد موسيقى فقط دون انحراف عن نية المستخدم. أعد صياغته كسطر موجز بأسلوب منتج موسيقي (ملخص موسيقي طبيعي وليس قائمة متطلبات). ركّز على الأسلوب والمزاج والبنية والإيقاع والسرعة والمقامات والآلات. تجنب اقتباس نص المستخدم أو العنوان حرفيًا.'
        : 'Task: Improve this strictly for music generation without drifting from user intent. Rewrite as a concise producer-style musical brief (natural, not a requirements list). Focus on style, mood, structure, tempo, scales/modes, and instruments. Avoid quoting the user text or title verbatim.';

      const durationTarget = Math.min(120, duration);
      const durationLine = wantsArabic ? `المدة المستهدفة: ${durationTarget} ثانية` : `Target duration: ${durationTarget}s`;
      const arrangementLine = getArrangementBrief(durationTarget, wantsArabic);
      const titleLine = title ? (wantsArabic ? `العنوان: ${title}` : `Title: ${title}`) : '';
      const stylesLine = buildStylesSuffix();
      const mustUseChips = wantsArabic
        ? 'التزم بالأنماط والآلات والمزاج المحدد أعلاه. لا تضف عناصر جديدة إذا كانت السلامة مفعلة.'
        : 'Honor the selected styles, instruments, and mood above. Do not add new elements if safety is on.';
      const prodIntensityLine = wantsArabic
        ? `شدة المنتج: ${producerIntensity} من 5`
        : `Producer intensity: ${producerIntensity} of 5`;
      const hookLine = hookEmphasis
        ? (wantsArabic ? 'ركز على لازمـة/كورَس قوي وواضح وأوسع من باقي المقاطع.' : 'Emphasize a strong, clear hook/chorus that is wider than other sections.')
        : '';
      const producerNotes = wantsArabic
        ? 'سلوك المنتج: أعطِ إيقاعًا واضحًا (كِك/سنير محدد)، تحكمًا في كثافة الهاتس، سلوك الباس (808 بزحلقة أو لحنية)، لَيد ذو موتيف واضح وملء المساحات بين العبارات، انتقالات (فِلز/رايزر/دروب)، وتباين ديناميكي بين المقاطع. اجعل اللازمة أوسع وأعلى إدراكًا للصوت.'
        : 'Producer behavior: clear groove (defined kick/snare), controllable hat density, bass behavior (808 with glide or melodic), a lead with a clear motif and inter-phrase fills, transitions (fills/risers/drops), and dynamic contrast between sections. Make the chorus wider and ~+2–3 dB perceived.';
      const contentLine = wantsArabic ? `ملخص الأسلوب: ${baseSummary}` : `Style brief: ${baseSummary}`;
      const lyricsContent = baseLyrics ? (wantsArabic ? `الكلمات:\n${baseLyrics}` : `Lyrics:\n${baseLyrics}`) : '';
      const directive = [
        directiveCore,
        includeLine,
        safetyLine,
        mustUseChips,
        producerNotes,
        hookLine,
        prodIntensityLine,
        arrangementLine,
        // Intentionally omit lyricsLine from music brief to avoid lyric leakage
        vocalsLine,
        languageHint,
        durationLine
      ].filter(Boolean).join('\n');
      // Do NOT pass lyrics into the brief step to avoid echoing lyrics in style line
      const composed = [directive, titleLine, contentLine, stylesLine].filter(Boolean).join('\n');
      const { data, error } = await supabase.functions.invoke('prompt-amp', {
        body: { text: composed, mode: 'music' }
      });
      if (error) throw error;
      const improved = (data?.text || '').toString();
      if (!improved) throw new Error(language==='ar' ? 'تعذّر التحسين' : 'Amp failed');
      // Sanitize: strip lyric-like constructs (quotes, slash-separated lines, newlines to spaces)
      const sanitized = improved
        .replace(/\"[^\"\\]*(?:\\.[^\"\\]*)*\"/g, '')
        .replace(/\s*\/\s*/g, ', ')
        .replace(/\n{2,}/g, '\n')
        .replace(/\n/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      const capped = sanitized.slice(0, styleCap);
      setShowAmpModal(false);
      setStyleText(capped);
      toast.success(language==='ar' ? 'تم تحسين التوجيه' : 'Prompt enhanced');

      // New: handle lyrics actions
      // Prefer continue if user provided seed lyrics
      // If user provided seed lyrics: Preserve -> Continue, else if no lyrics: force Generate
      const effectiveLyricsMode = baseLyrics
        ? (lyricsMode === 'preserve' ? 'continue' : lyricsMode)
        : 'generate';
      if (effectiveLyricsMode === 'continue' || effectiveLyricsMode === 'generate') {
        // Build a focused lyrics directive
        const wantsArabicL = langChoice === 'ar' || (langChoice === 'auto' && language === 'ar');
        const vocHeader = '';
        const titleLineL = title ? (wantsArabicL ? `العنوان: ${title}` : `Title: ${title}`) : '';
        const stylesLineL = buildStylesSuffix();
        const chipsLyricHint = (includeTags.length || instrumentTags.length || moodTags.length)
          ? (wantsArabicL
              ? 'ادمج الأنماط والآلات والمزاج المحدد بوضوح داخل الكلمات دون مخالفتها.'
              : 'Explicitly weave the selected styles, instruments, and mood into the lyrics without contradicting them.')
          : '';
        const seedLyrics = effectiveLyricsMode === 'continue' ? (baseLyrics || '') : '';
        const taskLine = effectiveLyricsMode === 'continue'
          ? (wantsArabicL
              ? 'أكمل هذه الكلمات بنفس اللغة والمزاج والإيقاع مع احترام موضوع العنوان. احتفظ بالأسطر المقدَّمة كما هي دون تعديل، وابنِ عليها. اجعل كل سطر واضحًا وقابلًا للغناء دون تكرار. أعد فقط النص النهائي للكلمات.'
              : 'Continue these lyrics in the same language, mood, and meter, honoring the title theme. Preserve any provided lines verbatim and build upon them. Make each line clear and singable with no repetition. Return only the final lyrics text.')
          : (wantsArabicL
              ? 'أنشئ كلمات كاملة موجزة قابلة للغناء مستوحاة من العنوان/الأسلوب/الآلات/المزاج. احترم موضوع العنوان، وادمج الاختيارات أعلاه داخل المعاني دون مخالفة. اجعل كل سطر مميزًا دون تكرار. أعِد فقط النص النهائي للكلمات.'
              : 'Generate concise, singable full lyrics inspired by the title/style/instrumentation/mood. Honor the title theme and integrate the above choices into the meaning without contradicting them. Ensure each line is distinct with no repetition. Return only the final lyrics text.');
        const langHintL = langChoice === 'auto' ? '' : (wantsArabicL ? 'استخدم العربية.' : 'Use English.');
        const creativityLine = wantsArabicL
          ? `الإبداع: ${creativity}/100 — زد الجرأة المجازية تدريجيًا مع الحفاظ على الوضوح.`
          : `Creativity: ${creativity}/100 — increase metaphorical boldness while staying clear.`;
        const poetLine = wantsArabicL
          ? 'اكتب بصوت شاعر/كاتب أغاني ماهر: صور جديدة، مجازات رشيقة، لغة طبيعية قابلة للغناء.'
          : 'Write in the voice of a skilled poet‑songwriter: fresh imagery, elegant metaphors, natural singable language.';
        const rhymeLine = (
          rhymeMode === 'rhyme' ? (wantsArabicL ? 'فضّل قوافي خفيفة في نهايات الأسطر (AABB/ABAB).' : 'Prefer light end rhymes (AABB/ABAB).') :
          rhymeMode === 'syllables' ? (wantsArabicL ? 'حافظ على نافذة مقاطع 7–10 لكل سطر.' : 'Keep a 7–10 syllable window per line.') :
          rhymeMode === 'both' ? (wantsArabicL ? 'قافية خفيفة مع نافذة مقاطع 7–10 لكل سطر.' : 'Use light end rhymes and keep 7–10 syllables per line.') :
          ''
        );
        const durationSeconds = Math.min(120, duration);
        const durationLineL = wantsArabicL ? `المدة المستهدفة: ${durationSeconds} ثانية` : `Target duration: ${durationSeconds}s`;
        const noRepeatL = wantsArabicL
          ? 'لا تكرر أي سطر، ولا تعكس العنوان أو الملخص حرفيًا. تجنب الحشو والكليشيهات إلا إذا طُلب.'
          : 'Do not repeat any line, and do not echo the title or brief verbatim. Avoid filler/clichés unless requested.';
        const lineBudget = wantsArabicL
          ? `أعد بالضبط ${maxLyricLines} أسطر قصيرة قابلة للغناء.`
          : `Return exactly ${maxLyricLines} lines, using short, singable lines.`;
        const outShape = wantsArabicL
          ? 'أعِد الأسطر فقط مفصولة بأسطر جديدة، دون عناوين أقسام أو شروح.'
          : 'Output ONLY those lines separated by newlines; no headings or commentary.';
        const titleOnce = wantsArabicL
          ? 'اذكر عبارة العنوان مرة واحدة فقط كسطر اللازمة/الكورس.'
          : 'Mention the title phrase exactly once as a hook/chorus line.';
        const homeDetail = wantsArabicL
          ? 'ضمّن تفصيلاً منزليًا ملموسًا واحدًا على الأقل (مثال: ضوء الشرفة، مفاتيح في الوعاء، ألواح أرضية مهترئة).'
          : 'Include at least one concrete home detail (e.g., porch light, keys in the bowl, worn floorboards).';
        // Build FACTS block (English markers to match server prompt expectations)
        const arrangementHint = getArrangementBrief(durationSeconds, wantsArabicL);
        const factsLines: string[] = [];
        if (title) factsLines.push(`Title: ${title}`);
        if (includeTags.length) factsLines.push(`Styles: ${includeTags.join(', ')}`);
        if (instrumentTags.length) factsLines.push(`Instruments: ${instrumentTags.join(', ')}`);
        if (moodTags.length) factsLines.push(`Mood: ${moodTags.join(', ')}`);
        factsLines.push(`Duration: ${durationSeconds}s`);
        factsLines.push(`Arrangement: ${arrangementHint}`);
        const factsBlock = `FACTS:\n${factsLines.join('\n')}`;

        // Optional SEED block (English marker)
        const seedBlock = seedLyrics ? `\n\nSEED LYRICS:\n${seedLyrics}` : '';

        // Final lyric prompt: start with FACTS, then directives, then optional SEED block
        const directives = [taskLine, noRepeatL, chipsLyricHint, creativityLine, poetLine, rhymeLine, langHintL, lineBudget, outShape, titleOnce, homeDetail].filter(Boolean).join('\n');
        const lyricPrompt = [factsBlock, '', directives].join('\n') + seedBlock;

        const { data: ldata, error: lerror } = await supabase.functions.invoke('prompt-amp', {
          body: { text: lyricPrompt, mode: 'lyrics' }
        });
        if (!lerror) {
          const generated = (ldata?.text || '').toString().trim();
          if (generated) {
            // Split, trim, drop lines that start with the title words, de-duplicate, enforce line budget, then char cap
            const rawLines = generated.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
            const titleStart = title ? firstNWords(normalizeLine(title), 3) : '';
            let processed: string[] = [];
            if (rawLines.length > 0 && titleStart) {
              // Only block the first generated line from starting with the title words; allow later chorus to use it
              const first = rawLines[0];
              const rest = rawLines.slice(1);
              const firstOk = firstNWords(normalizeLine(first), 3) !== titleStart;
              processed = (firstOk ? [first] : []).concat(rest);
            } else {
              processed = rawLines;
            }
            const uniqueLines = dedupeLines(processed).slice(0, maxLyricLines);
            const limited = uniqueLines.join('\n');
            if (effectiveLyricsMode === 'continue' && baseLyrics) {
              const appended = `${baseLyrics}\n${limited}`;
              const cappedLyrics = Array.from(appended).slice(0, lyricsCap).join('');
              setLyricsText(cappedLyrics);
            } else {
              const cappedLyrics = Array.from(limited).slice(0, lyricsCap).join('');
              setLyricsText(cappedLyrics);
            }
          }
        }
      }
    } catch (e: any) {
      toast.error((language==='ar' ? 'فشل التحسين: ' : 'Amp failed: ') + (e?.message || String(e)));
    } finally {
      setAmping(false);
    }
  }

  const handleGenerate = async () => {
    if (overLimit) return;
    setSubmitting(true);
    let placeholderRecordId: string | null = null;
    let savedOk = false;
    
    try {
      // Check music generation quota via RPC
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
        return;
      }
      
      // Compose final prompt from split fields and chips (reusable)
      const wantsArabicGen = langChoice === 'ar' || (langChoice === 'auto' && language === 'ar');
      const stylesLineGen = buildStylesSuffix();
      const titleLineGen = title ? (wantsArabicGen ? `العنوان: ${title}` : `Title: ${title}`) : '';
      const durationTargetGen = Math.min(120, duration);
      const durationLineGen = wantsArabicGen ? `المدة المستهدفة: ${durationTargetGen} ثانية` : `Target duration: ${durationTargetGen}s`;
      const arrangementLineGen = getArrangementBrief(durationTargetGen, wantsArabicGen);
      const contentLineGen = styleText ? (wantsArabicGen ? `ملخص الأسلوب: ${styleText}` : `Style brief: ${styleText}`) : '';
      const lyricsContentGen = lyricsText ? (wantsArabicGen ? `الكلمات:\n${lyricsText}` : `Lyrics:\n${lyricsText}`) : '';
      // Apply vocals rule for generation: none forbids vocals, female/male encourage; auto = no constraint
      const vocalsLineGen = vocalType === 'none'
        ? (wantsArabicGen ? 'لا تستخدم غناء/صوت بشري.' : 'Do not use vocals/lead voice.')
        : vocalType === 'female'
          ? (wantsArabicGen ? 'استخدم صوتًا أنثويًا للغناء الرئيسي.' : 'Use a female lead vocal.')
          : vocalType === 'male'
            ? (wantsArabicGen ? 'استخدم صوتًا ذكوريًا للغناء الرئيسي.' : 'Use a male lead vocal.')
            : '';
      const producerNotesGen = wantsArabicGen
        ? 'ملاحظات المنتج: موتيف لَيد واضح، انتقالات بين الأقسام (فِلز/رايزر)، وتباين ديناميكي قوي. اجعل اللازمة أوسع وأعلى إدراكًا للصوت.'
        : 'Producer notes: clear lead motif, transitions between sections (fills/risers), and strong dynamic contrast. Make the chorus wider and louder in perception.';
      const prodIntensityGen = wantsArabicGen
        ? `شدة المنتج: ${producerIntensity} من 5`
        : `Producer intensity: ${producerIntensity} of 5`;
      const languageQualityGen = wantsArabicGen
        ? 'استخدم العربية الفصحى الواضحة فقط بدون كلمات غير مفهومة أو مختلقة.'
        : '';
      const hookLineGen = hookEmphasis
        ? (wantsArabicGen ? 'ركّز على لازمـة قوية وواضحة.' : 'Emphasize a strong, clear hook.')
        : '';
      const honorChipsGen = wantsArabicGen
        ? 'التزم بالأنماط والآلات والمزاج المحدد. لا تضف عناصر جديدة إذا كانت السلامة مفعلة.'
        : 'Honor the selected styles, instruments, and mood. Do not add new elements if safety is on.';
      const fullPrompt = [
        titleLineGen,
        contentLineGen,
        stylesLineGen,
        honorChipsGen,
        producerNotesGen,
        hookLineGen,
        prodIntensityGen,
        arrangementLineGen,
        durationLineGen,
        vocalsLineGen,
        languageQualityGen,
        lyricsContentGen
      ].filter(Boolean).join('\n');

      // INSERT PLACEHOLDER RECORD FIRST - ensures the generation counts toward limit
      const placeholderFileName = `${user.id}/${Date.now()}_pending.mp3`;
      const { data: placeholderData, error: placeholderError } = await (supabase as any)
        .from('user_music_tracks')
        .insert({
          user_id: user.id,
          prompt: fullPrompt,
          include_styles: includeTags.length ? includeTags : null,
          requested_duration_seconds: Math.min(120, duration),
          provider: 'elevenlabs',
          model: 'music_v1',
          storage_path: placeholderFileName,
          signed_url: null,
          mime: 'audio/mpeg',
          meta: {
            status: 'generating',
            ...(instrumentTags.length ? { instruments: instrumentTags } : {}),
            ...(moodTags.length ? { mood: moodTags } : {})
          } as any
        })
        .select('id')
        .single();
      
      if (placeholderError) throw placeholderError;
      placeholderRecordId = placeholderData?.id;
      
      // Update UI counter immediately
      setSongsUsed((v) => v + 1);
      setSongsRemaining((v) => Math.max(0, v - 1));
      
      // fullPrompt already composed above

      // Call ElevenLabs music generation via Edge Function
      const { data: genData, error: genError } = await supabase.functions.invoke('music-generate', {
        body: {
          prompt: fullPrompt,
          duration_seconds: Math.min(120, duration),
          output_format: 'mp3_44100_128',
          model_id: 'music_v1',
          force_instrumental: vocalType === 'none'
        }
      });

      if (genError) throw genError;
      if (!genData?.publicUrl) throw new Error('No audio returned from ElevenLabs');

      const storedUrl = genData.publicUrl as string;
      const storagePath = genData.storagePath as string | null;
      const mime = (genData.mime as string) || 'audio/mpeg';

      try {
        // UPDATE the placeholder record with actual data
        if (placeholderRecordId) {
          const { error: updateError } = await (supabase as any)
            .from('user_music_tracks')
            .update({
              storage_path: storagePath || null,
              signed_url: storedUrl,
              mime,
              meta: {
                status: 'completed',
                ...(instrumentTags.length ? { instruments: instrumentTags } : {}),
                ...(moodTags.length ? { mood: moodTags } : {})
              } as any
            })
            .eq('id', placeholderRecordId);

          if (updateError) throw updateError;
        }

        // Reflect saved state (counter already updated above)
        setAudios((prev) => [{ url: storedUrl, mime, meta: {}, createdAt: Date.now(), saved: true }, ...prev]);
        savedOk = true;
        onSaved?.();
      } catch (saveError) {
        console.error('Storage/DB save error:', saveError);
        // Even if save fails, the placeholder record exists and counts toward limit
        // Mark as failed in DB
        if (placeholderRecordId) {
          await (supabase as any)
            .from('user_music_tracks')
            .update({
              meta: { status: 'failed', error: String(saveError) } as any
            })
            .eq('id', placeholderRecordId);
        }
        // Still show playable result
        setAudios((prev) => [{ url: storedUrl, mime: mime || 'audio/mpeg', meta: {}, createdAt: Date.now(), saved: false }, ...prev]);
      }

      setLastError(null);

      toast.success(
        savedOk
          ? (language === 'ar' ? 'تم الحفظ. انتقل إلى المحفوظات أو مشاريعي.' : 'Saved. Go to Saved or My Projects.')
          : (language === 'ar' ? 'تم الإنشاء' : 'Generated')
      );
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error('Music generate error:', e);
      setLastError(msg);
      
      // Mark placeholder as failed if it exists
      // Keep the record so it counts toward monthly limit (user consumed an API attempt)
      if (placeholderRecordId) {
        await (supabase as any)
          .from('user_music_tracks')
          .update({
            meta: { status: 'failed', error: msg } as any
          })
          .eq('id', placeholderRecordId)
          .catch((err: any) => console.error('Failed to update placeholder:', err));
      }
      
      toast.error((language==='ar' ? 'فشل العملية: ' : 'Operation failed: ') + msg);
    } finally {
      setSubmitting(false);
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
      {ampModal}
      <Card className="p-4 md:p-5 space-y-4 overflow-visible">
        <div className="grid md:grid-cols-3 gap-3">
          {/* Styles */}
          <div className="space-y-2 relative" ref={includeAnchorRef}>
            <label className="text-xs font-medium block">{language === 'ar' ? 'الأنماط' : 'Styles'}</label>
            <div className="flex flex-wrap gap-2">
              {includeTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-sm">
                  {tag}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setIncludeTags((prev) => prev.filter((t) => t !== tag))}
                  >×</button>
                </span>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowIncludePicker((v)=>!v); setShowInstrumentPicker(false); }}>
                {language==='ar' ? 'إضافة أنماط' : 'Add styles'}
              </Button>
            </div>
            {showIncludePicker && includeRect && createPortal(
              <div
                id="include-picker-menu"
                style={{ position: 'fixed', top: includeRect.top, left: includeRect.left, width: includeRect.width, zIndex: 2147483647 }}
                className="max-h-56 overflow-auto rounded-md border bg-background shadow"
              >
                <ul className="p-2 space-y-1 text-sm">
                  {STYLE_PRESETS.map((opt) => {
                    const checked = includeTags.includes(opt);
                    return (
                      <li key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                        onClick={() => setIncludeTags((prev) => checked ? prev.filter(t=>t!==opt) : [...prev, opt])}
                      >
                        <input type="checkbox" readOnly checked={checked} />
                        <span>{opt}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>, document.body)
            }
          </div>

          {/* Instruments */}
          <div className="space-y-2 relative" ref={instrumentAnchorRef}>
            <label className="text-xs font-medium block">{language === 'ar' ? 'الآلات' : 'Instruments'}</label>
            <div className="flex flex-wrap gap-2">
              {instrumentTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-sm">
                  {tag}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setInstrumentTags((prev) => prev.filter((t) => t !== tag))}
                  >×</button>
                </span>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowInstrumentPicker((v)=>!v); setShowIncludePicker(false); }}>
                {language==='ar' ? 'إضافة آلات' : 'Add instruments'}
              </Button>
            </div>
            {showInstrumentPicker && instrumentRect && createPortal(
              <div
                id="instrument-picker-menu"
                style={{ position: 'fixed', top: instrumentRect.top, left: instrumentRect.left, width: instrumentRect.width, zIndex: 2147483647 }}
                className="max-h-56 overflow-auto rounded-md border bg-background shadow"
              >
                <ul className="p-2 space-y-1 text-sm">
                  {INSTRUMENT_PRESETS.map((opt) => {
                    const checked = instrumentTags.includes(opt);
                    return (
                      <li key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                        onClick={() => setInstrumentTags((prev) => checked ? prev.filter(t=>t!==opt) : [...prev, opt])}
                      >
                        <input type="checkbox" readOnly checked={checked} />
                        <span>{opt}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>, document.body)
            }
          </div>

          {/* Mode/Mood */}
          <div className="space-y-2 relative" ref={moodAnchorRef}>
            <label className="text-xs font-medium block">{language === 'ar' ? 'المزاج' : 'Mode'}</label>
            <div className="flex flex-wrap gap-2">
              {moodTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-sm">
                  {tag}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setMoodTags((prev) => prev.filter((t) => t !== tag))}
                  >×</button>
                </span>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowMoodPicker((v)=>!v); setShowIncludePicker(false); setShowInstrumentPicker(false); }}>
                {language==='ar' ? 'إضافة مزاج' : 'Add mode'}
              </Button>
            </div>
            {showMoodPicker && moodRect && createPortal(
              <div
                id="mood-picker-menu"
                style={{ position: 'fixed', top: moodRect.top, left: moodRect.left, width: moodRect.width, zIndex: 2147483647 }}
                className="max-h-56 overflow-auto rounded-md border bg-background shadow"
              >
                <ul className="p-2 space-y-1 text-sm">
                  {MODE_PRESETS.map((opt) => {
                    const checked = moodTags.includes(opt);
                    return (
                      <li key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                        onClick={() => setMoodTags((prev) => checked ? prev.filter(t=>t!==opt) : [...prev, opt])}
                      >
                        <input type="checkbox" readOnly checked={checked} />
                        <span>{opt}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>, document.body)
            }
          </div>

          {/* Vocals selector (moved into main card) */}
          <div className="space-y-2">
            <label className="text-xs font-medium block">{language === 'ar' ? 'الصوت' : 'Vocals'}</label>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="vocalType" checked={vocalType==='auto'} onChange={()=>setVocalType('auto')} />
                {language==='ar' ? 'تلقائي' : 'Auto'}
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="vocalType" checked={vocalType==='none'} onChange={()=>setVocalType('none')} />
                {language==='ar' ? 'بدون' : 'None'}
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="vocalType" checked={vocalType==='female'} onChange={()=>setVocalType('female')} />
                {language==='ar' ? 'صوت أنثوي' : 'Female voice'}
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="vocalType" checked={vocalType==='male'} onChange={()=>setVocalType('male')} />
                {language==='ar' ? 'صوت ذكوري' : 'Male voice'}
              </label>
            </div>
          </div>
        </div>
        {(includeTags.length>0 || instrumentTags.length>0 || moodTags.length>0 || vocalType!=='auto') && (
          <Button
            type="button"
            className="w-full btn-enhanced h-10"
            onClick={insertChipsIntoStyle}
          >
            {language==='ar' ? 'إدراج في الأسلوب' : 'Insert into Style'}
          </Button>
        )}
      </Card>

      <Card className="p-4 md:p-5 space-y-3">
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <Input
              value={title}
              onChange={(e)=> setTitle(e.target.value.slice(0,100))}
              placeholder={language==='ar' ? 'العنوان (مطلوب)' : 'Title (required)'}
              required
              className="md:w-1/3"
            />
            <div className="flex-1 flex flex-col gap-2">
              <Textarea
                value={styleText}
                onChange={(e) => setStyleText(Array.from(e.target.value).slice(0, styleCap).join(''))}
                placeholder={language === 'ar' ? 'وصف الأسلوب/الفكرة (حتى 350 حرفًا)' : 'Style/idea brief (up to 350 chars)'}
                rows={3}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground flex justify-start">
                <span>{language==='ar' ? 'الأسلوب' : 'Style'}: {Array.from(styleText).length} / {styleCap}</span>
              </div>
              {(includeTags.length>0 || instrumentTags.length>0 || moodTags.length>0 || vocalType!=='auto') && (
                <div className="text-xs text-muted-foreground flex items-start justify-between gap-2">
                  <div className="truncate" title={includedSummary}>
                    <span className="font-medium">{language==='ar' ? 'المضمَّن:' : 'Included:'}</span> {includedSummary}
                  </div>
                </div>
              )}

              <Textarea
                value={lyricsText}
                onChange={(e) => {
                  // First enforce line budget, then char cap
                  const raw = e.target.value || '';
                  const lines = raw.split(/\r?\n/);
                  const limitedLines = lines.slice(0, maxLyricLines);
                  const joined = limitedLines.join('\n');
                  const capped = Array.from(joined).slice(0, lyricsCap).join('');
                  setLyricsText(capped);
                }}
                placeholder={language === 'ar' ? 'الكلمات (حتى 450 حرفًا)' : 'Lyrics (up to 450 chars)'}
                rows={4}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>
                  {language==='ar'
                    ? `الكلمات: ${Array.from(lyricsText).length} / ${lyricsCap}`
                    : `Lyrics: ${Array.from(lyricsText).length} / ${lyricsCap}`}
                </span>
                <span>
                  {language==='ar'
                    ? `الأسطر: ${lyricLineCount} / ${maxLyricLines}`
                    : `Lines: ${lyricLineCount} / ${maxLyricLines}`}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={amping || submitting || !title.trim()}
              onClick={handleAmp}
              aria-busy={amping}
            >
              {amping ? (
                <span className="inline-flex items-center gap-1"><span className="animate-spin">✨</span><span>{language==='ar'?'تحسين…':'Amp…'}</span></span>
              ) : (
                <span className="inline-flex items-center gap-1"><Wand2 className="h-4 w-4" />{language==='ar'?'تحسين':'Amp'}</span>
              )}
            </Button>
            <Button
              disabled={overLimit || submitting || !title.trim()}
              onClick={handleGenerate}
              className=""
              aria-busy={submitting}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin">🎵</span>
                  <span>{language==='ar' ? 'جارٍ الإنشاء...' : 'Generating…'}</span>
                </span>
              ) : (
                <span>{language === 'ar' ? 'إنشاء' : 'Generate'}</span>
              )}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <div className="inline-flex items-center gap-2">
            <select
              className="px-3 py-1 rounded-full border bg-background text-foreground shadow-sm"
              value={duration}
              onChange={(e)=> setDuration(Math.min(120, Math.max(10, parseInt(e.target.value||'30'))))}
            >
              <option value={10}>↔ 0:10</option>
              <option value={30}>↔ 0:30</option>
              <option value={60}>↔ 1:00</option>
              <option value={90}>↔ 1:30</option>
              <option value={120}>↔ 2:00</option>
            </select>
            
            {submitting && <span className="text-emerald-600 animate-spin">🎵</span>}
          </div>
          <div className={`ml-auto font-medium ${overLimit ? 'text-red-600' : 'text-emerald-600'}`}>
            {language === 'ar' ? `المتبقي الكلي ${remainingOverall} من ${songsLimit}` : `Total remaining ${remainingOverall} / ${songsLimit}`}
          </div>
          <div className="font-medium">
            {language === 'ar' ? `تم الاستخدام: ${songsUsed} من ${songsLimit} هذا الشهر` : `Used ${songsUsed} of ${songsLimit} this month`}
          </div>
        </div>
      </Card>

      <Card className="p-4 md:p-5 space-y-3">
        {audios.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {language==='ar' ? 'سيتم حفظ الموسيقى المُنشأة كمشاريع في علامة التبويب المحفوظات' : 'generated music will be saved as projects in the Save tab'}
            </p>
            {lastError && (
              <p className="text-sm text-red-600">{lastError}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Save Reminder */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-muted">
              <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                {language === 'ar' 
                  ? 'تذكير: احفظ الموسيقى للوصول إليها لاحقاً من علامة التبويب "المحفوظات" وتنزيلها.'
                  : 'Reminder: Save your music to access it later from the "Saved" tab and download it.'}
              </p>
            </div>

            {audios.map((a, idx) => (
              <div key={a.createdAt + '-' + idx} className="space-y-3 p-3 md:p-4 rounded-lg border bg-card">
                <AudioPlayer src={a.url} className="w-full" />
                <div className="flex items-center gap-2 justify-end flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onPointerUp={() => handleDownload(a.url, `wakti-music-${a.createdAt}.mp3`)}
                  >
                    {language==='ar' ? 'تنزيل' : 'Download'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(a.url);
                      toast.success(language==='ar' ? 'تم نسخ الرابط' : 'URL copied');
                    }}
                  >
                    {language==='ar' ? 'نسخ الرابط' : 'Copy URL'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={a.saved}
                    onClick={async () => {
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) throw new Error(language==='ar' ? 'سجّل الدخول للحفظ' : 'Sign in to save');
                        let storagePath: string | null = null;
                        let publicUrl = a.url;
                        // If already a public URL within our bucket, derive storage path
                        const marker = '/storage/v1/object/public/music/';
                        if (publicUrl.includes(marker)) {
                          storagePath = publicUrl.split(marker)[1] || null;
                        }
                        // Otherwise, fetch and upload
                        if (!storagePath) {
                          const response = await fetch(a.url);
                          const blob = await response.blob();
                          const fileName = `${user.id}/${Date.now()}.mp3`;
                          const up = await supabase.storage.from('music').upload(fileName, blob, { contentType: 'audio/mpeg', upsert: false });
                          if (up.error) throw up.error;
                          const { data: urlData } = supabase.storage.from('music').getPublicUrl(fileName);
                          publicUrl = urlData.publicUrl;
                          storagePath = fileName;
                        }
                        // Avoid duplicates: check existing by storage_path
                        if (storagePath) {
                          const { count } = await (supabase as any)
                            .from('user_music_tracks')
                            .select('*', { count: 'exact', head: true })
                            .eq('user_id', user.id)
                            .eq('storage_path', storagePath);

                          if (!count || count === 0) {
                            const wantsArabic = langChoice === 'ar' || (langChoice === 'auto' && language === 'ar');
                            const stylesLine = buildStylesSuffix();
                            const titleLine = title ? (wantsArabic ? `العنوان: ${title}` : `Title: ${title}`) : '';
                            const contentLine = styleText ? (wantsArabic ? `ملخص الأسلوب: ${styleText}` : `Style brief: ${styleText}`) : '';
                            const lyricsContent = lyricsText ? (wantsArabic ? `الكلمات:\n${lyricsText}` : `Lyrics:\n${lyricsText}`) : '';
                            const savePrompt = [titleLine, contentLine, stylesLine, lyricsContent].filter(Boolean).join('\n');
                            await (supabase as any).from('user_music_tracks').insert({
                              user_id: user.id,
                              title: (title || (styleText + ' ' + (lyricsText ? lyricsText.slice(0,40) : ''))).substring(0, 100),
                              storage_path: storagePath,
                              signed_url: publicUrl,
                              duration_sec: Math.min(120, duration),
                              prompt: savePrompt,
                            });
                          }
                        }
                        setAudios((prev) => prev.map((it, i) => i===idx ? { ...it, url: publicUrl, saved: true } : it));
                        toast.success(
                          language === 'ar'
                            ? 'تم الحفظ. انتقل إلى المحفوظات أو مشاريعي.'
                            : 'Saved. Go to Saved or My Projects.'
                        );
                        onSaved?.();
                      } catch (e: any) {
                        toast.error((language==='ar'?'تعذر الحفظ: ':'Save failed: ') + (e?.message || String(e)));
                      }
                    }}
                  >
                    {a.saved ? (language==='ar' ? 'تم الحفظ' : 'Saved') : (language==='ar' ? 'حفظ' : 'Save')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function EditorTab() {
  const { language } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<Array<{ id: string; created_at: string; prompt: string | null; include_styles: string[] | null; exclude_styles: string[] | null; requested_duration_seconds: number | null; signed_url: string | null; storage_path: string | null; mime: string | null; play_url?: string | null }>>([]);

  const load = async () => {
    if (!user) {
      setTracks([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('user_music_tracks')
        .select('id, created_at, prompt, include_styles, exclude_styles, requested_duration_seconds, signed_url, storage_path, mime, meta')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Filter out failed/generating records and build playable URLs
      const withUrls = (data || [])
        .filter((t: any) => {
          // Skip records that are still generating or failed
          const status = t.meta?.status;
          if (status === 'generating' || status === 'failed') {
            console.log('[MusicStudio] Skipping track with status:', status, t.id);
            return false;
          }
          // Skip records with placeholder paths (never completed)
          if (t.storage_path?.includes('_pending.mp3')) {
            console.log('[MusicStudio] Skipping pending track:', t.id);
            return false;
          }
          return true;
        })
        .map((t: any) => {
          // Use signed_url directly if available, otherwise construct from storage_path as fallback
          let playUrl: string | null = t.signed_url;
          if (!playUrl && t.storage_path) {
            const base = SUPABASE_URL.replace(/\/$/, '');
            const path = t.storage_path.startsWith('/') ? t.storage_path.slice(1) : t.storage_path;
            playUrl = `${base}/storage/v1/object/public/music/${path}`;
          }
          return { ...t, play_url: playUrl } as typeof t & { play_url: string | null };
        });
      setTracks(withUrls);
    } catch (e) {
      console.error('[MusicStudio] Load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleDelete = async (trackId: string, storagePath: string | null) => {
    const confirmMsg = language === 'ar' 
      ? 'هل أنت متأكد من حذف هذا المقطع؟' 
      : 'Are you sure you want to delete this track?';
    
    if (!confirm(confirmMsg)) return;

    try {
      // Delete from database
      const { error: dbError } = await (supabase as any)
        .from('user_music_tracks')
        .delete()
        .eq('id', trackId);

      if (dbError) throw dbError;

      // Delete from storage if storage_path exists
      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from('music')
          .remove([storagePath]);
        
        if (storageError) {
          console.warn('Storage deletion failed:', storageError);
          // Don't throw - DB deletion succeeded
        }
      }

      // Update UI
      setTracks(prev => prev.filter(t => t.id !== trackId));
      toast.success(language === 'ar' ? 'تم الحذف بنجاح' : 'Deleted successfully');
    } catch (e: any) {
      toast.error((language === 'ar' ? 'فشل الحذف: ' : 'Delete failed: ') + (e?.message || String(e)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{language==='ar' ? 'مشاريعي' : 'My Projects'}</h2>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? (language==='ar'?'يُحدَّث...':'Refreshing...') : (language==='ar'?'تحديث':'Refresh')}</Button>
      </div>

      {tracks.length === 0 ? (
        <Card className="p-4 md:p-5">
          <p className="text-sm text-muted-foreground">{language==='ar' ? 'لا توجد عناصر محفوظة بعد.' : 'No saved items yet.'}</p>
        </Card>
      ) : (
        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {tracks.map((t) => (
            <Card key={t.id} className="p-3 md:p-5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{t.requested_duration_seconds ? `${t.requested_duration_seconds}s` : ''}</div>
              </div>
              {t.prompt && <div className="text-sm truncate" title={t.prompt}>{t.prompt}</div>}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {(t.include_styles||[]).map((s)=> <span key={s} className="px-2 py-0.5 rounded-full bg-muted">{s}</span>)}
              </div>
              {t.play_url && (
                <div className="space-y-3">
                  <AudioPlayer src={t.play_url} className="w-full" />
                  <div className="flex items-center gap-2 justify-end flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onPointerUp={() => handleDownload(t.play_url || '', `wakti-music-${t.id}.mp3`)}
                    >
                      {language==='ar' ? 'تنزيل' : 'Download'}
                    </Button>
                    <ShareButton
                      size="sm"
                      shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/music/share/${t.id}` : ''}
                      shareTitle={language==='ar' ? 'استمع إلى موسيقى من Wakti' : 'Listen to my Wakti music track'}
                      shareDescription={t.prompt || undefined}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(t.id, t.storage_path)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
