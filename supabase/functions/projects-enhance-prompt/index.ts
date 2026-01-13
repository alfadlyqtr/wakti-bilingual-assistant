// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Theme descriptions for EMP
const themeDescriptions: Record<string, string> = {
  'none': '', // No specific theme - let AI decide
  // Cool tones
  'glacier': 'cool glacier theme with soft blues (#60a5fa), lavender (#a5b4fc), and light purples (#c4b5fd) - icy, calm, professional',
  'ocean': 'ocean theme with sky blue (#0ea5e9), cyan (#38bdf8), and light aqua (#7dd3fc) - fresh, clean, trustworthy',
  'lavender': 'lavender theme with soft purple (#a78bfa), lilac (#c4b5fd), and pale violet (#ddd6fe) - elegant, calming, creative',
  // Warm tones
  'harvest': 'harvest theme with amber (#f59e0b), golden yellow (#fbbf24), and warm cream (#fde68a) - warm, inviting, energetic',
  'sunset': 'sunset theme with orange (#f97316), peach (#fb923c), and soft coral (#fdba74) - vibrant, warm, dynamic',
  'orchid': 'orchid theme with pink (#ec4899), rose (#f472b6), and soft blush (#f9a8d4) - feminine, modern, playful',
  'coral': 'coral theme with rose red (#f43f5e), salmon (#fb7185), and soft pink (#fda4af) - bold, energetic, passionate',
  // Nature
  'emerald': 'emerald theme with green (#10b981), mint (#34d399), and seafoam (#6ee7b7) - natural, fresh, growth-oriented',
  'forest': 'forest theme with bright green (#22c55e), lime (#4ade80), and pale green (#86efac) - organic, eco-friendly, vibrant',
  'solar': 'solar theme with gold (#eab308), yellow (#facc15), and light lemon (#fde047) - sunny, optimistic, attention-grabbing',
  // Dark & Bold
  'obsidian': 'obsidian dark theme with slate (#1e293b), charcoal (#334155), and gray (#475569) - sleek, professional, minimal',
  'brutalist': 'brutalist theme with indigo (#6366f1), purple (#a855f7), pink (#ec4899), and red (#f43f5e) - bold, artistic, unconventional',
  'midnight': 'midnight theme with deep indigo (#1e1b4b), dark purple (#312e81), and royal blue (#4338ca) - mysterious, premium, sophisticated',
  // Wakti brand
  'wakti-dark': 'dark premium theme with deep navy (#0c0f14), royal purple (#060541), and subtle gray (#858384)',
  'wakti-light': 'clean light theme with off-white (#fcfefd), deep purple (#060541), and warm beige (#e9ceb0)',
  // Vibrant
  'vibrant': 'vibrant theme with blue (#3b82f6), purple (#8b5cf6), orange (#f97316), and pink (#ec4899) - colorful, energetic, modern',
  'neon': 'neon theme with cyan (#22d3ee), lime (#a3e635), yellow (#facc15), and pink (#f472b6) - electric, futuristic, eye-catching',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt, theme, hasAssets } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing prompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const themeDesc = themeDescriptions[theme] || '';
    const assetInfo = hasAssets 
      ? '\n\nThe user has uploaded images that should be used prominently in the design (as hero image, logo, or featured content).'
      : '';

    console.log("[EMP] Enhancing prompt with theme:", theme, themeDesc);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 500,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `You are an expert prompt enhancer for an AI web developer. Your job is to take a user's simple request and enhance it into a detailed, specific prompt that will result in a stunning website.

CRITICAL RULES:
1. NEVER remove or change the user's core request - only ADD details
2. Keep the user's original idea intact - just make it more specific
3. Add specific UI/UX suggestions (animations, layout, sections)
4. ${themeDesc ? 'Include the theme colors and mood naturally in your description' : 'Choose appropriate colors based on the content'}
5. If assets are mentioned, specify where to use them (hero, logo, background, etc.)
6. Keep it concise - max 3-4 sentences total
7. Return ONLY the enhanced prompt text, no explanations or prefixes
8. Write in the same language as the user's input

${themeDesc ? `THEME TO USE: ${themeDesc}` : ''}${assetInfo}

Example:
User: "restaurant menu"
Enhanced: "Create a modern restaurant menu website with a ${themeDesc || 'clean design'}. Include an animated hero section with a featured dish, a glassmorphism menu grid with hover effects, smooth scroll navigation, and a sticky header with the restaurant logo."

Now enhance the user's prompt:`
          },
          {
            role: "user",
            content: prompt
          }
        ],
      }),
    });

    if (!response.ok) {
      console.error("[EMP] OpenAI API error:", response.status);
      return new Response(
        JSON.stringify({ ok: false, error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const enhancedPrompt = data.choices?.[0]?.message?.content?.trim();

    if (!enhancedPrompt) {
      return new Response(
        JSON.stringify({ ok: true, enhancedPrompt: prompt }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[EMP] Enhanced:", enhancedPrompt.substring(0, 100));

    return new Response(
      JSON.stringify({ ok: true, enhancedPrompt }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[EMP] Error:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
