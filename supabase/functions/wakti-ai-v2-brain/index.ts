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

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("WAKTI AI V2 BRAIN: BACKEND WORKER MODE - Frontend Boss, Backend Worker");

// TAVILY SEARCH FUNCTION
async function performSearchWithTavily(query: string, userId: string, language: string = 'en') {
  console.log('🔍 BACKEND WORKER: Processing search request');
  
  if (!TAVILY_API_KEY) {
    return {
      success: false,
      error: language === 'ar' ? 'خدمة البحث غير متاحة' : 'Search service not configured',
      response: language === 'ar' 
        ? 'أعتذر، خدمة البحث غير متاحة حالياً.'
        : 'I apologize, search service is not available at the moment.'
    };
  }

  try {
    const searchPayload = {
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: "basic",
      include_answer: true,
      include_raw_content: false,
      max_results: 5
    };

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchPayload)
    });

    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`);
    }

    const searchData = await response.json();
    const results = Array.isArray(searchData.results) ? searchData.results : [];
    const answer = searchData.answer || '';
    
    let searchResponse = language === 'ar' ? '🔍 نتائج البحث:\n\n' : '🔍 Search Results:\n\n';
    
    if (answer) {
      searchResponse += language === 'ar' ? `**الإجابة المباشرة:**\n${answer}\n\n` : `**Direct Answer:**\n${answer}\n\n`;
    }
    
    if (results.length > 0) {
      searchResponse += language === 'ar' ? '**المصادر:**\n' : '**Sources:**\n';
      results.forEach((result: any, index: number) => {
        if (result && typeof result === 'object') {
          searchResponse += `${index + 1}. **${result.title || 'No title'}**\n`;
          searchResponse += `   ${result.content || 'No content'}\n`;
          searchResponse += `   🔗 [${language === 'ar' ? 'المصدر' : 'Source'}](${result.url || '#'})\n\n`;
        }
      });
    }

    console.log(`✅ BACKEND WORKER: Search completed with ${results.length} results`);
    return {
      success: true,
      error: null,
      response: searchResponse,
      searchData: {
        answer,
        results,
        query,
        total_results: results.length
      }
    };

  } catch (error) {
    console.error('❌ BACKEND WORKER: Search error:', error);
    
    return {
      success: false,
      error: language === 'ar' ? 'فشل البحث' : 'Search failed',
      response: language === 'ar' 
        ? 'أعتذر، حدث خطأ أثناء البحث. يرجى المحاولة مرة أخرى.'
        : 'I apologize, there was an error during the search. Please try again.'
    };
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    console.log("🔧 BACKEND WORKER: Handling OPTIONS request");
    return new Response(null, { 
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  }

  try {
    console.log("🤖 BACKEND WORKER: Processing Claude request from Frontend Boss");
    
    const contentType = req.headers.get('content-type') || '';
    let requestData;
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const jsonData = formData.get('data') as string;
      requestData = JSON.parse(jsonData);
      
      const files = [];
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('file-') && value instanceof File) {
          files.push(value);
        }
      }
      requestData.files = files;
    } else {
      requestData = await req.json();
    }

    const { 
      message, 
      conversationId, // Accept frontend ID without validation or creation
      userId, 
      language = 'en',
      files = [],
      attachedFiles: requestAttachedFiles = [],
      activeTrigger = 'general',
      recentMessages = [], // Use frontend-provided conversation history
      conversationSummary = '',
      personalTouch = null
    } = requestData;

    const actualUserId = userId || personalTouch?.userId || requestData.user_id || 'default_user';
    console.log(`🤖 BACKEND WORKER: Processing ${activeTrigger} mode for conversation ${conversationId || 'new'}`);

    // NO CONVERSATION MANAGEMENT - ACCEPT FRONTEND ID AS-IS
    const finalConversationId = conversationId; // Use exactly what frontend provides

    let attachedFiles = [];
    
    if (requestAttachedFiles && requestAttachedFiles.length > 0) {
      console.log(`📎 BACKEND WORKER: Processing ${requestAttachedFiles.length} files`);
      
      attachedFiles = requestAttachedFiles.map(file => ({
        url: file.url,
        type: file.type,
        name: file.name,
        imageType: file.imageType || { id: 'general', name: language === 'ar' ? 'عام' : 'General' }
      }));
    }

    console.log(`🎯 BACKEND WORKER: Mode=${activeTrigger}, HasImages=${attachedFiles.length > 0}`);

    let result;
    
    // ROUTE TO CORRECT API BASED ON MODE
    if (activeTrigger === 'image') {
      console.log('🎨 BACKEND WORKER: Processing image generation');
      result = await generateImageWithRunware(message, actualUserId, language);
      result.mode = 'image';
      result.intent = 'image';
    } else if (activeTrigger === 'search') {
      console.log('🔍 BACKEND WORKER: Processing search request');
      result = await performSearchWithTavily(message, actualUserId, language);
      result.mode = 'search';
      result.intent = 'search';
    } else {
      console.log('🤖 BACKEND WORKER: Processing Claude chat/vision request');
      result = await callClaude35API(
        message,
        finalConversationId,
        actualUserId,
        language,
        attachedFiles,
        activeTrigger,
        recentMessages, // Use frontend conversation history
        conversationSummary,
        personalTouch
      );
    }

    const finalResponse = {
      response: result.response || 'Response received',
      conversationId: finalConversationId, // Return frontend ID unchanged
      intent: result.intent || activeTrigger,
      confidence: 'high',
      actionTaken: null,
      imageUrl: result.imageUrl || null,
      browsingUsed: activeTrigger === 'search',
      browsingData: result.searchData || null,
      needsConfirmation: false,
      
      success: result.success !== false,
      processingTime: Date.now(),
      aiProvider: result.mode === 'image' ? 'runware' : result.mode === 'search' ? 'tavily' : 'claude-3-5-sonnet-20241022',
      claude35Enabled: true,
      mode: result.mode || activeTrigger,
      fallbackUsed: false
    };

    console.log(`✅ BACKEND WORKER: Successfully processed ${activeTrigger} request, returning to Frontend Boss`);
    
    return new Response(JSON.stringify(finalResponse), {
      status: 200,
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY"
      }
    });

  } catch (error) {
    console.error("❌ BACKEND WORKER ERROR:", error);
    return new Response(JSON.stringify({
      error: error.message || 'Backend worker failed',
      success: false,
      response: 'I encountered an error processing your request. Please try again.',
      conversationId: null
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

async function callClaude35API(message, conversationId, userId, language = 'en', attachedFiles = [], activeTrigger = 'general', recentMessages = [], conversationSummary = '', personalTouch = null) {
  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    console.log(`🤖 BACKEND WORKER: Processing ${activeTrigger} mode conversation`);
    
    let detectedMode = 'chat';

    if (attachedFiles && attachedFiles.length > 0) {
      const hasImages = attachedFiles.some(file => file.type?.startsWith('image/'));
      if (hasImages) {
        detectedMode = 'vision';
        console.log('🔍 BACKEND WORKER: Images detected, using vision mode');
      }
    }

    console.log(`🤖 BACKEND WORKER: Mode="${detectedMode}" (trigger: "${activeTrigger}")`);

    const responseLanguage = language;
    let messages = [];

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

    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'Asia/Qatar'
    });

    if (detectedMode === 'vision') {
      console.log('👁️ BACKEND WORKER: Building vision request');
      
      const visionContent = [];
      
      visionContent.push({
        type: 'text',
        text: message || 'Analyze this image and describe what you see in detail.'
      });

      for (const file of attachedFiles) {
        if (file.type?.startsWith('image/')) {
          console.log(`📎 BACKEND WORKER: Processing ${file.name}`);
          
          let imageData;
          if (file.url.startsWith('data:')) {
            imageData = file.url.split(',')[1];
            console.log('✅ BACKEND WORKER: Extracted base64 data');
          } else {
            console.error('❌ Expected base64 data URL, got:', file.url.substring(0, 50));
            throw new Error('Invalid image data format - expected base64 data URL');
          }

          visionContent.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: file.type,
              data: imageData
            }
          });
        }
      }

      messages.push({
        role: 'user',
        content: visionContent
      });

    } else {
      // USE FRONTEND-PROVIDED CONVERSATION HISTORY
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
        console.log(`🧠 BACKEND WORKER: Using ${historyMessages.length} messages from Frontend Boss conversation history`);
      }
      
      messages.push({
        role: 'user',
        content: message
      });
    }

    let systemPrompt;
    if (detectedMode === 'vision') {
      systemPrompt = responseLanguage === 'ar' 
        ? `أنت WAKTI AI، مساعد ذكي متخصص في تحليل الصور. التاريخ الحالي: ${currentDate}

