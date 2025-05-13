
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY");
    if (!RUNWARE_API_KEY) {
      throw new Error("RUNWARE_API_KEY is not set");
    }

    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Generating image with prompt:", prompt);

    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          taskType: "authentication",
          apiKey: RUNWARE_API_KEY,
        },
        {
          taskType: "imageInference",
          taskUUID: crypto.randomUUID(),
          positivePrompt: `Event invitation background for "${prompt}". Clean, professional, vibrant.`,
          width: 1024,
          height: 1024,
          model: "runware:100@1",
          numberResults: 1,
          outputFormat: "WEBP",
          CFGScale: 1,
          scheduler: "FlowMatchEulerDiscreteScheduler",
          strength: 0.8,
        },
      ]),
    });

    const data = await response.json();
    
    if (data.error || data.errors) {
      console.error("Runware API error:", data);
      throw new Error(data.errorMessage || "Failed to generate image");
    }

    const imageResult = data.data.find(
      (item: any) => item.taskType === "imageInference"
    );

    if (!imageResult || !imageResult.imageURL) {
      throw new Error("No image generated");
    }

    return new Response(
      JSON.stringify({ imageUrl: imageResult.imageURL }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-event-image function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
