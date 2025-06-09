import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

console.log("🔍 WAKTI AI V2.5 SMART FILE PROCESSING: Enhanced with DeepSeek vision and file analysis");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🎯 WAKTI AI V2.5: === SMART FILE PROCESSING REQUEST START ===");
    console.log("🎯 WAKTI AI V2.5: Request method:", req.method);

    const requestBody = await req.json();
    console.log("🎯 WAKTI AI V2.5: Raw request body received");
    console.log("🎯 WAKTI AI V2.5: ✅ Successfully parsed request body");

    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      conversationHistory = [],
      confirmSearch = false,
      activeTrigger = 'chat',
      textGenParams = null,
      attachedFiles = []
    } = requestBody;

    console.log("🎯 WAKTI AI V2.5: === EXTRACTED FIELDS ===");
    console.log("🎯 WAKTI AI V2.5: Message:", message);
    console.log("🎯 WAKTI AI V2.5: User ID:", userId);
    console.log("🎯 WAKTI AI V2.5: Language:", language);
    console.log("🎯 WAKTI AI V2.5: Active Trigger (ABSOLUTE CONTROLLER):", activeTrigger);
    console.log("🎯 WAKTI AI V2.5: Input Type:", inputType);
    console.log("🎯 WAKTI AI V2.5: Text Gen Params:", textGenParams);
    console.log("🎯 WAKTI AI V2.5: Attached Files:", attachedFiles?.length || 0);
    console.log("🎯 WAKTI AI V2.5: Confirm Search:", confirmSearch);

    console.log("🎯 WAKTI AI V2.5: === STARTING ULTRA-STRICT TRIGGER ANALYSIS ===");

    console.log("🎯 WAKTI AI V2.5: === ULTRA-STRICT TRIGGER ANALYSIS ===");
    console.log("🎯 WAKTI AI V2.5: Message:", message);
    console.log("🎯 WAKTI AI V2.5: Active trigger (ABSOLUTE CONTROLLER):", activeTrigger);
    console.log("🎯 WAKTI AI V2.5: Language:", language);
    console.log("🎯 WAKTI AI V2.5: Text Gen Params:", textGenParams);
    console.log("🎯 WAKTI AI V2.5: Attached Files:", attachedFiles?.length || 0);

    const triggerResult = analyzeUltraStrictTrigger(message, activeTrigger, language);
    console.log("🎯 WAKTI AI V2.5: === ULTRA-STRICT TRIGGER RESULT ===");
    console.log("🎯 WAKTI AI V2.5: Intent:", triggerResult.intent);
    console.log("🎯 WAKTI AI V2.5: Requires Browsing:", triggerResult.requiresBrowsing);
    console.log("🎯 WAKTI AI V2.5: Trigger Mode:", activeTrigger);
    console.log("🎯 WAKTI AI V2.5: Strict Mode:", triggerResult.strictMode);

    const response = await processWithUltraStrictTriggerControl(
      message,
      userId,
      language,
      conversationId,
      inputType,
      conversationHistory,
      confirmSearch,
      activeTrigger,
      textGenParams,
      attachedFiles || []
    );

    console.log("🎯 WAKTI AI V2.5: === PROCESSING WITH ULTRA-STRICT TRIGGER CONTROL ===");

    const result = {
      response: response.response,
      conversationId: response.conversationId || conversationId || generateConversationId(),
      intent: triggerResult.intent,
      confidence: triggerResult.confidence,
      actionTaken: response.actionTaken,
      actionResult: response.actionResult,
      imageUrl: response.imageUrl,
      browsingUsed: response.browsingUsed,
      browsingData: response.browsingData,
      quotaStatus: response.quotaStatus,
      requiresSearchConfirmation: response.requiresSearchConfirmation,
      needsConfirmation: false,
      needsClarification: false,
      success: true
    };

    console.log("🎯 WAKTI AI V2.5: Strict Mode:", triggerResult.strictMode);
    console.log("🎯 WAKTI AI V2.5: Trigger Mode:", activeTrigger);
    console.log("🎯 WAKTI AI V2.5: Intent:", triggerResult.intent);
    console.log("🎯 WAKTI AI V2.5: Browsing Used:", response.browsingUsed);
    console.log("🎯 WAKTI AI V2.5: Files Processed:", attachedFiles?.length || 0);
    console.log("🎯 WAKTI AI V2.5: === REQUEST END ===");

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🎯 WAKTI AI V2.5: Error processing request:", error);
    
    const errorResponse = {
      error: error.message || 'Unknown error occurred',
      success: false
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// Fixed image analysis with proper DeepSeek vision model and authenticated file access
async function analyzeImageWithDeepSeek(fileName: string, imageUrl: string): Promise<string> {
  try {
    console.log("🖼️ Analyzing image with DeepSeek vision:", fileName);
    
    if (!DEEPSEEK_API_KEY) {
      console.log("🖼️ DeepSeek API key not available, falling back to OpenAI");
      return await analyzeImageWithOpenAI(fileName, imageUrl);
    }

    // Download image using authenticated Supabase client
    const imageData = await downloadImageFromSupabase(imageUrl);
    if (!imageData) {
      throw new Error('Failed to download image from Supabase storage');
    }

    // Convert to base64 efficiently
    const base64Image = await optimizedArrayBufferToBase64(imageData);
    
    // Use correct DeepSeek vision API - they use deepseek-vl model for vision
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-vl', // Fixed: Use vision model instead of chat model
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this image in detail. Describe what you see, including objects, people, text, colors, composition, and any other relevant details.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log("🖼️ DeepSeek vision failed:", errorText, "falling back to OpenAI");
      return await analyzeImageWithOpenAI(fileName, imageUrl);
    }

    const result = await response.json();
    const analysis = result.choices?.[0]?.message?.content;
    
    if (!analysis) {
      throw new Error('No analysis received from DeepSeek vision');
    }

    console.log("🖼️ DeepSeek vision analysis completed successfully");
    return `📸 **Image Analysis for ${fileName}:**\n\n${analysis}`;

  } catch (error) {
    console.error("🖼️ Error analyzing image with DeepSeek:", error);
    return await analyzeImageWithOpenAI(fileName, imageUrl);
  }
}

