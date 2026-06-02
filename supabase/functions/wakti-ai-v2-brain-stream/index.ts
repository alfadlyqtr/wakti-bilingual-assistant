import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { buildTrialErrorPayload, buildTrialSuccessPayload, checkAndConsumeTrialTokenOnce, checkTrialAccess } from "../_shared/trial-tracker.ts";

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
const WOLFRAM_APP_ID = Deno.env.get('WOLFRAM_APP_ID') || '';
// Query Recognizer / Summary Box / LLM API all use the SAME commercial AppID.
// Controlled entirely by the Supabase secret ΓÇö no hardcoded fallbacks.
const WOLFRAM_LLM_APP_ID = Deno.env.get('WOLFRAM_LLM_APP_ID') || WOLFRAM_APP_ID;
const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
// Dedicated server-side key for the Google Places API (Text Search + Details + Photos).
// Uses the GOOGLE_PLACES secret; falls back to GOOGLE_MAPS_API_KEY if unset.
const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES') || GOOGLE_MAPS_API_KEY;
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

function checkAiChatTrialAccess(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  userId: string,
) {
  return checkTrialAccess(supabaseClient, userId, 'ai_chat', 15);
}

function consumeAiChatTrialSuccess(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  userId: string,
  onceKey: string,
) {
  return checkAndConsumeTrialTokenOnce(supabaseClient, userId, 'ai_chat', 15, onceKey);
}

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

function normalizeContinuityText(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') return '';
  return input.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function buildStayHotSummary(recentMessages: unknown[]): string {
  try {
    if (!Array.isArray(recentMessages) || recentMessages.length === 0) return '';
    const msgs = recentMessages
      .filter((m) => m && typeof m === 'object')
      .slice(-8)
      .map((m) => m as Record<string, unknown>);

    const texts: Array<{ role: string; content: string; idx: number }> = [];
    let idx = 0;
    for (const m of msgs) {
      const role = typeof m.role === 'string' ? m.role : '';
      const content = typeof m.content === 'string' ? m.content : '';
      if (!content) continue;
      if (role !== 'user' && role !== 'assistant') continue;
      texts.push({ role, content: content.slice(0, 280), idx: idx++ });
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
    for (let i = 0; i < Math.min(userMsgs.length, 3); i++) {
      const msg = userMsgs[userMsgs.length - 1 - i];
      if (msg && msg.content.length > 4) recentUserRequests.push(msg.content.slice(0, 140));
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

    const lastAssistant = [...texts].reverse().find((t) => t.role === 'assistant')?.content || '';
    let currentTopic = 'General conversation';
    let userGoal = 'Not specified';
    
    if (lastUser) {
      if (/\b(remind|reminder|alert|notify|calendar|schedule|╪¬╪░┘â┘è╪▒|╪░┘â╪▒┘å┘è|╪░┘â┘æ╪▒┘å┘è|┘å╪¿┘ç┘å┘è|┘å╪¿┘ç┘å┘è)\b/i.test(lastUserLower)) {
        currentTopic = 'Reminder & Scheduling';
        userGoal = 'Set, review, or manage a reminder';
      } else if (/\b(search|find|look up|google|near me|nearest|closest)\b/i.test(lastUserLower)) {
        currentTopic = 'Search & Discovery';
        userGoal = 'Find specific, relevant information quickly';
      } else if (/\b(image|photo|document|resume|cv|certificate|id|passport|invoice|receipt)\b/i.test(lastUserLower)) {
        currentTopic = 'Image/Document Analysis';
        userGoal = 'Analyze or extract information from an uploaded file';
      } else if (/\b(explain|learn|understand|study|teach|what is|how does|compare|pros and cons)\b/i.test(lastUserLower)) {
        currentTopic = 'Learning & Research';
        userGoal = 'Understand a concept clearly';
      } else if (/\b(create|generate|write|design|build|make)\b/i.test(lastUserLower)) {
        currentTopic = 'Content Creation';
        userGoal = 'Create or generate something useful';
      } else if (/\b(fix|debug|error|problem|issue|help)\b/i.test(lastUserLower)) {
        currentTopic = 'Problem Solving';
        userGoal = 'Resolve a problem or unblock progress';
      }
    }

    if (currentTopic === 'General conversation' && lastAssistant) {
      const assistLower = lastAssistant.toLowerCase();
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
    lines.push('≡ƒÄ» CURRENT CONVERSATION TOPIC (CRITICAL - USE THIS FOR CONTEXT)');
    lines.push(`- TOPIC: ${currentTopic}`);
    lines.push(`- USER GOAL: ${userGoal}`);
    if (lastUser.length > 0) {
      lines.push(`- LAST USER MESSAGE: ${lastUser.slice(0, 140)}`);
    }

    lines.push('USER INTENT (BEST GUESS)');
    lines.push(`- [User Intent: ${intent}]`);

    lines.push('FACTS THE USER STATED (HIGH VALUE)');
    if (facts.length > 0) lines.push(`- ${facts.slice(0, 4).join('\n- ')}`);
    else if (locationLine) lines.push(`- ${locationLine}`);
    else lines.push('- [None]');

    const keyEntitiesOut = [...bracketedEntities];
    for (const c of topCaps) keyEntitiesOut.push(`[Entity: ${c}]`);
    if (keyEntitiesOut.length > 0 || topKeywords.length > 0) {
      lines.push('KEY ENTITIES / KEYWORDS');
      if (keyEntitiesOut.length > 0) lines.push(`- ${keyEntitiesOut.slice(0, 6).join('\n- ')}`);
      if (topKeywords.length > 0) lines.push(`- Keywords: ${topKeywords.slice(0, 5).join(', ')}`);
    }

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

function normalizeEmail(rawValue: unknown): string {
  const normalized = toTrimmedString(rawValue).replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized) ? normalized : '';
}

function buildContinuityContext(options: {
  conversationSummary?: string;
  stayHotSummary?: string;
  locationContext?: string;
  includeLocation?: boolean;
}): string {
  const parts: string[] = [];
  const conversationSummary = normalizeContinuityText(options.conversationSummary, 700);
  const stayHotSummary = normalizeContinuityText(options.stayHotSummary, 900);
  const locationContext = normalizeContinuityText(options.locationContext, 220);

  if (conversationSummary) {
    parts.push(`EARLIER CONVERSATION SUMMARY:\n${conversationSummary}`);
  }
  if (stayHotSummary) {
    parts.push(stayHotSummary);
  }
  if (options.includeLocation && locationContext) {
    parts.push(locationContext);
  }

  return parts.join('\n\n').trim();
}

type DurableMemoryType = 'identity_context' | 'project_context' | 'recurring_goal' | 'working_style' | 'priority';
type DurableMemoryLayer = 'always_use' | 'routine' | 'project' | 'candidate';
type DurableMemorySensitivity = 'normal' | 'careful';
type DurableMemoryAction = 'remember' | 'forget';

type DurableMemoryItem = {
  key: string;
  type: DurableMemoryType;
  layer?: DurableMemoryLayer;
  sensitivity?: DurableMemorySensitivity;
  action?: DurableMemoryAction;
  text: string;
  confidence: 'high' | 'medium';
  evidenceCount: number;
  keywords: string[];
  source: 'conversation';
};

type HelpfulMemorySettings = {
  helpful_memory_enabled: boolean;
  capture_paused: boolean;
};

type HelpfulMemoryItem = {
  id: string;
  scope: 'all_chats' | 'this_chat';
  conversation_id: string | null;
  category: 'preference' | 'project' | 'goal' | 'saved_context';
  layer?: DurableMemoryLayer;
  memory_text: string;
  source: 'user_added' | 'auto_saved' | 'user_confirmed' | 'conversation';
  status: 'active' | 'disabled' | 'deleted' | 'replaced';
  sensitivity: 'normal' | 'careful';
  confidence: 'high' | 'medium';
  evidence_count: number;
  keywords: string[];
};

// Defense-in-depth: never store financial, children's private info, or credentials
// even if a stale client forgot to filter them. Allergies and religion are allowed per product rules.
function isForbiddenMemoryContent(text: string): boolean {
  if (!text) return true;
  const forbidden = [
    /\b(bank|iban|swift|account\s+number|credit\s+card|debit\s+card|cvv|pin\s+code|password|otp|salary|income|debt|loan|mortgage|net\s+worth|paycheck|wage)\b/i,
    /╪¿┘å┘â|╪ó┘è╪¿╪º┘å|╪¡╪│╪º╪¿\s+╪▒┘é┘à|╪¿╪╖╪º┘é╪⌐\s+╪º╪ª╪¬┘à╪º┘å|┘â┘ä┘à╪⌐\s+╪º┘ä╪│╪▒|╪▒┘é┘à\s+╪│╪▒┘è|╪▒╪º╪¬╪¿|╪»╪«┘ä|╪»┘è┘å|┘é╪▒╪╢/,
    /\bmy\s+(son|daughter|kid|child)\s+(?:is\s+\d|goes\s+to|attends|studies\s+at)/i
  ];
  return forbidden.some((p) => p.test(text));
}

function resolveMemoryLayer(item: Pick<DurableMemoryItem, 'layer' | 'type' | 'text'>): DurableMemoryLayer {
  if (item.layer && ['always_use', 'routine', 'project', 'candidate'].includes(item.layer)) return item.layer;
  if (item.type === 'project_context') return 'project';
  if (item.type === 'recurring_goal' && /^\s*every\b/i.test(item.text || '')) return 'routine';
  return 'always_use';
}

function categoryForLayer(layer: DurableMemoryLayer, type: DurableMemoryType): HelpfulMemoryItem['category'] {
  if (layer === 'project') return 'project';
  if (layer === 'routine') return 'goal';
  if (type === 'working_style') return 'preference';
  if (type === 'priority') return 'goal';
  if (type === 'project_context') return 'project';
  if (type === 'recurring_goal') return 'goal';
  return 'saved_context';
}

function normalizeHelpfulMemoryText(input: unknown, maxLength = 180): string {
  return normalizeContinuityText(input, maxLength);
}

function extractHelpfulMemoryKeywords(...inputs: string[]): string[] {
  const stopwords = new Set([
    'about', 'after', 'again', 'being', 'could', 'doing', 'from', 'have', 'just', 'like', 'make', 'more', 'need',
    'only', 'really', 'should', 'that', 'their', 'them', 'then', 'they', 'this', 'want', 'with', 'would', 'your',
    'there', 'while', 'into', 'over', 'under', 'plain', 'english', 'stage', 'stages', 'audit', 'report'
  ]);

  return Array.from(new Set(
    inputs
      .join(' ')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((word) => word.trim())
      .filter((word) => word.length >= 4 && !stopwords.has(word))
  )).slice(0, 8);
}

function classifyHelpfulMemorySensitivity(text: string): 'normal' | 'careful' {
  const value = normalizeHelpfulMemoryText(text, 220).toLowerCase();
  if (!value) return 'normal';
  if (/\bwife\b|\bhusband\b|\bson\b|\bdaughter\b|\bfamily\b|\bhealth\b|\bmedical\b|\bdoctor\b|\bbank\b|\bsalary\b|\bdebt\b|\bprayer\b|\breligion\b|╪▓┘ê╪¼╪¬┘è|╪▓┘ê╪¼┘è|╪ú╪╖┘ü╪º┘ä┘è|╪╣╪º╪ª┘ä╪¬┘è|╪╡╪¡╪¬┘è|╪╖╪¿┘è╪¿|╪▒╪º╪¬╪¿|╪»┘è┘å|╪╡┘ä╪º╪⌐|╪»┘è┘å/i.test(value)) {
    return 'careful';
  }
  return 'normal';
}

function normalizeHelpfulMemoryItems(input: unknown): HelpfulMemoryItem[] {
  if (!Array.isArray(input)) return [];
  const out: HelpfulMemoryItem[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const id = normalizeHelpfulMemoryText(item.id, 64);
    const scope = item.scope === 'this_chat' ? 'this_chat' : 'all_chats';
    const category = item.category === 'project' || item.category === 'goal' || item.category === 'saved_context'
      ? item.category
      : 'preference';
    const layer = item.layer === 'routine' || item.layer === 'project' || item.layer === 'candidate' || item.layer === 'always_use'
      ? item.layer as DurableMemoryLayer
      : undefined;
    const memory_text = normalizeHelpfulMemoryText(item.memory_text, 180);
    const source = item.source === 'auto_saved' || item.source === 'user_confirmed' || item.source === 'conversation'
      ? item.source
      : 'user_added';
    const status = item.status === 'disabled' || item.status === 'deleted' || item.status === 'replaced'
      ? item.status
      : 'active';
    const confidence = item.confidence === 'high' ? 'high' : 'medium';
    const evidence_count = typeof item.evidence_count === 'number'
      ? Math.max(1, Math.min(8, Math.round(item.evidence_count)))
      : 1;
    const conversation_id = typeof item.conversation_id === 'string' && item.conversation_id.trim()
      ? item.conversation_id.trim().slice(0, 120)
      : null;
    const sensitivity = item.sensitivity === 'careful' ? 'careful' : classifyHelpfulMemorySensitivity(memory_text);
    const keywords = Array.isArray(item.keywords)
      ? item.keywords
          .filter((value) => typeof value === 'string')
          .map((value) => normalizeHelpfulMemoryText(value, 24).toLowerCase())
          .filter(Boolean)
          .slice(0, 8)
      : extractHelpfulMemoryKeywords(memory_text, category, scope);

    if (!id || !memory_text) continue;

    out.push({
      id,
      scope,
      conversation_id,
      category,
      layer,
      memory_text,
      source,
      status,
      sensitivity,
      confidence,
      evidence_count,
      keywords
    });
  }

  return out.slice(0, 50);
}

function scoreHelpfulMemoryRelevance(
  item: HelpfulMemoryItem,
  message: string,
  activeTrigger: string,
  chatSubmode: string
): number {
  const query = normalizeHelpfulMemoryText(message, 240).toLowerCase();
  let score = item.evidence_count * 10 + (item.confidence === 'high' ? 8 : 3);
  const overlaps = item.keywords.filter((keyword) => query.includes(keyword)).length;
  score += overlaps * 12;

  if (item.category === 'project' && /project|product|build|feature|chat|wakti|prompt|memory|route|routing|app/i.test(query)) score += 10;
  if (item.category === 'goal' && /goal|need|improve|fix|better|solve|reliable|quality|speed|fast|performance/i.test(query)) score += 9;
  if (item.category === 'preference' && /explain|plan|audit|report|stage|help|walk me through|style|prefer/i.test(query)) score += 8;
  if (item.category === 'saved_context' && /remember|context|card|gift|study|thread|this chat/i.test(query)) score += 7;
  if (item.scope === 'this_chat') score += 5;
  // Layer-aware boosts
  if (item.layer === 'routine' && /every|weekly|monday|tuesday|wednesday|thursday|friday|saturday|sunday|each|always|usually|flower|gift|card/i.test(query)) score += 10;
  if (item.layer === 'project') score += 4;
  if (item.layer === 'always_use') score += 2;
  if (chatSubmode === 'study' && item.category === 'project') score -= 4;

  return score;
}

function selectRelevantHelpfulMemory(
  items: HelpfulMemoryItem[],
  message: string,
  activeTrigger: string,
  chatSubmode: string
): HelpfulMemoryItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const limit = activeTrigger === 'search' ? 4 : 3;

  return [...items]
    .map((item) => ({ item, score: scoreHelpfulMemoryRelevance(item, message, activeTrigger, chatSubmode) }))
    .filter((entry) => entry.score >= 16)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

// Build adaptive memory posture block based on Personal Touch Tone + Style.
// This modulates HOW aggressively the AI surfaces Helpful Memory so users who
// prefer short/neutral answers don't feel memory is being forced into every turn,
// while users who prefer detailed/engaging answers get richer contextual weaving.
function buildMemoryPostureBlock(personalTouch: unknown): string {
  const pt = (personalTouch || {}) as Record<string, unknown>;
  const toneRaw = typeof pt.tone === 'string' ? pt.tone.toLowerCase().trim() : '';
  const styleRaw = typeof pt.style === 'string' ? pt.style.toLowerCase().trim() : '';

  // Style ΓåÆ surfacing frequency
  let styleLine = '';
  if (styleRaw.includes('short')) {
    styleLine = 'Style=Short answers ΓåÆ surface memory ONLY when directly asked or absolutely essential. Never preempt.';
  } else if (styleRaw.includes('detail')) {
    styleLine = 'Style=Detailed ΓåÆ you MAY connect relevant memory facts that genuinely enrich the answer, kept natural.';
  } else if (styleRaw.includes('analy')) {
    styleLine = 'Style=Analytical ΓåÆ use memory as reasoning context where it applies to the user\'s question.';
  } else if (styleRaw.includes('convers')) {
    styleLine = 'Style=Conversational ΓåÆ reference memory only when it genuinely improves flow. Light touch.';
  } else {
    styleLine = 'Style=Default ΓåÆ reference memory sparingly and only when it clearly improves the answer.';
  }

  // Tone ΓåÆ phrasing style
  let toneLine = '';
  if (toneRaw.includes('funny') || toneRaw.includes('playful') || toneRaw.includes('humor')) {
    toneLine = 'Tone=Funny ΓåÆ you may reference memory playfully and briefly, never labored.';
  } else if (toneRaw.includes('serious')) {
    toneLine = 'Tone=Serious ΓåÆ professional reference only when topically relevant. No asides.';
  } else if (toneRaw.includes('casual')) {
    toneLine = 'Tone=Casual ΓåÆ natural woven mention when appropriate (e.g., "since you\'re in Alkhor...").';
  } else if (toneRaw.includes('encourag') || toneRaw.includes('supportive')) {
    toneLine = 'Tone=Encouraging ΓåÆ reference goals/routines supportively only when motivating the user.';
  } else if (toneRaw.includes('engag')) {
    toneLine = 'Tone=Engaging ΓåÆ weave memory naturally when it makes the reply more alive.';
  } else {
    toneLine = 'Tone=Neutral ΓåÆ use plain, unembellished phrasing when you do reference memory.';
  }

  return [
    'YOUR MEMORY POSTURE (based on user preferences):',
    `- ${styleLine}`,
    `- ${toneLine}`
  ].join('\n');
}

function buildPromptMemoryContext(lines: string[], personalTouch?: unknown): string {
  const normalizedLines = Array.from(new Set(
    lines
      .map((line) => normalizeHelpfulMemoryText(line, 180))
      .filter(Boolean)
  )).slice(0, 6);

  if (normalizedLines.length === 0) return '';

  const postureBlock = buildMemoryPostureBlock(personalTouch);

  return [
    'HELPFUL MEMORY (reference only when genuinely relevant; never overrides the current request):',
    ...normalizedLines.map((line) => `- ${line}`),
    '',
    postureBlock,
    '',
    'HARD RULES (NON-NEGOTIABLE ΓÇö apply regardless of posture):',
    '- NEVER inject memory into greetings ("hey", "hi", "good morning", "╪º┘ä╪│┘ä╪º┘à ╪╣┘ä┘è┘â┘à", "╪╡╪¿╪º╪¡ ╪º┘ä╪«┘è╪▒") ΓÇö just greet back.',
    '- NEVER inject memory into pure creative requests (poems, stories, duas, love notes, images, translations) unless the user explicitly connects the memory to the request.',
    '- NEVER open a response with a memory-derived factoid unless the user asked about that fact.',
    '- A memory is RELEVANT only if removing it would leave the answer incomplete. If the answer works fine without it, LEAVE IT OUT.',
    '- If asked "what do you remember about me?" / "┘à╪º╪░╪º ╪¬╪¬╪░┘â╪▒ ╪╣┘å┘è╪ƒ", list the items above plainly and mention the Helpful Memory panel for edits.',
    '- If the user says they no longer do X / forget X / ┘ä┘à ╪ú╪╣╪» / ╪º┘å╪│┘ë: just acknowledge briefly ("Done, I\'ve forgotten that." / "╪¬┘à┘æ╪î ┘å╪│┘è╪¬┘ç╪º."). Do NOT ask for confirmation and do NOT tell them to open a panel ΓÇö the system removes the matching memory automatically.',
    '- Never invent a memory that is not listed above.',
    '- Routines tied to a specific day/season ("Every Thursday...", "During Ramadan...") ΓÇö act on them only when today actually matches AND the user\'s current message is about that routine; otherwise leave them unmentioned.'
  ].join('\n').trim();
}

function buildCombinedHelpfulMemoryContext(
  helpfulMemoryItems: HelpfulMemoryItem[],
  durableMemoryItems: DurableMemoryItem[],
  personalTouch?: unknown
): string {
  const lines = [
    ...helpfulMemoryItems.map((item) => item.memory_text),
    ...durableMemoryItems.map((item) => item.text)
  ];
  return buildPromptMemoryContext(lines, personalTouch);
}

async function getHelpfulMemorySettings(
  supabaseAdmin: any,
  userId?: string
): Promise<HelpfulMemorySettings> {
  if (!userId) return { helpful_memory_enabled: false, capture_paused: false };

  try {
    const { data, error } = await supabaseAdmin
      .from('user_helpful_memory_settings')
      .select('helpful_memory_enabled, capture_paused')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('helpful memory settings fetch failed', error);
      return { helpful_memory_enabled: true, capture_paused: false };
    }

    return {
      helpful_memory_enabled: data?.helpful_memory_enabled !== false,
      capture_paused: data?.capture_paused === true,
    };
  } catch (error) {
    console.warn('helpful memory settings exception', error);
    return { helpful_memory_enabled: true, capture_paused: false };
  }
}

async function fetchHelpfulMemoryItems(
  supabaseAdmin: any,
  userId: string,
  conversationId: string | null
): Promise<HelpfulMemoryItem[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_helpful_memory')
      .select('id, scope, conversation_id, category, layer, memory_text, source, status, sensitivity, confidence, evidence_count, keywords')
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('layer', 'candidate')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('helpful memory fetch failed', error);
      return [];
    }

    return normalizeHelpfulMemoryItems(data).filter((item) => item.scope === 'all_chats' || (!!conversationId && item.conversation_id === conversationId));
  } catch (error) {
    console.warn('helpful memory fetch exception', error);
    return [];
  }
}

async function touchHelpfulMemoryItems(
  supabaseAdmin: any,
  ids: string[]
): Promise<void> {
  const safeIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 6);
  if (safeIds.length === 0) return;

  try {
    const now = new Date().toISOString();
    await supabaseAdmin
      .from('user_helpful_memory')
      .update({ last_used_at: now, last_injected_at: now, updated_at: now })
      .in('id', safeIds);
  } catch (error) {
    console.warn('helpful memory touch failed', error);
  }
}

async function upsertAutoHelpfulMemory(
  supabaseAdmin: any,
  userId: string,
  durableMemoryItems: DurableMemoryItem[]
): Promise<void> {
  if (!Array.isArray(durableMemoryItems) || durableMemoryItems.length === 0) return;

  for (const item of durableMemoryItems.slice(0, 6)) {
    const memoryText = normalizeHelpfulMemoryText(item.text, 180);
    if (!memoryText) continue;
    // Defense-in-depth: never save forbidden content (financial, children's private info, credentials)
    if (isForbiddenMemoryContent(memoryText)) continue;

    const resolvedLayer = resolveMemoryLayer({ layer: item.layer, type: item.type, text: memoryText });
    const category = categoryForLayer(resolvedLayer, item.type);
    // Trust client sensitivity when provided; fall back to heuristic classifier.
    const sensitivity: DurableMemorySensitivity = item.sensitivity === 'careful' || item.sensitivity === 'normal'
      ? item.sensitivity
      : classifyHelpfulMemorySensitivity(memoryText);

    // Careful items are NOT silently auto-saved; route to the candidate queue for explicit user review.
    const targetLayer: DurableMemoryLayer = sensitivity === 'careful' ? 'candidate' : resolvedLayer;
    const sourceTag: HelpfulMemoryItem['source'] = 'auto_saved';

    const keywords = extractHelpfulMemoryKeywords(memoryText, category, ...(Array.isArray(item.keywords) ? item.keywords : []));

    try {
      // Dedupe by (user_id, memory_text) across layers; we prefer upgrading existing rows over duplicating.
      const { data: existing } = await supabaseAdmin
        .from('user_helpful_memory')
        .select('id, evidence_count, confidence, keywords, layer, status, sensitivity')
        .eq('user_id', userId)
        .eq('memory_text', memoryText)
        .maybeSingle();

      if (existing?.id) {
        // If the row was already promoted out of candidate (user approved it), don't demote it back.
        const nextLayer = existing.layer && existing.layer !== 'candidate' ? existing.layer : targetLayer;
        const mergedKeywords = extractHelpfulMemoryKeywords(memoryText, ...(Array.isArray(existing.keywords) ? existing.keywords : []), ...keywords);
        await supabaseAdmin
          .from('user_helpful_memory')
          .update({
            layer: nextLayer,
            category: categoryForLayer(nextLayer as DurableMemoryLayer, item.type),
            confidence: existing.confidence === 'high' || item.confidence === 'high' ? 'high' : 'medium',
            evidence_count: Math.max(Number(existing.evidence_count || 1), Number(item.evidenceCount || 1)) + 1,
            keywords: mergedKeywords,
            sensitivity: existing.sensitivity === 'careful' ? 'careful' : sensitivity,
            status: existing.status === 'deleted' || existing.status === 'replaced' ? existing.status : 'active',
            updated_at: new Date().toISOString(),
            last_confirmed_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabaseAdmin
          .from('user_helpful_memory')
          .insert({
            user_id: userId,
            scope: 'all_chats',
            conversation_id: null,
            category,
            layer: targetLayer,
            memory_text: memoryText,
            source: sourceTag,
            status: 'active',
            sensitivity,
            sensitivity_reviewed: targetLayer !== 'candidate',
            confidence: item.confidence,
            evidence_count: Math.max(1, Number(item.evidenceCount || 1)),
            keywords,
            updated_at: new Date().toISOString(),
            last_confirmed_at: new Date().toISOString()
          });
      }
    } catch (error) {
      console.warn('auto helpful memory upsert failed', error);
    }
  }
}

// --- Forget flow ----------------------------------------------------------
// When the user says "I no longer X", "forget X", "┘ä┘à ╪ú╪╣╪» X", etc., the
// frontend emits a DurableMemoryItem with action='forget' and text=<phrase>.
// This function fuzzy-matches the phrase against existing active memories
// for the user and either:
//   - rewrites a list-style memory (e.g. "Hobbies: a, b, c" -> "Hobbies: a, c")
//   - or soft-deletes the whole memory if the phrase covers most of it.
function normalizeForMatch(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitListMemory(text: string): { label: string; items: string[]; separator: string } | null {
  // Matches patterns like "Label: a, b, c" (English or Arabic)
  const m = /^([^:\n]{2,40}):\s*(.+)$/.exec(text || '');
  if (!m) return null;
  const raw = m[2] || '';
  if (!/[,╪î]/.test(raw)) return null;
  const separator = raw.includes('╪î') ? '╪î ' : ', ';
  const items = raw.split(/\s*[,╪î]\s*/).map((p) => p.trim()).filter(Boolean);
  if (items.length < 2) return null;
  return { label: m[1].trim(), items, separator };
}

async function processForgetItems(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  userId: string,
  forgetItems: DurableMemoryItem[]
): Promise<void> {
  if (!Array.isArray(forgetItems) || forgetItems.length === 0) return;

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('user_helpful_memory')
      .select('id, memory_text, status')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error || !Array.isArray(rows) || rows.length === 0) return;

    const activeMemories = rows as Array<{ id: string; memory_text: string; status: string }>;

    for (const forget of forgetItems) {
      const needle = normalizeForMatch(forget.text);
      if (!needle || needle.length < 2) continue;

      for (const mem of activeMemories) {
        const haystack = normalizeForMatch(mem.memory_text || '');
        if (!haystack.includes(needle)) continue;

        // Case 1: list-style memory ΓÇö try surgical removal of the matching item
        const listed = splitListMemory(mem.memory_text);
        if (listed) {
          const kept = listed.items.filter((it) => {
            const n = normalizeForMatch(it);
            return n && n !== needle && !n.includes(needle) && !needle.includes(n);
          });
          if (kept.length !== listed.items.length && kept.length > 0) {
            const rebuilt = `${listed.label}: ${kept.join(listed.separator)}`.slice(0, 180);
            try {
              await supabaseAdmin
                .from('user_helpful_memory')
                .update({
                  memory_text: rebuilt,
                  updated_at: new Date().toISOString(),
                  last_confirmed_at: new Date().toISOString()
                })
                .eq('id', mem.id);
              // Reflect the rewrite locally so a second forget item in the same
              // request sees the up-to-date text.
              mem.memory_text = rebuilt;
              continue;
            } catch (e) {
              console.warn('forget rewrite failed', e);
            }
          }
          if (kept.length === 0) {
            // Removed everything in the list ΓÇö soft-delete the whole memory
            try {
              await supabaseAdmin
                .from('user_helpful_memory')
                .update({ status: 'deleted', updated_at: new Date().toISOString() })
                .eq('id', mem.id);
              mem.status = 'deleted';
              continue;
            } catch (e) {
              console.warn('forget list-empty delete failed', e);
            }
          }
        }

        // Case 2: forget phrase covers most of the memory text ΓÇö soft-delete
        const coverage = needle.length / Math.max(haystack.length, 1);
        if (coverage >= 0.5 || haystack === needle) {
          try {
            await supabaseAdmin
              .from('user_helpful_memory')
              .update({ status: 'deleted', updated_at: new Date().toISOString() })
              .eq('id', mem.id);
            mem.status = 'deleted';
          } catch (e) {
            console.warn('forget soft-delete failed', e);
          }
          continue;
        }

        // Otherwise: leave it alone ΓÇö too risky to mutate partial matches
      }
    }
  } catch (error) {
    console.warn('processForgetItems exception', error);
  }
}

function normalizeDurableMemoryItems(input: unknown): DurableMemoryItem[] {
  if (!Array.isArray(input)) return [];

  const allowedTypes = new Set(['identity_context', 'project_context', 'recurring_goal', 'working_style', 'priority']);
  const allowedLayers = new Set(['always_use', 'routine', 'project', 'candidate']);
  const allowedActions = new Set(['remember', 'forget']);
  const out: DurableMemoryItem[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const key = normalizeContinuityText(item.key, 64).replace(/[^a-z0-9_\-]/gi, '_');
    const type = typeof item.type === 'string' && allowedTypes.has(item.type)
      ? item.type as DurableMemoryType
      : null;
    const layer = typeof item.layer === 'string' && allowedLayers.has(item.layer)
      ? item.layer as DurableMemoryLayer
      : undefined;
    const sensitivity = item.sensitivity === 'careful' || item.sensitivity === 'normal'
      ? item.sensitivity as DurableMemorySensitivity
      : undefined;
    const action = typeof item.action === 'string' && allowedActions.has(item.action)
      ? item.action as DurableMemoryAction
      : 'remember';
    const text = normalizeContinuityText(item.text, 180);
    const confidence = item.confidence === 'high' ? 'high' : 'medium';
    const evidenceCount = typeof item.evidenceCount === 'number'
      ? Math.max(1, Math.min(6, Math.round(item.evidenceCount)))
      : 1;
    const keywords = Array.isArray(item.keywords)
      ? item.keywords
          .filter((value) => typeof value === 'string')
          .map((value) => normalizeContinuityText(value, 24).toLowerCase())
          .filter(Boolean)
          .slice(0, 6)
      : [];

    if (!key || !type || !text) continue;
    // Forget items are NOT subject to the forbidden-content filter ΓÇö the user is
    // instructing removal, not adding new content.
    if (action !== 'forget' && isForbiddenMemoryContent(text)) continue;
    if (out.some((existing) => existing.key === key || (existing.text === text && existing.action === action))) continue;

    out.push({
      key,
      type,
      layer,
      sensitivity,
      action,
      text,
      confidence,
      evidenceCount,
      keywords,
      source: 'conversation'
    });
  }

  return out.slice(0, 8);
}

function scoreDurableMemoryItem(
  item: DurableMemoryItem,
  message: string,
  activeTrigger: string,
  chatSubmode: string
): number {
  const query = normalizeContinuityText(message, 240).toLowerCase();
  let score = item.evidenceCount * 10 + (item.confidence === 'high' ? 8 : 3);
  const overlaps = item.keywords.filter((keyword) => query.includes(keyword)).length;
  score += overlaps * 12;

  if (item.type === 'project_context' && /project|product|build|feature|chat|wakti|prompt|memory|route|routing|app/i.test(query)) score += 10;
  if (item.type === 'recurring_goal' && /goal|need|improve|fix|better|solve|reliable|quality/i.test(query)) score += 8;
  if (item.type === 'working_style' && /explain|plan|audit|report|stage|help|walk me through/i.test(query)) score += 8;
  if (item.type === 'priority' && /speed|fast|performance|latency|token|lean|quality/i.test(query)) score += 10;
  if (chatSubmode === 'study' && item.type === 'project_context') score -= 4;

  return score;
}

function selectRelevantDurableMemory(
  items: DurableMemoryItem[],
  message: string,
  activeTrigger: string,
  chatSubmode: string
): DurableMemoryItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const limit = activeTrigger === 'search' ? 4 : 3;

  return [...items]
    .map((item) => ({ item, score: scoreDurableMemoryItem(item, message, activeTrigger, chatSubmode) }))
    .filter((entry) => entry.score >= 16)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

function messageRequestsReminder(message: string): boolean {
  if (!message || typeof message !== 'string') return false;
  return /\b(remind(?:er)?|alert|notify|notification|remember to|don't let me forget|dont let me forget|wake me|ping me|nudge me|set (?:a )?reminder|set (?:a )?note|tell me (?:at|in|tomorrow|later)|mark my calendar)\b|╪¬╪░┘â┘è╪▒|╪░┘â┘æ╪▒┘å┘è|╪░┘â╪▒┘å┘è|╪¬╪░┘â╪▒┘å┘è|┘ä╪º ╪¬╪«┘ä┘è┘å┘è ╪ú┘å╪│┘ë|┘å╪¿┘æ┘ç┘å┘è|┘å╪¿┘ç┘å┘è|╪╡╪¡┘è┘å┘è|╪░┘â╪▒┘å┘è\s+(?:┘ü┘è|╪¿┘â╪▒╪⌐|╪║╪»╪º┘ï|╪║╪»╪º|╪¿╪╣╪»|╪º┘ä╪│╪º╪╣╪⌐)/i.test(message);
}


// === TOKEN ESTIMATION ===
// Rough estimate: ~4 chars = 1 token for English, ~3 chars for mixed/Arabic
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// === COST CALCULATION ===
// Prices per 1M tokens (as of Dec 2024)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.50 },
  'gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'gemini-3.1-pro-preview': { input: 2.00, output: 8.00 },
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
      console.error('ΓÜá∩╕Å AI LOG: Failed to log usage:', error.message);
    }
  } catch (err) {
    console.error('ΓÜá∩╕Å AI LOG: Exception:', err);
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
    const model = 'gemini-3.1-flash-lite';
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

function extractGeminiDelta(parts: unknown[], accumulatedText: string): { delta: string; nextText: string } {
  const combined = Array.isArray(parts)
    ? parts
        .map((part) => (typeof (part as { text?: unknown })?.text === 'string' ? ((part as { text?: string }).text || '') : ''))
        .join('')
    : '';

  if (!combined) return { delta: '', nextText: accumulatedText };
  if (!accumulatedText) return { delta: combined, nextText: combined };
  if (combined === accumulatedText) return { delta: '', nextText: accumulatedText };
  if (combined.startsWith(accumulatedText)) {
    return {
      delta: combined.slice(accumulatedText.length),
      nextText: combined,
    };
  }

  const overlapWindow = Math.min(accumulatedText.length, combined.length);
  for (let overlap = overlapWindow; overlap > 0; overlap -= 1) {
    if (accumulatedText.slice(-overlap) === combined.slice(0, overlap)) {
      return {
        delta: combined.slice(overlap),
        nextText: accumulatedText + combined.slice(overlap),
      };
    }
  }

  return {
    delta: combined,
    nextText: accumulatedText + combined,
  };
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
  let fullText = "";

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
          const { delta, nextText } = extractGeminiDelta(parts, fullText);
          fullText = nextText;
          if (delta) onToken(delta);
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
      maps?: {
        uri?: string;
        googleMapsUri?: string;
        title?: string;
        placeId?: string;
        reviewId?: string;
        placeAnswerSources?: {
          reviewSnippets?: Array<{
            uri?: string;
            googleMapsUri?: string;
            title?: string;
            reviewId?: string;
            snippet?: string;
          }>;
        };
      };
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
      googleMapsUri?: string;
      websiteUri?: string;
      nationalPhoneNumber?: string;
      internationalPhoneNumber?: string;
      rating?: number;
      userRatingCount?: number;
      businessStatus?: string;
      regularOpeningHours?: {
        openNow?: boolean;
        weekdayDescriptions?: string[];
      };
      editorialSummary?: { text: string };
    }>;
  };
}

