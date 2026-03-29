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
} from 'lucide-react';
import { DrawAfterBGCanvas, DrawAfterBGCanvasRef } from '@/components/wakti-ai/DrawAfterBGCanvas';
import type { UploadedFile } from '@/types/fileUpload';

type ImageSubmode = 'text2image' | 'image2image' | 'background-removal' | 'draw';

const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL || 'https://hxauxozopvpzpdygoqwf.supabase.co').trim();

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
  const [showSecondImage, setShowSecondImage] = useState(false);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

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

  const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s || '');

  // ─── EXIF orientation reader (raw bytes) ───
  const readExifOrientation = (buffer: ArrayBuffer): number => {
    try {
      const view = new DataView(buffer);
      // Must start with JPEG SOI marker
      if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) return 1;
      let offset = 2;
      while (offset + 4 <= view.byteLength) {
        const marker = view.getUint16(offset, false);
        const segLen = view.getUint16(offset + 2, false);
        if (marker === 0xFFE1) {
          // APP1 — check for Exif header "Exif\0\0"
          if (offset + 10 > view.byteLength) break;
          const exifHeader = view.getUint32(offset + 4, false);
          if (exifHeader !== 0x45786966) { offset += 2 + segLen; continue; } // not "Exif"
          const tiffBase = offset + 10; // after "Exif\0\0"
          if (tiffBase + 8 > view.byteLength) break;
          const littleEndian = view.getUint16(tiffBase, false) === 0x4949;
          const ifdOffset = view.getUint32(tiffBase + 4, littleEndian);
          const ifdAbs = tiffBase + ifdOffset;
          if (ifdAbs + 2 > view.byteLength) break;
          const numTags = view.getUint16(ifdAbs, littleEndian);
          for (let i = 0; i < numTags; i++) {
            const tagOff = ifdAbs + 2 + i * 12;
            if (tagOff + 12 > view.byteLength) break;
            if (view.getUint16(tagOff, littleEndian) === 0x0112) {
              return view.getUint16(tagOff + 8, littleEndian);
            }
          }
          return 1;
        }
        if ((marker & 0xFF00) !== 0xFF00) break;
        offset += 2 + segLen;
      }
    } catch { /* ignore */ }
    return 1;
  };

  // ─── EXIF-aware orientation normalizer ───
  const normalizeImageOrientation = async (file: File): Promise<string> => {
    const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg'
      || /\.(jpe?g)$/i.test(file.name);
    const mimeOut = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const q = mimeOut === 'image/jpeg' ? 0.92 : undefined;

    // Read EXIF orientation from raw bytes (only meaningful for JPEG)
    let orientation = 1;
    if (isJpeg) {
      try {
        const buf = typeof file.arrayBuffer === 'function'
          ? await file.arrayBuffer()
          : await new Promise<ArrayBuffer>((res, rej) => {
              const fr = new FileReader();
              fr.onload = () => res(fr.result as ArrayBuffer);
              fr.onerror = rej;
              fr.readAsArrayBuffer(file);
            });
        orientation = readExifOrientation(buf);
      } catch { orientation = 1; }
    }

    // If no rotation needed, return plain base64
    if (orientation === 1) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    // Rotation needed — decode image then redraw rotated on canvas
    const objectUrl = URL.createObjectURL(file);
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const swap = orientation >= 5 && orientation <= 8;
        const w = swap ? img.height : img.width;
        const h = swap ? img.width : img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        switch (orientation) {
          case 2: ctx.transform(-1, 0, 0, 1, img.width, 0); break;
          case 3: ctx.transform(-1, 0, 0, -1, img.width, img.height); break;
          case 4: ctx.transform(1, 0, 0, -1, 0, img.height); break;
          case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
          case 6: ctx.transform(0, 1, -1, 0, img.height, 0); break;
          case 7: ctx.transform(0, -1, -1, 0, img.height, img.width); break;
          case 8: ctx.transform(0, -1, 1, 0, 0, img.width); break;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL(mimeOut, q));
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        // Last-resort fallback — raw base64 (display CSS will handle orientation)
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      };
      img.src = objectUrl;
    });
  };

  // ─── File upload handler ───
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/') && !file.name.toLowerCase().match(/\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff)$/)) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'الحد الأقصى 5 ميجابايت' : 'Max 5MB');
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

  const handleFileChange2 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/') && !file.name.toLowerCase().match(/\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff)$/)) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'الحد الأقصى 5 ميجابايت' : 'Max 5MB');
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
      if (pollJson?.status === 'done' && pollJson?.urls?.length) {
        return pollJson.urls as string[];
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
    const rawB64 = uploadedFile.base64 || uploadedFile.url || uploadedFile.preview || '';
    // Step 1: submit (uploads reference image + creates KIE task)
    const submitResp = await fetch(`${SUPABASE_URL}/functions/v1/wakti-grok-image2image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ user_prompt: prompt, image_base64: rawB64, user_id: user?.id }),
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
    const rawB64 = uploadedFile.base64 || uploadedFile.url || uploadedFile.preview || '';
    const rawB64_2 = uploadedFile2 ? (uploadedFile2.base64 || uploadedFile2.url || uploadedFile2.preview || '') : undefined;
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/wakti-image2image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ user_prompt: prompt, image_base64: rawB64, image_base64_2: rawB64_2, user_id: user?.id, quality }),
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

    if (isSaved && savedImageId) {
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
        const res = await fetch(imageUrl);
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
        if (row?.id) setSavedImageId(row.id);
      }

      setIsSaved(true);
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
  }, [user?.id, isSaved, savedImageId, savedBucketUrl, submode, prompt, quality, language, onSaveSuccess]);

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
  }, [submode, prompt, quality, uploadedFile, language, persistGeneratedImage]);

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
      triggerSaveSuccess: true,
    });
  };

  // ─── Submode config ───
  const submodes: { key: ImageSubmode; labelEn: string; labelAr: string; emoji: string }[] = [
    { key: 'text2image',         labelEn: 'Text → Image',  labelAr: 'نص ← صورة',      emoji: '✍️🖼️' },
    { key: 'image2image',        labelEn: 'Image → Image', labelAr: 'صورة ← صورة',     emoji: '🖼️✨' },
    { key: 'background-removal', labelEn: 'BG Removal',    labelAr: 'إزالة الخلفية',   emoji: '🪄✂️' },
    { key: 'draw',               labelEn: 'Draw',          labelAr: 'رسم',              emoji: '🎨' },
  ];

  const needsUpload = submode === 'image2image' || submode === 'background-removal';
  const showPrompt = submode !== 'draw';
  const canGenerate = submode === 'draw'
    ? true
    : (prompt.trim().length > 0 || (needsUpload && !!uploadedFile));

  // ─── Placeholder per submode ───
  const getPlaceholder = () => {
    if (language === 'ar') {
      switch (submode) {
        case 'text2image': return 'مثال: مقهى دافئ، سينمائي، إضاءة ناعمة';
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
      return [{ label: language === 'ar' ? '🧹 أزل الخلفية' : '🧹 Remove background', prompt: 'Remove the background' }];
    }
    if (submode === 'image2image') {
      return [
        { label: language === 'ar' ? '🎨 ألوان مائية' : '🎨 Watercolor', prompt: 'Convert to watercolor style' },
        { label: language === 'ar' ? '📺 كرتون/أنمي' : '📺 Cartoon/Anime', prompt: 'Make it cartoon/anime' },
        { label: language === 'ar' ? '✨ تحسين التفاصيل' : '✨ Enhance details', prompt: 'Enhance sharpness and details' },
        { label: language === 'ar' ? '🖤 أبيض وأسود' : '🖤 Black & White', prompt: 'Change to black and white' },
      ];
    }
    return [];
  };

  // Reset saved state when generating new image
  const resetForNewGeneration = () => {
    setUploadedFile2(null);
    setShowSecondImage(false);
    setResultImageUrl(null);
    setResultError(null);
    setIsSaved(false);
    setSavedBucketUrl(null);
    setSavedImageId(null);
  };

  // ─── Shared submode tabs component ───
  const SubmodeTabs = () => (
    <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
    <div className="flex gap-2 p-1.5 rounded-2xl bg-gradient-to-r from-[#0c0f14]/5 via-[#606062]/10 to-[#0c0f14]/5 dark:from-[#0c0f14] dark:via-[#1a1d24] dark:to-[#0c0f14] border border-[#606062]/20 dark:border-[#606062]/30 backdrop-blur-sm shadow-inner min-w-max">
      {submodes.map((m) => {
        const isActive = submode === m.key;
        return (
          <button
            key={m.key}
            onClick={() => { setSubmode(m.key); resetForNewGeneration(); setUploadedFile(null); setPrompt(''); }}
            title={language === 'ar' ? m.labelAr : m.labelEn}
            className={`relative flex items-center justify-center px-3 py-2.5 rounded-xl text-xl transition-all duration-200 min-h-[44px] min-w-[52px] touch-manipulation ${
              isActive
                ? 'bg-gradient-to-br from-[#060541] via-[#1a1a4a] to-[#060541] dark:from-[#f2f2f2] dark:via-[#e0e0e0] dark:to-[#f2f2f2] shadow-lg shadow-[#060541]/25 dark:shadow-white/25 scale-[1.04]'
                : 'bg-white/30 dark:bg-white/5 border border-[#606062]/20 dark:border-[#858384]/30 hover:bg-white/50 dark:hover:bg-white/15 active:scale-95'
            }`}
          >
            <span>{m.emoji}</span>
            {isActive && (
              <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-orange-500/20 dark:from-transparent dark:via-transparent dark:to-transparent pointer-events-none" />
            )}
          </button>
        );
      })}
    </div>
    </div>
  );

  // ─── Result actions bar (share, expand, save, download) ───
  const ResultActions = () => (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Save */}
      <button
        onClick={handleSave}
        disabled={isSaving || isSaved}
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 ${
          isSaved
            ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30'
            : 'bg-white/80 dark:bg-white/5 border border-border/50 text-foreground'
        }`}
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : isSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        <span>{isSaved ? (language === 'ar' ? 'تم الحفظ' : 'Saved') : (language === 'ar' ? 'حفظ' : 'Save')}</span>
      </button>

      {/* Download */}
      <button
        onClick={handleDownload}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-white/80 dark:bg-white/5 border border-border/50 text-foreground transition-all duration-200 active:scale-95"
      >
        <Download className="h-4 w-4" />
        <span>{language === 'ar' ? 'تحميل' : 'Download'}</span>
      </button>

      {/* Expand */}
      <button
        onClick={() => setLightboxOpen(true)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-white/80 dark:bg-white/5 border border-border/50 text-foreground transition-all duration-200 active:scale-95"
      >
        <Maximize2 className="h-4 w-4" />
        <span>{language === 'ar' ? 'توسيع' : 'Expand'}</span>
      </button>

      {/* Share */}
      <ShareButton
        shareUrl={savedImageId ? `${window.location.origin}/image/${savedImageId}` : (savedBucketUrl || resultImageUrl || '')}
        shareTitle={language === 'ar' ? 'صورة من Wakti AI' : 'Image from Wakti AI'}
        shareDescription={language === 'ar' ? 'تم إنشاؤها بواسطة Wakti AI' : 'Created with Wakti AI'}
        size="sm"
      />

      {/* Instagram */}
      {resultImageUrl && (
        <InstagramPublishButton
          mediaUrl={savedBucketUrl || resultImageUrl}
          mediaType="image"
          defaultCaption={''}
          language={language as 'en' | 'ar'}
        />
      )}

      {/* New */}
      <button
        onClick={() => { resetForNewGeneration(); setPrompt(''); }}
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
        {/* Bottom action bar in lightbox */}
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-xl rounded-2xl px-4 py-2.5 border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={handleDownload} className="flex items-center gap-1.5 text-white/90 text-sm font-medium active:scale-95 transition-transform">
            <Download className="h-4 w-4" /> {language === 'ar' ? 'تحميل' : 'Download'}
          </button>
          <div className="w-px h-5 bg-white/20" />
          <button onClick={handleSave} disabled={isSaved} className="flex items-center gap-1.5 text-white/90 text-sm font-medium active:scale-95 transition-transform">
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

  // Listen for quickPromptSelected events from DrawAfterBGCanvas
  React.useEffect(() => {
    if (submode !== 'draw') return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'string') setPrompt(detail);
    };
    window.addEventListener('quickPromptSelected', handler);
    return () => window.removeEventListener('quickPromptSelected', handler);
  }, [submode]);

  // ─── DRAW MODE ───
  if (submode === 'draw') {
    return (
      <div className="space-y-4">
        <SubmodeTabs />

        {/* DrawAfterBGCanvas uses h-full + flex-1 internally, so the parent must have explicit height */}
        <div className="h-[70vh] md:h-[75vh]">
          <DrawAfterBGCanvas ref={drawCanvasRef} prompt={prompt} />
        </div>

        {/* Prompt input + Send */}
        <div className="rounded-2xl border border-border/50 bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm p-3 flex items-end gap-2 shadow-sm">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={language === 'ar' ? 'صف ما تريد رسمه...' : 'Describe what you want to draw...'}
            className="flex-1 min-h-[44px] resize-none rounded-xl border-border/50 bg-white/50 dark:bg-white/[0.02] text-base"
            maxLines={2}
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

  // Map submode to trial feature key/limit/label. Draw mode is OPEN (no gate).
  const submodeTrialMap: Record<ImageSubmode, { key: string; limit: number; en: string; ar: string }> = {
    'text2image':         { key: 't2i',        limit: 2, en: 'Text to Image',      ar: 'نص إلى صورة' },
    'image2image':        { key: 'i2i',        limit: 2, en: 'Image to Image',     ar: 'صورة إلى صورة' },
    'background-removal': { key: 'bg_removal', limit: 2, en: 'Background Removal', ar: 'إزالة الخلفية' },
    'draw':               { key: '',           limit: 0, en: '',                    ar: '' },
  };
  const activeTrialInfo = submodeTrialMap[submode];

  // ─── MAIN RENDER (T2I, I2I, BG Removal) ───
  return (
    <>
    <TrialGateOverlay featureKey={activeTrialInfo.key} limit={activeTrialInfo.limit} featureLabel={{ en: activeTrialInfo.en, ar: activeTrialInfo.ar }} />
    <Lightbox />
    <div className="space-y-5">
      {/* Submode tabs */}
      <SubmodeTabs />

      {/* ── Result Display Area ── */}
      {resultImageUrl ? (
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
                      onClick={() => { setPickerIndex(i); setResultImageUrl(resultUrls[i]); }}
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
                    onClick={() => { setPickerIndex(i); setResultImageUrl(url); }}
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
      )}

      {/* ── Generation Controls Card ── */}
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

        {/* Image upload area (I2I & BG Removal) */}
        {needsUpload && (
          <div className="space-y-3">
            {/* Main image slot — always visible */}
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
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-8 border-2 border-dashed border-orange-300/50 dark:border-orange-700/30 rounded-xl flex flex-col items-center gap-2 text-muted-foreground active:scale-[0.98] transition-transform"
                >
                  <ImagePlus className="h-7 w-7 text-orange-400" />
                  <span className="text-sm font-medium">
                    {submode === 'image2image'
                      ? (language === 'ar' ? 'صورة ١' : 'Image 1')
                      : (language === 'ar' ? 'اضغط لرفع صورة' : 'Tap to upload')}
                  </span>
                </button>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff" hidden />
            </div>

            {/* Toggle for second image (I2I only) — below main image */}
            {submode === 'image2image' && (
              <div className="flex items-center justify-center gap-3 pt-1">
                <span className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'إضافة صورة ثانية (اختياري)' : 'Add second image (optional)'}
                </span>
                <button
                  onClick={() => {
                    setShowSecondImage(!showSecondImage);
                    if (showSecondImage) setUploadedFile2(null);
                  }}
                  className={`relative h-6 w-10 rounded-full transition-colors duration-200 ${showSecondImage ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  aria-label={language === 'ar' ? 'تبديل الصورة الثانية' : 'Toggle second image'}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${showSecondImage ? 'translate-x-4' : ''}`}
                  />
                </button>
              </div>
            )}

            {/* Second image slot — appears when toggle is on, half width */}
            {submode === 'image2image' && showSecondImage && (
              <div className="max-w-[50%] mx-auto">
                {uploadedFile2 ? (
                  <div className="relative rounded-xl border border-border/50 shadow-sm overflow-visible bg-black/5 dark:bg-white/5">
                    <img
                      src={uploadedFile2.preview || uploadedFile2.url}
                      alt="Reference 2"
                      className="w-full rounded-xl object-contain max-h-32"
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
                      {language === 'ar' ? 'صورة ٢ (اختياري)' : 'Ref 2 (optional)'}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef2.current?.click()}
                    className="w-full py-6 border-2 border-dashed border-[#858384]/30 dark:border-[#858384]/20 rounded-xl flex flex-col items-center gap-1.5 text-muted-foreground/70 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] active:scale-[0.98] transition-all"
                  >
                    <ImagePlus className="h-5 w-5 text-[#858384]/60" />
                    <span className="text-xs font-medium text-[#858384]/70">
                      {language === 'ar' ? 'اضغط لإضافة صورة' : 'Tap to add image'}
                    </span>
                  </button>
                )}
                <input type="file" ref={fileInputRef2} onChange={handleFileChange2} accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff" hidden />
              </div>
            )}
          </div>
        )}

        {/* Quick chips — hidden when 2 images uploaded */}
        {needsUpload && uploadedFile && !uploadedFile2 && prompt === '' && (
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

      {/* Error */}
      {resultError && !isGenerating && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/40 text-red-700 dark:text-red-300 text-sm font-medium">
          {resultError}
        </div>
      )}
    </div>
    </>
  );
}
