
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
  const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body)
  });

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
}


export async function generateImageWithRunware(prompt: string, userId: string, language: string = "en") {
  try {
    console.log("🎨 Entering generateImageWithRunware with prompt:", prompt);
    let runwarePrompt = prompt;
    let translatedPrompt: string | null = null;
    let translation_status: 'not_needed' | 'pending' | 'success' | 'failed_no_key' | 'failed_api_error' = 'not_needed';

    // Dedicated handler for Arabic prompts
    if (containsArabic(prompt)) {
      console.log("🗣️ Arabic detected in prompt. Initiating dedicated translation handler.");
      translation_status = 'pending';

      try {
        translatedPrompt = await translateToEnglishDeepSeek(prompt);
        runwarePrompt = translatedPrompt;
        translation_status = 'success';
      } catch (err: any) {
        console.error("❌ Translation workflow failed:", err.message);
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
    }

    console.log(`🚀 Proceeding to Runware with prompt: "${runwarePrompt}"`);
    // Send to Runware
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
    });

    console.log("🎨 Runware response status:", response.status);

    if (response.ok) {
      const result = await response.json();
      console.log("🎨 Runware response data:", result);

      const imageResult = result.data?.find((item: any) => item.taskType === "imageInference");

      if (imageResult && imageResult.imageURL) {
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
        } catch (dbError) {
          console.log("Could not save image to database:", dbError);
        }

        return {
          success: true,
          imageUrl: imageResult.imageURL,
          originalPrompt: prompt,
          translatedPrompt: translatedPrompt,
          translation_status: translation_status
        };
      } else {
        throw new Error('No image URL in Runware response');
      }
    } else {
      const errorText = await response.text();
      console.error("🎨 Runware API error:", response.status, errorText);
      throw new Error(`Runware API failed: ${response.status} - ${errorText}`);
    }

  } catch (error: any) {
    console.error('🎨 Error generating image with Runware:', error);
    return {
      success: false,
      error: error.message,
      translation_status: 'not_needed'
    };
  }
}
