import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const KIE_API_KEY = Deno.env.get("KIE_API_KEY") || "";
const KIE_CREATE_URL = "https://api.kie.ai/api/v1/jobs/createTask";
const KIE_STATUS_URL = "https://api.kie.ai/api/v1/jobs/recordInfo";
const KIE_VISUAL_ADS_MODEL = "gpt-image-2-image-to-image";

interface KieCreateResponse {
  code: number;
  msg?: string;
  message?: string;
  data?: { taskId: string };
}

interface KieStatusResponse {
  code: number;
  msg?: string;
  message?: string;
  data?: {
    taskId: string;
    state: string;
    resultJson?: string;
    failMsg?: string;
  };
}

interface TaskStatusData {
  task_id: string;
  status: string;
  generated?: string[];
  video?: { url: string };
  error?: string;
}

type VisualAdsSpecAsset = {
  source_id?: string | null;
  image_ref?: string | null;
  role?: string | null;
  custom_role?: string | null;
  person_mode?: string | null;
  pose_mode?: string | null;
  reference_style?: string | null;
  logo_mode?: string | null;
  screenshot_device?: string | null;
};

type VisualAdsSpec = {
  language?: string | null;
  aspect_ratio?: string | null;
  assets?: VisualAdsSpecAsset[];
  campaign?: {
    main_message_prompt?: string | null;
    main_message_custom_text?: string | null;
    main_message_detail_prompt?: string | null;
    feature_chips?: string[] | null;
    cta_text?: string | null;
  } | null;
  style?: {
    primary_style_prompt?: string | null;
    primary_style_custom_text?: string | null;
    style_detail_prompt?: string | null;
  } | null;
  composition?: {
    primary_subjects?: string[] | null;
    secondary_subjects?: string[] | null;
    background_source?: string | null;
    logo_source?: string | null;
  } | null;
};

type TrialFeatureKey =
  | "ai_chat"
  | "tasjeel"
  | "t2i"
  | "i2i"
  | "bg_removal"
  | "music"
  | "i2v"
  | "t2v"
  | "2i2v"
  | "compose"
  | "reply"
  | "diagrams"
  | "ppt"
  | "tts"
  | "translate"
  | "interpreter"
  | "voice_clone"
  | "ai_coder"
  | "ai_chatbot";

