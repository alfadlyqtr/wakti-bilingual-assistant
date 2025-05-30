import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Restore all API keys
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

console.log("🔍 WAKTI AI V2.2 FIXED: Processing request with proper trigger isolation");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Enhanced intent analysis with STRICT TRIGGER MODE RESPECT
function analyzeIntentEnhanced(message, language = 'en', activeTrigger = 'chat') {
  const lowerMessage = message.toLowerCase();
  
  console.log("🔍 WAKTI AI V2.2: === TRIGGER ANALYSIS START ===");
  console.log("🔍 WAKTI AI V2.2: Message:", message);
  console.log("🔍 WAKTI AI V2.2: Active trigger received:", activeTrigger);
  console.log("🔍 WAKTI AI V2.2: Language:", language);
  
  // 🚨 CRITICAL FIX: STRICT TRIGGER MODE ENFORCEMENT
  // If activeTrigger is 'chat', IMMEDIATELY return no browsing
  if (activeTrigger === 'chat') {
    console.log("🔍 WAKTI AI V2.2: ✅ CHAT MODE DETECTED - NO BROWSING ALLOWED");
    return {
      intent: 'general_chat',
      confidence: 'high',
      action: null,
      params: null,
      requiresBrowsing: false, // FORCED OFF for chat mode
      triggerMode: 'chat'
    };
  }
  
  // For non-chat modes, continue with original logic
  console.log("🔍 WAKTI AI V2.2: Non-chat mode detected, analyzing patterns...");
  
  // 1. IMAGE GENERATION - HIGHEST PRIORITY
  const imagePatterns = [
    'generate image', 'create image', 'draw', 'make picture', 'image of', 'picture of',
    'أنشئ صورة', 'اصنع صورة', 'ارسم', 'صورة', 'اعمل صورة', 'كون صورة'
  ];
  
  // Enhanced follow-up detection for image generation
  const imageFollowUpPatterns = [
    'yes, generate', 'yes generate', 'yes create', 'نعم اصنع', 'نعم ارسم', 'نعم',
    'generate it', 'create it', 'make it', 'اعملها', 'اصنعها', 'ارسمها'
  ];
  
  if (imagePatterns.some(p => lowerMessage.includes(p)) || 
      imageFollowUpPatterns.some(p => lowerMessage.includes(p))) {
    const prompt = message.replace(/(generate image|create image|draw|make picture|image of|picture of|أنشئ صورة|اصنع صورة|ارسم|صورة|yes,?\s*(generate|create)|نعم\s*(اصنع|ارسم)?)/gi, '').trim();
    
    console.log("🔍 WAKTI AI V2.2: Image generation intent detected");
    return {
      intent: 'generate_image',
      confidence: 'high',
      action: 'generate_image',
      params: { prompt: prompt || message },
      requiresBrowsing: false,
      triggerMode: activeTrigger
    };
  }
  
  // 2. TASK CREATION
  const taskPatterns = [
    'create task', 'add task', 'new task', 'make task', 'todo', 'need to do',
    'أنشئ مهمة', 'أضف مهمة', 'مهمة جديدة', 'اصنع مهمة', 'مطلوب عمل'
  ];
  
  if (taskPatterns.some(p => lowerMessage.includes(p))) {
    console.log("🔍 WAKTI AI V2.2: Task creation intent detected");
    return {
      intent: 'create_task',
      confidence: 'high',
      action: 'create_task',
      params: extractTaskData(message),
      requiresBrowsing: false,
      triggerMode: activeTrigger
    };
  }
  
  // 3. EVENT CREATION
  const eventPatterns = [
    'create event', 'add event', 'schedule', 'meeting', 'appointment',
    'أنشئ حدث', 'أضف حدث', 'موعد جديد', 'اجتماع', 'حفلة'
  ];
  
  if (eventPatterns.some(p => lowerMessage.includes(p))) {
    console.log("🔍 WAKTI AI V2.2: Event creation intent detected");
    return {
      intent: 'create_event',
      confidence: 'high',
      action: 'create_event',
      params: extractEventData(message),
      requiresBrowsing: false,
      triggerMode: activeTrigger
    };
  }
  
  // 4. REMINDER CREATION
  const reminderPatterns = [
    'remind me', 'reminder', 'don\'t forget', 'alert me',
    'ذكرني', 'تذكير', 'لا تنس', 'نبهني'
  ];
  
  if (reminderPatterns.some(p => lowerMessage.includes(p))) {
    console.log("🔍 WAKTI AI V2.2: Reminder creation intent detected");
    return {
      intent: 'create_reminder',
      confidence: 'high',
      action: 'create_reminder',
      params: extractReminderData(message),
      requiresBrowsing: false,
      triggerMode: activeTrigger
    };
  }
  
  // 5. BROWSING - Only for search/advanced_search modes
  if (activeTrigger === 'search' || activeTrigger === 'advanced_search') {
    console.log("🔍 WAKTI AI V2.2: Search mode detected, checking for browsing patterns...");
    
    const browsingPatterns = [
      // Sports & Entertainment
      'who won', 'game score', 'latest score', 'final score', 'match result', 'score',
      'sports news', 'game last night', 'game tonight', 'game today',
      'football', 'soccer', 'basketball', 'baseball', 'tennis', 'cricket', 'rugby', 'hockey', 'golf',
      'premier league', 'champions league', 'world cup', 'olympics', 'nfl', 'nba', 'fifa',
      'player stats', 'team standings', 'league table', 'tournament', 'championship',
      
      // News & Current Events
      'latest news', 'breaking news', 'current events', 'what happened', 'recent',
      'news today', 'headlines', 'update on', 'current situation', 'latest update',
      
      // Weather
      'weather today', 'current weather', 'forecast', 'temperature', 'rain', 'sunny',
      'climate', 'weather in', 'hot', 'cold', 'storm', 'hurricane',
      
      // Finance
      'stock price', 'market today', 'stock market', 'price of', 'crypto', 'bitcoin',
      'exchange rate', 'currency', 'trading', 'dow jones', 'nasdaq', 's&p 500',
      
      // Technology
      'new release', 'latest version', 'tech news', 'gadget', 'smartphone',
      
      // General temporal indicators
      'current', 'latest', 'recent', 'now', 'today', 'this week', 'happening',
      'status of', 'update', 'information about', 'tell me about',
      
      // Arabic patterns
      'من فاز', 'نتيجة المباراة', 'آخر الأخبار', 'الطقس اليوم', 'سعر السهم',
      'أخبار', 'جديد', 'حالي', 'اليوم', 'الآن', 'مؤخراً'
    ];
    
    // Team name detection
    const teamNames = [
      'madrid', 'barcelona', 'manchester', 'chelsea', 'arsenal', 'liverpool', 'united', 'city',
      'psg', 'bayern', 'juventus', 'milan', 'inter', 'panthers', 'lakers', 'warriors'
    ];
    
    const requiresBrowsing = browsingPatterns.some(p => lowerMessage.includes(p)) ||
                            teamNames.some(t => lowerMessage.includes(t)) ||
                            lowerMessage.includes('2025') ||
                            (lowerMessage.includes('what') && (lowerMessage.includes('current') || lowerMessage.includes('latest') || lowerMessage.includes('now'))) ||
                            (lowerMessage.includes('how') && (lowerMessage.includes('today') || lowerMessage.includes('recent')));
    
    console.log("🔍 WAKTI AI V2.2: Browsing patterns check result:", requiresBrowsing);
    
    if (requiresBrowsing) {
      console.log("🔍 WAKTI AI V2.2: ✅ Search mode - enabling browsing");
      return {
        intent: 'real_time_info',
        confidence: 'high',
        action: null,
        params: null,
        requiresBrowsing: true,
        triggerMode: activeTrigger
      };
    }
  }
  
  // Default: General chat (no browsing)
  console.log("🔍 WAKTI AI V2.2: ✅ Default - general chat, no browsing");
  console.log("🔍 WAKTI AI V2.2: === TRIGGER ANALYSIS END ===");
  return {
    intent: 'general_chat',
    confidence: 'medium',
    action: null,
    params: null,
    requiresBrowsing: false,
    triggerMode: activeTrigger
  };
}

