
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

console.log('🔍 STATUS POLLER: Starting up...');

serve(async (req) => {
  console.log('📨 STATUS POLLER: Request received', {
    method: req.method,
    timestamp: new Date().toISOString()
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('🔧 STATUS POLLER: Environment check', {
      hasRunwareKey: !!RUNWARE_API_KEY,
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey
    });

    if (!RUNWARE_API_KEY) {
      console.error('❌ STATUS POLLER: Missing RUNWARE_API_KEY');
      return new Response(JSON.stringify({
        success: false,
        error: 'RUNWARE_API_KEY not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { task_id } = await req.json();
    
    console.log('🔍 STATUS POLLER: Checking task:', task_id);
    
    if (!task_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'task_id is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if task has timed out (30 minutes for KlingAI)
    const { data: taskData } = await supabase
      .from('video_generation_tasks')
      .select('created_at, status, user_id')
      .eq('task_id', task_id)
      .single();
    
    if (taskData && taskData.status === 'processing') {
      const createdAt = new Date(taskData.created_at);
      const now = new Date();
      const timeDiff = now.getTime() - createdAt.getTime();
      const timeoutMs = 30 * 60 * 1000; // 30 minutes for KlingAI
      
      if (timeDiff > timeoutMs) {
        console.log('⏰ STATUS POLLER: Task timeout, marking as failed');
        
        await supabase
          .from('video_generation_tasks')
          .update({
            status: 'failed',
            error_message: 'Task timed out after 30 minutes',
            updated_at: new Date().toISOString()
          })
          .eq('task_id', task_id);
        
        return new Response(JSON.stringify({
          success: true,
          status: 'failed',
          error_message: 'Task timed out after 30 minutes'
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

    console.log('📨 STATUS POLLER: Runware request:', JSON.stringify(requestBody));
    
    const response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNWARE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([requestBody])
    });
    
    console.log('📨 STATUS POLLER: Runware response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ STATUS POLLER: Runware error:', response.status, errorText);
      
      // Handle 400 errors by marking task as failed
      if (response.status === 400) {
        console.log('🔴 STATUS POLLER: 400 error, marking task as failed');
        
        await supabase
          .from('video_generation_tasks')
          .update({
            status: 'failed',
            error_message: `Runware API error: ${response.status} - ${errorText}`,
            updated_at: new Date().toISOString()
          })
          .eq('task_id', task_id);
        
        return new Response(JSON.stringify({
          success: true,
          status: 'failed',
          error_message: `Runware API error: ${response.status} - ${errorText}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // For other errors, return as temporary failure
      return new Response(JSON.stringify({
        success: false,
        error: `Runware status check failed: ${response.status} - ${errorText}`
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const result = await response.json();
    console.log('✅ STATUS POLLER: Runware response:', JSON.stringify(result, null, 2));
    
    // Parse the response
    const taskResponse = result[0];
    if (!taskResponse) {
      console.log('⏳ STATUS POLLER: No response yet, still processing');
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

    // Check for errors
    if (taskResponse.error || taskResponse.errorMessage) {
      dbStatus = 'failed';
      errorMessage = taskResponse.errorMessage || taskResponse.error;
      console.log('🔴 STATUS POLLER: Task error:', errorMessage);
    } 
    // Check for completion - try multiple possible response fields
    else if (taskResponse.videoURL || taskResponse.video_url || taskResponse.videoUrl) {
      dbStatus = 'completed';
      videoUrl = taskResponse.videoURL || taskResponse.video_url || taskResponse.videoUrl;
      console.log('✅ STATUS POLLER: Task completed:', videoUrl);
    }
    // Check if task is still processing
    else if (taskResponse.status === 'processing' || taskResponse.taskStatus === 'processing') {
      dbStatus = 'processing';
      console.log('⏳ STATUS POLLER: Task still processing...');
    }
    else {
      // Unknown response format, log for debugging
      console.log('❓ STATUS POLLER: Unknown response format:', taskResponse);
    }
    
    // Update database only if status changed
    if (dbStatus !== 'processing' || errorMessage) {
      console.log('💾 STATUS POLLER: Updating database with status:', dbStatus);
      
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
        console.error('❌ STATUS POLLER: DB update error:', dbError);
        return new Response(JSON.stringify({
          success: false,
          error: `Database update error: ${dbError.message}`
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log(`✅ STATUS POLLER: Database updated - Task ${task_id} status: ${dbStatus}`);
    }
    
    return new Response(JSON.stringify({
      success: true,
      status: dbStatus,
      video_url: videoUrl,
      error_message: errorMessage,
      task_data: taskResponse,
      debug: {
        originalResponse: result,
        parsedStatus: dbStatus,
        foundVideoUrl: !!videoUrl
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ STATUS POLLER: Unexpected error:', error);
    console.error('❌ STATUS POLLER: Error stack:', error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: `Status check failed: ${error.message}`,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

console.log('✅ STATUS POLLER: Setup complete, ready to handle requests');
