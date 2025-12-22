import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================================
// WAKTI VISION STREAM - Isolated Provider Architecture
// Primary: Gemini 1.5 Flash → Fallback 1: GPT-4o → Fallback 2: Claude 3.5 Sonnet
// ============================================================================

// --- 1. THE NEW FORENSIC BRAIN (PREPENDED TO ALL PROMPTS) ---
const FORENSIC_PROMPT = `
### FORENSIC INTELLIGENCE PROTOCOL (STRICT)
Role: You are Wakti Vision, an elite forensic image analyst.
Objective: DEDUCE context, location, and status. Do not just describe pixels.

### 🔍 DEDUCTION RULES:
1. **MIRROR CHECK:** If image is a selfie (phone visible), assume text is FLIPPED. Mentally reverse it (e.g. "HASOM" -> "MOZAH").
2. **GLOBAL FIRST (NO REGIONAL ASSUMPTIONS):** Do NOT assume Qatar or GCC. First identify likely Country and City using evidence: license plates, currency, language, road signs, time zone clues, plugs, architecture, landmarks.
3. **LOGO ➜ HUB MAPPING:** If you see a logo, map it to its primary hub/site when reasonable.
   Examples: Boeing ➜ Seattle, Samsung ➜ Seoul, Siemens ➜ Munich.
4. **CONTEXT CLUES:** Analyze uniforms, PPE, badges, tools, and environment to infer role and industry (construction, refinery, aviation, healthcare, education, etc.).
5. **EXPIRY MATH (CRITICAL):** When any document shows dates (issue/expiry/DOB/valid-until), compare them against the provided "Date:" in the prompt.
   - If expiry/valid-until is in the past, your verdict MUST start with: 🔴 EXPIRED
   - If it is not in the past, your verdict MUST include: 🟢 VALID
   - If no expiry date is visible, say "Status: unknown" (do not guess).
6. **ENVIRONMENTAL TRIANGULATION (THE UNSEEN):** Combine subtle clues (watch style, ring, badge clip, uniform fabric, lighting temperature, signage font, English spelling style like "Physiotherapy" vs "Physical Therapy") to infer socio-economic and regional context.
7. **SEARCH-ONCE-BUT-SURE (GROUNDING):** You have access to Google Search grounding. Before searching, build one high-resolution query using ALL clues (name, organization, role, location hints, logo, uniform, watch, signage language).
8. **TOTAL VISUAL SYNTHESIS (VISUAL FINGERPRINT):** Before any search, aggregate ALL visual data points into a Fingerprint:
   Data Points: [Name] + [Company/Clinic Logo] + [Uniform Color/Material] + [Watch Model/Style] + [Signage Language/Font] + [Equipment Brand] + [Background Lighting].
   Then create a "WOW" High-Resolution Query that includes multiple fingerprint tokens.
9. **LEGACY & IMPACT (THE MIC DROP):** Once an entity (person/brand/building) is identified, you MUST perform a targeted search for their achievements, historical significance, or legacy.
    - Constraint: Do NOT report just a job title. Report their legend status / impact role.
    - Examples (style only): “Pioneer of early 1990s sports medicine in the region” / “Central figure in a landmark tournament run during the 1980s”.
10. **CHRONOLOGICAL TRIANGULATION (DECADE):** Use visual cues to estimate the decade/era.
    Cues: photo quality/film grain, hairstyle/fashion, and brand/logo evolution (e.g., vintage Umbro/Adidas logo eras). Mention the estimated era in the evidence.
11. **GROUNDING IS NOT OPTIONAL (VISION ➜ SEARCH ➜ ANSWER):**
    - If you detect ANY of the following, you MUST use Google Search grounding before finalizing your verdict:
      a) a person's full/partial name, b) a clinic/company/brand name, c) a distinctive logo, d) a venue/building name.
    - The goal is not "who" only. The goal is: who + why they matter + when (era).
    - If grounding is unavailable or returns weak/conflicting results, do NOT pretend. Output a conservative verdict and ask for ONE missing clue (e.g., city, spelling of the name, or a clearer logo crop).
 12. **LANDMARK IDENTIFICATION (FORCED WHEN DISTINCTIVE ARCHITECTURE EXISTS):**
    - If you see a distinctive structure, skyline, monument, or unique interior, you MUST run a landmark-focused query before naming the location.
    - Describe the landmark using architecture tokens: shape (mushroom/cylinder/arch), material (concrete/steel/glass), lighting (amber/LED), context (park/stadium/metro), and any visible language.
    - If the landmark is not confidently identifiable, list 2–3 plausible cities/countries and what single clue would disambiguate.

### 📝 OUTPUT POLICY (CRITICAL):
- You MUST follow a strict structure internally, but you MUST NOT print the internal labels "📍 THE VERDICT", "THE VERDICT", "THE EVIDENCE", or "PRO TIP".
- THE VERDICT FIRST (INTERNAL, NON-NEGOTIABLE): Your very first line must function as the verdict: **Bold identification + legacy title**.
  - Do NOT show the label. Start directly with the verdict content.
  - The first 5 words should already imply who they are + why they matter.
- Then provide 3–6 bullets of evidence.
  - Evidence must include: location inference AND estimated decade/era.
  - Evidence must include: legacy/impact proof points (from grounding).
  - Forbidden: A shallow role-only verdict like "X is a physiotherapist" with no grounded legacy/era.
  - If you cannot ground legacy/era, downgrade confidence and ask ONE follow-up.
- If the image is document-like, include a compact Markdown table of extracted fields.
`;

