import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// Allowed origins (mirror brain stream behavior + dev fallbacks)
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

console.log("WAKTI VISION STREAM: Ready");

// --- Helpers ---
function normalizeImage(input: { mimeType?: string; dataBase64?: string; url?: string } ) {
  const mime = (input.mimeType || '').toLowerCase().replace('image/jpg', 'image/jpeg');
  let url = (input.url || '').trim();
  // Defensive: strip any leading encoded spaces or invisible chars coming from some mobile clients
  if (url) {
    url = url.replace(/^%20+/, '').replace(/^[\u0000-\u001F\u007F\u00A0\u200B\u200C\u200D]+/, '');
  }
  let data = input.dataBase64 || '';
  if (url) return { mimeType: mime || 'image/jpeg', url };
  if (!data) return null;
  // Accept data URI or raw base64
  const dataUriMatch = data.match(/^data:(.*?);base64,(.*)$/);
  if (dataUriMatch) {
    const m = (dataUriMatch[1] || '').toLowerCase().replace('image/jpg', 'image/jpeg');
    return { mimeType: m, base64: dataUriMatch[2] };
  }
  return { mimeType: mime || 'image/jpeg', base64: data };
}

// Download an image by URL and return its base64 data and mime type
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string; byteLength: number }>{
  // Defensive sanitize for malformed mobile URLs (e.g., "%20https://...")
  let cleanUrl = (url || '').trim()
    .replace(/^%20+/, '') // strip leading encoded spaces
    .replace(/^[\u0000-\u001F\u007F\u00A0\u200B\u200C\u200D]+/, ''); // invisible/nbspace chars
  if (!/^https?:\/\//i.test(cleanUrl)) {
    throw new Error(`Invalid image URL (unsupported scheme): ${cleanUrl.slice(0, 48)}...`);
  }
  const res = await fetch(cleanUrl);
  if (!res.ok) throw new Error(`Failed to fetch image URL (${res.status})`);
  const mimeHeader = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].toLowerCase().replace('image/jpg', 'image/jpeg');
  const ab = await res.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let binary = '';
  // Build binary string in chunks to avoid call stack limits for large files
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
  const langRule = language === 'ar'
    ? 'CRITICAL: Respond ONLY in Arabic. Do NOT use English.'
    : 'CRITICAL: Respond ONLY in English. Do NOT use Arabic.';

  const ptNick = (pt.nickname || '').toString().trim();
  const ptTone = (pt.tone || '').toString().trim();
  const ptStyle = (pt.style || '').toString().trim();

  const PT_ENFORCEMENT = `
CRITICAL PERSONAL TOUCH ENFORCEMENT ===
- Nickname: ${ptNick ? `Use the user's nickname "${ptNick}" frequently and naturally in your responses.` : 'No nickname provided.'}
- Tone: ${ptTone ? `Maintain a ${ptTone} tone consistently.` : 'Default to neutral tone.'}
- Style: ${ptStyle ? `Shape your structure as ${ptStyle}.` : 'Keep answers concise and clear.'}
`;

  const VISION_CAPS = `ENHANCED VISION CAPABILITIES (Documents + General Photos + Screenshots) ===
- You can analyze images and describe their content in detail
- You can identify and describe people, their appearance, activities, and clothing (do not identify real persons by name)
- You can perform robust OCR on common document types (IDs, passports, licenses, visas, permits, certificates, contracts, forms, invoices, receipts, bank statements, utility bills, tax forms, payslips, tickets, boarding passes, professional IDs, business cards)
- You can read printed and handwritten text and street/indoor signs (as quality allows)
- You can detect tables and extract them (rows/columns) and key–value pairs
- You can extract structured fields (name, number, DOB, issuer, …) from documents
- You can detect and parse MRZ on passports/IDs and read barcodes/QR codes when present
- You can normalize dates to ISO-8601 and validate logical date consistency
- You can determine expiry status: expired, near_expiry (within 90 days), or valid
- You should return results in a clear JSON schema with confidence per field when possible
- You can compute totals/taxes from invoices/receipts when present
- You can analyze screenshots for study or tech support; answer Q&A from images directly
- You can interpret diagrams/charts/plots and extract numeric summaries
- You can compare multiple images and explain differences; state uncertainty when needed
- Always perform OCR on visible text; be precise and grounded in the image content`;

  const TABLE_ENFORCEMENT = `
CRITICAL TABLE MODE ENFORCEMENT ===
- If the user requests a "table view", "tabular", "columns/rows", or similar formatting:
  1) Populate the JSON 'tables' field with 'headers' and 'rows' reflecting extracted fields.
  2) In PART 2 (SUMMARY), render a compact Markdown table mirroring the main extracted fields.
- Prefer canonical field names (e.g., Name, Document No., Nationality, DOB, Expiry, Issuer, etc.).
- Keep columns aligned; avoid overly wide texts; truncate where necessary.
`;

  return `${langRule}

${PT_ENFORCEMENT}

