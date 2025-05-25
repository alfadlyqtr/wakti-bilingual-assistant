
import React, { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
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

  // DISABLED AUTHENTICATION REDIRECT - Just pass through and render content
  console.log("ProtectedRoute: Rendering content without authentication check");
  return <Outlet />;
}
