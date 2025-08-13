import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminSwBypass } from "@/utils/adminSwBypass";
import { supabase } from "@/integrations/supabase/client";

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { isLoading, isAdmin } = useAdminAuth();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  
  useEffect(() => { 
    adminSwBypass(); 
  }, []);

  // CRITICAL: Check for session IMMEDIATELY on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          console.log('[AdminProtectedRoute] Active session found:', session.user.id);
          setHasSession(true);
        } else {
          console.log('[AdminProtectedRoute] No active session');
          setHasSession(false);
        }
      } catch (error) {
        console.error('[AdminProtectedRoute] Session check error:', error);
        setHasSession(false);
      }
      setSessionChecked(true);
    };
    
    checkSession();
  }, []);

  // CRITICAL FIX: If we have a session, IMMEDIATELY render children
  // Don't wait for AdminAuthProvider to finish validation
  if (hasSession) {
    console.log('[AdminProtectedRoute] Session exists, granting immediate access');
    return <>{children}</>;
  }

  // If AdminAuthProvider confirms admin, also allow
  if (isAdmin) {
    console.log('[AdminProtectedRoute] Admin confirmed by context');
    return <>{children}</>;
  }

  // Only show loading if we haven't checked session yet
  if (!sessionChecked || isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Validating admin access...</div>
      </div>
    );
  }

  // No session AND not admin = redirect to login
  console.log('[AdminProtectedRoute] No access, redirecting to login');
  return <Navigate to="/mqtr" replace />;
}