You are WAKTI Vision — a specialized image understanding service. Date: ${currentDate}
Your job: analyze user-uploaded images from Chat mode (not Image Mode), perform OCR/extraction/reasoning, and answer directly.

${VISION_CAPS}

${TABLE_ENFORCEMENT}

OUTPUT REQUIREMENTS:
- Always return BOTH parts in this order:
  PART 1 — JSON ONLY: Output a single JSON object with no surrounding quotes or code fences. Do not add backticks. Keep it compact.
  PART 2 — SUMMARY: After the JSON, output a single short summary (1–3 sentences) in plain text.

JSON SCHEMA GUIDANCE (use fields that apply):
- type: "person_photo" | "screenshot" | "document" | "general_photo"
- people: [ { gender_appearance, age_range, clothing, pose, accessories, emotions, actions, context, confidence } ]
- objects: [ { name, attributes?, confidence } ]
- scene: { location_guess?, lighting?, time_of_day?, context_notes? }
- ocr: { text?: string, language?: string, lines?: string[] }
- tables: [ { headers: string[], rows: string[][] } ]
- key_values: [ { key: string, value: string, confidence: number } ]
- mrz: { raw?: string, parsed?: any }
- barcodes: [ { type: string, value: string } ]
- dates_normalized: [ { field: string, iso8601: string, confidence: number } ]
- expiry_status: "expired" | "near_expiry" | "valid" | null
- answers: [ { question: string, answer: string, confidence: number } ]
- confidence_overall: number

PEOPLE DESCRIPTION POLICY:
- Freely describe appearance, clothing, activities, and emotions.
- Do NOT identify real persons by name or claim identity.

