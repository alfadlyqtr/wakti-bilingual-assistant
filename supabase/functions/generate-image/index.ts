
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY");
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

// Check if text contains Arabic characters
function containsArabic(text: string): boolean {
  const arabicPattern = /[\u0600-\u06FF]/;
  return arabicPattern.test(text);
}

// Translate text from Arabic to English using DeepSeek API
async function translateArabicToEnglish(text: string): Promise<string | null> {
  try {
    console.log("Translating Arabic text:", text);
    
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a professional translator. Translate the following Arabic text to English. Return ONLY the translation, nothing else."
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Translation API error response:", errorData);
      throw new Error(`Translation API error: ${response.status}`);
    }

    const result = await response.json();
    const translation = result.choices[0].message.content.trim();
    
    console.log("Translation result:", translation);
    return translation;
  } catch (error) {
    console.error("Error translating Arabic text:", error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Image prompt is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log("Received image generation prompt:", prompt);
    
    // Check if prompt contains Arabic text
    let translatedPrompt: string | null = null;
    const hasArabic = containsArabic(prompt);
    
    if (hasArabic) {
      console.log("Arabic text detected, translating...");
      translatedPrompt = await translateArabicToEnglish(prompt);
      
      if (!translatedPrompt) {
        return new Response(
          JSON.stringify({ 
            error: "Translation failed", 
            details: "تعذر معالجة هذا الوصف. يرجى تبسيطه أو إعادة المحاولة لاحقًا."
          }),
          { 
            status: 422, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
      
      console.log("Translated prompt:", translatedPrompt);
    }

    // Use translated prompt for image generation if available, otherwise use original
    const promptToUse = translatedPrompt || prompt;
    console.log("Using prompt for generation:", promptToUse);

    // Ensure proper Runware API call format with taskType
    const taskUUID = crypto.randomUUID();
    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RUNWARE_API_KEY}`,
      },
      body: JSON.stringify([
        {
          taskType: "authentication", 
          apiKey: RUNWARE_API_KEY
        },
        {
          taskType: "imageInference",
          taskUUID: taskUUID,
          positivePrompt: promptToUse,
          model: "runware:100@1",
          width: 1024,
          height: 1024,
          numberResults: 1,
          outputFormat: "WEBP",
          steps: 30
        }
      ]),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Runware API error response:", errorData);
      throw new Error(`Runware API error: ${errorData}`);
    }

    const result = await response.json();
    console.log("Runware API full response:", JSON.stringify(result));
    
    if (!result.data || result.data.length === 0) {
      throw new Error("No image data returned from API");
    }
    
    // Extract the image URL from the response data
    const imageData = result.data.find(item => item.taskType === "imageInference");
    if (!imageData || !imageData.imageURL) {
      console.error("API response missing imageURL:", JSON.stringify(result));
      throw new Error("No image URL found in the response");
    }
    
    console.log("Image successfully generated, URL:", imageData.imageURL);
    
    // Prepare the response with metadata including both prompts
    const responseData = { 
      imageUrl: imageData.imageURL,
      metadata: {}
    };
    
    // Include translation metadata only if Arabic was detected and translated
    if (hasArabic && translatedPrompt) {
      responseData.metadata = {
        originalPrompt: prompt,
        translatedPrompt: translatedPrompt
      };
    }
    
    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in generate-image function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Failed to generate image. Please try again with a different prompt."
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
