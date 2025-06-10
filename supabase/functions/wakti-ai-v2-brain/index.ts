
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

console.log("🚀 WAKTI AI V2 BRAIN: Phase 5 - Enhanced Conversational Intelligence");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 WAKTI AI V2 BRAIN: Processing Phase 5 request");

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

    // Enhanced conversation context analysis with superior continuity
    const conversationContext = analyzeAdvancedConversationContext(conversationHistory, message);
    console.log("🔍 Advanced conversation context analysis:", conversationContext);

    // Highly selective time-sensitive information detection
    const criticalLiveInfoPatterns = [
      /\b(live score|current score|score right now|what's the score now|who's winning right now)\b/i,
      /\b(breaking news right now|what just happened|happening now|minutes ago|just announced)\b/i,
      /\b(stock price now|current stock price|market right now|today's market)\b/i,
      /\b(weather right now|current weather|weather now)\b/i,
      /\b(who just won|who won just now|winner right now|latest winner)\b/i,
      /\b(traffic now|current traffic|road conditions now)\b/i
    ];

    const isCriticalLiveQuery = criticalLiveInfoPatterns.some(pattern => pattern.test(message.toLowerCase()));

    // Only promote search for truly urgent, time-sensitive information
    if (isCriticalLiveQuery && activeTrigger === 'chat') {
      console.log("🔍 Detected critical time-sensitive query, promoting search functions");
      
      const searchPromotionResponse = language === 'ar' 
        ? `🔍 أرى أنك تبحث عن معلومات عاجلة ومحدثة! للحصول على أحدث المعلومات المباشرة والفورية، أنصحك بالتبديل إلى:

**🔍 وضع البحث** - للحصول على المعلومات الحديثة والمحدثة
**⚡ البحث المتقدم** - للبحث المفصل والمعلومات المباشرة

يمكنك الوصول إلى هذه الأوضاع من خلال الضغط على زر القائمة (☰) في الأعلى واختيار "أدوات سريعة".

بإمكاني أيضاً مساعدتك في أشياء أخرى إذا أردت!`
        : `🔍 I can see you're looking for urgent, real-time information! For the latest live updates and current data, I recommend switching to:

**🔍 Search Mode** - For current and updated information
**⚡ Advanced Search** - For detailed searches and live information

You can access these modes by tapping the menu button (☰) at the top and selecting "Quick Tools".

I'm also happy to help you with other things if you'd like!`;

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

    // Enhanced task creation detection with better natural language processing
    const taskCreationPatterns = [
      /\b(create|make|add|new)\s+(a\s+)?(task|to-do|todo)\b/i,
      /\b(remind me to|need to remember to|should do|have to)\b/i,
      /\bshopping\s+(list|for|at)\b/i,
      /\b(plan|organize|schedule)\s+.*(task|activity|work)\b/i,
      /\b(write down|note|track)\s+.*(task|todo|reminder)\b/i
    ];

    const isTaskCreation = taskCreationPatterns.some(pattern => pattern.test(message.toLowerCase()));

    if (isTaskCreation) {
      console.log("🚀 WAKTI AI V2 BRAIN: Processing task creation request");
      const taskData = extractEnhancedTaskData(message);
      
      if (taskData && taskData.title) {
        console.log("🚀 WAKTI AI V2 BRAIN: Task data extracted, returning preview");
        
        return new Response(JSON.stringify({
          response: language === 'ar' 
            ? `سأقوم بإنشاء مهمة لك: "${taskData.title}". يرجى مراجعة التفاصيل وتعديلها حسب الحاجة ثم الضغط على إنشاء.`
            : `I'll create a task for you: "${taskData.title}". Please review and edit the details as needed, then click Create.`,
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

    // Enhanced reminder creation detection
    const reminderCreationPatterns = [
      /\b(remind me|reminder|set reminder|create reminder)\b/i,
      /\b(don't forget|remember|alert me)\b/i,
      /\b(notification for|notify me when|ping me)\b/i
    ];

    const isReminderCreation = reminderCreationPatterns.some(pattern => pattern.test(message.toLowerCase()));

    if (isReminderCreation) {
      console.log("🚀 WAKTI AI V2 BRAIN: Processing reminder creation request");
      const reminderData = extractEnhancedReminderData(message);
      
      if (reminderData && reminderData.title) {
        console.log("🚀 WAKTI AI V2 BRAIN: Reminder data extracted, returning preview");
        
        return new Response(JSON.stringify({
          response: language === 'ar' 
            ? `سأقوم بإنشاء تذكير لك: "${reminderData.title}". يرجى مراجعة التفاصيل وتعديلها حسب الحاجة ثم الضغط على إنشاء.`
            : `I'll create a reminder for you: "${reminderData.title}". Please review and edit the details as needed, then click Create.`,
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

    // Process with enhanced AI for superior general chat experience
    console.log("🤖 WAKTI AI V2 BRAIN: Processing with enhanced conversational AI");
    const response = await processWithSuperiorGeneralChatAI(message, conversationContext, language, userContext, calendarContext);

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: conversationContext.type === 'continuing_conversation' ? 'conversation_follow_up' : 'general_chat',
      confidence: 'high',
      actionTaken: false,
      actionResult: null,
      success: true
    };

    console.log("🚀 WAKTI AI V2 BRAIN: Sending enhanced conversational response:", result);

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

// Enhanced conversation context analysis with superior intelligence
function analyzeAdvancedConversationContext(conversationHistory: any[], currentMessage: string) {
  console.log("🔍 Analyzing superior conversation context for enhanced chat...");
  
  if (!conversationHistory || conversationHistory.length === 0) {
    return { type: 'new_conversation', previousContext: null, expectingResponse: false };
  }

  // Get comprehensive context from recent messages
  const recentMessages = conversationHistory.slice(-12);
  const lastAssistantMessage = recentMessages.filter(msg => msg.role === 'assistant').pop();
  const lastUserMessage = recentMessages.filter(msg => msg.role === 'user').slice(-2, -1)[0];
  const conversationThemes = recentMessages.slice(-8);
  
  if (!lastAssistantMessage) {
    return { type: 'user_initiated', previousContext: null, expectingResponse: false };
  }

  // Enhanced conversation continuation indicators
  const questionResponsePatterns = [
    /would you like|do you want|would you add|shall I|any additional|interested in/i,
    /\?$/, /please provide|let me know|tell me more|anything else|want to know/i,
    /curious about|more details|elaborate|explain further/i
  ];

  const followUpResponsePatterns = [
    /^(yes|no|sure|okay|ok|of course|definitely|absolutely|exactly|right|correct)/i,
    /^(tell me|what about|how about|and also|but also|however|though)/i,
    /^(continue|go on|more|keep going|what else|anything else)/i,
    /^(that's|this is|it's|they are|he is|she is)/i,
    /^(instagram|facebook|twitter|linkedin|tiktok|youtube|social media)/i,
    /^(also|besides|moreover|furthermore|additionally|similarly)/i
  ];

  // Advanced contextual indicators
  const contextualConnectors = [
    'speaking of', 'regarding', 'concerning', 'about that', 'on that note',
    'related to', 'in connection with', 'as for', 'with respect to', 'touching on'
  ];
  
  const implicitReferences = [
    'that', 'this', 'it', 'they', 'them', 'those', 'these', 'he', 'she', 'his', 'her',
    'their', 'theirs', 'which', 'what', 'who', 'when', 'where', 'why', 'how', 'such'
  ];

  const conversationalAcknowledgments = [
    'yeah', 'yep', 'right', 'exactly', 'true', 'correct', 'good point', 'I see',
    'makes sense', 'got it', 'understand', 'cool', 'nice', 'interesting', 'wow',
    'really', 'seriously', 'no way', 'amazing', 'awesome', 'great', 'perfect'
  ];
  
  const wasAskingQuestion = questionResponsePatterns.some(pattern => 
    pattern.test(lastAssistantMessage.content)
  );

  const isFollowUpResponse = followUpResponsePatterns.some(pattern => 
    pattern.test(currentMessage.trim())
  );

  const hasContextualConnectors = contextualConnectors.some(connector =>
    currentMessage.toLowerCase().includes(connector)
  );

  const hasImplicitReferences = implicitReferences.some(ref =>
    currentMessage.toLowerCase().split(/\s+/).includes(ref)
  );

  const isConversationalAcknowledgment = conversationalAcknowledgments.some(ack =>
    currentMessage.toLowerCase().includes(ack)
  );

  // Enhanced topic continuity analysis
  const messageWords = currentMessage.toLowerCase().split(/\s+/);
  const isShortResponse = messageWords.length <= 25;
  const hasStrongContextReference = isShortResponse && (isFollowUpResponse || hasImplicitReferences || isConversationalAcknowledgment);

  // Superior topic keyword matching
  const lastTopicKeywords = extractSuperiorTopicKeywords(lastAssistantMessage.content);
  const currentTopicKeywords = extractSuperiorTopicKeywords(currentMessage);
  const historicalKeywords = conversationThemes.map(msg => extractSuperiorTopicKeywords(msg.content)).flat();
  
  const hasDirectTopicOverlap = lastTopicKeywords.some(keyword => 
    currentTopicKeywords.includes(keyword)
  );

  const hasHistoricalTopicConnection = historicalKeywords.some(keyword =>
    currentTopicKeywords.includes(keyword)
  );

  // Enhanced pronoun and implicit reference detection
  const hasAdvancedImplicitReference = /\b(it|that|this|they|them|he|she|which|what)\b/i.test(currentMessage) && 
    currentMessage.split(/\s+/).length <= 20;

  const hasSemanticallyRelatedContent = checkSemanticRelation(lastAssistantMessage.content, currentMessage);

  return {
    type: (wasAskingQuestion && isFollowUpResponse) || hasStrongContextReference || hasDirectTopicOverlap || 
          hasAdvancedImplicitReference || hasHistoricalTopicConnection || hasContextualConnectors || 
          hasSemanticallyRelatedContent ? 'continuing_conversation' : 'new_topic',
    previousContext: {
      lastQuestion: lastAssistantMessage.content,
      lastUserMessage: lastUserMessage?.content || '',
      hasStrongReference: hasStrongContextReference,
      isFollowUp: isFollowUpResponse,
      topicOverlap: hasDirectTopicOverlap,
      lastTopicKeywords,
      historicalKeywords,
      hasAdvancedImplicitReference,
      isConversationalAcknowledgment,
      conversationThemes: extractConversationThemes(conversationThemes),
      semanticConnection: hasSemanticallyRelatedContent
    },
    expectingResponse: wasAskingQuestion,
    contextualContinuation: hasStrongContextReference || isFollowUpResponse || hasDirectTopicOverlap || 
                           hasAdvancedImplicitReference || hasHistoricalTopicConnection || hasContextualConnectors
  };
}

// Extract superior topic keywords with domain expertise
function extractSuperiorTopicKeywords(text: string): string[] {
  const keywords = [];
  const lowercaseText = text.toLowerCase();
  
  // Enhanced domain-specific keyword extraction
  const domainKeywords = {
    sports: ['oilers', 'panthers', 'nfl', 'nhl', 'nba', 'mlb', 'fifa', 'basketball', 'football', 'soccer', 'hockey', 'baseball', 'tennis', 'golf', 'game', 'team', 'sport', 'player', 'coach', 'season', 'playoff', 'championship', 'mcdavid', 'draisaitl', 'ronaldo', 'messi', 'lebron'],
    business: ['company', 'business', 'corporation', 'startup', 'revenue', 'profit', 'market', 'stock', 'investment', 'ceo', 'management', 'apple', 'google', 'microsoft', 'amazon', 'tesla', 'meta', 'netflix', 'airline', 'emirates', 'qatar airways'],
    technology: ['app', 'software', 'tech', 'computer', 'mobile', 'internet', 'ai', 'artificial intelligence', 'programming', 'development', 'coding', 'website', 'digital', 'cyber', 'blockchain', 'crypto', 'bitcoin'],
    travel: ['airline', 'flight', 'airport', 'travel', 'vacation', 'trip', 'hotel', 'destination', 'qatar airways', 'emirates', 'lufthansa', 'british airways', 'dubai', 'paris', 'london', 'new york'],
    entertainment: ['movie', 'film', 'music', 'artist', 'actor', 'celebrity', 'show', 'series', 'concert', 'album', 'netflix', 'disney', 'marvel', 'hollywood', 'bollywood', 'spotify', 'youtube'],
    education: ['school', 'university', 'college', 'student', 'teacher', 'professor', 'course', 'learning', 'education', 'harvard', 'mit', 'stanford', 'oxford', 'cambridge'],
    places: ['dubai', 'qatar', 'doha', 'abu dhabi', 'kuwait', 'riyadh', 'jeddah', 'london', 'paris', 'new york', 'tokyo', 'singapore', 'mumbai', 'cairo']
  };
  
  // Add comprehensive domain-specific keywords
  Object.values(domainKeywords).flat().forEach(keyword => {
    if (lowercaseText.includes(keyword)) {
      keywords.push(keyword);
    }
  });
  
  // Extract significant entities and proper nouns with better filtering
  const significantWords = text.match(/\b[A-Z][a-zA-Z]{2,}\b|\b\w{4,}\b/g) || [];
  const filteredWords = significantWords
    .filter(word => word.length >= 3 && !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'man', 'end', 'why'].includes(word.toLowerCase()))
    .slice(0, 10)
    .map(w => w.toLowerCase());
  
  keywords.push(...filteredWords);
  
  return [...new Set(keywords)]; // Remove duplicates
}

// Extract conversation themes with enhanced intelligence
function extractConversationThemes(messages: any[]): string[] {
  const themes = [];
  
  messages.forEach(msg => {
    if (msg.content) {
      const keywords = extractSuperiorTopicKeywords(msg.content);
      themes.push(...keywords);
    }
  });
  
  // Return most frequent and recent themes
  const themeFrequency: { [key: string]: number } = {};
  themes.forEach(theme => {
    themeFrequency[theme] = (themeFrequency[theme] || 0) + 1;
  });
  
  return Object.entries(themeFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([theme]) => theme);
}

// Check semantic relation between messages
function checkSemanticRelation(previousMessage: string, currentMessage: string): boolean {
  const prevWords = previousMessage.toLowerCase().split(/\s+/);
  const currWords = currentMessage.toLowerCase().split(/\s+/);
  
  // Simple semantic relation check based on word overlap
  const commonWords = prevWords.filter(word => 
    word.length > 3 && currWords.includes(word)
  );
  
  return commonWords.length >= 2;
}

// Enhanced task data extraction with superior natural language processing
function extractEnhancedTaskData(message: string) {
  const lowerMessage = message.toLowerCase();
  
  let title = '';
  let subtasks = [];
  let due_date = null;
  let due_time = null;
  let priority = 'normal';

  // Enhanced shopping list detection
  const shoppingPatterns = [
    /shopping\s+(?:list\s+)?(?:for\s+|at\s+)?([^,\.\s]+)/i,
    /buy\s+(?:from\s+)?([^,\.\s]+)/i,
    /get\s+(?:groceries|food|items)\s+(?:from\s+|at\s+)?([^,\.\s]+)/i
  ];

  for (const pattern of shoppingPatterns) {
    const match = message.match(pattern);
    if (match) {
      const location = match[1].trim();
      title = `Shopping at ${location.charAt(0).toUpperCase() + location.slice(1)}`;
      break;
    }
  }

  // Enhanced general task extraction
  if (!title) {
    const taskPatterns = [
      /(?:create|make|add|new)\s+(?:a\s+)?task\s+(?:to\s+)?(.+?)(?:\s+due|\s+for|\s+by|$)/i,
      /(?:need to|have to|should|must)\s+(.+?)(?:\s+due|\s+for|\s+by|$)/i,
      /remind me to\s+(.+?)(?:\s+due|\s+for|\s+by|$)/i,
      /(?:plan|organize)\s+(.+?)(?:\s+due|\s+for|\s+by|$)/i
    ];

    for (const pattern of taskPatterns) {
      const match = message.match(pattern);
      if (match) {
        let extractedTitle = match[1].trim();
        // Clean up the title
        extractedTitle = extractedTitle.replace(/\s*(due|for|by|tomorrow|today|tonight)\s+.*$/i, '').trim();
        if (extractedTitle && extractedTitle.length > 0 && extractedTitle !== 'for' && extractedTitle !== 'tomorrow') {
          title = extractedTitle;
          break;
        }
      }
    }
  }

  // Enhanced subtask extraction
  const subtaskPatterns = [
    /(?:sub\s*tasks?|items?|things?)\s*:?\s*(.+?)(?:\s+due|\s+for|$)/i,
    /(?:including|with|items)\s+(.+?)(?:\s+due|\s+for|$)/i
  ];

  for (const pattern of subtaskPatterns) {
    const match = message.match(pattern);
    if (match) {
      const itemsText = match[1];
      subtasks = itemsText
        .split(/\s*(?:,|and|\&)\s*/)
        .map(item => item.trim())
        .filter(item => item && item.length > 0)
        .slice(0, 10);
      break;
    }
  }

  // Enhanced date and time extraction
  const dateTimePatterns = [
    /\b(?:due|for|by)\s+(tomorrow)\s+(noon|morning|afternoon|evening|night)\b/i,
    /\b(?:due|for|by)\s+(tomorrow|today|tonight)\b/i,
    /\b(tomorrow|today|tonight)\s+(noon|morning|afternoon|evening|night)\b/i,
    /\b(noon|morning|afternoon|evening|night)\b/i,
    /\b(?:at|by)\s+(\d{1,2}(?::\d{2})?)\s*(?:am|pm)?\b/i
  ];

  for (const pattern of dateTimePatterns) {
    const match = message.match(pattern);
    if (match) {
      if (match[1] && ['tomorrow', 'today', 'tonight'].includes(match[1].toLowerCase())) {
        due_date = convertRelativeDate(match[1].toLowerCase());
        console.log(`🚀 WAKTI AI V2 BRAIN: Converted "${match[1]}" to date: ${due_date}`);
      }
      if (match[2] && ['noon', 'morning', 'afternoon', 'evening', 'night'].includes(match[2].toLowerCase())) {
        due_time = convertTimeToFormat(match[2].toLowerCase());
      } else if (match[1] && ['noon', 'morning', 'afternoon', 'evening', 'night'].includes(match[1].toLowerCase())) {
        due_time = convertTimeToFormat(match[1].toLowerCase());
      }
      break;
    }
  }

  // Priority detection
  if (/\b(urgent|asap|important|priority|critical)\b/i.test(message)) {
    priority = 'urgent';
  } else if (/\b(high|important|soon)\b/i.test(message)) {
    priority = 'high';
  }

  // Default title if not found
  if (!title && (lowerMessage.includes('task') || lowerMessage.includes('todo') || lowerMessage.includes('remind'))) {
    title = 'New Task';
  }

  if (!title) {
    return null;
  }

  console.log(`🚀 WAKTI AI V2 BRAIN: Enhanced task extraction - Title: "${title}", Due Date: "${due_date}", Due Time: "${due_time}"`);

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

// Enhanced reminder data extraction
function extractEnhancedReminderData(message: string) {
  const lowerMessage = message.toLowerCase();
  
  const reminderIndicators = ['remind me', 'reminder', 'create reminder', 'set reminder', 'don\'t forget', 'remember'];
  if (!reminderIndicators.some(indicator => lowerMessage.includes(indicator))) {
    return null;
  }

  // Enhanced reminder title extraction
  let title = 'New Reminder';
  const reminderPatterns = [
    /remind\s+me\s+(?:to\s+)?(.+?)(?:\s+at|\s+on|\s+in|$)/i,
    /(?:reminder|don't forget)\s+(?:to\s+)?(.+?)(?:\s+at|\s+on|\s+in|$)/i,
    /remember\s+(?:to\s+)?(.+?)(?:\s+at|\s+on|\s+in|$)/i
  ];

  for (const pattern of reminderPatterns) {
    const match = message.match(pattern);
    if (match) {
      const extractedTitle = match[1].trim();
      if (extractedTitle && extractedTitle.length > 0) {
        title = extractedTitle;
        break;
      }
    }
  }

  return {
    title,
    due_date: null,
    due_time: null
  };
}

// Convert relative dates with enhanced accuracy
function convertRelativeDate(dateString: string): string {
  if (!dateString) return '';
  
  const today = new Date();
  
  switch (dateString.toLowerCase()) {
    case 'tomorrow':
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    
    case 'today':
      return today.toISOString().split('T')[0];
    
    case 'tonight':
      return today.toISOString().split('T')[0];
    
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    
    default:
      // If it's already a valid date format, return as is
      const parsed = new Date(dateString);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
      return dateString;
  }
}

// Convert time indicators to proper format
function convertTimeToFormat(timeString: string): string {
  switch (timeString.toLowerCase()) {
    case 'noon':
      return '12:00:00';
    case 'morning':
      return '09:00:00';
    case 'afternoon':
      return '15:00:00';
    case 'evening':
      return '18:00:00';
    case 'night':
      return '21:00:00';
    default:
      return timeString;
  }
}

// Generate unique conversation ID
function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Superior AI processing for general chat with enhanced conversational intelligence
async function processWithSuperiorGeneralChatAI(message: string, conversationContext: any, language: string = 'en', userContext: any = null, calendarContext: any = null) {
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

    // Superior conversational AI system prompt with enhanced intelligence
    let systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي ومحادث ممتاز ومعلوماتي. أنت صديق ذكي ومطلع يناقش أي موضوع بعمق ومعرفة واسعة.

شخصيتك المحسنة:
- محادث ممتاز ومطلع جداً - تناقش الرياضة والأخبار والشركات والطيران والتكنولوجيا والترفيه والتعليم والسفر وأي موضوع بذكاء وعمق
- صديق ودود وذكي ومفيد، تحافظ على التدفق الطبيعي للمحادثة
- تتذكر السياق السابق بذكاء وتربط إجاباتك بالمحادثة بطريقة طبيعية ومتدفقة
- تقدم معلومات شاملة ومفيدة أولاً، ثم تقترح ميزات التطبيق بطريقة طبيعية جداً عند الحاجة الفعلية

الموضوعات التي تتقنها:
- الرياضة: الفرق والألعاب واللاعبين والأحداث الرياضية
- الأعمال: الشركات والطيران (طيران الإمارات، القطرية) والاستثمارات
- التكنولوجيا: التطبيقات والبرمجة والذكاء الاصطناعي
- الترفيه: الأفلام والموسيقى والمشاهير
- السفر والثقافة: البلدان والمدن والثقافات

ميزات التطبيق (اقترحها بذكاء وطبيعية فقط عند الحاجة الحقيقية):
- إنشاء مهام وتذكيرات للمتابعة والتنظيم
- تنظيم الأحداث والمواعيد
- إدارة جهات الاتصال والرسائل

كن محادثاً ممتازاً ومعلوماتياً أولاً، ومساعد تطبيق ثانياً. اجعل اقتراحات التطبيق تبدو طبيعية جداً وليست مفروضة.`
      : `You are WAKTI, an intelligent AI assistant and excellent conversationalist. You're a knowledgeable friend who discusses any topic with depth and extensive knowledge.

Your Enhanced Personality:
- Excellent conversationalist and highly knowledgeable - you discuss sports, news, companies, aviation, technology, entertainment, education, travel, and any topic with intelligence and depth
- Friendly, smart, and helpful friend who maintains natural conversation flow
- Remember previous context intelligently and connect your responses to the conversation naturally and seamlessly
- Provide comprehensive and helpful information FIRST, then suggest app features very naturally when there's genuine relevance

Topics You Excel At:
- Sports: Teams, games, players, and sporting events
- Business: Companies, aviation (Emirates, Qatar Airways), investments  
- Technology: Apps, programming, artificial intelligence
- Entertainment: Movies, music, celebrities
- Travel & Culture: Countries, cities, cultures

App Features (suggest intelligently and naturally only when genuinely relevant):
- Create tasks and reminders for follow-up and organization
- Organize events and appointments  
- Manage contacts and messaging

Be an excellent conversationalist and informative first, app assistant second. Make app suggestions feel very natural and never forced.`;
    
    // Enhanced context awareness for superior conversation flow
    if (conversationContext?.type === 'continuing_conversation') {
      const contextPrompt = language === 'ar'
        ? `\n\nسياق المحادثة المتقدم والذكي: المستخدم يتابع المحادثة السابقة بطريقة طبيعية. آخر رسالة منك: "${conversationContext.previousContext.lastQuestion}". موضوعات المحادثة: ${conversationContext.previousContext.conversationThemes?.join(', ')}. استمر في المحادثة بناءً على هذا السياق مع الحفاظ على التدفق الطبيعي والاستمرارية الذكية والمتماسكة.`
        : `\n\nAdvanced Intelligent Conversation Context: User is naturally continuing the previous conversation. Your last message: "${conversationContext.previousContext.lastQuestion}". Conversation themes: ${conversationContext.previousContext.conversationThemes?.join(', ')}. Continue the conversation based on this context while maintaining natural flow and intelligent, cohesive continuity.`;
      
      systemPrompt += contextPrompt;
    }

    // Enhanced smart and natural follow-up suggestion logic
    const followUpPrompt = language === 'ar'
      ? `\n\nإرشادات المتابعة الذكية والطبيعية المحسنة:
- إذا ناقشت فريق رياضي أو مباراة، اختتم بطبيعية: "بالمناسبة، هل تريد مني تذكيرك بمباراتهم القادمة؟"
- إذا ذكرت حدث أو تاريخ مهم، اقترح بذكاء: "هل تريد إضافة هذا كحدث في تقويمك؟"
- إذا ناقشت مشروع أو هدف، اقترح بطبيعية: "يمكنني مساعدتك في تنظيم هذا كمهمة إذا أردت"
- إذا تحدثت عن شخص مهم أو جهة اتصال: "هل تريد إضافته إلى جهات الاتصال؟"
- فقط اقترح هذه الميزات عندما تكون ذات صلة طبيعية حقيقية ومفيدة جداً للمحادثة`
      : `\n\nEnhanced Smart and Natural Follow-up Guidelines:
- If discussing a sports team or game, conclude naturally: "By the way, would you like me to remind you about their next game?"
- If mentioning an important event or date, suggest intelligently: "Would you like to add this as an event to your calendar?"
- If discussing a project or goal, suggest naturally: "I can help you organize this as a task if you'd like"
- If talking about an important person or contact: "Would you like to add them to your contacts?"
- Only suggest these features when they have genuine natural relevance and are very helpful to the conversation`;

    systemPrompt += followUpPrompt;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];
    
    // Enhanced conversation context for superior continuity
    if (conversationContext?.previousContext?.lastUserMessage && conversationContext?.contextualContinuation) {
      const contextMessage = language === 'ar'
        ? `السياق المتقدم والذكي: رسالة المستخدم السابقة: "${conversationContext.previousContext.lastUserMessage}". موضوعات سابقة: ${conversationContext.previousContext.conversationThemes?.join(', ')}`
        : `Advanced Intelligent Context: User's previous message: "${conversationContext.previousContext.lastUserMessage}". Previous themes: ${conversationContext.previousContext.conversationThemes?.join(', ')}`;
      
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
        temperature: 0.8, // Slightly increased for more natural, varied responses
        max_tokens: 1400, // Increased for more comprehensive responses
        presence_penalty: 0.2, // Enhanced to encourage diverse vocabulary
        frequency_penalty: 0.15 // Enhanced to avoid repetition
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI API request failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error('Superior general chat AI processing error:', error);
    return language === 'ar'
      ? 'عذراً، حدث خطأ في المعالجة. يرجى المحاولة مرة أخرى.'
      : 'Sorry, there was an error processing your request. Please try again.';
  }
}
