import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildTrialErrorPayload, checkTrialAccess } from "../_shared/trial-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

interface SunoTrack {
  id: string;
  audioUrl: string;
  streamAudioUrl?: string;
  imageUrl?: string;
  prompt?: string;
  modelName?: string;
  title?: string;
  tags?: string;
  createTime?: string | number;
  duration?: number;
}

function getModelLimits(model: string) {
  if (model === "V4") {
    return { prompt: 3000, style: 200 };
  }

  return { prompt: 5000, style: 1000 };
}

const GCC_STYLE_MARKERS = /\b(khaleeji|kuwaiti|qatari|saudi|emirati|bahraini|omani|gulf|sheilat|samri|ardah|liwa|jalsa|mawwal)\b/i;
// Brand rule: Khaleeji ONLY. Trimmed weak tokens (generic arabic pop / news anchor / mispronounced)
// to free ~60 chars for dynamic anti-instrument tokens when the user narrows the instrument set.
const GCC_NEGATIVE_TOKENS = [
  "egyptian",
  "levantine",
  "maghrebi",
  "fusha",
  "msa",
  "lebanese",
  "syrian",
  "iraqi",
  "non-Khaleeji",
  "quranic recitation",
];
// Common Khaleeji-default instruments Suno auto-pulls from the word "khaleeji". When the user
// narrows the instrument set, we exclude the ones they did not pick.
const DEFAULT_KHALEEJI_INSTRUMENTS = [
  "oud",
  "darbuka",
  "mirwas",
  "riq",
  "qanun",
  "hand claps",
];
const POEM_NEGATIVE_TOKENS = [
  "singing",
  "sung chorus",
  "chorus",
  "hook",
  "chant",
  "clapping",
  "hand claps",
  "drums",
  "drum kit",
  "percussion",
  "trap beat",
  "drill beat",
  "club beat",
  "marching anthem",
  "screaming",
  "shouting",
];
const POEM_HARD_LOCK_STYLE = "spoken poem recitation only, voice dominant foreground, instruments low background bed only, no instrumental lead melody, free-tempo spoken pacing, no fixed beat grid, no melodic key-led phrasing, no singing, no chorus, no chant, no clapping, no drums, no percussion";
const POEM_HARD_LOCK_PROMPT = "[POEM HARD LOCK: spoken recitation only, voice loud and clearly out front, instruments quiet background bed only, no instrumental solos, no singing, no chorus, no chant, no claps, no drums, no percussion, free-tempo with no beat-driven groove]";

// ── Style-aware persona resolver ──
// The chip drives persona via the LOCK anchor string. Only LOCK_HERITAGE emits the word
// "mawwal" — so presence of "mawwal" means heritage family. Absence means pop family.
// Within each family we sub-resolve by explicit style markers (sheilat / samri / cinematic /
// wedding / trap / etc). No more greedy keyword matching on "luxury" or "elegant" that
// collapsed pop chips into jalsa.
function resolveGccPersonaFamily(style: string): "anthemic" | "samri" | "jalsa" | "trap" | "festive" | "cinematic" | "pop" {
  const styleSignal = style.toLowerCase();

  // Heritage sub-families — specific markers take priority inside heritage.
  if (/(sheilat|ardah|anthem|national event|ceremonial|warrior)/.test(styleSignal)) {
    return "anthemic";
  }

  if (/\bsamri\b/.test(styleSignal)) {
    return "samri";
  }

  // Heritage signal: only LOCK_HERITAGE emits "mawwal". Route to the right heritage sub-family.
  if (/\bmawwal\b/.test(styleSignal)) {
    if (/cinematic/.test(styleSignal)) return "cinematic";
    if (/(wedding|festive|shaabi|party)/.test(styleSignal)) return "festive";
    return "jalsa";
  }

  // Pop sub-families — reached only when style has no "mawwal" (LOCK_POP).
  if (/(trap|\brap\b|drill)/.test(styleSignal)) {
    return "trap";
  }

  if (/(wedding|party|shaabi|festive)/.test(styleSignal)) {
    return "festive";
  }

  if (/cinematic/.test(styleSignal)) {
    return "cinematic";
  }

  return "pop";
}

