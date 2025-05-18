
import React, { useEffect, useState } from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Loading from "@/components/ui/loading";

export default function ProtectedRoute() {
  const { user, session, isLoading, refreshSession } = useAuth();
  const location = useLocation();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Improved auth state logging and handling
  useEffect(() => {
    console.log("ProtectedRoute: Initial auth state check:", { 
      isLoading, 
      hasUser: !!user, 
      hasSession: !!session, 
      path: location.pathname 
    });

    // Give the auth context time to fully initialize
    const checkAuthState = async () => {
      // If we already have user and session, don't need extra checks
      if (user && session) {
        setIsCheckingAuth(false);
        return;
      }

      // If auth is still loading, wait for it
      if (isLoading) {
        return;
      }

      // If auth is done loading but we don't have a session, try refreshing once
      if (!isLoading && (!user || !session)) {
        try {
          console.log("ProtectedRoute: Refreshing session");
          await refreshSession();
        } catch (error) {
          console.error("ProtectedRoute: Error refreshing session:", error);
        } finally {
          // We're done checking regardless of the outcome
          setIsCheckingAuth(false);
        }
      } else {
        setIsCheckingAuth(false);
      }
    };

    checkAuthState();
  }, [user, session, isLoading, refreshSession, location.pathname]);

  // Only show loading when initial auth state is being determined
  if (isLoading || isCheckingAuth) {
    return <Loading />;
  }

  // After all checks, redirect if not authenticated
  if (!user || !session) {
    console.log("ProtectedRoute: Not authenticated after checks, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  // User is authenticated, render the protected content
  console.log("ProtectedRoute: Authentication confirmed, rendering content");
  return <Outlet />;
}
