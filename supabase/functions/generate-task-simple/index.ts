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

    const { prompt, language = "en" } = await req.json();
    console.log("Request received with prompt:", prompt?.substring(0, 50) + "...");

    // Simple call without JSON schema to test basic functionality
    const startTime = Date.now();
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { 
            role: "system", 
            content: `You help users plan tasks. Given a short idea, extract a title, description, priority, and 5-7 subtasks. Return as JSON with fields: title, description, priority (normal/high/urgent), subtasks (array). ${language === "ar" ? "Respond in Arabic." : "Respond in English."}` 
          },
          {
            role: "user",
            content: language === "ar" ? `الفكرة: ${prompt}` : `Task idea: ${prompt}`,
          },
        ],
        max_tokens: 500,
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
      // Look for JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        task = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (_error) {
      console.error("Failed to parse model response:", content);
      throw new Error("Failed to parse AI response");
    }

    const result = {
      title: task?.title || "Generated Task",
      description: task?.description || "Auto-generated description",
      priority: ["normal", "high", "urgent"].includes(task?.priority) ? task.priority : "normal",
      due_date: null,
      due_time: null,
      subtasks: Array.isArray(task?.subtasks) ? task.subtasks.slice(0, 10) : ["Sample subtask 1", "Sample subtask 2"],
    };

    // Log successful AI usage
    await logAIFromRequest(req, {
      functionName: "generate-task-simple",
      provider: "openai",
      model: "gpt-4o-mini",
      inputText: prompt,
      outputText: content,
      durationMs: Date.now() - startTime,
      status: "success"
    });

    return new Response(
      JSON.stringify({ success: true, task: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-task-simple:", error);
    
    // Log failed AI usage
    await logAIFromRequest(req, {
      functionName: "generate-task-simple",
      provider: "openai",
      model: "gpt-4o-mini",
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
