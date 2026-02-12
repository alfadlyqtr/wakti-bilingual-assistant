import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import ShareButton from '@/components/ui/ShareButton';
import {
  Loader2,
  Download,
  Trash2,
  X,
  Maximize2,
  RefreshCw,
  ImageIcon,
  Save,
  Check,
  Plus,
  Sparkles,
} from 'lucide-react';

interface SavedImage {
  id: string;
  image_url: string;
  prompt: string | null;
  submode: string;
  quality: string | null;
  created_at: string;
}

interface SavedImagesTabProps {
  onCreate: () => void;
}

export default function SavedImagesTab({ onCreate }: SavedImagesTabProps) {
  const { language } = useTheme();
  const { user } = useAuth();

  const [images, setImages] = useState<SavedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<SavedImage | null>(null);

  const loadImages = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('user_generated_images')
        .select('id, image_url, prompt, submode, quality, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setImages(data || []);
    } catch (err: any) {
      console.error('Failed to load saved images:', err);
      toast.error(language === 'ar' ? 'فشل تحميل الصور' : 'Failed to load images');
    } finally {
      setLoading(false);
    }
  }, [user?.id, language]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      // Find the image to get its URL for storage cleanup
      const img = images.find((i) => i.id === id);

      // Delete DB row
      const { error } = await (supabase as any)
        .from('user_generated_images')
        .delete()
        .eq('id', id);
      if (error) throw error;

      // Also delete from storage bucket if it's our bucket URL
      if (img?.image_url?.includes('/generated-images/')) {
        try {
          const pathMatch = img.image_url.split('/generated-images/')[1];
          if (pathMatch) {
            await supabase.storage.from('generated-images').remove([decodeURIComponent(pathMatch)]);
          }
        } catch (storageErr) {
          console.warn('Storage cleanup failed (non-critical):', storageErr);
        }
      }

      setImages((prev) => prev.filter((i) => i.id !== id));
      if (lightboxImage?.id === id) setLightboxImage(null);
      toast.success(language === 'ar' ? 'تم الحذف' : 'Deleted');
    } catch (err: any) {
      console.error('Delete failed:', err);
      toast.error(language === 'ar' ? 'فشل الحذف' : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `wakti-image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return language === 'ar' ? 'الآن' : 'Just now';
      if (diffMins < 60) return language === 'ar' ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`;
      if (diffHours < 24) return language === 'ar' ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
      if (diffDays < 7) return language === 'ar' ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
      return d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const submodeLabel = (s: string) => {
    const map: Record<string, { en: string; ar: string }> = {
      text2image: { en: 'Text2Image', ar: 'نص→صورة' },
      image2image: { en: 'Image2Image', ar: 'صورة→صورة' },
      'background-removal': { en: 'BG Removal', ar: 'إزالة خلفية' },
      draw: { en: 'Draw', ar: 'رسم' },
    };
    const entry = map[s];
    return entry ? (language === 'ar' ? entry.ar : entry.en) : s;
  };

  // ─── Lightbox ───
  const Lightbox = () => {
    if (!lightboxImage) return null;
    return createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
        onClick={() => setLightboxImage(null)}
      >
        <button
          onClick={() => setLightboxImage(null)}
          className="absolute top-6 right-6 z-10 h-12 w-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xl text-white flex items-center justify-center active:scale-90 transition-all border border-white/20 shadow-lg"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>

        <img
          src={lightboxImage.image_url}
          alt="Saved"
          className="max-w-[95vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Prompt overlay */}
        {lightboxImage.prompt && (
          <div
            className="absolute top-4 left-4 right-16 bg-black/50 backdrop-blur-xl rounded-xl px-3 py-2 text-white/80 text-xs line-clamp-2"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxImage.prompt}
          </div>
        )}

        {/* Bottom action bar */}
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-xl rounded-2xl px-4 py-2.5 border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleDownload(lightboxImage.image_url)}
            className="flex items-center gap-1.5 text-white/90 text-sm font-medium active:scale-95 transition-transform"
          >
            <Download className="h-4 w-4" /> {language === 'ar' ? 'تحميل' : 'Download'}
          </button>
          <div className="w-px h-5 bg-white/20" />
          <ShareButton
            shareUrl={`${window.location.origin}/image/${lightboxImage.id}`}
            shareTitle={language === 'ar' ? 'صورة من Wakti AI' : 'Image from Wakti AI'}
            shareDescription={lightboxImage.prompt || ''}
            size="sm"
          />
          <div className="w-px h-5 bg-white/20" />
          <button
            onClick={() => handleDelete(lightboxImage.id)}
            disabled={deletingId === lightboxImage.id}
            className="flex items-center gap-1.5 text-red-400 text-sm font-medium active:scale-95 transition-transform"
          >
            {deletingId === lightboxImage.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {language === 'ar' ? 'حذف' : 'Delete'}
          </button>
        </div>
      </div>,
      document.body
    );
  };

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <p className="text-sm text-muted-foreground">{language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}</p>
      </div>
    );
  }

  // ─── Empty state ───
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-orange-500/15 to-amber-500/15 flex items-center justify-center">
          <Sparkles className="h-10 w-10 text-orange-500/50" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-base font-semibold text-foreground">
            {language === 'ar' ? 'لا توجد صور محفوظة' : 'No saved images yet'}
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {language === 'ar'
              ? 'أنشئ صورة واحفظها لتظهر هنا.'
              : 'Generate an image and save it to see it here.'}
          </p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 active:scale-95 transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          {language === 'ar' ? 'إنشاء صورة' : 'Create Image'}
        </button>
      </div>
    );
  }

  // ─── Gallery ───
  return (
    <>
      <Lightbox />
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {images.length} {language === 'ar' ? 'صورة' : images.length === 1 ? 'image' : 'images'}
          </p>
          <button
            onClick={loadImages}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground bg-muted/50 active:scale-95 transition-transform"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {language === 'ar' ? 'تحديث' : 'Refresh'}
          </button>
        </div>

        {/* 20-day auto-delete notice */}
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
          <Download className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            {language === 'ar'
              ? 'يتم حذف الصور تلقائيًا بعد 20 يومًا. قم بتنزيل صورك المفضلة للاحتفاظ بها!'
              : 'Images are automatically deleted after 20 days. Download your favorites to keep them!'}
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative rounded-xl overflow-hidden border border-border/50 bg-gradient-to-br from-black/5 to-black/10 dark:from-white/5 dark:to-white/10 shadow-sm"
            >
              {/* Image */}
              <div
                className="aspect-square cursor-pointer"
                onClick={() => setLightboxImage(img)}
              >
                <img
                  src={img.image_url}
                  alt={img.prompt || 'Generated image'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              {/* Bottom info bar */}
              <div className="p-2 space-y-1.5">
                {/* Prompt preview */}
                {img.prompt && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{img.prompt}</p>
                )}

                {/* Meta row */}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-100/80 dark:bg-orange-900/20 px-1.5 py-0.5 rounded">
                    {submodeLabel(img.submode)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{formatDate(img.created_at)}</span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLightboxImage(img)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-white/80 dark:bg-white/5 border border-border/40 text-foreground active:scale-95 transition-transform"
                  >
                    <Maximize2 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDownload(img.image_url)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-white/80 dark:bg-white/5 border border-border/40 text-foreground active:scale-95 transition-transform"
                  >
                    <Download className="h-3 w-3" />
                  </button>
                  <div className="flex-1">
                    <ShareButton
                      shareUrl={`${window.location.origin}/image/${img.id}`}
                      shareTitle={language === 'ar' ? 'صورة من Wakti AI' : 'Image from Wakti AI'}
                      shareDescription={img.prompt || ''}
                      size="sm"
                      className="w-full justify-center"
                    />
                  </div>
                  <button
                    onClick={() => handleDelete(img.id)}
                    disabled={deletingId === img.id}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-950/20 border border-red-200/40 dark:border-red-800/30 text-red-600 dark:text-red-400 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {deletingId === img.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
