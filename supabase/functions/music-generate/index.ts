import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkAndConsumeTrialToken } from "../_shared/trial-tracker.ts";

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
const GCC_LANGUAGE_TAG = "[Language: Khaleeji Arabic / Gulf Arabic / ar-KW ar-QA ar-SA]";
const GCC_NEGATIVE_TOKENS = [
  "egyptian",
  "levantine",
  "maghrebi",
  "standard arabic",
  "fusha",
  "msa",
  "lebanese",
  "syrian",
  "iraqi",
  "non-gulf",
  "non-khaleeji",
  "generic arabic pop",
  "quranic recitation",
  "news anchor delivery",
  "mispronounced",
];

function buildGccPersonaLine(vocalGender?: "m" | "f"): string {
  if (vocalGender === "f") {
    return "[Vocal persona: seasoned Khaleeji female singer, warm Gulf accent, refined jalsa phrasing, expressive breathy entries, controlled melisma, no MSA pronunciation]";
  }

  if (vocalGender === "m") {
    return "[Vocal persona: seasoned Khaleeji male singer, warm Gulf accent, textured chest voice, refined jalsa phrasing, controlled mawwal, no MSA pronunciation]";
  }

  return "[Vocal persona: seasoned Khaleeji vocalist, warm Gulf accent, refined jalsa phrasing, controlled mawwal, no MSA pronunciation]";
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

function buildGccNegativeTags(): string {
  return fitCommaSeparatedTokens(GCC_NEGATIVE_TOKENS, 200);
}

function applyGccPromptShaping(prompt: string, vocalGender?: "m" | "f"): string {
  const trimmed = prompt.trim();
  if (!trimmed) return trimmed;

  const prefix: string[] = [];
  if (!trimmed.includes(GCC_LANGUAGE_TAG)) {
    prefix.push(GCC_LANGUAGE_TAG);
  }
  if (!trimmed.includes("[Vocal persona:")) {
    prefix.push(buildGccPersonaLine(vocalGender));
  }

  return prefix.length > 0 ? `${prefix.join("\n")}\n${trimmed}` : trimmed;
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
    const trial = await checkAndConsumeTrialToken(supabaseService, user.id, 'music', 1);
    if (!trial.allowed) {
      return new Response(
        JSON.stringify({ error: 'TRIAL_LIMIT_REACHED', feature: 'music' }),
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
    const durationHint = typeof body?.duration_seconds === "number" ? body.duration_seconds : null;
    const { prompt: promptLimit, style: styleLimit } = getModelLimits(model);
    const isGccEffective = GCC_STYLE_MARKERS.test(style);
    const effectivePrompt = !instrumental && isGccEffective ? applyGccPromptShaping(prompt, vocalGender) : prompt;
    const effectiveNegativeTags = isGccEffective ? buildGccNegativeTags() : negativeTags;
    const effectiveWeirdnessConstraint = isGccEffective ? 0.55 : weirdnessConstraint;
    const effectiveAudioWeight = isGccEffective ? 0.65 : audioWeight;

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

    // Audit payload stored inside meta JSONB (no separate column needed)
    const requestPayload: Record<string, unknown> = {
      customMode, instrumental, model,
      prompt: effectivePrompt || null,
      style: style || null,
      title: title || null,
      negativeTags: effectiveNegativeTags || null,
      vocalGender: vocalGender || null,
      styleWeight: styleWeight ?? null,
      weirdnessConstraint: effectiveWeirdnessConstraint ?? null,
      audioWeight: effectiveAudioWeight ?? null,
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
            negativeTags: effectiveNegativeTags || null,
            vocalGender: vocalGender || null,
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
