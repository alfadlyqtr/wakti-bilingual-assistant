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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    console.log("=== DEBUG INFO ===");
    console.log("OPENAI_API_KEY exists:", !!OPENAI_API_KEY);
    console.log("OPENAI_API_KEY length:", OPENAI_API_KEY?.length || 0);
    console.log("OPENAI_API_KEY starts with sk-:", OPENAI_API_KEY?.startsWith("sk-") || false);

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const { prompt, imageBase64, language = "en" } = await req.json();
    console.log("Request received with prompt:", prompt?.substring(0, 50) + "...");

    if (!prompt && !imageBase64) {
      return new Response(
        JSON.stringify({ error: "prompt or imageBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build messages based on input type
    let messages: any[] = [
      { 
        role: "system", 
        content: `You help users plan tasks. Given a short idea or image, extract:
- A concise title (max 8 words)
- A warm, human description (1-2 sentences) 
- Priority (normal, high, urgent). Use high/urgent only when clearly necessary.
- Optional due date/time if the prompt implies timing. Use ISO date (YYYY-MM-DD) and 24h time (HH:mm).
- 5-10 clear subtasks, each actionable, without numbering or punctuation at the start.

Always respond with valid JSON only. Preserve the input language (Arabic or English).
Example format:
{
  "title": "Sample Title",
  "description": "Brief description here", 
  "priority": "normal",
  "due_date": "2024-12-25",
  "due_time": "14:00",
  "subtasks": ["Task one", "Task two", "Task three"]
}` 
      }
    ];

    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: language === "ar" ? "استخرج مهمة كاملة من هذه الصورة" : "Extract a full task from this image" },
          {
            type: "image_url",
            image_url: {
              url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
              detail: "low"
            }
          }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: language === "ar" ? `الفكرة: ${prompt}\nرجاءً أنشئ مهمة كاملة` : `Task idea: ${prompt}. Please draft the full task.`
      });
    }

    // Call OpenAI without JSON schema for better compatibility
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages,
        max_tokens: 800,
      }),
    });

    console.log("OpenAI response status:", response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    console.log("OpenAI response content:", content?.substring(0, 100) + "...");

    if (!content) {
      throw new Error("No content returned from model");
    }

    // Try to parse JSON from the response
    let task;
    try {
      // Look for JSON in the response (handle markdown code blocks)
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonText = jsonMatch[1] || jsonMatch[0];
        task = JSON.parse(jsonText);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (_error) {
      console.error("Failed to parse model response:", content);
      throw new Error("Failed to parse AI response");
    }

    // Clean and validate the response
    const cleanSubtasks = Array.isArray(task?.subtasks)
      ? task.subtasks
          .filter((item: unknown) => typeof item === "string" && item.trim().length > 0)
          .map((item: string) => item.trim())
          .slice(0, 12)
      : [];

    const result = {
      title: typeof task?.title === "string" ? task.title.trim() : "Generated Task",
      description: typeof task?.description === "string" ? task.description.trim() : "Auto-generated description",
      priority: ["normal", "high", "urgent"].includes(task?.priority)
        ? task.priority
        : "normal",
      due_date:
        typeof task?.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.due_date)
          ? task.due_date
          : null,
      due_time:
        typeof task?.due_time === "string" && /^\d{2}:\d{2}$/.test(task.due_time)
          ? task.due_time
          : null,
      subtasks: cleanSubtasks.length > 0 ? cleanSubtasks : ["Sample subtask 1", "Sample subtask 2"],
    };

    if (!result.title || !result.description) {
      throw new Error("AI response missing required fields");
    }

    return new Response(
      JSON.stringify({ success: true, task: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-task:", error);
    const message = error instanceof Error ? error.message : "Failed to generate task";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
