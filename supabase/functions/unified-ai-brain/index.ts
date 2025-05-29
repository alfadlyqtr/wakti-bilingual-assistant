
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const MONTHLY_BROWSING_LIMIT = 65; // Monthly limit for browsing quota

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔍 WAKTI AI V2.1 Enhanced: Processing unified request with smart browsing");
    
    const { message, userId, language = 'en', context, conversationId, inputType = 'text' } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Enhanced intent detection with browsing capability
    const intent = await detectEnhancedIntent(message, language);
    console.log("🔍 Enhanced intent analysis:", intent);

    // Check browsing quota if browsing is required
    let browsingData = null;
    let quotaStatus = null;
    let shouldConfirmBrowsing = false;

    if (intent.requiresBrowsing && TAVILY_API_KEY) {
      quotaStatus = await checkBrowsingQuota(supabase, userId);
      console.log("🔍 Browsing quota status:", quotaStatus);

      if (quotaStatus.usagePercentage >= 65) {
        // High usage - require confirmation
        shouldConfirmBrowsing = true;
        console.log("🔍 High quota usage - requiring confirmation");
      } else {
        // Auto-browse for low usage
        console.log("🔍 Auto-browsing enabled - fetching data");
        browsingData = await performTavilySearch(message, language);
        
        if (browsingData) {
          // Log usage
          await logBrowsingUsage(supabase, userId);
        }
      }
    }

    // Create enhanced system prompt with browsing context
    const systemPrompt = createEnhancedSystemPrompt(
      intent, 
      language, 
      context, 
      browsingData, 
      shouldConfirmBrowsing,
      quotaStatus
    );

    // Process with AI
    const aiResponse = await callAIService(systemPrompt, message, intent);
    
    // Generate enhanced actions and response
    const actions = generateEnhancedActions(intent, aiResponse, language, shouldConfirmBrowsing);
    
    // Generate auto-actions for immediate execution
    const autoActions = generateAutoActions(intent, aiResponse, browsingData);

    const response = {
      response: aiResponse,
      intent: intent.type,
      actions: actions,
      autoActions: autoActions,
      confidence: intent.confidence,
      type: 'text',
      provider: 'deepseek',
      browsingUsed: !!browsingData,
      browsingConfirmRequired: shouldConfirmBrowsing,
      quotaStatus: quotaStatus,
      browsingData: browsingData ? {
        hasResults: true,
        imageUrl: browsingData.imageUrl,
        sources: browsingData.sources
      } : null
    };

    console.log("🔍 WAKTI AI V2.1 Enhanced: Response ready with smart browsing");

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("❌ Error in unified-ai-brain function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// Enhanced intent detection with browsing triggers
async function detectEnhancedIntent(message: string, language: string) {
  const lowerMessage = message.toLowerCase();
  
  // Real-time browsing patterns
  const browsingPatterns = [
    // Sports & scores
    'who won', 'game score', 'latest score', 'final score', 'match result',
    'sports news', 'game last night', 'game tonight', 'game today',
    // News & current events  
    'latest news', 'breaking news', 'current events', 'what happened',
    'news today', 'recent news', 'headlines',
    // Weather
    'weather today', 'current weather', 'forecast', 'temperature',
    // Stocks & markets
    'stock price', 'market today', 'stock market', 'price of',
    // General current info
    'current', 'latest', 'recent', 'now', 'today', 'this week',
    // Arabic equivalents
    'من فاز', 'نتيجة المباراة', 'آخر الأخبار', 'الطقس اليوم', 'سعر السهم'
  ];

  const requiresBrowsing = browsingPatterns.some(pattern => lowerMessage.includes(pattern));

  // Task creation patterns
  const taskPatterns = [
    'create task', 'add task', 'new task', 'make task', 'todo', 'task for',
    'أنشئ مهمة', 'أضف مهمة', 'مهمة جديدة', 'اصنع مهمة', 'مهمة لـ'
  ];
  
  // Event/Calendar patterns
  const eventPatterns = [
    'schedule', 'create event', 'add event', 'appointment', 'meeting', 'calendar',
    'event for', 'plan event', 'organize event',
    'جدول', 'أنشئ حدث', 'أضف حدث', 'موعد', 'اجتماع', 'تقويم', 'حدث لـ'
  ];
  
  // Image generation patterns
  const imagePatterns = [
    'generate image', 'create image', 'draw', 'picture', 'visualize', 'make image',
    'paint', 'illustration', 'artwork', 'design',
    'أنشئ صورة', 'اصنع صورة', 'ارسم', 'صورة', 'تصور', 'لوحة'
  ];

  // Determine intent type and confidence
  if (taskPatterns.some(pattern => lowerMessage.includes(pattern))) {
    return { 
      type: 'task_creation', 
      confidence: 'high',
      requiresBrowsing: false,
      data: extractTaskData(message)
    };
  }
  
  if (eventPatterns.some(pattern => lowerMessage.includes(pattern))) {
    return { 
      type: 'event_creation', 
      confidence: 'high',
      requiresBrowsing: false,
      data: extractEventData(message)
    };
  }
  
  if (imagePatterns.some(pattern => lowerMessage.includes(pattern))) {
    return { 
      type: 'image_generation', 
      confidence: 'high',
      requiresBrowsing: false,
      data: { prompt: extractImagePrompt(message) }
    };
  }

  if (requiresBrowsing) {
    return {
      type: 'real_time_query',
      confidence: 'high',
      requiresBrowsing: true,
      data: { query: message }
    };
  }
  
  // Default to general chat
  return { 
    type: 'general_chat', 
    confidence: 'medium',
    requiresBrowsing: false,
    data: null
  };
}

// Check browsing quota and usage percentage
async function checkBrowsingQuota(supabase: any, userId: string) {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    
    const { data, error } = await supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('has_browsing', true)
      .eq('month_year', currentMonth);

    if (error) {
      console.error("Error checking browsing quota:", error);
      return { count: 0, usagePercentage: 0, remaining: MONTHLY_BROWSING_LIMIT };
    }

    const count = data?.length || 0;
    const usagePercentage = Math.round((count / MONTHLY_BROWSING_LIMIT) * 100);
    const remaining = Math.max(0, MONTHLY_BROWSING_LIMIT - count);

    return {
      count,
      usagePercentage,
      remaining,
      limit: MONTHLY_BROWSING_LIMIT
    };
  } catch (error) {
    console.error("Error in quota check:", error);
    return { count: 0, usagePercentage: 0, remaining: MONTHLY_BROWSING_LIMIT };
  }
}

