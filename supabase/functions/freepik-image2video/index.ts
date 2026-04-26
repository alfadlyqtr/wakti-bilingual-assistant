import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIFromRequest } from "../_shared/aiLogger.ts";
import { checkAndConsumeTrialToken, type TrialFeatureKey } from "../_shared/trial-tracker.ts";
import { sanitizeUserInput } from "../_shared/promptSafety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================================
// Video generation provider config
// ============================================================

// Strip provider names from errors before sending to client
function sanitizeError(msg: string): string {
  return msg
    .replace(/KIE[\s.]*/gi, '')
    .replace(/grok[\s-]*/gi, '')
    .replace(/Shotstack[\s.]*/gi, '')
    .replace(/OpenAI[\s.]*/gi, '')
    .replace(/GPT[\s-]*/gi, '')
    .replace(/api\.kie\.ai[^\s]*/gi, 'provider')
    .replace(/createTask\s*/gi, '')
    .replace(/^[:\s-]+/, '')
    .trim() || 'Video generation failed';
}

type VisualAdsJobInsertClient = {
  from: (table: "visual_ads_jobs") => {
    insert: (values: { user_id: string; task_id: string; status: string }) => Promise<{ error: { message: string } | null }>;
  };
};
const KIE_API_KEY = Deno.env.get("KIE_API_KEY") || "";
const KIE_IMAGE2VIDEO_MODEL = "grok-imagine/image-to-video";
const KIE_TEXT2VIDEO_MODEL = "grok-imagine/text-to-video";
const KIE_2IMAGES_MODEL = "bytedance/seedance-1.5-pro";
const KIE_VISUAL_ADS_MODEL = "gpt-image-2-image-to-image";
const KIE_CREATE_URL = "https://api.kie.ai/api/v1/jobs/createTask";
const KIE_STATUS_URL = "https://api.kie.ai/api/v1/jobs/recordInfo";

// Poll interval and max attempts
const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_POLL_ATTEMPTS = 72; // 6 minutes max (KIE can take a bit longer)

// KIE.ai response types
interface KieCreateResponse {
  code: number;
  msg?: string;
  message?: string;
  data?: {
    taskId: string;
  };
}

interface KieStatusResponse {
  code: number;
  msg?: string;
  message?: string;
  data?: {
    taskId: string;
    model: string;
    state: string; // waiting, queuing, generating, success, fail
    param?: string;
    resultJson?: string; // JSON string: {"resultUrls":["https://..."]}
    failCode?: string;
    failMsg?: string;
    costTime?: number;
    completeTime?: number;
    createTime?: number;
  };
}

// Unified status shape expected by frontend
interface TaskStatusData {
  task_id: string;
  status: string;
  generated?: string[];
  video?: { url: string };
  error?: string;
}

type StorageBucketClient = {
  upload: (
    path: string,
    body: Blob,
    options: { contentType: string; cacheControl?: string; upsert?: boolean }
  ) => Promise<{ error?: { message?: string } | null }>;
  getPublicUrl: (path: string) => { data?: { publicUrl?: string } };
  createSignedUrl: (
    path: string,
    expiresIn: number
  ) => Promise<{ data?: { signedUrl?: string } | null; error?: { message?: string } | null }>;
};

type StorageClient = {
  storage: {
    from: (bucket: string) => StorageBucketClient;
  };
};

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
  objective?: string | null;
  assets?: VisualAdsSpecAsset[];
  campaign?: {
    main_message_id?: string | null;
    main_message_prompt?: string | null;
    main_message_custom_text?: string | null;
    main_message_detail_id?: string | null;
    main_message_detail_prompt?: string | null;
    feature_chips?: string[] | null;
    require_exact_feature_chips?: boolean | null;
    cta_id?: string | null;
    cta_text?: string | null;
    cta_prompt?: string | null;
  } | null;
  style?: {
    primary_style_id?: string | null;
    primary_style_prompt?: string | null;
    primary_style_custom_text?: string | null;
    style_detail_id?: string | null;
    style_detail_prompt?: string | null;
  } | null;
  composition?: {
    layout_type?: string | null;
    primary_subjects?: string[] | null;
    secondary_subjects?: string[] | null;
    background_source?: string | null;
    logo_source?: string | null;
    face_must_remain_visible?: boolean | null;
    device_must_not_block_face?: boolean | null;
    must_feel_unified?: boolean | null;
  } | null;
  text_policy?: {
    allowed_text?: string[] | null;
    allowed_feature_labels?: string[] | null;
    allow_generated_headline?: boolean | null;
    allow_generated_tagline?: boolean | null;
    allow_generated_social_proof_copy?: boolean | null;
    allow_generated_testimonials?: boolean | null;
  } | null;
  hard_constraints?: {
    must_follow_tagged_roles?: boolean | null;
    must_preserve_exact_person_identity?: boolean | null;
    must_preserve_logo_fidelity?: boolean | null;
    must_preserve_screenshot_fidelity?: boolean | null;
    must_preserve_background_identity?: boolean | null;
    allow_invented_text?: boolean | null;
    allow_invented_names?: boolean | null;
    allow_invented_testimonials?: boolean | null;
    hard_constraints_override_style?: boolean | null;
    priority_order?: string[] | null;
  } | null;
  legacy_prompt?: string | null;
};

