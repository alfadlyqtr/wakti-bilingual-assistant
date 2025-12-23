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
const WOLFRAM_APP_ID = Deno.env.get('WOLFRAM_APP_ID') || 'VJT5YA9VGJ';
const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

async function streamGemini3WithSearch(
  query: string,
  systemInstruction: string,
  generationConfig: Record<string, unknown> | undefined,
  onToken: (token: string) => void,
  onGroundingMetadata: (meta: Gemini3SearchResult['groundingMetadata']) => void,
  _userLocation?: { latitude: number; longitude: number } | null
): Promise<string> {
  const key = getGeminiApiKey();
  const model = 'gemini-3-flash-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

  const latestQuery = `${query}\n\nLATEST-FIRST RULE (CRITICAL): Use the newest available sources/snippets. Prefer results updated today/this hour when present. If sources conflict, choose the most recently updated. Do not use memory for live facts.`;

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: latestQuery }] }],
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

CRITICAL MULTI-LANGUAGE RULE
- You are multilingual. Default to the UI language "${language}".
- If the user asks for a translation or specifies a target language, RESPOND IN THAT TARGET LANGUAGE.
${personalSection}
CRITICAL OUTPUT FORMAT
- Markdown table: for structured multi-item results (≥3 items with attributes).
- Bulleted list: for steps, checklists, 1–2 results.
- Paragraph: for conversational replies.
- Use Markdown links ONLY when a real URL is provided.

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

