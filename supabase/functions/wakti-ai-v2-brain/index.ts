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

console.log("🔍 UNIFIED AI BRAIN: Function loaded with Phase 2 Smart Intelligence");

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
    console.log("🔍 UNIFIED AI BRAIN: Processing with Phase 2 Smart Intelligence");

    // Get request body
    const requestBody = await req.json();
    console.log("🔍 UNIFIED AI BRAIN: Request body received:", requestBody);

    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      confirmSearch = false,
      activeTrigger = 'chat'
    } = requestBody;

    // Validate required fields
    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.error("🔍 UNIFIED AI BRAIN: Invalid message field");
      return new Response(JSON.stringify({ 
        error: "Message is required and must be a non-empty string",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!userId) {
      console.error("🔍 UNIFIED AI BRAIN: Missing userId");
      return new Response(JSON.stringify({ 
        error: "User ID is required",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("🔍 UNIFIED AI BRAIN: Processing message for user:", userId);
    console.log("🔍 UNIFIED AI BRAIN: Active trigger mode:", activeTrigger);

    // Phase 2: Get conversation context and user data
    const contextData = await getConversationContext(userId, conversationId);
    const userData = await getUserData(userId);

    // Enhanced intent analysis with context
    const intent = await analyzeIntentWithContext(message, activeTrigger, language, contextData, userData);
    console.log("🔍 UNIFIED AI BRAIN: Enhanced intent analysis result:", intent);

    // Generate response with smart intelligence
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let actionTaken = null;
    let actionResult = null;
    let needsConfirmation = false;
    let needsClarification = false;

    // Get real quota status from database
    quotaStatus = await checkBrowsingQuota(userId);

    switch (activeTrigger) {
      case 'search':
        if (intent.allowed) {
          if (quotaStatus.canBrowse && (confirmSearch || !quotaStatus.requiresConfirmation)) {
            // Real search functionality
            const searchResult = await executeSearch(message, language);
            if (searchResult.success) {
              browsingUsed = true;
              browsingData = searchResult.data;
              response = await processWithSmartAI(message, searchResult.context, language, contextData, userData);
            } else {
              response = await processWithSmartAI(message, null, language, contextData, userData);
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
        // Phase 2: Smart chat processing with context and intelligence
        const smartResult = await processSmartChatWithContext(message, userId, language, contextData, userData);
        response = smartResult.response;
        actionTaken = smartResult.actionTaken;
        actionResult = smartResult.actionResult;
        needsConfirmation = smartResult.needsConfirmation;
        needsClarification = smartResult.needsClarification;
        break;
    }

    // Phase 2: Store conversation context for future use
    if (conversationId) {
      await storeConversationContext(userId, conversationId, message, response, intent);
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
      needsConfirmation,
      needsClarification,
      success: true
    };

    console.log("🔍 UNIFIED AI BRAIN: Sending Phase 2 smart response:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🔍 UNIFIED AI BRAIN: Error processing request:", error);
    
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

// Phase 2: Get conversation context for smart responses
async function getConversationContext(userId: string, conversationId: string | null) {
  try {
    if (!conversationId) return { recentMessages: [], patterns: {} };

    const { data: messages, error } = await supabase
      .from('ai_chat_history')
      .select('content, role, created_at, intent, action_taken')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error getting conversation context:", error);
      return { recentMessages: [], patterns: {} };
    }

    // Analyze patterns in recent conversation
    const patterns = analyzeConversationPatterns(messages || []);

    return {
      recentMessages: messages || [],
      patterns
    };
  } catch (error) {
    console.error("Error in getConversationContext:", error);
    return { recentMessages: [], patterns: {} };
  }
}

// Phase 2: Get user data for smart suggestions
async function getUserData(userId: string) {
  try {
    // Get user's existing tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('tr_tasks')
      .select('id, title, description, due_date, priority, task_type, completed')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get user's reminders
    const { data: reminders, error: remindersError } = await supabase
      .from('tr_reminders')
      .select('id, title, description, due_date, due_time')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get user's events (upcoming)
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, description, start_time, end_time, location')
      .eq('organizer_id', userId)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(10);

    if (tasksError) console.error("Error getting tasks:", tasksError);
    if (remindersError) console.error("Error getting reminders:", remindersError);
    if (eventsError) console.error("Error getting events:", eventsError);

    return {
      tasks: tasks || [],
      reminders: reminders || [],
      events: events || [],
      hasData: (tasks?.length || 0) + (reminders?.length || 0) + (events?.length || 0) > 0
    };
  } catch (error) {
    console.error("Error in getUserData:", error);
    return { tasks: [], reminders: [], events: [], hasData: false };
  }
}

// Phase 2: Analyze conversation patterns for smart suggestions
function analyzeConversationPatterns(messages: any[]) {
  const patterns = {
    frequentTopics: [] as string[],
    taskCreationAttempts: 0,
    searchQueries: 0,
    timeReferences: [] as string[],
    lastIntent: null as string | null
  };

  messages.forEach(msg => {
    if (msg.intent) {
      patterns.lastIntent = msg.intent;
      
      if (msg.intent.includes('task') || msg.action_taken === 'parse_task') {
        patterns.taskCreationAttempts++;
      }
      
      if (msg.intent.includes('search')) {
        patterns.searchQueries++;
      }
    }

    // Extract time references
    const timeWords = msg.content?.match(/\b(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening)\b/gi);
    if (timeWords) {
      patterns.timeReferences.push(...timeWords);
    }
  });

  return patterns;
}

// Phase 2: Enhanced intent analysis with context
async function analyzeIntentWithContext(message: string, activeTrigger: string, language: string, contextData: any, userData: any) {
  const lowerMessage = message.toLowerCase();
  
  console.log("🔍 UNIFIED AI BRAIN: Analyzing intent with Phase 2 context intelligence");
  
  // Check for duplicate task prevention
  if (activeTrigger === 'chat') {
    const potentialDuplicate = checkForDuplicateTask(message, userData.tasks);
    if (potentialDuplicate) {
      return {
        intent: 'duplicate_task_warning',
        confidence: 'high',
        allowed: true,
        duplicateTask: potentialDuplicate
      };
    }
  }
  
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
      // Enhanced chat intent analysis with context
      return analyzeSmartChatIntent(message, language, contextData, userData);
  }
}

// Phase 2: Smart chat intent analysis
function analyzeSmartChatIntent(message: string, language: string, contextData: any, userData: any) {
  const lowerMessage = message.toLowerCase();
  
  // Task creation patterns (enhanced)
  const taskPatterns = [
    /\b(create|add|make|new)\s+task/i,
    /\b(need|have|must|should)\s+to\s+(do|buy|get|go|visit|call|email|finish|complete)/i,
    /\b(shopping|shop)\s+(at|to|in|for)/i,
    /\b(buy|purchase|get|pick\s+up)\s+(.+)/i,
    /\btodo/i,
    /\bremind\s+me\s+to/i,
    /\bschedule/i
  ];

  // Search suggestion patterns
  const searchSuggestionPatterns = [
    /\b(what\s+is|who\s+is|when\s+is|where\s+is|how\s+is)\b/i,
    /\b(current|latest|recent|today\'s|this\s+week\'s)\s+(news|weather|score|price|information)/i,
    /\b(tell\s+me\s+about|information\s+about|details\s+about)\b/i
  ];

  // Enhanced task detection
  const isTaskRequest = taskPatterns.some(pattern => pattern.test(message));
  
  if (isTaskRequest) {
    return {
      intent: 'task_creation',
      confidence: 'high',
      allowed: true
    };
  }

  // Enhanced search suggestion detection
  const shouldSuggestSearch = searchSuggestionPatterns.some(pattern => pattern.test(message));
  
  if (shouldSuggestSearch) {
    return {
      intent: 'search_suggestion',
      confidence: 'high',
      allowed: true
    };
  }

  // Default chat intent
  return {
    intent: 'general_chat',
    confidence: 'high',
    allowed: true
  };
}

// Phase 2: Check for duplicate tasks
function checkForDuplicateTask(message: string, existingTasks: any[]) {
  const lowerMessage = message.toLowerCase();
  
  // Extract potential task title from message
  const taskKeywords = extractTaskKeywords(lowerMessage);
  
  // Check against existing tasks
  for (const task of existingTasks) {
    const taskTitle = task.title.toLowerCase();
    const taskDescription = (task.description || '').toLowerCase();
    
    // Check for significant overlap
    const overlap = taskKeywords.some(keyword => 
      taskTitle.includes(keyword) || taskDescription.includes(keyword)
    );
    
    if (overlap && taskKeywords.length > 0) {
      return task;
    }
  }
  
  return null;
}

// Extract task keywords from message
function extractTaskKeywords(message: string) {
  // Remove common task creation phrases
  let cleaned = message
    .replace(/\b(create|add|make|new|task|todo|need|have|must|should|to|do)\b/g, '')
    .trim();
  
  // Split into meaningful words (exclude very short words)
  return cleaned
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 3); // Take first 3 meaningful words
}

// Phase 2: Process smart chat with context and intelligence
async function processSmartChatWithContext(message: string, userId: string, language: string, contextData: any, userData: any) {
  try {
    // Enhanced task detection and processing
    if (detectTaskIntent(message)) {
      return await processTaskCreationWithContext(message, userId, language, userData);
    }

    // Enhanced reminder detection
    if (detectReminderIntent(message)) {
      return await processReminderCreationWithContext(message, userId, language, userData);
    }

    // Smart search suggestions
    if (detectSearchSuggestion(message)) {
      return {
        response: generateSearchSuggestion(message, language),
        actionTaken: 'search_suggestion',
        actionResult: { suggestion: generateSearchSuggestion(message, language) },
        needsConfirmation: false,
        needsClarification: false
      };
    }

    // Check for duplicate task warning
    const duplicateTask = checkForDuplicateTask(message, userData.tasks);
    if (duplicateTask) {
      return {
        response: language === 'ar' 
          ? `يبدو أن لديك مهمة مشابهة: "${duplicateTask.title}". هل تريد إنشاء مهمة جديدة أم تحديث المهمة الموجودة؟`
          : `You seem to have a similar task: "${duplicateTask.title}". Do you want to create a new task or update the existing one?`,
        actionTaken: 'duplicate_warning',
        actionResult: { duplicateTask },
        needsConfirmation: true,
        needsClarification: false
      };
    }

    // Default smart AI processing
    const response = await processWithSmartAI(message, null, language, contextData, userData);
    return {
      response,
      actionTaken: null,
      actionResult: null,
      needsConfirmation: false,
      needsClarification: false
    };

  } catch (error) {
    console.error("Error in processSmartChatWithContext:", error);
    
    const fallbackResponse = language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
    
    return {
      response: fallbackResponse,
      actionTaken: null,
      actionResult: null,
      needsConfirmation: false,
      needsClarification: false
    };
  }
}

// Phase 2: Enhanced task creation with context
async function processTaskCreationWithContext(message: string, userId: string, language: string, userData: any) {
  try {
    const taskData = extractEnhancedTaskData(message);
    
    // Smart scheduling based on existing events
    if (!taskData.due_date && userData.events.length > 0) {
      taskData.suggestedDate = suggestOptimalDate(userData.events);
    }

    // Smart priority suggestion
    if (!taskData.priority || taskData.priority === 'normal') {
      taskData.suggestedPriority = suggestPriority(message, taskData.due_date);
    }

    // Check if we need clarification
    const missingFields = [];
    if (!taskData.due_date && !taskData.suggestedDate) missingFields.push('due_date');
    if (!taskData.priority && !taskData.suggestedPriority) missingFields.push('priority');

    if (missingFields.length > 0) {
      const clarificationResponse = generateSmartClarificationQuestions(taskData, missingFields, language);
      return {
        response: clarificationResponse,
        actionTaken: 'clarify_task',
        actionResult: { partialTask: taskData, missingFields },
        needsConfirmation: false,
        needsClarification: true
      };
    }

    // Task ready for confirmation
    const confirmationResponse = generateTaskConfirmation(taskData, language);
    return {
      response: confirmationResponse,
      actionTaken: 'parse_task',
      actionResult: { pendingTask: taskData },
      needsConfirmation: true,
      needsClarification: false
    };

  } catch (error) {
    console.error("Error in processTaskCreationWithContext:", error);
    
    const errorResponse = language === 'ar' 
      ? `أعتذر، لم أتمكن من معالجة طلب المهمة. يرجى المحاولة مرة أخرى بتفاصيل أكثر وضوحاً.`
      : `Sorry, I couldn't process the task request. Please try again with clearer details.`;
    
    return {
      response: errorResponse,
      actionTaken: null,
      actionResult: null,
      needsConfirmation: false,
      needsClarification: false
    };
  }
}

// Phase 2: Enhanced reminder creation with context
async function processReminderCreationWithContext(message: string, userId: string, language: string, userData: any) {
  try {
    const reminderData = extractReminderData(message);
    
    // Smart time suggestions based on user patterns
    if (!reminderData.due_time) {
      reminderData.suggestedTime = suggestOptimalTime(userData.reminders);
    }

    // Check if we need clarification
    const missingFields = [];
    if (!reminderData.due_date) missingFields.push('due_date');
    if (!reminderData.due_time && !reminderData.suggestedTime) missingFields.push('due_time');

    if (missingFields.length > 0) {
      const clarificationResponse = generateReminderClarificationQuestions(reminderData, missingFields, language);
      return {
        response: clarificationResponse,
        actionTaken: 'clarify_reminder',
        actionResult: { partialReminder: reminderData, missingFields },
        needsConfirmation: false,
        needsClarification: true
      };
    }

    // Reminder ready for confirmation
    const confirmationResponse = generateReminderConfirmation(reminderData, language);
    return {
      response: confirmationResponse,
      actionTaken: 'parse_reminder',
      actionResult: { pendingReminder: reminderData },
      needsConfirmation: true,
      needsClarification: false
    };

  } catch (error) {
    console.error("Error in processReminderCreationWithContext:", error);
    
    const errorResponse = language === 'ar' 
      ? `أعتذر، لم أتمكن من معالجة طلب التذكير. يرجى المحاولة مرة أخرى بتفاصيل أكثر وضوحاً.`
      : `Sorry, I couldn't process the reminder request. Please try again with clearer details.`;
    
    return {
      response: errorResponse,
      actionTaken: null,
      actionResult: null,
      needsConfirmation: false,
      needsClarification: false
    };
  }
}

// Phase 2: Enhanced task detection
function detectTaskIntent(message: string) {
  const taskPatterns = [
    /\b(create|add|make|new)\s+task/i,
    /\b(need|have|must|should)\s+to\s+(do|buy|get|go|visit|call|email|finish|complete)/i,
    /\b(shopping|shop)\s+(at|to|in|for)/i,
    /\b(buy|purchase|get|pick\s+up)\s+(.+)/i,
    /\btodo/i,
    /\bplan\s+to/i,
    /\bschedule.*task/i
  ];
  
  return taskPatterns.some(pattern => pattern.test(message));
}

// Phase 2: Enhanced reminder detection
function detectReminderIntent(message: string) {
  const reminderPatterns = [
    /\bremind\s+me\s+to/i,
    /\bremind\s+me\s+(about|of)/i,
    /\b(create|add|set)\s+(a\s+)?reminder/i,
    /\bdon\'t\s+forget\s+to/i,
    /\bmake\s+sure\s+(i|to)/i
  ];
  
  return reminderPatterns.some(pattern => pattern.test(message));
}

// Phase 2: Enhanced search suggestion detection
function detectSearchSuggestion(message: string) {
  const searchPatterns = [
    /\b(what\s+is|who\s+is|when\s+is|where\s+is|how\s+is)\b/i,
    /\b(current|latest|recent|today\'s|this\s+week\'s)\s+(news|weather|score|price|information)/i,
    /\b(tell\s+me\s+about|information\s+about|details\s+about)\b/i,
    /\bwhat.*happening/i,
    /\bhow.*doing/i
  ];
  
  return searchPatterns.some(pattern => pattern.test(message));
}

// Phase 2: Suggest optimal date based on user's calendar
function suggestOptimalDate(events: any[]) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  // Check if tomorrow is free
  const tomorrowEvents = events.filter(event => {
    const eventDate = new Date(event.start_time);
    return eventDate.toDateString() === tomorrow.toDateString();
  });
  
  if (tomorrowEvents.length === 0) {
    return tomorrow.toISOString().split('T')[0]; // Tomorrow if free
  }
  
  // Find next free day within a week
  for (let i = 2; i <= 7; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + i);
    
    const dayEvents = events.filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate.toDateString() === checkDate.toDateString();
    });
    
    if (dayEvents.length === 0) {
      return checkDate.toISOString().split('T')[0];
    }
  }
  
  // Default to tomorrow if all days are busy
  return tomorrow.toISOString().split('T')[0];
}

// Phase 2: Suggest priority based on context
function suggestPriority(message: string, dueDate: string | null) {
  const urgentWords = ['urgent', 'asap', 'immediately', 'now', 'critical', 'important'];
  const lowerMessage = message.toLowerCase();
  
  if (urgentWords.some(word => lowerMessage.includes(word))) {
    return 'urgent';
  }
  
  if (dueDate) {
    const due = new Date(dueDate);
    const today = new Date();
    const daysDiff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 1) return 'urgent';
    if (daysDiff <= 3) return 'high';
  }
  
  return 'normal';
}

// Phase 2: Suggest optimal time based on user patterns
function suggestOptimalTime(reminders: any[]) {
  // Analyze user's reminder patterns
  const timePattern = analyzeTimePatterns(reminders);
  
  if (timePattern.morningReminders > timePattern.eveningReminders) {
    return '09:00';
  } else {
    return '18:00';
  }
}

// Analyze user's time patterns
function analyzeTimePatterns(reminders: any[]) {
  let morningReminders = 0;
  let eveningReminders = 0;
  
  reminders.forEach(reminder => {
    if (reminder.due_time) {
      const hour = parseInt(reminder.due_time.split(':')[0]);
      if (hour < 12) morningReminders++;
      else eveningReminders++;
    }
  });
  
  return { morningReminders, eveningReminders };
}

// Phase 2: Generate smart clarification questions
function generateSmartClarificationQuestions(taskData: any, missingFields: string[], language: string) {
  const questions = [];
  
  if (missingFields.includes('due_date')) {
    if (taskData.suggestedDate) {
      questions.push(language === 'ar' 
        ? `متى تريد إكمال هذه المهمة؟ أقترح ${formatDate(taskData.suggestedDate, language)}`
        : `When would you like to complete this task? I suggest ${formatDate(taskData.suggestedDate, language)}`
      );
    } else {
      questions.push(language === 'ar' 
        ? 'متى تريد إكمال هذه المهمة؟'
        : 'When would you like to complete this task?'
      );
    }
  }
  
  if (missingFields.includes('priority')) {
    if (taskData.suggestedPriority) {
      questions.push(language === 'ar' 
        ? `ما هي أولوية هذه المهمة؟ أقترح: ${translatePriority(taskData.suggestedPriority, language)}`
        : `What priority should this task have? I suggest: ${taskData.suggestedPriority}`
      );
    } else {
      questions.push(language === 'ar' 
        ? 'ما هي أولوية هذه المهمة؟ (عادي، عالي، عاجل)'
        : 'What priority should this task have? (normal, high, urgent)'
      );
    }
  }
  
  return language === 'ar'
    ? `لقد أعددت مهمة: **${taskData.title}**${taskData.subtasks?.length > 0 ? `\n\nالمهام الفرعية:\n${taskData.subtasks.map((s: string) => `• ${s}`).join('\n')}` : ''}\n\nلإكمال الإعداد، أحتاج إلى معرفة:\n• ${questions.join('\n• ')}`
    : `I've prepared a task: **${taskData.title}**${taskData.subtasks?.length > 0 ? `\n\nSubtasks:\n${taskData.subtasks.map((s: string) => `• ${s}`).join('\n')}` : ''}\n\nTo complete the setup, I need to know:\n• ${questions.join('\n• ')}`;
}

// Phase 2: Generate reminder clarification questions
function generateReminderClarificationQuestions(reminderData: any, missingFields: string[], language: string) {
  const questions = [];
  
  if (missingFields.includes('due_date')) {
    questions.push(language === 'ar' 
      ? 'في أي يوم تريد التذكير؟'
      : 'What date do you want to be reminded?'
    );
  }
  
  if (missingFields.includes('due_time')) {
    if (reminderData.suggestedTime) {
      questions.push(language === 'ar' 
        ? `في أي وقت تريد التذكير؟ أقترح الساعة ${reminderData.suggestedTime}`
        : `What time do you want to be reminded? I suggest ${reminderData.suggestedTime}`
      );
    } else {
      questions.push(language === 'ar' 
        ? 'في أي وقت تريد التذكير؟'
        : 'What time do you want to be reminded?'
      );
    }
  }
  
  return language === 'ar'
    ? `لقد أعددت تذكيراً: **${reminderData.title}**\n\nلإكمال الإعداد، أحتاج إلى معرفة:\n• ${questions.join('\n• ')}`
    : `I've prepared a reminder: **${reminderData.title}**\n\nTo complete the setup, I need to know:\n• ${questions.join('\n• ')}`;
}

// Phase 2: Generate search suggestion
function generateSearchSuggestion(message: string, language: string) {
  return language === 'ar'
    ? `يبدو أنك تبحث عن معلومات حديثة. للحصول على أحدث المعلومات، أنصحك بالتبديل إلى وضع البحث.`
    : `It looks like you're looking for current information. For the latest information, I recommend switching to Search mode.`;
}

// Phase 2: Generate task confirmation
function generateTaskConfirmation(taskData: any, language: string) {
  return language === 'ar'
    ? `لقد أعددت مهمة لك للمراجعة:\n\n**${taskData.title}**\n${taskData.due_date ? `\n📅 تاريخ الاستحقاق: ${formatDate(taskData.due_date, language)}` : ''}${taskData.priority ? `\n🔥 الأولوية: ${translatePriority(taskData.priority, language)}` : ''}${taskData.subtasks?.length > 0 ? `\n\nالمهام الفرعية:\n${taskData.subtasks.map((s: string) => `• ${s}`).join('\n')}` : ''}\n\nيرجى تأكيد ما إذا كنت تريد مني إنشاء هذه المهمة.`
    : `I've prepared a task for you to review:\n\n**${taskData.title}**\n${taskData.due_date ? `\n📅 Due date: ${formatDate(taskData.due_date, language)}` : ''}${taskData.priority ? `\n🔥 Priority: ${taskData.priority}` : ''}${taskData.subtasks?.length > 0 ? `\n\nSubtasks:\n${taskData.subtasks.map((s: string) => `• ${s}`).join('\n')}` : ''}\n\nPlease confirm if you'd like me to create this task.`;
}

// Phase 2: Generate reminder confirmation
function generateReminderConfirmation(reminderData: any, language: string) {
  return language === 'ar'
    ? `لقد أعددت تذكيراً لك للمراجعة:\n\n**${reminderData.title}**\n${reminderData.due_date ? `\n📅 تاريخ التذكير: ${formatDate(reminderData.due_date, language)}` : ''}${reminderData.due_time ? `\n⏰ وقت التذكير: ${reminderData.due_time}` : ''}\n\nيرجى تأكيد ما إذا كنت تريد مني إنشاء هذا التذكير.`
    : `I've prepared a reminder for you to review:\n\n**${reminderData.title}**\n${reminderData.due_date ? `\n📅 Reminder date: ${formatDate(reminderData.due_date, language)}` : ''}${reminderData.due_time ? `\n⏰ Reminder time: ${reminderData.due_time}` : ''}\n\nPlease confirm if you'd like me to create this reminder.`;
}

// Helper functions for formatting and translation
function formatDate(dateString: string, language: string) {
  const date = new Date(dateString);
  return language === 'ar' 
    ? date.toLocaleDateString('ar-SA')
    : date.toLocaleDateString('en-US');
}

function translatePriority(priority: string, language: string) {
  if (language === 'ar') {
    switch (priority) {
      case 'urgent': return 'عاجل';
      case 'high': return 'عالي';
      case 'normal': return 'عادي';
      default: return priority;
    }
  }
  return priority;
}

// Phase 2: Store conversation context
async function storeConversationContext(userId: string, conversationId: string, userMessage: string, aiResponse: string, intent: any) {
  try {
    // Store in conversation history for context
    await supabase
      .from('ai_chat_history')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        role: 'user',
        content: userMessage,
        intent: intent.intent,
        confidence_level: intent.confidence
      });

    await supabase
      .from('ai_chat_history')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        role: 'assistant',
        content: aiResponse,
        intent: intent.intent,
        confidence_level: intent.confidence
      });

  } catch (error) {
    console.error("Error storing conversation context:", error);
  }
}

