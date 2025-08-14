import { supabase } from "@/integrations/supabase/client";

interface AdminSession {
  admin_id: string;
  email: string;
  full_name: string;
  role: string;
  expires_at: string;
}

export const validateAdminSession = async (): Promise<boolean> => {
  try {
    // Check localStorage first
    const storedSession = localStorage.getItem('admin_session');
    if (!storedSession) {
      console.log('[AdminAuth] No stored session found');
      return false;
    }

    const session: AdminSession = JSON.parse(storedSession);
    
    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      console.log('[AdminAuth] Session expired');
      localStorage.removeItem('admin_session');
      return false;
    }

    // Check if we have a valid Supabase auth session
    const { data: { session: supabaseSession } } = await supabase.auth.getSession();
    if (!supabaseSession?.user?.id) {
      console.log('[AdminAuth] No Supabase session found');
      localStorage.removeItem('admin_session');
      return false;
    }

    console.log('[AdminAuth] Valid admin session found');
    return true;
  } catch (error) {
    console.error('[AdminAuth] Error validating session:', error);
    localStorage.removeItem('admin_session');
    return false;
  }
};

export const getAdminSession = (): AdminSession | null => {
  try {
    const storedSession = localStorage.getItem('admin_session');
    if (!storedSession) return null;
    
    const session: AdminSession = JSON.parse(storedSession);
    
    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
      localStorage.removeItem('admin_session');
      return null;
    }
    
    return session;
  } catch {
    localStorage.removeItem('admin_session');
    return null;
  }
};

export const clearAdminSession = (): void => {
  localStorage.removeItem('admin_session');
};