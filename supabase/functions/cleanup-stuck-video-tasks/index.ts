
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('🧹 CLEANUP: Starting cleanup of stuck video tasks...');
    
    // Mark all processing tasks older than 30 minutes as failed
    const { data: stuckTasks, error: selectError } = await supabase
      .from('video_generation_tasks')
      .select('task_id, created_at, user_id')
      .eq('status', 'processing')
      .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());
    
    if (selectError) {
      console.error('❌ CLEANUP: Error selecting stuck tasks:', selectError);
      throw selectError;
    }
    
    console.log(`🧹 CLEANUP: Found ${stuckTasks?.length || 0} stuck tasks to clean up`);
    
    if (stuckTasks && stuckTasks.length > 0) {
      const { error: updateError } = await supabase
        .from('video_generation_tasks')
        .update({
          status: 'failed',
          error_message: 'Task cleanup - exceeded 30 minute timeout',
          updated_at: new Date().toISOString()
        })
        .eq('status', 'processing')
        .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());
      
      if (updateError) {
        console.error('❌ CLEANUP: Error updating stuck tasks:', updateError);
        throw updateError;
      }
      
      console.log('✅ CLEANUP: Successfully cleaned up stuck tasks');
    }
    
    return new Response(JSON.stringify({
      success: true,
      cleaned_up_count: stuckTasks?.length || 0,
      message: 'Cleanup completed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ CLEANUP: Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
