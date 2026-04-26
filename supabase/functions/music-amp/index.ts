import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ─── User ID Extraction from JWT ───
function getUserIdFromRequest(req: Request): string | null {
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token || token.split(".").length !== 3) return null;
    const payloadB64 = token.split(".")[1];
    const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    return payload.sub || null;
  } catch {
    return null;
  }
}

// ─── AI Logger (inlined) ───
interface AILogParams {
  functionName: string;
  userId?: string;
  model: string;
  inputText?: string;
  outputText?: string;
  durationMs?: number;
  status: "success" | "error";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

async function logAI(params: AILogParams): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) return;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const inputTokens = estimateTokens(params.inputText);
    const outputTokens = estimateTokens(params.outputText);
    const cost = (inputTokens / 1_000_000) * 0.14 + (outputTokens / 1_000_000) * 0.28;

    const { error } = await supabase.rpc("log_ai_usage", {
      p_user_id: params.userId || null,
      p_function_name: params.functionName,
      p_model: params.model,
      p_status: params.status,
      p_error_message: params.errorMessage || null,
      p_prompt: params.inputText ? params.inputText.substring(0, 2000) : null,
      p_response: params.outputText ? params.outputText.substring(0, 2000) : null,
      p_metadata: params.metadata || {},
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_duration_ms: params.durationMs || 0,
      p_cost_credits: cost,
    });

    if (error) console.error("[aiLogger] RPC error:", error);
    else console.log(`[aiLogger] ✅ Logged: ${params.functionName}`);
  } catch (err) {
    console.error("[aiLogger] Error:", err);
  }
}
// ─── End AI Logger ───

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function hasArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text || "");
}

