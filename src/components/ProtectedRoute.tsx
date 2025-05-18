
import React, { useEffect } from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Loading from "@/components/ui/loading";

export default function ProtectedRoute() {
  const { user, session, isLoading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    console.log("ProtectedRoute: Current auth state:", {
      isLoading,
      hasUser: !!user,
      hasSession: !!session,
      currentPath: location.pathname
    });
  }, [isLoading, user, session, location.pathname]);

  // Show loading indicator while authentication state is being determined
  if (isLoading) {
    console.log("ProtectedRoute: Still loading auth state, showing loading indicator");
    return <Loading />;
  }

  // If not authenticated, redirect to home
  if (!user || !session) {
    console.log("ProtectedRoute: Not authenticated, redirecting to home");
    return <Navigate to="/home" state={{ from: location }} replace />;
  }

  // User is authenticated, render the protected content
  console.log("ProtectedRoute: User authenticated, rendering content");
  return <Outlet />;
}
