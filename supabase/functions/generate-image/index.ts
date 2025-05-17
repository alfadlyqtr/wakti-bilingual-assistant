
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

    console.log("Generating image with prompt:", prompt);

    // Updated Runware API call with proper taskType and parameters
    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RUNWARE_API_KEY}`,
      },
      body: JSON.stringify([
        {
          taskType: "authentication", 
          apiKey: RUNWARE_API_KEY
        },
        {
          taskType: "imageInference",
          taskUUID: crypto.randomUUID(),
          positivePrompt: prompt,
          model: "runware:100@1",
          width: 1024,
          height: 1024,
          numberResults: 1,
          outputFormat: "WEBP",
          steps: 30
        }
      ]),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Runware API error response:", errorData);
      throw new Error(`Runware API error: ${errorData}`);
    }

    const result = await response.json();
    console.log("Runware API response:", JSON.stringify(result));
    
    if (!result.data || result.data.length === 0) {
      throw new Error("No image data returned from API");
    }
    
    // Extract the image URL from the response data
    const imageData = result.data.find(item => item.taskType === "imageInference");
    if (!imageData || !imageData.imageURL) {
      throw new Error("No image URL found in the response");
    }
    
    console.log("Image successfully generated, URL:", imageData.imageURL);
    
    return new Response(
      JSON.stringify({ imageUrl: imageData.imageURL }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in generate-image function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Failed to generate image. Please try again with a different prompt."
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
