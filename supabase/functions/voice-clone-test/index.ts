import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  console.log(`🧪 TEST: ${req.method} ${req.url}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const timestamp = new Date().toISOString();
    
    console.log(`🧪 TEST: Function is working at ${timestamp}`);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Voice clone test function is working!',
      timestamp: timestamp,
      method: req.method,
      url: req.url
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('🧪 TEST: Error in test function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Test function failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});