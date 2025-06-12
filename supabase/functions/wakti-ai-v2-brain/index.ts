import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

console.log("🚀 WAKTI AI V2 BRAIN: Enhanced with Chat Memory & Mode Restrictions");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 WAKTI AI V2 BRAIN: Processing request with chat memory");

    const requestBody = await req.json();
    console.log("🚀 WAKTI AI V2 BRAIN: Request body received:", {
      message: requestBody.message,
      userId: requestBody.userId,
      attachedFiles: requestBody.attachedFiles?.length || 0,
      conversationHistoryLength: requestBody.conversationHistory?.length || 0,
      activeTrigger: requestBody.activeTrigger
    });

    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      confirmSearch = false,
      activeTrigger = 'chat',
      attachedFiles = [],
      conversationHistory = [],
      searchTopic = 'general'
    } = requestBody;

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
    console.log("🚀 WAKTI AI V2 BRAIN: Chat memory length:", conversationHistory.length);

    let response = '';
    let fileAnalysisResults = [];
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let actionTaken = null;
    let actionResult = null;
    let contextUtilized = false;

    // Check for mode-based restrictions in chat mode
    if (activeTrigger === 'chat') {
      const modeRestriction = checkModeRestrictions(message, language);
      if (modeRestriction) {
        return new Response(JSON.stringify({
          response: modeRestriction,
          conversationId: conversationId || generateConversationId(),
          intent: 'mode_restriction',
          confidence: 'high',
          browsingUsed: false,
          requiresSearchConfirmation: false,
          success: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Process attached files with simplified handling
    if (attachedFiles && attachedFiles.length > 0) {
      console.log("📎 Processing files...");
      fileAnalysisResults = await processFilesSimplified(attachedFiles, language);
      console.log("📎 File analysis completed:", fileAnalysisResults.length);
    }

    // Handle both search and advanced_search triggers with enhanced Tavily
    if (activeTrigger === 'search' || activeTrigger === 'advanced_search') {
      console.log(`🔍 ${activeTrigger === 'advanced_search' ? 'Advanced search' : 'Search'} triggered`);
      
      // Check and increment quota BEFORE performing the search
      if (activeTrigger === 'advanced_search') {
        console.log("📈 Checking advanced search quota...");
        const quotaCheck = await checkAndIncrementAdvancedSearchQuota(userId);
        if (!quotaCheck.success) {
          console.log("❌ Advanced search quota exceeded");
          response = language === 'ar' 
            ? `لقد استنفدت حصتك الشهرية من البحث المتقدم (5 عمليات بحث). يمكنك شراء المزيد من عمليات البحث المتقدم.`
            : `You've reached your monthly advanced search limit (5 searches). You can purchase more advanced searches.`;
          
          return new Response(JSON.stringify({
            response,
            conversationId: conversationId || generateConversationId(),
            intent: 'quota_exceeded',
            confidence: 'high',
            browsingUsed: false,
            quotaStatus: { advancedSearchUsed: true, quotaExceeded: true },
            requiresSearchConfirmation: false,
            success: true
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        console.log("✅ Advanced search quota available, proceeding...");
      } else {
        // Regular search - just log usage for tracking
        console.log("📈 Logging regular search usage...");
        await logRegularSearchUsage(userId);
      }

      // Enhanced Tavily search with different configurations
      const searchResults = await performEnhancedTavilySearch(
        message, 
        language, 
        activeTrigger, 
        searchTopic
      );
      
      if (searchResults.success) {
        browsingUsed = true;
        browsingData = searchResults.data;
        actionTaken = activeTrigger === 'advanced_search' ? 'advanced_web_search' : 'basic_web_search';
        actionResult = { searchResults: searchResults.data };

        // Generate AI response with search results and conversation context
        response = await generateResponseWithSearchAndContext(
          message,
          searchResults.data,
          conversationHistory,
          language
        );
        
        console.log(`✅ ${activeTrigger === 'advanced_search' ? 'Advanced search' : 'Search'} completed successfully`);
      } else {
        console.error("❌ Tavily search failed:", searchResults.error);
        response = language === 'ar' 
          ? `حدث خطأ أثناء البحث: ${searchResults.error}. سأحاول الإجابة بناءً على معرفتي الحالية.`
          : `Search error: ${searchResults.error}. I'll try to answer based on my current knowledge.`;
        
        // Fallback to regular AI response
        response = await processWithEnhancedContext(message, conversationHistory, language, activeTrigger);
      }
      
      contextUtilized = conversationHistory.length > 0;
    } else {
      // Regular processing for other triggers (chat, image, etc.)
      if (fileAnalysisResults.length > 0) {
        response = await generateResponseWithFileAnalysisAndContext(
          message, 
          fileAnalysisResults, 
          conversationHistory, 
          language
        );
        actionTaken = 'file_analysis';
        actionResult = { fileAnalysis: fileAnalysisResults };
        contextUtilized = true;
      } else {
        response = await processWithEnhancedContext(
          message, 
          conversationHistory, 
          language, 
          activeTrigger
        );
        contextUtilized = conversationHistory.length > 0;
      }
    }

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: (activeTrigger === 'search' || activeTrigger === 'advanced_search') ? 'web_search' : 'general_chat',
      confidence: 'high',
      actionTaken,
      actionResult,
      browsingUsed,
      browsingData,
      quotaStatus,
      requiresSearchConfirmation: false,
      needsConfirmation: false,
      attachedFiles: attachedFiles,
      fileAnalysisResults,
      contextUtilized,
      success: true
    };

    console.log("🚀 WAKTI AI V2 BRAIN: Sending response with context utilization:", contextUtilized);

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

// NEW: Function to check mode restrictions for chat mode
function checkModeRestrictions(message: string, language: string = 'en'): string | null {
  const lowerMessage = message.toLowerCase();
  
  // Image generation requests
  const imageKeywords = [
    'generate image', 'create image', 'make image', 'draw', 'picture', 'photo',
    'أنشئ صورة', 'اصنع صورة', 'ارسم', 'صورة', 'رسم'
  ];
  
  // Search requests
  const searchKeywords = [
    'search for', 'find information', 'look up', 'what is happening', 'current news',
    'ابحث عن', 'ابحث في', 'ما الأخبار', 'معلومات حديثة', 'آخر الأخبار'
  ];

  const hasImageRequest = imageKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasSearchRequest = searchKeywords.some(keyword => lowerMessage.includes(keyword));

  if (hasImageRequest) {
    return language === 'ar' 
      ? "أنا حالياً في وضع المحادثة. يرجى التبديل إلى وضع الصورة لإنشاء الصور."
      : "I'm currently in Chat Mode. Please switch to Image Mode to generate images.";
  }

  if (hasSearchRequest) {
    return language === 'ar' 
      ? "أنا حالياً في وضع المحادثة. يرجى التبديل إلى وضع البحث للحصول على معلومات حديثة."
      : "I'm currently in Chat Mode. Please switch to Search Mode to get current information.";
  }

  return null; // No restrictions
}

// NEW: Simple function to check and increment advanced search quota
async function checkAndIncrementAdvancedSearchQuota(userId: string) {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    
    // Get or create quota record for current month
    const { data: quotaData, error: quotaError } = await supabase
      .from('user_search_quotas')
      .select('*')
      .eq('user_id', userId)
      .eq('monthly_date', currentMonth)
      .single();
    
    if (quotaError && quotaError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error("Error fetching quota:", quotaError);
      return { success: false, error: quotaError.message };
    }
    
    let currentUsage = 0;
    let extraSearches = 0;
    
    if (quotaData) {
      currentUsage = quotaData.daily_count || 0;
      extraSearches = quotaData.extra_advanced_searches || 0;
    }
    
    // Check if user has quota available (5 free + extras)
    const maxFreeSearches = 5;
    if (currentUsage >= maxFreeSearches && extraSearches <= 0) {
      console.log("Quota exceeded:", { currentUsage, maxFreeSearches, extraSearches });
      return { success: false, error: "Quota exceeded" };
    }
    
    // Increment usage
    if (quotaData) {
      // Update existing record
      if (currentUsage < maxFreeSearches) {
        // Use free quota
        const { error: updateError } = await supabase
          .from('user_search_quotas')
          .update({ 
            daily_count: currentUsage + 1,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('monthly_date', currentMonth);
        
        if (updateError) {
          console.error("Error updating quota:", updateError);
          return { success: false, error: updateError.message };
        }
      } else {
        // Use extra searches
        const { error: updateError } = await supabase
          .from('user_search_quotas')
          .update({ 
            extra_advanced_searches: extraSearches - 1,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('monthly_date', currentMonth);
        
        if (updateError) {
          console.error("Error updating extra searches:", updateError);
          return { success: false, error: updateError.message };
        }
      }
    } else {
      // Create new record
      const { error: insertError } = await supabase
        .from('user_search_quotas')
        .insert({
          user_id: userId,
          monthly_date: currentMonth,
          daily_count: 1,
          extra_searches: 0,
          regular_search_count: 0,
          extra_regular_searches: 0,
          extra_advanced_searches: 0
        });
      
      if (insertError) {
        console.error("Error creating quota record:", insertError);
        return { success: false, error: insertError.message };
      }
    }
    
    console.log("✅ Advanced search quota incremented successfully");
    return { success: true };
    
  } catch (error) {
    console.error("❌ Error in checkAndIncrementAdvancedSearchQuota:", error);
    return { success: false, error: error.message };
  }
}

// NEW: Simple function to log regular search usage (no quota limit)
async function logRegularSearchUsage(userId: string) {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Get or create quota record
    const { data: quotaData, error: quotaError } = await supabase
      .from('user_search_quotas')
      .select('*')
      .eq('user_id', userId)
      .eq('monthly_date', currentMonth)
      .single();
    
    if (quotaData) {
      // Update existing record
      await supabase
        .from('user_search_quotas')
        .update({ 
          regular_search_count: (quotaData.regular_search_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('monthly_date', currentMonth);
    } else {
      // Create new record
      await supabase
        .from('user_search_quotas')
        .insert({
          user_id: userId,
          monthly_date: currentMonth,
          daily_count: 0,
          extra_searches: 0,
          regular_search_count: 1,
          extra_regular_searches: 0,
          extra_advanced_searches: 0
        });
    }
    
    console.log("✅ Regular search usage logged");
  } catch (error) {
    console.error("⚠️ Error logging regular search usage:", error);
    // Don't throw error for logging failures
  }
}

// Enhanced Tavily search function with differentiated configurations
async function performEnhancedTavilySearch(
  query: string, 
  language: string = 'en', 
  searchMode: string = 'search',
  topic: string = 'general'
) {
  try {
    if (!TAVILY_API_KEY) {
      throw new Error("Tavily API key not configured");
    }

    const isAdvanced = searchMode === 'advanced_search';
    console.log(`🔍 Performing ${isAdvanced ? 'Advanced' : 'Basic'} Tavily search for:`, query.slice(0, 50));

    // Configure search parameters based on mode
    const searchConfig = {
      query: query,
      topic: topic, // 'general' or 'news'
      search_depth: isAdvanced ? 'advanced' : 'basic',
      max_results: isAdvanced ? 5 : 3,
      include_answer: true,
      include_raw_content: false,
      // Enhanced configurations
      chunks_per_source: isAdvanced ? 3 : 1, // More content chunks for advanced
      time_range: isAdvanced ? 'year' : 'week', // Longer time range for advanced
      include_images: isAdvanced, // Only advanced search includes images
      include_image_descriptions: isAdvanced, // With descriptions for advanced
      include_domains: [],
      exclude_domains: []
    };

    console.log(`🔍 Search configuration:`, {
      mode: isAdvanced ? 'advanced' : 'basic',
      topic,
      chunks_per_source: searchConfig.chunks_per_source,
      time_range: searchConfig.time_range,
      include_images: searchConfig.include_images,
      max_results: searchConfig.max_results
    });

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TAVILY_API_KEY}`
      },
      body: JSON.stringify(searchConfig)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Tavily API failed: ${response.status}`, errorData);
      throw new Error(`Tavily API failed: ${response.status} - ${errorData}`);
    }

    const searchData = await response.json();
    console.log(`✅ ${isAdvanced ? 'Advanced' : 'Basic'} Tavily search successful:`, {
      results: searchData.results?.length || 0,
      images: searchData.images?.length || 0,
      hasAnswer: !!searchData.answer
    });

    return {
      success: true,
      data: {
        answer: searchData.answer,
        results: searchData.results || [],
        images: searchData.images || [],
        query: searchData.query,
        response_time: searchData.response_time,
        search_mode: isAdvanced ? 'advanced' : 'basic',
        topic: topic,
        time_range: searchConfig.time_range,
        chunks_per_source: searchConfig.chunks_per_source
      }
    };

  } catch (error) {
    console.error('Error performing enhanced Tavily search:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

// New function to generate response with search results and context
async function generateResponseWithSearchAndContext(
  message: string,
  searchData: any,
  conversationHistory: any[],
  language: string = 'en'
) {
  try {
    const apiKey = DEEPSEEK_API_KEY || OPENAI_API_KEY;
    const apiUrl = DEEPSEEK_API_KEY ? 'https://api.deepseek.com/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const model = DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';

    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    console.log(`🔍 Generating response with search results and context using: ${DEEPSEEK_API_KEY ? 'DeepSeek' : 'OpenAI'}`);

    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة. لقد حصلت على نتائج بحث حديثة من الويب لسؤال المستخدم. استخدم هذه المعلومات مع سياق المحادثة السابق لتقديم إجابة شاملة ودقيقة.

تذكر دائماً:
- استخدم المعلومات الحديثة من نتائج البحث
- اربط إجابتك بسياق المحادثة السابق
- اذكر المصادر عند الإمكان
- إذا كانت هناك صور مرفقة، اذكرها في إجابتك
- كن دقيقاً ومفيداً ومختصراً`
      : `You are WAKTI, an advanced AI assistant. You have received fresh web search results for the user's query. Use this information along with the previous conversation context to provide a comprehensive and accurate response.

Always remember to:
- Use the latest information from search results
- Connect your response to previous conversation context
- Cite sources when possible
- If images are included, mention them in your response
- Be accurate, helpful, and concise`;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add recent conversation history for context
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-20);
      for (const historyMessage of recentHistory) {
        messages.push({
          role: historyMessage.role,
          content: historyMessage.content
        });
      }
    }

    // Prepare enhanced search results summary
    let searchSummary = `Search Results for: "${searchData.query}"
Search Mode: ${searchData.search_mode} (${searchData.topic} topic)
Time Range: ${searchData.time_range}

Answer: ${searchData.answer || 'No direct answer provided'}

Top Results:
${searchData.results.map((result: any, index: number) => 
  `${index + 1}. ${result.title}
   URL: ${result.url}
   Content: ${result.content.slice(0, 300)}...`
).join('\n\n')}`;

    // Add image information for advanced searches
    if (searchData.images && searchData.images.length > 0) {
      searchSummary += `\n\nImages Found: ${searchData.images.length}
${searchData.images.slice(0, 3).map((image: any, index: number) => 
  `${index + 1}. ${image.url}${image.description ? `\n   Description: ${image.description}` : ''}`
).join('\n')}`;
    }

    // Add current message with search results
    messages.push({ 
      role: 'user', 
      content: `${message}\n\nWeb Search Results:\n${searchSummary}` 
    });

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
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ Search response generated successfully using: ${DEEPSEEK_API_KEY ? 'DeepSeek' : 'OpenAI'}`);
    
    return result.choices[0].message.content;

  } catch (error) {
    console.error("Error generating response with search and context:", error);
    
    // Fallback response
    return language === 'ar' 
      ? `تم العثور على نتائج البحث ولكن حدث خطأ في معالجتها. إليك ما وجدته: ${searchData.answer || 'لم يتم العثور على إجابة مباشرة'}`
      : `Found search results but encountered an error processing them. Here's what I found: ${searchData.answer || 'No direct answer found'}`;
  }
}

// Enhanced function to process message with full conversation context
async function processWithEnhancedContext(
  message: string, 
  conversationHistory: any[], 
  language: string = 'en', 
  activeTrigger: string = 'chat'
) {
  try {
    console.log("🧠 WAKTI AI V2 BRAIN: Processing with DeepSeek and chat memory");
    console.log("🧠 Context details:", {
      historyLength: conversationHistory.length,
      activeTrigger,
      language
    });
    
    // Always prefer DeepSeek for chat interactions
    const apiKey = DEEPSEEK_API_KEY || OPENAI_API_KEY;
    const apiUrl = DEEPSEEK_API_KEY ? 'https://api.deepseek.com/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const model = DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';
    
    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة. تتخصص في المساعدة في المهام اليومية وتقديم معلومات دقيقة ومفيدة. 

تذكر دائماً سياق المحادثة السابق واربط إجاباتك بما تم مناقشته من قبل. إذا كان المستخدم يشير إلى شيء تم ذكره سابقاً، تأكد من ربط إجابتك بذلك السياق.

كن ودوداً ومفيداً ومختصراً في إجاباتك، واستخدم المعلومات السابقة لتقديم إجابات أكثر دقة وشخصية.

أنت حالياً في وضع المحادثة. إذا طلب المستخدم إنشاء صور أو البحث في الويب، أخبره بالتبديل إلى الوضع المناسب.`
      : `You are WAKTI, an advanced AI assistant. You specialize in helping with daily tasks and providing accurate, helpful information. 

Always remember the previous conversation context and connect your responses to what has been discussed before. If the user refers to something mentioned earlier, make sure to link your response to that context.

Be friendly, helpful, and concise in your responses, and use previous information to provide more accurate and personalized answers.

You are currently in Chat Mode. If the user asks for image generation or web search, tell them to switch to the appropriate mode.`;
    
    // Build conversation messages with full context
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history (maintain chronological order)
    if (conversationHistory && conversationHistory.length > 0) {
      console.log("🧠 Adding chat memory context:", conversationHistory.length, "messages");
      
      for (const historyMessage of conversationHistory) {
        messages.push({
          role: historyMessage.role,
          content: historyMessage.content
        });
      }
    }

    // Add current message
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
        max_tokens: 1500
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`✅ Enhanced context response generated using: ${DEEPSEEK_API_KEY ? 'DeepSeek' : 'OpenAI'}`);
    
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error("🧠 WAKTI AI V2 BRAIN: Enhanced context processing error:", error);
    
    // Fallback response
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
  }
}

// Enhanced function to generate response with file analysis and conversation context
async function generateResponseWithFileAnalysisAndContext(
  message: string, 
  fileAnalysis: any[], 
  conversationHistory: any[], 
  language: string = 'en'
) {
  try {
    const apiKey = DEEPSEEK_API_KEY || OPENAI_API_KEY;
    const apiUrl = DEEPSEEK_API_KEY ? 'https://api.deepseek.com/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const model = DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';

    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    console.log(`💬 Generating response with file analysis and context using: ${DEEPSEEK_API_KEY ? 'DeepSeek' : 'OpenAI'}`);

    const systemPrompt = language === 'ar' 
      ? 'أنت WAKTI، مساعد ذكي متقدم. المستخدم أرسل ملفات مع رسالته، واستخدم تاريخ المحادثة السابق وتحليل الملفات المرفق للإجابة على سؤاله بشكل شامل ومفيد. تذكر السياق السابق للمحادثة.'
      : 'You are WAKTI, an advanced AI assistant. The user sent files with their message. Use the previous conversation history and the attached file analysis to provide a comprehensive and helpful response to their question. Remember the previous conversation context.';

    // Build messages with conversation context
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add recent conversation history for context
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-20); // Keep recent context
      for (const historyMessage of recentHistory) {
        messages.push({
          role: historyMessage.role,
          content: historyMessage.content
        });
      }
    }

    // Prepare file analysis summary
    const fileAnalysisSummary = fileAnalysis.map(file => 
      `File: ${file.fileName} (${file.fileType})\nAnalysis: ${file.analysis.analysis}`
    ).join('\n\n');

    // Add current message with file analysis
    messages.push({ 
      role: 'user', 
      content: `${message}\n\nFile Analysis Results:\n${fileAnalysisSummary}` 
    });

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
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ File analysis with context synthesis successful using: ${DEEPSEEK_API_KEY ? 'DeepSeek' : 'OpenAI'}`);
    
    return result.choices[0].message.content;

  } catch (error) {
    console.error("Error generating response with file analysis and context:", error);
    
    // Fallback response
    return language === 'ar' 
      ? `تم تحليل الملفات المرفقة بنجاح. ${fileAnalysis.length} ملف تم تحليله. يرجى إعادة صياغة سؤالك للحصول على معلومات أكثر تفصيلاً.`
      : `Successfully analyzed ${fileAnalysis.length} attached file(s). Please rephrase your question for more detailed information.`;
  }
}

// Simplified file processing - removed PDF specific handling
async function processFilesSimplified(files: any[], language: string = 'en') {
  const results = [];

  for (const file of files) {
    try {
      console.log(`📎 Processing file: ${file.name} (${file.type})`);
      
      let analysisResult;

      if (isImageFile(file.type)) {
        // Use OpenAI Vision for images
        console.log(`🖼️ Using Vision API for image: ${file.name}`);
        analysisResult = await analyzeImageWithVision(file, language);
      } else if (isTextFile(file.type)) {
        // Process text files directly
        console.log(`📝 Processing text file: ${file.name}`);
        analysisResult = await processTextFile(file, language);
      } else {
        // Unsupported file type
        console.log(`❌ Unsupported file type: ${file.type}`);
        analysisResult = {
          success: false,
          error: 'Unsupported file type',
          analysis: language === 'ar' ? 'نوع ملف غير مدعوم' : 'Unsupported file type'
        };
      }

      results.push({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: file.url,
        analysis: analysisResult
      });

    } catch (error) {
      console.error(`📎 Error processing file ${file.name}:`, error);
      results.push({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: file.url,
        analysis: {
          success: false,
          error: error.message,
          analysis: language === 'ar' ? 'فشل في تحليل الملف' : 'Failed to analyze file'
        }
      });
    }
  }

  return results;
}

// Check if file is an image
function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/') && 
         ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'].includes(mimeType.toLowerCase());
}

// Check if file is a text file
function isTextFile(mimeType: string): boolean {
  return mimeType === 'text/plain' || mimeType.includes('text/');
}

// Analyze images with OpenAI Vision
async function analyzeImageWithVision(file: any, language: string = 'en') {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured for image analysis");
    }

    console.log(`🔍 Analyzing image with OpenAI Vision: ${file.name}`);

    const systemPrompt = language === 'ar' 
      ? 'أنت مساعد ذكي متخصص في تحليل الصور. صف ما تراه في الصورة بالتفصيل واستخرج أي نص موجود. كن دقيقاً ومفصلاً في وصفك.'
      : 'You are an AI assistant specialized in image analysis. Describe what you see in the image in detail and extract any text present. Be accurate and detailed in your description.';

    const userPrompt = language === 'ar' ? 'حلل هذه الصورة بالتفصيل' : 'Analyze this image in detail';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: file.url } }
            ]
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`OpenAI Vision API failed: ${response.status}`, errorData);
      throw new Error(`OpenAI Vision API failed: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    console.log(`✅ Vision analysis successful for: ${file.name}`);
    
    return {
      success: true,
      analysis: result.choices[0].message.content,
      model: 'gpt-4o-vision'
    };

  } catch (error) {
    console.error('Error analyzing image with Vision:', error);
    return {
      success: false,
      error: error.message,
      analysis: language === 'ar' ? 'فشل في تحليل الصورة' : 'Failed to analyze image'
    };
  }
}

// Process text files by reading content and analyzing with AI
async function processTextFile(file: any, language: string = 'en') {
  try {
    console.log(`📝 Processing text file: ${file.name}`);
    
    // Fetch the text content from the file URL
    const response = await fetch(file.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch text file: ${response.status}`);
    }
    
    const textContent = await response.text();
    
    // Analyze the text content with AI
    const apiKey = DEEPSEEK_API_KEY || OPENAI_API_KEY;
    const apiUrl = DEEPSEEK_API_KEY ? 'https://api.deepseek.com/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const model = DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';

    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    const systemPrompt = language === 'ar' 
      ? 'أنت مساعد ذكي متخصص في تحليل النصوص والمستندات. حلل المحتوى واستخرج النقاط المهمة والملخص والبيانات الرئيسية.'
      : 'You are an AI assistant specialized in text and document analysis. Analyze the content and extract key points, summary, and main data.';

    const userPrompt = language === 'ar' 
      ? `حلل محتوى هذا الملف النصي:\n\n${textContent}`
      : `Analyze the content of this text file:\n\n${textContent}`;

    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API failed: ${aiResponse.status}`);
    }

    const result = await aiResponse.json();
    console.log(`✅ Text analysis successful for: ${file.name}`);
    
    return {
      success: true,
      analysis: result.choices[0].message.content,
      model: model,
      textLength: textContent.length
    };

  } catch (error) {
    console.error('Error processing text file:', error);
    return {
      success: false,
      error: error.message,
      analysis: language === 'ar' ? 'فشل في معالجة الملف النصي' : 'Failed to process text file'
    };
  }
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