function buildSearchFollowupContents(
  rawUserMessage: string,
  queryText: string,
  recentMessages: unknown[] | undefined,
  searchTool: 'google_search' | 'google_maps' = 'google_search'
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
    if (/^(┘å╪╣┘à|╪º┘è|╪ú┘è┘ê┘ç|╪º┘è┘ê┘ç|╪¬┘à╪º┘à|╪º┘ê┘â┘è|╪¡╪º╪╢╪▒|╪¬┘ü╪╢┘ä|┘è┘ä╪º)\b/.test(t)) return true;
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
    const uText = u.content.replace(/\s+/g, ' ').trim().slice(0, 450);
    let aText = a && a.role === 'assistant' ? a.content.replace(/\s+/g, ' ').trim() : '';
    aText = aText.slice(0, 450);
    if (aText) summaryLines.push(`- User: ${uText}\n  Assistant: ${aText}`);
    else summaryLines.push(`- User: ${uText}`);
  }

  const compactSummary = summaryLines.join('\n').slice(0, 700);

  if (compactSummary || lastUser || lastAssistant) {
    const ctx =
      `CONTEXT (last turns, for continuity only):\n` +
      `${compactSummary ? compactSummary + '\n\n' : ''}` +
      `${lastUser ? `Last user message: ${lastUser.slice(0, 400)}\n` : ''}` +
      `${lastAssistant ? `Last assistant answer: ${lastAssistant.slice(0, 500)}\n` : ''}` +
      `\nNow answer the user's new request using ${searchTool}.`;

    contents.push({ role: 'user', parts: [{ text: ctx }] });
    if (lastAssistant) {
      contents.push({ role: 'model', parts: [{ text: lastAssistant.slice(0, 500) }] });
    }
  }

  contents.push({ role: 'user', parts: [{ text: resolvedQueryText }] });
  return contents;
}

function buildMapsGroundingQuery(
  query: string,
  userLocation?: { latitude: number; longitude: number; city?: string; country?: string } | null,
): string {
  const cleaned = (query || '')
    .replace(/\?+$/g, '')
    .replace(/^(?:can you|could you|would you|please|find me|show me|give me|i want|i need|looking for|search for|recommend(?: me)?|suggest(?: me)?|what are|where are)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const city = (userLocation?.city || '').trim();
  const country = (userLocation?.country || '').trim();
  const locationLabel = city && country ? `${city}, ${country}` : (city || country);
  if (!cleaned) return locationLabel || query.trim();
  if (!locationLabel) return cleaned;

  const lowerCleaned = cleaned.toLowerCase();
  if ((city && lowerCleaned.includes(city.toLowerCase())) || (country && lowerCleaned.includes(country.toLowerCase()))) {
    return cleaned;
  }

  return `${cleaned} in ${locationLabel}`;
}

// --- Brain-First: lightweight in-memory search cache (60s TTL) ---
const chatSearchCache = new Map<string, { result: string; ts: number }>();
const CHAT_SEARCH_CACHE_TTL_MS = 60_000;

function isKnowledgeOrCreativeQuery(query: string): boolean {
  return /\b(explain|teach|study|summari[sz]e|summary|analy[sz]e|compare|pros?\s+and\s+cons|definition|define|meaning|history|why does|how does|tutorial|guide|essay|write|rewrite|improve|translate|brainstorm|idea|ideas|debug|fix this code|code review|refactor|math|equation|solve|proof)\b|╪º╪┤╪▒╪¡|┘ä╪«╪╡|╪¡┘ä┘ä|┘é╪º╪▒┘å|╪╣╪▒┘æ┘ü|╪╣╪▒┘ü|╪º┘ä┘à╪╣┘å┘ë|╪º┘ä╪¬╪º╪▒┘è╪«|┘ä┘è╪┤|┘ä┘à╪º╪░╪º|┘â┘è┘ü|╪»┘ä┘è┘ä|┘à┘é╪º┘ä|╪º┘â╪¬╪¿|╪¬╪▒╪¼┘à|╪º┘ü┘â╪º╪▒|╪ú┘ü┘â╪º╪▒|╪╡╪¡╪¡|╪¿╪▒┘à╪¼╪⌐|┘à╪╣╪º╪»┘ä╪⌐|╪¡┘ä/i.test(query);
}

function isUserLocalClockQuestion(query: string): boolean {
  return /\b(what time is it|current time|local time|time now)\b|╪º┘ä╪│╪º╪╣╪⌐ ┘â┘à|┘â┘à ╪º┘ä╪│╪º╪╣╪⌐|╪º┘ä┘ê┘é╪¬ ╪º┘ä╪ó┘å|╪º┘ä┘ê┘é╪¬ ╪º┘ä╪º┘å/i.test(query);
}

// Brain-First hard router: returns true ONLY for explicit live-data queries.
// Everything else (math, history, science, creative, general knowledge) ΓåÆ pure brain.
function chatNeedsSearch(query: string): boolean {
  const q = (query || '').trim().toLowerCase();
  if (!q) return false;
  if (isUserLocalClockQuestion(q)) return false;
  if (isKnowledgeOrCreativeQuery(q)) return false;

  const hasTimeCue = /\b(today|tonight|now|right now|latest|current|live|this week|this month|as of today|breaking)\b|╪º┘ä┘è┘ê┘à|╪º┘ä╪ó┘å|╪º┘ä╪º┘å|┘à╪¿╪º╪┤╪▒|╪¡╪º┘ä┘è|╪ú╪¡╪»╪½|╪º╪«╪▒/i.test(q);

  if (/\b(weather|forecast|temperature|rain|snow|humid|wind speed)\b|╪╖┘é╪│|╪»╪▒╪¼╪⌐ ╪º┘ä╪¡╪▒╪º╪▒╪⌐|╪¬┘ê┘é╪╣╪º╪¬/i.test(q)) return true;
  if (/\b(breaking news|latest news|news today|headline|headlines today)\b|╪ú╪«╪¿╪º╪▒ ╪╣╪º╪¼┘ä╪⌐|╪ó╪«╪▒ ╪º┘ä╪ú╪«╪¿╪º╪▒|╪º╪«╪▒ ╪º┘ä╪ú╪«╪¿╪º╪▒/i.test(q)) return true;
  if (/\b(current score|live score|match result|final score|halftime|fulltime|standings today|table today)\b|┘å╪¬┘è╪¼╪⌐ ┘à╪¿╪º╪┤╪▒╪⌐|╪¬╪▒╪¬┘è╪¿ ╪º┘ä┘è┘ê┘à|┘à╪¿╪º╪▒╪º╪⌐ ╪º┘ä┘è┘ê┘à/i.test(q)) return true;
  if (/\b(stock price|share price|market cap|nasdaq|nyse|crypto price|bitcoin price|eth price|exchange rate|usd to|eur to|gbp to|currency today)\b|╪│╪╣╪▒ ╪º┘ä╪│┘ç┘à|╪│╪╣╪▒ ╪º┘ä╪¿┘è╪¬┘â┘ê┘è┘å|╪│╪╣╪▒ ╪º┘ä╪╣┘à┘ä╪⌐|╪│╪╣╪▒ ╪º┘ä╪╡╪▒┘ü/i.test(q)) return true;
  if (/\b(earthquake|tsunami|hurricane|cyclone|flood)\b|╪▓┘ä╪▓╪º┘ä|╪¬╪│┘ê┘å╪º┘à┘è|╪Ñ╪╣╪╡╪º╪▒|┘ü┘è╪╢╪º┘å/i.test(q) && hasTimeCue) return true;
  if (/\b(today's|tonight's|this week's).{0,30}(news|price|score|weather|result)\b/.test(q)) return true;

  return false;
}

// Chat mode: model is determined by engineTier at the call site
async function streamGemini3FlashChat(
  query: string,
  systemInstruction: string,
  recentMessages: unknown[] | undefined,
  onToken: (token: string) => void,
  language: string = 'en',
  onSignal?: (meta: Record<string, unknown>) => void,
  model: string = 'gemini-2.5-flash'
): Promise<string> {
  const key = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  try {
    if (Array.isArray(recentMessages) && recentMessages.length > 0) {
      const msgs = recentMessages
        .filter((m) => m && typeof m === 'object')
        .slice(-10)
        .map((m) => m as Record<string, unknown>);

      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        const r = typeof m.role === 'string' ? m.role : '';
        const c = typeof m.content === 'string' ? m.content : '';
        if (!c) continue;
        if (r !== 'user' && r !== 'assistant') continue;
        const role: 'user' | 'model' = r === 'assistant' ? 'model' : 'user';
        
        // Keep historical replay compact ΓÇö the current query is added separately in full below.
        const isLastMessage = i === msgs.length - 1;
        const charLimit = role === 'model'
          ? 700
          : (isLastMessage ? 1000 : 800);
        contents.push({ role, parts: [{ text: c.slice(0, charLimit) }] });
      }
    }
  } catch {
    /* ignore */
  }
  // If the frontend included the user's active message in the history, pop it out.
  // We want to discard the potentially frontend-truncated version in the history 
  // and replace it with the full, raw 'query' string.
  if (contents.length > 0) {
    const last = contents[contents.length - 1];
    if (last?.role === 'user') {
      contents.pop();
    }
  }
  // ALWAYS push the full, untruncated query as the final user message
  contents.push({ role: 'user', parts: [{ text: query }] });

  // Brain-First hard router: 95% of chat queries go straight to the model (no search overhead).
  // Only explicit live-data signals (weather, scores, prices, breaking news) trigger grounding.
  const useSearch = chatNeedsSearch(query);

  // If search IS needed, check 60s in-memory cache first
  if (useSearch) {
    const cacheKey = query.trim().toLowerCase();
    const cached = chatSearchCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < CHAT_SEARCH_CACHE_TTL_MS) {
      onToken(cached.result);
      return cached.result;
    }
    // Signal UI immediately so user sees "Searching..." instead of blank wait
    try {
      onSignal?.({ searching: true, message: language === 'ar' ? '╪¼╪º╪▒┘ì ╪º┘ä╪¿╪¡╪½...' : 'Searching...' });
    } catch { /* ignore */ }
  }

  const body: Record<string, unknown> = {
    contents,
    // When grounding: limit to 3 snippets + 2000 tokens for a fast fact-check, not a research paper
    generationConfig: { temperature: 0.4, maxOutputTokens: useSearch ? 2800 : 4500 },
  };
  if (useSearch) {
    body.tools = [{ google_search: {} }];
  }
  if (systemInstruction) {
    body.system_instruction = { parts: [{ text: systemInstruction }] };
  }


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
    console.error('Γ¥î CHAT GROUNDED ERROR:', resp.status, errText);
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
          const { delta, nextText } = extractGeminiDelta(parts, fullText);
          fullText = nextText;
          if (delta) onToken(delta);
        }
      } catch { /* ignore parse errors */ }
    }
  }


  // Cache the result for 60s to avoid redundant search round-trips
  if (useSearch && fullText) {
    const cacheKey = query.trim().toLowerCase();
    chatSearchCache.set(cacheKey, { result: fullText, ts: Date.now() });
    // Prune old entries to prevent memory leak (keep max 100 entries)
    if (chatSearchCache.size > 100) {
      const oldest = chatSearchCache.keys().next().value;
      if (oldest) chatSearchCache.delete(oldest);
    }
    // Append search-mode tip to the streamed response
    const tip = language === 'ar'
      ? '\n\n> ≡ƒÆí *┘ä┘ä╪¡╪╡┘ê┘ä ╪╣┘ä┘ë ┘å╪¬╪º╪ª╪¼ ╪¿╪¡╪½ ╪ú╪╣┘à┘é╪î ╪¼╪▒╪¿ **┘ê╪╢╪╣ ╪º┘ä╪¿╪¡╪½**.*'
      : '\n\n> ≡ƒÆí *For deeper search results, try **Search Mode**.*';
    onToken(tip);
    fullText += tip;
  }

  return fullText;
}

// Search mode: dynamic model (gemini-3.1-pro-preview for intelligence tier, gemini-3.1-flash-lite for speed)
async function streamGemini3WithSearch(
  query: string,
  systemInstruction: string,
  generationConfig: Record<string, unknown> | undefined,
  recentMessages: unknown[] | undefined,
  onToken: (token: string) => void,
  onGroundingMetadata: (meta: Gemini3SearchResult['groundingMetadata']) => void,
  userLocation?: { latitude: number; longitude: number; city?: string; country?: string } | null,
  searchIntent: 'business' | 'news' | 'sports' | 'url' | 'general' = 'general',
  model: string = 'gemini-3.1-pro-preview'
): Promise<string> {
  const key = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
  const useMapsGrounding = searchIntent === 'business';

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
  const isNearMeQuery = /\b(near me|nearest|closest|around me|nearby)\b/i.test(query);
  const hasUserCoords = typeof userLocation?.latitude === 'number' && typeof userLocation?.longitude === 'number';
  // Inject device GPS location into the query so google_search returns hyper-local results
  let locationHint = '';
  if (userLocation?.latitude && userLocation?.longitude) {
    locationHint = ` User is at [${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}]. Use this only for internal ranking of nearby and time-sensitive results. Do not rewrite the user's visible query with a city name, country, or coordinates.`;
  }
  const latestQuery = `${query} (as of ${todayStr}).${nhlHint}${locationHint}\n\nLATEST-FIRST RULE (CRITICAL): Today is ${todayStr}.${nhlHint} Use the newest available sources/snippets. Prefer results updated today/this hour when present. If sources conflict, choose the most recently updated. If any result refers to an older season (example: "2023-24"), treat it as STALE and re-search with a stricter query. Do not use memory for live facts.`;
  const mapsQuery = useMapsGrounding ? buildMapsGroundingQuery(query, userLocation) : query;
  const effectiveQuery = useMapsGrounding ? mapsQuery : latestQuery;

  const body: Record<string, unknown> = {
    contents: buildSearchFollowupContents(query, effectiveQuery, recentMessages, useMapsGrounding ? 'google_maps' : 'google_search'),
    tools: useMapsGrounding
      ? [{ googleMaps: { enableWidget: true } }]
      : [{ google_search: {} }],
  };
  if (useMapsGrounding && hasUserCoords) {
    body.toolConfig = {
      retrievalConfig: {
        latLng: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        }
      }
    };
  }
  
  if (systemInstruction) {
    body.system_instruction = { parts: [{ text: systemInstruction }] };
  }
  if (generationConfig) {
    body.generationConfig = generationConfig;
  }


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
    console.error('Γ¥î GEMINI SEARCH ERROR:', resp.status, errText);
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
          const { delta, nextText } = extractGeminiDelta(parts, fullText);
          fullText = nextText;
          if (delta) onToken(delta);
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

  return fullText;
}

function buildLeanSearchSystemPrompt(params: {
  language: string;
  localTime: string;
  userTimeZone: string;
  personalSection: string;
  searchLocationContext: string;
  searchIntent: string;
  userNick: string;
  userDisplayName: string;
  aiNick: string;
  toneVal: string;
  styleVal: string;
  customNote: string;
  introRule: string;
}): string {
  const {
    language,
    localTime,
    userTimeZone,
    personalSection,
    searchLocationContext,
    searchIntent,
    userNick,
    userDisplayName,
    aiNick,
    toneVal,
    styleVal,
    customNote,
    introRule,
  } = params;
  const isBusinessSearch = searchIntent === 'business';

  return `You are WAKTI AI Search. Use live grounded results first, then answer clearly and accurately.${personalSection}

LIVE CONTEXT:
- Current time: ${localTime} (${userTimeZone})
- Location: ${searchLocationContext || 'Unknown'}
- Intent hint: ${searchIntent}
- Language: ${language === 'ar' ? 'Arabic' : 'English'}
${userNick ? `- User nickname: "${userNick}"` : userDisplayName ? `- User display name: "${userDisplayName}"` : ''}
${aiNick ? `- Your name: "${aiNick}"` : ''}
${toneVal !== 'neutral' ? `- Tone: ${toneVal}` : ''}
${styleVal ? `- Style: ${styleVal}` : ''}
${customNote ? `- Extra instruction: ${customNote}` : ''}

INTRO:
- Open with one short personal line when natural.
- For nearby or business searches, if a user nickname or display name exists, use it naturally once in the opener.
- Use this pattern as guidance, not as a rigid script: ${introRule}
- Keep the intro short, human, and practical. Do not force weather or local events unless confidently verified and truly useful.
- Avoid hype, marketing copy, and lifestyle filler in the opener.

CORE RULES:
1. Search first, then answer. Never guess live facts.
2. If a detail is not verified in grounded results, omit it.
3. Prefer the newest trustworthy result and check dates against the current time.
4. Explain why a live result matters, not just the raw number.
5. Write fully in the selected language.

LOCATION RULES:
1. For any near-me or location-dependent query, open with one short natural line that helps the user orient themselves. Keep it personal and practical. Do not force a scripted greeting.
2. Never name a neighborhood, district, compound, tower, street, or sub-area as if it is the user's exact location.
3. If the user asked "near me", "nearby", "closest", or a similar local query without naming a city, do not inject a city or country into the visible answer.
4. If exact area is uncertain, say "near you right now" or "closest to you right now" instead of guessing. Never say "near your current coordinates".
5. Keep recommendations tightly scoped to the user's current area.

FORMAT:
- Place or business queries: Return 4-6 results max and rank the closest grounded places first whenever current coordinates are available.
- For near-me queries, use the grounded place/map results first. If the results are not clearly near the user's current location, say that clearly instead of pretending they are nearby.
- For place queries, prefer concrete grounded place results over generic web listicles.
- For business queries, users should not need to separately ask for Google Maps, rating, review count, phone, verified email, website, or official social links. Treat them as default nearby-result fields and include each one whenever grounded or verified data exists.
- For business queries, if grounded Google Maps review snippets exist, the UI will show the latest 2 reviews automatically. In the answer text, still include rating and Google Reviews count whenever available.
- For business queries, when grounded place cards exist, keep the written intro to 1-2 short sentences max and let the structured place result carry the detailed links, reviews, and contact fields.
  - For business queries, use this exact output shape for EACH place:
    1. **[Name] ([Area])**
     - **Reason:** [why it made the list]
     - **Vibe:** [2-4 keywords]
     - **Must-Try:** [best item / specialty / reason to go]
     - **Status:** [Open / Closed / hours only if verified]
     - **Rating:** [4.4] (include whenever grounded)
     - **Google Reviews:** [123 reviews] (include whenever grounded)
     - **Google Maps:** [Open in Google Maps](https://...) (include whenever grounded)
     - **Phone:** [+974xxxx](tel:+974xxxx) (only if verified)
     - **Website:** [domain.com](https://domain.com) (official website only if verified)
     - **Instagram:** [@handle](https://instagram.com/handle) (official Instagram only if verified)
     - **WhatsApp:** [Chat](https://wa.me/${'\\<digits>'}) (only if explicitly verified)
     - **Facebook:** [Page](https://facebook.com/...) (official Facebook only if verified)
     - **TikTok:** [@handle](https://tiktok.com/@handle) (official TikTok only if verified)
- Live data queries: lead with the latest result, then explain the stakes. Use a valid markdown table only when it truly helps. End with a compact "Sources:" line using 2-4 clickable grounded links whenever grounded links exist.
- Research queries: give a short executive summary, 2-4 key insights, and 2-4 high-quality sources.
- URL analysis: summarize the page first, then key evidence, then any reliability or bias note if relevant. End with a compact "Sources:" line whenever grounded links exist.

OUTPUT RULES:
- Keep place descriptions to 3 sentences max.
- All links must be clickable markdown.
- Phone numbers must use tel: links.
- WhatsApp must use wa.me only when explicitly verified.
- Never invent emails, social handles, hours, scores, prices, or sources.
- For non-business searches, if grounded web links exist, include a compact "Sources:" block at the end. Do not omit sources when grounded URLs are available.
- For place queries, never output a wide markdown table. Use compact bullets with one place per block.
- For business queries, keep the answer highly practical: proximity first, then quality, then useful links.
- For business queries, if a field is not verified, omit it instead of filling with placeholders.
- For business queries, do not make the user ask for Google Maps, Rating, Google Reviews, Email, Website, Instagram, WhatsApp, Facebook, or TikTok. If the data exists, include it by default.
- For business queries, do not output plain text URLs or plain text phone numbers. Always format them as clickable markdown links.
- For business queries, do not collapse the answer into one sentence per place. Keep the named subfields so it reads like the older Wakti Maps-style result.
- For business and nearby queries, avoid cheesy opener lines like "if you're looking to...", "to get you moving", or "to grab a brew".
${isBusinessSearch ? '- This request is a business/place search. Follow the exact business output shape above.' : ''}
- If space is tight, keep the most useful facts first and drop extras.`;
} // Added the missing closing brace here

