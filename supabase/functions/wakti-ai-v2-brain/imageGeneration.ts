/**
 * Image generation for Wakti Edge Function
 */
import { supabase, OPENAI_API_KEY, RUNWARE_API_KEY, DEEPSEEK_API_KEY } from "./utils.ts";

// Utility: Detects if input contains Arabic characters
function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

// Utility: Translate text to English via OpenAI
async function translateToEnglishOpenAI(prompt: string): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error("OpenAI API key not set for translation");
  const systemPrompt = "You are a professional translator. Given the following Arabic prompt for image generation, translate it to clear English, optimized for AI image creation. Respond with only the English translation, and DO NOT include any explanations, notes, or non-English words.";

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: "POST",
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: 512,
      temperature: 0.4,
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error("OpenAI translation failed: " + errText);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || prompt;
}

// Utility: Translate Arabic text to English via DeepSeek
async function translateToEnglishDeepSeek(prompt: string): Promise<string> {
  if (!DEEPSEEK_API_KEY) throw new Error("DeepSeek API key not set for translation");
  const systemPrompt = "You are a professional translator. Given the following Arabic prompt for image generation, translate it to clear English, optimized for AI image creation. Respond with only the English translation, and DO NOT include any explanations, notes, or non-English words.";
  const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 512
    })
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error("DeepSeek translation failed: " + errText);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || prompt;
}

export async function generateImageWithRunware(prompt: string, userId: string, language: string = 'en') {
  try {
    console.log("🎨 Generating image with Runware for prompt:", prompt);
    let runwarePrompt = prompt;
    let translatedPrompt: string | undefined = undefined;

    // Translate if Arabic is detected (regardless of language param)
    if (containsArabic(prompt)) {
      try {
        console.log("🌐 Translating Arabic prompt to English via DeepSeek...");
        translatedPrompt = await translateToEnglishDeepSeek(prompt);
        runwarePrompt = translatedPrompt;
        console.log("🌐 Arabic-to-English result:", translatedPrompt);
      } catch (err) {
        console.error("❌ Failed to translate Arabic prompt via DeepSeek, using original prompt:", err);
        runwarePrompt = prompt;
      }
    }

    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
                provider: 'runware',
                imageUUID: imageResult.imageUUID,
                originalPrompt: prompt,
                translatedPrompt: translatedPrompt // always show if set
              }
            });
        } catch (dbError) {
          console.log("Could not save image to database:", dbError);
        }

        return {
          success: true,
          imageUrl: imageResult.imageURL,
          originalPrompt: prompt,
          translatedPrompt: translatedPrompt
        };
      } else {
        throw new Error('No image URL in Runware response');
      }
    } else {
      const errorText = await response.text();
      console.error("🎨 Runware API error:", response.status, errorText);
      throw new Error(`Runware API failed: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error('🎨 Error generating image with Runware:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
