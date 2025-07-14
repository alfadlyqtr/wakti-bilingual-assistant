
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

console.log('🚀 VIDEO FUNCTION: Starting up...');

serve(async (req) => {
  console.log('📨 VIDEO FUNCTION: Request received', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });
  
  if (req.method === "OPTIONS") {
    console.log('✅ VIDEO FUNCTION: Handling CORS preflight');
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('🔧 VIDEO FUNCTION: Environment check', {
      hasRunwareKey: !!RUNWARE_API_KEY,
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      runwareKeyLength: RUNWARE_API_KEY?.length || 0
    });

    // Validate environment
    if (!RUNWARE_API_KEY) {
      console.error('❌ VIDEO FUNCTION: Missing RUNWARE_API_KEY');
      return new Response(JSON.stringify({
        success: false,
        error: 'RUNWARE_API_KEY not configured in environment'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ VIDEO FUNCTION: Missing Supabase credentials');
      return new Response(JSON.stringify({
        success: false,
        error: 'Supabase credentials not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('📋 VIDEO FUNCTION: Request body parsed', {
        hasImageBase64: !!requestBody.image_base64,
        hasPrompt: !!requestBody.prompt,
        hasUserId: !!requestBody.user_id,
        promptLength: requestBody.prompt?.length || 0,
        movementStyle: requestBody.movement_style
      });
    } catch (parseError) {
      console.error('❌ VIDEO FUNCTION: Failed to parse request body', parseError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON in request body'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { image_base64, prompt, movement_style, user_id } = requestBody;

    // Validate required fields
    if (!user_id) {
      console.error('❌ VIDEO FUNCTION: Missing user_id');
      return new Response(JSON.stringify({
        success: false,
        error: 'user_id is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!image_base64 || !prompt) {
      console.error('❌ VIDEO FUNCTION: Missing required fields', {
        hasImage: !!image_base64,
        hasPrompt: !!prompt
      });
      return new Response(JSON.stringify({
        success: false,
        error: 'image_base64 and prompt are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    console.log('🔌 VIDEO FUNCTION: Initializing Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate task UUID
    const taskUUID = crypto.randomUUID();
    console.log('🆔 VIDEO FUNCTION: Generated task UUID:', taskUUID);

    // Clean up old stuck tasks first
    console.log('🧹 VIDEO FUNCTION: Cleaning up old tasks...');
    try {
      const { error: cleanupError } = await supabase
        .from('video_generation_tasks')
        .update({ 
          status: 'failed',
          error_message: 'Task cleanup - exceeded timeout',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user_id)
        .eq('status', 'processing')
        .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // 30 minutes timeout

      if (cleanupError) {
        console.error('⚠️ VIDEO FUNCTION: Cleanup error (non-fatal):', cleanupError);
      } else {
        console.log('✅ VIDEO FUNCTION: Cleanup completed');
      }
    } catch (cleanupErr) {
      console.error('⚠️ VIDEO FUNCTION: Cleanup exception (non-fatal):', cleanupErr);
    }

    // Upload image to storage
    console.log('📤 VIDEO FUNCTION: Uploading image to storage...');
    let imageUrl;
    try {
      const fileName = `video-input-${taskUUID}.jpg`;
      const filePath = `${user_id}/${fileName}`;
      
      // Convert base64 to bytes
      const base64Data = image_base64.replace(/^data:image\/[a-z]+;base64,/, '');
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ai-temp-images')
        .upload(filePath, byteArray, {
          contentType: 'image/jpeg',
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('❌ VIDEO FUNCTION: Upload failed:', uploadError);
        throw new Error(`Image upload failed: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('ai-temp-images')
        .getPublicUrl(filePath);
      
      imageUrl = urlData.publicUrl;
      console.log('✅ VIDEO FUNCTION: Image uploaded successfully:', imageUrl.substring(0, 100) + '...');
    } catch (uploadErr) {
      console.error('❌ VIDEO FUNCTION: Image upload error:', uploadErr);
      return new Response(JSON.stringify({
        success: false,
        error: `Image upload failed: ${uploadErr.message}`
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Store task in database
    console.log('💾 VIDEO FUNCTION: Storing task in database...');
    try {
      const { error: dbError } = await supabase
        .from('video_generation_tasks')
        .insert({
          task_id: taskUUID,
          user_id: user_id,
          template: 'isolated_video',
          mode: 'isolated',
          prompt: prompt,
          status: 'processing',
          images: [imageUrl],
          duration: 5,
          resolution: '1920x1080',
          movement_amplitude: movement_style || 'auto',
          video_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (dbError) {
        console.error('❌ VIDEO FUNCTION: Database insert failed:', dbError);
        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      console.log('✅ VIDEO FUNCTION: Task stored in database');
    } catch (dbErr) {
      console.error('❌ VIDEO FUNCTION: Database error:', dbErr);
      return new Response(JSON.stringify({
        success: false,
        error: `Database error: ${dbErr.message}`
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Call Runware API
    console.log('🔄 VIDEO FUNCTION: Calling Runware API...');
    try {
      const runwareBody = {
        taskType: "videoInference",
        taskUUID: taskUUID,
        duration: 5,
        model: "klingai:6@3",
        outputFormat: "mp4",
        height: 1920,
        width: 1080,
        numberResults: 1,
        includeCost: true,
        referenceImages: [imageUrl],
        providerSettings: {
          klingai: {
            movementAmplitude: movement_style || "auto",
            creativityLevel: "balanced"
          }
        },
        positivePrompt: prompt,
        deliveryMethod: "async"
      };

      console.log('📨 VIDEO FUNCTION: Runware request body:', JSON.stringify(runwareBody, null, 2));

      const runwareResponse = await fetch('https://api.runware.ai/v1', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RUNWARE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([runwareBody])
      });

      console.log('📨 VIDEO FUNCTION: Runware response status:', runwareResponse.status);

      if (!runwareResponse.ok) {
        const errorText = await runwareResponse.text();
        console.error('❌ VIDEO FUNCTION: Runware API error:', {
          status: runwareResponse.status,
          statusText: runwareResponse.statusText,
          body: errorText
        });

        // Update database with failure
        await supabase
          .from('video_generation_tasks')
          .update({ 
            status: 'failed',
            error_message: `Runware API error: ${runwareResponse.status} - ${errorText}`,
            updated_at: new Date().toISOString()
          })
          .eq('task_id', taskUUID);

        return new Response(JSON.stringify({
          success: false,
          error: `Runware API error: ${runwareResponse.status} - ${errorText}`
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const runwareResult = await runwareResponse.json();
      console.log('✅ VIDEO FUNCTION: Runware API success:', JSON.stringify(runwareResult, null, 2));

      // Update database with model used
      await supabase
        .from('video_generation_tasks')
        .update({ 
          model_used: 'klingai:6@3',
          updated_at: new Date().toISOString()
        })
        .eq('task_id', taskUUID);

      console.log('🎉 VIDEO FUNCTION: Task submitted successfully');

      return new Response(JSON.stringify({
        success: true,
        taskUUID: taskUUID,
        message: 'KlingAI video generation started successfully',
        status: 'processing',
        model_used: 'klingai:6@3',
        estimated_cost: runwareResult[0]?.cost || 0.22,
        debug: {
          imageUploaded: true,
          taskStored: true,
          runwareApiCalled: true,
          runwareResponse: runwareResult
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (runwareErr) {
      console.error('❌ VIDEO FUNCTION: Runware API exception:', runwareErr);
      
      // Update database with failure
      try {
        await supabase
          .from('video_generation_tasks')
          .update({ 
            status: 'failed',
            error_message: `Runware API exception: ${runwareErr.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('task_id', taskUUID);
      } catch (updateErr) {
        console.error('❌ VIDEO FUNCTION: Failed to update DB with error:', updateErr);
      }

      return new Response(JSON.stringify({
        success: false,
        error: `Runware API exception: ${runwareErr.message}`
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ VIDEO FUNCTION: Unexpected error:', error);
    console.error('❌ VIDEO FUNCTION: Error stack:', error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: `Unexpected error: ${error.message}`,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

console.log('✅ VIDEO FUNCTION: Setup complete, ready to handle requests');
