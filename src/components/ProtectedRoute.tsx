import React, { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children?: React.ReactNode;
  requireAuth?: boolean; // Added this property to fix the TypeScript error
}

/**
 * ProtectedRoute component that controls access to routes based on authentication status.
 * Redirects unauthenticated users to the login page.
 * Redirects authenticated users away from auth pages (login, signup) to dashboard.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAuth = true // Default to requiring auth
}) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const isAuthPage = ['/login', '/signup', '/forgot-password'].includes(currentPath);
  
  // Log route protection check
  console.log(`[${new Date().toISOString()}] ProtectedRoute: Checking auth for path "${currentPath}" - isAuthenticated: ${isAuthenticated}, isLoading: ${isLoading}`);

  useEffect(() => {
    console.log(`[${new Date().toISOString()}] ProtectedRoute: Mount effect for path "${currentPath}"`);
    
    return () => {
      console.log(`[${new Date().toISOString()}] ProtectedRoute: Unmount effect for path "${currentPath}"`);
    };
  }, [currentPath]);

  // If still loading auth state, show nothing or a minimal loading indicator
  if (isLoading) {
    console.log(`[${new Date().toISOString()}] ProtectedRoute: Auth state still loading for path "${currentPath}"`);
    return null; // Return nothing while loading to avoid flash of content
  }

  // If this is a protected route (requireAuth=true) and user is not authenticated,
  // redirect to login
  if (requireAuth && !isAuthenticated) {
    console.log(`[${new Date().toISOString()}] ProtectedRoute: Unauthenticated user attempting to access protected page "${currentPath}", redirecting to /login`);
    return <Navigate to="/login" replace />;
  }

  // If this is an auth route (requireAuth=false) and user is authenticated,
  // redirect to dashboard
  if (!requireAuth && isAuthenticated) {
    console.log(`[${new Date().toISOString()}] ProtectedRoute: Authenticated user attempting to access auth page "${currentPath}", redirecting to /dashboard`);
    return <Navigate to="/dashboard" replace />;
  }

  // Otherwise, render the children or outlet
  console.log(`[${new Date().toISOString()}] ProtectedRoute: Rendering content for path "${currentPath}" - auth check passed`);
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
