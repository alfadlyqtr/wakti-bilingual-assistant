import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const allowedOrigins = [
  'https://wakti.qa',
  'https://www.wakti.qa',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

const getCorsHeaders = (origin: string | null) => {
  // Allow any localhost/127.0.0.1 port for development
  const isLocalDev = origin && (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  );
  const isAllowed = isLocalDev || (origin && (
    allowedOrigins.some(allowed => origin.startsWith(allowed)) ||
    origin.includes('lovable.dev') ||
    origin.includes('lovable.app') ||
    origin.includes('lovableproject.com')
  ));

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, cache-control, x-request-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const WOLFRAM_APP_ID = Deno.env.get('WOLFRAM_APP_ID') || 'H2PK3P9R7E';
const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type IpGeoLite = {
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
};

const ipGeoCache = new Map<string, { at: number; geo: IpGeoLite | null }>();

function extractClientIp(req: Request): string {
  // Check common CDN/proxy headers in priority order
  const headers = [
    'cf-connecting-ip',    // Cloudflare
    'true-client-ip',      // Akamai, Cloudflare Enterprise
    'x-real-ip',           // Nginx proxy
    'x-client-ip',         // Apache
    'x-forwarded-for',     // Standard proxy header (first IP)
    'fly-client-ip',       // Fly.io
    'x-vercel-forwarded-for', // Vercel
  ];
  for (const h of headers) {
    const val = req.headers.get(h);
    if (val && val.trim()) {
      const ip = val.split(',')[0]?.trim();
      if (ip) return ip;
    }
  }
  return '';
}

function isPublicRoutableIp(ip: string): boolean {
  const v = (ip || '').trim();
  if (!v) return false;
  if (v === '::1' || v === '127.0.0.1') return false;
  if (v.startsWith('10.')) return false;
  if (v.startsWith('192.168.')) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return false;
  if (v.startsWith('fc') || v.startsWith('fd')) return false;
  return true;
}

async function lookupIpGeo(ip: string): Promise<IpGeoLite | null> {
  const key = (ip || '').trim();
  if (!key || !isPublicRoutableIp(key)) return null;

  const cached = ipGeoCache.get(key);
  const now = Date.now();
  if (cached && now - cached.at < 6 * 60 * 60 * 1000) return cached.geo;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 400);
  try {
    const resp = await fetch(`https://ipapi.co/${encodeURIComponent(key)}/json/`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    if (!resp.ok) {
      ipGeoCache.set(key, { at: now, geo: null });
      return null;
    }
    const data = await resp.json().catch(() => null) as Record<string, unknown> | null;
    if (!data || typeof data !== 'object') {
      ipGeoCache.set(key, { at: now, geo: null });
      return null;
    }
    const geo: IpGeoLite = {
      city: typeof data.city === 'string' ? data.city : undefined,
      region: typeof data.region === 'string' ? data.region : undefined,
      country: typeof data.country_name === 'string' ? data.country_name : (typeof data.country === 'string' ? data.country : undefined),
      timezone: typeof data.timezone === 'string' ? data.timezone : undefined,
      latitude: typeof data.latitude === 'number' ? data.latitude : (typeof data.latitude === 'string' ? Number(data.latitude) : undefined),
      longitude: typeof data.longitude === 'number' ? data.longitude : (typeof data.longitude === 'string' ? Number(data.longitude) : undefined),
    };
    ipGeoCache.set(key, { at: now, geo });
    return geo;
  } catch {
    ipGeoCache.set(key, { at: now, geo: null });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildStayHotSummary(recentMessages: unknown[]): string {
  try {
    if (!Array.isArray(recentMessages) || recentMessages.length === 0) return '';
    const msgs = recentMessages
      .filter((m) => m && typeof m === 'object')
      .slice(-20)
      .map((m) => m as Record<string, unknown>);

    const texts: Array<{ role: string; content: string; idx: number }> = [];
    let idx = 0;
    for (const m of msgs) {
      const role = typeof m.role === 'string' ? m.role : '';
      const content = typeof m.content === 'string' ? m.content : '';
      if (!content) continue;
      if (role !== 'user' && role !== 'assistant') continue;
      texts.push({ role, content: content.slice(0, 600), idx: idx++ });
    }
    if (texts.length === 0) return '';

    const lowerAll = texts.map(t => t.content).join(' ').toLowerCase();
    const lastUser = [...texts].reverse().find((t) => t.role === 'user')?.content || '';
    const lastUserLower = lastUser.toLowerCase();

    const bracketedEntities: string[] = [];
    const addEntity = (s: string) => {
      if (!s) return;
      if (!bracketedEntities.includes(s)) bracketedEntities.push(s);
    };

    const vehicleBrands = ['chevy','chevrolet','silverado','gmc','sierra','ford','f-150','f150','ram','toyota','tacoma','tundra','nissan','patrol','land cruiser','landcruiser','lexus'];
    for (const b of vehicleBrands) {
      if (lowerAll.includes(b)) {
        if (b.includes('silverado')) addEntity('[Car Model: Silverado]');
        if (b === 'chevy' || b === 'chevrolet') addEntity('[Car Brand: Chevrolet]');
        if (b === 'gmc') addEntity('[Car Brand: GMC]');
        if (b === 'sierra') addEntity('[Car Model: Sierra]');
        if (b === 'ford') addEntity('[Car Brand: Ford]');
        if (b === 'ram') addEntity('[Car Brand: RAM]');
        if (b === 'toyota') addEntity('[Car Brand: Toyota]');
        if (b === 'nissan') addEntity('[Car Brand: Nissan]');
      }
    }
    const yearMatch = lowerAll.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) addEntity(`[Year Mentioned: ${yearMatch[1]}]`);
    const seriesMatch = lowerAll.match(/\b(1500|2500|3500)\b/);
    if (seriesMatch) addEntity(`[Series: ${seriesMatch[1]}]`);

    if (lowerAll.includes('wakti')) addEntity('[Topic: Wakti / App]');
    if (lowerAll.includes('image') && (lowerAll.includes('cost') || lowerAll.includes('price') || lowerAll.includes('credits'))) addEntity('[Topic: Image Costs]');

    const cityCountryPairs: Array<{ city: string; country: string }> = [
      { city: 'alkhor', country: 'qatar' },
      { city: 'al khor', country: 'qatar' },
      { city: 'doha', country: 'qatar' },
    ];
    for (const p of cityCountryPairs) {
      if (lowerAll.includes(p.city) && lowerAll.includes(p.country)) {
        addEntity(`[User Location: ${p.city.replace(/\b\w/g, (c) => c.toUpperCase())}, ${p.country.toUpperCase()}]`);
        break;
      }
    }

    const capEntityPattern = /\b[A-Z][a-zA-Z]{2,}\b/g;
    const entityFreq = new Map<string, number>();
    for (const t of texts) {
      const matches = t.content.match(capEntityPattern) || [];
      for (const e of matches) {
        const key = e.toLowerCase();
        if (['the','and','for','with','that','this','have','from','you','your','are','was','were','what','when','where','why','how','can','could','should','would','will','just','like','need','want','hey','hello','hi','yes','yeah','sure','okay','thanks','please'].includes(key)) continue;
        entityFreq.set(e, (entityFreq.get(e) || 0) + 1);
      }
    }
    const topCaps = [...entityFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([e]) => e);

    // Extract topic keywords (frequency-based)
    const corpus = texts.map((t) => t.content).join(' ').toLowerCase();
    const stop = new Set([
      'the','and','for','with','that','this','have','from','you','your','are','was','were','what','when','where','why','how','can','could','should','would','will','just','like','need','want','also','too','into','about','than','then','them','they','our','we','i','me','my','it','its','a','an','to','of','in','on','at','as','is','be','or','if','but','not','do','does','did','hey','hello','hi','yes','yeah','sure','okay','thanks','please','know','think','really','very','much','some','more','here','there','been','being','has','had','get','got','going','come','came','make','made','take','took','find','found','give','gave','tell','told','say','said','see','saw','look','looking','thing','things','something','anything','nothing','everything','way','ways','time','times','good','great','nice','cool','awesome','right','well','back','now','still','already','maybe','probably','actually','basically','literally','definitely'
    ]);
    const words = corpus
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stop.has(w));
    const freq = new Map<string, number>();
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
    const topKeywords = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([w]) => w);

    const userMsgs = texts.filter(t => t.role === 'user');
    const recentUserRequests: string[] = [];
    for (let i = 0; i < Math.min(userMsgs.length, 6); i++) {
      const msg = userMsgs[userMsgs.length - 1 - i];
      if (msg && msg.content.length > 4) recentUserRequests.push(msg.content.slice(0, 220));
    }

    let intent = 'General Chat';
    if (/\b(near me|nearest|closest|around me|nearby)\b/i.test(lastUserLower)) intent = 'Local Search / Nearby Places';
    else if (/\b(cost|price|pricing|credits|subscription|plan)\b/i.test(lastUserLower)) intent = 'Pricing / Costs';
    else if (/\b(engine|oil|towing|tow|payload|spec|specs|trim|model year|maintenance|problem|issue|fix)\b/i.test(lastUserLower)) intent = 'Tech Support / Specs';
    else if (/\b(image|video|audio|music|generate|generator)\b/i.test(lastUserLower)) intent = 'Creation / Generation';

    const facts: string[] = [];
    const addFact = (f: string) => { if (f && !facts.includes(f)) facts.push(f); };
    if (lowerAll.includes('silverado')) addFact('[Vehicle: Silverado]');
    if (yearMatch) addFact(`[Vehicle Year: ${yearMatch[1]}]`);
    if (seriesMatch) addFact(`[Vehicle Series: ${seriesMatch[1]}]`);
    const colorMatch = lowerAll.match(/\b(red|black|white|silver|gray|grey|blue|green)\b/);
    if (colorMatch) addFact(`[Vehicle Color: ${colorMatch[1]}]`);
    if (/\b(full cabin|crew cab|double cab|extended cab)\b/i.test(lowerAll)) addFact('[Cabin: Full / Crew]');

    const locationLine = bracketedEntities.find(e => e.startsWith('[User Location:')) || '';

    // CRITICAL: Detect current conversation topic from last exchange
    const lastAssistant = [...texts].reverse().find((t) => t.role === 'assistant')?.content || '';
    let currentTopic = 'General conversation';
    let userGoal = 'Not specified';
    
    // Analyze last assistant message to understand what user is working on
    if (lastAssistant) {
      const assistLower = lastAssistant.toLowerCase();
      // Document/Image analysis patterns
      if (/\b(image|photo|document|resume|cv|certificate|id|passport|invoice|receipt)\b/i.test(assistLower)) {
        if (/\b(resume|cv)\b/i.test(assistLower)) {
          currentTopic = 'Resume/CV Analysis';
          userGoal = 'Extract and structure resume information';
        } else if (/\b(table|extract|field|data)\b/i.test(assistLower)) {
          currentTopic = 'Document Data Extraction';
          userGoal = 'Extract structured data from uploaded document';
        } else {
          currentTopic = 'Image/Document Analysis';
          userGoal = 'Analyze uploaded image or document';
        }
      }
      // Task/Planning patterns
      else if (/\b(task|todo|plan|schedule|remind|event)\b/i.test(assistLower)) {
        currentTopic = 'Task & Planning';
        userGoal = 'Manage tasks, events, or schedule';
      }
      // Research/Learning patterns
      else if (/\b(explain|learn|understand|study|teach|how does|what is)\b/i.test(assistLower)) {
        currentTopic = 'Learning & Research';
        userGoal = 'Understand a concept or learn something new';
      }
      // Problem-solving patterns
      else if (/\b(solve|fix|debug|error|problem|issue|help)\b/i.test(assistLower)) {
        currentTopic = 'Problem Solving';
        userGoal = 'Resolve an issue or fix a problem';
      }
      // Creation patterns
      else if (/\b(create|generate|make|build|write|design)\b/i.test(assistLower)) {
        currentTopic = 'Content Creation';
        userGoal = 'Generate or create something';
      }
    }
    
    // Also check last user message for additional context
    if (lastUser) {
      if (/\b(search|find|look up|google)\b/i.test(lastUserLower) && currentTopic !== 'General conversation') {
        userGoal = `Search for information related to: ${currentTopic}`;
      }
    }

    const lines: string[] = [];
    
    // NEW: Add current topic section at the top (most important)
    lines.push('🎯 CURRENT CONVERSATION TOPIC (CRITICAL - USE THIS FOR CONTEXT)');
    lines.push(`- TOPIC: ${currentTopic}`);
    lines.push(`- USER GOAL: ${userGoal}`);
    if (lastUser.length > 0) {
      lines.push(`- LAST USER MESSAGE: ${lastUser.slice(0, 200)}`);
    }
    lines.push('');
    
    lines.push('KEY ENTITIES DETECTED');
    const keyEntitiesOut = [...bracketedEntities];
    for (const c of topCaps) keyEntitiesOut.push(`[Entity: ${c}]`);
    if (keyEntitiesOut.length > 0) lines.push(`- ${keyEntitiesOut.slice(0, 14).join('\n- ')}`);
    else lines.push('- [None]');

    lines.push('USER INTENT (BEST GUESS)');
    lines.push(`- [User Intent: ${intent}]`);

    lines.push('USER LOCATION (BEST AVAILABLE)');
    lines.push(`- ${locationLine || '[User Location: Unknown]'}`);

    lines.push('FACTS THE USER STATED (HIGH VALUE)');
    if (facts.length > 0) lines.push(`- ${facts.join('\n- ')}`);
    else lines.push('- [None]');

    lines.push('ACTIVE TOPICS / KEYWORDS');
    if (topKeywords.length > 0) lines.push(`- ${topKeywords.slice(0, 10).join(', ')}`);
    else lines.push('- [None]');

    lines.push('RECENT USER REQUESTS (NEWEST FIRST)');
    if (recentUserRequests.length > 0) lines.push(`- ${recentUserRequests.map((t, i) => `[${i + 1}] ${t}`).join('\n- ')}`);
    else lines.push('- [None]');

    const summary = lines.join('\n');
    if (!summary.trim()) return '';
    return `STAY HOT SUMMARY (STRUCTURED)\n${summary}`;
  } catch {
    return '';
  }
}

console.log("WAKTI AI V2 STREAMING BRAIN: Ready (with verified facts + AI Logging)");

// === TOKEN ESTIMATION ===
// Rough estimate: ~4 chars = 1 token for English, ~3 chars for mixed/Arabic
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// === COST CALCULATION ===
// Prices per 1M tokens (as of Dec 2024)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash': { input: 0.075, output: 0.30 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  
  // Convert to cost (prices are per 1M tokens)
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  
  return inputCost + outputCost;
}