CRITICAL LANGUAGE INSTRUCTION: استجب باللغة العربية فقط. لا تستخدم الإنجليزية أبداً في ردودك.

قم بتحليل الصورة المرفقة بالتفصيل واستخرج جميع المعلومات المفيدة منها. كن دقيقاً ووصفياً في تحليلك.`
        : `You are WAKTI AI, an intelligent assistant specialized in image analysis. Current date: ${currentDate}

CRITICAL LANGUAGE INSTRUCTION: Respond ONLY in English. Never use Arabic in your responses.

Analyze the attached image in detail and extract all useful information from it. Be precise and descriptive in your analysis.`;
    } else {
      systemPrompt = responseLanguage === 'ar' ? `
أنت WAKTI AI، مساعد ذكي متخصص في الإنتاجية والتنظيم.
التاريخ الحالي: ${currentDate}

CRITICAL LANGUAGE INSTRUCTION: استجب باللغة العربية فقط. لا تستخدم الإنجليزية أبداً في ردودك.

## إنشاء الصور (في وضع المحادثة فقط):
عندما تكون في وضع المحادثة ويطلب المستخدمون إنشاء صور، اردد بـ:
"يرجى التبديل إلى وضع الصور لإنشاء المحتوى البصري."

أنت هنا لجعل حياة المستخدمين أكثر تنظيماً وإنتاجية!
` : `
You are WAKTI AI, an intelligent assistant specializing in productivity and organization.
Current date: ${currentDate}

