import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = [
  "https://wakti.app",
  "https://www.wakti.app",
  "https://hxauxozopvpzpdygoqwf.supabase.co",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) || isLocalhost ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const SYSTEM_PROMPT = `You are a task extractor. Read text or images and create a task structure.

RULES:
1. Extract the EXACT text as subtasks - DO NOT REWORD
2. Each line or bullet becomes a subtask WORD FOR WORD
3. Title: summarize topic in 3-5 words
4. Description: 1 sentence about what this is
5. DO NOT add your own suggestions
6. Preserve original language (Arabic or English)

Return JSON only:
{
  "title": "Topic summary",
  "description": "Brief description",
  "priority": "normal",
  "due_date": null,
  "due_time": null,
  "subtasks": ["exact line 1", "exact line 2"]
}`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const { prompt, imageBase64, language = "en" } = await req.json();

    if (!prompt && !imageBase64) {
      return new Response(
        JSON.stringify({ error: "prompt or imageBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build user content based on input type
    let userContent: any;

    if (imageBase64) {
      userContent = [
        { type: "text", text: "Extract all text from this image and create a task with subtasks:" },
        { 
          type: "image_url", 
          image_url: { 
            url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
            detail: "low"
          } 
        }
      ];
    } else {
      userContent = [
        { type: "text", text: `Create a task from this text:\n\n${prompt}` }
      ];
    }

    // Call OpenAI gpt-4o-mini (same as working generate-subtasks)
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
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    if (!content) {
      throw new Error("No content returned from model");
    }

    // Parse JSON from response
    let task;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonText = jsonMatch[1] || jsonMatch[0];
        task = JSON.parse(jsonText);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (_error) {
      console.error("Failed to parse response:", content);
      throw new Error("Failed to parse AI response");
    }

    // Clean subtasks
    const cleanSubtasks = Array.isArray(task?.subtasks)
      ? task.subtasks
          .filter((item: unknown) => typeof item === "string" && item.trim().length > 0)
          .map((item: string) => item.trim())
          .slice(0, 12)
      : [];

    const result = {
      title: typeof task?.title === "string" ? task.title.trim() : "Extracted Task",
      description: typeof task?.description === "string" ? task.description.trim() : "Tasks from input",
      priority: ["normal", "high", "urgent"].includes(task?.priority) ? task.priority : "normal",
      due_date: typeof task?.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.due_date) ? task.due_date : null,
      due_time: typeof task?.due_time === "string" && /^\d{2}:\d{2}$/.test(task.due_time) ? task.due_time : null,
      subtasks: cleanSubtasks.length > 0 ? cleanSubtasks : ["Review content"],
    };

    return new Response(
      JSON.stringify({ success: true, task: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Failed to process request";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
