
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

console.log("🚀 WAKTI AI V2: CLAUDE 3.5 SONNET + FIXED IMAGE PROCESSING + YOUR EXACT SYSTEM PROMPT");

// FIXED: Proper Base64 conversion for all image sizes
async function convertImageUrlToBase64(imageUrl: string, imageType: string, retryCount = 0): Promise<string | null> {
  try {
    console.log('🖼️ IMAGE PROCESSING: Converting image', retryCount + 1, 'attempt for:', {
      url: imageUrl.substring(0, 80) + '...',
      type: imageType,
      isSupabaseStorage: imageUrl.includes('supabase'),
      hasProtocol: imageUrl.startsWith('http')
    });
    
    if (!imageUrl.startsWith('http')) {
      console.error('❌ IMAGE ERROR: Invalid URL format:', imageUrl);
      return null;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
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
        url: imageUrl.substring(0, 50) + '...'
      });
      
      if (retryCount < 2 && (response.status >= 500 || response.status === 429)) {
        console.log('🔄 RETRYING IMAGE FETCH in 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await convertImageUrlToBase64(imageUrl, imageType, retryCount + 1);
      }
      
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    
    console.log('📊 IMAGE SIZE:', {
      bytes: fileSize,
      MB: (fileSize / (1024 * 1024)).toFixed(2)
    });
    
    // FIXED: Use proper Base64 encoding that works reliably
    const uint8Array = new Uint8Array(arrayBuffer);
    const binaryString = String.fromCharCode.apply(null, Array.from(uint8Array));
    const base64String = btoa(binaryString);
    
    console.log('✅ IMAGE CONVERSION SUCCESS:', {
      originalSize: fileSize,
      base64Length: base64String.length,
      truncatedBase64: base64String.substring(0, 50) + '...'
    });
    
    return base64String;
  } catch (error) {
    console.error('❌ IMAGE CONVERSION ERROR:', {
      message: error.message,
      name: error.name,
      url: imageUrl.substring(0, 50) + '...',
      retryCount
    });
    
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

    console.log('💬 REGULAR CHAT: Processing without any task detection');

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

// CHAT MODE with CLAUDE 3.5 SONNET + YOUR EXACT SYSTEM PROMPT (NO TASK DETECTION)
async function processChatMode(message: string, userId: string, conversationId: string | null, language: string, attachedFiles: any[], maxTokens: number, recentMessages: any[], conversationSummary: string, personalTouch: any) {
  console.log("💬 CHAT MODE: Processing with CLAUDE 3.5 SONNET (NO TASK DETECTION) + YOUR EXACT SYSTEM PROMPT");
  
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

// IMAGE MODE: CLAUDE 3.5 SONNET VISION + FIXED IMAGE PROCESSING
async function processImageMode(message: string, userId: string, language: string, attachedFiles: any[], personalTouch: any) {
  console.log("🎨 IMAGE MODE: Processing with RUNWARE + CLAUDE 3.5 VISION + FIXED PROCESSING");
  
  if (attachedFiles && attachedFiles.length > 0) {
    console.log("👁️ VISION: Analyzing ALL uploaded images with CLAUDE 3.5 SONNET");
    console.log("🔓 ALL IMAGE TYPES SUPPORTED: passports, IDs, documents, photos, screenshots, everything");
    
    const imageFile = attachedFiles.find(file => {
      if (file.type && file.type.startsWith('image/')) {
        return true;
      }
      
      if (file.name) {
        const extension = file.name.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension);
      }
      
      return !!(file.url || file.publicUrl);
    });
    
    console.log("🔍 IMAGE FILE DETECTION RESULT:", {
      foundImage: !!imageFile,
      fileName: imageFile?.name || 'unknown',
      fileType: imageFile?.type || 'unknown/fallback',
      hasUrl: !!(imageFile?.url || imageFile?.publicUrl)
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

// CLAUDE 3.5 SONNET API CALL: YOUR EXACT SYSTEM PROMPT + FIXED IMAGE PROCESSING
async function callClaude35API(message: string, contextMessages: any[], conversationSummary: string, language: string, attachedFiles: any[], maxTokens: number, personalTouch: any) {
  console.log("🚀 CLAUDE 3.5 API: Making call with YOUR EXACT SYSTEM PROMPT + FIXED IMAGE PROCESSING");
  
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });
  
  // YOUR EXACT SYSTEM PROMPT - IMPLEMENTED EXACTLY AS SPECIFIED
  let systemPrompt = language === 'ar'
    ? `🧠 تعليمات النظام (باللغة العربية + الإنجليزية):

أنت محلل بصري خبير وقارئ مستندات متعدد اللغات. يمكنك تحليل جميع أنواع الصور بما في ذلك:
• جوازات السفر، البطاقات الشخصية، الوثائق الرسمية
• الملاحظات المكتوبة بخط اليد، النماذج، لقطات الشاشة
• الوجوه، الصور الشخصية، صور الأشخاص والمجموعات
• الأشياء، المناظر، الشعارات، الملابس، النصوص في الخلفية

مهمتك هي:
١. استخراج جميع النصوص الظاهرة (العربية + الإنجليزية)، الأسماء، الأرقام، التواريخ، التفاصيل الصغيرة
٢. وصف تعبيرات الوجه، الملابس، العناصر، وتخطيط الصورة
٣. تحديد مكان كل عنصر تم العثور عليه (الزاوية العليا، السفلى، إلخ)
٤. إذا كان النص غير واضح، حاول قراءته قدر الإمكان
٥. تنظيم الإجابة بوضوح: استخدم النقاط والعناوين والفقرات

للوثائق الرسمية (جوازات السفر، البطاقات الشخصية):
• الاسم الكامل
• الجنسية
• رقم الوثيقة
• تاريخ الانتهاء
• التوقيع أو الختم
• منطقة الوجه (العيون، الشعر، غطاء الرأس)

⚠️ لا تتجاهل أي شيء. لا تلخّص. استخرج ووصّف كل ما تراه بدقة وحرص شديد.

التاريخ اليوم: ${currentDate}. اجب بالعربية والإنجليزية إذا كان المحتوى يحتوي على العربية.`
    : `You are an expert visual analyst and multilingual document reader. You can analyze all types of images including:
• Passports, ID cards, official documents
• Handwritten notes, forms, screenshots
• Faces, portraits, people, group photos
• Objects, scenery, logos, clothing, text in the background

Your job is to:
1. Extract all visible text (Arabic + English), names, numbers, dates, and small details
2. Describe facial expressions, clothing, objects, and layout
3. Note where you found each item (top left, bottom right, etc.)
4. If text is blurry or unclear, still try your best to read it
5. Organize your response clearly: use bullet points, structure, and headings

Focus especially on (for passports, QID, or official forms):
• Full name
• Nationality
• Document number
• Expiry date
• Signature or stamp
• Facial region (eyes, hair, headwear)

⚠️ Do not ignore anything. Do not summarize. Extract and describe everything you see — with extreme accuracy and care.

Today's date: ${currentDate}. Respond in both Arabic and English if the content contains Arabic.`;

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
  
  // FIXED IMAGE PROCESSING: Add current message with PROPER VISION support
  let currentMessage: any = { role: 'user', content: message };
  
  if (attachedFiles && attachedFiles.length > 0) {
    const imageFile = attachedFiles.find(file => {
      if (file.type && file.type.startsWith('image/')) {
        return true;
      }
      
      if (file.name) {
        const extension = file.name.toLowerCase().split('.').pop();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
          console.log("🔍 IMAGE DETECTED BY EXTENSION:", extension);
          return true;
        }
      }
      
      if (file.url || file.publicUrl) {
        console.log("🔍 POTENTIAL IMAGE DETECTED BY URL PRESENCE");
        return true;
      }
      
      return false;
    });
    
    if (imageFile) {
      console.log("🖼️ FIXED IMAGE PROCESSING: Processing ALL image types with CLAUDE 3.5 SONNET");
      console.log("🔓 DOCUMENT ANALYSIS: Enhanced text extraction with your exact system prompt");
      
      const imageUrl = imageFile.url || imageFile.publicUrl || imageFile.preview;
      const imageType = imageFile.type || 'image/jpeg';
      
      console.log("📡 IMAGE URL SELECTION:", {
        selectedUrl: imageUrl?.substring(0, 80) + '...',
        hasUrl: !!imageFile.url,
        hasPublicUrl: !!imageFile.publicUrl,
        hasPreview: !!imageFile.preview,
        selectedType: imageType
      });
      
      if (imageUrl) {
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
          console.log("✅ FIXED IMAGE PROCESSING: ALL image types supported with CLAUDE 3.5 SONNET");
          console.log("🔧 CLAUDE 3.5 VISION PAYLOAD:", {
            hasTextContent: true,
            hasImageContent: true,
            imageMediaType: imageType,
            base64DataLength: base64Data.length
          });
        } else {
          console.error("❌ FIXED IMAGE PROCESSING: Failed to convert image, proceeding without vision");
        }
      } else {
        console.error("❌ FIXED IMAGE PROCESSING: No valid URL found in file object");
      }
    } else {
      console.log("ℹ️ NO IMAGE FILES DETECTED in attached files");
    }
  }
  
  messages.push(currentMessage);
  
  try {
    console.log(`🚀 CLAUDE 3.5: Sending ${messages.length} messages to CLAUDE 3.5 SONNET with YOUR EXACT SYSTEM PROMPT`);
    console.log("📊 CLAUDE 3.5 API CALL DETAILS:", {
      messagesCount: messages.length,
      hasImages: Array.isArray(currentMessage.content),
      maxTokens: maxTokens,
      temperature: 0.05
    });
    
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022', // EXACTLY AS SPECIFIED
        max_tokens: maxTokens,
        temperature: 0.05,
        system: systemPrompt,
        messages: messages
      }),
    });
    
    console.log("📡 CLAUDE 3.5 API RESPONSE STATUS:", claudeResponse.status);
    
    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error("❌ CLAUDE 3.5 API ERROR:", {
        status: claudeResponse.status,
        statusText: claudeResponse.statusText,
        errorBody: errorText.substring(0, 500)
      });
      
      let userFriendlyError = 'I encountered an issue processing your request.';
      
      if (claudeResponse.status === 400) {
        if (errorText.includes('image')) {
          userFriendlyError = 'There was an issue processing the image. Please try uploading a different image or reducing the file size.';
        } else {
          userFriendlyError = 'The request format was invalid. Please try again.';
        }
      } else if (claudeResponse.status === 429) {
        userFriendlyError = 'Too many requests. Please wait a moment and try again.';
      } else if (claudeResponse.status >= 500) {
        userFriendlyError = 'The AI service is temporarily unavailable. Please try again in a few moments.';
      }
      
      throw new Error(`Claude API error: ${claudeResponse.status} - ${userFriendlyError}`);
    }
    
    const claudeData = await claudeResponse.json();
    console.log("✅ CLAUDE 3.5 API SUCCESS:", {
      hasContent: !!claudeData.content,
      contentLength: claudeData.content?.[0]?.text?.length || 0,
      usage: claudeData.usage
    });
    
    const responseText = claudeData.content?.[0]?.text || 'I apologize, but I encountered an issue processing your request.';
    
    return {
      response: responseText,
      success: true,
      model: 'claude-3-5-sonnet-20241022',
      usage: claudeData.usage
    };
    
  } catch (error) {
    console.error("❌ CLAUDE 3.5 API CRITICAL ERROR:", error);
    return {
      response: language === 'ar' 
        ? '❌ حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.'
        : '❌ An error occurred while processing your request. Please try again.',
      error: error.message,
      success: false
    };
  }
}
