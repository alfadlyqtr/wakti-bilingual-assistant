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

// Cache browser CORS preflight for this function to reduce repeated OPTIONS latency
const corsHeadersWithMaxAge = {
  ...corsHeaders,
  "Access-Control-Max-Age": "86400",
};

// Small in-memory cache per query (speeds up repeated questions)
type CacheItem = { ts: number; entries: ManualEntry[] };
const QUERY_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const queryCache = new Map<string, CacheItem>();

// ============================================================================
// SMART-SKIP: Canned responses for general/off-topic questions (NO AI CALL)
// ============================================================================
const GENERAL_REDIRECT_EN = `Hey! For help with your homework or any general question, "WAKTI AI" is your go-to buddy. It can explain concepts, solve problems, and even search the web for extra info. To get started, tap the "W logo" (top-left) to open the menu, then tap "WAKTI AI". In the input bar you'll see a mode selector — keep it on "Chat mode" (default) for normal conversations. Just type or speak your question and WAKTI AI will help you out. If you need to look something up online or watch a tutorial, switch to "Search mode" from that same selector (Web or YouTube). And honestly — for homework and studying, "Study mode" is usually the best: it explains step-by-step like a real tutor. Give it a try — it's like having a study partner right inside the app.`;

const GENERAL_REDIRECT_AR = `مرحباً! إذا تحتاج مساعدة في الواجب أو أي سؤال عام، "WAKTI AI" هو صاحبك الأول. يشرح الأفكار، يحل المسائل، وحتى يقدر يبحث لك من الإنترنت لو تحتاج معلومات إضافية. عشان تبدأ: اضغط على "شعار W" (أعلى اليسار) عشان تفتح القائمة، بعدين اضغط "WAKTI AI". داخل خانة الكتابة بتشوف اختيار الوضع — خلّه على "Chat mode" (هذا الوضع الافتراضي للمحادثة). اكتب أو تكلم بسؤالك، وWAKTI AI بيساعدك فوراً. ولو تحتاج تبحث عن شيء أو تشوف شرح، بدّل إلى "Search mode" من نفس المكان (Web أو YouTube). وبصراحة للواجبات والدراسة، "Study mode" غالباً أفضل شيء لأنه يشرح خطوة بخطوة مثل مدرس. جرّبه — كأن عندك شريك مذاكرة داخل التطبيق.`;

const GENERAL_CHIP: Chip = { label: "Open WAKTI AI", route: "/wakti-ai-v2" };
const GENERAL_CHIP_AR: Chip = { label: "افتح WAKTI AI", route: "/wakti-ai-v2" };

// Keywords that indicate a general/off-topic question (NOT about WAKTI features)
const GENERAL_KEYWORDS = [
  // Homework / study
  "homework", "home work", "assignment", "exam", "test", "quiz", "study", "studying",
  "math", "maths", "algebra", "geometry", "calculus", "physics", "chemistry", "biology",
  "history", "geography", "english", "arabic", "science", "essay", "project",
  "solve", "equation", "problem", "answer", "question", "help me with",
  // Arabic homework keywords
  "واجب", "امتحان", "اختبار", "مذاكرة", "دراسة", "رياضيات", "فيزياء", "كيمياء",
  "احياء", "تاريخ", "جغرافيا", "انجليزي", "عربي", "علوم", "مشروع", "حل", "معادلة",
  // General life / random
  "weather", "news", "recipe", "cook", "movie", "song", "joke", "story",
  "relationship", "advice", "life", "love", "friend", "family",
  "الطقس", "اخبار", "وصفة", "طبخ", "فيلم", "اغنية", "نكتة", "قصة", "علاقة", "نصيحة",
  // Explicit "help me" patterns
  "can you help", "help me", "i need help", "ساعدني", "محتاج مساعدة",
];

// Keywords that indicate the question IS about WAKTI features (override general detection)
const WAKTI_FEATURE_KEYWORDS = [
  "wakti", "tasjeel", "maw3d", "voice studio", "voice clone", "tts", "text to speech",
  "translator", "translate", "calendar", "task", "reminder", "contact", "journal",
  "vitality", "whoop", "fitness", "sleep", "music studio", "games", "settings",
  "dashboard", "search mode", "chat mode", "study mode", "image", "vision",
  "sidebar", "menu", "w logo", "header", "avatar",
  // Arabic feature keywords
  "تسجيل", "موعد", "صوت", "استنساخ", "ترجمة", "تقويم", "مهمة", "تذكير", "جهات اتصال",
  "يوميات", "حيوية", "نوم", "موسيقى", "العاب", "اعدادات", "لوحة", "قائمة",
];

