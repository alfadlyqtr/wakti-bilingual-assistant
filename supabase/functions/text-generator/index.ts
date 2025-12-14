import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateGemini } from "../_shared/gemini.ts";
import { logAI } from "../_shared/aiLogger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");

// Content type configurations
const contentConfig = {
  // Short form content types (emails, messages, etc.)
  email: { baseTokens: 1024, model: 'gpt-4o-mini', temperature: 0.7 },
  text_message: { baseTokens: 512, model: 'gpt-4o-mini', temperature: 0.7 },
  message: { baseTokens: 768, model: 'gpt-4o-mini', temperature: 0.7 },
  
  // Long form content types
  blog_post: { baseTokens: 2048, model: 'gpt-4o', temperature: 0.7 },
  story: { baseTokens: 3072, model: 'gpt-4o', temperature: 0.8 },
  press_release: { baseTokens: 1536, model: 'gpt-4o', temperature: 0.5 },
  cover_letter: { baseTokens: 1024, model: 'gpt-4o', temperature: 0.6 },
  research_brief: { baseTokens: 2048, model: 'gpt-4o', temperature: 0.4 },
  research_report: { baseTokens: 4096, model: 'gpt-4o', temperature: 0.4 },
  case_study: { baseTokens: 3072, model: 'gpt-4o', temperature: 0.6 },
  how_to_guide: { baseTokens: 2048, model: 'gpt-4o', temperature: 0.5 },
  policy_note: { baseTokens: 1536, model: 'gpt-4o', temperature: 0.4 },
  product_description: { baseTokens: 768, model: 'gpt-4o-mini', temperature: 0.7 },
  essay: { baseTokens: 3072, model: 'gpt-4o', temperature: 0.7 },
  proposal: { baseTokens: 2560, model: 'gpt-4o', temperature: 0.6 },
  official_letter: { baseTokens: 1024, model: 'gpt-4o', temperature: 0.5 },
  poem: { baseTokens: 1024, model: 'gpt-4o', temperature: 0.9 },
  
  // Default fallback
  default: { baseTokens: 1024, model: 'gpt-4o-mini', temperature: 0.7 }
};

// Length multipliers
const lengthMultipliers = {
  'very_short': 0.5,
  'short': 0.75,
  'medium': 1.0,
  'long': 1.5,
  'very_long': 2.0
};

// Tone adjustments
const toneAdjustments = {
  // Creative tones
  funny: { tempAdj: +0.2, tokenAdj: 1.0 },
  romantic: { tempAdj: +0.2, tokenAdj: 1.0 },
  humorous: { tempAdj: +0.3, tokenAdj: 1.0 },
  inspirational: { tempAdj: +0.1, tokenAdj: 1.1 },
  motivational: { tempAdj: +0.1, tokenAdj: 1.1 },
  
  // Professional tones
  professional: { tempAdj: -0.1, tokenAdj: 1.0 },
  formal: { tempAdj: -0.2, tokenAdj: 1.0 },
  serious: { tempAdj: -0.2, tokenAdj: 1.0 },
  authoritative: { tempAdj: -0.1, tokenAdj: 1.0 },
  
  // Neutral tones
  neutral: { tempAdj: 0, tokenAdj: 1.0 },
  friendly: { tempAdj: +0.1, tokenAdj: 1.0 },
  empathetic: { tempAdj: +0.1, tokenAdj: 1.0 },
  
  // Default fallback
  default: { tempAdj: 0, tokenAdj: 1.0 }
};

// Register adjustments: influence temperature and tokens based on register (formality/style)
const registerAdjustments = {
  auto:       { tempAdj: 0.0,  tokenAdj: 1.0 },
  formal:     { tempAdj: -0.10, tokenAdj: 1.0 },
  neutral:    { tempAdj: 0.0,  tokenAdj: 1.0 },
  casual:     { tempAdj: +0.05, tokenAdj: 1.0 },
  slang:      { tempAdj: +0.10, tokenAdj: 0.90 },
  poetic:     { tempAdj: +0.05, tokenAdj: 1.10 },
  gen_z:      { tempAdj: +0.10, tokenAdj: 0.90 },
  business_formal: { tempAdj: -0.10, tokenAdj: 1.0 },
  executive_brief: { tempAdj: -0.10, tokenAdj: 0.85 },
} as const;

