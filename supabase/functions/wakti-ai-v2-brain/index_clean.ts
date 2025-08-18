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
}

const models: Record<string, AIModelConfig> = {
  claude: {
    name: 'claude',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-sonnet-20241022',
    apiKey: ANTHROPIC_API_KEY,
    maxTokens: 4000
  },
  gpt4: {
    name: 'gpt4',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    apiKey: OPENAI_API_KEY,
    maxTokens: 4000
  },
  deepseek: {
    name: 'deepseek',
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    apiKey: DEEPSEEK_API_KEY,
    maxTokens: 4000
  }
};

// TAVILY SEARCH FUNCTION
async function performSearchWithTavily(query: string, userId: string, language: string = 'en') {
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
      })
    });

    if (!searchResponse.ok) {
      throw new Error(`Tavily API error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    
    if (searchData.results && searchData.results.length > 0) {
      const searchResults = searchData.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        content: result.content
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

// Main request handler with intelligent fallback chain
serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

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
      personalTouch = null
    } = requestData;

    // Try models in order: Claude → GPT-4 → DeepSeek
    const modelOrder = ['claude', 'gpt4', 'deepseek'];
    let lastError = null;
    let fallbackUsed = false;
    
    for (const modelName of modelOrder) {
      const selectedModel = models[modelName];
      
      if (!selectedModel || !selectedModel.apiKey) {
        console.log(`⚠️ ${modelName} not available, trying next model`);
        continue;
      }
      
      try {
        console.log(`🔄 Attempting ${modelName}...`);
        const startTime = Date.now();
        
        let result;
        if (modelName === 'claude') {
          result = await callClaude35API(
            message, conversationId, language, attachedFiles, 
            activeTrigger, recentMessages, personalTouch
          );
        } else if (modelName === 'gpt4') {
          result = await callGPT4API(
            message, conversationId, language, attachedFiles, 
            activeTrigger, recentMessages, personalTouch
          );
        } else {
          result = await callDeepSeekAPI(
            message, conversationId, language, attachedFiles, 
            activeTrigger, recentMessages, personalTouch
          );
        }
        
        const responseTime = Date.now() - startTime;
        console.log(`✅ ${modelName} succeeded in ${responseTime}ms`);
        
        // Add fallback metadata if fallback was used
        if (fallbackUsed) {
          result.fallbackUsed = true;
          result.modelUsed = modelName;
          result.fallbackMessage = language === 'ar' 
            ? `تم استخدام ${modelName.toUpperCase()} كنموذج بديل`
            : `Used ${modelName.toUpperCase()} as fallback model`;
        }
        
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Cache-Control": "no-cache"
          }
        });
        
      } catch (error) {
        console.error(`❌ ${modelName} failed:`, error.message);
        lastError = error;
        fallbackUsed = true;
        
        // Continue to next model unless this is the last one
        if (modelName !== modelOrder[modelOrder.length - 1]) {
          console.log(`🔄 Falling back to next model...`);
          continue;
        }
      }
    }
    
    // All models failed
    console.error("❌ All models failed, returning error");
    const errorMessage = language === 'ar' 
      ? 'أعتذر، جميع النماذج غير متاحة حالياً. يرجى المحاولة لاحقاً.'
      : 'I apologize, all AI models are currently unavailable. Please try again later.';
    
    return new Response(JSON.stringify({
      response: errorMessage,
      error: true,
      allModelsFailed: true,
      lastError: lastError?.message
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
    return new Response(JSON.stringify({
      error: error.message || 'Request processing error'
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

async function callClaude35API(message, conversationId, language = 'en', attachedFiles = [], activeTrigger = 'general', recentMessages = [], personalTouch = null) {
  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    // Determine mode based on attached files
    let detectedMode = 'chat';
    
    if (attachedFiles && attachedFiles.length > 0) {
      const hasImages = attachedFiles.some(file => file.type?.startsWith('image/'));
      if (hasImages) {
        detectedMode = 'vision';
      }
    }

    // Handle search requests
    if (activeTrigger === 'search' || message.toLowerCase().includes('search for') || message.toLowerCase().includes('بحث عن')) {
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
        const imageResult = await generateImageWithRunware(message, language);
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

    // Add conversation history
    if (recentMessages && recentMessages.length > 0) {
      const historyMessages = recentMessages.slice(-6);
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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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

async function callGPT4API(message, conversationId, language = 'en', attachedFiles = [], activeTrigger = 'general', recentMessages = [], personalTouch = null) {
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

    // Add conversation history
    if (recentMessages && recentMessages.length > 0) {
      const historyMessages = recentMessages.slice(-6);
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

    // Make API call to OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return {
        response: data.choices[0].message.content,
        conversationId: conversationId,
        model: 'gpt-4o-mini'
      };
    } else {
      throw new Error('Invalid response format from OpenAI API');
    }

  } catch (error) {
    console.error('🤖 GPT-4 API ERROR:', error);
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

    // Add conversation history
    if (recentMessages && recentMessages.length > 0) {
      const historyMessages = recentMessages.slice(-6);
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
    const response = await fetch('https://api.deepseek.com/chat/completions', {
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
