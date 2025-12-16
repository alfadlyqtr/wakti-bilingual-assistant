import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

type ChatRole = "system" | "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type IncomingHistoryMessage = {
  role?: "user" | "assistant";
  content?: string;
};

type RequestBody = {
  message?: string;
  language?: string;
  history?: IncomingHistoryMessage[];
};

type ManualEntry = {
  id: string;
  section: string;
  title_en: string;
  title_ar: string;
  content_en: string;
  content_ar: string;
  tags: string[];
  route: string | null;
  chip_label_en: string | null;
  chip_label_ar: string | null;
};

type Chip = {
  label: string;
  route: string;
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Small in-memory cache per query (speeds up repeated questions)
type CacheItem = { ts: number; entries: ManualEntry[] };
const QUERY_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const queryCache = new Map<string, CacheItem>();

function buildSystemPrompt(language: "en" | "ar", manualContext: string): string {
  if (language === "ar") {
    return `أنت مساعد WAKTI الودود! تخيل نفسك كصديق يساعد المستخدم يكتشف التطبيق.

إليك معلومات من دليل WAKTI:
${manualContext}

أسلوبك:
- تكلم بشكل طبيعي وودود، مثل صديق يشرح لصديقه.
- استخدم نص عادي فقط. لا تستخدم ** أو ## أو - أو نقاط.
- اشرح الخطوات بوضوح وبساطة.
- اذكر الأيقونات لما تساعد (مثل: أيقونة المايك).
- إذا الميزة في الهيدر (أعلى الشاشة)، قل "شوف أعلى الشاشة جنب صورتك".
- إذا الميزة في القائمة، قل "اضغط شعار W أعلى اليسار لفتح القائمة".
- إذا ما لقيت الجواب، قل "ما عندي هالمعلومة، ممكن توضح سؤالك؟"
- إذا السؤال مو عن WAKTI، قل "أنا متخصص بـ WAKTI بس، كيف أقدر أساعدك فيه؟"
- استخدم العربية فقط.`;
  }
  return `You are WAKTI's friendly helper! Think of yourself as a buddy helping the user discover the app.

Here is information from the WAKTI manual:
${manualContext}

Your style:
- Talk naturally and warmly, like a friend explaining to a friend.
- Use plain text only. Never use **, ##, -, or bullet points.
- Explain steps clearly and simply.
- Mention icons when helpful (like: mic icon, music note icon).
- If the feature is in the header (top of screen), say "Look at the top of your screen, next to your avatar".
- If the feature is in the menu, say "Tap the W logo (top-left) to open the menu".
- If you cannot find the answer, say "I don't have that info, can you clarify your question?"
- If the question is not about WAKTI, say "I'm here to help with WAKTI only, what can I help you with?"
- Respond in English only.`;
}

async function searchManual(query: string, language: "en" | "ar"): Promise<ManualEntry[]> {
  const queryLower = query.toLowerCase();
  const cacheKey = `${language}:${queryLower}`;
  const cached = queryCache.get(cacheKey);
  const now = Date.now();
  if (cached && (now - cached.ts) < QUERY_CACHE_TTL) {
    return cached.entries;
  }

  const keywords = queryLower.split(/\s+/).filter((w) => w.length > 2).slice(0, 6);

  // Targeted DB search (fast): only pull likely matches
  const ilikes = keywords.slice(0, 3).map((kw) => `%${kw}%`);
  const titleField = language === "ar" ? "title_ar" : "title_en";
  const contentField = language === "ar" ? "content_ar" : "content_en";
  const orParts = ilikes.length
    ? ilikes
        .flatMap((p) => [`${titleField}.ilike.${p}`, `${contentField}.ilike.${p}`])
        .join(",")
    : `${titleField}.ilike.%${queryLower}%,${contentField}.ilike.%${queryLower}%`;

  const { data, error } = await supabase
    .from("help_manual")
    .select("id,section,title_en,title_ar,content_en,content_ar,tags,route,chip_label_en,chip_label_ar")
    .or(orParts)
    .limit(20);

  if (error || !data) {
    console.error("Manual search error:", error);
    queryCache.set(cacheKey, { ts: now, entries: [] });
    return [];
  }

  const entries = data as ManualEntry[];
  if (entries.length === 0) {
    queryCache.set(cacheKey, { ts: now, entries: [] });
    return [];
  }
  
  // Boost exact phrase matches and important keywords
  const scored = entries.map(entry => {
    let score = 0;
    const titleField = (language === "ar" ? entry.title_ar : entry.title_en).toLowerCase();
    const contentField = (language === "ar" ? entry.content_ar : entry.content_en).toLowerCase();
    const tagsLower = entry.tags.map(t => t.toLowerCase());
    const allText = `${titleField} ${contentField} ${tagsLower.join(" ")}`;

    // Exact tag match = highest priority
    for (const tag of tagsLower) {
      if (queryLower.includes(tag) || tag.includes(queryLower)) {
        score += 10;
      }
    }
    
    // Title match = high priority
    for (const kw of keywords) {
      if (titleField.includes(kw)) score += 5;
    }
    
    // Content/tag keyword match
    for (const kw of keywords) {
      if (allText.includes(kw)) score += 2;
      for (const tag of tagsLower) {
        if (tag.includes(kw)) score += 3;
      }
    }
    
    return { entry, score };
  });

  scored.sort((a, b) => b.score - a.score);
  
  // Return top 3 with score > 0
  const top = scored.filter((s) => s.score > 0).slice(0, 3).map((s) => s.entry);
  queryCache.set(cacheKey, { ts: now, entries: top });
  return top;
}

function buildManualContext(entries: ManualEntry[], language: "en" | "ar"): string {
  if (entries.length === 0) return language === "ar" ? "(لا توجد نتائج)" : "(No results found)";
  
  return entries.map(e => {
    const title = language === "ar" ? e.title_ar : e.title_en;
    const content = language === "ar" ? e.content_ar : e.content_en;
    return `${title}: ${content}`;
  }).join("\n\n");
}

function extractChips(entries: ManualEntry[], language: "en" | "ar"): Chip[] {
  // Only return 1 chip from the TOP result (most relevant)
  // This avoids confusing users with multiple random chips
  for (const e of entries.slice(0, 1)) {
    if (!e.route) continue;
    
    const label = language === "ar" ? e.chip_label_ar : e.chip_label_en;
    if (label) {
      return [{ label, route: e.route }];
    }
  }
  
  return []; // No chip if top result has no route
}

// Strip markdown formatting from AI response
function cleanReply(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold** -> bold
    .replace(/\*([^*]+)\*/g, "$1")     // *italic* -> italic
    .replace(/^#{1,6}\s+/gm, "")       // ## heading -> heading
    .replace(/^[-•]\s+/gm, "")         // - bullet -> bullet
    .replace(/^\d+\.\s+/gm, (m) => m)  // keep numbered lists
    .trim();
}

async function callDeepSeek(messages: ChatMessage[]): Promise<string | null> {
  if (!DEEPSEEK_API_KEY) return null;
  
  try {
    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: 0.2,
        max_tokens: 800,
      }),
    });

    if (!resp.ok) {
      console.error("DeepSeek error:", resp.status);
      return null;
    }

    const json = await resp.json();
    return String(json?.choices?.[0]?.message?.content ?? "").trim() || null;
  } catch (e) {
    console.error("DeepSeek exception:", e);
    return null;
  }
}

