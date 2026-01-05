import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Theme descriptions for EMP
const themeDescriptions: Record<string, string> = {
  'wakti-dark': 'dark premium theme with deep navy (#0c0f14), royal purple (#060541), and subtle gray (#858384)',
  'wakti-light': 'clean light theme with off-white (#fcfefd), deep purple (#060541), and warm beige (#e9ceb0)',
  'vibrant': 'vibrant colorful theme with electric blue, purple, and orange gradients',
  'emerald': 'elegant emerald green theme with teal and dark backgrounds',
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

    const themeDesc = themeDescriptions[theme] || themeDescriptions['wakti-dark'];
    const assetInfo = hasAssets 
      ? '\n\nThe user has uploaded images that should be used prominently in the design (as hero image, logo, or featured content).'
      : '';

    console.log("[EMP] Enhancing prompt:", prompt.substring(0, 50));

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
4. Include the theme colors naturally in your description
5. If assets are mentioned, specify where to use them (hero, logo, background, etc.)
6. Keep it concise - max 3-4 sentences total
7. Return ONLY the enhanced prompt text, no explanations or prefixes
8. Write in the same language as the user's input

THEME TO USE: ${themeDesc}${assetInfo}

Example:
User: "restaurant menu"
Enhanced: "Create a modern restaurant menu website with a ${themeDesc}. Include an animated hero section with a featured dish, a glassmorphism menu grid with hover effects, smooth scroll navigation, and a sticky header with the restaurant logo."

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