function getTodayISO(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value || '1970';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

// Allowed origins
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

console.log("WAKTI VISION STREAM: Ready (Isolated Provider Architecture)");

// ============================================================================
// --- 2. IMAGE HELPERS ---
// ============================================================================

interface NormalizedImage {
  mimeType: string;
  base64: string;
}

function normalizeImage(input: { mimeType?: string; dataBase64?: string; url?: string; data?: string; content?: string }): NormalizedImage | null {
  const mime = (input.mimeType || '').toLowerCase().replace('image/jpg', 'image/jpeg');
  const data = input.dataBase64 || input.data || input.content || '';
  if (!data) return null;
  
  const dataUriMatch = data.match(/^data:(.*?);base64,(.*)$/);
  if (dataUriMatch) {
    const m = (dataUriMatch[1] || '').toLowerCase().replace('image/jpg', 'image/jpeg');
    return { mimeType: m || 'image/jpeg', base64: dataUriMatch[2] };
  }
  return { mimeType: mime || 'image/jpeg', base64: data };
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string; byteLength: number }> {
  const cleanUrl = (url || '').trim().replace(/^%20+/, '');
  if (!/^https?:\/\//i.test(cleanUrl)) {
    throw new Error(`Invalid image URL: ${cleanUrl.slice(0, 48)}...`);
  }
  const res = await fetch(cleanUrl);
  if (!res.ok) throw new Error(`Failed to fetch image URL (${res.status})`);
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

// ============================================================================
// --- 3. SYSTEM PROMPT BUILDER (Existing logic + Forensic prepend) ---
// ============================================================================

interface PersonalTouch {
  nickname?: string;
  tone?: string;
  style?: string;
}

function buildSystemPrompt(
  language: string,
  currentDate: string,
  todayISO: string,
  personalTouch: PersonalTouch | null,
  chatSubmode: string = 'chat'
): string {
  const pt = personalTouch || {};
  const langRule = language === 'ar'
    ? 'CRITICAL: Respond ONLY in Arabic. Do NOT use English.'
    : 'CRITICAL: Respond ONLY in English. Do NOT use Arabic.';

  const ptNick = (pt.nickname || '').toString().trim();
  const ptTone = (pt.tone || '').toString().trim();
  const ptStyle = (pt.style || '').toString().trim();

  const PT_ENFORCEMENT = `
CRITICAL PERSONAL TOUCH ENFORCEMENT ===
- Nickname: ${ptNick ? `Use the user's nickname "${ptNick}" frequently.` : 'No nickname provided.'}
- Tone: ${ptTone ? `Maintain a ${ptTone} tone consistently.` : 'Default to neutral tone.'}
- Style: ${ptStyle ? `Shape your structure as ${ptStyle}.` : 'Keep answers concise and clear.'}
`;

  const GREETING_RULE = `
GREETING (MANDATORY):
- Do NOT place the greeting before the verdict line.
- The greeting may appear immediately AFTER the verdict line (same paragraph), using the user's nickname if provided.
- If tone is Formal: use "Greetings <nickname>".
- If tone is Encouraging: use "Hello <nickname>!".
- Otherwise: use a short friendly greeting.
`;

  const VISION_CAPS = `ENHANCED VISION CAPABILITIES ===
- Analyze images and describe their content in detail
- Perform robust OCR on documents (IDs, passports, licenses, invoices, receipts, etc.)
- Read printed and handwritten text
- Detect tables and extract rows/columns
- Extract structured fields from documents
- Detect and parse MRZ on passports/IDs
- Normalize dates to ISO-8601
- Determine expiry status: expired, near_expiry (within 90 days), or valid`;

  const TABLE_ENFORCEMENT = `
CRITICAL TABLE MODE ENFORCEMENT ===
- If the user requests a "table view", "tabular", or similar:
  1) Render a compact Markdown table of the main extracted fields.
- Prefer canonical field names (Name, Document No., Nationality, DOB, Expiry, Issuer, etc.).
`;

  const STUDY_MODE = chatSubmode === 'study' ? `
📚 STUDY MODE (TUTOR STYLE) - CRITICAL
Act as a friendly, patient tutor who helps the user learn from this image.
1. ANSWER FIRST: Start with the clear, direct answer (1-2 sentences).
2. EXPLAIN STEP-BY-STEP: Break down the reasoning in simple, numbered steps.
3. USE SIMPLE LANGUAGE: Avoid jargon.
4. ADD EXAMPLES: When helpful, include a real-world example.
` : `STRICT OUTPUT RULES (DO NOT SHOW INTERNAL LABELS):
- Output style (Option 1):
  1) First line is the verdict content: **Bold identification + legacy title** (do NOT print any verdict label).
     - The first 5 words should already imply who they are + why they matter.
  2) One short personalized greeting line (nickname if available, match tone).
  2) 3–6 bullets of the key evidence/insights.
  3) If the image is clearly a document/ID/permit/receipt/invoice, ALWAYS include a compact Markdown table of extracted fields.
