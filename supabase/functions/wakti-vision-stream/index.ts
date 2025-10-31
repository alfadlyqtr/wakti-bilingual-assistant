import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// Allowed origins (mirror brain stream behavior + dev fallbacks)
const allowedOrigins = [
  'https://wakti.qa',
  'https://www.wakti.qa',
  'http://localhost',
  'http://127.0.0.1'
];

const getCorsHeaders = (origin: string | null) => {
  const isAllowed = origin && (
    allowedOrigins.some((allowed) => origin.startsWith(allowed)) || 
    origin.includes('lovable.dev') || 
    origin.includes('lovable.app') || 
    origin.includes('lovableproject.com')
  );
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control, x-request-id, x-mobile-request',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
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
- Always perform OCR on visible text; be precise and grounded in the image content
- OCR LANGUAGE POLICY: Detect language automatically; if Arabic script is present, preserve Arabic text and numerals faithfully. Set ocr.language accordingly. Normalize dates to ISO-8601.`;

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

OUTPUT REQUIREMENTS (CONVERSATIONAL FIRST):
- Open with a warm greeting using the user's nickname if available. Keep the brand tone and style.
- Part 1: Short friendly summary in ${language}.
- Part 2: 3–5 concise bullets for key insights, validations, and follow_ups.
- Documents: After summary and bullets, include a compact Markdown table of the main fields (only when user asks for OCR/"extract text"/"table" OR when the image is clearly a document like IDs, invoices, receipts, tickets, forms, certificates). No JSON by default.
- Reasoning tasks (math/puzzles): Short friendly intro, then clear numbered steps, and end with a bold line: "Final Answer: ...".
- Avoid code fences unless rendering a Markdown table. Keep it brief and helpful.

JSON SCHEMA GUIDANCE (use fields that apply):
- type: "person_photo" | "screenshot" | "document" | "general_photo"
- doc_subtype?: string  // e.g., "qatar_id", "passport", "invoice", "receipt", "boarding_pass", "chart", "table_screenshot"
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
 - insights?: string[]
 - validations?: [ { field?: string, issue: string, severity?: "info"|"warning"|"error" } ]
 - follow_ups?: string[]
 - actions?: [ { type: string, label: string, payload?: any } ]

NORMALIZED FIELDS (if applicable):
- normalized?: {
    id?: { name?: string, nationality?: string, document_no?: string, issuer?: string, issue_date?: string, expiry_date?: string },
    invoice?: { vendor?: string, address?: string, date?: string, currency?: string, subtotal?: string|number, tax?: string|number, total?: string|number },
    ticket?: { passenger?: string, number?: string, origin?: string, destination?: string, gate_seat?: string, departure_time?: string, arrival_time?: string }
  }

DOC-TYPE AUTO-DETECTION AND NORMALIZATION:
- Detect the document/photo type automatically and populate fields accordingly.
- For IDs/permits/passports: fill key_values with Name, Nationality, Document No., Issuer, Issue Date, Expiry Date; extract MRZ to mrz.parsed; detect expiry_status; include barcodes.
- For receipts/invoices/bills: vendor, address, date, currency, subtotal, tax, total; and tables[0] for line items with headers ["Item","Qty","Unit Price","Amount"].
- For tickets/boarding passes: passenger, flight/train number, origin, destination, gate/seat, times, barcode.
- For certificates/contracts/forms: parties, dates, identifiers, signature presence.
- For charts/plots/tables screenshots: infer series/labels, summarize key trends; tables[0] should represent the main visible table when possible.
- For general photos: people/objects/scene with grounded details; avoid identity claims.

PERSONAL TOUCH + LANGUAGE POLICY:
- Always greet by nickname when provided, and maintain the selected tone and style.
- When language is 'ar', write the full response in Arabic. When language is 'en', write it in English. Table headers follow UI language.

PEOPLE DESCRIPTION POLICY:
- Freely describe appearance, clothing, activities, and emotions.
- Do NOT identify real persons by name or claim identity.
- Disclaimer usage: Only when the image is a person/photo, append a single friendly line at the very end: "I can’t identify real people by name, but here’s a description." Do not show this disclaimer for documents, puzzles, charts, or non-person scenes.

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

// Extract the first complete JSON object from a text stream and any remaining summary text
function extractJsonAndSummary(text: string): { json: any | null; summary: string } {
  let depth = 0; let inStr = false; let esc = false; let started = false; let buf = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!started) {
      if (ch === '{') { started = true; depth = 1; buf = '{'; }
      continue;
    }
    buf += ch;
    if (inStr) {
      if (esc) { esc = false; }
      else if (ch === '\\') { esc = true; }
      else if (ch === '"') { inStr = false; }
    } else {
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) {
        try {
          const obj = JSON.parse(buf);
          const rest = text.slice(i + 1).trim();
          return { json: obj, summary: rest };
        } catch {
          return { json: null, summary: text };
        }
      } }
    }
  }
  return { json: null, summary: text };
}

async function streamClaudeResponse(reader: ReadableStreamDefaultReader, controller: ReadableStreamDefaultController, encoder: TextEncoder) {
  const decoder = new TextDecoder();
  let buffer = '';
  let doneSent = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) { break; }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') { controller.enqueue(encoder.encode('data: [DONE]\n\n')); doneSent = true; break; }
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
        // Robust body parsing to avoid EOF errors from partially closed connections
        let bodyRaw = '';
        try {
          bodyRaw = await req.text();
        } catch (e) {
          console.error('VISION: failed to read request body text', e);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Bad Request: unable to read body' })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          return controller.close();
        }
        let body: any = {};
        try {
          body = bodyRaw ? JSON.parse(bodyRaw) : {};
        } catch (e) {
          console.error('VISION: invalid JSON body', (e as Error).message);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Bad Request: invalid JSON' })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          return controller.close();
        }
        const {
          requestId = crypto.randomUUID(),
          prompt = '',
          language = 'en',
          personalTouch = null,
          provider = 'openai', // default to OpenAI for isolation
          model,
          images = [],
          options = { ocr: true, max_tokens: 1200 },
          stream = false
        } = body || {};

        // Emit meta
        try {
          const meta = { requestId, provider, model: model || null, imagesCount: Array.isArray(images) ? images.length : 0 };
          console.log('VISION: meta', meta);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata: meta })}\n\n`));
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

        // Non-streaming JSON mode
        if (!stream) {
          try {
            if (!ANTHROPIC_API_KEY) throw new Error('Claude API key not configured');
            const { system, messages } = convertToClaude(systemPrompt, prompt, language, norm);
            const m = model || 'claude-3-5-sonnet-20241022';
            const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ model: m, system, messages, temperature: 0.2, max_tokens: options?.max_tokens || 2000, stream: false })
            });
            if (!claudeResp.ok) {
              const errTxt = await claudeResp.text();
              const err = { error: 'Claude failed', status: claudeResp.status, details: errTxt.slice(0, 300) };
              return controller.enqueue(encoder.encode(`data: ${JSON.stringify(err)}\n\n`)), controller.close();
            }
            const data = await claudeResp.json();
            const text = Array.isArray(data?.content)
              ? (data.content.map((c: any) => c?.text || '').join(''))
              : (data?.content?.[0]?.text || '');
            const { json, summary } = extractJsonAndSummary(text || '');
            const payload = { json, summary, metadata: { model: m } };
            // Return a single JSON payload (no SSE) by closing the stream with one data event
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            return controller.close();
          } catch (e) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: (e as Error).message })}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            return controller.close();
          }
        }

        // Provider selection with Claude → OpenAI fallback
        let streamReader: ReadableStreamDefaultReader | null = null;

        const tryOpenAI = async () => {
          if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
          const messages = convertToOpenAIMessages(systemPrompt, prompt, language, norm);
          const openaiModels = [
            model || 'gpt-4o-2024-08-06',
            'gpt-4o',
            'gpt-4o-mini'
          ];
          let lastErr: any = null;
          for (const m of openaiModels) {
            console.log(`VISION: Trying OpenAI model=${m} req=${requestId}`);
            const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
              body: JSON.stringify({ model: m, messages, temperature: 0.2, max_tokens: options?.max_tokens || 2000, stream: true })
            });
            if (!openaiResponse.ok) {
              const msg = await openaiResponse.text();
              console.warn(`VISION: OpenAI model=${m} failed status=${openaiResponse.status} req=${requestId} body=${msg.slice(0,180)}`);
              lastErr = new Error(`OpenAI failed: ${openaiResponse.status} ${msg}`);
              // Try next model on 404/400 model errors
              if (openaiResponse.status === 404 || openaiResponse.status === 400) continue;
              // On overload, try next; otherwise break
              if (openaiResponse.status === 429 || openaiResponse.status === 529) continue;
              continue;
            }
            console.log(`VISION: OpenAI model=${m} streaming req=${requestId}`);
            streamReader = openaiResponse.body?.getReader() || null;
            // Stream OpenAI conversational-first: emit tokens immediately
            const decoder2 = new TextDecoder();
            let buf2 = '';
            let doneSent2 = false;
            while (true) {
              const { done, value } = await streamReader.read();
              if (done) { break; }
              buf2 += decoder2.decode(value, { stream: true });
              const lines = buf2.split('\n');
              buf2 = lines.pop() || '';
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6);
                if (data === '[DONE]') { controller.enqueue(encoder.encode('data: [DONE]\n\n')); doneSent2 = true; break; }
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content as string | undefined;
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: content, content })}\n\n`));
                  }
                } catch {}
              }
            }
            if (!doneSent2) { try { controller.enqueue(encoder.encode('data: [DONE]\n\n')); } catch {} }
            return; // success
          }
          throw lastErr || new Error('OpenAI failed');
        };

        const tryClaude = async () => {
          if (!ANTHROPIC_API_KEY) throw new Error('Claude API key not configured');
          const { system, messages } = convertToClaude(systemPrompt, prompt, language, norm);
          const claudeModels = [
            model || 'claude-sonnet-4-5-20250929',
            'claude-3-5-sonnet-latest',
            'claude-3-5-sonnet-20241022',
            'claude-3-5-sonnet-20240620',
            'claude-3-haiku-20240307'
          ];
          let lastErr: any = null;
          for (const m of claudeModels) {
            console.log(`VISION: Trying Claude model=${m} req=${requestId}`);
            const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
              body: JSON.stringify({ model: m, system, messages, temperature: 0.2, max_tokens: options?.max_tokens || 2000, stream: true })
            });
            if (!claudeResponse.ok) {
              const errTxt = await claudeResponse.text();
              console.warn(`VISION: Claude model=${m} failed status=${claudeResponse.status} req=${requestId} body=${errTxt.slice(0,180)}`);
              lastErr = new Error(`Claude failed: ${claudeResponse.status} ${errTxt}`);
              // Try next on 404 (model not found) or overload codes
              if (claudeResponse.status === 404 || claudeResponse.status === 429 || claudeResponse.status === 529) continue;
              continue;
            }
            console.log(`VISION: Claude model=${m} streaming req=${requestId}`);
            streamReader = claudeResponse.body?.getReader() || null;
            if (!streamReader) { lastErr = new Error('No stream from provider'); continue; }
            await streamClaudeResponse(streamReader, controller, encoder);
            return; // success
          }
          throw lastErr || new Error('Claude failed');
        };

        try {
          // Temporarily route OpenAI first (A/B isolation), then Claude
          await tryOpenAI();
        } catch (firstErr) {
          console.warn('VISION: OpenAI-first attempt failed, trying Claude...', firstErr);
          try {
            await tryClaude();
          } catch (provErr) {
            const msg = String((provErr as Error)?.message || provErr || '').toLowerCase();
            const shouldFallback = msg.includes('not_found') || msg.includes('404') || msg.includes('overloaded') || msg.includes('529') || msg.includes('model') || msg.includes('claude');
            // If Claude fails after OpenAI-first, give one more OpenAI try; else throw
            if (shouldFallback) {
              console.warn('⚠️ Vision: Claude failed after OpenAI-first, retrying OpenAI...', provErr);
              await tryOpenAI();
            } else {
              throw provErr;
            }
          }
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
