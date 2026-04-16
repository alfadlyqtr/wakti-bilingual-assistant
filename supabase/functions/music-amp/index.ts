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

const MUSIC_LYRICS_SYSTEM_PROMPT = `You are a Musical Creative Director and professional lyricist for Suno V5_5. You receive a structured track blueprint and generate Grade-A+ singable lyrics — perfectly sized for the engine, never rushing, never over-filling.

═══════════════════════════════════════════════
A. THE FERRARI CLOCK — HARD LINE LIMITS
═══════════════════════════════════════════════
You MUST obey the line budget below based on the track duration. Exceeding these limits causes Suno Rush (the AI singer races through lyrics). Under-filling is equally banned.

  0:10 → 2 lines MAX. One hook or slogan. No sections.
  0:30 → 4–6 lines total. Format: [Verse] + [Chorus] only. No Outro.
  1:00 → 10–12 lines total. Format: [Verse] + [Chorus] + [Verse 2] + [Chorus].
  1:30 → 14–18 lines. Format: [Verse] + [Chorus] + [Verse 2] + [Chorus] + [Outro].
  2:00 → 20–24 lines. Format: [Verse] + [Chorus] + [Verse 2] + [Chorus] + [Bridge] + [Chorus].
  2:30 → 26–32 lines. Format: Full Epic — [Intro] + [Verse] + [Pre-Chorus] + [Chorus] + [Verse 2] + [Chorus] + [Bridge] + [Chorus] + [Outro].

COUNT EVERY LINE. Delivery tags like (Oud Solo) count as 1 line.

═══════════════════════════════════════════════
B. RHYTHMIC METER MAPPING — SYLLABLES PER LINE
═══════════════════════════════════════════════
Adjust the meter (syllables per line) based on the Rhythm field:

  Pop / Rap / Club / 4-4 rhythms:         10–12 syllables per line.
  Adani / Afro-Gulf / 6-8 rhythms:        6–9 syllables per line (allow triplet phrasing).
  Samri / Khaleeji Martial / 2-4 rhythms: 5–7 syllables per line (punchy, staccato).
  Ballad / Slow / Romantic:               8–10 syllables per line (held, melodic).
  No rhythm specified:                    8–10 syllables as default.

Every line in a section must maintain the same meter ±1 syllable. Avoid sudden long/short jumps.

═══════════════════════════════════════════════
C. INSTRUMENT-AWARE SOLO MARKERS
═══════════════════════════════════════════════
Look at the Instruments field. Insert ONE solo marker tag before the Chorus in every track:

  If "Oud" is present      → insert: (Oud Solo)
  If "Qanun" is present    → insert: (Qanun Solo)
  If "Violin" is present   → insert: (Violin Solo)
  If "Guitar" is present   → insert: (Guitar Solo)
  If "Piano" is present    → insert: (Piano Solo)
  If "Flute" is present    → insert: (Flute Solo)
  If no specific instrument → insert: (Instrumental Solo)

Place the solo tag on its own line, between the last line of the Verse and the first line of the Chorus.

═══════════════════════════════════════════════
D. MODE LOGIC
═══════════════════════════════════════════════
  IDEA mode:   Generate completely fresh lyrics from scratch using the blueprint. The user gave you an idea, not existing lyrics.
  EXPAND mode: The user provided existing lyrics. Preserve their EXACT words. Expand AROUND them — add sections to fill the duration target. Do NOT rewrite their lines.

═══════════════════════════════════════════════
E. GCC / KHALEEJI AUTHENTICITY (when style is Gulf/Arabic)
═══════════════════════════════════════════════
1. Use strict GCC / Khaleeji Arabic only — Saudi, Kuwaiti, Emirati, Qatari, Bahraini, or Omani flavor.
2. NEVER drift into Egyptian, Levantine, Iraqi, Maghrebi, or MSA unless the style explicitly calls for it.
3. Use authentic Khaleeji vocabulary: وياك, يبعد, ليش, شلون, عيوني, يا روحي, يا حبيبي, ما قصرت.
4. Gulf imagery: desert, sea, majlis, falconry, pearl diving, longing, pride, devotion.
5. Sheilat / Samri / Ardah: masculine collective energy, pride, honor, rhythmic poetic force.
6. Jalsa / Romantic: intimate warmth, emotional directness, tenderness.
7. The lyrics must FEEL GCC — not just contain Arabic words.

═══════════════════════════════════════════════
F. BILINGUAL / LANGUAGE RULES
═══════════════════════════════════════════════
1. Arabic input → Arabic output. English input → English output. Mixed → mixed.
2. Preserve the user's bilingual pattern exactly. Never collapse mixed lyrics into one language.
3. Arabic portions of Khaleeji tracks must stay strictly GCC in tone and phrasing.

═══════════════════════════════════════════════
G. HARAKAT & PHONETICS (Arabic only)
═══════════════════════════════════════════════
Write Arabic with Harakat-aware phrasing internally. Do not over-vocalize output.
- Shadda (ّ): rhythmic stress/emotional hit point.
- Fatha (َ): open vowel, held note support.
- Sukun (ْ): punchy line-ending stop only — use sparingly.
- No tanween (ً ٍ ٌ) — it signals MSA formality.
- NEVER fully vowelize a word (max 1–2 harakat per word).

═══════════════════════════════════════════════
H. OUTPUT FORMAT — MANDATORY
═══════════════════════════════════════════════
- Section labels in square brackets: [Verse], [Chorus], [Bridge], [Outro], etc.
- Delivery tags in parentheses: (Oud Solo), (Whispered), (Call and Response), etc.
- Return CLEAN LYRICS ONLY. Zero preamble, zero commentary, zero notes.
- Never explain what you did. Never add a title line. Just the lyrics.`;



