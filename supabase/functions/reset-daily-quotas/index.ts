
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 Starting daily quota reset process...');

    // Get current date in Qatar timezone (UTC+3)
    const qatarTime = new Date();
    qatarTime.setUTCHours(qatarTime.getUTCHours() + 3);
    const today = qatarTime.toISOString().split('T')[0];

    // Reset daily counts for all users to 0 for today (11:59 PM Qatar time reset)
    const { data: resetData, error: resetError } = await supabase
      .from('user_translation_quotas')
      .update({ 
        daily_count: 0,
        updated_at: new Date().toISOString()
      })
      .eq('daily_date', today);

    if (resetError) {
      console.error('❌ Error resetting daily quotas:', resetError);
      throw resetError;
    }

    console.log('✅ Daily quotas reset successfully for Qatar timezone');

    // Clean up expired extra translations (older than 30 days) - no rollover
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: cleanupData, error: cleanupError } = await supabase
      .from('user_translation_quotas')
      .update({ 
        extra_translations: 0,
        purchase_date: null,
        updated_at: new Date().toISOString()
      })
      .lt('purchase_date', thirtyDaysAgo.toISOString())
      .not('purchase_date', 'is', null);

    if (cleanupError) {
      console.error('❌ Error cleaning up expired extras:', cleanupError);
    } else {
      console.log('✅ Expired extra translations cleaned up (no rollover)');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Daily quota reset completed for Qatar timezone',
        resetCount: resetData?.length || 0,
        cleanupCount: cleanupData?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in daily quota reset:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
