// DEPLOYMENT FILE FOR: wakti-ai-v2-brain-stream
// Copy this ENTIRE file into Supabase Dashboard → wakti-ai-v2-brain-stream → index.ts

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// ============================================================================
// INLINED GEMINI HELPER (from _shared/gemini.ts)
// ============================================================================
type GeminiPart = { text?: string } | { inlineData: { mimeType: string; data: string } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

function getGeminiApiKey(): string {
  const k = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!k) throw new Error("Gemini API key not configured");
  return k;
}

function buildTextContent(role: "user" | "model", text: string): GeminiContent {
  return { role, parts: [{ text }] };
}

async function streamGemini(
  model: string,
  contents: GeminiContent[],
  onToken: (t: string) => void,
  systemInstruction?: string,
  generationConfig?: any,
  safetySettings?: any[]
): Promise<void> {
  const key = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
  const body: any = { contents };

  // Temporary debug logging to confirm runtime configuration
  try {
    console.log(`[GEMINI_DEBUG] Using key prefix: ${key.slice(0, 6)}***`);
    console.log(`[GEMINI_DEBUG] URL: ${url}`);
    console.log(`[GEMINI_DEBUG] Payload roles: ${contents.map((c) => c.role).join(', ')}`);
  } catch {}
  if (systemInstruction) body.system_instruction = { parts: [{ text: systemInstruction }] }; // FIXED: Removed role field for Gemini 2.5 strict validation
  if (generationConfig) body.generationConfig = generationConfig;
  if (safetySettings) body.safetySettings = safetySettings;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
      "x-goog-api-key": key
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok || !resp.body) {
    const t = await resp.text().catch(() => "");
    console.error(`[GEMINI_DEBUG] Gemini response error ${resp.status}: ${t}`);
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
      try { console.log(`[GEMINI_DEBUG] raw chunk: ${data}`); } catch {}
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
      } catch {}
    }
  }
}

// ============================================================================
// SEARCH HELPER (inlined from search.ts)
// ============================================================================
async function executeRegularSearch(query: string, language: string = 'en') {
  const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');
  if (!TAVILY_API_KEY) {
    return { success: false, error: 'Search not configured', data: null, context: '' };
  }
  try {
    const freshIntent = /\b(today|latest|now|live|breaking|scores?|result|this\s*(week|day)|tonight|just\s*now|update[sd]?|news)\b/i.test(query);
    const time_range = freshIntent ? 'day' : 'week';
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        time_range,
        include_answer: "advanced",
        include_raw_content: true,
        chunks_per_source: 5,
        max_results: 5
      })
    });
    if (!response.ok) throw new Error(`Search API error: ${response.status}`);
    const searchData = await response.json();
    const results = Array.isArray(searchData.results) ? searchData.results : [];
    const answer = searchData.answer || '';
    let context = '';
    if (answer) context += `Search Answer: ${answer}\n\n`;
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
    return { success: true, error: null, data: { answer, results, query, total_results: results.length }, context: context.trim() };
  } catch (error: any) {
    return { success: false, error: 'Search failed', data: null, context: '', details: error.message };
  }
}

// ============================================================================
// VISION SYSTEM (simplified - only essential parts)
// ============================================================================
class VisionSystem {
  static shouldUseVisionMode(activeTrigger: string, attachedFiles: any[]): boolean {
    if (activeTrigger === 'vision') return true;
    if (attachedFiles && attachedFiles.length > 0) {
      return attachedFiles.some(file => file.type?.startsWith('image/'));
    }
    return false;
  }

  static buildCompleteSystemPrompt(language: string, currentDate: string, personalTouch: any): string {
    const langRule = language === 'ar' 
      ? 'CRITICAL: استجب باللغة العربية فقط.'
      : 'CRITICAL: Respond ONLY in English.';
    return `${langRule}\n\nYou are WAKTI AI Vision. Date: ${currentDate}\nAnalyze images, perform OCR, extract data, and answer questions about visual content.`;
  }

