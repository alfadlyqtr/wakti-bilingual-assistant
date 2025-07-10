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

console.log("🚀 WAKTI AI V2: CLAUDE 3.5 SONNET + SMART BALANCED SYSTEM PROMPT");

// ENHANCED: Better Base64 conversion with SPECIFIC handling for IDs/passports
async function convertImageUrlToBase64(imageUrl: string, imageType: string, retryCount = 0): Promise<string | null> {
  try {
    console.log('🆔 ENHANCED ID/PASSPORT PROCESSING: Converting with special handling', retryCount + 1, 'attempt for:', {
      url: imageUrl.substring(0, 80) + '...',
      type: imageType,
      isSupabaseStorage: imageUrl.includes('supabase'),
      hasProtocol: imageUrl.startsWith('http'),
      retryAttempt: retryCount
    });
    
    if (!imageUrl.startsWith('http')) {
      console.error('❌ IMAGE ERROR: Invalid URL format:', imageUrl);
      return null;
    }
    
    // INCREASED timeout specifically for ID/passport processing
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds for IDs
    
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'WAKTI-AI/2.0-ID-PROCESSOR',
        'Accept': '*/*', // Accept all image types including unusual formats
        'Cache-Control': 'no-cache',
        'Range': 'bytes=0-', // Force full download
      }
    });
    
    clearTimeout(timeoutId);
    
    console.log('📡 ID/PASSPORT FETCH: Response status:', response.status, response.statusText, {
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      lastModified: response.headers.get('last-modified')
    });
    
    if (!response.ok) {
      console.error('❌ ID/PASSPORT FETCH ERROR:', {
        status: response.status,
        statusText: response.statusText,
        url: imageUrl.substring(0, 50) + '...',
        headers: Object.fromEntries(response.headers.entries())
      });
      
      // More aggressive retry for IDs/passports
      if (retryCount < 5 && (response.status >= 500 || response.status === 429 || response.status === 403)) {
        console.log('🔄 RETRYING ID/PASSPORT FETCH in 5 seconds...', { retryCount, status: response.status });
        await new Promise(resolve => setTimeout(resolve, 5000));
        return await convertImageUrlToBase64(imageUrl, imageType, retryCount + 1);
      }
      
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    
    console.log('📊 ID/PASSPORT IMAGE SIZE:', {
      bytes: fileSize,
      MB: (fileSize / (1024 * 1024)).toFixed(2),
      type: imageType,
      isLargeDocument: fileSize > 5 * 1024 * 1024
    });
    
    // ENHANCED: Special handling for large ID/passport images
    if (fileSize === 0) {
      console.error('❌ ID/PASSPORT ERROR: Empty file received');
      return null;
    }
    
    if (fileSize > 20 * 1024 * 1024) {
      console.error('❌ ID/PASSPORT ERROR: File too large:', fileSize);
      return null;
    }
    
    // ENHANCED: Better Base64 encoding with verification
    const uint8Array = new Uint8Array(arrayBuffer);
    let binaryString = '';
    
    // Process in smaller chunks for better reliability
    const chunkSize = 4096;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      try {
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      } catch (chunkError) {
        console.error('❌ ID/PASSPORT CHUNK ERROR:', chunkError, 'at position:', i);
        return null;
      }
    }
    
    const base64String = btoa(binaryString);
    
    // VERIFY the Base64 string is valid
    if (!base64String || base64String.length < 100) {
      console.error('❌ ID/PASSPORT BASE64 ERROR: Invalid or too short base64 string:', base64String.length);
      return null;
    }
    
    console.log('✅ ID/PASSPORT CONVERSION SUCCESS:', {
      originalSize: fileSize,
      base64Length: base64String.length,
      documentType: imageType,
      processingMethod: 'enhanced_id_passport_conversion',
      base64Preview: base64String.substring(0, 50) + '...'
    });
    
    return base64String;
  } catch (error) {
    console.error('❌ ID/PASSPORT CONVERSION CRITICAL ERROR:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 500),
      url: imageUrl.substring(0, 50) + '...',
      retryCount
    });
    
    // More retries for IDs/passports due to their importance
    if (retryCount < 5) {
      console.log('🔄 RETRYING ID/PASSPORT CONVERSION due to error...', { retryCount, errorType: error.name });
      await new Promise(resolve => setTimeout(resolve, 3000 * (retryCount + 1)));
      return await convertImageUrlToBase64(imageUrl, imageType, retryCount + 1);
    }
    
    return null;
  }
}