// ── Persona line — kept as a function (still exported downstream if needed) but the
// front-matter injector below no longer calls it. The frontend formatLyricsWithStructure
// now emits one short Suno-format cue above [Intro], so this long persona line is retained
// only as a defensive fallback if a caller explicitly asks for it. "Gulf accent" normalized
// to "Khaleeji accent" per brand rule.
function _buildGccPersonaLine(style: string, vocalGender?: "m" | "f"): string {
  const family = resolveGccPersonaFamily(style);

  if (family === "anthemic") {
    if (vocalGender === "f") {
      return "[Vocal persona: commanding Khaleeji female lead, proud Khaleeji accent, rally-call phrasing, ceremonial projection, locked unison feel, no MSA pronunciation]";
    }

    if (vocalGender === "m") {
      return "[Vocal persona: commanding Khaleeji male lead, proud Khaleeji accent, rally-call phrasing, ceremonial chest voice, locked unison feel, no MSA pronunciation]";
    }

    return "[Vocal persona: commanding Khaleeji lead vocalist, proud Khaleeji accent, rally-call phrasing, ceremonial projection, locked unison feel, no MSA pronunciation]";
  }

  if (family === "samri") {
    if (vocalGender === "f") {
      return "[Vocal persona: earthy Khaleeji female folk singer, warm Khaleeji accent, punchy samri phrasing, tight rhythmic entries, no MSA pronunciation]";
    }

    if (vocalGender === "m") {
      return "[Vocal persona: earthy Khaleeji male folk singer, warm Khaleeji accent, punchy samri phrasing, tight rhythmic chest voice, no MSA pronunciation]";
    }

    return "[Vocal persona: earthy Khaleeji folk singer, warm Khaleeji accent, punchy samri phrasing, tight rhythmic entries, no MSA pronunciation]";
  }

  if (family === "jalsa") {
    if (vocalGender === "f") {
      return "[Vocal persona: intimate Khaleeji female singer, warm Khaleeji accent, refined jalsa phrasing, expressive breathy entries, controlled melisma, no MSA pronunciation]";
    }

    if (vocalGender === "m") {
      return "[Vocal persona: intimate Khaleeji male singer, warm Khaleeji accent, refined jalsa phrasing, controlled mawwal, close-mic chest voice, no MSA pronunciation]";
    }

    return "[Vocal persona: intimate Khaleeji vocalist, warm Khaleeji accent, refined jalsa phrasing, controlled mawwal, close-mic delivery, no MSA pronunciation]";
  }

  if (family === "trap") {
    if (vocalGender === "f") {
      return "[Vocal persona: modern Khaleeji female vocal lead, sharp Khaleeji accent, tight rhythmic attack, urban phrasing, hook-ready delivery, no MSA pronunciation]";
    }

    if (vocalGender === "m") {
      return "[Vocal persona: modern Khaleeji male vocal lead, sharp Khaleeji accent, tight rhythmic attack, urban phrasing, hook-ready delivery, no MSA pronunciation]";
    }

    return "[Vocal persona: modern Khaleeji vocal lead, sharp Khaleeji accent, tight rhythmic attack, urban phrasing, hook-ready delivery, no MSA pronunciation]";
  }

  if (family === "festive") {
    if (vocalGender === "f") {
      return "[Vocal persona: festive Khaleeji female singer, bright Khaleeji accent, clap-driven phrasing, celebratory call-and-response feel, no MSA pronunciation]";
    }

    if (vocalGender === "m") {
      return "[Vocal persona: festive Khaleeji male singer, bright Khaleeji accent, clap-driven phrasing, celebratory crowd energy, no MSA pronunciation]";
    }

    return "[Vocal persona: festive Khaleeji singer, bright Khaleeji accent, clap-driven phrasing, celebratory crowd energy, no MSA pronunciation]";
  }

  if (family === "cinematic") {
    if (vocalGender === "f") {
      return "[Vocal persona: cinematic Khaleeji female singer, warm Khaleeji accent, dramatic long phrases, poised dynamic swells, no MSA pronunciation]";
    }

    if (vocalGender === "m") {
      return "[Vocal persona: cinematic Khaleeji male singer, warm Khaleeji accent, dramatic long phrases, resonant chest voice, no MSA pronunciation]";
    }

    return "[Vocal persona: cinematic Khaleeji singer, warm Khaleeji accent, dramatic long phrases, poised dynamic swells, no MSA pronunciation]";
  }

  if (vocalGender === "f") {
    return "[Vocal persona: polished Khaleeji female pop singer, warm Khaleeji accent, refined hook phrasing, expressive breathy entries, no MSA pronunciation]";
  }

  if (vocalGender === "m") {
    return "[Vocal persona: polished Khaleeji male pop singer, warm Khaleeji accent, refined hook phrasing, textured chest voice, no MSA pronunciation]";
  }

  return "[Vocal persona: polished Khaleeji vocalist, warm Khaleeji accent, refined hook phrasing, controlled melisma, no MSA pronunciation]";
}

