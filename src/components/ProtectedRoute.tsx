
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

  if (isLoading) {
    console.log("ProtectedRoute: Still loading auth state, showing loading");
    return <Loading />;
  }

  // If no user or session, redirect to home instead of login
  // This helps break potential redirect loops
  if (!user || !session) {
    console.log("ProtectedRoute: No authenticated user, redirecting to home");
    return <Navigate to="/home" state={{ from: location }} replace />;
  }

  // User is authenticated, render the protected content
  console.log("ProtectedRoute: User authenticated, rendering content");
  return <Outlet />;
}
