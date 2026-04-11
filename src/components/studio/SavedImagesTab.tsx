import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import ShareButton from '@/components/ui/ShareButton';
import InstagramPublishButton from '@/components/instagram/InstagramPublishButton';
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
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const lightboxZoomRef = useRef(1);
  const lightboxImageRef = useRef<HTMLImageElement | null>(null);
  const lightboxSliderRef = useRef<HTMLInputElement | null>(null);
  const lightboxPctRef = useRef<HTMLSpanElement | null>(null);
  const lightboxContainerRef = useRef<HTMLDivElement | null>(null);
  const pinchDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(1);
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const panStartXRef = useRef(0);
  const panStartYRef = useRef(0);
  const panStartTouchXRef = useRef(0);
  const panStartTouchYRef = useRef(0);

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

  useEffect(() => {
    lightboxZoomRef.current = 1;
    pinchDistanceRef.current = null;
    pinchStartZoomRef.current = 1;
    panXRef.current = 0;
    panYRef.current = 0;
    setLightboxZoom(1);
  }, [lightboxImage]);

  const clampZoom = useCallback((value: number) => Math.min(3, Math.max(1, value)), []);

  const applyTransform = useCallback((zoom: number, x: number, y: number) => {
    if (lightboxImageRef.current) {
      lightboxImageRef.current.style.transform = `scale(${zoom}) translate(${x / zoom}px, ${y / zoom}px)`;
    }
  }, []);

  const applyLightboxZoom = useCallback((value: number) => {
    const nextZoom = clampZoom(value);
    lightboxZoomRef.current = nextZoom;
    if (nextZoom <= 1) {
      panXRef.current = 0;
      panYRef.current = 0;
    }
    applyTransform(nextZoom, panXRef.current, panYRef.current);
    if (lightboxSliderRef.current) {
      lightboxSliderRef.current.value = String(nextZoom);
    }
    if (lightboxPctRef.current) {
      lightboxPctRef.current.textContent = `${Math.round(nextZoom * 100)}%`;
    }
  }, [clampZoom, applyTransform]);

  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  useEffect(() => {
    const el = lightboxContainerRef.current;
    if (!el || !lightboxImage) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dist = getTouchDistance(e.touches);
        if (dist == null) return;
        pinchDistanceRef.current = dist;
        pinchStartZoomRef.current = lightboxZoomRef.current;
      } else if (e.touches.length === 1 && lightboxZoomRef.current > 1) {
        panStartTouchXRef.current = e.touches[0].clientX;
        panStartTouchYRef.current = e.touches[0].clientY;
        panStartXRef.current = panXRef.current;
        panStartYRef.current = panYRef.current;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const dist = getTouchDistance(e.touches);
        if (dist == null || pinchDistanceRef.current == null) return;
        const nextZoom = pinchStartZoomRef.current * (dist / pinchDistanceRef.current);
        applyLightboxZoom(nextZoom);
      } else if (e.touches.length === 1 && lightboxZoomRef.current > 1) {
        const dx = e.touches[0].clientX - panStartTouchXRef.current;
        const dy = e.touches[0].clientY - panStartTouchYRef.current;
        panXRef.current = panStartXRef.current + dx;
        panYRef.current = panStartYRef.current + dy;
        applyTransform(lightboxZoomRef.current, panXRef.current, panYRef.current);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchDistanceRef.current = null;
        pinchStartZoomRef.current = lightboxZoomRef.current;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [lightboxImage, applyLightboxZoom, applyTransform]);

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

  const closeLightbox = useCallback(() => {
    setLightboxImage(null);
  }, []);

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
      {lightboxImage && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-6 right-6 z-10 h-12 w-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xl text-white flex items-center justify-center active:scale-90 transition-all border border-white/20 shadow-lg"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>

          <div
            className="flex flex-col items-center gap-4 px-4 w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              ref={lightboxContainerRef}
              className="w-full max-w-5xl max-h-[70vh] overflow-visible rounded-2xl touch-none overscroll-none select-none"
            >
              <div className="flex items-center justify-center min-h-[40vh] py-2">
                <img
                  ref={lightboxImageRef}
                  src={lightboxImage.image_url.replace(/%20/g, ' ').trim()}
                  alt="Saved"
                  className="max-w-[95vw] max-h-[65vh] object-contain rounded-2xl shadow-2xl select-none pointer-events-none"
                  style={{ transform: 'scale(1)', transformOrigin: 'center center', willChange: 'transform' }}
                />
              </div>
            </div>

            <div className="w-full max-w-sm rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-white/90 text-sm font-medium">
                <span>{language === 'ar' ? 'التكبير' : 'Zoom'}</span>
                <span ref={lightboxPctRef}>100%</span>
              </div>
              <input
                ref={lightboxSliderRef}
                type="range"
                min="1"
                max="3"
                step="0.02"
                defaultValue="1"
                onInput={(e) => applyLightboxZoom(Number((e.target as HTMLInputElement).value))}
                className="saved-image-zoom-slider mt-4 block h-14 w-full cursor-pointer touch-manipulation"
                aria-label={language === 'ar' ? 'شريط تكبير الصورة' : 'Image zoom slider'}
              />
            </div>
          </div>

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
              shareDescription={language === 'ar' ? 'تم إنشاؤها بواسطة Wakti AI' : 'Created with Wakti AI'}
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
      )}
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
                  src={img.image_url.replace(/%20/g, ' ').trim()}
                  alt="Generated image"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              {/* Bottom info bar */}
              <div className="p-2 space-y-1.5">
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
                    aria-label={language === 'ar' ? 'توسيع الصورة' : 'Expand image'}
                    title={language === 'ar' ? 'توسيع الصورة' : 'Expand image'}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-white/80 dark:bg-white/5 border border-border/40 text-foreground active:scale-95 transition-transform"
                  >
                    <Maximize2 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDownload(img.image_url)}
                    aria-label={language === 'ar' ? 'تحميل الصورة' : 'Download image'}
                    title={language === 'ar' ? 'تحميل الصورة' : 'Download image'}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-white/80 dark:bg-white/5 border border-border/40 text-foreground active:scale-95 transition-transform"
                  >
                    <Download className="h-3 w-3" />
                  </button>
                  <div className="flex-1">
                    <ShareButton
                      shareUrl={`${window.location.origin}/image/${img.id}`}
                      shareTitle={language === 'ar' ? 'صورة من Wakti AI' : 'Image from Wakti AI'}
                      shareDescription={language === 'ar' ? 'تم إنشاؤها بواسطة Wakti AI' : 'Created with Wakti AI'}
                      size="sm"
                      className="w-full justify-center"
                    />
                  </div>
                  <button
                    onClick={() => handleDelete(img.id)}
                    disabled={deletingId === img.id}
                    aria-label={language === 'ar' ? 'حذف الصورة' : 'Delete image'}
                    title={language === 'ar' ? 'حذف الصورة' : 'Delete image'}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-950/20 border border-red-200/40 dark:border-red-800/30 text-red-600 dark:text-red-400 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {deletingId === img.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </button>
                </div>

                <div className="pt-1">
                  <InstagramPublishButton
                    mediaUrl={img.image_url}
                    mediaType="image"
                    defaultCaption={''}
                    language={language as 'en' | 'ar'}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
