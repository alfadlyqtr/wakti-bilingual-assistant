// ReminderService.ts
// Handles parsing AI responses for reminder blocks and creating scheduled notifications

import { supabase } from '@/integrations/supabase/client';

export interface ReminderOffer {
  offer: boolean;
  suggested_time: string;
  reminder_text: string;
  context: string;
}

export interface ReminderConfirm {
  confirmed: boolean;
  scheduled_for: string;
  reminder_text: string;
  user_timezone?: string;
}

export interface ParsedReminder {
  type: 'offer' | 'confirm';
  data: ReminderOffer | ReminderConfirm;
}

/**
 * Parse AI response content for reminder JSON blocks (HTML comment format)
 */
export function parseReminderFromResponse(content: string): ParsedReminder | null {
  if (!content) return null;

  // Check for reminder offer block (new HTML comment format)
  const offerMatch = content.match(/<!--WAKTI_REMINDER_OFFER:([\s\S]*?)-->/);
  if (offerMatch) {
    try {
      const data = JSON.parse(offerMatch[1].trim()) as ReminderOffer;
      return { type: 'offer', data: { ...data, offer: true } };
    } catch (e) {
      console.warn('[ReminderService] Failed to parse reminder offer:', e);
    }
  }

  // Check for reminder confirm block (new HTML comment format)
  const confirmMatch = content.match(/<!--WAKTI_REMINDER_CONFIRM:([\s\S]*?)-->/);
  if (confirmMatch) {
    try {
      const data = JSON.parse(confirmMatch[1].trim()) as ReminderConfirm;
      return { type: 'confirm', data: { ...data, confirmed: true } };
    } catch (e) {
      console.warn('[ReminderService] Failed to parse reminder confirm:', e);
    }
  }

  // Legacy format support (code blocks)
  const legacyOfferMatch = content.match(/```wakti-reminder\s*([\s\S]*?)```/);
  if (legacyOfferMatch) {
    try {
      const data = JSON.parse(legacyOfferMatch[1].trim()) as ReminderOffer;
      if (data.offer) {
        return { type: 'offer', data };
      }
    } catch (e) {
      console.warn('[ReminderService] Failed to parse legacy reminder offer:', e);
    }
  }

  const legacyConfirmMatch = content.match(/```wakti-reminder-confirm\s*([\s\S]*?)```/);
  if (legacyConfirmMatch) {
    try {
      const data = JSON.parse(legacyConfirmMatch[1].trim()) as ReminderConfirm;
      if (data.confirmed) {
        return { type: 'confirm', data };
      }
    } catch (e) {
      console.warn('[ReminderService] Failed to parse legacy reminder confirm:', e);
    }
  }

  return null;
}

/**
 * Remove reminder JSON blocks from content for display
 */
export function stripReminderBlocks(content: string): string {
  if (!content) return content;
  return content
    // New HTML comment format (hidden from markdown renderers)
    .replace(/<!--WAKTI_REMINDER_OFFER:[\s\S]*?-->/g, '')
    .replace(/<!--WAKTI_REMINDER_CONFIRM:[\s\S]*?-->/g, '')
    // Legacy code block format
    .replace(/```wakti-reminder\s*[\s\S]*?```/g, '')
    .replace(/```wakti-reminder-confirm\s*[\s\S]*?```/g, '')
    .trim();
}

/**
 * Create a scheduled reminder notification
 * Immediately schedules a push notification via OneSignal's send_after feature
 */
