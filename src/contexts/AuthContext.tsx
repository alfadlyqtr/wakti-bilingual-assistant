
import React, { createContext, useContext } from 'react';

// This is a temporary placeholder to fix build errors
// Will be replaced with a proper implementation in Step 3

interface AuthContextValue {
  user: any | null;
  session: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
}

const defaultAuthContext: AuthContextValue = {
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: false,
  login: async () => ({ user: null, error: new Error('Not implemented') }),
  logout: async () => {},
};

export const AuthContext = createContext<AuthContextValue>(defaultAuthContext);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('[AuthContext] Using temporary placeholder AuthProvider');
  return (
    <AuthContext.Provider value={defaultAuthContext}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
