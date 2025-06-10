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

console.log("🔍 UNIFIED AI BRAIN: Function loaded with Phase 3 Enhanced Intelligence & Learning");

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
    console.log("🔍 UNIFIED AI BRAIN: Processing with Phase 3 Enhanced Intelligence & Learning");

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

    // Phase 3: Enhanced user learning and context analysis
    const userProfile = await getUserLearningProfile(userId);
    const contextData = await getEnhancedConversationContext(userId, conversationId);
    const userData = await getEnhancedUserData(userId);
    const behaviorPatterns = await analyzeBehaviorPatterns(userId);

    // Enhanced intent analysis with learning
    const intent = await analyzeIntentWithLearning(message, activeTrigger, language, contextData, userData, userProfile, behaviorPatterns);
    console.log("🔍 UNIFIED AI BRAIN: Phase 3 enhanced intent analysis result:", intent);

    // Generate response with enhanced intelligence
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let actionTaken = null;
    let actionResult = null;
    let needsConfirmation = false;
    let needsClarification = false;
    let proactiveActions = [];

    // Get real quota status from database
    quotaStatus = await checkBrowsingQuota(userId);

    switch (activeTrigger) {
      case 'search':
        if (intent.allowed) {
          if (quotaStatus.canBrowse && (confirmSearch || !quotaStatus.requiresConfirmation)) {
            // Real search functionality with learning
            const searchResult = await executeEnhancedSearch(message, language, userProfile);
            if (searchResult.success) {
              browsingUsed = true;
              browsingData = searchResult.data;
              response = await processWithEnhancedAI(message, searchResult.context, language, contextData, userData, userProfile);
            } else {
              response = await processWithEnhancedAI(message, null, language, contextData, userData, userProfile);
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
        // Phase 3: Enhanced chat processing with learning and proactive intelligence
        const enhancedResult = await processEnhancedChatWithLearning(message, userId, language, contextData, userData, userProfile, behaviorPatterns);
        response = enhancedResult.response;
        actionTaken = enhancedResult.actionTaken;
        actionResult = enhancedResult.actionResult;
        needsConfirmation = enhancedResult.needsConfirmation;
        needsClarification = enhancedResult.needsClarification;
        proactiveActions = enhancedResult.proactiveActions || [];
        break;
    }

    // Phase 3: Store enhanced conversation context and learning data
    if (conversationId) {
      await storeEnhancedConversationContext(userId, conversationId, message, response, intent, actionTaken, actionResult);
    }

    // Phase 3: Update user learning profile
    await updateUserLearningProfile(userId, message, response, intent, actionTaken);

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
      proactiveActions,
      userProfile: {
        preferredTime: userProfile.preferredTime,
        communicationStyle: userProfile.communicationStyle,
        taskPatterns: userProfile.taskPatterns
      },
      success: true
    };

    console.log("🔍 UNIFIED AI BRAIN: Sending Phase 3 enhanced response:", result);

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

// Phase 3: Enhanced user learning profile
async function getUserLearningProfile(userId: string) {
  try {
    // Get user's AI knowledge base
    const { data: knowledge, error } = await supabase
      .from('ai_user_knowledge')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Error getting user knowledge:", error);
    }

    // Analyze user's interaction patterns
    const patterns = await analyzeUserInteractionPatterns(userId);
    
    return {
      preferences: knowledge || {},
      communicationStyle: knowledge?.communication_style || 'balanced',
      preferredTime: patterns.preferredTimeOfDay,
      taskPatterns: patterns.taskCreationPatterns,
      responseStyle: knowledge?.response_length || 'balanced',
      interests: knowledge?.interests || [],
      learningLevel: patterns.complexityLevel || 'intermediate'
    };
  } catch (error) {
    console.error("Error in getUserLearningProfile:", error);
    return {
      preferences: {},
      communicationStyle: 'balanced',
      preferredTime: 'morning',
      taskPatterns: {},
      responseStyle: 'balanced',
      interests: [],
      learningLevel: 'intermediate'
    };
  }
}

// Phase 3: Analyze user behavior patterns
async function analyzeBehaviorPatterns(userId: string) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get recent chat history
    const { data: chatHistory, error: chatError } = await supabase
      .from('ai_chat_history')
      .select('content, role, created_at, intent, action_taken')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    // Get recent tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('tr_tasks')
      .select('title, created_at, due_date, priority, completed')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (chatError) console.error("Error getting chat history:", chatError);
    if (tasksError) console.error("Error getting tasks:", tasksError);

    return {
      activeHours: analyzeActiveHours(chatHistory || []),
      preferredTaskTypes: analyzeTaskTypes(tasks || []),
      responsiveness: analyzeResponsePatterns(chatHistory || []),
      procrastinationTendency: analyzeProcrastination(tasks || []),
      weeklyPatterns: analyzeWeeklyPatterns(chatHistory || [], tasks || []),
      priorityPatterns: analyzePriorityPatterns(tasks || [])
    };
  } catch (error) {
    console.error("Error in analyzeBehaviorPatterns:", error);
    return {
      activeHours: [],
      preferredTaskTypes: {},
      responsiveness: 'normal',
      procrastinationTendency: 'low',
      weeklyPatterns: {},
      priorityPatterns: {}
    };
  }
}

