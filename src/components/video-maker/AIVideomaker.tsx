import React, { useState, useRef, useCallback, useEffect } from 'react';
import InstagramPublishButton from '@/components/instagram/InstagramPublishButton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Upload,
  Image as ImageIcon,
  Video,
  Loader2,
  Download,
  Share2,
  RefreshCw,
  Sparkles,
  Clock,
  AlertCircle,
  X,
  Play,
  Wand2,
  ArrowLeft,
  ArrowRight,
  Camera,
  Save,
  Check,
  Lock,
  FolderOpen,
  Type,
  GalleryHorizontalEnd,
  Images,
} from 'lucide-react';

interface QuotaInfo {
  used: number;
  limit: number;
  extra: number;
  canGenerate: boolean;
}

interface AIVideomakerProps {
  onSaveSuccess?: () => void;
}

interface LatestVideo {
  id: string;
  title: string | null;
  video_url: string | null;
  storage_path?: string | null;
  duration_seconds: number | null;
  created_at: string;
  signedUrl?: string | null;
}

// Image compression helper
const compressImage = (file: File, maxWidth = 1024, quality = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas compression failed'));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const res = await fetch(dataUrl);
  return await res.blob();
};

const cleanSignedUrl = (url: string): string => {
  try {
    return decodeURI(url).trim();
  } catch {
    return url.replace(/%20/g, ' ').trim();
  }
};

