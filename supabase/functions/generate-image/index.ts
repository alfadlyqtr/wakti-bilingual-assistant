
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Use Runware API for image generation
    if (RUNWARE_API_KEY) {
      const response = await fetch("https://api.runware.ai/v1/image/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RUNWARE_API_KEY}`,
        },
        body: JSON.stringify({
          prompt: prompt,
          model: "runware:100@1",
          width: 512,
          height: 512,
          steps: 20,
          cfg_scale: 7,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return new Response(
          JSON.stringify({ 
            imageUrl: result.data[0].imageURL,
            prompt: prompt 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fallback response if no image service available
    return new Response(
      JSON.stringify({ 
        imageUrl: `https://picsum.photos/512/512?random=${Date.now()}`,
        prompt: prompt,
        note: "Using placeholder image - configure Runware API for AI generation"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating image:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