serve(async (req) => {
  console.log("📨 REQUEST RECEIVED:", {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

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
      enableTaskDetection = false // NO task detection in regular chat
    } = requestBody || {};

    console.log("🎯 EXTRACTED PARAMS:", {
      hasMessage: !!message,
      hasUserId: !!userId,
      language,
      activeTrigger,
      messageLength: message?.length || 0,
      recentMessagesCount: recentMessages.length,
      hasPersonalTouch: !!personalTouch,
      attachedFilesCount: attachedFiles.length,
      enableTaskDetection // Should always be false for regular chat
    });

    if (attachedFiles && attachedFiles.length > 0) {
      console.log("🖼️ IMAGE FILES DETAILED ANALYSIS:", attachedFiles.map((file, index) => ({
        index,
        name: file?.name || 'unknown',
        type: file?.type || 'unknown',
        size: file?.size || 'unknown',
        url: file?.url?.substring(0, 50) + '...' || 'missing',
        publicUrl: file?.publicUrl?.substring(0, 50) + '...' || 'missing',
        hasPreview: !!file?.preview,
        allKeys: Object.keys(file || {}),
        isLikelyDocument: (file?.name || '').toLowerCase().includes('id') || (file?.name || '').toLowerCase().includes('passport') || (file?.name || '').toLowerCase().includes('bill') || (file?.name || '').toLowerCase().includes('invoice')
      })));
    }

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
    console.log(`🚫 TASK DETECTION: DISABLED - No task detection in regular chat`);

    let result;
    const finalConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('💬 REGULAR CHAT: Processing with NEW BALANCED SYSTEM PROMPT');

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

    const finalResponse = {
      response: result.response || 'Response received',
      conversationId: finalConversationId,
      intent: activeTrigger,
      confidence: 'high',
      actionTaken: null,
      imageUrl: result.imageUrl || null,
      browsingUsed: activeTrigger === 'search',
      browsingData: null,
      needsConfirmation: false, // NEVER true for regular chat
      pendingTaskData: null, // NEVER present for regular chat
      pendingReminderData: null, // NEVER present for regular chat
      success: result.success !== false,
      processingTime: Date.now(),
      aiProvider: 'claude-3-5-sonnet-20241022',
      claude35Enabled: true,
      mode: activeTrigger,
      fallbackUsed: false
    };

    console.log(`✅ ${activeTrigger.toUpperCase()} MODE: CLAUDE 3.5 SONNET request completed successfully!`);

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

// CHAT MODE with CLAUDE 3.5 SONNET + NEW BALANCED SYSTEM PROMPT
async function processChatMode(message: string, userId: string, conversationId: string | null, language: string, attachedFiles: any[], maxTokens: number, recentMessages: any[], conversationSummary: string, personalTouch: any) {
  console.log("💬 CHAT MODE: Processing with CLAUDE 3.5 SONNET + NEW BALANCED SYSTEM PROMPT");
  
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
        console.log(`📚 HYBRID MEMORY: Loaded ${contextMessages.length} messages from database`);
      }
    } catch (error) {
      console.warn("⚠️ HYBRID MEMORY: Database fallback failed, using session context");
    }
  }
  
  console.log(`🧠 HYBRID MEMORY: Using ${contextMessages.length} context messages`);
  
  return await callClaude35API(message, contextMessages, conversationSummary, language, attachedFiles, maxTokens, personalTouch);
}

