// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing prompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[ContextDetect] Analyzing prompt:", prompt.substring(0, 80));

    const systemPrompt = `You are a smart content form generator for a website/app/game builder.

A user is about to build something. Read their prompt carefully and return a JSON object with 5 smart content fields they should fill in BEFORE building starts — so the AI uses real information instead of generic placeholder text.

RULES:
- ALWAYS return exactly 5 fields. No exceptions. Every project has real content that belongs to someone.
- Read the prompt and use your intelligence to decide the 5 most impactful content fields for THAT specific project.
- Think: what real information would make this project feel personal and real instead of generic?
- Labels must be short and friendly (max 4 words).
- Placeholders must be realistic, specific examples relevant to the project type.
- Return ONLY valid JSON. No markdown, no explanation, nothing else.
- Write field labels and heading in the SAME LANGUAGE as the user's prompt.

JSON FORMAT:
{
  "siteType": "short descriptive label for the project type",
  "heading": "Short friendly sentence asking for their info e.g. Tell us about your spa",
  "fields": [
    { "id": "unique_snake_case_id", "label": "Field Label", "placeholder": "realistic example", "type": "text" },
    { "id": "unique_snake_case_id", "label": "Field Label", "placeholder": "realistic example", "type": "text" },
    { "id": "unique_snake_case_id", "label": "Field Label", "placeholder": "realistic example", "type": "text" },
    { "id": "unique_snake_case_id", "label": "Field Label", "placeholder": "realistic example", "type": "text" },
    { "id": "unique_snake_case_id", "label": "Field Label", "placeholder": "realistic example", "type": "text" }
  ]
}

Field type options: "text", "textarea", "tel", "email", "url"
Use "textarea" only for descriptions or bios. Max 1 textarea per form.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\nUser prompt: ${prompt}` }]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 600,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[ContextDetect] Gemini error:", response.status, errText.substring(0, 200));
      return new Response(
        JSON.stringify({ ok: false, error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!rawText) {
      return new Response(
        JSON.stringify({ ok: false, error: "Empty response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("[ContextDetect] JSON parse failed:", rawText.substring(0, 200));
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid JSON from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[ContextDetect] siteType:", parsed.siteType, "fields:", parsed.fields?.length);

    return new Response(
      JSON.stringify({ ok: true, siteType: parsed.siteType, heading: parsed.heading, fields: parsed.fields || [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ContextDetect] Error:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
