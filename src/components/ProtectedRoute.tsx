import React, { useEffect, useRef, useState, Suspense } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";

export type PaywallVariant = 'new_user' | 'cancelled' | 'trial_expired';
// Item #7 Stage 7D: 'owner' removed — owners are identified via profiles.admin_gifted = true
// and get stamped 'admin_gifted'. No client-side hardcoded bypass remains.
type AccessStamp = 'subscribed' | 'admin_gifted' | 'trial_active' | null;

interface ProtectedRouteProps {
  children: React.ReactNode;
  CustomPaywallModal?: React.ComponentType<{ open: boolean; onOpenChange: (open: boolean) => void; variant: PaywallVariant }>;
}


export default function ProtectedRoute({ children, CustomPaywallModal }: ProtectedRouteProps) {
  const DEV = !!(import.meta && import.meta.env && import.meta.env.DEV);
  const { user, session, isLoading, lastLoginTimestamp } = useAuth();
  const location = useLocation();
  const [showPaywall, setShowPaywall] = useState(false);

  const [hasAnySession, setHasAnySession] = useState<boolean>(!!session);

  // Item #7: single source of truth for access decisions (the "one brain" lives in UserProfileContext).
  // ProtectedRoute no longer computes subscription math locally — it just reads accessState + paywallVariant.
  const {
    isSubscribed,
    isGracePeriod,
    isAdminGifted,
    accessState,
    paywallVariant,
    profile,
    loading: isProfileLoading,
  } = useUserProfile();
  const [recentLoginGrace, setRecentLoginGrace] = useState(() => {
    if (!lastLoginTimestamp) return false;
    return Date.now() - lastLoginTimestamp < 5000;
  });

  useEffect(() => {
    if (!lastLoginTimestamp) return;
    const elapsed = Date.now() - lastLoginTimestamp;
    if (elapsed < 5000) {
      setRecentLoginGrace(true);
      const timer = window.setTimeout(() => setRecentLoginGrace(false), 5000 - elapsed);
      return () => clearTimeout(timer);
    }
  }, [lastLoginTimestamp]);

  // Owner accounts are identified server-side via profiles.admin_gifted = true
  // (no client-side email list — security + zero drift with backend).

  // ═══════════════════════════════════════════════════════════════════════
  // STAMP ONCE, TRUST FOREVER
  // The immigration officer checks the passport ONCE. Stamps it.
  // The app trusts the stamp — no re-checking on every render.
  // Stamp resets ONLY on logout (unmount) or user change.
  // ═══════════════════════════════════════════════════════════════════════
  const accessStampRef = useRef<AccessStamp>(null);
  const stampLoggedRef = useRef(false);
  const stampUserRef = useRef<string | null>(null);

  // ── Read cache directly for instant cold-start stamping ────────────
  // When the device restarts, user.id is available before isProfileLoading
  // resolves. We read the localStorage cache here to stamp immediately
  // without waiting for the DB round-trip.
  const getCachedProfileForStamp = (uid: string) => {
    try {
      const raw = localStorage.getItem(`wakti_profile_${uid}`);
      if (!raw) return null;
      const { data } = JSON.parse(raw);
      return data || null;
    } catch { return null; }
  };

  // ── SYNCHRONOUS STAMP (runs during render, not after) ──────────────
  // Setting a ref during render is safe — no re-render triggered.
  // This means the stamp is available on the SAME render cycle.
  if (!user?.id && accessStampRef.current) {
    // User logged out — clear stamp
    accessStampRef.current = null;
    stampLoggedRef.current = false;
    stampUserRef.current = null;
  } else if (user?.id && stampUserRef.current !== user.id) {
    // Different user — reset stamp for fresh check
    accessStampRef.current = null;
    stampLoggedRef.current = false;
    stampUserRef.current = user.id;
  }

  if (!accessStampRef.current && user?.id) {
    // Use live profile if available, otherwise fall back to localStorage cache
    // This is the key fix: stamp BEFORE isProfileLoading resolves on cold restart
    const profileForStamp = profile ?? getCachedProfileForStamp(user.id);
    if (profileForStamp) {
      const cachedIsSubscribed = profileForStamp.is_subscribed === true;
      const cachedIsAdminGifted = profileForStamp.admin_gifted === true;
      const cachedFreeAccessStart = profileForStamp.free_access_start_at;
      const cachedInGracePeriod = cachedFreeAccessStart
        ? (Date.now() - new Date(cachedFreeAccessStart).getTime()) < 24 * 60 * 60 * 1000
        : false;
      if (cachedIsSubscribed) accessStampRef.current = 'subscribed';
      else if (cachedIsAdminGifted) accessStampRef.current = 'admin_gifted';
      else if (cachedInGracePeriod) accessStampRef.current = 'trial_active';
    } else if (!isProfileLoading) {
      // No cache at all — fall back to computed values from context
      if (isSubscribed) accessStampRef.current = 'subscribed';
      else if (isAdminGifted) accessStampRef.current = 'admin_gifted';
      else if (isGracePeriod) accessStampRef.current = 'trial_active';
    }
    // Log ONCE when stamp is first set
    if (accessStampRef.current && !stampLoggedRef.current) {
      stampLoggedRef.current = true;
      if (DEV) console.log(`ProtectedRoute: 🛂 STAMPED — ${accessStampRef.current}. No further checks.`);
    }
  }

  // Enable subscription/IAP enforcement
  const TEMP_DISABLE_SUBSCRIPTION_CHECKS = false;

  const trialJustStartedRef = useRef(false); // suppress paywall bounce-back after skip/X
  const accessDecisionRef = useRef<string>(''); // dedup access decision logs

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

  // Item #8 Medium #2: Removed the dead `wakti-trial-limit-reached` no-op
  // listener that previously lived here. AppLayout + TrialGateOverlay own this
  // UX now; ProtectedRoute only cares about paywall/subscription state, which
  // is driven by UserProfileContext (see below).

  // NOTE: `wakti-subscription-updated` is listened directly inside UserProfileContext now (Stage 7C).
  // No re-dispatch needed from here.

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

  // Show/hide paywall based on accessState (single source of truth).
  // All variant selection now lives in UserProfileContext — we just react to it.
  useEffect(() => {
    if (TEMP_DISABLE_SUBSCRIPTION_CHECKS) return;
    if (!user?.id) return;
    if (isProfileLoading) return;
    if (trialJustStartedRef.current) { setShowPaywall(false); return; }
    if (accessStampRef.current) { setShowPaywall(false); return; }

    if (accessState === 'subscribed' || accessState === 'admin_gifted' || accessState === 'trial_active') {
      setShowPaywall(false);
      return;
    }
    if (accessState === 'loading') return; // still deciding — never flash paywall on indecision

    // accessState is one of 'paywall:*' — context already picked the right variant.
    if (DEV) console.log('ProtectedRoute: showing paywall variant:', paywallVariant);
    setShowPaywall(true);
  }, [user?.id, accessState, paywallVariant, isProfileLoading, DEV, TEMP_DISABLE_SUBSCRIPTION_CHECKS]);

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

  // ── PASSPORT CHECK ─────────────────────────────────────────────────────
  // If the passport is already stamped, trust it unconditionally.
  // No redirect to login, no session re-check, no paywall. Walk through.
  if (accessStampRef.current) {
    effectiveHasSession = true;
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
  // NOTE: stamped users never reach this line (effectiveHasSession forced true above)
  if (!effectiveHasSession) {
    if (DEV) console.log("ProtectedRoute: No valid user/session, redirecting to login");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (TEMP_DISABLE_SUBSCRIPTION_CHECKS) {
    if (DEV) console.log("ProtectedRoute: TEMP DISABLE - allowing access after auth");
    return <>{children}</>;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STAMP CHECK: Stamped users already bypassed the redirect above.
  // Render children immediately — no subscription/profile/paywall gates.
  // ═══════════════════════════════════════════════════════════════════════
  if (accessStampRef.current) {
    return (
      <>
        {CustomPaywallModal && (
          <Suspense fallback={null}>
            <CustomPaywallModal open={showPaywall} onOpenChange={setShowPaywall} variant={paywallVariant ?? 'new_user'} />
          </Suspense>
        )}
        {children}
      </>
    );
  }

  // CRITICAL: Block while profile is loading - never let children render during load
  // EXCEPTION: If the trial was just started (Begin pressed on welcome wall),
  // the profile is mid-refetch but we already know the user is allowed in.
  // Skipping this block prevents the blank screen right after pressing Begin.
  if (isProfileLoading && !recentLoginGrace && !trialJustStartedRef.current) {
    if (DEV) console.log("ProtectedRoute: Profile loading - BLOCKING access");
    return (
      <div className="w-screen h-[100dvh] bg-background flex items-center justify-center overflow-hidden">
        <div className="mx-auto mt-2 px-3 py-1 rounded-full text-xs bg-primary/10 text-primary shadow-sm">
          Loading profile…
        </div>
      </div>
    );
  }

  // ── SINGLE GATE ──────────────────────────────────────────────────────────
  // All access logic lives in UserProfileContext.accessState. One brain, one decision.
  const isAllowedIn = accessState === 'subscribed'
    || accessState === 'admin_gifted'
    || accessState === 'trial_active';
  const hasConfirmedAccess = !isLoading && !isProfileLoading && isAllowedIn;

  // Log access decision only when values actually change (not on every render)
  if (DEV && !accessStampRef.current) {
    const accessDecisionSnapshot = JSON.stringify({
      email: user?.email, accessState, paywallVariant, hasConfirmedAccess, showPaywall,
    });
    if (accessDecisionSnapshot !== accessDecisionRef.current) {
      accessDecisionRef.current = accessDecisionSnapshot;
      console.log('ProtectedRoute: Access decision:', JSON.parse(accessDecisionSnapshot));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL GATE: All loading is done. Decision time.
  // hasConfirmedAccess FALSE → BLACK WALL. No children. Only modal above.
  // hasConfirmedAccess TRUE  → Render the app.
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      {CustomPaywallModal && (
        <Suspense fallback={null}>
          <CustomPaywallModal open={showPaywall} onOpenChange={setShowPaywall} variant={paywallVariant ?? 'new_user'} />
        </Suspense>
      )}
      {(hasConfirmedAccess || (recentLoginGrace && !isLoading && user) || (trialJustStartedRef.current && user)) ? (
        children
      ) : (
        <div className="w-screen h-[100dvh] bg-background flex items-center justify-center overflow-hidden">
          <div className="mx-auto mt-2 px-3 py-1 rounded-full text-xs bg-primary/10 text-primary shadow-sm animate-pulse">
            Almost there…
          </div>
        </div>
      )}
    </>
  );
}