  static buildVisionMessage(content: string, attachedFiles: any[], language: string, provider?: string): any {
    const imageFiles = attachedFiles.filter(f => f.type?.startsWith('image/'));
    if (imageFiles.length === 0) {
      return { role: "user", content: language === 'ar' ? 'يرجى الرد بالعربية. ' + content : 'Respond in English. ' + content };
    }
    if (provider === 'openai') {
      const parts: any[] = [{ type: 'text', text: content }];
      for (const file of imageFiles) {
        const base64 = file?.data || file?.content || '';
        const mime = file?.type || 'image/png';
        const url = base64.startsWith('data:') ? base64 : `data:${mime};base64,${base64}`;
        parts.push({ type: 'image_url', image_url: { url } });
      }
      return { role: 'user', content: parts };
    }
    // Claude format
    const parts: any[] = [{ type: "text", text: content }];
    imageFiles.forEach(file => {
      const base64 = file?.data || file?.content;
      if (base64) parts.push({ type: "image", source: { type: "base64", media_type: file.type, data: base64 } });
    });
    return { role: 'user', content: parts };
  }
}

// ============================================================================
// MAIN FUNCTION LOGIC
// ============================================================================
const allowedOrigins = ['https://wakti.qa', 'https://www.wakti.qa'];
const getCorsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && (allowedOrigins.some(a => origin.startsWith(a)) || origin.includes('lovable')) ? origin : '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control, x-request-id, x-mobile-request, x-app-name, x-auth-token, x-skip-auth, content-length',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("WAKTI AI V2 BRAIN STREAM: Ready with Gemini 2.5 Flash-Lite");

function buildSystemPrompt(language: string, currentDate: string, personalTouch: any, activeTrigger: string) {
  const pt = personalTouch || {};
  const ptNick = (pt.nickname || '').toString().trim() || 'none';
  const ptTone = (pt.tone || '').toString().trim() || 'neutral';
  const ptStyle = (pt.style || '').toString().trim() || 'short answers';
  return `IDENTITY & BRAND:
- You are **WAKTI AI**, the main assistant inside the Wakti app.
- Wakti is an all-in-one AI-powered platform that makes life smarter, faster, and easier by combining productivity, creativity, and lifestyle tools in one place.
- You are not Google, Gemini, OpenAI, ChatGPT, Anthropic, or any other company. Never say you were trained or created by them.
 - If the user asks "who made you?", answer: "I was designed and developed in-house in Doha, Qatar by TMW (The Modern Web, tmw.qa), the team behind the Wakti app."
 - If the user asks "what is Wakti?", explain it as the all-in-one AI app that brings together productivity (tasks, reminders, messaging, smart text, tasjeel voice recorder, voice translation), creativity (image generation, music, voice cloning), and lifestyle & social features (Maw3d events and RSVPs, Vitality wellness tracker, Wakti Journal, AI games).
 - If the user asks "what is TMW" or "who is TMW", answer: "TMW (The Modern Web) is a web hosting and digital design agency based in Doha, Qatar. They design and build websites, mobile apps, and AI-powered tools, and they’re the team behind the Wakti app."
 - If the user asks "tell me more about TMW" or asks for details about TMW, expand: "TMW (The Modern Web) is a web hosting and digital design agency based in Doha, Qatar, founded in 2023. They help businesses establish their online presence with domain registration and hosting, custom website and mobile app design and development, AI tools like an AI website builder and custom chatbots, NFC digital business cards, and website security services. Their mission is to fill a gap in the Qatar market for high-quality, personalized web hosting and digital design for both small and large businesses."
 - You only remember this current conversation. Do not claim long-term memory across different sessions.

LANGUAGE & STYLE:
- MULTI-LANGUAGE: Default to "${language}". If the user requests translation, respond in the target language.
- PERSONAL TOUCH: Nickname=${ptNick}, Tone=${ptTone}, Style=${ptStyle}. Use consistently in phrasing and attitude.
- FORMAT: Choose table (≥3 items), bullets (1–2 items), or a short paragraph. Avoid unnecessary fluff and placeholder links.

SEARCH BEHAVIOR:
${activeTrigger === 'search' ? '- SEARCH MODE: When you have search context, synthesize it clearly. Use tables for ≥3 results, bullets for 1–2, and a concise paragraph otherwise.' : '- GENERAL MODE: Answer directly and practically without over-explaining.'}

CONTEXT:
- Today is ${currentDate}. You are WAKTI AI answering inside the Wakti app for this user.`;
}

type BasicMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function convertMessagesToClaudeFormat(messages: BasicMessage[]) {
  const systemMessage = messages.find(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');
  return { system: systemMessage?.content || '', messages: conversationMessages };
}

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
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: parsed.delta.text, content: parsed.delta.text })}\n\n`));
          }
          if (parsed.type === 'message_stop') {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            break;
          }
        } catch {}
      }
    }
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { message, language = 'en', recentMessages = [], personalTouch = null, activeTrigger = 'general', inputType = 'text', attachedFiles = [], visionPrimary, visionFallback } = await req.json();
        if (!message) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Message required' })}\n\n`));
          controller.close();
          return;
        }

        const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Qatar' });
        const useVision = inputType === 'vision' || VisionSystem.shouldUseVisionMode(activeTrigger, attachedFiles);

        // VISION PATH
        if (useVision) {
          const systemPromptVision = VisionSystem.buildCompleteSystemPrompt(language, currentDate, personalTouch);
          let streamReader: any = null;
          let aiProvider: 'openai' | 'claude' = 'claude';

          const tryClaudeVision = async () => {
            if (!ANTHROPIC_API_KEY) throw new Error('Claude not configured');
            const claudeMessages: any[] = [];
            try {
              const hist = Array.isArray(recentMessages) ? recentMessages.slice(-6) : [];
              hist.forEach((m: any) => {
                if ((m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string') {
                  claudeMessages.push({ role: m.role, content: m.content });
                }
              });
            } catch {}
            claudeMessages.push(VisionSystem.buildVisionMessage(message, attachedFiles || [], language));
            const resp = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'x-api-key': ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', system: systemPromptVision, messages: claudeMessages, max_tokens: 4000, stream: true })
            });
            if (!resp.ok) throw new Error(`Claude failed: ${resp.status}`);
            streamReader = resp.body?.getReader();
            aiProvider = 'claude';
          };

          const tryOpenAIVision = async () => {
            if (!OPENAI_API_KEY) throw new Error('OpenAI not configured');
            const openaiMessages: any[] = [
              { role: 'system', content: systemPromptVision },
              VisionSystem.buildVisionMessage(message, attachedFiles || [], language, 'openai')
            ];
            const resp = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: 'gpt-4o-mini', messages: openaiMessages, temperature: 0.7, max_tokens: 4000, stream: true })
            });
            if (!resp.ok) throw new Error(`OpenAI failed: ${resp.status}`);
            streamReader = resp.body?.getReader();
            aiProvider = 'openai';
          };

          const primary = visionPrimary === 'openai' ? 'openai' : 'claude';
          try {
            if (primary === 'claude') await tryClaudeVision(); else await tryOpenAIVision();
          } catch {
            if (primary === 'claude') await tryOpenAIVision(); else await tryClaudeVision();
          }

          if (!streamReader) throw new Error('No vision stream');
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
                  if (data === '[DONE]') { controller.enqueue(encoder.encode('data: [DONE]\n\n')); break; }
                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: content, content })}\n\n`));
                  } catch {}
                }
              }
            }
          } else {
            await streamClaudeResponse(streamReader, controller, encoder);
          }
          controller.close();
          return;
        }

        // TEXT/SEARCH PATH
        const systemPrompt = buildSystemPrompt(language, currentDate, personalTouch, activeTrigger);
        const messages: BasicMessage[] = [{ role: 'system', content: systemPrompt }];
        if (recentMessages && recentMessages.length > 0) {
          const hist = (recentMessages as BasicMessage[]).slice(-10);
          hist.forEach((msg: BasicMessage) => {
            if (msg.role === 'user' || msg.role === 'assistant') messages.push({ role: msg.role, content: msg.content });
          });
        }

        if (activeTrigger === 'search') {
          try {
            const s = await executeRegularSearch(message, language);
            if (s?.success && s?.context) {
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata: { search: { answer: s.data?.answer || null, total: s.data?.total_results || 0, results: Array.isArray(s.data?.results) ? s.data.results.slice(0, 5) : [] } } })}\n\n`));
              } catch {}
              const ctxPrefix = language === 'ar' ? 'استخدم فقط نتائج البحث التالية:\n' : 'Use ONLY the following search results:\n';
              messages.push({ role: 'user', content: ctxPrefix + s.context });
              messages.push({ role: 'system', content: `REMINDER: Use nickname, tone="${personalTouch?.tone || 'neutral'}", style="${personalTouch?.style || 'short'}". Apply search format rules.` });
            }
          } catch {}
        }

        messages.push({ role: 'user', content: message });

        let streamReader: any = null;
        let aiProvider: 'gemini' | 'openai' | 'claude' = 'none';

        const tryGemini = async () => {
          const sysMsg = messages.find((m) => m.role === 'system')?.content || '';
          const userMsgs = messages.filter((m) => m.role !== 'system');
          const contents = [];
          for (const m of userMsgs) {
            if (typeof m?.content === 'string') {
              contents.push(buildTextContent(m.role === 'assistant' ? 'model' : 'user', m.content));
            }
          }
          aiProvider = 'gemini'; // FIXED: Set provider before streaming
          const modelCode = 'gemini-2.5-flash-lite';
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ providerUsed: 'gemini' })}\n\n`)); } catch {}
          await streamGemini(modelCode, contents, (token) => {
            try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token, content: token })}\n\n`)); } catch {}
          }, sysMsg, { temperature: activeTrigger === 'search' ? 0.3 : 0.7, maxOutputTokens: 65536 }, []);
        };

        const tryOpenAI = async () => {
          if (!OPENAI_API_KEY) throw new Error('OpenAI not configured');
          const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: activeTrigger === 'search' ? 0.3 : 0.7, max_tokens: 4000, stream: true })
          });
          if (!resp.ok) throw new Error(`OpenAI failed: ${resp.status}`);
          aiProvider = 'openai';
          streamReader = resp.body?.getReader();
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ providerUsed: 'openai' })}\n\n`)); } catch {}
        };

        const tryClaude = async () => {
          if (!ANTHROPIC_API_KEY) throw new Error('Claude not configured');
          const { system, messages: claudeMessages } = convertMessagesToClaudeFormat(messages);
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', messages: claudeMessages, system, max_tokens: 4000, stream: true })
          });
          if (!resp.ok) throw new Error(`Claude failed: ${resp.status}`);
          aiProvider = 'claude';
          streamReader = resp.body?.getReader();
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ providerUsed: 'claude' })}\n\n`)); } catch {}
        };

        try {
          try { 
            await tryGemini();
            console.log('✅ Gemini streaming completed successfully');
          } catch (geminiErr) { 
            console.error('❌ Gemini failed:', geminiErr);
            console.error('❌ Gemini error details:', JSON.stringify(geminiErr));
            try { 
              await tryOpenAI(); 
            } catch (openaiErr) { 
              console.error('❌ OpenAI failed:', openaiErr); 
              await tryClaude(); 
            } 
          }
        } catch (err) {
          throw err;
        }

        if (aiProvider === 'gemini') {
          try { controller.close(); } catch {}
          return;
        }
        if (!streamReader) throw new Error('No stream');

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
                if (data === '[DONE]') { controller.enqueue(encoder.encode('data: [DONE]\n\n')); break; }
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: content, content })}\n\n`));
                } catch {}
              }
            }
          }
        } else if (aiProvider === 'claude') {
          await streamClaudeResponse(streamReader, controller, encoder);
        }

        controller.close();
      } catch (error) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Service unavailable', details: (error as Error).message })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
});