function fitCommaSeparatedTokens(tokens: string[], maxLength: number): string {
  let out = "";

  for (const token of tokens) {
    const clean = token.trim();
    if (!clean) continue;
    const next = out ? `${out}, ${clean}` : clean;
    if (next.length > maxLength) break;
    out = next;
  }

  return out;
}

function tokenizeCommaSeparatedTokens(value: string): string[] {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function dedupeCommaSeparatedTokens(tokens: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const token of tokens) {
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }

  return out;
}

// Parse instrument list from the style string so we can compute an anti-instrument
// negative list without requiring a new body field. Supports two formats:
//   1) Legacy CSV: "locked instruments: a, b, c, ..."
//   2) Wakti Recipe v1 natural-language brief: "...built around a, b, c with a {rhythm}..."
function extractLockedInstruments(style: string): string[] {
  // Legacy CSV format
  const legacy = style.match(/locked instruments:\s*(.+?)(?=,\s*(?:mood arc|structure arc|tempo|key|authentic|strict)|$)/i);
  if (legacy) return legacy[1].split(",").map((s) => s.trim()).filter(Boolean);

  // Recipe v1 brief: "built around piano, acoustic guitar, bass guitar, ... with a khaleeji shuffle..."
  const recipe = style.match(/built around\s+(.+?)\s+with\s+(?:a|the|an)\s/i);
  if (recipe) return recipe[1].split(",").map((s) => s.trim()).filter(Boolean);

  return [];
}

// Smart anti-instrument negatives within the 200-char budget. When the user narrows the
// instrument set, exclude the default Khaleeji instruments they did NOT pick so Suno's
// training bias does not sneak oud / darbuka / claps into a pop-only arrangement.
//
// Wakti Recipe v1 also emits an explicit sentinel sentence in the style brief —
// "No traditional Khaleeji instrumentation — this is a modern production." — when the
// user picks a modern Khaleeji family with no traditional instruments. We treat that
// sentinel as a hard signal to inject ALL traditional anti-tokens, regardless of what
// the instrument extractor returned.
function buildGccNegativeTags(style: string = "", preferredNegativeTags: string = ""): string {
  const tokens = dedupeCommaSeparatedTokens([
    ...tokenizeCommaSeparatedTokens(preferredNegativeTags),
    ...GCC_NEGATIVE_TOKENS,
  ]);
  const userInstruments = extractLockedInstruments(style).map((i) => i.toLowerCase());
  const explicitlyExcludesTraditional = /no traditional khaleeji instrumentation/i.test(style);

  if (explicitlyExcludesTraditional) {
    // Hard signal from Wakti Recipe v1 brief — modern production, block all traditional.
    for (const inst of DEFAULT_KHALEEJI_INSTRUMENTS) tokens.push(inst);
  } else if (userInstruments.length > 0) {
    for (const inst of DEFAULT_KHALEEJI_INSTRUMENTS) {
      const alreadyPicked = userInstruments.some((u) => u.includes(inst));
      if (!alreadyPicked) tokens.push(inst);
    }
  }

  return fitCommaSeparatedTokens(tokens, 200);
}

function buildPoemNegativeTags(preferredNegativeTags: string = ""): string {
  const tokens = dedupeCommaSeparatedTokens([
    ...tokenizeCommaSeparatedTokens(preferredNegativeTags),
    ...POEM_NEGATIVE_TOKENS,
  ]);
  return fitCommaSeparatedTokens(tokens, 200);
}

