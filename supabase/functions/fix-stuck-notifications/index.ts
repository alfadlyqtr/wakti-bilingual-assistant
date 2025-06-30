
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting stuck notification cleanup...');

    // Find notifications that are stuck (older than 5 minutes and still pending)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: stuckNotifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('scheduled_for', fiveMinutesAgo);

    if (fetchError) {
      throw new Error(`Failed to fetch stuck notifications: ${fetchError.message}`);
    }

    console.log(`Found ${stuckNotifications?.length || 0} stuck notifications`);

    if (!stuckNotifications || stuckNotifications.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No stuck notifications found',
        fixed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Reset stuck notifications to be processed immediately
    const { error: updateError } = await supabase
      .from('notification_queue')
      .update({ 
        scheduled_for: new Date().toISOString(),
        retry_count: 0,
        error_message: null
      })
      .in('id', stuckNotifications.map(n => n.id));

    if (updateError) {
      throw new Error(`Failed to reset stuck notifications: ${updateError.message}`);
    }

    console.log(`Reset ${stuckNotifications.length} stuck notifications`);

    // Now trigger immediate processing
    const processResponse = await supabase.functions.invoke('process-notification-queue', {
      body: {}
    });

    console.log('Triggered notification processing:', processResponse);

    return new Response(JSON.stringify({
      success: true,
      message: `Fixed ${stuckNotifications.length} stuck notifications and triggered processing`,
      fixed: stuckNotifications.length,
      processResult: processResponse.data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in fix-stuck-notifications:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
