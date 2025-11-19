import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { executeRegularSearch } from "./search.ts";
import { VisionSystem } from "./vision.ts";
import { buildTextContent, streamGemini } from "../_shared/gemini.ts";

const allowedOrigins = [
  'https://wakti.qa',
  'https://www.wakti.qa'
];

const getCorsHeaders = (origin: string | null) => {
  const isAllowed = origin && (
    allowedOrigins.includes(origin) ||
    origin.includes('lovable.dev') ||
    origin.includes('lovable.app') ||
    origin.includes('lovableproject.com') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1')
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control, x-request-id, x-mobile-request, x-app-name, x-auth-token, x-skip-auth, content-length',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  };
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');

const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("WAKTI AI V2 STREAMING BRAIN (TEXT-ONLY): Ready");

// Build the system prompt for text chat/search with Personal Touch and intelligent formatting
function buildSystemPrompt(language: string, currentDate: string, personalTouch: any, activeTrigger: string) {
  const pt = personalTouch || {};
  const ptNick = (pt.nickname || '').toString().trim() || 'none';
  const ptTone = (pt.tone || '').toString().trim() || 'neutral';
  const ptStyle = (pt.style || '').toString().trim() || 'short answers';

  const BASE_PROMPT = `CRITICAL MULTI-LANGUAGE RULE
- You are multilingual. Default to the UI language "${language}".
- If the user asks for a translation or specifies a target language, RESPOND IN THAT TARGET LANGUAGE.

CRITICAL PERSONAL TOUCH ENFORCEMENT
- Nickname: ${ptNick}. If provided, USE the nickname naturally and warmly throughout.
- Tone: ${ptTone}. Maintain this tone consistently.
- Style: ${ptStyle}. Shape your structure to match the style in ALL replies.

CRITICAL OUTPUT FORMAT SELECTION
- Choose ONE primary format:
  1) Markdown table: for structured multi-item results (search, comparisons, lists with attributes).
     Columns: Title | Source | Key Point. Keep headers short; cells concise.
  2) Bulleted list: for steps, checklists, 1–2 results, pros/cons, short enumerations.
  3) 1–3 sentence paragraph: for brief conversational replies or simple explanations.
- Use Markdown links ONLY when a real URL is provided. No placeholder links.
- Do NOT wrap normal text in code fences unless the user asks for code.

${activeTrigger === 'search' ? `SEARCH BEHAVIOR (applies only when Search is active)
- Read the injected search context carefully; synthesize a short, direct answer FIRST.
- Deterministic formatting:
  - If results ≥ 3 → render a Markdown table (Title | Source | Key Point).
  - If 1–2 results → concise bulleted list with sources.
  - If explanatory/no results → 1–3 sentence paragraph.
- Be precise. Do NOT invent sources.

` : ''}GENERAL BEHAVIOR
- Be direct and helpful. Avoid verbose preambles and do not repeat the question unless needed.
- Use the target language explicitly when the user requests translation.

You are WAKTI AI — date: ${currentDate}.`;
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
          // Claude signals completion with message_stop
          if (parsed.type === 'message_stop') {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            break;
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
          activeTrigger = 'general',
          inputType = 'text',
          attachedFiles = [],
          visionPrimary,
          visionFallback
        } = await req.json();
        const responseLanguage = language;
        
        console.log(`🎯 STREAM REQUEST: trigger=${activeTrigger}, inputType=${inputType}, language=${language}`);

        if (!message) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Message is required' })}\n\n`));
          controller.close();
          return;
        }
        // Build date once
        const currentDate = new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          timeZone: 'Asia/Qatar'
        });

        // Detect Vision mode (explicit inputType or attached image files)
        const useVision = (
          (typeof inputType === 'string' && inputType === 'vision') ||
          VisionSystem.shouldUseVisionMode(activeTrigger, Array.isArray(attachedFiles) ? attachedFiles : [])
        );

        // If Vision, handle a dedicated provider flow (Claude → OpenAI fallback)
        if (useVision) {
          try {
            const systemPromptVision = VisionSystem.buildCompleteSystemPrompt(responseLanguage, currentDate, personalTouch);

            let aiProvider: 'openai' | 'claude' | 'none' = 'none';
            let streamReader: ReadableStreamDefaultReader<any> | null = null;

            // Provider-specific attempts
            const tryClaudeVision = async () => {
              if (!ANTHROPIC_API_KEY) throw new Error('Claude API key not configured');
              // Build Claude-style message (with base64 images)
              const claudeMessages: any[] = [];
              // Include a small slice of recent text history (optional, text-only)
              try {
                const hist = Array.isArray(recentMessages) ? recentMessages.slice(-6) : [];
                hist.forEach((m: any) => {
                  const r = (m?.role === 'user' || m?.role === 'assistant') ? m.role : null;
                  const c = typeof m?.content === 'string' ? m.content : null;
                  if (r && c) claudeMessages.push({ role: r, content: c });
                });
              } catch {}
              // Append the vision user message
              claudeMessages.push(VisionSystem.buildVisionMessage(message, attachedFiles || [], responseLanguage));

              const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'x-api-key': ANTHROPIC_API_KEY!,
                  'anthropic-version': '2023-06-01',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'claude-3-5-sonnet-20241022',
                  system: systemPromptVision,
                  messages: claudeMessages,
                  max_tokens: 4000,
                  stream: true,
                }),
              });
              if (!claudeResponse.ok) {
                const t = await claudeResponse.text();
                throw new Error(`Claude failed with status: ${claudeResponse.status} - ${t}`);
              }
              aiProvider = 'claude';
              streamReader = claudeResponse.body?.getReader() || null;
              console.log('✅ STREAMING(VISION): Using Claude');
            };

            const tryOpenAIVision = async () => {
              if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
              const model = 'gpt-4o-mini';
              // Build OpenAI-style message (image_url entries)
              const openaiMessages: any[] = [
                { role: 'system', content: systemPromptVision },
                VisionSystem.buildVisionMessage(message, attachedFiles || [], responseLanguage, 'openai')
              ];

              const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${OPENAI_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model,
                  messages: openaiMessages,
                  temperature: 0.7,
                  max_tokens: 4000,
                  stream: true,
                }),
              });
              if (!openaiResponse.ok) throw new Error(`OpenAI failed with status: ${openaiResponse.status}`);
              aiProvider = 'openai';
              streamReader = openaiResponse.body?.getReader() || null;
              console.log('✅ STREAMING(VISION): Using OpenAI');
            };

            // Determine provider order
            const primary: 'claude' | 'openai' = (visionPrimary === 'openai' || visionPrimary === 'claude') ? visionPrimary : 'claude';
            const fallback: 'claude' | 'openai' = primary === 'claude' ? 'openai' : 'claude';

            try {
              if (primary === 'claude') {
                await tryClaudeVision();
              } else {
                await tryOpenAIVision();
              }
            } catch (errPrimary) {
              console.warn(`⚠️ STREAMING(VISION): ${primary} failed, attempting ${fallback} fallback...`, (errPrimary as Error).message);
              if (fallback === 'claude') {
                await tryClaudeVision();
              } else {
                await tryOpenAIVision();
              }
            }

            if (!streamReader) throw new Error('No stream reader available (vision)');

            // Stream tokens
            if (aiProvider === 'openai') {
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
                    } catch { /* ignore invalid json */ }
                  }
                }
              }
            } else if (aiProvider === 'claude') {
              await streamClaudeResponse(streamReader as ReadableStreamDefaultReader<any>, controller, encoder);
            }

            controller.close();
            return;
          } catch (visionErr) {
            console.error('🔥 STREAMING(VISION) ERROR:', visionErr);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              error: 'Vision service temporarily unavailable. Please try again.',
              details: (visionErr as Error).message 
            })}\n\n`));
            controller.close();
            return;
          }
        }

        // TEXT/SEARCH PATH (original behavior)
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

        // Choose provider (text-only): Gemini first, then OpenAI, then Claude
        let aiProvider: 'gemini' | 'openai' | 'claude' | 'none' = 'none';
        let streamReader: ReadableStreamDefaultReader<any> | null = null;

        const tryGemini = async () => {
          // Stream via helper and emit same SSE token format
          const sysMsg = messages.find((m) => m.role === 'system')?.content || '';
          const userMsgs = messages.filter((m) => m.role !== 'system');
          const contents = [] as any[];
          if (sysMsg) contents.push(buildTextContent('user', sysMsg));
          for (const m of userMsgs) {
            if (typeof (m as any)?.content === 'string') {
              contents.push(buildTextContent(m.role === 'assistant' ? 'model' : 'user', (m as any).content));
            }
          }
          aiProvider = 'gemini';
          const encoder = new TextEncoder();
          // Emit providerUsed once before token stream
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ providerUsed: 'gemini' })}\n\n`)); } catch {}
          await streamGemini(
            'gemini-2.5-flash-lite',
            contents,
            (token) => {
              try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token, content: token })}\n\n`)); } catch {}
            },
            sysMsg,
            { temperature: activeTrigger === 'search' ? 0.3 : 0.7, maxOutputTokens: 4000 },
            []
          );
        };

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
          // Emit providerUsed once before token stream
          try { controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ providerUsed: 'openai' })}\n\n`)); } catch {}
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
          // Emit providerUsed once before token stream
          try { controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ providerUsed: 'claude' })}\n\n`)); } catch {}
          console.log('✅ STREAMING: Using Claude');
        };

        try {
          // Gemini first, then OpenAI, then Claude
          try {
            await tryGemini();
          } catch (errGemini) {
            console.warn('⚠️ STREAMING: Gemini failed, attempting OpenAI...', (errGemini as Error).message);
            try {
              await tryOpenAI();
            } catch (errOpenAI) {
              console.warn('⚠️ STREAMING: OpenAI failed, attempting Claude...', (errOpenAI as Error).message);
              await tryClaude();
            }
          }
        } catch (finalErr) {
          console.error('❌ STREAMING: All providers failed', (finalErr as Error).message);
          throw finalErr;
        }

        // STREAM THE RESPONSE
        // Gemini path already streamed tokens directly via helper
        if (aiProvider === 'gemini') {
          try { controller.close(); } catch {}
          return;
        }
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
