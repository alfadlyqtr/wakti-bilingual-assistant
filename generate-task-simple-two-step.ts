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

    let extractedText = "";

    // STEP 1: Read the image/text
    if (imageBase64) {
      console.log("Step 1: Reading text from image...");
      
      const ocrResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          temperature: 0.0,
          messages: [{
            role: "user",
            content: [{
              type: "text",
              text: language === "ar" ? "اقرأ كل النص الموجود في هذه الصورة بالضبط كما هو مكتوب. لا تلخص ولا تفسّر. أخرج النص فقط." : "Read ALL visible text from this image exactly as written. Do not summarize or interpret. Output only the text."
            }, {
              type: "image_url",
              image_url: {
                url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                detail: "high"
              }
            }]
          }],
          max_tokens: 2000,
        }),
      });

      if (!ocrResponse.ok) {
        const errorData = await ocrResponse.text();
        throw new Error(`OCR error: ${ocrResponse.status} - ${errorData}`);
      }

      const ocrData = await ocrResponse.json();
      extractedText = ocrData.choices?.[0]?.message?.content || "";
      
      console.log("Extracted text:", extractedText.substring(0, 100) + "...");
      
      if (!extractedText || extractedText.length < 10) {
        throw new Error("Could not read text from image");
      }
    } else {
      extractedText = prompt;
    }

    // STEP 2: Create tasks from the extracted text
    console.log("Step 2: Creating tasks from text...");
    
    const taskResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [{
          role: "system",
          content: `You create tasks from text. Extract concrete action items and create a task structure.

RULES:
- Find actual things that need to be done
- Use the exact wording when possible
- Priority: normal unless urgent/high is clearly indicated
- Due dates: only if explicitly mentioned
- 5-10 actionable subtasks max

Respond with JSON only:
{
  "title": "Brief title",
  "description": "What needs to be done",
  "priority": "normal|high|urgent", 
  "due_date": "YYYY-MM-DD or null",
  "due_time": "HH:mm or null",
  "subtasks": ["action item 1", "action item 2", "action item 3"]
}

${language === "ar" ? "استخدم اللغة العربية" : "Use the same language as the text"}`
        }, {
          role: "user",
          content: language === "ar" ? `أنشئ مهام من هذا النص:\n\n${extractedText}` : `Create tasks from this text:\n\n${extractedText}`
        }],
        max_tokens: 800,
      }),
    });

    if (!taskResponse.ok) {
      const errorData = await taskResponse.text();
      throw new Error(`Task creation error: ${taskResponse.status} - ${errorData}`);
    }

    const taskData = await taskResponse.json();
    const content = taskData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No task content returned");
    }

    // Parse the JSON response
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
      console.error("Failed to parse task response:", content);
      throw new Error("Failed to parse task response");
    }

    // Clean and validate
    const cleanSubtasks = Array.isArray(task?.subtasks)
      ? task.subtasks
          .filter((item: unknown) => typeof item === "string" && item.trim().length > 0)
          .map((item: string) => item.trim())
          .slice(0, 10)
      : [];

    const result = {
      title: typeof task?.title === "string" ? task.title.trim() : "Extracted Task",
      description: typeof task?.description === "string" ? task.description.trim() : "Tasks from extracted text",
      priority: ["normal", "high", "urgent"].includes(task?.priority) ? task.priority : "normal",
      due_date: typeof task?.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.due_date) ? task.due_date : null,
      due_time: typeof task?.due_time === "string" && /^\d{2}:\d{2}$/.test(task.due_time) ? task.due_time : null,
      subtasks: cleanSubtasks.length > 0 ? cleanSubtasks : ["Review extracted content"],
    };

    return new Response(
      JSON.stringify({ success: true, task: result, extractedText }),
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
