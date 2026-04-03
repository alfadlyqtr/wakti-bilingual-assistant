/**
 * Wakti Local Notifications Service Worker
 * Handles scheduling and firing of device-side local notifications.
 * Completely separate from OneSignal / push notifications.
 */

const DB_NAME = 'wakti-local-notifs';
const STORE_NAME = 'scheduled';
const ALARM_INTERVAL_MS = 30000; // check every 30 seconds

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('fireAt', 'fireAt', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function saveNotification(notif) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(notif);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function deleteNotification(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getAllNotifications() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = (e) => resolve(e.target.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function clearAllNotifications() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

// ─── Alarm: check and fire due notifications ─────────────────────────────────

async function checkAndFireDue() {
  const now = Date.now();
  let notifications = [];

  try {
    notifications = await getAllNotifications();
  } catch (err) {
    console.error('[SW-LocalNotif] Failed to read DB:', err);
    return;
  }

  for (const notif of notifications) {
    if (notif.fireAt <= now) {
      try {
        await self.registration.showNotification(notif.title, {
          body: notif.body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: notif.id,
          data: notif.data || {},
          requireInteraction: false,
        });
        await deleteNotification(notif.id);
        console.log('[SW-LocalNotif] Fired:', notif.id);
      } catch (err) {
        console.error('[SW-LocalNotif] Failed to show notification:', notif.id, err);
      }
    }
  }
}

// ─── Service Worker lifecycle ─────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  console.log('[SW-LocalNotif] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW-LocalNotif] Activated');
  event.waitUntil(self.clients.claim());
});

// ─── Message handler (from app) ───────────────────────────────────────────────

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  if (type === 'SCHEDULE') {
    saveNotification(payload)
      .then(() => {
        console.log('[SW-LocalNotif] Scheduled:', payload.id, 'at', new Date(payload.fireAt).toISOString());
        event.ports?.[0]?.postMessage({ success: true, id: payload.id });
      })
      .catch((err) => {
        console.error('[SW-LocalNotif] Failed to schedule:', err);
        event.ports?.[0]?.postMessage({ success: false, error: String(err) });
      });
    return;
  }

  if (type === 'CANCEL') {
    deleteNotification(payload.id)
      .then(() => {
        console.log('[SW-LocalNotif] Canceled:', payload.id);
        event.ports?.[0]?.postMessage({ success: true });
      })
      .catch((err) => {
        event.ports?.[0]?.postMessage({ success: false, error: String(err) });
      });
    return;
  }

  if (type === 'CANCEL_ALL') {
    clearAllNotifications()
      .then(() => {
        console.log('[SW-LocalNotif] Cleared all');
        event.ports?.[0]?.postMessage({ success: true });
      })
      .catch((err) => {
        event.ports?.[0]?.postMessage({ success: false, error: String(err) });
      });
    return;
  }

  if (type === 'CHECK_NOW') {
    checkAndFireDue()
      .then(() => event.ports?.[0]?.postMessage({ success: true }))
      .catch((err) => event.ports?.[0]?.postMessage({ success: false, error: String(err) }));
    return;
  }
});

// ─── Notification click handler ───────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const deepLink = data.deepLink || data.deep_link || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'LOCAL_NOTIF_TAP', payload: data });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(deepLink);
      }
    })
  );
});

// ─── Periodic alarm via setInterval (fires while SW is alive) ─────────────────

setInterval(() => {
  checkAndFireDue().catch((err) =>
    console.warn('[SW-LocalNotif] Alarm check failed:', err)
  );
}, ALARM_INTERVAL_MS);
