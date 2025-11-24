declare global {
  interface Window {
    NativelyNotifications?: any;
  }
}

function getInstance(): any | null {
  try {
    if (typeof window === 'undefined') return null;
    const Ctor = (window as any).NativelyNotifications;
    if (!Ctor) return null;
    return new Ctor();
  } catch {
    return null;
  }
}

/**
 * Set the OneSignal External ID to link this device to a specific user.
 * This allows targeting specific users with push notifications.
 * @param userId The database UUID of the user
 */
export function setNotificationUser(userId: string) {
  const n = getInstance();
  if (!n || !userId) return;

  try {
    // Natively SDK docs: notifications.setExternalId({ externalId: '...' }, callback)
    n.setExternalId({ externalId: userId }, (resp: any) => {
      if (resp && resp.externalId) {
        console.log('Natively: OneSignal External ID set successfully:', resp.externalId);
      } else {
        const errorMessage = (resp && (resp.error || resp.message)) || "Failed to set external ID";
        console.warn('Natively: Failed to set OneSignal External ID:', errorMessage);
      }
    });
  } catch (err) {
    console.warn('Natively: Error calling setExternalId', err);
  }
}

/**
 * Remove the OneSignal External ID (e.g. on logout).
 */
export function removeNotificationUser() {
  const n = getInstance();
  if (!n) return;

  try {
    n.removeExternalId((resp: any) => {
      if (resp && (resp.error || resp.message)) {
        console.warn('Natively: Failed to remove OneSignal External ID:', resp.error || resp.message);
      } else {
        console.log('Natively: OneSignal External ID removed successfully');
      }
    });
  } catch (err) {
    console.warn('Natively: Error calling removeExternalId', err);
  }
}

/**
 * Request push notification permissions from the user.
 * @param fallbackToSettings If true, shows an alert to open settings if permission was previously denied
 */
export function requestNotificationPermission(fallbackToSettings = false) {
  const n = getInstance();
  if (!n) return;

  try {
    n.requestPermission(fallbackToSettings, (resp: any) => {
      console.log('Natively: Push permission request status:', resp?.status);
    });
  } catch (err) {
    console.warn('Natively: Error requesting push permission', err);
  }
}

/**
 * Get the current OneSignal Player ID (Subscription ID).
 */
export function getOneSignalId(callback?: (playerId: string | null) => void) {
  const n = getInstance();
  if (!n) {
    if (callback) callback(null);
    return;
  }

  try {
    n.getOneSignalId((resp: any) => {
      console.log('Natively: OneSignal Player ID:', resp?.playerId);
      if (callback) callback(resp?.playerId || null);
    });
  } catch (err) {
    console.warn('Natively: Error getting OneSignal ID', err);
    if (callback) callback(null);
  }
}
