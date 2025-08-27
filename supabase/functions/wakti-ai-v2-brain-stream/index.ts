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
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

function sendFinalEvent(controller: ReadableStreamDefaultController, model: string, fallbackUsed: boolean = false, browsingUsed: boolean = false, browsingData: any = null) {
  try {
    const finalData = {
      done: true,
      model: model,
      fallbackUsed: fallbackUsed,
      responseTime: Date.now(),
      browsingUsed: browsingUsed,
      browsingData: browsingData
    };
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(finalData)}\n\n`));
  } catch (error) {
    console.error('Error sending final event:', error);
  }
}

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
      attachedFiles = [],
      personalTouch = null,
      recentMessages = [],
      conversationSummary = '',
      clientLocalHour = null,
      isWelcomeBack = false
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
          await streamAIResponse(processedContent, language, activeTrigger, controller, attachedFiles, personalTouch, recentMessages, conversationSummary, clientLocalHour, isWelcomeBack);
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
  attachedFiles: any[] = [],
  personalTouch: any = null,
  recentMessages: any[] = [],
  conversationSummary: string = '',
  clientLocalHour: number | null = null,
  isWelcomeBack: boolean = false
) {
  // Initialize provider-specific config after selection
  let apiKey: string = '';
  let apiUrl: string = '';
  let model = '';

  // Choose API based on files (force OpenAI for vision)
  let provider: 'openai' | 'claude' | 'deepseek' | null = null;
  let fallbackUsed = false;

  if (!OPENAI_API_KEY || (attachedFiles?.length > 0 && attachedFiles.some(f => f.type?.startsWith('image/')))) {
    provider = 'openai';
  } else if (ANTHROPIC_API_KEY) {
    provider = 'claude';
  } else if (DEEPSEEK_API_KEY) {
    provider = 'deepseek';
  } else {
    throw new Error("No AI API key configured");
  }

  // Configure API endpoint and key based on selected provider
  if (provider === 'openai') {
    apiKey = OPENAI_API_KEY || '';
    apiUrl = 'https://api.openai.com/v1/chat/completions';
  } else if (provider === 'deepseek') {
    apiKey = DEEPSEEK_API_KEY || '';
    apiUrl = 'https://api.deepseek.com/v1/chat/completions';
  } else if (provider === 'claude') {
    // We'll intentionally let the OpenAI request fail (401) to trigger the Claude path in catch
    apiKey = OPENAI_API_KEY || '';
    apiUrl = 'https://api.openai.com/v1/chat/completions';
  }

  if (!apiKey && provider !== 'claude') {
    throw new Error("No AI API key configured");
  }

  const startTime = Date.now();
  let browsingUsed = false as boolean;
  let browsingData: any = null;

  // Determine if we have valid vision inputs (images with base64 content)
  const hasImages = Array.isArray(attachedFiles) && attachedFiles.some(f => f?.type?.startsWith('image/'));
  const hasValidVisionImages = Array.isArray(attachedFiles) && attachedFiles.some(
    (f) => f?.type?.startsWith('image/') && (f?.content || f?.data)
  );

  // Select provider according to project rules (OpenAI primary), with sensible fallbacks
  // Vision: OpenAI -> Claude (DeepSeek skipped for vision)
  // Text/Search: OpenAI -> Claude -> DeepSeek
  if (hasValidVisionImages) {
    if (OPENAI_API_KEY) {
      provider = 'openai';
      model = 'gpt-4o-mini';
    } else if (ANTHROPIC_API_KEY) {
      provider = 'claude';
      model = 'claude-3-5-sonnet-20241022';
      fallbackUsed = true; // not primary
    } else {
      throw new Error('Vision mode requires OpenAI or Claude API key');
    }
  } else {
    if (OPENAI_API_KEY) {
      provider = 'openai';
      model = 'gpt-4o-mini';
    } else if (ANTHROPIC_API_KEY) {
      provider = 'claude';
      model = 'claude-3-5-sonnet-20241022';
      fallbackUsed = true;
    } else if (DEEPSEEK_API_KEY) {
      provider = 'deepseek';
      model = 'deepseek-chat';
      fallbackUsed = true;
    } else {
      throw new Error("No AI API key configured");
    }
  }

  const systemPrompt = language === 'ar' 
    ? `أنت WAKTI، مساعد ذكي متقدم. كن ودوداً ومفيداً ومختصراً في إجاباتك. استخدم نصاً عادياً واضحاً بدون رموز زائدة.`
    : `You are WAKTI, an advanced AI assistant. Be friendly, helpful, and concise. Use clean, plain text without excessive formatting.`;

  // Brand identity rules (applied always)
  const brandRules = language === 'ar'
    ? [
        'عند سؤالك: "من صنعك؟" اشرح: أنا مزيج من عدة نماذج ذكاء اصطناعي متقدمة، تم اختيار الأفضل منها بعناية ودمجها وصقلها من قبل فريق Wakti.',
        'لا تقل أبداً أن OpenAI أو أي شركة أخرى هي من "صنعتك" بشكل مباشر. بدلاً من ذلك، انسب الفضل إلى فريق Wakti.',
        'قدّم نفسك باسم WAKTI AI مع التركيز على الجودة والثقة.'
      ]
    : [
        'If asked "who made you?": say you are a blend of multiple advanced AI models, carefully selected, orchestrated, and refined by the Wakti team.',
        'Never claim that OpenAI or any other company directly "made" you. Attribute creation to the Wakti team.',
        'Represent yourself as WAKTI AI with a focus on quality and trust.'
      ];

  // Start with brand identity
  let systemPromptFinal = systemPrompt + `\n\nBrand Identity:\n- ` + brandRules.join('\n- ');

  // Optional conversation summary for continuity
  if (conversationSummary && typeof conversationSummary === 'string' && conversationSummary.trim().length > 0) {
    const summaryLabel = language === 'ar' ? 'ملخص المحادثة السابقة' : 'Conversation summary';
    systemPromptFinal += `\n\n${summaryLabel}:\n${conversationSummary.trim()}`;
  }

  // Apply Personal Touch (tone, style, nicknames, extra instructions)
  if (personalTouch) {
    try {
      const { nickname, aiNickname, tone, style, instruction } = personalTouch || {};
      const lines: string[] = [];
      if (language === 'ar') {
        if (nickname) lines.push(`نادِ المستخدم باسم "${nickname}" عند المناسب.`);
        if (aiNickname) lines.push(`قدّم نفسك أحياناً باسم "${aiNickname}".`);
        if (tone) lines.push(`استخدم نبرة ${tone}.`);
        if (style) lines.push(`أسلوب الرد: ${style}.`);
        if (instruction) lines.push(`تعليمات إضافية: ${instruction}`);
      } else {
        if (nickname) lines.push(`Address the user as "${nickname}" when appropriate.`);
        if (aiNickname) lines.push(`You may refer to yourself as "${aiNickname}" occasionally.`);
        if (tone) lines.push(`Use a ${tone} tone.`);
        if (style) lines.push(`Reply style: ${style}.`);
        if (instruction) lines.push(`Additional instructions: ${instruction}`);
      }
      if (lines.length > 0) {
        systemPromptFinal += `\n\nPersonalization:\n- ` + lines.join('\n- ');
      }
      console.log('🎯 STREAMING: Personalization applied to system prompt');
    } catch (e) {
      console.warn('⚠️ STREAMING: Failed to apply personalTouch', e);
    }
  }

  // Map personalTouch to temperature and max_tokens
  let temperature = 0.65; // default
  let maxTokens = 2048; // fallback
  
  if (personalTouch?.tone) {
    const tone = personalTouch.tone.toLowerCase();
    if (tone.includes('funny') || tone.includes('casual')) temperature = 0.70;
    else if (tone.includes('encouraging')) temperature = 0.65;
    else if (tone.includes('neutral')) temperature = 0.62;
    else if (tone.includes('serious')) temperature = 0.58;
  }
  
  if (personalTouch?.style) {
    const style = personalTouch.style.toLowerCase();
    if (style.includes('short')) maxTokens = 256;
    else if (style.includes('bullet')) maxTokens = 512;
    else if (style.includes('step')) maxTokens = 768;
    else if (style.includes('detailed')) maxTokens = 1024;
  }

  // Optionally enrich with web search context when activeTrigger === 'search'
  let searchContext = '';
  try {
    if (activeTrigger === 'search') {
      const searchRes = await executeRegularSearch(message, language);
      if (searchRes?.success && searchRes?.context) {
        browsingUsed = true;
        browsingData = {
          engine: 'tavily',
          total_results: searchRes?.data?.total_results ?? 0,
          answer: searchRes?.data?.answer ?? null
        };
        searchContext = searchRes.context;
      } else {
        browsingData = { engine: 'tavily', success: false, error: searchRes?.error || 'No results' };
      }
    }
  } catch (e) {
    browsingData = { engine: 'tavily', success: false, error: (e as Error)?.message };
  }

  // Prepare messages with file support and optional search context
  const textMessage = searchContext
    ? `${message}\n\nWeb search context:\n${searchContext}`
    : message;

  let userContent: any = textMessage;
  if (attachedFiles?.length > 0) {
    const contentParts: any[] = [{ type: 'text', text: textMessage }];
    for (const file of attachedFiles) {
      const base64 = file?.data || file?.content; // accept either
      if (file?.type?.startsWith('image/') && base64) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: `data:${file.type};base64,${base64}` }
        });
      }
    }
    userContent = contentParts;
  }

  const messages = [
    { role: 'system', content: systemPromptFinal },
    // Insert recent history (last 20 already handled on frontend)
    ...((Array.isArray(recentMessages) ? recentMessages : []).map((m: any) => ({
      role: m?.role === 'assistant' ? 'assistant' : 'user',
      content: m?.content ?? ''
    }))),
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
      temperature: temperature,
      max_tokens: maxTokens,
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

  // Ensure we only append the AI nickname signature once even if both
  // a [DONE] event and the reader completion fire.
  let signatureSent = false;
  function appendSignatureOnce(language: string, aiNickname?: string) {
    if (signatureSent) return;
    try {
      const sig = buildSignature(language, personalTouch?.aiNickname);
      if (sig) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: sig })}\n\n`));
      }
      signatureSent = true;
    } catch {}
  }

  // Helper: detect identity-maker questions to force branded answer
  function isIdentityQuestion(text: string, language: string): boolean {
    if (!text) return false;
    const t = ('' + text).toLowerCase();
    if (language === 'ar') {
      return /(من\s+صنعك|من\s+أنشأك|من\s+بنى\s+|من\s+طورك)/.test(t);
    }
    return /(who\s+made\s+you|who\s+created\s+you|who\s+built\s+you|who\s+developed\s+you)/.test(t);
  }

  // Removed greeting helpers (timeOfDay, buildGreeting) — greetings are handled entirely on the frontend

  function buildSignature(language: string, aiNickname?: string): string {
    if (!aiNickname) return '';
    return language === 'ar' ? `، ${aiNickname}` : `, ${aiNickname}`;
  }

  // Greeting injection moved to frontend. Do not emit greeting tokens here.

  try {
    while (true) {
    const { done, value } = await reader.read();
    if (done) {
      // Append signature once before finalizing
      appendSignatureOnce(language, personalTouch?.aiNickname);
      sendFinalEvent(controller, model, fallbackUsed, browsingUsed, browsingData);
      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);

      if (data === '[DONE]') {
        // Append signature once before finalizing
        appendSignatureOnce(language, personalTouch?.aiNickname);
        sendFinalEvent(controller, model, fallbackUsed, browsingUsed, browsingData);
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        continue;
      }

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: content })}\n\n`));
        }
      } catch (_) {
        // ignore malformed json chunks
      }
    }
  }
} catch (err) {
  // If OpenAI fails and Claude is available (and not vision invalid), fall back
  if (provider === 'openai' && ANTHROPIC_API_KEY) {
    try {
      fallbackUsed = true;
      // Reuse same message, switch to Claude simulated stream
      const claudeContent: any[] = [];
      const languagePrefix = language === 'ar' ? 'يرجى الرد باللغة العربية فقط. ' : 'Please respond in English only. ';
      claudeContent.push({ type: 'text', text: languagePrefix + textMessage });
      if (hasValidVisionImages) {
        for (const file of attachedFiles) {
          const base64 = file?.data || file?.content;
          if (file?.type?.startsWith('image/') && base64) {
            claudeContent.push({
              type: 'image',
              source: { type: 'base64', media_type: file.type, data: base64 }
            });
          }
        }
      }

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ANTHROPIC_API_KEY}`,
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: maxTokens,
          temperature: temperature,
          system: systemPromptFinal,
          messages: [{ role: 'user', content: claudeContent }]
        })
      });

      if (!resp.ok) {
        const errTxt = await resp.text();
        throw new Error(`Claude API error: ${resp.status} - ${errTxt}`);
      }

      const data = await resp.json();
      const text = Array.isArray(data?.content)
        ? data.content.map((c: any) => c?.text || '').join('')
        : (data?.content?.[0]?.text || '');

      model = 'claude-3-5-sonnet-20241022';
      // Stream Claude (non-streaming response) directly as a single token and finalize
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: text })}\n\n`));
      sendFinalEvent(controller, model, fallbackUsed, browsingUsed, browsingData);
      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      return;
    } catch (err2) {
      const msg = (err2 as Error)?.message || 'Fallback (Claude) error';
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      controller.close();
      return;
    }
  }

  // If DeepSeek available and not vision mode, try DeepSeek as final fallback
  if (!hasValidVisionImages && DEEPSEEK_API_KEY && provider !== 'deepseek') {
    try {
      fallbackUsed = true;
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messages,
          temperature: temperature,
          max_tokens: maxTokens,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      const deepseekModel = 'deepseek-chat';

      // Greeting injection moved to frontend. Do not emit greeting tokens here (DeepSeek fallback).

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Option 1: append signature before finalizing
          try {
            const sig = buildSignature(language, personalTouch?.aiNickname);
            if (sig) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: sig })}\n\n`));
            }
          } catch {}
          sendFinalEvent(controller, deepseekModel, fallbackUsed, browsingUsed, browsingData);
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') {
            try {
              const sig = buildSignature(language, personalTouch?.aiNickname);
              if (sig) {
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: sig })}\n\n`));
              }
            } catch {}
            sendFinalEvent(controller, deepseekModel, fallbackUsed, browsingUsed, browsingData);
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: content })}\n\n`));
            }
          } catch {}
        }
      }
      return;
    } catch (err3) {
      const msg = (err3 as Error)?.message || 'DeepSeek fallback error';
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      controller.close();
      return;
    }
  }

  const msg = (err as Error)?.message || 'Streaming error';
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
  controller.close();
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

// end-of-file