// ΓöÇΓöÇΓöÇ LAZY-LOAD PROMPT BUILDING BLOCKS ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function _promptPersonalSection(pt: Record<string, unknown>): string {
  const userNick = ((pt.nickname as string | undefined) || '').toString().trim();
  const aiNick = ((pt.aiNickname as string | undefined) || (pt.ai_nickname as string | undefined) || '').toString().trim();
  const tone = ((pt.tone as string | undefined) || '').toString().trim();
  const styleRaw = ((pt.style as string | undefined) || '').toString().trim();
  const instruction = ((pt.instruction as string | undefined) || '').toString().trim();

  if (!userNick && !aiNick && !tone && !styleRaw && !instruction) return '';

  // Per-value Tone enforcement (mirror of vision/search logic so behaviour is consistent across modes)
  const toneLower = tone.toLowerCase();
  let toneLine = '';
  if (tone) {
    if (toneLower.includes('funny'))            toneLine = `Tone ΓÇö FUNNY (mandatory): include light humour, wordplay or amusing observations. Keep content accurate.`;
    else if (toneLower.includes('encourag'))    toneLine = `Tone ΓÇö ENCOURAGING (mandatory): use positive, supportive language; celebrate wins; be warm.`;
    else if (toneLower.includes('serious'))     toneLine = `Tone ΓÇö SERIOUS (mandatory): formal and professional. No humour or emoji.`;
    else if (toneLower.includes('casual'))      toneLine = `Tone ΓÇö CASUAL (mandatory): relaxed, friendly, plain language ΓÇö like a helpful buddy.`;
    else if (toneLower.includes('neutral'))     toneLine = '';
    else                                        toneLine = `Tone ΓÇö ${tone} (mandatory): keep this tone consistently.`;
  }

  // Per-value Style enforcement
  const styleLower = styleRaw.toLowerCase();
  let styleLine = '';
  if (styleRaw) {
    if (styleLower.includes('short'))           styleLine = `Style ΓÇö SHORT ANSWERS (mandatory): keep every reply direct and concise, max 3-4 sentences unless absolutely necessary. No fluff. Go straight to the point.`;
    else if (styleLower.includes('detailed'))   styleLine = `Style ΓÇö DETAILED (mandatory): give thorough explanations with examples and clear structure. Break topics into organised sections.`;
    else if (styleLower.includes('bullet'))     styleLine = `Style ΓÇö BULLET POINTS (mandatory): organise answers as ΓÇó bullet lists whenever possible.`;
    else if (styleLower.includes('step'))       styleLine = `Style ΓÇö STEP BY STEP (mandatory): organise answers as numbered steps (Step 1, Step 2, ...).`;
    else if (styleLower.includes('conversational')) styleLine = `Style ΓÇö CONVERSATIONAL (mandatory): reply like a natural back-and-forth chat. No headings, no bullet dumps.`;
    else                                        styleLine = `Style ΓÇö ${styleRaw} (mandatory): apply this style in every reply.`;
  }

  let s = `\nPERSONAL TOUCH:`;
  if (userNick) s += ` Call user "${userNick}".`;
  if (aiNick)   s += ` You are "${aiNick}".`;
  if (toneLine) s += `\n${toneLine}`;
  if (styleLine) s += `\n${styleLine}`;
  if (instruction) s += `\nUser's extra instructions (follow on every reply): ${instruction}`;
  return s + '\n';
}

// BASE BLOCK: Persona + Memory + Language + Format + Time
function _promptBase(
  language: string,
  currentDate: string,
  localTime: string,
  personalTouch: Record<string, unknown> | null | undefined,
  aiNick: string
): string {
  const pt = (personalTouch || {}) as Record<string, unknown>;
  const personalSection = _promptPersonalSection(pt);
  return `You are ${aiNick || 'WAKTI AI'}, a proprietary intelligence developed by the WAKTI team in Qatar led by Alfadly; you must refer to yourself ONLY as WAKTI AI and never mention Google, Gemini, or other creators. Date: ${currentDate}. Local time: ${localTime}.

TIME AUTHORITY (NON-NEGOTIABLE):
- The "Date" and "Local time" above are the user's ACTUAL current date and local clock. Treat them as ground truth.
- Do NOT drift past midnight, do NOT assume a different day, do NOT say "by now it must be tomorrow" or "it's officially past midnight now". If the clock above says it is Wednesday afternoon, it is Wednesday afternoon.
- When deciding whether to act on day-specific routines (e.g. "every Thursday..."), compare against the date above. If today is not that day, acknowledge the routine exists but wait ΓÇö do NOT act on it pre-emptively.
- If the user corrects you about the day/time, trust the user and the clock above, not your instincts.

MEMORY: Use the conversation history fully. Never ask about something the user already told you. Reference prior context naturally. Treat the whole conversation as one continuous discussion.

LANGUAGE: Always respond in ${language === 'ar' ? 'Arabic (╪º┘ä╪╣╪▒╪¿┘è╪⌐)' : 'English'} unless the user explicitly asks to translate. Non-negotiable.${personalSection}
FORMATTING: Use Markdown tables only if the data naturally fits a table format. If the user prefers a short or conversational style, use sentences or bullets instead. Never output internal reasoning.

CRITICAL RULE: DO NOT output your internal thought process, reasoning, or meta-commentary (e.g. do not write "The user is asking for..." or "I should..."). Output ONLY the final response to the user.`;
}

 // CHAT FRESHNESS EXTENSION (~150 chars): Only for pure chat mode
 function _promptChatFreshness(): string {
  return `\n\nCHAT FRESHNESS PROTOCOL\n- Be fast and conversational by default.\n- If user asks for time-sensitive facts (news, scores, prices), say clearly you cannot verify live data and suggest using Search Mode.`;
}

// STUDY MODE EXTENSION (~600 chars): Only when chatSubmode === 'study'
function _promptStudy(): string {
  return `\n\n≡ƒôÜ STUDY MODE (TUTOR STYLE) - CRITICAL\nYou are now in STUDY MODE. Act as a friendly, patient tutor.\n\nSTUDY MODE RULES:\n0. ANSWER BOX (MANDATORY): Your response MUST start with a unique 1-sentence summary wrapped in [BOX]...[/BOX] tags. Example: [BOX]Photosynthesis is the process plants use to convert sunlight into food.[/BOX]. DO NOT repeat this sentence anywhere in the main body of your response.\n1. EXPLAIN STEP-BY-STEP: After the [BOX], break down the reasoning in simple, numbered steps.\n2. USE SIMPLE LANGUAGE: Avoid jargon. Explain like teaching a curious student.\n3. STRUCTURE CLEARLY: Use bullet points, numbered lists, or short paragraphs. Never a wall of text.\n4. ADD EXAMPLES: When helpful, include a real-world example or analogy.\n5. PRACTICE QUESTIONS (optional): For suitable topics, end with 1-2 short practice questions.\n6. ENCOURAGE: Be supportive and encouraging.\n\nApplies to ALL subjects: math, science, history, languages, programming, exam prep, general knowledge.\nIf user uploads an image (photo of notes, textbook, problem), analyze and teach based on what you see.`;
}

// SEARCH EXTENSION (~800 chars): Only when useSearch===true in chat mode
function _promptChatSearch(userNick: string, aiNick: string, currentDate: string): string {
  return `\n\n≡ƒöì LIVE DATA LOOKUP (CHAT MODE QUICK SEARCH)\n- You are doing a fast fact-check. Keep it concise ΓÇö 2000 tokens max.\n- Only output numbers/facts from the retrieved web snippets. Do NOT invent data.\n- If sources conflict, prefer the most recent and note which one you used.\n- Format: short intro (1-2 sentences) + bullet points or compact table. No long paragraphs.\n- If you open with a greeting, keep it short and natural. Never say "Greetings" or "I've pulled the latest for you". Good examples: "Here's the quick latest:" or "${userNick || 'Friend'}, here's the quick latest."\n\n> ≡ƒÆí *For deeper search results, try **Search Mode**.*`;
}

// SEARCH MODE FULL EXTENSION: Only for activeTrigger === 'search'
function _promptSearchModeFull(userNick: string, aiNick: string, currentDate: string, localTime: string): string {
  return `\n\n≡ƒöì SEARCH MODE INTELLIGENCE (CRITICAL)\n\nCONTEXT-AWARE SEARCH PROTOCOL:\n1. CHECK CONVERSATION CONTEXT FIRST: Look at the "CURRENT CONVERSATION TOPIC" section in the Stay Hot Summary above.\n2. INFER SEARCH INTENT: If user says just "search" or "find" without specifying what, check what they were just discussing and intelligently infer what they want.\n3. ASK ONLY IF TRULY AMBIGUOUS: Only ask "search about what?" if there's genuinely no context to infer from.\n\nSEARCH EXECUTION RULES:\n- You MUST use the google_search tool for web facts and current events.\n- Do NOT answer from pre-trained memory for live data (scores, prices, news).\n\nCRITICAL SEARCH FORMATTING RULES (NON-NEGOTIABLE)\nSEARCH MODE = FACTS FIRST (CRITICAL)\n- NO jokes, no storytelling, no assumptions, no "filler".\n- For live facts (sports standings/scores, prices, flights, news):\n  - You MUST ONLY output numbers/facts that appear in the retrieved web snippets.\n  - If you cannot find exact numbers, say so clearly.\n- If sources conflict, prefer the most recent dated source and say which one you used.\n- When you present a table/dashboard with numbers, include a short "Sources" section with direct URLs.\n\nFRESHNESS ENFORCEMENT (MANDATORY)\n- If the user asks for "latest", "today", "current", or live data ΓÇö use results updated today/this week.\n- If retrieved snippets mention an older season/year, treat as STALE and re-search with stricter queries.\n- Re-search strategy: (1) Add today's year and season label, (2) Add "updated today" / "live", (3) Prefer official sources.\n- If after re-search you STILL cannot find verified up-to-date numbers, do NOT guess. Provide the best official link(s).\n\nFORMATTING ENFORCEMENT:\n- NEVER respond with a single long paragraph.\n- ALWAYS use: Dashboard layout, Short answers (1-2 sentence intro + max 3 bullets), or Detailed answers (2-3 sentence intro + 5-7 bullets).\n- If 3+ distinct items: Use a Markdown table (Event | Key Detail | Source).\n- ALWAYS start with: "Greetings, ${userNick || 'friend'} ΓÇö ${aiNick || 'Wakti'} here. ${currentDate}. I've pulled the latest for you ΓÇö"\n\nCONTENT RULES:\n- Base your answer ONLY on the search results provided.\n- Do NOT invent events, dates, or facts not in the search results.\n- Keep each bullet point or table row concise (1-2 sentences max).`;
}

// TIMEZONE EXTENSION (~400 chars): Injected whenever time conversions may be needed
function _promptTimezone(): string {
  return `\n\nΓÅ░ CRITICAL TIMEZONE RULES (HIGHEST PRIORITY):\n1. The user's local time is shown above as "Current local time". This IS the user's timezone.\n2. When you find times in OTHER timezones (ET, PT, GMT, UTC), convert them to the user's local timezone.\n3. If a time is ALREADY in the user's local timezone, DO NOT convert it again.\n4. Format: Show local time first, then original. Example: "3:00 AM (7:00 PM ET)"\n5. NEVER double-convert.`;
}

// REMINDER INTERCEPTION: dynamic instruction injected only when user requests a reminder.
function buildReminderInstruction(formattedOffset: string): string {
  return `ΓÜá∩╕Å REMINDER OUTPUT RULE (HIGHEST PRIORITY ΓÇö OVERRIDE EVERYTHING ELSE):
The user is asking for a reminder. You MUST append the following JSON block on its own line at the ABSOLUTE END of your response, after all text. No markdown, no code fences, no explanation:
{"action":"set_reminder","time":"ISO-8601 datetime with offset","text":"reminder description"}
Rules:
- Use offset ${formattedOffset} (e.g. 2026-03-22T15:00:00${formattedOffset}).
- Calculate relative times ("in 5 minutes", "tomorrow at 9am") by adding to the Current local time shown above.
- NEVER omit the JSON. NEVER put it in a code block. NEVER add anything after it.
- If you do not output this JSON, the reminder will be LOST and the user will be angry.

`;
}

/**
 * Intercept reminder JSON from AI response, schedule it, and return cleaned text.
 * Pattern: {"action":"set_reminder","time":"...","text":"..."} at end of response.
 */
async function interceptAndScheduleReminder(
  responseText: string,
  userId: string,
  timezone: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  userOffset = '+00:00'
): Promise<string> {
  // Use lastIndexOf to find the TRAILING action block ΓÇö not a mid-response mention
  const triggerIdx = responseText.lastIndexOf('{"action"');
  if (triggerIdx === -1) return responseText;

  const rawTail = responseText.substring(triggerIdx).trim();
  // Find the last closing brace ΓÇö AI may append trailing text/newlines after the JSON
  const lastBrace = rawTail.lastIndexOf('}');
  const tail = lastBrace !== -1 ? rawTail.substring(0, lastBrace + 1) : rawTail;

  try {
    const data = JSON.parse(tail);
    // Only proceed if it's actually a valid action JSON object
    if (!data || typeof data !== 'object' || !('action' in data)) return responseText;
    const cleanText = responseText.substring(0, triggerIdx).trim();
    if (data.action === 'set_reminder') {
      let scheduledTime = (data.time as string) || '';
      // Safety net: if AI omitted the offset, append the user's dynamic offset
      if (scheduledTime && !scheduledTime.includes('+') && !scheduledTime.includes('-', 10) && !scheduledTime.endsWith('Z')) {
        scheduledTime = `${scheduledTime}${userOffset}`;
      }
      const timeStr = scheduledTime;
      const reminderText = data.text as string;

      try {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

        // Parse the scheduled time ΓÇö handle ISO 8601 with timezone offset (e.g. 2026-03-24T10:36:00+03:00)
        const cleanedTimeStr = timeStr
          .replace(/[\u200B-\u200D\uFEFF]/g, '') // strip zero-width chars
          .replace(/[^\x20-\x7E]/g, '')          // strip non-ASCII
          .trim()
          .replace(' ', 'T');                     // normalise space-separated datetime

        if (!cleanedTimeStr) {
          console.error(`ΓÜá∩╕Å REMINDER INTERCEPT: Empty scheduled_for ΓÇö aborting`);
          return cleanText;
        }

        // Manual ISO+offset parser ΓÇö guaranteed to work in all Deno versions
        // Handles: YYYY-MM-DDTHH:MM[:SS][.mmm](Z|┬▒HH:MM|┬▒HHMM)
        let validTimeStr: string;
        const m = cleanedTimeStr.match(
          /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:(Z)|([+-])(\d{2}):?(\d{2}))$/
        );
        if (m) {
          const [, yr, mo, dy, hr, mn, sc = '00', ms = '000', zulu, sign, tzH, tzM] = m;
          const baseMs = Date.UTC(+yr, +mo - 1, +dy, +hr, +mn, +sc, +ms.padEnd(3, '0'));
          const offsetMs = zulu ? 0 : ((+tzH * 60 + +tzM) * 60_000 * (sign === '+' ? 1 : -1));
          validTimeStr = new Date(baseMs - offsetMs).toISOString();
        } else {
          // Last-resort fallback
          const fb = new Date(cleanedTimeStr);
          validTimeStr = isNaN(fb.getTime()) ? new Date(Date.now() + 60_000).toISOString() : fb.toISOString();
          console.error(`ΓÜá∩╕Å REMINDER INTERCEPT: Non-standard date "${timeStr}" ΓÇö using fallback: ${validTimeStr}`);
        }

        // INSERT notification_history row first so process-scheduled-reminders can pick it up
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('notification_history')
          .insert({
            user_id: userId,
            type: 'ai_reminder',
            title: 'Wakti AI Reminder',
            body: reminderText,
            reminder_content: reminderText,
            scheduled_for: validTimeStr,
            push_sent: false,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('ΓÜá∩╕Å REMINDER INTERCEPT: Failed to insert notification_history row', insertError.message);
        } else {
          // Reminder row saved successfully; delivery scheduling continues below.
        }

        const notificationId = inserted?.id || null;
        let reminderDeliveryMode: 'scheduled' | 'fallback_only' = 'fallback_only';

        const scheduleUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/schedule-reminder-push`;
        const schedResp = await fetch(scheduleUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            user_id: userId,
            scheduled_for: validTimeStr,
            reminder_text: reminderText,
            title: 'Wakti AI Reminder',
            timezone,
            notification_id: notificationId,
          }),
        });
        if (schedResp.ok) {
          reminderDeliveryMode = 'scheduled';
        } else {
          const errBody = await schedResp.text();
          console.error(`ΓÜá∩╕Å REMINDER INTERCEPT: Schedule failed ${schedResp.status}`, errBody);
        }

        if (notificationId) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ reminderScheduled: { id: notificationId, time: timeStr, scheduledFor: validTimeStr, text: reminderText, deliveryMode: reminderDeliveryMode } })}\n\n`));
          } catch { /* stream may be closing */ }
        }
      } catch (err) {
        console.error('ΓÜá∩╕Å REMINDER INTERCEPT: Fetch error', err);
      }

      return cleanText;
    }
  } catch (e) {
      console.error('ΓÜá∩╕Å REMINDER INTERCEPT: Failed to parse intercepted reminder JSON', e);
  }

  return responseText;
}

// ΓöÇΓöÇΓöÇ LAZY-LOAD DISPATCHER ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// Builds ONLY the blocks needed for the current mode.
// Pure chat: ~500 chars. With study/search/reminders: grows as needed.
function buildSystemPrompt(
  language: string,
  currentDate: string,
  localTime: string,
  personalTouch: Record<string, unknown> | null | undefined,
  activeTrigger: string,
  chatSubmode = 'chat',
  lazyOpts?: { useSearch?: boolean; hasReminders?: boolean; isReminderTrigger?: boolean; formattedOffset?: string }
) {
  const pt = (personalTouch || {}) as Record<string, unknown>;
  const userNick = ((pt.nickname as string | undefined) || '').toString().trim();
  const aiNick  = ((pt.aiNickname as string | undefined) || (pt.ai_nickname as string | undefined) || '').toString().trim();
  const useSearch   = lazyOpts?.useSearch   ?? (activeTrigger === 'search');
  const _hasReminders = lazyOpts?.hasReminders ?? false;

  // REMINDER INSTRUCTION: injected FIRST so it is never buried and always obeyed
  let reminderPrefix = '';
  if (lazyOpts?.isReminderTrigger) {
    reminderPrefix = buildReminderInstruction(lazyOpts.formattedOffset || '+00:00');
  }

  // BASE is always included (~500 chars)
  let prompt = reminderPrefix + _promptBase(language, currentDate, localTime, pt, aiNick);

  // MODE-SPECIFIC EXTENSIONS ΓÇö injected only when needed
  if (activeTrigger === 'search') {
    // Full search mode: comprehensive research rules
    prompt += _promptSearchModeFull(userNick, aiNick, currentDate, localTime);
    prompt += _promptTimezone();
  } else if (chatSubmode === 'study') {
    // Study mode: tutor block only
    prompt += _promptStudy();
    prompt += _promptTimezone();
  } else if (useSearch) {
    // Chat mode triggered grounding: compact search hint
    prompt += _promptChatSearch(userNick, aiNick, currentDate);
    prompt += _promptTimezone();
  } else {
    // Pure chat: freshness hint only ΓÇö reminder interception handled at backend level
    prompt += _promptChatFreshness();
  }

  return prompt;
}

type ChatMessage = { role: string; content: string };

