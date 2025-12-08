import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "https://wakti.app",
  "https://www.wakti.app",
  "https://hxauxozopvpzpdygoqwf.supabase.co",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
];

// Generate CORS headers based on request origin
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const SYSTEM_PROMPT = `You are a subtask extractor. Your job is to take messy input (pasted text, email, chat messages, notes, or OCR from images) and extract ONLY actionable subtasks.

Rules:
1. Return ONLY a plain text list, one subtask per line
2. NO bullets, NO numbering, NO dashes, NO asterisks
3. NO commentary, NO explanations, NO headers
4. Keep each subtask short and clear (max 10 words)
5. Remove timestamps, dates, names of senders, signatures, greetings
6. Remove emojis, special characters, quoted replies
7. If the input has no actionable items, return empty string
8. Preserve the original language (Arabic or English)

Example input:
"Hey! Can you please:
- Call the supplier about delivery
- Update the presentation slides  
- Send invoice to client
Thanks!"

Example output:
Call the supplier about delivery
Update the presentation slides
Send invoice to client`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const { mode, text, imageBase64 } = await req.json();

    if (!mode || (mode === "text" && !text) || (mode === "image" && !imageBase64)) {
      return new Response(
        JSON.stringify({ error: "Invalid request. Provide mode and text or imageBase64" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the messages array based on mode
    let userContent: any;

    if (mode === "text") {
      userContent = [
        { type: "text", text: `Extract subtasks from this text:\n\n${text}` }
      ];
    } else if (mode === "image") {
      userContent = [
        { type: "text", text: "Extract subtasks from the text in this image:" },
        { 
          type: "image_url", 
          image_url: { 
            url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
            detail: "low" // Use low detail for faster processing
          } 
        }
      ];
    }

    // Call OpenAI gpt-4o-mini (vision capable)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent }
        ],
        max_tokens: 500,
        temperature: 0.3, // Low temperature for consistent extraction
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content?.trim() || "";

    // Split into array of subtasks (filter empty lines)
    const subtasks = extractedText
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);

    return new Response(
      JSON.stringify({ 
        success: true, 
        subtasks,
        rawText: extractedText 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in extract-subtasks:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to extract subtasks" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
