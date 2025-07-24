
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
        
        // Simple delay to let auth stabilize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_subscribed, subscription_status, next_billing_date')
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

        console.log('ProtectedRoute: Profile data:', profile);

        if (!profile) {
          console.log('ProtectedRoute: No profile found, user needs subscription');
          setSubscriptionStatus({ 
            isSubscribed: false, 
            isLoading: false, 
            needsPayment: true 
          });
          return;
        }

        // Simple subscription check
        const isValidSubscription = profile.is_subscribed === true && profile.subscription_status === 'active';
        
        console.log('ProtectedRoute: Subscription evaluation:', {
          isSubscribed: profile.is_subscribed,
          subscriptionStatus: profile.subscription_status,
          isValidSubscription
        });

        setSubscriptionStatus({ 
          isSubscribed: isValidSubscription, 
          isLoading: false,
          needsPayment: !isValidSubscription
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

    // Only run subscription check when we have stable auth state
    if (!isLoading && !isTokenRefreshing && user && session) {
      console.log("ProtectedRoute: Auth stable, checking subscription");
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

  // Redirect to login if not authenticated
  if (!user || !session) {
    console.log("ProtectedRoute: No valid user/session, redirecting to login");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Show payment overlay if no valid subscription
  if (!subscriptionStatus.isSubscribed || subscriptionStatus.needsPayment) {
    console.log("ProtectedRoute: User needs subscription:", {
      email: user.email,
      isSubscribed: subscriptionStatus.isSubscribed,
      needsPayment: subscriptionStatus.needsPayment
    });
    
    return (
      <FawranPaymentOverlay 
        userEmail={user.email || ''} 
        onClose={() => {
          console.log('Payment overlay closed, rechecking subscription...');
          setSubscriptionStatus(prev => ({ ...prev, isLoading: true }));
        }}
      />
    );
  }

  console.log("ProtectedRoute: User has valid subscription, allowing access");
  return <>{children}</>;
}
