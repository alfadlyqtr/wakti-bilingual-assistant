
import React, { useEffect, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Loading from "@/components/ui/loading";
import { FawranPaymentOverlay } from "@/components/fawran/FawranPaymentOverlay";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, session, isLoading, isTokenRefreshing } = useAuth();
  const location = useLocation();
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    isSubscribed: boolean;
    isLoading: boolean;
    error?: string;
    needsPayment: boolean;
    subscriptionDetails?: any;
  }>({ isSubscribed: false, isLoading: true, needsPayment: false });

  // Owner accounts that bypass all restrictions
  const ownerAccounts = ['alfadly@me.com', 'alfadlyqatar@gmail.com'];

  useEffect(() => {
    console.log("ProtectedRoute: Current auth state:", {
      isLoading,
      isTokenRefreshing,
      hasUser: !!user,
      hasSession: !!session,
      currentPath: location.pathname,
      userEmail: user?.email,
      userId: user?.id
    });
  }, [isLoading, isTokenRefreshing, user, session, location.pathname]);

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      console.log("ProtectedRoute: Starting subscription check for user:", user?.email);
      
      if (!user || !session) {
        console.log("ProtectedRoute: No user or session, setting not subscribed");
        setSubscriptionStatus({ 
          isSubscribed: false, 
          isLoading: false, 
          needsPayment: true 
        });
        return;
      }

      // Check if user is an owner account
      if (ownerAccounts.includes(user.email || '')) {
        console.log('ProtectedRoute: Owner account detected, bypassing subscription checks');
        setSubscriptionStatus({ 
          isSubscribed: true, 
          isLoading: false, 
          needsPayment: false 
        });
        return;
      }

      // Don't check subscription if token is refreshing
      if (isTokenRefreshing) {
        console.log('ProtectedRoute: Token is refreshing, skipping subscription check');
        return;
      }

      try {
        console.log("ProtectedRoute: Fetching subscription status from database...");
        
        // Calculate delay based on login time with circuit breaker
        const loginTime = session.user.last_sign_in_at ? new Date(session.user.last_sign_in_at).getTime() : 0;
        const timeSinceLogin = Date.now() - loginTime;
        
        // Progressive delay: longer for recent logins
        let delay = 10000; // Default 10 seconds
        if (timeSinceLogin < 30000) { // Less than 30 seconds since login
          delay = 15000; // 15 seconds
        } else if (timeSinceLogin < 60000) { // Less than 1 minute since login
          delay = 12000; // 12 seconds
        }
        
        console.log(`⏳ Waiting ${delay}ms before subscription check (login was ${Math.round(timeSinceLogin/1000)}s ago)`);
        
        // Check if token is still refreshing during delay
        const checkInterval = setInterval(() => {
          if (isTokenRefreshing) {
            console.log('⚠️ Token refresh detected during delay, extending wait...');
            delay += 5000; // Add 5 more seconds
          }
        }, 1000);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        clearInterval(checkInterval);
        
        // Final check before making request
        if (isTokenRefreshing) {
          console.log('⚠️ Token still refreshing, skipping subscription check');
          return;
        }
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_subscribed, subscription_status, next_billing_date, billing_start_date, plan_name')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('ProtectedRoute: Error fetching subscription status:', error);
          
          // Enhanced rate limiting detection and handling
          if (error.message?.includes('429') || 
              error.message?.includes('rate limit') || 
              error.message?.includes('too many requests')) {
            console.log('⚠️ Rate limited, implementing exponential backoff');
            
            // Don't update subscription status on rate limit
            // Let the user stay on current screen
            setTimeout(() => {
              console.log('🔄 Retrying subscription check after rate limit backoff');
              checkSubscriptionStatus();
            }, 30000); // Wait 30 seconds before retry
            return;
          }
          
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
      }
    };

    // Only run subscription check when we have stable auth state and no token refresh
    if (!isLoading && !isTokenRefreshing && user && session) {
      console.log("ProtectedRoute: Auth stable and no token refresh, scheduling subscription check");
      checkSubscriptionStatus();
    } else if (!isLoading && !user) {
      console.log("ProtectedRoute: Auth stable but no user, setting needs payment");
      setSubscriptionStatus({ 
        isSubscribed: false, 
        isLoading: false, 
        needsPayment: true 
      });
    }
  }, [user, session, isLoading, isTokenRefreshing]);

  // Show loading while auth or subscription status is loading, or token is refreshing
  if (isLoading || isTokenRefreshing || subscriptionStatus.isLoading) {
    console.log("ProtectedRoute: Still loading - auth:", isLoading, "token refresh:", isTokenRefreshing, "subscription:", subscriptionStatus.isLoading);
    return <Loading />;
  }

  // Proper authentication check - redirect to login if not authenticated
  if (!user || !session) {
    console.log("ProtectedRoute: No valid user/session, redirecting to login");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // STRICT ENFORCEMENT: Block access if no valid subscription
  if (!subscriptionStatus.isSubscribed || subscriptionStatus.needsPayment) {
    console.log("ProtectedRoute: User blocked - no valid subscription:", {
      email: user.email,
      isSubscribed: subscriptionStatus.isSubscribed,
      needsPayment: subscriptionStatus.needsPayment
    });
    
    // Show Fawran payment overlay with improved onClose handling
    return (
      <FawranPaymentOverlay 
        userEmail={user.email || ''} 
        onClose={() => {
          // Instead of reloading, trigger a new subscription check
          console.log('Payment overlay closed, rechecking subscription...');
          setSubscriptionStatus(prev => ({ ...prev, isLoading: true }));
          
          // Recheck subscription after a delay
          setTimeout(() => {
            if (user && session && !isTokenRefreshing) {
              // Trigger subscription recheck by updating a dependency
              setSubscriptionStatus(prev => ({ 
                ...prev, 
                isLoading: false,
                needsPayment: true // Reset to trigger new check
              }));
            }
          }, 2000);
        }}
      />
    );
  }

  console.log("ProtectedRoute: User has valid subscription, allowing access");
  return <>{children}</>;
}
