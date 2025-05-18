
import React from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Loading from "@/components/ui/loading";

export default function ProtectedRoute() {
  const { user, session, isLoading } = useAuth();
  const location = useLocation();

  // Show loading when checking authentication
  if (isLoading) {
    console.log("ProtectedRoute: Auth loading");
    return <Loading />;
  }

  // If no user/session after loading completes, redirect to login
  if (!user || !session) {
    console.log("ProtectedRoute: No authenticated user, redirecting to login");
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // User is authenticated, render the protected content
  console.log("ProtectedRoute: User authenticated, rendering content");
  return <Outlet />;
}