function convertMessagesToClaudeFormat(messages: ChatMessage[]): {
  system: string;
  messages: {
    role: string;
    content: string;
  }[];
} {
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


async function executeRegularSearch(query: string, language = 'en'): Promise<{
  success: boolean;
  error?: string;
  data?: {
    answer: string;
    results: unknown[];
    followUpQuestions: string[];
    query: string;
    total_results: number;
  };
  context?: string;
  details?: string;
}> {
  const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');
  
  
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
      console.error('Γ¥î SEARCH API ERROR:', response.status, errorText);
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
      console.error('Γ¥î SEARCH JSON parsing error:', jsonError);
      console.error('Γ¥î Raw response:', responseText.substring(0, 200));
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
    console.error('Γ¥î SEARCH: Critical error:', error);
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

type GroundedPlaceCard = {
  placeId: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  userRatingCount: number | null;
  websiteUrl: string;
  phone: string;
  email?: string;
  openNow: boolean | null;
  businessStatus: string;
  reason: string;
  vibe: string;
  mustTry: string;
  editorialSummary: string;
  reviewSnippets: Array<{
    uri?: string;
    googleMapsUri?: string;
    title?: string;
    reviewId?: string;
    snippet?: string;
  }>;
  mapsUrl: string;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  whatsappUrl?: string;
  photoUrl?: string;
  openingHours?: string[];
};

const BUSINESS_LINK_STOPWORDS = new Set([
  'the', 'and', 'for', 'cafe', 'cafes', 'coffee', 'restaurant', 'restaurants', 'shop', 'store', 'market', 'hospital', 'street', 'road', 'mall', 'center', 'centre', 'branch', 'official'
]);

function normalizeBusinessLookupText(value: string): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getBusinessLookupTokens(value: string): string[] {
  const tokens = normalizeBusinessLookupText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !BUSINESS_LINK_STOPWORDS.has(token));
  return [...new Set(tokens)].slice(0, 4);
}

function hostMatchesAny(host: string, domains: string[]): boolean {
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function getSafeHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function getSafePathSegments(rawUrl: string): string[] {
  try {
    return new URL(rawUrl).pathname.split('/').map((segment) => segment.trim().toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

function scoreBusinessLinkMatch(haystack: string, tokens: string[], exactName: string): number {
  if (exactName && haystack.includes(exactName)) return 4;
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score += 1;
  }
  return score;
}

function isGoogleMapsLikeUrl(rawUrl: string): boolean {
  const normalized = normalizeExternalUrl(rawUrl);
  if (!normalized) return false;
  const host = getSafeHostname(normalized);
  if (!host) return false;
  return (
    host === 'maps.app.goo.gl'
    || host === 'goo.gl'
    || ((host === 'google.com' || host === 'maps.google.com' || host.endsWith('.google.com'))
      && (normalized.includes('/maps') || normalized.includes('maps/search') || normalized.includes('query_place_id=')))
  );
}

function pickVerifiedBusinessLinks(results: Array<Record<string, unknown>>, place: GroundedPlaceCard): Partial<GroundedPlaceCard> {
  const exactName = normalizeBusinessLookupText(place.name);
  const tokens = getBusinessLookupTokens(`${place.name} ${place.address}`);
  const links: Partial<GroundedPlaceCard> = {};
  const blockedWebsiteDomains = [
    'google.com', 'maps.google.com', 'instagram.com', 'facebook.com', 'm.facebook.com', 'tiktok.com', 'wa.me', 'whatsapp.com', 'tripadvisor.com', 'zomato.com', 'yelp.com', 'foursquare.com', 'talabat.com', 'deliveroo.com', 'ubereats.com', 'snoonu.com', 'timeoutdoha.com', 'iloveqatar.net'
  ];
  const blockedInstagramSegments = ['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'locations', 'hashtag'];
  const blockedFacebookSegments = ['share', 'watch', 'photo', 'photos', 'events', 'groups', 'marketplace'];
  const blockedTikTokSegments = ['tag', 'music', 'discover', 'foryou'];

  for (const result of results) {
    const url = typeof result.url === 'string' ? result.url.trim() : '';
    if (!url) continue;
    const host = getSafeHostname(url);
    if (!host) continue;
    const title = typeof result.title === 'string' ? result.title : '';
    const content = typeof result.content === 'string' ? result.content : '';
    const haystack = normalizeBusinessLookupText(`${title} ${content} ${url}`);
    const score = scoreBusinessLinkMatch(haystack, tokens, exactName);
    const isKnownMapsOrSocialHost = isGoogleMapsLikeUrl(url)
      || hostMatchesAny(host, ['instagram.com', 'facebook.com', 'm.facebook.com', 'tiktok.com', 'wa.me', 'whatsapp.com']);
    if (score < 2 && !(isKnownMapsOrSocialHost && score >= 1)) continue;
    const pathSegments = getSafePathSegments(url);
    const firstSegment = pathSegments[0] || '';

    if (!links.mapsUrl && isGoogleMapsLikeUrl(url)) {
      links.mapsUrl = normalizeExternalUrl(url);
      continue;
    }
    if (!links.instagramUrl && hostMatchesAny(host, ['instagram.com']) && !blockedInstagramSegments.includes(firstSegment)) {
      links.instagramUrl = url;
      continue;
    }
    if (!links.facebookUrl && hostMatchesAny(host, ['facebook.com']) && !blockedFacebookSegments.includes(firstSegment)) {
      links.facebookUrl = url;
      continue;
    }
    if (!links.tiktokUrl && hostMatchesAny(host, ['tiktok.com']) && !blockedTikTokSegments.includes(firstSegment)) {
      links.tiktokUrl = url;
      continue;
    }
    if (!links.whatsappUrl && hostMatchesAny(host, ['wa.me', 'whatsapp.com']) && (url.includes('wa.me/') || url.includes('whatsapp.com/'))) {
      links.whatsappUrl = url;
      continue;
    }
    if (!links.websiteUrl && !hostMatchesAny(host, blockedWebsiteDomains)) {
      links.websiteUrl = url;
    }
  }

  return links;
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeExternalUrl(rawUrl: string, baseUrl?: string): string {
  const value = toTrimmedString(rawUrl);
  if (!value) return '';
  try {
    const url = baseUrl ? new URL(value, baseUrl) : new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function mergeReviewSnippets(
  primary: GroundedPlaceCard['reviewSnippets'],
  secondary: GroundedPlaceCard['reviewSnippets'],
): GroundedPlaceCard['reviewSnippets'] {
  const merged: GroundedPlaceCard['reviewSnippets'] = [];
  const seen = new Set<string>();
  for (const review of [...(primary || []), ...(secondary || [])]) {
    if (!review || typeof review !== 'object') continue;
    const key = [
      toTrimmedString(review.reviewId),
      toTrimmedString(review.googleMapsUri),
      toTrimmedString(review.uri),
      toTrimmedString(review.snippet),
      toTrimmedString(review.title),
    ].find(Boolean);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({
      uri: toTrimmedString(review.uri),
      googleMapsUri: toTrimmedString(review.googleMapsUri),
      title: toTrimmedString(review.title),
      reviewId: toTrimmedString(review.reviewId),
      snippet: toTrimmedString(review.snippet),
    });
  }
  return merged.slice(0, 4);
}

function extractMarkdownLinks(value: string): Array<{ label: string; url: string }> {
  const matches: Array<{ label: string; url: string }> = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    matches.push({
      label: toTrimmedString(match[1]),
      url: toTrimmedString(match[2]),
    });
  }
  return matches;
}

function stripMarkdownLinks(value: string): string {
  return toTrimmedString(value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1'));
}

function normalizeLikelyExternalUrl(rawUrl: string): string {
  const value = toTrimmedString(rawUrl);
  if (!value) return '';
  return normalizeExternalUrl(value) || normalizeExternalUrl(`https://${value.replace(/^\/+/, '')}`);
}

function extractDirectUrls(value: string): string[] {
  return (value.match(/https?:\/\/[^\s)]+/gi) || []).map((entry) => toTrimmedString(entry));
}

function applyExtractedLinksToPlace(place: GroundedPlaceCard, value: string) {
  const candidates = [
    ...extractMarkdownLinks(value).map((entry) => entry.url),
    ...extractDirectUrls(value),
  ];

  for (const candidate of candidates) {
    const url = normalizeLikelyExternalUrl(candidate);
    if (!url) continue;
    const host = getSafeHostname(url);
    if (!host) continue;

    if (!place.mapsUrl && isGoogleMapsLikeUrl(url)) {
      place.mapsUrl = url;
      continue;
    }
    if (!place.instagramUrl && hostMatchesAny(host, ['instagram.com'])) {
      place.instagramUrl = url;
      continue;
    }
    if (!place.facebookUrl && hostMatchesAny(host, ['facebook.com', 'm.facebook.com'])) {
      place.facebookUrl = url;
      continue;
    }
    if (!place.tiktokUrl && hostMatchesAny(host, ['tiktok.com'])) {
      place.tiktokUrl = url;
      continue;
    }
    if (!place.whatsappUrl && hostMatchesAny(host, ['wa.me', 'whatsapp.com'])) {
      place.whatsappUrl = url;
      continue;
    }
    if (!place.websiteUrl && !hostMatchesAny(host, ['google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl', 'instagram.com', 'facebook.com', 'm.facebook.com', 'tiktok.com', 'wa.me', 'whatsapp.com'])) {
      place.websiteUrl = url;
    }
  }
}

function normalizePlaceMatchKey(name: string, address: string): string {
  return normalizeBusinessLookupText(`${toTrimmedString(name)} ${toTrimmedString(address)}`);
}

function createGroundedPlaceCard(seed: Partial<GroundedPlaceCard> = {}): GroundedPlaceCard {
  return {
    placeId: toTrimmedString(seed.placeId),
    name: toTrimmedString(seed.name),
    address: toTrimmedString(seed.address),
    latitude: typeof seed.latitude === 'number' ? seed.latitude : null,
    longitude: typeof seed.longitude === 'number' ? seed.longitude : null,
    rating: typeof seed.rating === 'number' ? seed.rating : null,
    userRatingCount: typeof seed.userRatingCount === 'number' ? seed.userRatingCount : null,
    websiteUrl: normalizeLikelyExternalUrl(toTrimmedString(seed.websiteUrl)),
    phone: toTrimmedString(seed.phone),
    email: normalizeEmail(seed.email),
    openNow: typeof seed.openNow === 'boolean' ? seed.openNow : null,
    businessStatus: toTrimmedString(seed.businessStatus),
    reason: toTrimmedString(seed.reason),
    vibe: toTrimmedString(seed.vibe),
    mustTry: toTrimmedString(seed.mustTry),
    editorialSummary: toTrimmedString(seed.editorialSummary),
    reviewSnippets: Array.isArray(seed.reviewSnippets) ? mergeReviewSnippets(seed.reviewSnippets, []) : [],
    mapsUrl: normalizeLikelyExternalUrl(toTrimmedString(seed.mapsUrl)),
    instagramUrl: normalizeLikelyExternalUrl(toTrimmedString(seed.instagramUrl)),
    facebookUrl: normalizeLikelyExternalUrl(toTrimmedString(seed.facebookUrl)),
    tiktokUrl: normalizeLikelyExternalUrl(toTrimmedString(seed.tiktokUrl)),
    whatsappUrl: normalizeLikelyExternalUrl(toTrimmedString(seed.whatsappUrl)),
    photoUrl: toTrimmedString(seed.photoUrl),
    openingHours: Array.isArray(seed.openingHours) ? seed.openingHours.filter((h) => typeof h === 'string' && h.trim()) : [],
  };
}

function parseGroundedPlacesFromText(text: string): GroundedPlaceCard[] {
  const places: GroundedPlaceCard[] = [];
  let current: GroundedPlaceCard | null = null;

  const commit = () => {
    if (!current) return;
    if (current.name) {
      places.push(current);
    }
    current = null;
  };

  for (const rawLine of (text || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const bulletBoldMatch = line.match(/^(?:[-*â€¢]|\d+\.)\s+\*\*([^*]+)\*\*\s*(.*)$/);
    if (!bulletBoldMatch) continue;

    const boldText = toTrimmedString(bulletBoldMatch[1]);
    const rest = toTrimmedString(bulletBoldMatch[2]);

    if (!boldText.endsWith(':')) {
      commit();
      current = createGroundedPlaceCard({ name: boldText });
      continue;
    }

    if (!current) continue;

    const field = boldText.slice(0, -1).trim().toLowerCase();
    const links = extractMarkdownLinks(rest);
    const plain = stripMarkdownLinks(rest);
    applyExtractedLinksToPlace(current, rest);

    if (field === 'reason') {
      current.reason = plain;
      continue;
    }

    if (field === 'vibe') {
      current.vibe = plain;
      continue;
    }

    if (field === 'must-try' || field === 'must try') {
      current.mustTry = plain;
      continue;
    }

    if (field === 'summary' || field === 'description' || field === 'editorial summary') {
      current.editorialSummary = current.editorialSummary
        ? `${current.editorialSummary} ${plain}`.trim()
        : plain;
      continue;
    }

    if (field === 'status') {
      current.businessStatus = plain;
      if (/\bopen\b/i.test(plain)) current.openNow = true;
      if (/\bclosed\b/i.test(plain)) current.openNow = false;
      continue;
    }

    if (field === 'rating') {
      const match = plain.match(/(\d+(?:\.\d+)?)/);
      const parsed = match ? toFiniteNumber(match[1]) : null;
      if (parsed !== null) current.rating = parsed;
      continue;
    }

    if (field === 'google reviews' || field === 'reviews') {
      const match = plain.match(/([\d,]+)/);
      const parsed = match ? Number(match[1].replace(/,/g, '')) : NaN;
      if (Number.isFinite(parsed)) current.userRatingCount = parsed;
      continue;
    }

    if (field === 'google maps' || field === 'google maps link' || field === 'maps' || field === 'maps link' || field === 'location') {
      current.mapsUrl = normalizeLikelyExternalUrl(links[0]?.url || plain);
      continue;
    }

    if (field === 'phone') {
      const telLink = links.find((entry) => /^tel:/i.test(entry.url));
      if (telLink?.label) {
        current.phone = telLink.label;
      } else {
        const match = plain.match(/(\+\d[\d\s()\-]{5,}\d)/);
        if (match?.[1]) current.phone = match[1].replace(/\s+/g, ' ').trim();
      }
      continue;
    }

    if (field === 'website') {
      current.websiteUrl = normalizeLikelyExternalUrl(links[0]?.url || plain);
      continue;
    }

    if (field === 'instagram') {
      current.instagramUrl = normalizeLikelyExternalUrl(links[0]?.url || plain);
      continue;
    }

    if (field === 'whatsapp') {
      current.whatsappUrl = normalizeLikelyExternalUrl(links[0]?.url || plain);
      continue;
    }

    if (field === 'facebook') {
      current.facebookUrl = normalizeLikelyExternalUrl(links[0]?.url || plain);
      continue;
    }

    if (field === 'tiktok') {
      current.tiktokUrl = normalizeLikelyExternalUrl(links[0]?.url || plain);
      continue;
    }

    if (field === 'social' || field === 'socials' || field === 'social link' || field === 'social links') {
      continue;
    }

    if (field === 'email') {
      const mailtoLink = links.find((entry) => /^mailto:/i.test(entry.url));
      current.email = normalizeEmail(mailtoLink?.label || plain);
    }
  }

  commit();
  return places;
}

function parseGroundedPlacesFromTextLoose(text: string): GroundedPlaceCard[] {
  const places: GroundedPlaceCard[] = [];
  let current: GroundedPlaceCard | null = null;
  const knownLabelPattern = /^(Reason|Vibe|Must-?Try|Google Maps|Maps(?: Link)?|Location|Phone|Website|Instagram|Facebook|TikTok|WhatsApp|Email|Rating|Google Reviews|Reviews|Social(?: Links?)?|Socials?)\s*:/i;
  const segmentPattern = /(Reason|Vibe|Must-?Try|Google Maps|Maps(?: Link)?|Location|Phone|Website|Instagram|Facebook|TikTok|WhatsApp|Email|Rating|Google Reviews|Reviews|Social(?: Links?)?|Socials?)\s*:/gi;

  const commit = () => {
    if (!current) return;
    if (current.name) {
      places.push(current);
    }
    current = null;
  };

  const extractSegments = (value: string) => {
    const matches = Array.from(value.matchAll(segmentPattern));
    if (matches.length === 0) return [] as Array<{ label: string; value: string }>;
    return matches.map((match, index) => {
      const start = match.index ?? 0;
      const label = match[1] || '';
      const valueStart = start + match[0].length;
      const valueEnd = index + 1 < matches.length ? (matches[index + 1].index ?? value.length) : value.length;
      return {
        label: label.toLowerCase(),
        value: value.slice(valueStart, valueEnd).trim(),
      };
    });
  };

  for (const rawLine of (text || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const bulletMatch = line.match(/^(?:[-*â€¢]|\d+\.)\s+(.*)$/);
    const rawValue = (bulletMatch?.[1] || line).trim();
    const segmentSource = rawValue.replace(/\*\*([^*]+)\*\*/g, '$1').trim();
    const plainLine = toTrimmedString(segmentSource);
    if (!plainLine) continue;

    if (bulletMatch && !knownLabelPattern.test(plainLine) && !plainLine.includes(':')) {
      commit();
      current = createGroundedPlaceCard({ name: plainLine });
      continue;
    }

    const boldHeadingMatch = line.match(/^\*\*([^*:]+)\*\*\s*$/);
    if (boldHeadingMatch && !knownLabelPattern.test(boldHeadingMatch[1].trim())) {
      commit();
      current = createGroundedPlaceCard({ name: toTrimmedString(boldHeadingMatch[1]) });
      continue;
    }

    const segments = extractSegments(segmentSource);
    if (!current || segments.length === 0) continue;

    for (const segment of segments) {
      const segmentRawValue = segment.value.replace(/^[-–—]\s*/, '').trim();
      const plain = toTrimmedString(segmentRawValue);
      if (!plain) continue;

      const links = extractMarkdownLinks(segmentRawValue);
      const directUrls = extractDirectUrls(segmentRawValue);
      const firstUrl = normalizeLikelyExternalUrl(links[0]?.url || directUrls[0] || plain);
      const field = segment.label;
      applyExtractedLinksToPlace(current, segmentRawValue);

      if (field === 'reason') {
        current.reason = current.reason || plain;
        continue;
      }

      if (field === 'vibe') {
        current.vibe = current.vibe || plain;
        continue;
      }

      if (field === 'must-try' || field === 'must try' || field === 'musttry') {
        current.mustTry = current.mustTry || plain;
        continue;
      }

      if (field === 'rating') {
        const match = plain.match(/(\d+(?:\.\d+)?)/);
        const parsed = match ? toFiniteNumber(match[1]) : null;
        if (parsed !== null) current.rating = parsed;
        continue;
      }

      if (field === 'google reviews' || field === 'reviews') {
        const match = plain.match(/([\d,]+)/);
        const parsed = match ? Number(match[1].replace(/,/g, '')) : NaN;
        if (Number.isFinite(parsed)) current.userRatingCount = parsed;
        continue;
      }

      if (field === 'google maps' || field === 'google maps link' || field === 'maps' || field === 'maps link' || field === 'location') {
        current.mapsUrl = current.mapsUrl || firstUrl;
        continue;
      }

      if (field === 'phone') {
        const telLink = links.find((entry) => /^tel:/i.test(entry.url));
        if (telLink?.label) {
          current.phone = current.phone || telLink.label;
        } else {
          const match = plain.match(/(\+\d[\d\s()\-]{5,}\d)/);
          if (match?.[1]) current.phone = current.phone || match[1].replace(/\s+/g, ' ').trim();
        }
        continue;
      }

      if (field === 'website') {
        current.websiteUrl = current.websiteUrl || firstUrl;
        continue;
      }

      if (field === 'instagram') {
        current.instagramUrl = current.instagramUrl || firstUrl;
        continue;
      }

      if (field === 'facebook') {
        current.facebookUrl = current.facebookUrl || firstUrl;
        continue;
      }

      if (field === 'tiktok') {
        current.tiktokUrl = current.tiktokUrl || firstUrl;
        continue;
      }

      if (field === 'whatsapp') {
        current.whatsappUrl = current.whatsappUrl || firstUrl;
        continue;
      }

      if (field === 'email') {
        const mailtoLink = links.find((entry) => /^mailto:/i.test(entry.url));
        current.email = normalizeEmail(current.email || mailtoLink?.label || plain);
      }
    }
  }

  commit();
  return places;
}

function mergeGroundedPlaceCard(base: GroundedPlaceCard, patch: Partial<GroundedPlaceCard>): GroundedPlaceCard {
  return {
    ...base,
    name: base.name || toTrimmedString(patch.name),
    address: base.address || toTrimmedString(patch.address),
    latitude: base.latitude ?? (typeof patch.latitude === 'number' ? patch.latitude : null),
    longitude: base.longitude ?? (typeof patch.longitude === 'number' ? patch.longitude : null),
    rating: base.rating ?? (typeof patch.rating === 'number' ? patch.rating : null),
    userRatingCount: base.userRatingCount ?? (typeof patch.userRatingCount === 'number' ? patch.userRatingCount : null),
    websiteUrl: base.websiteUrl || normalizeLikelyExternalUrl(toTrimmedString(patch.websiteUrl)),
    phone: base.phone || toTrimmedString(patch.phone),
    email: normalizeEmail(base.email) || normalizeEmail(patch.email),
    openNow: typeof base.openNow === 'boolean' ? base.openNow : (typeof patch.openNow === 'boolean' ? patch.openNow : null),
    businessStatus: base.businessStatus || toTrimmedString(patch.businessStatus),
    reason: base.reason || toTrimmedString(patch.reason),
    vibe: base.vibe || toTrimmedString(patch.vibe),
    mustTry: base.mustTry || toTrimmedString(patch.mustTry),
    editorialSummary: base.editorialSummary || toTrimmedString(patch.editorialSummary),
    reviewSnippets: mergeReviewSnippets(base.reviewSnippets, Array.isArray(patch.reviewSnippets) ? patch.reviewSnippets : []),
    mapsUrl: base.mapsUrl || normalizeLikelyExternalUrl(toTrimmedString(patch.mapsUrl)),
    instagramUrl: base.instagramUrl || normalizeLikelyExternalUrl(toTrimmedString(patch.instagramUrl)),
    facebookUrl: base.facebookUrl || normalizeLikelyExternalUrl(toTrimmedString(patch.facebookUrl)),
    tiktokUrl: base.tiktokUrl || normalizeLikelyExternalUrl(toTrimmedString(patch.tiktokUrl)),
    whatsappUrl: base.whatsappUrl || normalizeLikelyExternalUrl(toTrimmedString(patch.whatsappUrl)),
    photoUrl: base.photoUrl || toTrimmedString(patch.photoUrl),
    openingHours: (Array.isArray(base.openingHours) && base.openingHours.length > 0)
      ? base.openingHours
      : (Array.isArray(patch.openingHours) ? patch.openingHours : []),
  };
}

async function fetchGooglePlaceDetails(place: GroundedPlaceCard): Promise<Partial<GroundedPlaceCard>> {
  if (!GOOGLE_PLACES_API_KEY || !place.placeId) return {};

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(place.placeId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,googleMapsUri,websiteUri,internationalPhoneNumber,nationalPhoneNumber,rating,userRatingCount,businessStatus,currentOpeningHours,regularOpeningHours,reviews,editorialSummary,photos',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return {};

    const data = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!data || typeof data !== 'object') return {};

    const displayName = data.displayName && typeof data.displayName === 'object' ? data.displayName as Record<string, unknown> : null;
    const editorialSummary = data.editorialSummary && typeof data.editorialSummary === 'object' ? data.editorialSummary as Record<string, unknown> : null;
    const location = data.location && typeof data.location === 'object' ? data.location as Record<string, unknown> : null;
    const currentOpeningHours = data.currentOpeningHours && typeof data.currentOpeningHours === 'object' ? data.currentOpeningHours as Record<string, unknown> : null;
    const regularOpeningHours = data.regularOpeningHours && typeof data.regularOpeningHours === 'object' ? data.regularOpeningHours as Record<string, unknown> : null;

    const mappedReviews = (Array.isArray(data.reviews) ? data.reviews : [])
      .map((entry) => {
        const review = entry && typeof entry === 'object' ? entry as Record<string, unknown> : null;
        if (!review) return null;
        const authorAttribution = review.authorAttribution && typeof review.authorAttribution === 'object'
          ? review.authorAttribution as Record<string, unknown>
          : null;
        const reviewText = review.text && typeof review.text === 'object' ? review.text as Record<string, unknown> : null;
        const originalText = review.originalText && typeof review.originalText === 'object' ? review.originalText as Record<string, unknown> : null;
        const authorName = toTrimmedString(authorAttribution?.displayName);
        const relativeTime = toTrimmedString(review.relativePublishTimeDescription);
        const rating = toFiniteNumber(review.rating);
        const snippet = toTrimmedString(reviewText?.text) || toTrimmedString(originalText?.text);
        const googleMapsUri = normalizeExternalUrl(toTrimmedString(review.googleMapsUri));
        const titleParts = [
          authorName,
          typeof rating === 'number' ? `${rating.toFixed(1)}Γÿà` : '',
          relativeTime,
        ].filter(Boolean);
        return {
          publishedAt: Date.parse(toTrimmedString(review.publishTime)) || 0,
          review: {
            uri: googleMapsUri,
            googleMapsUri,
            title: titleParts.join(' ┬╖ '),
            reviewId: toTrimmedString(review.name),
            snippet,
          },
        };
      })
      .filter((entry) => !!entry && (!!entry.review.snippet || !!entry.review.googleMapsUri || !!entry.review.uri));

    const reviewSnippets: GroundedPlaceCard['reviewSnippets'] = [];
    mappedReviews
      .sort((a, b) => (b?.publishedAt || 0) - (a?.publishedAt || 0))
      .forEach((entry) => {
        if (!entry?.review || reviewSnippets.length >= 4) return;
        reviewSnippets.push(entry.review);
      });

    const placeLabel = toTrimmedString(displayName?.text) || place.name || place.address;
    const placeMapsUrl = normalizeExternalUrl(toTrimmedString(data.googleMapsUri))
      || (place.placeId
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeLabel)}&query_place_id=${encodeURIComponent(place.placeId)}`
        : (toFiniteNumber(location?.latitude) !== null && toFiniteNumber(location?.longitude) !== null
            ? `https://www.google.com/maps/search/?api=1&query=${toFiniteNumber(location?.latitude)},${toFiniteNumber(location?.longitude)}`
            : (placeLabel ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeLabel)}` : '')));

    const photos = Array.isArray(data.photos) ? data.photos : [];
    const firstPhoto = photos[0] && typeof photos[0] === 'object' ? photos[0] as Record<string, unknown> : null;
    const photoUrl = firstPhoto?.name ? `https://places.googleapis.com/v1/${firstPhoto.name}/media?key=${GOOGLE_PLACES_API_KEY}&maxWidthPx=400` : '';

    return {
      name: toTrimmedString(displayName?.text),
      address: toTrimmedString(data.formattedAddress),
      latitude: toFiniteNumber(location?.latitude),
      longitude: toFiniteNumber(location?.longitude),
      rating: toFiniteNumber(data.rating),
      userRatingCount: toFiniteNumber(data.userRatingCount),
      websiteUrl: normalizeExternalUrl(toTrimmedString(data.websiteUri)),
      phone: toTrimmedString(data.internationalPhoneNumber) || toTrimmedString(data.nationalPhoneNumber),
      openNow: typeof currentOpeningHours?.openNow === 'boolean'
        ? currentOpeningHours.openNow as boolean
        : (typeof regularOpeningHours?.openNow === 'boolean' ? regularOpeningHours.openNow as boolean : null),
      businessStatus: toTrimmedString(data.businessStatus),
      editorialSummary: toTrimmedString(editorialSummary?.text),
      openingHours: Array.isArray(regularOpeningHours?.weekdayDescriptions)
        ? (regularOpeningHours.weekdayDescriptions as string[])
        : (Array.isArray(currentOpeningHours?.weekdayDescriptions) ? (currentOpeningHours.weekdayDescriptions as string[]) : []),
      mapsUrl: placeMapsUrl,
      reviewSnippets,
      photoUrl,
    };
  } catch {
    return {};
  }
}

// Map a Places API v1 place object (from Details or Text Search) into our card shape.
function mapPlaceV1ToCard(data: Record<string, unknown>): Partial<GroundedPlaceCard> & { placeId?: string } {
  const displayName = data.displayName && typeof data.displayName === 'object' ? data.displayName as Record<string, unknown> : null;
  const editorialSummary = data.editorialSummary && typeof data.editorialSummary === 'object' ? data.editorialSummary as Record<string, unknown> : null;
  const location = data.location && typeof data.location === 'object' ? data.location as Record<string, unknown> : null;
  const currentOpeningHours = data.currentOpeningHours && typeof data.currentOpeningHours === 'object' ? data.currentOpeningHours as Record<string, unknown> : null;
  const regularOpeningHours = data.regularOpeningHours && typeof data.regularOpeningHours === 'object' ? data.regularOpeningHours as Record<string, unknown> : null;

  const mappedReviews = (Array.isArray(data.reviews) ? data.reviews : [])
    .map((entry) => {
      const review = entry && typeof entry === 'object' ? entry as Record<string, unknown> : null;
      if (!review) return null;
      const authorAttribution = review.authorAttribution && typeof review.authorAttribution === 'object'
        ? review.authorAttribution as Record<string, unknown>
        : null;
      const reviewText = review.text && typeof review.text === 'object' ? review.text as Record<string, unknown> : null;
      const originalText = review.originalText && typeof review.originalText === 'object' ? review.originalText as Record<string, unknown> : null;
      const authorName = toTrimmedString(authorAttribution?.displayName);
      const relativeTime = toTrimmedString(review.relativePublishTimeDescription);
      const rating = toFiniteNumber(review.rating);
      const snippet = toTrimmedString(reviewText?.text) || toTrimmedString(originalText?.text);
      const googleMapsUri = normalizeExternalUrl(toTrimmedString(review.googleMapsUri));
      const titleParts = [
        authorName,
        typeof rating === 'number' ? `${rating.toFixed(1)}★` : '',
        relativeTime,
      ].filter(Boolean);
      return {
        publishedAt: Date.parse(toTrimmedString(review.publishTime)) || 0,
        review: {
          uri: googleMapsUri,
          googleMapsUri,
          title: titleParts.join(' · '),
          reviewId: toTrimmedString(review.name),
          snippet,
        },
      };
    })
    .filter((entry) => !!entry && (!!entry.review.snippet || !!entry.review.googleMapsUri || !!entry.review.uri));

  const reviewSnippets: GroundedPlaceCard['reviewSnippets'] = [];
  mappedReviews
    .sort((a, b) => (b?.publishedAt || 0) - (a?.publishedAt || 0))
    .forEach((entry) => {
      if (!entry?.review || reviewSnippets.length >= 4) return;
      reviewSnippets.push(entry.review);
    });

  const placeId = toTrimmedString(data.id);
  const placeLabel = toTrimmedString(displayName?.text) || toTrimmedString(data.formattedAddress);
  const placeMapsUrl = normalizeExternalUrl(toTrimmedString(data.googleMapsUri))
    || (placeId
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeLabel)}&query_place_id=${encodeURIComponent(placeId)}`
      : (toFiniteNumber(location?.latitude) !== null && toFiniteNumber(location?.longitude) !== null
          ? `https://www.google.com/maps/search/?api=1&query=${toFiniteNumber(location?.latitude)},${toFiniteNumber(location?.longitude)}`
          : (placeLabel ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeLabel)}` : '')));

  const photos = Array.isArray(data.photos) ? data.photos : [];
  const firstPhoto = photos[0] && typeof photos[0] === 'object' ? photos[0] as Record<string, unknown> : null;
  const photoUrl = (firstPhoto?.name && GOOGLE_PLACES_API_KEY) ? `https://places.googleapis.com/v1/${firstPhoto.name}/media?key=${GOOGLE_PLACES_API_KEY}&maxWidthPx=400` : '';

  return {
    placeId,
    name: toTrimmedString(displayName?.text),
    address: toTrimmedString(data.formattedAddress),
    latitude: toFiniteNumber(location?.latitude),
    longitude: toFiniteNumber(location?.longitude),
    rating: toFiniteNumber(data.rating),
    userRatingCount: toFiniteNumber(data.userRatingCount),
    websiteUrl: normalizeExternalUrl(toTrimmedString(data.websiteUri)),
    phone: toTrimmedString(data.internationalPhoneNumber) || toTrimmedString(data.nationalPhoneNumber),
    openNow: typeof currentOpeningHours?.openNow === 'boolean'
      ? currentOpeningHours.openNow as boolean
      : (typeof regularOpeningHours?.openNow === 'boolean' ? regularOpeningHours.openNow as boolean : null),
    businessStatus: toTrimmedString(data.businessStatus),
    editorialSummary: toTrimmedString(editorialSummary?.text),
    openingHours: Array.isArray(regularOpeningHours?.weekdayDescriptions)
      ? (regularOpeningHours.weekdayDescriptions as string[])
      : (Array.isArray(currentOpeningHours?.weekdayDescriptions) ? (currentOpeningHours.weekdayDescriptions as string[]) : []),
    mapsUrl: placeMapsUrl,
    reviewSnippets,
    photoUrl,
  } as Partial<GroundedPlaceCard> & { placeId?: string };
}

// Resolve a place by free-text (name + area/city) via Places API Text Search and return
// rich details in ONE call. Used when we have no placeId (Google Search grounding path).
async function fetchGooglePlaceByText(place: GroundedPlaceCard, locationBias?: { latitude: number; longitude: number } | null): Promise<Partial<GroundedPlaceCard>> {
  if (!GOOGLE_PLACES_API_KEY) return {};
  const name = toTrimmedString(place.name);
  if (!name) return {};
  const textQuery = [name, toTrimmedString(place.address)].filter(Boolean).join(' ');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3800);
    const body: Record<string, unknown> = { textQuery, maxResultCount: 1 };
    if (locationBias?.latitude != null && locationBias?.longitude != null) {
      body.locationBias = { circle: { center: { latitude: locationBias.latitude, longitude: locationBias.longitude }, radius: 30000 } };
    }
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.websiteUri,places.internationalPhoneNumber,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.businessStatus,places.currentOpeningHours,places.regularOpeningHours,places.reviews,places.editorialSummary,places.photos',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('❌ PLACES TEXT SEARCH ERROR:', response.status, errText.slice(0, 300));
      return {};
    }
    const data = await response.json().catch(() => null) as Record<string, unknown> | null;
    const results = data && Array.isArray(data.places) ? data.places : [];
    const first = results[0] && typeof results[0] === 'object' ? results[0] as Record<string, unknown> : null;
    if (!first) {
      console.log('🔎 PLACES TEXT SEARCH: no match for', textQuery);
      return {};
    }
    const mapped = mapPlaceV1ToCard(first);
    let resolved: Partial<GroundedPlaceCard> = mapped;
    if ((!Array.isArray(mapped.reviewSnippets) || mapped.reviewSnippets.length === 0) && mapped.placeId) {
      const detailTarget = mergeGroundedPlaceCard(place, mapped);
      const detailData = await fetchGooglePlaceDetails(detailTarget);
      resolved = mergeGroundedPlaceCard(detailTarget, detailData);
    }
    console.log('🔎 PLACES TEXT SEARCH OK', textQuery, '| rating=', resolved.rating, '| reviews=', (resolved.reviewSnippets || []).length, '| photo=', resolved.photoUrl ? 'yes' : 'no', '| hours=', (resolved.openingHours || []).length);
    return resolved;
  } catch {
    return {};
  }
}

async function searchGooglePlacesForQuery(
  query: string,
  locationContext?: { latitude: number; longitude: number } | null,
  options?: { strictNearby?: boolean }
): Promise<GroundedPlaceCard[]> {
  if (!GOOGLE_PLACES_API_KEY) return [];
  const textQuery = toTrimmedString(query);
  if (!textQuery) return [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4200);
    const body: Record<string, unknown> = { textQuery, maxResultCount: 6 };
    if (locationContext?.latitude != null && locationContext?.longitude != null) {
      const circle = {
        center: { latitude: locationContext.latitude, longitude: locationContext.longitude },
        radius: options?.strictNearby ? 25000 : 30000,
      };
      if (options?.strictNearby) {
        body.locationRestriction = { circle };
        body.rankPreference = 'DISTANCE';
      } else {
        body.locationBias = { circle };
      }
    }

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.websiteUri,places.internationalPhoneNumber,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.businessStatus,places.currentOpeningHours,places.regularOpeningHours,places.reviews,places.editorialSummary,places.photos',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('❌ PLACES QUERY SEARCH ERROR:', response.status, errText.slice(0, 300));
      return [];
    }

    const data = await response.json().catch(() => null) as Record<string, unknown> | null;
    const results = data && Array.isArray(data.places) ? data.places : [];
    return results
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const placeData = entry as Record<string, unknown>;
        const mapped = mapPlaceV1ToCard(placeData);
        const placeId = toTrimmedString(mapped.placeId);
        const fallbackName = toTrimmedString(mapped.name) || toTrimmedString(placeData.formattedAddress) || 'Place';
        const latitude = typeof mapped.latitude === 'number' ? mapped.latitude : null;
        const longitude = typeof mapped.longitude === 'number' ? mapped.longitude : null;
        const defaultMapsUrl = placeId
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackName)}&query_place_id=${encodeURIComponent(placeId)}`
          : (latitude != null && longitude != null
              ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackName)}`);

        return {
          placeId,
          name: fallbackName,
          address: toTrimmedString(mapped.address),
          latitude,
          longitude,
          rating: typeof mapped.rating === 'number' ? mapped.rating : null,
          userRatingCount: typeof mapped.userRatingCount === 'number' ? mapped.userRatingCount : null,
          websiteUrl: normalizeLikelyExternalUrl(toTrimmedString(mapped.websiteUrl)),
          phone: toTrimmedString(mapped.phone),
          email: normalizeEmail(mapped.email),
          openNow: typeof mapped.openNow === 'boolean' ? mapped.openNow : null,
          businessStatus: toTrimmedString(mapped.businessStatus),
          reason: '',
          vibe: '',
          mustTry: '',
          editorialSummary: toTrimmedString(mapped.editorialSummary),
          reviewSnippets: Array.isArray(mapped.reviewSnippets) ? mapped.reviewSnippets : [],
          mapsUrl: normalizeLikelyExternalUrl(toTrimmedString(mapped.mapsUrl)) || defaultMapsUrl,
          instagramUrl: normalizeLikelyExternalUrl(toTrimmedString(mapped.instagramUrl)),
          facebookUrl: normalizeLikelyExternalUrl(toTrimmedString(mapped.facebookUrl)),
          tiktokUrl: normalizeLikelyExternalUrl(toTrimmedString(mapped.tiktokUrl)),
          whatsappUrl: normalizeLikelyExternalUrl(toTrimmedString(mapped.whatsappUrl)),
          photoUrl: toTrimmedString(mapped.photoUrl),
          openingHours: Array.isArray(mapped.openingHours) ? mapped.openingHours : [],
        } as GroundedPlaceCard;
      })
      .filter((place): place is GroundedPlaceCard => Boolean(place && (place.name || place.placeId)));
  } catch {
    return [];
  }
}