// === AI USAGE LOGGING ===
async function logAIUsage(params: {
  userId?: string;
  functionName: string;
  model?: string;
  status: 'success' | 'error';
  errorMessage?: string;
  prompt?: string;
  response?: string;
  metadata?: Record<string, unknown>;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  costCredits?: number;
}) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { error } = await supabase.rpc('log_ai_usage', {
      p_user_id: params.userId || null,
      p_function_name: params.functionName,
      p_model: params.model || null,
      p_status: params.status,
      p_error_message: params.errorMessage || null,
      p_prompt: params.prompt || null,
      p_response: params.response || null,
      p_metadata: params.metadata || {},
      p_input_tokens: params.inputTokens || 0,
      p_output_tokens: params.outputTokens || 0,
      p_duration_ms: params.durationMs || 0,
      p_cost_credits: params.costCredits || 0
    });
    
    if (error) {
      console.warn('⚠️ AI LOG: Failed to log usage:', error.message);
    } else {
      console.log('📊 AI LOG: Usage logged successfully');
    }
  } catch (err) {
    console.warn('⚠️ AI LOG: Exception:', err);
  }
}

// === GEMINI HELPER ===
function getGeminiApiKey() {
  const k = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!k) throw new Error("Gemini API key not configured");
  return k;
}

type IntentGateResult = {
  needsSearch: boolean;
  confidence: number;
  reason: string;
};

async function classifySearchIntent(message: string, language: string): Promise<IntentGateResult> {
  const fallback: IntentGateResult = { needsSearch: false, confidence: 0, reason: 'fallback' };
  if (!message || !message.trim()) return fallback;
  try {
    const key = getGeminiApiKey();
    const model = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const prompt =
      `You are a routing classifier. Decide if the user request needs LIVE or time-sensitive data ` +
      `(weather now/tomorrow, prices, news, scores, flights, open now, nearby availability). ` +
      `Return ONLY valid JSON with keys: needsSearch (true/false), confidence (0-1), reason (short).\n` +
      `User language: ${language}.\nUser message: "${message}"`;

    // Add timeout to prevent blocking
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 80 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) return fallback;
    const data = await resp.json().catch(() => null) as Record<string, unknown> | null;
    const text = (data as any)?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = typeof text === 'string' ? text.match(/\{[\s\S]*\}/) : null;
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]) as Partial<IntentGateResult>;
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));
    return {
      needsSearch: Boolean(parsed.needsSearch),
      confidence,
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 120) : 'no-reason',
    };
  } catch {
    return fallback;
  }
}

type GeminiRole = 'user' | 'model';
type GeminiContentPart = { text: string };
type GeminiContent = { role: GeminiRole; parts: GeminiContentPart[] };

function buildTextContent(role: GeminiRole, text: string): GeminiContent {
  return { role, parts: [{ text }] };
}

async function streamGemini(
  model: string,
  contents: GeminiContent[],
  onToken: (token: string) => void,
  systemInstruction?: string,
  generationConfig?: Record<string, unknown>
) {
  const key = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
  const body: Record<string, unknown> = { contents };
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

// === GEMINI 3 FLASH WITH GOOGLE SEARCH GROUNDING (STREAMING) ===
interface Gemini3SearchResult {
  text: string;
  groundingMetadata?: {
    // Web Search fields
    webSearchQueries?: string[];
    groundingChunks?: Array<{ 
      web?: { uri: string; title: string };
      place?: { placeId: string; name?: string; address?: string };
    }>;
    groundingSupports?: Array<{
      segment: { startIndex: number; endIndex: number; text: string };
      groundingChunkIndices: number[];
    }>;
    searchEntryPoint?: { renderedContent?: string };
    // Google Maps specific fields
    googleMapsWidgetContextToken?: string;
    places?: Array<{
      placeId: string;
      displayName?: { text: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
    }>;
  };
}

function buildSearchFollowupContents(
  rawUserMessage: string,
  queryText: string,
  recentMessages: unknown[] | undefined
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  const msgs = Array.isArray(recentMessages)
    ? recentMessages
        .filter((m) => m && typeof m === 'object')
        .map((m) => m as Record<string, unknown>)
    : [];

  const convo = msgs
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: (m.content as string) || '' }))
    .filter((m) => m.content.trim().length > 0);

  const lastAssistant = [...convo].reverse().find((m) => m.role === 'assistant')?.content || '';
  const lastUser = [...convo].reverse().find((m) => m.role === 'user')?.content || '';

  const isAffirmativeOnly = (() => {
    const t = (rawUserMessage || '').trim().toLowerCase();
    if (!t) return false;
    // EN
    if (/^(yes|y|yeah|yep|sure|ok|okay|do it|go ahead|please)\b/.test(t)) return true;
    // AR
    if (/^(نعم|اي|أيوه|ايوه|تمام|اوكي|حاضر|تفضل|يلا)\b/.test(t)) return true;
    return false;
  })();

  const getLastAssistantQuestion = (text: string): string => {
    const t = (text || '').trim();
    if (!t) return '';
    const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i];
      if (line.endsWith('?')) return line.slice(0, 500);
    }
    const m = t.match(/([^\n\r]{10,500}\?)\s*$/);
    return m ? m[1].slice(0, 500) : '';
  };

  const assistantQuestion = getLastAssistantQuestion(lastAssistant);

  const resolvedQueryText = (() => {
    if (!isAffirmativeOnly) return queryText;
    if (!assistantQuestion) {
      return `User replied "${rawUserMessage}" to your previous follow-up. Please proceed with what you asked for.\n\n${queryText}`;
    }
    return `User replied "${rawUserMessage}" to your previous follow-up question.\n\nPrevious question: "${assistantQuestion}"\n\nCRITICAL: The user said YES. Execute BOTH options offered in that question (A and B). If the question offered multiple actions, do all of them in a compact way. Then stop and ask one short follow-up question.\n\n${queryText}`;
  })();

  const lastTurns = convo.slice(-6);
  const summaryLines: string[] = [];
  for (let i = 0; i < lastTurns.length; i += 2) {
    const u = lastTurns[i];
    const a = lastTurns[i + 1];
    if (!u || u.role !== 'user') continue;
    const uText = u.content.replace(/\s+/g, ' ').trim().slice(0, 180);
    let aText = a && a.role === 'assistant' ? a.content.replace(/\s+/g, ' ').trim() : '';
    aText = aText.slice(0, 220);
    if (aText) summaryLines.push(`- User: ${uText}\n  Assistant: ${aText}`);
    else summaryLines.push(`- User: ${uText}`);
  }

  const compactSummary = summaryLines.join('\n').slice(0, 1200);

  if (compactSummary || lastUser || lastAssistant) {
    const ctx =
      `CONTEXT (last turns, for continuity only):\n` +
      `${compactSummary ? compactSummary + '\n\n' : ''}` +
      `${lastUser ? `Last user message: ${lastUser.slice(0, 500)}\n` : ''}` +
      `${lastAssistant ? `Last assistant answer: ${lastAssistant.slice(0, 900)}\n` : ''}` +
      `\nNow answer the user's new request using google_search.`;
    contents.push({ role: 'user', parts: [{ text: ctx }] });
    if (lastAssistant) {
      contents.push({ role: 'model', parts: [{ text: lastAssistant.slice(0, 900) }] });
    }
  }

  contents.push({ role: 'user', parts: [{ text: resolvedQueryText }] });
  return contents;
}

