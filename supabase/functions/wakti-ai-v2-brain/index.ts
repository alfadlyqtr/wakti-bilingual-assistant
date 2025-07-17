import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { generateImageWithRunware } from './imageGeneration.ts';

// ENHANCED CORS CONFIGURATION FOR PRODUCTION
const allowedOrigins = [
  'https://wakti.qa',
  'https://www.wakti.qa'
];

const getCorsHeaders = (origin: string | null) => {
  // Allow production domains + any lovable subdomain
  const isAllowed = origin && (
    allowedOrigins.includes(origin) ||
    origin.includes('lovable.dev') ||
    origin.includes('lovable.app') ||
    origin.includes('lovableproject.com')
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name, x-auth-token, x-skip-auth, content-length',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  };
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("WAKTI AI V2 BRAIN: Ultra-Smart System Initialized with Perfect API Routing");

// TAVILY SEARCH FUNCTION
async function performSearchWithTavily(query: string, userId: string, language: string = 'en') {
  console.log('🔍 SEARCH: Starting search for:', query.substring(0, 50));
  
  if (!TAVILY_API_KEY) {
    return {
      success: false,
      error: language === 'ar' ? 'خدمة البحث غير متاحة' : 'Search service not configured',
      response: language === 'ar' 
        ? 'أعتذر، خدمة البحث غير متاحة حالياً.'
        : 'I apologize, search service is not available at the moment.'
    };
  }

  try {
    const searchPayload = {
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: "basic",
      include_answer: true,
      include_raw_content: false,
      max_results: 5
    };

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ SEARCH API ERROR:', response.status, errorText);
      throw new Error(`Search API error: ${response.status}`);
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response from search service');
    }

    let searchData;
    try {
      searchData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('❌ SEARCH JSON parsing error:', jsonError);
      throw new Error('Invalid JSON response from search service');
    }

    const results = Array.isArray(searchData.results) ? searchData.results : [];
    const answer = searchData.answer || '';
    
    let searchResponse = language === 'ar' ? '🔍 نتائج البحث:\n\n' : '🔍 Search Results:\n\n';
    
    if (answer) {
      searchResponse += language === 'ar' ? `**الإجابة المباشرة:**\n${answer}\n\n` : `**Direct Answer:**\n${answer}\n\n`;
    }
    
    if (results.length > 0) {
      searchResponse += language === 'ar' ? '**المصادر:**\n' : '**Sources:**\n';
      results.forEach((result: any, index: number) => {
        if (result && typeof result === 'object') {
          searchResponse += `${index + 1}. **${result.title || 'No title'}**\n`;
          searchResponse += `   ${result.content || 'No content'}\n`;
          searchResponse += `   🔗 [${language === 'ar' ? 'المصدر' : 'Source'}](${result.url || '#'})\n\n`;
        }
      });
    }

    console.log(`✅ SEARCH: Found ${results.length} results`);
    return {
      success: true,
      error: null,
      response: searchResponse,
      searchData: {
        answer,
        results,
        query,
        total_results: results.length
      }
    };

  } catch (error) {
    console.error('❌ SEARCH: Critical error:', error);
    
    return {
      success: false,
      error: language === 'ar' ? 'فشل البحث' : 'Search failed',
      response: language === 'ar' 
        ? 'أعتذر، حدث خطأ أثناء البحث. يرجى المحاولة مرة أخرى.'
        : 'I apologize, there was an error during the search. Please try again.'
    };
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Enhanced preflight handling for image uploads
  if (req.method === "OPTIONS") {
    console.log("🔧 PREFLIGHT: Handling OPTIONS request from origin:", origin);
    return new Response(null, { 
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  }

  try {
    console.log("🧠 WAKTI AI V2: Processing super-intelligent request with perfect routing");
    
    const contentType = req.headers.get('content-type') || '';
    let requestData;
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const jsonData = formData.get('data') as string;
      requestData = JSON.parse(jsonData);
      
      const files = [];
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('file-') && value instanceof File) {
          files.push(value);
        }
      }
      requestData.files = files;
    } else {
      requestData = await req.json();
    }

    const { 
      message, 
      conversationId, 
      userId, 
      language = 'en',
      files = [],
      attachedFiles: requestAttachedFiles = [],
      activeTrigger = 'general',
      recentMessages = [],
      conversationSummary = '',
      personalTouch = null
    } = requestData;

    // ENSURE PROPER USER ID FOR MEMORY
    const actualUserId = userId || personalTouch?.userId || requestData.user_id || 'default_user';
    console.log('🔍 USER ID CHECK:', { original: userId, personal: personalTouch?.userId, final: actualUserId });

    console.log(`🎯 REQUEST DETAILS: Trigger=${activeTrigger}, Language=${language}, Files=${files.length}, AttachedFiles=${requestAttachedFiles.length}, Memory=${personalTouch ? 'enabled' : 'disabled'}, UserId=${actualUserId}`);

    let finalConversationId = conversationId;
    
    if (!finalConversationId) {
      const { data: newConversation, error: convError } = await supabase
        .from('ai_conversations')
        .insert([{
          user_id: actualUserId,
          title: message.substring(0, 50) || 'New Wakti AI Chat',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString()
        }])
        .select('id')
        .single();
        
      if (convError) {
        console.error('Conversation creation error:', convError);
        throw new Error('Failed to create conversation');
      }
      
      finalConversationId = newConversation.id;
      console.log(`💬 NEW CONVERSATION: Created ID ${finalConversationId}`);
    }

    // USE EXISTING UPLOADED FILES INSTEAD OF RE-UPLOADING
    let attachedFiles = [];
    
    // Use already uploaded files from SimplifiedFileUpload instead of re-uploading
    if (requestAttachedFiles && requestAttachedFiles.length > 0) {
      console.log(`📎 TRUE CLAUDE WAY: Using ${requestAttachedFiles.length} pure base64 files`);
      
      attachedFiles = requestAttachedFiles.map(file => ({
        url: file.url,
        type: file.type,
        name: file.name,
        imageType: file.imageType || { id: 'general', name: language === 'ar' ? 'عام' : 'General' }
      }));
      
      attachedFiles.forEach(file => {
        console.log(`📎 CLAUDE WAY FILE: ${file.name} (${file.imageType.name}) - Pure base64 data ready`);
      });
    }

    // 🚨 CRITICAL FIX: PERFECT API ROUTING BASED ON MODE
    console.log(`🎯 PERFECT ROUTING: Mode=${activeTrigger}, HasImages=${attachedFiles.length > 0}`);

    let result;
    
    // ROUTE TO CORRECT API BASED ON MODE
    if (activeTrigger === 'image') {
      console.log('🎨 ROUTING TO RUNWARE: Image generation mode');
      result = await generateImageWithRunware(message, actualUserId, language);
      result.mode = 'image';
      result.intent = 'image';
    } else if (activeTrigger === 'search') {
      console.log('🔍 ROUTING TO TAVILY: Search mode');
      result = await performSearchWithTavily(message, actualUserId, language);
      result.mode = 'search';
      result.intent = 'search';
    } else {
      console.log('🤖 ROUTING TO CLAUDE: Chat/Vision mode');
      result = await callClaude35API(
        message,
        finalConversationId,
        actualUserId,
        language,
        attachedFiles,
        activeTrigger,
        recentMessages,
        conversationSummary,
        personalTouch
      );
    }

    const finalResponse = {
      response: result.response || 'Response received',
      conversationId: finalConversationId,
      intent: result.intent || activeTrigger,
      confidence: 'high',
      actionTaken: null,
      imageUrl: result.imageUrl || null,
      browsingUsed: activeTrigger === 'search',
      browsingData: result.searchData || null,
      needsConfirmation: false,
      
      success: result.success !== false,
      processingTime: Date.now(),
      aiProvider: result.mode === 'image' ? 'runware' : result.mode === 'search' ? 'tavily' : 'claude-3-5-sonnet-20241022',
      claude35Enabled: true,
      mode: result.mode || activeTrigger,
      fallbackUsed: false
    };

    console.log(`✅ WAKTI AI V2: Successfully processed ${activeTrigger} request with perfect routing for user ${actualUserId}`);
    
    return new Response(JSON.stringify(finalResponse), {
      status: 200,
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY"
      }
    });

  } catch (error) {
    console.error("❌ WAKTI AI V2 ERROR:", error);
    return new Response(JSON.stringify({
      error: error.message || 'Processing failed',
      success: false,
      response: 'I encountered an error processing your request. Please try again.',
      conversationId: null
    }), {
      status: 500,
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    });
  }
});

