
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// API keys for real AI integration
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY") || "yzJMWPrRdkJcge2q0yjSOwTGvlhMeOy1";

console.log("🚀 WAKTI AI V2 BRAIN: Enhanced with Chat Memory & Mode Restrictions");

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
    console.log("🚀 WAKTI AI V2 BRAIN: Processing request with chat memory");

    // CRITICAL: Extract and verify authentication token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error("🚀 WAKTI AI V2 BRAIN: Missing authorization header");
      return new Response(JSON.stringify({ 
        error: "Authentication required",
        success: false
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      console.error("🚀 WAKTI AI V2 BRAIN: Authentication failed:", authError);
      return new Response(JSON.stringify({ 
        error: "Invalid authentication",
        success: false
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get request body
    const requestBody = await req.json();
    console.log("🚀 WAKTI AI V2 BRAIN: Request body received:", {
      message: requestBody.message,
      userId: requestBody.userId,
      attachedFiles: requestBody.attachedFiles?.length || 0,
      conversationHistoryLength: requestBody.conversationHistory?.length || 0,
      activeTrigger: requestBody.activeTrigger
    });

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
      calendarContext = null,
      userContext = null,
      enableAdvancedIntegration = true,
      enablePredictiveInsights = true,
      enableWorkflowAutomation = true,
      confirmTask = false,
      confirmReminder = false,
      pendingTaskData = null,
      pendingReminderData = null
    } = requestBody;

    // CRITICAL: Ensure userId matches authenticated user
    if (userId !== user.id) {
      console.error("🚀 WAKTI AI V2 BRAIN: User ID mismatch - potential security breach attempt");
      return new Response(JSON.stringify({ 
        error: "User ID mismatch",
        success: false
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("🚀 WAKTI AI V2 BRAIN: Processing message for user:", user.id);
    console.log("🚀 WAKTI AI V2 BRAIN: Active trigger mode:", activeTrigger);
    console.log("🚀 WAKTI AI V2 BRAIN: Chat memory length:", conversationHistory.length);

    // Handle task confirmation
    if (confirmTask && pendingTaskData) {
      console.log("✅ Processing task confirmation");
      const taskResult = await createTask(user.id, pendingTaskData, language);
      
      return new Response(JSON.stringify({
        response: language === 'ar' 
          ? '✅ تم إنشاء المهمة بنجاح! يمكنك العثور عليها في صفحة المهام والتذكيرات.'
          : '✅ Task created successfully! You can find it in the Tasks & Reminders page.',
        intent: 'task_created',
        confidence: 'high',
        actionTaken: true,
        actionResult: taskResult,
        success: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Handle reminder confirmation
    if (confirmReminder && pendingReminderData) {
      console.log("✅ Processing reminder confirmation");
      const reminderResult = await createReminder(user.id, pendingReminderData, language);
      
      return new Response(JSON.stringify({
        response: language === 'ar' 
          ? '✅ تم إنشاء التذكير بنجاح! يمكنك العثور عليه في صفحة المهام والتذكيرات.'
          : '✅ Reminder created successfully! You can find it in the Tasks & Reminders page.',
        intent: 'reminder_created',
        confidence: 'high',
        actionTaken: true,
        actionResult: reminderResult,
        success: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Process based on trigger mode with enhanced functionality
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let actionTaken = null;
    let actionResult = null;
    let intent = 'general_chat';
    let confidence = 'high';
    let needsConfirmation = false;
    let pendingTaskDataResult = null;
    let pendingReminderDataResult = null;

    // Context details for logging
    console.log("🧠 Context details:", {
      historyLength: conversationHistory.length,
      activeTrigger,
      language
    });

    // Load and add chat memory context
    console.log("🧠 Adding chat memory context:", conversationHistory.length, "messages");

    // Analyze intent for different trigger modes
    const intentAnalysis = analyzeIntent(message, activeTrigger, language);
    intent = intentAnalysis.intent;
    confidence = intentAnalysis.confidence;

    console.log("🧠 WAKTI AI V2 BRAIN: Processing with DeepSeek and chat memory");

    switch (activeTrigger) {
      case 'search':
        if (intentAnalysis.isSearchQuery) {
          // Check search quota
          const quotaResult = await checkSearchQuota(user.id);
          if (!quotaResult.canSearch) {
            response = language === 'ar' 
              ? `🚫 تم الوصول للحد الأقصى من البحث الشهري\n\nلقد استخدمت ${quotaResult.used}/10 من عمليات البحث المجانية هذا الشهر.\n\nيمكنك شراء 50 بحث إضافي مقابل 10 ريال.`
              : `🚫 Monthly search limit reached\n\nYou've used ${quotaResult.used}/10 free searches this month.\n\nYou can purchase 50 additional searches for 10 QAR.`;
            
            quotaStatus = {
              type: 'search_quota_exceeded',
              used: quotaResult.used,
              limit: 10,
              extraSearches: quotaResult.extraSearches,
              canPurchase: true
            };
          } else {
            // Execute search
            const searchResult = await executeSearch(message, language);
            if (searchResult.success) {
              browsingUsed = true;
              browsingData = searchResult.data;
              response = await processWithAI(message, searchResult.context, conversationHistory, language, activeTrigger);
              
              // Increment search usage
              await incrementSearchUsage(user.id);
            } else {
              response = await processWithAI(message, null, conversationHistory, language, activeTrigger);
            }
            
            quotaStatus = {
              type: 'regular_search',
              used: quotaResult.used + 1,
              limit: 10,
              extraSearches: quotaResult.extraSearches
            };
          }
        } else {
          response = language === 'ar' 
            ? `⚠️ أنت في وضع البحث\n\nهذا الوضع مخصص للأسئلة والبحث.\n\nللدردشة العامة، انتقل إلى وضع المحادثة.`
            : `⚠️ You're in Search Mode\n\nThis mode is for questions and search.\n\nFor general chat, switch to Chat mode.`;
        }
        break;

      case 'image':
        if (intentAnalysis.isImageRequest) {
          try {
            console.log("🎨 Generating image with Runware API for prompt:", message);
            const imageResult = await generateImageWithRunware(message, user.id, language);
            
            if (imageResult.success) {
              imageUrl = imageResult.imageUrl;
              response = language === 'ar' 
                ? `🎨 تم إنشاء الصورة بنجاح!\n\n**الوصف:** ${message}`
                : `🎨 Image generated successfully!\n\n**Prompt:** ${message}`;
              intent = 'image_generated';
              actionTaken = true;
            } else {
              console.error("Image generation failed:", imageResult.error);
              response = language === 'ar' 
                ? `❌ عذراً، حدث خطأ في إنشاء الصورة. يرجى المحاولة مرة أخرى.`
                : `❌ Sorry, there was an error generating the image. Please try again.`;
            }
          } catch (error) {
            console.error("Image generation error:", error);
            response = language === 'ar' 
              ? `❌ عذراً، حدث خطأ في إنشاء الصورة. يرجى المحاولة مرة أخرى.`
              : `❌ Sorry, there was an error generating the image. Please try again.`;
          }
        } else {
          response = language === 'ar' 
            ? `⚠️ أنت في وضع إنشاء الصور\n\nهذا الوضع مخصص لإنشاء الصور فقط.\n\nللدردشة العامة، انتقل إلى وضع المحادثة.`
            : `⚠️ You're in Image Mode\n\nThis mode is for image generation only.\n\nFor general chat, switch to Chat mode.`;
        }
        break;

      case 'chat':
      default:
        // Check for task/reminder creation intent
        if (intentAnalysis.isTaskCreation) {
          const taskData = extractTaskData(message, language);
          if (taskData) {
            needsConfirmation = true;
            pendingTaskDataResult = taskData;
            intent = 'task_preview';
            response = language === 'ar' 
              ? `📝 سأقوم بإنشاء مهمة لك. يرجى مراجعة التفاصيل والتأكيد:`
              : `📝 I'll create a task for you. Please review the details and confirm:`;
          } else {
            response = await processWithAI(message, null, conversationHistory, language, activeTrigger);
          }
        } else if (intentAnalysis.isReminderCreation) {
          const reminderData = extractReminderData(message, language);
          if (reminderData) {
            needsConfirmation = true;
            pendingReminderDataResult = reminderData;
            intent = 'reminder_preview';
            response = language === 'ar' 
              ? `⏰ سأقوم بإنشاء تذكير لك. يرجى مراجعة التفاصيل والتأكيد:`
              : `⏰ I'll create a reminder for you. Please review the details and confirm:`;
          } else {
            response = await processWithAI(message, null, conversationHistory, language, activeTrigger);
          }
        } else {
          // Regular chat with AI
          response = await processWithAI(message, null, conversationHistory, language, activeTrigger);
        }
        break;
    }

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent,
      confidence,
      actionTaken,
      actionResult,
      imageUrl,
      browsingUsed,
      browsingData,
      quotaStatus,
      requiresSearchConfirmation: false,
      needsConfirmation,
      pendingTaskData: pendingTaskDataResult,
      pendingReminderData: pendingReminderDataResult,
      success: true
    };

    console.log("✅ Enhanced context response generated using:", DEEPSEEK_API_KEY ? 'DeepSeek' : (OPENAI_API_KEY ? 'OpenAI' : 'Fallback'));
    console.log("🚀 WAKTI AI V2 BRAIN: Sending response with context utilization:", !!conversationHistory.length);

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

// Intent analysis for different modes
function analyzeIntent(message: string, activeTrigger: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  const taskPatterns = [
    'create task', 'add task', 'new task', 'make task', 'task for',
    'remind me', 'reminder', 'schedule', 'appointment',
    'أنشئ مهمة', 'اضف مهمة', 'مهمة جديدة', 'ذكرني', 'تذكير', 'موعد'
  ];

  const searchPatterns = [
    'what', 'who', 'when', 'where', 'how', 'current', 'latest', 'recent', 'today', 'news',
    'weather', 'score', 'price', 'stock', 'update', 'information', 'find', 'search',
    'ما', 'من', 'متى', 'أين', 'كيف', 'حالي', 'آخر', 'مؤخراً', 'اليوم', 'أخبار',
    'طقس', 'نتيجة', 'سعر', 'معلومات', 'ابحث', 'بحث'
  ];

  const imagePatterns = [
    'generate', 'create', 'make', 'draw', 'image', 'picture', 'photo', 'art', 'illustration',
    'أنشئ', 'اصنع', 'ارسم', 'صورة', 'رسم', 'فن'
  ];

  const isTaskCreation = taskPatterns.some(pattern => lowerMessage.includes(pattern));
  const isReminderCreation = lowerMessage.includes('remind') || lowerMessage.includes('ذكر');
  const isSearchQuery = searchPatterns.some(pattern => lowerMessage.includes(pattern)) || lowerMessage.includes('?');
  const isImageRequest = imagePatterns.some(pattern => lowerMessage.includes(pattern));

  let intent = 'general_chat';
  if (isTaskCreation && !isReminderCreation) intent = 'task_creation';
  else if (isReminderCreation) intent = 'reminder_creation';
  else if (isSearchQuery && activeTrigger === 'search') intent = 'search_query';
  else if (isImageRequest && activeTrigger === 'image') intent = 'image_generation';

  return {
    intent,
    confidence: 'high' as const,
    isTaskCreation,
    isReminderCreation,
    isSearchQuery,
    isImageRequest
  };
}

// Extract task data from message
function extractTaskData(message: string, language: string = 'en') {
  // Simple extraction - in production, you'd use more sophisticated NLP
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // Extract basic task info
  let title = message.replace(/create task|add task|new task|make task|أنشئ مهمة|اضف مهمة|مهمة جديدة/gi, '').trim();
  if (title.length < 3) {
    title = language === 'ar' ? 'مهمة جديدة' : 'New Task';
  }

  // Basic due date detection
  let due_date = null;
  let due_time = null;
  
  if (message.includes('tomorrow') || message.includes('غداً')) {
    due_date = tomorrow.toISOString().split('T')[0];
  } else if (message.includes('today') || message.includes('اليوم')) {
    due_date = today.toISOString().split('T')[0];
  }

  // Time extraction (basic)
  const timeMatch = message.match(/(\d{1,2}):(\d{2})|(\d{1,2})\s*(am|pm)/i);
  if (timeMatch) {
    due_time = timeMatch[0];
  }

  return {
    title,
    description: '',
    due_date,
    due_time,
    priority: 'normal',
    subtasks: []
  };
}

// Extract reminder data from message
function extractReminderData(message: string, language: string = 'en') {
  // Similar to task extraction but for reminders
  let title = message.replace(/remind me|reminder|ذكرني|تذكير/gi, '').trim();
  if (title.length < 3) {
    title = language === 'ar' ? 'تذكير جديد' : 'New Reminder';
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  let due_date = null;
  let due_time = null;
  
  if (message.includes('tomorrow') || message.includes('غداً')) {
    due_date = tomorrow.toISOString().split('T')[0];
  } else if (message.includes('today') || message.includes('اليوم')) {
    due_date = today.toISOString().split('T')[0];
  }

  const timeMatch = message.match(/(\d{1,2}):(\d{2})|(\d{1,2})\s*(am|pm)/i);
  if (timeMatch) {
    due_time = timeMatch[0];
  }

  return {
    title,
    due_date,
    due_time
  };
}

// Create task in database
async function createTask(userId: string, taskData: any, language: string = 'en') {
  try {
    console.log("📝 Creating task in database:", taskData);
    
    const { data, error } = await supabase
      .from('tr_tasks')
      .insert({
        user_id: userId,
        title: taskData.title,
        description: taskData.description,
        due_date: taskData.due_date,
        due_time: taskData.due_time,
        priority: taskData.priority || 'normal'
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Error creating task:", error);
      throw error;
    }

    // Create subtasks if any
    if (taskData.subtasks && taskData.subtasks.length > 0) {
      for (let i = 0; i < taskData.subtasks.length; i++) {
        const subtask = taskData.subtasks[i];
        if (subtask.trim()) {
          await supabase
            .from('tr_subtasks')
            .insert({
              task_id: data.id,
              title: subtask,
              order_index: i
            });
        }
      }
    }

    console.log("✅ Task created successfully:", data.id);
    return { success: true, taskId: data.id };
  } catch (error) {
    console.error("❌ Error creating task:", error);
    throw error;
  }
}

// Create reminder in database
async function createReminder(userId: string, reminderData: any, language: string = 'en') {
  try {
    console.log("⏰ Creating reminder in database:", reminderData);
    
    const { data, error } = await supabase
      .from('tr_reminders')
      .insert({
        user_id: userId,
        title: reminderData.title,
        due_date: reminderData.due_date,
        due_time: reminderData.due_time
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Error creating reminder:", error);
      throw error;
    }

    console.log("✅ Reminder created successfully:", data.id);
    return { success: true, reminderId: data.id };
  } catch (error) {
    console.error("❌ Error creating reminder:", error);
    throw error;
  }
}

// Check search quota
async function checkSearchQuota(userId: string) {
  try {
    console.log("🔍 Checking search quota for user:", userId);
    
    const { data, error } = await supabase.rpc('get_or_create_user_search_quota', {
      p_user_id: userId
    });

    if (error) {
      console.error("❌ Error checking search quota:", error);
      return { canSearch: true, used: 0, extraSearches: 0 };
    }

    const quota = data[0];
    const used = quota.regular_search_count || 0;
    const extraSearches = quota.extra_regular_searches || 0;
    const monthlyLimit = 10;

    const canSearch = used < monthlyLimit || extraSearches > 0;

    console.log("📊 Search quota status:", {
      used,
      limit: monthlyLimit,
      extraSearches,
      canSearch
    });

    return {
      canSearch,
      used,
      extraSearches
    };
  } catch (error) {
    console.error("❌ Unexpected error checking search quota:", error);
    return { canSearch: true, used: 0, extraSearches: 0 };
  }
}

// Increment search usage
async function incrementSearchUsage(userId: string) {
  try {
    console.log("🔄 Incrementing search usage for user:", userId);
    
    const { data, error } = await supabase.rpc('increment_regular_search_usage', {
      p_user_id: userId
    });

    if (error) {
      console.error("❌ Error incrementing search usage:", error);
    } else {
      console.log("✅ Search usage incremented successfully");
    }
  } catch (error) {
    console.error("❌ Unexpected error incrementing search usage:", error);
  }
}

// Execute search with Tavily API
async function executeSearch(query: string, language: string = 'en') {
  try {
    if (!TAVILY_API_KEY) {
      console.log("🔍 No Tavily API - using AI for search response");
      
      const searchContext = `Search request: "${query}". Provide helpful information based on your knowledge.`;
      return {
        success: true,
        context: searchContext,
        data: { 
          sources: [],
          enhanced: false,
          note: "AI response without web search"
        }
      };
    }
    
    console.log("🔍 Executing Tavily search for query:", query);
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: "basic",
        include_answer: true,
        include_raw_content: false,
        max_results: 10,
        max_chunks: 5,
        include_domains: [],
        exclude_domains: []
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tavily API error:", response.status, errorText);
      
      const searchContext = `Search request: "${query}". Provide helpful information based on your knowledge.`;
      return {
        success: true,
        context: searchContext,
        data: { 
          sources: [],
          enhanced: false,
          fallback: true,
          note: "AI response (Tavily fallback)"
        }
      };
    }
    
    const data = await response.json();
    console.log("✅ Tavily search successful");
    
    let searchContext = `Search results for: "${query}"\n\n`;
    if (data.answer) {
      searchContext += `Summary: ${data.answer}\n\n`;
    }
    
    if (data.results && data.results.length > 0) {
      searchContext += "Sources:\n";
      data.results.forEach((result, index) => {
        searchContext += `${index + 1}. ${result.title}\n`;
        searchContext += `   ${result.content}\n`;
        searchContext += `   Source: ${result.url}\n\n`;
      });
    }
    
    return {
      success: true,
      context: searchContext,
      data: { 
        sources: data.results || [],
        enhanced: false,
        searchDepth: "basic",
        answer: data.answer
      }
    };
  } catch (error) {
    console.error("Search execution error:", error);
    
    const searchContext = `Search request: "${query}". Provide helpful information based on your knowledge.`;
    return {
      success: true,
      context: searchContext,
      data: { 
        sources: [],
        enhanced: false,
        fallback: true,
        note: "AI response (error fallback)"
      }
    };
  }
}

// Generate image with Runware API
async function generateImageWithRunware(prompt: string, userId: string, language: string = 'en') {
  try {
    console.log("🎨 Generating image with Runware for prompt:", prompt);

    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          taskType: "authentication",
          apiKey: RUNWARE_API_KEY,
        },
        {
          taskType: "imageInference",
          taskUUID: crypto.randomUUID(),
          positivePrompt: prompt,
          model: "runware:100@1",
          width: 512,
          height: 512,
          numberResults: 1,
          outputFormat: "WEBP",
          CFGScale: 1,
          scheduler: "FlowMatchEulerDiscreteScheduler",
          steps: 4,
        },
      ]),
    });

    console.log("🎨 Runware response status:", response.status);

    if (response.ok) {
      const result = await response.json();
      console.log("🎨 Runware response data:", result);
      
      const imageResult = result.data?.find((item: any) => item.taskType === "imageInference");
      
      if (imageResult && imageResult.imageURL) {
        // Save image to database
        try {
          await supabase
            .from('images')
            .insert({
              user_id: userId,
              prompt: prompt,
              image_url: imageResult.imageURL,
              metadata: { provider: 'runware', imageUUID: imageResult.imageUUID }
            });
        } catch (dbError) {
          console.log("Could not save image to database:", dbError);
        }

        return {
          success: true,
          imageUrl: imageResult.imageURL
        };
      } else {
        throw new Error('No image URL in Runware response');
      }
    } else {
      const errorText = await response.text();
      console.error("🎨 Runware API error:", response.status, errorText);
      throw new Error(`Runware API failed: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error('🎨 Error generating image with Runware:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Real AI processing function
async function processWithAI(message: string, context: string | null, conversationHistory: any[], language: string = 'en', activeTrigger: string = 'chat') {
  try {
    console.log("🤖 Processing with real AI");
    
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
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة. تتخصص في المساعدة في المهام اليومية وتقديم معلومات دقيقة ومفيدة. كن ودوداً ومفيداً ومختصراً في إجاباتك.

وضع التشغيل الحالي: ${activeTrigger === 'chat' ? 'محادثة' : activeTrigger === 'search' ? 'بحث' : 'إنشاء صور'}

تعليمات مهمة للتنسيق:
- استخدم نصاً عادياً واضحاً
- تجنب الرموز الزائدة مثل # أو ** أو ***
- استخدم فقرات بسيطة مع فواصل أسطر طبيعية
- اجعل الإجابة سهلة القراءة وبدون تعقيد في التنسيق
- استخدم سياق المحادثة السابقة للإجابة بطريقة طبيعية ومتسقة`
      : `You are WAKTI, an advanced AI assistant. You specialize in helping with daily tasks and providing accurate, helpful information. Be friendly, helpful, and concise in your responses.

Current mode: ${activeTrigger}

Important formatting instructions:
- Use clean, plain text
- Avoid excessive symbols like #, **, or ***
- Use simple paragraphs with natural line breaks
- Keep responses readable and clean without formatting clutter
- Use conversation context to provide natural, consistent responses`;
    
    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add conversation history for context (last 10 messages)
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10);
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }
    
    // Add context if provided (for search results)
    if (context) {
      messages.push({ role: 'assistant', content: `Context: ${context}` });
    }
    
    // Add current message
    messages.push({ role: 'user', content: message });
    
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
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error("🤖 AI processing error:", error);
    
    // Fallback response
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
  }
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
