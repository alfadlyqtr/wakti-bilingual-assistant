import {
  scheduleLocalNotification,
  cancelLocalNotification,
  isLocalNotificationsSupported,
} from '@/integrations/natively/localNotificationsBridge';
import type {
  LocalNotificationPayload,
  LocalNotificationKind,
  LocalNotificationEntityType,
  LocalNotificationScheduleResult,
  LocalNotificationCancelResult,
} from '@/types/localNotifications';
import type { TRTask, TRReminder } from '@/services/trService';

const LOG = '[LocalNotificationService]';

const ID_PREFIX = 'wakti:local';

export function makeLocalNotifId(
  entityType: LocalNotificationEntityType,
  entityId: string,
  suffix?: string
): string {
  return suffix
    ? `${ID_PREFIX}:${entityType}:${entityId}:${suffix}`
    : `${ID_PREFIX}:${entityType}:${entityId}`;
}

function isFuture(isoString: string): boolean {
  return new Date(isoString).getTime() > Date.now();
}

function isValidIso(isoString: string | null | undefined): isoString is string {
  if (!isoString) return false;
  const d = new Date(isoString);
  return !isNaN(d.getTime());
}

export function buildTaskPayload(task: TRTask, userId: string): LocalNotificationPayload | null {
  const iso = buildIsoFromDateAndTime(task.due_date, task.due_time);
  if (!isValidIso(iso) || !isFuture(iso!)) return null;

  return {
    id: makeLocalNotifId('task', task.id),
    kind: 'task_due' as LocalNotificationKind,
    title: 'Task Due',
    body: task.title,
    scheduledAt: iso!,
    deepLink: '/tr',
    entityId: task.id,
    entityType: 'task' as LocalNotificationEntityType,
    userId,
  };
}

export function buildReminderPayload(reminder: TRReminder, userId: string): LocalNotificationPayload | null {
  const iso = buildIsoFromDateAndTime(reminder.due_date, reminder.due_time);
  if (!isValidIso(iso) || !isFuture(iso!)) return null;

  return {
    id: makeLocalNotifId('reminder', reminder.id),
    kind: 'reminder_due' as LocalNotificationKind,
    title: 'Reminder',
    body: reminder.title,
    scheduledAt: iso!,
    deepLink: '/tr',
    entityId: reminder.id,
    entityType: 'reminder' as LocalNotificationEntityType,
    userId,
  };
}

export function buildSnoozePayload(
  entityType: LocalNotificationEntityType,
  entityId: string,
  entityTitle: string,
  snoozeUntilIso: string,
  userId: string
): LocalNotificationPayload | null {
  if (!isValidIso(snoozeUntilIso) || !isFuture(snoozeUntilIso)) return null;

  const suffix = new Date(snoozeUntilIso).getTime().toString();
  return {
    id: makeLocalNotifId('snooze', entityId, suffix),
    kind: 'snooze_due' as LocalNotificationKind,
    title: 'Snoozed Reminder',
    body: entityTitle,
    scheduledAt: snoozeUntilIso,
    deepLink: '/tr',
    entityId,
    entityType,
    userId,
  };
}

function buildIsoFromDateAndTime(dueDate?: string | null, dueTime?: string | null): string | null {
  if (!dueDate) return null;
  if (!dueTime) return null;
  const t = (dueTime || '').trim();
  if (!t) return null;
  const normalizedTime = t.length === 5 ? `${t}:00` : t;
  const d = new Date(`${dueDate}T${normalizedTime}`);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function scheduleTaskNotification(
  task: TRTask,
  userId: string
): Promise<LocalNotificationScheduleResult> {
  return new Promise((resolve) => {
    if (!isLocalNotificationsSupported()) {
      resolve({ success: false, error: 'Local notifications not supported on this device' });
      return;
    }

    if (task.completed) {
      resolve({ success: false, error: 'Task is already completed' });
      return;
    }

    const payload = buildTaskPayload(task, userId);
    if (!payload) {
      console.log(LOG, 'Skipping task — no valid future due time:', task.id);
      resolve({ success: false, error: 'No valid future due time' });
      return;
    }

    scheduleLocalNotification(payload, (result) => {
      if (result.success) {
        console.log(LOG, '✅ Task scheduled:', task.id, payload.scheduledAt);
      } else {
        console.warn(LOG, '❌ Task scheduling failed:', task.id, result.error);
      }
      resolve(result);
    });
  });
}

export function scheduleReminderNotification(
  reminder: TRReminder,
  userId: string
): Promise<LocalNotificationScheduleResult> {
  return new Promise((resolve) => {
    if (!isLocalNotificationsSupported()) {
      resolve({ success: false, error: 'Local notifications not supported on this device' });
      return;
    }

    const payload = buildReminderPayload(reminder, userId);
    if (!payload) {
      console.log(LOG, 'Skipping reminder — no valid future due time:', reminder.id);
      resolve({ success: false, error: 'No valid future due time' });
      return;
    }

    scheduleLocalNotification(payload, (result) => {
      if (result.success) {
        console.log(LOG, '✅ Reminder scheduled:', reminder.id, payload.scheduledAt);
      } else {
        console.warn(LOG, '❌ Reminder scheduling failed:', reminder.id, result.error);
      }
      resolve(result);
    });
  });
}

export function scheduleSnoozeNotification(
  entityType: LocalNotificationEntityType,
  entityId: string,
  entityTitle: string,
  snoozeUntilIso: string,
  userId: string
): Promise<LocalNotificationScheduleResult> {
  return new Promise((resolve) => {
    if (!isLocalNotificationsSupported()) {
      resolve({ success: false, error: 'Local notifications not supported on this device' });
      return;
    }

    const payload = buildSnoozePayload(entityType, entityId, entityTitle, snoozeUntilIso, userId);
    if (!payload) {
      resolve({ success: false, error: 'Invalid or past snooze time' });
      return;
    }

    scheduleLocalNotification(payload, (result) => {
      if (result.success) {
        console.log(LOG, '✅ Snooze scheduled:', entityId, snoozeUntilIso);
      } else {
        console.warn(LOG, '❌ Snooze scheduling failed:', entityId, result.error);
      }
      resolve(result);
    });
  });
}

export function cancelTaskNotification(taskId: string): Promise<LocalNotificationCancelResult> {
  return new Promise((resolve) => {
    if (!isLocalNotificationsSupported()) {
      resolve({ success: false, error: 'Local notifications not supported on this device' });
      return;
    }
    const id = makeLocalNotifId('task', taskId);
    cancelLocalNotification(id, (result) => {
      if (result.success) {
        console.log(LOG, '✅ Task notification canceled:', taskId);
      } else {
        console.warn(LOG, '❌ Task cancel failed:', taskId, result.error);
      }
      resolve(result);
    });
  });
}

export function cancelReminderNotification(reminderId: string): Promise<LocalNotificationCancelResult> {
  return new Promise((resolve) => {
    if (!isLocalNotificationsSupported()) {
      resolve({ success: false, error: 'Local notifications not supported on this device' });
      return;
    }
    const id = makeLocalNotifId('reminder', reminderId);
    cancelLocalNotification(id, (result) => {
      if (result.success) {
        console.log(LOG, '✅ Reminder notification canceled:', reminderId);
      } else {
        console.warn(LOG, '❌ Reminder cancel failed:', reminderId, result.error);
      }
      resolve(result);
    });
  });
}
