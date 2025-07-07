
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get API keys
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');
const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');

console.log("🚀 WAKTI AI CLAUDE 4: Edge Function Starting - Mode-Based Architecture");

// Mode-based processing functions
async function processChatMode(message: string, userId: string, conversationId: string | null, language: string, attachedFiles: any[], maxTokens: number) {
  console.log("💬 CHAT MODE: Processing message");
  
  // Check for explicit task creation keywords ONLY
  const taskKeywords = {
    en: ['create task', 'make task', 'add task', 'new task', 'create reminder', 'make reminder', 'add reminder'],
    ar: ['أنشئ مهمة', 'اضف مهمة', 'مهمة جديدة', 'أنشئ تذكير', 'اضف تذكير']
  };
  
  const isTaskCreation = taskKeywords[language as 'en' | 'ar']?.some(keyword => 
    message.toLowerCase().includes(keyword.toLowerCase())
  ) || taskKeywords.en.some(keyword => 
    message.toLowerCase().includes(keyword.toLowerCase())
  );
  
  if (isTaskCreation) {
    console.log("📝 TASK CREATION: Detected explicit task keywords");
    return {
      response: language === 'ar' 
        ? '✅ تم اكتشاف طلب إنشاء مهمة. هل تريد المتابعة؟'
        : '✅ Task creation detected. Would you like to proceed?',
      intent: 'task_creation',
      needsConfirmation: true,
      taskCreationIntent: true
    };
  }
  
  // Load context ONLY if conversationId exists
  let contextMessages = [];
  let conversationSummary = '';
  
  if (conversationId) {
    console.log("🧠 CONTEXT: Loading for existing conversation");
    try {
      // Load recent messages
      const { data: recentMessages } = await supabase
        .from('ai_chat_history')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(6);
      
      if (recentMessages && recentMessages.length > 0) {
        contextMessages = recentMessages.reverse();
        console.log(`📚 CONTEXT: Loaded ${contextMessages.length} recent messages`);
      }
      
      // Load conversation summary
      const { data: summaryData } = await supabase
        .from('ai_conversation_summaries')
        .select('summary_text')
        .eq('conversation_id', conversationId)
        .maybeSingle();
      
      if (summaryData) {
        conversationSummary = summaryData.summary_text;
        console.log("📋 CONTEXT: Loaded conversation summary");
      }
    } catch (error) {
      console.warn("⚠️ CONTEXT: Failed to load context, continuing without it");
    }
  } else {
    console.log("🆕 NEW CONVERSATION: Skipping context loading");
  }
  
  // Call Claude 4 API
  return await callClaudeAPI(message, contextMessages, conversationSummary, language, attachedFiles, maxTokens);
}

async function processSearchMode(message: string, language: string) {
  console.log("🔍 SEARCH MODE: Processing search request");
  
  if (!TAVILY_API_KEY) {
    return {
      response: language === 'ar' 
        ? '❌ خدمة البحث غير متاحة حالياً'
        : '❌ Search service not available',
      error: 'Search service not configured'
    };
  }
  
  try {
    const searchResponse = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: message,
        search_depth: "basic",
        include_answer: true,
        max_results: 5
      })
    });
    
    if (!searchResponse.ok) {
      throw new Error(`Search API error: ${searchResponse.status}`);
    }
    
    const responseText = await searchResponse.text();
    if (!responseText?.trim()) {
      throw new Error('Empty search response');
    }
    
    let searchData;
    try {
      searchData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('❌ SEARCH JSON parsing error:', jsonError);
      throw new Error('Invalid search response format');
    }
    
    const searchResults = searchData.results || [];
    const searchAnswer = searchData.answer || '';
    
    // Call Claude with search context
    const searchContext = `Search results for "${message}":\n${searchAnswer}\n\nResults:\n${
      searchResults.map((r: any, i: number) => `${i + 1}. ${r.title}: ${r.content}`).join('\n')
    }`;
    
    return await callClaudeAPI(searchContext, [], '', language, [], 4096);
    
  } catch (error) {
    console.error('❌ SEARCH ERROR:', error);
    return {
      response: language === 'ar' 
        ? '❌ حدث خطأ أثناء البحث. حاول مرة أخرى.'
        : '❌ Search failed. Please try again.',
      error: error.message
    };
  }
}

