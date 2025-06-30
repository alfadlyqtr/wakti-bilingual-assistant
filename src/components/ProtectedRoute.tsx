
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
  const { user, session, isLoading } = useAuth();
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
      hasUser: !!user,
      hasSession: !!session,
      currentPath: location.pathname,
      userEmail: user?.email,
      userId: user?.id
    });
  }, [isLoading, user, session, location.pathname]);

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
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
      if (ownerAccounts.includes(user.email || '')) {
        console.log('ProtectedRoute: Owner account detected, bypassing subscription checks');
        setSubscriptionStatus({ 
          isSubscribed: true, 
          isLoading: false, 
          needsPayment: false 
        });
        return;
      }

      try {
        console.log("ProtectedRoute: Fetching subscription status from database...");
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_subscribed, subscription_status, next_billing_date, billing_start_date, plan_name')
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

        // Basic subscription check
        const hasActiveSubscription = profile.is_subscribed === true && profile.subscription_status === 'active';
        
        if (hasActiveSubscription && profile.next_billing_date) {
          const nextBillingDate = new Date(profile.next_billing_date);
          const gracePeriodDays = 7; // 7 days grace period after due date
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

    // Only run subscription check when we have a user and auth is not loading
    if (!isLoading && user) {
      console.log("ProtectedRoute: Auth loaded, starting subscription check");
      checkSubscriptionStatus();
    } else if (!isLoading && !user) {
      console.log("ProtectedRoute: Auth loaded but no user, setting needs payment");
      setSubscriptionStatus({ 
        isSubscribed: false, 
        isLoading: false, 
        needsPayment: true 
      });
    }
  }, [user, isLoading]);

  // Show loading while auth or subscription status is loading
  if (isLoading || subscriptionStatus.isLoading) {
    console.log("ProtectedRoute: Still loading - auth:", isLoading, "subscription:", subscriptionStatus.isLoading);
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
    
    // Show Fawran payment overlay
    return (
      <FawranPaymentOverlay 
        userEmail={user.email || ''} 
        onClose={() => {
          // Refresh the page to re-check subscription status
          window.location.reload();
        }}
      />
    );
  }

  console.log("ProtectedRoute: User has valid subscription, allowing access");
  return <>{children}</>;
}
