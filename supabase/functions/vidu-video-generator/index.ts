
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

const VIDU_API_KEY = Deno.env.get('VIDU_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { template, images, prompt, mode, user_id } = await req.json();
    
    console.log('🎬 VIDEO GEN: Starting', { template, mode, imageCount: images?.length });
    
    if (!VIDU_API_KEY) {
      throw new Error('VIDU_API_KEY not configured');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Choose Vidu API endpoint
    const apiUrl = mode === 'image2video' 
      ? 'https://api.vidu.com/ent/v2/img2video'
      : 'https://api.vidu.com/ent/v2/template2video';
    
    // Prepare request body
    const requestBody = mode === 'image2video' ? {
      model: 'vidu2.0',
      images: images,
      prompt: prompt,
      duration: 4,
      resolution: '720p',
      movement_amplitude: 'auto'
    } : {
      template: template,
      images: images,
      prompt: prompt,
      seed: Math.floor(Math.random() * 1000000)
    };
    
    console.log('🎬 CALLING VIDU API:', apiUrl);
    
    // Call Vidu API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${VIDU_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ VIDU ERROR:', response.status, errorText);
      throw new Error(`Vidu API error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ VIDU SUCCESS:', result.task_id);
    
    // Store in database
    const { error: dbError } = await supabase
      .from('video_generation_tasks')
      .insert({
        user_id: user_id,
        task_id: result.task_id,
        template: template,
        mode: mode,
        prompt: prompt,
        status: result.state || 'processing',
        created_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('❌ DB ERROR:', dbError);
    }
    
    // Return success
    return new Response(JSON.stringify({
      success: true,
      job_id: result.task_id,
      status: result.state || 'processing',
      message: 'Video generation started'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ VIDEO ERROR:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
