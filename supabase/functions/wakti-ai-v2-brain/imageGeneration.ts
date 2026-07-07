import '../_types/deno-globals.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateGemini } from '../_shared/gemini.ts';
// Note: Edge function runs in Deno; utilities are not used here.

/**
 * ENHANCED: Image generation with Arabic translation support and better error handling
 */

const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
const KIE_API_KEY = Deno.env.get('KIE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const STORAGE_BUCKET = 'generated-files';
const SIGNED_URL_EXPIRES_SECONDS = 10 * 60;
const KIE_CREATE_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const KIE_STATUS_URL = 'https://api.kie.ai/api/v1/jobs/recordInfo';
const KIE_BG_MODEL = 'recraft/remove-background';

// Env-configurable model/quality parameters with safe defaults
const RW_PREFERRED_MODEL = Deno.env.get('RUNWARE_PREFERRED_MODEL') || 'runware:107@1';
const RW_FALLBACK_MODEL = Deno.env.get('RUNWARE_FALLBACK_MODEL') || 'runware:100@1';
const RW_STEPS = (() => {
  const v = parseInt(Deno.env.get('RUNWARE_STEPS') ?? '28', 10);
  if (Number.isNaN(v)) return 28;
  return Math.min(60, Math.max(4, v));
})();
const RW_CFG = (() => {
  const v = parseFloat(Deno.env.get('RUNWARE_CFG') ?? '5.5');
  if (Number.isNaN(v)) return 5.5;
  return Math.min(20, Math.max(1, v));
})();
const RW_TIMEOUT_MS = (() => {
  const v = parseInt(Deno.env.get('RUNWARE_TIMEOUT_MS') ?? '25000', 10);
  if (Number.isNaN(v)) return 25000;
  return Math.min(60000, Math.max(5000, v));
})();

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function stripDataUrlPrefix(maybeDataUrl?: string): { base64: string; mimeHint?: string } {
  if (maybeDataUrl && maybeDataUrl.startsWith('data:')) {
    const [meta, data] = maybeDataUrl.split(',', 2);
    const match = /data:([^;]+);base64/.exec(meta || '');
    const mime = match?.[1];
    return { base64: data || '', mimeHint: mime };
  }
  return { base64: maybeDataUrl || '' };
}

function detectMimeAndExt(bytes: Uint8Array, mimeHint?: string): { mime: string; ext: string } {
  if (mimeHint && (mimeHint === 'image/png' || mimeHint === 'image/jpeg' || mimeHint === 'image/webp')) {
    return {
      mime: mimeHint,
      ext: mimeHint === 'image/png' ? 'png' : mimeHint === 'image/jpeg' ? 'jpg' : 'webp',
    };
  }
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return { mime: mimeHint || 'image/png', ext: mimeHint === 'image/jpeg' ? 'jpg' : mimeHint === 'image/webp' ? 'webp' : 'png' };
}

function extractKieImageUrls(data: unknown): string[] {
  const urls: string[] = [];
  if (typeof (data as { resultJson?: unknown } | null)?.resultJson === 'string' && (data as { resultJson: string }).resultJson) {
    try {
      const parsed = JSON.parse((data as { resultJson: string }).resultJson);
      if (Array.isArray(parsed?.resultUrls)) {
        for (const u of parsed.resultUrls) {
          if (typeof u === 'string' && u.startsWith('http')) urls.push(u);
        }
      }
    } catch {
    }
  }
  if (urls.length > 0) return urls;
  const seen = new Set<string>();
  const scan = (obj: unknown, depth = 0) => {
    if (!obj || typeof obj !== 'object' || depth > 8) return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'string' && v.startsWith('http') && !seen.has(v)) {
        const keyLooksImagey = /url|image|img|src|uri|link|photo|pic/i.test(k);
        const hasImageExt = /\.(png|jpg|jpeg|webp)/i.test(v);
        if (keyLooksImagey || hasImageExt) {
          seen.add(v);
          urls.push(v);
        }
      } else if (v && typeof v === 'object') {
        scan(v, depth + 1);
      }
    }
  };
  scan(data);
  return urls;
}

