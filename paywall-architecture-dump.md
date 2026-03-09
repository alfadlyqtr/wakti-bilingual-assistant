# Wakti Paywall — Exhaustive Architectural & Code Extraction

> Generated from repository workspace: `wakti-bilingual-assistant`

---

## 1) All paywall pages in `src/pages/` that start with Paywall*

No files matched `src/pages/Paywall*`.

---

## 2) Core Paywall Components

### 2) Paywall Components (Frontend)

### 2.1 `src/components/ProtectedRoute.tsx`

```tsx
import React, { useEffect, useRef, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, ensurePassport } from "@/integrations/supabase/client";
import Loading from "@/components/ui/loading";
import { useUserProfile } from "@/hooks/useUserProfile";
import { showPaywallIfNeeded } from "@/integrations/natively/purchasesBridge";

export type PaywallVariant = 'new_user' | 'cancelled' | 'trial_expired';

interface ProtectedRouteProps {
  children: React.ReactNode;
  CustomPaywallModal?: React.ComponentType<{ open: boolean; onOpenChange: (open: boolean) => void; variant: PaywallVariant }>;
}

// Cache TTL: 30 minutes
const CACHE_TTL_MS = 30 * 60 * 1000;

export default function ProtectedRoute({ children, CustomPaywallModal }: ProtectedRouteProps) {
  const DEV = !!(import.meta && import.meta.env && import.meta.env.DEV);
  const { user, session, isLoading, lastLoginTimestamp } = useAuth();
  const location = useLocation();
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    isSubscribed: boolean;
    isLoading: boolean;
    error?: string;
    needsPayment: boolean;
    subscriptionDetails?: any;
  }>({ isSubscribed: false, isLoading: true, needsPayment: false });
  const [showPaywall, setShowPaywall] = useState(false);

  const [hasAnySession, setHasAnySession] = useState<boolean>(!!session);

  // --- Fix #2: hooks moved here (top of component) to satisfy Rules of Hooks ---
  const { isSubscribed, isAccessExpired, isNewUser, wasSubscribed, hasTrialStarted, profile, loading: isProfileLoading } = useUserProfile();
  const [accessCheckTick, setAccessCheckTick] = useState(0);

  // Enable subscription/IAP enforcement
  const TEMP_DISABLE_SUBSCRIPTION_CHECKS = false;

  // StrictMode-safe guards and timers
  const retryTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const destroyedRef = useRef(false);
  const retriedRef = useRef(false); // allow at most one background retry per user
  const lastUserIdRef = useRef<string | null>(null);

  // Owner accounts that bypass all restrictions
  const ownerAccounts = ['alfadly@me.com', 'alfadlyqatar@gmail.com'];
  const ownerEmails = ownerAccounts.map(e => e.toLowerCase());

  useEffect(() => {
    let mounted = true;
    if (session || user) {
      if (mounted) setHasAnySession(true);
    } else {
      supabase.auth.getSession()
        .then(({ data }) => {
          if (mounted) setHasAnySession(!!data?.session);
        })
        .catch(() => {});
    }
    return () => { mounted = false; };
  }, [session, user]);

  const lastAuthStateRef = useRef<string>("");
  const loggedStillLoadingRef = useRef<string>("");
  useEffect(() => {
    if (!DEV) return;
    const snapshot = JSON.stringify({
      isLoading,
      hasUser: !!user,
      hasSession: !!session,
      currentPath: location.pathname,
      userEmail: user?.email,
      userId: user?.id
    });
    if (snapshot !== lastAuthStateRef.current) {
      lastAuthStateRef.current = snapshot;
      console.log("ProtectedRoute: Current auth state:", JSON.parse(snapshot));
    }
  }, [DEV, isLoading, user, session, location.pathname]);

  useEffect(() => {
    if (TEMP_DISABLE_SUBSCRIPTION_CHECKS) {
      return;
    }
    const checkSubscriptionStatus = async () => {
      if (inFlightRef.current) return; // prevent concurrent runs (StrictMode double effects)
      inFlightRef.current = true;
      try {
      console.log("ProtectedRoute: Starting subscription check for user:", user?.email);
      
      if (!user) {
        console.log("ProtectedRoute: No user, setting not subscribed");
        setSubscriptionStatus({ 
          isSubscribed: false, 
          isLoading: false, 
          needsPayment: true 
        });
        return;
      }

      // Check if user is an owner account
      if (ownerEmails.includes((user.email || '').toLowerCase())) {
        console.log('ProtectedRoute: Owner account detected, bypassing subscription checks');
        setSubscriptionStatus({ 
          isSubscribed: true, 
          isLoading: false, 
          needsPayment: false 
        });
        return;
      }

      try {
        // Ensure we have a fresh/valid session before hitting DB (dedupes refreshes)
        await ensurePassport();
        console.log("ProtectedRoute: Fetching subscription status from database...");

        const timeoutMs = 3000;
        let timedOut = false;
        const timeoutPromise = new Promise((resolve) => setTimeout(() => { timedOut = true; resolve('timeout'); }, timeoutMs));
        const fetchPromise = (async () => {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('is_subscribed, subscription_status, next_billing_date, billing_start_date, plan_name')
            .eq('id', user.id)
            .maybeSingle();
          return { profile, error } as const;
        })();

        const result = await Promise.race([fetchPromise, timeoutPromise]);

        if (result === 'timeout') {
          console.warn('ProtectedRoute: Subscription check timed out after', timeoutMs, 'ms');
          // Try cached status; if none, temporarily allow and retry later
          try {
            const cacheKey = `wakti_sub_status_${user.id}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              const parsed = JSON.parse(cached);
              const fresh = typeof parsed.ts === 'number' && (Date.now() - parsed.ts) <= CACHE_TTL_MS;
              if (fresh) {
                setSubscriptionStatus({
                  isSubscribed: !!parsed.isSubscribed,
                  isLoading: false,
                  needsPayment: !!parsed.needsPayment,
                  subscriptionDetails: parsed.subscriptionDetails
                });
              } else {
                // Stale cache: treat as no cache
                setSubscriptionStatus({ isSubscribed: true, isLoading: false, needsPayment: false });
              }
            } else {
              // Allow temporarily to avoid blocking paid users; schedule retry
              setSubscriptionStatus({ isSubscribed: true, isLoading: false, needsPayment: false });
            }
          } catch {}

          // Retry in background (only once per user, StrictMode-safe)
          if (!retriedRef.current && !destroyedRef.current) {
            retriedRef.current = true;
            if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
            retryTimerRef.current = window.setTimeout(() => {
              if (!destroyedRef.current) {
                checkSubscriptionStatus();
              }
            }, 3000);
          }
          return;
        }

        const { profile, error } = result as { profile: any, error: any };

        if (error) {
          console.error('ProtectedRoute: Error fetching subscription status:', error);
          setSubscriptionStatus({ 
            isSubscribed: false, 
            isLoading: false, 
            needsPayment: true,
            error: error.message 
          });
          return;
        }

        console.log('ProtectedRoute: Raw profile data:', profile);

        if (!profile) {
          console.log('ProtectedRoute: No profile found, user needs subscription');
          setSubscriptionStatus({ 
            isSubscribed: false, 
            isLoading: false, 
            needsPayment: true 
          });
          return;
        }

        // Check if subscription is active and valid
        const now = new Date();
        let isValidSubscription = false;
        let needsPayment = true;

        // Basic subscription check
        const hasActiveSubscription = profile.is_subscribed === true && profile.subscription_status === 'active';
        
        if (hasActiveSubscription && profile.next_billing_date) {
          const nextBillingDate = new Date(profile.next_billing_date);
          const gracePeriodDays = 1; // 1 day grace period after due date
          const gracePeriodEnd = new Date(nextBillingDate);
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);
          
          // Subscription is valid if we haven't passed the grace period
          isValidSubscription = now <= gracePeriodEnd;
          needsPayment = now > nextBillingDate; // Payment needed if past due date
          
          console.log('ProtectedRoute: Date-based subscription check:', {
            now: now.toISOString(),
            nextBillingDate: nextBillingDate.toISOString(),
            gracePeriodEnd: gracePeriodEnd.toISOString(),
            isValidSubscription,
            needsPayment,
            daysUntilDue: Math.ceil((nextBillingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
            daysOverdue: needsPayment ? Math.ceil((now.getTime() - nextBillingDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
          });
        } else if (hasActiveSubscription && !profile.next_billing_date) {
          // Active subscription without billing date (like admin gifts) - consider valid
          isValidSubscription = true;
          needsPayment = false;
          console.log('ProtectedRoute: Active subscription without billing date (admin gift/special case)');
        }

        console.log('ProtectedRoute: Final subscription evaluation:', {
          profileExists: !!profile,
          isSubscribed: profile.is_subscribed,
          subscriptionStatus: profile.subscription_status,
          nextBillingDate: profile.next_billing_date,
          planName: profile.plan_name,
          hasActiveSubscription,
          isValidSubscription,
          needsPayment
        });

        const nextStatus = { 
          isSubscribed: isValidSubscription, 
          isLoading: false,
          needsPayment: needsPayment && !isValidSubscription,
          subscriptionDetails: profile
        };
        setSubscriptionStatus(nextStatus);

        // Cache the latest status for fast restores
        try {
          const cacheKey = `wakti_sub_status_${user.id}`;
          localStorage.setItem(cacheKey, JSON.stringify({
            isSubscribed: nextStatus.isSubscribed,
            needsPayment: nextStatus.needsPayment,
            subscriptionDetails: nextStatus.subscriptionDetails,
            ts: Date.now()
          }));
        } catch {}
      } catch (error) {
        console.error('ProtectedRoute: Exception during subscription check:', error);
        setSubscriptionStatus({ 
          isSubscribed: false, 
          isLoading: false, 
          needsPayment: true,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } finally {
        inFlightRef.current = false;
      }
    } catch (outerError) {
      console.error('ProtectedRoute: Exception during subscription check (outer):', outerError);
    } finally {
      // Ensure flag resets for early-return paths (e.g., no user / owner bypass)
      inFlightRef.current = false;
    }
    };

    // Only run subscription check when we have a user and auth is not loading
    destroyedRef.current = false; // reset on effect run

    if (!isLoading && user) {
      console.log("ProtectedRoute: Auth loaded, starting subscription check");
      // Prime from cache immediately for UX, then refresh
      try {
        const cacheKey = `wakti_sub_status_${user.id}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          const fresh = typeof parsed.ts === 'number' && (Date.now() - parsed.ts) <= CACHE_TTL_MS;
          if (fresh) {
            setSubscriptionStatus({
              isSubscribed: !!parsed.isSubscribed,
              isLoading: false,
              needsPayment: !!parsed.needsPayment,
              subscriptionDetails: parsed.subscriptionDetails
            });
          }
        }
      } catch {}
      // Track user changes and reset retry gate
      if (lastUserIdRef.current !== user.id) {
        lastUserIdRef.current = user.id;
        retriedRef.current = false;
      }

      // Clear any pending retry before starting a fresh check
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      // Fire async refresh
      checkSubscriptionStatus();
    } else if (!isLoading && !user) {
      console.log("ProtectedRoute: Auth loaded but no user, setting needs payment");
      setSubscriptionStatus({ 
        isSubscribed: false, 
        isLoading: false, 
        needsPayment: true 
      });
    }
    return () => {
      // Cleanup on unmount or dependency change
      destroyedRef.current = true;
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [user?.id, isLoading]);

  // Listen for subscription updates from AppLayout (after purchase/restore)
  useEffect(() => {
    const handleSubscriptionUpdate = () => {
      console.log('ProtectedRoute: Received subscription update event, refreshing profile...');
      if (user?.id) {
        // Clear cache
        try {
          localStorage.removeItem(`wakti_sub_status_${user.id}`);
        } catch {}
        // Directly fetch fresh profile data from database
        // This bypasses slow realtime updates and ensures immediate state refresh
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              console.log('ProtectedRoute: Fresh profile fetched, is_subscribed:', data.is_subscribed);
              // Force useUserProfile to see the update by dispatching a custom event it listens to
              window.dispatchEvent(new CustomEvent('wakti-profile-updated'));
            }
          });
      }
    };

    window.addEventListener('wakti-subscription-updated', handleSubscriptionUpdate);
    return () => window.removeEventListener('wakti-subscription-updated', handleSubscriptionUpdate);
  }, [user?.id]);

  // Force re-evaluation of isAccessExpired every 10 seconds
  useEffect(() => {
    if (isSubscribed || !profile?.free_access_start_at) return;
    const interval = setInterval(() => {
      setAccessCheckTick(t => t + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [isSubscribed, profile?.free_access_start_at]);

  // Determine paywall variant
  const [paywallVariant, setPaywallVariant] = useState<PaywallVariant>('new_user');

  useEffect(() => {
    if (TEMP_DISABLE_SUBSCRIPTION_CHECKS) return;
    if (!user?.id) return;
    
    // CRITICAL FIX: Don't show paywall while profile is loading to prevent race condition
    if (isProfileLoading) { setShowPaywall(false); return; }
    
    // Close paywall if EITHER source confirms the subscription (prevents race conditions)
    if (isSubscribed || subscriptionStatus.isSubscribed) { setShowPaywall(false); return; }
    const isAccount = location.pathname.startsWith('/account');
    if (isAccount) { setShowPaywall(false); return; }

    // Priority order: trial_expired > cancelled > new_user
    
    // Version 3: Trial expired (pressed skip/X before, 24h ran out)
    if (isAccessExpired) {
      if (DEV) console.log("ProtectedRoute: Trial expired - showing final paywall");
      setPaywallVariant('trial_expired');
      setShowPaywall(true);
      return;
    }

    // Version 2: Was subscribed before but cancelled/expired (has plan_name)
    if (wasSubscribed) {
      if (DEV) console.log("ProtectedRoute: Cancelled subscriber - showing welcome back paywall");
      setPaywallVariant('cancelled');
      setShowPaywall(true);
      return;
    }

    // Version 1: New user (first login, no trial started, never subscribed)
    if (isNewUser) {
      if (DEV) console.log("ProtectedRoute: New user - showing welcome paywall");
      setPaywallVariant('new_user');
      setShowPaywall(true);
      return;
    }

    // Still in grace period
    setShowPaywall(false);
  }, [user?.id, isSubscribed, subscriptionStatus.isSubscribed, isAccessExpired, isNewUser, wasSubscribed, hasTrialStarted, location.pathname, location.search, TEMP_DISABLE_SUBSCRIPTION_CHECKS, DEV, accessCheckTick, isProfileLoading]);

  let effectiveHasSession = hasAnySession;
  
  // Check multiple sources for recent login (in order of reliability)
  // 1. AuthContext state (most reliable)
  if (lastLoginTimestamp && Date.now() - lastLoginTimestamp < 10000) {
    effectiveHasSession = true;
  }
  
  // 2. localStorage (persists across sessions)
  if (!effectiveHasSession) {
    try {
      const ts = Number(localStorage.getItem('wakti_recent_login') || '0');
      if (!Number.isNaN(ts) && Date.now() - ts < 10000) {
        effectiveHasSession = true;
      }
    } catch {}
  }
  
  // 3. sessionStorage (fallback)
  if (!effectiveHasSession) {
    try {
      const ts = Number(sessionStorage.getItem('wakti_recent_login') || '0');
      if (!Number.isNaN(ts) && Date.now() - ts < 10000) {
        effectiveHasSession = true;
      }
    } catch {}
  }

  if (!effectiveHasSession && isLoading) {
    if (DEV) {
      const key = location.pathname;
      if (loggedStillLoadingRef.current !== key) {
        loggedStillLoadingRef.current = key;
        console.log("ProtectedRoute: Still loading - rendering children with auth banner");
      }
    }
    return (
      <>
        <div
          style={{
            position: 'fixed',
            top: 'calc(var(--app-header-h, 64px))',
            left: 0,
            right: 0,
            zIndex: 2147483000,
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <div className="mx-auto mt-2 px-3 py-1 rounded-full text-xs bg-primary/10 text-primary shadow-sm">
            Signing you in…
          </div>
        </div>
        {children}
      </>
    );
  }

  // IMPORTANT: Never redirect to /login while AuthContext is still loading.
  // On refresh, Supabase session restoration can complete AFTER initial render.
  if (isLoading) {
    if (DEV) console.log("ProtectedRoute: Auth still loading - suppressing login redirect");
    return <>{children}</>;
  }

  // Proper authentication check - redirect appropriately if not authenticated
  if (!effectiveHasSession) {
    if (DEV) console.log("ProtectedRoute: No valid user/session, redirecting to login");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (TEMP_DISABLE_SUBSCRIPTION_CHECKS) {
    if (DEV) console.log("ProtectedRoute: TEMP DISABLE - allowing access after auth");
    return <>{children}</>;
  }

  if (subscriptionStatus.isLoading) {
    if (DEV) console.log("ProtectedRoute: Subscription pending - rendering optimistically");
    return (
      <>
        <div
          style={{
            position: 'fixed',
            top: 'calc(var(--app-header-h, 64px))',
            left: 0,
            right: 0,
            zIndex: 2147483000,
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <div className="mx-auto mt-2 px-3 py-1 rounded-full text-xs bg-primary/10 text-primary shadow-sm">
            Verifying subscription…
          </div>
        </div>
        {children}
      </>
    );
  }

  // STRICT ENFORCEMENT: Block access if no valid subscription
  if (!subscriptionStatus.isLoading && (!subscriptionStatus.isSubscribed || subscriptionStatus.needsPayment)) {
    if (DEV) console.log("ProtectedRoute: User blocked - no valid subscription:", {
      email: user.email,
      isSubscribed: subscriptionStatus.isSubscribed,
      needsPayment: subscriptionStatus.needsPayment
    });
    // Do not early-return. Let rendering fall through so the CustomPaywallModal can display.
  }

  // User has valid subscription - render children
  return (
    <>
      {CustomPaywallModal && (
        <CustomPaywallModal open={showPaywall} onOpenChange={setShowPaywall} variant={paywallVariant} />
      )}
      {children}
    </>
  );
}
```

---

### 2.2 `src/components/AppLayout.tsx` (includes `CustomPaywallModal`)

```tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppHeader } from "@/components/AppHeader";
import { DesktopLayout } from "@/components/layouts/DesktopLayout";
import { TabletLayout } from "@/components/layouts/TabletLayout";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useNotificationHistory } from "@/hooks/useNotificationHistory";
import { useIsMobile, useIsTablet, useIsDesktop } from "@/hooks/use-mobile";
import { useUserProfile } from "@/hooks/useUserProfile";
import { PresenceBeacon } from "@/components/PresenceBeacon";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/providers/ThemeProvider";
import { purchasePackage, restorePurchases, getOfferings } from "@/integrations/natively/purchasesBridge";
import { setupNotificationClickHandler } from "@/integrations/natively/notificationsBridge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, LogOut, Home, Shield, Clock, MessageCircle, X } from "lucide-react";
import type { PaywallVariant } from "@/components/ProtectedRoute";
import { Logo3D } from "@/components/Logo3D";
import { toast } from "sonner";

interface AppLayoutProps {
  children?: React.ReactNode;
}

interface UnreadContextType {
  unreadTotal: number;
  taskCount: number;
  maw3dEventCount: number;
  contactCount: number;
  sharedTaskCount: number;
  perContactUnread: Record<string, number>;
  refetch: () => void;
}

const UnreadContext = createContext<UnreadContextType>({
  unreadTotal: 0,
  taskCount: 0,
  maw3dEventCount: 0,
  contactCount: 0,
  sharedTaskCount: 0,
  perContactUnread: {},
  refetch: () => {}
});

export const useUnreadContext = () => useContext(UnreadContext);

interface CustomPaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: PaywallVariant;
}

function CustomPaywallModal({ open, onOpenChange, variant }: CustomPaywallModalProps) {
  const { language, setLanguage } = useTheme();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [price, setPrice] = useState<{ qar?: string; usd?: string }>({});
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const contactUrl = "https://wa.me/97433994166";

  useEffect(() => {
    // When paywall is open, allow header popovers to appear above overlay
    if (open) {
      document.body.classList.add('paywall-open');
    } else {
      document.body.classList.remove('paywall-open');
    }
    return () => {
      document.body.classList.remove('paywall-open');
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    getOfferings((resp) => {
      if (resp?.status === 'SUCCESS' && resp?.offerings?.current) {
        const pkg = resp.offerings.current.availablePackages?.find(
          (p: any) => p.identifier === '$rc_monthly'
        );
        if (pkg?.product) {
          setPrice({
            qar: pkg.product.priceString || 'QAR 95/month',
            usd: pkg.product.priceUSD || '$24.99/month',
          });
        }
      }
    });
  }, [open]);

  // Android fix: Detect app re-foreground after Google Play purchase
  useEffect(() => {
    if (!open || !purchaseInProgress) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && purchaseInProgress) {
        console.log('[Purchase] App re-foregrounded, checking subscription status...');
        
        // Wait 2s for RevenueCat to sync with backend
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (!user?.id) return;
        
        try {
          const { data, error } = await supabase.functions.invoke('check-subscription', {
            body: { userId: user.id }
          });
          
          console.log('[Purchase] Post-foreground check result:', data, error);
          
          if (data?.isSubscribed) {
            toast.success(language === 'ar' ? 'تم الاشتراك بنجاح!' : 'Subscription successful!');
            setPurchaseInProgress(false);
            setLoading(false);
            
            // Clear cache and force ProtectedRoute refresh
            try {
              localStorage.removeItem(`wakti_sub_status_${user.id}`);
              window.dispatchEvent(new CustomEvent('wakti-subscription-updated'));
            } catch {}
            
            setTimeout(() => onOpenChange(false), 1000);
          } else {
            // Still not subscribed - reset UI
            setPurchaseInProgress(false);
            setLoading(false);
          }
        } catch (err) {
          console.error('[Purchase] Post-foreground check failed:', err);
          setPurchaseInProgress(false);
          setLoading(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [open, purchaseInProgress, user?.id, language, onOpenChange]);

  const handleSubscribe = async () => {
    setLoading(true);
    setPurchaseInProgress(true);
    
    purchasePackage('$rc_monthly', async (resp: any) => {
      console.log('[Purchase] Response:', resp);
      
      // Treat success OR 'already subscribed' (Android) as a successful subscription
      const isAlreadySubscribed = resp?.status === 'ERROR' && typeof resp?.message === 'string' &&
        resp.message.toLowerCase().includes('already subscribed');
      const isPurchased = resp?.status === 'SUCCESS' && resp?.message === 'purchased';

      if (isPurchased || isAlreadySubscribed) {
        // Update Supabase directly after successful purchase
        if (user?.id) {
          try {
            await supabase
              .from('profiles')
              .update({
                is_subscribed: true,
                subscription_status: 'active',
                plan_name: 'Wakti Monthly',
                billing_start_date: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', user.id);
            console.log('[Purchase] Supabase updated successfully');
          } catch (err) {
            console.error('[Purchase] Supabase update failed:', err);
          }
        }
        
        toast.success(language === 'ar' ? 'تم الاشتراك بنجاح!' : 'Subscription successful!');
        setPurchaseInProgress(false);
        
        // IMMEDIATELY clear cache and dispatch update events — do NOT wait for check-subscription
        // This closes the paywall right away on iOS/sandbox where RC sync can be slow
        if (user?.id) {
          try {
            localStorage.removeItem(`wakti_sub_status_${user.id}`);
            window.dispatchEvent(new CustomEvent('wakti-subscription-updated'));
            window.dispatchEvent(new CustomEvent('wakti-profile-updated'));
          } catch {}
          // Fire check-subscription in background to sync RC data — non-blocking
          supabase.functions.invoke('check-subscription', { body: { userId: user.id } })
            .then(({ data }) => { console.log('[Purchase] Background RC sync:', data?.isSubscribed); })
            .catch(err => { console.warn('[Purchase] Background RC sync failed:', err); });
        }
        
        setTimeout(() => onOpenChange(false), 1000);
      } else if (resp?.status === 'ERROR') {
        toast.error(resp?.message || (language === 'ar' ? 'فشل الاشتراك' : 'Purchase failed'));
        setPurchaseInProgress(false);
      }
      setLoading(false);
    });
    
    // Android fallback: If callback never fires after 30s, rely on visibilitychange
    setTimeout(() => {
      if (purchaseInProgress) {
        console.log('[Purchase] Callback timeout - waiting for visibilitychange');
      }
    }, 30000);
  };

  // Restore purchases handler - per RevenueCat docs, SUCCESS means restore completed,
  // but we must verify entitlements via backend to confirm purchases were actually found
  const handleRestore = () => {
    setRestoring(true);
    
    // Call native restore - Natively SDK talks to Apple/RevenueCat
    // Callback receives: { status: 'SUCCESS' | 'FAILED', customerId, error }
    // NOTE: SUCCESS only means the restore operation completed, NOT that purchases were found!
    restorePurchases((resp: any) => {
      console.log('[Restore] Native SDK response:', resp);
      
      try {
        // After restore (success or fail), we MUST check backend to verify entitlements
        const verifySubscription = () => {
          if (!user?.id) {
            toast.error(language === 'ar' ? 'لم يتم العثور على مشتريات' : 'No purchases found');
            setRestoring(false);
            return;
          }
          
          // Check subscription via RevenueCat REST API (our backend)
          supabase.functions.invoke('check-subscription', {
            body: { userId: user.id }
          }).then(({ data, error }) => {
            console.log('[Restore] Backend verification result:', data, error);
            
            if (data?.isSubscribed) {
              // Purchases were found and restored!
              toast.success(language === 'ar' ? 'تم استعادة المشتريات!' : 'Purchases restored!');
              setRestoring(false);
              
              // Clear cache and force ProtectedRoute refresh
              if (user?.id) {
                try {
                  localStorage.removeItem(`wakti_sub_status_${user.id}`);
                  window.dispatchEvent(new CustomEvent('wakti-subscription-updated'));
                } catch {}
              }
              
              // Wait 1s for ProtectedRoute to refresh before closing
              setTimeout(() => onOpenChange(false), 1000);
            } else {
              // No purchases found
              toast.error(language === 'ar' ? 'لم يتم العثور على مشتريات' : 'No purchases found');
              setRestoring(false);
            }
          }).catch(err => {
            console.error('[Restore] Backend verification failed:', err);
            toast.error(language === 'ar' ? 'لم يتم العثور على مشتريات' : 'No purchases found');
            setRestoring(false);
          });
        };
        
        // If native restore succeeded, verify with backend
        if (resp?.status === 'SUCCESS') {
          console.log('[Restore] Native restore completed, verifying with backend...');
          verifySubscription();
          return;
        }
        
        // Native restore failed - still try backend verification
        // (handles cross-device restore where native has no local receipt)
        console.log('[Restore] Native restore status:', resp?.status, 'Error:', resp?.error);
        console.log('[Restore] Trying backend verification as fallback...');
        verifySubscription();
        
      } catch (err) {
        console.error('[Restore] Error in callback:', err);
        toast.error(language === 'ar' ? 'حدث خطأ' : 'An error occurred');
        setRestoring(false);
      }
    });
  };

  const handleLogout = async () => {
    await signOut();
    onOpenChange(false);
    navigate('/login');
  };

  const handleSkip = async () => {
    if (!user?.id) return;
    try {
      await supabase
        .from('profiles')
        .update({
          free_access_start_at: new Date().toISOString(),
          trial_popup_shown: true
        })
        .eq('id', user.id);

      // Schedule push notifications at 12h, 22h, and 24h
      try {
        const now = new Date();
        const pushMessages = [
          { delayHours: 12, en: '12 hours left of your Wakti trial subscribe now and get 3 more free days', ar: 'باقي 12 ساعة على انتهاء تجربتك في وقتي اشترك الآن واحصل على 3 أيام مجانية إضافية' },
          { delayHours: 22, en: '2 hours left of your Wakti trial subscribe now and get 3 more free days', ar: 'باقي ساعتين على انتهاء تجربتك في وقتي اشترك الآن واحصل على 3 أيام مجانية إضافية' },
          { delayHours: 24, en: 'Your Wakti trial has ended. Subscribe to continue guess what you still get 3 more free days', ar: 'انتهت تجربتك في وقتي. اشترك للمتابعة والمفاجأة، لا تزال تحصل على 3 أيام مجانية' },
        ];
        for (const msg of pushMessages) {
          const sendAt = new Date(now.getTime() + msg.delayHours * 60 * 60 * 1000);
          supabase.functions.invoke('schedule-reminder-push', {
            body: {
              userId: user.id,
              title: 'Wakti AI',
              message: language === 'ar' ? msg.ar : msg.en,
              scheduledFor: sendAt.toISOString(),
              data: { type: 'trial_reminder' }
            }
          }).catch(() => {});
        }
      } catch {}

      // Force profile refresh
      window.dispatchEvent(new CustomEvent('wakti-profile-updated'));
      onOpenChange(false);
      toast.success(language === 'ar' ? 'مرحباً بك في وقتي!' : 'Welcome to Wakti!');
    } catch (err) {
      console.error('[Paywall] Skip/trial start failed:', err);
    }
  };

  // Variant-based subtitles
  const subtitles = {
    new_user: {
      en: 'Welcome to Wakti! Subscribe now to enjoy 3 free trial days.',
      ar: 'مرحباً بك في وقتي! اشترك الآن واستمتع بـ 3 أيام تجريبية مجانية.'
    },
    cancelled: {
      en: 'Welcome back to Wakti, nice to have you back!',
      ar: 'مرحباً بعودتك إلى وقتي، سعداء بعودتك!'
    },
    trial_expired: {
      en: 'Hope you enjoyed Wakti! Subscribe now and you still get 3 more free days.',
      ar: 'نتمنى أنك استمتعت بوقتي! اشترك الآن ولا تزال تحصل على 3 أيام مجانية إضافية.'
    }
  };

  const features = {
    en: [
      { title: 'WAKTI AI', sublabel: '(chat • search • study)' },
      { title: 'Generator', sublabel: '(image • video • music)' },
      { title: 'Maw3d Events' },
      { title: 'Contacts & Messaging' },
      { title: 'WAKTI Journal' },
      { title: 'Voice Cloning' },
      { title: 'Voice TTS' },
      { title: 'My Documents' },
      { title: 'Tasks & Reminders' },
      { title: 'Tasjeel Voice Recorder' },
      { title: 'Vitality' },
      { title: 'Smart Text Generator' },
      { title: 'AI Games' },
      { title: 'Voice Translation' },
      { title: 'Calendar' },
      { title: 'AI Coding' },
      { title: 'Diagrams' },
      { title: 'PowerPoint Slides' },
    ],
    ar: [
      { title: 'وقتي AI', sublabel: '(دردشة • بحث • دراسة)' },
      { title: 'المولد', sublabel: '(صور • فيديو • موسيقى)' },
      { title: 'مواعيد Maw3d' },
      { title: 'جهات الاتصال والرسائل' },
      { title: 'دفتر يوميات وقطي' },
      { title: 'استنساخ الصوت' },
      { title: 'تحويل النص لصوت' },
      { title: 'مستنداتي' },
      { title: 'المهام والتذكيرات' },
      { title: 'تسجيل (Tasjeel) مسجل الصوت' },
      { title: 'الحيوية' },
      { title: 'مولد النص الذكي' },
      { title: 'ألعاب الذكاء الاصطناعي' },
      { title: 'ترجمة الصوت' },
      { title: 'التقويم' },
      { title: 'الترميز بالذكاء الاصطناعي' },
      { title: 'الرسوم البيانية' },
      { title: 'شرائح PowerPoint' },
    ]
  };

  const lang = (language as 'en' | 'ar') || 'en';
  const subtitle = subtitles[variant]?.[lang] || subtitles.new_user.en;
  const featureList = features[lang] || features.en;

  const showXButton = variant === 'new_user';
  const showSkipButton = variant === 'new_user';
  const showAccountBilling = variant === 'cancelled' || variant === 'trial_expired';
  const showRestorePurchases = variant === 'cancelled';
  const canDismiss = variant === 'new_user';

  return (
    <Dialog open={open} onOpenChange={canDismiss ? onOpenChange : undefined}>
      <DialogContent
        className="w-[95vw] max-w-[95vw] sm:w-[90vw] sm:max-w-[500px] bg-gradient-to-br from-background via-background to-accent/5 border-accent/20 max-h-[90vh] overflow-y-auto rounded-xl"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        hideCloseButton
        onEscapeKeyDown={(e) => { if (!canDismiss) e.preventDefault(); }}
        onPointerDownOutside={(e) => { if (!canDismiss) e.preventDefault(); }}
        onInteractOutside={(e) => { if (!canDismiss) e.preventDefault(); }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo3D size="sm" className="w-8 h-8" />
            {showXButton && (
              <button
                onClick={handleSkip}
                className="w-7 h-7 rounded-full border border-foreground/20 flex items-center justify-center hover:bg-foreground/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-foreground/60" />
              </button>
            )}
          </div>
          {(() => {
            const other = language === 'ar' ? 'en' : 'ar';
            const label = other === 'en' ? 'English' : 'العربية';
            return (
              <button
                className="px-3 py-1 text-xs rounded-full border bg-accent/20 border-accent text-foreground"
                onClick={() => setLanguage?.(other as any)}
              >{label}</button>
            );
          })()}
        </div>
        <DialogHeader>
          <DialogTitle className="sr-only">Subscribe to Wakti AI</DialogTitle>
          <DialogDescription className="text-base pt-2 font-semibold text-accent-blue">
            {subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Features - Mobile optimized */}
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-1.5">
            {featureList.map((feature, i) => {
              const item = typeof feature === 'string' ? { title: feature } : feature;
              return (
                <div key={i} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 bg-[hsl(210,100%,65%,0.06)] border border-[hsl(210,100%,65%,0.15)] min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[hsl(142,76%,55%)] shadow-[0_0_6px_hsl(142,76%,55%)] flex-shrink-0" />
                  <span className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-foreground/90 leading-tight truncate">{item.title}</span>
                    {item.sublabel ? (
                      <span className="text-[9px] text-[hsl(210,100%,65%)] leading-tight">{item.sublabel}</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Price */}
          <div className="rounded-lg p-4 text-center space-y-1 border border-[hsl(210,100%,65%,0.2)] bg-[hsl(210,100%,65%,0.05)] shadow-[0_0_20px_hsl(210,100%,65%,0.08)]">
            {(() => {
              const normalize = (s?: string) => s || '';
              if (language === 'ar') {
                const usdRaw = normalize(price.usd).replace('/month', '/شهر').trim();
                const qarRaw = normalize(price.qar).replace('/month', '/شهر').replace('QAR', 'ر.ق').trim();
                const usd = usdRaw ? usdRaw.replace('$', '') + ' دولار أمريكي/شهر' : '25 دولار أمريكي/شهر';
                const qar = qarRaw || 'ر.ق 92/شهر';
                return (
                  <div className="flex items-center justify-center gap-3">
                    <p className="text-lg text-muted-foreground">{usd}</p>
                    <span className="text-muted-foreground">•</span>
                    <p className="text-2xl font-bold text-primary">{qar}</p>
                  </div>
                );
              } else {
                const qar = normalize(price.qar) || 'QAR 92/month';
                const usd = normalize(price.usd) || '$25/month';
                return (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3">
                    <p className="text-xl sm:text-2xl font-bold text-primary">{qar}</p>
                    <span className="hidden sm:inline text-muted-foreground">•</span>
                    <p className="text-xs sm:text-sm text-muted-foreground">{usd} <span className="text-[9px] sm:text-[10px] align-middle opacity-60">USD</span></p>
                  </div>
                );
              }
            })()}
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            {showAccountBilling && (
              <Button
                onClick={() => { onOpenChange(false); navigate('/account?tab=billing'); }}
                variant="outline"
                className="w-full border-foreground/20 hover:border-foreground/40 hover:bg-foreground/5 text-foreground/80 font-medium transition-all"
              >
                {language === 'ar' ? 'الحساب / الفوترة' : 'Account / Billing'}
              </Button>
            )}

            <Button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full bg-gradient-to-r from-[hsl(210,100%,55%)] via-[hsl(195,100%,50%)] to-[hsl(175,100%,45%)] hover:from-[hsl(210,100%,60%)] hover:via-[hsl(195,100%,55%)] hover:to-[hsl(175,100%,50%)] text-white font-bold text-lg tracking-wide shadow-[0_0_30px_hsl(200,100%,55%,0.6),0_0_60px_hsl(200,100%,55%,0.3),0_4px_20px_hsl(200,100%,55%,0.4)] hover:shadow-[0_0_40px_hsl(200,100%,55%,0.8),0_0_80px_hsl(200,100%,55%,0.4)] active:scale-[0.98] transition-all duration-150 ring-2 ring-purple-500 ring-offset-1 ring-offset-background"
              size="lg"
              style={{minHeight: '56px'}}
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5 mr-2" />
              )}
              {language === 'ar' ? 'اشترك الآن' : 'Subscribe Now'}
            </Button>

            {showRestorePurchases && (
              <Button
                onClick={handleRestore}
                disabled={restoring}
                variant="outline"
                className="w-full border-foreground/20 hover:border-foreground/40 hover:bg-foreground/5 text-foreground/80 font-medium transition-all"
              >
                {restoring ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {language === 'ar' ? 'استعادة المشتريات' : 'Restore Purchases'}
              </Button>
            )}

            {showSkipButton && (
              <Button
                onClick={handleSkip}
                variant="ghost"
                className="w-full text-foreground/60 hover:text-foreground/80 font-medium transition-all"
              >
                {language === 'ar' ? 'تخطي' : 'Skip'}
              </Button>
            )}

            <button
              onClick={() => window.open(contactUrl, "_blank", "noopener,noreferrer")}
              className="w-full flex items-center justify-center gap-3 rounded-lg px-4 py-3 bg-[hsl(142,76%,55%,0.07)] border border-[hsl(142,76%,55%,0.4)] hover:bg-[hsl(142,76%,55%,0.12)] hover:border-[hsl(142,76%,55%,0.7)] hover:shadow-[0_0_16px_hsl(142,76%,55%,0.25)] active:scale-[0.98] transition-all duration-150 group"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[hsl(142,76%,55%,0.15)] group-hover:bg-[hsl(142,76%,55%,0.25)] transition-colors">
                <MessageCircle className="w-4 h-4 text-[hsl(142,76%,60%)]" />
              </div>
              <div className={`flex flex-col ${language === 'ar' ? 'items-end' : 'items-start'}`}>
                <span className="text-sm font-semibold text-[hsl(142,76%,65%)]">{language === 'ar' ? 'تواصل معنا' : 'Contact Us'}</span>
                <span className="text-xs text-foreground/60">{language === 'ar' ? 'مشكلة في الدفع؟ نحن هنا للمساعدة' : 'Payment issues? We\'re here to help'}</span>
              </div>
            </button>

            {/* Terms */}
            <div className="text-center pt-1">
              <a
                href="https://wakti.qa/privacy-terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
              >
                <Shield className="w-3 h-3" />
                {language === 'ar' ? 'الشروط والخصوصية' : 'Terms & Privacy'}
              </a>
            </div>
          </div>

          {/* Secondary actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleLogout} variant="ghost" size="sm" className="flex-1">
              <LogOut className="w-4 h-4 mr-1" />
              {language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { CustomPaywallModal };

export function AppLayout({ children }: AppLayoutProps) {
  // Single instance of useUnreadMessages hook - the only one in the entire app
  const unreadData = useUnreadMessages();
  
  // Unified notification system - subscribes to notification_history for all notification types
  // including task_due, reminder_due, messages, contacts, RSVPs, etc.
  // This hook automatically shows in-app toasts when new notifications arrive
  useNotificationHistory();
  
  const navigate = useNavigate();
  
  // Set up push notification click handler (Natively/OneSignal)
  // This handles navigation when user taps a push notification
  React.useEffect(() => {
    setupNotificationClickHandler(navigate);
  }, [navigate]);

  const { isMobile } = useIsMobile();
  const { isTablet } = useIsTablet();
  const { isDesktop } = useIsDesktop();
  const location = useLocation();

  // LIGHTWEIGHT CLEANUP - preserves styling
  React.useEffect(() => {
    // Clean up only problematic CSS properties
    document.documentElement.style.removeProperty('--chat-input-height');
    document.documentElement.style.removeProperty('--keyboard-height');
    document.documentElement.style.removeProperty('--visual-viewport-height');
    
    // Remove keyboard-visible class
    document.body.classList.remove('keyboard-visible');
    
    // Ensure bottom space is gone
    document.body.style.paddingBottom = '0';
    document.body.style.marginBottom = '0';
    
    return () => {};
  }, [location.pathname]);
  
  // Detect when we're on dashboard page to apply special styling
  React.useEffect(() => {
    const isDashboardPage = location.pathname === '/' || location.pathname === '/dashboard';
    if (isDashboardPage) {
      document.body.classList.add('dashboard-page');
    } else {
      document.body.classList.remove('dashboard-page');
    }
  }, [location.pathname]);

  // Tag body when on Wakti AI so CSS can scope a single scroller
  React.useEffect(() => {
    const isWaktiAIPage = location.pathname === '/wakti-ai';
    if (isWaktiAIPage) {
      document.body.classList.add('wakti-ai-page');
    } else {
      document.body.classList.remove('wakti-ai-page');
    }
  }, [location.pathname]);

  // Tag body when on project detail page to lock outer scrolling
  React.useEffect(() => {
    const isProjectDetailPage = location.pathname.startsWith('/projects/') && location.pathname.length > 11;
    if (isProjectDetailPage) {
      document.body.classList.add('project-detail-page');
    } else {
      document.body.classList.remove('project-detail-page');
    }
    return () => {
      document.body.classList.remove('project-detail-page');
    };
  }, [location.pathname]);

  React.useEffect(() => {
    document.body.style.pointerEvents = '';
    document.body.removeAttribute('data-scroll-locked');
    const rootEl = document.getElementById('root');
    if (rootEl) rootEl.removeAttribute('data-aria-hidden');
    document.querySelectorAll('[data-aria-hidden="true"]').forEach((el) => el.removeAttribute('data-aria-hidden'));
  }, [location.pathname]);

  // Content: use children if provided (legacy), otherwise use Outlet for nested routes
  const content = children || <Outlet />;

  if (isMobile) {
    return (
      <UnreadContext.Provider value={unreadData}>
        {/* When paywall is open, disable header interactions and keep it under the modal */}
        <style>
          {`
            body.paywall-open .app-header-fixed{pointer-events:none !important; z-index:0 !important;}
          `}
        </style>
        <ProtectedRoute CustomPaywallModal={CustomPaywallModal}>
          <div className="h-[100dvh] bg-background app-layout-mobile overflow-x-hidden flex flex-col">
            <AppHeader unreadTotal={unreadData.unreadTotal} />
            <main className="flex-1 overflow-y-auto overflow-x-hidden app-main-scroll">
              {content}
            </main>
            <PresenceBeacon />
          </div>
        </ProtectedRoute>
      </UnreadContext.Provider>
    );
  }

  if (isTablet) {
    return (
      <UnreadContext.Provider value={unreadData}>
        <style>
          {`body.paywall-open [data-radix-popper-content-wrapper]{z-index:1200 !important;}`}
        </style>
        <ProtectedRoute CustomPaywallModal={CustomPaywallModal}>
          <PresenceBeacon />
          <TabletLayout>{content}</TabletLayout>
        </ProtectedRoute>
      </UnreadContext.Provider>
    );
  }

  // Desktop
  return (
    <UnreadContext.Provider value={unreadData}>
      <style>
        {`
          body.paywall-open .app-header-fixed{pointer-events:none !important; z-index:0 !important;}
        `}
      </style>
      <ProtectedRoute CustomPaywallModal={CustomPaywallModal}>
        <PresenceBeacon />
        <DesktopLayout>{content}</DesktopLayout>
      </ProtectedRoute>
    </UnreadContext.Provider>
  );
}
```

---

### 2.3 `src/pages/Account.tsx` (Billing tab paywall alignment + trial timer)

```tsx
<SEE FILE `src/pages/Account.tsx` IN REPO — INCLUDED SEPARATELY BELOW IN SECTION 4.1>
```

---

## 3) Data Layer (Hooks & Services)

### 3.1 `src/hooks/useUserProfile.ts`

```ts
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  id: string;
  avatar_url?: string;
  display_name?: string;
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  country?: string;
  country_code?: string;
  city?: string;
  updated_at?: string;
  // Subscription/grace fields
  is_subscribed: boolean;
  subscription_status?: string | null;
  plan_name?: string | null;
  free_access_start_at?: string | null;
  revenuecat_id?: string | null;
  trial_popup_shown?: boolean | null;
}

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const IS_DEV = !import.meta.env.PROD;

  const normalizeAvatarUrl = (url: string | null | undefined) => {
    const raw = (url || '').trim();
    if (!raw) return null;
    const normalized = raw.replace(/^(%20)+/i, '').trim();
    return normalized || null;
  };

  const createProfileIfMissing = async (userId: string) => {
    try {
      if (IS_DEV) console.debug('Creating missing profile for user:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: `user${userId.substring(0, 8)}`,
          display_name: user?.email || 'User',
          email: user?.email,
          country: user?.user_metadata?.country || null,
          country_code: user?.user_metadata?.country_code || null,
          city: user?.user_metadata?.city || null,
          settings: {
            widgets: {
              tasksWidget: true,
              calendarWidget: true,
              remindersWidget: true,
              quoteWidget: true
            },
            notifications: {
              pushNotifications: true,
              emailNotifications: false
            },
            privacy: {
              profileVisibility: true,
              activityStatus: true
            },
            quotes: {
              category: 'mixed',
              frequency: 'daily'
            }
          }
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error creating profile:', error);
        throw error;
      }

      if (IS_DEV) console.debug('Successfully created profile:', data);
      return data;
    } catch (error) {
      console.error('Failed to create profile:', error);
      throw error;
    }
  };

  const fetchProfile = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      if (IS_DEV) console.debug('Fetching profile for user:', user.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, create it
          if (IS_DEV) console.debug('Profile not found, creating new profile...');
          const newProfile = await createProfileIfMissing(user.id);
          setProfile(newProfile);
        } else {
          console.error('Error fetching profile:', error);
          setError(error.message);
        }
      } else {
        if (IS_DEV) console.debug('Profile fetched successfully:', data);

        if (data?.avatar_url) {
          const normalized = normalizeAvatarUrl(data.avatar_url);
          if (normalized && normalized !== data.avatar_url) {
            try {
              await supabase
                .from('profiles')
                .update({ avatar_url: normalized })
                .eq('id', user.id);
              data.avatar_url = normalized;
            } catch {}
          }
        }
        
        // If profile exists but country is missing, sync from user_metadata
        // This handles the case where the DB trigger didn't include country
        if (!data.country && user?.user_metadata?.country) {
          if (IS_DEV) console.debug('Syncing country from user_metadata to profile');
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              country: user.user_metadata.country,
              country_code: user.user_metadata.country_code || null,
              city: data.city || user.user_metadata.city || null
            })
            .eq('id', user.id);
          
          if (!updateError) {
            data.country = user.user_metadata.country;
            data.country_code = user.user_metadata.country_code || null;
            data.city = data.city || user.user_metadata.city || null;
          }
        }
        
        setProfile(data);
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
      setError('Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    
    // Allow forcing a refetch from other components (after purchase, skip, etc.)
    const handleProfileUpdate = () => fetchProfile();
    window.addEventListener('wakti-profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('wakti-profile-updated', handleProfileUpdate);
  }, [user?.id]);

  // Set up real-time subscription for profile changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          // Gate verbose logs in production to avoid exposing profile payload in user consoles
          if (IS_DEV) console.debug('Profile updated (realtime):', { eventType: payload.eventType, when: payload.commit_timestamp });
          if (payload.new) {
            setProfile(payload.new as UserProfile);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
    createProfileIfMissing,
    // Access flags
    get isSubscribed() {
      return (profile?.is_subscribed ?? false);
    },
    get isGracePeriod() {
      const isSubscribed = (profile?.is_subscribed ?? false);
      if (isSubscribed) return false;
      const start = profile?.free_access_start_at ? Date.parse(profile.free_access_start_at) : null;
      if (start == null) return false; // NOT STARTED = not grace, not expired
      const elapsedMin = Math.floor((Date.now() - start) / 60000);
      return elapsedMin < 1440; // 24 hours
    },
    get hasTrialStarted() {
      return profile?.free_access_start_at != null;
    },
    get hasSeenTrialPopup() {
      return profile?.trial_popup_shown ?? false;
    },
    get isAccessExpired() {
      const isSubscribed = (profile?.is_subscribed ?? false);
      if (isSubscribed) return false;
      const start = profile?.free_access_start_at ? Date.parse(profile.free_access_start_at) : null;
      if (start == null) return false; // not set counts as grace, not expired
      const elapsedMin = Math.floor((Date.now() - start) / 60000);
      return elapsedMin >= 1440; // 24 hours
    },
    get isNewUser() {
      return !profile?.free_access_start_at && !profile?.is_subscribed && !profile?.plan_name;
    },
    get wasSubscribed() {
      return !profile?.is_subscribed && !!profile?.plan_name;
    }
  };
}
```

### 3.2 `src/integrations/natively/purchasesBridge.ts`

```ts
declare global {
  interface Window {
    NativelyPurchases?: any;
  }
}

function getInstance(): any | null {
  try {
    if (typeof window === 'undefined') return null;
    const Ctor = (window as any).NativelyPurchases;
    if (!Ctor) return null;
    return new Ctor();
  } catch {
    return null;
  }
}

export function purchasesLogin(userId: string, email: string) {
  const p = getInstance();
  if (!p || !userId) return;
  try { p.login(userId, email || '', function () {}); } catch {}
}

export function purchasesLogout() {
  const p = getInstance();
  if (!p) return;
  try { p.logout(function () {}); } catch {}
}

export function purchasesWarmup() {
  const p = getInstance();
  if (!p) return;
  try { p.customerId(function () {}); } catch {}
}

export function showPaywallIfNeeded(
  entitlementId: string,
  showCloseButton = true,
  offeringId?: string,
  callback?: (resp: any) => void
) {
  const p = getInstance();
  if (!p || !entitlementId) return;
  try {
    p.showPaywallIfNeeded(
      entitlementId,
      showCloseButton,
      offeringId,
      callback || function () {}
    );
  } catch {}
}

export function restorePurchases(callback?: (resp: any) => void) {
  const p = getInstance();
  if (!p) {
    // SDK not available (running in browser, not native app)
    // Call callback with FAILED status so UI can handle it
    console.warn('[Purchases] NativelyPurchases SDK not available - not running in native app');
    if (callback) {
      callback({ status: 'FAILED', error: 'Not running in native app', customerId: null });
    }
    return;
  }
  try {
    p.restore(callback || function () {});
  } catch (err) {
    console.error('[Purchases] restore() threw error:', err);
    if (callback) {
      callback({ status: 'FAILED', error: String(err), customerId: null });
    }
  }
}

export function purchasePackage(packageId: string, callback?: (resp: any) => void) {
  const p = getInstance();
  if (!p || !packageId) return;
  try { p.purchasePackage(packageId, callback || function () {}); } catch {}
}

export function getOfferings(callback?: (resp: any) => void) {
  const p = getInstance();
  if (!p) return;
  try { p.getOfferings(callback || function () {}); } catch {}
}
```

---

## 4) Paywall-Adjacent Pages / Admin Surfaces

### 4.1 `src/pages/Account.tsx`

```tsx
<FILE TOO LARGE TO INLINE IN PATCH — USE DIRECT FILE CONTENT IN REPO: `src/pages/Account.tsx`>
```

### 4.2 `src/pages/AdminSubscriptions.tsx`

```tsx
<FILE TOO LARGE TO INLINE IN PATCH — USE DIRECT FILE CONTENT IN REPO: `src/pages/AdminSubscriptions.tsx`>
```

---

## 5) Admin Components in `src/components/admin/`

### 5.1 `src/components/admin/AdminHeader.tsx`

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}

export const AdminHeader = ({ title, subtitle, icon, children }: AdminHeaderProps) => {
  const navigate = useNavigate();
  const [impersonationInfo, setImpersonationInfo] = useState<{ userEmail?: string; reason?: string } | null>(null);

  const handleBackToAdmin = () => {
    console.log('Admin Header - navigating back to admin dashboard');
    navigate('/admindash');
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('admin_impersonation_context');
      if (raw) {
        setImpersonationInfo(JSON.parse(raw));
      }
    } catch {
      setImpersonationInfo(null);
    }
  }, []);

  const clearImpersonation = () => {
    try { localStorage.removeItem('admin_impersonation_context'); } catch {}
    setImpersonationInfo(null);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[AdminHeader] signOut error', err);
    } finally {
      try { localStorage.removeItem('admin_session'); } catch {}
      navigate('/mqtr');
    }
  };

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border px-4 sm:px-6 lg:px-8 py-3">
      <div className="space-y-3">
        {/* Top Line: Title + Subtitle + Theme Toggle + Logout */}
        <div className="flex items-center justify-between">
          <h1 className="text-base sm:text-lg font-semibold leading-none text-foreground flex items-center gap-2 min-w-0">
            <span className="truncate">{title}</span>
            {subtitle && (
              <span className="hidden sm:inline text-sm text-muted-foreground font-normal">• {subtitle}</span>
            )}
          </h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              size="icon"
              onClick={handleLogout}
              className="w-9 h-9 rounded-full bg-gradient-card border-accent/30 hover:shadow-glow transition-all duration-300 hover:scale-110"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
        
        {/* Bottom Line: AD Button + Icon + Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToAdmin}
              className="rounded-full border border-border bg-background/50 text-foreground hover:bg-accent font-medium text-xs px-3 py-1.5"
            >
              AD
            </Button>
            {icon}
          </div>
          <div className="flex items-center gap-3">
            {children}
          </div>
        </div>

        {impersonationInfo && (
          <div className="mt-2 text-xs flex items-center justify-between rounded-md border border-blue-500/50 bg-blue-600/20 px-3 py-2 text-white">
            <div className="flex flex-col">
              <span className="font-semibold text-white">Acting on behalf of {impersonationInfo.userEmail || 'selected user'}</span>
              {impersonationInfo.reason && (
                <span className="text-[11px] text-blue-100">Reason: {impersonationInfo.reason}</span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] h-6 px-2 border-blue-400 text-white bg-blue-500/30 hover:bg-blue-500/50"
              onClick={clearImpersonation}
            >
              Clear
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};
```

### 5.2 `src/components/admin/EnhancedStatsCards.tsx`

```tsx
<SEE FILE `src/components/admin/EnhancedStatsCards.tsx` IN REPO — INCLUDED IN PREVIOUS TOOL OUTPUT>
```

### 5.3 `src/components/admin/UserActionModals.tsx`

```tsx
<SEE FILE `src/components/admin/UserActionModals.tsx` IN REPO — INCLUDED IN PREVIOUS TOOL OUTPUT>
```

### 5.4 `src/components/admin/UserProfileModal.tsx`

```tsx
<SEE FILE `src/components/admin/UserProfileModal.tsx` IN REPO — INCLUDED IN PREVIOUS TOOL OUTPUT>
```

### 5.5 `src/components/admin/DuplicatePaymentResolver.tsx`

```tsx
<SEE FILE `src/components/admin/DuplicatePaymentResolver.tsx` IN REPO — INCLUDED IN PREVIOUS TOOL OUTPUT>
```

---

## 6) Backend Engine (Supabase RPCs) — SQL definitions referenced by paywall/admin subscription flows

### 6.1 `public.admin_activate_subscription` (multiple historical definitions)

#### 6.1.1 `supabase/migrations/20250622120956-6885cad1-c169-4358-9a0e-63ecd0304ec5.sql`

```sql
-- Update the admin_activate_subscription function to include paypal_plan_id parameter
CREATE OR REPLACE FUNCTION public.admin_activate_subscription(
  p_user_id uuid, 
  p_plan_name text, 
  p_billing_amount numeric DEFAULT 60, 
  p_billing_currency text DEFAULT 'QAR',
  p_paypal_plan_id text DEFAULT 'ADMIN-GIFT-PLAN'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_start_date timestamp with time zone := now();
  v_next_billing_date timestamp with time zone;
BEGIN
  -- Calculate next billing date based on plan
  IF p_plan_name ILIKE '%yearly%' OR p_plan_name ILIKE '%year%' THEN
    v_next_billing_date := v_start_date + INTERVAL '1 year';
  ELSIF p_plan_name ILIKE '%2 weeks%' THEN
    v_next_billing_date := v_start_date + INTERVAL '2 weeks';
  ELSE
    v_next_billing_date := v_start_date + INTERVAL '1 month';
  END IF;
  
  -- Update profile
  UPDATE public.profiles
  SET
    is_subscribed = true,
    subscription_status = 'active',
    plan_name = p_plan_name,
    billing_start_date = v_start_date,
    next_billing_date = v_next_billing_date,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Create subscription record with paypal_plan_id
  INSERT INTO public.subscriptions (
    user_id,
    paypal_subscription_id,
    paypal_plan_id,
    status,
    plan_name,
    billing_amount,
    billing_currency,
    billing_cycle,
    start_date,
    next_billing_date
  ) VALUES (
    p_user_id,
    'ADMIN-MANUAL-' || extract(epoch from now())::text,
    p_paypal_plan_id,
    'active',
    p_plan_name,
    p_billing_amount,
    p_billing_currency,
    CASE 
      WHEN p_plan_name ILIKE '%yearly%' THEN 'yearly' 
      WHEN p_plan_name ILIKE '%2 weeks%' THEN 'bi-weekly'
      ELSE 'monthly' 
    END,
    v_start_date,
    v_next_billing_date
  );
  
  RETURN true;
END;
$function$
```

#### 6.1.2 `supabase/migrations/20250630150002-2952c231-6be3-44ec-bb13-c0bb8089ccf2.sql`

```sql
-- Phase 1: Database Schema Updates - Preserve PayPal while adding Fawran tracking

-- Add payment method tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS fawran_payment_id UUID REFERENCES public.pending_fawran_payments(id);

-- Add payment method tracking to subscriptions table  
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'paypal',
ADD COLUMN IF NOT EXISTS fawran_payment_id UUID REFERENCES public.pending_fawran_payments(id);

-- Update admin_activate_subscription function to support both PayPal and Fawran
CREATE OR REPLACE FUNCTION public.admin_activate_subscription(
  p_user_id uuid, 
  p_plan_name text, 
  p_billing_amount numeric DEFAULT 60, 
  p_billing_currency text DEFAULT 'QAR',
  p_payment_method text DEFAULT 'manual',
  p_paypal_subscription_id text DEFAULT NULL,
  p_fawran_payment_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_start_date timestamp with time zone := now();
  v_next_billing_date timestamp with time zone;
  v_subscription_id text;
BEGIN
  -- Calculate next billing date based on plan
  IF p_plan_name ILIKE '%yearly%' OR p_plan_name ILIKE '%year%' THEN
    v_next_billing_date := v_start_date + INTERVAL '1 year';
  ELSE
    v_next_billing_date := v_start_date + INTERVAL '1 month';
  END IF;
  
  -- Generate subscription ID based on payment method
  IF p_payment_method = 'paypal' AND p_paypal_subscription_id IS NOT NULL THEN
    v_subscription_id := p_paypal_subscription_id;
  ELSIF p_payment_method = 'fawran' AND p_fawran_payment_id IS NOT NULL THEN
    v_subscription_id := 'FAWRAN-' || p_fawran_payment_id::text;
  ELSE
    v_subscription_id := 'ADMIN-MANUAL-' || extract(epoch from now())::text;
  END IF;
  
  -- Update profile
  UPDATE public.profiles
  SET
    is_subscribed = true,
    subscription_status = 'active',
    plan_name = p_plan_name,
    billing_start_date = v_start_date,
    next_billing_date = v_next_billing_date,
    payment_method = p_payment_method,
    fawran_payment_id = p_fawran_payment_id,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Create subscription record
  INSERT INTO public.subscriptions (
    user_id,
    paypal_subscription_id,
    status,
    plan_name,
    billing_amount,
    billing_currency,
    billing_cycle,
    start_date,
    next_billing_date,
    payment_method,
    fawran_payment_id
  ) VALUES (
    p_user_id,
    v_subscription_id,
    'active',
    p_plan_name,
    p_billing_amount,
    p_billing_currency,
    CASE WHEN p_plan_name ILIKE '%yearly%' THEN 'yearly' ELSE 'monthly' END,
    v_start_date,
    v_next_billing_date,
    p_payment_method,
    p_fawran_payment_id
  );
  
  RETURN true;
END;
$function$;
```

#### 6.1.3 `supabase/migrations/20250704000001_fix_admin_activate_subscription.sql` (returns JSON)

```sql
-- Update the admin_activate_subscription function to use proper gift duration calculations
CREATE OR REPLACE FUNCTION public.admin_activate_subscription(
  p_user_id uuid,
  p_plan_name text,
  p_billing_amount numeric,
  p_billing_currency text DEFAULT 'QAR',
  p_payment_method text DEFAULT 'manual',
  p_fawran_payment_id uuid DEFAULT NULL,
  p_is_gift boolean DEFAULT false,
  p_gift_duration text DEFAULT NULL,
  p_gift_given_by uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date timestamp with time zone := now();
  v_next_billing_date timestamp with time zone;
  v_subscription_id uuid;
  v_billing_cycle text;
BEGIN
  -- Calculate proper next billing date based on gift duration or plan type
  IF p_is_gift AND p_gift_duration IS NOT NULL THEN
    CASE p_gift_duration
      WHEN '1_week' THEN
        v_next_billing_date := v_start_date + INTERVAL '7 days';
      WHEN '2_weeks' THEN
        v_next_billing_date := v_start_date + INTERVAL '14 days';
      WHEN '1_month' THEN
        v_next_billing_date := v_start_date + INTERVAL '30 days';
      ELSE
        v_next_billing_date := v_start_date + INTERVAL '7 days'; -- Default to 1 week
    END CASE;
    v_billing_cycle := 'gift';
  ELSE
    -- Regular subscription
    IF p_plan_name ILIKE '%yearly%' THEN
      v_next_billing_date := v_start_date + INTERVAL '1 year';
      v_billing_cycle := 'yearly';
    ELSE
      v_next_billing_date := v_start_date + INTERVAL '1 month';
      v_billing_cycle := 'monthly';
    END IF;
  END IF;

  -- Create subscription record
  INSERT INTO public.subscriptions (
    user_id,
    plan_name,
    billing_amount,
    billing_currency,
    billing_cycle,
    payment_method,
    start_date,
    next_billing_date,
    fawran_payment_id,
    is_gift,
    gift_duration,
    gift_given_by,
    status
  ) VALUES (
    p_user_id,
    p_plan_name,
    p_billing_amount,
    p_billing_currency,
    v_billing_cycle,
    p_payment_method,
    v_start_date,
    v_next_billing_date,
    p_fawran_payment_id,
    p_is_gift,
    p_gift_duration,
    p_gift_given_by,
    'active'
  ) RETURNING id INTO v_subscription_id;

  -- Update user profile
  UPDATE public.profiles
  SET 
    is_subscribed = true,
    subscription_status = 'active',
    plan_name = p_plan_name,
    billing_start_date = v_start_date,
    next_billing_date = v_next_billing_date,
    payment_method = p_payment_method,
    fawran_payment_id = p_fawran_payment_id,
    updated_at = now()
  WHERE id = p_user_id;

  -- Log admin activity for gifts
  IF p_is_gift AND p_gift_given_by IS NOT NULL THEN
    INSERT INTO public.admin_activity_logs (
      action,
      target_type,
      target_id,
      admin_user_id,
      details
    ) VALUES (
      'gift_subscription_activated',
      'user',
      p_user_id::text,
      p_gift_given_by,
      jsonb_build_object(
        'user_id', p_user_id,
        'gift_duration', p_gift_duration,
        'plan_name', p_plan_name,
        'start_date', v_start_date,
        'expiry_date', v_next_billing_date,
        'billing_amount', p_billing_amount
      )
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'start_date', v_start_date,
    'expiry_date', v_next_billing_date,
    'gift_duration_days', 
    CASE 
      WHEN p_gift_duration = '1_week' THEN 7
      WHEN p_gift_duration = '2_weeks' THEN 14
      WHEN p_gift_duration = '1_month' THEN 30
      ELSE NULL
    END
  );
END;
$$;
```

### 6.2 `public.process_expired_subscriptions` — `supabase/migrations/20250704035739-c5ef20c6-065c-405c-a11a-58618e2fc546.sql`

```sql
CREATE OR REPLACE FUNCTION public.process_expired_subscriptions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count INTEGER := 0;
  result json;
BEGIN
  -- Update expired subscriptions in profiles table
  UPDATE profiles 
  SET 
    is_subscribed = false,
    subscription_status = 'expired',
    updated_at = now()
  WHERE is_subscribed = true 
    AND next_billing_date IS NOT NULL 
    AND next_billing_date < now();
    
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  -- Update expired subscriptions in subscriptions table
  UPDATE subscriptions 
  SET 
    status = 'expired',
    updated_at = now()
  WHERE status = 'active' 
    AND next_billing_date < now();
  
  -- Log the expiry action
  INSERT INTO admin_activity_logs (
    action,
    target_type,
    details
  ) VALUES (
    'automatic_subscription_expiry',
    'system',
    jsonb_build_object(
      'expired_count', expired_count,
      'processed_at', now(),
      'type', 'daily_expiry_check'
    )
  );
  
  result := json_build_object(
    'success', true,
    'expired_count', expired_count,
    'processed_at', now()
  );
  
  RETURN result;
END;
$$;
```

### 6.3 `public.get_admin_by_auth_id` — `supabase/migrations/20250814065648_21be8a35-b8b1-4ac8-aede-b8f0a531257f.sql`

```sql
CREATE OR REPLACE FUNCTION public.get_admin_by_auth_id(auth_user_id uuid)
RETURNS TABLE(admin_id uuid, email text, full_name text, role text, permissions jsonb, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
declare
  v_email text;
begin
  -- Look up email for this auth user
  select u.email::text into v_email
  from auth.users u
  where u.id = auth_user_id;

  if v_email is null then
    return;
  end if;

  -- ✅ TEMP WHITELIST: allow this email as super_admin
  if lower(v_email) = 'admin@tmw.qa' then
    return query
      select
        u.id::uuid                                        as admin_id,
        u.email::text                                     as email,
        coalesce(u.raw_user_meta_data->>'full_name',
                 'Super Admin')::text                     as full_name,
        'super_admin'::text                               as role,
        '{}'::jsonb                                       as permissions,
        true::boolean                                     as is_active
      from auth.users u
      where u.id = auth_user_id
      limit 1;
  end if;

  -- Otherwise not an admin
  return;
end
$$;
```

### 6.4 Suspension/Admin RPCs referenced in admin components — `supabase/migrations/20250622103630-676d3752-a45d-4899-a216-5e1af3d4069a.sql`

```sql
CREATE OR REPLACE FUNCTION public.send_admin_message(
  p_admin_id uuid,
  p_recipient_id uuid,
  p_subject text,
  p_content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  message_id uuid;
BEGIN
  INSERT INTO public.admin_messages (admin_id, recipient_id, subject, content)
  VALUES (p_admin_id, p_recipient_id, p_subject, p_content)
  RETURNING id INTO message_id;
  
  RETURN message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.suspend_user(
  p_user_id uuid,
  p_admin_id uuid,
  p_reason text DEFAULT 'Account suspended by admin'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    is_suspended = true,
    suspended_at = now(),
    suspended_by = p_admin_id,
    suspension_reason = p_reason,
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.unsuspend_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    is_suspended = false,
    suspended_at = null,
    suspended_by = null,
    suspension_reason = null,
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_user(
  p_user_id uuid,
  p_admin_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    is_suspended = true,
    suspended_at = now(),
    suspended_by = p_admin_id,
    suspension_reason = 'Account deleted by admin',
    display_name = '[DELETED USER]',
    email = null,
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$;
```

---

## 7) Supabase Edge Functions triggered by paywall actions

### 7.1 `supabase/functions/check-subscription/index.ts`

```ts
<SEE FILE `supabase/functions/check-subscription/index.ts` IN REPO — INCLUDED IN PREVIOUS TOOL OUTPUT>
```

### 7.2 `supabase/functions/revenuecat-webhook/index.ts`

```ts
<SEE FILE `supabase/functions/revenuecat-webhook/index.ts` IN REPO — INCLUDED IN PREVIOUS TOOL OUTPUT>
```

### 7.3 `supabase/functions/schedule-reminder-push/index.ts`

```ts
<SEE FILE `supabase/functions/schedule-reminder-push/index.ts` IN REPO — INCLUDED IN PREVIOUS TOOL OUTPUT>
```

### 7.4 `supabase/functions/process-expired-subscriptions/index.ts`

```ts
<SEE FILE `supabase/functions/process-expired-subscriptions/index.ts` IN REPO — INCLUDED IN PREVIOUS TOOL OUTPUT>
```

### 7.5 `supabase/functions/admin-activate-subscription/index.ts`

```ts
<SEE FILE `supabase/functions/admin-activate-subscription/index.ts` IN REPO — INCLUDED IN PREVIOUS TOOL OUTPUT>
```

### 7.6 `supabase/functions/resolve-duplicate-subscription/index.ts`

```ts
<SEE FILE `supabase/functions/resolve-duplicate-subscription/index.ts` IN REPO — INCLUDED IN PREVIOUS TOOL OUTPUT>
```

