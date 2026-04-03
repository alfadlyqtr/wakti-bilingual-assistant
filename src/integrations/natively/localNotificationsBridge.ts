import type {
  LocalNotificationPayload,
  LocalNotificationScheduleResult,
  LocalNotificationCancelResult,
  LocalNotificationPermissionStatus,
  LocalNotificationTapPayload,
  LocalNotificationTapHandler,
} from '@/types/localNotifications';

const LOG = '[LocalNotificationsBridge]';
const SW_PATH = '/sw-local-notifications.js';

let _swRegistration: ServiceWorkerRegistration | null = null;
let _tapHandler: LocalNotificationTapHandler | null = null;

// ─── Service Worker registration ─────────────────────────────────────────────

async function getSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (_swRegistration) return _swRegistration;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    _swRegistration = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
    console.log(LOG, '✅ Service Worker registered');

    // Listen for tap messages from the SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'LOCAL_NOTIF_TAP' && _tapHandler) {
        const data = event.data.payload || {};
        const tapPayload: LocalNotificationTapPayload = {
          id: data.id || '',
          kind: data.kind,
          entityId: data.entityId || '',
          entityType: data.entityType || 'reminder',
          deepLink: data.deepLink || '/',
          userId: data.userId || '',
        };
        console.log(LOG, '📲 Notification tapped:', tapPayload);
        _tapHandler(tapPayload);
      }
    });

    return _swRegistration;
  } catch (err) {
    console.error(LOG, 'Service Worker registration failed:', err);
    return null;
  }
}

function sendToSW(
  type: string,
  payload: unknown
): Promise<{ success: boolean; error?: string; id?: string }> {
  return new Promise(async (resolve) => {
    const reg = await getSwRegistration();
    if (!reg || !reg.active) {
      resolve({ success: false, error: 'Service Worker not active' });
      return;
    }

    const channel = new MessageChannel();
    channel.port1.onmessage = (e) => resolve(e.data || { success: false });

    try {
      reg.active.postMessage({ type, payload }, [channel.port2]);
    } catch (err) {
      resolve({ success: false, error: String(err) });
    }
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function isLocalNotificationsSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function checkLocalNotificationPermission(
  callback: (status: LocalNotificationPermissionStatus) => void
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    callback({ granted: false, denied: false, unknown: true });
    return;
  }
  const p = Notification.permission;
  callback({
    granted: p === 'granted',
    denied: p === 'denied',
    unknown: p === 'default',
  });
}

export function requestLocalNotificationPermission(
  callback: (status: LocalNotificationPermissionStatus) => void
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    callback({ granted: false, denied: false, unknown: true });
    return;
  }

  if (Notification.permission === 'granted') {
    callback({ granted: true, denied: false, unknown: false });
    return;
  }

  Notification.requestPermission()
    .then((result) => {
      callback({
        granted: result === 'granted',
        denied: result === 'denied',
        unknown: result === 'default',
      });
    })
    .catch(() => callback({ granted: false, denied: false, unknown: true }));
}

export function scheduleLocalNotification(
  payload: LocalNotificationPayload,
  callback?: (result: LocalNotificationScheduleResult) => void
): void {
  if (Notification.permission !== 'granted') {
    console.warn(LOG, 'Notification permission not granted — cannot schedule:', payload.id);
    callback?.({ success: false, error: 'Permission not granted' });
    return;
  }

  const fireAt = new Date(payload.scheduledAt).getTime();
  if (isNaN(fireAt) || fireAt <= Date.now()) {
    callback?.({ success: false, error: 'Invalid or past scheduled time' });
    return;
  }

  const swPayload = {
    id: payload.id,
    title: payload.title,
    body: payload.body,
    fireAt,
    data: {
      id: payload.id,
      kind: payload.kind,
      entityId: payload.entityId,
      entityType: payload.entityType,
      deepLink: payload.deepLink,
      userId: payload.userId,
      ...(payload.meta || {}),
    },
  };

  sendToSW('SCHEDULE', swPayload)
    .then((result) => {
      console.log(LOG, result.success ? '✅ Scheduled' : '❌ Failed', payload.id);
      callback?.(result.success
        ? { success: true, id: payload.id }
        : { success: false, error: result.error });
    })
    .catch((err) => callback?.({ success: false, error: String(err) }));
}

export function cancelLocalNotification(
  notificationId: string,
  callback?: (result: LocalNotificationCancelResult) => void
): void {
  sendToSW('CANCEL', { id: notificationId })
    .then((result) => {
      console.log(LOG, result.success ? '✅ Canceled' : '❌ Cancel failed', notificationId);
      callback?.(result);
    })
    .catch((err) => callback?.({ success: false, error: String(err) }));
}

export function cancelAllLocalNotifications(
  callback?: (result: LocalNotificationCancelResult) => void
): void {
  sendToSW('CANCEL_ALL', {})
    .then((result) => {
      console.log(LOG, result.success ? '✅ Canceled all' : '❌ Cancel all failed');
      callback?.(result);
    })
    .catch((err) => callback?.({ success: false, error: String(err) }));
}

export function setLocalNotificationTapHandler(handler: LocalNotificationTapHandler): void {
  _tapHandler = handler;
  getSwRegistration().catch(() => {});
  console.log(LOG, '✅ Tap handler registered');
}

export async function initLocalNotifications(): Promise<void> {
  if (!isLocalNotificationsSupported()) return;
  await getSwRegistration();
}
