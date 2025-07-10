
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

console.log("🚀 WAKTI AI V2: CLAUDE 3.5 SONNET + OPTIMIZED PERFORMANCE + SMART LANGUAGE HANDLING");

// OPTIMIZED: Faster Base64 conversion with SMART timeouts for different image types
async function convertImageUrlToBase64(imageUrl: string, imageType: string, retryCount = 0): Promise<string | null> {
  try {
    console.log('🆔 OPTIMIZED IMAGE PROCESSING: Converting with smart timeout handling', retryCount + 1, 'attempt for:', {
      url: imageUrl.substring(0, 50) + '...',
      type: imageType,
      isDocument: imageType.includes('id') || imageType.includes('passport') || imageType.includes('bill'),
      retryAttempt: retryCount
    });
    
    if (!imageUrl.startsWith('http')) {
      console.error('❌ IMAGE ERROR: Invalid URL format:', imageUrl);
      return null;
    }
    
    // OPTIMIZED: Smart timeout based on image type - faster for regular images
    const isDocument = imageType.includes('id') || imageType.includes('passport') || imageType.includes('bill');
    const timeout = isDocument ? 30000 : 15000; // 30s for documents, 15s for regular images
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'WAKTI-AI/2.0-OPTIMIZED',
        'Accept': '*/*',
        'Cache-Control': 'no-cache'
      }
    });
    
    clearTimeout(timeoutId);
    
    console.log('📡 OPTIMIZED FETCH: Response status:', response.status, {
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    });
    
    if (!response.ok) {
      console.error('❌ OPTIMIZED FETCH ERROR:', {
        status: response.status,
        url: imageUrl.substring(0, 50) + '...'
      });
      
      // OPTIMIZED: Reduced retry attempts - max 2 instead of 5
      if (retryCount < 2 && (response.status >= 500 || response.status === 429)) {
        console.log('🔄 OPTIMIZED RETRY in 2 seconds...', { retryCount, status: response.status });
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2s instead of 5s
        return await convertImageUrlToBase64(imageUrl, imageType, retryCount + 1);
      }
      
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    
    console.log('📊 OPTIMIZED IMAGE SIZE:', {
      bytes: fileSize,
      MB: (fileSize / (1024 * 1024)).toFixed(2),
      type: imageType
    });
    
    if (fileSize === 0 || fileSize > 20 * 1024 * 1024) {
      console.error('❌ OPTIMIZED ERROR: Invalid file size:', fileSize);
      return null;
    }
    
    // OPTIMIZED: Faster Base64 encoding
    const uint8Array = new Uint8Array(arrayBuffer);
    const binaryString = String.fromCharCode.apply(null, Array.from(uint8Array));
    const base64String = btoa(binaryString);
    
    if (!base64String || base64String.length < 100) {
      console.error('❌ OPTIMIZED BASE64 ERROR: Invalid base64 string');
      return null;
    }
    
    console.log('✅ OPTIMIZED CONVERSION SUCCESS:', {
      originalSize: fileSize,
      base64Length: base64String.length,
      processingTime: 'optimized'
    });
    
    return base64String;
  } catch (error) {
    console.error('❌ OPTIMIZED CONVERSION ERROR:', {
      message: error.message,
      url: imageUrl.substring(0, 50) + '...',
      retryCount
    });
    
    // OPTIMIZED: Reduced retries with faster delays
    if (retryCount < 2) {
      console.log('🔄 OPTIMIZED RETRY due to error...', { retryCount });
      await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
      return await convertImageUrlToBase64(imageUrl, imageType, retryCount + 1);
    }
    
    return null;
  }
}

