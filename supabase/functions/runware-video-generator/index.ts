
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image_url, prompt, user_id } = await req.json();
    
    console.log('🎬 VIDEO GENERATION: Starting video generation', { 
      user_id,
      hasImage: !!image_url,
      promptLength: prompt?.length
    });
    
    if (!RUNWARE_API_KEY) {
      throw new Error('Video generation service not configured');
    }

    if (!user_id) {
      throw new Error('Authentication required');
    }

    if (!image_url || !prompt) {
      throw new Error('Image and description are required');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Generate unique task UUID
    const taskUUID = crypto.randomUUID();
    
    // Try vidu:1@1 first, fallback to klingai:5@3
    const models = ['vidu:1@1', 'klingai:5@3'];
    let lastError = null;
    let result = null;
    let modelUsed = null;

    for (const model of models) {
      try {
        console.log(`🎬 TRYING MODEL: ${model}`);
        
        const requestBody = {
          taskType: "videoInference",
          taskUUID: taskUUID,
          duration: 5,
          model: model,
          outputFormat: "mp4",
          height: 1920,
          width: 1080,
          numberResults: 1,
          includeCost: true,
          referenceImages: [image_url],
          providerSettings: {
            vidu: {
              movementAmplitude: "auto"
            }
          },
          positivePrompt: prompt,
          deliveryMethod: "async"
        };

        console.log('🎬 REQUEST BODY:', JSON.stringify(requestBody, null, 2));
        
        // Call Runware API
        const response = await fetch('https://api.runware.ai/v1', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RUNWARE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([requestBody])
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ MODEL ${model} ERROR:`, response.status, errorText);
          lastError = new Error(`${model} failed: ${response.status}`);
          continue; // Try next model
        }
        
        result = await response.json();
        modelUsed = model;
        console.log(`✅ MODEL ${model} SUCCESS:`, result);
        break; // Success, exit loop
        
      } catch (error) {
        console.error(`❌ MODEL ${model} EXCEPTION:`, error);
        lastError = error;
        continue; // Try next model
      }
    }

    // If all models failed
    if (!result || !modelUsed) {
      console.error('❌ ALL MODELS FAILED:', lastError);
      throw new Error('Video generation service temporarily unavailable. Please try again later.');
    }
    
    // Store in database
    const { error: dbError } = await supabase
      .from('video_generation_tasks')
      .insert({
        task_id: taskUUID,
        user_id: user_id,
        template: 'video_generation',
        mode: 'image_to_video',
        prompt: prompt,
        status: 'processing',
        images: [image_url],
        model_used: modelUsed,
        duration: 5,
        resolution: '1920x1080',
        movement_amplitude: 'auto',
        video_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('❌ DB ERROR:', dbError);
      throw new Error('Failed to save video generation task');
    }
    
    console.log('✅ DATABASE: Task stored successfully with task_id:', taskUUID);
    
    // Return success
    return new Response(JSON.stringify({
      success: true,
      job_id: taskUUID,
      status: 'processing',
      message: 'Video generation started successfully',
      model_used: modelUsed
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ VIDEO GENERATION ERROR:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Video generation failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
