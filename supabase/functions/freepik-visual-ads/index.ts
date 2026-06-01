import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { inspectGenerationPrompt } from "../_shared/promptSafety.ts";

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
  objective?: string | null;
  legacy_prompt?: string | null;
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
    text_presence_id?: string | null;
    text_presence_prompt?: string | null;
    text_color_style_id?: string | null;
    text_color_style_prompt?: string | null;
    allow_generated_headline?: boolean | null;
    allow_generated_tagline?: boolean | null;
    allow_generated_social_proof_copy?: boolean | null;
    allow_generated_testimonials?: boolean | null;
  } | null;
  hard_constraints?: {
    must_follow_tagged_roles?: boolean | null;
    must_preserve_exact_person_identity?: boolean | null;
    must_preserve_reference_person_anchor?: boolean | null;
    must_preserve_reference_person_silhouette?: boolean | null;
    must_preserve_reference_person_styling?: boolean | null;
    must_preserve_reference_pose_direction?: boolean | null;
    must_preserve_logo_fidelity?: boolean | null;
    must_keep_logo_flat_and_fully_visible?: boolean | null;
    must_preserve_screenshot_fidelity?: boolean | null;
    must_preserve_background_identity?: boolean | null;
    allow_invented_text?: boolean | null;
    allow_invented_names?: boolean | null;
    allow_invented_testimonials?: boolean | null;
    hard_constraints_override_style?: boolean | null;
    priority_order?: string[] | null;
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

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
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

function buildCampaignDirectives(spec: VisualAdsSpec): string[] {
  const campaignId = (spec.campaign?.main_message_id || "").toLowerCase();
  const detailId = (spec.campaign?.main_message_detail_id || "").toLowerCase();
  const lines: string[] = [];

  switch (campaignId) {
    case "new-launch":
      lines.push("CAMPAIGN MODE / NEW LAUNCH: Treat the poster like a debut reveal with one clear hero moment. Avoid bargain energy, clutter, or noisy discount styling.");
      break;
    case "limited-offer":
      lines.push("CAMPAIGN MODE / LIMITED OFFER: Make urgency obvious, premium, and time-sensitive without making the ad feel cheap or overcrowded.");
      break;
    case "app-download":
      lines.push("CAMPAIGN MODE / APP DOWNLOAD: Make the app experience instantly understandable. If a screenshot exists, it should read immediately as a core subject of the ad.");
      break;
    case "save-time":
      lines.push("CAMPAIGN MODE / SAVE TIME: The value should feel like relief, speed, reduced friction, and mental clarity. Keep the communication easy to scan.");
      break;
    case "premium":
      lines.push("CAMPAIGN MODE / PREMIUM: Push craftsmanship, exclusivity, and elevated brand perception. Avoid mass-market sale styling.");
      break;
    case "social-proof":
      lines.push("CAMPAIGN MODE / CUSTOMER LOVE: Communicate trust and popularity through tasteful proof markers and approved short phrases only. Do not invent testimonials or ratings.");
      break;
    case "features":
      lines.push("CAMPAIGN MODE / SHOW FEATURES: Organize the layout around a clear hero plus concise supporting feature callouts using only the approved short phrases.");
      break;
    case "sale":
      lines.push("CAMPAIGN MODE / SALE: The offer should feel immediate and visible, but still premium. Do not invent discount percentages, prices, coupon codes, or fake deadlines.");
      break;
  }

  switch (detailId) {
    case "hero-reveal":
      lines.push("MESSAGE DETAIL / HERO REVEAL: Build around one dominant reveal centerpiece with dramatic visual focus.");
      break;
    case "future-wave":
      lines.push("MESSAGE DETAIL / FUTURE WAVE: Make the execution feel forward-looking, visionary, and ahead of its category.");
      break;
    case "founder-proud":
      lines.push("MESSAGE DETAIL / PROUD DEBUT: Make the launch feel confident, polished, and worthy of anticipation.");
      break;
    case "vip-window":
      lines.push("MESSAGE DETAIL / VIP WINDOW: Make the offer feel exclusive and insider-led rather than mass discount.");
      break;
    case "countdown-pressure":
      lines.push("MESSAGE DETAIL / COUNTDOWN PRESSURE: The composition should signal limited time and strong urgency at first glance.");
      break;
    case "clean-urgency":
      lines.push("MESSAGE DETAIL / CLEAN URGENCY: Keep urgency strong, but visually polished and uncluttered.");
      break;
    case "phone-first":
      lines.push("MESSAGE DETAIL / PHONE-FIRST HERO: Make the phone or device experience the central hero read of the poster.");
      break;
    case "smart-lifestyle":
      lines.push("MESSAGE DETAIL / SMART LIFESTYLE: Show the product or app feeling naturally embedded in an aspirational daily routine.");
      break;
    case "store-ready":
      lines.push("MESSAGE DETAIL / LAUNCH READY: Make the result feel polished, app-store-ready, and instantly downloadable.");
      break;
    case "calm-efficiency":
      lines.push("MESSAGE DETAIL / CALM EFFICIENCY: Communicate order, ease, and low-friction clarity rather than chaos.");
      break;
    case "instant-relief":
      lines.push("MESSAGE DETAIL / INSTANT RELIEF: The visual should feel like immediate relief from stress, wasted time, or friction.");
      break;
    case "smooth-routine":
      lines.push("MESSAGE DETAIL / SMOOTH ROUTINE: Present the product as making daily life feel clean, easy, and beautifully organized.");
      break;
    case "crafted-luxury":
      lines.push("MESSAGE DETAIL / CRAFTED LUXURY: Emphasize craftsmanship, premium detail, and refined finishing quality.");
      break;
    case "quiet-wealth":
      lines.push("MESSAGE DETAIL / QUIET WEALTH: Make the result feel expensive and elevated without loud sales energy.");
      break;
    case "flagship-energy":
      lines.push("MESSAGE DETAIL / FLAGSHIP ENERGY: Present the offer like the category-leading flagship product or service.");
      break;
    case "testimonial-cards":
      lines.push("MESSAGE DETAIL / TESTIMONIAL CARDS: Use approved phrases as clean trust cards or proof labels only. Do not invent quotes.");
      break;
    case "community-love":
      lines.push("MESSAGE DETAIL / COMMUNITY LOVE: Make the poster feel warmly loved by a real audience without fake review language.");
      break;
    case "trust-signals":
      lines.push("MESSAGE DETAIL / TRUST SIGNALS: Lean into premium proof markers, badges, and confidence cues using only approved content.");
      break;
    case "feature-callouts":
      lines.push("MESSAGE DETAIL / FEATURE CALLOUTS: Arrange approved points as clean callouts attached to the hero subject or interface.");
      break;
    case "hero-plus-benefits":
      lines.push("MESSAGE DETAIL / HERO PLUS BENEFITS: Keep one strong hero subject with concise benefit labels supporting it.");
      break;
    case "smart-breakdown":
      lines.push("MESSAGE DETAIL / SMART BREAKDOWN: Organize the visual like a premium, intelligent breakdown of capabilities.");
      break;
    case "price-drop":
      lines.push("MESSAGE DETAIL / PRICE DROP HERO: Make the deal instantly legible while keeping the design premium.");
      break;
    case "vip-deal":
      lines.push("MESSAGE DETAIL / VIP DEAL: Position the sale as an insider premium deal, not a bargain-bin promotion.");
      break;
    case "high-energy-flash":
      lines.push("MESSAGE DETAIL / FLASH ENERGY: Bring fast, high-energy sale momentum with bold hierarchy and urgency.");
      break;
  }

  return lines;
}

function buildStyleDirectives(spec: VisualAdsSpec): string[] {
  const styleId = (spec.style?.primary_style_id || "").toLowerCase();
  const detailId = (spec.style?.style_detail_id || "").toLowerCase();
  const lines: string[] = [];

  switch (styleId) {
    case "premium-dark":
      lines.push("STYLE MODE / SLEEK & DARK: Use dark premium contrast, controlled highlights, polished glow, and a luxury-tech finish.");
      break;
    case "bright-clean":
      lines.push("STYLE MODE / BRIGHT & CLEAN: Use bright airy space, clean surfaces, crisp hierarchy, and fresh premium simplicity.");
      break;
    case "bold-modern":
      lines.push("STYLE MODE / BOLD & PUNCHY: Use strong contrast, energetic framing, and punchy modern advertising presence.");
      break;
    case "lifestyle":
      lines.push("STYLE MODE / REAL & HUMAN: Keep the result believable, human, and grounded rather than glossy fantasy.");
      break;
    case "luxury-minimal":
      lines.push("STYLE MODE / LUXURY MINIMAL: Use restraint, space, quiet confidence, and a sparse premium layout.");
      break;
    case "ugc":
      lines.push("STYLE MODE / NATURAL / UGC: Keep it native, authentic, social-first, and less over-produced while still polished enough for a premium brand.");
      break;
  }

  switch (detailId) {
    case "luxury-noir":
      lines.push("STYLE DETAIL / LUXURY NOIR: Add deep shadows and refined dark contrast.");
      break;
    case "cinematic-glow":
      lines.push("STYLE DETAIL / CINEMATIC GLOW: Use cinematic atmosphere with controlled polished glow accents.");
      break;
    case "elite-tech":
      lines.push("STYLE DETAIL / ELITE TECH: Keep the finish sleek, premium, and technology-forward.");
      break;
    case "airy-minimal":
      lines.push("STYLE DETAIL / AIRY MINIMAL: Preserve generous breathing room and soft premium lightness.");
      break;
    case "sunlit-premium":
      lines.push("STYLE DETAIL / SUNLIT PREMIUM: Use bright clean lighting that still feels expensive and controlled.");
      break;
    case "gallery-clean":
      lines.push("STYLE DETAIL / GALLERY CLEAN: Make the composition feel like a premium showroom or design gallery.");
      break;
    case "neon-energy":
      lines.push("STYLE DETAIL / NEON ENERGY: Push boldness with vibrant accents, motion cues, and energetic contrast.");
      break;
    case "editorial-hype":
      lines.push("STYLE DETAIL / EDITORIAL HYPE: Make it feel like a modern editorial campaign with strong hierarchy and premium impact.");
      break;
    case "tech-pop":
      lines.push("STYLE DETAIL / TECH POP: Blend energetic graphics with playful premium tech cues.");
      break;
    case "warm-documentary":
      lines.push("STYLE DETAIL / WARM DOCUMENTARY: Keep it honest, grounded, warm, and naturally observed.");
      break;
    case "golden-hour":
      lines.push("STYLE DETAIL / GOLDEN HOUR: Use warm realistic light and emotional atmosphere.");
      break;
    case "everyday-premium":
      lines.push("STYLE DETAIL / EVERYDAY PREMIUM: Keep it relatable and real, but clearly polished and premium.");
      break;
    case "silent-wealth":
      lines.push("STYLE DETAIL / SILENT WEALTH: Strip the composition down to quiet premium confidence and elegant restraint.");
      break;
    case "museum-piece":
      lines.push("STYLE DETAIL / MUSEUM PIECE: Present the hero subject like a carefully displayed premium object of value.");
      break;
    case "monochrome-premium":
      lines.push("STYLE DETAIL / MONOCHROME PREMIUM: Use restrained tones and minimalist luxury polish.");
      break;
    case "phone-capture":
      lines.push("STYLE DETAIL / PHONE CAPTURE: Keep the framing authentic and naturally captured, not studio-perfect.");
      break;
    case "creator-post":
      lines.push("STYLE DETAIL / CREATOR POST: Make it feel native to a credible creator feed with believable framing.");
      break;
    case "real-feed":
      lines.push("STYLE DETAIL / REAL FEED: Keep it spontaneous, social-native, and naturally at home in a real feed.");
      break;
  }

  return lines;
}

function buildCompositionDirectives(spec: VisualAdsSpec): string[] {
  const lines: string[] = [];
  const ratio = (spec.aspect_ratio || "1:1").toLowerCase();
  const layoutType = (spec.composition?.layout_type || "").toLowerCase();
  const primarySubjects = spec.composition?.primary_subjects || [];
  const secondarySubjects = spec.composition?.secondary_subjects || [];

  if (layoutType === "screenshot-led-poster") {
    lines.push("LAYOUT MODE / SCREENSHOT-LED: The screenshot or device must be one of the first things the viewer reads. Supporting assets must frame it, not overpower it.");
  } else if (layoutType === "hero-poster") {
    lines.push("LAYOUT MODE / HERO POSTER: Use one dominant hero subject with clear supporting elements and strong visual hierarchy.");
  }

  if (ratio === "9:16") {
    lines.push("RATIO RULE / 9:16: Compose vertically with strong top-to-bottom hierarchy and safe breathing room at the top and bottom edges.");
  } else if (ratio === "16:9") {
    lines.push("RATIO RULE / 16:9: Compose with clear horizontal balance and wide-screen readability.");
  } else {
    lines.push("RATIO RULE / 1:1: Keep the composition balanced, centered, and immediately readable in a square feed.");
  }

  if (primarySubjects.length > 0) {
    lines.push(`PRIMARY SUBJECT RULE: ${primarySubjects.join(", ")} must hold the dominant visual weight.`);
  }
  if (secondarySubjects.length > 0) {
    lines.push(`SECONDARY SUBJECT RULE: ${secondarySubjects.join(", ")} must stay supportive and must not overpower the primary subjects.`);
  }
  if (spec.composition?.logo_source) {
    lines.push(`LOGO PLACEMENT RULE: ${spec.composition.logo_source} should sit in a clean brand-safe placement, typically near a top or bottom edge, fully visible.`);
  }
  if (spec.composition?.face_must_remain_visible) {
    lines.push("FACE VISIBILITY RULE: Any important face must remain readable, unobstructed, and clearly recognizable.");
  }
  if (spec.composition?.device_must_not_block_face) {
    lines.push("DEVICE-AND-FACE RULE: A screenshot or device mockup must never block or hide the face.");
  }
  if (spec.composition?.must_feel_unified) {
    lines.push("UNITY RULE: The final poster must feel like one coherent campaign visual, not a collage of unrelated uploads.");
  }

  return lines;
}

function buildCtaDirectives(spec: VisualAdsSpec): string[] {
  const ctaId = (spec.campaign?.cta_id || "").toLowerCase();
  const ctaText = (spec.campaign?.cta_text || "").trim();
  if (!ctaText) return [];

  const lines = [`CTA MODE: Render "${ctaText}" inside the final poster as the single main action. Place it once only with clear hierarchy and strong readability.`];

  switch (ctaId) {
    case "download-now":
    case "get-started":
    case "start-free":
      lines.push("CTA BEHAVIOR: Present the action like a strong conversion-focused onboarding or app-start button.");
      break;
    case "shop-now":
      lines.push("CTA BEHAVIOR: Present the action like a commerce-ready purchase invitation.");
      break;
    case "learn-more":
      lines.push("CTA BEHAVIOR: Present the action like a softer information-first invitation rather than a hard sale.");
      break;
    case "book-now":
      lines.push("CTA BEHAVIOR: Present the action like a booking or reservation trigger with service-oriented clarity.");
      break;
    case "try-today":
      lines.push("CTA BEHAVIOR: Present the action as low-friction and immediately approachable.");
      break;
    case "join-now":
      lines.push("CTA BEHAVIOR: Present the action like a membership or community entry point.");
      break;
    case "subscribe":
      lines.push("CTA BEHAVIOR: Present the action like an ongoing membership or subscription conversion point.");
      break;
  }

  lines.push("CTA PLACEMENT: Keep the CTA in a clean protected area. In screenshot-led layouts, do not let it cover important device edges, app UI, or key readable screen content.");

  return lines;
}

function buildTextSystemDirectives(spec: VisualAdsSpec): string[] {
  const textPresenceId = (spec.text_policy?.text_presence_id || "").toLowerCase();
  const textColorStyleId = (spec.text_policy?.text_color_style_id || "").toLowerCase();
  const lines: string[] = [];

  switch (textPresenceId) {
    case "quiet":
      lines.push("TEXT PRESENCE / QUIET: Keep the approved text restrained, compact, and elegant. Feature callouts should feel refined and supportive, while the CTA stays present but controlled.");
      break;
    case "balanced":
      lines.push("TEXT PRESENCE / BALANCED: Use a clear premium hierarchy with compact feature callouts and one readable CTA. Keep the text noticeable but not oversized or loud.");
      break;
    case "strong-cta":
      lines.push("TEXT PRESENCE / STRONG CTA: Make the CTA the strongest text element while keeping the feature callouts compact and supportive. The text system should feel conversion-focused without overwhelming the poster.");
      break;
  }

  lines.push("TEXT PLACEMENT: When the layout is screenshot-led, place callouts and CTA around the device in protected negative space. Do not cover important screen content, key app UI, or the dominant screenshot read.");

  switch (textColorStyleId) {
    case "auto-contrast":
      lines.push("TEXT COLOR / AUTO CONTRAST: Choose a clean high-contrast treatment that stays readable against the actual poster background without looking harsh or cheap.");
      break;
    case "brand-accent":
      lines.push("TEXT COLOR / BRAND ACCENT: Keep most text neutral and premium. Use restrained accent color mainly on the CTA or tiny highlights rather than coloring every text element.");
      break;
    case "minimal-monochrome":
      lines.push("TEXT COLOR / MINIMAL MONOCHROME: Keep the full text treatment monochrome, crisp, and elegant with a luxury-minimal feel.");
      break;
  }

  return lines;
}

function _normalizeVisualAdsSpec(raw: unknown): VisualAdsSpec {
  const record = asRecord(raw) || {};
  const assetsRaw = Array.isArray(record.assets) ? record.assets : [];
  const campaign = asRecord(record.campaign);
  const style = asRecord(record.style);
  const composition = asRecord(record.composition);
  const textPolicy = asRecord(record.text_policy);
  const hardConstraints = asRecord(record.hard_constraints);

  return {
    language: asString(record.language, 12) || "en",
    aspect_ratio: asString(record.aspect_ratio, 10) || "1:1",
    objective: asString(record.objective, 120) || null,
    legacy_prompt: asString(record.legacy_prompt, 20000) || null,
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
      main_message_id: asString(campaign.main_message_id, 80) || null,
      main_message_prompt: asString(campaign.main_message_prompt, 280) || null,
      main_message_custom_text: asString(campaign.main_message_custom_text, 120) || null,
      main_message_detail_id: asString(campaign.main_message_detail_id, 80) || null,
      main_message_detail_prompt: asString(campaign.main_message_detail_prompt, 320) || null,
      feature_chips: asStringArray(campaign.feature_chips, 80),
      require_exact_feature_chips: asBoolean(campaign.require_exact_feature_chips),
      cta_id: asString(campaign.cta_id, 80) || null,
      cta_text: asString(campaign.cta_text, 120) || null,
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
      primary_subjects: asStringArray(composition.primary_subjects, 60),
      secondary_subjects: asStringArray(composition.secondary_subjects, 60),
      background_source: asString(composition.background_source, 60) || null,
      logo_source: asString(composition.logo_source, 60) || null,
      face_must_remain_visible: asBoolean(composition.face_must_remain_visible),
      device_must_not_block_face: asBoolean(composition.device_must_not_block_face),
      must_feel_unified: asBoolean(composition.must_feel_unified),
    } : null,
    text_policy: textPolicy ? {
      allowed_text: asStringArray(textPolicy.allowed_text, 120),
      allowed_feature_labels: asStringArray(textPolicy.allowed_feature_labels, 120),
      text_presence_id: asString(textPolicy.text_presence_id, 80) || null,
      text_presence_prompt: asString(textPolicy.text_presence_prompt, 320) || null,
      text_color_style_id: asString(textPolicy.text_color_style_id, 80) || null,
      text_color_style_prompt: asString(textPolicy.text_color_style_prompt, 320) || null,
      allow_generated_headline: asBoolean(textPolicy.allow_generated_headline),
      allow_generated_tagline: asBoolean(textPolicy.allow_generated_tagline),
      allow_generated_social_proof_copy: asBoolean(textPolicy.allow_generated_social_proof_copy),
      allow_generated_testimonials: asBoolean(textPolicy.allow_generated_testimonials),
    } : null,
    hard_constraints: hardConstraints ? {
      must_follow_tagged_roles: asBoolean(hardConstraints.must_follow_tagged_roles),
      must_preserve_exact_person_identity: asBoolean(hardConstraints.must_preserve_exact_person_identity),
      must_preserve_reference_person_anchor: asBoolean(hardConstraints.must_preserve_reference_person_anchor),
      must_preserve_reference_person_silhouette: asBoolean(hardConstraints.must_preserve_reference_person_silhouette),
      must_preserve_reference_person_styling: asBoolean(hardConstraints.must_preserve_reference_person_styling),
      must_preserve_reference_pose_direction: asBoolean(hardConstraints.must_preserve_reference_pose_direction),
      must_preserve_logo_fidelity: asBoolean(hardConstraints.must_preserve_logo_fidelity),
      must_keep_logo_flat_and_fully_visible: asBoolean(hardConstraints.must_keep_logo_flat_and_fully_visible),
      must_preserve_screenshot_fidelity: asBoolean(hardConstraints.must_preserve_screenshot_fidelity),
      must_preserve_background_identity: asBoolean(hardConstraints.must_preserve_background_identity),
      allow_invented_text: asBoolean(hardConstraints.allow_invented_text),
      allow_invented_names: asBoolean(hardConstraints.allow_invented_names),
      allow_invented_testimonials: asBoolean(hardConstraints.allow_invented_testimonials),
      hard_constraints_override_style: asBoolean(hardConstraints.hard_constraints_override_style),
      priority_order: asStringArray(hardConstraints.priority_order, 80),
    } : null,
  };
}

