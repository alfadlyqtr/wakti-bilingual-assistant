import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const allowedOrigins = [
  'https://wakti.qa',
  'https://www.wakti.qa',
  'http://localhost:8080',
  'http://127.0.0.1:54063'
];

const getCorsHeaders = (origin) => {
  const isAllowed = origin && (
    allowedOrigins.some(allowed => origin.startsWith(allowed)) ||
    origin.includes('lovable.dev') ||
    origin.includes('lovable.app') ||
    origin.includes('lovableproject.com')
  );

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control, x-request-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

console.log("WAKTI AI V2 STREAMING BRAIN: Ready");

// === GEMINI HELPER ===
function getGeminiApiKey() {
  const k = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!k) throw new Error("Gemini API key not configured");
  return k;
}

function buildTextContent(role, text) {
  return { role, parts: [{ text }] };
}

async function streamGemini(model, contents, onToken, systemInstruction, generationConfig) {
  const key = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
  const body = { contents };
  if (systemInstruction) body.system_instruction = { parts: [{ text: systemInstruction }] };
  if (generationConfig) body.generationConfig = generationConfig;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
      "x-goog-api-key": key,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok || !resp.body) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Gemini error: ${resp.status} - ${t}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const cands = parsed?.candidates;
        if (Array.isArray(cands) && cands.length > 0) {
          const parts = cands[0]?.content?.parts || [];
          for (const p of parts) {
            const text = typeof p?.text === "string" ? p.text : undefined;
            if (text) onToken(text);
          }
        }
      } catch { /* ignore */ }
    }
  }
}

// Build system prompt with Personal Touch
function buildSystemPrompt(language, currentDate, personalTouch, activeTrigger) {
  const pt = personalTouch || {};
  const userNick = (pt.nickname || '').toString().trim();
  const aiNick = (pt.ai_nickname || '').toString().trim();
  const tone = (pt.tone || 'neutral').toString().trim();
  const style = (pt.style || 'short answers').toString().trim();

  let personalSection = '';
  if (userNick || aiNick) {
    personalSection = `\nCRITICAL PERSONAL TOUCH ENFORCEMENT\n`;
    if (userNick) {
      personalSection += `- User nickname: "${userNick}". USE this nickname naturally and warmly in your responses.\n`;
    }
    if (aiNick) {
      personalSection += `- Your AI nickname: "${aiNick}". When referring to yourself, use this nickname.\n`;
    }
    personalSection += `- Tone: ${tone}. Maintain this tone consistently.\n`;
    personalSection += `- Style: ${style}. Shape your responses to match this style.\n`;
  }

  return `CRITICAL IDENTITY
You are WAKTI AI — the ultimate productivity AI app built to simplify life, boost creativity, and make technology feel human.

ABOUT WAKTI:
- Purpose: Empower individuals and teams with intelligent tools that simplify daily life, enhance productivity, and remove barriers to creativity and communication.
- Mission: Create an AI app people love and rely on every single day — the intelligent digital partner for modern life.

WAKTI FEATURES:
- Smart Tasks & Subtasks: Sharable tasks with real-time progress tracking
- Event Invites: Live RSVP for gatherings
- Voice Tools: Record meetings/lectures, convert to searchable transcripts and summaries
- Voice Cloning & Translation: 60+ languages for text and audio
- AI Chat: Intelligent conversation and assistance
- Smart Search: Powerful web search integration
- Content Generation: Text, images, and videos

WHO MADE WAKTI:
- Created by: TMW (The Modern Web)
- Location: Doha, Qatar
- Website: tmw.qa

ABOUT TMW (The Modern Web):
- Tagline: "Your Web, Your Success"
- Services: AI chatbots, professional website design, AI-powered website builder, WordPress hosting, website security, NFC cards, domain registration
- Specialty: Modern web solutions with AI-powered tools
- Key Features: Best pricing, super easy to use, dedicated support

When asked "who made you": Say "I was made by TMW (The Modern Web), a web solutions company based in Doha, Qatar. Visit tmw.qa to learn more."
When asked "what is TMW": Say "TMW (The Modern Web) is a modern web solutions company in Doha, Qatar that specializes in AI chatbots, website design, hosting, and AI-powered tools. Their website is tmw.qa."
When asked "tell me about TMW": Explain their services, AI-powered website builder, hosting solutions, and their mission to help businesses establish their online presence.

CRITICAL MULTI-LANGUAGE RULE
- You are multilingual. Default to the UI language "${language}".
- If the user asks for a translation or specifies a target language, RESPOND IN THAT TARGET LANGUAGE.
${personalSection}
CRITICAL OUTPUT FORMAT
- Markdown table: for structured multi-item results (≥3 items with attributes).
- Bulleted list: for steps, checklists, 1–2 results.
- Paragraph: for conversational replies.
- Use Markdown links ONLY when a real URL is provided.

${activeTrigger === 'search' ? `SEARCH BEHAVIOR
- Read search context carefully; synthesize a direct answer.
- FORCE TABLE if ≥3 results, BULLETS if 1–2.
` : ''}
You are WAKTI AI — date: ${currentDate}.`;
}

function convertMessagesToClaudeFormat(messages) {
  const systemMessage = messages.find((m) => m.role === 'system');
  const conversationMessages = messages.filter((m) => m.role !== 'system');
  return {
    system: systemMessage?.content || '',
    messages: conversationMessages
  };
}

async function streamClaudeResponse(reader, controller, encoder) {
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
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              token: parsed.delta.text,
              content: parsed.delta.text
            })}\n\n`));
          }
          if (parsed.type === 'message_stop') {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            break;
          }
        } catch { /* ignore */ }
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
        // Defensive body parsing to handle connection drops and incomplete payloads
        let body: any = {};
        try {
          const bodyText = await req.text();
          body = bodyText ? JSON.parse(bodyText) : {};
        } catch (bodyErr) {
          console.error('🔥 BODY PARSE ERROR:', (bodyErr as Error).message);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Invalid request body or connection interrupted' })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

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
        } = body;
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
          let geminiTokenCount = 0;
          await streamGemini(
            'gemini-2.5-flash-lite',
            contents,
            (token) => {
              geminiTokenCount++;
              try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token, content: token })}\n\n`)); } catch {}
            },
            sysMsg,
            { temperature: activeTrigger === 'search' ? 0.3 : 0.7, maxOutputTokens: 4000 },
            []
          );
          if (geminiTokenCount === 0) {
            throw new Error('Gemini produced no tokens');
          }
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
