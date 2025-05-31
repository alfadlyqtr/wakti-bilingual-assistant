
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY");

console.log("🎨 Background Removal Service: Starting up");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🎨 Background Removal: Processing request");

    if (!RUNWARE_API_KEY) {
      throw new Error("Runware API key not configured");
    }

    const { image, includeCost = false } = await req.json();

    if (!image) {
      throw new Error("No image provided");
    }

    console.log("🎨 Background Removal: Calling Runware API");

    // Call Runware background removal API
    const response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNWARE_API_KEY}`
      },
      body: JSON.stringify([
        {
          taskType: "authentication",
          apiKey: RUNWARE_API_KEY
        },
        {
          taskType: "removeImageBackground",
          taskUUID: crypto.randomUUID(),
          image: image,
          includeCost: includeCost,
          outputFormat: "PNG"
        }
      ])
    });

    if (!response.ok) {
      throw new Error(`Runware API failed: ${response.status}`);
    }

    const result = await response.json();
    console.log("🎨 Background Removal: Runware response:", result);

    if (result.data && result.data.length > 0) {
      const backgroundRemovalData = result.data.find(item => item.taskType === "removeImageBackground");
      
      if (backgroundRemovalData && (backgroundRemovalData.imageURL || backgroundRemovalData.imageBase64Data)) {
        console.log("🎨 Background Removal: Success!");
        
        return new Response(JSON.stringify({
          success: true,
          imageUrl: backgroundRemovalData.imageURL,
          imageBase64Data: backgroundRemovalData.imageBase64Data,
          cost: backgroundRemovalData.cost
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    throw new Error("No background removal result in response");

  } catch (error) {
    console.error("🎨 Background Removal: Error:", error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Background removal failed"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