// Log browsing usage
async function logBrowsingUsage(supabase: any, userId: string) {
  try {
    const { error } = await supabase
      .from('ai_usage_logs')
      .insert({
        user_id: userId,
        model_used: 'tavily_search',
        has_browsing: true,
        month_year: new Date().toISOString().slice(0, 7)
      });

    if (error) {
      console.error("Error logging browsing usage:", error);
    }
  } catch (error) {
    console.error("Error in usage logging:", error);
  }
}

// Perform Tavily search with image extraction
async function performTavilySearch(query: string, language: string) {
  try {
    console.log("🔍 Performing Tavily search for:", query);
    
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query: query,
        search_depth: "basic",
        include_images: true,
        include_answer: true,
        max_results: 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("🔍 Tavily search completed successfully");

    // Extract the best image from results
    let imageUrl = null;
    if (data.images && data.images.length > 0) {
      imageUrl = data.images[0]; // First image is usually most relevant
    }

    return {
      answer: data.answer || "",
      results: data.results || [],
      imageUrl: imageUrl,
      sources: data.results?.slice(0, 3).map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.content?.substring(0, 150) + "..."
      })) || []
    };
  } catch (error) {
    console.error("🔍 Tavily search error:", error);
    return null;
  }
}

// Enhanced system prompt creation
function createEnhancedSystemPrompt(
  intent: any, 
  language: string, 
  context: any, 
  browsingData: any,
  shouldConfirmBrowsing: boolean,
  quotaStatus: any
) {
  const basePrompt = language === 'ar' 
    ? `أنت WAKTI AI V2.1، الدماغ الذكي المتطور لتطبيق وكتي. أنت مساعد قوي وودود يساعد في إدارة المهام والأحداث والمحتوى والمزيد.`
    : `You are WAKTI AI V2.1, the advanced intelligent brain of the Wakti app. You are a powerful and friendly assistant that helps manage tasks, events, content, and much more.`;

  let prompt = basePrompt;

  // Add browsing context
  if (browsingData) {
    const browsingContext = language === 'ar'
      ? `\n\n🔍 معلومات حديثة من البحث:\n${browsingData.answer}\n\nمصادر: ${browsingData.sources.map((s: any) => s.title).join(', ')}\n\nاستخدم هذه المعلومات الحديثة مباشرة في إجابتك. لا تسأل عن البحث - قد تم بالفعل.`
      : `\n\n🔍 Current real-time information from search:\n${browsingData.answer}\n\nSources: ${browsingData.sources.map((s: any) => s.title).join(', ')}\n\nUse this current information directly in your response. Do not ask about searching - it has already been done.`;
    
    prompt += browsingContext;
  } else if (shouldConfirmBrowsing && quotaStatus) {
    const confirmContext = language === 'ar'
      ? `\n\n⚠️ تحتاج معلومات حديثة للإجابة بدقة. اسأل المستخدم إذا كان يريد البحث. استخدمت ${quotaStatus.count}/${quotaStatus.limit} من عمليات البحث هذا الشهر.`
      : `\n\n⚠️ Current information needed for accurate response. Ask user if they want to search. You've used ${quotaStatus.count}/${quotaStatus.limit} searches this month.`;
    
    prompt += confirmContext;
  }

  // Add intent-specific instructions
  const intentPrompt = getIntentPrompt(intent.type, language);
  prompt += `\n\n${intentPrompt}`;

  if (context) {
    prompt += `\n\nUser Context: ${JSON.stringify(context)}`;
  }

  return prompt;
}