// Chat mode: gemini-2.5-flash with grounding (smooth, fast, conversational)
async function streamGemini25FlashGrounded(
  query: string,
  systemInstruction: string,
  recentMessages: unknown[] | undefined,
  onToken: (token: string) => void
): Promise<string> {
  const key = getGeminiApiKey();
  // Use stable gemini-2.5-flash for proper Google Search grounding support
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  try {
    if (Array.isArray(recentMessages) && recentMessages.length > 0) {
      const msgs = recentMessages
        .filter((m) => m && typeof m === 'object')
        .slice(-30)
        .map((m) => m as Record<string, unknown>);

      for (const m of msgs) {
        const r = typeof m.role === 'string' ? m.role : '';
        const c = typeof m.content === 'string' ? m.content : '';
        if (!c) continue;
        if (r !== 'user' && r !== 'assistant') continue;
        const role: 'user' | 'model' = r === 'assistant' ? 'model' : 'user';
        contents.push({ role, parts: [{ text: c.slice(0, 900) }] });
      }
    }
  } catch {
    /* ignore */
  }
  if (contents.length === 0) contents.push({ role: 'user', parts: [{ text: query }] });
  else {
    const last = contents[contents.length - 1];
    if (last?.role !== 'user') contents.push({ role: 'user', parts: [{ text: query }] });
  }

  const body: Record<string, unknown> = {
    contents,
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 4000 },
  };
  if (systemInstruction) {
    body.system_instruction = { parts: [{ text: systemInstruction }] };
  }

  console.log('💬 CHAT GROUNDED: Streaming with Gemini 2.5 Flash + google_search...', {
    contentsCount: contents.length,
    firstRole: contents[0]?.role,
    lastRole: contents[contents.length - 1]?.role,
    lastText: contents[contents.length - 1]?.parts?.[0]?.text?.slice(0, 100),
    systemLen: systemInstruction?.length || 0
  });

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'x-goog-api-key': key,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok || !resp.body) {
    const errText = await resp.text().catch(() => '');
    console.error('❌ CHAT GROUNDED ERROR:', resp.status, errText);
    throw new Error(`Chat grounded error: ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const cands = parsed?.candidates;
        if (Array.isArray(cands) && cands.length > 0) {
          const parts = cands[0]?.content?.parts || [];
          for (const p of parts) {
            const text = typeof p?.text === 'string' ? p.text : undefined;
            if (text) {
              fullText += text;
              onToken(text);
            }
          }
        }
      } catch { /* ignore parse errors */ }
    }
  }

  console.log('✅ CHAT GROUNDED: Stream complete, length:', fullText.length);
  return fullText;
}

// Search mode: gemini-3-flash-preview with grounding (power + formatting)
async function streamGemini3WithSearch(
  query: string,
  systemInstruction: string,
  generationConfig: Record<string, unknown> | undefined,
  recentMessages: unknown[] | undefined,
  onToken: (token: string) => void,
  onGroundingMetadata: (meta: Gemini3SearchResult['groundingMetadata']) => void,
  _userLocation?: { latitude: number; longitude: number } | null
): Promise<string> {
  const key = getGeminiApiKey();
  const model = 'gemini-3-flash-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

  // Inject today's date into the query so Google Search grounding fetches current results
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const y = now.getFullYear();
  const m = now.getMonth();
  // NHL season heuristic: season label is startYear-endYear, where startYear flips around September.
  const nhlSeasonStart = m >= 8 ? y : y - 1;
  const nhlSeason = `${nhlSeasonStart}-${nhlSeasonStart + 1}`;
  const isNhlLive = /\bnhl\b/i.test(query) && /(standings?|scores?|results?|schedule|wild\s*card|conference|division|points|gp|games\s*played)/i.test(query);
  const nhlHint = isNhlLive ? ` Current NHL season: ${nhlSeason}.` : '';
  const latestQuery = `${query} (as of ${todayStr}).${nhlHint}\n\nLATEST-FIRST RULE (CRITICAL): Today is ${todayStr}.${nhlHint} Use the newest available sources/snippets. Prefer results updated today/this hour when present. If sources conflict, choose the most recently updated. If any result refers to an older season (example: \"2023-24\"), treat it as STALE and re-search with a stricter query. Do not use memory for live facts.`;

  const body: Record<string, unknown> = {
    contents: buildSearchFollowupContents(query, latestQuery, recentMessages),
    tools: [{ google_search: {} }],
  };
  
  if (systemInstruction) {
    body.system_instruction = { parts: [{ text: systemInstruction }] };
  }
  if (generationConfig) {
    body.generationConfig = generationConfig;
  }

  console.log('🔍 GEMINI SEARCH: Streaming with Gemini 3 Flash + google_search...');

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'x-goog-api-key': key,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok || !resp.body) {
    const errText = await resp.text().catch(() => '');
    console.error('❌ GEMINI SEARCH ERROR:', resp.status, errText);
    throw new Error(`Gemini search error: ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let groundingMeta: Gemini3SearchResult['groundingMetadata'] = undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const cands = parsed?.candidates;
        if (Array.isArray(cands) && cands.length > 0) {
          const parts = cands[0]?.content?.parts || [];
          for (const p of parts) {
            const text = typeof p?.text === 'string' ? p.text : undefined;
            if (text) {
              fullText += text;
              onToken(text);
            }
          }
          // Capture grounding metadata from final chunk
          if (cands[0]?.groundingMetadata) {
            groundingMeta = cands[0].groundingMetadata;
          }
        }
      } catch { /* ignore parse errors */ }
    }
  }

  // Emit grounding metadata at the end
  if (groundingMeta) {
    onGroundingMetadata(groundingMeta);
  }

  console.log('✅ GEMINI SEARCH: Stream complete, length:', fullText.length, 'grounded:', !!groundingMeta);
  return fullText;
}

// Build system prompt with Personal Touch
function buildSystemPrompt(
  language: string,
  currentDate: string,
  localTime: string,
  personalTouch: Record<string, unknown> | null | undefined,
  activeTrigger: string,
  chatSubmode = 'chat'
) {
  const pt = (personalTouch || {}) as Record<string, unknown>;
  const userNick = ((pt.nickname as string | undefined) || '').toString().trim();
  const aiNick = ((pt.ai_nickname as string | undefined) || '').toString().trim();
  const tone = ((pt.tone as string | undefined) || 'neutral').toString().trim();
  const style = ((pt.style as string | undefined) || 'short answers').toString().trim();

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

  return `You are WAKTI AI, a helpful and friendly AI assistant.

🧠 CRITICAL CONVERSATION MEMORY PROTOCOL (HIGHEST PRIORITY)
You have FULL access to the conversation history provided in the messages. You MUST:
1. NEVER act surprised or ask "what is X?" if the user already told you about X in this conversation.
2. NEVER say "That's a fantastic concept!" or "That sounds interesting!" if the user already explained it before.
3. ALWAYS reference prior context naturally. Example: "As you mentioned earlier about QIWA..." or "Building on what you said about..."
4. If the user mentions something they already explained, acknowledge you remember: "Yes, I remember you're working on QIWA, the fitness app..."
5. Treat the conversation as ONE continuous discussion, not separate isolated messages.
6. If the user corrects you or provides new info, UPDATE your understanding and don't repeat old assumptions.

CRITICAL MULTI-LANGUAGE RULE
- You are multilingual. Default to the UI language "${language}".
- If the user asks for a translation or specifies a target language, RESPOND IN THAT TARGET LANGUAGE.
${personalSection}
CRITICAL OUTPUT FORMAT
- Markdown table: for structured multi-item results (≥3 items with attributes).
- Bulleted list: for steps, checklists, 1–2 results.
- Paragraph: for conversational replies.
- Use Markdown links ONLY when a real URL is provided.

TIME CAPABILITY (IMPORTANT)
- You DO have the user's current local date/time provided below.
- If the user asks "what time is it" or anything about current time/date, answer using the provided "Current local time".
- Do NOT say you can't access real-time time/date.

${activeTrigger === 'chat' && chatSubmode === 'chat' ? `
CHAT FRESHNESS PROTOCOL (CHAT MODE ONLY)
- Be fast and conversational by default.
- If the user asks for time-sensitive facts (e.g., latest news, scores/standings, prices, flights, "open now" hours), you MUST NOT guess.
- If up-to-date information is not available, say it clearly and ask a short follow-up question to narrow what to check.
` : ''}

${chatSubmode === 'study' ? `
📚 STUDY MODE (TUTOR STYLE) - CRITICAL
You are now in STUDY MODE. Act as a friendly, patient tutor who helps the user learn and understand.

STUDY MODE RULES:
1. ANSWER FIRST: Always start with the clear, direct answer or key takeaway (1-2 sentences).
2. EXPLAIN STEP-BY-STEP: Break down the reasoning or concept in simple, numbered steps.
3. USE SIMPLE LANGUAGE: Avoid jargon. Explain like teaching a curious student.
4. STRUCTURE CLEARLY: Use bullet points, numbered lists, or short paragraphs. Never a wall of text.
5. ADD EXAMPLES: When helpful, include a real-world example or analogy.
6. PRACTICE QUESTIONS (optional): For suitable topics, end with 1-2 short practice questions to test understanding.
7. ENCOURAGE: Be supportive and encouraging. Learning should feel positive.

This applies to ALL subjects: math, science, history, languages, programming, exam prep, general knowledge, etc.
If the user uploads an image (photo of notes, textbook, problem), analyze it and teach based on what you see.
` : ''}${activeTrigger === 'search' ? `
🔍 SEARCH MODE INTELLIGENCE (CRITICAL)

CONTEXT-AWARE SEARCH PROTOCOL:
1. CHECK CONVERSATION CONTEXT FIRST: Look at the "CURRENT CONVERSATION TOPIC" section in the Stay Hot Summary above.
2. INFER SEARCH INTENT: If user says just "search" or "find" without specifying what:
   - Check what they were just discussing (TOPIC and USER GOAL)
   - Intelligently infer what they want to search for
   - Example: If discussing "Resume/CV Analysis" for "Abdullah Hassan" → search for "Abdullah Hassan IT Finance professional"
   - Example: If discussing a car model → search for that car's specs/reviews
3. ASK ONLY IF TRULY AMBIGUOUS: Only ask "search about what?" if there's genuinely no context to infer from.

SEARCH EXECUTION RULES:
- You MUST use the google_search tool for web facts and current events.
- Do NOT answer from pre-trained memory for live data (scores, prices, news).
- For general knowledge that doesn't require live data, you may answer directly if confident.

CRITICAL SEARCH FORMATTING RULES (NON-NEGOTIABLE)
You are in SEARCH MODE. You will receive search results in the conversation.

SEARCH MODE = FACTS FIRST (CRITICAL)
- Your priority is ACCURACY, not entertainment.
- NO jokes, no storytelling, no assumptions, no "filler".
- For live facts (sports standings/scores, prices, flights, news):
  - You MUST ONLY output numbers/facts that appear in the retrieved web snippets.
  - If you cannot find the exact standings table or exact numbers, say so clearly and ask a short follow-up (e.g., "Which conference/division?").
- Do NOT use pre-trained memory for standings/scores.
- If sources conflict, prefer the most recent dated source and say which one you used.
- When you present a table/dashboard with numbers, include a short "Sources" section with direct URLs.

FRESHNESS ENFORCEMENT (MANDATORY)
- If the user asks for "latest", "today", "current", "right now", or the query is about live data (scores/standings/prices/flights/news), you MUST attempt to use results updated today/this week.
- If retrieved snippets mention an older season/year (example: "2023-24 season" when today is a newer season), you MUST treat that as STALE and you MUST re-search by generating stricter search queries.
- Re-search query strategy (use 2-4 queries before answering):
  1) Add today's year and the current season label when relevant (example: "NHL standings 2025-26").
  2) Add "updated today" / "updated" / "live".
  3) Prefer official sources first when possible (example: "site:nhl.com standings").
- If after re-search you STILL cannot find verified up-to-date numbers, do NOT guess. Say you cannot verify today's standings right now and provide the best official link(s).

FORMATTING ENFORCEMENT:
- NEVER respond with a single long paragraph. This is FORBIDDEN.
- ALWAYS use one of these formats:
  1) Dashboard layout
  2) Short answers: Use 1-2 sentence intro + max 3 short bullet points.
  3) Detailed answers: Use 2-3 sentence intro + 5-7 bullet points.
  4) Bullet points only: Use minimal intro + only bullet points for content.
- If there are 3 or more distinct events/items: Use a Markdown table with columns like: Event | Key Detail | Source (optional).
- If there are 1-2 items: Use bullet points, NOT a table.
- ALWAYS start with a personalized greeting using this EXACT pattern:
  "Greetings, ${userNick || 'friend'} — ${aiNick || 'Wakti'} here. ${currentDate} (Doha time). I've pulled the latest for you — [then continue with weather/context if relevant, or go straight to the answer]."
  Example: "Greetings, abdullah — wakto here. Friday, December 26, 2025 — 3:05 PM (Doha time). I've pulled the latest for you — Doha's at a pleasant 22°C, a perfect backdrop for tracking the mid-season ice."
- This greeting makes the user feel the response is crafted personally for them. Keep it warm but professional.

CONTENT RULES:
- Base your answer ONLY on the search results provided.
- Do NOT invent events, dates, or facts not in the search results.
- Keep each bullet point or table row concise (1-2 sentences max).
- If search results are unclear or incomplete, say so instead of guessing.

EXAMPLE OUTPUT (3+ items, table format):
Greetings, abdullah — wakto here. Friday, December 26, 2025 — 3:05 PM (Doha time). I've pulled the latest for you:

| Event | Key Detail |
| --- | --- |
| Mobile World Congress 2025 | Launched in Doha with 32 digital projects |
| Global Platform for Disaster Risk | Opens at Qatar National Convention Centre |
| 12th World Innovation Summit | Focuses on AI in education |

EXAMPLE OUTPUT (1-2 items, bullets):
Greetings, abdullah — wakto here. Friday, December 26, 2025 — 3:05 PM (Doha time). I've pulled the latest for you:

- Mobile World Congress 2025 launched in Doha, showcasing 32 edge digital projects from 17 governments.
- The 12th World Innovation Summit for Education opened, focusing on AI's role in transforming learning.
` : ''}
CURRENT TIME CONTEXT
- Current local time: ${localTime}

🔔 SMART REMINDER DETECTION (PROACTIVE ASSISTANT - HIGH PRIORITY)
You have the ability to help users set reminders. Be PROACTIVE and SMART about this:

PROACTIVE REMINDER TRIGGERS (MUST OFFER):
- Flight arrivals/departures: ALWAYS offer "Would you like me to remind you before the flight lands/departs?"
- Meetings/appointments with specific times: ALWAYS offer a reminder
- Deadlines mentioned: ALWAYS offer a reminder
- Events with specific dates/times: ALWAYS offer a reminder
- User tracking someone's travel: Offer to remind them when to leave for pickup

EXPLICIT REMINDER REQUESTS:
- User says "remind me", "don't let me forget", "I need to remember" → Set the reminder immediately

WHEN NOT TO OFFER:
- Pure information queries with no actionable future event
- Casual chat without time-sensitive elements
- Already offered a reminder for this event in the conversation

HOW TO HANDLE TIMING:
- Ambiguous timing ("when I get home", "later") → Ask: "When do you expect that to be?"
- Relative timing ("2 hours before she lands") → Calculate the exact time and confirm
- Always state the exact time you'll set the reminder for

REMINDER FORMAT (CRITICAL - DO NOT SHOW RAW JSON TO USER):
After your natural response text, add this hidden block. The app will process it and show a nice UI:

<!--WAKTI_REMINDER_OFFER:{"suggested_time":"ISO-8601","reminder_text":"Full reminder message - do not truncate","context":"Brief context"}-->

When user confirms, add:
<!--WAKTI_REMINDER_CONFIRM:{"scheduled_for":"ISO-8601","reminder_text":"Full reminder message","timezone":"user-local"}-->

EXAMPLE PROACTIVE OFFER:
User asks about wife's flight arriving at 4:35 AM.
You respond with flight info, then add:
"By the way, would you like me to remind you when to head to the airport? I can ping you at 2:35 AM so you arrive in time."
<!--WAKTI_REMINDER_OFFER:{"suggested_time":"2026-01-25T02:35:00+03:00","reminder_text":"Time to head to the airport! Your wife's flight QR12 lands at 4:35 AM.","context":"Wife flight QR12 arrival"}-->

Be like a smart assistant who anticipates needs. Think Charles Xavier level intuition.

You are ${aiNick || 'WAKTI AI'} — date: ${currentDate} — time: ${localTime}.`;
}

type ChatMessage = { role: string; content: string };

function convertMessagesToClaudeFormat(messages: ChatMessage[]) {
  const systemMessage = messages.find((m: ChatMessage) => m.role === 'system');
  const conversationMessages = messages.filter((m: ChatMessage) => m.role !== 'system');
  return {
    system: systemMessage?.content || '',
    messages: conversationMessages
  };
}

async function streamClaudeResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  onToken?: (text: string) => void
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  let fullResponse = '';

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
            const text = parsed.delta.text;
            fullResponse += text;
            if (onToken) onToken(text);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              token: text,
              content: text
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
  
  return fullResponse;
}


async function executeRegularSearch(query: string, language = 'en') {
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

    let searchData: unknown;
    try {
      searchData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('❌ SEARCH JSON parsing error:', jsonError);
      console.error('❌ Raw response:', responseText.substring(0, 200));
      throw new Error('Invalid JSON response from search service');
    }

    // Extract information safely
    const sd = (searchData && typeof searchData === 'object') ? (searchData as Record<string, unknown>) : {};
    const results = Array.isArray(sd.results) ? (sd.results as Array<Record<string, unknown>>) : [];
    const answer = typeof sd.answer === 'string' ? sd.answer : '';
    const followUpQuestions = Array.isArray(sd.follow_up_questions)
      ? (sd.follow_up_questions as string[])
      : [];
    
    // Build context from search results
    let context = '';
    if (answer) {
      context += `Search Answer: ${answer}\n\n`;
    }
    
    if (results.length > 0) {
      context += 'Search Results:\n';
      results.forEach((result: Record<string, unknown>, index: number) => {
        if (result && typeof result === 'object') {
          const title = typeof result.title === 'string' ? result.title : 'No title';
          const content = typeof result.content === 'string' ? result.content : 'No content';
          const url = typeof result.url === 'string' ? result.url : 'No URL';
          context += `${index + 1}. ${title}\n`;
          context += `   ${content}\n`;
          context += `   Source: ${url}\n\n`;
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

  } catch (error: unknown) {
    console.error('❌ SEARCH: Critical error:', error);
    const details = error instanceof Error ? error.message : String(error);
    
    return {
      success: false,
      error: 'Search failed',
      data: null,
      context: '',
      details
    };
  }
}

// === WOLFRAM|ALPHA HELPER (with timeout protection) ===
async function queryWolfram(input: string, timeoutMs: number = 4000): Promise<{ success: boolean; answer?: string; steps?: string[]; interpretation?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const params = new URLSearchParams({
      appid: WOLFRAM_APP_ID,
      input: input,
      output: 'json',
      format: 'plaintext',
      units: 'metric',
    });

    const url = `https://api.wolframalpha.com/v2/query?${params.toString()}`;
    console.log('🔢 WOLFRAM: Querying (timeout=' + timeoutMs + 'ms):', input.substring(0, 50));

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('⚠️ WOLFRAM: HTTP error', response.status);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const qr = data?.queryresult;

    if (!qr || qr.success === false || qr.error === true) {
      console.log('🔢 WOLFRAM: No results');
      return { success: false, error: 'No results' };
    }

    const pods = qr.pods || [];
    let answer = '';
    let interpretation = '';
    const steps: string[] = [];

    for (const pod of pods) {
      const id = (pod.id || '').toLowerCase();
      const title = (pod.title || '').toLowerCase();
      const text = pod.subpods?.[0]?.plaintext || '';

      if (id === 'input' || title.includes('input')) {
        interpretation = text;
      }
      if (pod.primary || id === 'result' || id === 'solution' || id === 'value' || id === 'decimalapproximation') {
        if (!answer && text) answer = text;
      }
      if (title.includes('step') || id.includes('step')) {
        if (text) steps.push(text);
      }
    }

    // Fallback: grab first non-input pod
    if (!answer) {
      for (const pod of pods) {
        if (pod.id !== 'Input' && pod.subpods?.[0]?.plaintext) {
          answer = pod.subpods[0].plaintext;
          break;
        }
      }
    }

    if (!answer) {
      return { success: false, error: 'No answer found' };
    }

    console.log('✅ WOLFRAM: Got answer');
    return { success: true, answer, steps: steps.length > 0 ? steps : undefined, interpretation };

  } catch (err: unknown) {
    const errName = (err && typeof err === 'object' && 'name' in err) ? (err as { name?: unknown }).name : undefined;
    const errMessage = err instanceof Error ? err.message : String(err);
    if (errName === 'AbortError') {
      console.warn('⚠️ WOLFRAM: Timeout after', timeoutMs, 'ms');
      return { success: false, error: 'Timeout' };
    }
    console.error('❌ WOLFRAM: Error:', errMessage);
    return { success: false, error: errMessage };
  }
}

// === WOLFRAM SUMMARY BOXES API (for entity lookups: countries, people, chemicals, etc.) ===
interface SummaryBoxResult {
  success: boolean;
  domain?: string;
  summary?: string;
  path?: string;
  error?: string;
}

function normalizeSummaryBoxQuery(input: string): string {
  if (!input) return input;
  const trimmed = input.trim();
  const stripped = trimmed.replace(
    /^\s*(what can you tell me about|tell me about|what can you say about|who is|who was|what is|describe|explain|summary of|information about|facts about|give me info on|give me information on|tell me something about)\s+/i,
    ''
  );
  const strippedArabic = stripped.replace(
    /^\s*(من هو|من كانت|ما هو|ما هي|ماذا تعرف عن|اشرح|عرف|ملخص عن)\s+/,
    ''
  );
  const cleaned = strippedArabic.replace(/[?؟!]+\s*$/g, '').trim();
  return cleaned.length >= 2 ? cleaned : trimmed;
}

async function queryWolframSummaryBox(input: string, timeoutMs: number = 3000): Promise<SummaryBoxResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Step 1: Get the summary box path from Query Recognizer
    const recognizerUrl = `https://www.wolframalpha.com/queryrecognizer/query.jsp?appid=${WOLFRAM_APP_ID}&mode=Default&i=${encodeURIComponent(input)}`;
    console.log('📦 WOLFRAM SUMMARY: Query Recognizer for:', input.substring(0, 40));

    const recognizerResp = await fetch(recognizerUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!recognizerResp.ok) {
      clearTimeout(timeoutId);
      console.warn('⚠️ WOLFRAM SUMMARY: Recognizer HTTP error', recognizerResp.status);
      return { success: false, error: `Recognizer HTTP ${recognizerResp.status}` };
    }

    const recognizerXml = await recognizerResp.text();
    
    // Parse XML to extract path and domain
    const pathMatch = recognizerXml.match(/summarybox\s+path="([^"]+)"/);
    const domainMatch = recognizerXml.match(/domain="([^"]+)"/);
    const acceptedMatch = recognizerXml.match(/accepted="([^"]+)"/);

    if (!pathMatch || acceptedMatch?.[1] === 'false') {
      clearTimeout(timeoutId);
      console.log('📦 WOLFRAM SUMMARY: No summary box available for this query');
      return { success: false, error: 'No summary box path' };
    }

    const path = pathMatch[1];
    const domain = domainMatch?.[1] || 'unknown';
    console.log('📦 WOLFRAM SUMMARY: Found path:', path, 'domain:', domain);

    // Step 2: Get the summary box content
    const summaryUrl = `https://www.wolframalpha.com/summaryboxes/v1/query?appid=${WOLFRAM_APP_ID}&path=${encodeURIComponent(path)}`;
    
    const summaryResp = await fetch(summaryUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!summaryResp.ok) {
      console.warn('⚠️ WOLFRAM SUMMARY: Summary HTTP error', summaryResp.status);
      return { success: false, error: `Summary HTTP ${summaryResp.status}` };
    }

    const summaryHtml = await summaryResp.text();
    
    // Extract text content from XHTML (strip tags, get meaningful text)
    // The summary box returns XHTML with structured data
    const textContent = summaryHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1500); // Limit to reasonable size

    if (!textContent || textContent.length < 20) {
      console.log('📦 WOLFRAM SUMMARY: Empty or too short summary');
      return { success: false, error: 'Empty summary' };
    }

    console.log('✅ WOLFRAM SUMMARY: Got summary for domain:', domain, '(', textContent.length, 'chars)');
    return { success: true, domain, summary: textContent, path };

  } catch (err: unknown) {
    const errName = (err && typeof err === 'object' && 'name' in err) ? (err as { name?: unknown }).name : undefined;
    const errMessage = err instanceof Error ? err.message : String(err);
    if (errName === 'AbortError') {
      console.warn('⚠️ WOLFRAM SUMMARY: Timeout after', timeoutMs, 'ms');
      return { success: false, error: 'Timeout' };
    }
    console.error('❌ WOLFRAM SUMMARY: Error:', errMessage);
    return { success: false, error: errMessage };
  }
}

