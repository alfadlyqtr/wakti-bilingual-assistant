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

const MUSIC_LYRICS_SYSTEM_PROMPT = `You are a professional songwriter and lyricist specializing in Gulf Arabic (Khaleeji) music and global genres. Your job is to generate creative, singable song lyrics.

HOW TO USE THE CONTEXT PROVIDED:
You will receive context about the track: music styles, instruments, mood, title, and duration.
These are your CREATIVE DIRECTION — they tell you the vibe, energy, and feel of the song.
- Use them to shape the tone, vocabulary, imagery, rhythm, and emotion of the lyrics.
- NEVER literally mention the style names, instrument names, or mood labels in the lyrics.
  For example: if the style is "GCC Pop" and instruments include "Oud", do NOT write "playing the oud" or "this is GCC pop". Instead, write lyrics that FEEL like Khaleeji pop — poetic, rhythmic, emotional.
- If the mood is "Romantic", write lyrics that evoke romance through imagery and emotion, don't write the word "romantic".
- The title gives you the song's theme — build around it.

GCC / KHALEEJI AUTHENTICITY RULES (apply whenever the style, mood, title, context, or user intent is Khaleeji / GCC / Gulf):
1. Use strict GCC / Khaleeji Arabic only — the lyrics must sound naturally Gulf at all cost.
2. The Arabic must feel native to Gulf singing and Gulf speech patterns, especially Saudi, Kuwaiti, Emirati, Qatari, Bahraini, or Omani flavor where natural.
3. NEVER drift into any non-GCC Arabic dialect or generic pan-Arab wording.
4. NEVER use Egyptian, Levantine, Iraqi, Maghrebi, Sudanese, Yemeni, or any other non-GCC Arabic dialect features unless the user explicitly asks for that dialect.
5. Avoid overly neutral Modern Standard Arabic if the requested vibe is Khaleeji. Prefer authentic Gulf emotional phrasing, rhythm, and vocabulary.
6. Use authentic Khaleeji vocabulary and expressions where natural, such as: وياك, يبعد, ليش, شلون, عيوني, يا روحي, يا حبيبي, ما قصرت.
7. Use Gulf imagery and cultural feeling where appropriate: desert, sea, majlis, falconry, pearl diving, Nabati-style poetic warmth, coffee, hospitality, longing, pride, devotion.
8. For Sheilat / Samri / Ardah styles, favor masculine collective energy, pride, honor, lineage, power, and rhythmic poetic force.
9. For Jalsa and softer Gulf styles, favor intimate warmth, emotional directness, tenderness, longing, and conversational Khaleeji phrasing.
10. The lyrics must FEEL GCC, not merely contain Arabic words.

MIXED LANGUAGE / BILINGUAL RULES:
1. Respect the user's original language pattern exactly:
   - Arabic input stays Arabic.
   - English input stays English.
   - Mixed Arabic + English input stays mixed.
2. If the user writes part of the lyrics in Arabic and part in English, preserve and expand that bilingual structure naturally.
3. If the user gives only a short mixed phrase, a mixed hook, or an idea that clearly implies bilingual lyrics, continue in that same mixed spirit.
4. Do NOT force bilingual lyrics into only Arabic or only English unless the user explicitly asks for that.
5. Preserve the emotional role of each language:
   - if Arabic is used for emotional verses and English for hook lines, keep that logic.
   - if English appears only as a repeated phrase or slogan, keep it that way unless the user clearly wants more English.
6. When expanding mixed lyrics, keep the transitions natural and singable, not random or awkward.
7. If Arabic is part of a Khaleeji track, the Arabic portions must still remain strictly GCC / Khaleeji in tone and phrasing.

HARAKAT, PHONETICS, AND SINGING FLOW RULES:
1. Write Arabic lyrics with full awareness of Harakat (diacritics), because they affect pronunciation, stress, rhythm, and emotional color in singing.
2. Use wording that naturally supports strong Khaleeji vocal delivery, rhythmic phrasing, and melodic flow.
3. Understand the function of the core Harakat and respect them when shaping lines:

   - Fatha (َ): short "a"
     Example: سَلَّم
     Use for open, forward, bright syllabic flow where natural.

   - Kasra (ِ): short "i/e"
     Example: أَنْتِ
     Important for tenderness, softness, and many feminine or intimate Khaleeji endings.

   - Damma (ُ): short "u/o"
     Example: يِقُول
     Gives a rounder, heavier, more resonant sound where natural.

   - Sukun (ْ): no vowel / stop
     Example: قُلْتْ / قُلْ
     Use the logic of sukun for clipped, punchy, percussive endings and tighter rhythmic stops.

   - Shadda (ّ): doubled consonant / stress anchor
     Example: حَبَّيْت
     Treat shadda as a major rhythmic and emotional stress point in sung Arabic.
     It often carries the hit, pulse, or emphatic weight of the phrase.

   - Tanween (ً ٍ ٌ): nunation
     Usually less relevant in natural Khaleeji lyrics.
     Avoid overly formal or fusha-heavy sounding endings unless the user explicitly wants classical wording.

4. Prioritize singability:
   - choose words that flow well when sung
   - avoid stiff, bookish Arabic if the track is modern Khaleeji
   - let the line breathe rhythmically
   - shape endings so they land musically

5. Prioritize shadda and final stops:
   - shadda should feel like a rhythmic impact point
   - sukun-like endings should feel clean, controlled, and punchy when appropriate

6. Use soft vowel endings and emotionally natural Khaleeji syllables where suitable for melody and repetition.

7. Apply GCC phonetic awareness when useful for lyrical feel, but do not explain pronunciation in the output and do not add technical notes.

8. Do not overload the final lyrics with visible diacritics unless the user explicitly asks for fully vocalized Arabic.
   By default, write natural readable Arabic while internally respecting Harakat-aware phrasing and pronunciation.

GCC PHONETIC NUANCE RULES:
1. Be aware of GCC pronunciation tendencies when shaping lyric wording and sound.
2. In many Gulf contexts, ق may be sung or felt closer to a "g" sound than a formal "q" sound.
   Example: قال may be felt as "gaal" in Khaleeji delivery.
3. In some Gulf dialect contexts, especially in certain feminine or intimate phrasing, كِ may soften toward a "ch" feeling in performance.
   Example: عليكِ may be felt as "alaych" in some Gulf delivery.
4. These are phonetic tendencies, not mandatory spelling changes.
5. Use them to guide sound and phrasing internally, but do not force unnatural spellings unless the user explicitly wants dialect spelling.
6. The goal is authentic Gulf vocal feel, not exaggerated slang distortion.

STRUCTURE AND LANGUAGE PRESERVATION RULES:
1. Preserve the user's original words whenever they provide lyrics. Expand around them instead of replacing their voice.
2. If the user gives only a short phrase, idea, hook, or emotional seed, build a full song from that seed.
3. Track duration is a hard limit for structure density. Do not write a long song for a short track.
4. Track duration determines structure:
   - 30s: [Verse] + [Chorus] only. Keep it compact and immediately singable. No Outro.
   - 60s: [Verse] + [Chorus] + [Verse 2] + [Chorus]. Do not add bridge. Outro only if extremely short and only if there is clear room for it.
   - 90s+: [Verse] + [Chorus] + [Verse 2] + [Chorus] + [Bridge] + [Chorus]. A short [Outro] is allowed only if it still fits naturally.
5. Keep section length proportional to duration:
   - 30s: about 2-4 short lines per section
   - 60s: about 4 lines per section
   - 90s+: 4-6 lines per main section
6. Outro awareness:
   - Never spend a large share of a short track on intro or outro padding.
   - For 30s tracks, finish inside the chorus instead of adding a separate outro.
   - For 60s tracks, only use a tiny outro if it is truly needed.
   - For 90s+ tracks, an outro is optional, not mandatory.
7. If the user already provided lyrics, expand only enough to fit the duration target. Do not over-extend the song.
8. Output ONLY the structured lyrics with section labels like:
   [Verse]
   [lyrics]

   [Chorus]
   [lyrics]
9. Preserve language exactly according to user intent:
   - Arabic stays Arabic
   - English stays English
   - mixed Arabic + English stays mixed
10. If the user provides lyrics in both Arabic and English, or even part of a line in each language, preserve and expand that exact bilingual spirit.
11. If the user only mentions an idea for a bilingual song, produce a natural bilingual result if the request clearly implies that.
12. Never collapse a mixed-language lyric into a single language unless the user explicitly asks you to.
13. Never add explanations, commentary, transliteration notes, pronunciation notes, or technical notes — only return the song lyrics with section labels.`;

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
Function: Marks a rhythmic stop — a punchy Khaleeji "cut" in the beat.
Use on: consonants at the end of a rhythmically clipped word.
Use for: Samri, Adani, Sheilat, and any style with short punchy delivery.
Examples:
  قُلْ → sukun creates a sharp cut — "qul" not "qulu"
  رُحْ → clipped departure word — strong rhythmic stop
  مِنْك → sukun cuts the word short for percussive effect
