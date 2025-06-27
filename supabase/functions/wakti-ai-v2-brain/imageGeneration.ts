
/**
 * Image generation for Wakti Edge Function
 */
import { supabase, RUNWARE_API_KEY, DEEPSEEK_API_KEY } from "./utils.ts";

// Utility: Detects if input contains Arabic characters
function containsArabic(text: string): boolean {
  if (!text) return false;
  return /[\u0600-\u06FF]/.test(text);
}

// Translate Arabic text to English via DeepSeek ONLY, now with enhanced logging and error handling
async function translateToEnglishDeepSeek(prompt: string): Promise<string> {
  console.log("  [translateToEnglishDeepSeek] Starting translation for:", prompt);
  if (!DEEPSEEK_API_KEY) {
    console.error("  [translateToEnglishDeepSeek] CRITICAL: DEEPSEEK_API_KEY is not configured.");
    throw new Error("DeepSeek API key not set for translation");
  }

  const systemPrompt = "You are a professional translator. Given the following Arabic prompt for image generation, translate it to clear English, optimized for AI image creation. Respond with only the English translation, and DO NOT include any explanations, notes, or non-English words.";
  const body = {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 512
  };

  console.log("  [translateToEnglishDeepSeek] Sending request to DeepSeek API.");
  
  // Add timeout to DeepSeek API call
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`  [translateToEnglishDeepSeek] DeepSeek API returned status ${resp.status}:`, errText);
      throw new Error("DeepSeek translation API request failed.");
    }

    const data = await resp.json();
    const translation = data.choices?.[0]?.message?.content?.trim() || "";
    console.log(`  [translateToEnglishDeepSeek] Received translation: "${translation}"`);

    if (!translation || containsArabic(translation)) {
      console.error(`  [translateToEnglishDeepSeek] Translation result is invalid (empty or still contains Arabic).`);
      throw new Error("Invalid translation result from DeepSeek API.");
    }
    
    return translation;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error("  [translateToEnglishDeepSeek] Request timed out after 30 seconds");
      throw new Error("Translation request timed out");
    }
    throw error;
  }
}

export async function generateImageWithRunware(prompt: string, userId: string, language: string = "en") {
  try {
    console.log("🎨 [generateImageWithRunware] Starting image generation with prompt:", prompt);
    console.log("🎨 [generateImageWithRunware] Language:", language, "| User ID:", userId);
    
    let runwarePrompt = prompt;
    let translatedPrompt: string | null = null;
    let translation_status: 'not_needed' | 'pending' | 'success' | 'failed_no_key' | 'failed_api_error' = 'not_needed';

    // Dedicated handler for Arabic prompts
    if (containsArabic(prompt)) {
      console.log("🗣️ [generateImageWithRunware] Arabic detected in prompt. Initiating dedicated translation handler.");
      translation_status = 'pending';

      try {
        translatedPrompt = await translateToEnglishDeepSeek(prompt);
        runwarePrompt = translatedPrompt;
        translation_status = 'success';
        console.log("🗣️ [generateImageWithRunware] Translation successful:", translatedPrompt);
      } catch (err: any) {
        console.error("❌ [generateImageWithRunware] Translation workflow failed:", err.message);
        translation_status = err.message.includes("API key not set") ? 'failed_no_key' : 'failed_api_error';
        const userErrorMessage = language === 'ar'
            ? 'عفواً، فشلت محاولة ترجمة الوصف من العربية إلى الإنجليزية. يرجى المحاولة مرة أخرى أو استخدام وصف باللغة الإنجليزية.'
            : 'Sorry, the prompt translation from Arabic to English failed. Please try again or use an English prompt.';
        return {
          success: false,
          error: userErrorMessage,
          translation_status: translation_status,
        };
      }
    } else {
      console.log("🇺🇸 [generateImageWithRunware] English prompt detected, skipping translation");
    }

    console.log(`🚀 [generateImageWithRunware] Proceeding to Runware with prompt: "${runwarePrompt}"`);
    
    // Validate Runware API key
    if (!RUNWARE_API_KEY) {
      console.error("❌ [generateImageWithRunware] RUNWARE_API_KEY is not configured");
      throw new Error("Runware API key not configured");
    }

    // Add timeout to Runware API call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error("⏰ [generateImageWithRunware] Runware API request timed out after 60 seconds");
      controller.abort();
    }, 60000); // 60 second timeout

    console.log("📡 [generateImageWithRunware] Sending request to Runware API...");
    
    try {
      const response = await fetch("https://api.runware.ai/v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            taskType: "authentication",
            apiKey: RUNWARE_API_KEY,
          },
          {
            taskType: "imageInference",
            taskUUID: crypto.randomUUID(),
            positivePrompt: runwarePrompt,
            model: "runware:100@1",
            width: 512,
            height: 512,
            numberResults: 1,
            outputFormat: "WEBP",
            CFGScale: 1,
            scheduler: "FlowMatchEulerDiscreteScheduler",
            steps: 4,
          },
        ]),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log("📡 [generateImageWithRunware] Runware response status:", response.status);

      if (response.ok) {
        const result = await response.json();
        console.log("📡 [generateImageWithRunware] Runware response data:", result);

        const imageResult = result.data?.find((item: any) => item.taskType === "imageInference");

        if (imageResult && imageResult.imageURL) {
          console.log("✅ [generateImageWithRunware] Image generation successful:", imageResult.imageURL);
          
          try {
            await supabase
              .from('images')
              .insert({
                user_id: userId,
                prompt: prompt,
                image_url: imageResult.imageURL,
                metadata: {
                  provider: "runware",
                  imageUUID: imageResult.imageUUID,
                  originalPrompt: prompt,
                  translatedPrompt: translatedPrompt
                }
              });
            console.log("💾 [generateImageWithRunware] Image saved to database");
          } catch (dbError) {
            console.log("⚠️ [generateImageWithRunware] Could not save image to database:", dbError);
          }

          return {
            success: true,
            imageUrl: imageResult.imageURL,
            originalPrompt: prompt,
            translatedPrompt: translatedPrompt,
            translation_status: translation_status
          };
        } else {
          console.error("❌ [generateImageWithRunware] No image URL in Runware response:", result);
          throw new Error('No image URL in Runware response');
        }
      } else {
        const errorText = await response.text();
        console.error("❌ [generateImageWithRunware] Runware API error:", response.status, errorText);
        throw new Error(`Runware API failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error("⏰ [generateImageWithRunware] Runware API request was aborted due to timeout");
        throw new Error("Image generation request timed out. Please try again.");
      }
      throw error;
    }

  } catch (error: any) {
    console.error('❌ [generateImageWithRunware] Error generating image with Runware:', error);
    return {
      success: false,
      error: error.message,
      translation_status: 'not_needed'
    };
  }
}
