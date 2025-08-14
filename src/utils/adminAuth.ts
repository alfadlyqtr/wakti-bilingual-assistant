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
    // First check if we have a valid Supabase auth session
    let { data: { session: supabaseSession } } = await supabase.auth.getSession();

    // Supabase can return null while restoring a session, so retry a few times
    let attempts = 0;
    while (!supabaseSession?.user?.id && attempts < 5) {
      attempts++;
      console.log(`[AdminAuth] Waiting for Supabase session (attempt ${attempts}/5)`);
      await new Promise(resolve => setTimeout(resolve, 500));
      ({ data: { session: supabaseSession } } = await supabase.auth.getSession());
    }

    if (!supabaseSession?.user?.id) {
      console.log('[AdminAuth] No Supabase session found after retries');
      localStorage.removeItem('admin_session');
      return false;
    }

    // Check localStorage session
    const storedSession = localStorage.getItem('admin_session');
    if (!storedSession) {
      console.log('[AdminAuth] No stored admin session found');
      return false;
    }

    const session: AdminSession = JSON.parse(storedSession);
    
    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      console.log('[AdminAuth] Session expired');
      localStorage.removeItem('admin_session');
      return false;
    }

    // Verify admin status with backend
    try {
      const { data, error } = await supabase.rpc('get_admin_by_auth_id', {
        auth_user_id: supabaseSession.user.id
      });

      if (error || !data || data.length === 0) {
        console.log('[AdminAuth] User is not an admin');
        localStorage.removeItem('admin_session');
        return false;
      }

      console.log('[AdminAuth] Valid admin session found');
      return true;
    } catch (rpcError) {
      console.warn('[AdminAuth] RPC validation failed, falling back to localStorage check:', rpcError);
      // Fallback to localStorage check if RPC fails
      return true;
    }
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