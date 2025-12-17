import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "./_shared/cors.ts";
import { logAIFromRequest } from "./_shared/aiLogger.ts";

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

 type ScoredEntry = { entry: ManualEntry; score: number; reasons: string[] };

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

function buildSystemPrompt(language: "en" | "ar", manualContext: string): string {
  if (language === "ar") {
    return `أنت مساعد WAKTI للمساعدة داخل التطبيق. مهمتك بسيطة:
1) تفهم سؤال المستخدم حتى لو كان كلامه غير مرتب.
2) تجاوب فقط باستخدام دليل WAKTI الموجود بالأسفل (هو مصدر الحقيقة).
3) تعطي خطوات واضحة "وين يضغط" باستخدام أماكن وأيقونات حقيقية.

دليل WAKTI (مصدر الحقيقة):
${manualContext}

قواعد صارمة (غير قابلة للنقاش):
- ممنوع تخترع خطوات أو أزرار أو أيقونات أو أماكن. إذا الشيء مو موجود في الدليل، لا تقوله.
- إذا الدليل ما فيه الجواب، قل: "ما عندي هالمعلومة حالياً—قل لي أنت بأي شاشة أو وش تحاول تسوي؟"
- ركّز على أفضل ميزة/صفحة واحدة فقط. لا تخلط ميزات غير مرتبطة.
- خلي الرد عملي وقصير: الميزة وش هي + وين تلقاها + كيف تستخدمها.

طريقة شرح التنقل (استخدم نفس الجمل):
- إذا الميزة في القائمة: "اضغط شعار W (أعلى اليسار) لفتح القائمة، ثم اضغط <اسم الميزة>."
- إذا الميزة في الهيدر: "شوف أعلى الشاشة جنب صورتك."
- إذا الميزة في تبويبات: "في الأعلى بتشوف تبويبات. اضغط <اسم التبويب>."
- إذا فيه حبة/شيب بجانب خانة الكتابة: "بجانب خانة الكتابة بتشوف حبة. اضغطها واختر <الخيار>."

الأيقونات (اذكرها إذا لها علاقة بالسؤال):
- شعار W (أعلى اليسار) يفتح القائمة.
- أيقونة المايك = ميزات الصوت / استوديو الصوت.
- أيقونة اللمعة = WAKTI AI.

واجهة WAKTI AI (لازم تعرفها بالضبط):
- داخل WAKTI AI يوجد محدد رئيسي: Chat / Search / Image.
- في وضع Search يوجد حبة بجانب خانة الكتابة للتبديل بين: Web / YouTube.
- في وضع Image يوجد حبة بجانب خانة الكتابة للتبديل بين:
  Text to Image / Image to Image / Background Removal / Draw.

إذا المستخدم يسأل عن الأوضاع:
- للمحادثة/الواجب/الشرح: WAKTI AI والمحدد الرئيسي = Chat.
- لنتائج الإنترنت أو يوتيوب: WAKTI AI والمحدد الرئيسي = Search ثم الحبة = Web أو YouTube.
- للصور: WAKTI AI والمحدد الرئيسي = Image ثم الحبة = Text to Image / Image to Image / Background Removal / Draw.

الأسلوب:
- كلام ودي مثل صديق.
- نص عادي فقط (بدون تنسيق).
- اذكر الأيقونات بين قوسين مثل: (شعار W)، (أيقونة المايك).
- اكتب بالعربية فقط.
`;
  }
  return `You are WAKTI’s Help Assistant. Your job is simple:
1) Understand what the user means (even if they speak casually).
2) Answer ONLY using the WAKTI manual context provided below (it is the source of truth).
3) Give clear “where to tap” directions using real UI locations and real icons.

MANUAL CONTEXT (source of truth):
${manualContext}

NON‑NEGOTIABLE RULES:
- Do not invent UI steps, icons, buttons, tabs, or locations. If it’s not in the manual context, do NOT say it.
- If the manual context does not contain the answer, reply: "I don’t have that info yet—can you tell me what screen you’re on or what you’re trying to do?"
- Prefer ONE best feature/page only. Do not mention multiple unrelated features.
- Keep replies short and practical: what it is + where it is + how to use it.

HOW TO GIVE NAVIGATION DIRECTIONS (use these exact patterns):
- If something is in the side menu: say "Tap the W logo (top-left) to open the menu, then tap <Feature Name>."
- If something is in the header: say "Look at the top of your screen next to your avatar."
- If something is in tabs: say "At the top you’ll see tabs. Tap <Tab Name>."
- If something uses a pill next to the input: say "Next to the input you’ll see a pill. Tap it and choose <Option>."

ICONS (mention them when helpful, but only if relevant):
- W logo (top-left) opens the menu.
- Mic icon = Voice / Voice Studio.
- Sparkles icon = WAKTI AI.

WAKTI AI UI (you MUST know this exactly and guide correctly):
- WAKTI AI has a MAIN mode selector: Chat / Search / Image.
- Search mode also has a small pill next to the input to switch: Web / YouTube.
- Image mode also has a pill next to the input to switch:
  Text to Image / Image to Image / Background Removal / Draw.

WHEN USER ASKS ABOUT MODES:
- If user wants conversation, homework help, explanations: tell them to use WAKTI AI, main selector = Chat.
- If user wants online results or YouTube tutorials: tell them to use WAKTI AI, main selector = Search, then pill = Web or YouTube.
- If user wants images: tell them to use WAKTI AI, main selector = Image, then pill = Text to Image / Image to Image / Background Removal / Draw.

STYLE:
- Friendly “buddy” tone.
- Plain text only. No markdown, no headings.
- Mention icon names in parentheses like: (W logo), (mic icon).
- Respond in English only.
`;
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s→-]/gu, "")
    .trim();
}

