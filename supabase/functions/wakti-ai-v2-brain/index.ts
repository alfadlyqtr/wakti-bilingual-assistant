import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { generateImageWithRunware } from './imageGeneration.ts';

// ENHANCED CORS CONFIGURATION FOR PRODUCTION
const allowedOrigins = [
  'https://wakti.qa',
  'https://www.wakti.qa'
];

const getCorsHeaders = (origin: string | null) => {
  // Allow production domains + any lovable subdomain
  const isAllowed = origin && (
    allowedOrigins.includes(origin) ||
    origin.includes('lovable.dev') ||
    origin.includes('lovable.app') ||
    origin.includes('lovableproject.com')
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name, x-auth-token, x-skip-auth, content-length',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  };
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("WAKTI AI V2 BRAIN: BACKEND WORKER MODE - Frontend Boss, Backend Worker");

// AI Model Configuration with Fallback Chain
interface AIModelConfig {
  name: string;
  endpoint: string;
  model: string;
  apiKey: string | undefined;
  maxTokens: number;
  timeout: number;
}

const models: Record<string, AIModelConfig> = {
  claude: {
    name: 'claude',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-sonnet-20241022',
    apiKey: ANTHROPIC_API_KEY,
    maxTokens: 4000,
    timeout: 25000
  },
  openai: {
    name: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-5-nano-2025-08-07',
    apiKey: OPENAI_API_KEY,
    maxTokens: 4000,
    timeout: 30000
  },
  deepseek: {
    name: 'deepseek',
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    apiKey: DEEPSEEK_API_KEY,
    maxTokens: 4000,
    timeout: 30000
  }
};

// Enhanced message filtering with better performance
function smartFilterMessages(messages: any[]) {
  if (!messages || messages.length === 0) return [];
  
  // Filter out invalid messages and keep only recent ones
  return messages
    .filter((msg, index) => {
      // Always keep system messages
      if (msg.role === 'system') return true;
      
      // Keep user and assistant messages with valid content
      return (msg.role === 'user' || msg.role === 'assistant') && 
             msg.content && 
             typeof msg.content === 'string' && 
             msg.content.trim().length > 0;
    })
    .slice(-20); // Keep last 20 messages for better context
}

// Enhanced Tavily search with better error handling
async function performSearchWithTavily(query: string, userId: string, language: string = 'en', signal?: AbortSignal) {
  console.log('🔍 BACKEND WORKER: Processing search request');
  
  if (!TAVILY_API_KEY) {
    return {
      success: false,
      error: language === 'ar' ? 'خدمة البحث غير متاحة' : 'Search service not configured',
      response: language === 'ar' 
        ? 'أعتذر، خدمة البحث غير متاحة حالياً. يمكنني مساعدتك بأسئلة أخرى.'
        : 'I apologize, search service is not available. I can help you with other questions.'
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    // Combine external signal with internal timeout
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    const searchResponse = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: 'basic',
        include_answer: true,
        include_images: false,
        include_raw_content: false,
        max_results: 5,
        include_domains: [],
        exclude_domains: []
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (controller.signal.aborted) {
      return {
        success: false,
        error: 'Search request was cancelled',
        response: language === 'ar' ? 'تم إلغاء البحث' : 'Search was cancelled'
      };
    }

    if (!searchResponse.ok) {
      throw new Error(`Tavily API error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    
    if (searchData.results && searchData.results.length > 0) {
      const searchResults = searchData.results.map((result: any) => ({
        title: result.title || 'Untitled',
        url: result.url || '',
        content: result.content || ''
      }));

      return {
        success: true,
        results: searchResults,
        answer: searchData.answer || null
      };
    } else {
      return {
        success: false,
        error: language === 'ar' ? 'لم يتم العثور على نتائج' : 'No results found',
        response: language === 'ar' 
          ? 'لم أتمكن من العثور على معلومات حول هذا الموضوع.'
          : 'I could not find information about this topic.'
      };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Search request was cancelled',
        response: language === 'ar' ? 'تم إلغاء البحث' : 'Search was cancelled'
      };
    }
    
    console.error('🔍 SEARCH ERROR:', error);
    return {
      success: false,
      error: error.message,
      response: language === 'ar' 
        ? 'أعتذر، حدث خطأ أثناء البحث. يمكنني مساعدتك بأسئلة أخرى.'
        : 'I apologize, there was an error during search. I can help you with other questions.'
    };
  }
}

// Enhanced fetch with timeout and retry logic
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number; retries?: number },
  timeoutMsArg?: number,
  retriesArg: number = 1
): Promise<Response> {
  // Resolve timeout and retries from positional args first, then from options, with sane defaults
  const optAny = (options || {}) as any;
  const resolvedTimeout =
    typeof timeoutMsArg === 'number' && !Number.isNaN(timeoutMsArg)
      ? timeoutMsArg
      : typeof optAny.timeoutMs === 'number'
        ? optAny.timeoutMs
        : 15000; // default 15s
  const resolvedRetries =
    typeof retriesArg === 'number' && !Number.isNaN(retriesArg)
      ? retriesArg
      : typeof optAny.retries === 'number'
        ? optAny.retries
        : 1;

  // Do not pass non-standard fields to fetch
  const { timeoutMs: _omitTimeout, retries: _omitRetries, ...fetchOptions } = optAny;

  for (let attempt = 0; attempt <= resolvedRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), resolvedTimeout);
    
    try {
      const response = await fetch(url, {
        ...(fetchOptions as RequestInit),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok || attempt === resolvedRetries) {
        return response;
      }
      
      // Retry on server errors (5xx) but not client errors (4xx)
      if (response.status >= 500 && attempt < resolvedRetries) {
        console.log(`🔄 Retrying request (attempt ${attempt + 2}/${resolvedRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
        continue;
      }
      
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error?.name === 'AbortError') {
        throw new Error(`Request timeout after ${resolvedTimeout}ms`);
      }
      
      if (attempt === resolvedRetries) {
        throw error;
      }
      
      console.log(`🔄 Retrying after error (attempt ${attempt + 2}/${resolvedRetries + 1}):`, error?.message || String(error));
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  throw new Error('Max retries exceeded');
}

// Main request handler with intelligent fallback chain
serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  let requestLanguage = 'en';

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log("🚀 BACKEND WORKER: Processing request with fallback chain");
    
    const requestData = await req.json();
    const { 
      message, 
      conversationId,
      language = 'en',
      attachedFiles = [],
      activeTrigger = 'general',
      recentMessages = [],
      personalTouch = null,
      userId
    } = requestData;
    requestLanguage = language;

    // Validate required fields
    if (!message || typeof message !== 'string') {
      const badReqMessage = requestLanguage === 'ar'
        ? 'طلب غير صالح: يجب أن تكون الرسالة نصاً صالحاً.'
        : 'Bad request: message must be a valid non-empty string.';
      return new Response(JSON.stringify({ response: badReqMessage, error: true }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-cache" }
      });
    }

    // Log API key availability for debugging
    console.log(`🔑 API Keys available: Claude=${!!ANTHROPIC_API_KEY}, OpenAI=${!!OPENAI_API_KEY}, DeepSeek=${!!DEEPSEEK_API_KEY}`);

    // Global Search pre-processing before model selection
    let browsingUsed = false;
    let browsingData: any = null;
    let effectiveMessage: string = message;
    let effectiveTrigger: string = activeTrigger;

    // Handle image generation requests FIRST (before search processing)
    if (activeTrigger === 'image' || message.toLowerCase().includes('generate image') || message.toLowerCase().includes('أنشئ صورة')) {
      console.log('🎨 BACKEND WORKER: Image generation request detected');
      
      if (!RUNWARE_API_KEY) {
        return new Response(JSON.stringify({
          response: requestLanguage === 'ar' 
            ? 'أعتذر، خدمة إنشاء الصور غير متاحة حالياً.'
            : 'I apologize, image generation service is not available.',
          error: true
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
        });
      }

      try {
        // Extract imageMode from request body
        const imageMode = requestData.imageMode || 'text2image';
        console.log('🎨 IMAGE MODE:', imageMode);

        // Prepare options based on image mode
        let imageOptions: any = {};
        let seedImage: string | undefined = undefined;
        let promptForImage: string = message;

        // Handle different image modes
        if (imageMode === 'image2image' && attachedFiles && attachedFiles.length > 0) {
          const imageFile = attachedFiles.find(file => file.type?.startsWith('image/'));
          if (imageFile && imageFile.data) {
            seedImage = `data:${imageFile.type};base64,${imageFile.data}`;
            imageOptions.seedImage = seedImage;
          }
        }

        if (imageMode === 'background-removal') {
          imageOptions.outputFormat = 'PNG'; // PNG supports transparency
          if (attachedFiles && attachedFiles.length > 0) {
            const imageFile = attachedFiles.find(file => file.type?.startsWith('image/'));
            if (imageFile && imageFile.data) {
              seedImage = `data:${imageFile.type};base64,${imageFile.data}`;
              imageOptions.seedImage = seedImage;
              // For background removal, we'll use a special prompt
              promptForImage = promptForImage || 'Remove the background from this image, make it transparent';
            }
          }
        }

        const imageResult = await generateImageWithRunware(
          promptForImage,
          userId,
          requestLanguage,
          imageOptions,
          req.signal
        );

        return new Response(JSON.stringify({
          ...imageResult,
          imageMode: imageMode
        }), {
          status: 200,
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Cache-Control": "no-cache"
          }
        });
      } catch (imageError) {
        console.error('🎨 IMAGE GENERATION ERROR:', imageError);
        return new Response(JSON.stringify({
          response: requestLanguage === 'ar' 
            ? 'أعتذر، حدث خطأ في إنشاء الصورة.'
            : 'I apologize, there was an error generating the image.',
          error: true
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
        });
      }
    }

    if (activeTrigger === 'search') {
      const searchResult = await performSearchWithTavily(message, 'user', requestLanguage);
      const baseMeta = { query: message, timestamp: new Date().toISOString() };

      if (!searchResult.success) {
        const early = {
          response: searchResult.response,
          error: true,
          browsingUsed: true,
          browsingData: { ...baseMeta, success: false, error: searchResult.error, results: [], answer: null }
        };
        return new Response(JSON.stringify(early), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
        });
      }

      browsingUsed = true;
      browsingData = { ...baseMeta, success: true, answer: searchResult.answer || null, results: searchResult.results };
      const sourcesList = searchResult.results
        .map((r: any, i: number) => `${i + 1}. ${r.title} - ${r.url}\nSummary: ${r.content}`)
        .join('\n\n');

      effectiveMessage = (requestLanguage === 'ar'
        ? `بناءً على نتائج البحث أدناه، قدّم إجابة موجزة ودقيقة مع الاستشهاد بالمصادر باستخدام [رقم].\n\nنتائج البحث:\n${sourcesList}\n\nسؤال المستخدم: "${message}"\n\nصيغة الإخراج: إجابة موجزة تتضمن إشارات [1] و[2] إن لزم، ثم قسم "المصادر" به الروابط.`
        : `Based on the web search results below, provide a concise, accurate answer with citations using [number].\n\nSearch results:\n${sourcesList}\n\nUser question: "${message}"\n\nOutput: A concise answer with [1], [2] style citations and a Sources section listing the URLs.`);

      // Avoid model-level search branches; treat as general after augmentation
      effectiveTrigger = 'general';
    }

    // Try models in order: Claude → GPT-4 → DeepSeek
    const modelOrder = ['claude', 'gpt4', 'deepseek'];
    let lastError = null;
    let fallbackUsed = false;
    let attemptedModels = [];
    
    for (const modelName of modelOrder) {
      const selectedModel = models[modelName];
      
      if (!selectedModel || !selectedModel.apiKey) {
        console.log(`⚠️ ${modelName} not available (no API key), trying next model`);
        attemptedModels.push(`${modelName}: no API key`);
        continue;
      }
      
      try {
        console.log(`🔄 Attempting ${modelName}...`);
        const startTime = Date.now();
        
        let result;
        if (modelName === 'claude') {
          result = await callClaude35API(
            effectiveMessage, conversationId, requestLanguage, attachedFiles, 
            effectiveTrigger, recentMessages, personalTouch, browsingUsed
          );
        } else if (modelName === 'openai') {
          result = await callOpenAIChatAPI(
            effectiveMessage, conversationId, requestLanguage, attachedFiles, 
            effectiveTrigger, recentMessages, personalTouch
          );
        } else {
          result = await callDeepSeekAPI(
            effectiveMessage, conversationId, requestLanguage, attachedFiles, 
            effectiveTrigger, recentMessages, personalTouch
          );
        }
        
        const responseTime = Date.now() - startTime;
        console.log(`✅ ${modelName} succeeded in ${responseTime}ms`);
        attemptedModels.push(`${modelName}: success (${responseTime}ms)`);
        
        // Add fallback metadata if fallback was used
        if (fallbackUsed) {
          result.fallbackUsed = true;
          result.modelUsed = modelName;
          result.fallbackMessage = requestLanguage === 'ar' 
            ? `تم استخدام ${modelName.toUpperCase()} كنموذج بديل`
            : `Used ${modelName.toUpperCase()} as fallback model`;
        }
        
        // Add debug info for troubleshooting
        result.debugInfo = {
          attemptedModels,
          finalModel: modelName,
          fallbackUsed,
          responseTime
        };

        // Attach browsing metadata (for Search mode)
        result.browsingUsed = browsingUsed;
        result.browsingData = browsingUsed ? browsingData : null;
        
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Cache-Control": "no-cache"
          }
        });
        
      } catch (error) {
        console.error(`❌ ${modelName} failed:`, (error as any)?.message || String(error));
        if ((error as any)?.stack) console.error((error as any).stack);
        lastError = error;
        fallbackUsed = true;
        attemptedModels.push(`${modelName}: failed - ${((error as any)?.message || String(error))}`);
        
        // Continue to next model unless this is the last one
        if (modelName !== modelOrder[modelOrder.length - 1]) {
          console.log(`🔄 Falling back to next model...`);
          continue;
        }
      }
    }
    
    // All models failed
    console.error("❌ All models failed, returning error");
    console.error("📊 Attempted models:", attemptedModels);
    
    const errorMessage = requestLanguage === 'ar' 
      ? 'أعتذر، لست متاح حالياً. يرجى المحاولة مرة أخرى.'
      : 'I apologize, I\'m not available right now. Please try again.';
    
    return new Response(JSON.stringify({
      response: errorMessage,
      error: true,
      // Include browsing metadata even when all models fail
      browsingUsed: browsingUsed,
      browsingData: browsingUsed ? browsingData : null
    }), {
      status: 503,
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    });

  } catch (error) {
    console.error("🚀 REQUEST ERROR:", error);
    console.error("🚀 ERROR STACK:", error.stack);
    
    const errorMessage = requestLanguage === 'ar' 
      ? 'أعتذر، حدث خطأ مؤقت. يرجى المحاولة مرة أخرى.'
      : 'I apologize, there was a temporary issue. Please try again.';
    
    return new Response(JSON.stringify({
      response: errorMessage,
      error: true
    }), {
      status: 500,
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    });
  }
});

