import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get API keys
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');
const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');

console.log("🚀 WAKTI AI V2: HYBRID SMART MEMORY + HAIKU SPEED (4x Faster)");

serve(async (req) => {
  console.log("📨 REQUEST RECEIVED:", {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  try {
    // ENHANCED JSON PARSING with better error handling
    let requestBody;
    const contentType = req.headers.get('content-type') || '';
    
    console.log("📋 CONTENT TYPE:", contentType);
    
    if (!contentType.includes('application/json')) {
      console.error("❌ INVALID CONTENT TYPE:", contentType);
      return new Response(JSON.stringify({
        error: "Content-Type must be application/json",
        success: false
      }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Get the raw body text first
    let rawBodyText;
    try {
      rawBodyText = await req.text();
      console.log("📝 RAW BODY LENGTH:", rawBodyText?.length || 0);
    } catch (textError) {
      console.error("❌ FAILED TO READ REQUEST BODY:", textError);
      return new Response(JSON.stringify({
        error: "Failed to read request body",
        success: false,
        details: textError.message
      }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Check if body is empty
    if (!rawBodyText || rawBodyText.trim() === '') {
      console.error("❌ EMPTY REQUEST BODY DETECTED");
      return new Response(JSON.stringify({
        error: "Request body is empty",
        success: false,
        help: "Please send a JSON payload with message and userId"
      }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Parse JSON safely
    try {
      requestBody = JSON.parse(rawBodyText);
      console.log("✅ JSON PARSED SUCCESSFULLY");
      console.log("📊 REQUEST BODY KEYS:", Object.keys(requestBody || {}));
    } catch (jsonError) {
      console.error("❌ JSON PARSING ERROR:", jsonError);
      console.error("❌ PROBLEMATIC JSON:", rawBodyText.substring(0, 500));
      return new Response(JSON.stringify({
        error: "Invalid JSON format",
        success: false,
        details: jsonError.message,
        receivedBody: rawBodyText.substring(0, 200)
      }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Extract and validate required parameters
    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      activeTrigger = 'chat',
      attachedFiles = [],
      maxTokens = 4096,
      recentMessages = [],
      conversationSummary = '',
      personalTouch = null
    } = requestBody || {};

    console.log("🎯 EXTRACTED PARAMS:", {
      hasMessage: !!message,
      hasUserId: !!userId,
      language,
      activeTrigger,
      messageLength: message?.length || 0,
      recentMessagesCount: recentMessages.length,
      hasPersonalTouch: !!personalTouch
    });

    // Validate required parameters
    if (!message?.trim()) {
      console.error("❌ MISSING OR EMPTY MESSAGE");
      return new Response(JSON.stringify({
        error: "Message is required and cannot be empty",
        success: false
      }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (!userId) {
      console.error("❌ MISSING USER ID");
      return new Response(JSON.stringify({
        error: "User ID is required",
        success: false
      }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    console.log(`🎯 MODE: ${activeTrigger.toUpperCase()}`);
    console.log(`📝 MESSAGE: ${message.substring(0, 100)}...`);

    let result;
    const finalConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // MODE-BASED PROCESSING with HYBRID MEMORY
    switch (activeTrigger) {
      case 'search':
        result = await processSearchMode(message, language, recentMessages, personalTouch);
        break;
        
      case 'image':
        result = await processImageMode(message, userId, language, attachedFiles, personalTouch);
        break;
        
      default: // chat mode
        result = await processChatMode(message, userId, conversationId, language, attachedFiles, maxTokens, recentMessages, conversationSummary, personalTouch);
    }

    // Prepare final response
    const finalResponse = {
      response: result.response || 'Response received',
      conversationId: finalConversationId,
      intent: activeTrigger,
      confidence: 'high',
      actionTaken: null,
      imageUrl: result.imageUrl || null,
      browsingUsed: activeTrigger === 'search',
      browsingData: null,
      needsConfirmation: false,
      pendingTaskData: null,
      pendingReminderData: null,
      success: result.success !== false,
      processingTime: Date.now(),
      aiProvider: 'claude-3-5-haiku-20241022', // UPGRADED TO HAIKU (4x faster)
      claude4Enabled: false,
      mode: activeTrigger,
      fallbackUsed: false
    };

    console.log(`✅ ${activeTrigger.toUpperCase()} MODE: HAIKU-POWERED request completed successfully!`);

    return new Response(JSON.stringify(finalResponse), {
      headers: { 
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error("🚨 CRITICAL ERROR:", error);
    console.error("🚨 ERROR STACK:", error.stack);

    const errorResponse = {
      error: "Internal server error",
      response: language === 'ar' 
        ? 'عذراً، حدث خطأ. حاول مرة أخرى.'
        : 'Sorry, an error occurred. Please try again.',
      success: false,
      timestamp: new Date().toISOString(),
      details: error.message
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});

// ENHANCED CHAT MODE with HYBRID MEMORY
async function processChatMode(message: string, userId: string, conversationId: string | null, language: string, attachedFiles: any[], maxTokens: number, recentMessages: any[], conversationSummary: string, personalTouch: any) {
  console.log("💬 CHAT MODE: Processing with HAIKU (4x faster) + HYBRID MEMORY");
  
  if (!ANTHROPIC_API_KEY) {
    return {
      response: language === 'ar' 
        ? '❌ خدمة الذكي الاصطناعي غير متاحة'
        : '❌ AI service not available',
      error: 'Claude API not configured',
      success: false
    };
  }

  // HYBRID MEMORY: Use provided context or load from database
  let contextMessages = recentMessages || [];
  
  if (conversationId && contextMessages.length === 0) {
    try {
      // Load recent messages from database as fallback
      const { data: dbMessages } = await supabase
        .from('ai_chat_history')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(4);
      
      if (dbMessages && dbMessages.length > 0) {
        contextMessages = dbMessages.reverse();
        console.log(`📚 HYBRID MEMORY: Loaded ${contextMessages.length} messages from database`);
      }
    } catch (error) {
      console.warn("⚠️ HYBRID MEMORY: Database fallback failed, using session context");
    }
  }
  
  console.log(`🧠 HYBRID MEMORY: Using ${contextMessages.length} context messages`);
  
  return await callHaikuAPI(message, contextMessages, conversationSummary, language, attachedFiles, maxTokens, personalTouch);
}

// ENHANCED SEARCH MODE with HYBRID MEMORY
async function processSearchMode(message: string, language: string, recentMessages: any[], personalTouch: any) {
  console.log("🔍 SEARCH MODE: Processing with HAIKU + HYBRID MEMORY");
  
  if (!TAVILY_API_KEY) {
    return {
      response: language === 'ar' 
        ? '❌ خدمة البحث غير متاحة حالياً'
        : '❌ Search service not available',
      error: 'Search service not configured',
      success: false
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
        max_results: 3
      })
    });
    
    if (!searchResponse.ok) {
      throw new Error(`Search API error: ${searchResponse.status}`);
    }
    
    const searchData = await searchResponse.json();
    const searchResults = searchData.results || [];
    const searchAnswer = searchData.answer || '';
    
    // Call HAIKU with search context
    const searchContext = `Search results for "${message}":\n${searchAnswer}\n\nResults:\n${
      searchResults.map((r: any, i: number) => `${i + 1}. ${r.title}: ${r.content}`).join('\n')
    }`;
    
    return await callHaikuAPI(searchContext, recentMessages, '', language, [], 4096, personalTouch);
    
  } catch (error) {
    console.error('❌ SEARCH ERROR:', error);
    return {
      response: language === 'ar' 
        ? '❌ حدث خطأ أثناء البحث. حاول مرة أخرى.'
        : '❌ Search failed. Please try again.',
      error: error.message,
      success: false
    };
  }
}

// ENHANCED IMAGE MODE with VISION
async function processImageMode(message: string, userId: string, language: string, attachedFiles: any[], personalTouch: any) {
  console.log("🎨 IMAGE MODE: Processing with RUNWARE + HAIKU VISION");
  
  // If there are attached images, use HAIKU for vision analysis
  if (attachedFiles && attachedFiles.length > 0) {
    console.log("👁️ VISION: Analyzing uploaded images with HAIKU");
    return await callHaikuAPI(message, [], '', language, attachedFiles, 4096, personalTouch);
  }
  
  // Otherwise, generate image with RUNWARE
  if (!RUNWARE_API_KEY) {
    return {
      response: language === 'ar' 
        ? '❌ خدمة إنشاء الصور غير متاحة'
        : '❌ Image generation service not available',
      error: 'Image generation not configured',
      success: false
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
    
    const imageData = await imageResponse.json();
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
      error: error.message,
      success: false
    };
  }
}

// UPGRADED HAIKU API CALL (4x Faster + Full Vision + Personalization)
async function callHaikuAPI(message: string, contextMessages: any[], conversationSummary: string, language: string, attachedFiles: any[], maxTokens: number, personalTouch: any) {
  console.log("🚀 HAIKU API: Making ultra-fast call with HYBRID MEMORY");
  
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });
  
  // ENHANCED SYSTEM PROMPT with PERSONALIZATION
  let systemPrompt = language === 'ar'
    ? `أنت WAKTI AI، مساعد ذكي متقدم يعمل بنموذج Claude 3.5 Haiku فائق السرعة. أنت مفيد ومتعاون وذكي. التاريخ اليوم: ${currentDate}. اجب بالعربية.`
    : `You are WAKTI AI, an advanced AI assistant powered by Claude 3.5 Haiku for ultra-fast responses. You are helpful, collaborative, and smart. Today's date: ${currentDate}. Respond in English.`;

  // APPLY PERSONALIZATION
  if (personalTouch && personalTouch.instruction) {
    systemPrompt += `\n\nPersonalization: ${personalTouch.instruction}`;
    if (personalTouch.tone) systemPrompt += ` Use a ${personalTouch.tone} tone.`;
    if (personalTouch.style) systemPrompt += ` Reply in ${personalTouch.style} style.`;
  }

  // HYBRID MEMORY: Build comprehensive context
  const messages = [];
  
  // Add conversation summary if available
  if (conversationSummary && conversationSummary.trim()) {
    messages.push({
      role: 'assistant',
      content: `[Previous conversation context: ${conversationSummary}]`
    });
  }
  
  // Add recent messages from HYBRID MEMORY
  if (contextMessages.length > 0) {
    contextMessages.forEach(msg => {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      });
    });
  }
  
  // Add current message with vision support
  let currentMessage: any = { role: 'user', content: message };
  
  // VISION SUPPORT: Add image content if files attached
  if (attachedFiles && attachedFiles.length > 0) {
    const imageFile = attachedFiles.find(file => file.type?.startsWith('image/'));
    if (imageFile && imageFile.url) {
      currentMessage.content = [
        { type: 'text', text: message },
        { type: 'image', source: { type: 'base64', media_type: imageFile.type, data: imageFile.url } }
      ];
      console.log("👁️ VISION: Added image to HAIKU request");
    }
  }
  
  messages.push(currentMessage);
  
  try {
    console.log(`🚀 HAIKU: Sending ${messages.length} messages to ultra-fast model`);
    
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022', // HAIKU MODEL (4x faster)
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: messages
      }),
    });
    
    if (!claudeResponse.ok) {
      throw new Error(`HAIKU API error: ${claudeResponse.status}`);
    }
    
    const claudeData = await claudeResponse.json();
    let aiResponse = claudeData.content?.[0]?.text || "Sorry, I couldn't generate a response.";
    
    // APPLY PERSONALIZATION POST-PROCESSING
    if (personalTouch) {
      aiResponse = applyPersonalization(aiResponse, personalTouch, language);
    }
    
    console.log("🚀 HAIKU: Ultra-fast response generated successfully!");
    
    return {
      response: aiResponse,
      model: 'claude-3-5-haiku-20241022',
      success: true
    };
    
  } catch (error) {
    console.error('❌ HAIKU ERROR:', error);
    
    return {
      response: language === 'ar' 
        ? '❌ عذراً، حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى.'
        : '❌ Sorry, I encountered an error processing your request. Please try again.',
      error: error.message,
      success: false
    };
  }
}

// PERSONALIZATION ENHANCEMENT
function applyPersonalization(response: string, personalTouch: any, language: string): string {
  let enhancedResponse = response;
  
  // Add nickname if provided (80% chance for consistency)
  if (personalTouch.nickname && personalTouch.nickname.trim() && Math.random() < 0.8) {
    if (!enhancedResponse.toLowerCase().includes(personalTouch.nickname.toLowerCase())) {
      const greetings = language === 'ar' ? [
        `${personalTouch.nickname}، `,
        `أهلاً ${personalTouch.nickname}! `
      ] : [
        `${personalTouch.nickname}, `,
        `Hey ${personalTouch.nickname}! `
      ];
      const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
      enhancedResponse = randomGreeting + enhancedResponse;
    }
  }
  
  // Add AI nickname signature occasionally
  if (personalTouch.aiNickname && Math.random() < 0.2) {
    const signature = language === 'ar' 
      ? `\n\n- ${personalTouch.aiNickname} 🤖`
      : `\n\n- ${personalTouch.aiNickname} 🤖`;
    enhancedResponse += signature;
  }
  
  return enhancedResponse;
}