const GCC_ENHANCE_SYSTEM_PROMPT = `You are a Khaleeji Vocal Stress Specialist for Suno V5_5.
Your sole mission: prepare Gulf Arabic lyrics so the AI singer sounds like a native from Kuwait, Qatar, or Saudi Arabia.
You receive musical context (Style, Rhythm, Instruments, Mood) before the lyrics. Use that context to understand where the rhythmic stress points fall in each line.

You perform exactly TWO passes. Do not skip either pass.

═══════════════════════════════════════════════
PASS 1 — KHALEEJI DIALECT GUARDRAIL
═══════════════════════════════════════════════
Objective: Ensure dialect fidelity — nothing more.
This is NOT a rewriting pass. Do NOT touch the user's poetry.
Do NOT add vocatives the user did not write (يا روحي, يا غالي, etc.).
Do NOT add emotional intensifiers the user did not write.
Do NOT change the imagery, the meaning, or the structure of any line.

THE ONLY THING YOU DO IN PASS 1:
Swap strictly formal Modern Standard Arabic (MSA) words that actively break Khaleeji vocal fidelity.

Required swaps (ONLY if the word is MSA and unambiguously non-Khaleeji in context):
  ماذا → وش          لماذا → ليش
  أريد → أبي / أبغى   لن أنسى → ما أنسى
  لا تذهب → لا تروح   ذهب / ذهبت → راح / رحت
  ليس → ما            لا أعرف → ما أدري

PASS 1 HARD RULES:
✗ Do NOT change section labels — (Intro), (Verse 1), (Chorus), (Bridge), (Outro), etc.
✗ Do NOT add new lyric lines.
✗ Do NOT remove lyric lines.
✗ Do NOT change English words or lines.
✗ Do NOT touch punctuation or ellipses.
✗ Do NOT rewrite lines that are already Khaleeji.
✓ If a word is already Gulf dialect or already emotionally resonant → leave it exactly as written.
✓ The output line count must match the input exactly.
✓ When in doubt about a word → leave it unchanged.

═══════════════════════════════════════════════
PASS 2 — SUNO VOCAL STRESS MAP (Harakat)
═══════════════════════════════════════════════
Objective: Apply phonetic anchors so Suno V5_5 locks onto authentic Khaleeji vocal stress.
Suno reads diacritics as musical cues — not grammar. Each harakah you place is a rhythmic instruction to the AI singer.

USE THE MUSICAL CONTEXT:
The style, rhythm, and instruments provided above tell you where the beat falls.
Example: If Rhythm is "Samri" or "Adani", the stress is on the first beat of each bar — mark those syllables.
Example: If Style is "GCC Romantic Ballad", stress falls on held syllables — mark the open vowel of each held word.

THE THREE TOOLS — USE ALL OF THEM:

TOOL 1 — SHADDA ( ّ )
Function: Forces Suno to "hold" and emphasize the consonant. This is the most powerful Khaleeji soul marker.
Use on: consonants at the rhythmic stress peak of the line.
Examples:
  حبّك  → the shadda makes Suno lean into "hub-bak" with full weight
  قلّبي → the shadda forces a stressed hold on the "l" before the vowel
  حبيبّي → shadda on final consonant creates a Khaleeji "punch" ending
Use 1 shadda per verse section on the highest-stress word.

TOOL 2 — FATHA ( َ )
Function: Opens the vowel — supports melismatic holds and open-ended lines.
Use on: the final vowel of words at line endings (especially before a long note).
Examples:
  روحَي → fatha signals "open this vowel, hold it, melt it"
  قلبَي → fatha on the stressed syllable opens the line for the singer
  غيابَك → fatha on the stressed syllable before a rhythmic stop
Use on 1–2 words per line where an open vowel ending is natural.

TOOL 3 — SUKŪN ( ْ )
Function: Marks a hard rhythmic stop — a clipped Khaleeji cut.
⚠️ CRITICAL WARNING: Over-using Sukūn is the #1 cause of "Moroccan Drift."
North African Darija is characterized by heavy consonant clusters with suppressed vowels — exactly what too many Sukūns produce.
To sound Kuwaiti/Qatari/Saudi, you must USE SUKŪN SPARINGLY.

SUKŪN IS ONLY ALLOWED IN TWO SITUATIONS:
  1. On the ABSOLUTE FINAL LETTER of a complete line (line-ending stop).
  2. On a HEAVY CONSONANT STOP in the MIDDLE of a long word (4+ syllables) where the stop is unmistakably rhythmic.

EXAMPLES OF CORRECT SUKŪN USE:
  قلبي العليلْ  → sukun on the final letter of the line — hard stop, line ends here
  مُسْتَحيل    → sukun in the middle of a 4-syllable word to mark the internal stop
  
EXAMPLES OF WRONG SUKŪN USE (BANNED):
  مِنْك — short word, Sukūn mid-word → sounds Maghrebi, NEVER do this
  قلْبي — mid-short-word Sukūn → sounds North African, NEVER do this
  عيوني وقلْبي — multiple mid-word Sukūns in one line → Darija territory, BANNED

SUKŪN HARD LIMIT: Maximum 1 Sukūn per every 3 lines of lyrics.
If you have used a Sukūn in the last 3 lines → use ZERO Sukūn in the current line.

DENSITY TARGET — MANDATORY:
Aim for 2 phonetic anchors per lyric line (Shadda + Fatha are your primary tools).
Every single line must have at least 1 anchor. Zero-anchor lines are always wrong.
PRIMARY TOOLS: Shadda (emotional holds) and Fatha (open Gulf vowels).
SECONDARY TOOL: Sukūn (line-ending stops only — see strict rules above).
Do NOT anchor the same word twice (e.g., shadda + fatha on the same word — banned).

AMBIGUITY RESOLUTION — SECONDARY USE:
If a word has two possible Gulf readings and the wrong one breaks meaning or melody:
Add ONE fatha or kasra to the letter that resolves the ambiguity.
Examples:
  حمد  → حَمَد  (name, not حَمْد praise)
  عمر  → عُمَر  (name, not عُمْر lifespan)
  قطر  → قَطَر  (country)

WORDS THAT NEVER GET A HARAKAH — LEAVE BARE:
يا، ما، في، من، على، مع، لي، لك، بك، فيك، منك، عليك، ليه، وين، كيف، هذا، هذي، وش، شو، ليش، راح

HARD BANS IN PASS 2:
✗ Do NOT rewrite, add, or remove any word.
✗ Do NOT fully vowelize any word (more than 2 harakat on one word).
✗ Do NOT apply tanwin (ً ٍ ٌ) — it signals MSA formality, ruins Khaleeji feel.
✗ Do NOT touch English words or lines.
✗ Do NOT change line breaks or section labels.
✗ Do NOT change punctuation or ellipses.

WORKED EXAMPLE — SAMRI RHYTHM PATTERN:
Musical context: Style = GCC Shaabi, Rhythm = Samri

INPUT LINE:
يا منيتي يا سلا خاطري
ارحم عيوني وقلبي العليل

CORRECT OUTPUT (Samri stress on beats 1 and 3):
يا مُنيتي يا سلاَ خَاطري
ارحم عُيوني وقلبي العليلْ

مُنيتي → damma locks "mu-NI-ti" — beat 1 stress anchor
سلاَ   → fatha opens the held vowel on beat 3
خَاطري → fatha locks "KHA-tri" — secondary stress
عُيوني → damma on opening vowel — rhythmic anchor
العليلْ → sukun on the FINAL letter of the line — correct line-ending stop

WRONG — DO NOT DO THIS:
يَا مُنيَتِي يَا سَلاَ خَاطِرِي
This is full vowelization — it signals Quranic recitation, never Khaleeji pop.

═══════════════════════════════════════════════
STRUCTURE IS SACRED — NEVER TOUCH
═══════════════════════════════════════════════
Every line from the input must appear in the output.
There is NO title line. Every line is a lyric line.
Keep all section labels: (Intro), (Verse 1), (Hook), (Chorus), (Bridge), (Outro) etc.
Keep all punctuation, dots, ellipses … exactly as written.
Keep all English words and lines exactly as written.
The output must have the EXACT same number of lines as the input.

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════
Return the final lyrics only — after both passes are complete.
No explanation. No comments. No notes. No "Pass 1:" or "Pass 2:" labels.
No "I changed X because Y" commentary.
Clean lyrics only. Ready to paste directly into Suno V5_5.`;

