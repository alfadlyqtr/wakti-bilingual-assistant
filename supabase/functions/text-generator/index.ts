
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🎯 Text Generator: Function called successfully - Processing request");
    console.log("🎯 Text Generator: Request method:", req.method);
    console.log("🎯 Text Generator: Request headers:", Object.fromEntries(req.headers.entries()));
    
    if (!DEEPSEEK_API_KEY) {
      console.error("🚨 Text Generator: DEEPSEEK_API_KEY not found in environment");
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "DeepSeek API key not configured. Please add DEEPSEEK_API_KEY to Supabase Edge Function Secrets." 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    let requestBody;
    try {
      requestBody = await req.json();
      console.log("🎯 Text Generator: Request body parsed successfully");
    } catch (parseError) {
      console.error("🎯 Text Generator: Failed to parse request body:", parseError);
      requestBody = {};
    }

    const { prompt, mode, language, messageAnalysis } = requestBody;

    console.log("🎯 Request details:", { 
      promptLength: prompt?.length || 0, 
      mode, 
      language,
      hasMessageAnalysis: !!messageAnalysis
    });

    if (!prompt) {
      console.error("🎯 Text Generator: Missing prompt in request");
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Prompt is required" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log("🎯 Text Generator: Calling DeepSeek API for text generation");
    console.log("🎯 Mode:", mode);
    console.log("🎯 Language:", language);
    console.log("🎯 Prompt length:", prompt.length);

    const systemPrompt = getSystemPrompt(language);
    
    const startTime = Date.now();
    
    console.log("🎯 Text Generator: Making request to DeepSeek API...");
    const deepseekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const duration = Date.now() - startTime;
    console.log(`🎯 Text Generator: DeepSeek request completed in ${duration}ms`);
    console.log(`🎯 Text Generator: DeepSeek response status: ${deepseekResponse.status}`);

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error("🎯 Text Generator: DeepSeek API error:", {
        status: deepseekResponse.status,
        statusText: deepseekResponse.statusText,
        error: errorText
      });
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `DeepSeek API failed (${deepseekResponse.status}): ${errorText}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const result = await deepseekResponse.json();
    console.log("🎯 Text Generator: DeepSeek response received successfully");
    
    const generatedText = result.choices?.[0]?.message?.content || "";

    if (!generatedText) {
      console.error("🎯 Text Generator: No text generated from DeepSeek API");
      console.error("🎯 Text Generator: DeepSeek response structure:", JSON.stringify(result, null, 2));
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "No text generated from AI API" 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log("🎯 Text Generator: Successfully generated text, length:", generatedText.length);

    return new Response(
      JSON.stringify({
        success: true,
        generatedText: generatedText,
        mode: mode,
        language: language
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: any) {
    console.error("🎯 Text Generator: Unexpected error:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: `Text generation failed: ${error.message}` 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// System prompt for text generation
function getSystemPrompt(language: string): string {
  const basePrompt = language === 'ar' 
    ? "أنت مساعد ذكي متخصص في إنشاء النصوص عالية الجودة. مهمتك هي إنشاء محتوى واضح ومفيد ومتسق بناءً على طلب المستخدم."
    : "You are an intelligent assistant specialized in generating high-quality text content. Your task is to create clear, helpful, and coherent content based on the user's request.";

  const guidelines = language === 'ar'
    ? `
المبادئ التوجيهية:
- اكتب نصاً واضحاً ومباشراً
- تجنب استخدام النجوم (*) للتنسيق
- اتبع النبرة والطول المطلوبين
- حافظ على الاتساق في الأسلوب
- قدم محتوى مفيداً وذا صلة
- لا تضع افتراضات غير ضرورية
- ركز على إنشاء النص فقط`
    : `
Guidelines:
- Write clear and direct text
- Do not use asterisks (*) for formatting
- Follow the requested tone and length
- Maintain consistency in style
- Provide helpful and relevant content
- Do not make unnecessary assumptions
- Focus only on text generation`;

  return basePrompt + guidelines;
}
