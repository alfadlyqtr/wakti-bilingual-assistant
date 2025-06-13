
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { userId, message } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ 
        error: 'User ID required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Testing push notification for user:', userId);

    // Queue a test notification
    const { data: notificationId, error: queueError } = await supabase.rpc('queue_notification', {
      p_user_id: userId,
      p_notification_type: 'test',
      p_title: 'Test Notification',
      p_body: message || 'This is a test notification from Wakti!',
      p_data: { test: true, timestamp: new Date().toISOString() },
      p_deep_link: '/dashboard'
    });

    if (queueError) {
      console.error('Error queueing notification:', queueError);
      return new Response(JSON.stringify({ 
        error: 'Failed to queue notification',
        details: queueError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Trigger immediate processing
    const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-notification-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    const processResult = await processResponse.json();

    return new Response(JSON.stringify({
      success: true,
      notificationId,
      processResult,
      message: 'Test notification queued and processed'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in test-push-notification:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
