import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { analyzeTaskIntent } from "./taskParsing.ts";
import { analyzeBuddyChatIntent, analyzeSmartModeIntent, processWithBuddyChatAI } from "./chatAnalysis.ts";
import { generateImageWithRunware } from "./imageGeneration.ts";
import { executeRegularSearch } from "./search.ts";
import { generateModeSuggestion, generateNaturalFollowUp, generateSearchFollowUp, generateConversationId, DEEPSEEK_API_KEY, OPENAI_API_KEY, TAVILY_API_KEY, RUNWARE_API_KEY, supabase } from "./utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

console.log("🤖 BUDDY-CHAT AI BRAIN: Enhanced conversational intelligence loaded");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🤖 BUDDY-CHAT AI BRAIN: Processing with enhanced conversational intelligence");

    // CRITICAL: Extract and verify authentication token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error("🤖 BUDDY-CHAT AI BRAIN: Missing authorization header");
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
      console.error("🤖 BUDDY-CHAT AI BRAIN: Authentication failed:", authError);
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
    // new: collect attachedFiles from request
    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      confirmSearch = false,
      activeTrigger = 'chat',
      contextMessages = [],
      attachedFiles = [],
      calendarContext = null,
      userContext = null,
      enhancedContext = '',
      memoryStats = {},
      conversationSummary = null
    } = requestBody;

    // CRITICAL: Ensure userId matches authenticated user
    if (userId !== user.id) {
      console.error("🤖 BUDDY-CHAT AI BRAIN: User ID mismatch - potential security breach attempt");
      return new Response(JSON.stringify({ 
        error: "User ID mismatch",
        success: false
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validate required fields
    if ((!message || typeof message !== 'string' || message.trim() === '') && attachedFiles.length === 0) {
      console.error("🤖 BUDDY-CHAT AI BRAIN: Invalid message field");
      return new Response(JSON.stringify({ 
        error: "Message or an attachment is required.",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("🤖 BUDDY-CHAT AI BRAIN: Processing message for authenticated user:", user.id);
    console.log("🤖 BUDDY-CHAT AI BRAIN: Active trigger mode:", activeTrigger);
    console.log("🤖 BUDDY-CHAT AI BRAIN: Enhanced context available:", !!enhancedContext);
    console.log("🤖 BUDDY-CHAT AI BRAIN: Memory stats:", memoryStats);

    // Enhanced buddy-chat analysis with natural intelligence
    const buddyAnalysis = analyzeBuddyChatIntent(message, activeTrigger, enhancedContext, language);
    console.log("🤖 BUDDY-CHAT AI BRAIN: Buddy analysis result:", buddyAnalysis);

    // Enhanced task analysis
    const taskAnalysis = await analyzeTaskIntent(message, language);
    console.log("🤖 BUDDY-CHAT AI BRAIN: Task analysis result:", taskAnalysis);

    // Smart cross-mode suggestions
    const modeAnalysis = analyzeSmartModeIntent(message, activeTrigger, language);
    console.log("🤖 BUDDY-CHAT AI BRAIN: Mode analysis result:", modeAnalysis);

    // Generate response based on enhanced buddy-chat intelligence
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let actionTaken = null;
    let actionResult = null;
    let needsConfirmation = false;
    let pendingTaskData = null;
    let pendingReminderData = null;
    let buddyChat = {};

    // Handle task/reminder creation intelligence
    if (taskAnalysis.isTask || taskAnalysis.isReminder) {
      console.log("🤖 BUDDY-CHAT AI BRAIN: Task/Reminder detected, preparing confirmation data");
      
      needsConfirmation = true;
      
      if (taskAnalysis.isTask) {
        pendingTaskData = taskAnalysis.taskData;
        response = language === 'ar' 
          ? `اكتشفت أنك تريد إنشاء مهمة. راجع التفاصيل أدناه وتأكد من صحتها:`
          : `I detected you want to create a task. Please review the details below and confirm:`;
      } else {
        pendingReminderData = taskAnalysis.reminderData;
        response = language === 'ar' 
          ? `اكتشفت أنك تريد إنشاء تذكير. راجع التفاصيل أدناه وتأكد من صحتها:`
          : `I detected you want to create a reminder. Please review the details below and confirm:`;
      }
    } else {
      // Handle enhanced buddy-chat modes with natural intelligence
      switch (activeTrigger) {
        case 'search':
          // Enhanced search with conversational follow-up
          if (buddyAnalysis.naturalQuery || modeAnalysis.allowInMode) {
            console.log("🔍 Executing enhanced conversational search for user:", user.id);
            
            const searchResult = await executeRegularSearch(message, language);
            if (searchResult.success) {
              browsingUsed = true;
              browsingData = searchResult.data;
              
              // Process with enhanced buddy-chat AI
              response = await processWithBuddyChatAI(
                message, 
                searchResult.context, 
                language, 
                contextMessages, 
                enhancedContext,
                activeTrigger,
                'search_with_results'
              );
              
              // Add conversational follow-up for search
              response += generateSearchFollowUp(language);
            } else {
              response = await processWithBuddyChatAI(
                message, 
                null, 
                language, 
                contextMessages, 
                enhancedContext,
                activeTrigger,
                'search_without_results'
              );
            }
            
            buddyChat = {
              searchFollowUp: true,
              engagement: 'high'
            };
          } else {
            response = language === 'ar' 
              ? `🔍 أنت في وضع البحث الذكي\n\nيمكنني مساعدتك في البحث عن المعلومات الحديثة. ما الذي تود البحث عنه؟`
              : `🔍 You're in Smart Search Mode\n\nI can help you find current information. What would you like to search for?`;
          }
          break;

        case 'image':
          if (buddyAnalysis.naturalQuery || modeAnalysis.allowInMode) {
            try {
              console.log("🎨 Handling image generation request for prompt:", message);
              const imageResult = await generateImageWithRunware(message, user.id, language);
              
              if (imageResult.success) {
                imageUrl = imageResult.imageUrl;
                
                let baseResponse = language === 'ar' 
                  ? `تم إنشاء الصورة بنجاح.`
                  : `I've successfully generated the image.`;

                if (imageResult.translation_status === 'success' && imageResult.translatedPrompt) {
                  baseResponse += language === 'ar'
                    ? `\n\n📝 (ملاحظة: تمت ترجمة وصفك إلى الإنجليزية: "${imageResult.translatedPrompt}")`
                    : `\n\n📝 (Note: Your prompt was translated to English: "${imageResult.translatedPrompt}")`;
                }

                const buddyContext = `Image generated successfully. Original prompt: "${message}". ${imageResult.translatedPrompt ? `Translated to: "${imageResult.translatedPrompt}"` : ''}`;

                const buddyResponse = await processWithBuddyChatAI(
                  message,
                  buddyContext,
                  language,
                  contextMessages,
                  enhancedContext,
                  activeTrigger,
                  'image_generated'
                );

                response = baseResponse + "\n\n" + buddyResponse;
                
                buddyChat = {
                  creativeEncouragement: true,
                  engagement: 'high'
                };
              } else {
                console.error("Image generation failed:", imageResult.error);
                response = imageResult.error; // Use the specific error message from the handler
              }
            } catch (error) {
              console.error("An unexpected error occurred during image generation:", error);
              response = language === 'ar' 
                ? `❌ عذراً، حدث خطأ غير متوقع أثناء إنشاء الصورة.`
                : `❌ Sorry, an unexpected error occurred while generating the image.`;
            }
          } else {
            response = language === 'ar' 
              ? `🎨 أنت في وضع إنشاء الصور الإبداعي\n\nصف لي الصورة التي تريد إنشاءها وسأجعلها حقيقة!`
              : `🎨 You're in Creative Image Mode\n\nDescribe the image you want to create and I'll bring it to life!`;
          }
          break;

        case 'chat':
        default:
          // Enhanced buddy-chat mode with natural conversations
          response = await processWithBuddyChatAI(
            message, 
            null, 
            language, 
            contextMessages, 
            enhancedContext,
            activeTrigger,
            'buddy_chat',
            attachedFiles
          );
          
          // Add smart cross-mode suggestions
          if (modeAnalysis.suggestMode && modeAnalysis.suggestMode !== activeTrigger) {
            const modeSuggestion = generateModeSuggestion(modeAnalysis.suggestMode, language);
            response += '\n\n' + modeSuggestion;
            
            buddyChat = {
              crossModeSuggestion: modeAnalysis.suggestMode,
              engagement: 'medium'
            };
          } else {
            buddyChat = {
              followUpQuestion: generateNaturalFollowUp(message, response, language),
              engagement: 'high'
            };
          }
          break;
      }
    }

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: buddyAnalysis?.intent,
      confidence: buddyAnalysis?.confidence,
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
      needsClarification: false,
      buddyChat,
      success: true
    };

    console.log("🤖 BUDDY-CHAT AI BRAIN: Sending enhanced conversational response for user:", user.id);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🤖 BUDDY-CHAT AI BRAIN: Error processing request:", error);
    
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

// Enhanced buddy-chat intent analysis
function analyzeBuddyChatIntent(message: string, activeTrigger: string, enhancedContext: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  // Natural conversation patterns
  const naturalPatterns = {
    greeting: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'مرحبا', 'أهلا', 'السلام'],
    continuation: ['also', 'and', 'furthermore', 'additionally', 'كذلك', 'أيضا', 'و'],
    question: ['what', 'how', 'when', 'where', 'why', 'ما', 'كيف', 'متى', 'أين', 'لماذا', '?'],
    enthusiasm: ['awesome', 'great', 'amazing', 'wonderful', 'رائع', 'عظيم', 'ممتاز'],
    concern: ['worried', 'concerned', 'problem', 'issue', 'قلق', 'مشكلة', 'مهتم']
  };
  
  let intent = 'general_chat';
  let confidence = 'medium';
  let naturalQuery = true;
  
  // Detect intent based on patterns
  for (const [intentType, patterns] of Object.entries(naturalPatterns)) {
    if (patterns.some(pattern => lowerMessage.includes(pattern))) {
      intent = intentType;
      confidence = 'high';
      break;
    }
  }
  
  // Check if this feels like a natural continuation of conversation
  if (enhancedContext) {
    const hasContext = enhancedContext.length > 100;
    const mentionsPrevious = ['that', 'this', 'it', 'them', 'هذا', 'ذلك', 'إياه'].some(word => 
      lowerMessage.includes(word)
    );
    
    if (hasContext && mentionsPrevious) {
      intent = 'conversation_continuation';
      confidence = 'high';
    }
  }
  
  return {
    intent,
    confidence,
    naturalQuery,
    conversational: true
  };
}

// Smart mode analysis for natural cross-mode suggestions
function analyzeSmartModeIntent(message: string, activeTrigger: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  // Patterns that suggest different modes
  const modePatterns = {
    search: ['weather', 'news', 'current', 'latest', 'price', 'score', 'who is', 'what is', 'طقس', 'أخبار', 'آخر', 'سعر'],
    image: ['create image', 'draw', 'generate picture', 'make art', 'أنشئ صورة', 'ارسم', 'اصنع'],
    chat: ['tell me about yourself', 'how are you', 'chat', 'talk', 'أخبرني', 'كيف حالك', 'تحدث']
  };
  
  let suggestMode = null;
  let allowInMode = true;
  
  // If in chat mode, suggest other modes for specific queries
  if (activeTrigger === 'chat') {
    for (const [mode, patterns] of Object.entries(modePatterns)) {
      if (mode !== 'chat' && patterns.some(pattern => lowerMessage.includes(pattern))) {
        suggestMode = mode;
        break;
      }
    }
  }
  
  // All modes should allow natural conversation
  if (activeTrigger === 'search') {
    allowInMode = true; // Always allow search queries
  } else if (activeTrigger === 'image') {
    allowInMode = modePatterns.image.some(pattern => lowerMessage.includes(pattern)) || 
                 lowerMessage.length > 10; // Allow descriptive prompts
  }
  
  return {
    suggestMode,
    allowInMode,
    naturalFlow: true
  };
}

// Enhanced task analysis function - NOW prefers DeepSeek for extraction, falls back to OpenAI
async function analyzeTaskIntent(message: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();

  // Task keywords
  const taskKeywords = [
    'task', 'todo', 'do', 'complete', 'finish', 'work on', 'need to', 'have to', 'must',
    'مهمة', 'عمل', 'أنجز', 'أكمل', 'يجب', 'لازم', 'محتاج'
  ];

  // Reminder keywords  
  const reminderKeywords = [
    'remind', 'reminder', "don't forget", 'remember', 'alert', 'notify',
    'ذكرني', 'تذكير', 'لا تنس', 'تذكر', 'نبهني'
  ];

  const isTaskKeyword = taskKeywords.some(keyword => lowerMessage.includes(keyword));
  const isReminderKeyword = reminderKeywords.some(keyword => lowerMessage.includes(keyword));

  let isTask = false;
  let isReminder = false;

  if (isTaskKeyword && !isReminderKeyword) {
    isTask = true;
  } else if (isReminderKeyword && !isTaskKeyword) {
    isReminder = true;
  } else if (isTaskKeyword && isReminderKeyword) {
    isTask = true;
  } else {
    const actionVerbs = [
      'buy', 'get', 'call', 'email', 'meeting', 'appointment', 'shopping',
      'اشتري', 'خذ', 'اتصل', 'ايميل', 'اجتماع', 'موعد', 'تسوق'
    ];
    isTask = actionVerbs.some(verb => lowerMessage.includes(verb));
  }

  if (!isTask && !isReminder) {
    return { isTask: false, isReminder: false };
  }

  // --- NEW LOGIC: AI-powered extraction using DeepSeek preferred, fallback to OpenAI ---
  let extractionOk = false;
  let aiExtracted: any = {};
  let providerTried: string = "";

  // Compose a single prompt for both providers, with date context for better results
  const todayISO = new Date().toISOString().split('T')[0];
  const systemPrompt = language === 'ar'
    ? "ساعدني في استخراج الحقول المنظمة من نص عبارة عن طلب مهمة أو تذكير."
    : "Help me extract structured fields from a user's to-do or reminder request.";
  const userPrompt = language === 'ar'
    ? `
اليوم: ${todayISO}
حلل رسالة المستخدم التالية. استخرج الحقول (title, description, due_date, due_time, subtasks (قائمة), priority).
- date بصيغة YYYY-MM-DD
- time بصيغة HH:MM (24)
أعد فقط JSON منظم، مثال:
{
  "title": "اذهب إلى فيستيفال سيتي مول",
  "description": "",
  "due_date": "2025-06-16",
  "due_time": "09:00",
  "subtasks": ["قميص أسود", "بنطال أسود", "حذاء أسود", "جوارب سوداء"],
  "priority": "normal"
}
رسالة المستخدم:
"${message}"
`
    : `
Today is: ${todayISO}
Analyze the following user message and extract:
- title (short task intent/action),
- description (only if present; otherwise empty),
- due_date (YYYY-MM-DD),
- due_time (24hr format HH:MM, if present),
- subtasks (as an array, extracted from shopping lists, comma/and/bullet separated, etc.),
- priority ("normal" or "high")

Return ONLY this JSON, with no comments:
{
  "title": "...",
  "description": "...",
  "due_date": "...",
  "due_time": "...",
  "subtasks": [...],
  "priority": "normal"
}
User message:
"${message}"
`;

  // Try DeepSeek first if key is available
  if (DEEPSEEK_API_KEY) {
    try {
      providerTried = "deepseek";
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.0,
          max_tokens: 512
        })
      });
      if (resp.ok) {
        const dsData = await resp.json();
        const reply = dsData.choices?.[0]?.message?.content || "";
        try {
          aiExtracted = JSON.parse(reply);
          extractionOk = true;
        } catch (e) {
          // Try cleaning up code blocks
          const jsonStr = reply.replace(/^```(json)?/,'').replace(/```$/,'').trim();
          try {
            aiExtracted = JSON.parse(jsonStr);
            extractionOk = true;
          } catch (e2) {
            extractionOk = false;
          }
        }
      }
    } catch (e) {
      extractionOk = false;
    }
  }

  // Fallback to OpenAI if DeepSeek not available or failed
  if (!extractionOk && OPENAI_API_KEY) {
    try {
      providerTried = "openai";
      const apiResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.0,
          max_tokens: 512
        }),
      });

      if (apiResp.ok) {
        const aiData = await apiResp.json();
        const reply = aiData.choices?.[0]?.message?.content || "";
        try {
          aiExtracted = JSON.parse(reply);
          extractionOk = true;
        } catch (e) {
          // Try to cleanup codeblocks or extra output:
          const jsonStr = reply.replace(/^```(json)?/,'').replace(/```$/,'').trim();
          try {
            aiExtracted = JSON.parse(jsonStr);
            extractionOk = true;
          } catch (e2) {
            extractionOk = false;
          }
        }
      }
    } catch (err) {
      extractionOk = false;
    }
  }

  if (extractionOk && typeof aiExtracted === 'object' && aiExtracted.title) {
    const fill = (field: string, fallback: any) =>
      (typeof aiExtracted[field] === 'string' || Array.isArray(aiExtracted[field]))
        ? aiExtracted[field]
        : fallback;

    const resultData = {
      title: fill("title", ""),
      description: fill("description", ""),
      due_date: fill("due_date", null),
      due_time: fill("due_time", null),
      subtasks: Array.isArray(aiExtracted.subtasks) ? aiExtracted.subtasks : [],
      priority: fill("priority", "normal")
    };

    if (isTask) {
      return {
        isTask,
        isReminder,
        taskData: resultData,
        reminderData: null
      };
    }
    if (isReminder) {
      return {
        isTask,
        isReminder,
        taskData: null,
        reminderData: resultData
      };
    }
  }

  // Fallback: If for some reason extraction failed, use previous (regex) logic:
  // --- BEGIN FALLBACK LEGACY REGEX LOGIC ---

  // Extract subtasks after the word 'subtask' or 'subtasks'
  let subtasks: string[] = [];
  let textForSubtasks = '';
  const subtaskRegex = /(subtask[s]?:?|مهام فرعية|subtasks?|مهام?)\s*([^\n]*)/i;
  const subtaskMatch = message.match(subtaskRegex);
  if (subtaskMatch && subtaskMatch[2]) {
    // Look for comma or Arabic comma
    textForSubtasks = subtaskMatch[2];
    subtasks = textForSubtasks.split(/[,،]/).map(s => s.trim()).filter(s => s.length > 0);
  }

  // Additionally, if there is "subtask X, Y, Z" in the middle of the message
  // but also some list items, combine them
  // e.g. "- item1\n- item2" (markdown) or "* item" or "• item"
  const listItems = message.match(/[-•*]\s*([^-•*\n]+)/g);
  if (listItems) {
    listItems.forEach(item => {
      const cleaned = item.replace(/[-•*]\s*/, '').trim();
      if (cleaned) subtasks.push(cleaned);
    });
  }

  // Remove duplicates from subtasks
  subtasks = [...new Set(subtasks)];

  // --- Title extraction ---
  // Look for "title X", or after "task", trim around
  let title = '';
  // 1. Try "title: ..." or "title ..." 
  const titleRegex = /(title[:\s]*|العنوان[:\s]*)([^,؛\n]*)/i;
  const titleMatch = message.match(titleRegex);
  if (titleMatch && titleMatch[2]) {
    title = titleMatch[2].trim();
  }
  // 2. Else, try after "task", e.g. "task X" or "مهمة X"
  if (!title) {
    const afterTaskRegex = /(task|مهمة)[:,]?\s*([^\n,،]*)/i;
    const taskMatch = message.match(afterTaskRegex);
    if (taskMatch && taskMatch[2]) {
      title = taskMatch[2].trim();
    }
  }
  // 3. Else, try looking for something before "subtask" or just after keywords
  if (!title && subtaskRegex.test(message)) {
    // Anything before "subtask ..."
    title = message.split(subtaskMatch[0])[0]
      .replace(/.*title[:,]?\s*/i, '')
      .replace(/.*task[:,]?\s*/i, '')
      .replace(/.*مهمة[:,]?\s*/i, '')
      .trim()
      .replace(/[,،]+$/, '');
  }
  // 4. Fallback, if still empty, remove all keywords and subtasks, try picking a main phrase.
  if (!title) {
    let fallback = message
      .replace(subtaskRegex, '')
      .replace(/(task|todo|reminder|remind|title|subtask|subtasks|do|need to|have to|must|create|for|at|في|على|مهمة|تذكير|العنوان|مهام فرعية)/gi, '')
      .replace(/[,،]+/g, ' ')
      .replace(/\s+/, ' ')
      .trim();
    if (fallback.length > 0) {
      title = fallback;
    } else {
      // Default fallback
      title = language === 'ar' ? 'مهمة بدون عنوان' : 'Untitled Task';
    }
  }

  // 5. Remove trailing times or dates from title
  title = title.replace(/\b(at|في)\s*\d{1,2}(:\d{2})?\s*(am|pm|ص|م)?/gi, '').replace(/\s+$/, '');

  // --- Description extraction (NOT extracted from user message at this time) ---
  let description = '';

  // --- Date & Time extraction ---
  let due_date = null;
  let due_time = null;
  // Standard patterns
  const timeRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|ص|م)?\b/gi;
  const dateTimeRegex = /(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|غداً|اليوم|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|الأحد)/gi;
  const dateTimeMatches = message.match(dateTimeRegex);

  // Dates
  if (dateTimeMatches) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const match of dateTimeMatches) {
      const lower = match.toLowerCase();
      if (lower === 'today' || lower === 'اليوم') {
        due_date = today.toISOString().split('T')[0];
      } else if (lower === 'tomorrow' || lower === 'غداً') {
        due_date = tomorrow.toISOString().split('T')[0];
      }
      // Else, ignore for now (other dates not handled here: future enhancement)
    }
  }
  // If no date, fallback to tomorrow
  if (!due_date) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    due_date = tomorrow.toISOString().split('T')[0];
  }

  // Times
  const timeMatch = message.match(timeRegex);
  if (timeMatch && timeMatch.length > 0) {
    // Take the first recognized time in the string
    const first = timeMatch[0];
    // Parse e.g. "9 AM", "09:00", "3pm"
    const parsed = first.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|ص|م)?/i);
    if (parsed) {
      let hour = parseInt(parsed[1]);
      let minute = parsed[2] ? parseInt(parsed[2]) : 0;
      const suffix = parsed[3] ? parsed[3].toLowerCase() : '';
      if (suffix === 'pm' || suffix === 'م') {
        if (hour < 12) hour += 12;
      }
      if (suffix === 'am' || suffix === 'ص') {
        if (hour === 12) hour = 0;
      }
      // Format as "HH:MM"
      due_time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }
  }

  // --- Priority extraction ---
  let priority = 'normal';
  const urgentWords = ['urgent', 'asap', 'important', 'priority', 'عاجل', 'مهم', 'أولوية'];
  if (urgentWords.some(word => lowerMessage.includes(word))) {
    priority = 'high';
  }

  // Remove title parts from subtasks if user wrote "subtask: ...title..."
  subtasks = subtasks.filter(st => st && st.toLowerCase() !== title.toLowerCase());

  const taskData = {
    title,
    description,
    due_date,
    due_time,
    subtasks,
    priority
  };
  const reminderData = {
    title,
    description,
    due_date,
    due_time,
    priority
  };

  return {
    isTask,
    isReminder,
    taskData: isTask ? taskData : null,
    reminderData: isReminder ? reminderData : null
  };

  // --- END FALLBACK LEGACY REGEX LOGIC ---
}