const MUSIC_LYRICS_SYSTEM_PROMPT = `You are a Musical Creative Director and professional lyricist for Suno V5_5. You generate singable lyric content sized for the engine, but the app itself owns the final visible section labels.

═══════════════════════════════════════════════
A. LOCKED DURATION CONTRACT
═══════════════════════════════════════════════
You will receive a duration structure contract. Obey it exactly.

  0:30 → exactly 2 stanza blocks, 4–6 lines total. Compressed full-song feel. Block 1 sets up the verse feeling. Block 2 lands the chorus payoff.
  1:00 → exactly 3 stanza blocks, 8–12 lines total. Verse lift → chorus payoff → second verse lift.
  1:30 → exactly 4 stanza blocks, 12–16 lines total. Verse lift → chorus payoff → second verse → chorus return.
  2:00 → exactly 5 stanza blocks, 16–22 lines total. Verse lift → chorus payoff → second verse → bridge-like emotional turn → chorus return.
  2:30 → exactly 5 stanza blocks, 20–26 lines total. Same 5-block plan as 2:00, with richer lyrical development and more breathing room.
  3:20 → exactly 5 stanza blocks, 24–32 lines total. Same 5-block plan as 2:00/2:30, but fullest version.

Stanza blocks must be separated by one blank line.
Do NOT output labels like [Verse], [Chorus], [Bridge], or [Outro].
Do NOT output delivery tags like (Oud Solo), (Instrumental Solo), (Drop), or (Whispered).
Do NOT output a title.
Do NOT output commentary.

═══════════════════════════════════════════════
B. MODE LOGIC
═══════════════════════════════════════════════
  IDEA mode:   Generate fresh lyrics from the user's concept using the exact duration contract.
  EXPAND mode: The user already wrote lyrics. Preserve EVERY user-written line exactly as written and in the same order. Expand around them only as needed to satisfy the duration contract. Do NOT rewrite, paraphrase, polish, or replace their lines.

═══════════════════════════════════════════════
C. CHIP AWARENESS
═══════════════════════════════════════════════
You will receive:
1. A resolved style summary
2. Raw style tags
3. Raw rhythm tags
4. Raw instrument tags
5. Raw mood tags
6. Vocal type

Use all of them. Respect the user's selected chips. If the summary and raw chips conflict, the raw selected chips win.
Do not conceptually remove the chosen instruments.

═══════════════════════════════════════════════
D. RHYTHMIC METER MAPPING — SYLLABLES PER LINE
═══════════════════════════════════════════════
Adjust the meter based on the rhythm context:

  Pop / Rap / Club / 4-4 rhythms:         10–12 syllables per line.
  Adani / Afro-Gulf / 6-8 rhythms:        6–9 syllables per line (allow triplet phrasing).
  Samri / Khaleeji Martial / 2-4 rhythms: 5–7 syllables per line (punchy, staccato).
  Ballad / Slow / Romantic:               8–10 syllables per line (held, melodic).
  No rhythm specified:                    8–10 syllables as default.

Within a stanza block, keep the meter coherent. Avoid sudden long/short jumps.

═══════════════════════════════════════════════
E. GCC / KHALEEJI AUTHENTICITY (when style is Gulf/Arabic)
═══════════════════════════════════════════════
1. Use strict GCC / Khaleeji Arabic only — Saudi, Kuwaiti, Emirati, Qatari, Bahraini, or Omani flavor.
2. NEVER drift into Egyptian, Levantine, Iraqi, Maghrebi, or MSA unless the style explicitly calls for it.
3. Use authentic Khaleeji vocabulary when it fits naturally: وياك, يبعد, ليش, شلون, عيوني, يا روحي, يا حبيبي, ما قصرت.
4. Gulf imagery is welcome when it fits: desert, sea, majlis, falconry, pearl diving, longing, pride, devotion.
5. Sheilat / Samri / Ardah need masculine collective force. Jalsa / romantic tracks need warmth and tenderness.
6. The lyrics must FEEL GCC — not just contain Arabic words.

═══════════════════════════════════════════════
F. BILINGUAL / LANGUAGE RULES
═══════════════════════════════════════════════
1. Arabic input → Arabic output. English input → English output. Mixed input → mixed output.
2. Preserve the user's bilingual pattern. Never collapse mixed lyrics into one language.
3. Arabic parts of Khaleeji tracks must stay GCC in tone and phrasing.

═══════════════════════════════════════════════
G. HARAKAT / PHONETICS
═══════════════════════════════════════════════
Keep Arabic naturally singable, but do NOT add explicit harakat or full diacritics in IDEA or EXPAND output. GCC Enhance handles pronunciation marking later.

═══════════════════════════════════════════════
H. OUTPUT FORMAT — MANDATORY
═══════════════════════════════════════════════
- Return clean lyrics only.
- Plain lyric lines only.
- Separate stanza blocks with one blank line.
- No square-bracket section labels.
- No parenthesized delivery tags.
- No commentary, notes, or explanations.`;