// Phase 3: Enhanced conversation context
async function getEnhancedConversationContext(userId: string, conversationId: string | null) {
  try {
    if (!conversationId) return { recentMessages: [], patterns: {}, emotionalContext: 'neutral' };

    // Get recent conversation messages
    const { data: messages, error } = await supabase
      .from('ai_chat_history')
      .select('content, role, created_at, intent, action_taken, action_result')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error getting enhanced conversation context:", error);
      return { recentMessages: [], patterns: {}, emotionalContext: 'neutral' };
    }

    // Analyze conversation patterns and emotional context
    const patterns = analyzeEnhancedConversationPatterns(messages || []);
    const emotionalContext = analyzeEmotionalContext(messages || []);

    return {
      recentMessages: messages || [],
      patterns,
      emotionalContext,
      conversationFlow: analyzeConversationFlow(messages || [])
    };
  } catch (error) {
    console.error("Error in getEnhancedConversationContext:", error);
    return { recentMessages: [], patterns: {}, emotionalContext: 'neutral' };
  }
}

// Phase 3: Enhanced user data with smart insights
async function getEnhancedUserData(userId: string) {
  try {
    // Get user's existing data
    const [tasksResult, remindersResult, eventsResult] = await Promise.all([
      supabase
        .from('tr_tasks')
        .select('id, title, description, due_date, priority, task_type, completed, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('tr_reminders')
        .select('id, title, description, due_date, due_time, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('events')
        .select('id, title, description, start_time, end_time, location, created_at')
        .eq('organizer_id', userId)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(20)
    ]);

    const tasks = tasksResult.data || [];
    const reminders = remindersResult.data || [];
    const events = eventsResult.data || [];

    // Generate smart insights
    const insights = generateUserInsights(tasks, reminders, events);

    return {
      tasks,
      reminders,
      events,
      insights,
      hasData: tasks.length + reminders.length + events.length > 0,
      productivity: analyzeProductivity(tasks),
      workload: analyzeWorkload(tasks, events)
    };
  } catch (error) {
    console.error("Error in getEnhancedUserData:", error);
    return { 
      tasks: [], 
      reminders: [], 
      events: [], 
      insights: {},
      hasData: false,
      productivity: {},
      workload: 'balanced'
    };
  }
}

// Phase 3: Enhanced intent analysis with learning
async function analyzeIntentWithLearning(message: string, activeTrigger: string, language: string, contextData: any, userData: any, userProfile: any, behaviorPatterns: any) {
  const lowerMessage = message.toLowerCase();
  
  console.log("🔍 UNIFIED AI BRAIN: Analyzing intent with Phase 3 Enhanced Learning Intelligence");
  
  // Check for pattern-based duplicate task prevention
  if (activeTrigger === 'chat') {
    const smartDuplicate = checkForSmartDuplicateTask(message, userData.tasks, behaviorPatterns);
    if (smartDuplicate) {
      return {
        intent: 'smart_duplicate_warning',
        confidence: 'high',
        allowed: true,
        duplicateTask: smartDuplicate.task,
        similarity: smartDuplicate.similarity,
        suggestion: smartDuplicate.suggestion
      };
    }
  }
  
  switch (activeTrigger) {
    case 'search':
      const searchPatterns = getSearchPatterns(language);
      const isSearchIntent = searchPatterns.some(pattern => lowerMessage.includes(pattern));
      
      return {
        intent: isSearchIntent ? 'real_time_search' : 'invalid_for_search',
        confidence: isSearchIntent ? 'high' : 'low',
        allowed: isSearchIntent
      };

    case 'image':
      const imagePatterns = getImagePatterns(language);
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
      // Enhanced chat intent analysis with learning
      return analyzeEnhancedChatIntent(message, language, contextData, userData, userProfile, behaviorPatterns);
  }
}

// Phase 3: Enhanced chat processing with learning
async function processEnhancedChatWithLearning(message: string, userId: string, language: string, contextData: any, userData: any, userProfile: any, behaviorPatterns: any) {
  try {
    // Phase 3: Proactive suggestions based on patterns
    const proactiveActions = generateProactiveSuggestions(message, userData, userProfile, behaviorPatterns);

    // Enhanced task detection with learning
    if (detectEnhancedTaskIntent(message, userProfile, behaviorPatterns)) {
      return await processTaskCreationWithLearning(message, userId, language, userData, userProfile, behaviorPatterns);
    }

    // Enhanced reminder detection with learning
    if (detectEnhancedReminderIntent(message, userProfile, behaviorPatterns)) {
      return await processReminderCreationWithLearning(message, userId, language, userData, userProfile, behaviorPatterns);
    }

    // Smart productivity suggestions
    if (detectProductivityOpportunity(message, userData, behaviorPatterns)) {
      return {
        response: generateProductivitySuggestion(message, userData, behaviorPatterns, language),
        actionTaken: 'productivity_suggestion',
        actionResult: { suggestions: generateProductivityActions(userData, behaviorPatterns) },
        needsConfirmation: false,
        needsClarification: false,
        proactiveActions
      };
    }

    // Enhanced search suggestions with learning
    if (detectEnhancedSearchSuggestion(message, userProfile)) {
      return {
        response: generateEnhancedSearchSuggestion(message, language, userProfile),
        actionTaken: 'enhanced_search_suggestion',
        actionResult: { suggestion: generateEnhancedSearchSuggestion(message, language, userProfile) },
        needsConfirmation: false,
        needsClarification: false,
        proactiveActions
      };
    }

    // Check for smart duplicate task warning with enhanced detection
    const smartDuplicate = checkForSmartDuplicateTask(message, userData.tasks, behaviorPatterns);
    if (smartDuplicate) {
      return {
        response: generateSmartDuplicateWarning(smartDuplicate, language),
        actionTaken: 'smart_duplicate_warning',
        actionResult: { duplicateTask: smartDuplicate.task, similarity: smartDuplicate.similarity },
        needsConfirmation: true,
        needsClarification: false,
        proactiveActions
      };
    }

    // Default enhanced AI processing with learning context
    const response = await processWithEnhancedAI(message, null, language, contextData, userData, userProfile);
    return {
      response,
      actionTaken: null,
      actionResult: null,
      needsConfirmation: false,
      needsClarification: false,
      proactiveActions
    };

  } catch (error) {
    console.error("Error in processEnhancedChatWithLearning:", error);
    
    const fallbackResponse = language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
    
    return {
      response: fallbackResponse,
      actionTaken: null,
      actionResult: null,
      needsConfirmation: false,
      needsClarification: false,
      proactiveActions: []
    };
  }
}

// Phase 3: Enhanced task creation with learning
async function processTaskCreationWithLearning(message: string, userId: string, language: string, userData: any, userProfile: any, behaviorPatterns: any) {
  try {
    const taskData = extractEnhancedTaskDataWithLearning(message, userProfile, behaviorPatterns);
    
    // Smart scheduling based on user patterns and calendar
    if (!taskData.due_date) {
      taskData.suggestedDate = suggestOptimalDateWithLearning(userData.events, behaviorPatterns, userProfile);
    }

    // Smart priority suggestion based on user patterns
    if (!taskData.priority || taskData.priority === 'normal') {
      taskData.suggestedPriority = suggestPriorityWithLearning(message, taskData.due_date, behaviorPatterns);
    }

    // Check if we need clarification with learning context
    const missingFields = [];
    if (!taskData.due_date && !taskData.suggestedDate) missingFields.push('due_date');
    if (!taskData.priority && !taskData.suggestedPriority) missingFields.push('priority');

    if (missingFields.length > 0) {
      const clarificationResponse = generateSmartClarificationQuestions(taskData, missingFields, language, userProfile);
      return {
        response: clarificationResponse,
        actionTaken: 'clarify_task_with_learning',
        actionResult: { partialTask: taskData, missingFields, learningContext: userProfile },
        needsConfirmation: false,
        needsClarification: true,
        proactiveActions: generateTaskProactiveActions(taskData, behaviorPatterns)
      };
    }

    // Task ready for confirmation with learning enhancements
    const confirmationResponse = generateEnhancedTaskConfirmation(taskData, language, userProfile);
    return {
      response: confirmationResponse,
      actionTaken: 'parse_task_with_learning',
      actionResult: { pendingTask: taskData, learningEnhancements: true },
      needsConfirmation: true,
      needsClarification: false,
      proactiveActions: generateTaskProactiveActions(taskData, behaviorPatterns)
    };

  } catch (error) {
    console.error("Error in processTaskCreationWithLearning:", error);
    
    const errorResponse = language === 'ar' 
      ? `أعتذر، لم أتمكن من معالجة طلب المهمة. يرجى المحاولة مرة أخرى بتفاصيل أكثر وضوحاً.`
      : `Sorry, I couldn't process the task request. Please try again with clearer details.`;
    
    return {
      response: errorResponse,
      actionTaken: null,
      actionResult: null,
      needsConfirmation: false,
      needsClarification: false,
      proactiveActions: []
    };
  }
}

// Phase 3: Helper functions for enhanced intelligence

function getSearchPatterns(language: string) {
  return language === 'ar' 
    ? ['ما', 'من', 'متى', 'أين', 'كيف', 'حالي', 'آخر', 'مؤخراً', 'اليوم', 'أخبار', 'طقس', 'نتيجة', 'سعر', 'معلومات', 'ابحث', 'بحث']
    : ['what', 'who', 'when', 'where', 'how', 'current', 'latest', 'recent', 'today', 'news', 'weather', 'score', 'price', 'stock', 'update', 'information', 'find', 'search'];
}

function getImagePatterns(language: string) {
  return language === 'ar'
    ? ['أنشئ', 'اصنع', 'ارسم', 'صورة', 'رسم', 'فن']
    : ['generate', 'create', 'make', 'draw', 'image', 'picture', 'photo', 'art', 'illustration'];
}

function analyzeActiveHours(chatHistory: any[]) {
  const hours = chatHistory.map(msg => new Date(msg.created_at).getHours());
  const hourCounts = {};
  hours.forEach(hour => {
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  return Object.entries(hourCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));
}

function analyzeTaskTypes(tasks: any[]) {
  const types = {};
  tasks.forEach(task => {
    const type = categorizeTask(task.title);
    types[type] = (types[type] || 0) + 1;
  });
  return types;
}

function categorizeTask(title: string) {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('shop') || lowerTitle.includes('buy') || lowerTitle.includes('get')) return 'shopping';
  if (lowerTitle.includes('call') || lowerTitle.includes('email') || lowerTitle.includes('message')) return 'communication';
  if (lowerTitle.includes('work') || lowerTitle.includes('job') || lowerTitle.includes('project')) return 'work';
  if (lowerTitle.includes('exercise') || lowerTitle.includes('gym') || lowerTitle.includes('walk')) return 'health';
  return 'general';
}

function analyzeResponsePatterns(chatHistory: any[]) {
  const userMessages = chatHistory.filter(msg => msg.role === 'user');
  if (userMessages.length < 3) return 'normal';
  
  const avgResponseTime = userMessages.reduce((acc, msg, index) => {
    if (index === 0) return acc;
    const timeDiff = new Date(msg.created_at).getTime() - new Date(userMessages[index - 1].created_at).getTime();
    return acc + timeDiff;
  }, 0) / (userMessages.length - 1);
  
  if (avgResponseTime < 30000) return 'quick'; // Less than 30 seconds
  if (avgResponseTime > 300000) return 'slow'; // More than 5 minutes
  return 'normal';
}

function analyzeProcrastination(tasks: any[]) {
  const overdueTasks = tasks.filter(task => {
    if (!task.due_date || task.completed) return false;
    return new Date(task.due_date) < new Date();
  });
  
  const overdueRate = overdueTasks.length / Math.max(tasks.length, 1);
  if (overdueRate > 0.3) return 'high';
  if (overdueRate > 0.1) return 'medium';
  return 'low';
}

function analyzeWeeklyPatterns(chatHistory: any[], tasks: any[]) {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const patterns = {};
  
  [...chatHistory, ...tasks].forEach(item => {
    const day = weekdays[new Date(item.created_at).getDay()];
    patterns[day] = (patterns[day] || 0) + 1;
  });
  
  return patterns;
}

function analyzePriorityPatterns(tasks: any[]) {
  const priorities = {};
  tasks.forEach(task => {
    priorities[task.priority] = (priorities[task.priority] || 0) + 1;
  });
  return priorities;
}

function analyzeEnhancedConversationPatterns(messages: any[]) {
  return {
    frequentTopics: extractTopics(messages),
    taskCreationAttempts: messages.filter(m => m.action_taken?.includes('task')).length,
    searchQueries: messages.filter(m => m.intent?.includes('search')).length,
    timeReferences: extractTimeReferences(messages),
    lastIntent: messages[0]?.intent || null
  };
}

function analyzeEmotionalContext(messages: any[]) {
  const recentMessages = messages.slice(0, 5);
  const urgentWords = ['urgent', 'asap', 'quickly', 'immediately', 'عاجل', 'سريع'];
  const stressWords = ['stressed', 'overwhelmed', 'busy', 'tired', 'متعب', 'مشغول'];
  
  let urgencyScore = 0;
  let stressScore = 0;
  
  recentMessages.forEach(msg => {
    const content = msg.content.toLowerCase();
    urgentWords.forEach(word => {
      if (content.includes(word)) urgencyScore++;
    });
    stressWords.forEach(word => {
      if (content.includes(word)) stressScore++;
    });
  });
  
  if (urgencyScore > 1 || stressScore > 1) return 'stressed';
  if (urgencyScore > 0) return 'urgent';
  return 'neutral';
}

function extractTopics(messages: any[]) {
  const topics = {};
  messages.forEach(msg => {
    const words = msg.content.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 4) {
        topics[word] = (topics[word] || 0) + 1;
      }
    });
  });
  
  return Object.entries(topics)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([topic]) => topic);
}