Personal Touch:
- Nickname: ${ptNick || 'N/A'}
- Tone: ${ptTone || 'neutral'}
- Style: ${ptStyle || 'short answers'}
- Keep responses aligned with user language (${language}).`;
}

function convertToOpenAIMessages(systemPrompt: string, prompt: string, language: string, images: { mimeType: string; base64?: string; url?: string }[]) {
  const content: any[] = [];
  content.push({ type: 'text', text: `${language === 'ar' ? 'يرجى الرد باللغة العربية فقط.' : 'Please respond in English only.'} ${prompt || ''}`.trim() });
  for (const img of images) {
    if (img.url) {
      content.push({ type: 'image_url', image_url: { url: img.url } });
    } else if (img.base64) {
      const dataUrl = `data:${img.mimeType};base64,${img.base64}`;
      content.push({ type: 'image_url', image_url: { url: dataUrl } });
    }
  }
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content }
  ];
}

function convertToClaude(systemPrompt: string, prompt: string, language: string, images: { mimeType: string; base64?: string; url?: string }[]) {
  const content: any[] = [];
  content.push({ type: 'text', text: `${language === 'ar' ? 'يرجى الرد باللغة العربية فقط.' : 'Please respond in English only.'} ${prompt || ''}`.trim() });
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
  // JSON-first emitter state
  let jsonEmitted = false;
  let sawJsonStart = false;
  let inString = false;
  let escape = false;
  let depth = 0;
  let jsonBuf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') { controller.enqueue(encoder.encode('data: [DONE]\n\n')); break; }
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          const token = parsed.delta.text as string;
          // Feed token into JSON-first emitter
          if (!jsonEmitted) {
            let i = 0;
            while (i < token.length) {
              const ch = token[i++];
              if (!sawJsonStart) {
                if (ch === '{') { sawJsonStart = true; depth = 1; jsonBuf = '{'; continue; }
                // ignore preamble before JSON
                continue;
              }
              jsonBuf += ch;
              if (inString) {
                if (escape) { escape = false; continue; }
                if (ch === '\\') { escape = true; continue; }
                if (ch === '"') { inString = false; continue; }
              } else {
                if (ch === '"') { inString = true; continue; }
                if (ch === '{') { depth++; continue; }
                if (ch === '}') { depth--; if (depth === 0) {
                  // JSON object complete
                  try {
                    const obj = JSON.parse(jsonBuf);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ json: obj })}\n\n`));
                    jsonEmitted = true;
                    // Any remaining part of token goes as summary
                    const rest = token.slice(i);
                    if (rest) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: rest, content: rest })}\n\n`));
                  } catch (_) {
                    // If parse fails, fall back to streaming as text
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: jsonBuf, content: jsonBuf })}\n\n`));
                  }
                  break;
                }}
              }
            }
            if (!jsonEmitted && sawJsonStart) {
              // wait for more chunks
            }
            if (!sawJsonStart) {
              // No JSON yet, ignore preamble per contract
            }
          } else {
            // JSON already emitted → stream summary tokens
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token, content: token })}\n\n`));
          }
        }
        if (parsed.type === 'message_stop') {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          break;
        }
      } catch {}
    }
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Basic JWT requirement
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await req.json();
        const {
          requestId = crypto.randomUUID(),
          prompt = '',
          language = 'en',
          personalTouch = null,
          provider = 'claude', // default to Claude for vision
          model,
          images = [],
          options = { ocr: true, max_tokens: 1200 }
        } = body || {};

        // Emit meta
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata: { requestId, provider, imagesCount: Array.isArray(images) ? images.length : 0 } })}\n\n`));
        } catch {}

        // Validate images
        if (!Array.isArray(images) || images.length === 0) {
          throw new Error('No images provided');
        }
        if (images.length > 4) {
          throw new Error('Too many images (max 4)');
        }

        // Normalize images
        const norm = images.map((f: any) => normalizeImage({ mimeType: f?.mimeType || f?.type, dataBase64: f?.data || f?.content, url: f?.url }))
                           .filter(Boolean) as { mimeType: string; base64?: string; url?: string }[];
        if (norm.length === 0) throw new Error('No valid images');

        // Convert any URL images to base64 for Anthropic compatibility
        const MAX_BYTES = 8 * 1024 * 1024; // 8MB
        for (const n of norm) {
          if (n.url) {
            const originalMime = n.mimeType; // preserve the original mime from the frontend
            const { base64, mimeType, byteLength } = await fetchImageAsBase64(n.url);
            if (byteLength > MAX_BYTES) {
              throw new Error('Image too large (max 8MB). Please upload a smaller image.');
            }
            n.base64 = base64;
            // Prefer the original mimeType coming from the client; fallback to fetched header
            n.mimeType = originalMime || mimeType;
            delete (n as any).url;
          }
        }

        // Per-image size cap: validate base64 sizes as well (if images came in as base64)
        for (const n of norm) {
          if (n.base64) {
            const approxBytes = Math.floor((n.base64.length * 3) / 4);
            if (approxBytes > MAX_BYTES) {
              throw new Error('Image too large (max 8MB). Please upload a smaller image.');
            }
          }
        }

        const now = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Qatar' });
        const systemPrompt = buildSystemPrompt(language, now, personalTouch);

        // Provider selection
        let streamReader: ReadableStreamDefaultReader | null = null;
        if (provider === 'openai') {
          if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
          const messages = convertToOpenAIMessages(systemPrompt, prompt, language, norm);
          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: model || 'gpt-4o', messages, temperature: 0.7, max_tokens: options?.max_tokens || 1200, stream: true })
          });
          if (!openaiResponse.ok) throw new Error(`OpenAI failed: ${openaiResponse.status}`);
          streamReader = openaiResponse.body?.getReader() || null;

          // Stream OpenAI with JSON-first emitter
          const decoder2 = new TextDecoder();
          let buf2 = '';
          let jsonEmitted2 = false;
          let sawJsonStart2 = false; let inString2 = false; let escape2 = false; let depth2 = 0; let jsonBuf2 = '';
          while (true) {
            const { done, value } = await streamReader.read();
            if (done) break;
            buf2 += decoder2.decode(value, { stream: true });
            const lines = buf2.split('\n');
            buf2 = lines.pop() || '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6);
              if (data === '[DONE]') { controller.enqueue(encoder.encode('data: [DONE]\n\n')); break; }
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content as string | undefined;
                if (content) {
                  if (!jsonEmitted2) {
                    let i = 0;
                    while (i < content.length) {
                      const ch = content[i++];
                      if (!sawJsonStart2) {
                        if (ch === '{') { sawJsonStart2 = true; depth2 = 1; jsonBuf2 = '{'; continue; }
                        continue;
                      }
                      jsonBuf2 += ch;
                      if (inString2) {
                        if (escape2) { escape2 = false; continue; }
                        if (ch === '\\') { escape2 = true; continue; }
                        if (ch === '"') { inString2 = false; continue; }
                      } else {
                        if (ch === '"') { inString2 = true; continue; }
                        if (ch === '{') { depth2++; continue; }
                        if (ch === '}') { depth2--; if (depth2 === 0) {
                          try {
                            const obj = JSON.parse(jsonBuf2);
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ json: obj })}\n\n`));
                            jsonEmitted2 = true;
                            const rest = content.slice(i);
                            if (rest) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: rest, content: rest })}\n\n`));
                          } catch (_) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: jsonBuf2, content: jsonBuf2 })}\n\n`));
                          }
                          break;
                        }}
                      }
                    }
                  } else {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: content, content })}\n\n`));
                  }
                }
              } catch {}
            }
          }
        } else {
          if (!ANTHROPIC_API_KEY) throw new Error('Claude API key not configured');
          const { system, messages } = convertToClaude(systemPrompt, prompt, language, norm);
          const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: model || 'claude-3-5-sonnet-20241022', system, messages, max_tokens: options?.max_tokens || 1200, stream: true })
          });
          if (!claudeResponse.ok) {
            const err = await claudeResponse.text();
            throw new Error(`Claude failed: ${claudeResponse.status} ${err}`);
          }
          streamReader = claudeResponse.body?.getReader() || null;
          if (!streamReader) throw new Error('No stream from provider');
          await streamClaudeResponse(streamReader, controller, encoder);
        }

        controller.close();
      } catch (error) {
        console.error('🔥 VISION STREAM ERROR:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Vision service temporarily unavailable', details: (error as Error).message })}\n\n`));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
  });
});
