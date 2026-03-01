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

// Style seeds — rich visual direction. Indexed for keyword mapping.
const STYLE_SEEDS: Record<string, string> = {
  // Dark themes
  "dark":          "Dark mode: deep #0c0f14 background, white text, subtle blue/purple gradient accents on bullet cards, premium dark feel",
  "cinematic":     "Cinematic widescreen: dark #0a0a0f background with a faint horizontal light streak, massive bold white title, bullet cards with thin glowing left borders in electric blue, film-grade typography",
  "neon":          "Neon city night: dark charcoal #1a1a2e background, neon pink #ff2d78 and cyan #00f5ff glow effects on bullet cards and title, white text, intense glow text-shadow on title",
  "dark cinematic":"Cinematic widescreen dark: pure black with subtle vignette radial gradient, bold near-white title, thin gold accent lines, dramatic",
  // Light themes
  "light":         "Bright editorial: clean white #ffffff background, dark navy #1e3a5f title text, sky blue #0ea5e9 6px left borders on bullets, light gray bullet card backgrounds, professional",
  "minimal":       "Ultra-minimal: pure white background, jet black title in thin geometric font, light gray #f3f4f6 bullet cards with 1px border, zero decoration except a single brand-color accent line under title",
  // Colors
  "colorful":      "Vibrant rainbow editorial: gradient background shifting from deep blue to violet to orange, white text throughout, each bullet card has a different vivid accent color (blue/teal/orange/pink/green)",
  "vibrant":       "Vibrant energy: rich deep purple #1a0533 background, each bullet gets a unique vivid gradient (cyan→blue, orange→red, green→teal), white bold text, glowing title in gold",
  "gradient":      "Gradient rich: background is a dramatic diagonal gradient from deep indigo #1e1b4b to violet #4c1d95 to midnight #0c0f14, white text, bullet cards have gradient left borders",
  "monochrome":    "Monochrome editorial: pure black #000000 background, white #ffffff text throughout, bullet cards have white 1px borders, white left accent bars, zero color — only pure B&W contrast",
  // Tech
  "futuristic":    "Futuristic sci-fi: deep space #050510 background with faint blue grid lines, holographic-style title text with blue glow, bullet cards look like HUD panels (thin cyan #00f5ff borders), monospace font hints",
  "glassmorphism": "Glassmorphism: dark #0f172a background, frosted-glass bullet cards (background: rgba(255,255,255,0.08); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.15)), white text, blurred glowing orbs in bg",
  "matrix":        "Matrix digital: pure black background, bright green #00ff41 monospace text for bullets, dark green #003b00 card backgrounds, green glow title, like a terminal screen",
  "techy":         "Technical dashboard: dark slate #1e293b background, indigo #6366f1 accent bars on bullets, clean sans-serif font, data-viz feel with subtle grid pattern in background",
  // Premium
  "premium":       "Premium luxury: very dark near-black #0a0a0a background, gold #d4af37 accent borders and decorative lines, warm cream #f5f0e8 text, serif or elegant sans font, elegant spacing",
  "luxury":        "Ultra luxury: black #000000 background, gold metallic gradient text on title, thin gold borders on every bullet card, champagne #f7e7ce text body, a subtle gold dot pattern in bg",
  "elegant":       "Elegant refined: dark charcoal #1c1917 background, rose-gold gradient title, soft blush #fecdd3 left borders on bullets, light cream text, luxury serif font",
  // Mood
  "energetic":     "High energy sports: bold black #0a0a0a background with diagonal energy lines in orange/red, explosive orange #f97316 and red #ef4444 accents on bullet cards, heavy bold white title text, dynamic feel",
  "dynamic":       "Dynamic motion: deep blue-black background with diagonal slash graphic elements, yellow #facc15 and white contrast bullets, heavy bold typography, sporty aggressive layout",
  "bold":          "Bold impact: pure black background, massive oversized white title, bullet cards have thick 8px left borders alternating between hot orange #f97316 and electric blue #3b82f6, heavy typography",
  "action":        "Action sports: black #000000 background with subtle carbon fiber texture via CSS repeating-gradient, bold red #dc2626 and white, slash/angle design elements, aggressive typography",
  "immersive":     "Immersive full-bleed: background is a very dark radial gradient from deep violet center to black edges, the title gets a multicolor gradient text treatment (CSS background-clip:text), no obvious borders just glowing text. Full-bleed cinematic feel.",
  // Emotion
  "inspiring":     "Inspiring motivational: deep navy #0f172a background, warm golden yellow #fbbf24 title accent, white text, bullet cards have a subtle sunrise gradient left border (yellow to orange), uplifting feel",
  "calming":       "Calm serene: deep teal-to-navy gradient #0f2027→#203a43→#2c5364, soft aqua #7dd3fc accents on bullets, gentle rounded cards, white text, peaceful and clean",
  "warm":          "Warm and welcoming: rich dark brown #1c0a00 to dark coffee #3b1f0a gradient, amber #f59e0b and burnt orange #ea580c left borders, cream #fef3c7 text, cozy feel",
  "dramatic":      "Dramatic theatrical: pure black background, deep crimson #991b1b slash graphic across corner, white title with subtle red text-shadow, bullet cards with deep red borders, intense",
  "hopeful":       "Hopeful fresh: midnight blue #0c1445 background, bright lime green #4ade80 and sky blue #38bdf8 alternating left borders on bullets, clean white text, fresh and optimistic",
  "clean":         "Clean clinical: pure white #ffffff background, dark navy #0f172a text, light blue #e0f2fe bullet card backgrounds, thin blue left borders, ultra clear typography, medical/science feel",
  // Business
  "executive":     "Executive boardroom: very dark navy #0a1628 background, electric blue #2563eb 6px left sidebar accent on all bullets, clean white text, authoritative and decisive",
  "corporate":     "Corporate professional: dark #1e293b background, steel blue #3b82f6 accents, clean white text, structured card layout, subtle grid background",
  "trustworthy":   "Trustworthy authority: deep navy #1e3a5f background, clean white bullet cards with navy text, sky blue #0ea5e9 left borders, authoritative serif font for title, professional",
  "scholarly":     "Academic scholarly: deep indigo #1e1b4b background, warm amber #f59e0b decorative borders, white text, structured grid layout, academic feel",
  "structured":    "Structured clarity: dark slate background, clean white bullet cards with thin borders, each card numbered, systematic and organized feel",
  "infographic":   "Infographic visual: dark #111827 background, each bullet card gets a unique accent color and a large icon-placeholder circle on the left, data visualization aesthetic",
  // Nature
  "organic":       "Organic natural: deep forest green #052e16 to dark emerald gradient, bright lime #86efac left borders on bullets, white text, earthy botanical feel",
  "eco":           "Eco sustainable: dark green #064e3b background, bright green #34d399 accents, white text, clean nature-inspired layout",
  "earthy":        "Earthy warm: dark soil brown #1c0a00 background, terracotta #c2410c and sand #d97706 accents on bullets, cream text, grounded natural feel",
  "adventurous":   "Adventure expedition: dark slate blue #0c1445 background, sunset orange #f97316 accent bars, white bold text, map-compass aesthetic touches",
  "wanderlust":    "Wanderlust travel: deep midnight blue background with faint star/globe CSS pattern, warm gold #fbbf24 and sky blue #38bdf8 bullet accents, white text, expansive feel",
  "vintage":       "Vintage editorial: dark sepia #1c1208 background, old gold #b7791f borders, aged cream #fef3c7 text, serif font, textured feel",
  "documentary":   "Documentary film: black background, white title in heavy documentary font, subtitle in yellow #fbbf24, bullet cards with simple white left bars, film-reel feel",
  // Creative
  "artistic":      "Artistic creative: dark #0f0f23 background with abstract paint-splash CSS gradient, multicolor bullet card borders (each different: blue/pink/yellow/green/orange), expressive typography",
  "editorial":     "Editorial magazine: off-white #fafafa background, bold oversized dark title, clean minimal bullet cards with thin black borders, magazine-spread aesthetic",
  "retro":         "Retro vintage: dark navy #1a1a2e background, neon pink #ff006e and yellow #ffd60a accents, chunky bold font, 80s vibe with subtle scanline CSS effect",
  "typographic":   "Typographic focus: black background, large oversized white type, minimal decoration, the typography IS the design — vary weights from ultra-thin to ultra-bold",
  // Food/hospitality
  "appetizing":    "Appetizing culinary: dark chocolate #1c0a00 to deep burgundy gradient, rich amber #f59e0b accents, cream white text, warm and luxurious food feel",
  "luxe":          "Luxe hospitality: deep black #050505 background, champagne gold #f7e7ce title, thin rose-gold borders on bullets, ultra premium feel",
  // Role-based
  "memorable":     "Memorable closing: very dark #0a0a14 background, gradient title text (gold to rose-gold), large centered layout, bullet cards replaced by elegant feature lines, closing slide grandeur",
  "photo-forward": "Photo forward: image takes full left half as absolute positioned column (object-fit:cover), right half is dark semi-transparent overlay on dark bg, white text, dramatic photo-focused layout",
  "data-driven":   "Data dashboard: dark #0f172a background, each bullet card styled like a data metric tile — bold number/stat highlighted in cyan #22d3ee, supporting text below, grid layout",
  // Special
  "wakti brand":   "Wakti AI brand: #0c0f14 background, #f2f2f2 text, hsl(210,100%,65%) blue and hsl(280,70%,65%) purple glowing gradient accents",
};

