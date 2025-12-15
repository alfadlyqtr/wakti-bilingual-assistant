import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

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

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const MODEL = "gpt-4o-mini";

const TASK_SCHEMA = {
  name: "task_schema",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      priority: {
        type: "string",
        enum: ["normal", "high", "urgent"]
      },
      due_date: {
        anyOf: [
          { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          { type: "null" }
        ]
      },
      due_time: {
        anyOf: [
          { type: "string", pattern: "^\\d{2}:\\d{2}$" },
          { type: "null" }
        ]
      },
      subtasks: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 12
      }
    },
    required: ["title", "description", "priority", "subtasks"],
    additionalProperties: false
  }
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const systemPrompt = `You help users plan tasks. Given a short idea or image, extract:
- A concise title (max 8 words)
- A warm, human description (1-2 sentences)
- Priority (normal, high, urgent). Use high/urgent only when clearly necessary.
- Optional due date/time if the prompt implies timing. Use ISO date (YYYY-MM-DD) and 24h time (HH:mm).
- 5-10 clear subtasks, each actionable, without numbering or punctuation at the start.
Always respond with JSON matching the provided schema. Preserve the input language (Arabic or English).`;

    // Build user content based on input type
    let userContent: any;
    
    if (imageBase64) {
      userContent = [
        { type: "text", text: language === "ar" ? "استخرج مهمة كاملة من هذه الصورة" : "Extract a full task from this image" },
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
        { type: "text", text: language === "ar" ? `الفكرة: ${prompt}\nرجاءً أنشئ مهمة كاملة` : `Task idea: ${prompt}. Please draft the full task.` }
      ];
    }

    const startTime = Date.now();
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        response_format: {
          type: "json_schema",
          json_schema: TASK_SCHEMA,
        },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content returned from model");
    }

    let task;
    try {
      task = JSON.parse(content);
    } catch (error) {
      console.error("Failed to parse model response:", content);
      throw new Error("Failed to parse AI response");
    }

    const cleanSubtasks = Array.isArray(task?.subtasks)
      ? task.subtasks
          .filter((item: unknown) => typeof item === "string" && item.trim().length > 0)
          .map((item: string) => item.trim())
          .slice(0, 12)
      : [];

    const result = {
      title: typeof task?.title === "string" ? task.title.trim() : "",
      description: typeof task?.description === "string" ? task.description.trim() : "",
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
      subtasks: cleanSubtasks,
    };

    if (!result.title || !result.description) {
      throw new Error("AI response missing required fields");
    }

    // Log successful AI usage
    await logAIFromRequest(req, {
      functionName: "generate-task",
      provider: "openai",
      model: MODEL,
      inputText: prompt || "[image input]",
      outputText: content,
      durationMs: Date.now() - startTime,
      status: "success"
    });

    return new Response(
      JSON.stringify({ success: true, task: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-task:", error);
    
    // Log failed AI usage
    await logAIFromRequest(req, {
      functionName: "generate-task",
      provider: "openai",
      model: MODEL,
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown error"
    });

    const message = error instanceof Error ? error.message : "Failed to generate task";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
