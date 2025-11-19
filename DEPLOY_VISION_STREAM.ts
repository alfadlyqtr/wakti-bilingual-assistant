// DEPLOYMENT FILE FOR: wakti-vision-stream
// Copy this ENTIRE file into Supabase Dashboard → wakti-vision-stream → index.ts

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// ============================================================================
// INLINED GEMINI HELPER
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
  try {
    console.log(`[GEMINI_VISION_DEBUG] Using key prefix: ${key.slice(0, 6)}***`);
    console.log(`[GEMINI_VISION_DEBUG] URL: ${url}`);
    console.log(`[GEMINI_VISION_DEBUG] Payload roles: ${contents.map((c) => c.role).join(', ')}`);
  } catch {}
  if (systemInstruction) body.system_instruction = { parts: [{ text: systemInstruction }] };
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
      } catch {}
    }
  }
}

// ============================================================================
// MAIN VISION FUNCTION
// ============================================================================
const allowedOrigins = ['https://wakti.qa', 'https://www.wakti.qa'];
const getCorsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && (allowedOrigins.some(a => origin.startsWith(a)) || origin.includes('lovable')) ? origin : '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control, x-request-id, x-mobile-request',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin'
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("WAKTI VISION STREAM: Ready with Gemini 2.5 Flash-Lite");

function normalizeImage(input: { mimeType?: string; dataBase64?: string; url?: string }) {
  const mime = (input.mimeType || '').toLowerCase().replace('image/jpg', 'image/jpeg');
  let url = (input.url || '').trim().replace(/^%20+/, '').replace(/[\u0000-\u001F\u007F\u00A0\u200B\u200C\u200D]+/, '');
  const data = input.dataBase64 || '';
  if (url) return { mimeType: mime || 'image/jpeg', url };
  if (!data) return null;
  const m = data.match(/^data:(.*?);base64,(.*)$/);
  if (m) {
    const mm = (m[1] || '').toLowerCase().replace('image/jpg', 'image/jpeg');
    return { mimeType: mm, base64: m[2] };
  }
  return { mimeType: mime || 'image/jpeg', base64: data };
}

async function fetchImageAsBase64(url: string) {
  let cleanUrl = (url || '').trim().replace(/^%20+/, '').replace(/[\u0000-\u001F\u007F\u00A0\u200B\u200C\u200D]+/, '');
  if (!/^https?:\/\//i.test(cleanUrl)) throw new Error(`Invalid URL: ${cleanUrl.slice(0, 48)}...`);
  const res = await fetch(cleanUrl);
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const mimeHeader = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].toLowerCase().replace('image/jpg', 'image/jpeg');
  const ab = await res.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(sub) as unknown as number[]);
  }
  const base64 = btoa(binary);
  return { base64, mimeType: mimeHeader, byteLength: bytes.byteLength };
}

function buildSystemPrompt(language: string, currentDate: string, personalTouch: any) {
  const pt = personalTouch || {};
  const langRule = language === 'ar' ? 'CRITICAL: Respond ONLY in Arabic.' : 'CRITICAL: Respond ONLY in English.';
  const ptNick = (pt.nickname || '').toString().trim();
  const ptTone = (pt.tone || '').toString().trim();
  const ptStyle = (pt.style || '').toString().trim();
  const PT = `PERSONAL TOUCH: Nickname=${ptNick || 'none'}, Tone=${ptTone || 'neutral'}, Style=${ptStyle || 'short'}. Use consistently.`;
  const VISION = `VISION CAPABILITIES: Analyze images, perform OCR, extract data from documents, answer Q&A about visual content.`;
  return `${langRule}\n\n${PT}\n\nYou are WAKTI Vision. Date: ${currentDate}\n${VISION}`;
}

function convertToOpenAIMessages(systemPrompt: string, prompt: string, language: string, images: { mimeType: string; base64?: string; url?: string }[]) {
  const content: any[] = [];
  content.push({ type: 'text', text: `${language === 'ar' ? 'يرجى الرد بالعربية فقط.' : 'Respond in English only.'} ${prompt || ''}`.trim() });
  for (const img of images) {
    if (img.url) {
      content.push({ type: 'image_url', image_url: { url: img.url } });
    } else if (img.base64) {
      const dataUrl = `data:${img.mimeType};base64,${img.base64}`;
      content.push({ type: 'image_url', image_url: { url: dataUrl } });
    }
  }
  return [{ role: 'system', content: systemPrompt }, { role: 'user', content }];
}

