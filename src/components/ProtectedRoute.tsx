
import React, { useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Loading from "@/components/ui/loading";

export default function ProtectedRoute() {
  const { user, session, isLoading, authInitialized } = useAuth();
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
      authInitialized,
      path: location.pathname
    });
  }, [user, session, isLoading, authInitialized, location.pathname]);

  // Only do redirects after auth has fully initialized
  // This prevents premature redirects during startup
  if (!authInitialized || isLoading) {
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
    // Don't redirect if already at login or signup related pages
    const authPages = ['/login', '/signup', '/forgot-password', '/reset-password'];
    if (!authPages.includes(location.pathname)) {
      logWithTimestamp("User not authenticated, redirecting to login", {
        from: location.pathname
      });
      return <Navigate to="/login" replace state={{ from: location }} />;
    } else {
      // If we're already at an auth page, just render the page
      logWithTimestamp("Already at auth page while not authenticated");
      return <Outlet />;
    }
  }

  // Special case: if user is authenticated and at /login or other auth pages, 
  // redirect to dashboard
  if (user && session) {
    const authPages = ['/login', '/signup', '/forgot-password', '/reset-password'];
    if (authPages.includes(location.pathname)) {
      logWithTimestamp("User is authenticated but on auth page, redirecting to dashboard");
      return <Navigate to="/dashboard" replace />;
    }
  }

  // User is authenticated, render the protected content
  logWithTimestamp("User authenticated, rendering protected content", {
    userId: user.id
  });
  return <Outlet />;
}
