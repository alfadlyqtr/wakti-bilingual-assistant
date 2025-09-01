import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🎯 Text Generator: Function called successfully - Processing request");
    console.log("🎯 Text Generator: Request method:", req.method);
    console.log("🎯 Text Generator: Request headers:", Object.fromEntries(req.headers.entries()));
    
    if (!OPENAI_API_KEY && !DEEPSEEK_API_KEY) {
      console.error("🚨 Text Generator: No AI provider keys found in environment");
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "No AI provider configured. Please add OPENAI_API_KEY or DEEPSEEK_API_KEY to Supabase Edge Function Secrets." 
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

    const { prompt, mode, language, messageAnalysis, modelPreference, temperature, contentType, length, replyLength } = requestBody;

    console.log("🎯 Request details:", { 
      promptLength: prompt?.length || 0, 
      mode, 
      language,
      hasMessageAnalysis: !!messageAnalysis,
      contentType,
      length,
      replyLength
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

    console.log("🎯 Text Generator: Calling AI provider for text generation");
    console.log("🎯 Mode:", mode);
    console.log("🎯 Language:", language);
    console.log("🎯 Prompt length:", prompt.length);
    console.log("🎯 Requested modelPreference:", modelPreference);
    console.log("🎯 Requested temperature:", temperature);

    const systemPrompt = getSystemPrompt(language);
    const temp = typeof temperature === 'number' ? Math.max(0, Math.min(1, temperature)) : 0.7;

    // Hybrid model selection (backend safety net)
    const longFormTypes = new Set([
      'story','article','report','proposal','press_release','cover_letter','official_letter','research_brief','research_report','case_study','how_to_guide','policy_note','essay'
    ]);
    const wantsLong = (mode === 'reply' ? replyLength === 'long' : length === 'long');
    let preferredOpenAIModel = 'gpt-4o-mini';
    if (modelPreference === 'gpt-4o' || modelPreference === 'gpt-4o-mini') {
      preferredOpenAIModel = modelPreference;
    } else if (wantsLong || (contentType && longFormTypes.has(contentType))) {
      preferredOpenAIModel = 'gpt-4o';
    }
    let temperatureUsed = temp;
    
    let generatedText = "";
    let modelUsed = "";

    // Try OpenAI (preferred model) first if available
    if (OPENAI_API_KEY) {
      try {
        console.log(`🎯 Text Generator: Trying OpenAI ${preferredOpenAIModel} first`);
        const startOpenAI = Date.now();
        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: preferredOpenAIModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt }
            ],
            temperature: temp,
            max_tokens: 2000,
          }),
        });
        const openaiDuration = Date.now() - startOpenAI;
        console.log(`🎯 Text Generator: OpenAI request completed in ${openaiDuration}ms with status ${openaiResponse.status}`);

        if (openaiResponse.ok) {
          const openaiResult = await openaiResponse.json();
          const content = openaiResult.choices?.[0]?.message?.content || "";
          if (content) {
            generatedText = content;
            modelUsed = preferredOpenAIModel;
          } else {
            console.warn("🎯 Text Generator: OpenAI returned no content");
          }
        } else {
          const errTxt = await openaiResponse.text();
          console.warn("🎯 Text Generator: OpenAI API error:", { status: openaiResponse.status, statusText: openaiResponse.statusText, error: errTxt });
        }
      } catch (e) {
        console.warn("🎯 Text Generator: OpenAI request threw error:", e);
      }
    }

    // Fallback to DeepSeek if needed and available
    if (!generatedText && DEEPSEEK_API_KEY) {
      try {
        console.log("🎯 Text Generator: Falling back to DeepSeek (deepseek-chat)");
        const startDeepseek = Date.now();
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
            temperature: temp,
            max_tokens: 2000,
          }),
        });
        const deepseekDuration = Date.now() - startDeepseek;
        console.log(`🎯 Text Generator: DeepSeek request completed in ${deepseekDuration}ms with status ${deepseekResponse.status}`);

        if (deepseekResponse.ok) {
          const result = await deepseekResponse.json();
          const content = result.choices?.[0]?.message?.content || "";
          if (content) {
            generatedText = content;
            modelUsed = "deepseek-chat";
          } else {
            console.error("🎯 Text Generator: No text generated from DeepSeek API", JSON.stringify(result));
          }
        } else {
          const errorText = await deepseekResponse.text();
          console.error("🎯 Text Generator: DeepSeek API error:", { status: deepseekResponse.status, statusText: deepseekResponse.statusText, error: errorText });
        }
      } catch (e) {
        console.error("🎯 Text Generator: DeepSeek request threw error:", e);
      }
    }

    if (!generatedText) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "No text generated from AI providers" 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log("🎯 Text Generator: Successfully generated text, length:", generatedText.length, "model:", modelUsed);

    return new Response(
      JSON.stringify({
        success: true,
        generatedText,
        mode,
        language,
        modelUsed,
        temperatureUsed: temperatureUsed,
        contentType: contentType || null
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
- لا تستخدم أبداً شرطة إم (—) ولا الشرطة العادية (-)
- اتبع بدقة نوع المحتوى، النبرة، والطول المطلوب
- حافظ على الاتساق في الأسلوب
- قدم محتوى مفيداً وذا صلة
- لا تضع افتراضات غير ضرورية
- ركز على إنشاء النص فقط`
    : `
Guidelines:
- Write clear and direct text
- Do not use asterisks (*) for formatting
- NEVER use em-dashes (—) and hyphens (-)
- Strictly follow the requested Content Type, Tone, and Length
- Maintain consistency in style
- Provide helpful and relevant content
- Do not make unnecessary assumptions
- Focus only on text generation`;

  return basePrompt + guidelines;
}
