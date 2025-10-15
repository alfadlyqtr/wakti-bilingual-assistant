import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { executeRegularSearch } from './search.ts'

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
function buildSystemPrompt(
  language: string,
  currentDate: string,
  personalTouch: any,
  activeTrigger: string,
) {
  const pt = personalTouch || {};
  const ptNick = (pt.nickname || '').toString().trim();
  const ptTone = (pt.tone || '').toString().trim();
  const ptStyle = (pt.style || '').toString().trim();

  const langRule = language === 'ar'
    ? 'CRITICAL: Respond ONLY in Arabic. Do NOT use English.'
    : 'CRITICAL: Respond ONLY in English. Do NOT use Arabic.';

  const PERSONAL_TOUCH = `
CRITICAL PERSONAL TOUCH ENFORCEMENT ===
- Nickname: ${ptNick ? `Use the user's nickname "${ptNick}" naturally and warmly.` : 'No nickname provided.'}
- Tone: ${ptTone ? `Maintain a ${ptTone} tone consistently.` : 'Default to a friendly, neutral tone.'}
- Style: ${ptStyle ? `Shape your structure as ${ptStyle}.` : 'Keep answers concise and clear.'}
`;

  const INTELLIGENT_FORMATTING = `
CRITICAL OUTPUT FORMATTING RULES ===
- Choose ONE primary format based on content:
  1) Markdown table: for structured results (search results, comparisons, item lists with attributes). Keep headers short; cells concise.
  2) Bulleted list: for steps, checklists, pros/cons, short enumerations.
  3) Natural paragraph (1–3 sentences): for conversational replies and short explanations.
- Do NOT include headings like "TABLE", "SUMMARY", or "SOURCES" unless the user asks.
- Use Markdown links only when explicit URLs are provided within context. Avoid placeholders.
- Do NOT add code fences unless the user asks for code.
`;

  const SEARCH_BEHAVIOR = `
SEARCH BEHAVIOR (when active) ===
- Read provided search snippets carefully and synthesize a short, direct answer first.
- If scan-friendly, render a compact Markdown table (e.g., Title | Source | Key Point) or a short bulleted list.
- Avoid filler; be precise; do not invent sources.
`;

  return `${langRule}

${PERSONAL_TOUCH}

You are WAKTI AI — a high-performance text chat and search assistant. Date: ${currentDate}

${INTELLIGENT_FORMATTING}

${activeTrigger === 'search' ? SEARCH_BEHAVIOR : ''}

- Always answer directly and helpfully.
- Keep responses aligned with user language (${language}).
- Avoid verbose preambles and avoid repeating the question unless necessary.`;
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
              console.log('🔎 STREAMING: Web search context injected');
            } else {
              console.log('🔎 STREAMING: No web search context available or search disabled');
            }
          } catch (e) {
            console.warn('⚠️ STREAMING: Web search injection failed:', e);
          }
        }
         
         // Regular text message
        const languagePrefix = responseLanguage === 'ar' 
          ? 'يرجى الرد باللغة العربية فقط. قدم إجابة مباشرة بدون إضافة "المصدر:" في النهاية. ' 
          : 'Please respond in English only. Provide a direct answer without adding "Source:" attribution at the end. ';
        messages.push({ role: 'user', content: languagePrefix + message });

        // Choose provider (text-only): OpenAI first, fallback to Claude
        let aiProvider: 'openai' | 'claude' | 'unknown' = 'unknown';
        let streamReader: ReadableStreamDefaultReader<any> | null = null;

        const tryOpenAI = async () => {
          if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
          const model = 'gpt-4o-mini';
          console.log(`🤖 STREAMING: Attempting OpenAI (${model})...`);
          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.7,
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
