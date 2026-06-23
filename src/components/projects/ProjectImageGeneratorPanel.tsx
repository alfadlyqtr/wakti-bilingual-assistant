import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles, Upload, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ALLOWED_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'auto'] as const;

type Submode = 'text2image' | 'image2image';
type ProjectImageTarget = 'website' | 'web_app';

export interface ProjectGeneratedImage {
  id: string | null;
  imageUrl: string;
  prompt: string;
  submode: Submode;
}

interface ProjectImageGeneratorPanelProps {
  isRTL?: boolean;
  initialPrompt?: string;
  onSaved?: (image: ProjectGeneratedImage) => void | Promise<void>;
  onUseImage?: (image: ProjectGeneratedImage) => void | Promise<void>;
  className?: string;
}

const toDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const MAX_REFERENCE_IMAGE_DIMENSION = 1536;
const REFERENCE_IMAGE_JPEG_QUALITY = 0.86;

const optimizeReferenceImageForGeneration = async (file: File): Promise<string> => {
  if (typeof createImageBitmap !== 'function') {
    return toDataUrl(file);
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const largestSide = Math.max(bitmap.width, bitmap.height);
    const scale = largestSide > MAX_REFERENCE_IMAGE_DIMENSION
      ? MAX_REFERENCE_IMAGE_DIMENSION / largestSide
      : 1;

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (typeof bitmap.close === 'function') bitmap.close();
      return toDataUrl(file);
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    if (typeof bitmap.close === 'function') bitmap.close();

    const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    return outputMime === 'image/jpeg'
      ? canvas.toDataURL(outputMime, REFERENCE_IMAGE_JPEG_QUALITY)
      : canvas.toDataURL(outputMime);
  } catch {
    return toDataUrl(file);
  }
};

const normalizeUrl = (url: string) => (url || '').replace(/%20/g, ' ').trim();

const resolveImageTargetFromPrompt = (value: string): ProjectImageTarget => {
  if (/\b(web\s*app|webapp|dashboard|admin|portal|platform|saas|application|app)\b/i.test(value) || /تطبيق|ويب\s*آب|لوحة\s*تحكم|منصة|بوابة/i.test(value)) {
    return 'web_app';
  }

  return 'website';
};

const buildImageTargetHint = (
  target: ProjectImageTarget,
  promptText: string,
  isRTL: boolean
) => {
  const prefersArabic = isRTL || /[\u0600-\u06FF]/.test(promptText);

  if (prefersArabic) {
    return target === 'web_app'
      ? 'سياق مهم: هذه الصورة مخصصة لواجهة تطبيق ويب للمستخدم. اجعلها مناسبة لمنتج رقمي حقيقي وبأسلوب نظيف واحترافي.'
      : 'سياق مهم: هذه الصورة مخصصة لموقع ويب للمستخدم. اجعلها مناسبة للاستخدام المباشر في موقع فعلي وبأسلوب نظيف واحترافي.';
  }

  return target === 'web_app'
    ? 'Important context: this image is for a user web app interface. Keep it product-ready, digital-first, and production quality.'
    : 'Important context: this image is for a user website. Keep it web-ready, clean, and production quality.';
};

const mergeAmpPromptPreservingOriginal = (originalPrompt: string, enhancedPrompt: string, isRTL: boolean) => {
  const original = originalPrompt.trim();
  const enhanced = enhancedPrompt.trim();

  if (!original) return enhanced;
  if (!enhanced) return original;

  const label = isRTL
    ? 'تحسينات إضافية (بدون حذف الفكرة الأصلية):'
    : 'Additional enhancement details (without removing your original idea):';

  return `${original}\n\n${label}\n${enhanced}`;
};

