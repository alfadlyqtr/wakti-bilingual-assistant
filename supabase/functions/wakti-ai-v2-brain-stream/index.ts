import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, x-streaming',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

console.log("🚀 WAKTI AI STREAMING: Ultra-fast streaming service loaded");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 STREAMING: Processing request");
    
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      throw new Error('Invalid authentication');
    }

    const requestBody = await req.json();
    const {
      message,
      language = 'en',
      conversationId = null,
      activeTrigger = 'chat',
      attachedFiles = []
    } = requestBody;

    if (!message?.trim() && !attachedFiles?.length) {
      throw new Error('Message or attachment required');
    }

    console.log("🚀 STREAMING: Starting AI response stream");

    // Process attached files for document support
    let processedContent = message;
    if (attachedFiles?.length > 0) {
      const documentContent = await processDocuments(attachedFiles);
      if (documentContent) {
        processedContent = `${message}\n\nDocument content:\n${documentContent}`;
      }
    }

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await streamAIResponse(processedContent, language, activeTrigger, controller, attachedFiles);
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
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

// Document processing function
async function processDocuments(attachedFiles: any[]): Promise<string> {
  let documentContent = '';
  
  for (const file of attachedFiles) {
    try {
      if (file.type === 'text/plain' && file.content) {
        // Handle TXT files
        const textContent = atob(file.content);
        documentContent += `\n[${file.name}]:\n${textContent}\n`;
      } else if (file.type === 'application/pdf' && file.content) {
        // For PDF, we'll extract text using a simple approach
        // In production, you'd use a proper PDF parsing library
        documentContent += `\n[${file.name}]: PDF file attached (content extraction not implemented yet)\n`;
      } else if (file.type?.includes('document') && file.content) {
        // Handle DOC files
        documentContent += `\n[${file.name}]: Document file attached (content extraction not implemented yet)\n`;
      }
    } catch (error) {
      console.warn(`Failed to process file ${file.name}:`, error);
    }
  }
  
  return documentContent;
}