// Fixed OpenAI vision with proper authenticated file access
async function analyzeImageWithOpenAI(fileName: string, imageUrl: string): Promise<string> {
  try {
    console.log("🖼️ Analyzing image with OpenAI vision:", fileName);
    
    if (!OPENAI_API_KEY) {
      return `📸 **Image uploaded: ${fileName}**\n\nImage analysis is currently unavailable. The image has been received but cannot be analyzed at this time.`;
    }

    // Download image using authenticated Supabase client
    const imageData = await downloadImageFromSupabase(imageUrl);
    if (!imageData) {
      throw new Error('Failed to download image from Supabase storage');
    }

    // Convert to base64 efficiently
    const base64Image = await optimizedArrayBufferToBase64(imageData);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this image in detail. Describe what you see, including objects, people, text, colors, composition, and any other relevant details.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("🖼️ OpenAI API failed:", errorText);
      throw new Error(`OpenAI API failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const analysis = result.choices?.[0]?.message?.content;
    
    if (!analysis) {
      throw new Error('No analysis received from OpenAI');
    }

    console.log("🖼️ OpenAI vision analysis completed successfully");
    return `📸 **Image Analysis for ${fileName}:**\n\n${analysis}`;

  } catch (error) {
    console.error("🖼️ Error analyzing image with OpenAI:", error);
    return `📸 **Image uploaded: ${fileName}**\n\nUnable to analyze the image content at this time due to: ${error.message}. The image has been received.`;
  }
}

// New function to download images from Supabase storage with authentication
async function downloadImageFromSupabase(imageUrl: string): Promise<ArrayBuffer | null> {
  try {
    console.log("📥 Downloading image from Supabase storage:", imageUrl);
    
    // Extract bucket and path from the URL
    const urlParts = imageUrl.split('/');
    const bucketIndex = urlParts.findIndex(part => part === 'message-media');
    
    if (bucketIndex === -1) {
      // If it's not a Supabase storage URL, try direct download
      console.log("📥 Not a Supabase storage URL, trying direct download");
      const response = await fetch(imageUrl, {
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }
      
      return await response.arrayBuffer();
    }
    
    const bucket = urlParts[bucketIndex];
    const filePath = urlParts.slice(bucketIndex + 1).join('/');
    
    console.log("📥 Downloading from bucket:", bucket, "path:", filePath);
    
    // Use Supabase storage client to download with authentication
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);
    
    if (error) {
      console.error("📥 Supabase storage download error:", error);
      throw new Error(`Supabase storage error: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('No data received from Supabase storage');
    }
    
    console.log("📥 Successfully downloaded image, size:", data.size);
    return await data.arrayBuffer();
    
  } catch (error) {
    console.error("📥 Error downloading image from Supabase:", error);
    return null;
  }
}

