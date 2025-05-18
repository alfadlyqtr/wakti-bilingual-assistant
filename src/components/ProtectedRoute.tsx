
import React, { useState, useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Loading from "@/components/ui/loading";

export default function ProtectedRoute() {
  const { user, session, isLoading } = useAuth();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    console.log("ProtectedRoute: Auth check", { hasUser: !!user, hasSession: !!session, isLoading });
    
    // Simple delay to ensure auth state is stable before making decisions
    const timer = setTimeout(() => {
      setIsVerifying(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [user, session, isLoading]);

  // Show loading when checking authentication or when auth is still loading
  if (isLoading || isVerifying) {
    return <Loading />;
  }

  // If still no user/session after verification delay, redirect to login
  if (!user || !session) {
    console.log("ProtectedRoute: No authenticated user, redirecting to login");
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // User is authenticated, render the protected content
  console.log("ProtectedRoute: User authenticated, rendering content");
  return <Outlet />;
}
