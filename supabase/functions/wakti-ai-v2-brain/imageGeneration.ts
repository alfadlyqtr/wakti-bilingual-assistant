import { callDeepSeekAPI, detectLanguageFromText } from './utils.ts';

/**
 * ENHANCED: Image generation with Arabic translation support and better error handling
 */

const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');

// Env-configurable model/quality parameters with safe defaults
const RW_PREFERRED_MODEL = Deno.env.get('RUNWARE_PREFERRED_MODEL') || 'runware:97@2';
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
  },
  signal?: AbortSignal
) {
  console.log('🎨 IMAGE GEN: Starting generation for:', prompt.substring(0, 50));
  
  if (!RUNWARE_API_KEY) {
    return {
      success: false,
      error: language === 'ar' ? 'خدمة إنشاء الصور غير متاحة' : 'Image generation service not configured',
      response: language === 'ar' ? 'أعتذر، خدمة إنشاء الصور غير متاحة حالياً.' : 'I apologize, image generation service is not available at the moment.'
    };
  }

  let finalPrompt = prompt;
  let originalPrompt = prompt;

  try {
    const isArabic = language === 'ar' || /[\u0600-\u06FF]/.test(prompt);
    
    if (isArabic) {
      console.log('🌐 ARABIC DETECTED: Translating to English for Runware');
      
      if (!DEEPSEEK_API_KEY) {
        throw new Error('Translation service not available');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      // Combine external signal with internal timeout
      if (signal) {
        signal.addEventListener('abort', () => controller.abort());
      }

      const translationResponse = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'Translate Arabic image prompts to English. Return ONLY the English translation.' },
            { role: 'user', content: `Translate this to English: ${prompt}` }
          ],
          max_tokens: 300,
          temperature: 0.1
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (controller.signal.aborted || (signal && signal.aborted)) {
        throw new Error('Translation request was cancelled');
      }

      if (translationResponse.ok) {
        const result = await translationResponse.json();
        const translatedText = result.choices?.[0]?.message?.content?.trim();
        if (translatedText) {
          finalPrompt = translatedText;
          console.log('✅ TRANSLATION SUCCESS:', translatedText.substring(0, 50));
        }
      }
    }

    const taskUUID = crypto.randomUUID();
    const startTime = Date.now();

    // Derive and sanitize generation parameters (safe defaults; width/height snap to 64)
    const snap64 = (n: number) => Math.max(64, Math.round(n / 64) * 64);
    const width = snap64(options?.width ?? 1024);
    const height = snap64(options?.height ?? 1024);
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

    const buildPayload = (modelToUse: string) => ([
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
    ]);

    const fetchWithTimeout = async (payload: any, timeoutMs = RW_TIMEOUT_MS) => {
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

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('❌ IMAGE JSON parsing error:', jsonError);
      throw new Error('Invalid JSON response from image generation service');
    }

    const imageResult = responseData?.data?.find((item: any) => item.taskType === 'imageInference');

    if (imageResult?.imageURL) {
      console.log('✅ IMAGE GEN: Successfully generated image');

      // Extract any available cost metadata without assuming exact shape
      let runwareCost: any = undefined;
      if (imageResult && typeof imageResult === 'object') {
        if ('cost' in imageResult) runwareCost = (imageResult as any).cost;
        else if ('usage' in imageResult) runwareCost = (imageResult as any).usage;
        else if ('pricing' in imageResult) runwareCost = (imageResult as any).pricing;
      }

      const durationMs = Date.now() - startTime;

      const responseMessage = language === 'ar' 
        ? `🎨 تم إنشاء الصورة بنجاح!\n\n![Generated Image](${imageResult.imageURL})\n\n**الوصف الأصلي:** ${originalPrompt}\n**الوصف المترجم:** ${finalPrompt}`
        : `🎨 Image generated successfully!\n\n![Generated Image](${imageResult.imageURL})\n\n**Prompt:** ${finalPrompt}`;
      
      return {
        success: true,
        error: null,
        response: responseMessage,
        imageUrl: imageResult.imageURL,
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
  } catch (error) {
    if (error.name === 'AbortError' || error.message.includes('cancelled')) {
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
