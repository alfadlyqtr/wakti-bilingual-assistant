
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');

serve(async (req) => {
  console.log('🔍 RUNWARE GET RESPONSE: Function called, method:', req.method);
  
  if (req.method === "OPTIONS") {
    console.log('✅ RUNWARE GET RESPONSE: Handling CORS preflight');
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { taskUUID } = requestBody;
    
    console.log('🔍 RUNWARE GET RESPONSE: Request received', { taskUUID });
    
    if (!RUNWARE_API_KEY) {
      console.error('❌ RUNWARE GET RESPONSE: RUNWARE_API_KEY not configured');
      throw new Error('Runware API key not configured');
    }

    if (!taskUUID) {
      console.error('❌ RUNWARE GET RESPONSE: No taskUUID provided');
      throw new Error('Task UUID is required');
    }

    const runwareRequestBody = [{
      taskType: "getResponse",
      taskUUID: taskUUID
    }];

    console.log('🔍 RUNWARE GET RESPONSE: Sending to Runware API', runwareRequestBody);
    
    // Call Runware API
    const response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNWARE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(runwareRequestBody)
    });
    
    console.log('📨 RUNWARE GET RESPONSE: Runware response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ RUNWARE GET RESPONSE: API error:', response.status, errorText);
      throw new Error('Failed to get response from Runware API');
    }
    
    const result = await response.json();
    console.log('✅ RUNWARE GET RESPONSE: Runware response received:', result);
    
    // Return the response directly
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ RUNWARE GET RESPONSE ERROR:', error);
    console.error('❌ RUNWARE GET RESPONSE ERROR STACK:', error.stack);
    
    const errorResponse = {
      success: false,
      error: error.message || 'Failed to get response'
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
