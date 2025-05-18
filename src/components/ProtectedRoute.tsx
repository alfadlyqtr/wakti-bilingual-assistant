
import React, { useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Loading from "@/components/ui/loading";

export default function ProtectedRoute() {
  const { user, session, isLoading } = useAuth();
  const location = useLocation();

  // Helper function for consistent log formatting
  const logWithTimestamp = (message: string, details?: any) => {
    console.log(
      `[${new Date().toISOString()}] ProtectedRoute: ${message}`,
      details || ""
    );
  };

  // Log current auth state when component mounts or auth state changes
  useEffect(() => {
    logWithTimestamp("Auth state check", {
      hasUser: !!user,
      hasSession: !!session,
      isLoading,
      path: location.pathname
    });
  }, [user, session, isLoading, location.pathname]);

  // Still loading auth state
  if (isLoading) {
    logWithTimestamp("Auth loading in progress");
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loading />
        <p className="text-muted-foreground mt-4">Checking authentication...</p>
      </div>
    );
  }

  // Auth check complete, but not authenticated
  if (!user || !session) {
    // Only redirect to login if we're not already there (prevents loops)
    if (location.pathname !== '/login') {
      logWithTimestamp("User not authenticated, redirecting to login", {
        from: location.pathname
      });
      return <Navigate to="/login" replace state={{ from: location }} />;
    } else {
      // If we're already at login, just render the login page
      logWithTimestamp("Already at login page while not authenticated");
      return <Outlet />;
    }
  }

  // User is authenticated, render the protected content
  logWithTimestamp("User authenticated, rendering protected content", {
    userId: user.id
  });
  return <Outlet />;
}