const GCC_ENHANCE_SYSTEM_PROMPT = `You are a Khaleeji Jalsa Vocal Coach. Your job is to mark the lyrics so a singer knows exactly where to lean into the note and where to stop for the beat. You hate formal grammar and love the raw, soulful street sound of Kuwait, Qatar, and Saudi Arabia.

You are NOT a linguist. You are NOT a grammar teacher. You are a musician who has been singing Khaleeji music for 30 years. You think in beats and grooves, not textbooks.

You receive musical context (Style, Rhythm, Instruments, Mood) before the lyrics. USE IT — it tells you exactly where the groove lands.

You perform exactly TWO passes. Do not skip either pass.

═══════════════════════════════════════════════
PASS 1 — KHALEEJI DIALECT GUARDRAIL
═══════════════════════════════════════════════
Objective: Dialect fidelity only. This is NOT a rewriting pass.
Do NOT touch the user's poetry. Do NOT add words they didn't write.
Do NOT change imagery, meaning, or structure.

THE ONLY THING YOU DO IN PASS 1:
Swap strictly formal MSA words that would sound stiff and foreign in a Gulf jalsa.

Required swaps (ONLY if unambiguously MSA and non-Khaleeji):
  ماذا → وش          لماذا → ليش
  أريد → أبي / أبغى   لن أنسى → ما أنسى
  لا تذهب → لا تروح   ذهب / ذهبت → راح / رحت
  ليس → ما            لا أعرف → ما أدري

PASS 1 HARD RULES:
✗ Do NOT change section labels — [Verse], [Chorus], [Bridge], [Outro], etc.
✗ Do NOT add new lyric lines.
✗ Do NOT remove lyric lines.
✗ Do NOT change English words or lines.
✗ Do NOT touch punctuation or ellipses.
✗ Do NOT rewrite lines that are already Khaleeji.
✓ If a word is already Gulf dialect → leave it exactly as written.
✓ Output line count must match input exactly.
✓ When in doubt → leave it unchanged.

═══════════════════════════════════════════════
PASS 2 — GROOVE-LOCKED STRESS MAP
═══════════════════════════════════════════════
Objective: Place musical stress markers so Suno V5_5 sings it like a Khaleeji street musician — not a news anchor.

Suno reads diacritics as MUSICAL CUES, not grammar. You are not writing a Quran lesson. You are marking a groove chart.

Duration context matters.
- Short targets (0:30 / 1:00): keep marking lighter and punchier.
- Mid targets (1:30 / 2:00): moderate density, still restrained.
- Long targets (2:30 / 3:20): you may use slightly richer placement, but never exceed the hard line-level limits below.

USE THE MUSICAL CONTEXT — THIS IS MANDATORY:
Look at the Style and Rhythm fields. They tell you where the downbeat falls.
  Samri (2/4) → stress on beat 1 of each bar — short punchy lines, mark the opening syllable.
  Adani (6/8) → triplet feel — mark the first and fourth syllable of each line.
  Khaleeji Pop / Ballad → stress on the held note — mark the long open vowel at end of line.
  Shaabi / Festive → mark the hardest consonant cluster in each line.

═══════════════════════════════════════════════
THE THREE TOOLS — GROOVE RULES
═══════════════════════════════════════════════

TOOL 1 — SHADDA ( ّ ) — THE DOWNBEAT HAMMER
Shadda = the singer leans into this note HARD. It is the loudest hit of the word.
Place it ONLY on the DOWNBEAT consonant — the heaviest, loudest syllable.
✓ CORRECT: حبّك — the "b" is the downbeat, shadda makes Suno punch it
✓ CORRECT: نَهَلّي — shadda on the "l" before the final vowel, groove locked
✓ CORRECT: يُولّي — shadda on the "l", Suno holds and releases with Khaleeji soul
✗ BANNED: Shadda on the FINAL letter of a word (unless it is a verb like ردّ, مدّ).
  — Reason: final-letter shadda triggers Quranic recitation mode. Kills the groove.
✗ BANNED: More than 1 shadda per line.
✗ BANNED: Shadda on short particles (يا، ما، في، من، لي، لك).

TOOL 2 — FATHA ( َ ) — THE MAWWAL OPENER
Fatha = the singer opens this vowel and does a vocal run (mawwal). It signals "hold and flow here."
Place it ONLY on the last open vowel at the end of a line, to tell Suno to linger and melt.
✓ CORRECT: سلاَ — fatha tells Suno to open the "aa" and hold it
✓ CORRECT: غيابَك — fatha before the rhythmic stop opens the line
✓ CORRECT: روحَي — fatha signals a melismatic tail on this vowel
Limit: Maximum 1–2 fatha per line. One is usually enough.

TOOL 3 — SUKŪN ( ْ ) — THE BEAT CUT
Sukūn = a hard rhythmic STOP. The singer clips the note dead. Like a drum hit.
✓ ALLOWED ONLY: On the ABSOLUTE FINAL LETTER of a complete line.
  Example: العليلْ — line ends here, hard stop, beat cut
✗ BANNED everywhere else. Mid-word sukun = Moroccan Darija. Kills the Khaleeji feel instantly.
✗ BANNED on short words (منك، قلبي، عليك، ليش).
SUKŪN LIMIT: Maximum 1 sukūn per every 3 lines. If you used one recently → skip it.

═══════════════════════════════════════════════
ANTI-ACADEMIC HARD BANS — READ THESE TWICE
═══════════════════════════════════════════════
✗ ABSOLUTE BAN: Never use Tanween (ً ٍ ٌ) — ever. Not once. It is the sound of a news anchor, not a singer. It destroys the colloquial feel immediately.
✗ ABSOLUTE BAN: Never place Shadda on the final letter of a word (except verbs like ردّ).
✗ ABSOLUTE BAN: Never fully vowelize a word (more than 2 harakat on one word = Quranic mode).
✗ ABSOLUTE BAN: More than 2 markers (any combination) per line. If a line has 2 → leave the rest bare.
✗ ABSOLUTE BAN: Do NOT anchor the same word twice (e.g., shadda + fatha on same word).
✗ Do NOT rewrite, add, or remove any word.
✗ Do NOT touch English words or lines.
✗ Do NOT change line breaks or section labels.
✗ Do NOT change punctuation or ellipses.

WORDS THAT NEVER GET ANY MARKER — LEAVE COMPLETELY BARE:
يا، ما، في، من، على، مع، لي، لك، بك، فيك، منك، عليك، ليه، وين، كيف، هذا، هذي، وش، شو، ليش، راح، هو، هي، انت

═══════════════════════════════════════════════
DENSITY — THE GROOVE RULE
═══════════════════════════════════════════════
Target: 1–2 markers per line maximum. No more.
Not every line needs a marker — silence is also groove.
Priority order: Shadda (downbeat) → Fatha (mawwal) → Sukūn (beat cut, line end only).
A line with zero markers is acceptable. A line with 3+ markers is always wrong.

═══════════════════════════════════════════════
FERRARI GOLD — WORKED EXAMPLE
═══════════════════════════════════════════════
Musical context: Style = GCC Jalsa / Khaleeji Pop, Rhythm = Khaleeji Shuffle

INPUT:
يا سالم اليوم ما نهلى
بعدك ولّى العمر كله

CORRECT OUTPUT (groove-locked, anti-academic):
يا سالم اليوم ما نَهَلّي
بعدك يُولّي العمر كلهْ

نَهَلّي → fatha opens the first syllable, shadda on "l" = downbeat hammer — groove locked
يُولّي  → damma anchors the opening, shadda on "l" = khaleeji soul marker
كلهْ   → sukun on final letter = hard beat cut, line ends clean

WRONG — THE PROFESSOR'S VERSION (BANNED):
يَا سَالِمٌ اليَوْمُ مَا نَهَلَى
بَعْدَكَ وَلَّى العُمْرُ كُلُّهُ
→ This is full vowelization + tanween. This is a news broadcast, not a song.
→ Suno will sing this like a Quran recitation. Never do this.

═══════════════════════════════════════════════
STRUCTURE IS SACRED — NEVER TOUCH
═══════════════════════════════════════════════
Every line from the input must appear in the output.
Keep all section labels: [Verse], [Chorus], [Bridge], [Outro], etc.
Keep all punctuation, dots, ellipses … exactly as written.
Keep all English words and lines exactly as written.
The output must have the EXACT same number of lines as the input.

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════
Return the final lyrics only — after both passes are complete.
No explanation. No comments. No "Pass 1:" labels. No "I changed X because Y."
Clean lyrics only. Ready to paste directly into Suno V5_5.`;