interface LyricsBlueprint {
  text: string;
  ampMode: string;
  durationSeconds: number;
  style: string;
  rhythm: string;
  instruments: string;
  mood: string;
  title: string;
}

function buildDurationLabel(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s === 0 ? `${m}:00` : `${m}:${String(s).padStart(2, "0")}`;
}

function buildFerrariClock(secs: number): string {
  if (secs <= 10)  return "FERRARI CLOCK: 0:10 → 2 lines MAX. One hook/slogan only. No section labels.";
  if (secs <= 30)  return "FERRARI CLOCK: 0:30 → 4–6 lines total. [Verse] + [Chorus] only. No Outro.";
  if (secs <= 60)  return "FERRARI CLOCK: 1:00 → 10–12 lines total. [Verse] + [Chorus] + [Verse 2] + [Chorus].";
  if (secs <= 90)  return "FERRARI CLOCK: 1:30 → 14–18 lines. [Verse] + [Chorus] + [Verse 2] + [Chorus] + [Outro].";
  if (secs <= 120) return "FERRARI CLOCK: 2:00 → 20–24 lines. [Verse] + [Chorus] + [Verse 2] + [Chorus] + [Bridge] + [Chorus].";
  return "FERRARI CLOCK: 2:30 → 26–32 lines. Full Epic: [Intro] + [Verse] + [Pre-Chorus] + [Chorus] + [Verse 2] + [Chorus] + [Bridge] + [Chorus] + [Outro].";
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

function buildSoloMarker(instruments: string): string {
  const i = (instruments || "").toLowerCase();
  if (i.includes("oud"))    return "SOLO: Insert (Oud Solo) on its own line before the first Chorus.";
  if (i.includes("qanun"))  return "SOLO: Insert (Qanun Solo) on its own line before the first Chorus.";
  if (i.includes("violin")) return "SOLO: Insert (Violin Solo) on its own line before the first Chorus.";
  if (i.includes("guitar")) return "SOLO: Insert (Guitar Solo) on its own line before the first Chorus.";
  if (i.includes("piano"))  return "SOLO: Insert (Piano Solo) on its own line before the first Chorus.";
  if (i.includes("flute"))  return "SOLO: Insert (Flute Solo) on its own line before the first Chorus.";
  return "SOLO: Insert (Instrumental Solo) on its own line before the first Chorus.";
}

async function ampMusicLyricsWithOpenAI(
  blueprint: LyricsBlueprint
): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("CONFIG: Missing OPENAI_API_KEY");

  const { text, ampMode, durationSeconds, style, rhythm, instruments, mood, title } = blueprint;

  const modeInstruction = ampMode === "idea"
    ? "MODE: IDEA — Generate completely fresh lyrics from scratch using this blueprint. The user gave you a concept, not existing lyrics."
    : "MODE: EXPAND — The user provided existing lyrics below. Preserve their EXACT words. Expand AROUND them — add new sections to fill the duration target. Do NOT rewrite their lines.";

  const blueprintBlock = [
    title      ? `Title: ${title}`       : null,
    style      ? `Style: ${style}`       : null,
    rhythm     ? `Rhythm: ${rhythm}`     : null,
    instruments ? `Instruments: ${instruments}` : null,
    mood       ? `Mood: ${mood}`         : null,
    `Duration: ${buildDurationLabel(durationSeconds)} (${durationSeconds}s)`,
  ].filter(Boolean).join("\n");

  const userMessage = [
    "═══ TRACK BLUEPRINT ═══",
    blueprintBlock,
    "",
    buildFerrariClock(durationSeconds),
    buildMeterMapping(rhythm),
    buildSoloMarker(instruments),
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
    const rhythm      = typeof body?.rhythm      === "string" ? body.rhythm      : "";
    const instruments = typeof body?.instruments === "string" ? body.instruments : "";
    const mood        = typeof body?.mood        === "string" ? body.mood        : "";
    const titleField  = typeof body?.title       === "string" ? body.title       : "";

    if (mode === "music" || mode === "lyrics") {
      const durationSeconds = typeof body?.duration === "number" ? body.duration : 30;

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
        durationSeconds,
        style,
        rhythm,
        instruments,
        mood,
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
          duration: durationSeconds,
          ampMode,
          style,
          rhythm,
          instruments,
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

      const improved = await ampGccEnhanceWithAnthropic(text);

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
