import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import TrialGateOverlay from '@/components/TrialGateOverlay';
import { emitEvent } from '@/utils/eventBus';
import { toast } from 'sonner';
import { ImageSharePickerDialog } from '@/components/studio/ImageSharePickerDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import ShareButton from '@/components/ui/ShareButton';
import InstagramPublishButton from '@/components/instagram/InstagramPublishButton';
import {
  Send,
  Loader2,
  ImagePlus,
  Wand2,
  Download,
  X,
  Plus,
  Maximize2,
  Save,
  Check,
  Sparkles,
  GalleryHorizontalEnd,
} from 'lucide-react';
import { DrawAfterBGCanvas, DrawAfterBGCanvasRef } from '@/components/wakti-ai/DrawAfterBGCanvas';
import type { UploadedFile } from '@/types/fileUpload';
import VisualAdsGenerator, {
  adStyleChips,
  adTopicChips,
  ctaChips,
  mainMessageVariantMap,
  styleVariantMap,
  type VisualAdsState,
} from '@/components/studio/VisualAdsGenerator';

type ImageSubmode = 'text2image' | 'image2image' | 'background-removal' | 'draw' | 'visual-ads';

const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL || 'https://hxauxozopvpzpdygoqwf.supabase.co').trim();
const MAX_STUDIO_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Strip stray spaces / %20 from a storage URL before persisting it. */
const sanitizeImageUrl = (url: string): string =>
  url.replace(/%20/g, ' ').trim().replace(/^\s+/, '');

interface StudioImageGeneratorProps {
  onSaveSuccess?: () => void;
}