// Fallback seeds when no keyword matches (randomly picked for variety)
const _FALLBACK_SEEDS = [
  "dark cinematic: deep navy-to-black gradient background, electric blue accent lines on bullet cards, pure white text",
  "luxury dark: rich near-black background, gold (#d4af37) accent borders and left-bar on bullets, warm cream (#f5f0e8) text",
  "neon city: dark charcoal (#1a1a2e) background, neon pink (#ff2d78) and cyan (#00f5ff) glow on bullet cards, white text",
  "deep ocean: dark teal-to-navy gradient, frosted glass bullet cards (rgba white 0.1 bg + white border), bright white text, coral accents",
  "ember warm: dark brown-to-black gradient, burnt orange (#e85d04) and amber (#f48c06) left borders on bullets, cream text",
  "aurora: very dark purple (#0d0221) to midnight blue gradient, multicolor gradient title (pink to purple to cyan via background-clip:text), white bullet text",
  "slate professional: dark slate (#1e293b) background, indigo (#6366f1) 6px left sidebar stripe accent, clean white text",
  "volcanic: dark charcoal (#1c1917) background, hot orange-to-red gradient as 6px left border on bullet cards, white text",
  "arctic minimal: off-white (#f8fafc) background, dark navy (#0f172a) text, bold blue (#3b82f6) title, clean white bullet cards with subtle shadow",
  "corporate light: pure white background, dark navy (#1e3a5f) header area, accent color (#0ea5e9) 4px left borders on bullets, dark text",
  "midnight rose: very dark (#0f0014) background, rose-gold gradient title text, dusty pink (#f9a8d4) left borders on bullets, soft white body text",
  "wakti dark brand: #0c0f14 background, #f2f2f2 text, blue hsl(210,100%,65%) and purple hsl(280,70%,65%) glowing accents on bullets",
];