export function ProjectImageGeneratorPanel({
  isRTL = false,
  initialPrompt = '',
  onSaved,
  onUseImage,
  className,
}: ProjectImageGeneratorPanelProps) {
  const [submode, setSubmode] = useState<Submode>('text2image');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspectRatio, setAspectRatio] = useState<(typeof ALLOWED_RATIOS)[number]>('16:9');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceDataUrl, setReferenceDataUrl] = useState('');
  const [resultImage, setResultImage] = useState<ProjectGeneratedImage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAmpingPrompt, setIsAmpingPrompt] = useState(false);
  const [isUsingImage, setIsUsingImage] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0);

  const canGenerate = useMemo(() => {
    const hasPrompt = Boolean(prompt.trim());
    if (!hasPrompt) return false;
    if (submode === 'image2image' && !referenceDataUrl) return false;
    return true;
  }, [prompt, referenceDataUrl, submode]);

  useEffect(() => {
    if (!isGenerating || !generationStartedAt) {
      setGenerationElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      setGenerationElapsedSeconds(Math.max(0, Math.floor((Date.now() - generationStartedAt) / 1000)));
    };

    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(intervalId);
  }, [generationStartedAt, isGenerating]);

  const handleReferencePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(isRTL ? 'يرجى اختيار صورة فقط' : 'Please choose an image file only');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(isRTL ? 'الحد الأقصى 10 ميجابايت' : 'Max file size is 10MB');
      return;
    }

    try {
      const dataUrl = await optimizeReferenceImageForGeneration(file);
      setReferenceFile(file);
      setReferenceDataUrl(dataUrl);
    } catch (err: any) {
      toast.error(err?.message || (isRTL ? 'فشل قراءة الصورة' : 'Failed to read image'));
    }
  };

  const saveGeneratedImage = async (
    rawImageUrl: string,
    promptToSave: string,
    targetToSave: ProjectImageTarget
  ): Promise<{ id: string | null; imageUrl: string }> => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      throw new Error(isRTL ? 'يرجى تسجيل الدخول أولاً' : 'Please log in first');
    }

    const { data: saveData, error: saveError } = await supabase.functions.invoke('save-generated-image', {
      body: {
        imageUrl: rawImageUrl,
        submode,
        filenameHint: `project-${submode}`,
      },
    });

    if (saveError) {
      throw new Error(saveError.message || 'Failed to save generated image');
    }

    if (!saveData?.success || !saveData?.url) {
      throw new Error(saveData?.error || 'Failed to save generated image');
    }

    const savedImageUrl = normalizeUrl(String(saveData.url));
    const storagePath = String(saveData.storagePath || '');

    const { data: existingRow, error: existingErr } = await (supabase as any)
      .from('user_generated_images')
      .select('id')
      .eq('user_id', user.id)
      .eq('image_url', savedImageUrl)
      .maybeSingle();

    if (existingErr) {
      throw existingErr;
    }

    if (existingRow?.id) {
      return { id: existingRow.id, imageUrl: savedImageUrl };
    }

    const { data: insertedRow, error: insertErr } = await (supabase as any)
      .from('user_generated_images')
      .insert({
        user_id: user.id,
        image_url: savedImageUrl,
        prompt: promptToSave,
        submode,
        quality: 'best_fast',
        meta: {
          source: 'project-editor',
          storage_path: storagePath,
          image_target: targetToSave,
        },
      })
      .select('id')
      .single();

    if (insertErr) {
      throw insertErr;
    }

    return { id: insertedRow?.id || null, imageUrl: savedImageUrl };
  };

  const handleAmpPrompt = async () => {
    if (!prompt.trim() || isAmpingPrompt || isGenerating) return;

    setIsAmpingPrompt(true);
    try {
      const { data, error } = await supabase.functions.invoke('prompt-amp', {
        body: {
          text: prompt.trim(),
          mode: submode,
        },
      });

      if (error) {
        throw new Error(error.message || 'AMP failed');
      }

      const enhancedText = String(data?.text || '').trim();
      if (!enhancedText) {
        throw new Error(data?.error || (isRTL ? 'تعذر تحسين الوصف' : 'Could not amp the prompt'));
      }

      const mergedPrompt = mergeAmpPromptPreservingOriginal(prompt, enhancedText, isRTL);
      setPrompt(mergedPrompt);
      toast.success(isRTL ? 'تم تعزيز الوصف مع الحفاظ على فكرتك الأصلية' : 'Prompt amped while preserving your original idea');
    } catch (err: any) {
      toast.error(err?.message || (isRTL ? 'فشل تعزيز الوصف' : 'Prompt AMP failed'));
    } finally {
      setIsAmpingPrompt(false);
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate || isGenerating) return;

    setGenerationStartedAt(Date.now());
    setGenerationElapsedSeconds(0);
    setIsGenerating(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        throw new Error(isRTL ? 'يرجى تسجيل الدخول أولاً' : 'Please log in first');
      }

      const userPrompt = prompt.trim();
      const resolvedTarget = resolveImageTargetFromPrompt(userPrompt);
      const projectContextHint = buildImageTargetHint(resolvedTarget, userPrompt, isRTL);
      const generationPrompt = `${userPrompt}\n\n${projectContextHint}`.trim();

      const functionName = submode === 'image2image' ? 'wakti-image2image' : 'wakti-text2image';
      const body: Record<string, unknown> = submode === 'image2image'
        ? {
          user_prompt: generationPrompt,
          user_id: user.id,
          image: referenceDataUrl,
          quality: 'best_fast',
          aspect_ratio: aspectRatio,
          project_context: resolvedTarget,
        }
        : {
          prompt: generationPrompt,
          user_id: user.id,
          quality: 'best_fast',
          aspect_ratio: aspectRatio,
          model: 'nano-banana-2',
          project_context: resolvedTarget,
        };

      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) {
        throw new Error(error.message || 'Generation failed');
      }

      const generatedUrl = normalizeUrl(String(data?.url || ''));
      if (!generatedUrl) {
        throw new Error(data?.error || (isRTL ? 'فشل إنشاء الصورة' : 'Failed to generate image'));
      }

      const saved = await saveGeneratedImage(generatedUrl, userPrompt, resolvedTarget);
      const generated: ProjectGeneratedImage = {
        id: saved.id,
        imageUrl: saved.imageUrl,
        prompt: userPrompt,
        submode,
      };

      setResultImage(generated);
      await Promise.resolve(onSaved?.(generated));
      toast.success(isRTL ? 'تم إنشاء الصورة وحفظها' : 'Image generated and saved');
    } catch (err: any) {
      const message = err?.message || (isRTL ? 'حدث خطأ أثناء إنشاء الصورة' : 'Image generation failed');
      toast.error(message);
    } finally {
      setIsGenerating(false);
      setGenerationStartedAt(null);
    }
  };

  const handleUseImage = async () => {
    if (!resultImage || !onUseImage || isUsingImage) return;
    setIsUsingImage(true);
    try {
      await Promise.resolve(onUseImage(resultImage));
    } catch (err: any) {
      toast.error(err?.message || (isRTL ? 'فشل استخدام الصورة' : 'Failed to use image'));
    } finally {
      setIsUsingImage(false);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
        <Button
          type="button"
          variant={submode === 'text2image' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSubmode('text2image')}
          disabled={isGenerating}
        >
          {isRTL ? 'نص إلى صورة' : 'Text to Image'}
        </Button>
        <Button
          type="button"
          variant={submode === 'image2image' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSubmode('image2image')}
          disabled={isGenerating}
        >
          {isRTL ? 'صورة إلى صورة' : 'Image to Image'}
        </Button>
      </div>

      <div className="space-y-2">
        <div className={cn('flex items-center justify-between gap-2', isRTL && 'flex-row-reverse')}>
          <label className="text-xs text-muted-foreground">{isRTL ? 'الوصف' : 'Prompt'}</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAmpPrompt}
            disabled={!prompt.trim() || isAmpingPrompt || isGenerating}
            className="h-7 gap-1.5 px-2 text-[11px]"
          >
            {isAmpingPrompt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            AMP
          </Button>
        </div>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={isRTL ? 'اكتب وصف الصورة...' : 'Describe the image...'}
          className={cn(
            'w-full min-h-[92px] rounded-md border border-input bg-background px-3 py-2 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isRTL && 'text-right'
          )}
          dir={isRTL ? 'rtl' : 'ltr'}
        />
        <p className={cn('text-[11px] text-muted-foreground', isRTL && 'text-right')}>
          {isRTL
            ? 'زر AMP يعزز الوصف بدون حذف فكرتك الأصلية.'
            : 'AMP enhances the prompt without removing your original idea.'}
        </p>
      </div>

      <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
        <label className="text-xs text-muted-foreground whitespace-nowrap">{isRTL ? 'النسبة' : 'Aspect Ratio'}</label>
        <select
          value={aspectRatio}
          onChange={(event) => setAspectRatio(event.target.value as (typeof ALLOWED_RATIOS)[number])}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          disabled={isGenerating}
        >
          {ALLOWED_RATIOS.map((ratio) => (
            <option key={ratio} value={ratio}>{ratio}</option>
          ))}
        </select>
      </div>

      {submode === 'image2image' && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">{isRTL ? 'الصورة المرجعية' : 'Reference Image'}</label>
          {!referenceDataUrl ? (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground hover:border-primary/50">
              <Upload className="h-4 w-4" />
              {isRTL ? 'اختر صورة' : 'Choose image'}
              <input type="file" accept="image/*" className="hidden" onChange={handleReferencePick} />
            </label>
          ) : (
            <div className={cn('rounded-md border border-border p-2 w-full max-w-[260px]', isRTL && 'ml-auto')}>
              <div className="relative h-40 w-full overflow-hidden rounded-md bg-muted/30">
                <img src={referenceDataUrl} alt="Reference" className="h-full w-full object-contain" />
                <button
                  type="button"
                  onClick={() => {
                    setReferenceFile(null);
                    setReferenceDataUrl('');
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
                  aria-label={isRTL ? 'إزالة الصورة' : 'Remove image'}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-2 truncate text-xs text-muted-foreground">{referenceFile?.name}</p>
            </div>
          )}
        </div>
      )}

      <Button type="button" onClick={handleGenerate} disabled={!canGenerate || isGenerating || isAmpingPrompt} className="w-full gap-2">
        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {isGenerating
          ? (isRTL ? 'جاري الإنشاء...' : 'Generating...')
          : (isRTL ? 'إنشاء وحفظ' : 'Generate & Save')}
      </Button>

      {isGenerating && (
        <p className={cn('text-[11px] text-muted-foreground', isRTL && 'text-right')}>
          {isRTL
            ? `الإنشاء قد يستغرق وقتًا أطول أحيانًا... ${generationElapsedSeconds}ث`
            : `Generation can take longer sometimes... ${generationElapsedSeconds}s`}
        </p>
      )}

      {resultImage && (
        <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
          <div className="h-56 overflow-hidden rounded-md bg-muted/30">
            <img src={resultImage.imageUrl} alt={resultImage.prompt || 'Generated image'} className="h-full w-full object-contain" />
          </div>
          <div className={cn('flex items-center justify-between gap-2', isRTL && 'flex-row-reverse')}>
            <p className="truncate text-xs text-muted-foreground max-w-[70%]">{resultImage.prompt}</p>
            {onUseImage && (
              <Button type="button" size="sm" onClick={handleUseImage} disabled={isUsingImage} className="shrink-0">
                {isUsingImage
                  ? (isRTL ? 'جاري الإضافة...' : 'Adding...')
                  : (isRTL ? 'استخدم الصورة' : 'Use Image')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectImageGeneratorPanel;
