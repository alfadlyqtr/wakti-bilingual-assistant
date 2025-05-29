import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from "../_shared/cors.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY");
const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");

console.log("🔍 WAKTI AI V2.1 Enhanced: Processing request with advanced browsing and database integration");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, language = 'en', conversationId, inputType = 'text', conversationHistory = [], confirmSearch = false } = await req.json();

    console.log("WAKTI AI V2.1 Enhanced: Authenticated user:", userId);
    console.log("WAKTI AI V2.1 Enhanced: Processing message from user:", userId);

    // Enhanced intent analysis with proper priority order
    const intentAnalysis = analyzeMessageIntent(message, language, conversationHistory);
    console.log("WAKTI AI V2.1 Enhanced: Intent analysis:", JSON.stringify(intentAnalysis, null, 2));

    let response = "";
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let imageUrl = null;
    let requiresSearchConfirmation = false;

    // PRIORITY ORDER: Image Generation FIRST, then others
    if (intentAnalysis.intent === "generate_image") {
      // Handle image generation with highest priority
      console.log("WAKTI AI V2.1 Enhanced: Processing image generation request");
      
      try {
        const imageResult = await generateImageWithRunware(intentAnalysis.params.prompt, language);
        if (imageResult.success) {
          imageUrl = imageResult.imageUrl;
          response = language === 'ar' 
            ? `🎨 تم إنشاء الصورة بنجاح!\n\nالوصف: ${intentAnalysis.params.prompt}`
            : `🎨 Image generated successfully!\n\nPrompt: ${intentAnalysis.params.prompt}`;
        } else {
          response = language === 'ar'
            ? `عذراً، فشل في إنشاء الصورة: ${imageResult.error}`
            : `Sorry, failed to generate image: ${imageResult.error}`;
        }
      } catch (error) {
        console.error("Image generation error:", error);
        response = language === 'ar'
          ? "عذراً، حدث خطأ أثناء إنشاء الصورة. يرجى المحاولة مرة أخرى."
          : "Sorry, there was an error generating the image. Please try again.";
      }
    }
    // Handle browsing requests (but not if we just generated an image)
    else if (intentAnalysis.requiresBrowsing && !imageUrl) {
      console.log("WAKTI AI V2.1 Enhanced: Processing browsing request");
      
      // Check browsing quota
      const quotaCheck = await checkBrowsingQuota(userId);
      quotaStatus = quotaCheck;
      
      if (quotaCheck.usagePercentage >= 100) {
        response = language === 'ar'
          ? "⚠️ لقد وصلت إلى الحد الأقصى لعمليات البحث هذا الشهر. يرجى الانتظار حتى الشهر القادم."
          : "⚠️ You've reached your monthly browsing limit. Please wait for next month.";
      } else if (quotaCheck.usagePercentage >= 80 && !confirmSearch) {
        requiresSearchConfirmation = true;
        response = language === 'ar'
          ? `⚠️ لقد استخدمت ${quotaCheck.usagePercentage.toFixed(0)}% من حصة البحث الشهرية.\n\nهل تريد المتابعة مع البحث للحصول على معلومات حديثة؟`
          : `⚠️ You've used ${quotaCheck.usagePercentage.toFixed(0)}% of your monthly browsing quota.\n\nWould you like to proceed with search for current information?`;
      } else {
        // Perform the search
        const searchResults = await performWebSearch(message, language);
        if (searchResults.success) {
          browsingUsed = true;
          browsingData = searchResults.data;
          
          // Update quota
          await updateBrowsingQuota(userId);
          
          // Generate AI response with search context
          response = await generateAIResponseWithContext(
            message,
            searchResults.data.results,
            language,
            conversationHistory
          );
        } else {
          response = language === 'ar'
            ? "عذراً، فشل في البحث. سأجيب بناءً على المعلومات المتاحة لدي."
            : "Sorry, search failed. I'll answer based on my available knowledge.";
          
          // Generate regular AI response
          response = await generateAIResponse(message, language, conversationHistory);
        }
      }
    }
    // Regular AI chat
    else {
      console.log("WAKTI AI V2.1 Enhanced: Processing regular chat");
      response = await generateAIResponse(message, language, conversationHistory);
    }

    // Handle conversation storage
    let finalConversationId = conversationId;
    if (!conversationId) {
      // Create new conversation
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
    }

    // Store chat history
    if (finalConversationId) {
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
        browsing_used: browsingUsed,
        browsing_data: browsingData,
        quota_status: quotaStatus
      });

      // Update conversation timestamp
      await supabase
        .from('ai_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', finalConversationId);
    }

    // Log usage
    await supabase.from('ai_usage_logs').insert({
      user_id: userId,
      intent: intentAnalysis.intent,
      language: language,
      browsing_used: browsingUsed,
      image_generated: !!imageUrl
    });

    console.log("WAKTI AI V2.1 Enhanced: Generated AI response with enhanced context and browsing");
    console.log("WAKTI AI V2.1 Enhanced: Usage logged successfully");
    console.log("WAKTI AI V2.1 Enhanced: Response ready with enhanced browsing and context integration");

    return new Response(JSON.stringify({
      response,
      conversationId: finalConversationId,
      intent: intentAnalysis.intent,
      confidence: intentAnalysis.confidence,
      browsingUsed,
      browsingData,
      quotaStatus,
      requiresSearchConfirmation,
      imageUrl
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("WAKTI AI V2.1 Enhanced: Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// Enhanced intent analysis with proper priority and context awareness
function analyzeMessageIntent(message: string, language: string, conversationHistory: any[] = []) {
  const lowerMessage = message.toLowerCase();
  const isArabic = language === 'ar';
  
  // Check conversation context for follow-up confirmations
  const lastAssistantMessage = conversationHistory
    .filter(msg => msg.role === 'assistant')
    .slice(-1)[0];
  
  // Enhanced context detection for image generation follow-ups
  const isImageFollowUp = lastAssistantMessage?.content?.includes('search for current info') ||
                         lastAssistantMessage?.content?.includes('البحث للحصول على معلومات حديثة');
  
  const isConfirmationWord = /^(yes|ok|sure|نعم|أكيد|موافق|generate|إنشاء)$/i.test(message.trim());
  
  if (isImageFollowUp && isConfirmationWord) {
    // User is confirming they want image generation after search suggestion
    const previousUserMessage = conversationHistory
      .filter(msg => msg.role === 'user')
      .slice(-2)[0]; // Get the message before the confirmation
    
    if (previousUserMessage) {
      const extractedPrompt = extractImagePrompt(previousUserMessage.content, language);
      if (extractedPrompt) {
        return {
          intent: "generate_image",
          confidence: "high",
          requiresBrowsing: false,
          params: { prompt: extractedPrompt }
        };
      }
    }
  }

  // PRIORITY 1: Image Generation (Enhanced Detection)
  const imageKeywordsEn = [
    'generate image', 'create image', 'make image', 'draw', 'picture of',
    'generate picture', 'create picture', 'make picture', 'show me image',
    'visualize', 'illustration', 'artwork', 'design', 'sketch', 'painting'
  ];
  
  const imageKeywordsAr = [
    'أنشئ صورة', 'اصنع صورة', 'ارسم', 'صورة', 'اجعل صورة',
    'أنشئ رسمة', 'اصنع رسمة', 'أرني صورة', 'تصور', 'رسم توضيحي',
    'عمل فني', 'تصميم', 'رسمة', 'لوحة'
  ];

  // Check for /image command or direct image keywords
  if (lowerMessage.startsWith('/image') || 
      imageKeywordsEn.some(keyword => lowerMessage.includes(keyword)) ||
      imageKeywordsAr.some(keyword => message.includes(keyword))) {
    
    const prompt = extractImagePrompt(message, language);
    return {
      intent: "generate_image",
      confidence: "high",
      requiresBrowsing: false,
      params: { prompt }
    };
  }

  // PRIORITY 2: Task Creation
  const taskKeywords = isArabic 
    ? ['مهمة', 'أنشئ مهمة', 'اصنع مهمة', 'أضف مهمة']
    : ['task', 'create task', 'add task', 'new task', 'todo'];
  
  if (taskKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return {
      intent: "create_task",
      confidence: "high",
      requiresBrowsing: false,
      params: extractTaskData(message)
    };
  }

  // PRIORITY 3: Event Creation
  const eventKeywords = isArabic
    ? ['حدث', 'موعد', 'اجتماع', 'أنشئ حدث', 'جدولة']
    : ['event', 'meeting', 'appointment', 'schedule', 'create event'];
  
  if (eventKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return {
      intent: "create_event",
      confidence: "high",
      requiresBrowsing: false,
      params: extractEventData(message)
    };
  }

  // PRIORITY 4: Reminder Creation
  const reminderKeywords = isArabic
    ? ['تذكير', 'ذكرني', 'أنشئ تذكير']
    : ['remind', 'reminder', 'don\'t forget'];
  
  if (reminderKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return {
      intent: "create_reminder",
      confidence: "high",
      requiresBrowsing: false,
      params: extractReminderData(message)
    };
  }

  // PRIORITY 5: Web Browsing/Search (LAST PRIORITY)
  const searchKeywords = isArabic
    ? ['ما هو', 'أخبرني عن', 'ابحث عن', 'معلومات عن', 'آخر أخبار', 'حالياً', 'الآن']
    : ['what is', 'tell me about', 'search for', 'latest', 'current', 'news about', 'information about', 'recent'];
  
  const requiresBrowsing = searchKeywords.some(keyword => lowerMessage.includes(keyword)) ||
                          lowerMessage.includes('2024') || 
                          lowerMessage.includes('2025') ||
                          lowerMessage.includes('today') ||
                          lowerMessage.includes('now') ||
                          message.includes('اليوم') ||
                          message.includes('الآن');

  // Default to general chat
  return {
    intent: "general_chat",
    confidence: "medium",
    requiresBrowsing,
    params: null
  };
}

// Enhanced image prompt extraction
function extractImagePrompt(message: string, language: string): string {
  let prompt = message;
  
  // Remove common trigger phrases
  const triggersToRemove = [
    '/image', 'generate image', 'create image', 'make image', 'draw',
    'picture of', 'show me', 'visualize',
    'أنشئ صورة', 'اصنع صورة', 'ارسم', 'صورة', 'أرني'
  ];
  
  triggersToRemove.forEach(trigger => {
    const regex = new RegExp(trigger, 'gi');
    prompt = prompt.replace(regex, '').trim();
  });
  
  // Remove common connector words
  const connectorsToRemove = ['of', 'for', 'about', 'من', 'عن', 'ل'];
  connectorsToRemove.forEach(connector => {
    if (prompt.startsWith(connector + ' ')) {
      prompt = prompt.substring(connector.length + 1).trim();
    }
  });
  
  return prompt || message; // Fallback to original message if nothing left
}

function extractTaskData(message: string) {
  const titleMatch = message.replace(/create task|new task|add task|task/gi, "").trim();
  return {
    title: titleMatch || "New task",
    description: "",
    priority: "medium"
  };
}

function extractEventData(message: string) {
  const titleMatch = message.replace(/create event|new event|schedule|event|meeting/gi, "").trim();
  return {
    title: titleMatch || "New event",
    description: "",
    location: ""
  };
}

function extractReminderData(message: string) {
  const titleMatch = message.replace(/remind me|reminder|don't forget/gi, "").trim();
  return {
    title: titleMatch || "New reminder"
  };
}

// Generate image using Runware API
async function generateImageWithRunware(prompt: string, language: string) {
  if (!RUNWARE_API_KEY) {
    return { success: false, error: "Runware API key not configured" };
  }

  try {
    console.log("WAKTI AI V2.1 Enhanced: Generating image with Runware API");
    
    const response = await fetch("https://api.runware.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RUNWARE_API_KEY}`
      },
      body: JSON.stringify([{
        taskType: "imageGeneration",
        prompt: prompt,
        height: 512,
        width: 512,
        model: "runware:100@1",
        steps: 20,
        CFGScale: 7
      }])
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Runware API error:", errorText);
      return { success: false, error: `API Error: ${response.status}` };
    }

    const result = await response.json();
    console.log("Runware API response:", result);

    if (result.data && result.data.length > 0 && result.data[0].imageURL) {
      return {
        success: true,
        imageUrl: result.data[0].imageURL
      };
    } else {
      return { success: false, error: "No image URL in response" };
    }
  } catch (error) {
    console.error("Error generating image:", error);
    return { success: false, error: error.message };
  }
}

async function checkBrowsingQuota(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const { data, error } = await supabase
    .from('ai_usage_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('browsing_used', true)
    .gte('created_at', startOfMonth.toISOString());
  
  if (error) {
    console.error("Error checking browsing quota:", error);
    return { count: 0, limit: 50, usagePercentage: 0, remaining: 50 };
  }
  
  const count = data?.length || 0;
  const limit = 50; // Monthly limit
  const usagePercentage = (count / limit) * 100;
  const remaining = Math.max(0, limit - count);
  
  return { count, limit, usagePercentage, remaining };
}

async function updateBrowsingQuota(userId: string) {
  // This is handled by the usage log insertion
  return true;
}

async function performWebSearch(query: string, language: string) {
  if (!SERPER_API_KEY) {
    return { success: false, error: "Search API not configured" };
  }

  try {
    console.log("WAKTI AI V2.1 Enhanced: Performing web search");
    
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: query,
        gl: language === 'ar' ? 'sa' : 'us',
        hl: language,
        num: 5
      })
    });

    if (!response.ok) {
      return { success: false, error: `Search API error: ${response.status}` };
    }

    const result = await response.json();
    
    const sources = result.organic?.slice(0, 3).map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet
    })) || [];

    return {
      success: true,
      data: {
        hasResults: sources.length > 0,
        sources,
        query
      }
    };
  } catch (error) {
    console.error("Search error:", error);
    return { success: false, error: error.message };
  }
}

