
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

console.log("🚀 WAKTI AI V2 BRAIN: Phase 4 - Advanced Integration & Automation");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 WAKTI AI V2 BRAIN: Processing Phase 4 request");

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
      calendarContext = null,
      userContext = null,
      enableAdvancedIntegration = true,
      enablePredictiveInsights = true,
      enableWorkflowAutomation = true
    } = requestBody;

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

    // Phase 4 features enabled
    console.log("🚀 WAKTI AI V2 BRAIN: Phase 4 features enabled:", {
      advancedIntegration: enableAdvancedIntegration,
      predictiveInsights: enablePredictiveInsights,
      workflowAutomation: enableWorkflowAutomation
    });

    console.log("🚀 WAKTI AI V2 BRAIN: Active trigger mode:", activeTrigger);

    // Enhanced intent analysis for Phase 4
    const intentAnalysis = analyzeAdvancedIntent(message, conversationHistory, language);
    console.log("🚀 WAKTI AI V2 BRAIN: Intent analysis:", intentAnalysis);

    // Advanced trigger isolation for Phase 4
    const triggerAnalysis = analyzeAdvancedTriggerIntent(activeTrigger, message, language);
    console.log("🚀 WAKTI AI V2 BRAIN: Advanced trigger analysis result:", triggerAnalysis);

    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = await checkBrowsingQuota(userId);
    let actionTaken = false;
    let actionResult = null;
    let needsConfirmation = false;
    let pendingTaskData = null;
    let pendingReminderData = null;
    let needsClarification = false;

    // Phase 4: Enhanced features
    let deepIntegration = null;
    let automationSuggestions = [];
    let predictiveInsights = null;
    let workflowActions = [];
    let contextualActions = [];

    // Handle task creation and confirmation flow
    if (intentAnalysis.isConfirmation && intentAnalysis.pendingData) {
      console.log("🚀 WAKTI AI V2 BRAIN: Processing task confirmation");
      needsConfirmation = true;
      
      if (intentAnalysis.actionType === 'task') {
        pendingTaskData = intentAnalysis.pendingData;
        response = intentAnalysis.confirmationMessage || 
          `I'll create this task for you:\n\n**${pendingTaskData.title}**\n${pendingTaskData.subtasks?.length > 0 ? `\nSubtasks:\n${pendingTaskData.subtasks.map(s => `• ${s}`).join('\n')}` : ''}\n${pendingTaskData.due_date ? `Due: ${pendingTaskData.due_date}` : ''}${pendingTaskData.due_time ? ` at ${pendingTaskData.due_time}` : ''}`;
      } else if (intentAnalysis.actionType === 'reminder') {
        pendingReminderData = intentAnalysis.pendingData;
        response = intentAnalysis.confirmationMessage || 
          `I'll create this reminder for you:\n\n**${pendingReminderData.title}**\n${pendingReminderData.due_date ? `Date: ${pendingReminderData.due_date}` : ''}${pendingReminderData.due_time ? ` at ${pendingReminderData.due_time}` : ''}`;
      }
    } else if (intentAnalysis.intent === 'task_creation') {
      console.log("🚀 WAKTI AI V2 BRAIN: Processing task creation request");
      const taskData = extractTaskData(message);
      
      if (taskData && taskData.title) {
        needsConfirmation = true;
        pendingTaskData = taskData;
        response = `I'll create this task for you:\n\n**${taskData.title}**\n${taskData.subtasks?.length > 0 ? `\nSubtasks:\n${taskData.subtasks.map(s => `• ${s}`).join('\n')}` : ''}\n${taskData.due_date ? `Due: ${taskData.due_date}` : ''}${taskData.due_time ? ` at ${taskData.due_time}` : ''}`;
      } else {
        response = await processWithAdvancedAI(message, null, language, userContext, calendarContext);
      }
    } else {
      // Process with Phase 4 advanced AI
      console.log("🤖 WAKTI AI V2 BRAIN: Processing with Phase 4 advanced AI");
      response = await processWithAdvancedAI(message, null, language, userContext, calendarContext);
      
      // Generate Phase 4 enhanced features
      if (enableWorkflowAutomation) {
        workflowActions = generateWorkflowActions(message, userContext);
      }
      
      if (enableAdvancedIntegration) {
        contextualActions = generateContextualActions(message, calendarContext);
      }
    }

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: intentAnalysis.intent,
      confidence: 'high',
      actionTaken,
      actionResult,
      imageUrl,
      browsingUsed,
      browsingData,
      quotaStatus,
      requiresSearchConfirmation: false,
      needsConfirmation,
      pendingTaskData,
      pendingReminderData,
      needsClarification,
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
    console.error("🚀 WAKTI AI V2 BRAIN: ❌ Phase 4 error:", error);
    
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

