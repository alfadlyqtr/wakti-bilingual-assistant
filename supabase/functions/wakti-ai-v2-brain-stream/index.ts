import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control, x-request-id, x-mobile-request, x-app-name, x-auth-token, x-skip-auth, content-length',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  };
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("🚀 WAKTI AI STREAMING: Ultra-fast streaming service loaded");

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    console.log("🔧 STREAMING: Handling OPTIONS request");
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
    console.log("🚀 STREAMING: Processing streaming request");
    
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
      language = 'en',
      files = [],
      attachedFiles: requestAttachedFiles = [],
      activeTrigger = 'general',
      recentMessages = [],
      personalTouch = null
    } = requestData;

    console.log(`🚀 STREAMING: Processing ${activeTrigger} mode streaming request`);

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await streamClaude35Response(
            message,
            conversationId,
            language,
            requestAttachedFiles,
            activeTrigger,
            recentMessages,
            personalTouch,
            controller
          );
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("🚀 STREAMING ERROR:", error);
    return new Response(JSON.stringify({
      error: error.message || 'Streaming error'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

async function streamClaude35Response(
  message: string,
  conversationId: string,
  language: string = 'en',
  attachedFiles: any[] = [],
  activeTrigger: string = 'general',
  recentMessages: any[] = [],
  personalTouch: any = null,
  controller: ReadableStreamDefaultController
) {
  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    // Determine mode based on attached files
    let detectedMode = 'chat';
    
    if (attachedFiles && attachedFiles.length > 0) {
      const hasImages = attachedFiles.some(file => file.type?.startsWith('image/'));
      if (hasImages) {
        detectedMode = 'vision';
        console.log('🔍 STREAMING: Images detected, using vision mode');
      }
    }

    console.log(`🚀 STREAMING: Processing ${activeTrigger} mode conversation`);
    console.log(`🚀 STREAMING: Mode="${detectedMode}" (trigger: "${activeTrigger}")`);

    const responseLanguage = language;
    let messages = [];

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

    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'Asia/Qatar'
    });

    if (detectedMode === 'vision') {
      console.log('👁️ STREAMING: Building vision request');
      
      const visionContent = [];
      
      // Add language enforcement directly in the message
      const languagePrefix = responseLanguage === 'ar' 
        ? 'يرجى الرد باللغة العربية فقط. ' 
        : 'Please respond in English only. ';
      
      visionContent.push({
        type: 'text',
        text: languagePrefix + (message || 'Analyze this image and describe what you see in detail.')
      });

      for (const file of attachedFiles) {
        if (file.type?.startsWith('image/')) {
          console.log(`📎 STREAMING: Processing ${file.name}`);
          
          let imageData;
          if (file.url?.startsWith('data:')) {
            imageData = file.url.split(',')[1];
            console.log('✅ STREAMING: Extracted base64 data');
          } else if (file.content) {
            imageData = file.content;
            console.log('✅ STREAMING: Using file content');
          } else {
            console.error('❌ Invalid image data format');
            throw new Error('Invalid image data format');
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
      if (recentMessages && recentMessages.length > 0) {
        const historyMessages = recentMessages.slice(-6);
        historyMessages.forEach(msg => {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({
              role: msg.role,
              content: msg.content
            });
          }
        });
        console.log(`🧠 STREAMING: Using ${historyMessages.length} messages from conversation history`);
      }
      
      // Add language enforcement directly in the user message
      const languagePrefix = responseLanguage === 'ar' 
        ? 'يرجى الرد باللغة العربية فقط. ' 
        : 'Please respond in English only. ';
      
      messages.push({
        role: 'user',
        content: languagePrefix + message
      });
    }

    let systemPrompt;
    if (detectedMode === 'vision') {
      systemPrompt = responseLanguage === 'ar' 
        ? `⚠️ CRITICAL: استجب باللغة العربية فقط. لا تستخدم الإنجليزية مطلقاً. هذا أمر إجباري.

أنت WAKTI AI، مساعد ذكي متخصص في تحليل الصور. التاريخ الحالي: ${currentDate}

قم بتحليل الصورة المرفقة بالتفصيل واستخرج جميع المعلومات المفيدة منها. كن دقيقاً ووصفياً في تحليلك.

IMPORTANT: تذكر - استخدم العربية فقط في ردك. أي استخدام للإنجليزية غير مقبول.`
        : `⚠️ CRITICAL: Respond ONLY in English. Do not use Arabic at all. This is mandatory.

You are WAKTI AI, an intelligent assistant specialized in image analysis. Current date: ${currentDate}

Analyze the attached image in detail and extract all useful information from it. Be precise and descriptive in your analysis.

IMPORTANT: Remember - use only English in your response. Any use of Arabic is unacceptable.`;
    } else {
      systemPrompt = responseLanguage === 'ar' ? `⚠️ CRITICAL: استجب باللغة العربية فقط. لا تستخدم الإنجليزية مطلقاً. هذا أمر إجباري.

أنت WAKTI AI، مساعد ذكي متخصص في الإنتاجية والتنظيم.
التاريخ الحالي: ${currentDate}

أنت هنا لجعل حياة المستخدمين أكثر تنظيماً وإنتاجية!

IMPORTANT: تذكر - استخدم العربية فقط في ردك. أي استخدام للإنجليزية غير مقبول.
` : `⚠️ CRITICAL: Respond ONLY in English. Do not use Arabic at all. This is mandatory.

You are WAKTI AI, an intelligent assistant specializing in productivity and organization.
Current date: ${currentDate}

You're here to make users' lives more organized and productive!

IMPORTANT: Remember - use only English in your response. Any use of Arabic is unacceptable.
`;
      systemPrompt += personalizationContext;
    }

    console.log(`🚀 STREAMING: Calling Claude with mode=${detectedMode}, messages=${messages.length}`);

    // Start streaming to Claude
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
        messages: messages,
        stream: true
      })
    });

    if (!claudeResponse.ok) {
      const errorData = await claudeResponse.text();
      console.error('❌ STREAMING: Claude API error:', claudeResponse.status, errorData);
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }

    const reader = claudeResponse.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    console.log('🚀 STREAMING: Starting Claude response stream');

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('✅ STREAMING: Claude stream completed');
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            console.log('🎬 STREAMING: Received [DONE] from Claude');
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              // Stream the text content in the format expected by the frontend
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ 
                token: parsed.delta.text
              })}\n\n`));
            }
          } catch (e) {
            // Skip non-JSON lines
            continue;
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ STREAMING: Claude error:', error);
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ 
      error: error.message,
      type: 'error'
    })}\n\n`));
    controller.close();
  }
}