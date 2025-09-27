import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { VisionSystem } from './vision.ts';

const presets = {
  version: 1,
  defaults: {
    tone: 'neutral',
    style: 'short answers',
    language: 'en'
  },
  tones: {
    funny: {
      temperature: 0.8,
      description: 'Light, playful tone. Occasional tasteful humor. No sarcasm unless asked.'
    },
    serious: {
      temperature: 0.25,
      description: 'Professional, direct, and no fluff. No jokes or emojis.'
    },
    casual: {
      temperature: 0.5,
      description: 'Relaxed, conversational tone. Friendly but not overfamiliar.'
    },
    encouraging: {
      temperature: 0.6,
      description: 'Supportive and positive. Motivate the user without exaggeration.'
    },
    neutral: {
      temperature: 0.4,
      description: 'Balanced, objective, and clear. No strong emotion or humor.'
    }
  },
  styles: {
    'short answers': {
      max_tokens: 768,
      structure: 'Answer in 2–4 concise sentences maximum. End with a crisp takeaway.'
    },
    'bullet points': {
      max_tokens: 1024,
      structure: 'Use clear bullet points. 3–7 bullets. Each bullet is one compact line.'
    },
    'step-by-step': {
      max_tokens: 1536,
      structure: 'Numbered steps. Each step is a short sentence. Include tips if essential.'
    },
    detailed: {
      max_tokens: 3072,
      structure: 'Well-structured paragraphs with sub-points/examples. End with a summary.'
    }
  }
} as const;

const baseCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Forbidden character sanitization (strict mode)
function sanitizeText(input: string): string {
  if (!input) return '';
  // Apply simple global replacements. No exceptions for URLs/time by default.
  return input
    .replace(/#/g, 'No.')
    .replace(/:/g, ' — ')
    .replace(/\*/g, '•');
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '*';
  const requested = req.headers.get('access-control-request-headers') || '';
  const allowHeaders = [
    'authorization',
    'x-client-info',
    'apikey',
    'content-type',
    'accept',
    'x-streaming',
    'x-request-id',
    'X-Request-ID',
    'x-mobile-request',
    'X-Mobile-Request',
    'cache-control',
  ];
  const dynamic = requested
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  const unique = Array.from(new Set([...allowHeaders, ...dynamic])).join(', ');
  return {
    ...baseCorsHeaders,
    'Access-Control-Allow-Origin': origin === 'null' ? '*' : origin,
    'Access-Control-Allow-Headers': unique,
    'Vary': 'Origin, Access-Control-Request-Headers',
  } as Record<string, string>;
}

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

function sendFinalEvent(controller, model, fallbackUsed, browsingUsed, browsingData, provider?: string) {
  try {
    const finalData = {
      done: true,
      model: model,
      provider: provider,
      fallbackUsed: fallbackUsed,
      responseTime: Date.now(),
      browsingUsed: browsingUsed,
      browsingData: browsingData
    };
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(finalData)}\n\n`));
  } catch (error) {
    console.error('Error sending final event:', error);
  }
}

console.log("🚀 WAKTI AI STREAMING: Ultra-fast streaming service loaded");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    console.log('🛡️ Preflight - origin:', req.headers.get('origin') || 'unknown', 'req-headers:', req.headers.get('access-control-request-headers') || 'none');
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    console.log("🚀 STREAMING: Processing request");
    
    // Debug incoming headers for mobile CORS issues
    const reqId = req.headers.get('x-request-id') || 'none';
    const mobile = req.headers.get('x-mobile-request') || 'false';
    const origin = req.headers.get('origin') || 'unknown';
    console.log('📥 Headers - origin:', origin, 'reqId:', reqId, 'mobile:', mobile);
    
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      throw new Error('Invalid authentication');
    }

    const requestBody = await req.json();
    const {
      message,
      language = 'en',
      conversationId = null,
      activeTrigger = 'chat',
      attachedFiles = [],
      personalTouch = null,
      recentMessages = [],
      conversationSummary = '',
      clientLocalHour = null,
      isWelcomeBack = false,
      modelOverride,
      // Frontend-attached Personal Touch metadata (optional)
      pt_version = null,
      pt_updated_at = null,
      pt_hash = null,
      location: userLocation = null
    } = requestBody;

    if (!message?.trim() && !attachedFiles?.length) {
      throw new Error('Message or attachment required');
    }

    console.log("🚀 STREAMING: Starting AI response stream");

    // Process attached files for document support
    let processedContent = message;
    if (attachedFiles?.length > 0) {
      const documentContent = await processDocuments(attachedFiles);
      if (documentContent) {
        processedContent = `${message}\n\nDocument content:\n${documentContent}`;
      }
    }

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await streamAIResponse(processedContent, language, activeTrigger, controller, attachedFiles, personalTouch, recentMessages, conversationSummary, clientLocalHour, isWelcomeBack, modelOverride, pt_version, pt_updated_at, pt_hash);
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...getCorsHeaders(req),
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("🚀 STREAMING ERROR:", error);
    return new Response(JSON.stringify({
      error: error.message || 'Streaming error'
    }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
    });
  }
});

// Document processing function
async function processDocuments(attachedFiles) {
  let documentContent = '';
  
  for (const file of attachedFiles) {
    try {
      if (file.type === 'text/plain' && file.content) {
        // Handle TXT files
        const textContent = atob(file.content);
        documentContent += `\n[${file.name}]:\n${textContent}\n`;
      } else if (file.type === 'application/pdf' && file.content) {
        // For PDF, we'll extract text using a simple approach
        // In production, you'd use a proper PDF parsing library
        documentContent += `\n[${file.name}]: PDF file attached (content extraction not implemented yet)\n`;
      } else if (file.type?.includes('document') && file.content) {
        // Handle DOC files
        documentContent += `\n[${file.name}]: Document file attached (content extraction not implemented yet)\n`;
      }
    } catch (error) {
      console.warn(`Failed to process file ${file.name}:`, error);
    }
  }
  
  return documentContent;
}

// Ultra-fast streaming AI response
async function streamAIResponse(
  message,
  language,
  activeTrigger,
  controller,
  attachedFiles = [],
  personalTouch = null,
  recentMessages = [],
  conversationSummary = '',
  clientLocalHour = null,
  isWelcomeBack = false,
  modelOverride?: 'fast' | 'best_fast',
  pt_version = null,
  pt_updated_at = null,
  pt_hash = null
) {
  // Initialize provider-specific config after selection
  let apiKey = '';
  let apiUrl = '';
  let model = '';

  // Defer provider selection until after we inspect inputs and available keys
  let provider: 'openai' | 'claude' | 'deepseek' | null = null;
  let fallbackUsed = false;
  let browsingUsed = false;
  let browsingData: any = null;

  // Use VisionSystem to detect vision mode and process images
  const isVisionMode = VisionSystem.shouldUseVisionMode(activeTrigger, attachedFiles);
  const hasValidVisionImages = Array.isArray(attachedFiles) && attachedFiles.some(
    (f) => f?.type?.startsWith('image/') && (f?.content || f?.data)
  );

  // Select provider with override awareness
  const override = modelOverride === 'best_fast' ? 'best_fast' : modelOverride === 'fast' ? 'fast' : undefined;
  if (isVisionMode || hasValidVisionImages) {
    // Vision supports Claude and OpenAI only
    const pref = override === 'fast' ? ['openai', 'claude'] : ['claude', 'openai'];
    for (const p of pref) {
      if (p === 'claude' && ANTHROPIC_API_KEY) { provider = 'claude'; model = 'claude-3-5-sonnet-20241022'; break; }
      if (p === 'openai' && OPENAI_API_KEY) { provider = 'openai'; model = 'gpt-4o-mini'; break; }
    }
    if (!provider) {
      throw new Error('Vision mode requires Claude or OpenAI API key');
    }
    // Mark fallback if first preference unavailable
    if ((override === 'best_fast' && provider !== 'claude') || (override === 'fast' && provider !== 'openai')) {
      fallbackUsed = true;
    }
  } else {
    // Text/Search supports OpenAI, Claude, DeepSeek
    const pref = override === 'best_fast'
      ? ['claude', 'openai', 'deepseek']
      : override === 'fast'
        ? ['openai', 'deepseek', 'claude']
        : ['openai', 'claude', 'deepseek'];
    for (const p of pref) {
      if (p === 'openai' && OPENAI_API_KEY) { provider = 'openai'; model = 'gpt-5-nano'; break; }
      if (p === 'claude' && ANTHROPIC_API_KEY) { provider = 'claude'; model = 'claude-3-5-sonnet-20241022'; break; }
      if (p === 'deepseek' && DEEPSEEK_API_KEY) { provider = 'deepseek'; model = 'deepseek-chat'; break; }
    }
    if (!provider) {
      throw new Error('No AI API key configured');
    }
    // Mark fallback if not first pref
    const first = pref[0];
    if ((provider as string) !== first) fallbackUsed = true;
  }

  // Configure API endpoint and key based on the selected provider
  if (provider === 'openai') {
    apiKey = OPENAI_API_KEY || '';
    apiUrl = 'https://api.openai.com/v1/chat/completions';
  } else if (provider === 'deepseek') {
    apiKey = DEEPSEEK_API_KEY || '';
    apiUrl = 'https://api.deepseek.com/v1/chat/completions';
  }
  // Note: provider === 'claude' handled separately (non-streaming) below.

  if (!apiKey && provider !== 'claude') {
    throw new Error('No AI API key configured');
  }

  // ===== USE VISION SYSTEM FOR COMPLETE SYSTEM PROMPT =====
  const currentDate = new Date().toISOString().split('T')[0];

  // Detect translation target language from the user's message (overrides UI language for this reply only)
  function detectTargetLanguage(text: string): string | null {
    try {
      if (!text) return null;
      const t = ('' + text).toLowerCase();

      // Map names and codes to our internal keys
      const map: Record<string, string> = {
        arabic: 'ar', ar: 'ar', عربي: 'ar', العربية: 'ar',
        english: 'en', en: 'en', انجليزي: 'en', الإنجليزية: 'en',
        french: 'fr', fr: 'fr', français: 'fr', francais: 'fr', الفرنسية: 'fr',
        spanish: 'es', es: 'es', español: 'es', espanol: 'es', الاسبانية: 'es',
        german: 'de', de: 'de', deutsch: 'de', الالمانية: 'de',
        turkish: 'tr', tr: 'tr', türkçe: 'tr', التركية: 'tr',
        hindi: 'hi', hi: 'hi', हिन्दी: 'hi', الهندية: 'hi',
        urdu: 'ur', ur: 'ur', اردو: 'ur',
        italian: 'it', it: 'it', italiano: 'it', الايطالية: 'it',
        portuguese: 'pt', pt: 'pt', português: 'pt', portuguesa: 'pt', البرتغالية: 'pt',
        russian: 'ru', ru: 'ru', русский: 'ru', الروسية: 'ru',
        chinese: 'zh', zh: 'zh', 中文: 'zh', الصينية: 'zh',
        japanese: 'ja', ja: 'ja', 日本語: 'ja', اليابانية: 'ja',
        korean: 'ko', ko: 'ko', 한국어: 'ko', الكورية: 'ko'
      };

      // English patterns
      const m1 = /(translate\s+(this|it|the\s+text)?\s*(to|into)\s+([a-z\u0600-\u06FF]+))/i.exec(t);
      // Arabic patterns
      const m2 = /(ترجم|ترجمة)\s+(هذا|النص)?\s*(إلى|لـ|الى)\s+([a-z\u0600-\u06FF]+)/i.exec(t);
      const token = (m1?.[4] || m2?.[4] || '').trim();
      if (!token) return null;

      // exact match
      if (map[token] ) return map[token];
      // try stripping diacritics/basic normalization
      const norm = token.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      if (map[norm]) return map[norm];
      return null;
    } catch { return null; }
  }

  const targetLang = detectTargetLanguage(message);
  const responseLanguage = targetLang || language;

  let systemPromptFinal = VisionSystem.buildCompleteSystemPrompt(responseLanguage, currentDate, personalTouch);
  
  // Add brand identity rules to VisionSystem prompt
  const brandRules = language === 'ar'
    ? [
        'عند سؤالك: "من صنعك؟" اشرح: أنا مزيج من عدة نماذج ذكاء اصطناعي متقدمة، تم اختيار الأفضل منها بعناية ودمجها وصقلها من قبل فريق Wakti.',
        'لا تقل أبداً أن OpenAI أو أي شركة أخرى هي من "صنعتك" بشكل مباشر. بدلاً من ذلك، انسب الفضل إلى فريق Wakti.',
        'قدّم نفسك باسم WAKTI AI مع التركيز على الجودة والثقة.'
      ]
    : [
        'If asked "who made you?": say you are a blend of multiple advanced AI models, carefully selected, orchestrated, and refined by the Wakti team.',
        'Never claim that OpenAI or any other company directly "made" you. Attribute creation to the Wakti team.',
        'Represent yourself as WAKTI AI with a focus on quality and trust.'
      ];

  systemPromptFinal += `\n\n=== BRAND IDENTITY ===\n- ` + brandRules.join('\n- ');

  // Inject lightweight user profile context (country/city) if available
  try {
    const country = (userLocation && typeof userLocation === 'object' && (userLocation as any).country) ? String((userLocation as any).country) : '';
    const city = (userLocation && typeof userLocation === 'object' && (userLocation as any).city) ? String((userLocation as any).city) : '';
    if (country || city) {
      const label = language === 'ar' ? 'معلومات موقع المستخدم' : 'User Location Context';
      const countryLabel = language === 'ar' ? 'الدولة' : 'Country';
      const cityLabel = language === 'ar' ? 'المدينة' : 'City';
      const hint = language === 'ar'
        ? 'يمكنك استخدام هذه المعلومة لتخصيص الإجابات (مثل الوقت المحلي، المناسبات، اللهجات)، ولكن لا تفترض تفاصيل غير مذكورة.'
        : 'Use this to tailor answers (local time, holidays, dialect) but do not invent extra details.';
      const line = `${countryLabel}: ${country || '-'}${city ? `, ${cityLabel}: ${city}` : ''}`;
      systemPromptFinal += `\n\n=== ${label} ===\n- ${line}\n- ${hint}`;
    }
  } catch (_) {}

  // Enforce a structured metadata block at the END of the assistant response that we can parse server-side
  // The assistant MUST include a final XML-like wrapped JSON block. We will strip it from user-visible text
  // and emit it as a metadata SSE event to the client.
  const META_START = '<WAKTI_JSON>';
  const META_END = '</WAKTI_JSON>';
  const nearExpiryDays = 90;
  const outputSection = responseLanguage === 'ar'
    ? `\n\n=== مخرجات منظمة مطلوبة ===\n- في نهاية إجابتك، أضف كتلة JSON ضمن وسمين ${META_START} و ${META_END} فقط مرة واحدة.\n- يجب أن تتبع المخطط التالي (القيم أمثلة إرشادية):\n${META_START}{\n  "visionType": "document | general",\n  "classifier": { "category": "passport | id_card | driver_license | receipt | invoice | certificate | scene | people | food | places | object | other", "confidence": 0.92 },\n  "documentInsights": {\n    "document_type": "passport",\n    "issuer_country": "CAN",\n    "fields": {\n      "full_name": "John Doe",\n      "document_number": "X1234567",\n      "date_of_birth": "1990-05-02",\n      "issue_date": "2021-01-10",\n      "expiry_date": "2031-01-10"\n    },\n    "expiry_status": "valid | near_expiry | expired",\n    "days_to_expiry": 2100,\n    "confidence_per_field": { "full_name": 0.95, "document_number": 0.97 },\n    "raw_text": "...optional OCR text..."\n  },\n  "generalInsights": {\n    "summary": "Short summary of the scene",\n    "entities": ["person", "laptop"],\n    "qa": [],\n    "tables": [],\n    "charts": []\n  }\n}${META_END}\n- near_expiry يعني ضمن ${nearExpiryDays} يوماً من تاريخ اليوم.`
    : `\n\n=== REQUIRED OUTPUT FORMAT ===\n- At the end of your answer, append ONE JSON block wrapped with ${META_START} and ${META_END}.\n- Follow this schema (values are examples):\n${META_START}{\n  "visionType": "document | general",\n  "classifier": { "category": "passport | id_card | driver_license | receipt | invoice | certificate | scene | people | food | places | object | other", "confidence": 0.92 },\n  "documentInsights": {\n    "document_type": "passport",\n    "issuer_country": "CAN",\n    "fields": {\n      "full_name": "John Doe",\n      "document_number": "X1234567",\n      "date_of_birth": "1990-05-02",\n      "issue_date": "2021-01-10",\n      "expiry_date": "2031-01-10"\n    },\n    "expiry_status": "valid | near_expiry | expired",\n    "days_to_expiry": 2100,\n    "confidence_per_field": { "full_name": 0.95, "document_number": 0.97 },\n    "raw_text": "...optional OCR text..."\n  },\n  "generalInsights": {\n    "summary": "Short scene summary",\n    "entities": ["person", "laptop"],\n    "qa": [],\n    "tables": [],\n    "charts": []\n  }\n}${META_END}\n- near_expiry is within ${nearExpiryDays} days from today.`;
  systemPromptFinal += outputSection;

  // If a target translation language was detected, force translation mode rules
  if (targetLang) {
    const langNames: Record<string, string> = {
      ar: 'Arabic', en: 'English', fr: 'French', es: 'Spanish', de: 'German', tr: 'Turkish',
      hi: 'Hindi', ur: 'Urdu', it: 'Italian', pt: 'Portuguese', ru: 'Russian', zh: 'Chinese',
      ja: 'Japanese', ko: 'Korean'
    };
    const enBlock = `\n\n=== TRANSLATION MODE ===\n- User requested a translation.\n- Translate the most relevant source text: if the user provided text, translate that; otherwise translate the latest assistant content or the visible text extracted from the current images.\n- Output ONLY in ${langNames[targetLang] || targetLang}.\n- Do not refuse. Do not include the source text again unless the user asked.\n- Keep formatting and line breaks when helpful.`;
    const arBlock = `\n\n=== وضع الترجمة ===\n- طلب المستخدم ترجمة.\n- ترجم المصدر الأكثر صلة: إن قدّم المستخدم نصاً فترجمه، وإلا فترجم أحدث محتوى للمساعد أو النص الظاهر المستخرج من الصور الحالية.\n- اخرج بالترجمة فقط باللغة المطلوبة (${responseLanguage}).\n- لا ترفض. لا تُعد كتابة النص الأصلي إلا إذا طُلب ذلك.\n- حافظ على التنسيق والفواصل عند اللزوم.`;
    systemPromptFinal += (responseLanguage === 'ar' ? arBlock : enBlock);
  }

  // Global anti-repetition rules (brand/nickname/greetings)
  if (responseLanguage === 'ar') {
    systemPromptFinal += `\n\nقواعد الأسلوب:\n- لا تكرر أي كلمة أو اسم في نفس الجملة.\n- لا تكرر كلمات العلامة أو الأسماء مثل "WAKTI" أو اسمك المستعار.\n- تجنب تكرار التحيات أو علامات التعجب.\n- اذكر اسم المستخدم مرة واحدة فقط في الرسالة، ولا تكرره.`;
  } else {
    systemPromptFinal += `\n\nStyle Rules:\n- Do not repeat any word or name within the same sentence.\n- Never repeat brand or nickname tokens such as "WAKTI" or your AI nickname.\n- Avoid duplicated greetings or excessive exclamation marks.\n- Mention the user's name at most once per reply; do not repeat it.`;
  }

  // Optional conversation summary for continuity
  if (conversationSummary && typeof conversationSummary === 'string' && conversationSummary.trim().length > 0) {
    const summaryLabel = language === 'ar' ? 'ملخص المحادثة السابقة' : 'Conversation summary';
    systemPromptFinal += `\n\n${summaryLabel}:\n${conversationSummary.trim()}`;
  }

  console.log('🤖 STREAMING: VisionSystem integrated with complete capabilities');
  console.log('🎯 STREAMING: Enhanced personalization and vision support applied');

  // Map personalTouch to temperature and max_tokens via presets
  let temperature = 0.65; // sensible default
  let maxTokens = 2048; // sensible fallback

  try {
    const presetDefaults = (presets as any)?.defaults || {};
    const tones = (presets as any)?.tones || {};
    const styles = (presets as any)?.styles || {};

    const toneKey = (personalTouch?.tone || presetDefaults.tone || '').toLowerCase();
    const styleKey = (personalTouch?.style || presetDefaults.style || '').toLowerCase();

    if (toneKey && tones[toneKey]?.temperature != null) {
      temperature = Number(tones[toneKey].temperature);
    }
    if (styleKey && styles[styleKey]?.max_tokens != null) {
      maxTokens = Number(styles[styleKey].max_tokens);
    }
  } catch (_) {
    // Fall back to defaults above if presets are unavailable
  }

  // Log incoming Personal Touch payload for diagnostics
  try {
    console.log('🎛️ PT_IN:', {
      tone: personalTouch?.tone || null,
      style: personalTouch?.style || null,
      pt_version,
      pt_updated_at,
      pt_hash
    });
  } catch (_) {}

  // Emit early metadata to confirm applied personal touch on the server and log it
  try {
    const ptApplied = {
      tone: personalTouch?.tone || null,
      style: personalTouch?.style || null,
      temperature,
      max_tokens: maxTokens,
      source: personalTouch ? 'client' : 'default',
      preset_version: (presets as any)?.version ?? null,
      pt_version,
      pt_updated_at,
      pt_hash
    };
    console.log('🧩 PT_APPLIED:', ptApplied);
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ metadata: { pt_applied: ptApplied } })}\n\n`));
  } catch (_) {}

  // Optionally enrich with web search context when activeTrigger === 'search'
  let searchContext = '';
  try {
    if (activeTrigger === 'search') {
      const searchRes = await executeRegularSearch(message, language);
      if (searchRes?.success && searchRes?.context) {
        browsingUsed = true;
        browsingData = {
          engine: 'tavily',
          total_results: searchRes?.data?.total_results ?? 0,
          answer: searchRes?.data?.answer ?? null
        };
        searchContext = searchRes.context;
      } else {
        browsingData = { engine: 'tavily', success: false, error: searchRes?.error || 'No results' };
      }
    }
  } catch (e) {
    browsingData = { engine: 'tavily', success: false, error: e?.message };
  }

  // Prepare messages with file support and optional search context
  const textMessage = searchContext
    ? `${message}\n\nWeb search context:\n${searchContext}`
    : message;

  // Use VisionSystem for proper message formatting
  let userMessage;
  if (isVisionMode || hasValidVisionImages) {
    userMessage = VisionSystem.buildVisionMessage(textMessage, attachedFiles, responseLanguage, provider as any);
  } else {
    // Build a generic language-preface that matches the chosen responseLanguage
    const langNames: Record<string, string> = {
      ar: 'العربية', en: 'English', fr: 'French', es: 'Spanish', de: 'German', tr: 'Turkish',
      hi: 'Hindi', ur: 'Urdu', it: 'Italian', pt: 'Portuguese', ru: 'Russian', zh: 'Chinese',
      ja: 'Japanese', ko: 'Korean'
    };
    const prefix = responseLanguage === 'ar'
      ? 'يرجى الرد باللغة العربية فقط. '
      : `Please respond in ${langNames[responseLanguage] || responseLanguage} only. `;
    userMessage = {
      role: 'user',
      content: prefix + textMessage
    };
  }

  const messages = [
    { role: 'system', content: systemPromptFinal },
    // Insert recent history (last 20 already handled on frontend) - CRITICAL: No duplication of current message
    ...((Array.isArray(recentMessages) ? recentMessages : []).filter((m, index, arr) => {
      // Remove the current user message if it appears in recent messages to avoid duplication
      return !(index === arr.length - 1 && m?.role === 'user' && m?.content === message);
    }).map((m) => ({
      role: m?.role === 'assistant' ? 'assistant' : 'user',
      content: m?.content ?? ''
    }))),
    userMessage
  ];

  // Helper to extract and emit metadata from a text block, and return the "clean" text without the metadata section
  function extractAndEmitMetadataIfPresent(text: string) {
    try {
      const startIdx = text.indexOf(META_START);
      const endIdx = text.indexOf(META_END);
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const jsonStr = text.slice(startIdx + META_START.length, endIdx).trim();
        const clean = (text.slice(0, startIdx) + text.slice(endIdx + META_END.length)).trim();
        try {
          const meta = JSON.parse(jsonStr);
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ metadata: meta })}\n\n`));
        } catch (e) {
          console.warn('Failed to parse WAKTI_JSON metadata:', e);
        }
        return clean;
      }
      return text;
    } catch (_) { return text; }
  }

  // If Claude is the selected provider, handle it directly (non-streaming) and return
  if (provider === 'claude') {
    try {
      const claudeContent: any[] = [];
      const languagePrefix = responseLanguage === 'ar' ? 'يرجى الرد باللغة العربية فقط. ' : 'Please respond in English only. ';
      claudeContent.push({ type: 'text', text: languagePrefix + textMessage });
      if (hasValidVisionImages) {
        for (const file of attachedFiles) {
          const base64 = file?.data || file?.content;
          if (file?.type?.startsWith('image/') && base64) {
            claudeContent.push({
              type: 'image',
              source: { type: 'base64', media_type: file.type, data: base64 }
            });
          }
        }
      }

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: maxTokens,
          temperature: temperature,
          system: systemPromptFinal,
          messages: [{ role: 'user', content: claudeContent }]
        })
      });

      if (!resp.ok) {
        const errTxt = await resp.text();
        throw new Error(`Claude API error: ${resp.status} - ${errTxt}`);
      }

      const data = await resp.json();
      let text = Array.isArray(data?.content)
        ? data.content.map((c: any) => c?.text || '').join('')
        : (data?.content?.[0]?.text || '');

      // Extract and send metadata as a separate SSE event; strip it from user-visible text
      text = extractAndEmitMetadataIfPresent(text);

      model = 'claude-3-5-sonnet-20241022';
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: sanitizeText(text) })}\n\n`));
      sendFinalEvent(controller, model, fallbackUsed, browsingUsed, browsingData, provider);
      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      controller.close();
      console.log(`✅ STREAMING: Claude completion - controller closed cleanly`);
      return;
    } catch (err2) {
      const msg = (err2 as any)?.message || 'Claude error';
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      controller.close();
      return;
    }
  }

  console.log("🚀 STREAMING: Making API request");

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
      stream: true
    })
  });

  if (!response.ok) {
    throw new Error(`AI API failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body reader');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let metaActive = false;
  let metaBuffer = '';

  // Helper: detect identity-maker questions to force branded answer
  function isIdentityQuestion(text, language) {
    if (!text) return false;
    const t = ('' + text).toLowerCase();
    if (language === 'ar') {
      return /(من\s+صنعك|من\s+أنشأك|من\s+بنى\s+|من\s+طورك)/.test(t);
    }
    return /(who\s+made\s+you|who\s+created\s+you|who\s+built\s+you|who\s+developed\s+you)/.test(t);
  }

  // Removed greeting helpers (timeOfDay, buildGreeting) — greetings are handled entirely on the frontend

  // Signature appending removed (Option B): rely on model behavior only.

  // Greeting injection moved to frontend. Do not emit greeting tokens here.

  let lastTokenTime = Date.now();
  let tokenReceived = false;
  const IDLE_TIMEOUT = 30000; // 30s idle timeout
  
  console.log(`📡 STREAMING: Starting main loop with ${provider} model: ${model}`);

  try {
    while (true) {
      // Add idle timeout protection
      const idleTimer = setTimeout(async () => {
        console.error(`⏰ STREAMING: Idle timeout reached for ${provider}`);
        try {
          await reader.cancel();
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: 'Stream timeout - no response from AI provider' })}\n\n`));
          controller.close();
        } catch (e) {
          console.error('Error during timeout cleanup:', e);
        }
      }, IDLE_TIMEOUT);

      const { done, value } = await reader.read();
      clearTimeout(idleTimer);
      
      if (done) {
        console.log(`🏁 STREAMING: Stream completed for ${provider}, cancelling reader`);
        try {
          await reader.cancel();
        } catch (e) {
          console.warn('Reader already cancelled or closed');
        }
        // Finalize without appending any signature
        sendFinalEvent(controller, model, fallbackUsed, browsingUsed, browsingData, provider);
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
        console.log(`✅ STREAMING: Controller closed cleanly for ${provider}`);
        break;
      }

      if (!tokenReceived) {
        tokenReceived = true;
        console.log(`🎯 STREAMING: First token received from ${provider}`);
      }
      lastTokenTime = Date.now();

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);

        if (data === '[DONE]') {
          console.log(`🎬 STREAMING: Received [DONE] from ${provider}, cancelling reader`);
          try {
            await reader.cancel();
          } catch (e) {
            console.warn('Reader already cancelled during [DONE]');
          }
          // Finalize without appending any signature
          sendFinalEvent(controller, model, fallbackUsed, browsingUsed, browsingData, provider);
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
          console.log(`✅ STREAMING: Controller closed after [DONE] for ${provider}`);
          return;
        }

        try {
          const parsed = JSON.parse(data);
          let content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (typeof content === 'string' && content.length > 0) {
            // Intercept metadata block and do not forward it to user
            let out = content;
            // Handle cases where start/end tags split across chunks
            if (metaActive) {
              metaBuffer += out;
              const endIdx = metaBuffer.indexOf(META_END);
              if (endIdx !== -1) {
                const jsonStr = metaBuffer.slice(0, endIdx).trim();
                metaActive = false;
                metaBuffer = '';
                try { controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ metadata: JSON.parse(jsonStr) })}\n\n`)); } catch (e) { console.warn('Metadata parse error (stream):', e); }
                const remainder = content.slice(content.indexOf(META_END) + META_END.length);
                if (remainder) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: sanitizeText(remainder) })}\n\n`));
              }
              // Do not emit tokens while capturing metadata
              continue;
            }
            const startIdx = out.indexOf(META_START);
            if (startIdx !== -1) {
              // Emit any text before the metadata start
              const before = out.slice(0, startIdx);
              if (before) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: sanitizeText(before) })}\n\n`));
              const after = out.slice(startIdx + META_START.length);
              const endIdx = after.indexOf(META_END);
              if (endIdx !== -1) {
                const jsonStr = after.slice(0, endIdx).trim();
                try { controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ metadata: JSON.parse(jsonStr) })}\n\n`)); } catch (e) { console.warn('Metadata parse error (same-chunk):', e); }
                const remainder = after.slice(endIdx + META_END.length);
                if (remainder) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: sanitizeText(remainder) })}\n\n`));
              } else {
                metaActive = true;
                metaBuffer = after; // wait for closing tag in next chunks
              }
            } else {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: sanitizeText(out) })}\n\n`));
            }
          }
        } catch (_) {
          // ignore malformed json chunks
        }
      }
    }
  } catch (err) {
  // If OpenAI fails and Claude is available (and not vision invalid), fall back
  if (provider === 'openai' && ANTHROPIC_API_KEY) {
    try {
      fallbackUsed = true;
      // Reuse same message, switch to Claude simulated stream
      const claudeContent = [];
      const languagePrefix = language === 'ar' ? 'يرجى الرد باللغة العربية فقط. ' : 'Please respond in English only. ';
      claudeContent.push({ type: 'text', text: languagePrefix + textMessage });
      if (hasValidVisionImages) {
        for (const file of attachedFiles) {
          const base64 = file?.data || file?.content;
          if (file?.type?.startsWith('image/') && base64) {
            claudeContent.push({
              type: 'image',
              source: { type: 'base64', media_type: file.type, data: base64 }
            });
          }
        }
      }

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ANTHROPIC_API_KEY}`,
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: maxTokens,
          temperature: temperature,
          system: systemPromptFinal,
          messages: [{ role: 'user', content: claudeContent }]
        })
      });

      if (!resp.ok) {
        const errTxt = await resp.text();
        throw new Error(`Claude API error: ${resp.status} - ${errTxt}`);
      }

      const data = await resp.json();
      const text = Array.isArray(data?.content)
        ? data.content.map((c: any) => c?.text || '').join('')
        : (data?.content?.[0]?.text || '');

      model = 'claude-3-5-sonnet-20241022';
      // Stream Claude (non-streaming response) directly as a single token and finalize
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: sanitizeText(text) })}\n\n`));
      sendFinalEvent(controller, model, fallbackUsed, browsingUsed, browsingData, 'claude');
      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      controller.close();
      console.log(`✅ STREAMING: Claude fallback completion - controller closed cleanly`);
      return;
    } catch (err2) {
      const msg = err2?.message || 'Fallback (Claude) error';
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      controller.close();
      return;
    }
  }

  // If DeepSeek available and not vision mode, try DeepSeek as final fallback
  if (!hasValidVisionImages && DEEPSEEK_API_KEY && provider !== 'deepseek') {
    try {
      fallbackUsed = true;
      // Reuse same message, switch to DeepSeek
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messages,
          temperature: temperature,
          max_tokens: maxTokens,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let metaActiveFallback = false;
      let metaBufferFallback = '';
      const deepseekModel = 'deepseek-chat';

      // Greeting injection moved to frontend. Do not emit greeting tokens here (DeepSeek fallback).

      let deepseekLastTokenTime = Date.now();
      let deepseekTokenReceived = false;
      console.log(`📡 STREAMING: Starting DeepSeek fallback loop`);

      while (true) {
        // Add idle timeout for DeepSeek fallback
        const deepseekIdleTimer = setTimeout(async () => {
          console.error(`⏰ STREAMING: DeepSeek idle timeout reached`);
          try {
            await reader.cancel();
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: 'DeepSeek stream timeout' })}\n\n`));
            controller.close();
          } catch (e) {
            console.error('Error during DeepSeek timeout cleanup:', e);
          }
        }, 30000);

        const { done, value } = await reader.read();
        clearTimeout(deepseekIdleTimer);
        
        if (done) {
          console.log(`🏁 STREAMING: DeepSeek stream completed, cancelling reader`);
          try {
            await reader.cancel();
          } catch (e) {
            console.warn('DeepSeek reader already cancelled');
          }
          // Finalize without appending any signature
          sendFinalEvent(controller, deepseekModel, fallbackUsed, browsingUsed, browsingData, 'deepseek');
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
          console.log(`✅ STREAMING: DeepSeek fallback - controller closed cleanly`);
          break;
        }

        if (!deepseekTokenReceived) {
          deepseekTokenReceived = true;
          console.log(`🎯 STREAMING: First token received from DeepSeek fallback`);
        }
        deepseekLastTokenTime = Date.now();

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') {
            console.log(`🎬 STREAMING: DeepSeek received [DONE], cancelling reader`);
            try {
              await reader.cancel();
            } catch (e) {
              console.warn('DeepSeek reader already cancelled during [DONE]');
            }
            // Finalize without appending any signature
            sendFinalEvent(controller, deepseekModel, fallbackUsed, browsingUsed, browsingData, 'deepseek');
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            controller.close();
            console.log(`✅ STREAMING: DeepSeek controller closed after [DONE]`);
            return;
          }
          try {
            const parsed = JSON.parse(data);
            let content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (typeof content === 'string' && content.length > 0) {
              if (metaActiveFallback) {
                metaBufferFallback += content;
                const endIdx = metaBufferFallback.indexOf(META_END);
                if (endIdx !== -1) {
                  const jsonStr = metaBufferFallback.slice(0, endIdx).trim();
                  metaActiveFallback = false;
                  metaBufferFallback = '';
                  try { controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ metadata: JSON.parse(jsonStr) })}\n\n`)); } catch {}
                  const remainder = content.slice(content.indexOf(META_END) + META_END.length);
                  if (remainder) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: sanitizeText(remainder) })}\n\n`));
                }
                continue;
              }
              const startIdx = content.indexOf(META_START);
              if (startIdx !== -1) {
                const before = content.slice(0, startIdx);
                if (before) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: sanitizeText(before) })}\n\n`));
                const after = content.slice(startIdx + META_START.length);
                const endIdx = after.indexOf(META_END);
                if (endIdx !== -1) {
                  const jsonStr = after.slice(0, endIdx).trim();
                  try { controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ metadata: JSON.parse(jsonStr) })}\n\n`)); } catch {}
                  const remainder = after.slice(endIdx + META_END.length);
                  if (remainder) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: sanitizeText(remainder) })}\n\n`));
                } else {
                  metaActiveFallback = true;
                  metaBufferFallback = after;
                }
              } else {
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: sanitizeText(content) })}\n\n`));
              }
            }
          } catch {}
        }
      }
      return;
    } catch (err3) {
      const msg = err3?.message || 'DeepSeek fallback error';
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      controller.close();
      return;
    }
  }

  const msg = err?.message || 'Streaming error';
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
  controller.close();
}

