import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { executeRegularSearch } from "./search.ts";

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
  // Timing/metadata
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
  type Provider = 'openai' | 'claude' | 'deepseek';
  let provider: Provider | null = null;
  let model: string = '';
  let fallbackUsed = false;

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
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];

  console.log("🚀 STREAMING: Making API request");

  // Helper to send final metadata
  let finalSent = false;
  const sendFinalEvent = (modelUsed: string) => {
    if (finalSent) return;
    finalSent = true;
    const responseTime = Date.now() - startTime;
    const payload = { done: true, model: modelUsed, responseTime, browsingUsed, browsingData, fallbackUsed };
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
  };

  // Helper: stream text as faux tokens
  async function streamTextChunks(text: string, modelUsed: string) {
    const chunkSize = 40;
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize);
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: chunk })}\n\n`));
      // Micro delay to simulate streaming
      await new Promise((r) => setTimeout(r, 5));
    }
    sendFinalEvent(modelUsed);
    controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
  }

  // If Claude is selected (or used as fallback), handle non-streaming -> simulated token stream
  if (provider === 'claude') {
    try {
      const claudeContent: any[] = [];
      // Language prefix for strict output language
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
          max_tokens: 2048,
          temperature: 0.7,
          system: systemPrompt,
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

      await streamTextChunks(text, model);
      return;
    } catch (err) {
      const msg = (err as Error)?.message || 'Claude fallback error';
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      controller.close();
      return;
    }
  }

  // OpenAI/DeepSeek streaming path (OpenAI primary)
  const isOpenAI = provider === 'openai';
  const apiUrl = isOpenAI
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://api.deepseek.com/v1/chat/completions';
  const apiKey = isOpenAI ? OPENAI_API_KEY : DEEPSEEK_API_KEY;

  try {
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
        max_tokens: 2048,
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        sendFinalEvent(model);
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
          sendFinalEvent(model);
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
            max_tokens: 2048,
            temperature: 0.7,
            system: systemPrompt,
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
        await streamTextChunks(text, model);
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
            temperature: 0.7,
            max_tokens: 2048,
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            sendFinalEvent(deepseekModel);
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
              sendFinalEvent(deepseekModel);
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
}
