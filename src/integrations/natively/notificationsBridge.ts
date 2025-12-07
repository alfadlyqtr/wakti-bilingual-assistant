import { toast } from 'sonner';

declare global {
  interface Window {
    NativelyNotifications?: any;
  }
}

// Debug flag - set to true to see toast notifications for debugging
const DEBUG_NOTIFICATIONS = true;

function getInstance(): any | null {
  try {
    if (typeof window === 'undefined') {
      console.log('[NativelyNotifications] Window undefined - not in browser');
      return null;
    }
    const Ctor = (window as any).NativelyNotifications;
    if (!Ctor) {
      console.log('[NativelyNotifications] NativelyNotifications class not found on window - not in Natively app');
      return null;
    }
    console.log('[NativelyNotifications] SDK found, creating instance');
    return new Ctor();
  } catch (err) {
    console.error('[NativelyNotifications] Error creating instance:', err);
    return null;
  }
}

/**
 * Set the OneSignal External ID to link this device to a specific user.
 * This allows targeting specific users with push notifications.
 * @param userId The database UUID of the user
 */
export function setNotificationUser(userId: string) {
  console.log('[NativelyNotifications] setNotificationUser called with userId:', userId);
  
  if (DEBUG_NOTIFICATIONS) {
    toast.info(`🔔 Setting push user: ${userId.slice(0, 8)}...`);
  }
  
  const n = getInstance();
  if (!n) {
    console.warn('[NativelyNotifications] Cannot set user - SDK not available');
    if (DEBUG_NOTIFICATIONS) {
      toast.error('❌ Push SDK not available');
    }
    return;
  }
  if (!userId) {
    console.warn('[NativelyNotifications] Cannot set user - no userId provided');
    return;
  }

  try {
    console.log('[NativelyNotifications] Calling setExternalId with:', userId);
    // Natively SDK docs: notifications.setExternalId({ externalId: '...' }, callback)
    n.setExternalId({ externalId: userId }, (resp: any) => {
      console.log('[NativelyNotifications] setExternalId response:', JSON.stringify(resp));
      if (resp && resp.externalId) {
        console.log('[NativelyNotifications] ✅ External ID set successfully:', resp.externalId);
        if (DEBUG_NOTIFICATIONS) {
          toast.success(`✅ Push linked: ${resp.externalId.slice(0, 8)}...`);
        }
      } else {
        const errorMessage = (resp && (resp.error || resp.message)) || "Failed to set external ID";
        console.warn('[NativelyNotifications] ❌ Failed to set External ID:', errorMessage);
        if (DEBUG_NOTIFICATIONS) {
          toast.error(`❌ Push link failed: ${errorMessage}`);
        }
      }
    });
  } catch (err) {
    console.error('[NativelyNotifications] Error calling setExternalId:', err);
    if (DEBUG_NOTIFICATIONS) {
      toast.error(`❌ Push error: ${err}`);
    }
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
