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
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY") || "yzJMWPrRdkJcge2q0yjSOwTGvlhMeOy1";

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
      enableWorkflowAutomation = false,
      // Task/Reminder confirmation
      confirmTask = false,
      pendingTaskData = null,
      confirmReminder = false,
      pendingReminderData = null
    } = requestBody;

    // Handle task confirmation
    if (confirmTask && pendingTaskData) {
      console.log("🔧 Processing task confirmation:", pendingTaskData);
      
      try {
        const taskData = {
          title: pendingTaskData.title,
          description: pendingTaskData.description || '',
          priority: pendingTaskData.priority || 'normal',
          due_date: pendingTaskData.due_date || pendingTaskData.suggestedDate,
          due_time: pendingTaskData.due_time,
          task_type: pendingTaskData.task_type || 'one-time',
          user_id: userId
        };

        const { data: task, error: taskError } = await supabase
          .from('tr_tasks')
          .insert(taskData)
          .select()
          .single();

        if (taskError) throw taskError;

        // Add subtasks if they exist
        if (pendingTaskData.subtasks && pendingTaskData.subtasks.length > 0) {
          const subtaskData = pendingTaskData.subtasks.map((subtask: string, index: number) => ({
            task_id: task.id,
            title: subtask,
            order_index: index
          }));

          const { error: subtaskError } = await supabase
            .from('tr_subtasks')
            .insert(subtaskData);

          if (subtaskError) console.error('Subtask creation error:', subtaskError);
        }

        return new Response(JSON.stringify({
          response: language === 'ar' 
            ? `✅ تم إنشاء المهمة "${task.title}" بنجاح!`
            : `✅ Task "${task.title}" created successfully!`,
          conversationId: conversationId || generateConversationId(),
          intent: 'task_created',
          confidence: 'high',
          actionTaken: 'create_task',
          actionResult: { task, created: true },
          success: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (error) {
        console.error("Task creation error:", error);
        return new Response(JSON.stringify({
          error: `Failed to create task: ${error.message}`,
          success: false
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Handle reminder confirmation
    if (confirmReminder && pendingReminderData) {
      console.log("🔔 Processing reminder confirmation:", pendingReminderData);
      
      try {
        const reminderData = {
          title: pendingReminderData.title,
          description: pendingReminderData.description || '',
          due_date: pendingReminderData.due_date || pendingReminderData.suggestedDate,
          due_time: pendingReminderData.due_time || pendingReminderData.suggestedTime,
          user_id: userId
        };

        const { data: reminder, error: reminderError } = await supabase
          .from('tr_reminders')
          .insert(reminderData)
          .select()
          .single();

        if (reminderError) throw reminderError;

        return new Response(JSON.stringify({
          response: language === 'ar' 
            ? `✅ تم إنشاء التذكير "${reminder.title}" بنجاح!`
            : `✅ Reminder "${reminder.title}" created successfully!`,
          conversationId: conversationId || generateConversationId(),
          intent: 'reminder_created',
          confidence: 'high',
          actionTaken: 'create_reminder',
          actionResult: { reminder, created: true },
          success: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (error) {
        console.error("Reminder creation error:", error);
        return new Response(JSON.stringify({
          error: `Failed to create reminder: ${error.message}`,
          success: false
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

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

    // Detect task/reminder creation intent
    const intentAnalysis = await analyzeTaskCreationIntent(message, conversationHistory, language, enhancedContext);
    console.log("🚀 WAKTI AI V2 BRAIN: Intent analysis:", intentAnalysis);

    // If user is confirming to proceed with task/reminder creation
    if (intentAnalysis.isConfirmation && intentAnalysis.pendingData) {
      console.log("🚀 WAKTI AI V2 BRAIN: User confirming creation, showing confirmation card");
      
      return new Response(JSON.stringify({
        response: intentAnalysis.confirmationMessage,
        conversationId: conversationId || generateConversationId(),
        intent: intentAnalysis.intent,
        confidence: 'high',
        actionTaken: intentAnalysis.actionType,
        actionResult: intentAnalysis.pendingData,
        needsConfirmation: true,
        pendingTaskData: intentAnalysis.intent === 'create_task' ? intentAnalysis.pendingData : null,
        pendingReminderData: intentAnalysis.intent === 'create_reminder' ? intentAnalysis.pendingData : null,
        success: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
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
    let needsConfirmation = false;

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
          try {
            console.log("🎨 Generating image with Runware API for prompt:", message);
            const imageResult = await generateImageWithRunware(message, userId, language);
            
            if (imageResult.success) {
              imageUrl = imageResult.imageUrl;
              response = language === 'ar' 
                ? `🎨 تم إنشاء الصورة بنجاح!\n\n**الوصف:** ${message}`
                : `🎨 Image generated successfully!\n\n**Prompt:** ${message}`;
            } else {
              response = language === 'ar' 
                ? `❌ عذراً، حدث خطأ في إنشاء الصورة: ${imageResult.error}`
                : `❌ Sorry, there was an error generating the image: ${imageResult.error}`;
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

      case 'advanced_search':
        response = language === 'ar' 
          ? `🔮 وضع البحث المتقدم\n\nهذه الميزة قيد التطوير.\n\nيرجى استخدام وضع البحث العادي أو المحادثة.`
          : `🔮 Advanced Search Mode\n\nThis feature is coming soon.\n\nPlease use regular Search or Chat mode.`;
        break;

      case 'chat':
      default:
        // Check for task/reminder creation intent in chat mode
        if (intentAnalysis.needsConfirmation) {
          response = intentAnalysis.confirmationMessage;
          needsConfirmation = true;
          actionTaken = intentAnalysis.actionType;
          actionResult = intentAnalysis.pendingData;
          
          if (intentAnalysis.intent === 'create_task') {
            pendingTaskData = intentAnalysis.pendingData;
          } else if (intentAnalysis.intent === 'create_reminder') {
            pendingReminderData = intentAnalysis.pendingData;
          }
        } else {
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
        }
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
      needsConfirmation,
      pendingTaskData,
      pendingReminderData,
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
      
      // Find the image inference result
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
          // Continue anyway, the image was generated successfully
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

// Enhanced task/reminder creation intent analysis
async function analyzeTaskCreationIntent(message: string, conversationHistory: any[], language: string = 'en', enhancedContext: string = '') {
  const lowerMessage = message.toLowerCase().trim();
  
  // Check if user is confirming a previous task/reminder suggestion
  const confirmationWords = [
    'proceed', 'yes', 'create', 'go ahead', 'do it', 'make it', 'confirm', 'ok', 'okay', 'sure',
    'نعم', 'أكد', 'أنشئ', 'اصنع', 'تقدم', 'حسنا', 'موافق'
  ];
  
  const isConfirmation = confirmationWords.some(word => lowerMessage.includes(word));
  
  // Look for previous AI suggestions in conversation history
  let lastAIMessage = null;
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    if (conversationHistory[i].role === 'assistant') {
      lastAIMessage = conversationHistory[i];
      break;
    }
  }
  
  // If user is confirming and AI previously suggested a task/reminder
  if (isConfirmation && lastAIMessage) {
    const lastContent = lastAIMessage.content.toLowerCase();
    
    // Check if the last AI message was suggesting task creation
    if (lastContent.includes('shopping') || lastContent.includes('task') || lastContent.includes('create')) {
      const taskData = extractTaskDataFromHistory(conversationHistory, message);
      if (taskData) {
        return {
          isConfirmation: true,
          needsConfirmation: true,
          intent: 'create_task',
          actionType: 'parse_task',
          pendingData: taskData,
          confirmationMessage: language === 'ar' 
            ? `سأقوم بإنشاء هذه المهمة:\n\n**${taskData.title}**\n\nهل تريد المتابعة؟`
            : `I'll create this task:\n\n**${taskData.title}**\n\nShall I proceed?`
        };
      }
    }
    
    // Check for reminder creation
    if (lastContent.includes('remind') || lastContent.includes('reminder')) {
      const reminderData = extractReminderDataFromHistory(conversationHistory, message);
      if (reminderData) {
        return {
          isConfirmation: true,
          needsConfirmation: true,
          intent: 'create_reminder',
          actionType: 'parse_reminder',
          pendingData: reminderData,
          confirmationMessage: language === 'ar' 
            ? `سأقوم بإنشاء هذا التذكير:\n\n**${reminderData.title}**\n\nهل تريد المتابعة؟`
            : `I'll create this reminder:\n\n**${reminderData.title}**\n\nShall I proceed?`
        };
      }
    }
  }
  
  // Direct task creation patterns
  const taskPatterns = [
    /\b(go\s+)?(shopping|shop)\s+(at|to|in)\s+([^,\.]+)/i,
    /\b(buy|purchase|get|pick\s+up)\s+(.+)/i,
    /\bneed\s+to\s+(go|buy|get|shop|visit|pick\s+up)/i,
    /\bhave\s+to\s+(go|buy|get|shop|visit|pick\s+up)/i,
    /\bmust\s+(go|buy|get|shop|visit|pick\s+up)/i,
    /\b(create|add|make|new)\s+task/i,
    /\btask\s+(to|for)/i,
    /\bto\s+do\s+list/i,
    /\btodo/i
  ];

  const isTaskRequest = taskPatterns.some(pattern => pattern.test(message));
  
  if (isTaskRequest) {
    const taskData = extractTaskData(message, language);
    return {
      isConfirmation: false,
      needsConfirmation: true,
      intent: 'create_task',
      actionType: 'parse_task',
      pendingData: taskData,
      confirmationMessage: generateTaskConfirmationMessage(taskData, language)
    };
  }

  // Reminder patterns
  const reminderPatterns = [
    /\bremind\s+me\s+(to|about)/i,
    /\b(create|add|set)\s+(a\s+)?reminder/i,
    /\bdon'?t\s+forget\s+to/i,
    /\ذكرني/i,
    /\أنشئ\s+تذكير/i
  ];

  const isReminderRequest = reminderPatterns.some(pattern => pattern.test(message));
  
  if (isReminderRequest) {
    const reminderData = extractReminderData(message, language);
    return {
      isConfirmation: false,
      needsConfirmation: true,
      intent: 'create_reminder',
      actionType: 'parse_reminder',
      pendingData: reminderData,
      confirmationMessage: generateReminderConfirmationMessage(reminderData, language)
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

// Extract task data from conversation history and current message
function extractTaskDataFromHistory(conversationHistory: any[], currentMessage: string) {
  // Look for shopping patterns in recent conversation
  for (let i = conversationHistory.length - 1; i >= Math.max(0, conversationHistory.length - 5); i--) {
    const msg = conversationHistory[i];
    if (msg.role === 'user' && msg.content) {
      const content = msg.content.toLowerCase();
      
      // Shopping pattern
      const shoppingMatch = content.match(/\b(go\s+)?(shopping|shop)\s+(at|to|in)\s+([^,\.]+)/i);
      if (shoppingMatch) {
        const location = shoppingMatch[4].trim();
        
        // Look for items
        const buyMatch = content.match(/\b(buy|get|purchase|pick\s+up)\s+(.+)/i);
        const subtasks = [];
        
        if (buyMatch) {
          const itemsText = buyMatch[2];
          const items = itemsText
            .split(/\s+and\s+|,\s*|\s*&\s*/)
            .map(item => item.trim())
            .filter(item => item && !item.match(/\b(at|to|in|from|for|on|when|where|why|how)\b/i))
            .slice(0, 10);
          
          subtasks.push(...items);
        }
        
        return {
          title: `Shopping at ${location}`,
          description: `Shopping list for ${location}`,
          subtasks: subtasks,
          priority: 'normal',
          task_type: 'one-time',
          due_date: null,
          suggestedDate: new Date().toISOString().split('T')[0] // Today
        };
      }
    }
  }
  
  return null;
}

// Extract reminder data from conversation history
function extractReminderDataFromHistory(conversationHistory: any[], currentMessage: string) {
  for (let i = conversationHistory.length - 1; i >= Math.max(0, conversationHistory.length - 5); i--) {
    const msg = conversationHistory[i];
    if (msg.role === 'user' && msg.content) {
      const content = msg.content;
      
      const reminderMatch = content.match(/\bremind\s+me\s+(to|about)\s+(.+)/i);
      if (reminderMatch) {
        return {
          title: `Reminder: ${reminderMatch[2]}`,
          description: '',
          due_date: new Date().toISOString().split('T')[0], // Today
          suggestedTime: '09:00'
        };
      }
    }
  }
  
  return null;
}

// Extract task data from message
function extractTaskData(message: string, language: string = 'en') {
  const lowerText = message.toLowerCase();
  
  // Extract title
  let title = "";
  const shoppingMatch = message.match(/\b(go\s+)?(shopping|shop)\s+(at|to|in)\s+([^,\.]+)/i);
  if (shoppingMatch) {
    const location = shoppingMatch[4].trim();
    title = `Shopping at ${location}`;
  } else {
    title = message.replace(/\b(create|add|make|new)\s+task\s*/i, "").trim();
    if (!title) title = "New task";
  }
  
  // Extract subtasks from shopping lists
  const subtasks: string[] = [];
  const buyMatch = message.match(/\b(buy|get|purchase|pick\s+up)\s+(.+)/i);
  if (buyMatch) {
    const itemsText = buyMatch[2];
    const items = itemsText
      .split(/\s+and\s+|,\s*|\s*&\s*/)
      .map(item => item.trim())
      .filter(item => item && !item.match(/\b(at|to|in|from|for|on|when|where|why|how)\b/i))
      .slice(0, 10);
    
    subtasks.push(...items);
  }
  
  // Extract priority
  let priority = "normal";
  if (lowerText.includes("urgent") || lowerText.includes("asap") || lowerText.includes("immediately")) {
    priority = "urgent";
  } else if (lowerText.includes("important") || lowerText.includes("soon")) {
    priority = "high";
  }
  
  return {
    title,
    description: '',
    subtasks,
    priority,
    task_type: 'one-time',
    due_date: null,
    suggestedDate: new Date().toISOString().split('T')[0] // Today
  };
}

// Extract reminder data from message
function extractReminderData(message: string, language: string = 'en') {
  const reminderMatch = message.match(/\bremind\s+me\s+(to|about)\s+(.+)/i);
  const title = reminderMatch ? `Reminder: ${reminderMatch[2]}` : message;
  
  return {
    title,
    description: '',
    due_date: new Date().toISOString().split('T')[0], // Today
    suggestedTime: '09:00'
  };
}

// Generate task confirmation message
function generateTaskConfirmationMessage(taskData: any, language: string = 'en') {
  const subtaskList = taskData.subtasks && taskData.subtasks.length > 0 
    ? `\n\n${language === 'ar' ? 'المهام الفرعية:' : 'Subtasks:'}\n${taskData.subtasks.map((s: string) => `• ${s}`).join('\n')}`
    : '';
    
  return language === 'ar' 
    ? `سأقوم بإنشاء هذه المهمة:\n\n**${taskData.title}**${subtaskList}\n\nهل تريد المتابعة؟`
    : `I'll create this task:\n\n**${taskData.title}**${subtaskList}\n\nShall I proceed?`;
}

// Generate reminder confirmation message
function generateReminderConfirmationMessage(reminderData: any, language: string = 'en') {
  return language === 'ar' 
    ? `سأقوم بإنشاء هذا التذكير:\n\n**${reminderData.title}**\n\nهل تريد المتابعة؟`
    : `I'll create this reminder:\n\n**${reminderData.title}**\n\nShall I proceed?`;
}

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