// Detect if query is suitable for Wolfram (math/science/facts)
function isWolframQuery(q: string): boolean {
  if (!q) return false;
  const lower = q.toLowerCase();
  // Math patterns
  if (/\d+\s*[\+\-\*\/\^]\s*\d+/.test(q)) return true;
  if (/\b(solve|integrate|derivative|limit|factor|simplify|equation|calculate)\b/i.test(q)) return true;
  if (/[∫∑∏√π∞]/.test(q)) return true;
  if (/\b(sin|cos|tan|log|ln|sqrt)\s*\(/i.test(q)) return true;
  // Science/facts patterns
  if (/\b(convert|distance|population|capital|temperature|speed of|atomic|molecular|planet|star|gravity)\b/i.test(lower)) return true;
  if (/\d+\s*(km|m|cm|mm|ft|in|mi|kg|g|lb|oz|l|ml|gal|mph|kph|°[CF])/i.test(q)) return true;
  if (/\b(how (far|much|many|tall|big|old)|what is the)\b/i.test(lower)) return true;
  return false;
}

function isWaktiInvolved(q: string) {
  try {
    const s = String(q || '').trim();
    if (!s) return false;
    return /\bwakti\b/i.test(s) || /وقتي/.test(s);
  } catch {
    return false;
  }
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Defensive body parsing
        let body: Record<string, unknown> = {};
        try {
          const bodyText = await req.text();
          body = bodyText ? JSON.parse(bodyText) : {};
        } catch (bodyErr: unknown) {
          const errMsg = bodyErr instanceof Error ? bodyErr.message : 'Unknown error';
          console.error('🔥 BODY PARSE ERROR:', errMsg);
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
          activeTrigger = 'general',
          chatSubmode = 'chat', // 'chat' or 'study'
          location = null,
          clientTimezone = 'UTC'
        } = body as { message?: string; language?: string; recentMessages?: unknown[]; personalTouch?: unknown; activeTrigger?: string; chatSubmode?: string; location?: any; clientTimezone?: string };

        // Store for logging
        requestMessage = typeof message === 'string' ? message : '';
        requestTrigger = activeTrigger;
        requestSubmode = chatSubmode;

        console.log(`🎯 REQUEST: trigger=${activeTrigger}, submode=${chatSubmode}, lang=${language}`);

        if (!message) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Message required' })}\n\n`));
          controller.close();
          return;
        }

        // Chat mode: if the user is asking about WAKTI specifically, respond with the correct format + chip
        if (activeTrigger === 'chat' && chatSubmode === 'chat' && isWaktiInvolved(message)) {
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
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Qatar'
        });

        // Build enhanced system prompt (pass chatSubmode for Study mode tutor instructions)
        const systemPrompt = buildSystemPrompt(
          language,
          currentDate,
          personalTouch as Record<string, unknown> | null | undefined,
          activeTrigger,
          chatSubmode
        );
        
        const messages = [
          { role: 'system', content: systemPrompt }
        ];

        // Add history
        if (Array.isArray(recentMessages) && recentMessages.length > 0) {
          const historyMessages = (recentMessages as Array<Record<string, unknown>>).slice(-6);
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
        if (activeTrigger === 'search') {
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
            const userTimeZone = clientTimezone || 'UTC';
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

            const searchSystemPrompt = `You are WAKTI AI — an elite, hyper-intelligent Search Intelligence.
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

## 💡 ${language === 'ar' ? 'رؤية وقطي' : 'THE WAKTI INSIGHT'}
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
              { temperature: 1.0, maxOutputTokens: 2000 },
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
          if (activeTrigger === 'chat' && chatSubmode === 'chat') {
            const freshnessScore = scoreChatNeedsFreshSearch(message);
            if (freshnessScore >= 0.8) {
              try {
                let fullResponseText = '';
                await streamGemini3WithSearch(
                  message,
                  systemPrompt,
                  { temperature: 0.7, maxOutputTokens: 2000 },
                  (token: string) => {
                    fullResponseText += token;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token, content: token })}\n\n`));
                  },
                  () => {}
                );

                if (!fullResponseText) {
                  const fallback = language === 'ar' ? 'لم أتمكن من العثور على نتائج.' : 'I could not find results for that query.';
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: fallback, content: fallback })}\n\n`));
                }

                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
                return;
              } catch (e) {
                console.warn('⚠️ CHAT FRESH SEARCH ERROR:', e);
              }
            }
          }

          // Emit Study mode metadata so frontend can show 📚 Study badge (even without Wolfram)
          if (chatSubmode === 'study') {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata: { studyMode: true } })}\n\n`));
            } catch {}
          }

          // Study mode ALWAYS tries Wolfram; Chat mode only for math/science queries
          let wolframContext = '';
          const useWolfram = chatSubmode === 'study' || isWolframQuery(message);
          
          if (useWolfram) {
            console.log(`🔢 WOLFRAM: ${chatSubmode === 'study' ? 'Study mode (always)' : 'Facts booster'} - querying...`);
            try {
              // Study mode: shorter timeout (2s) to not slow down, Chat mode: longer (2.5s)
              const wolfResult = await queryWolfram(message, chatSubmode === 'study' ? 2000 : 2500);
              
              if (wolfResult.success && wolfResult.answer) {
                // Emit metadata so frontend knows Wolfram was used
                try {
                  const wolfMeta = {
                    metadata: {
                      wolfram: {
                        answer: wolfResult.answer,
                        interpretation: wolfResult.interpretation || null,
                        steps: wolfResult.steps || [],
                        mode: chatSubmode
                      }
                    }
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(wolfMeta)}\n\n`));
                } catch {}

                // Build context for AI
                if (chatSubmode === 'study') {
                  wolframContext = language === 'ar'
                    ? `[بيانات موثقة]\nالسؤال: ${wolfResult.interpretation || message}\nالإجابة: ${wolfResult.answer}${wolfResult.steps?.length ? '\nالخطوات: ' + wolfResult.steps.join(' → ') : ''}\n\nاستخدم هذه البيانات لشرح الإجابة بطريقة تعليمية واضحة. اعرض الإجابة أولاً ثم الشرح.`
                    : `[Verified data]\nQuestion: ${wolfResult.interpretation || message}\nAnswer: ${wolfResult.answer}${wolfResult.steps?.length ? '\nSteps: ' + wolfResult.steps.join(' → ') : ''}\n\nUse this data to explain the answer in a clear, educational way. Present the answer first, then explain.`;
                } else {
                  wolframContext = language === 'ar'
                    ? `[حقيقة موثقة: ${wolfResult.answer}]\n\nاستخدم هذه الحقيقة في إجابتك بشكل طبيعي.`
                    : `[Verified fact: ${wolfResult.answer}]\n\nUse this fact naturally in your response.`;
                }
                console.log('✅ WOLFRAM: Data injected into prompt');
                wolframUsedOuter = true; // Mark that Wolfram was successfully used
              } else {
                console.log('⚠️ WOLFRAM: No result, AI will handle alone');
              }
            } catch (wolfErr) {
              console.warn('⚠️ WOLFRAM: Error (AI will handle alone):', wolfErr);
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
              max_tokens: 4000,
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
          const sr = streamReader;
          if (!sr) throw new Error('No stream reader available');
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
