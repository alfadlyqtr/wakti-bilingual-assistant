// @ts-nocheck: Deno/Supabase edge runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Inlined lightweight logger (avoids _shared import issues in MCP deployment)
async function logSlideEnhance(req: Request, status: "success" | "error", durationMs?: number, errorMsg?: string) {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const sb = createClient(url, key);
    let userId: string | null = null;
    try {
      const auth = req.headers.get("authorization") || "";
      const token = auth.replace(/^Bearer\s+/i, "");
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        userId = payload.sub || null;
      }
    } catch { /* ignore */ }
    await sb.rpc("log_ai_usage", {
      p_user_id: userId,
      p_function_name: "wakti-slide-enhance",
      p_model: "gpt-4o-mini",
      p_status: status,
      p_error_message: errorMsg || null,
      p_prompt: null,
      p_response: null,
      p_metadata: { provider: "openai" },
      p_input_tokens: 0,
      p_output_tokens: 0,
      p_duration_ms: durationMs || 0,
      p_cost_credits: 0,
    });
  } catch { /* never throw from logger */ }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Slide {
  slideNumber: number;
  title: string;
  subtitle?: string;
  bullets: string[];
  imageUrl?: string;
  role?: string;
  titleStyle?: { color?: string };
  subtitleStyle?: { color?: string };
  bulletStyle?: { color?: string };
  backgroundColor?: string;
  backgroundGradient?: string;
}

