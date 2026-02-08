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
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Claude Haiku - cheapest cost-effective Claude model for text generation
const CLAUDE_MODEL = 'claude-3-5-haiku-latest';

// Content type configurations
const contentConfig = {
  // Short form content types (emails, messages, etc.)
  email: { baseTokens: 1024, model: 'gpt-4.1-mini', temperature: 0.7 },
  text_message: { baseTokens: 512, model: 'gpt-4.1-mini', temperature: 0.7 },
  message: { baseTokens: 768, model: 'gpt-4.1-mini', temperature: 0.7 },
  
  // Long form content types
  blog_post: { baseTokens: 2048, model: 'gpt-4.1-mini', temperature: 0.7 },
  story: { baseTokens: 3072, model: 'gpt-4.1-mini', temperature: 0.8 },
  press_release: { baseTokens: 1536, model: 'gpt-4.1-mini', temperature: 0.5 },
  cover_letter: { baseTokens: 1024, model: 'gpt-4.1-mini', temperature: 0.6 },
  research_brief: { baseTokens: 2048, model: 'gpt-4.1-mini', temperature: 0.4 },
  research_report: { baseTokens: 4096, model: 'gpt-4.1-mini', temperature: 0.4 },
  case_study: { baseTokens: 3072, model: 'gpt-4.1-mini', temperature: 0.6 },
  how_to_guide: { baseTokens: 2048, model: 'gpt-4.1-mini', temperature: 0.5 },
  policy_note: { baseTokens: 1536, model: 'gpt-4.1-mini', temperature: 0.4 },
  product_description: { baseTokens: 768, model: 'gpt-4.1-mini', temperature: 0.7 },
  essay: { baseTokens: 3072, model: 'gpt-4.1-mini', temperature: 0.7 },
  proposal: { baseTokens: 2560, model: 'gpt-4.1-mini', temperature: 0.6 },
  official_letter: { baseTokens: 1024, model: 'gpt-4.1-mini', temperature: 0.5 },
  poem: { baseTokens: 1024, model: 'gpt-4.1-mini', temperature: 0.9 },
  
  // Default fallback
  default: { baseTokens: 1024, model: 'gpt-4.1-mini', temperature: 0.7 }
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
    
    if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY && !DEEPSEEK_API_KEY) {
      console.error("🚨 Text Generator: No AI provider keys found in environment");
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "No AI provider configured. Please add ANTHROPIC_API_KEY, OPENAI_API_KEY, or DEEPSEEK_API_KEY to Supabase Edge Function Secrets." 
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

    const { prompt, mode, language, languageVariant, messageAnalysis, modelPreference: _modelPreference, temperature: _temperature, contentType, length, replyLength, tone, register, emojis, image, extractTarget, webSearch } = requestBody;

    console.log("🎯 Request details:", { 
      promptLength: prompt?.length || 0, 
      mode, 
      language,
      hasMessageAnalysis: !!messageAnalysis,
      contentType,
      length,
      replyLength,
      tone,
      register,
      languageVariant,
      emojis,
      hasImage: !!image,
      extractTarget,
      webSearch: !!webSearch
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
          status: "success",
          metadata: {
            mode: "extract",
            language,
            extractTarget,
          }
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
    console.log("🎯 Mode:", mode, "| Language:", language, "| Prompt length:", prompt.length);
    console.log("🎯 Structured fields:", { tone, register, languageVariant, emojis, contentType });

    const systemPrompt = buildSystemPrompt(language, { tone, register, languageVariant, emojis, contentType });
    const genParams = getGenerationParams(contentType, tone, length || replyLength || 'medium', register);
    console.log("🎯 Generation parameters:", genParams);

    const logMetadataBase = {
      mode,
      language,
      webSearch: !!webSearch,
      contentType: contentType ?? null,
      tone: tone ?? null,
      register: register ?? null,
      languageVariant: languageVariant ?? null,
      emojis: emojis ?? null,
      length: length ?? null,
      replyLength: replyLength ?? null,
      temperatureUsed: genParams.temperature,
      maxTokensUsed: genParams.max_tokens,
    };

    let generatedText: string | undefined;

    // ── Web Search: OpenAI gpt-4.1-mini (Responses API) ──
    if (webSearch && OPENAI_API_KEY) {
      try {
        console.log("🎯 Text Generator: Web Search enabled - using OpenAI gpt-4.1-mini Responses API");
        const startWebSearch = Date.now();
        
        const webSearchPrompt = language === 'ar'
          ? `أنت كاتب محترف. المستخدم يريد محتوى عالي الجودة عن الموضوع التالي.

**تعليمات مهمة:**
1. ابحث في الويب عن أحدث الحقائق والإحصائيات والأرقام الحقيقية
2. أضف تواريخ محددة وأرقام دقيقة (مثل: "في 2024، بلغ عدد السياح 5.6 مليون")
3. اذكر أسماء حقيقية للأماكن والمنظمات والأحداث
4. اكتب بأسلوب واضح ومنظم مع فقرات متماسكة
5. لا تحذف أي شيء من محتوى المستخدم - فقط عززه بالحقائق والمصادر
6. اجعل المحتوى غنياً بالمعلومات ومفيداً للقارئ

الموضوع:
${prompt}`
          : `You are a professional writer. The user wants high-quality content about the following topic.

**Critical Instructions:**
1. Search the web for the LATEST facts, statistics, and real data
2. Include SPECIFIC numbers, dates, and figures (e.g., "In 2024, tourism reached 5.6 million visitors")
3. Mention REAL names of places, organizations, events, and people where relevant
4. Write in a clear, well-organized style with coherent paragraphs
5. Do NOT remove or change the user's original content - only ENHANCE it with facts and sources
6. Make the content information-rich and valuable to the reader
7. If writing an essay or report, include a strong introduction, detailed body paragraphs, and a clear conclusion

Topic:
${prompt}`;

        const responsesApiBody = {
          model: 'gpt-4.1-mini',
          input: webSearchPrompt,
          tools: [{ type: 'web_search' }],
          instructions: systemPrompt,
          temperature: genParams.temperature,
        };

        const webSearchResponse = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify(responsesApiBody),
        });

        const webSearchDuration = Date.now() - startWebSearch;
        console.log(`🎯 Text Generator: Web Search completed in ${webSearchDuration}ms, status ${webSearchResponse.status}`);

        if (webSearchResponse.ok) {
          const webSearchResult = await webSearchResponse.json();
          const outputText = webSearchResult.output_text || webSearchResult.output?.[0]?.content?.[0]?.text || '';
          
          const sources: Array<{ title: string; url: string }> = [];
          if (Array.isArray(webSearchResult.output)) {
            for (const item of webSearchResult.output) {
              if (item.type === 'web_search_call' && Array.isArray(item.search_results)) {
                for (const result of item.search_results) {
                  if (result.url && result.title) sources.push({ title: result.title, url: result.url });
                }
              }
              if (item.type === 'message' && Array.isArray(item.content)) {
                for (const contentItem of item.content) {
                  if (contentItem.type === 'output_text' && Array.isArray(contentItem.annotations)) {
                    for (const annotation of contentItem.annotations) {
                      if (annotation.type === 'url_citation' && annotation.url && annotation.title) {
                        if (!sources.some(s => s.url === annotation.url)) {
                          sources.push({ title: annotation.title, url: annotation.url });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          
          if (outputText) {
            generatedText = sanitizeEmDashes(outputText);

            await logAIFromRequest(req, {
              functionName: "text-generator",
              provider: "openai",
              model: "gpt-4.1-mini",
              inputText: prompt,
              outputText: generatedText,
              durationMs: webSearchDuration,
              status: "success",
              metadata: {
                ...logMetadataBase,
                webSearchUsed: true,
              }
            });

            return new Response(
              JSON.stringify({
                success: true,
                generatedText,
                mode,
                language,
                modelUsed: 'gpt-4.1-mini (web_search)',
                temperatureUsed: genParams.temperature,
                contentType: contentType || null,
                webSearchUsed: true,
                webSearchSources: sources
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else {
            console.warn("🎯 Text Generator: Web Search returned no content, falling back");
          }
        } else {
          const errTxt = await webSearchResponse.text();
          console.warn("🎯 Text Generator: Web Search API error, falling back:", { status: webSearchResponse.status, error: errTxt });
        }
      } catch (e) {
        console.warn("🎯 Text Generator: Web Search threw error, falling back:", e);
      }
    }

    // ── Primary: Claude Haiku (non-web-search) ──
    if (ANTHROPIC_API_KEY && !generatedText) {
      try {
        console.log(`🎯 Text Generator: PRIMARY - Claude (${CLAUDE_MODEL})`);
        const startClaude = Date.now();
        const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: CLAUDE_MODEL,
            system: systemPrompt,
            messages: [
              { role: "user", content: prompt }
            ],
            temperature: genParams.temperature,
            max_tokens: genParams.max_tokens,
          }),
        });
        const claudeDuration = Date.now() - startClaude;
        console.log(`🎯 Text Generator: Claude completed in ${claudeDuration}ms, status ${claudeResponse.status}`);

        if (claudeResponse.ok) {
          const claudeResult = await claudeResponse.json();
          const content = claudeResult.content?.[0]?.text || "";
          if (content) {
            generatedText = sanitizeEmDashes(content);
            console.log("🎯 Text Generator: Claude success, length:", generatedText?.length || 0);

            await logAIFromRequest(req, {
              functionName: "text-generator",
              provider: "anthropic",
              model: CLAUDE_MODEL,
              inputText: prompt,
              outputText: generatedText,
              durationMs: claudeDuration,
              status: "success",
              metadata: {
                ...logMetadataBase,
                webSearchUsed: false,
              }
            });

            return new Response(
              JSON.stringify({
                success: true,
                generatedText,
                mode,
                language,
                modelUsed: CLAUDE_MODEL,
                temperatureUsed: genParams.temperature,
                contentType: contentType || null
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else {
            console.warn("🎯 Text Generator: Claude returned no content");
          }
        } else {
          const errTxt = await claudeResponse.text();
          console.warn("🎯 Text Generator: Claude API error:", { status: claudeResponse.status, error: errTxt });
        }
      } catch (e) {
        console.warn("🎯 Text Generator: Claude threw error:", e);
      }
    }

    // ── Fallback 1: OpenAI gpt-4.1-mini ──
    if (OPENAI_API_KEY && !generatedText) {
      try {
        console.log("🎯 Text Generator: FALLBACK 1 - OpenAI gpt-4.1-mini");
        const startOpenai = Date.now();
        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4.1-mini',
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt }
            ],
            temperature: genParams.temperature,
            max_tokens: genParams.max_tokens,
          }),
        });
        const openaiDuration = Date.now() - startOpenai;

        if (openaiResponse.ok) {
          const openaiResult = await openaiResponse.json();
          const content = openaiResult.choices?.[0]?.message?.content || "";
          if (content) {
            generatedText = sanitizeEmDashes(content);

            await logAIFromRequest(req, {
              functionName: "text-generator",
              provider: "openai",
              model: "gpt-4.1-mini",
              inputText: prompt,
              outputText: generatedText,
              durationMs: openaiDuration,
              status: "success",
              metadata: {
                ...logMetadataBase,
                webSearchUsed: false,
              }
            });

            return new Response(
              JSON.stringify({
                success: true,
                generatedText,
                mode,
                language,
                modelUsed: 'gpt-4.1-mini',
                temperatureUsed: genParams.temperature,
                contentType: contentType || null
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          const errTxt = await openaiResponse.text();
          console.warn("🎯 Text Generator: OpenAI fallback error:", errTxt);
        }
      } catch (e) {
        console.warn("🎯 Text Generator: OpenAI fallback threw:", e);
      }
    }

    // ── Fallback 2: Gemini ──
    if (GEMINI_API_KEY && !generatedText) {
      try {
        console.log("🎯 Text Generator: FALLBACK 2 - Gemini gemini-2.5-flash-lite");
        const startGemini = Date.now();
        const result = await generateGemini(
          'gemini-2.5-flash-lite',
          [{ role: 'user', parts: [{ text: prompt }] }],
          systemPrompt,
          { temperature: genParams.temperature, maxOutputTokens: genParams.max_tokens },
          []
        );
        const geminiDuration = Date.now() - startGemini;
        const content = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (content) {
          generatedText = sanitizeEmDashes(content);

          await logAIFromRequest(req, {
            functionName: "text-generator",
            provider: "gemini",
            model: "gemini-2.5-flash-lite",
            inputText: prompt,
            outputText: generatedText,
            durationMs: geminiDuration,
            status: "success",
            metadata: {
              ...logMetadataBase,
              webSearchUsed: false,
            }
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
        }
      } catch (e) {
        console.warn("🎯 Text Generator: Gemini fallback threw:", e);
      }
    }

    // ── Fallback 3: DeepSeek ──
    if (DEEPSEEK_API_KEY && !generatedText) {
      try {
        console.log("🎯 Text Generator: FALLBACK 3 - DeepSeek");
        const startDs = Date.now();
        const dsResp = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt }
            ],
            temperature: genParams.temperature,
            max_tokens: genParams.max_tokens,
          }),
        });
        const dsDuration = Date.now() - startDs;
        console.log(`🎯 Text Generator: DeepSeek completed in ${dsDuration}ms`);
        if (dsResp.ok) {
          const result = await dsResp.json();
          const content = result.choices?.[0]?.message?.content || "";
          if (content) {
            generatedText = sanitizeEmDashes(content);
            return new Response(
              JSON.stringify({
                success: true,
                generatedText,
                mode,
                language,
                modelUsed: 'deepseek-chat',
                temperatureUsed: genParams.temperature,
                contentType: contentType || null
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (e) {
        console.warn("🎯 Text Generator: DeepSeek fallback threw:", e);
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
    
    await logAIFromRequest(req, {
      functionName: "text-generator",
      provider: "anthropic",
      model: CLAUDE_MODEL,
      status: "error",
      errorMessage: err.message,
      metadata: {
        note: "Unhandled error in text-generator (request payload may be unavailable at this scope)"
      }
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

// ============================================================================
// Em-dash sanitation: guaranteed removal from all outputs
// ============================================================================
function sanitizeEmDashes(text: string): string {
  return text
    .replace(/\u2014/g, ', ')   // em-dash → comma
    .replace(/\u2013/g, ', ')   // en-dash → comma
    .replace(/ , /g, ', ')      // clean double spaces around comma
    .replace(/^, /gm, '');      // remove leading comma at line start
}

// ============================================================================
// System prompt builder: uses structured fields from frontend
// ============================================================================
interface StructuredFields {
  tone?: string;
  register?: string;
  languageVariant?: string;
  emojis?: string;
  contentType?: string;
}

function buildSystemPrompt(language: string, fields: StructuredFields): string {
  const isArabic = language === 'ar';
  const { tone, register, languageVariant, emojis, contentType } = fields;

  // ── Base identity ──
  const basePrompt = isArabic
    ? 'أنت كاتب محترف متخصص في إنشاء النصوص. مهمتك هي إنشاء محتوى بناءً على طلب المستخدم مع الالتزام الصارم بكل الإعدادات أدناه.'
    : "You are a professional writer. Your job is to generate text content following the user's request while strictly obeying EVERY setting below.";

  // ── Hard formatting rules ──
  const formatRules = isArabic
    ? `\n\n⚠️ قواعد التنسيق (إلزامية، لا استثناءات):\n- اكتب نصاً واضحاً ومباشراً\n- تجنب استخدام النجوم (*) للتنسيق\n- ممنوع منعاً باتاً استخدام شرطة إم (—) أو شرطة إن (–). لا تستخدمها أبداً. استخدم الفاصلة أو النقطة بدلاً منها.\n- ركز على إنشاء النص فقط`
    : `\n\n⚠️ Formatting rules (MANDATORY, zero exceptions):\n- Write clear and direct text\n- Do not use asterisks (*) for formatting\n- ABSOLUTELY NEVER use em-dashes (—) or en-dashes (–). Not even once. Use commas, periods, or semicolons instead.\n- Focus only on text generation`;

  // ── Structured constraints block (from dropdown selections) ──
  const constraints: string[] = [];

  // ────────────────────────────────────────────────────
  // CONTENT TYPE
  // ────────────────────────────────────────────────────
  if (contentType) {
    const ctName = contentType.replace(/_/g, ' ');
    constraints.push(isArabic ? `📄 نوع المحتوى: ${ctName}. التزم ببنية هذا النوع من المحتوى.` : `📄 Content type: ${ctName}. Follow the structure and conventions of this content type.`);
  }

  // ────────────────────────────────────────────────────
  // TONE (detailed behavioral instructions per value)
  // ────────────────────────────────────────────────────
  if (tone) {
    const toneInstructions: Record<string, { en: string; ar: string }> = {
      human: {
        en: '🎭 TONE = HUMAN (CRITICAL):\n  - Write EXACTLY like a real person typing a message. Not like an AI.\n  - Use contractions (don\'t, can\'t, I\'m, it\'s).\n  - Use filler words occasionally (well, honestly, actually, you know).\n  - Vary sentence length naturally. Some short. Some longer ones that flow.\n  - NEVER use phrases like "I hope this helps", "Please don\'t hesitate", "I\'d be happy to".\n  - NEVER mention AI, assistant, model, or capabilities.\n  - Sound like a friend writing, not a corporate bot.',
        ar: '🎭 النبرة = بشري طبيعي (حرج):\n  - اكتب بالضبط مثل شخص حقيقي يكتب رسالة. ليس مثل ذكاء اصطناعي.\n  - استخدم أسلوب محادثة يومي طبيعي.\n  - نوّع في طول الجمل. بعضها قصير. وبعضها أطول.\n  - ممنوع عبارات مثل "أتمنى أن يكون هذا مفيداً" أو "لا تتردد".\n  - ممنوع ذكر الذكاء الاصطناعي أو المساعد.\n  - اكتب وكأنك صديق يكتب رسالة، مو روبوت.'
      },
      professional: {
        en: '🎭 TONE = PROFESSIONAL: Write in a polished, business-appropriate manner. Clear structure, no slang, confident language.',
        ar: '🎭 النبرة = مهني: اكتب بأسلوب مهني مصقول ومناسب للأعمال. بنية واضحة، بدون عامية، لغة واثقة.'
      },
      casual: {
        en: '🎭 TONE = CASUAL: Write relaxed and conversational. Like texting a friend. Short sentences, simple words, laid-back vibe.',
        ar: '🎭 النبرة = غير رسمي: اكتب بأسلوب مريح ومحادثة. مثل رسالة لصديق. جمل قصيرة، كلمات بسيطة.'
      },
      formal: {
        en: '🎭 TONE = FORMAL: Write with formal, elevated language. Complete sentences, no contractions, respectful and dignified.',
        ar: '🎭 النبرة = رسمي: اكتب بلغة رسمية راقية. جمل كاملة، بدون اختصارات، أسلوب محترم ووقور.'
      },
      friendly: {
        en: '🎭 TONE = FRIENDLY: Write warm and approachable. Use positive language, be encouraging, feel like a helpful friend.',
        ar: '🎭 النبرة = ودود: اكتب بأسلوب دافئ وقريب. استخدم لغة إيجابية ومشجعة.'
      },
      persuasive: {
        en: '🎭 TONE = PERSUASIVE: Write to convince. Use strong arguments, emotional appeal, call to action. Be compelling.',
        ar: '🎭 النبرة = إقناعي: اكتب لتقنع. استخدم حجج قوية، جاذبية عاطفية، ودعوة للعمل.'
      },
      romantic: {
        en: '🎭 TONE = ROMANTIC: Write with warmth, tenderness, and emotional depth. Poetic touches welcome. Heartfelt.',
        ar: '🎭 النبرة = رومانسي: اكتب بدفء وحنان وعمق عاطفي. لمسات شعرية مرحب بها.'
      },
      neutral: {
        en: '🎭 TONE = NEUTRAL: Write balanced and objective. No strong emotion, no bias. Straightforward and factual.',
        ar: '🎭 النبرة = محايد: اكتب بتوازن وموضوعية. بدون عاطفة قوية أو تحيز. مباشر وواقعي.'
      },
      empathetic: {
        en: '🎭 TONE = EMPATHETIC: Write with understanding and compassion. Acknowledge feelings, be supportive and kind.',
        ar: '🎭 النبرة = متعاطف: اكتب بتفهم وتعاطف. اعترف بالمشاعر، كن داعماً ولطيفاً.'
      },
      confident: {
        en: '🎭 TONE = CONFIDENT: Write with authority and certainty. Strong declarative sentences. No hedging or "maybe".',
        ar: '🎭 النبرة = واثق: اكتب بسلطة ويقين. جمل تقريرية قوية. بدون تردد.'
      },
      humorous: {
        en: '🎭 TONE = HUMOROUS: Write with wit and humor. Include clever observations, light jokes, playful language. Make the reader smile.',
        ar: '🎭 النبرة = مرح: اكتب بذكاء وفكاهة. أضف ملاحظات ذكية ونكات خفيفة ولغة مرحة.'
      },
      urgent: {
        en: '🎭 TONE = URGENT: Write with immediacy and importance. Short punchy sentences. Convey that this matters NOW.',
        ar: '🎭 النبرة = عاجل: اكتب بإلحاح وأهمية. جمل قصيرة ومؤثرة. أوصل أن هذا مهم الآن.'
      },
      apologetic: {
        en: '🎭 TONE = APOLOGETIC: Write with genuine remorse and sincerity. Take responsibility, express regret clearly.',
        ar: '🎭 النبرة = اعتذاري: اكتب بندم صادق وإخلاص. تحمل المسؤولية، عبّر عن الأسف بوضوح.'
      },
      inspirational: {
        en: '🎭 TONE = INSPIRATIONAL: Write to uplift and inspire. Use powerful imagery, motivating language, hopeful outlook.',
        ar: '🎭 النبرة = ملهم: اكتب لترفع المعنويات وتلهم. استخدم صور قوية ولغة محفزة ونظرة متفائلة.'
      },
      motivational: {
        en: '🎭 TONE = MOTIVATIONAL: Write to push action. Energy, encouragement, "you can do this" attitude. Be a coach.',
        ar: '🎭 النبرة = تحفيزي: اكتب لتدفع للعمل. طاقة، تشجيع، موقف "تقدر تسويها". كن مدرباً.'
      },
      sympathetic: {
        en: '🎭 TONE = SYMPATHETIC: Write with deep understanding of difficulty. Validate the struggle, offer comfort.',
        ar: '🎭 النبرة = متعاطف: اكتب بتفهم عميق للصعوبة. صادق على المعاناة، قدم الراحة.'
      },
      sincere: {
        en: '🎭 TONE = SINCERE: Write with genuine honesty and authenticity. No fluff, no corporate speak. Mean every word.',
        ar: '🎭 النبرة = صادق: اكتب بصدق وأصالة حقيقية. بدون حشو أو كلام رسمي فارغ.'
      },
      informative: {
        en: '🎭 TONE = INFORMATIVE: Write to educate and inform. Clear explanations, logical structure, factual content.',
        ar: '🎭 النبرة = معلوماتي: اكتب لتثقف وتُعلم. شروحات واضحة، بنية منطقية، محتوى واقعي.'
      },
      concise: {
        en: '🎭 TONE = CONCISE: Write tight and efficient. Every word must earn its place. No filler, no repetition. Get to the point.',
        ar: '🎭 النبرة = موجز: اكتب بإيجاز وكفاءة. كل كلمة لها مكانها. بدون حشو أو تكرار. ادخل في الموضوع.'
      },
      dramatic: {
        en: '🎭 TONE = DRAMATIC: Write with intensity and flair. Build tension, use vivid language, create emotional impact.',
        ar: '🎭 النبرة = درامي: اكتب بحدة وأناقة. ابنِ التوتر، استخدم لغة حية، اصنع تأثيراً عاطفياً.'
      },
      suspenseful: {
        en: '🎭 TONE = SUSPENSEFUL: Write to keep the reader hooked. Build anticipation, use cliffhangers, create mystery.',
        ar: '🎭 النبرة = مشوّق: اكتب لتبقي القارئ مشدوداً. ابنِ الترقب، استخدم التشويق.'
      },
      authoritative: {
        en: '🎭 TONE = AUTHORITATIVE: Write as a subject matter expert. Confident assertions, backed by knowledge. Command respect.',
        ar: '🎭 النبرة = موثوق: اكتب كخبير في الموضوع. تأكيدات واثقة مدعومة بالمعرفة.'
      },
      educational: {
        en: '🎭 TONE = EDUCATIONAL: Write as a teacher. Break down complex ideas simply. Use examples. Guide the reader step by step.',
        ar: '🎭 النبرة = تثقيفي: اكتب كمعلم. بسّط الأفكار المعقدة. استخدم أمثلة. ارشد القارئ خطوة بخطوة.'
      },
    };
    const ti = toneInstructions[tone];
    if (ti) {
      constraints.push(isArabic ? ti.ar : ti.en);
    } else {
      constraints.push(isArabic ? `🎭 النبرة: ${tone}` : `🎭 Tone: ${tone}`);
    }
  }

  // ────────────────────────────────────────────────────
  // REGISTER (strict style enforcement per value)
  // ────────────────────────────────────────────────────
  if (register) {
    const regInstructions: Record<string, { en: string; ar: string }> = {
      formal: {
        en: '📝 REGISTER = FORMAL: Use complete sentences, proper grammar, no contractions, no slang. Write as you would in an official document.',
        ar: '📝 السجل = رسمي: استخدم جمل كاملة، قواعد صحيحة، بدون اختصارات أو عامية. اكتب كما في وثيقة رسمية.'
      },
      neutral: {
        en: '📝 REGISTER = NEUTRAL: Standard language, neither too formal nor too casual. Clear and accessible.',
        ar: '📝 السجل = محايد: لغة معيارية، ليست رسمية جداً ولا غير رسمية. واضحة ومفهومة.'
      },
      casual: {
        en: '📝 REGISTER = CASUAL: Relaxed language. Contractions OK. Short sentences. Like talking to a friend.',
        ar: '📝 السجل = غير رسمي: لغة مريحة. جمل قصيرة. مثل الكلام مع صديق.'
      },
      slang: {
        en: '📝 REGISTER = SLANG: Use informal slang and colloquial expressions. Street-level language. Keep it real.',
        ar: '📝 السجل = عامي: استخدم عامية ولهجة محلية. لغة الشارع. خلها طبيعية وعفوية.'
      },
      poetic: {
        en: '📝 REGISTER = POETIC: Use lyrical, literary language. Metaphors, imagery, rhythm in sentences. Beautiful prose.',
        ar: '📝 السجل = شعري/أدبي: استخدم لغة أدبية وشعرية. استعارات، تصوير، إيقاع في الجمل. نثر جميل.'
      },
      gen_z: {
        en: '📝 REGISTER = GEN Z: Use Gen Z internet language. Words like "slay", "no cap", "lowkey", "vibe", "bestie", "literally". Keep it trendy and youthful.',
        ar: '📝 السجل = جيل زد: استخدم لغة جيل زد والإنترنت. كلمات عصرية وشبابية. خلها ترندي.'
      },
      business_formal: {
        en: '📝 REGISTER = BUSINESS FORMAL: Corporate professional language. Structured paragraphs, action items, clear deliverables. Suitable for board rooms.',
        ar: '📝 السجل = رسمي للأعمال: لغة مهنية للشركات. فقرات منظمة، نقاط عمل واضحة. مناسب لاجتماعات الإدارة.'
      },
      executive_brief: {
        en: '📝 REGISTER = EXECUTIVE BRIEF: Ultra-concise, high-level summary style. Bullet points OK. No fluff. Decision-maker language.',
        ar: '📝 السجل = موجز تنفيذي: موجز جداً، أسلوب ملخص عالي المستوى. نقاط مختصرة. بدون حشو. لغة صانع قرار.'
      },
    };
    const ri = regInstructions[register];
    if (ri) {
      constraints.push(isArabic ? ri.ar : ri.en);
    }
  }

  // ────────────────────────────────────────────────────
  // LANGUAGE VARIANT (strong enforcement with examples)
  // ────────────────────────────────────────────────────
  if (languageVariant) {
    const v = languageVariant.toLowerCase();
    if (!isArabic) {
      if (v.includes('us')) {
        constraints.push('🌍 LANGUAGE VARIANT = US ENGLISH (STRICT):\n  - Use American spelling ONLY: color (NOT colour), center (NOT centre), organize (NOT organise), defense (NOT defence), check (NOT cheque), traveled (NOT travelled).\n  - Use American vocabulary: apartment (NOT flat), elevator (NOT lift), truck (NOT lorry), gas (NOT petrol).\n  - Use imperial units by default (miles, pounds, Fahrenheit) unless context requires metric.');
      } else if (v.includes('uk')) {
        constraints.push('🌍 LANGUAGE VARIANT = UK ENGLISH (STRICT):\n  - Use British spelling ONLY: colour (NOT color), centre (NOT center), organise (NOT organize), defence (NOT defense), cheque (NOT check), travelled (NOT traveled).\n  - Use British vocabulary: flat (NOT apartment), lift (NOT elevator), lorry (NOT truck), petrol (NOT gas).\n  - Use metric units by default (kilometres, kilograms, Celsius).');
      } else if (v.includes('canadian')) {
        constraints.push('🌍 LANGUAGE VARIANT = CANADIAN ENGLISH (STRICT):\n  - Use Canadian spelling: colour (NOT color), centre (NOT center), but organize (NOT organise), defense (NOT defence).\n  - Mix of British spelling with some American conventions.\n  - Use metric units (kilometres, Celsius, litres).\n  - Use Canadian vocabulary where applicable: toque, loonie, double-double.');
      } else if (v.includes('australian')) {
        constraints.push('🌍 LANGUAGE VARIANT = AUSTRALIAN ENGLISH (STRICT):\n  - Use Australian/British spelling: colour, centre, organise, defence, travelled.\n  - Use Australian vocabulary where natural: arvo (afternoon), brekkie (breakfast), mate, reckon.\n  - Use metric units (kilometres, Celsius, litres).');
      }
    } else {
      if (v.includes('msa')) {
        constraints.push('🌍 المتغير اللغوي = العربية الفصحى MSA (صارم):\n  - اكتب بالعربية الفصحى الحديثة فقط. لا تستخدم أي لهجة محلية.\n  - استخدم قواعد النحو والصرف الصحيحة (إعراب، تنوين عند الحاجة).\n  - تجنب أي كلمات عامية مثل: مو، هالشي، شلون، وش، ليش.\n  - استخدم بدلاً منها: ليس، هذا الأمر، كيف، ماذا، لماذا.\n  - الأسلوب يجب أن يكون كأنك تكتب في صحيفة رسمية أو كتاب أكاديمي.');
      } else if (v.includes('gulf')) {
        constraints.push('🌍 المتغير اللغوي = العربية الخليجية (صارم):\n  - اكتب بلهجة خليجية أصيلة 100%. ليس عربي فصيح مع كلمات خليجية، بل خليجي كامل.\n  - استخدم هذه الكلمات والتعبيرات الخليجية بشكل طبيعي:\n    • "مب" أو "مو" بدل "ليس"\n    • "وش" أو "شنو" بدل "ماذا"\n    • "ليش" بدل "لماذا"\n    • "شلون" أو "شلونك" بدل "كيف حالك"\n    • "ترى" للتأكيد\n    • "يا غالي" أو "يا الغالي" للمخاطبة\n    • "عيل" بدل "إذن"\n    • "هالشي" بدل "هذا الشيء"\n    • "أبي" أو "أبغى" بدل "أريد"\n    • "إنت/إنتي" بدل "أنت/أنتِ"\n    • "حيل" أو "مرة" بدل "جداً"\n    • "يالله" للتشجيع\n    • "ما عليه" بدل "لا بأس"\n    • "إي" بدل "نعم"\n  - تجنب تماماً الكلمات الفصحى الثقيلة مثل: أدرك، أتمنى، صديقيتنا، التزامي.\n  - استخدم بدلها: أعرف، أتمنى/أبي، صداقتنا/ربعنا، كلمتي.\n  - اكتب وكأنك شخص خليجي يكتب رسالة واتساب لصديقه.');
      }
    }
  }

  // ────────────────────────────────────────────────────
  // EMOJIS (strict count enforcement)
  // ────────────────────────────────────────────────────
  if (emojis) {
    const emojiInstructions: Record<string, { en: string; ar: string }> = {
      none: {
        en: '😶 EMOJIS = NONE (STRICT): Do NOT include any emojis, emoticons, or unicode symbols in the output. Zero. Not even one.',
        ar: '😶 الإيموجي = بدون (صارم): لا تضع أي إيموجي أو رموز تعبيرية في النص. صفر. ولا واحد.'
      },
      light: {
        en: '🙂 EMOJIS = LIGHT: Use exactly 1 to 2 emojis in the ENTIRE text. Place them naturally, not at the start of every sentence.',
        ar: '🙂 الإيموجي = قليل: استخدم 1 إلى 2 إيموجي فقط في كل النص. ضعها بشكل طبيعي.'
      },
      rich: {
        en: '😊 EMOJIS = RICH: Use emojis moderately throughout the text (roughly 1 emoji per paragraph or key point). Make them relevant to the content.',
        ar: '😊 الإيموجي = معتدل: استخدم إيموجي بشكل معتدل في النص (تقريباً 1 إيموجي لكل فقرة أو نقطة رئيسية).'
      },
      extra: {
        en: '🎉 EMOJIS = EXTRA: Use emojis heavily and expressively! Multiple emojis per paragraph. Make the text feel vibrant and expressive. 🔥✨💪',
        ar: '🎉 الإيموجي = كثيف: استخدم إيموجي بكثافة وتعبير! عدة إيموجي في كل فقرة. اجعل النص حيوياً ومعبراً. 🔥✨💪'
      },
    };
    const ei = emojiInstructions[emojis];
    if (ei) {
      constraints.push(isArabic ? ei.ar : ei.en);
    }
  }

  const constraintsBlock = constraints.length > 0
    ? (isArabic
      ? `\n\n🔒 إعدادات المستخدم (اتبعها بدقة متناهية، لا تتجاهل أي إعداد):\n${constraints.map(c => `${c}`).join('\n\n')}`
      : `\n\n🔒 User settings (follow with absolute precision, do NOT ignore any setting):\n${constraints.map(c => `${c}`).join('\n\n')}`)
    : '';

  return basePrompt + formatRules + constraintsBlock;
}
