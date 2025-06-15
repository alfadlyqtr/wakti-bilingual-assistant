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

console.log("🔍 UNIFIED AI BRAIN: Function loaded with enhanced task intelligence");

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
    console.log("🔍 UNIFIED AI BRAIN: Processing request with enhanced task intelligence");

    // CRITICAL: Extract and verify authentication token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error("🔍 UNIFIED AI BRAIN: Missing authorization header");
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
      console.error("🔍 UNIFIED AI BRAIN: Authentication failed:", authError);
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
    console.log("🔍 UNIFIED AI BRAIN: Request body received for user:", user.id);

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
      userContext = null
    } = requestBody;

    // CRITICAL: Ensure userId matches authenticated user
    if (userId !== user.id) {
      console.error("🔍 UNIFIED AI BRAIN: User ID mismatch - potential security breach attempt");
      return new Response(JSON.stringify({ 
        error: "User ID mismatch",
        success: false
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

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

    console.log("🔍 UNIFIED AI BRAIN: Processing message for authenticated user:", user.id);
    console.log("🔍 UNIFIED AI BRAIN: Active trigger mode:", activeTrigger);
    console.log("🔍 UNIFIED AI BRAIN: Attached files count:", attachedFiles.length);

    // Enhanced task analysis
    const taskAnalysis = analyzeTaskIntent(message, language);
    console.log("🔍 UNIFIED AI BRAIN: Task analysis result:", taskAnalysis);

    // Enforce trigger isolation
    const intent = analyzeTriggerIntent(message, activeTrigger, language);
    console.log("🔍 UNIFIED AI BRAIN: Trigger analysis result:", intent);

    // Generate response based on trigger isolation with REAL AI
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

    // Handle task/reminder creation intelligence
    if (taskAnalysis.isTask || taskAnalysis.isReminder) {
      console.log("🔍 UNIFIED AI BRAIN: Task/Reminder detected, preparing confirmation data");
      
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
      // Handle trigger types with NO search quota restrictions for non-task messages
      switch (activeTrigger) {
        case 'search':
          // No quota checking - execute search directly
          if (intent.allowed) {
            console.log("🔍 Executing search for user:", user.id);
            
            const searchResult = await executeRegularSearch(message, language);
            if (searchResult.success) {
              browsingUsed = true;
              browsingData = searchResult.data;
              response = await processWithAI(message, searchResult.context, language, contextMessages);
            } else {
              response = await processWithAI(message, null, language, contextMessages);
            }
          } else {
            response = language === 'ar' 
              ? `⚠️ أنت في وضع البحث\n\nهذا الوضع مخصص للأسئلة والبحث.\n\nللدردشة العامة، انتقل إلى وضع المحادثة.`
              : `⚠️ You're in Search Mode\n\nThis mode is for questions and search.\n\nFor general chat, switch to Chat mode.`;
          }
          break;

        case 'image':
          if (intent.allowed) {
            try {
              console.log("🎨 Generating image with Runware API for prompt:", message);
              const imageResult = await generateImageWithRunware(message, user.id, language);
              
              if (imageResult.success) {
                imageUrl = imageResult.imageUrl;
                response = language === 'ar' 
                  ? `🎨 تم إنشاء الصورة بنجاح!\n\n**الوصف:** ${message}`
                  : `🎨 Image generated successfully!\n\n**Prompt:** ${message}`;
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
          // Chat mode - use real AI
          response = await processWithAI(message, null, language, contextMessages);
          break;
      }
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
      requiresSearchConfirmation: false,
      needsConfirmation,
      pendingTaskData,
      pendingReminderData,
      needsClarification: false,
      success: true
    };

    console.log("🔍 UNIFIED AI BRAIN: Sending enhanced response with task intelligence for user:", user.id);

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

// Enhanced task analysis function
function analyzeTaskIntent(message: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  // Task keywords
  const taskKeywords = [
    'task', 'todo', 'do', 'complete', 'finish', 'work on', 'need to', 'have to', 'must',
    'مهمة', 'عمل', 'أنجز', 'أكمل', 'يجب', 'لازم', 'محتاج'
  ];
  
  // Reminder keywords  
  const reminderKeywords = [
    'remind', 'reminder', 'don\'t forget', 'remember', 'alert', 'notify',
    'ذكرني', 'تذكير', 'لا تنس', 'تذكر', 'نبهني'
  ];
  
  const isTaskKeyword = taskKeywords.some(keyword => lowerMessage.includes(keyword));
  const isReminderKeyword = reminderKeywords.some(keyword => lowerMessage.includes(keyword));
  
  let isTask = false;
  let isReminder = false;
  
  // Determine if it's a task or reminder
  if (isTaskKeyword && !isReminderKeyword) {
    isTask = true;
  } else if (isReminderKeyword && !isTaskKeyword) {
    isReminder = true;
  } else if (isTaskKeyword && isReminderKeyword) {
    // If both, default to task
    isTask = true;
  } else {
    // Check for action verbs that indicate tasks
    const actionVerbs = ['buy', 'get', 'call', 'email', 'meeting', 'appointment', 'shopping', 'اشتري', 'خذ', 'اتصل', 'ايميل', 'اجتماع', 'موعد', 'تسوق'];
    isTask = actionVerbs.some(verb => lowerMessage.includes(verb));
  }
  
  if (!isTask && !isReminder) {
    return { isTask: false, isReminder: false };
  }
  
  // Extract title (first meaningful part)
  let title = message.trim();
  if (title.length > 100) {
    title = title.substring(0, 100) + '...';
  }
  
  // Extract due date and time
  const dateTimeRegex = /(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}:\d{2}|غداً|اليوم|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|الأحد)/gi;
  const dateTimeMatches = message.match(dateTimeRegex);
  
  let due_date = null;
  let due_time = null;
  
  if (dateTimeMatches) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    for (const match of dateTimeMatches) {
      const lower = match.toLowerCase();
      
      // Handle time patterns
      if (lower.match(/\d{1,2}:\d{2}/)) {
        due_time = match;
      }
      // Handle date patterns
      else if (lower === 'today' || lower === 'اليوم') {
        due_date = today.toISOString().split('T')[0];
      } else if (lower === 'tomorrow' || lower === 'غداً') {
        due_date = tomorrow.toISOString().split('T')[0];
      }
    }
  }
  
  // If no date specified, default to tomorrow
  if (!due_date) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    due_date = tomorrow.toISOString().split('T')[0];
  }
  
  // Extract subtasks (items in lists or comma-separated)
  const subtasks = [];
  const listItems = message.match(/[-•*]\s*([^-•*\n]+)/g);
  if (listItems) {
    listItems.forEach(item => {
      const cleaned = item.replace(/[-•*]\s*/, '').trim();
      if (cleaned) subtasks.push(cleaned);
    });
  } else {
    // Try comma-separated items
    const commaItems = message.split(/[,،]/);
    if (commaItems.length > 2) {
      commaItems.slice(1).forEach(item => {
        const cleaned = item.trim();
        if (cleaned && cleaned.length < 50) {
          subtasks.push(cleaned);
        }
      });
    }
  }
  
  // Determine priority
  let priority = 'normal';
  const urgentWords = ['urgent', 'asap', 'important', 'priority', 'عاجل', 'مهم', 'أولوية'];
  if (urgentWords.some(word => lowerMessage.includes(word))) {
    priority = 'high';
  }
  
  const taskData = {
    title,
    description: '',
    due_date,
    due_time,
    subtasks,
    priority
  };
  
  const reminderData = {
    title,
    description: '',
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
async function processWithAI(message: string, context: string | null, language: string = 'en', contextMessages: any[] = []) {
  try {
    console.log("🤖 UNIFIED AI BRAIN: Processing with real AI and vision capabilities");
    
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

تعليمات مهمة للتنسيق:
- استخدم نصاً عادياً واضحاً
- تجنب الرموز الزائدة مثل # أو ** أو ***
- استخدم فقرات بسيطة مع فواصل أسطر طبيعية
- اجعل الإجابة سهلة القراءة وبدون تعقيد في التنسيق`
      : `You are WAKTI, an advanced AI assistant. You specialize in helping with daily tasks and providing accurate, helpful information. Be friendly, helpful, and concise in your responses.

Important formatting instructions:
- Use clean, plain text
- Avoid excessive symbols like #, **, or ***
- Use simple paragraphs with natural line breaks
- Keep responses readable and clean without formatting clutter`;
    
    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add context messages for conversation history
    if (contextMessages && contextMessages.length > 0) {
      const recentMessages = contextMessages.slice(-10);
      recentMessages.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }
    
    if (context) {
      messages.push({ role: 'assistant', content: `Context: ${context}` });
    }
    
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
    console.error("🤖 UNIFIED AI BRAIN: AI processing error:", error);
    
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
  }
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function analyzeTriggerIntent(message: string, activeTrigger: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  console.log("🔍 UNIFIED AI BRAIN: Analyzing trigger intent for:", activeTrigger);
  
  switch (activeTrigger) {
    case 'search':
      const searchPatterns = [
        'what', 'who', 'when', 'where', 'how', 'current', 'latest', 'recent', 'today', 'news',
        'weather', 'score', 'price', 'stock', 'update', 'information', 'find', 'search',
        'ما', 'من', 'متى', 'أين', 'كيف', 'حالي', 'آخر', 'مؤخراً', 'اليوم', 'أخبار',
        'طقس', 'نتيجة', 'سعر', 'معلومات', 'ابحث', 'بحث'
      ];
      
      const isSearchIntent = searchPatterns.some(pattern => lowerMessage.includes(pattern)) || lowerMessage.includes('?');
      
      return {
        intent: isSearchIntent ? 'search' : 'general_query',
        confidence: 'high',
        allowed: true
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

    case 'chat':
    default:
      return {
        intent: 'general_chat',
        confidence: 'high',
        allowed: true
      };
  }
}