async function callOpenAI(messages: ChatMessage[]): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.2,
        max_tokens: 800,
      }),
    });

    if (!resp.ok) {
      console.error("OpenAI error:", resp.status);
      return null;
    }

    const json = await resp.json();
    return String(json?.choices?.[0]?.message?.content ?? "").trim() || null;
  } catch (e) {
    console.error("OpenAI exception:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    let body: RequestBody = {};
    try {
      body = (await req.json()) as RequestBody;
    } catch (_e) {
      void _e;
      body = {};
    }

    const message = String(body?.message || "").trim();
    const language = (body?.language === "ar" ? "ar" : "en") as "ar" | "en";
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return new Response(
        JSON.stringify({ error: "message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Search manual for relevant entries
    const manualEntries = await searchManual(message, language);
    const manualContext = buildManualContext(manualEntries, language);
    const chips = extractChips(manualEntries, language);

    // Build system prompt with manual context
    const systemPrompt = buildSystemPrompt(language, manualContext);

    const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

    for (const m of history.slice(-6)) {
      const role = m?.role === "assistant" ? "assistant" : "user";
      const content = String(m?.content ?? "").trim();
      if (!content) continue;
      messages.push({ role, content });
    }

    messages.push({ role: "user", content: message });

    // Try DeepSeek first, fallback to OpenAI
    let reply = await callDeepSeek(messages);
    let provider = "deepseek";
    let model = "deepseek-chat";

    if (!reply) {
      console.log("DeepSeek failed, trying OpenAI fallback...");
      reply = await callOpenAI(messages);
      provider = "openai";
      model = "gpt-4o-mini";
    }

    const durationMs = Date.now() - start;

    if (!reply) {
      await logAIFromRequest(req, {
        functionName: "help-assistant-chat",
        provider,
        model,
        inputText: message,
        durationMs,
        status: "error",
        errorMessage: "All providers failed",
      });

      return new Response(
        JSON.stringify({ 
          reply: language === "ar" 
            ? "عذراً، لم أتمكن من الرد الآن. حاول مرة أخرى."
            : "Sorry, I couldn't respond right now. Please try again.",
          chips: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean markdown from reply
    const cleanedReply = cleanReply(reply);

    await logAIFromRequest(req, {
      functionName: "help-assistant-chat",
      provider,
      model,
      inputText: message,
      outputText: cleanedReply,
      durationMs,
      status: "success",
    });

    return new Response(
      JSON.stringify({ reply: cleanedReply, chips }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const durationMs = Date.now() - start;

    try {
      await logAIFromRequest(req, {
        functionName: "help-assistant-chat",
        provider: "unknown",
        model: "unknown",
        durationMs,
        status: "error",
        errorMessage: String((e as { message?: string })?.message || e || "Unknown error"),
      });
    } catch (_e) {
      void _e;
    }

    return new Response(
      JSON.stringify({ error: "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
