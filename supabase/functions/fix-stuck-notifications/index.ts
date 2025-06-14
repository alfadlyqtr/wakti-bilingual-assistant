
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  console.log(`[${new Date().toISOString()}] [${requestId}] Starting fix for stuck notifications...`);

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' },
      auth: { persistSession: false }
    });

    // Get all pending notifications
    console.log(`[${requestId}] Fetching all pending notifications...`);
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending');

    if (fetchError) {
      console.error(`[${requestId}] Error fetching notifications:`, fetchError);
      throw fetchError;
    }

    console.log(`[${requestId}] Found ${pendingNotifications?.length || 0} pending notifications`);

    if (!pendingNotifications || pendingNotifications.length === 0) {
      const response = {
        success: true,
        message: 'No pending notifications to fix',
        fixed: 0,
        timestamp: new Date().toISOString(),
        requestId
      };
      
      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update all pending notifications to be scheduled for immediate processing
    const now = new Date().toISOString();
    console.log(`[${requestId}] Updating ${pendingNotifications.length} notifications to schedule for immediate processing...`);
    
    const { data: updatedNotifications, error: updateError } = await supabase
      .from('notification_queue')
      .update({ 
        scheduled_for: now,
        attempts: 0, // Reset attempts
        updated_at: now
      })
      .eq('status', 'pending')
      .select();

    if (updateError) {
      console.error(`[${requestId}] Error updating notifications:`, updateError);
      throw updateError;
    }

    console.log(`[${requestId}] Successfully updated ${updatedNotifications?.length || 0} notifications`);

    // Trigger immediate processing
    console.log(`[${requestId}] Triggering immediate notification processing...`);
    const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-notification-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({})
    });

    let processResult;
    try {
      processResult = await processResponse.json();
    } catch (e) {
      processResult = await processResponse.text();
    }

    console.log(`[${requestId}] Processing trigger result:`, processResult);

    const totalTime = Date.now() - startTime;
    const response = {
      success: true,
      message: `Fixed ${updatedNotifications?.length || 0} stuck notifications`,
      fixed: updatedNotifications?.length || 0,
      processingTriggered: processResponse.ok,
      processResult,
      totalTimeMs: totalTime,
      timestamp: new Date().toISOString(),
      requestId
    };

    console.log(`[${requestId}] Fix completed successfully:`, response);

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorResult = {
      error: 'Internal server error',
      message: error.message,
      totalTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      requestId
    };
    
    console.error(`[${requestId}] Error in fix-stuck-notifications:`, errorResult);
    
    return new Response(JSON.stringify(errorResult), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