// Detect if query is better suited for Summary Boxes (entity lookups)
function isSummaryBoxQuery(q: string): boolean {
  if (!q) return false;
  const lower = q.toLowerCase();
  // Entity patterns - countries, people, places, chemicals, dates
  if (/\b(who is|who was|tell me about|what is|describe)\b/i.test(lower)) return true;
  if (/\b(country|city|capital|president|king|queen|ceo|founder|inventor)\b/i.test(lower)) return true;
  if (/\b(element|chemical|compound|molecule|atom)\b/i.test(lower)) return true;
  if (/\b(born|died|birthday|founded|established)\b/i.test(lower)) return true;
  if (/\b(person|people|biography|scientist|author|artist|poet|philosopher|leader|dynasty)\b/i.test(lower)) return true;
  if (/\b(company|brand|product|device|vehicle|aircraft|ship|train|car|phone|computer)\b/i.test(lower)) return true;
  if (/\b(animal|species|planet|star|galaxy|mountain|river|lake|ocean)\b/i.test(lower)) return true;
  if (/\b(monument|museum|building|bridge|tower|airport|university|school)\b/i.test(lower)) return true;
  // Proper nouns (capitalized words that aren't at sentence start)
  const words = q.split(/\s+/);
  const properNouns = words.filter((w, i) => i > 0 && /^[A-Z][a-z]+$/.test(w));
  if (properNouns.length >= 1) return true;
  return false;
}