type VisualAdsPromptTemplate = {
  prompt: string[];
  role_assignments: string[];
  composition_and_layout: string[];
  allowed_text: string[];
  style_and_mood: string[];
  call_to_action: string[];
  strict_rules: string[];
  output: string[];
};

type VisualAdsCompiledPrompt = {
  final_prompt: string;
  source: "template_compiler";
};

const VISUAL_ADS_PROMPT_ENGINEER_SOURCE = "template_compiler";

function asString(value: unknown, maxLength = 400): string {
  if (typeof value !== "string") return "";
  return sanitizeUserInput(value, { maxLength, label: "visual_ads_spec" }).trim();
}

function asStringArray(value: unknown, maxLength = 200): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item, maxLength))
    .filter((item, index, arr) => item.length > 0 && arr.indexOf(item) === index);
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeVisualAdsSpec(raw: unknown, legacyPrompt: string): VisualAdsSpec {
  const record = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};

  const assets = Array.isArray(record.assets)
    ? record.assets
      .filter((item) => item && typeof item === "object" && !Array.isArray(item))
      .map((item) => {
        const asset = item as Record<string, unknown>;
        return {
          source_id: asString(asset.source_id, 60) || null,
          image_ref: asString(asset.image_ref, 60) || null,
          role: asString(asset.role, 60) || null,
          custom_role: asString(asset.custom_role, 60) || null,
          person_mode: asString(asset.person_mode, 60) || null,
          pose_mode: asString(asset.pose_mode, 60) || null,
          reference_style: asString(asset.reference_style, 60) || null,
          logo_mode: asString(asset.logo_mode, 60) || null,
          screenshot_device: asString(asset.screenshot_device, 60) || null,
        } satisfies VisualAdsSpecAsset;
      })
    : [];

  const campaign = record.campaign && typeof record.campaign === "object" && !Array.isArray(record.campaign)
    ? record.campaign as Record<string, unknown>
    : null;
  const style = record.style && typeof record.style === "object" && !Array.isArray(record.style)
    ? record.style as Record<string, unknown>
    : null;
  const composition = record.composition && typeof record.composition === "object" && !Array.isArray(record.composition)
    ? record.composition as Record<string, unknown>
    : null;
  const textPolicy = record.text_policy && typeof record.text_policy === "object" && !Array.isArray(record.text_policy)
    ? record.text_policy as Record<string, unknown>
    : null;
  const hardConstraints = record.hard_constraints && typeof record.hard_constraints === "object" && !Array.isArray(record.hard_constraints)
    ? record.hard_constraints as Record<string, unknown>
    : null;

  return {
    language: asString(record.language, 12) || "en",
    aspect_ratio: asString(record.aspect_ratio, 10) || "9:16",
    objective: asString(record.objective, 120) || null,
    assets,
    campaign: campaign ? {
      main_message_id: asString(campaign.main_message_id, 80) || null,
      main_message_prompt: asString(campaign.main_message_prompt, 280) || null,
      main_message_custom_text: asString(campaign.main_message_custom_text, 120) || null,
      main_message_detail_id: asString(campaign.main_message_detail_id, 80) || null,
      main_message_detail_prompt: asString(campaign.main_message_detail_prompt, 320) || null,
      feature_chips: asStringArray(campaign.feature_chips, 80),
      require_exact_feature_chips: asBoolean(campaign.require_exact_feature_chips),
      cta_id: asString(campaign.cta_id, 80) || null,
      cta_text: asString(campaign.cta_text, 80) || null,
      cta_prompt: asString(campaign.cta_prompt, 120) || null,
    } : null,
    style: style ? {
      primary_style_id: asString(style.primary_style_id, 80) || null,
      primary_style_prompt: asString(style.primary_style_prompt, 260) || null,
      primary_style_custom_text: asString(style.primary_style_custom_text, 120) || null,
      style_detail_id: asString(style.style_detail_id, 80) || null,
      style_detail_prompt: asString(style.style_detail_prompt, 260) || null,
    } : null,
    composition: composition ? {
      layout_type: asString(composition.layout_type, 80) || null,
      primary_subjects: asStringArray(composition.primary_subjects, 80),
      secondary_subjects: asStringArray(composition.secondary_subjects, 80),
      background_source: asString(composition.background_source, 60) || null,
      logo_source: asString(composition.logo_source, 60) || null,
      face_must_remain_visible: asBoolean(composition.face_must_remain_visible),
      device_must_not_block_face: asBoolean(composition.device_must_not_block_face),
      must_feel_unified: asBoolean(composition.must_feel_unified, true),
    } : null,
    text_policy: textPolicy ? {
      allowed_text: asStringArray(textPolicy.allowed_text, 120),
      allowed_feature_labels: asStringArray(textPolicy.allowed_feature_labels, 80),
      allow_generated_headline: asBoolean(textPolicy.allow_generated_headline),
      allow_generated_tagline: asBoolean(textPolicy.allow_generated_tagline),
      allow_generated_social_proof_copy: asBoolean(textPolicy.allow_generated_social_proof_copy),
      allow_generated_testimonials: asBoolean(textPolicy.allow_generated_testimonials),
    } : null,
    hard_constraints: hardConstraints ? {
      must_follow_tagged_roles: asBoolean(hardConstraints.must_follow_tagged_roles, true),
      must_preserve_exact_person_identity: asBoolean(hardConstraints.must_preserve_exact_person_identity),
      must_preserve_logo_fidelity: asBoolean(hardConstraints.must_preserve_logo_fidelity),
      must_preserve_screenshot_fidelity: asBoolean(hardConstraints.must_preserve_screenshot_fidelity),
      must_preserve_background_identity: asBoolean(hardConstraints.must_preserve_background_identity),
      allow_invented_text: asBoolean(hardConstraints.allow_invented_text),
      allow_invented_names: asBoolean(hardConstraints.allow_invented_names),
      allow_invented_testimonials: asBoolean(hardConstraints.allow_invented_testimonials),
      hard_constraints_override_style: asBoolean(hardConstraints.hard_constraints_override_style, true),
      priority_order: asStringArray(hardConstraints.priority_order, 80),
    } : null,
    legacy_prompt: asString(record.legacy_prompt ?? legacyPrompt, 7000) || asString(legacyPrompt, 7000) || null,
  };
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = (value || "").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function humanizeToken(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function startCase(value: string): string {
  return humanizeToken(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function ensureSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
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
  if (role === "icon") return "Icon";
  if (role === "mascot") return "Mascot";
  if (role === "illustration") return "Illustration";
  if (role === "texture") return "Texture";
  if (role === "prop") return "Prop";
  return asset.custom_role ? startCase(asset.custom_role) : (role ? startCase(role) : "Asset");
}

function getRolePurpose(spec: VisualAdsSpec, asset: VisualAdsSpecAsset, sourceKey: string): string | null {
  const primary = spec.composition?.primary_subjects || [];
  const secondary = spec.composition?.secondary_subjects || [];
  if (spec.composition?.background_source === sourceKey || (asset.role || "").toLowerCase() === "background") return "Foundation";
  if (primary.includes(sourceKey)) return "Primary Subject";
  if (secondary.includes(sourceKey)) return "Secondary Element";
  const role = (asset.role || "").toLowerCase();
  if (role === "logo") return "Secondary Element";
  if (role === "screenshot" || role === "person" || role === "product") return "Primary Subject";
  return null;
}

function findAsset(spec: VisualAdsSpec, role: string): { asset: VisualAdsSpecAsset; index: number } | null {
  const assets = spec.assets || [];
  const index = assets.findIndex((asset) => (asset.role || "").toLowerCase() === role);
  if (index === -1) return null;
  return { asset: assets[index], index };
}

function getAllowedText(spec: VisualAdsSpec): string[] {
  return dedupeStrings([
    ...(spec.text_policy?.allowed_text || []),
    ...(spec.campaign?.feature_chips || []),
    ...(spec.text_policy?.allowed_feature_labels || []),
  ]);
}

function buildVisualAdsPromptTemplate(spec: VisualAdsSpec): VisualAdsPromptTemplate {
  const assets = spec.assets || [];
  const allowedText = getAllowedText(spec);
  const screenshot = findAsset(spec, "screenshot");
  const background = findAsset(spec, "background");
  const logo = findAsset(spec, "logo");
  const person = findAsset(spec, "person");
  const product = findAsset(spec, "product");

  const campaignDirection = dedupeStrings([
    spec.campaign?.main_message_prompt || null,
    spec.campaign?.main_message_detail_prompt || null,
    spec.campaign?.main_message_custom_text || null,
  ]);
  const styleDirection = dedupeStrings([
    spec.style?.primary_style_prompt || null,
    spec.style?.style_detail_prompt || null,
    spec.style?.primary_style_custom_text || null,
  ]);

  const promptLines = [
    `Create a high-end ${spec.aspect_ratio || "9:16"} premium advertising poster with a unified, cinematic composition.`,
    ...campaignDirection.length
      ? [`Build the poster around this campaign direction: ${campaignDirection.map((item) => item.replace(/[.!?]+$/g, "")).join(" ")}.`]
      : [],
    ...(spec.objective ? [`Business objective: ${ensureSentence(spec.objective)}`] : []),
  ];

  const roleAssignments = assets.map((asset, index) => {
    const sourceKey = getSourceKey(asset, index);
    const roleLabel = getRoleLabel(asset);
    const rolePurpose = getRolePurpose(spec, asset, sourceKey);
    return `${sourceKey} → ${roleLabel}${rolePurpose ? ` (${rolePurpose})` : ""}`;
  });

  const compositionLines = dedupeStrings([
    ...(screenshot ? [
      `Place the app screenshot (${getSourceKey(screenshot.asset, screenshot.index)}) inside a realistic ${startCase(screenshot.asset.screenshot_device || "iphone")} device mockup, centered or slightly dominant in the frame.`,
      `The screenshot must remain 100% unchanged and readable with no UI edits, no distortion, and no fake redesign.`,
    ] : []),
    ...(background ? [
      `Use ${getSourceKey(background.asset, background.index)} as the full background foundation, preserving its identity while enhancing it with cinematic color grading, depth of field, and soft lighting effects.`,
    ] : []),
    ...(logo ? [
      `Integrate the logo (${getSourceKey(logo.asset, logo.index)}) naturally into the composition, preferably in a clean top or bottom placement, keeping it exactly as provided with no redesign, no recolor, and no distortion.`,
    ] : []),
    ...(person ? [
      person.asset.person_mode === "reference"
        ? `Use the person in ${getSourceKey(person.asset, person.index)} as the identity reference and keep the final subject realistic, faithful, and recognizable.`
        : `Keep the real person from ${getSourceKey(person.asset, person.index)} as the same exact subject in the final composition, preserving identity, face, skin tone, and realism.`,
    ] : []),
    ...(product && !screenshot ? [
      `Make ${getSourceKey(product.asset, product.index)} the hero product element with premium scale, clean lighting, and polished presentation.`,
    ] : []),
    ...(allowedText.length ? [`If approved text is used in the poster, present it as clean callouts, quote bubbles, premium cards, or polished text placements with strong readability.`] : []),
    ...(spec.composition?.layout_type ? [`Use a ${humanizeToken(spec.composition.layout_type)} layout with clear advertising hierarchy and strong visual balance.`] : []),
    ...(spec.composition?.must_feel_unified ? [`The entire poster must feel like one cohesive premium composition, not a messy collage.`] : []),
  ]);

  const styleLines = dedupeStrings([
    ...styleDirection,
    ...(styleDirection.length ? [] : ["Premium polished advertising quality", "Clean visual hierarchy", "Luxury-level production finish"]),
  ]).map((item) => item.replace(/[.!?]+$/g, ""));

  const ctaText = spec.campaign?.cta_text || spec.text_policy?.allowed_text?.[0] || null;
  const callToActionLines = ctaText
    ? [`Display "${ctaText}" clearly and prominently as the main call to action.`]
    : ["Keep the call to action clear, premium, and visually intentional."];

  const strictRules = dedupeStrings([
    spec.hard_constraints?.allow_invented_text === false || allowedText.length
      ? "Do NOT add any extra text beyond the allowed phrases."
      : null,
    spec.hard_constraints?.allow_invented_names === false || spec.text_policy?.allow_generated_headline === false || spec.text_policy?.allow_generated_tagline === false
      ? "Do NOT invent names, headlines, or taglines."
      : null,
    spec.hard_constraints?.allow_invented_testimonials === false || spec.text_policy?.allow_generated_testimonials === false || spec.text_policy?.allow_generated_social_proof_copy === false
      ? "Do NOT invent testimonials, ratings, or social proof copy."
      : null,
    spec.hard_constraints?.must_preserve_screenshot_fidelity
      ? "Do NOT modify the screenshot UI."
      : null,
    spec.hard_constraints?.must_preserve_logo_fidelity
      ? "Do NOT alter the logo."
      : null,
    spec.hard_constraints?.must_preserve_background_identity
      ? "Do NOT change the core identity of the background."
      : null,
    spec.hard_constraints?.must_preserve_exact_person_identity
      ? "Do NOT replace the real person with a different face, body, or identity."
      : null,
    spec.campaign?.require_exact_feature_chips && (spec.campaign.feature_chips || []).length
      ? "Use the approved key points exactly as written without renaming, paraphrasing, or substituting them."
      : null,
    spec.composition?.face_must_remain_visible
      ? "Keep the face clearly visible in the final composition."
      : null,
    spec.composition?.device_must_not_block_face
      ? "The device mockup must not block the face."
      : null,
    "Keep everything sharp, high-resolution, realistic, and production-ready.",
  ]);

  const outputLines = [
    "One single cohesive poster",
    `Aspect ratio: ${spec.aspect_ratio || "9:16"}`,
    "Ultra clean, premium, production-ready quality",
  ];

  return {
    prompt: promptLines,
    role_assignments: roleAssignments,
    composition_and_layout: compositionLines,
    allowed_text: allowedText,
    style_and_mood: styleLines,
    call_to_action: callToActionLines,
    strict_rules: strictRules,
    output: outputLines,
  };
}

function buildVisualAdsPromptText(template: VisualAdsPromptTemplate): string {
  return [
    "Prompt:",
    "",
    ...template.prompt,
    "",
    "Use the provided images with strict role assignment:",
    "",
    ...template.role_assignments,
    "",
    "Composition & Layout:",
    "",
    ...template.composition_and_layout,
    "",
    "Allowed Text ONLY:",
    "",
    ...(template.allowed_text.length
      ? template.allowed_text.map((item) => `\"${item}\"`)
      : ["No extra on-poster text beyond what is already approved in the brief."]),
    "",
    "Style & Mood:",
    "",
    ...template.style_and_mood,
    "",
    "Call to Action:",
    "",
    ...template.call_to_action,
    "",
    "Strict Rules:",
    "",
    ...template.strict_rules,
    "",
    "Output:",
    "",
    ...template.output,
  ].join("\n").trim();
}

function compileVisualAdsPrompt(rawSpec: unknown, legacyPrompt: string): VisualAdsCompiledPrompt {
  const spec = normalizeVisualAdsSpec(rawSpec, legacyPrompt);
  const template = buildVisualAdsPromptTemplate(spec);
  console.log(`[kie-visual-ads] Prompt engineer source: ${VISUAL_ADS_PROMPT_ENGINEER_SOURCE}`);
  return {
    final_prompt: buildVisualAdsPromptText(template),
    source: VISUAL_ADS_PROMPT_ENGINEER_SOURCE,
  };
}

function sanitizeImageUrl(url: string): string {
  let cleaned = url.trim();
  if (cleaned.startsWith("%20")) {
    cleaned = cleaned.replace(/^%20+/, "");
  }
  return cleaned.trim();
}

function parseDataUriImage(dataUri: string): { contentType: string; bytes: Uint8Array } {
  const match = dataUri.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.*)$/);
  if (!match) throw new Error("Invalid image data URI");
  const contentType = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const bytes: Uint8Array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { contentType, bytes };
}

