
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

    console.log('Processing notification queue...');

    // Get pending notifications
    const { data: notifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch notifications: ${fetchError.message}`);
    }

    if (!notifications || notifications.length === 0) {
      console.log('No pending notifications found');
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        message: 'No pending notifications'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${notifications.length} pending notifications`);

    let processed = 0;
    let failed = 0;

    for (const notification of notifications) {
      try {
        console.log(`Processing notification ${notification.id} for user ${notification.user_id}`);

        // Get user's Progressier ID for push notifications
        const { data: profile } = await supabase
          .from('profiles')
          .select('progressier_user_id, display_name, email')
          .eq('id', notification.user_id)
          .single();

        if (!profile || !profile.progressier_user_id) {
          console.log(`No Progressier ID found for user ${notification.user_id}, skipping push notification`);
          // Mark as sent anyway since not all users may have push notifications enabled
          await supabase
            .from('notification_queue')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', notification.id);
          processed++;
          continue;
        }

        // Send push notification
        const pushResponse = await supabase.functions.invoke('send-push-notification', {
          body: {
            userIds: [profile.progressier_user_id],
            title: notification.title,
            body: notification.body,
            data: {
              ...notification.data,
              notification_type: notification.notification_type,
              deep_link: notification.deep_link
            },
            url: notification.deep_link,
            tag: `${notification.notification_type}_${notification.user_id}`,
            requireInteraction: notification.notification_type === 'subscription_activated'
          }
        });

        if (pushResponse.error) {
          console.error(`Push notification failed for ${notification.id}:`, pushResponse.error);
        } else {
          console.log(`Push notification sent successfully for ${notification.id}`);
        }

        // Move to history and mark as sent
        await supabase
          .from('notification_history')
          .insert({
            user_id: notification.user_id,
            notification_type: notification.notification_type,
            title: notification.title,
            body: notification.body,
            data: notification.data,
            deep_link: notification.deep_link,
            sent_at: new Date().toISOString(),
            push_sent: !pushResponse.error
          });

        await supabase
          .from('notification_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', notification.id);

        processed++;
        console.log(`Successfully processed notification ${notification.id}`);

      } catch (error) {
        console.error(`Failed to process notification ${notification.id}:`, error);
        
        // Mark as failed
        await supabase
          .from('notification_queue')
          .update({ 
            status: 'failed', 
            error_message: error.message,
            retry_count: (notification.retry_count || 0) + 1
          })
          .eq('id', notification.id);

        failed++;
      }
    }

    console.log(`Notification processing complete: ${processed} processed, ${failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      processed,
      failed,
      total: notifications.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in process-notification-queue:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