async function callClaude35API(message, conversationId, language = 'en', attachedFiles = [], activeTrigger = 'general', recentMessages = [], personalTouch = null, skipInternalSearch = false) {
  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    // Determine mode based on activeTrigger (not just attached files)
    let detectedMode = 'chat';
    
    // Only use vision mode when explicitly requested via activeTrigger
    if (activeTrigger === 'vision') {
      detectedMode = 'vision';
    } else if (activeTrigger === 'chat') {
      // Force chat mode for regular conversations, even with images
      detectedMode = 'chat';
      console.log('🤖 BACKEND WORKER: Using chat mode for activeTrigger=chat (GPT-5 Nano priority)');
    } else if (attachedFiles && attachedFiles.length > 0) {
      const hasImages = attachedFiles.some(file => file.type?.startsWith('image/'));
      if (hasImages) {
        detectedMode = 'vision';
      }
    }

    // Handle search requests
    if (activeTrigger === 'search' && !skipInternalSearch) {
      console.log('🔍 BACKEND WORKER: Search request detected');
      const searchResult = await performSearchWithTavily(message, 'user', language);
      
      if (searchResult.success) {
        const searchContext = searchResult.results.map(r => `${r.title}: ${r.content}`).join('\n\n');
        const searchPrompt = language === 'ar' 
          ? `بناءً على نتائج البحث التالية، أجب على السؤال: "${message}"\n\nنتائج البحث:\n${searchContext}`
          : `Based on the following search results, answer the question: "${message}"\n\nSearch Results:\n${searchContext}`;
        
        // Continue with AI processing using search context
        message = searchPrompt;
      } else {
        return {
          response: searchResult.response,
          error: true,
          searchError: searchResult.error
        };
      }
    }

    // Handle image generation requests
    if (activeTrigger === 'image' || message.toLowerCase().includes('generate image') || message.toLowerCase().includes('أنشئ صورة')) {
      console.log('🎨 BACKEND WORKER: Image generation request detected');
      
      if (!RUNWARE_API_KEY) {
        return {
          response: language === 'ar' 
            ? 'أعتذر، خدمة إنشاء الصور غير متاحة حالياً.'
            : 'I apologize, image generation service is not available.',
          error: true
        };
      }

      try {
        const imageResult = await generateImageWithRunware(message, undefined, language);
        return imageResult;
      } catch (imageError) {
        console.error('🎨 IMAGE GENERATION ERROR:', imageError);
        return {
          response: language === 'ar' 
            ? 'أعتذر، حدث خطأ في إنشاء الصورة.'
            : 'I apologize, there was an error generating the image.',
          error: true
        };
      }
    }

    // Build system prompt with personalization
    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'Asia/Qatar'
    });

    let personalizationContext = '';
    if (personalTouch) {
      const parts = [];
      if (personalTouch.nickname) parts.push(`User name: ${personalTouch.nickname}`);
      if (personalTouch.aiNickname) parts.push(`AI name: ${personalTouch.aiNickname}`);
      if (personalTouch.tone) parts.push(`Tone: ${personalTouch.tone}`);
      if (personalTouch.style) parts.push(`Style: ${personalTouch.style}`);
      if (personalTouch.instruction) parts.push(`Instructions: ${personalTouch.instruction}`);
      
      if (parts.length > 0) {
        personalizationContext = `\n\nPersonalization: ${parts.join(', ')}`;
      }
    }

    const systemPrompt = language === 'ar' 
      ? `⚠️ CRITICAL: استجب باللغة العربية فقط. لا تستخدم الإنجليزية مطلقاً. هذا أمر إجباري.

أنت WAKTI AI، مساعد ذكي متخصص في الإنتاجية والتنظيم.
التاريخ الحالي: ${currentDate}

أنت هنا لجعل حياة المستخدمين أكثر تنظيماً وإنتاجية!

IMPORTANT: تذكر - استخدم العربية فقط في ردك. أي استخدام للإنجليزية غير مقبول.
${personalizationContext}`
      : `⚠️ CRITICAL: Respond ONLY in English. Do not use Arabic at all. This is mandatory.

You are WAKTI AI, an intelligent assistant specializing in productivity and organization.
Current date: ${currentDate}

You're here to make users' lives more organized and productive!

IMPORTANT: Remember - use only English in your response. Any use of Arabic is unacceptable.
${personalizationContext}`;

    // Build messages array
    let messages = [];

    // Add conversation history with smart filtering
    if (recentMessages && recentMessages.length > 0) {
      const filteredMessages = smartFilterMessages(recentMessages);
      const historyMessages = filteredMessages.slice(-20); // Increased from 6 to 20
      historyMessages.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      });
    }

    // Handle vision mode with images
    if (detectedMode === 'vision' && attachedFiles.length > 0) {
      const imageFiles = attachedFiles.filter(file => file.type?.startsWith('image/'));
      
      if (imageFiles.length > 0) {
        const content = [
          {
            type: "text",
            text: language === 'ar' ? 'يرجى الرد باللغة العربية فقط. ' + message : 'Please respond in English only. ' + message
          }
        ];

        imageFiles.forEach(file => {
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: file.type,
              data: file.data
            }
          });
        });

        messages.push({
          role: "user",
          content: content
        });
      }
    } else {
      // Regular text message
      const languagePrefix = language === 'ar' 
        ? 'يرجى الرد باللغة العربية فقط. ' 
        : 'Please respond in English only. ';
      
      messages.push({
        role: "user",
        content: languagePrefix + message
      });
    }

    // Make API call to Claude
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANTHROPIC_API_KEY}`,
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.7,
        system: systemPrompt,
        messages: messages
      }),
      timeoutMs: models.claude.timeout
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    
    if (data.content && data.content[0] && data.content[0].text) {
      return {
        response: data.content[0].text,
        conversationId: conversationId,
        model: 'claude-3.5-sonnet'
      };
    } else {
      throw new Error('Invalid response format from Claude API');
    }

  } catch (error) {
    console.error('🤖 CLAUDE API ERROR:', error);
    throw error;
  }
}

async function callOpenAIChatAPI(message, conversationId, language = 'en', attachedFiles = [], activeTrigger = 'general', recentMessages = [], personalTouch = null) {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // Build system prompt
    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'Asia/Qatar'
    });

    let personalizationContext = '';
    if (personalTouch) {
      const parts = [];
      if (personalTouch.nickname) parts.push(`User name: ${personalTouch.nickname}`);
      if (personalTouch.aiNickname) parts.push(`AI name: ${personalTouch.aiNickname}`);
      if (personalTouch.tone) parts.push(`Tone: ${personalTouch.tone}`);
      if (personalTouch.style) parts.push(`Style: ${personalTouch.style}`);
      if (personalTouch.instruction) parts.push(`Instructions: ${personalTouch.instruction}`);
      
      if (parts.length > 0) {
        personalizationContext = `\n\nPersonalization: ${parts.join(', ')}`;
      }
    }

    const systemPrompt = language === 'ar' 
      ? `⚠️ CRITICAL: استجب باللغة العربية فقط. لا تستخدم الإنجليزية مطلقاً. هذا أمر إجباري.

