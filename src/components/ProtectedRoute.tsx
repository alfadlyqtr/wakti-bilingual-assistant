
import React, { useEffect, useState } from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Loading from "@/components/ui/loading";

export default function ProtectedRoute() {
  const { user, session, isLoading, refreshSession } = useAuth();
  const location = useLocation();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authAttempts, setAuthAttempts] = useState(0);

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
        console.log("ProtectedRoute: User and session found, allowing access");
        setIsCheckingAuth(false);
        return;
      }

      // If auth is still loading, wait for it
      if (isLoading) {
        console.log("ProtectedRoute: Auth still loading, waiting...");
        return;
      }

      // If auth is done loading but we don't have a session, try refreshing once
      if (!isLoading && (!user || !session) && authAttempts < 2) {
        setAuthAttempts((prev) => prev + 1);
        try {
          console.log(`ProtectedRoute: Refreshing session (attempt ${authAttempts + 1})`);
          const refreshedSession = await refreshSession();
          console.log("ProtectedRoute: Session refresh result:", { hasSession: !!refreshedSession });
          
          // Add a small delay after refresh to ensure auth state propagates
          setTimeout(() => {
            setIsCheckingAuth(false);
          }, 300);
        } catch (error) {
          console.error("ProtectedRoute: Error refreshing session:", error);
          setIsCheckingAuth(false);
        }
      } else {
        // We've either already tried refreshing or have exceeded attempts
        console.log("ProtectedRoute: Auth checks complete, finalizing state");
        setIsCheckingAuth(false);
      }
    };

    checkAuthState();
  }, [user, session, isLoading, refreshSession, location.pathname, authAttempts]);

  // Only show loading when initial auth state is being determined
  if (isLoading || isCheckingAuth) {
    return <Loading />;
  }

  // After all checks, redirect if not authenticated
  if (!user || !session) {
    console.log("ProtectedRoute: Not authenticated after checks, redirecting to login");
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // User is authenticated, render the protected content
  console.log("ProtectedRoute: Authentication confirmed, rendering content");
  return <Outlet />;
}
