/**
 * Natively Widget Bridge
 * Provides integration with iOS/Android home screen widgets via Natively SDK
 */

declare global {
  interface Window {
    NativelyWidget?: any;
  }
}

export interface WidgetData {
  type: 'qr_code' | 'business_card';
  title: string;
  subtitle?: string;
  imageUrl?: string;
  qrValue?: string;
  deepLink?: string;
}

export interface SetWidgetResult {
  status: 'SUCCESS' | 'FAILED';
  error?: string;
}

function getInstance(): any | null {
  try {
    if (typeof window === 'undefined') return null;
    const Ctor = (window as any).NativelyWidget;
    if (!Ctor) return null;
    return new Ctor();
  } catch {
    return null;
  }
}

/**
 * Check if Natively Widget SDK is available (running in native app)
 */
export function isWidgetSupported(): boolean {
  return getInstance() !== null;
}

/**
 * Set widget data for the home screen widget
 * This configures what the iOS/Android widget will display
 */
export function setWidgetData(
  data: WidgetData,
  callback?: (result: SetWidgetResult) => void
): void {
  const widget = getInstance();
  
  if (!widget) {
    console.warn('[NativelyWidget] SDK not available - not running in native app');
    callback?.({ status: 'FAILED', error: 'Widget SDK not available. Please use the Wakti app.' });
    return;
  }

  try {
    // Natively SDK setWidgetData method
    const setData = widget.setWidgetData || widget.setData || widget.updateWidget;
    
    if (typeof setData !== 'function') {
      console.warn('[NativelyWidget] setWidgetData method not available');
      callback?.({ status: 'FAILED', error: 'Widget feature not available in this app version.' });
      return;
    }

    // Format data for Natively SDK
    const widgetPayload = {
      type: data.type,
      title: data.title,
      subtitle: data.subtitle || '',
      imageUrl: data.imageUrl || '',
      qrValue: data.qrValue || '',
      deepLink: data.deepLink || '',
    };

    setData.call(widget, widgetPayload, (response: any) => {
      if (response?.status === 'SUCCESS' || response?.success) {
        callback?.({ status: 'SUCCESS' });
      } else {
        callback?.({ 
          status: 'FAILED', 
          error: response?.error || response?.message || 'Failed to set widget data' 
        });
      }
    });
  } catch (err) {
    console.error('[NativelyWidget] Error setting widget data:', err);
    callback?.({ status: 'FAILED', error: String(err) });
  }
}

/**
 * Open the system widget configuration screen
 * This prompts the user to add the Wakti widget to their home screen
 */
export function openWidgetSettings(callback?: (result: SetWidgetResult) => void): void {
  const widget = getInstance();
  
  if (!widget) {
    console.warn('[NativelyWidget] SDK not available');
    callback?.({ status: 'FAILED', error: 'Widget SDK not available. Please use the Wakti app.' });
    return;
  }

  try {
    const openSettings = widget.openWidgetSettings || widget.openSettings || widget.showWidgetPicker;
    
    if (typeof openSettings !== 'function') {
      // Fallback: just show instructions
      callback?.({ status: 'FAILED', error: 'Please add the Wakti widget from your home screen settings.' });
      return;
    }

    openSettings.call(widget, (response: any) => {
      if (response?.status === 'SUCCESS' || response?.success) {
        callback?.({ status: 'SUCCESS' });
      } else {
        callback?.({ 
          status: 'FAILED', 
          error: response?.error || 'Could not open widget settings' 
        });
      }
    });
  } catch (err) {
    console.error('[NativelyWidget] Error opening widget settings:', err);
    callback?.({ status: 'FAILED', error: String(err) });
  }
}

/**
 * Set QR code widget specifically for business card sharing
 */
export function setBusinessCardWidget(
  cardData: {
    firstName: string;
    lastName: string;
    company?: string;
    cardUrl: string;
  },
  callback?: (result: SetWidgetResult) => void
): void {
  const widgetData: WidgetData = {
    type: 'qr_code',
    title: `${cardData.firstName} ${cardData.lastName}`,
    subtitle: cardData.company || 'Business Card',
    qrValue: cardData.cardUrl,
    deepLink: cardData.cardUrl,
  };

  setWidgetData(widgetData, callback);
}
