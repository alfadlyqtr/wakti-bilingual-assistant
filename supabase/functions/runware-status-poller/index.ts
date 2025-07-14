
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
    
    console.log('🔍 RUNWARE STATUS: Checking KlingAI task', task_id);
    
    if (!RUNWARE_API_KEY) {
      throw new Error('RUNWARE_API_KEY not configured');
    }

    if (!task_id) {
      throw new Error('task_id is required');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // First check if task has timed out (10 minutes)
    const { data: taskData } = await supabase
      .from('video_generation_tasks')
      .select('created_at, status')
      .eq('task_id', task_id)
      .single();
    
    if (taskData && taskData.status === 'processing') {
      const createdAt = new Date(taskData.created_at);
      const now = new Date();
      const timeDiff = now.getTime() - createdAt.getTime();
      const timeoutMs = 10 * 60 * 1000; // 10 minutes
      
      if (timeDiff > timeoutMs) {
        console.log('⏰ TASK TIMEOUT: Marking as failed due to timeout');
        
        await supabase
          .from('video_generation_tasks')
          .update({
            status: 'failed',
            error_message: 'Task timed out after 10 minutes',
            updated_at: new Date().toISOString()
          })
          .eq('task_id', task_id);
        
        return new Response(JSON.stringify({
          success: true,
          status: 'failed',
          error_message: 'Task timed out after 10 minutes'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Check Runware API for status
    const requestBody = {
      taskType: "getResponse",
      taskUUID: task_id
    };

    console.log('🔍 KLINGAI STATUS REQUEST:', JSON.stringify(requestBody, null, 2));
    
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
      
      // Handle 400 errors by marking task as failed instead of infinite retries
      if (response.status === 400) {
        console.log('🔴 400 ERROR: Marking task as failed');
        
        await supabase
          .from('video_generation_tasks')
          .update({
            status: 'failed',
            error_message: `Runware API error: ${errorText}`,
            updated_at: new Date().toISOString()
          })
          .eq('task_id', task_id);
        
        return new Response(JSON.stringify({
          success: true,
          status: 'failed',
          error_message: `Runware API error: ${errorText}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      throw new Error(`Runware status check failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ RUNWARE STATUS RESPONSE:', result);
    
    // Parse the response
    const taskResponse = result[0];
    if (!taskResponse) {
      return new Response(JSON.stringify({
        success: true,
        status: 'processing',
        message: 'KlingAI task still processing'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let dbStatus = 'processing';
    let videoUrl = null;
    let errorMessage = null;

    if (taskResponse.error || taskResponse.errorMessage) {
      dbStatus = 'failed';
      errorMessage = taskResponse.errorMessage || taskResponse.error;
      console.log('🔴 TASK ERROR:', errorMessage);
    } else if (taskResponse.videoURL || taskResponse.video_url) {
      dbStatus = 'completed';
      videoUrl = taskResponse.videoURL || taskResponse.video_url;
      console.log('✅ TASK COMPLETED:', videoUrl);
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
    
    console.log(`✅ DATABASE UPDATED: KlingAI Task ${task_id} status: ${dbStatus}`);
    
    return new Response(JSON.stringify({
      success: true,
      status: dbStatus,
      video_url: videoUrl,
      error_message: errorMessage,
      task_data: taskResponse
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
