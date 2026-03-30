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
  // NUCLEAR OPTION: direct DB expiry check — bypasses useUserProfile stale state entirely
  const [directTrialExpired, setDirectTrialExpired] = useState(false);

  // Enable subscription/IAP enforcement
  const TEMP_DISABLE_SUBSCRIPTION_CHECKS = false;

  // StrictMode-safe guards and timers
  const retryTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const destroyedRef = useRef(false);
  const retriedRef = useRef(false); // allow at most one background retry per user
  const lastUserIdRef = useRef<string | null>(null);
  const trialJustStartedRef = useRef(false); // suppress paywall bounce-back after skip/X
  const accessDecisionRef = useRef<string>(''); // dedup access decision logs

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
        // Zero-Trust: always wait for live DB response — no timeouts, no cache
        await ensurePassport();
        console.log("ProtectedRoute: Fetching subscription status from database...");

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_subscribed, subscription_status, next_billing_date, billing_start_date, plan_name, payment_method')
          .eq('id', user.id)
          .maybeSingle();

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

        const isPaid = profile.is_subscribed === true;
        // Real payment methods: gift, apple, google, stripe (NOT 'manual' — that's the old DB default for everyone)
        const pm = profile.payment_method;
        const hasRealPaymentMethod = pm && pm !== 'manual';
        const hasActiveGift = hasRealPaymentMethod && profile.next_billing_date && new Date(profile.next_billing_date) > now;

        if (isPaid && profile.next_billing_date) {
          const nextBillingDate = new Date(profile.next_billing_date);
          const gracePeriodDays = 1;
          const gracePeriodEnd = new Date(nextBillingDate);
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);
          
          isValidSubscription = now <= gracePeriodEnd;
          needsPayment = now > nextBillingDate;
          
          console.log('ProtectedRoute: Date-based subscription check:', {
            now: now.toISOString(),
            nextBillingDate: nextBillingDate.toISOString(),
            gracePeriodEnd: gracePeriodEnd.toISOString(),
            isValidSubscription,
            needsPayment,
          });
        } else if (isPaid && !profile.next_billing_date) {
          isValidSubscription = true;
          needsPayment = false;
          console.log('ProtectedRoute: Active subscription without billing date');
        } else if (hasActiveGift) {
          // Gift/Apple/Google user with future billing but is_subscribed=false
          isValidSubscription = true;
          needsPayment = false;
          console.log('ProtectedRoute: Active gift/IAP user:', pm);
        }

        console.log('ProtectedRoute: Final subscription evaluation:', {
          profileExists: !!profile,
          isSubscribed: profile.is_subscribed,
          subscriptionStatus: profile.subscription_status,
          nextBillingDate: profile.next_billing_date,
          planName: profile.plan_name,
          isPaid,
          hasActiveGift,
          isValidSubscription,
          needsPayment
        });

        setSubscriptionStatus({ 
          isSubscribed: isValidSubscription, 
          isLoading: false,
          needsPayment: needsPayment && !isValidSubscription,
          subscriptionDetails: profile
        });
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
      // ZERO-LEAK FIX: Never prime isSubscribed from cache
      // Cache can only mark isLoading=false to stop the spinner, but access
      // decisions are made exclusively from live profile data (useUserProfile).
      // This prevents stale/cross-account cache from granting dashboard access.
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
        // Directly fetch fresh profile data from database
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              console.log('ProtectedRoute: Fresh profile fetched, is_subscribed:', data.is_subscribed);
              window.dispatchEvent(new CustomEvent('wakti-profile-updated'));
            }
          });
      }
    };

    window.addEventListener('wakti-subscription-updated', handleSubscriptionUpdate);
    return () => window.removeEventListener('wakti-subscription-updated', handleSubscriptionUpdate);
  }, [user?.id]);

  // Listen for trial start (X pressed) — suppress paywall re-open for 3s while profile refreshes
  useEffect(() => {
    const handleTrialStarted = () => {
      trialJustStartedRef.current = true;
      setShowPaywall(false);
      setTimeout(() => { trialJustStartedRef.current = false; }, 3000);
    };
    window.addEventListener('wakti-trial-started', handleTrialStarted);
    return () => window.removeEventListener('wakti-trial-started', handleTrialStarted);
  }, []);

  // Force re-evaluation of isAccessExpired every 10 seconds
  useEffect(() => {
    if (isSubscribed || !profile?.free_access_start_at) return;
    const interval = setInterval(() => {
      setAccessCheckTick(t => t + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [isSubscribed, profile?.free_access_start_at]);

  // NUCLEAR OPTION: Direct DB fetch to check trial expiry
  // Runs immediately on mount + every 30s. Bypasses useUserProfile entirely.
  // This is the last line of defense when Realtime/profile cache is stale.
  useEffect(() => {
    if (!user?.id) return;
    const ownerAccountsCheck = ['alfadly@me.com', 'alfadlyqatar@gmail.com'];
    if (ownerAccountsCheck.includes((user.email || '').toLowerCase())) return;

    const checkDirect = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('free_access_start_at, is_subscribed, payment_method, next_billing_date')
          .eq('id', user.id)
          .single();

        if (!data) return;
        if (data.is_subscribed) { setDirectTrialExpired(false); return; }
        const pm = data.payment_method;
        if (pm && pm !== 'manual' && data.next_billing_date && new Date(data.next_billing_date) > new Date()) {
          setDirectTrialExpired(false); return;
        }
        if (!data.free_access_start_at) { setDirectTrialExpired(false); return; }
        const elapsed = (Date.now() - Date.parse(data.free_access_start_at)) / 60000;
        const expired = elapsed >= 1440;
        if (DEV) console.log('ProtectedRoute [direct-check]: elapsed', Math.floor(elapsed), 'min | expired:', expired);
        setDirectTrialExpired(expired);
      } catch {}
    };

    checkDirect();
    const interval = setInterval(checkDirect, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Determine paywall variant
  const [paywallVariant, setPaywallVariant] = useState<PaywallVariant>('new_user');

  useEffect(() => {
    if (TEMP_DISABLE_SUBSCRIPTION_CHECKS) return;
    if (!user?.id) return;
    
    // SURGICAL FIX #2: Block the Loading Loophole
    // DO NOT show paywall while profile is loading - keep user in wait state
    if (isProfileLoading) { return; }
    
    // SURGICAL FIX #1: Stop Trusting the Cache for Walls
    // Trust ONLY live profile data, not cached subscriptionStatus
    if (trialJustStartedRef.current) { setShowPaywall(false); return; }
    if (isSubscribed || subscriptionStatus.isSubscribed || isAdminGifted || isGracePeriod) { setShowPaywall(false); return; }

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
    // directTrialExpired is the nuclear fallback when useUserProfile profile is stale
    if (isAccessExpired || directTrialExpired) {
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
  }, [user?.id, isSubscribed, subscriptionStatus.isSubscribed, isAccessExpired, isNewUser, wasSubscribed, location.pathname, accessCheckTick, isProfileLoading, directTrialExpired]);

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
        console.log("ProtectedRoute: Still loading - BLOCKING (black screen)");
      }
    }
    // ZERO-LEAK FIX: Never render children while auth is loading
    return (
      <div className="w-screen h-[100dvh] bg-background flex items-center justify-center overflow-hidden">
        <div className="mx-auto px-3 py-1 rounded-full text-xs bg-primary/10 text-primary shadow-sm">
          Signing you in…
        </div>
      </div>
    );
  }

  // TASK 1: Kill the 'Polite' Returns - Block by Default
  // IMPORTANT: Never redirect to /login while AuthContext is still loading.
  // On refresh, Supabase session restoration can complete AFTER initial render.
  if (isLoading) {
    if (DEV) console.log("ProtectedRoute: Auth still loading - BLOCKING access");
    return (
      <div className="w-screen h-[100dvh] bg-background flex items-center justify-center overflow-hidden">
        <div className="mx-auto mt-2 px-3 py-1 rounded-full text-xs bg-primary/10 text-primary shadow-sm">
          Signing you in…
        </div>
      </div>
    );
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

  // TASK 1: Kill the 'Polite' Returns - Block by Default
  if (subscriptionStatus.isLoading) {
    if (DEV) console.log("ProtectedRoute: Subscription pending - BLOCKING access");
    return (
      <div className="w-screen h-[100dvh] bg-background flex items-center justify-center overflow-hidden">
        <div className="mx-auto mt-2 px-3 py-1 rounded-full text-xs bg-primary/10 text-primary shadow-sm">
          Verifying subscription…
        </div>
      </div>
    );
  }

  // CRITICAL: Block while profile is loading - never let children render during load
  if (isProfileLoading) {
    if (DEV) console.log("ProtectedRoute: Profile loading - BLOCKING access");
    return (
      <div className="w-screen h-[100dvh] bg-background flex items-center justify-center overflow-hidden">
        <div className="mx-auto mt-2 px-3 py-1 rounded-full text-xs bg-primary/10 text-primary shadow-sm">
          Loading profile…
        </div>
      </div>
    );
  }

  // ── ZERO-TRUST WHITELIST ──
  // Access is confirmed ONLY when:
  //   1. All loading is done
  //   2. At least one active payment/trial signal is live-verified
  //   3. User is NOT new (must start trial first)
  //   4. Trial has NOT expired (isAccessExpired = false)
  //   5. User has NOT previously cancelled without resubscribing (wasSubscribed = false)
  // isAccessExpired and wasSubscribed are hard exits — no other signal overrides them.
  const hasConfirmedAccess = (
    !isLoading &&
    !isProfileLoading &&
    !subscriptionStatus.isLoading &&
    (isSubscribed || subscriptionStatus.isSubscribed || isAdminGifted || isGracePeriod) &&
    !isNewUser &&
    !isAccessExpired &&
    !wasSubscribed &&
    !directTrialExpired  // NUCLEAR: direct DB check overrides everything
  );

  // Log access decision only when values actually change (not on every render)
  const accessDecisionSnapshot = DEV ? JSON.stringify({ email: user?.email, hasConfirmedAccess, isNewUser, isSubscribed, subscriptionStatus_isSubscribed: subscriptionStatus.isSubscribed, isAdminGifted, isGracePeriod, showPaywall, paywallVariant }) : '';
  if (DEV && accessDecisionSnapshot !== accessDecisionRef.current) {
    accessDecisionRef.current = accessDecisionSnapshot;
    console.log('ProtectedRoute: Access decision:', JSON.parse(accessDecisionSnapshot));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL GATE: All loading is done. Decision time.
  // ═══════════════════════════════════════════════════════════════════════════
  // If hasConfirmedAccess is FALSE → BLACK WALL. No exceptions. No children.
  // If hasConfirmedAccess is TRUE  → Render children (dashboard/app).
  // ═══════════════════════════════════════════════════════════════════════════

  if (!hasConfirmedAccess) {
    if (DEV) console.log("ProtectedRoute: ACCESS DENIED - rendering black wall");
    return (
      <>
        {CustomPaywallModal && (
          <CustomPaywallModal open={showPaywall} onOpenChange={setShowPaywall} variant={paywallVariant} />
        )}
        <div className="w-screen h-[100dvh] bg-[#0c0f14] flex flex-col items-center justify-center overflow-hidden">
          {/* Absolute Black. No icons. No greetings. No leaks. Zero-Trust. */}
        </div>
      </>
    );
  }

  // ACCESS CONFIRMED - render the app
  return (
    <>
      {CustomPaywallModal && (
        <CustomPaywallModal open={showPaywall} onOpenChange={setShowPaywall} variant={paywallVariant} />
      )}
      {children}
    </>
  );
}