function extractTimeReferences(messages: any[]) {
  const timeWords = [];
  messages.forEach(msg => {
    const matches = msg.content.match(/\b(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening)\b/gi);
    if (matches) timeWords.push(...matches);
  });
  return timeWords;
}

function analyzeConversationFlow(messages: any[]) {
  if (messages.length < 2) return 'new';
  
  const recentActions = messages.slice(0, 5).map(m => m.action_taken).filter(Boolean);
  
  if (recentActions.includes('clarify_task') || recentActions.includes('clarify_reminder')) {
    return 'clarification_needed';
  }
  
  if (recentActions.includes('parse_task') || recentActions.includes('parse_reminder')) {
    return 'confirmation_pending';
  }
  
  return 'conversation';
}

// Continue with the rest of the helper functions...
// ... keep existing code (all the remaining helper functions from the original file)

// Phase 3: Enhanced AI processing with learning context
async function processWithEnhancedAI(message: string, context: string | null, language: string = 'en', contextData?: any, userData?: any, userProfile?: any) {
  try {
    console.log("🤖 UNIFIED AI BRAIN: Processing with Phase 3 Enhanced AI");
    
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

    // Enhanced system prompt with Phase 3 learning intelligence
    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي متقدم مع ذكاء تعلمي متطور. 

معلومات المستخدم والسياق:
- لدى المستخدم ${userData?.tasks?.length || 0} مهمة نشطة
- لدى المستخدم ${userData?.reminders?.length || 0} تذكير
- لدى المستخدم ${userData?.events?.length || 0} حدث قادم
- أسلوب التواصل المفضل: ${userProfile?.communicationStyle || 'متوازن'}
- مستوى الإنتاجية: ${userData?.productivity?.level || 'جيد'}
- الوقت المفضل: ${userProfile?.preferredTime || 'الصباح'}

استخدم هذه المعلومات لتقديم اقتراحات ذكية ومخصصة. كن ودوداً ومفيداً وذكياً في إجاباتك.`
      : `You are WAKTI, an advanced AI assistant with enhanced learning intelligence.

User Context & Learning Profile:
- User has ${userData?.tasks?.length || 0} active tasks
- User has ${userData?.reminders?.length || 0} reminders  
- User has ${userData?.events?.length || 0} upcoming events
- Communication style: ${userProfile?.communicationStyle || 'balanced'}
- Productivity level: ${userData?.productivity?.level || 'good'}
- Preferred time: ${userProfile?.preferredTime || 'morning'}
- Recent emotional context: ${contextData?.emotionalContext || 'neutral'}

Use this information to provide smart, personalized suggestions. Be friendly, helpful, and intelligent in your responses.`;
    
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
    console.error("🤖 UNIFIED AI BRAIN: Enhanced AI processing error:", error);
    
    // Fallback response
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
  }
}

// Keep all existing helper functions from the original file
// ... keep existing code (all helper functions like executeSearch, checkBrowsingQuota, generateConversationId, etc.)

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

// Enhanced search with learning
async function executeEnhancedSearch(query: string, language: string = 'en', userProfile: any) {
  try {
    const enhancedQuery = enhanceSearchQuery(query, userProfile);
    return await executeSearch(enhancedQuery, language);
  } catch (error) {
    return await executeSearch(query, language);
  }
}

function enhanceSearchQuery(query: string, userProfile: any) {
  // Add user context to search query if relevant
  if (userProfile.interests && userProfile.interests.length > 0) {
    // Could enhance query based on user interests
    return query;
  }
  return query;
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

// Phase 3: Additional helper functions for enhanced intelligence
function analyzeUserInteractionPatterns(userId: string) {
  // This would analyze the user's interaction patterns over time
  return {
    preferredTimeOfDay: 'morning',
    taskCreationPatterns: {},
    complexityLevel: 'intermediate'
  };
}

function generateUserInsights(tasks: any[], reminders: any[], events: any[]) {
  return {
    totalItems: tasks.length + reminders.length + events.length,
    completionRate: tasks.filter(t => t.completed).length / Math.max(tasks.length, 1),
    upcomingDeadlines: tasks.filter(t => t.due_date && !t.completed).length
  };
}

function analyzeProductivity(tasks: any[]) {
  const completed = tasks.filter(t => t.completed).length;
  const total = tasks.length;
  const rate = total > 0 ? completed / total : 0;
  
  return {
    completionRate: rate,
    level: rate > 0.8 ? 'excellent' : rate > 0.6 ? 'good' : rate > 0.4 ? 'average' : 'needs_improvement'
  };
}

function analyzeWorkload(tasks: any[], events: any[]) {
  const activeTasks = tasks.filter(t => !t.completed).length;
  const upcomingEvents = events.length;
  const total = activeTasks + upcomingEvents;
  
  if (total > 20) return 'heavy';
  if (total > 10) return 'moderate';
  return 'light';
}

// Phase 3: Enhanced functions (stubs for now, can be expanded)
function checkForSmartDuplicateTask(message: string, tasks: any[], behaviorPatterns: any) {
  // Enhanced duplicate detection with behavioral patterns
  return null; // Placeholder
}

function detectEnhancedTaskIntent(message: string, userProfile: any, behaviorPatterns: any) {
  // Enhanced task detection with learning
  const basicDetection = detectTaskIntent(message);
  return basicDetection;
}

function detectEnhancedReminderIntent(message: string, userProfile: any, behaviorPatterns: any) {
  // Enhanced reminder detection with learning
  const basicDetection = detectReminderIntent(message);
  return basicDetection;
}

function detectProductivityOpportunity(message: string, userData: any, behaviorPatterns: any) {
  // Detect opportunities to suggest productivity improvements
  return false; // Placeholder
}

function detectEnhancedSearchSuggestion(message: string, userProfile: any) {
  // Enhanced search suggestion with learning
  const basicDetection = detectSearchSuggestion(message);
  return basicDetection;
}

function generateProactiveSuggestions(message: string, userData: any, userProfile: any, behaviorPatterns: any) {
  // Generate proactive suggestions based on patterns
  return []; // Placeholder
}

function generateProductivitySuggestion(message: string, userData: any, behaviorPatterns: any, language: string) {
  // Generate productivity suggestions
  return language === 'ar' ? 'اقتراح إنتاجية' : 'Productivity suggestion';
}

function generateProductivityActions(userData: any, behaviorPatterns: any) {
  // Generate productivity actions
  return [];
}

function generateEnhancedSearchSuggestion(message: string, language: string, userProfile: any) {
  // Generate enhanced search suggestions
  return language === 'ar' ? 'اقتراح بحث محسن' : 'Enhanced search suggestion';
}

function generateSmartDuplicateWarning(smartDuplicate: any, language: string) {
  // Generate smart duplicate warnings
  return language === 'ar' ? 'تحذير ذكي من التكرار' : 'Smart duplicate warning';
}

function extractEnhancedTaskDataWithLearning(message: string, userProfile: any, behaviorPatterns: any) {
  // Enhanced task data extraction with learning
  return extractEnhancedTaskData(message);
}

function suggestOptimalDateWithLearning(events: any[], behaviorPatterns: any, userProfile: any) {
  // Suggest optimal date with learning
  return suggestOptimalDate(events);
}

function suggestPriorityWithLearning(message: string, dueDate: string | null, behaviorPatterns: any) {
  // Suggest priority with learning
  return suggestPriority(message, dueDate);
}

function generateSmartClarificationQuestions(taskData: any, missingFields: string[], language: string, userProfile: any) {
  // Generate smart clarification questions with learning
  return generateClarificationQuestions(taskData, missingFields, language);
}

function generateEnhancedTaskConfirmation(taskData: any, language: string, userProfile: any) {
  // Generate enhanced task confirmation with learning
  return generateTaskConfirmation(taskData, language);
}

function generateTaskProactiveActions(taskData: any, behaviorPatterns: any) {
  // Generate proactive actions for tasks
  return [];
}

function processReminderCreationWithLearning(message: string, userId: string, language: string, userData: any, userProfile: any, behaviorPatterns: any) {
  // Process reminder creation with learning
  return processReminderCreationWithContext(message, userId, language, userData);
}

function analyzeEnhancedChatIntent(message: string, language: string, contextData: any, userData: any, userProfile: any, behaviorPatterns: any) {
  // Analyze enhanced chat intent with learning
  return analyzeSmartChatIntent(message, language, contextData, userData);
}

async function storeEnhancedConversationContext(userId: string, conversationId: string, message: string, response: string, intent: any, actionTaken: any, actionResult: any) {
  // Store enhanced conversation context
  await storeConversationContext(userId, conversationId, message, response, intent);
}

async function updateUserLearningProfile(userId: string, message: string, response: string, intent: any, actionTaken: any) {
  // Update user learning profile based on interactions
  // This would update the ai_user_knowledge table with learned preferences
}

// Keep all existing helper functions from the original implementation
// ... keep existing code (detectTaskIntent, detectReminderIntent, detectSearchSuggestion, extractEnhancedTaskData, etc.)

// Enhanced task detection
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

// Enhanced reminder detection
function detectReminderIntent(message: string) {
  const reminderPatterns = [
    /\bremind\s+me\s+to/i,
    /\bremind\s+me\s+(about|of)/i,
    /\b(create|add|set)\s+(a\s+)?reminder/i,
    /\bdon't\s+forget\s+to/i,
    /\bmake\s+sure\s+(i|to)/i
  ];
  
  return reminderPatterns.some(pattern => pattern.test(message));
}

// Enhanced search suggestion detection
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

// Suggest optimal date based on user's calendar
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

// Suggest priority based on context
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

// Generate clarification questions for missing task details
function generateClarificationQuestions(taskData: any, missingFields: string[], language: string) {
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

// Generate task confirmation
function generateTaskConfirmation(taskData: any, language: string) {
  return language === 'ar'
    ? `لقد أعددت مهمة لك للمراجعة:\n\n**${taskData.title}**\n${taskData.due_date ? `\n📅 تاريخ الاستحقاق: ${formatDate(taskData.due_date, language)}` : ''}${taskData.priority ? `\n🔥 الأولوية: ${translatePriority(taskData.priority, language)}` : ''}${taskData.subtasks?.length > 0 ? `\n\nالمهام الفرعية:\n${taskData.subtasks.map((s: string) => `• ${s}`).join('\n')}` : ''}\n\nيرجى تأكيد ما إذا كنت تريد مني إنشاء هذه المهمة.`
    : `I've prepared a task for you to review:\n\n**${taskData.title}**\n${taskData.due_date ? `\n📅 Due date: ${formatDate(taskData.due_date, language)}` : ''}${taskData.priority ? `\n🔥 Priority: ${taskData.priority}` : ''}${taskData.subtasks?.length > 0 ? `\n\nSubtasks:\n${taskData.subtasks.map((s: string) => `• ${s}`).join('\n')}` : ''}\n\nPlease confirm if you'd like me to create this task.`;
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

// Store conversation context
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

// Process reminder creation with context
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

// Suggest optimal time based on user patterns
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

// Generate reminder clarification questions
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

// Generate reminder confirmation
function generateReminderConfirmation(reminderData: any, language: string) {
  return language === 'ar'
    ? `لقد أعددت تذكيراً لك للمراجعة:\n\n**${reminderData.title}**\n${reminderData.due_date ? `\n📅 تاريخ التذكير: ${formatDate(reminderData.due_date, language)}` : ''}${reminderData.due_time ? `\n⏰ وقت التذكير: ${reminderData.due_time}` : ''}\n\nيرجى تأكيد ما إذا كنت تريد مني إنشاء هذا التذكير.`
    : `I've prepared a reminder for you to review:\n\n**${reminderData.title}**\n${reminderData.due_date ? `\n📅 Reminder date: ${formatDate(reminderData.due_date, language)}` : ''}${reminderData.due_time ? `\n⏰ Reminder time: ${reminderData.due_time}` : ''}\n\nPlease confirm if you'd like me to create this reminder.`;
}

// Smart chat intent analysis
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