async function uploadAndSignImageForKie(input: string, userId: string): Promise<string> {
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase storage not configured');
  }
  const { base64, mimeHint } = stripDataUrlPrefix(input);
  if (!base64) {
    throw new Error('Invalid image data');
  }
  const bytes = decodeBase64ToUint8Array(base64);
  const { mime, ext } = detectMimeAndExt(bytes, mimeHint);
  const path = `bg-removal-input/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const upload = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (upload.error) {
    throw new Error(`Storage upload failed: ${upload.error.message}`);
  }
  const signed = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(`Signed URL failed: ${signed.error?.message || 'Unknown error'}`);
  }
  return signed.data.signedUrl;
}

async function pollKieTaskForImage(taskId: string, signal?: AbortSignal): Promise<string> {
  if (!KIE_API_KEY) throw new Error('KIE_API_KEY not configured');
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('Image generation was cancelled');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const resp = await fetch(`${KIE_STATUS_URL}?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${KIE_API_KEY}` },
      signal,
    });
    const rawText = await resp.text();
    if (!resp.ok) {
      throw new Error(`KIE poll failed ${resp.status}: ${rawText.slice(0, 200)}`);
    }
    const json = JSON.parse(rawText);
    const rawStatus = (json?.data?.state || json?.data?.status || json?.data?.taskStatus || '').toString().toLowerCase();
    const imageUrls = extractKieImageUrls(json?.data);
    const isDone = rawStatus === 'success' || rawStatus === 'completed' || rawStatus === 'finished'
      || rawStatus === 'succeed' || rawStatus === 'done' || rawStatus === '2';
    const isFailed = rawStatus === 'failed' || rawStatus === 'error' || rawStatus === 'fail' || rawStatus === '3';
    if (isFailed) {
      throw new Error(`KIE task failed: ${rawStatus}`);
    }
    if ((isDone || imageUrls.length > 0) && imageUrls[0]) {
      return imageUrls[0];
    }
  }
  throw new Error('KIE generation timed out');
}

async function submitKieBackgroundRemoval(imageUrl: string, signal?: AbortSignal): Promise<string> {
  if (!KIE_API_KEY) throw new Error('KIE_API_KEY not configured');
  const submitResp = await fetch(KIE_CREATE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KIE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: KIE_BG_MODEL,
      input: { image: imageUrl },
    }),
    signal,
  });
  const submitText = await submitResp.text();
  if (!submitResp.ok) {
    throw new Error(`KIE submit failed ${submitResp.status}: ${submitText.slice(0, 200)}`);
  }
  const submitJson = JSON.parse(submitText);
  const taskId = submitJson?.data?.taskId;
  if (!taskId) {
    throw new Error(`No taskId in KIE response: ${submitText.slice(0, 200)}`);
  }
  return await pollKieTaskForImage(taskId, signal);
}

export async function generateImageWithRunware(
  prompt: string,
  userId?: string,
  language: string = 'en',
  options?: {
    seedImage?: string;
    strength?: number;
    maskImage?: string;
    maskMargin?: number;
    width?: number;
    height?: number;
    negativePrompt?: string;
    model?: string;
    outputFormat?: 'WEBP' | 'PNG' | 'JPEG';
    // Background removal specific
    backgroundRemoval?: boolean;
    inputImage?: string; // base64 data URL supported in Option 1
    outputType?: 'URL' | 'BASE64';
    settings?: any;
  },
  signal?: AbortSignal
) {
  console.log('🎨 IMAGE GEN: Starting generation for:', prompt.substring(0, 50));
  
  if (options?.backgroundRemoval && !KIE_API_KEY) {
    return {
      success: false,
      error: language === 'ar' ? 'خدمة إزالة الخلفية غير متاحة' : 'Background removal service not configured',
      response: language === 'ar' ? 'أعتذر، خدمة إزالة الخلفية غير متاحة حالياً.' : 'I apologize, background removal service is not available at the moment.'
    };
  }

  if (!options?.backgroundRemoval && !RUNWARE_API_KEY) {
    return {
      success: false,
      error: language === 'ar' ? 'خدمة إنشاء الصور غير متاحة' : 'Image generation service not configured',
      response: language === 'ar' ? 'أعتذر، خدمة إنشاء الصور غير متاحة حالياً.' : 'I apologize, image generation service is not available at the moment.'
    };
  }

  let finalPrompt = prompt;
  const originalPrompt = prompt;

  try {
    const isArabic = language === 'ar' || /[\u0600-\u06FF]/.test(prompt);
    
    if (isArabic && !options?.backgroundRemoval) {
      console.log('🌐 ARABIC DETECTED: Translating to English for Runware');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      // Combine external signal with internal timeout
      if (signal) {
        signal.addEventListener('abort', () => controller.abort());
      }

      try {
        const result = await generateGemini(
          'gemini-2.5-flash-lite',
          [{ role: 'user', parts: [{ text: `Translate this to English: ${prompt}` }] }],
          'Translate Arabic image prompts to English. Return ONLY the English translation.',
          { temperature: 0.1, maxOutputTokens: 300 }
        );
        const translatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (translatedText) {
          finalPrompt = translatedText;
          console.log('✅ TRANSLATION SUCCESS:', translatedText.substring(0, 50));
        }
      } finally {
        clearTimeout(timeoutId);
      }

      if (controller.signal.aborted || (signal && signal.aborted)) {
        throw new Error('Translation request was cancelled');
      }
    }

    const taskUUID = crypto.randomUUID();
    const startTime = Date.now();

    // Derive and sanitize generation parameters (safe defaults; width/height snap to 64)
    const snap64 = (n: number) => Math.max(64, Math.round(n / 64) * 64);
    const width = snap64(options?.width ?? 1280);
    const height = snap64(options?.height ?? 2752);
    const preferredModel = options?.model || RW_PREFERRED_MODEL;
    const fallbackModel = RW_FALLBACK_MODEL;
    const cfgScale = RW_CFG; // prompt adherence
    const steps = RW_STEPS; // quality vs speed

    // Auto-strength heuristic for img2img: only when seedImage is provided and strength unset
    const deriveStrength = (): number | undefined => {
      if (!options?.seedImage || options?.strength !== undefined) return options?.strength;
      const len = (finalPrompt || '').length;
      // Simple heuristic: shorter prompt => keep more of seed (higher strength)
      if (len <= 40) return 0.82;
      if (len <= 120) return 0.65;
      return 0.52;
    };
    const strength = deriveStrength();

    const outputFormat = options?.outputFormat || 'WEBP';

    const buildPayload = (modelToUse: string) => {
      return [
        {
          taskType: "authentication",
          apiKey: RUNWARE_API_KEY
        },
        {
          taskType: "imageInference",
          taskUUID: taskUUID,
          positivePrompt: finalPrompt,
          ...(options?.negativePrompt ? { negativePrompt: options.negativePrompt } : {}),
          width,
          height,
          model: modelToUse,
          numberResults: 1,
          outputFormat,
          includeCost: true,
          CFGScale: cfgScale,
          steps,
          ...(options?.seedImage ? { seedImage: options.seedImage, strength: Math.max(0, Math.min(1, strength ?? 0.8)) } : {}),
          ...(options?.maskImage ? { maskImage: options.maskImage, maskMargin: options.maskMargin ?? 8 } : {})
        }
      ];
    };

    const fetchWithTimeout = async (payload: ReadonlyArray<Record<string, unknown>>, timeoutMs: number = RW_TIMEOUT_MS): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      // Combine external signal with internal timeout
      if (signal) {
        signal.addEventListener('abort', () => controller.abort());
      }
      
      try {
        const res = await fetch('https://api.runware.ai/v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        return res;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // Check for cancellation before making API calls
    if (signal && signal.aborted) {
      throw new Error('Image generation was cancelled');
    }

    if (options?.backgroundRemoval) {
      const rawInput = options.inputImage || options.seedImage || '';
      if (!rawInput) {
        throw new Error('No input image provided for background removal');
      }
      const sourceUrl = await uploadAndSignImageForKie(rawInput, userId || 'anonymous');
      const urlCandidate = await submitKieBackgroundRemoval(sourceUrl, signal);
      if (urlCandidate) {
        console.log('✅ IMAGE GEN: Successfully generated image');

        const durationMs = Date.now() - startTime;

        const responseMessage = language === 'ar'
          ? `🎨 تم إنشاء الصورة بنجاح!\n\n![Generated Image](${urlCandidate})\n\n**الوصف الأصلي:** ${originalPrompt}\n**الوصف المترجم:** ${finalPrompt}`
          : `🎨 Image generated successfully!\n\n![Generated Image](${urlCandidate})\n\n**Prompt:** ${finalPrompt}`;
        
        return {
          success: true,
          error: null,
          response: responseMessage,
          imageUrl: urlCandidate,
          runwareCost: undefined,
          modelUsed: KIE_BG_MODEL,
          responseTime: durationMs
        };
      }

      console.warn('⚠️ IMAGE GEN: No valid image URL in response');
      return {
        success: false,
        error: language === 'ar' ? 'لم يتم إنشاء الصورة بنجاح' : 'Image generation failed',
        response: language === 'ar' ? 'أعتذر، لم أتمكن من إنشاء الصورة. يرجى المحاولة مرة أخرى.' : 'I apologize, I could not generate the image. Please try again.'
      };
    }

    // Try preferred model first, then fallback if needed
    let modelUsed = preferredModel;
    let response = await fetchWithTimeout(buildPayload(preferredModel));

    // Check for cancellation after first attempt
    if (signal && signal.aborted) {
      throw new Error('Image generation was cancelled');
    }

    // If the request failed or aborted, try fallback once
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('❌ IMAGE API ERROR (preferred):', response.status, errorText);
      console.log('🔁 Retrying with fallback model:', fallbackModel);
      modelUsed = fallbackModel;
      response = await fetchWithTimeout(buildPayload(fallbackModel));
    }

    // Final cancellation check
    if (signal && signal.aborted) {
      throw new Error('Image generation was cancelled');
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('❌ IMAGE API ERROR (final):', response.status, errorText);
      throw new Error(`Image generation API error: ${response.status}`);
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response from image generation service');
    }

    let responseData: { data?: Array<Record<string, unknown>> };
    try {
      responseData = JSON.parse(responseText) as { data?: Array<Record<string, unknown>> };
    } catch (jsonError: unknown) {
      console.error('❌ IMAGE JSON parsing error:', jsonError);
      throw new Error('Invalid JSON response from image generation service');
    }

    // Select result per task type and get URL
    const targetTaskType = options?.backgroundRemoval ? 'imageBackgroundRemoval' : 'imageInference';
    const imageResult = responseData?.data?.find((item: any) => item.taskType === targetTaskType);
    const urlCandidate = imageResult?.imageURL || imageResult?.url || imageResult?.outputUrl || imageResult?.outputURL;
    if (typeof urlCandidate === 'string' && urlCandidate.length > 0) {
      console.log('✅ IMAGE GEN: Successfully generated image');

      // Extract any available cost metadata without assuming exact shape
      let runwareCost: unknown = undefined;
      if (imageResult && typeof imageResult === 'object') {
        if ('cost' in imageResult) runwareCost = (imageResult as Record<string, unknown>).cost;
        else if ('usage' in imageResult) runwareCost = (imageResult as Record<string, unknown>).usage;
        else if ('pricing' in imageResult) runwareCost = (imageResult as Record<string, unknown>).pricing;
      }

      const durationMs = Date.now() - startTime;

      const responseMessage = language === 'ar' 
        ? `🎨 تم إنشاء الصورة بنجاح!\n\n![Generated Image](${urlCandidate})\n\n**الوصف الأصلي:** ${originalPrompt}\n**الوصف المترجم:** ${finalPrompt}`
        : `🎨 Image generated successfully!\n\n![Generated Image](${urlCandidate})\n\n**Prompt:** ${finalPrompt}`;
      
      return {
        success: true,
        error: null,
        response: responseMessage,
        imageUrl: urlCandidate,
        runwareCost,
        modelUsed,
        responseTime: durationMs
      };
    }

    console.warn('⚠️ IMAGE GEN: No valid image URL in response');
    return {
      success: false,
      error: language === 'ar' ? 'لم يتم إنشاء الصورة بنجاح' : 'Image generation failed',
      response: language === 'ar' ? 'أعتذر، لم أتمكن من إنشاء الصورة. يرجى المحاولة مرة أخرى.' : 'I apologize, I could not generate the image. Please try again.'
    };
  } catch (error: unknown) {
    const isAbort = (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && /cancelled/i.test(error.message));
    if (isAbort) {
      console.log('🚫 Image generation was cancelled');
      return {
        success: false,
        error: language === 'ar' ? 'تم إلغاء إنشاء الصورة' : 'Image generation was cancelled',
        response: language === 'ar' ? 'تم إلغاء إنشاء الصورة.' : 'Image generation was cancelled.'
      };
    }
    
    console.error('❌ IMAGE GEN: Critical error:', error);
    return {
      success: false,
      error: language === 'ar' ? 'خطأ في إنشاء الصورة' : 'Image generation failed',
      response: language === 'ar' ? 'أعتذر، حدث خطأ أثناء إنشاء الصورة. يرجى المحاولة مرة أخرى.' : 'I apologize, there was an error generating the image. Please try again.'
    };
  }
}