- IMPORTANT: Do NOT print the labels "THE VERDICT", "THE EVIDENCE", or "PRO TIP". Use that structure silently.
- EXPIRY MATH: Use TODAY_ISO to compute VALID/EXPIRED.
- LOCATION: If you detect an organization/place name (e.g., hospital/clinic/company), use Google Search grounding to infer likely city/country. If ambiguous, mention 1–3 candidates and state what evidence would resolve it.

SYNTHESIS MODE (LEGACY + ERA):
- Once you identify an entity, you MUST ground their legacy/impact (not just job title).
- Evidence bullets MUST include the estimated decade/era and what cues support it (photo quality, fashion, brand/logo era).

GROUNDING (SEARCH-ONCE-BUT-SURE):
- Before searching, build a Visual Fingerprint from all clues.
- Perform one high-resolution Google Search query that includes multiple fingerprint tokens.
- Verify identity/location using official domains when possible (staff directory, clinic website, LinkedIn company page, government/licensing directory).
- If results conflict, do NOT guess—state the top candidates and what evidence contradicts.

DOCUMENT TABLE (WHEN DOCUMENT-LIKE):
- Include a row for Status: 🔴 EXPIRED / 🟢 VALID / Status: unknown
- Include dates as YYYY-MM-DD when possible
`;

  return `${FORENSIC_PROMPT}

=== ADDITIONAL FORMATTING RULES ===

${langRule}

${PT_ENFORCEMENT}

${GREETING_RULE}

TODAY_ISO: ${todayISO}

You are WAKTI Vision — a specialized image understanding service. Date: ${currentDate}

${VISION_CAPS}

${TABLE_ENFORCEMENT}

${STUDY_MODE}

