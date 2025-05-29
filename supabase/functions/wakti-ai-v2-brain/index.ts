import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RUNWARE_API_KEY = "yzJMWPrRdkJcge2q0yjSOwTGvlhMeOy1";
const TAVILY_API_KEY = "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";

interface RequestBody {
  message: string;
  conversationId?: string;
  language: 'en' | 'ar';
  inputType: 'text' | 'voice';
}

interface AIResponse {
  response: string;
  conversationId: string;
  intent: string;
  confidence: 'high' | 'medium' | 'low';
  actionTaken?: string;
  actionResult?: any;
  needsConfirmation: boolean;
  needsClarification: boolean;
  isNewConversation?: boolean;
  hasBrowsing?: boolean;
  browsingData?: any;
}

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

interface TavilyResponse {
  results: TavilySearchResult[];
  query: string;
  response_time: number;
  answer?: string;
  images?: string[];
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('WAKTI AI V2.1 Enhanced: Processing request with advanced browsing and database integration');

    // Initialize Supabase client with auth headers
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://hxauxozopvpzpdygoqwf.supabase.co';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseServiceKey) {
      console.error('WAKTI AI V2.1 Enhanced: Missing Supabase service key');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('WAKTI AI V2.1 Enhanced: Authentication failed:', authError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('WAKTI AI V2.1 Enhanced: Authenticated user:', user.id);

    // Get enhanced user profile and knowledge for deeper personalization
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', user.id)
      .single();

    // Load comprehensive user knowledge for AI context
    const { data: userKnowledge } = await supabase
      .from('ai_user_knowledge')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const userName = profile?.display_name || profile?.username || 'there';

    const body: RequestBody = await req.json();
    const userMessage = body.message;
    let conversationId = body.conversationId;
    const language = body.language || 'en';
    const inputType = body.inputType || 'text';

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'Missing message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('WAKTI AI V2.1 Enhanced: Processing message from user:', user.id);

    // Manage conversation
    let isNewConversation = false;
    if (!conversationId) {
      // Create new conversation
      const { data: newConversation, error: convError } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: user.id,
          title: userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : ''),
          last_message_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (convError) {
        console.error('WAKTI AI V2.1 Enhanced: Error creating conversation:', convError);
        conversationId = `temp-${Date.now()}`;
      } else {
        conversationId = newConversation.id;
        isNewConversation = true;
      }
    } else {
      // Update existing conversation
      await supabase
        .from('ai_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId)
        .eq('user_id', user.id);
    }

    // Save user message to chat history
    await supabase
      .from('ai_chat_history')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: userMessage,
        language: language,
        input_type: inputType
      });

    // Load recent conversation history for context
    const { data: chatHistory } = await supabase
      .from('ai_chat_history')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const recentMessages = (chatHistory || []).reverse();

    // Enhanced intent analysis with aggressive real-time detection
    const intentAnalysis = analyzeIntentEnhanced(userMessage, language);
    console.log('WAKTI AI V2.1 Enhanced: Intent analysis:', intentAnalysis);

    // Check browsing quota and get real-time data if needed
    let browsingData = null;
    let hasBrowsing = false;
    
    if (intentAnalysis.requiresBrowsing && TAVILY_API_KEY) {
      const { data: quotaCheck } = await supabase.rpc('check_browsing_quota', { p_user_id: user.id });
      const currentUsage = quotaCheck || 0;
      
      console.log('WAKTI AI V2.1 Enhanced: Browsing quota check - current usage:', currentUsage);
      
      // More aggressive browsing - lower threshold to 50 instead of 65
      if (currentUsage < 50) {
        try {
          browsingData = await performEnhancedTavilySearch(userMessage, language);
          hasBrowsing = true;
          console.log('WAKTI AI V2.1 Enhanced: Tavily search successful, results:', browsingData?.results?.length || 0);
        } catch (error) {
          console.error('WAKTI AI V2.1 Enhanced: Tavily search failed:', error);
        }
      } else {
        console.log('WAKTI AI V2.1 Enhanced: Browsing quota exceeded, continuing without real-time data');
      }
    }

    // Check AI API keys
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!deepseekApiKey && !openaiApiKey) {
      console.error('WAKTI AI V2.1 Enhanced: No AI API keys found');
      return new Response(JSON.stringify({ 
        error: 'AI service not configured',
        response: language === 'ar' 
          ? 'عذراً، خدمة الذكاء الاصطناعي غير متاحة حالياً.'
          : 'Sorry, AI service is not available.',
        conversationId: conversationId,
        intent: 'error',
        confidence: 'low',
        needsConfirmation: false,
        needsClarification: false
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current date and time for accurate responses
    const now = new Date();
    const currentDateTime = language === 'ar' 
      ? `التاريخ والوقت الحالي: ${now.toLocaleDateString('ar-EG', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          timeZone: 'Asia/Qatar'
        })} - ${now.toLocaleTimeString('ar-EG', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Asia/Qatar'
        })} (توقيت قطر)`
      : `Current Date & Time: ${now.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          timeZone: 'Asia/Qatar'
        })} - ${now.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Asia/Qatar'
        })} (Qatar Time)`;

    // Enhanced system message with comprehensive user context and browsing data
    let systemMessage = language === 'ar' 
      ? `أنت WAKTI AI V2.1، المساعد الذكي المتطور لتطبيق وكتي. أنت تتحدث مع ${userName}.

${currentDateTime}

تذكر: استخدم دائماً التاريخ والوقت الحالي المذكور أعلاه عند الإجابة على أسئلة متعلقة بالتاريخ أو الوقت.`
      : `You are WAKTI AI V2.1, the advanced intelligent assistant for the Wakti app. You are talking to ${userName}.

${currentDateTime}

IMPORTANT: Always use the current date and time shown above when answering any date or time-related questions.`;

    // Add real-time browsing data context if available
    if (browsingData && browsingData.results && browsingData.results.length > 0) {
      const browsingContext = language === 'ar' 
        ? `\n\nمعلومات حديثة من الإنترنت:\n${formatBrowsingDataForPrompt(browsingData, language)}`
        : `\n\nReal-time information from the internet:\n${formatBrowsingDataForPrompt(browsingData, language)}`;
      
      systemMessage += browsingContext;
    }

    // Add user knowledge context if available
    if (userKnowledge) {
      const contextParts = [];
      
      if (userKnowledge.personal_note) {
        contextParts.push(language === 'ar' 
          ? `معلومات شخصية: ${userKnowledge.personal_note}`
          : `Personal info: ${userKnowledge.personal_note}`
        );
      }
      
      if (userKnowledge.main_use) {
        contextParts.push(language === 'ar' 
          ? `الهدف الأساسي: ${userKnowledge.main_use}`
          : `Main use: ${userKnowledge.main_use}`
        );
      }
      
      if (userKnowledge.role) {
        contextParts.push(language === 'ar' 
          ? `المجال المهني: ${userKnowledge.role}`
          : `Professional role: ${userKnowledge.role}`
        );
      }
      
      if (userKnowledge.interests && userKnowledge.interests.length > 0) {
        contextParts.push(language === 'ar' 
          ? `الاهتمامات: ${userKnowledge.interests.join(', ')}`
          : `Interests: ${userKnowledge.interests.join(', ')}` 
        );
      }

      // Add communication style preferences
      if (userKnowledge.communication_style) {
        const styleMapping = {
          'friendly_casual': language === 'ar' ? 'ودود وعفوي' : 'friendly and casual',
          'professional_formal': language === 'ar' ? 'مهني ورسمي' : 'professional and formal',
          'direct_concise': language === 'ar' ? 'مباشر ومختصر' : 'direct and concise',
          'encouraging_supportive': language === 'ar' ? 'مشجع وداعم' : 'encouraging and supportive'
        };
        
        contextParts.push(language === 'ar' 
          ? `أسلوب التواصل المفضل: ${styleMapping[userKnowledge.communication_style] || userKnowledge.communication_style}`
          : `Preferred communication style: ${styleMapping[userKnowledge.communication_style] || userKnowledge.communication_style}`
        );
      }

      // Add response length preferences
      if (userKnowledge.response_length) {
        const lengthMapping = {
          'brief': language === 'ar' ? 'موجز' : 'brief',
          'balanced': language === 'ar' ? 'متوازن' : 'balanced',
          'detailed': language === 'ar' ? 'مفصل' : 'detailed'
        };
        
        contextParts.push(language === 'ar' 
          ? `طول الاستجابة المفضل: ${lengthMapping[userKnowledge.response_length] || userKnowledge.response_length}`
          : `Preferred response length: ${lengthMapping[userKnowledge.response_length] || userKnowledge.response_length}`
        );
      }

      if (contextParts.length > 0) {
        systemMessage += language === 'ar' 
          ? `\n\nمعلومات المستخدم للسياق:\n${contextParts.join('\n')}`
          : `\n\nUser context information:\n${contextParts.join('\n')}`;
      }
    }

    // Add general capabilities
    systemMessage += language === 'ar' 
      ? `\n\nقدراتك المتقدمة:
- إنشاء المهام والمشاريع في قاعدة البيانات
- إنشاء الأحداث والمواعيد في قاعدة البيانات  
- إنشاء التذكيرات في قاعدة البيانات
- إنشاء الصور بالذكاء الاصطناعي
- الوصول إلى المعلومات الحديثة من الإنترنت عند الحاجة
- تنفيذ الأوامر تلقائياً وحفظها

عندما يطلب المستخدم إنشاء شيء، قم بتنفيذه فوراً إذا كنت متأكداً من الطلب.

تذكر أن تلتزم بأسلوب التواصل وطول الاستجابة المفضل للمستخدم في جميع إجاباتك.`
      : `\n\nYour advanced capabilities:
- Create tasks and projects in the database
- Create events and appointments in the database
- Create reminders in the database
- Generate AI images
- Access real-time information from the internet when needed
- Execute commands automatically and save them

When users ask you to create something, execute it immediately if you're confident about the request.

Remember to adapt your communication style and response length according to the user's preferences in all your responses.`;

    // Build conversation context
    const conversationMessages = [
      { role: 'system', content: systemMessage }
    ];

    // Add recent conversation history
    recentMessages.forEach(msg => {
      conversationMessages.push({ 
        role: msg.role as 'user' | 'assistant', 
        content: msg.content 
      });
    });

    // Add current user message
    conversationMessages.push({ role: 'user', content: userMessage });

    console.log('WAKTI AI V2.1 Enhanced: Calling AI API with enhanced context and browsing integration');

    let aiResponse = '';
    let modelUsed = '';
    
    // Try DeepSeek first (primary model), fallback to OpenAI only if DeepSeek fails
    if (deepseekApiKey) {
      try {
        console.log('WAKTI AI V2.1 Enhanced: Using DeepSeek API (primary model) with enhanced context');
        const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${deepseekApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: conversationMessages,
            model: 'deepseek-chat',
            temperature: 0.7,
            max_tokens: 1000,
          }),
        });

        if (deepseekResponse.ok) {
          const chatCompletion = await deepseekResponse.json();
          aiResponse = chatCompletion.choices[0].message?.content || 'No response from AI';
          modelUsed = 'deepseek';
          console.log('WAKTI AI V2.1 Enhanced: DeepSeek response successful');
        } else {
          throw new Error(`DeepSeek API failed: ${deepseekResponse.status}`);
        }
      } catch (error) {
        console.error('WAKTI AI V2.1 Enhanced: DeepSeek failed, falling back to OpenAI:', error);
        
        if (openaiApiKey) {
          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: conversationMessages,
              model: 'gpt-4o-mini',
              temperature: 0.7,
              max_tokens: 1000,
            }),
          });

          if (openaiResponse.ok) {
            const chatCompletion = await openaiResponse.json();
            aiResponse = chatCompletion.choices[0].message?.content || 'No response from AI';
            modelUsed = 'openai-fallback';
            console.log('WAKTI AI V2.1 Enhanced: OpenAI fallback successful');
          } else {
            throw new Error('Both DeepSeek and OpenAI failed');
          }
        } else {
          throw new Error('DeepSeek failed and no OpenAI key available');
        }
      }
    } else if (openaiApiKey) {
      console.log('WAKTI AI V2.1 Enhanced: Using OpenAI API (no DeepSeek key available)');
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationMessages,
          model: 'gpt-4o-mini',
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI API error:', openaiResponse.status, errorText);
        throw new Error(`OpenAI API failed: ${openaiResponse.status}`);
      }

      const chatCompletion = await openaiResponse.json();
      aiResponse = chatCompletion.choices[0].message?.content || 'No response from AI';
      modelUsed = 'openai';
    }

    if (!aiResponse) {
      const fallbackResponse = language === 'ar' 
        ? 'عذراً، حدث خطأ في خدمة الذكاء الاصطناعي.'
        : 'Sorry, there was an error with the AI service.';
      
      return new Response(JSON.stringify({
        response: fallbackResponse,
        conversationId: conversationId,
        intent: 'error',
        confidence: 'low',
        needsConfirmation: false,
        needsClarification: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('WAKTI AI V2.1 Enhanced: Generated AI response with enhanced context and browsing');

    // Execute actions if detected
    let actionResult = null;
    let actionTaken = null;

    if (intentAnalysis.confidence === 'high' && intentAnalysis.action) {
      try {
        console.log('WAKTI AI V2.1 Enhanced: Executing database action:', intentAnalysis.action);
        actionResult = await executeAction(intentAnalysis.action, intentAnalysis.params, language, openaiApiKey, supabase, user.id);
        actionTaken = intentAnalysis.action;
        
        // Update AI response to include action confirmation and translation if applicable
        if (actionResult.success) {
          let actionConfirmation = language === 'ar' 
            ? `\n\n✅ تم تنفيذ العملية بنجاح وحفظها في قاعدة البيانات!`
            : `\n\n✅ Action completed successfully and saved to database!`;
          
          // Add translation information for Arabic image prompts
          if (actionTaken === 'generate_image' && actionResult.translatedPrompt) {
            const translationNote = language === 'ar'
              ? `\n\n🌍 تم ترجمة النص إلى الإنجليزية: "${actionResult.translatedPrompt}"`
              : `\n\n🌍 Translated prompt: "${actionResult.translatedPrompt}"`;
            actionConfirmation += translationNote;
          }
          
          aiResponse += actionConfirmation;
        }
      } catch (error) {
        console.error('WAKTI AI V2.1 Enhanced: Action execution failed:', error);
        actionResult = { success: false, error: error.message };
      }
    }

    // Log AI usage for quota tracking
    try {
      await supabase.rpc('log_ai_usage', {
        p_user_id: user.id,
        p_model_used: modelUsed,
        p_has_browsing: hasBrowsing,
        p_tokens_used: estimateTokens(aiResponse)
      });
      console.log('WAKTI AI V2.1 Enhanced: Usage logged successfully');
    } catch (error) {
      console.error('WAKTI AI V2.1 Enhanced: Failed to log usage:', error);
      // Don't fail the request if logging fails
    }

    // Save assistant response to chat history
    await supabase
      .from('ai_chat_history')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: aiResponse,
        language: language,
        input_type: 'text',
        intent: intentAnalysis.intent,
        confidence_level: intentAnalysis.confidence,
        action_taken: actionTaken,
        action_result: actionResult
      });

    console.log('WAKTI AI V2.1 Enhanced: Response ready with enhanced browsing and context integration');

    return new Response(JSON.stringify({
      response: aiResponse,
      conversationId: conversationId,
      intent: intentAnalysis.intent,
      confidence: intentAnalysis.confidence,
      actionTaken: actionTaken,
      actionResult: actionResult,
      needsConfirmation: intentAnalysis.confidence === 'medium',
      needsClarification: intentAnalysis.confidence === 'low',
      isNewConversation: isNewConversation,
      hasBrowsing: hasBrowsing,
      browsingData: browsingData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('WAKTI AI V2.1 Enhanced: Error:', error);
    
    const errorResponse = {
      error: 'Internal server error',
      response: 'Sorry, there was an error processing your request.',
      conversationId: 'error',
      intent: 'error',
      confidence: 'low',
      needsConfirmation: false,
      needsClarification: false
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Enhanced intent analysis with aggressive real-time browsing detection
function analyzeIntentEnhanced(message: string, language: string) {
  const lowerMessage = message.toLowerCase();
  
  // Enhanced real-time browsing patterns - more aggressive detection
  const browsingPatterns = [
    // Sports & scores - enhanced
    'who won', 'game score', 'latest score', 'final score', 'match result', 'score',
    'sports news', 'game last night', 'game tonight', 'game today', 'football', 'soccer',
    'basketball', 'baseball', 'tennis', 'cricket', 'rugby', 'hockey', 'golf',
    'premier league', 'champions league', 'world cup', 'olympics', 'nfl', 'nba', 'fifa',
    'player stats', 'team standings', 'league table', 'tournament', 'championship',
    // News & current events - enhanced
    'latest news', 'breaking news', 'current events', 'what happened', 'recent',
    'news today', 'headlines', 'update on', 'current situation', 'latest update',
    // Weather - enhanced
    'weather today', 'current weather', 'forecast', 'temperature', 'rain', 'sunny',
    'climate', 'weather in', 'hot', 'cold', 'storm', 'hurricane',
    // Stocks & markets - enhanced
    'stock price', 'market today', 'stock market', 'price of', 'crypto', 'bitcoin',
    'exchange rate', 'currency', 'trading', 'dow jones', 'nasdaq', 's&p 500',
    // General current info - enhanced
    'current', 'latest', 'recent', 'now', 'today', 'this week', 'happening',
    'status of', 'update', 'information about', 'tell me about',
    // Technology & trends
    'new release', 'latest version', 'tech news', 'gadget', 'smartphone',
    // Arabic equivalents - enhanced
    'من فاز', 'نتيجة المباراة', 'آخر الأخبار', 'الطقس اليوم', 'سعر السهم',
    'أخبار', 'جديد', 'حالي', 'اليوم', 'الآن', 'مؤخراً'
  ];

  // Check for browsing requirement with lower threshold
  const requiresBrowsing = browsingPatterns.some(pattern => lowerMessage.includes(pattern)) ||
    // Also check if message contains question words + current context
    (lowerMessage.includes('what') && (lowerMessage.includes('current') || lowerMessage.includes('latest') || lowerMessage.includes('now'))) ||
    (lowerMessage.includes('how') && (lowerMessage.includes('today') || lowerMessage.includes('recent'))) ||
    // Check for any sports team names or events
    /\b(madrid|barcelona|manchester|chelsea|arsenal|liverpool|united|city|psg|bayern|juventus|milan|inter)\b/i.test(lowerMessage) ||
    // Check for current year mentions
    lowerMessage.includes('2025') ||
    // Check for temporal indicators
    /\b(today|yesterday|this week|last night|recently|currently)\b/i.test(lowerMessage);

  // Task creation patterns
  const taskPatterns = language === 'ar' 
    ? ['أنشئ مهمة', 'أضف مهمة', 'مهمة جديدة', 'اصنع مهمة', 'مطلوب عمل']
    : ['create task', 'add task', 'new task', 'make task', 'todo', 'need to do'];
  
  // Event creation patterns
  const eventPatterns = language === 'ar'
    ? ['أنشئ حدث', 'أضف حدث', 'موعد جديد', 'اجتماع', 'حفلة']
    : ['create event', 'add event', 'schedule', 'meeting', 'appointment'];
  
  // Reminder patterns
  const reminderPatterns = language === 'ar'
    ? ['ذكرني', 'تذكير', 'لا تنس', 'نبهني']
    : ['remind me', 'reminder', 'don\'t forget', 'alert me'];
  
  // Image generation patterns
  const imagePatterns = language === 'ar'
    ? ['أنشئ صورة', 'اصنع صورة', 'ارسم', 'صورة', 'generate image', 'create image']
    : ['generate image', 'create image', 'draw', 'make picture', 'image of'];

  // Check for real-time information requests first
  if (requiresBrowsing) {
    return {
      intent: 'real_time_info',
      confidence: 'high',
      action: null,
      params: null,
      requiresBrowsing: true
    };
  }

  if (taskPatterns.some(p => lowerMessage.includes(p))) {
    return {
      intent: 'create_task',
      confidence: 'high',
      action: 'create_task',
      params: extractTaskParams(message),
      requiresBrowsing: false
    };
  }
  
  if (eventPatterns.some(p => lowerMessage.includes(p))) {
    return {
      intent: 'create_event',
      confidence: 'high',
      action: 'create_event',
      params: extractEventParams(message),
      requiresBrowsing: false
    };
  }
  
  if (reminderPatterns.some(p => lowerMessage.includes(p))) {
    return {
      intent: 'create_reminder',
      confidence: 'high',
      action: 'create_reminder',
      params: extractReminderParams(message),
      requiresBrowsing: false
    };
  }
  
  if (imagePatterns.some(p => lowerMessage.includes(p))) {
    return {
      intent: 'generate_image',
      confidence: 'high',
      action: 'generate_image',
      params: { prompt: message.replace(/أنشئ صورة|اصنع صورة|ارسم|generate image|create image|draw|make picture/gi, '').trim() },
      requiresBrowsing: false
    };
  }

  return {
    intent: 'general_chat',
    confidence: 'medium',
    action: null,
    params: null,
    requiresBrowsing: false
  };
}

// Enhanced Tavily search with image extraction and better data formatting
async function performEnhancedTavilySearch(query: string, language: string): Promise<TavilyResponse | null> {
  try {
    console.log('WAKTI AI V2.1 Enhanced: Performing enhanced Tavily search for:', query);
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TAVILY_API_KEY}`
      },
      body: JSON.stringify({
        query: query,
        search_depth: 'basic',
        include_answer: true,
        include_raw_content: false,
        include_images: true,
        max_results: 5,
        include_domains: [],
        exclude_domains: [],
      })
    });

    if (!response.ok) {
      console.error('WAKTI AI V2.1 Enhanced: Tavily API error:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('WAKTI AI V2.1 Enhanced: Enhanced Tavily search completed successfully');
    
    return {
      results: data.results || [],
      query: data.query || query,
      response_time: data.response_time || 0,
      answer: data.answer || '',
      images: data.images || []
    };
    
  } catch (error) {
    console.error('WAKTI AI V2.1 Enhanced: Enhanced Tavily search error:', error);
    return null;
  }
}

// Format browsing data for AI prompt injection with enhanced formatting
function formatBrowsingDataForPrompt(browsingData: TavilyResponse, language: string): string {
  if (!browsingData.results || browsingData.results.length === 0) {
    return language === 'ar' ? 'لا توجد معلومات متاحة' : 'No information available';
  }

  let formatted = '';
  
  // Add Tavily's answer if available
  if (browsingData.answer) {
    const answerHeader = language === 'ar' ? 'الإجابة المباشرة: ' : 'Direct Answer: ';
    formatted += answerHeader + browsingData.answer + '\n\n';
  }

  // Add search results
  const resultsFormatted = browsingData.results.slice(0, 3).map((result, index) => {
    const title = result.title || 'Untitled';
    const content = result.content || 'No content available';
    const url = result.url || '';
    const date = result.published_date ? ` (${result.published_date})` : '';
    
    return language === 'ar' 
      ? `${index + 1}. ${title}${date}\nالمحتوى: ${content}\nالرابط: ${url}\n`
      : `${index + 1}. ${title}${date}\nContent: ${content}\nURL: ${url}\n`;
  }).join('\n');

  const header = language === 'ar' 
    ? `نتائج البحث (${browsingData.results.length} نتيجة):\n\n`
    : `Search results (${browsingData.results.length} results):\n\n`;

  formatted += header + resultsFormatted;

  return formatted;
}

// Estimate token count for usage logging
function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters for English, 3 for Arabic
  return Math.ceil(text.length / 3.5);
}

function extractTaskParams(message: string) {
  const title = message.replace(/create task|add task|new task|أنشئ مهمة|أضف مهمة/gi, '').trim();
  return {
    title: title || 'New Task',
    description: '',
    priority: 'medium'
  };
}

function extractEventParams(message: string) {
  const title = message.replace(/create event|add event|schedule|أنشئ حدث|أضف حدث/gi, '').trim();
  return {
    title: title || 'New Event',
    description: ''
  };
}

function extractReminderParams(message: string) {
  const title = message.replace(/remind me|reminder|ذكرني|تذكير/gi, '').trim();
  return {
    title: title || 'New Reminder',
    description: ''
  };
}

async function executeAction(action: string, params: any, language: string, openaiApiKey: string, supabase: any, userId: string) {
  try {
    console.log('WAKTI AI V2.1 Enhanced: Executing action with database integration:', action, 'with params:', params);

    switch (action) {
      case 'generate_image':
        return await generateImage(params.prompt, language, openaiApiKey);
        
      case 'create_task':
        return await createTask(params, supabase, userId, language);
        
      case 'create_event':
        return await createEvent(params, supabase, userId, language);
        
      case 'create_reminder':
        return await createReminder(params, supabase, userId, language);
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('WAKTI AI V2.1 Enhanced: Action execution error:', error);
    return {
      success: false,
      message: language === 'ar' ? 'فشل في تنفيذ العملية' : 'Failed to execute action',
      error: error.message
    };
  }
}

async function createTask(params: any, supabase: any, userId: string, language: string) {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        title: params.title,
        description: params.description || '',
        priority: params.priority || 'medium',
        type: 'task',
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: language === 'ar' 
        ? `تم إنشاء المهمة: ${params.title}`
        : `Task created: ${params.title}`,
      data: data
    };
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
}

async function createEvent(params: any, supabase: any, userId: string, language: string) {
  try {
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 1); // Default to tomorrow

    const { data, error } = await supabase
      .from('maw3d_events')
      .insert({
        created_by: userId,
        title: params.title,
        description: params.description || '',
        event_date: eventDate.toISOString().split('T')[0],
        is_all_day: true,
        is_public: false,
        language: language
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: language === 'ar' 
        ? `تم إنشاء الحدث: ${params.title}`
        : `Event created: ${params.title}`,
      data: data
    };
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
}

async function createReminder(params: any, supabase: any, userId: string, language: string) {
  try {
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + 1); // Default to 1 hour from now

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        title: params.title,
        description: params.description || '',
        type: 'reminder',
        status: 'pending',
        due_date: dueDate.toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: language === 'ar' 
        ? `تم إنشاء التذكير: ${params.title}`
        : `Reminder created: ${params.title}`,
      data: data
    };
  } catch (error) {
    console.error('Error creating reminder:', error);
    throw error;
  }
}

async function translateArabicToEnglish(arabicPrompt: string, openaiApiKey: string): Promise<string> {
  try {
    console.log("WAKTI AI V2.1 Enhanced: Translating Arabic prompt to English:", arabicPrompt);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional translator. Translate the following Arabic text to English, focusing on visual descriptions for image generation. Keep the translation natural and descriptive.' 
          },
          { role: 'user', content: arabicPrompt }
        ],
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const translatedPrompt = result.choices[0].message?.content || arabicPrompt;
      console.log("WAKTI AI V2.1 Enhanced: Translation result:", translatedPrompt);
      return translatedPrompt.trim();
    } else {
      console.error("WAKTI AI V2.1 Enhanced: Translation failed, using original prompt");
      return arabicPrompt;
    }
  } catch (error) {
    console.error('WAKTI AI V2.1 Enhanced: Error translating prompt:', error);
    return arabicPrompt;
  }
}

async function generateImage(prompt: string, language: string, openaiApiKey: string) {
  try {
    console.log("WAKTI AI V2.1 Enhanced: Generating image with prompt:", prompt);

    let finalPrompt = prompt;
    let translatedPrompt = null;

    // If the prompt contains Arabic characters, translate it to English
    const containsArabic = /[\u0600-\u06FF]/.test(prompt);
    if (containsArabic && language === 'ar') {
      console.log("WAKTI AI V2.1 Enhanced: Detected Arabic text, translating to English");
      translatedPrompt = await translateArabicToEnglish(prompt, openaiApiKey);
      finalPrompt = translatedPrompt;
    }

    console.log("WAKTI AI V2.1 Enhanced: Using final prompt for Runware:", finalPrompt);

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
          positivePrompt: finalPrompt,
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

    console.log("WAKTI AI V2.1 Enhanced: Runware response status:", response.status);

    if (response.ok) {
      const result = await response.json();
      console.log("WAKTI AI V2.1 Enhanced: Runware response data:", result);
      
      const imageResult = result.data?.find((item: any) => item.taskType === "imageInference");
      
      if (imageResult && imageResult.imageURL) {
        return {
          success: true,
          message: language === 'ar' ? 'تم إنشاء الصورة بنجاح' : 'Image generated successfully',
          imageUrl: imageResult.imageURL,
          translatedPrompt: translatedPrompt // Include the translation if it was done
        };
      } else {
        throw new Error('No image URL in response');
      }
    } else {
      const errorText = await response.text();
      console.error("WAKTI AI V2.1 Enhanced: Runware API error:", response.status, errorText);
      throw new Error(`Runware API failed: ${response.status}`);
    }
    
  } catch (error) {
    console.error('WAKTI AI V2.1 Enhanced: Error generating image:', error);
    return {
      success: false,
      message: language === 'ar' ? 'فشل في إنشاء الصورة' : 'Failed to generate image',
      error: error.message
    };
  }
}