function buildPrompt(slide: Slide, isRtl: boolean, styleSeed: string, _keywords?: string[], note?: string): string {
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

  // User note overrides layout logic too — parse image intent from it
  const noteStr = note ? note.toLowerCase() : "";
  const userWantsPhotoFull = noteStr.includes("full") && (noteStr.includes("photo") || noteStr.includes("image") || noteStr.includes("bg") || noteStr.includes("background"));
  const userWantsPhotoLeft = (noteStr.includes("photo") || noteStr.includes("image")) && (noteStr.includes("left") || noteStr.includes("side"));
  const userWantsPhotoBg = (noteStr.includes("photo as bg") || noteStr.includes("use photo") || noteStr.includes("image as bg") || noteStr.includes("background photo") || noteStr.includes("full-bleed") || noteStr.includes("full bleed") || noteStr.includes("cover"));

  let layoutHint: string;
  if (hasImage && (userWantsPhotoBg || userWantsPhotoFull)) {
    layoutHint = "LAYOUT: Full-bleed background photo — image covers entire 1920x1080 as position:absolute top:0 left:0 width:100% height:100% object-fit:cover. Dark semi-transparent overlay (rgba(0,0,0,0.55)) over entire slide. All text centered or left-aligned on top of overlay.";
  } else if (hasImage && userWantsPhotoLeft) {
    layoutHint = "LAYOUT: Split — image on left (45% width, full height, object-fit:cover), content (title + bullets) on right (55% width).";
  } else if (hasImage && hasBullets) {
    layoutHint = "LAYOUT: Split — image on one side (40-45% width, full height), content on the other side. Side-by-side, never stacked.";
  } else if (!hasImage && bullets.length >= 4) {
    layoutHint = "LAYOUT: Left title column (~35% width) + right stacked bullet cards column (~60% width).";
  } else if (!hasImage && bullets.length > 0) {
    layoutHint = "LAYOUT: Centered hero — large title top third, bullets below in clean rows, generous whitespace.";
  } else {
    layoutHint = "LAYOUT: Cover slide — full-bleed background, massive centered title, no bullet area.";
  }

  // Build the user design directive section — this is THE TOP PRIORITY
  const userDesignSection = note ? `
⚠️ PRIMARY DESIGN DIRECTIVE — HIGHEST PRIORITY — FOLLOW EXACTLY:
"${note}"
This overrides any default style. Build the entire slide around this instruction first.
Every design decision (background, layout, colors, typography, effects) must serve this directive.
` : "";

  return `You are a senior front-end engineer AND award-winning slide designer.
Task: generate a COMPLETE standalone HTML document for a 1920x1080 presentation slide.
Treat every rule below as a hard compiler constraint — violating any rule = broken output.
${userDesignSection}
--- CREATIVE STYLE REFERENCE (secondary — overridden by PRIMARY DIRECTIVE above) ---
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
- If PRIMARY DIRECTIVE says use photo as background: image is position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:0; with a dark overlay div on top.
- Otherwise: Minimum 40% of slide width as a full-height side column.
- object-fit:cover; object-position:center;
- Never inline with text flow.

[BULLETS]
- Render EVERY bullet — never skip or truncate.
- Each bullet: its own styled card/row. Must have either a colored left border (6-8px solid) OR a colored background.
- Bullet icon: small colored square or circle before text (CSS only).
- If PRIMARY DIRECTIVE requests glassmorphism: background:rgba(255,255,255,0.1); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.2);

[BRANDING — mandatory]
- "Wakti AI" text: position:absolute; ${isRtl ? "right:24px" : "left:24px"}; bottom:20px; font-size:16px; opacity:0.55; font-weight:600; z-index:99;
- NO slide numbers anywhere.

[QUALITY CHECKLIST — verify before outputting]
- PRIMARY DIRECTIVE is fully implemented
- Title is 64px+ and visually dominant
- Every bullet is readable with strong contrast
- Image (if any) is used as instructed by PRIMARY DIRECTIVE
- No text directly on image without overlay
- Slide feels full — no large unused empty areas
- body has width:1920px; height:1080px; overflow:hidden
- Output starts with <!DOCTYPE html>

Fix any checklist failure before outputting.
`;

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

    // Resolve style seed: keywords take priority → map to specific seed → fallback to random
    const seedKeys = Object.keys(STYLE_SEEDS);
    let resolvedSeed: string;
    let seedKey = "random";

    if (keywords && keywords.length > 0) {
      // Find the first keyword that has a direct seed mapping (case-insensitive)
      const matched = keywords.find(k => STYLE_SEEDS[k.toLowerCase()]);
      if (matched) {
        resolvedSeed = STYLE_SEEDS[matched.toLowerCase()];
        seedKey = matched.toLowerCase();
      } else {
        // Combine all selected keyword descriptions into one fused seed
        const fusedParts = keywords
          .map(k => STYLE_SEEDS[k.toLowerCase()])
          .filter(Boolean)
          .slice(0, 2);
        if (fusedParts.length > 0) {
          resolvedSeed = `FUSED STYLE (apply all): ${fusedParts.join(' | ALSO: ')}` ;
          seedKey = keywords.join('+');
        } else {
          // Keywords don't match any seed — use them as free-text creative direction
          resolvedSeed = `Style keywords chosen by user: ${keywords.join(', ')}. Design the slide to visually embody these keywords — choose colors, typography, and decoration that strongly express these traits.`;
          seedKey = keywords.join('+');
        }
      }
    } else if (variation !== undefined && variation >= 0 && variation < seedKeys.length) {
      // Reuse same seed on re-enhance
      resolvedSeed = STYLE_SEEDS[seedKeys[variation]];
      seedKey = seedKeys[variation];
    } else {
      // No keywords, no variation — pick random
      const randomKey = seedKeys[Math.floor(Math.random() * seedKeys.length)];
      resolvedSeed = STYLE_SEEDS[randomKey];
      seedKey = randomKey;
    }

    const seedIndex = seedKeys.indexOf(seedKey);
    const prompt = buildPrompt(slide, isRtl, resolvedSeed, undefined, note);

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
          { role: "system", content: "You are a senior front-end engineer who generates pixel-perfect HTML slides. Output ONLY valid HTML starting with <!DOCTYPE html>. No markdown fences. No explanations. Every hard constraint in the user prompt is a must-pass requirement. When a PRIMARY DESIGN DIRECTIVE is given, implement it EXACTLY — do not water it down, do not substitute a generic design. The user's design instruction is law." },
          { role: "user", content: prompt },
        ],
        max_tokens: 4096,
        temperature: 0.85,
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
      JSON.stringify({ success: true, html, template: seedIndex >= 0 ? seedIndex : 0 }),
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
