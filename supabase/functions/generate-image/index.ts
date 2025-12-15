import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
// Env-driven model and quality parameters
const RW_PREFERRED_MODEL = Deno.env.get('RUNWARE_PREFERRED_MODEL') || 'runware:97@2';
const RW_FALLBACK_MODEL = Deno.env.get('RUNWARE_FALLBACK_MODEL') || 'runware:100@1';
const RW_STEPS = (() => {
  const v = parseInt(Deno.env.get('RUNWARE_STEPS') ?? '28', 10);
  if (Number.isNaN(v)) return 28;
  return Math.min(60, Math.max(4, v));
})();
const RW_CFG = (() => {
  const v = parseFloat(Deno.env.get('RUNWARE_CFG') ?? '5.5');
  if (Number.isNaN(v)) return 5.5;
  return Math.min(20, Math.max(1, v));
})();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    if (!RUNWARE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Runware API key not configured" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log("Generating image with Runware API for prompt:", prompt);
    // Build payload generator
    const taskUUID = crypto.randomUUID();
    const buildPayload = (model: string) => ([
      {
        taskType: "authentication",
        apiKey: RUNWARE_API_KEY,
      },
      {
        taskType: "imageInference",
        taskUUID,
        positivePrompt: prompt,
        model,
        width: 1024,
        height: 1024,
        numberResults: 1,
        outputFormat: "WEBP",
        includeCost: true,
        CFGScale: RW_CFG,
        scheduler: "FlowMatchEulerDiscreteScheduler",
        steps: RW_STEPS,
      },
    ]);

    // Try preferred then fallback
    let modelUsed = RW_PREFERRED_MODEL;
    let response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(RW_PREFERRED_MODEL)),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn('Preferred model failed:', response.status, errText);
      modelUsed = RW_FALLBACK_MODEL;
      response = await fetch("https://api.runware.ai/v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(RW_FALLBACK_MODEL)),
      });
    }

    console.log("Runware API response status:", response.status, 'modelUsed:', modelUsed);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Runware API error:", response.status, errorText);
      throw new Error(`Runware API failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("Runware API response:", result);
    
    // Find the image inference result
    const imageResult = result.data?.find((item: any) => item.taskType === "imageInference");
    
    if (imageResult && imageResult.imageURL) {
      // Log successful AI usage
      await logAIFromRequest(req, {
        functionName: "generate-image",
        provider: "runware",
        model: modelUsed,
        inputText: prompt,
        durationMs: Date.now() - startTime,
        status: "success",
        metadata: { width: 1024, height: 1024 }
      });

      return new Response(
        JSON.stringify({ 
          imageUrl: imageResult.imageURL,
          prompt,
          provider: "runware",
          modelUsed
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      throw new Error("No image URL in Runware response");
    }

  } catch (error) {
    console.error("Error generating image:", error);
    
    // Log failed AI usage
    await logAIFromRequest(req, {
      functionName: "generate-image",
      provider: "runware",
      model: RW_PREFERRED_MODEL,
      status: "error",
      errorMessage: (error as Error).message
    });

    return new Response(
      JSON.stringify({ 
        error: "Image generation failed", 
        details: (error as any).message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

