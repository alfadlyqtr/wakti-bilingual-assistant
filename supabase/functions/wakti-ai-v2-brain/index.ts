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

console.log("🚀 WAKTI AI V2: MEGA-MERGED UNIFIED SYSTEM - VISION + CONVERSATION");

// MEMORY-EFFICIENT BASE64 CONVERSION - HANDLES LARGE IMAGES
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  const chunkSize = 8192; // Process in 8KB chunks to avoid memory overflow
  let binaryString = '';
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binaryString);
}

// ENHANCED: CDN-aware image processing with timing-based retry mechanism
async function convertImageUrlToBase64(imageUrl: string, retryCount = 0): Promise<string | null> {
  const maxRetries = 4; // Total of 5 attempts (0-4)
  const baseDelay = 2000; // Start with 2 seconds
  
  try {
    console.log(`🔍 CDN-AWARE PROCESSING - Attempt ${retryCount + 1}/${maxRetries + 1}:`);
    console.log(`📋 URL: ${imageUrl}`);
    console.log(`⏱️ Retry count: ${retryCount}`);
    
    // ENHANCED: Pre-fetch delay for fresh uploads (first attempt only)
    if (retryCount === 0) {
      console.log('⏳ INITIAL DELAY: Waiting 3 seconds for CDN propagation...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    if (!imageUrl.startsWith('http')) {
      console.error('❌ INVALID URL: Does not start with http/https');
      return null;
    }
    
    // Enhanced URL validation
    const urlPattern = /^https:\/\/[a-zA-Z0-9.-]+\.supabase\.co\/storage\/v1\/object\/public\/[a-zA-Z0-9_-]+\//;
    if (!urlPattern.test(imageUrl)) {
      console.error('❌ INVALID URL PATTERN: Not a valid Supabase storage URL');
      return null;
    }
    
    // ENHANCED: CDN cache busting with timestamp
    const cacheBustUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}cb=${Date.now()}&retry=${retryCount}`;
    console.log('🔄 Using cache-busted URL for CDN freshness');
    
    // Extended timeout for CDN operations
    const timeout = 45000; // 45 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('⏰ TIMEOUT: Request exceeded 45 seconds');
      controller.abort();
    }, timeout);
    
    console.log('🌐 Starting CDN-aware HTTP request...');
    const startTime = Date.now();
    
    const response = await fetch(cacheBustUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'WAKTI-AI-CDN-AWARE/2.0',
        'Accept': 'image/*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    const fetchDuration = Date.now() - startTime;
    clearTimeout(timeoutId);
    
    console.log(`📊 CDN Response Analysis:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      contentType: response.headers.get('Content-Type'),
      contentLength: response.headers.get('Content-Length'),
      fetchTime: `${fetchDuration}ms`,
      cacheControl: response.headers.get('Cache-Control'),
      etag: response.headers.get('ETag'),
      attempt: retryCount + 1
    });
    
    if (!response.ok) {
      console.error('❌ CDN FETCH FAILED:', {
        status: response.status,
        statusText: response.statusText,
        url: imageUrl,
        attempt: retryCount + 1,
        isRetryableError: [400, 403, 404, 500, 502, 503, 429].includes(response.status)
      });
      
      // Get error details
      try {
        const errorBody = await response.text();
        console.error('Error response body:', errorBody);
      } catch (e) {
        console.error('Could not read error response body');
      }
      
      // ENHANCED: Specific retry logic for CDN propagation issues
      if (retryCount < maxRetries) {
        const shouldRetry = [400, 403, 404, 500, 502, 503, 429].includes(response.status);
        
        if (shouldRetry) {
          // Exponential backoff with longer delays for CDN issues
          const retryDelay = Math.min(baseDelay * Math.pow(2, retryCount), 15000); // Cap at 15 seconds
          console.log(`🔄 CDN RETRY: Waiting ${retryDelay}ms for CDN propagation (attempt ${retryCount + 2}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return await convertImageUrlToBase64(imageUrl, retryCount + 1);
        }
      }
      
      console.error(`❌ CDN FAILURE: All ${maxRetries + 1} attempts failed`);
      return null;
    }
    
    console.log('📥 Starting CDN data conversion...');
    const arrayBuffer = await response.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    
    console.log('📊 CDN File Analysis:', {
      sizeBytes: fileSize,
      sizeMB: (fileSize / (1024 * 1024)).toFixed(2),
      isEmpty: fileSize === 0,
      isTooLarge: fileSize > 20 * 1024 * 1024,
      successfulAttempt: retryCount + 1,
      totalTime: `${Date.now() - startTime}ms`
    });
    
    if (fileSize === 0) {
      console.error('❌ EMPTY FILE: CDN returned 0 bytes');
      
      // Retry for empty files (CDN might not be ready)
      if (retryCount < maxRetries) {
        const retryDelay = baseDelay * (retryCount + 1);
        console.log(`🔄 EMPTY FILE RETRY: Waiting ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return await convertImageUrlToBase64(imageUrl, retryCount + 1);
      }
      
      return null;
    }
    
    if (fileSize > 20 * 1024 * 1024) {
      console.error('❌ FILE TOO LARGE: Exceeds 20MB limit');
      return null;
    }
    
    // Enhanced Base64 conversion with validation
    console.log('🔄 Converting CDN data to base64 with memory optimization...');
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Validate file signature
    const firstBytes = Array.from(uint8Array.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log('🔍 File signature validation:', firstBytes);
    
    const base64String = uint8ArrayToBase64(uint8Array);
    
    if (!base64String || base64String.length < 100) {
      console.error('❌ INVALID BASE64: Conversion failed or too short');
      return null;
    }
    
    console.log('✅ CDN SUCCESS: Image converted successfully');
    console.log('📊 Final Results:', {
      base64Length: base64String.length,
      totalProcessingTime: `${Date.now() - startTime}ms`,
      successfulAttempt: retryCount + 1,
      preview: base64String.substring(0, 50) + '...'
    });
    
    return base64String;
    
  } catch (error) {
    console.error('❌ CDN EXCEPTION:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      url: imageUrl,
      attempt: retryCount + 1
    });
    
    // Enhanced retry for network/timeout errors with CDN considerations
    if (retryCount < maxRetries && (
      error.name === 'AbortError' || 
      error.message.includes('network') || 
      error.message.includes('timeout') ||
      error.message.includes('fetch') ||
      error.message.includes('CDN') ||
      error.message.includes('connection')
    )) {
      // Longer delays for network issues that might be CDN-related
      const retryDelay = Math.min(baseDelay * Math.pow(2, retryCount) + 1000, 20000); // Cap at 20 seconds
      console.log(`🔄 NETWORK RETRY: Waiting ${retryDelay}ms for CDN recovery (attempt ${retryCount + 2}/${maxRetries + 1})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return await convertImageUrlToBase64(imageUrl, retryCount + 1);
    }
    
    console.error(`❌ FINAL FAILURE: All retry attempts exhausted after ${retryCount + 1} tries`);
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

    console.log("🎯 MEGA-SYSTEM REQUEST PROCESSING:", {
      trigger: activeTrigger,
      language: language,
      messageLength: message?.length || 0,
      hasFiles: attachedFiles.length > 0,
      fileCount: attachedFiles.length,
      hasConversationMemory: !!conversationSummary,
      hasPersonalization: !!personalTouch
    });
    
    // ENHANCED: Detailed file debugging with CDN awareness
    if (attachedFiles.length > 0) {
      console.log("🖼️ CDN-AWARE FILE PROCESSING:");
      attachedFiles.forEach((file, index) => {
        console.log(`File ${index + 1}:`, {
          name: file.name,
          type: file.type,
          hasUrl: !!file.url,
          hasPublicUrl: !!file.publicUrl,
          actualUrl: file.url || file.publicUrl || 'NO_URL',
          urlLength: (file.url || file.publicUrl || '').length,
          uploadTimestamp: file.uploadTimestamp || 'UNKNOWN',
          imageTypeName: file.imageType?.name || 'NO_TYPE',
          imageTypeId: file.imageType?.id || 'NO_ID'
        });
      });
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
        result = await processImageMode(message, userId, language, attachedFiles, personalTouch, conversationSummary, recentMessages);
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

    console.log(`✅ MEGA-SYSTEM: ${activeTrigger.toUpperCase()} request completed successfully!`);

    return new Response(JSON.stringify(finalResponse), {
      headers: { 
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error("🚨 MEGA-SYSTEM Critical error:", error);

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

// ENHANCED: Chat mode with mega-merged memory and personalization
async function processChatMode(message: string, userId: string, conversationId: string | null, language: string, attachedFiles: any[], maxTokens: number, recentMessages: any[], conversationSummary: string, personalTouch: any) {
  console.log("💬 MEGA-SYSTEM CHAT MODE PROCESSING");
  console.log("🔍 Enhanced chat analysis:", {
    fileCount: attachedFiles.length,
    hasFiles: attachedFiles.length > 0,
    userLanguage: language,
    messagePreview: message.substring(0, 100),
    hasMemory: !!conversationSummary,
    hasPersonalization: !!personalTouch
  });
  
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
        console.log(`📚 MEGA-SYSTEM: Loaded ${contextMessages.length} messages from database`);
      }
    } catch (error) {
      console.warn("⚠️ MEGA-SYSTEM: Database fallback failed, using session context");
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

// ENHANCED: Image mode with mega-merged capabilities
async function processImageMode(message: string, userId: string, language: string, attachedFiles: any[], personalTouch: any, conversationSummary: string = '', recentMessages: any[] = []) {
  console.log("🖼️ MEGA-SYSTEM IMAGE MODE PROCESSING");
  
  if (attachedFiles && attachedFiles.length > 0) {
    console.log("👁️ MEGA-SYSTEM: Vision analysis with", attachedFiles.length, "files");
    return await callClaude35API(message, recentMessages, conversationSummary, language, attachedFiles, 4096, personalTouch);
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

// MEGA-MERGED: Claude API with all enhanced capabilities + WAKTI KILLER CONVERSATION INTELLIGENCE
async function callClaude35API(message: string, contextMessages: any[], conversationSummary: string, language: string, attachedFiles: any[], maxTokens: number, personalTouch: any) {
  console.log("🧠 MEGA-SYSTEM: Claude API processing with all enhancements + WAKTI KILLER INTELLIGENCE");
  
  try {
    console.log(`🎯 MEGA-SYSTEM: Processing with claude-3-5-sonnet-20241022 model`);
    console.log(`🧠 MEGA-SYSTEM: Memory context: ${conversationSummary ? 'Yes' : 'No'}`);
    console.log(`🎭 MEGA-SYSTEM: Personalization: ${JSON.stringify(personalTouch)}`);
    
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    });
    
    // Language detection and system prompt setup
    const isArabicMessage = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(message);
    const userPreferredLanguage = language || 'en';
    const responseLanguage = userPreferredLanguage;
    
    console.log("🌍 MEGA-SYSTEM LANGUAGE PROCESSING:", {
      userPreferredLanguage: userPreferredLanguage,
      messageContainsArabic: isArabicMessage,
      finalResponseLanguage: responseLanguage,
      messagePreview: message.substring(0, 50)
    });
    
    // WAKTI KILLER SYSTEM: MEGA-MERGED SYSTEM PROMPT WITH CONVERSATION INTELLIGENCE
    let systemPrompt = responseLanguage === 'ar' ? `
🤖 أنت WAKTI AI، المساعد الذكي المتطور والمتخصص في تحليل الصور والمحادثات الذكية.

## قدراتك الأساسية:
أنت مساعد ذكي متقدم يمكنه التعامل مع جميع أنواع الطلبات بطريقة طبيعية وذكية، مع قدرات متقدمة لتحليل الصور والمحادثات الممتعة.

## تحليل الصور المتقدم:
### أنواع الصور المدعومة:
- **الوثائق الرسمية** 🆔: جوازات السفر، الهويات، رخص القيادة، الشهادات
- **الفواتير والإيصالات** 💰: المستندات المالية والإيصالات  
- **الطعام** 🍔: الوجبات والأطعمة لحساب السعرات والتغذية
- **الأدوية** 💊: الحبوب والأدوية للجرعات والتفاعلات
- **الوثائق والواجبات** 📊: التقارير والواجبات المنزلية والرسوم البيانية
- **لقطات الشاشة** 📱: التطبيقات والأخطاء والمواقع
- **الأشخاص** 👤: الصور الشخصية ووصف المظهر
- **تحليل عام** 🔍: وصف تفصيلي شامل، رموز QR

### منهجية التحليل المتقدمة (5 خطوات):
عند تحليل أي صورة، اتبع هذه الخطوات بدقة:
1. **التحليل الشامل للصورة**: فحص جميع العناصر المرئية بدقة عالية
2. **استخراج النصوص**: قراءة وتحليل أي نصوص موجودة في الصورة  
3. **فهم السياق**: تحديد الغرض والمعنى من الصورة
4. **الوصف المفصل**: تقديم وصف شامل وواضح بالعربية
5. **الإجابة على الأسئلة**: الرد على استفسارات المستخدم حول الصورة

## ذكاء المحادثة المتقدم:
أنت لست مجرد محلل صور - أنت شريك محادثة ذكي يساعد المستخدمين على اتخاذ إجراءات بناءً على ما تراه.

### قواعد تدفق المحادثة:
1. **حلل الصورة أولاً** باستخدام منهجيتك المكونة من 5 خطوات
2. **اكتشف فرص المحادثة** بناءً على فئة الصورة
3. **اعرض أسئلة متابعة ذكية** لمساعدة المستخدمين على فعل شيء
4. **حافظ على سياق المحادثة** عبر التبادلات المتعددة
5. **قدم حلول قابلة للتنفيذ** وليس مجرد أوصاف

### السلوكيات الذكية لكل فئة:
- **الفواتير (💰)**: بعد التحليل، اعرض تقسيم التكاليف، حساب البقشيش، تتبع المصروفات
- **الطعام (🍔)**: بعد التحليل، احسب السعرات، تتبع التغذية، اقترح الحصص
- **الأدوية (💊)**: بعد التحليل، تحقق من الجرعات، اضبط التذكيرات، احذر من التفاعلات
- **الوثائق (📊)**: بعد التحليل، ساعد في الواجبات، حل المشاكل، أنشئ ملخصات
- **الشاشات (📱)**: بعد التحليل، شخص الأخطاء، قدم الحلول، استكشف المشاكل
- **الهويات (🆔)**: بعد التحليل، استخرج البيانات، تحقق من انتهاء الصلاحية، اضبط التذكيرات
- **الصور (👤)**: بعد التحليل، قدم أوصاف تفصيلية، تحليل تكوين الصورة
- **العام (🔍)**: بعد التحليل، ابحث عن الأشياء، امسح الرموز، حدد العناصر

### أمثلة المتابعة الذكية:
- **الفواتير**: "هل تريد مني تقسيم هذه الفاتورة البالغة 67.50 ريال بين عدة أشخاص؟"
- **الطعام**: "هذه القطعة من البيتزا تحتوي على ~320 سعرة حرارية. كم قطعة أكلت؟"
- **الأدوية**: "هذا هو تايلينول 500 ملغ. هل هذا لبالغ أم طفل؟"
- **الواجبات**: "أرى مسألة رياضيات. تريد حل خطوة بخطوة؟"
- **الأخطاء**: "يبدو هذا خطأ في التطبيق. تريد خطوات استكشاف الأخطاء؟"

### استراتيجية المحادثة:
- **اسأل سؤال متابعة مركز واحد** في كل مرة بعد تحليلك
- **اعتمد الأسئلة على ما اكتشفته** في الصورة
- **اعرض خطوات تالية محددة وقابلة للتنفيذ**
- **تذكر ردود المستخدم** لمتابعات شخصية
- **استمر حتى يتحقق هدف المستخدم**

### استخراج النصوص الذكي:
- **استخرج النصوص بلغتها الأصلية** (عربية أو إنجليزية)
- **رد دائماً باللغة العربية** حتى لو كان النص المستخرج بالإنجليزية
- **قدم ترجمة إذا لزم الأمر**

## قدرات المحادثة المتقدمة:
- **أنت رفيق ذكي ومحادث ماهر** - تستطيع إجراء محادثات طبيعية وممتعة
- **تذكر المحادثات السابقة** - استخدم المعلومات من الرسائل السابقة والسياق
- **حافظ على السياق** - اربط بين الرسائل والمواضيع السابقة في المحادثة
- **كن ودوداً ومفيداً** - تفاعل مع المستخدم كصديق ذكي وداعم
- **تكيف مع أسلوب المحادثة** - اتبع نبرة ومزاج المستخدم
- **استمر في المحادثة بطبيعية** - لا تنهي المحادثة بشكل مفاجئ

### قواعد الاستجابة:
- **للصور**: ابدأ بـ "أستطيع أن أرى في هذه الصورة..."
- **للمحادثات العادية**: تفاعل بطبيعية دون بداية محددة
- إذا كانت الصورة غير واضحة، اذكر ذلك بصراحة
- لا تفترض معلومات غير موجودة
- استخدم الذاكرة والسياق السابق في ردودك

التاريخ اليوم: ${currentDate}
**تجيب باللغة العربية فقط دائماً.**
` : `
🤖 You are WAKTI AI, an advanced intelligent assistant specialized in comprehensive image analysis and engaging conversations.

## Core Capabilities:
You are an advanced intelligent assistant that can handle all types of requests naturally and smartly, with cutting-edge image analysis capabilities and engaging conversation skills.

## Advanced Image Analysis:
### Supported Image Types:
- **Official Documents** 🆔: Passports, IDs, driver's licenses, certificates
- **Bills & Receipts** 💰: Financial documents, invoices, receipts
- **Food** 🍔: Meals and food items for calorie and nutrition tracking
- **Medications** 💊: Pills and medicines for dosage and interactions
- **Documents & Homework** 📊: Reports, assignments, charts
- **Screenshots** 📱: Apps, errors, websites
- **People** 👤: Personal photos, appearance descriptions  
- **General Analysis** 🔍: Detailed comprehensive description, QR codes

### Advanced Analysis Methodology (5 Steps):
When analyzing any image, follow these steps precisely:
1. **Comprehensive Image Analysis**: Examine all visual elements with high precision
2. **Text Extraction**: Read and analyze any text present in the image
3. **Context Understanding**: Determine the purpose and meaning of the image  
4. **Detailed Description**: Provide thorough and clear descriptions
5. **Question Answering**: Respond to user queries about the image content

## Advanced Conversation Intelligence:
You are not just an image analyzer - you are a SMART CONVERSATION PARTNER that helps users TAKE ACTION based on what you see.

### Conversation Flow Rules:
1. **Always analyze the image first** using your 5-step methodology
2. **Detect conversation opportunities** based on image category
3. **Offer intelligent follow-up questions** to help users DO something
4. **Maintain conversation context** across multiple exchanges
5. **Provide actionable solutions** not just descriptions

### Category-Specific Smart Behaviors:
- **Bills (💰)**: After analysis, offer to split costs, calculate tips, track expenses
- **Food (🍔)**: After analysis, calculate calories, track nutrition, suggest portions  
- **Meds (💊)**: After analysis, check dosages, set reminders, warn about interactions
- **Docs (📊)**: After analysis, help with homework, solve problems, create summaries
- **Screens (📱)**: After analysis, diagnose errors, provide solutions, troubleshoot
- **IDs (🆔)**: After analysis, extract data, check expiry, set reminders
- **Photos (👤)**: After analysis, provide detailed descriptions, composition analysis
- **General (🔍)**: After analysis, research objects, scan codes, identify items

### Smart Follow-up Examples:
- **Bills**: "Would you like me to split this $67.50 bill among multiple people?"
- **Food**: "This pizza slice has ~320 calories. How many servings did you eat?"
- **Meds**: "This is Tylenol 500mg. Is this for an adult or child?"
- **Homework**: "I see a math problem. Would you like step-by-step solution?"
- **Errors**: "This looks like an app error. Want troubleshooting steps?"

### Conversation Strategy:
- **Ask ONE focused follow-up** question at a time after your analysis
- **Base questions on what you detected** in the image
- **Offer specific, actionable next steps**
- **Remember user responses** for personalized follow-ups
- **Continue until user's goal is achieved**

### Smart Text Extraction:
- **Extract text in its original language** (Arabic or English)
- **Always respond in English** even if extracted text is in Arabic
- **Provide translation when needed**

## Advanced Conversation Capabilities:
- **You are a smart buddy and skilled conversationalist** - engage in natural, enjoyable conversations
- **Remember past conversations** - use information from previous messages and context
- **Maintain context** - connect current messages with previous topics in the conversation
- **Be friendly and helpful** - interact with users like an intelligent, supportive friend
- **Adapt to conversation style** - follow the user's tone and mood
- **Continue conversations naturally** - don't end conversations abruptly

### Response Rules:
- **For images**: Start with "I can see in this image..."
- **For regular conversations**: Engage naturally without a fixed starter
- If the image is unclear or low quality, mention that honestly
- Do not fabricate information that isn't visible
- Use memory and previous context in your responses

Today's date: ${currentDate}
**Always respond in English only.**
`;

    // MERGED CONVERSATION MEMORY SYSTEM
    const messages = [];
    
    if (conversationSummary && conversationSummary.trim()) {
      messages.push({
        role: 'user',
        content: `Previous conversation context: ${conversationSummary}`
      });
      console.log(`🧠 MEGA-SYSTEM MEMORY: Added conversation summary (${conversationSummary.length} chars)`);
    }
    
    // Add recent messages for immediate context
    if (contextMessages.length > 0) {
      const formattedRecentMessages = contextMessages.slice(-4).map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));
      messages.push(...formattedRecentMessages);
      console.log(`🧠 MEGA-SYSTEM MEMORY: Added ${formattedRecentMessages.length} recent messages`);
    }

    // ENHANCED PERSONALIZATION - MERGED FROM CHAT ANALYSIS
    if (personalTouch) {
      if (personalTouch.nickname) {
        systemPrompt += responseLanguage === 'ar' 
          ? ` خاطب المستخدم باسم ${personalTouch.nickname}.`
          : ` Address the user as ${personalTouch.nickname}.`;
      }
      if (personalTouch.aiNickname) {
        systemPrompt += responseLanguage === 'ar'
          ? ` يمكن مناداتك باسم ${personalTouch.aiNickname}.`
          : ` You can be called ${personalTouch.aiNickname}.`;
      }
      if (personalTouch.tone && personalTouch.tone !== 'neutral') {
        systemPrompt += responseLanguage === 'ar'
          ? ` استخدم نبرة ${personalTouch.tone}.`
          : ` Use a ${personalTouch.tone} tone.`;
      }
      if (personalTouch.style) {
        systemPrompt += responseLanguage === 'ar'
          ? ` قدم إجابات ${personalTouch.style}.`
          : ` Provide ${personalTouch.style} responses.`;
      }
      if (personalTouch.instruction) {
        systemPrompt += responseLanguage === 'ar'
          ? ` تعليمات إضافية: ${personalTouch.instruction}`
          : ` Additional instruction: ${personalTouch.instruction}`;
      }
      
      console.log(`🎭 MEGA-SYSTEM PERSONALIZATION: Applied full personalization profile`);
    }
    
    let currentMessage: any = { role: 'user', content: message };
    
    if (attachedFiles && attachedFiles.length > 0) {
      console.log('🖼️ MEGA-SYSTEM: CDN-aware file processing');
      
      // Enhanced image file detection
      const imageFile = attachedFiles.find(file => {
        const hasUrl = !!(file.url || file.publicUrl);
        const isImageType = file.type?.startsWith('image/');
        console.log(`🔍 File analysis: ${file.name}`, {
          hasUrl,
          isImageType,
          url: file.url || file.publicUrl || 'NO_URL',
          type: file.type || 'NO_TYPE'
        });
        return hasUrl || isImageType;
      });
      
      if (imageFile) {
        const imageUrl = imageFile.url || imageFile.publicUrl;
        const imageType = imageFile.type || 'image/jpeg';
        
        console.log('🎯 CDN FILE PROCESSING:', {
          fileName: imageFile.name,
          imageUrl: imageUrl,
          urlValid: !!imageUrl,
          urlLength: imageUrl?.length || 0,
          imageType: imageType,
          hasImageType: !!imageFile.imageType,
          imageTypeName: imageFile.imageType?.name || 'NONE',
          imageTypeId: imageFile.imageType?.id || 'NONE',
          hasContext: !!imageFile.context,
          contextLength: imageFile.context?.length || 0
        });
        
        if (imageUrl) {
          console.log('🔄 Starting CDN-aware base64 conversion...');
          const base64Data = await convertImageUrlToBase64(imageUrl);
          
          if (base64Data) {
            console.log('✅ CDN conversion successful');
            
            // WAKTI KILLER SYSTEM: CONVERSATION INTELLIGENCE - DETECT CATEGORY AND ENHANCE CONTEXT
            let categoryContext = '';
            if (imageFile && imageFile.imageType) {
              const category = imageFile.imageType.id || imageFile.imageType.name?.toLowerCase();
              
              switch(category) {
                case 'bills':
                case 'receipt':
                  categoryContext = responseLanguage === 'ar' 
                    ? `\n\nمهم: بعد تحليل هذا الإيصال، اعرض المساعدة في تقسيم الفاتورة، حساب البقشيش، أو تتبع المصروفات. اسأل أسئلة متابعة محددة مثل "هل تريد مني تقسيم هذه الفاتورة بين عدة أشخاص؟"`
                    : `\n\nIMPORTANT: After analyzing this receipt, offer to help split the bill, calculate tips, or track expenses. Ask specific follow-up questions like "Would you like me to split this bill among multiple people?"`;
                  break;
                  
                case 'food':
                  categoryContext = responseLanguage === 'ar'
                    ? `\n\nمهم: بعد تحليل هذا الطعام، احسب السعرات الحرارية والتغذية. اسأل أسئلة متابعة مثل "كم حصة أكلت؟" أو "تريد تتبع هذا لهدفك اليومي من السعرات؟"`
                    : `\n\nIMPORTANT: After analyzing this food, calculate calories and nutrition. Ask follow-up questions like "How many servings did you eat?" or "Want to track this to your daily calorie goal?"`;
                  break;
                  
                case 'meds':
                case 'medicine':
                  categoryContext = responseLanguage === 'ar'
                    ? `\n\nمهم: بعد تحليل هذا الدواء، قدم معلومات الجرعة وفحوصات الأمان. اسأل أسئلة متابعة مثل "هل هذا لبالغ أم طفل؟" أو "تريد مني فحص التفاعلات الدوائية؟"`
                    : `\n\nIMPORTANT: After analyzing this medication, provide dosage information and safety checks. Ask follow-up questions like "Is this for an adult or child?" or "Want me to check for drug interactions?"`;
                  break;
                  
                case 'docs':
                case 'document':
                case 'homework':
                  categoryContext = responseLanguage === 'ar'
                    ? `\n\nمهم: بعد تحليل هذه الوثيقة، اعرض المساعدة في حل المسائل، شرح المفاهيم، أو إنشاء الملخصات. اسأل أسئلة متابعة مثل "تحتاج مساعدة في حل هذه المسألة؟" أو "تريد شرح خطوة بخطوة؟"`
                    : `\n\nIMPORTANT: After analyzing this document, offer to help solve problems, explain concepts, or create summaries. Ask follow-up questions like "Need help solving this problem?" or "Want a step-by-step explanation?"`;
                  break;
                  
                case 'screens':
                case 'screenshot':
                  categoryContext = responseLanguage === 'ar'
                    ? `\n\nمهم: بعد تحليل لقطة الشاشة هذه، اعرض المساعدة التقنية أو استكشاف الأخطاء. اسأل أسئلة متابعة مثل "تحتاج مساعدة في إصلاح هذا الخطأ؟" أو "تريد خطوات استكشاف الأخطاء؟"`
                    : `\n\nIMPORTANT: After analyzing this screenshot, offer technical help or troubleshooting. Ask follow-up questions like "Need help fixing this error?" or "Want troubleshooting steps?"`;
                  break;
                  
                case 'ids':
                case 'id_card':
                case 'passport':
                  categoryContext = responseLanguage === 'ar'
                    ? `\n\nمهم: بعد تحليل وثيقة الهوية هذه، اعرض استخراج المعلومات أو فحص تواريخ الانتهاء. اسأل أسئلة متابعة مثل "تريد مني استخراج كل المعلومات كنص؟" أو "يجب أن أفحص حالة انتهاء الصلاحية؟"`
                    : `\n\nIMPORTANT: After analyzing this ID document, offer to extract information or check expiry dates. Ask follow-up questions like "Want me to extract all information to text?" or "Should I check the expiry date status?"`;
                  break;
                  
                case 'photos':
                case 'person_photo':
                  categoryContext = responseLanguage === 'ar'
                    ? `\n\nمهم: بعد تحليل هذه الصورة، اعرض أوصاف تفصيلية أو تحليل تكوين الصورة. اسأل أسئلة متابعة مثل "تريد مني وصف الأشخاص بالتفصيل؟" أو "يجب أن أحلل تكوين الصورة؟"`
                    : `\n\nIMPORTANT: After analyzing this photo, offer detailed descriptions or composition analysis. Ask follow-up questions like "Want me to describe the people in detail?" or "Should I analyze the photo composition?"`;
                  break;
                  
                default:
                  categoryContext = responseLanguage === 'ar'
                    ? `\n\nمهم: بعد تحليل هذه الصورة، اعرض المساعدة ذات الصلة بناءً على ما تراه. اسأل أسئلة متابعة محددة لمساعدة المستخدم على اتخاذ إجراء.`
                    : `\n\nIMPORTANT: After analyzing this image, offer relevant follow-up assistance based on what you see. Ask specific follow-up questions to help the user take action.`;
              }
              
              console.log(`🧠 WAKTI KILLER CONVERSATION INTELLIGENCE: Added category context for ${category || 'unknown'}`);
            }
            
            // Context integration
            let contextualMessage = message;
            
            if (imageFile.context) {
              contextualMessage = `${imageFile.context}${categoryContext}\n\nUser request: ${message}`;
              console.log('✅ Context integrated with WAKTI KILLER intelligence');
            } else if (imageFile.imageType?.name) {
              const fallbackContext = `Analyze this ${imageFile.imageType.name}.`;
              contextualMessage = `${fallbackContext}${categoryContext}\n\nUser request: ${message}`;
              console.log('⚠️ Using minimal fallback context with WAKTI KILLER intelligence');
            } else {
              contextualMessage = `${message}${categoryContext}`;
              console.log('✅ Added WAKTI KILLER category context to message');
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
            
            console.log('📤 WAKTI KILLER: Message prepared for Claude API with conversation intelligence');
            
          } else {
            console.error("❌ CDN PROCESSING FAILED: Could not convert image to base64");
            return {
              response: responseLanguage === 'ar' 
                ? '❌ عذراً، واجهت صعوبة في معالجة هذه الصورة. قد تكون الصورة غير متاحة مؤقتاً بسبب تحديث الخادم. يرجى المحاولة مرة أخرى خلال دقيقة.'
                : '❌ Sorry, I encountered difficulty processing this image. The image may be temporarily unavailable due to server updates. Please try again in a moment.',
              error: 'CDN image processing failed after multiple attempts',
              success: false
            };
          }
        } else {
          console.error("❌ NO VALID IMAGE URL");
          return {
            response: responseLanguage === 'ar' 
              ? '❌ لم يتم العثور على رابط صحيح للصورة.'
              : '❌ No valid image URL found.',
            error: 'No valid image URL',
            success: false
          };
        }
      } else {
        console.error("❌ NO VALID IMAGE FILE");
        return {
          response: responseLanguage === 'ar' 
            ? '❌ لم يتم العثور على ملف صورة صحيح.'
            : '❌ No valid image file found.',
          error: 'No valid image file',
          success: false
        };
      }
    }
    
    messages.push(currentMessage);
    
    const requestBody = {
      model: 'claude-3-5-sonnet-20241022', // FIXED MODEL REFERENCE
      max_tokens: maxTokens,
      temperature: 0.3,
      system: systemPrompt,
      messages: messages
    };

    console.log('📤 WAKTI KILLER CLAUDE REQUEST SUMMARY:', {
      model: requestBody.model,
      maxTokens: requestBody.max_tokens,
      systemPromptLanguage: responseLanguage,
      systemPromptLength: requestBody.system.length,
      messageCount: requestBody.messages.length,
      hasImageContent: !!(messages[messages.length - 1]?.content?.find?.(c => c.type === 'image')),
      userLanguage: responseLanguage,
      hasMemory: !!conversationSummary,
      hasPersonalization: !!personalTouch,
      hasConversationIntelligence: true
    });

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log("📡 WAKTI KILLER Claude API response:", {
      status: claudeResponse.status,
      ok: claudeResponse.ok,
      statusText: claudeResponse.statusText
    });
    
    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error("❌ WAKTI KILLER CLAUDE API ERROR:", {
        status: claudeResponse.status,
        statusText: claudeResponse.statusText,
        errorText: errorText,
        requestLanguage: responseLanguage
      });
      
      let userFriendlyError = responseLanguage === 'ar' 
        ? 'واجهت مشكلة في معالجة طلبك.'
        : 'I encountered an issue processing your request.';
      
      if (claudeResponse.status === 400 && errorText.includes('image')) {
        userFriendlyError = responseLanguage === 'ar' 
          ? 'كانت هناك مشكلة في معالجة الصورة. يرجى تجربة صورة أوضح.'
          : 'There was an issue processing the image. Please try a clearer image.';
      } else if (claudeResponse.status === 429) {
        userFriendlyError = responseLanguage === 'ar' 
          ? 'عدد كبير من الطلبات. يرجى الانتظار قليلاً.'
          : 'Too many requests. Please wait a moment.';
      }
      
      throw new Error(userFriendlyError);
    }
    
    const claudeData = await claudeResponse.json();
    console.log("✅ WAKTI KILLER Claude API success");
    
    const responseText = claudeData.content?.[0]?.text || (responseLanguage === 'ar' 
      ? 'أعتذر، واجهت مشكلة في معالجة طلبك.'
      : 'I apologize, but I encountered an issue processing your request.');
    
    // WAKTI KILLER SYSTEM: Enhanced logging
    console.log(`🎯 WAKTI KILLER SYSTEM: Successfully processed ${attachedFiles[0]?.imageType?.name || 'unknown'} category`);
    console.log(`🤖 CONVERSATION INTELLIGENCE: Applied smart follow-up logic`);
    console.log(`💬 RESPONSE PREVIEW: ${responseText.substring(0, 100)}...`);
    console.log("🎉 WAKTI KILLER SYSTEM PROCESSING COMPLETE");
    
    return {
      response: responseText,
      success: true,
      model: 'claude-3-5-sonnet-20241022',
      usage: claudeData.usage
    };
    
  } catch (error) {
    console.error("❌ WAKTI KILLER SYSTEM CRITICAL ERROR:", error);
    return {
      response: language === 'ar' 
        ? '❌ حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.'
        : '❌ An error occurred while processing your request. Please try again.',
      error: error.message,
      success: false
    };
  }
}