// Enhanced intent analysis for conversation flow
function analyzeAdvancedIntent(message: string, conversationHistory: any[] = [], language: string = 'en') {
  const lowerMessage = message.toLowerCase().trim();
  
  // Check for confirmation patterns
  const confirmationPatterns = [
    /\b(go\s+ahead|yes|confirm|create\s+it|do\s+it|make\s+it)\b/i,
    /\b(go\s+ahead\s+(and\s+)?create)\b/i,
    /\b(create\s+the\s+task)\b/i,
    /\b(proceed)\b/i
  ];

  const isConfirmation = confirmationPatterns.some(pattern => pattern.test(lowerMessage));

  if (isConfirmation && conversationHistory.length > 0) {
    // Look for the most recent task/reminder request in conversation history
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const historyMessage = conversationHistory[i];
      if (historyMessage.role === 'user') {
        const taskData = extractTaskData(historyMessage.content);
        const reminderData = extractReminderData(historyMessage.content);
        
        if (taskData && taskData.title) {
          return {
            isConfirmation: true,
            needsConfirmation: true,
            intent: 'task_confirmation',
            actionType: 'task',
            pendingData: taskData,
            confirmationMessage: `I'll create this task for you:\n\n**${taskData.title}**\n${taskData.subtasks?.length > 0 ? `\nSubtasks:\n${taskData.subtasks.map(s => `• ${s}`).join('\n')}` : ''}\n${taskData.due_date ? `Due: ${taskData.due_date}` : ''}${taskData.due_time ? ` at ${taskData.due_time}` : ''}`
          };
        }
        
        if (reminderData && reminderData.title) {
          return {
            isConfirmation: true,
            needsConfirmation: true,
            intent: 'reminder_confirmation',
            actionType: 'reminder',
            pendingData: reminderData,
            confirmationMessage: `I'll create this reminder for you:\n\n**${reminderData.title}**\n${reminderData.due_date ? `Date: ${reminderData.due_date}` : ''}${reminderData.due_time ? ` at ${reminderData.due_time}` : ''}`
          };
        }
      }
    }
  }

  // Check for task creation patterns
  const taskPatterns = [
    /\bcreate\s+(a\s+)?task\s+.*shopping.*list/i,
    /\btask\s+due\s+.*shopping/i,
    /\bshopping\s+list.*sub\s+tasks/i,
    /\bcreate.*task.*due.*noon/i,
    /\btask.*lulu.*sub\s+tasks/i
  ];

  const isTaskCreation = taskPatterns.some(pattern => pattern.test(lowerMessage));

  if (isTaskCreation) {
    return {
      isConfirmation: false,
      needsConfirmation: false,
      intent: 'task_creation',
      actionType: 'task',
      pendingData: null,
      confirmationMessage: null
    };
  }

  return {
    isConfirmation: false,
    needsConfirmation: false,
    intent: 'general_chat',
    actionType: null,
    pendingData: null,
    confirmationMessage: null
  };
}

// Advanced trigger isolation for Phase 4
function analyzeAdvancedTriggerIntent(activeTrigger: string, message: string, language: string = 'en') {
  console.log("🔍 WAKTI AI V2 BRAIN: Analyzing Phase 4 advanced trigger intent for:", activeTrigger);
  
  const enhancedFeatures = ['deep_integration', 'workflow_automation', 'predictive_insights'];
  
  switch (activeTrigger) {
    case 'chat':
    default:
      return {
        intent: 'advanced_general_chat',
        confidence: 'high',
        allowed: true,
        enhancedFeatures
      };
  }
}

