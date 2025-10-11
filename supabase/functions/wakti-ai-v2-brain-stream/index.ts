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

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("WAKTI AI V2 STREAMING BRAIN: Ready");

// Helper function to convert OpenAI message format to Claude format
function convertMessagesToClaudeFormat(messages: any[]) {
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
        const { message, conversationId, language = 'en', recentMessages = [], personalTouch = null, activeTrigger = 'general' } = await req.json();
        const responseLanguage = language;

        if (!message) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Message is required' })}\n\n`));
          controller.close();
          return;
        }

        if (!OPENAI_API_KEY) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'AI service not configured' })}\n\n`));
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

        let systemPrompt = responseLanguage === 'ar'
          ? `أنت WAKTI AI، مساعد ذكي ومفيد. التاريخ الحالي: ${currentDate}. قدم إجابات واضحة ودقيقة.`
          : `You are WAKTI AI, an intelligent and helpful assistant. Current date: ${currentDate}. Provide clear and accurate answers.`;

        if (personalTouch) {
          const parts = [];
          if (personalTouch.nickname) parts.push(`User name: ${personalTouch.nickname}`);
          if (personalTouch.aiNickname) parts.push(`AI name: ${personalTouch.aiNickname}`);
          if (personalTouch.tone) parts.push(`Tone: ${personalTouch.tone}`);
          if (personalTouch.style) parts.push(`Style: ${personalTouch.style}`);
          if (personalTouch.instruction) parts.push(`Instructions: ${personalTouch.instruction}`);
          
        if (parts.length > 0) {
            systemPrompt += `\n\nPersonalization: ${parts.join(', ')}`;
          }
        }
        
        // Log personalization application
        console.log('🎨 PERSONAL TOUCH APPLIED:', {
          hasPersonalization: !!personalTouch,
          nickname: personalTouch?.nickname || 'none',
          tone: personalTouch?.tone || 'default',
          style: personalTouch?.style || 'default'
        });

        // Build messages array
        let messages = [
          { role: 'system', content: systemPrompt }
        ];

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
        
        // Inject web search context when in Search mode (non-vision)
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
         
         // Add language enforcement directly in the user message
         const languagePrefix = responseLanguage === 'ar' 
           ? 'يرجى الرد باللغة العربية فقط. قدم إجابة مباشرة بدون إضافة "المصدر:" في النهاية. ' 
           : 'Please respond in English only. Provide a direct answer without adding "Source:" attribution at the end. ';
         
         messages.push({
           role: 'user',
           content: languagePrefix + message
         });

        // Try OpenAI first, fallback to Claude
        let aiProvider = 'unknown';
        let streamReader: ReadableStreamDefaultReader | null = null;
        let openaiError: Error | null = null;

        try {
          // TRY OPENAI FIRST
          if (!OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
          }
          
          console.log('🤖 STREAMING: Attempting OpenAI (gpt-4o-mini)...');
          
          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: messages,
              temperature: 0.7,
              max_tokens: 4000,
              stream: true,
            }),
          });

          if (openaiResponse.ok) {
            aiProvider = 'openai';
            streamReader = openaiResponse.body?.getReader() || null;
            console.log('✅ STREAMING: Using OpenAI');
          } else {
            throw new Error(`OpenAI failed with status: ${openaiResponse.status}`);
          }
          
        } catch (error) {
          openaiError = error as Error;
          console.warn('⚠️ STREAMING: OpenAI failed, attempting Claude fallback...', openaiError.message);
          
          // FALLBACK TO CLAUDE
          if (!ANTHROPIC_API_KEY) {
            throw new Error(`OpenAI failed and Claude API key not configured. OpenAI error: ${openaiError.message}`);
          }
          
          try {
            const { system, messages: claudeMessages } = convertMessagesToClaudeFormat(messages);
            
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
                system: system,
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
            console.log('✅ STREAMING: Using Claude (fallback)');
            
          } catch (claudeError) {
            console.error('❌ STREAMING: Both OpenAI and Claude failed');
            throw new Error(`All AI providers failed. OpenAI: ${openaiError.message}, Claude: ${(claudeError as Error).message}`);
          }
        }

        // STREAM THE RESPONSE
        if (!streamReader) {
          throw new Error('No stream reader available');
        }

        if (aiProvider === 'openai') {
          // Handle OpenAI streaming format
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
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } else if (aiProvider === 'claude') {
          // Handle Claude streaming format
          await streamClaudeResponse(streamReader, controller, encoder);
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
