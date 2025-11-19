// DEPLOYMENT FILE FOR: text-generator
// Copy this ENTIRE file into Supabase Dashboard → text-generator → index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================================
// INLINED GEMINI HELPER
// ============================================================================
type GeminiPart = { text?: string } | { inlineData: { mimeType: string; data: string } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

function getGeminiApiKey(): string {
  const k = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!k) throw new Error("Gemini API key not configured");
  return k;
}

async function generateGemini(
  model: string,
  contents: GeminiContent[],
  systemInstruction?: string,
  generationConfig?: any,
  safetySettings?: any[]
): Promise<any> {
  const key = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body: any = { contents };
  try {
    console.log(`[GEMINI_TEXT_DEBUG] Using key prefix: ${key.slice(0, 6)}***`);
    console.log(`[GEMINI_TEXT_DEBUG] URL: ${url}`);
    console.log(`[GEMINI_TEXT_DEBUG] Payload roles: ${contents.map((c) => c.role).join(', ')}`);
  } catch {}
  if (systemInstruction) body.system_instruction = { parts: [{ text: systemInstruction }] };
  if (generationConfig) body.generationConfig = generationConfig;
  if (safetySettings) body.safetySettings = safetySettings;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Gemini error: ${resp.status} - ${t}`);
  }
  return await resp.json();
}

// ============================================================================
// MAIN TEXT GENERATOR FUNCTION
// ============================================================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");

const contentConfig = { email: { baseTokens: 1024, model: 'gpt-4o-mini', temperature: 0.7 }, text_message: { baseTokens: 512, model: 'gpt-4o-mini', temperature: 0.7 }, message: { baseTokens: 768, model: 'gpt-4o-mini', temperature: 0.7 }, blog_post: { baseTokens: 2048, model: 'gpt-4o', temperature: 0.7 }, story: { baseTokens: 3072, model: 'gpt-4o', temperature: 0.8 }, press_release: { baseTokens: 1536, model: 'gpt-4o', temperature: 0.5 }, cover_letter: { baseTokens: 1024, model: 'gpt-4o', temperature: 0.6 }, research_brief: { baseTokens: 2048, model: 'gpt-4o', temperature: 0.4 }, research_report: { baseTokens: 4096, model: 'gpt-4o', temperature: 0.4 }, case_study: { baseTokens: 3072, model: 'gpt-4o', temperature: 0.6 }, how_to_guide: { baseTokens: 2048, model: 'gpt-4o', temperature: 0.5 }, policy_note: { baseTokens: 1536, model: 'gpt-4o', temperature: 0.4 }, product_description: { baseTokens: 768, model: 'gpt-4o-mini', temperature: 0.7 }, essay: { baseTokens: 3072, model: 'gpt-4o', temperature: 0.7 }, proposal: { baseTokens: 2560, model: 'gpt-4o', temperature: 0.6 }, official_letter: { baseTokens: 1024, model: 'gpt-4o', temperature: 0.5 }, poem: { baseTokens: 1024, model: 'gpt-4o', temperature: 0.9 }, default: { baseTokens: 1024, model: 'gpt-4o-mini', temperature: 0.7 } } as const;
const lengthMultipliers = { 'very_short': 0.5, 'short': 0.75, 'medium': 1.0, 'long': 1.5, 'very_long': 2.0 } as const;
const toneAdjustments = { funny: { tempAdj: +0.2, tokenAdj: 1.0 }, romantic: { tempAdj: +0.2, tokenAdj: 1.0 }, humorous: { tempAdj: +0.3, tokenAdj: 1.0 }, inspirational: { tempAdj: +0.1, tokenAdj: 1.1 }, motivational: { tempAdj: +0.1, tokenAdj: 1.1 }, professional: { tempAdj: -0.1, tokenAdj: 1.0 }, formal: { tempAdj: -0.2, tokenAdj: 1.0 }, serious: { tempAdj: -0.2, tokenAdj: 1.0 }, authoritative: { tempAdj: -0.1, tokenAdj: 1.0 }, neutral: { tempAdj: 0, tokenAdj: 1.0 }, friendly: { tempAdj: +0.1, tokenAdj: 1.0 }, empathetic: { tempAdj: +0.1, tokenAdj: 1.0 }, default: { tempAdj: 0, tokenAdj: 1.0 } } as const;
const registerAdjustments = { auto: { tempAdj: 0.0, tokenAdj: 1.0 }, formal: { tempAdj: -0.10, tokenAdj: 1.0 }, neutral: { tempAdj: 0.0, tokenAdj: 1.0 }, casual: { tempAdj: +0.05, tokenAdj: 1.0 }, slang: { tempAdj: +0.10, tokenAdj: 0.90 }, poetic: { tempAdj: +0.05, tokenAdj: 1.10 }, gen_z: { tempAdj: +0.10, tokenAdj: 0.90 }, business_formal: { tempAdj: -0.10, tokenAdj: 1.0 }, executive_brief: { tempAdj: -0.10, tokenAdj: 0.85 } } as const;

function getGenerationParams(contentType: string, tone: string, length: string, register?: string) {
  const config = (contentConfig as any)[contentType] || contentConfig.default;
  const lengthMult = (lengthMultipliers as any)[length] || 1.0;
  const toneAdj = (toneAdjustments as any)[tone] || toneAdjustments.default;
  const regAdj = (registerAdjustments as any)[register || 'auto'] || registerAdjustments.auto;
  const finalTemp = Math.min(1.0, Math.max(0.1, config.temperature + toneAdj.tempAdj + regAdj.tempAdj));
  const finalTokens = Math.max(256, Math.min(4096, Math.floor(config.baseTokens * lengthMult * toneAdj.tokenAdj * regAdj.tokenAdj)));
  return { model: config.model, temperature: finalTemp, max_tokens: finalTokens };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let requestBody: any = {};
    try { requestBody = await req.json(); } catch {}
    const { prompt, mode, language, languageVariant, messageAnalysis, modelPreference, temperature, contentType, length, replyLength, tone, register } = requestBody;
    if (!prompt) return new Response(JSON.stringify({ success: false, error: "Prompt required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const systemPrompt = getSystemPrompt(language, languageVariant);
    const genParams = getGenerationParams(contentType, tone, length || 'medium', register);

    let generatedText: string | undefined;

    // Gemini primary
    if (GEMINI_API_KEY) {
      try {
        const result = await generateGemini('gemini-2.5-flash-lite', [{ role: 'user', parts: [{ text: prompt }] }], systemPrompt, { temperature: genParams.temperature, maxOutputTokens: genParams.max_tokens }, []);
        const content = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (content) {
          generatedText = content;
          return new Response(JSON.stringify({ success: true, generatedText, mode, language, modelUsed: 'gemini-2.5-flash-lite', providerUsed: 'gemini', temperatureUsed: genParams.temperature, contentType: contentType || null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch {}
    }

    // OpenAI fallback
    if (OPENAI_API_KEY && !generatedText) {
      try {
        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` }, body: JSON.stringify({ model: genParams.model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }], temperature: genParams.temperature, max_tokens: genParams.max_tokens }) });
        if (openaiResponse.ok) {
          const openaiResult = await openaiResponse.json();
          const content = openaiResult.choices?.[0]?.message?.content || "";
          if (content) {
            generatedText = content;
            return new Response(JSON.stringify({ success: true, generatedText, mode, language, modelUsed: genParams.model, providerUsed: 'openai', temperatureUsed: genParams.temperature, contentType: contentType || null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } catch {}
    }

    // DeepSeek fallback
    if ((!OPENAI_API_KEY || !generatedText) && DEEPSEEK_API_KEY) {
      try {
        const deepseekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_API_KEY}` }, body: JSON.stringify({ model: genParams.model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }], temperature: genParams.temperature, max_tokens: genParams.max_tokens }) });
        if (deepseekResponse.ok) {
          const result = await deepseekResponse.json();
          const content = result.choices?.[0]?.message?.content || "";
          if (content) {
            generatedText = content;
            return new Response(JSON.stringify({ success: true, generatedText, mode, language, modelUsed: genParams.model, providerUsed: 'deepseek', temperatureUsed: genParams.temperature, contentType: contentType || null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } catch {}
    }

    return new Response(JSON.stringify({ success: false, error: "No text generated" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: `Failed: ${error?.message || 'unknown'}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function getSystemPrompt(language: string, languageVariant?: string): string {
  const isArabic = language === 'ar';
  const v = (languageVariant || '').toString().trim().toLowerCase();
  let variantLine = '';
  if (!isArabic) {
    if (v.includes('canadian') || v.includes('en-ca') || v === 'ca' || v.includes('canada')) variantLine = 'Use Canadian English (colour, centre, cheque, licence, defence). Prefer metric.';
    else if (v.includes('us') || v.includes('en-us') || v.includes('american')) variantLine = 'Use US English (color, center, check, license, defense).';
    else if (v.includes('uk') || v.includes('en-gb') || v.includes('british')) variantLine = 'Use UK English (colour, centre, cheque, licence, defence).';
    else if (v.includes('aus') || v.includes('au') || v.includes('australian') || v.includes('en-au')) variantLine = 'Use Australian English. Prefer metric.';
  } else {
    if (v.includes('msa') || v.includes('modern standard') || v.includes('فصحى') || v.includes('fusha')) variantLine = 'استخدم العربية الفصحى MSA.';
    else if (v.includes('gulf') || v.includes('khaleeji') || v.includes('الخليج') || v.includes('خليج')) variantLine = 'استخدم العربية الخليجية بأسلوب طبيعي ومفهوم.';
  }
  const basePrompt = isArabic ? 'أنت مساعد ذكي متخصص في إنشاء النصوص عالية الجودة. مهمتك هي إنشاء محتوى واضح ومفيد ومتسق بناءً على طلب المستخدم.' : "You are an intelligent assistant specialized in generating high-quality text content. Your task is to create clear, helpful, and coherent content based on the user's request.";
  const guidelines = isArabic ? `\nالمبادئ التوجيهية:\n- اكتب نصاً واضحاً ومباشراً\n- تجنب استخدام النجوم (*) للتنسيق\n- لا تستخدم أبداً شرطة إم (—) ولا الشرطة العادية (-)\n- اتبع بدقة نوع المحتوى، النبرة، والطول المطلوب\n- حافظ على الاتساق في الأسلوب\n- قدم محتوى مفيداً وذا صلة\n- لا تضع افتراضات غير ضرورية\n- ركز على إنشاء النص فقط` : `\nGuidelines:\n- Write clear and direct text\n- Do not use asterisks (*) for formatting\n- NEVER use em-dashes (—) and hyphens (-)\n- Strictly follow the requested Content Type, Tone, and Length\n- Maintain consistency in style\n- Provide helpful and relevant content\n- Do not make unnecessary assumptions\n- Focus only on text generation`;
  const variantBlock = variantLine ? (isArabic ? `\nتعليمات المتغير اللغوي: ${variantLine}` : `\nLanguage variant: ${variantLine}`) : '';
  return basePrompt + guidelines + variantBlock;
}