interface LyricsBlueprint {
  text: string;
  ampMode: string;
  durationSeconds: number;
  style: string;
  styleTags: string[];
  rhythm: string;
  rhythmTags: string[];
  instruments: string;
  instrumentTags: string[];
  mood: string;
  moodTags: string[];
  vocalType: string;
  title: string;
}

function normalizeAmpDuration(secs: number): number {
  if (secs <= 30) return 30;
  if (secs <= 60) return 60;
  if (secs <= 90) return 90;
  if (secs <= 120) return 120;
  if (secs <= 150) return 150;
  return 200;
}

function buildDurationLabel(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s === 0 ? `${m}:00` : `${m}:${String(s).padStart(2, "0")}`;
}

function buildFerrariClock(secs: number): string {
  if (secs <= 30)  return "STRUCTURE CONTRACT: 0:30 → exactly 2 stanza blocks, 4–6 lines total. Compressed full-song feel. Block 1 = verse lift. Block 2 = chorus payoff.";
  if (secs <= 60)  return "STRUCTURE CONTRACT: 1:00 → exactly 3 stanza blocks, 8–12 lines total. Block flow: verse lift → chorus payoff → second verse lift.";
  if (secs <= 90)  return "STRUCTURE CONTRACT: 1:30 → exactly 4 stanza blocks, 12–16 lines total. Block flow: verse lift → chorus payoff → second verse → chorus return.";
  if (secs <= 120) return "STRUCTURE CONTRACT: 2:00 → exactly 5 stanza blocks, 16–22 lines total. Block flow: verse lift → chorus payoff → second verse → bridge-like emotional turn → chorus return.";
  if (secs <= 150) return "STRUCTURE CONTRACT: 2:30 → exactly 5 stanza blocks, 20–26 lines total. Same 5-block flow as 2:00, with richer lyrical development and more breathing room.";
  return "STRUCTURE CONTRACT: 3:20 → exactly 5 stanza blocks, 24–32 lines total. Same 5-block flow as 2:00/2:30, but fullest version.";
}