// Ultra-fast streaming AI response
async function streamAIResponse(
  message: string,
  language: string,
  activeTrigger: string,
  controller: ReadableStreamDefaultController,
  attachedFiles: any[] = []
) {
  // Choose API based on files (force OpenAI for vision)
  let apiKey = DEEPSEEK_API_KEY;
  let apiUrl = 'https://api.deepseek.com/v1/chat/completions';
  let model = 'deepseek-chat';
  
  if (!apiKey || (attachedFiles?.length > 0 && attachedFiles.some(f => f.type?.startsWith('image/')))) {
    apiKey = OPENAI_API_KEY;
    apiUrl = 'https://api.openai.com/v1/chat/completions';
    model = 'gpt-5-nano-2025-08-07';
  }
  
  if (!apiKey) {
    throw new Error("No AI API key configured");
  }

  const startTime = Date.now();
  let browsingUsed = false;
  let browsingData: any = null;

  // If Search mode, run Tavily and augment the user message
  let effectiveMessage = message;
  if (activeTrigger === 'search') {
    try {
      const searchRes: any = await executeRegularSearch(message, language);
      if (searchRes?.success && searchRes?.data) {
        browsingUsed = true;
        browsingData = searchRes.data;
        const sourcesList = Array.isArray(searchRes.data.results)
          ? searchRes.data.results
              .map((r: any, i: number) => `${i + 1}. ${r.title || 'Source'} - ${r.url || ''}`)
              .join("\n")
          : '';
        const instructEn = `\n\nUse the following search context and cite sources inline like [1], [2] when relevant. Start with a concise answer, then include a Sources section listing the URLs.\n\n`;
        const instructAr = `\n\nاستخدم السياق التالي من نتائج البحث واذكر المصادر داخل النص مثل [1] و[2] عند الحاجة. ابدأ بإجابة مختصرة، ثم أضف قسمًا للمصادر يتضمن الروابط.\n\n`;
        const preamble = language === 'ar' ? instructAr : instructEn;
        const sourcesHeader = language === 'ar' ? 'المصادر:' : 'Sources:';
        const answerHeader = language === 'ar' ? 'ملخص الإجابة:' : 'Answer Summary:';
        const answer = searchRes.data.answer ? `${answerHeader} ${searchRes.data.answer}\n\n` : '';
        const contextBlock = searchRes.context ? `${searchRes.context}\n\n` : '';
        const sourcesBlock = sourcesList ? `${sourcesHeader}\n${sourcesList}\n\n` : '';
        effectiveMessage = `${message}\n\n${preamble}${answer}${contextBlock}${sourcesBlock}`.trim();
      }
    } catch (e) {
      // If search fails, continue without augmentation
      console.warn('SEARCH pre-processing failed in stream:', e);
    }
  }

  const systemPrompt = language === 'ar' 
    ? `أنت WAKTI، مساعد ذكي متقدم. كن ودوداً ومفيداً ومختصراً في إجاباتك. استخدم نصاً عادياً واضحاً بدون رموز زائدة.`
    : `You are WAKTI, an advanced AI assistant. Be friendly, helpful, and concise. Use clean, plain text without excessive formatting.`;

  // Prepare messages with file support
  let userContent: any = effectiveMessage;
  
  if (attachedFiles?.length > 0) {
    const contentParts: any[] = [{ type: 'text', text: effectiveMessage }];
    
    for (const file of attachedFiles) {
      if (file.type?.startsWith('image/') && file.content) {
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${file.type};base64,${file.content}`
          }
        });
      }
    }
    
    userContent = contentParts;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];

  console.log("🚀 STREAMING: Making API request");

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_completion_tokens: 2048,
      stream: true
    })
  });

  if (!response.ok) {
    throw new Error(`AI API failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body reader');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalSent = false;

  const sendFinalEvent = () => {
    if (finalSent) return;
    finalSent = true;
    const responseTime = Date.now() - startTime;
    const payload = { done: true, model, responseTime, browsingUsed, browsingData };
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        sendFinalEvent();
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            sendFinalEvent();
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            
            if (content) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: content })}\n\n`));
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }
  } catch (err) {
    const msg = (err as Error)?.message || 'Streaming error';
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
  } finally {
    controller.close();
  }
}

// Search functionality
async function executeRegularSearch(query: string, language: string = 'en') {
  const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');
  
  console.log('🔍 SEARCH: Starting search for:', query.substring(0, 50));
  
  if (!TAVILY_API_KEY) {
    return {
      success: false,
      error: 'Search service not configured',
      data: null,
      context: ''
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

    // Safe JSON parsing with validation
    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response from search service');
    }

    let searchData;
    try {
      searchData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('❌ SEARCH JSON parsing error:', jsonError);
      console.error('❌ Raw response:', responseText.substring(0, 200));
      throw new Error('Invalid JSON response from search service');
    }

    // Extract information safely
    const results = Array.isArray(searchData.results) ? searchData.results : [];
    const answer = searchData.answer || '';
    
    // Build context from search results
    let context = '';
    if (answer) {
      context += `Search Answer: ${answer}\n\n`;
    }
    
    if (results.length > 0) {
      context += 'Search Results:\n';
      results.forEach((result: any, index: number) => {
        if (result && typeof result === 'object') {
          context += `${index + 1}. ${result.title || 'No title'}\n`;
          context += `   ${result.content || 'No content'}\n`;
          context += `   Source: ${result.url || 'No URL'}\n\n`;
        }
      });
    }

    console.log(`✅ SEARCH: Found ${results.length} results`);
    return {
      success: true,
      error: null,
      data: {
        answer,
        results,
        query,
        total_results: results.length
      },
      context: context.trim()
    };

  } catch (error) {
    console.error('❌ SEARCH: Critical error:', error);
    
    return {
      success: false,
      error: 'Search failed',
      data: null,
      context: '',
      details: error.message
    };
  }
}
