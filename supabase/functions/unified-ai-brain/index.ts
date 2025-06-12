
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

console.log("🔍 UNIFIED AI BRAIN: Function loaded with simplified search system");

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
    console.log("🔍 UNIFIED AI BRAIN: Processing request with user isolation");

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
      activeTrigger = 'chat'
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

    // SIMPLIFIED: Only 3 trigger types now - chat, search (unlimited), enhanced_search (5/month), image
    switch (activeTrigger) {
      case 'search':
        // Basic search - unlimited, just increment counter for tracking
        if (intent.allowed) {
          await incrementRegularSearchUsage(user.id);
          response = await processWithAI(message, null, language);
        } else {
          response = language === 'ar' 
            ? `⚠️ أنت في وضع البحث الأساسي\n\nهذا الوضع مخصص للأسئلة العامة.\n\nللبحث المتقدم مع التصفح، انتقل إلى وضع البحث المحسن.`
            : `⚠️ You're in Basic Search Mode\n\nThis mode is for general questions.\n\nFor web browsing, switch to Enhanced Search mode.`;
        }
        quotaStatus = { type: 'regular_search', unlimited: true };
        break;

      case 'enhanced_search':
        // Enhanced search with web browsing - 5/month quota
        if (intent.allowed) {
          const canUseEnhanced = await checkEnhancedSearchQuota(user.id);
          if (canUseEnhanced.canUse) {
            await incrementEnhancedSearchUsage(user.id);
            const searchResult = await executeEnhancedSearch(message, language);
            if (searchResult.success) {
              browsingUsed = true;
              browsingData = searchResult.data;
              response = await processWithAI(message, searchResult.context, language);
            } else {
              response = await processWithAI(message, null, language);
            }
            quotaStatus = canUseEnhanced.quotaStatus;
          } else {
            response = language === 'ar' 
              ? `🚫 تم الوصول للحد الأقصى من البحث المحسن\n\nلقد استخدمت ${canUseEnhanced.quotaStatus.used}/${canUseEnhanced.quotaStatus.limit} من بحثاتك المحسنة هذا الشهر.\n\nيمكنك استخدام البحث الأساسي (غير محدود) أو شراء بحثات إضافية.`
              : `🚫 Enhanced Search Limit Reached\n\nYou've used ${canUseEnhanced.quotaStatus.used}/${canUseEnhanced.quotaStatus.limit} enhanced searches this month.\n\nYou can use basic search (unlimited) or purchase extra searches.`;
            quotaStatus = canUseEnhanced.quotaStatus;
          }
        } else {
          response = language === 'ar' 
            ? `⚠️ أنت في وضع البحث المحسن\n\nهذا الوضع مخصص للبحث مع التصفح.\n\nللدردشة العامة، انتقل إلى وضع المحادثة.`
            : `⚠️ You're in Enhanced Search Mode\n\nThis mode is for search with web browsing.\n\nFor general chat, switch to Chat mode.`;
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
        response = await processWithAI(message, null, language);
        break;
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
      needsConfirmation: false,
      needsClarification: false,
      success: true
    };

    console.log("🔍 UNIFIED AI BRAIN: Sending real AI response for user:", user.id);

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

// SIMPLIFIED: Enhanced search quota checking (uses the old advanced search quota)
async function checkEnhancedSearchQuota(userId: string) {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const MAX_MONTHLY_ENHANCED_SEARCHES = 5;

    // Get or create current month's quota record
    const { data, error } = await supabase
      .from('user_search_quotas')
      .select('daily_count, extra_advanced_searches')
      .eq('user_id', userId)
      .eq('monthly_date', currentMonth)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Error checking enhanced search quota:", error);
      return { canUse: true, quotaStatus: { used: 0, limit: 5, remaining: 5 } };
    }

    let usedCount = 0;
    let extraSearches = 0;

    if (data) {
      usedCount = data.daily_count || 0; // This represents monthly enhanced searches
      extraSearches = data.extra_advanced_searches || 0;
    } else {
      // Create new record for this month
      await supabase
        .from('user_search_quotas')
        .insert({
          user_id: userId,
          monthly_date: currentMonth,
          daily_count: 0, // Used for enhanced search monthly counter
          regular_search_count: 0,
          extra_regular_searches: 0,
          extra_advanced_searches: 0
        });
    }

    const totalAvailable = MAX_MONTHLY_ENHANCED_SEARCHES + extraSearches;
    const canUse = usedCount < totalAvailable;

    return {
      canUse,
      quotaStatus: {
        used: usedCount,
        limit: MAX_MONTHLY_ENHANCED_SEARCHES,
        extra: extraSearches,
        remaining: Math.max(0, totalAvailable - usedCount)
      }
    };
  } catch (error) {
    console.error("Error in checkEnhancedSearchQuota:", error);
    return { canUse: true, quotaStatus: { used: 0, limit: 5, remaining: 5 } };
  }
}

