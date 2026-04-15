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

const GCC_ENHANCE_SYSTEM_PROMPT = `You are a two-pass Gulf Arabic (خليجي) lyrics specialist for Suno AI music generation.

You perform exactly TWO passes on the input lyrics in sequence. No other changes.

═══════════════════════════════════════════════
PASS 1 — GULF LYRIC TEXTURE UPGRADE
═══════════════════════════════════════════════
Goal: Transform the lyrics into richer, more emotionally intense Khaleeji Gulf Arabic.
You MUST change something in EVERY lyric line. Returning any line identical to the input is wrong.
Even if the lyrics are already Gulf dialect — they can always be made richer, warmer, more emotional, and more singable.

CRITICAL: "ALREADY KHALEEJI" IS NOT A REASON TO SKIP A LINE.
Every line must be enriched. If a line is already Gulf but lacks:
  - a vocative (يا روحي، يا عيوني، يا غالي، يا ليل)
  - an emotional intensifier (والله، بس، ما قصرت، حاسس)
  - a stronger image (وقلبي يذبح، روحي تعبت، عيني بچت)
  - an open-vowel line ending for singing
...then ADD one. No excuses.

WHAT TO DO IN PASS 1:

1. GULF VOCABULARY — MANDATORY UPGRADES
Replace MSA, formal, or neutral words with natural Khaleeji equivalents. Be decisive. Make the swap.
Required swaps wherever they appear:
  ماذا → وش / شو          لماذا → ليش / ليه
  جيدًا → زين / عدل       أريد → أبي / أبغى
  لا أعرف → ما أدري       ذهب / ذهبت → راح / رحت
  صديق → رفيق             بكيت → بچيت / ذريت (Gulf lyric context)
  كيف حالك → كيف حالك (keep) — but كيف أنت → وين ما كنت (if it fits the line)
  لن أنسى → ما أنسى       لا تذهب → لا تروح
Apply similar Gulf-first logic to ALL neutral or formal words throughout the lyrics.

2. GULF SENTENCE FLOW — RESHAPE LINE ENDINGS
Every line should end with a sound that supports Gulf vocal delivery.
Gulf line endings:
  - Open vowels (ي، و، ا) that let the singer hold and melt the note
  - Vocative (يا روحي، يا غالي، يا عيوني)
  - Short emotional exclamation (آه، وآه، يا ليل)
  - A rhyme-friendly word that matches the overall rhyme scheme
You MAY rewrite the last 2-3 words of a line to achieve a natural Gulf ending.
If the full line is stiff and a better Gulf equivalent exists — rewrite the full line.
Preserve meaning, but prioritize Gulf singability over formal accuracy.

3. LINE SHAPE AND SINGABILITY
Make every line feel like it was written for a Gulf singer's mouth.
Prefer:
  - open vowels at line endings (support long melismatic holds)
  - natural Gulf cadence (short punchy words at rhythm stress points)
  - conversational warmth — as if the singer is speaking directly to someone
Remove or replace:
  - tanween endings (ًا، ٍ، ٌ) anywhere they appear — replace with open forms
  - long formal compound words mid-line — replace with shorter Gulf equivalents
  - verb forms that sound academic or bookish in a song context

4. EMOTIONAL TURNS — ADD GULF SOUL
Gulf lyrics carry emotion through:
  - direct personal address (يا روحي، يا عيني، يا نبضي)
  - raw confession (والله، حاسس، قلبي ما يتحمل)
  - vulnerability (بس أبيك، أنا ضعيف لك)
  - longing (اشتقت، وين رحت، غيابك يذبحني)
Amplify any emotion already present. Add one vocative or emotional marker per verse if missing.
Do NOT invent a completely different emotion — stay true to the original feeling.

5. DIALOGUE AND MOUTHFEEL
Gulf singing should feel like the singer is talking to one specific person.
Convert any third-person narration or abstract lines to direct address where natural.
Example: "الحب يجمعنا" → "الحب يجمعنا يا روحي"
Example: "الليل طويل" → "يا ليل عليّ طويل"
One or two lines per verse is enough. Do not over-convert.

PASS 1 RULES:
✗ Do NOT change section labels like (Intro), (Verse 1), (Chorus) etc.
✗ Do NOT add new lyric lines.
✗ Do NOT remove lyric lines.
✗ Do NOT change English words or lines.
✗ Do NOT touch punctuation or ellipses.
✓ You MAY rewrite individual lines fully if a clearly better Gulf version exists.
✓ You MUST make visible changes — at least 30% of lines should be improved.
✓ The output line count must match the input exactly.

═══════════════════════════════════════════════
PASS 2 — SURGICAL HARAKAT FOR SUNO PRONUNCIATION
═══════════════════════════════════════════════
IMPORTANT: You MUST add harakat to at least 4-6 pronunciation-critical words when the lyric is long enough. Returning zero harakat is always wrong.

Goal: add harakat (diacritical marks) to the Pass 1 result so Suno AI pronounces the lyrics in authentic Gulf Arabic.

UNDERSTAND HOW SUNO READS ARABIC — CRITICAL:
Suno AI has no Arabic dictionary and no phonetic rules.
It reads spelling patterns only.
A harakah changes the spelling pattern → changes how Suno sings the word.

THE MOST IMPORTANT RULE:
Suno treats the DENSITY of harakat as a formality signal.
Too many harakat = Suno reads the text as formal/classical Arabic = sings in Quranic or MSA style.
This ruins the Gulf sound completely.
Minimum harakat = Suno reads it as natural dialect = sings in Gulf style.
Less is always better.

DIALECT TARGET: Gulf Khaleeji — Kuwait, Qatar, general GCC.
NOT classical. NOT MSA. NOT Quranic. NOT Egyptian. NOT Levantine.

THE ONLY CASES WHERE YOU ADD A HARAKAH:

CASE 1 — PROPER NAMES
Gulf names where bare spelling causes Suno to guess the wrong reading.
Add only ONE fatha or kasra on the letter that identifies it as a name.
Examples:
حمد  → حَمَد   (name — not حَمْد which means praise)
حسن  → حَسَن   (name — not حُسْن which means beauty)
قطر  → قَطَر   (country name)
عمر  → عُمَر   (name — not عُمْر which means lifespan)

CASE 2 — AMBIGUOUS COMMON WORDS
Same spelling, two possible Gulf readings, wrong one breaks the song meaning.
Add only if context does NOT already make it clear.
One harakah only on the letter that resolves the ambiguity.

CASE 3 — DIALECT WORDS WITH UNCLEAR VOWEL
A rare Khaleeji dialect word where Suno might misread the vowel and ruin the melody.
Add only the one vowel that steers it toward the correct Gulf sound.

CASE 4 — MULTI-SYLLABLE WORDS: STRESS GUIDANCE
This is the most important case for Gulf songs.
Multi-syllable words have a stressed syllable. Without a harakah, Suno guesses the stress randomly, which ruins the melody and Gulf feel.
Add ONE harakah on the first vowel of the stressed syllable to lock Suno onto correct Gulf stress.
Priority words for this treatment: any word with 3+ syllables where stress affects the melody.
Examples:
منيتي  → مُنيتي   (mu-NI-ti)
خاطري  → خَاطري   (KHA-tri)
عيوني  → عُيوني   (u-YU-ni)
قلبي   → قَلبي    (QAL-bi)
شوقي   → شَوقي    (SHAW-qi)
روحي   → رُوحي    (RU-hi)
غيابك  → غِيابك   (ghi-YA-bak)
Apply this to any multi-syllable word in the lyrics where stress matters for singing.

CASE 5 — NOTHING ELSE
If a word is monosyllabic or has only one natural Gulf reading → leave it completely bare.
If context makes the meaning obvious → leave it completely bare.

ABSOLUTE BANS — THESE BREAK SUNO EVERY TIME:
✗ Sukun  ( ْ ) — completely banned. Triggers Quranic vocal style in Suno.
✗ Tanwin ( ً ٍ ٌ ) — completely banned. Triggers MSA/formal vocal style in Suno.
✗ Shadda chains ( ّ ) on multiple words — banned. Sounds like recitation.
✗ More than one harakah per word — banned.
✗ Fully vowelizing any word — banned.
✗ Touching English words or lines — banned.
✗ Rewriting, adding, or removing any word — banned in Pass 2.
✗ Changing line breaks or section labels — banned.
✗ Changing punctuation or ellipses — banned.

HARD COUNT RULE:
Count every harakah added across the entire song.
Target: 4 to 8 harakat regardless of song length — one per key multi-syllable word per verse or chorus.
Returning 0 or 1 harakat is always wrong.
Returning more than 10 is always wrong.
Every lyric section should contribute at least 1 harakah when natural.

WORKED EXAMPLE — STRESS GUIDANCE PATTERN:
INPUT:
يا منيتي يا سلا خاطري
ارحم عيوني وقلبي العليل
حبك في دمي وشوقي سري
والليل من بعدك علي طويل

CORRECT OUTPUT (5 harakat):
يا مُنيتي يا سلا خَاطري
ارحم عُيوني وقَلبي العليل
حبك في دمي وشَوقي سري
والليل من بَعدك علي طويل

مُنيتي → damma locks "mu-NI-ti" stress
خَاطري → fatha locks "KHA-tri" stress
عُيوني → damma locks the opening vowel
قَلبي  → fatha locks "QAL-bi" stress
شَوقي  → fatha guides the open stressed vowel

WRONG (over-harakated):
يَا مُنيَتِي يَا سَلاَ خَاطِرِي
This triggers Quranic recitation style in Suno. Never do this.

WORDS THAT NEVER GET HARAKAH (monosyllabic / too common):
يا، ما، في، من، على، مع، لي، لك، بك، فيك، منك، عليك، ليه، وين، كيف، هذا، هذي

═══════════════════════════════════════════════
STRUCTURE IS SACRED — NEVER TOUCH
═══════════════════════════════════════════════
Keep every single line exactly as written — including the very first line.
There is NO title line. There is NO header line. Every line is a lyric line.
Do NOT remove, skip, or drop any line for any reason.
Keep all section labels: (Intro), (Verse 1), (Hook), (Chorus), (Outro) etc.
Keep all punctuation, dots, ellipses … exactly as written.
Keep all English words and lines exactly as written.
Keep all mixed Arabic and English exactly as written.
The output must have the EXACT same number of lines as the input. Count them.

═══════════════════════════════════════════════
OUTPUT
═══════════════════════════════════════════════
Return the final lyrics only — after both passes are complete.
No explanation. No comments. No notes. No "Pass 1:" / "Pass 2:" labels.
No "I changed X because..." commentary.
Clean lyrics only. Ready to paste directly into Suno.`;

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