function stripPoemSongCues(value: string): string {
  return value
    .replace(/\b\d+\s*BPM\b/gi, "free-tempo")
    .replace(/\bdriving\s+the\s+groove\b/gi, "supporting spoken cadence")
    .replace(/\bgroove\s+feel\b/gi, "spoken cadence")
    .replace(/\b(?:focused|modern|warm)\s+khaleeji\s+groove\b/gi, "spoken cadence")
    .replace(/\b[A-G](?:#|b)?\s*(?:minor|major)\s*(?:tonal\s*center)?\b/gi, "soft tonal bed")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function applyPoemStyleHardLock(style: string, khaleejiDialectLabel: string, khaleejiAccentAnchor: string): string {
  const dialectBlock = [khaleejiDialectLabel, khaleejiAccentAnchor]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
  const cleanedStyle = stripPoemSongCues(style);
  return [POEM_HARD_LOCK_STYLE, dialectBlock, cleanedStyle]
    .filter(Boolean)
    .join(", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function applyPoemPromptHardLock(prompt: string): string {
  const cleanedPrompt = stripPoemSongCues(prompt);
  return [POEM_HARD_LOCK_PROMPT, cleanedPrompt].filter(Boolean).join("\n\n").trim();
}

// No-op wrapper retained so existing call-sites keep compiling. The Khaleeji vocal cue
// is now emitted by the frontend (single Suno-format bracket above [Intro]). We do not
// prepend [Language:] or a long [Vocal persona:] paragraph here anymore.
function applyGccPromptShaping(prompt: string, _style: string, _vocalGender?: "m" | "f"): string {
  return prompt.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const KIE_API_KEY = Deno.env.get("KIE_API_KEY") ?? "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/music-callback`;

  try {
    if (!KIE_API_KEY) {
      throw new Error("KIE_API_KEY not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Authentication failed");
    }

    // ── Trial Token Check: music ──
    const trial = await checkTrialAccess(supabaseService, user.id, 'music', 1);
    if (!trial.allowed) {
      return new Response(
        JSON.stringify(buildTrialErrorPayload('music', trial)),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ── End Trial Token Check ──

    if (req.method !== "POST") {
      throw new Error("Method not allowed");
    }

    const body = await req.json();

    // KIE.ai request fields
    const prompt = (body?.prompt || "").toString().trim();
    const style = (body?.style || "").toString().trim();
    const title = (body?.title || "").toString().trim();
    const customMode = Boolean(body?.customMode ?? true);
    const instrumental = Boolean(body?.instrumental ?? false);
    const rawModel = (body?.model || "").toString().trim();
    // Accept the valid Kie/Suno model set. V4_5PLUS is used for GCC tracks (more dialect-
    // obedient per Kie docs); V5_5 remains default for non-GCC. Unknown values fall back
    // to V5_5 so a client typo never hard-fails generation.
    const ALLOWED_MODELS = new Set(["V5_5", "V5", "V4_5PLUS", "V4_5", "V4_5ALL", "V4"]);
    const model = ALLOWED_MODELS.has(rawModel) ? rawModel : "V5_5";
    const negativeTags = (body?.negativeTags || "").toString().trim();
    const vocalGender = body?.vocalGender as "m" | "f" | undefined;
    const styleWeight = typeof body?.styleWeight === "number" ? body.styleWeight : undefined;
    const weirdnessConstraint = typeof body?.weirdnessConstraint === "number" ? body.weirdnessConstraint : undefined;
    const audioWeight = typeof body?.audioWeight === "number" ? body.audioWeight : undefined;
    const personaId = (body?.personaId || "").toString().trim();
    const personaModel = (body?.personaModel || "").toString().trim();
    const customVoiceId = (body?.customVoiceId || "").toString().trim();
    const customVoiceKieVoiceId = (body?.customVoiceKieVoiceId || "").toString().trim();
    const customVoiceType = (body?.customVoiceType || "").toString().trim();
    const customVoiceName = (body?.customVoiceName || "").toString().trim();
    const khaleejiDialect = (body?.khaleejiDialect || "").toString().trim();
    const khaleejiDialectLabel = (body?.khaleejiDialectLabel || "").toString().trim();
    const khaleejiAccentAnchor = (body?.khaleejiAccentAnchor || "").toString().trim();
    const styleTags = Array.isArray(body?.styleTags) ? body.styleTags.filter((tag: unknown): tag is string => typeof tag === "string" && tag.trim().length > 0) : [];
    const controlBlock = (body?.controlBlock || "").toString().trim();
    const structurePlan = (body?.structurePlan || "").toString().trim();
    const tempoHint = (body?.tempoHint || "").toString().trim();
    const musicalKeyHint = (body?.musicalKeyHint || "").toString().trim();
    const rawDurationSeconds =
      typeof body?.duration_seconds === "number"
        ? body.duration_seconds
        : typeof body?.durationSeconds === "number"
          ? body.durationSeconds
          : typeof body?.duration === "number"
            ? body.duration
            : null;
    const ALLOWED_DURATION_SECONDS = new Set([30, 60, 90, 120, 150, 180, 210]);
    const durationHint = rawDurationSeconds !== null ? Math.round(rawDurationSeconds) : null;
    const { prompt: promptLimit, style: styleLimit } = getModelLimits(model);
    const poemSignal = [style, prompt, styleTags.join(",")].join(" ").toLowerCase();
    const isPoemEffective = /\b(?:gcc\s*poem|arabic\s*poem|english\s*poem|poem\s*cadence|spoken\s*poem|spoken-word\s*poem|poem\s*recitation)\b|قصيدة|إلقاء\s*شعري/.test(poemSignal);
    const effectiveStyle = isPoemEffective
      ? applyPoemStyleHardLock(style, khaleejiDialectLabel, khaleejiAccentAnchor)
      : style;
    const isGccEffective = GCC_STYLE_MARKERS.test(effectiveStyle);
    const effectivePrompt = isPoemEffective
      ? applyPoemPromptHardLock(prompt)
      : (!instrumental && isGccEffective ? applyGccPromptShaping(prompt, effectiveStyle, vocalGender) : prompt);
    let effectiveNegativeTags = negativeTags;
    if (isPoemEffective) {
      effectiveNegativeTags = buildPoemNegativeTags(effectiveNegativeTags);
    }
    if (isGccEffective) {
      effectiveNegativeTags = buildGccNegativeTags(effectiveStyle, effectiveNegativeTags);
    }
    const effectiveStyleWeight = isPoemEffective
      ? Math.min(styleWeight ?? 0.72, 0.78)
      : styleWeight;
    // Frontend now sends the correct value (user override or genre-based recommended).
    // Only fall back to old GCC defaults when no value was sent (backwards compat).
    const effectiveWeirdnessConstraint = isPoemEffective
      ? Math.min(weirdnessConstraint ?? 0.2, 0.25)
      : (weirdnessConstraint !== undefined ? weirdnessConstraint : (isGccEffective ? 0.55 : undefined));
    const effectiveAudioWeight = isPoemEffective
      ? Math.max(audioWeight ?? 0.95, 0.9)
      : (audioWeight !== undefined ? audioWeight : (isGccEffective ? 0.65 : undefined));

    if (title.length > 80) {
      throw new Error("Title exceeds 80 characters");
    }

    if (durationHint === null || !ALLOWED_DURATION_SECONDS.has(durationHint)) {
      return new Response(JSON.stringify({ error: "A valid duration is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Custom voice → Suno Voice persona mapping ──
    // Per the Suno API spec, a Suno Voice voiceId (stored as kie_voice_id) is applied to
    // music generation by sending it as personaId together with personaModel='voice_persona'.
    // The earlier block here wrongly assumed this was impossible. Voice personas require a
    // V5-family model; the client sends V5_5.
    const resolvedPersonaId = customVoiceKieVoiceId || personaId;
    const resolvedPersonaModel = customVoiceKieVoiceId ? "voice_persona" : personaModel;
    if (customVoiceKieVoiceId) {
      console.log("[music-generate] Custom voice persona applied", {
        model,
        customVoiceKieVoiceId,
        customVoiceType,
        customVoiceName,
        resolvedPersonaModel,
      });
    }

    if (customMode) {
      if (effectiveStyle.length > styleLimit) {
        throw new Error(`Style exceeds ${styleLimit} characters for model ${model}`);
      }

      if (!instrumental && effectivePrompt.length > promptLimit) {
        throw new Error(`Prompt exceeds ${promptLimit} characters for model ${model}`);
      }
    } else if (effectivePrompt.length > 500) {
      throw new Error("Non-custom mode prompt exceeds 500 characters");
    }

    // Validation per API rules
    if (customMode) {
      if (instrumental && (!effectiveStyle || !title)) {
        console.error("[music-generate] Validation failed: instrumental missing style or title", { style: effectiveStyle, title });
        return new Response(JSON.stringify({ error: "Custom instrumental mode requires style and title" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!instrumental && (!effectiveStyle || !title || !effectivePrompt)) {
        console.error("[music-generate] Validation failed: lyrical missing fields", { style: !!effectiveStyle, title: !!title, prompt: !!effectivePrompt });
        return new Response(JSON.stringify({ error: "Custom lyrical mode requires style, title, and prompt (lyrics)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      if (!effectivePrompt) {
        return new Response(JSON.stringify({ error: "Non-custom mode requires prompt" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Build KIE.ai request payload
    // NOTE: instrumental mode must NOT send a prompt field — KIE.ai rejects empty prompt strings
    const kiePayload: Record<string, unknown> = {
      customMode,
      instrumental,
      model,
      callBackUrl: CALLBACK_URL,
    };

    if (!instrumental && effectivePrompt) {
      kiePayload.prompt = effectivePrompt;
    }

    if (customMode) {
      kiePayload.style = effectiveStyle;
      kiePayload.title = title;
      kiePayload.duration = durationHint;
      if (effectiveNegativeTags) kiePayload.negativeTags = effectiveNegativeTags;
      if (vocalGender && !instrumental) kiePayload.vocalGender = vocalGender;
      if (effectiveStyleWeight !== undefined) kiePayload.styleWeight = effectiveStyleWeight;
      if (effectiveWeirdnessConstraint !== undefined) kiePayload.weirdnessConstraint = effectiveWeirdnessConstraint;
      if (effectiveAudioWeight !== undefined) kiePayload.audioWeight = effectiveAudioWeight;
      if (resolvedPersonaId) kiePayload.personaId = resolvedPersonaId;
      if (resolvedPersonaModel) kiePayload.personaModel = resolvedPersonaModel;
    }

    if (customMode && typeof kiePayload.duration !== "number") {
      throw new Error("Duration was not attached to the outbound KIE payload");
    }

    console.log("[music-generate] Calling KIE.ai generate", {
      model,
      customMode,
      instrumental,
      duration: durationHint,
      payloadDuration: kiePayload.duration ?? null,
      styleLen: effectiveStyle.length,
      promptLen: effectivePrompt.length,
      hasPersonaId: Boolean(personaId),
      personaModel: personaModel || null,
      customVoiceId: customVoiceId || null,
      customVoiceKieVoiceId: customVoiceKieVoiceId || null,
      customVoiceType: customVoiceType || null,
      customVoiceName: customVoiceName || null,
    });
    console.log("[music-generate] KIE payload keys:", Object.keys(kiePayload));

    const kieResp = await fetch("https://api.kie.ai/api/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${KIE_API_KEY}`,
      },
      body: JSON.stringify(kiePayload),
    });

    if (!kieResp.ok) {
      const errText = await kieResp.text();
      console.error("[music-generate] KIE.ai HTTP error:", kieResp.status, errText);
      if (kieResp.status === 422) {
        return new Response(JSON.stringify({
          error: "Style or negative tags are too long — please shorten your style description or remove some tags.",
          detail: errText,
        }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`KIE.ai error: ${kieResp.status} ${errText}`);
    }

    const kieData = await kieResp.json();

    if (kieData.code !== 200 || !kieData.data?.taskId) {
      console.error("[music-generate] KIE.ai rejected:", JSON.stringify(kieData));
      throw new Error(`KIE.ai rejected request: ${kieData.msg || "Unknown error"}`);
    }

    const taskId = kieData.data.taskId as string;
    console.log("[music-generate] KIE.ai taskId received", taskId);

    // ── Log this generation for quota tracking (independent of saved tracks) ──
    // Inserting here means quota is consumed the moment KIE accepts the job.
    // Deleting saved tracks later has zero effect on this count.
    try {
      const { error: logError } = await supabaseService
        .from("user_music_generation_log")
        .insert({ user_id: user.id, task_id: taskId });
      if (logError) console.error("[music-generate] Generation log insert failed (non-fatal):", logError.message);
      else console.log("[music-generate] Generation log recorded for taskId", taskId);
    } catch (logErr) {
      console.error("[music-generate] Generation log exception (non-fatal):", (logErr as Error).message);
    }
    // ── End quota log ──

    // Audit payload stored inside meta JSONB (no separate column needed)
    const requestPayload: Record<string, unknown> = {
      customMode, instrumental, model,
      prompt: effectivePrompt || null,
      style: effectiveStyle || null,
      raw_style: style || null,
      styleTags: styleTags.length > 0 ? styleTags : null,
      title: title || null,
      negativeTags: effectiveNegativeTags || null,
      vocalGender: vocalGender || null,
      styleWeight: effectiveStyleWeight ?? null,
      weirdnessConstraint: effectiveWeirdnessConstraint ?? null,
      audioWeight: effectiveAudioWeight ?? null,
      controlBlock: controlBlock || null,
      structurePlan: structurePlan || null,
      tempoHint: tempoHint || null,
      musicalKeyHint: musicalKeyHint || null,
      khaleejiDialect: khaleejiDialect || null,
      khaleejiDialectLabel: khaleejiDialectLabel || null,
      khaleejiAccentAnchor: khaleejiAccentAnchor || null,
      duration_seconds: durationHint,
      personaId: personaId || null,
      personaModel: personaModel || null,
      customVoiceId: customVoiceId || null,
      customVoiceKieVoiceId: customVoiceKieVoiceId || null,
      customVoiceType: customVoiceType || null,
      customVoiceName: customVoiceName || null,
    };

    // DB insert is non-fatal: if it fails we log and still return success to the user
    let recordId: string | null = null;
    try {
      const { data: placeholderData, error: placeholderError } = await supabaseService
        .from("user_music_tracks")
        .insert({
          user_id: user.id,
          task_id: taskId,
          title: title || null,
          prompt: effectivePrompt || null,
          include_styles: effectiveStyle ? [effectiveStyle] : null,
          requested_duration_seconds: durationHint ? Math.round(durationHint) : null,
          provider: "kie",
          model: model,
          storage_path: null,
          signed_url: null,
          mime: "audio/mpeg",
          meta: {
            status: "generating",
            saved: false,
            is_generation_root: true,
            customMode,
            instrumental,
            style: effectiveStyle || null,
            styleTags: styleTags.length > 0 ? styleTags : null,
            negativeTags: effectiveNegativeTags || null,
            vocalGender: vocalGender || null,
            controlBlock: controlBlock || null,
            structurePlan: structurePlan || null,
            tempoHint: tempoHint || null,
            musicalKeyHint: musicalKeyHint || null,
            khaleejiDialect: khaleejiDialect || null,
            khaleejiDialectLabel: khaleejiDialectLabel || null,
            khaleejiAccentAnchor: khaleejiAccentAnchor || null,
            request_payload: requestPayload,
          },
        })
        .select("id")
        .single();

      if (placeholderError) {
        console.error("[music-generate] DB insert failed (non-fatal):", JSON.stringify(placeholderError));
      } else {
        recordId = placeholderData?.id as string;
        console.log("[music-generate] Placeholder row created", recordId);
      }
    } catch (dbErr) {
      console.error("[music-generate] DB insert exception (non-fatal):", (dbErr as Error).message);
    }

    return new Response(JSON.stringify({
      taskId,
      recordId,
      status: "generating",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[music-generate] Unhandled error:", (error as Error).message, (error as Error).stack);
    return new Response(JSON.stringify({
      error: (error as Error).message || "Music generation failed",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