export default function AIVideomaker({ onSaveSuccess }: AIVideomakerProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  const hasArabicChars = (text: string) => /[\u0600-\u06FF]/.test(text || '');

  // State
  const [generationMode, setGenerationModeRaw] = useState<'image_to_video' | 'text_to_video' | '2images_to_video'>('image_to_video');
  const setGenerationMode = (mode: 'image_to_video' | 'text_to_video' | '2images_to_video') => {
    setGenerationModeRaw(mode);
    if (mode === '2images_to_video') {
      setDuration('8');
    } else {
      setDuration('6');
    }
  };
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile2, setImageFile2] = useState<File | null>(null);
  const [imagePreview2, setImagePreview2] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<'4' | '6' | '8' | '10' | '12' | '15'>('8');
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [resolution, setResolution] = useState<'480p' | '720p'>('480p');
  const [videoStyleMode, setVideoStyleMode] = useState<'normal' | 'fun'>('normal');
  const [isAmping, setIsAmping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [sourceImagePath, setSourceImagePath] = useState<string | null>(null);
  const [latestVideo, setLatestVideo] = useState<LatestVideo | null>(null);
  const [showSavedPicker, setShowSavedPicker] = useState(false);
  const [savedImages, setSavedImages] = useState<{id:string; image_url:string; submode:string; created_at:string}[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [pickingForSlot, setPickingForSlot] = useState<1 | 2>(1);
  const pollInFlightRef = useRef(false);
  const usageIncrementedRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const invokePromptAmpWithBetterErrors = useCallback(
    async (body: Record<string, unknown>) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const supabaseUrl = SUPABASE_URL;
      const supabaseKey = SUPABASE_ANON_KEY;

      const resp = await fetch(`${supabaseUrl}/functions/v1/prompt-amp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify(body),
      });

      const txt = await resp.text().catch(() => '');
      if (!resp.ok) {
        throw new Error(txt || `prompt-amp returned ${resp.status}`);
      }

      try {
        return { data: JSON.parse(txt) };
      } catch {
        throw new Error('Invalid JSON from prompt-amp');
      }
    },
    []
  );

  // Amp: generate/improve a cinematic prompt
  const handleAmp = useCallback(async () => {
    if (isAmping || isGenerating || !user) return;
    // Image mode requires an image; text mode requires a prompt; 2images mode requires both images
    if (generationMode === 'image_to_video' && !imagePreview) return;
    if (generationMode === 'text_to_video' && !prompt.trim()) return;
    if (generationMode === '2images_to_video' && (!imagePreview || !imagePreview2)) return;
    setIsAmping(true);
    try {
      if (generationMode === 'image_to_video') {
        // Image-to-Video amp: upload image then use OpenAI vision
        let ampImageUrl = '';
        try {
          const randomId = Math.random().toString(36).substring(2, 15);
          const storagePath = `${user.id}/ai-video-input/${randomId}.jpg`;

          let sourceBlob: Blob;
          if (imageFile) {
            sourceBlob = await compressImage(imageFile, 512, 0.5);
          } else if (imagePreview?.startsWith('data:')) {
            const previewBlob = await dataUrlToBlob(imagePreview);
            sourceBlob = await compressImage(new File([previewBlob], 'preview.jpg', { type: 'image/jpeg' }), 512, 0.5);
          } else if (imagePreview?.startsWith('http')) {
            const fetchedBlob = await fetch(imagePreview).then(r => r.blob());
            sourceBlob = await compressImage(new File([fetchedBlob], 'saved.jpg', { type: fetchedBlob.type || 'image/jpeg' }), 512, 0.5);
          } else {
            throw new Error('Missing image source');
          }

          console.log('[AIVideomaker] Amp: Uploading to message_attachments:', storagePath);
          const { error: uploadErr } = await supabase.storage
            .from('message_attachments')
            .upload(storagePath, sourceBlob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadErr) {
            console.error('[AIVideomaker] Amp upload error:', uploadErr);
            throw new Error(`Upload failed: ${uploadErr.message}`);
          }

          const { data: signedData, error: signedErr } = await supabase.storage
            .from('message_attachments')
            .createSignedUrl(storagePath, 60 * 60 * 6);
          if (signedErr) throw new Error(`Signed URL failed: ${signedErr.message}`);
          if (!signedData?.signedUrl) throw new Error('Signed URL missing');
          ampImageUrl = cleanSignedUrl(signedData.signedUrl);
          console.log('[AIVideomaker] Amp upload successful:', ampImageUrl);
        } catch (prepErr: any) {
          console.error('[AIVideomaker] Amp prepare error:', prepErr);
          throw new Error(
            language === 'ar'
              ? 'فشل تجهيز الصورة: ' + (prepErr?.message || '')
              : 'Failed to prepare image: ' + (prepErr?.message || '')
          );
        }

        const { data } = await invokePromptAmpWithBetterErrors({
          mode: 'image2video',
          image_url: ampImageUrl,
          brand_details: prompt.trim() || '',
          environment: 'auto',
          duration,
        });
        if (data?.success && data?.text) {
          setPrompt(data.text);
          toast.success(language === 'ar' ? 'تم تحسين الوصف ✨' : 'Prompt amped ✨');
        } else {
          throw new Error(data?.error || 'No improved prompt returned');
        }
      } else if (generationMode === '2images_to_video') {
        // 2Images-to-Video amp: upload both images then use OpenAI vision with dual images
        let ampImageUrl1 = '';
        let ampImageUrl2 = '';
        try {
          // Upload first image
          const randomId1 = Math.random().toString(36).substring(2, 15);
          const storagePath1 = `${user.id}/ai-video-input/${randomId1}_amp1.jpg`;

          let sourceBlob1: Blob;
          if (imageFile) {
            sourceBlob1 = await compressImage(imageFile, 512, 0.5);
          } else if (imagePreview?.startsWith('data:')) {
            const previewBlob = await dataUrlToBlob(imagePreview);
            sourceBlob1 = await compressImage(new File([previewBlob], 'preview1.jpg', { type: 'image/jpeg' }), 512, 0.5);
          } else if (imagePreview?.startsWith('http')) {
            const fetchedBlob = await fetch(imagePreview).then(r => r.blob());
            sourceBlob1 = await compressImage(new File([fetchedBlob], 'saved1.jpg', { type: fetchedBlob.type || 'image/jpeg' }), 512, 0.5);
          } else {
            throw new Error('Missing first image source');
          }

          console.log('[AIVideomaker] Amp: Uploading first image to message_attachments:', storagePath1);
          const { error: uploadErr1 } = await supabase.storage
            .from('message_attachments')
            .upload(storagePath1, sourceBlob1, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadErr1) {
            console.error('[AIVideomaker] Amp upload error (image1):', uploadErr1);
            throw new Error(`Upload failed (image1): ${uploadErr1.message}`);
          }

          const { data: signedData1, error: signedErr1 } = await supabase.storage
            .from('message_attachments')
            .createSignedUrl(storagePath1, 60 * 60 * 6);
          if (signedErr1) throw new Error(`Signed URL failed (image1): ${signedErr1.message}`);
          if (!signedData1?.signedUrl) throw new Error('Signed URL missing (image1)');
          ampImageUrl1 = cleanSignedUrl(signedData1.signedUrl);
          console.log('[AIVideomaker] Amp first image uploaded:', ampImageUrl1);

          // Upload second image
          const randomId2 = Math.random().toString(36).substring(2, 15);
          const storagePath2 = `${user.id}/ai-video-input/${randomId2}_amp2.jpg`;

          let sourceBlob2: Blob;
          if (imageFile2) {
            sourceBlob2 = await compressImage(imageFile2, 512, 0.5);
          } else if (imagePreview2?.startsWith('data:')) {
            const previewBlob = await dataUrlToBlob(imagePreview2);
            sourceBlob2 = await compressImage(new File([previewBlob], 'preview2.jpg', { type: 'image/jpeg' }), 512, 0.5);
          } else if (imagePreview2?.startsWith('http')) {
            const fetchedBlob = await fetch(imagePreview2).then(r => r.blob());
            sourceBlob2 = await compressImage(new File([fetchedBlob], 'saved2.jpg', { type: fetchedBlob.type || 'image/jpeg' }), 512, 0.5);
          } else {
            throw new Error('Missing second image source');
          }

          console.log('[AIVideomaker] Amp: Uploading second image to message_attachments:', storagePath2);
          const { error: uploadErr2 } = await supabase.storage
            .from('message_attachments')
            .upload(storagePath2, sourceBlob2, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadErr2) {
            console.error('[AIVideomaker] Amp upload error (image2):', uploadErr2);
            throw new Error(`Upload failed (image2): ${uploadErr2.message}`);
          }

          const { data: signedData2, error: signedErr2 } = await supabase.storage
            .from('message_attachments')
            .createSignedUrl(storagePath2, 60 * 60 * 6);
          if (signedErr2) throw new Error(`Signed URL failed (image2): ${signedErr2.message}`);
          if (!signedData2?.signedUrl) throw new Error('Signed URL missing (image2)');
          ampImageUrl2 = cleanSignedUrl(signedData2.signedUrl);
          console.log('[AIVideomaker] Amp second image uploaded:', ampImageUrl2);
        } catch (prepErr: any) {
          console.error('[AIVideomaker] Amp prepare error:', prepErr);
          throw new Error(
            language === 'ar'
              ? 'فشل تجهيز الصور: ' + (prepErr?.message || '')
              : 'Failed to prepare images: ' + (prepErr?.message || '')
          );
        }

        const { data } = await invokePromptAmpWithBetterErrors({
          mode: '2images2video',
          image_url_1: ampImageUrl1,
          image_url_2: ampImageUrl2,
          user_text: prompt.trim() || '',
          duration,
          aspect_ratio: aspectRatio,
        });
        if (data?.success && data?.text) {
          setPrompt(data.text);
          toast.success(language === 'ar' ? 'تم تحسين الوصف ✨' : 'Prompt amped ✨');
        } else {
          throw new Error(data?.error || 'No improved prompt returned');
        }
      } else {
        // Text-to-Video amp: enhance/translate the text prompt via DeepSeek
        const { data } = await invokePromptAmpWithBetterErrors({
          mode: 'text2video',
          text: prompt.trim(),
        });
        if (data?.success && data?.text) {
          setPrompt(data.text);
          toast.success(language === 'ar' ? 'تم تحسين الوصف ✨' : 'Prompt amped ✨');
        } else {
          throw new Error(data?.error || 'No improved prompt returned');
        }
      }
    } catch (err: any) {
      console.error('[AIVideomaker] Amp error:', err);
      toast.error(language === 'ar' ? 'فشل تحسين الوصف: ' + (err.message || '') : 'Failed to amp: ' + (err.message || ''));
    } finally {
      setIsAmping(false);
    }
  }, [generationMode, imagePreview, imagePreview2, imageFile, imageFile2, isAmping, isGenerating, prompt, duration, aspectRatio, language, user, invokePromptAmpWithBetterErrors]);

  // Load quota on mount
  const loadQuota = useCallback(async () => {
    if (!user) return;
    setLoadingQuota(true);
    try {
      const { data, error } = await (supabase as any).rpc('can_generate_ai_video', {
        p_user_id: user.id,
      });
      if (error) throw error;
      const q = data?.[0] || data;
      setQuota({
        used: q?.videos_generated || 0,
        limit: q?.videos_limit || 60,
        extra: q?.extra_videos || 0,
        canGenerate: q?.can_generate ?? true,
      });
    } catch (e) {
      console.error('Failed to load AI video quota:', e);
    } finally {
      setLoadingQuota(false);
    }
  }, [user]);

  useEffect(() => {
    loadQuota();
  }, [loadQuota]);

  const loadLatestVideo = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await (supabase as any)
        .from('user_videos')
        .select('id, title, video_url, storage_path, duration_seconds, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      const row = data?.[0];
      if (row?.storage_path) {
        let signedUrl: string | null = null;
        const { data: urlData, error: urlErr } = await supabase.storage
          .from('videos')
          .createSignedUrl(row.storage_path, 3600);
        if (urlErr) {
          const { data: pubData } = supabase.storage.from('videos').getPublicUrl(row.storage_path);
          signedUrl = pubData?.publicUrl || null;
        } else {
          signedUrl = urlData?.signedUrl || null;
        }

        if (signedUrl) {
          setLatestVideo({ ...row, signedUrl });
        }
      }
    } catch (e) {
      console.error('Failed to load latest video:', e);
    }
  }, [user]);

  useEffect(() => {
    loadLatestVideo();
  }, [loadLatestVideo]);

  // Fetch saved images for picker
  const fetchSavedImages = useCallback(async () => {
    if (!user) return;
    setLoadingSaved(true);
    try {
      const { data, error } = await (supabase as any)
        .from('user_generated_images')
        .select('id, image_url, submode, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      setSavedImages((data || []).map((img: any) => ({
        ...img,
        image_url: (img.image_url || '').replace(/%20/g, ' ').trim(),
      })));
    } catch (e) {
      console.error('Failed to fetch saved images:', e);
    } finally {
      setLoadingSaved(false);
    }
  }, [user]);

  const handlePickSaved = (url: string) => {
    if (pickingForSlot === 1) {
      setImageFile(null);
      setImagePreview(url);
    } else {
      setImageFile2(null);
      setImagePreview2(url);
    }
    setGeneratedVideoUrl(null);
    setShowSavedPicker(false);
  };

  // Handle image upload
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(language === 'ar' ? 'يرجى اختيار صورة' : 'Please select an image');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'الحد الأقصى 10 ميجابايت' : 'Max file size is 10MB');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    setGeneratedVideoUrl(null);
  };

  const handleImageSelect2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(language === 'ar' ? 'يرجى اختيار صورة' : 'Please select an image');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'الحد الأقصى 10 ميجابايت' : 'Max file size is 10MB');
      return;
    }

    setImageFile2(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview2(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    setGeneratedVideoUrl(null);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setGeneratedVideoUrl(null);
    setSourceImagePath(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearImage2 = () => {
    setImageFile2(null);
    setImagePreview2(null);
    setGeneratedVideoUrl(null);
    if (fileInputRef2.current) {
      fileInputRef2.current.value = '';
    }
  };

  const handleDownloadLatest = async () => {
    const downloadUrl = latestVideo?.signedUrl || latestVideo?.video_url;
    if (!downloadUrl) return;
    try {
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wakti-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
      window.open(downloadUrl, '_blank');
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Poll for task status
  const pollTaskStatus = useCallback(async (tid: string) => {
    try {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      const { data, error } = await supabase.functions.invoke('freepik-image2video', {
        body: { mode: 'status', task_id: tid, increment_usage: !usageIncrementedRef.current },
      });

      if (error) throw error;

      const status = data?.data?.status?.toLowerCase();
      console.log('[AIVideomaker] Poll status:', status);
      console.log('[AIVideomaker] Full data on poll:', JSON.stringify(data));

      if (status === 'completed' || status === 'succeed' || status === 'succeeded') {
        // Done!
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        usageIncrementedRef.current = true;
        // Video URL is in generated array, NOT video.url!
        const videoUrl = data?.data?.generated?.[0] || data?.data?.video?.url;
        console.log('[AIVideomaker] Extracted videoUrl:', videoUrl);
        if (videoUrl) {
          setGeneratedVideoUrl(videoUrl);
          setIsSaved(false);
          setGenerationProgress(100);
          setGenerationStatus(language === 'ar' ? 'تم!' : 'Done!');
          toast.success(language === 'ar' ? 'تم إنشاء الفيديو!' : 'Video generated!');
          await loadQuota();
          await loadLatestVideo();
        } else {
          throw new Error('Video URL not found');
        }
        setIsGenerating(false);
        setTaskId(null);
      } else if (status === 'failed' || status === 'error') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        throw new Error(data?.data?.error || 'Video generation failed');
      } else {
        // Still processing - update progress
        setGenerationProgress((prev) => Math.min(prev + 5, 90));
      }
    } catch (e: any) {
      console.error('[AIVideomaker] Poll error:', e);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setIsGenerating(false);
      setTaskId(null);
      setGenerationProgress(0);
      setGenerationStatus('');
      const msg = e?.message || '';
      const userMsg = msg.includes('generation failed')
        ? (language === 'ar' ? 'فشل إنشاء الفيديو. حاول بصورة أو وصف مختلف.' : 'Video generation failed. Try a different image or prompt.')
        : (msg || (language === 'ar' ? 'فشل إنشاء الفيديو' : 'Failed to generate video'));
      toast.error(userMsg);
    } finally {
      pollInFlightRef.current = false;
    }
  }, [language, loadQuota, loadLatestVideo]);

  const handleGenerate = async () => {
    // Validate based on mode
    if (generationMode === 'image_to_video' && !imagePreview) return;
    if (generationMode === 'text_to_video' && !prompt.trim()) return;
    if (generationMode === '2images_to_video' && !imagePreview) return;
    if (!user) return;

    const needsArabicTranslation =
      language === 'ar' &&
      hasArabicChars(prompt) &&
      (generationMode === 'text_to_video' ||
        (generationMode === 'image_to_video' && prompt.trim().length > 0));
    if (needsArabicTranslation) return;

    if (loadingQuota) {
      toast.message(language === 'ar' ? 'جاري التحقق من الحد...' : 'Checking quota...');
      return;
    }

    if (!quota) {
      await loadQuota();
      if (!quota) {
        toast.error(language === 'ar' ? 'تعذر تحميل الحد الشهري' : 'Failed to load quota');
        return;
      }
    }

    if (!quota.canGenerate) {
      toast.error(
        language === 'ar'
          ? 'لقد وصلت للحد الشهري من الفيديوهات'
          : 'You have reached your monthly AI video limit'
      );
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(5);
    setGeneratedVideoUrl(null);
    usageIncrementedRef.current = false;

    try {
      let requestBody: Record<string, unknown>;
      const endingDirective = language === 'ar'
        ? 'اختم بمشهد يهدأ تدريجياً مع تلاشي لطيف في النهاية.'
        : 'End with a smooth wind-down and a gentle fade-out.';
      const basePrompt = prompt.trim();
      const finalPrompt = basePrompt ? `${basePrompt}\n${endingDirective}` : endingDirective;

      if (generationMode === 'text_to_video') {
        // Text-to-Video: no image upload needed
        setGenerationStatus(language === 'ar' ? 'جاري بدء الإنشاء...' : 'Starting generation...');

        requestBody = {
          generation_type: 'text_to_video',
          prompt: finalPrompt,
          duration,
          aspect_ratio: aspectRatio,
          resolution,
          video_style_mode: videoStyleMode,
          mode: 'async',
        };
      } else if (generationMode === 'image_to_video') {
        // Image-to-Video: always compress + upload image to get a signed https URL
        setGenerationStatus(language === 'ar' ? 'جاري رفع الصورة...' : 'Uploading image...');
        let imageUrl = '';
        try {
          const randomId = Math.random().toString(36).substring(2, 15);
          const storagePath = `${user.id}/ai-video-input/${randomId}.jpg`;

          let sourceBlob: Blob;
          if (imageFile) {
            sourceBlob = await compressImage(imageFile, 1024, 0.7);
          } else if (imagePreview?.startsWith('data:')) {
            const previewBlob = await dataUrlToBlob(imagePreview);
            sourceBlob = await compressImage(new File([previewBlob], 'preview.jpg', { type: 'image/jpeg' }), 1024, 0.7);
          } else if (imagePreview?.startsWith('http')) {
            const fetchedBlob = await fetch(imagePreview).then(r => r.blob());
            sourceBlob = await compressImage(new File([fetchedBlob], 'saved.jpg', { type: fetchedBlob.type || 'image/jpeg' }), 1024, 0.7);
          } else {
            throw new Error('Missing image source');
          }

          console.log('[AIVideomaker] Uploading to message_attachments:', storagePath, 'size:', sourceBlob.size);

          const { error: uploadErr } = await supabase.storage
            .from('message_attachments')
            .upload(storagePath, sourceBlob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadErr) {
            console.error('[AIVideomaker] Storage upload error details:', uploadErr);
            throw new Error(`Upload failed: ${uploadErr.message}`);
          }

          const { data: signedData, error: signedErr } = await supabase.storage
            .from('message_attachments')
            .createSignedUrl(storagePath, 60 * 60 * 6);
          if (signedErr) throw new Error(`Signed URL failed: ${signedErr.message}`);
          if (!signedData?.signedUrl) throw new Error('Signed URL missing');
          imageUrl = signedData.signedUrl;
          setSourceImageUrl(imageUrl);
          setSourceImagePath(storagePath);
          console.log('[AIVideomaker] Upload successful, URL:', imageUrl);
        } catch (prepErr: any) {
          console.error('[AIVideomaker] Prepare image error:', prepErr);
          throw prepErr;
        }

        requestBody = {
          generation_type: 'image_to_video',
          image: imageUrl,
          prompt: finalPrompt,
          duration,
          aspect_ratio: aspectRatio,
          resolution,
          video_style_mode: videoStyleMode,
          mode: 'async',
        };
      } else if (generationMode === '2images_to_video') {
        setGenerationStatus(language === 'ar' ? 'جاري رفع الصور...' : 'Uploading images...');
        let imageUrl1 = '';

        try {
          const randomId1 = Math.random().toString(36).substring(2, 15);
          const storagePath1 = `${user.id}/ai-video-input/${randomId1}_1.jpg`;
          let sourceBlob1: Blob;
          if (imageFile) {
            sourceBlob1 = await compressImage(imageFile, 1024, 0.7);
          } else if (imagePreview?.startsWith('data:')) {
            const previewBlob = await dataUrlToBlob(imagePreview);
            sourceBlob1 = await compressImage(new File([previewBlob], 'preview1.jpg', { type: 'image/jpeg' }), 1024, 0.7);
          } else if (imagePreview?.startsWith('http')) {
            const fetchedBlob = await fetch(imagePreview).then(r => r.blob());
            sourceBlob1 = await compressImage(new File([fetchedBlob], 'saved1.jpg', { type: fetchedBlob.type || 'image/jpeg' }), 1024, 0.7);
          } else {
            throw new Error('Missing first image source');
          }
          const { error: uploadErr1 } = await supabase.storage
            .from('message_attachments')
            .upload(storagePath1, sourceBlob1, { contentType: 'image/jpeg', cacheControl: '3600', upsert: true });
          if (uploadErr1) throw new Error(`First image upload failed: ${uploadErr1.message}`);
          const { data: signedData1, error: signedErr1 } = await supabase.storage
            .from('message_attachments')
            .createSignedUrl(storagePath1, 60 * 60 * 6);
          if (signedErr1) throw new Error(`First image signed URL failed: ${signedErr1.message}`);
          if (!signedData1?.signedUrl) throw new Error('First image signed URL missing');
          imageUrl1 = signedData1.signedUrl;

          if (imagePreview2) {
            // Both images present — use Seedance 2images model
            const randomId2 = Math.random().toString(36).substring(2, 15);
            const storagePath2 = `${user.id}/ai-video-input/${randomId2}_2.jpg`;
            let sourceBlob2: Blob;
            if (imageFile2) {
              sourceBlob2 = await compressImage(imageFile2, 1024, 0.7);
            } else if (imagePreview2.startsWith('data:')) {
              const previewBlob = await dataUrlToBlob(imagePreview2);
              sourceBlob2 = await compressImage(new File([previewBlob], 'preview2.jpg', { type: 'image/jpeg' }), 1024, 0.7);
            } else if (imagePreview2.startsWith('http')) {
              const fetchedBlob = await fetch(imagePreview2).then(r => r.blob());
              sourceBlob2 = await compressImage(new File([fetchedBlob], 'saved2.jpg', { type: fetchedBlob.type || 'image/jpeg' }), 1024, 0.7);
            } else {
              throw new Error('Missing second image source');
            }
            const { error: uploadErr2 } = await supabase.storage
              .from('message_attachments')
              .upload(storagePath2, sourceBlob2, { contentType: 'image/jpeg', cacheControl: '3600', upsert: true });
            if (uploadErr2) throw new Error(`Second image upload failed: ${uploadErr2.message}`);
            const { data: signedData2, error: signedErr2 } = await supabase.storage
              .from('message_attachments')
              .createSignedUrl(storagePath2, 60 * 60 * 6);
            if (signedErr2) throw new Error(`Second image signed URL failed: ${signedErr2.message}`);
            if (!signedData2?.signedUrl) throw new Error('Second image signed URL missing');
            const imageUrl2 = signedData2.signedUrl;

            requestBody = {
              generation_type: '2images_to_video',
              image1: imageUrl1,
              image2: imageUrl2,
              prompt: finalPrompt,
              duration,
              aspect_ratio: aspectRatio,
              resolution,
              mode: 'async',
            };
          } else {
            // Only one image — fall back to grok image_to_video
            requestBody = {
              generation_type: 'image_to_video',
              image: imageUrl1,
              prompt: finalPrompt,
              duration,
              aspect_ratio: aspectRatio,
              resolution,
              video_style_mode: videoStyleMode,
              mode: 'async',
            };
          }
        } catch (prepErr: any) {
          console.error('[AIVideomaker] Prepare images error:', prepErr);
          throw prepErr;
        }
      }

      setGenerationProgress(10);
      setGenerationStatus(language === 'ar' ? 'جاري بدء الإنشاء...' : 'Starting generation...');

      // Call edge function
      const { data, error } = await supabase.functions.invoke('freepik-image2video', {
        body: requestBody,
      });

      if (error) {
        throw new Error(error.message || 'Failed to start video generation');
      }

      if (data?.error === 'TRIAL_LIMIT_REACHED') {
        window.dispatchEvent(new CustomEvent('wakti-trial-limit-reached', { detail: { feature: data?.feature || 'i2v' } }));
        setIsGenerating(false);
        setGenerationProgress(0);
        setGenerationStatus('');
        return;
      }

      if (!data?.ok || !data?.task_id) {
        throw new Error(data?.error || 'Failed to create video task');
      }

      const tid = data.task_id;
      setTaskId(tid);
      setGenerationProgress(15);
      setGenerationStatus(language === 'ar' ? 'جاري إنشاء الفيديو...' : 'Generating video...');

      // Start polling every 5 seconds
      pollIntervalRef.current = setInterval(() => {
        pollTaskStatus(tid);
      }, 5000);

      // Also poll immediately after a short delay
      setTimeout(() => pollTaskStatus(tid), 3000);

    } catch (e: any) {
      console.error('AI Video generation error:', e);
      toast.error(e?.message || (language === 'ar' ? 'فشل إنشاء الفيديو' : 'Failed to generate video'));
      setIsGenerating(false);
      setGenerationProgress(0);
      setGenerationStatus('');
    }
  };

  const handleDownload = async () => {
    if (!generatedVideoUrl) return;
    try {
      const response = await fetch(generatedVideoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wakti-ai-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
      window.open(generatedVideoUrl, '_blank');
    }
  };

  const handleShare = async () => {
    if (!generatedVideoUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Wakti AI Video',
          url: generatedVideoUrl,
        });
      } else {
        await navigator.clipboard.writeText(generatedVideoUrl);
        toast.success(language === 'ar' ? 'تم نسخ الرابط' : 'Link copied');
      }
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  const handleSaveToMyVideos = async () => {
    if (!generatedVideoUrl || !user || isSaved) return;
    setIsSaving(true);
    try {
      const { data: importData, error: importError } = await supabase.functions.invoke('import-external-video', {
        body: {
          sourceUrl: generatedVideoUrl,
          filenameHint: prompt.trim().slice(0, 40) || 'ai-video',
        },
      });
      if (importError) throw importError;
      const storagePath = importData?.storagePath as string | undefined;
      if (!storagePath) {
        throw new Error(importData?.error || 'Failed to save video');
      }

      // Generate a clean short title from the prompt
      const generateTitle = (raw: string): string => {
        if (!raw || !raw.trim()) return 'AI Video';
        let t = raw.trim();
        // Strip JSON-like prefixes
        t = t.replace(/^\{?\s*"?description"?\s*:\s*"?/i, '');
        // Strip leading "Style:", "Camera:", etc labels if that's all we have
        t = t.replace(/^(Style|Camera|Lighting|Environment|Elements|Motion|Ending|Keywords):\s*/i, '');
        // Take first sentence or up to 60 chars
        const sentenceEnd = t.search(/[.!?]/);
        if (sentenceEnd > 0 && sentenceEnd <= 80) {
          t = t.slice(0, sentenceEnd + 1);
        } else {
          t = t.slice(0, 60);
          // Don't cut mid-word
          const lastSpace = t.lastIndexOf(' ');
          if (lastSpace > 30) t = t.slice(0, lastSpace);
        }
        // Clean up trailing quotes/braces
        t = t.replace(/["{}]+$/g, '').trim();
        return t || 'AI Video';
      };

      // Save into unified user_videos table
      const { error } = await (supabase as any).from('user_videos').insert({
        user_id: user.id,
        title: generateTitle(prompt),
        description: prompt.trim() || null,
        storage_path: storagePath,
        video_url: null,
        thumbnail_url: generationMode === 'image_to_video'
          ? (sourceImagePath || sourceImageUrl || null)
          : null,
        duration_seconds: parseInt(duration, 10),
        aspect_ratio: aspectRatio,
        style_template: 'ai',
        is_public: false,
      });

      if (error) throw error;

      setIsSaved(true);
      toast.success(language === 'ar' ? 'تم الحفظ في فيديوهاتي!' : 'Saved to My Videos!');
      await loadLatestVideo();
      // Navigate to My AI Videos tab after successful save
      if (onSaveSuccess) {
        setTimeout(() => onSaveSuccess(), 1000);
      }
    } catch (e: any) {
      console.error('Save failed:', e);
      toast.error(language === 'ar' ? 'فشل الحفظ' : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const remaining = quota ? quota.limit - quota.used + quota.extra : 60;
  const used = quota?.used || 0;
  const limit = quota?.limit || 60;
  const limitReached = quota !== null && !quota.canGenerate;

  const needsArabicTranslation =
    language === 'ar' &&
    hasArabicChars(prompt) &&
    (generationMode === 'text_to_video' ||
      (generationMode === 'image_to_video' && prompt.trim().length > 0));

  const canGenerate = generationMode === 'text_to_video'
    ? (prompt.trim().length > 0 && !needsArabicTranslation && !limitReached && !isGenerating && !loadingQuota)
    : generationMode === 'image_to_video'
    ? (imagePreview && !needsArabicTranslation && !limitReached && !isGenerating && !loadingQuota)
    : generationMode === '2images_to_video'
    ? (imagePreview && !needsArabicTranslation && !limitReached && !isGenerating && !loadingQuota)
    : false;
  const showLatestVideo = !generatedVideoUrl && !!(latestVideo?.signedUrl || latestVideo?.video_url);

  return (
    <div className="relative">
      {/* Glowing background effects */}
      <div className="pointer-events-none absolute -inset-4 rounded-[2rem] opacity-40 blur-3xl bg-gradient-to-br from-[hsl(210,100%,65%)] via-[hsl(180,85%,60%)] to-[hsl(160,80%,55%)] dark:opacity-20" />
      
      {/* Main card container */}
      <div className="relative enhanced-card rounded-[1.5rem] p-5 md:p-6 overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9ImN1cnJlbnRDb2xvciIgZmlsbC1vcGFjaXR5PSIwLjAyIj48cGF0aCBkPSJNMjAgMjBjMC0xMSA5LTIwIDIwLTIwdjQwYy0xMSAwLTIwLTktMjAtMjB6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        
        <div className="relative space-y-5">
          {/* Compact header row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#060541] to-[hsl(210,100%,35%)] shadow-lg shadow-primary/30">
                <Wand2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold bg-gradient-to-r from-[#060541] to-[hsl(210,100%,45%)] dark:from-white dark:to-[hsl(210,100%,75%)] bg-clip-text text-transparent">
                  {language === 'ar' ? 'صانع الفيديو بالذكاء الاصطناعي' : 'AI Video Generator'}
                </h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-full border border-primary/20 overflow-hidden">
                <Clock className="h-3.5 w-3.5 text-primary ml-2.5" />
                {generationMode === '2images_to_video' ? (
                  <>
                    <button
                      onClick={() => !isGenerating && setDuration('4')}
                      disabled={isGenerating}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-all ${
                        duration === '4'
                          ? 'bg-gradient-to-r from-[hsl(210,100%,65%)]/30 to-[hsl(180,85%,60%)]/25 text-primary font-bold'
                          : 'text-muted-foreground hover:text-primary'
                      }`}
                    >
                      {language === 'ar' ? '4 ث' : '4s'}
                    </button>
                    <button
                      onClick={() => !isGenerating && setDuration('8')}
                      disabled={isGenerating}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-all ${
                        duration === '8'
                          ? 'bg-gradient-to-r from-[hsl(210,100%,65%)]/30 to-[hsl(180,85%,60%)]/25 text-primary font-bold'
                          : 'text-muted-foreground hover:text-primary'
                      }`}
                    >
                      {language === 'ar' ? '8 ث' : '8s'}
                    </button>
                    <button
                      onClick={() => !isGenerating && !(resolution === '720p') && setDuration('12')}
                      disabled={isGenerating || resolution === '720p'}
                      title={resolution === '720p' ? (language === 'ar' ? 'غير متاح في 720p' : 'Not available at 720p') : undefined}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-all mr-0.5 ${
                        duration === '12'
                          ? 'bg-gradient-to-r from-[hsl(210,100%,65%)]/30 to-[hsl(180,85%,60%)]/25 text-primary font-bold'
                          : resolution === '720p'
                            ? 'text-muted-foreground/30 cursor-not-allowed'
                            : 'text-muted-foreground hover:text-primary'
                      }`}
                    >
                      {language === 'ar' ? '12 ث' : '12s'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => !isGenerating && setDuration('6')}
                      disabled={isGenerating}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-all ${
                        duration === '6'
                          ? 'bg-gradient-to-r from-[hsl(210,100%,65%)]/30 to-[hsl(180,85%,60%)]/25 text-primary font-bold'
                          : 'text-muted-foreground hover:text-primary'
                      }`}
                    >
                      {language === 'ar' ? '6 ث' : '6s'}
                    </button>
                    <button
                      onClick={() => !isGenerating && setDuration('10')}
                      disabled={isGenerating}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-all ${
                        duration === '10'
                          ? 'bg-gradient-to-r from-[hsl(210,100%,65%)]/30 to-[hsl(180,85%,60%)]/25 text-primary font-bold'
                          : 'text-muted-foreground hover:text-primary'
                      }`}
                    >
                      {language === 'ar' ? '10 ث' : '10s'}
                    </button>
                    <button
                      onClick={() => !isGenerating && setDuration('15')}
                      disabled={isGenerating}
                      title={undefined}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-all mr-0.5 ${
                        duration === '15'
                          ? 'bg-gradient-to-r from-[hsl(25,95%,60%)]/30 to-[hsl(45,100%,60%)]/25 text-orange-500 font-bold'
                          : 'text-muted-foreground hover:text-primary'
                      }`}
                    >
                      {language === 'ar' ? '15 ث' : '15s'}
                    </button>
                  </>
                )}
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${limitReached ? 'bg-red-500/20 border-red-500/30' : 'bg-gradient-to-r from-[hsl(142,76%,55%)]/20 to-[hsl(160,80%,55%)]/20 border-green-500/20'}`}>
                <Sparkles className={`h-3.5 w-3.5 ${limitReached ? 'text-red-500' : 'text-green-500'}`} />
                {loadingQuota ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-green-500" />
                ) : (
                  <span className={`text-xs font-bold ${limitReached ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{used}/{limit}</span>
                )}
              </div>
            </div>
          </div>

          {/* Mode toggle */}
          <div
            className={`inline-flex max-w-full flex-wrap items-center rounded-2xl border border-primary/20 bg-background/40 backdrop-blur-sm p-1 shadow-sm shadow-primary/10 ${
              isGenerating ? 'opacity-80' : ''
            }`}
            role="group"
            aria-label={language === 'ar' ? 'وضع إنشاء الفيديو' : 'Video generation mode'}
          >
            <button
              type="button"
              onClick={() => {
                if (!isGenerating) setGenerationMode('image_to_video');
              }}
              disabled={isGenerating}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
                generationMode === 'image_to_video'
                  ? 'bg-gradient-to-r from-[#060541] via-[hsl(210,100%,32%)] to-[#060541] text-white shadow-[0_6px_18px_hsla(210,100%,45%,0.25)]'
                  : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
              }`}
            >
              <span
                className={`grid place-items-center h-6 w-6 rounded-lg ${
                  generationMode === 'image_to_video' ? 'bg-white/15' : 'bg-primary/5'
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </span>
              <span>{language === 'ar' ? 'صورة ← فيديو' : 'Image → Video'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isGenerating) setGenerationMode('text_to_video');
              }}
              disabled={isGenerating}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
                generationMode === 'text_to_video'
                  ? 'bg-gradient-to-r from-[#060541] via-[hsl(210,100%,32%)] to-[#060541] text-white shadow-[0_6px_18px_hsla(210,100%,45%,0.25)]'
                  : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
              }`}
            >
              <span
                className={`grid place-items-center h-6 w-6 rounded-lg ${
                  generationMode === 'text_to_video' ? 'bg-white/15' : 'bg-primary/5'
                }`}
              >
                <Type className="h-3.5 w-3.5" />
              </span>
              <span>{language === 'ar' ? 'نص ← فيديو' : 'Text → Video'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isGenerating) setGenerationMode('2images_to_video');
              }}
              disabled={isGenerating}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
                generationMode === '2images_to_video'
                  ? 'bg-gradient-to-r from-[#060541] via-[hsl(210,100%,32%)] to-[#060541] text-white shadow-[0_6px_18px_hsla(210,100%,45%,0.25)]'
                  : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
              }`}
            >
              <span
                className={`grid place-items-center h-6 w-6 rounded-lg ${
                  generationMode === '2images_to_video' ? 'bg-white/15' : 'bg-primary/5'
                }`}
              >
                <Images className="h-3.5 w-3.5" />
              </span>
              <span>{language === 'ar' ? 'صورتان ← فيديو' : '2Images → Video'}</span>
            </button>
          </div>

          {/* Unified content area */}
          <div className={`grid grid-cols-1 ${generationMode === 'image_to_video' ? 'xl:grid-cols-[280px_1fr]' : generationMode === '2images_to_video' ? 'xl:grid-cols-[560px_1fr]' : ''} gap-4 items-start`}>
            {/* Single image upload - only shown in image_to_video mode */}
            {generationMode === 'image_to_video' && (
              <div className="relative">
                {!imagePreview ? (
                  <div className="h-full min-h-[200px] flex flex-col gap-2">
                    {/* Upload from device */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="relative cursor-pointer group flex-1"
                    >
                      <div className="h-full rounded-2xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-[hsl(210,100%,65%)]/5 via-[hsl(180,85%,60%)]/5 to-[hsl(160,80%,55%)]/5 flex flex-col items-center justify-center gap-2 transition-all hover:border-primary hover:shadow-[0_0_30px_hsla(210,100%,65%,0.3)] active:scale-[0.98]">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-[#060541] to-[hsl(210,100%,35%)] shadow-lg shadow-primary/40 group-hover:shadow-xl group-hover:shadow-primary/50 transition-all group-hover:scale-105">
                          <Upload className="h-6 w-6 text-white" />
                        </div>
                        <div className="text-center px-3">
                          <p className="font-semibold text-sm">
                            {language === 'ar' ? 'رفع صورة' : 'Upload Image'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {language === 'ar' ? 'PNG, JPG • 10MB' : 'PNG, JPG • 10MB'}
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Pick from saved images */}
                    <div
                      onClick={() => { setShowSavedPicker(true); fetchSavedImages(); }}
                      className="relative cursor-pointer group"
                    >
                      <div className="rounded-2xl border-2 border-dashed border-orange-400/40 bg-gradient-to-br from-orange-500/5 via-amber-500/5 to-orange-400/5 flex items-center justify-center gap-2.5 py-3 px-4 transition-all hover:border-orange-500 hover:shadow-[0_0_30px_hsla(25,95%,60%,0.3)] active:scale-[0.98]">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/30 group-hover:shadow-xl group-hover:shadow-orange-500/40 transition-all group-hover:scale-105">
                          <GalleryHorizontalEnd className="h-4 w-4 text-white" />
                        </div>
                        <p className="font-semibold text-sm">
                          {language === 'ar' ? 'اختر من المحفوظات' : 'Pick from Saved'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative h-full min-h-[200px]">
                    <div className="h-full rounded-2xl overflow-hidden bg-black/90 shadow-2xl shadow-black/50 ring-2 ring-primary/30">
                      <img
                        src={imagePreview}
                        alt="Selected"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    {/* Always visible X button */}
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg bg-red-500 hover:bg-red-600"
                      onClick={clearImage}
                      disabled={isGenerating}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    {/* Change button at bottom */}
                    <div className="absolute bottom-2 left-2 right-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full h-8 text-xs bg-white/90 hover:bg-white text-black rounded-lg shadow-lg"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isGenerating}
                      >
                        {language === 'ar' ? 'تغيير الصورة' : 'Change Image'}
                      </Button>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                  aria-label={language === 'ar' ? 'اختر صورة' : 'Select image'}
                />
              </div>
            )}

            {/* Dual image upload - only shown in 2images_to_video mode */}
            {generationMode === '2images_to_video' && (
              <div className="relative grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* First Image */}
                <div className="relative">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-[hsl(210,100%,65%)]/20 to-[hsl(180,85%,60%)]/20 border border-[hsl(210,100%,65%)]/30 text-[hsl(210,100%,65%)]">
                      <span>▶</span> {language === 'ar' ? 'إطار البداية' : 'Start Frame'}
                    </span>
                  </div>
                  {!imagePreview ? (
                    <div className="h-full min-h-[180px] flex flex-col gap-2">
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="relative cursor-pointer group flex-1"
                      >
                        <div className="h-full rounded-2xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-[hsl(210,100%,65%)]/5 via-[hsl(180,85%,60%)]/5 to-[hsl(160,80%,55%)]/5 flex flex-col items-center justify-center gap-2 transition-all hover:border-primary hover:shadow-[0_0_30px_hsla(210,100%,65%,0.3)] active:scale-[0.98]">
                          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#060541] to-[hsl(210,100%,35%)] shadow-lg shadow-primary/40 group-hover:shadow-xl group-hover:shadow-primary/50 transition-all group-hover:scale-105">
                            <Upload className="h-5 w-5 text-white" />
                          </div>
                          <div className="text-center px-2">
                            <p className="font-semibold text-xs">
                              {language === 'ar' ? 'صورة البداية' : 'Start Image'}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {language === 'ar' ? 'PNG, JPG' : 'PNG, JPG'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div
                        onClick={() => { setPickingForSlot(1); setShowSavedPicker(true); fetchSavedImages(); }}
                        className="relative cursor-pointer group"
                      >
                        <div className="rounded-xl border-2 border-dashed border-orange-400/40 bg-gradient-to-br from-orange-500/5 via-amber-500/5 to-orange-400/5 flex items-center justify-center gap-2 py-2 px-3 transition-all hover:border-orange-500 hover:shadow-[0_0_20px_hsla(25,95%,60%,0.3)] active:scale-[0.98]">
                          <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/30 group-hover:shadow-xl group-hover:shadow-orange-500/40 transition-all group-hover:scale-105">
                            <GalleryHorizontalEnd className="h-3 w-3 text-white" />
                          </div>
                          <p className="font-semibold text-xs">
                            {language === 'ar' ? 'من المحفوظات' : 'From Saved'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-full min-h-[180px]">
                      <div className="h-full rounded-2xl overflow-hidden bg-black/90 shadow-2xl shadow-black/50 ring-2 ring-primary/30">
                        <img
                          src={imagePreview}
                          alt="First"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 rounded-full shadow-lg bg-red-500 hover:bg-red-600"
                        onClick={clearImage}
                        disabled={isGenerating}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <div className="absolute bottom-2 left-2 right-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full h-7 text-xs bg-white/90 hover:bg-white text-black rounded-lg shadow-lg"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isGenerating}
                        >
                          {language === 'ar' ? 'تغيير' : 'Change'}
                        </Button>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                    aria-label={language === 'ar' ? 'اختر الصورة الأولى' : 'Select first image'}
                  />
                </div>

                {/* Second Image */}
                <div className="relative">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-[hsl(280,70%,65%)]/20 to-[hsl(320,75%,70%)]/20 border border-[hsl(280,70%,65%)]/30 text-[hsl(280,70%,65%)]">
                      <span>⏹</span> {language === 'ar' ? 'إطار النهاية (اختياري)' : 'End Frame (optional)'}
                    </span>
                  </div>
                  {!imagePreview2 ? (
                    <div className="h-full min-h-[180px] flex flex-col gap-2">
                      <div
                        onClick={() => fileInputRef2.current?.click()}
                        className="relative cursor-pointer group flex-1"
                      >
                        <div className="h-full rounded-2xl border-2 border-dashed border-purple-400/40 bg-gradient-to-br from-[hsl(280,70%,65%)]/5 via-[hsl(320,75%,70%)]/5 to-[hsl(280,60%,75%)]/5 flex flex-col items-center justify-center gap-2 transition-all hover:border-purple-500 hover:shadow-[0_0_30px_hsla(280,70%,65%,0.3)] active:scale-[0.98]">
                          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 shadow-lg shadow-purple-500/40 group-hover:shadow-xl group-hover:shadow-purple-500/50 transition-all group-hover:scale-105">
                            <Upload className="h-5 w-5 text-white" />
                          </div>
                          <div className="text-center px-2">
                            <p className="font-semibold text-xs">
                              {language === 'ar' ? 'صورة النهاية' : 'End Image'}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {language === 'ar' ? 'PNG, JPG' : 'PNG, JPG'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div
                        onClick={() => { setPickingForSlot(2); setShowSavedPicker(true); fetchSavedImages(); }}
                        className="relative cursor-pointer group"
                      >
                        <div className="rounded-xl border-2 border-dashed border-orange-400/40 bg-gradient-to-br from-orange-500/5 via-amber-500/5 to-orange-400/5 flex items-center justify-center gap-2 py-2 px-3 transition-all hover:border-orange-500 hover:shadow-[0_0_20px_hsla(25,95%,60%,0.3)] active:scale-[0.98]">
                          <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/30 group-hover:shadow-xl group-hover:shadow-orange-500/40 transition-all group-hover:scale-105">
                            <GalleryHorizontalEnd className="h-3 w-3 text-white" />
                          </div>
                          <p className="font-semibold text-xs">
                            {language === 'ar' ? 'من المحفوظات' : 'From Saved'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-full min-h-[180px]">
                      <div className="h-full rounded-2xl overflow-hidden bg-black/90 shadow-2xl shadow-black/50 ring-2 ring-purple-500/30">
                        <img
                          src={imagePreview2}
                          alt="Second"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 rounded-full shadow-lg bg-red-500 hover:bg-red-600"
                        onClick={clearImage2}
                        disabled={isGenerating}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <div className="absolute bottom-2 left-2 right-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full h-7 text-xs bg-white/90 hover:bg-white text-black rounded-lg shadow-lg"
                          onClick={() => fileInputRef2.current?.click()}
                          disabled={isGenerating}
                        >
                          {language === 'ar' ? 'تغيير' : 'Change'}
                        </Button>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef2}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect2}
                    aria-label={language === 'ar' ? 'اختر الصورة الثانية' : 'Select second image'}
                  />
                </div>
              </div>
            )}

            {/* Prompt & Generate */}
            <div className="flex flex-col gap-3 relative">
              {/* Limit reached overlay */}
              {limitReached && (
                <div className="absolute inset-0 z-10 rounded-xl bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                  <div className="p-3 rounded-full bg-red-500/20">
                    <Lock className="h-8 w-8 text-red-400" />
                  </div>
                  <p className="text-white font-semibold text-center px-4">
                    {language === 'ar' ? 'انتهت الفيديوهات الشهرية' : 'Monthly limit reached'}
                  </p>
                  <p className="text-white/60 text-xs text-center px-4">
                    {language === 'ar' ? `استخدمت ${used}/${limit} فيديو هذا الشهر` : `Used ${used}/${limit} videos this month`}
                  </p>
                </div>
              )}

              {/* Prompt textarea */}
              <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  {needsArabicTranslation && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-[#060541]">
                      <span>{language === 'ar' ? 'اضغط لترجمة العربية' : 'Click to translate Arabic'}</span>
                      {language === 'ar' ? (
                        <ArrowLeft className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5" />
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleAmp}
                    disabled={isAmping || isGenerating || !(
                      generationMode === 'image_to_video' ? imagePreview :
                      generationMode === '2images_to_video' ? (imagePreview && imagePreview2) :
                      prompt.trim()
                    )}
                    style={(!isAmping && !isGenerating && (
                      generationMode === 'image_to_video' ? !!imagePreview :
                      generationMode === '2images_to_video' ? !!(imagePreview && imagePreview2) :
                      !!prompt.trim()
                    )) ? {
                      animation: 'amp-alive 1.4s ease-in-out infinite',
                    } : undefined}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold rounded-full transition-colors duration-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none border ${
                      isAmping
                        ? 'bg-gradient-to-r from-violet-500/50 to-fuchsia-500/50 text-white dark:text-white border-violet-400/60'
                        : needsArabicTranslation
                          ? 'bg-gradient-to-r from-amber-500/30 to-orange-500/30 text-amber-900 dark:text-amber-200 border-amber-400/50'
                          : 'bg-gradient-to-r from-violet-600/30 to-fuchsia-600/30 text-violet-900 dark:text-violet-200 border-violet-500/40'
                    }`}
                    title={
                      needsArabicTranslation
                        ? (language === 'ar' ? 'اضغط لترجمة العربية' : 'Click to translate Arabic')
                        : (language === 'ar' ? 'تعزيز الوصف بالذكاء الاصطناعي' : 'Amp: enhance prompt with AI')
                    }
                  >
                    <Wand2 className={`h-3.5 w-3.5 ${isAmping ? 'animate-spin' : ''}`} />
                    <span>{isAmping ? (language === 'ar' ? 'جاري التعزيز...' : 'Amping...') : (language === 'ar' ? '✦ تعزيز' : '✦ Amp')}</span>
                  </button>
                  {/* Small tag appears when button is active */}
                  {!isAmping && !isGenerating && (
                    generationMode === 'image_to_video' ? !!imagePreview :
                    generationMode === '2images_to_video' ? !!(imagePreview && imagePreview2) :
                    !!prompt.trim()
                  ) && (
                    <span className="text-[9px] text-muted-foreground/60 px-1">
                      {language === 'ar' ? 'اضغط لتحسين الوصف' : 'press to improve prompt'}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground/50 sm:self-auto">{prompt.length}/2500</span>
              </div>
              <div className="relative flex-1">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    generationMode === 'text_to_video'
                      ? (language === 'ar'
                          ? 'صف المشهد والحركة بالتفصيل...\n\nمثال: أبواب تفتح واحدًا تلو الآخر لتكشف غرفًا مختلفة بداخلها أشخاص صغار يعيشون حياتهم...'
                          : 'Describe the full scene and motion in detail...\n\ne.g., Doors open one by one to reveal different rooms with tiny people living inside...')
                      : (language === 'ar'
                          ? 'صف الحركة المطلوبة...\n\nمثال: شخص يبتسم ويلوح بيده، قطة تحرك رأسها ببطء، سيارة تتحرك للأمام...'
                          : 'Describe the motion you want...\n\ne.g., A person smiling and waving, a cat slowly moving its head, a car driving forward...')
                  }
                  className="min-h-[140px] h-full text-sm resize-none rounded-xl border-2 border-primary/20 focus:border-primary bg-background/50 backdrop-blur-sm transition-all placeholder:text-muted-foreground/60"
                  maxLength={2500}
                  disabled={isGenerating || limitReached}
                />
              </div>

              {/* Aspect ratio + Resolution pickers */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/50">
                    <button
                      onClick={() => !isGenerating && setAspectRatio('9:16')}
                      disabled={isGenerating}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        aspectRatio === '9:16'
                          ? 'bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(260,70%,65%)] text-white shadow-md shadow-blue-500/30 scale-[1.02]'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                      }`}
                    >
                      <span className="text-[11px] opacity-80">▮</span>
                      {language === 'ar' ? 'عمودي' : 'Portrait'}
                    </button>
                    <button
                      onClick={() => !isGenerating && setAspectRatio('16:9')}
                      disabled={isGenerating}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        aspectRatio === '16:9'
                          ? 'bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(260,70%,65%)] text-white shadow-md shadow-blue-500/30 scale-[1.02]'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                      }`}
                    >
                      <span className="text-[11px] opacity-80">▬</span>
                      {language === 'ar' ? 'أفقي' : 'Landscape'}
                    </button>
                  </div>

                {/* Resolution picker - all modes */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/50">
                  <button
                    onClick={() => {
                      if (!isGenerating) setResolution('480p');
                    }}
                    disabled={isGenerating}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      resolution === '480p'
                        ? 'bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(260,70%,65%)] text-white shadow-md shadow-blue-500/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                    }`}
                  >
                    480p
                  </button>
                  <button
                    onClick={() => {
                      if (!isGenerating) {
                        setResolution('720p');
                        if (duration === '12') setDuration('8');
                      }
                    }}
                    disabled={isGenerating}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      resolution === '720p'
                        ? 'bg-gradient-to-r from-[hsl(25,95%,60%)] to-[hsl(45,100%,60%)] text-white shadow-md shadow-orange-500/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                    }`}
                  >
                    720p
                  </button>
                </div>
                {(generationMode === 'image_to_video' || generationMode === 'text_to_video') && (
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/50">
                    <button
                      onClick={() => !isGenerating && setVideoStyleMode('normal')}
                      disabled={isGenerating}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        videoStyleMode === 'normal'
                          ? 'bg-gradient-to-r from-[#060541] to-[hsl(210,100%,45%)] text-white shadow-md shadow-blue-500/30'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                      }`}
                    >
                      {language === 'ar' ? 'عادي' : 'Normal'}
                    </button>
                    <button
                      onClick={() => !isGenerating && setVideoStyleMode('fun')}
                      disabled={isGenerating}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        videoStyleMode === 'fun'
                          ? 'bg-gradient-to-r from-[hsl(25,95%,60%)] to-[hsl(320,75%,70%)] text-white shadow-md shadow-orange-500/30'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                      }`}
                    >
                      {language === 'ar' ? 'مرح' : 'Fun'}
                    </button>
                  </div>
                )}
              </div>


              {/* Generate button */}
              <Button
                className="w-full h-12 text-base font-bold rounded-xl bg-[#060541] text-white border border-white/10 shadow-[0_10px_28px_rgba(6,5,65,0.35)] hover:bg-[hsl(243,84%,18%)] hover:shadow-[0_14px_34px_hsla(210,100%,65%,0.25)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
                onClick={handleGenerate}
                disabled={!canGenerate}
              >
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{generationStatus || (language === 'ar' ? 'جاري الإنشاء...' : 'Generating...')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5" />
                    <span>{language === 'ar' ? 'إنشاء الفيديو ✨' : 'Generate Video ✨'}</span>
                  </div>
                )}
              </Button>

              {/* Progress bar during generation */}
              {isGenerating && (
                <div className="space-y-2">
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[hsl(210,100%,65%)] via-[hsl(180,85%,60%)] to-[hsl(160,80%,55%)] transition-all duration-500 ease-out"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{generationStatus}</span>
                    <span className="font-medium text-primary">{generationProgress}%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 text-center">
                    {language === 'ar' ? 'قد يستغرق الأمر 1-3 دقائق...' : 'This may take 1-3 minutes...'}
                  </p>
                </div>
              )}

              {/* Status messages */}
              {!isGenerating && !limitReached && (
                generationMode === 'image_to_video' ? (
                  !imagePreview && (
                    <p className="text-center text-xs text-muted-foreground">
                      {language === 'ar' ? '← اختر صورة للبدء' : '← Select an image to start'}
                    </p>
                  )
                ) : (
                  !prompt.trim() && (
                    <p className="text-center text-xs text-muted-foreground">
                      {language === 'ar' ? '← اكتب وصفاً للبدء' : '← Write a prompt to start'}
                    </p>
                  )
                )
              )}
            </div>
          </div>

          {/* Generated video result - Mobile optimized, full width */}
          {generatedVideoUrl && (
            <div className="rounded-2xl overflow-hidden border-2 border-green-500/50 shadow-[0_0_60px_hsla(142,76%,55%,0.4)] bg-gradient-to-b from-green-500/5 to-transparent">
              {/* Video player - Full width, prominent */}
              <div className="relative bg-black">
                <video
                  src={generatedVideoUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full aspect-[9/16] max-h-[70vh] object-contain"
                />
                {/* Floating badge */}
                <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-green-500 text-white text-xs font-bold shadow-lg animate-pulse">
                  {language === 'ar' ? '🎉 جاهز!' : '🎉 Ready!'}
                </div>
              </div>
              
              {/* Action buttons - Mobile friendly, large touch targets */}
              <div className="p-4 space-y-3">
                <p className="text-center text-sm font-medium text-green-600 dark:text-green-400">
                  {language === 'ar' ? 'تم إنشاء الفيديو بنجاح!' : 'Video generated successfully!'}
                </p>
                
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    className={`h-12 flex-col gap-1 rounded-xl ${
                      isSaved 
                        ? 'bg-green-500 hover:bg-green-600 text-white' 
                        : 'bg-green-500/20 hover:bg-green-500/30 text-green-700 dark:text-green-300'
                    }`}
                    onClick={handleSaveToMyVideos}
                    disabled={isSaving || isSaved}
                  >
                    {isSaving ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isSaved ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Save className="h-5 w-5" />
                    )}
                    <span className="text-[10px] font-medium">
                      {isSaved ? (language === 'ar' ? 'تم!' : 'Saved!') : (language === 'ar' ? 'حفظ' : 'Save')}
                    </span>
                  </Button>
                  
                  <Button 
                    className="h-12 flex-col gap-1 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-700 dark:text-blue-300"
                    onClick={handleDownload}
                  >
                    <Download className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{language === 'ar' ? 'تحميل' : 'Download'}</span>
                  </Button>
                  
                  <Button 
                    className="h-12 flex-col gap-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-800 dark:text-cyan-300"
                    onClick={handleShare}
                  >
                    <Share2 className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{language === 'ar' ? 'مشاركة' : 'Share'}</span>
                  </Button>
                </div>
                
                {/* Instagram */}
                <InstagramPublishButton
                  mediaUrl={generatedVideoUrl}
                  mediaType="reel"
                  publishTarget="reel"
                  defaultCaption={prompt || ''}
                  language={language as 'en' | 'ar'}
                />

                {/* Create another button */}
                <Button 
                  variant="outline" 
                  className="w-full h-10 rounded-xl text-sm"
                  onClick={() => {
                    setGeneratedVideoUrl(null);
                    setIsSaved(false);
                    clearImage();
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'إنشاء فيديو جديد' : 'Create Another Video'}
                </Button>
              </div>
            </div>
          )}

          {showLatestVideo && (
            <div className="rounded-2xl overflow-hidden" style={{background: 'linear-gradient(135deg, hsl(235,25%,8%) 0%, hsl(250,20%,10%) 100%)', border: '1px solid hsla(210,100%,65%,0.2)', boxShadow: '0 4px 32px hsla(0,0%,0%,0.4), 0 0 0 1px hsla(210,100%,65%,0.08)'}}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(260,70%,65%)] shadow-[0_0_6px_hsla(210,100%,65%,0.8)]" />
                  <span className="text-xs font-bold text-white/80 tracking-wide uppercase">
                    {language === 'ar' ? 'آخر فيديو' : 'Latest Video'}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                  {language === 'ar' ? 'محفوظ' : 'Saved'}
                </span>
              </div>
              <div className="relative bg-black">
                <video
                  src={latestVideo?.signedUrl || latestVideo?.video_url || undefined}
                  controls
                  playsInline
                  className="w-full aspect-[9/16] max-h-[60vh] object-contain"
                />
              </div>
              <div className="p-3 flex items-center gap-2">
                  <Button
                    className="flex-1 h-10 gap-2 rounded-xl bg-gradient-to-r from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30 text-blue-300 border border-blue-500/20 text-xs font-semibold"
                    onClick={handleDownloadLatest}
                  >
                    <Download className="h-4 w-4" />
                    {language === 'ar' ? 'تحميل' : 'Download'}
                  </Button>
                  <Button
                    className="flex-1 h-10 gap-2 rounded-xl bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 hover:from-violet-500/30 hover:to-fuchsia-500/30 text-violet-300 border border-violet-500/20 text-xs font-semibold"
                    onClick={() => onSaveSuccess?.()}
                  >
                    <FolderOpen className="h-4 w-4" />
                    {language === 'ar' ? 'المحفوظات' : 'My Videos'}
                  </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Saved Images Picker Modal */}
      {showSavedPicker && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowSavedPicker(false)}
        >
          <div
            className="relative w-full max-w-lg max-h-[80vh] bg-background rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <GalleryHorizontalEnd className="h-5 w-5 text-orange-500" />
                <h3 className="font-bold text-sm">
                  {language === 'ar' ? 'اختر من صورك المحفوظة' : 'Pick from Saved Images'}
                </h3>
              </div>
              <button
                onClick={() => setShowSavedPicker(false)}
                className="p-1.5 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Image grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {loadingSaved ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                </div>
              ) : savedImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                  <ImageIcon className="h-10 w-10 opacity-40" />
                  <p className="text-sm font-medium">
                    {language === 'ar' ? 'لا توجد صور محفوظة بعد' : 'No saved images yet'}
                  </p>
                  <p className="text-xs">
                    {language === 'ar' ? 'أنشئ صوراً في تبويب الصور أولاً' : 'Generate images in the Image tab first'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {savedImages.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => handlePickSaved(img.image_url)}
                      className="relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-orange-500 focus:border-orange-500 transition-all active:scale-95 group"
                    >
                      <img
                        src={img.image_url}
                        alt="Saved"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Check className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                      <span className="absolute bottom-1 left-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-black/50 text-white/80">
                        {img.submode === 'text2image' ? 'T2I' : img.submode === 'image2image' ? 'I2I' : img.submode === 'background-removal' ? 'BG' : img.submode === 'draw' ? 'Draw' : img.submode}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