أنت WAKTI AI، مساعد ذكي متخصص في الإنتاجية والتنظيم.
التاريخ الحالي: ${currentDate}

أنت هنا لجعل حياة المستخدمين أكثر تنظيماً وإنتاجية!

IMPORTANT: تذكر - استخدم العربية فقط في ردك. أي استخدام للإنجليزية غير مقبول.
${personalizationContext}`
      : `⚠️ CRITICAL: Respond ONLY in English. Do not use Arabic at all. This is mandatory.

You are WAKTI AI, an intelligent assistant specializing in productivity and organization.
Current date: ${currentDate}

You're here to make users' lives more organized and productive!

IMPORTANT: Remember - use only English in your response. Any use of Arabic is unacceptable.
${personalizationContext}`;

    // Build messages array
    let messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history with smart filtering
    if (recentMessages && recentMessages.length > 0) {
      const filteredMessages = smartFilterMessages(recentMessages);
      const historyMessages = filteredMessages.slice(-20); // Increased from 6 to 20
      historyMessages.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      });
    }

    // Add current message
    const languagePrefix = language === 'ar' 
      ? 'يرجى الرد باللغة العربية فقط. ' 
      : 'Please respond in English only. ';
    
    messages.push({
      role: 'user',
      content: languagePrefix + message
    });

    // Always use Chat Completions for chat mode
    const openAiModel = (models.openai && models.openai.model) ? models.openai.model : 'gpt-4o-mini';
    const resp = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 4000,
        temperature: 0.7
      }),
      timeoutMs: models.openai.timeout
    });

    if (!resp.ok) {
      const errorData = await resp.text();
      throw new Error(`OpenAI Chat Completions error: ${resp.status} - ${errorData}`);
    }

    const data = await resp.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      return {
        response: data.choices[0].message.content,
        conversationId: conversationId,
        model: 'gpt-4o-mini'
      };
    } else {
      throw new Error('Invalid response format from OpenAI Chat Completions API');
    }

  } catch (error) {
    console.error('🤖 OPENAI API ERROR:', error);
    throw error;
  }
}

async function callDeepSeekAPI(message, conversationId, language = 'en', attachedFiles = [], activeTrigger = 'general', recentMessages = [], personalTouch = null) {
  try {
    if (!DEEPSEEK_API_KEY) {
      throw new Error('DeepSeek API key not configured');
    }

    // Build system prompt
    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'Asia/Qatar'
    });

    let personalizationContext = '';
    if (personalTouch) {
      const parts = [];
      if (personalTouch.nickname) parts.push(`User name: ${personalTouch.nickname}`);
      if (personalTouch.aiNickname) parts.push(`AI name: ${personalTouch.aiNickname}`);
      if (personalTouch.tone) parts.push(`Tone: ${personalTouch.tone}`);
      if (personalTouch.style) parts.push(`Style: ${personalTouch.style}`);
      if (personalTouch.instruction) parts.push(`Instructions: ${personalTouch.instruction}`);
      
      if (parts.length > 0) {
        personalizationContext = `\n\nPersonalization: ${parts.join(', ')}`;
      }
    }

    const systemPrompt = language === 'ar' 
      ? `⚠️ CRITICAL: استجب باللغة العربية فقط. لا تستخدم الإنجليزية مطلقاً. هذا أمر إجباري.

