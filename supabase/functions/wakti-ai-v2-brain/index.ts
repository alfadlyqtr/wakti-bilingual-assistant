import '../_types/deno-globals.d.ts';
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { generateImageWithRunware } from './imageGeneration.ts';
import { VisionSystem } from './vision.ts';

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
 
 // Types for safer message, search, and image payloads
 type MessageRole = 'system' | 'user' | 'assistant';
 interface TextMessage { role: MessageRole; content: string }
 type RecentMessageUnknown = { role?: unknown; content?: unknown };
 interface AttachedFile { type?: string | null; data?: string | null; [k: string]: unknown }
 interface PersonalTouch { nickname?: string; aiNickname?: string; tone?: string; style?: string; instruction?: string }
 interface SearchResultItem { title: string; url: string; content: string }
 type TavilySearchResult =
   | { success: true; results: SearchResultItem[]; answer: string | null }
   | { success: false; error: string; response: string };
 type BrowsingData =
   (
     | { success: true; answer: string | null; results: SearchResultItem[] }
     | { success: false; error: string; results: []; answer: null }
   ) & { query: string; timestamp: string };
 type RunwareOptions = NonNullable<Parameters<typeof generateImageWithRunware>[3]>;

 // Types for Claude and OpenAI chat messages
 interface ClaudeTextContent { type: 'text'; text: string }
 interface ClaudeImageSource { type: 'base64'; media_type?: string | null; data?: string | null }
 interface ClaudeImageContent { type: 'image'; source: ClaudeImageSource }
 type ClaudeContent = string | (ClaudeTextContent | ClaudeImageContent)[]
 interface ClaudeMessage { role: 'user' | 'assistant'; content: ClaudeContent }
 
 interface OpenAIMessage { role: 'system' | 'user' | 'assistant'; content: string }

// Enhanced message filtering with better performance
function smartFilterMessages(messages: RecentMessageUnknown[]): TextMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const filtered = messages.filter((msg) => {
    const role = (msg as { role?: unknown }).role;
    const content = (msg as { content?: unknown }).content;
    // Always keep system messages
    if (role === 'system') return true;
    // Keep user and assistant messages with valid content
    return (
      (role === 'user' || role === 'assistant') &&
      typeof content === 'string' &&
      content.trim().length > 0
    );
  });

  return filtered
    .slice(-20)
    .map((msg) => {
      const roleUnknown = (msg as { role?: unknown }).role;
      const contentUnknown = (msg as { content?: unknown }).content;
      const role: MessageRole =
        roleUnknown === 'system' || roleUnknown === 'user' || roleUnknown === 'assistant'
          ? (roleUnknown as MessageRole)
          : 'user';
      const content: string = typeof contentUnknown === 'string' ? contentUnknown : '';
      return { role, content };
    });
}

