
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface AdminSession {
  admin_id: string;
  session_token: string;
  expires_at: string;
  email: string;
}

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const [isValidating, setIsValidating] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    validateAdminAccess();
  }, []);

  const validateAdminAccess = async () => {
    try {
      const storedSession = localStorage.getItem('admin_session');
      
      if (!storedSession) {
        setIsAuthenticated(false);
        setIsValidating(false);
        return;
      }

      const session: AdminSession = JSON.parse(storedSession);
      
      // Check if session is expired
      if (new Date(session.expires_at) < new Date()) {
        localStorage.removeItem('admin_session');
        setIsAuthenticated(false);
        setIsValidating(false);
        return;
      }

      // Validate session with database
      const { data, error } = await supabase.rpc('validate_admin_session', {
        p_session_token: session.session_token
      });

      if (error || !data || data.length === 0) {
        localStorage.removeItem('admin_session');
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.error('Admin session validation error:', err);
      localStorage.removeItem('admin_session');
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
