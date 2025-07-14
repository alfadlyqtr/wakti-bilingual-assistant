
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
    const { image_base64, prompt, movement_style, user_id } = await req.json();
    
    console.log('🎬 ISOLATED VIDEO: Starting generation', { 
      user_id,
      hasImage: !!image_base64,
      promptLength: prompt?.length,
      movement: movement_style
    });
    
    if (!RUNWARE_API_KEY) {
      throw new Error('Video service not configured');
    }

    if (!user_id) {
      throw new Error('User authentication required');
    }

    if (!image_base64 || !prompt) {
      throw new Error('Image and description are required');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Generate unique task UUID
    const taskUUID = crypto.randomUUID();
    
    // Use klingai:5@3 as specified (best for image-to-video)
    const model = 'klingai:5@3';
    
    const requestBody = {
      taskType: "videoInference",
      taskUUID: taskUUID,
      duration: 5, // 5 seconds as specified
      model: model,
      outputFormat: "mp4",
      height: 1080, // 1080p as specified
      width: 1920,
      numberResults: 1,
      includeCost: false, // No cost info returned
      referenceImages: [image_base64],
      providerSettings: {
        klingai: {
          movementAmplitude: movement_style === 'auto' ? 'auto' : movement_style
        }
      },
      positivePrompt: prompt,
      deliveryMethod: "async"
    };

    console.log('🎬 ISOLATED VIDEO: Sending to Runware', { model, duration: 5, quality: '1080p' });
    
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
      console.error('❌ ISOLATED VIDEO ERROR:', response.status, errorText);
      throw new Error('Video generation failed. Please try again.');
    }
    
    const result = await response.json();
    console.log('✅ ISOLATED VIDEO: Generation started', { taskId: taskUUID });
    
    // Store in database (isolated from other video systems)
    const { error: dbError } = await supabase
      .from('video_generation_tasks')
      .insert({
        task_id: taskUUID,
        user_id: user_id,
        template: 'isolated_video',
        mode: 'isolated',
        prompt: prompt,
        status: 'processing',
        images: [image_base64],
        model_used: model,
        duration: 5,
        resolution: '1920x1080',
        movement_amplitude: movement_style,
        video_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('❌ ISOLATED VIDEO DB ERROR:', dbError);
      throw new Error('Failed to start video generation');
    }
    
    console.log('✅ ISOLATED VIDEO: Task stored successfully');
    
    // Return clean response with no technical details
    return new Response(JSON.stringify({
      success: true,
      job_id: taskUUID,
      status: 'processing',
      message: 'Video generation started'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ ISOLATED VIDEO ERROR:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Video generation failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
