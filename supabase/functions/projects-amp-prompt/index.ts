import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, mode } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid prompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // System prompt for amplifying user requests into AI-optimized instructions
    const systemPrompt = mode === 'code' 
      ? `You are a prompt engineer that enhances casual user requests into precise, actionable CODE EDITING instructions.

CRITICAL RULES:
1. If the user wants something DONE, keep it as a COMMAND, not a question
2. PRESERVE the user's intent exactly - just make it clearer and more technical
3. Add specific CSS/code terminology that helps the AI implement it
4. Keep it as a direct instruction: "Make the title...", "Add...", "Change..."
5. Do NOT turn commands into questions asking for suggestions
6. Do NOT add features the user didn't ask for

Example:
- User: "make title more 3D popped out"
- Good: "Add a 3D pop-out effect to the title using text-shadow, transform: translateZ(), and perspective. Make it visually prominent with depth."
- Bad: "What techniques can I use to make the title 3D?" (WRONG - this asks instead of commands)

Output ONLY the enhanced command, nothing else.`
      : `You are a prompt engineer that enhances casual user messages into clearer versions.

CRITICAL RULES:
1. If user is asking a question, keep it as a question but make it clearer
2. If user is giving a command/request, keep it as a command but make it more specific
3. PRESERVE the user's intent exactly
4. Do NOT change commands into questions or vice versa

Output ONLY the enhanced message, nothing else.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Original request: "${prompt}"\n\nAmplified version:` }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to amplify prompt" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const amplified = data.choices?.[0]?.message?.content?.trim();

    if (!amplified) {
      return new Response(
        JSON.stringify({ error: "No amplified content returned" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ amplified, original: prompt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in projects-amp-prompt:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
