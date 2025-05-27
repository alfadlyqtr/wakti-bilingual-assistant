
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const RUNWARE_API_KEY = "yzJMWPrRdkJcge2q0yjSOwTGvlhMeOy1";
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Function to detect if text contains Arabic characters
function containsArabic(text: string): boolean {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicRegex.test(text);
}

// Function to translate Arabic to English using AI
async function translateToEnglish(arabicText: string): Promise<string> {
  console.log("Translating Arabic text to English:", arabicText);

  // Try DeepSeek first
  if (DEEPSEEK_API_KEY) {
    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: "You are a translator. Translate the Arabic text to English. Focus on translating image generation prompts accurately. Only return the English translation, nothing else."
            },
            {
              role: "user",
              content: arabicText
            }
          ],
          temperature: 0.3,
          max_tokens: 200,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const translation = result.choices[0].message?.content?.trim();
        if (translation) {
          console.log("DeepSeek translation result:", translation);
          return translation;
        }
      }
    } catch (error) {
      console.log("DeepSeek translation failed:", error.message);
    }
  }

  // Fallback to OpenAI
  if (OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a translator. Translate the Arabic text to English. Focus on translating image generation prompts accurately. Only return the English translation, nothing else."
            },
            {
              role: "user",
              content: arabicText
            }
          ],
          temperature: 0.3,
          max_tokens: 200,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const translation = result.choices[0].message?.content?.trim();
        if (translation) {
          console.log("OpenAI translation result:", translation);
          return translation;
        }
      }
    } catch (error) {
      console.log("OpenAI translation failed:", error.message);
    }
  }

  // If both fail, return original text
  console.log("Translation failed, using original text");
  return arabicText;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log("Original prompt:", prompt);

    // Check if prompt contains Arabic and translate if needed
    let translatedPrompt = prompt;
    let isTranslated = false;
    
    if (containsArabic(prompt)) {
      console.log("Arabic detected, translating to English...");
      translatedPrompt = await translateToEnglish(prompt);
      isTranslated = true;
      console.log("Using translated prompt for image generation:", translatedPrompt);
    } else {
      console.log("No Arabic detected, using original prompt");
    }

    console.log("Generating image with Runware API for prompt:", translatedPrompt);

    // Use Runware API for image generation with translated prompt
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
          positivePrompt: translatedPrompt,
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

    console.log("Runware API response status:", response.status);

    if (response.ok) {
      const result = await response.json();
      console.log("Runware API response:", result);
      
      // Find the image inference result
      const imageResult = result.data?.find((item: any) => item.taskType === "imageInference");
      
      if (imageResult && imageResult.imageURL) {
        return new Response(
          JSON.stringify({ 
            imageUrl: imageResult.imageURL,
            prompt: prompt, // Return original prompt for user display
            translatedPrompt: isTranslated ? translatedPrompt : undefined,
            provider: "runware",
            wasTranslated: isTranslated
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        throw new Error("No image URL in Runware response");
      }
    } else {
      const errorText = await response.text();
      console.error("Runware API error:", response.status, errorText);
      throw new Error(`Runware API failed: ${response.status} - ${errorText}`);
    }

  } catch (error) {
    console.error("Error generating image:", error);
    return new Response(
      JSON.stringify({ 
        error: "Image generation failed", 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
