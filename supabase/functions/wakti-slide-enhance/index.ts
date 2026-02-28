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
  variation?: number; // Used to keep the same style seed when updating
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Style seeds — each call picks a random one so the AI always gets a fresh creative direction
const STYLE_SEEDS = [
  "neon cyberpunk with dark background, glowing cyan and magenta accents",
  "warm editorial with cream background, burgundy accents, classic book feel",
  "ocean gradient flowing teal-to-blue, frosted glass bullet cards, organic wave shapes",
  "sunset bold with hot red-to-orange gradient, giant slide numbers in background",
  "nature clean white background with forest green dots, minimal and airy",
  "royal purple deep gradient with gold accents, concentric circle decorations",
  "pastel pop with rainbow-colored bullet cards, 2-column grid layout, light gradient bg",
  "newspaper broadsheet classic print style, double-border frame, column text layout, sepia tones",
  "aurora borealis dark with multi-color gradient title text, color-coded side bars per bullet",
  "monochrome brutalist stark black and white, numbered dividers, grayscale image",
  "glass morphism with frosted glass card over blurred image background, soft glow",
  "retro 70s groovy with warm yellows and oranges, large colored circles in bg",
  "art deco gatsby gold lines on dark navy, geometric patterns, elegant thin borders",
  "terminal hacker green-on-black monospace code aesthetic, blinking cursor",
  "watercolor artistic with soft painted edges, splatter shapes, muted earth tones",
  "memphis design with bold shapes, primary colors, playful patterns, squiggly decorations",
  "japanese zen minimalism, lots of whitespace, single ink stroke accent, stone textures",
  "vaporwave aesthetic with pink-purple gradients, retro grid floor, chrome text effects",
  "blueprint technical drawing style, white lines on deep blue, grid background",
  "luxury magazine glossy black with subtle gold typography, high contrast image treatment",
  "comic book pop art with halftone dots, bold outlines, speech-bubble styled bullets",
  "dark forest with deep emerald-to-black gradient, firefly particles, natural mossy textures",
  "candy gradient with bright pink to violet to blue, pill-shaped bullet containers",
  "corporate modern with navy sidebar accent, clean card layout, subtle grid pattern",
  "nordic frost with icy blue-white palette, geometric snowflake decorations, frosted panels",
  "terracotta warm with burnt orange and sand tones, arch shapes, Mediterranean feel",
  "neon tokyo night with dark purple bg, hot pink and electric blue neon signs",
  "chalkboard school style with dark green bg, chalk-white text, doodle elements",
  "geometric bauhaus with primary color blocks, circles triangles squares as decorations",
  "tropical vibrant with lush green and coral, leaf patterns, exotic gradient background",
  "wakti light mode brand clean, #fcfefd background, #060541 dark text, #e9ceb0 warm accents, premium modern",
  "wakti dark mode brand deep, #0c0f14 background, #f2f2f2 text, vibrant blue/purple glowing accents, sleek",
];

