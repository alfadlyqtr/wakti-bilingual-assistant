
import React, { useEffect, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Loading from "@/components/ui/loading";
import { SubscriptionOverlay } from "@/components/SubscriptionOverlay";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, session, isLoading } = useAuth();
  const location = useLocation();
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    isSubscribed: boolean;
    isLoading: boolean;
  }>({ isSubscribed: false, isLoading: true });

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
      if (!user) {
        setSubscriptionStatus({ isSubscribed: false, isLoading: false });
        return;
      }

      // Check if user is an owner account
      if (ownerAccounts.includes(user.email || '')) {
        console.log('Owner account detected, bypassing subscription checks');
        setSubscriptionStatus({ isSubscribed: true, isLoading: false });
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_subscribed, subscription_status')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching subscription status:', error);
          setSubscriptionStatus({ isSubscribed: false, isLoading: false });
          return;
        }

        const isSubscribed = profile?.is_subscribed === true && profile?.subscription_status === 'active';
        
        console.log('Subscription check result:', {
          profileExists: !!profile,
          isSubscribed: profile?.is_subscribed,
          subscriptionStatus: profile?.subscription_status,
          finalIsSubscribed: isSubscribed
        });

        setSubscriptionStatus({ isSubscribed, isLoading: false });
      } catch (error) {
        console.error('Error checking subscription status:', error);
        setSubscriptionStatus({ isSubscribed: false, isLoading: false });
      }
    };

    if (!isLoading && user) {
      checkSubscriptionStatus();
    }
  }, [user, isLoading]);

  if (isLoading || subscriptionStatus.isLoading) {
    console.log("ProtectedRoute: Still loading auth state or subscription, showing loading");
    return <Loading />;
  }

  // Proper authentication check - redirect to login if not authenticated
  if (!user || !session) {
    console.log("ProtectedRoute: No valid user/session, redirecting to login");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check subscription status for non-owner accounts
  if (!subscriptionStatus.isSubscribed) {
    console.log("ProtectedRoute: User not subscribed, showing subscription overlay");
    return <SubscriptionOverlay />;
  }

  console.log("ProtectedRoute: User authenticated and subscribed, rendering protected content");
  return <>{children}</>;
}
