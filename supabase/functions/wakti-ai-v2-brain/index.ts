
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

console.log('🚀 WAKTI AI V2 BRAIN: Enhanced with Smart Date/Time Intelligence & Fixed Task Creation');

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 WAKTI AI V2 BRAIN: Processing request with smart date/time intelligence');

    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('❌ No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Create Supabase client with auth header
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const body = await req.json();
    const {
      message,
      userId,
      language = 'en',
      conversationId,
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
    } = body;

    console.log('🚀 WAKTI AI V2 BRAIN: Request body received:', {
      message: message,
      userId: userId,
      authenticatedUserId: user.id,
      attachedFiles: attachedFiles?.length || 0,
      conversationHistoryLength: conversationHistory?.length || 0,
      activeTrigger: activeTrigger
    });

    // Use authenticated user ID instead of provided userId for security
    const secureUserId = user.id;

    console.log('🚀 WAKTI AI V2 BRAIN: Processing message for user:', secureUserId);
    console.log('🚀 WAKTI AI V2 BRAIN: Active trigger mode:', activeTrigger);

    // Load chat memory for chat mode
    const ChatMemoryService = {
      formatForAI: (exchanges: any[]) => {
        const formatted = [];
        for (const exchange of exchanges) {
          formatted.push({ role: 'user', content: exchange.user_message });
          formatted.push({ role: 'assistant', content: exchange.ai_response });
        }
        return formatted;
      },
      
      loadMemory: (userId: string) => {
        try {
          const key = `wakti_chat_memory_${userId}`;
          const stored = localStorage?.getItem(key);
          return stored ? JSON.parse(stored) : [];
        } catch {
          return [];
        }
      },

      addExchange: (userMsg: string, aiResponse: string, userId: string) => {
        try {
          const key = `wakti_chat_memory_${userId}`;
          const existing = JSON.parse(localStorage?.getItem(key) || '[]');
          existing.push({
            user_message: userMsg,
            ai_response: aiResponse,
            timestamp: new Date().toISOString()
          });
          const recent = existing.slice(-20);
          localStorage?.setItem(key, JSON.stringify(recent));
        } catch (error) {
          console.error('Failed to save chat memory:', error);
        }
      }
    };

    let chatMemory: any[] = [];
    if (activeTrigger === 'chat') {
      const memoryExchanges = ChatMemoryService.loadMemory(secureUserId);
      chatMemory = ChatMemoryService.formatForAI(memoryExchanges);
      console.log(`🧠 Loaded ${memoryExchanges.length} chat exchanges from memory`);
    }

    console.log('🚀 WAKTI AI V2 BRAIN: Chat memory length:', chatMemory.length);

    console.log('🧠 Context details:', {
      historyLength: conversationHistory.length,
      activeTrigger: activeTrigger,
      language: language
    });

    console.log('🧠 Adding chat memory context:', chatMemory.length, 'messages');

    console.log('🧠 WAKTI AI V2 BRAIN: Processing with enhanced intelligence');

    // Enhanced search mode logic - SIMPLIFIED
    let shouldPerformSearch = false;
    
    if (activeTrigger === 'search') {
      // In search mode, treat ALL messages as search queries by default
      // Only exclude obvious non-search content
      const nonSearchPatterns = [
        /^(hi|hello|hey|good morning|good afternoon|good evening)$/i,
        /^(thanks|thank you|bye|goodbye)$/i,
        /^(help|settings|menu)$/i
      ];
      
      const isNonSearchContent = nonSearchPatterns.some(pattern => pattern.test(message.trim()));
      
      if (!isNonSearchContent) {
        shouldPerformSearch = true;
        console.log('🔍 Search mode detected - treating message as search query:', message);
      } else {
        console.log('🔍 Search mode but non-search content detected:', message);
      }
    }

    let browsingData = null;
    let quotaStatus = null;

    // Handle search functionality with proper quota management
    if (shouldPerformSearch && TAVILY_API_KEY) {
      console.log('🔍 Checking search quota for user:', secureUserId);
      
      // Check current search quota using the correct function
      const { data: quotaData, error: quotaError } = await supabase.rpc('get_or_create_user_search_quota', {
        p_user_id: secureUserId
      });

      if (quotaError) {
        console.error('❌ Quota check error:', quotaError);
        quotaStatus = { used: 0, limit: 10, extraSearches: 0, canSearch: true };
      } else {
        const quota = quotaData[0] || {};
        const used = quota.regular_search_count || 0;
        const limit = 10; // 10 free searches per month
        const extraSearches = quota.extra_regular_searches || 0;
        const canSearch = (used < limit) || (extraSearches > 0);
        
        quotaStatus = {
          used,
          limit,
          extraSearches,
          canSearch
        };
        
        console.log('📊 Search quota status:', quotaStatus);
      }

      if (quotaStatus.canSearch) {
        try {
          console.log('🔍 Executing Tavily search for query:', message);
          
          const tavilyResponse = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              api_key: TAVILY_API_KEY,
              query: message,
              search_depth: "basic",
              include_answer: true,
              include_images: false,
              include_raw_content: false,
              max_results: 5,
              include_domains: [],
              exclude_domains: []
            })
          });

          if (tavilyResponse.ok) {
            browsingData = await tavilyResponse.json();
            console.log('✅ Tavily search successful');
            
            // Increment search usage using the correct function
            console.log('🔄 Incrementing search usage for user:', secureUserId);
            const { data: incrementData, error: incrementError } = await supabase.rpc('increment_regular_search_usage', {
              p_user_id: secureUserId
            });

            if (incrementError) {
              console.error('❌ Error incrementing search usage:', incrementError);
            } else {
              console.log('✅ Search usage incremented successfully');
              
              // Update quota status after increment
              if (incrementData && incrementData[0]) {
                quotaStatus.used = incrementData[0].regular_search_count;
                quotaStatus.extraSearches = incrementData[0].extra_regular_searches;
              }
            }
          } else {
            console.error('❌ Tavily search failed:', tavilyResponse.status);
          }
        } catch (error) {
          console.error('❌ Error in Tavily search:', error);
        }
      } else {
        console.log('🚫 Search quota exceeded for user:', secureUserId);
        return new Response(
          JSON.stringify({
            error: 'Search quota exceeded',
            quotaStatus: quotaStatus
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    }

    // Handle task/reminder confirmation
    if (confirmTask && pendingTaskData) {
      console.log('🔧 Processing task confirmation for user:', secureUserId);
      
      try {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            user_id: secureUserId,
            title: pendingTaskData.title,
            description: pendingTaskData.description || '',
            due_date: pendingTaskData.due_date,
            priority: pendingTaskData.priority,
            type: pendingTaskData.task_type || 'one-time',
            status: 'pending'
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Error creating task:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to create task: ' + error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log('✅ Task created successfully:', data.id);
        
        return new Response(
          JSON.stringify({
            response: language === 'ar' 
              ? '✅ تم إنشاء المهمة بنجاح! يمكنك الآن رؤيتها في صفحة المهام والتذكيرات.'
              : '✅ Task created successfully! You can now see it in your Tasks & Reminders page.',
            success: true,
            taskId: data.id
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error: any) {
        console.error('❌ Task confirmation error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to create task: ' + error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (confirmReminder && pendingReminderData) {
      console.log('🔔 Processing reminder confirmation for user:', secureUserId);
      
      try {
        const { data, error } = await supabase
          .from('tr_reminders')
          .insert({
            user_id: secureUserId,
            title: pendingReminderData.title,
            description: pendingReminderData.description || '',
            due_date: pendingReminderData.due_date,
            due_time: pendingReminderData.due_time
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Error creating reminder:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to create reminder: ' + error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log('✅ Reminder created successfully:', data.id);
        
        return new Response(
          JSON.stringify({
            response: language === 'ar' 
              ? '✅ تم إنشاء التذكير بنجاح! يمكنك الآن رؤيته في صفحة المهام والتذكيرات.'
              : '✅ Reminder created successfully! You can now see it in your Tasks & Reminders page.',
            success: true,
            reminderId: data.id
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error: any) {
        console.error('❌ Reminder confirmation error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to create reminder: ' + error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log('🤖 Processing with real AI');

    // Prepare messages for AI
    const aiMessages = [];
    
    // Add system message
    let systemPrompt = `You are WAKTI, an intelligent AI assistant. Current date/time: ${new Date().toISOString()}.`;
    
    if (activeTrigger === 'search' && browsingData) {
      systemPrompt += `\n\nYou have access to real-time search results. Use this information to provide accurate, up-to-date responses. Here is the search data: ${JSON.stringify(browsingData)}`;
    }
    
    aiMessages.push({ role: 'system', content: systemPrompt });

    // Add chat memory context
    if (chatMemory.length > 0) {
      aiMessages.push(...chatMemory.slice(-10)); // Last 10 exchanges
    }

    // Add conversation history
    if (conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-20);
      for (const msg of recentHistory) {
        if (msg.role && msg.content) {
          aiMessages.push({
            role: msg.role,
            content: msg.content
          });
        }
      }
    }

    // Add current user message
    aiMessages.push({ role: 'user', content: message });

    // Call AI
    let aiResponse = '';
    try {
      if (!DEEPSEEK_API_KEY) {
        throw new Error("DeepSeek API key not configured");
      }
      
      const deepseekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: aiMessages,
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      const result = await deepseekResponse.json();
      
      if (!deepseekResponse.ok) {
        throw new Error(`DeepSeek API failed: ${JSON.stringify(result)}`);
      }
      
      aiResponse = result.choices[0].message?.content || '';
    } catch (error) {
      console.log("DeepSeek API failed, falling back to OpenAI:", error.message);
      
      if (!OPENAI_API_KEY) {
        throw new Error("OpenAI API key not configured for fallback");
      }
      
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: aiMessages,
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      const result = await openaiResponse.json();
      
      if (!openaiResponse.ok) {
        throw new Error(`Both DeepSeek and OpenAI APIs failed: ${JSON.stringify(result)}`);
      }
      
      aiResponse = result.choices[0].message?.content || '';
      console.log("OpenAI fallback successful");
    }

    console.log('✅ Enhanced response generated with smart date/time processing');

    // Save to chat memory if this was a chat mode interaction
    if (activeTrigger === 'chat' && aiResponse) {
      ChatMemoryService.addExchange(message, aiResponse, secureUserId);
    }

    console.log('🚀 WAKTI AI V2 BRAIN: Sending response with context utilization:', browsingData ? true : false);

    return new Response(
      JSON.stringify({
        response: aiResponse,
        browsingUsed: shouldPerformSearch && browsingData !== null,
        browsingData: browsingData,
        quotaStatus: quotaStatus,
        intent: shouldPerformSearch ? 'search' : 'general_chat',
        confidence: 'high',
        actionTaken: shouldPerformSearch ? 'search_performed' : 'chat_response'
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error('❌ WAKTI AI V2 BRAIN Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