CRITICAL LANGUAGE INSTRUCTION: Respond ONLY in English. Never use Arabic in your responses.

## Image Generation (Chat Mode Only):
When in chat mode and users request image generation, respond with:
"Please switch to image mode for visual content creation."

You're here to make users' lives more organized and productive!
`;
      systemPrompt += personalizationContext;
    }

    console.log(`🤖 BACKEND WORKER: Calling Claude with mode=${detectedMode}, messages=${messages.length}`);

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANTHROPIC_API_KEY}`,
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: detectedMode === 'vision' ? 3000 : 2000,
        temperature: 0.7,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!claudeResponse.ok) {
      const errorData = await claudeResponse.text();
      console.error('❌ BACKEND WORKER: Claude API error:', claudeResponse.status, errorData);
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content?.[0]?.text || (responseLanguage === 'ar' ? 'أعتذر، واجهت مشكلة في معالجة طلبك.' : 'I apologize, but I encountered an issue processing your request.');

    console.log(`✅ BACKEND WORKER: Claude response completed for ${detectedMode} mode`);

    // NO DATABASE SAVING - FRONTEND BOSS HANDLES ALL PERSISTENCE
    console.log('🤖 BACKEND WORKER: Skipping database save - Frontend Boss handles persistence');

    return {
      response: responseText,
      success: true,
      model: 'claude-3-5-sonnet-20241022',
      usage: claudeData.usage,
      mode: detectedMode,
      intent: detectedMode
    };

  } catch (error) {
    console.error('❌ BACKEND WORKER: Claude error:', error);
    return {
      success: false,
      error: error.message,
      response: language === 'ar' ? 'أعتذر، حدث خطأ في معالجة طلبك.' : 'I apologize, there was an error processing your request.',
      intent: 'chat'
    };
  }
}
