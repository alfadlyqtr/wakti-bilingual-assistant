
import { supabase } from '@/integrations/supabase/client';

export interface QueueNotificationParams {
  userId: string;
  type: 'messages' | 'task_updates' | 'contact_requests' | 'event_rsvps' | 'calendar_reminders';
  title: string;
  body: string;
  data?: Record<string, any>;
  deepLink?: string;
  scheduledFor?: Date;
}

export async function queueNotification(params: QueueNotificationParams): Promise<string | null> {
  try {
    console.log('Queueing notification:', {
      userId: params.userId,
      type: params.type,
      title: params.title,
      hasData: !!params.data,
      hasDeepLink: !!params.deepLink,
      scheduledFor: params.scheduledFor?.toISOString()
    });

    const { data, error } = await supabase.rpc('queue_notification', {
      p_user_id: params.userId,
      p_notification_type: params.type,
      p_title: params.title,
      p_body: params.body,
      p_data: params.data || {},
      p_deep_link: params.deepLink || null,
      p_scheduled_for: params.scheduledFor?.toISOString() || new Date().toISOString()
    });

    if (error) {
      console.error('Error queueing notification:', {
        error,
        params: {
          userId: params.userId,
          type: params.type,
          title: params.title
        }
      });
      return null;
    }

    console.log('Notification queued successfully:', {
      notificationId: data,
      userId: params.userId,
      type: params.type
    });
    return data;
  } catch (error) {
    console.error('Exception in queueNotification:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      params: {
        userId: params.userId,
        type: params.type,
        title: params.title
      }
    });
    return null;
  }
}

export async function sendImmediateNotification(params: QueueNotificationParams): Promise<boolean> {
  try {
    console.log('Sending immediate notification:', {
      userId: params.userId,
      type: params.type,
      title: params.title
    });

    // First queue the notification
    const notificationId = await queueNotification(params);
    if (!notificationId) {
      console.error('Failed to queue notification for immediate sending');
      return false;
    }

    console.log('Notification queued, triggering immediate processing...');

    // Then trigger immediate processing using environment variables properly
    const supabaseUrl = 'https://hxauxozopvpzpdygoqwf.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU';

    const response = await fetch(`${supabaseUrl}/functions/v1/process-notification-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({})
    });

    console.log('Immediate processing response status:', response.status);

    let result;
    try {
      result = await response.json();
    } catch (e) {
      result = await response.text();
    }

    console.log('Immediate processing result:', result);

    if (response.ok && (result.success || result.processed >= 0)) {
      console.log('Immediate notification processing completed successfully');
      return true;
    } else {
      console.error('Immediate notification processing failed:', result);
      return false;
    }
  } catch (error) {
    console.error('Error sending immediate notification:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      params: {
        userId: params.userId,
        type: params.type,
        title: params.title
      }
    });
    return false;
  }
}

export function generateDeepLink(type: string, data: Record<string, any>): string {
  const baseUrl = window.location.origin;
  
  console.log('Generating deep link:', { type, data });
  
  switch (type) {
    case 'messages':
      return `${baseUrl}/contacts`;
    case 'task_updates':
      return `${baseUrl}/tr`;
    case 'contact_requests':
      return `${baseUrl}/contacts`;
    case 'event_rsvps':
      if (data.event_id) {
        return `${baseUrl}/maw3d/manage/${data.event_id}`;
      }
      return `${baseUrl}/maw3d/events`;
    case 'calendar_reminders':
      return `${baseUrl}/calendar`;
    default:
      return `${baseUrl}/dashboard`;
  }
}

// Helper function to manually trigger notification processing
export async function triggerNotificationProcessing(): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    console.log('Manually triggering notification processing...');

    const supabaseUrl = 'https://hxauxozopvpzpdygoqwf.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU';

    const response = await fetch(`${supabaseUrl}/functions/v1/process-notification-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({})
    });

    let result;
    try {
      result = await response.json();
    } catch (e) {
      result = await response.text();
    }

    console.log('Manual trigger result:', result);

    if (response.ok) {
      return {
        success: true,
        message: 'Notification processing triggered successfully',
        data: result
      };
    } else {
      return {
        success: false,
        message: `Failed to trigger notification processing: ${response.status}`,
        data: result
      };
    }
  } catch (error) {
    console.error('Error triggering notification processing:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Helper function to check notification queue status
export async function getNotificationQueueStatus(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    console.log('Checking notification queue status...');

    const { data: queueCount, error: queueError } = await supabase
      .from('notification_queue')
      .select('status', { count: 'exact' });

    if (queueError) {
      console.error('Error checking queue status:', queueError);
      return { success: false, error: queueError.message };
    }

    const { data: historyCount, error: historyError } = await supabase
      .from('notification_history')
      .select('delivery_status', { count: 'exact' });

    if (historyError) {
      console.error('Error checking history:', historyError);
      return { success: false, error: historyError.message };
    }

    const status = {
      queueTotal: queueCount?.length || 0,
      historyTotal: historyCount?.length || 0,
      timestamp: new Date().toISOString()
    };

    console.log('Notification queue status:', status);
    return { success: true, data: status };
  } catch (error) {
    console.error('Exception checking notification queue status:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
