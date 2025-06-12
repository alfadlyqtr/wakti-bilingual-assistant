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

console.log("🚀 WAKTI AI V2 BRAIN: Enhanced Conversation Context Management with Advanced Tavily Search");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 WAKTI AI V2 BRAIN: Processing request with enhanced context");

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
    console.log("🚀 WAKTI AI V2 BRAIN: Search topic:", searchTopic);
    console.log("🚀 WAKTI AI V2 BRAIN: Attached files count:", attachedFiles.length);
    console.log("🚀 WAKTI AI V2 BRAIN: Conversation history length:", conversationHistory.length);

    let response = '';
    let fileAnalysisResults = [];
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let actionTaken = null;
    let actionResult = null;
    let contextUtilized = false;

    // Process attached files with simplified handling
    if (attachedFiles && attachedFiles.length > 0) {
      console.log("📎 Processing files...");
      fileAnalysisResults = await processFilesSimplified(attachedFiles, language);
      console.log("📎 File analysis completed:", fileAnalysisResults.length);
    }

    // Handle both search and advanced_search triggers with enhanced Tavily
    if (activeTrigger === 'search' || activeTrigger === 'advanced_search') {
      console.log(`🔍 ${activeTrigger === 'advanced_search' ? 'Advanced search' : 'Search'} triggered`);
      
      // First, increment the appropriate search quota BEFORE performing the search
      if (activeTrigger === 'advanced_search') {
        console.log("📈 Incrementing advanced search quota before search...");
        const advancedSearchResult = await incrementAdvancedSearchQuota(userId);
        if (!advancedSearchResult.success) {
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
      } else {
        // Regular search - always increment (unlimited but for tracking)
        console.log("📈 Incrementing regular search quota before search...");
        await incrementRegularSearchQuota(userId);
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

        // Also increment browsing usage for general tracking
        await incrementBrowsingUsage(userId);
        
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

// NEW: Function to increment advanced search quota with proper checking
async function incrementAdvancedSearchQuota(userId: string) {
  try {
    console.log("📈 Incrementing advanced search quota for user:", userId);
    
    const { data, error } = await supabase.rpc('increment_search_usage', {
      p_user_id: userId
    });

    if (error) {
      console.error("❌ Error incrementing advanced search quota:", error);
      return { success: false, error: error.message };
    }

    if (data && data.length > 0) {
      const result = data[0];
      console.log("✅ Advanced search quota increment result:", result);
      return {
        success: result.success,
        daily_count: result.daily_count,
        extra_advanced_searches: result.extra_advanced_searches
      };
    }
    
    return { success: false, error: "No data returned from quota function" };
  } catch (error) {
    console.error("❌ Error in incrementAdvancedSearchQuota:", error);
    return { success: false, error: error.message };
  }
}

// NEW: Function to increment regular search quota (for tracking, always succeeds)
async function incrementRegularSearchQuota(userId: string) {
  try {
    console.log("📈 Incrementing regular search quota for user:", userId);
    
    const { data, error } = await supabase.rpc('increment_regular_search_usage', {
      p_user_id: userId
    });

    if (error) {
      console.error("⚠️ Error incrementing regular search quota (non-blocking):", error);
    } else {
      console.log("✅ Regular search quota incremented successfully");
    }
    
    return { success: true }; // Always return success for regular search
  } catch (error) {
    console.error("⚠️ Error in incrementRegularSearchQuota (non-blocking):", error);
    return { success: true }; // Always return success for regular search
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

// Function to increment browsing usage
async function incrementBrowsingUsage(userId: string) {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    
    const { error } = await supabase.rpc('log_ai_usage', {
      p_user_id: userId,
      p_model_used: 'tavily-search',
      p_has_browsing: true,
      p_tokens_used: null
    });

    if (error) {
      console.error("Error logging browsing usage:", error);
    } else {
      console.log("✅ Browsing usage logged successfully");
    }
  } catch (error) {
    console.error("Error in incrementBrowsingUsage:", error);
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
    console.log("🧠 WAKTI AI V2 BRAIN: Processing with enhanced conversation context");
    console.log("🧠 Context details:", {
      historyLength: conversationHistory.length,
      activeTrigger,
      language
    });
    
    const apiKey = DEEPSEEK_API_KEY || OPENAI_API_KEY;
    const apiUrl = DEEPSEEK_API_KEY ? 'https://api.deepseek.com/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const model = DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';
    
    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة. تتخصص في المساعدة في المهام اليومية وتقديم معلومات دقيقة ومفيدة. 

تذكر دائماً سياق المحادثة السابق واربط إجاباتك بما تم مناقشته من قبل. إذا كان المستخدم يشير إلى شيء تم ذكره سابقاً، تأكد من ربط إجابتك بذلك السياق.

كن ودوداً ومفيداً ومختصراً في إجاباتك، واستخدم المعلومات السابقة لتقديم إجابات أكثر دقة وشخصية.`
      : `You are WAKTI, an advanced AI assistant. You specialize in helping with daily tasks and providing accurate, helpful information. 

Always remember the previous conversation context and connect your responses to what has been discussed before. If the user refers to something mentioned earlier, make sure to link your response to that context.

Be friendly, helpful, and concise in your responses, and use previous information to provide more accurate and personalized answers.`;
    
    // Build conversation messages with full context
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history (maintain chronological order)
    if (conversationHistory && conversationHistory.length > 0) {
      // Take last 30 messages to avoid token limits while maintaining good context
      const recentHistory = conversationHistory.slice(-30);
      
      for (const historyMessage of recentHistory) {
        messages.push({
          role: historyMessage.role,
          content: historyMessage.content
        });
      }
      
      console.log("🧠 Added conversation context:", recentHistory.length, "messages");
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