// Detect if query is suitable for Wolfram (academic subjects, math, science, facts)
function isWolframQuery(q: string): boolean {
  if (!q) return false;
  const lower = q.toLowerCase();
  
  // === MATHEMATICS (All Levels) ===
  if (/\d+\s*[\+\-\*\/\^]\s*\d+/.test(q)) return true;
  if (/[∫∑∏√π∞±×÷=≠≤≥<>]/.test(q)) return true;
  if (/\b(sin|cos|tan|cot|sec|csc|log|ln|sqrt|exp)\s*\(/i.test(q)) return true;
  if (/\b(math|maths|arithmetic|algebra|geometry|trigonometry|calculus|statistics|probability|precalculus|pre-calculus)\b/i.test(lower)) return true;
  if (/\b(solve|integrate|derivative|differentiate|limit|factor|simplify|equation|calculate|compute|evaluate|graph|plot)\b/i.test(lower)) return true;
  if (/\b(linear algebra|matrix|matrices|vector|determinant|eigenvalue|eigenvector)\b/i.test(lower)) return true;
  if (/\b(differential equation|discrete math|number theory|topology|real analysis|complex analysis|abstract algebra)\b/i.test(lower)) return true;
  if (/\b(polynomial|quadratic|cubic|exponential|logarithm|function|variable|coefficient|constant)\b/i.test(lower)) return true;
  if (/\b(fraction|decimal|percentage|ratio|proportion|prime|factorial|permutation|combination)\b/i.test(lower)) return true;
  if (/\b(mean|median|mode|average|standard deviation|variance|correlation|regression)\b/i.test(lower)) return true;
  
  // === PHYSICS ===
  if (/\b(physics|mechanics|thermodynamics|electromagnetism|quantum|relativity|optics|nuclear|astrophysics)\b/i.test(lower)) return true;
  if (/\b(force|mass|acceleration|velocity|speed|momentum|energy|power|work|torque|friction)\b/i.test(lower)) return true;
  if (/\b(newton|joule|watt|volt|ampere|ohm|coulomb|farad|tesla|hertz|pascal)\b/i.test(lower)) return true;
  if (/\b(gravity|gravitational|magnetic|electric|electromagnetic|wave|frequency|wavelength|amplitude)\b/i.test(lower)) return true;
  if (/\b(circuit|resistance|capacitance|inductance|current|voltage|charge)\b/i.test(lower)) return true;
  
  // === CHEMISTRY ===
  if (/\b(chemistry|chemical|organic chemistry|inorganic|biochemistry|physical chemistry|analytical chemistry)\b/i.test(lower)) return true;
  if (/\b(element|compound|molecule|atom|ion|isotope|electron|proton|neutron)\b/i.test(lower)) return true;
  if (/\b(periodic table|atomic number|atomic mass|valence|oxidation|reduction|reaction|bond|covalent|ionic)\b/i.test(lower)) return true;
  if (/\b(acid|base|ph|solution|solute|solvent|concentration|molarity|mole)\b/i.test(lower)) return true;
  if (/\b(formula|equation|balance|stoichiometry|yield|catalyst|equilibrium)\b/i.test(lower)) return true;
  
  // === BIOLOGY / LIFE SCIENCES ===
  if (/\b(biology|biological|genetics|molecular biology|microbiology|ecology|zoology|botany|neuroscience|immunology)\b/i.test(lower)) return true;
  if (/\b(cell|dna|rna|protein|gene|chromosome|mitosis|meiosis|evolution|natural selection)\b/i.test(lower)) return true;
  if (/\b(organism|species|kingdom|phylum|class|order|family|genus|taxonomy)\b/i.test(lower)) return true;
  if (/\b(photosynthesis|respiration|metabolism|enzyme|hormone|antibody|virus|bacteria)\b/i.test(lower)) return true;
  
  // === MEDICINE / HEALTH ===
  if (/\b(anatomy|physiology|pharmacology|pathology|cardiology|neurology|medicine|medical)\b/i.test(lower)) return true;
  if (/\b(heart|brain|lung|liver|kidney|blood|bone|muscle|nerve|tissue|organ)\b/i.test(lower)) return true;
  if (/\b(disease|symptom|diagnosis|treatment|drug|medication|dose|vaccine)\b/i.test(lower)) return true;
  if (/\b(nutrition|vitamin|mineral|calorie|protein|carbohydrate|fat|fiber)\b/i.test(lower)) return true;
  
  // === EARTH & SPACE SCIENCES ===
  if (/\b(earth science|geology|geography|meteorology|oceanography|astronomy|astrophysics)\b/i.test(lower)) return true;
  if (/\b(planet|star|galaxy|universe|solar system|moon|sun|orbit|satellite|comet|asteroid)\b/i.test(lower)) return true;
  if (/\b(earthquake|volcano|tectonic|rock|mineral|fossil|erosion|weathering)\b/i.test(lower)) return true;
  if (/\b(climate|weather|atmosphere|temperature|pressure|humidity|precipitation)\b/i.test(lower)) return true;
  if (/\b(ocean|sea|river|lake|mountain|continent|latitude|longitude)\b/i.test(lower)) return true;
  
  // === HISTORY (World, Islamic, Regional) ===
  if (/\b(history|historical|ancient|medieval|modern|century|era|period|civilization|empire)\b/i.test(lower)) return true;
  if (/\b(world war|revolution|independence|colonialism|renaissance|enlightenment)\b/i.test(lower)) return true;
  if (/\b(prophet|caliphate|ottoman|umayyad|abbasid|islamic golden age|crusade)\b/i.test(lower)) return true;
  if (/\b(pharaoh|roman|greek|persian|byzantine|mongol|dynasty)\b/i.test(lower)) return true;
  
  // === ISLAMIC STUDIES ===
  if (/\b(quran|qur'an|hadith|fiqh|tafsir|seerah|aqeedah|shariah|sharia|islamic)\b/i.test(lower)) return true;
  if (/\b(tajweed|usul|uloom|maqasid|ijtihad|fatwa|halal|haram|sunnah|salah|zakat|hajj|sawm|ramadan)\b/i.test(lower)) return true;
  if (/\b(prophet muhammad|sahaba|companion|imam|scholar|mosque|masjid|kaaba|mecca|medina)\b/i.test(lower)) return true;
  if (/\b(surah|ayah|verse|chapter|revelation|angel|jannah|jahannam|day of judgment)\b/i.test(lower)) return true;
  // Arabic Islamic terms
  if (/\b(قرآن|حديث|فقه|تفسير|سيرة|عقيدة|شريعة|تجويد|أصول|علوم|مقاصد|اجتهاد|فتوى|حلال|حرام|سنة|صلاة|زكاة|حج|صوم|رمضان)\b/.test(q)) return true;
  
  // === LANGUAGES (Arabic, English, French, etc.) ===
  if (/\b(grammar|syntax|morphology|phonetics|phonology|semantics|linguistics|vocabulary|etymology)\b/i.test(lower)) return true;
  if (/\b(noun|verb|adjective|adverb|pronoun|preposition|conjunction|article|tense|conjugation|declension)\b/i.test(lower)) return true;
  if (/\b(arabic grammar|nahw|sarf|balagha|rhetoric|literature|poetry|prose)\b/i.test(lower)) return true;
  if (/\b(english grammar|french grammar|spanish grammar|german grammar)\b/i.test(lower)) return true;
  if (/\b(translation|translate|meaning of|definition of|what does .* mean)\b/i.test(lower)) return true;
  // Arabic grammar terms
  if (/\b(نحو|صرف|بلاغة|إعراب|فعل|اسم|حرف|جملة|مبتدأ|خبر|فاعل|مفعول)\b/.test(q)) return true;
  
  // === ECONOMICS / BUSINESS / FINANCE ===
  if (/\b(economics|microeconomics|macroeconomics|econometrics|finance|accounting|business)\b/i.test(lower)) return true;
  if (/\b(supply|demand|market|price|cost|profit|loss|revenue|gdp|inflation|interest rate)\b/i.test(lower)) return true;
  if (/\b(stock|bond|investment|portfolio|dividend|capital|asset|liability|equity)\b/i.test(lower)) return true;
  if (/\b(tax|budget|fiscal|monetary|trade|export|import|tariff)\b/i.test(lower)) return true;
  
  // === COMPUTER SCIENCE / ENGINEERING ===
  if (/\b(computer science|programming|algorithm|data structure|database|network|operating system)\b/i.test(lower)) return true;
  if (/\b(machine learning|artificial intelligence|neural network|deep learning|nlp|cryptography|cybersecurity)\b/i.test(lower)) return true;
  if (/\b(engineering|electrical|mechanical|civil|chemical|aerospace|biomedical|industrial)\b/i.test(lower)) return true;
  if (/\b(binary|hexadecimal|boolean|logic gate|cpu|memory|bandwidth|latency)\b/i.test(lower)) return true;
  
  // === LAW / POLITICAL SCIENCE ===
  if (/\b(law|legal|constitutional|criminal law|civil law|international law|sharia law|jurisprudence)\b/i.test(lower)) return true;
  if (/\b(political science|government|democracy|republic|parliament|congress|constitution|rights)\b/i.test(lower)) return true;
  if (/\b(treaty|legislation|statute|court|judge|verdict|appeal|jurisdiction)\b/i.test(lower)) return true;
  
  // === PHILOSOPHY / PSYCHOLOGY / SOCIOLOGY ===
  if (/\b(philosophy|ethics|logic|metaphysics|epistemology|aesthetics|existentialism)\b/i.test(lower)) return true;
  if (/\b(psychology|cognitive|behavioral|developmental|clinical|social psychology|freud|jung)\b/i.test(lower)) return true;
  if (/\b(sociology|anthropology|culture|society|social|demographic|population)\b/i.test(lower)) return true;
  
  // === CONVERSIONS & MEASUREMENTS ===
  if (/\b(convert|conversion|how many|how much|what is .* in)\b/i.test(lower)) return true;
  if (/\d+\s*(km|m|cm|mm|ft|in|mi|yd|kg|g|lb|oz|l|ml|gal|mph|kph|°[CF]|kelvin|fahrenheit|celsius)/i.test(q)) return true;
  
  // === GENERAL ACADEMIC QUESTION PATTERNS ===
  if (/\b(what is|what are|who is|who was|when did|where is|why does|how does|explain|define|describe|compare|contrast)\b/i.test(lower)) return true;
  if (/\b(formula for|equation for|law of|theory of|principle of|definition of)\b/i.test(lower)) return true;
  if (/\b(calculate|compute|find|determine|prove|derive|show that)\b/i.test(lower)) return true;
  
  return false;
}

function isWaktiInvolved(q: string) {
  try {
    const s = String(q || '').trim();
    if (!s) return false;
    const hasWakti = /\bwakti\b/i.test(s) || /وقتي/.test(s);
    if (!hasWakti) return false;
    
    // Exclude dev/meta messages about building/debugging Wakti itself
    const devTerms = /\b(brain|prompt|supabase|model|edge function|deploy|debug|code|api|backend|frontend|gemini|openai|claude|anthropic)\b/i;
    if (devTerms.test(s)) return false;
    
    // If message is long (>150 chars), likely content that just mentions Wakti, not a help request
    if (s.length > 150) return false;
    
    // Require question/help intent patterns near Wakti mention
    // English question patterns
    const enQuestionPatterns = /\b(what is|what's|how (do|can|to)|tell me about|explain|help( me)?( with)?|show me|where is|can you|could you|is there|does wakti|can wakti|will wakti|wakti (can|does|is|has|help|support|do|work))\b/i;
    // Arabic question patterns
    const arQuestionPatterns = /(ما هو|ماهو|وش هو|وشهو|شو هو|ايش|كيف|ليش|وين|فين|هل|ممكن|ساعدني|عرفني|قولي|اشرح|وضح|علمني|عطني|ابي اعرف|ودي اعرف|يقدر|تقدر|فيه|عنده)/;
    // Short standalone mentions (just "wakti" or "wakti?" or "وقتي؟")
    const shortStandalone = /^(wakti|وقتي)\s*[?؟]?\s*$/i;
    // Direct help-seeking phrases
    const helpPhrases = /\b(not working|doesn't work|broken|issue|problem|bug|error|stuck|confused|lost|مشكلة|ما يشتغل|خربان|مو شغال|ضايع|محتار)\b/i;
    
    if (enQuestionPatterns.test(s)) return true;
    if (arQuestionPatterns.test(s)) return true;
    if (shortStandalone.test(s)) return true;
    if (helpPhrases.test(s)) return true;
    
    // No question/help intent detected - user just mentioned Wakti in content
    return false;
  } catch {
    return false;
  }
}

// Detect if Chat query needs verified lookup (contacts, hours, nearest, open-now)
function needsVerifiedLookup(q: string): boolean {
  const s = (q || '').trim().toLowerCase();
  if (!s) return false;
  // Phone/contact/website/email patterns
  if (/\b(phone|number|call|contact|website|email|whatsapp|instagram|facebook|tiktok)\b/i.test(s)) return true;
  // Hours/open-now patterns
  if (/\b(hours|open now|closed now|opening|closing|open today|closes at|opens at)\b/i.test(s)) return true;
  // Nearest/location patterns
  if (/\b(nearest|closest|near me|nearby|around me)\b/i.test(s)) return true;
  // Arabic equivalents
  if (/هاتف|رقم|اتصال|موقع|ايميل|واتساب|انستقرام|فيسبوك|تيك توك|ساعات|مفتوح|مغلق|أقرب|قريب/.test(s)) return true;
  return false;
}

// === GEOCODING FOR CITY DETECTION ===
interface GeocodingResult {
  city?: string;
  country?: string;
  formattedAddress?: string;
}

// Reverse geocode coordinates to get accurate city name
async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('⚠️ GEOCODING: No API key configured');
    return {};
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.warn('⚠️ GEOCODING: No results', data.status);
      return {};
    }

    const result = data.results[0];
    const components = result.address_components || [];
    
    let city = '';
    let country = '';

    for (const comp of components) {
      if (comp.types.includes('locality')) {
        city = comp.long_name;
      } else if (comp.types.includes('administrative_area_level_1') && !city) {
        city = comp.long_name;
      } else if (comp.types.includes('country')) {
        country = comp.long_name;
      }
    }

    console.log(`📍 GEOCODING: ${lat},${lng} → ${city}, ${country}`);
    return {
      city,
      country,
      formattedAddress: result.formatted_address
    };
  } catch (error) {
    console.error('❌ GEOCODING ERROR:', error);
    return {};
  }
}

// Detect search intent from user query
function detectSearchIntent(query: string): 'business' | 'news' | 'url' | 'general' {
  const lower = query.toLowerCase();
  
  // URL pattern
  if (/https?:\/\//.test(query) || /www\./i.test(query)) return 'url';
  
  // Business/location patterns (English)
  if (/\b(near me|location|address|phone|email|hours|open|closed|directions|map|restaurant|cafe|coffee|shop|store|hotel|hospital|gym|bank|pharmacy|pharmacies)\b/i.test(lower)) return 'business';
  if (/\b(where is|how to get to|find|search for)\b/i.test(lower) && /\b(place|business|store|restaurant|cafe|hotel)\b/i.test(lower)) return 'business';
  
  // Business/location patterns (Arabic)
  if (/قريب|موقع|عنوان|هاتف|ساعات|مفتوح|مغلق|اتجاهات|خريطة|مطعم|مقهى|محل|فندق|مستشفى|صيدلية|بنك/.test(query)) return 'business';
  
  // News/research patterns
  if (/\b(news|latest|breaking|update|today|yesterday|recent|current events|what happened|headlines)\b/i.test(lower)) return 'news';
  if (/\b(research|study|paper|article|learn about|explain|what is|who is|history of)\b/i.test(lower)) return 'news';
  
  return 'general';
}

function scoreChatNeedsFreshSearch(message: string): number {
  const txt = (message || '').trim();
  if (!txt) return 0;
  const lower = txt.toLowerCase();

  if (txt.length <= 3) return 0;
  if (/^(hi|hey|hello|yo|sup|good (morning|afternoon|evening))\b/i.test(lower)) return 0;

  let score = 0;
  if (/\b(latest|today|now|current|updated|update|breaking|live|right now|as of)\b/i.test(lower)) score += 0.5;
  if (/\b(score|scores|standings|ranking|rankings|leaderboard|odds|injury report|lineup)\b/i.test(lower)) score += 0.45;
  if (/\b(stock|stocks|price|prices|crypto|bitcoin|eth|exchange rate|forex|gold|oil|market|nasdaq|dow|s\&p|sp500)\b/i.test(lower)) score += 0.45;
  if (/\b(flight|gate|terminal|delay|departure|arrival)\b/i.test(lower)) score += 0.45;
  if (/\b(weather)\b/i.test(lower)) score += 0.35;
  if (/\b(open now|closed now|hours today|closing time|opens at|closes at)\b/i.test(lower)) score += 0.35;

  if (/\b(202\d|\d{1,2}[:.]\d{2})\b/.test(lower)) score += 0.15;
  if (/\b(doha|qatar)\b/i.test(lower)) score += 0.05;

  if (score > 1) score = 1;
  return score;
}

function getLastTextMessage(recentMessages: unknown[], role: 'user' | 'assistant'): string {
  try {
    if (!Array.isArray(recentMessages)) return '';
    for (let i = recentMessages.length - 1; i >= 0; i -= 1) {
      const m = recentMessages[i] as Record<string, unknown> | undefined;
      if (!m || typeof m !== 'object') continue;
      if (m.role !== role) continue;
      const content = typeof m.content === 'string' ? m.content : '';
      if (content) return content;
    }
    return '';
  } catch {
    return '';
  }
}

function userApprovedSearch(message: string, recentMessages: unknown[]): boolean {
  const userMsg = (message || '').trim().toLowerCase();
  if (!userMsg) return false;

  const lastAssistant = getLastTextMessage(recentMessages, 'assistant').toLowerCase();
  const askedToSearch = /\b(search|look it up|check online|live check|google)\b/i.test(lastAssistant) && /\?/.test(lastAssistant);
  if (!askedToSearch) return false;

  // Simple “yes” intent in EN/AR
  if (/^(yes|yep|yeah|sure|ok|okay|do it|go ahead|please|yalla)\b/.test(userMsg)) return true;
  if (/^(نعم|اي|أيوه|ايوه|تمام|اوكي|حاضر|تفضل|يلا)\b/.test(userMsg)) return true;
  return false;
}

function userDeclinedSearch(message: string, recentMessages: unknown[]): boolean {
  const userMsg = (message || '').trim().toLowerCase();
  if (!userMsg) return false;

  const lastAssistant = getLastTextMessage(recentMessages, 'assistant').toLowerCase();
  const askedToSearch = /\b(search|look it up|check online|live check|google)\b/i.test(lastAssistant) && /\?/.test(lastAssistant);
  if (!askedToSearch) return false;

  if (/^(no|nah|nope|don\s?t|do not|skip|not now)\b/.test(userMsg)) return true;
  if (/^(لا|مو|مو\s?الحين|لا\s?ابي|لا\s?أبي)\b/.test(userMsg)) return true;
  return false;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Extract user ID from auth header for logging
  let userId: string | undefined;
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      // Decode JWT payload (middle part) to get user id
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub;
    }
  } catch { /* ignore auth parsing errors */ }

  const startTime = Date.now();
  let requestMessage = '';
  let requestTrigger = 'general';
  let requestSubmode = 'chat';
  let modelUsedOuter = '';
  // Track external service usage for logging (declared at outer scope for catch block access)
  let wolframUsedOuter = false;
  let tavilyUsedOuter = false;
  let tavilyResultsCountOuter = 0;

  // Read body BEFORE creating stream to avoid broken pipe errors
  let parsedBody: Record<string, unknown> = {};
  let bodyParseError: string | null = null;
  try {
    const bodyText = await req.text();
    parsedBody = bodyText ? JSON.parse(bodyText) : {};
  } catch (bodyErr: unknown) {
    bodyParseError = bodyErr instanceof Error ? bodyErr.message : 'Unknown error';
    console.error('🔥 BODY PARSE ERROR:', bodyParseError);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // CRITICAL: Send first SSE byte IMMEDIATELY to prevent 504 Gateway Timeout
      // Supabase gateway times out if no bytes sent within ~60s
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ keepalive: true, stage: 'init' })}\n\n`));
      } catch { /* connection may already be closed */ }

      // Handle body parse error
      if (bodyParseError) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Invalid request body' })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        return;
      }

      try {
        const body = parsedBody;

        const { 
          message, 
          language = 'en', 
          recentMessages = [], 
          personalTouch = null, 
          activeTrigger = 'general',
          chatSubmode = 'chat', // 'chat' or 'study'
          location = null,
          clientTimezone = 'UTC'
        } = body as { message?: string; language?: string; recentMessages?: unknown[]; personalTouch?: unknown; activeTrigger?: string; chatSubmode?: string; location?: any; clientTimezone?: string };

        // Store for logging
        requestMessage = typeof message === 'string' ? message : '';
        requestSubmode = chatSubmode;

        let effectiveTrigger = activeTrigger;
        // Only run search intent gate for regular chat mode (NOT study mode)
        // Study mode should always go straight to Wolfram/AI without search interruption
        // SIMPLIFIED: Only auto-search at very high confidence (0.95+) to keep chat as chat
        const shouldCheckSearchIntent = activeTrigger === 'chat' && chatSubmode === 'chat' && !isWaktiInvolved(message || '');
        if (shouldCheckSearchIntent) {
          try {
            const gate = await classifySearchIntent(message || '', language);
            console.log('🔎 INTENT GATE:', gate);
            // 95% threshold: only auto-search for obvious live-data queries (weather, prices, scores)
            if (gate.needsSearch && gate.confidence >= 0.95) {
              effectiveTrigger = 'search';
              console.log('🔍 AUTO-SEARCH: High confidence live data query');
            }
            // Everything else stays in chat mode
          } catch (gateErr) {
            console.error('❌ INTENT GATE ERROR:', gateErr);
            // On error, just continue with chat mode
          }
        }

        requestTrigger = effectiveTrigger;
        console.log(`🎯 REQUEST: trigger=${effectiveTrigger}, submode=${chatSubmode}, lang=${language}`);
        console.log('📍 LOCATION PAYLOAD:', {
          hasLocation: !!location,
          source: location?.source,
          latitude: location?.latitude,
          longitude: location?.longitude,
          city: location?.city,
          country: location?.country,
          accuracy: location?.accuracy,
          timezone: clientTimezone,
        });

        if (!message) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Message required' })}\n\n`));
          controller.close();
          return;
        }

        const stayHotSummary = buildStayHotSummary(Array.isArray(recentMessages) ? recentMessages : []);

        // IP-based geo (fast + cached). Used only as fallback when client doesn't send location.
        const clientIp = extractClientIp(req);
        const ipGeo = (!location || (!location?.city && !location?.country && !location?.latitude && !location?.longitude))
          ? await lookupIpGeo(clientIp)
          : null;

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const getProfileTimezone = async (uid?: string): Promise<string | null> => {
          try {
            if (!uid) return null;
            // Try common column names defensively.
            try {
              const { data, error } = await supabaseAdmin
                .from('profiles')
                .select('timezone')
                .eq('id', uid)
                .maybeSingle();
              if (!error) {
                const tz = (data as { timezone?: unknown } | null)?.timezone;
                const v = typeof tz === 'string' ? tz.trim() : '';
                if (v) return v;
              }
            } catch {}

            try {
              const { data, error } = await supabaseAdmin
                .from('profiles')
                .select('time_zone')
                .eq('id', uid)
                .maybeSingle();
              if (!error) {
                const tz = (data as { time_zone?: unknown } | null)?.time_zone;
                const v = typeof tz === 'string' ? tz.trim() : '';
                if (v) return v;
              }
            } catch {}

            return null;
          } catch {
            return null;
          }
        };

        const profileTimezone = (!clientTimezone || clientTimezone === 'UTC')
          ? await getProfileTimezone(userId)
          : null;

        const effectiveTimezone = (clientTimezone && clientTimezone !== 'UTC')
          ? clientTimezone
          : (profileTimezone || ipGeo?.timezone || clientTimezone || 'UTC');

        const ipLocationLine = (() => {
          if (!ipGeo) return '';
          const parts: string[] = [];
          if (ipGeo.city) parts.push(ipGeo.city);
          if (ipGeo.region) parts.push(ipGeo.region);
          if (ipGeo.country) parts.push(ipGeo.country);
          const label = parts.length > 0 ? parts.join(', ') : '';
          if (!label) return '';
          return `User Location (via IP): ${label}${ipGeo.timezone ? ` | Timezone: ${ipGeo.timezone}` : ''}`;
        })();

        // Build full location context (for Chat + Search modes)
        // Prioritize native location from client, fallback to IP geo
        let fullLocationContext = '';
        {
          let userCity = location?.city || '';
          let userCountry = location?.country || '';
          const userLat = location?.latitude;
          const userLng = location?.longitude;
          
          // Fallback to IP geo if native location missing city/country
          if (!userCity && ipGeo?.city) userCity = ipGeo.city;
          if (!userCountry && ipGeo?.country) userCountry = ipGeo.country;
          
          // Reverse geocode if we have coordinates but no city
          if (userLat && userLng && !userCity) {
            try {
              const geocoded = await reverseGeocode(userLat, userLng);
              if (geocoded.city) userCity = geocoded.city;
              if (geocoded.country) userCountry = geocoded.country;
            } catch {}
          }
          
          if (userCity || userCountry || (userLat && userLng)) {
            const parts: string[] = [];
            if (userCity && userCountry) parts.push(`City: ${userCity}, ${userCountry}`);
            else if (userCity) parts.push(`City: ${userCity}`);
            else if (userCountry) parts.push(`Country: ${userCountry}`);
            if (userLat && userLng) {
              parts.push(`Coordinates: ${userLat.toFixed(4)}°N, ${userLng.toFixed(4)}°E`);
            }
            if (parts.length > 0) {
              fullLocationContext = `USER LOCATION CONTEXT:\n${parts.join('\n')}`;
            }
          }
        }

        // Chat mode: if the user is asking about WAKTI specifically, respond with the correct format + chip
        if (effectiveTrigger === 'chat' && chatSubmode === 'chat' && isWaktiInvolved(message)) {
          const userName = (personalTouch as { nickname?: string })?.nickname || '';
          const greeting = userName ? `Sure, ${userName}! ` : 'Sure! ';
          
          const promoText = language === 'ar'
            ? `بالتأكيد${userName ? '، ' + userName : ''}! وقتي هو تطبيق ذكاء اصطناعي شامل للإنتاجية. مصمم ليكون سهل الاستخدام ومتكيف مع احتياجاتك.\n\nللحصول على أدلة خطوة بخطوة، افتح المساعدة والأدلة - هناك 3 تبويبات:\n- الأدلة (مثل المستندات المصغرة)\n- أخوي الصغير مساعد وقتي الذي سيشرح لك كل شيء إذا ما ودّك تقرأ\n- تبويب الدعم للتواصل معنا مباشرة`
            : `${greeting}Wakti AI is your all-in-one productivity AI app. It's built to be user-friendly and adaptable to your needs.\n\nFor step-by-step guides, open Help & Guides - there are 3 tabs:\n- Guides (like mini documents)\n- My little brother Wakti Help Assistant who will walk you through everything if you don't feel like reading\n- A Support tab to get in touch with us directly`;

          // Emit the chip first
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              metadata: {
                helpGuideChip: {
                  label: language === 'ar' ? 'افتح المساعدة والإرشادات' : 'Open Help & Guides',
                  route: '/help'
                }
              }
            })}\n\n`));
          } catch (e) {
            console.warn('helpGuideChip emit failed', e);
          }

          // Emit the response text
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: promoText, content: promoText })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        const currentDate = new Date().toLocaleDateString('en-US', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: effectiveTimezone
        });

        const localTime = new Date().toLocaleString('en-US', {
          timeZone: effectiveTimezone,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        const systemPrompt = buildSystemPrompt(
          language,
          currentDate,
          localTime,
          personalTouch as Record<string, unknown> | null | undefined,
          effectiveTrigger,
          chatSubmode
        );

        const messages = [
          { role: 'system', content: systemPrompt }
        ];

        // Add history (Increased from 15 to 30 for better conversation context retention)
        if (Array.isArray(recentMessages) && recentMessages.length > 0) {
          const historyMessages = (recentMessages as Array<Record<string, unknown>>).slice(-30);
          historyMessages.forEach((msg: Record<string, unknown>) => {
            const role = typeof msg.role === 'string' ? msg.role : undefined;
            const content = typeof msg.content === 'string' ? msg.content : '';
            if (role === 'user' || role === 'assistant') {
              messages.push({ role, content });
            }
          });
        }
        
        // Track external service usage (update outer scope vars for catch block access)
        
        // Search mode: Use Gemini 3 Flash with Google Search grounding (STREAMING)
        if (effectiveTrigger === 'search') {
          try {
            // Build search-specific system prompt with Personal Touch
            const pt = (personalTouch || {}) as Record<string, unknown>;
            const userNick = ((pt.nickname as string | undefined) || '').toString().trim();
            const aiNick = ((pt.ai_nickname as string | undefined) || '').toString().trim();
            const toneVal = ((pt.tone as string | undefined) || 'neutral').toString().trim();
            const _styleVal = ((pt.style as string | undefined) || 'short answers').toString().trim(); // unused but kept for future
            const customNote = ((pt.instruction as string | undefined) || '').toString().trim();

            // Detect search intent
            const searchIntent = detectSearchIntent(message);

            // Get current time in user's timezone (fallback to UTC)
            const userTimeZone = effectiveTimezone || 'UTC';
            const localTime = new Date().toLocaleString('en-US', { 
              timeZone: userTimeZone, 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });

            // Get accurate city from coordinates if available
            let userCity = location?.city || '';
            let userCountry = location?.country || '';
            if (!userCity && ipGeo?.city) userCity = ipGeo.city;
            if (!userCountry && ipGeo?.country) userCountry = ipGeo.country;
            
            if (location?.latitude && location?.longitude && !userCity) {
              console.log('📍 Reverse geocoding to get accurate city...');
              const geocoded = await reverseGeocode(location.latitude, location.longitude);
              if (geocoded.city) userCity = geocoded.city;
              if (geocoded.country) userCountry = geocoded.country;
            }

            // Build location context string
            let locationContext = '';
            if (userCity || userCountry) {
              const parts = [];
              if (userCity && userCountry) parts.push(`City: ${userCity}, ${userCountry}`);
              else if (userCity) parts.push(`City: ${userCity}`);
              else if (userCountry) parts.push(`Country: ${userCountry}`);
              if (location?.latitude && location?.longitude) {
                parts.push(`Coordinates: ${location.latitude.toFixed(4)}°N, ${location.longitude.toFixed(4)}°E`);
              }
              if (parts.length > 0) {
                locationContext = `\n\nUSER LOCATION CONTEXT:\n${parts.join('\n')}`;
              }
            }

            // Intent detection is now built into the system prompt itself
            // (searchIntent is still used for Maps grounding below)

            const searchSystemPrompt = `${stayHotSummary ? stayHotSummary + "\n\n" : ''}${ipLocationLine ? ipLocationLine + "\n\n" : ''}You are WAKTI AI — an elite, hyper-intelligent Search Intelligence.
