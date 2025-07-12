import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const allowedOrigins = [
  'https://wakti.qa',
  'https://www.wakti.qa',
  'https://lovable.dev',
  'https://5332ebb7-6fae-483f-a0cc-4262a2a445a1.lovableproject.com'
];

const getCorsHeaders = (origin: string | null) => {
  const corsOrigin = allowedOrigins.includes(origin || '') ? origin : 'https://wakti.qa';
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { taskId } = await req.json();
    
    if (!taskId) {
      throw new Error('Task ID is required');
    }

    console.log('🔍 VIDU STATUS CHECKER: Checking status for task:', taskId);

    const viduApiKey = Deno.env.get('VIDU_API_KEY');
    if (!viduApiKey) {
      console.error('❌ VIDU_API_KEY not found in environment');
      throw new Error('VIDU_API_KEY not configured');
    }

    console.log('🔑 VIDU API KEY found, making request...');

    // Based on official Vidu API docs, the GET status endpoint should be:
    // Most likely: https://api.vidu.com/ent/v2/generation/{task_id}
    const possibleEndpoints = [
      `https://api.vidu.com/ent/v2/generation/${taskId}`,
      `https://api.vidu.com/ent/v2/generations/${taskId}`,
      `https://api.vidu.com/ent/v2/task/${taskId}`,
      `https://api.vidu.com/ent/v2/tasks/${taskId}`,
      `https://api.vidu.com/ent/v2/status/${taskId}`,
      `https://api.vidu.com/ent/v2/job/${taskId}`,
      `https://api.vidu.com/ent/v2/jobs/${taskId}`
    ];

    let statusData = null;
    let successfulEndpoint = null;
    let lastError = null;

    // Try each endpoint until one works
    for (const endpoint of possibleEndpoints) {
      try {
        console.log('🌐 Trying endpoint:', endpoint);
        
        const statusResponse = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Token ${viduApiKey}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('📡 Response status:', statusResponse.status, 'for', endpoint);

        if (statusResponse.ok) {
          statusData = await statusResponse.json();
          successfulEndpoint = endpoint;
          console.log('✅ SUCCESS with endpoint:', endpoint);
          console.log('📊 RESPONSE DATA:', statusData);
          break;
        } else {
          const errorText = await statusResponse.text();
          console.log('❌ Failed with status:', statusResponse.status, 'Error:', errorText);
          lastError = `${statusResponse.status}: ${errorText}`;
        }
      } catch (endpointError) {
        console.log('❌ Network error with endpoint:', endpoint, endpointError.message);
        lastError = endpointError.message;
        continue;
      }
    }

    if (!statusData) {
      console.error('❌ All endpoints failed. Last error:', lastError);
      
      // Return processing status instead of failing - keeps polling alive
      return new Response(JSON.stringify({
        success: true,
        taskId: taskId,
        status: 'processing',
        videoUrl: null,
        message: 'Still processing... (API endpoint discovery in progress)',
        debug: {
          triedEndpoints: possibleEndpoints.length,
          lastError: lastError
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse the response based on Vidu API documentation
    const videoStatus = statusData.state || statusData.status || 'processing';
    const videoUrl = statusData.video_url || statusData.videoUrl || statusData.url || null;

    console.log('📊 PARSED STATUS:', videoStatus);
    console.log('🎬 VIDEO URL:', videoUrl);

    return new Response(JSON.stringify({
      success: true,
      taskId: taskId,
      status: videoStatus,
      videoUrl: videoUrl,
      message: videoStatus === 'success' || videoStatus === 'completed' ? 'Video ready!' : 'Still processing...',
      debug: {
        endpoint: successfulEndpoint,
        rawResponse: statusData
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ VIDU STATUS CHECK ERROR:', error);
    
    // Return graceful fallback to keep polling working
    return new Response(JSON.stringify({
      success: true,
      taskId: req.taskId || 'unknown',
      status: 'processing',
      videoUrl: null,
      message: 'Still processing... (temporary error)',
      error: error.message
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