async function callClaude35API(message, conversationId, userId, language = 'en', attachedFiles = [], activeTrigger = 'general', recentMessages = [], conversationSummary = '', personalTouch = null) {
  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    console.log(`🧠 WAKTI AI V2: Processing ${activeTrigger} mode conversation`);
    
    // PROPER MODE DETECTION - ONLY VISION WHEN IMAGES PRESENT
    let detectedMode = 'chat'; // DEFAULT TO CHAT

    // Check if images are actually attached
    if (attachedFiles && attachedFiles.length > 0) {
      const hasImages = attachedFiles.some(file => file.type?.startsWith('image/'));
      if (hasImages) {
        detectedMode = 'vision';
        console.log('🔍 VISION MODE: Images detected, switching to vision processing');
      } else {
        detectedMode = 'chat';
        console.log('💬 CHAT MODE: No images found, using chat mode');
      }
    } else {
      detectedMode = 'chat';
      console.log('💬 CHAT MODE: No attachedFiles, using chat mode');
    }

    console.log(`🧠 MODE DETECTION RESULT: "${detectedMode}" (trigger: "${activeTrigger}", hasFiles: ${!!attachedFiles?.length})`);

    const responseLanguage = language;
    let messages = [];

    // SIMPLIFIED MEMORY SYSTEM FIX - Load user history regardless of conversation_id
    const { data: fullHistory } = await supabase
      .from('ai_chat_history')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6);

    // Reverse to get chronological order for AI context
    if (fullHistory) {
      fullHistory.reverse();
    }

    // Build personalization context for system prompt
    let personalizationContext = '';
    if (personalTouch) {
      const parts = [];
      if (personalTouch.nickname) parts.push(`User name: ${personalTouch.nickname}`);
      if (personalTouch.aiNickname) parts.push(`AI name: ${personalTouch.aiNickname}`);
      if (personalTouch.tone) parts.push(`Tone: ${personalTouch.tone}`);
      if (personalTouch.style) parts.push(`Style: ${personalTouch.style}`);
      if (personalTouch.instruction) parts.push(`Instructions: ${personalTouch.instruction}`);
      
      if (parts.length > 0) {
        personalizationContext = `\n\nPersonalization: ${parts.join(', ')}`;
      }
    }

    console.log(`🧠 SIMPLIFIED MEMORY: Using full conversation history (${fullHistory?.length || 0} messages) with personalization`);

    // 👁️ VISION PROCESSING - SPECIALIZED
    if (detectedMode === 'vision') {
      console.log('👁️ VISION: Building image analysis request...');
      
      const visionContent = [];
      
      visionContent.push({
        type: 'text',
        text: message || 'Analyze this image and describe what you see in detail.'
      });

      for (const file of attachedFiles) {
        if (file.type?.startsWith('image/')) {
          console.log(`📎 TRUE CLAUDE WAY: Processing ${file.name} with image type: ${file.imageType?.name}`);
          
          // TRUE CLAUDE WAY: Direct base64 data URL processing
          let imageData;
          if (file.url.startsWith('data:')) {
            // Extract base64 data from data URL
            imageData = file.url.split(',')[1];
            console.log('✅ CLAUDE WAY: Extracted base64 data from data URL');
          } else {
            // This shouldn't happen with the new flow, but fallback
            console.error('❌ Expected base64 data URL, got:', file.url.substring(0, 50));
            throw new Error('Invalid image data format - expected base64 data URL');
          }

          // Add image type context to improve analysis
          if (file.imageType && file.imageType.id !== 'general') {
            console.log(`🏷️ SPECIALIZED ANALYSIS: ${file.imageType.name} - Adding context`);
          }

          visionContent.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: file.type,
              data: imageData
            }
          });
        }
      }

      messages.push({
        role: 'user',
        content: visionContent
      });

    } else {
      // Add conversation history FIRST for context
      if (fullHistory && fullHistory.length > 0) {
        fullHistory.forEach(msg => {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({
              role: msg.role,
              content: msg.content
            });
          }
        });
        console.log(`🧠 MEMORY: Added ${fullHistory.length} conversation messages for full context`);
      }
      
      // Add current message LAST
      messages.push({
        role: 'user',
        content: message
      });
    }

    // OPTIMIZED SYSTEM PROMPTS FOR SPEED
    let systemPrompt;
    if (detectedMode === 'vision') {
      systemPrompt = responseLanguage === 'ar' 
        ? `أنت WAKTI AI، مساعد ذكي متخصص في تحليل الصور. قم بتحليل الصورة المرفقة بالتفصيل واستخرج جميع المعلومات المفيدة منها. كن دقيقاً ووصفياً في تحليلك. إذا كانت الصورة تحتوي على نص، اقرأه واستخرجه. إذا كانت تحتوي على أشخاص أو أشياء، صفها. إذا كانت وثيقة، لخص محتواها.`
        : `You are WAKTI AI, an intelligent assistant specialized in image analysis. Analyze the attached image in detail and extract all useful information from it. Be precise and descriptive in your analysis. If the image contains text, read and extract it. If it contains people or objects, describe them. If it's a document, summarize its content.`;
    } else {
      // OPTIMIZED STREAMLINED SYSTEM PROMPT
      systemPrompt = responseLanguage === 'ar' ? `
أنت WAKTI AI، مساعد ذكي متخصص في الإنتاجية والتنظيم. تدعم العربية والإنجليزية.

## إنشاء الصور (في وضع المحادثة فقط):
عندما تكون في وضع المحادثة ويطلب المستخدمون إنشاء صور، اردد بـ:
"يرجى التبديل إلى وضع الصور لإنشاء المحتوى البصري."

## التخصيص والذاكرة:
- استخدم الأسماء المفضلة للمستخدم بطبيعية
- اتبع نبرة التواصل المطلوبة (عادية، مهنية، مفصلة، مختصرة)
- احترم التعليمات المخصصة دائماً
- اجعل التخصيص طبيعياً، ليس آلياً

## شخصية المساعد:
- استخدم العربية الواضحة والودية
- كن مفيداً وعملياً
- اقترح خطوات عملية
- حافظ على نبرة مهنية مع الدفء

أنت هنا لجعل حياة المستخدمين أكثر تنظيماً وإنتاجية!
` : `
You are WAKTI AI, an intelligent assistant specializing in productivity and organization. You support Arabic and English. 

## Image Generation (Chat Mode Only):
When in chat mode and users request image generation, respond with:
"Please switch to image mode for visual content creation."

## Personalization & Memory:
- Use user's preferred names naturally
- Follow requested communication tone (casual, professional, detailed, concise)
- Always respect custom instructions
- Make personalization feel natural, not robotic

## Assistant Personality:
- Use clear, friendly English
- Be helpful and practical
- Suggest actionable next steps
- Maintain professional tone with warmth

You're here to make users' lives more organized and productive!
`;
      systemPrompt += personalizationContext;
    }

    console.log(`🤖 CALLING CLAUDE: Mode=${detectedMode}, Messages=${messages.length}, Language=${responseLanguage}`);

    // 📡 CLAUDE API CALL
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANTHROPIC_API_KEY}`,
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: detectedMode === 'vision' ? 3000 : 2000,
        temperature: 0.7,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!claudeResponse.ok) {
      const errorData = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errorData);
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content?.[0]?.text || (responseLanguage === 'ar' ? 'أعتذر، واجهت مشكلة في معالجة طلبك.' : 'I apologize, but I encountered an issue processing your request.');

    console.log(`✅ CLAUDE RESPONSE: Successfully processed ${detectedMode} request with SIMPLIFIED MEMORY SYSTEM`);

    // 💾 STORE CONVERSATION WITH FIXED INTENT FIELD
    try {
      // PROPER INPUT TYPE FOR DATABASE - FIX THE CONSTRAINT VIOLATION
      const inputType = detectedMode === 'vision' ? 'image' : 'text';

      await supabase.from('ai_chat_history').insert([
        {
          conversation_id: conversationId,
          user_id: userId,
          role: 'user',
          content: message,
          input_type: inputType,
          intent: detectedMode, // 🚨 CRITICAL FIX: ADD INTENT FIELD
          language: responseLanguage,
          created_at: new Date().toISOString()
        },
        {
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: responseText,
          input_type: 'text',
          intent: detectedMode, // 🚨 CRITICAL FIX: ADD INTENT FIELD
          language: responseLanguage,
          created_at: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error('Failed to store conversation:', error);
    }

    return {
      response: responseText,
      success: true,
      model: 'claude-3-5-sonnet-20241022',
      usage: claudeData.usage,
      mode: detectedMode,
      intent: detectedMode // Return the actual detected mode as intent
    };

  } catch (error) {
    console.error('Claude API Error:', error);
    return {
      success: false,
      error: error.message,
      response: language === 'ar' ? 'أعتذر، حدث خطأ في معالجة طلبك.' : 'I apologize, there was an error processing your request.',
      intent: 'chat'
    };
  }
}