function sanitizeError(msg: string): string {
  return msg
    .replace(/KIE[\s.]*/gi, "")
    .replace(/grok[\s-]*/gi, "")
    .replace(/OpenAI[\s.]*/gi, "")
    .replace(/GPT[\s-]*/gi, "")
    .replace(/api\.kie\.ai[^\s]*/gi, "provider")
    .replace(/createTask\s*/gi, "")
    .replace(/^[:\s-]+/, "")
    .trim() || "Poster generation failed";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function sanitizeUserInput(raw: unknown, maxLength = 8000): string {
  if (raw == null) return "";
  let text = typeof raw === "string" ? raw : String(raw);
  text = Array.from(text).filter((char) => {
    const code = char.charCodeAt(0);
    if (code <= 8) return false;
    if (code === 11 || code === 12) return false;
    if (code >= 14 && code <= 31) return false;
    if (code >= 127 && code <= 159) return false;
    if (code >= 8203 && code <= 8205) return false;
    if (code === 8288 || code === 65279) return false;
    if (code >= 8234 && code <= 8238) return false;
    if (code >= 8294 && code <= 8297) return false;
    return true;
  }).join("");
  text = text.replace(/<\|\s*im_(start|end|sep)\s*\|>/gi, "[marker]");
  text = text.replace(/\n\n(Human|Assistant|System)\s*:/gi, "\n\n$1\u200b:");
  text = text.replace(/^(\s*)(system|assistant|developer|tool|function)\s*:/gim, "$1$2\u200b:");
  text = text.replace(/\b(ignore|disregard|forget)\s+(all|previous|above|the\s+above|prior)\s+(instructions?|rules?|prompts?)/gi, "[filtered directive]");
  text = text.replace(/\n{3,}/g, "\n\n");
  if (text.length > maxLength) {
    text = text.slice(0, maxLength);
  }
  return text.trim();
}

function asString(value: unknown, maxLength = 400): string {
  return sanitizeUserInput(value, maxLength);
}

function asStringArray(value: unknown, maxLength = 120): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const text = asString(item, maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function startCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getSourceKey(asset: VisualAdsSpecAsset, index: number): string {
  return asset.source_id || `SOURCE_${index + 1}`;
}

function getRoleLabel(asset: VisualAdsSpecAsset): string {
  const role = (asset.role || "").toLowerCase();
  if (role === "screenshot") return "App Screenshot";
  if (role === "background") return "Background";
  if (role === "logo") return "Logo";
  if (role === "person") return "Person";
  if (role === "product") return "Product";
  return asset.custom_role ? startCase(asset.custom_role) : (role ? startCase(role) : "Asset");
}

function getRolePurpose(spec: VisualAdsSpec, asset: VisualAdsSpecAsset, sourceKey: string): string {
  const primary = spec.composition?.primary_subjects || [];
  const secondary = spec.composition?.secondary_subjects || [];
  if (spec.composition?.background_source === sourceKey || (asset.role || "").toLowerCase() === "background") return "Foundation";
  if (primary.includes(sourceKey)) return "Primary Subject";
  if (secondary.includes(sourceKey)) return "Secondary Element";
  const role = (asset.role || "").toLowerCase();
  if (role === "logo") return "Secondary Element";
  if (role === "screenshot" || role === "person" || role === "product") return "Primary Subject";
  return "Supporting Element";
}

function getDeviceMockupLabel(device: string | null | undefined): string {
  switch ((device || "iphone").toLowerCase()) {
    case "samsung": return "realistic Samsung Galaxy device mockup";
    case "laptop": return "realistic laptop mockup";
    case "tablet": return "realistic tablet mockup";
    case "monitor-tv": return "realistic monitor / TV display mockup";
    case "billboard": return "realistic outdoor billboard mockup";
    default: return "realistic iPhone device mockup";
  }
}

function normalizeVisualAdsSpec(raw: unknown): VisualAdsSpec {
  const record = asRecord(raw) || {};
  const assetsRaw = Array.isArray(record.assets) ? record.assets : [];
  const campaign = asRecord(record.campaign);
  const style = asRecord(record.style);
  const composition = asRecord(record.composition);

  return {
    language: asString(record.language, 12) || "en",
    aspect_ratio: asString(record.aspect_ratio, 10) || "1:1",
    assets: assetsRaw
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((asset) => ({
        source_id: asString(asset.source_id, 60) || null,
        image_ref: asString(asset.image_ref, 60) || null,
        role: asString(asset.role, 60) || null,
        custom_role: asString(asset.custom_role, 60) || null,
        person_mode: asString(asset.person_mode, 60) || null,
        pose_mode: asString(asset.pose_mode, 60) || null,
        reference_style: asString(asset.reference_style, 60) || null,
        logo_mode: asString(asset.logo_mode, 60) || null,
        screenshot_device: asString(asset.screenshot_device, 60) || null,
      })),
    campaign: campaign ? {
      main_message_prompt: asString(campaign.main_message_prompt, 280) || null,
      main_message_custom_text: asString(campaign.main_message_custom_text, 120) || null,
      main_message_detail_prompt: asString(campaign.main_message_detail_prompt, 320) || null,
      feature_chips: asStringArray(campaign.feature_chips, 80),
      cta_text: asString(campaign.cta_text, 120) || null,
    } : null,
    style: style ? {
      primary_style_prompt: asString(style.primary_style_prompt, 260) || null,
      primary_style_custom_text: asString(style.primary_style_custom_text, 120) || null,
      style_detail_prompt: asString(style.style_detail_prompt, 260) || null,
    } : null,
    composition: composition ? {
      primary_subjects: asStringArray(composition.primary_subjects, 60),
      secondary_subjects: asStringArray(composition.secondary_subjects, 60),
      background_source: asString(composition.background_source, 60) || null,
      logo_source: asString(composition.logo_source, 60) || null,
    } : null,
  };
}

function compileVisualAdsPrompt(spec: VisualAdsSpec, legacyPrompt: string): string {
  const assets = spec.assets || [];
  if (!assets.length && legacyPrompt.trim()) return legacyPrompt.trim();

  const ratio = spec.aspect_ratio || "1:1";
  const campaignText = (spec.campaign?.main_message_custom_text || spec.campaign?.main_message_prompt || "").trim();
  const campaignDetail = (spec.campaign?.main_message_detail_prompt || "").trim();
  const featureChips = (spec.campaign?.feature_chips || []).filter(Boolean);
  const ctaText = (spec.campaign?.cta_text || "").trim();
  const styleText = (spec.style?.primary_style_custom_text || spec.style?.primary_style_prompt || "").trim();
  const styleDetail = (spec.style?.style_detail_prompt || "").trim();
  const hasScreenshot = assets.some((asset) => (asset.role || "").toLowerCase() === "screenshot");
  const hasBackground = assets.some((asset) => (asset.role || "").toLowerCase() === "background");
  const hasTransparentLogo = assets.some((asset) => (asset.role || "").toLowerCase() === "logo" && (asset.logo_mode || "").toLowerCase() === "transparent");
  const hasExactPerson = assets.some((asset) => (asset.role || "").toLowerCase() === "person" && (asset.person_mode || "exact").toLowerCase() !== "reference");
  const hasNewPosePerson = assets.some((asset) => (asset.role || "").toLowerCase() === "person" && (asset.person_mode || "exact").toLowerCase() !== "reference" && (asset.pose_mode || "same-pose").toLowerCase() === "adapted-pose");

  const lines: string[] = [
    `Create a high-end ${ratio} premium advertising poster with a unified, cinematic composition.`,
  ];

  if (campaignText) {
    lines.push(`Build the poster around this campaign direction: ${campaignText.replace(/[.!?]+$/g, "")}.`);
  }
  if (campaignDetail) {
    lines.push(campaignDetail);
  }
  lines.push("");
  lines.push("Use the provided images with strict role assignment:");
  lines.push("");

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const sourceKey = getSourceKey(asset, i);
    lines.push(`${sourceKey} → ${getRoleLabel(asset)} (${getRolePurpose(spec, asset, sourceKey)})`);
  }

  lines.push("");
  lines.push("Composition & Layout:");
  lines.push("");

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const sourceKey = getSourceKey(asset, i);
    const role = (asset.role || "").toLowerCase();

    if (role === "background") {
      lines.push(`Use ${sourceKey} as the actual full-scene background foundation of the final poster, preserving its identity while enhancing it with cinematic color grading, depth of field, and soft lighting.`);
      lines.push(`Composite the other uploaded assets into ${sourceKey}. Do not let any non-background upload replace this scene or become the main backdrop.`);
      continue;
    }

    if (role === "screenshot") {
      lines.push(`Place the app screenshot (${sourceKey}) inside a ${getDeviceMockupLabel(asset.screenshot_device)}, centered or slightly dominant in the frame.`);
      lines.push("The screenshot must remain 100% unchanged and readable with no UI edits, no distortion, and no fake redesign.");
      continue;
    }

    if (role === "logo") {
      if ((asset.logo_mode || "").toLowerCase() === "transparent") {
        lines.push(`Integrate the logo (${sourceKey}) as a clean transparent flat logo, preserving its exact shape and original colors, with no background, no box, no card, no drop shadow, and no halo around it.`);
      } else {
        lines.push(`Integrate the logo (${sourceKey}) naturally into the composition, preferably in a clean top or bottom placement, keeping it exactly as provided with no redesign, no recolor, and no distortion.`);
      }
      continue;
    }

    if (role === "person") {
      const personMode = (asset.person_mode || "exact").toLowerCase();
      if (personMode === "reference") {
        if ((asset.reference_style || "realistic").toLowerCase() === "character") {
          lines.push(`Use the person in ${sourceKey} as a reference and turn them into a styled character that still resembles them.`);
        } else {
          lines.push(`Use the person in ${sourceKey} as the identity reference for a realistic human subject in the final composition.`);
        }
      } else {
        const pose = (asset.pose_mode || "same-pose").toLowerCase();
        if (pose === "upper-body") {
          lines.push(`Use the exact same real individual from ${sourceKey} in a clear upper-body framing so the face stays large, readable, and unmistakable. Do not change the facial identity or swap them for a different-looking person.`);
        } else if (pose === "adapted-pose") {
          lines.push(`Use the exact same real individual from ${sourceKey}, preserving face, skin tone, body type, hair, and overall identity exactly.`);
          lines.push(`This is an explicit new-pose request for ${sourceKey}: create a clearly different natural pose for the final poster while keeping the exact same real person. Change the pose only, never the identity.`);
        } else {
          lines.push(`Use the exact same real individual from ${sourceKey}, not a similar-looking or upgraded version. Keep the closest possible pose and framing to the original. Do not reinterpret, beautify, or substitute the face.`);
        }
      }
      continue;
    }

    if (role === "product") {
      lines.push(hasScreenshot
        ? `Place ${sourceKey} as a complementary product element supporting the screenshot.`
        : `Make ${sourceKey} the hero product element with premium scale, clean lighting, and polished presentation.`);
      continue;
    }

    if (asset.custom_role) {
      lines.push(`Use ${sourceKey} as a ${asset.custom_role} element integrated naturally into the composition.`);
    } else {
      lines.push(`Use ${sourceKey} as a supporting element integrated naturally into the composition.`);
    }
  }

  if (featureChips.length > 0) {
    lines.push("Add subtle floating testimonial-style quote bubbles or premium feature cards around the main subject to create a sense of social proof.");
  }

  lines.push("");
  lines.push("Allowed Text ONLY:");
  lines.push("");
  const allowedText = ctaText ? [ctaText, ...featureChips.filter((chip) => chip !== ctaText)] : featureChips;
  if (allowedText.length) {
    for (const item of allowedText) lines.push(`\"${item}\"`);
  } else {
    lines.push("No extra on-poster text beyond what is already approved in the brief.");
  }

  lines.push("");
  lines.push("Style & Mood:");
  lines.push("");
  if (styleText) {
    for (const part of styleText.split(",").map((item) => item.trim()).filter(Boolean)) {
      const cleaned = part.replace(/[.!?]+$/g, "");
      lines.push(cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
    }
  }
  if (styleDetail) {
    lines.push(styleDetail);
  }
  if (!styleText && !styleDetail) {
    lines.push("Premium polished advertising quality");
    lines.push("Clean visual hierarchy");
    lines.push("Luxury-level production finish");
  }

  if (ctaText) {
    lines.push("");
    lines.push("Call to Action:");
    lines.push("");
    lines.push(`Display \"${ctaText}\" clearly and prominently as the main call to action (button or highlighted text).`);
  }

  lines.push("");
  lines.push("Strict Rules:");
  lines.push("");
  lines.push("Do NOT add any extra text beyond the allowed phrases listed above.");
  lines.push("Do NOT invent names, headlines, taglines, or brand copy.");
  lines.push("Do NOT invent testimonials, ratings, reviews, or social proof copy.");
  if (hasScreenshot) lines.push("Do NOT modify the screenshot UI.");
  if (hasTransparentLogo) {
    lines.push("Do NOT place the logo inside a background box, card, frame, or shape — it must stay transparent and flat.");
    lines.push("Do NOT add shadows, glow, halo, or 3D effects behind the logo.");
  }
  if (hasBackground) {
    lines.push("Do NOT change the core identity of the background.");
    lines.push("The approved background image must remain the real base scene of the poster. Do NOT swap it for a different location, room, skyline, texture, or backdrop.");
    lines.push("Do NOT keep or import the original background from non-background uploads into the final scene unless that upload was explicitly tagged as Background.");
  }
  if (hasExactPerson) lines.push("Do NOT replace the real person with a different face, body, or identity.");
  if (hasNewPosePerson) lines.push("For any person tagged as New pose, you must create a clearly new pose while preserving the exact same real person. Do NOT keep the original pose if the brief asks for a new one.");
  if (featureChips.length > 0) lines.push("Use the approved key points exactly as written without renaming, paraphrasing, or substituting them.");
  if (hasExactPerson && hasScreenshot) lines.push("Keep the face clearly visible. The device mockup must not block the face.");
  lines.push("Keep everything sharp, high-resolution, realistic, and production-ready.");

  lines.push("");
  lines.push("Output:");
  lines.push("");
  lines.push("One single cohesive poster");
  lines.push(`Aspect ratio: ${ratio}`);
  lines.push("Ultra clean, premium, production-ready quality");

  return lines.join("\n").trim();
}

function sanitizeImageUrl(url: string): string {
  let cleaned = url.trim();
  if (cleaned.startsWith("%20")) cleaned = cleaned.replace(/^%20+/, "");
  return cleaned.trim();
}

function parseDataUriImage(dataUri: string): { contentType: string; bytes: Uint8Array } {
  const match = dataUri.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.*)$/);
  if (!match) throw new Error("Invalid image data URI");
  const contentType = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { contentType, bytes };
}