function compileVisualAdsFallbackPrompt(spec: VisualAdsSpec, legacyPrompt: string): string {
  const assets = spec.assets || [];
  if (!assets.length && legacyPrompt.trim()) return legacyPrompt.trim();

  const ratio = spec.aspect_ratio || "1:1";
  const objective = (spec.objective || "").trim();
  const campaignId = (spec.campaign?.main_message_id || "").toLowerCase();
  const campaignText = (spec.campaign?.main_message_custom_text || spec.campaign?.main_message_prompt || "").trim();
  const campaignDetail = (spec.campaign?.main_message_detail_prompt || "").trim();
  const featureChips = (spec.campaign?.feature_chips || []).filter(Boolean);
  const ctaText = (spec.campaign?.cta_text || "").trim();
  const styleText = (spec.style?.primary_style_custom_text || spec.style?.primary_style_prompt || "").trim();
  const styleDetail = (spec.style?.style_detail_prompt || "").trim();
  const hasScreenshot = assets.some((asset) => (asset.role || "").toLowerCase() === "screenshot");
  const hasBackground = assets.some((asset) => (asset.role || "").toLowerCase() === "background");
  const hasTransparentLogo = assets.some((asset) => (asset.role || "").toLowerCase() === "logo" && (asset.logo_mode || "").toLowerCase() === "transparent");
  const hasAnyLogo = assets.some((asset) => (asset.role || "").toLowerCase() === "logo");
  const hasExactPerson = assets.some((asset) => (asset.role || "").toLowerCase() === "person" && (asset.person_mode || "exact").toLowerCase() !== "reference");
  const hasReferencePerson = assets.some((asset) => (asset.role || "").toLowerCase() === "person" && (asset.person_mode || "exact").toLowerCase() === "reference");
  const hasNewPosePerson = assets.some((asset) => (asset.role || "").toLowerCase() === "person" && (asset.person_mode || "exact").toLowerCase() !== "reference" && (asset.pose_mode || "same-pose").toLowerCase() === "adapted-pose");
  const hasIllustration = assets.some((asset) => (asset.role || "").toLowerCase() === "illustration");
  const hasMascot = assets.some((asset) => (asset.role || "").toLowerCase() === "mascot");
  const hasProduct = assets.some((asset) => (asset.role || "").toLowerCase() === "product");
  const hasIcon = assets.some((asset) => (asset.role || "").toLowerCase() === "icon");
  const hasProp = assets.some((asset) => (asset.role || "").toLowerCase() === "prop");
  const hasTexture = assets.some((asset) => (asset.role || "").toLowerCase() === "texture");
  const hasCustomRole = assets.some((asset) => Boolean((asset.custom_role || "").trim()));
  const mustPreserveReferencePersonAnchor = spec.hard_constraints?.must_preserve_reference_person_anchor === true || hasReferencePerson;
  const mustPreserveReferencePersonSilhouette = spec.hard_constraints?.must_preserve_reference_person_silhouette === true || hasReferencePerson;
  const mustPreserveReferencePersonStyling = spec.hard_constraints?.must_preserve_reference_person_styling === true || hasReferencePerson;
  const mustPreserveReferencePoseDirection = spec.hard_constraints?.must_preserve_reference_pose_direction === true || hasReferencePerson;
  const mustKeepLogoFlatAndFullyVisible = spec.hard_constraints?.must_keep_logo_flat_and_fully_visible === true || hasTransparentLogo;

  const lines: string[] = [
    `Create a high-end ${ratio} premium advertising poster with a unified, cinematic composition.`,
  ];

  if (objective) {
    lines.push(`Optimize the poster for this outcome: ${objective.replace(/[.!?]+$/g, "")}.`);
  }
  if (campaignText) {
    lines.push(`Build the poster around this campaign direction: ${campaignText.replace(/[.!?]+$/g, "")}.`);
  }
  if (campaignDetail) {
    lines.push(campaignDetail);
  }
  const campaignDirectives = buildCampaignDirectives(spec);
  if (campaignDirectives.length > 0) {
    lines.push("");
    lines.push("Campaign System:");
    lines.push("");
    lines.push(...campaignDirectives);
  }
  const compositionDirectives = buildCompositionDirectives(spec);
  if (compositionDirectives.length > 0) {
    lines.push("");
    lines.push("Layout System:");
    lines.push("");
    lines.push(...compositionDirectives);
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
    const isPrimarySubject = (spec.composition?.primary_subjects || []).includes(sourceKey);

    if (role === "background") {
      lines.push(`WORLD FOUNDATION: Use ${sourceKey} as the actual full-scene background foundation of the final poster.`);
      lines.push(`Maintain the geography, architecture, scene identity, and environmental layout from ${sourceKey} exactly.`);
      lines.push(`Only enhance the mood, atmosphere, color grade, and lighting. Do not let any non-background upload replace this world or become the main backdrop.`);
      continue;
    }

    if (role === "screenshot") {
      lines.push(`UI ASSET / CLEAN MOCKUP: Place the inner app content from ${sourceKey} inside a ${getDeviceMockupLabel(asset.screenshot_device)}, centered or slightly dominant in the frame.`);
      lines.push(`This upload may contain raw UI artifacts, uploader boxes, red X buttons, drag-and-drop frames, browser chrome, or Image 1/2 labels around the real app screen.`);
      lines.push(`Ignore and remove all of those outer artifacts. Extract only the central application content and show only that inner app content inside the device mockup.`);
      lines.push("NO RECURSIVE INTERFACES. Do not show the uploader, editor chrome, or a screenshot-inside-a-screenshot effect.");
      continue;
    }

    if (role === "logo") {
      if ((asset.logo_mode || "").toLowerCase() === "transparent") {
        lines.push(`BRAND OVERLAY: Integrate the logo (${sourceKey}) as a clean transparent flat logo overlay with high-contrast vector sharpness.`);
        lines.push(`Keep the logo fully visible, uncropped, flat, and 2D with a clean alpha channel and zero opacity bleed from the background.`);
        lines.push(`Treat the logo as a protected brand mark, not as a decorative object, scenic prop, sticker, sculpture, or 3D design element.`);
      } else {
        lines.push(`BRAND OVERLAY: Integrate the logo (${sourceKey}) naturally into the composition, preferably in a clean top or bottom placement, keeping it exactly as provided.`);
        lines.push(`Preserve it as a solid asset with sharp high-fidelity edges, high contrast, zero opacity bleed, no redesign, no recolor, and no distortion.`);
        lines.push(`Keep the logo fully visible and uncropped. Do not transform it into an icon tile, prop, badge, product object, or scenic element.`);
      }
      continue;
    }

    if (role === "person") {
      const personMode = (asset.person_mode || "exact").toLowerCase();
      if (personMode === "reference") {
        if ((asset.reference_style || "realistic").toLowerCase() === "character") {
          lines.push(`REFERENCE: Create a stylized digital character based on the identity anchor in ${sourceKey}.`);
          lines.push(`Preserve the face direction, hair direction, outfit language, accessories, silhouette, and pose direction from ${sourceKey}.`);
          lines.push(`Stylize the uploaded identity; do not replace ${sourceKey} with a random different character or a generic new person.`);
        } else {
          lines.push(`REFERENCE: Create a photorealistic human based on the identity anchor in ${sourceKey}.`);
          lines.push(`Preserve the source anchor from ${sourceKey}, including face direction, hair direction, outfit language, accessories, silhouette, and pose direction. Do not drift into a different-looking person.`);
        }
      } else {
        const pose = (asset.pose_mode || "same-pose").toLowerCase();
        lines.push(`IDENTITY LOCK: ${sourceKey} is a fixed identity asset. Use the exact face and exact art style from the upload.`);
        lines.push(`Do not change the art style. If the input is a 2D illustration, cartoon, vector, or stylized drawing, it must remain 2D and stylized.`);
        lines.push(`Do not apply 3D skin textures, realistic pores, or real-world lighting to a cartoon or stylized face.`);
        if (pose === "upper-body") {
          lines.push(`Frame the same identity as an upper-body hero shot only. Keep the identity and art style locked.`);
        } else if (pose === "adapted-pose") {
          lines.push(`Adapt the body pose only. Keep the face, identity, and art style locked.`);
        } else {
          lines.push(`Keep the pose and framing as close to 1:1 as possible.`);
        }
      }
      continue;
    }

    if (role === "illustration" || role === "mascot") {
      lines.push(`ART ASSET / VECTOR PRESERVATION: Treat ${sourceKey} as a protected ${role}.`);
      lines.push(`Preserve the hand-drawn or vector aesthetic, flat colors, clean lines, and 2D nature.`);
      lines.push(`Match the scene mood without turning it into a real-world object. Do not add 3D realism, realistic skin, sculpted depth, or real-world material textures.`);
      continue;
    }

    if (role === "product") {
      if (hasScreenshot && !isPrimarySubject) {
        lines.push(`SUPPORTING PRODUCT LOCK: Place ${sourceKey} as a premium supporting product element near the screenshot without overpowering the screenshot-led hierarchy.`);
      } else {
        lines.push(`HERO PRODUCT LOCK: Use ${sourceKey} as the actual product hero with premium scale, clean lighting, and polished presentation.`);
      }
      lines.push(`Preserve the exact product silhouette, package shape, materials, surface finish, recognizable details, and brand geometry from ${sourceKey}.`);
      lines.push(`Do not redesign, melt, replace, over-stylize, or swap ${sourceKey} for a different product.`);
      continue;
    }

    if (role === "icon") {
      lines.push(`ICON LOCK: Use ${sourceKey} as a crisp supporting icon or symbolic graphic element only.`);
      lines.push(`Keep it sharp, flat, clean, and secondary in hierarchy. Do not inflate it into a 3D object, toy, floating sculpture, sticker sheet, or hero subject.`);
      continue;
    }

    if (role === "prop") {
      lines.push(`PROP CONTROL: Use ${sourceKey} as a supporting prop that helps the story of the poster without becoming the main hero.`);
      lines.push(`Preserve the recognizable shape and material class of ${sourceKey}. Keep it subordinate to the primary subjects.`);
      continue;
    }

    if (role === "texture") {
      lines.push(`TEXTURE CONTROL: Use ${sourceKey} only as a subtle surface, overlay, or atmosphere texture layer.`);
      lines.push(`Keep it low in hierarchy and non-literal. Do not turn it into a product, logo, prop, character, or replacement scene.`);
      continue;
    }

    if (asset.custom_role) {
      lines.push(`CUSTOM ROLE LOCK: Treat ${sourceKey} specifically as ${asset.custom_role}. Preserve its native visual class and let it serve only that job.`);
      lines.push(`Do not reinterpret ${sourceKey} into a different asset category. If it is graphic, keep it graphic. If it is a real object, keep it a real object.`);
    } else {
      lines.push(`Use ${sourceKey} as a supporting element integrated naturally into the composition.`);
    }
  }

  if (featureChips.length > 0) {
    if (campaignId == "social-proof") {
      lines.push("Render each approved key point once as a tasteful proof marker, trust label, or premium endorsement chip without inventing quotes or reviews.");
    } else if (campaignId == "features") {
      lines.push("Render each approved key point once as a concise feature callout or benefit label connected clearly to the hero subject or interface. Keep them compact, premium, and outside important screenshot UI.");
    } else if (campaignId == "sale") {
      lines.push("Render each approved key point once as a compact supporting offer or benefit chip while keeping the hierarchy clean and premium.");
    } else {
      lines.push("Render each approved key point once as a concise premium support label or callout chip around the main subject.");
    }
  }

  lines.push("");
  lines.push("Allowed Text ONLY:");
  lines.push("");
  const allowedText = ctaText ? [ctaText, ...featureChips.filter((chip) => chip !== ctaText)] : featureChips;
  if (allowedText.length) {
    lines.push("The following approved short text is the only new poster text you may render in the final image:");
    for (const item of allowedText) lines.push(`\"${item}\"`);
  } else {
    lines.push("No extra on-poster text beyond what is already approved in the brief.");
  }
  if (hasScreenshot || hasAnyLogo || hasProduct) {
    lines.push("Existing text already embedded inside a protected uploaded screenshot, logo, or product package may remain exactly as it appears in that asset.");
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
  const styleDirectives = buildStyleDirectives(spec);
  if (styleDirectives.length > 0) {
    lines.push(...styleDirectives);
  }

  const textSystemDirectives = buildTextSystemDirectives(spec);
  if (textSystemDirectives.length > 0) {
    lines.push("");
    lines.push("Text System:");
    lines.push("");
    lines.push(...textSystemDirectives);
  }

  const ctaDirectives = buildCtaDirectives(spec);
  if (ctaDirectives.length > 0) {
    lines.push("");
    lines.push("CTA System:");
    lines.push("");
    lines.push(...ctaDirectives);
  }

  if (ctaText) {
    lines.push("");
    lines.push("CTA Guidance:");
    lines.push("");
    lines.push(`Render \"${ctaText}\" as the main CTA inside the final poster.`);
    lines.push("Do not duplicate the CTA in multiple places, and do not let it cover important screenshot or device content.");
  }

  lines.push("");
  lines.push("Strict Rules:");
  lines.push("");
  lines.push("Do NOT add any extra text beyond the allowed phrases listed above.");
  lines.push("Do NOT render any new text that is not in the approved allowed-text list unless that text already exists inside a protected uploaded asset.");
  lines.push("Do NOT duplicate approved phrases in multiple places or repeat the same chip or CTA more than once.");
  lines.push("Do NOT invent names, headlines, taglines, or brand copy.");
  lines.push("Do NOT invent testimonials, ratings, reviews, or social proof copy.");
  if (hasScreenshot || hasAnyLogo || hasProduct) lines.push("Do NOT erase, rewrite, or hallucinate text that already exists inside a protected uploaded screenshot, logo, or product package.");
  if (hasScreenshot) lines.push("Do NOT show uploader chrome, Image 1/2 boxes, red X icons, browser chrome, or recursive interfaces around any screenshot.");
  if (hasScreenshot) lines.push("Do NOT place feature callouts or CTA on top of important app UI, key readable screen content, or the dominant screenshot read.");
  if (hasAnyLogo) lines.push("Do NOT crop, cut off, restyle, reinterpret, or transform any uploaded logo into an object, badge, sticker, prop, sculpture, or scenic element.");
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
  if (mustPreserveReferencePersonAnchor) lines.push("For any person tagged as reference, keep the uploaded person as the clear source anchor. Do NOT replace them with a generic new person.");
  if (mustPreserveReferencePersonSilhouette) lines.push("For any person tagged as reference, preserve the source silhouette and body-language direction.");
  if (mustPreserveReferencePersonStyling) lines.push("For any person tagged as reference, preserve the source outfit language, accessories, and hair/styling direction.");
  if (mustPreserveReferencePoseDirection) lines.push("For any person tagged as reference, preserve the source pose direction and framing intent even when stylizing.");
  if (hasNewPosePerson) lines.push("For any person tagged as New pose, you must create a clearly new pose while preserving the exact same real person. Do NOT keep the original pose if the brief asks for a new one.");
  if (mustKeepLogoFlatAndFullyVisible) lines.push("Any transparent logo must remain a flat 2D overlay, fully visible and uncropped.");
  if (hasProduct) lines.push("Do NOT redesign, replace, deform, or rebrand any uploaded product. Preserve its recognizable shape, materials, packaging language, and key details.");
  if (hasIcon) lines.push("Do NOT turn any uploaded icon into a 3D object, toy, sculpture, or oversized hero element. Keep icons crisp and graphic.");
  if (hasProp) lines.push("Do NOT let supporting props overpower the hero subject or become the main product unless explicitly tagged as a primary subject.");
  if (hasTexture) lines.push("Do NOT turn any uploaded texture into a literal object, logo, character, or replacement scene. Keep textures subtle and subordinate.");
  if (hasIllustration || hasMascot) lines.push("Do NOT convert any illustration or mascot into a 3D real-world object. Preserve flat/vector/hand-drawn character.");
  if (hasCustomRole) lines.push("Do NOT repurpose any custom-role asset into a different asset category. Respect the uploaded job label exactly.");
  if (featureChips.length > 0) lines.push("Use the approved key points exactly as written without renaming, paraphrasing, or substituting them.");
  if (hasExactPerson && hasScreenshot) lines.push("Keep the face clearly visible. The device mockup must not block the face.");
  lines.push("Keep everything sharp, high-resolution, cohesive, and production-ready while preserving 2D assets as 2D assets and real-world assets as real-world assets.");

  lines.push("");
  lines.push("Output:");
  lines.push("");
  lines.push("One single cohesive poster");
  lines.push(`Aspect ratio: ${ratio}`);
  lines.push("Ultra clean, premium, production-ready quality");

  return lines.join("\n").trim();
}


function buildVisualAdsStructuredAppendix(spec: VisualAdsSpec): string {
  const sections: string[] = [];
  const assets = spec.assets || [];
  const allowedText = (spec.text_policy?.allowed_text || []).filter(Boolean);
  const allowedFeatureLabels = (spec.text_policy?.allowed_feature_labels || []).filter(Boolean);

  const addSection = (title: string, lines: Array<string | null | undefined>) => {
    const validLines = lines.filter((line): line is string => Boolean(line && line.trim()));
    if (!validLines.length) return;
    sections.push([title, ...validLines].join("\n"));
  };

  addSection("STRUCTURED_INPUT_APPENDIX", [
    "- purpose: Supporting structured summary of the approved Poster Ads inputs.",
    "- precedence: Structured asset, campaign, style, composition, text, and hard-constraint inputs are authoritative. If any generic frontend brief conflicts with them, the structured input wins.",
    spec.objective ? `- objective: ${spec.objective}` : null,
    spec.language ? `- language: ${spec.language}` : null,
    spec.aspect_ratio ? `- aspect_ratio: ${spec.aspect_ratio}` : null,
  ]);

  addSection("SOURCE_REFERENCE_MAP", assets.map((asset, index) => {
    const sourceKey = getSourceKey(asset, index);
    const details = [
      `role=${getRoleLabel(asset)}`,
      `purpose=${getRolePurpose(spec, asset, sourceKey)}`,
      asset.person_mode ? `person_mode=${asset.person_mode}` : null,
      asset.pose_mode ? `pose_mode=${asset.pose_mode}` : null,
      asset.reference_style ? `reference_style=${asset.reference_style}` : null,
      asset.logo_mode ? `logo_mode=${asset.logo_mode}` : null,
      asset.screenshot_device ? `screenshot_device=${asset.screenshot_device}` : null,
    ].filter(Boolean).join("; ");
    return `- ${sourceKey}: ${details}`;
  }));

  addSection("CAMPAIGN_SUMMARY", [
    spec.campaign?.main_message_id ? `- main_message_id: ${spec.campaign.main_message_id}` : null,
    spec.campaign?.main_message_prompt ? `- main_message_prompt: ${spec.campaign.main_message_prompt}` : null,
    spec.campaign?.main_message_custom_text ? `- main_message_custom_text: ${spec.campaign.main_message_custom_text}` : null,
    spec.campaign?.main_message_detail_id ? `- main_message_detail_id: ${spec.campaign.main_message_detail_id}` : null,
    spec.campaign?.main_message_detail_prompt ? `- main_message_detail_prompt: ${spec.campaign.main_message_detail_prompt}` : null,
    spec.campaign?.feature_chips?.length ? `- feature_chips: ${spec.campaign.feature_chips.join(", ")}` : null,
    spec.campaign?.require_exact_feature_chips != null ? `- require_exact_feature_chips: ${spec.campaign.require_exact_feature_chips}` : null,
    spec.campaign?.cta_id ? `- cta_id: ${spec.campaign.cta_id}` : null,
    spec.campaign?.cta_text ? `- cta_text: ${spec.campaign.cta_text}` : null,
    spec.campaign?.cta_prompt ? `- cta_prompt: ${spec.campaign.cta_prompt}` : null,
  ]);

  addSection("STYLE_SUMMARY", [
    spec.style?.primary_style_id ? `- primary_style_id: ${spec.style.primary_style_id}` : null,
    spec.style?.primary_style_prompt ? `- primary_style_prompt: ${spec.style.primary_style_prompt}` : null,
    spec.style?.primary_style_custom_text ? `- primary_style_custom_text: ${spec.style.primary_style_custom_text}` : null,
    spec.style?.style_detail_id ? `- style_detail_id: ${spec.style.style_detail_id}` : null,
    spec.style?.style_detail_prompt ? `- style_detail_prompt: ${spec.style.style_detail_prompt}` : null,
  ]);

  addSection("COMPOSITION_SUMMARY", [
    spec.composition?.layout_type ? `- layout_type: ${spec.composition.layout_type}` : null,
    spec.composition?.primary_subjects?.length ? `- primary_subjects: ${spec.composition.primary_subjects.join(", ")}` : null,
    spec.composition?.secondary_subjects?.length ? `- secondary_subjects: ${spec.composition.secondary_subjects.join(", ")}` : null,
    spec.composition?.background_source ? `- background_source: ${spec.composition.background_source}` : null,
    spec.composition?.logo_source ? `- logo_source: ${spec.composition.logo_source}` : null,
    spec.composition?.face_must_remain_visible != null ? `- face_must_remain_visible: ${spec.composition.face_must_remain_visible}` : null,
    spec.composition?.device_must_not_block_face != null ? `- device_must_not_block_face: ${spec.composition.device_must_not_block_face}` : null,
    spec.composition?.must_feel_unified != null ? `- must_feel_unified: ${spec.composition.must_feel_unified}` : null,
  ]);

  addSection("TEXT_POLICY_SUMMARY", [
    allowedText.length ? `- allowed_text: ${allowedText.join(", ")}` : null,
    allowedFeatureLabels.length ? `- allowed_feature_labels: ${allowedFeatureLabels.join(", ")}` : null,
    spec.text_policy?.text_presence_id ? `- text_presence_id: ${spec.text_policy.text_presence_id}` : null,
    spec.text_policy?.text_presence_prompt ? `- text_presence_prompt: ${spec.text_policy.text_presence_prompt}` : null,
    spec.text_policy?.text_color_style_id ? `- text_color_style_id: ${spec.text_policy.text_color_style_id}` : null,
    spec.text_policy?.text_color_style_prompt ? `- text_color_style_prompt: ${spec.text_policy.text_color_style_prompt}` : null,
    spec.text_policy?.allow_generated_headline != null ? `- allow_generated_headline: ${spec.text_policy.allow_generated_headline}` : null,
    spec.text_policy?.allow_generated_tagline != null ? `- allow_generated_tagline: ${spec.text_policy.allow_generated_tagline}` : null,
    spec.text_policy?.allow_generated_social_proof_copy != null ? `- allow_generated_social_proof_copy: ${spec.text_policy.allow_generated_social_proof_copy}` : null,
    spec.text_policy?.allow_generated_testimonials != null ? `- allow_generated_testimonials: ${spec.text_policy.allow_generated_testimonials}` : null,
  ]);

  addSection("HARD_CONSTRAINTS_SUMMARY", [
    spec.hard_constraints?.must_follow_tagged_roles != null ? `- must_follow_tagged_roles: ${spec.hard_constraints.must_follow_tagged_roles}` : null,
    spec.hard_constraints?.must_preserve_exact_person_identity != null ? `- must_preserve_exact_person_identity: ${spec.hard_constraints.must_preserve_exact_person_identity}` : null,
    spec.hard_constraints?.must_preserve_reference_person_anchor != null ? `- must_preserve_reference_person_anchor: ${spec.hard_constraints.must_preserve_reference_person_anchor}` : null,
    spec.hard_constraints?.must_preserve_reference_person_silhouette != null ? `- must_preserve_reference_person_silhouette: ${spec.hard_constraints.must_preserve_reference_person_silhouette}` : null,
    spec.hard_constraints?.must_preserve_reference_person_styling != null ? `- must_preserve_reference_person_styling: ${spec.hard_constraints.must_preserve_reference_person_styling}` : null,
    spec.hard_constraints?.must_preserve_reference_pose_direction != null ? `- must_preserve_reference_pose_direction: ${spec.hard_constraints.must_preserve_reference_pose_direction}` : null,
    spec.hard_constraints?.must_preserve_logo_fidelity != null ? `- must_preserve_logo_fidelity: ${spec.hard_constraints.must_preserve_logo_fidelity}` : null,
    spec.hard_constraints?.must_keep_logo_flat_and_fully_visible != null ? `- must_keep_logo_flat_and_fully_visible: ${spec.hard_constraints.must_keep_logo_flat_and_fully_visible}` : null,
    spec.hard_constraints?.must_preserve_screenshot_fidelity != null ? `- must_preserve_screenshot_fidelity: ${spec.hard_constraints.must_preserve_screenshot_fidelity}` : null,
    spec.hard_constraints?.must_preserve_background_identity != null ? `- must_preserve_background_identity: ${spec.hard_constraints.must_preserve_background_identity}` : null,
    spec.hard_constraints?.allow_invented_text != null ? `- allow_invented_text: ${spec.hard_constraints.allow_invented_text}` : null,
    spec.hard_constraints?.allow_invented_names != null ? `- allow_invented_names: ${spec.hard_constraints.allow_invented_names}` : null,
    spec.hard_constraints?.allow_invented_testimonials != null ? `- allow_invented_testimonials: ${spec.hard_constraints.allow_invented_testimonials}` : null,
    spec.hard_constraints?.hard_constraints_override_style != null ? `- hard_constraints_override_style: ${spec.hard_constraints.hard_constraints_override_style}` : null,
    spec.hard_constraints?.priority_order?.length ? `- priority_order: ${spec.hard_constraints.priority_order.join(" > ")}` : null,
  ]);

  return sections.join("\n\n").trim();
}

function buildVisualAdsPriorityReinforcement(spec: VisualAdsSpec): string {
  const lines: string[] = [];
  const hard = spec.hard_constraints;
  const assets = spec.assets || [];
  const hasIllustrationOrMascot = assets.some((asset) => {
    const role = (asset.role || "").toLowerCase();
    return role === "illustration" || role === "mascot";
  });
  const hasScreenshot = assets.some((asset) => (asset.role || "").toLowerCase() === "screenshot");
  const hasProduct = assets.some((asset) => (asset.role || "").toLowerCase() === "product");
  const hasIcon = assets.some((asset) => (asset.role || "").toLowerCase() === "icon");
  const hasTexture = assets.some((asset) => (asset.role || "").toLowerCase() === "texture");
  const layoutType = (spec.composition?.layout_type || "").toLowerCase();
  const campaignId = (spec.campaign?.main_message_id || "").toLowerCase();

  if (hard?.must_preserve_exact_person_identity) {
    lines.push("- exact_person_identity: Any person tagged as exact is a fixed identity asset. Preserve the exact face and the exact original art style with no face swap, no replacement identity, and no style conversion.");
  }
  if (hard?.must_preserve_reference_person_anchor || hard?.must_preserve_reference_person_silhouette || hard?.must_preserve_reference_person_styling || hard?.must_preserve_reference_pose_direction) {
    lines.push("- reference_person_anchor: Any person tagged as reference must stay clearly anchored to the uploaded source. Preserve the source face direction, silhouette, styling, accessories, and pose direction. Do not replace them with a generic different person.");
  }
  if (hasScreenshot) {
    lines.push("- screenshot_cleanup: Remove uploader chrome, Image 1/2 boxes, red X icons, browser chrome, and recursive interface artifacts. Only the inner app content may appear inside the selected device mockup.");
  }
  if (hard?.must_preserve_logo_fidelity || hard?.must_keep_logo_flat_and_fully_visible) {
    lines.push("- logo_fidelity: Any uploaded logo must remain a flat protected brand mark, fully visible, uncropped, and not transformed into an object, prop, badge, sticker, sculpture, or scenic design element.");
  }
  if (hard?.must_preserve_screenshot_fidelity) {
    lines.push("- screenshot_fidelity: Any uploaded screenshot must remain unchanged, readable, and free from UI redesign or distortion.");
  }
  if (hard?.must_preserve_background_identity) {
    lines.push("- background_identity: Any uploaded background must remain the real base scene and must not be swapped for a different environment.");
  }
  if (hasIllustrationOrMascot) {
    lines.push("- vector_preservation: Any illustration or mascot must preserve its flat/vector/hand-drawn 2D nature and must not be transformed into a 3D real-world object.");
  }
  if (layoutType === "screenshot-led-poster") {
    lines.push("- screenshot_led_hierarchy: In screenshot-led layouts, the screenshot or device must remain one of the dominant first-read subjects and supporting assets must not overpower it.");
  }
  if (hasProduct) {
    lines.push("- product_fidelity: Any uploaded product must preserve its exact package shape, materials, silhouette, and recognizable branded form with no redesign or substitution.");
  }
  if (hasIcon) {
    lines.push("- icon_flatness: Any uploaded icon must remain crisp, flat, and supportive rather than being inflated into a 3D object or dominant hero.");
  }
  if (hasTexture) {
    lines.push("- texture_subordination: Any uploaded texture must remain a subtle supporting texture layer and must not become a literal object or replacement backdrop.");
  }
  if (campaignId === "features" && (spec.campaign?.feature_chips || []).length > 0) {
    lines.push("- feature_layout: Render the approved feature chips once each as concise feature callouts or benefit labels. Keep them outside important screenshot UI and do not duplicate them.");
  }
  if ((spec.text_policy?.allowed_text || []).length > 0) {
    lines.push("- approved_text_only: Any new poster text must come only from the approved allowed-text list. Do not add extra copy and do not repeat the same approved phrase multiple times.");
  }
  if (campaignId === "sale" || campaignId === "limited-offer") {
    lines.push("- offer_hierarchy: Keep urgency and CTA visually clear without inventing prices, discount percentages, coupon codes, or extra offer text.");
  }

  return lines.join("\n").trim();
}


function _compileVisualAdsPrompt(spec: VisualAdsSpec, frontendCompiledPrompt: string): string {
  const hasStructuredAssets = (spec.assets || []).length > 0;
  if (hasStructuredAssets) {
    const sections = [
      compileVisualAdsFallbackPrompt(spec, ""),
      buildVisualAdsPriorityReinforcement(spec)
        ? ["Priority Reinforcement:", "", buildVisualAdsPriorityReinforcement(spec)].join("\n")
        : "",
      buildVisualAdsStructuredAppendix(spec),
    ].filter((section) => section.trim().length > 0);
    return sections.join("\n\n").trim();
  }

  const authoritativePrompt = (frontendCompiledPrompt || spec.legacy_prompt || "").trim();
  if (!authoritativePrompt) {
    return compileVisualAdsFallbackPrompt(spec, frontendCompiledPrompt);
  }

  return authoritativePrompt;
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

async function _checkAndConsumeTrialToken(serviceClient: any, userId: string, featureKey: TrialFeatureKey, maxLimit: number): Promise<boolean> {
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
    const serviceDb: any = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await authedClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
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

    const imageList = Array.isArray(body?.images)
      ? body.images.filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
      : [];
    const rawImages = imageList;

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

    const spec = _normalizeVisualAdsSpec(body);
    const frontendCompiledPrompt = typeof body?.prompt === "string"
      ? sanitizeUserInput(body.prompt, 20000)
      : "";
    const finalPrompt = _compileVisualAdsPrompt(spec, frontendCompiledPrompt);
    if (!finalPrompt) {
      return new Response(JSON.stringify({ error: "Missing prompt for visual ads" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const promptSafety = inspectGenerationPrompt(finalPrompt, body?.language === "ar" ? "ar" : "en");
    if (!promptSafety.allowed) {
      return new Response(JSON.stringify({ error: promptSafety.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aspectRatio = ["1:1", "16:9", "9:16"].includes(body?.aspect_ratio || "") ? body.aspect_ratio : "1:1";
    const callbackUrl = `${supabaseUrl}/functions/v1/webhook-visual-ads`;

    const requestBody = {
      model: KIE_VISUAL_ADS_MODEL,
      input: {
        prompt: promptSafety.normalizedPrompt,
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

    const createText = await createRes.text();
    console.log(`[freepik-visual-ads] KIE create response ${createRes.status}: ${createText.slice(0, 1000)}`);

    if (!createRes.ok) {
      throw new Error(`Visual ads generation service error ${createRes.status}: ${createText}`);
    }

    let createData: KieCreateResponse;
    try {
      createData = JSON.parse(createText) as KieCreateResponse;
    } catch {
      throw new Error(`Visual ads generation service returned an invalid response: ${createText.slice(0, 300)}`);
    }
    if (createData.code !== 200 || !createData.data?.taskId) {
      throw new Error(sanitizeError(createData.msg || createData.message || "Failed to create task"));
    }

    const { error: insertErr } = await serviceDb.from("visual_ads_jobs").insert({
      user_id: user.id,
      task_id: createData.data.taskId,
      status: "waiting",
    });
    if (insertErr) {
      throw new Error(`Failed to register visual ads job: ${insertErr.message || "insert failed"}`);
    }

    return new Response(JSON.stringify({
      ok: true,
      task_id: createData.data.taskId,
      status: "waiting",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const rawMsg = error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : (() => {
        try {
          return JSON.stringify(error);
        } catch {
          return "Unknown error";
        }
      })();
    console.error("[freepik-visual-ads] Error:", rawMsg);
    return new Response(JSON.stringify({ error: sanitizeError(rawMsg) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
