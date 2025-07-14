
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

serve(async (req) => {
  console.log('🔄 UPLOAD FOR VIDEO: Function called, method:', req.method);
  
  if (req.method === "OPTIONS") {
    console.log('✅ UPLOAD FOR VIDEO: Handling CORS preflight');
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log('📤 UPLOAD FOR VIDEO: Processing file upload request');
    
    const formData = await req.formData();
    console.log('📋 UPLOAD FOR VIDEO: FormData received, keys:', Array.from(formData.keys()));
    
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('❌ UPLOAD FOR VIDEO: No file provided in formData');
      throw new Error('No file provided');
    }

    console.log('📁 UPLOAD FOR VIDEO: File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const dataUrl = `data:${file.type};base64,${base64}`;
    
    console.log('✅ UPLOAD FOR VIDEO: File converted to base64', { 
      fileSize: file.size,
      fileType: file.type,
      base64Length: base64.length 
    });

    const response = {
      success: true,
      base64: dataUrl,
      fileType: file.type,
      fileSize: file.size
    };

    console.log('🚀 UPLOAD FOR VIDEO: Sending success response');
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ UPLOAD FOR VIDEO ERROR:', error);
    console.error('❌ UPLOAD FOR VIDEO ERROR STACK:', error.stack);
    
    const errorResponse = {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