You are the Al Jazeera of news (deep context), the ESPN of sports (real-time stakes), and the Oxford of research (academic rigor).
You do not "chat". You perform REAL-TIME SYNTHESIS. You are a digital strategist with the brain of a researcher and the style of a high-end concierge.

### 🌐 THE WORLD SENSOR (LIVE CONTEXT)
- CURRENT TIME: ${localTime} (${userTimeZone})
- LOCATION: ${locationContext}

### 🧠 PERSONALIZATION SETTINGS
${userNick ? `- USER NICKNAME: "${userNick}" (use naturally once in the intro).` : '- Use an elite, professional greeting.'}
${aiNick ? `- YOUR NAME: "${aiNick}".` : ''}
${toneVal !== 'neutral' ? `- TONE: ${toneVal}.` : ''}
${customNote ? `- SPECIAL NOTE (obey): ${customNote}` : ''}
- LANGUAGE: ${language === 'ar' ? 'Arabic (RTL when appropriate)' : 'English'}

### 🧠 REASONING PROTOCOL (INTERNAL STEPS - DO BEFORE EVERY RESPONSE)
1. VERIFY: Check ${localTime} against business hours found. If it's 10 PM and they close at 9 PM, flag it as "Closed Now".
2. CROSS-REFERENCE: For sports/news, check 3+ sources to find "The Lead" (the most important fact).
3. ANALYZE IMPACT: Don't just find facts; explain the impact (e.g., "This win moves them to 2nd place in the division").

### 🛡️ DATA INTEGRITY PROTOCOL (STRICT)
1. NO PRE-TRAINED GUESSING: For Scores, Stocks, and Flights, you are FORBIDDEN from using internal memory. You MUST perform a fresh search for "[Topic] results ${localTime}" and extract numbers directly from search snippets.
2. DATE VERIFICATION: Compare the date in search results to today (${localTime}). If the result says "Yesterday" but refers to a month ago, ignore it and keep searching.
3. THE "STAKES" RULE: Never just give a number. Explain what the number means (e.g., "This win clinches a playoff spot" or "This price drop is a 52-week low").
4. ZERO HALLUCINATION: If a detail (Hours/Phone/Score) is not found in the search results, OMIT it. Never invent a placeholder.
5. MATCHUP PAIRING RULE: For sports, ALWAYS verify the exact matchup pairing (Team A vs Team B) as it appears in the official league schedule. NEVER merge or combine details from two different games into one row. Each row = one real game with its correct opponent.

NON-NEGOTIABLE: Search first, then answer. Never guess contacts. If a detail is not found, omit it.

============================================================
1) INTENT DETECTION & MASTERY LAYERS (CRITICAL)
============================================================
Detect the user's need and apply the corresponding "Brain":

A) PLACE / BUSINESS (The Concierge Brain):
Restaurants, cafes, malls, hotels, salons, shops, services, "near me".
→ Calculate travel distance and check for nearest Metro/Parking relative to ${locationContext}.
→ Write like a luxury travel critic. Focus on exclusivity, quality, and the 'vibe'.

B) LIVE DATA (The ESPN/Market Brain):
Sports scores, schedules, standings. Stocks, crypto, exchange rates. Airport / flights.
→ Cross-reference 3+ sources to ensure the score/price is accurate for today.
→ Always explain "The Stakes" — why this result matters.

C) RESEARCH (The Oxford Brain):
School project, history, science, how/why questions, "explain", "compare", "pros/cons".
→ Do not just list facts. Provide the "Strategic Nuance" — a scholarly debate or a rare historical perspective.

