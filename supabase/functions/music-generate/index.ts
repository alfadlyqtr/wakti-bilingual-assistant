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
function buildGccNegativeTags(style: string = ""): string {
  const tokens = [...GCC_NEGATIVE_TOKENS];
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
    const styleTags = Array.isArray(body?.styleTags) ? body.styleTags.filter((tag: unknown): tag is string => typeof tag === "string" && tag.trim().length > 0) : [];
    const controlBlock = (body?.controlBlock || "").toString().trim();
    const structurePlan = (body?.structurePlan || "").toString().trim();
    const tempoHint = (body?.tempoHint || "").toString().trim();
    const musicalKeyHint = (body?.musicalKeyHint || "").toString().trim();
    const durationHint = typeof body?.duration_seconds === "number" ? body.duration_seconds : null;
    const { prompt: promptLimit, style: styleLimit } = getModelLimits(model);
    const isGccEffective = GCC_STYLE_MARKERS.test(style);
    const effectivePrompt = !instrumental && isGccEffective ? applyGccPromptShaping(prompt, style, vocalGender) : prompt;
    const effectiveNegativeTags = isGccEffective ? buildGccNegativeTags(style) : negativeTags;
    // Frontend now sends the correct value (user override or genre-based recommended).
    // Only fall back to old GCC defaults when no value was sent (backwards compat).
    const effectiveWeirdnessConstraint = weirdnessConstraint !== undefined ? weirdnessConstraint : (isGccEffective ? 0.55 : undefined);
    const effectiveAudioWeight = audioWeight !== undefined ? audioWeight : (isGccEffective ? 0.65 : undefined);

    if (title.length > 80) {
      throw new Error("Title exceeds 80 characters");
    }

    if (customMode) {
      if (style.length > styleLimit) {
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
      if (instrumental && (!style || !title)) {
        console.error("[music-generate] Validation failed: instrumental missing style or title", { style, title });
        return new Response(JSON.stringify({ error: "Custom instrumental mode requires style and title" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!instrumental && (!style || !title || !effectivePrompt)) {
        console.error("[music-generate] Validation failed: lyrical missing fields", { style: !!style, title: !!title, prompt: !!effectivePrompt });
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
      kiePayload.style = style;
      kiePayload.title = title;
      if (durationHint) kiePayload.duration = Math.round(durationHint);
      if (effectiveNegativeTags) kiePayload.negativeTags = effectiveNegativeTags;
      if (vocalGender && !instrumental) kiePayload.vocalGender = vocalGender;
      if (styleWeight !== undefined) kiePayload.styleWeight = styleWeight;
      if (effectiveWeirdnessConstraint !== undefined) kiePayload.weirdnessConstraint = effectiveWeirdnessConstraint;
      if (effectiveAudioWeight !== undefined) kiePayload.audioWeight = effectiveAudioWeight;
      if (personaId) kiePayload.personaId = personaId;
      if (personaModel) kiePayload.personaModel = personaModel;
    }

    console.log("[music-generate] Calling KIE.ai generate", { model, customMode, instrumental, styleLen: style.length, promptLen: effectivePrompt.length });
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
      style: style || null,
      styleTags: styleTags.length > 0 ? styleTags : null,
      title: title || null,
      negativeTags: effectiveNegativeTags || null,
      vocalGender: vocalGender || null,
      styleWeight: styleWeight ?? null,
      weirdnessConstraint: effectiveWeirdnessConstraint ?? null,
      audioWeight: effectiveAudioWeight ?? null,
      controlBlock: controlBlock || null,
      structurePlan: structurePlan || null,
      tempoHint: tempoHint || null,
      musicalKeyHint: musicalKeyHint || null,
      duration_seconds: durationHint,
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
          include_styles: style ? [style] : null,
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
            style: style || null,
            styleTags: styleTags.length > 0 ? styleTags : null,
            negativeTags: effectiveNegativeTags || null,
            vocalGender: vocalGender || null,
            controlBlock: controlBlock || null,
            structurePlan: structurePlan || null,
            tempoHint: tempoHint || null,
            musicalKeyHint: musicalKeyHint || null,
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
