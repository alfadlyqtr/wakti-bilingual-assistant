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

${activeTrigger === 'search' ? `
CRITICAL SEARCH FORMATTING RULES (NON-NEGOTIABLE)
You are in SEARCH MODE. You will receive search results in the conversation.

FORMATTING ENFORCEMENT:
- NEVER respond with a single long paragraph. This is FORBIDDEN.
- If the user's style is "short answers": Use 1-2 sentence intro + max 3 short bullet points.
- If the user's style is "detailed": Use 2-3 sentence intro + 5-7 bullet points.
- If the user's style contains "bullet": Use minimal intro + only bullet points for content.
- If there are 3 or more distinct events/items: Use a Markdown table with columns like: Event | Key Detail | Source (optional).
- If there are 1-2 items: Use bullet points, NOT a table.
- ALWAYS start with a greeting using the user's nickname if provided (e.g., "Here's what's happening today, ${userNick || 'friend'}:").

CONTENT RULES:
- Base your answer ONLY on the search results provided.
- Do NOT invent events, dates, or facts not in the search results.
- Keep each bullet point or table row concise (1-2 sentences max).
- If search results are unclear or incomplete, say so instead of guessing.

EXAMPLE OUTPUT (3+ items, table format):
Here's what's happening today, abdullah:

| Event | Key Detail |
| --- | --- |
| Mobile World Congress 2025 | Launched in Doha with 32 digital projects |
| Global Platform for Disaster Risk | Opens at Qatar National Convention Centre |
| 12th World Innovation Summit | Focuses on AI in education |

EXAMPLE OUTPUT (1-2 items, bullets):
Here's what's happening today, abdullah:

- Mobile World Congress 2025 launched in Doha, showcasing 32 edge digital projects from 17 governments.
- The 12th World Innovation Summit for Education opened, focusing on AI's role in transforming learning.
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


async function executeRegularSearch(query, language = 'en') {
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
    // Recency heuristic: if the query implies breaking/very recent info, prefer 'day'
    const freshIntent = /\b(today|latest|now|live|breaking|scores?|result|this\s*(week|day)|tonight|just\s*now|update[sd]?|news)\b/i.test(query);
    const time_range = freshIntent ? 'day' : 'week';

    const searchPayload = {
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: "advanced",
      time_range,
      include_answer: "advanced",
      include_raw_content: true,
      chunks_per_source: 5,
      follow_up_questions: true,
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
    const followUpQuestions = Array.isArray(searchData.follow_up_questions) ? searchData.follow_up_questions : [];
    
    // Build context from search results
    let context = '';
    if (answer) {
      context += `Search Answer: ${answer}\n\n`;
    }
    
    if (results.length > 0) {
      context += 'Search Results:\n';
      results.forEach((result, index) => {
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
        followUpQuestions,
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
        // Defensive body parsing
        let body = {};
        try {
          const bodyText = await req.text();
          body = bodyText ? JSON.parse(bodyText) : {};
        } catch (bodyErr) {
          console.error('🔥 BODY PARSE ERROR:', bodyErr.message);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Invalid request body' })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        const { 
          message, 
          language = 'en', 
          recentMessages = [], 
          personalTouch = null, 
          activeTrigger = 'general'
        } = body;

        console.log(`🎯 REQUEST: trigger=${activeTrigger}, lang=${language}`);

        if (!message) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Message required' })}\n\n`));
          controller.close();
          return;
        }

        const currentDate = new Date().toLocaleDateString('en-US', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Qatar'
        });

        // Build enhanced system prompt
        const systemPrompt = buildSystemPrompt(language, currentDate, personalTouch, activeTrigger);
        
        const messages = [
          { role: 'system', content: systemPrompt }
        ];

        // Add history
        if (recentMessages && recentMessages.length > 0) {
          const historyMessages = recentMessages.slice(-6);
          historyMessages.forEach((msg) => {
            if (msg.role === 'user' || msg.role === 'assistant') {
              messages.push({ role: msg.role, content: msg.content });
            }
          });
        }
        
        // Inject web search context when in Search mode
        if (activeTrigger === 'search') {
          try {
            const s = await executeRegularSearch(message, language);
            
            if (s?.success) {
              // Emit metadata
              try {
                const metaPayload = {
                  metadata: {
                    search: {
                      answer: s.data?.answer || null,
                      total: s.data?.total_results || 0,
                      results: Array.isArray(s.data?.results) ? s.data.results.slice(0, 5) : [],
                      followUpQuestions: s.data?.followUpQuestions || []
                    }
                  }
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(metaPayload)}\n\n`));
              } catch {}

              // Inject Tavily context into LLM conversation
              if (s.context) {
                const ctxPrefix = language === 'ar'
                  ? 'استخدم نتائج البحث التالية للإجابة:\n'
                  : 'Use the following search results to answer:\n';
                
                // Combine search context with user query in one message
                const combinedMessage = `${ctxPrefix}${s.context}\n\nUser question: ${message}`;
                messages.push({ role: 'user', content: combinedMessage });
                console.log('🔎 SEARCH: Context + query combined into single message');
              } else {
                // No search context, just add user message normally
                messages.push({ role: 'user', content: message });
              }
            }
          } catch (e) {
            console.warn('⚠️ SEARCH ERROR:', e);
            // If search fails, still add user message
            messages.push({ role: 'user', content: message });
          }
        } else {
          // Not search mode, add user message normally
          messages.push({ role: 'user', content: message });
        }

        let aiProvider = 'none';
        let streamReader = null;

        const tryGemini = async () => {
          const sysMsg = messages.find((m) => m.role === 'system')?.content || '';
          const userMsgs = messages.filter((m) => m.role !== 'system');
          const contents = [];
          if (sysMsg) contents.push(buildTextContent('user', sysMsg));
          for (const m of userMsgs) {
            if (typeof m?.content === 'string') {
              contents.push(buildTextContent(m.role === 'assistant' ? 'model' : 'user', m.content));
            }
          }
          
          aiProvider = 'gemini';
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
            { temperature: activeTrigger === 'search' ? 0.3 : 0.7, maxOutputTokens: 4000 }
          );
          
          if (geminiTokenCount === 0) {
            throw new Error('Gemini produced no tokens');
          }
        };

        const tryOpenAI = async () => {
          if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
          console.log('🤖 Trying OpenAI...');
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages,
              temperature: activeTrigger === 'search' ? 0.3 : 0.7,
              max_tokens: 4000,
              stream: true,
            }),
          });
          if (!response.ok) throw new Error(`OpenAI failed: ${response.status}`);
          
          aiProvider = 'openai';
          streamReader = response.body?.getReader() || null;
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ providerUsed: 'openai' })}\n\n`)); } catch {}
          console.log('✅ OpenAI');
        };

        const tryClaude = async () => {
          if (!ANTHROPIC_API_KEY) throw new Error('Claude API key not configured');
          console.log('🤖 Trying Claude...');
          const { system, messages: claudeMessages } = convertMessagesToClaudeFormat(messages);
          const response = await fetch('https://api.anthropic.com/v1/messages', {
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
          if (!response.ok) throw new Error(`Claude failed: ${response.status}`);
          
          aiProvider = 'claude';
          streamReader = response.body?.getReader() || null;
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ providerUsed: 'claude' })}\n\n`)); } catch {}
          console.log('✅ Claude');
        };

        try {
          try {
            await tryGemini();
          } catch (errGemini) {
            console.warn('⚠️ Gemini failed, trying OpenAI...', errGemini.message);
            try {
              await tryOpenAI();
            } catch (errOpenAI) {
              console.warn('⚠️ OpenAI failed, trying Claude...', errOpenAI.message);
              await tryClaude();
            }
          }
        } catch (finalErr) {
          console.error('❌ All providers failed', finalErr.message);
          throw finalErr;
        }

        if (aiProvider === 'gemini') {
          try { controller.close(); } catch {}
          return;
        }
        if (!streamReader) throw new Error('No stream reader available');

        if (aiProvider === 'openai') {
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { done, value } = await streamReader.read();
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
                } catch {}
              }
            }
          }
        } else if (aiProvider === 'claude') {
          await streamClaudeResponse(streamReader, controller, encoder);
        }

        controller.close();
      } catch (error) {
        console.error('🔥 ERROR:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Service unavailable' })}\n\n`));
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
