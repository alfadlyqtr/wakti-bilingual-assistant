
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const MONTHLY_BROWSING_LIMIT = 60; // Monthly limit for browsing quota
const QUOTA_WARNING_THRESHOLD = 0.8; // 80% threshold for showing confirmation

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔍 WAKTI AI V2.1 Enhanced: Processing unified request with smart browsing");
    
    const { message, userId, language = 'en', context, conversationId, inputType = 'text', forceBrowsing = false, confirmSearch = false } = await req.json();

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

    // Get conversation history for better context
    let conversationHistory = [];
    if (conversationId) {
      const { data: historyData } = await supabase
        .from('ai_chat_history')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(10); // Last 10 messages for context
      
      conversationHistory = historyData || [];
    }

    // Enhanced intent detection with improved browsing triggers
    const intent = await detectEnhancedIntent(message, language);
    console.log("🔍 Enhanced intent analysis:", intent);

    // Check browsing quota if browsing is required or forced
    let browsingData = null;
    let quotaStatus = null;
    let shouldBrowse = intent.requiresBrowsing || forceBrowsing;
    let requiresSearchConfirmation = false;

    if (shouldBrowse && TAVILY_API_KEY) {
      quotaStatus = await checkBrowsingQuota(supabase, userId);
      console.log("🔍 Browsing quota status:", quotaStatus);

      const usagePercentage = quotaStatus.usagePercentage / 100; // Convert to decimal

      // Check if we're at or above 80% threshold
      if (usagePercentage >= QUOTA_WARNING_THRESHOLD) {
        if (confirmSearch) {
          // User has confirmed the search, proceed
          console.log("🔍 User confirmed search at 80%+ quota - proceeding with browsing");
          browsingData = await performTavilySearch(message, language);
          
          if (browsingData) {
            await logBrowsingUsage(supabase, userId);
            console.log("🔍 Confirmed browsing completed and logged");
          }
        } else if (quotaStatus.usagePercentage >= 100) {
          // At 100% quota - no search option
          console.log("🔍 100% quota reached - no browsing available");
          requiresSearchConfirmation = false;
        } else {
          // At 80%+ but less than 100% - require confirmation
          console.log("🔍 80% quota threshold reached - requiring user confirmation");
          requiresSearchConfirmation = true;
        }
      } else {
        // Below 80% threshold - auto-browse as normal
        console.log("🔍 Below 80% quota - auto-browsing enabled");
        browsingData = await performTavilySearch(message, language);
        
        if (browsingData) {
          await logBrowsingUsage(supabase, userId);
          console.log("🔍 Auto-browsing completed and logged");
        }
      }
    }

    // Create enhanced system prompt with conversation history and browsing context
    const systemPrompt = createEnhancedSystemPrompt(
      intent, 
      language, 
      context, 
      browsingData, 
      quotaStatus,
      conversationHistory,
      requiresSearchConfirmation
    );

    // Process with AI
    const aiResponse = await callAIService(systemPrompt, message, intent, conversationHistory);
    
    // Save conversation to database
    await saveConversationMessage(supabase, userId, conversationId, message, aiResponse, intent, browsingData, quotaStatus, inputType);

    const response = {
      response: aiResponse,
      intent: intent.type,
      confidence: intent.confidence,
      browsingUsed: !!browsingData,
      browsingData: browsingData ? {
        hasResults: true,
        imageUrl: browsingData.imageUrl,
        sources: browsingData.sources
      } : null,
      quotaStatus: quotaStatus,
      requiresSearchConfirmation: requiresSearchConfirmation
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

// Enhanced intent detection with improved browsing triggers
async function detectEnhancedIntent(message: string, language: string) {
  const lowerMessage = message.toLowerCase();
  
  // Enhanced real-time browsing patterns - more aggressive detection
  const browsingPatterns = [
    // Sports & scores - enhanced
    'who won', 'game score', 'latest score', 'final score', 'match result', 'score',
    'sports news', 'game last night', 'game tonight', 'game today', 'football', 'soccer',
    'basketball', 'baseball', 'tennis', 'cricket', 'rugby', 'hockey', 'golf',
    'premier league', 'champions league', 'world cup', 'olympics', 'nfl', 'nba', 'fifa',
    'player stats', 'team standings', 'league table', 'tournament', 'championship',
    // News & current events - enhanced
    'latest news', 'breaking news', 'current events', 'what happened', 'recent',
    'news today', 'headlines', 'update on', 'current situation', 'latest update',
    // Weather - enhanced
    'weather today', 'current weather', 'forecast', 'temperature', 'rain', 'sunny',
    'climate', 'weather in', 'hot', 'cold', 'storm', 'hurricane',
    // Stocks & markets - enhanced
    'stock price', 'market today', 'stock market', 'price of', 'crypto', 'bitcoin',
    'exchange rate', 'currency', 'trading', 'dow jones', 'nasdaq', 's&p 500',
    // General current info - enhanced
    'current', 'latest', 'recent', 'now', 'today', 'this week', 'happening',
    'status of', 'update', 'information about', 'tell me about',
    // Technology & trends
    'new release', 'latest version', 'tech news', 'gadget', 'smartphone',
    // Arabic equivalents - enhanced
    'من فاز', 'نتيجة المباراة', 'آخر الأخبار', 'الطقس اليوم', 'سعر السهم',
    'أخبار', 'جديد', 'حالي', 'اليوم', 'الآن', 'مؤخراً'
  ];

  // Check for browsing requirement with lower threshold
  const requiresBrowsing = browsingPatterns.some(pattern => lowerMessage.includes(pattern)) ||
    // Also check if message contains question words + current context
    (lowerMessage.includes('what') && (lowerMessage.includes('current') || lowerMessage.includes('latest') || lowerMessage.includes('now'))) ||
    (lowerMessage.includes('how') && (lowerMessage.includes('today') || lowerMessage.includes('recent'))) ||
    // Check for any sports team names or events
    /\b(madrid|barcelona|manchester|chelsea|arsenal|liverpool|united|city|psg|bayern|juventus|milan|inter)\b/i.test(lowerMessage) ||
    // Check for current year mentions
    lowerMessage.includes('2025') ||
    // Check for temporal indicators
    /\b(today|yesterday|this week|last night|recently|currently)\b/i.test(lowerMessage);

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
      return { count: 0, usagePercentage: 0, remaining: MONTHLY_BROWSING_LIMIT, limit: MONTHLY_BROWSING_LIMIT };
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
    return { count: 0, usagePercentage: 0, remaining: MONTHLY_BROWSING_LIMIT, limit: MONTHLY_BROWSING_LIMIT };
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

// Enhanced system prompt creation with conversation history
function createEnhancedSystemPrompt(
  intent: any, 
  language: string, 
  context: any, 
  browsingData: any,
  quotaStatus: any,
  conversationHistory: any[],
  requiresSearchConfirmation: boolean
) {
  const basePrompt = language === 'ar' 
    ? `أنت WAKTI AI V2.1، الدماغ الذكي المتطور لتطبيق وكتي. أنت مساعد قوي وودود يساعد في إدارة المهام والأحداث والمحتوى والمزيد. تتذكر المحادثات السابقة وتحافظ على السياق.`
    : `You are WAKTI AI V2.1, the advanced intelligent brain of the Wakti app. You are a powerful and friendly assistant that helps manage tasks, events, content, and much more. You remember previous conversations and maintain context.`;

  let prompt = basePrompt;

  // Add conversation history for context
  if (conversationHistory.length > 0) {
    const historyContext = language === 'ar'
      ? `\n\n📜 سياق المحادثة السابقة:\n${conversationHistory.map(h => `${h.role === 'user' ? 'المستخدم' : 'WAKTI AI'}: ${h.content}`).join('\n')}\n\nاستخدم هذا السياق للإجابة بشكل متسق ومترابط.`
      : `\n\n📜 Previous conversation context:\n${conversationHistory.map(h => `${h.role === 'user' ? 'User' : 'WAKTI AI'}: ${h.content}`).join('\n')}\n\nUse this context to provide consistent and connected responses.`;
    
    prompt += historyContext;
  }

  // Add browsing context or search confirmation notice
  if (browsingData) {
    const browsingContext = language === 'ar'
      ? `\n\n🔍 معلومات حديثة من البحث:\n${browsingData.answer}\n\nمصادر: ${browsingData.sources.map((s: any) => s.title).join(', ')}\n\nاستخدم هذه المعلومات الحديثة مباشرة في إجابتك. البحث تم بالفعل.`
      : `\n\n🔍 Current real-time information from search:\n${browsingData.answer}\n\nSources: ${browsingData.sources.map((s: any) => s.title).join(', ')}\n\nUse this current information directly in your response. Search has already been performed.`;
    
    prompt += browsingContext;
  } else if (requiresSearchConfirmation) {
    const confirmationContext = language === 'ar'
      ? `\n\n⚠️ تنبيه: يمكن الحصول على معلومات حديثة من الإنترنت ولكن المستخدم قارب من الوصول لحد البحث الشهري. اجب على السؤال بناءً على معرفتك التدريبية وأذكر أنه يمكن البحث للحصول على معلومات أحدث إذا رغب المستخدم.`
      : `\n\n⚠️ Notice: Current information from the internet could be retrieved, but the user is approaching their monthly search limit. Answer based on your training knowledge and mention that searching for more current information is available if the user wants it.`;
    
    prompt += confirmationContext;
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
      real_time_query: "User needs current information. Provide accurate, up-to-date answers with sources when available.",
      general_chat: "Provide helpful, conversational responses while maintaining context from previous messages."
    },
    ar: {
      task_creation: "يريد المستخدم إنشاء مهمة. استخرج وأكد تفاصيل المهمة بوضوح.",
      event_creation: "يريد المستخدم إنشاء حدث. استخرج وأكد تفاصيل الحدث بوضوح.",
      image_generation: "يريد المستخدم إنشاء صورة. اصنع موجه مفصل وإبداعي.",
      real_time_query: "يحتاج المستخدم معلومات حديثة. قدم إجابات دقيقة ومحدثة مع المصادر عند توفرها.",
      general_chat: "قدم ردود مفيدة ومحادثة مع الحفاظ على السياق من الرسائل السابقة."
    }
  };
  
  return prompts[language][intentType] || prompts[language].general_chat;
}

// Enhanced AI service calling with conversation history
async function callAIService(systemPrompt: string, message: string, intent: any, conversationHistory: any[]) {
  try {
    // Build messages array with history
    const messages = [
      { role: "system", content: systemPrompt }
    ];

    // Add recent conversation history (last 6 messages to avoid token limits)
    const recentHistory = conversationHistory.slice(-6);
    for (const hist of recentHistory) {
      messages.push({
        role: hist.role,
        content: hist.content
      });
    }

    // Add current message
    messages.push({ role: "user", content: message });

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
          messages: messages,
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
          messages: messages,
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

// Save conversation message to database
async function saveConversationMessage(
  supabase: any, 
  userId: string, 
  conversationId: string | null, 
  userMessage: string, 
  aiResponse: string, 
  intent: any, 
  browsingData: any, 
  quotaStatus: any, 
  inputType: string
) {
  try {
    // Create or get conversation
    let currentConversationId = conversationId;
    
    if (!currentConversationId) {
      // Create new conversation
      const conversationTitle = userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');
      const { data: newConversation, error: convError } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: userId,
          title: conversationTitle,
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();

      if (convError) throw convError;
      currentConversationId = newConversation.id;
    } else {
      // Update existing conversation timestamp
      await supabase
        .from('ai_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', currentConversationId);
    }

    // Save user message
    await supabase
      .from('ai_chat_history')
      .insert({
        conversation_id: currentConversationId,
        user_id: userId,
        role: 'user',
        content: userMessage,
        input_type: inputType,
        intent: intent.type,
        confidence_level: intent.confidence
      });

    // Save AI response
    await supabase
      .from('ai_chat_history')
      .insert({
        conversation_id: currentConversationId,
        user_id: userId,
        role: 'assistant',
        content: aiResponse,
        intent: intent.type,
        confidence_level: intent.confidence,
        browsing_used: !!browsingData,
        browsing_data: browsingData,
        quota_status: quotaStatus
      });

    return currentConversationId;
  } catch (error) {
    console.error("Error saving conversation:", error);
    return conversationId;
  }
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