// Image generation function
async function generateImage(prompt, language = 'en') {
  try {
    console.log("🎨 WAKTI AI V2.2: Generating image with prompt:", prompt);
    
    if (!RUNWARE_API_KEY) {
      throw new Error("Runware API key not configured");
    }
    
    // Enhance prompt for better results
    let enhancedPrompt = prompt;
    if (language === 'ar') {
      // Translate Arabic prompt to English for better image generation
      enhancedPrompt = await translateText(prompt, 'ar', 'en');
    }
    
    // Add style enhancements
    enhancedPrompt = `${enhancedPrompt}, high quality, detailed, professional photography style`;
    
    const response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNWARE_API_KEY}`
      },
      body: JSON.stringify([
        {
          taskType: "authentication",
          apiKey: RUNWARE_API_KEY
        },
        {
          taskType: "imageInference",
          taskUUID: crypto.randomUUID(),
          positivePrompt: enhancedPrompt,
          width: 1024,
          height: 1024,
          model: "runware:100@1",
          numberResults: 1,
          outputFormat: "WEBP",
          CFGScale: 1,
          scheduler: "FlowMatchEulerDiscreteScheduler"
        }
      ])
    });
    
    if (!response.ok) {
      throw new Error(`Image generation failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log("🎨 WAKTI AI V2.2: Image generation result:", result);
    
    if (result.data && result.data.length > 0) {
      const imageData = result.data.find(item => item.taskType === "imageInference");
      if (imageData && imageData.imageURL) {
        return {
          success: true,
          imageUrl: imageData.imageURL,
          prompt: enhancedPrompt
        };
      }
    }
    
    throw new Error("No image URL in response");
    
  } catch (error) {
    console.error("🎨 WAKTI AI V2.2: Image generation error:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Translation function
async function translateText(text, fromLang, toLang) {
  try {
    if (!OPENAI_API_KEY) {
      return text;
    }
    
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
            role: 'system',
            content: `Translate the following text from ${fromLang} to ${toLang}. Only return the translation, nothing else.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      return result.choices[0].message.content.trim();
    }
    
    return text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}

// Enhanced browsing function with search mode differentiation
async function executeBrowsing(query, searchMode = 'basic', language = 'en') {
  try {
    console.log("🌐 WAKTI AI V2.2: Executing browsing for:", query, "in mode:", searchMode);
    
    if (!TAVILY_API_KEY) {
      throw new Error("Tavily API key not configured");
    }
    
    // Configure Tavily parameters based on search mode
    let tavilyConfig;
    
    if (searchMode === 'advanced') {
      // Advanced Search Configuration
      tavilyConfig = {
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: "advanced",
        include_answer: true,
        include_images: true,
        include_raw_content: false,
        max_results: 10,
        chunks_per_source: 5,
        time_range: "year"
      };
    } else {
      // Basic Search Configuration
      tavilyConfig = {
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: "basic",
        include_answer: true,
        include_images: true,
        include_raw_content: false,
        max_results: 5,
        chunks_per_source: 3,
        time_range: "month"
      };
    }
    
    console.log("🌐 WAKTI AI V2.2: Using Tavily config:", tavilyConfig);
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tavilyConfig)
    });
    
    if (!response.ok) {
      throw new Error(`Tavily search failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("🌐 WAKTI AI V2.2: Browsing results:", data);
    
    // Create rich context for AI processing
    let richContext = `Search Query: "${query}" (${searchMode} mode)\n\n`;
    
    // Add main answer
    if (data.answer) {
      richContext += `Main Answer: ${data.answer}\n\n`;
    }
    
    // Add detailed source information
    if (data.results && data.results.length > 0) {
      richContext += "Additional Sources & Details:\n";
      data.results.forEach((result, index) => {
        richContext += `${index + 1}. ${result.title}\n`;
        richContext += `   URL: ${result.url}\n`;
        if (result.content) {
          richContext += `   Content: ${result.content}\n`;
        }
        richContext += "\n";
      });
    }
    
    // Add image context if available
    if (data.images && data.images.length > 0) {
      richContext += `Images Available: ${data.images.length} related images found\n\n`;
    }
    
    return {
      success: true,
      answer: data.answer,
      sources: data.results?.slice(0, searchMode === 'advanced' ? 10 : 5) || [],
      images: data.images || [],
      query: query,
      searchMode: searchMode,
      richContext: richContext
    };
    
  } catch (error) {
    console.error("🌐 WAKTI AI V2.2: Browsing error:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Detect query type for specialized formatting
function detectQueryType(query) {
  const lowerQuery = query.toLowerCase();
  
  // Sports patterns
  const sportsPatterns = ['game', 'score', 'match', 'team', 'player', 'league', 'championship', 'final', 'tournament', 'win', 'won', 'beat', 'defeat', 'goal', 'points'];
  
  // News patterns
  const newsPatterns = ['news', 'breaking', 'latest', 'update', 'report', 'announcement', 'today', 'happened', 'event'];
  
  // Tech patterns
  const techPatterns = ['tech', 'technology', 'software', 'app', 'device', 'smartphone', 'computer', 'ai', 'artificial intelligence', 'specs', 'features'];
  
  // Entertainment patterns
  const entertainmentPatterns = ['movie', 'film', 'tv show', 'series', 'actor', 'actress', 'director', 'review', 'rating', 'music', 'album', 'song'];
  
  // Weather patterns
  const weatherPatterns = ['weather', 'temperature', 'rain', 'sunny', 'cloudy', 'forecast', 'storm', 'climate'];
  
  // Finance patterns
  const financePatterns = ['stock', 'market', 'price', 'crypto', 'bitcoin', 'currency', 'trading', 'exchange rate'];
  
  if (sportsPatterns.some(pattern => lowerQuery.includes(pattern))) return 'sports';
  if (newsPatterns.some(pattern => lowerQuery.includes(pattern))) return 'news';
  if (techPatterns.some(pattern => lowerQuery.includes(pattern))) return 'tech';
  if (entertainmentPatterns.some(pattern => lowerQuery.includes(pattern))) return 'entertainment';
  if (weatherPatterns.some(pattern => lowerQuery.includes(pattern))) return 'weather';
  if (financePatterns.some(pattern => lowerQuery.includes(pattern))) return 'finance';
  
  return 'general';
}

// Enhanced AI processing function with conversational tone
async function processWithAI(message, context, language = 'en') {
  try {
    console.log("🤖 WAKTI AI V2.2: Processing with AI");
    
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

    // Detect query type for specialized formatting
    const queryType = detectQueryType(message);
    
    // Enhanced conversational system prompt
    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي ودود جداً يتحدث العربية بطلاقة. تتحدث مثل صديق مقرب ومطلع يحب مشاركة المعلومات بطريقة ممتعة ومفصلة.

🎯 أسلوبك في الحديث:
- كن ودوداً ومحادثاً مثل صديق مقرب
- استخدم تعبيرات عامية وطبيعية
- اظهر الحماس والشغف عند مشاركة المعلومات
- قدم تفاصيل غنية ومعلومات إضافية مثيرة
- اربط المعلومات بالسياق والخلفية

📝 تنسيق الإجابات:
${queryType === 'sports' ? '- الرياضة: اذكر النتائج، النقاط المهمة، اللحظات الحاسمة، إحصائيات اللاعبين' : ''}
${queryType === 'news' ? '- الأخبار: قدم الخط الزمني، الحقائق المهمة، التأثيرات والخلفية' : ''}
${queryType === 'tech' ? '- التكنولوجيا: اذكر المواصفات، المقارنات، الميزات الجديدة' : ''}
${queryType === 'entertainment' ? '- الترفيه: قدم المراجعات، التقييمات، معلومات عن الطاقم' : ''}
${queryType === 'weather' ? '- الطقس: اذكر التوقعات، النصائح، المقارنات' : ''}
${queryType === 'finance' ? '- المالية: قدم الأرقام، الاتجاهات، التحليل' : ''}
- عام: قدم شرحاً شاملاً مع السياق والخلفية

كن صديقاً حقيقياً يحب مشاركة المعلومات الرائعة!`
      : `You are WAKTI, a super friendly and knowledgeable AI assistant. You chat like a close buddy who's genuinely excited to share cool information and help out!

🎯 Your conversation style:
- Be warm, friendly, and conversational like a close friend
- Use casual expressions and natural language
- Show enthusiasm and passion when sharing information
- Provide rich details and interesting additional context
- Connect information to broader context and background

📝 Response formatting based on query type:
${queryType === 'sports' ? '- Sports: Include scores, highlights, key moments, player stats, game analysis' : ''}
${queryType === 'news' ? '- News: Provide timeline, key facts, implications, background context' : ''}
${queryType === 'tech' ? '- Tech: Mention specs, comparisons, new features, user impact' : ''}
${queryType === 'entertainment' ? '- Entertainment: Include reviews, ratings, cast/crew info, behind-the-scenes' : ''}
${queryType === 'weather' ? '- Weather: Give forecasts, tips, comparisons, what to expect' : ''}
${queryType === 'finance' ? '- Finance: Provide numbers, trends, analysis, market context' : ''}
- General: Give comprehensive explanations with context and background

Be like that friend who always has the coolest facts and loves sharing them in an engaging way!`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];
    
    if (context) {
      messages.splice(1, 0, { role: 'assistant', content: `Here's what I found: ${context}` });
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
        temperature: 0.8, // Increased for more conversational tone
        max_tokens: 1200 // Increased for richer responses
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error("🤖 WAKTI AI V2.2: AI processing error:", error);
    
    // Fallback response
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
  }
}

// Task extraction helper
function extractTaskData(message) {
  const title = message.replace(/create task|add task|new task|make task|todo|أنشئ مهمة|أضف مهمة/gi, '').trim();
  return {
    title: title || 'New Task',
    description: '',
    priority: 'medium'
  };
}

// Event extraction helper
function extractEventData(message) {
  const title = message.replace(/create event|add event|schedule|meeting|appointment|أنشئ حدث|أضف حدث/gi, '').trim();
  return {
    title: title || 'New Event',
    description: '',
    startTime: null,
    endTime: null
  };
}

// Reminder extraction helper
function extractReminderData(message) {
  const title = message.replace(/remind me|reminder|don\'t forget|alert me|ذكرني|تذكير|لا تنس/gi, '').trim();
  return {
    title: title || 'New Reminder',
    dueDate: null
  };
}

// Check browsing quota
async function checkBrowsingQuota(userId) {
  try {
    const { data, error } = await supabase.rpc('check_browsing_quota', {
      p_user_id: userId
    });
    
    if (error) {
      console.error("Quota check error:", error);
      return { count: 0, limit: 60, canBrowse: true };
    }
    
    const count = data || 0;
    const limit = 60; // Monthly limit
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
    return { count: 0, limit: 60, canBrowse: true };
  }
}

// Log AI usage
async function logAIUsage(userId, modelUsed, hasBrowsing = false) {
  try {
    await supabase.rpc('log_ai_usage', {
      p_user_id: userId,
      p_model_used: modelUsed,
      p_has_browsing: hasBrowsing
    });
  } catch (error) {
    console.error("Usage logging error:", error);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔍 WAKTI AI V2.2: === REQUEST START ===");
    console.log("🔍 WAKTI AI V2.2: Request method:", req.method);

    // Enhanced JSON parsing with detailed debugging
    let requestBody;
    try {
      const rawBody = await req.text();
      console.log("🔍 WAKTI AI V2.2: Raw request body received");
      
      if (!rawBody || rawBody.trim() === '') {
        throw new Error("Empty request body received");
      }
      
      requestBody = JSON.parse(rawBody);
      console.log("🔍 WAKTI AI V2.2: ✅ Successfully parsed request body");
    } catch (parseError) {
      console.error("🔍 WAKTI AI V2.2: ❌ JSON parsing error:", parseError);
      
      return new Response(JSON.stringify({ 
        error: "Invalid JSON in request body",
        details: parseError.message,
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Extract fields with defaults - INCLUDING activeTrigger
    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      conversationHistory = [],
      confirmSearch = false,
      activeTrigger = 'chat'
    } = requestBody;

    console.log("🔍 WAKTI AI V2.2: === EXTRACTED FIELDS ===");
    console.log("🔍 WAKTI AI V2.2: Message:", message);
    console.log("🔍 WAKTI AI V2.2: User ID:", userId);
    console.log("🔍 WAKTI AI V2.2: Language:", language);
    console.log("🔍 WAKTI AI V2.2: Active Trigger:", activeTrigger);
    console.log("🔍 WAKTI AI V2.2: Input Type:", inputType);
    console.log("🔍 WAKTI AI V2.2: Confirm Search:", confirmSearch);

    // Validate required fields
    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.error("🔍 WAKTI AI V2.2: ❌ Invalid message field");
      return new Response(JSON.stringify({ 
        error: "Message is required and must be a non-empty string",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!userId) {
      console.error("🔍 WAKTI AI V2.2: ❌ Missing userId");
      return new Response(JSON.stringify({ 
        error: "User ID is required",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Analyze intent with enhanced priority system and STRICT TRIGGER RESPECT
    console.log("🔍 WAKTI AI V2.2: === STARTING INTENT ANALYSIS ===");
    const intentAnalysis = analyzeIntentEnhanced(message, language, activeTrigger);
    console.log("🔍 WAKTI AI V2.2: === INTENT ANALYSIS RESULT ===");
    console.log("🔍 WAKTI AI V2.2: Intent:", intentAnalysis.intent);
    console.log("🔍 WAKTI AI V2.2: Requires Browsing:", intentAnalysis.requiresBrowsing);
    console.log("🔍 WAKTI AI V2.2: Trigger Mode:", intentAnalysis.triggerMode);

    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let actionTaken = null;
    let actionResult = null;

    // Get quota status
    quotaStatus = await checkBrowsingQuota(userId);

    // Handle different intents based on activeTrigger
    console.log("🔍 WAKTI AI V2.2: === PROCESSING BASED ON TRIGGER ===");
    
    if (activeTrigger === 'advanced_search') {
      console.log("🔮 WAKTI AI V2.2: Handling advanced search mode");
      
      if (quotaStatus.canBrowse && (confirmSearch || !quotaStatus.requiresConfirmation)) {
        // Use advanced search functionality
        const browsingResult = await executeBrowsing(message, 'advanced', language);
        
        if (browsingResult.success) {
          browsingUsed = true;
          browsingData = {
            hasResults: true,
            sources: browsingResult.sources,
            images: browsingResult.images,
            query: browsingResult.query,
            searchMode: browsingResult.searchMode
          };
          
          // Use rich context for better AI processing
          response = await processWithAI(message, browsingResult.richContext, language);
          
          // Log browsing usage
          await logAIUsage(userId, 'deepseek-chat', true);
        } else {
          response = await processWithAI(message, null, language);
        }
      } else if (quotaStatus.requiresConfirmation && !confirmSearch) {
        response = language === 'ar' 
          ? `لقد استخدمت ${quotaStatus.count} من ${quotaStatus.limit} عملية بحث شهرية (${quotaStatus.usagePercentage}%). هل تريد المتابعة بالبحث المتقدم؟`
          : `You've used ${quotaStatus.count} of ${quotaStatus.limit} monthly searches (${quotaStatus.usagePercentage}%). Do you want to proceed with advanced search?`;
      } else {
        response = language === 'ar' 
          ? `لقد وصلت إلى حد البحث الشهري (${quotaStatus.limit}). يمكنني الإجابة على أسئلة عامة.`
          : `You've reached your monthly search limit (${quotaStatus.limit}). I can answer general questions.`;
      }
      
    } else if (intentAnalysis.intent === 'generate_image') {
      console.log("🎨 WAKTI AI V2.2: Handling image generation");
      
      const imageResult = await generateImage(intentAnalysis.params.prompt, language);
      
      if (imageResult.success) {
        imageUrl = imageResult.imageUrl;
        response = language === 'ar' 
          ? `تم إنشاء الصورة بنجاح! 🎨\n\nالوصف: ${intentAnalysis.params.prompt}`
          : `Image generated successfully! 🎨\n\nPrompt: ${intentAnalysis.params.prompt}`;
        actionTaken = 'generate_image';
        actionResult = { imageUrl, prompt: intentAnalysis.params.prompt };
      } else {
        response = language === 'ar' 
          ? `عذراً، فشل في إنشاء الصورة: ${imageResult.error}`
          : `Sorry, failed to generate image: ${imageResult.error}`;
      }
      
    } else if (intentAnalysis.requiresBrowsing && activeTrigger === 'search') {
      console.log("🌐 WAKTI AI V2.2: Handling browsing request in search mode");
      
      if (quotaStatus.canBrowse && (confirmSearch || !quotaStatus.requiresConfirmation)) {
        // Use basic search for regular search mode
        const browsingResult = await executeBrowsing(message, 'basic', language);
        
        if (browsingResult.success) {
          browsingUsed = true;
          browsingData = {
            hasResults: true,
            sources: browsingResult.sources,
            images: browsingResult.images,
            query: browsingResult.query,
            searchMode: browsingResult.searchMode
          };
          
          // Use rich context for better AI processing
          response = await processWithAI(message, browsingResult.richContext, language);
          
          // Log browsing usage
          await logAIUsage(userId, 'deepseek-chat', true);
        } else {
          response = await processWithAI(message, null, language);
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
      
    } else if (intentAnalysis.action) {
      console.log("🔧 WAKTI AI V2.2: Handling action:", intentAnalysis.action);
      
      // For now, provide guidance for task/event/reminder creation
      switch (intentAnalysis.action) {
        case 'create_task':
          response = language === 'ar' 
            ? `سأساعدك في إنشاء مهمة جديدة. يمكنك إنشاء المهام من خلال صفحة المهام في التطبيق.`
            : `I'll help you create a new task. You can create tasks through the Tasks page in the app.`;
          actionTaken = 'create_task';
          actionResult = intentAnalysis.params;
          break;
          
        case 'create_event':
          response = language === 'ar' 
            ? `سأساعدك في إنشاء حدث جديد. يمكنك إنشاء الأحداث من خلال صفحة الأحداث في التطبيق.`
            : `I'll help you create a new event. You can create events through the Events page in the app.`;
          actionTaken = 'create_event';
          actionResult = intentAnalysis.params;
          break;
          
        case 'create_reminder':
          response = language === 'ar' 
            ? `سأساعدك في إنشاء تذكير جديد. يمكنك إنشاء التذكيرات من خلال صفحة التذكيرات في التطبيق.`
            : `I'll help you create a new reminder. You can create reminders through the Reminders page in the app.`;
          actionTaken = 'create_reminder';
          actionResult = intentAnalysis.params;
          break;
      }
      
    } else {
      console.log("💬 WAKTI AI V2.2: Handling general chat - NO BROWSING");
      response = await processWithAI(message, null, language);
    }

    // Handle conversation storage
    let finalConversationId = conversationId;
    if (!conversationId) {
      try {
        const { data: newConv, error: convError } = await supabase
          .from('ai_conversations')
          .insert({
            title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
            user_id: userId
          })
          .select()
          .single();
        
        if (!convError && newConv) {
          finalConversationId = newConv.id;
        }
      } catch (convErr) {
        console.log("🔍 WAKTI AI V2.2: Conversation creation failed, continuing without storage");
      }
    }

    // Store chat history
    if (finalConversationId) {
      try {
        // Store user message
        await supabase.from('ai_chat_history').insert({
          conversation_id: finalConversationId,
          user_id: userId,
          role: 'user',
          content: message,
          input_type: inputType
        });

        // Store AI response
        await supabase.from('ai_chat_history').insert({
          conversation_id: finalConversationId,
          user_id: userId,
          role: 'assistant',
          content: response,
          intent: intentAnalysis.intent,
          confidence_level: intentAnalysis.confidence,
          action_taken: actionTaken,
          action_result: actionResult,
          browsing_used: browsingUsed,
          browsing_data: browsingData,
          quota_status: quotaStatus
        });

        // Update conversation timestamp
        await supabase
          .from('ai_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', finalConversationId);
      } catch (dbError) {
        console.error("🔍 WAKTI AI V2.2: Database storage error:", dbError);
      }
    }

    // Log AI usage
    await logAIUsage(userId, 'deepseek-chat', browsingUsed);

    // Return successful response
    const responseData = {
      success: true,
      response: response,
      conversationId: finalConversationId,
      intent: intentAnalysis.intent,
      confidence: intentAnalysis.confidence,
      actionTaken: actionTaken,
      actionResult: actionResult,
      imageUrl: imageUrl,
      browsingUsed: browsingUsed,
      browsingData: browsingData,
      quotaStatus: quotaStatus,
      requiresSearchConfirmation: quotaStatus?.requiresConfirmation && !confirmSearch && intentAnalysis.requiresBrowsing
    };

    console.log("🔍 WAKTI AI V2.2: === SUCCESSFUL RESPONSE ===");
    console.log("🔍 WAKTI AI V2.2: Browsing Used:", browsingUsed);
    console.log("🔍 WAKTI AI V2.2: Intent:", intentAnalysis.intent);
    console.log("🔍 WAKTI AI V2.2: === REQUEST END ===");

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🔍 WAKTI AI V2.2: ❌ Request processing error:", error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || "Internal server error",
      response: "Sorry, I encountered an error processing your request. Please try again."
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