// Enhanced Tavily search with better error handling
async function performSearchWithTavily(query: string, userId: string, language: string = 'en', signal?: AbortSignal): Promise<TavilySearchResult> {
  console.log('🔍 BACKEND WORKER: Processing search request');
  
  if (!TAVILY_API_KEY) {
    return {
      success: false,
      error: language === 'ar'
        ? 'خدمة البحث غير متاحة'
        : 'Search service not configured',
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
        response: language === 'ar'
          ? 'تم إلغاء البحث'
          : 'Search was cancelled'
      };
    }

    if (!searchResponse.ok) {
      throw new Error(`Tavily API error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json() as unknown;
    
    const rawResults = (searchData as Record<string, unknown>)?.results as unknown;
    const searchResults: SearchResultItem[] = Array.isArray(rawResults)
      ? rawResults.map((result) => {
          const r = result as Record<string, unknown>;
          const title = typeof r.title === 'string' ? r.title : 'Untitled';
          const url = typeof r.url === 'string' ? r.url : '';
          const content = typeof r.content === 'string' ? r.content : '';
          return { title, url, content } as SearchResultItem;
        })
      : [];

<<<<<<< Updated upstream
<<<<<<< Updated upstream
      return {
        success: true,
        results: searchResults,
        answer: searchData.answer || null
      };
    } else {
      return {
        success: false,
        error: language === 'ar'
          ? 'لم يتم العثور على نتائج'
          : 'No results found',
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
        response: language === 'ar'
          ? 'تم إلغاء البحث'
          : 'Search was cancelled'
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
=======
      if (searchResults.length > 0) {
        return {
          success: true,
          results: searchResults,
          answer: (searchData as Record<string, unknown>)?.answer as string | null || null
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
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Search request was cancelled',
          response: language === 'ar' ? 'تم إلغاء البحث' : 'Search was cancelled'
        };
      }
    
=======
      if (searchResults.length > 0) {
        return {
          success: true,
          results: searchResults,
          answer: (searchData as Record<string, unknown>)?.answer as string | null || null
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
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Search request was cancelled',
          response: language === 'ar' ? 'تم إلغاء البحث' : 'Search was cancelled'
        };
      }
    
>>>>>>> Stashed changes
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('🔍 SEARCH ERROR:', error);
      return {
        success: false,
        error: errMsg,
        response: language === 'ar' 
          ? 'أعتذر، حدث خطأ أثناء البحث. يمكنني مساعدتك بأسئلة أخرى.'
          : 'I apologize, there was an error during search. I can help you with other questions.'
      };
    }
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
<<<<<<< Updated upstream
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error?.name === 'AbortError') {
        throw new Error(`Request timeout after ${resolvedTimeout}ms`);
      }
      
      if (attempt === resolvedRetries) {
        throw error;
      }
      
      console.log(`🔄 Retrying after error (attempt ${attempt + 2}/${resolvedRetries + 1}):`, error?.message || String(error));
=======
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      
      const msg = error instanceof Error ? error.message : String(error);
      if (attempt === retries) {
        throw (error instanceof Error ? error : new Error(msg));
      }
      
      console.log(`🔄 Retrying after error (attempt ${attempt + 2}/${retries + 1}):`, msg);
>>>>>>> Stashed changes
=======
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      
      const msg = error instanceof Error ? error.message : String(error);
      if (attempt === retries) {
        throw (error instanceof Error ? error : new Error(msg));
      }
      
      console.log(`🔄 Retrying after error (attempt ${attempt + 2}/${retries + 1}):`, msg);
>>>>>>> Stashed changes
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
      userId,
      modelOverride
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
    let browsingData: BrowsingData | null = null;
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
        // Extract imageMode and imageQuality from request body
        const imageMode = requestData.imageMode || 'text2image';
        const imageQuality: 'fast' | 'best_fast' | undefined = requestData.imageQuality;
        console.log('🎨 IMAGE MODE:', imageMode, '| 🧪 QUALITY:', imageQuality || 'default');

        // Prepare options based on image mode
        const imageOptions: RunwareOptions = {};
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
              // Background removal flags: do not override user's prompt
              imageOptions.backgroundRemoval = true;
              // Keep user's prompt as-is; backend will remove background based on flags
            }
          }
        }
        if (mappedModel) {
          imageOptions.model = mappedModel;
        }
        console.log('🧠 IMAGE MODEL SELECTION:', { imageQuality: imageQuality || 'default', mappedModel: mappedModel || 'env-defaults' });

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
<<<<<<< Updated upstream
<<<<<<< Updated upstream
        .map((r: any, i: number) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`)
=======
        .map((r: SearchResultItem, i: number) => `${i + 1}. ${r.title} - ${r.url}\nSummary: ${r.content}`)
>>>>>>> Stashed changes
=======
        .map((r: SearchResultItem, i: number) => `${i + 1}. ${r.title} - ${r.url}\nSummary: ${r.content}`)
>>>>>>> Stashed changes
        .join('\n\n');

      effectiveMessage = (requestLanguage === 'ar'
        ? `استخدم فقط نتائج البحث التالية للإجابة. لا تذكر أي مصادر أخرى.\n\nنتائج البحث:\n${sourcesList}\n\nسؤال المستخدم: "${message}"\n\nملاحظة مهمة: قدم إجابة مباشرة بدون ذكر المصادر أو إضافة "المصدر:" في النهاية. المعلومات من بحث الويب.`
        : `Use ONLY the following search results to answer. Do NOT mention any other sources like Wikipedia.\n\nSearch results:\n${sourcesList}\n\nUser question: "${message}"\n\nIMPORTANT: Provide a direct answer without adding "Source:" attribution at the end. The information comes from web search.`);

      // Avoid model-level search branches; treat as general after augmentation
      effectiveTrigger = 'general';
    }

<<<<<<< Updated upstream
    // Determine model order based on override and vision
    const isVision = VisionSystem.shouldUseVisionMode(effectiveTrigger, attachedFiles);
    let modelOrder: string[];
    if (isVision) {
      // Vision supports Claude and OpenAI
      modelOrder = modelOverride === 'fast'
        ? ['openai', 'claude']
        : ['claude', 'openai']; // default and best_fast prefer Claude
    } else {
      modelOrder = modelOverride === 'best_fast'
        ? ['claude', 'openai', 'deepseek']
        : modelOverride === 'fast'
          ? ['openai', 'deepseek', 'claude']
          : ['openai', 'claude', 'deepseek'];
    }
    let lastError = null;
=======
    // Try models in order: Claude → GPT-4 → DeepSeek
    const modelOrder = ['claude', 'gpt4', 'deepseek'];
    let lastError: unknown | null = null;
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
    let fallbackUsed = false;
    const attemptedModels: string[] = [];
    
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
        
        // Add debug/info metadata
        result.debugInfo = {
          attemptedModels,
          finalModel: modelName,
          fallbackUsed,
          responseTime,
          overrideActive: !!modelOverride
        };
        result.selectedProvider = modelName;
        result.overrideActive = !!modelOverride;
 
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
        
<<<<<<< Updated upstream
<<<<<<< Updated upstream
      } catch (error) {
        console.error(`❌ ${modelName} failed:`, (error as any)?.message || String(error));
        if ((error as any)?.stack) console.error((error as any).stack);
        lastError = error;
        fallbackUsed = true;
        attemptedModels.push(`${modelName}: failed - ${((error as any)?.message || String(error))}`);
=======
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`❌ ${modelName} failed:`, msg);
        lastError = error as unknown;
        fallbackUsed = true;
        attemptedModels.push(`${modelName}: failed - ${msg}`);
