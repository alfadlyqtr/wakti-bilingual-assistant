import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import TrialGateOverlay from '@/components/TrialGateOverlay';
import { toast } from 'sonner';
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
import VisualAdsGenerator, { type VisualAdsState } from '@/components/studio/VisualAdsGenerator';

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
  const [savedBucketUrl, setSavedBucketUrl] = useState<string | null>(null);
  const [savedImageId, setSavedImageId] = useState<string | null>(null);
  const [savedSourceUrl, setSavedSourceUrl] = useState<string | null>(null);

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
      window.dispatchEvent(new CustomEvent('wakti-trial-limit-reached', { detail: { feature: submitJson?.feature || 't2i' } }));
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
      window.dispatchEvent(new CustomEvent('wakti-trial-limit-reached', { detail: { feature: submitJson?.feature || 'i2i' } }));
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
        window.dispatchEvent(new CustomEvent('wakti-trial-limit-reached', { detail: { feature: json?.feature || 't2i' } }));
        return null as unknown as string;
      }
      throw new Error(json?.error || 'Text2Image failed');
    }
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
        window.dispatchEvent(new CustomEvent('wakti-trial-limit-reached', { detail: { feature: json?.feature || 'i2i' } }));
        return null as unknown as string;
      }
      throw new Error(json?.error || 'Image2Image failed');
    }
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
        window.dispatchEvent(new CustomEvent('wakti-trial-limit-reached', { detail: { feature: json?.feature || 'bg_removal' } }));
        return null as unknown as string;
      }
      throw new Error(json?.error || 'Background edit failed');
    }
    const outUrl = json?.imageUrl || json?.URL || json?.imageDataURI || json?.dataURI || null;
    if (!outUrl) throw new Error('No image generated');
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
    if (!imageUrl || !user?.id) return false;

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
      return true;
    }

    setIsSaving(true);
    try {
      let bucketUrl = savedBucketUrl;
      let storagePath = '';

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
        setSavedImageId(row.id);
      }

      setIsSaved(true);
      setSavedSourceUrl(imageUrl);
      if (showSuccessToast) {
        toast.success(language === 'ar' ? 'تم الحفظ' : 'Saved');
      }
      if (triggerSaveSuccess) {
        onSaveSuccess?.();
      }
      return true;
    } catch (err: any) {
      console.error('Save failed:', err);
      if (showSuccessToast) {
        toast.error(language === 'ar' ? 'فشل الحفظ' : 'Save failed');
      }
      return false;
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
    }
    // Auto-save is fire-and-forget — skip for Quick (Grok) since user must choose which image to save
    if (generatedUrl && quality !== 'quick') {
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
    return [];
  };

  // ─── Shared submode tabs component ───
  const SubmodeTabs = () => (
    <div className="p-1 rounded-2xl bg-gradient-to-r from-[#0c0f14]/5 via-[#606062]/10 to-[#0c0f14]/5 dark:from-[#0c0f14] dark:via-[#1a1d24] dark:to-[#0c0f14] border border-[#606062]/20 dark:border-[#606062]/30 backdrop-blur-sm shadow-inner">
      <div className="grid grid-cols-2 gap-1.5">
        {submodes.map((m) => {
          const isActive = submode === m.key;
          const isVisualAds = m.key === 'visual-ads';
          return (
            <button
              key={m.key}
              onClick={() => { setSubmode(m.key); resetForNewGeneration(); setUploadedFile(null); setPrompt(''); }}
              title={language === 'ar' ? m.labelAr : m.labelEn}
              className={`relative flex items-center justify-center gap-2 px-3 py-3 rounded-xl transition-all duration-200 min-h-[58px] touch-manipulation ${
                isVisualAds ? 'col-span-2' : ''
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
              }`}>{language === 'ar' ? m.shortAr : m.shortEn}</span>
              {isActive && (
                <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 dark:from-transparent dark:via-transparent dark:to-transparent pointer-events-none" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

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

            const getAssetInstruction = (asset: NonNullable<VisualAdsState['assets']>[number], index: number) => {
              const imageNumber = index + 1;
              const assetLabel = getAssetLabel(asset);

              if (asset.type === 'screenshot') {
                return `Use the screenshot from [Image ${imageNumber}] clearly inside the phone screen. Keep the UI readable and premium. If names or usernames appear inside the screenshot UI, do not reuse them as poster headline, quote, testimonial, or community text unless the user explicitly typed that name in the prompt.`;
              }
              if (asset.type === 'logo') {
                if (asset.logoMode === 'as-is') {
                  return `Place the logo from [Image ${imageNumber}] near the top as a clear brand anchor, exactly as uploaded including its background. Keep it slightly bigger, easy to notice, and surrounded by breathing room. Do not hide it or make it tiny.`;
                }
                return `Place the logo from [Image ${imageNumber}] near the top as a clear brand anchor. Do not add any white box, panel, or background shape behind the logo — let it sit directly on the poster. Keep it slightly bigger, easy to notice, and surrounded by breathing room.`;
              }
              if (asset.type === 'product') {
                return `Make the product [Image ${imageNumber}] the main hero asset with premium commercial lighting.`;
              }
              if (asset.type === 'person') {
                if (asset.personMode === 'reference') {
                  return asset.referenceStyle === 'character'
                    ? `Use the person in [Image ${imageNumber}] as the reference inspiration for a styled character version. Keep the essence, styling cues, and identity direction from the upload while deliberately turning it into a designed character.`
                    : `Use the person in [Image ${imageNumber}] as a reference for a realistic human subject. Keep their identity direction, face structure, skin tone, clothing feel, and overall look close to the upload without turning them into a different random person.`;
                }
                return `The person in [Image ${imageNumber}] is the intended human subject. Use this exact person as closely as possible. Preserve their face, skin tone, clothing, and overall appearance. Do NOT swap them for a different person.`;
              }
              if (asset.type === 'background') {
                return `The background is [Image ${imageNumber}].`;
              }
              if (asset.type === 'icon') {
                return `Use the icon [Image ${imageNumber}] cleanly within the composition.`;
              }
              if (asset.type === 'prop') {
                return `Include [Image ${imageNumber}] as a decorative prop in the scene.`;
              }
              if (asset.type === 'mascot') {
                return `Feature the brand mascot [Image ${imageNumber}] prominently.`;
              }
              if (asset.type === 'texture') {
                return `Apply the texture [Image ${imageNumber}] to surfaces or backgrounds in the scene.`;
              }
              if (asset.type === 'illustration') {
                return `Use the illustration [Image ${imageNumber}] as a styled visual element in the layout.`;
              }
              return `Use [Image ${imageNumber}] as ${assetLabel} in the composition.`;
            };

            // Build prompt from visual ads state
            const topicPrompts: Record<string, string> = {
              'new-launch':    'The poster announces an exciting new product launch. Make it feel like a big moment — bold hero visual, high anticipation energy, dramatic reveal composition.',
              'limited-offer': 'The poster communicates urgency and scarcity — a limited-time offer. Use visual tension, countdown feeling, and strong contrast to make viewers feel they must act now.',
              'app-download':  'The poster promotes an app download. Showcase the app UI or key screen prominently, make it feel modern and tech-forward, with a clear and inviting download hook.',
              'save-time':     'The poster sells the idea of saving time and being more efficient. Use clean, fast, streamlined visuals — convey speed, relief, and smart productivity.',
              'premium':       'The poster communicates premium quality and craftsmanship. Everything should feel expensive — refined typography, dark or muted tones, generous whitespace, luxury product placement.',
              'social-proof':  'The poster builds trust through social proof — happy customers, reviews, or community. Warm, relatable, human-centered visuals. Authentic over polished.',
              'features':      'The poster highlights the product\'s key features. Use a structured layout with visual callouts, icons, or annotations that draw attention to each benefit.',
              'sale':          'The poster promotes a sale or discount. High contrast, bold price or percentage highlight, energetic and punchy design — the viewer must feel the deal immediately.',
            };
            const stylePrompts: Record<string, string> = {
              'premium-dark':   'Visual style: deep dark background (near black or charcoal), rich shadows, glowing product highlights, premium serif or modern sans-serif typography, dramatic cinematic lighting, high contrast.',
              'bright-clean':   'Visual style: bright white or very light background, clean open layout, generous whitespace, fresh pastel or bold accent color, modern minimalist typography, no clutter.',
              'bold-modern':    'Visual style: bold high-contrast design, strong graphic shapes, vivid saturated colors, thick impactful typography, dynamic diagonal composition, high energy layout.',
              'lifestyle':      'Visual style: real-world lifestyle photography feel, natural lighting, authentic human presence, warm color grading, organic imperfect texture, relatable and trustworthy tone.',
              'luxury-minimal': 'Visual style: extreme minimalism, luxury brand aesthetic, one or two muted tones, refined thin typography, massive whitespace, product placed like jewelry, quiet and confident.',
              'ugc':            'Visual style: organic user-generated content aesthetic, lo-fi phone camera feel, natural imperfect framing, authentic colors, no heavy design chrome — looks like something a real person posted.',
            };
            const ctaInstructions: Record<string, string> = {
              'download-now': 'Include the text "Download now" near the bottom as a bold poster CTA callout. It should feel like designed poster typography, not a real app button.',
              'get-started':  'Include the text "Get started" near the bottom as a bold poster CTA callout. Inviting and clear, but still poster text, not a tappable UI button.',
              'shop-now':     'Include the text "Shop now" near the bottom as a bold poster CTA callout. Punchy and high energy, but presented as poster text, not UI.',
              'learn-more':   'Include the text "Learn more" near the bottom as a clean poster CTA callout. Softer tone, well spaced, not a tappable UI button.',
              'book-now':     'Include the text "Book now" near the bottom as a bold poster CTA callout. Urgent and clear, but not a real interactive button.',
              'start-free':   'Include the text "Start free" near the bottom as a bold poster CTA callout. Welcoming and clear, but still poster text, not UI.',
              'try-today':    'Include the text "Try it today" near the bottom as a bold poster CTA callout. Friendly and easy, but not a real button.',
              'join-now':     'Include the text "Join now" near the bottom as a bold poster CTA callout. Warm and community-forward, but not a real interactive button.',
              'subscribe':    'Include the text "Subscribe" near the bottom as a clean poster CTA callout. Reliable and trust-building, not a tappable UI button.',
            };

            const normalizeShortValue = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();
            const customTopic = normalizeShortValue(visualState.creativeSoul.customMainMessage);
            const customCta = normalizeShortValue(visualState.creativeSoul.customCta);
            const customStyle = normalizeShortValue(visualState.creativeSoul.customStyle);

            const topicStr = visualState.creativeSoul.mainMessage === 'custom'
              ? (customTopic ? `The poster is about: ${customTopic}.` : '')
              : (topicPrompts[visualState.creativeSoul.mainMessage] || '');
            const styleStr = visualState.creativeSoul.style === 'custom'
              ? (customStyle ? `Visual style: ${customStyle}.` : '')
              : (stylePrompts[visualState.creativeSoul.style] || '');
            const ctaStr = visualState.creativeSoul.cta === 'custom'
              ? (customCta ? `Include the text "${customCta}" near the bottom as a clear, readable poster CTA callout. Treat it as poster typography, not as a real app button.` : '')
              : (ctaInstructions[visualState.creativeSoul.cta] || '');
            
            // Collect up to 6 images from assets array, compress them if they are data URIs
            const rawImages = (visualState.assets || [])
              .filter(a => a.image)
              .map(a => a.image as string)
              .slice(0, 6);
              
            if (!rawImages.length) {
              toast.error(language === 'ar' ? 'الرجاء رفع صورة واحدة على الأقل' : 'Please upload at least one image');
              return;
            }

            const compressImage = async (dataUri: string): Promise<string> => {
              if (!dataUri.startsWith('data:image/')) return dataUri;
              return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;
                  
                  // Max dimensions to ensure under 1MB (approx 1200px longest side)
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
                  resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = () => resolve(dataUri);
                img.src = dataUri;
              });
            };

            // 2. Identify Assets (Map tags to specific visual instructions)
            const taggedAssets = (visualState.assets || []).filter(a => a.image && a.type);
            
            // Re-order instructions so background is always first
            const backgroundInstruction = taggedAssets.find(a => a.type === 'background') 
              ? getAssetInstruction(taggedAssets.find(a => a.type === 'background')!, taggedAssets.findIndex(a => a.type === 'background'))
              : '';
            
            const otherInstructions = taggedAssets
              .filter(a => a.type !== 'background')
              .map((asset) => getAssetInstruction(asset, taggedAssets.indexOf(asset)))
              .join(' ');
              
            const assetInstructions = [backgroundInstruction, otherInstructions].filter(Boolean).join(' ');

            // Scene intelligence: detect asset combination and inject creative director composition
            const taggedTypes = taggedAssets.map(a => a.type);
            const hasPerson = taggedTypes.includes('person');
            const hasScreenshot = taggedTypes.includes('screenshot');
            const hasBackground = taggedTypes.includes('background');
            const hasProduct = taggedTypes.includes('product');
            const hasLogo = taggedTypes.includes('logo');
            let sceneDirection = '';
            if (hasPerson && hasScreenshot && hasBackground) {
              sceneDirection = 'Composition: lifestyle app ad. Place the person slightly off-center — they are the human anchor. Position the phone in front of or beside them at a natural angle, as if they are using it. The person\'s face and upper body must stay clearly visible — do NOT let the phone overlap or block their face. Background wraps atmospherically behind both with a soft cinematic blur. Warm, aspirational, real — not a flat product sheet.';
            } else if (hasPerson && hasProduct && hasBackground) {
              sceneDirection = 'Composition: lifestyle product ad. Person is natural in the environment, holding or interacting with the product. Face clearly visible, not blocked. Product prominent. Background wraps the scene. Warm natural lighting.';
            } else if (hasPerson && hasBackground && !hasScreenshot && !hasProduct) {
              sceneDirection = 'Composition: brand lifestyle moment. Person is the full hero. Off-center, natural stance in the environment. Cinematic lighting, genuine and aspirational.';
            } else if (hasPerson && hasScreenshot && !hasBackground) {
              sceneDirection = 'Composition: app lifestyle ad. Person beside the phone naturally. Face visible and unobstructed. Clean or gradient backdrop, premium feel.';
            } else if (!hasPerson && hasScreenshot && hasBackground && hasLogo) {
              sceneDirection = 'Composition: pure app product poster. Phone mockup centered or slightly tilted, screenshot on screen. Logo clean at the top. Background is the atmospheric stage. Professional product photography, no clutter.';
            } else if (!hasPerson && hasProduct && hasBackground) {
              sceneDirection = 'Composition: product hero shot. Product is the star, prominent with dramatic commercial lighting. Background wraps behind. Premium and clean.';
            }
            const creativeDirectorGuardrails = [
              'You are one of the best advertising poster creators and art directors in the world.',
              'Deliver an amazing poster that feels premium, intentional, and visually unified.',
              'Combine all uploaded assets intelligently instead of treating them like separate stickers.',
              'Do not reuse names or usernames seen inside screenshot UI as poster copy unless the user explicitly typed them in the prompt.',
            ].join(' ');

            // 3. Build the Final Clean Keyword Prompt for KIE
            const promptParts = [
              'Create a world-class advertising poster.',
              creativeDirectorGuardrails,
              topicStr,
              styleStr,
              assetInstructions,
              sceneDirection,
              ctaStr,
              visualState.creativeSoul.prompt?.trim() || '',
            ].filter(Boolean);
            const finalPromptForKie = promptParts.join(' ').replace(/\s+/g, ' ').trim();


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
              // Compress images concurrently
              const validImages = await Promise.all(rawImages.map(compressImage));

              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.access_token) throw new Error('Not authenticated');

              const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/freepik-image2video`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  mode: 'async',
                  generation_type: 'visual_ads',
                  images: validImages,
                  prompt: finalPromptForKie,
                  aspect_ratio: visualState.campaignDNA.platform,
                }),
              });

              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to start Visual Ads generation');
              }

              const taskData = await res.json();
              if (taskData.videoUrl) {
                // Synchronous fallback
                stopProgress();
                setResultImageUrl(taskData.videoUrl);
                setResultUrls([taskData.videoUrl]);
                persistGeneratedImage(taskData.videoUrl, { showSuccessToast: false, showAlreadySavedToast: false, triggerSaveSuccess: false }).catch(() => {});
                // Keep the user in the Visual Ads view
              } else if (taskData.task_id) {
                // Async polling
                const taskId = taskData.task_id;
                let isCompleted = false;
                let finalUrl = '';
                
                while (!isCompleted) {
                  await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
                  
                  const pollRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/freepik-image2video`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                      mode: 'status',
                      task_id: taskId,
                      increment_usage: true,
                    }),
                  });
                  
                  if (!pollRes.ok) continue;
                  
                  const pollData = await pollRes.json();
                  const status = pollData?.data?.status;
                  
                  if (status === 'COMPLETED') {
                    isCompleted = true;
                    finalUrl = pollData?.data?.video?.url || pollData?.data?.generated?.[0];
                  } else if (status === 'FAILED') {
                    throw new Error(pollData?.data?.error || 'Video generation failed');
                  }
                }
                
                if (finalUrl) {
                  stopProgress();
                  setResultImageUrl(finalUrl);
                  setResultUrls([finalUrl]);
                  // Auto-save immediately
                  persistGeneratedImage(finalUrl, { showSuccessToast: true, showAlreadySavedToast: false, triggerSaveSuccess: true }).catch(() => {});
                } else {
                  throw new Error('Video completed but no URL returned');
                }
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
    </>
  );
}