// Optimized base64 conversion that prevents stack overflow
async function optimizedArrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  try {
    console.log("🔄 Converting image to base64, size:", buffer.byteLength);
    
    // For very large images, resize them first to prevent memory issues
    if (buffer.byteLength > 5 * 1024 * 1024) { // 5MB
      console.log("🔄 Large image detected, will resize before conversion");
      buffer = await resizeImage(buffer);
    }
    
    // Use efficient conversion method
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    
    // Process in chunks to prevent stack overflow
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64 = btoa(binary);
    console.log("🔄 Base64 conversion completed, length:", base64.length);
    return base64;
    
  } catch (error) {
    console.error("🔄 Error in base64 conversion:", error);
    throw new Error(`Base64 conversion failed: ${error.message}`);
  }
}

// Simple image resizing function to prevent memory issues
async function resizeImage(buffer: ArrayBuffer, maxSize: number = 2048): Promise<ArrayBuffer> {
  try {
    console.log("🖼️ Resizing large image to prevent memory issues");
    
    // Create a blob from the buffer
    const blob = new Blob([buffer]);
    
    // Create an image element
    const img = new Image();
    const canvas = new OffscreenCanvas(maxSize, maxSize);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }
    
    // Load the image
    const imageBitmap = await createImageBitmap(blob);
    
    // Calculate new dimensions while maintaining aspect ratio
    let { width, height } = imageBitmap;
    
    if (width > maxSize || height > maxSize) {
      const ratio = Math.min(maxSize / width, maxSize / height);
      width = Math.floor(width * ratio);
      height = Math.floor(height * ratio);
    }
    
    // Resize canvas and draw
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(imageBitmap, 0, 0, width, height);
    
    // Convert back to buffer
    const resizedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    const resizedBuffer = await resizedBlob.arrayBuffer();
    
    console.log("🖼️ Image resized from", buffer.byteLength, "to", resizedBuffer.byteLength, "bytes");
    return resizedBuffer;
    
  } catch (error) {
    console.error("🖼️ Error resizing image:", error);
    // If resizing fails, return original buffer
    return buffer;
  }
}

// Process attached files without recursion
async function processAttachedFiles(attachedFiles: any[]): Promise<string> {
  if (!attachedFiles || attachedFiles.length === 0) {
    return '';
  }

  console.log("📁 WAKTI AI V2.5: Processing attached files...");
  console.log("📁 WAKTI AI V2.5: Processing", attachedFiles.length, "attached files");

  const fileAnalysis: string[] = [];

  for (const file of attachedFiles) {
    console.log("📁 Processing file:", file.name, "Type:", file.type);
    
    try {
      if (file.type.startsWith('image/')) {
        console.log("🖼️ Processing image file:", file.name);
        const analysis = await analyzeImageWithDeepSeek(file.name, file.url);
        fileAnalysis.push(analysis);
      } else if (file.type === 'application/pdf') {
        console.log("📄 Processing PDF file:", file.name);
        fileAnalysis.push(`📄 **PDF Document: ${file.name}**\n\nPDF analysis is not yet implemented. The document has been received.`);
      } else if (file.type === 'text/plain') {
        console.log("📝 Processing text file:", file.name);
        try {
          const textResponse = await fetch(file.url);
          const textContent = await textResponse.text();
          fileAnalysis.push(`📝 **Text File: ${file.name}**\n\nContent:\n${textContent.substring(0, 2000)}${textContent.length > 2000 ? '...' : ''}`);
        } catch (error) {
          console.error("Error reading text file:", error);
          fileAnalysis.push(`📝 **Text File: ${file.name}**\n\nUnable to read file content.`);
        }
      } else {
        console.log("📎 Processing unknown file type:", file.name);
        fileAnalysis.push(`📎 **File: ${file.name}**\n\nFile type ${file.type} analysis not supported.`);
      }
    } catch (error) {
      console.error("Error processing file:", file.name, error);
      fileAnalysis.push(`❌ **Error processing ${file.name}**\n\nUnable to analyze this file: ${error.message}`);
    }
  }

  const result = fileAnalysis.join('\n\n');
  console.log("📁 Generated file context, length:", result.length);
  
  return result;
}