function buildKeywords(query: string): string[] {
  const q = normalizeText(query);
  return q.split(" ").filter((w) => w.length > 2).slice(0, 8);
}

function scoreEntryForQuery(entry: ManualEntry, query: string, language: "en" | "ar"): ScoredEntry {
  const qRaw = query.toLowerCase().trim();
  const q = normalizeText(query);
  const keywords = buildKeywords(query);

  const titleField = normalizeText(language === "ar" ? entry.title_ar : entry.title_en);
  const contentField = normalizeText(language === "ar" ? entry.content_ar : entry.content_en);
  const tagsLower = (entry.tags ?? []).map((t) => normalizeText(t));
  const allText = `${titleField} ${contentField} ${tagsLower.join(" ")}`.trim();

  let score = 0;
  const reasons: string[] = [];

  // Strong exact phrase checks (helps short queries like "Text Translator")
  if (q && titleField.includes(q)) {
    score += 30;
    reasons.push("title_phrase");
  }
  if (q && tagsLower.some((t) => t === q || t.includes(q) || q.includes(t))) {
    score += 25;
    reasons.push("tag_phrase");
  }

  // Keyword scoring
  for (const kw of keywords) {
    if (titleField.includes(kw)) {
      score += 8;
      reasons.push(`title_kw:${kw}`);
    }
    if (tagsLower.some((t) => t.includes(kw))) {
      score += 6;
      reasons.push(`tag_kw:${kw}`);
    }
    if (allText.includes(kw)) {
      score += 2;
    }
  }

  // Specificity bias: prefer deep links when user asks for a specific tab/feature
  const wantsTranslator = qRaw.includes("translator") || qRaw.includes("ترجم") || qRaw.includes("مترجم");
  const wantsTts = qRaw.includes("text to speech") || qRaw.includes("tts") || qRaw.includes("نص") && qRaw.includes("كلام") || qRaw.includes("نص → كلام");
  const wantsClone = qRaw.includes("clone") || qRaw.includes("voice clone") || qRaw.includes("استنسا") || qRaw.includes("نسخ صوت");
  if ((wantsTranslator || wantsTts || wantsClone) && entry.route && entry.route.includes("?tab=")) {
    score += 7;
    reasons.push("deeplink_tab");
  }

  // Intent bias: boost the correct feature based on query intent
  // Events/Invites → Maw3d
  const wantsEvent = qRaw.includes("invite") || qRaw.includes("event") || qRaw.includes("dinner") || qRaw.includes("party") || qRaw.includes("gathering") || qRaw.includes("rsvp") || qRaw.includes("دعوة") || qRaw.includes("حفل") || qRaw.includes("مناسبة") || qRaw.includes("عشاء") || qRaw.includes("عزيمة");
  if (wantsEvent && entry.route === "/maw3d") {
    score += 20;
    reasons.push("event_intent_maw3d");
  }

  // Tasks/Reminders/Todo → Tasks & Reminders
  const wantsTasks = qRaw.includes("task") || qRaw.includes("todo") || qRaw.includes("reminder") || qRaw.includes("مهمة") || qRaw.includes("تذكير") || qRaw.includes("مهام");
  if (wantsTasks && entry.route === "/tasks-reminders") {
    score += 20;
    reasons.push("task_intent");
  }

  // Calendar/Schedule → Calendar
  const wantsCalendar = qRaw.includes("calendar") || qRaw.includes("schedule") || qRaw.includes("تقويم") || qRaw.includes("جدول");
  if (wantsCalendar && entry.route === "/calendar") {
    score += 20;
    reasons.push("calendar_intent");
  }

  // Journal/Diary/Notes → Journal
  const wantsJournal = qRaw.includes("journal") || qRaw.includes("diary") || qRaw.includes("note") || qRaw.includes("يوميات") || qRaw.includes("مذكرة");
  if (wantsJournal && entry.route === "/journal") {
    score += 20;
    reasons.push("journal_intent");
  }

  // Music/Song/Generate music → Music Studio
  const wantsMusic = qRaw.includes("music") || qRaw.includes("song") || qRaw.includes("موسيقى") || qRaw.includes("أغنية");
  if (wantsMusic && entry.route === "/music") {
    score += 20;
    reasons.push("music_intent");
  }

  // Games → Games
  const wantsGames = qRaw.includes("game") || qRaw.includes("play") || qRaw.includes("ألعاب") || qRaw.includes("لعبة");
  if (wantsGames && entry.route === "/games") {
    score += 20;
    reasons.push("games_intent");
  }

  // Contacts/Message/Chat with friends → Contacts
  const wantsContacts = (qRaw.includes("contact") || qRaw.includes("message") || qRaw.includes("chat") || qRaw.includes("جهات") || qRaw.includes("رسالة")) && !wantsEvent;
  if (wantsContacts && entry.route === "/contacts") {
    score += 20;
    reasons.push("contacts_intent");
  }

  // Settings/Account/Theme → Settings
  const wantsSettings = qRaw.includes("setting") || qRaw.includes("account") || qRaw.includes("theme") || qRaw.includes("dark mode") || qRaw.includes("light mode") || qRaw.includes("إعدادات") || qRaw.includes("حساب") || qRaw.includes("مظهر");
  if (wantsSettings && entry.route === "/settings") {
    score += 20;
    reasons.push("settings_intent");
  }

  // Dashboard/Home/Widgets → Dashboard
  const wantsDashboard = qRaw.includes("dashboard") || qRaw.includes("home") || qRaw.includes("widget") || qRaw.includes("لوحة") || qRaw.includes("الرئيسية");
  if (wantsDashboard && entry.route === "/dashboard") {
    score += 20;
    reasons.push("dashboard_intent");
  }

  // Tasjeel/Record/Audio/Meeting/Lecture → Tasjeel
  const wantsTasjeel = qRaw.includes("tasjeel") || qRaw.includes("record") || qRaw.includes("meeting") || qRaw.includes("lecture") || qRaw.includes("transcri") || qRaw.includes("summar") || qRaw.includes("تسجيل") || qRaw.includes("اجتماع") || qRaw.includes("محاضرة");
  if (wantsTasjeel && entry.route === "/tasjeel") {
    score += 20;
    reasons.push("tasjeel_intent");
  }

  // Vitality/Health/WHOOP/Fitness → Fitness page
  const wantsVitality = qRaw.includes("vitality") || qRaw.includes("health") || qRaw.includes("whoop") || qRaw.includes("fitness") || qRaw.includes("workout") || qRaw.includes("صحة") || qRaw.includes("لياقة") || qRaw.includes("تمرين");
  if (wantsVitality && entry.route === "/fitness") {
    score += 20;
    reasons.push("vitality_intent");
  }

  // Account/Profile → Account page
  const wantsAccount = qRaw.includes("account") || qRaw.includes("profile") || qRaw.includes("avatar") || qRaw.includes("my name") || qRaw.includes("حساب") || qRaw.includes("ملف") || qRaw.includes("صورتي");
  if (wantsAccount && entry.route === "/account") {
    score += 20;
    reasons.push("account_intent");
  }

  // Create event → Maw3d Create
  const wantsCreateEvent = qRaw.includes("create") && (qRaw.includes("event") || qRaw.includes("invite") || qRaw.includes("party"));
  if (wantsCreateEvent && entry.route === "/maw3d/create") {
    score += 25;
    reasons.push("create_event_intent");
  }

  // Help/Support → Help page
  const wantsHelp = qRaw.includes("help") || qRaw.includes("support") || qRaw.includes("مساعدة") || qRaw.includes("دعم");
  if (wantsHelp && entry.route === "/help") {
    score += 15;
    reasons.push("help_intent");
  }

  // Contact → Contact page
  const wantsContact = qRaw.includes("contact us") || qRaw.includes("feedback") || qRaw.includes("تواصل");
  if (wantsContact && entry.route === "/contact") {
    score += 20;
    reasons.push("contact_intent");
  }

  // Background removal specific
  const wantsBackgroundRemoval = qRaw.includes("background") || qRaw.includes("remove background") || qRaw.includes("خلفية") || qRaw.includes("إزالة");
  if (wantsBackgroundRemoval && titleField.includes("background")) {
    score += 25;
    reasons.push("background_removal_intent");
  }

  // Study mode specific
  const wantsStudy = qRaw.includes("study") || qRaw.includes("homework") || qRaw.includes("learn") || qRaw.includes("school") || qRaw.includes("دراسة") || qRaw.includes("واجب") || qRaw.includes("مدرسة");
  if (wantsStudy && titleField.includes("study")) {
    score += 25;
    reasons.push("study_intent");
  }

  // YouTube specific
  const wantsYoutube = qRaw.includes("youtube") || qRaw.includes("video") || qRaw.includes("يوتيوب") || qRaw.includes("فيديو");
  if (wantsYoutube && titleField.includes("youtube")) {
    score += 25;
    reasons.push("youtube_intent");
  }

  // Letters game specific
  const wantsLetters = qRaw.includes("letters") || qRaw.includes("word game") || qRaw.includes("حروف");
  if (wantsLetters && titleField.includes("letters")) {
    score += 25;
    reasons.push("letters_intent");
  }

  // Image/Generate image/Picture → WAKTI AI Image Mode
  const wantsImage = qRaw.includes("image") || qRaw.includes("picture") || qRaw.includes("photo") || qRaw.includes("generate image") || qRaw.includes("صورة");
  if (wantsImage && entry.route === "/wakti-ai-v2" && titleField.includes("image")) {
    score += 20;
    reasons.push("image_intent");
  }

  // Search/Web/YouTube → WAKTI AI Search Mode
  const wantsSearch = qRaw.includes("search") || qRaw.includes("web") || qRaw.includes("youtube") || qRaw.includes("بحث") || qRaw.includes("يوتيوب");
  if (wantsSearch && entry.route === "/wakti-ai-v2" && titleField.includes("search")) {
    score += 20;
    reasons.push("search_intent");
  }

  // Presentation/Slides → Smart Text Presentations
  const wantsPresentation = qRaw.includes("presentation") || qRaw.includes("slide") || qRaw.includes("عرض تقديمي") || qRaw.includes("شرائح");
  if (wantsPresentation && titleField.includes("presentation")) {
    score += 20;
    reasons.push("presentation_intent");
  }

  // Diagram/Flowchart → Smart Text Diagrams
  const wantsDiagram = qRaw.includes("diagram") || qRaw.includes("flowchart") || qRaw.includes("chart") || qRaw.includes("مخطط") || qRaw.includes("رسم بياني");
  if (wantsDiagram && titleField.includes("diagram")) {
    score += 20;
    reasons.push("diagram_intent");
  }

  // Prefer entries that can provide a chip (helps avoid generic overview chips)
  if (entry.route && ((language === "ar" ? entry.chip_label_ar : entry.chip_label_en) ?? "").trim()) {
    score += 3;
    reasons.push("has_chip");
  }

  return { entry, score, reasons };
}