function convertToClaude(systemPrompt: string, prompt: string, language: string, images: { mimeType: string; base64?: string; url?: string }[]) {
  const content: any[] = [];
  content.push({ type: 'text', text: `${language === 'ar' ? 'يرجى الرد بالعربية فقط.' : 'Respond in English only.'} ${prompt || ''}`.trim() });
  for (const img of images) {
    if (img.base64) {
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64 } });
    }
  }
  return { system: systemPrompt, messages: [{ role: 'user', content }] };
}

async function streamClaudeResponse(reader: ReadableStreamDefaultReader, controller: ReadableStreamDefaultController, encoder: TextEncoder) {
  const decoder = new TextDecoder();
  let buffer = '';
  let doneSent = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        doneSent = true;
        break;
      }
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          const token = parsed.delta.text as string;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token, content: token })}\n\n`));
        }
        if (parsed.type === 'message_stop') {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          doneSent = true;
          break;
        }
      } catch {}
    }
  }
  if (!doneSent) {
    try { controller.enqueue(encoder.encode('data: [DONE]\n\n')); } catch {}
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let bodyRaw = '';
        try { bodyRaw = await req.text(); } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Bad Request' })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          return controller.close();
        }
        let body: any = {};
        try { body = bodyRaw ? JSON.parse(bodyRaw) : {}; } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Invalid JSON' })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          return controller.close();
        }

        const { requestId = crypto.randomUUID(), prompt = '', language = 'en', personalTouch = null, provider = 'openai', model, images = [], options = { ocr: true, max_tokens: 1200 }, stream = false } = body || {};

        try {
          const meta = { requestId, provider, model: model || null, imagesCount: Array.isArray(images) ? images.length : 0 };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata: meta })}\n\n`));
        } catch {}

        if (!Array.isArray(images) || images.length === 0) throw new Error('No images');
        if (images.length > 4) throw new Error('Max 4 images');

        const norm = images.map((f: any) => normalizeImage({ mimeType: f?.mimeType || f?.type, dataBase64: f?.data || f?.content, url: f?.url })).filter(Boolean) as { mimeType: string; base64?: string; url?: string }[];
        if (norm.length === 0) throw new Error('No valid images');

        const MAX_BYTES = 8 * 1024 * 1024;
        for (const n of norm) {
          if (n.url) {
            const originalMime = n.mimeType;
            const { base64, mimeType, byteLength } = await fetchImageAsBase64(n.url);
            if (byteLength > MAX_BYTES) throw new Error('Image too large (max 8MB)');
            n.base64 = base64;
            n.mimeType = originalMime || mimeType;
            delete (n as any).url;
          }
        }
        for (const n of norm) {
          if (n.base64) {
            const approxBytes = Math.floor((n.base64.length * 3) / 4);
            if (approxBytes > MAX_BYTES) throw new Error('Image too large (max 8MB)');
          }
        }

        const now = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Qatar' });
        const systemPrompt = buildSystemPrompt(language, now, personalTouch);

        if (!stream) {
          try {
            if (!ANTHROPIC_API_KEY) throw new Error('Claude not configured');
            const { system, messages } = convertToClaude(systemPrompt, prompt, language, norm);
            const m = model || 'claude-3-5-sonnet-20241022';
            const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: m, system, messages, temperature: 0.2, max_tokens: options?.max_tokens || 2000, stream: false })
            });
            if (!claudeResp.ok) {
              const errTxt = await claudeResp.text();
              const err = { error: 'Claude failed', status: claudeResp.status, details: errTxt.slice(0, 300) };
              return controller.enqueue(encoder.encode(`data: ${JSON.stringify(err)}\n\n`)), controller.close();
            }
            const data = await claudeResp.json();
            const text = Array.isArray(data?.content) ? (data.content.map((c: any) => c?.text || '').join('')) : (data?.content?.[0]?.text || '');
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ json: null, summary: text, metadata: { model: m } })}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            return controller.close();
          } catch (e) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: (e as Error).message })}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            return controller.close();
          }
        }

        let streamReader: ReadableStreamDefaultReader | null = null;

        const tryGeminiVision = async () => {
          const systemText = systemPrompt;
          const contents: any[] = [];
          if (systemText) contents.push(buildTextContent('user', systemText));
          const promptText = `${language === 'ar' ? 'يرجى الرد بالعربية فقط.' : 'Respond in English only.'} ${prompt || ''}`.trim();
          const userParts: any[] = [{ text: promptText }];
          for (const img of norm) {
            if (img?.base64 && img?.mimeType) {
              userParts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
            }
          }
          contents.push({ role: 'user', parts: userParts });
          const encoder2 = new TextEncoder();
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ providerUsed: 'gemini' })}\n\n`)); } catch {}
          await streamGemini('gemini-2.5-flash-lite', contents, (token) => {
            try { controller.enqueue(encoder2.encode(`data: ${JSON.stringify({ token, content: token })}\n\n`)); } catch {}
          }, systemText, { temperature: 0.2, maxOutputTokens: options?.max_tokens || 2000 }, []);
        };

        const tryOpenAI = async () => {
          if (!OPENAI_API_KEY) throw new Error('OpenAI not configured');
          const messages = convertToOpenAIMessages(systemPrompt, prompt, language, norm);
          const openaiModels = [model || 'gpt-4o-2024-08-06', 'gpt-4o', 'gpt-4o-mini'];
          let lastErr: any = null;
          for (const m of openaiModels) {
            const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
              body: JSON.stringify({ model: m, messages, temperature: 0.2, max_tokens: options?.max_tokens || 2000, stream: true })
            });
            if (!openaiResponse.ok) {
              lastErr = new Error(`OpenAI failed: ${openaiResponse.status} ${await openaiResponse.text()}`);
              if (openaiResponse.status === 404 || openaiResponse.status === 400 || openaiResponse.status === 429 || openaiResponse.status === 529) continue;
              continue;
            }
            try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ providerUsed: 'openai' })}\n\n`)); } catch {}
            streamReader = openaiResponse.body?.getReader() || null;
            const decoder2 = new TextDecoder();
            let buf2 = '';
            let doneSent2 = false;
            while (true) {
              const { done, value } = await streamReader.read();
              if (done) break;
              buf2 += decoder2.decode(value, { stream: true });
              const lines = buf2.split('\n');
              buf2 = lines.pop() || '';
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6);
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  doneSent2 = true;
                  break;
                }
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content as string | undefined;
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: content, content })}\n\n`));
                  }
                } catch {}
              }
            }
            if (!doneSent2) {
              try { controller.enqueue(encoder.encode('data: [DONE]\n\n')); } catch {}
            }
            return;
          }
          throw lastErr || new Error('OpenAI failed');
        };

        const tryClaude = async () => {
          if (!ANTHROPIC_API_KEY) throw new Error('Claude not configured');
          const { system, messages } = convertToClaude(systemPrompt, prompt, language, norm);
          const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
            body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', system, messages, temperature: 0.2, max_tokens: options?.max_tokens || 2000, stream: true })
          });
          if (!claudeResponse.ok) {
            throw new Error(`Claude failed: ${claudeResponse.status} ${await claudeResponse.text()}`);
          }
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ providerUsed: 'claude' })}\n\n`)); } catch {}
          streamReader = claudeResponse.body?.getReader() || null;
          if (!streamReader) throw new Error('No stream');
          await streamClaudeResponse(streamReader, controller, encoder);
        };

        try {
          try { 
            await tryGeminiVision(); 
          } catch (e1) {
            console.error('❌ Gemini Vision failed:', e1);
            try { 
              await tryOpenAI(); 
            } catch (e2) {
              console.error('❌ OpenAI Vision failed:', e2);
              await tryClaude();
            }
          }
        } catch (error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Vision unavailable', details: (error as Error).message })}\n\n`));
        }

        controller.close();
      } catch (error) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Vision unavailable', details: (error as Error).message })}\n\n`));
        controller.close();
      }
    }
  });

  return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
});