function extractSocialLinksFromHtml(html: string, baseUrl: string): Partial<GroundedPlaceCard> {
  const links: Partial<GroundedPlaceCard> = {};
  const candidates = new Set<string>();
  const emailCandidates = new Set<string>();
  const hrefRegex = /href\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;
  let hrefMatch: RegExpExecArray | null;
  while ((hrefMatch = hrefRegex.exec(html)) !== null) {
    const href = hrefMatch[1] || hrefMatch[2] || '';
    const normalized = normalizeExternalUrl(href, baseUrl);
    if (normalized) candidates.add(normalized);
  }
  const mailtoRegex = /mailto:([^"'\s>]+)/gi;
  let mailtoMatch: RegExpExecArray | null;
  while ((mailtoMatch = mailtoRegex.exec(html)) !== null) {
    const normalizedEmail = normalizeEmail(mailtoMatch[1]);
    if (normalizedEmail) emailCandidates.add(normalizedEmail);
  }
  const visibleEmailMatches = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  for (const candidateEmail of visibleEmailMatches) {
    const normalizedEmail = normalizeEmail(candidateEmail);
    if (normalizedEmail) emailCandidates.add(normalizedEmail);
  }
  const absoluteUrlRegex = /https?:\/\/[^\s"'<>]+/gi;
  const absoluteMatches = html.match(absoluteUrlRegex) || [];
  for (const match of absoluteMatches) {
    const normalized = normalizeExternalUrl(match);
    if (normalized) candidates.add(normalized);
  }

  const blockedInstagramSegments = ['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'locations', 'hashtag'];
  const blockedFacebookSegments = ['share', 'watch', 'photo', 'photos', 'events', 'groups', 'marketplace'];
  const blockedTikTokSegments = ['tag', 'music', 'discover', 'foryou'];

  for (const candidate of candidates) {
    const host = getSafeHostname(candidate);
    if (!host) continue;
    const pathSegments = getSafePathSegments(candidate);
    const firstSegment = pathSegments[0] || '';

    if (!links.instagramUrl && hostMatchesAny(host, ['instagram.com']) && !blockedInstagramSegments.includes(firstSegment)) {
      links.instagramUrl = candidate;
      continue;
    }
    if (!links.facebookUrl && hostMatchesAny(host, ['facebook.com']) && !blockedFacebookSegments.includes(firstSegment)) {
      links.facebookUrl = candidate;
      continue;
    }
    if (!links.tiktokUrl && hostMatchesAny(host, ['tiktok.com']) && !blockedTikTokSegments.includes(firstSegment)) {
      links.tiktokUrl = candidate;
      continue;
    }
    if (!links.whatsappUrl && hostMatchesAny(host, ['wa.me', 'whatsapp.com']) && (candidate.includes('wa.me/') || candidate.includes('whatsapp.com/'))) {
      links.whatsappUrl = candidate;
    }
  }

  if (!links.email && emailCandidates.size > 0) {
    links.email = Array.from(emailCandidates).sort((a, b) => a.length - b.length)[0] || '';
  }

  return links;
}

async function extractOfficialSocialLinksFromWebsite(websiteUrl: string): Promise<Partial<GroundedPlaceCard>> {
  const normalizedWebsiteUrl = normalizeExternalUrl(websiteUrl);
  if (!normalizedWebsiteUrl) return {};

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(normalizedWebsiteUrl, {
      method: 'GET',
      headers: { 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return {};
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) return {};
    const html = (await response.text()).slice(0, 120000);
    return extractSocialLinksFromHtml(html, response.url || normalizedWebsiteUrl);
  } catch {
    return {};
  }
}

async function enrichGroundedPlacesWithOfficialLinks(places: GroundedPlaceCard[]): Promise<GroundedPlaceCard[]> {
  if (!Array.isArray(places) || places.length === 0) return places;

  const enrichedTopPlaces = await Promise.allSettled(
    places.slice(0, 6).map(async (place) => {
      if (!place?.name && !place?.placeId) return place;

      // Step 1: Enrich with Google Places API (reviews, opening hours, phone, website, photos).
      // If we already have a placeId, fetch Details directly. Otherwise (Google Search grounding
      // path provides no placeId) resolve the place by name+area via Text Search in one call.
      const locationBias = (typeof place.latitude === 'number' && typeof place.longitude === 'number')
        ? { latitude: place.latitude, longitude: place.longitude }
        : null;
      const placesApiData = place.placeId
        ? await fetchGooglePlaceDetails(place)
        : await fetchGooglePlaceByText(place, locationBias);
      let enrichedPlace = mergeGroundedPlaceCard(place, placesApiData);

      // Step 2: If we have a website URL, scrape its HTML for social profile links
      if (enrichedPlace.websiteUrl) {
        enrichedPlace = mergeGroundedPlaceCard(enrichedPlace, await extractOfficialSocialLinksFromWebsite(enrichedPlace.websiteUrl));
      }

      // No Tavily. Google grounding web chunks already ran pickVerifiedBusinessLinks
      // earlier in the pipeline before this function is called.
      return enrichedPlace;
    })
  );

  return places.map((place, index) => {
    if (index >= enrichedTopPlaces.length) return place;
    const settled = enrichedTopPlaces[index];
    return settled.status === 'fulfilled' ? settled.value : place;
  });
}

// === WOLFRAM UNIVERSAL KNOWLEDGE ENGINE ===

// Strip conversational noise so Wolfram receives a clean subject string
function getCleanSubject(message: string): string {
  if (!message) return '';
  const cleaned = message.replace(/\?+$/, '').replace(/[╪ƒ!]+$/, '').trim();

  // SHORT-CIRCUIT: For person/entity queries, extract proper nouns only (capitalized words after the opener)
  // "Who was Bill Clinton" ΓåÆ "Bill Clinton"
  // "Tell me about Albert Einstein" ΓåÆ "Albert Einstein"
  const entityOpenerMatch = cleaned.match(
    /^(?:who\s+(?:is|was)|tell\s+me\s+about(?:\s+the)?|what\s+is(?:\s+the)?)\s+(.+)$/i
  );
  if (entityOpenerMatch) {
    const rest = entityOpenerMatch[1].trim();
    // Extract consecutive capitalized words (proper noun sequence)
    const properNounMatch = rest.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    if (properNounMatch && properNounMatch[1].length >= 2) {
        return properNounMatch[1];
    }
    // No proper nouns found ΓÇö return the rest stripped of filler
    const fillerStripped = rest
      .replace(/^(the\s+(city|country|life|history|story|process|concept|meaning)\s+of\s+)/i, '')
      .replace(/^(the\s+)/i, '')
      .trim();
    return fillerStripped;
  }

  let s = cleaned;
  // Strip bot name references
  s = s.replace(/\b(wakto|waqti|wakti|jester|assistant|hey|hi|hello|ok|okay)\b/gi, '');
  // Iteratively strip leading openers (run twice to handle nested: "explain the history of X")
  const leadingOpeners = /^(what\s+is\s+the\s+(city|country|life|history|story|process|concept|meaning)\s+of|what\s+is|what\s+are|explain\s+the\s+(process|history|concept|life)\s+of|explain|describe|give\s+me\s+info\s+on|information\s+about|facts\s+about|about|define|meaning\s+of|what\s+do\s+you\s+know\s+about|can\s+you\s+explain|can\s+you\s+tell\s+me\s+about|i\s+want\s+to\s+know\s+about|i\s+need\s+to\s+know\s+about|help\s+me\s+understand|show\s+me|list\s+the|summary\s+of|the)\s+/i;
  s = s.replace(leadingOpeners, '').replace(leadingOpeners, '');
  // Strip trailing instructional modifiers
  s = s
    .replace(/\s+in\s+\d+\s+\w+\s+steps?\s*$/i, '')
    .replace(/\s+in\s+simple\s+terms?\s*$/i, '')
    .replace(/\s+in\s+\d+\s+steps?\s*$/i, '')
    .replace(/\s+(detailed\s+)?report\s*$/i, '')
    .replace(/\s+for\s+me\s*$/i, '')
    .replace(/\s+please\s*$/i, '');
  return s.replace(/\s+/g, ' ').trim();
}

// Internal translation bridge: translate Arabic subject to English for Wolfram API use only
async function translateSubjectToEnglish(subject: string): Promise<string> {
  try {
    const key = getGeminiApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${key}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: `Translate this academic topic to English. Return ONLY the translated term, nothing else, no explanation:\n${subject}` }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 50 },
    };
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 2000);
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    clearTimeout(tid);
    if (!resp.ok) return subject;
    const data = await resp.json();
    const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (translated && translated.length > 0 && translated.length < 200) {
      return translated;
    }
    return subject;
  } catch {
    return subject; // fail silently, use original
  }
}

// LLM API: modern endpoint that returns a clean fact sheet for any academic subject
async function queryWolframLLM(subject: string, timeoutMs: number = 8000): Promise<{
  success: boolean;
  factSheet?: string;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const url = `https://www.wolframalpha.com/api/v1/llm-api?appid=${WOLFRAM_LLM_APP_ID}&input=${encodeURIComponent(subject)}&maxchars=3000`;
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!resp.ok) {
      console.warn(`ΓÜá∩╕Å WOLFRAM LLM: HTTP ${resp.status}`);
      return { success: false, error: `HTTP ${resp.status}` };
    }
    const text = await resp.text();
    if (!text || text.trim().length < 20) {
      return { success: false, error: 'Empty response' };
    }
    return { success: true, factSheet: text.trim() };
  } catch (err: unknown) {
    const isAbort = err && typeof err === 'object' && 'name' in err && (err as { name?: unknown }).name === 'AbortError';
    console.warn(isAbort ? `ΓÜá∩╕Å WOLFRAM LLM: Timeout after ${timeoutMs}ms` : `ΓÜá∩╕Å WOLFRAM LLM: Error`);
    return { success: false, error: isAbort ? 'Timeout' : String(err) };
  }
}

// === WOLFRAM|ALPHA HELPER (legacy v2/query ΓÇö used for math/calculation outside study mode) ===
async function queryWolfram(input: string, timeoutMs: number = 4000): Promise<{
  success: boolean;
  answer?: string;
  steps?: string[];
  interpretation?: string;
  error?: string;
}> {
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

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('ΓÜá∩╕Å WOLFRAM: HTTP error', response.status);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const qr = data?.queryresult;

    if (!qr || qr.success === false || qr.error === true) {
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

    return { success: true, answer, steps: steps.length > 0 ? steps : undefined, interpretation };

  } catch (err: unknown) {
    const errName = (err && typeof err === 'object' && 'name' in err) ? (err as { name?: unknown }).name : undefined;
    const errMessage = err instanceof Error ? err.message : String(err);
    if (errName === 'AbortError') {
      console.warn('ΓÜá∩╕Å WOLFRAM: Timeout after', timeoutMs, 'ms');
      return { success: false, error: 'Timeout' };
    }
    console.error('Γ¥î WOLFRAM: Error:', errMessage);
    return { success: false, error: errMessage };
  }
}

// === WOLFRAM SUMMARY BOXES API (for entity lookups: countries, people, chemicals, etc.) ===
interface SummaryBoxResult {
  success: boolean;
  domain?: string;
  summary?: string;
  rawHtml?: string;
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
    /^\s*(┘à┘å ┘ç┘ê|┘à┘å ┘â╪º┘å╪¬|┘à╪º ┘ç┘ê|┘à╪º ┘ç┘è|┘à╪º╪░╪º ╪¬╪╣╪▒┘ü ╪╣┘å|╪º╪┤╪▒╪¡|╪╣╪▒┘ü|┘à┘ä╪«╪╡ ╪╣┘å)\s+/,
    ''
  );
  const cleaned = strippedArabic.replace(/[?╪ƒ!]+\s*$/g, '').trim();
  return cleaned.length >= 2 ? cleaned : trimmed;
}

async function queryWolframSummaryBox(input: string, timeoutMs: number = 3000): Promise<SummaryBoxResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Step 1: Get the summary box path from Query Recognizer
    // NOTE: Query Recognizer permissions are provisioned on WOLFRAM_LLM_APP_ID
    // (U2W74EHLQX), not the legacy WOLFRAM_APP_ID. Using the wrong key here
    // was silently failing for all non-study chat entity lookups.
    const recognizerUrl = `https://www.wolframalpha.com/queryrecognizer/query.jsp?appid=${WOLFRAM_LLM_APP_ID}&mode=Default&i=${encodeURIComponent(input)}`;

    const recognizerResp = await fetch(recognizerUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!recognizerResp.ok) {
      clearTimeout(timeoutId);
      console.warn('ΓÜá∩╕Å WOLFRAM SUMMARY: Recognizer HTTP error', recognizerResp.status);
      return { success: false, error: `Recognizer HTTP ${recognizerResp.status}` };
    }

    const recognizerXml = await recognizerResp.text();
    
    // Parse XML to extract path and domain
    const pathMatch = recognizerXml.match(/summarybox\s+path="([^"]+)"/);
    const domainMatch = recognizerXml.match(/domain="([^"]+)"/);
    const acceptedMatch = recognizerXml.match(/accepted="([^"]+)"/);

    if (!pathMatch || acceptedMatch?.[1] === 'false') {
      clearTimeout(timeoutId);
      return { success: false, error: 'No summary box path' };
    }

    const path = pathMatch[1];
    const domain = domainMatch?.[1] || 'unknown';

    // Step 2: Get the summary box content
    const summaryUrl = `https://www.wolframalpha.com/summaryboxes/v1/query?appid=${WOLFRAM_LLM_APP_ID}&path=${encodeURIComponent(path)}`;
    
    const summaryResp = await fetch(summaryUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!summaryResp.ok) {
      console.warn('ΓÜá∩╕Å WOLFRAM SUMMARY: Summary HTTP error', summaryResp.status);
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
      return { success: false, error: 'Empty summary' };
    }

    return { success: true, domain, summary: textContent, rawHtml: summaryHtml, path };

  } catch (err: unknown) {
    const errName = (err && typeof err === 'object' && 'name' in err) ? (err as { name?: unknown }).name : undefined;
    const errMessage = err instanceof Error ? err.message : String(err);
    if (errName === 'AbortError') {
      console.warn('ΓÜá∩╕Å WOLFRAM SUMMARY: Timeout after', timeoutMs, 'ms');
      return { success: false, error: 'Timeout' };
    }
    console.error('Γ¥î WOLFRAM SUMMARY: Error:', errMessage);
    return { success: false, error: errMessage };
  }
}

// === STUDY MODE OCR: Extract text/math from images using Gemini Vision ===
interface StudyOCRResult {
  success: boolean;
  extractedText?: string;
  questionType?: 'math' | 'science' | 'language' | 'history' | 'general';
  error?: string;
}