// Get intent-specific prompts
function getIntentPrompt(intentType: string, language: string) {
  const prompts = {
    en: {
      task_creation: "User wants to create a task. Extract and confirm task details clearly.",
      event_creation: "User wants to create an event. Extract and confirm event details clearly.", 
      image_generation: "User wants to generate an image. Create a detailed, creative prompt.",
      real_time_query: "User needs current information. Provide accurate, up-to-date answers with sources.",
      general_chat: "Provide helpful, conversational responses with actionable suggestions when appropriate."
    },
    ar: {
      task_creation: "يريد المستخدم إنشاء مهمة. استخرج وأكد تفاصيل المهمة بوضوح.",
      event_creation: "يريد المستخدم إنشاء حدث. استخرج وأكد تفاصيل الحدث بوضوح.",
      image_generation: "يريد المستخدم إنشاء صورة. اصنع موجه مفصل وإبداعي.",
      real_time_query: "يحتاج المستخدم معلومات حديثة. قدم إجابات دقيقة ومحدثة مع المصادر.",
      general_chat: "قدم ردود مفيدة ومحادثة مع اقتراحات قابلة للتنفيذ عند الحاجة."
    }
  };
  
  return prompts[language][intentType] || prompts[language].general_chat;
}

// Enhanced AI service calling
async function callAIService(systemPrompt: string, message: string, intent: any) {
  try {
    // Try DeepSeek first
    if (DEEPSEEK_API_KEY) {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return result.choices[0].message?.content || "";
      }
    }
    
    // Fallback to OpenAI
    if (OPENAI_API_KEY) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      const result = await response.json();
      return result.choices[0].message?.content || "";
    }
    
    throw new Error("No AI service available");
    
  } catch (error) {
    console.error("AI service error:", error);
    throw error;
  }
}

// Enhanced action generation
function generateEnhancedActions(intent: any, aiResponse: string, language: string, shouldConfirmBrowsing: boolean) {
  const actions = [];
  
  // Add search confirmation button if needed
  if (shouldConfirmBrowsing) {
    actions.push({
      text: language === 'ar' ? '🔍 بحث' : '🔍 Search',
      id: 'confirm_search',
      variant: 'secondary',
      data: { query: intent.data?.query }
    });
  }

  // Standard actions based on intent
  switch (intent.type) {
    case 'task_creation':
      actions.push({
        text: language === 'ar' ? 'إنشاء المهمة' : 'Create Task',
        id: 'create_task',
        variant: 'default',
        data: intent.data
      });
      break;
      
    case 'event_creation':
      actions.push({
        text: language === 'ar' ? 'إنشاء الحدث' : 'Create Event',
        id: 'create_event',
        variant: 'default',
        data: intent.data
      });
      break;
      
    case 'image_generation':
      actions.push({
        text: language === 'ar' ? 'إنشاء الصورة' : 'Generate Image',
        id: 'generate_image',
        variant: 'default',
        data: intent.data
      });
      break;
  }
  
  return actions;
}

// Auto-actions for immediate execution
function generateAutoActions(intent: any, aiResponse: string, browsingData: any) {
  const autoActions = [];
  
  if (intent.confidence === 'high') {
    switch (intent.type) {
      case 'image_generation':
        autoActions.push({
          type: 'generate_image',
          prompt: intent.data.prompt
        });
        break;
    }
  }
  
  return autoActions;
}

// Data extraction functions
function extractTaskData(message: string) {
  const title = message.replace(/create task|add task|new task|make task|أنشئ مهمة|أضف مهمة/gi, '').trim();
  return {
    title: title || 'New Task',
    description: '',
    priority: 'medium',
    dueDate: null,
    subtasks: []
  };
}

function extractEventData(message: string) {
  const title = message.replace(/schedule|create event|add event|جدول|أنشئ حدث/gi, '').trim();
  return {
    title: title || 'New Event',
    description: '',
    startTime: null,
    endTime: null,
    location: '',
    attendees: []
  };
}

function extractImagePrompt(message: string) {
  const prompt = message.replace(/generate image|create image|draw|make image|أنشئ صورة|ارسم/gi, '').trim();
  return prompt || 'beautiful artwork';
}
