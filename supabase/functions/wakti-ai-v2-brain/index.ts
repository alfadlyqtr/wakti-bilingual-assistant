import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

console.log("🔍 WAKTI AI V2.5 SMART FILE PROCESSING: Enhanced with DeepSeek vision and file analysis");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🎯 WAKTI AI V2.5: === SMART FILE PROCESSING REQUEST START ===");

    const requestBody = await req.json();
    console.log("🎯 WAKTI AI V2.5: ✅ Successfully parsed request body");

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
      confirmTask = false,
      confirmReminder = false,
      pendingTaskData = null,
      pendingReminderData = null
    } = requestBody;

    console.log("🎯 WAKTI AI V2.5: === EXTRACTED FIELDS ===");
    console.log("🎯 WAKTI AI V2.5: Message:", message);
    console.log("🎯 WAKTI AI V2.5: Active Trigger:", activeTrigger);
    console.log("🎯 WAKTI AI V2.5: Confirm Task:", confirmTask);
    console.log("🎯 WAKTI AI V2.5: Confirm Reminder:", confirmReminder);

    // Handle task/reminder confirmations
    if (confirmTask && pendingTaskData) {
      console.log("🔧 Creating confirmed task:", pendingTaskData);
      const taskResult = await createTaskFromData(userId, pendingTaskData, language);
      
      const response = taskResult.success 
        ? (language === 'ar' ? `✅ تم إنشاء المهمة "${pendingTaskData.title}" بنجاح!` : `✅ Task "${pendingTaskData.title}" created successfully!`)
        : (taskResult.message || (language === 'ar' ? 'فشل في إنشاء المهمة' : 'Failed to create task'));

      return new Response(JSON.stringify({
        response,
        conversationId: conversationId || generateConversationId(),
        intent: 'task_created',
        confidence: 'high',
        actionTaken: 'create_task',
        actionResult: taskResult,
        browsingUsed: false,
        success: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (confirmReminder && pendingReminderData) {
      console.log("🔔 Creating confirmed reminder:", pendingReminderData);
      const reminderResult = await createReminderFromData(userId, pendingReminderData, language);
      
      const response = reminderResult.success 
        ? (language === 'ar' ? `✅ تم إنشاء التذكير "${pendingReminderData.title}" بنجاح!` : `✅ Reminder "${pendingReminderData.title}" created successfully!`)
        : (reminderResult.message || (language === 'ar' ? 'فشل في إنشاء التذكير' : 'Failed to create reminder'));

      return new Response(JSON.stringify({
        response,
        conversationId: conversationId || generateConversationId(),
        intent: 'reminder_created',
        confidence: 'high',
        actionTaken: 'create_reminder',
        actionResult: reminderResult,
        browsingUsed: false,
        success: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("🎯 WAKTI AI V2.5: === STARTING ENHANCED INTELLIGENCE ANALYSIS ===");

    const triggerResult = analyzeUltraStrictTrigger(message, activeTrigger, language);
    console.log("🎯 WAKTI AI V2.5: Trigger analysis result:", triggerResult);

    const response = await processWithEnhancedIntelligence(
      message,
      userId,
      language,
      conversationId,
      inputType,
      conversationHistory,
      confirmSearch,
      activeTrigger,
      textGenParams,
      attachedFiles || []
    );

    console.log("🎯 WAKTI AI V2.5: === PROCESSING COMPLETE ===");

    const result = {
      response: response.response,
      conversationId: response.conversationId || conversationId || generateConversationId(),
      intent: triggerResult.intent,
      confidence: triggerResult.confidence,
      actionTaken: response.actionTaken,
      actionResult: response.actionResult,
      imageUrl: response.imageUrl,
      browsingUsed: response.browsingUsed,
      browsingData: response.browsingData,
      quotaStatus: response.quotaStatus,
      requiresSearchConfirmation: response.requiresSearchConfirmation,
      needsConfirmation: false,
      needsClarification: false,
      pendingTask: response.pendingTask,
      pendingReminder: response.pendingReminder,
      requiresTaskConfirmation: response.requiresTaskConfirmation,
      requiresReminderConfirmation: response.requiresReminderConfirmation,
      success: true
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🎯 WAKTI AI V2.5: Error processing request:", error);
    
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

// Enhanced intelligence detection for tasks and reminders
function detectSmartActionableIntent(message: string, language: string = 'en', conversationHistory: any[] = []) {
  const lowerMessage = message.toLowerCase();
  
  // Enhanced task creation patterns - much more comprehensive
  const taskPatterns = [
    // Direct task commands
    'create task', 'add task', 'new task', 'make task', 'task to', 'add to my tasks',
    'need to do', 'have to do', 'should do', 'must do', 'i need to',
    'todo', 'to do', 'remind me to do',
    
    // Shopping patterns - key missing piece!
    'go shopping', 'shopping at', 'shop at', 'shopping for', 'shopping list',
    'buy', 'purchase', 'get from store', 'pick up from', 'need to buy',
    'groceries', 'grocery shopping', 'supermarket', 'mall', 'store',
    
    // Work/appointment patterns
    'schedule', 'appointment', 'meeting', 'call', 'visit',
    'work on', 'project', 'assignment', 'homework',
    
    // Personal tasks
    'clean', 'organize', 'pay', 'fix', 'repair', 'book', 'reserve',
    
    // Arabic patterns
    'أنشئ مهمة', 'أضف مهمة', 'مهمة جديدة', 'يجب أن أفعل', 'أحتاج أن',
    'تسوق', 'شراء', 'اشتري', 'احصل على', 'من المتجر'
  ];
  
  // Enhanced reminder patterns
  const reminderPatterns = [
    'remind me', 'set reminder', 'reminder to', 'reminder for', 'alert me',
    'notify me', 'ping me', 'remember to', 'don\'t forget', 'make sure to',
    'ذكرني', 'تذكير', 'لا تنس', 'نبهني', 'تذكر أن'
  ];
  
  // Search suggestion patterns - when user asks for current info
  const searchSuggestionPatterns = [
    'who won', 'what happened', 'latest news', 'current score', 'weather',
    'stock price', 'what time', 'when is', 'how much', 'where is',
    'game last night', 'match result', 'election results', 'breaking news'
  ];
  
  // Check for search suggestions first
  if (searchSuggestionPatterns.some(pattern => lowerMessage.includes(pattern))) {
    return { 
      type: 'search_suggestion', 
      confidence: 'high',
      suggestion: language === 'ar' 
        ? 'يبدو أنك تبحث عن معلومات حديثة. جرب وضع البحث للحصول على أحدث النتائج!'
        : 'It looks like you\'re asking for current information. Try Search mode to get the latest results!'
    };
  }
  
  // Check for task patterns
  const hasTaskPattern = taskPatterns.some(pattern => lowerMessage.includes(pattern));
  if (hasTaskPattern) {
    return { type: 'task', confidence: 'high' };
  }
  
  // Check for reminder patterns
  const hasReminderPattern = reminderPatterns.some(pattern => lowerMessage.includes(pattern));
  if (hasReminderPattern) {
    return { type: 'reminder', confidence: 'high' };
  }
  
  // Context-aware detection from conversation history
  if (conversationHistory && conversationHistory.length > 0) {
    const recentContext = conversationHistory.slice(-2).map(h => h.content?.toLowerCase() || '').join(' ');
    if (recentContext.includes('task') || recentContext.includes('todo')) {
      // If recent conversation was about tasks, be more lenient
      if (lowerMessage.includes('yes') || lowerMessage.includes('create') || lowerMessage.includes('add')) {
        return { type: 'task', confidence: 'medium' };
      }
    }
  }
  
  return { type: 'none', confidence: 'low' };
}

// Enhanced date/time extraction with better natural language processing
function extractEnhancedDateTimeDetails(message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Enhanced date patterns with more natural language
  const datePatterns = {
    'today': new Date(),
    'tomorrow': new Date(Date.now() + 24 * 60 * 60 * 1000),
    'next week': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    'this weekend': getNextWeekend(),
    'next weekend': getNextWeekend(true),
    'monday': getNextWeekday(1),
    'tuesday': getNextWeekday(2),
    'wednesday': getNextWeekday(3),
    'thursday': getNextWeekday(4),
    'friday': getNextWeekday(5),
    'saturday': getNextWeekday(6),
    'sunday': getNextWeekday(0),
    'next monday': getNextWeekday(1, true),
    'next tuesday': getNextWeekday(2, true),
    'next wednesday': getNextWeekday(3, true),
    'next thursday': getNextWeekday(4, true),
    'next friday': getNextWeekday(5, true),
    'next saturday': getNextWeekday(6, true),
    'next sunday': getNextWeekday(0, true),
    'اليوم': new Date(),
    'غداً': new Date(Date.now() + 24 * 60 * 60 * 1000),
    'غدا': new Date(Date.now() + 24 * 60 * 60 * 1000)
  };
  
  let extractedDate = null;
  for (const [pattern, date] of Object.entries(datePatterns)) {
    if (lowerMessage.includes(pattern)) {
      extractedDate = date.toISOString().split('T')[0];
      break;
    }
  }
  
  // Enhanced time extraction with more formats
  const timeMatch = lowerMessage.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|ص|م)?|(\d{1,2})\s*(o'?clock|am|pm|ص|م)/i);
  let extractedTime = null;
  if (timeMatch) {
    const hour = parseInt(timeMatch[1] || timeMatch[4]);
    const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3] || timeMatch[5];
    
    let adjustedHour = hour;
    if (period && (period.toLowerCase().includes('pm') || period === 'م') && hour !== 12) {
      adjustedHour += 12;
    } else if (period && (period.toLowerCase().includes('am') || period === 'ص') && hour === 12) {
      adjustedHour = 0;
    }
    
    extractedTime = `${adjustedHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }
  
  // Enhanced priority extraction with context
  const priorityPatterns = {
    'urgent': 'urgent',
    'asap': 'urgent',
    'immediately': 'urgent',
    'emergency': 'urgent',
    'high priority': 'high',
    'important': 'high',
    'critical': 'high',
    'low priority': 'low',
    'when I have time': 'low',
    'eventually': 'low',
    'عاجل': 'urgent',
    'مهم': 'high',
    'أولوية عالية': 'high'
  };
  
  let priority = 'normal';
  for (const [pattern, level] of Object.entries(priorityPatterns)) {
    if (lowerMessage.includes(pattern)) {
      priority = level;
      break;
    }
  }

  // Enhanced subtask extraction for shopping and other contexts
  const subtasks = extractEnhancedSubtasks(message);
  
  return {
    date: extractedDate,
    time: extractedTime,
    priority: priority,
    subtasks: subtasks
  };
}

// Helper functions for date calculations
function getNextWeekday(targetDay: number, nextWeek: boolean = false) {
  const today = new Date();
  const currentDay = today.getDay();
  let daysUntilTarget = (targetDay - currentDay + 7) % 7;
  
  if (daysUntilTarget === 0 && !nextWeek) {
    daysUntilTarget = 7; // If it's the same day, get next week's occurrence
  } else if (nextWeek) {
    daysUntilTarget += 7; // Force next week
  }
  
  const nextWeekday = new Date(today.getTime() + daysUntilTarget * 24 * 60 * 60 * 1000);
  return nextWeekday;
}

function getNextWeekend(nextWeek: boolean = false) {
  const saturday = getNextWeekday(6, nextWeek);
  return saturday;
}

// Enhanced subtask extraction with better parsing
function extractEnhancedSubtasks(message: string): string[] {
  const subtasks: string[] = [];
  
  // Enhanced shopping list detection
  const shoppingPatterns = [
    /(?:buy|get|purchase|pick up|need)\s+(.+?)(?:\s+(?:from|at|in)\s+\w+|$)/gi,
    /shopping\s+(?:list|for):\s*(.+)/gi,
    /groceries:\s*(.+)/gi
  ];
  
  for (const pattern of shoppingPatterns) {
    const matches = message.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const items = match
          .replace(/^(buy|get|purchase|pick up|need|shopping for|shopping list|groceries):\s*/gi, '')
          .replace(/\s+(?:from|at|in)\s+\w+.*$/gi, '') // Remove location
          .split(/[,&]|\s+and\s+/)
          .map(item => item.trim())
          .filter(item => item.length > 0 && item.length < 50);
        
        subtasks.push(...items);
      });
    }
  }
  
  // Generic list detection
  const listMatches = message.match(/:\s*(.+)$/);
  if (listMatches && subtasks.length === 0) {
    const items = listMatches[1]
      .split(/[,&]|\s+and\s+/)
      .map(item => item.trim())
      .filter(item => item.length > 0 && item.length < 50);
    subtasks.push(...items);
  }
  
  // Bullet point detection
  const bulletMatches = message.match(/[-•*]\s*([^-•*\n]+)/g);
  if (bulletMatches) {
    bulletMatches.forEach(match => {
      const item = match.replace(/^[-•*]\s*/, '').trim();
      if (item && !subtasks.includes(item)) {
        subtasks.push(item);
      }
    });
  }
  
  return subtasks.slice(0, 10); // Limit to 10 subtasks
}

// Enhanced task parsing with better context understanding
function parseEnhancedTaskFromMessage(message: string, language: string = 'en') {
  const details = extractEnhancedDateTimeDetails(message);
  
  // Enhanced title extraction with context awareness
  let title = extractTaskTitle(message, language);
  
  // Enhanced description extraction
  const description = extractTaskDescription(message, title);
  
  return {
    title: title,
    description: description || undefined,
    due_date: details.date || undefined,
    due_time: details.time || undefined,
    priority: details.priority as 'normal' | 'high' | 'urgent',
    task_type: 'one-time' as const,
    subtasks: details.subtasks
  };
}

function extractTaskTitle(message: string, language: string): string {
  const lowerMessage = message.toLowerCase();
  
  // Shopping context
  if (lowerMessage.includes('shopping') || lowerMessage.includes('buy') || lowerMessage.includes('groceries')) {
    const locationMatch = message.match(/(?:shopping|shop|buy|groceries)\s+(?:at|from|in)\s+([^,\.!?]+)/i);
    if (locationMatch) {
      return `Shopping at ${locationMatch[1].trim()}`;
    }
    return language === 'ar' ? 'تسوق' : 'Shopping';
  }
  
  // Remove task creation phrases and extract core task
  let title = message
    .replace(/(create task|add task|new task|make task|task to|need to do|have to do|should do|must do|i need to|remind me to)/gi, '')
    .replace(/(أنشئ مهمة|أضف مهمة|مهمة جديدة|يجب أن أفعل|أحتاج أن|ذكرني أن)/gi, '')
    .replace(/(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|اليوم|غداً|غدا)/gi, '')
    .replace(/(\d{1,2}):?(\d{2})?\s*(am|pm|ص|م)?/gi, '')
    .replace(/(urgent|high priority|important|low priority|عاجل|مهم|أولوية عالية)/gi, '')
    .replace(/:\s*.*$/, '') // Remove subtask list
    .trim();
  
  // Clean up common words at the start
  title = title.replace(/^(to|that|about|for|بأن|عن|أن|ل|إلى)\s+/gi, '');
  
  if (!title || title.length < 3) {
    title = language === 'ar' ? 'مهمة جديدة' : 'New Task';
  }
  
  // Capitalize first letter
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function extractTaskDescription(message: string, title: string): string | null {
  // Look for additional context that's not part of the title
  const remainingText = message.replace(title, '').trim();
  
  // Look for description patterns
  const descriptionMatch = remainingText.match(/(?:description|desc|details|notes?):\s*([^:]+)/i);
  if (descriptionMatch) {
    return descriptionMatch[1].trim();
  }
  
  // Extract context that provides more details
  const cleanText = remainingText
    .replace(/(create task|add task|new task|today|tomorrow|urgent|important)/gi, '')
    .replace(/:\s*.*$/, '') // Remove lists
    .trim();
  
  return cleanText.length > 10 && cleanText.length < 200 ? cleanText : null;
}

// Enhanced reminder parsing
function parseEnhancedReminderFromMessage(message: string, language: string = 'en') {
  const details = extractEnhancedDateTimeDetails(message);
  
  // Extract reminder title
  let title = message
    .replace(/(remind me|set reminder|reminder to|reminder for|don't forget|alert me|notify me|ping me|remember to)/gi, '')
    .replace(/(ذكرني|تذكير|لا تنس|نبهني|تذكر)/gi, '')
    .replace(/(today|tomorrow|next week|اليوم|غداً|غدا)/gi, '')
    .replace(/(\d{1,2}):?(\d{2})?\s*(am|pm|ص|م)?/gi, '')
    .replace(/^(to|that|about|بأن|عن|أن)/gi, '')
    .trim();
  
  if (!title || title.length < 3) {
    title = language === 'ar' ? 'تذكير جديد' : 'New Reminder';
  }
  
  const description = extractTaskDescription(message, title);
  
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    description: description || undefined,
    due_date: details.date || undefined,
    due_time: details.time || undefined
  };
}

// Enhanced intent detection function with better parsing
function detectActionableIntent(message: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  // Task creation patterns
  const taskPatterns = [
    'create task', 'add task', 'new task', 'make task', 'task to',
    'need to do', 'have to do', 'should do', 'must do', 'i need to',
    'أنشئ مهمة', 'أضف مهمة', 'مهمة جديدة', 'يجب أن أفعل', 'أحتاج أن'
  ];
  
  // Reminder patterns
  const reminderPatterns = [
    'remind me', 'set reminder', 'reminder to', 'don\'t forget',
    'alert me', 'notify me', 'ping me', 'remember to',
    'ذكرني', 'تذكير', 'لا تنس', 'نبهني', 'تذكر'
  ];
  
  // Calendar/Event patterns (for future use)
  const eventPatterns = [
    'schedule', 'meeting', 'appointment', 'event', 'calendar',
    'book', 'reserve', 'plan for',
    'اجدول', 'اجتماع', 'موعد', 'حدث', 'تقويم'
  ];
  
  if (taskPatterns.some(pattern => lowerMessage.includes(pattern))) {
    return { type: 'task', confidence: 'high' };
  }
  
  if (reminderPatterns.some(pattern => lowerMessage.includes(pattern))) {
    return { type: 'reminder', confidence: 'high' };
  }
  
  if (eventPatterns.some(pattern => lowerMessage.includes(pattern))) {
    return { type: 'event', confidence: 'medium' };
  }
  
  return { type: 'none', confidence: 'low' };
}

// Enhanced date/time extraction function
function extractDateTimeDetails(message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Enhanced date patterns
  const datePatterns = {
    'today': new Date(),
    'tomorrow': new Date(Date.now() + 24 * 60 * 60 * 1000),
    'next week': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    'next monday': getNextWeekday(1),
    'next tuesday': getNextWeekday(2),
    'next wednesday': getNextWeekday(3),
    'next thursday': getNextWeekday(4),
    'next friday': getNextWeekday(5),
    'next saturday': getNextWeekday(6),
    'next sunday': getNextWeekday(0),
    'اليوم': new Date(),
    'غداً': new Date(Date.now() + 24 * 60 * 60 * 1000),
    'غدا': new Date(Date.now() + 24 * 60 * 60 * 1000)
  };
  
  let extractedDate = null;
  for (const [pattern, date] of Object.entries(datePatterns)) {
    if (lowerMessage.includes(pattern)) {
      extractedDate = date.toISOString().split('T')[0];
      break;
    }
  }
  
  // Enhanced time extraction
  const timeMatch = lowerMessage.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|ص|م)?/i);
  let extractedTime = null;
  if (timeMatch) {
    const hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3];
    
    let adjustedHour = hour;
    if (period && (period.toLowerCase() === 'pm' || period === 'م') && hour !== 12) {
      adjustedHour += 12;
    } else if (period && (period.toLowerCase() === 'am' || period === 'ص') && hour === 12) {
      adjustedHour = 0;
    }
    
    extractedTime = `${adjustedHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }
  
  // Enhanced priority extraction
  const priorityPatterns = {
    'urgent': 'urgent',
    'high priority': 'high',
    'important': 'high',
    'low priority': 'low',
    'asap': 'urgent',
    'عاجل': 'urgent',
    'مهم': 'high',
    'أولوية عالية': 'high'
  };
  
  let priority = 'normal';
  for (const [pattern, level] of Object.entries(priorityPatterns)) {
    if (lowerMessage.includes(pattern)) {
      priority = level;
      break;
    }
  }

  // Extract subtasks
  const subtasks = extractSubtasks(message);
  
  return {
    date: extractedDate,
    time: extractedTime,
    priority: priority,
    subtasks: subtasks
  };
}

// Helper function to get next weekday
function getNextWeekday(targetDay: number) {
  const today = new Date();
  const currentDay = today.getDay();
  const daysUntilTarget = (targetDay - currentDay + 7) % 7;
  const nextWeekday = new Date(today.getTime() + daysUntilTarget * 24 * 60 * 60 * 1000);
  return nextWeekday;
}

// Extract subtasks from message
function extractSubtasks(message: string): string[] {
  const subtasks: string[] = [];
  
  // Look for colon-separated lists: "buy groceries: milk, bread, eggs"
  const colonMatch = message.match(/:\s*(.+)$/);
  if (colonMatch) {
    const items = colonMatch[1].split(',').map(item => item.trim()).filter(item => item.length > 0);
    subtasks.push(...items);
  }
  
  // Look for bullet points or numbered lists
  const bulletMatches = message.match(/[-•*]\s*([^-•*\n]+)/g);
  if (bulletMatches) {
    bulletMatches.forEach(match => {
      const item = match.replace(/^[-•*]\s*/, '').trim();
      if (item && !subtasks.includes(item)) {
        subtasks.push(item);
      }
    });
  }
  
  return subtasks;
}

// New function to parse structured task data
function parseTaskFromMessage(message: string, language: string = 'en') {
  const details = extractDateTimeDetails(message);
  
  // Extract title by removing common task creation phrases
  let title = message
    .replace(/(create task|add task|new task|make task|task to|need to do|have to do|should do|must do|i need to)/gi, '')
    .replace(/(أنشئ مهمة|أضف مهمة|مهمة جديدة|يجب أن أفعل|أحتاج أن)/gi, '')
    .replace(/(today|tomorrow|next week|اليوم|غداً|غدا)/gi, '')
    .replace(/(\d{1,2}):?(\d{2})?\s*(am|pm|ص|م)?/gi, '')
    .replace(/(urgent|high priority|important|low priority|عاجل|مهم|أولوية عالية)/gi, '')
    .replace(/:\s*.*$/, '') // Remove subtask list
    .trim();
  
  if (!title || title.length < 3) {
    title = language === 'ar' ? 'مهمة جديدة' : 'New Task';
  }

  // Extract description (text after title but before subtasks)
  const description = extractDescription(message, title);
  
  return {
    title: title,
    description: description || undefined,
    due_date: details.date || undefined,
    due_time: details.time || undefined,
    priority: details.priority as 'normal' | 'high' | 'urgent',
    task_type: 'one-time' as const,
    subtasks: details.subtasks
  };
}

// New function to parse structured reminder data
function parseReminderFromMessage(message: string, language: string = 'en') {
  const details = extractDateTimeDetails(message);
  
  // Extract title by removing common reminder phrases
  let title = message
    .replace(/(remind me|set reminder|reminder to|don't forget|alert me|notify me|ping me|remember to)/gi, '')
    .replace(/(ذكرني|تذكير|لا تنس|نبهني|تذكر)/gi, '')
    .replace(/(today|tomorrow|next week|اليوم|غداً|غدا)/gi, '')
    .replace(/(\d{1,2}):?(\d{2})?\s*(am|pm|ص|م)?/gi, '')
    .replace(/^(to|that|about|بأن|عن|أن)/gi, '')
    .trim();
  
  if (!title || title.length < 3) {
    title = language === 'ar' ? 'تذكير جديد' : 'New Reminder';
  }

  const description = extractDescription(message, title);
  
  return {
    title: title,
    description: description || undefined,
    due_date: details.date || undefined,
    due_time: details.time || undefined
  };
}

// Extract description from message
function extractDescription(message: string, title: string): string | null {
  // Remove title from message and see if there's additional descriptive text
  const remainingText = message.replace(title, '').trim();
  
  // Look for descriptive phrases
  const descriptionMatches = remainingText.match(/(?:about|for|regarding|description|desc):\s*([^:]+)/i);
  if (descriptionMatches) {
    return descriptionMatches[1].trim();
  }
  
  // If there's additional text that's not time/date/priority related, use as description
  const cleanText = remainingText
    .replace(/(today|tomorrow|next week|اليوم|غداً|غدا)/gi, '')
    .replace(/(\d{1,2}):?(\d{2})?\s*(am|pm|ص|م)?/gi, '')
    .replace(/(urgent|high priority|important|low priority|عاجل|مهم|أولوية عالية)/gi, '')
    .replace(/:\s*.*$/, '') // Remove subtask list
    .trim();
  
  return cleanText.length > 10 ? cleanText : null;
}

// New function to create task from structured data
async function createTaskFromData(userId: string, taskData: any, language: string = 'en') {
  try {
    console.log("🔧 Creating task from structured data:", taskData);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('User not authenticated');
    }
    
    const sanitizedData = {
      ...taskData,
      user_id: user.id,
      completed: false,
      due_time: taskData.due_time === '' ? null : taskData.due_time,
      description: taskData.description === '' ? null : taskData.description
    };
    
    const { data, error } = await supabase
      .from('tr_tasks')
      .insert([sanitizedData])
      .select()
      .single();
    
    if (error) {
      console.error('Task creation error:', error);
      throw new Error(`Failed to create task: ${error.message}`);
    }
    
    console.log("✅ Task created successfully:", data);
    return {
      success: true,
      task: data,
      message: language === 'ar' 
        ? `تم إنشاء المهمة "${taskData.title}" بنجاح` 
        : `Task "${taskData.title}" created successfully`
    };
    
  } catch (error) {
    console.error('Error creating task from data:', error);
    return {
      success: false,
      error: error.message,
      message: language === 'ar' 
        ? 'فشل في إنشاء المهمة' 
        : 'Failed to create task'
    };
  }
}

// New function to create reminder from structured data
async function createReminderFromData(userId: string, reminderData: any, language: string = 'en') {
  try {
    console.log("🔔 Creating reminder from structured data:", reminderData);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('User not authenticated');
    }
    
    const sanitizedData = {
      ...reminderData,
      user_id: user.id,
      due_time: reminderData.due_time === '' ? null : reminderData.due_time
    };
    
    const { data, error } = await supabase
      .from('tr_reminders')
      .insert([sanitizedData])
      .select()
      .single();
    
    if (error) {
      console.error('Reminder creation error:', error);
      throw new Error(`Failed to create reminder: ${error.message}`);
    }
    
    console.log("✅ Reminder created successfully:", data);
    return {
      success: true,
      reminder: data,
      message: language === 'ar' 
        ? `تم إنشاء التذكير "${reminderData.title}" بنجاح` 
        : `Reminder "${reminderData.title}" created successfully`
    };
    
  } catch (error) {
    console.error('Error creating reminder from data:', error);
    return {
      success: false,
      error: error.message,
      message: language === 'ar' 
        ? 'فشل في إنشاء التذكير' 
        : 'Failed to create reminder'
    };
  }
}

// Fixed image analysis with proper DeepSeek vision model and authenticated file access
async function analyzeImageWithDeepSeek(fileName: string, imageUrl: string): Promise<string> {
  try {
    console.log("🖼️ Analyzing image with DeepSeek vision:", fileName);
    
    if (!DEEPSEEK_API_KEY) {
      console.log("🖼️ DeepSeek API key not available, falling back to OpenAI");
      return await analyzeImageWithOpenAI(fileName, imageUrl);
    }

    // Download image using authenticated Supabase client
    const imageData = await downloadImageFromSupabase(imageUrl);
    if (!imageData) {
      throw new Error('Failed to download image from Supabase storage');
    }

    // Convert to base64 efficiently
    const base64Image = await optimizedArrayBufferToBase64(imageData);
    
    // Use correct DeepSeek vision API - they use deepseek-vl model for vision
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-vl', // Fixed: Use vision model instead of chat model
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this image in detail. Describe what you see, including objects, people, text, colors, composition, and any other relevant details.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log("🖼️ DeepSeek vision failed:", errorText, "falling back to OpenAI");
      return await analyzeImageWithOpenAI(fileName, imageUrl);
    }

    const result = await response.json();
    const analysis = result.choices?.[0]?.message?.content;
    
    if (!analysis) {
      throw new Error('No analysis received from DeepSeek vision');
    }

    console.log("🖼️ DeepSeek vision analysis completed successfully");
    return `📸 **Image Analysis for ${fileName}:**\n\n${analysis}`;

  } catch (error) {
    console.error("🖼️ Error analyzing image with DeepSeek:", error);
    return await analyzeImageWithOpenAI(fileName, imageUrl);
  }
}

// Fixed OpenAI vision with proper authenticated file access
async function analyzeImageWithOpenAI(fileName: string, imageUrl: string): Promise<string> {
  try {
    console.log("🖼️ Analyzing image with OpenAI vision:", fileName);
    
    if (!OPENAI_API_KEY) {
      return `📸 **Image uploaded: ${fileName}**\n\nImage analysis is currently unavailable. The image has been received but cannot be analyzed at this time.`;
    }

    // Download image using authenticated Supabase client
    const imageData = await downloadImageFromSupabase(imageUrl);
    if (!imageData) {
      throw new Error('Failed to download image from Supabase storage');
    }

    // Convert to base64 efficiently
    const base64Image = await optimizedArrayBufferToBase64(imageData);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this image in detail. Describe what you see, including objects, people, text, colors, composition, and any other relevant details.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("🖼️ OpenAI API failed:", errorText);
      throw new Error(`OpenAI API failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const analysis = result.choices?.[0]?.message?.content;
    
    if (!analysis) {
      throw new Error('No analysis received from OpenAI');
    }

    console.log("🖼️ OpenAI vision analysis completed successfully");
    return `📸 **Image Analysis for ${fileName}:**\n\n${analysis}`;

  } catch (error) {
    console.error("🖼️ Error analyzing image with OpenAI:", error);
    return `📸 **Image uploaded: ${fileName}**\n\nUnable to analyze the image content at this time due to: ${error.message}. The image has been received.`;
  }
}

// New function to download images from Supabase storage with authentication
async function downloadImageFromSupabase(imageUrl: string): Promise<ArrayBuffer | null> {
  try {
    console.log("📥 Downloading image from Supabase storage:", imageUrl);
    
    // Extract bucket and path from the URL
    const urlParts = imageUrl.split('/');
    const bucketIndex = urlParts.findIndex(part => part === 'message-media');
    
    if (bucketIndex === -1) {
      // If it's not a Supabase storage URL, try direct download
      console.log("📥 Not a Supabase storage URL, trying direct download");
      const response = await fetch(imageUrl, {
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }
      
      return await response.arrayBuffer();
    }
    
    const bucket = urlParts[bucketIndex];
    const filePath = urlParts.slice(bucketIndex + 1).join('/');
    
    console.log("📥 Downloading from bucket:", bucket, "path:", filePath);
    
    // Use Supabase storage client to download with authentication
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);
    
    if (error) {
      console.error("📥 Supabase storage download error:", error);
      throw new Error(`Supabase storage error: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('No data received from Supabase storage');
    }
    
    console.log("📥 Successfully downloaded image, size:", data.size);
    return await data.arrayBuffer();
    
  } catch (error) {
    console.error("📥 Error downloading image from Supabase:", error);
    return null;
  }
}

// Optimized base64 conversion that prevents stack overflow
async function optimizedArrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  try {
    console.log("🔄 Converting image to base64, size:", buffer.byteLength);
    
    // For very large images, resize them first to prevent memory issues
    if (buffer.byteLength > 5 * 1024 * 1024) { // 5MB
      console.log("🔄 Large image detected, will resize before conversion");
      buffer = await resizeImage(buffer);
    }
    
    // Use efficient conversion method
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    
    // Process in chunks to prevent stack overflow
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64 = btoa(binary);
    console.log("🔄 Base64 conversion completed, length:", base64.length);
    return base64;
    
  } catch (error) {
    console.error("🔄 Error in base64 conversion:", error);
    throw new Error(`Base64 conversion failed: ${error.message}`);
  }
}

// Simple image resizing function to prevent memory issues
async function resizeImage(buffer: ArrayBuffer, maxSize: number = 2048): Promise<ArrayBuffer> {
  try {
    console.log("🖼️ Resizing large image to prevent memory issues");
    
    // Create a blob from the buffer
    const blob = new Blob([buffer]);
    
    // Create an image element
    const img = new Image();
    const canvas = new OffscreenCanvas(maxSize, maxSize);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }
    
    // Load the image
    const imageBitmap = await createImageBitmap(blob);
    
    // Calculate new dimensions while maintaining aspect ratio
    let { width, height } = imageBitmap;
    
    if (width > maxSize || height > maxSize) {
      const ratio = Math.min(maxSize / width, maxSize / height);
      width = Math.floor(width * ratio);
      height = Math.floor(height * ratio);
    }
    
    // Resize canvas and draw
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(imageBitmap, 0, 0, width, height);
    
    // Convert back to buffer
    const resizedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    const resizedBuffer = await resizedBlob.arrayBuffer();
    
    console.log("🖼️ Image resized from", buffer.byteLength, "to", resizedBuffer.byteLength, "bytes");
    return resizedBuffer;
    
  } catch (error) {
    console.error("🖼️ Error resizing image:", error);
    // If resizing fails, return original buffer
    return buffer;
  }
}

// Process attached files without recursion
async function processAttachedFiles(attachedFiles: any[]): Promise<string> {
  if (!attachedFiles || attachedFiles.length === 0) {
    return '';
  }

  console.log("📁 WAKTI AI V2.5: Processing attached files...");
  console.log("📁 WAKTI AI V2.5: Processing", attachedFiles.length, "attached files");

  const fileAnalysis: string[] = [];

  for (const file of attachedFiles) {
    console.log("📁 Processing file:", file.name, "Type:", file.type);
    
    try {
      if (file.type.startsWith('image/')) {
        console.log("🖼️ Processing image file:", file.name);
        const analysis = await analyzeImageWithDeepSeek(file.name, file.url);
        fileAnalysis.push(analysis);
      } else if (file.type === 'application/pdf') {
        console.log("📄 Processing PDF file:", file.name);
        fileAnalysis.push(`📄 **PDF Document: ${file.name}**\n\nPDF analysis is not yet implemented. The document has been received.`);
      } else if (file.type === 'text/plain') {
        console.log("📝 Processing text file:", file.name);
        try {
          const textResponse = await fetch(file.url);
          const textContent = await textResponse.text();
          fileAnalysis.push(`📝 **Text File: ${file.name}**\n\nContent:\n${textContent.substring(0, 2000)}${textContent.length > 2000 ? '...' : ''}`);
        } catch (error) {
          console.error("Error reading text file:", error);
          fileAnalysis.push(`📝 **Text File: ${file.name}**\n\nUnable to read file content.`);
        }
      } else {
        console.log("📎 Processing unknown file type:", file.name);
        fileAnalysis.push(`📎 **File: ${file.name}**\n\nFile type ${file.type} analysis not supported.`);
      }
    } catch (error) {
      console.error("Error processing file:", file.name, error);
      fileAnalysis.push(`❌ **Error processing ${file.name}**\n\nUnable to analyze this file: ${error.message}`);
    }
  }

  const result = fileAnalysis.join('\n\n');
  console.log("📁 Generated file context, length:", result.length);
  
  return result;
}

async function processWithEnhancedIntelligence(
  message: string,
  userId: string,
  language: string = 'en',
  conversationId: string | null = null,
  inputType: 'text' | 'voice' = 'text',
  conversationHistory: any[] = [],
  confirmSearch: boolean = false,
  activeTrigger: string = 'chat',
  textGenParams: any = null,
  attachedFiles: any[] = []
) {
  const triggerResult = analyzeUltraStrictTrigger(message, activeTrigger, language);
  
  console.log("💬 WAKTI AI V2.5: Enhanced Intelligence Processing");
  console.log("💬 WAKTI AI V2.5: Strict Mode:", triggerResult.strictMode);
  console.log("💬 WAKTI AI V2.5: Conversation History Length:", conversationHistory?.length || 0);

  let fileContext = '';
  if (attachedFiles && attachedFiles.length > 0) {
    console.log("📁 WAKTI AI V2.5: Processing attached files...");
    fileContext = await processAttachedFiles(attachedFiles);
  }

  // Enhanced actionable intent detection with search suggestions
  let actionResult = null;
  let actionTaken = null;
  let pendingTask = null;
  let pendingReminder = null;
  let requiresTaskConfirmation = false;
  let requiresReminderConfirmation = false;
  
  try {
    const intent = detectSmartActionableIntent(message, language, conversationHistory);
    console.log("🎯 Enhanced intent detected:", intent);
    
    if (intent.type === 'search_suggestion') {
      console.log("🔍 Suggesting search mode for current information");
      actionTaken = 'search_suggestion';
      actionResult = {
        success: true,
        suggestion: intent.suggestion
      };
    } else if (intent.type === 'task' && intent.confidence === 'high') {
      console.log("🔧 Parsing task data for confirmation...");
      pendingTask = parseEnhancedTaskFromMessage(message, language);
      requiresTaskConfirmation = true;
      actionTaken = 'parse_task';
      
      actionResult = {
        success: true,
        pendingTask: pendingTask,
        message: language === 'ar' 
          ? `تم تحليل طلب إنشاء المهمة. يرجى مراجعة التفاصيل والتأكيد.`
          : `I've parsed your task request. Please review the details and confirm.`
      };
    } else if (intent.type === 'reminder' && intent.confidence === 'high') {
      console.log("🔔 Parsing reminder data for confirmation...");
      pendingReminder = parseEnhancedReminderFromMessage(message, language);
      requiresReminderConfirmation = true;
      actionTaken = 'parse_reminder';
      
      actionResult = {
        success: true,
        pendingReminder: pendingReminder,
        message: language === 'ar' 
          ? `تم تحليل طلب إنشاء التذكير. يرجى مراجعة التفاصيل والتأكيد.`
          : `I've parsed your reminder request. Please review the details and confirm.`
      };
    }
  } catch (error) {
    console.error("❌ Error processing actionable intent:", error);
    actionResult = null;
    actionTaken = null;
  }

  const quotaStatus = await checkBrowsingQuota(userId);

  // Build enhanced context for AI response
  let enhancedMessage = message;
  
  if (actionResult && actionResult.success) {
    if (actionResult.suggestion) {
      // Search suggestion case
      enhancedMessage = `User message: "${message}"\n\nI've detected that the user is asking for current information that would be better answered in Search mode. I should suggest they switch to Search mode and also provide a helpful general response about their query.`;
    } else if (requiresTaskConfirmation || requiresReminderConfirmation) {
      // Task/reminder confirmation case
      enhancedMessage = `User message: "${message}"\n\nI've detected a ${requiresTaskConfirmation ? 'task' : 'reminder'} creation request and parsed the details. The user will see a confirmation interface to review and approve the ${requiresTaskConfirmation ? 'task' : 'reminder'} creation.\n\nPlease provide a helpful response acknowledging the request and mentioning that they can review and confirm the details in the confirmation card below.`;
    }
  }

  const response = await processWithAI(
    enhancedMessage,
    null, // No search context in chat mode
    language,
    false, // Never allow browsing in chat mode
    activeTrigger,
    fileContext,
    attachedFiles || [],
    conversationHistory // Pass conversation history for context
  );

  console.log("🎯 WAKTI AI V2.5: === ENHANCED INTELLIGENCE SUCCESS ===");

  return {
    response: response,
    conversationId: conversationId || generateConversationId(),
    intent: triggerResult.intent,
    confidence: triggerResult.confidence,
    actionTaken,
    actionResult,
    pendingTask,
    pendingReminder,
    requiresTaskConfirmation,
    requiresReminderConfirmation,
    imageUrl: null,
    browsingUsed: false,
    browsingData: null,
    quotaStatus,
    requiresSearchConfirmation: false
  };
}

function analyzeUltraStrictTrigger(message: string, activeTrigger: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();

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
        allowed: isSearchIntent,
        requiresBrowsing: isSearchIntent,
        strictMode: isSearchIntent ? 'SEARCH_WITH_BROWSING' : 'SEARCH_FORBIDDEN'
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
        allowed: isImageIntent,
        requiresBrowsing: false,
        strictMode: isImageIntent ? 'IMAGE_GENERATION' : 'IMAGE_FORBIDDEN'
      };

    case 'chat':
    default:
      return {
        intent: 'general_chat',
        confidence: 'high',
        allowed: true,
        requiresBrowsing: false,
        strictMode: 'CHAT_NO_BROWSING_EVER'
      };
  }
}

async function processWithAI(
  message: string, 
  context: string | null, 
  language: string = 'en',
  allowBrowsing: boolean = false,
  activeTrigger: string = 'chat',
  fileContext: string = '',
  attachedFiles: any[] = [],
  conversationHistory: any[] = []
) {
  try {
    console.log("🤖 WAKTI AI V2.5: === AI PROCESSING START ===");
    console.log("🤖 WAKTI AI V2.5: Trigger Mode:", activeTrigger);
    console.log("🤖 WAKTI AI V2.5: Allow Browsing:", allowBrowsing);
    console.log("🤖 WAKTI AI V2.5: Has Context:", !!context);
    console.log("🤖 WAKTI AI V2.5: Attached Files:", attachedFiles?.length || 0);
    console.log("🤖 WAKTI AI V2.5: Conversation History:", conversationHistory?.length || 0);

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
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة. تتخصص في المساعدة في المهام اليومية وتقديم معلومات دقيقة ومفيدة. يمكنك أيضاً إنشاء المهام والتذكيرات عندما يطلب المستخدم ذلك. كن ودوداً ومفيداً ومختصراً في إجاباتك. عندما تحتاج للمعلومات الحديثة، اقترح للمستخدم تجربة وضع البحث.`
      : `You are WAKTI, an advanced AI assistant. You specialize in helping with daily tasks and providing accurate, helpful information. You can also create tasks and reminders when users request them. Be friendly, helpful, and concise in your responses. When users ask for current information, suggest they try Search mode for the latest results.`;
    
    // Build messages array starting with system prompt
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history if available (limit to last 8 exchanges to manage token usage)
    if (conversationHistory && conversationHistory.length > 0) {
      console.log("🤖 WAKTI AI V2.5: 🔄 Including conversation history for context");
      
      // Take last 8 messages (4 exchanges) to maintain reasonable context
      const recentHistory = conversationHistory.slice(-8);
      
      for (const historyMessage of recentHistory) {
        if (historyMessage.role === 'user' || historyMessage.role === 'assistant') {
          messages.push({
            role: historyMessage.role,
            content: historyMessage.content
          });
        }
      }
    }

    // Add search context if provided
    if (context) {
      messages.push({ role: 'assistant', content: `Context: ${context}` });
    }
    
    // Build current user message
    let userContent = message;
    
    // Add file context if available
    if (fileContext) {
      userContent = `${message}\n\n---\n\n${fileContext}`;
      console.log("🤖 WAKTI AI V2.5: 📁 Including file context in conversation");
    } else if (conversationHistory && conversationHistory.length > 0) {
      console.log("🤖 WAKTI AI V2.5: 🔄 Using conversation context (no files)");
    } else {
      console.log("🤖 WAKTI AI V2.5: 💬 Pure chat mode - no search context");
    }
    
    // Add current user message
    messages.push({ role: 'user', content: userContent });
    
    console.log("🤖 WAKTI AI V2.5: 📤 Sending", messages.length, "messages to AI");
    
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
    
    console.log("🤖 WAKTI AI V2.5: === AI PROCESSING SUCCESS ===");
    console.log("🤖 WAKTI AI V2.5: Response length:", aiResponse?.length || 0);
    
    return aiResponse;
    
  } catch (error) {
    console.error("🤖 WAKTI AI V2.5: AI processing error:", error);
    
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
  }
}

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
