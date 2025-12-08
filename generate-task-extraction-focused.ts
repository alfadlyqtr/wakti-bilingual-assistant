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

    // Build messages based on input type
    let messages: any[] = [
      { 
        role: "system", 
        content: `You are a task extraction specialist. Your job is to READ and EXTRACT concrete action items from text or images - NOT to generate or create new tasks.

RULES:
1. Read ALL visible text carefully
2. Extract ONLY actual action items, deadlines, and requirements that are explicitly mentioned
3. Preserve the original wording and meaning
4. Ignore UI elements, navigation, buttons, and design elements
5. If there are dates/times mentioned, extract them exactly as written
6. Create a concise title that summarizes the main topic
7. Write a brief description of what needs to be accomplished

RESPONSE FORMAT (JSON only):
{
  "title": "Main topic/subject (max 8 words)",
  "description": "Brief summary of what needs to be done (1-2 sentences)",
  "priority": "normal",
  "due_date": "YYYY-MM-DD if mentioned, else null",
  "due_time": "HH:mm if mentioned, else null", 
  "subtasks": ["Exact action item 1", "Exact action item 2", "Exact action item 3"]
}

${language === "ar" ? "استخدم اللغة العربية في الرد" : "Respond in the same language as the input"}` 
      }
    ];

    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: language === "ar" ? "اقرأ كل النصوص المرئية في هذه الصورة واستخرج المهام الملموسة فقط" : "Read all visible text in this image and extract only concrete action items" },
          {
            type: "image_url",
            image_url: {
              url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
              detail: "high"  // Changed from "low" to "high" for better OCR
            }
          }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: language === "ar" ? `اقرأ هذا النص واستخرج المهام الملموسة: ${prompt}` : `Read this text and extract concrete action items: ${prompt}`
      });
    }

    // Call OpenAI with higher max_tokens for better extraction
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,  // Lower temperature for less creativity
        messages,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

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
      title: typeof task?.title === "string" ? task.title.trim() : "Extracted Task",
      description: typeof task?.description === "string" ? task.description.trim() : "Tasks extracted from image",
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
      subtasks: cleanSubtasks.length > 0 ? cleanSubtasks : ["Review the image content"],
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