export async function createScheduledReminder(
  userId: string,
  reminderText: string,
  scheduledFor: Date | string,
  context?: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    let scheduledDate: Date;
    
    if (typeof scheduledFor === 'string') {
      // Check if the string has timezone info (contains + or Z at the end)
      const hasTimezone = /[Z+\-]\d{0,2}:?\d{0,2}$/.test(scheduledFor) || scheduledFor.endsWith('Z');
      
      if (hasTimezone) {
        // Has timezone - parse directly
        scheduledDate = new Date(scheduledFor);
      } else {
        // No timezone - treat as LOCAL time, not UTC
        // Append the local timezone offset to make it parse correctly
        const localDate = new Date(scheduledFor);
        // Get timezone offset in minutes and convert to hours:minutes format
        const offsetMinutes = localDate.getTimezoneOffset();
        const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
        const offsetMins = Math.abs(offsetMinutes) % 60;
        const offsetSign = offsetMinutes <= 0 ? '+' : '-';
        const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;
        
        scheduledDate = new Date(scheduledFor + offsetStr);
        console.log('[ReminderService] Parsed local time:', scheduledFor, '→', scheduledDate.toISOString());
      }
    } else {
      scheduledDate = scheduledFor;
    }
    
    // Validate the date
    if (isNaN(scheduledDate.getTime())) {
      console.error('[ReminderService] Invalid date:', scheduledFor);
      return { success: false, error: 'Invalid scheduled time' };
    }

    // Don't allow reminders more than 1 minute in the past
    const oneMinuteAgo = Date.now() - 60000;
    if (scheduledDate.getTime() < oneMinuteAgo) {
      console.warn('[ReminderService] Reminder time is in the past:', scheduledDate.toISOString(), 'vs now:', new Date().toISOString());
      return { success: false, error: 'Cannot schedule reminder in the past' };
    }

    console.log('[ReminderService] Creating reminder for', scheduledDate.toISOString());

    // First, save to notification_history for record keeping
    const { data: notifData, error: notifError } = await supabase
      .from('notification_history')
      .insert({
        user_id: userId,
        type: 'ai_reminder',
        title: 'Wakti Reminder',
        body: reminderText,
        scheduled_for: scheduledDate.toISOString(),
        reminder_content: context || reminderText,
        push_sent: false,
        is_read: false,
        data: {
          source: 'wakti_ai_chat',
          context: context || null,
          created_at: new Date().toISOString()
        }
      })
      .select('id')
      .single();

    if (notifError) {
      console.error('[ReminderService] Failed to save reminder to DB:', notifError);
      return { success: false, error: notifError.message };
    }

    const notificationId = notifData?.id;
    console.log('[ReminderService] Saved to DB with ID:', notificationId);

    // Now schedule the push notification via Edge Function
    // OneSignal will hold it and deliver at the exact scheduled time
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(
        'https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/schedule-reminder-push',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: userId,
            reminder_text: reminderText,
            scheduled_for: scheduledDate.toISOString(),
            notification_id: notificationId,
          }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('[ReminderService] ✅ Push scheduled with OneSignal:', result.onesignal_id);
        return { success: true, id: notificationId };
      } else {
        console.error('[ReminderService] Failed to schedule push:', result.error);
        // Still return success since the reminder is saved - push just failed
        return { success: true, id: notificationId, error: `Push scheduling failed: ${result.error}` };
      }
    } catch (pushErr) {
      console.error('[ReminderService] Error calling schedule-reminder-push:', pushErr);
      // Still return success since the reminder is saved
      return { success: true, id: notificationId, error: 'Push scheduling failed' };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ReminderService] Error creating reminder:', err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Get user's pending reminders
 */
export async function getPendingReminders(userId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('notification_history')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'ai_reminder')
      .eq('push_sent', false)
      .not('scheduled_for', 'is', null)
      .gte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });

    if (error) {
      console.error('[ReminderService] Failed to fetch reminders:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[ReminderService] Error fetching reminders:', err);
    return [];
  }
}

/**
 * Cancel a pending reminder
 */
export async function cancelReminder(reminderId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notification_history')
      .delete()
      .eq('id', reminderId)
      .eq('user_id', userId)
      .eq('type', 'ai_reminder')
      .eq('push_sent', false);

    if (error) {
      console.error('[ReminderService] Failed to cancel reminder:', error);
      return false;
    }

    console.log('[ReminderService] ✅ Reminder cancelled:', reminderId);
    return true;
  } catch (err) {
    console.error('[ReminderService] Error cancelling reminder:', err);
    return false;
  }
}

/**
 * Cancel recent pending reminders for a user (used when adjusting/replacing a reminder)
 * This cancels reminders created in the last N minutes to avoid duplicates
 */
export async function cancelRecentPendingReminders(userId: string, withinMinutes: number = 30): Promise<number> {
  try {
    const cutoffTime = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
    
    // First get the IDs of reminders to cancel
    const { data: remindersToCancel, error: fetchError } = await supabase
      .from('notification_history')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'ai_reminder')
      .eq('push_sent', false)
      .gte('created_at', cutoffTime)
      .not('scheduled_for', 'is', null);

    if (fetchError) {
      console.error('[ReminderService] Failed to fetch recent reminders:', fetchError);
      return 0;
    }

    if (!remindersToCancel || remindersToCancel.length === 0) {
      console.log('[ReminderService] No recent pending reminders to cancel');
      return 0;
    }

    const idsToCancel = remindersToCancel.map(r => r.id);
    
    // Delete them
    const { error: deleteError } = await supabase
      .from('notification_history')
      .delete()
      .in('id', idsToCancel);

    if (deleteError) {
      console.error('[ReminderService] Failed to cancel recent reminders:', deleteError);
      return 0;
    }

    console.log('[ReminderService] ✅ Cancelled', idsToCancel.length, 'recent pending reminder(s)');
    return idsToCancel.length;
  } catch (err) {
    console.error('[ReminderService] Error cancelling recent reminders:', err);
    return 0;
  }
}

/**
 * Format a date for display
 */
export function formatReminderTime(date: Date | string, locale = 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid time';

  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  // Relative time for near future
  if (diffMins < 60) {
    return locale === 'ar' ? `بعد ${diffMins} دقيقة` : `in ${diffMins} minutes`;
  }
  if (diffHours < 24) {
    return locale === 'ar' ? `بعد ${diffHours} ساعة` : `in ${diffHours} hours`;
  }
  if (diffDays < 7) {
    return locale === 'ar' ? `بعد ${diffDays} يوم` : `in ${diffDays} days`;
  }

  // Full date for further future
  return d.toLocaleDateString(locale === 'ar' ? 'ar-QA' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export default {
  parseReminderFromResponse,
  stripReminderBlocks,
  createScheduledReminder,
  getPendingReminders,
  cancelReminder,
  cancelRecentPendingReminders,
  formatReminderTime
};