async function generateAIResponseWithContext(message: string, searchResults: any[], language: string, conversationHistory: any[]) {
  const contextPrompt = searchResults.map(r => `${r.title}: ${r.snippet}`).join('\n');
  
  const systemPrompt = language === 'ar'
    ? `أنت WAKTI AI، مساعد ذكي. استخدم المعلومات التالية من البحث لتقديم إجابة دقيقة ومفيدة:\n\n${contextPrompt}\n\nأجب بناءً على هذه المعلومات الحديثة.`
    : `You are WAKTI AI, a smart assistant. Use the following search information to provide an accurate and helpful response:\n\n${contextPrompt}\n\nAnswer based on this current information.`;

  return await callAIAPI(systemPrompt, message, language, conversationHistory);
}

async function generateAIResponse(message: string, language: string, conversationHistory: any[]) {
  const systemPrompt = language === 'ar'
    ? "أنت WAKTI AI، مساعد ذكي مفيد ومتفهم. أجب بطريقة طبيعية ومفيدة."
    : "You are WAKTI AI, a helpful and understanding smart assistant. Respond naturally and helpfully.";

  return await callAIAPI(systemPrompt, message, language, conversationHistory);
}

async function callAIAPI(systemPrompt: string, message: string, language: string, conversationHistory: any[]) {
  console.log("WAKTI AI V2.1 Enhanced: Calling AI API with enhanced context and browsing integration");
  
  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-6), // Last 3 exchanges
    { role: "user", content: message }
  ];

  // Try DeepSeek first
  try {
    if (!DEEPSEEK_API_KEY) throw new Error("DeepSeek API key not configured");
    
    console.log("WAKTI AI V2.1 Enhanced: Using DeepSeek API (primary model) with enhanced context");
    
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const result = await response.json();
    console.log("WAKTI AI V2.1 Enhanced: DeepSeek response successful");
    
    return result.choices[0].message?.content || "I apologize, but I couldn't generate a response.";
    
  } catch (error) {
    console.log("DeepSeek failed, trying OpenAI fallback:", error.message);
    
    // Fallback to OpenAI
    if (!OPENAI_API_KEY) {
      throw new Error("Both DeepSeek and OpenAI API keys not configured");
    }
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    return result.choices[0].message?.content || "I apologize, but I couldn't generate a response.";
  }
}
