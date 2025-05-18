
import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute() {
  const { user, isLoading, authInitialized } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log("[ROUTE] ProtectedRoute check:", { 
      isAuthenticated: !!user, 
      isLoading, 
      authInitialized,
      path: location.pathname
    });

    if (!isLoading && authInitialized) {
      // If user is authenticated but trying to access auth pages, redirect to dashboard
      if (user && ["/login", "/signup", "/forgot-password", "/reset-password"].includes(location.pathname)) {
        console.log("[ROUTE] Authenticated user redirected from auth page to dashboard");
        navigate("/dashboard");
      }
      
      // If user is not authenticated and trying to access protected pages, redirect to login
      if (!user && !["/login", "/signup", "/forgot-password", "/reset-password", "/home"].includes(location.pathname)) {
        console.log("[ROUTE] Unauthenticated user redirected to login");
        navigate("/login");
      }
    }
  }, [user, isLoading, authInitialized, location.pathname, navigate]);

  // Show loading state if auth is still initializing
  if (isLoading || !authInitialized) {
    console.log("[ROUTE] Auth still loading, showing loading state");
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  console.log("[ROUTE] Rendering protected route content");
  return <Outlet />;
}
