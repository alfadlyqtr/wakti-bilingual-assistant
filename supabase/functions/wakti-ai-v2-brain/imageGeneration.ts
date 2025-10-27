<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
=======
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
import '../_types/deno-globals.d.ts';
// Note: Edge function runs in Deno; utilities are not used here.

>>>>>>> Stashed changes
/**
 * ENHANCED: Image generation with Arabic translation support and better error handling
 */

const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');

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
  
  if (!RUNWARE_API_KEY) {
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

<<<<<<< Updated upstream
    // Helper: upload image (data URI, base64, or URL) to Runware to get imageUUID
    const uploadImageAndGetUUID = async (image: string): Promise<string> => {
      const uploadTaskUUID = crypto.randomUUID();
      const uploadPayload = [
        { taskType: 'authentication', apiKey: RUNWARE_API_KEY },
        { taskType: 'imageUpload', taskUUID: uploadTaskUUID, image }
      ];

      const res = await fetch('https://api.runware.ai/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadPayload)
      });

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        console.error('❌ IMAGE UPLOAD ERROR:', res.status, t);
        throw new Error(`Image upload API error: ${res.status}`);
      }
      const text = await res.text();
      if (!text) throw new Error('Empty response from image upload');
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error('Invalid JSON from image upload'); }

      // Accept both {data: {...}} and {data: [...]} shapes
      const uploadNode = Array.isArray(data?.data) ? data.data.find((d: any) => d.taskType === 'imageUpload') : data?.data;
      const imageUUID: string | undefined = uploadNode?.imageUUID || uploadNode?.imageUuid || uploadNode?.id;
      if (!imageUUID) throw new Error('imageUUID not found in upload response');
      return imageUUID;
    };

    const buildPayload = (modelToUse: string) => {
      // Background Removal branch (Option 1: send base64 inputImage directly)
      if (options?.backgroundRemoval) {
        const inputImage = options.inputImage || options.seedImage;
        const bgOutputFormat = options.outputFormat || 'PNG';
        const outputType = options.outputType || 'URL';
        const settings = options.settings || {
          rgba: [255, 255, 255, 0],
          postProcessMask: true,
          returnOnlyMask: false,
          alphaMatting: true,
          alphaMattingForegroundThreshold: 240,
          alphaMattingBackgroundThreshold: 10,
          alphaMattingErodeSize: 10
        };

        return [
          {
            taskType: "authentication",
            apiKey: RUNWARE_API_KEY
          },
          {
            taskType: "imageBackgroundRemoval",
            taskUUID: taskUUID,
            inputImage: inputImage, // base64 data URL (Option 1)
            outputType: outputType,
            outputFormat: bgOutputFormat,
            model: 'google:4@1',
            settings
          }
        ];
      }

      // Default image generation branch
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
=======
    const buildPayload = (modelToUse: string) => ([
      {
        taskType: "authentication" as const,
        apiKey: RUNWARE_API_KEY as string
      },
      {
        taskType: "imageInference" as const,
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
    ] as const);
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes

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

    // EARLY BRANCH: Background removal with upload-first (Option B)
    if (options?.backgroundRemoval) {
      const rawInput = options.inputImage || options.seedImage || '';
      if (!rawInput) {
        throw new Error('No input image provided for background removal');
      }

      // If not a UUID v4, upload first
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      let inputImageUUID = rawInput;
      if (!uuidV4Regex.test(rawInput)) {
        console.log('⬆️ Uploading image to Runware to obtain imageUUID');
        inputImageUUID = await uploadImageAndGetUUID(rawInput);
        console.log('✅ Upload complete, imageUUID:', inputImageUUID);
      }

      const bgOutputFormat = options.outputFormat || 'PNG';
      const outputType = options.outputType || 'URL';
      const settings = options.settings || {
        rgba: [255, 255, 255, 0],
        postProcessMask: true,
        returnOnlyMask: false,
        alphaMatting: true,
        alphaMattingForegroundThreshold: 240,
        alphaMattingBackgroundThreshold: 10,
        alphaMattingErodeSize: 10
      };

      const payload = [
        { taskType: 'authentication', apiKey: RUNWARE_API_KEY },
        {
          taskType: 'imageBackgroundRemoval',
          taskUUID,
          inputImage: inputImageUUID,
          outputType,
          outputFormat: bgOutputFormat,
          model: 'google:4@1',
          settings
        }
      ];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), RW_TIMEOUT_MS);
      if (signal) signal.addEventListener('abort', () => controller.abort());
      const response = await fetch('https://api.runware.ai/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('❌ IMAGE API ERROR (backgroundRemoval):', response.status, errorText);
        throw new Error(`Image generation API error: ${response.status}`);
      }

      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from image generation service');
      }
      let responseData: any;
      try { responseData = JSON.parse(responseText); } catch { throw new Error('Invalid JSON response from image generation service'); }

      const imageResult = Array.isArray(responseData?.data)
        ? responseData.data.find((item: any) => item.taskType === 'imageBackgroundRemoval')
        : responseData?.data;
      const urlCandidate = imageResult?.imageURL || imageResult?.url || imageResult?.outputUrl || imageResult?.outputURL;

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
          runwareCost: imageResult?.cost,
          modelUsed: 'google:4@1',
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

