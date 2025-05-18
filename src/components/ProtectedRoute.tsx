
import React, { useState, useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Loading from "@/components/ui/loading";

// Delay in ms before redirecting unauthenticated users
const AUTH_CHECK_DELAY = 300;

export default function ProtectedRoute() {
  const { user, session, isLoading } = useAuth();
  const location = useLocation();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  // Helper function for consistent log formatting
  const logWithTimestamp = (message: string, details?: any) => {
    console.log(
      `[${new Date().toISOString()}] ProtectedRoute: ${message}`,
      details || ""
    );
  };

  useEffect(() => {
    // Only run this effect when auth loading completes
    if (!isLoading) {
      logWithTimestamp("Auth loading complete, checking authentication state", {
        hasUser: !!user,
        hasSession: !!session,
        path: location.pathname
      });

      // If no user or session, prepare for redirect after delay
      if (!user || !session) {
        logWithTimestamp("User not authenticated, starting redirect delay");
        setCheckingAuth(true);

        // Add delay before confirming redirect
        const timer = setTimeout(() => {
          logWithTimestamp("Redirect delay complete, proceeding to login");
          setRedirectPath("/login");
          setCheckingAuth(false);
        }, AUTH_CHECK_DELAY);

        return () => {
          clearTimeout(timer);
          logWithTimestamp("Cleared redirect timer");
        };
      } else {
        // User is authenticated, proceed with rendering content
        logWithTimestamp("User authenticated, rendering protected content", {
          userId: user.id
        });
        setCheckingAuth(false);
      }
    }
  }, [isLoading, user, session, location.pathname]);

  // Show loading during initial auth check
  if (isLoading) {
    logWithTimestamp("Initial auth check in progress");
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loading />
        <p className="text-muted-foreground mt-4">Checking authentication...</p>
      </div>
    );
  }

  // Show loading during the redirect delay
  if (checkingAuth && !user) {
    logWithTimestamp("In redirect delay period");
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loading />
        <p className="text-muted-foreground mt-4">Verifying session...</p>
      </div>
    );
  }

  // If redirect path is set, navigate to login
  if (redirectPath) {
    logWithTimestamp("Redirecting to login", {
      from: location.pathname,
      to: redirectPath
    });
    return <Navigate to={redirectPath} replace state={{ from: location }} />;
  }

  // User is authenticated, render the protected content
  logWithTimestamp("Rendering protected content");
  return <Outlet />;
}
