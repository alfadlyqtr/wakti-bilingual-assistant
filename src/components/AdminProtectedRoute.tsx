
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

interface AdminData {
  admin_id: string;
  email: string;
  full_name: string;
  role: string;
  permissions: any;
  is_active: boolean;
}

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const [isValidating, setIsValidating] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [adminData, setAdminData] = useState<AdminData | null>(null);

  useEffect(() => {
    validateAdminAccess();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AdminProtectedRoute] Auth state changed:', event, session?.user?.id);
        if (session) {
          await validateAdminAccess();
        } else {
          setIsAuthenticated(false);
          setSession(null);
          setAdminData(null);
          setIsValidating(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const validateAdminAccess = async () => {
    try {
      console.log('[AdminProtectedRoute] Starting validation...');
      
      // Get current Supabase Auth session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('[AdminProtectedRoute] Session error:', sessionError);
        setIsAuthenticated(false);
        setIsValidating(false);
        return;
      }

      if (!session) {
        console.log('[AdminProtectedRoute] No active session');
        setIsAuthenticated(false);
        setIsValidating(false);
        return;
      }

      console.log('[AdminProtectedRoute] Found session for user:', session.user.id);
      setSession(session);

      // Verify user is an admin
      const { data: adminData, error: adminError } = await supabase.rpc('get_admin_by_auth_id', {
        auth_user_id: session.user.id
      });

      console.log('[AdminProtectedRoute] Admin verification result:', { adminData, adminError });

      if (adminError) {
        console.error('[AdminProtectedRoute] Admin verification error:', adminError);
        setIsAuthenticated(false);
      } else if (!adminData || adminData.length === 0) {
        console.log('[AdminProtectedRoute] User is not an admin');
        setIsAuthenticated(false);
      } else {
        console.log('[AdminProtectedRoute] Admin access confirmed:', adminData[0]);
        setAdminData(adminData[0]);
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.error('[AdminProtectedRoute] Exception during validation:', err);
      setIsAuthenticated(false);
    } finally {
      setIsValidating(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Validating admin access...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/mqtr" replace />;
  }

  return <>{children}</>;
}
