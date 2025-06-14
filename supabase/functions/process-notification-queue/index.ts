
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  console.log(`[${new Date().toISOString()}] [${requestId}] ===== STARTING NOTIFICATION PROCESSING =====`);
  
  try {
    // Enhanced logging for environment validation
    console.log(`[${requestId}] Environment validation:`, {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      supabaseUrlStart: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'missing'
    });

    // Get pending notifications with IMMEDIATE scheduling priority
    console.log(`[${requestId}] Fetching pending notifications scheduled for now or past...`);
    const { data: notifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error(`[${requestId}] Database fetch error:`, fetchError);
      throw fetchError;
    }

    console.log(`[${requestId}] Found ${notifications?.length || 0} pending notifications to process`);

    if (!notifications || notifications.length === 0) {
      const response = {
        success: true,
        processed: 0,
        message: 'No pending notifications ready for processing',
        timestamp: new Date().toISOString(),
        requestId
      };
      console.log(`[${requestId}] No notifications to process, returning:`, response);
      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Log details of notifications to be processed
    console.log(`[${requestId}] Notifications to process:`, notifications.map(n => ({
      id: n.id,
      userId: n.user_id,
      type: n.notification_type,
      title: n.title,
      scheduledFor: n.scheduled_for,
      attempts: n.attempts || 0
    })));

    let successCount = 0;
    let errorCount = 0;
    const processingResults = [];

    for (const notification of notifications) {
      const notificationStartTime = Date.now();
      const notificationLogId = `${requestId}-${notification.id.substring(0, 8)}`;
      
      console.log(`[${notificationLogId}] Processing notification ${notification.id} for user ${notification.user_id}`);
      
      try {
        // Check if user is active and has valid subscription
        console.log(`[${notificationLogId}] Checking subscription for user ${notification.user_id}`);
        const { data: subscription, error: subError } = await supabase
          .from('user_push_subscriptions')
          .select('*')
          .eq('user_id', notification.user_id)
          .eq('is_active', true)
          .single();

        if (subError) {
          console.error(`[${notificationLogId}] Subscription check error for user ${notification.user_id}:`, subError);
        }

        if (!subscription) {
          console.log(`[${notificationLogId}] No active subscription for user ${notification.user_id}, marking as failed`);
          await markNotificationFailed(notification.id, 'No active subscription', notification.attempts + 1, notificationLogId);
          errorCount++;
          processingResults.push({
            notificationId: notification.id,
            status: 'failed',
            reason: 'No active subscription'
          });
          continue;
        }

        console.log(`[${notificationLogId}] Active subscription found for user ${notification.user_id}:`, {
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
            console.log(`[${notificationLogId}] Notification postponed due to quiet hours`);
            const nextSchedule = calculateNextSchedule(quietEnd);
            await rescheduleNotification(notification.id, nextSchedule, notificationLogId);
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
            processing_id: notificationLogId
          },
          url: notification.deep_link,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `wakti-${notification.notification_type}`,
        };

        console.log(`[${notificationLogId}] Sending notification via send-push-notification edge function`);
        console.log(`[${notificationLogId}] Payload summary:`, {
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

        console.log(`[${notificationLogId}] Push notification response status: ${pushResponse.status}`);
        
        let pushResult;
        try {
          pushResult = await pushResponse.json();
          console.log(`[${notificationLogId}] Push notification result:`, pushResult);
        } catch (parseError) {
          console.error(`[${notificationLogId}] Failed to parse push response JSON:`, parseError);
          pushResult = { error: 'Invalid JSON response from push service' };
        }

        if (pushResponse.ok && pushResult.success) {
          console.log(`[${notificationLogId}] Notification sent successfully`);
          await markNotificationSent(notification, pushResult.progressierResponse, notificationLogId);
          successCount++;
          processingResults.push({
            notificationId: notification.id,
            status: 'sent',
            processingTime: Date.now() - notificationStartTime
          });
        } else {
          console.error(`[${notificationLogId}] Failed to send notification:`, pushResult);
          await markNotificationFailed(notification.id, pushResult.error || 'Send failed', notification.attempts + 1, notificationLogId);
          errorCount++;
          processingResults.push({
            notificationId: notification.id,
            status: 'failed',
            reason: pushResult.error || 'Send failed'
          });
        }

      } catch (error) {
        console.error(`[${notificationLogId}] Error processing notification:`, error);
        await markNotificationFailed(notification.id, error.message, notification.attempts + 1, notificationLogId);
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
      timestamp: new Date().toISOString(),
      requestId
    };

    console.log(`[${requestId}] ===== NOTIFICATION PROCESSING COMPLETE in ${totalTime}ms =====`);
    console.log(`[${requestId}] Final result:`, finalResult);

    return new Response(JSON.stringify(finalResult), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorResult = {
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
      requestId
    };
    
    console.error(`[${requestId}] ===== CRITICAL ERROR IN NOTIFICATION PROCESSING =====`);
    console.error(`[${requestId}] Error details:`, errorResult);
    
    return new Response(JSON.stringify(errorResult), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

async function markNotificationSent(notification: any, progressierResponse: any, logId: string) {
  console.log(`[${logId}] Moving notification ${notification.id} to history as sent`);
  
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
      console.error(`[${logId}] Failed to insert notification ${notification.id} into history:`, historyError);
    } else {
      console.log(`[${logId}] Successfully inserted notification ${notification.id} into history`);
    }

    // Remove from queue
    const { error: deleteError } = await supabase
      .from('notification_queue')
      .delete()
      .eq('id', notification.id);

    if (deleteError) {
      console.error(`[${logId}] Failed to delete notification ${notification.id} from queue:`, deleteError);
    } else {
      console.log(`[${logId}] Successfully removed notification ${notification.id} from queue`);
    }
  } catch (error) {
    console.error(`[${logId}] Error in markNotificationSent for ${notification.id}:`, error);
  }
}

async function markNotificationFailed(notificationId: string, error: string, attempts: number = 1, logId: string) {
  console.log(`[${logId}] Marking notification ${notificationId} as failed (attempt ${attempts})`);
  
  try {
    if (attempts >= 3) {
      console.log(`[${logId}] Notification ${notificationId} exceeded max attempts, moving to history as failed`);
      
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
          console.error(`[${logId}] Failed to insert failed notification ${notificationId} into history:`, historyError);
        } else {
          console.log(`[${logId}] Successfully moved failed notification ${notificationId} to history`);
        }

        const { error: deleteError } = await supabase
          .from('notification_queue')
          .delete()
          .eq('id', notificationId);

        if (deleteError) {
          console.error(`[${logId}] Failed to delete failed notification ${notificationId} from queue:`, deleteError);
        } else {
          console.log(`[${logId}] Successfully removed failed notification ${notificationId} from queue`);
        }
      }
    } else {
      // IMPROVED: Much shorter retry delays (1-2 minutes instead of exponential)
      const nextAttempt = new Date();
      nextAttempt.setMinutes(nextAttempt.getMinutes() + (attempts === 1 ? 1 : 2)); // 1 min, then 2 min

      console.log(`[${logId}] Scheduling retry ${attempts} for notification ${notificationId} at ${nextAttempt.toISOString()}`);

      const { error: updateError } = await supabase
        .from('notification_queue')
        .update({
          status: 'pending',
          attempts: attempts,
          scheduled_for: nextAttempt.toISOString()
        })
        .eq('id', notificationId);

      if (updateError) {
        console.error(`[${logId}] Failed to update notification ${notificationId} for retry:`, updateError);
      } else {
        console.log(`[${logId}] Successfully scheduled retry for notification ${notificationId}`);
      }
    }
  } catch (error) {
    console.error(`[${logId}] Error in markNotificationFailed for ${notificationId}:`, error);
  }
}

async function rescheduleNotification(notificationId: string, nextSchedule: Date, logId: string) {
  console.log(`[${logId}] Rescheduling notification ${notificationId} to ${nextSchedule.toISOString()}`);
  
  try {
    const { error } = await supabase
      .from('notification_queue')
      .update({
        scheduled_for: nextSchedule.toISOString()
      })
      .eq('id', notificationId);

    if (error) {
      console.error(`[${logId}] Failed to reschedule notification ${notificationId}:`, error);
    } else {
      console.log(`[${logId}] Successfully rescheduled notification ${notificationId}`);
    }
  } catch (error) {
    console.error(`[${logId}] Error in rescheduleNotification for ${notificationId}:`, error);
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
