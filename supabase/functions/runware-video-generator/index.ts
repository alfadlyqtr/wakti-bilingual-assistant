
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
    const { image_url, prompt, user_id, movement_style = 'auto' } = await req.json();
    
    console.log('🎬 VIDEO GENERATION: Starting request', { 
      user_id,
      hasImage: !!image_url,
      promptLength: prompt?.length,
      movement_style
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
    
    // Map movement style to appropriate settings
    const movementSettings = {
      'auto': 'auto',
      'slow': 'low',
      'medium': 'medium', 
      'fast': 'high'
    };
    
    const movementAmplitude = movementSettings[movement_style] || 'auto';
    
    // Try primary model first, then fallback
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
          includeCost: false, // Don't expose costs to frontend
          referenceImages: [image_url],
          providerSettings: {
            vidu: {
              movementAmplitude: movementAmplitude
            }
          },
          positivePrompt: prompt,
          deliveryMethod: "async"
        };

        console.log('🎬 REQUEST BODY:', JSON.stringify(requestBody, null, 2));
        
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
          lastError = new Error(`Service temporarily unavailable (${response.status})`);
          continue;
        }
        
        result = await response.json();
        modelUsed = model;
        console.log(`✅ MODEL ${model} SUCCESS:`, result);
        break;
        
      } catch (error) {
        console.error(`❌ MODEL ${model} EXCEPTION:`, error);
        lastError = error;
        continue;
      }
    }

    if (!result || !modelUsed) {
      console.error('❌ ALL MODELS FAILED:', lastError);
      throw new Error('Video generation service is currently unavailable. Please try again later.');
    }
    
    // Store in database - ensure the table exists and handle missing columns gracefully
    try {
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
          movement_amplitude: movementAmplitude,
          video_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (dbError) {
        console.error('❌ DB ERROR:', dbError);
        // Don't fail the request if DB insert fails, just log it
        console.log('⚠️ Continuing without database storage');
      } else {
        console.log('✅ DATABASE: Task stored successfully');
      }
    } catch (dbException) {
      console.error('❌ DB EXCEPTION:', dbException);
      // Continue without failing the request
    }
    
    return new Response(JSON.stringify({
      success: true,
      job_id: taskUUID,
      status: 'processing',
      message: 'Video generation started successfully'
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
