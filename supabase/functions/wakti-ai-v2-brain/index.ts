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

console.log("🔍 WAKTI AI V2.3 TEACHER CONCEPT: Processing request with absolute trigger control");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// SIMPLIFIED TRIGGER-BASED INTENT ANALYSIS - TEACHER CONCEPT
function analyzeIntentWithTriggerControl(message, language = 'en', activeTrigger = 'chat') {
  const lowerMessage = message.toLowerCase();
  
  console.log("🎯 WAKTI AI V2.3: === TEACHER CONCEPT TRIGGER ANALYSIS ===");
  console.log("🎯 WAKTI AI V2.3: Message:", message);
  console.log("🎯 WAKTI AI V2.3: Active trigger (teacher's hand):", activeTrigger);
  console.log("🎯 WAKTI AI V2.3: Language:", language);
  
  // 🚨 TEACHER CONCEPT: Trigger is the ABSOLUTE controller
  // If no "hands up" (search triggers), then NO browsing - period!
  
  switch (activeTrigger) {
    case 'chat':
      console.log("🎯 WAKTI AI V2.3: ✅ CHAT MODE - NO HANDS UP = NO BROWSING");
      
      // Check for image generation patterns only
      const imagePatterns = [
        'generate image', 'create image', 'draw', 'make picture', 'image of', 'picture of',
        'أنشئ صورة', 'اصنع صورة', 'ارسم', 'صورة', 'اعمل صورة', 'كون صورة'
      ];
      
      if (imagePatterns.some(p => lowerMessage.includes(p))) {
        const prompt = message.replace(/(generate image|create image|draw|make picture|image of|picture of|أنشئ صورة|اصنع صورة|ارسم|صورة)/gi, '').trim();
        return {
          intent: 'generate_image',
          confidence: 'high',
          action: 'generate_image',
          params: { prompt: prompt || message },
          requiresBrowsing: false, // NEVER browse in chat mode
          triggerMode: 'chat'
        };
      }
      
      // Default chat response - NO BROWSING
      return {
        intent: 'general_chat',
        confidence: 'high',
        action: null,
        params: null,
        requiresBrowsing: false, // FORCED OFF - teacher's hand is down
        triggerMode: 'chat'
      };
      
    case 'search':
      console.log("🎯 WAKTI AI V2.3: ✅ SEARCH MODE - HAND IS UP = ENABLE BROWSING");
      return {
        intent: 'real_time_search',
        confidence: 'high',
        action: null,
        params: null,
        requiresBrowsing: true, // FORCED ON - teacher's hand is up
        triggerMode: 'search'
      };
      
    case 'advanced_search':
      console.log("🎯 WAKTI AI V2.3: ✅ ADVANCED SEARCH MODE - HAND IS UP = ENABLE ADVANCED BROWSING");
      return {
        intent: 'advanced_real_time_search',
        confidence: 'high',
        action: null,
        params: null,
        requiresBrowsing: true, // FORCED ON - teacher's hand is up
        triggerMode: 'advanced_search'
      };
      
    case 'image':
      console.log("🎯 WAKTI AI V2.3: ✅ IMAGE MODE - GENERATE IMAGES");
      const prompt = message.replace(/(generate image|create image|draw|make picture|image of|picture of|أنشئ صورة|اصنع صورة|ارسم|صورة)/gi, '').trim();
      return {
        intent: 'generate_image',
        confidence: 'high',
        action: 'generate_image',
        params: { prompt: prompt || message },
        requiresBrowsing: false, // No browsing for image generation
        triggerMode: 'image'
      };
      
    default:
      console.log("🎯 WAKTI AI V2.3: ⚠️ UNKNOWN TRIGGER - DEFAULTING TO CHAT (NO BROWSING)");
      return {
        intent: 'general_chat',
        confidence: 'medium',
        action: null,
        params: null,
        requiresBrowsing: false, // Default safe mode - no browsing
        triggerMode: 'chat'
      };
  }
}

