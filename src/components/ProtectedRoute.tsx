
import React, { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Loading from "@/components/ui/loading";

export default function ProtectedRoute() {
  const { user, session, isLoading } = useAuth();

  useEffect(() => {
    console.log("ProtectedRoute: Current auth state:", {
      isLoading,
      hasUser: !!user,
      hasSession: !!session
    });
  }, [isLoading, user, session]);

  if (isLoading) {
    console.log("ProtectedRoute: Still loading auth state, showing loading");
    return <Loading />;
  }

  if (!user || !session) {
    console.log("ProtectedRoute: No authenticated user or session found, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  console.log("ProtectedRoute: User authenticated, rendering protected content");
  return <Outlet />;
}
