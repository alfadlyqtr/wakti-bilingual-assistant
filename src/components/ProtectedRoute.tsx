
import React, { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
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

  if (!user || !session) {
    console.log("ProtectedRoute: No authenticated user or session found, redirecting to login");
    // Save the path the user was trying to access
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  console.log("ProtectedRoute: User authenticated, rendering protected content");
  return <Outlet />;
}
