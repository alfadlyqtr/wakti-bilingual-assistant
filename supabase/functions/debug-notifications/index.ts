
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ 
        error: 'User ID required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log('🔍 === NOTIFICATION DEBUG START ===');
    console.log('👤 User ID:', userId);

    // 1. Check user subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    console.log('📱 User subscriptions:', subscription);
    if (subError) console.error('❌ Subscription error:', subError);

    // 2. Check pending notifications
    const { data: pendingNotifications, error: pendingError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('user_id', userId);

    console.log('📋 Pending notifications:', pendingNotifications?.length || 0);
    if (pendingError) console.error('❌ Pending notifications error:', pendingError);

    // 3. Check notification history
    const { data: history, error: historyError } = await supabase
      .from('notification_history')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(10);

    console.log('📚 Recent history count:', history?.length || 0);
    if (historyError) console.error('❌ History error:', historyError);

    // 4. Test cron job setup
    console.log('⚙️ Testing cron job...');
    const { data: cronResult, error: cronError } = await supabase.rpc('setup_notification_cron_job');
    console.log('🔧 Cron setup result:', cronResult);
    if (cronError) console.error('❌ Cron error:', cronError);

    // 5. Test immediate notification processing
    console.log('🔄 Testing notification processing...');
    const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-notification-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    const processResult = await processResponse.json();
    console.log('📊 Process result:', processResult);

    console.log('🔍 === NOTIFICATION DEBUG END ===');

    return new Response(JSON.stringify({
      success: true,
      debug: {
        userId,
        subscriptions: subscription,
        pendingCount: pendingNotifications?.length || 0,
        historyCount: history?.length || 0,
        cronSetup: cronResult,
        processResult
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('🚨 Error in debug-notifications:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
