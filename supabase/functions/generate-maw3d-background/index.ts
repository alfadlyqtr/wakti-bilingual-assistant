
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ENHANCED CORS CONFIGURATION FOR PRODUCTION
const allowedOrigins = [
  'https://wakti.qa',
  'https://www.wakti.qa',
  'https://lovable.dev',
  'https://5332ebb7-6fae-483f-a0cc-4262a2a445a1.lovableproject.com',
  // Dev/local
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:60477',
  'http://127.0.0.1:60477'
];

const getCorsHeaders = (origin: string | null) => {
  const corsOrigin = allowedOrigins.includes(origin || '') ? origin : 'https://wakti.qa';
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
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
    const { imageUrl, modelUsed } = await generateImageWithRunware(prompt, runwareApiKey);
    
    console.log('🎨 Image generated successfully (temporary URL):', imageUrl);
    
    // Download image and save to Supabase Storage for permanent URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('🎨 Downloading image from Runware...');
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Failed to download generated image');
    }
    
    const imageBlob = await imageResponse.blob();
    const fileName = `ai-generated/${crypto.randomUUID()}.webp`;
    
    console.log('🎨 Uploading to Supabase Storage:', fileName);
    const { error: uploadError } = await supabase.storage
      .from('event-images')
      .upload(fileName, imageBlob, {
        contentType: 'image/webp',
        upsert: false
      });
    
    if (uploadError) {
      console.error('🎨 Storage upload error:', uploadError);
      throw new Error(`Failed to save image: ${uploadError.message}`);
    }
    
    const { data: urlData } = supabase.storage
      .from('event-images')
      .getPublicUrl(fileName);
    
    const permanentUrl = urlData.publicUrl;
    console.log('🎨 Image saved permanently:', permanentUrl);
    
    return new Response(JSON.stringify({ 
      success: true,
      imageUrl: permanentUrl,
      provider: 'runware',
      modelUsed
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🎨 Error in generate-maw3d-background:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Env-driven Runware helper with preferred/fallback models and configurable steps/CFG
async function generateImageWithRunware(prompt: string, apiKey: string): Promise<{ imageUrl: string; modelUsed: string }> {
  console.log('🎨 Runware: Starting image generation with prompt:', prompt);

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

  try {
    const taskUUID = crypto.randomUUID();
    const buildPayload = (model: string) => ([
      { taskType: 'authentication', apiKey },
      {
        taskType: 'imageInference',
        taskUUID,
        positivePrompt: prompt,
        model,
        width: 1024,
        height: 1024,
        numberResults: 1,
        outputFormat: 'WEBP',
        includeCost: true,
        CFGScale: RW_CFG,
        scheduler: 'FlowMatchEulerDiscreteScheduler',
        steps: RW_STEPS,
      }
    ]);

    let modelUsed = RW_PREFERRED_MODEL;
    let response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(RW_PREFERRED_MODEL))
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn('🎨 Preferred model failed:', response.status, errText);
      modelUsed = RW_FALLBACK_MODEL;
      response = await fetch('https://api.runware.ai/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(RW_FALLBACK_MODEL))
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🎨 Runware API error response:', errorText);
      throw new Error(`Runware API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('🎨 Runware API response:', data, 'modelUsed:', modelUsed);

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response format from Runware API');
    }

    const imageResult = data.data.find((item: any) => item.taskType === 'imageInference');
    if (!imageResult || !imageResult.imageURL) {
      throw new Error('No image URL in response');
    }

    console.log('🎨 Runware: Image generated successfully:', imageResult.imageURL);
    return { imageUrl: imageResult.imageURL, modelUsed };

  } catch (error) {
    console.error('🎨 Runware generation error:', error);
    throw error;
  }
}