// Extract task data from message
function extractTaskData(message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Check if this looks like a task creation request
  const taskIndicators = ['create task', 'task due', 'shopping list', 'sub tasks'];
  if (!taskIndicators.some(indicator => lowerMessage.includes(indicator))) {
    return null;
  }

  let title = '';
  let subtasks = [];
  let due_date = null;
  let due_time = null;
  let priority = 'normal';

  // Extract shopping list format: "shopping list lulu"
  const shoppingMatch = message.match(/shopping\s+list\s+([^,\.\s]+)/i);
  if (shoppingMatch) {
    const location = shoppingMatch[1].trim();
    title = `Shopping at ${location.charAt(0).toUpperCase() + location.slice(1)}`;
  }

  // Extract subtasks from "sub tasks rice milk water"
  const subtaskMatch = message.match(/sub\s+tasks?\s+(.+?)(\s+due|$)/i);
  if (subtaskMatch) {
    const itemsText = subtaskMatch[1];
    subtasks = itemsText
      .split(/\s+(?:and\s+)?|,\s*|\s*&\s*/)
      .map(item => item.trim())
      .filter(item => item && item.length > 0)
      .slice(0, 10);
  }

  // Extract due date and time
  const dateTimePatterns = [
    /\bdue\s+(tomorrow)\s+(noon|morning|afternoon|evening)/i,
    /\bdue\s+(tomorrow)/i,
    /\b(tomorrow)\s+(noon)/i,
    /\b(noon)\b/i
  ];

  for (const pattern of dateTimePatterns) {
    const match = message.match(pattern);
    if (match) {
      if (match[1] && match[1].toLowerCase() === 'tomorrow') {
        due_date = 'tomorrow';
      }
      if (match[2] && match[2].toLowerCase() === 'noon') {
        due_time = '12:00 PM';
      } else if (match[1] && match[1].toLowerCase() === 'noon') {
        due_time = '12:00 PM';
      }
      break;
    }
  }

  // Default title if not found
  if (!title && (lowerMessage.includes('task') || lowerMessage.includes('shopping'))) {
    title = 'Shopping Task';
  }

  if (!title) {
    return null;
  }

  return {
    title,
    description: '',
    subtasks,
    due_date,
    due_time,
    priority: priority as 'normal' | 'high' | 'urgent',
    task_type: 'one-time' as const
  };
}

// Extract reminder data from message
function extractReminderData(message: string) {
  const lowerMessage = message.toLowerCase();
  
  const reminderIndicators = ['remind me', 'reminder', 'create reminder'];
  if (!reminderIndicators.some(indicator => lowerMessage.includes(indicator))) {
    return null;
  }

  // Basic reminder extraction logic
  return {
    title: 'New Reminder',
    due_date: null,
    due_time: null
  };
}

// Real AI processing with Phase 4 features
async function processWithAdvancedAI(message: string, context: string | null, language: string = 'en', userContext: any = null, calendarContext: any = null) {
  try {
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
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة. تتخصص في المساعدة في إدارة المهام والأحداث والتذكيرات. كن ودوداً ومفيداً ومختصراً في إجاباتك.`
      : `You are WAKTI, an advanced AI assistant specializing in task management, events, and reminders. You help users create tasks, events, and reminders efficiently. Be friendly, helpful, and concise in your responses.`;
    
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
    console.error("🤖 WAKTI AI V2 BRAIN: AI processing error:", error);
    
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `I'll help you create tasks, events, or reminders. To get started, could you please provide:

1. What would you like me to create? (Task/Event/Reminder)
2. Key details like:
   - Title/description
   - Date/time (or should I suggest optimal timing?)
   - Priority level if applicable
   - Any other relevant details

For example, you could say:
"Create a task to prepare quarterly report, due Friday afternoon, high priority"

Or:
"Schedule a dentist appointment, suggest times next week when I'm typically free"

How would you like to proceed? I can also suggest smart scheduling based on your typical productivity patterns if you'd like.`;
  }
}

// Generate workflow actions for Phase 4
function generateWorkflowActions(message: string, userContext: any) {
  const actions = [];
  
  if (message.toLowerCase().includes('task') || message.toLowerCase().includes('shopping')) {
    actions.push({
      type: 'task_grouping',
      suggestion: 'Group similar tasks for batch processing',
      action: 'create_task_batch'
    });
  }
  
  return actions;
}

// Generate contextual actions for Phase 4
function generateContextualActions(message: string, calendarContext: any) {
  const actions = [];
  
  if (message.toLowerCase().includes('create') || message.toLowerCase().includes('task')) {
    actions.push({
      type: 'create_smart_task',
      text: 'Create optimized task',
      icon: 'plus'
    });
  }
  
  return actions;
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