Personal Touch:
- Nickname: ${ptNick || 'N/A'}
- Tone: ${ptTone || 'neutral'}
- Style: ${ptStyle || 'short answers'}
- Language: ${language}`;
}

// ============================================================================
// --- 4. ISOLATED PROVIDER FUNCTIONS ---
// Each provider uses ONLY its own API key and models. NO cross-contamination.
// ============================================================================

async function tryGemini(
  images: NormalizedImage[],
  systemInstruction: string,
  prompt: string,
  language: string,
  personalTouch: PersonalTouch | null,
  maxTokens: number,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<void> {
  const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!key) throw new Error("No Gemini API Key configured");

  // PRIMARY "ELITE" ENGINE: Gemini 2.0 Flash (exp) via v1beta streaming
  // NOTE: Some Gemini variants reject `system_instruction` (400 schema mismatch).
  // We embed the full system protocol as the first user text part instead.
  const GEMINI_MODEL = "gemini-2.0-flash-exp";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${key}`;

  const langPrefix = language === 'ar'
    ? 'يرجى الرد باللغة العربية فقط. لا تستخدم الإنجليزية.'
    : 'Please respond in English only. Do not use Arabic.';

  const languageCode = language === 'ar' ? 'ar-EG' : 'en-US';

  const pt = personalTouch || {};
  const ptNick = (pt.nickname || '').toString().trim();
  const ptTone = (pt.tone || '').toString().trim().toLowerCase();
  const nameForGreeting = ptNick || (language === 'ar' ? 'صديقي' : 'friend');
  const greetingLine = ptTone === 'formal'
    ? (language === 'ar' ? `تحياتي ${nameForGreeting}.` : `Greetings ${nameForGreeting}.`)
    : ptTone === 'encouraging'
      ? (language === 'ar' ? `مرحباً ${nameForGreeting}!` : `Hello ${nameForGreeting}!`)
      : (language === 'ar' ? `أهلاً ${nameForGreeting}.` : `Hi ${nameForGreeting}.`);

  const groundingInstruction = `\n\nGROUNDING (GOOGLE SEARCH) — MANDATORY WHEN AN ENTITY OR LANDMARK IS DETECTED:\n- You have access to Google Search grounding (google_search tool).\n- Vision first, then Search, then Answer. No skipping.\n- Build a Visual Fingerprint from ALL clues (name, logo, uniform, watch, signage language/font, equipment brand, lighting, role keywords, landmark shape/material).\n- Then run EXACTLY ONE deep, high-resolution query that contains multiple fingerprint tokens.\n- Deep search phrases (use these patterns, do NOT use only the name):\n  - Person: "[Name] career history legacy highlights achievements [Location]"\n  - Organization/brand: "[Brand] logo history era evolution timeline"\n  - Venue/building: "[Place] history significance decade era"\n  - Landmark/architecture (when applicable): "[distinctive shape/material/lighting] landmark [city/country candidates]"\n- Use the search result to upgrade: job title ➜ legacy/impact title AND to confirm/adjust the decade/era estimate and location.\n- Do NOT show sources or links in the user output.\n- If results are weak/conflicting: downgrade confidence, state 1–2 candidates, and ask for ONE missing clue.`;

  const integratedProtocol = `SYSTEM PROTOCOL (OBEY RIGIDLY)\n${systemInstruction}\n\nLANGUAGE CODE (HINT): ${languageCode}\n\nGREETING TO USE (DO NOT PLACE BEFORE VERDICT LINE): ${greetingLine}\n\n${langPrefix}${groundingInstruction}\n\nUSER QUESTION:\n${(prompt || '').trim()}`.trim();

  const contents = [{
    role: "user",
    parts: [
      { text: integratedProtocol },
      ...images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } }))
    ]
  }];

  console.log(`VISION: Trying Gemini ${GEMINI_MODEL}`);

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens }
    })
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Gemini Error ${resp.status}: ${errText.slice(0, 200)}`);
  }

  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ providerUsed: GEMINI_MODEL })}\n\n`));

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let emitted = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Handle both formats:
      // - SSE style: "data: {...}"
      // - Raw streamed JSON: "{...}"
      const jsonText = line.startsWith("data:") ? line.slice(5).trim() : line;
      if (!jsonText || jsonText === "[DONE]") continue;

      try {
        const parsed = JSON.parse(jsonText);
        const parts = parsed?.candidates?.[0]?.content?.parts;
        const textFull = Array.isArray(parts)
          ? parts.map((p: { text?: string }) => p?.text || "").join("")
          : (parts?.[0]?.text || "");

        if (!textFull) continue;

        const delta = textFull.startsWith(emitted) ? textFull.slice(emitted.length) : textFull;
        if (!delta) continue;
        emitted = textFull.startsWith(emitted) ? (emitted + delta) : textFull;

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: delta, content: delta })}\n\n`));
      } catch {
        // ignore partial JSON lines
      }
    }
  }
  console.log(`VISION: Gemini streaming complete`);
}

async function tryOpenAI(
  images: NormalizedImage[],
  systemInstruction: string,
  prompt: string,
  language: string,
  maxTokens: number,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<void> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("No OpenAI API Key configured");

  const langPrefix = language === 'ar' ? 'يرجى الرد باللغة العربية فقط.' : 'Please respond in English only.';
  const messages = [
    { role: "system", content: systemInstruction },
    {
      role: "user",
      content: [
        { type: "text", text: `${langPrefix} ${prompt}`.trim() },
        ...images.map(img => ({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` }
        }))
      ]
    }
  ];

  // ISOLATED: OpenAI uses ONLY gpt-4o - no shared model variable
  const OPENAI_MODEL = "gpt-4o";
  console.log(`VISION: Trying OpenAI ${OPENAI_MODEL}`);

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_MODEL, messages, stream: true, max_tokens: maxTokens, temperature: 0.2 })
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`OpenAI Error ${resp.status}: ${errText.slice(0, 200)}`);
  }

  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ providerUsed: OPENAI_MODEL })}\n\n`));

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") break;
      try {
        const parsed = JSON.parse(data);
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: text, content: text })}\n\n`));
        }
      } catch { /* ignore */ }
    }
  }
  console.log(`VISION: OpenAI streaming complete`);
}