function rerankEntriesForQuery(entries: ManualEntry[], query: string, language: "en" | "ar"): ManualEntry[] {
  const scored = entries
    .map((entry) => scoreEntryForQuery(entry, query, language))
    .filter((s) => s.score > 0);

  // Deterministic sort: score desc, then title asc, then route asc
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const at = (language === "ar" ? a.entry.title_ar : a.entry.title_en) ?? "";
    const bt = (language === "ar" ? b.entry.title_ar : b.entry.title_en) ?? "";
    if (at !== bt) return at.localeCompare(bt);
    const ar = a.entry.route ?? "";
    const br = b.entry.route ?? "";
    return ar.localeCompare(br);
  });

  return scored.map((s) => s.entry);
}

async function searchManual(query: string, language: "en" | "ar"): Promise<ManualEntry[]> {
  const queryLower = query.toLowerCase();
  const cacheKey = `${language}:${queryLower}`;
  const cached = queryCache.get(cacheKey);
  const now = Date.now();
  if (cached && (now - cached.ts) < QUERY_CACHE_TTL) {
    return cached.entries;
  }

  const keywords = buildKeywords(query);

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
  
  // Initial fast filter (keeps memory search cheap for large manuals)
  const prelim = entries.filter((entry) => {
    const titleField = (language === "ar" ? entry.title_ar : entry.title_en).toLowerCase();
    const contentField = (language === "ar" ? entry.content_ar : entry.content_en).toLowerCase();
    const tagsLower = (entry.tags ?? []).map((t) => t.toLowerCase());
    const allText = `${titleField} ${contentField} ${tagsLower.join(" ")}`;
    if (!keywords.length) return true;
    return keywords.some((kw) => allText.includes(kw));
  });

  // Deterministic rerank (fixes short queries like "Text Translator" picking generic overview)
  const reranked = rerankEntriesForQuery(prelim, query, language);

  // Return top 5 (more context helps the model answer without drifting)
  const top = reranked.slice(0, 5);
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

function extractChips(entries: ManualEntry[], query: string, language: "en" | "ar"): Chip[] {
  // Choose the best chip candidate for the user query (not blindly the first result).
  // This fixes cases where "Text Translator" returns the Voice Studio overview chip.
  const reranked = rerankEntriesForQuery(entries, query, language);
  for (const e of reranked) {
    if (!e.route) continue;
    const label = (language === "ar" ? e.chip_label_ar : e.chip_label_en) ?? "";
    if (label.trim()) {
      return [{ label: label.trim(), route: e.route }];
    }
  }
  return [];
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
function _extractChipFromResponse(_text: string): Chip | null {
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

    // Search manual for relevant entries
    const manualEntries = await searchManual(message, language);
    const manualContext = buildManualContext(manualEntries, language);
    const chips = extractChips(manualEntries, message, language);

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

    // Try DeepSeek first (primary), fallback to OpenAI
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
        { headers: { ...corsHeadersWithMaxAge, "Content-Type": "application/json" } }
      );
    }

    // Clean markdown from reply
    const cleanedReply = cleanReply(reply);

    // Chips come ONLY from manual entries (safety)
    const finalChips = chips;

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