function isGeneralQuestion(query: string): boolean {
  const q = query.toLowerCase();
  
  // First check if it's clearly about WAKTI features
  for (const kw of WAKTI_FEATURE_KEYWORDS) {
    if (q.includes(kw)) return false;
  }
  
  // Then check if it matches general/off-topic patterns
  for (const kw of GENERAL_KEYWORDS) {
    if (q.includes(kw)) return true;
  }
  
  // Check for question patterns that are likely general
  if (/^(what|how|why|when|where|who|can you|could you|please|i need|i want)/i.test(q)) {
    // Only if it doesn't mention any WAKTI-related terms
    const hasWaktiTerm = /wakti|app|feature|button|icon|menu|screen|page|mode/i.test(q);
    if (!hasWaktiTerm) return true;
  }
  
  return false;
}

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
- إذا ما لقيت الجواب في الدليل، قل "ما عندي هالمعلومة، ممكن توضح سؤالك؟"
- إذا السؤال عام (مثل أسئلة عن الطقس، الرياضيات، أخبار، واجبات، أو أي شي مو عن ميزات WAKTI)، قل شي مثل: "تمام! بس تنبيه سريع: أنا مساعد WAKTI هنا عشان أساعدك تتنقل وتفهم التطبيق. لسؤالك هذا، WAKTI AI هو صاحبك. افتح القائمة واضغط شعار W (أعلى اليسار)، بعدين ادخل WAKTI AI. داخل WAKTI AI استخدم Chat mode للمساعدة السريعة، وStudy mode لو تبي شرح خطوة بخطوة مثل المدرّس. وإذا تحتاج تبحث: استخدم Search mode (ويب أو YouTube)." وأضف [CHIP:Open WAKTI AI:/wakti-ai-v2]
- استخدم العربية فقط.`;
  }
  return `You are WAKTI's friendly helper! Think of yourself as a buddy helping the user discover the app.

IMPORTANT: Only recommend features that are explicitly mentioned in the manual below. Do NOT make up features or suggest things not in the manual.

Here is information from the WAKTI manual:
${manualContext}

Your style:
- Talk naturally and warmly, like a friend explaining to a friend.
- Use plain text only. Never use **, ##, -, or bullet points.
- Explain steps clearly and simply.
- ONLY recommend the specific feature from the manual that best matches what the user needs.
- Mention icons when helpful (like: mic icon, music note icon).
- If the feature is in the header (top of screen), say "Look at the top of your screen, next to your avatar".
- If the feature is in the menu, say "Tap the W logo (top-left) to open the menu".
- If you cannot find the answer in the manual, say "I don't have that info, can you clarify your question?"
- If the question is general (like weather, math, news, homework, or anything NOT about WAKTI features), say something like: "Hey! Quick heads-up: I'm WAKTI's Help Assistant, here to help you navigate and understand the app. For your question though, WAKTI AI is your go-to buddy. Tap the W logo (top-left) to open the menu, then open WAKTI AI. Use Chat mode for quick help, Study mode for step-by-step tutor style, and Search mode (Web/YouTube) when you need to look something up." and add [CHIP:Open WAKTI AI:/wakti-ai-v2]
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

  // Fetch all manual entries and filter/score in memory (manual is small ~40 entries)
  // This ensures we search tags properly and don't miss anything
  const { data, error } = await supabase
    .from("help_manual")
    .select("id,section,title_en,title_ar,content_en,content_ar,tags,route,chip_label_en,chip_label_ar");

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
    .replace(/\[CHIP:[^\]]+\]/g, "")   // remove [CHIP:...] markers from visible text
    .trim();
}

// SAFETY FIX: We no longer trust AI-provided chips.
// Chips come ONLY from manual entries or our hardcoded safe chips.
// This prevents random wrong chips like "Change Theme" appearing.
function extractChipFromResponse(_text: string): Chip | null {
  // Disabled: AI chips are not trusted anymore
  return null;
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
    return new Response(null, { headers: corsHeadersWithMaxAge });
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
        { status: 400, headers: { ...corsHeadersWithMaxAge, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // SMART-SKIP: If it's a general question, return canned response INSTANTLY
    // ========================================================================
    if (isGeneralQuestion(message)) {
      const durationMs = Date.now() - start;
      const cannedReply = language === "ar" ? GENERAL_REDIRECT_AR : GENERAL_REDIRECT_EN;
      const cannedChip = language === "ar" ? GENERAL_CHIP_AR : GENERAL_CHIP;
      
      console.log(`[SMART-SKIP] General question detected, returning canned response in ${durationMs}ms`);
      
      await logAIFromRequest(req, {
        functionName: "help-assistant-chat",
        provider: "smart-skip",
        model: "canned-response",
        inputText: message,
        outputText: cannedReply,
        durationMs,
        status: "success",
      });
      
      return new Response(
        JSON.stringify({ reply: cannedReply, chips: [cannedChip] }),
        { headers: { ...corsHeadersWithMaxAge, "Content-Type": "application/json" } }
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

    // Try OpenAI first (primary), fallback to DeepSeek
    let reply = await callOpenAI(messages);
    let provider = "openai";
    let model = "gpt-4o-mini";

    if (!reply) {
      console.log("OpenAI failed, trying DeepSeek fallback...");
      reply = await callDeepSeek(messages);
      provider = "deepseek";
      model = "deepseek-chat";
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
        { headers: { ...corsHeadersWithMaxAge, "Content-Type": "application/json" } }
      );
    }

    // Check if AI added a chip in its response (for general questions redirect)
    const aiChip = extractChipFromResponse(reply);
    
    // Clean markdown from reply
    const cleanedReply = cleanReply(reply);
    
    // Use AI chip if provided, otherwise use manual-based chips
    const finalChips = aiChip ? [aiChip] : chips;

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
      JSON.stringify({ reply: cleanedReply, chips: finalChips }),
      { headers: { ...corsHeadersWithMaxAge, "Content-Type": "application/json" } }
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
      { status: 500, headers: { ...corsHeadersWithMaxAge, "Content-Type": "application/json" } }
    );
  }
});
