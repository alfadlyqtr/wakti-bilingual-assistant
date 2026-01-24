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
 */
export async function createScheduledReminder(
  userId: string,
  reminderText: string,
  scheduledFor: Date | string,
  context?: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const scheduledDate = typeof scheduledFor === 'string' ? new Date(scheduledFor) : scheduledFor;
    
    // Validate the date
    if (isNaN(scheduledDate.getTime())) {
      return { success: false, error: 'Invalid scheduled time' };
    }

    // Don't allow reminders in the past
    if (scheduledDate.getTime() < Date.now()) {
      return { success: false, error: 'Cannot schedule reminder in the past' };
    }

    const { data, error } = await supabase
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

    if (error) {
      console.error('[ReminderService] Failed to create reminder:', error);
      return { success: false, error: error.message };
    }

    console.log('[ReminderService] ✅ Reminder created:', data?.id, 'for', scheduledDate.toISOString());
    return { success: true, id: data?.id };
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
  formatReminderTime
};