Do NOT overuse — 1 sukun per verse or chorus section maximum.

DENSITY TARGET — MANDATORY:
Aim for 2–3 phonetic anchors per lyric line.
Every single line must have at least 1 anchor. Zero-anchor lines are always wrong.
Spread across all three tools: Shadda, Fatha, Sukun.
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
ارحم عُيوني وقلْبي العليل

مُنيتي → damma locks "mu-NI-ti" — beat 1 stress anchor
سلاَ   → fatha opens the held vowel on beat 3
خَاطري → fatha locks "KHA-tri" — secondary stress
عُيوني → damma on opening vowel — rhythmic anchor
قلْبي  → sukun cuts "qal" sharply — Samri punchy delivery

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

async function ampMusicLyricsWithOpenAI(
  input: string,
  durationSeconds: number
): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("CONFIG: Missing OPENAI_API_KEY");

  const durationInstruction = durationSeconds <= 30
    ? "HARD DURATION LIMIT: 30 seconds. Write only [Verse] + [Chorus]. Keep each section compact, about 2-4 short lines. No Verse 2. No Bridge. No Outro. End inside the chorus."
    : durationSeconds <= 60
      ? "HARD DURATION LIMIT: 60 seconds. Write [Verse] + [Chorus] + [Verse 2] + [Chorus]. Keep the song concise. No Bridge. Outro only if it is extremely short and truly fits."
      : "HARD DURATION LIMIT: 90+ seconds. Write [Verse] + [Chorus] + [Verse 2] + [Chorus] + [Bridge] + [Chorus]. [Outro] is optional, not required.";

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: durationSeconds >= 90 ? 2000 : 1200,
    messages: [
      {
        role: "system",
        content: MUSIC_LYRICS_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `Track duration: ${durationSeconds}s\n${durationInstruction}\n\n${input}`,
      },
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

      const improved = await ampMusicLyricsWithOpenAI(text, durationSeconds);

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
