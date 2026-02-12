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

  const waitForSupabaseSession = async (
    maxRetries = 5,
    retryDelay = 500
  ): Promise<Session | null> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        console.log(
          `[AdminAuth] Supabase session found on attempt ${attempt}`
        );
        return session;
      }
      console.log(
        `[AdminAuth] No session on attempt ${attempt}, retrying in ${retryDelay}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    console.log(
      "[AdminAuth] No session after retries, waiting for auth state change"
    );

    return new Promise((resolve) => {
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((event, session) => {
        console.log(
          `[AdminAuth] Auth state changed after retries: ${event}`
        );
        subscription.unsubscribe();
        resolve(session);
      });
      // Fallback timeout in case no event fires
      setTimeout(() => {
        console.log("[AdminAuth] Auth state change timeout reached");
        subscription.unsubscribe();
        resolve(null);
      }, retryDelay * maxRetries);
    });
  };

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

      if (error) {
        console.warn('[AdminAuth] RPC validation failed, keeping existing session:', error);
        return true;
      }

      if (!data || data.length === 0) {
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
      return true;
    }
  };

  useEffect(() => {
    console.log("[AdminAuth] Starting initialization...");
    // Get initial session
    const getInitialSession = async () => {
      console.log("[AdminAuth] Getting initial session...");
      const session = await waitForSupabaseSession();
      console.log("[AdminAuth] Initial session result:", session?.user?.id);
      setSession(session);
      const isValid = await validateAdminSession(session);
      console.log("[AdminAuth] Session validation result:", isValid);
      setIsLoading(false);
      console.log("[AdminAuth] Initialization complete, isLoading set to false");
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AdminAuth] Auth state changed:', event, session?.user?.id);
        setSession(session);
        if (event === 'SIGNED_OUT') {
          await validateAdminSession(null);
        } else {
          await validateAdminSession(session);
        }
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