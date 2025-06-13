
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
    console.log('Queueing notification:', params);

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
      console.error('Error queueing notification:', error);
      return null;
    }

    console.log('Notification queued successfully:', data);
    return data;
  } catch (error) {
    console.error('Error in queueNotification:', error);
    return null;
  }
}

export async function sendImmediateNotification(params: QueueNotificationParams): Promise<boolean> {
  try {
    // First queue the notification
    const notificationId = await queueNotification(params);
    if (!notificationId) return false;

    // Then trigger immediate processing
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://hxauxozopvpzpdygoqwf.supabase.co'}/functions/v1/process-notification-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU'}`,
      },
    });

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error sending immediate notification:', error);
    return false;
  }
}

export function generateDeepLink(type: string, data: Record<string, any>): string {
  const baseUrl = window.location.origin;
  
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