async function processWithSmartAI(message: string, context: string | null, language: string = 'en', contextData?: any, userData?: any) {
  try {
    console.log("🤖 UNIFIED AI BRAIN: Processing with smart AI");
    
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

    // Enhanced system prompt with Phase 2 intelligence
    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة. تتخصص في المساعدة في المهام اليومية وتقديم معلومات دقيقة ومفيدة. 

المعلومات السياقية:
- لدى المستخدم ${userData?.tasks?.length || 0} مهمة نشطة
- لدى المستخدم ${userData?.reminders?.length || 0} تذكير
- لدى المستخدم ${userData?.events?.length || 0} حدث قادم

كن ودوداً ومفيداً وذكياً في إجاباتك. استخدم المعلومات السياقية لتقديم اقتراحات أفضل.`
      : `You are WAKTI, an advanced AI assistant. You specialize in helping with daily tasks and providing accurate, helpful information.

Context Information:
- User has ${userData?.tasks?.length || 0} active tasks
- User has ${userData?.reminders?.length || 0} reminders  
- User has ${userData?.events?.length || 0} upcoming events

Be friendly, helpful, and intelligent in your responses. Use the context information to provide better suggestions.`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];
    
    if (context) {
      messages.splice(1, 0, { role: 'assistant', content: `Context: ${context}` });
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
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error("🤖 UNIFIED AI BRAIN: AI processing error:", error);
    
    // Fallback response
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
  }
}

// Real search function
async function executeSearch(query: string, language: string = 'en') {
  try {
    if (!TAVILY_API_KEY) {
      return { success: false, error: "Search not configured" };
    }
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: "basic",
        include_answer: true,
        max_results: 3
      })
    });
    
    if (!response.ok) {
      return { success: false, error: "Search failed" };
    }
    
    const data = await response.json();
    return {
      success: true,
      context: data.answer,
      data: { sources: data.results || [] }
    };
  } catch (error) {
    return { success: false, error: error.message };
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

// Enhanced task data extraction function
function extractEnhancedTaskData(text: string) {
  const lowerText = text.toLowerCase();
  
  // Extract title
  let title = "";
  const shoppingMatch = text.match(/\b(go\s+)?(shopping|shop)\s+(at|to|in)\s+([^,\.]+)/i);
  if (shoppingMatch) {
    const location = shoppingMatch[4].trim();
    title = `Shopping at ${location}`;
  } else {
    // Generic task title extraction
    title = text.replace(/\b(create|add|make|new)\s+task\s*/i, "").trim();
    if (!title) title = "New task";
  }
  
  // Extract subtasks from shopping lists
  const subtasks: string[] = [];
  
  // Look for "buy/get/purchase" followed by items
  const buyMatch = text.match(/\b(buy|get|purchase|pick\s+up)\s+(.+)/i);
  if (buyMatch) {
    const itemsText = buyMatch[2];
    // Parse natural language lists: "milk and rice and bread" or "milk, rice, bread"
    const items = itemsText
      .split(/\s+and\s+|,\s*|\s*&\s*/)
      .map(item => item.trim())
      .filter(item => item && !item.match(/\b(at|to|in|from|for|on|when|where|why|how)\b/i))
      .slice(0, 10); // Limit to 10 subtasks
    
    subtasks.push(...items);
  }
  
  // Extract due date
  const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{0,4})|(\d{1,2})(st|nd|rd|th)? (of )?(january|february|march|april|may|june|july|august|september|october|november|december)|tomorrow|today|next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi;
  const dateMatch = text.match(dateRegex);
  
  // Extract priority
  const priorityRegex = /\b(high|medium|low|urgent|critical)\b\s*priority/i;
  const priorityMatch = text.match(priorityRegex);
  
  // Determine priority based on context
  let priority = "normal";
  if (priorityMatch) {
    priority = priorityMatch[1].toLowerCase();
  } else if (lowerText.includes("urgent") || lowerText.includes("asap") || lowerText.includes("immediately")) {
    priority = "urgent";
  } else if (lowerText.includes("important") || lowerText.includes("soon")) {
    priority = "high";
  }
  
  return {
    title: title,
    description: "",
    subtasks: subtasks,
    due_date: dateMatch ? dateMatch[0] : null,
    due_time: null,
    priority: priority as 'normal' | 'high' | 'urgent',
    task_type: 'one-time' as const
  };
}

// Extract reminder data function
function extractReminderData(text: string) {
  const lowerText = text.toLowerCase();
  
  // Extract title from "remind me to..." pattern
  let title = "";
  const remindMatch = text.match(/remind\s+me\s+to\s+(.+)/i);
  if (remindMatch) {
    title = remindMatch[1].trim();
  } else {
    title = text.replace(/\b(create|add|set)\s+(a\s+)?reminder\s*/i, "").trim();
    if (!title) title = "New reminder";
  }
  
  // Extract due date
  const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{0,4})|(\d{1,2})(st|nd|rd|th)? (of )?(january|february|march|april|may|june|july|august|september|october|november|december)|tomorrow|today|next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi;
  const dateMatch = text.match(dateRegex);
  
  // Extract time
  const timeRegex = /(\d{1,2}):(\d{2})\s*(am|pm)?/i;
  const timeMatch = text.match(timeRegex);
  
  return {
    title: title,
    description: "",
    due_date: dateMatch ? dateMatch[0] : null,
    due_time: timeMatch ? timeMatch[0] : null
  };
}
