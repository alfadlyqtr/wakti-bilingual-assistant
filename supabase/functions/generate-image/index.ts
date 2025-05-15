
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY");

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Image prompt is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Call Runware API for image generation
    const response = await fetch("https://api.runware.ai/v1/image-generation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RUNWARE_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: prompt,
        style: "photorealistic", // Use appropriate style based on request
        width: 512,
        height: 512,
        steps: 30
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Image generation failed");
    }

    const result = await response.json();
    
    return new Response(
      JSON.stringify({ imageUrl: result.image_url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in generate-image function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
