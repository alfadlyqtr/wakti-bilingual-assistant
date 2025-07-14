
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
    const { task_id } = await req.json();
    
    console.log('🔍 RUNWARE STATUS: Checking task', task_id);
    
    if (!RUNWARE_API_KEY) {
      throw new Error('RUNWARE_API_KEY not configured');
    }

    if (!task_id) {
      throw new Error('task_id is required');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check Runware API for status
    const requestBody = {
      taskType: "getResponse",
      taskUUID: task_id
    };

    console.log('🔍 STATUS REQUEST:', JSON.stringify(requestBody, null, 2));
    
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
      console.error('❌ RUNWARE STATUS ERROR:', response.status, errorText);
      throw new Error(`Runware status check failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ RUNWARE STATUS RESPONSE:', result);
    
    // Parse the response
    const taskData = result[0];
    if (!taskData) {
      return new Response(JSON.stringify({
        success: true,
        status: 'processing',
        message: 'Task still processing'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let dbStatus = 'processing';
    let videoUrl = null;
    let errorMessage = null;

    if (taskData.error) {
      dbStatus = 'failed';
      errorMessage = taskData.error;
    } else if (taskData.videoURL) {
      dbStatus = 'completed';
      videoUrl = taskData.videoURL;
    }
    
    // Update database
    const { error: dbError } = await supabase
      .from('video_generation_tasks')
      .update({
        status: dbStatus,
        video_url: videoUrl,
        error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('task_id', task_id);

    if (dbError) {
      console.error('❌ DB UPDATE ERROR:', dbError);
      throw new Error(`Database update error: ${dbError.message}`);
    }
    
    console.log(`✅ DATABASE UPDATED: Task ${task_id} status: ${dbStatus}`);
    
    return new Response(JSON.stringify({
      success: true,
      status: dbStatus,
      video_url: videoUrl,
      error_message: errorMessage,
      task_data: taskData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ RUNWARE STATUS ERROR:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
