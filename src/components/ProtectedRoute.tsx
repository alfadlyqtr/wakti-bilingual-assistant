
import React, { useEffect } from "react";
import { Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Loading from "@/components/ui/loading";

export default function ProtectedRoute() {
  const { user, session, isLoading, authInitialized } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
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
      userId: user?.id,
      hasSession: !!session,
      isLoading,
      authInitialized,
      path: location.pathname
    });

    // Aggressively redirect authenticated users on auth pages to dashboard
    if (user && session && authPages.includes(location.pathname)) {
      logWithTimestamp("User authenticated on auth page, redirecting to dashboard");
      navigate("/dashboard", { replace: true });
    }
  }, [user, session, isLoading, authInitialized, location.pathname, navigate]);

  // Auth pages that should redirect to dashboard when authenticated
  const authPages = ['/login', '/signup', '/forgot-password', '/reset-password'];
  
  // Only do redirects after auth has fully initialized
  if (!authInitialized) {
    logWithTimestamp("Auth not yet initialized, showing loading screen");
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loading />
        <p className="text-muted-foreground mt-4">Initializing authentication...</p>
      </div>
    );
  }

  // While actively loading auth state, show loading indicator
  if (isLoading) {
    logWithTimestamp("Auth loading in progress");
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loading />
        <p className="text-muted-foreground mt-4">Checking authentication...</p>
      </div>
    );
  }

  // Auth is initialized and not loading
  logWithTimestamp("Auth state ready, making redirection decision", {
    isAuthenticated: !!user && !!session,
    currentPath: location.pathname,
    isAuthPage: authPages.includes(location.pathname)
  });
  
  // If at an auth page while authenticated, redirect to dashboard
  if (user && session && authPages.includes(location.pathname)) {
    logWithTimestamp("User is authenticated but on auth page, redirecting to dashboard");
    return <Navigate to="/dashboard" replace />;
  }
  
  // If at a protected page but not authenticated, redirect to login
  if ((!user || !session) && !authPages.includes(location.pathname)) {
    logWithTimestamp("User not authenticated and trying to access protected route, redirecting to login", {
      from: location.pathname
    });
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  
  // User is authenticated and on protected page, or unauthenticated and on auth page
  logWithTimestamp("Rendering content for current route", {
    path: location.pathname,
    isAuthenticated: !!user && !!session
  });
  return <Outlet />;
}
