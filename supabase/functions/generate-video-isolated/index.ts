
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

// POLLING FUNCTION FOR ASYNC VIDEO GENERATION
async function pollForVideoResult(taskUUID: string, maxAttempts = 30) {
  console.log('🎬 POLLING: Starting polling for taskUUID:', taskUUID);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🎬 POLLING: Attempt ${attempt}/${maxAttempts}`);
      
      const pollResponse = await fetch('https://api.runware.ai/v1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            taskType: "authentication",
            apiKey: RUNWARE_API_KEY
          },
          {
            taskType: "getResponse",
            taskUUID: taskUUID
          }
        ])
      });

      if (!pollResponse.ok) {
        console.error('🎬 POLLING: Poll request failed:', pollResponse.status);
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }

      const pollData = await pollResponse.json();
      console.log(`🎬 POLLING: Attempt ${attempt} response:`, JSON.stringify(pollData, null, 2));

      if (pollData.data && pollData.data.length > 0) {
        const videoResult = pollData.data.find((item: any) => 
          item.taskType === 'videoInference' && item.taskUUID === taskUUID
        );

        if (videoResult) {
          if (videoResult.status === 'success' && videoResult.videoURL) {
            console.log('🎬 POLLING: Video generation completed successfully');
            return {
              success: true,
              videoUrl: videoResult.videoURL,
              cost: videoResult.cost || null
            };
          } else if (videoResult.status === 'error') {
            console.error('🎬 POLLING: Video generation failed:', videoResult);
            return {
              success: false,
              error: `Video generation failed: ${videoResult.message || 'Unknown error'}`
            };
          } else if (videoResult.status === 'pending') {
            console.log('🎬 POLLING: Still processing, waiting...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }
        }
      }

      // If no result yet, wait and try again
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error) {
      console.error(`🎬 POLLING: Error on attempt ${attempt}:`, error);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.error('🎬 POLLING: Max attempts reached, video generation timed out');
  return {
    success: false,
    error: 'Video generation timed out after maximum polling attempts'
  };
}

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

    const runwareRequestBody = [
      {
        taskType: "authentication",
        apiKey: RUNWARE_API_KEY
      },
      {
        taskType: "videoInference",
        taskUUID: taskUUID,
        model: model,
        positivePrompt: prompt,
        frameImages: [
          {
            inputImage: image_base64,
            frame: "first"
          }
        ],
        duration: 5,
        width: 1920,
        height: 1080,
        fps: 24,
        outputFormat: "MP4",
        outputQuality: 95,
        numberResults: 1,
        deliveryMethod: "async",
        includeCost: true,
        providerSettings: {
          klingai: {
            movementAmplitude: movementAmplitude
          }
        }
      }
    ];

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

    const taskResponse = result.data.find((item: any) => item.taskType === 'videoInference');
    if (!taskResponse || taskResponse.taskUUID !== taskUUID) {
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
    
    // Start polling for result
    console.log('🎬 ISOLATED VIDEO: Task submitted successfully, starting polling');
    const pollResult = await pollForVideoResult(taskUUID);

    if (pollResult.success) {
      // Update database with successful result
      await supabase
        .from('video_generation_tasks')
        .update({ 
          status: 'completed', 
          video_url: pollResult.videoUrl,
          updated_at: new Date().toISOString()
        })
        .eq('task_id', taskUUID);

      const successResponse = {
        success: true,
        taskUUID: taskUUID,
        videoUrl: pollResult.videoUrl,
        cost: pollResult.cost,
        status: 'completed',
        message: 'Video generated successfully'
      };

      console.log('🚀 ISOLATED VIDEO: Sending success response');
      
      return new Response(JSON.stringify(successResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      // Update database with error
      await supabase
        .from('video_generation_tasks')
        .update({ 
          status: 'failed', 
          updated_at: new Date().toISOString()
        })
        .eq('task_id', taskUUID);

      throw new Error(pollResult.error || 'Video generation failed');
    }
    
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
