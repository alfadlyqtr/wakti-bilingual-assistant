
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

console.log("🚀 WAKTI AI V2: ENHANCED IMAGE PROCESSING WITH CONTEXT-AWARE PROMPTS");

// ENHANCED: Reliable image processing with better error handling and logging
async function convertImageUrlToBase64(imageUrl: string, retryCount = 0): Promise<string | null> {
  try {
    console.log(`🔄 Processing image (attempt ${retryCount + 1}):`, imageUrl.substring(0, 50) + '...');
    
    if (!imageUrl.startsWith('http')) {
      console.error('❌ Invalid URL format:', imageUrl);
      return null;
    }
    
    // ENHANCED: 70 second timeout with better error handling
    const timeout = 70000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'WAKTI-AI/2.0',
        'Accept': 'image/*',
        'Cache-Control': 'no-cache'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('❌ Fetch failed:', response.status, response.statusText);
      
      // ENHANCED: Retry on more error types, max 3 retries
      if (retryCount < 3 && (response.status >= 500 || response.status === 429 || response.status === 408)) {
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
    
    // ENHANCED: Direct Base64 conversion with validation
    const uint8Array = new Uint8Array(arrayBuffer);
    const binaryString = String.fromCharCode.apply(null, Array.from(uint8Array));
    const base64String = btoa(binaryString);
    
    if (!base64String || base64String.length < 100) {
      console.error('❌ Invalid base64 conversion');
      return null;
    }
    
    console.log('✅ Image converted successfully:', base64String.length, 'chars');
    return base64String;
    
  } catch (error) {
    console.error('❌ Image processing error:', error.message);
    
    // ENHANCED: Retry on network/timeout errors, max 3 retries
    if (retryCount < 3 && (error.name === 'AbortError' || error.message.includes('network') || error.message.includes('timeout'))) {
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
    
    // ENHANCED: Log image types and context for better debugging
    if (attachedFiles.length > 0) {
      console.log("🖼️ Files received:", attachedFiles.map(f => ({
        name: f.name,
        type: f.type,
        hasUrl: !!f.url,
        hasPublicUrl: !!f.publicUrl,
        imageTypeName: f.imageType?.name || 'none',
        imageTypeId: f.imageType?.id || 'none',
        hasContext: !!f.context
      })));
    }

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

// ENHANCED: Chat mode with context-aware image processing
async function processChatMode(message: string, userId: string, conversationId: string | null, language: string, attachedFiles: any[], maxTokens: number, recentMessages: any[], conversationSummary: string, personalTouch: any) {
  console.log("💬 Enhanced chat mode with", attachedFiles.length, "files");
  
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

// ENHANCED: Claude API with context-aware image processing
async function callClaude35API(message: string, contextMessages: any[], conversationSummary: string, language: string, attachedFiles: any[], maxTokens: number, personalTouch: any) {
  console.log("🧠 Enhanced Claude 3.5 API call with context-aware processing");
  
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });
  
  // ENHANCED: Language detection
  const isArabicMessage = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(message);
  const detectedLanguage = isArabicMessage ? 'ar' : 'en';
  
  // ENHANCED: Context-aware system prompt based on image types
  let systemPrompt = detectedLanguage === 'ar'
    ? `🤖 أنت WAKTI AI، المساعد الذكي المتطور والمحسن.

## قدراتك الأساسية:
أنت مساعد ذكي يمكنه التعامل مع جميع أنواع الطلبات بطريقة طبيعية وذكية، مع قدرات محسنة لتحليل الصور.

## تحليل الصور المحسن والمتخصص:
### أنواع الصور المدعومة:
- **الوثائق الرسمية** 📄: جوازات السفر، الهويات، رخص القيادة، الشهادات، الفواتير
- **الفواتير والإيصالات** 💰: الفواتير المالية، الإيصالات، المستندات المالية
- **الأشخاص** 👤: وصف المظهر، الملابس، التعبيرات، الأنشطة
- **الأماكن والمباني** 🏢: المناظر الطبيعية، المباني، الشوارع، المعالم
- **التقارير والمخططات** 📊: تصورات البيانات، التقارير، الرسوم البيانية
- **النصوص في الصور** 🔤: لقطات الشاشة، اللافتات، النصوص المكتوبة
- **تحليل عام** ❓: وصف تفصيلي وتحليل شامل

### التحليل الذكي المحسن للتواريخ:
- **مقارنة دقيقة لتواريخ الانتهاء مع التاريخ الحالي (${currentDate})**
- **إذا كانت الوثيقة منتهية الصلاحية: اكتب تحذير واضح وعاجل بخط عريض**
- **تقديم المشورة المفيدة**: البلدان بدون تأشيرة، إرشادات التجديد، متطلبات السفر

## أسلوب التعامل المحسن:
- **اكتب دائماً باللغة العربية فقط**
- استخدم لغة طبيعية وودودة ومهنية
- قدم إجابات مفصلة ومنظمة ودقيقة
- **للوثائق المنتهية الصلاحية: استخدم تحذيرات عاجلة بخط عريض**
- **كن دقيقاً في استخراج المعلومات وتحليل البيانات**

التاريخ اليوم: ${currentDate}
**تجيب باللغة العربية فقط دائماً وبدقة عالية.**`
    : `🤖 You are WAKTI AI, an advanced and enhanced intelligent assistant.

## Core Capabilities:
You are an intelligent assistant that can handle all types of requests naturally and smartly, with enhanced image analysis capabilities.

## Enhanced & Specialized Image Analysis:
### Supported Image Types:
- **Official Documents** 📄: Passports, IDs, driver's licenses, certificates, licenses
- **Bills & Receipts** 💰: Financial documents, invoices, receipts, billing statements
- **People** 👤: Appearance, clothing, expressions, activities, portraits
- **Places & Buildings** 🏢: Landscapes, buildings, streets, landmarks, locations
- **Reports & Charts** 📊: Data visualizations, reports, graphs, analytics
- **Text in Images** 🔤: Screenshots, signs, written text, handwriting
- **General Analysis** ❓: Detailed description and comprehensive analysis

### Enhanced Smart Date Analysis:
- **Precise comparison of expiration dates with current date (${currentDate})**
- **If document is expired: Write clear, urgent warning in bold text**
- **Provide helpful advice**: visa-free countries, renewal guidance, travel requirements

## Enhanced Communication Style:
- **Always respond in English only**
- Use natural, friendly, and professional language
- Provide detailed, well-organized, and accurate answers
- **For expired documents: Use urgent warnings in bold text**
- **Be precise in information extraction and data analysis**

Today's date: ${currentDate}
**Always respond in English only with high precision.**`;

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
  
  // FIXED: Enhanced image processing with proper context handling
  let currentMessage: any = { role: 'user', content: message };
  
  if (attachedFiles && attachedFiles.length > 0) {
    console.log('🖼️ Processing', attachedFiles.length, 'context-aware images');
    
    // FIXED: Better image detection logic
    const imageFile = attachedFiles.find(file => 
      file.url || file.publicUrl || file.type?.startsWith('image/')
    );
    
    if (imageFile) {
      const imageUrl = imageFile.url || imageFile.publicUrl;
      const imageType = imageFile.type || 'image/jpeg';
      
      console.log('🎯 Processing image with context:', {
        imageTypeName: imageFile.imageType?.name || 'unknown',
        imageTypeId: imageFile.imageType?.id || 'unknown',
        hasContext: !!imageFile.context,
        contextLength: imageFile.context?.length || 0
      });
      
      if (imageUrl) {
        const base64Data = await convertImageUrlToBase64(imageUrl);
        
        if (base64Data) {
          // FIXED: Properly add context-specific instructions to message
          let contextualMessage = message;
          
          // Add image type context if available
          if (imageFile.context) {
            contextualMessage = `${imageFile.context}\n\nUser message: ${message}`;
            console.log('✅ Added image context to message:', imageFile.context.substring(0, 100) + '...');
          } else if (imageFile.imageType?.name) {
            // Fallback context based on image type name
            const fallbackContext = `This is a ${imageFile.imageType.name} image. Please analyze it accordingly.`;
            contextualMessage = `${fallbackContext}\n\nUser message: ${message}`;
            console.log('✅ Added fallback context:', fallbackContext);
          }
          
          currentMessage.content = [
            { type: 'text', text: contextualMessage },
            { 
              type: 'image', 
              source: { 
                type: 'base64', 
                media_type: imageType, 
                data: base64Data
              } 
            }
          ];
          console.log("✅ Context-aware image added to message successfully");
        } else {
          console.error("❌ Image processing failed");
          return {
            response: detectedLanguage === 'ar' 
              ? '❌ عذراً، واجهت صعوبة في معالجة هذه الصورة. يرجى المحاولة مرة أخرى أو جرب صورة أوضح.'
              : '❌ Sorry, I encountered difficulty processing this image. Please try again or try a clearer image.',
            error: 'Image processing failed',
            success: false
          };
        }
      } else {
        console.error("❌ No valid image URL found");
        return {
          response: detectedLanguage === 'ar' 
            ? '❌ لم يتم العثور على رابط صحيح للصورة.'
            : '❌ No valid image URL found.',
          error: 'No valid image URL',
          success: false
        };
      }
    } else {
      console.error("❌ No valid image file found in attachedFiles");
      return {
        response: detectedLanguage === 'ar' 
          ? '❌ لم يتم العثور على ملف صورة صحيح.'
          : '❌ No valid image file found.',
        error: 'No valid image file',
        success: false
      };
    }
  }
  
  messages.push(currentMessage);
  
  try {
    console.log(`🧠 Sending ${messages.length} messages to Enhanced Claude`);
    
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
    
    console.log("📡 Enhanced Claude API response status:", claudeResponse.status);
    
    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error("❌ Enhanced Claude API error:", claudeResponse.status, errorText);
      
      let userFriendlyError = detectedLanguage === 'ar' 
        ? 'واجهت مشكلة في معالجة طلبك.'
        : 'I encountered an issue processing your request.';
      
      if (claudeResponse.status === 400 && errorText.includes('image')) {
        userFriendlyError = detectedLanguage === 'ar' 
          ? 'كانت هناك مشكلة في معالجة الصورة. يرجى تجربة صورة أوضح أو نوع مختلف.'
          : 'There was an issue processing the image. Please try a clearer image or different type.';
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
    console.log("✅ Enhanced Claude API success");
    
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
    console.error("❌ Enhanced Claude API critical error:", error);
    return {
      response: detectedLanguage === 'ar' 
        ? '❌ حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.'
        : '❌ An error occurred while processing your request. Please try again.',
      error: error.message,
      success: false
    };
  }
}