function buildMeterMapping(rhythm: string): string {
  const r = (rhythm || "").toLowerCase();
  if (r.includes("adani") || r.includes("afro") || r.includes("6/8") || r.includes("6-8"))
    return "METER: 6–9 syllables per line (Adani/Afro-Gulf 6/8 — allow triplet phrasing).";
  if (r.includes("samri") || r.includes("martial") || r.includes("2/4") || r.includes("2-4") || r.includes("ardah"))
    return "METER: 5–7 syllables per line (Samri/Martial 2/4 — punchy, staccato).";
  if (r.includes("ballad") || r.includes("slow") || r.includes("romantic"))
    return "METER: 8–10 syllables per line (ballad/slow — held, melodic).";
  if (r.includes("pop") || r.includes("rap") || r.includes("club") || r.includes("4/4") || r.includes("4-4"))
    return "METER: 10–12 syllables per line (Pop/Rap/Club 4/4).";
  return "METER: 8–10 syllables per line (default).";
}

function buildTagLine(label: string, values: string[]): string | null {
  return values.length > 0 ? `${label}: ${values.join(", ")}` : null;
}

async function ampMusicLyricsWithOpenAI(
  blueprint: LyricsBlueprint
): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("CONFIG: Missing OPENAI_API_KEY");

  const { text, ampMode, durationSeconds, style, styleTags, rhythm, rhythmTags, instruments, instrumentTags, mood, moodTags, vocalType, title } = blueprint;
  const normalizedDuration = normalizeAmpDuration(durationSeconds);

  const modeInstruction = ampMode === "idea"
    ? "MODE: IDEA — Generate completely fresh lyrics from scratch using this blueprint. The user gave you a concept, not existing lyrics."
    : "MODE: EXPAND — The user provided existing lyrics below. Preserve their EXACT words. Expand AROUND them — add new sections to fill the duration target. Do NOT rewrite their lines.";

  const blueprintBlock = [
    title      ? `Title: ${title}`       : null,
    style      ? `Style: ${style}`       : null,
    buildTagLine("Style tags", styleTags),
    rhythm     ? `Rhythm: ${rhythm}`     : null,
    buildTagLine("Rhythm tags", rhythmTags),
    instruments ? `Instruments: ${instruments}` : null,
    buildTagLine("Instrument tags", instrumentTags),
    mood       ? `Mood: ${mood}`         : null,
    buildTagLine("Mood tags", moodTags),
    vocalType  ? `Vocal type: ${vocalType}` : null,
    `Duration: ${buildDurationLabel(normalizedDuration)} (${normalizedDuration}s requested bucket from ${durationSeconds}s)`,
  ].filter(Boolean).join("\n");

  const userMessage = [
    "═══ TRACK BLUEPRINT ═══",
    blueprintBlock,
    "",
    buildFerrariClock(normalizedDuration),
    buildMeterMapping([rhythm, ...rhythmTags].filter(Boolean).join(", ")),
    modeInstruction,
    "",
    "═══ USER INPUT ═══",
    text,
  ].join("\n");

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: durationSeconds >= 90 ? 2000 : 1200,
    messages: [
      { role: "system", content: MUSIC_LYRICS_SYSTEM_PROMPT },
      { role: "user",   content: userMessage },
    ],
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(
      JSON.stringify({
        stage: "openai-music-lyrics",
        status: resp.status,
        body: data || null,
      }),
    );
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("openai_empty_response");
  }

  return content.trim();
}

