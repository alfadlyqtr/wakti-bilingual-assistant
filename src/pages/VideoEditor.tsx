import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CreativeEditorSDK, { UserInterfaceElements } from '@cesdk/cesdk-js';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const IMGLY_LICENSE_KEY = import.meta.env.VITE_IMGLY_LICENSE_KEY || '';

type VideoRow = {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  thumbnail_url?: string | null;
  storage_path: string | null;
  duration_seconds: number | null;
  aspect_ratio: string | null;
  style_template: string | null;
  is_public: boolean;
  created_at: string;
};

export default function VideoEditor() {
  const { language, theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const cesdkRef = useRef<CreativeEditorSDK | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [videoRow, setVideoRow] = useState<VideoRow | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  const isEditing = !!id;

  const config = useMemo(() => {
    return {
      license: IMGLY_LICENSE_KEY,
      role: 'Adopter',
      theme: theme === 'dark' ? 'dark' : 'light',
      ui: {
        elements: {
          view: 'default',
          navigation: {
            position: UserInterfaceElements.NavigationPosition.Top,
            action: {
              export: true
            }
          }
        }
      },
      callbacks: {
        onUpload: 'local'
      }
    } as any;
  }, [theme]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      if (!isEditing) return;

      try {
        const { data, error } = await (supabase as any)
          .from('user_videos')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setVideoRow(data as VideoRow);

        if (data?.storage_path) {
          const { data: urlData } = await supabase.storage
            .from('videos')
            .createSignedUrl(data.storage_path, 3600);
          if (urlData?.signedUrl) setSourceUrl(urlData.signedUrl);
        }
      } catch (e) {
        console.error('Failed to load video:', e);
        toast.error(language === 'ar' ? 'فشل تحميل الفيديو' : 'Failed to load video');
        navigate('/music');
      }
    };

    load();
  }, [id, isEditing, language, navigate, user]);

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      if (!containerRef.current) return;

      setLoading(true);

      try {
        const instance = await CreativeEditorSDK.create(containerRef.current, config);
        cesdkRef.current = instance;

        (instance as any).callbacks?.register?.('exportDesign', async (options: any) => {
          const { blobs, options: exportOptions } = await instance.utils.export({
            ...(options || {}),
            mimeType: 'video/mp4'
          });
          await handleExport(blobs?.[0], exportOptions?.mimeType || 'video/mp4');
        });

        await instance.addDefaultAssetSources();
        await instance.addDemoAssetSources({ sceneMode: 'Video', withUploadAssetSources: true });

        instance.feature.enable('ly.img.placeholder', false);
        instance.feature.enable('ly.img.preview', false);

        if (sourceUrl) {
          await instance.engine.scene.createFromVideo(sourceUrl);
        } else if (typeof (instance as any).createVideoScene === 'function') {
          await (instance as any).createVideoScene();
        } else {
          const scene = instance.engine.scene.createVideo?.();
          if (scene) {
            const page = instance.engine.block.create('page');
            instance.engine.block.appendChild(scene, page);
          }
        }

        setLoading(false);
      } catch (e) {
        console.error('CE.SDK init failed:', e);
        toast.error(language === 'ar' ? 'فشل فتح محرر الفيديو' : 'Failed to open video editor');
        setLoading(false);
      }
    };

    init();

    return () => {
      try {
        cesdkRef.current?.dispose();
      } catch (_) {}
      cesdkRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, language, sourceUrl, user]);

  const generateVideoThumbnail = async (videoBlob: Blob): Promise<Blob | null> => {
    const url = URL.createObjectURL(videoBlob);
    try {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.src = url;

      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => resolve();
        const onError = () => reject(new Error('Video thumbnail load failed'));
        video.addEventListener('loadeddata', onLoaded, { once: true });
        video.addEventListener('error', onError, { once: true });
      });

      const targetTime = Math.min(0.1, Math.max(0, (video.duration || 0) * 0.01));
      if (!Number.isNaN(targetTime)) {
        try {
          video.currentTime = targetTime;
          await new Promise<void>((resolve) => {
            video.addEventListener('seeked', () => resolve(), { once: true });
          });
        } catch (_) {}
      }

      const canvas = document.createElement('canvas');
      const w = video.videoWidth || 720;
      const h = video.videoHeight || 1280;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, w, h);

      const thumbBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82);
      });

      return thumbBlob;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const handleExport = async (blob: Blob | undefined, mimeType: string) => {
    if (!user) return;
    if (!blob) {
      toast.error(language === 'ar' ? 'فشل التصدير' : 'Export failed');
      return;
    }

    setSaving(true);
    try {
      const fileName = `${user.id}/${Date.now()}.mp4`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, blob, {
          contentType: mimeType || 'video/mp4',
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      let thumbnailPath: string | null = null;
      try {
        const thumb = await generateVideoThumbnail(blob);
        if (thumb) {
          const thumbName = `${user.id}/thumbnails/${Date.now()}.jpg`;
          const { data: tData, error: tErr } = await supabase.storage
            .from('videos')
            .upload(thumbName, thumb, {
              contentType: 'image/jpeg',
              cacheControl: '3600'
            });
          if (!tErr) thumbnailPath = tData?.path || null;
        }
      } catch (_) {
        thumbnailPath = null;
      }

      if (isEditing && videoRow?.id) {
        const { error: updateError } = await (supabase as any)
          .from('user_videos')
          .update({
            storage_path: uploadData.path,
            thumbnail_url: thumbnailPath,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoRow.id)
          .eq('user_id', user.id);

        if (updateError) throw updateError;

        toast.success(language === 'ar' ? 'تم حفظ التعديلات' : 'Changes saved');
      } else {
        const { data: inserted, error: insertError } = await (supabase as any)
          .from('user_videos')
          .insert({
            user_id: user.id,
            title: null,
            thumbnail_url: thumbnailPath,
            storage_path: uploadData.path,
            duration_seconds: null,
            aspect_ratio: '9:16',
            style_template: null,
            is_public: false
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        toast.success(language === 'ar' ? 'تم حفظ الفيديو' : 'Video saved');
        const newId = (inserted as any)?.id;
        if (newId) {
          navigate(`/video/editor/${newId}`, { replace: true });
        }
      }

      navigate('/music', { state: { openVideoTab: 'saved' } });
    } catch (e) {
      console.error('Export upload failed:', e);
      toast.error(language === 'ar' ? 'فشل حفظ الفيديو' : 'Failed to save video');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-3 md:p-6 pb-20 md:pb-6">
      <div className="flex items-center justify-between mb-3">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
        <div className="text-sm text-muted-foreground">
          {saving ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : ''}
        </div>
      </div>

      {loading && (
        <div className="w-full flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      <div ref={containerRef} className="w-full" style={{ minHeight: '80vh' }} />
    </div>
  );
}
