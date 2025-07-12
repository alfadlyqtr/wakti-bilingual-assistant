
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ENHANCED CORS CONFIGURATION FOR PRODUCTION
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
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const { taskId } = await req.json();
    
    if (!taskId) {
      throw new Error('Task ID is required');
    }

    console.log('🔍 VIDU STATUS CHECKER: Checking status for task:', taskId);

    // Get Vidu API key
    const viduApiKey = Deno.env.get('VIDU_API_KEY');
    if (!viduApiKey) {
      throw new Error('VIDU_API_KEY not configured');
    }

    // Check video status with Vidu API
    const statusResponse = await fetch(`https://api.vidu.com/ent/v2/jobs/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${viduApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!statusResponse.ok) {
      console.error('❌ VIDU API ERROR:', statusResponse.status);
      throw new Error(`Vidu API error: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    console.log('📊 VIDU STATUS RESPONSE:', statusData);

    return new Response(JSON.stringify({
      success: true,
      taskId: taskId,
      status: statusData.state || 'processing',
      videoUrl: statusData.video_url || null,
      message: statusData.state === 'completed' ? 'Video ready!' : 'Still processing...'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ VIDU STATUS CHECK ERROR:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
