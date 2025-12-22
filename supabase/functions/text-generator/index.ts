import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateGemini } from "../_shared/gemini.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

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

    const { prompt, mode, language, languageVariant, messageAnalysis, modelPreference, temperature, contentType, length, replyLength, tone, register, image, extractTarget } = requestBody;

    console.log("🎯 Request details:", { 
      promptLength: prompt?.length || 0, 
      mode, 
      language,
      hasMessageAnalysis: !!messageAnalysis,
      contentType,
      length,
      replyLength,
      tone,
      hasImage: !!image,
      extractTarget
    });

    // ============================================
    // MODE: extract - Extract text from screenshot
    // ============================================
    if (mode === 'extract' && image) {
      console.log("🎯 Text Generator: EXTRACT MODE - Processing screenshot");
      
      if (!OPENAI_API_KEY) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "OpenAI API key required for image extraction" 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        // Prepare the image for OpenAI Vision API
        let imageUrl = image;
        if (!image.startsWith('http') && !image.startsWith('data:')) {
          imageUrl = `data:image/jpeg;base64,${image}`;
        }

        // Use structured extraction prompt to detect form fields
        const structuredPrompt = language === 'ar'
          ? `انظر إلى هذه الصورة بعناية وحدد ما الذي تراه بالضبط (نوع المحتوى ومصدره)، ثم استخرج النص كاملاً قدر الإمكان.

أعد النتيجة بتنسيق JSON فقط وبنفس البنية التالية. مهم جدًا:
- لا تُرجع أي نص خارج JSON.
- اجعل rawText شاملاً قدر الإمكان (لا تختصر).
- إذا كان النص طويلًا، استخرج كل ما يمكنك رؤيته بوضوح.

{
  "isScreenshot": true/false,
  "sourceType": "email" | "whatsapp" | "sms" | "imessage" | "support_portal" | "web_page" | "form" | "handwritten" | "photo" | "other",
  "deviceType": "phone" | "tablet" | "desktop" | "unknown",
  "isForm": true/false,
  "formType": "support_ticket" | "contact_form" | "email" | "message" | "other",
  "fields": {
    "subject": "العنوان أو الموضوع إن وجد",
    "category": "الفئة أو نوع المشكلة إن وجد",
    "service_affected": "الخدمة المتأثرة إن وجد",
    "severity": "الأولوية أو الخطورة إن وجد",
    "message": "نص الرسالة الرئيسي / وصف المشكلة",
    "sender": "اسم المرسل إن وجد",
    "recipient": "اسم المستلم إن وجد"
  },
  "rawText": "كل النص المرئي في الصورة"
}

أعد JSON فقط، بدون أي نص إضافي.`
          : `Look at this image carefully and first identify what it is (type + source), then extract as much text as possible.

Return ONLY valid JSON using this exact schema:
- No extra text outside JSON.
- rawText should include as much visible text as possible (do NOT summarize).
- If the text is long, extract everything you can clearly read.

{
  "isScreenshot": true/false,
  "sourceType": "email" | "whatsapp" | "sms" | "imessage" | "support_portal" | "web_page" | "form" | "handwritten" | "photo" | "other",
  "deviceType": "phone" | "tablet" | "desktop" | "unknown",
  "isForm": true/false,
  "formType": "support_ticket" | "contact_form" | "email" | "message" | "other",
  "fields": {
    "subject": "the subject/title if present",
    "category": "category/issue type if present",
    "service_affected": "which service is affected if present",
    "severity": "priority or severity if present",
    "message": "the main message body / issue description",
    "sender": "sender name if present",
    "recipient": "recipient name if present"
  },
  "rawText": "all visible text in the image"
}

Return ONLY the JSON, no additional text.`;

        console.log("🎯 Text Generator: Calling OpenAI Vision for structured extraction");
        const startVision = Date.now();
        
        const visionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: structuredPrompt },
                  { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
                ]
              }
            ],
            response_format: { type: "json_object" },
            max_tokens: 4000,
            temperature: 0.1,
          }),
        });

        const visionDuration = Date.now() - startVision;
        console.log(`🎯 Text Generator: Vision extraction completed in ${visionDuration}ms, status: ${visionResponse.status}`);

        if (!visionResponse.ok) {
          const errText = await visionResponse.text();
          console.error("🎯 Text Generator: Vision API error:", errText);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to extract text from image" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const visionResult = await visionResponse.json();
        const rawContent = visionResult.choices?.[0]?.message?.content || "";

        if (!rawContent.trim()) {
          return new Response(
            JSON.stringify({ success: false, error: "No text found in image" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Try to parse as JSON, fallback to raw text
        let extractedData: {
          isScreenshot?: boolean;
          sourceType?: string;
          deviceType?: string;
          isForm?: boolean;
          formType?: string;
          fields?: Record<string, string>;
          rawText?: string;
        } = {};
        let extractedText = rawContent;

        try {
          // Clean up potential markdown code blocks
          let jsonStr = rawContent.trim();
          if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
          if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
          if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
          jsonStr = jsonStr.trim();
          
          extractedData = JSON.parse(jsonStr);
          extractedText = extractedData.rawText || rawContent;
          console.log("🎯 Text Generator: Successfully parsed structured form data:", {
            isForm: extractedData.isForm,
            formType: extractedData.formType,
            fieldsCount: extractedData.fields ? Object.keys(extractedData.fields).length : 0
          });
        } catch (_parseErr) {
          console.log("🎯 Text Generator: Could not parse as JSON, using raw text");
          extractedData = { isForm: false, rawText: rawContent };
        }

        console.log("🎯 Text Generator: Successfully extracted, length:", extractedText.length);

        // Log successful extraction
        await logAIFromRequest(req, {
          functionName: "text-generator",
          provider: "openai",
          model: "gpt-4o",
          inputText: "[image extraction]",
          outputText: extractedText,
          durationMs: visionDuration,
          status: "success"
        });

        return new Response(
          JSON.stringify({
            success: true,
            extractedText,
            extractedForm: extractedData.isForm ? {
              formType: extractedData.formType || 'other',
              fields: extractedData.fields || {}
            } : null,
            extractedMeta: {
              isScreenshot: extractedData.isScreenshot ?? true,
              sourceType: extractedData.sourceType || 'other',
              deviceType: extractedData.deviceType || 'unknown',
            },
            mode: 'extract',
            extractTarget,
            modelUsed: 'gpt-4o'
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      } catch (e: unknown) {
        const err = e as Error;
        console.error("🎯 Text Generator: Extraction error:", err.message);
        return new Response(
          JSON.stringify({ success: false, error: `Extraction failed: ${err.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ============================================
    // MODE: compose/reply - Normal text generation
    // ============================================
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
          console.log("🎯 Text Generator: Successfully generated text, length:", generatedText?.length || 0, "model: gemini-2.5-flash-lite");

          // Log successful AI usage
          await logAIFromRequest(req, {
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
            const modelUsed = genParams.model;
            console.log("🎯 Text Generator: Successfully generated text, length:", generatedText?.length || 0, "model:", modelUsed);

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
            const modelUsed = genParams.model;
            console.log("🎯 Text Generator: Successfully generated text, length:", generatedText?.length || 0, "model:", modelUsed);

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
    await logAIFromRequest(req, {
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
