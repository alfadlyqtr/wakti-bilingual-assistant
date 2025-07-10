
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

console.log("🚀 WAKTI AI V2: SIMPLE & RELIABLE IMAGE PROCESSING");

// SIMPLE: Reliable image processing for ALL image types
async function convertImageUrlToBase64(imageUrl: string, retryCount = 0): Promise<string | null> {
  try {
    console.log(`🔄 Processing image (attempt ${retryCount + 1}):`, imageUrl.substring(0, 50) + '...');
    
    if (!imageUrl.startsWith('http')) {
      console.error('❌ Invalid URL format:', imageUrl);
      return null;
    }
    
    // SIMPLE: 50 second timeout for ALL images
    const timeout = 50000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'WAKTI-AI/2.0',
        'Accept': 'image/*',
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('❌ Fetch failed:', response.status);
      
      // SIMPLE: Only retry on server errors, max 2 retries
      if (retryCount < 2 && response.status >= 500) {
        console.log('🔄 Retrying in 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        return await convertImageUrlToBase64(imageUrl, retryCount + 1);
      }
      
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    
    console.log('📊 Image size:', (fileSize / (1024 * 1024)).toFixed(2), 'MB');
    
    if (fileSize === 0 || fileSize > 20 * 1024 * 1024) {
      console.error('❌ Invalid file size:', fileSize);
      return null;
    }
    
    // SIMPLE: Direct Base64 conversion
    const uint8Array = new Uint8Array(arrayBuffer);
    const binaryString = String.fromCharCode.apply(null, Array.from(uint8Array));
    const base64String = btoa(binaryString);
    
    if (!base64String || base64String.length < 100) {
      console.error('❌ Invalid base64 conversion');
      return null;
    }
    
    console.log('✅ Image converted successfully');
    return base64String;
    
  } catch (error) {
    console.error('❌ Image processing error:', error.message);
    
    // SIMPLE: Only retry on network/timeout errors, max 2 retries
    if (retryCount < 2 && (error.name === 'AbortError' || error.message.includes('network'))) {
      console.log('🔄 Retrying in 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      return await convertImageUrlToBase64(imageUrl, retryCount + 1);
    }
    
    return null;
  }
}

serve(async (req) => {
  console.log("📨 Request received:", req.method, req.url);

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
    const requestBody = await req.json();
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
      personalTouch = null,
    } = requestBody || {};

    console.log("🎯 Processing:", activeTrigger, "- Files:", attachedFiles.length);

    if (!message?.trim() && !attachedFiles?.length) {
      throw new Error("Message or attachment required");
    }

    if (!userId) {
      throw new Error("User ID is required");
    }

    let result;
    const finalConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    switch (activeTrigger) {
      case 'search':
        result = await processSearchMode(message, language, recentMessages, personalTouch);
        break;
        
      case 'image':
        result = await processImageMode(message, userId, language, attachedFiles, personalTouch);
        break;
        
      default:
        result = await processChatMode(message, userId, conversationId, language, attachedFiles, maxTokens, recentMessages, conversationSummary, personalTouch);
    }

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
      aiProvider: 'claude-3-5-sonnet-20241022',
      claude35Enabled: true,
      mode: activeTrigger,
      fallbackUsed: false
    };

    console.log(`✅ ${activeTrigger.toUpperCase()} request completed successfully!`);

    return new Response(JSON.stringify(finalResponse), {
      headers: { 
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error("🚨 Critical error:", error);

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

// CHAT MODE: Simple and reliable
async function processChatMode(message: string, userId: string, conversationId: string | null, language: string, attachedFiles: any[], maxTokens: number, recentMessages: any[], conversationSummary: string, personalTouch: any) {
  console.log("💬 Chat mode with", attachedFiles.length, "files");
  
  if (!ANTHROPIC_API_KEY) {
    return {
      response: language === 'ar' 
        ? '❌ خدمة الذكي الاصطناعي غير متاحة'
        : '❌ AI service not available',
      error: 'Claude API not configured',
      success: false
    };
  }

  let contextMessages = recentMessages || [];
  
  if (conversationId && contextMessages.length === 0) {
    try {
      const { data: dbMessages } = await supabase
        .from('ai_chat_history')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(4);
      
      if (dbMessages && dbMessages.length > 0) {
        contextMessages = dbMessages.reverse();
        console.log(`📚 Loaded ${contextMessages.length} messages from database`);
      }
    } catch (error) {
      console.warn("⚠️ Database fallback failed, using session context");
    }
  }
  
  return await callClaude35API(message, contextMessages, conversationSummary, language, attachedFiles, maxTokens, personalTouch);
}

// SEARCH MODE: Simple search with Tavily
async function processSearchMode(message: string, language: string, recentMessages: any[], personalTouch: any) {
  console.log("🔍 Search mode processing");
  
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
    
    const searchContext = `Search results for "${message}":\n${searchAnswer}\n\nResults:\n${
      searchResults.map((r: any, i: number) => `${i + 1}. ${r.title}: ${r.content}`).join('\n')
    }`;
    
    return await callClaude35API(searchContext, [], '', language, [], 4096, personalTouch);
    
  } catch (error) {
    console.error('❌ Search error:', error);
    return {
      response: language === 'ar' 
        ? '❌ حدث خطأ أثناء البحث. حاول مرة أخرى.'
        : '❌ Search failed. Please try again.',
      error: error.message,
      success: false
    };
  }
}

// IMAGE MODE: Simple image generation with Runware
async function processImageMode(message: string, userId: string, language: string, attachedFiles: any[], personalTouch: any) {
  console.log("🖼️ Image mode processing");
  
  if (attachedFiles && attachedFiles.length > 0) {
    console.log("👁️ Vision analysis with", attachedFiles.length, "files");
    return await callClaude35API(message, [], '', language, attachedFiles, 4096, personalTouch);
  }
  
  // Generate image with RUNWARE
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
    console.error('❌ Image error:', error);
    return {
      response: language === 'ar' 
        ? '❌ فشل في إنشاء الصورة. حاول مرة أخرى.'
        : '❌ Image generation failed. Please try again.',
      error: error.message,
      success: false
    };
  }
}

// SIMPLE CLAUDE API: Clean and reliable
async function callClaude35API(message: string, contextMessages: any[], conversationSummary: string, language: string, attachedFiles: any[], maxTokens: number, personalTouch: any) {
  console.log("🧠 Claude 3.5 API call");
  
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });
  
  // SIMPLE: Language detection
  const isArabicMessage = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(message);
  const detectedLanguage = isArabicMessage ? 'ar' : 'en';
  
  // SIMPLE: Clean system prompt (120 lines balanced)
  let systemPrompt = detectedLanguage === 'ar'
    ? `🤖 أنت WAKTI AI، المساعد الذكي المتطور.

## قدراتك الأساسية:
أنت مساعد ذكي يمكنه التعامل مع جميع أنواع الطلبات بطريقة طبيعية وذكية.

## تحليل الصور:
### جميع أنواع الصور:
- الوثائق الرسمية: جوازات السفر، الهويات، رخص القيادة، الفواتير
- الأشخاص: وصف المظهر، الملابس، التعبيرات
- الأماكن: المناظر الطبيعية، المباني، الشوارع
- الشعارات والعلامات التجارية
- المنتجات والأطعمة
- النصوص في الصور

### تحليل التواريخ الذكي:
- **مقارنة تواريخ الانتهاء بالتاريخ الحالي (${currentDate})**
- **إذا كانت الوثيقة منتهية الصلاحية: اكتب تحذير واضح بخط عريض**
- قدم نصائح مفيدة: البلدان، متطلبات التأشيرة، إرشادات التجديد

## أسلوب التعامل:
- **اكتب دائماً باللغة العربية فقط**
- استخدم لغة طبيعية وودودة
- قدم إجابات مفصلة ومنظمة
- **للوثائق المنتهية الصلاحية: استخدم خط عريض للتحذيرات**

التاريخ اليوم: ${currentDate}
**تجيب باللغة العربية فقط دائماً.**`
    : `🤖 You are WAKTI AI, an advanced intelligent assistant.

## Core Capabilities:
You are an intelligent assistant that can handle all types of requests naturally and smartly.

## Image Analysis:
### All Image Types:
- Official documents: passports, IDs, driver's licenses, bills
- People: appearance, clothing, expressions, activities
- Places: landscapes, buildings, streets, landmarks
- Logos & brands: identify companies and products
- Products & food: detailed descriptions and assessments
- Text in images: read, translate, and interpret

### Smart Date Analysis:
- **Compare expiration dates with current date (${currentDate})**
- **If document is expired: Write clear warning in bold text**
- Provide helpful follow-ups: visa-free countries, renewal guidance, travel requirements

## Communication Style:
- **Always respond in English only**
- Use natural, friendly language
- Provide detailed but well-organized answers
- **For expired documents: Use bold text for urgent warnings**

Today's date: ${currentDate}
**Always respond in English only.**`;

  // Add personalization if available
  if (personalTouch) {
    if (personalTouch.nickname) {
      systemPrompt += detectedLanguage === 'ar' 
        ? ` خاطب المستخدم باسم ${personalTouch.nickname}.`
        : ` Address the user as ${personalTouch.nickname}.`;
    }
    if (personalTouch.aiNickname) {
      systemPrompt += detectedLanguage === 'ar'
        ? ` يمكن مناداتك باسم ${personalTouch.aiNickname}.`
        : ` You can be called ${personalTouch.aiNickname}.`;
    }
    if (personalTouch.tone && personalTouch.tone !== 'neutral') {
      systemPrompt += detectedLanguage === 'ar'
        ? ` استخدم نبرة ${personalTouch.tone}.`
        : ` Use a ${personalTouch.tone} tone.`;
    }
  }

  const messages = [];
  
  if (conversationSummary && conversationSummary.trim()) {
    messages.push({
      role: 'assistant',
      content: `[Context: ${conversationSummary}]`
    });
  }
  
  if (contextMessages.length > 0) {
    contextMessages.forEach(msg => {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      });
    });
  }
  
  // SIMPLE: Image processing
  let currentMessage: any = { role: 'user', content: message };
  
  if (attachedFiles && attachedFiles.length > 0) {
    console.log('🖼️ Processing', attachedFiles.length, 'images');
    
    const imageFile = attachedFiles.find(file => 
      file.type?.startsWith('image/') || 
      file.url || 
      file.publicUrl
    );
    
    if (imageFile) {
      const imageUrl = imageFile.url || imageFile.publicUrl || imageFile.preview;
      const imageType = imageFile.type || 'image/jpeg';
      
      if (imageUrl) {
        const base64Data = await convertImageUrlToBase64(imageUrl);
        
        if (base64Data) {
          currentMessage.content = [
            { type: 'text', text: message },
            { 
              type: 'image', 
              source: { 
                type: 'base64', 
                media_type: imageType, 
                data: base64Data
              } 
            }
          ];
          console.log("✅ Image added to message");
        } else {
          console.error("❌ Image processing failed");
          return {
            response: detectedLanguage === 'ar' 
              ? '❌ عذراً، واجهت صعوبة في معالجة هذه الصورة. يرجى المحاولة مرة أخرى.'
              : '❌ Sorry, I encountered difficulty processing this image. Please try again.',
            error: 'Image processing failed',
            success: false
          };
        }
      }
    }
  }
  
  messages.push(currentMessage);
  
  try {
    console.log(`🧠 Sending ${messages.length} messages to Claude`);
    
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
        temperature: 0.3,
        system: systemPrompt,
        messages: messages
      }),
    });
    
    console.log("📡 Claude API response status:", claudeResponse.status);
    
    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error("❌ Claude API error:", claudeResponse.status, errorText);
      
      let userFriendlyError = detectedLanguage === 'ar' 
        ? 'واجهت مشكلة في معالجة طلبك.'
        : 'I encountered an issue processing your request.';
      
      if (claudeResponse.status === 400 && errorText.includes('image')) {
        userFriendlyError = detectedLanguage === 'ar' 
          ? 'كانت هناك مشكلة في معالجة الصورة. يرجى تجربة صورة أوضح.'
          : 'There was an issue processing the image. Please try a clearer image.';
      } else if (claudeResponse.status === 429) {
        userFriendlyError = detectedLanguage === 'ar' 
          ? 'عدد كبير من الطلبات. يرجى الانتظار قليلاً.'
          : 'Too many requests. Please wait a moment.';
      } else if (claudeResponse.status >= 500) {
        userFriendlyError = detectedLanguage === 'ar' 
          ? 'خدمة الذكاء الاصطناعي غير متاحة مؤقتاً.'
          : 'AI service temporarily unavailable.';
      }
      
      throw new Error(userFriendlyError);
    }
    
    const claudeData = await claudeResponse.json();
    console.log("✅ Claude API success");
    
    const responseText = claudeData.content?.[0]?.text || (detectedLanguage === 'ar' 
      ? 'أعتذر، واجهت مشكلة في معالجة طلبك.'
      : 'I apologize, but I encountered an issue processing your request.');
    
    return {
      response: responseText,
      success: true,
      model: 'claude-3-5-sonnet-20241022',
      usage: claudeData.usage
    };
    
  } catch (error) {
    console.error("❌ Claude API critical error:", error);
    return {
      response: detectedLanguage === 'ar' 
        ? '❌ حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.'
        : '❌ An error occurred while processing your request. Please try again.',
      error: error.message,
      success: false
    };
  }
}
