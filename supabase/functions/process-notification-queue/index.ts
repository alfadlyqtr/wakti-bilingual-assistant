
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting notification processing...`);
  
  try {
    // Enhanced logging for environment validation
    console.log('Environment validation:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      supabaseUrlStart: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'missing'
    });

    // Get pending notifications with detailed logging
    console.log('Fetching pending notifications...');
    const { data: notifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('Database fetch error:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${notifications?.length || 0} pending notifications`);

    if (!notifications || notifications.length === 0) {
      const response = {
        success: true,
        processed: 0,
        message: 'No pending notifications',
        timestamp: new Date().toISOString()
      };
      console.log('No notifications to process, returning:', response);
      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const processingResults = [];

    for (const notification of notifications) {
      const notificationStartTime = Date.now();
      console.log(`Processing notification ${notification.id} for user ${notification.user_id}`);
      
      try {
        // Check if user is active and has valid subscription
        console.log(`Checking subscription for user ${notification.user_id}`);
        const { data: subscription, error: subError } = await supabase
          .from('user_push_subscriptions')
          .select('*')
          .eq('user_id', notification.user_id)
          .eq('is_active', true)
          .single();

        if (subError) {
          console.error(`Subscription check error for user ${notification.user_id}:`, subError);
        }

        if (!subscription) {
          console.log(`No active subscription for user ${notification.user_id}, marking as failed`);
          await markNotificationFailed(notification.id, 'No active subscription', notification.attempts + 1);
          errorCount++;
          processingResults.push({
            notificationId: notification.id,
            status: 'failed',
            reason: 'No active subscription'
          });
          continue;
        }

        console.log(`Active subscription found for user ${notification.user_id}:`, {
          subscriptionId: subscription.id,
          progressierUserId: subscription.progressier_user_id
        });

        // Check quiet hours
        const { data: profile } = await supabase
          .from('profiles')
          .select('notification_preferences')
          .eq('id', notification.user_id)
          .single();

        if (profile?.notification_preferences?.quiet_hours?.enabled) {
          const now = new Date();
          const currentTime = now.toTimeString().slice(0, 5);
          const quietStart = profile.notification_preferences.quiet_hours.start;
          const quietEnd = profile.notification_preferences.quiet_hours.end;

          if (isInQuietHours(currentTime, quietStart, quietEnd)) {
            console.log(`Notification ${notification.id} postponed due to quiet hours`);
            const nextSchedule = calculateNextSchedule(quietEnd);
            await rescheduleNotification(notification.id, nextSchedule);
            processingResults.push({
              notificationId: notification.id,
              status: 'rescheduled',
              reason: 'Quiet hours active'
            });
            continue;
          }
        }

        // Prepare notification payload with enhanced logging
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

        console.log(`Sending notification ${notification.id} via send-push-notification edge function`);
        console.log('Payload summary:', {
          userIds: notificationPayload.userIds,
          title: notificationPayload.title,
          hasDeepLink: !!notificationPayload.url,
          notificationType: notification.notification_type
        });

        // Call send-push-notification edge function with proper URL
        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(notificationPayload),
        });

        console.log(`Push notification response status: ${pushResponse.status}`);
        
        let pushResult;
        try {
          pushResult = await pushResponse.json();
          console.log('Push notification result:', pushResult);
        } catch (parseError) {
          console.error('Failed to parse push response JSON:', parseError);
          pushResult = { error: 'Invalid JSON response from push service' };
        }

        if (pushResponse.ok && pushResult.success) {
          console.log(`Notification ${notification.id} sent successfully`);
          await markNotificationSent(notification, pushResult.progressierResponse);
          successCount++;
          processingResults.push({
            notificationId: notification.id,
            status: 'sent',
            processingTime: Date.now() - notificationStartTime
          });
        } else {
          console.error(`Failed to send notification ${notification.id}:`, pushResult);
          await markNotificationFailed(notification.id, pushResult.error || 'Send failed', notification.attempts + 1);
          errorCount++;
          processingResults.push({
            notificationId: notification.id,
            status: 'failed',
            reason: pushResult.error || 'Send failed'
          });
        }

      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);
        await markNotificationFailed(notification.id, error.message, notification.attempts + 1);
        errorCount++;
        processingResults.push({
          notificationId: notification.id,
          status: 'error',
          reason: error.message
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const totalTime = Date.now() - startTime;
    const finalResult = {
      success: true,
      processed: notifications.length,
      sent: successCount,
      failed: errorCount,
      processingTimeMs: totalTime,
      results: processingResults,
      timestamp: new Date().toISOString()
    };

    console.log(`Notification processing complete in ${totalTime}ms:`, finalResult);

    return new Response(JSON.stringify(finalResult), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorResult = {
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime
    };
    
    console.error('Critical error in process-notification-queue:', errorResult);
    
    return new Response(JSON.stringify(errorResult), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

async function markNotificationSent(notification: any, progressierResponse: any) {
  console.log(`Moving notification ${notification.id} to history as sent`);
  
  try {
    // Move to history
    const { error: historyError } = await supabase
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

    if (historyError) {
      console.error(`Failed to insert notification ${notification.id} into history:`, historyError);
    }

    // Remove from queue
    const { error: deleteError } = await supabase
      .from('notification_queue')
      .delete()
      .eq('id', notification.id);

    if (deleteError) {
      console.error(`Failed to delete notification ${notification.id} from queue:`, deleteError);
    } else {
      console.log(`Successfully moved notification ${notification.id} to history`);
    }
  } catch (error) {
    console.error(`Error in markNotificationSent for ${notification.id}:`, error);
  }
}

async function markNotificationFailed(notificationId: string, error: string, attempts: number = 1) {
  console.log(`Marking notification ${notificationId} as failed (attempt ${attempts})`);
  
  try {
    if (attempts >= 3) {
      console.log(`Notification ${notificationId} exceeded max attempts, moving to history as failed`);
      
      // Get notification data before moving to history
      const { data: notification } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('id', notificationId)
        .single();

      if (notification) {
        const { error: historyError } = await supabase
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

        if (historyError) {
          console.error(`Failed to insert failed notification ${notificationId} into history:`, historyError);
        }

        const { error: deleteError } = await supabase
          .from('notification_queue')
          .delete()
          .eq('id', notificationId);

        if (deleteError) {
          console.error(`Failed to delete failed notification ${notificationId} from queue:`, deleteError);
        }
      }
    } else {
      // Update with retry
      const nextAttempt = new Date();
      nextAttempt.setMinutes(nextAttempt.getMinutes() + (attempts * 5)); // Exponential backoff

      console.log(`Scheduling retry ${attempts} for notification ${notificationId} at ${nextAttempt.toISOString()}`);

      const { error: updateError } = await supabase
        .from('notification_queue')
        .update({
          status: 'pending',
          attempts: attempts,
          scheduled_for: nextAttempt.toISOString()
        })
        .eq('id', notificationId);

      if (updateError) {
        console.error(`Failed to update notification ${notificationId} for retry:`, updateError);
      }
    }
  } catch (error) {
    console.error(`Error in markNotificationFailed for ${notificationId}:`, error);
  }
}

async function rescheduleNotification(notificationId: string, nextSchedule: Date) {
  console.log(`Rescheduling notification ${notificationId} to ${nextSchedule.toISOString()}`);
  
  try {
    const { error } = await supabase
      .from('notification_queue')
      .update({
        scheduled_for: nextSchedule.toISOString()
      })
      .eq('id', notificationId);

    if (error) {
      console.error(`Failed to reschedule notification ${notificationId}:`, error);
    }
  } catch (error) {
    console.error(`Error in rescheduleNotification for ${notificationId}:`, error);
  }
}

function isInQuietHours(currentTime: string, startTime: string, endTime: string): boolean {
  const current = timeToMinutes(currentTime);
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (start <= end) {
    return current >= start && current <= end;
  } else {
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