D) URL ANALYSIS (The Auditor Brain):
User provides a URL or asks to analyze a specific page.
→ Deep-read the provided URL. Identify the "Lead," the "Evidence," and the "Hidden Bias."

If ambiguous, choose the closest intent and proceed without asking questions unless necessary.

============================================================
2) ELITE INTRO (ALWAYS) + SMART WEATHER RULE
============================================================
Write 1–2 sentences maximum.
- Address ${userNick} naturally (if provided).
- Mention ONE real-time local detail based on location context (weather or a major local event).
- Do not overdo it. No long greetings.

SMART WEATHER / LOCAL DETAIL (IMPORTANT):
- For PLACE/BUSINESS and FLIGHTS/TRAVEL: try to include weather OR a major local event if you can confidently find it via search.
- For LIVE DATA (sports/stocks/crypto): do NOT force weather unless it directly affects the match, travel, or outcome.
- For RESEARCH/URL: do NOT force weather. Only add a local detail if it truly helps.
Never hallucinate weather/events. If not confidently found, skip it.

============================================================
3) OUTPUT FORMAT (MUST FOLLOW EXACTLY)
============================================================

-------------------------
INTENT A: PLACE / BUSINESS
-------------------------
Return 4–6 results max.

For EACH result use EXACTLY this structure:

## [Number]. [Name] ([Area])

[2–3 sentences max: what it is + why it's good + who it's for.
Include cuisine/type, price ($/$$/$$$), and rating if available.]