async function ampGccEnhanceWithAnthropic(input: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("CONFIG: Missing ANTHROPIC_API_KEY");

  const payload = {
    model: "claude-haiku-4-5-20251001",
    temperature: 0.5,
    max_tokens: 2000,
    system: GCC_ENHANCE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: input,
      },
    ],
  };

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(
      JSON.stringify({
        stage: "anthropic-gcc-enhance",
        status: resp.status,
        body: data || null,
      }),
    );
  }

  const content = Array.isArray(data?.content)
    ? data.content
      .filter((part: { type?: string; text?: string }) => part?.type === "text" && typeof part?.text === "string")
      .map((part: { text: string }) => part.text)
      .join("\n")
    : "";

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("anthropic_empty_response");
  }

  return content.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  let inputText = "";
  let mode: string | undefined;

  // Extract user ID from JWT token
  const userId = getUserIdFromRequest(req) || undefined;

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method Not Allowed" }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Allow": "POST, OPTIONS",
          },
        },
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const text = (body?.text ?? "").toString();
    mode = typeof body?.mode === "string" ? (body.mode as string) : undefined;
    inputText = text;

    // ── Extract full UI blueprint fields ──
    const ampMode     = typeof body?.ampMode     === "string" ? body.ampMode     : "expand";
    const style       = typeof body?.style       === "string" ? body.style       : "";
    const styleTags   = Array.isArray(body?.styleTags) ? body.styleTags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0) : [];
    const rhythm      = typeof body?.rhythm      === "string" ? body.rhythm      : "";
    const rhythmTags  = Array.isArray(body?.rhythmTags) ? body.rhythmTags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0) : [];
    const instruments = typeof body?.instruments === "string" ? body.instruments : "";
    const instrumentTags = Array.isArray(body?.instrumentTags) ? body.instrumentTags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0) : [];
    const mood        = typeof body?.mood        === "string" ? body.mood        : "";
    const moodTags    = Array.isArray(body?.moodTags) ? body.moodTags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0) : [];
    const vocalType   = typeof body?.vocalType   === "string" ? body.vocalType   : "auto";
    const titleField  = typeof body?.title       === "string" ? body.title       : "";
    const durationSeconds = typeof body?.duration === "number" ? body.duration : 30;
    const normalizedDuration = normalizeAmpDuration(durationSeconds);

    if (mode === "music" || mode === "lyrics") {
      if (!text || text.trim().length === 0) {
        return new Response(
          JSON.stringify({
            error: "Missing 'text' for lyrics expansion",
            code: "BAD_REQUEST_MISSING_TEXT",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const improved = await ampMusicLyricsWithOpenAI({
        text,
        ampMode,
        durationSeconds: normalizedDuration,
        style,
        styleTags,
        rhythm,
        rhythmTags,
        instruments,
        instrumentTags,
        mood,
        moodTags,
        vocalType,
        title: titleField,
      });

      await logAI({
        functionName: "prompt-amp",
        userId,
        model: "gpt-4o-mini",
        inputText: text,
        outputText: improved,
        durationMs: Date.now() - startTime,
        status: "success",
        metadata: {
          provider: "openai",
          mode: "music-lyrics",
          duration: normalizedDuration,
          ampMode,
          style,
          styleTags,
          rhythm,
          rhythmTags,
          instruments,
          instrumentTags,
          mood,
          moodTags,
          vocalType,
          language: hasArabic(text) ? "ar" : "en",
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          text: improved,
          language: hasArabic(text) ? "ar" : "en",
          mode: "music-lyrics",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (mode === "gcc-enhance") {
      if (!text || text.trim().length === 0) {
        return new Response(
          JSON.stringify({
            error: "Missing 'text' for GCC Enhance",
            code: "BAD_REQUEST_MISSING_TEXT",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Build context block so Claude knows the rhythm/style for Groove-Locked stress
      const gccContextParts: string[] = [];
      if (style)       gccContextParts.push(`Style: ${style}`);
      if (styleTags.length > 0) gccContextParts.push(`Style tags: ${styleTags.join(", ")}`);
      if (rhythm)      gccContextParts.push(`Rhythm: ${rhythm}`);
      if (rhythmTags.length > 0) gccContextParts.push(`Rhythm tags: ${rhythmTags.join(", ")}`);
      if (instruments) gccContextParts.push(`Instruments: ${instruments}`);
      if (instrumentTags.length > 0) gccContextParts.push(`Instrument tags: ${instrumentTags.join(", ")}`);
      if (mood)        gccContextParts.push(`Mood: ${mood}`);
      if (moodTags.length > 0) gccContextParts.push(`Mood tags: ${moodTags.join(", ")}`);
      if (vocalType)   gccContextParts.push(`Vocal type: ${vocalType}`);
      gccContextParts.push(`Duration target: ${buildDurationLabel(normalizedDuration)} (${normalizedDuration}s)`);
      gccContextParts.push(buildFerrariClock(normalizedDuration));
      const gccContext = gccContextParts.length > 0
        ? gccContextParts.join("\n") + "\n\n"
        : "";
      const gccInput = gccContext + text;

      const improved = await ampGccEnhanceWithAnthropic(gccInput);

      await logAI({
        functionName: "prompt-amp",
        userId,
        model: "claude-haiku-4-5-20251001",
        inputText: text,
        outputText: improved,
        durationMs: Date.now() - startTime,
        status: "success",
        metadata: {
          provider: "anthropic",
          mode: "gcc-enhance",
          duration: normalizedDuration,
          style,
          styleTags,
          rhythm,
          rhythmTags,
          instruments,
          instrumentTags,
          mood,
          moodTags,
          vocalType,
          language: hasArabic(text) ? "ar" : "en",
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          text: improved,
          language: hasArabic(text) ? "ar" : "en",
          mode: "gcc-enhance",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        error: "Invalid mode",
        code: "BAD_REQUEST",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const errorModel = mode === "gcc-enhance" ? "claude-haiku-4-5-20251001" : "gpt-4o-mini";
    const errorProvider = mode === "gcc-enhance" ? "anthropic" : "openai";

    await logAI({
      functionName: "prompt-amp",
      userId,
      model: errorModel,
      inputText,
      durationMs: Date.now() - startTime,
      status: "error",
      errorMessage: message,
      metadata: { provider: errorProvider, mode: mode || "unknown" },
    });

    return new Response(
      JSON.stringify({
        error: message,
        code: "UNHANDLED",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
