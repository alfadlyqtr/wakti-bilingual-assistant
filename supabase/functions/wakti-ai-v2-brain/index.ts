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

console.log("🚀 WAKTI AI V2: CLAUDE 3.5 SONNET + ENHANCED PASSPORT PROCESSING + FIXED STATE MANAGEMENT");

// ENHANCED: Advanced image preprocessing for passport/document analysis
async function preprocessImage(imageBuffer: ArrayBuffer, imageType: string): Promise<ArrayBuffer> {
  try {
    console.log('🔧 IMAGE PREPROCESSING: Starting advanced preprocessing for documents');
    
    // For now, return original buffer - preprocessing would require additional libraries
    // In production, you could add image processing libraries here
    console.log('✅ IMAGE PREPROCESSING: Using original image (preprocessing libraries not available in edge runtime)');
    return imageBuffer;
    
  } catch (error) {
    console.error('❌ IMAGE PREPROCESSING ERROR:', error);
    return imageBuffer; // Fallback to original
  }
}

// ENHANCED: Improved Base64 conversion with better error handling and preprocessing
async function convertImageUrlToBase64(imageUrl: string, imageType: string, retryCount = 0): Promise<string | null> {
  try {
    console.log('🖼️ ENHANCED IMAGE PROCESSING: Starting conversion with preprocessing', {
      attempt: retryCount + 1,
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
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout for documents
    
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'WAKTI-AI-PASSPORT-ANALYZER/2.0',
        'Accept': 'image/*,*/*;q=0.8',
        'Cache-Control': 'no-cache'
      }
    });
    
    clearTimeout(timeoutId);
    
    console.log('📡 ENHANCED IMAGE FETCH: Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      console.error('❌ IMAGE FETCH ERROR:', {
        status: response.status,
        statusText: response.statusText,
        url: imageUrl.substring(0, 50) + '...',
        headers: Object.fromEntries(response.headers.entries())
      });
      
      // Retry logic for failed requests (up to 3 retries for documents)
      if (retryCount < 3 && (response.status >= 500 || response.status === 429)) {
        console.log('🔄 RETRYING IMAGE FETCH in 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        return await convertImageUrlToBase64(imageUrl, imageType, retryCount + 1);
      }
      
      return null;
    }
    
    const contentType = response.headers.get('content-type');
    console.log('📋 IMAGE CONTENT TYPE:', contentType);
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Apply preprocessing for document images
    const processedBuffer = await preprocessImage(arrayBuffer, imageType);
    
    // Enhanced base64 conversion with proper error handling
    const uint8Array = new Uint8Array(processedBuffer);
    let base64String = '';
    
    // Process in chunks to avoid memory issues with large images
    const chunkSize = 0x8000; // 32KB chunks
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      base64String += btoa(String.fromCharCode(...chunk));
    }
    
    console.log('✅ ENHANCED IMAGE CONVERSION SUCCESS:', {
      originalSize: arrayBuffer.byteLength,
      processedSize: processedBuffer.byteLength,
      base64Length: base64String.length,
      detectedType: contentType || imageType,
      isLargeImage: arrayBuffer.byteLength > 1024 * 1024,
      preprocessingApplied: processedBuffer !== arrayBuffer,
      truncatedBase64: base64String.substring(0, 50) + '...'
    });
    
    return base64String;
  } catch (error) {
    console.error('❌ ENHANCED IMAGE CONVERSION CRITICAL ERROR:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 300),
      url: imageUrl.substring(0, 50) + '...',
      retryCount
    });
    
    // Retry on network errors
    if (retryCount < 3 && (error.name === 'AbortError' || error.name === 'TypeError')) {
      console.log('🔄 RETRYING IMAGE CONVERSION due to network error...');
      await new Promise(resolve => setTimeout(resolve, 2000));
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
      enableTaskDetection = false
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
      enableTaskDetection
    });

    // Enhanced attached files analysis for passport detection
    if (attachedFiles && attachedFiles.length > 0) {
      console.log("📎 ENHANCED ATTACHED FILES ANALYSIS:", attachedFiles.map((file, index) => ({
        index,
        name: file?.name || 'unknown',
        type: file?.type || 'unknown',
        size: file?.size || 'unknown',
        url: file?.url?.substring(0, 50) + '...' || 'missing',
        publicUrl: file?.publicUrl?.substring(0, 50) + '...' || 'missing',
        hasPreview: !!file?.preview,
        isLikelyPassport: (file?.name || '').toLowerCase().includes('passport') || 
                         (file?.name || '').toLowerCase().includes('id') ||
                         (file?.name || '').toLowerCase().includes('qid'),
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
    console.log(`🚫 TASK DETECTION: ${enableTaskDetection ? 'ENABLED' : 'DISABLED'}`);

    let result;
    const finalConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // MODE-BASED PROCESSING with ENHANCED IMAGE SUPPORT
    switch (activeTrigger) {
      case 'search':
        result = await processSearchMode(message, language, recentMessages, personalTouch);
        break;
        
      case 'image':
        result = await processEnhancedImageMode(message, userId, language, attachedFiles, personalTouch);
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
      needsConfirmation: false,
      pendingTaskData: null,
      pendingReminderData: null,
      success: result.success !== false,
      processingTime: Date.now(),
      aiProvider: 'claude-3-5-sonnet-20241022',
      claude4Enabled: false,
      mode: activeTrigger,
      fallbackUsed: false
    };

    console.log(`✅ ${activeTrigger.toUpperCase()} MODE: ENHANCED request completed successfully!`);

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

// ENHANCED CHAT MODE with IMPROVED IMAGE PROCESSING
async function processChatMode(message: string, userId: string, conversationId: string | null, language: string, attachedFiles: any[], maxTokens: number, recentMessages: any[], conversationSummary: string, personalTouch: any) {
  console.log("💬 ENHANCED CHAT MODE: Processing with SONNET + ADVANCED IMAGE ANALYSIS");
  
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
  
  return await callEnhancedSonnetAPI(message, contextMessages, conversationSummary, language, attachedFiles, maxTokens, personalTouch);
}

// ENHANCED SEARCH MODE
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
    
    return await callEnhancedSonnetAPI(searchContext, recentMessages, '', language, [], 4096, personalTouch);
    
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

// ENHANCED IMAGE MODE with SPECIALIZED PASSPORT PROCESSING
async function processEnhancedImageMode(message: string, userId: string, language: string, attachedFiles: any[], personalTouch: any) {
  console.log("🎨 ENHANCED IMAGE MODE: Processing with SPECIALIZED PASSPORT SUPPORT + SONNET VISION");
  
  // Enhanced image processing for ALL uploaded images with passport specialization
  if (attachedFiles && attachedFiles.length > 0) {
    console.log("👁️ ENHANCED VISION: Analyzing uploaded images with PASSPORT SPECIALIZATION");
    
    const imageFile = attachedFiles.find(file => {
      if (file.type && file.type.startsWith('image/')) return true;
      if (file.name) {
        const extension = file.name.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension);
      }
      return !!(file.url || file.publicUrl);
    });
    
    console.log("🔍 ENHANCED IMAGE DETECTION RESULT:", {
      foundImage: !!imageFile,
      fileName: imageFile?.name || 'unknown',
      fileType: imageFile?.type || 'unknown/fallback',
      hasUrl: !!(imageFile?.url || imageFile?.publicUrl),
      isLikelyPassport: imageFile && ((imageFile.name || '').toLowerCase().includes('passport') || 
                                    (imageFile.name || '').toLowerCase().includes('id') ||
                                    (imageFile.name || '').toLowerCase().includes('qid'))
    });
    
    return await callEnhancedSonnetAPI(message, [], '', language, attachedFiles, 4096, personalTouch);
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

// ENHANCED SONNET API with SPECIALIZED PASSPORT PROCESSING
async function callEnhancedSonnetAPI(message: string, contextMessages: any[], conversationSummary: string, language: string, attachedFiles: any[], maxTokens: number, personalTouch: any) {
  console.log("🚀 ENHANCED SONNET API: Advanced passport processing + multilingual extraction");
  
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });
  
  // ENHANCED SYSTEM PROMPT with USER'S SPECIALIZED PASSPORT EXTRACTION
  let systemPrompt = language === 'ar'
    ? `أنت محلل بصري خبير وقارئ مستندات متعدد اللغات في WAKTI AI. يمكنك تحليل جميع أنواع الصور بما في ذلك:

جوازات السفر، البطاقات الشخصية، الوثائق الرسمية
الملاحظات المكتوبة بخط اليد، النماذج، لقطات الشاشة  
الوجوه، الصور الشخصية، صور الأشخاص والمجموعات
الأشياء، المناظر، الشعارات، الملابس، النصوص في الخلفية

مهمتك هي:
١. استخراج جميع النصوص الظاهرة (العربية + الإنجليزية)، الأسماء، الأرقام، التواريخ، التفاصيل الصغيرة
٢. وصف تعبيرات الوجه، الملابس، العناصر، وتخطيط الصورة
٣. تحديد مكان كل عنصر تم العثور عليه (الزاوية العليا، السفلى، إلخ)
٤. إذا كان النص غير واضح، حاول قراءته قدر الإمكان
٥. تنظيم الإجابة بوضوح: استخدم النقاط والعناوين والفقرات

⚠️ لا تتجاهل أي شيء. لا تلخّص. استخرج ووصّف كل ما تراه بدقة وحرص فائق.

للوثائق الرسمية (جوازات السفر، بطاقات الهوية):
- ركز خاصة على: الاسم الكامل، الجنسية، رقم الوثيقة، تاريخ الانتهاء، التوقيع أو الختم، منطقة الوجه (العيون، الشعر، غطاء الرأس)

التاريخ اليوم: ${currentDate}`
    : `You are an expert visual analyst and multilingual document reader in WAKTI AI. You can analyze all types of images including:

Passports, ID cards, official documents
Handwritten notes, forms, screenshots
Faces, portraits, people, group photos
Objects, scenery, logos, clothing, text in the background

Your job is to:
1. Extract all visible text (Arabic + English), names, numbers, dates, and small details
2. Describe facial expressions, clothing, objects, and layout
3. Note where you found each item (top left, bottom right, etc.)
4. If text is blurry or unclear, still try your best to read it
5. Organize your response clearly: use bullet points, structure, and headings

⚠️ Do not ignore anything. Do not summarize. Extract and describe everything you see — with extreme accuracy and care.

For official documents (passports, ID cards, official forms):
- Focus especially on: Full name, Nationality, Document number, Expiry date, Signature or stamp, Facial region (eyes, hair, headwear)

Today's date: ${currentDate}`;

  // Apply personalization
  if (personalTouch && personalTouch.instruction) {
    systemPrompt += `\n\nPersonalization: ${personalTouch.instruction}`;
    if (personalTouch.tone) systemPrompt += ` Use a ${personalTouch.tone} tone.`;
    if (personalTouch.style) systemPrompt += ` Reply in ${personalTouch.style} style.`;
  }

  const messages = [];
  
  // Add conversation context
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
  
  // ENHANCED IMAGE PROCESSING with specialized handling
  let currentMessage: any = { role: 'user', content: message };
  
  if (attachedFiles && attachedFiles.length > 0) {
    const imageFile = attachedFiles.find(file => {
      if (file.type && file.type.startsWith('image/')) return true;
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
      console.log("🖼️ ENHANCED PASSPORT PROCESSING: Specialized document analysis activated");
      
      const imageUrl = imageFile.url || imageFile.publicUrl || imageFile.preview;
      const imageType = imageFile.type || 'image/jpeg';
      
      console.log("📡 ENHANCED IMAGE URL SELECTION:", {
        selectedUrl: imageUrl?.substring(0, 80) + '...',
        hasUrl: !!imageFile.url,
        hasPublicUrl: !!imageFile.publicUrl,
        hasPreview: !!imageFile.preview,
        selectedType: imageType,
        isLikelyPassport: (imageFile.name || '').toLowerCase().includes('passport') || 
                         (imageFile.name || '').toLowerCase().includes('id')
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
          console.log("✅ ENHANCED PASSPORT PROCESSING: Specialized analysis ready");
        } else {
          console.error("❌ ENHANCED IMAGE PROCESSING: Failed conversion, proceeding without vision");
        }
      } else {
        console.error("❌ ENHANCED IMAGE PROCESSING: No valid URL found");
      }
    }
  }
  
  messages.push(currentMessage);
  
  try {
    console.log(`🚀 ENHANCED SONNET: Sending ${messages.length} messages with SPECIALIZED PASSPORT SUPPORT`);
    
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
        temperature: 0.02, // Ultra-low for document accuracy
        system: systemPrompt,
        messages: messages
      }),
    });
    
    console.log("📡 ENHANCED CLAUDE API RESPONSE STATUS:", claudeResponse.status, claudeResponse.statusText);
    
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
    
    console.log("📝 ENHANCED CLAUDE RESPONSE PREVIEW:", aiResponse.substring(0, 200) + '...');
    
    // Apply enhanced personalization
    if (personalTouch) {
      aiResponse = applyEnhancedPersonalization(aiResponse, personalTouch, language, contextMessages.length > 0);
    }
    
    console.log("🚀 ENHANCED SONNET: Specialized passport processing completed successfully!");
    
    return {
      response: aiResponse,
      model: 'claude-3-5-sonnet-20241022',
      success: true
    };
    
  } catch (error) {
    console.error('❌ ENHANCED SONNET CRITICAL ERROR:', {
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

// ENHANCED PERSONALIZATION
function applyEnhancedPersonalization(response: string, personalTouch: any, language: string, hasContext: boolean): string {
  let enhancedResponse = response;
  
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
    if (!enhancedResponse.toLowerCase().startsWith('as ') && !enhancedResponse.startsWith('كما')) {
      enhancedResponse = randomPhrase + enhancedResponse.charAt(0).toLowerCase() + enhancedResponse.slice(1);
    }
  }
  
  if (personalTouch.aiNickname && Math.random() < 0.2) {
    const signature = language === 'ar' 
      ? `\n\n- ${personalTouch.aiNickname} 🤖`
      : `\n\n- ${personalTouch.aiNickname} 🤖`;
    enhancedResponse += signature;
  }
  
  return enhancedResponse;
}
