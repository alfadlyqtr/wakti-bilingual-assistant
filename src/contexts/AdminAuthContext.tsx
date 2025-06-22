
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  permissions: Record<string, boolean>;
}

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const sessionToken = localStorage.getItem('admin_session_token');
      if (!sessionToken) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc('validate_admin_session', {
        p_session_token: sessionToken
      });

      if (error || !data || data.length === 0) {
        localStorage.removeItem('admin_session_token');
        setLoading(false);
        return;
      }

      const admin = data[0];
      setAdminUser({
        id: admin.admin_id,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
        permissions: admin.permissions || {}
      });
    } catch (error) {
      console.error('Error checking admin session:', error);
      localStorage.removeItem('admin_session_token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc('authenticate_admin', {
        p_email: email,
        p_password: password
      });

      if (error || !data || data.length === 0) {
        return { success: false, error: 'Invalid credentials' };
      }

      const result = data[0];
      localStorage.setItem('admin_session_token', result.session_token);
      
      // Get admin details
      const { data: adminData, error: adminError } = await supabase.rpc('validate_admin_session', {
        p_session_token: result.session_token
      });

      if (adminError || !adminData || adminData.length === 0) {
        return { success: false, error: 'Failed to get admin details' };
      }

      const admin = adminData[0];
      setAdminUser({
        id: admin.admin_id,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
        permissions: admin.permissions || {}
      });

      return { success: true };
    } catch (error) {
      console.error('Admin login error:', error);
      return { success: false, error: 'Login failed' };
    }
  };

  const logout = async () => {
    localStorage.removeItem('admin_session_token');
    setAdminUser(null);
  };

  return (
    <AdminAuthContext.Provider value={{ adminUser, login, logout, loading }}>
      {children}
    </AdminAuthContext.Provider>
  );
};