// Get generation parameters based on content type, tone, length, and register
function getGenerationParams(contentType: string, tone: string, length: string, register?: string) {
  const config = contentConfig[contentType as keyof typeof contentConfig] || contentConfig.default;
  const lengthMult = lengthMultipliers[length as keyof typeof lengthMultipliers] || 1.0;
  const toneAdj = toneAdjustments[tone as keyof typeof toneAdjustments] || toneAdjustments.default;
  const regAdj = registerAdjustments[(register as keyof typeof registerAdjustments) || 'auto'] || registerAdjustments.auto;
  
  // Calculate final values with bounds
  const finalTemp = Math.min(1.0, Math.max(0.1, config.temperature + toneAdj.tempAdj + regAdj.tempAdj));
  const finalTokens = Math.max(256, Math.min(4096, Math.floor(config.baseTokens * lengthMult * toneAdj.tokenAdj * regAdj.tokenAdj)));
  
  return {
    model: config.model,
    temperature: finalTemp,
    max_tokens: finalTokens
  };
}

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

    const { prompt, mode, language, languageVariant, messageAnalysis, modelPreference, temperature, contentType, length, replyLength, tone, register } = requestBody;

    console.log("🎯 Request details:", { 
      promptLength: prompt?.length || 0, 
      mode, 
      language,
      hasMessageAnalysis: !!messageAnalysis,
      contentType,
      length,
      replyLength,
      tone
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

    const systemPrompt = getSystemPrompt(language, languageVariant);
    const genParams = getGenerationParams(contentType, tone, length || 'medium', register);
    console.log("🎯 Generation parameters:", genParams);

    let generatedText: string | undefined;

    // Try Gemini first if available
    if (GEMINI_API_KEY) {
      try {
        console.log("🎯 Text Generator: Attempting Gemini (gemini-2.5-flash-lite)");
        const startGemini = Date.now();
        const result = await generateGemini(
          'gemini-2.5-flash-lite',
          [{ role: 'user', parts: [{ text: prompt }] }],
          systemPrompt,
          { temperature: genParams.temperature, maxOutputTokens: genParams.max_tokens },
          []
        );
        const geminiDuration = Date.now() - startGemini;
        console.log(`🎯 Text Generator: Gemini request completed in ${geminiDuration}ms`);

        const content = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (content) {
          generatedText = content;
          console.log("🎯 Text Generator: Successfully generated text, length:", generatedText.length, "model: gemini-2.5-flash-lite");

          // Log successful AI usage
          await logAI({
            functionName: "text-generator",
            provider: "gemini",
            model: "gemini-2.5-flash-lite",
            inputText: prompt,
            outputText: generatedText,
            durationMs: geminiDuration,
            status: "success"
          });

          return new Response(
            JSON.stringify({
              success: true,
              generatedText,
              mode,
              language,
              modelUsed: 'gemini-2.5-flash-lite',
              temperatureUsed: genParams.temperature,
              contentType: contentType || null
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          console.warn("🎯 Text Generator: Gemini returned no content");
        }
      } catch (e) {
        console.warn("🎯 Text Generator: Gemini request threw error:", e);
      }
    }

    // Fallback to OpenAI if Gemini failed or unavailable
    if (OPENAI_API_KEY && !generatedText) {
      try {
        console.log("🎯 Text Generator: Attempting OpenAI", genParams.model);
        const startOpenai = Date.now();
        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: genParams.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt }
            ],
            temperature: genParams.temperature,
            max_tokens: genParams.max_tokens,
          }),
        });
        const openaiDuration = Date.now() - startOpenai;
        console.log(`🎯 Text Generator: OpenAI request completed in ${openaiDuration}ms with status ${openaiResponse.status}`);

        if (openaiResponse.ok) {
          const openaiResult = await openaiResponse.json();
          const content = openaiResult.choices?.[0]?.message?.content || "";
          if (content) {
            generatedText = content;
            let modelUsed = genParams.model;
            console.log("🎯 Text Generator: Successfully generated text, length:", generatedText.length, "model:", modelUsed);

            return new Response(
              JSON.stringify({
                success: true,
                generatedText,
                mode,
                language,
                modelUsed,
                temperatureUsed: genParams.temperature,
                contentType: contentType || null
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
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
    if (!OPENAI_API_KEY || (!generatedText && DEEPSEEK_API_KEY)) {
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
            model: genParams.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt }
            ],
            temperature: genParams.temperature,
            max_tokens: genParams.max_tokens,
          }),
        });
        const deepseekDuration = Date.now() - startDeepseek;
        console.log(`🎯 Text Generator: DeepSeek request completed in ${deepseekDuration}ms with status ${deepseekResponse.status}`);

        if (deepseekResponse.ok) {
          const result = await deepseekResponse.json();
          const content = result.choices?.[0]?.message?.content || "";
          if (content) {
            generatedText = content;
            let modelUsed = genParams.model;
            console.log("🎯 Text Generator: Successfully generated text, length:", generatedText.length, "model:", modelUsed);

            return new Response(
              JSON.stringify({
                success: true,
                generatedText,
                mode,
                language,
                modelUsed,
                temperatureUsed: genParams.temperature,
                contentType: contentType || null
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
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
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error("🎯 Text Generator: Unexpected error:", {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    
    // Log failed AI usage
    await logAI({
      functionName: "text-generator",
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      status: "error",
      errorMessage: err.message
    });

    return new Response(
      JSON.stringify({ 
        success: false,
        error: `Text generation failed: ${err.message}` 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// System prompt for text generation with language variant enforcement
function getSystemPrompt(language: string, languageVariant?: string): string {
  const isArabic = language === 'ar';

  // Normalize variant for robust matching (e.g., "Canadian English", "en-CA", "CA")
  const v = (languageVariant || '').toString().trim().toLowerCase();

  let variantLine = '';
  if (!isArabic) {
    if (v.includes('canadian') || v.includes('en-ca') || v === 'ca' || v.includes('canada')) {
      variantLine = 'Use Canadian English spelling and phrasing (e.g., colour, centre, cheque, licence, defence). Prefer metric units.';
    } else if (v.includes('us') || v.includes('en-us') || v.includes('american')) {
      variantLine = 'Use US English spelling and phrasing (e.g., color, center, check, license, defense).';
    } else if (v.includes('uk') || v.includes('en-gb') || v.includes('british')) {
      variantLine = 'Use UK English spelling and phrasing (e.g., colour, centre, cheque, licence, defence).';
    } else if (v.includes('aus') || v.includes('au') || v.includes('australian') || v.includes('en-au')) {
      variantLine = 'Use Australian English spelling and phrasing. Prefer metric units.';
    }
  } else {
    if (v.includes('msa') || v.includes('modern standard') || v.includes('فصحى') || v.includes('fusha')) {
      variantLine = 'استخدم العربية الفصحى MSA.';
    } else if (v.includes('gulf') || v.includes('khaleeji') || v.includes('الخليج') || v.includes('خليج')) {
      variantLine = 'استخدم العربية الخليجية بأسلوب طبيعي ومفهوم.';
    }
  }

  const basePrompt = isArabic
    ? 'أنت مساعد ذكي متخصص في إنشاء النصوص عالية الجودة. مهمتك هي إنشاء محتوى واضح ومفيد ومتسق بناءً على طلب المستخدم.'
    : "You are an intelligent assistant specialized in generating high-quality text content. Your task is to create clear, helpful, and coherent content based on the user's request.";

  const guidelines = isArabic
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

  const variantBlock = variantLine
    ? (isArabic ? `\nتعليمات المتغير اللغوي: ${variantLine}` : `\nLanguage variant instruction: ${variantLine}`)
    : '';

  return basePrompt + guidelines + variantBlock;
}