async function processImageMode(message: string, userId: string, language: string) {
  console.log("🎨 IMAGE MODE: Processing image generation");
  
  if (!RUNWARE_API_KEY) {
    return {
      response: language === 'ar' 
        ? '❌ خدمة إنشاء الصور غير متاحة'
        : '❌ Image generation service not available',
      error: 'Image generation not configured'
    };
  }
  
  try {
    const taskUUID = crypto.randomUUID();
    
    const imageResponse = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          taskType: "authentication",
          apiKey: RUNWARE_API_KEY
        },
        {
          taskType: "imageInference",
          taskUUID: taskUUID,
          positivePrompt: message,
          width: 1024,
          height: 1024,
          model: "runware:100@1",
          numberResults: 1,
          outputFormat: "WEBP"
        }
      ])
    });
    
    if (!imageResponse.ok) {
      throw new Error(`Image API error: ${imageResponse.status}`);
    }
    
    const responseText = await imageResponse.text();
    if (!responseText?.trim()) {
      throw new Error('Empty image response');
    }
    
    let imageData;
    try {
      imageData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('❌ IMAGE JSON parsing error:', jsonError);
      throw new Error('Invalid image response format');
    }
    
    const imageResult = imageData.data?.find((item: any) => item.taskType === 'imageInference');
    
    if (imageResult?.imageURL) {
      return {
        response: language === 'ar' 
          ? '✅ تم إنشاء الصورة بنجاح!'
          : '✅ Image generated successfully!',
        imageUrl: imageResult.imageURL,
        success: true
      };
    } else {
      throw new Error('No image URL in response');
    }
    
  } catch (error) {
    console.error('❌ IMAGE ERROR:', error);
    return {
      response: language === 'ar' 
        ? '❌ فشل في إنشاء الصورة. حاول مرة أخرى.'
        : '❌ Image generation failed. Please try again.',
      error: error.message
    };
  }
}

async function callClaudeAPI(message: string, contextMessages: any[], conversationSummary: string, language: string, attachedFiles: any[], maxTokens: number) {
  console.log("🤖 CLAUDE 4: Making API call");
  
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Claude API not configured');
  }
  
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });
  
  const systemPrompt = language === 'ar'
    ? `أنت WAKTI AI، مساعد ذكي متقدم مدعوم بـ Claude 4. أنت مفيد ومتعاون وذكي. التاريخ اليوم: ${currentDate}. اجب بالعربية.`
    : `You are WAKTI AI, an advanced AI assistant powered by Claude 4. You are helpful, collaborative, and smart. Today's date: ${currentDate}. Respond in English.`;
  
  // Build messages array
  const messages = [];
  
  // Add conversation summary if available
  if (conversationSummary) {
    messages.push({
      role: "user",
      content: `Previous conversation context: ${conversationSummary}`
    });
  }
  
  // Add recent messages if available
  if (contextMessages.length > 0) {
    contextMessages.forEach(msg => {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      });
    });
  }
  
  // Add current message
  if (attachedFiles && attachedFiles.length > 0) {
    // Handle vision with images
    const messageContent = [{ type: 'text', text: message }];
    
    attachedFiles.forEach(file => {
      if (file.type?.startsWith('image/') && file.base64Data) {
        messageContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: file.type,
            data: file.base64Data
          }
        });
      }
    });
    
    messages.push({ role: 'user', content: messageContent });
  } else {
    messages.push({ role: 'user', content: message });
  }
  
  try {
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: messages
      }),
    });
    
    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      throw new Error(`Claude API error (${claudeResponse.status}): ${errorText}`);
    }
    
    const responseText = await claudeResponse.text();
    if (!responseText?.trim()) {
      throw new Error('Empty Claude response');
    }
    
    let claudeData;
    try {
      claudeData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('❌ CLAUDE JSON parsing error:', jsonError);
      throw new Error('Invalid Claude response format');
    }
    
    const aiResponse = claudeData.content?.[0]?.text || "Sorry, I couldn't generate a response.";
    
    return {
      response: aiResponse,
      model: 'claude-3-5-sonnet-20241022',
      success: true
    };
    
  } catch (error) {
    console.error('❌ CLAUDE ERROR:', error);
    
    // Fallback to DeepSeek if available
    if (DEEPSEEK_API_KEY) {
      console.log("🔄 FALLBACK: Trying DeepSeek");
      try {
        const fallbackResponse = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message }
            ],
            max_tokens: maxTokens,
            temperature: 0.7
          }),
        });
        
        if (fallbackResponse.ok) {
          const responseText = await fallbackResponse.text();
          if (responseText?.trim()) {
            try {
              const deepSeekData = JSON.parse(responseText);
              const fallbackText = deepSeekData.choices?.[0]?.message?.content;
              if (fallbackText) {
                return {
                  response: fallbackText,
                  model: 'deepseek-chat',
                  success: true,
                  fallbackUsed: true
                };
              }
            } catch (jsonError) {
              console.error('❌ DEEPSEEK JSON parsing error:', jsonError);
            }
          }
        }
      } catch (fallbackError) {
        console.error('❌ DEEPSEEK FALLBACK ERROR:', fallbackError);
      }
    }
    
    // Return user-friendly error
    return {
      response: language === 'ar' 
        ? '❌ عذراً، حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى.'
        : '❌ Sorry, I encountered an error processing your request. Please try again.',
      error: error.message,
      success: false
    };
  }
}

