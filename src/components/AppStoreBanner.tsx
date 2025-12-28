import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

// App Store URL
const APP_STORE_URL = 'https://apps.apple.com/us/app/wakti-ai/id6755150700';

// Detect platform based on user agent only (not Natively SDK)
function getPlatform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  
  // iOS detection (based on user agent, not Natively SDK)
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
    return 'ios';
  }
  
  // Android detection
  if (/android/i.test(ua)) {
    return 'android';
  }
  
  // Everything else is desktop
  return 'desktop';
}

// Check if running inside native app wrapper (Natively)
function isInNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    // Use Natively SDK's official browserInfo() method
    // This is the correct way to detect if we're inside the native app
    const NativelyInfo = (window as any).NativelyInfo;
    if (NativelyInfo) {
      const info = new NativelyInfo();
      const browserInfo = info.browserInfo();
      if (browserInfo && browserInfo.isNativeApp) {
        console.log('[AppStoreBanner] Detected Natively native app via browserInfo()');
        return true;
      }
    }
  } catch (err) {
    console.log('[AppStoreBanner] NativelyInfo check failed:', err);
  }

  // Fallback: the Natively wrapper typically injects these SDK globals only inside the native app
  if ((window as any).NativelyPurchases || (window as any).NativelyNotifications) {
    console.log('[AppStoreBanner] Detected Natively native app via native SDK globals');
    return true;
  }
  
  // Check for standalone PWA mode (home screen app)
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  
  // Check iOS standalone (added to home screen)
  if ((navigator as any).standalone === true) return true;
  
  return false;
}

interface AppStoreBannerProps {
  /** Position of the banner */
  position?: 'top' | 'bottom';
  /** Allow user to dismiss the banner */
  dismissible?: boolean;
}

export function AppStoreBanner({ 
  position = 'bottom',
  dismissible = true 
}: AppStoreBannerProps) {
  console.log('[AppStoreBanner] Component rendering...');
  
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | null>(null);
  const [isNative, setIsNative] = useState<boolean | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const detectedPlatform = getPlatform();
    const detectedNative = isInNativeApp();
    
    console.log('[AppStoreBanner] Platform:', detectedPlatform, 'isNative:', detectedNative);
    
    setPlatform(detectedPlatform);
    setIsNative(detectedNative);
    
    // Check if user previously dismissed
    const dismissed = sessionStorage.getItem('app-store-banner-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('app-store-banner-dismissed', 'true');
  };

  // Wait for detection to complete
  if (platform === null || isNative === null) {
    return null;
  }

  // Don't show if:
  // - Running inside native app (Natively wrapper)
  // - iOS device (Safari shows Apple's Smart App Banner instead)
  // - User dismissed it
  if (isNative || platform === 'ios' || isDismissed) {
    return null;
  }

  const positionClasses = position === 'top' 
    ? 'top-0' 
    : 'bottom-0';

  return (
    <div 
      className={`fixed left-0 right-0 ${positionClasses} z-[9999] bg-background/95 backdrop-blur-md border-t border-border/50 shadow-lg`}
      style={{ paddingBottom: position === 'bottom' ? 'env(safe-area-inset-bottom, 0px)' : undefined }}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-4">
          {/* App Store Badge - Show on Desktop only (iOS uses Apple's Smart App Banner) */}
          {platform === 'desktop' && (
            <a 
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 transition-transform hover:scale-105 active:scale-95"
            >
              <img 
                src="/lovable-uploads/apple download.png" 
                alt="Download on the App Store"
                className="h-10 w-auto rounded-lg object-contain"
                style={{ 
                  backgroundColor: 'transparent',
                  maxWidth: '135px'
                }}
              />
            </a>
          )}

          {/* Google Play Badge - Show on Android and Desktop (disabled/coming soon) */}
          {(platform === 'android' || platform === 'desktop') && (
            <div className="flex-shrink-0 relative group">
              <img 
                src="/lovable-uploads/google download.png" 
                alt="Get it on Google Play"
                className="h-10 w-auto rounded-lg object-contain opacity-50 cursor-not-allowed"
                style={{ 
                  backgroundColor: 'transparent',
                  maxWidth: '135px',
                  filter: 'grayscale(30%)'
                }}
              />
              {/* Coming soon tooltip */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Coming soon
              </div>
            </div>
          )}

          {/* Dismiss button */}
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1.5 rounded-full hover:bg-muted transition-colors ml-2"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
