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
      enableWorkflowAutomation = true,
      confirmTask = false,
      confirmReminder = false,
      pendingTaskData = null,
      pendingReminderData = null
    } = requestBody;

    // Handle task confirmation (when confirmTask is true)
    if (confirmTask && pendingTaskData) {
      console.log("🚀 WAKTI AI V2 BRAIN: Processing task confirmation");
      
      try {
        const taskToCreate = {
          title: pendingTaskData.title,
          description: pendingTaskData.description || '',
          user_id: userId,
          due_date: pendingTaskData.due_date,
          due_time: pendingTaskData.due_time || null,
          priority: pendingTaskData.priority || 'normal',
          task_type: pendingTaskData.task_type || 'one-time',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log("🚀 WAKTI AI V2 BRAIN: Creating task:", taskToCreate);

        const { data: createdTask, error: taskError } = await supabase
          .from('tr_tasks')
          .insert([taskToCreate])
          .select()
          .single();

        if (taskError) {
          console.error("Task creation error:", taskError);
          throw new Error(`Failed to create task: ${taskError.message}`);
        }

        console.log("Task created successfully:", createdTask);

        // Create subtasks if they exist
        if (pendingTaskData.subtasks && pendingTaskData.subtasks.length > 0) {
          const subtasksToCreate = pendingTaskData.subtasks.map((subtask: string, index: number) => ({
            task_id: createdTask.id,
            title: subtask,
            completed: false,
            order_index: index,
            created_at: new Date().toISOString()
          }));

          const { error: subtaskError } = await supabase
            .from('tr_subtasks')
            .insert(subtasksToCreate);

          if (subtaskError) {
            console.error("Subtask creation error:", subtaskError);
          } else {
            console.log("Subtasks created successfully");
          }
        }

        return new Response(JSON.stringify({
          response: language === 'ar' 
            ? `✅ تم إنشاء المهمة "${pendingTaskData.title}" بنجاح! يمكنك مراجعتها في صفحة المهام والتذكيرات.`
            : `✅ Task "${pendingTaskData.title}" created successfully! You can check it out in your Tasks & Reminders page.`,
          conversationId: conversationId || generateConversationId(),
          intent: 'task_created_success',
          confidence: 'high',
          actionTaken: true,
          actionResult: { createdTask },
          success: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (error) {
        console.error("Task creation failed:", error);
        return new Response(JSON.stringify({
          response: language === 'ar' ? 'فشل في إنشاء المهمة' : 'Failed to create task',
          error: error.message,
          success: false
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Handle reminder confirmation (when confirmReminder is true)
    if (confirmReminder && pendingReminderData) {
      console.log("🚀 WAKTI AI V2 BRAIN: Processing reminder confirmation");
      
      try {
        const reminderToCreate = {
          title: pendingReminderData.title,
          user_id: userId,
          due_date: pendingReminderData.due_date,
          due_time: pendingReminderData.due_time || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: createdReminder, error: reminderError } = await supabase
          .from('tr_reminders')
          .insert([reminderToCreate])
          .select()
          .single();

        if (reminderError) {
          console.error("Reminder creation error:", reminderError);
          throw new Error(`Failed to create reminder: ${reminderError.message}`);
        }

        console.log("Reminder created successfully:", createdReminder);

        return new Response(JSON.stringify({
          response: language === 'ar' 
            ? `✅ تم إنشاء التذكير "${pendingReminderData.title}" بنجاح! يمكنك مراجعته في صفحة المهام والتذكيرات.`
            : `✅ Reminder "${pendingReminderData.title}" created successfully! You can check it out in your Tasks & Reminders page.`,
          conversationId: conversationId || generateConversationId(),
          intent: 'reminder_created_success',
          confidence: 'high',
          actionTaken: true,
          actionResult: { createdReminder },
          success: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (error) {
        console.error("Reminder creation failed:", error);
        return new Response(JSON.stringify({
          response: language === 'ar' ? 'فشل في إنشاء التذكير' : 'Failed to create reminder',
          error: error.message,
          success: false
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

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

    // Enhanced conversation context analysis
    const conversationContext = analyzeConversationContext(conversationHistory, message);
    console.log("🔍 Conversation context analysis:", conversationContext);

    // Check for task creation patterns and prepare task preview
    const taskPatterns = [
      /\bcreate\s+(a\s+)?task/i,
      /\btask\s+due/i,
      /\bshopping\s+list/i,
      /\bsub\s+tasks/i,
      /\bnew\s+task/i,
      /\badd\s+task/i
    ];

    const isTaskCreation = taskPatterns.some(pattern => pattern.test(message.toLowerCase()));

    if (isTaskCreation) {
      console.log("🚀 WAKTI AI V2 BRAIN: Processing task creation request");
      const taskData = extractTaskData(message);
      
      if (taskData && taskData.title) {
        console.log("🚀 WAKTI AI V2 BRAIN: Task data extracted, returning preview");
        
        return new Response(JSON.stringify({
          response: language === 'ar' 
            ? `سأقوم بإنشاء مهمة: "${taskData.title}". يرجى مراجعة التفاصيل وتعديلها حسب الحاجة ثم الضغط على إنشاء.`
            : `I'll create a task: "${taskData.title}". Please review and edit the details as needed, then click Create.`,
          conversationId: conversationId || generateConversationId(),
          intent: 'task_preview',
          confidence: 'high',
          actionTaken: false,
          needsConfirmation: true,
          pendingTaskData: taskData,
          success: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Check for reminder creation patterns
    const reminderPatterns = [
      /\bcreate\s+(a\s+)?reminder/i,
      /\bremind\s+me/i,
      /\breminder\s+for/i,
      /\bset\s+reminder/i
    ];

    const isReminderCreation = reminderPatterns.some(pattern => pattern.test(message.toLowerCase()));

    if (isReminderCreation) {
      console.log("🚀 WAKTI AI V2 BRAIN: Processing reminder creation request");
      const reminderData = extractReminderData(message);
      
      if (reminderData && reminderData.title) {
        console.log("🚀 WAKTI AI V2 BRAIN: Reminder data extracted, returning preview");
        
        return new Response(JSON.stringify({
          response: language === 'ar' 
            ? `سأقوم بإنشاء تذكير: "${reminderData.title}". يرجى مراجعة التفاصيل وتعديلها حسب الحاجة ثم الضغط على إنشاء.`
            : `I'll create a reminder: "${reminderData.title}". Please review and edit the details as needed, then click Create.`,
          conversationId: conversationId || generateConversationId(),
          intent: 'reminder_preview',
          confidence: 'high',
          actionTaken: false,
          needsConfirmation: true,
          pendingReminderData: reminderData,
          success: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Process with AI for general chat with enhanced context awareness
    console.log("🤖 WAKTI AI V2 BRAIN: Processing with AI");
    const response = await processWithAdvancedAI(message, conversationContext, language, userContext, calendarContext);

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: 'general_chat',
      confidence: 'high',
      actionTaken: false,
      actionResult: null,
      success: true
    };

    console.log("🚀 WAKTI AI V2 BRAIN: Sending response:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🚀 WAKTI AI V2 BRAIN: ❌ Error:", error);
    
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

// Enhanced conversation context analysis function
function analyzeConversationContext(conversationHistory: any[], currentMessage: string) {
  console.log("🔍 Analyzing conversation context...");
  
  if (!conversationHistory || conversationHistory.length === 0) {
    return { type: 'new_conversation', previousContext: null, expectingResponse: false };
  }

  // Get the last few messages for context
  const recentMessages = conversationHistory.slice(-5);
  const lastAssistantMessage = recentMessages.filter(msg => msg.role === 'assistant').pop();
  
  if (!lastAssistantMessage) {
    return { type: 'user_initiated', previousContext: null, expectingResponse: false };
  }

  // Check if the last assistant message was asking a question or expecting a response
  const questionPatterns = [
    /would you like/i,
    /do you want/i,
    /would you add/i,
    /shall I/i,
    /any additional/i,
    /\?$/,
    /please provide/i,
    /let me know/i
  ];

  const wasAskingQuestion = questionPatterns.some(pattern => 
    pattern.test(lastAssistantMessage.content)
  );

  // Check if current message seems to be answering previous question
  const answerPatterns = [
    /^yes/i,
    /^no/i,
    /^add/i,
    /^include/i,
    /my instagram/i,
    /my email/i,
    /my website/i,
    /@\w+/i, // social media handles
    /https?:\/\//i // URLs
  ];

  const seemsLikeAnswer = answerPatterns.some(pattern => 
    pattern.test(currentMessage.trim())
  );

  // Specific context detection for social media/contact info
  const socialMediaContext = lastAssistantMessage.content.toLowerCase().includes('social media') ||
                            lastAssistantMessage.content.toLowerCase().includes('additional elements') ||
                            lastAssistantMessage.content.toLowerCase().includes('contact');

  const providingSocialInfo = /(@\w+|instagram|twitter|facebook|linkedin|email|phone|website)/i.test(currentMessage);

  return {
    type: wasAskingQuestion && (seemsLikeAnswer || providingSocialInfo) ? 'answering_question' : 'new_topic',
    previousContext: {
      lastQuestion: lastAssistantMessage.content,
      wasSocialMediaRequest: socialMediaContext,
      isProvidingSocialInfo: providingSocialInfo
    },
    expectingResponse: wasAskingQuestion,
    contextualContinuation: socialMediaContext && providingSocialInfo
  };
}

// Extract task data from message - fixed to use correct date format
function extractTaskData(message: string) {
  const lowerMessage = message.toLowerCase();
  
  let title = '';
  let subtasks = [];
  let due_date = null;
  let due_time = null;
  let priority = 'normal';

  // Extract shopping list format: "shopping list lulu" or "shopping at lulu"
  const shoppingMatch = message.match(/shopping\s+(?:list\s+|at\s+)?([^,\.\s]+)/i);
  if (shoppingMatch) {
    const location = shoppingMatch[1].trim();
    title = `Shopping at ${location.charAt(0).toUpperCase() + location.slice(1)}`;
  }

  // Extract title from "create a task" format (only if no shopping title found)
  if (!title) {
    const taskMatch = message.match(/create\s+(a\s+)?task\s+(.+?)(\s+due|\s+sub\s+tasks?|\s+for|$)/i);
    if (taskMatch) {
      let extractedTitle = taskMatch[2].trim();
      // Clean up the title
      extractedTitle = extractedTitle.replace(/\s*(due|for)\s+.*$/i, '').trim();
      if (extractedTitle && extractedTitle !== 'for' && extractedTitle !== 'tomorrow') {
        title = extractedTitle;
      }
    }
  }

  // Extract subtasks from "sub tasks rice milk water"
  const subtaskMatch = message.match(/sub\s+tasks?\s+(.+?)(\s+due|\s+for|$)/i);
  if (subtaskMatch) {
    const itemsText = subtaskMatch[1];
    subtasks = itemsText
      .split(/\s+(?:and\s+)?|,\s*|\s*&\s*/)
      .map(item => item.trim())
      .filter(item => item && item.length > 0)
      .slice(0, 10);
  }

  // Extract due date and time - properly format for tr_tasks
  const dateTimePatterns = [
    /\bdue\s+(tomorrow)\s+(noon|morning|afternoon|evening)/i,
    /\bdue\s+(tomorrow)/i,
    /\b(tomorrow)\s+(noon)/i,
    /\bfor\s+(tomorrow)/i,
    /\b(noon)\b/i
  ];

  for (const pattern of dateTimePatterns) {
    const match = message.match(pattern);
    if (match) {
      if (match[1] && match[1].toLowerCase() === 'tomorrow') {
        // Convert to proper DATE format for tr_tasks
        due_date = convertRelativeDate('tomorrow');
        console.log(`🚀 WAKTI AI V2 BRAIN: Converted "tomorrow" to date: ${due_date}`);
      }
      if (match[2] && match[2].toLowerCase() === 'noon') {
        due_time = '12:00:00';
      } else if (match[1] && match[1].toLowerCase() === 'noon') {
        due_time = '12:00:00';
      }
      break;
    }
  }

  // Default title if not found
  if (!title && (lowerMessage.includes('task') || lowerMessage.includes('shopping'))) {
    title = 'New Task';
  }

  if (!title) {
    return null;
  }

  console.log(`🚀 WAKTI AI V2 BRAIN: Extracted task data - Title: "${title}", Due Date: "${due_date}", Due Time: "${due_time}"`);

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

  // Extract reminder title
  let title = 'New Reminder';
  const reminderMatch = message.match(/remind\s+me\s+(.+?)(\s+at|\s+on|\s+in|$)/i);
  if (reminderMatch) {
    title = reminderMatch[1].trim();
  }

  return {
    title,
    due_date: null,
    due_time: null
  };
}

// Convert relative dates to actual dates - fixed for DATE format
function convertRelativeDate(dateString: string): string {
  if (!dateString) return '';
  
  const today = new Date();
  
  if (dateString.toLowerCase() === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    // Return in YYYY-MM-DD format for DATE field
    return tomorrow.toISOString().split('T')[0];
  }
  
  if (dateString.toLowerCase() === 'today') {
    return today.toISOString().split('T')[0];
  }
  
  if (dateString.toLowerCase() === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  
  // If it's already a valid date format, return as is
  const parsed = new Date(dateString);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  
  return dateString;
}

// Validate date string format
function isValidDateString(dateString: string): boolean {
  if (!dateString) return false;
  
  // Check if it's in YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  
  // Check if it's a valid date
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString === date.toISOString().split('T')[0];
}

// Format date for display
function formatDateForDisplay(dateString: string): string {
  if (!dateString) return '';
  
  // Since we now convert immediately, we shouldn't get relative terms here
  // But keeping this as fallback
  if (dateString === 'tomorrow') {
    return 'Tomorrow';
  }
  if (dateString === 'today') {
    return 'Today';
  }
  if (dateString === 'yesterday') {
    return 'Yesterday';
  }
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return original if can't parse
    }
    
    // Check if it's today, tomorrow, or yesterday by comparing dates
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const dateStr = date.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (dateStr === todayStr) {
      return 'Today';
    } else if (dateStr === tomorrowStr) {
      return 'Tomorrow';
    } else if (dateStr === yesterdayStr) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  } catch {
    return dateString;
  }
}

// Generate unique conversation ID
function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Real AI processing with enhanced context awareness
async function processWithAdvancedAI(message: string, conversationContext: any, language: string = 'en', userContext: any = null, calendarContext: any = null) {
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

    // Enhanced system prompt with conversation context awareness
    let systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة. تتخصص في المساعدة في إدارة المهام والأحداث والتذكيرات. كن ودوداً ومفيداً ومختصراً في إجاباتك.`
      : `You are WAKTI, an advanced AI assistant specializing in task management, events, and reminders. You help users create tasks, events, and reminders efficiently. Be friendly, helpful, and concise in your responses.`;
    
    // Add context awareness to system prompt
    if (conversationContext?.type === 'answering_question' && conversationContext?.contextualContinuation) {
      const contextPrompt = language === 'ar'
        ? `\n\nسياق المحادثة: المستخدم يجيب على سؤالك السابق حول إضافة عناصر إضافية مثل وسائل التواصل الاجتماعي. استمر في المحادثة بناءً على هذا السياق.`
        : `\n\nConversation Context: The user is responding to your previous question about adding additional elements like social media. Continue the conversation based on this context and build upon their response.`;
      
      systemPrompt += contextPrompt;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];
    
    // Add conversation context if relevant
    if (conversationContext?.previousContext?.lastQuestion) {
      const contextMessage = language === 'ar'
        ? `السياق: سألت سابقاً: "${conversationContext.previousContext.lastQuestion}"`
        : `Context: You previously asked: "${conversationContext.previousContext.lastQuestion}"`;
      
      messages.splice(1, 0, { role: 'assistant', content: contextMessage });
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
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error('AI processing error:', error);
    return language === 'ar'
      ? 'عذراً، حدث خطأ في المعالجة. يرجى المحاولة مرة أخرى.'
      : 'Sorry, there was an error processing your request. Please try again.';
  }
}
