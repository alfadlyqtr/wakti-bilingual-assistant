import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Add API keys for real AI integration
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY") || "yzJMWPrRdkJcge2q0yjSOwTGvlhMeOy1";

console.log("🔍 UNIFIED AI BRAIN: Function loaded with no search quota restrictions");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔍 UNIFIED AI BRAIN: Processing request with user isolation and no search restrictions");

    // CRITICAL: Extract and verify authentication token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error("🔍 UNIFIED AI BRAIN: Missing authorization header");
      return new Response(JSON.stringify({ 
        error: "Authentication required",
        success: false
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      console.error("🔍 UNIFIED AI BRAIN: Authentication failed:", authError);
      return new Response(JSON.stringify({ 
        error: "Invalid authentication",
        success: false
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get request body
    const requestBody = await req.json();
    console.log("🔍 UNIFIED AI BRAIN: Request body received for user:", user.id);

    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      confirmSearch = false,
      activeTrigger = 'chat',
      attachedFiles = []
    } = requestBody;

    // CRITICAL: Ensure userId matches authenticated user
    if (userId !== user.id) {
      console.error("🔍 UNIFIED AI BRAIN: User ID mismatch - potential security breach attempt");
      return new Response(JSON.stringify({ 
        error: "User ID mismatch",
        success: false
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validate required fields
    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.error("🔍 UNIFIED AI BRAIN: Invalid message field");
      return new Response(JSON.stringify({ 
        error: "Message is required and must be a non-empty string",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("🔍 UNIFIED AI BRAIN: Processing message for authenticated user:", user.id);
    console.log("🔍 UNIFIED AI BRAIN: Active trigger mode:", activeTrigger);
    console.log("🔍 UNIFIED AI BRAIN: Attached files count:", attachedFiles.length);

    // Enforce trigger isolation
    const intent = analyzeTriggerIntent(message, activeTrigger, language);
    console.log("🔍 UNIFIED AI BRAIN: Trigger analysis result:", intent);

    // Generate response based on trigger isolation with REAL AI
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let actionTaken = null;
    let actionResult = null;
    let fileAnalysisResults = [];
    let promptTranslationInfo = null;

    // Handle trigger types with NO search quota restrictions
    switch (activeTrigger) {
      case 'search':
        // No quota checking - execute search directly
        if (intent.allowed) {
          console.log("🔍 Executing search for user:", user.id);
          
          const searchResult = await executeRegularSearch(message, language);
          if (searchResult.success) {
            browsingUsed = true;
            browsingData = searchResult.data;
            response = await processWithAI(message, searchResult.context, language, attachedFiles);
          } else {
            response = await processWithAI(message, null, language, attachedFiles);
          }
        } else {
          response = language === 'ar' 
            ? `⚠️ أنت في وضع البحث\n\nهذا الوضع مخصص للأسئلة والبحث.\n\nللدردشة العامة، انتقل إلى وضع المحادثة.`
            : `⚠️ You're in Search Mode\n\nThis mode is for questions and search.\n\nFor general chat, switch to Chat mode.`;
        }
        break;

      case 'image':
        // IMAGE GENERATION MODE WITH ARABIC TRANSLATION SUPPORT
        if (intent.allowed || (containsArabic(message) && language === 'ar')) {
          let englishPrompt = message;
          promptTranslationInfo = null;

          if (containsArabic(message)) {
            // Translate to English via DeepSeek/OpenAI
            try {
              console.log("🌐 Detected Arabic prompt for image generation. Translating...");
              englishPrompt = await translateToEnglish(message);
              promptTranslationInfo = {
                original: message,
                translated: englishPrompt,
                explanation: language === 'ar'
                  ? 'تمت ترجمة وصف الصورة تلقائيًا للإنجليزية لضمان جودة النتائج. يمكنك التحقق أو تحرير الترجمة إذا رغبت.'
                  : 'The prompt was automatically translated to English for best results. You can verify or edit the translation if you wish.'
              };
              console.log('🌐 Arabic prompt translation:', englishPrompt);
            } catch (error) {
              console.error("🌐 Error translating Arabic prompt:", error);
              response = language === 'ar'
                ? 'حدث خطأ في ترجمة وصف الصورة للإنجليزية. يرجى المحاولة مرة أخرى.'
                : 'An error occurred while translating your prompt to English. Please try again.';
              break;
            }
          }

          try {
            console.log("🎨 Generating image with Runware API for prompt:", englishPrompt);
            const imageResult = await generateImageWithRunware(englishPrompt, user.id, language);

            if (imageResult.success) {
              imageUrl = imageResult.imageUrl;
              response = (promptTranslationInfo
                ? (language === 'ar'
                    ? `✅ تمت ترجمة وصفك للإنجليزية وسيتم توليد الصورة بناءً عليه.\n\n**الوصف الأصلي:**\n${promptTranslationInfo.original}\n\n**الترجمة الإنجليزية:**\n${promptTranslationInfo.translated}\n\n🎨 تم إنشاء الصورة بناءً على الوصف باللغة الإنجليزية.`
                    : `✅ Your Arabic prompt was translated to English and used for image generation.\n\n**Original prompt:**\n${promptTranslationInfo.original}\n\n**English translation:**\n${promptTranslationInfo.translated}\n\n🎨 Image generated using the translated prompt.`)
                : (language === 'ar'
                    ? `🎨 تم إنشاء الصورة بنجاح!\n\n**الوصف:** ${englishPrompt}`
                    : `🎨 Image generated successfully!\n\n**Prompt:** ${englishPrompt}`)
              );
            } else {
              console.error("Image generation failed:", imageResult.error);
              response = language === 'ar'
                ? `❌ عذراً، حدث خطأ في إنشاء الصورة. يرجى المحاولة مرة أخرى.`
                : `❌ Sorry, there was an error generating the image. Please try again.`;
            }
          } catch (error) {
            console.error("Image generation error:", error);
            response = language === 'ar'
              ? `❌ عذراً، حدث خطأ في إنشاء الصورة. يرجى المحاولة مرة أخرى.`
              : `❌ Sorry, there was an error generating the image. Please try again.`;
          }
        } else {
          response = language === 'ar' 
            ? `⚠️ أنت في وضع إنشاء الصور\n\nهذا الوضع مخصص لإنشاء الصور فقط.\n\nللدردشة العامة، انتقل إلى وضع المحادثة.`
            : `⚠️ You're in Image Mode\n\nThis mode is for image generation only.\n\nFor general chat, switch to Chat mode.`;
        }
        break;

      case 'chat':
      default:
        // Chat mode - use real AI with file analysis
        if (attachedFiles && attachedFiles.length > 0) {
          console.log("🔍 UNIFIED AI BRAIN: Processing files for analysis");
          fileAnalysisResults = await processAttachedFiles(attachedFiles, user.id);
        }
        response = await processWithAI(message, null, language, attachedFiles, fileAnalysisResults);
        break;
    }

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: intent.intent,
      confidence: intent.confidence,
      actionTaken,
      actionResult,
      imageUrl,
      browsingUsed,
      browsingData,
      quotaStatus,
      requiresSearchConfirmation: false,
      needsConfirmation: false,
      needsClarification: false,
      fileAnalysisResults,
      promptTranslationInfo, // include translation info in response!
      success: true
    };

    console.log("🔍 UNIFIED AI BRAIN: Sending real AI response for user:", user.id);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🔍 UNIFIED AI BRAIN: Error processing request:", error);
    
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

// Process attached files for analysis
async function processAttachedFiles(attachedFiles: any[], userId: string) {
  const results = [];
  
  for (const file of attachedFiles) {
    try {
      console.log("🔍 Processing file:", file.name, "Type:", file.type);
      
      const analysis = {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        success: true,
        content: file.url || file.preview || null
      };
      
      results.push({ file: file.name, analysis });
    } catch (error) {
      console.error("Error processing file:", file.name, error);
      results.push({ 
        file: file.name, 
        analysis: { 
          success: false, 
          error: error.message 
        } 
      });
    }
  }
  
  return results;
}

// SIMPLIFIED: Regular search function with optional web browsing
async function executeRegularSearch(query: string, language: string = 'en') {
  try {
    if (!TAVILY_API_KEY) {
      console.log("🔍 No Tavily API - using AI for search response");
      
      const searchContext = `Search request: "${query}". Provide helpful information based on your knowledge.`;
      return {
        success: true,
        context: searchContext,
        data: { 
          sources: [],
          enhanced: false,
          note: "AI response without web search"
        }
      };
    }
    
    console.log("🔍 Executing regular Tavily search for query:", query);
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: "basic", // Use basic for regular search
        include_answer: true,
        include_raw_content: false,
        max_results: 10, // Updated from 3 to 10
        max_chunks: 5, // Added max_chunks parameter
        include_domains: [],
        exclude_domains: []
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tavily API error:", response.status, errorText);
      
      // Fallback to AI response
      const searchContext = `Search request: "${query}". Provide helpful information based on your knowledge.`;
      return {
        success: true,
        context: searchContext,
        data: { 
          sources: [],
          enhanced: false,
          fallback: true,
          note: "AI response (Tavily fallback)"
        }
      };
    }
    
    const data = await response.json();
    console.log("✅ Regular Tavily search successful");
    
    // Create context from search results
    let searchContext = `Search results for: "${query}"\n\n`;
    if (data.answer) {
      searchContext += `Summary: ${data.answer}\n\n`;
    }
    
    if (data.results && data.results.length > 0) {
      searchContext += "Sources:\n";
      data.results.forEach((result, index) => {
        searchContext += `${index + 1}. ${result.title}\n`;
        searchContext += `   ${result.content}\n`;
        searchContext += `   Source: ${result.url}\n\n`;
      });
    }
    
    return {
      success: true,
      context: searchContext,
      data: { 
        sources: data.results || [],
        enhanced: false,
        searchDepth: "basic",
        answer: data.answer
      }
    };
  } catch (error) {
    console.error("Regular search execution error:", error);
    
    // Always provide AI response as fallback
    const searchContext = `Search request: "${query}". Provide helpful information based on your knowledge.`;
    return {
      success: true,
      context: searchContext,
      data: { 
        sources: [],
        enhanced: false,
        fallback: true,
        note: "AI response (error fallback)"
      }
    };
  }
}

// Generate image with Runware API
async function generateImageWithRunware(prompt: string, userId: string, language: string = 'en') {
  try {
    console.log("🎨 Generating image with Runware for prompt:", prompt);

    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          taskType: "authentication",
          apiKey: RUNWARE_API_KEY,
        },
        {
          taskType: "imageInference",
          taskUUID: crypto.randomUUID(),
          positivePrompt: prompt,
          model: "runware:100@1",
          width: 512,
          height: 512,
          numberResults: 1,
          outputFormat: "WEBP",
          CFGScale: 1,
          scheduler: "FlowMatchEulerDiscreteScheduler",
          steps: 4,
        },
      ]),
    });

    console.log("🎨 Runware response status:", response.status);

    if (response.ok) {
      const result = await response.json();
      console.log("🎨 Runware response data:", result);
      
      // Find the image inference result
      const imageResult = result.data?.find((item: any) => item.taskType === "imageInference");
      
      if (imageResult && imageResult.imageURL) {
        // Save image to database
        try {
          await supabase
            .from('images')
            .insert({
              user_id: userId,
              prompt: prompt,
              image_url: imageResult.imageURL,
              metadata: { provider: 'runware', imageUUID: imageResult.imageUUID }
            });
        } catch (dbError) {
          console.log("Could not save image to database:", dbError);
          // Continue anyway, the image was generated successfully
        }

        return {
          success: true,
          imageUrl: imageResult.imageURL
        };
      } else {
        throw new Error('No image URL in Runware response');
      }
    } else {
      const errorText = await response.text();
      console.error("🎨 Runware API error:", response.status, errorText);
      throw new Error(`Runware API failed: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error('🎨 Error generating image with Runware:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Real AI processing function with vision capabilities
async function processWithAI(message: string, context: string | null, language: string = 'en', attachedFiles: any[] = [], fileAnalysisResults: any[] = []) {
  try {
    console.log("🤖 UNIFIED AI BRAIN: Processing with real AI and vision capabilities");
    
    // Try OpenAI first (for vision support), fallback to DeepSeek
    let apiKey = OPENAI_API_KEY;
    let apiUrl = 'https://api.openai.com/v1/chat/completions';
    let model = 'gpt-4o-mini';
    
    if (!apiKey) {
      apiKey = DEEPSEEK_API_KEY;
      apiUrl = 'https://api.deepseek.com/v1/chat/completions';
      model = 'deepseek-chat';
    }
    
    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة. تتخصص في المساعدة في المهام اليومية وتقديم معلومات دقيقة ومفيدة. كن ودوداً ومفيداً ومختصراً في إجاباتك.

**قدرات مهمة:**
- يمكنك رؤية وتحليل الصور المرفقة بالرسائل
- يمكنك قراءة النصوص في الصور والمستندات
- يمكنك الإجابة على الأسئلة المتعلقة بمحتوى الصور
- يمكنك تحليل المخططات والرسوم البيانية والجداول

تعليمات مهمة للتنسيق:
- استخدم نصاً عادياً واضحاً
- تجنب الرموز الزائدة مثل # أو ** أو ***
- استخدم فقرات بسيطة مع فواصل أسطر طبيعية
- اجعل الإجابة سهلة القراءة وبدون تعقيد في التنسيق`
      : `You are WAKTI, an advanced AI assistant. You specialize in helping with daily tasks and providing accurate, helpful information. Be friendly, helpful, and concise in your responses.

**Important capabilities:**
- You CAN see and analyze images attached to messages
- You CAN read text in images and documents
- You CAN answer questions about image content
- You CAN analyze charts, graphs, tables, and visual data

Important formatting instructions:
- Use clean, plain text
- Avoid excessive symbols like #, **, or ***
- Use simple paragraphs with natural line breaks
- Keep responses readable and clean without formatting clutter`;
    
    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add context if available
    if (context) {
      messages.push({ role: 'assistant', content: `Context: ${context}` });
    }
    
    // Add file analysis context if available
    if (fileAnalysisResults && fileAnalysisResults.length > 0) {
      const fileContext = fileAnalysisResults.map(result => {
        if (result.analysis.success) {
          return `File: ${result.file} (${result.analysis.fileType}) - Available for analysis`;
        } else {
          return `File: ${result.file} - Error: ${result.analysis.error}`;
        }
      }).join('\n');
      
      messages.push({ 
        role: 'assistant', 
        content: `Files attached: ${fileContext}` 
      });
    }
    
    // Create user message with potential image content
    const userMessage: any = {
      role: 'user',
      content: []
    };
    
    // Add text content
    userMessage.content.push({
      type: 'text',
      text: message
    });
    
    // Add image content if available and using OpenAI
    if (attachedFiles && attachedFiles.length > 0 && apiKey === OPENAI_API_KEY) {
      for (const file of attachedFiles) {
        if (file.type && file.type.startsWith('image/') && (file.url || file.preview)) {
          userMessage.content.push({
            type: 'image_url',
            image_url: {
              url: file.url || file.preview
            }
          });
        }
      }
    }
    
    // If no image content was added, convert to simple text message
    if (userMessage.content.length === 1) {
      userMessage.content = message;
    }
    
    messages.push(userMessage);
    
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
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error("🤖 UNIFIED AI BRAIN: AI processing error:", error);
    
    // Fallback response
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
  }
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper: Detect if string contains Arabic characters
function containsArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

// SIMPLIFIED: Trigger isolation logic - only chat, search, image
function analyzeTriggerIntent(message: string, activeTrigger: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  console.log("🔍 UNIFIED AI BRAIN: Analyzing trigger intent for:", activeTrigger);
  
  switch (activeTrigger) {
    case 'search':
      // Search allows questions and search queries
      const searchPatterns = [
        'what', 'who', 'when', 'where', 'how', 'current', 'latest', 'recent', 'today', 'news',
        'weather', 'score', 'price', 'stock', 'update', 'information', 'find', 'search',
        'ما', 'من', 'متى', 'أين', 'كيف', 'حالي', 'آخر', 'مؤخراً', 'اليوم', 'أخبار',
        'طقس', 'نتيجة', 'سعر', 'معلومات', 'ابحث', 'بحث'
      ];
      
      const isSearchIntent = searchPatterns.some(pattern => lowerMessage.includes(pattern)) || lowerMessage.includes('?');
      
      return {
        intent: isSearchIntent ? 'search' : 'general_query',
        confidence: 'high',
        allowed: true // Allow all queries in search mode
      };

    case 'image':
      // Accept anything for image mode if message contains Arabic, or if keywords match
      const imagePatterns = [
        'generate', 'create', 'make', 'draw', 'image', 'picture', 'photo', 'art', 'illustration',
        'أنشئ', 'اصنع', 'ارسم', 'صورة', 'رسم', 'فن'
      ];
      const isImageIntent =
        imagePatterns.some(pattern => lowerMessage.includes(pattern)) ||
        containsArabic(message);

      return {
        intent: isImageIntent ? 'generate_image' : 'invalid_for_image',
        confidence: isImageIntent ? 'high' : 'low',
        allowed: isImageIntent
      };

    case 'chat':
    default:
      // Chat mode allows everything
      return {
        intent: 'general_chat',
        confidence: 'high',
        allowed: true
      };
  }
}

// Translation helper using DeepSeek/OpenAI
async function translateToEnglish(arabicText: string) {
  // Prefer DeepSeek, fallback to OpenAI
  let apiKey = DEEPSEEK_API_KEY;
  let apiUrl = 'https://api.deepseek.com/v1/chat/completions';
  let model = 'deepseek-chat';

  if (!apiKey) {
    apiKey = OPENAI_API_KEY;
    apiUrl = 'https://api.openai.com/v1/chat/completions';
    model = 'gpt-4o-mini';
  }

  if (!apiKey) throw new Error("No translation API key configured");

  const systemPrompt =
    "You are an expert Arabic-to-English translation assistant. Translate the following prompt as concisely and fluently as possible for use in an image generation AI. Do not add, remove or summarize details. Reply ONLY with the English translation:";

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: arabicText }
  ];

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 200
    })
  });

  if (!response.ok) {
    throw new Error(`Translation API failed: ${response.status}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content?.trim() || '';
}
