import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Add API keys for real AI integration
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

console.log("🚀 WAKTI AI V2 BRAIN: Phase 4 - Advanced Integration & Automation");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 WAKTI AI V2 BRAIN: Processing Phase 4 request");

    // Get request body
    const requestBody = await req.json();
    console.log("🚀 WAKTI AI V2 BRAIN: Request body received:", requestBody);

    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      conversationHistory = [],
      confirmSearch = false,
      activeTrigger = 'chat',
      textGenParams = null,
      attachedFiles = [],
      // Phase 4: Advanced context
      calendarContext = null,
      userContext = null,
      enableAdvancedIntegration = false,
      enablePredictiveInsights = false,
      enableWorkflowAutomation = false
    } = requestBody;

    // Validate required fields
    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.error("🚀 WAKTI AI V2 BRAIN: Invalid message field");
      return new Response(JSON.stringify({ 
        error: "Message is required and must be a non-empty string",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!userId) {
      console.error("🚀 WAKTI AI V2 BRAIN: Missing userId");
      return new Response(JSON.stringify({ 
        error: "User ID is required",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("🚀 WAKTI AI V2 BRAIN: Processing message for user:", userId);
    console.log("🚀 WAKTI AI V2 BRAIN: Active trigger mode:", activeTrigger);
    console.log("🚀 WAKTI AI V2 BRAIN: Phase 4 features enabled:", {
      advancedIntegration: enableAdvancedIntegration,
      predictiveInsights: enablePredictiveInsights,
      workflowAutomation: enableWorkflowAutomation
    });

    // Phase 4: Enhanced context gathering
    let enhancedContext = '';
    let deepIntegration = null;
    let automationSuggestions = [];
    let predictiveInsights = null;
    let workflowActions = [];
    let contextualActions = [];

    if (enableAdvancedIntegration) {
      // Gather enhanced context from calendar and user data
      if (calendarContext) {
        enhancedContext += `\n\nCALENDAR CONTEXT:\n`;
        enhancedContext += `Current time: ${calendarContext.currentDateTime}\n`;
        enhancedContext += `Upcoming tasks: ${JSON.stringify(calendarContext.upcomingTasks)}\n`;
        enhancedContext += `Upcoming events: ${JSON.stringify(calendarContext.upcomingEvents)}\n`;
        enhancedContext += `Upcoming reminders: ${JSON.stringify(calendarContext.upcomingReminders)}\n`;
      }

      if (userContext) {
        enhancedContext += `\n\nUSER CONTEXT:\n`;
        enhancedContext += `Productivity patterns: ${JSON.stringify(userContext.productivityPatterns)}\n`;
        enhancedContext += `User preferences: ${JSON.stringify(userContext.preferences)}\n`;
      }
    }

    // Enforce trigger isolation with Phase 4 enhancements
    const intent = await analyzeTriggerIntentAdvanced(message, activeTrigger, language, enhancedContext);
    console.log("🚀 WAKTI AI V2 BRAIN: Advanced trigger analysis result:", intent);

    // Generate response based on trigger isolation with PHASE 4 AI
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let actionTaken = null;
    let actionResult = null;

    // Get real quota status from database
    quotaStatus = await checkBrowsingQuota(userId);

    switch (activeTrigger) {
      case 'search':
        if (intent.allowed) {
          if (quotaStatus.canBrowse && (confirmSearch || !quotaStatus.requiresConfirmation)) {
            // Real search functionality with Phase 4 enhancements
            const searchResult = await executeAdvancedSearch(message, language, enhancedContext);
            if (searchResult.success) {
              browsingUsed = true;
              browsingData = searchResult.data;
              response = await processWithAdvancedAI(message, searchResult.context, language, enhancedContext);
              
              // Phase 4: Generate contextual actions
              contextualActions = generateContextualActions(message, searchResult, userContext);
            } else {
              response = await processWithAdvancedAI(message, null, language, enhancedContext);
            }
          } else if (quotaStatus.requiresConfirmation && !confirmSearch) {
            response = language === 'ar' 
              ? `لقد استخدمت ${quotaStatus.count} من ${quotaStatus.limit} عملية بحث شهرية (${quotaStatus.usagePercentage}%). هل تريد المتابعة بالبحث عن معلومات حديثة؟`
              : `You've used ${quotaStatus.count} of ${quotaStatus.limit} monthly searches (${quotaStatus.usagePercentage}%). Do you want to proceed with searching for current information?`;
          } else {
            response = language === 'ar' 
              ? `لقد وصلت إلى حد البحث الشهري (${quotaStatus.limit}). يمكنني الإجابة على أسئلة عامة.`
              : `You've reached your monthly search limit (${quotaStatus.limit}). I can answer general questions.`;
          }
        } else {
          response = language === 'ar' 
            ? `⚠️ أنت في وضع البحث\n\nهذا الوضع مخصص للبحث والمعلومات الحديثة فقط.\n\nللدردشة العامة، انتقل إلى وضع المحادثة.`
            : `⚠️ You're in Search Mode\n\nThis mode is for search and current information only.\n\nFor general chat, switch to Chat mode.`;
        }
        break;

      case 'image':
        if (intent.allowed) {
          response = language === 'ar' 
            ? `🎨 وضع إنشاء الصور النشط\n\nسأنشئ صورة: "${message}"\n\n[إنشاء الصور معطل حالياً في النسخة التجريبية]`
            : `🎨 Image Generation Mode Active\n\nGenerating image: "${message}"\n\n[Image generation disabled in demo version]`;
          // imageUrl would be set here in real implementation
        } else {
          response = language === 'ar' 
            ? `⚠️ أنت في وضع إنشاء الصور\n\nهذا الوضع مخصص لإنشاء الصور فقط.\n\nللدردشة العامة، انتقل إلى وضع المحادثة.`
            : `⚠️ You're in Image Mode\n\nThis mode is for image generation only.\n\nFor general chat, switch to Chat mode.`;
        }
        break;

      case 'advanced_search':
        response = language === 'ar' 
          ? `🔮 وضع البحث المتقدم\n\nهذه الميزة قيد التطوير.\n\nيرجى استخدام وضع البحث العادي أو المحادثة.`
          : `🔮 Advanced Search Mode\n\nThis feature is coming soon.\n\nPlease use regular Search or Chat mode.`;
        break;

      case 'chat':
      default:
        // Chat mode - use Phase 4 advanced AI
        const aiResult = await processWithAdvancedAI(message, null, language, enhancedContext);
        response = aiResult.response || aiResult;
        actionTaken = aiResult.actionTaken;
        actionResult = aiResult.actionResult;

        // Phase 4: Advanced automation and intelligence
        if (enablePredictiveInsights) {
          predictiveInsights = await generatePredictiveInsights(message, userContext, calendarContext);
        }

        if (enableWorkflowAutomation) {
          workflowActions = await generateWorkflowAutomation(message, userContext, calendarContext);
          automationSuggestions = await generateAutomationSuggestions(message, userContext);
        }

        // Generate contextual quick actions
        contextualActions = generateContextualActions(message, { context: enhancedContext }, userContext);
        break;
    }

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: intent.intent,
      confidence: intent.confidence,
      actionTaken,
      actionResult,
      imageUrl,
      browsingUsed,
      browsingData,
      quotaStatus,
      requiresSearchConfirmation: quotaStatus?.requiresConfirmation && !confirmSearch,
      needsConfirmation: false,
      needsClarification: false,
      // Phase 4: Advanced features
      deepIntegration,
      automationSuggestions,
      predictiveInsights,
      workflowActions,
      contextualActions,
      success: true
    };

    console.log("🚀 WAKTI AI V2 BRAIN: Sending Phase 4 advanced response:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🚀 WAKTI AI V2 BRAIN: Error processing request:", error);
    
    const errorResponse = {
      error: error.message || 'Unknown error occurred',
      success: false
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// Phase 4: Advanced AI processing function
async function processWithAdvancedAI(message: string, context: string | null, language: string = 'en', enhancedContext: string = '') {
  try {
    console.log("🤖 WAKTI AI V2 BRAIN: Processing with Phase 4 advanced AI");
    
    // Try DeepSeek first, fallback to OpenAI
    let apiKey = DEEPSEEK_API_KEY;
    let apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    let model = 'deepseek-chat';
    
    if (!apiKey) {
      apiKey = OPENAI_API_KEY;
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      model = 'gpt-4o-mini';
    }
    
    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة مع قدرات متطورة في Phase 4:

PHASE 4 - التكامل المتقدم والأتمتة:
- تكامل عميق مع التقويم والمهام والتذكيرات
- اقتراحات جدولة ذكية بناءً على التوفر
- أتمتة متقدمة للمهام والأولويات
- رؤى تنبؤية لسلوك المستخدم
- إجراءات سياقية ذكية

المهارات المتقدمة:
✅ إنشاء مهام ذكية مع التوقيت الأمثل
✅ اقتراح جدولة بناءً على الأنماط
✅ تحليل النشاط التنبؤي
✅ أتمتة سير العمل
✅ تحسين الإنتاجية

كن ذكياً وسياقياً ومفيداً في إجاباتك.`
      : `You are WAKTI, an advanced AI assistant with Phase 4 capabilities:

PHASE 4 - ADVANCED INTEGRATION & AUTOMATION:
- Deep integration with calendar, tasks, and reminders
- Smart scheduling suggestions based on availability
- Advanced automation for tasks and priorities  
- Predictive insights for user behavior
- Context-aware intelligent actions

Advanced capabilities:
✅ Create smart tasks with optimal timing
✅ Suggest scheduling based on patterns
✅ Predictive activity analysis
✅ Workflow automation
✅ Productivity optimization

Be intelligent, contextual, and helpful in your responses.`;
    
    const messages = [
      { role: 'system', content: systemPrompt + (enhancedContext ? `\n\nCONTEXT:\n${enhancedContext}` : '') },
      { role: 'user', content: message }
    ];
    
    if (context) {
      messages.splice(1, 0, { role: 'assistant', content: `Additional Context: ${context}` });
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1500
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }
    
    const result = await response.json();
    const aiResponse = result.choices[0].message.content;
    
    // Phase 4: Analyze response for advanced actions
    const actionAnalysis = await analyzeForAdvancedActions(message, aiResponse, language);
    
    return {
      response: aiResponse,
      actionTaken: actionAnalysis.actionTaken,
      actionResult: actionAnalysis.actionResult
    };
    
  } catch (error) {
    console.error("🤖 WAKTI AI V2 BRAIN: AI processing error:", error);
    
    // Fallback response
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
  }
}

// Phase 4: Advanced search function
async function executeAdvancedSearch(query: string, language: string = 'en', enhancedContext: string = '') {
  try {
    if (!TAVILY_API_KEY) {
      return { success: false, error: "Search not configured" };
    }
    
    // Enhanced search query with context
    const enhancedQuery = enhancedContext ? `${query} (Context: ${enhancedContext.substring(0, 200)})` : query;
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: enhancedQuery,
        search_depth: "advanced", // Phase 4: Advanced search
        include_answer: true,
        include_raw_content: true,
        max_results: 5
      })
    });
    
    if (!response.ok) {
      return { success: false, error: "Search failed" };
    }
    
    const data = await response.json();
    return {
      success: true,
      context: data.answer,
      data: { 
        sources: data.results || [],
        rawContent: data.raw_content,
        enhanced: true
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Phase 4: Advanced functions
async function generatePredictiveInsights(message: string, userContext: any, calendarContext: any) {
  if (!userContext?.productivityPatterns) return null;
  
  const insights = {
    optimalTaskTime: userContext.productivityPatterns.mostActiveHours,
    suggestedPriority: userContext.productivityPatterns.preferredPriority,
    expectedDuration: userContext.productivityPatterns.averageTaskDuration,
    conflictWarnings: detectScheduleConflicts(calendarContext),
    productivityTrends: analyzeProductivityTrends(userContext)
  };
  
  return insights;
}

async function generateWorkflowAutomation(message: string, userContext: any, calendarContext: any) {
  const automations = [];
  
  // Smart scheduling automation
  if (message.toLowerCase().includes('schedule') || message.toLowerCase().includes('meeting')) {
    automations.push({
      type: 'smart_scheduling',
      suggestion: 'Auto-schedule based on availability',
      action: 'suggest_optimal_times'
    });
  }
  
  // Task grouping automation
  if (message.toLowerCase().includes('task') || message.toLowerCase().includes('todo')) {
    automations.push({
      type: 'task_grouping',
      suggestion: 'Group similar tasks for batch processing',
      action: 'create_task_batch'
    });
  }
  
  return automations;
}

async function generateAutomationSuggestions(message: string, userContext: any) {
  const suggestions = [];
  
  if (userContext?.productivityPatterns) {
    suggestions.push({
      type: 'productivity_optimization',
      text: `Based on your patterns, schedule important tasks during ${userContext.productivityPatterns.mostActiveHours.join(', ')}:00`
    });
  }
  
  return suggestions;
}

function generateContextualActions(message: string, searchResult: any, userContext: any) {
  const actions = [];
  
  // Calendar integration actions
  if (message.toLowerCase().includes('meeting') || message.toLowerCase().includes('event')) {
    actions.push({
      type: 'create_calendar_event',
      text: 'Create calendar event',
      icon: 'calendar'
    });
  }
  
  // Task creation actions
  if (message.toLowerCase().includes('task') || message.toLowerCase().includes('remind')) {
    actions.push({
      type: 'create_smart_task',
      text: 'Create optimized task',
      icon: 'plus'
    });
  }
  
  // Contact integration actions
  if (message.toLowerCase().includes('contact') || message.toLowerCase().includes('call')) {
    actions.push({
      type: 'find_contact',
      text: 'Find in contacts',
      icon: 'users'
    });
  }
  
  return actions;
}

function detectScheduleConflicts(calendarContext: any) {
  if (!calendarContext) return [];
  
  const conflicts = [];
  const events = [...(calendarContext.upcomingEvents || []), ...(calendarContext.upcomingTasks || [])];
  
  // Simple conflict detection
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const event1 = events[i];
      const event2 = events[j];
      
      // Check for same date conflicts
      if (event1.event_date === event2.event_date || event1.due_date === event2.due_date) {
        conflicts.push({
          type: 'time_conflict',
          events: [event1.title, event2.title],
          date: event1.event_date || event1.due_date
        });
      }
    }
  }
  
  return conflicts;
}

function analyzeProductivityTrends(userContext: any) {
  if (!userContext?.recentActivity) return null;
  
  const trends = {
    taskCreationTrend: 'stable',
    completionRateTrend: 'improving',
    priorityPreferenceTrend: userContext.productivityPatterns?.preferredPriority || 'normal'
  };
  
  return trends;
}

async function analyzeForAdvancedActions(message: string, aiResponse: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  // Advanced action detection
  if (lowerMessage.includes('schedule') && (lowerMessage.includes('meeting') || lowerMessage.includes('event'))) {
    return {
      actionTaken: 'advanced_scheduling',
      actionResult: {
        type: 'calendar_integration',
        suggestion: 'Smart scheduling with conflict detection'
      }
    };
  }
  
  if (lowerMessage.includes('optimize') || lowerMessage.includes('improve productivity')) {
    return {
      actionTaken: 'productivity_optimization',
      actionResult: {
        type: 'workflow_automation',
        suggestions: ['Batch similar tasks', 'Schedule during peak hours', 'Set smart reminders']
      }
    };
  }
  
  return {
    actionTaken: false,
    actionResult: null
  };
}

// Trigger isolation logic
function analyzeTriggerIntent(message: string, activeTrigger: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  console.log("🔍 UNIFIED AI BRAIN: Analyzing trigger intent for:", activeTrigger);
  
  switch (activeTrigger) {
    case 'search':
      const searchPatterns = [
        'what', 'who', 'when', 'where', 'how', 'current', 'latest', 'recent', 'today', 'news',
        'weather', 'score', 'price', 'stock', 'update', 'information', 'find', 'search',
        'ما', 'من', 'متى', 'أين', 'كيف', 'حالي', 'آخر', 'مؤخراً', 'اليوم', 'أخبار',
        'طقس', 'نتيجة', 'سعر', 'معلومات', 'ابحث', 'بحث'
      ];
      
      const isSearchIntent = searchPatterns.some(pattern => lowerMessage.includes(pattern));
      
      return {
        intent: isSearchIntent ? 'real_time_search' : 'invalid_for_search',
        confidence: isSearchIntent ? 'high' : 'low',
        allowed: isSearchIntent
      };

    case 'image':
      const imagePatterns = [
        'generate', 'create', 'make', 'draw', 'image', 'picture', 'photo', 'art', 'illustration',
        'أنشئ', 'اصنع', 'ارسم', 'صورة', 'رسم', 'فن'
      ];
      
      const isImageIntent = imagePatterns.some(pattern => lowerMessage.includes(pattern));
      
      return {
        intent: isImageIntent ? 'generate_image' : 'invalid_for_image',
        confidence: isImageIntent ? 'high' : 'low',
        allowed: isImageIntent
      };

    case 'advanced_search':
      return {
        intent: 'advanced_search_unavailable',
        confidence: 'high',
        allowed: false
      };

    case 'chat':
    default:
      // Chat mode allows everything
      return {
        intent: 'general_chat',
        confidence: 'high',
        allowed: true
      };
  }
}

// Check browsing quota
async function checkBrowsingQuota(userId: string) {
  try {
    const { data, error } = await supabase.rpc('check_browsing_quota', {
      p_user_id: userId
    });
    
    if (error) {
      console.error("Quota check error:", error);
      return { count: 0, limit: 60, canBrowse: true, usagePercentage: 0, remaining: 60 };
    }
    
    const count = data || 0;
    const limit = 60;
    const usagePercentage = Math.round((count / limit) * 100);
    
    return {
      count,
      limit,
      usagePercentage,
      remaining: Math.max(0, limit - count),
      canBrowse: count < limit,
      requiresConfirmation: usagePercentage >= 80
    };
  } catch (error) {
    console.error("Quota check error:", error);
    return { count: 0, limit: 60, canBrowse: true, usagePercentage: 0, remaining: 60 };
  }
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Enhanced trigger isolation logic for Phase 4
async function analyzeTriggerIntentAdvanced(message: string, activeTrigger: string, language: string = 'en', enhancedContext: string = '') {
  const lowerMessage = message.toLowerCase();
  
  console.log("🔍 WAKTI AI V2 BRAIN: Analyzing Phase 4 advanced trigger intent for:", activeTrigger);
  
  switch (activeTrigger) {
    case 'search':
      const searchPatterns = [
        'what', 'who', 'when', 'where', 'how', 'current', 'latest', 'recent', 'today', 'news',
        'weather', 'score', 'price', 'stock', 'update', 'information', 'find', 'search',
        'ما', 'من', 'متى', 'أين', 'كيف', 'حالي', 'آخر', 'مؤخراً', 'اليوم', 'أخبار',
        'طقس', 'نتيجة', 'سعر', 'معلومات', 'ابحث', 'بحث'
      ];
      
      const isSearchIntent = searchPatterns.some(pattern => lowerMessage.includes(pattern));
      
      return {
        intent: isSearchIntent ? 'advanced_real_time_search' : 'invalid_for_search',
        confidence: isSearchIntent ? 'high' : 'low',
        allowed: isSearchIntent,
        enhancedFeatures: ['contextual_search', 'predictive_results']
      };

    case 'image':
      const imagePatterns = [
        'generate', 'create', 'make', 'draw', 'image', 'picture', 'photo', 'art', 'illustration',
        'أنشئ', 'اصنع', 'ارسم', 'صورة', 'رسم', 'فن'
      ];
      
      const isImageIntent = imagePatterns.some(pattern => lowerMessage.includes(pattern));
      
      return {
        intent: isImageIntent ? 'advanced_image_generation' : 'invalid_for_image',
        confidence: isImageIntent ? 'high' : 'low',
        allowed: isImageIntent,
        enhancedFeatures: ['style_optimization', 'context_aware_generation']
      };

    case 'advanced_search':
      return {
        intent: 'advanced_search_with_ai',
        confidence: 'high',
        allowed: true,
        enhancedFeatures: ['multi_source_search', 'ai_synthesis', 'predictive_suggestions']
      };

    case 'chat':
    default:
      // Chat mode allows everything with Phase 4 enhancements
      return {
        intent: 'advanced_general_chat',
        confidence: 'high',
        allowed: true,
        enhancedFeatures: ['deep_integration', 'workflow_automation', 'predictive_insights']
      };
  }
}