async function uploadImageDataUriToSignedUrl(serviceClient: any, userId: string, dataUri: string): Promise<string> {
  const { contentType, bytes } = parseDataUriImage(dataUri);
  const ext = contentType.split("/")[1] || "png";
  const path = `${userId}/visual-ads-input/${crypto.randomUUID()}.${ext}`;
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: contentType });

  const { error: uploadError } = await serviceClient.storage
    .from("message_attachments")
    .upload(path, blob, { contentType, cacheControl: "3600", upsert: true });
  if (uploadError) throw new Error(uploadError.message || "Failed to upload image");

  const { data, error } = await serviceClient.storage
    .from("message_attachments")
    .createSignedUrl(path, 60 * 60 * 6);
  if (error) throw new Error(error.message || "Failed to create signed URL");
  if (!data?.signedUrl) throw new Error("Failed to get signed URL");
  return data.signedUrl;
}

function mapKieState(state: string): string {
  switch ((state || "").toLowerCase()) {
    case "success":
    case "completed":
    case "succeeded":
      return "COMPLETED";
    case "fail":
    case "failed":
    case "error":
      return "FAILED";
    case "waiting":
    case "queuing":
      return "IN_QUEUE";
    default:
      return "IN_PROGRESS";
  }
}

async function rehostResultUrls(serviceClient: any, taskId: string, urls: string[]): Promise<string[]> {
  const finalUrls: string[] = [];
  for (const url of urls) {
    try {
      if (url.includes("supabase.co")) {
        finalUrls.push(url);
        continue;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${res.status}`);
      const blob = await res.blob();
      const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : blob.type.includes("jpg") || blob.type.includes("jpeg") ? "jpg" : "png";
      const fileName = `kie-results/${taskId}-${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await serviceClient.storage
        .from("generated-images")
        .upload(fileName, blob, { contentType: blob.type || "image/png" });
      if (uploadErr) throw uploadErr;
      const { data } = serviceClient.storage.from("generated-images").getPublicUrl(fileName);
      if (!data?.publicUrl) throw new Error("Missing public URL");
      finalUrls.push(data.publicUrl);
    } catch {
      finalUrls.push(url);
    }
  }
  return finalUrls;
}

async function persistVisualAdsCompletion(serviceClient: any, taskId: string, userId: string, status: string, resultUrls: string[], errorMsg: string | null) {
  const updatePayload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (resultUrls.length) updatePayload.result_urls = resultUrls;
  if (errorMsg) updatePayload.error_msg = errorMsg;

  await serviceClient
    .from("visual_ads_jobs")
    .update(updatePayload)
    .eq("task_id", taskId)
    .eq("user_id", userId);

  if (status !== "COMPLETED" || !resultUrls.length) return;

  for (const [resultIndex, url] of resultUrls.entries()) {
    const { data: existing } = await serviceClient
      .from("user_generated_images")
      .select("id")
      .eq("user_id", userId)
      .contains("meta", { visual_ads_task_id: taskId, visual_ads_result_index: resultIndex })
      .maybeSingle();

    if (existing) continue;

    const storagePath = url.split("/generated-images/")[1];
    await serviceClient.from("user_generated_images").insert({
      user_id: userId,
      image_url: url,
      submode: "visual-ads",
      quality: KIE_VISUAL_ADS_MODEL,
      meta: {
        storage_path: storagePath ? decodeURIComponent(storagePath) : null,
        visual_ads_task_id: taskId,
        visual_ads_result_index: resultIndex,
      },
    });
  }
}

async function getTaskStatus(taskId: string, serviceClient?: any, userId?: string): Promise<TaskStatusData> {
  const statusRes = await fetch(`${KIE_STATUS_URL}?taskId=${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${KIE_API_KEY}` },
  });

  if (!statusRes.ok) {
    const errorText = await statusRes.text();
    throw new Error(`Poster status check error ${statusRes.status}: ${errorText}`);
  }

  const statusData: KieStatusResponse = await statusRes.json();
  if (statusData.code !== 200 || !statusData.data) {
    throw new Error(sanitizeError(statusData.msg || statusData.message || "Failed to get status"));
  }

  const mappedStatus = mapKieState(statusData.data.state || "");
  if (mappedStatus === "FAILED") {
    if (serviceClient && userId) {
      await persistVisualAdsCompletion(serviceClient, taskId, userId, "FAILED", [], statusData.data.failMsg || "Poster generation failed");
    }
    return {
      task_id: taskId,
      status: "FAILED",
      error: statusData.data.failMsg || "Poster generation failed",
    };
  }

  if (mappedStatus === "COMPLETED") {
    let generated: string[] = [];
    try {
      const parsed = statusData.data.resultJson ? JSON.parse(statusData.data.resultJson) : {};
      const directUrls = Array.isArray(parsed?.resultUrls)
        ? parsed.resultUrls.filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
        : [];
      generated = serviceClient ? await rehostResultUrls(serviceClient, taskId, directUrls) : directUrls;
    } catch {
      generated = [];
    }

    if (serviceClient && userId) {
      await persistVisualAdsCompletion(serviceClient, taskId, userId, "COMPLETED", generated, generated.length ? null : "Poster completed but no image URL returned");
    }

    return {
      task_id: taskId,
      status: "COMPLETED",
      generated,
      video: generated[0] ? { url: generated[0] } : undefined,
      error: generated.length ? undefined : "Poster completed but no image URL returned",
    };
  }

  return {
    task_id: taskId,
    status: mappedStatus,
  };
}

