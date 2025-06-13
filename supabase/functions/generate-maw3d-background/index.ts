
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎨 MAW3D BACKGROUND GENERATOR: Starting image generation');
    
    const { prompt } = await req.json();
    
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    console.log('🎨 Image generation prompt:', prompt);
    
    // Get Runware API key
    const runwareApiKey = Deno.env.get('RUNWARE_API_KEY');
    if (!runwareApiKey) {
      throw new Error('RUNWARE_API_KEY not configured');
    }

    // Generate image using Runware API
    const imageUrl = await generateImageWithRunware(prompt, runwareApiKey);
    
    console.log('🎨 Image generated successfully:', imageUrl);
    
    return new Response(JSON.stringify({ 
      success: true,
      imageUrl: imageUrl 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🎨 Error in generate-maw3d-background:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Extracted working Runware function from wakti-ai-v2-brain
async function generateImageWithRunware(prompt: string, apiKey: string): Promise<string> {
  console.log('🎨 Runware: Starting image generation with prompt:', prompt);
  
  try {
    const response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          taskType: 'authentication',
          apiKey: apiKey,
        },
        {
          taskType: 'imageInference',
          taskUUID: crypto.randomUUID(),
          positivePrompt: prompt,
          model: 'runware:100@1',
          width: 1024,
          height: 1024,
          numberResults: 1,
          outputFormat: 'WEBP',
          CFGScale: 1,
          scheduler: 'FlowMatchEulerDiscreteScheduler',
          steps: 4,
        }
      ])
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🎨 Runware API error response:', errorText);
      throw new Error(`Runware API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('🎨 Runware API response:', data);

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response format from Runware API');
    }

    // Find the image inference result
    const imageResult = data.data.find((item: any) => item.taskType === 'imageInference');
    
    if (!imageResult) {
      throw new Error('No image inference result found in response');
    }

    if (imageResult.error) {
      throw new Error(`Image generation failed: ${imageResult.error}`);
    }

    if (!imageResult.imageURL) {
      throw new Error('No image URL in response');
    }

    console.log('🎨 Runware: Image generated successfully:', imageResult.imageURL);
    return imageResult.imageURL;

  } catch (error) {
    console.error('🎨 Runware generation error:', error);
    throw error;
  }
}