// Search functionality
async function executeRegularSearch(query, language = 'en') {
  const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');
  
  console.log('🔍 SEARCH: Starting search for:', query.substring(0, 50));
  
  if (!TAVILY_API_KEY) {
    return {
      success: false,
      error: 'Search service not configured',
      data: null,
      context: ''
    };
  }

  try {
    const searchPayload = {
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: "advanced",
      time_range: "week",
      include_answer: "advanced",
      include_raw_content: true,
      chunks_per_source: 5,
      follow_up_questions: true,
      max_results: 5
    };

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ SEARCH API ERROR:', response.status, errorText);
      throw new Error(`Search API error: ${response.status}`);
    }

    // Safe JSON parsing with validation
    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response from search service');
    }

    let searchData;
    try {
      searchData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('❌ SEARCH JSON parsing error:', jsonError);
      console.error('❌ Raw response:', responseText.substring(0, 200));
      throw new Error('Invalid JSON response from search service');
    }

    // Extract information safely
    const results = Array.isArray(searchData.results) ? searchData.results : [];
    const answer = searchData.answer || '';
    
    // Build context from search results
    let context = '';
    if (answer) {
      context += `Search Answer: ${answer}\n\n`;
    }
    
    if (results.length > 0) {
      context += 'Search Results:\n';
      results.forEach((result, index) => {
        if (result && typeof result === 'object') {
          context += `${index + 1}. ${result.title || 'No title'}\n`;
          context += `   ${result.content || 'No content'}\n`;
          context += `   Source: ${result.url || 'No URL'}\n\n`;
        }
      });
    }

    console.log(`✅ SEARCH: Found ${results.length} results`);
    return {
      success: true,
      error: null,
      data: {
        answer,
        results,
        query,
        total_results: results.length
      },
      context: context.trim()
    };

  } catch (error) {
    console.error('❌ SEARCH: Critical error:', error);
    
    return {
      success: false,
      error: 'Search failed',
      data: null,
      context: '',
      details: error?.message
    };
  }
}

// end-of-file