async function processWithUltraStrictTriggerControl(
  message: string,
  userId: string,
  language: string = 'en',
  conversationId: string | null = null,
  inputType: 'text' | 'voice' = 'text',
  conversationHistory: any[] = [],
  confirmSearch: boolean = false,
  activeTrigger: string = 'chat',
  textGenParams: any = null,
  attachedFiles: any[] = []
) {
  const triggerResult = analyzeUltraStrictTrigger(message, activeTrigger, language);
  
  console.log("💬 WAKTI AI V2.5: TRIGGER FORBIDS BROWSING - PURE CHAT MODE WITH FILE PROCESSING");
  console.log("💬 WAKTI AI V2.5: Strict Mode:", triggerResult.strictMode);

  let fileContext = '';
  if (attachedFiles && attachedFiles.length > 0) {
    console.log("📁 WAKTI AI V2.5: Processing attached files...");
    fileContext = await processAttachedFiles(attachedFiles);
  }

  const quotaStatus = await checkBrowsingQuota(userId);

  const response = await processWithAI(
    message,
    null, // No search context in chat mode
    language,
    false, // Never allow browsing in chat mode
    activeTrigger,
    fileContext,
    attachedFiles || []
  );

  console.log("🎯 WAKTI AI V2.5: === SMART FILE PROCESSING SUCCESS ===");

  return {
    response,
    conversationId: conversationId || generateConversationId(),
    intent: triggerResult.intent,
    confidence: triggerResult.confidence,
    actionTaken: null,
    actionResult: null,
    imageUrl: null,
    browsingUsed: false,
    browsingData: null,
    quotaStatus,
    requiresSearchConfirmation: false
  };
}

function analyzeUltraStrictTrigger(message: string, activeTrigger: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();

  switch (activeTrigger) {
    case 'search':
      const searchPatterns = [
        'what', 'who', 'when', 'where', 'how', 'current', 'latest', 'recent', 'today', 'news',
        'weather', 'score', 'price', 'stock', 'update', 'information', 'find', 'search',
        'ما', 'من', 'متى', 'أين', 'كيف', 'حالي', 'آخر', 'مؤخراً', 'اليوم', 'أخبار',
        'طقس', 'نتيجة', 'سعر', 'معلومات', 'ابحث', 'بحث'
      ];
      
      const isSearchIntent = searchPatterns.some(pattern => lowerMessage.includes(pattern));
      
      return {
        intent: isSearchIntent ? 'real_time_search' : 'invalid_for_search',
        confidence: isSearchIntent ? 'high' : 'low',
        allowed: isSearchIntent,
        requiresBrowsing: isSearchIntent,
        strictMode: isSearchIntent ? 'SEARCH_WITH_BROWSING' : 'SEARCH_FORBIDDEN'
      };

    case 'image':
      const imagePatterns = [
        'generate', 'create', 'make', 'draw', 'image', 'picture', 'photo', 'art', 'illustration',
        'أنشئ', 'اصنع', 'ارسم', 'صورة', 'رسم', 'فن'
      ];
      
      const isImageIntent = imagePatterns.some(pattern => lowerMessage.includes(pattern));
      
      return {
        intent: isImageIntent ? 'generate_image' : 'invalid_for_image',
        confidence: isImageIntent ? 'high' : 'low',
        allowed: isImageIntent,
        requiresBrowsing: false,
        strictMode: isImageIntent ? 'IMAGE_GENERATION' : 'IMAGE_FORBIDDEN'
      };

    case 'chat':
    default:
      return {
        intent: 'general_chat',
        confidence: 'high',
        allowed: true,
        requiresBrowsing: false,
        strictMode: 'CHAT_NO_BROWSING_EVER'
      };
  }
}