// SIMPLIFIED: Enhanced search usage increment
async function incrementEnhancedSearchUsage(userId: string) {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const { error } = await supabase
      .from('user_search_quotas')
      .update({
        daily_count: supabase.sql`daily_count + 1`, // Using daily_count for monthly enhanced searches
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('monthly_date', currentMonth);

    if (error) {
      console.error("Error incrementing enhanced search usage:", error);
    } else {
      console.log("✅ Enhanced search usage incremented");
    }
  } catch (error) {
    console.error("Error in incrementEnhancedSearchUsage:", error);
  }
}

// SIMPLIFIED: Regular search usage increment (just for tracking)
async function incrementRegularSearchUsage(userId: string) {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const { error } = await supabase
      .from('user_search_quotas')
      .update({
        regular_search_count: supabase.sql`regular_search_count + 1`,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('monthly_date', currentMonth);

    if (error) {
      console.error("Error incrementing regular search usage:", error);
    } else {
      console.log("✅ Regular search usage logged");
    }
  } catch (error) {
    console.error("Error in incrementRegularSearchUsage:", error);
  }
}

// ENHANCED: Better search function with multiple chunks and richer context
async function executeEnhancedSearch(query: string, language: string = 'en') {
  try {
    if (!TAVILY_API_KEY) {
      console.log("🔍 No Tavily API - using AI for enhanced response");
      
      // Even without Tavily, provide enhanced AI response
      const enhancedContext = `Enhanced search request: "${query}". Provide comprehensive information with multiple perspectives and detailed analysis.`;
      return {
        success: true,
        context: enhancedContext,
        data: { 
          sources: [],
          enhanced: true,
          note: "Enhanced AI response without web search"
        }
      };
    }
    
    console.log("🔍 Executing enhanced Tavily search for query:", query);
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: "advanced", // Use advanced for enhanced search
        include_answer: true,
        include_raw_content: true,
        max_results: 5, // More results for enhanced search
        include_domains: [],
        exclude_domains: []
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tavily API error:", response.status, errorText);
      
      // Fallback to enhanced AI response
      const enhancedContext = `Enhanced search request: "${query}". Provide comprehensive information with multiple perspectives and detailed analysis.`;
      return {
        success: true,
        context: enhancedContext,
        data: { 
          sources: [],
          enhanced: true,
          fallback: true,
          note: "Enhanced AI response (Tavily fallback)"
        }
      };
    }
    
    const data = await response.json();
    console.log("✅ Enhanced Tavily search successful");
    
    // Create richer context from multiple sources
    let enhancedContext = `Enhanced web search results for: "${query}"\n\n`;
    if (data.answer) {
      enhancedContext += `Summary: ${data.answer}\n\n`;
    }
    
    if (data.results && data.results.length > 0) {
      enhancedContext += "Detailed Sources:\n";
      data.results.forEach((result, index) => {
        enhancedContext += `${index + 1}. ${result.title}\n`;
        enhancedContext += `   ${result.content}\n`;
        enhancedContext += `   Source: ${result.url}\n\n`;
      });
    }
    
    return {
      success: true,
      context: enhancedContext,
      data: { 
        sources: data.results || [],
        enhanced: true,
        searchDepth: "advanced",
        answer: data.answer
      }
    };
  } catch (error) {
    console.error("Enhanced search execution error:", error);
    
    // Always provide enhanced AI response as fallback
    const enhancedContext = `Enhanced search request: "${query}". Provide comprehensive information with multiple perspectives and detailed analysis.`;
    return {
      success: true,
      context: enhancedContext,
      data: { 
        sources: [],
        enhanced: true,
        fallback: true,
        note: "Enhanced AI response (error fallback)"
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
      
      // Find the image inference result
      const imageResult = result.data?.find((item: any) => item.taskType === "imageInference");
      
      if (imageResult && imageResult.imageURL) {
        // Save image to database
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
          // Continue anyway, the image was generated successfully
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
async function processWithAI(message: string, context: string | null, language: string = 'en') {
  try {
    console.log("🤖 UNIFIED AI BRAIN: Processing with real AI");
    
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

    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة. تتخصص في المساعدة في المهام اليومية وتقديم معلومات دقيقة ومفيدة. كن ودوداً ومفيداً ومختصراً في إجاباتك.`
      : `You are WAKTI, an advanced AI assistant. You specialize in helping with daily tasks and providing accurate, helpful information. Be friendly, helpful, and concise in your responses.`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];
    
    if (context) {
      messages.splice(1, 0, { role: 'assistant', content: `Context: ${context}` });
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
    
    // Fallback response
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
  }
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// SIMPLIFIED: Trigger isolation logic
function analyzeTriggerIntent(message: string, activeTrigger: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  console.log("🔍 UNIFIED AI BRAIN: Analyzing trigger intent for:", activeTrigger);
  
  switch (activeTrigger) {
    case 'search':
      // Basic search - allows general questions
      return {
        intent: 'basic_search',
        confidence: 'high',
        allowed: true
      };

    case 'enhanced_search':
      // Enhanced search with web browsing
      const searchPatterns = [
        'what', 'who', 'when', 'where', 'how', 'current', 'latest', 'recent', 'today', 'news',
        'weather', 'score', 'price', 'stock', 'update', 'information', 'find', 'search',
        'ما', 'من', 'متى', 'أين', 'كيف', 'حالي', 'آخر', 'مؤخراً', 'اليوم', 'أخبار',
        'طقس', 'نتيجة', 'سعر', 'معلومات', 'ابحث', 'بحث'
      ];
      
      const isSearchIntent = searchPatterns.some(pattern => lowerMessage.includes(pattern));
      
      return {
        intent: isSearchIntent ? 'enhanced_search' : 'invalid_for_enhanced_search',
        confidence: isSearchIntent ? 'high' : 'low',
        allowed: isSearchIntent
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
      // Chat mode allows everything
      return {
        intent: 'general_chat',
        confidence: 'high',
        allowed: true
      };
  }
}