// Generate natural follow-up questions
function generateNaturalFollowUp(userMessage: string, aiResponse: string, language: string = 'en'): string {
  const followUps = language === 'ar' ? [
    'هل تريد معرفة المزيد عن هذا؟',
    'ما رأيك في هذا؟',
    'هل هذا يساعدك؟',
    'هل لديك أسئلة أخرى؟',
    'ما الذي تريد معرفته أيضا؟'
  ] : [
    'What do you think about this?',
    'Would you like to know more?',
    'Is this helpful for you?',
    'Do you have any other questions?',
    'What else would you like to explore?'
  ];
  
  return followUps[Math.floor(Math.random() * followUps.length)];
}

// Generate mode suggestions (buddy-like, explicit about current mode, never asking for action, just suggestion)
function generateModeSuggestion(suggestedMode: string, language: string = 'en'): string {
  if (language === 'ar') {
    switch (suggestedMode) {
      case 'search':
        return "أنا حالياً في وضع المحادثة! للمعلومات الأحدث أو النتائج الفورية، اضغط على زر البحث بالأسفل 🔍";
      case 'image':
        return "محادثتنا الآن نصية، لكن إذا أردت صورة لهذا، جرّب زر الصور بالأسفل 🎨";
      case 'chat':
        return "هذه إجابة مباشرة منّي. إذا أردت دردشة أعمق أو معرفة أكثر، استمر في الحديث هنا! 😊";
      default:
        return "جرّب الوضع المناسب من الأزرار بالأسفل لتحصل على أفضل تجربة!";
    }
  } else {
    switch (suggestedMode) {
      case 'search':
        return "I'm in chat mode! For up-to-date scores or info, just hit the search button below! 🔍";
      case 'image':
        return "We're chatting here—if you want an image for this, tap the image button below! 🎨";
      case 'chat':
        return "That’s a quick answer from me. If you want to chat more, just keep talking! 😊";
      default:
        return "Try the buttons below for the best experience for your request!";
    }
  }
}