interface EnhanceRequest {
  slide: Slide;
  language: string;
  variation?: number;
  keywords?: string[];
  note?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Style seeds — color/mood direction only. All layout/sizing/contrast rules are locked below.
const STYLE_SEEDS = [
  "dark cinematic: deep navy-to-black gradient background, electric blue accent lines on bullet cards, pure white text",
  "luxury dark: rich near-black background, gold (#d4af37) accent borders and left-bar on bullets, warm cream (#f5f0e8) text",
  "neon city: dark charcoal (#1a1a2e) background, neon pink (#ff2d78) and cyan (#00f5ff) glow on bullet cards, white text",
  "deep ocean: dark teal-to-navy gradient, frosted glass bullet cards (rgba white 0.1 bg + white border), bright white text, coral accents",
  "ember warm: dark brown-to-black gradient, burnt orange (#e85d04) and amber (#f48c06) left borders on bullets, cream text",
  "aurora: very dark purple (#0d0221) to midnight blue gradient, multicolor gradient title (pink to purple to cyan via background-clip:text), white bullet text",
  "slate professional: dark slate (#1e293b) background, indigo (#6366f1) 6px left sidebar stripe accent, clean white text",
  "forest night: deep emerald (#022c22) to black gradient, bright lime-green (#4ade80) 6px left borders on bullets, white text",
  "crimson power: near-black (#0f0f0f) background, bold crimson (#dc2626) accent bars as bullet backgrounds at low opacity, white text",
  "chrome tech: dark metal (#111827) gradient, thin bright silver (#e5e7eb) borders on cards, cyan (#22d3ee) title accent, monospace-feel font",
  "midnight rose: very dark (#0f0014) background, rose-gold gradient title text, dusty pink (#f9a8d4) left borders on bullets, soft white body text",
  "volcanic: dark charcoal (#1c1917) background, hot orange-to-red gradient as 6px left border on bullet cards, white text",
  "arctic minimal: off-white (#f8fafc) background, dark navy (#0f172a) text, bold blue (#3b82f6) title, clean white bullet cards with subtle shadow",
  "corporate light: pure white background, dark navy (#1e3a5f) header area, accent color (#0ea5e9) 4px left borders on bullets, dark text",
  "sunrise editorial: warm cream (#fef3c7) background, deep burgundy (#7f1d1d) title text, muted gold (#d97706) bullet card backgrounds",
  "wakti dark brand: #0c0f14 background, #f2f2f2 text, blue hsl(210,100%,65%) and purple hsl(280,70%,65%) glowing accents on bullets",
  "wakti light brand: #fcfefd background, #060541 dark text, #e9ceb0 warm accent highlights on bullet cards, premium clean look",
];

function buildPrompt(slide: Slide, isRtl: boolean, styleSeed: string, keywords?: string[], note?: string): string {
  const dir = isRtl ? "rtl" : "ltr";
  const textAlign = isRtl ? "right" : "left";
  const bullets = slide.bullets?.map(b => escapeHtml(b)) || [];
  const bulletsJson = JSON.stringify(bullets);
  const titleEsc = escapeHtml(slide.title);
  const subtitleEsc = slide.subtitle ? escapeHtml(slide.subtitle) : "";
  const imgUrl = slide.imageUrl || "";
  const hasBullets = bullets.length > 0;
  const hasImage = !!imgUrl;

  let colorOverrides = "";
  if (slide.titleStyle?.color || slide.subtitleStyle?.color || slide.bulletStyle?.color || slide.backgroundColor || slide.backgroundGradient) {
    colorOverrides = `\nUSER COLOR OVERRIDES — USE THESE EXACT VALUES:`;
    if (slide.backgroundColor) colorOverrides += `\n  background-color: ${slide.backgroundColor}`;
    if (slide.backgroundGradient) colorOverrides += `\n  background: ${slide.backgroundGradient}`;
    if (slide.titleStyle?.color) colorOverrides += `\n  title color: ${slide.titleStyle.color}`;
    if (slide.subtitleStyle?.color) colorOverrides += `\n  subtitle color: ${slide.subtitleStyle.color}`;
    if (slide.bulletStyle?.color) colorOverrides += `\n  bullet text color: ${slide.bulletStyle.color}`;
    colorOverrides += `\n  (Add text-shadow or semi-transparent bg behind text if needed for readability)`;
  }

  const layoutHint = hasImage && hasBullets
    ? "LAYOUT: Split — image on one side (40-45% width, full height), content on the other side. Side-by-side, never stacked."
    : !hasImage && bullets.length >= 4
    ? "LAYOUT: Left title column (~35% width) + right stacked bullet cards column (~60% width)."
    : !hasImage && bullets.length > 0
    ? "LAYOUT: Centered hero — large title top third, bullets below in clean rows, generous whitespace."
    : "LAYOUT: Cover slide — full-bleed background, massive centered title, no bullet area.";

  return `You are a senior front-end engineer AND award-winning slide designer.
Task: generate a COMPLETE standalone HTML document for a 1920x1080 presentation slide.
Treat every rule below as a hard compiler constraint — violating any rule = broken output.

--- CREATIVE DIRECTION (color and mood only) ---
${styleSeed}

--- SLIDE CONTENT ---
Title: "${titleEsc}"
${subtitleEsc ? `Subtitle: "${subtitleEsc}"` : ""}
Bullets (render ALL of them): ${bulletsJson}
${hasImage ? `Image URL: ${imgUrl}` : "No image."}
Text direction: ${dir} | text-align: ${textAlign}${colorOverrides}

--- LAYOUT ---
${layoutHint}

--- HARD CONSTRAINTS ---

[OUTPUT]
- Output ONLY valid HTML. First character: <. Last character: >. Zero markdown. Zero explanation.
- Must start with <!DOCTYPE html> and end with </html>.

[DIMENSIONS — non-negotiable]
- html, body: width:1920px; height:1080px; margin:0; padding:0; overflow:hidden;
- Everything must fit within 1920x1080. Nothing overflows.

[FONTS]
- Import 1-2 Google Fonts via @import in a <style> tag that match the style direction.
- ONLY <style> block + inline styles. No external CSS files. No JavaScript.

[SIZING — non-negotiable numbers]
- Cover/title slide title: font-size 88px-110px
- Content slide title: font-size 64px-80px
- Subtitle: font-size 32px-42px
- Bullet text: font-size 26px-34px
- Bullet card: min-height:68px; padding:16px 28px;
- Gap between bullets: 12px-18px
- Title area: minimum 22% of slide height

[CONTRAST — zero tolerance]
- Light text on dark bg OR dark text on light bg. Never same-tone.
- Text over image: mandatory semi-transparent overlay div (rgba(0,0,0,0.65) or higher) covering that region.
- text-shadow: 0 2px 8px rgba(0,0,0,0.75) on ALL text elements.
- Bullet card text: always #ffffff or #0a0a0a depending on card background.

[IMAGE — if provided]
- Minimum 40% of slide width as a full-height side column.
- object-fit:cover; object-position:center;
- Position as position:absolute column or flex column — never inline with text flow.

[BULLETS]
- Render EVERY bullet — never skip or truncate.
- Each bullet: its own styled card/row. Must have either a colored left border (6-8px solid) OR a colored background.
- Bullet icon: small colored square or circle before text (CSS only).

[BRANDING — mandatory]
- "Wakti AI" text: position:absolute; ${isRtl ? "right:24px" : "left:24px"}; bottom:20px; font-size:16px; opacity:0.55; font-weight:600; z-index:99;
- NO slide numbers anywhere.

[QUALITY CHECKLIST — verify before outputting]
- Title is 64px+ and visually dominant
- Every bullet is readable with strong contrast
- Image (if any) takes at least 40% of slide width
- No text directly on image without overlay
- Slide feels full — no large unused empty areas
- body has width:1920px; height:1080px; overflow:hidden
- Output starts with <!DOCTYPE html>

Fix any checklist failure before outputting.
${keywords && keywords.length > 0 ? `
[USER KEYWORDS - soft guidance, apply if they don't break constraints above]
The user selected these design keywords: ${keywords.join(', ')}.
Use them to shape the color, mood, and style - but NEVER at the cost of contrast, sizing, or layout rules.` : ''}
${note ? `
[USER NOTE - lowest priority, apply only if safe]
"${note}"` : ''}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: EnhanceRequest = await req.json();
    const { slide, language, variation, keywords, note } = body;
    
    if (!slide) {
      return new Response(
        JSON.stringify({ success: false, error: "Slide data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isRtl = language === "ar";

    // If variation is provided (update), reuse the same style seed for consistency
    // Otherwise pick a random one for fresh enhancements
    const seedIndex = (variation !== undefined && variation >= 0 && variation < STYLE_SEEDS.length)
      ? variation
      : Math.floor(Math.random() * STYLE_SEEDS.length);
    const styleSeed = STYLE_SEEDS[seedIndex];

    const prompt = buildPrompt(slide, isRtl, styleSeed, keywords, note);

    const startTime = Date.now();

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a senior front-end engineer who generates pixel-perfect HTML slides. Output ONLY valid HTML starting with <!DOCTYPE html>. No markdown fences. No explanations. Every hard constraint in the user prompt is a must-pass requirement — treat them like compiler errors." },
          { role: "user", content: prompt },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[wakti-slide-enhance] OpenAI error:", aiResp.status, errText);
      throw new Error(`AI generation failed: ${aiResp.status}`);
    }

    const aiJson = await aiResp.json();
    let html = aiJson.choices?.[0]?.message?.content?.trim() || "";

    // Strip any markdown fences the model might have added
    if (html.startsWith("```")) {
      html = html.replace(/^```(?:html)?\n?/, "").replace(/\n?```$/, "");
    }

    // Basic validation
    if (!html.includes("<html") && !html.includes("<div")) {
      throw new Error("AI did not generate valid HTML");
    }

    const durationMs = Date.now() - startTime;

    await logSlideEnhance(req, "success", durationMs);

    return new Response(
      JSON.stringify({ success: true, html, template: seedIndex }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error enhancing slide:", error);

    await logSlideEnhance(req, "error", undefined, (error as Error).message);

    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message || "Enhancement failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