serve(async (req) => {
  console.log("📨 REQUEST RECEIVED:", req.method);

  try {
    // Parse request body with proper error handling
    let requestBody;
    try {
      const rawBody = await req.text();
      if (!rawBody?.trim()) {
        throw new Error('Empty request body');
      }
      requestBody = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("❌ JSON parsing error:", parseError);
      return new Response(JSON.stringify({
        error: "Invalid JSON in request body",
        success: false
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      activeTrigger = 'chat',
      attachedFiles = [],
      maxTokens = 4096
    } = requestBody;

    // Validate required parameters
    if (!message?.trim()) {
      return new Response(JSON.stringify({
        error: "Message is required",
        success: false
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({
        error: "User ID is required",
        success: false
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log(`🎯 MODE: ${activeTrigger.toUpperCase()}`);
    console.log(`📝 MESSAGE: ${message.substring(0, 100)}...`);

    // MODE-BASED PROCESSING - COMPLETELY SEPARATE PATHS
    let result;
    
    switch (activeTrigger) {
      case 'chat':
        result = await processChatMode(message, userId, conversationId, language, attachedFiles, maxTokens);
        break;
        
      case 'search':
        result = await processSearchMode(message, language);
        break;
        
      case 'image':
        result = await processImageMode(message, userId, language);
        break;
        
      default:
        console.warn(`⚠️ UNKNOWN MODE: ${activeTrigger}, defaulting to chat`);
        result = await processChatMode(message, userId, conversationId, language, attachedFiles, maxTokens);
    }

    // Generate conversation ID if needed
    const finalConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare final response
    const finalResponse = {
      response: result.response,
      conversationId: finalConversationId,
      intent: result.intent || activeTrigger,
      confidence: 'high',
      actionTaken: result.actionTaken || null,
      imageUrl: result.imageUrl || null,
      browsingUsed: activeTrigger === 'search',
      browsingData: null,
      needsConfirmation: result.needsConfirmation || false,
      pendingTaskData: result.taskCreationIntent ? { title: message } : null,
      pendingReminderData: null,
      success: result.success !== false,
      processingTime: Date.now(),
      aiProvider: result.model || 'claude-3-5-sonnet-20241022',
      claude4Enabled: true,
      mode: activeTrigger,
      fallbackUsed: result.fallbackUsed || false
    };

    console.log(`✅ ${activeTrigger.toUpperCase()} MODE: Request completed successfully!`);

    return new Response(JSON.stringify(finalResponse), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🚨 Critical error:", error);

    const errorResponse = {
      error: "Internal server error",
      success: false,
      timestamp: new Date().toISOString(),
      details: error.message
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