>>>>>>> Stashed changes
=======
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`❌ ${modelName} failed:`, msg);
        lastError = error as unknown;
        fallbackUsed = true;
        attemptedModels.push(`${modelName}: failed - ${msg}`);
>>>>>>> Stashed changes
        
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

  } catch (error: unknown) {
    console.error("🚀 REQUEST ERROR:", error);
    const stack = error instanceof Error ? error.stack : undefined;
    if (stack) console.error("🚀 ERROR STACK:", stack);
    
<<<<<<< Updated upstream
<<<<<<< Updated upstream
    const errorMessage = requestLanguage === 'ar'
=======
=======
>>>>>>> Stashed changes
    const preferredLanguage = (() => {
      const h = req.headers.get('accept-language') ?? '';
      return h.includes('ar') ? 'ar' : 'en';
    })();

    const errorMessage = preferredLanguage === 'ar' 
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
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

async function callClaude35API(
  message: string,
  conversationId?: string,
  language: string = 'en',
  attachedFiles: AttachedFile[] = [],
  activeTrigger: string = 'general',
  recentMessages: RecentMessageUnknown[] = [],
  personalTouch: PersonalTouch | null = null,
  skipInternalSearch = false
) {
  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    // Determine mode based on activeTrigger using VisionSystem
    let detectedMode = 'chat';
    
    if (VisionSystem.shouldUseVisionMode(activeTrigger, attachedFiles)) {
      detectedMode = 'vision';
      console.log('🤖 BACKEND WORKER: Vision mode enabled via VisionSystem');
    }
    
    console.log(`🤖 BACKEND WORKER: Final detectedMode = ${detectedMode}, activeTrigger = ${activeTrigger}`);

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
      const parts: string[] = [];
      if (personalTouch.nickname) parts.push(`User name: ${personalTouch.nickname}`);
      if (personalTouch.aiNickname) parts.push(`AI name: ${personalTouch.aiNickname}`);
      if (personalTouch.tone) parts.push(`Tone: ${personalTouch.tone}`);
      if (personalTouch.style) parts.push(`Style: ${personalTouch.style}`);
      if (personalTouch.instruction) parts.push(`Instructions: ${personalTouch.instruction}`);
      
      if (parts.length > 0) {
        personalizationContext = `\n\nPersonalization: ${parts.join(', ')}`;
      }
    }

    // Use VisionSystem to build complete system prompt
    const systemPrompt = VisionSystem.buildCompleteSystemPrompt(language, currentDate, personalTouch);

    // Build messages array
    const messages: ClaudeMessage[] = [];

    // Add conversation history with smart filtering - CRITICAL: No duplication of current message
    if (recentMessages && recentMessages.length > 0) {
      const filteredMessages = smartFilterMessages(recentMessages);
      const historyMessages = filteredMessages.slice(-20); // Last 20 messages for context
      historyMessages.forEach((msg, index) => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          // Skip if this is the current user message (avoid duplication)
          const isCurrentMessage = index === historyMessages.length - 1 && 
                                  msg.role === 'user' && 
                                  msg.content === message;
          if (!isCurrentMessage) {
            messages.push({
              role: msg.role,
              content: msg.content
            });
          }
        }
      });
    }

    // Handle vision mode with images using VisionSystem
    if (detectedMode === 'vision' && attachedFiles.length > 0) {
<<<<<<< Updated upstream
      const visionMessage = VisionSystem.buildVisionMessage(message, attachedFiles, language);
      messages.push(visionMessage);
=======
      const imageFiles = attachedFiles.filter(file => file.type?.startsWith('image/'));
      
      if (imageFiles.length > 0) {
        const content: (ClaudeTextContent | ClaudeImageContent)[] = [
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
>>>>>>> Stashed changes
    } else {
      // Add regular text message using VisionSystem format
      const visionMessage = VisionSystem.buildVisionMessage(message, [], language);
      messages.push(visionMessage);
    }

    // Make API call to Claude
    const response = await fetchWithTimeout(
      'https://api.anthropic.com/v1/messages',
      {
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
        })
      },
      models.claude.timeout
    );

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

  } catch (error: unknown) {
    console.error('🤖 CLAUDE API ERROR:', error);
    throw error;
  }
}