async function tryClaude(
  images: NormalizedImage[],
  systemInstruction: string,
  prompt: string,
  language: string,
  maxTokens: number,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<void> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("No Anthropic API Key configured");

  const langPrefix = language === 'ar' ? 'يرجى الرد باللغة العربية فقط.' : 'Please respond in English only.';
  const content: Array<{type: string; text?: string; source?: {type: string; media_type: string; data: string}}> = [
    { type: "text", text: `${langPrefix} ${prompt}`.trim() }
  ];
  for (const img of images) {
    content.push({ type: "image", source: { type: "base64", media_type: img.mimeType, data: img.base64 } });
  }

  // ISOLATED: Claude uses ONLY claude-3-5-sonnet-20241022 - no shared model variable
  const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";
  console.log(`VISION: Trying Claude ${CLAUDE_MODEL}`);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: CLAUDE_MODEL, system: systemInstruction, messages: [{ role: "user", content }], stream: true, max_tokens: maxTokens, temperature: 0.2 })
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Claude Error ${resp.status}: ${errText.slice(0, 200)}`);
  }

  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ providerUsed: CLAUDE_MODEL })}\n\n`));

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") break;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: parsed.delta.text, content: parsed.delta.text })}\n\n`));
        }
        if (parsed.type === 'message_stop') break;
      } catch { /* ignore */ }
    }
  }
  console.log(`VISION: Claude streaming complete`);
}

// ============================================================================
// --- 5. MAIN SERVER ---
// ============================================================================

serve((req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let body: Record<string, unknown> = {};
        try {
          const bodyRaw = await req.text();
          body = bodyRaw ? JSON.parse(bodyRaw) : {};
        } catch (e) {
          console.error('VISION: invalid JSON body', e);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Bad Request: invalid JSON' })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        const {
          requestId = crypto.randomUUID(),
          prompt = '',
          language = 'en',
          personalTouch = null,
          images = [],
          options = { max_tokens: 2000 },
          chatSubmode = 'chat',
          clientTimeZone = ''
        } = body as {
          requestId?: string;
          prompt?: string;
          language?: string;
          personalTouch?: PersonalTouch | null;
          images?: Array<{mimeType?: string; dataBase64?: string; url?: string; data?: string; content?: string}>;
          options?: { max_tokens?: number };
          chatSubmode?: string;
          clientTimeZone?: string;
        };

        const meta = { requestId, imagesCount: Array.isArray(images) ? images.length : 0 };
        console.log('VISION: meta', meta);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata: meta })}\n\n`));
        if (chatSubmode === 'study') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata: { studyMode: true } })}\n\n`));
        }

        if (!Array.isArray(images) || images.length === 0) throw new Error('No images provided');
        if (images.length > 4) throw new Error('Too many images (max 4)');

        const normalizedImages: NormalizedImage[] = [];
        for (const img of images) {
          if (img.url) {
            const { base64, mimeType } = await fetchImageAsBase64(img.url);
            normalizedImages.push({ mimeType, base64 });
          } else {
            const norm = normalizeImage(img);
            if (norm) normalizedImages.push(norm);
          }
        }
        if (normalizedImages.length === 0) throw new Error('No valid images');

        const timeZone = (clientTimeZone || '').toString().trim() || 'UTC';
        const now = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone });
        const todayISO = getTodayISO(timeZone);
        const systemPrompt = buildSystemPrompt(language as string, now, todayISO, personalTouch, chatSubmode as string);
        const maxTokens = options?.max_tokens || 2000;

        // STRICT FALLBACK: Gemini → OpenAI → Claude
        try {
          await tryGemini(normalizedImages, systemPrompt, prompt as string, language as string, personalTouch, maxTokens, controller, encoder);
        } catch (geminiErr) {
          console.error("VISION: Gemini Failed:", (geminiErr as Error).message);
          try {
            await tryOpenAI(normalizedImages, systemPrompt, prompt as string, language as string, maxTokens, controller, encoder);
          } catch (openAiErr) {
            console.error("VISION: OpenAI Failed:", (openAiErr as Error).message);
            try {
              await tryClaude(normalizedImages, systemPrompt, prompt as string, language as string, maxTokens, controller, encoder);
            } catch (claudeErr) {
              console.error("VISION: Claude Failed:", (claudeErr as Error).message);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "All Vision Providers Failed", details: (claudeErr as Error).message })}\n\n`));
            }
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();

      } catch (error) {
        console.error('🔥 VISION STREAM ERROR:', error);
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Vision service error', details: (error as Error).message })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch { /* controller may already be closed */ }
      }
    }
  });

  return new Response(stream, {
    headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
  });
});