// Build the AI prompt for generating a unique slide HTML
function buildPrompt(slide: Slide, isRtl: boolean, styleSeed: string): string {
  const dir = isRtl ? "rtl" : "ltr";
  const textAlign = isRtl ? "right" : "left";
  const bulletsJson = JSON.stringify(slide.bullets?.map(b => escapeHtml(b)) || []);
  const titleEsc = escapeHtml(slide.title);
  const subtitleEsc = slide.subtitle ? escapeHtml(slide.subtitle) : "";
  const imgUrl = slide.imageUrl || "";

  // Extract explicit color choices if provided from the edit section
  let colorInstructions = "";
  if (slide.titleStyle?.color || slide.subtitleStyle?.color || slide.bulletStyle?.color || slide.backgroundColor || slide.backgroundGradient) {
    colorInstructions = `\nUSER SPECIFIC COLOR OVERRIDES (MUST OBEY THESE EXACT COLORS):`;
    if (slide.backgroundColor) colorInstructions += `\n- Background Color: ${slide.backgroundColor}`;
    if (slide.backgroundGradient) colorInstructions += `\n- Background Gradient: ${slide.backgroundGradient}`;
    if (slide.titleStyle?.color) colorInstructions += `\n- Title Text Color: ${slide.titleStyle.color}`;
    if (slide.subtitleStyle?.color) colorInstructions += `\n- Subtitle Text Color: ${slide.subtitleStyle.color}`;
    if (slide.bulletStyle?.color) colorInstructions += `\n- Bullet Text Color: ${slide.bulletStyle.color}`;
    colorInstructions += `\n(You MUST use these exact hex codes/gradients where specified, but ensure readability. If they conflict, prioritize the user's choice but add subtle drop shadows or borders to make text readable)`;
  }

  return `You are a world-class presentation designer. Generate a COMPLETE standalone HTML document for a 1920×1080 presentation slide.

CREATIVE DIRECTION: ${styleSeed}

SLIDE DATA:
- Title: "${titleEsc}"
${subtitleEsc ? `- Subtitle: "${subtitleEsc}"` : ""}
- Bullets: ${bulletsJson}
${imgUrl ? `- Image URL: ${imgUrl}` : "- No image"}
- Direction: ${dir} (text-align: ${textAlign})${colorInstructions}

STRICT DESIGN & LAYOUT RULES (CRITICAL):
1. Output ONLY the HTML. Start with <!DOCTYPE html> and end with </html>.
2. The slide MUST be exactly 1920px × 1080px. Body: width:1920px; height:1080px; overflow:hidden; margin:0; padding:0.
3. Use Google Fonts via @import in a <style> tag.
4. Use ONLY inline styles and <style> tags. No external CSS files.
5. Include ALL provided bullets.
6. If an image URL is provided, display it prominently (at least 30% of the slide area) using object-fit:cover and border-radius.
7. CONTRAST IS NON-NEGOTIABLE: You MUST ensure extremely high contrast for readability. Never put dark text on a dark background, or light text on a light background. If using a colored background, use pure white (#ffffff) or pure black (#000000) for text. If placing text over an image, you MUST use a solid or heavy translucent background color behind the text.
8. Make it visually STUNNING using gradients, shadows, borders, or glassmorphism.
9. Support ${isRtl ? "RTL (Arabic)" : "LTR (English)"} text direction natively.
10. Each bullet must be clearly separated and readable at 24-32px font size. Do NOT cram text. Use adequate padding (e.g., padding: 20px) around text blocks.
11. The title should be large and impactful (60-90px).
12. Do NOT use JavaScript. Pure HTML+CSS only.
13. Do NOT display any slide number like "Slide 1", "Slide 2", "01", "02" etc. anywhere on the slide. No numbering.
14. ALWAYS include a small "Wakti AI" branding text in the bottom-left corner of the slide (position:absolute; bottom:20px; left:24px; font-size:16px; opacity:0.6; z-index:99; font-weight:bold;). If RTL, place it bottom-right instead.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: EnhanceRequest = await req.json();
    const { slide, language, variation } = body;
    
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

    const prompt = buildPrompt(slide, isRtl, styleSeed);

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
          { role: "system", content: "You are a presentation HTML generator. Output ONLY valid HTML. No markdown fences, no explanations." },
          { role: "user", content: prompt },
        ],
        max_tokens: 4000,
        temperature: 1.1, // high creativity
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

    // Log AI usage
    await logAIFromRequest(req, {
      functionName: "wakti-slide-enhance",
      provider: "openai",
      model: "gpt-4o-mini",
      inputText: prompt.slice(0, 500),
      outputText: html.slice(0, 200),
      durationMs,
      status: "success",
    }).catch(() => {});

    return new Response(
      JSON.stringify({ success: true, html, template: seedIndex }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error enhancing slide:", error);

    // Log failed AI usage
    await logAIFromRequest(req, {
      functionName: "wakti-slide-enhance",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "error",
      errorMessage: (error as Error).message,
    }).catch(() => {});

    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message || "Enhancement failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
