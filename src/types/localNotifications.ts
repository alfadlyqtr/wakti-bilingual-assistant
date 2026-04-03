export type LocalNotificationKind =
  | 'task_due'
  | 'reminder_due'
  | 'snooze_due';

export type LocalNotificationEntityType = 'task' | 'reminder' | 'snooze';

export interface LocalNotificationPayload {
  id: string;
  kind: LocalNotificationKind;
  title: string;
  body: string;
  scheduledAt: string;
  deepLink: string;
  entityId: string;
  entityType: LocalNotificationEntityType;
  userId: string;
  meta?: Record<string, string>;
}

export interface LocalNotificationScheduleResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface LocalNotificationCancelResult {
  success: boolean;
  error?: string;
}

export interface LocalNotificationPermissionStatus {
  granted: boolean;
  denied: boolean;
  unknown: boolean;
}

export interface LocalNotificationSyncResult {
  scheduled: number;
  canceled: number;
  skipped: number;
  errors: string[];
}

export interface LocalNotificationTapPayload {
  id: string;
  kind: LocalNotificationKind;
  entityId: string;
  entityType: LocalNotificationEntityType;
  deepLink: string;
  userId: string;
}

export type LocalNotificationTapHandler = (payload: LocalNotificationTapPayload) => void;
