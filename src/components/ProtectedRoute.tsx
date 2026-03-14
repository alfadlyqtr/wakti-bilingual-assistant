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
  const { isSubscribed, isGracePeriod, isAccessExpired, isNewUser, wasSubscribed, hasTrialStarted, isAdminGifted, profile, loading: isProfileLoading } = useUserProfile();
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
            .select('is_subscribed, subscription_status, next_billing_date, billing_start_date, plan_name, payment_method')
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

        // Determine if user has a valid active status
        const isPaid = profile.is_subscribed === true;
        const hasPaymentMethod =
          profile.payment_method != null &&
          typeof profile.payment_method === 'string' &&
          profile.payment_method.trim().length > 0;
          
        const hasActiveSubscription = isPaid || hasPaymentMethod;
        
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
          // Active subscription without billing date (like admin gifts or lifetime) - consider valid
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

  // Listen for trial limit reached events — no-op here, AppLayout handles the UX
  // The full paywall only opens when the 24h trial expires or user was a cancelled subscriber
  useEffect(() => {
    const handleTrialLimit = () => {};
    window.addEventListener('wakti-trial-limit-reached', handleTrialLimit);
    return () => window.removeEventListener('wakti-trial-limit-reached', handleTrialLimit);
  }, []);

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
    if (isSubscribed || subscriptionStatus.isSubscribed || isAdminGifted) { setShowPaywall(false); return; }
    const isAccount = location.pathname.startsWith('/account');
    if (isAccount) { setShowPaywall(false); return; }

    // Priority order: cancelled > trial_expired > new_user
    // cancelled must be first: past subscribers also have expired trials, so we must
    // identify them by wasSubscribed BEFORE checking isAccessExpired, otherwise
    // they get trial_expired and lose the 'Restore Purchases' button.

    // Version 1 (priority): Was subscribed before but cancelled/expired (has plan_name)
    if (wasSubscribed) {
      if (DEV) console.log("ProtectedRoute: Cancelled subscriber - showing welcome back paywall");
      setPaywallVariant('cancelled');
      setShowPaywall(true);
      return;
    }

    // Version 2: Trial expired (pressed skip/X before, 24h ran out, never paid)
    if (isAccessExpired) {
      if (DEV) console.log("ProtectedRoute: Trial expired - showing final paywall");
      setPaywallVariant('trial_expired');
      setShowPaywall(true);
      return;
    }

    // Version 3: New user (first login, no trial started, never subscribed)
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

  // Evaluate whether the user is fully blocked (no valid subscription, loading finished)
  const isBlocked = !subscriptionStatus.isLoading && !isProfileLoading && !(isSubscribed || subscriptionStatus.isSubscribed || isGracePeriod || isAdminGifted);

  if (isBlocked && DEV) {
    console.log("ProtectedRoute: User blocked - no valid subscription:", {
      email: user?.email,
      isSubscribed: subscriptionStatus.isSubscribed,
      needsPayment: subscriptionStatus.needsPayment
    });
  }

  // Task 4: Soft Gate — block the DOM entirely when user is blocked
  return (
    <>
      {CustomPaywallModal && (
        <CustomPaywallModal open={showPaywall} onOpenChange={setShowPaywall} variant={paywallVariant} />
      )}
      {isBlocked ? (
        <div className="w-screen h-[100dvh] bg-background flex items-center justify-center overflow-hidden" />
      ) : (
        children
      )}
    </>
  );
}
