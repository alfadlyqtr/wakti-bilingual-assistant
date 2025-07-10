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

console.log("🚀 WAKTI AI V2: ENHANCED DEBUGGING & IMAGE PROCESSING AUDIT");

// ENHANCED: Advanced image processing with comprehensive debugging and URL validation
async function convertImageUrlToBase64(imageUrl: string, retryCount = 0): Promise<string | null> {
  try {
    console.log(`🔍 DETAILED AUDIT - Processing image (attempt ${retryCount + 1}):`);
    console.log(`📋 Full URL: ${imageUrl}`);
    console.log(`📏 URL Length: ${imageUrl.length}`);
    console.log(`🔗 URL Structure Analysis:`, {
      startsWithHttp: imageUrl.startsWith('http'),
      includesSupabase: imageUrl.includes('supabase'),
      includesBucket: imageUrl.includes('wakti-ai-v2'),
      urlParts: imageUrl.split('/').slice(0, 6) // First 6 parts for security
    });
    
    if (!imageUrl.startsWith('http')) {
      console.error('❌ AUDIT FAILURE: Invalid URL format - does not start with http/https');
      return null;
    }
    
    // Enhanced URL validation
    const urlPattern = /^https:\/\/[a-zA-Z0-9.-]+\.supabase\.co\/storage\/v1\/object\/public\/[a-zA-Z0-9_-]+\//;
    if (!urlPattern.test(imageUrl)) {
      console.error('❌ AUDIT FAILURE: URL does not match expected Supabase storage pattern');
      console.error('Expected pattern: https://xxx.supabase.co/storage/v1/object/public/bucket-name/...');
      return null;
    }
    
    // ENHANCED: 90 second timeout with detailed progress tracking
    const timeout = 90000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('⏰ AUDIT FAILURE: Request timeout after 90 seconds');
      controller.abort();
    }, timeout);
    
    console.log('🌐 Starting HTTP request...');
    const startTime = Date.now();
    
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'WAKTI-AI-AUDIT/2.0',
        'Accept': 'image/*',
        'Cache-Control': 'no-cache'
      }
    });
    
    const fetchDuration = Date.now() - startTime;
    clearTimeout(timeoutId);
    
    console.log(`📊 HTTP Response Analysis:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      contentType: response.headers.get('Content-Type'),
      contentLength: response.headers.get('Content-Length'),
      fetchTime: `${fetchDuration}ms`,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    if (!response.ok) {
      console.error('❌ AUDIT FAILURE: HTTP request failed');
      console.error('Response details:', {
        status: response.status,
        statusText: response.statusText,
        url: imageUrl,
        attempt: retryCount + 1
      });
      
      // Try to get error body
      try {
        const errorBody = await response.text();
        console.error('Error response body:', errorBody);
      } catch (e) {
        console.error('Could not read error response body');
      }
      
      // ENHANCED: Retry logic with exponential backoff
      if (retryCount < 3 && (response.status >= 500 || response.status === 429 || response.status === 408 || response.status === 502 || response.status === 503)) {
        const retryDelay = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s
        console.log(`🔄 Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return await convertImageUrlToBase64(imageUrl, retryCount + 1);
      }
      
      return null;
    }
    
    console.log('📥 Starting arrayBuffer conversion...');
    const arrayBuffer = await response.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    
    console.log('📊 File Analysis:', {
      sizeBytes: fileSize,
      sizeMB: (fileSize / (1024 * 1024)).toFixed(2),
      isEmpty: fileSize === 0,
      isTooLarge: fileSize > 20 * 1024 * 1024
    });
    
    if (fileSize === 0) {
      console.error('❌ AUDIT FAILURE: Empty file (0 bytes)');
      return null;
    }
    
    if (fileSize > 20 * 1024 * 1024) {
      console.error('❌ AUDIT FAILURE: File too large (>20MB)');
      return null;
    }
    
    // Enhanced Base64 conversion with validation
    console.log('🔄 Converting to base64...');
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Validate that we have actual image data
    const firstBytes = Array.from(uint8Array.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log('🔍 File signature (first 8 bytes):', firstBytes);
    
    const binaryString = String.fromCharCode.apply(null, Array.from(uint8Array));
    const base64String = btoa(binaryString);
    
    if (!base64String || base64String.length < 100) {
      console.error('❌ AUDIT FAILURE: Invalid base64 conversion');
      return null;
    }
    
    console.log('✅ AUDIT SUCCESS: Image converted successfully');
    console.log('📊 Conversion Results:', {
      base64Length: base64String.length,
      conversionTime: `${Date.now() - startTime}ms`,
      preview: base64String.substring(0, 50) + '...'
    });
    
    return base64String;
    
  } catch (error) {
    console.error('❌ AUDIT FAILURE: Exception during image processing');
    console.error('Exception details:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      url: imageUrl,
      attempt: retryCount + 1
    });
    
    // Enhanced retry logic for network/timeout errors
    if (retryCount < 3 && (
      error.name === 'AbortError' || 
      error.message.includes('network') || 
      error.message.includes('timeout') ||
      error.message.includes('fetch')
    )) {
      const retryDelay = Math.pow(2, retryCount) * 3000; // 3s, 6s, 12s
      console.log(`🔄 Retrying due to network error in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
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

    console.log("🎯 AUDIT - Processing request:", {
      trigger: activeTrigger,
      language: language,
      messageLength: message?.length || 0,
      hasFiles: attachedFiles.length > 0,
      fileCount: attachedFiles.length
    });
    
    // ENHANCED: Detailed file debugging
    if (attachedFiles.length > 0) {
      console.log("🖼️ DETAILED FILE AUDIT:");
      attachedFiles.forEach((file, index) => {
        console.log(`File ${index + 1}:`, {
          name: file.name,
          type: file.type,
          hasUrl: !!file.url,
          hasPublicUrl: !!file.publicUrl,
          actualUrl: file.url || file.publicUrl || 'NO_URL',
          urlLength: (file.url || file.publicUrl || '').length,
          imageTypeName: file.imageType?.name || 'NO_TYPE',
          imageTypeId: file.imageType?.id || 'NO_ID',
          hasContext: !!file.context,
          contextLength: file.context?.length || 0,
          contextPreview: file.context ? file.context.substring(0, 100) + '...' : 'NO_CONTEXT'
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

// ENHANCED: Chat mode with comprehensive image debugging
async function processChatMode(message: string, userId: string, conversationId: string | null, language: string, attachedFiles: any[], maxTokens: number, recentMessages: any[], conversationSummary: string, personalTouch: any) {
  console.log("💬 AUDIT - Enhanced chat mode processing");
  console.log("🔍 Chat mode file analysis:", {
    fileCount: attachedFiles.length,
    hasFiles: attachedFiles.length > 0,
    userLanguage: language,
    messagePreview: message.substring(0, 100)
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

// ENHANCED: Claude API with comprehensive debugging and language-aware processing
async function callClaude35API(message: string, contextMessages: any[], conversationSummary: string, language: string, attachedFiles: any[], maxTokens: number, personalTouch: any) {
  console.log("🧠 AUDIT - Enhanced Claude 3.5 API call with comprehensive debugging");
  
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });
  
  // ENHANCED: Improved language detection that considers user preference
  const isArabicMessage = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(message);
  const userPreferredLanguage = language || 'en';
  const responseLanguage = userPreferredLanguage; // Always use user's preferred language
  
  console.log("🌍 LANGUAGE AUDIT:", {
    userPreferredLanguage: userPreferredLanguage,
    messageContainsArabic: isArabicMessage,
    finalResponseLanguage: responseLanguage,
    messagePreview: message.substring(0, 50)
  });
  
  // FIXED: Language-aware system prompt - responds in user's preferred language
  let systemPrompt = responseLanguage === 'ar'
    ? `🤖 أنت WAKTI AI، المساعد الذكي المتطور.

## قدراتك الأساسية:
أنت مساعد ذكي يمكنه التعامل مع جميع أنواع الطلبات بطريقة طبيعية وذكية، مع قدرات متقدمة لتحليل الصور.

## تحليل الصور المتقدم:
### أنواع الصور المدعومة:
- **الوثائق الرسمية** 📄: جوازات السفر، الهويات، رخص القيادة، الشهادات
- **الفواتير والإيصالات** 💰: المستندات المالية والإيصالات
- **الأشخاص** 👤: الصور الشخصية ووصف المظهر
- **الأماكن والمباني** 🏢: المناظر والمعالم
- **التقارير والمخططات** 📊: البيانات والتحليلات
- **النصوص في الصور** 🔤: استخراج وقراءة النصوص
- **تحليل عام** ❓: وصف تفصيلي شامل

### استخراج النصوص الذكي:
- **استخرج النصوص بلغتها الأصلية** (عربية أو إنجليزية)
- **رد دائماً باللغة العربية** حتى لو كان النص المستخرج بالإنجليزية
- **قدم ترجمة إذا لزم الأمر**

التاريخ اليوم: ${currentDate}
**تجيب باللغة العربية فقط دائماً.**`
    : `🤖 You are WAKTI AI, an advanced intelligent assistant.

## Core Capabilities:
You are an intelligent assistant that can handle all types of requests naturally and smartly, with advanced image analysis capabilities.

## Advanced Image Analysis:
### Supported Image Types:
- **Official Documents** 📄: Passports, IDs, driver's licenses, certificates
- **Bills & Receipts** 💰: Financial documents, invoices, receipts
- **People** 👤: Personal photos, appearance descriptions
- **Places & Buildings** 🏢: Landscapes, buildings, landmarks
- **Reports & Charts** 📊: Data visualizations, analytics
- **Text in Images** 🔤: Text extraction and reading
- **General Analysis** ❓: Detailed comprehensive description

### Smart Text Extraction:
- **Extract text in its original language** (Arabic or English)
- **Always respond in English** even if extracted text is in Arabic
- **Provide translation when needed**

Today's date: ${currentDate}
**Always respond in English only.**`;

  // Add personalization if available
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
  
  // ENHANCED: Advanced image processing with comprehensive URL debugging
  let currentMessage: any = { role: 'user', content: message };
  
  if (attachedFiles && attachedFiles.length > 0) {
    console.log('🖼️ AUDIT - Processing attached files with comprehensive debugging');
    
    // Enhanced image file detection
    const imageFile = attachedFiles.find(file => {
      const hasUrl = !!(file.url || file.publicUrl);
      const isImageType = file.type?.startsWith('image/');
      console.log(`🔍 File check: ${file.name}`, {
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
      
      console.log('🎯 COMPREHENSIVE FILE AUDIT:', {
        fileName: imageFile.name,
        imageUrl: imageUrl,
        urlValid: !!imageUrl,
        urlLength: imageUrl?.length || 0,
        imageType: imageType,
        hasImageType: !!imageFile.imageType,
        imageTypeName: imageFile.imageType?.name || 'NONE',
        imageTypeId: imageFile.imageType?.id || 'NONE',
        hasContext: !!imageFile.context,
        contextLength: imageFile.context?.length || 0,
        contextPreview: imageFile.context ? imageFile.context.substring(0, 200) : 'NO_CONTEXT'
      });
      
      if (imageUrl) {
        console.log('🔄 Starting comprehensive base64 conversion audit...');
        const base64Data = await convertImageUrlToBase64(imageUrl);
        
        if (base64Data) {
          console.log('✅ Base64 conversion successful');
          
          // ENHANCED: Simplified and language-aware context handling
          let contextualMessage = message;
          
          if (imageFile.context) {
            // Simple context integration without language conflicts
            contextualMessage = `${imageFile.context}\n\nUser request: ${message}`;
            console.log('✅ Context integrated successfully');
          } else if (imageFile.imageType?.name) {
            // Minimal fallback context
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
          console.error("❌ AUDIT CONCLUSION: Image processing failed at base64 conversion stage");
          return {
            response: responseLanguage === 'ar' 
              ? '❌ عذراً، واجهت صعوبة في معالجة هذه الصورة. يرجى التأكد من أن الصورة قابلة للوصول ومحاولة رفعها مرة أخرى.'
              : '❌ Sorry, I encountered difficulty processing this image. Please ensure the image is accessible and try uploading it again.',
            error: 'Image processing failed at base64 conversion',
            success: false
          };
        }
      } else {
        console.error("❌ AUDIT CONCLUSION: No valid image URL found");
        return {
          response: responseLanguage === 'ar' 
            ? '❌ لم يتم العثور على رابط صحيح للصورة.'
            : '❌ No valid image URL found.',
          error: 'No valid image URL',
          success: false
        };
      }
    } else {
      console.error("❌ AUDIT CONCLUSION: No valid image file found in attachedFiles");
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
  
  try {
    console.log(`🧠 Sending request to Claude API with comprehensive debugging`);
    
    const requestBody = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: maxTokens,
      temperature: 0.3,
      system: systemPrompt,
      messages: messages
    };

    console.log('📤 FINAL CLAUDE REQUEST AUDIT:', {
      model: requestBody.model,
      maxTokens: requestBody.max_tokens,
      systemPromptLanguage: responseLanguage,
      systemPromptLength: requestBody.system.length,
      messageCount: requestBody.messages.length,
      hasImageContent: !!(messages[messages.length - 1]?.content?.find?.(c => c.type === 'image')),
      userLanguage: responseLanguage
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
    
    console.log("📡 Claude API response received:", {
      status: claudeResponse.status,
      ok: claudeResponse.ok,
      statusText: claudeResponse.statusText
    });
    
    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error("❌ CLAUDE API ERROR DETAILS:", {
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
    console.log("✅ Claude API success - response received");
    
    const responseText = claudeData.content?.[0]?.text || (responseLanguage === 'ar' 
      ? 'أعتذر، واجهت مشكلة في معالجة طلبك.'
      : 'I apologize, but I encountered an issue processing your request.');
    
    console.log("🎉 AUDIT COMPLETE - Successfully processed request");
    
    return {
      response: responseText,
      success: true,
      model: 'claude-3-5-sonnet-20241022',
      usage: claudeData.usage
    };
    
  } catch (error) {
    console.error("❌ CLAUDE API CRITICAL ERROR:", error);
    return {
      response: responseLanguage === 'ar' 
        ? '❌ حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.'
        : '❌ An error occurred while processing your request. Please try again.',
      error: error.message,
      success: false
    };
  }
}
