import { supabase } from '@/integrations/supabase/client';
import {
  cancelAllLocalNotifications,
  isLocalNotificationsSupported,
} from '@/integrations/natively/localNotificationsBridge';
import {
  scheduleTaskNotification,
  scheduleReminderNotification,
} from '@/services/localNotificationService';
import type { TRTask, TRReminder } from '@/services/trService';
import type { LocalNotificationSyncResult } from '@/types/localNotifications';

const LOG = '[LocalNotificationSyncService]';

const MAX_UPCOMING_DAYS = 30;
const MAX_NOTIFICATIONS = 50;

let syncInProgress = false;

function getUpcomingCutoff(): string {
  const d = new Date();
  d.setDate(d.getDate() + MAX_UPCOMING_DAYS);
  return d.toISOString().split('T')[0];
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

async function fetchUpcomingTasks(userId: string): Promise<TRTask[]> {
  try {
    const today = getTodayDate();
    const cutoff = getUpcomingCutoff();

    const { data, error } = await (supabase as any)
      .from('tr_tasks')
      .select('id, user_id, title, description, due_date, due_time, priority, task_type, is_shared, completed, completed_at, snoozed_until, created_at, updated_at')
      .eq('user_id', userId)
      .eq('completed', false)
      .not('due_time', 'is', null)
      .gte('due_date', today)
      .lte('due_date', cutoff)
      .order('due_date', { ascending: true })
      .limit(MAX_NOTIFICATIONS);

    if (error) {
      console.error(LOG, 'Error fetching tasks:', error.message);
      return [];
    }

    return (data as TRTask[]) || [];
  } catch (err) {
    console.error(LOG, 'Unexpected error fetching tasks:', err);
    return [];
  }
}

async function fetchUpcomingReminders(userId: string): Promise<TRReminder[]> {
  try {
    const today = getTodayDate();
    const cutoff = getUpcomingCutoff();

    const { data, error } = await (supabase as any)
      .from('tr_reminders')
      .select('id, user_id, title, description, due_date, due_time, snoozed_until, notified_at, created_at, updated_at')
      .eq('user_id', userId)
      .is('notified_at', null)
      .not('due_time', 'is', null)
      .gte('due_date', today)
      .lte('due_date', cutoff)
      .order('due_date', { ascending: true })
      .limit(MAX_NOTIFICATIONS);

    if (error) {
      console.error(LOG, 'Error fetching reminders:', error.message);
      return [];
    }

    return (data as TRReminder[]) || [];
  } catch (err) {
    console.error(LOG, 'Unexpected error fetching reminders:', err);
    return [];
  }
}

export async function syncLocalNotifications(userId: string): Promise<LocalNotificationSyncResult> {
  if (syncInProgress) {
    console.log(LOG, 'Sync already in progress — skipping');
    return { scheduled: 0, canceled: 0, skipped: 0, errors: [] };
  }

  if (!isLocalNotificationsSupported()) {
    console.log(LOG, 'Local notifications not supported on this device — skipping sync');
    return { scheduled: 0, canceled: 0, skipped: 0, errors: ['Not supported'] };
  }

  syncInProgress = true;
  console.log(LOG, '🔄 Starting sync for user:', userId);

  const result: LocalNotificationSyncResult = {
    scheduled: 0,
    canceled: 0,
    skipped: 0,
    errors: [],
  };

  try {
    await new Promise<void>((resolve) => {
      cancelAllLocalNotifications((cancelResult) => {
        if (cancelResult.success) {
          result.canceled = 1;
          console.log(LOG, '✅ Cleared all existing local notifications');
        } else {
          console.warn(LOG, '⚠️ Could not clear all — continuing anyway:', cancelResult.error);
        }
        resolve();
      });
    });

    const [tasks, reminders] = await Promise.all([
      fetchUpcomingTasks(userId),
      fetchUpcomingReminders(userId),
    ]);

    console.log(LOG, `Found ${tasks.length} tasks, ${reminders.length} reminders to schedule`);

    for (const task of tasks) {
      const schedResult = await scheduleTaskNotification(task, userId);
      if (schedResult.success) {
        result.scheduled++;
      } else {
        const isSkip = schedResult.error?.includes('future') || schedResult.error?.includes('past') || schedResult.error?.includes('completed');
        if (isSkip) {
          result.skipped++;
        } else {
          result.errors.push(`task:${task.id}: ${schedResult.error}`);
        }
      }
    }

    for (const reminder of reminders) {
      const schedResult = await scheduleReminderNotification(reminder, userId);
      if (schedResult.success) {
        result.scheduled++;
      } else {
        const isSkip = schedResult.error?.includes('future') || schedResult.error?.includes('past');
        if (isSkip) {
          result.skipped++;
        } else {
          result.errors.push(`reminder:${reminder.id}: ${schedResult.error}`);
        }
      }
    }

    console.log(LOG, `✅ Sync complete — scheduled: ${result.scheduled}, skipped: ${result.skipped}, errors: ${result.errors.length}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(LOG, 'Sync failed unexpectedly:', msg);
    result.errors.push(msg);
  } finally {
    syncInProgress = false;
  }

  return result;
}

export function clearLocalNotificationsOnLogout(): void {
  if (!isLocalNotificationsSupported()) return;

  cancelAllLocalNotifications((result) => {
    if (result.success) {
      console.log(LOG, '✅ Cleared local notifications on logout');
    } else {
      console.warn(LOG, '⚠️ Could not clear on logout:', result.error);
    }
  });
}