// SEARCH MODE with CLAUDE 3.5 SONNET
async function processSearchMode(message: string, language: string, recentMessages: any[], personalTouch: any) {
  console.log("🔍 SEARCH MODE: Processing with CLAUDE 3.5 SONNET");
  
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
    
    return await callClaude35API(searchContext, recentMessages, '', language, [], 4096, personalTouch);
    
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

// IMAGE MODE: CLAUDE 3.5 SONNET VISION + COMPREHENSIVE IMAGE ANALYSIS
async function processImageMode(message: string, userId: string, language: string, attachedFiles: any[], personalTouch: any) {
  console.log("🖼️ IMAGE MODE: Processing with COMPREHENSIVE IMAGE ANALYSIS + CLAUDE 3.5 VISION");
  
  if (attachedFiles && attachedFiles.length > 0) {
    console.log("👁️ VISION ANALYSIS: Analyzing with COMPREHENSIVE processing for all image types");
    console.log("🔓 ALL IMAGE TYPES SUPPORTED: IDs, passports, bills, invoices, people, logos, parks, documents, everything");
    
    const imageFile = attachedFiles.find(file => {
      if (file.type && file.type.startsWith('image/')) {
        return true;
      }
      
      if (file.name) {
        const extension = file.name.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'tiff', 'tif'].includes(extension);
      }
      
      return !!(file.url || file.publicUrl);
    });
    
    console.log("🔍 IMAGE FILE DETECTION RESULT:", {
      foundImage: !!imageFile,
      fileName: imageFile?.name || 'unknown',
      fileType: imageFile?.type || 'unknown/fallback',
      hasUrl: !!(imageFile?.url || imageFile?.publicUrl),
      isDocument: (imageFile?.name || '').toLowerCase().includes('id') || (imageFile?.name || '').toLowerCase().includes('passport') || (imageFile?.name || '').toLowerCase().includes('bill')
    });
    
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

// NEW BALANCED CLAUDE 3.5 SONNET API CALL WITH SMART 120-LINE SYSTEM PROMPT
async function callClaude35API(message: string, contextMessages: any[], conversationSummary: string, language: string, attachedFiles: any[], maxTokens: number, personalTouch: any) {
  console.log("🧠 NEW BALANCED CLAUDE 3.5 API: SMART 120-LINE SYSTEM PROMPT FOR ALL CAPABILITIES");
  
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });
  
  // NEW BALANCED 120-LINE SYSTEM PROMPT - COMPREHENSIVE BUT FOCUSED
  let systemPrompt = language === 'ar'
    ? `🤖 أنت WAKTI AI، المساعد الذكي المتطور والشامل.

## قدراتك الأساسية:
أنت مساعد ذكي متعدد المهارات يمكنه التعامل مع جميع أنواع الطلبات بطريقة طبيعية وذكية. تتميز بالسرعة والدقة والشخصية الودودة.

## تحليل الصور الشامل:
### الوثائق الرسمية:
- جوازات السفر والهويات الوطنية (جميع البلدان)
- رخص القيادة وبطاقات الإقامة
- الفواتير والإيصالات والعقود
- الشهادات الجامعية والمهنية
- استخرج: الأسماء، التواريخ، الأرقام، العناوين، المبالغ، التفاصيل المهمة

### الصور العامة:
- الأشخاص: وصف المظهر، الملابس، التعبيرات، الأنشطة
- الأماكن: المناظر الطبيعية، المباني، الشوارع، المعالم
- الشعارات والعلامات التجارية: تحديد الشركات والمنتجات
- المنتجات والأطعمة: وصف تفصيلي وتقييم
- النصوص في الصور: قراءة وترجمة وتفسير
- الرسوم البيانية والجداول: تحليل البيانات وتلخيصها
- اللقطات الشاشة: شرح المحتوى وتقديم المساعدة

## أسلوب التعامل:
- استخدم لغة طبيعية وودودة
- قدم إجابات مفصلة لكن منظمة
- اطرح أسئلة توضيحية عند الحاجة
- قدم نصائح واقتراحات مفيدة
- تذكر السياق من المحادثات السابقة

## المحادثات الذكية:
- حافظ على السياق والتسلسل الطبيعي
- اربط بين المواضيع المختلفة بذكاء
- استخدم الذاكرة للمعلومات المهمة
- قدم متابعة منطقية للمواضيع

## التعامل مع التحديات:
- إذا كانت الصورة غير واضحة، قدم أفضل تحليل ممكن
- للوثائق المعقدة، ركز على المعلومات المهمة
- للأسئلة الغامضة، اطلب توضيحات
- قدم بدائل واقتراحات عملية

## التخصيص الشخصي:
- تكيف مع أسلوب المستخدم المفضل
- استخدم المعلومات الشخصية المتاحة بحكمة
- حافظ على الطابع المهني مع اللمسة الشخصية

التاريخ اليوم: ${currentDate}
تجيب باللغة العربية للمحتوى العربي وبالإنجليزية للمحتوى الإنجليزي حسب السياق.`
    : `🤖 You are WAKTI AI, the advanced and comprehensive intelligent assistant.

## Core Capabilities:
You are a multi-skilled AI assistant capable of handling all types of requests naturally and intelligently. You excel in speed, accuracy, and maintaining a friendly personality.

## Comprehensive Image Analysis:
### Official Documents:
- Passports & National IDs (all countries)
- Driver's licenses & residence permits  
- Bills, invoices & receipts
- University & professional certificates
- Extract: names, dates, numbers, addresses, amounts, important details

### General Images:
- People: describe appearance, clothing, expressions, activities
- Places: landscapes, buildings, streets, landmarks
- Logos & brands: identify companies and products
- Products & food: detailed descriptions and assessments
- Text in images: read, translate, and interpret
- Charts & tables: analyze data and summarize
- Screenshots: explain content and provide assistance

## Communication Style:
- Use natural, friendly language
- Provide detailed but well-organized answers
- Ask clarifying questions when needed
- Offer helpful tips and suggestions
- Remember context from previous conversations

## Smart Conversations:
- Maintain context and natural flow
- Connect different topics intelligently
- Use memory for important information
- Provide logical follow-ups to discussions

## Handling Challenges:
- For unclear images, provide best possible analysis
- For complex documents, focus on important information
- For ambiguous questions, ask clarifications
- Offer practical alternatives and suggestions

## Personal Customization:
- Adapt to user's preferred style
- Use available personal information wisely
- Maintain professional tone with personal touch

Today's date: ${currentDate}
Respond in the language that matches the user's input and context.`;

  // INJECT USER PERSONALIZATION VARIABLES DYNAMICALLY
  if (personalTouch) {
    if (personalTouch.nickname) {
      systemPrompt += language === 'ar' 
        ? ` خاطب المستخدم باسم ${personalTouch.nickname}.`
        : ` Address the user as ${personalTouch.nickname}.`;
    }
    if (personalTouch.aiNickname) {
      systemPrompt += language === 'ar'
        ? ` يمكن مناداتك باسم ${personalTouch.aiNickname}.`
        : ` You can be called ${personalTouch.aiNickname}.`;
    }
    if (personalTouch.tone && personalTouch.tone !== 'neutral') {
      systemPrompt += language === 'ar'
        ? ` استخدم نبرة ${personalTouch.tone}.`
        : ` Use a ${personalTouch.tone} tone.`;
    }
    if (personalTouch.style) {
      systemPrompt += language === 'ar'
        ? ` قدم إجابات ${personalTouch.style}.`
        : ` Provide ${personalTouch.style} responses.`;
    }
    if (personalTouch.instruction) {
      systemPrompt += language === 'ar'
        ? ` تعليمات إضافية: ${personalTouch.instruction}`
        : ` Additional instruction: ${personalTouch.instruction}`;
    }
  }

  const messages = [];
  
  if (conversationSummary && conversationSummary.trim()) {
    messages.push({
      role: 'assistant',
      content: `[Context from our previous conversations: ${conversationSummary}]`
    });
  }
  
  if (contextMessages.length > 0) {
    messages.push({
      role: 'assistant',
      content: `[Continuing from our recent conversation...]`
    });
    
    contextMessages.forEach(msg => {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      });
    });
  }
  
  // COMPREHENSIVE IMAGE PROCESSING: ALL IMAGE TYPES SUPPORTED
  let currentMessage: any = { role: 'user', content: message };
  
  if (attachedFiles && attachedFiles.length > 0) {
    console.log('🖼️ COMPREHENSIVE IMAGE ANALYSIS: Processing with balanced handling for all image types');
    
    const imageFile = attachedFiles.find(file => {
      // Comprehensive image detection for all types
      if (file.type && (file.type.startsWith('image/') || file.type.includes('jpeg') || file.type.includes('png'))) {
        console.log('✅ IMAGE TYPE DETECTED: Standard image type:', file.type);
        return true;
      }
      
      if (file.name) {
        const extension = file.name.toLowerCase().split('.').pop();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'tif', 'heic', 'heif'].includes(extension)) {
          console.log('✅ IMAGE TYPE DETECTED: By extension:', extension);
          return true;
        }
      }
      
      if (file.url || file.publicUrl) {
        console.log('✅ IMAGE TYPE DETECTED: By URL presence (forced processing)');
        return true;
      }
      
      console.log('🔍 IMAGE: Attempting to process unknown file type as potential image');
      return true;
    });
    
    if (imageFile) {
      console.log("🖼️ COMPREHENSIVE IMAGE PROCESSING: Handling all image types with Claude 3.5 Sonnet");
      console.log("🔓 BALANCED IMAGE ANALYSIS: Optimized for documents, people, places, logos, bills, everything");
      
      const imageUrl = imageFile.url || imageFile.publicUrl || imageFile.preview;
      const imageType = imageFile.type || 'image/jpeg';
      
      console.log("📡 IMAGE URL SELECTION:", {
        selectedUrl: imageUrl?.substring(0, 80) + '...',
        hasUrl: !!imageFile.url,
        hasPublicUrl: !!imageFile.publicUrl,
        hasPreview: !!imageFile.preview,
        selectedType: imageType,
        fileName: imageFile.name,
        isDocument: (imageFile.name || '').toLowerCase().includes('id') || (imageFile.name || '').toLowerCase().includes('passport') || (imageFile.name || '').toLowerCase().includes('bill')
      });
      
      if (imageUrl) {
        const base64Data = await convertImageUrlToBase64(imageUrl, imageType);
        
        if (base64Data) {
          // Balanced message with COMPREHENSIVE instructions for all image types
          const enhancedMessage = message + '\n\n🖼️ ANALYZE: Please analyze this image comprehensively. Whether it\'s a document, person, place, logo, bill, or any other type of image, provide detailed and helpful analysis. Extract any visible text, describe what you see, and offer relevant insights or assistance.';
          
          currentMessage.content = [
            { type: 'text', text: enhancedMessage },
            { 
              type: 'image', 
              source: { 
                type: 'base64', 
                media_type: imageType, 
                data: base64Data
              } 
            }
          ];
          console.log("✅ COMPREHENSIVE IMAGE PROCESSING: Balanced Claude 3.5 Sonnet payload ready");
          console.log("🔧 CLAUDE 3.5 VISION PAYLOAD:", {
            hasTextContent: true,
            hasImageContent: true,
            imageMediaType: imageType,
            base64DataLength: base64Data.length,
            balancedPrompt: true,
            base64Sample: base64Data.substring(0, 50) + '...'
          });
        } else {
          console.error("❌ COMPREHENSIVE IMAGE PROCESSING: Failed to convert image");
          
          return {
            response: language === 'ar' 
              ? '❌ عذراً، واجهت صعوبة في معالجة هذه الصورة. يرجى التأكد من وضوح الصورة وحاول مرة أخرى.'
              : '❌ Sorry, I encountered difficulty processing this image. Please ensure the image is clear and try again.',
            error: 'Image processing failed',
            success: false
          };
        }
      } else {
        console.error("❌ COMPREHENSIVE IMAGE PROCESSING: No valid URL found in file object");
        return {
          response: language === 'ar' 
            ? '❌ لم أتمكن من الوصول إلى الصورة. يرجى رفع الصورة مرة أخرى.'
            : '❌ I could not access the image. Please upload the image again.',
          error: 'No image URL available',
          success: false
        };
      }
    } else {
      console.log("ℹ️ NO IMAGE FILES DETECTED in attached files");
    }
  }
  
  messages.push(currentMessage);
  
  try {
    console.log(`🧠 BALANCED CLAUDE 3.5: Sending ${messages.length} messages with NEW SMART SYSTEM PROMPT`);
    console.log("📊 CLAUDE 3.5 API CALL DETAILS:", {
      messagesCount: messages.length,
      hasImages: Array.isArray(currentMessage.content),
      maxTokens: maxTokens,
      temperature: 0.3, // Balanced temperature for natural responses
      modelUsed: 'claude-3-5-sonnet-20241022',
      balancedPrompt: true,
      promptApproximateLength: systemPrompt.length
    });
    
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
        temperature: 0.3, // Balanced for natural conversation
        system: systemPrompt,
        messages: messages
      }),
    });
    
    console.log("📡 BALANCED CLAUDE 3.5 API RESPONSE STATUS:", claudeResponse.status);
    
    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error("❌ BALANCED CLAUDE 3.5 API ERROR:", {
        status: claudeResponse.status,
        statusText: claudeResponse.statusText,
        errorBody: errorText.substring(0, 500)
      });
      
      let userFriendlyError = 'I encountered an issue processing your request.';
      
      if (claudeResponse.status === 400) {
        if (errorText.includes('image')) {
          userFriendlyError = 'There was an issue processing the image. The image might be too large, corrupted, or in an unsupported format. Please try uploading a clearer image or reducing the file size.';
        } else {
          userFriendlyError = 'The request was invalid. Please try again with a different message.';
        }
      } else if (claudeResponse.status === 429) {
        userFriendlyError = 'Too many requests. Please wait a moment and try again.';
      } else if (claudeResponse.status >= 500) {
        userFriendlyError = 'The AI service is temporarily unavailable. Please try again in a few moments.';
      }
      
      throw new Error(`Balanced Claude API error: ${claudeResponse.status} - ${userFriendlyError}`);
    }
    
    const claudeData = await claudeResponse.json();
    console.log("✅ BALANCED CLAUDE 3.5 API SUCCESS:", {
      hasContent: !!claudeData.content,
      contentLength: claudeData.content?.[0]?.text?.length || 0,
      usage: claudeData.usage,
      modelConfirmed: 'claude-3-5-sonnet-20241022',
      balancedProcessing: true
    });
    
    const responseText = claudeData.content?.[0]?.text || 'I apologize, but I encountered an issue processing your request.';
    
    return {
      response: responseText,
      success: true,
      model: 'claude-3-5-sonnet-20241022',
      usage: claudeData.usage,
      balancedSystemPrompt: true
    };
    
  } catch (error) {
    console.error("❌ BALANCED CLAUDE 3.5 API CRITICAL ERROR:", error);
    return {
      response: language === 'ar' 
        ? '❌ حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.'
        : '❌ An error occurred while processing your request. Please try again.',
      error: error.message,
      success: false
    };
  }
}
