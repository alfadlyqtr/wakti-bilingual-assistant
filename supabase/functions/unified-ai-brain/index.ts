
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

console.log("🔍 UNIFIED AI BRAIN: Function loaded with trigger isolation system");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔍 UNIFIED AI BRAIN: Processing request with trigger system");

    // Get request body
    const requestBody = await req.json();
    console.log("🔍 UNIFIED AI BRAIN: Request body received:", requestBody);

    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      confirmSearch = false,
      activeTrigger = 'chat'
    } = requestBody;

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

    if (!userId) {
      console.error("🔍 UNIFIED AI BRAIN: Missing userId");
      return new Response(JSON.stringify({ 
        error: "User ID is required",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("🔍 UNIFIED AI BRAIN: Processing message for user:", userId);
    console.log("🔍 UNIFIED AI BRAIN: Active trigger mode:", activeTrigger);

    // Enforce trigger isolation
    const intent = analyzeTriggerIntent(message, activeTrigger, language);
    console.log("🔍 UNIFIED AI BRAIN: Trigger analysis result:", intent);

    // Generate response based on trigger isolation
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let actionTaken = null;
    let actionResult = null;

    // Mock quota status (normally would be fetched from database)
    quotaStatus = {
      count: 0,
      limit: 60,
      usagePercentage: 0,
      remaining: 60
    };

    switch (activeTrigger) {
      case 'search':
        if (intent.allowed) {
          response = language === 'ar' 
            ? `🔍 وضع البحث النشط\n\nسأبحث لك عن: "${message}"\n\n[البحث معطل حالياً في النسخة التجريبية]`
            : `🔍 Search Mode Active\n\nSearching for: "${message}"\n\n[Search disabled in demo version]`;
          browsingUsed = false; // Would be true in real implementation
        } else {
          response = language === 'ar' 
            ? `⚠️ أنت في وضع البحث\n\nهذا الوضع مخصص للبحث والمعلومات الحديثة فقط.\n\nللدردشة العامة، انتقل إلى وضع المحادثة.`
            : `⚠️ You're in Search Mode\n\nThis mode is for search and current information only.\n\nFor general chat, switch to Chat mode.`;
        }
        break;

      case 'image':
        if (intent.allowed) {
          response = language === 'ar' 
            ? `🎨 وضع إنشاء الصور النشط\n\nسأنشئ صورة: "${message}"\n\n[إنشاء الصور معطل حالياً في النسخة التجريبية]`
            : `🎨 Image Generation Mode Active\n\nGenerating image: "${message}"\n\n[Image generation disabled in demo version]`;
          // imageUrl would be set here in real implementation
        } else {
          response = language === 'ar' 
            ? `⚠️ أنت في وضع إنشاء الصور\n\nهذا الوضع مخصص لإنشاء الصور فقط.\n\nللدردشة العامة، انتقل إلى وضع المحادثة.`
            : `⚠️ You're in Image Mode\n\nThis mode is for image generation only.\n\nFor general chat, switch to Chat mode.`;
        }
        break;

      case 'advanced_search':
        response = language === 'ar' 
          ? `🔮 وضع البحث المتقدم\n\nهذه الميزة قيد التطوير.\n\nيرجى استخدام وضع البحث العادي أو المحادثة.`
          : `🔮 Advanced Search Mode\n\nThis feature is coming soon.\n\nPlease use regular Search or Chat mode.`;
        break;

      case 'chat':
      default:
        // Chat mode allows everything (current behavior)
        const chatIntent = analyzeGeneralIntent(message, language);
        
        if (chatIntent === 'image_request') {
          response = language === 'ar' 
            ? `🎨 أرى أنك تريد إنشاء صورة!\n\nيمكنك:\n• التبديل إلى وضع الصور للحصول على أفضل النتائج\n• أو سأحاول مساعدتك هنا: "${message}"\n\n[إنشاء الصور معطل حالياً في النسخة التجريبية]`
            : `🎨 I see you want to generate an image!\n\nYou can:\n• Switch to Image mode for best results\n• Or I'll try to help you here: "${message}"\n\n[Image generation disabled in demo version]`;
        } else if (chatIntent === 'search_request') {
          response = language === 'ar' 
            ? `🔍 أرى أنك تريد البحث عن معلومات!\n\nيمكنك:\n• التبديل إلى وضع البحث للحصول على أفضل النتائج\n• أو سأحاول مساعدتك هنا: "${message}"\n\n[البحث معطل حالياً في النسخة التجريبية]`
            : `🔍 I see you want to search for information!\n\nYou can:\n• Switch to Search mode for best results\n• Or I'll try to help you here: "${message}"\n\n[Search disabled in demo version]`;
        } else {
          response = language === 'ar' 
            ? `💬 وضع المحادثة النشط\n\nاستلمت رسالتك: "${message}"\n\nهذه استجابة تجريبية من النظام الموحد. يمكنني مساعدتك في المهام والأحداث والتذكيرات والدردشة العامة.`
            : `💬 Chat Mode Active\n\nReceived your message: "${message}"\n\nThis is a demo response from the unified system. I can help with tasks, events, reminders, and general conversation.`;
        }
        break;
    }

    const result = {
      response,
      conversationId: conversationId || 'demo-conversation',
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

    console.log("🔍 UNIFIED AI BRAIN: Sending trigger-isolated response:", result);

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

// Trigger isolation logic
function analyzeTriggerIntent(message: string, activeTrigger: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  console.log("🔍 UNIFIED AI BRAIN: Analyzing trigger intent for:", activeTrigger);
  
  switch (activeTrigger) {
    case 'search':
      const searchPatterns = [
        'what', 'who', 'when', 'where', 'how', 'current', 'latest', 'recent', 'today', 'news',
        'weather', 'score', 'price', 'stock', 'update', 'information', 'find', 'search',
        'ما', 'من', 'متى', 'أين', 'كيف', 'حالي', 'آخر', 'مؤخراً', 'اليوم', 'أخبار',
        'طقس', 'نتيجة', 'سعر', 'معلومات', 'ابحث', 'بحث'
      ];
      
      const isSearchIntent = searchPatterns.some(pattern => lowerMessage.includes(pattern));
      
      return {
        intent: isSearchIntent ? 'real_time_search' : 'invalid_for_search',
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

    case 'advanced_search':
      return {
        intent: 'advanced_search_unavailable',
        confidence: 'high',
        allowed: false
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

// General intent analysis for chat mode
function analyzeGeneralIntent(message: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  // Check for image generation patterns
  const imagePatterns = [
    'generate image', 'create image', 'make picture', 'draw', 'image of', 'picture of',
    'أنشئ صورة', 'اصنع صورة', 'ارسم', 'صورة'
  ];
  
  if (imagePatterns.some(pattern => lowerMessage.includes(pattern))) {
    return 'image_request';
  }
  
  // Check for search patterns
  const searchPatterns = [
    'what is', 'who is', 'current', 'latest', 'today', 'news', 'weather',
    'ما هو', 'من هو', 'حالي', 'آخر', 'اليوم', 'أخبار', 'طقس'
  ];
  
  if (searchPatterns.some(pattern => lowerMessage.includes(pattern))) {
    return 'search_request';
  }
  
  return 'general_chat';
}
