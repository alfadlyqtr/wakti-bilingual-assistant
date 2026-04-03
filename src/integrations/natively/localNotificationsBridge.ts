import type {
  LocalNotificationPayload,
  LocalNotificationScheduleResult,
  LocalNotificationCancelResult,
  LocalNotificationPermissionStatus,
  LocalNotificationTapPayload,
  LocalNotificationTapHandler,
} from '@/types/localNotifications';

declare global {
  interface Window {
    NativelyLocalNotifications?: any;
    NativelyNotifications?: any;
  }
}

const LOG = '[LocalNotificationsBridge]';

function getInstance(): any | null {
  try {
    if (typeof window === 'undefined') return null;
    const Ctor =
      (window as any).NativelyLocalNotifications ||
      (window as any).NativelyNotifications;
    if (!Ctor) return null;
    return new Ctor();
  } catch {
    return null;
  }
}

export function isLocalNotificationsSupported(): boolean {
  const n = getInstance();
  if (!n) return false;
  return (
    typeof n.scheduleLocalNotification === 'function' ||
    typeof n.schedule === 'function' ||
    typeof n.scheduleNotification === 'function'
  );
}

export function requestLocalNotificationPermission(
  callback: (status: LocalNotificationPermissionStatus) => void
): void {
  const n = getInstance();
  if (!n) {
    console.warn(LOG, 'SDK not available — cannot request permission');
    callback({ granted: false, denied: false, unknown: true });
    return;
  }

  const tryRequest = n.requestLocalNotificationPermission
    || n.requestPermission
    || null;

  if (typeof tryRequest === 'function') {
    try {
      tryRequest.call(n, (resp: any) => {
        const status = resp?.status || resp?.permission || '';
        const granted = status === 'authorized' || status === 'granted' || resp?.granted === true;
        const denied = status === 'denied' || resp?.denied === true;
        callback({ granted, denied, unknown: !granted && !denied });
      });
    } catch (err) {
      console.error(LOG, 'Error requesting permission:', err);
      callback({ granted: false, denied: false, unknown: true });
    }
  } else {
    console.warn(LOG, 'requestPermission not found on SDK');
    callback({ granted: false, denied: false, unknown: true });
  }
}

export function checkLocalNotificationPermission(
  callback: (status: LocalNotificationPermissionStatus) => void
): void {
  const n = getInstance();
  if (!n) {
    callback({ granted: false, denied: false, unknown: true });
    return;
  }

  const tryCheck =
    n.checkLocalNotificationPermission ||
    n.getPermissionStatus ||
    n.checkPermission ||
    null;

  if (typeof tryCheck === 'function') {
    try {
      tryCheck.call(n, (resp: any) => {
        const status = resp?.status || resp?.permission || '';
        const granted = status === 'authorized' || status === 'granted' || resp?.granted === true;
        const denied = status === 'denied' || resp?.denied === true;
        callback({ granted, denied, unknown: !granted && !denied });
      });
    } catch (err) {
      console.error(LOG, 'Error checking permission:', err);
      callback({ granted: false, denied: false, unknown: true });
    }
  } else {
    console.warn(LOG, 'checkPermission not found on SDK — assuming unknown');
    callback({ granted: false, denied: false, unknown: true });
  }
}

export function scheduleLocalNotification(
  payload: LocalNotificationPayload,
  callback?: (result: LocalNotificationScheduleResult) => void
): void {
  const n = getInstance();
  if (!n) {
    console.warn(LOG, 'SDK not available — cannot schedule:', payload.id);
    callback?.({ success: false, error: 'SDK not available' });
    return;
  }

  const trySchedule =
    n.scheduleLocalNotification ||
    n.schedule ||
    n.scheduleNotification ||
    null;

  if (typeof trySchedule !== 'function') {
    console.warn(LOG, 'schedule method not found on SDK');
    callback?.({ success: false, error: 'schedule method not available' });
    return;
  }

  const nativePayload = {
    id: payload.id,
    title: payload.title,
    body: payload.body,
    fireDate: payload.scheduledAt,
    trigger_at: payload.scheduledAt,
    scheduled_at: payload.scheduledAt,
    data: {
      kind: payload.kind,
      entityId: payload.entityId,
      entityType: payload.entityType,
      deepLink: payload.deepLink,
      userId: payload.userId,
      ...(payload.meta || {}),
    },
  };

  try {
    trySchedule.call(n, nativePayload, (resp: any) => {
      const success =
        resp?.status === 'SUCCESS' ||
        resp?.success === true ||
        resp?.scheduled === true ||
        resp?.id != null;
      console.log(LOG, success ? '✅ Scheduled' : '❌ Failed to schedule', payload.id, resp);
      callback?.({ success, id: payload.id, error: success ? undefined : (resp?.error || 'Unknown error') });
    });
  } catch (err) {
    console.error(LOG, 'Error scheduling notification:', err);
    callback?.({ success: false, error: String(err) });
  }
}