// Image generation function
async function generateImage(prompt, language = 'en') {
  try {
    console.log("🎨 WAKTI AI V2.3: Generating image with prompt:", prompt);
    
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
    console.log("🎨 WAKTI AI V2.3: Image generation result:", result);
    
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
    console.error("🎨 WAKTI AI V2.3: Image generation error:", error);
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
    console.log("🌐 WAKTI AI V2.3: Executing browsing for:", query, "in mode:", searchMode);
    
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
    
    console.log("🌐 WAKTI AI V2.3: Using Tavily config:", tavilyConfig);
    
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
    console.log("🌐 WAKTI AI V2.3: Browsing results:", data);
    
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
    console.error("🌐 WAKTI AI V2.3: Browsing error:", error);
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
    console.log("🤖 WAKTI AI V2.3: Processing with AI");
    
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
    console.error("🤖 WAKTI AI V2.3: AI processing error:", error);
    
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
    console.log("🎯 WAKTI AI V2.3: === TEACHER CONCEPT REQUEST START ===");
    console.log("🎯 WAKTI AI V2.3: Request method:", req.method);

    // Enhanced JSON parsing with detailed debugging
    let requestBody;
    try {
      const rawBody = await req.text();
      console.log("🎯 WAKTI AI V2.3: Raw request body received");
      
      if (!rawBody || rawBody.trim() === '') {
        throw new Error("Empty request body received");
      }
      
      requestBody = JSON.parse(rawBody);
      console.log("🎯 WAKTI AI V2.3: ✅ Successfully parsed request body");
    } catch (parseError) {
      console.error("🎯 WAKTI AI V2.3: ❌ JSON parsing error:", parseError);
      
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

    console.log("🎯 WAKTI AI V2.3: === EXTRACTED FIELDS ===");
    console.log("🎯 WAKTI AI V2.3: Message:", message);
    console.log("🎯 WAKTI AI V2.3: User ID:", userId);
    console.log("🎯 WAKTI AI V2.3: Language:", language);
    console.log("🎯 WAKTI AI V2.3: Active Trigger (Teacher's Hand):", activeTrigger);
    console.log("🎯 WAKTI AI V2.3: Input Type:", inputType);
    console.log("🎯 WAKTI AI V2.3: Confirm Search:", confirmSearch);

    // Validate required fields
    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.error("🎯 WAKTI AI V2.3: ❌ Invalid message field");
      return new Response(JSON.stringify({ 
        error: "Message is required and must be a non-empty string",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!userId) {
      console.error("🎯 WAKTI AI V2.3: ❌ Missing userId");
      return new Response(JSON.stringify({ 
        error: "User ID is required",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // TEACHER CONCEPT: Analyze intent with ABSOLUTE trigger control
    console.log("🎯 WAKTI AI V2.3: === STARTING TEACHER CONCEPT ANALYSIS ===");
    const intentAnalysis = analyzeIntentWithTriggerControl(message, language, activeTrigger);
    console.log("🎯 WAKTI AI V2.3: === TEACHER CONCEPT RESULT ===");
    console.log("🎯 WAKTI AI V2.3: Intent:", intentAnalysis.intent);
    console.log("🎯 WAKTI AI V2.3: Requires Browsing:", intentAnalysis.requiresBrowsing);
    console.log("🎯 WAKTI AI V2.3: Trigger Mode:", intentAnalysis.triggerMode);

    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let actionTaken = null;
    let actionResult = null;

    // Get quota status
    quotaStatus = await checkBrowsingQuota(userId);

    // TEACHER CONCEPT: Process based on ABSOLUTE trigger control
    console.log("🎯 WAKTI AI V2.3: === PROCESSING WITH TEACHER CONCEPT ===");
    
    if (intentAnalysis.intent === 'generate_image') {
      console.log("🎨 WAKTI AI V2.3: Handling image generation");
      
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
      
    } else if (intentAnalysis.requiresBrowsing) {
      console.log("🌐 WAKTI AI V2.3: Teacher's hand is UP - enabling browsing");
      
      if (quotaStatus.canBrowse && (confirmSearch || !quotaStatus.requiresConfirmation)) {
        // Determine search mode based on trigger
        const searchMode = activeTrigger === 'advanced_search' ? 'advanced' : 'basic';
        
        const browsingResult = await executeBrowsing(message, searchMode, language);
        
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
          ? `لقد استخدمت ${quotaStatus.count} من ${quotaStatus.limit} عملية بحث شهرية (${quotaStatus.usagePercentage}%). هل تريد المتابعة بالبحث؟`
          : `You've used ${quotaStatus.count} of ${quotaStatus.limit} monthly searches (${quotaStatus.usagePercentage}%). Do you want to proceed with search?`;
      } else {
        response = language === 'ar' 
          ? `لقد وصلت إلى حد البحث الشهري (${quotaStatus.limit}). يمكنني الإجابة على أسئلة عامة.`
          : `You've reached your monthly search limit (${quotaStatus.limit}). I can answer general questions.`;
      }
      
    } else {
      console.log("💬 WAKTI AI V2.3: Teacher's hand is DOWN - NO browsing, general chat only");
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
        console.log("🎯 WAKTI AI V2.3: Conversation creation failed, continuing without storage");
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
        console.error("🎯 WAKTI AI V2.3: Database storage error:", dbError);
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

    console.log("🎯 WAKTI AI V2.3: === TEACHER CONCEPT SUCCESS ===");
    console.log("🎯 WAKTI AI V2.3: Browsing Used:", browsingUsed);
    console.log("🎯 WAKTI AI V2.3: Intent:", intentAnalysis.intent);
    console.log("🎯 WAKTI AI V2.3: Teacher's Hand (Trigger):", activeTrigger);
    console.log("🎯 WAKTI AI V2.3: === REQUEST END ===");

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🎯 WAKTI AI V2.3: ❌ Request processing error:", error);
    
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