async function extractTextFromImageForStudy(
  imageBase64: string,
  mimeType: string,
  userPrompt: string,
  language: string
): Promise<StudyOCRResult> {
  try {
    const key = getGeminiApiKey();
    // Use Gemini 3.1 Flash-Lite for fast, accurate OCR
    const model = 'gemini-3.1-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const ocrPrompt = language === 'ar'
      ? `╪ú┘å╪¬ ╪«╪¿┘è╪▒ ┘ü┘è ╪º╪│╪¬╪«╪▒╪º╪¼ ╪º┘ä┘å╪╡┘ê╪╡ ┘à┘å ╪º┘ä╪╡┘ê╪▒ ╪º┘ä╪¬╪╣┘ä┘è┘à┘è╪⌐. ┘à┘ç┘à╪¬┘â:
1. ╪º╪│╪¬╪«╪▒╪¼ ┘â┘ä ╪º┘ä┘å╪╡ ┘ê╪º┘ä╪ú╪▒┘é╪º┘à ┘ê╪º┘ä┘à╪╣╪º╪»┘ä╪º╪¬ ┘ê╪º┘ä╪▒┘à┘ê╪▓ ┘à┘å ╪º┘ä╪╡┘ê╪▒╪⌐ ╪¿╪»┘é╪⌐ ╪¬╪º┘à╪⌐
2. ╪Ñ╪░╪º ┘â╪º┘å╪¬ ┘à╪╣╪º╪»┘ä╪⌐ ╪▒┘è╪º╪╢┘è╪⌐╪î ╪º┘â╪¬╪¿┘ç╪º ╪¿╪╡┘è╪║╪⌐ ┘å╪╡┘è╪⌐ ┘ê╪º╪╢╪¡╪⌐ (┘à╪½┘ä: 2x + 3 = 7)
3. ╪Ñ╪░╪º ┘â╪º┘å ╪│╪ñ╪º┘ä ╪º╪«╪¬┘è╪º╪▒ ┘à┘å ┘à╪¬╪╣╪»╪»╪î ╪º┘â╪¬╪¿ ╪º┘ä╪│╪ñ╪º┘ä ┘ê╪¼┘à┘è╪╣ ╪º┘ä╪«┘è╪º╪▒╪º╪¬
4. ╪¡╪º┘ü╪╕ ╪╣┘ä┘ë ╪º┘ä╪¬┘å╪│┘è┘é ╪º┘ä╪ú╪╡┘ä┘è ┘é╪»╪▒ ╪º┘ä╪Ñ┘à┘â╪º┘å

╪│┘è╪º┘é ╪º┘ä┘à╪│╪¬╪«╪»┘à: "${userPrompt}"

╪ú╪╣╪» ╪º┘ä┘å╪╡ ╪º┘ä┘à╪│╪¬╪«╪▒╪¼ ┘ü┘é╪╖╪î ╪¿╪»┘ê┘å ╪┤╪▒╪¡ ╪ú┘ê ╪¬╪¡┘ä┘è┘ä.`
      : `You are an expert at extracting text from educational images. Your task:
1. Extract ALL text, numbers, equations, and symbols from the image with perfect accuracy
2. If it's a math equation, write it in clear text format (e.g., 2x + 3 = 7)
3. If it's a multiple choice question, include the question and ALL options
4. Preserve the original formatting as much as possible

User context: "${userPrompt}"

Return ONLY the extracted text, no explanations or analysis.`;

    const requestBody = {
      contents: [{
        parts: [
          { text: ocrPrompt },
          {
            inline_data: {
              mime_type: mimeType || 'image/jpeg',
              data: imageBase64
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1, // Low temp for accurate extraction
        maxOutputTokens: 2000
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('Γ¥î STUDY OCR: Gemini error', response.status, errText.slice(0, 200));
      return { success: false, error: `Gemini OCR error: ${response.status}` };
    }

    const data = await response.json();
    const extractedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!extractedText || extractedText.length < 5) {
      return { success: false, error: 'No text found in image' };
    }

    // Detect question type for better Wolfram routing
    const lower = extractedText.toLowerCase();
    let questionType: StudyOCRResult['questionType'] = 'general';
    if (/[+\-*/=^ΓêÜΓê½ΓêæΓêÅ]|equation|solve|calculate|x\s*[=+\-]|[0-9]+\s*[+\-*/]/.test(extractedText)) {
      questionType = 'math';
    } else if (/atom|molecule|element|chemical|physics|force|energy|velocity|acceleration/i.test(lower)) {
      questionType = 'science';
    } else if (/history|war|century|king|queen|empire|dynasty|revolution/i.test(lower)) {
      questionType = 'history';
    } else if (/grammar|verb|noun|sentence|translate|language/i.test(lower)) {
      questionType = 'language';
    }

    return { success: true, extractedText: extractedText.trim(), questionType };

  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error('Γ¥î STUDY OCR: Error:', errMessage);
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
  if (/[Γê½ΓêæΓêÅΓêÜ╧ÇΓê₧┬▒├ù├╖=ΓëáΓëñΓëÑ<>]/.test(q)) return true;
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
  if (/\b(┘é╪▒╪ó┘å|╪¡╪»┘è╪½|┘ü┘é┘ç|╪¬┘ü╪│┘è╪▒|╪│┘è╪▒╪⌐|╪╣┘é┘è╪»╪⌐|╪┤╪▒┘è╪╣╪⌐|╪¬╪¼┘ê┘è╪»|╪ú╪╡┘ê┘ä|╪╣┘ä┘ê┘à|┘à┘é╪º╪╡╪»|╪º╪¼╪¬┘ç╪º╪»|┘ü╪¬┘ê┘ë|╪¡┘ä╪º┘ä|╪¡╪▒╪º┘à|╪│┘å╪⌐|╪╡┘ä╪º╪⌐|╪▓┘â╪º╪⌐|╪¡╪¼|╪╡┘ê┘à|╪▒┘à╪╢╪º┘å)\b/.test(q)) return true;
  
  // === LANGUAGES (Arabic, English, French, etc.) ===
  if (/\b(grammar|syntax|morphology|phonetics|phonology|semantics|linguistics|vocabulary|etymology)\b/i.test(lower)) return true;
  if (/\b(noun|verb|adjective|adverb|pronoun|preposition|conjunction|article|tense|conjugation|declension)\b/i.test(lower)) return true;
  if (/\b(arabic grammar|nahw|sarf|balagha|rhetoric|literature|poetry|prose)\b/i.test(lower)) return true;
  if (/\b(english grammar|french grammar|spanish grammar|german grammar)\b/i.test(lower)) return true;
  if (/\b(translation|translate|meaning of|definition of|what does .* mean)\b/i.test(lower)) return true;
  // Arabic grammar terms
  if (/\b(┘å╪¡┘ê|╪╡╪▒┘ü|╪¿┘ä╪º╪║╪⌐|╪Ñ╪╣╪▒╪º╪¿|┘ü╪╣┘ä|╪º╪│┘à|╪¡╪▒┘ü|╪¼┘à┘ä╪⌐|┘à╪¿╪¬╪»╪ú|╪«╪¿╪▒|┘ü╪º╪╣┘ä|┘à┘ü╪╣┘ê┘ä)\b/.test(q)) return true;
  
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
  if (/\d+\s*(km|m|cm|mm|ft|in|mi|yd|kg|g|lb|oz|l|ml|gal|mph|kph|┬░[CF]|kelvin|fahrenheit|celsius)/i.test(q)) return true;
  
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
    const hasWakti = /\bwakti\b/i.test(s) || /┘ê┘é╪¬┘è/.test(s);
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
    const arQuestionPatterns = /(┘à╪º ┘ç┘ê|┘à╪º┘ç┘ê|┘ê╪┤ ┘ç┘ê|┘ê╪┤┘ç┘ê|╪┤┘ê ┘ç┘ê|╪º┘è╪┤|┘â┘è┘ü|┘ä┘è╪┤|┘ê┘è┘å|┘ü┘è┘å|┘ç┘ä|┘à┘à┘â┘å|╪│╪º╪╣╪»┘å┘è|╪╣╪▒┘ü┘å┘è|┘é┘ê┘ä┘è|╪º╪┤╪▒╪¡|┘ê╪╢╪¡|╪╣┘ä┘à┘å┘è|╪╣╪╖┘å┘è|╪º╪¿┘è ╪º╪╣╪▒┘ü|┘ê╪»┘è ╪º╪╣╪▒┘ü|┘è┘é╪»╪▒|╪¬┘é╪»╪▒|┘ü┘è┘ç|╪╣┘å╪»┘ç)/;
    // Short standalone mentions (just "wakti" or "wakti?" or "┘ê┘é╪¬┘è╪ƒ")
    const shortStandalone = /^(wakti|┘ê┘é╪¬┘è)\s*[?╪ƒ]?\s*$/i;
    // Direct help-seeking phrases
    const helpPhrases = /\b(not working|doesn't work|broken|issue|problem|bug|error|stuck|confused|lost|┘à╪┤┘â┘ä╪⌐|┘à╪º ┘è╪┤╪¬╪║┘ä|╪«╪▒╪¿╪º┘å|┘à┘ê ╪┤╪║╪º┘ä|╪╢╪º┘è╪╣|┘à╪¡╪¬╪º╪▒)\b/i;
    
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
  if (/┘ç╪º╪¬┘ü|╪▒┘é┘à|╪º╪¬╪╡╪º┘ä|┘à┘ê┘é╪╣|╪º┘è┘à┘è┘ä|┘ê╪º╪¬╪│╪º╪¿|╪º┘å╪│╪¬┘é╪▒╪º┘à|┘ü┘è╪│╪¿┘ê┘â|╪¬┘è┘â ╪¬┘ê┘â|╪│╪º╪╣╪º╪¬|┘à┘ü╪¬┘ê╪¡|┘à╪║┘ä┘é|╪ú┘é╪▒╪¿|┘é╪▒┘è╪¿/.test(s)) return true;
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
    console.warn('ΓÜá∩╕Å GEOCODING: No API key configured');
    return {};
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.warn('ΓÜá∩╕Å GEOCODING: No results', data.status);
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

    return {
      city,
      country,
      formattedAddress: result.formatted_address
    };
  } catch (error) {
    console.error('Γ¥î GEOCODING ERROR:', error);
    return {};
  }
}

// Detect search intent from user query
function detectSearchIntent(query: string): 'business' | 'news' | 'sports' | 'url' | 'general' {
  const lower = query.toLowerCase();
  const hasBusinessKeyword = /\b(near me|nearby|closest|nearest|location|address|phone|email|hours|open|closed|directions|map|restaurant|restaurants|cafe|cafes|coffee|breakfast|brunch|lunch|dinner|burger|pizza|shawarma|bakery|dessert|shop|store|mall|hotel|hospital|gym|bank|pharmacy|pharmacies|salon|spa|barber|clinic|supermarket|grocery)\b/i.test(lower);
  const hasBusinessDiscoveryPhrase = /\b(best|top|recommend|recommended|suggest|suggested|find|looking for|where is|where can i|where do i|get me|show me|authentic|good|great)\b/i.test(lower);
  const hasArabicBusinessKeyword = /\u0642\u0631\u064a\u0628|\u0628\u0627\u0644\u0642\u0631\u0628|\u0627\u0644\u0623\u0642\u0631\u0628|\u0627\u0642\u0631\u0628|\u0645\u0648\u0642\u0639|\u0639\u0646\u0648\u0627\u0646|\u0647\u0627\u062a\u0641|\u0631\u0642\u0645|\u0633\u0627\u0639\u0627\u062a|\u0645\u0641\u062a\u0648\u062d|\u0645\u063a\u0644\u0642|\u0627\u062a\u062c\u0627\u0647\u0627\u062a|\u062e\u0631\u064a\u0637\u0629|\u0645\u0637\u0639\u0645|\u0645\u0637\u0627\u0639\u0645|\u0645\u0642\u0647\u0649|\u0643\u0648\u0641\u064a|\u0641\u0637\u0648\u0631|\u0625\u0641\u0637\u0627\u0631|\u063a\u062f\u0627\u0621|\u0639\u0634\u0627\u0621|\u0645\u062d\u0644|\u0645\u062a\u062c\u0631|\u0645\u0648\u0644|\u0641\u0646\u062f\u0642|\u0645\u0633\u062a\u0634\u0641\u0649|\u0635\u064a\u062f\u0644\u064a\u0629|\u0628\u0646\u0643|\u0635\u0627\u0644\u0648\u0646|\u0633\u0628\u0627|\u062d\u0644\u0627\u0642|\u0639\u064a\u0627\u062f\u0629|\u0633\u0648\u0628\u0631\u0645\u0627\u0631\u0643\u062a/.test(query);
  const hasArabicDiscoveryPhrase = /\u0623\u0641\u0636\u0644|\u0627\u062d\u0633\u0646|\u0631\u0634\u062d|\u0627\u0642\u062a\u0631\u062d|\u0648\u064a\u0646|\u0623\u064a\u0646|\u0623\u0628\u063a\u0649|\u0627\u0628\u064a|\u0623\u0631\u064a\u062f|\u0627\u062f\u0648\u0631|\u0623\u062f\u0648\u0631|\u062f\u0644\u0646\u064a|\u062f\u0644\u0651\u0646\u064a|\u0644\u0642\u0650|\u0644\u0642\u064a\u062a/.test(query);
  const hasSportsKeyword = /\b(score|scores|match|matches|fixture|fixtures|standings|table|league|cup|goal|goals|assist|assists|playoff|playoffs|nba|nfl|mlb|nhl|fifa|uefa|champions league|premier league|la liga|serie a|bundesliga|tennis|formula 1|f1|cricket|world cup|vs\.?|result|results)\b/i.test(lower);
  
  if (/https?:\/\//.test(query) || /www\./i.test(query)) return 'url';
  if (hasBusinessKeyword) return 'business';
  if (hasBusinessKeyword && hasBusinessDiscoveryPhrase) return 'business';
  if (/\b(where is|how to get to|find|search for)\b/i.test(lower) && /\b(place|business|store|restaurant|cafe|hotel)\b/i.test(lower)) return 'business';
  if (hasArabicBusinessKeyword) return 'business';
  if (hasArabicBusinessKeyword && hasArabicDiscoveryPhrase) return 'business';
  if (hasSportsKeyword) return 'sports';
  if (/\b(news|latest|breaking|update|today|yesterday|recent|current events|what happened|headlines)\b/i.test(lower)) return 'news';
  
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

  // Simple ΓÇ£yesΓÇ¥ intent in EN/AR
  if (/^(yes|yep|yeah|sure|ok|okay|do it|go ahead|please|yalla)\b/.test(userMsg)) return true;
  if (/^(┘å╪╣┘à|╪º┘è|╪ú┘è┘ê┘ç|╪º┘è┘ê┘ç|╪¬┘à╪º┘à|╪º┘ê┘â┘è|╪¡╪º╪╢╪▒|╪¬┘ü╪╢┘ä|┘è┘ä╪º)\b/.test(userMsg)) return true;
  return false;
}

function userDeclinedSearch(message: string, recentMessages: unknown[]): boolean {
  const userMsg = (message || '').trim().toLowerCase();
  if (!userMsg) return false;

  const lastAssistant = getLastTextMessage(recentMessages, 'assistant').toLowerCase();
  const askedToSearch = /\b(search|look it up|check online|live check|google)\b/i.test(lastAssistant) && /\?/.test(lastAssistant);
  if (!askedToSearch) return false;

  if (/^(no|nah|nope|don\s?t|do not|skip|not now)\b/.test(userMsg)) return true;
  if (/^(┘ä╪º|┘à┘ê|┘à┘ê\s?╪º┘ä╪¡┘è┘å|┘ä╪º\s?╪º╪¿┘è|┘ä╪º\s?╪ú╪¿┘è)\b/.test(userMsg)) return true;
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
    console.error('≡ƒöÑ BODY PARSE ERROR:', bodyParseError);
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
          conversationId = null,
          conversationSummary = '',
          durableMemory = [],
          personalTouch = null, 
          activeTrigger = 'general',
          chatSubmode = 'chat', // 'chat' or 'study'
          location = null,
          clientTimezone = 'UTC',
          attachedFiles = [] // Images for Study mode OCRΓåÆWolfram pipeline
        } = body as { message?: string; language?: string; recentMessages?: unknown[]; conversationId?: string | null; conversationSummary?: string; durableMemory?: unknown[]; personalTouch?: unknown; activeTrigger?: string; chatSubmode?: string; location?: unknown; clientTimezone?: string; attachedFiles?: unknown[] };
        const requestLocation = (location && typeof location === 'object')
          ? location as { city?: string; country?: string; latitude?: number; longitude?: number }
          : null;
        const normalizedConversationId = typeof conversationId === 'string' && conversationId.trim()
          ? conversationId.trim().slice(0, 120)
          : null;
        const rollingConversationSummary = normalizeContinuityText(conversationSummary, 700);
        const normalizedDurableMemory = normalizeDurableMemoryItems(durableMemory);

        // Resolve engineTier from personalTouch payload ('speed' | 'intelligence', default 'speed')
        const engineTier: 'speed' | 'intelligence' =
          ((personalTouch as Record<string, unknown>)?.engineTier === 'intelligence') ? 'intelligence' : 'speed';

        // Store for logging
        requestMessage = typeof message === 'string' ? message : '';
        requestSubmode = chatSubmode;

        let effectiveTrigger = activeTrigger;
        // LAZY: classifySearchIntent only for chat mode ΓÇö run async, resolved before we need effectiveTrigger
        // for the search path. For chat path it resolves in background while we build context.
        const shouldCheckSearchIntent = activeTrigger === 'chat' && chatSubmode === 'chat' && !isWaktiInvolved(message || '');
        const intentGatePromise = shouldCheckSearchIntent
          ? classifySearchIntent(message || '', language).catch(() => null)
          : Promise.resolve(null);

        // Resolve intent gate (non-blocking for most messages ΓÇö classifySearchIntent is a local regex classifier)
        try {
          const gate = await intentGatePromise;
          if (gate?.needsSearch && gate.confidence >= 0.95) {
            effectiveTrigger = 'search';
          }
        } catch { /* stay in chat mode */ }

        requestTrigger = effectiveTrigger;

        if (!message) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Message required' })}\n\n`));
          controller.close();
          return;
        }

        // Trial gate: ai_chat ΓÇö 15 messages for free users
        if (userId) {
          const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          const trial = await checkAiChatTrialAccess(supabaseAdmin, userId);
          if (!trial.allowed) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...buildTrialErrorPayload('ai_chat', trial), trialLimitReached: true })}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }
        }

        const stayHotSummary = buildStayHotSummary(Array.isArray(recentMessages) ? recentMessages : []);

        // IP-based geo: DEMOTED ΓÇö used ONLY for timezone fallback on search path.
        // Skip entirely for chat mode ΓÇö clientTimezone from the frontend is sufficient.
        // Device GPS (via Natively SDK) is the source of truth for city/coordinates.
        const clientIp = extractClientIp(req);
        // clientTimezone from browser is always authoritative ΓÇö only fall back to IP geo if it is absent or UTC
        const needsIpGeo = !clientTimezone || clientTimezone === 'UTC';
        const ipGeo = needsIpGeo
          ? await lookupIpGeo(clientIp)
          : null;

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const emitAiChatTrialFinished = async (onceKey: string) => {
          if (!userId) return;
          const trial = await consumeAiChatTrialSuccess(supabaseAdmin, userId, onceKey);
          const trialPayload = buildTrialSuccessPayload('ai_chat', trial);
          if (!trialPayload) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata: { trialQuotaFinished: trialPayload } })}\n\n`));
        };
        // Parallel fetch: settings + memory items together. We always fetch memory
        // speculatively when we have a userId; if settings disable it, we just drop
        // the result. This trades a tiny extra query on the (rare) disabled case for
        // ~50-100ms saved on the common path.
        const [helpfulMemorySettings, helpfulMemoryRaw] = await Promise.all([
          getHelpfulMemorySettings(supabaseAdmin, userId),
          userId ? fetchHelpfulMemoryItems(supabaseAdmin, userId, normalizedConversationId) : Promise.resolve([] as HelpfulMemoryItem[])
        ]);
        const helpfulMemoryItems = helpfulMemorySettings.helpful_memory_enabled ? helpfulMemoryRaw : [];
        if (helpfulMemorySettings.helpful_memory_enabled && userId && normalizedDurableMemory.length > 0) {
          const forgetItems = normalizedDurableMemory.filter((it) => it.action === 'forget');
          const rememberItems = normalizedDurableMemory.filter((it) => it.action !== 'forget');

          // Forget always runs ΓÇö users must always be able to remove memories even when capture is paused.
          if (forgetItems.length > 0) {
            processForgetItems(supabaseAdmin, userId, forgetItems).catch((error) => {
              console.warn('helpful memory forget processing failed', error);
            });
          }

          // Auto-capture of new memories still respects the pause flag.
          if (!helpfulMemorySettings.capture_paused && rememberItems.length > 0) {
            upsertAutoHelpfulMemory(supabaseAdmin, userId, rememberItems).catch((error) => {
              console.warn('helpful memory auto-capture failed', error);
            });
          }
        }

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

        // Skip DB timezone lookup when frontend already sent a valid timezone.
        // This eliminates 2 sequential Supabase queries on every chat message.
        const profileTimezone = (!clientTimezone || clientTimezone === 'UTC')
          ? await getProfileTimezone(userId)
          : null;

        // Priority: clientTimezone (browser) > profileTimezone (DB) > ipGeo (last resort)
        // Default fallback is Asia/Qatar (GMT+3) since Wakti is designed and built in Qatar.
        const effectiveTimezone = (clientTimezone && clientTimezone !== 'UTC' && clientTimezone !== 'undefined')
          ? clientTimezone
          : (profileTimezone || (ipGeo?.timezone && ipGeo.timezone !== 'UTC' ? ipGeo.timezone : 'Asia/Qatar'));

        console.log(`[wakti-ai-v2-brain-stream] Timezone resolved:`, {
          clientTimezone,
          profileTimezone,
          ipGeoTimezone: ipGeo?.timezone,
          resolvedEffective: effectiveTimezone
        });

        // Build full location context (for Chat + Search modes)
        // Device GPS only ΓÇö no IP geo fallback for city/coordinates
        let fullLocationContext = '';
        {
          let userCity = '';
          let userCountry = '';
          const userLat = requestLocation?.latitude;
          const userLng = requestLocation?.longitude;
          
          // Reverse geocode only on search path ΓÇö chat doesn't need precise city/coords
          if (userLat && userLng && effectiveTrigger !== 'chat') {
            try {
              const geocoded = await reverseGeocode(userLat, userLng);
              if (geocoded.city) userCity = geocoded.city;
              if (geocoded.country) userCountry = geocoded.country;
            } catch {}
          }
          
          if (userCity || userCountry || (userLat && userLng)) {
            const locationQueryIsNearMe = /\b(near me|nearby|around me|closest|nearest)\b/i.test(message || '');
            const parts: string[] = [];
            if (!locationQueryIsNearMe) {
              if (userCity && userCountry) parts.push(`City: ${userCity}, ${userCountry}`);
              else if (userCity) parts.push(`City: ${userCity}`);
              else if (userCountry) parts.push(`Country: ${userCountry}`);
            }
            if (userLat && userLng) {
              parts.push(`Coordinates: ${userLat.toFixed(4)}┬░N, ${userLng.toFixed(4)}┬░E`);
            }
            if (parts.length > 0) {
              fullLocationContext = `USER LOCATION CONTEXT (from device GPS ΓÇö INTERNAL USE ONLY):
${parts.join('\n')}

LOCATION PHRASING RULES ΓÇö STRICT (mandatory for any "near me", "nearby", "around me", "closest", or location-dependent query):
1. ALWAYS start your answer by acknowledging the user's CURRENT LOCATION. Use phrases like:
   - "Based on your current locationΓÇª"
   - "From where you are right nowΓÇª"
   - "Near you right nowΓÇª"
   - (Arabic) "╪º╪│╪¬┘å╪º╪»╪º┘ï ╪Ñ┘ä┘ë ┘à┘ê┘é╪╣┘â ╪º┘ä╪¡╪º┘ä┘èΓÇª" / "╪¡╪│╪¿ ┘à┘ê┘é╪╣┘â ╪º┘ä╪ó┘åΓÇª"
2. NEVER name the user's neighborhood, district, compound, tower, street, or sub-area as if you just knew it (examples of forbidden phrasing: "you are positioned in Fox Hills district", "since you're in Lusail Marina", "as you are at West Bay"). Even if web search results contain a neighborhood name, DO NOT attribute it to the user.
3. If the user did not explicitly name a city or country in the request, DO NOT inject one into the visible answer even if it exists in LOCATION CONTEXT above.
4. If the user's exact area is uncertain, say "near you right now" or "closest to you right now" ΓÇö never guess a neighborhood and never say "near your current coordinates".
5. Keep all recommendations tightly scoped to this location. Do not list places from unrelated cities or countries.
6. These rules override any tone/style preferences when they conflict.`;
            }
          }
        }

        // Chat mode: if the user is asking about WAKTI specifically, respond with the correct format + chip
        if (effectiveTrigger === 'chat' && chatSubmode === 'chat' && isWaktiInvolved(message)) {
          const userName = (personalTouch as { nickname?: string })?.nickname || '';
          const greeting = userName ? `Sure, ${userName}! ` : 'Sure! ';
          
          const promoText = language === 'ar'
            ? `╪¿╪º┘ä╪¬╪ú┘â┘è╪»${userName ? '╪î ' + userName : ''}! ┘ê┘é╪¬┘è ┘ç┘ê ╪¬╪╖╪¿┘è┘é ╪░┘â╪º╪í ╪º╪╡╪╖┘å╪º╪╣┘è ╪┤╪º┘à┘ä ┘ä┘ä╪Ñ┘å╪¬╪º╪¼┘è╪⌐. ┘à╪╡┘à┘à ┘ä┘è┘â┘ê┘å ╪│┘ç┘ä ╪º┘ä╪º╪│╪¬╪«╪»╪º┘à ┘ê┘à╪¬┘â┘è┘ü ┘à╪╣ ╪º╪¡╪¬┘è╪º╪¼╪º╪¬┘â.\n\n┘ä┘ä╪¡╪╡┘ê┘ä ╪╣┘ä┘ë ╪ú╪»┘ä╪⌐ ╪«╪╖┘ê╪⌐ ╪¿╪«╪╖┘ê╪⌐╪î ╪º┘ü╪¬╪¡ ╪º┘ä┘à╪│╪º╪╣╪»╪⌐ ┘ê╪º┘ä╪ú╪»┘ä╪⌐ - ┘ç┘å╪º┘â 3 ╪¬╪¿┘ê┘è╪¿╪º╪¬:\n- ╪º┘ä╪ú╪»┘ä╪⌐ (┘à╪½┘ä ╪º┘ä┘à╪│╪¬┘å╪»╪º╪¬ ╪º┘ä┘à╪╡╪║╪▒╪⌐)\n- ╪ú╪«┘ê┘è ╪º┘ä╪╡╪║┘è╪▒ ┘à╪│╪º╪╣╪» ┘ê┘é╪¬┘è ╪º┘ä╪░┘è ╪│┘è╪┤╪▒╪¡ ┘ä┘â ┘â┘ä ╪┤┘è╪í ╪Ñ╪░╪º ┘à╪º ┘ê╪»┘æ┘â ╪¬┘é╪▒╪ú\n- ╪¬╪¿┘ê┘è╪¿ ╪º┘ä╪»╪╣┘à ┘ä┘ä╪¬┘ê╪º╪╡┘ä ┘à╪╣┘å╪º ┘à╪¿╪º╪┤╪▒╪⌐`
            : `${greeting}Wakti AI is your all-in-one productivity AI app. It's built to be user-friendly and adaptable to your needs.\n\nFor step-by-step guides, open Help & Guides - there are 3 tabs:\n- Guides (like mini documents)\n- My little brother Wakti Help Assistant who will walk you through everything if you don't feel like reading\n- A Support tab to get in touch with us directly`;

          // Emit the chip first
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              metadata: {
                helpGuideChip: {
                  label: language === 'ar' ? '╪º┘ü╪¬╪¡ ╪º┘ä┘à╪│╪º╪╣╪»╪⌐ ┘ê╪º┘ä╪Ñ╪▒╪┤╪º╪»╪º╪¬' : 'Open Help & Guides',
                  route: '/help'
                }
              }
            })}\n\n`));
          } catch (e) {
            console.warn('helpGuideChip emit failed', e);
          }

          // Emit the response text
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: promoText, content: promoText })}\n\n`));
          await emitAiChatTrialFinished(promoText);
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

        // Active reminders: fire-and-forget fetch ΓÇö never blocks the stream.
        // Result is passed into system prompt only when it resolves before buildSystemPrompt is called.
        // For chat mode with no reminder keywords, skip entirely.
        const messageHasReminderKeyword = messageRequestsReminder(message || '');
        let activeRemindersContext = '';
        const remindersPromise: Promise<string> = (userId && messageHasReminderKeyword)
          ? (async () => {
              try {
                const { data: activeReminders } = await supabaseAdmin
                  .from('notification_history')
                  .select('reminder_content, scheduled_for')
                  .eq('user_id', userId)
                  .eq('type', 'ai_reminder')
                  .eq('push_sent', false)
                  .gt('scheduled_for', new Date().toISOString())
                  .order('scheduled_for', { ascending: true })
                  .limit(5);
                if (activeReminders && activeReminders.length > 0) {
                  const remindersList = activeReminders.map((r: { reminder_content?: string; scheduled_for?: string }) => {
                    const content = (r.reminder_content || '').slice(0, 80);
                    const time = r.scheduled_for ? new Date(r.scheduled_for).toLocaleString('en-US', {
                      timeZone: effectiveTimezone,
                      weekday: 'short', month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true
                    }) : 'unknown time';
                    return `- "${content}" at ${time}`;
                  }).join('\n');
                  return `\n\n≡ƒôï USER'S ACTIVE REMINDERS (DO NOT OFFER DUPLICATES):\n${remindersList}\nIf user already has a reminder for something, acknowledge it instead of offering a new one.`;
                }
              } catch { /* not critical */ }
              return '';
            })()
          : Promise.resolve('');

        // Race: use reminders context only if DB responds within 300ms ΓÇö never stall the stream
        activeRemindersContext = await Promise.race([
          remindersPromise,
          new Promise<string>(resolve => setTimeout(() => resolve(''), 300))
        ]);

        // Calculate dynamic UTC offset for the user's timezone (used in reminder instructions)
        const nowForOffset = new Date();
        const offsetFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: effectiveTimezone || 'UTC',
          timeZoneName: 'shortOffset'
        });
        const offsetPart = offsetFormatter.formatToParts(nowForOffset).find(p => p.type === 'timeZoneName')?.value || 'Z';
        const numericOffset = offsetPart.replace('GMT', '').replace('UTC', '') || 'Z';
        const formattedOffset = numericOffset === 'Z' ? '+00:00' : (numericOffset.length <= 3 ? numericOffset + ':00' : numericOffset);

        // Lazy-load: determine useSearch now so buildSystemPrompt can conditionally include blocks
        const chatUsesSearch = (effectiveTrigger === 'chat') && chatNeedsSearch(message || '');
        const selectedDurableMemory = selectRelevantDurableMemory(normalizedDurableMemory, message || '', effectiveTrigger, chatSubmode);
        const selectedHelpfulMemory = helpfulMemorySettings.helpful_memory_enabled
          ? selectRelevantHelpfulMemory(helpfulMemoryItems, message || '', effectiveTrigger, chatSubmode)
          : [];
        const helpfulMemoryContext = helpfulMemorySettings.helpful_memory_enabled
          ? buildCombinedHelpfulMemoryContext(selectedHelpfulMemory, selectedDurableMemory, personalTouch)
          : '';
        if (selectedHelpfulMemory.length > 0) {
          touchHelpfulMemoryItems(supabaseAdmin, selectedHelpfulMemory.map((item) => item.id)).catch((error) => {
            console.warn('helpful memory touch failed', error);
          });
        }
        const continuityContext = buildContinuityContext({
          conversationSummary: rollingConversationSummary,
          stayHotSummary,
          locationContext: fullLocationContext,
          includeLocation: effectiveTrigger === 'chat'
        });
        const systemPromptBase = buildSystemPrompt(
          language,
          currentDate,
          localTime,
          personalTouch as Record<string, unknown> | null | undefined,
          effectiveTrigger,
          chatSubmode,
          { useSearch: chatUsesSearch, hasReminders: !!activeRemindersContext, isReminderTrigger: messageHasReminderKeyword, formattedOffset }
        );
        // Detect WhatsApp-style reply marker injected by the frontend and convert it into an explicit system instruction.
        // Supports EN: [Replying to: (wakti said) "..."]  and  AR: [╪▒╪»┘ï╪º ╪╣┘ä┘ë: (┘ê┘â╪¬┘è ┘é╪º┘ä) "..."]
        let replyInstruction = '';
        try {
          const msgStr = typeof message === 'string' ? message : '';
          const replyMatch = msgStr.match(/^\s*\[(?:Replying to|╪▒╪»┘ï╪º ╪╣┘ä┘ë):\s*\((?:wakti said|┘ê┘â╪¬┘è ┘é╪º┘ä)\)\s*"([\s\S]*?)"\s*\]/);
          if (replyMatch && replyMatch[1]) {
            const quoted = replyMatch[1].trim().slice(0, 400);
            replyInstruction = language === 'ar'
              ? `REPLY FOCUS (╪╢╪▒┘ê╪▒┘è): ╪º┘ä┘à╪│╪¬╪«╪»┘à ┘è╪▒╪» ╪¬╪¡╪»┘è╪»┘ï╪º ╪╣┘ä┘ë ╪▒╪│╪º┘ä╪¬┘â ╪º┘ä╪│╪º╪¿┘é╪⌐ ╪º┘ä┘à┘é╪¬╪¿╪│╪⌐ ╪ú╪»┘å╪º┘ç. ╪«╪º╪╖╪¿ ┘ç╪░┘ç ╪º┘ä┘å┘é╪╖╪⌐ ╪¿╪º┘ä╪░╪º╪¬╪î ┘ä╪º ╪¬╪╣╪º┘à┘ä ╪º┘ä╪▒╪│╪º┘ä╪⌐ ┘â┘à┘ê╪╢┘ê╪╣ ╪¼╪»┘è╪». ╪Ñ╪░╪º ╪╖┘ä╪¿ ╪º┘ä┘à╪│╪¬╪«╪»┘à ╪▒╪ú┘è┘â/╪Ñ╪╣╪º╪»╪⌐ ╪╡┘è╪º╪║╪⌐/╪¬╪╡╪¡┘è╪¡┘ï╪º/╪¬┘ü╪╡┘è┘ä┘ï╪º ┘ü╪ú╪¼╪¿┘ç ╪╣┘å ╪º┘ä┘à╪¡╪¬┘ê┘ë ╪º┘ä┘à┘é╪¬╪¿╪│ ╪¡╪╡╪▒┘ï╪º.\nRESPONSE LANGUAGE: ╪º┘â╪¬╪¿ ╪º┘ä╪▒╪» ╪¿╪º┘ä╪╣╪▒╪¿┘è╪⌐.\n╪º┘ä┘à┘é╪¬╪¿╪│: "${quoted}"`
              : `REPLY FOCUS (CRITICAL): The user is replying SPECIFICALLY to your previous message quoted below. Address that exact point ΓÇö do NOT treat their message as a new topic. If they ask for your opinion / rephrase / correction / elaboration, answer about the quoted content only.\nQUOTED MESSAGE: "${quoted}"`;
          }
        } catch { /* best-effort */ }

        const systemPrompt = `${helpfulMemoryContext ? helpfulMemoryContext + '\n\n' : ''}${continuityContext ? continuityContext + '\n\n' : ''}${systemPromptBase}${activeRemindersContext || ''}${replyInstruction ? '\n\n' + replyInstruction : ''}`;

        const messages = [
          { role: 'system', content: systemPrompt }
        ];

        // Add history (20 messages provides good context while keeping responses fast)
        if (Array.isArray(recentMessages) && recentMessages.length > 0) {
          const historyMessages = (recentMessages as Array<Record<string, unknown>>).slice(-20);
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
            const userDisplayName = ((pt.displayName as string | undefined) || (pt.display_name as string | undefined) || '').toString().trim();
            const aiNick = ((pt.aiNickname as string | undefined) || (pt.ai_nickname as string | undefined) || '').toString().trim();
            const toneVal = ((pt.tone as string | undefined) || 'neutral').toString().trim();
            let styleVal = ((pt.style as string | undefined) || '').toString().trim();
            if (styleVal === 'short answers') styleVal = 'Strictly short, concise answers. No fluff or long paragraphs.';
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

            // GPS ONLY: ignore client/profile city/country when coords exist
            // Always reverse-geocode from GPS to avoid Doha/profile anchoring.
            let userCity = '';
            let userCountry = '';
            const explicitNearMeRequest = /\b(near me|nearby|around me|closest|nearest)\b/i.test(message || '');
            if (explicitNearMeRequest && !(requestLocation?.latitude && requestLocation?.longitude)) {
              const locationRequiredResponse = language === 'ar'
                ? 'لا أستطيع تنفيذ هذا البحث القريب بدون الوصول إلى موقعك الحالي من الجهاز. فعّل إذن الموقع ثم أعد المحاولة، وسأستخدم GPS الجهاز أولاً ثم متصفحك كخطة احتياطية فقط.'
                : 'I could not access your live location for this nearby search. Please allow location access and try again. I will use your device GPS first, then browser geolocation only as the fallback.';
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: locationRequiredResponse, content: locationRequiredResponse })}\n\n`));
              await emitAiChatTrialFinished(locationRequiredResponse);
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              return;
            }
            if (requestLocation?.latitude && requestLocation?.longitude) {
              if (!explicitNearMeRequest) {
                try {
                  const geocoded = await reverseGeocode(requestLocation.latitude, requestLocation.longitude);
                  userCity = (geocoded.city || '').toString().trim();
                  userCountry = (geocoded.country || '').toString().trim();
                } catch {}
              }
            } else {
              if (!explicitNearMeRequest) {
                userCity = '';
                userCountry = '';
              }
            }

            // Build location context string (GPS-only)
            let locationContext = '';
            const parts = [] as string[];
            if (userCity && userCountry) parts.push(`City: ${userCity}, ${userCountry}`);
            else if (userCity) parts.push(`City: ${userCity}`);
            else if (userCountry) parts.push(`Country: ${userCountry}`);
            if (requestLocation?.latitude && requestLocation?.longitude) {
              parts.push(`Coordinates: ${requestLocation.latitude.toFixed(4)}┬░N, ${requestLocation.longitude.toFixed(4)}┬░E`);
            }
            if (parts.length > 0) {
              locationContext = `\n\nUSER LOCATION CONTEXT:\n${parts.join('\n')}`;
            }

            const eliteIntroRule = (() => {
              if (language === 'ar') {
                return `╪º╪¿╪»╪ú ╪¿╪│╪╖╪▒ ╪º┘ü╪¬╪¬╪º╪¡┘è ╪╣╪▒╪¿┘è ┘é╪╡┘è╪▒╪î ╪»╪º┘ü╪ª╪î ┘ê╪¼╪░╪º╪¿. ╪▒╪¡┘æ╪¿ ╪¿╪º┘ä┘à╪│╪¬╪«╪»┘à ╪¿╪┤┘â┘ä ╪╖╪¿┘è╪╣┘è ┘ê╪º╪░┘â╪▒ ╪º╪│┘à┘ç ┘à╪▒╪⌐ ┘ê╪º╪¡╪»╪⌐ ╪Ñ╪░╪º ┘â╪º┘å ╪░┘ä┘â ┘à┘å╪º╪│╪¿╪º┘ï. ┘ä╪º ╪¬╪│╪¬╪«╪»┘à ╪¬╪¡┘è╪⌐ ╪▒┘ê╪¿┘ê╪¬┘è╪⌐ ┘à╪¡┘ü┘ê╪╕╪⌐╪î ┘ê┘ä╪º ╪¬┘é┘ä "╪¬╪¡┘è╪º╪¬┘è" ╪ú┘ê "╪¼┘ç┘æ╪▓╪¬ ┘ä┘â ╪ú╪¡╪»╪½ ╪º┘ä┘å╪¬╪º╪ª╪¼" ╪ú┘ê ╪ú┘è ╪Ñ╪╣┘ä╪º┘å ╪╣┘å ╪╣┘à┘ä┘è╪⌐ ╪º┘ä╪¿╪¡╪½. ╪ú┘à╪½┘ä╪⌐ ╪¼┘è╪»╪⌐: "┘ç┘ä╪º ${userNick || userDisplayName || '╪╡╪»┘è┘é┘è'} ΓÇö ╪Ñ╪░╪º ┘ê╪»┘â ╪¿╪║╪»╪º╪í ┘é┘ê┘è ╪º┘ä╪ó┘å╪î ┘ç╪░┘ç ╪ú┘ü╪╢┘ä ╪º┘ä╪ú┘à╪º┘â┘å ╪º┘ä╪ú┘é╪▒╪¿ ┘ä┘â." ╪ú┘ê "┘è╪º ${userNick || userDisplayName || '╪╡╪»┘è┘é┘è'}╪î ┘ç╪░┘ç ╪ú┘é┘ê┘ë ╪º┘ä╪«┘è╪º╪▒╪º╪¬ ╪º┘ä┘é╪▒┘è╪¿╪⌐ ┘à┘å┘â ╪º┘ä╪ó┘å."`;
              }
              return `Open with one short warm engaging line. Greet the user naturally and mention their name once when it feels right. Do not use a scripted greeting. Never say "Greetings" or "I've pulled the latest for you" or announce your own search process. Good examples: "Hey ${userNick || userDisplayName || 'there'} ΓÇö if you're after a strong lunch right now, these are the best spots nearest to you." or "${userNick || userDisplayName || 'Friend'}, here are the strongest nearby picks for you right now."`;
            })();

            // Intent detection is now built into the system prompt itself
            // (searchIntent is still used for Maps grounding below)

            const personalSection = _promptPersonalSection((personalTouch || {}) as Record<string, unknown>);

            const searchLocationContext = locationContext;
            const searchHelpfulMemoryContext = helpfulMemoryContext;
            const searchContinuityContext = buildContinuityContext({
              conversationSummary: rollingConversationSummary,
              stayHotSummary
            });
            let searchSystemPrompt = `${searchHelpfulMemoryContext ? searchHelpfulMemoryContext + "\n\n" : ''}${searchContinuityContext ? searchContinuityContext + "\n\n" : ''}You are WAKTI AI ΓÇö an elite, hyper-intelligent Search Intelligence.
