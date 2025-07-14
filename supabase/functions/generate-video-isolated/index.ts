
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
  console.log('🎬 ISOLATED VIDEO: Function called, method:', req.method);
  
  if (req.method === "OPTIONS") {
    console.log('✅ ISOLATED VIDEO: Handling CORS preflight');
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { image_base64, prompt, movement_style, user_id } = requestBody;
    
    console.log('🎬 ISOLATED VIDEO: Request received', { 
      user_id,
      hasImage: !!image_base64,
      promptLength: prompt?.length,
      movement: movement_style,
      hasRunwareKey: !!RUNWARE_API_KEY
    });
    
    if (!RUNWARE_API_KEY) {
      console.error('❌ ISOLATED VIDEO: RUNWARE_API_KEY not configured');
      throw new Error('Runware API key not configured. Please add RUNWARE_API_KEY to Supabase Edge Function secrets.');
    }

    if (!user_id) {
      console.error('❌ ISOLATED VIDEO: No user_id provided');
      throw new Error('User authentication required');
    }

    if (!image_base64 || !prompt) {
      console.error('❌ ISOLATED VIDEO: Missing required fields', {
        hasImage: !!image_base64,
        hasPrompt: !!prompt
      });
      throw new Error('Image and description are required');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('📡 ISOLATED VIDEO: Supabase client initialized');
    
    // Generate unique task UUID
    const taskUUID = crypto.randomUUID();
    console.log('🆔 ISOLATED VIDEO: Generated task UUID:', taskUUID);
    
    // Use klingai:5@3 as specified (best for image-to-video)
    const model = 'klingai:5@3';
    
    // Prepare movement amplitude for KlingAI provider settings
    let movementAmplitude = 'auto';
    if (movement_style && movement_style !== 'auto') {
      const movementMap: Record<string, string> = {
        'slow': '0.2',
        'medium': '0.5', 
        'fast': '0.8'
      };
      movementAmplitude = movementMap[movement_style] || 'auto';
    }

    const runwareRequestBody = [{
      taskType: "videoInference",
      taskUUID: taskUUID,
      model: model,
      positivePrompt: prompt,
      referenceImages: [image_base64], // Use referenceImages as per Runware docs
      duration: 5, // 5 seconds as specified
      width: 1920, // 1920x1080 as specified
      height: 1080,
      fps: 24,
      outputFormat: "MP4",
      outputQuality: 95,
      numberResults: 1,
      deliveryMethod: "async", // Required for video inference
      includeCost: false,
      providerSettings: {
        klingai: {
          movementAmplitude: movementAmplitude
        }
      }
    }];

    console.log('🎬 ISOLATED VIDEO: Sending to Runware', { 
      model, 
      duration: 5, 
      quality: '1080p',
      taskUUID: taskUUID,
      movementAmplitude
    });
    
    // Call Runware API
    const response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNWARE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(runwareRequestBody)
    });
    
    console.log('📨 ISOLATED VIDEO: Runware response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ ISOLATED VIDEO: Runware API error:', response.status, errorText);
      
      // Try to parse error for better user feedback
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.errors && errorData.errors.length > 0) {
          const firstError = errorData.errors[0];
          throw new Error(`Runware API error: ${firstError.message || 'Video generation failed'}`);
        }
      } catch (parseError) {
        // If parsing fails, use generic message
      }
      
      throw new Error('Video generation failed. Please check your image and try again.');
    }
    
    const result = await response.json();
    console.log('✅ ISOLATED VIDEO: Runware response received:', result);
    
    // Verify the response format
    if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
      console.error('❌ ISOLATED VIDEO: Invalid response format:', result);
      throw new Error('Invalid response from video generation service');
    }

    const taskResponse = result.data[0];
    if (taskResponse.taskType !== 'videoInference' || taskResponse.taskUUID !== taskUUID) {
      console.error('❌ ISOLATED VIDEO: Task mismatch:', taskResponse);
      throw new Error('Task mismatch in video generation response');
    }
    
    // Store in database (isolated from other video systems)
    const dbInsert = {
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
      movement_amplitude: movementAmplitude,
      video_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('💾 ISOLATED VIDEO: Storing task in database');
    
    const { error: dbError } = await supabase
      .from('video_generation_tasks')
      .insert(dbInsert);

    if (dbError) {
      console.error('❌ ISOLATED VIDEO DB ERROR:', dbError);
      // Don't fail the whole request if DB insert fails, but log it
      console.warn('⚠️ ISOLATED VIDEO: Database insert failed, but continuing with video generation');
    } else {
      console.log('✅ ISOLATED VIDEO: Task stored successfully');
    }
    
    // Return clean response with taskUUID for polling
    const successResponse = {
      success: true,
      taskUUID: taskUUID,
      status: 'processing',
      message: 'Video generation started successfully'
    };

    console.log('🚀 ISOLATED VIDEO: Sending success response');
    
    return new Response(JSON.stringify(successResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ ISOLATED VIDEO ERROR:', error);
    console.error('❌ ISOLATED VIDEO ERROR STACK:', error.stack);
    
    const errorResponse = {
      success: false,
      error: error.message || 'Video generation failed'
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