- **${language === 'ar' ? 'الأجواء' : 'Vibe'}:** [2–4 keywords]
- **${language === 'ar' ? 'جرّب' : 'Must Try'}:** [specific dish/service]
- **${language === 'ar' ? 'الذكاء' : 'Intelligence'}:** [Status (e.g., Open for another 2 hours / Closed Now) | Nearest Metro | Parking availability]
- **${language === 'ar' ? 'المعلومات' : 'Info'}:**
  - **${language === 'ar' ? 'الساعات' : 'Hours'}:** [hours or Open now/Closed] (omit if unknown)
  - **${language === 'ar' ? 'الهاتف' : 'Phone'}:** [+974xxxx](tel:+974xxxx) (omit if unknown)
  - **${language === 'ar' ? 'واتساب' : 'WhatsApp'}:** [Chat](https://wa.me/<digits>) (only if verified / explicitly listed as WhatsApp)
  - **${language === 'ar' ? 'البريد' : 'Email'}:** [name@domain.com](mailto:name@domain.com) (only if verified)
  - **${language === 'ar' ? 'الموقع' : 'Website'}:** [domain.com](https://domain.com) (only if verified)
  - **${language === 'ar' ? 'إنستغرام' : 'Instagram'}:** [@handle](https://instagram.com/handle) (only if verified)
  - **${language === 'ar' ? 'فيسبوك' : 'Facebook'}:** [Page](https://facebook.com/...) (only if verified)
  - **${language === 'ar' ? 'تيك توك' : 'TikTok'}:** [@handle](https://tiktok.com/@handle) (only if verified)
- 📍 **Google Maps:** [${language === 'ar' ? 'ابدأ التنقل' : 'Initiate Navigation'}](https://www.google.com/maps/search/?api=1&query=[URL-encoded name and location]${language === 'ar' ? '&hl=ar' : ''})

Rules for Info block:
- Do NOT put plain text phone numbers. Always use tel: links when phone is present.
- Do NOT mix social platforms. If you have Instagram, label it "Instagram". Same for WhatsApp.
- If you only have a handle (like @mallqatar) but no verified URL, still try to produce the correct platform URL ONLY if you're confident. Otherwise omit.
- Never invent emails, social, or WhatsApp.

STRICT VERIFICATION DEFINITION:
- "Verified" means the exact contact/link/handle appears in:
  1) Google Business/Maps panel data, OR
  2) the official website of the business, OR
  3) the official social profile page itself, OR
  4) a clearly authoritative directory listing that matches the business.
- If you can't verify, omit it.

WHATSAPP vs PHONE:
- If a number is labeled WhatsApp anywhere, put it under WhatsApp (wa.me) not Phone.
- If only a phone number is found and WhatsApp is not explicitly mentioned, list it only as Phone.

After the list, add:

---
💡 **${language === 'ar' ? 'نصيحة احترافية' : 'Pro Tip'}:** [One insider tip that is specific and useful: best time/day, reservation tip, parking tip, hidden menu item, best seating, etc.]

-------------------------
INTENT B: LIVE DATA (ESPN/MARKET BRAIN)
-------------------------
Use a dashboard layout. Be strict and compact.

## 📊 ${language === 'ar' ? 'لوحة تحديث حي' : 'Live Dashboard'}: [Topic]

[${language === 'ar' ? 'التوليف' : 'Synthesis'}: Connect today's result to the bigger picture/standings. Explain "The Stakes" — why this matters.]

| ${language === 'ar' ? 'العنصر' : 'Data Category'} | ${language === 'ar' ? 'النتيجة/الحالة' : 'Current Status'} | ${language === 'ar' ? 'الأثر/الرهانات' : 'The Stakes / Impact'} |
| :--- | :--- | :--- |
| [Item/Match/Ticker] | [Live Value/Score] | [Standings Impact / Trend / Gate Info] |

Rules:
- Use today's date/time in context.
- For sports: include next game + time if available. Explain standings impact.
- For stocks/crypto: include price + % change today if available. Note if it's a 52-week high/low.
- For flights: include terminal/gate/delay if available. Add weather at destination if relevant.
- Keep tables compact (max ~10 rows unless user asks for more).

TABLE FORMAT ENFORCEMENT (CRITICAL):
- You MUST output a VALID Markdown pipe table.
- You MUST include the required separator row (example: | --- | --- | --- |).
- Every row MUST have the exact same number of | columns as the header.
- NEVER output a pseudo-table using spaces/alignment. If you cannot produce a valid pipe table, do NOT output a table.
- Prevent merged headers (example: never output "PointsThe Stakes / Impact"). Ensure each header is a separate cell separated by |.
- Avoid hard line breaks inside table cells; keep each row on a single line.

*${language === 'ar' ? 'المصادر' : 'Sources'}: [Verified Source 1], [Verified Source 2]*

End with:
💡 **${language === 'ar' ? 'نصيحة احترافية' : 'Pro Tip'}:** [watching tip / trading caution / travel tip]

-------------------------
INTENT C: RESEARCH (OXFORD BRAIN)
-------------------------
Write like a smart teacher, but still clean and "premium".

## 🎯 ${language === 'ar' ? 'الملخص التنفيذي' : 'Executive Summary'}
[High-level scholarly overview of the subject.]

## 🔍 ${language === 'ar' ? 'التحليل الاستراتيجي' : 'Strategic Analysis'}
- **${language === 'ar' ? 'الجوهر' : 'The Core'}:** [The 80/20 summary — the most important facts]
- **${language === 'ar' ? 'النقاش' : 'The Debate'}:** [A high-level "Oxford-tier" perspective — show that historians/experts disagree, or provide a revisionist view that most basic searches miss]
- [Additional Point] — [Explanation]

If comparing: use a table.

## 💡 ${language === 'ar' ? 'رؤية وقتي' : 'THE WAKTI INSIGHT'}
[Provide one rare, scholarly fact or unique perspective that demonstrates deep intelligence — something a normal search wouldn't find.]

## 📚 ${language === 'ar' ? 'مصادر موثوقة' : 'High-Quality Sources'}
- [Source 1](url)
- [Source 2](url)
- [Source 3](url)

End with:
💡 **${language === 'ar' ? 'نصيحة احترافية' : 'Pro Tip'}:** [related topic or how to use this in a project/presentation + one bonus fact]

-------------------------
INTENT D: URL ANALYSIS (AUDITOR BRAIN)
-------------------------
Deep-read the provided URL. Identify the "Lead," the "Evidence," and the "Hidden Bias."
First summarize the URL content (not generic web results).
Then optionally add related verified context.

## 🧾 ${language === 'ar' ? 'ملخص الصفحة' : 'Summary of the Page'}
[Key takeaways — identify the "Lead" (main point)]

## 🔎 ${language === 'ar' ? 'الأدلة والنقاط المهمة' : 'What Matters / Key Evidence'}
- [Evidence 1]
- [Evidence 2]
- [Hidden detail most readers would miss]

## ⚖️ ${language === 'ar' ? 'ملاحظات الموثوقية والانحياز' : 'Bias / Reliability Notes'} (if relevant)
- [Is this a corporate landing page? News outlet? Academic source?]
- [Any potential bias or promotional tone?]

End with:
💡 **${language === 'ar' ? 'نصيحة احترافية' : 'Pro Tip'}:** [what to read next / how to verify claims]

============================================================
4) UNIVERSAL DOMINANCE RULES (DO NOT BREAK)
============================================================
- Never hallucinate contacts, emails, socials.
- If you can't verify, omit.
- Keep Place descriptions <= 3 sentences.
- 4–6 Place results max to avoid truncation.
- All links must be clickable markdown.
- Phone MUST be a tel: link if included.
- WhatsApp MUST be wa.me if included.
- Write entirely in the selected language.
- PROACTIVE LIFESTYLE: If a user searches for a flight, automatically find the weather at the destination. If they search a restaurant, mention if it's currently open/closed.
- DYNAMIC FORMATTING: Use \`---\` dividers and bold headers for a "UI-as-a-Product" feel.

ANTI-CUTOFF PRIORITY:
If you are running out of space, keep this order and drop the rest:
1) Name + Area + Description
2) Vibe + Must Try
3) Google Maps link
4) Hours + Phone
5) Website
6) WhatsApp + Email
7) Social links
8) Extra commentary / sources`;

            console.log('🔍 SEARCH: Streaming with Gemini 3 Flash + google_search...');
            
            let fullResponseText = '';
            let groundingMetadata: Gemini3SearchResult['groundingMetadata'] | null = null;

            // Prepare location for Maps grounding (for business queries)
            const userLocationForMaps = (searchIntent === 'business' && location?.latitude && location?.longitude) 
              ? { latitude: location.latitude, longitude: location.longitude }
              : null;

            // Stream tokens to client
            await streamGemini3WithSearch(
              message,
              searchSystemPrompt,
              { temperature: 0.3, maxOutputTokens: 6000 },
              recentMessages,
              (token: string) => {
                fullResponseText += token;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token, content: token })}\n\n`));
              },
              (meta: Gemini3SearchResult['groundingMetadata']) => {
                groundingMetadata = meta;
              },
              userLocationForMaps
            );

            // Emit grounding metadata for frontend citation injection
            if (groundingMetadata) {
              try {
                const gm = groundingMetadata as NonNullable<Gemini3SearchResult['groundingMetadata']>;
                const metaPayload = {
                  metadata: {
                    geminiSearch: {
                      queries: gm.webSearchQueries || [],
                      sources: (gm.groundingChunks || []).map((c: { web?: { uri: string; title: string } }) => ({
                        url: c.web?.uri || '',
                        title: c.web?.title || ''
                      })),
                      supports: gm.groundingSupports || []
                    }
                  }
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(metaPayload)}\n\n`));
              } catch { /* ignore */ }
            }

            // Log usage
            if (fullResponseText) {
              const inputTokens = estimateTokens(message);
              const outputTokens = estimateTokens(fullResponseText);
              logAIUsage({
                userId,
                functionName: 'brain_stream',
                model: 'gemini-3-flash-preview',
                status: 'success',
                prompt: message,
                response: fullResponseText.slice(0, 500),
                metadata: { trigger: 'search', provider: 'gemini-search', grounded: !!groundingMetadata },
                inputTokens,
                outputTokens,
                durationMs: Date.now() - startTime,
                costCredits: calculateCost('gemini-2.0-flash', inputTokens, outputTokens)
              });
            }

            if (!fullResponseText) {
              // Fallback message if no response
              const fallback = language === 'ar' ? 'لم أتمكن من العثور على نتائج.' : 'I could not find results for that query.';
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: fallback, content: fallback })}\n\n`));
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            return; // Exit early - search handled completely by Gemini

          } catch (e) {
            console.warn('⚠️ GEMINI SEARCH ERROR:', e);
            // Fallback: add user message and let normal flow handle it
            messages.push({ role: 'user', content: message });
          }
        } else {
          // ─── CHAT MODE: Always grounded with Gemini 2.5 Flash (smooth, no prompts) ───
          if (effectiveTrigger === 'chat' && chatSubmode === 'chat') {
            // ─── LOCATION FOLLOW-UP DETECTION ───
            // If assistant previously asked for location and user just replied with a place,
            // combine with the original intent and run a proper grounded search
            let effectiveMessage = message;
            try {
              // ─── YES/OK FOLLOW-UP RESOLVER (CHAT) ───
              // Users often reply with just "yes" to multi-option follow-ups.
              // In Chat mode, make "yes" mean: do BOTH options offered in the last assistant question.
              const rawUser = (message || '').trim();
              const rawUserLower = rawUser.toLowerCase();
              const isAffirmativeOnly = (() => {
                if (!rawUserLower) return false;
                // EN
                if (/^(yes|y|yeah|yep|sure|ok|okay|do it|go ahead|please)\b/.test(rawUserLower)) return true;
                // AR
                if (/^(نعم|اي|أيوه|ايوه|تمام|اوكي|حاضر|تفضل|يلا)\b/.test(rawUserLower)) return true;
                return false;
              })();

              if (isAffirmativeOnly && Array.isArray(recentMessages) && recentMessages.length > 0) {
                const lastAssistantRaw = getLastTextMessage(recentMessages, 'assistant');
                const getLastAssistantQuestion = (text: string): string => {
                  const t = (text || '').trim();
                  if (!t) return '';
                  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
                  for (let i = lines.length - 1; i >= 0; i -= 1) {
                    const line = lines[i];
                    if (line.endsWith('?')) return line.slice(0, 500);
                  }
                  const m = t.match(/([^\n\r]{10,500}\?)\s*$/);
                  return m ? m[1].slice(0, 500) : '';
                };
                const lastQ = getLastAssistantQuestion(lastAssistantRaw);
                if (lastQ) {
                  effectiveMessage = `User replied "${rawUser}" to your previous follow-up question.\n\nPrevious question: "${lastQ}"\n\nCRITICAL: The user said YES. Execute BOTH options offered in that question (A and B). If the question offered multiple actions, do all of them in a compact way. Then ask one short follow-up question.\n\nNow proceed.`;
                }
              }

              const lastAssistant = getLastTextMessage(recentMessages, 'assistant').toLowerCase();
              const askedForLocation = /\b(where|location|whereabouts|city|area|region)\b/i.test(lastAssistant) && /\?/.test(lastAssistant);
              
              if (askedForLocation) {
                // User likely replied with a location - find the original intent from earlier messages
                const userMsgs = (recentMessages as Array<{role?: string; content?: string}>)
                  .filter(m => m?.role === 'user' && m?.content)
                  .map(m => m.content || '');
                
                // Look for the original "near me" or location-based request (skip the current message)
                let originalIntent = '';
                for (let i = userMsgs.length - 2; i >= 0 && i >= userMsgs.length - 5; i--) {
                  const msg = userMsgs[i].toLowerCase();
                  if (/\b(near me|closest|nearest|find|looking for|where can i|recommend)\b/i.test(msg)) {
                    originalIntent = userMsgs[i];
                    break;
                  }
                }
                
                if (originalIntent) {
                  // Combine: "Find the closest coffee shop" + "Al Khor Qatar" → "Find the closest coffee shop near Al Khor, Qatar"
                  const locationReply = message.trim();
                  effectiveMessage = `${originalIntent.replace(/\b(near me|around me|close to me)\b/gi, '')} near ${locationReply}`.trim();
                  console.log(`📍 LOCATION FOLLOW-UP: Combined "${originalIntent}" + "${locationReply}" → "${effectiveMessage}"`);
                }
              }
            } catch (err) {
              console.warn('⚠️ Location follow-up detection error:', err);
            }

            try {
              let fullResponseText = '';
              await streamGemini25FlashGrounded(
                effectiveMessage,
                systemPrompt,
                recentMessages,
                (token: string) => {
                  fullResponseText += token;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token, content: token })}\n\n`));
                }
              );

              if (!fullResponseText) {
                const fallback = language === 'ar' ? 'لم أتمكن من الرد.' : 'I could not generate a response.';
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: fallback, content: fallback })}\n\n`));
              }

              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              return;
            } catch (e) {
              console.warn('⚠️ CHAT GROUNDED ERROR:', e);
              // Fallback to normal chat flow below
            }
          }

          // Emit Study mode metadata so frontend can show 📚 Study badge (even without Wolfram)
          if (chatSubmode === 'study') {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata: { studyMode: true } })}\n\n`));
            } catch {}
          }

          // Study mode ALWAYS tries Wolfram; Chat mode for academic/math/science queries
          let wolframContext = '';
          let fullResultsData = '';
          let summaryBoxData = '';
          let wolframMetaBase: Record<string, unknown> | null = null;
          const useWolfram = chatSubmode === 'study' || isWolframQuery(message);
          const useSummaryBox = isSummaryBoxQuery(message);
          
          // For academic queries: run BOTH APIs in parallel for maximum knowledge
          if (useWolfram) {
            console.log(`🔢 WOLFRAM: ${chatSubmode === 'study' ? 'Study mode' : 'Academic query'} - querying BOTH APIs in parallel...`);
            
            // Send keepalive ping to prevent connection timeout during Wolfram calls
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ keepalive: true, stage: 'wolfram' })}\n\n`));
            } catch { /* connection may be closed */ }
            
            // Run both APIs in parallel for speed
            // Study mode needs longer timeout (8s) since Wolfram is the primary source
            const summaryBoxInput = normalizeSummaryBoxQuery(message);
            const [fullResultsResult, summaryBoxResult] = await Promise.all([
              queryWolfram(message, chatSubmode === 'study' ? 8000 : 4000),
              useSummaryBox ? queryWolframSummaryBox(summaryBoxInput, 5000) : Promise.resolve<SummaryBoxResult>({ success: false })
            ]);
            
            // Process Full Results API response
            if (fullResultsResult.success && fullResultsResult.answer) {
              const wolfResult = fullResultsResult;
              console.log('✅ WOLFRAM FULL: Got answer');
              
              // Emit metadata for Full Results
              wolframMetaBase = {
                answer: wolfResult.answer,
                interpretation: wolfResult.interpretation || null,
                steps: wolfResult.steps || [],
                mode: chatSubmode,
                api: 'full_results'
              };
              try {
                const wolfMeta = {
                  metadata: {
                    wolfram: wolframMetaBase
                  }
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(wolfMeta)}\n\n`));
              } catch { /* ignore */ }
              
              // Build Full Results context
              if (chatSubmode === 'study') {
                fullResultsData = language === 'ar'
                  ? `[بيانات موثقة - Full Results]\nالسؤال: ${wolfResult.interpretation || message}\nالإجابة: ${wolfResult.answer}${wolfResult.steps?.length ? '\nالخطوات: ' + wolfResult.steps.join(' → ') : ''}`
                  : `[Verified Data - Full Results]\nQuestion: ${wolfResult.interpretation || message}\nAnswer: ${wolfResult.answer}${wolfResult.steps?.length ? '\nSteps: ' + wolfResult.steps.join(' → ') : ''}`;
              } else {
                fullResultsData = language === 'ar'
                  ? `[حقيقة موثقة: ${wolfResult.answer}]`
                  : `[Verified fact: ${wolfResult.answer}]`;
              }
              wolframUsedOuter = true;
            } else {
              console.log('⚠️ WOLFRAM FULL: No result');
            }
            
            // Process Summary Boxes API response
            if (summaryBoxResult.success && summaryBoxResult.summary) {
              const summaryResult = summaryBoxResult;
              const summaryText = summaryResult.summary || '';
              console.log('✅ WOLFRAM SUMMARY: Got summary (domain:', summaryResult.domain, ')');
              
              // Emit metadata with Summary Box appended (preserve full-results fields if present)
              try {
                const summaryMeta = {
                  metadata: {
                    wolfram: {
                      ...(wolframMetaBase || {
                        answer: summaryText.substring(0, 500),
                        mode: chatSubmode,
                        api: 'summary_boxes'
                      }),
                      summaryBox: summaryText.substring(0, 1200),
                      summaryDomain: summaryResult.domain || null,
                      api: wolframMetaBase ? 'full_results+summary_boxes' : 'summary_boxes'
                    }
                  }
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(summaryMeta)}\n\n`));
              } catch { /* ignore */ }
              
              // Build Summary Box context
              summaryBoxData = language === 'ar'
                ? `[معلومات إضافية عن ${summaryResult.domain || 'الموضوع'}]\n${summaryText.substring(0, 800)}`
                : `[Additional info about ${summaryResult.domain || 'topic'}]\n${summaryText.substring(0, 800)}`;
              wolframUsedOuter = true;
            } else if (useSummaryBox) {
              console.log('⚠️ WOLFRAM SUMMARY: No summary box');
            }
            
            // Combine both results into context
            if (fullResultsData || summaryBoxData) {
              const combinedParts: string[] = [];
              if (fullResultsData) combinedParts.push(fullResultsData);
              if (summaryBoxData) combinedParts.push(summaryBoxData);
              
              const instruction = chatSubmode === 'study'
                ? (language === 'ar' 
                    ? '\n\nاستخدم هذه البيانات لشرح الإجابة بطريقة تعليمية واضحة. اعرض الإجابة أولاً ثم الشرح.'
                    : '\n\nUse this data to explain the answer in a clear, educational way. Present the answer first, then explain.')
                : (language === 'ar'
                    ? '\n\nاستخدم هذه المعلومات في إجابتك بشكل طبيعي.'
                    : '\n\nUse this information naturally in your response.');
              
              wolframContext = combinedParts.join('\n\n') + instruction;
              console.log('✅ WOLFRAM: Combined context from', combinedParts.length, 'API(s)');
            } else {
              console.log('⚠️ WOLFRAM: No data from either API, AI will handle alone');
            }
          }

          // Build final user message
          if (wolframContext) {
            messages.push({ role: 'user', content: `${wolframContext}\n\nUser question: ${message}` });
          } else {
            messages.push({ role: 'user', content: message });
          }
        }

        let aiProvider = 'none';
        let streamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        let modelUsed = '';
        let responseText = ''; // Track full response for token estimation

        // Send keepalive ping before AI model calls to prevent connection timeout
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ keepalive: true, stage: 'ai_init' })}\n\n`));
        } catch { /* connection may be closed */ }

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
          modelUsed = 'gemini-2.0-flash';
          modelUsedOuter = modelUsed;
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ providerUsed: 'gemini' })}\n\n`)); } catch { /* ignore */ }
          
          let geminiTokenCount = 0;
          await streamGemini(
            'gemini-2.0-flash',
            contents,
            (token) => {
              geminiTokenCount++;
              responseText += token; // Track response for token estimation
              try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token, content: token })}\n\n`)); } catch { /* ignore */ }
            },
            sysMsg,
            { temperature: effectiveTrigger === 'search' ? 0.3 : 0.7, maxOutputTokens: effectiveTrigger === 'search' ? 6000 : 8000 }
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
              temperature: effectiveTrigger === 'search' ? 0.3 : 0.7,
              max_tokens: effectiveTrigger === 'search' ? 6000 : 8000,
              stream: true,
            }),
          });
          if (!response.ok) throw new Error(`OpenAI failed: ${response.status}`);
          
          aiProvider = 'openai';
          modelUsed = 'gpt-4o-mini';
          modelUsedOuter = modelUsed;
          streamReader = response.body?.getReader() || null;
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ providerUsed: 'openai' })}\n\n`)); } catch { /* ignore */ }
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
              max_tokens: activeTrigger === 'search' ? 6000 : 8000,
              stream: true,
            }),
          });
          if (!response.ok) throw new Error(`Claude failed: ${response.status}`);
          
          aiProvider = 'claude';
          modelUsed = 'claude-3-5-sonnet-20241022';
          modelUsedOuter = modelUsed;
          streamReader = response.body?.getReader() || null;
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ providerUsed: 'claude' })}\n\n`)); } catch { /* ignore */ }
          console.log('✅ Claude');
        };

        try {
          try {
            await tryGemini();
          } catch (errGemini) {
            const errMsg = errGemini instanceof Error ? errGemini.message : String(errGemini);
            console.warn('⚠️ Gemini failed, trying OpenAI...', errMsg);
            try {
              await tryOpenAI();
            } catch (errOpenAI) {
              const errMsg2 = errOpenAI instanceof Error ? errOpenAI.message : String(errOpenAI);
              console.warn('⚠️ OpenAI failed, trying Claude...', errMsg2);
              await tryClaude();
            }
          }
        } catch (finalErr) {
          const errMsg = finalErr instanceof Error ? finalErr.message : String(finalErr);
          console.error('❌ All providers failed', errMsg);
          throw finalErr;
        }

        if (aiProvider === 'gemini') {
          // Log successful Gemini usage with token estimation
          const inputTokens = estimateTokens(requestMessage);
          const outputTokens = estimateTokens(responseText);
          const cost = calculateCost(modelUsed, inputTokens, outputTokens);
          
          logAIUsage({
            userId,
            functionName: 'brain_stream',
            model: modelUsed,
            status: 'success',
            prompt: requestMessage,
            response: responseText.slice(0, 500), // First 500 chars for reference
            metadata: { 
              trigger: requestTrigger, 
              submode: requestSubmode, 
              provider: aiProvider, 
              wolfram_used: wolframUsedOuter,
              tavily_used: tavilyUsedOuter,
              tavily_results: tavilyResultsCountOuter
            },
            inputTokens,
            outputTokens,
            durationMs: Date.now() - startTime,
            costCredits: cost
          });
          try { controller.close(); } catch { /* ignore */ }
          return;
        }
        if (!streamReader) throw new Error('No stream reader available');

        if (aiProvider === 'openai') {
          const sr = streamReader as ReadableStreamDefaultReader<Uint8Array>;
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { done, value } = await sr.read();
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
                    responseText += content; // Track response for token estimation
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: content, content })}\n\n`));
                  }
                } catch { /* ignore */ }
              }
            }
          }
        } else if (aiProvider === 'claude') {
          const claudeResponse = await streamClaudeResponse(streamReader, controller, encoder);
          responseText = claudeResponse; // Capture Claude response for token estimation
        }

        // Log successful OpenAI/Claude usage with token estimation
        const inputTokens = estimateTokens(requestMessage);
        const outputTokens = estimateTokens(responseText);
        const cost = calculateCost(modelUsed, inputTokens, outputTokens);
        
        logAIUsage({
          userId,
          functionName: 'brain_stream',
          model: modelUsed,
          status: 'success',
          prompt: requestMessage,
          response: responseText.slice(0, 500), // First 500 chars for reference
          metadata: { 
            trigger: requestTrigger, 
            submode: requestSubmode, 
            provider: aiProvider, 
            wolfram_used: wolframUsedOuter,
            tavily_used: tavilyUsedOuter,
            tavily_results: tavilyResultsCountOuter
          },
          inputTokens,
          outputTokens,
          durationMs: Date.now() - startTime,
          costCredits: cost
        });

        controller.close();
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('🔥 ERROR:', errMsg);
        
        // Log failed AI usage (no tokens/cost on error)
        logAIUsage({
          userId,
          functionName: 'brain_stream',
          model: modelUsedOuter || 'unknown',
          status: 'error',
          errorMessage: errMsg,
          prompt: requestMessage,
          metadata: { 
            trigger: requestTrigger, 
            submode: requestSubmode, 
            wolfram_used: wolframUsedOuter,
            tavily_used: tavilyUsedOuter,
            tavily_results: tavilyResultsCountOuter
          },
          durationMs: Date.now() - startTime
        });
        
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
