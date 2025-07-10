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
    console.log('🔄 Converting CDN data to base64...');
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Validate file signature
    const firstBytes = Array.from(uint8Array.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log('🔍 File signature validation:', firstBytes);
    
    const binaryString = String.fromCharCode.apply(null, Array.from(uint8Array));
    const base64String = btoa(binaryString);
    
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

// MEGA-MERGED: Claude API with all enhanced capabilities
async function callClaude35API(message: string, contextMessages: any[], conversationSummary: string, language: string, attachedFiles: any[], maxTokens: number, personalTouch: any) {
  console.log("🧠 MEGA-SYSTEM: Claude API processing with all enhancements");
  
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
    
    // MEGA-MERGED SYSTEM PROMPT - ALL CAPABILITIES COMBINED
    let systemPrompt = responseLanguage === 'ar' ? `
🤖 أنت WAKTI AI، المساعد الذكي المتطور والمتخصص في تحليل الصور والمحادثات الذكية.

## قدراتك الأساسية:
أنت مساعد ذكي متقدم يمكنه التعامل مع جميع أنواع الطلبات بطريقة طبيعية وذكية، مع قدرات متقدمة لتحليل الصور والمحادثات الممتعة.

## تحليل الصور المتقدم:
### أنواع الصور المدعومة:
- **الوثائق الرسمية** 📄: جوازات السفر، الهويات، رخص القيادة، الشهادات
- **الفواتير والإيصالات** 💰: المستندات المالية والإيصالات  
- **الأشخاص** 👤: الصور الشخصية ووصف المظهر
- **الأماكن والمباني** 🏢: المناظر والمعالم
- **التقارير والمخططات** 📊: البيانات والتحليلات
- **النصوص في الصور** 🔤: استخراج وقراءة النصوص
- **تحليل عام** ❓: وصف تفصيلي شامل

### منهجية التحليل المتقدمة (5 خطوات):
عند تحليل أي صورة، اتبع هذه الخطوات بدقة:
1. **التحليل الشامل للصورة**: فحص جميع العناصر المرئية بدقة عالية
2. **استخراج النصوص**: قراءة وتحليل أي نصوص موجودة في الصورة  
3. **فهم السياق**: تحديد الغرض والمعنى من الصورة
4. **الوصف المفصل**: تقديم وصف شامل وواضح بالعربية
5. **الإجابة على الأسئلة**: الرد على استفسارات المستخدم حول الصورة

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
- **Official Documents** 📄: Passports, IDs, driver's licenses, certificates
- **Bills & Receipts** 💰: Financial documents, invoices, receipts
- **People** 👤: Personal photos, appearance descriptions  
- **Places & Buildings** 🏢: Landscapes, buildings, landmarks
- **Reports & Charts** 📊: Data visualizations, analytics
- **Text in Images** 🔤: Text extraction and reading
- **General Analysis** ❓: Detailed comprehensive description

### Advanced Analysis Methodology (5 Steps):
When analyzing any image, follow these steps precisely:
1. **Comprehensive Image Analysis**: Examine all visual elements with high precision
2. **Text Extraction**: Read and analyze any text present in the image
3. **Context Understanding**: Determine the purpose and meaning of the image  
4. **Detailed Description**: Provide thorough and clear descriptions
5. **Question Answering**: Respond to user queries about the image content

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
            
            // Context integration
            let contextualMessage = message;
            
            if (imageFile.context) {
              contextualMessage = `${imageFile.context}\n\nUser request: ${message}`;
              console.log('✅ Context integrated successfully');
            } else if (imageFile.imageType?.name) {
              const fallbackContext = `Analyze this ${imageFile.imageType.name}.`;
              contextualMessage = `${fallbackContext}\n\nUser request: ${message}`;
              console.log('⚠️ Using minimal fallback context');
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
            
            console.log('📤 Message prepared for Claude API');
            
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

    console.log('📤 MEGA-SYSTEM CLAUDE REQUEST SUMMARY:', {
      model: requestBody.model,
      maxTokens: requestBody.max_tokens,
      systemPromptLanguage: responseLanguage,
      systemPromptLength: requestBody.system.length,
      messageCount: requestBody.messages.length,
      hasImageContent: !!(messages[messages.length - 1]?.content?.find?.(c => c.type === 'image')),
      userLanguage: responseLanguage,
      hasMemory: !!conversationSummary,
      hasPersonalization: !!personalTouch
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
    
    console.log("📡 MEGA-SYSTEM Claude API response:", {
      status: claudeResponse.status,
      ok: claudeResponse.ok,
      statusText: claudeResponse.statusText
    });
    
    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error("❌ MEGA-SYSTEM CLAUDE API ERROR:", {
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
    console.log("✅ MEGA-SYSTEM Claude API success");
    
    const responseText = claudeData.content?.[0]?.text || (responseLanguage === 'ar' 
      ? 'أعتذر، واجهت مشكلة في معالجة طلبك.'
      : 'I apologize, but I encountered an issue processing your request.');
    
    console.log("🎉 MEGA-SYSTEM PROCESSING COMPLETE");
    
    return {
      response: responseText,
      success: true,
      model: 'claude-3-5-sonnet-20241022',
      usage: claudeData.usage
    };
    
  } catch (error) {
    console.error("❌ MEGA-SYSTEM CRITICAL ERROR:", error);
    return {
      response: language === 'ar' 
        ? '❌ حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.'
        : '❌ An error occurred while processing your request. Please try again.',
      error: error.message,
      success: false
    };
  }
}