أنت WAKTI AI، مساعد ذكي متخصص في الإنتاجية والتنظيم.
التاريخ الحالي: ${currentDate}

أنت هنا لجعل حياة المستخدمين أكثر تنظيماً وإنتاجية!

IMPORTANT: تذكر - استخدم العربية فقط في ردك. أي استخدام للإنجليزية غير مقبول.
${personalizationContext}`
      : `⚠️ CRITICAL: Respond ONLY in English. Do not use Arabic at all. This is mandatory.

You are WAKTI AI, an intelligent assistant specializing in productivity and organization.
Current date: ${currentDate}

You're here to make users' lives more organized and productive!

IMPORTANT: Remember - use only English in your response. Any use of Arabic is unacceptable.
${personalizationContext}`;

    // Build messages array
    let messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history with smart filtering
    if (recentMessages && recentMessages.length > 0) {
      const filteredMessages = smartFilterMessages(recentMessages);
      const historyMessages = filteredMessages.slice(-20); // Increased from 6 to 20
      historyMessages.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      });
    }

    // Add current message
    const languagePrefix = language === 'ar' 
      ? 'يرجى الرد باللغة العربية فقط. ' 
      : 'Please respond in English only. ';
    
    messages.push({
      role: 'user',
      content: languagePrefix + message
    });

    // Make API call to DeepSeek
    const response = await fetchWithTimeout('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        max_tokens: 4000,
        temperature: 0.7
      }),
      timeoutMs: models.deepseek.timeout
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return {
        response: data.choices[0].message.content,
        conversationId: conversationId,
        model: 'deepseek-chat'
      };
    } else {
      throw new Error('Invalid response format from DeepSeek API');
    }

  } catch (error) {
    console.error('🤖 DEEPSEEK API ERROR:', error);
    throw error;
  }
}
