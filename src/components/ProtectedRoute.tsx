
import React from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Loading from "@/components/ui/loading";

export default function ProtectedRoute() {
  const { user, session, isLoading } = useAuth();
  const location = useLocation();

  console.log("ProtectedRoute: Auth state:", { 
    isLoading, 
    hasUser: !!user, 
    hasSession: !!session, 
    path: location.pathname 
  });

  // Show loading indicator while authentication state is being determined
  if (isLoading) {
    return <Loading />;
  }

  // If not authenticated, redirect to login page
  if (!user || !session) {
    console.log("ProtectedRoute: Not authenticated, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  // User is authenticated, render the protected content
  console.log("ProtectedRoute: Authenticated, rendering content");
  return <Outlet />;
}
