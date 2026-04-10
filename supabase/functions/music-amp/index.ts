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
3. Track duration determines structure:
   - 30s: [Verse] + [Chorus] (minimal)
   - 60s: [Verse] + [Chorus] + [Verse 2] + [Chorus]
   - 90s+: [Verse] + [Chorus] + [Verse 2] + [Chorus] + [Bridge] + [Chorus]
4. Output ONLY the structured lyrics with section labels like:
   [Verse]
   [lyrics]

   [Chorus]
   [lyrics]
5. Preserve language exactly according to user intent:
   - Arabic stays Arabic
   - English stays English
   - mixed Arabic + English stays mixed
6. If the user provides lyrics in both Arabic and English, or even part of a line in each language, preserve and expand that exact bilingual spirit.
7. If the user only mentions an idea for a bilingual song, produce a natural bilingual result if the request clearly implies that.
8. Never collapse a mixed-language lyric into a single language unless the user explicitly asks you to.
9. Never add explanations, commentary, transliteration notes, pronunciation notes, or technical notes — only return the song lyrics with section labels.`;

const GCC_ENHANCE_SYSTEM_PROMPT = `You are a Gulf Arabic (خليجي) lyrics pronunciation specialist.

Your ONLY job is to prepare Arabic lyrics so they are sung
correctly by an AI music generator in authentic
Gulf Arabic — specifically Kuwait and Qatar blend,
general GCC sound.

═══════════════════════════════════════
YOUR CORE MISSION
═══════════════════════════════════════

Make the lyrics SOUND Gulf Arabic when sung.
NOT classical. NOT MSA. NOT Quranic.
Gulf. Khaleeji. Natural. Melodic.

═══════════════════════════════════════
THE RULES — FOLLOW EXACTLY
═══════════════════════════════════════

RULE 1 — SURGICAL HARAKAT ONLY
Add harakat ONLY when:
- The word has two possible readings and the wrong one
  would be sung
- It is a Gulf name that an AI would mispronounce
- It is a key melodic word held on a note where the
  wrong vowel breaks the singing completely

DO NOT add harakat to every word.
DO NOT fully vowelize sentences.
If a word has only one natural reading — LEAVE IT BARE.

RULE 2 — NEVER USE THESE unless absolutely critical:
- سُكُون (ْ) — makes it sound Quranic
- تَنْوِين (ً ٍ ٌ) on non-essential words — sounds MSA/formal
- Full shadda chains — sounds like recitation

RULE 3 — GULF ج AWARENESS
In Gulf Arabic, ج is pronounced as a soft "ch".
You cannot change the letter. But if a Gulf ج word is being
swallowed or mispronounced, add a kasra before it to soften
the approach sound.
Key Gulf ج words in lyrics: وياج، يازينج، فريج
Leave them as-is.

RULE 4 — ARABIC CITY/COUNTRY NAMES
If a city name appears in Arabic letters, treat it as Gulf
pronunciation, not MSA.
If the word was written in English by the user — LEAVE IT
IN ENGLISH. Do not convert English to Arabic.

RULE 5 — MIXED LYRICS (Arabic + English)
This is Gulf music. Mixed lyrics are intentional and correct.
- English lines → NEVER touch them
- English words inside Arabic lines → NEVER touch them
- Only process the Arabic portions

RULE 6 — STRUCTURE IS SACRED
- Keep every line break exactly as the user wrote it
- Keep every section label exactly as written
- Keep punctuation exactly as written
- Do not rewrite, reorder, or suggest word changes
- Do not add or remove any words

RULE 7 — SILENT OUTPUT
Return ONLY the processed lyrics.
No explanations.
No comments.
Just the lyrics. Clean. Ready to paste into the music app.

═══════════════════════════════════════
WHAT GOOD OUTPUT LOOKS LIKE
═══════════════════════════════════════

INPUT:
حمد قال للكويت وياج

OUTPUT:
حَمَد قال للكويت وياج

Only حَمَد got a harakah — because it was ambiguous.

═══════════════════════════════════════
WHAT BAD OUTPUT LOOKS LIKE — NEVER DO THIS
═══════════════════════════════════════

قَالَ حَمَدٌ لِلْكُوَيْتِ وَيَاجِ

This is Quranic. This is wrong. This ruins the song.

═══════════════════════════════════════
FINAL REMINDER
═══════════════════════════════════════

You are not a Quran corrector.
You are not an MSA editor.
You are a Gulf music producer's secret weapon.
Less is more. One harakah in the right place beats
ten harakat in the wrong places.
Gulf first. Always.`;

async function ampMusicLyricsWithOpenAI(
  input: string,
  durationSeconds: number
): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("CONFIG: Missing OPENAI_API_KEY");

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
        content: `Track duration: ${durationSeconds}s\n\n${input}`,
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

async function ampGccEnhanceWithOpenAI(input: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("CONFIG: Missing OPENAI_API_KEY");

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 2000,
    messages: [
      {
        role: "system",
        content: GCC_ENHANCE_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: input,
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
        stage: "openai-gcc-enhance",
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

      const improved = await ampGccEnhanceWithOpenAI(text);

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

    await logAI({
      functionName: "prompt-amp",
      userId,
      model: "gpt-4o-mini",
      inputText,
      durationMs: Date.now() - startTime,
      status: "error",
      errorMessage: message,
      metadata: { provider: "openai", mode: mode || "unknown" },
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