export default function StudioImageGenerator({ onSaveSuccess }: StudioImageGeneratorProps) {
  const { language } = useTheme();
  const { user } = useAuth();

  // Submode & quality
  const [submode, setSubmode] = useState<ImageSubmode>('text2image');
  const [quality, setQuality] = useState<'quick' | 'fast' | 'best_fast'>('quick');

  // Multi-image picker (for Quick/Grok results)
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [pickerIndex, setPickerIndex] = useState(0);

  // Prompt & loading
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const generateLockRef = useRef(false);

  // Result
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);

  // Uploaded file (for i2i and bg-removal)
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Second reference image for I2I (optional)
  const [uploadedFile2, setUploadedFile2] = useState<UploadedFile | null>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const [uploadedFile3, setUploadedFile3] = useState<UploadedFile | null>(null);
  const [uploadedFile4, setUploadedFile4] = useState<UploadedFile | null>(null);
  const fileInputRef3 = useRef<HTMLInputElement>(null);
  const fileInputRef4 = useRef<HTMLInputElement>(null);
  const [showExtraReferenceImages, setShowExtraReferenceImages] = useState(false);

  // Draw canvas ref
  const drawCanvasRef = useRef<DrawAfterBGCanvasRef>(null);

  // Amp state
  const [isAmping, setIsAmping] = useState(false);

  // I2I Arabic translate state
  const [isTranslatingI2I, setIsTranslatingI2I] = useState(false);

  // Lightbox (expand) state
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedImageId, setSavedImageId] = useState<string | null>(null);
  const [savedSourceUrl, setSavedSourceUrl] = useState<string | null>(null);
  const [savedBucketUrl, setSavedBucketUrl] = useState<string | null>(null);
  const [selectedSavedImageId, setSelectedSavedImageId] = useState<string | null>(null);
  const [savingGeneratedId, setSavingGeneratedId] = useState<string | null>(null);
  const bgCanvasRef = useRef<DrawAfterBGCanvasRef>(null);

  const emitTrialBlocked = useCallback((payload: any, fallbackFeature: string) => {
    emitEvent('wakti-trial-limit-reached', {
      feature: payload?.feature || fallbackFeature,
      reason: payload?.reason,
      code: payload?.code,
      consumed: payload?.consumed,
      limit: payload?.limit,
      remaining: payload?.remaining,
    });
  }, []);

  const emitTrialFinished = useCallback((payload: any, fallbackFeature: string) => {
    if (payload?.trial?.justExhausted || payload?.trial?.remaining === 0) {
      emitEvent('wakti-trial-quota-finished', {
        feature: payload?.trial?.feature || fallbackFeature,
        consumed: payload?.trial?.consumed,
        limit: payload?.trial?.limit,
        remaining: payload?.trial?.remaining,
      });
    }
  }, []);

  const [shareImageTarget, setShareImageTarget] = useState<{ id: string; title: string; imageUrl: string | null } | null>(null);

  // Pick from saved state
  const [showSavedPicker, setShowSavedPicker] = useState(false);
  const [savedImages, setSavedImages] = useState<{id:string; image_url:string; submode:string; created_at:string}[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [pickingForSlot, setPickingForSlot] = useState<1 | 2 | 3 | 4>(1);

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
    const fileObj: UploadedFile = {
      id: `saved-${Date.now()}`,
      name: 'saved-image.jpg',
      type: 'image/jpeg',
      size: 0,
      url: url,
      preview: url
    };
    if (pickingForSlot === 1) setUploadedFile(fileObj);
    else if (pickingForSlot === 2) setUploadedFile2(fileObj);
    else if (pickingForSlot === 3) setUploadedFile3(fileObj);
    else if (pickingForSlot === 4) setUploadedFile4(fileObj);
    setShowSavedPicker(false);
  };

  const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s || '');

  // ─── EXIF-aware orientation normalizer ───
  // Uses createImageBitmap() which auto-applies EXIF orientation (handles iPhone HEIC→JPEG,
  // Android camera photos, all orientations). Falls back to raw base64 if unsupported.
  const normalizeImageOrientation = async (file: File): Promise<string> => {
    const mimeOut = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const q = mimeOut === 'image/jpeg' ? 0.92 : undefined;

    try {
      // createImageBitmap with imageOrientation:'from-image' applies EXIF rotation natively
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      return canvas.toDataURL(mimeOut, q);
    } catch {
      // Fallback: raw base64 (orientation may be wrong on very old browsers)
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
  };

  // ─── File upload handler ───
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/') && !file.name.toLowerCase().match(/\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff)$/)) return;
    if (file.size > MAX_STUDIO_IMAGE_UPLOAD_BYTES) {
      toast.error(language === 'ar' ? 'الحد الأقصى 10 ميجابايت' : 'Max 10MB');
      return;
    }
    try {
      const base64DataUrl = await normalizeImageOrientation(file);
      setUploadedFile({
        id: `${Date.now()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: base64DataUrl,
        preview: base64DataUrl,
        base64: base64DataUrl,
        imageType: { id: 'general', name: 'General' },
      });
    } catch (err) {
      console.error('Image upload failed:', err);
    }
    e.target.value = '';
  };

  const handleFileChange3 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/') && !file.name.toLowerCase().match(/\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff)$/)) return;
    if (file.size > MAX_STUDIO_IMAGE_UPLOAD_BYTES) {
      toast.error(language === 'ar' ? 'الحد الأقصى 10 ميجابايت' : 'Max 10MB');
      return;
    }
    try {
      const base64DataUrl = await normalizeImageOrientation(file);
      setUploadedFile3({
        id: `${Date.now()}-3`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: base64DataUrl,
        preview: base64DataUrl,
        base64: base64DataUrl,
        imageType: { id: 'general', name: 'General' },
      });
    } catch (err) {
      console.error('Third image upload failed:', err);
    }
    e.target.value = '';
  };

  const handleFileChange4 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/') && !file.name.toLowerCase().match(/\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff)$/)) return;
    if (file.size > MAX_STUDIO_IMAGE_UPLOAD_BYTES) {
      toast.error(language === 'ar' ? 'الحد الأقصى 10 ميجابايت' : 'Max 10MB');
      return;
    }
    try {
      const base64DataUrl = await normalizeImageOrientation(file);
      setUploadedFile4({
        id: `${Date.now()}-4`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: base64DataUrl,
        preview: base64DataUrl,
        base64: base64DataUrl,
        imageType: { id: 'general', name: 'General' },
      });
    } catch (err) {
      console.error('Fourth image upload failed:', err);
    }
    e.target.value = '';
  };

  const handleFileChange2 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/') && !file.name.toLowerCase().match(/\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff)$/)) return;
    if (file.size > MAX_STUDIO_IMAGE_UPLOAD_BYTES) {
      toast.error(language === 'ar' ? 'الحد الأقصى 10 ميجابايت' : 'Max 10MB');
      return;
    }
    try {
      const base64DataUrl = await normalizeImageOrientation(file);
      setUploadedFile2({
        id: `${Date.now()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: base64DataUrl,
        preview: base64DataUrl,
        base64: base64DataUrl,
        imageType: { id: 'general', name: 'General' },
      });
    } catch (err) {
      console.error('Second image upload failed:', err);
    }
    e.target.value = '';
  };

  // ─── Simulated progress ───
  const progressRef = useRef<number | null>(null);
  const startProgress = () => {
    let p = 0;
    setProgress(0);
    progressRef.current = window.setInterval(() => {
      let inc = 0;
      if (p < 15) inc = 3 + Math.random() * 5;
      else if (p < 60) inc = 1 + Math.random() * 2.5;
      else if (p < 85) inc = Math.random() * 1.8;
      else if (p < 92) inc = Math.random() * 0.8;
      p = Math.min(92, p + inc);
      setProgress(Math.round(p));
    }, 350);
  };
  const stopProgress = () => {
    if (progressRef.current) {
      window.clearInterval(progressRef.current);
      progressRef.current = null;
    }
    setProgress(100);
  };

  // ─── Helper: poll a KIE task via edge function until done ───
  const pollKieTask = async (
    fnName: string,
    taskId: string,
    extraBody: Record<string, unknown> = {},
    token: string,
  ): Promise<string[]> => {
    const deadline = Date.now() + 3 * 60 * 1000; // 3 minute frontend timeout
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      const pollResp = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ taskId, ...extraBody }),
      });
      const pollJson = await pollResp.json().catch(() => ({} as any));
      if (Array.isArray(pollJson?.urls) && pollJson.urls.length > 0) {
        return pollJson.urls as string[];
      }
      if (!pollResp.ok || pollJson?.status === 'error') {
        throw new Error(pollJson?.error || 'KIE poll failed');
      }
      if (pollJson?.status === 'failed') {
        throw new Error(pollJson?.error || 'KIE task failed');
      }
      // status === 'pending' — continue polling
    }
    throw new Error(language === 'ar' ? 'انتهت مدة الانتظار' : 'Generation timed out — please try again');
  };

  // ─── Generate: Quick (Grok) Text2Image ───
  const generateQuickText2Image = async (): Promise<string[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Authentication required');
    const token = session.access_token;
    // Step 1: submit
    const submitResp = await fetch(`${SUPABASE_URL}/functions/v1/wakti-grok-text2image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ prompt, user_id: user?.id, aspect_ratio: '9:16' }),
    });
    const submitJson = await submitResp.json().catch(() => ({} as any));
    if (submitJson?.error === 'TRIAL_LIMIT_REACHED') {
      emitTrialBlocked(submitJson, 't2i');
      return [];
    }
    if (!submitResp.ok || !submitJson?.success) {
      throw new Error(submitJson?.error || 'Quick submit failed');
    }
    const taskId: string = submitJson?.taskId;
    if (!taskId) throw new Error('No taskId returned from KIE submit');
    // Step 2: poll from frontend
    return pollKieTask('wakti-grok-text2image', taskId, { user_id: user?.id }, token);
  };

  // ─── Generate: Quick (Grok) Image2Image ───
  const generateQuickImage2Image = async (): Promise<string[]> => {
    if (!uploadedFile) throw new Error(language === 'ar' ? 'الرجاء إرفاق صورة' : 'Please attach an image');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Authentication required');
    const token = session.access_token;
    const imageBase64s = [uploadedFile, uploadedFile2, uploadedFile3, uploadedFile4]
      .filter(Boolean)
      .map((file) => file!.base64 || file!.url || file!.preview || '')
      .filter(Boolean);
    // Step 1: submit (uploads reference image + creates KIE task)
    const submitResp = await fetch(`${SUPABASE_URL}/functions/v1/wakti-grok-image2image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ user_prompt: prompt, image_base64s: imageBase64s, user_id: user?.id }),
    });
    const submitJson = await submitResp.json().catch(() => ({} as any));
    if (submitJson?.error === 'TRIAL_LIMIT_REACHED') {
      emitTrialBlocked(submitJson, 'i2i');
      return [];
    }
    if (!submitResp.ok || !submitJson?.success) {
      throw new Error(submitJson?.error || 'Quick i2i submit failed');
    }
    const taskId: string = submitJson?.taskId;
    if (!taskId) throw new Error('No taskId returned from KIE i2i submit');
    // Step 2: poll from frontend
    return pollKieTask('wakti-grok-image2image', taskId, { user_id: user?.id }, token);
  };

  // ─── Generate: Text2Image ───
  const generateText2Image = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Authentication required');
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/wakti-text2image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ prompt, quality, user_id: user?.id }),
    });
    const json = await resp.json().catch(() => ({} as any));
    if (!resp.ok || !json?.success || !json?.url) {
      if (json?.error === 'TRIAL_LIMIT_REACHED') {
        emitTrialBlocked(json, 't2i');
        return null as unknown as string;
      }
      throw new Error(json?.error || 'Text2Image failed');
    }
    emitTrialFinished(json, 't2i');
    return json.url as string;
  };

  // ─── Generate: Image2Image ───
  const generateImage2Image = async () => {
    if (!uploadedFile) throw new Error(language === 'ar' ? 'الرجاء إرفاق صورة' : 'Please attach an image');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Authentication required');
    const imageBase64s = [uploadedFile, uploadedFile2, uploadedFile3, uploadedFile4]
      .filter(Boolean)
      .map((file) => file!.base64 || file!.url || file!.preview || '')
      .filter(Boolean);
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/wakti-image2image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ user_prompt: prompt, image_base64s: imageBase64s, user_id: user?.id, quality }),
    });
    const json = await resp.json().catch(() => ({} as any));
    if (!resp.ok || !json?.success || !json?.url) {
      if (json?.error === 'TRIAL_LIMIT_REACHED') {
        emitTrialBlocked(json, 'i2i');
        return null as unknown as string;
      }
      throw new Error(json?.error || 'Image2Image failed');
    }
    emitTrialFinished(json, 'i2i');
    return json.url as string;
  };

  // ─── Generate: Background Removal ───
  const generateBGRemoval = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Authentication required');
    const firstImg = uploadedFile;
    const rawB64 = firstImg?.base64 || firstImg?.url || firstImg?.preview || '';
    const hasImage = !!rawB64;
    const mime = (firstImg?.type && typeof firstImg.type === 'string') ? firstImg.type : 'image/jpeg';
    const imageParam = hasImage
      ? ((typeof rawB64 === 'string' && (rawB64.startsWith('data:') || rawB64.startsWith('http')))
        ? rawB64
        : `data:${mime};base64,${rawB64}`)
      : null;
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/image-background-removal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({
        ...(imageParam ? { referenceImages: [imageParam] } : {}),
        positivePrompt: (prompt || '').toString().replace(/"\s*$/, '').trim(),
        outputType: ['dataURI', 'URL'],
        outputFormat: 'JPEG',
        outputQuality: 85,
      }),
    });
    const json = await resp.json().catch(() => ({} as any));
    if (!resp.ok) {
      if (json?.error === 'TRIAL_LIMIT_REACHED') {
        emitTrialBlocked(json, 'bg_removal');
        return null as unknown as string;
      }
      throw new Error(json?.error || 'Background edit failed');
    }
    const outUrl = json?.imageUrl || json?.URL || json?.imageDataURI || json?.dataURI || null;
    if (!outUrl) throw new Error('No image generated');
    emitTrialFinished(json, 'bg_removal');
    return outUrl as string;
  };

  const importExternalImageToStorage = useCallback(async (imageUrl: string): Promise<{ url: string; storagePath: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Authentication required');

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/save-generated-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        imageUrl,
        submode,
        filenameHint: `${submode}-${quality}`,
      }),
    });

    const json = await resp.json().catch(() => ({} as any));
    if (!resp.ok || !json?.success || !json?.url || !json?.storagePath) {
      throw new Error(json?.error || 'Server-side image save failed');
    }

    return { url: sanitizeImageUrl(json.url as string), storagePath: json.storagePath as string };
  }, [quality, submode]);

  const persistGeneratedImage = useCallback(async (
    imageUrl: string,
    options?: {
      showSuccessToast?: boolean;
      showAlreadySavedToast?: boolean;
      triggerSaveSuccess?: boolean;
    }
  ) => {
    if (!imageUrl || !user?.id) {
      return { success: false, imageId: null as string | null, imageUrl: null as string | null };
    }

    const {
      showSuccessToast = true,
      showAlreadySavedToast = true,
      triggerSaveSuccess = true,
    } = options || {};

    if (isSaved && savedImageId && savedSourceUrl === imageUrl) {
      if (showAlreadySavedToast) {
        toast.success(language === 'ar' ? 'تم الحفظ بالفعل' : 'Already saved');
      }
      if (triggerSaveSuccess) {
        onSaveSuccess?.();
      }
      return { success: true, imageId: savedImageId, imageUrl: savedBucketUrl || imageUrl };
    }

    setIsSaving(true);
    try {
      let bucketUrl = savedBucketUrl;
      let storagePath = '';
      let resolvedImageId = savedImageId;

      if (!bucketUrl) {
        try {
          const res = await fetch(imageUrl);
          if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
          const blob = await res.blob();
          const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
          const fileName = `${user.id}/${submode}-${Date.now()}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from('generated-images')
            .upload(fileName, blob, { contentType: blob.type, upsert: false });
          if (uploadErr) throw uploadErr;

          const { data: urlData } = supabase.storage
            .from('generated-images')
            .getPublicUrl(fileName);
          bucketUrl = sanitizeImageUrl(urlData?.publicUrl || '');
          if (!bucketUrl) throw new Error('Failed to get public URL');
          storagePath = fileName;
          setSavedBucketUrl(bucketUrl);
        } catch {
          const imported = await importExternalImageToStorage(imageUrl);
          bucketUrl = imported.url;
          storagePath = imported.storagePath;
          setSavedBucketUrl(bucketUrl);
        }
      } else {
        const parts = bucketUrl.split('/generated-images/');
        if (parts[1]) storagePath = decodeURIComponent(parts[1]);
      }

      if (!savedImageId) {
        const { data: existingRow, error: existingErr } = await (supabase as any)
          .from('user_generated_images')
          .select('id')
          .eq('user_id', user.id)
          .eq('image_url', bucketUrl)
          .maybeSingle();
        if (existingErr) throw existingErr;

        if (existingRow?.id) {
          resolvedImageId = existingRow.id;
          setSavedImageId(existingRow.id);
        } else {
          const { data: row, error: dbErr } = await (supabase as any)
            .from('user_generated_images')
            .insert({
              user_id: user.id,
              image_url: bucketUrl,
              prompt: prompt || null,
              submode,
              quality: submode === 'text2image' || submode === 'image2image' ? quality : null,
              meta: { storage_path: storagePath },
            })
            .select('id')
            .single();
          if (dbErr) throw dbErr;
          if (!row?.id) throw new Error('Save succeeded but no record ID was returned');
          resolvedImageId = row.id;
          setSavedImageId(row.id);
        }
      }

      setIsSaved(true);
      setSavedSourceUrl(imageUrl);
      if (showSuccessToast) {
        toast.success(language === 'ar' ? 'تم الحفظ' : 'Saved');
      }
      if (triggerSaveSuccess) {
        onSaveSuccess?.();
      }
      return { success: true, imageId: resolvedImageId, imageUrl: bucketUrl || imageUrl };
    } catch (err: any) {
      console.error('Save failed:', err);
      if (showSuccessToast) {
        toast.error(language === 'ar' ? 'فشل الحفظ' : 'Save failed');
      }
      return { success: false, imageId: null as string | null, imageUrl: null as string | null };
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, isSaved, savedImageId, savedBucketUrl, savedSourceUrl, submode, prompt, quality, language, onSaveSuccess, importExternalImageToStorage]);

  const selectQuickResult = useCallback((index: number) => {
    const nextUrl = resultUrls[index];
    if (!nextUrl) return;
    setPickerIndex(index);
    setResultImageUrl(nextUrl);
    setIsSaved(false);
    setSavedBucketUrl(null);
    setSavedImageId(null);
    setSavedSourceUrl(null);
  }, [resultUrls]);

  // ─── Main generate handler ───
  const handleGenerate = useCallback(async () => {
    if (generateLockRef.current || isGenerating) {
      return;
    }

    if (submode === 'draw') {
      drawCanvasRef.current?.triggerManualGeneration();
      return;
    }

    if (!prompt.trim() && submode === 'text2image') {
      toast.error(language === 'ar' ? 'اكتب وصفاً للصورة' : 'Enter an image description');
      return;
    }
    if ((submode === 'image2image' || submode === 'background-removal') && !uploadedFile && !prompt.trim()) {
      toast.error(language === 'ar' ? 'أرفق صورة أو اكتب وصفاً' : 'Attach an image or enter a description');
      return;
    }

    generateLockRef.current = true;
    setIsGenerating(true);
    setResultError(null);
    setResultImageUrl(null);
    setResultUrls([]);
    setPickerIndex(0);
    setIsSaved(false);
    setSavedBucketUrl(null);
    setSavedImageId(null);
    setSavedSourceUrl(null);
    startProgress();

    let generatedUrl: string | null = null;
    try {
      // Quick uses Grok and returns multiple images
      if (quality === 'quick' && (submode === 'text2image' || submode === 'image2image')) {
        const urls = submode === 'text2image'
          ? await generateQuickText2Image()
          : await generateQuickImage2Image();
        stopProgress();
        if (urls.length > 0) {
          setResultUrls(urls);
          setResultImageUrl(urls[0]);
          generatedUrl = urls[0];
        }
      } else {
        let url: string;
        switch (submode) {
          case 'text2image':
            url = await generateText2Image();
            break;
          case 'image2image':
            url = await generateImage2Image();
            break;
          case 'background-removal':
            url = await generateBGRemoval();
            break;
          case 'visual-ads':
            // For now, visual-ads uses the same generation as text2image
            url = await generateText2Image();
            break;
          default:
            throw new Error('Unknown submode');
        }
        stopProgress();
        generatedUrl = url;
        setResultImageUrl(url);
      }
    } catch (err: any) {
      stopProgress();
      const msg = err?.message || (language === 'ar' ? 'فشل إنشاء الصورة' : 'Image generation failed');
      setResultError(msg);
      toast.error(msg);
    } finally {
      setIsGenerating(false);
      generateLockRef.current = false;
    }
    // Auto-save is fire-and-forget — skip for Quick (Grok) since user must choose which image to save
    if (generatedUrl && quality !== 'quick' && submode !== 'visual-ads') {
      persistGeneratedImage(generatedUrl, {
        showSuccessToast: false,
        showAlreadySavedToast: false,
        triggerSaveSuccess: false,
      }).catch(() => { /* silent */ });
    }
  }, [submode, prompt, quality, uploadedFile, uploadedFile2, uploadedFile3, uploadedFile4, language, persistGeneratedImage]);

  // ─── Amp prompt ───
  const handleAmp = async () => {
    if (!prompt.trim() || isAmping) return;
    try {
      setIsAmping(true);
      const { data, error } = await supabase.functions.invoke('prompt-amp', { body: { text: prompt, mode: submode } });
      if (!error && data?.text) setPrompt(String(data.text));
      else console.error('Amp failed:', error || data);
    } catch (e) {
      console.error('Amp exception:', e);
    } finally {
      setIsAmping(false);
    }
  };

  // ─── I2I Arabic translate ───
  const handleTranslateI2I = async () => {
    if (!prompt.trim() || isTranslatingI2I) return;
    try {
      setIsTranslatingI2I(true);
      const { data, error } = await supabase.functions.invoke('image2image-ar2en', { body: { text: prompt } });
      if (!error && data?.text) setPrompt(String(data.text));
      else console.error('Translate failed:', error || data);
    } catch (e) {
      console.error('Translate exception:', e);
    } finally {
      setIsTranslatingI2I(false);
    }
  };

  // ─── Download result ───
  const handleDownload = async () => {
    if (!resultImageUrl) return;
    try {
      const res = await fetch(resultImageUrl);
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
      window.open(resultImageUrl, '_blank');
    }
  };

  // ─── Save to DB (reuses auto-uploaded bucket URL or uploads fresh) ───
  const handleSave = async () => {
    if (!resultImageUrl || !user?.id) return;
    await persistGeneratedImage(resultImageUrl, {
      showSuccessToast: true,
      showAlreadySavedToast: true,
      triggerSaveSuccess: resultUrls.length <= 1, // Don't navigate if there are multiple images
    });
  };

  const handleSaveAll = async () => {
    if (resultUrls.length === 0 || !user?.id) return;
    setIsSaving(true);
    let successCount = 0;
    try {
      for (const url of resultUrls) {
        // Fetch and upload each image independently
        let bucketUrl = '';
        let storagePath = '';
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
          const blob = await res.blob();
          const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
          const fileName = `${user.id}/${submode}-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          
          const { error: uploadErr } = await supabase.storage
            .from('generated-images')
            .upload(fileName, blob, { contentType: blob.type, upsert: false });
          if (uploadErr) throw uploadErr;

          const { data: urlData } = supabase.storage
            .from('generated-images')
            .getPublicUrl(fileName);
          bucketUrl = sanitizeImageUrl(urlData?.publicUrl || '');
          if (!bucketUrl) throw new Error('Failed to get public URL');
          storagePath = fileName;
        } catch {
          const imported = await importExternalImageToStorage(url);
          bucketUrl = imported.url;
          storagePath = imported.storagePath;
        }

        // Insert into DB
        const { data: existingRow, error: existingErr } = await (supabase as any)
          .from('user_generated_images')
          .select('id')
          .eq('user_id', user.id)
          .eq('image_url', bucketUrl)
          .maybeSingle();
        if (existingErr) throw existingErr;

        let row = existingRow;
        if (!row?.id) {
          const { data: insertedRow, error: dbErr } = await (supabase as any)
            .from('user_generated_images')
            .insert({
              user_id: user.id,
              image_url: bucketUrl,
              prompt: prompt || null,
              submode,
              quality: submode === 'text2image' || submode === 'image2image' ? quality : null,
              meta: { storage_path: storagePath },
            })
            .select('id')
            .single();
          if (dbErr) throw dbErr;
          row = insertedRow;
        }
          
        if (row?.id) {
          successCount++;
          // If this is the currently displayed image, update its state so it shows as saved
          if (url === resultImageUrl) {
            setIsSaved(true);
            setSavedBucketUrl(bucketUrl);
            setSavedImageId(row.id);
            setSavedSourceUrl(url);
          }
        }
      }
      toast.success(language === 'ar' ? `تم حفظ ${successCount} صورة` : `Saved ${successCount} images`);
      onSaveSuccess?.();
    } catch (err: any) {
      console.error('Save all failed:', err);
      toast.error(language === 'ar' ? 'فشل حفظ بعض الصور' : 'Failed to save some images');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Submode config ───
  const submodes: { key: ImageSubmode; labelEn: string; labelAr: string; emoji: string; shortEn: string; shortAr: string }[] = [
    { key: 'text2image',         labelEn: 'Text to Image',       labelAr: 'نص إلى صورة',        emoji: '✨',  shortEn: 'Text',        shortAr: 'نص' },
    { key: 'image2image',        labelEn: 'Image to Image',      labelAr: 'صورة إلى صورة',       emoji: '🖼️', shortEn: 'Img2Img',     shortAr: 'صورة' },
    { key: 'background-removal', labelEn: 'Background Removal',  labelAr: 'إزالة الخلفية',       emoji: '🪄',  shortEn: 'BG Remove',   shortAr: 'خلفية' },
    { key: 'draw',               labelEn: 'Draw',                labelAr: 'رسم',                 emoji: '✏️', shortEn: 'Draw',        shortAr: 'رسم' },
    { key: 'visual-ads',         labelEn: 'Poster Ads',          labelAr: 'إعلانات بوستر',       emoji: '🪄',  shortEn: 'Poster Ads',  shortAr: 'بوستر' },
  ];

  // ─── Reset saved state when generating new image ───
  const resetForNewGeneration = () => {
    setUploadedFile2(null);
    setUploadedFile3(null);
    setUploadedFile4(null);
    setShowExtraReferenceImages(false);
    setResultImageUrl(null);
    setResultError(null);
    setIsSaved(false);
    setSavedBucketUrl(null);
    setSavedImageId(null);
    setSavedSourceUrl(null);
  };

  // ─── Placeholder per submode ───
  const getPlaceholder = () => {
    if (language === 'ar') {
      switch (submode) {
        case 'text2image': return 'مثال: مقهى دافئ، سينماتيك، إضاءة ناعمة';
        case 'image2image': return 'مثال: حوّل الصورة إلى أسلوب ألوان مائية';
        case 'background-removal': return 'مثال: إزالة الخلفية والإبقاء على العنصر فقط';
        default: return '';
      }
    }
    switch (submode) {
      case 'text2image': return 'Ex: cozy cafe, cinematic, soft light';
      case 'image2image': return 'Ex: style the uploaded image as watercolor';
      case 'background-removal': return 'Ex: remove background, keep subject only';
      default: return '';
    }
  };

  // ─── Quick chips per submode ───
  const getQuickChips = (): { label: string; prompt: string }[] => {
    if (submode === 'background-removal') {
      return [{ label: language === 'ar' ? '🪄 أزل الخلفية' : '🪄 Remove background', prompt: 'Remove the background' }];
    }
    if (submode === 'image2image') {
      return [
        { label: language === 'ar' ? '🎨 ألوان مائية' : '🎨 Watercolor', prompt: 'Convert to watercolor style' },
        { label: language === 'ar' ? '🎞 كرتون/أنمي' : '🎞 Cartoon/Anime', prompt: 'Make it cartoon/anime' },
        { label: language === 'ar' ? '✿ تحسين التفاصيل' : '✿ Enhance details', prompt: 'Enhance sharpness and details' },
        { label: language === 'ar' ? '⬛ أبيض وأسود' : '⬛ Black & White', prompt: 'Change to black and white' },
      ];
    }
    return [
      { label: language === 'ar' ? '🌅 سينمائي' : '🌅 Cinematic', prompt: 'cinematic lighting, ultra detailed' },
      { label: language === 'ar' ? '📸 واقعي' : '📸 Realistic', prompt: 'photorealistic, highly detailed' },
      { label: language === 'ar' ? '🎨 فني' : '🎨 Artistic', prompt: 'artistic illustration, vibrant colors' },
      { label: language === 'ar' ? '✨ ناعم' : '✨ Soft Glow', prompt: 'soft glow, dreamy atmosphere' },
    ];
  };

  const SubmodeTabs = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {submodes.map((m) => {
        const isActive = submode === m.key;
        const isVisualAds = m.key === 'visual-ads';

        return (
          <button
            key={m.key}
            type="button"
            onClick={() => setSubmode(m.key)}
            title={language === 'ar' ? m.labelAr : m.labelEn}
            className={`relative flex items-center justify-center gap-2 px-3 py-3 rounded-xl transition-all duration-200 min-h-[58px] touch-manipulation ${
              isVisualAds ? 'col-span-2 sm:col-span-1' : ''
            } ${
              isActive
                ? isVisualAds
                  ? 'bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 text-[#060541] shadow-lg shadow-orange-500/40 scale-[1.02]'
                  : 'bg-gradient-to-br from-[#060541] via-[#1a1a4a] to-[#060541] dark:from-[#f2f2f2] dark:via-[#e0e0e0] dark:to-[#f2f2f2] shadow-lg shadow-[#060541]/25 dark:shadow-white/25 scale-[1.02]'
                : isVisualAds
                  ? 'bg-white/50 dark:bg-white/5 border-2 border-orange-400/60 dark:border-amber-500/50 hover:bg-white/70 dark:hover:bg-white/10 active:scale-95'
                  : 'bg-white/30 dark:bg-white/5 border border-[#606062]/20 dark:border-[#858384]/30 hover:bg-white/50 dark:hover:bg-white/15 active:scale-95'
            }`}
          >
            <span className="text-lg leading-none">{m.emoji}</span>
            <span className={`font-semibold leading-none ${
              isVisualAds ? 'text-sm' : 'text-[10px]'
            } ${
              isActive ? 'text-white dark:text-[#060541]' : (isVisualAds ? 'text-foreground dark:text-[#f2f2f2]' : 'text-[#858384] dark:text-[#606062]')
            }`}>
              {language === 'ar' ? m.shortAr : m.shortEn}
            </span>
            {isActive && (
              <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 dark:from-transparent dark:via-transparent dark:to-transparent pointer-events-none" />
            )}
          </button>
        );
      })}
    </div>
  );

  const WaktiShareIcon = () => <img src="/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png" alt="" className="w-full h-full object-cover rounded-full" />;

  // ─── Result actions bar ───
  const ResultActions = () => (
    <div className="flex items-center gap-2 flex-wrap">
      {resultUrls.length > 1 && (
        <button
          onClick={handleSaveAll}
          disabled={isSaving}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 ${
            isSaving
              ? 'bg-white/50 dark:bg-white/5 border border-border/50 text-foreground/50 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border border-blue-300/40 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse'
          }`}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{language === 'ar' ? 'حفظ الكل' : 'Save All'}</span>
        </button>
      )}
      <button
        onClick={handleSave}
        disabled={isSaving || isSaved}
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 ${
          isSaved
            ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30'
            : quality === 'quick' && resultImageUrl && !isSaving
              ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white border border-purple-300/40 shadow-[0_0_20px_rgba(168,85,247,0.55),0_0_38px_rgba(59,130,246,0.28)] animate-pulse'
              : 'bg-white/80 dark:bg-white/5 border border-border/50 text-foreground'
        }`}
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : isSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        <span>{isSaved ? (language === 'ar' ? 'تم الحفظ' : 'Saved') : (language === 'ar' ? 'حفظ' : 'Save')}</span>
      </button>
      <button
        onClick={handleDownload}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-white/80 dark:bg-white/5 border border-border/50 text-foreground transition-all duration-200 active:scale-95"
      >
        <Download className="h-4 w-4" />
        <span>{language === 'ar' ? 'تحميل' : 'Download'}</span>
      </button>
      <button
        onClick={() => setLightboxOpen(true)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-white/80 dark:bg-white/5 border border-border/50 text-foreground transition-all duration-200 active:scale-95"
      >
        <Maximize2 className="h-4 w-4" />
        <span>{language === 'ar' ? 'توسيع' : 'Expand'}</span>
      </button>
      <ShareButton
        shareUrl={savedImageId ? `${window.location.origin}/image/${savedImageId}` : (savedBucketUrl || resultImageUrl || '')}
        shareTitle={language === 'ar' ? 'صورة من Wakti AI' : 'Image from Wakti AI'}
        shareDescription={language === 'ar' ? 'تم إنشاؤها بواسطة Wakti AI' : 'Created with Wakti AI'}
        size="sm"
        extraActions={[
          {
            name: 'wakti',
            icon: WaktiShareIcon,
            bgColor: 'bg-transparent !p-0 overflow-hidden',
            angle: 309,
            action: async () => {
              if (!resultImageUrl) return;
              const ensured = await persistGeneratedImage(resultImageUrl, {
                showSuccessToast: false,
                showAlreadySavedToast: false,
                triggerSaveSuccess: false,
              });
              if (!ensured.success || !ensured.imageId) {
                toast.error(language === 'ar' ? 'فشل تجهيز الصورة للمشاركة' : 'Failed to prepare image for sharing');
                return;
              }
              setShareImageTarget({
                id: ensured.imageId,
                title: prompt || (language === 'ar' ? 'صورة من وقتي' : 'Image from Wakti'),
                imageUrl: ensured.imageUrl || resultImageUrl,
              });
            },
          },
        ]}
      />
      {resultImageUrl && (
        <InstagramPublishButton
          mediaUrl={savedBucketUrl || resultImageUrl}
          mediaType="image"
          defaultCaption={''}
          language={language as 'en' | 'ar'}
        />
      )}
      <button
        onClick={() => { resetForNewGeneration(); setPrompt(''); setUploadedFile(null); }}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 transition-all duration-200 active:scale-95 ml-auto"
      >
        <Plus className="h-4 w-4" />
        <span>{language === 'ar' ? 'جديد' : 'New'}</span>
      </button>
    </div>
  );

  // ─── Lightbox Portal ───
  const Lightbox = () => {
    if (!lightboxOpen || !resultImageUrl) return null;
    return createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
        onClick={() => setLightboxOpen(false)}
      >
        <button
          onClick={() => setLightboxOpen(false)}
          className="absolute top-6 right-6 z-10 h-12 w-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xl text-white flex items-center justify-center active:scale-90 transition-all border border-white/20 shadow-lg"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>
        <img
          src={resultImageUrl}
          alt="Generated"
          className="max-w-[95vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-xl rounded-2xl px-4 py-2.5 border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={handleDownload} className="flex items-center gap-1.5 text-white/90 text-sm font-medium active:scale-95 transition-transform">
            <Download className="h-4 w-4" /> {language === 'ar' ? 'تحميل' : 'Download'}
          </button>
          <div className="w-px h-5 bg-white/20" />
          <button
            onClick={handleSave}
            disabled={isSaved}
            className={`flex items-center gap-1.5 text-sm font-medium active:scale-95 transition-transform ${
              isSaved ? 'text-white/90' : quality === 'quick' && resultImageUrl ? 'text-purple-200 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)] animate-pulse' : 'text-white/90'
            }`}
          >
            {isSaved ? <Check className="h-4 w-4 text-green-400" /> : <Save className="h-4 w-4" />}
            {isSaved ? (language === 'ar' ? 'تم' : 'Saved') : (language === 'ar' ? 'حفظ' : 'Save')}
          </button>
          <div className="w-px h-5 bg-white/20" />
          <ShareButton
            shareUrl={resultImageUrl}
            shareTitle={language === 'ar' ? 'صورة من Wakti AI' : 'Image from Wakti AI'}
            shareDescription={language === 'ar' ? 'تم إنشاؤها بواسطة Wakti AI' : 'Created with Wakti AI'}
            size="sm"
          />
        </div>
      </div>,
      document.body
    );
  };

  // ─── Draw mode early return ───
  if (submode === 'draw') {
    return (
      <div className="space-y-4">
        <SubmodeTabs />
        <div className="h-[70vh] md:h-[75vh]">
          <DrawAfterBGCanvas ref={drawCanvasRef} prompt={prompt} />
        </div>
        <div className="rounded-2xl border border-border/50 bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm p-3 flex items-end gap-2 shadow-sm">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={language === 'ar' ? 'صف ما تريد رسمه...' : 'Describe what you want to draw...'}
            className="flex-1 min-h-[44px] resize-none rounded-xl border-border/50 bg-white/50 dark:bg-white/[0.02] text-base"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && prompt.trim()) {
                e.preventDefault();
                drawCanvasRef.current?.triggerManualGeneration();
              }
            }}
          />
          <button
            onClick={() => drawCanvasRef.current?.triggerManualGeneration()}
            disabled={!prompt.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:shadow-none shrink-0"
          >
            <Send className="h-4 w-4" />
            <span>{language === 'ar' ? 'إرسال' : 'Send'}</span>
          </button>
        </div>
      </div>
    );
  }

  // ─── Derived state ───
  const needsUpload = submode === 'image2image' || submode === 'background-removal' || submode === 'visual-ads';
  const showPrompt = true;
  const canGenerate = prompt.trim().length > 0 || (needsUpload && !!uploadedFile);

  // ─── Trial gate ───
  const submodeTrialMap: Record<ImageSubmode, { key: string; limit: number; en: string; ar: string }> = {
    'text2image':         { key: 't2i',        limit: 2, en: 'Text to Image',      ar: 'نص إلى صورة' },
    'image2image':        { key: 'i2i',        limit: 2, en: 'Image to Image',     ar: 'صورة إلى صورة' },
    'background-removal': { key: 'bg_removal', limit: 2, en: 'Background Removal', ar: 'إزالة الخلفية' },
    'draw':               { key: '',           limit: 0, en: '',                   ar: '' },
    'visual-ads':         { key: 'visual_ads', limit: 2, en: 'Poster Ads',         ar: 'إعلانات بوستر' },
  };
  const activeTrialInfo = submodeTrialMap[submode];

  return (
    <>
    <TrialGateOverlay featureKey={activeTrialInfo.key} limit={activeTrialInfo.limit} featureLabel={{ en: activeTrialInfo.en, ar: activeTrialInfo.ar }} />
    <Lightbox />
    <div className="space-y-5">
      {/* Submode tabs */}
      <SubmodeTabs />

      {/* ── Visual Ads Mode ── */}
      {submode === 'visual-ads' && (
        <VisualAdsGenerator
          onBack={() => setSubmode('text2image')}
          onGenerate={async (visualState) => {
            const getAssetLabel = (asset: NonNullable<VisualAdsState['assets']>[number]) => {
              if (asset.type === 'logo') return 'logo';
              if (asset.type === 'product') return 'product';
              if (asset.type === 'screenshot') return 'screenshot';
              if (asset.type === 'person') return 'person';
              if (asset.type === 'background') return 'background';
              if (asset.type === 'icon') return 'icon';
              if (asset.type === 'prop') return 'prop';
              if (asset.type === 'mascot') return 'mascot';
              if (asset.type === 'texture') return 'texture';
              if (asset.type === 'illustration') return 'illustration';
              return 'asset';
            };

            const getSourceId = (index: number) => `SOURCE_${index + 1}`;

            const getScreenshotDevice = (asset: NonNullable<VisualAdsState['assets']>[number]) => (
              asset.screenshotDevice === 'samsung'
                ? 'samsung'
                : asset.screenshotDevice === 'laptop'
                  ? 'laptop'
                  : asset.screenshotDevice === 'tablet'
                    ? 'tablet'
                    : asset.screenshotDevice === 'monitor-tv'
                      ? 'monitor-tv'
                      : asset.screenshotDevice === 'billboard'
                        ? 'billboard'
                        : 'iphone'
            );

            const topicLabels: Record<string, string> = {
              'new-launch': 'new-launch',
              'limited-offer': 'limited-offer',
              'app-download': 'app-download',
              'save-time': 'save-time',
              'premium': 'premium',
              'social-proof': 'social-proof',
              'features': 'features',
              'sale': 'sale',
            };

            const topicVariantLabels: Record<string, Record<string, string>> = {
              'new-launch': {
                'hero-reveal': 'hero-reveal',
                'future-wave': 'future-wave',
                'founder-proud': 'founder-proud',
              },
              'limited-offer': {
                'vip-window': 'vip-window',
                'countdown-pressure': 'countdown-pressure',
                'clean-urgency': 'clean-urgency',
              },
              'app-download': {
                'phone-first': 'phone-first',
                'smart-lifestyle': 'smart-lifestyle',
                'store-ready': 'store-ready',
              },
              'save-time': {
                'calm-efficiency': 'calm-efficiency',
                'instant-relief': 'instant-relief',
                'smooth-routine': 'smooth-routine',
              },
              'premium': {
                'crafted-luxury': 'crafted-luxury',
                'quiet-wealth': 'quiet-wealth',
                'flagship-energy': 'flagship-energy',
              },
              'social-proof': {
                'testimonial-cards': 'testimonial-cards',
                'community-love': 'community-love',
                'trust-signals': 'trust-signals',
              },
              'features': {
                'feature-callouts': 'feature-callouts',
                'hero-plus-benefits': 'hero-plus-benefits',
                'smart-breakdown': 'smart-breakdown',
              },
              'sale': {
                'price-drop': 'price-drop',
                'vip-deal': 'vip-deal',
                'high-energy-flash': 'high-energy-flash',
              },
            };

            const styleLabels: Record<string, string> = {
              'premium-dark': 'premium-dark',
              'bright-clean': 'bright-clean',
              'bold-modern': 'bold-modern',
              'lifestyle': 'lifestyle',
              'luxury-minimal': 'luxury-minimal',
              'ugc': 'ugc',
            };

            const styleVariantLabels: Record<string, Record<string, string>> = {
              'premium-dark': {
                'luxury-noir': 'luxury-noir',
                'cinematic-glow': 'cinematic-glow',
                'elite-tech': 'elite-tech',
              },
              'bright-clean': {
                'airy-minimal': 'airy-minimal',
                'sunlit-premium': 'sunlit-premium',
                'gallery-clean': 'gallery-clean',
              },
              'bold-modern': {
                'neon-energy': 'neon-energy',
                'editorial-hype': 'editorial-hype',
                'tech-pop': 'tech-pop',
              },
              'lifestyle': {
                'warm-documentary': 'warm-documentary',
                'golden-hour': 'golden-hour',
                'everyday-premium': 'everyday-premium',
              },
              'luxury-minimal': {
                'silent-wealth': 'silent-wealth',
                'museum-piece': 'museum-piece',
                'monochrome-premium': 'monochrome-premium',
              },
              'ugc': {
                'phone-capture': 'phone-capture',
                'creator-post': 'creator-post',
                'real-feed': 'real-feed',
              },
            };

            const normalizeShortValue = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();
            const customTopic = normalizeShortValue(visualState.creativeSoul.customMainMessage);
            const customCta = normalizeShortValue(visualState.creativeSoul.customCta);
            const customStyle = normalizeShortValue(visualState.creativeSoul.customStyle);
            const featureChips = (visualState.creativeSoul.featureChips || [])
              .map((chip) => normalizeShortValue(chip))
              .filter(Boolean)
              .slice(0, 5);
            const canUseFeatureChips = visualState.creativeSoul.mainMessage === 'custom'
              ? Boolean(customTopic)
              : Boolean(visualState.creativeSoul.mainMessage && visualState.creativeSoul.mainMessageVariant);
            const selectedTopicChip = visualState.creativeSoul.mainMessage && visualState.creativeSoul.mainMessage !== 'custom'
              ? adTopicChips.find((chip) => chip.id === visualState.creativeSoul.mainMessage) || null
              : null;
            const selectedTopicVariant = visualState.creativeSoul.mainMessage && visualState.creativeSoul.mainMessage !== 'custom' && visualState.creativeSoul.mainMessageVariant
              ? (mainMessageVariantMap[visualState.creativeSoul.mainMessage] || []).find((variant) => variant.id === visualState.creativeSoul.mainMessageVariant) || null
              : null;
            const selectedCtaChip = visualState.creativeSoul.cta && visualState.creativeSoul.cta !== 'custom'
              ? ctaChips.find((chip) => chip.id === visualState.creativeSoul.cta) || null
              : null;
            const selectedStyleChip = visualState.creativeSoul.style && visualState.creativeSoul.style !== 'custom'
              ? adStyleChips.find((chip) => chip.id === visualState.creativeSoul.style) || null
              : null;
            const selectedStyleVariant = visualState.creativeSoul.style && visualState.creativeSoul.style !== 'custom' && visualState.creativeSoul.styleVariant
              ? (styleVariantMap[visualState.creativeSoul.style] || []).find((variant) => variant.id === visualState.creativeSoul.styleVariant) || null
              : null;

            const MAX_VISUAL_AD_IMAGES = 14;
            const assetEntries = (visualState.assets || [])
              .filter((asset) => asset.image)
              .slice(0, 6) as Array<NonNullable<VisualAdsState['assets']>[number]>;

            if (!assetEntries.length) {
              toast.error(language === 'ar' ? 'الرجاء رفع صورة واحدة على الأقل' : 'Please upload at least one image');
              return;
            }

            const compressImage = async (dataUri: string, preserveAlpha = false): Promise<string> => {
              if (!dataUri.startsWith('data:image/')) return dataUri;
              return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;
                  const MAX_SIZE = 1200;
                  if (width > height && width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                  } else if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                  }

                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) return resolve(dataUri);

                  ctx.drawImage(img, 0, 0, width, height);
                  resolve(preserveAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = () => resolve(dataUri);
                img.src = dataUri;
              });
            };

            const isolateTransparentLogo = async (dataUri: string): Promise<string> => {
              if (!dataUri.startsWith('data:image/')) return dataUri;
              return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement('canvas');
                  canvas.width = img.width;
                  canvas.height = img.height;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) return resolve(dataUri);

                  ctx.drawImage(img, 0, 0);
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  const pixelData = imageData.data;
                  const { width, height } = imageData;
                  const visited = new Uint8Array(width * height);
                  const queue: Array<[number, number]> = [
                    [0, 0],
                    [width - 1, 0],
                    [0, height - 1],
                    [width - 1, height - 1],
                  ];

                  const isRemovableBackgroundPixel = (offset: number) => {
                    const alpha = pixelData[offset + 3];
                    if (alpha < 20) return true;
                    const red = pixelData[offset];
                    const green = pixelData[offset + 1];
                    const blue = pixelData[offset + 2];
                    const max = Math.max(red, green, blue);
                    const min = Math.min(red, green, blue);
                    const brightness = (red + green + blue) / 3;
                    return brightness > 215 && (max - min) < 40;
                  };

                  while (queue.length) {
                    const current = queue.pop();
                    if (!current) continue;
                    const [x, y] = current;
                    if (x < 0 || y < 0 || x >= width || y >= height) continue;
                    const index = y * width + x;
                    if (visited[index]) continue;
                    visited[index] = 1;

                    const offset = index * 4;
                    if (!isRemovableBackgroundPixel(offset)) continue;

                    pixelData[offset + 3] = 0;
                    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
                  }

                  ctx.putImageData(imageData, 0, 0);

                  let minX = width;
                  let minY = height;
                  let maxX = -1;
                  let maxY = -1;
                  for (let y = 0; y < height; y += 1) {
                    for (let x = 0; x < width; x += 1) {
                      const offset = (y * width + x) * 4;
                      if (pixelData[offset + 3] > 0) {
                        if (x < minX) minX = x;
                        if (y < minY) minY = y;
                        if (x > maxX) maxX = x;
                        if (y > maxY) maxY = y;
                      }
                    }
                  }

                  if (maxX < minX || maxY < minY) {
                    resolve(dataUri);
                    return;
                  }

                  const padding = Math.max(12, Math.round(Math.max(maxX - minX, maxY - minY) * 0.08));
                  const cropX = Math.max(0, minX - padding);
                  const cropY = Math.max(0, minY - padding);
                  const cropWidth = Math.min(width - cropX, maxX - minX + 1 + padding * 2);
                  const cropHeight = Math.min(height - cropY, maxY - minY + 1 + padding * 2);
                  const cropped = document.createElement('canvas');
                  cropped.width = cropWidth;
                  cropped.height = cropHeight;
                  const croppedCtx = cropped.getContext('2d');
                  if (!croppedCtx) {
                    resolve(canvas.toDataURL('image/png'));
                    return;
                  }

                  croppedCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
                  resolve(cropped.toDataURL('image/png'));
                };
                img.onerror = () => resolve(dataUri);
                img.src = dataUri;
              });
            };

            const prepareAssetImage = async (asset: NonNullable<VisualAdsState['assets']>[number]) => {
              const originalImage = asset.image as string;
              if (asset.type === 'logo' && asset.logoMode === 'transparent') {
                const isolated = await isolateTransparentLogo(originalImage);
                return compressImage(isolated, true);
              }
              return compressImage(originalImage, false);
            };

            const preUploadImageToStorage = async (dataUri: string): Promise<string> => {
              if (!dataUri.startsWith('data:image/')) return dataUri;
              if (!user?.id) return dataUri;
              try {
                const res = await fetch(dataUri);
                const blob = await res.blob();
                const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
                const fileName = `${user.id}/visual-ads-input/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
                
                const { error: uploadErr } = await supabase.storage
                  .from('message_attachments')
                  .upload(fileName, blob, { contentType: blob.type, upsert: true });
                  
                if (uploadErr) {
                  console.error('Storage upload error:', uploadErr);
                  return dataUri;
                }
                
                const { data: signedData, error: signErr } = await supabase.storage
                  .from('message_attachments')
                  .createSignedUrl(fileName, 60 * 60 * 6);
                  
                if (signErr || !signedData?.signedUrl) {
                  return dataUri;
                }
                
                return signedData.signedUrl;
              } catch (e) {
                console.error('Failed to pre-upload image:', e);
                return dataUri;
              }
            };

            setIsGenerating(true);
            setResultError(null);
            setResultImageUrl(null);
            setResultUrls([]);
            setPickerIndex(0);
            setIsSaved(false);
            setSavedBucketUrl(null);
            setSavedImageId(null);
            setSavedSourceUrl(null);
            startProgress();

            try {
              type VisualAdsPreparedAsset = {
                asset: NonNullable<VisualAdsState['assets']>[number];
                preparedImage: string;
                types: string[];
                instructionOverride?: string;
              };

              const sentAssets: VisualAdsPreparedAsset[] = await Promise.all(
                assetEntries.slice(0, MAX_VISUAL_AD_IMAGES).map(async (asset) => {
                  const preparedDataUri = await prepareAssetImage(asset);
                  const finalUrlOrDataUri = await preUploadImageToStorage(preparedDataUri);
                  return {
                    asset,
                    preparedImage: finalUrlOrDataUri,
                    types: asset.type ? [asset.type] : [],
                  };
                })
              );

              if (!sentAssets.length) {
                throw new Error(language === 'ar' ? 'تعذر تجهيز الصور للإرسال' : 'Failed to prepare images for generation');
              }

              const taggedAssets = sentAssets.filter((item) => item.types.length > 0);
              const taggedTypes = taggedAssets.flatMap((item) => item.types);
              const hasPerson = taggedTypes.includes('person');
              const hasScreenshot = taggedTypes.includes('screenshot');
              const hasBackground = taggedTypes.includes('background');
              const hasProduct = taggedTypes.includes('product');
              const hasLogo = taggedTypes.includes('logo');
              const exactPersonAssets = taggedAssets.filter((item) => item.types.includes('person') && (item.asset.personMode || 'exact') === 'exact');
              const hasExactPerson = exactPersonAssets.length > 0;

              const toBool = (value: boolean) => value ? 'true' : 'false';
              const toQuoted = (value: string) => `"${value.replace(/"/g, '\\"')}"`;
              const buildSection = (title: string, lines: string[]) => [title, ...lines].join('\n');

              const imageSourceLines = taggedAssets.flatMap((item, index) => {
                const sourceId = getSourceId(index);
                const lines = [
                  `- ${sourceId}:`,
                  `    image_ref: Image ${index + 1}`,
                  `    role: ${getAssetLabel(item.asset)}`,
                ];
                if (item.asset.type === 'person') {
                  lines.push(`    person_mode: ${(item.asset.personMode || 'exact')}`);
                  if ((item.asset.personMode || 'exact') === 'exact') {
                    lines.push(`    pose_mode: ${(item.asset.exactPersonStyle || 'same-pose')}`);
                  }
                  if (item.asset.personMode === 'reference' && item.asset.referenceStyle) {
                    lines.push(`    reference_style: ${item.asset.referenceStyle}`);
                  }
                }
                if (item.asset.type === 'logo') {
                  lines.push(`    logo_mode: ${(item.asset.logoMode || 'transparent')}`);
                }
                if (item.asset.type === 'screenshot') {
                  lines.push(`    device: ${getScreenshotDevice(item.asset)}`);
                }
                return lines;
              });

              const assetDirectiveLines = taggedAssets.flatMap((item, index) => {
                const sourceId = getSourceId(index);
                const role = getAssetLabel(item.asset);
                if (item.asset.type === 'background') {
                  return [
                    `- background:`,
                    `    source: ${sourceId}`,
                    `    preserve_core_identity: true`,
                    `    use_as_real_background_foundation: true`,
                    `    replace_environment: false`,
                    `    allow_color_grading: true`,
                    `    allow_depth_of_field: true`,
                    `    allow_cinematic_styling: true`,
                  ];
                }
                if (item.asset.type === 'person') {
                  if (item.asset.personMode === 'reference') {
                    return [
                      `- person:`,
                      `    source: ${sourceId}`,
                      `    role: person`,
                      `    person_mode: reference`,
                      `    reference_style: ${(item.asset.referenceStyle || 'realistic')}`,
                      `    preserve_identity_direction: true`,
                      `    exact_match_required: false`,
                      `    stylize_into_character: ${toBool((item.asset.referenceStyle || 'realistic') === 'character')}`,
                    ];
                  }
                  return [
                    `- person:`,
                    `    source: ${sourceId}`,
                    `    role: person`,
                    `    person_mode: exact`,
                    `    pose_mode: ${(item.asset.exactPersonStyle || 'same-pose')}`,
                    `    preserve_core_identity: true`,
                    `    exact_match_required: true`,
                    `    allow_new_pose: ${toBool(item.asset.exactPersonStyle === 'adapted-pose')}`,
                    `    keep_pose_close: ${toBool((item.asset.exactPersonStyle || 'same-pose') === 'same-pose')}`,
                    `    face_visibility_required: true`,
                    `    framing: ${item.asset.exactPersonStyle === 'upper-body' ? 'upper-body' : 'flexible'}`,
                    `    beautify: false`,
                    `    recast: false`,
                    `    stylize_into_character: false`,
                  ];
                }
                if (item.asset.type === 'logo') {
                  const logoMode = item.asset.logoMode || 'transparent';
                  return [
                    `- logo:`,
                    `    source: ${sourceId}`,
                    `    role: logo`,
                    `    logo_mode: ${logoMode}`,
                    `    preserve_core_identity: true`,
                    `    preserve_design: true`,
                    `    remove_plain_surrounding_background_only_if_needed: ${toBool(logoMode === 'transparent')}`,
                    `    preserve_original_background_treatment: ${toBool(logoMode === 'as-is')}`,
                    `    redraw: false`,
                    `    distort: false`,
                    `    crop: false`,
                    `    restyle: false`,
                    `    put_in_container: false`,
                    `    put_in_badge: false`,
                    `    put_in_app_icon_frame: false`,
                  ];
                }
                if (item.asset.type === 'screenshot') {
                  return [
                    `- screenshot:`,
                    `    source: ${sourceId}`,
                    `    role: screenshot`,
                    `    preserve_core_identity: true`,
                    `    preserve_ui: true`,
                    `    keep_readable: true`,
                    `    device: ${getScreenshotDevice(item.asset)}`,
                    `    use_inside_device_mockup: true`,
                    `    reuse_names_from_ui_as_copy: false`,
                    `    reuse_usernames_from_ui_as_copy: false`,
                  ];
                }
                if (item.asset.type === 'product') {
                  return [
                    `- product:`,
                    `    source: ${sourceId}`,
                    `    role: product`,
                    `    preserve_core_identity: true`,
                    `    must_remain_recognizable: true`,
                    `    use_as_hero: true`,
                    `    premium_lighting: true`,
                    `    redesign_product: false`,
                  ];
                }
                if (item.asset.type === 'icon') {
                  return [`- icon:`, `    source: ${sourceId}`, `    role: icon`, `    use_as_supporting_element: true`, `    overpower_main_subjects: false`];
                }
                if (item.asset.type === 'prop') {
                  return [`- prop:`, `    source: ${sourceId}`, `    role: prop`, `    use_as_supporting_scene_element: true`, `    overpower_main_subjects: false`];
                }
                if (item.asset.type === 'mascot') {
                  return [`- mascot:`, `    source: ${sourceId}`, `    role: mascot`, `    preserve_core_identity: true`, `    must_remain_recognizable: true`, `    use_as_brand_character: true`, `    redesign: false`];
                }
                if (item.asset.type === 'texture') {
                  return [`- texture:`, `    source: ${sourceId}`, `    role: texture`, `    use_as_surface_or_background_texture: true`, `    overpower_main_subjects: false`, `    preserve_exact_layout: false`];
                }
                if (item.asset.type === 'illustration') {
                  return [`- illustration:`, `    source: ${sourceId}`, `    role: illustration`, `    preserve_core_identity: true`, `    use_as_supporting_graphic_element: true`, `    overpower_main_subjects: false`];
                }
                return [`- ${role}:`, `    source: ${sourceId}`, `    role: ${role}`];
              });

              let layoutType = 'general_composite_ad';
              const primarySubjects: string[] = [];
              const secondarySubjects: string[] = [];
              const backgroundAsset = taggedAssets.find((item) => item.asset.type === 'background');
              const logoAsset = taggedAssets.find((item) => item.asset.type === 'logo');
              const personAsset = taggedAssets.find((item) => item.asset.type === 'person');
              const screenshotAsset = taggedAssets.find((item) => item.asset.type === 'screenshot');
              const productAsset = taggedAssets.find((item) => item.asset.type === 'product');

              if (hasPerson && hasScreenshot && hasBackground) {
                layoutType = 'lifestyle_app_ad';
              } else if (hasPerson && hasProduct && hasBackground) {
                layoutType = 'lifestyle_product_ad';
              } else if (hasPerson && hasBackground && !hasScreenshot && !hasProduct) {
                layoutType = 'brand_lifestyle_moment';
              } else if (hasPerson && hasScreenshot && !hasBackground) {
                layoutType = 'app_ad_without_background';
              } else if (!hasPerson && hasScreenshot && hasBackground && hasLogo) {
                layoutType = 'pure_app_product_poster';
              } else if (!hasPerson && hasProduct && hasBackground) {
                layoutType = 'product_hero_shot';
              }

              if (personAsset) primarySubjects.push(getSourceId(taggedAssets.indexOf(personAsset)));
              if (screenshotAsset) primarySubjects.push(getSourceId(taggedAssets.indexOf(screenshotAsset)));
              if (!primarySubjects.length && productAsset) primarySubjects.push(getSourceId(taggedAssets.indexOf(productAsset)));
              if (logoAsset) secondarySubjects.push(getSourceId(taggedAssets.indexOf(logoAsset)));

              const allowedText = visualState.creativeSoul.cta === 'custom'
                ? (customCta ? [customCta] : [])
                : (visualState.creativeSoul.cta ? [
                  {
                    'download-now': 'Download now',
                    'get-started': 'Get started',
                    'shop-now': 'Shop now',
                    'learn-more': 'Learn more',
                    'book-now': 'Book now',
                    'start-free': 'Start free',
                    'try-today': 'Try it today',
                    'join-now': 'Join now',
                    'subscribe': 'Subscribe',
                  }[visualState.creativeSoul.cta] || ''
                ].filter(Boolean) : []);

              const roleAndRules = buildSection('ROLE_AND_RULES', [
                `- task: Create one premium advertising poster using the uploaded assets and selected settings.`,
                `- must_follow_tagged_roles: true`,
                `- must_preserve_exact_person_identity: ${toBool(hasExactPerson)}`,
                `- must_preserve_logo_fidelity: ${toBool(hasLogo)}`,
                `- must_preserve_screenshot_fidelity: ${toBool(hasScreenshot)}`,
                `- must_preserve_background_identity: ${toBool(hasBackground)}`,
                `- allow_invented_text: false`,
                `- allow_invented_names: false`,
                `- allow_invented_testimonials: false`,
                `- hard_constraints_override_style: true`,
                `- priority_order:`,
                `  1. exact_person_identity`,
                `  2. logo_fidelity`,
                `  3. screenshot_fidelity`,
                `  4. background_identity`,
                `  5. composition_clarity`,
                `  6. campaign_message`,
                `  7. style_polish`,
              ]);

              const outputTarget = buildSection('OUTPUT_TARGET', [
                `- format: ${visualState.campaignDNA.platform || '1:1'}`,
                `- output_count: 1`,
                `- output_type: advertising_poster`,
                `- composition_goal: one_unified_composition`,
                `- collage_look_allowed: false`,
                `- quality_level: premium`,
              ]);

              const imageSources = buildSection('IMAGE_SOURCES', imageSourceLines);
              const assetDirectives = buildSection('ASSET_DIRECTIVES', assetDirectiveLines);

              const campaignLines = [
                `- campaign:`,
                `    main_message: ${visualState.creativeSoul.mainMessage === 'custom' ? 'custom' : (topicLabels[visualState.creativeSoul.mainMessage] || 'none')}`,
                ...(visualState.creativeSoul.mainMessage === 'custom' && customTopic ? [`    main_message_custom_text: ${toQuoted(customTopic)}`] : []),
                ...(visualState.creativeSoul.mainMessage !== 'custom' && visualState.creativeSoul.mainMessageVariant ? [`    main_message_detail: ${topicVariantLabels[visualState.creativeSoul.mainMessage]?.[visualState.creativeSoul.mainMessageVariant] || visualState.creativeSoul.mainMessageVariant}`] : []),
                ...(canUseFeatureChips && featureChips.length ? [`    feature_points: [${featureChips.map(toQuoted).join(', ')}]`] : []),
                ...(allowedText.length ? [`    cta_text: ${toQuoted(allowedText[0])}`] : []),
              ];

              const compositionLines = [
                `- composition:`,
                `    layout_type: ${layoutType}`,
                `    primary_subjects: ${primarySubjects.length ? `[${primarySubjects.join(', ')}]` : '[]'}`,
                `    secondary_subjects: ${secondarySubjects.length ? `[${secondarySubjects.join(', ')}]` : '[]'}`,
                `    background_source: ${backgroundAsset ? getSourceId(taggedAssets.indexOf(backgroundAsset)) : 'none'}`,
                `    logo_source: ${logoAsset ? getSourceId(taggedAssets.indexOf(logoAsset)) : 'none'}`,
                `    face_must_remain_visible: ${toBool(Boolean(personAsset))}`,
                `    device_must_not_block_face: ${toBool(Boolean(personAsset && screenshotAsset))}`,
                `    must_feel_unified: true`,
              ];

              const styleLines = [
                `- style:`,
                `    primary_style: ${visualState.creativeSoul.style === 'custom' ? 'custom' : (styleLabels[visualState.creativeSoul.style] || 'none')}`,
                ...(visualState.creativeSoul.style === 'custom' && customStyle ? [`    style_custom_text: ${toQuoted(customStyle)}`] : []),
                ...(visualState.creativeSoul.style !== 'custom' && visualState.creativeSoul.styleVariant ? [`    style_detail: ${styleVariantLabels[visualState.creativeSoul.style]?.[visualState.creativeSoul.styleVariant] || visualState.creativeSoul.styleVariant}`] : []),
                `    style_can_affect: [lighting, color, typography_mood, graphic_energy]`,
                `    style_cannot_override: [exact_person_identity, logo_fidelity, screenshot_fidelity, background_identity]`,
              ];

              const textLines = [
                `- text:`,
                `    allowed_text: ${allowedText.length ? `[${allowedText.map(toQuoted).join(', ')}]` : '[]'}`,
                `    allow_generated_headline: false`,
                `    allow_generated_tagline: false`,
                `    allow_generated_social_proof_copy: false`,
                `    allow_generated_testimonials: false`,
              ];

              const scenePlan = buildSection('SCENE_PLAN', [
                ...campaignLines,
                ...compositionLines,
                ...styleLines,
                ...textLines,
              ]);

              const finalPromptForKie = [
                roleAndRules,
                outputTarget,
                imageSources,
                assetDirectives,
                scenePlan,
              ].join('\n\n');
              const visualAdsSpec = {
                language: language === 'ar' ? 'ar' : 'en',
                aspect_ratio: visualState.campaignDNA.platform || '1:1',
                objective: normalizeShortValue(visualState.campaignDNA.objective) || null,
                assets: taggedAssets.map((item, index) => ({
                  source_id: getSourceId(index),
                  image_ref: `Image ${index + 1}`,
                  role: getAssetLabel(item.asset),
                  custom_role: item.asset.customType || null,
                  person_mode: item.asset.type === 'person' ? (item.asset.personMode || 'exact') : null,
                  pose_mode: item.asset.type === 'person' && (item.asset.personMode || 'exact') === 'exact' ? (item.asset.exactPersonStyle || 'same-pose') : null,
                  reference_style: item.asset.type === 'person' && item.asset.personMode === 'reference' ? (item.asset.referenceStyle || 'realistic') : null,
                  logo_mode: item.asset.type === 'logo' ? (item.asset.logoMode || 'transparent') : null,
                  screenshot_device: item.asset.type === 'screenshot' ? getScreenshotDevice(item.asset) : null,
                })),
                campaign: {
                  main_message_id: visualState.creativeSoul.mainMessage || null,
                  main_message_prompt: visualState.creativeSoul.mainMessage === 'custom'
                    ? customTopic || null
                    : selectedTopicChip?.prompt || null,
                  main_message_custom_text: visualState.creativeSoul.mainMessage === 'custom' ? customTopic || null : null,
                  main_message_detail_id: visualState.creativeSoul.mainMessageVariant || null,
                  main_message_detail_prompt: selectedTopicVariant?.prompt || null,
                  feature_chips: canUseFeatureChips ? featureChips : [],
                  require_exact_feature_chips: canUseFeatureChips && featureChips.length > 0,
                  cta_id: visualState.creativeSoul.cta || null,
                  cta_text: allowedText[0] || null,
                  cta_prompt: selectedCtaChip?.label || null,
                },
                style: {
                  primary_style_id: visualState.creativeSoul.style || null,
                  primary_style_prompt: visualState.creativeSoul.style === 'custom'
                    ? customStyle || null
                    : selectedStyleChip?.prompt || null,
                  primary_style_custom_text: visualState.creativeSoul.style === 'custom' ? customStyle || null : null,
                  style_detail_id: visualState.creativeSoul.styleVariant || null,
                  style_detail_prompt: selectedStyleVariant?.prompt || null,
                },
                composition: {
                  layout_type: layoutType,
                  primary_subjects: primarySubjects,
                  secondary_subjects: secondarySubjects,
                  background_source: backgroundAsset ? getSourceId(taggedAssets.indexOf(backgroundAsset)) : null,
                  logo_source: logoAsset ? getSourceId(taggedAssets.indexOf(logoAsset)) : null,
                  face_must_remain_visible: Boolean(personAsset),
                  device_must_not_block_face: Boolean(personAsset && screenshotAsset),
                  must_feel_unified: true,
                },
                text_policy: {
                  allowed_text: allowedText,
                  allowed_feature_labels: canUseFeatureChips ? featureChips : [],
                  allow_generated_headline: false,
                  allow_generated_tagline: false,
                  allow_generated_social_proof_copy: false,
                  allow_generated_testimonials: false,
                },
                hard_constraints: {
                  must_follow_tagged_roles: true,
                  must_preserve_exact_person_identity: hasExactPerson,
                  must_preserve_logo_fidelity: hasLogo,
                  must_preserve_screenshot_fidelity: hasScreenshot,
                  must_preserve_background_identity: hasBackground,
                  allow_invented_text: false,
                  allow_invented_names: false,
                  allow_invented_testimonials: false,
                  hard_constraints_override_style: true,
                  priority_order: [
                    'exact_person_identity',
                    'logo_fidelity',
                    'screenshot_fidelity',
                    'background_identity',
                    'composition_clarity',
                    'campaign_message',
                    'style_polish',
                  ],
                },
                legacy_prompt: finalPromptForKie,
              };
              const validImages = sentAssets.map((item) => item.preparedImage);

              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.access_token) throw new Error('Not authenticated');

              const visualAdsRemoteUrls = validImages.filter((image) => typeof image === 'string' && !image.startsWith('data:image/'));
              const visualAdsDataUris = validImages.filter((image) => typeof image === 'string' && image.startsWith('data:image/'));
              const visualAdsFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/freepik-visual-ads`;

              const res = await fetch(visualAdsFunctionUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  mode: 'async',
                  action: 'create',
                  generation_type: 'visual_ads',
                  generationMode: 'visual_ads',
                  images: validImages,
                  input_urls: visualAdsRemoteUrls,
                  uploaded_images: visualAdsDataUris,
                  prompt: finalPromptForKie,
                  visual_ads_spec: visualAdsSpec,
                  aspect_ratio: visualState.campaignDNA.platform,
                }),
              });

              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to start Visual Ads generation');
              }

              const taskData = await res.json();
              if (taskData.videoUrl) {
                stopProgress();
                setResultImageUrl(taskData.videoUrl);
                setResultUrls([taskData.videoUrl]);
              } else if (taskData.task_id) {
                const taskId = taskData.task_id;

                // Wait for the webhook to update the DB row via Realtime.
                // KIE calls back → webhook writes to DB → Realtime pushes to frontend instantly.
                await new Promise<void>((resolve, reject) => {
                  const TIMEOUT_MS = 30 * 60 * 1000;
                  let settled = false;

                  let settle = (fn: () => void) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    supabase.removeChannel(channel);
                    fn();
                  };

                  const handleRow = (row: { status: string; result_urls?: string[]; error_msg?: string }) => {
                    if (row.status === 'COMPLETED') {
                      const finalUrl = row.result_urls?.[0];
                      if (finalUrl) {
                        settle(() => {
                          stopProgress();
                          setResultImageUrl(finalUrl);
                          setResultUrls(row.result_urls || [finalUrl]);
                          setIsSaved(true);
                          setSavedBucketUrl(finalUrl);
                          setSavedSourceUrl(finalUrl);
                          resolve();
                        });
                      } else {
                        settle(() => reject(new Error('Generation completed but no image URL returned')));
                      }
                    } else if (row.status === 'FAILED') {
                      settle(() => reject(new Error(row.error_msg || 'Ad generation failed')));
                    }
                  };

                  const timeoutId = setTimeout(() => {
                    settle(() => reject(new Error('Ad generation timed out. Please try again.')));
                  }, TIMEOUT_MS);

                  // Fallback polling in case WebSocket drops on mobile/background
                  const pollInterval = setInterval(async () => {
                    if (settled) {
                      clearInterval(pollInterval);
                      return;
                    }
                    try {
                      const supabaseJobs: any = supabase;
                      const { data } = await supabaseJobs
                        .from('visual_ads_jobs')
                        .select('status, result_urls, error_msg')
                        .eq('task_id', taskId)
                        .maybeSingle();
                      if (data) handleRow(data as any);
                      if (data?.status === 'COMPLETED' || data?.status === 'FAILED') return;

                      const statusRes = await fetch(visualAdsFunctionUrl, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({
                          mode: 'status',
                          generation_type: 'visual_ads',
                          task_id: taskId,
                        }),
                      });
                      if (!statusRes.ok) return;

                      const statusPayload = await statusRes.json().catch(() => null);
                      const statusData = statusPayload?.data;
                      if (statusData?.status === 'COMPLETED') {
                        const generatedUrls = Array.isArray(statusData.generated)
                          ? statusData.generated.filter((url: unknown): url is string => typeof url === 'string' && url.length > 0)
                          : [];
                        const finalUrl = generatedUrls[0] || (typeof statusData.video?.url === 'string' ? statusData.video.url : null);
                        if (finalUrl) {
                          settle(() => {
                            stopProgress();
                            setResultImageUrl(finalUrl);
                            setResultUrls(generatedUrls.length ? generatedUrls : [finalUrl]);
                            setIsSaved(false);
                            setSavedBucketUrl(null);
                            setSavedSourceUrl(null);
                            resolve();
                          });
                        }
                      } else if (statusData?.status === 'FAILED') {
                        settle(() => reject(new Error(statusData.error || 'Ad generation failed')));
                      }
                    } catch (e) {
                    }
                  }, 10000); // Poll every 10 seconds

                  const channel = supabase
                    .channel(`visual-ads-job-${taskId}`)
                    .on('postgres_changes', {
                      event: 'UPDATE',
                      schema: 'public',
                      table: 'visual_ads_jobs',
                      filter: `task_id=eq.${taskId}`,
                    }, (payload: any) => handleRow(payload.new))
                    .subscribe(async (status) => {
                      if (status !== 'SUBSCRIBED') return;
                      const supabaseJobs: any = supabase;
                      const { data } = await supabaseJobs
                        .from('visual_ads_jobs')
                        .select('status, result_urls, error_msg')
                        .eq('task_id', taskId)
                        .maybeSingle();
                      if (data) handleRow(data as any);
                    });

                  // Ensure polling cleanup on settle
                  const originalSettle = settle;
                  settle = (fn) => {
                    clearInterval(pollInterval);
                    originalSettle(fn);
                  };
                });
              } else {
                throw new Error('Failed to start task: no task_id returned');
              }
            } catch (err: any) {
              stopProgress();
              const msg = err?.message || (language === 'ar' ? 'فشل إنشاء الإعلان' : 'Ad generation failed');
              setResultError(msg);
              toast.error(msg);
            } finally {
              setIsGenerating(false);
            }
          }}
          isGenerating={isGenerating}
          progress={progress}
          resultUrl={resultImageUrl || undefined}
          onSave={() => {
            if (resultImageUrl) {
              persistGeneratedImage(resultImageUrl, { showSuccessToast: true, showAlreadySavedToast: true, triggerSaveSuccess: true }).catch(() => {});
            }
          }}
          onDownload={() => {
            if (resultImageUrl) {
              const a = document.createElement('a');
              a.href = resultImageUrl;
              a.download = `wakti-ad-${Date.now()}.png`;
              a.target = '_blank';
              a.click();
            }
          }}
          onTryAgain={() => {
            setResultImageUrl(null);
            setResultUrls([]);
            setResultError(null);
            stopProgress();
          }}
        />
      )}

      {/* ── Result Display Area (for non-visual-ads modes) ── */}
      {submode !== 'visual-ads' && (
      resultImageUrl ? (
        <div className="space-y-3">
          {/* Multi-image picker slideshow (Quick/Grok) */}
          {resultUrls.length > 1 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-purple-500 dark:text-purple-400">
                  {language === 'ar' ? `اختر صورة (${pickerIndex + 1}/${resultUrls.length})` : `Choose image (${pickerIndex + 1}/${resultUrls.length})`}
                </span>
                <div className="flex gap-1">
                  {resultUrls.map((_, i) => (
                    <button
                      key={i}
                      aria-label={`Image ${i + 1}`}
                      onClick={() => { selectQuickResult(i); }}
                      className={`h-2 rounded-full transition-all duration-200 ${
                        i === pickerIndex ? 'w-6 bg-purple-500' : 'w-2 bg-muted-foreground/30'
                      }`}
                    />
                  ))}
                </div>
              </div>
              {/* Horizontal scroll strip */}
              <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
                {resultUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => { selectQuickResult(i); }}
                    className={`flex-shrink-0 snap-center rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                      i === pickerIndex
                        ? 'border-purple-500 shadow-lg shadow-purple-500/30 scale-[1.03]'
                        : 'border-transparent opacity-60'
                    }`}
                    style={{ width: 90, height: 90 }}
                  >
                    <img src={url} alt={`Option ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main image canvas */}
          <div
            className="relative rounded-2xl overflow-hidden border border-border/50 shadow-xl bg-gradient-to-br from-black/5 to-black/10 dark:from-white/5 dark:to-white/10 cursor-pointer group"
            onClick={() => setLightboxOpen(true)}
          >
            <img
              src={resultImageUrl}
              alt="Generated"
              className="w-full max-h-[65vh] object-contain"
            />
            {/* Expand overlay hint */}
            <div className="absolute inset-0 bg-black/0 group-active:bg-black/20 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-active:opacity-100 transition-opacity bg-black/50 backdrop-blur-sm rounded-full p-3">
                <Maximize2 className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <ResultActions />
        </div>
      ) : (
        /* ── Empty Canvas Placeholder ── */
        <div className="rounded-2xl border-2 border-dashed border-border/40 bg-gradient-to-br from-orange-50/50 to-amber-50/30 dark:from-orange-950/20 dark:to-amber-950/10 flex flex-col items-center justify-center py-16 px-6 gap-3">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-orange-500/60" />
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            {language === 'ar'
              ? 'صورتك ستظهر هنا. اكتب وصفاً واضغط إنشاء.'
              : 'Your image will appear here. Write a prompt and hit Generate.'}
          </p>
        </div>
      ))}

      {/* ── Generation Controls Card ── */}
      {submode !== 'visual-ads' && (
      <div className="rounded-2xl border border-border/50 bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm p-4 space-y-4 shadow-sm">

        {/* Quality toggle (T2I + I2I) */}
        {(submode === 'text2image' || submode === 'image2image') && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {language === 'ar' ? 'الجودة' : 'Quality'}
              </span>
              <div className="flex bg-muted/50 rounded-lg p-0.5">
                <button
                  onClick={() => setQuality('quick')}
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 ${
                    quality === 'quick'
                      ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-md'
                      : 'text-muted-foreground'
                  }`}
                >
                  {language === 'ar' ? 'سريع جداً' : 'Quick'}
                </button>
                <button
                  onClick={() => setQuality('fast')}
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 ${
                    quality === 'fast'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                      : 'text-muted-foreground'
                  }`}
                >
                  {language === 'ar' ? 'سريع' : 'Fast'}
                </button>
                <button
                  onClick={() => setQuality('best_fast')}
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 ${
                    quality === 'best_fast'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                      : 'text-muted-foreground'
                  }`}
                >
                  {language === 'ar' ? 'أفضل' : 'Best'}
                </button>
              </div>
              {quality === 'quick' && (
                <span className="text-[10px] text-purple-500 dark:text-purple-400 font-medium">
                  {language === 'ar' ? '✦ متعدد الصور' : '✦ Multiple images'}
                </span>
              )}
            </div>
            {language === 'ar' && quality === 'quick' && (
              <div className="text-[10px] font-medium text-muted-foreground/80">
                ضعيف للنصوص
              </div>
            )}
          </div>
        )}

        {/* Image upload area (I2I, BG Removal & Visual Ads) */}
        {needsUpload && (
          <div className="space-y-3">
            <div>
              {uploadedFile ? (
                <div className="relative rounded-xl border border-border/50 shadow-sm overflow-visible bg-black/5 dark:bg-white/5 max-w-xs mx-auto">
                  <img
                    src={uploadedFile.preview || uploadedFile.url}
                    alt="Reference 1"
                    className="w-full rounded-xl object-contain max-h-48"
                    style={{ imageOrientation: 'from-image' }}
                  />
                  <button
                    onClick={() => setUploadedFile(null)}
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md active:scale-90 transition-transform z-10"
                    aria-label={language === 'ar' ? 'إزالة الصورة' : 'Remove image'}
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {submode === 'image2image' && (
                    <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md z-10">
                      {language === 'ar' ? 'صورة ١' : 'Ref 1'}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2 w-full max-w-xs mx-auto">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-6 border-2 border-dashed border-orange-300/50 dark:border-orange-700/30 rounded-xl flex flex-col items-center gap-2 text-muted-foreground hover:bg-orange-500/5 active:scale-[0.98] transition-all"
                  >
                    <ImagePlus className="h-7 w-7 text-orange-400" />
                    <span className="text-sm font-medium">
                      {submode === 'image2image'
                        ? (language === 'ar' ? 'رفع صورة ١' : 'Upload Image 1')
                        : (language === 'ar' ? 'اضغط لرفع صورة' : 'Tap to upload')}
                    </span>
                  </button>
                  <button
                    onClick={() => { setPickingForSlot(1); setShowSavedPicker(true); fetchSavedImages(); }}
                    className="w-full py-3 border-2 border-dashed border-orange-400/40 bg-gradient-to-br from-orange-500/5 via-amber-500/5 to-orange-400/5 rounded-xl flex flex-row items-center justify-center gap-2 text-orange-500 dark:text-orange-400 hover:border-orange-500 hover:shadow-[0_0_15px_hsla(25,95%,60%,0.2)] active:scale-[0.98] transition-all"
                  >
                    <GalleryHorizontalEnd className="h-5 w-5" />
                    <span className="text-sm font-semibold">
                      {language === 'ar' ? 'اختر من المحفوظات' : 'Pick from Saved'}
                    </span>
                  </button>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff" hidden />
            </div>

            {submode === 'image2image' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {language === 'ar' ? 'حتى ٤ صور مرجعية' : 'Up to 4 reference images'}
                  </div>
                  <button
                    onClick={() => setShowExtraReferenceImages((v) => !v)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/70 dark:bg-white/5 border border-border/50 text-muted-foreground active:scale-95 transition-all"
                  >
                    {showExtraReferenceImages
                      ? (language === 'ar' ? 'إخفاء' : 'Hide')
                      : (language === 'ar' ? '+ صور إضافية' : '+ More images')}
                  </button>
                </div>
                {(showExtraReferenceImages || uploadedFile2 || uploadedFile3 || uploadedFile4) && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    {uploadedFile2 ? (
                      <div className="relative rounded-xl border border-border/50 shadow-sm overflow-visible bg-black/5 dark:bg-white/5">
                        <img
                          src={uploadedFile2.preview || uploadedFile2.url}
                          alt="Reference 2"
                          className="w-full rounded-xl object-contain aspect-square"
                          style={{ imageOrientation: 'from-image' }}
                        />
                        <button
                          onClick={() => setUploadedFile2(null)}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md active:scale-90 transition-transform z-10"
                          aria-label={language === 'ar' ? 'إزالة الصورة الثانية' : 'Remove image 2'}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] font-semibold px-1 py-0.5 rounded-md z-10">
                          {language === 'ar' ? '٢' : 'Ref 2'}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full aspect-square flex flex-col gap-1">
                        <button
                          onClick={() => fileInputRef2.current?.click()}
                          className="flex-1 border-2 border-dashed border-[#858384]/30 dark:border-[#858384]/20 rounded-lg flex flex-col items-center justify-center gap-0 text-muted-foreground/70 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] active:scale-[0.98] transition-all"
                        >
                          <ImagePlus className="h-4 w-4 text-[#858384]/60" />
                          <span className="text-[10px] font-medium text-[#858384]/70">{language === 'ar' ? 'رفع ٢' : 'Upload 2'}</span>
                        </button>
                        <button
                          onClick={() => { setPickingForSlot(2); setShowSavedPicker(true); fetchSavedImages(); }}
                          className="flex-1 border-2 border-dashed border-orange-400/30 rounded-lg flex flex-col items-center justify-center gap-0 text-orange-500/80 hover:border-orange-500/50 hover:bg-orange-500/5 active:scale-[0.98] transition-all"
                        >
                          <GalleryHorizontalEnd className="h-4 w-4" />
                          <span className="text-[10px] font-medium">{language === 'ar' ? 'محفوظ' : 'Saved'}</span>
                        </button>
                      </div>
                    )}
                    <input type="file" ref={fileInputRef2} onChange={handleFileChange2} accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff" hidden />
                  </div>

                  <div>
                    {uploadedFile3 ? (
                      <div className="relative rounded-xl border border-border/50 shadow-sm overflow-visible bg-black/5 dark:bg-white/5">
                        <img
                          src={uploadedFile3.preview || uploadedFile3.url}
                          alt="Reference 3"
                          className="w-full rounded-xl object-contain aspect-square"
                          style={{ imageOrientation: 'from-image' }}
                        />
                        <button
                          onClick={() => setUploadedFile3(null)}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md active:scale-90 transition-transform z-10"
                          aria-label={language === 'ar' ? 'إزالة الصورة الثالثة' : 'Remove image 3'}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] font-semibold px-1 py-0.5 rounded-md z-10">
                          {language === 'ar' ? '٣' : 'Ref 3'}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full aspect-square flex flex-col gap-1">
                        <button
                          onClick={() => fileInputRef3.current?.click()}
                          className="flex-1 border-2 border-dashed border-[#858384]/30 dark:border-[#858384]/20 rounded-lg flex flex-col items-center justify-center gap-0 text-muted-foreground/70 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] active:scale-[0.98] transition-all"
                        >
                          <ImagePlus className="h-4 w-4 text-[#858384]/60" />
                          <span className="text-[10px] font-medium text-[#858384]/70">{language === 'ar' ? 'رفع ٣' : 'Upload 3'}</span>
                        </button>
                        <button
                          onClick={() => { setPickingForSlot(3); setShowSavedPicker(true); fetchSavedImages(); }}
                          className="flex-1 border-2 border-dashed border-orange-400/30 rounded-lg flex flex-col items-center justify-center gap-0 text-orange-500/80 hover:border-orange-500/50 hover:bg-orange-500/5 active:scale-[0.98] transition-all"
                        >
                          <GalleryHorizontalEnd className="h-4 w-4" />
                          <span className="text-[10px] font-medium">{language === 'ar' ? 'محفوظ' : 'Saved'}</span>
                        </button>
                      </div>
                    )}
                    <input type="file" ref={fileInputRef3} onChange={handleFileChange3} accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff" hidden />
                  </div>

                  <div>
                    {uploadedFile4 ? (
                      <div className="relative rounded-xl border border-border/50 shadow-sm overflow-visible bg-black/5 dark:bg-white/5">
                        <img
                          src={uploadedFile4.preview || uploadedFile4.url}
                          alt="Reference 4"
                          className="w-full rounded-xl object-contain aspect-square"
                          style={{ imageOrientation: 'from-image' }}
                        />
                        <button
                          onClick={() => setUploadedFile4(null)}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md active:scale-90 transition-transform z-10"
                          aria-label={language === 'ar' ? 'إزالة الصورة الرابعة' : 'Remove image 4'}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] font-semibold px-1 py-0.5 rounded-md z-10">
                          {language === 'ar' ? '٤' : 'Ref 4'}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full aspect-square flex flex-col gap-1">
                        <button
                          onClick={() => fileInputRef4.current?.click()}
                          className="flex-1 border-2 border-dashed border-[#858384]/30 dark:border-[#858384]/20 rounded-lg flex flex-col items-center justify-center gap-0 text-muted-foreground/70 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] active:scale-[0.98] transition-all"
                        >
                          <ImagePlus className="h-4 w-4 text-[#858384]/60" />
                          <span className="text-[10px] font-medium text-[#858384]/70">{language === 'ar' ? 'رفع ٤' : 'Upload 4'}</span>
                        </button>
                        <button
                          onClick={() => { setPickingForSlot(4); setShowSavedPicker(true); fetchSavedImages(); }}
                          className="flex-1 border-2 border-dashed border-orange-400/30 rounded-lg flex flex-col items-center justify-center gap-0 text-orange-500/80 hover:border-orange-500/50 hover:bg-orange-500/5 active:scale-[0.98] transition-all"
                        >
                          <GalleryHorizontalEnd className="h-4 w-4" />
                          <span className="text-[10px] font-medium">{language === 'ar' ? 'محفوظ' : 'Saved'}</span>
                        </button>
                      </div>
                    )}
                    <input type="file" ref={fileInputRef4} onChange={handleFileChange4} accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff" hidden />
                  </div>
                </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick chips — hidden when 2 images uploaded */}
        {needsUpload && uploadedFile && !uploadedFile2 && !uploadedFile3 && !uploadedFile4 && prompt === '' && (
          <div className="flex gap-2 flex-wrap">
            {getQuickChips().map((chip, i) => (
              <button
                key={i}
                onClick={() => setPrompt(chip.prompt)}
                className="px-3 py-1.5 bg-orange-100/80 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-full text-sm font-medium active:scale-95 transition-transform border border-orange-200/50 dark:border-orange-800/30"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Prompt input */}
        {showPrompt && (
          <div className="space-y-3">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={getPlaceholder()}
              className="min-h-[72px] resize-none rounded-xl border-border/50 bg-white/50 dark:bg-white/[0.02] text-base"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && canGenerate && !isGenerating) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />

            {/* I2I Arabic translate hint */}
            {submode === 'image2image' && language === 'ar' && hasArabic(prompt) && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 px-2.5 py-1 rounded-lg">
                  {language === 'ar' ? 'قبل الإرسال: اضغط "ترجمة".' : 'Translate before sending.'}
                </div>
                <button
                  onClick={handleTranslateI2I}
                  disabled={isTranslatingI2I}
                  className={`h-7 px-3 rounded-full text-xs font-semibold text-white shadow-md active:scale-95 transition-transform ${
                    isTranslatingI2I ? 'bg-blue-500 animate-pulse' : 'bg-blue-600'
                  }`}
                >
                  {isTranslatingI2I ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {language === 'ar' ? '...جارٍ' : 'Translating...'}
                    </span>
                  ) : (
                    language === 'ar' ? 'ترجمة' : 'Translate'
                  )}
                </button>
              </div>
            )}

            {/* Action buttons row */}
            <div className="flex items-center gap-2">
              {/* Amp button — always visible when there's a prompt */}
              {prompt.trim().length > 0 && (
                <button
                  onClick={handleAmp}
                  disabled={isAmping || isTranslatingI2I}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-500/10 to-violet-500/10 dark:from-purple-500/20 dark:to-violet-500/20 border border-purple-300/40 dark:border-purple-700/40 text-purple-700 dark:text-purple-300 active:scale-95 transition-all duration-200 disabled:opacity-50"
                >
                  <Wand2 className={`h-4 w-4 ${isAmping ? 'animate-spin' : ''}`} />
                  <span>{language === 'ar' ? 'تحسين' : 'Amp'}</span>
                </button>
              )}

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:shadow-none ml-auto"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{language === 'ar' ? `جارٍ... ${progress}%` : `${progress}%`}</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>{language === 'ar' ? 'إنشاء' : 'Generate'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {isGenerating && (
          <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
      )}

      {/* Error */}
      {resultError && !isGenerating && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/40 text-red-700 dark:text-red-300 text-sm font-medium">
          {resultError}
        </div>
      )}

      {/* Saved Images Picker Modal */}
      {showSavedPicker && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowSavedPicker(false)}
        >
          <div
            className="relative w-full max-w-lg max-h-[80vh] bg-background rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border/50 bg-muted/30 flex items-center justify-between sticky top-0 z-10 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <GalleryHorizontalEnd className="h-5 w-5 text-orange-500" />
                <h3 className="font-bold text-sm">
                  {language === 'ar' ? 'اختر من صورك المحفوظة' : 'Pick from Saved Images'}
                </h3>
              </div>
              <button
                onClick={() => setShowSavedPicker(false)}
                title={language === 'ar' ? 'إغلاق' : 'Close'}
                aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
                className="p-1.5 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              {loadingSaved ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                  <p className="text-sm font-medium">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
                </div>
              ) : savedImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                  <div className="p-4 rounded-full bg-muted/50">
                    <GalleryHorizontalEnd className="h-8 w-8 opacity-50" />
                  </div>
                  <p className="text-sm font-medium">{language === 'ar' ? 'لا توجد صور محفوظة' : 'No saved images found'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {savedImages.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => handlePickSaved(img.image_url)}
                      className="relative aspect-square rounded-xl overflow-hidden group focus:outline-none focus:ring-2 focus:ring-orange-500 active:scale-95 transition-all bg-muted"
                    >
                      <img
                        src={img.image_url}
                        alt="Saved"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
      <ImageSharePickerDialog
        isOpen={!!shareImageTarget}
        image={shareImageTarget}
        onClose={() => setShareImageTarget(null)}
        onSent={() => setShareImageTarget(null)}
      />
      <Lightbox />
    </>
  );
}