<<<<<<< Updated upstream
<<<<<<< Updated upstream
async function callOpenAIChatAPI(message, conversationId, language = 'en', attachedFiles = [], activeTrigger = 'general', recentMessages = [], personalTouch = null) {
=======
=======
>>>>>>> Stashed changes
async function callGPT4API(
  message: string,
  conversationId?: string,
  language: string = 'en',
  attachedFiles: AttachedFile[] = [],
  activeTrigger: string = 'general',
  recentMessages: RecentMessageUnknown[] = [],
  personalTouch: PersonalTouch | null = null
) {
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
    // Use VisionSystem to build complete system prompt
    const systemPrompt = VisionSystem.buildCompleteSystemPrompt(language, currentDate, personalTouch);
=======
    let personalizationContext = '';
    if (personalTouch) {
      const parts: string[] = [];
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
>>>>>>> Stashed changes

    // Build messages array
    const messages: OpenAIMessage[] = [
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

<<<<<<< Updated upstream
<<<<<<< Updated upstream
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
=======
    // Make API call to OpenAI
    const response = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
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
        })
      },
      models.gpt4.timeout
    );
>>>>>>> Stashed changes
=======
    // Make API call to OpenAI
    const response = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
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
        })
      },
      models.gpt4.timeout
    );
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
<<<<<<< Updated upstream
  } catch (error) {
    console.error('🤖 OPENAI API ERROR:', error);
=======
=======
>>>>>>> Stashed changes
  } catch (error: unknown) {
    console.error('🤖 GPT-4 API ERROR:', error);
>>>>>>> Stashed changes
    throw error;
  }
}

async function callDeepSeekAPI(
  message: string,
  conversationId?: string,
  language: string = 'en',
  attachedFiles: AttachedFile[] = [],
  activeTrigger: string = 'general',
  recentMessages: RecentMessageUnknown[] = [],
  personalTouch: PersonalTouch | null = null
) {
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

<<<<<<< Updated upstream
    // Use VisionSystem to build complete system prompt
    const systemPrompt = VisionSystem.buildCompleteSystemPrompt(language, currentDate, personalTouch);
=======
    let personalizationContext = '';
    if (personalTouch) {
      const parts: string[] = [];
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
>>>>>>> Stashed changes

    // Build messages array
    const messages: OpenAIMessage[] = [
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
    const response = await fetchWithTimeout(
      'https://api.deepseek.com/chat/completions',
      {
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
        })
      },
      models.deepseek.timeout
    );

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

  } catch (error: unknown) {
    console.error('🤖 DEEPSEEK API ERROR:', error);
    throw error;
  }
}