async function checkAndConsumeTrialToken(serviceClient: any, userId: string, featureKey: TrialFeatureKey, maxLimit: number): Promise<boolean> {
  const { data: profile, error: fetchError } = await serviceClient
    .from("profiles")
    .select("trial_usage, is_subscribed, payment_method, next_billing_date, admin_gifted, free_access_start_at")
    .eq("id", userId)
    .single();

  if (fetchError || !profile) return false;

  const isPaid = profile.is_subscribed === true;
  const isGifted = profile.admin_gifted === true;
  const pm = profile.payment_method;
  const hasRealPaymentMethod = pm != null && typeof pm === "string" && pm.trim().length > 0 && pm !== "manual";
  const isActiveSubscriber = hasRealPaymentMethod && profile.next_billing_date != null && new Date(profile.next_billing_date as string) > new Date();
  const isOn24hTrial = profile.free_access_start_at != null;

  if (isPaid || isActiveSubscriber || isGifted || !isOn24hTrial) return true;

  const usage: Record<string, number> = (profile.trial_usage as Record<string, number> | null) ?? {};
  const current = typeof usage[featureKey] === "number" ? usage[featureKey] : 0;
  if (current >= maxLimit) return false;

  const { error: updateError } = await serviceClient
    .from("profiles")
    .update({ trial_usage: { ...usage, [featureKey]: current + 1 } })
    .eq("id", userId);

  return !updateError;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const authedDb: any = authedClient;
    const serviceDb: any = serviceClient;

    const { data: { user }, error: authError } = await authedClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const mode = typeof body?.mode === "string" ? body.mode : "async";

    if (mode === "status") {
      const taskId = typeof body?.task_id === "string" ? body.task_id : "";
      if (!taskId) {
        return new Response(JSON.stringify({ error: "Missing task_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const status = await getTaskStatus(taskId, serviceDb, user.id);
      return new Response(JSON.stringify({ ok: true, data: status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trialAllowed = await checkAndConsumeTrialToken(serviceDb, user.id, "i2v", 1);
    if (!trialAllowed) {
      return new Response(JSON.stringify({ error: "TRIAL_LIMIT_REACHED", feature: "i2v" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: quotaCheck, error: quotaError } = await authedDb.rpc("can_generate_ai_video", {
      p_user_id: user.id,
    });
    if (quotaError) {
      return new Response(JSON.stringify({ error: "Failed to check quota" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const quota = quotaCheck?.[0] || quotaCheck;
    if (!quota?.can_generate) {
      return new Response(JSON.stringify({
        error: "Monthly AI video limit reached",
        quota: {
          used: quota?.videos_generated || 0,
          limit: quota?.videos_limit || 60,
          extra: quota?.extra_videos || 0,
        },
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageList = Array.isArray(body?.images)
      ? body.images.filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
      : [];
    const fallbackUrls = Array.isArray(body?.input_urls)
      ? body.input_urls.filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
      : [];
    const fallbackUploaded = Array.isArray(body?.uploaded_images)
      ? body.uploaded_images.filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
      : [];
    const rawImages = imageList.length ? imageList : [...fallbackUrls, ...fallbackUploaded];

    if (!rawImages.length) {
      return new Response(JSON.stringify({ error: "Missing images for visual ads" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rawImages.length > 14) {
      return new Response(JSON.stringify({ error: "visual_ads supports a maximum of 14 images" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageUrls: string[] = [];
    for (const rawImage of rawImages) {
      if (rawImage.startsWith("data:image/")) {
        imageUrls.push(await uploadImageDataUriToSignedUrl(serviceDb, user.id, rawImage));
      } else {
        imageUrls.push(sanitizeImageUrl(rawImage));
      }
    }

    const spec = normalizeVisualAdsSpec(body?.visual_ads_spec);
    const legacyPrompt = typeof body?.prompt === "string" ? sanitizeUserInput(body.prompt, 7000) : "";
    const finalPrompt = compileVisualAdsPrompt(spec, legacyPrompt);
    const aspectRatio = ["1:1", "16:9", "9:16"].includes(body?.aspect_ratio || "") ? body.aspect_ratio : (spec.aspect_ratio || "1:1");
    const callbackUrl = `${supabaseUrl}/functions/v1/webhook-visual-ads`;

    const requestBody = {
      model: KIE_VISUAL_ADS_MODEL,
      input: {
        prompt: finalPrompt,
        input_urls: imageUrls,
        image_urls: imageUrls,
        aspect_ratio: aspectRatio,
        resolution: "1K",
      },
      callBackUrl: callbackUrl,
      callbackUrl,
      callback_url: callbackUrl,
    };

    console.log("[freepik-visual-ads] Final prompt:\n" + finalPrompt);
    console.log("[freepik-visual-ads] KIE create payload:", JSON.stringify(requestBody));

    const createRes = await fetch(KIE_CREATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${KIE_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      throw new Error(`Visual ads generation service error ${createRes.status}: ${errorText}`);
    }

    const createData: KieCreateResponse = await createRes.json();
    if (createData.code !== 200 || !createData.data?.taskId) {
      throw new Error(sanitizeError(createData.msg || createData.message || "Failed to create task"));
    }

    await serviceDb.from("visual_ads_jobs").insert({
      user_id: user.id,
      task_id: createData.data.taskId,
      status: "waiting",
    });

    return new Response(JSON.stringify({
      ok: true,
      task_id: createData.data.taskId,
      status: "waiting",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[freepik-visual-ads] Error:", rawMsg);
    return new Response(JSON.stringify({ error: sanitizeError(rawMsg) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