async function processWithAI(
  message: string, 
  context: string | null, 
  language: string = 'en',
  allowBrowsing: boolean = false,
  activeTrigger: string = 'chat',
  fileContext: string = '',
  attachedFiles: any[] = []
) {
  try {
    console.log("🤖 WAKTI AI V2.5: === AI PROCESSING START ===");
    console.log("🤖 WAKTI AI V2.5: Trigger Mode:", activeTrigger);
    console.log("🤖 WAKTI AI V2.5: Allow Browsing:", allowBrowsing);
    console.log("🤖 WAKTI AI V2.5: Has Context:", !!context);
    console.log("🤖 WAKTI AI V2.5: Attached Files:", attachedFiles?.length || 0);

    let apiKey = DEEPSEEK_API_KEY;
    let apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    let model = 'deepseek-chat';
    
    if (!apiKey) {
      apiKey = OPENAI_API_KEY;
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      model = 'gpt-4o-mini';
    }
    
    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة. تتخصص في المساعدة في المهام اليومية وتقديم معلومات دقيقة ومفيدة. كن ودوداً ومفيداً ومختصراً في إجاباتك.`
      : `You are WAKTI, an advanced AI assistant. You specialize in helping with daily tasks and providing accurate, helpful information. Be friendly, helpful, and concise in your responses.`;
    
    let userContent = message;
    
    // Add file context if available
    if (fileContext) {
      userContent = `${message}\n\n---\n\n${fileContext}`;
      console.log("🤖 WAKTI AI V2.5: 📁 Including file context in conversation");
    } else {
      console.log("🤖 WAKTI AI V2.5: 💬 Pure chat mode - no search context");
    }
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];
    
    if (context) {
      messages.splice(1, 0, { role: 'assistant', content: `Context: ${context}` });
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1500
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }
    
    const result = await response.json();
    const aiResponse = result.choices[0].message.content;
    
    console.log("🤖 WAKTI AI V2.5: === AI PROCESSING SUCCESS ===");
    console.log("🤖 WAKTI AI V2.5: Response length:", aiResponse?.length || 0);
    
    return aiResponse;
    
  } catch (error) {
    console.error("🤖 WAKTI AI V2.5: AI processing error:", error);
    
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
  }
}

async function executeSearch(query: string, language: string = 'en') {
  try {
    if (!TAVILY_API_KEY) {
      return { success: false, error: "Search not configured" };
    }
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: "basic",
        include_answer: true,
        max_results: 3
      })
    });
    
    if (!response.ok) {
      return { success: false, error: "Search failed" };
    }
    
    const data = await response.json();
    return {
      success: true,
      context: data.answer,
      data: { sources: data.results || [] }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function checkBrowsingQuota(userId: string) {
  try {
    const { data, error } = await supabase.rpc('check_browsing_quota', {
      p_user_id: userId
    });
    
    if (error) {
      console.error("Quota check error:", error);
      return { count: 0, limit: 60, canBrowse: true, usagePercentage: 0, remaining: 60 };
    }
    
    const count = data || 0;
    const limit = 60;
    const usagePercentage = Math.round((count / limit) * 100);
    
    return {
      count,
      limit,
      usagePercentage,
      remaining: Math.max(0, limit - count),
      canBrowse: count < limit,
      requiresConfirmation: usagePercentage >= 80
    };
  } catch (error) {
    console.error("Quota check error:", error);
    return { count: 0, limit: 60, canBrowse: true, usagePercentage: 0, remaining: 60 };
  }
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