// Generate search follow-up
function generateSearchFollowUp(language: string = 'en'): string {
  const followUps = language === 'ar' ? [
    '\n\n🔍 هل تريد البحث عن تفاصيل أكثر؟',
    '\n\n💭 ما الذي يثير اهتمامك في هذا الموضوع؟',
    '\n\n📚 هل تريد معرفة معلومات ذات صلة؟'
  ] : [
    '\n\n🔍 Would you like me to search for more details?',
    '\n\n💭 What interests you most about this topic?',
    '\n\n📚 Want to explore related information?'
  ];
  
  return followUps[Math.floor(Math.random() * followUps.length)];
}

// SIMPLIFIED: Regular search function with optional web browsing
async function executeRegularSearch(query: string, language: string = 'en') {
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
    
    console.log("🔍 Executing regular Tavily search for query:", query);
    
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
    console.log("✅ Regular Tavily search successful");
    
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
    console.error("Regular search execution error:", error);
    
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

// Enhanced AI processing function with buddy-chat personality
async function processWithBuddyChatAI(
  message: string, 
  context: string | null, 
  language: string = 'en', 
  contextMessages: any[] = [],
  enhancedContext: string = '',
  activeTrigger: string = 'chat',
  interactionType: string = 'buddy_chat',
  attachedFiles: any[] = []
) {
  try {
    console.log("🤖 BUDDY-CHAT AI: Processing with enhanced conversational intelligence");
    if (attachedFiles.length > 0) {
      console.log(`🤖 BUDDY-CHAT AI: Processing with ${attachedFiles.length} file(s) for vision analysis.`);
    }
    
    let apiKey = DEEPSEEK_API_KEY;
    let apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    let model = 'deepseek-chat';
    
    // Force OpenAI for any request with files/images
    if (!apiKey || (attachedFiles && attachedFiles.length > 0)) {
      apiKey = OPENAI_API_KEY;
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      model = 'gpt-4o-mini'; // This model supports vision
    }
    
    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    // Enhanced buddy-chat system prompt
    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي ودود يشبه الصديق المقرب. تتميز بالدفء والفضول الطبيعي وتحب المحادثات العميقة والمفيدة.

خصائص شخصيتك:
- ودود ومحادث طبيعي مثل الصديق المفضل
- فضولي ومهتم حقاً بما يقوله المستخدم
- تطرح أسئلة متابعة طبيعية ومثيرة للاهتمام
- تتذكر ما تم مناقشته وتشير إليه بشكل طبيعي
- تقترح أوضاع مختلفة بذكاء عند الحاجة
- تستخدم الرموز التعبيرية بذوق وطبيعية

الوضع الحالي: ${activeTrigger}
نوع التفاعل: ${interactionType}

تعليمات التنسيق:
- استخدم نصاً طبيعياً ودافئاً
- اجعل المحادثة تتدفق بشكل طبيعي
- أضف أسئلة متابعة أو تعليقات مثيرة للاهتمام
- كن مفيداً ومشاركاً في نفس الوقت`

      : `You are WAKTI, an intelligent and friendly AI assistant that feels like a close buddy. You're warm, naturally curious, and love having deep, helpful conversations.

Your personality traits:
- Friendly and conversational like a favorite friend
- Genuinely curious and interested in what the user says
- Ask natural, engaging follow-up questions
- Remember what's been discussed and reference it naturally
- Intelligently suggest different modes when helpful
- Use emojis tastefully and naturally

Current mode: ${activeTrigger}
Interaction type: ${interactionType}

Formatting instructions:
- Use natural, warm text
- Make conversation flow naturally
- Add engaging follow-up questions or comments
- Be helpful and engaging at the same time`;
    
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add enhanced context if available
    if (enhancedContext) {
      messages.push({ 
        role: 'assistant', 
        content: `Previous conversation context:\n${enhancedContext}` 
      });
    }
    
    // Add recent context messages for better continuity
    if (contextMessages && contextMessages.length > 0) {
      const recentMessages = contextMessages.slice(-6); // More context for buddy chat
      recentMessages.forEach(msg => {
        // Ensure content is a simple string for non-vision models if needed
        let content = msg.content;
        if (typeof content !== 'string') {
          // Attempt to find a text part if it's a complex object
          if (Array.isArray(content) && content.length > 0) {
            const textPart = content.find(p => p.type === 'text');
            content = textPart ? textPart.text : '[attachment]';
          } else {
            content = '[attachment]';
          }
        }
        messages.push({
          role: msg.role,
          content: content
        });
      });
    }
    
    // Add search context if available
    if (context) {
      messages.push({ 
        role: 'assistant', 
        content: `Search context: ${context}` 
      });
    }
    
    // Construct user message content. It can be a simple string or an array for multimodal input.
    let userContent: any = message;
    
    // If there are files, build a multipart message for vision-capable models
    if (attachedFiles && attachedFiles.length > 0) {
      const contentParts: any[] = [{ type: 'text', text: message }];

      attachedFiles.forEach(file => {
        // file has { type: 'image/jpeg', content: 'base64string' }
        if (file.type && file.type.startsWith('image/')) {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: `data:${file.type};base64,${file.content}`
            }
          });
        }
      });
      
      userContent = contentParts;
    }

    // Add the current message (which could be multimodal)
    messages.push({ role: 'user', content: userContent });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.8, // Higher temperature for more conversational responses
        max_tokens: 2048 // Increased token limit for vision
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI API failed: ${response.status}`, errorText);
      throw new Error(`AI API failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error("🤖 BUDDY-CHAT AI: Processing error:", error);
    
    // Enhanced fallback responses
    return language === 'ar' 
      ? `أعتذر صديقي، واجهت مشكلة صغيرة. لكن لا تقلق، سأكون هنا عندما تحتاجني! 😊 هل يمكنك المحاولة مرة أخرى؟`
      : `Sorry buddy, I hit a small snag there. But don't worry, I'm still here for you! 😊 Can you try again?`;
  }
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
