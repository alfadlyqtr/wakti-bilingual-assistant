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
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

// Claude Haiku - cheapest cost-effective Claude model for text generation
const CLAUDE_MODEL = 'claude-3-5-haiku-latest';

const WEB_SEARCH_ALLOWED_CONTENT_TYPES = new Set([
  'research_brief',
  'research_report',
  'report',
  'case_study',
  'policy_note',
  'how_to_guide',
  'press_release',
  'product_description',
  'essay',
]);

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
  captions: { baseTokens: 768, model: 'gpt-4.1-mini', temperature: 0.8 },
  essay: { baseTokens: 3072, model: 'gpt-4.1-mini', temperature: 0.7 },
  proposal: { baseTokens: 2560, model: 'gpt-4.1-mini', temperature: 0.6 },
  official_letter: { baseTokens: 1024, model: 'gpt-4.1-mini', temperature: 0.5 },
  poem: { baseTokens: 1024, model: 'gpt-4.1-mini', temperature: 0.9 },
  
  // Default fallback
  default: { baseTokens: 1024, model: 'gpt-4.1-mini', temperature: 0.7 }
};

async function fetchUrlSearchText(url: string): Promise<string | null> {
  const TAVILY_KEY = Deno.env.get("TAVILY_API_KEY");
  if (!TAVILY_KEY) return null;
  try {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query: url,
        search_depth: "basic",
        max_results: 5,
        include_raw_content: true,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    const combined = results.map((item: Record<string, unknown>) => {
      const titleVal = typeof item?.title === 'string' ? item.title : '';
      const urlVal = typeof item?.url === 'string' ? item.url : '';
      const contentVal = typeof item?.content === 'string'
        ? item.content
        : (typeof item?.raw_content === 'string' ? item.raw_content : '');
      const title = titleVal ? `Title: ${titleVal}` : '';
      const link = urlVal ? `URL: ${urlVal}` : '';
      const content = contentVal || '';
      return [title, link, content].filter(Boolean).join('\n');
    }).join('\n\n---\n\n');
    const cleaned = stripHtml(combined);
    return cleaned ? cleaned.slice(0, 12000) : null;
  } catch {
    return null;
  }
}

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

    const { prompt, mode, language, languageVariant, messageAnalysis, modelPreference: _modelPreference, temperature: _temperature, contentType, length, replyLength, wordCount, replyWordCount, tone, register, emojis, captionPlatform, image, extractTarget, webSearch, webSearchUrl, fetchUrlOnly } = requestBody;

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
      captionPlatform: captionPlatform ?? null,
      wordCount: wordCount ?? null,
      replyWordCount: replyWordCount ?? null,
      hasImage: !!image,
      extractTarget,
      webSearch: !!webSearch,
      webSearchUrl: webSearchUrl || null,
      fetchUrlOnly: !!fetchUrlOnly
    });

    // ============================================
    // MODE: fetch_url - Fetch URL content
    // ============================================
    if (mode === 'fetch_url') {
      const url = typeof requestBody?.url === 'string' ? requestBody.url.trim() : '';
      if (!url) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing URL' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      try {
        const urlText = await fetchUrlText(url);
        if (!urlText) {
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to fetch URL content' }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const cleanedText = stripHtml(urlText);
        let contentText = cleanedText;
        if (!contentText || contentText.length < 200) {
          const fallbackText = await fetchUrlSearchText(url);
          if (fallbackText && fallbackText.length > contentText.length) {
            contentText = fallbackText;
          }
        }
        if (!contentText || contentText.length < 80) {
          return new Response(
            JSON.stringify({ success: false, error: 'Unable to read readable content from URL' }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const summaryPrompt = language === 'ar'
          ? `اقرأ المحتوى التالي من الرابط وارجع ملخصاً واضحاً ومختصراً بدون أي HTML أو أكواد. اذكر أهم النقاط فقط بنص عادي:\n\n${contentText}`
          : `Read the following URL content and return a clear, concise summary with no HTML or code. Provide the key points in plain text only:\n\n${contentText}`;

        let summaryText = contentText.slice(0, 4000);

        if (ANTHROPIC_API_KEY) {
          const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: CLAUDE_MODEL,
              system: language === 'ar'
                ? 'أنت مساعد يلخص محتوى الروابط بوضوح وبأسلوب موجز، بدون أي HTML أو أكواد.'
                : 'You summarize URL content clearly and concisely in plain text with no HTML or code.',
              messages: [{ role: "user", content: summaryPrompt }],
              temperature: 0.3,
              max_tokens: 700,
            }),
          });

          if (claudeResponse.ok) {
            const claudeResult = await claudeResponse.json();
            summaryText = claudeResult.content?.[0]?.text?.trim() || summaryText;
          }
        } else if (OPENAI_API_KEY) {
          const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-4.1-mini',
              messages: [
                { role: 'system', content: language === 'ar'
                  ? 'أنت مساعد يلخص محتوى الروابط بوضوح وبأسلوب موجز، بدون أي HTML أو أكواد.'
                  : 'You summarize URL content clearly and concisely in plain text with no HTML or code.' },
                { role: 'user', content: summaryPrompt }
              ],
              temperature: 0.3,
              max_tokens: 700,
            })
          });

          if (openaiResponse.ok) {
            const openaiResult = await openaiResponse.json();
            summaryText = openaiResult.choices?.[0]?.message?.content?.trim() || summaryText;
          }
        }
        const finalSummary = stripHtml(summaryText);

        return new Response(
          JSON.stringify({ success: true, extractedText: finalSummary }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        const err = e as Error;
        return new Response(
          JSON.stringify({ success: false, error: `Failed to fetch URL: ${err?.message || 'Unknown error'}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

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
          const isPdf = image.startsWith("data:application/pdf") || image.includes("JVBERi");
        if (!image.startsWith('http') && !image.startsWith('data:')) {
          imageUrl = `data:image/jpeg;base64,${image}`;
        }

        if (isPdf) {
            console.log("?? Text Generator: PDF detected, routing to Gemini");
            if (!GEMINI_API_KEY) {
              return new Response(
                JSON.stringify({ success: false, error: "Gemini API key required for PDF extraction" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            
            // Extract base64 part
            const base64Data = image.split(",")[1] || image;
            
            try {
              const geminiResponse = await generateGemini(
                "gemini-2.5-flash",
                [
                  {
                    role: "user",
                    parts: [
                      { text: "Extract the meaningful content from this document and format it nicely into structured Markdown. CRITICAL INSTRUCTIONS: 1. Ignore and exclude all UI boilerplate, system text, phone status bars (time, battery, signal), navigation menus, and repetitive icons. 2. Focus ONLY on the actual content, presentation slides, paragraphs, and core messages. 3. Clean up any weird line breaks or formatting artifacts. 4. Organize the text with appropriate Markdown headers (##), bullet points, and paragraphs to make it highly readable. 5. Return ONLY a valid JSON object using this exact structure: {\"isScreenshot\":false,\"sourceType\":\"document\",\"deviceType\":\"unknown\",\"isForm\":false,\"formType\":\"other\",\"fields\":{},\"rawText\":\"your beautifully formatted markdown text goes here\"} Do NOT wrap the JSON in markdown code blocks. Just return the raw JSON." },
                        { inlineData: { mimeType: "application/pdf", data: base64Data } }
                    ]
                  }
                ],
                undefined,
                { response_mime_type: "application/json" }
              );
              
              const textContent = geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (!textContent) throw new Error("No text returned from Gemini");
              
              let extractedData = {};
              try {
                extractedData = JSON.parse(textContent);
              } catch (e) {
                extractedData = { rawText: textContent };
              }
              
              return new Response(
                JSON.stringify({ 
                  success: true, 
                  extractedText: extractedData.rawText || textContent,
                  extractedForm: extractedData 
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            } catch (err) {
              console.error("?? Text Generator: Gemini PDF extraction failed:", err);
              return new Response(
                JSON.stringify({ success: false, error: "Failed to extract text from PDF: " + (err.message || "") }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
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
            JSON.stringify({ success: false, error: "Failed to extract text from image: " + errText }),
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

<<<<<<< Updated upstream
    // ── Handle Summarize Content Type ──
    let finalPrompt = prompt;
    if (contentType === 'summarize') {
      console.log("🎯 Text Generator: Summarize mode detected - wrapping prompt with summarization instructions");
      finalPrompt = language === 'ar'
        ? `اقرأ النص التالي بعناية وأعد ملخصاً واضحاً وموجزاً يحتفظ بأهم النقاط والمعلومات الأساسية. الملخص يجب أن يكون قصيراً وسهل الفهم وخالياً من التفاصيل غير الضرورية.\n\nالنص المراد تلخيصه:\n${prompt}`
        : `Read the following text carefully and provide a clear, concise summary that captures the key points and essential information. The summary should be brief, easy to understand, and free of unnecessary details.\n\nText to summarize:\n${prompt}`;
    }
=======
    const systemPrompt = getSystemPrompt(language);
    const temp = typeof temperature === 'number' ? Math.max(0, Math.min(1, temperature)) : 0.7;
    const preferredOpenAIModel = modelPreference === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini';
    const temperatureUsed = temp;
    
    let generatedText = "";
    let modelUsed = "";
>>>>>>> Stashed changes

    const webSearchAllowed = !!contentType && WEB_SEARCH_ALLOWED_CONTENT_TYPES.has(contentType);
    const webSearchEnabled = !!webSearch && webSearchAllowed;
    const normalizedWebSearchUrl = typeof webSearchUrl === 'string' && webSearchUrl.trim() ? webSearchUrl.trim() : undefined;
    const urlFetchEnabled = !!fetchUrlOnly && !!normalizedWebSearchUrl;
    const systemPrompt = buildSystemPrompt(language, { tone, register, languageVariant, emojis, contentType, wordCount: wordCount ?? replyWordCount, captionPlatform });
    const genParams = getGenerationParams(contentType, tone, length || replyLength || 'medium', register);
    const requestedWordCountRaw = Number(wordCount ?? replyWordCount);
    const requestedWordCount = Number.isFinite(requestedWordCountRaw) && requestedWordCountRaw > 0
      ? Math.min(3000, Math.round(requestedWordCountRaw))
      : undefined;
    if (requestedWordCount) {
      const estimatedTokens = Math.min(4096, Math.max(256, Math.round(requestedWordCount * 1.6)));
      genParams.max_tokens = estimatedTokens;
    }
    const applyWordCount = (text: string) => (
      requestedWordCount ? enforceWordCount(text, requestedWordCount) : text
    );
    console.log("🎯 Generation parameters:", genParams);

    const logMetadataBase = {
      mode,
      language,
      webSearch: webSearchEnabled,
      webSearchUrl: normalizedWebSearchUrl ?? null,
      fetchUrlOnly: fetchUrlOnly ?? null,
      contentType: contentType ?? null,
      tone: tone ?? null,
      register: register ?? null,
      languageVariant: languageVariant ?? null,
      emojis: emojis ?? null,
      captionPlatform: captionPlatform ?? null,
      length: length ?? null,
      replyLength: replyLength ?? null,
      wordCount: wordCount ?? null,
      replyWordCount: replyWordCount ?? null,
      temperatureUsed: genParams.temperature,
      maxTokensUsed: genParams.max_tokens,
    };

    let generatedText: string | undefined;

    // ── URL Fetch Only (no search) ──
    if (urlFetchEnabled) {
      try {
        console.log("🎯 Text Generator: URL fetch enabled");
        const startUrlFetch = Date.now();
        const urlText = await fetchUrlText(normalizedWebSearchUrl);
        const urlFetchDuration = Date.now() - startUrlFetch;

        if (urlText) {
          const claudePrompt = language === 'ar'
            ? `أنت كاتب محترف. استخدم محتوى الرابط أدناه لكتابة نص دقيق ومرتبط. التزم بإعدادات المستخدم بدقة.

محتوى الرابط:
${urlText}

طلب المستخدم:
${finalPrompt}`
            : `You are a professional writer. Use the URL content below to write accurate, relevant text. Follow user settings strictly.

URL content:
${urlText}

User request:
${finalPrompt}`;

          const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": ANTHROPIC_API_KEY || "",
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: CLAUDE_MODEL,
              system: systemPrompt,
              messages: [{ role: "user", content: claudePrompt }],
              temperature: genParams.temperature,
              max_tokens: genParams.max_tokens,
            }),
          });

          if (claudeResponse.ok) {
            const claudeResult = await claudeResponse.json();
            const content = claudeResult.content?.[0]?.text || "";
            if (content) {
              generatedText = applyWordCount(sanitizeEmDashes(content));

              await logAIFromRequest(req, {
                functionName: "text-generator",
                provider: "anthropic",
                model: CLAUDE_MODEL,
                inputText: prompt,
                outputText: generatedText,
                durationMs: urlFetchDuration,
                status: "success",
                metadata: {
                  ...logMetadataBase,
                  webSearchUsed: true,
                  webSearchProvider: "url_fetch",
                }
              });

              return new Response(
                JSON.stringify({
                  success: true,
                  generatedText,
                  mode,
                  language,
                  modelUsed: `${CLAUDE_MODEL} (url)` ,
                  temperatureUsed: genParams.temperature,
                  contentType: contentType || null,
                  webSearchUsed: true,
                  webSearchSources: [{ title: normalizedWebSearchUrl, url: normalizedWebSearchUrl }]
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } else {
            const errTxt = await claudeResponse.text();
            console.warn("🎯 Text Generator: URL fetch Claude error:", errTxt);
          }
        } else {
          console.warn("🎯 Text Generator: URL fetch returned empty content");
        }
      } catch (e) {
        console.warn("🎯 Text Generator: URL fetch failed, falling back:", e);
      }
    }

    // ── Web Search: Tavily + Claude ──
    if (webSearchEnabled && TAVILY_API_KEY && !generatedText) {
      try {
        console.log("🎯 Text Generator: Web Search enabled - using Tavily + Claude");
        const startWebSearch = Date.now();

        const tavilyPayload: Record<string, unknown> = {
          api_key: TAVILY_API_KEY,
          query: finalPrompt,
          search_depth: "basic",
          max_results: 6,
          include_raw_content: true,
          include_answer: false,
        };

        if (normalizedWebSearchUrl) {
          try {
            const parsedUrl = new URL(normalizedWebSearchUrl);
            tavilyPayload.include_domains = [parsedUrl.hostname];
          } catch (urlErr) {
            console.warn("🎯 Text Generator: Invalid webSearchUrl, ignoring:", urlErr);
          }
        }

        const tavilyResponse = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tavilyPayload),
        });

        const webSearchDuration = Date.now() - startWebSearch;
        console.log(`🎯 Text Generator: Tavily search completed in ${webSearchDuration}ms, status ${tavilyResponse.status}`);

        if (tavilyResponse.ok) {
          const tavilyResult = await tavilyResponse.json();
          const results: Array<{ title?: string; url?: string; content?: string }> = Array.isArray(tavilyResult?.results)
            ? tavilyResult.results
            : [];

          const sources = results
            .filter((r) => r?.url && r?.title)
            .map((r) => ({ title: r.title as string, url: r.url as string }));

          const contextChunks = results
            .map((r, idx) => {
              const title = r?.title ? `Title: ${r.title}` : `Result ${idx + 1}`;
              const url = r?.url ? `URL: ${r.url}` : '';
              const content = r?.content || '';
              return [title, url, content].filter(Boolean).join("\n");
            })
            .filter(Boolean)
            .join("\n\n---\n\n");

          if (contextChunks) {
            const claudePrompt = language === 'ar'
              ? `أنت كاتب محترف. استخدم نتائج البحث أدناه لكتابة محتوى دقيق وغني بالمعلومات. التزم بإعدادات المستخدم بدقة.

نتائج البحث:
${contextChunks}

طلب المستخدم:
${finalPrompt}`
              : `You are a professional writer. Use the search results below to write accurate, information-rich content. Follow user settings strictly.

Search results:
${contextChunks}

User request:
${finalPrompt}`;

            const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY || "",
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: CLAUDE_MODEL,
                system: systemPrompt,
                messages: [{ role: "user", content: claudePrompt }],
                temperature: genParams.temperature,
                max_tokens: genParams.max_tokens,
              }),
            });

            if (claudeResponse.ok) {
              const claudeResult = await claudeResponse.json();
              const content = claudeResult.content?.[0]?.text || "";
              if (content) {
                generatedText = applyWordCount(sanitizeEmDashes(content));

                await logAIFromRequest(req, {
                  functionName: "text-generator",
                  provider: "anthropic",
                  model: CLAUDE_MODEL,
                  inputText: prompt,
                  outputText: generatedText,
                  durationMs: webSearchDuration,
                  status: "success",
                  metadata: {
                    ...logMetadataBase,
                    webSearchUsed: true,
                    webSearchProvider: "tavily",
                  }
                });

                return new Response(
                  JSON.stringify({
                    success: true,
                    generatedText,
                    mode,
                    language,
                    modelUsed: `${CLAUDE_MODEL} (tavily)` ,
                    temperatureUsed: genParams.temperature,
                    contentType: contentType || null,
                    webSearchUsed: true,
                    webSearchSources: sources
                  }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            } else {
              const errTxt = await claudeResponse.text();
              console.warn("🎯 Text Generator: Claude web search synthesis error:", errTxt);
            }
          } else {
            console.warn("🎯 Text Generator: Tavily returned empty results");
          }
        } else {
          const errTxt = await tavilyResponse.text();
          console.warn("🎯 Text Generator: Tavily API error, falling back:", errTxt);
        }
      } catch (e) {
        console.warn("🎯 Text Generator: Tavily web search threw error, falling back:", e);
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
              { role: "user", content: finalPrompt }
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
            generatedText = applyWordCount(sanitizeEmDashes(content));
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
              { role: "user", content: finalPrompt }
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
            generatedText = applyWordCount(sanitizeEmDashes(content));

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
          [{ role: 'user', parts: [{ text: finalPrompt }] }],
          systemPrompt,
          { temperature: genParams.temperature, maxOutputTokens: genParams.max_tokens },
          []
        );
        const geminiDuration = Date.now() - startGemini;
        const content = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (content) {
          generatedText = applyWordCount(sanitizeEmDashes(content));

          await logAIFromRequest(req, {
            functionName: "text-generator",
            provider: "gemini",
            model: "gemini-2.5-flash",
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
              { role: "user", content: finalPrompt }
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
            generatedText = applyWordCount(sanitizeEmDashes(content));
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

function enforceWordCount(text: string, target: number): string {
  const safeTarget = Math.max(1, Math.min(3000, Math.round(target)));
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= safeTarget) return text.trim();
  return words.slice(0, safeTarget).join(' ').trim();
}

async function fetchUrlText(url: string): Promise<string | null> {
  const TAVILY_KEY = Deno.env.get("TAVILY_API_KEY");
  // Prefer Tavily extract API for clean content
  if (TAVILY_KEY) {
    try {
      const resp = await fetch("https://api.tavily.com/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: TAVILY_KEY, urls: [url] }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const result = data?.results?.[0];
        const cleanText = result?.text || '';
        const rawText = result?.raw_content || '';
        if (cleanText.trim()) return cleanText.slice(0, 15000);
        if (rawText.trim()) return stripHtml(rawText).slice(0, 15000);
      }
    } catch (e) {
      console.warn("Tavily extract failed, falling back to raw fetch:", e);
    }
  }
  // Fallback: raw fetch
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'WaktiTextGenerator/1.0' }
    });
    if (!response.ok) return null;
    const text = await response.text();
    return text ? stripHtml(text).slice(0, 12000) : null;
  } catch {
    return null;
  }
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
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
  wordCount?: number | string | null;
  captionPlatform?: string | null;
}

function buildSystemPrompt(language: string, fields: StructuredFields): string {
  const isArabic = language === 'ar';
  const { tone, register, languageVariant, emojis, contentType, wordCount, captionPlatform } = fields;

  // ── Base identity ──
  const basePrompt = isArabic
    ? 'أنت كاتب محترف متخصص في إنشاء النصوص. مهمتك هي إنشاء محتوى بناءً على طلب المستخدم مع الالتزام الصارم بكل الإعدادات أدناه.'
    : "You are a professional writer. Your job is to generate text content following the user's request while strictly obeying EVERY setting below.";

  // ── Hard formatting rules ──
  const formatRules = isArabic
    ? `\n\n⚠️ قواعد التنسيق (إلزامية، لا استثناءات):\n- اكتب نصاً واضحاً ومباشراً\n- تجنب استخدام النجوم (*) للتنسيق\n- ممنوع منعاً باتاً استخدام شرطة إم (—) أو شرطة إن (–). لا تستخدمها أبداً. استخدم الفاصلة أو النقطة بدلاً منها.\n- ركز على إنشاء النص فقط\n- ممنوع البدء بعبارات تمهيدية مثل "إليك الرد:" أو "هذا رد مسودة:" أو أي مقدمة مشابهة. ابدأ مباشرة بالمحتوى المطلوب.\n- ممنوع إضافة ملاحظات أو تعليقات أو شرح عما تم تغييره. اكتب النص المطلوب فقط، لا شيء آخر.`
    : `\n\n⚠️ Formatting rules (MANDATORY, zero exceptions):\n- Write clear and direct text\n- Do not use asterisks (*) for formatting\n- ABSOLUTELY NEVER use em-dashes (—) or en-dashes (–). Not even once. Use commas, periods, or semicolons instead.\n- Focus only on text generation\n- NEVER start with intro lines like "Here's a draft reply:", "Here's a cleaned-up response:", "Here's a professional version:", or any similar preamble. Jump straight into the actual content.\n- NEVER add notes, explanations, or commentary about what you changed or improved. Output ONLY the requested text, nothing else.`;

  // ── Structured constraints block (from dropdown selections) ──
  const constraints: string[] = [];

  // ────────────────────────────────────────────────────
  // CONTENT TYPE
  // ────────────────────────────────────────────────────
  if (contentType) {
    const ctName = contentType.replace(/_/g, ' ');
    constraints.push(isArabic ? `📄 نوع المحتوى: ${ctName}. التزم ببنية هذا النوع من المحتوى.` : `📄 Content type: ${ctName}. Follow the structure and conventions of this content type.`);
  }

  if (contentType === 'captions') {
    const platformLabel = captionPlatform && captionPlatform !== 'auto' ? captionPlatform.replace(/_/g, ' ') : (isArabic ? 'غير محدد' : 'unspecified');
    constraints.push(isArabic
      ? `📸 محتوى كابتشن: اكتب كابتشن قصير وجذاب مناسب لمنصة ${platformLabel}. اجعله موجزاً، لافتاً، وسهل القراءة. يمكن إضافة هاشتاقات مناسبة فقط إذا لزم.`
      : `📸 Captions: Write short, catchy captions tailored for ${platformLabel}. Keep it concise, attention-grabbing, and easy to read. Add hashtags only if needed.`
    );
  }

  // ────────────────────────────────────────────────────
  // WORD COUNT (strict)
  // ────────────────────────────────────────────────────
  const normalizedWordCount = Number(wordCount);
  if (Number.isFinite(normalizedWordCount) && normalizedWordCount > 0) {
    const cappedWordCount = Math.min(3000, Math.round(normalizedWordCount));
    constraints.push(isArabic
      ? `🧮 عدد الكلمات: يجب أن يكون الناتج قريبًا قدر الإمكان من ${cappedWordCount} كلمة. لا تتجاوز ${cappedWordCount} كلمة. حاول الالتزام بهذا العدد بدقة.`
      : `🧮 Word count: Output should be as close as possible to ${cappedWordCount} words. Do not exceed ${cappedWordCount} words. Aim to hit this count precisely.`
    );
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
      sales: {
        en: '🎭 TONE = SALES: Write to persuade and convert. Highlight benefits, create urgency, build desire. Use power words, social proof, and clear calls to action. Focus on value and outcomes.',
        ar: '🎭 النبرة = مبيعات: اكتب لإقناع وتحويل. ركز على الفوائد، أنشئ إلحاح، بناء الرغبة. استخدم كلمات قوية وإثبات اجتماعي ودعوات واضحة للعمل. ركز على القيمة والنتائج.'
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
        constraints.push(`🌍 LANGUAGE VARIANT = GCC GULF ARABIC (ABSOLUTE STRICT - ZERO TOLERANCE):

⚠️ THIS IS THE MOST IMPORTANT RULE. EVERY SINGLE WORD MUST BE GCC GULF ARABIC.
Write ONLY in authentic GCC Gulf Arabic dialect (Qatar, Saudi Arabia, UAE, Kuwait, Bahrain, Oman).
This is NOT "Arabic with some Gulf words". This is FULL Gulf dialect from the first word to the last.

✅ MANDATORY GCC VOCABULARY (use these, not their MSA equivalents):
  • "مب" or "مو" instead of "ليس" or "لا"
  • "وش" or "شنو" instead of "ماذا"
  • "ليش" instead of "لماذا"
  • "شلون" or "شلونك" instead of "كيف" or "كيف حالك"
  • "ترى" for emphasis (e.g. "ترى أنا ما قصدت")
  • "يا الغالي" or "يا غالي" for addressing someone
  • "عيل" instead of "إذن"
  • "هالـ" instead of "هذا/هذه" (e.g. "هالشي" not "هذا الشيء")
  • "أبي" or "أبغى" instead of "أريد" or "أود"
  • "إنت/إنتي" instead of "أنت/أنتِ"
  • "حيل" or "مرة" or "واجد" instead of "جداً" or "كثيراً"
  • "يالله" for encouragement
  • "ما عليه" instead of "لا بأس"
  • "إي" or "إيه" instead of "نعم"
  • "تمام" or "أوكي" for agreement
  • "يعطيك العافية" for thanking
  • "خلاص" instead of "انتهى" or "كفى"
  • "زين" or "طيب" instead of "حسناً" or "جيد"
  • "كذا" instead of "هكذا"
  • "عشان" or "علشان" instead of "لأن" or "من أجل"
  • "بعد" for "also/too" (e.g. "أنا بعد")
  • "يمكن" or "بلكي" instead of "ربما" or "لعل"
  • "شفت" instead of "رأيت"
  • "سويت" instead of "فعلت" or "عملت"
  • "ودي" instead of "أتمنى"
  • "توه/توها" instead of "للتو" or "حالاً"

❌ ABSOLUTELY FORBIDDEN WORDS (these are NOT GCC - never use them):
  • "هسه" or "هسة" (Iraqi)
  • "شو" (Levantine - use "وش" or "شنو" instead)
  • "كتير" or "كثير" in Levantine sense (use "واجد" or "حيل" or "مرة")
  • "هلأ" or "هلق" (Levantine)
  • "منيح" (Levantine - use "زين" or "تمام")
  • "بدي" (Levantine - use "أبي" or "أبغى")
  • "عم" as progressive marker (Levantine)
  • "إزاي" or "ازاي" (Egyptian - use "شلون")
  • "فين" (Egyptian - use "وين")
  • "كده" or "كدا" (Egyptian - use "كذا")
  • "أوي" (Egyptian - use "حيل" or "مرة")
  • Any heavy MSA words like: أدرك، صديقيتنا، التزامي، أفضي، حينئذ، إذ، لكنّ

❌ FORBIDDEN MSA PATTERNS (do NOT use formal Arabic structures):
  • Do NOT use إعراب or تنوين
  • Do NOT use "لقد" or "قد" (use direct past tense)
  • Do NOT use "إنّ" or "أنّ" formally
  • Do NOT use "الذي/التي/اللذان" (use "اللي" instead)
  • Do NOT use "يتوجب" or "ينبغي" (use "لازم" instead)
  • Do NOT use "أرغب" or "أودّ" (use "أبي" or "أبغى")

🎯 STYLE RULE: Even if the tone is "formal" or "professional", you MUST still write in Gulf dialect.
  - Formal Gulf = polished Gulf, NOT MSA. Example: "يعطيك العافية، حبيت أوضح لك إن..." NOT "أودّ أن أوضح لكم أنّ..."
  - Professional Gulf = respectful Gulf. Example: "لو سمحت، نبي نتأكد من هالنقطة" NOT "نرجو التأكد من هذه النقطة"

🎯 IDENTITY: Write as if you are a native GCC person (Qatari/Saudi/Emirati/Kuwaiti) writing naturally.
  - Casual = WhatsApp message to a friend
  - Formal = professional email but still in Gulf dialect, not MSA`);
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