You are the Al Jazeera of news (deep context), the ESPN of sports (real-time stakes), and the Oxford of research (academic rigor).
You perform REAL-TIME SYNTHESIS. You are a digital strategist with the brain of a researcher and the style of a high-end concierge.${personalSection}

### ≡ƒîÉ THE WORLD SENSOR (LIVE CONTEXT)
- CURRENT TIME: ${localTime} (${userTimeZone})
- LOCATION: ${searchLocationContext || 'Unknown'}

### ≡ƒºá PERSONALIZATION SETTINGS
${userNick ? `- USER NICKNAME: "${userNick}" (use naturally once in the intro).` : '- Use an elite, professional greeting.'}
${aiNick ? `- YOUR NAME: "${aiNick}".` : ''}
${toneVal !== 'neutral' ? `- TONE: ${toneVal}.` : ''}
${styleVal ? `- STYLE: ${styleVal}` : ''}
${customNote ? `- SPECIAL NOTE (obey): ${customNote}` : ''}
- LANGUAGE: ${language === 'ar' ? 'Arabic (RTL when appropriate)' : 'English'}

### ≡ƒºá REASONING PROTOCOL (INTERNAL STEPS - DO BEFORE EVERY RESPONSE)
1. VERIFY: Check ${localTime} against business hours found. If it's 10 PM and they close at 9 PM, flag it as "Closed Now".
2. CROSS-REFERENCE: For sports/news, check 3+ sources to find "The Lead" (the most important fact).
3. ANALYZE IMPACT: Don't just find facts; explain the impact (e.g., "This win moves them to 2nd place in the division").

### ≡ƒ¢í∩╕Å DATA INTEGRITY PROTOCOL (STRICT)
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
ΓåÆ Use grounded map/place results as the primary truth whenever they exist.
ΓåÆ Write like a sharp local guide: practical, warm, specific. No luxury-critic filler and no robotic system narration.

B) LIVE DATA (The ESPN/Market Brain):
Sports scores, schedules, standings. Stocks, crypto, exchange rates. Airport / flights.
ΓåÆ Cross-reference 3+ sources to ensure the score/price is accurate for today.
ΓåÆ Always explain "The Stakes" ΓÇö why this result matters.

C) RESEARCH (The Oxford Brain):
School project, history, science, how/why questions, "explain", "compare", "pros/cons".
ΓåÆ Do not just list facts. Provide the "Strategic Nuance" ΓÇö a scholarly debate or a rare historical perspective.

D) URL ANALYSIS (The Auditor Brain):
User provides a URL or asks to analyze a specific page.
ΓåÆ Deep-read the provided URL. Identify the "Lead," the "Evidence," and the "Hidden Bias."

If ambiguous, choose the closest intent and proceed without asking questions unless necessary.

============================================================
2) ELITE INTRO (ALWAYS) + SMART WEATHER RULE
============================================================
${eliteIntroRule}

Use one short opener only. Do not force a greeting if it sounds unnatural.

After the opener, write 1 sentence for context, 2 at the absolute maximum.
- Address ${userNick} naturally only if it feels natural.
- If grounded place cards exist, keep the prose compact and do not repeat the full links, reviews, socials, or contact fields in paragraph form.
- Mention ONE real-time local detail based on location context only if it is confidently known and actually useful.
- Do not overdo it. No long greetings after the intro line.

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
Return 4ΓÇô6 results max.

Users should not need to separately ask for Google Maps, rating, Google review count, phone, verified email, website, or official social links. If that data is grounded or clearly verified, include it by default.
When grounded place cards are available, keep the prose compact and let the cards carry the detailed links, contact info, and review snippets.

For EACH result use EXACTLY this structure:

## [Number]. [Name] ([Area])

[2ΓÇô3 sentences max: what it is + why it's good + who it's for.
Include cuisine/type, price ($/$$/$$$), and rating if available.]

