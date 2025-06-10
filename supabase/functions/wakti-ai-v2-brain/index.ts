import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

console.log("🚀 WAKTI AI V2 BRAIN: Phase 4 - Enhanced Mobile & General Chat");

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
            ? `✅ تم إنشاء التذكير "${pendingReminderData.title}" بنجاح! يمكنك مراجعتها في صفحة المهام والتذكيرات.`
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

    // Enhanced conversation context analysis with improved continuity
    const conversationContext = analyzeAdvancedConversationContext(conversationHistory, message);
    console.log("🔍 Advanced conversation context analysis:", conversationContext);

    // More selective breaking news detection - only for extremely time-sensitive queries
    const urgentLiveInfoPatterns = [
      /\b(live score|current score|score right now|what's the score)\b/i,
      /\b(happening now|breaking news|just happened|minutes ago)\b/i,
      /\b(stock price now|current price|market now)\b/i,
      /\b(weather right now|current weather)\b/i,
      /\b(who just won|who's winning|winner now)\b/i
    ];

    const isUrgentLiveQuery = urgentLiveInfoPatterns.some(pattern => pattern.test(message.toLowerCase()));

    // Only promote search for truly urgent, time-sensitive information
    if (isUrgentLiveQuery && activeTrigger === 'chat') {
      console.log("🔍 Detected urgent live information query, promoting search functions");
      
      const searchPromotionResponse = language === 'ar' 
        ? `🔍 يبدو أنك تبحث عن معلومات لحظية عاجلة! للحصول على أحدث التحديثات المباشرة، أنصحك بالتبديل إلى:

**🔍 وضع البحث** - للبحث السريع عن المعلومات الحديثة
**⚡ البحث المتقدم** - للحصول على معلومات مفصلة ومحدثة في الوقت الفعلي

يمكنك الوصول إلى هذه الأوضاع من خلال الضغط على زر القائمة (☰) في الأعلى واختيار "أدوات سريعة".

هل يمكنني مساعدتك في شيء آخر؟`
        : `🔍 It looks like you need real-time information! For live updates and current data, I recommend switching to:

**🔍 Search Mode** - For quick searches of current information  
**⚡ Advanced Search** - For detailed, real-time updated information

You can access these modes by tapping the menu button (☰) at the top and selecting "Quick Tools".

Can I help you with something else in the meantime?`;

      return new Response(JSON.stringify({
        response: searchPromotionResponse,
        conversationId: conversationId || generateConversationId(),
        intent: 'search_promotion',
        confidence: 'high',
        actionTaken: false,
        actionResult: null,
        searchRecommendation: true,
        success: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

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
    console.log("🤖 WAKTI AI V2 BRAIN: Processing with enhanced general chat AI");
    const response = await processWithAdvancedGeneralChatAI(message, conversationContext, language, userContext, calendarContext);

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: conversationContext.type === 'continuing_conversation' ? 'conversation_follow_up' : 'general_chat',
      confidence: 'high',
      actionTaken: false,
      actionResult: null,
      success: true
    };

    console.log("🚀 WAKTI AI V2 BRAIN: Sending general chat response:", result);

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

// Advanced conversation context analysis for superior continuity
function analyzeAdvancedConversationContext(conversationHistory: any[], currentMessage: string) {
  console.log("🔍 Analyzing advanced conversation context for enhanced chat...");
  
  if (!conversationHistory || conversationHistory.length === 0) {
    return { type: 'new_conversation', previousContext: null, expectingResponse: false };
  }

  // Get the last few messages for comprehensive context
  const recentMessages = conversationHistory.slice(-10);
  const lastAssistantMessage = recentMessages.filter(msg => msg.role === 'assistant').pop();
  const lastUserMessage = recentMessages.filter(msg => msg.role === 'user').slice(-2, -1)[0];
  const previousTopics = recentMessages.slice(-6);
  
  if (!lastAssistantMessage) {
    return { type: 'user_initiated', previousContext: null, expectingResponse: false };
  }

  // Enhanced patterns for conversation continuity
  const questionPatterns = [
    /would you like/i, /do you want/i, /would you add/i, /shall I/i, /any additional/i,
    /\?$/, /please provide/i, /let me know/i, /tell me more/i, /anything else/i,
    /interested in/i, /want to know/i, /curious about/i
  ];

  const followUpPatterns = [
    /^yes/i, /^no/i, /^sure/i, /^okay/i, /^ok/i, /^of course/i, /^definitely/i,
    /^tell me/i, /^what about/i, /^how about/i, /^and/i, /^but/i, /^however/i,
    /^also/i, /^besides/i, /^moreover/i, /^furthermore/i, /^additionally/i,
    /^continue/i, /^go on/i, /^more/i, /^keep going/i,
    /^that's/i, /^this/i, /^it/i, /^they/i, /^them/i, /^he/i, /^she/i,
    /^instagram/i, /^facebook/i, /^twitter/i, /^linkedin/i, /^tiktok/i
  ];

  // Enhanced context continuation indicators
  const topicContinuationWords = [
    'also', 'and', 'but', 'however', 'though', 'besides', 'moreover', 'furthermore',
    'additionally', 'meanwhile', 'similarly', 'on the other hand', 'in contrast',
    'speaking of', 'regarding', 'concerning', 'about that', 'on that note'
  ];
  
  const referenceWords = [
    'that', 'this', 'it', 'they', 'them', 'those', 'these', 'he', 'she', 'his', 'her',
    'their', 'theirs', 'which', 'what', 'who', 'when', 'where', 'why', 'how'
  ];

  const conversationalAcknowledgments = [
    'yeah', 'yep', 'right', 'exactly', 'true', 'correct', 'good point', 'I see',
    'makes sense', 'got it', 'understand', 'cool', 'nice', 'interesting'
  ];
  
  const wasAskingQuestion = questionPatterns.some(pattern => 
    pattern.test(lastAssistantMessage.content)
  );

  const isFollowUp = followUpPatterns.some(pattern => 
    pattern.test(currentMessage.trim())
  );

  const hasContinuationIndicators = topicContinuationWords.some(word =>
    currentMessage.toLowerCase().includes(word)
  ) || referenceWords.some(word =>
    currentMessage.toLowerCase().split(' ').includes(word)
  );

  const isConversationalAcknowledgment = conversationalAcknowledgments.some(ack =>
    currentMessage.toLowerCase().includes(ack)
  );

  // Enhanced context reference detection
  const messageWords = currentMessage.toLowerCase().split(' ');
  const isShortResponse = messageWords.length <= 20;
  const hasContextReference = isShortResponse && (isFollowUp || hasContinuationIndicators || isConversationalAcknowledgment);

  // Enhanced topic continuation analysis
  const lastTopicKeywords = extractEnhancedTopicKeywords(lastAssistantMessage.content);
  const currentTopicKeywords = extractEnhancedTopicKeywords(currentMessage);
  const previousTopicKeywords = previousTopics.map(msg => extractEnhancedTopicKeywords(msg.content)).flat();
  
  const hasTopicOverlap = lastTopicKeywords.some(keyword => 
    currentTopicKeywords.includes(keyword)
  );

  const hasPreviousTopicReference = previousTopicKeywords.some(keyword =>
    currentTopicKeywords.includes(keyword)
  );

  // Enhanced pronoun and implicit reference detection
  const hasImplicitReference = /\b(it|that|this|they|them|he|she)\b/i.test(currentMessage) && 
    currentMessage.split(' ').length <= 15;

  return {
    type: (wasAskingQuestion && isFollowUp) || hasContextReference || hasTopicOverlap || hasImplicitReference || hasPreviousTopicReference ? 'continuing_conversation' : 'new_topic',
    previousContext: {
      lastQuestion: lastAssistantMessage.content,
      lastUserMessage: lastUserMessage?.content || '',
      hasReference: hasContextReference,
      isFollowUp: isFollowUp,
      topicOverlap: hasTopicOverlap,
      lastTopicKeywords,
      previousTopicKeywords,
      hasImplicitReference,
      isConversationalAcknowledgment,
      conversationThemes: extractConversationThemes(previousTopics)
    },
    expectingResponse: wasAskingQuestion,
    contextualContinuation: hasContextReference || isFollowUp || hasTopicOverlap || hasImplicitReference || hasPreviousTopicReference
  };
}

// Extract enhanced topic keywords for superior context matching
function extractEnhancedTopicKeywords(text: string): string[] {
  const keywords = [];
  const lowercaseText = text.toLowerCase();
  
  // Domain-specific keyword extraction
  const domainKeywords = {
    sports: ['oilers', 'panthers', 'nfl', 'nhl', 'basketball', 'football', 'soccer', 'game', 'team', 'sport', 'player', 'coach', 'season', 'playoff', 'championship', 'mcdavid', 'draisaitl'],
    business: ['company', 'business', 'corporation', 'startup', 'revenue', 'profit', 'market', 'stock', 'investment', 'ceo', 'management'],
    technology: ['app', 'software', 'tech', 'computer', 'mobile', 'internet', 'ai', 'artificial intelligence', 'programming', 'development'],
    travel: ['airline', 'flight', 'airport', 'travel', 'vacation', 'trip', 'hotel', 'destination', 'qatar airways', 'emirates'],
    entertainment: ['movie', 'film', 'music', 'artist', 'actor', 'celebrity', 'show', 'series', 'concert', 'album'],
    education: ['school', 'university', 'college', 'student', 'teacher', 'professor', 'course', 'learning', 'education']
  };
  
  // Add domain-specific keywords
  Object.values(domainKeywords).flat().forEach(keyword => {
    if (lowercaseText.includes(keyword)) {
      keywords.push(keyword);
    }
  });
  
  // Extract significant nouns and proper nouns
  const significantWords = text.match(/\b[A-Z][a-z]+\b|\b\w{4,}\b/g) || [];
  keywords.push(...significantWords.slice(0, 8).map(w => w.toLowerCase()));
  
  return [...new Set(keywords)]; // Remove duplicates
}

// Extract conversation themes from recent messages
function extractConversationThemes(messages: any[]): string[] {
  const themes = [];
  
  messages.forEach(msg => {
    if (msg.content) {
      const keywords = extractEnhancedTopicKeywords(msg.content);
      themes.push(...keywords);
    }
  });
  
  // Return most frequent themes
  const themeFrequency: { [key: string]: number } = {};
  themes.forEach(theme => {
    themeFrequency[theme] = (themeFrequency[theme] || 0) + 1;
  });
  
  return Object.entries(themeFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([theme]) => theme);
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

// Generate unique conversation ID
function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Advanced AI processing for general chat with enhanced intelligence and natural flow
async function processWithAdvancedGeneralChatAI(message: string, conversationContext: any, language: string = 'en', userContext: any = null, calendarContext: any = null) {
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

    // Enhanced conversational AI system prompt with superior intelligence
    let systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي ومحادث ممتاز ومعلوماتي. أنت تناقش أي موضوع بذكاء وتقدم معلومات مفيدة ومفصلة.

شخصيتك:
- محادث ممتاز ومطلع - يمكنك مناقشة الرياضة والأخبار والشركات والتكنولوجيا والترفيه والتعليم وأي موضوع آخر بعمق
- ودود وذكي ومفيد في المحادثة، تحافظ على التدفق الطبيعي
- تتذكر السياق السابق وتربط إجاباتك بالمحادثة بذكاء
- تقدم معلومات شاملة ومفيدة أولاً، ثم تقترح ميزات التطبيق بطريقة طبيعية عند الحاجة

ميزات التطبيق التي يمكنك اقتراحها (بذكاء وطبيعية):
- إنشاء مهام وتذكيرات للمتابعة والتنظيم
- تنظيم الأحداث والمواعيد
- إدارة جهات الاتصال والرسائل

كن محادثاً ممتازاً ومعلوماتياً أولاً، ومساعد تطبيق ثانياً. اجعل اقتراحات التطبيق تبدو طبيعية وليست مفروضة.`
      : `You are WAKTI, an intelligent AI assistant and excellent conversationalist. You discuss any topic intelligently and provide helpful, detailed information.

Your personality:
- Excellent conversationalist and highly knowledgeable - you can discuss sports, news, companies, technology, entertainment, education, and any other topic in depth
- Friendly, smart, and helpful in conversation, maintaining natural flow
- Remember previous context and connect your responses to the conversation intelligently
- Provide comprehensive and helpful information FIRST, then suggest app features naturally when relevant

App features you can suggest (intelligently and naturally):
- Create tasks and reminders for follow-up and organization
- Organize events and appointments  
- Manage contacts and messaging

Be an excellent conversationalist and informative first, app assistant second. Make app suggestions feel natural and not forced.`;
    
    // Enhanced context awareness for superior conversation flow
    if (conversationContext?.type === 'continuing_conversation') {
      const contextPrompt = language === 'ar'
        ? `\n\nسياق المحادثة المتقدم: المستخدم يتابع المحادثة السابقة. آخر رسالة منك: "${conversationContext.previousContext.lastQuestion}". موضوع المحادثة: ${conversationContext.previousContext.conversationThemes?.join(', ')}. استمر في المحادثة بناءً على هذا السياق مع الحفاظ على التدفق الطبيعي والاستمرارية الذكية.`
        : `\n\nAdvanced Conversation Context: User is continuing the previous conversation. Your last message: "${conversationContext.previousContext.lastQuestion}". Conversation themes: ${conversationContext.previousContext.conversationThemes?.join(', ')}. Continue the conversation based on this context while maintaining natural flow and intelligent continuity.`;
      
      systemPrompt += contextPrompt;
    }

    // Enhanced smart follow-up suggestion logic
    const followUpPrompt = language === 'ar'
      ? `\n\nإرشادات المتابعة الذكية المحسنة:
- إذا ناقشت فريق رياضي أو لعبة، اختتم بطبيعية: "هل تريد مني تذكيرك بمباراتهم القادمة أو إنشاء حدث لها؟"
- إذا ذكرت حدث أو تاريخ مهم، اقترح بذكاء: "هل تريد إضافة هذا كتذكير أو حدث في تقويمك؟"
- إذا ناقشت مشروع أو هدف، اقترح بطبيعية: "هل تريد إنشاء مهمة لمتابعة هذا أو تقسيمه إلى خطوات؟"
- إذا تحدثت عن شخص مهم، اقترح: "هل تريد إضافته إلى جهات الاتصال؟"
- فقط اقترح هذه الميزات عندما تكون ذات صلة طبيعية ومفيدة بالمحادثة`
      : `\n\nEnhanced Smart Follow-up Guidelines:
- If discussing a sports team or game, conclude naturally: "Would you like me to remind you about their next game or create an event for it?"
- If mentioning an important event or date, suggest intelligently: "Would you like to add this as a reminder or event to your calendar?"
- If discussing a project or goal, suggest naturally: "Would you like to create a task to follow up on this or break it into steps?"
- If talking about an important person, suggest: "Would you like to add them to your contacts?"
- Only suggest these features when they naturally relate to and enhance the conversation`;

    systemPrompt += followUpPrompt;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];
    
    // Enhanced conversation context for superior continuity
    if (conversationContext?.previousContext?.lastUserMessage && conversationContext?.contextualContinuation) {
      const contextMessage = language === 'ar'
        ? `السياق المتقدم: رسالة المستخدم السابقة: "${conversationContext.previousContext.lastUserMessage}". موضوعات سابقة: ${conversationContext.previousContext.conversationThemes?.join(', ')}`
        : `Advanced Context: User's previous message: "${conversationContext.previousContext.lastUserMessage}". Previous themes: ${conversationContext.previousContext.conversationThemes?.join(', ')}`;
      
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
        temperature: 0.7, // Balanced temperature for natural yet focused responses
        max_tokens: 1200, // Increased for more comprehensive responses
        presence_penalty: 0.1, // Slight penalty to encourage diverse vocabulary
        frequency_penalty: 0.1 // Slight penalty to avoid repetition
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error('Advanced general chat AI processing error:', error);
    return language === 'ar'
      ? 'عذراً، حدث خطأ في المعالجة. يرجى المحاولة مرة أخرى.'
      : 'Sorry, there was an error processing your request. Please try again.';
  }
}

</edits_to_apply>
