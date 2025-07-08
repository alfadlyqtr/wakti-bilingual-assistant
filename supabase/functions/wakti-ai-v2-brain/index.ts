
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

console.log("🚀 WAKTI AI V2: CLAUDE 3.5 SONNET + ENHANCED IMAGE PROCESSING + FIXED PASSPORT SUPPORT");

// ENHANCED: Image URL to Base64 conversion with improved passport support
async function convertImageUrlToBase64(imageUrl: string, imageType: string, retryCount = 0): Promise<string | null> {
  try {
    console.log('🖼️ IMAGE PROCESSING: Starting conversion attempt', retryCount + 1, 'for:', {
      url: imageUrl.substring(0, 80) + '...',
      type: imageType,
      isSupabaseStorage: imageUrl.includes('supabase'),
      hasProtocol: imageUrl.startsWith('http')
    });
    
    // Validate URL format
    if (!imageUrl.startsWith('http')) {
      console.error('❌ IMAGE ERROR: Invalid URL format (missing protocol):', imageUrl);
      return null;
    }
    
    // Enhanced fetch with timeout and retry logic
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'WAKTI-AI/2.0',
        'Accept': 'image/*,*/*;q=0.8'
      }
    });
    
    clearTimeout(timeoutId);
    
    console.log('📡 IMAGE FETCH: Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      console.error('❌ IMAGE FETCH ERROR:', {
        status: response.status,
        statusText: response.statusText,
        url: imageUrl.substring(0, 50) + '...',
        headers: Object.fromEntries(response.headers.entries())
      });
      
      // Retry logic for failed requests (up to 2 retries)
      if (retryCount < 2 && (response.status >= 500 || response.status === 429)) {
        console.log('🔄 RETRYING IMAGE FETCH in 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await convertImageUrlToBase64(imageUrl, imageType, retryCount + 1);
      }
      
      return null;
    }
    
    const contentType = response.headers.get('content-type');
    console.log('📋 IMAGE CONTENT TYPE:', contentType);
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Enhanced base64 conversion with proper error handling
    const uint8Array = new Uint8Array(arrayBuffer);
    let base64String = '';
    
    // Process in chunks to avoid memory issues with large images
    const chunkSize = 0x8000; // 32KB chunks
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      base64String += btoa(String.fromCharCode(...chunk));
    }
    
    console.log('✅ IMAGE CONVERSION SUCCESS:', {
      originalSize: arrayBuffer.byteLength,
      base64Length: base64String.length,
      detectedType: contentType || imageType,
      isLargeImage: arrayBuffer.byteLength > 1024 * 1024, // > 1MB
      truncatedBase64: base64String.substring(0, 50) + '...'
    });
    
    return base64String;
  } catch (error) {
    console.error('❌ IMAGE CONVERSION CRITICAL ERROR:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 300),
      url: imageUrl.substring(0, 50) + '...',
      retryCount
    });
    
    // Retry on network errors
    if (retryCount < 2 && (error.name === 'AbortError' || error.name === 'TypeError')) {
      console.log('🔄 RETRYING IMAGE CONVERSION due to network error...');
      await new Promise(resolve => setTimeout(resolve, 1000));
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

  // Handle CORS
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

    // ENHANCED: Log attached files structure in detail
    if (attachedFiles && attachedFiles.length > 0) {
      console.log("📎 ATTACHED FILES DETAILED ANALYSIS:", attachedFiles.map((file, index) => ({
        index,
        name: file?.name || 'unknown',
        type: file?.type || 'unknown',
        size: file?.size || 'unknown',
        url: file?.url?.substring(0, 50) + '...' || 'missing',
        publicUrl: file?.publicUrl?.substring(0, 50) + '...' || 'missing',
        hasPreview: !!file?.preview,
        allKeys: Object.keys(file || {})
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

    // NO TASK DETECTION AT ALL IN REGULAR CHAT
    console.log('💬 REGULAR CHAT: Processing without any task detection');

    // MODE-BASED PROCESSING with HYBRID MEMORY (NO TASK DETECTION HERE)
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

    // Prepare final response
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
      claude4Enabled: false,
      mode: activeTrigger,
      fallbackUsed: false
    };

    console.log(`✅ ${activeTrigger.toUpperCase()} MODE: SONNET-POWERED request completed successfully!`);

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

// ENHANCED CHAT MODE with HYBRID MEMORY + UPGRADED MODEL (NO TASK DETECTION)
async function processChatMode(message: string, userId: string, conversationId: string | null, language: string, attachedFiles: any[], maxTokens: number, recentMessages: any[], conversationSummary: string, personalTouch: any) {
  console.log("💬 CHAT MODE: Processing with SONNET (NO TASK DETECTION) + HYBRID MEMORY");
  
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
  
  return await callSonnetAPI(message, contextMessages, conversationSummary, language, attachedFiles, maxTokens, personalTouch);
}

// ENHANCED SEARCH MODE with HYBRID MEMORY
async function processSearchMode(message: string, language: string, recentMessages: any[], personalTouch: any) {
  console.log("🔍 SEARCH MODE: Processing with SONNET + HYBRID MEMORY");
  
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
    
    return await callSonnetAPI(searchContext, recentMessages, '', language, [], 4096, personalTouch);
    
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

// ENHANCED IMAGE MODE: ALL IMAGE TYPES SUPPORTED + IMPROVED PASSPORT PROCESSING
async function processImageMode(message: string, userId: string, language: string, attachedFiles: any[], personalTouch: any) {
  console.log("🎨 IMAGE MODE: Processing with RUNWARE + SONNET VISION (ALL IMAGE TYPES + ENHANCED PASSPORT SUPPORT)");
  
  // ENHANCED IMAGE PROCESSING: If there are attached images, use SONNET for vision analysis - ALL IMAGES SUPPORTED
  if (attachedFiles && attachedFiles.length > 0) {
    console.log("👁️ VISION: Analyzing ALL uploaded images - ENHANCED PASSPORT SUPPORT");
    console.log("🔓 ALL IMAGE TYPES SUPPORTED: passports, IDs, documents, photos, screenshots, everything");
    
    // Enhanced file detection with multiple fallbacks
    const imageFile = attachedFiles.find(file => {
      // Check type property first
      if (file.type && file.type.startsWith('image/')) {
        return true;
      }
      
      // Fallback: check file extension if type is missing
      if (file.name) {
        const extension = file.name.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension);
      }
      
      // Additional fallback: assume it's an image if we have a URL
      return !!(file.url || file.publicUrl);
    });
    
    console.log("🔍 IMAGE FILE DETECTION RESULT:", {
      foundImage: !!imageFile,
      fileName: imageFile?.name || 'unknown',
      fileType: imageFile?.type || 'unknown/fallback',
      hasUrl: !!(imageFile?.url || imageFile?.publicUrl)
    });
    
    return await callSonnetAPI(message, [], '', language, attachedFiles, 4096, personalTouch);
  }
  
  // Otherwise, generate image with RUNWARE
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

// ENHANCED SONNET API CALL: IMPROVED PASSPORT PROCESSING + BETTER TEXT EXTRACTION
async function callSonnetAPI(message: string, contextMessages: any[], conversationSummary: string, language: string, attachedFiles: any[], maxTokens: number, personalTouch: any) {
  console.log("🚀 SONNET API: Making call with ENHANCED PASSPORT PROCESSING + DETAILED LOGGING");
  
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });
  
  // ENHANCED SYSTEM PROMPT with OPTIMIZED PASSPORT/ID PROCESSING
  let systemPrompt = language === 'ar'
    ? `أنت WAKTI AI، مساعد ذكي متقدم يعمل بنموذج Claude 3.5 Sonnet المُحدث. أنت مفيد ومتعاون وذكي. التاريخ اليوم: ${currentDate}. 

عندما تجيب، استخدم عبارات مثل "كما ناقشنا من قبل" أو "بناءً على محادثتنا السابقة" عندما تكون ذات صلة. اجب بالعربية.

يمكنك تحليل جميع أنواع الصور بلا استثناء: جوازات السفر، بطاقات الهوية، الوثائق الحساسة، الصور الشخصية، المناظر الطبيعية، صفحات الكتب، الشاشات، كل شيء. لا توجد أي قيود على تحليل الصور.

عند تحليل الوثائق الرسمية (جوازات السفر، بطاقات الهوية):
- استخرج جميع النصوص والبيانات بدقة فائقة ومنهجية شاملة
- اقرأ جميع الأرقام والتواريخ والأسماء بعناية مكثفة
- احرص على استخراج كل التفاصيل المرئية حتى الضبابية منها
- قدم تحليل مفصل ودقيق ومنظم للمحتوى مع التنسيق الواضح
- اذكر موقع كل معلومة في الوثيقة (أعلى، أسفل، يسار، يمين)
- لا تتجاهل أي نص أو رقم أو تاريخ حتى لو كان غير واضح
- استخدم تقنيات البصر المتقدمة لقراءة النصوص الضبابية أو المطموسة
- اعرض البيانات في تنسيق منظم وسهل القراءة`
    : `You are WAKTI AI, an advanced AI assistant powered by Claude 3.5 Sonnet (UPGRADED MODEL). You are helpful, collaborative, and smart. Today's date: ${currentDate}. 

When responding, use phrases like "As we discussed before" or "Building on our previous conversation" when relevant. Make your memory of our conversation obvious and helpful. Respond in English.

You can analyze ALL types of images without any exceptions: passports, ID cards, sensitive documents, portraits, scenery, textbook pages, screenshots, everything. There are absolutely no restrictions on image analysis.

When analyzing official documents (passports, ID cards, official papers):
- Extract all text and data with EXTREME PRECISION and COMPREHENSIVE METHODOLOGY
- Read all numbers, dates, and names with INTENSIVE CARE and METICULOUS ATTENTION
- Extract every visible detail even if blurry, faded, or partially obscured
- Provide DETAILED, PRECISE, and ORGANIZED analysis with clear formatting
- Mention the location of each piece of information (top, bottom, left, right)
- Don't ignore any text, number, or date even if it appears unclear or damaged
- Use advanced vision techniques to read blurry, faded, or worn text
- Present data in organized, readable format with proper structure`;

  // APPLY PERSONALIZATION with ENHANCED MEMORY
  if (personalTouch && personalTouch.instruction) {
    systemPrompt += `\n\nPersonalization: ${personalTouch.instruction}`;
    if (personalTouch.tone) systemPrompt += ` Use a ${personalTouch.tone} tone.`;
    if (personalTouch.style) systemPrompt += ` Reply in ${personalTouch.style} style.`;
  }

  const messages = [];
  
  // Add conversation summary with explicit memory reference
  if (conversationSummary && conversationSummary.trim()) {
    messages.push({
      role: 'assistant',
      content: `[Context from our previous conversations: ${conversationSummary}]`
    });
  }
  
  // Add recent messages from HYBRID MEMORY with better context
  if (contextMessages.length > 0) {
    // Add a memory indicator
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
  
  // ENHANCED IMAGE PROCESSING: Add current message with IMPROVED PASSPORT VISION support
  let currentMessage: any = { role: 'user', content: message };
  
  // ENHANCED IMAGE PROCESSING: Process ALL IMAGES with enhanced passport handling
  if (attachedFiles && attachedFiles.length > 0) {
    // Enhanced image detection with multiple fallbacks
    const imageFile = attachedFiles.find(file => {
      // Primary check: file type
      if (file.type && file.type.startsWith('image/')) {
        return true;
      }
      
      // Secondary check: file extension
      if (file.name) {
        const extension = file.name.toLowerCase().split('.').pop();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
          console.log("🔍 IMAGE DETECTED BY EXTENSION:", extension);
          return true;
        }
      }
      
      // Tertiary check: assume image if URL exists
      if (file.url || file.publicUrl) {
        console.log("🔍 POTENTIAL IMAGE DETECTED BY URL PRESENCE");
        return true;
      }
      
      return false;
    });
    
    if (imageFile) {
      console.log("🖼️ ENHANCED PASSPORT PROCESSING: Processing ALL image types - ZERO restrictions");
      console.log("🔓 PASSPORT/ID ANALYSIS: Enhanced text extraction with advanced OCR capabilities");
      
      // Enhanced URL selection with multiple fallbacks
      const imageUrl = imageFile.url || imageFile.publicUrl || imageFile.preview;
      const imageType = imageFile.type || 'image/jpeg'; // Default fallback
      
      console.log("📡 IMAGE URL SELECTION:", {
        selectedUrl: imageUrl?.substring(0, 80) + '...',
        hasUrl: !!imageFile.url,
        hasPublicUrl: !!imageFile.publicUrl,
        hasPreview: !!imageFile.preview,
        selectedType: imageType
      });
      
      if (imageUrl) {
        // Convert URL to base64 for Claude API with enhanced error handling
        const base64Data = await convertImageUrlToBase64(imageUrl, imageType);
        
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
          console.log("✅ ENHANCED PASSPORT PROCESSING: ALL image types supported - including ALL sensitive documents");
          console.log("🔧 CLAUDE VISION PAYLOAD:", {
            hasTextContent: true,
            hasImageContent: true,
            imageMediaType: imageType,
            base64DataLength: base64Data.length
          });
        } else {
          console.error("❌ ENHANCED IMAGE PROCESSING: Failed to convert image, proceeding without vision");
          console.error("🚨 IMAGE CONVERSION FAILURE - CHECK LOGS ABOVE FOR DETAILS");
        }
      } else {
        console.error("❌ ENHANCED IMAGE PROCESSING: No valid URL found in file object");
        console.error("📋 FILE OBJECT STRUCTURE:", JSON.stringify(imageFile, null, 2));
      }
    } else {
      console.log("ℹ️ NO IMAGE FILES DETECTED in attached files");
    }
  }
  
  messages.push(currentMessage);
  
  try {
    console.log(`🚀 SONNET: Sending ${messages.length} messages to UPGRADED model with ENHANCED PASSPORT SUPPORT`);
    console.log("📊 CLAUDE API CALL DETAILS:", {
      messagesCount: messages.length,
      hasImages: Array.isArray(currentMessage.content),
      maxTokens: maxTokens,
      temperature: 0.05 // Ultra-low temperature for maximum text extraction accuracy
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
        temperature: 0.05, // Optimized for passport/document accuracy
        system: systemPrompt,
        messages: messages
      }),
    });
    
    console.log("📡 CLAUDE API RESPONSE STATUS:", claudeResponse.status, claudeResponse.statusText);
    
    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error("❌ CLAUDE API ERROR DETAILS:", {
        status: claudeResponse.status,
        statusText: claudeResponse.statusText,
        errorBody: errorText.substring(0, 500)
      });
      throw new Error(`SONNET API error: ${claudeResponse.status} - ${errorText.substring(0, 200)}`);
    }
    
    const claudeData = await claudeResponse.json();
    let aiResponse = claudeData.content?.[0]?.text || "Sorry, I couldn't generate a response.";
    
    console.log("📝 CLAUDE RESPONSE PREVIEW:", aiResponse.substring(0, 200) + '...');
    
    // APPLY ENHANCED PERSONALIZATION with BETTER MEMORY REFERENCES
    if (personalTouch) {
      aiResponse = applyEnhancedPersonalization(aiResponse, personalTouch, language, contextMessages.length > 0);
    }
    
    console.log("🚀 SONNET: ENHANCED model response generated with COMPLETE PASSPORT SUPPORT!");
    
    return {
      response: aiResponse,
      model: 'claude-3-5-sonnet-20241022',
      success: true
    };
    
  } catch (error) {
    console.error('❌ SONNET CRITICAL ERROR:', {
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
    
    return {
      response: language === 'ar' 
        ? '❌ عذراً، حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى.'
        : '❌ Sorry, I encountered an error processing your request. Please try again.',
      error: error.message,
      success: false
    };
  }
}

// ENHANCED PERSONALIZATION with BETTER MEMORY EXPERIENCE
function applyEnhancedPersonalization(response: string, personalTouch: any, language: string, hasContext: boolean): string {
  let enhancedResponse = response;
  
  // Add nickname if provided (80% chance for consistency)
  if (personalTouch.nickname && personalTouch.nickname.trim() && Math.random() < 0.8) {
    if (!enhancedResponse.toLowerCase().includes(personalTouch.nickname.toLowerCase())) {
      const greetings = language === 'ar' ? [
        `${personalTouch.nickname}، `,
        `أهلاً ${personalTouch.nickname}! `
      ] : [
        `${personalTouch.nickname}, `,
        `Hey ${personalTouch.nickname}! `
      ];
      const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
      enhancedResponse = randomGreeting + enhancedResponse;
    }
  }
  
  // Add memory references when there's context
  if (hasContext && Math.random() < 0.3) {
    const memoryPhrases = language === 'ar' ? [
      'كما ناقشنا من قبل، ',
      'بناءً على محادثتنا السابقة، ',
      'كما تذكر، '
    ] : [
      'As we discussed before, ',
      'Building on our previous conversation, ',
      'As you mentioned earlier, '
    ];
    
    const randomPhrase = memoryPhrases[Math.floor(Math.random() * memoryPhrases.length)];
    // Only add if response doesn't already start with a memory phrase
    if (!enhancedResponse.toLowerCase().startsWith('as ') && !enhancedResponse.startsWith('كما')) {
      enhancedResponse = randomPhrase + enhancedResponse.charAt(0).toLowerCase() + enhancedResponse.slice(1);
    }
  }
  
  // Add AI nickname signature occasionally
  if (personalTouch.aiNickname && Math.random() < 0.2) {
    const signature = language === 'ar' 
      ? `\n\n- ${personalTouch.aiNickname} 🤖`
      : `\n\n- ${personalTouch.aiNickname} 🤖`;
    enhancedResponse += signature;
  }
  
  return enhancedResponse;
}