export function cancelLocalNotification(
  notificationId: string,
  callback?: (result: LocalNotificationCancelResult) => void
): void {
  const n = getInstance();
  if (!n) {
    console.warn(LOG, 'SDK not available — cannot cancel:', notificationId);
    callback?.({ success: false, error: 'SDK not available' });
    return;
  }

  const tryCancel =
    n.cancelLocalNotification ||
    n.cancel ||
    n.cancelNotification ||
    null;

  if (typeof tryCancel !== 'function') {
    console.warn(LOG, 'cancel method not found on SDK');
    callback?.({ success: false, error: 'cancel method not available' });
    return;
  }

  try {
    tryCancel.call(n, { id: notificationId }, (resp: any) => {
      const success =
        resp?.status === 'SUCCESS' ||
        resp?.success === true ||
        resp?.canceled === true;
      console.log(LOG, success ? '✅ Canceled' : '❌ Failed to cancel', notificationId, resp);
      callback?.({ success, error: success ? undefined : (resp?.error || 'Unknown error') });
    });
  } catch (err) {
    console.error(LOG, 'Error canceling notification:', err);
    callback?.({ success: false, error: String(err) });
  }
}

export function cancelAllLocalNotifications(
  callback?: (result: LocalNotificationCancelResult) => void
): void {
  const n = getInstance();
  if (!n) {
    callback?.({ success: false, error: 'SDK not available' });
    return;
  }

  const tryCancel =
    n.cancelAllLocalNotifications ||
    n.cancelAll ||
    n.removeAllPendingNotifications ||
    null;

  if (typeof tryCancel !== 'function') {
    console.warn(LOG, 'cancelAll method not found on SDK');
    callback?.({ success: false, error: 'cancelAll method not available' });
    return;
  }

  try {
    tryCancel.call(n, (resp: any) => {
      const success =
        resp?.status === 'SUCCESS' ||
        resp?.success === true ||
        resp?.canceled === true;
      console.log(LOG, success ? '✅ Canceled all' : '❌ Failed to cancel all', resp);
      callback?.({ success, error: success ? undefined : (resp?.error || 'Unknown error') });
    });
  } catch (err) {
    console.error(LOG, 'Error canceling all notifications:', err);
    callback?.({ success: false, error: String(err) });
  }
}

export function setLocalNotificationTapHandler(handler: LocalNotificationTapHandler): void {
  const n = getInstance();
  if (!n) {
    console.warn(LOG, 'SDK not available — cannot set tap handler');
    return;
  }

  const tryHandler =
    n.setLocalNotificationOpenedHandler ||
    n.setNotificationOpenedHandler ||
    n.onNotificationTapped ||
    null;

  if (typeof tryHandler !== 'function') {
    console.warn(LOG, 'tap handler method not found on SDK');
    return;
  }

  try {
    tryHandler.call(n, (notification: any) => {
      const data = notification?.data || notification?.additionalData || notification?.userInfo || {};

      if (!data.kind) {
        console.warn(LOG, 'Tap received but no kind in data — ignoring', notification);
        return;
      }

      const tapPayload: LocalNotificationTapPayload = {
        id: notification?.id || data.id || '',
        kind: data.kind,
        entityId: data.entityId || data.entity_id || '',
        entityType: data.entityType || data.entity_type || 'reminder',
        deepLink: data.deepLink || data.deep_link || '/',
        userId: data.userId || data.user_id || '',
      };

      console.log(LOG, '📲 Notification tapped:', tapPayload);
      handler(tapPayload);
    });
    console.log(LOG, '✅ Tap handler set');
  } catch (err) {
    console.error(LOG, 'Error setting tap handler:', err);
  }
}