serve(async (req) => {
  console.log("📨 OPTIMIZED REQUEST RECEIVED:", {
    method: req.method,
    url: req.url
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
    } catch (jsonError) {
      console.error("❌ JSON PARSING ERROR:", jsonError);
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
      enableTaskDetection = false
    } = requestBody || {};

    console.log("🎯 OPTIMIZED EXTRACTED PARAMS:", {
      hasMessage: !!message,
      hasUserId: !!userId,
      language,
      activeTrigger,
      messageLength: message?.length || 0,
      attachedFilesCount: attachedFiles.length
    });

    if (attachedFiles && attachedFiles.length > 0) {
      console.log("🖼️ OPTIMIZED IMAGE FILES ANALYSIS:", attachedFiles.map((file, index) => ({
        index,
        name: file?.name || 'unknown',
        type: file?.type || 'unknown',
        size: file?.size || 'unknown',
        isDocument: (file?.name || '').toLowerCase().includes('id') || 
                   (file?.name || '').toLowerCase().includes('passport') || 
                   (file?.name || '').toLowerCase().includes('bill')
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

    console.log(`🎯 OPTIMIZED MODE: ${activeTrigger.toUpperCase()}`);
    console.log(`📝 MESSAGE: ${message.substring(0, 100)}...`);

    let result;
    const finalConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('💬 OPTIMIZED CHAT: Processing with SMART LANGUAGE HANDLING');

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

    console.log(`✅ OPTIMIZED ${activeTrigger.toUpperCase()} MODE: CLAUDE 3.5 SONNET request completed successfully!`);

    return new Response(JSON.stringify(finalResponse), {
      headers: { 
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error("🚨 OPTIMIZED CRITICAL ERROR:", error);

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

// CHAT MODE with OPTIMIZED CLAUDE 3.5 SONNET + SMART LANGUAGE HANDLING
async function processChatMode(message: string, userId: string, conversationId: string | null, language: string, attachedFiles: any[], maxTokens: number, recentMessages: any[], conversationSummary: string, personalTouch: any) {
  console.log("💬 OPTIMIZED CHAT MODE: Processing with CLAUDE 3.5 SONNET + SMART LANGUAGE HANDLING");
  
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
        console.log(`📚 OPTIMIZED MEMORY: Loaded ${contextMessages.length} messages from database`);
      }
    } catch (error) {
      console.warn("⚠️ OPTIMIZED MEMORY: Database fallback failed, using session context");
    }
  }
  
  console.log(`🧠 OPTIMIZED MEMORY: Using ${contextMessages.length} context messages`);
  
  return await callClaude35API(message, contextMessages, conversationSummary, language, attachedFiles, maxTokens, personalTouch);
}

// SEARCH MODE with OPTIMIZED CLAUDE 3.5 SONNET
async function processSearchMode(message: string, language: string, recentMessages: any[], personalTouch: any) {
  console.log("🔍 OPTIMIZED SEARCH MODE: Processing with CLAUDE 3.5 SONNET");
  
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
    console.error('❌ OPTIMIZED SEARCH ERROR:', error);
    return {
      response: language === 'ar' 
        ? '❌ حدث خطأ أثناء البحث. حاول مرة أخرى.'
        : '❌ Search failed. Please try again.',
      error: error.message,
      success: false
    };
  }
}

// IMAGE MODE: OPTIMIZED CLAUDE 3.5 SONNET VISION + ENHANCED DOCUMENT ANALYSIS
async function processImageMode(message: string, userId: string, language: string, attachedFiles: any[], personalTouch: any) {
  console.log("🖼️ OPTIMIZED IMAGE MODE: Processing with ENHANCED DOCUMENT ANALYSIS + CLAUDE 3.5 VISION");
  
  if (attachedFiles && attachedFiles.length > 0) {
    console.log("👁️ OPTIMIZED VISION ANALYSIS: Analyzing with ENHANCED processing for all image types");
    
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
    
    console.log("🔍 OPTIMIZED IMAGE FILE DETECTION:", {
      foundImage: !!imageFile,
      fileName: imageFile?.name || 'unknown',
      fileType: imageFile?.type || 'unknown/fallback',
      hasUrl: !!(imageFile?.url || imageFile?.publicUrl),
      isDocument: (imageFile?.name || '').toLowerCase().includes('id') || 
                 (imageFile?.name || '').toLowerCase().includes('passport') || 
                 (imageFile?.name || '').toLowerCase().includes('bill')
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
    console.error('❌ OPTIMIZED IMAGE ERROR:', error);
    return {
      response: language === 'ar' 
        ? '❌ فشل في إنشاء الصورة. حاول مرة أخرى.'
        : '❌ Image generation failed. Please try again.',
      error: error.message,
      success: false
    };
  }
}

// OPTIMIZED CLAUDE 3.5 SONNET API CALL WITH SMART LANGUAGE HANDLING + ENHANCED DOCUMENT ANALYSIS
async function callClaude35API(message: string, contextMessages: any[], conversationSummary: string, language: string, attachedFiles: any[], maxTokens: number, personalTouch: any) {
  console.log("🧠 OPTIMIZED CLAUDE 3.5 API: SMART LANGUAGE HANDLING + ENHANCED DOCUMENT ANALYSIS");
  
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });
  
  // DETECT USER'S LANGUAGE FROM MESSAGE
  const isArabicMessage = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(message);
  const detectedLanguage = isArabicMessage ? 'ar' : 'en';
  
  console.log("🌐 OPTIMIZED LANGUAGE DETECTION:", {
    originalLanguage: language,
    detectedFromMessage: detectedLanguage,
    isArabicMessage,
    messagePreview: message.substring(0, 50)
  });
  
  // OPTIMIZED SMART SYSTEM PROMPT WITH ENHANCED DOCUMENT ANALYSIS
  let systemPrompt = detectedLanguage === 'ar'
    ? `🤖 أنت WAKTI AI، المساعد الذكي المتطور والشامل.

## قدراتك الأساسية:
أنت مساعد ذكي متعدد المهارات يمكنه التعامل مع جميع أنواع الطلبات بطريقة طبيعية وذكية. تتميز بالسرعة والدقة والشخصية الودودة.

## تحليل الوثائق المحسن:
### الوثائق الرسمية:
- جوازات السفر والهويات الوطنية (جميع البلدان)
- رخص القيادة وبطاقات الإقامة
- الفواتير والإيصالات والعقود
- الشهادات الجامعية والمهنية

### تحليل التواريخ الذكي:
- **مقارنة تواريخ الانتهاء بالتاريخ الحالي (${currentDate})**
- **إذا كانت الوثيقة منتهية الصلاحية: اكتب تحذير واضح بخط عريض**
- **مثال: "ملاحظة مهمة: جواز السفر هذا منتهي الصلاحية منذ يونيو 2024، يجب تجديده فوراً"**
- قدم نصائح مفيدة مثل: البلدان التي يمكن زيارتها، متطلبات التأشيرة، إرشادات التجديد

### الصور العامة:
- الأشخاص: وصف المظهر، الملابس، التعبيرات، الأنشطة
- الأماكن: المناظر الطبيعية، المباني، الشوارع، المعالم
- الشعارات والعلامات التجارية: تحديد الشركات والمنتجات
- المنتجات والأطعمة: وصف تفصيلي وتقييم
- النصوص في الصور: قراءة وترجمة وتفسير

## أسلوب التعامل:
- **اكتب دائماً باللغة العربية فقط**
- استخدم لغة طبيعية وودودة
- قدم إجابات مفصلة لكن منظمة
- **للوثائق المنتهية الصلاحية: استخدم خط عريض للتحذيرات**
- قدم اقتراحات مفيدة ومتابعة ذكية

التاريخ اليوم: ${currentDate}
**تجيب باللغة العربية فقط دائماً.**`
    : `🤖 You are WAKTI AI, the advanced and comprehensive intelligent assistant.

## Core Capabilities:
You are a multi-skilled AI assistant capable of handling all types of requests naturally and intelligently. You excel in speed, accuracy, and maintaining a friendly personality.

## Enhanced Document Analysis:
### Official Documents:
- Passports & National IDs (all countries)
- Driver's licenses & residence permits  
- Bills, invoices & receipts
- University & professional certificates

### Smart Date Analysis:
- **Compare expiration dates with current date (${currentDate})**
- **If document is expired: Write clear warning in bold text**
- **Example: "**Note: This passport is currently EXPIRED since June 2024, consider renewing it immediately**"**
- Provide helpful follow-ups like: visa-free countries, renewal guidance, travel requirements

### General Images:
- People: describe appearance, clothing, expressions, activities
- Places: landscapes, buildings, streets, landmarks
- Logos & brands: identify companies and products
- Products & food: detailed descriptions and assessments
- Text in images: read, translate, and interpret

## Communication Style:
- **Always respond in English only**
- Use natural, friendly language
- Provide detailed but well-organized answers
- **For expired documents: Use bold text for urgent warnings**
- Offer helpful suggestions and smart follow-ups

Today's date: ${currentDate}
**Always respond in English only.**`;

  // INJECT USER PERSONALIZATION VARIABLES DYNAMICALLY
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
    if (personalTouch.style) {
      systemPrompt += detectedLanguage === 'ar'
        ? ` قدم إجابات ${personalTouch.style}.`
        : ` Provide ${personalTouch.style} responses.`;
    }
    if (personalTouch.instruction) {
      systemPrompt += detectedLanguage === 'ar'
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
  
  // OPTIMIZED IMAGE PROCESSING: ENHANCED DOCUMENT ANALYSIS
  let currentMessage: any = { role: 'user', content: message };
  
  if (attachedFiles && attachedFiles.length > 0) {
    console.log('🖼️ OPTIMIZED IMAGE ANALYSIS: Processing with ENHANCED document analysis');
    
    const imageFile = attachedFiles.find(file => {
      if (file.type && (file.type.startsWith('image/') || file.type.includes('jpeg') || file.type.includes('png'))) {
        console.log('✅ OPTIMIZED IMAGE TYPE DETECTED: Standard image type:', file.type);
        return true;
      }
      
      if (file.name) {
        const extension = file.name.toLowerCase().split('.').pop();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'tif', 'heic', 'heif'].includes(extension)) {
          console.log('✅ OPTIMIZED IMAGE TYPE DETECTED: By extension:', extension);
          return true;
        }
      }
      
      if (file.url || file.publicUrl) {
        console.log('✅ OPTIMIZED IMAGE TYPE DETECTED: By URL presence');
        return true;
      }
      
      return true;
    });
    
    if (imageFile) {
      console.log("🖼️ OPTIMIZED IMAGE PROCESSING: Handling with ENHANCED document analysis");
      
      const imageUrl = imageFile.url || imageFile.publicUrl || imageFile.preview;
      const imageType = imageFile.type || 'image/jpeg';
      
      console.log("📡 OPTIMIZED IMAGE URL SELECTION:", {
        selectedUrl: imageUrl?.substring(0, 50) + '...',
        selectedType: imageType,
        fileName: imageFile.name,
        isDocument: (imageFile.name || '').toLowerCase().includes('id') || 
                   (imageFile.name || '').toLowerCase().includes('passport') || 
                   (imageFile.name || '').toLowerCase().includes('bill')
      });
      
      if (imageUrl) {
        const base64Data = await convertImageUrlToBase64(imageUrl, imageType);
        
        if (base64Data) {
          // ENHANCED message with SMART document analysis instructions
          const enhancedMessage = message + `\n\n🖼️ ENHANCED ANALYSIS: Please analyze this image comprehensively. If it's a document (passport, ID, bill, etc.), pay special attention to dates and compare them with today's date (${currentDate}). For expired documents, provide clear warnings in bold text and helpful follow-up suggestions. For all other images, provide detailed analysis and insights.`;
          
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
          console.log("✅ OPTIMIZED IMAGE PROCESSING: Enhanced Claude 3.5 Sonnet payload ready");
        } else {
          console.error("❌ OPTIMIZED IMAGE PROCESSING: Failed to convert image");
          
          return {
            response: detectedLanguage === 'ar' 
              ? '❌ عذراً، واجهت صعوبة في معالجة هذه الصورة. يرجى التأكد من وضوح الصورة وحاول مرة أخرى.'
              : '❌ Sorry, I encountered difficulty processing this image. Please ensure the image is clear and try again.',
            error: 'Image processing failed',
            success: false
          };
        }
      } else {
        console.error("❌ OPTIMIZED IMAGE PROCESSING: No valid URL found");
        return {
          response: detectedLanguage === 'ar' 
            ? '❌ لم أتمكن من الوصول إلى الصورة. يرجى رفع الصورة مرة أخرى.'
            : '❌ I could not access the image. Please upload the image again.',
          error: 'No image URL available',
          success: false
        };
      }
    }
  }
  
  messages.push(currentMessage);
  
  try {
    console.log(`🧠 OPTIMIZED CLAUDE 3.5: Sending ${messages.length} messages with ENHANCED DOCUMENT ANALYSIS`);
    console.log("📊 OPTIMIZED CLAUDE 3.5 API CALL:", {
      messagesCount: messages.length,
      hasImages: Array.isArray(currentMessage.content),
      maxTokens: maxTokens,
      temperature: 0.3,
      modelUsed: 'claude-3-5-sonnet-20241022',
      detectedLanguage: detectedLanguage,
      optimizedProcessing: true
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
        temperature: 0.3,
        system: systemPrompt,
        messages: messages
      }),
    });
    
    console.log("📡 OPTIMIZED CLAUDE 3.5 API RESPONSE STATUS:", claudeResponse.status);
    
    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error("❌ OPTIMIZED CLAUDE 3.5 API ERROR:", {
        status: claudeResponse.status,
        statusText: claudeResponse.statusText,
        errorBody: errorText.substring(0, 300)
      });
      
      let userFriendlyError = detectedLanguage === 'ar' 
        ? 'واجهت مشكلة في معالجة طلبك.'
        : 'I encountered an issue processing your request.';
      
      if (claudeResponse.status === 400) {
        if (errorText.includes('image')) {
          userFriendlyError = detectedLanguage === 'ar' 
            ? 'كانت هناك مشكلة في معالجة الصورة. قد تكون الصورة كبيرة جداً أو تالفة. يرجى تجربة صورة أوضح أو تقليل حجم الملف.'
            : 'There was an issue processing the image. The image might be too large, corrupted, or in an unsupported format. Please try uploading a clearer image or reducing the file size.';
        } else {
          userFriendlyError = detectedLanguage === 'ar' 
            ? 'الطلب غير صالح. يرجى المحاولة مرة أخرى برسالة مختلفة.'
            : 'The request was invalid. Please try again with a different message.';
        }
      } else if (claudeResponse.status === 429) {
        userFriendlyError = detectedLanguage === 'ar' 
          ? 'عدد كبير جداً من الطلبات. يرجى الانتظار قليلاً والمحاولة مرة أخرى.'
          : 'Too many requests. Please wait a moment and try again.';
      } else if (claudeResponse.status >= 500) {
        userFriendlyError = detectedLanguage === 'ar' 
          ? 'خدمة الذكاء الاصطناعي غير متاحة مؤقتاً. يرجى المحاولة مرة أخرى بعد قليل.'
          : 'The AI service is temporarily unavailable. Please try again in a few moments.';
      }
      
      throw new Error(`Optimized Claude API error: ${claudeResponse.status} - ${userFriendlyError}`);
    }
    
    const claudeData = await claudeResponse.json();
    console.log("✅ OPTIMIZED CLAUDE 3.5 API SUCCESS:", {
      hasContent: !!claudeData.content,
      contentLength: claudeData.content?.[0]?.text?.length || 0,
      usage: claudeData.usage,
      modelConfirmed: 'claude-3-5-sonnet-20241022',
      optimizedProcessing: true,
      enhancedDocumentAnalysis: true
    });
    
    const responseText = claudeData.content?.[0]?.text || (detectedLanguage === 'ar' 
      ? 'أعتذر، واجهت مشكلة في معالجة طلبك.'
      : 'I apologize, but I encountered an issue processing your request.');
    
    return {
      response: responseText,
      success: true,
      model: 'claude-3-5-sonnet-20241022',
      usage: claudeData.usage,
      optimizedSystemPrompt: true,
      enhancedDocumentAnalysis: true
    };
    
  } catch (error) {
    console.error("❌ OPTIMIZED CLAUDE 3.5 API CRITICAL ERROR:", error);
    return {
      response: detectedLanguage === 'ar' 
        ? '❌ حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.'
        : '❌ An error occurred while processing your request. Please try again.',
      error: error.message,
      success: false
    };
  }
}
