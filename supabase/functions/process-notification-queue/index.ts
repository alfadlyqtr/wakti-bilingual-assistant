
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  try {
    console.log('Processing notification queue...');

    // Get pending notifications
    const { data: notifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(50); // Process in batches

    if (fetchError) {
      throw fetchError;
    }

    if (!notifications || notifications.length === 0) {
      console.log('No pending notifications to process');
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        message: 'No pending notifications'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Processing ${notifications.length} notifications...`);

    let successCount = 0;
    let errorCount = 0;

    for (const notification of notifications) {
      try {
        // Check if user is active and has valid subscription
        const { data: subscription } = await supabase
          .from('user_push_subscriptions')
          .select('*')
          .eq('user_id', notification.user_id)
          .eq('is_active', true)
          .single();

        if (!subscription) {
          console.log(`No active subscription for user ${notification.user_id}`);
          await markNotificationFailed(notification.id, 'No active subscription');
          errorCount++;
          continue;
        }

        // Check quiet hours
        const { data: profile } = await supabase
          .from('profiles')
          .select('notification_preferences')
          .eq('id', notification.user_id)
          .single();

        if (profile?.notification_preferences?.quiet_hours?.enabled) {
          const now = new Date();
          const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
          const quietStart = profile.notification_preferences.quiet_hours.start;
          const quietEnd = profile.notification_preferences.quiet_hours.end;

          if (isInQuietHours(currentTime, quietStart, quietEnd)) {
            console.log(`Skipping notification for user ${notification.user_id} - quiet hours`);
            // Reschedule for after quiet hours
            const nextSchedule = calculateNextSchedule(quietEnd);
            await rescheduleNotification(notification.id, nextSchedule);
            continue;
          }
        }

        // Send notification via Progressier
        const notificationPayload = {
          userIds: [subscription.progressier_user_id || notification.user_id],
          title: notification.title,
          body: notification.body,
          data: {
            ...notification.data,
            deep_link: notification.deep_link,
            notification_id: notification.id,
          },
          url: notification.deep_link,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `wakti-${notification.notification_type}`,
        };

        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(notificationPayload),
        });

        const pushResult = await pushResponse.json();

        if (pushResponse.ok && pushResult.success) {
          // Mark as sent and move to history
          await markNotificationSent(notification, pushResult.progressierResponse);
          successCount++;
        } else {
          // Mark as failed and retry later if attempts < 3
          await markNotificationFailed(notification.id, pushResult.error || 'Send failed', notification.attempts + 1);
          errorCount++;
        }

      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);
        await markNotificationFailed(notification.id, error.message, notification.attempts + 1);
        errorCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Notification processing complete: ${successCount} sent, ${errorCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      processed: notifications.length,
      sent: successCount,
      failed: errorCount
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in process-notification-queue:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

async function markNotificationSent(notification: any, progressierResponse: any) {
  // Move to history
  await supabase
    .from('notification_history')
    .insert({
      user_id: notification.user_id,
      notification_type: notification.notification_type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      deep_link: notification.deep_link,
      delivery_status: 'sent',
      progressier_response: progressierResponse,
      sent_at: new Date().toISOString()
    });

  // Remove from queue
  await supabase
    .from('notification_queue')
    .delete()
    .eq('id', notification.id);
}

async function markNotificationFailed(notificationId: string, error: string, attempts: number = 1) {
  if (attempts >= 3) {
    // Move to history as failed
    const { data: notification } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (notification) {
      await supabase
        .from('notification_history')
        .insert({
          user_id: notification.user_id,
          notification_type: notification.notification_type,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          deep_link: notification.deep_link,
          delivery_status: 'failed',
          progressier_response: { error, attempts },
          sent_at: new Date().toISOString()
        });

      await supabase
        .from('notification_queue')
        .delete()
        .eq('id', notificationId);
    }
  } else {
    // Update with retry
    const nextAttempt = new Date();
    nextAttempt.setMinutes(nextAttempt.getMinutes() + (attempts * 5)); // Exponential backoff

    await supabase
      .from('notification_queue')
      .update({
        status: 'pending',
        attempts: attempts,
        scheduled_for: nextAttempt.toISOString()
      })
      .eq('id', notificationId);
  }
}

async function rescheduleNotification(notificationId: string, nextSchedule: Date) {
  await supabase
    .from('notification_queue')
    .update({
      scheduled_for: nextSchedule.toISOString()
    })
    .eq('id', notificationId);
}

function isInQuietHours(currentTime: string, startTime: string, endTime: string): boolean {
  const current = timeToMinutes(currentTime);
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (start <= end) {
    // Same day quiet hours
    return current >= start && current <= end;
  } else {
    // Overnight quiet hours
    return current >= start || current <= end;
  }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function calculateNextSchedule(quietEndTime: string): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [hours, minutes] = quietEndTime.split(':').map(Number);
  tomorrow.setHours(hours, minutes, 0, 0);
  return tomorrow;
}
