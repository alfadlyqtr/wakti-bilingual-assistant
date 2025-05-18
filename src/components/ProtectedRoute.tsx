
import { useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Loading from "@/components/ui/loading";

export default function ProtectedRoute() {
  const { user, session, isLoading, authInitialized } = useAuth();
  const location = useLocation();
  
  // Auth pages that should redirect to dashboard when authenticated
  const authPages = ['/login', '/signup', '/forgot-password', '/reset-password'];
  const currentPathIsAuthPage = authPages.includes(location.pathname);
  
  useEffect(() => {
    console.log("ProtectedRoute: Auth state", {
      hasUser: !!user,
      hasSession: !!session,
      isLoading,
      authInitialized,
      path: location.pathname,
      isAuthPage: currentPathIsAuthPage
    });
  }, [user, session, isLoading, authInitialized, location.pathname, currentPathIsAuthPage]);
  
  // Wait until auth is initialized
  if (!authInitialized) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loading />
        <p className="text-muted-foreground mt-4">Initializing...</p>
      </div>
    );
  }
  
  // While actively checking auth state, show loading indicator
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loading />
        <p className="text-muted-foreground mt-4">Checking authentication...</p>
      </div>
    );
  }
  
  // Auth is initialized and not loading
  
  // If at an auth page while authenticated, redirect to dashboard
  if (user && session && currentPathIsAuthPage) {
    console.log("ProtectedRoute: User is authenticated but on auth page, redirecting to dashboard");
    return <Navigate to="/dashboard" replace />;
  }
  
  // If at a protected page but not authenticated, redirect to login
  if ((!user || !session) && !currentPathIsAuthPage) {
    console.log("ProtectedRoute: User not authenticated and trying to access protected route, redirecting to login");
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  
  // User is authenticated and on protected page, or unauthenticated and on auth page
  return <Outlet />;
}
