import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  isLocalNotificationsSupported,
  checkLocalNotificationPermission,
  requestLocalNotificationPermission,
  setLocalNotificationTapHandler,
} from '@/integrations/natively/localNotificationsBridge';
import {
  syncLocalNotifications,
  clearLocalNotificationsOnLogout,
} from '@/services/localNotificationSyncService';
import {
  scheduleTaskNotification,
  scheduleReminderNotification,
  scheduleSnoozeNotification,
  cancelTaskNotification,
  cancelReminderNotification,
} from '@/services/localNotificationService';
import type { TRTask, TRReminder } from '@/services/trService';
import type {
  LocalNotificationPermissionStatus,
  LocalNotificationEntityType,
} from '@/types/localNotifications';

const LOG = '[useLocalNotifications]';

export function useLocalNotifications(userId: string | null) {
  const navigate = useNavigate();
  const tapHandlerSet = useRef(false);
  const supported = isLocalNotificationsSupported();

  const checkPermission = useCallback(
    (): Promise<LocalNotificationPermissionStatus> =>
      new Promise((resolve) => checkLocalNotificationPermission(resolve)),
    []
  );

  const requestPermission = useCallback(
    (): Promise<LocalNotificationPermissionStatus> =>
      new Promise((resolve) => requestLocalNotificationPermission(resolve)),
    []
  );

  const sync = useCallback(async () => {
    if (!userId || !supported) return;
    const result = await syncLocalNotifications(userId);
    console.log(LOG, 'Sync result:', result);
    return result;
  }, [userId, supported]);

  const scheduleTask = useCallback(
    (task: TRTask) => {
      if (!userId || !supported) return Promise.resolve({ success: false, error: 'Not available' });
      return scheduleTaskNotification(task, userId);
    },
    [userId, supported]
  );

  const scheduleReminder = useCallback(
    (reminder: TRReminder) => {
      if (!userId || !supported) return Promise.resolve({ success: false, error: 'Not available' });
      return scheduleReminderNotification(reminder, userId);
    },
    [userId, supported]
  );

  const scheduleSnooze = useCallback(
    (
      entityType: LocalNotificationEntityType,
      entityId: string,
      entityTitle: string,
      snoozeUntilIso: string
    ) => {
      if (!userId || !supported) return Promise.resolve({ success: false, error: 'Not available' });
      return scheduleSnoozeNotification(entityType, entityId, entityTitle, snoozeUntilIso, userId);
    },
    [userId, supported]
  );

  const cancelTask = useCallback(
    (taskId: string) => {
      if (!supported) return Promise.resolve({ success: false, error: 'Not available' });
      return cancelTaskNotification(taskId);
    },
    [supported]
  );

  const cancelReminder = useCallback(
    (reminderId: string) => {
      if (!supported) return Promise.resolve({ success: false, error: 'Not available' });
      return cancelReminderNotification(reminderId);
    },
    [supported]
  );

  const clearAll = useCallback(() => {
    clearLocalNotificationsOnLogout();
  }, []);

  useEffect(() => {
    if (!supported || tapHandlerSet.current) return;

    setLocalNotificationTapHandler((payload) => {
      console.log(LOG, '📲 Tap received:', payload);
      if (payload.deepLink) {
        navigate(payload.deepLink);
      }
    });

    tapHandlerSet.current = true;
  }, [supported, navigate]);

  useEffect(() => {
    if (!userId || !supported) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log(LOG, 'App resumed — resyncing local notifications');
        syncLocalNotifications(userId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userId, supported]);

  return {
    supported,
    checkPermission,
    requestPermission,
    sync,
    scheduleTask,
    scheduleReminder,
    scheduleSnooze,
    cancelTask,
    cancelReminder,
    clearAll,
  };
}
