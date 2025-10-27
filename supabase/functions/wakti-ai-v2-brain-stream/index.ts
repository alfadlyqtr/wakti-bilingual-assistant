import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
<<<<<<< Updated upstream
import { executeRegularSearch } from './search.ts'
=======
import { executeRegularSearch } from "../wakti-ai-v2-brain/search.ts";
import type {
  Attachment,
  AIMessage,
  AIContent,
  Language,
  ActiveTrigger,
  RegularSearchResponse,
  SearchAPIData,
  OpenAIStreamChunk,
} from "../_types/shared.ts";
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes

const allowedOrigins = [
  'https://wakti.qa',
  'https://www.wakti.qa'
];

const getCorsHeaders = (origin: string | null) => {
  const isAllowed = origin && (
    allowedOrigins.includes(origin) ||
    origin.includes('lovable.dev') ||
    origin.includes('lovable.app') ||
    origin.includes('lovableproject.com')
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control, x-request-id, x-mobile-request',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("WAKTI AI V2 STREAMING BRAIN (TEXT-ONLY): Ready");

// Build the system prompt for text chat/search with Personal Touch and intelligent formatting
function buildSystemPrompt(language, currentDate, personalTouch, activeTrigger) {
  const pt = personalTouch || {};
  const ptNick = (pt.nickname || '').toString().trim() || 'none';
  const ptTone = (pt.tone || '').toString().trim() || 'neutral';
  const ptStyle = (pt.style || '').toString().trim() || 'short answers';

<<<<<<< Updated upstream
  const BASE_PROMPT = `CRITICAL MULTI-LANGUAGE RULE\n- You are multilingual. Default to the UI language "${language}".\n- If the user asks for a translation or specifies a target language, RESPOND IN THAT TARGET LANGUAGE.\n\nCRITICAL PERSONAL TOUCH ENFORCEMENT\n- Nickname: ${ptNick}. If provided, USE the nickname naturally and warmly throughout.\n- Tone: ${ptTone}. Maintain this tone consistently.\n- Style: ${ptStyle}. Shape your structure to match the style in ALL replies.\n\nCRITICAL OUTPUT FORMAT SELECTION\n- Choose ONE primary format:\n  1) Markdown table: for structured multi-item results (search, comparisons, lists with attributes).\n     Columns: Title | Source | Key Point. Keep headers short; cells concise.\n  2) Bulleted list: for steps, checklists, 1–2 results, pros/cons, short enumerations.\n  3) 1–3 sentence paragraph: for brief conversational replies or simple explanations.\n- Use Markdown links ONLY when a real URL is provided. No placeholder links.\n- Do NOT wrap normal text in code fences unless the user asks for code.\n\n${activeTrigger === 'search' ? `SEARCH BEHAVIOR (applies only when Search is active)\n- Read the injected search context carefully; synthesize a short, direct answer FIRST.\n- Deterministic formatting:\n  - If results ≥ 3 → render a Markdown table (Title | Source | Key Point).\n  - If 1–2 results → concise bulleted list with sources.\n  - If explanatory/no results → 1–3 sentence paragraph.\n- Be precise. Do NOT invent sources.\n\n` : ''}GENERAL BEHAVIOR\n- Be direct and helpful. Avoid verbose preambles and do not repeat the question unless needed.\n- Use the target language explicitly when the user requests translation.\n\nYou are WAKTI AI — date: ${currentDate}.`;
  return BASE_PROMPT;
}

// Helper function to convert OpenAI message format to Claude format
type BasicMessage = { role: 'system' | 'user' | 'assistant'; content: string };
function convertMessagesToClaudeFormat(messages: BasicMessage[]) {
  const systemMessage = messages.find(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');
  
  return {
    system: systemMessage?.content || '',
    messages: conversationMessages
  };
}
=======
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

    const requestBody = await req.json() as {
      message?: string;
      language?: Language;
      conversationId?: string | null;
      activeTrigger?: ActiveTrigger;
      attachedFiles?: Attachment[];
    };
    const {
      message,
      language = 'en',
      conversationId = null,
      activeTrigger = 'chat',
      attachedFiles = []
    } = requestBody;

    // Ensure strongly typed values for downstream usage
    const lang: Language = language ?? 'en';
    const trig: ActiveTrigger = activeTrigger ?? 'chat';

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
          await streamAIResponse(processedContent, lang, trig, controller, attachedFiles);
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
async function processDocuments(attachedFiles: Attachment[]): Promise<string> {
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
  language: Language,
  activeTrigger: ActiveTrigger,
  controller: ReadableStreamDefaultController,
  attachedFiles: Attachment[] = []
) {
  // Choose API based on files (force OpenAI for vision)
  let apiKey = DEEPSEEK_API_KEY;
  let apiUrl = 'https://api.deepseek.com/v1/chat/completions';
  let model = 'deepseek-chat';
  
  if (!apiKey || (attachedFiles?.length > 0 && attachedFiles.some(f => f.type?.startsWith('image/')))) {
    apiKey = OPENAI_API_KEY;
    apiUrl = 'https://api.openai.com/v1/chat/completions';
    model = 'gpt-4o-mini';
  }
  
  if (!apiKey) {
    throw new Error("No AI API key configured");
  }

  const startTime = Date.now();
  let browsingUsed = false;
  let browsingData: SearchAPIData | null = null;

  // If Search mode, run Tavily and augment the user message
  let effectiveMessage = message;
  if (activeTrigger === 'search') {
    try {
      const searchRes = await executeRegularSearch(message, language) as RegularSearchResponse;
      if (searchRes?.success && searchRes?.data) {
        browsingUsed = true;
        browsingData = searchRes.data;
        const sourcesList = Array.isArray(searchRes.data.results)
          ? searchRes.data.results
              .map((r, i: number) => `${i + 1}. ${r.title || 'Source'} - ${r.url || ''}`)
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
  let userContent: AIContent = effectiveMessage;
  
  if (attachedFiles?.length > 0) {
    const contentParts: Exclude<AIContent, string> = [{ type: 'text', text: effectiveMessage }];
    
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

  const messages: AIMessage[] = [
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
>>>>>>> Stashed changes

// Helper function to stream Claude responses
async function streamClaudeResponse(reader: ReadableStreamDefaultReader, controller: ReadableStreamDefaultController, encoder: TextEncoder) {
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        
        if (data === '[DONE]') {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          break;
        }
        
        try {
          const parsed = JSON.parse(data);
          
          // Claude sends content in delta events
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: parsed.delta.text, content: parsed.delta.text })}\n\n`));
          }
<<<<<<< Updated upstream
          
          // Claude signals completion with message_stop
          if (parsed.type === 'message_stop') {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            break;
=======

          try {
            const parsed = JSON.parse(data) as OpenAIStreamChunk;
            const content = parsed.choices?.[0]?.delta?.content;
            
            if (content) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: content })}\n\n`));
            }
          } catch (e) {
            // Skip malformed JSON
>>>>>>> Stashed changes
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { 
          message, 
          conversationId: _conversationId, 
          language = 'en', 
          recentMessages = [], 
          personalTouch = null, 
          activeTrigger = 'general'
        } = await req.json();
        const responseLanguage = language;
        
        console.log(`🎯 TEXT REQUEST: trigger=${activeTrigger}, language=${language}`);

        if (!message) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Message is required' })}\n\n`));
          controller.close();
          return;
        }
        // Build system prompt
        const currentDate = new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          timeZone: 'Asia/Qatar'
        });

        // Build enhanced system prompt (text-only)
        const systemPrompt = buildSystemPrompt(responseLanguage, currentDate, personalTouch, activeTrigger);
        
        // Log personalization application
        console.log('🎨 PERSONAL TOUCH APPLIED:', {
          hasPersonalization: !!personalTouch,
          nickname: personalTouch?.nickname || 'none',
          tone: personalTouch?.tone || 'default',
          style: personalTouch?.style || 'default'
        });

        // Build messages array
        const messages: BasicMessage[] = [
          { role: 'system', content: systemPrompt }
        ];

        if (recentMessages && recentMessages.length > 0) {
          const historyMessages = (recentMessages as BasicMessage[]).slice(-6);
          historyMessages.forEach((msg: BasicMessage) => {
            if (msg.role === 'user' || msg.role === 'assistant') {
              messages.push({
                role: msg.role,
                content: msg.content
              });
            }
          });
          console.log(`🧠 STREAMING: Using ${historyMessages.length} messages from conversation history`);
        }
        
        // Inject web search context when in Search mode
        if (activeTrigger === 'search') {
          try {
            const s = await executeRegularSearch(message, responseLanguage);
            if (s?.success && s?.context) {
              // Emit metadata to the client with lightweight summary of search
              try {
                const metaPayload = {
                  metadata: {
                    search: {
                      answer: s.data?.answer || null,
                      total: s.data?.total_results || 0,
                      results: Array.isArray(s.data?.results) ? s.data.results.slice(0, 5) : []
                    }
                  }
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(metaPayload)}\n\n`));
              } catch {}
              
              const ctxPrefix = responseLanguage === 'ar'
                ? 'استخدم فقط نتائج البحث التالية للإجابة. لا تذكر أي مصادر أخرى مثل ويكيبيديا:\n'
                : 'Use ONLY the following search results to answer. Do NOT mention any other sources like Wikipedia:\n';
              messages.push({
                role: 'user',
                content: ctxPrefix + s.context
              });
              // Re-assert PT + deterministic formatting right after context
              const reminder = `REMINDER — ENFORCE PT + FORMAT\n- Use nickname if provided. Keep tone "${(personalTouch?.tone||'neutral')}" and style "${(personalTouch?.style||'short answers')}".\n- Apply deterministic format rules for search: table (≥3 results), bullets (1–2), or short paragraph otherwise.\n- Be concise and precise.`;
              messages.push({ role: 'system', content: reminder });
              console.log('🔎 STREAMING: Web search context injected');
            } else {
              console.log('🔎 STREAMING: No web search context available or search disabled');
            }
          } catch (e) {
            console.warn('⚠️ STREAMING: Web search injection failed:', e);
          }
        }
         
        // Regular text message: do NOT enforce hard language prefix so translations can work regardless of UI language
        messages.push({ role: 'user', content: message });

        // Choose provider (text-only): OpenAI first, fallback to Claude
        let aiProvider: 'openai' | 'claude' | 'unknown' = 'unknown';
        let streamReader: ReadableStreamDefaultReader<any> | null = null;

        const tryOpenAI = async () => {
          if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
          const model = 'gpt-4o-mini';
          console.log(`🤖 STREAMING: Attempting OpenAI (${model})...`);
          const temperature = activeTrigger === 'search' ? 0.3 : 0.7;
          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages,
              temperature,
              max_tokens: 4000,
              stream: true,
            }),
          });
          if (!openaiResponse.ok) throw new Error(`OpenAI failed with status: ${openaiResponse.status}`);
          aiProvider = 'openai';
          streamReader = openaiResponse.body?.getReader() || null;
          console.log('✅ STREAMING: Using OpenAI');
        };

        const tryClaude = async () => {
          if (!ANTHROPIC_API_KEY) throw new Error('Claude API key not configured');
          const { system, messages: claudeMessages } = convertMessagesToClaudeFormat(messages);
          console.log('🤖 STREAMING: Attempting Claude...');
          const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20241022',
              messages: claudeMessages,
              system,
              max_tokens: 4000,
              stream: true,
            }),
          });
          if (!claudeResponse.ok) {
            const errorText = await claudeResponse.text();
            throw new Error(`Claude failed with status: ${claudeResponse.status} - ${errorText}`);
          }
          aiProvider = 'claude';
          streamReader = claudeResponse.body?.getReader() || null;
          console.log('✅ STREAMING: Using Claude');
        };

        try {
          // OpenAI first, fallback to Claude
          try {
            await tryOpenAI();
          } catch (errOpenAI) {
            console.warn('⚠️ STREAMING: OpenAI failed, attempting Claude fallback...', (errOpenAI as Error).message);
            await tryClaude();
          }
        } catch (finalErr) {
          console.error('❌ STREAMING: All providers failed', (finalErr as Error).message);
          throw finalErr;
        }

        // STREAM THE RESPONSE
        if (!streamReader) {
          throw new Error('No stream reader available');
        }

        if (aiProvider === 'openai') {
          // Handle OpenAI streaming format
          const decoder = new TextDecoder();
          let buffer = '';
          
          const reader = streamReader as ReadableStreamDefaultReader<any>;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  break;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: content, content })}\n\n`));
                  }
                } catch (_e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } else if (aiProvider === 'claude') {
          // Handle Claude streaming format
          await streamClaudeResponse(streamReader as ReadableStreamDefaultReader<any>, controller, encoder);
        }

        controller.close();
      } catch (error) {
        console.error('🔥 STREAMING ERROR:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          error: 'AI service temporarily unavailable. Please try again.',
          details: (error as Error).message 
        })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});
