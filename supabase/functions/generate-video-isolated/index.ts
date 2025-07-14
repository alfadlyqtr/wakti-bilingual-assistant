
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
    
    // Convert base64 image to storage URL for Runware
    console.log('📤 ISOLATED VIDEO: Uploading image to storage...');
    const fileName = `video-input-${taskUUID}.jpg`;
    const filePath = `${user_id}/${fileName}`;
    
    // Convert data URI to blob
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
      console.error('❌ ISOLATED VIDEO: Image upload failed:', uploadError);
      throw new Error('Failed to upload image for processing');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('ai-temp-images')
      .getPublicUrl(filePath);
    
    const imageUrl = urlData.publicUrl;
    console.log('✅ ISOLATED VIDEO: Image uploaded successfully:', imageUrl);
    
    // Store initial database record
    const dbInsert = {
      task_id: taskUUID,
      user_id: user_id,
      template: 'isolated_video',
      mode: 'isolated',
      prompt: prompt,
      status: 'processing',
      images: [imageUrl],
      duration: 5,
      resolution: '1920x1080',
      movement_amplitude: 'auto',
      video_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('💾 ISOLATED VIDEO: Storing task in database');
    
    const { error: dbError } = await supabase
      .from('video_generation_tasks')
      .insert(dbInsert);

    if (dbError) {
      console.error('❌ ISOLATED VIDEO: Database insert failed:', dbError);
      throw new Error('Failed to create video generation task');
    }

    console.log('✅ ISOLATED VIDEO: Task stored successfully');
    
    // Try models with proper fallback logic
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
          referenceImages: [imageUrl],
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
          lastError = new Error(`${model} failed: ${response.status} - ${errorText}`);
          continue;
        }
        
        result = await response.json();
        modelUsed = model;
        console.log(`✅ MODEL ${model} SUCCESS:`, result);
        
        // Update database with model used
        await supabase
          .from('video_generation_tasks')
          .update({ 
            model_used: modelUsed,
            updated_at: new Date().toISOString()
          })
          .eq('task_id', taskUUID);
        
        break;
        
      } catch (error) {
        console.error(`❌ MODEL ${model} EXCEPTION:`, error);
        lastError = error;
        continue;
      }
    }

    // If all models failed
    if (!result || !modelUsed) {
      console.error('❌ ALL MODELS FAILED:', lastError);
      
      // Update database with failure
      await supabase
        .from('video_generation_tasks')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('task_id', taskUUID);
      
      throw new Error(`All video models failed. Last error: ${lastError?.message}`);
    }
    
    console.log('🎬 ISOLATED VIDEO: Task submitted successfully, will be polled by status checker');
    
    const successResponse = {
      success: true,
      taskUUID: taskUUID,
      message: 'Video generation started successfully',
      status: 'processing'
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
