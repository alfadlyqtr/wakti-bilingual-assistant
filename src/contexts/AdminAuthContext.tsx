import { createContext, useContext, useEffect, useState } from "react";
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

interface AdminAuthContextType {
  session: Session | null;
  adminData: AdminData | null;
  isLoading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
};

interface AdminAuthProviderProps {
  children: React.ReactNode;
}

export const AdminAuthProvider = ({ children }: AdminAuthProviderProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const validateAdminSession = async (currentSession: Session | null) => {
    if (!currentSession) {
      setAdminData(null);
      localStorage.removeItem('admin_session');
      return false;
    }

    try {
      const { data, error } = await supabase.rpc('get_admin_by_auth_id', {
        auth_user_id: currentSession.user.id
      });

      if (error || !data || data.length === 0) {
        console.log('[AdminAuth] User is not an admin');
        setAdminData(null);
        localStorage.removeItem('admin_session');
        return false;
      }

      console.log('[AdminAuth] Admin verified:', data[0]);
      setAdminData(data[0]);
      
      // Store admin session in localStorage for persistence
      const adminSession = {
        admin_id: data[0].admin_id,
        email: data[0].email,
        full_name: data[0].full_name,
        role: data[0].role,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      };
      localStorage.setItem('admin_session', JSON.stringify(adminSession));
      
      return true;
    } catch (error) {
      console.error('[AdminAuth] Error validating admin:', error);
      setAdminData(null);
      localStorage.removeItem('admin_session');
      return false;
    }
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      await validateAdminSession(session);
      setIsLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AdminAuth] Auth state changed:', event, session?.user?.id);
        setSession(session);
        await validateAdminSession(session);
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[AdminAuth] Sign out error:', error);
      }
    } catch (error) {
      console.error('[AdminAuth] Exception during sign out:', error);
    }
  };

  const value: AdminAuthContextType = {
    session,
    adminData,
    isLoading,
    // Treat missing is_active as true to avoid false negatives if RPC omits the column.
    isAdmin: !!adminData && ((adminData as any).is_active ?? true),
    signOut,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};