- **${language === 'ar' ? '╪º┘ä╪ú╪¼┘ê╪º╪í' : 'Vibe'}:** [2ΓÇô4 keywords]
- **${language === 'ar' ? '╪¼╪▒┘æ╪¿' : 'Must Try'}:** [specific dish/service]
- **${language === 'ar' ? '╪º┘ä╪░┘â╪º╪í' : 'Intelligence'}:** [Status (e.g., Open for another 2 hours / Closed Now) | Nearest Metro | Parking availability]
- **${language === 'ar' ? '╪º┘ä╪¬┘é┘è┘è┘à' : 'Rating'}:** [4.4] (include whenever grounded)
- **${language === 'ar' ? '┘à╪▒╪º╪¼╪╣╪º╪¬ Google' : 'Google Reviews'}:** [123 reviews] (include whenever grounded)
- **${language === 'ar' ? '╪º┘ä┘à╪╣┘ä┘ê┘à╪º╪¬' : 'Info'}:**
  - **${language === 'ar' ? '╪º┘ä╪│╪º╪╣╪º╪¬' : 'Hours'}:** [hours or Open now/Closed] (omit if unknown)
  - **${language === 'ar' ? '╪º┘ä┘ç╪º╪¬┘ü' : 'Phone'}:** [+974xxxx](tel:+974xxxx) (omit if unknown)
  - **${language === 'ar' ? '┘ê╪º╪¬╪│╪º╪¿' : 'WhatsApp'}:** [Chat](https://wa.me/<digits>) (only if verified / explicitly listed as WhatsApp)
  - **${language === 'ar' ? '╪º┘ä╪¿╪▒┘è╪»' : 'Email'}:** [name@domain.com](mailto:name@domain.com) (only if verified)
  - **${language === 'ar' ? '╪º┘ä┘à┘ê┘é╪╣' : 'Website'}:** [domain.com](https://domain.com) (only if verified)
  - **${language === 'ar' ? '╪Ñ┘å╪│╪¬╪║╪▒╪º┘à' : 'Instagram'}:** [@handle](https://instagram.com/handle) (only if verified)
  - **${language === 'ar' ? '┘ü┘è╪│╪¿┘ê┘â' : 'Facebook'}:** [Page](https://facebook.com/...) (only if verified)
  - **${language === 'ar' ? '╪¬┘è┘â ╪¬┘ê┘â' : 'TikTok'}:** [@handle](https://tiktok.com/@handle) (only if verified)
- ≡ƒôì **Google Maps:** [${language === 'ar' ? '╪º╪¿╪»╪ú ╪º┘ä╪¬┘å┘é┘ä' : 'Initiate Navigation'}](https://www.google.com/maps/search/?api=1&query=[URL-encoded name and location]${language === 'ar' ? '&hl=ar' : ''})

Rules for Info block:
- Do NOT put plain text phone numbers. Always use tel: links when phone is present.
- Do NOT put plain text URLs. Website, Instagram, WhatsApp, Facebook, TikTok, and Google Maps must always be clickable markdown links.
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
≡ƒÆí **${language === 'ar' ? '┘å╪╡┘è╪¡╪⌐ ╪º╪¡╪¬╪▒╪º┘ü┘è╪⌐' : 'Pro Tip'}:** [One insider tip that is specific and useful: best time/day, reservation tip, parking tip, hidden menu item, best seating, etc.]

-------------------------
INTENT B: LIVE DATA (ESPN/MARKET BRAIN)
-------------------------

## ≡ƒôè ${language === 'ar' ? '┘ä┘ê╪¡╪⌐ ╪¬╪¡╪»┘è╪½ ╪¡┘è' : 'Live Dashboard'}: [Topic]

[${language === 'ar' ? '╪º┘ä╪¬┘ê┘ä┘è┘ü' : 'Synthesis'}: Connect today's result to the bigger picture/standings. Explain "The Stakes" ΓÇö why this matters.]

FORMATTING: You MUST use expansive, high-quality Markdown tables for data comparisons. Use **bold** for headers and key facts. Ensure the table is wide and detailed ΓÇö include as many meaningful columns as the data supports. Avoid a cramped look. Only be concise if the user's style preference is 'short answers'.

| ${language === 'ar' ? '╪º┘ä╪╣┘å╪╡╪▒' : 'Data Category'} | ${language === 'ar' ? '╪º┘ä┘å╪¬┘è╪¼╪⌐/╪º┘ä╪¡╪º┘ä╪⌐' : 'Current Status'} | ${language === 'ar' ? '╪º┘ä╪ú╪½╪▒/╪º┘ä╪▒┘ç╪º┘å╪º╪¬' : 'The Stakes / Impact'} |
| :--- | :--- | :--- |
| [Item/Match/Ticker] | [Live Value/Score] | [Standings Impact / Trend / Gate Info] |

Rules:
- Use today's date/time in context.
- For sports: include next game + time if available. Explain standings impact.
- For stocks/crypto: include price + % change today if available. Note if it's a 52-week high/low.
- For flights: include terminal/gate/delay if available. Add weather at destination if relevant.

TABLE FORMAT ENFORCEMENT (CRITICAL):
- You MUST output a VALID Markdown pipe table.
- You MUST include the required separator row (example: | --- | --- | --- |).
- Every row MUST have the exact same number of | columns as the header.
- NEVER output a pseudo-table using spaces/alignment. If you cannot produce a valid pipe table, do NOT output a table.
- Prevent merged headers (example: never output "PointsThe Stakes / Impact"). Ensure each header is a separate cell separated by |.
- Avoid hard line breaks inside table cells; keep each row on a single line.

*${language === 'ar' ? '╪º┘ä┘à╪╡╪º╪»╪▒' : 'Sources'}: [Verified Source 1], [Verified Source 2]*

End with:
≡ƒÆí **${language === 'ar' ? '┘å╪╡┘è╪¡╪⌐ ╪º╪¡╪¬╪▒╪º┘ü┘è╪⌐' : 'Pro Tip'}:** [watching tip / trading caution / travel tip]

-------------------------
INTENT C: RESEARCH (OXFORD BRAIN)
-------------------------
Write like a smart teacher, but still clean and "premium".

## ≡ƒÄ» ${language === 'ar' ? '╪º┘ä┘à┘ä╪«╪╡ ╪º┘ä╪¬┘å┘ü┘è╪░┘è' : 'Executive Summary'}
[High-level scholarly overview of the subject.]

## ≡ƒöì ${language === 'ar' ? '╪º┘ä╪¬╪¡┘ä┘è┘ä ╪º┘ä╪º╪│╪¬╪▒╪º╪¬┘è╪¼┘è' : 'Strategic Analysis'}
- **${language === 'ar' ? '╪º┘ä╪¼┘ê┘ç╪▒' : 'The Core'}:** [The 80/20 summary ΓÇö the most important facts]
- **${language === 'ar' ? '╪º┘ä┘å┘é╪º╪┤' : 'The Debate'}:** [A high-level "Oxford-tier" perspective ΓÇö show that historians/experts disagree, or provide a revisionist view that most basic searches miss]
- [Additional Point] ΓÇö [Explanation]

If comparing: use a table.

## ≡ƒÆí ${language === 'ar' ? '╪▒╪ñ┘è╪⌐ ┘ê┘é╪¬┘è' : 'THE WAKTI INSIGHT'}
[Provide one rare, scholarly fact or unique perspective that demonstrates deep intelligence ΓÇö something a normal search wouldn't find.]

## ≡ƒôÜ ${language === 'ar' ? '┘à╪╡╪º╪»╪▒ ┘à┘ê╪½┘ê┘é╪⌐' : 'High-Quality Sources'}
- [Source 1](url)
- [Source 2](url)
- [Source 3](url)

End with:
≡ƒÆí **${language === 'ar' ? '┘å╪╡┘è╪¡╪⌐ ╪º╪¡╪¬╪▒╪º┘ü┘è╪⌐' : 'Pro Tip'}:** [related topic or how to use this in a project/presentation + one bonus fact]

-------------------------
INTENT D: URL ANALYSIS (AUDITOR BRAIN)
-------------------------
Deep-read the provided URL. Identify the "Lead," the "Evidence," and the "Hidden Bias."
First summarize the URL content (not generic web results).
Then optionally add related verified context.

## ≡ƒº╛ ${language === 'ar' ? '┘à┘ä╪«╪╡ ╪º┘ä╪╡┘ü╪¡╪⌐' : 'Summary of the Page'}
[Key takeaways ΓÇö identify the "Lead" (main point)]

## ≡ƒöÄ ${language === 'ar' ? '╪º┘ä╪ú╪»┘ä╪⌐ ┘ê╪º┘ä┘å┘é╪º╪╖ ╪º┘ä┘à┘ç┘à╪⌐' : 'What Matters / Key Evidence'}
- [Evidence 1]
- [Evidence 2]
- [Hidden detail most readers would miss]

## ΓÜû∩╕Å ${language === 'ar' ? '┘à┘ä╪º╪¡╪╕╪º╪¬ ╪º┘ä┘à┘ê╪½┘ê┘é┘è╪⌐ ┘ê╪º┘ä╪º┘å╪¡┘è╪º╪▓' : 'Bias / Reliability Notes'} (if relevant)
- [Is this a corporate landing page? News outlet? Academic source?]
- [Any potential bias or promotional tone?]

End with:
≡ƒÆí **${language === 'ar' ? '┘å╪╡┘è╪¡╪⌐ ╪º╪¡╪¬╪▒╪º┘ü┘è╪⌐' : 'Pro Tip'}:** [what to read next / how to verify claims]

============================================================
4) UNIVERSAL DOMINANCE RULES (DO NOT BREAK)
============================================================
- Never hallucinate contacts, emails, socials.
- If you can't verify, omit.
- Keep Place descriptions <= 3 sentences.
- 4ΓÇô6 Place results max to avoid truncation.
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

            searchSystemPrompt = `${searchHelpfulMemoryContext ? searchHelpfulMemoryContext + "\n\n" : ''}${searchContinuityContext ? searchContinuityContext + "\n\n" : ''}${buildLeanSearchSystemPrompt({
              language,
              localTime,
              userTimeZone,
              personalSection,
              searchLocationContext,
              searchIntent,
              userNick,
              userDisplayName,
              aiNick,
              toneVal,
              styleVal,
              customNote,
              introRule: eliteIntroRule,
            })}`;

            let fullResponseText = '';
            let groundingMetadata: Gemini3SearchResult['groundingMetadata'] | null = null;

            // Prepare device GPS location for search query injection (all queries, not just business)
            const userLocationForSearch = (requestLocation?.latitude && requestLocation?.longitude) 
              ? { latitude: requestLocation.latitude, longitude: requestLocation.longitude, city: userCity || '', country: userCountry || '' }
              : null;

            // Stream tokens to client
            const searchModel = engineTier === 'intelligence' ? 'gemini-3.1-pro-preview' : 'gemini-3.1-flash-lite';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata: { geminiSearch: { searchType: searchIntent, queries: message.trim() ? [message.trim()] : [] } } })}\n\n`));

            await streamGemini3WithSearch(
              message,
              searchSystemPrompt,
              { temperature: 0.3, maxOutputTokens: 8000 },
              recentMessages,
              (token: string) => {
                fullResponseText += token;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token, content: token })}\n\n`));
              },
              (meta: Gemini3SearchResult['groundingMetadata']) => {
                groundingMetadata = meta;
              },
              userLocationForSearch,
              searchIntent,
              searchModel
            );

            // Emit grounding metadata for frontend citation injection
            if (groundingMetadata) {
              try {
                const gm = groundingMetadata as NonNullable<Gemini3SearchResult['groundingMetadata']>;
                const mapsSourceByPlaceId = new Map<string, { uri?: string; title?: string; googleMapsUri?: string; reviewSnippets?: Array<{ uri?: string; googleMapsUri?: string; title?: string; reviewId?: string; snippet?: string }> }>();
                const groundedWebResultsByPlaceId = new Map<string, Array<Record<string, unknown>>>();
                const allGroundingLinkResults: Array<Record<string, unknown>> = [];
                for (const chunk of (gm.groundingChunks || [])) {
                  const linkedPlaceId = toTrimmedString(chunk?.place?.placeId) || toTrimmedString(chunk?.maps?.placeId);
                  const maps = chunk?.maps;
                  if (maps?.placeId) {
                    mapsSourceByPlaceId.set(maps.placeId, {
                      uri: maps.uri,
                      title: maps.title,
                      googleMapsUri: maps.googleMapsUri,
                      reviewSnippets: Array.isArray(maps.placeAnswerSources?.reviewSnippets) ? maps.placeAnswerSources?.reviewSnippets : [],
                    });
                  }
                  const mapsUrl = normalizeExternalUrl(typeof maps?.googleMapsUri === 'string' ? maps.googleMapsUri : '')
                    || normalizeExternalUrl(typeof maps?.uri === 'string' ? maps.uri : '');
                  if (mapsUrl) {
                    allGroundingLinkResults.push({
                      url: mapsUrl,
                      title: typeof maps?.title === 'string' ? maps.title : '',
                      content: typeof maps?.title === 'string' ? maps.title : '',
                    });
                  }
                  const webUrl = normalizeExternalUrl(typeof chunk?.web?.uri === 'string' ? chunk.web.uri : '');
                  if (webUrl) {
                    allGroundingLinkResults.push({
                      url: webUrl,
                      title: typeof chunk?.web?.title === 'string' ? chunk.web.title : (typeof maps?.title === 'string' ? maps.title : ''),
                      content: typeof chunk?.web?.title === 'string' ? chunk.web.title : '',
                    });
                  }
                  if (linkedPlaceId && webUrl) {
                    const existingWebResults = groundedWebResultsByPlaceId.get(linkedPlaceId) || [];
                    existingWebResults.push({
                      url: webUrl,
                      title: typeof chunk?.web?.title === 'string' ? chunk.web.title : (typeof maps?.title === 'string' ? maps.title : ''),
                      content: typeof chunk?.web?.title === 'string' ? chunk.web.title : '',
                    });
                    if (mapsUrl) {
                      existingWebResults.push({
                        url: mapsUrl,
                        title: typeof maps?.title === 'string' ? maps.title : (typeof chunk?.web?.title === 'string' ? chunk.web.title : ''),
                        content: typeof maps?.title === 'string' ? maps.title : '',
                      });
                    }
                    groundedWebResultsByPlaceId.set(linkedPlaceId, existingWebResults);
                  }
                }
                const mergeGroundingBusinessLinks = (place: GroundedPlaceCard, placeResults: Array<Record<string, unknown>>) => {
                  const scopedLinks = pickVerifiedBusinessLinks(placeResults, place);
                  const scopedMergedPlace = mergeGroundedPlaceCard(place, scopedLinks);
                  const fallbackLinks = pickVerifiedBusinessLinks(allGroundingLinkResults, scopedMergedPlace);
                  return mergeGroundedPlaceCard(scopedMergedPlace, fallbackLinks);
                };
                const groundedPlaceById = new Map<string, GroundedPlaceCard>();
                for (const place of (gm.places || [])) {
                  const label = place.displayName?.text || place.formattedAddress || 'Place';
                  const sourceMeta = place.placeId ? mapsSourceByPlaceId.get(place.placeId) : undefined;
                  const mapsUrl = (typeof place.googleMapsUri === 'string' && place.googleMapsUri)
                    ? normalizeExternalUrl(place.googleMapsUri)
                    : (typeof sourceMeta?.googleMapsUri === 'string' && sourceMeta.googleMapsUri)
                    ? normalizeExternalUrl(sourceMeta.googleMapsUri)
                    : (typeof sourceMeta?.uri === 'string' && sourceMeta.uri)
                    ? normalizeExternalUrl(sourceMeta.uri)
                    : place.placeId
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}&query_place_id=${encodeURIComponent(place.placeId)}`
                    : (place.location?.latitude != null && place.location?.longitude != null
                        ? `https://www.google.com/maps/search/?api=1&query=${place.location.latitude},${place.location.longitude}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`);
                  const initialPlace: GroundedPlaceCard = {
                    placeId: place.placeId || '',
                    name: place.displayName?.text || '',
                    address: place.formattedAddress || '',
                    latitude: place.location?.latitude ?? null,
                    longitude: place.location?.longitude ?? null,
                    rating: typeof place.rating === 'number' ? place.rating : null,
                    userRatingCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
                    websiteUrl: typeof place.websiteUri === 'string' ? normalizeExternalUrl(place.websiteUri) : '',
                    phone: typeof place.internationalPhoneNumber === 'string'
                      ? place.internationalPhoneNumber
                      : (typeof place.nationalPhoneNumber === 'string' ? place.nationalPhoneNumber : ''),
                    email: '',
                    openNow: typeof place.regularOpeningHours?.openNow === 'boolean' ? place.regularOpeningHours.openNow : null,
                    businessStatus: typeof place.businessStatus === 'string' ? place.businessStatus : '',
                    reason: '',
                    vibe: '',
                    mustTry: '',
                    editorialSummary: typeof place.editorialSummary?.text === 'string' ? place.editorialSummary.text : '',
                    reviewSnippets: Array.isArray(sourceMeta?.reviewSnippets) ? sourceMeta.reviewSnippets : [],
                    instagramUrl: '',
                    facebookUrl: '',
                    tiktokUrl: '',
                    whatsappUrl: '',
                    mapsUrl,
                  };
                  const groundedWebResults = place.placeId
                    ? (groundedWebResultsByPlaceId.get(place.placeId) || [])
                    : [];
                  groundedPlaceById.set(place.placeId || label, mergeGroundingBusinessLinks(initialPlace, groundedWebResults));
                }

                for (const [placeId, sourceMeta] of mapsSourceByPlaceId.entries()) {
                  const sourceLabel = typeof sourceMeta.title === 'string' && sourceMeta.title.trim() ? sourceMeta.title.trim() : 'Place';
                  const fallbackMapsUrl = normalizeExternalUrl(typeof sourceMeta.googleMapsUri === 'string' ? sourceMeta.googleMapsUri : '')
                    || normalizeExternalUrl(typeof sourceMeta.uri === 'string' ? sourceMeta.uri : '')
                    || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sourceLabel)}&query_place_id=${encodeURIComponent(placeId)}`;

                  if (!groundedPlaceById.has(placeId)) {
                    const fallbackPlace: GroundedPlaceCard = {
                      placeId,
                      name: sourceLabel,
                      address: '',
                      latitude: null,
                      longitude: null,
                      rating: null,
                      userRatingCount: null,
                      websiteUrl: '',
                      phone: '',
                      email: '',
                      openNow: null,
                      businessStatus: '',
                      reason: '',
                      vibe: '',
                      mustTry: '',
                      editorialSummary: '',
                      reviewSnippets: Array.isArray(sourceMeta.reviewSnippets) ? sourceMeta.reviewSnippets : [],
                      instagramUrl: '',
                      facebookUrl: '',
                      tiktokUrl: '',
                      whatsappUrl: '',
                      mapsUrl: fallbackMapsUrl,
                    };
                    const groundedWebResults = groundedWebResultsByPlaceId.get(placeId) || [];
                    groundedPlaceById.set(placeId, mergeGroundingBusinessLinks(fallbackPlace, groundedWebResults));
                    continue;
                  }

                  const existing = groundedPlaceById.get(placeId);
                  if (!existing) continue;
                  const mergedExisting = mergeGroundedPlaceCard(existing, {
                    reviewSnippets: Array.isArray(sourceMeta.reviewSnippets) ? sourceMeta.reviewSnippets : [],
                    mapsUrl: fallbackMapsUrl,
                  });
                  groundedPlaceById.set(placeId, mergeGroundingBusinessLinks(mergedExisting, groundedWebResultsByPlaceId.get(placeId) || []));
                }

                const allGroundedWebResults: Array<Record<string, unknown>> = allGroundingLinkResults;

                const parsedPlacesFromText = parseGroundedPlacesFromText(fullResponseText);
                const parsedPlaces = parsedPlacesFromText.length > 0
                  ? parsedPlacesFromText
                  : parseGroundedPlacesFromTextLoose(fullResponseText);

                for (const parsedPlace of parsedPlaces) {
                  const parsedKey = normalizePlaceMatchKey(parsedPlace.name, parsedPlace.address);
                  const verifiedLinks = pickVerifiedBusinessLinks(parsedPlace.placeId ? (groundedWebResultsByPlaceId.get(parsedPlace.placeId) || allGroundedWebResults) : allGroundedWebResults, parsedPlace);
                  const mergedParsedPlace = mergeGroundedPlaceCard(parsedPlace, verifiedLinks);
                  let matchedKey = '';

                  for (const [existingKey, existingPlace] of groundedPlaceById.entries()) {
                    if (mergedParsedPlace.placeId && existingPlace.placeId && mergedParsedPlace.placeId === existingPlace.placeId) {
                      matchedKey = existingKey;
                      break;
                    }
                    const existingMatchKey = normalizePlaceMatchKey(existingPlace.name, existingPlace.address);
                    if (parsedKey && existingMatchKey && (parsedKey === existingMatchKey || parsedKey.includes(existingMatchKey) || existingMatchKey.includes(parsedKey))) {
                      matchedKey = existingKey;
                      break;
                    }
                  }

                  if (matchedKey) {
                    const existing = groundedPlaceById.get(matchedKey);
                    if (!existing) continue;
                    groundedPlaceById.set(matchedKey, mergeGroundedPlaceCard(existing, mergedParsedPlace));
                    continue;
                  }
                }

                let groundedPlaces: GroundedPlaceCard[] = Array.from(groundedPlaceById.values());
                const cleanMapSearchQuery = typeof message === 'string' ? message.trim() : '';
                const isNearMeSearchQuery = /\b(near me|nearest|closest|around me|nearby)\b/i.test(cleanMapSearchQuery);
                if (searchIntent === 'business' && groundedPlaces.length === 0) {
                  groundedPlaces = await searchGooglePlacesForQuery(
                    cleanMapSearchQuery,
                    userLocationForSearch ? { latitude: userLocationForSearch.latitude, longitude: userLocationForSearch.longitude } : null,
                    { strictNearby: Boolean(isNearMeSearchQuery && userLocationForSearch?.latitude && userLocationForSearch?.longitude) }
                  );
                }
                groundedPlaces = await enrichGroundedPlacesWithOfficialLinks(groundedPlaces);
                const builtSources = (() => {
                  const byUrl = new Map<string, { url: string; title: string }>();
                  const addSource = (rawUrl?: string, rawTitle?: string) => {
                    const normalizedUrl = normalizeExternalUrl(typeof rawUrl === 'string' ? rawUrl : '');
                    if (!normalizedUrl) return;
                    let title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
                    if (!title) {
                      try {
                        title = new URL(normalizedUrl).hostname.replace(/^www\./, '');
                      } catch {
                        title = normalizedUrl;
                      }
                    }
                    if (!byUrl.has(normalizedUrl)) {
                      byUrl.set(normalizedUrl, { url: normalizedUrl, title });
                    }
                  };

                  for (const chunk of (gm.groundingChunks || [])) {
                    addSource(chunk?.web?.uri, chunk?.web?.title);
                    addSource(chunk?.maps?.googleMapsUri || chunk?.maps?.uri, chunk?.maps?.title);
                  }

                  if (byUrl.size === 0) {
                    for (const place of groundedPlaces) {
                      addSource(place.mapsUrl, place.name);
                      addSource(place.websiteUrl, place.name);
                    }
                  }

                  return Array.from(byUrl.values()).slice(0, 12);
                })();
                const metaPayload = {
                  metadata: {
                    geminiSearch: {
                      searchType: searchIntent,
                      queries: Array.isArray(gm.webSearchQueries) && gm.webSearchQueries.length > 0 ? gm.webSearchQueries : (cleanMapSearchQuery ? [cleanMapSearchQuery] : []),
                      mapSearchQuery: cleanMapSearchQuery,
                      isNearMeQuery: isNearMeSearchQuery,
                      sources: builtSources,
                      supports: gm.groundingSupports || [],
                      places: groundedPlaces,
                      googleMapsWidgetContextToken: gm.googleMapsWidgetContextToken || null,
                      searchEntryPointHtml: isNearMeSearchQuery ? '' : (gm.searchEntryPoint?.renderedContent || '')
                    }
                  }
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(metaPayload)}\n\n`));
              } catch { /* ignore */ }
            } else if (fullResponseText) {
              try {
                const fallbackSources = (() => {
                  const byUrl = new Map<string, { url: string; title: string }>();
                  const addSource = (rawUrl?: string, rawTitle?: string) => {
                    const normalizedUrl = normalizeLikelyExternalUrl(typeof rawUrl === 'string' ? rawUrl : '');
                    if (!normalizedUrl || byUrl.has(normalizedUrl)) return;
                    let title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
                    if (!title) {
                      try {
                        title = new URL(normalizedUrl).hostname.replace(/^www\./, '');
                      } catch {
                        title = normalizedUrl;
                      }
                    }
                    byUrl.set(normalizedUrl, { url: normalizedUrl, title });
                  };

                  for (const entry of extractMarkdownLinks(fullResponseText)) {
                    addSource(entry.url, entry.label);
                  }
                  for (const entry of extractDirectUrls(fullResponseText)) {
                    addSource(entry, '');
                  }

                  return Array.from(byUrl.values()).slice(0, 12);
                })();
                const cleanFallbackQuery = typeof message === 'string' ? message.trim() : '';
                const isNearMeFallbackQuery = /\b(near me|nearest|closest|around me|nearby)\b/i.test(cleanFallbackQuery);
                let fallbackPlaces: GroundedPlaceCard[] = [];
                if (searchIntent === 'business' && cleanFallbackQuery) {
                  fallbackPlaces = await searchGooglePlacesForQuery(
                    cleanFallbackQuery,
                    userLocationForSearch ? { latitude: userLocationForSearch.latitude, longitude: userLocationForSearch.longitude } : null,
                    { strictNearby: Boolean(isNearMeFallbackQuery && userLocationForSearch?.latitude && userLocationForSearch?.longitude) }
                  );
                  fallbackPlaces = await enrichGroundedPlacesWithOfficialLinks(fallbackPlaces);
                }
                const fallbackSourcePayload = (() => {
                  if (fallbackSources.length > 0) return fallbackSources;
                  const byUrl = new Map<string, { url: string; title: string }>();
                  for (const place of fallbackPlaces) {
                    const mapsUrl = normalizeLikelyExternalUrl(typeof place?.mapsUrl === 'string' ? place.mapsUrl : '');
                    const websiteUrl = normalizeLikelyExternalUrl(typeof place?.websiteUrl === 'string' ? place.websiteUrl : '');
                    const title = typeof place?.name === 'string' ? place.name.trim() : '';
                    if (mapsUrl && !byUrl.has(mapsUrl)) byUrl.set(mapsUrl, { url: mapsUrl, title: title || mapsUrl });
                    if (websiteUrl && !byUrl.has(websiteUrl)) byUrl.set(websiteUrl, { url: websiteUrl, title: title || websiteUrl });
                  }
                  return Array.from(byUrl.values()).slice(0, 12);
                })();

                if (fallbackSourcePayload.length > 0 || fallbackPlaces.length > 0) {
                  const fallbackPayload = {
                    metadata: {
                      geminiSearch: {
                        searchType: searchIntent,
                        queries: cleanFallbackQuery ? [cleanFallbackQuery] : [],
                        mapSearchQuery: cleanFallbackQuery,
                        isNearMeQuery: isNearMeFallbackQuery,
                        sources: fallbackSourcePayload,
                        supports: [],
                        places: fallbackPlaces,
                        googleMapsWidgetContextToken: null,
                        searchEntryPointHtml: ''
                      }
                    }
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(fallbackPayload)}\n\n`));
                }
              } catch { /* ignore */ }
            }

            // Log usage
            if (fullResponseText) {
              const inputTokens = estimateTokens(message);
              const outputTokens = estimateTokens(fullResponseText);
              logAIUsage({
                userId,
                functionName: 'brain_stream',
                model: searchModel,
                status: 'success',
                prompt: message,
                response: fullResponseText.slice(0, 500),
                metadata: { trigger: 'search', provider: 'gemini-search', grounded: !!groundingMetadata, engineTier },
                inputTokens,
                outputTokens,
                durationMs: Date.now() - startTime,
                costCredits: calculateCost(searchModel, inputTokens, outputTokens)
              });
            }

            if (!fullResponseText) {
              // Fallback message if no response
              const fallback = language === 'ar' ? '┘ä┘à ╪ú╪¬┘à┘â┘å ┘à┘å ╪º┘ä╪╣╪½┘ê╪▒ ╪╣┘ä┘ë ┘å╪¬╪º╪ª╪¼.' : 'I could not find results for that query.';
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: fallback, content: fallback })}\n\n`));
            }

            await emitAiChatTrialFinished(fullResponseText || message);
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            return; // Exit early - search handled completely by Gemini

          } catch (e) {
            console.warn('ΓÜá∩╕Å GEMINI SEARCH ERROR:', e);
            // Fallback: add user message and let normal flow handle it
            messages.push({ role: 'user', content: message });
          }
        } else {
          // ΓöÇΓöÇΓöÇ CHAT MODE: Always grounded with Gemini 2.5 Flash (smooth, no prompts) ΓöÇΓöÇΓöÇ
          if (effectiveTrigger === 'chat' && chatSubmode === 'chat') {
            // ΓöÇΓöÇΓöÇ LOCATION FOLLOW-UP DETECTION ΓöÇΓöÇΓöÇ
            // If assistant previously asked for location and user just replied with a place,
            // combine with the original intent and run a proper grounded search
            let effectiveMessage = message;
            try {
              // ΓöÇΓöÇΓöÇ YES/OK FOLLOW-UP RESOLVER (CHAT) ΓöÇΓöÇΓöÇ
              // Users often reply with just "yes" to multi-option follow-ups.
              // In Chat mode, make "yes" mean: do BOTH options offered in the last assistant question.
              const rawUser = (message || '').trim();
              const rawUserLower = rawUser.toLowerCase();
              const isAffirmativeOnly = (() => {
                if (!rawUserLower) return false;
                // EN
                if (/^(yes|y|yeah|yep|sure|ok|okay|do it|go ahead|please)\b/.test(rawUserLower)) return true;
                // AR
                if (/^(┘å╪╣┘à|╪º┘è|╪ú┘è┘ê┘ç|╪º┘è┘ê┘ç|╪¬┘à╪º┘à|╪º┘ê┘â┘è|╪¡╪º╪╢╪▒|╪¬┘ü╪╢┘ä|┘è┘ä╪º)\b/.test(rawUserLower)) return true;
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
                  // Combine: "Find the closest coffee shop" + "Al Khor Qatar" ΓåÆ "Find the closest coffee shop near Al Khor, Qatar"
                  const locationReply = message.trim();
                  effectiveMessage = `${originalIntent.replace(/\b(near me|around me|close to me)\b/gi, '')} near ${locationReply}`.trim();
                }
              }
            } catch (err) {
              console.warn(' Location follow-up detection error:', err);
            }

            try {
              // Chat early-return path: respect engineTier for model selection
              const chatModel = 'gemini-3.1-flash-lite';
              const chatEngineLabel = engineTier === 'intelligence' ? 'Intelligence Engine (Flash)' : 'Speed Engine (Flash)';
              modelUsedOuter = chatEngineLabel;
              let fullResponseText = '';
              // Force reminder JSON compliance: append instruction to user turn (Gemini ignores system_instruction alone)
              const reminderAugmentedMessage = messageHasReminderKeyword
                ? `${effectiveMessage}\n\n[SYSTEM OVERRIDE ΓÇö MUST COMPLY]: Append this exact JSON on its own line at the very end of your response, no code fences, no extra text after it:\n{"action":"set_reminder","time":"REPLACE_WITH_ISO8601_DATETIME${formattedOffset}","text":"REPLACE_WITH_REMINDER_TEXT"}`
                : effectiveMessage;
              await streamGemini3FlashChat(
                reminderAugmentedMessage,
                systemPrompt,
                recentMessages,
                (token: string) => {
                  fullResponseText += token;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token, content: token })}\n\n`));
                },
                language,
                (meta: Record<string, unknown>) => {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata: meta })}\n\n`));
                },
                chatModel
              );

              if (!fullResponseText) {
                const fallback = language === 'ar' ? '┘ä┘à ╪ú╪¬┘à┘â┘å ┘à┘å ╪º┘ä╪▒╪».' : 'I could not generate a response.';
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: fallback, content: fallback })}\n\n`));
              }

              // Intercept + schedule any reminder JSON embedded in the response
              await interceptAndScheduleReminder(fullResponseText, userId || '', effectiveTimezone || 'UTC', controller, encoder, formattedOffset);

              await emitAiChatTrialFinished(fullResponseText || message);
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              return;
            } catch (e) {
              console.warn('ΓÜá∩╕Å CHAT GROUNDED ERROR:', e);
              // Fallback to normal chat flow below
            }
          }

          // Emit Study mode metadata so frontend can show ≡ƒôÜ Study badge (even without Wolfram)
          if (chatSubmode === 'study') {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata: { studyMode: true } })}\n\n`));
            } catch { /* ignore */ }
          }

          // === STUDY MODE OCRΓåÆWOLFRAM PIPELINE ===
          // If Study mode has attached images, extract text first, then send to Wolfram
          let ocrExtractedText = '';
          let ocrQuestionType: string | undefined;
          const studyHasImages = chatSubmode === 'study' && Array.isArray(attachedFiles) && attachedFiles.length > 0;
          
          if (studyHasImages) {
            // Send keepalive ping during OCR
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ keepalive: true, stage: 'ocr' })}\n\n`));
            } catch { /* ignore */ }
            
            // Extract text from the first image (most homework photos are single images)
            const firstImage = attachedFiles[0] as { data?: string; content?: string; type?: string; mimeType?: string } | undefined;
            const imageBase64 = firstImage?.data || firstImage?.content || '';
            let imageMimeType = firstImage?.type || firstImage?.mimeType || 'image/jpeg';
            // Normalize mime type
            if (imageMimeType === 'image/jpg') imageMimeType = 'image/jpeg';
            
            if (imageBase64 && imageBase64.length > 100) {
              const ocrResult = await extractTextFromImageForStudy(imageBase64, imageMimeType, message || '', language);
              
              if (ocrResult.success && ocrResult.extractedText) {
                ocrExtractedText = ocrResult.extractedText;
                ocrQuestionType = ocrResult.questionType;
                // Emit OCR metadata for frontend
                try {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    metadata: { 
                      studyOCR: { 
                        extracted: true, 
                        textPreview: ocrExtractedText.substring(0, 200),
                        questionType: ocrQuestionType 
                      } 
                    } 
                  })}\n\n`));
                } catch { /* ignore */ }
              }
            }
          }

          // Determine the raw query string
          const rawWolframQuery = ocrExtractedText
            ? (message?.trim()
                ? `${message}\n\n[Extracted from image]:\n${ocrExtractedText}`
                : ocrExtractedText)
            : message;

          let wolframContext = '';
          let wolframMetaBase: Record<string, unknown> | null = null;
          const useSummaryBox = isSummaryBoxQuery(rawWolframQuery);
          // Widened gate: chat mode now also triggers Wolfram for entity queries
          // ("who is X", "tell me about X", proper-noun lookups). Previously entity
          // questions skipped Wolfram entirely because isWolframQuery's regex only
          // matched math/science subject words ΓÇö exactly Blake's Dec 2025 feedback.
          const useWolfram = chatSubmode === 'study' || isWolframQuery(rawWolframQuery) || useSummaryBox;

          if (useWolfram) {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ keepalive: true, stage: 'wolfram' })}\n\n`));
            } catch { /* ignore */ }

            if (chatSubmode === 'study') {
              // === STUDY MODE: Universal Knowledge Engine ===
              const rawSubject = ocrExtractedText || message || '';
              let cleanSubject = getCleanSubject(rawSubject);

              // STEP 0 ΓÇö Arabic Translation Bridge (internal, never shown to user)
              if (language === 'ar' && cleanSubject.length > 0) {
                cleanSubject = await translateSubjectToEnglish(cleanSubject);
              }

              // STEP 1 ΓÇö Query Recognizer: check accepted + detect summarybox path
              let recognizerAccepted = true;
              let summaryBoxPath: string | null = null;
              let recognizerDomain: string | null = null;
              try {
                const recCtrl = new AbortController();
                const recTid = setTimeout(() => recCtrl.abort(), 1500);
                const recUrl = `https://www.wolframalpha.com/queryrecognizer/query.jsp?appid=${WOLFRAM_LLM_APP_ID}&mode=Default&i=${encodeURIComponent(cleanSubject)}`;
                const recResp = await fetch(recUrl, { signal: recCtrl.signal });
                clearTimeout(recTid);
                if (recResp.ok) {
                  const recXml = await recResp.text();
                  const acceptedMatch = recXml.match(/accepted=["']([^"']+)["']/);
                  recognizerAccepted = acceptedMatch?.[1] !== 'false';
                  const pathMatch = recXml.match(/<summarybox\s+path=["']([^"']+)["']/i);
                  summaryBoxPath = pathMatch?.[1] || null;
                  const domainMatch = recXml.match(/domain=["']([^"']+)["']/);
                  recognizerDomain = domainMatch?.[1] || null;
                }
              } catch {
                // fail-open
              }

              if (recognizerAccepted) {
                const parts: string[] = [];
                let eliteSummaryBoxResult: SummaryBoxResult | null = null;

                if (summaryBoxPath) {
                  // STEP 2a ΓÇö ELITE CARD PATH: Summary Box + LLM API in parallel
                  const [llmResult, summaryBoxResult] = await Promise.all([
                    queryWolframLLM(cleanSubject, 8000),
                    queryWolframSummaryBox(cleanSubject, 5000),
                  ]);
                  eliteSummaryBoxResult = summaryBoxResult;

                  if (summaryBoxResult.success && summaryBoxResult.summary) {
                    parts.push(`[WOLFRAM ELITE CARD (${summaryBoxResult.domain || recognizerDomain || 'entity'})]:\n${summaryBoxResult.summary.substring(0, 1000)}`);
                    wolframUsedOuter = true;
                  }
                  if (llmResult.success && llmResult.factSheet) {
                    parts.push(`[WOLFRAM FACT SHEET]:\n${llmResult.factSheet}`);
                    wolframUsedOuter = true;
                  }
                } else {
                  // STEP 2b ΓÇö STANDARD PATH: LLM API for deep context
                  const llmResult = await queryWolframLLM(cleanSubject, 8000);
                  if (llmResult.success && llmResult.factSheet) {
                    parts.push(`[WOLFRAM VERIFIED DATA]:\n${llmResult.factSheet}`);
                    wolframUsedOuter = true;
                  } else {
                    // STEP 3 ΓÇö SHORT ANSWER FALLBACK: v1/result for a single verified fact
                    try {
                      const saCtrl = new AbortController();
                      const saTid = setTimeout(() => saCtrl.abort(), 3000);
                      const saUrl = `https://api.wolframalpha.com/v1/result?appid=${WOLFRAM_LLM_APP_ID}&i=${encodeURIComponent(cleanSubject)}`;
                      const saResp = await fetch(saUrl, { signal: saCtrl.signal });
                      clearTimeout(saTid);
                      if (saResp.ok) {
                        const saText = (await saResp.text()).trim();
                        if (saText && saText.length > 3 && !saText.toLowerCase().startsWith('wolfram')) {
                          parts.push(`[WOLFRAM VERIFIED FACT]:\n${saText}`);
                          wolframUsedOuter = true;
                        }
                      }
                    } catch { /* best-effort */ }
                  }
                }

                wolframMetaBase = {
                  api: summaryBoxPath ? 'elite_card' : 'llm_api',
                  mode: 'study',
                  subject: cleanSubject,
                  ...(eliteSummaryBoxResult?.success && eliteSummaryBoxResult?.rawHtml
                    ? { summaryBox: eliteSummaryBoxResult.rawHtml }
                    : {}),
                };

                if (parts.length > 0) {
                  const instruction = language === 'ar'
                    ? '\n\n╪ú┘å╪¬ ┘à╪»╪▒╪│ ╪«╪¿┘è╪▒ ┘ê╪░┘ê ╪┤╪«╪╡┘è╪⌐. ╪º╪│╪¬╪«╪»┘à ╪º┘ä╪¿┘è╪º┘å╪º╪¬ ╪º┘ä┘à┘ê╪½┘é╪⌐ ╪ú╪╣┘ä╪º┘ç ┘â┘à╪╡╪»╪▒┘â ╪º┘ä╪▒╪ª┘è╪│┘è ┘ä┘ä╪¡┘é╪º╪ª┘é.\n┘é╪º╪╣╪»╪⌐ ╪╡╪º╪▒┘à╪⌐: ╪º┘â╪¬╪¿ ╪¼┘à┘ä╪⌐ ┘à┘ä╪«╪╡ ┘ü╪▒┘è╪»╪⌐ ┘ê╪░╪º╪¬ ╪┤╪«╪╡┘è╪⌐ ╪»╪º╪«┘ä ┘ê╪│┘ê┘à [BOX]...[/BOX] ┘ü┘è ╪¿╪»╪º┘è╪⌐ ╪▒╪»┘â ┘ü┘é╪╖. ╪º┘ä╪¼┘à┘ä╪⌐ ╪»╪º╪«┘ä [BOX] ┘è╪¼╪¿ ╪ú┘å ┘ä╪º ╪¬┘Å┘â╪▒┘Ä┘æ╪▒ ╪ú╪¿╪»╪º┘ï ┘ü┘è ╪º┘ä┘ü┘é╪▒╪⌐ ╪º┘ä╪ú┘ê┘ä┘ë ╪ú┘ê ╪ú┘è ┘à┘â╪º┘å ┘ü┘è ╪º┘ä┘å╪╡.'
                    : '\n\nYou are an expert tutor with personality. Use the Verified Data above as your primary source of truth.\nSTRICT RULE: Write ONE unique personality-driven sentence inside [BOX]...[/BOX] at the very start. That exact sentence MUST NOT appear again ΓÇö not in the first paragraph, not anywhere in the body. The body explanation starts fresh after the [BOX] tag.';
                  wolframContext = parts.join('\n\n') + instruction;

                  try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata: { wolfram: wolframMetaBase } })}\n\n`));
                  } catch { /* ignore */ }
                }
              }

            } else {
              // === NON-STUDY MODE: Full Results (math/science) + Summary Box (entities), in parallel ===
              // Only hit legacy v2/query when the query genuinely looks computational.
              // Pure entity queries skip it ΓÇö Wolfram's v2/query would return empty and
              // still be counted as a billable failed Full Results call.
              const summaryBoxInput = normalizeSummaryBoxQuery(rawWolframQuery);
              const runFullResults = isWolframQuery(rawWolframQuery);
              const [fullResultsResult, summaryBoxResult] = await Promise.all([
                runFullResults
                  ? queryWolfram(rawWolframQuery, 4000)
                  : Promise.resolve<{ success: boolean; answer?: string; steps?: string[]; interpretation?: string; error?: string }>({ success: false }),
                useSummaryBox ? queryWolframSummaryBox(summaryBoxInput, 5000) : Promise.resolve<SummaryBoxResult>({ success: false })
              ]);

              let fullResultsData = '';
              let summaryBoxData = '';

              if (fullResultsResult.success && fullResultsResult.answer) {
                const wolfResult = fullResultsResult;
                wolframMetaBase = { answer: wolfResult.answer, interpretation: wolfResult.interpretation || null, steps: wolfResult.steps || [], mode: chatSubmode, api: 'full_results' };
                try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata: { wolfram: wolframMetaBase } })}\n\n`)); } catch { /* ignore */ }
                fullResultsData = language === 'ar'
                  ? `[╪¡┘é┘è┘é╪⌐ ┘à┘ê╪½┘é╪⌐: ${wolfResult.answer}]`
                  : `[Verified fact: ${wolfResult.answer}]`;
                wolframUsedOuter = true;
              }

              if (summaryBoxResult.success && summaryBoxResult.summary) {
                const summaryText = summaryBoxResult.summary || '';
                try {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata: { wolfram: { ...(wolframMetaBase || {}), summaryBox: summaryText.substring(0, 1200), summaryDomain: summaryBoxResult.domain || null, api: wolframMetaBase ? 'full_results+summary_boxes' : 'summary_boxes' } } })}\n\n`));
                } catch { /* ignore */ }
                summaryBoxData = language === 'ar'
                  ? `[┘à╪╣┘ä┘ê┘à╪º╪¬ ╪Ñ╪╢╪º┘ü┘è╪⌐ ╪╣┘å ${summaryBoxResult.domain || '╪º┘ä┘à┘ê╪╢┘ê╪╣'}]\n${summaryText.substring(0, 800)}`
                  : `[Additional info about ${summaryBoxResult.domain || 'topic'}]\n${summaryText.substring(0, 800)}`;
                wolframUsedOuter = true;
              }

              if (fullResultsData || summaryBoxData) {
                const combinedParts = [fullResultsData, summaryBoxData].filter(Boolean);
                wolframContext = combinedParts.join('\n\n') + (language === 'ar' ? '\n\n╪º╪│╪¬╪«╪»┘à ┘ç╪░┘ç ╪º┘ä┘à╪╣┘ä┘ê┘à╪º╪¬ ┘ü┘è ╪Ñ╪¼╪º╪¿╪¬┘â ╪¿╪┤┘â┘ä ╪╖╪¿┘è╪╣┘è.' : '\n\nUse this information naturally in your response.');
              }
            }
          }

          // Build final user message
          // Include OCR-extracted text context for Study mode with images
          const ocrContext = ocrExtractedText 
            ? (language === 'ar'
                ? `\n\n[┘å╪╡ ┘à╪│╪¬╪«╪▒╪¼ ┘à┘å ╪º┘ä╪╡┘ê╪▒╪⌐]:\n${ocrExtractedText}`
                : `\n\n[Text extracted from image]:\n${ocrExtractedText}`)
            : '';
          
          if (wolframContext) {
            messages.push({ role: 'user', content: `${wolframContext}${ocrContext}\n\nUser question: ${message}` });
          } else if (ocrExtractedText) {
            // Study mode with image but no Wolfram result - still include OCR context
            messages.push({ role: 'user', content: `${ocrContext}\n\nUser question: ${message || (language === 'ar' ? '╪º╪┤╪▒╪¡ ┘ç╪░╪º' : 'Explain this')}` });
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
          // Tiered Engine Router ΓÇö based on user's engineTier preference (speed | intelligence)
          const isDeepWork = chatSubmode === 'study' || effectiveTrigger === 'search';
          let selectedModel: string;
          let engineLabel: string;
          if (engineTier === 'intelligence') {
            selectedModel = isDeepWork ? 'gemini-3.1-pro-preview' : 'gemini-3.1-flash-lite';
            engineLabel = isDeepWork ? 'Intelligence Engine (Pro)' : 'Intelligence Engine (Flash)';
          } else {
            selectedModel = 'gemini-3.1-flash-lite';
            engineLabel = isDeepWork ? 'Speed Engine (Flash/Deep)' : 'Speed Engine (Flash)';
          }
          modelUsed = engineLabel;
          modelUsedOuter = engineLabel;
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ providerUsed: 'gemini' })}\n\n`)); } catch { /* ignore */ }
          
          let geminiTokenCount = 0;
          await streamGemini(
            selectedModel,
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
          // CRITICAL: Reformat messages from Gemini format if needed
          // Gemini uses contents array with parts, OpenAI uses standard messages
          let reformattedMessages = messages;
          
          // If messages were built for Gemini (has system in messages), keep as-is
          // OpenAI expects standard { role, content } format
          
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: reformattedMessages,
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
        };

        const tryClaude = async () => {
          if (!ANTHROPIC_API_KEY) throw new Error('Claude API key not configured');
          // CRITICAL: Reformat messages for Claude format
          // Claude expects separate system string and messages array
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
        };

        try {
          try {
            await tryGemini();
          } catch (errGemini) {
            const errMsg = errGemini instanceof Error ? errGemini.message : String(errGemini);
            console.warn('ΓÜá∩╕Å Gemini failed, trying OpenAI...', errMsg);
            try {
              await tryOpenAI();
            } catch (errOpenAI) {
              const errMsg2 = errOpenAI instanceof Error ? errOpenAI.message : String(errOpenAI);
              console.warn('ΓÜá∩╕Å OpenAI failed, trying Claude...', errMsg2);
              await tryClaude();
            }
          }
        } catch (finalErr) {
          const errMsg = finalErr instanceof Error ? finalErr.message : String(finalErr);
          console.error('Γ¥î All providers failed', errMsg);
          throw finalErr;
        }

        if (aiProvider === 'gemini') {
          // Backend reminder interception: parse JSON block from response, schedule, strip it
          responseText = await interceptAndScheduleReminder(responseText, userId || '', effectiveTimezone || 'UTC', controller, encoder, formattedOffset);

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
            response: responseText.slice(0, 500),
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

        // Backend reminder interception for OpenAI/Claude paths
        responseText = await interceptAndScheduleReminder(responseText, userId || '', effectiveTimezone || 'UTC', controller, encoder, formattedOffset);

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

        await emitAiChatTrialFinished(responseText || requestMessage);

        controller.close();
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('≡ƒöÑ ERROR:', errMsg);
        
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
