
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
    error?: string;
  }>({ isSubscribed: false, isLoading: true });
  const [showSubscriptionOverlay, setShowSubscriptionOverlay] = useState(false);

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
        setSubscriptionStatus({ isSubscribed: false, isLoading: false });
        return;
      }

      // Check if user is an owner account
      if (ownerAccounts.includes(user.email || '')) {
        console.log('ProtectedRoute: Owner account detected, bypassing subscription checks');
        setSubscriptionStatus({ isSubscribed: true, isLoading: false });
        return;
      }

      try {
        console.log("ProtectedRoute: Fetching subscription status from database...");
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_subscribed, subscription_status')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('ProtectedRoute: Error fetching subscription status:', error);
          setSubscriptionStatus({ 
            isSubscribed: false, 
            isLoading: false, 
            error: error.message 
          });
          return;
        }

        console.log('ProtectedRoute: Raw profile data:', profile);

        if (!profile) {
          console.log('ProtectedRoute: No profile found, user not subscribed');
          setSubscriptionStatus({ isSubscribed: false, isLoading: false });
          return;
        }

        const isSubscribed = profile.is_subscribed === true && profile.subscription_status === 'active';
        
        console.log('ProtectedRoute: Subscription check result:', {
          profileExists: !!profile,
          isSubscribed: profile.is_subscribed,
          subscriptionStatus: profile.subscription_status,
          finalIsSubscribed: isSubscribed
        });

        setSubscriptionStatus({ isSubscribed, isLoading: false });
      } catch (error) {
        console.error('ProtectedRoute: Exception during subscription check:', error);
        setSubscriptionStatus({ 
          isSubscribed: false, 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    // Only run subscription check when we have a user and auth is not loading
    if (!isLoading && user) {
      console.log("ProtectedRoute: Auth loaded, starting subscription check");
      checkSubscriptionStatus();
    } else if (!isLoading && !user) {
      console.log("ProtectedRoute: Auth loaded but no user, setting not subscribed");
      setSubscriptionStatus({ isSubscribed: false, isLoading: false });
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

  // Check subscription status for non-owner accounts
  if (!subscriptionStatus.isSubscribed) {
    console.log("ProtectedRoute: User not subscribed, showing subscription overlay");
    console.log("ProtectedRoute: Subscription status details:", subscriptionStatus);
    return (
      <SubscriptionOverlay 
        isOpen={true} 
        onClose={() => setShowSubscriptionOverlay(false)} 
      />
    );
  }

  console.log("ProtectedRoute: User authenticated and subscribed, rendering protected content");
  return <>{children}</>;
}