async function uploadImageDataUriToPublicUrl(
  supabase: StorageClient,
  userId: string,
  dataUri: string
): Promise<string> {
  const { contentType, bytes } = parseDataUriImage(dataUri);
  const ext = contentType.split("/")[1] || "png";
  const path = `${userId}/ai-video-input/${crypto.randomUUID()}.${ext}`;
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: contentType });

  const { error: uploadError } = await supabase.storage
    .from("message_attachments")
    .upload(path, blob, { contentType, cacheControl: "3600", upsert: true });

  if (uploadError) throw new Error(uploadError.message || "Failed to upload image");

  const { data, error } = await supabase.storage
    .from("message_attachments")
    .createSignedUrl(path, 60 * 60 * 6);
  if (error) throw new Error(error.message || "Failed to create signed URL");
  if (!data?.signedUrl) throw new Error("Failed to get signed URL");
  return data.signedUrl;
}

async function createTextToVideoTask(
  prompt: string,
  duration?: string,
  aspectRatio?: string,
  resolution?: string,
  videoStyleMode?: string,
): Promise<{ task_id: string; status: string }> {
  const validDuration = ["6", "10"].includes(duration || "") ? duration! : "6";
  const validResolution = ["480p", "720p"].includes(resolution || "") ? resolution! : "720p";
  const validAspectRatio = ["1:1", "21:9", "4:3", "3:4", "16:9", "9:16"].includes(aspectRatio || "") ? aspectRatio! : "9:16";
  const validMode = ["normal", "fun"].includes(videoStyleMode || "") ? videoStyleMode! : "normal";
  const input: Record<string, unknown> = {
    prompt: prompt.slice(0, 2500),
    aspect_ratio: validAspectRatio,
    duration: validDuration,
    resolution: validResolution,
    mode: validMode,
  };

  const requestBody = {
    model: KIE_TEXT2VIDEO_MODEL,
    input,
  };

  console.log("[kie-text2video] Creating task, model:", KIE_TEXT2VIDEO_MODEL);

  const response = await fetch(KIE_CREATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${KIE_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[kie-text2video] Create task failed:", response.status, errorText);
    throw new Error(`Video generation service error ${response.status}`);
  }

  const result: KieCreateResponse = await response.json();
  console.log("[kie-text2video] Create response:", JSON.stringify(result));

  if (result.code !== 200 || !result.data?.taskId) {
    throw new Error(sanitizeError(result.msg || result.message || "Failed to create task"));
  }

  console.log("[kie-text2video] Task created, taskId:", result.data.taskId);
  return { task_id: result.data.taskId, status: "waiting" };
}

async function createVideoTask(
  imageUrls: string[],
  prompt?: string,
  duration?: string,
  aspectRatio?: string,
  fixedLens?: boolean,
  generateAudio?: boolean,
  resolution?: string,
  videoStyleMode?: string,
  modelOverride?: string,
): Promise<{ task_id: string; status: string }> {
  const sanitizedImageUrls = imageUrls.map(url => sanitizeImageUrl(url));
  const isTwoImages = sanitizedImageUrls.length === 2;
  const validDuration = isTwoImages
    ? (["4", "8", "12"].includes(duration || "") ? duration! : "8")
    : (["6", "10"].includes(duration || "") ? duration! : "6");
  const validAspectRatio = ["1:1", "21:9", "4:3", "3:4", "16:9", "9:16"].includes(aspectRatio || "")
    ? aspectRatio!
    : "9:16";
  const validResolution = isTwoImages
    ? (["480p", "720p"].includes(resolution || "") ? resolution! : "480p")
    : (["480p", "720p"].includes(resolution || "") ? resolution! : "720p");
  const validMode = ["normal", "fun"].includes(videoStyleMode || "") ? videoStyleMode! : "normal";

  const model = isTwoImages ? KIE_2IMAGES_MODEL : (modelOverride || KIE_IMAGE2VIDEO_MODEL);

  const input: Record<string, unknown> = isTwoImages
    ? {
        // Seedance API: uses input_urls, supports resolution/fixed_lens/generate_audio
        input_urls: sanitizedImageUrls,
        aspect_ratio: validAspectRatio,
        resolution: validResolution,
        duration: validDuration,
        fixed_lens: fixedLens || false,
        generate_audio: generateAudio || false,
      }
    : {
        // Grok Imagine API: image_urls array, supports mode
        image_urls: sanitizedImageUrls,
        duration: validDuration,
        resolution: validResolution,
        mode: validMode,
      };

  if (isTwoImages) {
    // Explicitly tell Seedance which image is the opening frame and which is the closing frame.
    // This is the only mechanism available (no dedicated start/end fields in the KIE API).
    const frameDirective = "FRAME RULE: The FIRST uploaded image is the OPENING START FRAME — the video must begin looking exactly like it. The SECOND uploaded image is the CLOSING END FRAME — the video must end looking exactly like it and hold on it clearly for the final portion. Transition smoothly between them.";
    const userPromptPart = prompt ? prompt.slice(0, 2000) : "";
    input.prompt = userPromptPart
      ? `${frameDirective}\n\n${userPromptPart}`
      : frameDirective;
  } else if (prompt) {
    input.prompt = prompt.slice(0, 2500);
  }

  const requestBody = {
    model,
    input,
  };

  console.log("[kie-image2video] Creating task, model:", model);

  const response = await fetch(KIE_CREATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${KIE_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[kie-image2video] Create task failed:", response.status, errorText);
    throw new Error(`Video generation service error ${response.status}`);
  }

  const result: KieCreateResponse = await response.json();
  console.log("[kie-image2video] Create response:", JSON.stringify(result));

  if (result.code !== 200 || !result.data?.taskId) {
    throw new Error(sanitizeError(result.msg || result.message || "Failed to create task"));
  }

  console.log("[kie-image2video] Task created, taskId:", result.data.taskId);
  return { task_id: result.data.taskId, status: "waiting" };
}

// Map KIE state to frontend-expected status
function mapKieState(state: string): string {
  switch (state?.toLowerCase()) {
    case "success":
      return "COMPLETED";
    case "fail":
      return "FAILED";
    case "waiting":
    case "queuing":
      return "IN_QUEUE";
    case "generating":
      return "IN_PROGRESS";
    default:
      return "IN_PROGRESS";
  }
}

async function getTaskStatus(taskId: string): Promise<TaskStatusData> {
  const statusUrl = `${KIE_STATUS_URL}?taskId=${encodeURIComponent(taskId)}`;
  console.log("[kie-image2video] Checking status for task:", taskId);

  const statusRes = await fetch(statusUrl, {
    method: "GET",
    headers: { "Authorization": `Bearer ${KIE_API_KEY}` },
  });

  if (!statusRes.ok) {
    const errorText = await statusRes.text();
    console.error("[kie-image2video] Get status failed:", statusRes.status, errorText);
    throw new Error(`Video status check error ${statusRes.status}`);
  }

  const statusData: KieStatusResponse = await statusRes.json();
  console.log("[kie-image2video] Status response state:", statusData.data?.state, "resultJson:", statusData.data?.resultJson?.substring(0, 200));

  if (statusData.code !== 200 || !statusData.data) {
    throw new Error(sanitizeError(statusData.msg || statusData.message || "Failed to get status"));
  }

  const kieState = statusData.data.state?.toLowerCase() || "generating";
  const mappedStatus = mapKieState(kieState);

  // If completed, parse resultJson to get video URLs
  if (mappedStatus === "COMPLETED" && statusData.data.resultJson) {
    try {
      const resultData = JSON.parse(statusData.data.resultJson);
      const urls: string[] = resultData.resultUrls || [];
      const videoUrl = urls[0];

      if (videoUrl) {
        return {
          task_id: taskId,
          status: "COMPLETED",
          generated: [videoUrl],
          video: { url: videoUrl },
        };
      }
    } catch (e) {
      console.error("[kie-image2video] Failed to parse resultJson:", e, statusData.data.resultJson);
    }

    // Completed but no URL found
    return {
      task_id: taskId,
      status: "COMPLETED",
      error: "Video completed but no URL returned",
    };
  }

  if (mappedStatus === "FAILED") {
    return {
      task_id: taskId,
      status: "FAILED",
      error: statusData.data.failMsg || "Video generation failed",
    };
  }

  // Still processing
  return {
    task_id: taskId,
    status: mappedStatus,
  };
}

async function pollUntilComplete(taskId: string): Promise<{ videoUrl: string } | { error: string }> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    console.log(`[kie-image2video] Poll attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS} for task ${taskId}`);

    const status = await getTaskStatus(taskId);
    console.log(`[kie-image2video] Status: ${status.status}`);

    if (status.status === "COMPLETED") {
      const videoUrl = status.generated?.[0] || status.video?.url;
      if (videoUrl) {
        console.log("[kie-image2video] Video ready:", videoUrl);
        return { videoUrl };
      }
      console.error("[kie-image2video] No video URL in response:", JSON.stringify(status));
      return { error: status.error || "Video completed but no URL returned" };
    }

    if (status.status === "FAILED" || status.error) {
      console.error("[kie-image2video] Task failed:", status.error);
      return { error: status.error || "Video generation failed" };
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return { error: "Timeout: Video generation took too long" };
}

async function createVisualAdsTask(
  imageUrls: string[],
  prompt: string,
  aspectRatio?: string,
  supabaseAdmin?: VisualAdsJobInsertClient,
  userId?: string,
): Promise<{ task_id: string; status: string }> {
  const sanitizedImageUrls = imageUrls.map(url => sanitizeImageUrl(url));
  const validAspectRatio = ["1:1", "16:9", "9:16"].includes(aspectRatio || "") ? aspectRatio! : "9:16";

  const input: Record<string, unknown> = {
    prompt: prompt.trim(),
    input_urls: sanitizedImageUrls,
    aspect_ratio: validAspectRatio,
    resolution: "1K",
  };

  const requestBody = {
    model: KIE_VISUAL_ADS_MODEL,
    input,
    callBackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-visual-ads`,
  };

  console.log("[kie-visual-ads] Creating task, model:", KIE_VISUAL_ADS_MODEL);

  const response = await fetch(KIE_CREATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${KIE_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[kie-visual-ads] Create task failed:", response.status, errorText);
    throw new Error(`Visual Ads generation service error ${response.status}`);
  }

  const result: KieCreateResponse = await response.json();
  console.log("[kie-visual-ads] Create response:", JSON.stringify(result));

  if (result.code !== 200 || !result.data?.taskId) {
    throw new Error(sanitizeError(result.msg || result.message || "Failed to create task"));
  }

  const taskId = result.data.taskId;
  console.log("[kie-visual-ads] Task created, taskId:", taskId);

  // Persist job row so the webhook can update it and frontend can subscribe via Realtime
  if (supabaseAdmin && userId) {
    const { error: insertErr } = await supabaseAdmin
      .from("visual_ads_jobs")
      .insert({ user_id: userId, task_id: taskId, status: "waiting" });
    if (insertErr) {
      console.error("[kie-visual-ads] Failed to insert job row:", insertErr.message);
      throw new Error("Failed to register visual ads job");
    }
  } else {
    throw new Error("Missing job persistence context for visual ads generation");
  }

  return { task_id: taskId, status: "waiting" };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[kie-image2video] User:", user.id);

    // Parse request body (need it before trial check to detect generation_type)
    const body = await req.json();

    // ── Trial Token Check: detect generation_type for correct key ──
    const genType = body?.generation_type || 'image_to_video';
    const trialKeyMap: Record<string, TrialFeatureKey> = {
      'image_to_video': 'i2v',
      'text_to_video': 't2v',
      '2images_to_video': '2i2v',
    };
    const trialFeatureKey = trialKeyMap[genType] || 'i2v';
    // Only check trial for generation requests (not status polls)
    if (body?.mode !== 'status') {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
      );
      const trial = await checkAndConsumeTrialToken(supabaseAdmin, user.id, trialFeatureKey, 1);
      if (!trial.allowed) {
        return new Response(
          JSON.stringify({ error: "TRIAL_LIMIT_REACHED", feature: trialFeatureKey }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // ── End Trial Token Check ──
    const { image, image1, image2, prompt, mode, duration: reqDuration, aspect_ratio, fixed_lens, generate_audio, generation_type, resolution, video_style_mode, model: modelOverride } = body;

    // Mode: 'status' to check task status
    if (mode === "status") {
      const { task_id, increment_usage } = body;
      if (!task_id) {
        return new Response(JSON.stringify({ error: "Missing task_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const status = await getTaskStatus(task_id);
      if (
        increment_usage &&
        (status.status === "COMPLETED" ||
          status.status === "completed" ||
          status.status === "SUCCEEDED" ||
          status.status === "succeeded")
      ) {
        const { error: usageError } = await supabase.rpc("increment_ai_video_usage", {
          p_user_id: user.id,
        });
        if (usageError) {
          console.error("[kie-image2video] Usage increment error (status):", usageError);
        }
      }

      return new Response(JSON.stringify({ ok: true, data: status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse generation type
    const generationType = generation_type || "image_to_video";

    // Validation based on generation type
    if (generationType === "image_to_video" && !image) {
      return new Response(JSON.stringify({ error: "Missing image (URL or base64)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (generationType === "2images_to_video" && (!image1 || !image2)) {
      return new Response(JSON.stringify({ error: "Missing images for 2images_to_video (need both image1 and image2)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (generationType === "text_to_video" && (!prompt || !prompt.trim())) {
      return new Response(JSON.stringify({ error: "Missing prompt for text-to-video" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check quota before proceeding
    const { data: quotaCheck, error: quotaError } = await supabase.rpc("can_generate_ai_video", {
      p_user_id: user.id,
    });

    if (quotaError) {
      console.error("[kie-image2video] Quota check error:", quotaError);
      return new Response(JSON.stringify({ error: "Failed to check quota" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const quota = quotaCheck?.[0] || quotaCheck;
    if (!quota?.can_generate) {
      return new Response(
        JSON.stringify({
          error: "Monthly AI video limit reached",
          quota: {
            used: quota?.videos_generated || 0,
            limit: quota?.videos_limit || 60,
            extra: quota?.extra_videos || 0,
          },
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let task: { task_id: string; status: string };

    if (generationType === "text_to_video") {
      // Text-to-Video: no image needed
      task = await createTextToVideoTask(prompt, reqDuration, aspect_ratio, resolution, video_style_mode);
    } else if (generationType === "2images_to_video") {
      // 2Images-to-Video: requires both image1 and image2
      let imageUrl1: string = image1;
      let imageUrl2: string = image2;
      
      // Handle data URIs for first image
      if (typeof image1 === "string" && image1.startsWith("data:image/")) {
        try {
          imageUrl1 = await uploadImageDataUriToPublicUrl(supabase, user.id, image1);
          console.log("[kie-2images2video] Uploaded first image data URI to public URL");
        } catch (e) {
          console.error("[kie-2images2video] Failed to upload first image:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Failed to prepare first image" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      // Handle data URIs for second image
      if (typeof image2 === "string" && image2.startsWith("data:image/")) {
        try {
          imageUrl2 = await uploadImageDataUriToPublicUrl(supabase, user.id, image2);
          console.log("[kie-2images2video] Uploaded second image data URI to public URL");
        } catch (e) {
          console.error("[kie-2images2video] Failed to upload second image:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Failed to prepare second image" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      task = await createVideoTask([imageUrl1, imageUrl2], prompt, reqDuration, aspect_ratio, fixed_lens, generate_audio, resolution, video_style_mode);
    } else if (generationType === "visual_ads") {
      // Visual Ads: Nano Banana 2 supports up to 14 images
      const rawImages: string[] = body.images || [];
      if (!rawImages.length) {
        return new Response(JSON.stringify({ error: "Missing images for visual_ads" }), {
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
      for (let i = 0; i < rawImages.length; i++) {
        let imgUrl = rawImages[i];
        if (typeof imgUrl === "string" && imgUrl.startsWith("data:image/")) {
          try {
            imgUrl = await uploadImageDataUriToPublicUrl(supabase, user.id, imgUrl);
            console.log(`[kie-visual-ads] Uploaded data URI ${i+1} to public URL`);
          } catch (e) {
            console.error(`[kie-visual-ads] Failed to upload image ${i+1}:`, e);
            return new Response(
              JSON.stringify({ error: e instanceof Error ? e.message : `Failed to prepare image ${i+1}` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
        imageUrls.push(imgUrl);
      }
      
      // Use the pre-built, sanitized master prompt provided by the client
      const legacyPrompt = typeof body.prompt === "string"
        ? sanitizeUserInput(body.prompt, { maxLength: 7000, label: "visual_ads_prompt" })
        : "";
      const compiledPrompt = await compileVisualAdsPrompt(body.visual_ads_spec, legacyPrompt);
      console.log(`[kie-visual-ads] Using compiled prompt source: ${compiledPrompt.source}`);
      const supabaseAdminForAds = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
      );
      task = await createVisualAdsTask(
        imageUrls,
        compiledPrompt.final_prompt,
        aspect_ratio,
        supabaseAdminForAds as unknown as VisualAdsJobInsertClient,
        user.id,
      );
    } else {
      // Image-to-Video: requires single image
      let imageUrl: string = image;
      if (typeof image === "string" && image.startsWith("data:image/")) {
        try {
          imageUrl = await uploadImageDataUriToPublicUrl(supabase, user.id, image);
          console.log("[kie-image2video] Uploaded data URI to public URL for KIE");
        } catch (e) {
          console.error("[kie-image2video] Failed to upload image:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Failed to prepare image" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      task = await createVideoTask([imageUrl], prompt, reqDuration, aspect_ratio, fixed_lens, generate_audio, resolution, video_style_mode, modelOverride);
    }

    // If mode is 'async', return task_id immediately for frontend polling
    if (mode === "async") {
      return new Response(
        JSON.stringify({
          ok: true,
          task_id: task.task_id,
          status: task.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: poll until complete (synchronous)
    const result = await pollUntilComplete(task.task_id);

    if ("error" in result) {
      return new Response(JSON.stringify({ ok: false, error: result.error }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Increment usage on success
    const { error: usageError } = await supabase.rpc("increment_ai_video_usage", {
      p_user_id: user.id,
    });

    if (usageError) {
      console.error("[kie-image2video] Usage increment error:", usageError);
      // Don't fail the request, video was generated
    }

    // Log AI usage
    await logAIFromRequest(req, {
      functionName: "freepik-image2video",
      provider: "kie.ai",
      model: generationType === "text_to_video"
        ? KIE_TEXT2VIDEO_MODEL
        : generationType === "2images_to_video"
          ? KIE_2IMAGES_MODEL
          : generationType === "visual_ads"
            ? KIE_VISUAL_ADS_MODEL
            : KIE_IMAGE2VIDEO_MODEL,
      inputText: prompt || image,
      outputText: result.videoUrl,
      durationMs: Date.now() - startTime,
      status: "success",
      metadata: { generation_type: generationType, task_id: task.task_id }
    });

    return new Response(
      JSON.stringify({
        ok: true,
        videoUrl: result.videoUrl,
        task_id: task.task_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[kie-image2video] Error:", error);
    
    // Log AI usage for error
    await logAIFromRequest(req, {
      functionName: "freepik-image2video",
      provider: "kie.ai",
      model: "kie-video",
      inputText: "",
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });
    
    const rawMsg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: sanitizeError(rawMsg) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