<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
    // Select result per task type
    const targetTaskType = options?.backgroundRemoval ? 'imageBackgroundRemoval' : 'imageInference';
    const imageResult = responseData?.data?.find((item: any) => item.taskType === targetTaskType);

    // Try common URL fields
    const urlCandidate = imageResult?.imageURL || imageResult?.url || imageResult?.outputUrl || imageResult?.outputURL;

    if (urlCandidate) {
=======
    const imageResult = Array.isArray(responseData?.data)
      ? responseData.data.find((item) => (item as { taskType?: unknown }).taskType === 'imageInference')
      : undefined;

=======
    const imageResult = Array.isArray(responseData?.data)
      ? responseData.data.find((item) => (item as { taskType?: unknown }).taskType === 'imageInference')
      : undefined;

>>>>>>> Stashed changes
=======
    const imageResult = Array.isArray(responseData?.data)
      ? responseData.data.find((item) => (item as { taskType?: unknown }).taskType === 'imageInference')
      : undefined;

>>>>>>> Stashed changes
    // Safely read the imageURL from loosely-typed response
    const imageUrl = (imageResult && typeof imageResult === 'object' && 'imageURL' in imageResult)
      ? (imageResult as { imageURL?: unknown }).imageURL
      : undefined;
    if (typeof imageUrl === 'string' && imageUrl.length > 0) {
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
        ? `🎨 تم إنشاء الصورة بنجاح!\n\n![Generated Image](${urlCandidate})\n\n**الوصف الأصلي:** ${originalPrompt}\n**الوصف المترجم:** ${finalPrompt}`
        : `🎨 Image generated successfully!\n\n![Generated Image](${urlCandidate})\n\n**Prompt:** ${finalPrompt}`;
=======
        ? `🎨 تم إنشاء الصورة بنجاح!\n\n![Generated Image](${imageUrl})\n\n**الوصف الأصلي:** ${originalPrompt}\n**الوصف المترجم:** ${finalPrompt}`
        : `🎨 Image generated successfully!\n\n![Generated Image](${imageUrl})\n\n**Prompt:** ${finalPrompt}`;
>>>>>>> Stashed changes
=======
        ? `🎨 تم إنشاء الصورة بنجاح!\n\n![Generated Image](${imageUrl})\n\n**الوصف الأصلي:** ${originalPrompt}\n**الوصف المترجم:** ${finalPrompt}`
        : `🎨 Image generated successfully!\n\n![Generated Image](${imageUrl})\n\n**Prompt:** ${finalPrompt}`;
>>>>>>> Stashed changes
=======
        ? `🎨 تم إنشاء الصورة بنجاح!\n\n![Generated Image](${imageUrl})\n\n**الوصف الأصلي:** ${originalPrompt}\n**الوصف المترجم:** ${finalPrompt}`
        : `🎨 Image generated successfully!\n\n![Generated Image](${imageUrl})\n\n**Prompt:** ${finalPrompt}`;
>>>>>>> Stashed changes
      
      return {
        success: true,
        error: null,
        response: responseMessage,
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
        imageUrl: urlCandidate,
=======
        imageUrl,
>>>>>>> Stashed changes
=======
        imageUrl,
>>>>>>> Stashed changes
=======
        imageUrl,
>>>>>>> Stashed changes
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
